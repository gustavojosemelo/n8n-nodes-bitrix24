/**
 * Precos circulam como string decimal com 2 casas ("12.90") entre banco,
 * app e Shopify. Nunca como float: arredondamento em recorrencia e um dos
 * riscos que a decisao de arquitetura evita.
 */

export function toMoneyString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;

  const raw = typeof value === 'string' ? value.replace(',', '.').trim() : String(value);
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;

  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0) return null;

  return num.toFixed(2);
}

/**
 * Aplica um percentual sobre um preco base ("Aplicar % sobre outra regiao").
 * Arredonda para o centavo mais proximo, com meio para cima.
 */
export function applyPercent(base: string, percent: number): string | null {
  const value = toMoneyString(base);
  if (value === null || !Number.isFinite(percent)) return null;

  const cents = Math.round(Number(value) * 100);
  const result = Math.round((cents * (100 + percent)) / 100);

  return (Math.max(result, 0) / 100).toFixed(2);
}

/** Formata para exibicao em pt-BR: "12.90" -> "R$ 12,90". */
export function formatBRL(value: unknown): string {
  const money = toMoneyString(value);
  if (money === null) return '-';
  return `R$ ${money.replace('.', ',')}`;
}
