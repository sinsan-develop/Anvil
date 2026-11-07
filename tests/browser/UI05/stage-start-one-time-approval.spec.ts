import {test,expect,type Page} from '@playwright/test';
import {readFile,readdir} from 'node:fs/promises';
import {criteriaFixture,criteriaHash,criteriaId,criteriaRef} from '../../unit/FN12/result-criteria-fixture.ts';
import {contentCriteria} from '../../../apps/web/src/features/workspace/assignment-confirmation-api.ts';
import {sessionDetailHref} from '../../../apps/web/src/shell/routes.ts';
const root=process.env.ANVIL_UI05_STAGE_START_APPROVAL_DIST;
if(root!=='D:/tmp/anvil-v3-stage-b/ui05-stage-start-approval-20261027-01/dist')throw Error('STAGE_START_APPROVAL_QA_PATH_INVALID');
async function installWorkspaceBundle(page:Page){
 const files=new Map<string,{body:Buffer;contentType:string}>();files.set('/',{body:await readFile(root+'/index.html'),contentType:'text/html'});
 for(const name of await readdir(root+'/assets')){if(!/^index-[A-Za-z0-9_-]+\.(js|css)$/.test(name))throw Error('STAGE_START_APPROVAL_QA_ASSET_INVALID');files.set('/assets/'+name,{body:await readFile(root+'/assets/'+name),contentType:name.endsWith('.js')?'text/javascript':'text/css'});}
 await page.route(/^https:\/\/localhost:3830\/(?:$|assets\/)/,r=>{const f=files.get(new URL(r.request().url()).pathname);return r.request().method()==='GET'&&f?r.fulfill({status:200,...f}):r.abort();});
}

