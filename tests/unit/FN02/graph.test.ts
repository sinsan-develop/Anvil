import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildOfficialForms } from '../../../apps/server/modules/documents/forms.ts';
import { buildBuiltinMethodologies } from '../../../apps/server/modules/methodologies/builtins.ts';
import { validateMethodologyGraph } from '../../../apps/server/modules/methodologies/service.ts';

const forms = buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md', import.meta.url)), await readFile(new URL('../../../docs/design/문서작성_공통기준.md', import.meta.url)));
const methods = buildBuiltinMethodologies(await readFile(new URL('../../../docs/design/기본방법론_상세검토안.md', import.meta.url)), forms.forms);
const refs = forms.forms.map(form => form.ref);
const graph = () => structuredClone(methods[0]!.graph);

test('내장 그래프와 명시 재작업은 유효하되 구조 검증만으로 실제 실행 준비를 선언하지 않는다', () => {
  for (const method of methods) {
    const result = validateMethodologyGraph(method.graph, refs);
    assert.equal(result.validForConfirmation, true);
    assert.equal(result.runtimeReadiness, 'PROJECT_BINDINGS_REQUIRED');
    assert(result.issues.some(issue => issue.code === 'LIMIT_POLICY_UNBOUND' && issue.severity === 'WARNING'));
  }
});
test('재작업 외 우연한 순환은 정확 노드 위치의 오류로 거절한다', () => {
  const value = graph();
  value.edges.push({ edgeId: 'accidental', fromNodeId: 'ST06', toNodeId: 'ST03', kind: 'SEQUENCE', condition: null, reason: '잘못 연결' });
  const result = validateMethodologyGraph(value, refs);
  assert.equal(result.validForConfirmation, false);
  assert(result.issues.some(issue => issue.code === 'UNINTENDED_CYCLE'));
});
test('재작업 이유/재개 조건/유한 정책 누락은 저장 초안과 확정 가능성을 구별한다', () => {
  const value = graph(), edge = value.edges.find(item => item.kind === 'REWORK')!;
  edge.condition = null; edge.reason = ''; delete edge.retryPolicy;
  const result = validateMethodologyGraph(value, refs);
  assert.equal(result.validForConfirmation, false);
  assert(result.issues.some(issue => issue.code === 'REWORK_POLICY_REQUIRED' && issue.location.includes(edge.edgeId)));
});
test('중복 노드/부재 참조·도달 불가·빈 완료 조건·타 양식 hash를 구별한다', () => {
  const duplicate = graph(); duplicate.nodes.push(structuredClone(duplicate.nodes[0]!));
  assert(validateMethodologyGraph(duplicate, refs).issues.some(issue => issue.code === 'DUPLICATE_NODE_ID'));
  const missing = graph(); missing.edges[0]!.toNodeId = 'UNKNOWN';
  assert(validateMethodologyGraph(missing, refs).issues.some(issue => issue.code === 'NODE_REFERENCE_MISSING'));
  const unreachable = graph(); unreachable.edges = unreachable.edges.filter(edge => edge.fromNodeId !== 'ST02' || edge.kind === 'REWORK');
  assert(validateMethodologyGraph(unreachable, refs).issues.some(issue => issue.code === 'UNREACHABLE_NODE' && issue.location.includes('ST03')));
  const incomplete = graph(); incomplete.nodes[2]!.completionCriteria = [];
  assert(validateMethodologyGraph(incomplete, refs).issues.some(issue => issue.code === 'COMPLETION_CRITERIA_REQUIRED'));
  const foreign = graph(); foreign.nodes[0]!.outputs[0]!.formRef.contentHash = '0'.repeat(64);
  assert(validateMethodologyGraph(foreign, refs).issues.some(issue => issue.code === 'FORM_REFERENCE_UNAVAILABLE'));
});
test('사람 단계의 Agent 수행·분기 조건 누락·합류 규칙 누락을 거절한다', () => {
  const human = graph(); human.nodes[6]!.role = 'STAGE_OWNER';
  assert(validateMethodologyGraph(human, refs).issues.some(issue => issue.code === 'HUMAN_ROLE_INVALID'));
  const branch = graph(); branch.edges[0]!.kind = 'BRANCH'; branch.edges[0]!.condition = null;
  assert(validateMethodologyGraph(branch, refs).issues.some(issue => issue.code === 'BRANCH_CONDITION_REQUIRED'));
  const join = graph(); join.nodes[5]!.kind = 'JOIN';
  assert(validateMethodologyGraph(join, refs).issues.some(issue => issue.code === 'JOIN_RULE_REQUIRED'));
});
test('조건 실행 코드/추가 credential 필드·알 수 없는 연산자는 데이터로도 확정하지 않는다', () => {
  const unsafe = graph();
  Object.assign(unsafe.edges[0]!.condition!, { script: 'globalThis.executed = true' });
  assert.equal(validateMethodologyGraph(unsafe, refs).validForConfirmation, false);
  const credential = graph(); Object.assign(credential.nodes[0]!, { credential: 'not-a-real-secret' });
  assert.equal(validateMethodologyGraph(credential, refs).validForConfirmation, false);
  assert.equal(validateMethodologyGraph({ nodes: [], edges: [], entryNodeId: '', terminalNodeIds: [] }, refs).validForConfirmation, false);
});

