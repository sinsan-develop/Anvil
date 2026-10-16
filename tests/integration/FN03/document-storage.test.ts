import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, mkdir, rm, lstat, realpath, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { validateDevelopmentDbConfig } from '../../../apps/server/storage/development-config.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { hashPassword } from '../../../apps/server/modules/access/service.ts';
import { buildApp } from '../../../apps/server/app.ts';

test('문서 원문 파일은 명시 정책/현재 제어 아래 바이트 그대로 저장·재조회되고 격리·단절·변조를 성공으로 숨기지 않는다', async () => {
  if (!process.env.ANVIL_DB_CONFIG || !process.env.ANVIL_MIGRATOR_CONFIG) throw Error('ACTUAL_PROTECTED_DB_REQUIRED_NOT_SKIP');
  const pool = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG, 'utf8')), 'app'));
  const admin = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_MIGRATOR_CONFIG, 'utf8')), 'migrator'));
  const user = randomUUID(), project = randomUUID(), outsider = randomUUID(), root = join(tmpdir(), 'anvil-v3-document-qa-' + user);
  const access = new AccessRepository(pool, { installationId: randomUUID(), key: randomBytes(32) });
  const options = { repository: access, origin: 'https://localhost:3830', artifactRoot: root };
  const app = buildApp({}, undefined, options); let rootCreated = false, userCreated = false, outsiderCreated = false;
  try {
    await assert.rejects(lstat(root), (error: unknown) => (error as { code: string }).code === 'ENOENT');
    await mkdir(root, { mode: 0o700 }); rootCreated = true;
    const password = randomBytes(32).toString('base64url'), phc = await hashPassword(password);
    for (const id of [user, outsider]) {
      await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'문서 원문 합성 QA','ACTIVE')", [id, 'qa-document-storage-' + id]);
      if (id === user) userCreated = true; else outsiderCreated = true;
      await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)', [id, phc]);
    }
    let login = await access.login('qa-document-storage-' + user, password, '문서 QA', 'qa-document-storage-' + user);
    const other = await access.login('qa-document-storage-' + outsider, password, '격리 QA', 'qa-document-storage-' + outsider);
    await admin.query("INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,'문서 원문 QA','사용자가 소유한 자료','원본 바이트 유지')", [project]);
    await admin.query("INSERT INTO anvil.project_members(project_id,user_id,participation) VALUES($1,$2,'OWNER')", [project, user]);
    await admin.query('INSERT INTO anvil.project_control(project_id,actor_id,client_id,generation) VALUES($1,$2,$3,1)', [project, user, login.clientId]);
    login = await access.reauthenticate(login.token, login.csrfToken, password, 'qa-document-storage-' + user);
    const headers = { host: 'localhost:3830', origin: 'https://localhost:3830', cookie: '__Host-anvil.sid=' + login.token, 'x-anvil-csrf': login.csrfToken };
    const bytes = Buffer.from('\uFEFF# 요구사항\r\n\r\n사용자의 원본  \r\n<script>window.QA_SHOULD_NOT_RUN=1</script>\r\n', 'utf8');
    const hash = createHash('sha256').update(bytes).digest('hex');
    const context = { schemaVersion: 1, projectId: project, commandId: randomUUID(), clientId: login.clientId, controlGeneration: 1, operation: 'uploadArtifact', targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload: { mediaType: 'text/markdown;charset=utf-8', bytes: bytes.length, contentHash: hash } };
    const send = (body = context, payload = bytes) => app.inject({ method: 'POST', url: `/api/v1/projects/${project}/files`, headers: { ...headers, 'content-type': 'application/octet-stream', 'x-anvil-command': JSON.stringify(body) }, payload });
    assert.equal((await send()).statusCode, 412, '프로젝트 제어권만으로 파일 저장을 허가하지 않는다');
    assert.equal((await pool.query("SELECT count(*)::int n FROM anvil.audit_events WHERE project_id=$1 AND outcome='DENIED' AND reason_code='PERMISSION_POLICY_UNCONFIGURED'", [project])).rows[0].n, 1, '허가 거절은 본문 저장과 분리된 감사로 남긴다');
    const policy = await app.inject({ method: 'POST', url: `/api/v1/projects/${project}/commands`, headers, payload: { ...context, commandId: randomUUID(), operation: 'savePermissionPolicy', payload: { rules: [{ ruleId: 'WRITE_OWN_FILES', subjectRef: { kind: 'HUMAN', userId: user }, targetScopes: [{ kind: 'PROJECT', projectId: project }], operations: ['uploadArtifact'], disposition: 'AUTO', limitPolicyRef: null, expiresAt: new Date(Date.now() + 3_600_000).toISOString() }], reason: '합성 파일 저장의 명시 허가', reviewRefs: [] } } });
    assert.equal(policy.statusCode, 200, policy.body);
    const upload = await send(); assert.equal(upload.statusCode, 201, upload.body);
    const artifact = upload.json().data.artifactRef;
    assert.deepEqual({ contentHash: artifact.contentHash, bytes: artifact.bytes, mediaType: artifact.mediaType }, context.payload);
    assert.deepEqual((await send()).json(), upload.json(), '원문 업로드 동일 명령은 같은 artifact');
    assert.equal((await send({ ...context, payload: { ...context.payload, contentHash: '0'.repeat(64) } })).statusCode, 422);
    const getPath = `/api/v1/projects/${project}/files/${artifact.artifactId}`;
    const retrieved = await app.inject({ method: 'GET', url: getPath, headers });
    assert.equal(retrieved.statusCode, 200); assert.deepEqual(retrieved.rawPayload, bytes);
    assert.match(retrieved.headers['content-disposition'] as string, /^attachment;/); assert.match(retrieved.headers['content-security-policy'] as string, /default-src 'none'/);
    assert.equal((await app.inject({ method: 'GET', url: getPath, headers: { ...headers, cookie: '__Host-anvil.sid=' + other.token } })).statusCode, 404);
    const stored = (await admin.query('SELECT * FROM anvil.artifacts WHERE id=$1 AND project_id=$2', [artifact.artifactId, project])).rows[0];
    assert.equal(stored.state, 'READY'); assert.equal(stored.storage_key, `blobs/${project}/${artifact.artifactId}`);
    const path = join(root, stored.storage_key); assert.deepEqual(await readFile(path), bytes);
    await rename(path, path + '.qa-preserved');
    try { assert.equal((await app.inject({ method: 'GET', url: getPath, headers })).statusCode, 503, 'DB READY/실파일 누락은 성공이 아니다'); }
    finally { await rename(path + '.qa-preserved', path); }
    assert.equal((await pool.query('SELECT count(*)::int n FROM anvil.artifacts WHERE project_id=$1', [project])).rows[0].n, 1);
    assert.equal((await pool.query('SELECT count(*)::int n FROM anvil.delivery_outbox WHERE project_id=$1', [project])).rows[0].n, 0);
  } finally {
    await app.close(); const owned = [...(userCreated ? [user] : []), ...(outsiderCreated ? [outsider] : [])], db = await admin.connect();
    try {
      await db.query('BEGIN'); await db.query('SET CONSTRAINTS ALL DEFERRED');
      if ((await db.query("SELECT to_regclass('anvil.artifacts') present")).rows[0].present) await db.query('DELETE FROM anvil.artifacts WHERE project_id=$1', [project]);
      await db.query('DELETE FROM anvil.audit_events WHERE project_id=$1', [project]);
      await db.query('UPDATE anvil.permission_policies SET head_version=head_version+1 WHERE project_id=$1', [project]);
      await db.query('DELETE FROM anvil.permission_policy_versions WHERE project_id=$1', [project]);
      await db.query('DELETE FROM anvil.permission_policies WHERE project_id=$1', [project]);
      await db.query('UPDATE anvil.commands SET authorization_receipt_id=NULL WHERE project_id=$1', [project]);
      await db.query("DELETE FROM anvil.authorization_receipts WHERE scope_kind='PROJECT' AND scope_id=$1", [project]);
      await db.query('DELETE FROM anvil.commands WHERE project_id=$1', [project]);
      await db.query('DELETE FROM anvil.project_control WHERE project_id=$1', [project]);
      await db.query('DELETE FROM anvil.project_members WHERE project_id=$1', [project]);
      await db.query('DELETE FROM anvil.projects WHERE id=$1', [project]);
      await db.query('DELETE FROM anvil.auth_audit_events WHERE subject_ref=ANY($1::uuid[])', [owned]);
      for (const table of ['auth_sessions', 'clients', 'password_credentials']) await db.query('DELETE FROM anvil.' + table + ' WHERE user_id=ANY($1::uuid[])', [owned]);
      await db.query('DELETE FROM anvil.users WHERE id=ANY($1::uuid[])', [owned]);
      await db.query('COMMIT');
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally {
      db.release(); await pool.end(); await admin.end();
      if (rootCreated) { const stat = await lstat(root); if (stat.isSymbolicLink() || !stat.isDirectory() || await realpath(root) !== root || root !== join(tmpdir(), 'anvil-v3-document-qa-' + user)) throw Error('QA_ROOT_CHANGED_PRESERVE'); await rm(root, { recursive: true }); }
    }
  }
});
