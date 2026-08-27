import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/client';
import { logger } from '../logger';
import { enqueueJob, enqueueRegionSyncOnce } from '../jobs/enqueue';
import { normalizeCep, normalizeCepRange } from '../lib/cep';
import { findMatcherConflicts, findSelfOverlaps, type MatcherInput, type RegionInput } from '../lib/matchers';
import { invalidateRegionPriceCache, invalidateRegionsCache } from '../storefront/priceCache';
import { shopOf } from './session';

const matcherSchema = z
  .object({
    type: z.enum(['cep_range', 'cep_exact', 'city']),
    cepStart: z.string().optional().nullable(),
    cepEnd: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'cep_exact') {
      if (!normalizeCep(value.cepStart)) {
        ctx.addIssue({ code: 'custom', message: 'CEP invalido (informe 8 digitos)', path: ['cepStart'] });
      }
      return;
    }
    if (value.type === 'cep_range') {
      if (!normalizeCepRange(value.cepStart, value.cepEnd)) {
        ctx.addIssue({ code: 'custom', message: 'faixa de CEP invalida', path: ['cepStart'] });
      }
      return;
    }
    if (!value.city || !value.city.trim()) {
      ctx.addIssue({ code: 'custom', message: 'informe a cidade', path: ['city'] });
    }
  });

const regionBodySchema = z.object({
  name: z.string().trim().min(1, 'informe o nome da regiao').max(120),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  matchers: z.array(matcherSchema).min(1, 'cadastre ao menos uma forma de identificar a regiao'),
});

/** Guarda os matchers ja normalizados: CEP so digitos, UF em caixa alta. */
function normalizeMatchers(matchers: z.infer<typeof matcherSchema>[]): MatcherInput[] {
  return matchers.map((m) => {
    if (m.type === 'cep_exact') {
      return { type: m.type, cepStart: normalizeCep(m.cepStart), cepEnd: null, city: null, state: null };
    }
    if (m.type === 'cep_range') {
      const range = normalizeCepRange(m.cepStart, m.cepEnd);
      return { type: m.type, cepStart: range?.start ?? null, cepEnd: range?.end ?? null, city: null, state: null };
    }
    return {
      type: m.type,
      cepStart: null,
      cepEnd: null,
      city: m.city?.trim() ?? null,
      state: m.state?.trim().toUpperCase() || null,
    };
  });
}

