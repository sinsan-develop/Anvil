import { useEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { getForm, listForms, type FormsPage, type FormVersion } from './forms-api.ts';
import { CommonFormEditor } from './CommonFormEditor.tsx';
import type { FormBuffer } from './form-editor-state.ts';
import { FormReviewPanel } from './FormReviewPanel.tsx';
import { FormVersionComparison } from './FormVersionComparison.tsx';

export function FormsCatalog({ client, session, buffer, onChange, onAuthenticationLost }: { client: ApiClient; session: { user: { id: string }; clientId: string; csrfToken: string }; buffer: FormBuffer; onChange: Dispatch<SetStateAction<FormBuffer>>; onAuthenticationLost: () => void }) {
  const selectId = useId();
  const [page, setPage] = useState<FormsPage | null>(null), [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<FormVersion | null>(null);
  const [error, setError] = useState<ApiError | null>(null), [pending, setPending] = useState(true);
  const [listRetry, setListRetry] = useState(0), [detailRetry, setDetailRetry] = useState(0);
  const selected = page?.items.find(item => item.ref.id === selectedId);
  const alive=useRef(true);useEffect(()=>()=>{alive.current=false;},[]);
  const copyScope=useRef<{session:typeof session;userId:string;clientId:string;csrf:string;client:ApiClient;transport:typeof fetch;detail:FormVersion|null;binding:string;selectedId:string;pending:boolean;error:ApiError|null;listRetry:number;detailRetry:number}|null>(null);
  const binding=JSON.stringify([selected?.ref,detail?.ref]);
  const observed=copyScope.current;
  if(!observed||observed.session!==session||observed.userId!==session.user.id||observed.clientId!==session.clientId||observed.csrf!==session.csrfToken||observed.client!==client||observed.transport!==client.transport||observed.detail!==detail||observed.binding!==binding||observed.selectedId!==selectedId||observed.pending!==pending||observed.error!==error||observed.listRetry!==listRetry||observed.detailRetry!==detailRetry)copyScope.current={session,userId:session.user.id,clientId:session.clientId,csrf:session.csrfToken,client,transport:client.transport,detail,binding,selectedId,pending,error,listRetry,detailRetry};
  const context=copyScope.current!;
  const contextCurrent=()=>alive.current&&copyScope.current===context&&session.user.id===context.userId&&session.clientId===context.clientId&&session.csrfToken===context.csrf&&client.transport===context.transport&&JSON.stringify([selected?.ref,detail?.ref])===context.binding&&!context.pending&&!context.error;
  const [historicalCopy,setHistoricalCopy]=useState<{source:FormVersion;context:typeof context;comparisonCurrent:()=>boolean}|null>(null);
  const historicalCurrent=()=>!!historicalCopy&&historicalCopy.context===context&&contextCurrent()&&historicalCopy.comparisonCurrent();
  const copyLocked=!!buffer.pending||!!buffer.review?.pending;
  function selectHistorical(source:FormVersion,comparisonCurrent:()=>boolean){
    if(!contextCurrent()||!comparisonCurrent()||copyLocked||!detail||source.definition.scope!=='USER_COMMON'||source.ref.id!==detail.ref.id||source.ref.version>detail.ref.version)return;
    const snapshot=structuredClone(source);
    const freeze=(value:unknown)=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}};freeze(snapshot);
    setHistoricalCopy({source:snapshot,context,comparisonCurrent});
  }
  const failure = (cause: unknown) => {
    const reason = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID');
    if (reason.status === 401 || reason.status === 403) { setPage(null); setDetail(null); if (reason.status === 401) onAuthenticationLost(); }
    setError(reason);
  };
  useEffect(() => {
    let current = true;
    setPending(true); setError(null);
    listForms(client).then(value => { if (current) { setPage(value); setSelectedId(id => value.items.some(item => item.ref.id === id) ? id : value.items[0]?.ref.id ?? ''); } })
      .catch((cause: unknown) => { if (current) failure(cause); }).finally(() => { if (current) setPending(false); });
    return () => { current = false; };
  }, [client, listRetry]);
  useEffect(() => {
    if (!selected) return;
    let current = true;
    setPending(true); setError(null);
    getForm(client, selected).then(value => { if (current) setDetail(value); }).catch((cause: unknown) => { if (current) failure(cause); })
      .finally(() => { if (current) setPending(false); });
    return () => { current = false; };
  }, [client, selected?.ref.id, selected?.ref.version, selected?.ref.contentHash, detailRetry]);
  return <section className="status-card" aria-label="공식 양식 조회">
    <h2>공식 산출물 양식 · 작성 기준</h2>
    <div className="project-toolbar"><label htmlFor={selectId}>공식 산출물 양식</label><select id={selectId} value={selectedId} onChange={event => { setSelectedId(event.target.value); setDetail(null); setError(null); }}>
      {page?.items.map(item => <option value={item.ref.id} key={item.ref.id}>{item.formCode} {item.name}</option>)}
    </select><button disabled={pending} onClick={() => selected ? setDetailRetry(value => value + 1) : setListRetry(value => value + 1)}>양식 다시 조회</button></div>
    {pending ? <p role="status">양식을 조회하고 있습니다.</p> : null}
    {error ? <p role="alert">{error.message} · {error.code}{detail ? ' 앞선 본문은 오래된 자료입니다.' : ''}</p> : null}
    {page && !page.items.length ? <p>조회 가능한 양식이 없습니다.</p> : null}
    {detail ? <article aria-label="선택 양식 원본">
      <h3>{detail.definition.formCode} {detail.definition.name}</h3>
      <p className="meta">버전 {detail.ref.version} · {detail.ref.contentHash}</p><p>{detail.definition.purpose}</p>
      <ol className="form-items">{detail.definition.items.map(item => <li key={item.itemId}>
        <h4>{item.title}</h4><p className="meta">{item.itemId} · {item.required ? '필수' : '선택'}{item.repeated ? ' · 반복 행' : ''}</p>
        {item.authoringRules.map((text, index) => <p key={index}>{text}</p>)}
        {item.fields.length ? <ul>{item.fields.map(field => <li key={field.fieldId}><span>{field.title}</span> · <span className="meta">{field.fieldId} · {field.required ? '필수' : '선택'} · {field.valueType}</span></li>)}</ul> : null}
        <details><summary>내용 검수 기준</summary><ul>{item.reviewCriteria.map((text, index) => <li key={index}>{text}</li>)}</ul></details>
      </li>)}</ol>
      <details><summary>작성 역할·입력 자료</summary><p>작성 {detail.definition.authorRole} / 검토 {detail.definition.reviewerRole} / 확정 {detail.definition.confirmerRole}</p><ul>{detail.definition.requiredInputs.map((text, index) => <li key={index}>{text}</li>)}</ul></details>
      <details><summary>문서 작성 공통 기준 원문</summary><p className="meta">버전 {detail.authoringStandard.ref.version} · {detail.authoringStandard.ref.contentHash}</p><pre className="document-plain" role="region" aria-label="작성 기준 원문">{detail.authoringStandard.content}</pre></details>
      {detail.definition.scope === 'SYSTEM' ? <p>문서 내용 검수·사용자 확정은 아직 수행하지 않았습니다.</p> : null}
    </article> : null}
    {detail && !pending && !error && selected?.ref.id === detail.ref.id && selected.ref.version === detail.ref.version && selected.ref.contentHash === detail.ref.contentHash ? <FormVersionComparison key={[session.user.id,session.clientId,detail.ref.id,detail.ref.version,detail.ref.contentHash].join(':')} client={client} base={detail} onAccessLost={failure} copyAccess={{context,current:contextCurrent,disabled:copyLocked,onSelect:selectHistorical,onInvalidate:()=>setHistoricalCopy(null)}} /> : null}
    <CommonFormEditor copySelection={historicalCopy&&historicalCurrent()?{source:historicalCopy.source,current:historicalCurrent,clear:()=>setHistoricalCopy(null)}:undefined} client={client} session={session} source={!pending && !error ? detail : null} buffer={buffer} onChange={onChange} onAuthenticationLost={onAuthenticationLost} onSaved={() => setListRetry(value => value + 1)} />
    {detail && !pending && !error ? <FormReviewPanel client={client} session={session} source={detail} buffer={buffer} onChange={onChange} onVerified={setDetail} onAuthenticationLost={onAuthenticationLost} /> : null}
    <p className="meta">양식 복사·항목 개정·초안 저장은 문서 작성·내용 검토·확정이나 Agent 실행이 아닙니다. 방법론 단계 연결과 산출물 편집·확정은 아직 연결 전입니다.</p>
  </section>;
}
