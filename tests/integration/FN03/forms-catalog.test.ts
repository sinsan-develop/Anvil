import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { validateDevelopmentDbConfig } from '../../../apps/server/storage/development-config.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { hashPassword } from '../../../apps/server/modules/access/service.ts';
import { buildApp } from '../../../apps/server/app.ts';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { buildOfficialForms } from '../../../apps/server/modules/documents/forms.ts';

test('실제 저장된 공식8종·작성 기준은 버전 그대로 조회되며 사용자 공통본/회수 세션을 격리한다', async () => {
  if (!process.env.ANVIL_DB_CONFIG || !process.env.ANVIL_MIGRATOR_CONFIG) throw Error('ACTUAL_PROTECTED_DB_REQUIRED_NOT_SKIP');
  const pool = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG, 'utf8')), 'app'));
  const admin = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_MIGRATOR_CONFIG, 'utf8')), 'migrator'));
  const source = await readFile(new URL('../../../docs/design/공식산출물_양식정의.md', import.meta.url));
  const standard = await readFile(new URL('../../../docs/design/문서작성_공통기준.md', import.meta.url));
  const catalog = buildOfficialForms(source, standard);
  const users = [randomUUID(), randomUUID()], forms = [randomUUID(), randomUUID()];
  const password = randomBytes(32).toString('base64url');
  const access = new AccessRepository(pool, { installationId: randomUUID(), key: randomBytes(32) });
  const app = buildApp({}, undefined, { repository: access, origin: 'https://localhost:3830' });
  let catalogPresent = false;
  try {
    // fixture 생성 전 실제 저장부터 검사하며 미적용을 skip으로 바꾸지 않는다.
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM anvil.form_definitions WHERE scope='SYSTEM'")).rows[0].count, 8);
    catalogPresent = true;
    const phc = await hashPassword(password);
    for (const user of users) {
      await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'FN03 양식 QA','ACTIVE')", [user, 'qa-forms-' + user]);
      await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)', [user, phc]);
    }
    const db = await admin.connect();
    try {
      await db.query('BEGIN');
      for (const [index, id] of forms.entries()) {
        const definition = { ...catalog.forms[0]!.definition, scope: 'USER_COMMON', name: 'FN03 소유 양식 QA' };
        await db.query("INSERT INTO anvil.form_definitions(id,scope,owner_user_id,form_code,name,head_version) VALUES($1,'USER_COMMON',$2,'AF01',$3,1)", [id, users[index], definition.name]);
        await db.query('INSERT INTO anvil.form_versions(definition_id,version,definition_json,content_hash,authoring_standard_id,authoring_standard_version,authoring_standard_hash,created_by) VALUES($1,1,$2,$3,$4,1,$5,$6)', [id, JSON.stringify(definition), contentHash(canonicalJson(definition)), catalog.standard.ref.id, catalog.standard.ref.contentHash, users[index]]);
      }
      await db.query('COMMIT');
    } catch (error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
    const login = await access.login('qa-forms-' + users[0], password, 'FN03 실제 조회 QA', 'qa-forms-' + users[0]);
    const headers = { host: 'localhost:3830', cookie: '__Host-anvil.sid=' + login.token };
    const listed = await app.inject({ method: 'GET', url: '/api/v1/forms', headers });
    assert.equal(listed.statusCode, 200); assert.equal(listed.json().items.length, 9);
    assert.equal(listed.json().items.some((item: { ref: { id: string } }) => item.ref.id === forms[1]), false);
    const ref = catalog.forms[0]!.ref;
    const response = await app.inject({ method: 'GET', url: `/api/v1/forms/${ref.id}/versions/1`, headers });
    assert.equal(response.statusCode, 200); assert.equal(response.json().definition.name, '요구사항정의서');
    assert.equal(response.json().ref.contentHash, ref.contentHash);
    assert.equal(response.json().authoringStandard.content, standard.toString('utf8'));
    assert.equal(response.json().validation.contentReview, 'NOT_PERFORMED');
    assert.equal((await app.inject({ method: 'GET', url: `/api/v1/forms/${forms[1]}/versions/1`, headers })).statusCode, 404);
    assert.equal((await app.inject({ method: 'GET', url: `/api/v1/forms/${ref.id}/versions/2`, headers })).statusCode, 404);
    await assert.rejects(pool.query("UPDATE anvil.form_versions SET content_hash=$1 WHERE definition_id=$2", ['0'.repeat(64), ref.id]), (error: unknown) => (error as { code: string }).code === '42501');
    await access.logout(login.token, login.csrfToken);
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/forms', headers })).statusCode, 401);
  } finally {
    if (catalogPresent) {
    const cleanup = await admin.connect();
    try {
      await cleanup.query('BEGIN');
      await cleanup.query('DELETE FROM anvil.form_versions WHERE definition_id=ANY($1::uuid[])', [forms]);
      await cleanup.query('DELETE FROM anvil.form_definitions WHERE id=ANY($1::uuid[])', [forms]);
      for (const user of users) {
        await cleanup.query('DELETE FROM anvil.auth_sessions WHERE user_id=$1', [user]);
        await cleanup.query('DELETE FROM anvil.clients WHERE user_id=$1', [user]);
        await cleanup.query('DELETE FROM anvil.password_credentials WHERE user_id=$1', [user]);
        await cleanup.query('DELETE FROM anvil.users WHERE id=$1', [user]);
      }
      await cleanup.query('COMMIT');
      assert.equal((await cleanup.query('SELECT count(*)::int AS count FROM anvil.users WHERE id=ANY($1::uuid[])', [users])).rows[0].count, 0);
    } catch (error) { await cleanup.query('ROLLBACK'); throw error; } finally { cleanup.release(); }
    }
    await app.close(); await pool.end(); await admin.end();
  }
});
