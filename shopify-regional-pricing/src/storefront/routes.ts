import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getConfig } from '../config';
import { prisma } from '../db/client';
import { logger } from '../logger';
import { normalizeCep } from '../lib/cep';
import { resolveRegion, type MatcherInput, type RegionInput } from '../lib/matchers';
import { isValidShopDomain, verifyAppProxySignature } from '../shopify/crypto';
import { gidToNumericId } from '../shopify/products';
import {
  getCachedPrices,
  getCachedRegions,
  setCachedPrices,
  setCachedRegions,
  type RegionPriceMap,
} from './priceCache';

interface ProxyQuery {
  signature?: string;
  shop?: string;
  path_prefix?: string;
  timestamp?: string;
  logged_in_customer_id?: string;
  [key: string]: unknown;
}

/**
 * Toda chamada que passa pelo App Proxy e assinada pela Shopify.
 * Sem essa verificacao, qualquer um poderia consultar (e enumerar) a tabela
 * de precos da loja direto na URL do app.
 */
async function resolveShopFromProxy(
  request: FastifyRequest<{ Querystring: ProxyQuery }>,
  reply: FastifyReply,
) {
  const config = getConfig();
  const query = request.query;

  if (!config.ALLOW_DEV_AUTH) {
    if (!verifyAppProxySignature(query as Record<string, unknown>, config.SHOPIFY_API_SECRET)) {
      logger.warn({ shop: query.shop, url: request.url }, 'assinatura do App Proxy invalida');
      reply.code(401).send({ error: 'assinatura invalida' });
      return null;
    }
  }

  if (!isValidShopDomain(query.shop)) {
    reply.code(400).send({ error: 'shop invalido' });
    return null;
  }

  const shop = await prisma.shop.findUnique({ where: { shopDomain: query.shop } });
  if (!shop || !shop.isActive) {
    reply.code(404).send({ error: 'loja nao instalada' });
    return null;
  }

  return shop;
}

