import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getConfig } from '../config';
import { prisma } from '../db/client';
import { logger } from '../logger';
import { cleanupDeletedProduct } from '../jobs/backfill';
import { enqueueJob } from '../jobs/enqueue';
import { invalidateRegionPriceCache, invalidateRegionsCache } from '../storefront/priceCache';
import { verifyWebhookHmac } from './crypto';
import { numericToProductGid } from './products';
import { markUninstalled } from './shops';

interface RawBodyRequest extends FastifyRequest {
  rawBody?: Buffer;
}

/**
 * Toda rota sob /webhooks passa por esta verificacao.
 * O HMAC e calculado sobre o corpo CRU: reserializar o JSON quebra a
 * assinatura (ordem de chaves, escapes, espacos).
 */
async function verify(request: RawBodyRequest, reply: FastifyReply): Promise<string | null> {
  const config = getConfig();
  const header = request.headers['x-shopify-hmac-sha256'];
  const raw = request.rawBody;

  if (!raw) {
    reply.code(400).send({ error: 'corpo cru indisponivel' });
    return null;
  }

  const hmac = Array.isArray(header) ? header[0] : header;
  if (!verifyWebhookHmac(raw, hmac, config.SHOPIFY_API_SECRET)) {
    logger.warn(
      { topic: request.headers['x-shopify-topic'], shop: request.headers['x-shopify-shop-domain'] },
      'webhook com HMAC invalido',
    );
    reply.code(401).send({ error: 'HMAC invalido' });
    return null;
  }

  const shopHeader = request.headers['x-shopify-shop-domain'];
  const shopDomain = Array.isArray(shopHeader) ? shopHeader[0] : shopHeader;
  if (!shopDomain) {
    reply.code(400).send({ error: 'header de loja ausente' });
    return null;
  }

  return shopDomain;
}

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  /** APP_UNINSTALLED - marca a loja como desinstalada e limpa o token. */
  app.post('/webhooks/app_uninstalled', async (request: RawBodyRequest, reply) => {
    const shopDomain = await verify(request, reply);
    if (!shopDomain) return;

    // Responder rapido: a Shopify espera 200 em ate 5s.
    reply.code(200).send({ ok: true });

    try {
      const shop = await prisma.shop.findUnique({ where: { shopDomain } });
      await markUninstalled(shopDomain);
      if (shop) {
        invalidateRegionPriceCache(shop.id);
        invalidateRegionsCache(shop.id);
      }
      logger.info({ shop: shopDomain }, 'app desinstalado');
    } catch (err) {
      logger.error({ shop: shopDomain, err: String(err) }, 'falha ao processar APP_UNINSTALLED');
    }
  });

  /** PRODUCTS_CREATE - enfileira o backfill de regioes no produto novo. */
  app.post('/webhooks/products_create', async (request: RawBodyRequest, reply) => {
    const shopDomain = await verify(request, reply);
    if (!shopDomain) return;

    reply.code(200).send({ ok: true });

    try {
      const shop = await prisma.shop.findUnique({ where: { shopDomain } });
      if (!shop || !shop.isActive) return;

      const body = request.body as { id?: number | string; admin_graphql_api_id?: string };
      const gid = body.admin_graphql_api_id ?? (body.id ? numericToProductGid(body.id) : null);
      if (!gid) {
        logger.warn({ shop: shopDomain }, 'PRODUCTS_CREATE sem id de produto');
        return;
      }

      await enqueueJob({
        shopId: shop.id,
        type: 'product_backfill',
        payload: { productIds: [gid] },
      });

      logger.info({ shop: shopDomain, productId: gid }, 'backfill de produto novo enfileirado');
    } catch (err) {
      logger.error({ shop: shopDomain, err: String(err) }, 'falha ao processar PRODUCTS_CREATE');
    }
  });

  /** PRODUCTS_DELETE - limpa RegionPrice orfaos. */
  app.post('/webhooks/products_delete', async (request: RawBodyRequest, reply) => {
    const shopDomain = await verify(request, reply);
    if (!shopDomain) return;

    reply.code(200).send({ ok: true });

    try {
      const shop = await prisma.shop.findUnique({ where: { shopDomain } });
      if (!shop) return;

      const body = request.body as { id?: number | string; admin_graphql_api_id?: string };
      const gid = body.admin_graphql_api_id ?? (body.id ? numericToProductGid(body.id) : null);
      if (!gid) return;

      await cleanupDeletedProduct(shop.id, gid);
    } catch (err) {
      logger.error({ shop: shopDomain, err: String(err) }, 'falha ao processar PRODUCTS_DELETE');
    }
  });

  /**
   * Endpoints de compliance de dados. Um app custom de precificacao nao guarda
   * dado pessoal de cliente, mas a Shopify exige que os topicos respondam 200
   * com HMAC valido caso sejam configurados.
   */
  for (const path of ['customers_data_request', 'customers_redact', 'shop_redact']) {
    app.post(`/webhooks/${path}`, async (request: RawBodyRequest, reply) => {
      const shopDomain = await verify(request, reply);
      if (!shopDomain) return;
      logger.info({ shop: shopDomain, topic: path }, 'webhook de compliance recebido');
      return reply.code(200).send({ ok: true });
    });
  }
}
