import { getConfig } from '../config';
import { logger } from '../logger';
import { assertNoUserErrors, shopifyGraphQL, type GraphQLContext, type GraphQLUserError } from './graphql';

/** Topics obrigatorios da Etapa 2. */
export const REQUIRED_TOPICS = [
  'APP_UNINSTALLED',
  'PRODUCTS_CREATE',
  'PRODUCTS_DELETE',
] as const;

export type WebhookTopic = (typeof REQUIRED_TOPICS)[number];

/** Topic do header (products/create) para o enum do GraphQL (PRODUCTS_CREATE). */
export function topicHeaderToEnum(header: string): string {
  return header.trim().toUpperCase().replace(/[\/.-]/g, '_');
}

const LIST_WEBHOOKS = /* GraphQL */ `
  query webhookSubscriptions {
    webhookSubscriptions(first: 100) {
      nodes {
        id
        topic
        endpoint {
          __typename
          ... on WebhookHttpEndpoint {
            callbackUrl
          }
        }
      }
    }
  }
`;

interface ListWebhooksResponse {
  webhookSubscriptions: {
    nodes: Array<{
      id: string;
      topic: string;
      endpoint: { __typename: string; callbackUrl?: string };
    }>;
  };
}

const CREATE_WEBHOOK = /* GraphQL */ `
  mutation webhookSubscriptionCreate(
    $topic: WebhookSubscriptionTopic!
    $webhookSubscription: WebhookSubscriptionInput!
  ) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
      webhookSubscription {
        id
        topic
      }
      userErrors {
        field
        message
      }
    }
  }
`;

interface CreateWebhookResponse {
  webhookSubscriptionCreate: {
    webhookSubscription: { id: string; topic: string } | null;
    userErrors: GraphQLUserError[];
  } | null;
}

const DELETE_WEBHOOK = /* GraphQL */ `
  mutation webhookSubscriptionDelete($id: ID!) {
    webhookSubscriptionDelete(id: $id) {
      deletedWebhookSubscriptionId
      userErrors {
        field
        message
      }
    }
  }
`;

interface DeleteWebhookResponse {
  webhookSubscriptionDelete: {
    deletedWebhookSubscriptionId: string | null;
    userErrors: GraphQLUserError[];
  } | null;
}

/**
 * Registra os webhooks obrigatorios, de forma idempotente:
 * - ja registrado na URL certa -> nao mexe
 * - registrado numa URL antiga (dominio mudou) -> remove e recria
 */
export async function registerWebhooks(ctx: GraphQLContext): Promise<{
  created: string[];
  kept: string[];
  replaced: string[];
}> {
  const callbackBase = `${getConfig().SHOPIFY_APP_URL}/webhooks`;

  const existing = await shopifyGraphQL<ListWebhooksResponse>(ctx, LIST_WEBHOOKS, {}, {
    operationName: 'webhookSubscriptions',
  });

  const created: string[] = [];
  const kept: string[] = [];
  const replaced: string[] = [];

  for (const topic of REQUIRED_TOPICS) {
    const callbackUrl = `${callbackBase}/${topic.toLowerCase()}`;
    const current = existing.webhookSubscriptions.nodes.filter((n) => n.topic === topic);
    const match = current.find((n) => n.endpoint.callbackUrl === callbackUrl);

    if (match) {
      kept.push(topic);
      continue;
    }

    // Assinaturas do mesmo topic apontando para outro lugar sao nossas e ficaram obsoletas.
    for (const stale of current) {
      if (stale.endpoint.callbackUrl?.startsWith(getConfig().SHOPIFY_APP_URL)) {
        const del = await shopifyGraphQL<DeleteWebhookResponse>(
          ctx,
          DELETE_WEBHOOK,
          { id: stale.id },
          { operationName: 'webhookSubscriptionDelete' },
        );
        assertNoUserErrors('webhookSubscriptionDelete', del.webhookSubscriptionDelete);
        replaced.push(topic);
      }
    }

    const result = await shopifyGraphQL<CreateWebhookResponse>(
      ctx,
      CREATE_WEBHOOK,
      { topic, webhookSubscription: { callbackUrl, format: 'JSON' } },
      { operationName: 'webhookSubscriptionCreate' },
    );
    assertNoUserErrors('webhookSubscriptionCreate', result.webhookSubscriptionCreate);
    created.push(topic);
  }

  logger.info({ shop: ctx.shopDomain, created, kept, replaced }, 'webhooks registrados');
  return { created, kept, replaced };
}
