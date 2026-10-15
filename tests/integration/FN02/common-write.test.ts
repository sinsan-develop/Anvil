import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { validateDevelopmentDbConfig } from '../../../apps/server/storage/development-config.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { hashPassword } from '../../../apps/server/modules/access/service.ts';
import { buildApp } from '../../../apps/server/app.ts';

test('본인 공통 방법론 복사·개정은 원자 저장되고 재전송·타인·구버전·내장 변경을 차단한다', async () => {
  if (!process.env.ANVIL_DB_CONFIG || !process.env.ANVIL_MIGRATOR_CONFIG) throw Error('ACTUAL_PROTECTED_DB_REQUIRED_NOT_SKIP');
  const pool = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG, 'utf8')), 'app'));
  const admin = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_MIGRATOR_CONFIG, 'utf8')), 'migrator'));
  const access = new AccessRepository(pool, { installationId: randomUUID(), key: randomBytes(32) });
  const app = buildApp({}, undefined, { repository: access, origin: 'https://localhost:3830' });
  const users = [randomUUID(), randomUUID()], ids: string[] = [];
  try {
    const sessions = [];
    for (const user of users) {
      const password = randomBytes(32).toString('base64url');
      await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'공통 쓰기 QA','ACTIVE')", [user, 'qa-common-' + user]);
      await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)', [user, await hashPassword(password)]);
      sessions.push(await access.login('qa-common-' + user, password, '공통 쓰기 QA', 'qa-common-' + user));
    }
    const own = sessions[0]!, other = sessions[1]!;
    const headers = { host: 'localhost:3830', origin: 'https://localhost:3830', cookie: '__Host-anvil.sid=' + own.token, 'x-anvil-csrf': own.csrfToken };
    const source = (await app.inject({ method: 'GET', url: '/api/v1/methodologies/a6f20000-0000-4000-8000-000000000001/versions/2', headers })).json();
    const body = { schemaVersion: 1, commandId: randomUUID(), operation: 'copyMethodology', targetId: null, expectedVersion: 0, clientId: own.clientId,
      payload: { sourceRef: source.ref, name: '본인 공통 방법론', scope: 'USER_COMMON', reason: '정확 원본 복사 QA' } };
    const send = (payload: unknown, requestHeaders = headers) => app.inject({ method: 'POST', url: '/api/v1/user-common/commands', headers: { ...requestHeaders, 'content-type': 'application/json' }, payload: JSON.stringify(payload) });
    const created = await send(body);
    assert.equal(created.statusCode, 200, created.body);
    const receipt = created.json(); ids.push(receipt.targetId);
    assert.equal(receipt.scopeKind, 'USER_COMMON'); assert.equal(receipt.ownerUserId, users[0]);
    assert.equal(receipt.status, 'APPLIED'); assert.equal(receipt.data.status, 'DRAFT'); assert.equal(receipt.version, 1);
    assert.equal(receipt.data.ref.contentHash, source.ref.contentHash);
    const duplicates = await Promise.all([send(body), send(body)]);
    for (const duplicate of duplicates) assert.deepEqual(duplicate.json(), receipt);
    assert.equal((await send({ ...body, payload: { ...body.payload, name: '다른 요청' } })).statusCode, 409);
    assert.equal((await send({ ...body, operation: 'saveMethodologyDraft' })).statusCode, 409);
    assert.equal((await send(body, { ...headers, origin: 'https://other.example' })).statusCode, 403);
    assert.equal((await send(body, { ...headers, 'x-anvil-csrf': 'x'.repeat(43) })).statusCode, 403);
    assert.equal((await send({ ...body, commandId: randomUUID(), ownerUserId: users[1] })).statusCode, 400);
    const savedView = (await app.inject({ method: 'GET', url: `/api/v1/methodologies/${receipt.targetId}/versions/1`, headers })).json();
    assert.deepEqual(savedView.graph, source.graph); assert.equal(savedView.sourceApproval.parentRef.contentHash, source.ref.contentHash);
    const graph = structuredClone(source.graph); graph.nodes[0].position.x = 345;
    const update = { schemaVersion: 1, commandId: randomUUID(), operation: 'saveMethodologyDraft', targetId: receipt.targetId, expectedVersion: 1, clientId: own.clientId,
      payload: { name: '개정 공통본', purpose: '좌표 보존', scope: 'USER_COMMON', graph, reason: '좌표 변경 QA' } };
    const changed = await send(update); assert.equal(changed.statusCode, 200, changed.body); assert.equal(changed.json().version, 2);
    assert.equal((await send({ ...update, commandId: randomUUID() })).statusCode, 409);
    const otherHeaders = { ...headers, cookie: '__Host-anvil.sid=' + other.token, 'x-anvil-csrf': other.csrfToken };
    assert.equal((await send({ ...update, clientId: other.clientId, commandId: randomUUID(), expectedVersion: 2 }, otherHeaders)).statusCode, 404);
    assert.equal((await send({ ...update, targetId: source.ref.id, commandId: randomUUID(), expectedVersion: 2 })).statusCode, 403);
    assert.equal((await send({ ...update, expectedVersion: 2, commandId: randomUUID(), payload: { ...update.payload, graph: { unsafe: true } } })).statusCode, 422);
    const version2 = await app.inject({ method: 'GET', url: `/api/v1/methodologies/${receipt.targetId}/versions/2`, headers });
    assert.equal(version2.json().graph.nodes[0].position.x, 345); assert.equal(version2.json().confirmation, null);
    assert.equal((await app.inject({ method: 'GET', url: `/api/v1/methodologies/${receipt.targetId}/versions/1`, headers })).json().graph.nodes[0].position.x, 0);
    const persisted = (await pool.query("SELECT count(*)::int AS count FROM anvil.commands WHERE scope_kind='USER_COMMON' AND scope_id=$1", [users[0]])).rows[0].count;
    assert.equal(persisted, 2);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM anvil.user_common_audit_events WHERE owner_user_id=$1', [users[0]])).rows[0].count, 2);
    await assert.rejects(pool.query("UPDATE anvil.methodology_definitions SET head_version=1 WHERE id=$1", [source.ref.id]), (e: unknown) => (e as { code: string }).code === '42501');
    await assert.rejects(pool.query("DELETE FROM anvil.user_common_audit_events WHERE owner_user_id=$1", [users[0]]), (e: unknown) => (e as { code: string }).code === '42501');
    await access.logout(own.token, own.csrfToken);
    assert.equal((await send(body)).statusCode, 401);
  } finally {
    const cleanup = await admin.connect();
    try {
      await cleanup.query('BEGIN');
      if ((await cleanup.query("SELECT to_regclass('anvil.user_common_audit_events') IS NOT NULL AS present")).rows[0].present) {
        await cleanup.query('DELETE FROM anvil.user_common_audit_events WHERE owner_user_id=ANY($1::uuid[])', [users]);
        await cleanup.query("DELETE FROM anvil.authorization_receipts WHERE scope_kind='USER_COMMON' AND scope_id=ANY($1::uuid[])", [users]);
        await cleanup.query("DELETE FROM anvil.commands WHERE scope_kind='USER_COMMON' AND scope_id=ANY($1::uuid[])", [users]);
      }
      await cleanup.query("DELETE FROM anvil.methodology_versions WHERE definition_id IN (SELECT id FROM anvil.methodology_definitions WHERE owner_user_id=ANY($1::uuid[]))", [users]);
      await cleanup.query('DELETE FROM anvil.methodology_definitions WHERE owner_user_id=ANY($1::uuid[])', [users]);
      for (const table of ['auth_sessions', 'clients', 'password_credentials']) await cleanup.query(`DELETE FROM anvil.${table} WHERE user_id=ANY($1::uuid[])`, [users]);
      await cleanup.query('DELETE FROM anvil.users WHERE id=ANY($1::uuid[])', [users]);
      await cleanup.query('COMMIT');
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM anvil.users WHERE id=ANY($1::uuid[])', [users])).rows[0].count, 0);
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM anvil.methodology_definitions WHERE owner_user_id=ANY($1::uuid[])', [users])).rows[0].count, 0);
    } catch (error) { await cleanup.query('ROLLBACK'); throw error; } finally { cleanup.release(); }
    await app.close(); await pool.end(); await admin.end();
  }
});
