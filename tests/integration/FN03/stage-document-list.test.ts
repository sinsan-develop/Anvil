import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { validateDevelopmentDbConfig } from '../../../apps/server/storage/development-config.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { hashPassword } from '../../../apps/server/modules/access/service.ts';
import { buildApp } from '../../../apps/server/app.ts';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';

// SQL 필터의 실제 현재 head·프로젝트/actor/cursor 격리와 회원확인 후 적용변경 회귀를 검출한다.
// migrator가 일시 준비하는 합성 metadata이며 문서 작성/확정·파일 저장 성공 시험이 아니다.
const id = (suffix: number) => 'a6f20410-0000-4000-8000-' + String(suffix).padStart(12, '0');
const users = [id(101), id(102)], projects = [id(201), id(202)], applications = [id(301), id(302), id(303)];
const documents = [id(401), id(402), id(403), id(404), id(405)], commands = Array.from({ length: 8 }, (_, index) => id(501 + index)), artifacts = [id(601), id(602)];
test('정식 PG 단계 목록은 최신 head만 선택하고 cursor·현재 적용 교체를 혼동하지 않는다', { timeout: 60000 }, async () => {
  if (process.env.ANVIL_UI04_FORMAL_STAGE !== 'STAGE_DOCUMENT_LIST_01' || !process.env.ANVIL_DB_CONFIG || !process.env.ANVIL_MIGRATOR_CONFIG) throw Error('FORMAL_QA_EXPLICIT_TARGET_REQUIRED_NOT_SKIP');
  const deadline = Date.parse(process.env.ANVIL_UI04_QA_EXPIRES_AT ?? '');
  if (!Number.isFinite(deadline) || Date.now() >= deadline || deadline - Date.now() > 20 * 60000) throw Error('FORMAL_QA_WINDOW_INVALID');
  const pool = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG, 'utf8')), 'app'));
  const admin = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_MIGRATOR_CONFIG, 'utf8')), 'migrator'));
  const key = randomBytes(32), access = new AccessRepository(pool, { installationId: randomUUID(), key }), app = buildApp({}, undefined, { repository: access, origin: 'https://localhost:3830' });
  let seeded = false, migrationBaseline: unknown, raceApp: ReturnType<typeof buildApp> | null = null;
  const cases: string[] = [], checked = (name: string) => { cases.push(name); assert(Date.now() < deadline, 'QA_WINDOW_EXPIRED'); };
  try {
    const target = (await admin.query('SELECT current_database() db,current_user role')).rows[0]; assert.equal(target.db, 'anvil_v3_development'); assert.equal(target.role, 'anvil_v3_migrator');
    migrationBaseline = (await admin.query('SELECT id,checksum FROM anvil.schema_migrations ORDER BY id')).rows; assert.equal((migrationBaseline as unknown[]).length, 46);
    const role = (await pool.query('SELECT current_user role,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0]; assert.equal(role.role, 'anvil_v3_app'); assert.equal(role.rolsuper, false); assert.equal(role.rolbypassrls, false);
    for (const [table, ids] of [['users', users], ['projects', projects], ['project_methodologies', applications], ['documents', documents], ['commands', commands], ['artifacts', artifacts]] as const)
      assert.equal((await admin.query(`SELECT count(*)::int n FROM anvil.${table} WHERE id=ANY($1::uuid[])`, [ids])).rows[0].n, 0, 'QA_COLLISION_PRESERVE');
    const source = (await admin.query("SELECT * FROM anvil.methodology_versions WHERE definition_id='a6f20000-0000-4000-8000-000000000001' AND version=2")).rows[0]; assert(source);
    const snapshot = { name: source.name, purpose: source.purpose, graph: source.graph_json, sourceRef: { id: source.definition_id, version: 2, contentHash: source.content_hash } }, snapshotHash = contentHash(canonicalJson(snapshot));
    const firstNode = snapshot.graph.nodes[0], secondNode = snapshot.graph.nodes[1]; assert(firstNode && secondNode);
    const form = (await admin.query('SELECT definition_id,version,content_hash FROM anvil.form_versions ORDER BY definition_id,version LIMIT 1')).rows[0]; assert(form);
    const insertApplication = (db: Pick<Pool, 'query'>, applicationId: string, projectId: string, version: number) => db.query('INSERT INTO anvil.project_methodologies(id,project_id,application_version,source_definition_id,source_version,source_hash,snapshot_json,snapshot_hash,created_by) VALUES($1,$2,$3,$4,2,$5,$6,$7,$8)', [applicationId, projectId, version, source.definition_id, source.content_hash, JSON.stringify(snapshot), snapshotHash, users[0]]);
    const password = randomBytes(32).toString('base64url'), phc = await hashPassword(password), seed = await admin.connect();
    try {
      await seed.query('BEGIN');
      for (const user of users) { await seed.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'단계 목록 합성 QA','ACTIVE')", [user, 'qa-ui04-stage-' + user]); await seed.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)', [user, phc]); }
      for (const project of projects) await seed.query("INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,'단계 목록 합성 QA','조회 필터 검수','metadata 경계만')", [project]);
      for (const [project, user, participation] of [[projects[0], users[0], 'OWNER'], [projects[0], users[1], 'VIEWER'], [projects[1], users[1], 'OWNER']]) await seed.query('INSERT INTO anvil.project_members(project_id,user_id,participation) VALUES($1,$2,$3)', [project, user, participation]);
      await insertApplication(seed, applications[0]!, projects[0]!, 1); await insertApplication(seed, applications[2]!, projects[1]!, 1); await seed.query('COMMIT'); seeded = true;
    } catch (error) { await seed.query('ROLLBACK'); throw error; } finally { seed.release(); }
    const owner = await access.login('qa-ui04-stage-' + users[0], password, '단계 목록 owner QA', 'qa-ui04-stage-' + users[0]);
    const viewer = await access.login('qa-ui04-stage-' + users[1], password, '단계 목록 viewer QA', 'qa-ui04-stage-' + users[1]);
    const metadata = await admin.connect(); let nextCommand = 0;
    const command = async (db: PoolClient, projectId: string, user: string, client: string) => { const commandId = commands[nextCommand++]!; assert(commandId); await db.query("INSERT INTO anvil.commands(id,scope_kind,scope_id,project_id,actor_id,client_id,operation,command_id,request_hash,operation_id,state,expected_version,control_generation) VALUES($1,'PROJECT',$2,$2,$3,$4,'QA_METADATA_ONLY',$1,$5,$1,'PERSISTED',0,1)", [commandId, projectId, user, client, 'f'.repeat(64)]); return commandId; };
    try {
      await metadata.query('BEGIN'); await metadata.query('SET CONSTRAINTS ALL DEFERRED');
      for (let index = 0; index < 2; index++) await metadata.query("INSERT INTO anvil.artifacts(id,project_id,bytes,content_hash,media_type,storage_key,state,created_by,client_id,command_id) VALUES($1,$2,0,$3,'text/plain;charset=utf-8',$4,'STAGING',$5,$6,$7)", [artifacts[index], projects[index], contentHash(Buffer.alloc(0)), 'qa-metadata-only/' + artifacts[index], users[index], index ? viewer.clientId : owner.clientId, await command(metadata, projects[index]!, users[index]!, index ? viewer.clientId : owner.clientId)]);
      for (const [index, doc] of documents.entries()) {
        const foreign = index === 4, project = projects[foreign ? 1 : 0]!, user = users[foreign ? 1 : 0]!, client = foreign ? viewer.clientId : owner.clientId, head = index === 2 ? 2 : 1;
        await metadata.query("INSERT INTO anvil.documents(id,project_id,title,head_version,created_by,updated_at) VALUES($1,$2,$3,$4,$5,$6)", [doc, project, '합성 metadata 문서 ' + (index + 1), head, user, `2026-10-17T01:02:0${5 - index}.123456Z`]);
        for (let version = 1; version <= head; version++) {
          const stage = index === 3 ? null : { applicationId: applications[foreign ? 2 : 0], nodeId: index === 2 && version === 2 ? secondNode.nodeId : firstNode.nodeId };
          await metadata.query("INSERT INTO anvil.document_versions(project_id,document_id,version,form_definition_id,form_version,form_hash,body_artifact_id,title,source_refs_json,content_json,content_hash,sections_json,author_ref_json,validation_json,reason,client_id,command_id,stage_ref_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'[]','{}',$9,'[]',$10,'{}','합성 목록 metadata만',$11,$12,$13)", [project, doc, version, form.definition_id, form.version, form.content_hash, artifacts[foreign ? 1 : 0], '합성 metadata 문서 ' + (index + 1), 'b'.repeat(64), JSON.stringify({ kind: 'HUMAN', userId: user }), client, await command(metadata, project, user, client), stage ? JSON.stringify(stage) : null]);
        }
      }
      assert.equal(nextCommand, 8); await metadata.query('COMMIT');
    } catch (error) { await metadata.query('ROLLBACK'); throw error; } finally { metadata.release(); }
    const headers = (token = owner.token) => ({ host: 'localhost:3830', cookie: '__Host-anvil.sid=' + token });
    const get = (query: Record<string, string>, token = owner.token, project = projects[0]!) => app.inject({ method: 'GET', url: `/api/v1/projects/${project}/documents?` + new URLSearchParams(query), headers: headers(token) });
    const query = { applicationId: applications[0]!, nodeId: firstNode.nodeId, limit: '1' };
    const first = await get(query); assert.equal(first.statusCode, 200); assert.equal(first.headers['cache-control'], 'no-store'); assert.deepEqual(first.json().items.map((d: any) => d.id), [documents[0]]); assert.equal(first.json().hasMore, true);
    const cursor = first.json().nextCursor, second = await get({ ...query, cursor }); assert.equal(second.statusCode, 200); assert.deepEqual(second.json().items.map((d: any) => d.id), [documents[1]]); assert.equal(second.json().hasMore, false); checked('LATEST_HEAD_STAGE_FILTER_CURSOR_ORDER');
    const nextNode = await get({ ...query, nodeId: secondNode.nodeId }); assert.deepEqual(nextNode.json().items.map((d: any) => d.id), [documents[2]]);
    const ordinary = await get({ limit: '50' }); assert.equal(ordinary.statusCode, 200); assert.deepEqual(new Set(ordinary.json().items.map((d: any) => d.id)), new Set(documents.slice(0, 4))); checked('OLD_VERSION_UNLINKED_FOREIGN_NOT_IN_STAGE_AND_UNFILTERED_PRESERVED');
    assert.equal((await get(query, viewer.token)).statusCode, 200); assert.equal((await get(query, owner.token, projects[1])).statusCode, 404);
    for (const [otherQuery, token, project] of [[{ limit: '1', cursor }, owner.token, projects[0]], [{ ...query, cursor, nodeId: secondNode.nodeId }, owner.token, projects[0]], [{ ...query, cursor }, viewer.token, projects[0]], [{ ...query, cursor }, viewer.token, projects[1]]] as const) assert.equal((await get(otherQuery, token, project)).statusCode, 400); checked('ACTOR_PROJECT_STAGE_UNFILTERED_CURSOR_BINDING');
    assert.equal((await get({ ...query, nodeId: 'MISSING_NODE' })).statusCode, 404); assert.equal((await get({ applicationId: applications[0]! })).statusCode, 400);
    await admin.query('UPDATE anvil.project_methodologies SET snapshot_hash=$2 WHERE id=$1', [applications[0], '0'.repeat(64)]); assert.equal((await get(query)).statusCode, 503); await admin.query('UPDATE anvil.project_methodologies SET snapshot_hash=$2 WHERE id=$1', [applications[0], snapshotHash]); checked('INPUT_NODE_INTEGRITY_FAIL_CLOSED');
    let injected = 0;
    const racingPool = { connect: async () => { const db = await pool.connect(); return { query: async (sql: string, params?: unknown[]) => { if (sql.startsWith('WITH member_scope') && injected++ === 0) await insertApplication(admin, applications[1]!, projects[0]!, 2); return db.query(sql, params); }, release: () => db.release() }; } } as unknown as Pool;
    raceApp = buildApp({}, undefined, { repository: new AccessRepository(racingPool, { installationId: access.installationId, key }), origin: 'https://localhost:3830' });
    const raced = await raceApp.inject({ method: 'GET', url: `/api/v1/projects/${projects[0]}/documents?` + new URLSearchParams(query), headers: headers() }); assert.equal(injected, 1); assert.equal(raced.statusCode, 409); assert.equal(raced.json().code, 'METHODOLOGY_APPLICATION_CHANGED'); assert.equal(raced.json().items, undefined);
    const fresh = await get({ ...query, applicationId: applications[1]! }); assert.equal(fresh.statusCode, 200); assert.deepEqual(fresh.json().items, []); checked('REPLACEMENT_AFTER_MEMBER_CHECK_NO_MIXED_PAGE');
    console.log(JSON.stringify({ kind: 'UI04_FORMAL_STAGE_DOCUMENT_LIST_CHECKED', cases, actualPg: true, transport: 'FASTIFY_INJECT', metadataFixtureOnly: true, fileBytesCreated: 0, migrationsApplied: 0, serviceChanged: false }));
  } finally {
    await raceApp?.close(); await app.close();
    try { if (seeded) {
      const cleanup = await admin.connect();
      try {
        await cleanup.query('BEGIN'); await cleanup.query('SET CONSTRAINTS ALL DEFERRED');
        for (const table of ['document_versions', 'documents', 'artifacts', 'commands', 'project_methodologies', 'project_members']) await cleanup.query(`DELETE FROM anvil.${table} WHERE project_id=ANY($1::uuid[])`, [projects]);
        await cleanup.query('DELETE FROM anvil.projects WHERE id=ANY($1::uuid[])', [projects]); await cleanup.query('DELETE FROM anvil.auth_audit_events WHERE subject_ref=ANY($1::uuid[])', [users]);
        for (const table of ['auth_sessions', 'clients', 'password_credentials']) await cleanup.query(`DELETE FROM anvil.${table} WHERE user_id=ANY($1::uuid[])`, [users]);
        await cleanup.query('DELETE FROM anvil.users WHERE id=ANY($1::uuid[])', [users]); await cleanup.query('COMMIT');
      } catch (error) { await cleanup.query('ROLLBACK'); throw error; } finally { cleanup.release(); }
      for (const [table, column, ids] of [['document_versions', 'project_id', projects], ['documents', 'id', documents], ['artifacts', 'id', artifacts], ['commands', 'id', commands], ['project_methodologies', 'id', applications], ['project_members', 'project_id', projects], ['projects', 'id', projects], ['users', 'id', users], ['auth_sessions', 'user_id', users], ['clients', 'user_id', users], ['password_credentials', 'user_id', users], ['auth_audit_events', 'subject_ref', users]] as const) assert.equal((await admin.query(`SELECT count(*)::int n FROM anvil.${table} WHERE ${column}=ANY($1::uuid[])`, [ids])).rows[0].n, 0);
      assert.deepEqual((await admin.query('SELECT id,checksum FROM anvil.schema_migrations ORDER BY id')).rows, migrationBaseline);
      console.log(JSON.stringify({ kind: 'UI04_FORMAL_STAGE_DOCUMENT_LIST_CLEANED', exactQaTables: 12, remaining: 0 }));
    } } finally { key.fill(0); await pool.end(); await admin.end(); }
  }
});
