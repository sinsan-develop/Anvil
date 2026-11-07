import { useEffect, useId, useRef, useState } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import type { DraftMethodSelection } from '../../../../../contracts/project-drafts.ts';
import type { MethodologyGraph, MethodologyNode } from '../../../../../contracts/methodologies.ts';
import { MethodGraphCanvas } from '../methodology-editor/MethodGraphCanvas.tsx';
import { NodeDefinitionFields } from '../methodology-editor/NodeDefinitionFields.tsx';
import { applyNodeDefinitionPatch } from '../methodology-editor/node-definition-patch.ts';
import { NodeDocumentFields } from '../methodology-editor/NodeDocumentFields.tsx';
import { GraphRelationsEditor } from '../methodology-editor/GraphRelationsEditor.tsx';
import {NodeDeletionPanel} from '../methodology-editor/NodeDeletionPanel.tsx';
import { listForms, type FormSummary } from '../methodologies/forms-api.ts';
import {DuplicateNodeRepair} from '../methodology-editor/DuplicateNodeRepair.tsx';

type Authored = Extract<DraftMethodSelection, { kind: 'NEW_PROJECT_DRAFT' }>;
export function DraftMethodEditor({ client, value, disabled, onChange, onAuthenticationLost }: {
  client: ApiClient; value: Authored; disabled: boolean; onChange: (next: Authored) => void; onAuthenticationLost: () => void;
}) {
  const id = useId(), [selectedId, setSelectedId] = useState(value.graph.entryNodeId);
  const [forms, setForms] = useState<FormSummary[]>([]), [error, setError] = useState<ApiError | null>(null);
  const latest=useRef({value,disabled});latest.current={value,disabled};
  const selected=value.graph.nodes.find(item=>item.nodeId===selectedId)??value.graph.nodes[0];
  const duplicateSelected=!!selected&&value.graph.nodes.filter(item=>item.nodeId===selected.nodeId).length>1;
  const node=duplicateSelected?undefined:selected;
  useEffect(() => {
    let current = true;
    listForms(client).then(page => { if (current) { setForms(page.items); setError(null); } }).catch((cause: unknown) => { if (current) { const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setForms([]); setError(failure); if (failure.status === 401) onAuthenticationLost(); } });
    return () => { current = false; };
  }, [client]);
  function graph(next: MethodologyGraph) { if (!disabled) onChange({ ...value, graph: next, reviewRefs: [] }); }
  function patchNode(patch: Partial<MethodologyNode>) { if (node&&!latest.current.disabled&&latest.current.value===value&&value.graph.nodes.filter(item=>item.nodeId===node.nodeId).length===1) graph({ ...value.graph, nodes: value.graph.nodes.map(item => item.nodeId === node.nodeId ? applyNodeDefinitionPatch(item, patch) : item) }); }
  function move(nodeId: string, dx: number, dy: number) { if(latest.current.disabled||latest.current.value!==value||value.graph.nodes.filter(item=>item.nodeId===nodeId).length!==1)return;graph({ ...value.graph, nodes: value.graph.nodes.map(item => item.nodeId === nodeId ? { ...item, position: { x: item.position.x + dx, y: item.position.y + dy } } : item) }); }
  function removeNode(current:MethodologyGraph,nodeId:string){
    if(disabled||latest.current.disabled||latest.current.value!==value||value.graph!==current||node?.nodeId!==nodeId||current.nodes.filter(item=>item.nodeId===nodeId).length!==1)return;
    graph({...current,nodes:current.nodes.filter(item=>item.nodeId!==nodeId),edges:current.edges.filter(edge=>edge.fromNodeId!==nodeId&&edge.toNodeId!==nodeId),entryNodeId:current.entryNodeId===nodeId?'':current.entryNodeId,terminalNodeIds:current.terminalNodeIds.filter(id=>id!==nodeId)});setSelectedId('');
  }
  function removeDuplicateNode(current:MethodologyGraph,index:number){
    const target=current.nodes[index];
    if(disabled||latest.current.disabled||latest.current.value!==value||value.graph!==current||!Number.isInteger(index)||!target||current.nodes.filter(item=>item.nodeId===target.nodeId).length<2)return;
    graph({...current,nodes:current.nodes.filter((_,position)=>position!==index)});
  }
  function add() {
    const nodeId = 'N-' + crypto.randomUUID().slice(0, 8);
    const next: MethodologyNode = { nodeId, name: '새 단계', purpose: '', kind: 'HUMAN', role: 'USER', mode: 'CASE_BY_CASE', position: { x: value.graph.nodes.length * 240, y: 0 },
      inputs: [], outputs: [], taskScope: { included: [], excluded: [] }, completionCriteria: [], approvalBoundary: [], limitPolicyRef: null, recordRequirements: [] };
    graph({ ...value.graph, nodes: [...value.graph.nodes, next], entryNodeId: value.graph.entryNodeId || nodeId, terminalNodeIds: value.graph.terminalNodeIds.length ? value.graph.terminalNodeIds : [nodeId] }); setSelectedId(nodeId);
  }
  return <section className="status-card definition-editor" aria-label="프로젝트 전용 방법론 편집">
    <h3>이 프로젝트의 개발 절차</h3><p>프로젝트 전용 초안 · 검토·확정 전</p><p className="meta">공통 원본·저장된 과거 버전은 바꾸지 않습니다. 중간 저장 전 입력이며 실제 Agent·권한·환경·한도 정책은 연결하지 않습니다.</p>
    <fieldset disabled={disabled}>
      <label htmlFor={id + '-name'}>전용 방법론 이름</label><input id={id + '-name'} maxLength={200} value={value.name} onChange={event => onChange({ ...value, name: event.target.value, reviewRefs: [] })} />
      <label htmlFor={id + '-purpose'}>전용 방법론 목적</label><textarea id={id + '-purpose'} maxLength={20000} value={value.purpose} onChange={event => onChange({ ...value, purpose: event.target.value, reviewRefs: [] })} />
      <MethodGraphCanvas graph={value.graph} selectedId={selected?.nodeId ?? ''} onSelect={setSelectedId} onMove={disabled ? undefined : move} label="프로젝트 전용 방법론 공간형 흐름도" />
      <div className="methodology-flow">{value.graph.nodes.map((item,index) => <button type="button" key={index} aria-pressed={item.nodeId === selected?.nodeId} onClick={() => setSelectedId(item.nodeId)}>{item.name || item.nodeId} 편집</button>)}</div>
      <button type="button" onClick={add}>단계 추가</button>
      <DuplicateNodeRepair graph={value.graph} locked={disabled} onRemove={removeDuplicateNode}/>
      {node ? <div>
        <label htmlFor={id + '-node-name'}>단계 이름 편집</label><input id={id + '-node-name'} value={node.name} onChange={event => patchNode({ name: event.target.value })} />
        <label htmlFor={id + '-node-purpose'}>단계 목적 편집</label><textarea id={id + '-node-purpose'} value={node.purpose} onChange={event => patchNode({ purpose: event.target.value })} />
        <label htmlFor={id + '-x'}>단계 X 위치</label><input id={id + '-x'} type="number" value={node.position.x} onChange={event => { if (event.target.value !== '' && Number.isFinite(event.target.valueAsNumber)) patchNode({ position: { ...node.position, x: event.target.valueAsNumber } }); }} />
        <label htmlFor={id + '-y'}>단계 Y 위치</label><input id={id + '-y'} type="number" value={node.position.y} onChange={event => { if (event.target.value !== '' && Number.isFinite(event.target.valueAsNumber)) patchNode({ position: { ...node.position, y: event.target.valueAsNumber } }); }} />
        <label htmlFor={id + '-criteria'}>완료·검수 조건 편집</label><textarea id={id + '-criteria'} value={node.completionCriteria.join('\n')} onChange={event => patchNode({ completionCriteria: event.target.value.split('\n') })} />
        <label htmlFor={id + '-records'}>작업 기록 요구 편집</label><textarea id={id + '-records'} value={node.recordRequirements.join('\n')} onChange={event => patchNode({ recordRequirements: event.target.value.split('\n') })} />
        <NodeDefinitionFields node={node} nodes={value.graph.nodes} onChange={patchNode} />
        {error ? <p role="alert">{error.message} 기존 문서 참조는 유지하고 새 양식 선택만 제한합니다.</p> : null}
        <NodeDocumentFields node={node} nodes={value.graph.nodes} forms={forms} onChange={patchNode} />
        <NodeDeletionPanel key={node.nodeId} graph={value.graph} nodeId={node.nodeId} locked={disabled} onRemove={removeNode}/>
      </div> : duplicateSelected?<p>선택한 단계 ID가 중복되어 상세 편집을 표시하지 않습니다. 중복 단계 정의를 확인해 복구하세요.</p>:<p>단계를 추가해 절차를 작성하세요. 비어 있는 초안은 확정·실행할 수 없습니다.</p>}
      <GraphRelationsEditor graph={value.graph} onChange={graph} />
    </fieldset>
    <details><summary>복사 출처의 고정 버전</summary>{value.sourceRefs.length ? <ul>{value.sourceRefs.map((ref, index) => <li key={index}>{ref.id} · v{ref.version} · {ref.contentHash}</li>)}</ul> : <p>직접 작성 · 복사 원본 없음</p>}</details>
    <p className="meta">입력은 위의 중간 저장으로 서버에 보존합니다. 저장은 별도 내용 검토·확정이나 프로젝트 생성이 아닙니다.</p>
  </section>;
}
