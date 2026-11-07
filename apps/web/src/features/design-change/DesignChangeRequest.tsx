import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { listDocumentMaterials, type MaterialPage, type ProposalSummary, type ImportSummary } from '../design-trace/materials-api.ts';
import {readChangeImportSource,attachChangeImportSource} from './change-import-source.ts';
import { readStoredProposal, type ProposalComparison } from '../design-trace/proposal-api.ts';
import { getPinnedForm } from '../methodologies/forms-api.ts';
import { documentControl, type DocumentSession } from '../design-trace/editor-api.ts';
import {listDocuments,type DocumentPage} from '../design-trace/api.ts';
import {readChangeRequestDocumentSource,attachChangeRequestDocumentSource,changeRequestSourceBindingMatches} from './change-request-document-source.ts';
import { newDesignChangeRequest, prepareDesignChangeRequest, sendDesignChangeRequest, type ChangeRequestBuffer } from './request-api.ts';
import type {ChangeEditorGate} from './DesignChangesPage.tsx';
import {listConversations,listConversationMessages,readConversationMessage,type ConversationView} from '../knowledge/conversation-api.ts';
import type {MessageRef} from '../../../../server/modules/knowledge/conversation-input.ts';
import {attachChangeRequestConversationSource} from './change-request-conversation-source.ts';

