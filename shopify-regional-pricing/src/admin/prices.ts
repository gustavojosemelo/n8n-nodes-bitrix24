import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db/client';
import { logger } from '../logger';
import { enqueueJob, enqueueRegionSyncOnce } from '../jobs/enqueue';
import { applyPercent, toMoneyString } from '../lib/money';
import { invalidateRegionPriceCache } from '../storefront/priceCache';
import { shopOf } from './session';

const priceItemSchema = z.object({
  shopifyProductId: z.string().min(1),
  price: z.union([z.string(), z.number()]).nullable().optional(),
  compareAtPrice: z.union([z.string(), z.number()]).nullable().optional(),
  isAvailable: z.boolean().optional(),
});

async function assertRegion(shopId: string, regionId: string) {
  return prisma.region.findFirst({ where: { id: regionId, shopId } });
}

export async function priceRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Passo 2 do wizard: catalogo + preco daquela regiao, paginado e filtravel.
   * A tabela vem do espelho local (ShopProduct), nao da Admin API.
   */
  app.get('/api/regions/:id/prices', async (request, reply) => {
    const shop = shopOf(request);
    const { id } = request.params as { id: string };
    const query = z
      .object({
        search: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(250).default(50),
        onlyMissing: z.coerce.boolean().optional(),
      })
      .parse(request.query ?? {});

    const region = await assertRegion(shop.id, id);
    if (!region) return reply.code(404).send({ error: 'regiao nao encontrada' });

    const where: Prisma.ShopProductWhereInput = {
      shopId: shop.id,
      status: 'ACTIVE',
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, products] = await Promise.all([
      prisma.shopProduct.count({ where }),
      prisma.shopProduct.findMany({
        where,
        orderBy: { title: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    const prices = await prisma.regionPrice.findMany({
      where: {
        regionId: id,
        shopifyProductId: { in: products.map((p) => p.shopifyProductId) },
      },
    });

    const byProduct = new Map(prices.map((p) => [p.shopifyProductId, p]));

    const items = products
      .map((product) => {
        const price = byProduct.get(product.shopifyProductId);
        return {
          shopifyProductId: product.shopifyProductId,
          title: product.title,
          sku: product.sku,
          imageUrl: product.imageUrl,
          basePrice: product.basePrice ? product.basePrice.toFixed(2) : null,
          price: price?.price ? price.price.toFixed(2) : null,
          compareAtPrice: price?.compareAtPrice ? price.compareAtPrice.toFixed(2) : null,
          isAvailable: price?.isAvailable ?? true,
          syncStatus: price?.syncStatus ?? 'unset',
          syncError: price?.syncError ?? null,
          shopifyVariantId: price?.shopifyVariantId ?? null,
        };
      })
      .filter((item) => (query.onlyMissing ? item.price === null : true));

    return {
      region: { id: region.id, name: region.name },
      page: query.page,
      limit: query.limit,
      total,
      items,
    };
  });

  /**
   * Salvar rascunho: grava os precos sem enfileirar sync.
   * Preco nulo/vazio remove a linha (produto sem preco naquela regiao).
   */
  app.put('/api/regions/:id/prices', async (request, reply) => {
    const shop = shopOf(request);
    const { id } = request.params as { id: string };
    const parsed = z.object({ items: z.array(priceItemSchema) }).safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: 'dados invalidos', issues: parsed.error.issues });
    }

    const region = await assertRegion(shop.id, id);
    if (!region) return reply.code(404).send({ error: 'regiao nao encontrada' });

    const invalid: string[] = [];
    let saved = 0;
    let removed = 0;

    for (const item of parsed.data.items) {
      const price = toMoneyString(item.price ?? null);

      if (price === null) {
        // Preco em branco: o produto deixa de ser precificado nessa regiao.
        const deleted = await prisma.regionPrice.deleteMany({
          where: { regionId: id, shopifyProductId: item.shopifyProductId },
        });
        removed += deleted.count;
        if (item.price !== null && item.price !== undefined && item.price !== '') {
          invalid.push(item.shopifyProductId);
        }
        continue;
      }

      const compareAt = toMoneyString(item.compareAtPrice ?? null);

      await prisma.regionPrice.upsert({
        where: {
          regionId_shopifyProductId: { regionId: id, shopifyProductId: item.shopifyProductId },
        },
        create: {
          regionId: id,
          shopifyProductId: item.shopifyProductId,
          price,
          compareAtPrice: compareAt,
          isAvailable: item.isAvailable ?? true,
          syncStatus: 'pending',
        },
        update: {
          price,
          compareAtPrice: compareAt,
          isAvailable: item.isAvailable ?? true,
          // Qualquer alteracao de preco volta a linha para pendente.
          syncStatus: 'pending',
          syncError: null,
        },
      });
      saved += 1;
    }

    invalidateRegionPriceCache(shop.id, id);
    logger.info({ shopId: shop.id, regionId: id, saved, removed }, 'rascunho de precos salvo');

    return { saved, removed, invalid };
  });

  /**
   * "Copiar precos de outra regiao" e "Aplicar % sobre outra regiao".
   * percent = 8 aplica +8%; percent = -5 aplica -5%.
   */
  app.post('/api/regions/:id/prices/copy', async (request, reply) => {
    const shop = shopOf(request);
    const { id } = request.params as { id: string };
    const parsed = z
      .object({
        sourceRegionId: z.string().min(1),
        percent: z.number().min(-100).max(1000).default(0),
        /** true = nao sobrescreve precos ja digitados nesta regiao. */
        onlyEmpty: z.boolean().default(false),
        /** false = so devolve a previa, sem gravar. */
        apply: z.boolean().default(true),
      })
      .safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: 'dados invalidos', issues: parsed.error.issues });
    }

    const [region, source] = await Promise.all([
      assertRegion(shop.id, id),
      assertRegion(shop.id, parsed.data.sourceRegionId),
    ]);

    if (!region) return reply.code(404).send({ error: 'regiao nao encontrada' });
    if (!source) return reply.code(404).send({ error: 'regiao de origem nao encontrada' });
    if (source.id === region.id) {
      return reply.code(400).send({ error: 'a regiao de origem precisa ser diferente' });
    }

    const [sourcePrices, targetPrices] = await Promise.all([
      prisma.regionPrice.findMany({ where: { regionId: source.id } }),
      prisma.regionPrice.findMany({ where: { regionId: id } }),
    ]);

    const existing = new Map(targetPrices.map((p) => [p.shopifyProductId, p]));
    const preview: Array<{ shopifyProductId: string; from: string; to: string }> = [];

    for (const sourcePrice of sourcePrices) {
      if (parsed.data.onlyEmpty && existing.has(sourcePrice.shopifyProductId)) continue;

      const from = sourcePrice.price.toFixed(2);
      const to = applyPercent(from, parsed.data.percent);
      if (to === null) continue;

      preview.push({ shopifyProductId: sourcePrice.shopifyProductId, from, to });

      if (parsed.data.apply) {
        const compareAt = sourcePrice.compareAtPrice
          ? applyPercent(sourcePrice.compareAtPrice.toFixed(2), parsed.data.percent)
          : null;

        await prisma.regionPrice.upsert({
          where: {
            regionId_shopifyProductId: {
              regionId: id,
              shopifyProductId: sourcePrice.shopifyProductId,
            },
          },
          create: {
            regionId: id,
            shopifyProductId: sourcePrice.shopifyProductId,
            price: to,
            compareAtPrice: compareAt,
            isAvailable: sourcePrice.isAvailable,
            syncStatus: 'pending',
          },
          update: {
            price: to,
            compareAtPrice: compareAt,
            isAvailable: sourcePrice.isAvailable,
            syncStatus: 'pending',
            syncError: null,
          },
        });
      }
    }

    if (parsed.data.apply) invalidateRegionPriceCache(shop.id, id);

    logger.info(
      {
        shopId: shop.id,
        regionId: id,
        sourceRegionId: source.id,
        percent: parsed.data.percent,
        count: preview.length,
        applied: parsed.data.apply,
      },
      'precos copiados de outra regiao',
    );

    return { count: preview.length, applied: parsed.data.apply, preview: preview.slice(0, 200) };
  });

  /** Passo 3 do wizard: confirma e enfileira o sync. */
  app.post('/api/regions/:id/sync', async (request, reply) => {
    const shop = shopOf(request);
    const { id } = request.params as { id: string };

    const region = await assertRegion(shop.id, id);
    if (!region) return reply.code(404).send({ error: 'regiao nao encontrada' });

    const priced = await prisma.regionPrice.count({ where: { regionId: id } });
    if (priced === 0) {
      return reply.code(400).send({ error: 'nenhum produto precificado nessa regiao' });
    }

    const alreadySynced = await prisma.regionPrice.count({
      where: { regionId: id, syncStatus: 'synced' },
    });

    const job = await enqueueRegionSyncOnce({
      shopId: shop.id,
      regionId: id,
      type: alreadySynced > 0 ? 'region_update' : 'region_create',
    });

    await prisma.syncJob.update({
      where: { id: job.id },
      data: { progressTotal: priced, progressDone: 0 },
    });

    return { job, products: priced };
  });

  /** Reprocessa apenas os produtos que ficaram com erro. */
  app.post('/api/regions/:id/retry-failed', async (request, reply) => {
    const shop = shopOf(request);
    const { id } = request.params as { id: string };

    const region = await assertRegion(shop.id, id);
    if (!region) return reply.code(404).send({ error: 'regiao nao encontrada' });

    const reset = await prisma.regionPrice.updateMany({
      where: { regionId: id, syncStatus: 'error' },
      data: { syncStatus: 'pending', syncError: null },
    });

    const job = await enqueueJob({
      shopId: shop.id,
      type: 'region_update',
      regionId: id,
      payload: { regionId: id },
    });

    return { job, reset: reset.count };
  });
}
