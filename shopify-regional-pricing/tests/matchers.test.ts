import { describe, expect, it } from 'vitest';
import {
  findMatcherConflicts,
  findSelfOverlaps,
  matcherMatches,
  resolveRegion,
  type RegionInput,
} from '../src/lib/matchers';

const centro: RegionInput = {
  id: 'reg_centro',
  name: 'Campina Grande - Centro',
  isActive: true,
  sortOrder: 0,
  matchers: [{ type: 'cep_range', cepStart: '58400000', cepEnd: '58419999' }],
};

const lagoaSeca: RegionInput = {
  id: 'reg_lagoa',
  name: 'Lagoa Seca',
  isActive: true,
  sortOrder: 1,
  matchers: [{ type: 'city', city: 'Lagoa Seca', state: 'PB' }],
};

const bairroEspecifico: RegionInput = {
  id: 'reg_bairro',
  name: 'Condominio Alphaville',
  isActive: true,
  sortOrder: 2,
  matchers: [{ type: 'cep_exact', cepStart: '58410500' }],
};

describe('matcherMatches', () => {
  it('faixa de CEP inclui os extremos', () => {
    const matcher = { type: 'cep_range' as const, cepStart: '58400000', cepEnd: '58419999' };
    expect(matcherMatches(matcher, { cep: '58400000' })).toBe(true);
    expect(matcherMatches(matcher, { cep: '58419999' })).toBe(true);
    expect(matcherMatches(matcher, { cep: '58410123' })).toBe(true);
    expect(matcherMatches(matcher, { cep: '58399999' })).toBe(false);
    expect(matcherMatches(matcher, { cep: '58420000' })).toBe(false);
  });

  it('faixa invertida no banco continua funcionando', () => {
    const matcher = { type: 'cep_range' as const, cepStart: '58419999', cepEnd: '58400000' };
    expect(matcherMatches(matcher, { cep: '58410000' })).toBe(true);
  });

  it('cidade ignora acento e caixa', () => {
    const matcher = { type: 'city' as const, city: 'São José', state: null };
    expect(matcherMatches(matcher, { city: 'sao jose' })).toBe(true);
    expect(matcherMatches(matcher, { city: 'SAO JOSE' })).toBe(true);
  });

  it('cidade com estado so bate no estado certo', () => {
    const matcher = { type: 'city' as const, city: 'Lagoa Seca', state: 'PB' };
    expect(matcherMatches(matcher, { city: 'Lagoa Seca', state: 'pb' })).toBe(true);
    expect(matcherMatches(matcher, { city: 'Lagoa Seca', state: 'SP' })).toBe(false);
    // Sem UF informada, o matcher com UF nao bate.
    expect(matcherMatches(matcher, { city: 'Lagoa Seca' })).toBe(false);
  });
});

describe('resolveRegion', () => {
  const regions = [centro, lagoaSeca, bairroEspecifico];

  it('resolve um CEP dentro da faixa', () => {
    const result = resolveRegion(regions, { cep: '58400123' });
    expect(result?.region.id).toBe('reg_centro');
    expect(result?.matcher.type).toBe('cep_range');
  });

  it('CEP exato ganha da faixa que o contem', () => {
    const result = resolveRegion(regions, { cep: '58410500' });
    expect(result?.region.id).toBe('reg_bairro');
  });

  it('resolve por cidade', () => {
    const result = resolveRegion(regions, { city: 'lagoa seca', state: 'PB' });
    expect(result?.region.id).toBe('reg_lagoa');
  });

  it('devolve null quando nada bate', () => {
    expect(resolveRegion(regions, { cep: '01001000' })).toBeNull();
  });

  it('ignora regiao inativa', () => {
    const inactive = [{ ...centro, isActive: false }];
    expect(resolveRegion(inactive, { cep: '58400123' })).toBeNull();
  });

  it('entre duas faixas que batem, a mais estreita ganha', () => {
    const ampla: RegionInput = {
      id: 'ampla',
      name: 'Paraiba inteira',
      matchers: [{ type: 'cep_range', cepStart: '58000000', cepEnd: '58999999' }],
    };
    const estreita: RegionInput = {
      id: 'estreita',
      name: 'Centro',
      matchers: [{ type: 'cep_range', cepStart: '58400000', cepEnd: '58400999' }],
    };

    const result = resolveRegion([ampla, estreita], { cep: '58400500' });
    expect(result?.region.id).toBe('estreita');
  });

  it('mascara e aceita na consulta', () => {
    expect(resolveRegion([centro], { cep: '58400-123' })?.region.id).toBe('reg_centro');
  });
});

describe('findMatcherConflicts', () => {
  it('acusa faixa sobreposta a uma regiao existente', () => {
    const conflicts = findMatcherConflicts(
      [{ type: 'cep_range', cepStart: '58410000', cepEnd: '58430000' }],
      [centro],
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.regionName).toBe('Campina Grande - Centro');
  });

  it('acusa CEP exato dentro de uma faixa existente', () => {
    const conflicts = findMatcherConflicts(
      [{ type: 'cep_exact', cepStart: '58405000' }],
      [centro],
    );
    expect(conflicts).toHaveLength(1);
  });

  it('nao acusa faixas adjacentes que nao se tocam', () => {
    const conflicts = findMatcherConflicts(
      [{ type: 'cep_range', cepStart: '58420000', cepEnd: '58429999' }],
      [centro],
    );
    expect(conflicts).toHaveLength(0);
  });

  it('nao acusa a propria regiao ao editar', () => {
    const conflicts = findMatcherConflicts(
      [{ type: 'cep_range', cepStart: '58400000', cepEnd: '58419999' }],
      [centro],
      'reg_centro',
    );
    expect(conflicts).toHaveLength(0);
  });

  it('acusa cidade duplicada', () => {
    const conflicts = findMatcherConflicts(
      [{ type: 'city', city: 'lagoa seca', state: 'PB' }],
      [lagoaSeca],
    );
    expect(conflicts).toHaveLength(1);
  });

  it('nao acusa mesma cidade em estados diferentes', () => {
    const conflicts = findMatcherConflicts(
      [{ type: 'city', city: 'Lagoa Seca', state: 'SP' }],
      [lagoaSeca],
    );
    expect(conflicts).toHaveLength(0);
  });

  it('nao compara CEP com cidade', () => {
    const conflicts = findMatcherConflicts(
      [{ type: 'cep_range', cepStart: '58400000', cepEnd: '58419999' }],
      [lagoaSeca],
    );
    expect(conflicts).toHaveLength(0);
  });
});

describe('findSelfOverlaps', () => {
  it('acusa duas faixas sobrepostas digitadas na mesma tela', () => {
    const overlaps = findSelfOverlaps([
      { type: 'cep_range', cepStart: '58400000', cepEnd: '58410000' },
      { type: 'cep_range', cepStart: '58405000', cepEnd: '58420000' },
    ]);
    expect(overlaps.length).toBeGreaterThan(0);
  });

  it('aceita faixas disjuntas', () => {
    const overlaps = findSelfOverlaps([
      { type: 'cep_range', cepStart: '58400000', cepEnd: '58409999' },
      { type: 'cep_range', cepStart: '58410000', cepEnd: '58419999' },
    ]);
    expect(overlaps).toHaveLength(0);
  });
});
