import assert from 'node:assert/strict';
import test from 'node:test';
const module = await import('../../../apps/server/modules/assignments/assignment-input.ts').catch((error: NodeJS.ErrnoException) => { if (error.code === 'ERR_MODULE_NOT_FOUND') return {}; throw error; });
const read = (value: unknown) => { assert.equal(typeof (module as any).readAssignmentDraftInput, 'function'); return (module as any).readAssignmentDraftInput(value); };
const id = '11111111-1111-4111-8111-111111111111', ref = { id, version: 1, contentHash: 'a'.repeat(64) };
const sample = () => ({ baseRef: null, reason: '임무 준비', definition: {
  taskRef: { planRef: { ...ref }, taskCode: 'FN01', applicationRef: { ...ref }, nodeId: 'N1' }, purpose: '왜 하는지 보존', goal: '계획의 한 업무를 수행', baselineRefs: [{ ...ref }],
  inputs: ['확정 요구'], outputs: ['구현과 근거'], acceptanceCriteria: ['핵심 동작 확인'], verificationRequirements: ['정상·중요 실패 확인'], included: ['개발'], excluded: ['운영 배포'],
  allowedScopes: [], environmentRef: null, requiredCapabilities: ['파일 수정'], budgetRef: null, ownerRole: '단계책임자', parentAssignmentRef: null, recordingPolicyRef: null, integrationResponsibility: '책임자가 결과를 검토·통합',
} });

test('임무 초안은 목적·기준·완료조건을 보존하지만 입력참조/저장을 실행허가로 만들지 않는다', () => {
  const value = sample(), before = JSON.stringify(value), result = read(value);
  assert.deepEqual(result.input, value); assert.equal(JSON.stringify(value), before);
  value.definition.purpose = '이후 변경'; assert.equal(result.input.definition.purpose, '왜 하는지 보존');
  assert.equal(result.ready, false); assert.equal(result.executionAuthorized, false); assert.equal(result.dispatchPerformed, false);
  for (const code of ['CONTEXT_NOT_REVIEWED', 'EXECUTION_NOT_CONNECTED', 'BUDGET_UNVERIFIED', 'ENVIRONMENT_UNVERIFIED']) assert(result.readinessIssues.some((issue: any) => issue.code === code));
});
test('빈 의미내용은 버리지 않고 위치별 부족으로 남기며 초안도 READY가 아니다', () => {
  const value = sample(); value.definition.purpose = ''; value.definition.outputs = []; value.definition.acceptanceCriteria = []; value.definition.integrationResponsibility = '';
  const result = read(value); for (const field of ['purpose', 'outputs', 'acceptanceCriteria', 'integrationResponsibility', 'allowedScopes']) assert(result.readinessIssues.some((issue: any) => issue.location === field), field);
  assert.equal(result.input.definition.purpose, ''); assert.equal(result.ready, false);
});
test('잘못된 형태·unknown 완료필드·초과 배열/텍스트·잘못된 ref는 거절한다', () => {
  for (const mutate of [(v: any) => { v.definition.status = 'COMPLETED'; }, (v: any) => { v.definition.budgetRef = { ...ref, version: 0 }; }, (v: any) => { v.definition.inputs = Array(201).fill('x'); }, (v: any) => { v.definition.goal = 'x'.repeat(20001); }, (v: any) => { v.definition.taskRef.nodeId = ''; }, (v: any) => { v.baseRef = { ...ref, contentHash: 'wrong' }; }]) {
    const value = sample(); mutate(value); assert.throws(() => read(value), /ASSIGNMENT_INPUT_INVALID/);
  }
});
test('부모 실임무 미연결과 의심 비밀은 실행이나 저장 대상으로 채택하지 않는다', () => {
  const parent: any = sample(); parent.definition.parentAssignmentRef = { ...ref }; assert.throws(() => read(parent), /ASSIGNMENT_PARENT_NOT_CONNECTED/);
  const secret = sample(); secret.definition.goal = 'api_key=DO_NOT_ECHO_THIS'; assert.throws(() => read(secret), error => error instanceof Error && error.message === 'ASSIGNMENT_SENSITIVE_CONTENT_SUSPECTED');
});
test('허가 scope는 FILE 문법만 대조하며 GETTER 실행·절대/상위/recursive 범위를 거절한다', () => {
  const value: any = sample(); let called = 0; Object.defineProperty(value.definition, 'goal', { enumerable: true, get() { called++; return '위장'; } });
  assert.throws(() => read(value), /ASSIGNMENT_INPUT_INVALID/); assert.equal(called, 0);
  const scope = { sourceRootRef: ref, mappingRef: null, observationRef: ref, baselineRef: ref, targets: [{ relativePath: '../outside', kind: 'FILE', access: 'WRITE', recursive: false }] };
  const bad: any = sample(); bad.definition.allowedScopes = [scope]; assert.throws(() => read(bad), /ASSIGNMENT_INPUT_INVALID/);
  scope.targets[0]!.relativePath = 'src/a.ts'; const result = read(bad); assert.equal(result.executionAuthorized, false); assert(result.readinessIssues.some((i: any) => i.code === 'SOURCE_SCOPE_UNVERIFIED'));
});