async function loadRegionsForConflict(shopId: string): Promise<RegionInput[]> {
  const regions = await prisma.region.findMany({
    where: { shopId },
    include: { matchers: true },
  });

  return regions.map((r) => ({
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
}

/** Texto curto da coluna "Identificacao" do painel. */
function describeMatchers(matchers: Array<{ type: string; cepStart: string | null; cepEnd: string | null; city: string | null; state: string | null }>): string {
  const parts = matchers.map((m) => {
    if (m.type === 'cep_exact') return `CEP ${m.cepStart ?? '?'}`;
    if (m.type === 'cep_range') return `CEP ${m.cepStart ?? '?'} a ${m.cepEnd ?? '?'}`;
    return `Cidade: ${m.city ?? '?'}${m.state ? `/${m.state}` : ''}`;
  });
  if (parts.length <= 2) return parts.join(' · ');
  return `${parts.slice(0, 2).join(' · ')} +${parts.length - 2}`;
}

export async function regionRoutes(app: FastifyInstance): Promise<void> {
  /** Painel principal: uma linha por regiao com o status agregado. */
  app.get('/api/regions', async (request) => {
    const shop = shopOf(request);

    const [regions, totalProducts] = await Promise.all([
      prisma.region.findMany({
        where: { shopId: shop.id },
        include: { matchers: true, prices: { select: { syncStatus: true } } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.shopProduct.count({ where: { shopId: shop.id, status: 'ACTIVE' } }),
    ]);

    return {
      totalProducts,
      regions: regions.map((region) => {
        const counts = region.prices.reduce(
          (acc, p) => {
            acc[p.syncStatus as 'pending' | 'synced' | 'error'] =
              (acc[p.syncStatus as 'pending' | 'synced' | 'error'] ?? 0) + 1;
            return acc;
          },
          {} as Record<'pending' | 'synced' | 'error', number>,
        );

        const status =
          (counts.error ?? 0) > 0 ? 'error' : (counts.pending ?? 0) > 0 ? 'pending' : 'synced';

        return {
          id: region.id,
          name: region.name,
          isActive: region.isActive,
          sortOrder: region.sortOrder,
          identification: describeMatchers(region.matchers),
          matcherCount: region.matchers.length,
          pricedCount: region.prices.length,
          totalProducts,
          syncedCount: counts.synced ?? 0,
          pendingCount: counts.pending ?? 0,
          errorCount: counts.error ?? 0,
          status,
        };
      }),
    };
  });

  /** Detalhe da regiao (abre o wizard em modo edicao). */
  app.get('/api/regions/:id', async (request, reply) => {
    const shop = shopOf(request);
    const { id } = request.params as { id: string };

    const region = await prisma.region.findFirst({
      where: { id, shopId: shop.id },
      include: { matchers: true },
    });

    if (!region) return reply.code(404).send({ error: 'regiao nao encontrada' });
    return region;
  });

  /** Validacao de conflito antes de salvar (Passo 1 do wizard). */
  app.post('/api/matchers/validate', async (request, reply) => {
    const shop = shopOf(request);
    const body = z
      .object({
        matchers: z.array(matcherSchema),
        excludeRegionId: z.string().optional(),
      })
      .safeParse(request.body);

    if (!body.success) {
      return reply.code(400).send({ error: 'dados invalidos', issues: body.error.issues });
    }

    const normalized = normalizeMatchers(body.data.matchers);
    const existing = await loadRegionsForConflict(shop.id);

    return {
      conflicts: findMatcherConflicts(normalized, existing, body.data.excludeRegionId),
      selfOverlaps: findSelfOverlaps(normalized),
    };
  });

  /** Passo 1 do wizard: cria a regiao (sem sincronizar ainda). */
  app.post('/api/regions', async (request, reply) => {
    const shop = shopOf(request);
    const parsed = regionBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: 'dados invalidos', issues: parsed.error.issues });
    }

    const normalized = normalizeMatchers(parsed.data.matchers);
    const existing = await loadRegionsForConflict(shop.id);
    const conflicts = findMatcherConflicts(normalized, existing);

    if (conflicts.length > 0) {
      return reply.code(409).send({ error: 'conflito de matcher', conflicts });
    }

    const duplicate = await prisma.region.findFirst({
      where: { shopId: shop.id, name: parsed.data.name },
    });
    if (duplicate) {
      return reply.code(409).send({ error: `Ja existe uma regiao chamada "${parsed.data.name}"` });
    }

    const region = await prisma.region.create({
      data: {
        shopId: shop.id,
        name: parsed.data.name,
        isActive: parsed.data.isActive ?? true,
        sortOrder: parsed.data.sortOrder ?? existing.length,
        matchers: { create: normalized.map((m) => ({ ...m, type: m.type })) },
      },
      include: { matchers: true },
    });

    invalidateRegionsCache(shop.id);
    logger.info({ shopId: shop.id, regionId: region.id, name: region.name }, 'regiao criada');

    return reply.code(201).send(region);
  });

  /** Edicao da regiao. Renomear exige repassar o nome antigo ao sync. */
  app.put('/api/regions/:id', async (request, reply) => {
    const shop = shopOf(request);
    const { id } = request.params as { id: string };
    const parsed = regionBodySchema.partial({ matchers: true }).safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: 'dados invalidos', issues: parsed.error.issues });
    }

    const current = await prisma.region.findFirst({ where: { id, shopId: shop.id } });
    if (!current) return reply.code(404).send({ error: 'regiao nao encontrada' });

    if (parsed.data.matchers) {
      const normalized = normalizeMatchers(parsed.data.matchers);
      const existing = await loadRegionsForConflict(shop.id);
      const conflicts = findMatcherConflicts(normalized, existing, id);
      if (conflicts.length > 0) {
        return reply.code(409).send({ error: 'conflito de matcher', conflicts });
      }

      await prisma.$transaction([
        prisma.regionMatcher.deleteMany({ where: { regionId: id } }),
        prisma.regionMatcher.createMany({
          data: normalized.map((m) => ({ ...m, regionId: id })),
        }),
      ]);
    }

    const renamed = Boolean(parsed.data.name && parsed.data.name !== current.name);

    const region = await prisma.region.update({
      where: { id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
      },
      include: { matchers: true },
    });

    invalidateRegionsCache(shop.id);
    invalidateRegionPriceCache(shop.id, id);

    // Renomear muda o valor da option nos produtos: precisa passar pela fila.
    let job = null;
    if (renamed) {
      job = await enqueueRegionSyncOnce({
        shopId: shop.id,
        regionId: id,
        type: 'region_update',
        previousName: current.name,
      });
    }

    logger.info({ shopId: shop.id, regionId: id, renamed }, 'regiao atualizada');
    return { region, job };
  });

  /**
   * Exclusao (Etapa 9.2). Exige confirmacao digitando o nome exato da regiao.
   * A regiao sai do banco e a limpeza na Shopify vai para a fila com o
   * snapshot das variantes.
   */
  app.delete('/api/regions/:id', async (request, reply) => {
    const shop = shopOf(request);
    const { id } = request.params as { id: string };
    const { confirm } = (request.query ?? {}) as { confirm?: string };

    const region = await prisma.region.findFirst({
      where: { id, shopId: shop.id },
      include: { prices: true },
    });

    if (!region) return reply.code(404).send({ error: 'regiao nao encontrada' });

    if (confirm !== region.name) {
      return reply.code(400).send({
        error:
          'Confirmacao obrigatoria: envie ?confirm=<nome exato da regiao>. ' +
          'As variantes correspondentes serao removidas de todos os produtos e ' +
          'assinaturas ativas nessa regiao serao afetadas.',
      });
    }

    const variantsByProduct = region.prices
      .filter((p) => p.shopifyVariantId)
      .map((p) => ({ productId: p.shopifyProductId, variantId: p.shopifyVariantId as string }));

    // Se a regiao era o fallback, a settings nao pode ficar apontando para o nada.
    await prisma.settings.updateMany({
      where: { shopId: shop.id, defaultRegionId: id },
      data: { defaultRegionId: null },
    });

    await prisma.region.delete({ where: { id } });

    const job = await enqueueJob({
      shopId: shop.id,
      type: 'region_delete',
      payload: { regionId: id, regionName: region.name, variantsByProduct },
    });

    invalidateRegionsCache(shop.id);
    invalidateRegionPriceCache(shop.id);

    logger.warn(
      { shopId: shop.id, regionId: id, name: region.name, variants: variantsByProduct.length },
      'regiao excluida',
    );

    return { deleted: true, job, variantsToRemove: variantsByProduct.length };
  });
}
