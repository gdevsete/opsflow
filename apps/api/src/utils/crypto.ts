import crypto from 'node:crypto';
import argon2 from 'argon2';
import { env } from '../config/env.js';

const KEY_BUFFER = Buffer.from(env.PII_ENCRYPTION_KEY, 'hex');
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export async function hashPassword(plainPassword: string): Promise<string> {
  return argon2.hash(plainPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(hash: string, plainPassword: string): Promise<boolean> {
  return argon2.verify(hash, plainPassword);
}

/**
 * Encrypts sensitive PII (e.g. tax ID / CPF / SSN) using AES-256-GCM before storage.
 */
export function encryptPii(plaintext: string): Buffer {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY_BUFFER, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]);
}

export function decryptPii(payload: Buffer): string {
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY_BUFFER, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Deterministic HMAC-SHA256 blind index for searching encrypted documents without decrypting rows.
 */
export function computeBlindIndex(value: string): string {
  const normalized = value.replace(/\D/g, '');
  return crypto.createHmac('sha256', KEY_BUFFER).update(normalized).digest('hex');
}
