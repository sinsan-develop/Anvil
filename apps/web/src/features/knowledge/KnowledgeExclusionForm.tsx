import{useEffect,useRef,useState}from'react';
import{ApiClient,ApiError}from'../../api/client.ts';
import type{DocumentSession}from'../design-trace/editor-api.ts';
import{isKnownDocumentRejection}from'../design-trace/mutation-result.ts';
import{prepareKnowledgeExclusion,sendKnowledgeExclusion,type KnowledgeExclusionBuffer,type KnowledgeExclusionChange}from'./exclusion-api.ts';
export function KnowledgeExclusionForm({client,session,buffer,onChange,onSaved,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;buffer:KnowledgeExclusionBuffer;onChange:KnowledgeExclusionChange;onSaved:()=>void;onAuthenticationLost:()=>void}){
 const[working,setWorking]=useState(false),alive=useRef(true),locked=useRef(false);
 const identity=[client,client.transport,buffer.projectId,session.user.id,session.clientId,session.csrfToken],owner=useRef({identity});
 if(identity.some((value,index)=>value!==owner.current.identity[index]))owner.current={identity};
 const scope=owner.current,current=useRef(buffer);current.current=buffer;
 const context=()=>owner.current===scope&&[client,client.transport,buffer.projectId,session.user.id,session.clientId,session.csrfToken].every((value,index)=>value===scope.identity[index]);
 const active=(expected:KnowledgeExclusionBuffer)=>alive.current&&context()&&current.current===expected;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 if(buffer.ownerUserId!==session.user.id||buffer.ownerClientId!==session.clientId)return<p role="alert">다른 사용자·기기의 제외 요청은 열거나 전송하지 않습니다.</p>;
 async function save(){if(locked.current||buffer.savedEventId||!active(buffer))return;locked.current=true;setWorking(true);let b=buffer,dispatched=false;
 const publish=(next:KnowledgeExclusionBuffer)=>{if(!context()||onChange(b,next)!==true)return false;if(current.current===b)current.current=next;b=next;return true;};
 try{
  if(!b.pending){const pending=await prepareKnowledgeExclusion(b,session);if(!active(b)||!publish({...b,pending}))return;}
  // 재확인도 새 객체를 선점하여 이전 dispatch의 결과가 이를 확정하지 못하게 한다.
  if(!active(b)||!publish({...b}))return;dispatched=true;
  const result=await sendKnowledgeExclusion(client,b,session,()=>active(b));
  if(publish({...b,pending:null,savedEventId:result.eventId,failure:null,uncertain:false,dirty:false})&&active(b))onSaved();
 }catch(e){if(!dispatched&&!active(b))return;const a=e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');if(publish({...b,failure:{code:a.code,status:a.status},uncertain:b.uncertain||a.code!=='KNOWLEDGE_EXCLUSION_PAUSED'&&!isKnownDocumentRejection(a)})&&a.status===401&&active(b))onAuthenticationLost();}
 finally{locked.current=false;if(alive.current)setWorking(false);}}
 function close(){if(!active(buffer)||locked.current||working||buffer.uncertain||buffer.pending&&!isKnownDocumentRejection(buffer.failure))return;if((buffer.dirty||buffer.pending)&&!confirm('제외 사유 입력과 명확히 거절된 명령만 닫을까요? 원문/지식은 삭제하지 않습니다.'))return;if(active(buffer))onChange(buffer,null);}
 return<section aria-label="지식 사용 제외 요청"><h3>사용 제외 대상: {buffer.target.entry.title} · v{buffer.target.ref.version}</h3><pre aria-label="제외 대상 원문">{buffer.target.body}</pre><p>삭제가 아닙니다. 이 정확 버전을 앞으로의 기본 선택에서 제외하고 원문/이력은 보존합니다.</p>
 <label>지식 제외 사유<textarea aria-label="지식 제외 사유" rows={3} maxLength={20000} disabled={working||!!buffer.pending||!!buffer.savedEventId} value={buffer.reason} onChange={e=>{if(active(buffer)&&!locked.current&&!buffer.pending&&!buffer.savedEventId)onChange(buffer,{...buffer,reason:e.target.value,dirty:true,failure:null});}}/></label>
 <button type="button" disabled={working||!!buffer.savedEventId||!buffer.reason.trim()} onClick={()=>void save()}>{buffer.pending?'같은 제외 명령 결과 확인':'사용 제외 저장'}</button><button type="button" disabled={working||buffer.uncertain||!!buffer.pending&&!isKnownDocumentRejection(buffer.failure)} onClick={close}>지식 제외 닫기</button>
 {buffer.failure?<p role="alert">{buffer.failure.code}{buffer.uncertain?' · 결과 미확인: 원래 명령을 보존합니다.':''}</p>:null}{buffer.savedEventId?<p role="status">사용 제외 저장 확인 · 원문 보존</p>:null}
 </section>;
}
