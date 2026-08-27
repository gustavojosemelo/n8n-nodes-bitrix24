import fs from 'node:fs';
import path from 'node:path';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import Fastify, {
  type FastifyBaseLogger,
  type FastifyError,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import { getConfig } from './config';
import { checkDatabase, prisma } from './db/client';
import { logger } from './logger';
import { adminRoutes } from './admin/routes';
import { storefrontRoutes } from './storefront/routes';
import { authRoutes } from './shopify/authRoutes';
import { webhookRoutes } from './shopify/webhookRoutes';
import { isValidShopDomain } from './shopify/crypto';

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const INDEX_FILE = path.join(PUBLIC_DIR, 'index.html');

let indexCache: string | null = null;

/**
 * A API key entra no HTML em tempo de execucao, nao no build: assim a mesma
 * imagem Docker serve qualquer loja e o Coolify continua sendo o unico lugar
 * onde as credenciais vivem.
 */
function renderIndex(apiKey: string): string {
  if (indexCache) return indexCache;
  const html = fs.readFileSync(INDEX_FILE, 'utf8');
  indexCache = html.replaceAll('%VITE_SHOPIFY_API_KEY%', apiKey);
  return indexCache;
}

export async function buildServer(): Promise<FastifyInstance> {
  const config = getConfig();

  const app = Fastify({
    // pino tipado como o logger base do Fastify: sem o cast, a instancia
    // ficaria com um tipo generico incompativel com os modulos de rota.
    loggerInstance: logger as unknown as FastifyBaseLogger,
    trustProxy: true,
    disableRequestLogging: false,
    bodyLimit: 2 * 1024 * 1024,
  });

  /**
   * O corpo cru precisa sobreviver ao parse: o HMAC dos webhooks e calculado
   * sobre os bytes exatos que a Shopify enviou.
   */
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (request: FastifyRequest & { rawBody?: Buffer }, body, done) => {
      request.rawBody = body as Buffer;
      const text = (body as Buffer).toString('utf8');
      if (!text.trim()) return done(null, {});
      try {
        done(null, JSON.parse(text));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  await app.register(fastifyCookie, { secret: config.SESSION_SECRET });

  // -------------------------------------------------------------------------
  // Health (Etapa 1 / healthcheck do Coolify)
  // -------------------------------------------------------------------------
  app.get('/health', async (_request, reply) => {
    const dbOk = await checkDatabase();
    const status = dbOk ? 200 : 503;

    return reply.code(status).send({
      status: dbOk ? 'ok' : 'degraded',
      database: dbOk ? 'up' : 'down',
      uptimeSeconds: Math.round(process.uptime()),
      version: process.env.npm_package_version ?? '1.0.0',
      apiVersion: config.SHOPIFY_API_VERSION,
      timestamp: new Date().toISOString(),
    });
  });

  // -------------------------------------------------------------------------
  // Rotas
  // -------------------------------------------------------------------------
  await app.register(authRoutes);
  await app.register(webhookRoutes);
  await app.register(storefrontRoutes);
  await app.register(adminRoutes);

  // -------------------------------------------------------------------------
  // Admin UI (build do Vite)
  // -------------------------------------------------------------------------
  const hasBuild = fs.existsSync(INDEX_FILE);

  if (hasBuild) {
    await app.register(fastifyStatic, {
      root: PUBLIC_DIR,
      prefix: '/',
      wildcard: false,
      index: false,
      decorateReply: true,
    });
  } else {
    logger.warn({ dir: PUBLIC_DIR }, 'build da Admin UI ausente: rode npm run build:web');
  }

  const sendIndex = (reply: FastifyReply) => {
    if (!hasBuild) {
      return reply
        .code(503)
        .type('text/plain; charset=utf-8')
        .send('Admin UI nao compilada. Rode: npm run build:web');
    }
    return reply.type('text/html; charset=utf-8').send(renderIndex(config.SHOPIFY_API_KEY));
  };

  /**
   * Entrada do app embutido. A Shopify abre
   * SHOPIFY_APP_URL/?shop=...&host=...&embedded=1
   * Se a loja ainda nao instalou, manda para o OAuth.
   */
  app.get('/', async (request, reply) => {
    const { shop } = request.query as { shop?: string };

    if (isValidShopDomain(shop)) {
      const record = await prisma.shop.findUnique({ where: { shopDomain: shop } });
      if (!record || !record.isActive) {
        return reply.redirect(`/auth?shop=${encodeURIComponent(shop)}`);
      }
    }

    return sendIndex(reply);
  });

  // SPA: qualquer rota do admin cai no index.html do React Router.
  app.setNotFoundHandler(async (request, reply) => {
    if (
      request.method !== 'GET' ||
      request.url.startsWith('/api') ||
      request.url.startsWith('/proxy') ||
      request.url.startsWith('/webhooks') ||
      request.url.startsWith('/auth')
    ) {
      return reply.code(404).send({ error: 'nao encontrado' });
    }
    return sendIndex(reply);
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error, url: request.url }, 'erro nao tratado');
    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    return reply.code(status).send({
      error: status === 500 ? 'erro interno' : error.message,
    });
  });

  return app;
}
