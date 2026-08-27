import type { SyncJob } from '@prisma/client';
import { prisma } from '../db/client';
import { logger } from '../logger';
import type { SyncJobPayload, SyncJobType } from './types';

export async function enqueueJob(params: {
  shopId: string;
  type: SyncJobType;
  payload: SyncJobPayload;
  regionId?: string | null;
}): Promise<SyncJob> {
  const job = await prisma.syncJob.create({
    data: {
      shopId: params.shopId,
      type: params.type,
      payload: params.payload as object,
      regionId: params.regionId ?? null,
      status: 'queued',
    },
  });

  logger.info({ jobId: job.id, type: job.type, shopId: job.shopId }, 'job enfileirado');
  return job;
}

/**
 * Evita empilhar jobs identicos quando o operador clica varias vezes em
 * "Confirmar e sincronizar". Se ja existe um job do mesmo tipo/regiao
 * pendente ou rodando, reaproveita.
 */
export async function enqueueRegionSyncOnce(params: {
  shopId: string;
  regionId: string;
  type: 'region_create' | 'region_update';
  previousName?: string;
}): Promise<SyncJob> {
  const pending = await prisma.syncJob.findFirst({
    where: {
      shopId: params.shopId,
      regionId: params.regionId,
      status: { in: ['queued', 'running'] },
      type: { in: ['region_create', 'region_update'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (pending) {
    logger.info({ jobId: pending.id, regionId: params.regionId }, 'job de sync ja pendente, reaproveitando');
    return pending;
  }

  return enqueueJob({
    shopId: params.shopId,
    type: params.type,
    regionId: params.regionId,
    payload: {
      regionId: params.regionId,
      ...(params.previousName ? { previousName: params.previousName } : {}),
    },
  });
}
