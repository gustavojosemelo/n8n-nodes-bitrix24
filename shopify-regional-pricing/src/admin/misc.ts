import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/client';
import { logger } from '../logger';
import { enqueueJob } from '../jobs/enqueue';
import { invalidateRegionsCache } from '../storefront/priceCache';
import { graphQLContext } from '../shopify/shops';
import { registerWebhooks } from '../shopify/webhooks';
import { shopOf } from './session';

export async function miscRoutes(app: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // Catalogo
  // -------------------------------------------------------------------------

  app.get('/api/catalog', async (request) => {
    const shop = shopOf(request);
    const query = z
      .object({
        search: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(250).default(50),
      })
      .parse(request.query ?? {});

    const where = {
      shopId: shop.id,
      status: 'ACTIVE',
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { sku: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, items, lastSync] = await Promise.all([
      prisma.shopProduct.count({ where }),
      prisma.shopProduct.findMany({
        where,
        orderBy: { title: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.shopProduct.findFirst({
        where: { shopId: shop.id },
        orderBy: { syncedAt: 'desc' },
        select: { syncedAt: true },
      }),
    ]);

    return {
      total,
      page: query.page,
      limit: query.limit,
      lastSyncedAt: lastSync?.syncedAt ?? null,
      items: items.map((p) => ({
        shopifyProductId: p.shopifyProductId,
        title: p.title,
        sku: p.sku,
        imageUrl: p.imageUrl,
        basePrice: p.basePrice ? p.basePrice.toFixed(2) : null,
        hasRegionOption: p.hasRegionOption,
      })),
    };
  });

  app.post('/api/catalog/refresh', async (request) => {
    const shop = shopOf(request);
    const job = await enqueueJob({ shopId: shop.id, type: 'catalog_sync', payload: {} });
    return { job };
  });

  // -------------------------------------------------------------------------
  // Jobs (polling de progresso da UI)
  // -------------------------------------------------------------------------

  app.get('/api/jobs', async (request) => {
    const shop = shopOf(request);
    const query = z
      .object({
        status: z.enum(['queued', 'running', 'done', 'failed']).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(request.query ?? {});

    const jobs = await prisma.syncJob.findMany({
      where: { shopId: shop.id, ...(query.status ? { status: query.status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
    });

    return { jobs };
  });

  app.get('/api/jobs/:id', async (request, reply) => {
    const shop = shopOf(request);
    const { id } = request.params as { id: string };

    const job = await prisma.syncJob.findFirst({ where: { id, shopId: shop.id } });
    if (!job) return reply.code(404).send({ error: 'job nao encontrado' });

    return job;
  });

  // -------------------------------------------------------------------------
  // Settings (4.5)
  // -------------------------------------------------------------------------

  app.get('/api/settings', async (request) => {
    const shop = shopOf(request);

    const settings = await prisma.settings.upsert({
      where: { shopId: shop.id },
      create: { shopId: shop.id },
      update: {},
    });

    const regions = await prisma.region.findMany({
      where: { shopId: shop.id, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    });

    return { settings, regions, shopDomain: shop.shopDomain };
  });

  app.put('/api/settings', async (request, reply) => {
    const shop = shopOf(request);
    const parsed = z
      .object({
        defaultRegionId: z.string().nullable().optional(),
        popupTitle: z.string().trim().min(1).max(120).optional(),
        popupSubtitle: z.string().trim().max(240).nullable().optional(),
        popupMode: z.enum(['cep', 'cidade', 'ambos']).optional(),
        blockNavigation: z.boolean().optional(),
        attachSellingPlans: z.boolean().optional(),
        alertWebhookUrl: z.string().url().nullable().optional().or(z.literal('')),
      })
      .safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: 'dados invalidos', issues: parsed.error.issues });
    }

    if (parsed.data.defaultRegionId) {
      const region = await prisma.region.findFirst({
        where: { id: parsed.data.defaultRegionId, shopId: shop.id },
      });
      if (!region) return reply.code(400).send({ error: 'regiao padrao invalida' });
    }

    const settings = await prisma.settings.upsert({
      where: { shopId: shop.id },
      create: { shopId: shop.id, ...normalizeSettings(parsed.data) },
      update: normalizeSettings(parsed.data),
    });

    invalidateRegionsCache(shop.id);
    logger.info({ shopId: shop.id }, 'settings atualizadas');

    return settings;
  });

  // -------------------------------------------------------------------------
  // Painel de saude (9.4) e reconciliacao (9.3)
  // -------------------------------------------------------------------------

  app.get('/api/health/dashboard', async (request) => {
    const shop = shopOf(request);

    const [regions, totalProducts, failedJobs, lastSuccess, runningJobs] = await Promise.all([
      prisma.region.findMany({
        where: { shopId: shop.id, isActive: true },
        include: { prices: { select: { shopifyProductId: true, syncStatus: true } } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.shopProduct.count({ where: { shopId: shop.id, status: 'ACTIVE' } }),
      prisma.syncJob.findMany({
        where: { shopId: shop.id, status: 'failed' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.syncJob.findFirst({
        where: { shopId: shop.id, status: 'done' },
        orderBy: { finishedAt: 'desc' },
      }),
      prisma.syncJob.count({ where: { shopId: shop.id, status: { in: ['queued', 'running'] } } }),
    ]);

    const products = await prisma.shopProduct.findMany({
      where: { shopId: shop.id, status: 'ACTIVE' },
      select: { shopifyProductId: true, title: true },
    });

    // Produtos sem preco em alguma regiao ativa.
    const missing: Array<{ shopifyProductId: string; title: string; regions: string[] }> = [];
    for (const product of products) {
      const without = regions
        .filter((region) => !region.prices.some((p) => p.shopifyProductId === product.shopifyProductId))
        .map((region) => region.name);
      if (without.length > 0) {
        missing.push({ shopifyProductId: product.shopifyProductId, title: product.title, regions: without });
      }
    }

    const errorCount = regions.reduce(
      (acc, region) => acc + region.prices.filter((p) => p.syncStatus === 'error').length,
      0,
    );

    return {
      totalProducts,
      totalRegions: regions.length,
      productsMissingPrice: missing.slice(0, 100),
      productsMissingPriceCount: missing.length,
      priceErrorCount: errorCount,
      failedJobs,
      runningJobs,
      lastSuccessfulSync: lastSuccess?.finishedAt ?? null,
      healthy: missing.length === 0 && errorCount === 0 && failedJobs.length === 0,
    };
  });

  app.post('/api/reconcile', async (request) => {
    const shop = shopOf(request);
    const body = z
      .object({ regionIds: z.array(z.string()).optional(), apply: z.boolean().default(true) })
      .parse(request.body ?? {});

    const job = await enqueueJob({ shopId: shop.id, type: 'reconcile', payload: body });
    return { job };
  });

  /** Reinstalar webhooks a partir da UI (util quando a URL do app muda). */
  app.post('/api/webhooks/register', async (request) => {
    const shop = shopOf(request);
    const result = await registerWebhooks(graphQLContext(shop));
    return result;
  });
}

function normalizeSettings(data: {
  defaultRegionId?: string | null;
  popupTitle?: string;
  popupSubtitle?: string | null;
  popupMode?: string;
  blockNavigation?: boolean;
  attachSellingPlans?: boolean;
  alertWebhookUrl?: string | null;
}) {
  return {
    ...(data.defaultRegionId !== undefined ? { defaultRegionId: data.defaultRegionId || null } : {}),
    ...(data.popupTitle !== undefined ? { popupTitle: data.popupTitle } : {}),
    ...(data.popupSubtitle !== undefined ? { popupSubtitle: data.popupSubtitle || null } : {}),
    ...(data.popupMode !== undefined ? { popupMode: data.popupMode } : {}),
    ...(data.blockNavigation !== undefined ? { blockNavigation: data.blockNavigation } : {}),
    ...(data.attachSellingPlans !== undefined ? { attachSellingPlans: data.attachSellingPlans } : {}),
    ...(data.alertWebhookUrl !== undefined ? { alertWebhookUrl: data.alertWebhookUrl || null } : {}),
  };
}
