import { getConfig } from '../config';
import { prisma } from '../db/client';
import { logger } from '../logger';
import {
  deleteVariants,
  findRegionOption,
  getProduct,
  updateRegionOption,
} from '../shopify/products';
import { contextForShop } from '../shopify/shops';
import { invalidateRegionPriceCache, invalidateRegionsCache } from '../storefront/priceCache';
import { runWithConcurrency } from './pool';
import type { JobResultSummary, RegionDeletePayload } from './types';

/**
 * Etapa 9.2 - regiao excluida.
 *
 * A linha da Region ja saiu do banco quando este job roda (a rota do admin
 * apaga e enfileira com o snapshot das variantes). Aqui limpamos a Shopify:
 * remove a variante da regiao em cada produto e o valor correspondente da
 * option "Região".
 *
 * Um produto nao pode ficar sem nenhuma variante: se a regiao excluida era a
 * ultima do produto, a variante e preservada e o caso e reportado — cabe ao
 * operador decidir (o produto voltaria a nao ter precificacao regional).
 */
export async function deleteRegionFromShopify(
  shopId: string,
  payload: RegionDeletePayload,
  onProgress?: (done: number, total: number) => Promise<void> | void,
): Promise<JobResultSummary> {
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    return { processed: 0, succeeded: 0, failed: 0, messages: ['loja nao encontrada'] };
  }

  const ctx = await contextForShop(shop.shopDomain);
  const messages: string[] = [];
  let succeeded = 0;
  let failed = 0;
  let done = 0;
  const total = payload.variantsByProduct.length;

  await runWithConcurrency(
    payload.variantsByProduct,
    getConfig().SYNC_CONCURRENCY,
    async (entry) => {
      try {
        const product = await getProduct(ctx, entry.productId);
        if (!product) {
          succeeded += 1;
          return;
        }

        const option = findRegionOption(product);
        const stillExists = product.variants.some((v) => v.id === entry.variantId);

        if (stillExists && product.variants.length <= 1) {
          messages.push(
            `${product.title}: variante mantida porque era a unica do produto ` +
              '(o produto ficaria sem variante alguma)',
          );
          succeeded += 1;
          return;
        }

        if (stillExists) {
          await deleteVariants(ctx, product.id, [entry.variantId]);
        }

        // Remove o valor da option que ficou sem variante.
        if (option) {
          const value = option.optionValues.find((v) => v.name === payload.regionName);
          const otherVariantsUseValue = product.variants.some(
            (v) =>
              v.id !== entry.variantId &&
              v.selectedOptions.some(
                (o) => o.name === option.name && o.value === payload.regionName,
              ),
          );
          if (value && !otherVariantsUseValue) {
            await updateRegionOption(ctx, product.id, { id: option.id }, [value.id]);
          }
        }

        succeeded += 1;
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        messages.push(`${entry.productId}: ${message}`);
        logger.error(
          { productId: entry.productId, variantId: entry.variantId, err: message },
          'falha ao remover variante da regiao excluida',
        );
      } finally {
        done += 1;
        if (onProgress) await onProgress(done, total);
      }
    },
  );

  invalidateRegionPriceCache(shopId);
  invalidateRegionsCache(shopId);

  logger.info(
    { shopId, regionName: payload.regionName, total, succeeded, failed },
    'limpeza da regiao excluida concluida',
  );

  return { processed: total, succeeded, failed, messages: messages.slice(0, 50) };
}
