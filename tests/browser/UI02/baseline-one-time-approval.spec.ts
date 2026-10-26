import {test,expect} from '@playwright/test';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createHash} from 'node:crypto';
import {ordered} from '../../../apps/web/src/features/knowledge/review-view.ts';
const pid='11000000-0000-4000-8000-000000000001',uid='11000000-0000-4000-8000-000000000002',cid='11000000-0000-4000-8000-000000000003',draftId='11000000-0000-4000-8000-000000000004',reviewId='11000000-0000-4000-8000-000000000005',adoptId='11000000-0000-4000-8000-000000000006';
const at='2026-10-18T07:00:00.000Z',flags={sourceAuthorizationVerified:false,coverageVerified:false,executionAuthorized:false,dispatchPerformed:false},hash=(v:unknown)=>createHash('sha256').update(ordered(v)).digest('hex');
const project={id:pid,name:'합성 기준선 프로젝트',purpose:'분류 원본 유지',desiredOutcome:'별도 사용자 채택',version:1,createdAt:at,updatedAt:at,currentMethodologyRef:null,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[],viewerPermissions:['READ_PROJECT'],participation:'OWNER',controlState:{actorId:uid,clientId:cid,generation:1,status:'HELD'}};
test('기준선 저장·검토·채택은 각 원명령에 다른 일회 승인을 별도 결박·집행한다',async({page})=>{
 const calls:any[]=[],unexpected:string[]=[],drafts:any[]=[],reviews:any[]=[];let adopted:any=null,lost=false;const approvals=new Map<string,any>(),applied:string[]=[],attempts:any[]=[];
 const policyBody={rules:[{ruleId:'BASELINE',subjectRef:{kind:'HUMAN',userId:uid},operations:['saveBaselineDraft','reviewBaselineContent','confirmBaseline'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'REQUIRE_APPROVAL',limitPolicyRef:null,expiresAt:new Date(Date.now()+300000).toISOString()}],reason:'각 원명령 승인',reviewRefs:[]},policyRef={id:uid,version:1,contentHash:hash(policyBody)};
 const root=process.env.ANVIL_UI02_BASELINE_APPROVAL_DIST;if(root!=='D:/tmp/anvil-v3-stage-b/ui02-baseline-approval-20261027-01/dist')throw Error('BASELINE_APPROVAL_DIST_NOT_REGISTERED');
 const files=new Map<string,any>();files.set('/',{body:await readFile(root+'/index.html'),contentType:'text/html'});for(const name of await readdir(root+'/assets')){if(!/^index-[A-Za-z0-9_-]+\.(js|css)$/.test(name))throw Error('BASELINE_APPROVAL_ASSET_UNEXPECTED');files.set('/assets/'+name,{body:await readFile(root+'/assets/'+name),contentType:name.endsWith('.js')?'text/javascript':'text/css'});}
 await page.route(/^https:\/\/localhost:3830\/(?:$|assets\/)/,r=>{const f=files.get(new URL(r.request().url()).pathname);return f&&r.request().method()==='GET'?r.fulfill({status:200,...f}):r.abort();});
 await page.route('**/api/v1/**',route=>{unexpected.push(new URL(route.request().url()).pathname);return route.fulfill({status:503,json:{code:'UNEXPECTED_QA_API'}});});
 await page.route('**/api/v1/session',route=>route.fulfill({json:{user:{id:uid,displayName:'합성 사용자'},clientId:cid,csrfToken:'C'.repeat(43)}}));
 await page.route('**/api/v1/projects/'+pid,route=>route.fulfill({json:project}));
 await page.route('**/api/v1/projects?*',route=>route.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:at,baselineVersion:null}}));
 await page.route('**/api/v1/projects/'+pid+'/conversations?*',route=>route.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:at}}));
 await page.route('**/api/v1/projects/'+pid+'/methodology-application',route=>route.fulfill({json:{projectId:pid,applicationRef:null,snapshot:null,observedAt:at,executionState:'NOT_CONNECTED'}}));
 // Adjacent workspace metadata queries stay explicit; this is not an actual DB/authorization test.
 await page.route('**/api/v1/projects/'+pid+'/documents?*',route=>route.fulfill({json:{projectId:pid,items:[],hasMore:false,nextCursor:null,observedAt:at}}));
 await page.route('**/api/v1/projects/'+pid+'/baseline-drafts?*',route=>route.fulfill({json:{projectId:pid,items:drafts.map(d=>({ref:d.ref,status:'DRAFT'})),hasMore:false,nextCursor:null,metadataIntegrity:'NOT_RECHECKED',...flags}}));
 await page.route('**/api/v1/projects/'+pid+'/baseline-current',route=>route.fulfill({json:adopted??{projectId:pid,status:'UNCONFIRMED',ref:null,contentConfirmed:false,...flags}}));
 await page.route('**/api/v1/projects/'+pid+'/baseline-drafts/*/versions/1/decision',route=>route.fulfill({json:{projectId:pid,draftRef:drafts[0]?.ref,criteriaVersion:1,reviews,hasMoreReviews:false,latestReviewAccepted:reviews[0]?.snapshot.input.outcome==='ACCEPTED',adoptedRef:adopted?.ref??null,draftIsHead:true,currentCheck:{state:'MATCHED_METADATA',issues:[]},contentConfirmed:!!adopted,...flags,observedAt:at}}));
 await page.route('**/api/v1/projects/'+pid+'/baseline-drafts/*/versions/1',route=>route.fulfill({json:{projectId:pid,...drafts[0],headVersion:1,currentCheck:{state:'MATCHED_METADATA',issues:[]},contentConfirmed:false,...flags,observedAt:at}}));
 await page.route('**/api/v1/projects/'+pid+'/permission-policy',r=>r.fulfill({json:{configured:true,policy:{ref:policyRef,...policyBody,createdAt:at}}}));
 await page.route('**/api/v1/projects/'+pid+'/approvals?*',r=>r.fulfill({json:{items:[...approvals.values()].map(v=>({id:v.request.id,currentVersion:v.currentVersion,storedStatus:v.storedStatus,effectiveState:v.effectiveState,operation:v.request.details.actionScope.operation,targetRef:v.request.details.actionScope.targetRef,scopeDigest:v.request.scopeDigest,expiresAt:v.request.details.expiresAt,createdAt:at,integrity:'NOT_RECHECKED'})),hasMore:false,nextCursor:null,observedAt:at}}));
 await page.route('**/api/v1/projects/'+pid+'/approvals/*',r=>r.fulfill({json:approvals.get(new URL(r.request().url()).pathname.split('/').at(-1)!)}));
 await page.route('**/api/v1/projects/'+pid+'/commands',async route=>{
  const c=route.request().postDataJSON();calls.push(c);
  const receipt=(data:any,id:string)=>({commandId:c.commandId,projectId:pid,status:'APPLIED',operationId:id,targetId:id,version:1,serverReceivedAt:at,data});
  if(c.operation==='requestApproval'){
   const id=randomUUID(),details=c.payload.details,scopeDigest=hash(details.actionScope),body={projectId:pid,details,scopeDigest,requiredDecider:{kind:'HUMAN',userId:uid},policyRef,requestedBy:{kind:'HUMAN',userId:uid,clientId:cid},controlGeneration:1},ref={id,version:1,contentHash:hash(body)},request={id,version:1,status:'PENDING',...body,createdAt:at};
   approvals.set(id,{request,requestRef:ref,currentVersion:1,storedStatus:'PENDING',effectiveState:'PENDING',decision:null,consumption:null,expired:false,basisCurrent:true,executionAuthorized:false,observedAt:at});
   return route.fulfill({json:receipt({status:'APPROVAL_REQUESTED',ref,request},id)});
  }
  if(c.operation==='decideApproval'){
   const v=approvals.get(c.payload.requestId),id=randomUUID(),body={requestId:v.request.id,requestVersion:1,requestRef:v.requestRef,scopeDigest:v.request.scopeDigest,decision:c.payload.decision,reason:c.payload.reason,decidedBy:{kind:'HUMAN',userId:uid,clientId:cid},controlGeneration:1,policyRef},ref={id,version:1,contentHash:hash(body)},decision={id,...body,decidedAt:at};
   v.decision={ref,...decision};v.currentVersion=2;v.storedStatus='APPROVED';v.effectiveState='APPROVED';
   return route.fulfill({json:receipt({status:'APPROVAL_DECIDED',ref,decision},id)});
  }
  attempts.push(c);if(!c.approvalRef){expect(applied).not.toContain(c.commandId);return route.fulfill({status:412,json:{code:'APPROVAL_REQUIRED'}});}
  const view=approvals.get(c.approvalRef.requestId);expect(view.effectiveState).toBe('APPROVED');expect(view.request.details.candidateCommandId).toBe(c.commandId);expect(view.request.details.actionScope.payloadHash).toBe(hash(c.payload));expect(view.request.details.actionScope.operation).toBe(c.operation);applied.push(c.commandId);
  let snapshot:any,id:string,status:string;

  if(c.operation==='saveBaselineDraft'){
   snapshot={schemaVersion:1,input:c.payload,sourceBinding:{kind:'NONE_SELECTED',declaration:null,observation:null,declarationReportRelation:'UNVERIFIED'},evidenceBindings:c.payload.items.map((i:any)=>({itemId:i.itemId,evidenceRefs:i.evidenceRefs})),issues:[{code:'CONTENT_REVIEW_REQUIRED',location:'items'},{code:'SOURCE_UNVERIFIED',location:'source'},{code:'COVERAGE_UNVERIFIED',location:'coverageReason'},{code:'EXECUTION_NOT_CONNECTED',location:'execution'}],recordedBy:{kind:'HUMAN',userId:uid},recordedAt:at,contentConfirmed:false,...flags};id=draftId;status='BASELINE_DRAFT_STORED';
  }else if(c.operation==='reviewBaselineContent'){snapshot={input:c.payload,reviewedBy:{kind:'HUMAN',userId:uid},reviewedAt:at,independence:'NOT_CLAIMED'};id=reviewId;status='BASELINE_CONTENT_REVIEWED';}
  else{expect(c.operation).toBe('confirmBaseline');snapshot={schemaVersion:1,kind:'FEATURE_STATUS_V1',draftRef:drafts[0].ref,input:drafts[0].snapshot.input,sourceBinding:drafts[0].snapshot.sourceBinding,evidenceBindings:drafts[0].snapshot.evidenceBindings,reviewRefs:c.payload.reviewRefs,previousBaselineRef:null,reason:c.payload.reason,acknowledged:true,adoptedBy:{kind:'HUMAN',userId:uid},adoptedAt:at,contentConfirmed:true,...flags};id=adoptId;status='FEATURE_BASELINE_ADOPTED';}
  const ref={id,version:1,contentHash:hash(snapshot)};
  if(c.operation==='saveBaselineDraft')drafts[0]={ref,snapshot};else if(c.operation==='reviewBaselineContent')reviews.unshift({ref,snapshot,serverSequence:2});else adopted={projectId:pid,status:'FEATURE_STATUS_V1',ref,snapshot,currentCheck:{state:'MATCHED_METADATA',issues:[]},currentContentReviewValid:true,contentConfirmed:true,...flags,observedAt:at};
  if(c.operation==='saveBaselineDraft'&&lost){lost=false;return route.abort('connectionreset');}
  return route.fulfill({json:{commandId:c.commandId,projectId:pid,status:'APPLIED',operationId:id,targetId:id,version:1,serverReceivedAt:at,data:{status,ref,snapshot}}});
 });
 await page.goto('/#/projects/'+pid+'/workspace');const panel=page.getByRole('region',{name:'기능 상태 시작 기준선',exact:true});
 async function approve(){
  const count=applied.length,editor=panel.getByRole('region',{name:'기준선 원명령 일회 승인',exact:true});await editor.getByRole('button',{name:'기준선 승인 요청 준비',exact:true}).click();
  expect(applied).toHaveLength(count);for(const label of ['기준선 승인 요청 이유','기준선 데이터 위험','기준선 보안 위험','기준선 비용 위험','기준선 중단 영향','기준선 미확인 사항','기준선 복구 방법','기준선 복구 한계'])await editor.getByLabel(label,{exact:true}).fill(label+' 확인');await editor.getByLabel('기준선 승인 만료 UTC',{exact:true}).fill(new Date(Date.now()+60000).toISOString());
  await editor.getByRole('button',{name:'기준선 원명령 승인 요청 저장',exact:true}).click();await editor.getByRole('link',{name:'이 기준선 승인 요청에서 별도 결정',exact:true}).click();expect(applied).toHaveLength(count);
  const detail=page.getByRole('region',{name:'승인 요청 상세',exact:true});await detail.getByLabel('결정 이유',{exact:true}).fill('해당 원명령만 확인');await detail.getByRole('checkbox',{name:'정확 범위·위험·복구 한계를 확인했습니다'}).check();await detail.getByRole('button',{name:'이번만 승인',exact:true}).click();await expect(detail.getByRole('heading',{level:3})).toContainText('APPROVED');await expect(detail.getByRole('button',{name:'같은 결정 명령 결과 확인',exact:true})).toHaveCount(0);expect(applied).toHaveLength(count);await page.getByRole('button',{name:'결정 입력 닫기',exact:true}).click();
  await detail.getByRole('link',{name:'기준선으로 돌아가 별도 승인 결박·실행',exact:true}).click();await editor.getByRole('button',{name:'기준선 승인 재조회·원 기준선 명령 결박',exact:true}).click();await expect(editor.getByText('기준선 승인 결박 확인 · 동일 원명령 재확인으로 별도 실행하세요.',{exact:true})).toBeVisible();expect(applied).toHaveLength(count);await panel.getByRole('button',{name:'동일 원명령 재확인',exact:true}).click();await expect.poll(()=>applied.length).toBe(count+1);await expect(editor).toHaveCount(0);
 }

 await panel.getByRole('button',{name:'새 기준선 초안 작성',exact:true}).click();
 await panel.getByLabel('미확인 이유',{exact:true}).fill('소스 관측 미실행');await panel.getByLabel('기능 범위·누락 가능성',{exact:true}).fill('한 기능의 분류 기록');await panel.getByLabel('초안 저장·개정 이유',{exact:true}).fill('시작 상태 보관');
 await panel.getByRole('button',{name:'기능 항목 추가',exact:true}).click();await panel.getByLabel('기능 ID',{exact:true}).fill('F1');await panel.getByLabel('기능 이름',{exact:true}).fill('미구현 기능');await panel.getByLabel('분류 이유',{exact:true}).fill('아직 구현하지 않음');await panel.getByLabel('미확인·한계',{exact:true}).fill('실제 동작 없음');
 await panel.getByRole('button',{name:'초안 저장 · 미확정',exact:true}).click();await expect(panel.getByRole('button',{name:'동일 원명령 재확인',exact:true})).toBeVisible();
 await approve();
 await panel.getByRole('button',{name:'저장된 정확 초안 내용 검토 시작',exact:true}).click();
 const review=panel.getByRole('group',{name:'책임 있는 사용자 내용 검토 · 독립 검토 자동 주장 없음',exact:true});await expect(review).toBeVisible();await expect(review.getByRole('heading',{name:'F1 · 미구현',level:4,exact:true})).toHaveCount(1);await expect(review.getByRole('combobox',{name:'항목 판정',exact:true})).toHaveCount(1);await expect(review.getByRole('combobox',{name:'항목 판정',exact:true})).toHaveValue('NOT_EXECUTED');await review.getByRole('combobox',{name:'항목 판정',exact:true}).selectOption('ACCEPTED');await panel.getByLabel('항목 내용 검토 이유',{exact:true}).fill('미구현 분류를 확인');await review.getByRole('combobox',{name:'범위 검토 판정',exact:true}).selectOption('ACCEPTED');await panel.getByLabel('범위 검토 이유',{exact:true}).fill('한 기능 기록 범위 확인');await review.getByRole('combobox',{name:'전체 내용 검토 판정',exact:true}).selectOption('ACCEPTED');await panel.getByLabel('전체 검토 이유',{exact:true}).fill('분류 내용 적합');
 await panel.getByRole('button',{name:'사용자 내용 검토 저장 · 아직 채택 아님',exact:true}).click();await approve();
 await panel.getByLabel('채택 이유',{exact:true}).fill('기능 상태 기록만 채택');await panel.getByRole('checkbox',{name:/기능 상태 기록을 채택합니다/}).check();await panel.getByRole('button',{name:'최신 적합 검토 재확인 후 이 버전 채택',exact:true}).click();await approve();await expect(panel.getByRole('heading',{name:'사용자가 채택한 기능 상태 기록',exact:true})).toBeVisible();
 expect(applied).toHaveLength(3);expect(new Set(applied).size).toBe(3);expect(approvals.size).toBe(3);for(let n=0;n<3;n++){expect(attempts[n*2].approvalRef).toBeNull();expect(attempts[n*2+1].commandId).toBe(attempts[n*2].commandId);expect(attempts[n*2+1].payload).toEqual(attempts[n*2].payload);}
 expect(calls.at(-1).operation).toBe('confirmBaseline');expect(adopted.executionAuthorized).toBe(false);expect(unexpected).toEqual([]);
});
