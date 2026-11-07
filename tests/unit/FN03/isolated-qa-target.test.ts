import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateFn03QaConfig } from '../../../scripts/qa-fn03-document-isolated.ts';

const now = Date.parse('2026-10-21T06:00:00Z');
const config = { sha: '1'.repeat(40), appPassword: 'a'.repeat(64), migratorPassword: 'b'.repeat(64),
  issuedAt: '2026-10-21T05:59:00Z', expiresAt: '2026-10-21T06:25:00Z' };

test('격리 시험 입력으로 정식 DB/host/역할/port를 바꿀 수 없다', () => {
  const value = validateFn03QaConfig(config, now);
  assert.equal(value.db.host, 'anvil-v3-fn03-document-qa-pg');
  assert.equal(value.db.database, 'anvil_v3_fn03_document_qa');
  assert.equal(value.db.port, 5432);
  assert.equal(value.db.user, 'anvil_v3_app');
  assert.equal(value.seedDb.user, 'anvil_v3_migrator');
  for (const extra of [{ host: '127.0.0.1' }, { database: 'anvil_v3_development' }, { port: 5546 }, { user: 'postgres' }])
    assert.throws(() => validateFn03QaConfig({ ...config, ...extra }, now), /FN03_QA_FIELDS_INVALID/);
});

test('만료/미래 시작/30분 초과·불완전 입력을 DB 연결 전에 거절한다', () => {
  for (const change of [
    { expiresAt: '2026-10-21T06:00:00Z' }, { issuedAt: '2026-10-21T06:01:00Z' },
    { expiresAt: '2026-10-21T06:30:01Z' }, { expiresAt: 'invalid' },
  ]) assert.throws(() => validateFn03QaConfig({ ...config, ...change }, now), /FN03_QA_LIFETIME_INVALID/);
  assert.throws(() => validateFn03QaConfig({ ...config, sha: 'HEAD' }, now), /FN03_QA_SHA_INVALID/);
  assert.throws(() => validateFn03QaConfig({ ...config, migratorPassword: '' }, now), /FN03_QA_PASSWORD_INVALID/);
  assert.throws(() => validateFn03QaConfig(null, now), /FN03_QA_CONFIG_INVALID/);
});

test('잘못된 비밀번호의 오류 객체에도 입력 원문을 넣지 않는다', () => {
  const secret = 'synthetic-private-marker';
  try { validateFn03QaConfig({ ...config, appPassword: secret }, now); assert.fail('must reject'); }
  catch (error) {
    assert.equal((error as Error).message, 'FN03_QA_PASSWORD_INVALID');
    assert.equal(JSON.stringify(error).includes(secret), false);
    assert.equal(String(error).includes(secret), false);
  }
});
