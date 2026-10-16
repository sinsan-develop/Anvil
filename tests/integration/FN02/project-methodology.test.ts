import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { validateDevelopmentDbConfig } from '../../../apps/server/storage/development-config.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { hashPassword } from '../../../apps/server/modules/access/service.ts';
import { buildApp } from '../../../apps/server/app.ts';
import { ApiClient, ApiError } from '../../../apps/web/src/api/client.ts';
import { prepareProjectMethod, writeProjectMethod, readProjectMethod, readProjectMethodAtVersion } from '../../../apps/web/src/features/methodology-editor/project-api.ts';

// 결함 검출: 별도 정책·정확 버전 없이 개정/확정, 다른 프로젝트/기기 접근, 확정 후 자동 적용.
test('프로젝트 방법론은 명시 허가로만 개정·검토·확정하고 실행 상태 미확인 적용을 거절한다', async () => {
  if (!process.env.ANVIL_DB_CONFIG || !process.env.ANVIL_MIGRATOR_CONFIG) throw Error('ACTUAL_PROTECTED_DB_REQUIRED_NOT_SKIP');
  const pool = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG, 'utf8')), 'app'));
  const admin = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_MIGRATOR_CONFIG, 'utf8')), 'migrator'));
  const users = [randomUUID(), randomUUID()], ownedUsers: string[] = [], projects = [randomUUID(), randomUUID()], ownedProjects: string[] = [];
  const access = new AccessRepository(pool, { installationId: randomUUID(), key: randomBytes(32) });
  const app = buildApp({}, undefined, { repository: access, origin: 'https://localhost:3830' });
  try {
    const password = randomBytes(32).toString('base64url'), phc = await hashPassword(password);
    for (const id of users) { await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'전용 방법론 합성 QA','ACTIVE')", [id, 'qa-project-method-' + id]); ownedUsers.push(id); await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)', [id, phc]); }
    let own = await access.login('qa-project-method-' + users[0], password, '방법론 QA', 'qa-project-method-' + users[0]);
    const other = await access.login('qa-project-method-' + users[1], password, '격리 QA', 'qa-project-method-' + users[1]);
    const sibling = await access.login('qa-project-method-' + users[0], password, '같은 사람 다른 기기', 'qa-project-method-' + users[0]);
    for (const [index, project] of projects.entries()) { await admin.query("INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,'방법론 합성 QA','원본 보존','절차 개정')", [project]); ownedProjects.push(project); await admin.query("INSERT INTO anvil.project_members(project_id,user_id,participation) VALUES($1,$2,'OWNER')", [project, users[index]]); await admin.query('INSERT INTO anvil.project_control(project_id,actor_id,client_id,generation) VALUES($1,$2,$3,1)', [project, users[index], index ? other.clientId : own.clientId]); }
    const headers = (s = own) => ({ host: 'localhost:3830', origin: 'https://localhost:3830', cookie: '__Host-anvil.sid=' + s.token, 'x-anvil-csrf': s.csrfToken });
    const path = '/api/v1/projects/' + projects[0], get = (url: string, s = own) => app.inject({ method: 'GET', url, headers: headers(s) });
    const command = (operation: string, payload: Record<string, unknown>, targetId: string | null = null, expectedVersion = 0) => ({ schemaVersion: 1, commandId: randomUUID(), projectId: projects[0], clientId: own.clientId, controlGeneration: 1, operation, targetId, expectedVersion, baselineRefs: [], approvalRef: null, payload });
    const send = (payload: Record<string, unknown>, s = own) => app.inject({ method: 'POST', url: path + '/commands', headers: headers(s), payload });
    const original = (await get('/api/v1/methodologies/a6f20000-0000-4000-8000-000000000001/versions/2')).json();
    const copy = command('copyMethodology', { sourceRef: original.ref, name: '프로젝트 절차', scope: 'PROJECT', reason: '공통 원본 보존' });
    assert.equal((await send(copy)).statusCode, 412, '프로젝트 방법론도 명시 정책이 먼저 필요하다');
    own = await access.reauthenticate(own.token, own.csrfToken, password, 'qa-project-method-' + users[0]);
    const operations = ['copyMethodology', 'saveMethodologyDraft', 'recordContentReview', 'confirmMethodology', 'applyMethodology'];
    const policy = await send(command('savePermissionPolicy', { rules: [{ ruleId: 'METHOD_ONLY', subjectRef: { kind: 'HUMAN', userId: users[0] }, operations, targetScopes: [{ kind: 'PROJECT', projectId: projects[0] }], disposition: 'AUTO', limitPolicyRef: null, expiresAt: new Date(Date.now() + 3_600_000).toISOString() }], reason: '합성 사람의 명시 허가', reviewRefs: [] }));
    assert.equal(policy.statusCode, 200, policy.body);
    assert.equal((await send({ ...copy, clientId: sibling.clientId }, sibling)).statusCode, 403);
    assert.equal((await send({ ...copy, clientId: other.clientId }, other)).statusCode, 404);
    const duplicates = await Promise.all([send(copy), send(copy)]);
    for (const result of duplicates) assert.equal(result.statusCode, 200, result.body);
    assert.deepEqual(duplicates[0]!.json(), duplicates[1]!.json());
    const ref = duplicates[0]!.json().data.ref, versionPath = path + '/methodologies/' + ref.id + '/versions/1';
    let view = await get(versionPath); assert.equal(view.statusCode, 200, view.body); assert.equal(view.json().scope, 'PROJECT'); assert.deepEqual(view.json().graph, original.graph); assert.equal(view.json().confirmation, null);
    assert.equal((await get(versionPath, other)).statusCode, 404);
    assert.equal((await get('/api/v1/projects/' + projects[1] + '/methodologies/' + ref.id + '/versions/1', other)).statusCode, 404);
    assert.equal((await get('/api/v1/methodologies/' + ref.id + '/versions/1')).statusCode, 404);
    assert.equal((await send(command('confirmMethodology', { versionRef: ref, reviewRefs: [] }, ref.id, 1))).statusCode, 422);
    const items = ['METHOD_PURPOSE_SCOPE', 'METHOD_FLOW_CONTROL', 'METHOD_INPUT_OUTPUT', 'METHOD_COMPLETION_APPROVAL', 'METHOD_RECORD_LIMITS'].map(criterionId => ({ criterionId, outcome: 'ACCEPTED', evidenceRefs: [], reason: '합성 원문 직접 대조' }));
    const review = command('recordContentReview', { targetKind: 'METHODOLOGY', targetRef: ref, criteriaVersion: 1, items, outcome: 'ACCEPTED', reason: '합성 내용 검토' }, ref.id, 1);
    const reviewed = await send(review); assert.equal(reviewed.statusCode, 200, reviewed.body);
    const reviewRef = reviewed.json().data.reviewRef;
    const confirm = command('confirmMethodology', { versionRef: ref, reviewRefs: [reviewRef] }, ref.id, 1);
    assert.equal((await send({ ...confirm, payload: { ...confirm.payload, versionRef: { ...ref, contentHash: 'f'.repeat(64) } } })).statusCode, 409);
    const confirmed = await send(confirm); assert.equal(confirmed.statusCode, 200, confirmed.body);
    assert.deepEqual((await send(confirm)).json(), confirmed.json());
    view = await get(versionPath); assert.ok(view.json().confirmation); assert.equal(view.json().contentReviews[0].ref.outcome, 'ACCEPTED');
    assert.equal((await pool.query('SELECT count(*)::int n FROM anvil.project_methodologies WHERE project_id=$1', [projects[0]])).rows[0].n, 0, '확정은 적용하지 않는다');
    const rework = await send({ ...review, commandId: randomUUID(), payload: { ...review.payload, outcome: 'REWORK', reason: '추가 보완 필요' } }); assert.equal(rework.statusCode, 200, rework.body);
    assert.equal((await send({ ...confirm, commandId: randomUUID() })).statusCode, 422, '최신 검토가 우선한다');
    const amendment = command('saveMethodologyDraft', { name: '개정 절차', purpose: '프로젝트 목적', scope: 'PROJECT', graph: original.graph, reason: '좌표 외 원문 개정' }, ref.id, 1);
    const amended = await send(amendment); assert.equal(amended.statusCode, 200, amended.body); assert.equal(amended.json().data.ref.version, 2);
    assert.equal((await send({ ...amendment, commandId: randomUUID() })).statusCode, 409);
    const newer = await get(path + '/methodologies/' + ref.id + '/versions/2'); assert.equal(newer.statusCode, 200); assert.equal(newer.json().confirmation, null); assert.deepEqual(newer.json().contentReviews, []);
    assert.equal((await get(versionPath)).json().confirmation.id, confirmed.json().data.confirmationId, '과거 확정 사건 보존');
    assert.deepEqual((await get('/api/v1/methodologies/' + original.ref.id + '/versions/2')).json().graph, original.graph);
    const apply = await send(command('applyMethodology', { methodologyRef: amended.json().data.ref, expectedApplicationVersion: 0, reason: '아직 실행 상태 미확인', acknowledged: true }, projects[0]!, 0));
    assert.equal(apply.statusCode, 412); assert.equal(apply.json().code, 'EXECUTION_STATE_UNVERIFIED');
    const listing = await get(path + '/methodologies'); assert.equal(listing.statusCode, 200, listing.body); assert.equal(listing.json().items.length, 1); assert.equal(listing.json().items[0].ref.version, 2);
    assert.equal((await get(path + '/methodologies?limit=9999')).statusCode, 400);
    await assert.rejects(pool.query('UPDATE anvil.methodology_versions SET reason=$2 WHERE definition_id=$1', [ref.id, '위장']), (e: unknown) => (e as { code: string }).code === '42501');
    await assert.rejects(pool.query('DELETE FROM anvil.methodology_reviews WHERE definition_id=$1', [ref.id]), (e: unknown) => (e as { code: string }).code === '42501');
    assert.equal((await pool.query('SELECT count(*)::int n FROM anvil.delivery_outbox WHERE project_id=ANY($1::uuid[])', [projects])).rows[0].n, 0);
    const webClient = new ApiClient(async (url, init) => {
      const response = await app.inject({ method: (init?.method ?? 'GET') as 'GET' | 'POST', url: String(url), headers: { ...headers(), ...Object.fromEntries(new Headers(init?.headers).entries()) }, ...(init?.body ? { payload: String(init.body) } : {}) });
      return new Response(response.body, { status: response.statusCode, headers: { 'content-type': String(response.headers['content-type'] ?? '') } });
    });
    const session = { user: { id: users[0]! }, clientId: own.clientId, csrfToken: own.csrfToken };
    const webRequest = await prepareProjectMethod(webClient, projects[0]!, session, { schemaVersion: 1, commandId: randomUUID(), clientId: own.clientId, operation: 'saveMethodologyDraft', targetId: null, expectedVersion: 0, payload: { name: '직접 작성 Web 절차', purpose: 'Web 함수와 실제 DB 대조', scope: 'PROJECT', graph: original.graph, reason: '실제 저장 확인' } });
    let dropReceipt = true;
    const lostClient = new ApiClient(async (url, init) => { const response = await webClient.transport.call(globalThis, url, init); if (dropReceipt && init?.method === 'POST') { dropReceipt = false; throw Error('synthetic-method-receipt-lost'); } return response; });
    await assert.rejects(writeProjectMethod(lostClient, webRequest, own.csrfToken), (e: unknown) => e instanceof ApiError && e.code === 'CONNECTION_LOST');
    const webSaved = await writeProjectMethod(webClient, webRequest, own.csrfToken); assert.deepEqual(await writeProjectMethod(webClient, webRequest, own.csrfToken), webSaved);
    assert.equal((await readProjectMethodAtVersion(webClient, projects[0]!, ref.id, 1)).confirmation!.id, confirmed.json().data.confirmationId);
    assert.equal((await readProjectMethodAtVersion(webClient, projects[0]!, ref.id, 2)).confirmation, null);
    const webRef = webSaved.data.ref;
    assert.deepEqual((await readProjectMethod(webClient, projects[0]!, webRef)).graph, original.graph);
    const webReview = await prepareProjectMethod(webClient, projects[0]!, session, { schemaVersion: 1, commandId: randomUUID(), clientId: own.clientId, operation: 'recordContentReview', targetId: webRef.id, expectedVersion: 1, payload: { ...review.payload, targetRef: webRef } });
    const webReviewed = await writeProjectMethod(webClient, webReview, own.csrfToken);
    const webConfirm = await prepareProjectMethod(webClient, projects[0]!, session, { schemaVersion: 1, commandId: randomUUID(), clientId: own.clientId, operation: 'confirmMethodology', targetId: webRef.id, expectedVersion: 1, payload: { versionRef: webRef, reviewRefs: [webReviewed.data.reviewRef] } });
    const webConfirmed = await writeProjectMethod(webClient, webConfirm, own.csrfToken);
    assert.equal((await readProjectMethod(webClient, projects[0]!, webRef)).confirmation!.id, webConfirmed.data.confirmationId);
    await admin.query('UPDATE anvil.methodology_versions SET reason=$2 WHERE definition_id=$1', [webRef.id, '합성 무결성 음성']);
    assert.equal((await get(path + '/methodologies/' + webRef.id + '/versions/1')).statusCode, 503, '실제 원문/receipt 불일치 거절');
    await admin.query('UPDATE anvil.methodology_versions SET reason=$2 WHERE definition_id=$1', [webRef.id, '실제 저장 확인']);
    assert.equal((await get(path + '/methodologies/' + webRef.id + '/versions/1')).statusCode, 200);
    assert.equal((await pool.query('SELECT count(*)::int n FROM anvil.project_methodologies WHERE project_id=$1', [projects[0]])).rows[0].n, 0);
    await admin.query('UPDATE anvil.project_control SET generation=2 WHERE project_id=$1', [projects[0]]);
    assert.equal((await send(copy)).statusCode, 409, '옛 세대 replay 차단');
  } finally {
    await app.close(); const db = await admin.connect();
    try {
      await db.query('BEGIN'); await db.query('SET CONSTRAINTS ALL DEFERRED');
      if ((await db.query("SELECT to_regclass('anvil.project_methodology_writes') AS present")).rows[0].present) await db.query('DELETE FROM anvil.project_methodology_writes WHERE project_id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('DELETE FROM anvil.content_reviews WHERE project_id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('DELETE FROM anvil.methodology_reviews WHERE definition_id IN(SELECT id FROM anvil.methodology_definitions WHERE project_id=ANY($1::uuid[]))', [ownedProjects]);
      await db.query('DELETE FROM anvil.methodology_versions WHERE definition_id IN(SELECT id FROM anvil.methodology_definitions WHERE project_id=ANY($1::uuid[]))', [ownedProjects]);
      await db.query('DELETE FROM anvil.methodology_definitions WHERE project_id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('DELETE FROM anvil.audit_events WHERE project_id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('UPDATE anvil.permission_policies SET head_version=head_version+1 WHERE project_id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('DELETE FROM anvil.permission_policy_versions WHERE project_id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('DELETE FROM anvil.permission_policies WHERE project_id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('UPDATE anvil.commands SET authorization_receipt_id=NULL WHERE project_id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('DELETE FROM anvil.authorization_receipts WHERE scope_id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('DELETE FROM anvil.commands WHERE project_id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('DELETE FROM anvil.project_control WHERE project_id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('DELETE FROM anvil.project_members WHERE project_id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('DELETE FROM anvil.projects WHERE id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('DELETE FROM anvil.auth_audit_events WHERE subject_ref=ANY($1::uuid[])', [ownedUsers]);
      await db.query('DELETE FROM anvil.auth_sessions WHERE user_id=ANY($1::uuid[])', [ownedUsers]);
      await db.query('DELETE FROM anvil.clients WHERE user_id=ANY($1::uuid[])', [ownedUsers]);
      await db.query('DELETE FROM anvil.password_credentials WHERE user_id=ANY($1::uuid[])', [ownedUsers]);
      await db.query('DELETE FROM anvil.users WHERE id=ANY($1::uuid[])', [ownedUsers]);
      await db.query('COMMIT');
    } catch (e) { await db.query('ROLLBACK'); throw e; }
    finally { db.release(); await pool.end(); await admin.end(); }
  }
});
