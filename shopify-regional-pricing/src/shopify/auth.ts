import crypto from 'node:crypto';
import { getConfig } from '../config';
import { logger } from '../logger';
import { isValidShopDomain, verifyOAuthHmac } from './crypto';

export const OAUTH_STATE_COOKIE = 'rp_oauth_state';

export interface TokenResponse {
  access_token: string;
  scope: string;
}

/**
 * OAuth do app custom implementado direto sobre o Fastify.
 *
 * O SDK oficial de sessao (@shopify/shopify-app-express) e acoplado ao Express;
 * como o escopo pede Fastify, o fluxo abaixo faz o mesmo trabalho: HMAC da
 * query, state anti-CSRF em cookie assinado e troca do code pelo token.
 */

export function newState(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Valida o dominio recebido e, quando SHOPIFY_SHOP_DOMAIN esta configurado,
 * garante que a instalacao seja apenas naquela loja (app custom de loja unica).
 */
export function assertInstallableShop(shop: unknown): string {
  if (!isValidShopDomain(shop)) {
    throw new Error('Dominio de loja invalido');
  }

  const allowed = getConfig().SHOPIFY_SHOP_DOMAIN?.trim();
  if (allowed && shop !== allowed) {
    throw new Error(`Este app so pode ser instalado em ${allowed}`);
  }

  return shop;
}

export function buildAuthorizeUrl(shop: string, state: string): string {
  const config = getConfig();
  const params = new URLSearchParams({
    client_id: config.SHOPIFY_API_KEY,
    scope: config.scopeList.join(','),
    redirect_uri: `${config.SHOPIFY_APP_URL}/auth/callback`,
    state,
  });

  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

export function verifyCallbackHmac(query: Record<string, unknown>): boolean {
  return verifyOAuthHmac(query, getConfig().SHOPIFY_API_SECRET);
}

export async function exchangeCodeForToken(shop: string, code: string): Promise<TokenResponse> {
  const config = getConfig();

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: config.SHOPIFY_API_KEY,
      client_secret: config.SHOPIFY_API_SECRET,
      code,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error({ shop, status: response.status, body }, 'troca de code por token falhou');
    throw new Error(`Shopify recusou a troca do code (${response.status})`);
  }

  const json = (await response.json()) as Partial<TokenResponse>;
  if (!json.access_token) {
    throw new Error('Resposta do OAuth veio sem access_token');
  }

  return { access_token: json.access_token, scope: json.scope ?? '' };
}

/** Escopos concedidos batem com os exigidos? Se nao, e preciso reinstalar. */
export function scopesAreSufficient(granted: string | null | undefined): boolean {
  const required = getConfig().scopeList;
  const grantedList = (granted ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return required.every((scope) => grantedList.includes(scope));
}

/** URL do app dentro do admin da loja, para onde redirecionamos apos instalar. */
export function embeddedAppUrl(shop: string): string {
  const config = getConfig();
  const handle = shop.replace('.myshopify.com', '');
  return `https://admin.shopify.com/store/${handle}/apps/${config.SHOPIFY_API_KEY}`;
}
