import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Shop } from '@prisma/client';
import { getConfig } from '../config';
import { logger } from '../logger';
import {
  isValidShopDomain,
  SessionTokenError,
  shopFromDest,
  verifySessionToken,
} from '../shopify/crypto';
import { requireActiveShop } from '../shopify/shops';

declare module 'fastify' {
  interface FastifyRequest {
    shop?: Shop;
  }
}

export class UnauthorizedError extends Error {}

/**
 * Extrai a loja autenticada da requisicao do admin.
 *
 * Producao: exige o session token (JWT HS256) que o App Bridge envia no
 * header Authorization. Dev: com ALLOW_DEV_AUTH=true aceita o header
 * x-dev-shop, para conseguir testar a API sem o iframe do admin.
 */
export async function resolveShopFromRequest(request: FastifyRequest): Promise<Shop> {
  const config = getConfig();

  const header = request.headers.authorization;
  const bearer = typeof header === 'string' && header.startsWith('Bearer ')
    ? header.slice('Bearer '.length).trim()
    : null;

  if (bearer) {
    let payload;
    try {
      payload = verifySessionToken(bearer, config.SHOPIFY_API_KEY, config.SHOPIFY_API_SECRET);
    } catch (err) {
      if (err instanceof SessionTokenError) {
        throw new UnauthorizedError(`session token invalido: ${err.message}`);
      }
      throw err;
    }

    const shopDomain = shopFromDest(payload.dest);
    if (!shopDomain) throw new UnauthorizedError('dest do session token nao e uma loja valida');

    return requireActiveShop(shopDomain);
  }

  if (config.ALLOW_DEV_AUTH) {
    const devShop = request.headers['x-dev-shop'];
    const shopDomain = Array.isArray(devShop) ? devShop[0] : devShop;
    if (isValidShopDomain(shopDomain)) {
      logger.warn({ shop: shopDomain }, 'usando autenticacao de desenvolvimento (x-dev-shop)');
      return requireActiveShop(shopDomain);
    }
  }

  throw new UnauthorizedError('Authorization: Bearer <session token> ausente');
}

/** Hook onRequest para as rotas /api/*. */
export async function requireShop(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    request.shop = await resolveShopFromRequest(request);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return reply.code(401).send({ error: err.message });
    }
    logger.error({ err: String(err) }, 'falha ao resolver a loja da requisicao');
    return reply.code(401).send({ error: 'nao autenticado' });
  }
}

/** Uso dentro dos handlers, ja garantido pelo hook acima. */
export function shopOf(request: FastifyRequest): Shop {
  if (!request.shop) throw new UnauthorizedError('loja nao resolvida');
  return request.shop;
}
