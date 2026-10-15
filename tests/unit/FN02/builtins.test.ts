import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildOfficialForms } from '../../../apps/server/modules/documents/forms.ts';
import { buildBuiltinMethodologies } from '../../../apps/server/modules/methodologies/builtins.ts';

test('내장3종은 승인7단계와 공식 양식 고정버전·사람 확인·유한 재작업 경로를 보존한다', async () => {
  const forms = buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md', import.meta.url)), await readFile(new URL('../../../docs/design/문서작성_공통기준.md', import.meta.url)));
  const source = await readFile(new URL('../../../docs/design/기본방법론_상세검토안.md', import.meta.url));
  const methods = buildBuiltinMethodologies(source, forms.forms);
  assert.equal(methods.length, 3);
  assert.deepEqual(methods.map(method => method.systemCode), ['SYS-M01', 'SYS-M02', 'SYS-M03']);
  assert.deepEqual(methods.map(method => method.name), ['구조적 방법론', '객체지향 방법론', '애자일 방법론']);
  for (const [index, method] of methods.entries()) {
    assert.equal(method.graph.nodes.length, 7);
    assert.equal(method.graph.nodes[0]!.nodeId, ['ST01', 'OO01', 'AG01'][index]);
    assert.equal(method.graph.nodes[6]!.kind, 'HUMAN');
    assert.equal(method.graph.nodes[6]!.role, 'USER');
    assert(method.graph.nodes.every(node => node.completionCriteria.length > 0 && node.recordRequirements.length > 0 && node.limitPolicyRef === null));
    assert(method.graph.nodes[2]!.approvalBoundary.includes('USER_DESIGN_AND_SCREEN_CONFIRMATION'));
    assert(method.graph.nodes[3]!.approvalBoundary.includes('USER_WORK_AND_TEST_PLAN_CONFIRMATION'));
    const actualRefs = new Set(forms.forms.map(form => JSON.stringify(form.ref)));
    assert(method.graph.nodes.flatMap(node => [...node.inputs, ...node.outputs]).every(item => actualRefs.has(JSON.stringify(item.formRef))));
    assert(method.graph.edges.filter(edge => edge.kind === 'REWORK').every(edge => edge.condition !== null && edge.reason.length > 0 && edge.retryPolicy!.maxAttempts === 3));
    assert.equal(method.runtimeReadiness, 'PROJECT_BINDINGS_REQUIRED');
  }
  assert(methods[2]!.graph.edges.some(edge => edge.kind === 'REWORK' && edge.fromNodeId === 'AG07' && edge.toNodeId === 'AG02'));
  const nextIteration = methods[2]!.graph.edges.find(edge => edge.fromNodeId === 'AG07' && edge.toNodeId === 'AG02')!;
  assert.deepEqual(nextIteration.condition, { kind: 'USER_CHOICE', nodeId: 'AG07', choiceId: 'NEXT_ITERATION' });
  assert.equal(nextIteration.retryPolicy!.counting, 'SAME_FAILURE_FINGERPRINT');
  assert.throws(() => buildBuiltinMethodologies(Buffer.concat([source, Buffer.from('\n미승인 변경')]), forms.forms), /BUILTIN_SOURCE_NOT_APPROVED/);
  assert.throws(() => buildBuiltinMethodologies(source, forms.forms.slice(0, 7)), /OFFICIAL_FORM_CATALOG_INCOMPLETE/);
});
