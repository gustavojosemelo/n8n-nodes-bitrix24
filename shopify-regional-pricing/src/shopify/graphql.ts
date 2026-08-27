import { getConfig } from '../config';
import { logger } from '../logger';

export interface ThrottleStatus {
  maximumAvailable: number;
  currentlyAvailable: number;
  restoreRate: number;
}

export interface GraphQLCost {
  requestedQueryCost: number;
  actualQueryCost?: number;
  throttleStatus?: ThrottleStatus;
}

export interface GraphQLUserError {
  field?: string[] | null;
  message: string;
  code?: string | null;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
  extensions?: { cost?: GraphQLCost };
}

export class ShopifyGraphQLError extends Error {
  constructor(
    message: string,
    readonly details: {
      status?: number;
      errors?: unknown;
      query?: string;
      variables?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'ShopifyGraphQLError';
  }
}

/** Erro de negocio devolvido em `userErrors` — nao adianta repetir a chamada. */
export class ShopifyUserError extends Error {
  constructor(
    readonly operation: string,
    readonly userErrors: GraphQLUserError[],
  ) {
    super(
      `${operation}: ${userErrors
        .map((e) => `${(e.field ?? []).join('.') || 'geral'}: ${e.message}`)
        .join(' | ')}`,
    );
    this.name = 'ShopifyUserError';
  }
}

export interface GraphQLContext {
  shopDomain: string;
  accessToken: string;
}

const MAX_ATTEMPTS = 6;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(ms: number): number {
  return Math.round(ms * (0.75 + Math.random() * 0.5));
}

/**
 * Espera necessaria para recuperar `needed` pontos do bucket de custo.
 * A Admin API repoe `restoreRate` pontos por segundo.
 */
function throttleDelayMs(cost: GraphQLCost | undefined): number {
  const status = cost?.throttleStatus;
  if (!status || !status.restoreRate) return BASE_DELAY_MS;

  const needed = (cost?.requestedQueryCost ?? 0) - status.currentlyAvailable;
  if (needed <= 0) return BASE_DELAY_MS;

  return Math.min(Math.ceil((needed / status.restoreRate) * 1000) + 250, MAX_DELAY_MS);
}

function isThrottled(body: GraphQLResponse<unknown>): boolean {
  return (body.errors ?? []).some((e) => e.extensions?.code === 'THROTTLED');
}

/**
 * Executa uma operacao GraphQL na Admin API.
 *
 * Trata: 429 (Retry-After), 5xx, falha de rede e THROTTLED com backoff
 * exponencial. Toda chamada e logada em JSON com o custo, para a
 * observabilidade da Etapa 10.5.
 */
export async function shopifyGraphQL<T>(
  ctx: GraphQLContext,
  query: string,
  variables: Record<string, unknown> = {},
  options: { operationName?: string; maxAttempts?: number } = {},
): Promise<T> {
  const config = getConfig();
  const url = `https://${ctx.shopDomain}/admin/api/${config.SHOPIFY_API_VERSION}/graphql.json`;
  const operation = options.operationName ?? inferOperationName(query);
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = Date.now();

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': ctx.accessToken,
        },
        body: JSON.stringify({ query, variables }),
      });
    } catch (err) {
      lastError = err as Error;
      logger.warn(
        { shop: ctx.shopDomain, operation, attempt, err: String(err) },
        'falha de rede na Admin API, repetindo',
      );
      await sleep(jitter(Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS)));
      continue;
    }

    const durationMs = Date.now() - startedAt;

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('Retry-After') ?? '2');
      const delay = jitter(Math.min(retryAfter * 1000, MAX_DELAY_MS));
      logger.warn(
        { shop: ctx.shopDomain, operation, attempt, delay, durationMs },
        'HTTP 429 na Admin API, aguardando Retry-After',
      );
      lastError = new ShopifyGraphQLError('rate limit HTTP 429', { status: 429 });
      await sleep(delay);
      continue;
    }

    if (response.status >= 500) {
      lastError = new ShopifyGraphQLError(`Admin API respondeu ${response.status}`, {
        status: response.status,
      });
      const delay = jitter(Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS));
      logger.warn(
        { shop: ctx.shopDomain, operation, attempt, status: response.status, delay },
        'erro 5xx na Admin API, repetindo',
      );
      await sleep(delay);
      continue;
    }

    if (response.status === 401 || response.status === 403) {
      // Token revogado ou escopo insuficiente: repetir nao resolve.
      const text = await response.text();
      throw new ShopifyGraphQLError(
        `Admin API negou a chamada (${response.status}). Token invalido ou escopo faltando.`,
        { status: response.status, errors: text },
      );
    }

    if (!response.ok) {
      const text = await response.text();
      throw new ShopifyGraphQLError(`Admin API respondeu ${response.status}`, {
        status: response.status,
        errors: text,
      });
    }

    const body = (await response.json()) as GraphQLResponse<T>;
    const cost = body.extensions?.cost;

    logger.info(
      {
        shop: ctx.shopDomain,
        operation,
        attempt,
        durationMs,
        requestedCost: cost?.requestedQueryCost,
        actualCost: cost?.actualQueryCost,
        available: cost?.throttleStatus?.currentlyAvailable,
        throttled: isThrottled(body),
      },
      'chamada admin api',
    );

    if (isThrottled(body)) {
      const delay = jitter(throttleDelayMs(cost));
      lastError = new ShopifyGraphQLError('THROTTLED', { errors: body.errors });
      logger.warn(
        { shop: ctx.shopDomain, operation, attempt, delay },
        'THROTTLED pela Admin API, aguardando reposicao do bucket',
      );
      await sleep(delay);
      continue;
    }

    if (body.errors?.length) {
      throw new ShopifyGraphQLError(
        body.errors.map((e) => e.message).join(' | '),
        { errors: body.errors, query, variables },
      );
    }

    if (!body.data) {
      throw new ShopifyGraphQLError('Admin API respondeu sem `data`', { query, variables });
    }

    return body.data;
  }

  throw new ShopifyGraphQLError(
    `Admin API falhou apos ${maxAttempts} tentativas: ${lastError?.message ?? 'motivo desconhecido'}`,
    { errors: lastError },
  );
}

/**
 * Toda mutation precisa checar userErrors antes de considerar sucesso.
 * Este helper centraliza isso para nao depender de disciplina caso a caso.
 */
export function assertNoUserErrors(
  operation: string,
  payload: { userErrors?: GraphQLUserError[] | null } | null | undefined,
): void {
  if (!payload) {
    throw new ShopifyUserError(operation, [{ message: 'mutation retornou payload nulo' }]);
  }
  const errors = payload.userErrors ?? [];
  if (errors.length > 0) {
    throw new ShopifyUserError(operation, errors);
  }
}

function inferOperationName(query: string): string {
  const match = /^\s*(?:query|mutation)\s+([A-Za-z0-9_]+)/.exec(query);
  return match?.[1] ?? 'anonymous';
}
