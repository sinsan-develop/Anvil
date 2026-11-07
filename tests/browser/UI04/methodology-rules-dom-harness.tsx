import React, { useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import { WorkspaceMethodology } from '../../../apps/web/src/features/workspace/WorkspaceMethodology.tsx';
import { ordered } from '../../../apps/web/src/features/knowledge/review-view.ts';

const w = window as any, pid = '32b5f276-13e6-4d8a-b93f-27a15d21c788';
const qa = w.__methodologyRulesQA = { requests: [] as { path: string; method: string | undefined }[], unexpected: [] as string[], selections: [] as unknown[], authLost: 0 };
const condition = { fieldRef: { nodeId: 'N1', field: 'USER_DECISION' }, operator: 'EQ', value: '<script>window.rulesUnsafe=1</script> 승인' };
function node(nodeId: string, name: string, kind = 'HUMAN', joinRule?: unknown): any {
  return { nodeId, name, purpose: name + ' 목적', kind, position: { x: 0, y: 0 }, role: 'USER', inputs: [], outputs: [], taskScope: { included: ['저장된 정의 조회'], excluded: ['실제 실행'] }, completionCriteria: ['저장 완료조건'], approvalBoundary: ['사용자 판단'], mode: 'CASE_BY_CASE', limitPolicyRef: null, recordRequirements: ['상황 기록'], ...(joinRule === undefined ? {} : { joinRule }) };
}
function graph(mode: string): any {
  const result = { nodes: [node('N1', '요구 판단'), node('N2', '결과 판단'), node('J1', '모든 결과 합류', 'JOIN', { mode: 'ALL' }), node('J2', '명시 조건 합류', 'JOIN', { mode: 'DECLARED_CONDITION', condition: { all: [condition, { not: { fieldRef: { nodeId: 'N2', field: 'REVIEW_OUTCOME' }, operator: 'IN', value: ['REWORK', 'BLOCKED'] } }] } }), node('N3', '마지막 확인')],
    edges: [
      { edgeId: 'E1', fromNodeId: 'N1', toNodeId: 'N2', kind: 'SEQUENCE', condition: null, reason: '판단 연결' },
      { edgeId: 'E2', fromNodeId: 'N1', toNodeId: 'J1', kind: 'JOIN', condition: null, reason: '첫 선행 연결' },
      { edgeId: 'E3', fromNodeId: 'N2', toNodeId: 'J1', kind: 'JOIN', condition: null, reason: '둘째 선행 연결' },
      { edgeId: 'E4', fromNodeId: 'J1', toNodeId: 'J2', kind: 'JOIN', condition: null, reason: '모든 결과 이후' },
      { edgeId: 'E5', fromNodeId: 'N2', toNodeId: 'J2', kind: 'JOIN', condition: null, reason: '판단 이후' },
      { edgeId: 'E6', fromNodeId: 'J2', toNodeId: 'N3', kind: 'SEQUENCE', condition: null, reason: '정의상 마지막' },
      { edgeId: 'R1', fromNodeId: 'J1', toNodeId: 'N1', kind: 'REWORK', condition, reason: '요구 보완', retryPolicy: { maxAttempts: 3, counting: 'SAME_FAILURE_FINGERPRINT', onExhausted: 'USER_DECISION' } },
      { edgeId: 'R2', fromNodeId: 'J2', toNodeId: 'N2', kind: 'REWORK', condition, reason: '결과 보완', retryPolicy: { maxAttempts: 2, counting: 'SAME_FAILURE_FINGERPRINT', onExhausted: 'USER_DECISION' } },
    ], entryNodeId: 'N1', terminalNodeIds: ['N3'] };
  const join = result.nodes[2]!, retry = result.edges[6]!;
  if (mode === 'JOIN_MISSING') delete join.joinRule;
  if (mode === 'JOIN_NULL') join.joinRule = null;
  if (mode === 'JOIN_UNKNOWN') join.joinRule = { mode: 'ANY', condition };
  if (mode === 'JOIN_EXTRA') join.joinRule = { mode: 'ALL', executable: true };
  if (mode === 'JOIN_CONDITION_MISSING') join.joinRule = { mode: 'DECLARED_CONDITION' };
  if (mode === 'JOIN_CONDITION_INVALID') join.joinRule = { mode: 'DECLARED_CONDITION', condition: { all: [] } };
  if (mode === 'JOIN_CONDITION_UNKNOWN') join.joinRule = { mode: 'DECLARED_CONDITION', condition: { ...condition, operator: 'EXECUTE' } };
  if (mode === 'JOIN_CONDITION_REFERENCE') join.joinRule = { mode: 'DECLARED_CONDITION', condition: { ...condition, fieldRef: { nodeId: 'MISSING', field: 'USER_DECISION' } } };
  if (mode === 'JOIN_CONDITION_OPERATOR_ARRAY') join.joinRule = { mode: 'DECLARED_CONDITION', condition: { ...condition, operator: ['EQ'], value: '승인' } };
  if (mode === 'JOIN_CONDITION_FIELD_ARRAY') join.joinRule = { mode: 'DECLARED_CONDITION', condition: { fieldRef: { nodeId: 'N1', field: ['REVIEW_OUTCOME'] }, operator: 'EQ', value: 'ACCEPTED' } };
  if (mode === 'JOIN_WRONG_NODE') result.nodes[0]!.joinRule = { mode: 'ALL' };
  if (mode === 'RETRY_MISSING') delete retry.retryPolicy;
  if (mode === 'RETRY_NULL') retry.retryPolicy = null as any;
  if (mode === 'RETRY_STRING') retry.retryPolicy = '임의 정책' as any;
  if (mode === 'RETRY_EXTRA') retry.retryPolicy = { ...retry.retryPolicy, executable: true } as any;
  const maxima: Record<string, unknown> = { RETRY_NAN: NaN, RETRY_INFINITY: Infinity, RETRY_FRACTION: 1.5, RETRY_ZERO: 0, RETRY_NEGATIVE: -1, RETRY_STRING_MAX: '3', RETRY_UNSAFE: Number.MAX_SAFE_INTEGER + 1 };
  if (Object.hasOwn(maxima, mode)) retry.retryPolicy!.maxAttempts = maxima[mode] as any;
  if (mode === 'RETRY_COUNTING') retry.retryPolicy!.counting = 'ALL_FAILURES';
  if (mode === 'RETRY_EXHAUSTION') retry.retryPolicy!.onExhausted = 'AUTO_RUN';
  if (mode === 'RETRY_WRONG_EDGE') result.edges[0]!.retryPolicy = { maxAttempts: 9, counting: 'SAME_FAILURE_FINGERPRINT', onExhausted: 'USER_DECISION' };
  return result;
}
async function digest(value: unknown) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ordered(value))))].map(byte => byte.toString(16).padStart(2, '0')).join(''); }
async function application(mode: string) {
  const definition = graph(mode), snapshot = { name: '고정 방법론 규칙', purpose: '실행과 구분한 저장 규칙', graph: definition, sourceRef: { id: '51c0439f-791e-4bb5-8471-70938d6afaf1', version: 3, contentHash: await digest(definition) } };
  return { projectId: pid, applicationRef: { id: 'a6f30000-0000-4000-8000-000000000099', version: 2, contentHash: await digest(snapshot) }, snapshot, observedAt: '2026-10-25T01:02:03Z', executionState: 'NOT_CONNECTED' };
}
function Harness({ initial }: { initial: Awaited<ReturnType<typeof application>> }) {
  const [model, setModel] = useState({ value: initial, epoch: 0 });
  qa.reset = async (mode: string) => { const value = await application(mode); flushSync(() => setModel(previous => ({ value, epoch: previous.epoch + 1 }))); };
  const client = new ApiClient((async (path, init) => {
    qa.requests.push({ path: String(path), method: init?.method });
    if (String(path) !== '/api/v1/projects/' + pid + '/methodology-application' || init?.method !== 'GET') { qa.unexpected.push(String(path)); throw Error('등록하지 않은 합성 요청'); }
    const response = Response.json(null);
    // 비유한 값도 응답 객체에서 직접 전달하여 표시 경계의 방어를 확인한다.
    response.json = async () => structuredClone(model.value);
    return response;
  }) as typeof fetch);
  return <WorkspaceMethodology key={model.epoch} client={client} projectId={pid} expectedRef={model.value.applicationRef} onAuthenticationLost={() => qa.authLost++} onStageChange={value => qa.selections.push(value)} />;
}
application('NORMAL').then(initial => createRoot(document.getElementById('root')!).render(<Harness initial={initial} />));
