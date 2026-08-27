import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getConfig } from '../config';
import { prisma } from '../db/client';
import { logger } from '../logger';
import { enqueueJob } from '../jobs/enqueue';
import {
  assertInstallableShop,
  buildAuthorizeUrl,
  embeddedAppUrl,
  exchangeCodeForToken,
  newState,
  OAUTH_STATE_COOKIE,
  scopesAreSufficient,
  verifyCallbackHmac,
} from './auth';
import { isValidShopDomain, signValue, unsignValue } from './crypto';
import { graphQLContext, upsertShop } from './shops';
import { registerWebhooks } from './webhooks';

interface AuthQuery {
  shop?: string;
  code?: string;
  state?: string;
  hmac?: string;
  host?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const config = getConfig();

  /** Inicio da instalacao: /auth?shop=loja.myshopify.com */
  app.get('/auth', async (request: FastifyRequest<{ Querystring: AuthQuery }>, reply: FastifyReply) => {
    let shop: string;
    try {
      shop = assertInstallableShop(request.query.shop);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }

    const state = newState();

    reply.setCookie(OAUTH_STATE_COOKIE, signValue(`${state}|${shop}`, config.SESSION_SECRET), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProduction,
      maxAge: 600,
      signed: false,
    });

    logger.info({ shop }, 'iniciando OAuth');
    return reply.redirect(buildAuthorizeUrl(shop, state));
  });

  /** Retorno do OAuth. */
  app.get(
    '/auth/callback',
    async (request: FastifyRequest<{ Querystring: AuthQuery }>, reply: FastifyReply) => {
      const query = request.query;

      if (!verifyCallbackHmac(query as Record<string, unknown>)) {
        logger.warn({ shop: query.shop }, 'callback do OAuth com HMAC invalido');
        return reply.code(401).send({ error: 'HMAC invalido' });
      }

      let shop: string;
      try {
        shop = assertInstallableShop(query.shop);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }

      const cookie = request.cookies[OAUTH_STATE_COOKIE];
      const unsigned = cookie ? unsignValue(cookie, config.SESSION_SECRET) : null;
      const [expectedState, cookieShop] = (unsigned ?? '').split('|');

      if (!unsigned || !expectedState || expectedState !== query.state || cookieShop !== shop) {
        logger.warn({ shop }, 'state do OAuth nao confere');
        return reply.code(403).send({ error: 'state invalido; reinicie a instalacao em /auth' });
      }

      reply.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });

      if (!query.code) {
        return reply.code(400).send({ error: 'code ausente' });
      }

      const token = await exchangeCodeForToken(shop, query.code);

      if (!scopesAreSufficient(token.scope)) {
        logger.warn({ shop, granted: token.scope }, 'escopos concedidos sao insuficientes');
        return reply
          .code(403)
          .send({ error: `Escopos insuficientes. O app precisa de: ${config.SHOPIFY_SCOPES}` });
      }

      const record = await upsertShop({
        shopDomain: shop,
        accessToken: token.access_token,
        scope: token.scope,
      });

      // Settings pode nao existir se a loja foi reinstalada.
      await prisma.settings.upsert({
        where: { shopId: record.id },
        create: { shopId: record.id },
        update: {},
      });

      try {
        await registerWebhooks(graphQLContext(record));
      } catch (err) {
        // Instalacao nao deve falhar por causa disso; ha um retry manual no admin.
        logger.error({ shop, err: String(err) }, 'falha ao registrar webhooks na instalacao');
      }

      // Popula o espelho do catalogo para o wizard ja abrir com produtos.
      await enqueueJob({ shopId: record.id, type: 'catalog_sync', payload: {} });

      logger.info({ shop }, 'app instalado');
      return reply.redirect(embeddedAppUrl(shop));
    },
  );

  /**
   * Reinstala/renova os webhooks manualmente (util quando o dominio do app muda).
   * Protegido pelo mesmo HMAC do OAuth para nao virar um endpoint aberto.
   */
  app.get(
    '/auth/webhooks/register',
    async (request: FastifyRequest<{ Querystring: AuthQuery }>, reply: FastifyReply) => {
      if (!verifyCallbackHmac(request.query as Record<string, unknown>)) {
        return reply.code(401).send({ error: 'HMAC invalido' });
      }
      if (!isValidShopDomain(request.query.shop)) {
        return reply.code(400).send({ error: 'shop invalido' });
      }

      const shop = await prisma.shop.findUnique({ where: { shopDomain: request.query.shop } });
      if (!shop || !shop.isActive) {
        return reply.code(404).send({ error: 'loja nao instalada' });
      }

      const result = await registerWebhooks(graphQLContext(shop));
      return reply.send(result);
    },
  );
}
