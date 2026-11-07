import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readProjectMethodInput, readProjectMethodReview } from '../../../apps/server/modules/methodologies/project-input.ts';

// 결함 검출 대상: 프로젝트 범위/정확 필드/사람 검토 누락·위장 입력을 허용하는 변경.
test('프로젝트 방법론 개정은 범위를 고정하고 사용자 원문과 그래프를 복제한다', () => {
  const graph = { nodes: [], edges: [], entryNodeId: '', terminalNodeIds: [] };
  const input = { name: '전용 절차', purpose: '목적', scope: 'PROJECT', graph, reason: '새 개정 이유' };
  const result = readProjectMethodInput('saveMethodologyDraft', input);
  assert.deepEqual(result, input); assert.notEqual(result.graph, graph);
  for (const value of [{ ...input, scope: 'USER_COMMON' }, { ...input, applied: true }, { ...input, reason: '' }, { ...input, name: '\ud800' }]) assert.throws(() => readProjectMethodInput('saveMethodologyDraft', value));
  const sourceRef = { id: 'a6f20000-0000-4000-8000-000000000001', version: 2, contentHash: 'a'.repeat(64) };
  assert.deepEqual(readProjectMethodInput('copyMethodology', { sourceRef, name: '복사', scope: 'PROJECT', reason: '프로젝트만 개정' }), { sourceRef, name: '복사', scope: 'PROJECT', reason: '프로젝트만 개정' });
});

test('내용 검토는 METHOD5 전 항목을 정확 버전에 묶고 부적합을 합격으로 바꾸지 않는다', () => {
  const ref = { id: 'a6f20000-0000-4000-8000-000000000001', version: 1, contentHash: 'b'.repeat(64) };
  const items = ['METHOD_PURPOSE_SCOPE', 'METHOD_FLOW_CONTROL', 'METHOD_INPUT_OUTPUT', 'METHOD_COMPLETION_APPROVAL', 'METHOD_RECORD_LIMITS'].map(criterionId => ({ criterionId, outcome: 'ACCEPTED', evidenceRefs: [], reason: '원문 대조' }));
  const payload = { targetKind: 'METHODOLOGY', targetRef: ref, criteriaVersion: 1, items, outcome: 'ACCEPTED', reason: '내용 확인' };
  assert.deepEqual(readProjectMethodReview(payload), payload);
  assert.throws(() => readProjectMethodReview({ ...payload, items: items.slice(1) }));
  assert.throws(() => readProjectMethodReview({ ...payload, items: [...items.slice(1), items[1]] }));
  assert.throws(() => readProjectMethodReview({ ...payload, items: [{ ...items[0], outcome: 'REWORK' }, ...items.slice(1)] }));
  assert.throws(() => readProjectMethodReview({ ...payload, targetKind: 'DOCUMENT' }));
});