export async function storefrontRoutes(app: FastifyInstance): Promise<void> {
  const config = getConfig();

  /** Regioes ativas + textos do pop-up. */
  app.get('/proxy/regions', async (request: FastifyRequest<{ Querystring: ProxyQuery }>, reply) => {
    const shop = await resolveShopFromProxy(request, reply);
    if (!shop) return;

    const cached = getCachedRegions<object>(shop.id);
    if (cached) {
      reply.header('Cache-Control', 'public, max-age=60');
      return reply.send(cached);
    }

    const [regions, settings] = await Promise.all([
      prisma.region.findMany({
        where: { shopId: shop.id, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { matchers: true },
      }),
      prisma.settings.findUnique({ where: { shopId: shop.id } }),
    ]);

    const payload = {
      regions: regions.map((region) => ({
        id: region.id,
        name: region.name,
        // Cidades cadastradas alimentam o dropdown quando o modo e "cidade".
        cities: region.matchers
          .filter((m) => m.type === 'city' && m.city)
          .map((m) => ({ city: m.city as string, state: m.state })),
      })),
      settings: {
        title: settings?.popupTitle ?? 'Selecione sua regiao',
        subtitle: settings?.popupSubtitle ?? null,
        mode: settings?.popupMode ?? 'cep',
        blockNavigation: settings?.blockNavigation ?? true,
        defaultRegionId: settings?.defaultRegionId ?? null,
      },
    };

    setCachedRegions(shop.id, payload);
    reply.header('Cache-Control', 'public, max-age=60');
    return reply.send(payload);
  });

  /** CEP ou cidade -> regiao. */
  app.post('/proxy/resolve-region', async (request: FastifyRequest<{ Querystring: ProxyQuery }>, reply) => {
    const shop = await resolveShopFromProxy(request, reply);
    if (!shop) return;

    const parsed = z
      .object({
        cep: z.string().optional().nullable(),
        city: z.string().optional().nullable(),
        state: z.string().optional().nullable(),
      })
      .safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({ error: 'dados invalidos' });
    }

    const { cep: rawCep, city, state } = parsed.data;

    // CEP informado mas malformado e erro de entrada, nao "regiao nao atendida".
    if (rawCep && !normalizeCep(rawCep)) {
      return reply.code(400).send({
        error: 'CEP invalido',
        message: 'Digite os 8 digitos do CEP.',
        matched: false,
      });
    }

    const cep = normalizeCep(rawCep);
    if (!cep && !city) {
      return reply.code(400).send({ error: 'informe um CEP ou uma cidade', matched: false });
    }

    const [regions, settings] = await Promise.all([
      prisma.region.findMany({
        where: { shopId: shop.id, isActive: true },
        include: { matchers: true },
      }),
      prisma.settings.findUnique({ where: { shopId: shop.id } }),
    ]);

    const candidates: RegionInput[] = regions.map((r) => ({
      id: r.id,
      name: r.name,
      isActive: r.isActive,
      sortOrder: r.sortOrder,
      matchers: r.matchers.map((m) => ({
        id: m.id,
        type: m.type as MatcherInput['type'],
        cepStart: m.cepStart,
        cepEnd: m.cepEnd,
        city: m.city,
        state: m.state,
      })),
    }));

    const match = resolveRegion(candidates, { cep, city, state });

    reply.header('Cache-Control', 'no-store');

    if (match) {
      return reply.send({
        region: { id: match.region.id, name: match.region.name },
        matched: true,
        matchedBy: match.matcher.type,
      });
    }

    // Sem matcher: cai na regiao padrao, se houver.
    const fallbackId = settings?.defaultRegionId ?? null;
    if (fallbackId) {
      const fallback = regions.find((r) => r.id === fallbackId);
      if (fallback) {
        return reply.send({
          region: { id: fallback.id, name: fallback.name },
          matched: false,
          usedDefault: true,
          defaultRegionId: fallbackId,
        });
      }
    }

    return reply.send({
      region: null,
      matched: false,
      usedDefault: false,
      defaultRegionId: null,
      message: 'Ainda nao entregamos nessa regiao.',
    });
  });

  /**
   * Mapa produto -> variante/preco da regiao.
   * Endpoint mais chamado do app: cache em memoria + Cache-Control para o CDN.
   */
  app.get('/proxy/prices', async (request: FastifyRequest<{ Querystring: ProxyQuery & { regionId?: string } }>, reply) => {
    const shop = await resolveShopFromProxy(request, reply);
    if (!shop) return;

    const regionId = request.query.regionId;
    if (!regionId || typeof regionId !== 'string') {
      return reply.code(400).send({ error: 'regionId obrigatorio' });
    }

    const ttl = config.PRICE_CACHE_TTL_SECONDS;

    const cached = getCachedPrices(shop.id, regionId);
    if (cached) {
      reply.header('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=60`);
      return reply.send(cached);
    }

    const region = await prisma.region.findFirst({
      where: { id: regionId, shopId: shop.id, isActive: true },
      include: { prices: true },
    });

    if (!region) {
      reply.header('Cache-Control', 'no-store');
      return reply.code(404).send({ error: 'regiao nao encontrada' });
    }

    // O handle vem do espelho do catalogo: o storefront so consegue casar
    // um card de produto pelo handle da URL.
    const catalog = await prisma.shopProduct.findMany({
      where: { shopId: shop.id },
      select: { shopifyProductId: true, handle: true },
    });
    const handleById = new Map(catalog.map((p) => [p.shopifyProductId, p.handle]));

    const products: RegionPriceMap['products'] = {};
    const byNumericId: RegionPriceMap['byNumericId'] = {};
    const byHandle: RegionPriceMap['byHandle'] = {};
    let latest = region.updatedAt;

    for (const price of region.prices) {
      // Sem variante sincronizada o storefront nao consegue montar o carrinho:
      // omitir e melhor do que devolver um preco que nao da para comprar.
      if (!price.shopifyVariantId) continue;
      if (price.updatedAt > latest) latest = price.updatedAt;

      const productIdNumeric = gidToNumericId(price.shopifyProductId);
      const handle = handleById.get(price.shopifyProductId) ?? null;

      const entry = {
        variantId: price.shopifyVariantId,
        variantIdNumeric: gidToNumericId(price.shopifyVariantId),
        productIdNumeric,
        handle,
        price: price.price.toFixed(2),
        compareAtPrice: price.compareAtPrice ? price.compareAtPrice.toFixed(2) : null,
        available: price.isAvailable,
      };

      products[price.shopifyProductId] = entry;
      if (productIdNumeric) byNumericId[productIdNumeric] = entry;
      if (handle) byHandle[handle] = entry;
    }

    const payload: RegionPriceMap = {
      regionId: region.id,
      regionName: region.name,
      updatedAt: latest.toISOString(),
      products,
      byNumericId,
      byHandle,
    };

    setCachedPrices(shop.id, regionId, payload);

    reply.header('Cache-Control', `public, max-age=${ttl}, stale-while-revalidate=60`);
    return reply.send(payload);
  });
}
