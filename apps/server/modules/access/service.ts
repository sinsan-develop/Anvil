import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';

const memory = 19 * 1024;
const passes = 2;
let activeHashes = 0;
function passwordValid(value: string): boolean {
  return typeof value === 'string' && value.isWellFormed() && [...value].length >= 15 && [...value].length <= 128;
}
async function derive(password: string, salt: Buffer): Promise<Buffer> {
  if (activeHashes >= 2) throw Error('AUTH_CAPACITY_REACHED');
  activeHashes++;
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      argon2('argon2id', { message: password, nonce: salt, memory, passes, parallelism: 1, tagLength: 32 }, (error, key) => {
        if (error) reject(Error('PASSWORD_HASH_UNAVAILABLE'));
        else resolve(key);
      });
    });
  } finally { activeHashes--; }
}
export async function hashPassword(password: string): Promise<string> {
  if (!passwordValid(password)) throw Error('PASSWORD_POLICY');
  const salt = randomBytes(16);
  const tag = await derive(password, salt);
  return `$argon2id$v=19$m=${memory},t=${passes},p=1$${salt.toString('base64').replace(/=+$/, '')}$${tag.toString('base64').replace(/=+$/, '')}`;
}
export async function verifyPassword(password: string, phc: string): Promise<boolean> {
  if (!passwordValid(password) || typeof phc !== 'string') return false;
  const match = /^\$argon2id\$v=19\$m=19456,t=2,p=1\$([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$/.exec(phc);
  if (!match) return false;
  const salt = Buffer.from(match[1]!, 'base64');
  const expected = Buffer.from(match[2]!, 'base64');
  if (salt.toString('base64').replace(/=+$/, '') !== match[1] || expected.toString('base64').replace(/=+$/, '') !== match[2]) return false;
  return timingSafeEqual(await derive(password, salt), expected);
}
export interface SessionState { idleExpiresAt: Date; absoluteExpiresAt: Date; revokedAt: Date | null; userRevokedAt: Date | null; clientRevokedAt: Date | null; credentialGeneration: number; currentCredentialGeneration: number }
export function sessionIsActive(state: SessionState, now: Date): boolean {
  return !state.revokedAt && !state.userRevokedAt && !state.clientRevokedAt && state.credentialGeneration > 0 && state.credentialGeneration === state.currentCredentialGeneration && state.idleExpiresAt.getTime() > now.getTime() && state.absoluteExpiresAt.getTime() > now.getTime();
}
