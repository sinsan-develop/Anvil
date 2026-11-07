import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { generateAuthBundle, persistNewAuthFiles } from '../../../apps/server/modules/access/setup.ts';
import { validateAuthConfig } from '../../../apps/server/modules/access/config.ts';

test('서버 key와 30분 일회 비밀은 독립하고 기존 보호 파일을 덮어쓰지 않는다', async () => {
  const now = new Date('2026-10-16T12:00:00Z');
  const bundle = generateAuthBundle(now);
  assert.equal(validateAuthConfig(bundle.auth).key.length, 32);
  assert.equal(bundle.bootstrap.installationId, bundle.auth.installationId);
  assert.match(bundle.bootstrap.bootstrapSecret, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(bundle.bootstrap.bootstrapSecret, bundle.auth.fingerprintKey);
  assert.equal(Date.parse(bundle.bootstrap.expiresAt) - now.getTime(), 30 * 60_000);
  assert.equal(bundle.bootstrapDigest, createHash('sha256').update(bundle.bootstrap.bootstrapSecret).digest('hex'));
  assert.equal('bootstrapSecret' in bundle.auth, false);
  assert.equal('fingerprintKey' in bundle.bootstrap, false);
  const parent = 'D:/tmp/anvil-v3-stage-b/auth-init';
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(join(parent, 'owned-'));
  try {
    const release = await persistNewAuthFiles(root, bundle);
    assert.deepEqual(JSON.parse(await readFile(join(root, 'auth.json'), 'utf8')), bundle.auth);
    await assert.rejects(persistNewAuthFiles(root, generateAuthBundle(now)), /AUTH_FILES_ALREADY_EXIST/);
    assert.deepEqual(JSON.parse(await readFile(join(root, 'auth.json'), 'utf8')), bundle.auth);
    await release();
    assert.deepEqual(await readdir(root), []);
    await writeFile(join(root, 'bootstrap.json'), 'user-owned', { flag: 'wx' });
    await assert.rejects(persistNewAuthFiles(root, bundle), /AUTH_FILES_ALREADY_EXIST/);
    assert.deepEqual(await readdir(root), ['bootstrap.json']);
    assert.equal(await readFile(join(root, 'bootstrap.json'), 'utf8'), 'user-owned');
  } finally { await rm(root, { recursive: true }); }
});
