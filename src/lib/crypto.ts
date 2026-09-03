import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '@/lib/env';

/**
 * Integration tokens are encrypted at rest with a key separate from the
 * database credentials. AES-256-GCM, random IV per value, tag appended.
 * Format: v1.<iv-b64>.<tag-b64>.<ciphertext-b64>
 */
function key(): Buffer {
  const raw = env.encryptionKey;
  if (!raw) throw new Error('ENCRYPTION_KEY is not configured.');
  return createHash('sha256').update(raw).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    enc.toString('base64'),
  ].join('.');
}

export function decrypt(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split('.');
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Stored token is not in the expected format.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
