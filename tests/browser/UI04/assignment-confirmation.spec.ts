import { test, expect, type Page } from '@playwright/test';
import { installWorkspaceBundle } from './bundle.ts';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
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
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!=='https://localhost:3830')unknown.push(r.url());});
 await page.goto(`/#/projects/${pid}/workspace`);await page.getByRole('button',{name:'임무 초안 목록 조회',exact:true}).click();await page.getByRole('button',{name:'임무 버전 열기: 1',exact:true}).click();return{commands,unknown,errors,reviews,get confirmed(){return confirmed;}};
}
async function fillReview(page:Page){await page.getByRole('button',{name:'임무 내용 검토 준비',exact:true}).click();for(const criterion of criteria){const judgment=page.getByRole('combobox',{name:`${criterion} 판단`,exact:true});await expect(judgment).toHaveValue('NOT_EXECUTED');await judgment.selectOption('ACCEPTED');await page.getByRole('textbox',{name:`${criterion} 이유`,exact:true}).fill('사람이 해당 기준을 검토');}await page.getByRole('combobox',{name:'임무 검토 종합 판단',exact:true}).selectOption('ACCEPTED');await page.getByRole('textbox',{name:'임무 내용 판단 이유',exact:true}).fill('내용만 검토·실행 조건은 미확인');await page.getByLabel('임무 내용 판단을 직접 확인했습니다',{exact:true}).check();}

