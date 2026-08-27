import { getConfig } from '../config';
import { TtlCache } from '../lib/cache';
import { logger } from '../logger';

export interface RegionPriceEntry {
  variantId: string | null;
  variantIdNumeric: string | null;
  productIdNumeric: string | null;
  handle: string | null;
  price: string;
  compareAtPrice: string | null;
  available: boolean;
}

export interface RegionPriceMap {
  regionId: string;
  regionName: string;
  updatedAt: string;
  /** Chaveado pelo gid do produto, como especificado. */
  products: Record<string, RegionPriceEntry>;
  /**
   * Indices auxiliares para o storefront: o DOM do tema so expoe o id numerico
   * e o handle do produto, nunca o gid.
   */
  byNumericId: Record<string, RegionPriceEntry>;
  byHandle: Record<string, RegionPriceEntry>;
}

/**
 * /proxy/prices e o endpoint mais chamado do app: uma vez por pageview.
 * Cache em memoria com TTL, invalidado quando um SyncJob daquela regiao termina.
 */
const cache = new TtlCache<RegionPriceMap>(300_000);

function key(shopId: string, regionId: string): string {
  return `prices:${shopId}:${regionId}`;
}

export function getCachedPrices(shopId: string, regionId: string): RegionPriceMap | undefined {
  return cache.get(key(shopId, regionId));
}

export function setCachedPrices(shopId: string, regionId: string, value: RegionPriceMap): void {
  cache.set(key(shopId, regionId), value, getConfig().PRICE_CACHE_TTL_SECONDS * 1000);
}

/** Invalida uma regiao, ou a loja inteira quando regionId nao e informado. */
export function invalidateRegionPriceCache(shopId: string, regionId?: string): void {
  if (regionId) {
    cache.delete(key(shopId, regionId));
    logger.debug({ shopId, regionId }, 'cache de precos invalidado');
    return;
  }
  const removed = cache.deletePrefix(`prices:${shopId}:`);
  logger.debug({ shopId, removed }, 'cache de precos da loja invalidado');
}

// O pop-up tambem le regioes+settings a cada primeira visita; cache curto.
const regionsCache = new TtlCache<unknown>(60_000);

export function getCachedRegions<T>(shopId: string): T | undefined {
  return regionsCache.get(`regions:${shopId}`) as T | undefined;
}

export function setCachedRegions<T>(shopId: string, value: T): void {
  regionsCache.set(`regions:${shopId}`, value, 60_000);
}

export function invalidateRegionsCache(shopId: string): void {
  regionsCache.delete(`regions:${shopId}`);
}

export function clearAllCaches(): void {
  cache.clear();
  regionsCache.clear();
}
