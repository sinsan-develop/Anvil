import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {readDocument,type DocumentSummary} from './api.ts';
import {getPinnedForm} from '../methodologies/forms-api.ts';
import type {DocumentBuffer,DocumentSession} from './editor-api.ts';
import {readDesignIndex} from './design-index-api.ts';
import {blankPlanTask,prepareWorkPlan,sendWorkPlan,readWorkPlan,type WorkPlanBuffer} from './work-plan-api.ts';
import {documentMutationUncertain,isKnownDocumentRejection} from './mutation-result.ts';
import type {TaskCard,PlanTraceRef} from '../../../../server/modules/traceability/work-plan-card.ts';

const listFields=[['inputs','입력'],['outputs','출력'],['included','포함 범위'],['excluded','제외 범위'],['allowedFileRefs','허용 파일'],['startPrerequisites','착수 선행'],['acceptancePrerequisites','검수 선행'],['steps','수행 절차'],['acceptanceCriteria','검수 조건'],['evidenceRequirements','증거 요구']]as const;
const lines=(s:string)=>s===''?[]:s.split('\n');
export function WorkPlanEditor({client,session,buffer,documents,onChange,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;buffer:DocumentBuffer;documents:DocumentSummary[];onChange:Dispatch<SetStateAction<DocumentBuffer|null>>;onAuthenticationLost:()=>void}){
  const s=buffer.workPlanState!,[busy,setBusy]=useState(false),[reread,setReread]=useState(false),mounted=useRef(true),running=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const locked=busy||!!s.pending||!!s.result;
  function update(change:(s:WorkPlanBuffer)=>WorkPlanBuffer,dirty=true){onChange(b=>b?.ownerUserId===session.user.id&&b.projectId===buffer.projectId&&b.workPlanState?.bindingId===s.bindingId?{...b,workPlanState:change(b.workPlanState),dirty:dirty||b.dirty}:b);}
  function input(change:(s:WorkPlanBuffer['input'])=>WorkPlanBuffer['input']){if(!locked)update(v=>({...v,input:change(v.input),failure:null}));}
  function task(n:number,patch:Partial<TaskCard>){input(v=>({...v,tasks:v.tasks.map((t,k)=>k===n?{...t,...patch}:t)}));}
  function failure(cause:unknown,mutation=false){const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');update(v=>({...v,failure:{code:e.code,status:e.status},uncertain:mutation?documentMutationUncertain(v.uncertain,e):v.uncertain}),false);if(mounted.current&&e.status===401)onAuthenticationLost();}
  async function loadDesign(){
    if(locked||running.current)return;
    if(s.input.tasks.some(t=>t.designRefs.length||t.screenRefs.length)){failure(new ApiError('WORK_PLAN_DESIGN_LINKS_PRESENT',422));return;}
    if(!s.designDocumentId||!/^[1-9][0-9]{0,14}$/.test(s.designVersion)){failure(new ApiError('WORK_PLAN_INPUT_INVALID',422));return;}
    running.current=true;setBusy(true);const id=s.designDocumentId,version=s.designVersion;
    try{const d=await readDocument(client,buffer.projectId,id,Number(version)),form=await getPinnedForm(client,d.document.formRef);if(form.definition.formCode!=='AF02')throw new ApiError('DESIGN_DOCUMENT_KIND_INVALID',422);const ref={id,version:Number(version),contentHash:d.document.contentHash},index=await readDesignIndex(client,buffer.projectId,ref);if(mounted.current)update(v=>v.designDocumentId===id&&v.designVersion===version?{...v,designIndex:index,input:{...v.input,designRef:ref},failure:null}:v);}
    catch(e){failure(e);}finally{running.current=false;if(mounted.current)setBusy(false);}
  }
  async function save(){
    if(running.current||s.result)return;running.current=true;setBusy(true);let next=s;
    try{if(!next.pending){next={...next,pending:prepareWorkPlan(buffer,session),failure:null};const captured=next;update(()=>captured);}const result=await sendWorkPlan(client,{...buffer,workPlanState:next},session,()=>mounted.current),id=next.pending!.commandId;onChange(b=>b?.ownerUserId===session.user.id&&b.projectId===buffer.projectId&&b.workPlanState?.pending?.commandId===id?{...b,dirty:false,workPlanState:{...b.workPlanState,result,failure:null,uncertain:false}}:b);}
    catch(e){failure(e,!!next.pending);}finally{running.current=false;if(mounted.current)setBusy(false);}
  }
  async function reload(){if(running.current||!s.result)return;running.current=true;setBusy(true);setReread(false);try{const value=await readWorkPlan(client,buffer.projectId,s.result.ref);if(mounted.current){update(v=>({...v,result:value,failure:null}),false);setReread(true);}}catch(e){failure(e);}finally{running.current=false;if(mounted.current)setBusy(false);}}
  function link(n:number,kind:PlanTraceRef['kind'],id:string,checked:boolean){
    if(!s.designIndex)return;const item=kind==='DESIGN_ITEM'?s.designIndex.items.find(i=>i.id===id):s.designIndex.screenRegions.find(i=>i.id===id);if(!item)return;
    const link:PlanTraceRef={kind,id,versionRef:item.documentRef,localCode:kind==='DESIGN_ITEM'?'localCode'in item?item.localCode:'':'screenCode'in item?item.screenCode:'',anchor:item.anchor},field=kind==='DESIGN_ITEM'?'designRefs':'screenRefs',t=s.input.tasks[n]!;
    task(n,{[field]:checked?[...t[field],link]:t[field].filter(i=>i.id!==id)});
  }
  const canClose=!s.uncertain&&(!s.pending||!!s.result||isKnownDocumentRejection(s.failure));
  return <section className="status-card definition-editor" aria-label="작업계획 작성"><h2>작업계획 작성</h2><p>{buffer.title} · 원문 v{s.input.documentRef.version}</p><p className="meta">원문은 바꾸지 않습니다. 화면·기능·연결·준비 업무를 구분하고 착수 선행과 검수 선행을 따로 작성합니다. 계획 저장은 확정·실행·완료가 아닙니다. 허용 파일은 계획 선언이며 실제 접근 권한이 아닙니다.</p><pre aria-label="계획 기준 원문" className="document-original">{buffer.body}</pre>
    {s.planRef?<p>같은 계획의 새 개정 · 기준 v{s.planRef.version}</p>:null}
    {s.failure?<p role="alert">{new ApiError(s.failure.code,s.failure.status).message} · {s.failure.code} · 입력/명령 보존, 조회 실패 시 앞선 결과는 과거 자료입니다.</p>:null}
    <fieldset disabled={locked}><legend>설계 기준</legend><label htmlFor="plan-design-document">기준 설계 문서</label><select id="plan-design-document" value={s.designDocumentId} onChange={e=>{const d=documents.find(i=>i.id===e.target.value);update(v=>({...v,designDocumentId:e.target.value,designVersion:String(d?.headVersion??1)}));}}><option value="">문서 선택</option>{documents.map(d=><option key={d.id} value={d.id}>{d.title} · v{d.headVersion}</option>)}</select><label>기준 설계 버전<input type="number" min="1" value={s.designVersion} onChange={e=>update(v=>({...v,designVersion:e.target.value}))}/></label><button onClick={()=>{void loadDesign();}}>기준 설계 항목 확인</button>{s.input.designRef?<p>고정 설계 {s.input.designRef.id} · v{s.input.designRef.version} · SHA256 {s.input.designRef.contentHash}</p>:null}<p className="meta">다른 설계 기준으로 교체하려면 기존 D/S 선택을 먼저 명시 해제하세요. 화면 검토 선택·계획 확정/배정은 아직 미연결이며 부족 조건은 초안 문제로 남습니다.</p></fieldset>
    {s.input.tasks.map((t,n)=><fieldset key={n} disabled={locked}><legend>업무 {n+1}</legend>
      <label>업무 {n+1} 코드<input maxLength={64} value={t.taskCode} onChange={e=>task(n,{taskCode:e.target.value})}/></label><label htmlFor={'plan-type-'+n}>업무 {n+1} 유형</label><select id={'plan-type-'+n} value={t.type} onChange={e=>task(n,{type:e.target.value as TaskCard['type']})}><option value="SCREEN">화면</option><option value="FUNCTION">기능</option><option value="INTEGRATION">연결·통합</option><option value="PREPARATION">준비</option></select>
      {([['title','제목'],['purpose','목적'],['ownerRole','책임 역할']]as const).map(([k,label])=><label key={k}>업무 {n+1} {label}<input maxLength={k==='title'?200:20_000} value={t[k]} onChange={e=>task(n,{[k]:e.target.value})}/></label>)}
      <div>실제 설계·화면 위치 연결{s.designIndex?.items.map(i=><label key={i.id}><input type="checkbox" checked={t.designRefs.some(r=>r.id===i.id)} aria-label={`업무 ${n+1} 설계 ${i.localCode}`} onChange={e=>link(n,'DESIGN_ITEM',i.id,e.target.checked)}/>{i.localCode} · {i.title} · {i.anchor}</label>)}{s.designIndex?.screenRegions.map(i=><label key={i.id}><input type="checkbox" checked={t.screenRefs.some(r=>r.id===i.id)} aria-label={`업무 ${n+1} 화면 ${i.screenCode}`} onChange={e=>link(n,'SCREEN_REGION',i.id,e.target.checked)}/>{i.screenCode} · v{i.documentRef.version} · {i.anchor}</label>)}</div>
      {listFields.map(([k,label])=><div key={k}><label htmlFor={`plan-${n}-${k}`}>업무 {n+1} {label}</label><textarea id={`plan-${n}-${k}`} aria-describedby={`plan-${n}-${k}-help`} maxLength={20_000} value={t[k].join('\n')} onChange={e=>task(n,{[k]:lines(e.target.value)})}/><small id={`plan-${n}-${k}-help`}>한 줄에 한 항목{k==='startPrerequisites'||k==='acceptancePrerequisites'?' · 같은 계획의 업무 코드':''}</small></div>)}
      <h3>검증 계획</h3>{t.testCases.map((c,k)=><section key={k}><label>업무 {n+1} 시험 {k+1} 코드<input value={c.id} maxLength={64} onChange={e=>task(n,{testCases:t.testCases.map((v,j)=>j===k?{...v,id:e.target.value}:v)})}/></label><label htmlFor={`plan-case-${n}-${k}`}>업무 {n+1} 시험 {k+1} 구분</label><select id={`plan-case-${n}-${k}`} value={c.kind} onChange={e=>task(n,{testCases:t.testCases.map((v,j)=>j===k?{...v,kind:e.target.value as typeof c.kind}:v)})}><option value="NORMAL">정상</option><option value="IMPORTANT_FAILURE">중요 실패</option><option value="DIRECT_IMPACT">직접 영향</option></select>{(['steps','expected','environment']as const).map(f=><label key={f}>업무 {n+1} 시험 {k+1} {f==='steps'?'절차':f==='expected'?'기대 결과':'환경'}<textarea value={f==='steps'?c.steps.join('\n'):c[f]} maxLength={20_000} onChange={e=>task(n,{testCases:t.testCases.map((v,j)=>j===k?{...v,[f]:f==='steps'?lines(e.target.value):e.target.value}:v)})}/></label>)}<button onClick={()=>task(n,{testCases:t.testCases.filter((_,j)=>j!==k)})}>업무 {n+1} 시험 {k+1} 제거</button></section>)}<button disabled={t.testCases.length>=200} onClick={()=>task(n,{testCases:[...t.testCases,{id:'',kind:'NORMAL',steps:[],expected:'',environment:''}]})}>업무 {n+1} 시험 추가</button>
      <label>업무 {n+1} 복구 방법<textarea value={t.rollback} maxLength={20_000} onChange={e=>task(n,{rollback:e.target.value})}/></label><label>업무 {n+1} 재개 유의사항<textarea value={t.recoveryNotes} maxLength={20_000} onChange={e=>task(n,{recoveryNotes:e.target.value})}/></label><button onClick={()=>input(v=>({...v,tasks:v.tasks.filter((_,k)=>k!==n)}))}>업무 {n+1} 제거</button>
    </fieldset>)}<button disabled={locked||s.input.tasks.length>=200} onClick={()=>input(v=>({...v,tasks:[...v.tasks,blankPlanTask()]}))}>업무 추가</button>
    <label>작업계획 저장 이유<textarea value={s.input.reason} readOnly={locked} maxLength={20_000} onChange={e=>input(v=>({...v,reason:e.target.value}))}/></label><button disabled={busy||!!s.result} onClick={()=>{void save();}}>{s.pending?'같은 작업계획 명령 결과 확인':'작업계획 초안 저장'}</button><button disabled={busy||!canClose} onClick={()=>{if(!buffer.dirty||confirm('미저장 작업계획 입력을 버리고 닫을까요?'))onChange(b=>b?.workPlanState?.bindingId===s.bindingId?null:b);}}>작업계획 작성 닫기</button>
    {s.result?<section aria-label="저장한 작업계획"><p role="status">작업계획 초안 저장 확인 · 실행/완료 아님</p><p>계획 {s.result.ref.id} v{s.result.ref.version} · SHA256 {s.result.ref.contentHash}</p><button disabled={busy} onClick={()=>{void reload();}}>저장한 작업계획 재조회</button>{reread?<p>저장한 버전 재조회 확인</p>:null}<ul>{s.result.issues.map((i,n)=><li key={n}>{i.message} · {i.code} · {i.location}</li>)}</ul><p>실제 실행/시험 증거: 미연결</p></section>:null}
  </section>;
}
