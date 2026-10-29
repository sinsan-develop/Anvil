import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,type DocumentSession} from '../design-trace/editor-api.ts';
import {listProjects,type ProjectSummary} from '../projects/api.ts';
import {readKnowledge,type KnowledgeView} from './api.ts';
import {newKnowledgeShareRequest,prepareKnowledgeShareRequest,sendKnowledgeShareRequest,readKnowledgeShareRequest,listKnowledgeShareRequests,type KnowledgeShareRequestBuffer,type KnowledgeShareChange,type ShareView,type ShareRef,type KnowledgeSharePage} from './knowledge-share-request-api.ts';
const fingerprint=(r:ShareRef|null|undefined)=>r?JSON.stringify([r.id,r.version,r.contentHash]):'';
function RequestOriginalPreview({client,projectId,refs,onAuthenticationLost}:{client:ApiClient;projectId:string;refs:ShareRef[];onAuthenticationLost:()=>void}){
 const [selected,setSelected]=useState<ShareRef|null>(null),[value,setValue]=useState<KnowledgeView|null>(null),[error,setError]=useState<ApiError|null>(null),[busy,setBusy]=useState(false);
 const alive=useRef(true),sequence=useRef(0);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sequence.current++;};},[]);
 async function inspect(ref:ShareRef){
  const id=++sequence.current;setSelected(ref);setValue(null);setError(null);setBusy(true);
  const current=()=>alive.current&&sequence.current===id;
  try{const result=await readKnowledge(client,projectId,ref);if(current())setValue(result);}
  catch(e){if(current()){const failure=e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');setError(failure);if(failure.status===401)onAuthenticationLost();}}
  finally{if(current())setBusy(false);}
 }
 function close(){sequence.current++;setSelected(null);setValue(null);setError(null);setBusy(false);}
 return <><ul>{refs.map(ref=><li key={fingerprint(ref)}>{ref.id} v{ref.version} / {ref.contentHash}<button type="button" onClick={()=>void inspect(ref)}>요청 원 지식 보기</button></li>)}</ul>
 {selected?<section aria-label="공유 요청 원 지식 미리보기"><p>현재 보관 요청에 기록된 원 지식의 읽기 전용 조회입니다.</p><button type="button" onClick={close}>원 지식 미리보기 닫기</button>{busy?<p role="status">원 지식을 확인하고 있습니다.</p>:null}{error?<p role="alert">원 지식을 확인하지 못했습니다. {error.code}</p>:null}{value?<><h4>{value.entry.title}</h4><p>{value.ref.id} v{value.ref.version} / {value.ref.contentHash}</p><p>조회 상태: {value.state} · 현재 최신 v{value.headVersion}</p><pre aria-label="요청 원 지식 본문">{value.body}</pre></>:null}</section>:null}</>;
}
export function KnowledgeShareRequestPanel({client,projectId,session,selected,buffer,onChange,onAuthenticationLost}:{client:ApiClient;projectId:string;session:DocumentSession;selected:KnowledgeView|null;buffer:KnowledgeShareRequestBuffer|null;onChange:(change:KnowledgeShareChange)=>void;onAuthenticationLost:()=>void}){
 const [rawTargets,setTargets]=useState<ProjectSummary[]>([]),[rawTargetNext,setTargetNext]=useState<string|null>(null),[rawPage,setPage]=useState<KnowledgeSharePage|null>(null),[view,setView]=useState<{key:string;value:ShareView}|null>(null),[error,setError]=useState<{key:string;value:ApiError}|null>(null),[rawBusy,setBusy]=useState(false);
 const alive=useRef(true),locked=useRef(false),sequence=useRef(0);
 const own=buffer?.projectId===projectId&&buffer.ownerUserId===session.user.id&&buffer.ownerClientId===session.clientId?buffer:null;
 const rawKey=JSON.stringify([projectId,session.user.id,session.clientId,session.csrfToken,fingerprint(selected?.ref),selected?.state,own?.controlGeneration,fingerprint(own?.versionRefs[0])]);
 const scope=useRef({rawKey,epoch:0,key:rawKey+':0',client,buffer:own});
 const previous=scope.current,epoch=previous.epoch+(previous.rawKey!==rawKey||previous.client!==client?1:0),key=rawKey+':'+epoch;
 if(epoch!==previous.epoch){sequence.current++;locked.current=false;}
 scope.current={rawKey,epoch,key,client,buffer:own};
 const [dataOwner,setDataOwner]=useState(''),dataCurrent=dataOwner===key;
 const targets=dataCurrent?rawTargets:[],targetNext=dataCurrent?rawTargetNext:null,page=dataCurrent?rawPage:null,busy=dataCurrent&&rawBusy;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sequence.current++;};},[]);
 useEffect(()=>{sequence.current++;setTargets([]);setTargetNext(null);setPage(null);setView(null);setError(null);setBusy(false);locked.current=false;},[key,client]);
 function active(k:string,c:ApiClient,id:number){return alive.current&&scope.current.key===k&&scope.current.client===c&&sequence.current===id;}
 function fail(e:unknown,k:string){const value=e instanceof ApiError?e:new ApiError('REQUEST_FAILED');setError({key:k,value});if(value.status===401)onAuthenticationLost();}
 async function task(run:(current:()=>boolean)=>Promise<void>){if(locked.current)return;locked.current=true;if(!dataCurrent){setTargets([]);setTargetNext(null);setPage(null);setView(null);}setDataOwner(key);setBusy(true);setError(null);const id=++sequence.current,k=key,c=client,current=()=>active(k,c,id);try{await run(current);}catch(e){if(current())fail(e,k);}finally{if(current()){setBusy(false);locked.current=false;}}}
 const selectedEligible=!!selected&&selected.entry.scope.projectId===projectId&&selected.headVersion===selected.ref.version&&['PROPOSED','CONFIRMED'].includes(selected.state);
 async function start(){await task(async current=>{if(!selectedEligible||!selected||buffer&&(buffer.pending||buffer.uncertain||buffer.dirty))return;const generation=await documentControl(client,projectId,session);if(current())onChange(newKnowledgeShareRequest(projectId,session,generation,[selected.ref]));});}
 function edit(change:Partial<Pick<KnowledgeShareRequestBuffer,'explicitTargets'|'purpose'>>){if(!own||busy||locked.current||own.pending||own.uncertain||own.resultRef)return;onChange(previous=>previous===own?{...own,...change,dirty:true,failure:null}:previous);}
 async function targetList(cursor:string|null=null){await task(async current=>{if(!own||own.pending||own.uncertain)return;setTargets(cursor?targets:[]);const result=await listProjects(client,'',false,cursor);if(current()){setTargets(previous=>cursor?[...previous,...result.items.filter(p=>p.id!==projectId)]:result.items.filter(p=>p.id!==projectId));setTargetNext(result.nextCursor);}});}
 async function store(){await task(async current=>{const original=own;if(!original||original.resultRef||!original.pending&&!selectedEligible||fingerprint(selected?.ref)!==fingerprint(original.versionRefs[0]))throw new ApiError('KNOWLEDGE_SHARE_BINDING_INVALID');const generation=await documentControl(client,projectId,session);if(!current())return;if(generation!==original.controlGeneration)throw new ApiError('CONTROL_GENERATION_CONFLICT',409);
  const pending=original.pending??await prepareKnowledgeShareRequest(original,session);if(!current())return;
  const work={...original,pending,uncertain:true,failure:null};onChange(previous=>previous===original?work:previous);
  const continuation=()=>current()&&scope.current.buffer?.pending?.commandId===pending.commandId&&scope.current.buffer?.controlGeneration===work.controlGeneration&&fingerprint(scope.current.buffer?.versionRefs[0])===fingerprint(selected?.ref);
  // parent 상태 반영 전 동기 실행에도 원래 같은 buffer만 허용한다.
  const same=()=>current()&&(scope.current.buffer===original||continuation());
  try{const result=await sendKnowledgeShareRequest(client,work,session,same);if(!same())return;setView({key,value:result});onChange(previous=>previous?.pending?.commandId===pending.commandId?{...previous,pending:null,uncertain:false,dirty:false,resultRef:result.requestRef,failure:null}:previous);setTargets([]);setTargetNext(null);}catch(e){if(same()){const failure=e instanceof ApiError?e:new ApiError('REQUEST_FAILED');onChange(previous=>previous?.pending?.commandId===pending.commandId?{...previous,uncertain:true,failure:{code:failure.code,status:failure.status}}:previous);}throw e;}
 });}
 async function requests(cursor:string|null=null){await task(async current=>{setView(null);setPage(cursor?page:null);const result=await listKnowledgeShareRequests(client,projectId,cursor);if(current())setPage(previous=>cursor&&previous?{...result,items:[...previous.items,...result.items]}:result);});}
 async function inspect(ref:ShareRef){await task(async current=>{setView(null);const result=await readKnowledgeShareRequest(client,projectId,ref);if(current())setView({key,value:result});});}
 const shown=view?.key===key?view.value:null,shownError=error?.key===key?error.value:null;
 const editable=!!own&&!busy&&!own.pending&&!own.uncertain&&!own.resultRef;
 return <section aria-label="지식 공유 요청 보관"><header><h3>공유 요청 보관</h3><span title="출발 프로젝트에 선택·목적만 보관합니다. 실제 공유·승인·수신은 수행하지 않습니다.">ⓘ</span></header>
  <button type="button" disabled={busy||!selectedEligible||!!buffer&&!!(buffer.pending||buffer.uncertain||buffer.dirty)} onClick={()=>void start()}>선택 지식으로 요청 작성</button>
  {buffer&&!own?<p role="alert">다른 사용자·기기의 미결 요청은 이 문맥에서 열거나 전송하지 않습니다.</p>:null}
  {own&&!own.resultRef?<><p>고정 지식 {own.versionRefs.map(r=>r.id+' v'+r.version).join(', ')}</p>
   {fingerprint(selected?.ref)!==fingerprint(own.versionRefs[0])?<p role="status">원래 선택 지식을 다시 열어야 이 요청을 재확인할 수 있습니다. 미결 원명령은 보존됩니다.</p>:null}
   <button type="button" disabled={!editable} onClick={()=>void targetList()}>허가된 대상 프로젝트 조회</button>
   {targets.length?<fieldset disabled={!editable}><legend>명시 대상 프로젝트</legend>{targets.map(p=><label key={p.id}><input type="checkbox" checked={own.explicitTargets.some(t=>t.projectId===p.id)} onChange={e=>edit({explicitTargets:e.target.checked?[...own.explicitTargets,{kind:'PROJECT',projectId:p.id}]:own.explicitTargets.filter(t=>t.projectId!==p.id)})}/>{p.name}</label>)}</fieldset>:null}
   {targetNext?<button type="button" disabled={!editable} onClick={()=>void targetList(targetNext)}>대상 프로젝트 다음 목록</button>:null}
   <label>공유 요청 목적<textarea aria-label="공유 요청 목적" maxLength={20000} value={own.purpose} disabled={!editable} onChange={e=>edit({purpose:e.target.value})}/></label>
   <p>선택 대상 {own.explicitTargets.length}개</p>
   <button type="button" disabled={busy||!!own.resultRef||!own.pending&&!selectedEligible||fingerprint(selected?.ref)!==fingerprint(own.versionRefs[0])} onClick={()=>void store()}>{own.pending?'원명령 재확인':'공유 요청 보관'}</button>
   {own.pending||own.uncertain?<p role="status">보관 결과가 미확인입니다. 입력과 원명령을 보존하고 같은 명령으로 재확인하세요.</p>:null}
   {!own.pending&&!own.uncertain&&!own.resultRef?<button type="button" disabled={busy} onClick={()=>{if(confirm('미전송 공유 요청 초안을 닫을까요? 저장된 요청과 지식은 삭제하지 않습니다.'))onChange(previous=>previous===own&&!previous.pending&&!previous.uncertain?null:previous);}}>미전송 요청 초안 닫기</button>:null}
  </>:null}
  {own?.resultRef?<button type="button" disabled={busy} onClick={()=>void inspect(own.resultRef!)}>보관 요청 고정 조회</button>:null}
  <button type="button" disabled={busy} onClick={()=>void requests()}>내 보관 요청 조회</button>
  {busy?<p role="status">요청을 확인하고 있습니다.</p>:null}
  {shownError?<p role="alert">요청을 확인하지 못했습니다. {shownError.code}</p>:null}
  {page?<><ul>{page.items.map(item=><li key={item.requestRef.id}><button type="button" disabled={busy} onClick={()=>void inspect(item.requestRef)}>{item.requestRef.id} 고정 조회</button><span>{item.currentCheck==='UNAVAILABLE'?'현재 원문 또는 대상 확인 불가':'요청 보관됨'}</span></li>)}</ul>{!page.items.length?<p>보관한 요청이 없습니다.</p>:null}{page.nextCursor?<button type="button" disabled={busy} onClick={()=>void requests(page.nextCursor)}>내 요청 다음 목록</button>:null}</>:null}
  {shown?<section aria-label="보관 공유 요청 상세"><p role="status">요청 보관 상태입니다. 실제 공유·승인·수신은 수행하지 않았습니다.</p><p>{shown.requestRef.id} / v1 / {shown.requestRef.contentHash}</p>{shown.currentCheck==='UNAVAILABLE'?<p>현재 원문 또는 대상을 확인할 수 없어 선택과 목적을 표시하지 않습니다.</p>:<><p>{shown.snapshot.purpose}</p><RequestOriginalPreview key={JSON.stringify([key,shown.requestRef])} client={client} projectId={projectId} refs={shown.snapshot.versionRefs} onAuthenticationLost={onAuthenticationLost}/><ul>{shown.snapshot.explicitTargets.map(t=><li key={t.projectId}>{t.projectId} / 당시 프로젝트 v{t.version}</li>)}</ul></>}</section>:null}
 </section>;
}