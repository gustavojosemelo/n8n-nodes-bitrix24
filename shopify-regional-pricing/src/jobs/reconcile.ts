import { getConfig } from '../config';
import { prisma } from '../db/client';
import { logger } from '../logger';
import { findRegionVariant, getProduct } from '../shopify/products';
import { contextForShop } from '../shopify/shops';
import { invalidateRegionPriceCache } from '../storefront/priceCache';
import { runWithConcurrency } from './pool';
import { syncRegionToShopify } from './syncRegion';
import type { JobResultSummary, ReconcilePayload } from './types';

export interface Divergence {
  regionId: string;
  regionName: string;
  productId: string;
  kind: 'variante_ausente' | 'preco_divergente' | 'id_desatualizado' | 'produto_ausente';
  expected?: string;
  found?: string;
}

/**
 * Etapa 9.3 - reconciliacao banco x Shopify.
 *
 * O banco e a fonte de verdade: onde houver divergencia, o app corrige a
 * Shopify. Roda em dois passos: um diagnostico read-only e, se `apply`,
 * um sync das regioes afetadas.
 */
export async function reconcile(
  shopId: string,
  payload: ReconcilePayload & { apply?: boolean } = {},
  onProgress?: (done: number, total: number) => Promise<void> | void,
): Promise<JobResultSummary & { divergences: Divergence[] }> {
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    return { processed: 0, succeeded: 0, failed: 0, messages: ['loja nao encontrada'], divergences: [] };
  }

  const ctx = await contextForShop(shop.shopDomain);

  const regions = await prisma.region.findMany({
    where: {
      shopId,
      isActive: true,
      ...(payload.regionIds?.length ? { id: { in: payload.regionIds } } : {}),
    },
    include: { prices: true },
    orderBy: { sortOrder: 'asc' },
  });

  const divergences: Divergence[] = [];
  const affectedRegions = new Set<string>();

  const units = regions.flatMap((region) =>
    region.prices.map((price) => ({ region, price })),
  );

  let done = 0;

  await runWithConcurrency(units, getConfig().SYNC_CONCURRENCY, async ({ region, price }) => {
    try {
      const product = await getProduct(ctx, price.shopifyProductId);

      if (!product) {
        divergences.push({
          regionId: region.id,
          regionName: region.name,
          productId: price.shopifyProductId,
          kind: 'produto_ausente',
        });
        return;
      }

      const variant = findRegionVariant(product, region.name);

      if (!variant) {
        divergences.push({
          regionId: region.id,
          regionName: region.name,
          productId: price.shopifyProductId,
          kind: 'variante_ausente',
        });
        affectedRegions.add(region.id);
        return;
      }

      if (variant.id !== price.shopifyVariantId) {
        divergences.push({
          regionId: region.id,
          regionName: region.name,
          productId: price.shopifyProductId,
          kind: 'id_desatualizado',
          expected: price.shopifyVariantId ?? '(vazio)',
          found: variant.id,
        });
        // Corrigivel direto no banco: a Shopify tem o id verdadeiro.
        await prisma.regionPrice.update({
          where: { id: price.id },
          data: { shopifyVariantId: variant.id },
        });
      }

      const expectedPrice = price.price.toFixed(2);
      if (variant.price !== expectedPrice) {
        divergences.push({
          regionId: region.id,
          regionName: region.name,
          productId: price.shopifyProductId,
          kind: 'preco_divergente',
          expected: expectedPrice,
          found: variant.price,
        });
        affectedRegions.add(region.id);
      }
    } catch (err) {
      logger.error(
        { regionId: region.id, productId: price.shopifyProductId, err: String(err) },
        'falha ao reconciliar produto',
      );
    } finally {
      done += 1;
      if (onProgress) await onProgress(done, units.length);
    }
  });

  const messages = divergences
    .slice(0, 50)
    .map((d) => `${d.regionName} / ${d.productId}: ${d.kind}${d.expected ? ` (banco ${d.expected}, shopify ${d.found})` : ''}`);

  if (payload.apply && affectedRegions.size > 0) {
    for (const regionId of affectedRegions) {
      await syncRegionToShopify(regionId);
      invalidateRegionPriceCache(shopId, regionId);
    }
    messages.push(`${affectedRegions.size} regiao(oes) ressincronizada(s)`);
  }

  logger.info(
    { shopId, checked: units.length, divergences: divergences.length, applied: Boolean(payload.apply) },
    'reconciliacao concluida',
  );

  return {
    processed: units.length,
    succeeded: units.length - divergences.length,
    failed: divergences.length,
    messages,
    divergences,
  };
}
