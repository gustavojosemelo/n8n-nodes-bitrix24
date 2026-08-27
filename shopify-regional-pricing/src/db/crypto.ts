import crypto from 'node:crypto';
import { getConfig } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const PREFIX = 'v1';

function loadKey(raw: string): Buffer {
  const hex = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, 'hex');

  const b64 = Buffer.from(hex, 'base64');
  if (b64.length === 32) return b64;

  throw new Error(
    'ENCRYPTION_KEY invalida: informe 32 bytes em hex (64 chars) ou base64. ' +
      'Gere com: openssl rand -hex 32',
  );
}

let keyCache: Buffer | null = null;

function key(): Buffer {
  if (!keyCache) keyCache = loadKey(getConfig().ENCRYPTION_KEY);
  return keyCache;
}

/** Criptografa um segredo em repouso. Formato: v1:<iv>:<tag>:<ciphertext> (base64url). */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error('Payload criptografado em formato desconhecido');
  }

  const iv = Buffer.from(parts[1] as string, 'base64url');
  const tag = Buffer.from(parts[2] as string, 'base64url');
  const ciphertext = Buffer.from(parts[3] as string, 'base64url');

  const decipher = crypto.createDecipheriv(ALGORITHM, key(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** Apenas para testes. */
export function resetKeyCache(): void {
  keyCache = null;
}
