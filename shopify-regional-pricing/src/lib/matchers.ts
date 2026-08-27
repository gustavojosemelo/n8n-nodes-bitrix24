import { cepToNumber, normalizeCep, normalizeCity, normalizeState } from './cep';

export type MatcherType = 'cep_range' | 'cep_exact' | 'city';

export interface MatcherInput {
  id?: string;
  type: MatcherType;
  cepStart?: string | null;
  cepEnd?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface RegionInput {
  id: string;
  name: string;
  isActive?: boolean;
  sortOrder?: number;
  matchers: MatcherInput[];
}

export interface ResolveQuery {
  cep?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface MatchResult {
  region: RegionInput;
  matcher: MatcherInput;
  /** Menor = mais especifico. Usado para desempate. */
  precedence: number;
}

/**
 * Precedencia entre tipos de matcher quando mais de um bate:
 * CEP exato e mais especifico que faixa de CEP, que e mais especifico que cidade.
 */
const PRECEDENCE: Record<MatcherType, number> = {
  cep_exact: 0,
  cep_range: 1,
  city: 2,
};

/** Amplitude da faixa: entre duas faixas que batem, a mais estreita ganha. */
function rangeSpan(matcher: MatcherInput): number {
  const start = cepToNumber(matcher.cepStart ?? '');
  const end = cepToNumber(matcher.cepEnd ?? '');
  if (start === null || end === null) return Number.MAX_SAFE_INTEGER;
  return Math.abs(end - start);
}

export function matcherMatches(matcher: MatcherInput, query: ResolveQuery): boolean {
  switch (matcher.type) {
    case 'cep_exact': {
      const target = normalizeCep(query.cep);
      const value = normalizeCep(matcher.cepStart);
      return target !== null && value !== null && target === value;
    }

    case 'cep_range': {
      const target = cepToNumber(query.cep ?? '');
      const start = cepToNumber(matcher.cepStart ?? '');
      const end = cepToNumber(matcher.cepEnd ?? '');
      if (target === null || start === null || end === null) return false;
      const lo = Math.min(start, end);
      const hi = Math.max(start, end);
      return target >= lo && target <= hi;
    }

    case 'city': {
      const city = normalizeCity(query.city);
      const matcherCity = normalizeCity(matcher.city);
      if (!city || !matcherCity || city !== matcherCity) return false;

      // Estado so restringe quando o matcher declara um.
      const matcherState = normalizeState(matcher.state);
      if (!matcherState) return true;
      return normalizeState(query.state) === matcherState;
    }

    default:
      return false;
  }
}

/**
 * Resolve a regiao de uma consulta (CEP e/ou cidade).
 * Regioes inativas sao ignoradas. Empate e resolvido por:
 * tipo mais especifico -> faixa mais estreita -> sortOrder -> nome.
 */
export function resolveRegion(regions: RegionInput[], query: ResolveQuery): MatchResult | null {
  const hits: MatchResult[] = [];

  for (const region of regions) {
    if (region.isActive === false) continue;
    for (const matcher of region.matchers) {
      if (matcherMatches(matcher, query)) {
        hits.push({ region, matcher, precedence: PRECEDENCE[matcher.type] ?? 99 });
      }
    }
  }

  if (hits.length === 0) return null;

  hits.sort((a, b) => {
    if (a.precedence !== b.precedence) return a.precedence - b.precedence;
    if (a.matcher.type === 'cep_range' && b.matcher.type === 'cep_range') {
      const span = rangeSpan(a.matcher) - rangeSpan(b.matcher);
      if (span !== 0) return span;
    }
    const order = (a.region.sortOrder ?? 0) - (b.region.sortOrder ?? 0);
    if (order !== 0) return order;
    return a.region.name.localeCompare(b.region.name, 'pt-BR');
  });

  return hits[0] ?? null;
}

// ---------------------------------------------------------------------------
// Deteccao de conflito (validacao do Passo 1 do wizard)
// ---------------------------------------------------------------------------

export interface MatcherConflict {
  /** Matcher que esta sendo cadastrado. */
  matcher: MatcherInput;
  /** Regiao ja cadastrada com a qual ele colide. */
  regionId: string;
  regionName: string;
  conflictingMatcher: MatcherInput;
  message: string;
}

function cepBounds(matcher: MatcherInput): { lo: number; hi: number } | null {
  if (matcher.type === 'cep_exact') {
    const value = cepToNumber(matcher.cepStart ?? '');
    return value === null ? null : { lo: value, hi: value };
  }
  if (matcher.type === 'cep_range') {
    const start = cepToNumber(matcher.cepStart ?? '');
    const end = cepToNumber(matcher.cepEnd ?? '');
    if (start === null || end === null) return null;
    return { lo: Math.min(start, end), hi: Math.max(start, end) };
  }
  return null;
}

function describe(matcher: MatcherInput): string {
  switch (matcher.type) {
    case 'cep_exact':
      return `CEP ${matcher.cepStart ?? '?'}`;
    case 'cep_range':
      return `faixa ${matcher.cepStart ?? '?'} a ${matcher.cepEnd ?? '?'}`;
    case 'city':
      return `cidade ${matcher.city ?? '?'}${matcher.state ? `/${matcher.state}` : ''}`;
    default:
      return 'matcher desconhecido';
  }
}

/**
 * Compara os matchers de uma regiao (nova ou editada) contra as demais regioes.
 * `excludeRegionId` evita que a regiao colida consigo mesma na edicao.
 *
 * Nao compara CEP com cidade: sem uma base de CEP->cidade nao da para saber se
 * uma faixa cai dentro de um municipio. Esse par e reportado pelo app apenas
 * quando o CEP resolvido bate em duas regioes (a precedencia acima decide).
 */
export function findMatcherConflicts(
  candidates: MatcherInput[],
  existingRegions: RegionInput[],
  excludeRegionId?: string,
): MatcherConflict[] {
  const conflicts: MatcherConflict[] = [];

  for (const candidate of candidates) {
    const candidateBounds = cepBounds(candidate);

    for (const region of existingRegions) {
      if (region.id === excludeRegionId) continue;

      for (const existing of region.matchers) {
        let collides = false;

        if (candidateBounds) {
          const existingBounds = cepBounds(existing);
          if (existingBounds) {
            collides =
              candidateBounds.lo <= existingBounds.hi && existingBounds.lo <= candidateBounds.hi;
          }
        } else if (candidate.type === 'city' && existing.type === 'city') {
          const sameCity =
            normalizeCity(candidate.city) !== '' &&
            normalizeCity(candidate.city) === normalizeCity(existing.city);
          const candidateState = normalizeState(candidate.state);
          const existingState = normalizeState(existing.state);
          // Sem estado dos dois lados, cidade de mesmo nome ja e conflito.
          const sameState =
            !candidateState || !existingState || candidateState === existingState;
          collides = sameCity && sameState;
        }

        if (collides) {
          conflicts.push({
            matcher: candidate,
            regionId: region.id,
            regionName: region.name,
            conflictingMatcher: existing,
            message: `A ${describe(candidate)} conflita com a regiao "${region.name}" (${describe(existing)}).`,
          });
        }
      }
    }
  }

  return conflicts;
}

/** Conflitos entre os matchers digitados na mesma tela (antes de salvar). */
export function findSelfOverlaps(candidates: MatcherInput[]): MatcherConflict[] {
  const conflicts: MatcherConflict[] = [];

  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i] as MatcherInput;
      const b = candidates[j] as MatcherInput;
      const found = findMatcherConflicts(
        [a],
        [{ id: '__self__', name: 'esta mesma regiao', matchers: [b] }],
      );
      conflicts.push(...found);
    }
  }

  return conflicts;
}
