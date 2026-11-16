import {useLayoutEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentBuffer,DocumentSession} from './editor-api.ts';
import {listWorkPlans,readWorkPlanAtVersion,type WorkPlanPage,type WorkPlanView} from './work-plan-api.ts';
import {prepareProposalDiffTrace,sendProposalDiffTrace,type ProposalDiffTraceBuffer} from './proposal-diff-trace.ts';
import {isKnownDocumentRejection} from './mutation-result.ts';
import {TraceViewer} from './TraceViewer.tsx';

export function ProposalDiffTraceEditor({client,session,buffer,onChange,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;buffer:DocumentBuffer;onChange:Dispatch<SetStateAction<DocumentBuffer|null>>;onAuthenticationLost:()=>void}){
 const state=buffer.proposalState!,trace=state.diffTrace!,binding=JSON.stringify([buffer.ownerUserId,buffer.projectId,buffer.controlGeneration,state.bindingId,trace.source,session.user.id,session.clientId,session.csrfToken]);
 const known=useRef(new Set([buffer])),latest=useRef(buffer),owner=useRef({binding,client,transport:client.transport}),mounted=useRef(false),running=useRef<object|null>(null);
 if(owner.current.binding!==binding||owner.current.client!==client||owner.current.transport!==client.transport||!known.current.has(buffer)){owner.current={binding,client,transport:client.transport};known.current=new Set([buffer]);}latest.current=buffer;
 const scope=owner.current,eligible=buffer.ownerUserId===session.user.id&&state.restored?.clientId===session.clientId&&state.restored.projectId===buffer.projectId&&state.restored.controlGeneration===buffer.controlGeneration;
 const[busy,setBusy]=useState<object|null>(null),[error,setError]=useState<{scope:object;value:ApiError}|null>(null),[denied,setDenied]=useState<object|null>(null),[show,setShow]=useState<object|null>(null);
 const[page,setPage]=useState<{scope:object;value:WorkPlanPage}|null>(null),[selection,setSelection]=useState<{scope:object;id:string;version:string}|null>(null),[read,setRead]=useState<{scope:object;value:WorkPlanView}|null>(null);
 const plans=page?.scope===scope?page.value:null,selected=selection?.scope===scope?selection:null,plan=read?.scope===scope?read.value:null,working=busy===scope,blocked=!!trace.pending||!!trace.result||trace.uncertain;
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const live=(context=scope)=>mounted.current&&owner.current===context&&client.transport===context.transport&&eligible;
 function update(original:DocumentBuffer,change:(value:ProposalDiffTraceBuffer)=>ProposalDiffTraceBuffer){
  onChange(old=>{if(!live()||old!==original||!old.proposalState?.diffTrace)return old;const next={...old,proposalState:{...old.proposalState,diffTrace:change(old.proposalState.diffTrace)}};known.current.add(next);return next;});
 }
 function edit(change:Partial<ProposalDiffTraceBuffer>){if(working||running.current===scope||blocked||!live())return;update(buffer,t=>({...t,...change,failure:null}));}
 async function action(kind:'LIST'|'MORE'|'READ'|'PREPARE'|'SEND'){
  if(!live()||running.current===scope||denied===scope||kind!=='SEND'&&blocked||kind==='SEND'&&(!trace.pending||trace.result))return;
  const context=scope,original=buffer,command=trace.pending?.commandId;
  const active=()=>live(context)&&(kind==='SEND'?latest.current.proposalState?.diffTrace?.pending?.commandId===command:latest.current===original);
  running.current=context;setBusy(context);setError(null);
  if(kind==='SEND')update(original,t=>({...t,uncertain:true,failure:null}));
  try{
   if(kind==='LIST'||kind==='MORE'){
    if(kind==='MORE'&&!plans?.hasMore)return;
    const value=await listWorkPlans(client,buffer.projectId,kind==='MORE'?plans!.nextCursor:null);if(!active())return;
    setPage({scope:context,value:kind==='MORE'&&plans?{...value,items:[...new Map([...plans.items,...value.items].map(p=>[p.ref.id,p])).values()]}:value});
    if(kind==='LIST'){setSelection(null);setRead(null);editAfterReadClear(original);}
   }else if(kind==='READ'){
    const summary=plans?.items.find(p=>p.ref.id===selected?.id);if(!summary||!selected||!selected.version)throw new ApiError('PROPOSAL_TRACE_PLAN_REQUIRED');setRead(null);
    const value=await readWorkPlanAtVersion(client,buffer.projectId,summary.ref,Number(selected.version),active);if(!active()||!value)return;
    if(value.relationalProjection!=='STORED')throw new ApiError('TRACE_SOURCE_AMBIGUOUS',409);
    setRead({scope:context,value});update(original,t=>({...t,planRef:structuredClone(value.ref),taskCode:'',designRef:null,failure:null}));
   }else if(kind==='PREPARE'){
    const value=await prepareProposalDiffTrace(client,session,original,active);if(active())update(original,()=>value);
   }else{
    const value=await sendProposalDiffTrace(client,session,original,active);if(active())update(latest.current,t=>({...t,result:value,uncertain:false,failure:null}));
   }
  }catch(cause){if(!active())return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError({scope:context,value:e});
   if(kind==='SEND')update(latest.current,t=>({...t,uncertain:trace.uncertain||!isKnownDocumentRejection(e),failure:{code:e.code,status:e.status}}));
   if([401,403,404].includes(e.status)){setDenied(context);setPage(null);setRead(null);}if(e.status===401)onAuthenticationLost();
  }finally{if(running.current===context)running.current=null;if(live(context))setBusy(null);}
 }
 function editAfterReadClear(original:DocumentBuffer){update(original,t=>({...t,planRef:null,taskCode:'',designRef:null,failure:null}));}
 const canClose=!working&&(!trace.pending||!!trace.result||!!trace.failure&&!trace.uncertain);
 return <section aria-label="문서 제안 diff와 고정 업무 연결"><h2>문서 제안 diff와 고정 업무 연결</h2><p>서버가 생성한 문서 변경 구간을 사람이 고정 계획 업무에 연결합니다. 실제 Git diff·시험 출처·구현 완료의 증거가 아닙니다.</p>
 {eligible&&denied!==scope?<><p>제안 {trace.source.proposalId} · 기준 문서 v{trace.source.baseRef.version}</p><p>diff {trace.source.diffRef.artifactId} · SHA256 {trace.source.diffRef.contentHash}</p><pre aria-label="연결할 서버 생성 diff">{JSON.stringify(state.comparison?.diff,null,2)}</pre>
 {!blocked?<><button disabled={working} onClick={()=>void action('LIST')}>고정 계획 목록 조회</button>{plans?<><label>연결할 계획<select aria-label="연결할 고정 계획" disabled={working} value={selected?.id??''} onChange={e=>{setSelection({scope,id:e.target.value,version:''});setRead(null);edit({planRef:null,taskCode:'',designRef:null});}}><option value="">계획 선택</option>{plans.items.map(p=><option key={p.ref.id} value={p.ref.id}>{p.title} · 관측 v{p.ref.version}</option>)}</select></label><label>고정 버전<input aria-label="연결할 계획 버전" type="number" min="1" max={plans.items.find(p=>p.ref.id===selected?.id)?.ref.version} disabled={working||!selected?.id} value={selected?.version??''} onChange={e=>{if(!selected)return;setSelection({...selected,version:e.target.value});setRead(null);edit({planRef:null,taskCode:'',designRef:null});}}/></label><button disabled={working||!selected?.id||!selected.version} onClick={()=>void action('READ')}>선택한 계획 버전 읽기</button>{plans.hasMore?<button disabled={working} onClick={()=>void action('MORE')}>다음 고정 계획 더 보기</button>:null}</>:null}
 {plan?<><p>읽은 계획 {plan.ref.id} · v{plan.ref.version} · SHA256 {plan.ref.contentHash}</p><label>고정 업무<select aria-label="연결할 고정 업무" disabled={working} value={trace.taskCode} onChange={e=>edit({taskCode:e.target.value})}><option value="">업무 선택</option>{plan.tasks.map((t,n)=><option key={t.taskCode+':'+n} value={t.taskCode} disabled={plan.tasks.filter(v=>v.taskCode===t.taskCode).length!==1}>{t.taskCode} · {t.title}</option>)}</select></label></>:null}
 <label>연결 사유<textarea aria-label="제안 diff 연결 사유" disabled={working} maxLength={20000} value={trace.reason} onChange={e=>edit({reason:e.target.value})}/></label><button disabled={working||!trace.planRef||!trace.taskCode||!trace.reason.trim()} onClick={()=>void action('PREPARE')}>원문·고정 업무 대조 후 연결 준비</button></>:null}
 {trace.pending&&!trace.result?<><p>원명령 {trace.pending.commandId} · {trace.uncertain?'결과 미확인 · 같은 명령만 재확인':'아직 저장 전'}</p><p>계획 {trace.planRef?.id} · v{trace.planRef?.version} · {trace.taskCode}</p><button disabled={working} onClick={()=>void action('SEND')}>{trace.uncertain?'같은 diff 연결 명령 결과 확인':'제안 diff 업무 연결 저장'}</button>{trace.failure&&!trace.uncertain?<button disabled={working} onClick={()=>update(buffer,t=>({...t,pending:null,designRef:null,failure:null}))}>거절 확인 후 연결 입력 수정</button>:null}</>:null}
 {trace.result&&trace.designRef?<><p role="status">제안 diff 업무 연결 저장 확인 · 업무 완료 아님</p><button onClick={()=>setShow(v=>v===scope?null:scope)}>저장한 diff 연결 조회</button>{show===scope?<TraceViewer client={client} projectId={buffer.projectId} designRef={trace.designRef} onAuthenticationLost={onAuthenticationLost}/>:null}</>:null}</>:<p>현재 주체의 보호 접근을 확인할 수 없어 상세를 숨겼습니다. 원명령은 보존됩니다.</p>}
 {working?<p role="status">제안 diff 연결 확인 중</p>:null}{error?.scope===scope||trace.failure?<p role="alert">{error?.scope===scope?error.value.code:trace.failure?.code} · 자동 재전송하지 않습니다.</p>:null}
 <button disabled={!canClose} onClick={()=>onChange(old=>live()&&old===buffer?null:old)}>diff 연결 작업 닫기</button></section>;
}
