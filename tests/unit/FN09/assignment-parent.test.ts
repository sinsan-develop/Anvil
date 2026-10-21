import assert from 'node:assert/strict';
import test from 'node:test';
import { readAssignmentDraftInput } from '../../../apps/server/modules/assignments/assignment-input.ts';

const ref = { id: '11111111-1111-4111-8111-111111111111', version: 1, contentHash: 'a'.repeat(64) };
const parent = { ...ref, id: '22222222-2222-4222-8222-222222222222' };
function input(): any { return { baseRef: null, reason: '부모 범위의 하위 초안', definition: {
  taskRef: { planRef: ref, taskCode: 'FN01', applicationRef: ref, nodeId: 'N1' },
  purpose: '사용자 방법론 준수', goal: '하위 업무', baselineRefs: [ref], inputs: ['요구'], outputs: ['결과'],
  acceptanceCriteria: ['내용 확인'], verificationRequirements: ['핵심 검사'], included: ['개발'], excluded: ['운영'],
  allowedScopes: [], environmentRef: null, requiredCapabilities: ['FILE_READ'], budgetRef: null,
  ownerRole: '단계책임자', parentAssignmentRef: {...parent}, recordingPolicyRef: null, integrationResponsibility: '부모가 통합',
} }; }

test('부모 fullref를 복제 보존해도 초안 입력은 실행 권한을 만들지 않는다', () => {
  const value = input(), result = readAssignmentDraftInput(value);
  assert.deepEqual(result.input.definition.parentAssignmentRef, parent);
  assert.equal(result.ready, false); assert.equal(result.executionAuthorized, false); assert.equal(result.dispatchPerformed, false);
  value.definition.parentAssignmentRef.version = 2;
  assert.equal(result.input.definition.parentAssignmentRef?.version, 1);
});

test('잘못된 부모 hash/version/형태는 초안 문법에서도 거절한다', () => {
  for (const bad of [{...parent, version:0}, {...parent,contentHash:'wrong'}, 'parent', {...parent,ready:true}]) {
    const value=input(); value.definition.parentAssignmentRef=bad;
    assert.throws(() => readAssignmentDraftInput(value), /ASSIGNMENT_INPUT_INVALID/);
  }
});
