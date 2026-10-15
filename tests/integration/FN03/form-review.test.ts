import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { validateDevelopmentDbConfig } from '../../../apps/server/storage/development-config.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { hashPassword } from '../../../apps/server/modules/access/service.ts';
import { buildApp } from '../../../apps/server/app.ts';

test('공통 양식 확정은 서버의 같은 내용 검토·현재 버전을 요구하고 새 개정에 이월되지 않는다', async () => {
  if (!process.env.ANVIL_DB_CONFIG || !process.env.ANVIL_MIGRATOR_CONFIG) throw Error('ACTUAL_PROTECTED_DB_REQUIRED_NOT_SKIP');
  const pool = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG, 'utf8')), 'app'));
  const admin = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_MIGRATOR_CONFIG, 'utf8')), 'migrator'));
  const user = randomUUID();
  const access = new AccessRepository(pool, { installationId: randomUUID(), key: randomBytes(32) });
  const app = buildApp({}, undefined, { repository: access, origin: 'https://localhost:3830' });
  try {
    const password = randomBytes(32).toString('base64url');
    await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'내용 검토 QA','ACTIVE')", [user, 'qa-form-review-' + user]);
    await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)', [user, await hashPassword(password)]);
    const login = await access.login('qa-form-review-' + user, password, '검토 QA', 'qa-form-review-' + user);
    const headers = { host: 'localhost:3830', origin: 'https://localhost:3830', cookie: '__Host-anvil.sid=' + login.token, 'x-anvil-csrf': login.csrfToken };
    const send = (operation: string, targetId: string | null, expectedVersion: number, payload: unknown) => app.inject({ method: 'POST', url: '/api/v1/user-common/commands', headers, payload: { schemaVersion: 1, commandId: randomUUID(), operation, targetId, expectedVersion, clientId: login.clientId, payload } });
    const get = (id: string, version: number) => app.inject({ method: 'GET', url: `/api/v1/forms/${id}/versions/${version}`, headers });
    const original = (await get('a6f30000-0000-4000-8000-000000000001', 1)).json();
    const copied = await send('copyForm', null, 0, { sourceRef: original.ref, name: '검토할 공통 양식', scope: 'USER_COMMON', reason: '합성 검토 QA' });
    assert.equal(copied.statusCode, 200);
    const ref = copied.json().data.ref, detail = (await get(ref.id, 1)).json();
    assert.deepEqual(detail.contentReviewCriteria.items.map((item: { criterionId: string }) => item.criterionId), ['FORM_PURPOSE', 'FORM_ROLES', 'FORM_STRUCTURE', 'FORM_AUTHORING', 'FORM_REVIEW']);
    assert.equal((await send('confirmForm', ref.id, 1, { versionRef: ref, reviewRefs: [] })).statusCode, 422);
    const items = ['FORM_PURPOSE', 'FORM_ROLES', 'FORM_STRUCTURE', 'FORM_AUTHORING', 'FORM_REVIEW'].map(criterionId => ({ criterionId, outcome: 'ACCEPTED', evidenceRefs: [], reason: '합성 자료를 직접 읽고 해당 기준을 확인함' }));
    const reviewPayload = { targetKind: 'FORM', targetRef: ref, criteriaVersion: 1, items, outcome: 'ACCEPTED', reason: '합성 사용자 직접 내용 검토 QA' };
    assert.equal((await send('recordContentReview', ref.id, 1, { ...reviewPayload, items: items.slice(1) })).statusCode, 422);
    assert.equal((await send('recordContentReview', ref.id, 1, { ...reviewPayload, reviewer: 'HUMAN' })).statusCode, 400);
    const reviewed = await send('recordContentReview', ref.id, 1, reviewPayload);
    assert.equal(reviewed.statusCode, 200, reviewed.body);
    const reviewRef = reviewed.json().data.reviewRef;
    assert.equal(reviewRef.outcome, 'ACCEPTED'); assert.deepEqual(reviewRef.targetRef, ref);
    assert.equal((await send('confirmForm', ref.id, 1, { versionRef: ref, reviewRefs: [{ ...reviewRef, id: randomUUID() }] })).statusCode, 422);
    const confirmation = await send('confirmForm', ref.id, 1, { versionRef: ref, reviewRefs: [reviewRef] });
    assert.equal(confirmation.statusCode, 200, confirmation.body); assert.equal(confirmation.json().data.status, 'CONFIRMED');
    const confirmed = (await get(ref.id, 1)).json();
    assert.equal(confirmed.confirmation.decidedBy, user); assert.equal(confirmed.contentReviews[0].sourceKind, 'HUMAN_REVIEW');
    assert.equal(confirmed.validation.userAcceptance, 'CONFIRMED');
    const next = await send('saveFormDraft', ref.id, 1, { definition: { ...detail.definition, purpose: '검토 뒤 별도 개정' }, reason: '새 버전 검토 필요 QA' });
    assert.equal(next.statusCode, 200); const nextRef = next.json().data.ref;
    assert.equal((await get(ref.id, 2)).json().confirmation, null);
    assert.equal((await send('confirmForm', ref.id, 2, { versionRef: nextRef, reviewRefs: [reviewRef] })).statusCode, 422);
    assert.equal((await get(ref.id, 1)).json().validation.userAcceptance, 'CONFIRMED');
    await assert.rejects(pool.query('UPDATE anvil.content_reviews SET reason=$2 WHERE id=$1', [reviewRef.id, 'rewrite']), (error: unknown) => (error as { code: string }).code === '42501');
  } finally {
    const db = await admin.connect();
    try {
      await db.query('BEGIN');
      if ((await db.query("SELECT to_regclass('anvil.content_reviews') IS NOT NULL AS present")).rows[0].present) {
        await db.query('DELETE FROM anvil.form_reviews WHERE decided_by=$1', [user]);
        await db.query("DELETE FROM anvil.content_reviews WHERE scope_kind='USER_COMMON' AND scope_id=$1", [user]);
      }
      await db.query('DELETE FROM anvil.user_common_audit_events WHERE owner_user_id=$1', [user]);
      await db.query("UPDATE anvil.commands SET authorization_receipt_id=NULL WHERE scope_kind='USER_COMMON' AND scope_id=$1", [user]);
      await db.query("DELETE FROM anvil.authorization_receipts WHERE scope_kind='USER_COMMON' AND scope_id=$1", [user]);
      await db.query("DELETE FROM anvil.commands WHERE scope_kind='USER_COMMON' AND scope_id=$1", [user]);
      await db.query('DELETE FROM anvil.form_versions WHERE definition_id IN (SELECT id FROM anvil.form_definitions WHERE owner_user_id=$1)', [user]);
      await db.query('DELETE FROM anvil.form_definitions WHERE owner_user_id=$1', [user]);
      for (const table of ['auth_sessions', 'clients', 'password_credentials']) await db.query(`DELETE FROM anvil.${table} WHERE user_id=$1`, [user]);
      await db.query('DELETE FROM anvil.users WHERE id=$1', [user]); await db.query('COMMIT');
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM anvil.users WHERE id=$1', [user])).rows[0].count, 0);
    } catch (error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
    await app.close(); await pool.end(); await admin.end();
  }
});