for(const mode of ['CASE','AUTO','AUTO_NULL','LOST_REQUEST','LOST_START','GET_FAIL','REJECTED','REVOKED_POLICY','UNKNOWN412'])test('STAGE_START_APPROVAL_'+mode,async({page})=>{
 const f=criteriaFixture(),pid=f.assignment.projectId,aid=f.assignment.ref.id,actor=criteriaId(6),clientId=criteriaId(8),at='2026-10-21T00:00:00.000Z',d=f.d;
 const node=(nodeId:string)=>({nodeId,name:nodeId,purpose:'합성 단계',kind:'AGENT',position:{x:0,y:0},role:'STAGE_OWNER',inputs:[],outputs:[],taskScope:{included:['개발'],excluded:['운영']},completionCriteria:['검수'],approvalBoundary:[],mode:'AUTO',limitPolicyRef:null,recordRequirements:['현황']}),graph={nodes:[node('review'),node('test')],edges:[{edgeId:'next',fromNodeId:'review',toNodeId:'test',kind:'SEQUENCE',condition:null,reason:'후속'}],entryNodeId:'review',terminalNodeIds:['test']},appSnapshot={name:'합성 방법론',purpose:'대기 요청 QA',graph,sourceRef:{...criteriaRef(40),contentHash:criteriaHash(graph)}},appRef={...criteriaRef(2),contentHash:criteriaHash(appSnapshot)},app={projectId:pid,applicationRef:appRef,snapshot:appSnapshot,observedAt:at,executionState:'NOT_CONNECTED'};d.taskRef.applicationRef=appRef;d.budgetRef=criteriaRef(8);
 const snapshot={definition:d,reason:'내용 확정',previousRef:null,basis:{planRef:d.taskRef.planRef,applicationRef:d.taskRef.applicationRef,designRef:d.baselineRefs[0],taskCode:d.taskRef.taskCode,nodeId:d.taskRef.nodeId,taskCardHash:'b'.repeat(64)},readinessIssues:[],status:'DRAFT',ready:false,executionAuthorized:false,dispatchPerformed:false},draftRef={id:aid,version:1,contentHash:criteriaHash(snapshot)},draft={projectId:pid,ref:draftRef,snapshot,headVersion:1,sourceCurrentness:'NOT_RECHECKED',observedAt:at};f.assignment.snapshot.draftRef=draftRef;f.rehash();const assignment=f.assignment.ref,decision={projectId:pid,draftRef,criteriaVersion:1,criteria:contentCriteria,reviews:[],hasMoreReviews:false,contentIssues:[],currentIssue:'REVIEW_REQUIRED',confirmedRef:assignment,latestReviewAccepted:false,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt:at},state={projectId:pid,assignmentRef:assignment,roles:[],bindings:[],preparations:[],hasMorePreparations:false,currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false};

 const commands:any[]=[],unknown:string[]=[],errors:string[]=[];let view:any=null,requestResult:any=null,decisionResult:any=null,receipt:any=null,stores=0,queueReads=0,policyVersion=1;
 const requestId=criteriaId(70),decisionId=criteriaId(71);
 const policyBody={rules:[{ruleId:'QUEUE',subjectRef:{kind:'HUMAN',userId:actor},operations:['startStage'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:mode==='AUTO_NULL'?'AUTO':'REQUIRE_APPROVAL',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'},{ruleId:'APPROVAL_COMMANDS',subjectRef:{kind:'HUMAN',userId:actor},operations:['requestApproval','decideApproval'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}],reason:'원명령',reviewRefs:[]};
 const policyRef=()=>({id:criteriaId(72),version:policyVersion,contentHash:criteriaHash(policyBody)});
 const result=(c:any,data:any)=>({operationId:criteriaId(73),commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:data.ref.id,version:1,data,evidenceRefs:[],warnings:[],serverReceivedAt:at});
 await page.route('**/*',r=>{unknown.push(r.request().method()+' '+r.request().url());return r.abort();});await installWorkspaceBundle(page);
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:actor,displayName:'단계 승인 QA'},clientId,csrfToken:'A'.repeat(43)}}));
 await page.route('**/api/v1/projects/'+pid,r=>r.fulfill({json:{id:pid,participation:'OWNER',controlState:{actorId:actor,clientId,generation:3,status:'HELD'}}}));
 await page.route('**/api/v1/projects/'+pid+'/**',async r=>{
  const path=new URL(r.request().url()).pathname,b='/api/v1/projects/'+pid+'/';let body:any;
  if(path===b+'assignment-drafts/'+aid+'/versions/1')body=draft;
  else if(path===b+'assignment-drafts/'+aid+'/versions/1/decision')body=decision;
  else if(path===b+'assignments/'+aid+'/versions/1')body=f.assignment;
  else if(path===b+'assignments/'+aid+'/versions/1/execution-preparation-state')body=state;
  else if(path===b+'assignments/'+aid+'/versions/1/result-pages')body={projectId:pid,assignmentRef:assignment,items:[],hasMore:false,nextCursor:null,selectionState:'NOT_SELECTED',observedAt:at};
  else if(path===b+'methodology-application')body=app;
  else if(path===b+'permission-policy')body={configured:true,policy:{ref:policyRef(),...policyBody,createdAt:at}};
  else if(path===b+'approvals')body={items:[],hasMore:false,nextCursor:null,observedAt:at};
  else if(path===b+'approvals/'+requestId)body=view;
  else if(path===b+'queue'){
   queueReads++;if(mode==='GET_FAIL'&&queueReads===1)return r.fulfill({status:503,json:{code:'STAGE_QUEUE_SOURCE_UNAVAILABLE'}});
   body={projectId:pid,items:receipt?[{requestRef:receipt.data.ref,state:'WAITING',sequence:1,reasonCodes:receipt.data.snapshot.readinessIssues,blockedBy:[],reservedBudgetRef:null}]:[],selection:'WAITING_ONLY',cancelledHistoryOmitted:true,observedAt:at,writerReservationPerformed:false,executionAuthorized:false,dispatchPerformed:false};
  }
  else if(path===b+'commands'){
   const c=r.request().postDataJSON();commands.push(c);
   if(c.operation==='startStage'){
    const sameStarts=commands.filter(x=>x.operation==='startStage');
    if(mode==='UNKNOWN412'&&sameStarts.length===1)return r.abort();
    if(c.approvalRef===null&&mode!=='AUTO_NULL')return r.fulfill({status:412,json:{code:'APPROVAL_REQUIRED'}});
    if(!receipt){stores++;const snapshot={projectId:pid,requestId:criteriaId(90),version:1,sequence:1,state:'WAITING',input:c.payload,assignmentRef:null,readinessIssues:['ASSIGNMENT_BINDING_UNVERIFIED','BASELINE_STATE_UNVERIFIED','EXECUTION_STATE_UNVERIFIED','DISPATCH_NOT_CONNECTED'],queuedAt:at,cancelledAt:null,cancelledBy:null,cancellationReason:null,requestedBy:{kind:'HUMAN',userId:actor,clientId},previousRef:null,slotReserved:false,writerReservationPerformed:false,executionAuthorized:false,dispatchPerformed:false},ref={id:snapshot.requestId,version:1,contentHash:criteriaHash(snapshot)};receipt=result(c,{ref,queueState:'WAITING',snapshot});if(mode==='LOST_START')return r.abort();}body=receipt;
   }else if(c.operation==='requestApproval'){
    if(!requestResult){const details=c.payload.details,scopeDigest=criteriaHash(details.actionScope),snapshot={projectId:pid,details,scopeDigest,requiredDecider:{kind:'HUMAN',userId:actor},policyRef:policyRef(),requestedBy:{kind:'HUMAN',userId:actor,clientId},controlGeneration:3},requestRef={id:requestId,version:1,contentHash:criteriaHash(snapshot)},request={id:requestId,version:1,status:'PENDING',...snapshot,createdAt:at};view={request,requestRef,currentVersion:1,storedStatus:'PENDING',effectiveState:'PENDING',decision:null,consumption:null,expired:false,basisCurrent:true,executionAuthorized:false,observedAt:at};requestResult=result(c,{ref:requestRef,status:'APPROVAL_REQUESTED',request});if(mode==='LOST_REQUEST')return r.abort();}body=requestResult;
   }else if(c.operation==='decideApproval'){
    if(!decisionResult){const snapshot={requestId,requestVersion:1,requestRef:view.requestRef,scopeDigest:view.request.scopeDigest,decision:c.payload.decision,reason:c.payload.reason,decidedBy:{kind:'HUMAN',userId:actor,clientId},controlGeneration:3,policyRef:policyRef()},ref={id:decisionId,version:1,contentHash:criteriaHash(snapshot)},value={id:decisionId,...snapshot,decidedAt:at};view={...view,currentVersion:2,storedStatus:c.payload.decision==='REJECT'?'REJECTED':'APPROVED',effectiveState:c.payload.decision==='REJECT'?'REJECTED':'APPROVED',decision:{ref,...value}};decisionResult=result(c,{ref,status:'APPROVAL_DECIDED',decision:value});}body=decisionResult;
   }else{unknown.push(c.operation);return r.abort();}
  }else{unknown.push(r.request().method()+' '+path);return r.abort();}
  return r.fulfill({json:body});
 });
 page.on('pageerror',e=>errors.push(e.message));const href=sessionDetailHref(pid,draftRef),panel=page.getByRole('region',{name:'단계 시작 요청 작성',exact:true});await page.goto('/'+href);await expect(panel).toBeVisible();await panel.getByRole('button',{name:'단계 요청 작성',exact:true}).click();await panel.getByRole('textbox',{name:'단계 요청 사유',exact:true}).fill('승인 후 같은 단계 요청 보관');
 if(mode==='AUTO'||mode==='AUTO_NULL'){await panel.getByLabel('단계 요청 방식',{exact:true}).selectOption('AUTO');await panel.getByLabel('단계 요청 끝 경계',{exact:true}).selectOption('test');}
 await panel.getByRole('button',{name:'단계 요청 명령 준비',exact:true}).click();await panel.getByRole('checkbox',{name:'대기 요청 보관만 수행하며 실행·예약이 아님을 확인합니다',exact:true}).check();expect(stores).toBe(0);await panel.getByRole('button',{name:'단계 대기 요청 등록',exact:true}).click();
 if(mode==='UNKNOWN412'){await expect(panel.getByRole('button',{name:'같은 시작 요청 명령 결과 재확인',exact:true})).toBeEnabled();await panel.getByRole('button',{name:'같은 시작 요청 명령 결과 재확인',exact:true}).click();await expect(panel.getByRole('button',{name:'단계 승인 요청 준비',exact:true})).toBeDisabled();expect(commands).toHaveLength(2);expect(commands[0]).toEqual(commands[1]);expect(stores).toBe(0);expect(unknown).toEqual([]);expect(errors).toEqual([]);return;}
 if(mode!=='AUTO_NULL'){
  await expect(panel.getByRole('button',{name:'단계 승인 요청 준비',exact:true})).toBeEnabled();expect(stores).toBe(0);await panel.getByRole('button',{name:'단계 승인 요청 준비',exact:true}).click();
  const approval=panel.getByRole('region',{name:'단계 원명령 일회 승인',exact:true});
  for(const label of ['단계 승인 요청 이유','단계 데이터 위험','단계 보안 위험','단계 비용 위험','단계 중단 영향','단계 미확인 사항','단계 복구 방법','단계 복구 한계'])await approval.getByRole('textbox',{name:label,exact:true}).fill('명시 검토');await approval.getByRole('textbox',{name:'단계 승인 만료 UTC',exact:true}).fill('2098-01-01T00:00:00.000Z');await approval.getByRole('button',{name:'단계 원명령 승인 요청 저장',exact:true}).click();
  if(mode==='LOST_REQUEST'){await expect(approval.getByRole('alert').filter({hasText:/^CONNECTION_LOST · 요청 결과 미확인, 같은 요청 보존$/})).toBeVisible();await approval.getByRole('button',{name:'같은 단계 승인 요청 결과 확인',exact:true}).click();expect(commands[1]).toEqual(commands[2]);}
  await expect(approval.getByRole('link',{name:'이 단계 승인 요청에서 별도 결정',exact:true})).toBeVisible();expect(stores).toBe(0);
  if(mode==='REVOKED_POLICY'){policyVersion=2;view.basisCurrent=false;view.effectiveState='REVOKED';}
  await approval.getByRole('link',{name:'이 단계 승인 요청에서 별도 결정',exact:true}).click();
  if(mode!=='REVOKED_POLICY'){await page.getByLabel('결정 이유',{exact:true}).fill('정확 범위 결정');await page.getByLabel('정확 범위·위험·복구 한계를 확인했습니다',{exact:true}).check();await page.getByRole('button',{name:mode==='REJECTED'?'거절':'이번만 승인',exact:true}).click();await expect(page.getByRole('heading',{name:mode==='REJECTED'?/요청 .* · REJECTED/:/요청 .* · APPROVED/,level:3})).toBeVisible();}
  expect(stores).toBe(0);const back=page.getByRole('link',{name:'단계 요청으로 돌아가 별도 승인 결박·등록',exact:true});await expect(back).toHaveAttribute('href',href);await back.click();await expect(panel).toBeVisible();
  if(mode==='REJECTED'||mode==='REVOKED_POLICY'){await panel.getByRole('button',{name:'단계 승인 종결 상태 확인',exact:true}).click();await expect(panel.getByRole('button',{name:'종결된 단계 승인 종료·입력 수정',exact:true})).toBeEnabled();await panel.getByRole('button',{name:'종결된 단계 승인 종료·입력 수정',exact:true}).click();await expect(panel.getByRole('textbox',{name:'단계 요청 사유',exact:true})).toBeEnabled();await expect(panel.getByRole('textbox',{name:'단계 요청 사유',exact:true})).toHaveValue('승인 후 같은 단계 요청 보관');await expect(panel).toContainText('종결된 단계 승인 1건 보존');expect(stores).toBe(0);expect(unknown).toEqual([]);expect(errors).toEqual([]);return;}
  await panel.getByRole('button',{name:'단계 승인 재조회·원 시작 요청 명령 결박',exact:true}).click();await expect(panel).toContainText('단계 승인 결박 확인');expect(stores).toBe(0);await panel.getByRole('checkbox',{name:'대기 요청 보관만 수행하며 실행·예약이 아님을 확인합니다',exact:true}).check();await panel.getByRole('button',{name:'단계 대기 요청 등록',exact:true}).click();
  if(mode==='LOST_START'){await expect(panel.getByRole('button',{name:'같은 시작 요청 명령 결과 재확인',exact:true})).toBeEnabled();await panel.getByRole('button',{name:'같은 시작 요청 명령 결과 재확인',exact:true}).click();}
 }
 await expect(panel).toContainText('단계 요청 보관 영수증 확인');expect(stores).toBe(1);await panel.getByRole('button',{name:'같은 WAITING 요청 원장 재조회',exact:true}).click();
 if(mode==='GET_FAIL'){await expect(panel.getByRole('alert').filter({hasText:/^STAGE_QUEUE_SOURCE_UNAVAILABLE · 입력과 고정 명령을 보존하며 자동 재전송하지 않습니다\.$/})).toBeVisible();expect(stores).toBe(1);await panel.getByRole('button',{name:'같은 WAITING 요청 원장 재조회',exact:true}).click();}
 await expect(panel).toContainText('동일 WAITING 요청 원장 확인');const starts=commands.filter(c=>c.operation==='startStage');if(mode!=='AUTO_NULL'){expect(starts.at(-1).commandId).toBe(starts[0].commandId);expect(starts.at(-1).payload).toEqual(starts[0].payload);expect(starts.at(-1).approvalRef).not.toBeNull();}
 if(mode==='LOST_START')expect(starts.at(-1)).toEqual(starts.at(-2));expect(receipt.data.snapshot.assignmentRef).toBeNull();for(const flag of ['slotReserved','writerReservationPerformed','executionAuthorized','dispatchPerformed'])expect(receipt.data.snapshot[flag]).toBe(false);expect(unknown).toEqual([]);expect(errors).toEqual([]);
});
