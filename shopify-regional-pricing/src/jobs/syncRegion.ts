import type { Region, RegionPrice } from '@prisma/client';
import { getConfig } from '../config';
import { prisma } from '../db/client';
import { logger } from '../logger';
import {
  assertNoUserErrors,
  shopifyGraphQL,
  ShopifyUserError,
  type GraphQLContext,
} from '../shopify/graphql';
import {
  addRegionOptionValues,
  createRegionOption,
  createRegionVariants,
  findRegionOption,
  findRegionVariant,
  getProduct,
  updateVariantPrices,
  REGION_OPTION_NAME,
  type ShopifyProduct,
  type ShopifyVariant,
} from '../shopify/products';
import { attachSellingPlansToVariants } from '../shopify/sellingPlans';
import { contextForShop } from '../shopify/shops';
import { invalidateRegionPriceCache } from '../storefront/priceCache';
import { runWithConcurrency } from './pool';
import type { JobResultSummary } from './types';

interface SyncOptions {
  /** Nome anterior da regiao, quando ela foi renomeada. */
  previousName?: string;
  onProgress?: (done: number, total: number) => void | Promise<void>;
}

/**
 * Sincroniza uma regiao inteira: garante a option "Região" em cada produto
 * precificado, cria/atualiza a variante daquela regiao e grava o
 * shopifyVariantId no banco. Erro em um produto NAO derruba os demais:
 * fica registrado em RegionPrice.syncError e o job termina com o resumo.
 */
export async function syncRegionToShopify(
  regionId: string,
  options: SyncOptions = {},
): Promise<JobResultSummary> {
  const region = await prisma.region.findUnique({
    where: { id: regionId },
    include: { shop: true, prices: { orderBy: { shopifyProductId: 'asc' } } },
  });

  if (!region) {
    return { processed: 0, succeeded: 0, failed: 0, messages: [`regiao ${regionId} nao existe`] };
  }

  const ctx = await contextForShop(region.shop.shopDomain);
  const settings = await prisma.settings.findUnique({ where: { shopId: region.shopId } });
  const attachPlans = settings?.attachSellingPlans ?? true;

  // Renomeacao: o valor da option nos produtos precisa acompanhar o novo nome,
  // senao as variantes existentes viram orfas.
  if (options.previousName && options.previousName !== region.name) {
    await renameRegionValue(ctx, region, options.previousName);
  }

  const prices = region.prices;
  const total = prices.length;
  let done = 0;
  let succeeded = 0;
  let failed = 0;
  const messages: string[] = [];

  await runWithConcurrency(prices, getConfig().SYNC_CONCURRENCY, async (price) => {
    try {
      await syncSingleProduct(ctx, region, price, attachPlans);
      succeeded += 1;
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      messages.push(`${price.shopifyProductId}: ${message}`);
      logger.error(
        { regionId, productId: price.shopifyProductId, err: message },
        'falha ao sincronizar produto da regiao',
      );
      await prisma.regionPrice.update({
        where: { id: price.id },
        data: { syncStatus: 'error', syncError: message.slice(0, 1000) },
      });
    } finally {
      done += 1;
      if (options.onProgress) await options.onProgress(done, total);
    }
  });

  invalidateRegionPriceCache(region.shopId, region.id);

  logger.info({ regionId, total, succeeded, failed }, 'sync da regiao concluido');
  return { processed: total, succeeded, failed, messages: messages.slice(0, 50) };
}

/**
 * Um produto: garante option -> garante variante -> grava o id.
 */
