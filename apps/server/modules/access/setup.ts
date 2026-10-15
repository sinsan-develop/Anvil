import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { lstat, open, readFile, realpath, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { validateAuthConfig } from './config.ts';

export function generateAuthBundle(now: Date) {
  if (!Number.isFinite(now.getTime())) throw Error('AUTH_INITIALIZATION_TIME_INVALID');
  const installationId = randomUUID(), bootstrapSecret = randomBytes(32).toString('base64url');
  return {
    auth: { kind: 'ANVIL_AUTH_KEY_V1', installationId, fingerprintKey: randomBytes(32).toString('hex'), origin: 'https://localhost:3830' },
    bootstrap: { kind: 'ANVIL_BOOTSTRAP_V1', installationId, bootstrapSecret, expiresAt: new Date(now.getTime() + 30 * 60_000).toISOString() },
    bootstrapDigest: createHash('sha256').update(bootstrapSecret).digest('hex'),
  };
}

export async function persistNewAuthFiles(root: string, bundle: ReturnType<typeof generateAuthBundle>): Promise<() => Promise<void>> {
  validateAuthConfig(bundle.auth);
  const normalize = (v: string) => process.platform === 'win32' ? v.toLowerCase() : v;
  if (!(await lstat(root)).isDirectory() || normalize(await realpath(root)) !== normalize(resolve(root))) throw Error('AUTH_ROOT_INVALID');
  const files = [['auth.json', bundle.auth], ['bootstrap.json', bundle.bootstrap]] as const;
  for (const [name] of files) {
    try { await lstat(join(root, name)); throw Error('AUTH_FILES_ALREADY_EXIST'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  const owned: { path: string; text: string; ino: number; dev: number }[] = [];
  const release = async () => {
    for (const file of [...owned].reverse()) {
      const current = await lstat(file.path);
      if (!current.isFile() || current.ino !== file.ino || current.dev !== file.dev || await readFile(file.path, 'utf8') !== file.text) throw Error('AUTH_OWNED_FILE_CHANGED_PRESERVED');
      await unlink(file.path);
    }
    owned.length = 0;
  };
  try {
    for (const [name, value] of files) {
      const path = join(root, name), text = JSON.stringify(value) + '\n';
      const handle = await open(path, 'wx', 0o600);
      try {
        const stat = await handle.stat();
        owned.push({ path, text, ino: stat.ino, dev: stat.dev });
        await handle.writeFile(text); await handle.sync();
      } finally { await handle.close(); }
    }
    return release;
  } catch {
    await release();
    throw Error('AUTH_FILES_CREATE_FAILED');
  }
}
