import {
  assertNoUserErrors,
  shopifyGraphQL,
  type GraphQLContext,
  type GraphQLUserError,
} from './graphql';

/** Nome da option usada para carregar o preco regional. Nao mudar apos o go-live. */
export const REGION_OPTION_NAME = 'Região';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface ShopifyOptionValue {
  id: string;
  name: string;
}

export interface ShopifyOption {
  id: string;
  name: string;
  position?: number;
  optionValues: ShopifyOptionValue[];
}

export interface ShopifyVariant {
  id: string;
  title: string;
  sku?: string | null;
  price: string;
  compareAtPrice?: string | null;
  selectedOptions: Array<{ name: string; value: string }>;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  handle?: string | null;
  status?: string | null;
  featuredImageUrl?: string | null;
  options: ShopifyOption[];
  variants: ShopifyVariant[];
}

export interface VariantPriceInput {
  regionName: string;
  price: string;
  compareAtPrice?: string | null;
}

// ---------------------------------------------------------------------------
// 3.1 - Ler o produto (options + variantes)
// ---------------------------------------------------------------------------

const GET_PRODUCT = /* GraphQL */ `
  query getProduct($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      status
      featuredImage {
        url
      }
      options {
        id
        name
        position
        optionValues {
          id
          name
        }
      }
      variants(first: 250) {
        nodes {
          id
          title
          sku
          price
          compareAtPrice
          selectedOptions {
            name
            value
          }
        }
      }
    }
  }
`;

interface GetProductResponse {
  product: {
    id: string;
    title: string;
    handle: string | null;
    status: string | null;
    featuredImage: { url: string } | null;
    options: ShopifyOption[];
    variants: { nodes: ShopifyVariant[] };
  } | null;
}

export async function getProduct(
  ctx: GraphQLContext,
  productId: string,
): Promise<ShopifyProduct | null> {
  const data = await shopifyGraphQL<GetProductResponse>(ctx, GET_PRODUCT, { id: productId });
  const product = data.product;
  if (!product) return null;

  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    status: product.status,
    featuredImageUrl: product.featuredImage?.url ?? null,
    options: product.options,
    variants: product.variants.nodes,
  };
}

export function findRegionOption(product: ShopifyProduct): ShopifyOption | undefined {
  return product.options.find((o) => o.name === REGION_OPTION_NAME);
}

export function findRegionVariant(
  product: ShopifyProduct,
  regionName: string,
): ShopifyVariant | undefined {
  return product.variants.find((v) =>
    v.selectedOptions.some((o) => o.name === REGION_OPTION_NAME && o.value === regionName),
  );
}

// ---------------------------------------------------------------------------
// 3.2 - Criar a option "Região" num produto que ainda nao tem
// ---------------------------------------------------------------------------

