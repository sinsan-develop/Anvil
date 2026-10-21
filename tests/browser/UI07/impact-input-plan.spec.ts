import {test,expect} from '@playwright/test';import {installWorkspaceBundle} from '../UI04/bundle.ts';import {impactInputPlanFixture} from '../../unit/UI07/impact-input-plan-fixture.ts';
for(const mode of ['NORMAL','DENIED','DEPART'])test('IMPACT_INPUT_PLAN_'+mode,async({page})=>{
 const f=impactInputPlanFixture(),calls:string[]=[],writes:string[]=[],unknown:string[]=[],errors:string[]=[];let release:()=>void=()=>{},returned=false;const gate=new Promise<void>(r=>{release=r;});
 await page.addInitScript(()=>{const nativeFetch=globalThis.fetch,nativeDigest=crypto.subtle.digest.bind(crypto.subtle);globalThis.fetch=async(...args)=>{const response=await nativeFetch(...args);if(String(args[0]).includes('/work-plans/')){const json=response.json.bind(response);response.json=async()=>{const value=await json();(globalThis as any).__inputPlanParsed=true;return value;};}return response;};crypto.subtle.digest=async(...args)=>{const value=await nativeDigest(...args);if((globalThis as any).__inputPlanParsed)(globalThis as any).__inputPlanDigested=true;return value;};});
 await installWorkspaceBundle(page);await page.route('**/api/v1/**',r=>{unknown.push(r.request().url());return r.abort();});
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:f.selection.userId,displayName:'영향 계획 QA'},clientId:f.selection.clientId,csrfToken:'C'.repeat(43)}}));
 await page.route('**/api/v1/projects/'+f.selection.projectId+'/design-changes/'+f.selection.changeRef.id+'?*',r=>r.fulfill({json:f.page}));
 const planPath='**/api/v1/projects/'+f.selection.projectId+'/work-plans/'+f.plan.ref.id+'/versions/2';
 await page.route(planPath,async r=>{calls.push(r.request().url());if(mode==='DEPART')await gate;await r.fulfill({json:f.plan});returned=true;});
 page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method());if(new URL(r.url()).origin!=='https://localhost:3830')unknown.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/#/projects/'+f.selection.projectId+'/changes');await page.getByRole('textbox',{name:'변경 요청 ID',exact:true}).fill(f.selection.changeRef.id);await page.getByRole('button',{name:'변경 요청 조회',exact:true}).click();
 await expect(page.getByRole('region',{name:'보관 설계 변경',exact:true})).toBeVisible();expect(calls).toHaveLength(0);
 await page.getByText('계산에 사용한 고정 계획',{exact:true}).click();const open=page.getByRole('button',{name:'입력 계획 '+f.plan.ref.id+' v2 고정 내용 보기',exact:true});await open.click();
 const region=page.getByRole('region',{name:'영향 계산 입력 계획 고정 내용',exact:true});
 if(mode==='DEPART'){await expect.poll(()=>calls.length).toBe(1);await page.getByRole('textbox',{name:'변경 요청 ID',exact:true}).fill('');release();await expect.poll(()=>returned).toBe(true);await expect.poll(()=>page.evaluate(()=>(globalThis as any).__inputPlanDigested===true)).toBe(true);await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));await expect(region).toHaveCount(0);}
 else{await expect(region.getByText('영향 계산 입력 원문',{exact:true})).toBeVisible();await region.getByText('FN01 · 계산 입력의 고정 업무 · FUNCTION',{exact:true}).click();await expect(region.getByText('변경 영향 근거 확인',{exact:true})).toBeVisible();
 if(mode==='DENIED'){await page.route(planPath,r=>r.fulfill({status:403,json:{code:'WORK_PLAN_DENIED'}}));await open.click();await expect(region.getByRole('alert')).toContainText('WORK_PLAN_DENIED');await expect(region.getByText('영향 계산 입력 원문',{exact:true})).toHaveCount(0);}
 else{await region.getByRole('button',{name:'입력 계획 내용 닫기',exact:true}).click();await expect(region).toHaveCount(0);expect(calls).toHaveLength(1);}}
 expect(writes).toEqual([]);expect(unknown).toEqual([]);expect(errors).toEqual([]);
});
