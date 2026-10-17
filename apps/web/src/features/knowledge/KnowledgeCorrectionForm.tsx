import{QuarantinedOriginalNotice}from'../design-trace/QuarantinedOriginalNotice.tsx';
import{useEffect,useRef,useState}from'react';
import{ApiClient,ApiError}from'../../api/client.ts';
import type{DocumentSession}from'../design-trace/editor-api.ts';
import{isKnownDocumentRejection,isConfirmedArtifactQuarantine,documentFailure}from'../design-trace/mutation-result.ts';
import{prepareKnowledgeCorrection,sendKnowledgeCorrection,type KnowledgeCorrectionBuffer}from'./correction-api.ts';
import{KnowledgeCorrectionDiff}from'./KnowledgeCorrectionDiff.tsx';
export function KnowledgeCorrectionForm({client,session,buffer,onChange,onSaved,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;buffer:KnowledgeCorrectionBuffer;onChange:(b:KnowledgeCorrectionBuffer|null)=>void;onSaved:()=>void;onAuthenticationLost:()=>void}){
 const[working,setWorking]=useState(false),alive=useRef(true),locked=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 if(buffer.ownerUserId!==session.user.id||buffer.ownerClientId!==session.clientId)return<p role="alert">다른 사용자·기기의 정정 입력은 열거나 전송하지 않습니다.</p>;
 function edit(patch:Partial<KnowledgeCorrectionBuffer>){if(working||buffer.pending||buffer.savedRef)return;onChange({...buffer,...patch,dirty:true,failure:null});}
 async function save(){if(locked.current||buffer.savedRef)return;locked.current=true;setWorking(true);let b=buffer;try{
  if(!b.pending){b={...b,pending:await prepareKnowledgeCorrection(b,session)};onChange(b);}
  const ref=await sendKnowledgeCorrection(client,b,session,p=>{b={...b,pending:p};onChange(b);},()=>alive.current);b={...b,pending:null,savedRef:ref,failure:null,uncertain:false,dirty:false};onChange(b);if(alive.current)onSaved();
 }catch(e){const a=e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');onChange({...b,failure:documentFailure(a),uncertain:isConfirmedArtifactQuarantine(a)?false:b.uncertain||a.code!=='KNOWLEDGE_CORRECTION_PAUSED'&&!isKnownDocumentRejection(a)});if(a.status===401&&alive.current)onAuthenticationLost();}
 finally{locked.current=false;if(alive.current)setWorking(false);}}
 function close(){if(working||buffer.uncertain||buffer.pending&&!isKnownDocumentRejection(buffer.failure))return;if((buffer.dirty||buffer.pending)&&!confirm('미저장 정정 입력과 명확히 거절된 명령만 닫을까요? 저장된 원문은 삭제하지 않습니다.'))return;onChange(null);}
 return<section aria-label="지식 정정 작성"><h3>지식 정정 · 기준 v{buffer.target.ref.version}</h3><p>기존 원문·판단 이유·출처는 보존하고 별도 확정 전인 새 버전을 만듭니다. 종류는 변경하지 않습니다.</p><pre aria-label="정정 전 원문">{buffer.target.body}</pre><p>정정 전 판단 이유: {buffer.target.entry.reason}</p>
 <fieldset disabled={working||!!buffer.pending||!!buffer.savedRef}><label>정정 지식 제목<input aria-label="정정 지식 제목" maxLength={200} value={buffer.title} onChange={e=>edit({title:e.target.value})}/></label><label>정정 지식 원문<textarea aria-label="정정 지식 원문" rows={8} value={buffer.body} onChange={e=>edit({body:e.target.value})}/></label><label>정정 지식 판단 이유<textarea aria-label="정정 지식 판단 이유" rows={3} maxLength={20000} value={buffer.reason} onChange={e=>edit({reason:e.target.value})}/></label><label>지식 정정 사유<textarea aria-label="지식 정정 사유" rows={3} maxLength={20000} value={buffer.changeReason} onChange={e=>edit({changeReason:e.target.value})}/></label></fieldset>
 <KnowledgeCorrectionDiff base={{title:buffer.target.entry.title,body:buffer.target.body,reason:buffer.target.entry.reason}} current={{title:buffer.title,body:buffer.body,reason:buffer.reason}} version={buffer.target.ref.version}/>
 <button type="button" disabled={working||!!buffer.savedRef||!buffer.title.trim()||!buffer.reason.trim()||!buffer.changeReason.trim()} onClick={()=>void save()}>{buffer.pending?'같은 정정 명령 결과 확인':'지식 정정 저장'}</button><button type="button" disabled={working||buffer.uncertain||!!buffer.pending&&!isKnownDocumentRejection(buffer.failure)} onClick={close}>지식 정정 닫기</button>
 <QuarantinedOriginalNotice failure={buffer.failure}/>{buffer.failure?<p role="alert">{buffer.failure.code}{buffer.uncertain?' · 결과 미확인: 원래 명령을 보존합니다.':''}</p>:null}{buffer.savedRef?<p role="status">지식 정정 저장 확인 · v{buffer.savedRef.version} · 별도 확정 전</p>:null}
 </section>;
}