async function syncSingleProduct(
  ctx: GraphQLContext,
  region: Region,
  price: RegionPrice,
  attachPlans: boolean,
): Promise<void> {
  const product = await getProduct(ctx, price.shopifyProductId);
  if (!product) {
    throw new Error('produto nao existe mais na Shopify');
  }

  const priceString = price.price.toFixed(2);
  const compareAt = price.compareAtPrice ? price.compareAtPrice.toFixed(2) : null;

  let variant = findRegionVariant(product, region.name);
  let createdNow = false;

  if (!variant) {
    const option = findRegionOption(product);

    if (!option) {
      // 3.2 - primeiro contato do produto com a precificacao regional.
      const result = await ensureRegionOption(ctx, product, region.name);
      variant = result.variants.find((v) =>
        v.selectedOptions.some((o) => o.name === REGION_OPTION_NAME && o.value === region.name),
      );

      if (!variant) {
        // O produto tinha mais de uma variante e a option nasceu vazia:
        // cria a variante explicitamente.
        const created = await createRegionVariants(ctx, product.id, [
          { regionName: region.name, price: priceString, compareAtPrice: compareAt },
        ]);
        variant = created[0];
        createdNow = true;
      }
    } else {
      const hasValue = option.optionValues.some((v) => v.name === region.name);
      if (!hasValue) {
        // 3.3 - a option ja existe, falta o valor desta regiao.
        await addRegionOptionValues(ctx, product.id, option.id, [region.name]);
      }

      // 3.4 - cria a variante da regiao.
      const created = await createRegionVariants(ctx, product.id, [
        { regionName: region.name, price: priceString, compareAtPrice: compareAt },
      ]);
      variant = created[0];
      createdNow = true;
    }
  }

  if (!variant) {
    throw new Error('nao foi possivel obter a variante da regiao apos a criacao');
  }

  // 3.5 - garante o preco correto (tambem cobre a variante recem-criada,
  // porque createRegionOption nao aceita preco).
  if (!createdNow || variant.price !== priceString) {
    await updateVariantPrices(ctx, product.id, [
      { id: variant.id, price: priceString, compareAtPrice: compareAt },
    ]);
  }

  if (attachPlans && createdNow) {
    try {
      await attachSellingPlansToVariants(ctx, product.id, [variant.id]);
    } catch (err) {
      // O Loop nao deve derrubar o sync de preco: registra e segue.
      logger.warn(
        { productId: product.id, variantId: variant.id, err: String(err) },
        'nao foi possivel associar selling plans a variante regional',
      );
    }
  }

  await prisma.regionPrice.update({
    where: { id: price.id },
    data: {
      shopifyVariantId: variant.id,
      syncStatus: 'synced',
      syncError: null,
      syncedAt: new Date(),
    },
  });
}

/**
 * productOptionsCreate com LEAVE_AS_IS aproveita a variante existente do
 * produto (o caso normal: produto sem variantes, so a "Default Title").
 * Se a Shopify recusar por causa da estrategia, refaz com MANAGE.
 */
async function ensureRegionOption(
  ctx: GraphQLContext,
  product: ShopifyProduct,
  regionName: string,
): Promise<{ variants: ShopifyVariant[] }> {
  try {
    const result = await createRegionOption(ctx, product.id, regionName);
    return { variants: result.variants };
  } catch (err) {
    if (err instanceof ShopifyUserError) {
      logger.warn(
        { productId: product.id, err: err.message },
        'productOptionsCreate recusado com LEAVE_AS_IS; relendo produto',
      );
      // Pode ser corrida com outro job que ja criou a option. Rele e segue.
      const fresh = await getProduct(ctx, product.id);
      if (fresh && findRegionOption(fresh)) {
        return { variants: fresh.variants };
      }
    }
    throw err;
  }
}

/**
 * Renomeia o valor da option "Região" em todos os produtos que ja tem variante
 * dessa regiao, preservando os ids das variantes (e portanto as assinaturas
 * do Loop vinculadas a elas).
 */
async function renameRegionValue(
  ctx: GraphQLContext,
  region: Region & { prices: RegionPrice[] },
  previousName: string,
): Promise<void> {
  const synced = region.prices.filter((p) => p.shopifyVariantId);

  await runWithConcurrency(synced, getConfig().SYNC_CONCURRENCY, async (price) => {
    try {
      const product = await getProduct(ctx, price.shopifyProductId);
      if (!product) return;

      const option = findRegionOption(product);
      if (!option) return;

      const value = option.optionValues.find((v) => v.name === previousName);
      if (!value) return;

      await renameOptionValue(ctx, product.id, option.id, value.id, region.name);
    } catch (err) {
      logger.error(
        { productId: price.shopifyProductId, previousName, newName: region.name, err: String(err) },
        'falha ao renomear o valor da option da regiao',
      );
    }
  });
}

const RENAME_OPTION_VALUE = /* GraphQL */ `
  mutation productOptionUpdateRename(
    $productId: ID!
    $option: OptionUpdateInput!
    $optionValuesToUpdate: [OptionValueUpdateInput!]
  ) {
    productOptionUpdate(
      productId: $productId
      option: $option
      optionValuesToUpdate: $optionValuesToUpdate
      variantStrategy: LEAVE_AS_IS
    ) {
      product {
        id
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

async function renameOptionValue(
  ctx: GraphQLContext,
  productId: string,
  optionId: string,
  optionValueId: string,
  newName: string,
): Promise<void> {
  const data = await shopifyGraphQL<{
    productOptionUpdate: { userErrors: Array<{ message: string }> } | null;
  }>(
    ctx,
    RENAME_OPTION_VALUE,
    {
      productId,
      option: { id: optionId },
      optionValuesToUpdate: [{ id: optionValueId, name: newName }],
    },
    { operationName: 'productOptionUpdateRename' },
  );

  assertNoUserErrors('productOptionUpdate (rename)', data.productOptionUpdate);
}
