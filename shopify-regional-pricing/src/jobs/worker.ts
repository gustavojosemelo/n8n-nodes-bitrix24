import type { SyncJob } from '@prisma/client';
import { getConfig } from '../config';
import { prisma } from '../db/client';
import { logger } from '../logger';
import { invalidateRegionPriceCache, invalidateRegionsCache } from '../storefront/priceCache';
import { backfillProducts } from './backfill';
import { syncCatalog } from './catalog';
import { deleteRegionFromShopify } from './deleteRegion';
import { reconcile } from './reconcile';
import { syncRegionToShopify } from './syncRegion';
import type {
  JobResultSummary,
  ProductBackfillPayload,
  ReconcilePayload,
  RegionDeletePayload,
  RegionSyncPayload,
} from './types';

const MAX_ATTEMPTS = 3;

/**
 * Reivindica um job de forma atomica.
 * FOR UPDATE SKIP LOCKED garante que duas instancias do app (ou dois ticks
 * do mesmo worker) nunca peguem o mesmo job.
 */
async function claimNextJob(): Promise<SyncJob | null> {
  const rows = await prisma.$queryRaw<SyncJob[]>`
    UPDATE "SyncJob"
    SET "status" = 'running',
        "startedAt" = NOW(),
        "attempts" = "attempts" + 1
    WHERE "id" = (
      SELECT "id" FROM "SyncJob"
      WHERE "status" = 'queued'
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `;

  return rows[0] ?? null;
}

async function reportProgress(jobId: string, done: number, total: number): Promise<void> {
  // Escreve a cada 5 itens (ou no ultimo) para o polling de 3s da UI ver
  // progresso sem transformar cada produto num UPDATE.
  if (done % 5 !== 0 && done !== total) return;
  await prisma.syncJob.update({
    where: { id: jobId },
    data: { progressDone: done, progressTotal: total },
  });
}

async function runJob(job: SyncJob): Promise<JobResultSummary> {
  const payload = (job.payload ?? {}) as Record<string, unknown>;
  const onProgress = (done: number, total: number) => reportProgress(job.id, done, total);

  switch (job.type) {
    case 'region_create':
    case 'region_update': {
      const data = payload as unknown as RegionSyncPayload;
      const regionId = data.regionId ?? job.regionId;
      if (!regionId) throw new Error('job sem regionId');
      const result = await syncRegionToShopify(regionId, {
        previousName: data.previousName,
        onProgress,
      });
      invalidateRegionPriceCache(job.shopId, regionId);
      invalidateRegionsCache(job.shopId);
      return result;
    }

    case 'region_delete':
      return deleteRegionFromShopify(job.shopId, payload as unknown as RegionDeletePayload, onProgress);

    case 'product_backfill':
      return backfillProducts(job.shopId, payload as unknown as ProductBackfillPayload, onProgress);

    case 'reconcile':
      return reconcile(job.shopId, payload as unknown as ReconcilePayload, onProgress);

    case 'catalog_sync':
      return syncCatalog(job.shopId);

    default:
      throw new Error(`tipo de job desconhecido: ${job.type}`);
  }
}

/** Etapa 10.5 - alerta quando um SyncJob falha. */
async function notifyFailure(job: SyncJob, error: string): Promise<void> {
  try {
    const settings = await prisma.settings.findUnique({ where: { shopId: job.shopId } });
    const url = settings?.alertWebhookUrl;
    if (!url) return;

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'sync_job_failed',
        jobId: job.id,
        type: job.type,
        shopId: job.shopId,
        regionId: job.regionId,
        attempts: job.attempts,
        error,
        at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    logger.warn({ jobId: job.id, err: String(err) }, 'nao foi possivel enviar o alerta de falha');
  }
}

async function processOne(): Promise<boolean> {
  const job = await claimNextJob();
  if (!job) return false;

  const startedAt = Date.now();
  logger.info({ jobId: job.id, type: job.type, attempt: job.attempts }, 'job iniciado');

  try {
    const result = await runJob(job);
    const durationMs = Date.now() - startedAt;

    // Falha parcial (alguns produtos com erro) marca o job como failed para
    // aparecer no painel de saude, mas sem reprocessar tudo: o operador ve
    // exatamente quais produtos falharam em RegionPrice.syncError.
    const status = result.failed > 0 ? 'failed' : 'done';

    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status,
        finishedAt: new Date(),
        progressDone: result.processed,
        progressTotal: result.processed,
        error: result.failed > 0 ? result.messages.join('\n').slice(0, 4000) : null,
      },
    });

    logger.info(
      {
        jobId: job.id,
        type: job.type,
        durationMs,
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        status,
      },
      'job finalizado',
    );

    if (status === 'failed') await notifyFailure(job, result.messages.join('\n'));
    return true;
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    const canRetry = job.attempts < MAX_ATTEMPTS;

    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: canRetry ? 'queued' : 'failed',
        error: message.slice(0, 4000),
        ...(canRetry ? {} : { finishedAt: new Date() }),
      },
    });

    logger.error(
      { jobId: job.id, type: job.type, durationMs, attempt: job.attempts, canRetry, err: message },
      'job falhou',
    );

    if (!canRetry) await notifyFailure(job, message);
    return true;
  }
}

let running = false;
let stopping = false;
let timer: NodeJS.Timeout | null = null;

/** Loop do worker: drena a fila e volta a dormir. */
async function tick(): Promise<void> {
  if (running || stopping) return;
  running = true;
  try {
    // Drena ate 20 jobs por tick para nao segurar o loop indefinidamente.
    for (let i = 0; i < 20; i += 1) {
      const processed = await processOne();
      if (!processed) break;
    }
  } catch (err) {
    logger.error({ err: String(err) }, 'erro inesperado no worker da fila');
  } finally {
    running = false;
  }
}

export function startWorker(): void {
  if (timer) return;
  const interval = getConfig().SYNC_POLL_INTERVAL_MS;
  timer = setInterval(() => void tick(), interval);
  logger.info({ interval }, 'worker da fila de sync iniciado');
  void tick();
}

export async function stopWorker(): Promise<void> {
  stopping = true;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  // Espera o job em andamento terminar (ate 30s) para nao deixar
  // um job preso em "running" apos um deploy.
  const deadline = Date.now() + 30_000;
  while (running && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  logger.info('worker da fila de sync parado');
}

/**
 * Jobs que ficaram em "running" quando o container morreu voltam para a fila
 * no startup. Sem isso, um deploy no meio de um sync deixaria a regiao
 * eternamente "sincronizando".
 */
export async function requeueStaleJobs(): Promise<number> {
  const result = await prisma.syncJob.updateMany({
    where: { status: 'running', attempts: { lt: MAX_ATTEMPTS } },
    data: { status: 'queued' },
  });

  const abandoned = await prisma.syncJob.updateMany({
    where: { status: 'running', attempts: { gte: MAX_ATTEMPTS } },
    data: { status: 'failed', error: 'job interrompido por reinicio do app', finishedAt: new Date() },
  });

  if (result.count || abandoned.count) {
    logger.warn({ requeued: result.count, abandoned: abandoned.count }, 'jobs pendentes reavaliados no startup');
  }

  return result.count;
}
