import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { validateDevelopmentDbConfig } from '../../../apps/server/storage/development-config.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { hashPassword } from '../../../apps/server/modules/access/service.ts';
import { buildApp } from '../../../apps/server/app.ts';

test('실제 초안 저장은 동시 중복1회·소유 client·stale/본문 충돌을 집행하고 새 연결에서도 재조회된다', async () => {
  if (!process.env.ANVIL_DB_CONFIG || !process.env.ANVIL_QA_CLEANUP_CONFIG) throw Error('ACTUAL_PROTECTED_DB_AND_EXACT_QA_CLEANUP_REQUIRED');
  const config = validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG, 'utf8')), 'app');
  const pool = new Pool(config);
  const cleanup = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_QA_CLEANUP_CONFIG, 'utf8')), 'migrator'));
  const ids = [randomUUID(), randomUUID()], key = randomBytes(32), password = randomBytes(32).toString('base64url');
  const ownedUsers: string[] = [];
  const access = new AccessRepository(pool, { installationId: randomUUID(), key });
  const app = buildApp({}, undefined, { repository: access, origin: 'https://localhost:3830' });
  let draftId: string | undefined;
  try {
    const phc = await hashPassword(password);
    for (const id of ids) {
      await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'FN01 초안 QA','ACTIVE')", [id, 'qa-draft-' + id]);
      ownedUsers.push(id);
      await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)', [id, phc]);
    }
    const session = await access.login('qa-draft-' + ids[0], password, 'FN01 draft QA', 'qa-draft-' + ids[0]);
    const other = await access.login('qa-draft-' + ids[1], password, 'FN01 draft QA', 'qa-draft-' + ids[1]);
    const headers = { host: 'localhost:3830', origin: 'https://localhost:3830', cookie: '__Host-anvil.sid=' + session.token, 'x-anvil-csrf': session.csrfToken };
    const input = { name: 'Anvil QA', purpose: '', desiredOutcome: '프로젝트 원본', sourceMode: 'EMPTY' };
    const createBody = { schemaVersion: 1, commandId: randomUUID(), clientId: session.clientId, targetId: null, expectedVersion: 0, ...input };
    const creates = await Promise.all([app.inject({ method: 'POST', url: '/api/v1/project-drafts', headers, payload: createBody }), app.inject({ method: 'POST', url: '/api/v1/project-drafts', headers, payload: createBody })]);
    assert.equal(creates[0]!.statusCode, 201); assert.equal(creates[1]!.statusCode, 201);
    draftId = creates[0]!.json().draftId;
    assert.equal(creates[1]!.json().draftId, draftId);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM anvil.project_drafts WHERE owner_user_id=$1', [ids[0]])).rows[0].count, 1);
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/project-drafts', headers, payload: { ...createBody, name: '다른 요청' } })).statusCode, 409);
    const path = '/api/v1/project-drafts/' + draftId;
    assert.equal((await app.inject({ method: 'GET', url: path, headers: { ...headers, cookie: '__Host-anvil.sid=' + other.token } })).statusCode, 404);
    const nextInput = { ...input, purpose: '원래 목적', methodologySelection: null, artifactRefs: [] };
    const patch = { schemaVersion: 1, commandId: randomUUID(), clientId: session.clientId, expectedVersion: 1, step: 1, input: nextInput };
    assert.equal((await app.inject({ method: 'PATCH', url: path, headers, payload: { ...patch, clientId: other.clientId } })).statusCode, 403);
    const updated = await app.inject({ method: 'PATCH', url: path, headers, payload: patch });
    assert.equal(updated.statusCode, 200); assert.equal(updated.json().version, 2);
    assert.equal((await app.inject({ method: 'PATCH', url: path, headers, payload: patch })).json().version, 2);
    assert.equal((await app.inject({ method: 'PATCH', url: path, headers, payload: { ...patch, commandId: randomUUID() } })).statusCode, 409);
    const secondPool = new Pool(config), secondApp = buildApp({}, undefined, { repository: new AccessRepository(secondPool, { installationId: randomUUID(), key }), origin: 'https://localhost:3830' });
    try {
      const result = await secondApp.inject({ method: 'GET', url: path, headers });
      assert.equal(result.statusCode, 200); assert.equal(result.json().version, 2); assert.deepEqual(result.json().input, nextInput);
    } finally { await secondApp.close(); await secondPool.end(); }
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM anvil.draft_audit_events WHERE draft_id=$1', [draftId])).rows[0].count, 2);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM anvil.projects WHERE name=$1', [input.name])).rows[0].count, 0, '초안 저장은 최종 프로젝트/Agent 실행이 아니다');
  } finally {
    await app.close();
    // QA 전용 migrator로 이번 무작위 사용자 소유 초안만 정확 회수한다.
    // 제품 app 역할의 append 감사 UPDATE/DELETE 금지는 그대로다.
    const db = await cleanup.connect();
    try {
      await db.query('BEGIN'); await db.query('SET CONSTRAINTS ALL DEFERRED');
      const drafts = (await db.query('SELECT id FROM anvil.project_drafts WHERE owner_user_id=ANY($1::uuid[])', [ownedUsers])).rows.map(row => row.id);
      await db.query('DELETE FROM anvil.draft_audit_events WHERE draft_id=ANY($1::uuid[])', [drafts]);
      await db.query('UPDATE anvil.commands SET authorization_receipt_id=NULL WHERE draft_id=ANY($1::uuid[])', [drafts]);
      await db.query('DELETE FROM anvil.authorization_receipts WHERE command_id IN (SELECT id FROM anvil.commands WHERE draft_id=ANY($1::uuid[]))', [drafts]);
      await db.query('DELETE FROM anvil.commands WHERE draft_id=ANY($1::uuid[])', [drafts]);
      await db.query('DELETE FROM anvil.project_drafts WHERE id=ANY($1::uuid[])', [drafts]);
      for (const id of ownedUsers) {
        await db.query('DELETE FROM anvil.auth_sessions WHERE user_id=$1', [id]); await db.query('DELETE FROM anvil.clients WHERE user_id=$1', [id]);
        await db.query('DELETE FROM anvil.password_credentials WHERE user_id=$1', [id]); await db.query('DELETE FROM anvil.users WHERE id=$1', [id]);
      }
      await db.query('COMMIT');
    } catch (error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM anvil.project_drafts WHERE owner_user_id=ANY($1::uuid[])', [ownedUsers])).rows[0].count, 0);
    await pool.end(); await cleanup.end();
  }
});
