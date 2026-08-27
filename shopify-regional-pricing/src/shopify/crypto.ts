import crypto from 'node:crypto';

/** Comparacao em tempo constante, tolerante a tamanhos diferentes. */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function hmacHex(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

export function hmacBase64(secret: string, payload: Buffer | string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64');
}

/**
 * HMAC do OAuth (install e callback).
 * A Shopify assina a query string ordenada, sem os campos `hmac` e `signature`,
 * no formato `k=v` unido por `&`.
 */
export function verifyOAuthHmac(
  query: Record<string, unknown>,
  secret: string,
): boolean {
  const provided = typeof query.hmac === 'string' ? query.hmac : '';
  if (!provided) return false;

  const message = Object.keys(query)
    .filter((key) => key !== 'hmac' && key !== 'signature')
    .sort()
    .map((key) => {
      const value = query[key];
      const flat = Array.isArray(value) ? value.join(',') : String(value ?? '');
      return `${key}=${flat}`;
    })
    .join('&');

  return safeCompare(hmacHex(secret, message), provided);
}

/**
 * Assinatura do App Proxy.
 * Diferente do OAuth: os pares ordenados sao concatenados SEM separador,
 * e valores repetidos viram lista separada por virgula.
 */
export function verifyAppProxySignature(
  query: Record<string, unknown>,
  secret: string,
): boolean {
  const provided = typeof query.signature === 'string' ? query.signature : '';
  if (!provided) return false;

  const message = Object.keys(query)
    .filter((key) => key !== 'signature')
    .sort()
    .map((key) => {
      const value = query[key];
      const flat = Array.isArray(value) ? value.join(',') : String(value ?? '');
      return `${key}=${flat}`;
    })
    .join('');

  return safeCompare(hmacHex(secret, message), provided);
}

/** HMAC de webhook: base64 do corpo CRU (nao do JSON reserializado). */
export function verifyWebhookHmac(
  rawBody: Buffer | string,
  headerValue: string | undefined,
  secret: string,
): boolean {
  if (!headerValue) return false;
  return safeCompare(hmacBase64(secret, rawBody), headerValue);
}

// ---------------------------------------------------------------------------
// Session token do App Bridge (JWT HS256 assinado com o API secret)
// ---------------------------------------------------------------------------

export interface SessionTokenPayload {
  iss: string; // https://loja.myshopify.com/admin
  dest: string; // https://loja.myshopify.com
  aud: string; // API key do app
  sub: string; // user id
  exp: number;
  nbf: number;
  iat: number;
  jti: string;
  sid: string;
}

export class SessionTokenError extends Error {}

function base64UrlDecode(segment: string): Buffer {
  return Buffer.from(segment, 'base64url');
}

/**
 * Valida assinatura, expiracao e destinatario do session token.
 * Lanca SessionTokenError com motivo legivel quando invalido.
 */
export function verifySessionToken(
  token: string,
  apiKey: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): SessionTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new SessionTokenError('token malformado');

  const [headerSeg, payloadSeg, signatureSeg] = parts as [string, string, string];

  let header: { alg?: string; typ?: string };
  let payload: SessionTokenPayload;
  try {
    header = JSON.parse(base64UrlDecode(headerSeg).toString('utf8'));
    payload = JSON.parse(base64UrlDecode(payloadSeg).toString('utf8'));
  } catch {
    throw new SessionTokenError('token nao decodificavel');
  }

  if (header.alg !== 'HS256') throw new SessionTokenError('algoritmo nao suportado');

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${headerSeg}.${payloadSeg}`, 'utf8')
    .digest('base64url');

  if (!safeCompare(expected, signatureSeg)) {
    throw new SessionTokenError('assinatura invalida');
  }

  // Tolerancia de relogio de 5s, como faz a lib oficial.
  const leeway = 5;
  if (typeof payload.exp !== 'number' || payload.exp + leeway < nowSeconds) {
    throw new SessionTokenError('token expirado');
  }
  if (typeof payload.nbf === 'number' && payload.nbf - leeway > nowSeconds) {
    throw new SessionTokenError('token ainda nao valido');
  }
  if (payload.aud !== apiKey) throw new SessionTokenError('aud nao confere com a API key');
  if (!payload.dest || !payload.dest.startsWith('https://')) {
    throw new SessionTokenError('dest ausente');
  }

  return payload;
}

/** Extrai "loja.myshopify.com" do campo dest do session token. */
export function shopFromDest(dest: string): string | null {
  try {
    const url = new URL(dest);
    return isValidShopDomain(url.host) ? url.host : null;
  } catch {
    return null;
  }
}

const SHOP_DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,60}\.myshopify\.com$/;

export function isValidShopDomain(shop: unknown): shop is string {
  return typeof shop === 'string' && SHOP_DOMAIN_RE.test(shop);
}

/** Assina um valor curto (state do OAuth) para trafegar em cookie. */
export function signValue(value: string, secret: string): string {
  return `${value}.${hmacHex(secret, value)}`;
}

export function unsignValue(signed: string, secret: string): string | null {
  const index = signed.lastIndexOf('.');
  if (index <= 0) return null;
  const value = signed.slice(0, index);
  const signature = signed.slice(index + 1);
  return safeCompare(hmacHex(secret, value), signature) ? value : null;
}
