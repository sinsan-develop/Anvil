import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import type { MethodologyNode } from '../../../contracts/methodologies.ts';
import { canonicalJson } from '../../../contracts/canonical.ts';
import { ordered } from '../../../apps/web/src/features/knowledge/review-view.ts';

const file = new URL('../../../apps/web/src/features/methodology-editor/node-definition-patch.ts', import.meta.url);
const module = existsSync(file) ? await import(file.href) : {};
function apply(node: MethodologyNode, patch: Partial<MethodologyNode>): MethodologyNode {
  assert.equal(typeof module.applyNodeDefinitionPatch, 'function', '단계 정의 patch 적용 함수가 필요합니다');
  return module.applyNodeDefinitionPatch(node, patch);
}
function fixture(): MethodologyNode {
  return { nodeId: 'N1', name: '합류', purpose: '선행 대조', kind: 'JOIN', position: { x: 10, y: 20 }, role: 'STAGE_OWNER', inputs: [], outputs: [], taskScope: { included: ['검토'], excluded: ['운영'] }, completionCriteria: ['확인'], approvalBoundary: [], mode: 'CASE_BY_CASE', limitPolicyRef: null, recordRequirements: ['상황'], joinRule: { mode: 'ALL' } };
}
test('명시한 합류 규칙 제거는 원본을 보존하고 요청 원문과 wire 해시 입력을 일치시킨다', () => {
  const node = fixture(), before = structuredClone(node), patch = { kind: 'HUMAN' as const, role: 'USER' as const, joinRule: undefined };
  const next = apply(node, patch), expected = { ...before, kind: 'HUMAN', role: 'USER' };
  delete expected.joinRule;
  assert.deepEqual(next, expected); assert.equal(Object.hasOwn(next, 'joinRule'), false);
  assert.equal(ordered(next), canonicalJson(next));
  assert.equal(ordered(next), ordered(JSON.parse(JSON.stringify(next))));
  assert.deepEqual(node, before); assert.equal(Object.hasOwn(patch, 'joinRule'), true);
});
test('유형이나 규칙을 생략한 일반 편집은 기존 명시 합류 조건을 유지한다', () => {
  const node = fixture();
  node.joinRule = { mode: 'DECLARED_CONDITION', condition: { fieldRef: { nodeId: 'N0', field: 'REVIEW_OUTCOME' }, operator: 'EQ', value: 'ACCEPTED' } };
  const before = structuredClone(node), next = apply(node, { name: '새 이름' });
  assert.deepEqual(next, { ...before, name: '새 이름' }); assert.deepEqual(node, before);
  assert.equal(ordered(next), canonicalJson(next));
});
test('새 합류 규칙을 제공하면 보존하며 다른 undefined 입력은 정규화하지 않는다', () => {
  const node = fixture(); delete node.joinRule; node.kind = 'HUMAN';
  const rule = { mode: 'ALL' as const }, next = apply(node, { kind: 'JOIN', joinRule: rule });
  assert.deepEqual(next.joinRule, { mode: 'ALL' }); assert.equal(ordered(next), canonicalJson(next));
  const invalid = apply(node, { purpose: undefined });
  assert.equal(Object.hasOwn(invalid, 'purpose'), true);
  assert.throws(() => canonicalJson(invalid), /INPUT_INVALID/); assert.throws(() => ordered(invalid));
});
