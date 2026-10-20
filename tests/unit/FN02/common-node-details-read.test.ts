import assert from 'node:assert/strict';
import test from 'node:test';
import { validateMethodVersion } from '../../../apps/web/src/features/methodology-editor/api.ts';
import type { MethodVersion } from '../../../apps/web/src/features/methodology-editor/api.ts';

function fixture(): MethodVersion {
 return { ref: { id: '10000000-0000-4000-8000-000000000001', version: 1, contentHash: 'a'.repeat(64) }, name: '原本', purpose: '정의 확인', scope: 'SYSTEM', systemCode: 'SYS-M01', confirmation: null, validation: { validForConfirmation: false, issues: [] }, runtimeReadiness: 'PROJECT_BINDINGS_REQUIRED',
 graph: { entryNodeId: 'N', terminalNodeIds: ['N'], edges: [], nodes: [{ nodeId: 'N', name: '단계', purpose: '작업', kind: 'JOIN', position: { x: 0, y: 0 }, role: 'STAGE_OWNER', mode: 'CASE_BY_CASE', taskScope: { included: ['설계'], excluded: ['배포'] }, inputs: [], outputs: [], completionCriteria: [], approvalBoundary: [], recordRequirements: [], limitPolicyRef: null }] } };
}

test('공통·시스템 원본의 필수 책임·방식·범위·한도 형식 오류를 거절한다', () => {
 const patches = [{ role: 'OTHER' }, { role: undefined }, { mode: 'UNKNOWN' }, { mode: undefined }, { taskScope: undefined }, { taskScope: { included: 'all', excluded: [] } }, { taskScope: { included: [], excluded: [1] } }, { limitPolicyRef: undefined }, { limitPolicyRef: { id: 'not-id', version: 1, contentHash: 'a'.repeat(64) } }];
 for (const scope of ['SYSTEM', 'USER_COMMON']) for (const patch of patches) {
  const value = fixture(); value.scope = scope; Object.assign(value.graph.nodes[0]!, patch);
  assert.throws(() => validateMethodVersion(value, value), { code: 'RESPONSE_INVALID' }, JSON.stringify(patch));
 }
});

test('선택적 요구·합류 정의는 미작성 허용과 잘못된 형식 거절을 구분한다', () => {
 const value = fixture(); assert.equal(validateMethodVersion(value, value), value);
 for (const patch of [{ requirements: null }, { requirements: { capabilities: [], environment: 'any' } }, { joinRule: null }, { joinRule: { mode: 'OTHER' } }, { joinRule: { mode: 'DECLARED_CONDITION', condition: 42 } }]) {
  const bad = fixture(); Object.assign(bad.graph.nodes[0]!, patch); assert.throws(() => validateMethodVersion(bad, bad), { code: 'RESPONSE_INVALID' });
 }
 value.graph.nodes[0]!.joinRule = { mode: 'DECLARED_CONDITION' };
 assert.equal(validateMethodVersion(value, value), value); // 작성 중인 조건을 완료로 강제하지 않는다.
});
