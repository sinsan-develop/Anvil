import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { validateDevelopmentDbConfig } from '../../../apps/server/storage/development-config.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { hashPassword } from '../../../apps/server/modules/access/service.ts';
import { ProjectPolicyRepository } from '../../../apps/server/modules/access/project-command.ts';
import { ProjectConnectionCandidates } from '../../../apps/server/modules/connections/project-candidates.ts';
import { ProjectApprovals } from '../../../apps/server/modules/approvals/project-approvals.ts';
import { ProjectListCodec } from '../../../apps/server/modules/projects/service.ts';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';

// 실측/신뢰가 없는 후보의 위장 활성화, 승인 재사용·교차 범위·이력 손실을 검출한다.
test('연결·환경 후보는 실제 현재 허가/일회 승인 아래 불변 저장되며 실행·신뢰로 승격되지 않는다', async () => {
  if (!process.env.ANVIL_DB_CONFIG || !process.env.ANVIL_MIGRATOR_CONFIG) throw Error('ACTUAL_PROTECTED_DB_REQUIRED_NOT_SKIP');
  const pool = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG, 'utf8')), 'app'));
  const admin = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_MIGRATOR_CONFIG, 'utf8')), 'migrator'));
  const users = [randomUUID(), randomUUID()], projects = [randomUUID(), randomUUID()], ownedUsers: string[] = [], ownedProjects: string[] = [];
  const access = new AccessRepository(pool, { installationId: randomUUID(), key: randomBytes(32) }), candidates = new ProjectConnectionCandidates(access), policies = new ProjectPolicyRepository(access), approvals = new ProjectApprovals();
  const codec = new ProjectListCodec(value => access.signProjectCursor('CONNECTION_CANDIDATES:' + value));
  try {
    const password = randomBytes(32).toString('base64url'), phc = await hashPassword(password);
    for (const id of users) { await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'연결 후보 합성 QA','ACTIVE')", [id, 'qa-connection-candidate-' + id]); ownedUsers.push(id); await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)', [id, phc]); }
    let own = await access.login('qa-connection-candidate-' + users[0], password, '후보 QA', 'qa-connection-candidate-' + users[0]);
    const other = await access.login('qa-connection-candidate-' + users[1], password, '격리 QA', 'qa-connection-candidate-' + users[1]);
    for (const [i, project] of projects.entries()) { await admin.query("INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,'후보 저장 QA','완성형과 분리','실제 후보 저장')", [project]); ownedProjects.push(project); await admin.query("INSERT INTO anvil.project_members(project_id,user_id,participation) VALUES($1,$2,'OWNER')", [project, users[i]]); await admin.query('INSERT INTO anvil.project_control(project_id,actor_id,client_id,generation) VALUES($1,$2,$3,1)', [project, users[i], i ? other.clientId : own.clientId]); }
    const pid = projects[0]!, list = (token = own.token, query = {}) => access.authenticated(token, null, (db, actor) => candidates.list(db, actor, pid, query, codec));
    assert.deepEqual((await list()).items, []);
    await assert.rejects(list(other.token), (e: any) => e.statusCode === 404);
    const envelope = (operation: string, payload: Record<string, unknown>, targetId: string | null = null, expectedVersion = 0) => ({ schemaVersion: 1 as const, projectId: pid, commandId: randomUUID(), clientId: own.clientId, controlGeneration: 1, operation, targetId, expectedVersion, baselineRefs: [], approvalRef: null, payload });
    const expiry = new Date(Date.now() + 3_600_000).toISOString();
    const rules = (disposition: string) => [
      { ruleId: 'CANDIDATES', subjectRef: { kind: 'HUMAN', userId: users[0] }, operations: ['registerConnection', 'saveEnvironment'], targetScopes: [{ kind: 'PROJECT', projectId: pid }], disposition, limitPolicyRef: null, expiresAt: expiry },
      { ruleId: 'DECISIONS', subjectRef: { kind: 'HUMAN', userId: users[0] }, operations: ['requestApproval', 'decideApproval'], targetScopes: [{ kind: 'PROJECT', projectId: pid }], disposition: 'AUTO', limitPolicyRef: null, expiresAt: expiry },
    ];
    own = await access.reauthenticate(own.token, own.csrfToken, password, 'qa-connection-candidate-' + users[0]);
    let policy = await policies.command(own.token, own.csrfToken, envelope('savePermissionPolicy', { rules: rules('AUTO'), reason: '합성 후보 기록 명시 허가', reviewRefs: [] })) as any;
    let policyRef = policy.data.ref;
    const payload = (kind = 'CONNECTION_CANDIDATE', candidate = { label: '도구 후보' } as Record<string, unknown>, candidateRef = null as any) => ({ kind, candidate, candidateRef, policyRef, expiresAt: new Date(Date.now() + 600_000).toISOString(), reason: '신뢰/실행 없는 후보 보존' });
    const command = envelope('registerConnection', payload());
    await admin.query('UPDATE anvil.auth_sessions SET reauth_until=now()-interval \'1 second\' WHERE user_id=$1 AND client_id=$2', [users[0], own.clientId]);
    await assert.rejects(candidates.command(own.token, own.csrfToken, command), (e: any) => e.message === 'REAUTHENTICATION_REQUIRED');
    own = await access.reauthenticate(own.token, own.csrfToken, password, 'qa-connection-candidate-' + users[0]);
    const saved = await Promise.all([candidates.command(own.token, own.csrfToken, command), candidates.command(own.token, own.csrfToken, command)]) as any[];
    assert.deepEqual(saved[0], saved[1]); const ref = saved[0].data.ref;
    assert.equal(saved[0].data.status, 'CANDIDATE_STORED'); assert.equal(saved[0].data.candidate.readiness.state, 'NOT_READY');
    assert.equal(saved[0].data.candidate.capabilities.length, 6); assert.ok(saved[0].data.candidate.capabilities.every((x: any) => x.measurement.state === 'UNVERIFIED' && x.controlLevel === 'UNVERIFIED'));
    assert.equal((await pool.query('SELECT count(*)::int n FROM anvil.connection_candidate_versions WHERE project_id=$1 AND candidate_id=$2', [pid, ref.id])).rows[0].n, 1);
    const read = (r: any, token = own.token) => access.authenticated(token, null, (db, actor) => candidates.read(db, actor, pid, r.id, r.version));
    assert.deepEqual((await read(ref)).candidate, saved[0].data.candidate);
    await assert.rejects(read(ref, other.token), (e: any) => e.statusCode === 404);
    await assert.rejects(candidates.command(own.token, own.csrfToken, { ...command, payload: { ...command.payload, reason: '명령 본문 위장' } }), (e: any) => e.statusCode === 409);
    await assert.rejects(candidates.command(own.token, own.csrfToken, envelope('registerConnection', payload('CONNECTION_CANDIDATE', { label: '위장', connectorRef: { ...ref, id: randomUUID() } }))), (e: any) => e.statusCode === 412);
    await assert.rejects(candidates.command(own.token, own.csrfToken, envelope('registerConnection', payload('CONNECTION_CANDIDATE', { label: '위장', readiness: 'READY' }))), (e: any) => e.statusCode === 422);
    const firstEnv = await candidates.command(own.token, own.csrfToken, envelope('saveEnvironment', payload('ENVIRONMENT_CANDIDATE', { label: '환경 초안' }))) as any;
    const envRef = firstEnv.data.ref, revision = envelope('saveEnvironment', payload('ENVIRONMENT_CANDIDATE', { label: '빈 허용 범위', sourceRootRefs: [] }, envRef), envRef.id, envRef.version);
    const revised = await candidates.command(own.token, own.csrfToken, revision) as any;
    assert.equal(revised.data.ref.version, 2); assert.equal(Object.hasOwn((await read(envRef)).candidate.input.candidate, 'sourceRootRefs'), false);
    assert.deepEqual((await read(revised.data.ref)).candidate.input.candidate.sourceRootRefs, []);
    await assert.rejects(candidates.command(own.token, own.csrfToken, { ...revision, commandId: randomUUID() }), (e: any) => e.statusCode === 409);
    await assert.rejects(candidates.command(own.token, own.csrfToken, envelope('saveEnvironment', { ...payload('ENVIRONMENT_CANDIDATE'), candidateRef: { ...revised.data.ref, contentHash: 'f'.repeat(64) } }, envRef.id, 2)), (e: any) => e.statusCode === 409);
    const page = await list(own.token, { limit: '1' }); assert.equal(page.hasMore, true);
    assert.ok(page.nextCursor); await assert.rejects(list(own.token, { kind: 'ENVIRONMENT_CANDIDATE', limit: '1', cursor: page.nextCursor }), (e: any) => e.statusCode === 400);
    await admin.query("UPDATE anvil.connection_candidate_versions SET content_hash=$3 WHERE project_id=$1 AND candidate_id=$2 AND version=1", [pid, ref.id, 'f'.repeat(64)]);
    await assert.rejects(read(ref), (e: any) => e.statusCode === 503);
    await admin.query('UPDATE anvil.connection_candidate_versions SET content_hash=$3 WHERE project_id=$1 AND candidate_id=$2 AND version=1', [pid, ref.id, ref.contentHash]);
    await assert.rejects(pool.query('DELETE FROM anvil.connection_candidate_versions WHERE project_id=$1', [pid]), (e: any) => e.code === '42501');
    await assert.rejects(pool.query('UPDATE anvil.connection_candidates SET head_version=head_version+1 WHERE project_id=$1', [pid]), (e: any) => e.code === '42501');
    policy = await policies.command(own.token, own.csrfToken, envelope('savePermissionPolicy', { rules: rules('REQUIRE_APPROVAL'), reason: '후보 승인 필요', reviewRefs: [] }, policyRef.id, policyRef.version)) as any; policyRef = policy.data.ref;
    const approvedCandidate = envelope('registerConnection', payload('CONNECTION_CANDIDATE', { label: '사람 승인 후보', toolProduct: 'Codex', toolVersion: 'USER_DECLARED' }));
    await assert.rejects(candidates.command(own.token, own.csrfToken, approvedCandidate), (e: any) => e.message === 'APPROVAL_REQUIRED');
    const details = { reason: '후보 저장만 승인 요청', risks: { data: '원문 보존', security: '신뢰 발급 없음', cost: '호출 없음', interruption: '중단 없음', unverified: '미연결 후보' }, rollback: { method: '버전 보존', limitations: '과거 삭제 없음', evidenceRefs: [] }, expiresAt: new Date(Date.now() + 300_000).toISOString(), candidateCommandId: approvedCandidate.commandId, actionScope: { operation: approvedCandidate.operation, targetRef: null, expectedVersion: 0, payloadHash: contentHash(canonicalJson(approvedCandidate.payload)), baselineRefs: [], environmentRef: null, sourceScopes: [], limitsRef: null, requestedSubjectRef: { kind: 'HUMAN', userId: users[0], clientId: own.clientId }, controlGeneration: 1 } };
    const requestCommand = envelope('requestApproval', { details });
    const requested = await policies.command(own.token, own.csrfToken, requestCommand, (db, actor, p) => approvals.request(db, actor, requestCommand, p)) as any;
    const r = requested.data.request, decisionCommand = envelope('decideApproval', { requestId: r.id, expectedVersion: 1, scopeDigest: r.scopeDigest, decision: 'APPROVE', reason: '정확 후보만 허용' }, r.id, 1);
    const decided = await policies.command(own.token, own.csrfToken, decisionCommand, (db, actor, p) => approvals.decide(db, actor, decisionCommand, p)) as any;
    const approved = { ...approvedCandidate, approvalRef: { requestId: r.id, decisionId: decided.data.decision.id, scopeDigest: r.scopeDigest } };
    const applied = await Promise.all([candidates.command(own.token, own.csrfToken, approved), candidates.command(own.token, own.csrfToken, approved)]); assert.deepEqual(applied[0], applied[1]);
    assert.equal((await pool.query('SELECT count(*)::int n FROM anvil.approval_consumptions WHERE project_id=$1', [pid])).rows[0].n, 1);
    await assert.rejects(candidates.command(own.token, own.csrfToken, { ...approved, commandId: randomUUID() }), (e: any) => e.statusCode >= 400 && e.statusCode < 500);
    await admin.query('UPDATE anvil.project_control SET generation=2 WHERE project_id=$1', [pid]);
    await assert.rejects(candidates.command(own.token, own.csrfToken, approved), (e: any) => e.statusCode === 409);
    assert.equal((await pool.query('SELECT count(*)::int n FROM anvil.delivery_outbox WHERE project_id=ANY($1::uuid[])', [ownedProjects])).rows[0].n, 0);
  } finally {
    const db = await admin.connect();
    try { await db.query('BEGIN'); await db.query('SET CONSTRAINTS ALL DEFERRED');
      await db.query('UPDATE anvil.authorization_receipts SET approval_decision_ref=NULL WHERE scope_id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('UPDATE anvil.commands SET authorization_receipt_id=NULL,approval_consumption_id=NULL WHERE project_id=ANY($1::uuid[])', [ownedProjects]);
      for (const table of ['connection_candidate_versions', 'connection_candidates', 'audit_events', 'approval_consumptions', 'approval_decisions', 'approval_requests']) if ((await db.query('SELECT to_regclass($1) present', ['anvil.' + table])).rows[0].present) await db.query('DELETE FROM anvil.' + table + ' WHERE project_id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('UPDATE anvil.permission_policies SET head_version=head_version+1 WHERE project_id=ANY($1::uuid[])', [ownedProjects]);
      for (const table of ['permission_policy_versions', 'permission_policies']) await db.query('DELETE FROM anvil.' + table + ' WHERE project_id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('DELETE FROM anvil.authorization_receipts WHERE scope_id=ANY($1::uuid[])', [ownedProjects]);
      for (const table of ['commands', 'project_control', 'project_members']) await db.query('DELETE FROM anvil.' + table + ' WHERE project_id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('DELETE FROM anvil.projects WHERE id=ANY($1::uuid[])', [ownedProjects]);
      await db.query('DELETE FROM anvil.auth_audit_events WHERE subject_ref=ANY($1::uuid[])', [ownedUsers]);
      for (const table of ['auth_sessions', 'clients', 'password_credentials']) await db.query('DELETE FROM anvil.' + table + ' WHERE user_id=ANY($1::uuid[])', [ownedUsers]);
      await db.query('DELETE FROM anvil.users WHERE id=ANY($1::uuid[])', [ownedUsers]); await db.query('COMMIT');
    } catch (error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); await pool.end(); await admin.end(); }
  }
});
