import { assertNoUserErrors, shopifyGraphQL, type GraphQLContext, type GraphQLUserError } from './graphql';

/**
 * Integracao com Loop Commerce (Etapa 8).
 *
 * O Loop opera sobre selling plan groups nativos da Shopify. Quando um produto
 * ganha variantes novas (uma por regiao), o comportamento observado varia:
 * grupos associados ao PRODUTO cobrem todas as variantes automaticamente,
 * mas grupos associados a VARIANTES especificas nao. Este modulo cobre o
 * segundo caso: associa cada selling plan group do produto as variantes
 * regionais recem-criadas.
 *
 * O sync chama isso quando Settings.attachSellingPlans esta ligado.
 */

const PRODUCT_SELLING_PLAN_GROUPS = /* GraphQL */ `
  query productSellingPlanGroups($id: ID!) {
    product(id: $id) {
      id
      sellingPlanGroups(first: 50) {
        nodes {
          id
          name
          appId
          sellingPlans(first: 1) {
            nodes {
              id
            }
          }
        }
      }
    }
  }
`;

interface SellingPlanGroupsResponse {
  product: {
    id: string;
    sellingPlanGroups: {
      nodes: Array<{
        id: string;
        name: string;
        appId: string | null;
        sellingPlans: { nodes: Array<{ id: string }> };
      }>;
    };
  } | null;
}

export interface SellingPlanGroupSummary {
  id: string;
  name: string;
  appId: string | null;
}

export async function getProductSellingPlanGroups(
  ctx: GraphQLContext,
  productId: string,
): Promise<SellingPlanGroupSummary[]> {
  const data = await shopifyGraphQL<SellingPlanGroupsResponse>(
    ctx,
    PRODUCT_SELLING_PLAN_GROUPS,
    { id: productId },
    { operationName: 'productSellingPlanGroups' },
  );

  return (data.product?.sellingPlanGroups.nodes ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    appId: g.appId,
  }));
}

const ADD_PRODUCT_VARIANTS = /* GraphQL */ `
  mutation sellingPlanGroupAddProductVariants($id: ID!, $productVariantIds: [ID!]!) {
    sellingPlanGroupAddProductVariants(id: $id, productVariantIds: $productVariantIds) {
      sellingPlanGroup {
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

interface AddVariantsResponse {
  sellingPlanGroupAddProductVariants: {
    sellingPlanGroup: { id: string } | null;
    userErrors: GraphQLUserError[];
  } | null;
}

export async function addVariantsToSellingPlanGroup(
  ctx: GraphQLContext,
  sellingPlanGroupId: string,
  variantIds: string[],
): Promise<void> {
  if (variantIds.length === 0) return;

  const data = await shopifyGraphQL<AddVariantsResponse>(
    ctx,
    ADD_PRODUCT_VARIANTS,
    { id: sellingPlanGroupId, productVariantIds: variantIds },
    { operationName: 'sellingPlanGroupAddProductVariants' },
  );

  assertNoUserErrors('sellingPlanGroupAddProductVariants', data.sellingPlanGroupAddProductVariants);
}

/**
 * Garante que as variantes regionais participem dos mesmos selling plan groups
 * do produto. Idempotente: reassociar uma variante ja associada e no-op na API.
 */
export async function attachSellingPlansToVariants(
  ctx: GraphQLContext,
  productId: string,
  variantIds: string[],
): Promise<{ groups: number; variants: number }> {
  if (variantIds.length === 0) return { groups: 0, variants: 0 };

  const groups = await getProductSellingPlanGroups(ctx, productId);
  for (const group of groups) {
    await addVariantsToSellingPlanGroup(ctx, group.id, variantIds);
  }

  return { groups: groups.length, variants: variantIds.length };
}
