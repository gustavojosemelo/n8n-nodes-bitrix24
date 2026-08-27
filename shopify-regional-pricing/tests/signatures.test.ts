import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  isValidShopDomain,
  shopFromDest,
  signValue,
  unsignValue,
  verifyAppProxySignature,
  verifyOAuthHmac,
  verifySessionToken,
  verifyWebhookHmac,
  SessionTokenError,
} from '../src/shopify/crypto';

const SECRET = 'segredo-de-teste-do-app';

function hex(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload, 'utf8').digest('hex');
}

describe('verifyOAuthHmac', () => {
  it('valida a query assinada pela Shopify', () => {
    const query: Record<string, string> = {
      code: 'abc123',
      shop: 'loja.myshopify.com',
      state: 'xyz',
      timestamp: '1700000000',
    };
    const message = Object.keys(query)
      .sort()
      .map((k) => `${k}=${query[k]}`)
      .join('&');

    expect(verifyOAuthHmac({ ...query, hmac: hex(message) }, SECRET)).toBe(true);
  });

  it('recusa quando um parametro foi alterado', () => {
    const query: Record<string, string> = { shop: 'loja.myshopify.com', timestamp: '1' };
    const message = 'shop=loja.myshopify.com&timestamp=1';
    const signed = { ...query, hmac: hex(message) };

    expect(verifyOAuthHmac({ ...signed, shop: 'outra.myshopify.com' }, SECRET)).toBe(false);
  });

  it('recusa sem hmac', () => {
    expect(verifyOAuthHmac({ shop: 'loja.myshopify.com' }, SECRET)).toBe(false);
  });
});

describe('verifyAppProxySignature', () => {
  it('concatena os pares SEM separador, diferente do OAuth', () => {
    const query: Record<string, string> = {
      shop: 'loja.myshopify.com',
      path_prefix: '/apps/regional-pricing',
      timestamp: '1700000000',
    };
    const message = Object.keys(query)
      .sort()
      .map((k) => `${k}=${query[k]}`)
      .join('');

    expect(verifyAppProxySignature({ ...query, signature: hex(message) }, SECRET)).toBe(true);

    // A regra do OAuth (com &) nao pode validar aqui.
    const oauthStyle = Object.keys(query)
      .sort()
      .map((k) => `${k}=${query[k]}`)
      .join('&');
    expect(verifyAppProxySignature({ ...query, signature: hex(oauthStyle) }, SECRET)).toBe(false);
  });

  it('junta valores repetidos com virgula', () => {
    const message = 'ids=1,2shop=loja.myshopify.com';
    expect(
      verifyAppProxySignature(
        { ids: ['1', '2'], shop: 'loja.myshopify.com', signature: hex(message) },
        SECRET,
      ),
    ).toBe(true);
  });

  it('recusa assinatura ausente ou errada', () => {
    expect(verifyAppProxySignature({ shop: 'loja.myshopify.com' }, SECRET)).toBe(false);
    expect(
      verifyAppProxySignature({ shop: 'loja.myshopify.com', signature: 'deadbeef' }, SECRET),
    ).toBe(false);
  });
});

describe('verifyWebhookHmac', () => {
  it('valida sobre o corpo cru em base64', () => {
    const raw = Buffer.from('{"id":123,"title":"Galao 20L"}', 'utf8');
    const digest = crypto.createHmac('sha256', SECRET).update(raw).digest('base64');

    expect(verifyWebhookHmac(raw, digest, SECRET)).toBe(true);
  });

  it('recusa quando o corpo foi reserializado', () => {
    const raw = Buffer.from('{"id":123,"title":"Galao 20L"}', 'utf8');
    const digest = crypto.createHmac('sha256', SECRET).update(raw).digest('base64');
    const reserialized = Buffer.from(JSON.stringify({ title: 'Galao 20L', id: 123 }), 'utf8');

    expect(verifyWebhookHmac(reserialized, digest, SECRET)).toBe(false);
  });

  it('recusa sem header', () => {
    expect(verifyWebhookHmac(Buffer.from('{}'), undefined, SECRET)).toBe(false);
  });
});

describe('verifySessionToken', () => {
  const API_KEY = 'api-key-do-app';

  function makeToken(payload: Record<string, unknown>, secret = SECRET, alg = 'HS256'): string {
    const header = Buffer.from(JSON.stringify({ alg, typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${body}`, 'utf8')
      .digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  const now = 1_700_000_000;
  const validPayload = {
    iss: 'https://loja.myshopify.com/admin',
    dest: 'https://loja.myshopify.com',
    aud: API_KEY,
    sub: '1',
    exp: now + 60,
    nbf: now - 10,
    iat: now,
    jti: 'j',
    sid: 's',
  };

  it('aceita um token valido', () => {
    const payload = verifySessionToken(makeToken(validPayload), API_KEY, SECRET, now);
    expect(payload.dest).toBe('https://loja.myshopify.com');
    expect(shopFromDest(payload.dest)).toBe('loja.myshopify.com');
  });

  it('recusa assinatura de outro segredo', () => {
    expect(() =>
      verifySessionToken(makeToken(validPayload, 'outro-segredo'), API_KEY, SECRET, now),
    ).toThrow(SessionTokenError);
  });

  it('recusa token expirado', () => {
    expect(() => verifySessionToken(makeToken(validPayload), API_KEY, SECRET, now + 3600)).toThrow(
      /expirado/,
    );
  });

  it('recusa aud de outro app', () => {
    expect(() =>
      verifySessionToken(makeToken({ ...validPayload, aud: 'outro-app' }), API_KEY, SECRET, now),
    ).toThrow(/aud/);
  });

  it('recusa alg none', () => {
    expect(() =>
      verifySessionToken(makeToken(validPayload, SECRET, 'none'), API_KEY, SECRET, now),
    ).toThrow(/algoritmo/);
  });

  it('recusa token malformado', () => {
    expect(() => verifySessionToken('nao-e-jwt', API_KEY, SECRET, now)).toThrow(/malformado/);
  });
});

describe('isValidShopDomain', () => {
  it('aceita apenas dominios myshopify.com', () => {
    expect(isValidShopDomain('loja.myshopify.com')).toBe(true);
    expect(isValidShopDomain('minha-loja-123.myshopify.com')).toBe(true);
    expect(isValidShopDomain('loja.myshopify.com.evil.com')).toBe(false);
    expect(isValidShopDomain('evil.com')).toBe(false);
    expect(isValidShopDomain('loja.myshopify.com/path')).toBe(false);
    expect(isValidShopDomain(undefined)).toBe(false);
  });
});

describe('signValue / unsignValue', () => {
  it('faz o round-trip do state do OAuth', () => {
    const signed = signValue('estado|loja.myshopify.com', SECRET);
    expect(unsignValue(signed, SECRET)).toBe('estado|loja.myshopify.com');
  });

  it('rejeita valor adulterado', () => {
    const signed = signValue('estado', SECRET);
    expect(unsignValue(`adulterado.${signed.split('.').pop()}`, SECRET)).toBeNull();
  });
});
