import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, lstat, mkdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { Pool } from 'pg';
import { validateDevelopmentDbConfig } from '../../../apps/server/storage/development-config.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { hashPassword } from '../../../apps/server/modules/access/service.ts';
import { buildApp } from '../../../apps/server/app.ts';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';

// 결함 검출: 단계/양식/프로젝트 혼동, 현재 적용본의 자동 교체와 과거 문서 연결 손실.
test('문서는 실제 고정 적용 단계·정확 양식에만 연결되고 과거 버전과 미연결 초안을 보존한다', async () => {
  if (!process.env.ANVIL_DB_CONFIG || !process.env.ANVIL_MIGRATOR_CONFIG) throw Error('ACTUAL_PROTECTED_DB_REQUIRED_NOT_SKIP');
  const pool = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG, 'utf8')), 'app'));
  const admin = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_MIGRATOR_CONFIG, 'utf8')), 'migrator'));
  const users = [randomUUID(), randomUUID()], projects = [randomUUID(), randomUUID()], applications = [randomUUID(), randomUUID()], ownedUsers: string[] = [], ownedProjects: string[] = [];
  const root = join(tmpdir(), 'anvil-v3-document-qa-' + users[0]), access = new AccessRepository(pool, { installationId: randomUUID(), key: randomBytes(32) });
  const app = buildApp({}, undefined, { repository: access, origin: 'https://localhost:3830', artifactRoot: root }); let rootCreated = false;
  try {
    const password = randomBytes(32).toString('base64url'), phc = await hashPassword(password);
    for (const id of users) { await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'단계 문서 합성 QA','ACTIVE')", [id, 'qa-document-storage-' + id]); ownedUsers.push(id); await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)', [id, phc]); }
    let own = await access.login('qa-document-storage-' + users[0], password, '단계 문서 QA', 'qa-document-storage-' + users[0]);
    const other = await access.login('qa-document-storage-' + users[1], password, '다른 프로젝트', 'qa-document-storage-' + users[1]);
    const original = (await admin.query("SELECT v.* FROM anvil.methodology_versions v WHERE v.definition_id='a6f20000-0000-4000-8000-000000000001' AND v.version=2")).rows[0];
    const sourceRef = { id: original.definition_id, version: 2, contentHash: original.content_hash }, snapshot = { name: original.name, purpose: original.purpose, graph: original.graph_json, sourceRef }, snapshotHash = contentHash(canonicalJson(snapshot));
    const node = snapshot.graph.nodes.find((n: any) => n.outputs.length > 0), formRef = node.outputs[0].formRef;
    for (const [index, project] of projects.entries()) {
      await admin.query("INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,'단계 연결 합성 QA','불변 자료','실제 단계 연결')", [project]); ownedProjects.push(project);
      await admin.query("INSERT INTO anvil.project_members(project_id,user_id,participation) VALUES($1,$2,'OWNER')", [project, users[index]]);
      await admin.query('INSERT INTO anvil.project_control(project_id,actor_id,client_id,generation) VALUES($1,$2,$3,1)', [project, users[index], index ? other.clientId : own.clientId]);
      await admin.query('INSERT INTO anvil.project_methodologies(id,project_id,application_version,source_definition_id,source_version,source_hash,snapshot_json,snapshot_hash,created_by) VALUES($1,$2,1,$3,2,$4,$5,$6,$7)', [applications[index], project, sourceRef.id, sourceRef.contentHash, JSON.stringify(snapshot), snapshotHash, users[index]]);
    }
    own = await access.reauthenticate(own.token, own.csrfToken, password, 'qa-document-storage-' + users[0]);
    const headers = (s = own) => ({ host: 'localhost:3830', origin: 'https://localhost:3830', cookie: '__Host-anvil.sid=' + s.token, 'x-anvil-csrf': s.csrfToken });
    const path = '/api/v1/projects/' + projects[0], query = '?formId=' + formRef.id + '&formVersion=' + formRef.version + '&formHash=' + formRef.contentHash;
    const optionsPath = path + '/documents/stage-options' + query;
    const initialOptions = await app.inject({ method: 'GET', url: optionsPath, headers: headers() });
    assert.equal(initialOptions.statusCode, 200, initialOptions.body); assert.ok(initialOptions.json().items.some((item: any) => item.stageNodeRef.nodeId === node.nodeId));
    assert.equal(initialOptions.json().applicationRef.id, applications[0]);
    assert.equal((await app.inject({ method: 'GET', url: optionsPath, headers: headers(other) })).statusCode, 404);
    assert.equal((await app.inject({ method: 'GET', url: optionsPath + '&extra=1', headers: headers() })).statusCode, 400);
    await assert.rejects(lstat(root), (e: unknown) => (e as { code: string }).code === 'ENOENT'); await mkdir(root, { mode: 0o700 }); rootCreated = true;
    const command = (operation: string, payload: Record<string, unknown>, targetId: string | null = null, expectedVersion = 0) => ({ schemaVersion: 1, projectId: projects[0], commandId: randomUUID(), clientId: own.clientId, controlGeneration: 1, operation, targetId, expectedVersion, baselineRefs: [], approvalRef: null, payload });
    const send = (payload: Record<string, unknown>) => app.inject({ method: 'POST', url: path + '/commands', headers: headers(), payload });
    const permission = await send(command('savePermissionPolicy', { rules: [{ ruleId: 'DOC_STAGE_QA', subjectRef: { kind: 'HUMAN', userId: users[0] }, operations: ['uploadArtifact', 'saveDocumentDraft'], targetScopes: [{ kind: 'PROJECT', projectId: projects[0] }], disposition: 'AUTO', limitPolicyRef: null, expiresAt: new Date(Date.now() + 3_600_000).toISOString() }], reason: '합성 문서 단계 저장 허가', reviewRefs: [] }));
    assert.equal(permission.statusCode, 200, permission.body);
    const definition = (await admin.query('SELECT definition_json FROM anvil.form_versions WHERE definition_id=$1 AND version=$2', [formRef.id, formRef.version])).rows[0].definition_json;
    const bytes = Buffer.from(definition.items.map((item: any) => item.title + '\n합성 원문 내용').join('\n'), 'utf8'), uploadCommand = command('uploadArtifact', { mediaType: 'text/plain;charset=utf-8', bytes: bytes.length, contentHash: createHash('sha256').update(bytes).digest('hex') });
    const upload = await app.inject({ method: 'POST', url: path + '/files', headers: { ...headers(), 'content-type': 'application/octet-stream', 'x-anvil-command': JSON.stringify(uploadCommand) }, payload: bytes }); assert.equal(upload.statusCode, 201, upload.body);
    const content = { body: upload.json().data.artifactRef, attachments: [], sections: definition.items.map((item: any, index: number) => ({ itemId: item.itemId, anchor: 'line:' + (index * 2 + 1) })), sourceRefs: [] };
    const stageNodeRef = { applicationId: applications[0], nodeId: node.nodeId }, payload = { title: '단계 문서', formRef, stageNodeRef, content, importCandidateRef: null, reason: '정확 적용 단계에 연결' };
    assert.equal((await send(command('saveDocumentDraft', { ...payload, stageNodeRef: { ...stageNodeRef, applicationId: applications[1] } }))).statusCode, 404);
    assert.equal((await send(command('saveDocumentDraft', { ...payload, stageNodeRef: { ...stageNodeRef, nodeId: 'NOT_A_REAL_NODE' } }))).statusCode, 422);
    const savedCommand = command('saveDocumentDraft', payload), savedResponses = await Promise.all([send(savedCommand), send(savedCommand)]);
    for (const response of savedResponses) assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(savedResponses[0]!.json(), savedResponses[1]!.json());
    const ref = savedResponses[0]!.json().data.ref, versionPath = path + '/documents/' + ref.id + '/versions/1';
    let read = await app.inject({ method: 'GET', url: versionPath, headers: headers() }); assert.equal(read.statusCode, 200, read.body); assert.deepEqual(read.json().stageNodeRef, stageNodeRef); assert.equal(read.json().stageBinding.nodeName, node.name); assert.equal(read.json().confirmed, false);
    const mismatchedForm = (await admin.query('SELECT definition_id AS id,version,content_hash AS "contentHash" FROM anvil.form_versions WHERE definition_id<>$1 ORDER BY definition_id,version DESC LIMIT 1', [formRef.id])).rows[0];
    assert.equal((await send(command('saveDocumentDraft', { ...payload, formRef: { ...mismatchedForm, version: Number(mismatchedForm.version) } }))).statusCode, 422, '노드의 정확 양식이어야 한다');
    const newApplication = randomUUID(); await admin.query('INSERT INTO anvil.project_methodologies(id,project_id,application_version,source_definition_id,source_version,source_hash,snapshot_json,snapshot_hash,created_by) VALUES($1,$2,2,$3,2,$4,$5,$6,$7)', [newApplication, projects[0], sourceRef.id, sourceRef.contentHash, JSON.stringify(snapshot), snapshotHash, users[0]]);
    assert.equal((await send(command('saveDocumentDraft', payload, ref.id, 1))).statusCode, 409, '현재 적용이 바뀌면 옛 기준으로 새 변경 금지');
    read = await app.inject({ method: 'GET', url: versionPath, headers: headers() }); assert.equal(read.statusCode, 200); assert.deepEqual(read.json().stageNodeRef, stageNodeRef, '과거 문서/고정 단계는 그대로 조회');
    const unlinked = await send(command('saveDocumentDraft', { ...payload, stageNodeRef: null, reason: '새 버전에서 명시적으로 단계 분리' }, ref.id, 1)); assert.equal(unlinked.statusCode, 200, unlinked.body); assert.equal(unlinked.json().data.ref.version, 2);
    assert.equal((await app.inject({ method: 'GET', url: path + '/documents/' + ref.id + '/versions/2', headers: headers() })).json().stageNodeRef, null);
    await assert.rejects(pool.query('UPDATE anvil.document_versions SET stage_ref_json=NULL WHERE project_id=$1', [projects[0]]), (e: unknown) => (e as { code: string }).code === '42501');
    await admin.query('UPDATE anvil.project_methodologies SET snapshot_hash=$2 WHERE id=$1', [applications[0], 'f'.repeat(64)]);
    assert.equal((await app.inject({ method: 'GET', url: versionPath, headers: headers() })).statusCode, 503, '적용 snapshot 불일치를 숨기지 않는다');
    await admin.query('UPDATE anvil.project_methodologies SET snapshot_hash=$2 WHERE id=$1', [applications[0], snapshotHash]);
    assert.equal((await pool.query('SELECT count(*)::int n FROM anvil.delivery_outbox WHERE project_id=ANY($1::uuid[])', [ownedProjects])).rows[0].n, 0);
  } finally {
    await app.close(); const db = await admin.connect();
    try {
      await db.query('BEGIN'); await db.query('SET CONSTRAINTS ALL DEFERRED');
      for (const table of ['document_version_events', 'document_artifact_links', 'document_versions', 'documents', 'artifacts', 'project_methodologies', 'audit_events']) await db.query('DELETE FROM anvil.' + table + ' WHERE project_id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('UPDATE anvil.permission_policies SET head_version=head_version+1 WHERE project_id=ANY($1::uuid[])', [ownedProjects]);
      for (const table of ['permission_policy_versions', 'permission_policies']) await db.query('DELETE FROM anvil.' + table + ' WHERE project_id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('UPDATE anvil.commands SET authorization_receipt_id=NULL WHERE project_id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('DELETE FROM anvil.authorization_receipts WHERE scope_id=ANY($1::uuid[])', [ownedProjects]);
      for (const table of ['commands', 'project_control', 'project_members']) await db.query('DELETE FROM anvil.' + table + ' WHERE project_id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('DELETE FROM anvil.projects WHERE id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('DELETE FROM anvil.auth_audit_events WHERE subject_ref=ANY($1::uuid[])', [ownedUsers]);
      for (const table of ['auth_sessions', 'clients', 'password_credentials']) await db.query('DELETE FROM anvil.' + table + ' WHERE user_id=ANY($1::uuid[])', [ownedUsers]);
      await db.query('DELETE FROM anvil.users WHERE id=ANY($1::uuid[])', [ownedUsers]); await db.query('COMMIT');
    } catch (e) { await db.query('ROLLBACK'); throw e; }
    finally { db.release(); await pool.end(); await admin.end(); if (rootCreated) { const stat = await lstat(root); if (stat.isSymbolicLink() || !stat.isDirectory() || await realpath(root) !== root || root !== join(tmpdir(), 'anvil-v3-document-qa-' + users[0])) throw Error('QA_ROOT_CHANGED_PRESERVE'); await rm(root, { recursive: true }); } }
  }
});
