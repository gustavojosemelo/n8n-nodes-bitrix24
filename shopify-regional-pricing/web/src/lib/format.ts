/** Mascara de CEP para digitacao: 58400000 -> 58400-000. */
export function maskCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Aceita "12,90" e "12.90"; devolve sempre com ponto. */
export function normalizePriceInput(value: string): string {
  return value.replace(/[^\d.,]/g, '').replace(',', '.');
}

export function formatBRL(value: string | null): string {
  if (!value) return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

export function describeMatcher(m: {
  type: string;
  cepStart?: string | null;
  cepEnd?: string | null;
  city?: string | null;
  state?: string | null;
}): string {
  if (m.type === 'cep_exact') return `CEP ${maskCep(m.cepStart ?? '')}`;
  if (m.type === 'cep_range') return `CEP ${maskCep(m.cepStart ?? '')} a ${maskCep(m.cepEnd ?? '')}`;
  return `Cidade: ${m.city ?? ''}${m.state ? `/${m.state}` : ''}`;
}
