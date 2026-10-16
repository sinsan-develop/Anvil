import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { validateDevelopmentDbConfig } from '../../../apps/server/storage/development-config.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { hashPassword } from '../../../apps/server/modules/access/service.ts';
import { buildApp } from '../../../apps/server/app.ts';

test('프로젝트 자료 정책은 현재 OWNER/client/세대·최근 재인증과 명시 저장만 허용하고 옛 권한 replay를 거절한다', async () => {
  if (!process.env.ANVIL_DB_CONFIG || !process.env.ANVIL_MIGRATOR_CONFIG) throw Error('ACTUAL_PROTECTED_DB_REQUIRED_NOT_SKIP');
  const pool = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG, 'utf8')), 'app'));
  const admin = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_MIGRATOR_CONFIG, 'utf8')), 'migrator'));
  const users = [randomUUID(), randomUUID()], projects = [randomUUID(), randomUUID()], owned: string[] = [];
  const access = new AccessRepository(pool, { installationId: randomUUID(), key: randomBytes(32) });
  const app = buildApp({}, undefined, { repository: access, origin: 'https://localhost:3830' });
  try {
    const password = randomBytes(32).toString('base64url'), phc = await hashPassword(password);
    for (const id of users) {
      await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'프로젝트 정책 합성 QA','ACTIVE')", [id, 'qa-project-policy-' + id]); owned.push(id);
      await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)', [id, phc]);
    }
    let own = await access.login('qa-project-policy-' + users[0], password, '정책 QA', 'qa-project-policy-' + users[0]);
    const other = await access.login('qa-project-policy-' + users[1], password, '격리 QA', 'qa-project-policy-' + users[1]);
    const sibling = await access.login('qa-project-policy-' + users[0], password, '다른 기기 QA', 'qa-project-policy-' + users[0]);
    for (const [project, user, client] of [[projects[0], users[0], own.clientId], [projects[1], users[1], other.clientId]]) {
      await admin.query("INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,'정책 합성 QA','자료 변경 제어','명시 허가')", [project]);
      await admin.query("INSERT INTO anvil.project_members(project_id,user_id,participation) VALUES($1,$2,'OWNER')", [project, user]);
      await admin.query('INSERT INTO anvil.project_control(project_id,actor_id,client_id,generation) VALUES($1,$2,$3,1)', [project, user, client]);
    }
    const headers = (session = own) => ({ host: 'localhost:3830', origin: 'https://localhost:3830', cookie: '__Host-anvil.sid=' + session.token, 'x-anvil-csrf': session.csrfToken });
    const path = '/api/v1/projects/' + projects[0];
    const read = await app.inject({ method: 'GET', url: path + '/permission-policy', headers: headers() });
    assert.equal(read.statusCode, 200, read.body); assert.equal(read.json().configured, false);
    assert.equal((await pool.query('SELECT count(*)::int n FROM anvil.permission_policies WHERE project_id=$1', [projects[0]])).rows[0].n, 0, '로그인/조회는 자동 정책을 만들지 않는다');
    const rule = { ruleId: 'OWN_DOCUMENTS', subjectRef: { kind: 'HUMAN', userId: users[0] }, operations: ['saveDocumentDraft'], targetScopes: [{ kind: 'PROJECT', projectId: projects[0] }], disposition: 'AUTO', limitPolicyRef: null, expiresAt: new Date(Date.now() + 3_600_000).toISOString() };
    const body = { schemaVersion: 1, commandId: randomUUID(), projectId: projects[0], clientId: own.clientId, controlGeneration: 1, operation: 'savePermissionPolicy', targetId: null, expectedVersion: 0, baselineRefs: [], approvalRef: null, payload: { rules: [rule], reason: '합성 사람의 명시 자료 정책', reviewRefs: [] } };
    const send = (payload: Record<string, unknown>, session = own) => app.inject({ method: 'POST', url: path + '/commands', headers: headers(session), payload });
    assert.equal((await send(body)).statusCode, 412, '최근 재인증 없이 정책 권한 확대 금지');
    own = await access.reauthenticate(own.token, own.csrfToken, password, 'qa-project-policy-' + users[0]);
    assert.equal((await send({ ...body, actorId: users[0] })).statusCode, 400, '행위자는 인증 주체만 사용');
    assert.equal((await send({ ...body, clientId: other.clientId }, other)).statusCode, 404);
    assert.equal((await send({ ...body, clientId: sibling.clientId }, sibling)).statusCode, 403);
    assert.equal((await send({ ...body, controlGeneration: 99 })).statusCode, 409);
    assert.equal((await send({ ...body, payload: { ...body.payload, rules: [{ ...rule, operations: ['executeAgent'] }] } })).statusCode, 412, '자료 정책으로 실제 Agent 권한을 열지 않는다');
    assert.equal((await send({ ...body, payload: { ...body.payload, rules: [{ ...rule, targetScopes: [{ kind: 'PROJECT', projectId: projects[1] }] }] } })).statusCode, 422);
    const response = await send(body); assert.equal(response.statusCode, 200, response.body);
    const ref = response.json().data.ref;
    assert.equal(ref.version, 1); assert.equal(response.json().status, 'APPLIED');
    assert.deepEqual((await send(body)).json(), response.json());
    assert.equal((await send({ ...body, payload: { ...body.payload, reason: '다른 본문' } })).statusCode, 409);
    const saved = (await app.inject({ method: 'GET', url: path + '/permission-policy', headers: headers() })).json();
    assert.equal(saved.configured, true); assert.deepEqual(saved.policy.ref, ref); assert.deepEqual(saved.policy.rules, [rule]);
    const revision = { ...body, commandId: randomUUID(), targetId: ref.id, expectedVersion: 1, payload: { ...body.payload, rules: [{ ...rule, disposition: 'DENY' }], reason: '합성 정책 회수' } };
    const updated = await send(revision); assert.equal(updated.statusCode, 200, updated.body); assert.equal(updated.json().data.ref.version, 2);
    assert.equal((await send({ ...revision, commandId: randomUUID() })).statusCode, 409);
    await assert.rejects(pool.query('UPDATE anvil.permission_policy_versions SET reason=$2 WHERE project_id=$1', [projects[0], '변조']), (error: unknown) => (error as { code: string }).code === '42501');
    await admin.query('UPDATE anvil.project_control SET generation=2 WHERE project_id=$1', [projects[0]]);
    assert.equal((await send(body)).statusCode, 409, '옛 세대는 이미 성공한 명령도 재조회하지 못한다');
    const audit = (await pool.query('SELECT outcome,reason_code FROM anvil.audit_events WHERE project_id=$1 ORDER BY server_sequence', [projects[0]])).rows;
    assert.equal(audit.filter(row => row.outcome === 'APPLIED').length, 2);
    assert.ok(audit.some(row => row.outcome === 'DENIED' && row.reason_code === 'CONTROL_GENERATION_CONFLICT'));
    assert.equal((await pool.query('SELECT count(*)::int n FROM anvil.delivery_outbox WHERE project_id=ANY($1::uuid[])', [projects])).rows[0].n, 0);
  } finally {
    await app.close(); const db = await admin.connect();
    try {
      await db.query('BEGIN'); await db.query('SET CONSTRAINTS ALL DEFERRED');
      await db.query('DELETE FROM anvil.audit_events WHERE project_id=ANY($1::uuid[])', [projects]);
      await db.query('DELETE FROM anvil.permission_policy_versions WHERE project_id=ANY($1::uuid[])', [projects]);
      await db.query('DELETE FROM anvil.permission_policies WHERE project_id=ANY($1::uuid[])', [projects]);
      await db.query('UPDATE anvil.commands SET authorization_receipt_id=NULL WHERE project_id=ANY($1::uuid[])', [projects]);
      await db.query('DELETE FROM anvil.authorization_receipts WHERE scope_kind=\'PROJECT\' AND scope_id=ANY($1::uuid[])', [projects]);
      await db.query('DELETE FROM anvil.commands WHERE project_id=ANY($1::uuid[])', [projects]);
      await db.query('DELETE FROM anvil.project_control WHERE project_id=ANY($1::uuid[])', [projects]);
      await db.query('DELETE FROM anvil.project_members WHERE project_id=ANY($1::uuid[])', [projects]);
      await db.query('DELETE FROM anvil.projects WHERE id=ANY($1::uuid[])', [projects]);
      await db.query('DELETE FROM anvil.auth_audit_events WHERE subject_ref=ANY($1::uuid[])', [owned]);
      await db.query('DELETE FROM anvil.auth_sessions WHERE user_id=ANY($1::uuid[])', [owned]);
      await db.query('DELETE FROM anvil.clients WHERE user_id=ANY($1::uuid[])', [owned]);
      await db.query('DELETE FROM anvil.password_credentials WHERE user_id=ANY($1::uuid[])', [owned]);
      await db.query('DELETE FROM anvil.users WHERE id=ANY($1::uuid[])', [owned]);
      await db.query('COMMIT');
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); await pool.end(); await admin.end(); }
  }
});
