import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { validateDevelopmentDbConfig } from '../../../apps/server/storage/development-config.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { hashPassword } from '../../../apps/server/modules/access/service.ts';
import { buildApp } from '../../../apps/server/app.ts';

// 결함 검출 대상: 초안 생성의 중복 소비·현재 client/소유권 누락·snapshot 누락·실행 권한 생성.
test('최초 프로젝트는 저장 초안을 한 번만 원자 소비하고 소유자/client 제어와 고정 방법론을 재조회한다', async () => {
  if (!process.env.ANVIL_DB_CONFIG || !process.env.ANVIL_MIGRATOR_CONFIG) throw Error('ACTUAL_PROTECTED_DB_REQUIRED_NOT_SKIP');
  const config = validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG, 'utf8')), 'app');
  const pool = new Pool(config), admin = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_MIGRATOR_CONFIG, 'utf8')), 'migrator'));
  const users = [randomUUID(), randomUUID()], ownedUsers: string[] = [], key = randomBytes(32);
  const access = new AccessRepository(pool, { installationId: randomUUID(), key });
  const app = buildApp({}, undefined, { repository: access, origin: 'https://localhost:3830' });
  try {
    const password = randomBytes(32).toString('base64url'), phc = await hashPassword(password);
    for (const id of users) {
      await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'최초 프로젝트 합성 QA','ACTIVE')", [id, 'qa-project-create-' + id]);
      ownedUsers.push(id);
      await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)', [id, phc]);
    }
    const login = await access.login('qa-project-create-' + users[0], password, '생성 QA', 'qa-project-create-' + users[0]);
    const other = await access.login('qa-project-create-' + users[1], password, '격리 QA', 'qa-project-create-' + users[1]);
    const sibling = await access.login('qa-project-create-' + users[0], password, '다른 client QA', 'qa-project-create-' + users[0]);
    const headers = { host: 'localhost:3830', origin: 'https://localhost:3830', cookie: '__Host-anvil.sid=' + login.token, 'x-anvil-csrf': login.csrfToken };
    const siblingHeaders = { ...headers, cookie: '__Host-anvil.sid=' + sibling.token, 'x-anvil-csrf': sibling.csrfToken };
    const otherHeaders = { ...headers, cookie: '__Host-anvil.sid=' + other.token, 'x-anvil-csrf': other.csrfToken };
    const original = (await app.inject({ method: 'GET', url: '/api/v1/methodologies/a6f20000-0000-4000-8000-000000000001/versions/2', headers })).json();
    const input = { name: '최초 원본 QA ' + users[0], purpose: 'Agent와 독립적인 프로젝트 원본', desiredOutcome: '저장과 재조회', sourceMode: 'EMPTY', methodologySelection: { kind: 'CONFIRMED_REFERENCE', versionRef: original.ref }, artifactRefs: [] };
    async function draft(purpose = input.purpose) {
      const response = await app.inject({ method: 'POST', url: '/api/v1/project-drafts', headers, payload: { schemaVersion: 1, commandId: randomUUID(), clientId: login.clientId, targetId: null, expectedVersion: 0, ...input, purpose } });
      assert.equal(response.statusCode, 201, response.body); return response.json();
    }
    const saved = await draft();
    const body = { schemaVersion: 1, commandId: randomUUID(), clientId: login.clientId, draftId: saved.draftId, draftVersion: 1 };
    const send = (payload: Record<string, unknown>, h = headers) => app.inject({ method: 'POST', url: '/api/v1/projects', headers: h, payload });
    assert.equal((await send({ ...body, clientId: other.clientId }, otherHeaders)).statusCode, 404, '다른 소유자는 초안 존재도 알 수 없다');
    assert.equal((await send({ ...body, clientId: sibling.clientId }, siblingHeaders)).statusCode, 403, '같은 사람의 다른 client는 생성 불가');
    assert.equal((await send({ ...body, draftVersion: 2 })).statusCode, 409);
    assert.equal((await send(body, { ...headers, 'x-anvil-csrf': randomBytes(32).toString('base64url') })).statusCode, 403);
    const creates = await Promise.all([send(body), send(body)]);
    for (const response of creates) assert.equal(response.statusCode, 201, response.body);
    const project = creates[0]!.json();
    assert.deepEqual(creates[1]!.json(), project);
    assert.equal(project.name, input.name); assert.equal(project.purpose, input.purpose);
    assert.equal(project.participation, 'OWNER'); assert.equal(project.controlState.status, 'HELD');
    assert.equal(project.controlState.generation, 1); assert.equal(project.controlState.clientId, login.clientId);
    assert.deepEqual(project.currentMethodologyRef, { id: project.currentMethodologyRef.id, version: 1, contentHash: project.currentMethodologyRef.contentHash });
    assert.equal(project.baselineRef, null);
    assert.ok(project.readinessIssues.some((issue: { code: string }) => issue.code === 'PERMISSION_POLICY_UNCONFIGURED'));
    assert.ok(!project.readinessIssues.some((issue: { code: string }) => issue.code === 'METHODOLOGY_CONNECTION_PENDING'));
    assert.equal((await send({ ...body, commandId: randomUUID() })).statusCode, 409);
    assert.equal((await send({ ...body, draftVersion: 2 })).statusCode, 409, '동일 command 다른 내용 충돌');
    assert.equal((await send({ ...body, clientId: sibling.clientId }, siblingHeaders)).statusCode, 403, '재전송도 client 권한 검사');
    const snapshot = (await pool.query('SELECT * FROM anvil.project_methodologies WHERE project_id=$1', [project.id])).rows;
    assert.equal(snapshot.length, 1); assert.equal(snapshot[0].source_hash, original.ref.contentHash);
    assert.deepEqual(snapshot[0].snapshot_json.graph, original.graph);
    assert.equal((await pool.query('SELECT consumed_project_id FROM anvil.project_drafts WHERE id=$1', [saved.draftId])).rows[0].consumed_project_id, project.id);
    assert.equal((await pool.query('SELECT count(*)::int n FROM anvil.project_control WHERE project_id=$1', [project.id])).rows[0].n, 1);
    assert.equal((await pool.query('SELECT count(*)::int n FROM anvil.audit_events WHERE project_id=$1', [project.id])).rows[0].n, 1);
    assert.equal((await pool.query('SELECT count(*)::int n FROM anvil.delivery_outbox WHERE project_id=$1', [project.id])).rows[0].n, 0, '프로젝트 생성은 Agent 호출 아님');
    const secondPool = new Pool(config), secondApp = buildApp({}, undefined, { repository: new AccessRepository(secondPool, { installationId: randomUUID(), key }), origin: 'https://localhost:3830' });
    try {
      const reloaded = await secondApp.inject({ method: 'GET', url: '/api/v1/projects/' + project.id, headers });
      assert.equal(reloaded.statusCode, 200); assert.deepEqual(reloaded.json().currentMethodologyRef, project.currentMethodologyRef);
      assert.equal((await secondApp.inject({ method: 'GET', url: '/api/v1/projects/' + project.id, headers: otherHeaders })).statusCode, 404);
      assert.equal((await secondApp.inject({ method: 'GET', url: '/api/v1/projects/' + project.id, headers: siblingHeaders })).json().controlState.status, 'OTHER_CLIENT');
      const list = await secondApp.inject({ method: 'GET', url: '/api/v1/projects', headers });
      assert.equal(list.json().items.filter((item: { id: string }) => item.id === project.id).length, 1);
    } finally { await secondApp.close(); await secondPool.end(); }
    // 결함 검출 대상: 새 전용 방법론의 검토·확정 누락/위조/최신 REWORK 및 변경 후 승계.
    const directInput = { ...input, name: '직접 정의 프로젝트 ' + users[0], methodologySelection: { kind: 'NEW_PROJECT_DRAFT', name: '전용 개발 절차', purpose: '직접 작성한 절차', graph: original.graph, sourceRefs: [original.ref], reviewRefs: [] } };
    const directResponse = await app.inject({ method: 'POST', url: '/api/v1/project-drafts', headers, payload: { schemaVersion: 1, commandId: randomUUID(), clientId: login.clientId, targetId: null, expectedVersion: 0, ...directInput } });
    assert.equal(directResponse.statusCode, 201); const direct = directResponse.json();
    const directCreate = { ...body, commandId: randomUUID(), draftId: direct.draftId };
    assert.equal((await send(directCreate)).statusCode, 422, '미확정 직접 방법론은 프로젝트 생성 불가');
    const draftPath = '/api/v1/project-drafts/' + direct.draftId;
    const codes = ['METHOD_PURPOSE_SCOPE', 'METHOD_FLOW_CONTROL', 'METHOD_INPUT_OUTPUT', 'METHOD_COMPLETION_APPROVAL', 'METHOD_RECORD_LIMITS'];
    const targetRef = { id: direct.draftId, version: 1, contentHash: original.ref.contentHash };
    const reviewPayload = { targetKind: 'DRAFT_METHODOLOGY', targetRef, criteriaVersion: 1, items: codes.map(criterionId => ({ criterionId, outcome: 'ACCEPTED', evidenceRefs: [], reason: '합성 원문을 직접 대조한 판단' })), outcome: 'ACCEPTED', reason: '합성 초안 내용 검토' };
    const command = (operation: string, payload: Record<string, unknown>, expectedVersion = 1, commandId = randomUUID()) => ({ schemaVersion: 1, commandId, clientId: login.clientId, targetId: direct.draftId, expectedVersion, operation, payload });
    const draftSend = (payload: Record<string, unknown>, h = headers) => app.inject({ method: 'POST', url: draftPath + '/commands', headers: h, payload });
    const record = command('recordContentReview', reviewPayload);
    const recorded = await draftSend(record);
    assert.equal(recorded.statusCode, 200, recorded.body);
    const reviewed = recorded.json().data.reviewRef;
    assert.equal(reviewed.targetRef.id, direct.draftId); assert.equal(reviewed.outcome, 'ACCEPTED');
    assert.deepEqual((await draftSend(record)).json(), recorded.json(), '동일 명령은 검토 중복0');
    assert.equal((await draftSend({ ...record, payload: { ...reviewPayload, reason: '변조' } })).statusCode, 409);
    assert.equal((await draftSend({ ...record, clientId: sibling.clientId }, siblingHeaders)).statusCode, 403);
    assert.equal((await draftSend({ ...record, clientId: other.clientId }, otherHeaders)).statusCode, 404);
    assert.equal((await draftSend(command('executeAgent', {}))).statusCode, 400, '초안은 범용 실행 경로가 아니다');
    const confirm = (refs: unknown[]) => command('confirmDraftMethodology', { draftVersion: 1, graphHash: original.ref.contentHash, reviewRefs: refs });
    assert.equal((await draftSend(confirm([{ ...reviewed, id: randomUUID() }]))).statusCode, 422);
    const rework = await draftSend(command('recordContentReview', { ...reviewPayload, items: reviewPayload.items.map(item => ({ ...item, outcome: 'REWORK' })), outcome: 'REWORK' }));
    assert.equal(rework.statusCode, 200);
    assert.equal((await draftSend(confirm([reviewed]))).statusCode, 422, '옛 ACCEPTED는 최신 REWORK를 우회하지 못함');
    const accepted = await draftSend(command('recordContentReview', reviewPayload));
    assert.equal(accepted.statusCode, 200); const review2 = accepted.json().data.reviewRef;
    assert.equal((await draftSend(confirm([review2]))).statusCode, 200);
    const beforeEdit = (await app.inject({ method: 'GET', url: draftPath, headers })).json();
    assert.equal(beforeEdit.methodologyState.confirmation.decidedBy, users[0]);
    assert.equal(beforeEdit.methodologyState.contentReviews[0].reviewerSubjectRef.sameAsTargetRecorder, true, '자기 검토는 독립 검수로 위장하지 않는다');
    const patched = await app.inject({ method: 'PATCH', url: draftPath, headers, payload: { schemaVersion: 1, commandId: randomUUID(), clientId: login.clientId, expectedVersion: 1, step: 2, input: { ...directInput, purpose: '프로젝트 목적 수정' } } });
    assert.equal(patched.statusCode, 200); assert.equal(patched.json().version, 2);
    assert.equal((await app.inject({ method: 'GET', url: draftPath, headers })).json().methodologyState.confirmation, null);
    assert.equal((await send({ ...directCreate, draftVersion: 2 })).statusCode, 422, '새 초안 버전에 옛 확정이 승계되지 않는다');
    const nextTarget = { ...targetRef, version: 2 };
    const nextReview = await draftSend(command('recordContentReview', { ...reviewPayload, targetRef: nextTarget }, 2));
    assert.equal(nextReview.statusCode, 200);
    assert.equal((await draftSend(command('confirmDraftMethodology', { draftVersion: 2, graphHash: original.ref.contentHash, reviewRefs: [nextReview.json().data.reviewRef] }, 2))).statusCode, 200);
    const directProject = await send({ ...directCreate, draftVersion: 2 });
    assert.equal(directProject.statusCode, 201, directProject.body);
    const dedicated = (await pool.query('SELECT d.scope,d.project_id,v.graph_json FROM anvil.project_methodologies p JOIN anvil.methodology_definitions d ON d.id=p.source_definition_id JOIN anvil.methodology_versions v ON v.definition_id=d.id AND v.version=p.source_version WHERE p.project_id=$1', [directProject.json().id])).rows[0];
    assert.equal(dedicated.scope, 'PROJECT'); assert.equal(dedicated.project_id, directProject.json().id); assert.deepEqual(dedicated.graph_json, original.graph);
    assert.equal((await draftSend(command('recordContentReview', { ...reviewPayload, targetRef: nextTarget }, 2))).statusCode, 412, '소비 초안은 더 이상 개정/검토하지 않는다');
    const rollbackDraft = await draft();
    const faultPool = new Pool(config);
    // 실제 PG transaction 중 감사 INSERT 지점에 DB 오류를 주입한다. 결과는 실제 DB 원본으로 검사한다.
    const faultAccess = new AccessRepository(new Proxy(faultPool, { get(target, property) {
      if (property === 'connect') return async () => {
        const connection = await target.connect();
        return new Proxy(connection, { get(db, key) {
          if (key === 'query') return (sql: string, values?: unknown[]) => sql.startsWith('INSERT INTO anvil.audit_events') ? db.query('SELECT 1/0') : db.query(sql, values);
          const value = Reflect.get(db, key); return typeof value === 'function' ? value.bind(db) : value;
        } });
      };
      const value = Reflect.get(target, property); return typeof value === 'function' ? value.bind(target) : value;
    } }), { installationId: randomUUID(), key });
    const faultApp = buildApp({}, undefined, { repository: faultAccess, origin: 'https://localhost:3830' });
    try {
      const failed = await faultApp.inject({ method: 'POST', url: '/api/v1/projects', headers, payload: { ...body, commandId: randomUUID(), draftId: rollbackDraft.draftId } });
      assert.equal(failed.statusCode, 503); assert.equal(failed.json().code, 'STORAGE_FAILED');
      assert.equal((await pool.query('SELECT consumed_project_id FROM anvil.project_drafts WHERE id=$1', [rollbackDraft.draftId])).rows[0].consumed_project_id, null);
      assert.equal((await pool.query("SELECT count(*)::int n FROM anvil.commands WHERE draft_id=$1 AND operation='createProject'", [rollbackDraft.draftId])).rows[0].n, 0);
      assert.equal((await pool.query('SELECT count(*)::int n FROM anvil.project_members WHERE user_id=$1', [users[0]])).rows[0].n, 2, '프로젝트/멤버/제어/snapshot/명령/receipt가 모두 rollback되어 추가 원본이 없다');
    } finally { await faultApp.close(); await faultPool.end(); }
    const blank = await draft('');
    assert.equal((await send({ ...body, commandId: randomUUID(), draftId: blank.draftId })).statusCode, 422);
    assert.equal((await pool.query('SELECT consumed_project_id FROM anvil.project_drafts WHERE id=$1', [blank.draftId])).rows[0].consumed_project_id, null);
    assert.equal((await pool.query('SELECT count(*)::int n FROM anvil.project_members WHERE user_id=$1', [users[0]])).rows[0].n, 2);
    await assert.rejects(pool.query('UPDATE anvil.project_methodologies SET snapshot_hash=$2 WHERE project_id=$1', [project.id, '0'.repeat(64)]), (error: unknown) => (error as { code: string }).code === '42501');
    const sourceDeclaration={hostLabel:'합성 Windows PC',displayName:'기존 소스 선언',pathHint:'D:\\Synthetic\\NotOpened',reason:'실제 폴더 접근 없는 사용자 선언'};
    const sourceDraftCommand={schemaVersion:1,commandId:randomUUID(),clientId:login.clientId,targetId:null,expectedVersion:0,...input,sourceMode:'EXISTING',sourceDeclaration};
    const sourceDraft=await app.inject({method:'POST',url:'/api/v1/project-drafts',headers,payload:sourceDraftCommand});assert.equal(sourceDraft.statusCode,201,sourceDraft.body);assert.equal(sourceDraft.json().sourceDeclaration.authority,'USER_DECLARED');assert.equal(sourceDraft.json().sourceDeclaration.readiness,'UNVERIFIED');assert.deepEqual(sourceDraft.json().sourceDeclaration.declaration,sourceDeclaration);
    assert.deepEqual((await app.inject({method:'POST',url:'/api/v1/project-drafts',headers,payload:sourceDraftCommand})).json(),sourceDraft.json());
    const sourceDraftId=sourceDraft.json().draftId,sourceDraftPath='/api/v1/project-drafts/'+sourceDraftId,sourceSnapshot=sourceDraft.json().sourceDeclaration;
    assert.deepEqual((await app.inject({method:'GET',url:sourceDraftPath,headers})).json().sourceDeclaration,sourceSnapshot);assert.equal((await app.inject({method:'GET',url:sourceDraftPath,headers:otherHeaders})).statusCode,404);
    const amendedSource={...sourceDeclaration,reason:'사용자가 경로 설명을 정정했다'},patchSource={schemaVersion:1,commandId:randomUUID(),clientId:login.clientId,expectedVersion:1,step:1,input:{...input,sourceMode:'EXISTING',sourceDeclaration:amendedSource}};
    const changedSource=await app.inject({method:'PATCH',url:sourceDraftPath,headers,payload:patchSource});assert.equal(changedSource.statusCode,200,changedSource.body);assert.equal(changedSource.json().sourceDeclaration.ref.version,2);assert.deepEqual((await pool.query('SELECT declaration_json FROM anvil.source_declaration_versions WHERE draft_id=$1 AND version=1',[sourceDraftId])).rows[0].declaration_json,sourceDeclaration);
    const sourceCreation={...body,commandId:randomUUID(),draftId:sourceDraftId,draftVersion:2};assert.equal((await send({...sourceCreation,draftVersion:1})).statusCode,409);const sourceCreates=await Promise.all([send(sourceCreation),send(sourceCreation)]);for(const response of sourceCreates)assert.equal(response.statusCode,201,response.body);assert.deepEqual(sourceCreates[0]!.json(),sourceCreates[1]!.json());const sourceProject=sourceCreates[0]!.json();assert.equal(sourceProject.sourceMode,'EXISTING');assert.equal(sourceProject.sourceDeclaration.readiness,'UNVERIFIED');assert.deepEqual(sourceProject.sourceDeclaration.declaration,amendedSource);assert.equal(sourceProject.baselineRef,null);assert.ok(sourceProject.readinessIssues.some((i:any)=>i.code==='SOURCE_DECLARATION_UNVERIFIED'));
    const sourceProjectView=await app.inject({method:'GET',url:'/api/v1/projects/'+sourceProject.id,headers});assert.equal(sourceProjectView.statusCode,200,sourceProjectView.body);assert.deepEqual(sourceProjectView.json().sourceDeclaration,sourceProject.sourceDeclaration);assert.equal((await app.inject({method:'GET',url:'/api/v1/projects/'+sourceProject.id,headers:otherHeaders})).statusCode,404);
    assert.equal((await pool.query('SELECT count(*)::int n FROM anvil.project_source_declarations WHERE project_id=$1',[sourceProject.id])).rows[0].n,1);assert.equal((await pool.query('SELECT count(*)::int n FROM anvil.delivery_outbox WHERE project_id=$1',[sourceProject.id])).rows[0].n,0);
    await assert.rejects(pool.query("UPDATE anvil.source_declarations SET readiness='VERIFIED' WHERE draft_id=$1",[sourceDraftId]),(e:unknown)=>(e as{code:string}).code==='42501');await assert.rejects(pool.query('DELETE FROM anvil.project_source_declarations WHERE project_id=$1',[sourceProject.id]),(e:unknown)=>(e as{code:string}).code==='42501');
  } finally {
    await app.close(); const db = await admin.connect();
    try {
      await db.query('BEGIN'); await db.query('SET CONSTRAINTS ALL DEFERRED');
      const drafts = (await db.query('SELECT id,consumed_project_id FROM anvil.project_drafts WHERE owner_user_id=ANY($1::uuid[])', [ownedUsers])).rows;
      const draftIds = drafts.map(row => row.id), projects = drafts.map(row => row.consumed_project_id).filter(Boolean);
      if((await db.query("SELECT to_regclass('anvil.source_declaration_versions') present")).rows[0].present){await db.query('DELETE FROM anvil.project_source_declarations WHERE project_id=ANY($1::uuid[])',[projects]);await db.query('DELETE FROM anvil.source_declaration_versions WHERE draft_id=ANY($1::uuid[])',[draftIds]);await db.query('DELETE FROM anvil.source_declarations WHERE draft_id=ANY($1::uuid[])',[draftIds]);}
      await db.query('UPDATE anvil.project_drafts SET consumed_project_id=NULL WHERE id=ANY($1::uuid[])', [draftIds]);
      if ((await db.query("SELECT to_regclass('anvil.draft_methodology_reviews') AS present")).rows[0].present) await db.query('DELETE FROM anvil.draft_methodology_reviews WHERE draft_id=ANY($1::uuid[])', [draftIds]);
      await db.query('DELETE FROM anvil.content_reviews WHERE draft_id=ANY($1::uuid[])', [draftIds]);
      await db.query('DELETE FROM anvil.project_methodologies WHERE project_id=ANY($1::uuid[])', [projects]);
      await db.query('DELETE FROM anvil.methodology_versions WHERE definition_id IN (SELECT id FROM anvil.methodology_definitions WHERE project_id=ANY($1::uuid[]))', [projects]);
      await db.query('DELETE FROM anvil.methodology_definitions WHERE project_id=ANY($1::uuid[])', [projects]);
      await db.query('DELETE FROM anvil.audit_events WHERE project_id=ANY($1::uuid[])', [projects]);
      await db.query('DELETE FROM anvil.draft_audit_events WHERE draft_id=ANY($1::uuid[])', [draftIds]);
      await db.query('UPDATE anvil.commands SET authorization_receipt_id=NULL WHERE draft_id=ANY($1::uuid[]) OR project_id=ANY($2::uuid[])', [draftIds, projects]);
      await db.query('DELETE FROM anvil.authorization_receipts WHERE command_id IN (SELECT id FROM anvil.commands WHERE draft_id=ANY($1::uuid[]) OR project_id=ANY($2::uuid[]))', [draftIds, projects]);
      await db.query('DELETE FROM anvil.commands WHERE draft_id=ANY($1::uuid[]) OR project_id=ANY($2::uuid[])', [draftIds, projects]);
      await db.query('DELETE FROM anvil.project_control WHERE project_id=ANY($1::uuid[])', [projects]);
      await db.query('DELETE FROM anvil.project_members WHERE project_id=ANY($1::uuid[])', [projects]);
      await db.query('DELETE FROM anvil.projects WHERE id=ANY($1::uuid[])', [projects]);
      await db.query('DELETE FROM anvil.project_drafts WHERE id=ANY($1::uuid[])', [draftIds]);
      await db.query('DELETE FROM anvil.auth_sessions WHERE user_id=ANY($1::uuid[])', [ownedUsers]);
      await db.query('DELETE FROM anvil.clients WHERE user_id=ANY($1::uuid[])', [ownedUsers]);
      await db.query('DELETE FROM anvil.password_credentials WHERE user_id=ANY($1::uuid[])', [ownedUsers]);
      await db.query('DELETE FROM anvil.users WHERE id=ANY($1::uuid[])', [ownedUsers]);
      await db.query('COMMIT');
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); await pool.end(); await admin.end(); }
  }
});
