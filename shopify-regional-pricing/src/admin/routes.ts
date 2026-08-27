import type { FastifyInstance } from 'fastify';
import { miscRoutes } from './misc';
import { priceRoutes } from './prices';
import { regionRoutes } from './regions';
import { requireShop } from './session';

/**
 * API do admin. Tudo aqui exige um session token valido do App Bridge
 * (ou x-dev-shop em desenvolvimento).
 */
export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', requireShop);

  await regionRoutes(app);
  await priceRoutes(app);
  await miscRoutes(app);
}
