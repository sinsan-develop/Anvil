import{useEffect,useRef,useState}from'react';import{ApiClient,ApiError}from'../../api/client.ts';import{documentControl,type DocumentSession}from'../design-trace/editor-api.ts';import{isKnownDocumentRejection}from'../design-trace/mutation-result.ts';import{prepareKnowledgeDecision,sendKnowledgeDecision,readSavedKnowledgeConfirmation,readSavedKnowledgeReview,newKnowledgeDecision,retireRejectedKnowledgeReview,type KnowledgeDecisionBuffer,type KnowledgeDecisionChange}from'./decision-api.ts';import{knowledgeOutcomes,ordered,type KnowledgeOutcome}from'./review-view.ts';
const labels={ACCEPTED:'적합',REWORK:'보완 필요',BLOCKED:'판단 불가',NOT_EXECUTED:'미검토'};
export function KnowledgeDecisionForm({client,session,buffer,onChange,onSaved,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;buffer:KnowledgeDecisionBuffer;onChange:(change:KnowledgeDecisionChange)=>void;onSaved:(result:Awaited<ReturnType<typeof sendKnowledgeDecision>>)=>void;onAuthenticationLost:()=>void}){
 const[working,setWorking]=useState(false),alive=useRef(true),locked=useRef(false);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const[reopenError,setReopenError]=useState<string|null>(null),reopening=useRef(false),current=useRef({client,session,buffer,onChange,working});current.current={client,session,buffer,onChange,working};
 const identity=[client,client.transport,session.user.id,session.clientId,session.csrfToken,buffer.projectId],owner=useRef({identity});
 if(identity.some((value,index)=>value!==owner.current.identity[index]))owner.current={identity};
 const captured=owner.current,context=()=>owner.current===captured&&[current.current.client,client.transport,current.current.session.user.id,current.current.session.clientId,current.current.session.csrfToken,current.current.buffer.projectId].every((value,index)=>value===captured.identity[index]);
 if(buffer.ownerUserId!==session.user.id||buffer.ownerClientId!==session.clientId)return<p role="alert">다른 사용자·기기의 판단 요청은 열거나 전송하지 않습니다.</p>;
 function edit(p:Partial<KnowledgeDecisionBuffer>){if(working||buffer.pending||buffer.savedId)return;onChange({...buffer,...p,dirty:true,failure:null});}
 async function save(){
  if(locked.current||buffer.savedId)return;locked.current=true;setWorking(true);let b=buffer;
  const owned=new WeakSet([buffer]);
  const active=()=>alive.current&&context()&&owned.has(current.current.buffer);
  // 동일 문맥의 원 dispatch 결과는 화면 이탈 뒤에도 보존한다. 부모의 지연 updater에서도 세대를 다시 확인한다.
  const publish=(next:KnowledgeDecisionBuffer)=>{owned.add(next);onChange(previous=>context()&&previous&&owned.has(previous)?next:previous);};
  try{
   if(!b.pending){const pending=await prepareKnowledgeDecision(b,session);if(!active())return;b={...b,pending};publish(b);}
   // 같은 명령 재확인도 이번 dispatch의 버퍼 객체로 결박한다.
   if(!active())return;b={...b};publish(b);
   const result=await sendKnowledgeDecision(client,b,session,active);
   const applicationReceipt=result.kind==='APPLY'?{ref:{...result.applicationRef},commandId:b.pending!.commandId,ownerUserId:session.user.id,ownerClientId:session.clientId,csrfToken:session.csrfToken}:undefined;
   b={...b,pending:null,savedId:result.id,dirty:false,uncertain:false,failure:null,...(applicationReceipt?{applicationReceipt}:{})};publish(b);
   if(active())onSaved(result);
  }catch(e){const a=e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');if(a.code==='KNOWLEDGE_DECISION_PAUSED'&&!active())return;publish({...b,failure:{code:a.code,status:a.status},uncertain:b.uncertain||a.code!=='KNOWLEDGE_DECISION_PAUSED'&&!isKnownDocumentRejection(a)});if(a.status===401&&active())onAuthenticationLost();}
  finally{locked.current=false;if(alive.current)setWorking(false);}
 }
 async function reopenRejectedReview(){
  if(reopening.current||!alive.current||locked.current||working||buffer.kind!=='REVIEW'||buffer.uncertain||buffer.savedId||!buffer.pending||!isKnownDocumentRejection(buffer.failure))return;
  const fingerprint=ordered(buffer),sessionFingerprint=ordered(session);
  const same=(previous:KnowledgeDecisionBuffer|null=buffer)=>{const now=current.current;try{return alive.current&&!locked.current&&!now.working&&now.client===client&&now.session===session&&now.onChange===onChange&&now.buffer===buffer&&previous===buffer&&ordered(previous)===fingerprint&&ordered(now.session)===sessionFingerprint;}catch{return false;}};
  if(!same())return;reopening.current=true;
  try{
   const next=await retireRejectedKnowledgeReview(buffer,session);
   if(!same()||!confirm('명확히 거절된 지식 검토 명령과 실패는 이력에 보관하고 입력을 다시 열까요? 다섯 항목 판단과 이유·원래 대상·제어 세대는 보존하며 새 저장은 별도로 선택해야 합니다.')||!same())return;
   onChange(previous=>same(previous)?next:previous);if(same())setReopenError(null);
  }catch(e){if(same())setReopenError(e instanceof ApiError?e.code:'RESPONSE_INVALID');}finally{reopening.current=false;}
 }
 function close(){if(working||buffer.uncertain||buffer.pending&&!isKnownDocumentRejection(buffer.failure))return;if((buffer.dirty||buffer.pending)&&!confirm('판단 입력과 명확히 거절된 명령만 닫을까요? 저장된 원문과 검토·확정 이력은 보존합니다.'))return;onChange(null);}
 const review=buffer.kind==='REVIEW',apply=buffer.kind==='APPLY';return<section aria-label="지식 검토·확정 요청"><h3>{review?'내용 검토':apply?'헌법 프로젝트 적용':'별도 확정'}: {buffer.target.entry.title} · v{buffer.target.ref.version}</h3><pre aria-label="판단 대상 지식 원문">{buffer.target.body}</pre><p>{review?'항목별로 직접 판단한 이유를 남기세요. 검토 저장은 확정이나 독립 인수 검사가 아닙니다.':apply?'이 확정 헌법을 프로젝트 기준으로 별도 적용합니다. Agent 전달·준수 판정·업무 실행은 하지 않습니다.':'현재 버전과 최신 적합 검토에 대한 별도 확정입니다. 헌법 적용·Agent 전달을 실행하지 않습니다.'}</p>
 <fieldset disabled={working||!!buffer.pending||!!buffer.savedId}>{review?<>{buffer.target.contentReviewCriteria!.items.map((criterion,n)=><section key={criterion.criterionId}><h4>{criterion.title}</h4><label>결과<select aria-label={`지식 항목 ${n+1} 결과`} value={buffer.items[n]!.outcome} onChange={e=>edit({items:buffer.items.map((i,k)=>k===n?{...i,outcome:e.target.value as KnowledgeOutcome}:i)})}>{knowledgeOutcomes.map(o=><option key={o} value={o}>{labels[o]}</option>)}</select></label><label>판단 근거<textarea aria-label={`지식 항목 ${n+1} 이유`} rows={2} maxLength={20000} value={buffer.items[n]!.reason} onChange={e=>edit({items:buffer.items.map((i,k)=>k===n?{...i,reason:e.target.value}:i)})}/></label></section>)}<label>종합 결과<select aria-label="지식 종합 결과" value={buffer.outcome} onChange={e=>edit({outcome:e.target.value as KnowledgeOutcome})}>{knowledgeOutcomes.map(o=><option key={o} value={o}>{labels[o]}</option>)}</select></label></>:<><p>최신 검토: {buffer.target.contentReviews?.[0]?.ref.id} · 적합</p><label><input type="checkbox" checked={buffer.acknowledged} onChange={e=>edit({acknowledged:e.target.checked})}/>{apply?'이 확정 헌법을 프로젝트 기준으로 적용':'이 버전과 검토를 확인하고 지식만 확정'}</label></>}
 <label>판단 이유<textarea aria-label="지식 판단 이유" maxLength={20000} rows={3} value={buffer.reason} onChange={e=>edit({reason:e.target.value})}/></label></fieldset>
 {buffer.rejectedAttempts?.length?<details open><summary>거절된 지식 검토 입력 보관</summary><pre aria-label="거절된 지식 검토 명령 이력">{JSON.stringify(buffer.rejectedAttempts,null,2)}</pre></details>:null}
 {reopenError?<p role="alert">{reopenError}</p>:null}
 {review&&!working&&!buffer.savedId&&!buffer.uncertain&&buffer.pending&&isKnownDocumentRejection(buffer.failure)?<button type="button" onClick={()=>void reopenRejectedReview()}>거절된 지식 검토 명령 보관하고 입력 다시 열기</button>:null}
 <button type="button" disabled={working||!!buffer.savedId||!buffer.reason.trim()||(review?buffer.items.some(i=>!i.reason.trim()):!buffer.acknowledged)} onClick={()=>void save()}>{buffer.pending?'같은 지식 판단 명령 결과 확인':review?'지식 검토 저장':apply?'헌법 프로젝트 적용':'지식 확정 저장'}</button><button type="button" disabled={working||buffer.uncertain||!!buffer.pending&&!isKnownDocumentRejection(buffer.failure)} onClick={close}>지식 판단 닫기</button>
 {buffer.failure?<p role="alert">{buffer.failure.code}{buffer.uncertain?' · 결과 미확인: 원래 명령과 판단을 보존합니다.':''}</p>:null}{buffer.savedId?<p role="status">{review?'지식 검토 저장 확인':apply?'헌법 프로젝트 적용 확인':'지식 확정 저장 확인'} · 원문·이력 보존</p>:null}{buffer.kind==='REVIEW'&&buffer.savedId&&!buffer.pending&&!buffer.uncertain&&!buffer.dirty&&!buffer.failure?<KnowledgeReviewReceipt client={client} session={session} buffer={buffer} onChange={onChange} onAuthenticationLost={onAuthenticationLost}/>:null}{buffer.kind==='CONFIRM'&&buffer.savedId&&!buffer.pending&&!buffer.uncertain&&!buffer.dirty&&!buffer.failure?<KnowledgeConfirmationReceipt client={client} session={session} buffer={buffer} onAuthenticationLost={onAuthenticationLost}/>:null}</section>;
}

function KnowledgeReviewReceipt({client,session,buffer,onChange,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;buffer:KnowledgeDecisionBuffer;onChange:(change:KnowledgeDecisionChange)=>void;onAuthenticationLost:()=>void}){
 const fingerprint=ordered(buffer),sessionFingerprint=ordered(session),identity=[client,client.transport,session,sessionFingerprint,buffer,fingerprint],scope=useRef({identity});
 const handoff=useRef<{owner:object;previous:KnowledgeDecisionBuffer;next:KnowledgeDecisionBuffer;fingerprint:string;sessionFingerprint:string;transport:ApiClient['transport']}|null>(null);
 if(identity.some((value,index)=>value!==scope.current.identity[index])){scope.current={identity};handoff.current=null;}
 const owner=scope.current,alive=useRef(true),lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;handoff.current=null;};},[]);
 type Request={owner:typeof owner;kind:'READ'|'SELECT'};type Result=Awaited<ReturnType<typeof readSavedKnowledgeReview>>;
 const flight=useRef<Request|null>(null),[state,setState]=useState<{request:Request;pending:boolean;result:Result|null;error:string|null}|null>(null);
 const shown=state?.request.owner===owner?state:null;
 const active=(request:Request)=>alive.current&&scope.current===owner&&flight.current===request&&client.transport===owner.identity[1]&&ordered(buffer)===fingerprint&&ordered(session)===sessionFingerprint;
 async function read(){
  if(flight.current?.owner===owner||scope.current!==owner)return;const request={owner,kind:'READ' as const};flight.current=request;if(!active(request)){flight.current=null;return;}
  setState({request,pending:true,result:null,error:null});
  try{const result=await readSavedKnowledgeReview(client,buffer,session,()=>active(request));if(active(request))setState({request,pending:false,result,error:null});}
  catch(error){if(active(request)){const e=error instanceof ApiError?error:new ApiError('RESPONSE_INVALID');setState({request,pending:false,result:null,error:/^[A-Z_]{1,80}$/.test(e.code)?e.code:'RESPONSE_INVALID'});if(e.status===401)lost.current();}}
  finally{if(flight.current===request)flight.current=null;}
 }
 async function select(){
  const result=shown?.result;if(!result?.confirmationEligible||flight.current?.owner===owner||scope.current!==owner)return;const request={owner,kind:'SELECT' as const};flight.current=request;if(!active(request)){flight.current=null;return;}
  setState({request,pending:true,result,error:null});
  try{const generation=await documentControl(client,buffer.projectId,session);if(!active(request))return;const next=newKnowledgeDecision(buffer.projectId,result.view,session,generation,'CONFIRM'),transfer={owner,previous:buffer,next,fingerprint,sessionFingerprint,transport:client.transport};handoff.current=transfer;onChange(previous=>handoff.current===transfer&&alive.current&&scope.current===transfer.owner&&client.transport===transfer.transport&&previous===transfer.previous&&ordered(previous)===transfer.fingerprint&&ordered(session)===transfer.sessionFingerprint?transfer.next:previous);}
  catch(error){if(active(request)){const e=error instanceof ApiError?error:new ApiError('RESPONSE_INVALID');setState({request,pending:false,result,error:/^[A-Z_]{1,80}$/.test(e.code)?e.code:'RESPONSE_INVALID'});if(e.status===401)lost.current();}}
  finally{if(flight.current===request)flight.current=null;}
 }
 function close(){if(scope.current!==owner)return;flight.current=null;handoff.current=null;setState(null);}
 const result=shown?.result;
 return<section aria-label="지식 검토 영수증 대조">
  <button type="button" disabled={!!shown?.pending} onClick={()=>void read()}>저장된 지식 검토 사건 조회</button>
  {shown?<button type="button" onClick={close}>검토 사건 조회 닫기</button>:null}
  {shown?.pending?<p role="status">저장된 검토 사건 조회 중</p>:null}
  {shown?.error?<p role="alert">{shown.error} · 검토 사건 조회 미확인. 원 저장 영수증을 보존하며 다시 조회할 수 있습니다.</p>:null}
  {result?<section aria-label="저장된 지식 검토 사건"><dl>
   <dt>검토 사건</dt><dd>{result.review.ref.id}</dd><dt>고정 지식 참조</dt><dd>{result.view.ref.id} · v{result.view.ref.version} · {result.view.ref.contentHash}</dd>
   <dt>검토 기준</dt><dd>v{result.review.criteria.criteriaVersion} · {result.review.criteria.knowledgeKind}</dd><dt>종합 판단</dt><dd>{result.review.ref.outcome} · {result.review.reason}</dd>
   <dt>검토 주체</dt><dd>{result.review.reviewer.kind} · {result.review.reviewer.userId} · 원 기록자 동일 {String(result.review.reviewer.sameAsTargetRecorder)}</dd>
   <dt>검토 시각·순서</dt><dd><time dateTime={result.review.reviewedAt}>{result.review.reviewedAt}</time> · {result.review.serverSequence}</dd>
   <dt>항목 판단</dt><dd>{result.review.items.map(item=><p key={item.criterionId}>{item.criterionId} · {item.outcome} · {item.reason} · {item.evidenceRefs.length?item.evidenceRefs.join(', '):'근거 없음'}</p>)}</dd>
  </dl><p>원 저장 영수증과 일치한 검토 사건입니다. 현재 확정·적용·Agent 전달을 뜻하지 않습니다.</p>{result.confirmationEligible?<button type="button" disabled={!!shown.pending} onClick={()=>void select()}>이 검토로 지식 별도 확정 준비</button>:<p>과거·부적합·최신이 아닌 검토는 확인만 하며 확정 준비로 선택하지 않습니다.</p>}</section>:null}
 </section>;
}

