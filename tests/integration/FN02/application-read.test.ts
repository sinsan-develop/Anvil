import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { validateDevelopmentDbConfig } from '../../../apps/server/storage/development-config.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { hashPassword } from '../../../apps/server/modules/access/service.ts';
import { buildApp } from '../../../apps/server/app.ts';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { ApiClient, ApiError } from '../../../apps/web/src/api/client.ts';
import { readWorkspaceProject, readWorkspaceMethodology } from '../../../apps/web/src/features/workspace/api.ts';

// 결함 검출: 실제 최신행 SQL/회원검사가 틀리거나, 변조/만료를 미적용으로 숨기거나,
// 두 GET 사이의 적용 변경을 클라이언트가 수용하는 회귀. 실제 listen/브라우저 시험은 아니다.
const users = ['a6f20400-0000-4000-8000-000000000101', 'a6f20400-0000-4000-8000-000000000102'];
const projects = ['a6f20400-0000-4000-8000-000000000201', 'a6f20400-0000-4000-8000-000000000202', 'a6f20400-0000-4000-8000-000000000203'];
const applications = ['a6f20400-0000-4000-8000-000000000301', 'a6f20400-0000-4000-8000-000000000302', 'a6f20400-0000-4000-8000-000000000303'];

test('정식 PG 적용본 읽기는 회원·최신 고정본·만료·변조·두 조회 경합을 집행한다', { timeout: 60000 }, async () => {
  if (process.env.ANVIL_UI04_FORMAL_READ !== 'APPLICATION_READ_01' || !process.env.ANVIL_DB_CONFIG || !process.env.ANVIL_MIGRATOR_CONFIG) throw Error('FORMAL_QA_EXPLICIT_TARGET_REQUIRED_NOT_SKIP');
  const deadline = Date.parse(process.env.ANVIL_UI04_QA_EXPIRES_AT ?? '');
  if (!Number.isFinite(deadline) || Date.now() >= deadline || deadline - Date.now() > 20 * 60000) throw Error('FORMAL_QA_WINDOW_INVALID');
  const pool = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG, 'utf8')), 'app'));
  const admin = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_MIGRATOR_CONFIG, 'utf8')), 'migrator'));
  const key = randomBytes(32), access = new AccessRepository(pool, { installationId: randomUUID(), key });
  const app = buildApp({}, undefined, { repository: access, origin: 'https://localhost:3830' });
  let seeded = false, migrationBaseline: unknown;
  const cases: string[] = [], checked = (name: string) => { cases.push(name); assert(Date.now() < deadline, 'QA_WINDOW_EXPIRED'); };
  try {
    const target = (await admin.query('SELECT current_database() db,current_user role,(SELECT count(*)::int FROM anvil.schema_migrations) migrations')).rows[0];
    assert.equal(target.db, 'anvil_v3_development'); assert.equal(target.role, 'anvil_v3_migrator'); assert.equal(target.migrations, 46);
    migrationBaseline = (await admin.query('SELECT id,checksum FROM anvil.schema_migrations ORDER BY id')).rows;
    const appRole = (await pool.query('SELECT current_user role,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.equal(appRole.role, 'anvil_v3_app'); assert.equal(appRole.rolsuper, false); assert.equal(appRole.rolbypassrls, false);
    for (const [table, ids] of [['users', users], ['projects', projects], ['project_methodologies', applications]] as const)
      assert.equal((await admin.query(`SELECT count(*)::int n FROM anvil.${table} WHERE id=ANY($1::uuid[])`, [ids])).rows[0].n, 0, 'QA_COLLISION_PRESERVE_EXISTING');
    const original = (await admin.query("SELECT * FROM anvil.methodology_versions WHERE definition_id='a6f20000-0000-4000-8000-000000000001' AND version=2")).rows[0];
    assert(original, 'BUILTIN_SOURCE_REQUIRED');
    const snapshot = { name: original.name, purpose: original.purpose, graph: original.graph_json, sourceRef: { id: original.definition_id, version: 2, contentHash: original.content_hash } };
    const snapshotHash = contentHash(canonicalJson(snapshot));
    const password = randomBytes(32).toString('base64url'), phc = await hashPassword(password);
    const insertApplication = (db: Pick<Pool, 'query'>, id: string, project: string, version: number) => db.query('INSERT INTO anvil.project_methodologies(id,project_id,application_version,source_definition_id,source_version,source_hash,snapshot_json,snapshot_hash,created_by) VALUES($1,$2,$3,$4,2,$5,$6,$7,$8)', [id, project, version, snapshot.sourceRef.id, original.content_hash, JSON.stringify(snapshot), snapshotHash, users[0]]);
    const seed = await admin.connect();
    try {
      await seed.query('BEGIN');
      for (const id of users) {
        await seed.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'적용본 조회 합성 QA','ACTIVE')", [id, 'qa-ui04-application-' + id]);
        await seed.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)', [id, phc]);
      }
      for (const id of projects) await seed.query("INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,'적용본 조회 합성 QA','정의 원본 보존','조회 경계 확인')", [id]);
      for (const [project, user, role] of [[projects[0], users[0], 'OWNER'], [projects[0], users[1], 'VIEWER'], [projects[1], users[0], 'OWNER'], [projects[2], users[1], 'OWNER']])
        await seed.query('INSERT INTO anvil.project_members(project_id,user_id,participation) VALUES($1,$2,$3)', [project, user, role]);
      await insertApplication(seed, applications[0]!, projects[0]!, 1);
      await insertApplication(seed, applications[2]!, projects[2]!, 1);
      await seed.query('COMMIT'); seeded = true;
    } catch (error) { await seed.query('ROLLBACK'); throw error; } finally { seed.release(); }
    const owner = await access.login('qa-ui04-application-' + users[0], password, '적용본 owner QA', 'qa-ui04-application-' + users[0]);
    const viewer = await access.login('qa-ui04-application-' + users[1], password, '적용본 viewer QA', 'qa-ui04-application-' + users[1]);
    const get = (project: string, token = owner.token, suffix = '') => app.inject({ method: 'GET', url: `/api/v1/projects/${project}/methodology-application${suffix}`, headers: { host: 'localhost:3830', cookie: '__Host-anvil.sid=' + token } });
    const own = await get(projects[0]!); assert.equal(own.statusCode, 200); assert.equal(own.headers['cache-control'], 'no-store');
    assert.deepEqual(Object.keys(own.json()).sort(), ['applicationRef', 'executionState', 'observedAt', 'projectId', 'snapshot']);
    assert.deepEqual(own.json().applicationRef, { id: applications[0], version: 1, contentHash: snapshotHash });
    assert.deepEqual(own.json().snapshot, snapshot); assert.equal(own.json().executionState, 'NOT_CONNECTED');
    assert.equal((await get(projects[0]!, viewer.token)).statusCode, 200, '현재 VIEWER 조회 허용'); checked('OWNER_VIEWER_FIXED_SNAPSHOT_NO_STORE');
    const empty = await get(projects[1]!); assert.equal(empty.statusCode, 200); assert.equal(empty.json().applicationRef, null); assert.equal(empty.json().snapshot, null); checked('NO_APPLICATION_NULL_PAIR');
    assert.equal((await get(projects[2]!)).statusCode, 404);
    assert.equal((await get('a6f20400-0000-4000-8000-000000000299')).statusCode, 404);
    await admin.query('UPDATE anvil.project_members SET revoked_at=now() WHERE project_id=$1 AND user_id=$2', [projects[0], users[1]]);
    assert.equal((await get(projects[0]!, viewer.token)).statusCode, 404);
    await admin.query('UPDATE anvil.project_members SET revoked_at=NULL WHERE project_id=$1 AND user_id=$2', [projects[0], users[1]]); checked('FOREIGN_MISSING_REVOKED_MEMBER_DENIED');
    assert.equal((await get(projects[0]!, owner.token, '?extra=1')).statusCode, 400); checked('QUERY_REJECTED');
    const client = new ApiClient(async (url, init) => {
      assert.equal(init?.method, 'GET'); assert(String(url).startsWith('/api/v1/projects/'));
      const response = await app.inject({ method: 'GET', url: String(url), headers: { host: 'localhost:3830', cookie: '__Host-anvil.sid=' + owner.token } });
      return new Response(response.body, { status: response.statusCode, headers: { 'content-type': String(response.headers['content-type'] ?? '') } });
    });
    const project = await readWorkspaceProject(client, projects[0]!);
    assert.deepEqual((await readWorkspaceMethodology(client, projects[0]!, project.currentMethodologyRef)).snapshot, snapshot); checked('WEB_CLIENT_REAL_PG_PIN');
    await insertApplication(admin, applications[1]!, projects[0]!, 2);
    assert.equal((await get(projects[0]!)).json().applicationRef.id, applications[1]);
    await assert.rejects(readWorkspaceMethodology(client, projects[0]!, project.currentMethodologyRef), (error: unknown) => error instanceof ApiError && error.code === 'METHODOLOGY_APPLICATION_CHANGED');
    const refreshed = await readWorkspaceProject(client, projects[0]!);
    assert.equal((await readWorkspaceMethodology(client, projects[0]!, refreshed.currentMethodologyRef)).applicationRef!.version, 2); checked('LATEST_ROW_TWO_GET_RACE');
    await admin.query('UPDATE anvil.project_methodologies SET snapshot_hash=$2 WHERE id=$1', [applications[1], '0'.repeat(64)]);
    const corrupt = await get(projects[0]!); assert.equal(corrupt.statusCode, 503); assert.equal(corrupt.json().code, 'METHODOLOGY_APPLICATION_INTEGRITY_FAILED');
    assert.equal(corrupt.headers['cache-control'], 'no-store'); assert.equal(corrupt.json().snapshot, undefined);
    await admin.query('UPDATE anvil.project_methodologies SET snapshot_hash=$2 WHERE id=$1', [applications[1], snapshotHash]); checked('TAMPER_FAIL_CLOSED');
    await admin.query("UPDATE anvil.auth_sessions SET idle_expires_at=now()-interval '1 second' WHERE user_id=$1", [users[1]]);
    assert.equal((await get(projects[0]!, viewer.token)).statusCode, 401); checked('EXPIRED_SESSION_DENIED');
    await admin.query('UPDATE anvil.users SET credential_generation=2 WHERE id=$1', [users[0]]);
    assert.equal((await get(projects[0]!)).statusCode, 401); checked('OLD_CREDENTIAL_GENERATION_DENIED');
    assert.deepEqual((await admin.query('SELECT id,application_version,snapshot_hash FROM anvil.project_methodologies WHERE project_id=$1 ORDER BY application_version', [projects[0]])).rows.map(row => [row.id, Number(row.application_version), row.snapshot_hash]), [[applications[0], 1, snapshotHash], [applications[1], 2, snapshotHash]]);
    for (const table of ['commands', 'audit_events', 'project_control', 'delivery_outbox']) assert.equal((await admin.query(`SELECT count(*)::int n FROM anvil.${table} WHERE project_id=ANY($1::uuid[])`, [projects])).rows[0].n, 0);
    checked('NO_DOMAIN_COMMAND_CONTROL_DISPATCH_WRITE');
    console.log(JSON.stringify({ kind: 'UI04_FORMAL_APPLICATION_READ_CHECKED', cases, actualPg: true, nonSuperuser: true, transport: 'FASTIFY_INJECT', browser: false, serviceChanged: false, migrationsApplied: 0 }));
  } finally {
    await app.close();
    try {
      if (seeded) {
        const cleanup = await admin.connect();
        try {
          await cleanup.query('BEGIN');
          for (const table of ['project_methodologies', 'project_members']) await cleanup.query(`DELETE FROM anvil.${table} WHERE project_id=ANY($1::uuid[])`, [projects]);
          await cleanup.query('DELETE FROM anvil.projects WHERE id=ANY($1::uuid[])', [projects]);
          await cleanup.query('DELETE FROM anvil.auth_audit_events WHERE subject_ref=ANY($1::uuid[])', [users]);
          for (const table of ['auth_sessions', 'clients', 'password_credentials']) await cleanup.query(`DELETE FROM anvil.${table} WHERE user_id=ANY($1::uuid[])`, [users]);
          await cleanup.query('DELETE FROM anvil.users WHERE id=ANY($1::uuid[])', [users]); await cleanup.query('COMMIT');
        } catch (error) { await cleanup.query('ROLLBACK'); throw error; } finally { cleanup.release(); }
        for (const [table, column, ids] of [['users', 'id', users], ['projects', 'id', projects], ['project_methodologies', 'id', applications], ['auth_sessions', 'user_id', users], ['clients', 'user_id', users], ['auth_audit_events', 'subject_ref', users], ['password_credentials', 'user_id', users], ['project_members', 'project_id', projects]] as const)
          assert.equal((await admin.query(`SELECT count(*)::int n FROM anvil.${table} WHERE ${column}=ANY($1::uuid[])`, [ids])).rows[0].n, 0);
        assert.deepEqual((await admin.query('SELECT id,checksum FROM anvil.schema_migrations ORDER BY id')).rows, migrationBaseline);
        console.log(JSON.stringify({ kind: 'UI04_FORMAL_APPLICATION_READ_CLEANED', exactQaTables: 8, remaining: 0 }));
      }
    } finally { key.fill(0); await pool.end(); await admin.end(); }
  }
});
