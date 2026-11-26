import assert from 'node:assert/strict';
import {test,before,after} from 'node:test';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {fixture as activationFixture,pid,actor,id,at} from '../FN04/baseline-activation-fixture.ts';
import {activationHash,newDesignActivation,prepareDesignActivation,type ActivationInput} from '../../../apps/web/src/features/design-change/activation-api.ts';
import type {ApprovalView} from '../../../apps/web/src/features/decisions/api.ts';
import {workPlanReviewCriteria} from '../../../apps/server/modules/traceability/work-plan-reviews.ts';
import {analyzeWorkPlanCards} from '../../../apps/server/modules/traceability/work-plan-card.ts';
const nodes=(n:MemoryNode):MemoryNode[]=>[n,...n.childNodes.flatMap(nodes)];
type ApprovalFixture=ApprovalView&{decision:NonNullable<ApprovalView['decision']>;consumption:NonNullable<ApprovalView['consumption']>;
 candidateActivation:{payload:ActivationInput}};
async function settle(check:()=>boolean){for(let i=0;i<80;i++){if(check())return;await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});}assert.fail('RAM 정착 실패');}
async function fixture(withBuffer=false,distinctDesign=false,withPlans=false,withDecisions=false){
 const f=activationFixture(),previous=f.record();
 if(distinctDesign){previous.snapshot.approvedDesignRef={...previous.snapshot.approvedDesignRef,version:1,contentHash:'b'.repeat(64)};previous.ref.contentHash=await activationHash(previous.snapshot);}
 const record=f.record(2,previous.ref),session={user:{id:actor.actorId},clientId:id(90),csrfToken:'C'.repeat(43)};
 const plans:any[]=[];
 if(withPlans){for(const [n,r] of [previous,record].entries()){
  const card={taskCode:'FN01',type:'FUNCTION',title:'원문 읽기',purpose:'고정 원문 확인',ownerRole:'단계 책임자',designRefs:[{kind:'DESIGN_ITEM',id:id(72),versionRef:r.snapshot.approvedDesignRef,localCode:'FN01',anchor:'line:1'}],screenRefs:[],inputs:['고정 설계'],outputs:['확인 결과'],included:['원문 읽기'],excluded:['실행'],allowedFileRefs:['src/read.ts'],startPrerequisites:[],acceptancePrerequisites:[],steps:['원문 대조'],testCases:['NORMAL','IMPORTANT_FAILURE','DIRECT_IMPACT'].map((kind,i)=>({id:'TC'+i,kind,steps:['고정 참조 대조'],expected:'정확 원문',environment:'RAM'})),acceptanceCriteria:['일치'],evidenceRequirements:['고정 참조'],rollback:'원 입력 유지',recoveryNotes:'명시 재조회'};
  const analysis=analyzeWorkPlanCards([card]);assert.equal(analysis.issues.length,0);
  const snapshot={documentRef:{id:id(70),version:n+1,contentHash:(n?'c':'d').repeat(64)},designRef:r.snapshot.approvedDesignRef,screenReviewRefs:[],tasks:analysis.tasks,dependencies:analysis.dependencies,reason:'보관 계획 원문',issues:[],relationalProjection:'STORED'};
  const plan={...snapshot,ref:{id:id(71),version:n+1,contentHash:await activationHash(snapshot)},status:'DRAFT',executionEvidence:'NOT_CONNECTED',observedAt:at};
  const validation={validForConfirmation:true,issues:[],sourceRefs:[plan.documentRef,plan.designRef],screenReviewRefs:[]},reviewRef={id:id(75+n),targetRef:plan.ref,criteriaVersion:1,outcome:'ACCEPTED'};
  const decision={planRef:plan.ref,headVersion:2,confirmedVersion:2,criteria:workPlanReviewCriteria,contentReviews:[{ref:reviewRef,criteria:workPlanReviewCriteria,items:workPlanReviewCriteria.items.map(i=>({criterionId:i.criterionId,outcome:'ACCEPTED',evidenceRefs:[],reason:'원문 대조'})),reviewer:{kind:'HUMAN',userId:actor.actorId,sameAsTargetRecorder:true},sourceKind:'HUMAN_REVIEW',reason:'원문 검토',reviewedAt:at,serverSequence:1}],confirmation:{id:id(78+n),planRef:plan.ref,reviewRefs:[reviewRef],validation,confirmedBy:{kind:'HUMAN',userId:actor.actorId},confirmedAt:at},validation,currentConfirmationValid:n===1,activatedAsBaseline:false,observedAt:at};
  r.snapshot.confirmedPlanRef=plan.ref;if(n)r.snapshot.previousActivationRef=previous.ref;r.ref.contentHash=await activationHash(r.snapshot);plans.push({plan,decision});
 }}
 const approvals:ApprovalFixture[]=[];
 if(withDecisions)for(const [index,row] of [previous,record].entries()){
  const snap=row.snapshot;
  const payload={changeRef:snap.changeRef,impactRef:snap.impactRef,approvedDesignRef:snap.approvedDesignRef,confirmedPlanRef:snap.confirmedPlanRef,
   reason:index?'현재 후보 원문':'직전 후보 원문'};
  const payloadHash=await activationHash(payload),baselineRefs=index?[previous.ref]:[];
  const actionScope={...f.scope,targetRef:payload.changeRef,expectedVersion:payload.changeRef.version,payloadHash,baselineRefs};
  const scopeDigest=await activationHash(actionScope),approvalRef={requestId:id(401+index),decisionId:id(411+index),scopeDigest},commandId=id(421+index);
  const createdAt='2026-10-26T10:00:00.000Z',decidedAt='2026-10-26T11:00:00.000Z',expiresAt='2026-10-27T11:00:00.000Z';
  const details={...f.details,actionScope,candidateCommandId:commandId,expiresAt};
  const recordedBy={...snap.recordedBy,kind:'HUMAN' as const};
  const requestSnapshot={projectId:pid,details,scopeDigest,requiredDecider:{kind:'HUMAN' as const,userId:actor.actorId},policyRef:snap.policyRef,requestedBy:recordedBy,controlGeneration:snap.controlGeneration};
  const requestRef={id:approvalRef.requestId,version:1,contentHash:await activationHash(requestSnapshot)};
  const body={requestId:requestRef.id,requestVersion:1,requestRef,scopeDigest,decision:'APPROVE' as const,reason:index?'현재 승인 원문':'직전 승인 원문',
   decidedBy:recordedBy,controlGeneration:snap.controlGeneration,policyRef:snap.policyRef};
  const decision={id:approvalRef.decisionId,ref:{id:approvalRef.decisionId,version:1,contentHash:await activationHash(body)},...body,decidedAt};
  const command={...f.command,commandId,baselineRefs,approvalRef,payload};
  const requestHash=await activationHash(command);
  const consumption={id:snap.approvalConsumptionId,status:'CONSUMED' as const,commandId,serverCommandId:id(430+index),requestHash,scopeDigest,policyRef:snap.policyRef,consumedAt:at};
  Object.assign(snap,{approvalRef,commandId,candidatePayloadHash:payloadHash,previousActivationRef:baselineRefs[0]??null});
  row.ref.contentHash=await activationHash(snap);
  approvals.push({request:{id:requestRef.id,version:1,status:'PENDING',...requestSnapshot,createdAt},requestRef,decision,consumption,
   candidateActivation:{candidateCommandId:commandId,payloadHash,payload},currentVersion:3,storedStatus:'CONSUMED',effectiveState:'CONSUMED',
   expired:true,basisCurrent:false,executionAuthorized:false,observedAt:'2026-10-28T00:00:00.000Z'});
 }
 const current={projectId:pid,current:{state:'PRESENT' as const,activationRef:record.ref,designRef:record.snapshot.approvedDesignRef,planRef:record.snapshot.confirmedPlanRef},observedAt:at,executionAuthorized:false as const,dispatchPerformed:false as const};
 const calls:{path:string;method:string}[]=[];let mode='OK',planMode='OK',approvalMode='OK',release=()=>{},waiting=false,lost=0,changes=0,requests=0;
 const api=new ui.ApiClient(async(path:string,options?:RequestInit)=>{
  calls.push({path,method:options?.method??'GET'});assert.equal(options?.method??'GET','GET');
  if(path.includes('/work-plans/')){
   const row=plans.find(p=>path.startsWith(`/api/v1/projects/${pid}/work-plans/${p.plan.ref.id}/versions/${p.plan.ref.version}`));assert(row,path);const decision=path.endsWith('/decision'),selected=planMode;
   if(selected.startsWith(decision?'WAIT_DECISION':'WAIT_PLAN')){waiting=true;await new Promise<void>(r=>release=r);}
   if(selected==='401'||selected==='403'||selected.endsWith('401')&&selected.startsWith(decision?'WAIT_DECISION':'WAIT_PLAN'))return Response.json({code:'ACCESS_DENIED'},{status:selected==='403'?403:401});
   return Response.json(decision?row.decision:row.plan);
  }
  if(path.includes('/approvals/')){
   const row=approvals.find(v=>path===`/api/v1/projects/${pid}/approvals/${v.request.id}`);assert(row,path);
   const selected=approvalMode;
   if(selected.startsWith('WAIT')){waiting=true;await new Promise<void>(r=>release=r);}
   const status=selected==='WAIT401'?401:Number(selected);
   if([401,403,404].includes(status))return Response.json({code:'ACCESS_DENIED'},{status});
   return Response.json(row);
  }
  const selected=mode;if(selected.startsWith('WAIT')){waiting=true;await new Promise<void>(r=>release=r);}
  if(['401','403','WAIT401'].includes(selected))return Response.json({code:'ACCESS_DENIED'},{status:selected==='WAIT401'?401:Number(selected)});
  if(path==='/api/v1/projects/'+pid+'/baseline-activations/current')return Response.json(mode==='NONE'?{...current,current:{state:'NONE'}}:current);
  const r=[record,previous].find(r=>path==='/api/v1/projects/'+pid+'/baseline-activations/'+r.ref.id+'/versions/'+r.ref.version);assert(r,path);
  return Response.json({projectId:pid,...r,currentActivationRef:record.ref,isCurrent:r===record,observedAt:at,executionAuthorized:false,dispatchPerformed:false});
 });
 let buffer=withBuffer?newDesignActivation(api,pid,session,1,f.input,null):null;
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 let props:any={client:api,projectId:pid,session,page:null,selectionId:'',buffer,onRequest:()=>{requests++;return true;},onAuthenticationLost:()=>{lost++;}};
 const render=async(p=props)=>{props=p;await ui.React.act(async()=>root.render(ui.React.createElement(ui.DesignActivationPanel,props)));};
 props.onChange=(update:any)=>{changes++;buffer=typeof update==='function'?update(buffer):update;props={...props,buffer};root.render(ui.React.createElement(ui.DesignActivationPanel,props));};
 const button=(label:string)=>{const found=nodes(container).filter(n=>n.tagName==='BUTTON'&&n.textContent===label);assert.equal(found.length,1,label);return found[0]!;};
 const click=async(label:string)=>{const b=button(label);assert(!b.disabled,label);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0}));};
 await render();
 return{f,record,previous,current,calls,api,session,plans,approvals,setApprovalMode:(v:string)=>{approvalMode=v;},setPlanMode:(v:string)=>{planMode=v;},buffer:()=>buffer,props:()=>props,render,button,click,text:()=>container.textContent,region:(label:string)=>nodes(container).filter(n=>n.getAttribute('aria-label')===label),setMode:(v:string)=>{mode=v;},waiting:()=>waiting,release:()=>release(),lost:()=>lost,changes:()=>changes,requests:()=>requests,replace:async(b:any)=>{buffer=b;await render({...props,buffer});},close:async()=>{release();await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
const planButton='당시 확정 계획 원문 확인',planLinks=(f:Awaited<ReturnType<typeof fixture>>)=>f.region('설계 변경 적용').flatMap(nodes).filter(n=>n.tagName==='A'&&n.textContent==='당시 확정 계획 작성 문서 보기');
async function openHistory(f:Awaited<ReturnType<typeof fixture>>){await f.click('현재 적용 기준 확인');await settle(()=>f.region('현재 적용 기준').length===1);await f.click('적용 이력 원문 확인');await settle(()=>f.region('고정 적용 이력').length===1);}
const approvalReasonButton='당시 적용·승인 이유 확인',approvalReasonClose='당시 적용·승인 이유 닫기';
test('고정 적용 이력은 명시 GET 하나로 기한이 지난 원 후보·승인 이유를 각각 읽는다',async()=>{
 const f=await fixture(true,true,false,true);
 try{
  await openHistory(f);
  const before=f.buffer(),changes=f.changes();
  assert.equal(f.calls.filter(c=>c.path.includes('/approvals/')).length,0);
  for(const [index,when] of [[1,'현재'],[0,'직전']] as const){
   if(!index){await f.click('직전 적용 이력 확인');await settle(()=>f.text().includes(f.previous.ref.contentHash));}
   const first=f.calls.length;
   await f.click(approvalReasonButton);
   await settle(()=>f.text().includes(when+' 승인 원문'));
   assert.match(f.text(),new RegExp(when+' 후보 원문'));
   assert.deepEqual(f.calls.slice(first),[{path:`/api/v1/projects/${pid}/approvals/${f.approvals[index]!.request.id}`,method:'GET'}]);
   assert.match(f.text(),/현재 승인 권한이나 실행 허가를 뜻하지 않습니다/);
   assert.equal(f.buffer(),before);
   await f.click(approvalReasonClose);
   assert.doesNotMatch(f.text(),new RegExp(when+' 승인 원문'));
  }
  assert.equal(f.changes(),changes);assert.equal(f.requests(),0);
 }finally{await f.close();}
});
for(const mode of ['missing','project','decisionId','reason','consumptionId','commandHash','candidate','policy','401','403','404'] as const){
 test(`고정 적용 이유 · ${mode}는 양쪽 이유를 표시하지 않는다`,async()=>{
  const f=await fixture(false,true,false,true);
  try{
   await openHistory(f);
   const v=f.approvals[1]!;
   if(mode==='missing')delete (v as Partial<typeof v>).candidateActivation;
   else if(mode==='project')v.request.projectId=id(701);
   else if(mode==='decisionId'){v.decision.id=id(702);v.decision.ref.id=id(702);}
   else if(mode==='reason')v.decision.reason='보관 해시와 다른 이유';
   else if(mode==='consumptionId')v.consumption.id=id(703);
   else if(mode==='commandHash')v.consumption.requestHash='b'.repeat(64);
   else if(mode==='candidate'||mode==='policy'){
    if(mode==='candidate'){
     // 승인 GET 자체의 검산을 통과해도 선택 적용 이력에는 귀속되지 않는 후보.
     v.candidateActivation.payload.approvedDesignRef={...v.candidateActivation.payload.approvedDesignRef,id:id(704)};
     const payloadHash=await activationHash(v.candidateActivation.payload);
     v.candidateActivation.payloadHash=payloadHash;v.request.details.actionScope.payloadHash=payloadHash;
     const scopeDigest=await activationHash(v.request.details.actionScope);
     v.request.scopeDigest=scopeDigest;v.decision.scopeDigest=scopeDigest;v.consumption.scopeDigest=scopeDigest;
    }else{
     const policyRef={...v.request.policyRef,id:id(705)};
     v.request.policyRef=policyRef;v.decision.policyRef=policyRef;v.consumption.policyRef=policyRef;
    }
    const {id:requestId,version,status,createdAt,...requestBody}=v.request;
    v.requestRef.contentHash=await activationHash(requestBody);
    const {id:decisionId,ref,decidedAt,...decisionBody}=v.decision;
    v.decision.ref.contentHash=await activationHash(decisionBody);
   }else f.setApprovalMode(mode);
   const calls=f.calls.length;
   await f.click(approvalReasonButton);
   await settle(()=>f.text().includes('당시 이유를 확인할 수 없습니다.'));
   if(['candidate','policy','decisionId','consumptionId','commandHash'].includes(mode))assert.match(f.text(),/DESIGN_ACTIVATION_DECISION_MISMATCH/);
   assert.doesNotMatch(f.text(),/현재 후보 원문|현재 승인 원문|보관 해시와 다른 이유/);
   assert.equal(f.calls.length-calls,1);
   assert.equal(f.lost(),mode==='401'?1:0);
   assert(f.region('고정 적용 이력').length);
   assert(f.calls.every(c=>c.method==='GET'));
  }finally{await f.close();}
 });
}

for(const change of ['history','close','project','user','transport'] as const)for(const status of [200,401]){
 test(`고정 적용 이유 · ${change} 뒤 늦은 ${status} 폐기`,async()=>{
  const f=await fixture(false,true,false,true);
  try{
   await openHistory(f);
   f.setApprovalMode('WAIT'+status);
   const start=f.calls.length,button=f.button(approvalReasonButton),key=Object.keys(button).find(k=>k.startsWith('__reactProps'))!;
   await ui.React.act(async()=>{(button as any)[key].onClick();(button as any)[key].onClick();});
   await settle(f.waiting);
   assert.equal(f.calls.length-start,1);
   if(change==='history'){await f.click('직전 적용 이력 확인');await settle(()=>f.text().includes(f.previous.ref.contentHash));}
   else if(change==='close'){
    await f.click(approvalReasonClose);
    f.setApprovalMode('OK');
    await f.click(approvalReasonButton);
    await settle(()=>f.text().includes('현재 승인 원문'));
   }else if(change==='project')await f.render({...f.props(),projectId:id(709)});
   else if(change==='user'){
    const props=f.props();
    await f.render({...props,session:{...f.session,user:{id:id(710)}}});
    await f.render(props);
   }else{
    const transport=f.api.transport;
    f.api.transport=(...args:any[])=>transport(...args);await f.render();f.api.transport=transport;await f.render();
   }
   await ui.React.act(async()=>{f.release();await new Promise(resolve=>setImmediate(resolve));});
   assert.equal(f.lost(),0);
   assert.doesNotMatch(f.text(),/ACCESS_DENIED/);
   if(change==='close')assert.match(f.text(),/현재 승인 원문/);
   else assert.doesNotMatch(f.text(),/현재 후보 원문|현재 승인 원문/);
   assert(f.calls.every(c=>c.method==='GET'));
  }finally{await f.close();}
 });
}
test('확정 계획 원문 · 명시 두 GET 뒤 현재/과거 원 문서 fullref를 연결한다',async()=>{
 const f=await fixture(true,true,true);try{const base=f.buffer()!,pending=prepareDesignActivation({...base,current:{...f.current,current:{state:'NONE'}}},f.session),retained={...base,pending,uncertain:true};await f.replace(retained);await openHistory(f);
  assert.equal(f.calls.filter(c=>c.path.includes('/work-plans/')).length,0);
  for(const n of [1,0]){if(n===0){await f.click('직전 적용 이력 확인');await settle(()=>f.text().includes(f.previous.ref.contentHash));}assert.equal(planLinks(f).length,0);const before=f.calls.length;
   await f.click(planButton);await settle(()=>planLinks(f).length===1);const ref=f.plans[n].plan.documentRef;assert.equal(planLinks(f)[0]!.getAttribute('href'),`#/projects/${pid}/documents/${ref.id}/versions/${ref.version}/${ref.contentHash}`);assert.equal(f.calls.length-before,2);assert.equal(f.buffer(),retained);
  }assert.equal(f.changes(),0);assert.equal(f.requests(),0);assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});
for(const mode of ['PLAN_REF','PLAN_HASH','DECISION_REF','DESIGN','UNCONFIRMED','CONFIRM_SOURCES','CONFIRM_SCREENS','401','403'] as const)test('확정 계획 원문 · '+mode+'는 링크를 표시하지 않는다',async()=>{
 const f=await fixture(false,true,true);try{const row=f.plans[1];
  if(mode==='PLAN_REF')row.plan.ref={...row.plan.ref,contentHash:'e'.repeat(64)};
  else if(mode==='PLAN_HASH')row.plan.reason='다른 본문';
  else if(mode==='DECISION_REF')row.decision.planRef={...row.decision.planRef,version:3};
  else if(mode==='DESIGN'){row.plan.designRef={...row.plan.designRef,contentHash:'e'.repeat(64)};const{ref,status,executionEvidence,observedAt,...snapshot}=row.plan;row.plan.ref={...ref,contentHash:await activationHash(snapshot)};f.record.snapshot.confirmedPlanRef=row.plan.ref;f.record.ref.contentHash=await activationHash(f.record.snapshot);}
  else if(mode==='UNCONFIRMED'){row.decision.confirmation=null;row.decision.currentConfirmationValid=false;}
  else if(mode==='CONFIRM_SOURCES')row.decision.confirmation={...row.decision.confirmation,validation:{...row.decision.confirmation.validation,sourceRefs:[{...row.plan.documentRef,contentHash:'e'.repeat(64)},row.plan.designRef]}};
  else if(mode==='CONFIRM_SCREENS')row.decision.confirmation={...row.decision.confirmation,validation:{...row.decision.confirmation.validation,screenReviewRefs:[row.plan.documentRef]}};
  else f.setPlanMode(mode);
  await openHistory(f);const before=f.calls.length;await f.click(planButton);await settle(()=>f.text().includes('당시 확정 계획 원문을 확인할 수 없습니다.'));assert.equal(planLinks(f).length,0);assert.equal(f.lost(),mode==='401'?1:0);assert.equal(f.calls.length-before,['PLAN_REF','PLAN_HASH','DESIGN','401','403'].includes(mode)?1:2);assert.equal(f.changes(),0);assert.equal(f.requests(),0);
 }finally{await f.close();}
});
for(const phase of ['PLAN','DECISION'] as const)for(const change of ['HISTORY','PROJECT','CSRF','TRANSPORT'] as const)for(const status of [200,401])test(`확정 계획 원문 · ${phase}/${change} 뒤 늦은 ${status} 폐기`,async()=>{
 const f=await fixture(false,true,true);try{await openHistory(f);f.setPlanMode(`WAIT_${phase}_${status}`);const button=f.button(planButton),props=Object.entries(button).find(([k])=>k.startsWith('__reactProps'))![1] as any;
  await ui.React.act(async()=>{props.onClick();props.onClick();});await settle(f.waiting);const before=f.calls.filter(c=>c.path.includes('/work-plans/')).length;assert.equal(before,phase==='PLAN'?1:2);
  if(change==='HISTORY'){await f.click('직전 적용 이력 확인');await settle(()=>f.text().includes(f.previous.ref.contentHash));}
  else if(change==='PROJECT')await f.render({...f.props(),projectId:id(88)});
  else if(change==='CSRF'){const original=f.props();await f.render({...original,session:{...f.session,csrfToken:'D'.repeat(43)}});await f.render(original);}
  else{const original=f.api.transport;f.api.transport=(...args:any[])=>original(...args);await f.render();f.api.transport=original;await f.render();}
  await ui.React.act(async()=>{f.release();await new Promise(r=>setImmediate(r));});assert.equal(planLinks(f).length,0);assert.equal(f.lost(),0);assert.doesNotMatch(f.text(),/ACCESS_DENIED/);assert.equal(f.calls.filter(c=>c.path.includes('/work-plans/')).length,before);assert.equal(f.changes(),0);assert.equal(f.requests(),0);
 }finally{await f.close();}
});
const originalLinks=(f:Awaited<ReturnType<typeof fixture>>)=>f.region('설계 변경 적용').flatMap(nodes).filter(n=>n.tagName==='A'&&n.textContent==='당시 확정 설계 원문 보기');
test('당시 확정 설계 링크는 고정 현재/직전 버전의 fullref만 사용하고 미결 명령을 보존한다',async()=>{
 const f=await fixture(true,true);try{
  const base=f.buffer()!,pending=prepareDesignActivation({...base,current:{...f.current,current:{state:'NONE'}}},f.session),retained={...base,pending,uncertain:true};await f.replace(retained);
  assert.equal(originalLinks(f).length,0);
  await f.click('현재 적용 기준 확인');await settle(()=>f.region('현재 적용 기준').length===1);assert.equal(originalLinks(f).length,0);
  for(const [button,record] of [['적용 이력 원문 확인',f.record],['직전 적용 이력 확인',f.previous]] as const){
   await f.click(button);await settle(()=>f.region('고정 적용 이력')[0]?.textContent.includes(record.ref.contentHash)??false);
   const links=originalLinks(f),ref=record.snapshot.approvedDesignRef;assert.equal(links.length,1);
   assert.equal(links[0]!.getAttribute('href'),`#/projects/${pid}/documents/${ref.id}/versions/${ref.version}/${ref.contentHash}`);
   const count=f.calls.length;await ui.React.act(async()=>links[0]!.dispatchEvent({type:'click',button:0}));assert.equal(f.calls.length,count);assert.equal(f.buffer(),retained);
  }
  assert.equal(f.changes(),0);assert.equal(f.requests(),0);assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});
for(const mode of ['CSRF','TRANSPORT'] as const)test('당시 확정 설계 링크는 '+mode+' 교체 후 이전 응답을 노출하지 않는다',async()=>{
 const f=await fixture();try{await f.click('현재 적용 기준 확인');await settle(()=>f.region('현재 적용 기준').length===1);await f.click('적용 이력 원문 확인');await settle(()=>originalLinks(f).length===1);
  if(mode==='CSRF')await f.render({...f.props(),session:{...f.session,csrfToken:'D'.repeat(43)}});
  else{const old=f.api.transport;f.api.transport=(...args:any[])=>old(...args);await f.render();}
  assert.equal(originalLinks(f).length,0);assert.equal(f.changes(),0);assert.equal(f.requests(),0);assert.equal(f.calls.length,2);
 }finally{await f.close();}
});
test('버퍼 없는 다른 제어 기기의 OWNER는 현재→고정→직전 이력을 GET만으로 읽는다',async()=>{
 const f=await fixture();try{
  assert.equal(f.calls.length,0);assert.equal(f.button('설계 변경 적용 준비').disabled,true);
  await f.click('현재 적용 기준 확인');await settle(()=>f.region('현재 적용 기준').length===1);
  await f.click('적용 이력 원문 확인');await settle(()=>f.region('고정 적용 이력')[0]?.textContent.includes(f.record.ref.contentHash)??false);
  await f.click('직전 적용 이력 확인');await settle(()=>f.region('고정 적용 이력')[0]?.textContent.includes(f.previous.ref.contentHash)??false);
  assert.deepEqual(f.calls.map(c=>c.method),['GET','GET','GET']);assert.equal(f.changes(),0);assert.equal(f.requests(),0);assert.equal(f.buffer(),null);
  assert.equal(f.calls.some(c=>!c.path.includes('/baseline-activations/')),false);
 }finally{await f.close();}
});
for(const status of ['401','403'])for(const endpoint of ['current','fixed'])test(endpoint+' '+status+'는 이전 보호 이력을 숨기고 명령을 만들지 않는다',async()=>{
 const f=await fixture();try{
  await f.click('현재 적용 기준 확인');await settle(()=>f.region('현재 적용 기준').length===1);
  await f.click('적용 이력 원문 확인');await settle(()=>f.region('고정 적용 이력').length===1);
  f.setMode(status);await f.click(endpoint==='current'?'현재 적용 기준 확인':'직전 적용 이력 확인');await settle(()=>f.text().includes('ACCESS_DENIED'));
  assert.equal(f.region('현재 적용 기준').length,0);assert.equal(f.region('고정 적용 이력').length,0);assert.equal(f.lost(),status==='401'?1:0);assert.equal(f.changes(),0);assert.equal(f.requests(),0);assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});
for(const mode of ['PROJECT','PROJECT_ABA','USER','DEVICE','CSRF','SELECTION_ABA','UNMOUNT','LATE401'] as const)test('늦은 이력 '+mode+'는 바뀐 문맥에 반영하지 않는다',async()=>{
 const f=await fixture();let closed=false;try{
  await f.click('현재 적용 기준 확인');await settle(()=>f.region('현재 적용 기준').length===1);
  f.setMode(mode==='LATE401'?'WAIT401':'WAIT200');await f.click('적용 이력 원문 확인');await settle(f.waiting);const original=f.props(),count=f.calls.length;
  if(mode==='UNMOUNT'){await f.close();closed=true;}
  else if(mode==='PROJECT'||mode==='PROJECT_ABA'){await f.render({...original,projectId:id(80)});if(mode==='PROJECT_ABA')await f.render(original);}
  else if(mode==='SELECTION_ABA'){await f.render({...original,selectionId:id(81)});await f.render(original);}
  else await f.render({...original,session:mode==='DEVICE'?{...original.session,clientId:id(82)}:mode==='CSRF'?{...original.session,csrfToken:'D'.repeat(43)}:{...original.session,user:{id:id(83)}}});
  await ui.React.act(async()=>{f.release();await new Promise(r=>setImmediate(r));});
  assert.equal(f.region('고정 적용 이력').length,0);assert.equal(f.region('현재 적용 기준').length,0);assert.equal(f.lost(),0);assert.equal(f.calls.length,count);assert.equal(f.changes(),0);assert.equal(f.requests(),0);assert.doesNotMatch(f.text(),/ACCESS_DENIED/);
 }finally{if(!closed)await f.close();}
});
test('현재 기준 NONE도 조회 결과이며 준비나 승인 상태를 생성하지 않는다',async()=>{
 const f=await fixture();try{f.setMode('NONE');await f.click('현재 적용 기준 확인');await settle(()=>f.text().includes('최초 기준 등록'));assert.equal(f.buffer(),null);assert.equal(f.changes(),0);assert.equal(f.requests(),0);assert.equal(f.calls.length,1);}finally{await f.close();}
});
test('작성 중인 원 후보는 현재 기준을 갱신하지만 확인 체크 전 고정은 불가하다',async()=>{
 const f=await fixture(true);try{
  const original=f.buffer();await f.click('현재 적용 기준 확인');await settle(()=>!!f.buffer()?.current);
  assert.deepEqual(f.buffer()?.input,original?.input);assert.equal(f.buffer()?.bindingId,original?.bindingId);assert.equal(f.buffer()?.pending,null);assert.equal(f.button('적용 후보 고정').disabled,true);
  const checkbox=nodes(f.region('설계 변경 적용')[0]!).find(n=>n.tagName==='INPUT'&&Object.entries(n).some(([k,v])=>k.startsWith('__reactProps$')&&(v as any).type==='checkbox'));assert(checkbox);
  const props=Object.entries(checkbox).find(([k])=>k.startsWith('__reactProps$'))?.[1] as any;assert(props?.onChange);
  await ui.React.act(async()=>props.onChange({target:{checked:true}}));
  await f.click('적용 후보 고정');await settle(()=>!!f.buffer()?.pending);
  assert.deepEqual(f.buffer()?.pending?.baselineRefs,[f.record.ref]);assert.deepEqual(f.buffer()?.pending?.payload,original?.input);assert.equal(f.requests(),0);assert.equal(f.calls.length,1);
 }finally{await f.close();}
});
for(const state of ['PENDING','UNKNOWN','FOREIGN'])test('이력 조회는 '+state+' 원 버퍼·입력·명령을 변경하지 않는다',async()=>{
 const f=await fixture(true);try{
  const base=f.buffer()!;const current={...f.current,current:{state:'NONE' as const}};
  const pending=prepareDesignActivation({...base,current},f.session);
  const retained={...base,current,pending,uncertain:state==='UNKNOWN',failure:state==='UNKNOWN'?{code:'CONNECTION_LOST',status:0}:null,...(state==='FOREIGN'?{ownerClientId:actor.clientId}:{})};
  await f.replace(retained);await f.click('현재 적용 기준 확인');await settle(()=>f.region('현재 적용 기준').length===1);
  await f.click('적용 이력 원문 확인');await settle(()=>f.region('고정 적용 이력').length===1);
  assert.equal(f.buffer(),retained);assert.equal(f.changes(),0);assert.equal(f.requests(),0);assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});
class MemoryNode{
 nodeType:number;nodeName:string;tagName:string;localName:string;namespaceURI='http://www.w3.org/1999/xhtml';parentNode:MemoryNode|null=null;childNodes:MemoryNode[]=[];ownerDocument:any;attributes=new Map<string,string>();style:Record<string,unknown>={};listeners=new Map<string,Function[]>();value='';checked=false;disabled=false;data='';
 constructor(name:string,type=1,owner?:any){this.nodeType=type;this.nodeName=type===1?name.toUpperCase():name;this.tagName=this.nodeName;this.localName=name;this.ownerDocument=owner;}
 get options():MemoryNode[]{return this.childNodes.flatMap(n=>n.tagName==='OPTION'?[n]:n.options);}
 get firstChild():MemoryNode|null{return this.childNodes[0]??null;}get lastChild():MemoryNode|null{return this.childNodes.at(-1)??null;}get nextSibling():MemoryNode|null{const a=this.parentNode?.childNodes;return a?.[a.indexOf(this)+1]??null;}
 get nodeValue():string|null{return this.nodeType===3?this.data:null;}set nodeValue(v:string|null){if(this.nodeType===3)this.data=v??'';}
 get textContent():string{return this.nodeType===3?this.data:this.childNodes.map(n=>n.textContent).join('');}
 set textContent(v:string){if(this.nodeType===3){this.data=String(v);return;}for(const n of this.childNodes)n.parentNode=null;this.childNodes=[];if(v)this.appendChild(this.ownerDocument.createTextNode(String(v)));}
 appendChild(n:MemoryNode){if(n.parentNode)n.parentNode.removeChild(n);n.parentNode=this;this.childNodes.push(n);return n;}
 insertBefore(n:MemoryNode,b:MemoryNode){if(n.parentNode)n.parentNode.removeChild(n);n.parentNode=this;const i=this.childNodes.indexOf(b);assert(i>=0);this.childNodes.splice(i,0,n);return n;}
 removeChild(n:MemoryNode){const i=this.childNodes.indexOf(n);assert(i>=0);this.childNodes.splice(i,1);n.parentNode=null;return n;}
 setAttribute(k:string,v:unknown){this.attributes.set(k,String(v));if(k==='disabled')this.disabled=true;}removeAttribute(k:string){this.attributes.delete(k);if(k==='disabled')this.disabled=false;}getAttribute(k:string){return this.attributes.get(k)??null;}
 addEventListener(k:string,f:Function){this.listeners.set(k,[...(this.listeners.get(k)??[]),f]);}removeEventListener(k:string,f:Function){this.listeners.set(k,(this.listeners.get(k)??[]).filter(v=>v!==f));}
 contains(n:MemoryNode|null):boolean{return !!n&&(n===this||this.childNodes.some(c=>c.contains(n)));}focus(){this.ownerDocument.activeElement=this;}
 dispatchEvent(e:any){e.target=this;e.preventDefault??=()=>{e.defaultPrevented=true;};e.stopPropagation??=()=>{e.cancelBubble=true;};const chain:MemoryNode[]=[];for(let n:MemoryNode|null=this;n;n=n.parentNode)chain.push(n);for(const n of chain)for(const f of n.listeners.get(e.type)??[])f(e);return !e.defaultPrevented;}
}
const document:any=new MemoryNode('#document',9);document.ownerDocument=document;document.createElement=(n:string)=>new MemoryNode(n,1,document);document.createElementNS=(_ns:string,n:string)=>document.createElement(n);document.createTextNode=(s:string)=>{const n=new MemoryNode('#text',3,document);n.data=s;return n;};document.documentElement=document.createElement('html');document.body=document.createElement('body');document.documentElement.appendChild(document.body);document.activeElement=document.body;
const saved=new Map<string,PropertyDescriptor|undefined>();let ui:any;
const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}

before(async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/design-change/DesignActivationPanel.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:control-acceptance',name:'ControlAcceptanceMemoryTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'rework-memory-entry',resolveId(id){if(id.endsWith('virtual:control-acceptance'))return '\0control-acceptance';},load(id){if(id==='\0control-acceptance')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{DesignActivationPanel}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};import{renderToStaticMarkup}from'react-dom/server';export{React,createRoot,DesignActivationPanel,ApiClient,renderToStaticMarkup};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return ControlAcceptanceMemoryTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});