function KnowledgeConfirmationReceipt({client,session,buffer,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;buffer:KnowledgeDecisionBuffer;onAuthenticationLost:()=>void}){
 const fingerprint=ordered(buffer),sessionFingerprint=ordered(session),identity=[client,client.transport,session,sessionFingerprint,buffer,fingerprint],scope=useRef({identity});
 if(identity.some((value,index)=>value!==scope.current.identity[index]))scope.current={identity};
 const owner=scope.current,alive=useRef(true),lost=useRef(onAuthenticationLost);lost.current=onAuthenticationLost;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 type Request={owner:typeof owner};type Result=Awaited<ReturnType<typeof readSavedKnowledgeConfirmation>>;
 const flight=useRef<Request|null>(null),[state,setState]=useState<{request:Request;pending:boolean;result:Result|null;error:string|null}|null>(null);
 const shown=state?.request.owner===owner?state:null;
 async function read(){
  if(flight.current?.owner===owner||scope.current!==owner)return;
  const request={owner};flight.current=request;
  const active=()=>alive.current&&scope.current===owner&&flight.current===request&&client.transport===owner.identity[1]&&ordered(buffer)===fingerprint&&ordered(session)===sessionFingerprint;
  if(!active()){flight.current=null;return;}
  setState({request,pending:true,result:null,error:null});
  try{const result=await readSavedKnowledgeConfirmation(client,buffer,session,active);if(active())setState({request,pending:false,result,error:null});}
  catch(error){if(active()){const e=error instanceof ApiError?error:new ApiError('RESPONSE_INVALID');setState({request,pending:false,result:null,error:/^[A-Z_]{1,80}$/.test(e.code)?e.code:'RESPONSE_INVALID'});if(e.status===401)lost.current();}}
  finally{if(flight.current===request)flight.current=null;}
 }
 function close(){if(scope.current!==owner)return;flight.current=null;setState(null);}
 const result=shown?.result;
 return<section aria-label="지식 확정 영수증 대조">
  <button type="button" disabled={!!shown?.pending} onClick={()=>void read()}>저장된 지식 확정 사건 조회</button>
  {shown?<button type="button" onClick={close}>확정 사건 조회 닫기</button>:null}
  {shown?.pending?<p role="status">저장된 확정 사건 조회 중</p>:null}
  {shown?.error?<p role="alert">{shown.error} · 확정 사건 조회 미확인. 원 저장 영수증을 보존하며 다시 조회할 수 있습니다.</p>:null}
  {result?<section aria-label="저장된 지식 확정 사건"><dl>
   <dt>확정 사건</dt><dd>{result.confirmation.eventId}</dd>
   <dt>고정 지식 참조</dt><dd>{result.ref.id} · v{result.ref.version} · {result.ref.contentHash}</dd>
   <dt>확정 이유</dt><dd>{result.confirmation.reason}</dd>
   <dt>확정 주체</dt><dd>{result.confirmation.actorRef.kind} · {result.confirmation.actorRef.userId}</dd>
   <dt>당시 선택 검토</dt><dd>{result.confirmation.reviewRefs.map(ref=><p key={ref.id}>{ref.id} · 기준 v{ref.criteriaVersion} · {ref.outcome} · {ref.targetRef.id} · v{ref.targetRef.version} · {ref.targetRef.contentHash}</p>)}</dd>
   <dt>기록 시각</dt><dd><time dateTime={result.confirmation.recordedAt}>{result.confirmation.recordedAt}</time></dd>
  </dl><p>원 저장 영수증과 일치한 당시 확정 사건입니다. 현재 유효성·헌법 적용·Agent 전달을 뜻하지 않습니다.</p></section>:null}
 </section>;
}
