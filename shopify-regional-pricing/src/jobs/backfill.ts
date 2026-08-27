import { prisma } from '../db/client';
import { logger } from '../logger';
import { getProduct } from '../shopify/products';
import { contextForShop } from '../shopify/shops';
import { invalidateRegionPriceCache } from '../storefront/priceCache';
import { syncRegionToShopify } from './syncRegion';
import type { JobResultSummary, ProductBackfillPayload } from './types';

/**
 * Etapa 9.1 - produto novo criado na loja.
 *
 * Cria uma linha de RegionPrice para cada regiao ativa, com o preco base do
 * produto como ponto de partida, e sincroniza. O operador ajusta os precos
 * depois no app; ate la o produto ja nasce vendavel em todas as regioes,
 * nunca com preco zerado.
 */
export async function backfillProducts(
  shopId: string,
  payload: ProductBackfillPayload,
  onProgress?: (done: number, total: number) => Promise<void> | void,
): Promise<JobResultSummary> {
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    return { processed: 0, succeeded: 0, failed: 0, messages: ['loja nao encontrada'] };
  }

  const regions = await prisma.region.findMany({
    where: { shopId, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  if (regions.length === 0) {
    logger.info({ shopId }, 'backfill sem regioes ativas: nada a fazer');
    return { processed: 0, succeeded: 0, failed: 0, messages: ['nenhuma regiao ativa'] };
  }

  const ctx = await contextForShop(shop.shopDomain);
  const messages: string[] = [];
  let succeeded = 0;
  let failed = 0;
  let done = 0;

  const touchedRegions = new Set<string>();

  for (const productId of payload.productIds) {
    try {
      const product = await getProduct(ctx, productId);
      if (!product) {
        messages.push(`${productId}: produto nao encontrado`);
        failed += 1;
        continue;
      }

      const basePrice = product.variants[0]?.price ?? '0.00';

      // Espelho do catalogo, para o produto aparecer no wizard imediatamente.
      await prisma.shopProduct.upsert({
        where: { shopId_shopifyProductId: { shopId, shopifyProductId: product.id } },
        create: {
          shopId,
          shopifyProductId: product.id,
          title: product.title,
          handle: product.handle ?? null,
          status: product.status ?? 'ACTIVE',
          sku: product.variants[0]?.sku ?? null,
          basePrice,
          imageUrl: product.featuredImageUrl ?? null,
        },
        update: {
          title: product.title,
          handle: product.handle ?? null,
          status: product.status ?? 'ACTIVE',
          basePrice,
          imageUrl: product.featuredImageUrl ?? null,
        },
      });

      for (const region of regions) {
        // createMany + skipDuplicates evita sobrescrever um preco que o
        // operador ja tenha digitado para esse produto.
        await prisma.regionPrice.createMany({
          data: [
            {
              regionId: region.id,
              shopifyProductId: product.id,
              price: basePrice,
              isAvailable: true,
              syncStatus: 'pending',
            },
          ],
          skipDuplicates: true,
        });
        touchedRegions.add(region.id);
      }

      succeeded += 1;
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      messages.push(`${productId}: ${message}`);
      logger.error({ productId, err: message }, 'backfill do produto falhou');
    } finally {
      done += 1;
      if (onProgress) await onProgress(done, payload.productIds.length);
    }
  }

  // Sincroniza cada regiao tocada para que as variantes existam de fato.
  for (const regionId of touchedRegions) {
    const result = await syncRegionToShopify(regionId);
    if (result.failed > 0) {
      messages.push(`regiao ${regionId}: ${result.failed} produto(s) com erro`);
    }
    invalidateRegionPriceCache(shopId, regionId);
  }

  return { processed: payload.productIds.length, succeeded, failed, messages: messages.slice(0, 50) };
}

/** Etapa 9.1 - webhook PRODUCTS_DELETE: limpa RegionPrice orfaos. */
export async function cleanupDeletedProduct(shopId: string, productGid: string): Promise<void> {
  const regions = await prisma.region.findMany({ where: { shopId }, select: { id: true } });

  const removed = await prisma.regionPrice.deleteMany({
    where: {
      shopifyProductId: productGid,
      regionId: { in: regions.map((r) => r.id) },
    },
  });

  await prisma.shopProduct.deleteMany({ where: { shopId, shopifyProductId: productGid } });
  invalidateRegionPriceCache(shopId);

  logger.info({ shopId, productGid, removed: removed.count }, 'precos orfaos removidos');
}
