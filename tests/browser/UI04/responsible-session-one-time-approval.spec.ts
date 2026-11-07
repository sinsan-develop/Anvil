import {candidateReadiness,candidateCapabilities} from '../../../apps/server/modules/connections/candidate-input.ts';
import {test,expect,type Page,type Request as PlaywrightRequest} from '@playwright/test';
import {readFile,readdir} from 'node:fs/promises';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readContextPreparationInput} from '../../../apps/server/modules/context/context-input.ts';
import {buildContextManifest} from '../../../apps/server/modules/context/context-manifest.ts';
import {planContextText} from '../../../apps/server/modules/context/context-text-plan.ts';
const root=process.env.ANVIL_UI04_RESPONSIBLE_SESSION_APPROVAL_DIST;
if(root!=='D:/tmp/anvil-v3-stage-b/ui04-responsible-session-approval-20261027-01/dist')throw Error('RESPONSIBLE_SESSION_APPROVAL_QA_PATH_INVALID');
async function installWorkspaceBundle(page:Page){
 const files=new Map<string,{body:Buffer;contentType:string}>();files.set('/',{body:await readFile(root+'/index.html'),contentType:'text/html'});
 for(const name of await readdir(root+'/assets')){if(!/^index-[A-Za-z0-9_-]+\.(js|css)$/.test(name))throw Error('RESPONSIBLE_SESSION_APPROVAL_QA_ASSET_INVALID');files.set('/assets/'+name,{body:await readFile(root+'/assets/'+name),contentType:name.endsWith('.js')?'text/javascript':'text/css'});}
 await page.route(/^https:\/\/localhost:3830\/(?:$|assets\/)/,r=>{const f=files.get(new URL(r.request().url()).pathname);return r.request().method()==='GET'&&f?r.fulfill({status:200,...f}):r.abort();});
}
const pid='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333',at='2026-10-18T01:44:12Z';
const reference=(id:string)=>({id,version:1,contentHash:'a'.repeat(64)}), appRef=reference(pid),designRef=reference(id);
const childTaskCard={taskCode:'FN01',type:'FUNCTION',title:'부모 업무',purpose:'사용자 목표',designRefs:[],screenRefs:[],ownerRole:'단계책임자',inputs:['요구'],outputs:['결과'],included:['개발'],excluded:['운영'],allowedFileRefs:['src/a.ts'],startPrerequisites:[],acceptancePrerequisites:[],steps:['구현'],testCases:[{id:'T1',kind:'NORMAL',steps:['확인'],expected:'보존',environment:'합성'}],acceptanceCriteria:['내용 확인'],evidenceRequirements:['결과'],rollback:'후속 국소 복구',recoveryNotes:'기록 보존'};
const childTaskPlanSnapshot={documentRef:reference(pid),designRef,screenReviewRefs:[],tasks:[childTaskCard,{...childTaskCard,taskCode:'FN02',title:'선택할 하위 업무'}],dependencies:[],reason:'고정 계획',issues:[],relationalProjection:'STORED'};
const planRef={...reference(user),contentHash:contentHash(canonicalJson(childTaskPlanSnapshot))},childTaskPlan={ref:planRef,status:'DRAFT',...childTaskPlanSnapshot,executionEvidence:'NOT_CONNECTED',observedAt:at};
const definition={taskRef:{planRef,taskCode:'FN01',applicationRef:appRef,nodeId:'N1'},purpose:'사용자가 개발 통제',goal:'사용 가능한 임무',baselineRefs:[planRef,appRef,designRef],inputs:['요구'],outputs:['결과'],acceptanceCriteria:['핵심 동작'],verificationRequirements:['중요 실패'],included:['개발'],excluded:['운영'],allowedScopes:[{sourceRootRef:planRef,mappingRef:null,observationRef:planRef,baselineRef:planRef,targets:[{relativePath:'src/a.ts',kind:'FILE',access:'WRITE',recursive:false}]}],environmentRef:null,requiredCapabilities:['코딩'],budgetRef:null,ownerRole:'단계책임자',parentAssignmentRef:null,recordingPolicyRef:null,integrationResponsibility:'검수 통합'};
const snapshot={definition,reason:'초안 보관',previousRef:null,basis:{planRef,applicationRef:appRef,designRef,taskCode:'FN01',nodeId:'N1',taskCardHash:'b'.repeat(64)},readinessIssues:[{code:'EXECUTION_NOT_CONNECTED',location:'taskRef'}],status:'DRAFT',ready:false,executionAuthorized:false,dispatchPerformed:false},draftRef={id,version:1,contentHash:contentHash(canonicalJson(snapshot))};
const criteria=['PURPOSE_SCOPE','BASELINE_TASK','INPUT_OUTPUT','COMPLETION_VERIFICATION','BOUNDARIES','RECORD_RECOVERY'];
async function setup(page:Page,lost=false){
 const commands:any[]=[],unknown:string[]=[],errors:string[]=[],reviews:any[]=[];let confirmed:any=null,original:any=null;
 await page.route('**/api/v1/**',r=>{unknown.push(r.request().url());return r.abort();});await installWorkspaceBundle(page);
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:user,displayName:'QA'},clientId:pid,csrfToken:'C'.repeat(43)}}));
 await page.route(`**/api/v1/projects/${pid}/conversations?limit=50`,r=>r.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:at}}));
 await page.route(`**/api/v1/projects/${pid}`,r=>r.fulfill({json:{id:pid,name:'임무 확정 QA',purpose:'사용자 주도',desiredOutcome:'도구 교체',version:1,createdAt:at,updatedAt:at,currentMethodologyRef:appRef,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[],viewerPermissions:['READ_PROJECT'],participation:'OWNER',controlState:{actorId:user,clientId:pid,generation:1,status:'HELD'}}}));
 await page.route(`**/api/v1/projects/${pid}/assignment-drafts?*`,r=>r.fulfill({json:{items:[{ref:draftRef,status:'DRAFT',goal:definition.goal,taskRef:definition.taskRef,issueCount:1,updatedAt:at,ready:false,executionAuthorized:false}],hasMore:false,nextCursor:null,observedAt:at}}));
 await page.route(`**/api/v1/projects/${pid}/assignment-drafts/${id}/versions/1`,r=>r.fulfill({json:{projectId:pid,ref:draftRef,snapshot,headVersion:1,sourceCurrentness:'NOT_RECHECKED',observedAt:at}}));
 await page.route(`**/api/v1/projects/${pid}/assignment-drafts/${id}/versions/1/decision`,r=>r.fulfill({json:{projectId:pid,draftRef,criteriaVersion:1,criteria,reviews,hasMoreReviews:false,contentIssues:[],currentIssue:null,confirmedRef:confirmed?.ref??null,latestReviewAccepted:reviews[0]?.snapshot.outcome==='ACCEPTED',readinessIssues:snapshot.readinessIssues,ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt:at}}));
 await page.route(`**/api/v1/projects/${pid}/assignments/${id}/versions/1`,r=>r.fulfill({json:{projectId:pid,...confirmed,observedAt:at}}));
 await page.route('**/api/v1/projects/'+pid+'/work-plans/'+planRef.id+'/versions/1',r=>r.fulfill({json:childTaskPlan}));
 await page.route(`**/api/v1/projects/${pid}/commands`,async r=>{
  const c=r.request().postDataJSON();commands.push(c);let data:any;
  if(original&&original.commandId===c.commandId)data=original.data;
  else if(c.operation==='reviewAssignmentContent'){
   const s={...c.payload,reviewedBy:{kind:'HUMAN',userId:user},reviewedAt:at,independence:'NOT_CLAIMED'},ref={id:crypto.randomUUID(),version:1,contentHash:contentHash(canonicalJson(s))};data={ref,status:'ASSIGNMENT_CONTENT_REVIEWED',snapshot:s};reviews.unshift({ref,snapshot:s,serverSequence:commands.length,sameAuthor:true});
  }else{expect(c.operation).toBe('confirmAssignment');const s={draftRef,definition,reviewRefs:c.payload.reviewRefs,reason:c.payload.reason,confirmedBy:{kind:'HUMAN',userId:user},confirmedAt:at,contentConfirmed:true,readinessIssues:snapshot.readinessIssues,ready:false,executionAuthorized:false,dispatchPerformed:false};confirmed={ref:{id,version:1,contentHash:contentHash(canonicalJson(s))},snapshot:s};data={...confirmed,status:'ASSIGNMENT_CONTENT_CONFIRMED',confirmationId:crypto.randomUUID()};}
  const reply={operationId:id,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:data.ref.id,version:data.ref.version,data,evidenceRefs:[],warnings:[],serverReceivedAt:at};original=reply;
  if(lost&&commands.length===1)return r.abort();return r.fulfill({json:reply});
 });
 page.on('pageerror',e=>{errors.push(e.message);const safe=(text:string)=>text.replace(/\bBearer\s+[^\s"']+/gi,'Bearer [비공개]').replace(/\b(?:api[_-]?key|access[_-]?token|secret|password|passwd|csrfToken)\s*[=:]\s*[^\s,"']+/gi,'[비공개]').slice(0,8000);console.error('[RESPONSIBLE_SESSION_PAGEERROR]',JSON.stringify({message:safe(e.message),stack:safe(e.stack??'')}));});page.on('request',r=>{if(new URL(r.url()).origin!=='https://localhost:3830')unknown.push(r.url());});
 await page.goto(`/#/projects/${pid}/workspace`);await page.getByRole('button',{name:'임무 초안 목록 조회',exact:true}).click();await page.getByRole('button',{name:'임무 버전 열기: 1',exact:true}).click();return{commands,unknown,errors,reviews,get confirmed(){return confirmed;}};
}
async function fillReview(page:Page){await page.getByRole('button',{name:'임무 내용 검토 준비',exact:true}).click();for(const criterion of criteria){const judgment=page.getByRole('combobox',{name:`${criterion} 판단`,exact:true});await expect(judgment).toHaveValue('NOT_EXECUTED');await judgment.selectOption('ACCEPTED');await page.getByRole('textbox',{name:`${criterion} 이유`,exact:true}).fill('사람이 해당 기준을 검토');}await page.getByRole('combobox',{name:'임무 검토 종합 판단',exact:true}).selectOption('ACCEPTED');await page.getByRole('textbox',{name:'임무 내용 판단 이유',exact:true}).fill('내용만 검토·실행 조건은 미확인');await page.getByLabel('임무 내용 판단을 직접 확인했습니다',{exact:true}).check();}



const hash=(v:unknown)=>contentHash(canonicalJson(v));
for(const mode of ['FLOW','AUTO_NULL','LOST_REQUEST','LOST_WRITE','GET_FAIL','REJECTED','REVOKED_POLICY','UNKNOWN412','LEAVE_INFLIGHT'])test('RESPONSIBLE_SESSION_APPROVAL_'+mode,async({page})=>{
 const f=await setup(page);await fillReview(page);await page.getByRole('button',{name:'임무 내용 판단 저장',exact:true}).click();await expect(page.getByText('임무 내용 검토 저장 확인',{exact:true})).toBeVisible();await page.getByRole('button',{name:'임무 별도 확정 준비',exact:true}).click();await page.getByLabel('임무 내용 판단 이유',{exact:true}).fill('책임 세션 선행 내용 확정');await page.getByLabel('임무 내용 판단을 직접 확인했습니다',{exact:true}).check();await page.getByRole('button',{name:'임무 내용 판단 저장',exact:true}).click();await expect(page.getByText('임무 내용 확정 저장 확인 · 실행 허가 아님',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'확정 임무 원본 재조회',exact:true}).click();
 const policyBody={rules:[{ruleId:'RESPONSIBLE',subjectRef:{kind:'HUMAN',userId:user},operations:['defineProjectRole','bindResponsibleSession'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:mode==='AUTO_NULL'?'AUTO':'REQUIRE_APPROVAL',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'},{ruleId:'DECISIONS',subjectRef:{kind:'HUMAN',userId:user},operations:['requestApproval','decideApproval'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}],reason:'역할·예약 원명령',reviewRefs:[]};let policyVersion=1;
 const policyRef=()=>({id:user,version:policyVersion,contentHash:hash(policyBody)}),roles:any[]=[],bindings:any[]=[],commands:any[]=[],views=new Map<string,any>(),receipts=new Map<string,any>();let stores=0,lostRequest=false,lostWrite=false,failedGet=false,release=()=>{};let heldRequest:PlaywrightRequest|null=null;const wait=new Promise<void>(r=>release=r);
 const input:any={kind:'CONNECTION_CANDIDATE',candidateRef:null,policyRef:policyRef(),candidate:{label:'기존 코딩 도구 후보'},expiresAt:'2099-01-01T00:00:00.000Z',reason:'합성 후보'},candidate={kind:input.kind,input,readiness:candidateReadiness(input),capabilities:candidateCapabilities(input)},connectionRef={id:'66666666-6666-4666-8666-666666666666',version:1,contentHash:hash(candidate)};
 const result=(c:any,data:any)=>({operationId:crypto.randomUUID(),commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:data.ref.id,version:data.ref.version,data,evidenceRefs:[],warnings:[],serverReceivedAt:new Date(at).toISOString()});
 await page.route(`**/api/v1/projects/${pid}/permission-policy`,r=>r.fulfill({json:{configured:true,policy:{ref:policyRef(),...policyBody,createdAt:new Date(at).toISOString()}}}));
 await page.route(`**/api/v1/projects/${pid}/connection-candidates?*`,r=>r.fulfill({json:{view:'CANDIDATES_ONLY',items:[{ref:connectionRef,kind:'CONNECTION_CANDIDATE',label:input.candidate.label,readiness:'NOT_READY',expiresAt:input.expiresAt,integrity:'NOT_RECHECKED'}],hasMore:false,nextCursor:null,observedAt:at}}));
 await page.route(`**/api/v1/projects/${pid}/connection-candidates/${connectionRef.id}/versions/1`,r=>r.fulfill({json:{ref:connectionRef,candidate,expired:false,createdAt:at,recordedBy:user,executionAuthorized:false,observedAt:at}}));
 await page.route(`**/api/v1/projects/${pid}/assignments/${id}/versions/1/execution-preparation-state`,r=>{if(mode==='GET_FAIL'&&stores&&!failedGet){failedGet=true;return r.fulfill({status:503,json:{code:'RESPONSIBLE_SESSION_SOURCE_UNAVAILABLE'}});}return r.fulfill({json:{projectId:pid,assignmentRef:f.confirmed.ref,roles,bindings,preparations:[],hasMorePreparations:false,currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false}});});
 await page.route(`**/api/v1/projects/${pid}/approvals?*`,r=>r.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:new Date(at).toISOString()}}));
 await page.route(`**/api/v1/projects/${pid}/approvals/*`,r=>r.fulfill({json:views.get(new URL(r.request().url()).pathname.split('/').at(-1)!)}));
 await page.route(`**/api/v1/projects/${pid}/commands`,async r=>{
  const c=r.request().postDataJSON();commands.push(c);let reply=receipts.get(c.commandId);
  if(!reply){let data:any;
   if(['defineProjectRole','bindResponsibleSession'].includes(c.operation)){
    const writes=commands.filter(x=>['defineProjectRole','bindResponsibleSession'].includes(x.operation));
    if(writes.length===1&&mode==='UNKNOWN412')return r.abort();if(writes.length===1&&mode==='LEAVE_INFLIGHT'){heldRequest=r.request();await wait;return r.fulfill({status:412,json:{code:'APPROVAL_REQUIRED'}});}
    if(c.approvalRef===null&&mode!=='AUTO_NULL')return r.fulfill({status:412,json:{code:'APPROVAL_REQUIRED'}});
    if(mode!=='AUTO_NULL'){const v=views.get(c.approvalRef.requestId);expect(v.effectiveState).toBe('APPROVED');expect(v.request.details.candidateCommandId).toBe(c.commandId);expect(v.request.details.actionScope.payloadHash).toBe(hash(c.payload));expect(v.request.details.actionScope.targetRef).toEqual(c.payload.existingSessionBindingRef??null);}
    let snapshot:any,ref:any;
    if(c.operation==='defineProjectRole'){snapshot={...c.payload,definedBy:{kind:'HUMAN',userId:user},definedAt:at};ref={id:crypto.randomUUID(),version:1,contentHash:hash(snapshot)};roles.push({projectId:pid,ref,snapshot});}
    else{const previous=bindings[0],sessionRef=previous?.snapshot.sessionRef??{id:crypto.randomUUID(),version:1,contentHash:'b'.repeat(64)};snapshot={...c.payload,sessionRef,generation:c.expectedVersion+1,state:'RESERVED',externalSessionHandleRef:null,connectionReadiness:'CANDIDATE_ONLY',executionAuthorized:false,dispatchPerformed:false,boundBy:{kind:'HUMAN',userId:user},boundAt:at};ref={id:previous?.ref.id??crypto.randomUUID(),version:c.expectedVersion+1,contentHash:hash(snapshot)};bindings.splice(0,bindings.length,{projectId:pid,ref,snapshot});}
    stores++;data={ref,snapshot,status:c.operation==='defineProjectRole'?'PROJECT_ROLE_DEFINED':'RESPONSIBLE_SESSION_RESERVED'};
   }else if(c.operation==='requestApproval'){
    const details=c.payload.details,scopeDigest=hash(details.actionScope),body={projectId:pid,details,scopeDigest,requiredDecider:{kind:'HUMAN',userId:user},policyRef:policyRef(),requestedBy:{kind:'HUMAN',userId:user,clientId:pid},controlGeneration:1},ref={id:crypto.randomUUID(),version:1,contentHash:hash(body)},request={id:ref.id,version:1,status:'PENDING',...body,createdAt:new Date(at).toISOString()};views.set(ref.id,{request,requestRef:ref,currentVersion:1,storedStatus:'PENDING',effectiveState:'PENDING',decision:null,consumption:null,expired:false,basisCurrent:true,executionAuthorized:false,observedAt:new Date(at).toISOString()});data={ref,status:'APPROVAL_REQUESTED',request};
   }else if(c.operation==='decideApproval'){
    const v=views.get(c.targetId),body={requestId:c.targetId,requestVersion:1,requestRef:v.requestRef,scopeDigest:v.request.scopeDigest,decision:c.payload.decision,reason:c.payload.reason,decidedBy:{kind:'HUMAN',userId:user,clientId:pid},controlGeneration:1,policyRef:policyRef()},ref={id:crypto.randomUUID(),version:1,contentHash:hash(body)},decision={id:ref.id,...body,decidedAt:new Date(at).toISOString()},status=c.payload.decision==='REJECT'?'REJECTED':'APPROVED';views.set(c.targetId,{...v,currentVersion:2,storedStatus:status,effectiveState:status,decision:{ref,...decision}});data={ref,status:'APPROVAL_DECIDED',decision};
   }else{f.unknown.push(c.operation);return r.abort();}
   reply=result(c,data);receipts.set(c.commandId,reply);
   if(c.operation==='requestApproval'&&mode==='LOST_REQUEST'&&!lostRequest){lostRequest=true;return r.abort();}if(['defineProjectRole','bindResponsibleSession'].includes(c.operation)&&mode==='LOST_WRITE'&&!lostWrite){lostWrite=true;return r.abort();}
  }
  return r.fulfill({json:reply});
 });
 const panel=page.getByRole('region',{name:'책임 역할·예약 세션',exact:true});await panel.getByRole('button',{name:'책임 세션 입력 준비',exact:true}).click();
 const rounds=['FLOW','AUTO_NULL'].includes(mode)?4:1,actions=['총괄 역할 정의','선택 단계 책임 역할 정의','책임 세션 예약','같은 책임 세션으로 임무 결박'];
 for(let n=0;n<rounds;n++){
  await panel.getByRole('textbox',{name:'책임 역할·예약 이유',exact:true}).fill('원명령 '+n);if(n===2){await panel.getByRole('button',{name:'현재 역할·예약·준비 이력 조회',exact:true}).click();await panel.getByRole('combobox',{name:'기존 코딩 Agent 연결 후보',exact:true}).selectOption({label:'기존 코딩 도구 후보 · 후보/실제 능력 미확인'});}
  await panel.getByRole('button',{name:actions[n],exact:true}).click();
  expect(f.errors,'역할·예약 명령 클릭 직후 브라우저 예외').toEqual([]);
  if(mode==='UNKNOWN412'||mode==='LEAVE_INFLIGHT'){
   await expect.poll(()=>commands.length).toBe(1);
   if(mode==='LEAVE_INFLIGHT'){await page.evaluate(()=>{location.hash='/not-found';});await expect(panel).toHaveCount(0);await page.evaluate(pid=>{location.hash='/projects/'+pid+'/workspace';},pid);await page.getByRole('button',{name:'확정 임무 원본 재조회',exact:true}).click();await panel.getByRole('button',{name:'현재 역할·예약·준비 이력 조회',exact:true}).click();}
   await panel.getByRole('button',{name:'같은 책임 세션 명령 결과 확인',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('APPROVAL_REQUIRED');await expect(panel.getByRole('button',{name:'책임 역할·예약 승인 요청 준비',exact:true})).toHaveCount(0);expect(commands[0]).toEqual(commands[1]);expect(stores).toBe(0);
   if(mode==='LEAVE_INFLIGHT'){
    expect(heldRequest).not.toBeNull();const exactRequest=heldRequest!,responsePending=page.waitForResponse(response=>response.request()===exactRequest);release();const response=await responsePending;expect(response.request()).toBe(exactRequest);expect(response.status()).toBe(412);expect(await response.finished()).toBeNull();
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    await expect(panel.getByText('원 명령 '+commands[0].commandId+' · 결과 미확인 · 새 명령을 만들지 않습니다',{exact:true})).toBeVisible();await expect(panel.getByRole('textbox',{name:'책임 역할·예약 이유',exact:true})).toHaveValue('원명령 0');await expect(panel.getByRole('alert')).toContainText('APPROVAL_REQUIRED');await expect(panel.getByRole('region',{name:'책임 역할·예약 원명령 일회 승인',exact:true})).toHaveCount(0);expect(commands).toHaveLength(2);expect(commands[0]).toEqual(commands[1]);expect(stores).toBe(0);expect(f.unknown).toEqual([]);
   }
   expect(f.errors).toEqual([]);return;
  }
  if(mode!=='AUTO_NULL'){
   await panel.getByRole('button',{name:'책임 역할·예약 승인 요청 준비',exact:true}).click();const editor=panel.getByRole('region',{name:'책임 역할·예약 원명령 일회 승인',exact:true});
   for(const suffix of ['승인 요청 이유','데이터 위험','보안 위험','비용 위험','중단 영향','미확인 사항','복구 방법','복구 한계'])await editor.getByRole('textbox',{name:'책임 역할·예약 '+suffix,exact:true}).fill('원명령 검토');await editor.getByRole('textbox',{name:'책임 역할·예약 승인 만료 UTC',exact:true}).fill('2098-01-01T00:00:00.000Z');await editor.getByRole('button',{name:'책임 역할·예약 원명령 승인 요청 저장',exact:true}).click();
   if(mode==='LOST_REQUEST'){await editor.getByRole('button',{name:'같은 책임 역할·예약 승인 요청 결과 확인',exact:true}).click();await expect.poll(()=>commands.filter(c=>c.operation==='requestApproval').length).toBe(2);const requests=commands.filter(c=>c.operation==='requestApproval');expect(requests[0]).toEqual(requests[1]);}
   const link=editor.getByRole('link',{name:'이 책임 역할·예약 승인 요청에서 별도 결정',exact:true});await expect(link).toBeVisible();expect(stores).toBe(n);if(mode==='REVOKED_POLICY'){policyVersion++;for(const v of views.values()){v.basisCurrent=false;v.effectiveState='REVOKED';}}
   await link.click();await expect(page.getByRole('heading',{name:/요청 .* · (PENDING|REVOKED)/,level:3})).toBeVisible();
   if(mode!=='REVOKED_POLICY'){if(n>0){await page.getByRole('button',{name:'결정 입력 닫기',exact:true}).click();await page.getByRole('button',{name:'이 요청 결정 준비',exact:true}).click();}await page.getByRole('textbox',{name:'결정 이유',exact:true}).fill('이 명령 확인');await page.getByRole('checkbox',{name:'정확 범위·위험·복구 한계를 확인했습니다',exact:true}).check();await page.getByRole('button',{name:mode==='REJECTED'?'거절':'이번만 승인',exact:true}).click();await expect(page.getByRole('heading',{name:mode==='REJECTED'?/요청 .* · REJECTED/:/요청 .* · APPROVED/,level:3})).toBeVisible();}
   await page.getByRole('link',{name:'책임 역할·예약 원명령으로 돌아가 별도 승인 결박·저장',exact:true}).click();await page.getByRole('button',{name:'확정 임무 원본 재조회',exact:true}).click();await panel.getByRole('button',{name:'현재 역할·예약·준비 이력 조회',exact:true}).click();
   if(mode==='REJECTED'||mode==='REVOKED_POLICY'){await panel.getByRole('button',{name:'책임 역할·예약 승인 종결 상태 확인',exact:true}).click();await panel.getByRole('button',{name:'종결된 책임 역할·예약 승인 종료·입력 수정',exact:true}).click();await expect(panel.getByRole('textbox',{name:'책임 역할·예약 이유',exact:true})).toBeEnabled();await expect(panel).toContainText('종결 승인 1건');expect(stores).toBe(0);expect(f.errors).toEqual([]);return;}
   await panel.getByRole('button',{name:'책임 역할·예약 승인 재조회·원 책임 역할·예약 명령 결박',exact:true}).click();await expect(panel.getByRole('status').filter({hasText:'책임 역할·예약 승인 결박 확인'})).toBeVisible();await panel.getByRole('button',{name:'같은 책임 세션 명령 결과 확인',exact:true}).click();
   if(mode==='LOST_WRITE'){await panel.getByRole('button',{name:'같은 책임 세션 명령 결과 확인',exact:true}).click();await expect.poll(()=>commands.filter(c=>c.approvalRef!==null).length).toBe(2);const writes=commands.filter(c=>c.approvalRef!==null);expect(writes[0]).toEqual(writes[1]);}
  }
  await expect.poll(()=>stores).toBe(n+1);await expect(panel.getByRole('status').filter({hasText:'책임 역할·예약 저장 영수증 보관'})).toBeVisible();
  if(mode==='GET_FAIL'){await expect(panel.getByRole('alert')).toContainText('RESPONSIBLE_SESSION_SOURCE_UNAVAILABLE');await panel.getByRole('button',{name:'현재 역할·예약·준비 이력 조회',exact:true}).click();}
  if(n>=2){await expect(panel).toContainText('RESERVED');await expect(panel).toContainText('현재 사용 가능성: 미확인');expect(bindings[0].snapshot.externalSessionHandleRef).toBeNull();expect(bindings[0].snapshot.executionAuthorized).toBe(false);expect(bindings[0].snapshot.dispatchPerformed).toBe(false);}
 }
 if(mode==='FLOW'){expect(views.size).toBe(4);expect(new Set(commands.filter(c=>c.approvalRef!==null).map(c=>c.approvalRef.requestId)).size).toBe(4);const binds=commands.filter(c=>c.operation==='bindResponsibleSession'&&c.approvalRef!==null);expect(binds[1].payload.existingSessionBindingRef.version).toBe(1);expect(bindings[0].ref.version).toBe(2);}
 expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});
