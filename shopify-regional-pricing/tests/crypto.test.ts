import crypto from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetConfigCache } from '../src/config';
import { decryptSecret, encryptSecret, resetKeyCache } from '../src/db/crypto';

const KEY_HEX = crypto.randomBytes(32).toString('hex');

function setupEnv(key: string): void {
  process.env.SHOPIFY_API_KEY = 'k';
  process.env.SHOPIFY_API_SECRET = 's';
  process.env.SHOPIFY_APP_URL = 'https://app.exemplo.com';
  process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
  process.env.SESSION_SECRET = 'x'.repeat(32);
  process.env.ENCRYPTION_KEY = key;
  process.env.NODE_ENV = 'test';
  resetConfigCache();
  resetKeyCache();
}

describe('encryptSecret / decryptSecret', () => {
  beforeEach(() => setupEnv(KEY_HEX));

  it('faz round-trip do access token', () => {
    const token = 'shpat_' + crypto.randomBytes(16).toString('hex');
    const encrypted = encryptSecret(token);

    expect(encrypted).not.toContain(token);
    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(decryptSecret(encrypted)).toBe(token);
  });

  it('gera ciphertext diferente a cada chamada (IV aleatorio)', () => {
    expect(encryptSecret('mesmo-valor')).not.toBe(encryptSecret('mesmo-valor'));
  });

  it('recusa payload adulterado (AEAD)', () => {
    const encrypted = encryptSecret('token');
    const parts = encrypted.split(':');
    const tampered = Buffer.from(parts[3] as string, 'base64url');
    tampered[0] = (tampered[0] as number) ^ 0xff;
    parts[3] = tampered.toString('base64url');

    expect(() => decryptSecret(parts.join(':'))).toThrow();
  });

  it('recusa formato desconhecido', () => {
    expect(() => decryptSecret('texto-puro')).toThrow(/formato desconhecido/);
  });

  it('aceita chave em base64', () => {
    setupEnv(Buffer.from(KEY_HEX, 'hex').toString('base64'));
    expect(decryptSecret(encryptSecret('abc'))).toBe('abc');
  });

  it('rejeita chave de tamanho errado', () => {
    setupEnv('curta-demais');
    expect(() => encryptSecret('abc')).toThrow(/ENCRYPTION_KEY invalida/);
  });
});