for(const mode of ['DENIED','STALE'] as const) test('CHILD_PARENT_'+mode+' 부모 조회 실패는 기존 원문을 숨기고 저장 명령을 만들지 않는다',async({page})=>{
 const f=await setup(page);
 if(mode==='DENIED') await page.route('**/api/v1/projects/'+pid+'/assignment-drafts/'+id+'/versions/1',r=>r.fulfill({status:403,json:{code:'PERMISSION_DENIED'}}));
 else await page.route('**/api/v1/projects/'+pid+'/assignment-drafts/'+id+'/versions/1/decision',r=>r.fulfill({json:{projectId:pid,draftRef,criteriaVersion:1,criteria,reviews:[],hasMoreReviews:false,contentIssues:[],currentIssue:'VERSION_CONFLICT',confirmedRef:null,latestReviewAccepted:false,readinessIssues:snapshot.readinessIssues,ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt:at}}));
 await page.getByRole('button',{name:'이 임무를 부모로 하위 초안 준비',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText(mode==='DENIED'?'PERMISSION_DENIED':'ASSIGNMENT_PARENT_NOT_CURRENT');
 await expect(page.getByRole('region',{name:'저장한 임무 초안',exact:true})).toHaveCount(0);
 await expect(page.getByText('부모 연결 하위 초안 · 검토·확정·배정·실행 불가',{exact:true})).toHaveCount(0);
 expect(f.commands).toEqual([]);expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});

test('CHILD_DRAFT 명시 부모 조회·준비 뒤 별도 저장/정확 재조회와 후속 확정 차단',async({page})=>{
 const f=await setup(page); await fillReview(page);
 await page.getByRole('button',{name:'임무 내용 판단 저장',exact:true}).click();
 await expect(page.getByText('임무 내용 검토 저장 확인',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'임무 별도 확정 준비',exact:true}).click();
 await page.getByLabel('임무 내용 판단 이유',{exact:true}).fill('부모 내용 확정');
 await page.getByLabel('임무 내용 판단을 직접 확인했습니다',{exact:true}).check();
 await page.getByRole('button',{name:'임무 내용 판단 저장',exact:true}).click();
 await expect(page.getByText('임무 내용 확정 저장 확인 · 실행 허가 아님',{exact:true})).toBeVisible();
 const commands:any[]=[];let saved:any=null;
 await page.route('**/api/v1/projects/'+pid+'/commands',r=>{
   const c=r.request().postDataJSON();commands.push(c);expect(c.operation).toBe('prepareAssignment');expect(c.payload.definition.parentAssignmentRef).toEqual(f.confirmed.ref);
   const s={...structuredClone(snapshot),definition:c.payload.definition,reason:c.payload.reason,basis:{...snapshot.basis,taskCode:c.payload.definition.taskRef.taskCode,taskCardHash:contentHash(canonicalJson(childTaskPlanSnapshot.tasks.find(task=>task.taskCode===c.payload.definition.taskRef.taskCode)))}},childRef={id:'99999999-9999-4999-8999-999999999999',version:1,contentHash:contentHash(canonicalJson(s))};
   saved={projectId:pid,ref:childRef,snapshot:s,headVersion:1,sourceCurrentness:'NOT_RECHECKED',observedAt:at};
   return r.fulfill({json:{operationId:childRef.id,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:childRef.id,version:1,data:{ref:childRef,status:'ASSIGNMENT_DRAFT_STORED',snapshot:s},evidenceRefs:[],warnings:[],serverReceivedAt:at}});
 });
 await page.route('**/api/v1/projects/'+pid+'/assignment-drafts/99999999-9999-4999-8999-999999999999/versions/1',r=>r.fulfill({json:saved}));
 await page.getByRole('button',{name:'이 임무를 부모로 하위 초안 준비',exact:true}).click();
 expect(commands).toHaveLength(0);
 await expect(page.getByText('부모 연결 하위 초안 · 검토·확정·배정·실행 불가',{exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:'임무 목표',exact:true}).fill('한정 하위 목표');
 const taskSelection=page.getByRole('region',{name:'하위 초안 계획 업무 선택',exact:true});
 await taskSelection.getByRole('button',{name:'하위 초안의 고정 계획 조회',exact:true}).click();
 await taskSelection.getByRole('combobox',{name:'하위 초안의 계획 업무',exact:true}).selectOption('FN02');
 await expect(page.getByRole('textbox',{name:'임무 목표',exact:true})).toHaveValue('한정 하위 목표');
 expect(commands).toHaveLength(0);
 await taskSelection.getByRole('button',{name:'선택 업무 코드만 하위 초안에 반영',exact:true}).click();
 await expect(page.getByRole('group',{name:'작성 중인 임무 · FN02',exact:true})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'임무 목표',exact:true})).toHaveValue('한정 하위 목표');
 await page.route('**/api/v1/projects/'+pid+'/work-plans/'+planRef.id+'/versions/1',r=>r.fulfill({status:403,json:{code:'PERMISSION_DENIED'}}));
 await taskSelection.getByRole('button',{name:'하위 초안의 고정 계획 조회',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('PERMISSION_DENIED');
 await expect(taskSelection.getByRole('combobox',{name:'하위 초안의 계획 업무',exact:true})).toHaveCount(0);
 await expect(page.getByRole('textbox',{name:'임무 목표',exact:true})).toHaveValue('한정 하위 목표');
 const tampered=structuredClone(childTaskPlan);tampered.tasks[1]!.title='해시와 다른 내용';
 await page.route('**/api/v1/projects/'+pid+'/work-plans/'+planRef.id+'/versions/1',r=>r.fulfill({json:tampered}));
 await taskSelection.getByRole('button',{name:'하위 초안의 고정 계획 조회',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('WORK_PLAN_INTEGRITY_FAILED');
 await expect(taskSelection.getByRole('combobox',{name:'하위 초안의 계획 업무',exact:true})).toHaveCount(0);
 await expect(page.getByRole('group',{name:'작성 중인 임무 · FN02',exact:true})).toBeVisible();
 expect(commands).toHaveLength(0);
 await page.getByRole('textbox',{name:'임무 저장 이유',exact:true}).fill('부모 연결 초안 저장');
 await page.getByRole('button',{name:'임무 초안 저장',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('임무 초안 저장 확인');
 expect(commands).toHaveLength(1);expect(commands[0].payload.definition.goal).toBe('한정 하위 목표');expect(commands[0].payload.definition.taskRef.taskCode).toBe('FN02');
 await page.getByRole('button',{name:'저장 버전 재조회',exact:true}).click();
 await expect(page.getByText('저장 버전 재조회 확인',{exact:true})).toBeVisible();
 const stored=page.getByRole('region',{name:'저장한 임무 초안',exact:true});
 await expect(stored.getByText(f.confirmed.ref.id+' · v1 · '+f.confirmed.ref.contentHash+' · 초안 연결이며 위임·실행 허가 아님',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'임무 내용 검토 준비',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'임무 별도 확정 준비',exact:true})).toHaveCount(0);
 expect(f.commands.map(c=>c.operation)).toEqual(['reviewAssignmentContent','confirmAssignment']);
 expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});

for(const mode of ['OTHER','HASH']as const)test('RESPONSIBLE_SELECTION_'+mode+' 후보 페이지가 바뀌어도 정확 원 선택과 이유를 보존한다',async({page})=>{
 const f=await setup(page);await fillReview(page);await page.getByRole('button',{name:'임무 내용 판단 저장',exact:true}).click();await expect(page.getByText('임무 내용 검토 저장 확인',{exact:true})).toBeVisible();await page.getByRole('button',{name:'임무 별도 확정 준비',exact:true}).click();await page.getByLabel('임무 내용 판단 이유',{exact:true}).fill('예약 입력 전 내용 확정');await page.getByLabel('임무 내용 판단을 직접 확인했습니다',{exact:true}).check();await page.getByRole('button',{name:'임무 내용 판단 저장',exact:true}).click();await expect(page.getByText('임무 내용 확정 저장 확인 · 실행 허가 아님',{exact:true})).toBeVisible();
 const original={id:'77777777-7777-4777-8777-777777777777',version:1,contentHash:'a'.repeat(64)},other=mode==='OTHER'?{...original,id:'88888888-8888-4888-8888-888888888888'}:{...original,contentHash:'b'.repeat(64)};let pages=0;
 await page.route(`**/api/v1/projects/${pid}/assignments/${id}/versions/1/execution-preparation-state`,r=>r.fulfill({json:{projectId:pid,assignmentRef:f.confirmed.ref,roles:[],bindings:[],preparations:[],hasMorePreparations:false,currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false}}));
 await page.route(`**/api/v1/projects/${pid}/connection-candidates?*`,r=>{pages++;const next=new URL(r.request().url()).searchParams.has('cursor');return r.fulfill({json:{view:'CANDIDATES_ONLY',items:[{ref:next?other:original,kind:'CONNECTION_CANDIDATE',label:next?'다음 페이지 후보':'원 선택 후보',readiness:'NOT_READY',expiresAt:'2027-01-01T00:00:00.000Z',integrity:'NOT_RECHECKED'}],hasMore:!next,nextCursor:next?null:'next-page',observedAt:at}});});
 await page.getByRole('button',{name:'확정 임무 원본 재조회',exact:true}).click();
 const panel=page.getByRole('region',{name:'책임 역할·예약 세션',exact:true});await panel.getByRole('button',{name:'책임 세션 입력 준비',exact:true}).click();await panel.getByRole('button',{name:'현재 역할·예약·준비 이력 조회',exact:true}).click();const select=panel.getByRole('combobox',{name:'기존 코딩 Agent 연결 후보',exact:true});await select.selectOption(canonicalJson(original));await panel.getByRole('textbox',{name:'책임 역할·예약 이유',exact:true}).fill('원 도구 선택 유지');await panel.getByRole('button',{name:'다음 연결 후보 조회',exact:true}).click();await expect.poll(()=>pages).toBe(2);await expect(select).toHaveValue(canonicalJson(original));await expect(select.locator('option:checked')).toContainText('보관 선택');await expect(panel).toContainText(original.contentHash);await expect(panel.getByRole('textbox',{name:'책임 역할·예약 이유',exact:true})).toHaveValue('원 도구 선택 유지');expect(f.commands.map(c=>c.operation)).toEqual(['reviewAssignmentContent','confirmAssignment']);expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});

test('UI04_REVIEW_DETAIL 보관6항목/이유·원문ref를읽고불신본문텍스트/거절숨김·쓰기0',async({page})=>{const f=await setup(page),reviewId='44444444-4444-4444-8444-444444444444',payload={draftRef,criteriaVersion:1,items:criteria.map((criterionId,index)=>({criterionId,outcome:index?'ACCEPTED':'REWORK',reason:index?'보관 이유 '+criterionId:'<script>window.bad=1</script> 설계 보완 필요',evidenceRefs:[]})),outcome:'REWORK',reason:'원문을 기준으로 재작업',reviewedBy:{kind:'HUMAN',userId:user},reviewedAt:at,independence:'NOT_CLAIMED'},ref={id:reviewId,version:1,contentHash:contentHash(canonicalJson(payload))};f.reviews.push({ref,snapshot:payload,serverSequence:7,sameAuthor:true});await page.getByRole('button',{name:'임무 판단 이력 조회',exact:true}).click();const details=page.getByRole('region',{name:'보관 임무 검토 상세 '+reviewId,exact:true});await page.getByText('항목별 보관 검토 보기',{exact:true}).click();await expect(details).toBeVisible();for(const item of payload.items)await expect(details.getByText(item.reason,{exact:true})).toBeVisible();await expect(details).toContainText(ref.contentHash);await expect(details).toContainText('현재 실행·배정 허가 아님');expect(await page.evaluate(()=>Object.prototype.hasOwnProperty.call(window,'bad'))).toBe(false);await page.route(`**/api/v1/projects/${pid}/assignment-drafts/${id}/versions/1/decision`,r=>r.fulfill({status:403,json:{code:'PERMISSION_DENIED'}}));await page.getByRole('button',{name:'임무 판단 이력 조회',exact:true}).click();await expect(page.getByRole('alert')).toContainText('PERMISSION_DENIED');await expect(details).toHaveCount(0);expect(f.commands).toEqual([]);expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);});
test('임무 6기준 검토·별도 확정은 실행 허가가 아니며 재준비 조회 거절 시 이전 원문을 숨긴다',async({page})=>{const f=await setup(page);await fillReview(page);await page.getByRole('button',{name:'임무 내용 판단 저장',exact:true}).click();await expect(page.getByText('임무 내용 검토 저장 확인',{exact:true})).toBeVisible();await page.getByRole('button',{name:'임무 별도 확정 준비',exact:true}).click();await page.getByLabel('임무 내용 판단 이유',{exact:true}).fill('별도 내용 확정');await page.getByLabel('임무 내용 판단을 직접 확인했습니다',{exact:true}).check();await page.getByRole('button',{name:'임무 내용 판단 저장',exact:true}).click();await expect(page.getByText('임무 내용 확정 저장 확인 · 실행 허가 아님',{exact:true})).toBeVisible();await page.getByRole('button',{name:'확정 임무 원본 재조회',exact:true}).click();await expect(page.getByRole('region',{name:'내용 확정 임무',exact:true})).toContainText('실행 허가 없음');await page.route(`**/api/v1/projects/${pid}/assignment-drafts/${id}/versions/1`,r=>r.fulfill({status:403,json:{code:'PERMISSION_DENIED'}}));const denied=page.waitForResponse(r=>r.url().endsWith(`/assignment-drafts/${id}/versions/1`)&&r.status()===403);await page.getByRole('button',{name:'임무 내용 검토 준비',exact:true}).click();await denied;await expect(page.getByRole('alert')).toContainText('PERMISSION_DENIED');await expect(page.getByRole('region',{name:'내용 확정 임무',exact:true})).toHaveCount(0);expect(f.commands.map(c=>c.operation)).toEqual(['reviewAssignmentContent','confirmAssignment']);expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);});
test('검토 응답 유실 뒤 화면을 이동해도 원 판단과 같은 명령만 재확인한다',async({page})=>{const f=await setup(page,true);await fillReview(page);await page.getByRole('button',{name:'임무 내용 판단 저장',exact:true}).click();await expect(page.getByRole('alert')).toContainText('CONNECTION_LOST');await page.evaluate(value=>{location.hash=`/projects/${value}/session`;},pid);await expect(page.getByText('프로젝트 작업에서 임무를 선택하고 확정 원본의 ‘책임자·실행 상세’로 이동하세요.',{exact:true})).toBeVisible();await page.evaluate(value=>{location.hash=`/projects/${value}/workspace`;},pid);await expect(page.getByRole('textbox',{name:'임무 내용 판단 이유',exact:true})).toHaveValue('내용만 검토·실행 조건은 미확인');const retry=page.getByRole('button',{name:'같은 임무 판단 명령 결과 확인',exact:true}).and(page.locator('button:enabled'));await expect(retry).toHaveCount(1);await retry.click();await expect(page.getByText('임무 내용 검토 저장 확인',{exact:true})).toBeVisible();expect(f.commands).toHaveLength(2);expect(f.commands[1]).toEqual(f.commands[0]);expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);});
