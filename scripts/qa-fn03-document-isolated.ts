/** FN03 신규 일회 격리 시험. 기본은 계획 출력뿐이며 실행 허가는 별도다. */
import assert from 'node:assert/strict';
import { readFile, mkdir, lstat, realpath, rename } from 'node:fs/promises';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Pool, type ClientConfig } from 'pg';
import { AccessRepository } from '../apps/server/modules/access/repository.ts';
import { hashPassword } from '../apps/server/modules/access/service.ts';
import { buildApp } from '../apps/server/app.ts';
import { executionPreparationQaDatabase, buildExecutionPreparationQaSchema } from './execution-preparation-qa.ts';
import { buildOfficialForms } from '../apps/server/modules/documents/forms.ts';
import { seedOfficialForms } from '../apps/server/modules/documents/catalog-seed.ts';

export const fn03QaTarget = Object.freeze({
  pg: 'anvil-v3-fn03-document-qa-pg', node: 'anvil-v3-fn03-document-qa-node',
  network: 'anvil-v3-fn03-document-qa-net', database: 'anvil_v3_fn03_document_qa',
  artifactRoot: '/qa-data/artifacts', config: '/qa-config/run.json',
  durationMs: 1_800_000, hostPublish: false, httpListen: false,
});

/** 정식 development config와 별개인 시험 전용 입력. 제품 validator는 변경하지 않는다. */
export function validateFn03QaConfig(value: unknown, now = Date.now()) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'FN03_QA_CONFIG_INVALID');
  const v = value as Record<string, unknown>;
  assert.deepEqual(Object.keys(v).sort(), ['appPassword', 'migratorPassword', 'expiresAt', 'issuedAt', 'sha'].sort(), 'FN03_QA_FIELDS_INVALID');
  assert.match(String(v.sha), /^[0-9a-f]{40}$/, 'FN03_QA_SHA_INVALID');
  if (typeof v.appPassword !== 'string' || !/^[0-9a-f]{64}$/.test(v.appPassword)
    || typeof v.migratorPassword !== 'string' || !/^[0-9a-f]{64}$/.test(v.migratorPassword)) throw Error('FN03_QA_PASSWORD_INVALID');
  const issued = Date.parse(String(v.issuedAt)), expires = Date.parse(String(v.expiresAt));
  assert.ok(Number.isFinite(issued) && Number.isFinite(expires) && issued <= now && expires > now
    && expires > issued && expires - issued <= fn03QaTarget.durationMs, 'FN03_QA_LIFETIME_INVALID');
  const db: ClientConfig = { host: fn03QaTarget.pg, port: 5432, database: fn03QaTarget.database,
    user: 'anvil_v3_app', password: String(v.appPassword), application_name: 'anvil-fn03-isolated-qa', connectionTimeoutMillis: 5000 };
  return { db, seedDb: { ...db, user: 'anvil_v3_migrator', password: String(v.migratorPassword) }, sha: String(v.sha), expires };
}

