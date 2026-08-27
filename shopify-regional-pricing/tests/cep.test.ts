import { describe, expect, it } from 'vitest';
import {
  cepToNumber,
  formatCep,
  normalizeCep,
  normalizeCepRange,
  normalizeCity,
  normalizeState,
} from '../src/lib/cep';

describe('normalizeCep', () => {
  it('aceita CEP com e sem mascara', () => {
    expect(normalizeCep('58400-000')).toBe('58400000');
    expect(normalizeCep('58400000')).toBe('58400000');
    expect(normalizeCep(' 58400 000 ')).toBe('58400000');
    expect(normalizeCep('58.400-000')).toBe('58400000');
  });

  it('preserva zeros a esquerda', () => {
    expect(normalizeCep('01001-000')).toBe('01001000');
  });

  it('rejeita entrada com numero errado de digitos', () => {
    expect(normalizeCep('5840000')).toBeNull();
    expect(normalizeCep('584000000')).toBeNull();
    expect(normalizeCep('')).toBeNull();
    expect(normalizeCep(null)).toBeNull();
    expect(normalizeCep(undefined)).toBeNull();
    expect(normalizeCep({})).toBeNull();
  });
});

describe('formatCep', () => {
  it('formata para exibicao', () => {
    expect(formatCep('58400000')).toBe('58400-000');
  });

  it('devolve a entrada quando ela nao e um CEP', () => {
    expect(formatCep('abc')).toBe('abc');
  });
});

describe('cepToNumber', () => {
  it('converte para inteiro comparavel', () => {
    expect(cepToNumber('58400000')).toBe(58400000);
    expect(cepToNumber('01001000')).toBe(1001000);
    expect(cepToNumber('invalido')).toBeNull();
  });
});

describe('normalizeCepRange', () => {
  it('corrige a ordem quando o operador inverte de/ate', () => {
    expect(normalizeCepRange('58419999', '58400000')).toEqual({
      start: '58400000',
      end: '58419999',
    });
  });

  it('aceita faixa de um unico CEP', () => {
    expect(normalizeCepRange('58400000', '58400000')).toEqual({
      start: '58400000',
      end: '58400000',
    });
  });

  it('rejeita faixa incompleta', () => {
    expect(normalizeCepRange('58400000', '')).toBeNull();
  });
});

describe('normalizeCity / normalizeState', () => {
  it('ignora acento, caixa e espaco duplicado', () => {
    expect(normalizeCity('  São  José   dos Campos ')).toBe('sao jose dos campos');
    expect(normalizeCity('LAGOA SECA')).toBe(normalizeCity('Lagoa Seca'));
  });

  it('normaliza a UF para caixa alta', () => {
    expect(normalizeState(' pb ')).toBe('PB');
    expect(normalizeState(null)).toBe('');
  });
});
