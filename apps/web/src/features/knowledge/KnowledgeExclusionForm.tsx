import{useEffect,useRef,useState}from'react';
import{ApiClient,ApiError}from'../../api/client.ts';
import type{DocumentSession}from'../design-trace/editor-api.ts';
import{isKnownDocumentRejection}from'../design-trace/mutation-result.ts';
import{prepareKnowledgeExclusion,sendKnowledgeExclusion,type KnowledgeExclusionBuffer}from'./exclusion-api.ts';
export function KnowledgeExclusionForm({client,session,buffer,onChange,onSaved,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;buffer:KnowledgeExclusionBuffer;onChange:(b:KnowledgeExclusionBuffer|null)=>void;onSaved:()=>void;onAuthenticationLost:()=>void}){
 const[working,setWorking]=useState(false),alive=useRef(true),locked=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 if(buffer.ownerUserId!==session.user.id||buffer.ownerClientId!==session.clientId)return<p role="alert">다른 사용자·기기의 제외 요청은 열거나 전송하지 않습니다.</p>;
 async function save(){if(locked.current||buffer.savedEventId)return;locked.current=true;setWorking(true);let b=buffer;try{
  if(!b.pending){b={...b,pending:await prepareKnowledgeExclusion(b,session)};onChange(b);}
  const result=await sendKnowledgeExclusion(client,b,session,()=>alive.current);b={...b,pending:null,savedEventId:result.eventId,failure:null,uncertain:false,dirty:false};onChange(b);if(alive.current)onSaved();
 }catch(e){const a=e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');onChange({...b,failure:{code:a.code,status:a.status},uncertain:b.uncertain||a.code!=='KNOWLEDGE_EXCLUSION_PAUSED'&&!isKnownDocumentRejection(a)});if(a.status===401&&alive.current)onAuthenticationLost();}
 finally{locked.current=false;if(alive.current)setWorking(false);}}
 function close(){if(working||buffer.uncertain||buffer.pending&&!isKnownDocumentRejection(buffer.failure))return;if((buffer.dirty||buffer.pending)&&!confirm('제외 사유 입력과 명확히 거절된 명령만 닫을까요? 원문/지식은 삭제하지 않습니다.'))return;onChange(null);}
 return<section aria-label="지식 사용 제외 요청"><h3>사용 제외 대상: {buffer.target.entry.title} · v{buffer.target.ref.version}</h3><pre aria-label="제외 대상 원문">{buffer.target.body}</pre><p>삭제가 아닙니다. 이 정확 버전을 앞으로의 기본 선택에서 제외하고 원문/이력은 보존합니다.</p>
 <label>지식 제외 사유<textarea aria-label="지식 제외 사유" rows={3} maxLength={20000} disabled={working||!!buffer.pending||!!buffer.savedEventId} value={buffer.reason} onChange={e=>onChange({...buffer,reason:e.target.value,dirty:true,failure:null})}/></label>
 <button type="button" disabled={working||!!buffer.savedEventId||!buffer.reason.trim()} onClick={()=>void save()}>{buffer.pending?'같은 제외 명령 결과 확인':'사용 제외 저장'}</button><button type="button" disabled={working||buffer.uncertain||!!buffer.pending&&!isKnownDocumentRejection(buffer.failure)} onClick={close}>지식 제외 닫기</button>
 {buffer.failure?<p role="alert">{buffer.failure.code}{buffer.uncertain?' · 결과 미확인: 원래 명령을 보존합니다.':''}</p>:null}{buffer.savedEventId?<p role="status">사용 제외 저장 확인 · 원문 보존</p>:null}
 </section>;
}
