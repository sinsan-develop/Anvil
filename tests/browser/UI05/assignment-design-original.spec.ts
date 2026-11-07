import {test,expect,type Page} from '@playwright/test';
import {contentCriteria} from '../../../apps/web/src/features/workspace/assignment-confirmation-api.ts';
import {sessionDetailHref} from '../../../apps/web/src/shell/routes.ts';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
import {assignmentDesignFixture} from '../../unit/UI05/assignment-design-original-fixture.ts';
async function setup(page:Page){
 const f=assignmentDesignFixture(),draft=f.detail.draft,confirmed=f.detail.confirmed!,pid=f.detail.projectId,aid=draft.ref.id,at=draft.observedAt;
 const decision={projectId:pid,draftRef:draft.ref,criteriaVersion:1,criteria:contentCriteria,reviews:[],hasMoreReviews:false,contentIssues:[],currentIssue:'REVIEW_REQUIRED',confirmedRef:confirmed.ref,latestReviewAccepted:false,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt:at},state={projectId:pid,assignmentRef:confirmed.ref,roles:[],bindings:[],preparations:[],hasMorePreparations:false,currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false};
 let mode='GOOD',metadata=0,bytes=0,release:()=>void=()=>{};const unknown:string[]=[],errors:string[]=[],writes:string[]=[];
 await page.route('**/*',r=>{unknown.push(r.request().url());return r.abort();});await installWorkspaceBundle(page);
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:pid,displayName:'설계 원문 QA'},clientId:pid,csrfToken:'A'.repeat(43)}}));await page.route('**/api/v1/auth/setup',r=>r.fulfill({json:{setupRequired:false,policyVersion:1}}));
 await page.route(`**/api/v1/projects/${pid}/**`,async r=>{const path=new URL(r.request().url()).pathname,base=`/api/v1/projects/${pid}/`;let value:unknown;
  if(path===base+`assignment-drafts/${aid}/versions/1`)value=draft;else if(path===base+`assignment-drafts/${aid}/versions/1/decision`)value=decision;else if(path===base+`assignments/${aid}/versions/1`)value=confirmed;else if(path===base+`assignments/${aid}/versions/1/execution-preparation-state`)value=state;else if(path===base+`assignments/${aid}/versions/1/result-pages`)value={projectId:pid,assignmentRef:confirmed.ref,items:[],hasMore:false,nextCursor:null,selectionState:'NOT_SELECTED',observedAt:at};else if(path===base+`work-plans/${f.plan.ref.id}/versions/2`)value=f.plan;
  else if(path===base+`documents/${f.document.id}/versions/2`){metadata++;if(mode==='DELAY')await new Promise<void>(resolve=>release=resolve);if(mode==='DENIED')return r.fulfill({status:403,json:{code:'ACCESS_DENIED'}});value=mode==='HASH'?{...f.document,contentHash:'0'.repeat(64)}:f.document;}
  else if(path===base+`files/${f.fileId}`){bytes++;return r.fulfill({contentType:'application/octet-stream',body:f.bytes});}
  else{unknown.push(path);return r.abort();}return r.fulfill({json:value});
 });
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());if(new URL(r.url()).origin!=='https://localhost:3830')unknown.push(r.url());});
 await page.goto('https://localhost:3830/'+sessionDetailHref(pid,draft.ref));await page.getByRole('button',{name:'고정 계획 업무 원문 보기',exact:true}).click();await expect(panel(page)).toBeVisible();
 return{f,set(m:string){mode=m;},metadata:()=>metadata,bytes:()=>bytes,release:()=>release(),clean(){expect(unknown).toEqual([]);expect(errors).toEqual([]);expect(writes).toEqual([]);}};
}
const panel=(p:Page)=>p.getByRole('region',{name:'고정 임무 설계 원문',exact:true});
test('ASSIGNMENT_DESIGN 정확 원문은 명시 열기로만 읽고 실행되지 않으며 hash/403 거절 뒤 이전 본문을 숨긴다',async({page})=>{
 const s=await setup(page);expect(s.metadata()).toBe(0);expect(s.bytes()).toBe(0);await panel(page).getByRole('button',{name:'고정 설계 원문 보기',exact:true}).click();await expect(panel(page).locator('pre')).toHaveText(s.f.body);expect(s.metadata()).toBe(1);expect(s.bytes()).toBe(1);expect(await page.evaluate(()=>Object.hasOwn(globalThis,'designExecuted'))).toBe(false);
 s.set('HASH');await panel(page).getByRole('button',{name:'고정 설계 원문 다시 조회',exact:true}).click();await expect(panel(page).getByRole('alert')).toContainText('DOCUMENT_REFERENCE_CHANGED');await expect(panel(page).locator('pre')).toHaveCount(0);expect(s.bytes()).toBe(1);
 s.set('GOOD');await panel(page).getByRole('button',{name:'고정 설계 원문 다시 조회',exact:true}).click();await expect(panel(page).locator('pre')).toHaveText(s.f.body);expect(s.bytes()).toBe(2);
 s.set('DENIED');await panel(page).getByRole('button',{name:'고정 설계 원문 다시 조회',exact:true}).click();await expect(panel(page).getByRole('alert')).toContainText('ACCESS_DENIED');await expect(panel(page).locator('pre')).toHaveCount(0);expect(s.bytes()).toBe(2);s.clean();
});
test('ASSIGNMENT_DESIGN_LATE 닫기·상세 갱신 뒤 늦은 metadata는 bytes GET0·본문 표시0이다',async({page})=>{
 // JSON 소비 뒤 다음 task에서 관측한다. 이탈 경로는 readDocument가 digest 전 active 검사로 종료한다.
 await page.addInitScript(()=>{const fetch=globalThis.fetch;let consumed=0;Object.defineProperty(globalThis,'designMetadataConsumed',{get:()=>consumed});globalThis.fetch=async(...args)=>{const response=await fetch(...args);if(String(args[0]).includes('/documents/')){const json=response.json.bind(response);response.json=async()=>{const value=await json();setTimeout(()=>{consumed++;},0);return value;};}return response;};});
 const s=await setup(page);s.set('DELAY');await panel(page).getByRole('button',{name:'고정 설계 원문 보기',exact:true}).click();await expect.poll(s.metadata).toBe(1);let response=page.waitForResponse(r=>r.url().includes('/documents/'));await panel(page).getByRole('button',{name:'설계 원문 조회 닫기',exact:true}).click();s.release();await(await response).finished();await page.waitForFunction(()=>Reflect.get(globalThis,'designMetadataConsumed')===1);await expect(panel(page).locator('pre')).toHaveCount(0);expect(s.bytes()).toBe(0);
 await panel(page).getByRole('button',{name:'고정 설계 원문 보기',exact:true}).click();await expect.poll(s.metadata).toBe(2);response=page.waitForResponse(r=>r.url().includes('/documents/'));await page.getByRole('button',{name:'상세 원본 새로고침',exact:true}).click();await expect(page.getByRole('button',{name:'고정 계획 업무 원문 보기',exact:true})).toBeVisible();s.release();await(await response).finished();await page.waitForFunction(()=>Reflect.get(globalThis,'designMetadataConsumed')===2);await expect(panel(page)).toHaveCount(0);expect(s.bytes()).toBe(0);s.clean();
});
