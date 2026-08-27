import type { Shop } from '@prisma/client';
import { prisma } from '../db/client';
import { decryptSecret, encryptSecret } from '../db/crypto';
import type { GraphQLContext } from './graphql';

export class ShopNotInstalledError extends Error {
  constructor(shopDomain: string) {
    super(`Loja ${shopDomain} nao esta instalada ou o token foi revogado`);
    this.name = 'ShopNotInstalledError';
  }
}

export async function upsertShop(params: {
  shopDomain: string;
  accessToken: string;
  scope?: string | null;
}): Promise<Shop> {
  const encrypted = encryptSecret(params.accessToken);

  return prisma.shop.upsert({
    where: { shopDomain: params.shopDomain },
    create: {
      shopDomain: params.shopDomain,
      accessToken: encrypted,
      scope: params.scope ?? null,
      isActive: true,
      settings: { create: {} },
    },
    update: {
      accessToken: encrypted,
      scope: params.scope ?? null,
      isActive: true,
      uninstalledAt: null,
    },
  });
}

export async function getShop(shopDomain: string): Promise<Shop | null> {
  return prisma.shop.findUnique({ where: { shopDomain } });
}

export async function requireActiveShop(shopDomain: string): Promise<Shop> {
  const shop = await getShop(shopDomain);
  if (!shop || !shop.isActive || !shop.accessToken) {
    throw new ShopNotInstalledError(shopDomain);
  }
  return shop;
}

/** Contexto para chamadas GraphQL, com o token descriptografado. */
export function graphQLContext(shop: Shop): GraphQLContext {
  return {
    shopDomain: shop.shopDomain,
    accessToken: decryptSecret(shop.accessToken),
  };
}

export async function contextForShop(shopDomain: string): Promise<GraphQLContext> {
  return graphQLContext(await requireActiveShop(shopDomain));
}

export async function markUninstalled(shopDomain: string): Promise<void> {
  await prisma.shop.updateMany({
    where: { shopDomain },
    data: {
      isActive: false,
      uninstalledAt: new Date(),
      // Token nao serve mais e nao deve ficar guardado.
      accessToken: '',
      scope: null,
    },
  });
}

/** Cria a linha de Settings se ainda nao existir (lojas instaladas antes do campo). */
export async function ensureSettings(shopId: string) {
  const existing = await prisma.settings.findUnique({ where: { shopId } });
  if (existing) return existing;
  return prisma.settings.create({ data: { shopId } });
}
