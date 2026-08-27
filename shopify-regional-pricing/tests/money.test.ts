import { describe, expect, it } from 'vitest';
import { applyPercent, formatBRL, toMoneyString } from '../src/lib/money';

describe('toMoneyString', () => {
  it('normaliza para duas casas', () => {
    expect(toMoneyString('12.9')).toBe('12.90');
    expect(toMoneyString('12')).toBe('12.00');
    expect(toMoneyString(12.9)).toBe('12.90');
  });

  it('aceita virgula como separador decimal', () => {
    expect(toMoneyString('12,90')).toBe('12.90');
  });

  it('rejeita valor invalido ou negativo', () => {
    expect(toMoneyString('abc')).toBeNull();
    expect(toMoneyString('-5')).toBeNull();
    expect(toMoneyString('')).toBeNull();
    expect(toMoneyString(null)).toBeNull();
  });
});

describe('applyPercent', () => {
  it('aplica acrescimo arredondando ao centavo', () => {
    expect(applyPercent('12.90', 8)).toBe('13.93');
    expect(applyPercent('10.00', 10)).toBe('11.00');
  });

  it('aplica desconto', () => {
    expect(applyPercent('20.00', -15)).toBe('17.00');
  });

  it('percentual zero devolve o mesmo valor', () => {
    expect(applyPercent('15.50', 0)).toBe('15.50');
  });

  it('nunca devolve preco negativo', () => {
    expect(applyPercent('10.00', -200)).toBe('0.00');
  });

  it('arredonda meio centavo para cima', () => {
    // 9.99 * 1.005 = 10.03995 -> 10.04
    expect(applyPercent('9.99', 0.5)).toBe('10.04');
  });

  it('rejeita base invalida', () => {
    expect(applyPercent('abc', 10)).toBeNull();
  });
});

describe('formatBRL', () => {
  it('formata para exibicao', () => {
    expect(formatBRL('12.90')).toBe('R$ 12,90');
    expect(formatBRL(null)).toBe('-');
  });
});
