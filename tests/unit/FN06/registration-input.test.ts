import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConnectorRegistration } from '../../../apps/server/modules/connections/registration-input.ts';

const project = '51c0439f-791e-4bb5-8471-70938d6afaf1', environment = '32b5f276-13e6-4d8a-b93f-27a15d21c788';
const context = { now: new Date('2026-10-17T00:00:00.000Z'), maxAgeMs: 600_000, maxReferences: 10 };
const ref = (id: string) => ({ id, version: 1, contentHash: 'a'.repeat(64) });
const input = () => ({ hostLabel: '  신산님 PC  ', expectedHostFingerprint: 'b'.repeat(64), allowedProjectRefs: [ref(project)], environmentRefs: [ref(environment)], policyRef: ref(project), expiresAt: '2026-10-17T00:10:00.000Z', reason: '개별 프로젝트 연결 후보만 등록' });

// 사용자 선언을 호스트 인증/실제 연결 성공으로 승격하거나 입력 소유권을 공유하면 실패한다.
test('실행기 등록 입력은 정확 범위·기한을 복제하며 키 생성·연결 성공 필드를 받지 않는다', () => {
  const source = input(), result = readConnectorRegistration(source, context);
  assert.deepEqual(result, source); assert.notEqual(result, source); assert.notEqual(result.allowedProjectRefs[0], source.allowedProjectRefs[0]);
  source.allowedProjectRefs[0]!.version = 2; assert.equal(result.allowedProjectRefs[0]!.version, 1);
  assert.equal(result.hostLabel, '  신산님 PC  ');
  for (const extra of [{ token: 'do-not-store' }, { verified: true }, { status: 'READY' }, { publicKey: 'unverified-key' }]) assert.throws(() => readConnectorRegistration({ ...input(), ...extra }, context));
});

// 과대/중복/만료 범위와 알려진 비밀이 등록 후보·감사 원문에 들어가면 실패한다.
test('등록 입력은 다른 참조 형식·유한 정책 부재·기한 초과·의심 비밀을 거절한다', () => {
  const original = input();
  for (const change of [
    { allowedProjectRefs: [] }, { environmentRefs: [] }, { allowedProjectRefs: [ref(project), { ...ref(project), version: 2 }] },
    { policyRef: { ...ref(project), extra: 'permission' } }, { expectedHostFingerprint: 'B'.repeat(64) },
    { expiresAt: '2026-10-17T00:00:00.000Z' }, { expiresAt: '2026-10-17T00:10:00.001Z' },
    { hostLabel: 'PC\u0000' }, { reason: '\ud800' }, { reason: 'Bearer synthetic-secret-token' },
  ]) assert.throws(() => readConnectorRegistration({ ...original, ...change }, context));
  for (const limits of [{ maxAgeMs: Infinity }, { maxAgeMs: 0 }, { maxReferences: 0 }, { now: new Date('invalid') }]) assert.throws(() => readConnectorRegistration(original, { ...context, ...limits }));
  assert.throws(() => readConnectorRegistration({ ...original, allowedProjectRefs: Array.from({ length: 11 }, () => ref(project)) }, context));
});
