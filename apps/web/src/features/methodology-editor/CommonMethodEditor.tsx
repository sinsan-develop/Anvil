import { useEffect, useId, useState, useRef, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { getMethod, type MethodVersion } from './api.ts';
import { emptyMethodBuffer, methodBuffer, writeCommonMethod, type MethodBuffer, type MethodCommand, type MethodGateway } from './common-api.ts';
import type { MethodologyGraph, MethodologyNode } from '../../../../../contracts/methodologies.ts';
import { MethodGraphCanvas } from './MethodGraphCanvas.tsx';
import { NodeDefinitionFields } from './NodeDefinitionFields.tsx';
import { GraphRelationsEditor } from './GraphRelationsEditor.tsx';
import { NodeDocumentFields } from './NodeDocumentFields.tsx';
import { NodeDeletionPanel } from './NodeDeletionPanel.tsx';
import { methodIssueNodeTargets } from './method-issue-targets.ts';
import {NodeBudgetSelection} from './NodeBudgetSelection.tsx';
import { listForms, type FormSummary } from '../methodologies/forms-api.ts';
import {readMethodDraftFile,importMethodDraft} from './method-draft-import.ts';

export function CommonMethodEditor({ client, session, source, buffer, onChange, onAuthenticationLost, onSaved, gateway, projectId }: {
  client: ApiClient; session: { user: { id: string }; clientId: string; csrfToken: string }; source: MethodVersion | null;
  buffer: MethodBuffer; onChange: Dispatch<SetStateAction<MethodBuffer>>; onAuthenticationLost: () => void; onSaved: () => void; gateway?: MethodGateway;projectId?:string;
}) {
  const fieldId = useId();
  const latestBuffer=useRef(buffer);latestBuffer.current=buffer;
  const [importing,setImporting]=useState(false),[importError,setImportError]=useState<string|null>(null);
  const importingNow=useRef(false);
  const active=useRef(true),preparing=useRef<string|null>(null),latestChange=useRef(onChange);latestChange.current=onChange;
  useEffect(()=>()=>{active.current=false;const id=preparing.current;if(id)latestChange.current(previous=>previous.preparationId===id?{...previous,preparationId:null}:previous);},[]);
  const [copyName, setCopyName] = useState(''), [pending, setPending] = useState(false), [error, setError] = useState<ApiError | null>(null), [savedVersion, setSavedVersion] = useState<number | null>(null);
  const node = buffer.graph.nodes.find(item => item.nodeId === buffer.nodeId), editing = !!buffer.targetId || buffer.dirty;
  const [forms, setForms] = useState<FormSummary[]>([]), [formError, setFormError] = useState<ApiError | null>(null);
  useEffect(() => {
    if (!editing) return;
    let current = true;
    listForms(client).then(value => { if (current) { setForms(value.items); setFormError(null); } }).catch((cause: unknown) => { if (current) { const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setForms([]); setFormError(failure); if (failure.status === 401) onAuthenticationLost(); } });
    return () => { current = false; };
  }, [client, session.user.id, editing]);
  const locked = importing || pending || !!buffer.preparationId || !!buffer.pending || !!buffer.review?.pending || !!buffer.application?.pending || !!buffer.application?.preparationId;
  async function importFile(file:File){
    if(locked||importingNow.current||buffer.review||buffer.application)return;
    const captured=buffer;importingNow.current=true;setImporting(true);setImportError(null);
    try{
      if(file.size>2097152)throw new ApiError('METHOD_DRAFT_FILE_INVALID');
      const raw=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
      const draft=readMethodDraftFile(raw,gateway?'PROJECT':'USER_COMMON');
      if(!active.current||latestBuffer.current!==captured)return;
      if(captured.dirty&&!confirm('미저장 방법론 입력을 가져온 새 초안으로 바꿀까요? 서버 원본은 보존합니다.'))return;
      const next=importMethodDraft(captured,session.user.id,draft);
      onChange(previous=>previous===captured?next:previous);setSavedVersion(null);setError(null);
    }catch(cause){if(active.current&&latestBuffer.current===captured)setImportError(cause instanceof ApiError?cause.code:'METHOD_DRAFT_FILE_INVALID');}
    finally{importingNow.current=false;if(active.current)setImporting(false);}
  }
  function replaceAllowed() { return !locked && (!(buffer.dirty || buffer.review?.dirty || buffer.application?.reason) || confirm('저장하지 않은 편집·내용 검토·적용 입력을 바꿀까요?')); }
  function change(field: 'name' | 'purpose' | 'reason', value: string) { onChange(previous => ({ ...previous, [field]: value, dirty: true, validation: null })); setSavedVersion(null); }
  function patchNode(patch: Partial<MethodologyNode>) { onChange(previous => ({ ...previous, dirty: true, validation: null, graph: { ...previous.graph, nodes: previous.graph.nodes.map(item => item.nodeId === previous.nodeId ? { ...item, ...patch } : item) } })); setSavedVersion(null); }
  function changeGraph(graph: MethodologyGraph) { onChange(previous => ({ ...previous, graph, dirty: true, validation: null })); setSavedVersion(null); }
  function removeNode(graph: MethodologyGraph, nodeId: string) {
    if (locked) return;
    onChange(previous => previous.graph !== graph || previous.nodeId !== nodeId || previous.pending || previous.review?.pending ? previous : ({ ...previous, dirty: true, validation: null, nodeId: '', graph: { ...graph, nodes: graph.nodes.filter(item => item.nodeId !== nodeId), edges: graph.edges.filter(edge => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId), entryNodeId: graph.entryNodeId === nodeId ? '' : graph.entryNodeId, terminalNodeIds: graph.terminalNodeIds.filter(id => id !== nodeId) } }));
    setSavedVersion(null);
  }
  function moveNode(id: string, dx: number, dy: number) { onChange(previous => ({ ...previous, dirty: true, validation: null, graph: { ...previous.graph, nodes: previous.graph.nodes.map(item => item.nodeId === id ? { ...item, position: { x: item.position.x + dx, y: item.position.y + dy } } : item) } })); setSavedVersion(null); }
  async function submit(command: MethodCommand, name: string, purpose: string) {
    if (pending || command.clientId !== session.clientId) return;
    setPending(true); setError(null); setSavedVersion(null);
    const preparationId=crypto.randomUUID();preparing.current=preparationId;onChange(previous=>({...previous,preparationId}));
    let applied = false;
    try {
      command = gateway ? await gateway.prepare(command) : command;
      if(!active.current)return;
      onChange(previous => previous.preparationId===preparationId?({ ...previous,preparationId:null, ownerUserId: session.user.id, pending: { request: command, name, purpose } }):previous);
      const ref = gateway ? (await gateway.write(command)).data.ref : await writeCommonMethod(client, command, session.csrfToken, session.user.id);
      applied = true;
      const value = gateway ? await gateway.read(ref, name, purpose) : await getMethod(client, { ref, name, purpose, scope: 'USER_COMMON', systemCode: null, status: 'DRAFT', sourceAvailable: false });
      if(!active.current)return;
      onChange(previous => previous.pending?.request.commandId === command.commandId&&!previous.preparationId&&!previous.application?.pending&&!previous.application?.preparationId ? {...methodBuffer(value, session.user.id),application:previous.application} : previous);
      setSavedVersion(ref.version); onSaved();
    } catch (cause: unknown) {
      if(!active.current)return;
      const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(failure);
      if (!applied && !(gateway && buffer.pending) && failure.status >= 400 && failure.status < 500 && failure.code !== 'RESPONSE_INVALID') onChange(previous => ({ ...previous, pending: null }));
      if (failure.status === 401) onAuthenticationLost();
    } finally { onChange(previous=>previous.preparationId===preparationId?{...previous,preparationId:null}:previous);preparing.current=null;if(active.current)setPending(false); }
  }
  function copy() {
    if (!source || locked || !copyName.trim() || !replaceAllowed()) return;
    void submit({ schemaVersion: 1, commandId: crypto.randomUUID(), operation: 'copyMethodology', targetId: null, expectedVersion: 0, clientId: session.clientId,
      payload: { sourceRef: source.ref, name: copyName, scope: gateway ? 'PROJECT' : 'USER_COMMON', reason: gateway ? '선택한 원본을 프로젝트 전용으로 복사' : '선택한 원본을 내 공통본으로 복사' } }, copyName, source.purpose);
  }
  function save() {
    if (locked || !buffer.name.trim() || !buffer.purpose.trim() || !buffer.reason.trim()) return;
    void submit({ schemaVersion: 1, commandId: crypto.randomUUID(), operation: 'saveMethodologyDraft', targetId: buffer.targetId, expectedVersion: buffer.version, clientId: session.clientId,
      payload: { name: buffer.name, purpose: buffer.purpose, scope: gateway ? 'PROJECT' : 'USER_COMMON', graph: buffer.graph, reason: buffer.reason } }, buffer.name, buffer.purpose);
  }
  function addNode() {
    const id = 'N-' + crypto.randomUUID().slice(0, 8);
    const next: MethodologyNode = { nodeId: id, name: '새 단계', purpose: '', kind: 'AGENT', role: 'STAGE_OWNER', position: { x: buffer.graph.nodes.length * 240, y: 0 }, inputs: [], outputs: [],
      taskScope: { included: [], excluded: [] }, completionCriteria: [], approvalBoundary: [], mode: 'CASE_BY_CASE', limitPolicyRef: null, recordRequirements: [], requirements: { capabilities: [], environment: [] } };
    onChange(previous => ({ ...previous, dirty: true, validation: null, nodeId: id, graph: { ...previous.graph, nodes: [...previous.graph.nodes, next], entryNodeId: previous.graph.entryNodeId || id, terminalNodeIds: previous.graph.terminalNodeIds.length ? previous.graph.terminalNodeIds : [id] } })); setSavedVersion(null);
  }
  if (buffer.ownerUserId && buffer.ownerUserId !== session.user.id) return <section className="status-card"><p role="alert">이 탭의 편집 자료는 다른 로그인 사용자의 자료입니다. 내용을 표시하거나 전송하지 않습니다.</p><button onClick={() => { if (confirm('이 탭에 남은 다른 사용자의 편집 자료만 버릴까요? 서버 자료는 유지합니다.')) onChange(emptyMethodBuffer()); }}>탭의 이전 사용자 편집 닫기</button></section>;
  return <section className="status-card definition-editor" aria-label={gateway ? '프로젝트 방법론 작업' : '공통 방법론 작업'}>
    <h3>{gateway ? '전용 방법론 작성·개정' : '내 방법론 작성·개정'}</h3><p className="meta">내장 원본은 보존합니다. 저장은 초안이며 사용자 확정·프로젝트 적용·Agent 실행이 아닙니다.</p>
    <label>방법론 초안 JSON 가져오기<input type="file" accept=".json,application/json" disabled={locked||!!buffer.review||!!buffer.application} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void importFile(file);}}/></label>
    <details><summary>방법론 가져오기 형식</summary><p>기존 초안 저장의 name·purpose·scope·graph·reason JSON만 읽습니다. UTF-8 최대 2MiB, scope는 현재 작성 공간과 같아야 합니다. 가져온 참조는 미검증이며 명령·확정·적용 권한을 가져오지 않습니다. 편집 후 별도로 저장하세요.</p><pre>{JSON.stringify({name:'새 방법론',purpose:'개발 절차 정의',scope:gateway?'PROJECT':'USER_COMMON',graph:{nodes:[],edges:[],entryNodeId:'',terminalNodeIds:[]},reason:'기존 절차 가져오기'},null,2)}</pre></details>
    {importing?<p role="status">방법론 파일 대조 중</p>:null}{importError?<p role="alert">{importError} · 기존 입력과 명령은 보존했습니다.</p>:null}
    <fieldset disabled={locked}><label>복사본 이름<input value={copyName} onChange={event => setCopyName(event.target.value)} maxLength={200} /></label>
      <button disabled={!source || !copyName.trim()} onClick={copy}>{gateway ? '프로젝트 전용으로 복사' : '내 공통본으로 복사'}</button>
      <button onClick={() => { if (replaceAllowed()) { onChange({ ...emptyMethodBuffer(), ownerUserId: session.user.id, dirty: true }); setError(null); setSavedVersion(null); } }}>새 방법론 작성</button>
      {source?.scope === (gateway ? 'PROJECT' : 'USER_COMMON') ? <button onClick={() => { if (replaceAllowed()) { onChange(methodBuffer(source, session.user.id)); setError(null); setSavedVersion(null); } }}>{gateway ? '이 전용본 편집' : '이 공통본 편집'}</button> : null}
    </fieldset>
    {editing ? <section aria-label={gateway ? '프로젝트 방법론 편집' : '공통 방법론 편집'}><p className="meta">{buffer.targetId ? `저장 기준 버전 ${buffer.version}` : gateway ? '새 전용본 · 아직 저장 전' : '새 공통본 · 아직 저장 전'}{buffer.dirty ? ' · 미저장 변경 있음' : ''}</p>
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
          {gateway&&projectId?<NodeBudgetSelection key={[projectId,session.user.id,session.clientId,buffer.targetId,buffer.version,node.nodeId].join(':')} client={client} projectId={projectId} owner={session.user.id} buffer={buffer} onChange={change=>{onChange(change);setSavedVersion(null);}} locked={locked} onAuthenticationLost={onAuthenticationLost}/>:null}
          {formError ? <p role="alert">{formError.message} 기존 문서 참조는 유지했습니다. 새 양식 선택만 제한됩니다.</p> : null}
          <NodeDocumentFields node={node} nodes={buffer.graph.nodes} forms={forms} onChange={patchNode} formAccess={!locked?{client,onAuthenticationLost,contextKey:JSON.stringify([session.user.id,session.clientId,projectId??null,buffer.targetId,buffer.version])}:undefined}/>
          <NodeDeletionPanel graph={buffer.graph} nodeId={node.nodeId} locked={locked} onRemove={removeNode} />
        </div> : <p>단계를 추가해 절차를 작성하세요. 빈 초안도 저장할 수 있지만 확정할 수 없습니다.</p>}
        <GraphRelationsEditor graph={buffer.graph} onChange={changeGraph} />
        <label htmlFor={fieldId + '-reason'}>개정 이유</label><textarea id={fieldId + '-reason'} value={buffer.reason} onChange={event => change('reason', event.target.value)} maxLength={20000} />
        <button disabled={!buffer.dirty || !buffer.name.trim() || !buffer.purpose.trim() || !buffer.reason.trim()} onClick={save}>{gateway ? '전용본 새 버전 저장' : '공통본 새 버전 저장'}</button>
      </fieldset>
      {buffer.validation ? <div aria-label="저장한 그래프 구조 검사"><p>{buffer.validation.validForConfirmation ? '저장본 구조 오류 없음 · 내용 검토/양식 확정/실행 연결은 별도' : '저장본 구조 보완 필요'}</p><ul>{buffer.validation.issues.map((issue, index) => { const targets = methodIssueNodeTargets(buffer.graph, issue.location); return <li key={index}>{issue.severity} · {issue.code} · {issue.location}: {issue.message}{targets.length ? targets.map(target => <button key={target.nodeId} disabled={locked} onClick={() => onChange(previous => previous.graph !== buffer.graph || previous.validation !== buffer.validation || previous.pending || previous.review?.pending ? previous : ({ ...previous, nodeId: target.nodeId }))}>문제 단계 선택 {target.nodeId}: {target.name}</button>) : <span> 연결할 단계 미확인 · 원 오류는 유지합니다.</span>}</li>; })}</ul></div> : <p className="meta">현재 입력은 검사 전입니다. 초안 저장 후 서버의 구조 검사 결과와 오류 위치를 확인하세요.</p>}
    </section> : null}
    {pending ? <p role="status">서버 저장·재조회를 확인하고 있습니다.</p> : null}
    {buffer.pending && !pending ? <><p role="alert">저장 결과가 아직 확인되지 않았습니다. 새 명령을 만들지 않고 같은 명령으로 결과를 확인하세요.</p><button disabled={buffer.pending.request.clientId !== session.clientId} onClick={() => { const work = buffer.pending!; void submit(work.request, work.name, work.purpose); }}>같은 명령 결과 다시 확인</button></> : null}
    {error ? <p role="alert">{error.message} 입력은 보존했습니다.</p> : null}
    {savedVersion ? <p role="status">서버 저장·재조회 확인 · 버전 {savedVersion}</p> : null}
  </section>;
}
