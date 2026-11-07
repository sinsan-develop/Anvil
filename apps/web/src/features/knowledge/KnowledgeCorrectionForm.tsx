import{KnowledgeCorrectionUploadApprovalEditor}from'./KnowledgeCorrectionUploadApprovalEditor.tsx';
import{QuarantinedOriginalNotice}from'../design-trace/QuarantinedOriginalNotice.tsx';
import{useEffect,useRef,useState}from'react';
import{ApiClient,ApiError}from'../../api/client.ts';
import type{DocumentSession}from'../design-trace/editor-api.ts';
import{isKnownDocumentRejection,isConfirmedArtifactQuarantine,documentFailure}from'../design-trace/mutation-result.ts';
import{prepareKnowledgeCorrection,sendKnowledgeCorrection,type KnowledgeCorrectionBuffer,type KnowledgeCorrectionChange}from'./correction-api.ts';
import{KnowledgeCorrectionDocumentSources}from'./KnowledgeCorrectionDocumentSources.tsx';
import{KnowledgeCorrectionArtifactSources}from'./KnowledgeCorrectionArtifactSources.tsx';
import{KnowledgeCorrectionConversationSources}from'./KnowledgeCorrectionConversationSources.tsx';
import{KnowledgeCorrectionDiff}from'./KnowledgeCorrectionDiff.tsx';
import{canReopenRejectedKnowledgeDraft,reopenRejectedKnowledgeDraft}from'./rejected-knowledge-draft.ts';
import {KnowledgeScopePicker,KnowledgeScopeSummary} from './KnowledgeScopePicker.tsx';
export function KnowledgeCorrectionForm({client,session,buffer,onChange,onSaved,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;buffer:KnowledgeCorrectionBuffer;onChange:(change:KnowledgeCorrectionChange)=>void;onSaved:()=>void;onAuthenticationLost:()=>void}){
 const alive=useRef(true),locked=useRef(false),epoch=useRef(0),owned=useRef(new Set([buffer])),owner=useRef(buffer),flight=useRef<number|null>(null);
 const identityKey=JSON.stringify([buffer.projectId,buffer.ownerUserId,buffer.ownerClientId,buffer.controlGeneration,buffer.target.ref,session.user.id,session.clientId,session.csrfToken]),identity=useRef({client,key:identityKey});
 if(identity.current.client!==client||identity.current.key!==identityKey||!owned.current.has(buffer)){epoch.current++;owned.current=new Set([buffer]);}
 identity.current={client,key:identityKey};owner.current=buffer;
 const currentEpoch=epoch.current,[activity,setActivity]=useState({epoch:-1,busy:false}),working=activity.epoch===currentEpoch&&activity.busy,[approvalActivity,setApprovalActivity]=useState({epoch:-1,busy:false}),approvalBusy=approvalActivity.epoch===currentEpoch&&approvalActivity.busy;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;epoch.current++;};},[]);
 function current(){return alive.current&&epoch.current===currentEpoch&&owned.current.has(owner.current)&&identity.current.client===client&&identity.current.key===identityKey;}
 function publish(next:KnowledgeCorrectionBuffer){if(!current())return false;owned.current.add(next);owner.current=next;onChange(next);return true;}
 function approvalChange(change:KnowledgeCorrectionChange){if(!current())return;const previous=owner.current;if(previous.ownerUserId!==session.user.id||previous.ownerClientId!==session.clientId)return;const next=typeof change==='function'?change(previous):change;if(next&&next!==previous)publish(next);}
 if(buffer.ownerUserId!==session.user.id||buffer.ownerClientId!==session.clientId)return<p role="alert">다른 사용자·기기의 정정 입력은 열거나 전송하지 않습니다.</p>;
 const approval=buffer.pending?.uploadApproval,approvalBlocked=!!approval&&!approval.commandHash;
 function edit(patch:Partial<KnowledgeCorrectionBuffer>){if(working||approvalBusy||buffer.pending||buffer.savedRef)return;publish({...buffer,...patch,dirty:true,failure:null});}
 async function save(){if(flight.current===currentEpoch||working||approvalBusy||approvalBlocked||buffer.savedRef)return;flight.current=currentEpoch;locked.current=true;setActivity({epoch:currentEpoch,busy:true});let b=buffer;try{
  if(!b.pending){const pending=await prepareKnowledgeCorrection(b,session);if(!current())return;b={...b,pending};if(!publish(b))return;}
  const ref=await sendKnowledgeCorrection(client,b,session,p=>{if(current()){b={...b,pending:p};publish(b);}},current);if(!current())return;b={...b,pending:null,savedRef:ref,failure:null,uncertain:false,dirty:false};if(publish(b)&&current())onSaved();
 }catch(e){if(!current())return;const a=e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');publish({...b,failure:documentFailure(a),uncertain:isConfirmedArtifactQuarantine(a)?false:b.uncertain||a.code!=='KNOWLEDGE_CORRECTION_PAUSED'&&!isKnownDocumentRejection(a)});if(a.status===401&&current())onAuthenticationLost();}
 finally{if(flight.current===currentEpoch){flight.current=null;locked.current=false;if(current())setActivity({epoch:currentEpoch,busy:false});}}}
 function close(){if(working||approvalBusy||buffer.uncertain||approval?.request?.pending||approval?.request?.uncertain||buffer.pending&&!isKnownDocumentRejection(buffer.failure))return;if((buffer.dirty||buffer.pending)&&!confirm('미저장 정정 입력과 명확히 거절된 명령만 닫을까요? 저장된 원문은 삭제하지 않습니다.'))return;if(current())onChange(null);}
 return<section aria-label="지식 정정 작성"><h3>지식 정정 · 기준 v{buffer.target.ref.version}</h3><p>기존 원문·판단 이유·출처는 보존하고 별도 확정 전인 새 버전을 만듭니다. 종류는 변경하지 않습니다.</p><pre aria-label="정정 전 원문">{buffer.target.body}</pre><p>정정 전 판단 이유: {buffer.target.entry.reason}</p>
 <fieldset disabled={working||!!buffer.pending||!!buffer.savedRef}><label>정정 지식 제목<input aria-label="정정 지식 제목" maxLength={200} value={buffer.title} onChange={e=>edit({title:e.target.value})}/></label><label>정정 지식 원문<textarea aria-label="정정 지식 원문" rows={8} value={buffer.body} onChange={e=>edit({body:e.target.value})}/></label><label>정정 지식 판단 이유<textarea aria-label="정정 지식 판단 이유" rows={3} maxLength={20000} value={buffer.reason} onChange={e=>edit({reason:e.target.value})}/></label><label>지식 정정 사유<textarea aria-label="지식 정정 사유" rows={3} maxLength={20000} value={buffer.changeReason} onChange={e=>edit({changeReason:e.target.value})}/></label></fieldset>
 <KnowledgeScopeSummary scope={buffer.target.entry.scope} label="정정 전 지식 관련성"/>
 <KnowledgeScopePicker client={client} buffer={buffer} projectId={buffer.projectId} kind={buffer.target.entry.kind} scope={buffer.scope??buffer.target.entry.scope} disabled={working||!!buffer.pending||!!buffer.savedRef||buffer.uncertain} onChange={scope=>edit({scope})} onAuthenticationLost={onAuthenticationLost}/>
 <KnowledgeCorrectionDiff base={{title:buffer.target.entry.title,body:buffer.target.body,reason:buffer.target.entry.reason}} current={{title:buffer.title,body:buffer.body,reason:buffer.reason}} version={buffer.target.ref.version}/>
 <KnowledgeCorrectionDocumentSources key={JSON.stringify([buffer.projectId,buffer.ownerUserId,buffer.ownerClientId,buffer.controlGeneration,buffer.target.ref])} client={client} session={session} buffer={buffer} disabled={working} isLocked={()=>locked.current} onChange={onChange} onAuthenticationLost={onAuthenticationLost}/>
 <KnowledgeCorrectionArtifactSources key={JSON.stringify([buffer.projectId,buffer.ownerUserId,buffer.ownerClientId,buffer.controlGeneration,buffer.target.ref])} client={client} session={session} buffer={buffer} disabled={working} isLocked={()=>locked.current} onChange={onChange} onAuthenticationLost={onAuthenticationLost}/>
 <KnowledgeCorrectionConversationSources key={JSON.stringify([buffer.projectId,buffer.ownerUserId,buffer.ownerClientId,buffer.controlGeneration,buffer.target.ref])} client={client} session={session} buffer={buffer} disabled={working} isLocked={()=>locked.current} onChange={onChange} onAuthenticationLost={onAuthenticationLost}/>
 <KnowledgeCorrectionUploadApprovalEditor client={client} session={session} buffer={buffer} disabled={working} onChange={approvalChange} onAuthenticationLost={onAuthenticationLost} onBusy={busy=>{if(current())setApprovalActivity({epoch:currentEpoch,busy});}}/>
 <button type="button" disabled={working||approvalBusy||approvalBlocked||!!buffer.savedRef||!buffer.title.trim()||!buffer.reason.trim()||!buffer.changeReason.trim()} onClick={()=>void save()}>{buffer.pending?'같은 정정 명령 결과 확인':'지식 정정 저장'}</button><button type="button" disabled={working||approvalBusy||!!approval?.request?.pending||!!approval?.request?.uncertain||buffer.uncertain||!!buffer.pending&&!isKnownDocumentRejection(buffer.failure)} onClick={close}>지식 정정 닫기</button>
 {!approval&&canReopenRejectedKnowledgeDraft(buffer,buffer.projectId,session)?<button type="button" disabled={working} onClick={()=>{if(locked.current||working)return;if(confirm('명확히 거절된 정정 명령을 확인했습니다. 입력과 원 기준 버전을 유지하고 별도 명령으로 계속 작성할까요? 업로드된 원문은 삭제하지 않습니다.'))onChange(reopenRejectedKnowledgeDraft(buffer,buffer.projectId,session));}}>거절 확인 후 정정 입력 계속 작성</button>:null}
 <QuarantinedOriginalNotice failure={buffer.failure}/>{buffer.failure?<p role="alert">{buffer.failure.code}{buffer.uncertain?' · 결과 미확인: 원래 명령을 보존합니다.':''}</p>:null}{buffer.savedRef?<p role="status">지식 정정 저장 확인 · v{buffer.savedRef.version} · 별도 확정 전</p>:null}
 </section>;
}
