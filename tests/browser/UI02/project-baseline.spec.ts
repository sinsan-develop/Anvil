import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
import {ordered} from '../../../apps/web/src/features/knowledge/review-view.ts';
const pid='11000000-0000-4000-8000-000000000001',uid='11000000-0000-4000-8000-000000000002',cid='11000000-0000-4000-8000-000000000003',draftId='11000000-0000-4000-8000-000000000004',reviewId='11000000-0000-4000-8000-000000000005',adoptId='11000000-0000-4000-8000-000000000006';
const at='2026-10-18T07:00:00.000Z',flags={sourceAuthorizationVerified:false,coverageVerified:false,executionAuthorized:false,dispatchPerformed:false},hash=(v:unknown)=>createHash('sha256').update(ordered(v)).digest('hex');
const project={id:pid,name:'합성 기준선 프로젝트',purpose:'분류 원본 유지',desiredOutcome:'별도 사용자 채택',version:1,createdAt:at,updatedAt:at,currentMethodologyRef:null,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[],viewerPermissions:['READ_PROJECT'],participation:'OWNER',controlState:{actorId:uid,clientId:cid,generation:1,status:'HELD'}};
test('후보 화면은 분류 저장·내용 검토·별도 채택을 분리하며 이동 후 같은 초안과 원명령을 유지한다',async({page})=>{
 const calls:any[]=[],unexpected:string[]=[],drafts:any[]=[],reviews:any[]=[];let adopted:any=null,lost=true;
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
 await page.route('**/api/v1/projects/'+pid+'/commands',async route=>{
  const c=route.request().postDataJSON();calls.push(c);let snapshot:any,id:string,status:string;
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
 await panel.getByRole('button',{name:'새 기준선 초안 작성',exact:true}).click();
 await panel.getByLabel('미확인 이유',{exact:true}).fill('소스 관측 미실행');await panel.getByLabel('기능 범위·누락 가능성',{exact:true}).fill('한 기능의 분류 기록');await panel.getByLabel('초안 저장·개정 이유',{exact:true}).fill('시작 상태 보관');
 await panel.getByRole('button',{name:'기능 항목 추가',exact:true}).click();await panel.getByLabel('기능 ID',{exact:true}).fill('F1');await panel.getByLabel('기능 이름',{exact:true}).fill('미구현 기능');await panel.getByLabel('분류 이유',{exact:true}).fill('아직 구현하지 않음');await panel.getByLabel('미확인·한계',{exact:true}).fill('실제 동작 없음');
 await panel.getByRole('button',{name:'초안 저장 · 미확정',exact:true}).click();await expect(panel.getByRole('button',{name:'동일 원명령 재확인',exact:true})).toBeVisible();
 await page.evaluate(()=>{location.hash='#/settings';});await expect(panel).toHaveCount(0);await page.evaluate((id)=>{location.hash='#/projects/'+id+'/workspace';},pid);
 await expect(panel.getByLabel('기능 이름',{exact:true})).toHaveValue('미구현 기능');await panel.getByRole('button',{name:'동일 원명령 재확인',exact:true}).click();expect(calls[1]).toEqual(calls[0]);
 await panel.getByRole('button',{name:'저장된 정확 초안 내용 검토 시작',exact:true}).click();
 await expect(panel.getByLabel('항목 판정',{exact:true})).toHaveValue('NOT_EXECUTED');await panel.getByLabel('항목 판정',{exact:true}).selectOption('ACCEPTED');await panel.getByLabel('항목 내용 검토 이유',{exact:true}).fill('미구현 분류를 확인');await panel.getByLabel('범위 검토 판정',{exact:true}).selectOption('ACCEPTED');await panel.getByLabel('범위 검토 이유',{exact:true}).fill('한 기능 기록 범위 확인');await panel.getByLabel('전체 내용 검토 판정',{exact:true}).selectOption('ACCEPTED');await panel.getByLabel('전체 검토 이유',{exact:true}).fill('분류 내용 적합');
 await panel.getByRole('button',{name:'사용자 내용 검토 저장 · 아직 채택 아님',exact:true}).click();expect(calls.map(c=>c.operation)).toEqual(['saveBaselineDraft','saveBaselineDraft','reviewBaselineContent']);
 await panel.getByLabel('채택 이유',{exact:true}).fill('기능 상태 기록만 채택');await panel.getByRole('checkbox',{name:/기능 상태 기록을 채택합니다/}).check();await panel.getByRole('button',{name:'최신 적합 검토 재확인 후 이 버전 채택',exact:true}).click();await expect(panel.getByRole('heading',{name:'사용자가 채택한 기능 상태 기록',exact:true})).toBeVisible();
 expect(calls.at(-1).operation).toBe('confirmBaseline');expect(adopted.executionAuthorized).toBe(false);expect(unexpected).toEqual([]);
});
