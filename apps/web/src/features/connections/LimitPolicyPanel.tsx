import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,type DocumentSession} from '../design-trace/editor-api.ts';
import {SelectedLimitUsage} from './SelectedLimitUsage.tsx';
import {newLimitBuffer,freezeLimitCommand,sendLimitCommand,limitPolicyAccess,readLimitPolicy,settleLimitBuffer,matchesLimitBuffer,type LimitBuffer,type LimitBufferChange,type LimitPolicyRecord,type LimitOperation,type ExecutionLimits} from './limit-policy-api.ts';

interface Props{client:ApiClient;projectId:string;session:DocumentSession;buffer:LimitBuffer|null;onChange:(change:LimitBufferChange)=>void;onAuthenticationLost:()=>void}
const known=(status:number)=>[400,403,404,409,412,422].includes(status);
const fields:[keyof ExecutionLimits,string,number,number][]=[
 ['maxAttempts','최대 시도 수',1,3],['maxElapsedMs','최대 경과 시간 ms',1,7200000],['maxCalls','최대 호출 수',1,50],
 ['maxSpoolBytes','최대 스풀 bytes',1,1073741824],['maxOfflineMs','단절 허용 ms',0,300000]];
export function LimitPolicyPanel({client,projectId,session,buffer,onChange,onAuthenticationLost}:Props){
 const[view,setView]=useState<LimitPolicyRecord|null>(null),[selected,setSelected]=useState({id:'',version:'',contentHash:''}),[busy,setBusy]=useState(false),[error,setError]=useState<ApiError|null>(null);
 const alive=useRef(true),lock=useRef(false);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const work=buffer?.projectId===projectId&&buffer.ownerUserId===session.user.id&&buffer.ownerClientId===session.clientId?buffer:null;
 const latest=useRef(work);latest.current=work;
 const frozen=busy||!!work?.pending||!!work?.result;
 function fail(cause:unknown){const e=cause instanceof ApiError?cause:new ApiError('LIMIT_POLICY_RESPONSE_INVALID');setError(e);if(e.status===401){setView(null);onAuthenticationLost();}}
 async function begin(base:LimitPolicyRecord|null=null){
  if(lock.current||work)return;lock.current=true;setBusy(true);setError(null);
  try{const generation=await documentControl(client,projectId,session);if(alive.current)onChange(previous=>previous??newLimitBuffer(projectId,session,generation,base));}catch(e){if(alive.current)fail(e);}finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 function edit(change:(b:LimitBuffer)=>void){if(!work||frozen)return;onChange(previous=>{if(previous?.bufferId!==work.bufferId||previous.pending||previous.result)return previous;const b=structuredClone(previous);change(b);b.dirty=true;b.failure=null;return b;});}
 async function inspect(){
  if(lock.current)return;lock.current=true;setBusy(true);setError(null);setView(null);const ref={id:selected.id,version:Number(selected.version),contentHash:selected.contentHash};
  try{const v=await readLimitPolicy(client,projectId,ref);if(alive.current)setView(v);}catch(e){if(alive.current)fail(e);}finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 async function save(operation:LimitOperation){
  if(!work||work.result||lock.current)return;lock.current=true;setBusy(true);setError(null);let current=structuredClone(work);
  const settle=(next:LimitBuffer)=>{const expected=current;onChange(previous=>settleLimitBuffer(previous,expected,next));current=next;};
  try{
   const op=(current.pending?.operation??operation) as LimitOperation;
   await limitPolicyAccess(client,current,session,op);if(!alive.current||!matchesLimitBuffer(latest.current,current))return;
   if(!current.pending){const pending=structuredClone(current);await freezeLimitCommand(pending,session,op);if(alive.current&&matchesLimitBuffer(latest.current,current))settle(pending);return;}
   // App에서 채택해 렌더한 동결 명령을 사용자가 별도 전송한 경우만 POST한다.
   const result=await sendLimitCommand(client,current,session);
   settle({...current,result,pending:null,pendingHash:null,dirty:false,uncertain:false,failure:null});
   if(alive.current){setView(result);setSelected({id:result.ref.id,version:String(result.ref.version),contentHash:result.ref.contentHash});}
  }catch(cause){const e=cause instanceof ApiError?cause:new ApiError('LIMIT_POLICY_RESPONSE_INVALID');settle({...current,uncertain:current.uncertain||!!current.pending&&!known(e.status),failure:{code:e.code,status:e.status}});if(alive.current)fail(e);}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 return <section className="status-card" aria-label="프로젝트 한도 정책"><h3>프로젝트 한도 정책</h3>
  <p>유한 한도 보관·개정·회수입니다. 현재 정책 유효성·누적 비용·실제 Agent/OS 강제·실행 허가를 이 화면에서 판정하지 않습니다. 비용 미설정은 무제한 허가가 아닙니다.</p>
  <button type="button" disabled={busy||!!work} onClick={()=>void begin()}>새 프로젝트 한도 작성</button>
  {work?<section aria-label="한도 정책 작성"><p>{work.base?'고정 v'+work.base.ref.version+'에서 명시 개정':'최초 작성 요청 · 기존 정책이 있으면 서버가 충돌을 거절합니다.'}</p>
   <fieldset disabled={frozen}><legend>유한 한도</legend>{fields.map(([key,label,min,max])=><label key={key}>{label}<input type="number" aria-label={label} min={min} max={max} step="1" value={work.draft.limits[key]??''} onChange={e=>edit(b=>{(b.draft.limits as any)[key]=Number(e.target.value);})}/></label>)}
    <p>동시 임무 한도: 1</p><label><input type="checkbox" checked={work.draft.limits.maxCost!==undefined} onChange={e=>edit(b=>{if(e.target.checked){b.draft.limits.maxCost=0;b.draft.limits.currency='USD';}else{delete b.draft.limits.maxCost;delete b.draft.limits.currency;}})}/>비용 상한 명시</label>
    {work.draft.limits.maxCost!==undefined?<><label>최대 비용<input type="number" aria-label="최대 비용" min="0" step="any" value={work.draft.limits.maxCost} onChange={e=>edit(b=>{b.draft.limits.maxCost=Number(e.target.value);})}/></label><label>통화 코드<input aria-label="통화 코드" maxLength={3} value={work.draft.limits.currency??''} onChange={e=>edit(b=>{b.draft.limits.currency=e.target.value;})}/></label></>:null}
    <label>한도 정책 사유<textarea aria-label="한도 정책 사유" maxLength={20000} value={work.draft.reason} onChange={e=>edit(b=>{b.draft.reason=e.target.value;})}/></label>
   </fieldset>
   <button type="button" disabled={busy||!!work.result||!work.draft.reason.trim()} onClick={()=>void save('applyLimitPolicy')}>{work.pending?(work.failure?'같은 한도 명령 결과 확인':'동결 한도 명령 명시 전송'):'한도 정책 명시 저장'}</button>
   {!work.pending&&work.base?.snapshot.state==='APPLIED'?<button type="button" disabled={busy||!!work.result||!work.draft.reason.trim()} onClick={()=>{if(confirm('선택한 고정 버전의 한도 정책을 회수 요청할까요? 실제 Agent 중지나 비용 취소가 아닙니다.'))void save('revokeLimitPolicy');}}>선택 버전 한도 회수 요청</button>:null}
   <button type="button" disabled={busy||!!work.pending||work.uncertain} onClick={()=>{if(!work.dirty||confirm('미저장 한도 입력을 닫을까요? 보관 정책은 삭제하지 않습니다.'))onChange(previous=>settleLimitBuffer(previous,work,null));}}>한도 작성 닫기</button>
   {work.pending&&work.failure&&known(work.failure.status)&&!work.uncertain?<button type="button" disabled={busy} onClick={()=>{if(confirm('거절된 명령만 분리하고 입력을 수정할까요? 기존 정책은 유지합니다.'))onChange(previous=>settleLimitBuffer(previous,work,{...work,pending:null,pendingHash:null,failure:null}));}}>거절된 한도 입력 수정</button>:null}
   {work.pending?<p>명령 {work.pending.commandId} · {work.pending.operation} · 동결 입력 보존 · 자동 전송/재전송 없음{work.uncertain?' · 결과 불명':''}</p>:null}
   {work.failure?<p role="alert">{work.failure.code} · 입력 보존</p>:null}
   {work.result?<p role="status">한도 보관 확인 · v{work.result.ref.version} · {work.result.snapshot.state} · 실행 허가 아님</p>:null}
  </section>:null}
  <fieldset disabled={busy}><legend>정확 보관 버전 조회 · 최신/현재로 추정하지 않음</legend>
   <label>한도 정책 ID<input aria-label="한도 정책 ID" value={selected.id} onChange={e=>setSelected({...selected,id:e.target.value})}/></label>
   <label>한도 정책 버전<input aria-label="한도 정책 버전" type="number" min="1" step="1" value={selected.version} onChange={e=>setSelected({...selected,version:e.target.value})}/></label>
   <label>한도 정책 hash<input aria-label="한도 정책 hash" value={selected.contentHash} onChange={e=>setSelected({...selected,contentHash:e.target.value})}/></label>
   <button type="button" onClick={()=>void inspect()}>정확 한도 버전 조회</button>
  </fieldset>
  {view?<article aria-label="보관 한도 정책"><h4>보관본 · 현재 적용/실행 준비 판정 아님</h4><p>{view.ref.id} · v{view.ref.version}<br/>{view.ref.contentHash}</p><p>보관 상태 {view.snapshot.state} · 결정 {view.snapshot.decidedAt} · 기한 {view.snapshot.expiresAt}</p><pre>{JSON.stringify(view.snapshot,null,2)}</pre><button type="button" disabled={busy||!!work} onClick={()=>void begin(view)}>이 한도 버전에서 작성</button></article>:null}
  {view?.projectId===projectId?<SelectedLimitUsage key={[projectId,session.user.id,session.clientId,view.ref.id,view.ref.version,view.ref.contentHash].join(':')} client={client} projectId={projectId} reference={view.ref} onAuthenticationLost={onAuthenticationLost}/>:null}
  {error&&!work?.failure?<p role="alert">{error.code}</p>:null}
 </section>;
}
