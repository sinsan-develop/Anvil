import {test,expect,type Page} from '@playwright/test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {contentCriteria} from '../../../apps/web/src/features/workspace/assignment-confirmation-api.ts';
import {sessionDetailHref} from '../../../apps/web/src/shell/routes.ts';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
import {assignmentPlanFixture,planProject as pid,assignmentId as aid,planId} from '../../unit/UI05/assignment-plan-original-fixture.ts';
async function setup(page:Page,badBasis=false){
 const f=assignmentPlanFixture(),draft=f.detail.draft,confirmed=f.detail.confirmed!,at=draft.observedAt;
 if(badBasis){draft.snapshot.basis.taskCardHash='0'.repeat(64);draft.ref.contentHash=contentHash(canonicalJson(draft.snapshot));confirmed.snapshot.draftRef={...draft.ref};confirmed.ref.contentHash=contentHash(canonicalJson(confirmed.snapshot));}
 const decision={projectId:pid,draftRef:draft.ref,criteriaVersion:1,criteria:contentCriteria,reviews:[],hasMoreReviews:false,contentIssues:[],currentIssue:'REVIEW_REQUIRED',confirmedRef:confirmed.ref,latestReviewAccepted:false,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt:at},state={projectId:pid,assignmentRef:confirmed.ref,roles:[],bindings:[],preparations:[],hasMorePreparations:false,currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false};
 let mode='GOOD',reads=0,release:()=>void=()=>{};const unknown:string[]=[],errors:string[]=[],writes:string[]=[];
 await page.route('**/*',r=>{unknown.push(r.request().url());return r.abort();});await installWorkspaceBundle(page);
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:pid,displayName:'고정업무 QA'},clientId:pid,csrfToken:'A'.repeat(43)}}));await page.route('**/api/v1/auth/setup',r=>r.fulfill({json:{setupRequired:false,policyVersion:1}}));
 await page.route(`**/api/v1/projects/${pid}/**`,async r=>{const path=new URL(r.request().url()).pathname,base=`/api/v1/projects/${pid}/`;let value:unknown;
  if(path===base+`assignment-drafts/${aid}/versions/1`)value=draft;else if(path===base+`assignment-drafts/${aid}/versions/1/decision`)value=decision;else if(path===base+`assignments/${aid}/versions/1`)value=confirmed;else if(path===base+`assignments/${aid}/versions/1/execution-preparation-state`)value=state;else if(path===base+`assignments/${aid}/versions/1/result-pages`)value={projectId:pid,assignmentRef:confirmed.ref,items:[],hasMore:false,nextCursor:null,selectionState:'NOT_SELECTED',observedAt:at};
  else if(path===base+`work-plans/${planId}/versions/2`){reads++;if(mode==='DELAY')await new Promise<void>(resolve=>release=resolve);if(mode==='DENIED')return r.fulfill({status:403,json:{code:'ACCESS_DENIED'}});value=f.plan;}
  else{unknown.push(path);return r.abort();}return r.fulfill({json:value});
 });
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());if(new URL(r.url()).origin!=='https://localhost:3830')unknown.push(r.url());});
 await page.goto('https://localhost:3830/'+sessionDetailHref(pid,draft.ref));
 return{set(m:string){mode=m;},reads:()=>reads,release:()=>release(),clean(){expect(unknown).toEqual([]);expect(errors).toEqual([]);expect(writes).toEqual([]);}};
}
const panel=(page:Page)=>page.getByRole('region',{name:'고정 임무 계획 업무 원문',exact:true});
test('ASSIGNMENT_PLAN_ORIGINAL 확정 임무의 과거업무만 명시조회하고 403 뒤 이전카드를 숨긴다',async({page})=>{
 const s=await setup(page);await expect(panel(page)).toBeVisible();expect(s.reads()).toBe(0);await panel(page).getByRole('button',{name:'고정 계획 업무 원문 보기',exact:true}).click();
 await panel(page).getByText('선택 업무 상세: FN09 · 고정 계획의 원 업무',{exact:true}).click();await expect(panel(page)).toContainText('단계책임자가 계획을 확인');await expect(panel(page)).toContainText('필수 증거');await expect(panel(page)).toContainText('실제 권한·선행 완료·실행 준비를 판정하지 않습니다.');expect(s.reads()).toBe(1);
 s.set('DENIED');await panel(page).getByRole('button',{name:'고정 계획 업무 원문 다시 조회',exact:true}).click();await expect(panel(page).getByRole('alert')).toContainText('ACCESS_DENIED');await expect(panel(page)).not.toContainText('고정 계획의 원 업무');s.clean();
});
test('ASSIGNMENT_PLAN_CARD 원초안의 카드hash와 다른 계획카드를 채택하지 않는다',async({page})=>{
 const s=await setup(page,true);await panel(page).getByRole('button',{name:'고정 계획 업무 원문 보기',exact:true}).click();await expect(panel(page).getByRole('alert')).toContainText('ASSIGNMENT_PLAN_ORIGINAL_UNVERIFIED');await expect(panel(page)).not.toContainText('고정 계획의 원 업무');expect(s.reads()).toBe(1);s.clean();
});
test('ASSIGNMENT_PLAN_LATE 상세갱신 이후 늦은 계획조회는 다시 표시하지 않는다',async({page})=>{
 const s=await setup(page);s.set('DELAY');await panel(page).getByRole('button',{name:'고정 계획 업무 원문 보기',exact:true}).click();await expect.poll(s.reads).toBe(1);
 const response=page.waitForResponse(r=>r.url().includes('/work-plans/'));await page.getByRole('button',{name:'상세 원본 새로고침',exact:true}).click();await expect(panel(page).getByRole('button',{name:'고정 계획 업무 원문 보기',exact:true})).toBeVisible();s.release();await(await response).finished();await expect(panel(page)).not.toContainText('고정 계획의 원 업무');s.clean();
});