test('상세 계약15.3의 fieldRef/operator/value와 all/any/not을 사용하며 구형 kind 조건을 확정하지 않는다', () => {
  const value = graph();
  Object.assign(value.edges[0]!, { condition: { all: [
    { fieldRef: { nodeId: 'ST01', field: 'REVIEW_OUTCOME' }, operator: 'IN', value: ['ACCEPTED'] },
    { not: { fieldRef: { nodeId: 'ST01', field: 'REVIEW_OUTCOME' }, operator: 'EQ', value: 'BLOCKED' } },
  ] } });
  assert.equal(validateMethodologyGraph(value, refs).validForConfirmation, true);
  Object.assign(value.edges[0]!, { condition: { kind: 'REVIEW_DECISION', nodeId: 'ST01', outcome: 'ACCEPTED' } });
  assert.equal(validateMethodologyGraph(value, refs).validForConfirmation, false);
});

test('종료 뒤 정상 작업이 남으면 완료 경계로 확정하지 않고 유효한 ALL 합류는 허용한다', () => {
  const premature = graph(); premature.terminalNodeIds = ['ST03'];
  assert(validateMethodologyGraph(premature, refs).issues.some(issue => issue.code === 'TERMINAL_HAS_SUCCESSOR' && issue.location.includes('ST03')));
  const joined = graph();
  joined.nodes[5]!.kind = 'JOIN'; joined.nodes[5]!.joinRule = { mode: 'ALL' };
  joined.edges.push({ edgeId: 'explicit-join', fromNodeId: 'ST04', toNodeId: 'ST06', kind: 'JOIN', condition: { fieldRef: { nodeId: 'ST04', field: 'REVIEW_OUTCOME' }, operator: 'EQ', value: 'ACCEPTED' }, reason: '계획과 구현 결과가 모두 있어야 검수로 합류' });
  assert.equal(validateMethodologyGraph(joined, refs).validForConfirmation, true);
});

for (const location of ['연결', '합류'] as const) {
  const conditionGraph = (condition: unknown) => {
    const value = graph();
    if (location === '연결') Object.assign(value.edges[0]!, { condition });
    else {
      Object.assign(value.nodes[5]!, { kind: 'JOIN', joinRule: { mode: 'DECLARED_CONDITION', condition } });
      value.edges.push({ edgeId: 'conditional-join', fromNodeId: 'ST04', toNodeId: 'ST06', kind: 'JOIN', condition: null, reason: '두 선행 단계의 명시 조건 합류' });
    }
    return value;
  };

  test(`${location} 조건의 정상 문자열 필드와 연산자는 유효하다`, () => {
    const value = conditionGraph({ fieldRef: { nodeId: 'ST01', field: 'REVIEW_OUTCOME' }, operator: 'EQ', value: 'ACCEPTED' });
    const result = validateMethodologyGraph(value, refs);
    assert.equal(result.validForConfirmation, true);
    assert.equal(result.issues.some(issue => issue.code === 'INPUT_INVALID'), false);
  });

  test(`${location} 조건의 배열 연산자는 문자열로 변환하지 않고 입력 오류로 거절한다`, () => {
    const value = conditionGraph({ fieldRef: { nodeId: 'ST01', field: 'REVIEW_OUTCOME' }, operator: ['EQ'], value: 'ACCEPTED' });
    const result = validateMethodologyGraph(value, refs);
    assert.equal(result.validForConfirmation, false);
    assert(result.issues.some(issue => issue.code === 'INPUT_INVALID'));
  });

  test(`${location} 조건의 배열 필드는 문자열로 변환하지 않고 입력 오류로 거절한다`, () => {
    const value = conditionGraph({ fieldRef: { nodeId: 'ST01', field: ['USER_DECISION'] }, operator: 'EQ', value: 'ACCEPTED' });
    const result = validateMethodologyGraph(value, refs);
    assert.equal(result.validForConfirmation, false);
    assert(result.issues.some(issue => issue.code === 'INPUT_INVALID'));
  });
}
