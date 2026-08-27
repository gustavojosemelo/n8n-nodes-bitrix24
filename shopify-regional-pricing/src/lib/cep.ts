/**
 * Normalizacao e validacao de CEP brasileiro.
 * Regra do app: internamente o CEP e sempre uma string de 8 digitos.
 */

/** Remove tudo que nao for digito e valida os 8 digitos. Retorna null se invalido. */
export function normalizeCep(input: unknown): string | null {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  const digits = String(input).replace(/\D/g, '');
  if (digits.length !== 8) return null;
  return digits;
}

/** "58400000" -> "58400-000". Entrada invalida volta como veio. */
export function formatCep(cep: string): string {
  const normalized = normalizeCep(cep);
  if (!normalized) return cep;
  return `${normalized.slice(0, 5)}-${normalized.slice(5)}`;
}

/** CEP para inteiro, permitindo comparacao de faixa. */
export function cepToNumber(cep: string): number | null {
  const normalized = normalizeCep(cep);
  return normalized === null ? null : Number(normalized);
}

/**
 * Aceita uma faixa mesmo que o operador digite o "de" maior que o "ate":
 * a ordem e corrigida em vez de rejeitada.
 */
export function normalizeCepRange(
  start: unknown,
  end: unknown,
): { start: string; end: string } | null {
  const a = normalizeCep(start);
  const b = normalizeCep(end);
  if (!a || !b) return null;
  return Number(a) <= Number(b) ? { start: a, end: b } : { start: b, end: a };
}

/** Remove acentos e normaliza caixa/espacos, para comparar nomes de cidade. */
export function normalizeCity(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Sigla de UF em caixa alta, ou string vazia. */
export function normalizeState(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase();
}
