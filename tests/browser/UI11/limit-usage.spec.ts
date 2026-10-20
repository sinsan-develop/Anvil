import {test,expect,type Page} from '@playwright/test';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
import {budgetUsageFixture} from '../../unit/UI05/budget-usage-fixture.ts';
const uid='22222222-2222-4222-8222-222222222222';
async function fixture(page:Page,mode:string){
 const f=budgetUsageFixture(),errors:string[]=[],unknown:string[]=[],writes:string[]=[];let queries=0,fail=false,release=()=>{};const gate=new Promise<void>(r=>release=r);
 await installWorkspaceBundle(page);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!=='https://localhost:3830')unknown.push(r.url());if(r.method()!=='GET')writes.push(r.method());});
 await page.route('**/api/v1/**',r=>{unknown.push(r.request().url());return r.fulfill({status:503,json:{code:'UNEXPECTED_API'}});});
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:uid,displayName:'한도 조회 QA'},clientId:uid,csrfToken:'C'.repeat(43)}}));
 await page.route('**/api/v1/auth/setup',r=>r.fulfill({json:{setupRequired:false,policyVersion:1}}));
 await page.route('**/api/v1/projects/*',r=>r.fulfill({json:{id:new URL(r.request().url()).pathname.split('/').at(-1),participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:uid,generation:2}}}));
 for(const path of ['connector-registrations','source-roots','source-read-grants'])await page.route('**/api/v1/projects/*/'+path+'?*',r=>r.fulfill({status:403,json:{code:'PROJECT_OPERATION_DENIED'}}));
 await page.route('**/api/v1/projects/*/connection-candidates?*',r=>r.fulfill({json:{view:'CANDIDATES_ONLY',items:[],hasMore:false,nextCursor:null,observedAt:f.view.observedAt}}));
 await page.route('**/api/v1/projects/'+f.id+'/limit-policies/'+f.ref.id+'/versions/1',r=>r.fulfill({json:f.view.policy}));
 await page.route('**/api/v1/projects/'+f.id+'/limit-policies/'+f.ref.id+'/versions/1/usage?*',async r=>{queries++;expect(new URL(r.request().url()).searchParams.get('contentHash')).toBe(f.ref.contentHash);if(mode==='STALE')await gate;if(mode==='AUTH')return r.fulfill({status:401,json:{code:'AUTH_REQUIRED'}});if(fail)return r.fulfill({status:503,json:{code:'USAGE_UNAVAILABLE'}});return r.fulfill({json:f.view});});
 await page.goto('/#/projects/'+f.id+'/connections');const panel=page.getByLabel('프로젝트 한도 정책',{exact:true});
 async function select(){await panel.getByLabel('한도 정책 ID',{exact:true}).fill(f.ref.id);await panel.getByLabel('한도 정책 버전',{exact:true}).fill('1');await panel.getByLabel('한도 정책 hash',{exact:true}).fill(f.ref.contentHash);await panel.getByRole('button',{name:'정확 한도 버전 조회',exact:true}).click();}
 await select();return{...f,panel,select,queries:()=>queries,fail:()=>fail=true,release,errors,unknown,writes};
}
for(const mode of ['FLOW_ERROR','STALE','AUTH'])test('LIMIT_USAGE_'+mode,async({page})=>{
 const f=await fixture(page,mode),usage=page.getByRole('region',{name:'선택 한도 사용량',exact:true});
 await expect(usage).toHaveCount(1,{timeout:700});expect(f.queries()).toBe(0);await usage.getByRole('button',{name:'보관 사용량 조회',exact:true}).click();
 if(mode==='STALE'){try{await expect.poll(f.queries).toBe(1);await page.evaluate(()=>location.hash='/projects/44444444-4444-4444-8444-444444444444/connections');await expect(usage).toHaveCount(0);const delivered=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/usage'));f.release();await(await delivered).finished();await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});await expect(page.getByText('미확인 예약: 1',{exact:true})).toHaveCount(0);}finally{f.release();}}
 else if(mode==='AUTH'){await expect(f.panel).toHaveCount(0);await expect(usage).toHaveCount(0);}
 else{await expect(usage).toContainText('미확인 예약: 1');await expect(usage).toContainText('프로젝트 전체 정책 누적');await expect(usage).toContainText('실제 공급자 과금 미검증');await expect(usage).toContainText('예약 호출: 1');f.fail();await usage.getByRole('button',{name:'보관 사용량 다시 조회',exact:true}).click();await expect(usage.getByRole('alert')).toContainText('USAGE_UNAVAILABLE');await expect(usage.getByText('미확인 예약: 1',{exact:true})).toHaveCount(0);}
 expect({errors:f.errors,unknown:f.unknown,writes:f.writes}).toEqual({errors:[],unknown:[],writes:[]});
});
