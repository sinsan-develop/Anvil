import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { validateDevelopmentDbConfig } from '../../../apps/server/storage/development-config.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { hashPassword } from '../../../apps/server/modules/access/service.ts';
import { buildApp } from '../../../apps/server/app.ts';

test('방법론은 같은 내용 검토와 양식 준비를 확인해 확정하고 프로젝트 실행 권한을 만들지 않는다', async () => {
  if (!process.env.ANVIL_DB_CONFIG || !process.env.ANVIL_MIGRATOR_CONFIG) throw Error('ACTUAL_PROTECTED_DB_REQUIRED_NOT_SKIP');
  const pool = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG, 'utf8')), 'app'));
  const admin = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_MIGRATOR_CONFIG, 'utf8')), 'migrator'));
  const user = randomUUID(), access = new AccessRepository(pool, { installationId: randomUUID(), key: randomBytes(32) });
  const app = buildApp({}, undefined, { repository: access, origin: 'https://localhost:3830' });
  try {
    const password = randomBytes(32).toString('base64url');
    await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'방법론 내용 검토 QA','ACTIVE')", [user, 'qa-method-review-' + user]);
    await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)', [user, await hashPassword(password)]);
    const login = await access.login('qa-method-review-' + user, password, '방법론 검토 QA', 'qa-method-review-' + user);
    const headers = { host: 'localhost:3830', origin: 'https://localhost:3830', cookie: '__Host-anvil.sid=' + login.token, 'x-anvil-csrf': login.csrfToken };
    const send = (operation: string, targetId: string | null, expectedVersion: number, payload: unknown) => app.inject({ method: 'POST', url: '/api/v1/user-common/commands', headers, payload: { schemaVersion: 1, commandId: randomUUID(), operation, targetId, expectedVersion, clientId: login.clientId, payload } });
    const get = (id: string, version: number) => app.inject({ method: 'GET', url: `/api/v1/methodologies/${id}/versions/${version}`, headers });
    const original = (await get('a6f20000-0000-4000-8000-000000000001', 2)).json();
    const copied = await send('copyMethodology', null, 0, { sourceRef: original.ref, name: '검토할 공통 방법론', scope: 'USER_COMMON', reason: '합성 검토 QA' });
    assert.equal(copied.statusCode, 200); const ref = copied.json().data.ref;
    assert.equal((await send('confirmMethodology', ref.id, 1, { versionRef: ref, reviewRefs: [] })).statusCode, 422);
    const detail = (await get(ref.id, 1)).json();
    const criteria = ['METHOD_PURPOSE_SCOPE', 'METHOD_FLOW_CONTROL', 'METHOD_INPUT_OUTPUT', 'METHOD_COMPLETION_APPROVAL', 'METHOD_RECORD_LIMITS'];
    assert.deepEqual(detail.contentReviewCriteria.items.map((item: { criterionId: string }) => item.criterionId), criteria);
    async function review(kind: string, target: { id: string; version: number; contentHash: string }, codes: string[]) {
      const response = await send('recordContentReview', target.id, target.version, { targetKind: kind, targetRef: target, criteriaVersion: 1, items: codes.map(criterionId => ({ criterionId, outcome: 'ACCEPTED', evidenceRefs: [], reason: '합성 내용을 직접 대조함' })), outcome: 'ACCEPTED', reason: '대상/기준을 확인한 합성 사람 검토' });
      assert.equal(response.statusCode, 200, response.body); return response.json().data.reviewRef;
    }
    const review1 = await review('METHODOLOGY', ref, criteria);
    assert.equal((await send('confirmMethodology', ref.id, 1, { versionRef: ref, reviewRefs: [{ ...review1, id: randomUUID() }] })).statusCode, 422);
    const rework = await send('recordContentReview', ref.id, 1, { targetKind: 'METHODOLOGY', targetRef: ref, criteriaVersion: 1, items: criteria.map(criterionId => ({ criterionId, outcome: 'REWORK', evidenceRefs: [], reason: '추가 보완 필요 QA' })), outcome: 'REWORK', reason: '최신 판단 차단 QA' });
    assert.equal(rework.statusCode, 200, rework.body);
    assert.equal((await send('confirmMethodology', ref.id, 1, { versionRef: ref, reviewRefs: [review1] })).statusCode, 422);
    const latestReview = await review('METHODOLOGY', ref, criteria);
    const confirmed = await send('confirmMethodology', ref.id, 1, { versionRef: ref, reviewRefs: [latestReview] });
    assert.equal(confirmed.statusCode, 200, confirmed.body); assert.equal(confirmed.json().data.status, 'CONFIRMED');
    assert.equal((await get(ref.id, 1)).json().confirmation.decidedBy, user);
    assert.equal((await get(ref.id, 1)).json().runtimeReadiness, 'PROJECT_BINDINGS_REQUIRED');
    const official = (await app.inject({ method: 'GET', url: '/api/v1/forms/a6f30000-0000-4000-8000-000000000001/versions/1', headers })).json();
    const formCopy = await send('copyForm', null, 0, { sourceRef: official.ref, name: '방법론에 연결할 내 양식', scope: 'USER_COMMON', reason: '미확정 양식 차단 QA' });
    assert.equal(formCopy.statusCode, 200); const formRef = formCopy.json().data.ref;
    const graph = structuredClone(detail.graph); graph.nodes[0].outputs[0].formRef = formRef;
    const saved = await send('saveMethodologyDraft', ref.id, 1, { name: detail.name, purpose: detail.purpose, scope: 'USER_COMMON', graph, reason: '사용자 양식 연결 QA' });
    assert.equal(saved.statusCode, 200); const nextRef = saved.json().data.ref;
    assert.equal((await get(ref.id, 2)).json().confirmation, null);
    const review2 = await review('METHODOLOGY', nextRef, criteria);
    assert.equal((await send('confirmMethodology', ref.id, 2, { versionRef: nextRef, reviewRefs: [latestReview] })).statusCode, 422);
    assert.equal((await send('confirmMethodology', ref.id, 2, { versionRef: nextRef, reviewRefs: [review2] })).statusCode, 422);
    const formReview = await review('FORM', formRef, ['FORM_PURPOSE', 'FORM_ROLES', 'FORM_STRUCTURE', 'FORM_AUTHORING', 'FORM_REVIEW']);
    assert.equal((await send('confirmMethodology', ref.id, 2, { versionRef: nextRef, reviewRefs: [formReview] })).statusCode, 422);
    const formConfirmed = await send('confirmForm', formRef.id, 1, { versionRef: formRef, reviewRefs: [formReview] }); assert.equal(formConfirmed.statusCode, 200, formConfirmed.body);
    const nowReady = await send('confirmMethodology', ref.id, 2, { versionRef: nextRef, reviewRefs: [review2] }); assert.equal(nowReady.statusCode, 200, nowReady.body);
    assert.equal((await get(ref.id, 1)).json().confirmation.decision, 'CONFIRMED');
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM anvil.project_methodologies WHERE created_by=$1', [user])).rows[0].count, 0);
    await assert.rejects(pool.query('UPDATE anvil.methodology_reviews SET decision=$1 WHERE decided_by=$2', ['INVALID', user]), (error: unknown) => (error as { code: string }).code === '42501');
  } finally {
    const db = await admin.connect();
    try {
      await db.query('BEGIN');
      await db.query('DELETE FROM anvil.methodology_reviews WHERE decided_by=$1', [user]); await db.query('DELETE FROM anvil.form_reviews WHERE decided_by=$1', [user]);
      await db.query("DELETE FROM anvil.content_reviews WHERE scope_kind='USER_COMMON' AND scope_id=$1", [user]);
      await db.query('DELETE FROM anvil.user_common_audit_events WHERE owner_user_id=$1', [user]);
      await db.query("UPDATE anvil.commands SET authorization_receipt_id=NULL WHERE scope_kind='USER_COMMON' AND scope_id=$1", [user]);
      await db.query("DELETE FROM anvil.authorization_receipts WHERE scope_kind='USER_COMMON' AND scope_id=$1", [user]); await db.query("DELETE FROM anvil.commands WHERE scope_kind='USER_COMMON' AND scope_id=$1", [user]);
      for (const kind of ['methodology', 'form']) { await db.query(`DELETE FROM anvil.${kind}_versions WHERE definition_id IN (SELECT id FROM anvil.${kind}_definitions WHERE owner_user_id=$1)`, [user]); await db.query(`DELETE FROM anvil.${kind}_definitions WHERE owner_user_id=$1`, [user]); }
      for (const table of ['auth_sessions', 'clients', 'password_credentials']) await db.query(`DELETE FROM anvil.${table} WHERE user_id=$1`, [user]);
      await db.query('DELETE FROM anvil.users WHERE id=$1', [user]); await db.query('COMMIT');
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM anvil.users WHERE id=$1', [user])).rows[0].count, 0);
    } catch (error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
    await app.close(); await pool.end(); await admin.end();
  }
});
