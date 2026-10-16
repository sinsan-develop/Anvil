import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readStageNodeRef, nodeUsesForm } from '../../../apps/server/modules/documents/document-stage.ts';
const applicationId = 'a6f20000-0000-4000-8000-000000000091';
// 결함 검출 대상: 경로/추측한 단계/위장 필드 수용·양식 버전/hash 혼동.
test('문서 단계 참조는 고정 적용 ID와 노드 ID만 받으며 미연결 null은 보존한다', () => {
  assert.equal(readStageNodeRef(null), null);
  assert.deepEqual(readStageNodeRef({ applicationId, nodeId: 'ANALYSIS-01' }), { applicationId, nodeId: 'ANALYSIS-01' });
  for (const value of [undefined, {}, { applicationId, nodeId: '' }, { applicationId: '../../x', nodeId: 'N1' }, { applicationId, nodeId: 'N1', verified: true }, { applicationId, nodeId: '\ud800' }]) assert.throws(() => readStageNodeRef(value));
});
test('단계의 입력·산출 양식은 ID뿐 아니라 버전과 hash까지 일치해야 한다', () => {
  const formRef = { id: applicationId, version: 2, contentHash: 'b'.repeat(64) };
  const node = { inputs: [{ formRef }], outputs: [] };
  assert.deepEqual(nodeUsesForm(node, formRef), ['INPUT']);
  assert.deepEqual(nodeUsesForm({ inputs: [], outputs: [{ formRef }] }, formRef), ['OUTPUT']);
  assert.deepEqual(nodeUsesForm(node, { ...formRef, version: 1 }), []);
  assert.deepEqual(nodeUsesForm(node, { ...formRef, contentHash: 'a'.repeat(64) }), []);
});
