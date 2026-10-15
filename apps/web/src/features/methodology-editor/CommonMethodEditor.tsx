import { useEffect, useId, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { getMethod, type MethodVersion } from './api.ts';
import { emptyMethodBuffer, methodBuffer, writeCommonMethod, type MethodBuffer, type MethodCommand } from './common-api.ts';
import type { MethodologyGraph, MethodologyNode } from '../../../../../contracts/methodologies.ts';
import { MethodGraphCanvas } from './MethodGraphCanvas.tsx';
import { NodeDefinitionFields } from './NodeDefinitionFields.tsx';
import { GraphRelationsEditor } from './GraphRelationsEditor.tsx';
import { NodeDocumentFields } from './NodeDocumentFields.tsx';
import { listForms, type FormSummary } from '../methodologies/forms-api.ts';

export function CommonMethodEditor({ client, session, source, buffer, onChange, onAuthenticationLost, onSaved }: {
  client: ApiClient; session: { user: { id: string }; clientId: string; csrfToken: string }; source: MethodVersion | null;
  buffer: MethodBuffer; onChange: Dispatch<SetStateAction<MethodBuffer>>; onAuthenticationLost: () => void; onSaved: () => void;
}) {
  const fieldId = useId();
  const [copyName, setCopyName] = useState(''), [pending, setPending] = useState(false), [error, setError] = useState<ApiError | null>(null), [savedVersion, setSavedVersion] = useState<number | null>(null);
  const node = buffer.graph.nodes.find(item => item.nodeId === buffer.nodeId), editing = !!buffer.targetId || buffer.dirty;
  const [forms, setForms] = useState<FormSummary[]>([]), [formError, setFormError] = useState<ApiError | null>(null);
  useEffect(() => {
    if (!editing) return;
    let current = true;
    listForms(client).then(value => { if (current) { setForms(value.items); setFormError(null); } }).catch((cause: unknown) => { if (current) { const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setForms([]); setFormError(failure); if (failure.status === 401) onAuthenticationLost(); } });
    return () => { current = false; };
  }, [client, session.user.id, editing]);
  const locked = pending || !!buffer.pending || !!buffer.review?.pending;
  function replaceAllowed() { return !buffer.pending && !buffer.review?.pending && (!(buffer.dirty || buffer.review?.dirty) || confirm('저장하지 않은 편집·내용 검토 입력을 바꿀까요?')); }
  function change(field: 'name' | 'purpose' | 'reason', value: string) { onChange(previous => ({ ...previous, [field]: value, dirty: true, validation: null })); setSavedVersion(null); }
  function patchNode(patch: Partial<MethodologyNode>) { onChange(previous => ({ ...previous, dirty: true, validation: null, graph: { ...previous.graph, nodes: previous.graph.nodes.map(item => item.nodeId === previous.nodeId ? { ...item, ...patch } : item) } })); setSavedVersion(null); }
  function changeGraph(graph: MethodologyGraph) { onChange(previous => ({ ...previous, graph, dirty: true, validation: null })); setSavedVersion(null); }
  function moveNode(id: string, dx: number, dy: number) { onChange(previous => ({ ...previous, dirty: true, validation: null, graph: { ...previous.graph, nodes: previous.graph.nodes.map(item => item.nodeId === id ? { ...item, position: { x: item.position.x + dx, y: item.position.y + dy } } : item) } })); setSavedVersion(null); }
  async function submit(command: MethodCommand, name: string, purpose: string) {
    if (pending || command.clientId !== session.clientId) return;
    const work = { request: command, name, purpose };
    onChange(previous => ({ ...previous, ownerUserId: session.user.id, pending: work })); setPending(true); setError(null); setSavedVersion(null);
    let applied = false;
    try {
      const ref = await writeCommonMethod(client, command, session.csrfToken, session.user.id);
      applied = true;
      const value = await getMethod(client, { ref, name, purpose, scope: 'USER_COMMON', systemCode: null, status: 'DRAFT', sourceAvailable: false });
      onChange(previous => previous.pending?.request.commandId === command.commandId ? methodBuffer(value, session.user.id) : previous);
      setSavedVersion(ref.version); onSaved();
    } catch (cause: unknown) {
      const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(failure);
      if (!applied && failure.status >= 400 && failure.status < 500 && failure.code !== 'RESPONSE_INVALID') onChange(previous => ({ ...previous, pending: null }));
      if (failure.status === 401) onAuthenticationLost();
    } finally { setPending(false); }
  }
  function copy() {
    if (!source || locked || !copyName.trim() || !replaceAllowed()) return;
    void submit({ schemaVersion: 1, commandId: crypto.randomUUID(), operation: 'copyMethodology', targetId: null, expectedVersion: 0, clientId: session.clientId,
      payload: { sourceRef: source.ref, name: copyName, scope: 'USER_COMMON', reason: '선택한 원본을 내 공통본으로 복사' } }, copyName, source.purpose);
  }
  function save() {
    if (locked || !buffer.name.trim() || !buffer.purpose.trim() || !buffer.reason.trim()) return;
    void submit({ schemaVersion: 1, commandId: crypto.randomUUID(), operation: 'saveMethodologyDraft', targetId: buffer.targetId, expectedVersion: buffer.version, clientId: session.clientId,
      payload: { name: buffer.name, purpose: buffer.purpose, scope: 'USER_COMMON', graph: buffer.graph, reason: buffer.reason } }, buffer.name, buffer.purpose);
  }
  function addNode() {
    const id = 'N-' + crypto.randomUUID().slice(0, 8);
    const next: MethodologyNode = { nodeId: id, name: '새 단계', purpose: '', kind: 'AGENT', role: 'STAGE_OWNER', position: { x: buffer.graph.nodes.length * 240, y: 0 }, inputs: [], outputs: [],
      taskScope: { included: [], excluded: [] }, completionCriteria: [], approvalBoundary: [], mode: 'CASE_BY_CASE', limitPolicyRef: null, recordRequirements: [], requirements: { capabilities: [], environment: [] } };
    onChange(previous => ({ ...previous, dirty: true, validation: null, nodeId: id, graph: { ...previous.graph, nodes: [...previous.graph.nodes, next], entryNodeId: previous.graph.entryNodeId || id, terminalNodeIds: previous.graph.terminalNodeIds.length ? previous.graph.terminalNodeIds : [id] } })); setSavedVersion(null);
  }
  if (buffer.ownerUserId && buffer.ownerUserId !== session.user.id) return <section className="status-card"><p role="alert">이 탭의 편집 자료는 다른 로그인 사용자의 자료입니다. 내용을 표시하거나 전송하지 않습니다.</p><button onClick={() => { if (confirm('이 탭에 남은 다른 사용자의 편집 자료만 버릴까요? 서버 자료는 유지합니다.')) onChange(emptyMethodBuffer()); }}>탭의 이전 사용자 편집 닫기</button></section>;
  return <section className="status-card definition-editor" aria-label="공통 방법론 작업">
    <h3>내 방법론 작성·개정</h3><p className="meta">내장 원본은 보존합니다. 저장은 초안이며 사용자 확정·프로젝트 적용·Agent 실행이 아닙니다.</p>
    <fieldset disabled={locked}><label>복사본 이름<input value={copyName} onChange={event => setCopyName(event.target.value)} maxLength={200} /></label>
      <button disabled={!source || !copyName.trim()} onClick={copy}>내 공통본으로 복사</button>
      <button onClick={() => { if (replaceAllowed()) { onChange({ ...emptyMethodBuffer(), ownerUserId: session.user.id, dirty: true }); setError(null); setSavedVersion(null); } }}>새 방법론 작성</button>
      {source?.scope === 'USER_COMMON' ? <button onClick={() => { if (replaceAllowed()) { onChange(methodBuffer(source, session.user.id)); setError(null); setSavedVersion(null); } }}>이 공통본 편집</button> : null}
    </fieldset>
    {editing ? <section aria-label="공통 방법론 편집"><p className="meta">{buffer.targetId ? `저장 기준 버전 ${buffer.version}` : '새 공통본 · 아직 저장 전'}{buffer.dirty ? ' · 미저장 변경 있음' : ''}</p>
      <fieldset disabled={locked}><label>방법론 이름<input value={buffer.name} onChange={event => change('name', event.target.value)} maxLength={200} /></label>
        <label htmlFor={fieldId + '-purpose'}>방법론 목적</label><textarea id={fieldId + '-purpose'} value={buffer.purpose} onChange={event => change('purpose', event.target.value)} maxLength={20000} />
        <MethodGraphCanvas graph={buffer.graph} selectedId={buffer.nodeId} onSelect={nodeId => onChange(previous => ({ ...previous, nodeId }))} onMove={locked ? undefined : moveNode} />
        <div className="methodology-flow">{buffer.graph.nodes.map(item => <button key={item.nodeId} aria-pressed={buffer.nodeId === item.nodeId} onClick={() => onChange(previous => ({ ...previous, nodeId: item.nodeId }))}>{item.name} 편집</button>)}</div>
        <button onClick={addNode}>단계 추가</button>
        {node ? <div><label>단계 이름 편집<input value={node.name} onChange={event => patchNode({ name: event.target.value })} /></label><label htmlFor={fieldId + '-node-purpose'}>단계 목적 편집</label><textarea id={fieldId + '-node-purpose'} value={node.purpose} onChange={event => patchNode({ purpose: event.target.value })} />
          <label>단계 X 위치<input type="number" value={node.position.x} onChange={event => { if (event.target.value !== '' && Number.isFinite(event.target.valueAsNumber)) patchNode({ position: { ...node.position, x: event.target.valueAsNumber } }); }} /></label>
          <label>단계 Y 위치<input type="number" value={node.position.y} onChange={event => { if (event.target.value !== '' && Number.isFinite(event.target.valueAsNumber)) patchNode({ position: { ...node.position, y: event.target.valueAsNumber } }); }} /></label>
          <label htmlFor={fieldId + '-criteria'}>완료·검수 조건 편집</label><textarea id={fieldId + '-criteria'} value={node.completionCriteria.join('\n')} onChange={event => patchNode({ completionCriteria: event.target.value.split('\n') })} />
          <label htmlFor={fieldId + '-records'}>작업 기록 요구 편집</label><textarea id={fieldId + '-records'} value={node.recordRequirements.join('\n')} onChange={event => patchNode({ recordRequirements: event.target.value.split('\n') })} />
          <NodeDefinitionFields node={node} nodes={buffer.graph.nodes} onChange={patchNode} />
          {formError ? <p role="alert">{formError.message} 기존 문서 참조는 유지했습니다. 새 양식 선택만 제한됩니다.</p> : null}
          <NodeDocumentFields node={node} nodes={buffer.graph.nodes} forms={forms} onChange={patchNode} />
          <button onClick={() => { if (confirm('이 초안의 단계와 직접 연결을 뺄까요? 다른 단계의 문서 참조는 자동 변경하지 않고 저장 검사에서 확인합니다.')) changeGraph({ ...buffer.graph, nodes: buffer.graph.nodes.filter(item => item.nodeId !== node.nodeId), edges: buffer.graph.edges.filter(edge => edge.fromNodeId !== node.nodeId && edge.toNodeId !== node.nodeId), entryNodeId: buffer.graph.entryNodeId === node.nodeId ? '' : buffer.graph.entryNodeId, terminalNodeIds: buffer.graph.terminalNodeIds.filter(id => id !== node.nodeId) }); }}>이 초안의 단계 제거</button>
        </div> : <p>단계를 추가해 절차를 작성하세요. 빈 초안도 저장할 수 있지만 확정할 수 없습니다.</p>}
        <GraphRelationsEditor graph={buffer.graph} onChange={changeGraph} />
        <label htmlFor={fieldId + '-reason'}>개정 이유</label><textarea id={fieldId + '-reason'} value={buffer.reason} onChange={event => change('reason', event.target.value)} maxLength={20000} />
        <button disabled={!buffer.dirty || !buffer.name.trim() || !buffer.purpose.trim() || !buffer.reason.trim()} onClick={save}>공통본 새 버전 저장</button>
      </fieldset>
      {buffer.validation ? <div aria-label="저장한 그래프 구조 검사"><p>{buffer.validation.validForConfirmation ? '저장본 구조 오류 없음 · 내용 검토/양식 확정/실행 연결은 별도' : '저장본 구조 보완 필요'}</p><ul>{buffer.validation.issues.map((issue, index) => { const target = buffer.graph.nodes.find(node => issue.location === `nodes.${node.nodeId}` || issue.location.startsWith(`nodes.${node.nodeId}.`)); return <li key={index}>{issue.location}: {issue.message}{target ? <button onClick={() => onChange(previous => ({ ...previous, nodeId: target.nodeId }))}>문제 단계 선택 {target.name}</button> : null}</li>; })}</ul></div> : <p className="meta">현재 입력은 검사 전입니다. 초안 저장 후 서버의 구조 검사 결과와 오류 위치를 확인하세요.</p>}
    </section> : null}
    {pending ? <p role="status">서버 저장·재조회를 확인하고 있습니다.</p> : null}
    {buffer.pending && !pending ? <><p role="alert">저장 결과가 아직 확인되지 않았습니다. 새 명령을 만들지 않고 같은 명령으로 결과를 확인하세요.</p><button disabled={buffer.pending.request.clientId !== session.clientId} onClick={() => { const work = buffer.pending!; void submit(work.request, work.name, work.purpose); }}>같은 명령 결과 다시 확인</button></> : null}
    {error ? <p role="alert">{error.message} 입력은 보존했습니다.</p> : null}
    {savedVersion ? <p role="status">서버 저장·재조회 확인 · 버전 {savedVersion}</p> : null}
  </section>;
}
