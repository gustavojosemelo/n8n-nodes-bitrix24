/**
 * Cliente da API do admin.
 *
 * Toda chamada leva o session token do App Bridge no Authorization. O token
 * dura 1 minuto, entao e pedido a cada requisicao (o App Bridge cacheia
 * internamente e so renova quando precisa).
 */

declare global {
  interface Window {
    shopify?: {
      idToken: () => Promise<string>;
      toast?: { show: (message: string, options?: { isError?: boolean }) => void };
    };
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  if (window.shopify?.idToken) {
    const token = await window.shopify.idToken();
    return { Authorization: `Bearer ${token}` };
  }

  // Fora do admin da Shopify (dev local): o backend aceita x-dev-shop quando
  // ALLOW_DEV_AUTH=true.
  const devShop = new URLSearchParams(window.location.search).get('shop');
  return devShop ? { 'x-dev-shop': devShop } : {};
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(await authHeaders()),
  };

  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  const parsed = text ? safeJson(text) : null;

  if (!response.ok) {
    const message =
      (parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as { error: unknown }).error)
        : null) ?? `Erro ${response.status}`;
    throw new ApiError(response.status, message, parsed);
  }

  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
};

export function toast(message: string, isError = false): void {
  if (window.shopify?.toast) {
    window.shopify.toast.show(message, { isError });
  } else {
    // eslint-disable-next-line no-console
    console[isError ? 'error' : 'log'](message);
  }
}
