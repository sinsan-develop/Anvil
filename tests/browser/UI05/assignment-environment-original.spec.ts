import {test,expect,type Page} from '@playwright/test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {contentCriteria} from '../../../apps/web/src/features/workspace/assignment-confirmation-api.ts';
import {sessionDetailHref} from '../../../apps/web/src/shell/routes.ts';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
import {environmentOriginal,environmentProject as pid} from '../../unit/UI05/environment-original-fixture.ts';
const aid='22222222-2222-4222-8222-222222222222',at='2026-10-20T00:00:00.000Z',ref={id:pid,version:1,contentHash:'a'.repeat(64)},hash=(v:unknown)=>contentHash(canonicalJson(v));
async function setup(page:Page){
 const environment=environmentOriginal(),definition={taskRef:{planRef:ref,taskCode:'FN09',applicationRef:ref,nodeId:'개발'},baselineRefs:[],allowedScopes:[],environmentRef:environment.ref,budgetRef:null,parentAssignmentRef:null,recordingPolicyRef:null,purpose:'개발 통제',goal:'확정 임무 환경 조회',ownerRole:'단계책임자',integrationResponsibility:'검수',inputs:['설계'],outputs:['구현'],acceptanceCriteria:['동작'],verificationRequirements:['실패'],included:['임무'],excluded:['운영'],requiredCapabilities:[]};
 const snapshot={definition,reason:'고정 원문',previousRef:null,basis:{planRef:ref,applicationRef:ref,designRef:ref,taskCode:'FN09',nodeId:'개발',taskCardHash:'b'.repeat(64)},readinessIssues:[],status:'DRAFT',ready:false,executionAuthorized:false,dispatchPerformed:false},draftRef={id:aid,version:1,contentHash:hash(snapshot)},draft={projectId:pid,ref:draftRef,snapshot,headVersion:1,sourceCurrentness:'NOT_RECHECKED',observedAt:at};
 const cs={draftRef,definition,reviewRefs:[ref],reason:'과거 내용 확정',confirmedBy:{kind:'HUMAN',userId:pid},confirmedAt:at,contentConfirmed:true,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false},cr={id:aid,version:1,contentHash:hash(cs)},confirmed={projectId:pid,ref:cr,snapshot:cs,observedAt:at},decision={projectId:pid,draftRef,criteriaVersion:1,criteria:contentCriteria,reviews:[],hasMoreReviews:false,contentIssues:[],currentIssue:'REVIEW_REQUIRED',confirmedRef:cr,latestReviewAccepted:false,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt:at},state={projectId:pid,assignmentRef:cr,roles:[],bindings:[],preparations:[],hasMorePreparations:false,currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false};
 const unknown:string[]=[],writes:string[]=[],errors:string[]=[];let mode='GOOD',reads=0,release:()=>void=()=>{};
 await page.route('**/*',r=>{unknown.push(r.request().url());return r.abort();});await installWorkspaceBundle(page);
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:pid,displayName:'환경 조회 QA'},clientId:pid,csrfToken:'A'.repeat(43)}}));
 await page.route('**/api/v1/auth/setup',r=>r.fulfill({json:{setupRequired:false,policyVersion:1}}));
 await page.route(`**/api/v1/projects/${pid}/**`,async r=>{const path=new URL(r.request().url()).pathname,base=`/api/v1/projects/${pid}/`;let value:unknown;
  if(path===base+`assignment-drafts/${aid}/versions/1`)value=draft;
  else if(path===base+`assignment-drafts/${aid}/versions/1/decision`)value=decision;
  else if(path===base+`assignments/${aid}/versions/1`)value=confirmed;
  else if(path===base+`assignments/${aid}/versions/1/execution-preparation-state`)value=state;
  else if(path===base+`assignments/${aid}/versions/1/result-pages`)value={projectId:pid,assignmentRef:cr,items:[],hasMore:false,nextCursor:null,selectionState:'NOT_SELECTED',observedAt:at};
  else if(path===base+`connection-candidates/${environment.ref.id}/versions/2`){reads++;if(mode==='DELAY')await new Promise<void>(resolve=>release=resolve);if(mode==='DENIED')return r.fulfill({status:403,json:{code:'ACCESS_DENIED'}});value=environment;}
  else{unknown.push(path);return r.abort();}return r.fulfill({json:value});
 });
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());if(new URL(r.url()).origin!=='https://localhost:3830')unknown.push(r.url());});
 await page.goto('https://localhost:3830/'+sessionDetailHref(pid,draftRef));
 return{set(m:string){mode=m;},reads:()=>reads,release:()=>release(),clean(){expect(writes).toEqual([]);expect(unknown).toEqual([]);expect(errors).toEqual([]);}};
}
const panel=(p:Page)=>p.getByRole('region',{name:'고정 임무 환경 원문',exact:true});
test('ENVIRONMENT_ORIGINAL 과거 고정 환경은 명시 GET만 읽고 만료/NOT_READY를 유지한다',async({page})=>{
 const s=await setup(page);await expect(panel(page)).toBeVisible();expect(s.reads()).toBe(0);
 await panel(page).getByRole('button',{name:'고정 환경 원문 보기',exact:true}).click();await expect(panel(page)).toContainText('고정 환경 후보');await expect(panel(page)).toContainText('기한 경과');await expect(panel(page)).toContainText('NOT_READY');await expect(panel(page)).toContainText('UNVERIFIED');expect(s.reads()).toBe(1);
 s.set('DENIED');await panel(page).getByRole('button',{name:'고정 환경 원문 다시 조회',exact:true}).click();await expect(panel(page).getByRole('alert')).toContainText('ACCESS_DENIED');await expect(panel(page)).not.toContainText('고정 환경 후보');s.clean();
});
test('ENVIRONMENT_CLOSE 닫기 후 늦은 원문은 표시하지 않는다',async({page})=>{
 const s=await setup(page);s.set('DELAY');await panel(page).getByRole('button',{name:'고정 환경 원문 보기',exact:true}).click();await expect.poll(s.reads).toBe(1);
 const response=page.waitForResponse(r=>r.url().includes('/connection-candidates/'));await panel(page).getByRole('button',{name:'환경 원문 닫기',exact:true}).click();s.release();await (await response).finished();await expect(panel(page)).not.toContainText('고정 환경 후보');s.clean();
});
test('ENVIRONMENT_REVISION 상세 갱신 후 이전 조회 결과는 표시하지 않는다',async({page})=>{
 const s=await setup(page);s.set('DELAY');await panel(page).getByRole('button',{name:'고정 환경 원문 보기',exact:true}).click();await expect.poll(s.reads).toBe(1);
 const response=page.waitForResponse(r=>r.url().includes('/connection-candidates/'));await page.getByRole('button',{name:'상세 원본 새로고침',exact:true}).click();await expect(panel(page).getByRole('button',{name:'고정 환경 원문 보기',exact:true})).toBeVisible();s.release();await (await response).finished();await expect(panel(page)).not.toContainText('고정 환경 후보');s.clean();
});
