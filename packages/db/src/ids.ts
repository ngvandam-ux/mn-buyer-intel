import { createHash, randomUUID } from 'node:crypto';

/** Generate a UUID for cases where a client-side id is needed (seeding, evidence links). */
export function newId(): string {
  return randomUUID();
}

/** SHA-256 hex of a string. */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
