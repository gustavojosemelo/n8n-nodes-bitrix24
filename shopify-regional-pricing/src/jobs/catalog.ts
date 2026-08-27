import { prisma } from '../db/client';
import { logger } from '../logger';
import { listAllProducts } from '../shopify/products';
import { contextForShop } from '../shopify/shops';
import type { JobResultSummary } from './types';

/**
 * Atualiza o espelho local do catalogo (ShopProduct).
 * Usado pelo Passo 2 do wizard e pelo painel de saude, para nao chamar a
 * Admin API a cada render de tabela.
 */
export async function syncCatalog(shopId: string): Promise<JobResultSummary> {
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    return { processed: 0, succeeded: 0, failed: 0, messages: ['loja nao encontrada'] };
  }

  const ctx = await contextForShop(shop.shopDomain);
  const products = await listAllProducts(ctx);

  const seen = new Set<string>();

  for (const product of products) {
    seen.add(product.shopifyProductId);
    await prisma.shopProduct.upsert({
      where: {
        shopId_shopifyProductId: {
          shopId,
          shopifyProductId: product.shopifyProductId,
        },
      },
      create: {
        shopId,
        shopifyProductId: product.shopifyProductId,
        title: product.title,
        handle: product.handle,
        status: product.status,
        sku: product.sku,
        basePrice: product.basePrice ?? undefined,
        imageUrl: product.imageUrl,
        hasRegionOption: product.hasRegionOption,
        syncedAt: new Date(),
      },
      update: {
        title: product.title,
        handle: product.handle,
        status: product.status,
        sku: product.sku,
        basePrice: product.basePrice ?? undefined,
        imageUrl: product.imageUrl,
        hasRegionOption: product.hasRegionOption,
        syncedAt: new Date(),
      },
    });
  }

  // Produtos que sumiram da Shopify saem do espelho (e do denominador).
  const stale = await prisma.shopProduct.findMany({
    where: { shopId, shopifyProductId: { notIn: [...seen] } },
    select: { shopifyProductId: true },
  });

  if (stale.length > 0) {
    await prisma.shopProduct.deleteMany({
      where: { shopId, shopifyProductId: { in: stale.map((s) => s.shopifyProductId) } },
    });
  }

  logger.info({ shopId, total: products.length, removed: stale.length }, 'catalogo sincronizado');

  return {
    processed: products.length,
    succeeded: products.length,
    failed: 0,
    messages: stale.length ? [`${stale.length} produto(s) removido(s) do espelho`] : [],
  };
}