export function DesignChangeRequest({ client, projectId, session, buffer, onChange, onOpen, reading, blocked = false, gate, onAuthenticationLost }: { client: ApiClient; projectId: string; session: DocumentSession; buffer: ChangeRequestBuffer | null; onChange: Dispatch<SetStateAction<ChangeRequestBuffer | null>>; onOpen: (id: string) => void; reading: boolean; blocked?: boolean; gate:ChangeEditorGate; onAuthenticationLost: () => void }) {
  const [page, setPage] = useState<MaterialPage<ProposalSummary> | null>(null), [comparison, setComparison] = useState<ProposalComparison | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<ApiError | null>(null), [ack, setAck] = useState(false);
  const alive = useRef(true), flight = useRef(false);
  const [conversations,setConversations]=useState<Awaited<ReturnType<typeof listConversations>>|null>(null),[messages,setMessages]=useState<{cid:string;page:Awaited<ReturnType<typeof listConversationMessages>>}|null>(null),[conversationSource,setConversationSource]=useState<{client:ApiClient;buffer:ChangeRequestBuffer;view:ConversationView}|null>(null);
  const [sourcePage,setSourcePage]=useState<DocumentPage|null>(null),[source,setSource]=useState<{client:ApiClient;buffer:ChangeRequestBuffer;value:Awaited<ReturnType<typeof readChangeRequestDocumentSource>>}|null>(null);
  const [imports,setImports]=useState<MaterialPage<ImportSummary>|null>(null),[importSource,setImportSource]=useState<{client:ApiClient;buffer:ChangeRequestBuffer;value:Awaited<ReturnType<typeof readChangeImportSource>>}|null>(null);
  const latest=useRef({buffer,client,session,projectId});latest.current={buffer,client,session,projectId};
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { setAck(false);setSourcePage(null);setSource(null);setImports(null);setImportSource(null);setConversations(null);setMessages(null);setConversationSource(null); }, [buffer?.bindingId]);
  const bound = !buffer || buffer.projectId === projectId && buffer.ownerUserId === session.user.id && buffer.ownerClientId === session.clientId;
  async function perform(action: () => Promise<void>) { if(flight.current||!gate.acquire())return;flight.current=true;setBusy(true);setError(null);try{await action();}catch(cause){if(!alive.current)return;const failure=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(failure);if(failure.status===401)onAuthenticationLost();}finally{flight.current=false;gate.release();if(alive.current)setBusy(false);} }
  async function list(cursor: string | null) { setPage(null); const value = await listDocumentMaterials(client, projectId, 'proposals', cursor, 'PENDING'); if(alive.current)setPage(value); }
  const sourceLocked=blocked||busy||!buffer||!bound||!!buffer.pending||!!buffer.result||buffer.uncertain;
  function sourceActive(expected:ChangeRequestBuffer){const now=latest.current;return alive.current&&now.client===client&&now.projectId===expected.projectId&&changeRequestSourceBindingMatches(now.buffer,expected,now.session);}
  async function listConversationSources(cursor:string|null){if(sourceLocked||!buffer)return;const expected=structuredClone(buffer);setConversations(null);setMessages(null);setConversationSource(null);const value=await listConversations(client,projectId,cursor);if(sourceActive(expected))setConversations(value);}
  async function listSourceMessages(cid:string,cursor:string|null){if(sourceLocked||!buffer)return;const expected=structuredClone(buffer);setMessages(null);setConversationSource(null);const value=await listConversationMessages(client,projectId,cid,cursor);if(sourceActive(expected))setMessages({cid,page:value});}
  async function inspectConversation(cid:string,ref:MessageRef){if(sourceLocked||!buffer)return;const expected=structuredClone(buffer);setConversationSource(null);const value=await readConversationMessage(client,projectId,cid,structuredClone(ref));if(sourceActive(expected))setConversationSource({client,buffer:expected,view:value});}
  const currentConversation=conversationSource?.client===client&&changeRequestSourceBindingMatches(buffer,conversationSource.buffer,session)?conversationSource:null;
  function attachConversation(){if(sourceLocked||!currentConversation)return;const selected=currentConversation;onChange(current=>latest.current.client===selected.client?attachChangeRequestConversationSource(current,selected.buffer,latest.current.session,selected.view):current);setAck(false);}
  async function listSources(cursor:string|null){if(sourceLocked||!buffer)return;const expected=structuredClone(buffer);setSourcePage(null);setSource(null);const value=await listDocuments(client,projectId,cursor);if(sourceActive(expected))setSourcePage(value);}
  async function inspectSource(id:string,version:number){if(sourceLocked||!buffer)return;const expected=structuredClone(buffer);setSource(null);const value=await readChangeRequestDocumentSource(client,projectId,id,version,()=>sourceActive(expected));if(sourceActive(expected))setSource({client,buffer:expected,value});}
  const currentSource=source?.client===client&&changeRequestSourceBindingMatches(buffer,source.buffer,session)?source:null;
  function attachSource(){if(sourceLocked||!currentSource)return;const selected=currentSource,d=selected.value.document,ref={kind:'DOCUMENT_VERSION' as const,id:d.id,version:d.version,contentHash:d.contentHash};onChange(current=>latest.current.client===selected.client?attachChangeRequestDocumentSource(current,selected.buffer,latest.current.session,ref):current);setAck(false);}
  function importActive(expected:ChangeRequestBuffer){return alive.current&&latest.current.client===client&&latest.current.buffer?.bindingId===expected.bindingId&&!latest.current.buffer.pending&&!latest.current.buffer.result;}
  async function listImports(cursor:string|null){if(sourceLocked||!buffer)return;const expected=buffer;setImports(null);setImportSource(null);const value=await listDocumentMaterials(client,projectId,'imports',cursor,'READY');if(importActive(expected))setImports(value);}
  async function inspectImport(summary:ImportSummary){if(sourceLocked||!buffer)return;const expected=structuredClone(buffer);setImportSource(null);const value=await readChangeImportSource(client,projectId,summary,()=>importActive(expected));if(importActive(expected))setImportSource({client,buffer:expected,value});}
  const currentImport=importSource?.client===client&&importSource.buffer.bindingId===buffer?.bindingId?importSource:null;
  function attachImport(){if(sourceLocked||!currentImport)return;const selected=currentImport;onChange(current=>attachChangeImportSource(current,selected.buffer,session,selected.value.source));setAck(false);}
  async function select(id: string) {
    if(blocked||!bound||buffer?.pending||buffer?.dirty&&!confirm('미저장 변경 요청 입력을 버리고 다른 제안을 준비할까요?'))return;
    setComparison(null); const selected = await readStoredProposal(client, projectId, id), source = selected.base.document;
    const form = await getPinnedForm(client, source.formRef);
    if(form.definition.formCode!=='AF02'||!source.confirmed||!source.validation.validForConfirmation||source.contentReviews[0]?.ref.outcome!=='ACCEPTED'||selected.proposal.selections.length)throw new ApiError('DESIGN_CHANGE_BASE_NOT_READY',422);
    const generation = await documentControl(client, projectId, session); if(!alive.current)return;if(!gate.allowed())throw new ApiError('CHANGE_EDITOR_CONFLICT',409);
    const value = newDesignChangeRequest(projectId, session, generation, selected.proposal.baseRef, selected.proposal.id), oldBinding=buffer?.bindingId;
    onChange(current=>current?.bindingId===oldBinding?value:current);setComparison(selected);
  }
  async function save() {
    if(blocked||!buffer||!bound)return;const binding=buffer.bindingId,previouslyUncertain=!!buffer.pending&&buffer.uncertain;
    try {
      const generation=await documentControl(client,projectId,session);if(!alive.current)return;if(!gate.allowed())throw new ApiError('CHANGE_EDITOR_CONFLICT',409);if(generation!==buffer.controlGeneration)throw new ApiError('CONTROL_GENERATION_CONFLICT',409);
      const pending=prepareDesignChangeRequest(buffer,session,buffer.pending?true:ack), staged={...buffer,pending,uncertain:true,failure:null};
      onChange(current=>current?.bindingId===binding?staged:current);
      const result=await sendDesignChangeRequest(client,staged,session);if(!alive.current)return;
      onChange(current=>current?.bindingId===binding?{...current,pending:null,result,dirty:false,uncertain:false,failure:null}:current);
    } catch(cause) { if(!alive.current)return;const failure=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');onChange(current=>current?.bindingId===binding?{...current,failure:{code:failure.code,status:failure.status},uncertain:previouslyUncertain||!!current.pending&&(failure.status===0||failure.status>=500||failure.code==='RESPONSE_INVALID')}:current);throw failure; }
  }
  return <section aria-label="설계 변경 요청 등록"><h3>수정 제안으로 변경 요청 준비</h3><p className="meta">이미 저장한 미선택 수정 제안과 확정 설계만 사용합니다. 요청 등록은 제안 선택·설계 변경 적용·승인·작업 재개가 아닙니다. 현재 head/확정/정책은 서버가 다시 검사합니다.</p>
    {error?<p role="alert">{error.code} · 원입력·미확인 명령은 자동으로 다시 만들지 않습니다.</p>:null}
    <button disabled={busy||!!buffer?.pending} onClick={()=>void perform(()=>list(null))}>변경용 수정 제안 목록 조회</button>
    {page?<ul>{page.items.map(item=><li key={item.id}>{item.title} · 기준 v{item.baseRef.version}<button disabled={blocked||busy||!!buffer?.pending} onClick={()=>void perform(()=>select(item.id))}>변경 요청 준비: {item.title}</button></li>)}</ul>:null}
    {page?.hasMore?<button disabled={busy||!!buffer?.pending} onClick={()=>{const cursor=page.nextCursor;void perform(()=>list(cursor));}}>수정 제안 다음 목록</button>:null}
    {comparison?<details><summary>선택한 변경 전후 원문</summary><p>준비 당시 고정 버전 비교 · 현재 유효성은 등록 시 재검사</p><h4>변경 전</h4><pre aria-label="변경 전 설계 원문">{comparison.base.body}</pre><h4>변경 제안</h4><pre aria-label="변경 제안 원문">{comparison.proposedBody}</pre></details>:null}
    {buffer&&bound?<><p className="meta">준비한 설계 {buffer.beforeRef.id} · v{buffer.beforeRef.version} · {buffer.beforeRef.contentHash}<br/>수정 제안 {buffer.proposalId} · 제어 세대 {buffer.controlGeneration}</p>
      <section aria-label="변경 요청 문서 출처"><h4>변경 요청의 문서·가져온 원문 출처</h4><p className="meta">원문을 읽고 직접 연결합니다. 과거 지시의 현재 적용·내용 승인·Agent 전달은 아닙니다.</p>
       <button disabled={sourceLocked} onClick={()=>void perform(()=>listSources(null))}>변경 요청 출처 문서 목록</button>
       {sourcePage?<><ul>{sourcePage.items.map(d=><li key={d.id}><button disabled={sourceLocked} onClick={()=>void perform(()=>inspectSource(d.id,d.headVersion))}>변경 요청 출처 원문: {d.title} v{d.headVersion}</button></li>)}</ul>{sourcePage.hasMore?<button disabled={sourceLocked} onClick={()=>{const cursor=sourcePage.nextCursor;void perform(()=>listSources(cursor));}}>변경 요청 출처 다음 목록</button>:null}</>:null}
       {currentSource?<details open><summary>선택한 문서 · 자동 연결 아님</summary><p>{currentSource.value.document.id} · v{currentSource.value.document.version} · {currentSource.value.document.contentHash}</p><pre aria-label="선택한 변경 요청 출처 원문">{currentSource.value.body}</pre></details>:null}
       <button disabled={sourceLocked||!currentSource||buffer.sourceRefs.length>=200} onClick={attachSource}>이 문서를 변경 요청 출처로 연결</button>
       <button disabled={sourceLocked} onClick={()=>void perform(()=>listImports(null))}>변경 요청 가져온 원문 목록</button>
       {imports?<><ul>{imports.items.map(item=><li key={item.id}><button disabled={sourceLocked} onClick={()=>void perform(()=>inspectImport(item))}>변경 요청 가져온 원문: {item.id}</button></li>)}</ul>{imports.hasMore?<button disabled={sourceLocked} onClick={()=>{const cursor=imports.nextCursor;void perform(()=>listImports(cursor));}}>변경 요청 가져온 원문 다음 목록</button>:null}</>:null}
       {currentImport?<details open><summary>선택한 가져온 원문 · 자동 연결 아님</summary><p>{currentImport.value.source.id} · {currentImport.value.source.contentHash}</p><pre aria-label="선택한 변경 요청 가져온 원문">{currentImport.value.body}</pre></details>:null}
       <button disabled={sourceLocked||!currentImport||buffer.sourceRefs.length>=200} onClick={attachImport}>이 가져온 원문을 변경 요청 출처로 연결</button>
       <ul>{buffer.sourceRefs.map((r,n)=><li key={n}>{r.kind} · {r.id}{r.kind==='DOCUMENT_VERSION'?' · v'+r.version:''} · {r.contentHash}<button disabled={sourceLocked} onClick={()=>{const binding=buffer.bindingId;onChange(current=>current?.bindingId===binding?{...current,dirty:true,failure:null,sourceRefs:current.sourceRefs.filter((_,i)=>i!==n)}:current);setAck(false);}}>변경 요청 출처 {n+1} 제거</button></li>)}</ul>
      </section>
      <section aria-label="변경 요청 대화 출처 선택"><h4>변경 이유의 사용자 발언·지시 출처</h4><p>대화와 발언을 선택해 원문을 확인한 뒤 직접 붙입니다. 과거 지시의 현재 적용·자동 검색·Agent 전달은 하지 않습니다.</p>
       <button disabled={sourceLocked} onClick={()=>void perform(()=>listConversationSources(null))}>변경 근거 대화 목록</button>
       {conversations?<><ul>{conversations.items.map(c=><li key={c.id}>{c.id}<button disabled={sourceLocked} onClick={()=>void perform(()=>listSourceMessages(c.id,null))}>변경 근거 대화 {c.id} 발언 선택</button></li>)}</ul>{conversations.hasMore?<button disabled={sourceLocked} onClick={()=>void perform(()=>listConversationSources(conversations.nextCursor))}>변경 근거 대화 다음 목록</button>:null}</>:null}
       {messages?<><ul>{messages.page.items.map(m=><li key={m.sourceRef.id}>순번 {m.serverSequence} · {m.kind==='USER_INSTRUCTION'?'사용자 지시':'사용자 발언'}<button disabled={sourceLocked} onClick={()=>void perform(()=>inspectConversation(messages.cid,m.sourceRef))}>변경 근거 발언 {m.serverSequence} 원문 확인</button></li>)}</ul>{messages.page.hasMore?<button disabled={sourceLocked} onClick={()=>void perform(()=>listSourceMessages(messages.cid,messages.page.nextCursor))}>변경 근거 이전 발언</button>:null}</>:null}
       {currentConversation?<><pre aria-label="선택한 변경 근거 발언 원문">{currentConversation.view.body}</pre><p className="meta">{currentConversation.view.sourceRef.id} · {currentConversation.view.sourceRef.contentHash}</p></>:null}
       <button disabled={sourceLocked||!currentConversation||buffer.sourceRefs.length>=200} onClick={attachConversation}>이 발언을 변경 요청 출처로 연결</button>
      </section>
      <fieldset disabled={blocked||busy||!!buffer.pending||!!buffer.result}><legend>변경 요청 입력</legend><label>변경 요청 이유<textarea maxLength={20000} value={buffer.reason} onChange={event=>{const binding=buffer.bindingId,reason=event.target.value;onChange(current=>current?.bindingId===binding?{...current,reason,dirty:true,failure:null}:current);}}/></label><label><input type="checkbox" checked={ack} onChange={event=>setAck(event.target.checked)}/>변경 요청만 등록하며 승인·적용·재개하지 않음을 확인합니다</label></fieldset>
      {!buffer.result?<><button disabled={blocked||busy||!buffer.pending&&(!ack||!buffer.reason.trim())} onClick={()=>void perform(save)}>{buffer.pending?'같은 변경 요청 명령 결과 확인':'설계 변경 요청 등록'}</button>{buffer.pending&&buffer.failure&&!buffer.uncertain?<button disabled={busy} onClick={()=>{if(!confirm('미적용 거절을 확인했습니다. 원 입력을 수정할까요?'))return;const binding=buffer.bindingId;onChange(current=>current?.bindingId===binding?{...current,pending:null,failure:null}:current);}}>거절 확인 후 변경 요청 입력 수정</button>:null}</>:<><p role="status">변경 요청 등록 영수증 확인 · 기준 미적용</p><p>등록 요청 ID: {buffer.result.change.ref.id}</p><p className="meta">현재 최신 상태는 별도 재조회가 필요합니다.</p><button disabled={busy||reading} onClick={()=>onOpen(buffer.result!.change.ref.id)}>등록한 변경 요청 재조회</button></>}
      {!buffer.pending&&!buffer.result?<button disabled={blocked||busy} onClick={()=>{if(buffer.dirty&&!confirm('미전송 변경 요청 입력을 닫을까요?'))return;const binding=buffer.bindingId;onChange(current=>current?.bindingId===binding?null:current);setComparison(null);}}>미전송 변경 요청 입력 닫기</button>:null}
    </>:null}
  </section>;
}
