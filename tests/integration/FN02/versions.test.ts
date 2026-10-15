import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { validateDevelopmentDbConfig } from '../../../apps/server/storage/development-config.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { hashPassword } from '../../../apps/server/modules/access/service.ts';
import { buildApp } from '../../../apps/server/app.ts';
import { buildOfficialForms } from '../../../apps/server/modules/documents/forms.ts';
import { buildBuiltinMethodologies } from '../../../apps/server/modules/methodologies/builtins.ts';

test('내장 방법론3종의 실제 DB/HTTP 버전과 고정 양식·원문이 보존되고 직접 변경은 거절된다', async () => {
  if (!process.env.ANVIL_DB_CONFIG || !process.env.ANVIL_MIGRATOR_CONFIG) throw Error('ACTUAL_PROTECTED_DB_REQUIRED_NOT_SKIP');
  const pool = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG, 'utf8')), 'app'));
  const admin = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_MIGRATOR_CONFIG, 'utf8')), 'migrator'));
  const catalog = buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md', import.meta.url)), await readFile(new URL('../../../docs/design/문서작성_공통기준.md', import.meta.url)));
  const methods = buildBuiltinMethodologies(await readFile(new URL('../../../docs/design/기본방법론_상세검토안.md', import.meta.url)), catalog.forms);
  const user = randomUUID(), password = randomBytes(32).toString('base64url');
  const otherUser = randomUUID(), ownMethod = randomUUID(), otherMethod = randomUUID();
  const access = new AccessRepository(pool, { installationId: randomUUID(), key: randomBytes(32) });
  const app = buildApp({}, undefined, { repository: access, origin: 'https://localhost:3830' });
  let created = false;
  try {
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM anvil.methodology_definitions WHERE scope='SYSTEM'")).rows[0].count, 3);
    await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'FN02 버전 QA','ACTIVE')", [user, 'qa-methods-' + user]); created = true;
    await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)', [user, await hashPassword(password)]);
    const login = await access.login('qa-methods-' + user, password, 'FN02 버전 QA', 'qa-methods-' + user);
    const headers = { host: 'localhost:3830', cookie: '__Host-anvil.sid=' + login.token };
    const list = await app.inject({ method: 'GET', url: '/api/v1/methodologies', headers });
    assert.equal(list.statusCode, 200); assert.equal(list.json().items.length, 3);
    assert.deepEqual(list.json().items.map((item: { systemCode: string }) => item.systemCode), ['SYS-M01', 'SYS-M02', 'SYS-M03']);
    for (const method of methods) {
      const response = await app.inject({ method: 'GET', url: `/api/v1/methodologies/${method.id}/versions/${method.version}`, headers });
      assert.equal(response.statusCode, 200);
      assert.equal(response.json().ref.contentHash, method.contentHash);
      assert.deepEqual(response.json().graph, method.graph);
      assert.equal(response.json().validation.validForConfirmation, true);
      assert.equal(response.json().runtimeReadiness, 'PROJECT_BINDINGS_REQUIRED');
      assert.equal(response.json().sourceApproval.productAcceptance, false);
      assert.equal(response.json().confirmation, null);
      await assert.rejects(pool.query("UPDATE anvil.methodology_versions SET reason='overwrite' WHERE definition_id=$1", [method.id]), (error: unknown) => (error as { code: string }).code === '42501');
    }
    const predecessors = ['320f57b45ad2a1ff5d5befa75131d4a7055406901f8f61cddb741bf29111afa6', '36e80925407e23332b814c00d4745ba8e28868cbf6832744c6d0541709e76f3f', 'e377320eeb6cd8f0d04d05552f7808df6f829ab478dcaa71581a27c87aa0a885'];
    for (const [index, method] of methods.entries()) {
      const legacy = (await pool.query('SELECT graph_json,content_hash FROM anvil.methodology_versions WHERE definition_id=$1 AND version=1', [method.id])).rows[0];
      assert.equal(legacy.content_hash, predecessors[index]);
      assert.equal(legacy.graph_json.edges[0].condition.kind, 'REVIEW_DECISION');
      const old = await app.inject({ method: 'GET', url: `/api/v1/methodologies/${method.id}/versions/1`, headers });
      assert.equal(old.statusCode, 200); assert.equal(old.json().validation.validForConfirmation, false);
    }
    await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'FN02 타 소유 QA','ACTIVE')", [otherUser, 'qa-methods-' + otherUser]);
    const fixture = await admin.connect();
    try {
      await fixture.query('BEGIN');
      for (const [id, owner] of [[ownMethod, user], [otherMethod, otherUser]]) {
        const base = methods[0]!;
        await fixture.query("INSERT INTO anvil.methodology_definitions(id,scope,owner_user_id,name,purpose,head_version) VALUES($1,'USER_COMMON',$2,'소유 방법론 QA','격리 조회',1)", [id, owner]);
        await fixture.query("INSERT INTO anvil.methodology_versions(definition_id,version,name,purpose,graph_json,content_hash,reason,created_by) VALUES($1,1,'소유 방법론 QA','격리 조회',$2,$3,'QA 원본',$4)", [id, JSON.stringify(base.graph), base.contentHash, owner]);
      }
      await fixture.query('COMMIT');
    } catch (error) { await fixture.query('ROLLBACK'); throw error; } finally { fixture.release(); }
    const permitted = await app.inject({ method: 'GET', url: '/api/v1/methodologies', headers });
    assert.equal(permitted.json().items.length, 4);
    assert.equal(permitted.json().items.some((item: { ref: { id: string } }) => item.ref.id === otherMethod), false);
    assert.equal((await app.inject({ method: 'GET', url: `/api/v1/methodologies/${ownMethod}/versions/1`, headers })).statusCode, 200);
    assert.equal((await app.inject({ method: 'GET', url: `/api/v1/methodologies/${otherMethod}/versions/1`, headers })).statusCode, 404);
    const unknown = await app.inject({ method: 'GET', url: `/api/v1/methodologies/${randomUUID()}/versions/1`, headers });
    assert.equal(unknown.statusCode, 404);
    await access.logout(login.token, login.csrfToken);
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/methodologies', headers })).statusCode, 401);
  } finally {
    if (created) {
      const cleanup = await admin.connect();
      try {
        await cleanup.query('BEGIN');
        await cleanup.query('DELETE FROM anvil.methodology_versions WHERE definition_id=ANY($1::uuid[])', [[ownMethod, otherMethod]]);
        await cleanup.query('DELETE FROM anvil.methodology_definitions WHERE id=ANY($1::uuid[])', [[ownMethod, otherMethod]]);
        await cleanup.query('COMMIT');
      } catch (error) { await cleanup.query('ROLLBACK'); throw error; } finally { cleanup.release(); }
      await pool.query('DELETE FROM anvil.auth_sessions WHERE user_id=$1', [user]); await pool.query('DELETE FROM anvil.clients WHERE user_id=$1', [user]);
      await pool.query('DELETE FROM anvil.password_credentials WHERE user_id=$1', [user]); await pool.query('DELETE FROM anvil.users WHERE id=$1', [user]);
      await pool.query('DELETE FROM anvil.users WHERE id=$1', [otherUser]);
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM anvil.users WHERE id=$1', [user])).rows[0].count, 0);
    }
    await app.close(); await pool.end(); await admin.end();
  }
});
