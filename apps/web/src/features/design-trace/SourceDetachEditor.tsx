import {useEffect,useId,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from './editor-api.ts';
import {prepareSourceDetach,sendSourceDetach,verifySourceDetach,canCloseSourceDetach,type SourceDetachBuffer,type SourceDetachChange} from './source-detach-api.ts';
import {documentMutationUncertain} from './mutation-result.ts';

export function SourceDetachEditor({client,session,buffer,onChange,onVerified,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;buffer:SourceDetachBuffer;onChange:(change:SourceDetachChange)=>void;onVerified:()=>void;onAuthenticationLost:()=>void}){
 const [busy,setBusy]=useState(false),running=useRef(false),mounted=useRef(true);
 const reasonId=useId();
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const same=(p:SourceDetachBuffer|null)=>p?.bindingId===buffer.bindingId&&p.ownerUserId===session.user.id&&p.ownerClientId===session.clientId;
 async function run(mode:'prepare'|'send'|'verify'){
  if(running.current)return;const priorUncertain=buffer.uncertain||(buffer.sent&&!buffer.receipt),dispatchId=crypto.randomUUID();let dispatched=false;running.current=true;setBusy(true);onChange(p=>same(p)?{...p!,failure:null}:p);
  try{
   if(mode==='prepare'){
    const next=await prepareSourceDetach(client,buffer,session,()=>mounted.current);
    onChange(p=>same(p)&&!p!.pending&&p!.reason===buffer.reason&&p!.acknowledged===buffer.acknowledged?next:p);
   }else if(mode==='send'){
    const commandId=buffer.pending?.commandId;
    const receipt=await sendSourceDetach(client,buffer,session,()=>mounted.current,()=>{dispatched=true;onChange(p=>same(p)&&p!.pending?.commandId===commandId?{...p!,sent:true,uncertain:true,dispatchId}:p);});
    onChange(p=>same(p)&&p!.pending?.commandId===commandId?{...p!,receipt,uncertain:false,failure:null}:p);
   }else{
    await verifySourceDetach(client,buffer,session,()=>mounted.current);
    onChange(p=>same(p)&&p!.pending?.commandId===buffer.pending?.commandId&&p!.receipt?.ref.contentHash===buffer.receipt?.ref.contentHash?{...p!,verified:true,failure:null}:p);
    if(mounted.current)onVerified();
   }
  }catch(cause){const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');onChange(p=>same(p)&&p!.pending?.commandId===buffer.pending?.commandId&&!(mode==='send'&&(p!.receipt||dispatched&&p!.dispatchId!==dispatchId))?{...p!,failure:{code:e.code,status:e.status},uncertain:mode==='send'&&p!.sent?documentMutationUncertain(priorUncertain,e):p!.uncertain}:p);if(mounted.current&&e.status===401)onAuthenticationLost();}
  finally{running.current=false;if(mounted.current)setBusy(false);}
 }
 const locked=busy||!!buffer.pending;
 return <section className="status-card definition-editor" aria-label="문서 소스 연결 해제"><h3>문서 소스 연결 해제</h3>
  <p>보존 대상 문서 {buffer.documentRef.id} v{buffer.documentRef.version} · 연결 {buffer.sourceLinkRef.id} v{buffer.sourceLinkRef.version}</p><p>{buffer.source.relativePath}</p><p className="meta">파일·문서·과거 이력은 삭제하지 않고 이 연결만 분리합니다. 현재 파일 내용의 일치 여부를 확인하는 작업이 아닙니다.</p>
  <label htmlFor={reasonId}>연결 해제 사유</label><textarea id={reasonId} value={buffer.reason} disabled={locked} maxLength={20000} onChange={e=>onChange(p=>same(p)&&!p!.pending?{...p!,reason:e.target.value,failure:null}:p)}/>
  <label><input type="checkbox" checked={buffer.acknowledged} disabled={locked} onChange={e=>onChange(p=>same(p)&&!p!.pending?{...p!,acknowledged:e.target.checked}:p)}/>표시된 문서와 연결만 분리하며 파일·원문을 보존함을 확인했습니다</label>
  {buffer.pending?<details><summary>분리 원명령</summary><pre aria-label="분리 원명령">{JSON.stringify(buffer.pending,null,2)}</pre></details>:null}
  {buffer.pending&&!buffer.sent&&!buffer.uncertain&&!buffer.receipt&&buffer.pending.approvalRef===null?<a href={'#/projects/'+buffer.projectId+'/approvals'}>연결 해제 승인 화면</a>:null}
  {buffer.pending?.approvalRef?<p>이번 승인 결박됨 · 아직 소비/연결 해제 아님</p>:null}
  {buffer.failure?<p role="alert">{buffer.failure.code} · 원래 대상과 명령을 보존했습니다.</p>:null}
  {buffer.uncertain?<p role="status">전송 결과 미확인 · 새 명령을 만들지 않습니다. 이 탭의 같은 명령으로만 결과를 확인하세요. 새로고침하면 보존 중인 입력이 사라질 수 있습니다.</p>:null}
  {buffer.receipt&&!buffer.verified?<p role="status">연결 해제 저장 응답 확인 · 목록 재조회 미확인</p>:null}
  {buffer.verified?<p role="status">정확한 분리 이력 재조회 확인 · 파일 내용·배포 확인 아님</p>:null}
  <div className="project-toolbar">
   {!buffer.pending?<button disabled={busy||!buffer.reason.trim()||!buffer.acknowledged} onClick={()=>{void run('prepare');}}>분리 명령 준비</button>:!buffer.receipt?<button disabled={busy} onClick={()=>{void run('send');}}>{buffer.sent?'같은 분리 명령 결과 확인':'연결 해제 실행'}</button>:<button disabled={busy||buffer.verified} onClick={()=>{void run('verify');}}>분리 결과 재조회</button>}
   <button disabled={busy||!canCloseSourceDetach(buffer)} onClick={()=>{if(buffer.sent&&!buffer.verified&&!confirm('확실한 거절 응답을 확인했습니다. 보존 중인 거절 명령을 닫을까요?'))return;onChange(p=>same(p)&&canCloseSourceDetach(p!)?null:p);}}>분리 준비 닫기</button>
  </div>
 </section>;
}
