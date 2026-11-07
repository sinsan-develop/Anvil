import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import {isKnownDocumentRejection} from '../design-trace/mutation-result.ts';
import {TraceViewer} from '../design-trace/TraceViewer.tsx';
import {artifactTaskTraceKey,newArtifactTaskTrace,prepareArtifactTaskTrace,sendArtifactTaskTrace,type ArtifactTraceDetail,type ArtifactTaskTraceStorage} from './artifact-task-trace-api.ts';
import type {SubmittedResultView} from './result-api.ts';
export function ArtifactTaskTracePanel({client,session,detail,result,storage,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;detail:ArtifactTraceDetail;result:SubmittedResultView;storage:ArtifactTaskTraceStorage;onAuthenticationLost:()=>void}){
 const key=artifactTaskTraceKey(session,detail,result),buffer=storage.buffers[key]??null,alive=useRef(true),owner=useRef({key,client,transport:client.transport,csrf:session.csrfToken,epoch:0}),working=useRef<object|null>(null),[busyOwner,setBusyOwner]=useState<object|null>(null),[error,setError]=useState<string|null>(null),[show,setShow]=useState(false);
 if(owner.current.key!==key||owner.current.client!==client||owner.current.transport!==client.transport||owner.current.csrf!==session.csrfToken)owner.current={key,client,transport:client.transport,csrf:session.csrfToken,epoch:owner.current.epoch+1};
 const busy=busyOwner===owner.current;
 const callbacks=useRef({storage,onAuthenticationLost});callbacks.current={storage,onAuthenticationLost};
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;owner.current.epoch++;};},[]);
 const update=(change:Parameters<ArtifactTaskTraceStorage['onChange']>[1])=>callbacks.current.storage.onChange(key,change);
 function edit(change:Partial<NonNullable<typeof buffer>>){if(working.current===owner.current||buffer?.pending||buffer?.result)return;update(old=>({...old??newArtifactTaskTrace(key),...change,failure:null}));}
 async function action(send:boolean){if(working.current===owner.current||!buffer)return;const context=owner.current;working.current=context;setBusyOwner(context);setError(null);const original=structuredClone(buffer),store=callbacks.current.storage,current=()=>alive.current&&owner.current===context&&client.transport===context.transport;
  // POST가 시작되기 전에 부모 buffer에 원명령과 불명을 보존한다. 이탈 후 응답이 없어도 같은 명령만 재확인한다.
  if(send)store.onChange(key,old=>old&&old.pending?.commandId===original.pending?.commandId?{...old,uncertain:true,failure:null}:old);
  try{if(send){const value=await sendArtifactTaskTrace(client,session,detail,result,original,current);if(current()&&value)store.onChange(key,old=>old&&old.pending?.commandId===original.pending?.commandId?{...old,result:value,uncertain:false,failure:null}:old);}else{const value=await prepareArtifactTaskTrace(client,session,detail,result,original,current);if(current()&&value)store.onChange(key,old=>old&&!old.pending&&old.reason===original.reason&&JSON.stringify(old.selected)===JSON.stringify(original.selected)?value:old);}}
  catch(cause){if(!current())return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(e.code);if(send)store.onChange(key,old=>old&&old.pending?.commandId===original.pending?.commandId?{...old,uncertain:original.uncertain||!isKnownDocumentRejection(e),failure:{code:e.code,status:e.status}}:old);if(e.status===401)callbacks.current.onAuthenticationLost();}
  finally{if(working.current===context)working.current=null;if(current())setBusyOwner(null);}
 }
 return <section aria-label="산출물과 고정 업무 연결"><h5>산출물과 고정 업무 연결</h5><p>사용자가 등록 파일 참조를 고정 업무에 연결합니다. bytes 검수·업무 완료·실제 산출물 출처 확인은 아닙니다.</p><p>고정 업무 {detail.confirmed?.snapshot.definition.taskRef.taskCode} · 계획 v{detail.confirmed?.snapshot.definition.taskRef.planRef.version}</p>
 <label>연결할 등록 산출물<select aria-label="연결할 등록 산출물" disabled={busy||!!buffer?.pending||!!buffer?.result} value={buffer?.selected?.id??''} onChange={e=>edit({selected:result.snapshot.manifest.artifactRefs.find((v:PlanRef)=>v.id===e.target.value&&v.version===1)??null})}><option value="">선택하세요</option>{result.snapshot.manifest.artifactRefs.map((v:PlanRef)=><option key={v.id} value={v.id} disabled={v.version!==1}>{v.id} · v{v.version}</option>)}</select></label>
 <label>연결 사유<textarea aria-label="산출물 업무 연결 사유" maxLength={20000} disabled={busy||!!buffer?.pending||!!buffer?.result} value={buffer?.reason??''} onChange={e=>edit({reason:e.target.value})}/></label>
 {!buffer?.pending&&!buffer?.result?<button disabled={busy||!buffer?.selected||!buffer?.reason.trim()} onClick={()=>void action(false)}>고정 업무 대조 후 연결 준비</button>:null}
 {buffer?.pending&&!buffer.result?<><p>원명령 {buffer.pending.commandId} · {buffer.uncertain?'결과 미확인 · 같은 명령만 확인':'연결 준비 · 아직 저장하지 않음'}</p><button disabled={busy} onClick={()=>void action(true)}>{buffer.uncertain?'같은 연결 명령 결과 확인':'산출물 업무 연결 저장'}</button>{buffer.failure&&!buffer.uncertain?<button disabled={busy} onClick={()=>update(old=>old?{...old,pending:null,designRef:null,failure:null}:old)}>거절 확인 후 입력 수정</button>:null}</>:null}
 {busy?<p role="status">연결 원문·결과 확인 중</p>:null}{error||buffer?.failure?<p role="alert">{error??buffer?.failure?.code} · 자동 재전송하지 않습니다.</p>:null}
 {buffer?.result&&buffer.designRef?<><p>연결 저장 확인 · 업무 완료/현재 실행 허가 아님</p><button onClick={()=>setShow(v=>!v)}>저장 연결 정방향·역방향 조회</button>{show?<TraceViewer client={client} projectId={detail.projectId} designRef={buffer.designRef} onAuthenticationLost={onAuthenticationLost}/>:null}</>:null}
 </section>;
}
