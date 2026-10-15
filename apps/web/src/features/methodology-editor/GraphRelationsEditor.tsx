import { useId, useState } from 'react';
import type { MethodologyEdge, MethodologyGraph } from '../../../../../contracts/methodologies.ts';
import { ConditionEditor } from './ConditionEditor.tsx';

export function GraphRelationsEditor({ graph, onChange }: { graph: MethodologyGraph; onChange: (graph: MethodologyGraph) => void }) {
  const id = useId(), [selectedId, setSelectedId] = useState('');
  const edge = graph.edges.find(value => value.edgeId === selectedId) ?? graph.edges[0];
  function patchEdge(patch: Partial<MethodologyEdge>) { if (edge) onChange({ ...graph, edges: graph.edges.map(value => value.edgeId === edge.edgeId ? { ...value, ...patch } : value) }); }
  function add() {
    const edgeId = 'E-' + crypto.randomUUID().slice(0, 8);
    onChange({ ...graph, edges: [...graph.edges, { edgeId, fromNodeId: graph.entryNodeId || graph.nodes[0]?.nodeId || '', toNodeId: graph.nodes.at(-1)?.nodeId ?? '', kind: 'SEQUENCE', condition: null, reason: '' }] }); setSelectedId(edgeId);
  }
  function kind(value: MethodologyEdge['kind']) {
    if (!edge) return;
    const next = { ...edge, kind: value };
    if (value === 'REWORK') next.retryPolicy ??= { maxAttempts: 3, counting: 'SAME_FAILURE_FINGERPRINT', onExhausted: 'USER_DECISION' };
    else delete next.retryPolicy;
    onChange({ ...graph, edges: graph.edges.map(item => item.edgeId === edge.edgeId ? next : item) });
  }
  return <details open><summary>단계 연결·시작/종료·재작업</summary>
    <label htmlFor={id + '-entry'}>시작 단계</label><select id={id + '-entry'} value={graph.entryNodeId} onChange={event => onChange({ ...graph, entryNodeId: event.target.value })}><option value="">미지정</option>{graph.nodes.map(node => <option key={node.nodeId} value={node.nodeId}>{node.name || node.nodeId}</option>)}</select>
    <div>{graph.nodes.map(node => <label key={node.nodeId}><input type="checkbox" checked={graph.terminalNodeIds.includes(node.nodeId)} onChange={event => onChange({ ...graph, terminalNodeIds: event.target.checked ? [...graph.terminalNodeIds, node.nodeId] : graph.terminalNodeIds.filter(value => value !== node.nodeId) })} />{node.name || node.nodeId} 종료 단계</label>)}</div>
    <button disabled={!graph.nodes.length} onClick={add}>단계 연결 추가</button>
    {graph.edges.length ? <><label htmlFor={id + '-edge'}>편집할 연결</label><select id={id + '-edge'} value={edge?.edgeId ?? ''} onChange={event => setSelectedId(event.target.value)}>{graph.edges.map(value => <option key={value.edgeId} value={value.edgeId}>{value.edgeId}: {value.fromNodeId} → {value.toNodeId}</option>)}</select></> : <p>연결이 없습니다. 단계가 여러 개면 필요한 순서·조건을 연결하세요.</p>}
    {edge ? <div className="graph-fields"><label htmlFor={id + '-from'}>연결 출발 단계</label><select id={id + '-from'} value={edge.fromNodeId} onChange={event => patchEdge({ fromNodeId: event.target.value })}>{graph.nodes.map(node => <option key={node.nodeId} value={node.nodeId}>{node.name || node.nodeId}</option>)}</select>
      <label htmlFor={id + '-to'}>연결 도착 단계</label><select id={id + '-to'} value={edge.toNodeId} onChange={event => patchEdge({ toNodeId: event.target.value })}>{graph.nodes.map(node => <option key={node.nodeId} value={node.nodeId}>{node.name || node.nodeId}</option>)}</select>
      <label htmlFor={id + '-kind'}>연결 유형</label><select id={id + '-kind'} value={edge.kind} onChange={event => kind(event.target.value as MethodologyEdge['kind'])}><option value="SEQUENCE">순서</option><option value="BRANCH">조건 분기</option><option value="JOIN">합류 연결</option><option value="REWORK">재작업·반복</option></select>
      <label htmlFor={id + '-reason'}>연결 이유</label><textarea id={id + '-reason'} value={edge.reason} onChange={event => patchEdge({ reason: event.target.value })} />
      <ConditionEditor nodes={graph.nodes} value={edge.condition} label="연결 조건" onChange={condition => patchEdge({ condition })} />
      {edge.kind === 'REWORK' && edge.retryPolicy ? <><label htmlFor={id + '-attempts'}>같은 실패의 최대 재작업 횟수</label><input id={id + '-attempts'} type="number" min={1} step={1} value={edge.retryPolicy.maxAttempts} onChange={event => { if (edge.retryPolicy && Number.isSafeInteger(event.target.valueAsNumber) && event.target.valueAsNumber > 0) patchEdge({ retryPolicy: { ...edge.retryPolicy, maxAttempts: event.target.valueAsNumber } }); }} /><p className="meta">동일 실패 지문 기준 · 초과하면 사용자 판단. 실제 호출/시간/비용의 한도 정책은 별도 연결해야 합니다.</p></> : null}
      <button onClick={() => { if (confirm('이 초안의 선택 연결만 뺄까요? 기존 저장 버전은 유지합니다.')) onChange({ ...graph, edges: graph.edges.filter(value => value.edgeId !== edge.edgeId) }); }}>이 초안의 연결 제거</button>
    </div> : null}
  </details>;
}
