import {test,expect,type Page} from '@playwright/test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {blankPlanTask} from '../../../apps/web/src/features/design-trace/work-plan-api.ts';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
const pid='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',ref={id:pid,version:1,contentHash:'a'.repeat(64)},at='2026-10-20T00:00:00.000Z';
function plan(n:number){const snapshot={documentRef:ref,designRef:ref,screenReviewRefs:[],tasks:[{...blankPlanTask(),taskCode:'FN01',title:`보관 업무 v${n}`,purpose:`당시 목적 v${n}`}],dependencies:[],reason:`당시 개정 이유 v${n}`,issues:[],relationalProjection:'ISSUES_ONLY'};return{ref:{id,version:n,contentHash:contentHash(canonicalJson(snapshot))},status:'DRAFT',...snapshot,executionEvidence:'NOT_CONNECTED',observedAt:at};}
async function setup(page:Page){
 let mode='GOOD',reads=0,release:()=>void=()=>{};const errors:string[]=[],unknown:string[]=[],writes:string[]=[];
 await page.route('**/*',r=>{unknown.push(r.request().url());return r.abort();});await installWorkspaceBundle(page);
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:pid,displayName:'보관 계획 QA'},clientId:pid,csrfToken:'A'.repeat(43)}}));await page.route('**/api/v1/auth/setup',r=>r.fulfill({json:{setupRequired:false,policyVersion:1}}));
 await page.route(`**/api/v1/projects/${pid}/**`,async r=>{const path=new URL(r.request().url()).pathname,base=`/api/v1/projects/${pid}/`;let value:unknown;
  if(path===base+'documents')value={items:[],hasMore:false,nextCursor:null,observedAt:at};
  else if(path===base+'work-plans')value={items:[{ref:plan(3).ref,status:'DRAFT',title:'보관 계획 원문',documentRef:ref,designRef:ref,issueCount:0,updatedAt:at,integrity:'NOT_RECHECKED'}],hasMore:false,nextCursor:null,observedAt:at};
  else if(path===base+`work-plans/${id}/versions/3`)value=plan(3);
  else if(path===base+`work-plans/${id}/versions/1`||path===base+`work-plans/${id}/versions/2`){reads++;const version=Number(path.at(-1));if(mode==='DELAY')await new Promise<void>(resolve=>release=resolve);if(mode==='DENIED')return r.fulfill({status:403,json:{code:'ACCESS_DENIED'}});value=mode==='TAMPER'?{...plan(version),reason:'변조된 원문'}:plan(version);}
  else{unknown.push(path);return r.abort();}return r.fulfill({json:value});
 });
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());if(new URL(r.url()).origin!=='https://localhost:3830')unknown.push(r.url());});
 await page.goto(`/#/projects/${pid}/documents`);await page.getByRole('button',{name:'보관한 작업계획 조회',exact:true}).click();await page.getByRole('button',{name:`보관 계획 ${id} 열기`,exact:true}).click();
 return{set(m:string){mode=m;},reads:()=>reads,release:()=>release(),clean(){expect(errors).toEqual([]);expect(writes).toEqual([]);expect(unknown).toEqual([]);}};
}
const panel=(page:Page)=>page.getByRole('region',{name:'보관 작업계획 버전 조회',exact:true});
test('PLAN_VERSION_HISTORY 과거 원문은 현재 계획을 바꾸지 않고 읽으며 변조/403은 거절한다',async({page})=>{
 const s=await setup(page);await expect(panel(page)).toBeVisible();expect(s.reads()).toBe(0);
 await panel(page).getByLabel('조회할 보관 계획 버전',{exact:true}).fill('1');await panel(page).getByRole('button',{name:'지정 보관 계획 버전 열기',exact:true}).click();
 await expect(panel(page)).toContainText('당시 개정 이유 v1');await expect(panel(page)).toContainText('보관 업무 v1');await expect(page.getByRole('region',{name:'보관 작업계획 상세',exact:true})).toContainText('계획 v3');
 await panel(page).getByText('보관 버전과 기준 계획의 변경 비교',{exact:true}).click();await expect(panel(page).getByLabel('보관 계획 차이 구간',{exact:true})).toContainText('당시 목적 v1');await expect(panel(page).getByLabel('기준 계획 차이 구간',{exact:true})).toContainText('당시 목적 v3');expect(s.reads()).toBe(1);
 s.set('TAMPER');await panel(page).getByRole('button',{name:'지정 보관 계획 버전 열기',exact:true}).click();await expect(panel(page).getByRole('alert')).toContainText('WORK_PLAN_INTEGRITY_FAILED');await expect(panel(page).getByRole('region',{name:'조회한 보관 계획 버전',exact:true})).toHaveCount(0);
 s.set('DENIED');await panel(page).getByRole('button',{name:'지정 보관 계획 버전 열기',exact:true}).click();await expect(panel(page).getByRole('alert')).toContainText('ACCESS_DENIED');await expect(panel(page).getByRole('region',{name:'조회한 보관 계획 버전',exact:true})).toHaveCount(0);s.clean();
});
test('PLAN_VERSION_LATE 입력 변경·보관함 닫기 뒤 이전 응답은 표시하지 않는다',async({page})=>{
 const s=await setup(page);await panel(page).getByLabel('조회할 보관 계획 버전',{exact:true}).fill('1');s.set('DELAY');await panel(page).getByRole('button',{name:'지정 보관 계획 버전 열기',exact:true}).click();await expect.poll(s.reads).toBe(1);
 const response=page.waitForResponse(r=>r.url().endsWith('/versions/1'));await panel(page).getByLabel('조회할 보관 계획 버전',{exact:true}).fill('2');s.release();await(await response).finished();await expect(panel(page).getByRole('region',{name:'조회한 보관 계획 버전',exact:true})).toHaveCount(0);
 s.set('GOOD');await panel(page).getByRole('button',{name:'지정 보관 계획 버전 열기',exact:true}).click();await expect(panel(page)).toContainText('당시 개정 이유 v2');
 s.set('DELAY');await panel(page).getByLabel('조회할 보관 계획 버전',{exact:true}).fill('1');await panel(page).getByRole('button',{name:'지정 보관 계획 버전 열기',exact:true}).click();await expect.poll(s.reads).toBe(3);
 const late=page.waitForResponse(r=>r.url().endsWith('/versions/1'));await page.getByRole('button',{name:'보관 작업계획 닫기',exact:true}).click();s.release();await(await late).finished();await expect(panel(page)).toHaveCount(0);s.clean();
});
