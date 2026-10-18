import { useEffect, useState } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { getMethod, type MethodSummary, type MethodVersion } from '../methodology-editor/api.ts';
import { MethodGraphCanvas } from '../methodology-editor/MethodGraphCanvas.tsx';
import { StoredNodeDefinition } from '../methodology-editor/StoredNodeDefinition.tsx';
import { StoredNodeRoutes } from '../methodology-editor/StoredNodeRoutes.tsx';
import { StoredMethodValidation } from '../methodology-editor/StoredMethodValidation.tsx';

const texts = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
function limitRef(value: unknown) {
 const ref = value as MethodVersion['ref'];
 return !!ref && typeof ref === 'object' && Object.keys(ref).sort().join(',') === 'contentHash,id,version' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(ref.id) && Number.isSafeInteger(ref.version) && ref.version > 0 && /^[0-9a-f]{64}$/.test(ref.contentHash);
}
// 기존 getter의 계약은 바꾸지 않고 이 상세 renderer가 추가로 소비하는 정의만 확인한다.
export async function readMethodologyPreview(client: ApiClient, selected: MethodSummary): Promise<MethodVersion> {
 const source = await getMethod(client, selected);
 if (source.graph.nodes.some(node => !node.taskScope || !texts(node.taskScope.included) || !texts(node.taskScope.excluded)
  || !['USER', 'COORDINATOR', 'STAGE_OWNER'].includes(node.role) || !['AUTO', 'CASE_BY_CASE'].includes(node.mode)
  || [...node.inputs, ...node.outputs].some(item => typeof item.required !== 'boolean' || item.sourceNodeId !== undefined && typeof item.sourceNodeId !== 'string')
  || node.limitPolicyRef !== null && !limitRef(node.limitPolicyRef)
  || node.requirements !== undefined && (!node.requirements || !texts(node.requirements.capabilities) || !texts(node.requirements.environment))
  || node.joinRule !== undefined && (!node.joinRule || !['ALL', 'DECLARED_CONDITION'].includes(node.joinRule.mode)))
  || source.graph.edges.some(edge => edge.retryPolicy !== undefined && (!edge.retryPolicy || !Number.isSafeInteger(edge.retryPolicy.maxAttempts) || edge.retryPolicy.maxAttempts < 1 || edge.retryPolicy.counting !== 'SAME_FAILURE_FINGERPRINT' || edge.retryPolicy.onExhausted !== 'USER_DECISION'))) throw new ApiError('RESPONSE_INVALID');
 return source;
}

export function MethodologyPreviewDefinition({ source, nodeId, onSelect }: { source: MethodVersion; nodeId: string; onSelect: (id: string) => void }) {
 const node = source.graph.nodes.find(item => item.nodeId === nodeId);
 return <section aria-label="생성 전 방법론 원본 미리보기"><h4>{source.name}</h4><p>{source.purpose}</p>
  <p className="meta" style={{ overflowWrap: 'anywhere' }}>{source.ref.id} · v{source.ref.version} · {source.ref.contentHash}</p>
  <p className="meta">목록에서 선택한 원본의 읽기 미리보기입니다. 생성 초안에 연결·복사·저장하지 않습니다. 확정·적용·도구/환경 준비와 실제 실행은 별도입니다.</p>
  <MethodGraphCanvas graph={source.graph} selectedId={nodeId} onSelect={onSelect} label="생성 전 방법론 흐름도" />
  <div role="group" aria-label="미리보기 단계 선택">{source.graph.nodes.map(item => <button type="button" key={item.nodeId} aria-label={'미리보기 단계 ' + item.nodeId} aria-pressed={item.nodeId === nodeId} onClick={() => onSelect(item.nodeId)}>{item.name}</button>)}</div>
  {node ? <><StoredNodeDefinition node={node} /><StoredNodeRoutes graph={source.graph} nodeId={node.nodeId} /></> : <p role="status">선택 단계 미확인 · 다른 단계를 대신 표시하지 않습니다.</p>}
  <details><summary>원본의 구조 검사 · 실제 실행 검증 아님</summary><StoredMethodValidation graph={source.graph} validation={source.validation} onSelect={onSelect} /></details>
 </section>;
}

type ReadState = { status: 'LOADING' } | { status: 'READY'; source: MethodVersion } | { status: 'ERROR'; error: ApiError };
export function MethodologyPreview({ client, selected, onAuthenticationLost }: { client: ApiClient; selected: MethodSummary; onAuthenticationLost: () => void }) {
 const identity = JSON.stringify(selected), [read, setRead] = useState<{ client: ApiClient; identity: string; value: ReadState } | null>(null), [nodeId, setNodeId] = useState('');
 useEffect(() => {
  let current = true;
  setRead({ client, identity, value: { status: 'LOADING' } });
  void readMethodologyPreview(client, structuredClone(selected)).then(source => { if (current) { setNodeId(source.graph.entryNodeId); setRead({ client, identity, value: { status: 'READY', source } }); } })
   .catch((cause: unknown) => { if (!current) return; const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setRead({ client, identity, value: { status: 'ERROR', error } }); if (error.status === 401) onAuthenticationLost(); });
  return () => { current = false; };
 }, [client, identity]);
 const value = read?.client === client && read.identity === identity ? read.value : null;
 return value?.status === 'READY' ? <MethodologyPreviewDefinition source={value.source} nodeId={nodeId} onSelect={setNodeId} /> : value?.status === 'ERROR' ? <p role="alert">{value.error.message} · {value.error.code} · 원본 미리보기 미확인. 초안 선택은 변경하지 않았습니다.</p> : <p role="status">선택한 정확 방법론 원본 조회 중</p>;
}
