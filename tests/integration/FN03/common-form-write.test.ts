import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { validateDevelopmentDbConfig } from '../../../apps/server/storage/development-config.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { hashPassword } from '../../../apps/server/modules/access/service.ts';
import { buildApp } from '../../../apps/server/app.ts';

test('공식 양식은 보존하고 본인 공통 양식의 복사·개정·정확 기준 참조만 원자 저장한다', async () => {
  if (!process.env.ANVIL_DB_CONFIG || !process.env.ANVIL_MIGRATOR_CONFIG) throw Error('ACTUAL_PROTECTED_DB_REQUIRED_NOT_SKIP');
  const pool = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG, 'utf8')), 'app'));
  const admin = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_MIGRATOR_CONFIG, 'utf8')), 'migrator'));
  const users = [randomUUID(), randomUUID()];
  const access = new AccessRepository(pool, { installationId: randomUUID(), key: randomBytes(32) });
  const app = buildApp({}, undefined, { repository: access, origin: 'https://localhost:3830' });
  try {
    const logins = [];
    for (const id of users) {
      const password = randomBytes(32).toString('base64url');
      await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'사용자 양식 QA','ACTIVE')", [id, 'qa-common-form-' + id]);
      await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)', [id, await hashPassword(password)]);
      logins.push(await access.login('qa-common-form-' + id, password, '양식 QA', 'qa-common-form-' + id));
    }
    const own = logins[0]!, other = logins[1]!;
    const headers = { host: 'localhost:3830', origin: 'https://localhost:3830', cookie: '__Host-anvil.sid=' + own.token, 'x-anvil-csrf': own.csrfToken };
    const get = (id: string, version: number) => app.inject({ method: 'GET', url: `/api/v1/forms/${id}/versions/${version}`, headers });
    const source = (await get('a6f30000-0000-4000-8000-000000000001', 1)).json();
    const body = { schemaVersion: 1, commandId: randomUUID(), operation: 'copyForm', targetId: null, expectedVersion: 0, clientId: own.clientId,
      payload: { sourceRef: source.ref, name: '내 요구 정의 양식', scope: 'USER_COMMON', reason: '공식 원본 복사 QA' } };
    const send = (request: unknown, auth = headers) => app.inject({ method: 'POST', url: '/api/v1/user-common/commands', headers: { ...auth, 'content-type': 'application/json' }, payload: JSON.stringify(request) });
    const copied = await send(body); assert.equal(copied.statusCode, 200, copied.body);
    const receipt = copied.json(), ref = receipt.data.ref;
    assert.equal(ref.version, 1); assert.deepEqual((await send(body)).json(), receipt);
    const definition = (await get(ref.id, 1)).json().definition;
    assert.equal(definition.scope, 'USER_COMMON'); assert.equal(definition.name, '내 요구 정의 양식');
    assert.deepEqual(definition.authoringStandardRef, source.definition.authoringStandardRef);
    definition.purpose = '요구 출처와 검수 방법을 작성한다';
    const save = { schemaVersion: 1, commandId: randomUUID(), operation: 'saveFormDraft', targetId: ref.id, expectedVersion: 1, clientId: own.clientId, payload: { definition, reason: '목적 구체화 QA' } };
    const saved = await send(save); assert.equal(saved.statusCode, 200, saved.body); assert.equal(saved.json().version, 2);
    assert.equal((await get(ref.id, 2)).json().definition.purpose, '요구 출처와 검수 방법을 작성한다');
    assert.equal((await get(ref.id, 1)).json().definition.purpose, source.definition.purpose);
    assert.deepEqual((await get(source.ref.id, 1)).json().ref, source.ref);
    assert.equal((await send({ ...save, commandId: randomUUID() })).statusCode, 409);
    assert.equal((await send({ ...save, commandId: randomUUID(), clientId: other.clientId, expectedVersion: 2 }, { ...headers, cookie: '__Host-anvil.sid=' + other.token, 'x-anvil-csrf': other.csrfToken })).statusCode, 404);
    assert.equal((await send({ ...save, commandId: randomUUID(), targetId: source.ref.id })).statusCode, 403);
    const bad = structuredClone(definition); bad.authoringStandardRef.contentHash = '0'.repeat(64);
    assert.equal((await send({ ...save, expectedVersion: 2, commandId: randomUUID(), payload: { definition: bad, reason: '변조 기준 QA' } })).statusCode, 422);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM anvil.commands WHERE scope_kind='USER_COMMON' AND scope_id=$1", [users[0]])).rows[0].count, 2);
    const partial = { ...definition, name: '작성 중 양식', purpose: '', requiredInputs: [], items: [] };
    const partialSave = await send({ ...save, commandId: randomUUID(), targetId: null, expectedVersion: 0, payload: { definition: partial, reason: '미완성 초안 보존' } });
    assert.equal(partialSave.statusCode, 200, partialSave.body); assert.equal(partialSave.json().data.validation.validForConfirmation, false);
    const restoredPartial = await get(partialSave.json().targetId, 1);
    assert.equal(restoredPartial.statusCode, 200); assert.deepEqual(restoredPartial.json().definition.items, []);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM anvil.commands WHERE scope_kind='USER_COMMON' AND scope_id=$1", [users[0]])).rows[0].count, 3);
    await assert.rejects(pool.query('UPDATE anvil.form_definitions SET head_version=1 WHERE id=$1', [source.ref.id]), (error: unknown) => (error as { code: string }).code === '42501');
  } finally {
    const db = await admin.connect();
    try {
      await db.query('BEGIN');
      await db.query('DELETE FROM anvil.user_common_audit_events WHERE owner_user_id=ANY($1::uuid[])', [users]);
      await db.query("UPDATE anvil.commands SET authorization_receipt_id=NULL WHERE scope_kind='USER_COMMON' AND scope_id=ANY($1::uuid[])", [users]);
      await db.query("DELETE FROM anvil.authorization_receipts WHERE scope_kind='USER_COMMON' AND scope_id=ANY($1::uuid[])", [users]);
      await db.query("DELETE FROM anvil.commands WHERE scope_kind='USER_COMMON' AND scope_id=ANY($1::uuid[])", [users]);
      await db.query('DELETE FROM anvil.form_versions WHERE definition_id IN (SELECT id FROM anvil.form_definitions WHERE owner_user_id=ANY($1::uuid[]))', [users]);
      await db.query('DELETE FROM anvil.form_definitions WHERE owner_user_id=ANY($1::uuid[])', [users]);
      for (const table of ['auth_sessions', 'clients', 'password_credentials']) await db.query(`DELETE FROM anvil.${table} WHERE user_id=ANY($1::uuid[])`, [users]);
      await db.query('DELETE FROM anvil.users WHERE id=ANY($1::uuid[])', [users]); await db.query('COMMIT');
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM anvil.users WHERE id=ANY($1::uuid[])', [users])).rows[0].count, 0);
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM anvil.form_definitions WHERE owner_user_id=ANY($1::uuid[])', [users])).rows[0].count, 0);
    } catch (error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
    await app.close(); await pool.end(); await admin.end();
  }
});