const PRODUCT_OPTIONS_CREATE = /* GraphQL */ `
  mutation productOptionsCreate(
    $productId: ID!
    $options: [OptionCreateInput!]!
    $variantStrategy: ProductOptionCreateVariantStrategy
  ) {
    productOptionsCreate(
      productId: $productId
      options: $options
      variantStrategy: $variantStrategy
    ) {
      product {
        id
        options {
          id
          name
          optionValues {
            id
            name
          }
        }
        variants(first: 250) {
          nodes {
            id
            title
            price
            selectedOptions {
              name
              value
            }
          }
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

interface OptionsCreateResponse {
  productOptionsCreate: {
    product: {
      id: string;
      options: ShopifyOption[];
      variants: { nodes: ShopifyVariant[] };
    } | null;
    userErrors: GraphQLUserError[];
  } | null;
}

/**
 * Cria a option "Região" com um primeiro valor.
 *
 * variantStrategy LEAVE_AS_IS mantem a variante existente do produto e apenas
 * atribui a ela esse primeiro valor de option. E o que queremos: a variante
 * base do produto passa a ser a variante da primeira regiao sincronizada
 * (idealmente a regiao padrao, ver Etapa 6 / mitigacao de risco de JS off).
 */
export async function createRegionOption(
  ctx: GraphQLContext,
  productId: string,
  firstRegionName: string,
): Promise<{ options: ShopifyOption[]; variants: ShopifyVariant[] }> {
  const data = await shopifyGraphQL<OptionsCreateResponse>(
    ctx,
    PRODUCT_OPTIONS_CREATE,
    {
      productId,
      options: [{ name: REGION_OPTION_NAME, values: [{ name: firstRegionName }] }],
      variantStrategy: 'LEAVE_AS_IS',
    },
    { operationName: 'productOptionsCreate' },
  );

  assertNoUserErrors('productOptionsCreate', data.productOptionsCreate);

  const product = data.productOptionsCreate!.product!;
  return { options: product.options, variants: product.variants.nodes };
}

// ---------------------------------------------------------------------------
// 3.3 - Adicionar novos valores a option "Região"
// ---------------------------------------------------------------------------

const PRODUCT_OPTION_UPDATE = /* GraphQL */ `
  mutation productOptionUpdate(
    $productId: ID!
    $option: OptionUpdateInput!
    $optionValuesToAdd: [OptionValueCreateInput!]
    $optionValuesToDelete: [ID!]
    $variantStrategy: ProductOptionUpdateVariantStrategy
  ) {
    productOptionUpdate(
      productId: $productId
      option: $option
      optionValuesToAdd: $optionValuesToAdd
      optionValuesToDelete: $optionValuesToDelete
      variantStrategy: $variantStrategy
    ) {
      product {
        id
        options {
          id
          name
          optionValues {
            id
            name
          }
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

interface OptionUpdateResponse {
  productOptionUpdate: {
    product: { id: string; options: ShopifyOption[] } | null;
    userErrors: GraphQLUserError[];
  } | null;
}

/** Acrescenta valores a option "Região" sem gerar variantes (isso e feito em 3.4). */
export async function addRegionOptionValues(
  ctx: GraphQLContext,
  productId: string,
  optionId: string,
  regionNames: string[],
): Promise<ShopifyOption[]> {
  const data = await shopifyGraphQL<OptionUpdateResponse>(
    ctx,
    PRODUCT_OPTION_UPDATE,
    {
      productId,
      option: { id: optionId },
      optionValuesToAdd: regionNames.map((name) => ({ name })),
      variantStrategy: 'LEAVE_AS_IS',
    },
    { operationName: 'productOptionUpdate' },
  );

  assertNoUserErrors('productOptionUpdate', data.productOptionUpdate);
  return data.productOptionUpdate!.product!.options;
}

/** Renomeia a option ou remove valores (usado ao renomear/excluir uma regiao). */
export async function updateRegionOption(
  ctx: GraphQLContext,
  productId: string,
  option: { id: string; name?: string },
  optionValuesToDelete?: string[],
): Promise<void> {
  const data = await shopifyGraphQL<OptionUpdateResponse>(
    ctx,
    PRODUCT_OPTION_UPDATE,
    {
      productId,
      option,
      ...(optionValuesToDelete?.length ? { optionValuesToDelete } : {}),
      variantStrategy: 'LEAVE_AS_IS',
    },
    { operationName: 'productOptionUpdate' },
  );

  assertNoUserErrors('productOptionUpdate', data.productOptionUpdate);
}

// ---------------------------------------------------------------------------
// 3.4 - Criar variantes em lote
// ---------------------------------------------------------------------------

const VARIANTS_BULK_CREATE = /* GraphQL */ `
  mutation productVariantsBulkCreate(
    $productId: ID!
    $variants: [ProductVariantsBulkInput!]!
  ) {
    productVariantsBulkCreate(productId: $productId, variants: $variants) {
      productVariants {
        id
        title
        price
        compareAtPrice
        selectedOptions {
          name
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

interface VariantsBulkCreateResponse {
  productVariantsBulkCreate: {
    productVariants: ShopifyVariant[] | null;
    userErrors: GraphQLUserError[];
  } | null;
}

export async function createRegionVariants(
  ctx: GraphQLContext,
  productId: string,
  variants: VariantPriceInput[],
): Promise<ShopifyVariant[]> {
  if (variants.length === 0) return [];

  const data = await shopifyGraphQL<VariantsBulkCreateResponse>(
    ctx,
    VARIANTS_BULK_CREATE,
    {
      productId,
      variants: variants.map((v) => ({
        price: v.price,
        ...(v.compareAtPrice ? { compareAtPrice: v.compareAtPrice } : {}),
        optionValues: [{ optionName: REGION_OPTION_NAME, name: v.regionName }],
      })),
    },
    { operationName: 'productVariantsBulkCreate' },
  );

  assertNoUserErrors('productVariantsBulkCreate', data.productVariantsBulkCreate);
  return data.productVariantsBulkCreate!.productVariants ?? [];
}

// ---------------------------------------------------------------------------
// 3.5 - Atualizar precos em lote
// ---------------------------------------------------------------------------

const VARIANTS_BULK_UPDATE = /* GraphQL */ `
  mutation productVariantsBulkUpdate(
    $productId: ID!
    $variants: [ProductVariantsBulkInput!]!
  ) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants {
        id
        price
        compareAtPrice
      }
      userErrors {
        field
        message
      }
    }
  }
`;

interface VariantsBulkUpdateResponse {
  productVariantsBulkUpdate: {
    productVariants: ShopifyVariant[] | null;
    userErrors: GraphQLUserError[];
  } | null;
}

export async function updateVariantPrices(
  ctx: GraphQLContext,
  productId: string,
  variants: Array<{ id: string; price: string; compareAtPrice?: string | null }>,
): Promise<ShopifyVariant[]> {
  if (variants.length === 0) return [];

  const data = await shopifyGraphQL<VariantsBulkUpdateResponse>(
    ctx,
    VARIANTS_BULK_UPDATE,
    {
      productId,
      variants: variants.map((v) => ({
        id: v.id,
        price: v.price,
        // null limpa o compareAtPrice; undefined deixaria o valor antigo.
        compareAtPrice: v.compareAtPrice ?? null,
      })),
    },
    { operationName: 'productVariantsBulkUpdate' },
  );

  assertNoUserErrors('productVariantsBulkUpdate', data.productVariantsBulkUpdate);
  return data.productVariantsBulkUpdate!.productVariants ?? [];
}

// ---------------------------------------------------------------------------
// 3.6 - Remover variantes (regiao excluida)
// ---------------------------------------------------------------------------

const VARIANTS_BULK_DELETE = /* GraphQL */ `
  mutation productVariantsBulkDelete($productId: ID!, $variantsIds: [ID!]!) {
    productVariantsBulkDelete(productId: $productId, variantsIds: $variantsIds) {
      product {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

interface VariantsBulkDeleteResponse {
  productVariantsBulkDelete: {
    product: { id: string } | null;
    userErrors: GraphQLUserError[];
  } | null;
}

export async function deleteVariants(
  ctx: GraphQLContext,
  productId: string,
  variantIds: string[],
): Promise<void> {
  if (variantIds.length === 0) return;

  const data = await shopifyGraphQL<VariantsBulkDeleteResponse>(
    ctx,
    VARIANTS_BULK_DELETE,
    { productId, variantsIds: variantIds },
    { operationName: 'productVariantsBulkDelete' },
  );

  assertNoUserErrors('productVariantsBulkDelete', data.productVariantsBulkDelete);
}

// ---------------------------------------------------------------------------
// Catalogo (Passo 2 do wizard e painel de saude)
// ---------------------------------------------------------------------------

const LIST_PRODUCTS = /* GraphQL */ `
  query listProducts($cursor: String) {
    products(first: 100, after: $cursor, sortKey: TITLE) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        handle
        status
        featuredImage {
          url
        }
        options {
          id
          name
          optionValues {
            id
            name
          }
        }
        variants(first: 1) {
          nodes {
            id
            sku
            price
          }
        }
      }
    }
  }
`;

interface ListProductsResponse {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: Array<{
      id: string;
      title: string;
      handle: string | null;
      status: string | null;
      featuredImage: { url: string } | null;
      options: ShopifyOption[];
      variants: { nodes: Array<{ id: string; sku: string | null; price: string }> };
    }>;
  };
}

export interface CatalogProduct {
  shopifyProductId: string;
  title: string;
  handle: string | null;
  status: string;
  sku: string | null;
  basePrice: string | null;
  imageUrl: string | null;
  hasRegionOption: boolean;
}

/** Percorre todo o catalogo paginando (100 por pagina). */
export async function listAllProducts(ctx: GraphQLContext): Promise<CatalogProduct[]> {
  const products: CatalogProduct[] = [];
  let cursor: string | null = null;

  // Guarda de seguranca: 200 paginas = 20k produtos.
  for (let page = 0; page < 200; page += 1) {
    const data: ListProductsResponse = await shopifyGraphQL<ListProductsResponse>(
      ctx,
      LIST_PRODUCTS,
      { cursor },
      { operationName: 'listProducts' },
    );

    for (const node of data.products.nodes) {
      const first = node.variants.nodes[0];
      products.push({
        shopifyProductId: node.id,
        title: node.title,
        handle: node.handle,
        status: node.status ?? 'ACTIVE',
        sku: first?.sku ?? null,
        basePrice: first?.price ?? null,
        imageUrl: node.featuredImage?.url ?? null,
        hasRegionOption: node.options.some((o) => o.name === REGION_OPTION_NAME),
      });
    }

    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
    if (!cursor) break;
  }

  return products;
}

/** Converte "gid://shopify/ProductVariant/999" em "999" (o storefront usa o numerico). */
export function gidToNumericId(gid: string | null | undefined): string | null {
  if (!gid) return null;
  const match = /\/(\d+)(?:\?.*)?$/.exec(gid);
  return match?.[1] ?? null;
}

export function numericToProductGid(id: string | number): string {
  return `gid://shopify/Product/${id}`;
}

export function numericToVariantGid(id: string | number): string {
  return `gid://shopify/ProductVariant/${id}`;
}