async function run() {
  if (process.argv[2] !== '--execute') {
    assert.ok(process.argv.length === 2 || process.argv[2] === '--plan', 'FN03_QA_MODE_INVALID');
    const schema = await buildExecutionPreparationQaSchema();
    console.log(JSON.stringify({ ...fn03QaTarget, migrationCount: schema.manifest.length,
      manifestHash: createHash('sha256').update(JSON.stringify(schema.manifest)).digest('hex'),
      schemaHash: createHash('sha256').update(schema.schema).digest('hex'), actualExecuted: false, formalDbChanges: 0 })); return;
  }
  // 이 값은 실행 승인을 대신하지 않는다. PMO의 exact 자원 검토 후에만 호출한다.
  assert.equal(process.env.ANVIL_FN03_ISOLATED_QA, 'EXACT_RESOURCE_REVIEW_REQUIRED', 'FN03_QA_BINDING_REQUIRED');
  assert.equal(process.cwd(), '/qa-source', 'FN03_QA_CWD_INVALID');
  const configStat = await lstat(fn03QaTarget.config);
  assert.ok(configStat.isFile() && !configStat.isSymbolicLink() && (configStat.mode & 0o077) === 0, 'FN03_QA_CONFIG_PROTECTION_INVALID');
  assert.equal(await realpath(fn03QaTarget.config), fn03QaTarget.config);
  const config = validateFn03QaConfig(JSON.parse(await readFile(fn03QaTarget.config, 'utf8')));
  assert.equal(process.env.ANVIL_FN03_QA_SHA, config.sha, 'FN03_QA_SHA_BINDING_INVALID');
  const fresh = () => assert.ok(Date.now() < config.expires - 30000, 'FN03_QA_WORK_WINDOW_EXPIRED');
  fresh();
  const pool = executionPreparationQaDatabase(new Pool({ ...config.db, max: 2, query_timeout: 10000, statement_timeout: 10000 }), fresh);
  const seed = executionPreparationQaDatabase(new Pool({ ...config.seedDb, max: 1, query_timeout: 10000, statement_timeout: 10000 }), fresh);
  let app: ReturnType<typeof buildApp> | undefined;
  const markers: string[] = [];
  try {
    const target = (await pool.query("SELECT current_database() db,current_user role,current_setting('server_version_num')::int version,current_setting('is_superuser') super")).rows[0];
    assert.equal(target.db, fn03QaTarget.database); assert.equal(target.role, 'anvil_v3_app');
    assert.ok(target.version >= 150000 && target.version < 160000); assert.equal(target.super, 'off');
    const seedTarget = (await seed.query("SELECT current_database() db,current_user role,current_setting('is_superuser') super")).rows[0];
    assert.equal(seedTarget.db, fn03QaTarget.database); assert.equal(seedTarget.role, 'anvil_v3_migrator'); assert.equal(seedTarget.super, 'off');
    const schema = await buildExecutionPreparationQaSchema();
    const actualManifest = (await pool.query('SELECT id,checksum FROM anvil.schema_migrations ORDER BY id COLLATE "C"')).rows;
    assert.deepEqual(actualManifest, [...schema.manifest].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0), 'FN03_QA_MANIFEST_MISMATCH');
    for (const name of ['users', 'projects', 'artifacts', 'documents'])
      assert.equal((await pool.query('SELECT count(*)::int n FROM anvil.' + name)).rows[0].n, 0, 'FN03_QA_NOT_EMPTY');
    await assert.rejects(lstat(fn03QaTarget.artifactRoot), { code: 'ENOENT' });
    assert.equal(await realpath('/qa-data'), '/qa-data');
    fresh(); await mkdir(fn03QaTarget.artifactRoot, { mode: 0o700 });
    const forms = buildOfficialForms(await readFile('/qa-source/docs/design/공식산출물_양식정의.md'),
      await readFile('/qa-source/docs/design/문서작성_공통기준.md'));
    const catalog = await seed.connect();
    try { await catalog.query('BEGIN'); await seedOfficialForms(catalog, forms); await catalog.query('COMMIT'); }
    catch (error) { await catalog.query('ROLLBACK'); throw error; } finally { catalog.release(); }
    const user = randomUUID(), outsider = randomUUID(), project = randomUUID();
    const password = randomBytes(32).toString('base64url'), phc = await hashPassword(password);
    const access = new AccessRepository(pool, { installationId: randomUUID(), key: randomBytes(32) });
    for (const id of [user, outsider]) {
      await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'FN03 격리 합성 QA','ACTIVE')", [id, 'qa-fn03-' + id]);
      await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)', [id, phc]);
    }
    let login = await access.login('qa-fn03-' + user, password, 'FN03 QA', 'qa-fn03-' + user);
    const other = await access.login('qa-fn03-' + outsider, password, 'FN03 외부 QA', 'qa-fn03-' + outsider);
    await seed.query("INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,'FN03 일회 격리 QA','합성 원문 검수','원문·버전 보존')", [project]);
    await seed.query("INSERT INTO anvil.project_members(project_id,user_id,participation) VALUES($1,$2,'OWNER')", [project, user]);
    await seed.query('INSERT INTO anvil.project_control(project_id,actor_id,client_id,generation) VALUES($1,$2,$3,1)', [project, user, login.clientId]);
    login = await access.reauthenticate(login.token, login.csrfToken, password, 'qa-fn03-' + user);
    app = buildApp({}, undefined, { repository: access, origin: 'https://localhost:3830', artifactRoot: fn03QaTarget.artifactRoot });
    markers.push('ISOLATED_PG15_NON_SUPER_EMPTY');
    const headers = { host: 'localhost:3830', origin: 'https://localhost:3830', cookie: '__Host-anvil.sid=' + login.token, 'x-anvil-csrf': login.csrfToken };
    const bytes = Buffer.from('\uFEFF# 합성 요구사항\r\n원문 공백  \r\n<script>NOT_EXECUTABLE</script>\r\n');
    const hash = createHash('sha256').update(bytes).digest('hex');
    const command = { schemaVersion: 1, projectId: project, commandId: randomUUID(), clientId: login.clientId,
      controlGeneration: 1, operation: 'uploadArtifact', targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null,
      payload: { mediaType: 'text/plain;charset=utf-8', bytes: bytes.length, contentHash: hash } };
    const upload = () => app!.inject({ method: 'POST', url: `/api/v1/projects/${project}/files`, headers: { ...headers,
      'content-type': 'application/octet-stream', 'x-anvil-command': JSON.stringify(command) }, payload: bytes });
    const send = (payload: Record<string, unknown>) => app!.inject({ method: 'POST', url: `/api/v1/projects/${project}/commands`, headers, payload });
    assert.equal((await upload()).statusCode, 412);
    assert.equal((await pool.query('SELECT count(*)::int n FROM anvil.artifacts')).rows[0].n, 0);
    markers.push('NO_POLICY_DENIED_NO_ARTIFACT');
    const policy = await send({ ...command, commandId: randomUUID(), operation: 'savePermissionPolicy', payload: {
      rules: [{ ruleId: 'FN03_SYNTHETIC_ONLY', subjectRef: { kind: 'HUMAN', userId: user },
        targetScopes: [{ kind: 'PROJECT', projectId: project }], operations: ['uploadArtifact'], disposition: 'AUTO',
        limitPolicyRef: null, expiresAt: new Date(config.expires).toISOString() }], reason: '격리 합성 파일 정책', reviewRefs: [] } });
    assert.equal(policy.statusCode, 200); const policyRef = policy.json().data.ref;
    const uploaded = await upload(); assert.equal(uploaded.statusCode, 201);
    const artifact = uploaded.json().data.artifactRef;
    assert.deepEqual((await upload()).json(), uploaded.json());
    const fileUrl = `/api/v1/projects/${project}/files/${artifact.artifactId}`;
    const raw = await app.inject({ method: 'GET', url: fileUrl, headers });
    assert.equal(raw.statusCode, 200); assert.deepEqual(raw.rawPayload, bytes);
    assert.match(String(raw.headers['content-disposition']), /^attachment;/);
    assert.match(String(raw.headers['content-security-policy']), /default-src 'none'/);
    assert.equal((await app.inject({ method: 'GET', url: fileUrl, headers: { ...headers, cookie: '__Host-anvil.sid=' + other.token } })).statusCode, 404);
    const stored = (await seed.query('SELECT storage_key FROM anvil.artifacts WHERE id=$1 AND project_id=$2', [artifact.artifactId, project])).rows[0];
    assert.equal(stored.storage_key, `blobs/${project}/${artifact.artifactId}`);
    const path = fn03QaTarget.artifactRoot + '/' + stored.storage_key;
    assert.deepEqual(await readFile(path), bytes);
    fresh(); await rename(path, path + '.preserved');
    try { assert.equal((await app.inject({ method: 'GET', url: fileUrl, headers })).statusCode, 503); }
    finally { await rename(path + '.preserved', path); }
    markers.push('RAW_BYTES_REPLAY_NON_MEMBER_DENIED_MISSING_FILE_503');
    const formResponse = await app.inject({ method: 'GET', url: '/api/v1/forms/a6f30000-0000-4000-8000-000000000001/versions/1', headers });
    assert.equal(formResponse.statusCode, 200); const form = formResponse.json();
    const document = { ...command, commandId: randomUUID(), operation: 'saveDocumentDraft', payload: {
      title: '첫 원문', formRef: form.ref, stageNodeRef: null, content: { body: artifact, attachments: [], sections: [], sourceRefs: [] },
      importCandidateRef: null, reason: '격리 합성 문서 저장' } };
    assert.equal((await send(document)).statusCode, 403);
    const revisedPolicy = await send({ ...command, commandId: randomUUID(), operation: 'savePermissionPolicy', targetId: policyRef.id, expectedVersion: 1,
      payload: { rules: [{ ruleId: 'FN03_SYNTHETIC_ONLY', subjectRef: { kind: 'HUMAN', userId: user },
        targetScopes: [{ kind: 'PROJECT', projectId: project }], operations: ['uploadArtifact', 'saveDocumentDraft'], disposition: 'AUTO',
        limitPolicyRef: null, expiresAt: new Date(config.expires).toISOString() }], reason: '격리 합성 문서 정책', reviewRefs: [] } });
    assert.equal(revisedPolicy.statusCode, 200);
    const saved = await send(document); assert.equal(saved.statusCode, 200); const ref = saved.json().data.ref;
    assert.deepEqual((await send(document)).json(), saved.json());
    const next = await send({ ...document, commandId: randomUUID(), targetId: ref.id, expectedVersion: 1, payload: { ...document.payload, title: '개정 원문' } });
    assert.equal(next.statusCode, 200); assert.equal(next.json().data.ref.version, 2);
    const docUrl = `/api/v1/projects/${project}/documents/${ref.id}/versions/`;
    for (const [version, title] of [[1, '첫 원문'], [2, '개정 원문']] as const) {
      const result: { statusCode: number; json(): { title: string; content: { body: unknown } } } = await app.inject({ method: 'GET', url: docUrl + version, headers });
      assert.equal(result.statusCode, 200); assert.equal(result.json().title, title); assert.deepEqual(result.json().content.body, artifact);
    }
    assert.equal((await app.inject({ method: 'GET', url: docUrl + '1', headers: { ...headers, cookie: '__Host-anvil.sid=' + other.token } })).statusCode, 404);
    // 다른 연결에서 커밋된 불변 버전/바이트를 조회한다. rollback한 fixture는 합격 근거가 아니다.
    fresh(); const second = executionPreparationQaDatabase(new Pool({ ...config.db, max: 1, query_timeout: 10000, statement_timeout: 10000 }), fresh);
    try {
      assert.equal((await second.query('SELECT count(*)::int n FROM anvil.artifacts WHERE project_id=$1', [project])).rows[0].n, 1);
      assert.equal((await second.query('SELECT count(*)::int n FROM anvil.document_versions WHERE project_id=$1', [project])).rows[0].n, 2);
    } finally { await second.end(); }
    assert.deepEqual(await readFile(path), bytes);
    assert.ok(Date.now() < config.expires, 'FN03_QA_EXPIRED');
    markers.push('DOCUMENT_DENY_SAVE_REPLAY_TWO_VERSIONS_OTHER_CONNECTION');
    console.log(JSON.stringify({ kind: 'FN03_ISOLATED_DOCUMENT_QA', sha: config.sha, markers, actualExecuted: true,
      formalDbChanges: 0, servedBrowserVerified: false, userAcceptance: false, cleanupVerified: false }));
  } finally {
    // 일회 컨테이너의 연결 종료도 무한 대기하지 않는다. 외부 자원 회수는 별도 오케스트레이터 책임이다.
    const closing = setTimeout(() => { console.error('FN03_QA_CONNECTION_CLEANUP_TIMEOUT'); process.exit(1); }, 10000);
    try {
      const closed = await Promise.allSettled([Promise.resolve().then(() => app?.close()), Promise.resolve().then(() => pool.end()), Promise.resolve().then(() => seed.end())]);
      if (closed.some(value => value.status === 'rejected')) throw Error('FN03_QA_CONNECTION_CLEANUP_FAILED');
    } finally { clearTimeout(closing); }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await run(); } catch { console.error('FN03_ISOLATED_QA_FAILED'); process.exitCode = 1; }
}
