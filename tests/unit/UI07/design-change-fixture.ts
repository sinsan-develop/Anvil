import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
export const projectId = '11111111-1111-4111-8111-111111111111', changeId = '22222222-2222-4222-8222-222222222222';
const ref = (id: string) => ({ id, version: 1, contentHash: 'a'.repeat(64) });
const before = ref('33333333-3333-4333-8333-333333333333'), proposal = '44444444-4444-4444-8444-444444444444', impactId = '55555555-5555-4555-8555-555555555555', at = '2026-10-18T00:00:00Z';
export function designChangeFixture() {
  const snapshot = { beforeRef: before, afterProposalRef: proposal, reason: '실패 시 복구 절차를 명확히 한다', sourceRefs: [{ kind: 'USER_INSTRUCTION', id: proposal, contentHash: 'b'.repeat(64) }] };
  const change = { ref: { id: changeId, version: 1, contentHash: contentHash(canonicalJson(snapshot)) }, status: 'PROPOSED', ...snapshot, requestedBy: { kind: 'HUMAN', userId: projectId }, createdAt: at };
  const plan = ref('66666666-6666-4666-8666-666666666666');
  const base = { changeRef: change.ref, sourceKind: 'MECHANICAL_TRACE', beforeRef: before, items: [{ targetRef: { kind: 'PLAN_TASK', id: plan.id, versionRef: plan, localCode: 'FN01' }, state: 'AFFECTED', reason: '정확한 설계 버전을 참조하므로 재확인 대상입니다.', evidenceRefs: [] }], coverageGaps: [{ code: 'EXECUTION_SOURCE_NOT_CONNECTED' }, { code: 'TEST_EVIDENCE_SOURCE_NOT_CONNECTED' }], requiresReview: true, inputs: { planRefs: [plan], indexedDesign: true } };
  const mechanical = { ref: { id: impactId, version: 1, contentHash: contentHash(canonicalJson(base)) }, ...base, observedAt: at };
  const review = { changeRef: change.ref, baseImpactRef: mechanical.ref, sourceKind: 'HUMAN_REVIEW', beforeRef: before, items: [{ ...base.items[0], state: 'UNKNOWN', reason: '실제 실행 결과가 없어 영향은 미확인입니다.' }], coverageGaps: base.coverageGaps, reason: '미확인 상태를 보존해 검토', requiresReview: true, inputs: base.inputs, reviewer: { kind: 'HUMAN', userId: projectId } };
  const human = { ref: { id: impactId, version: 2, contentHash: contentHash(canonicalJson(review)) }, ...review, observedAt: at };
  return { change, impactVersions: [human, mechanical], latestImpactRef: human.ref, hasMoreImpacts: false, nextBeforeVersion: null, activatedAsBaseline: false, observedAt: at };
}
