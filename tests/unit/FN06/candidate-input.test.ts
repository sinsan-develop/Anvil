import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readCandidateInput, candidateReadiness } from '../../../apps/server/modules/connections/candidate-input.ts';

const ref = { id: '51c0439f-791e-4bb5-8471-70938d6afaf1', version: 1, contentHash: 'a'.repeat(64) };
const context = { now: new Date('2026-10-17T00:00:00.000Z'), policyExpiresAt: new Date('2026-10-17T01:00:00.000Z') };
const payload = () => ({ kind: 'CONNECTION_CANDIDATE', candidate: { label: '기존 코딩 도구 후보' }, candidateRef: null, policyRef: ref, expiresAt: '2026-10-17T00:30:00.000Z', reason: '설정 초안만 보존' });

// 누락 필드를 null/빈 목록으로 채우거나 후보 영속을 실행 준비로 승격하면 실패한다.
test('후보는 완성형 연결과 구분하고 미제공·명시한 빈 범위를 원문대로 보존한다', () => {
  const p = payload(), input = readCandidateInput('registerConnection', p, context);
  assert.deepEqual(input, p); assert.notEqual(input.candidate, p.candidate);
  const readiness = candidateReadiness(input);
  assert.equal(readiness.state, 'NOT_READY'); assert.ok(readiness.missingRequirements.some(x => x.field === 'connectorRef' && x.reason === 'NOT_PROVIDED'));
  const omitted = readCandidateInput('saveEnvironment', { ...p, kind: 'ENVIRONMENT_CANDIDATE' }, context);
  const empty = readCandidateInput('saveEnvironment', { ...p, kind: 'ENVIRONMENT_CANDIDATE', candidate: { label: '빈 범위', sourceRootRefs: [] } }, context);
  assert.equal(Object.hasOwn(omitted.candidate, 'sourceRootRefs'), false); assert.deepEqual(empty.candidate.sourceRootRefs, []);
  assert.ok(candidateReadiness(omitted).missingRequirements.some(x => x.field === 'sourceRootRefs' && x.reason === 'NOT_PROVIDED'));
  assert.ok(candidateReadiness(empty).missingRequirements.some(x => x.field === 'sourceRootRefs' && x.reason === 'EMPTY'));
});

test('후보도 상태 위조·credential 원문·잘못된 참조·정책 기한 초과를 저장 입력으로 받지 않는다', () => {
  const p = payload();
  for (const bad of [
    { ...p, candidate: { ...p.candidate, readiness: 'READY' } }, { ...p, candidate: { ...p.candidate, token: 'raw-value' } },
    { ...p, candidate: { ...p.candidate, connectorRef: { ...ref, contentHash: 'bad' } } },
    { ...p, candidate: { ...p.candidate, reason: 'unknown-field' } }, { ...p, kind: 'ENVIRONMENT_CANDIDATE' },
    { ...p, reason: 'Bearer synthetic-secret-token' }, { ...p, expiresAt: '2026-10-17T01:00:00.001Z' },
    { ...p, expiresAt: '2026-10-17T00:00:00.000Z' }, { ...p, candidateRef: { ...ref, extra: 'authority' } },
  ]) assert.throws(() => readCandidateInput('registerConnection', bad, context));
});
