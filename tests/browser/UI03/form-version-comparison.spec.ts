import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {buildOfficialForms} from '../../../apps/server/modules/documents/forms.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
const forms=buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md',import.meta.url)),await readFile(new URL('../../../docs/design/문서작성_공통기준.md',import.meta.url)));
const uid='a6f30390-0000-4000-8000-000000000001';
function version(n:number){const definition={...structuredClone(forms.forms[0]!.definition),scope:'USER_COMMON',name:n===1?'이전 양식 이름':'현재 양식 이름',purpose:n===1?'과거 목적 <svg onload="window.FORM_EXECUTED=1">':'현재 목적'};return{ref:{id:forms.forms[0]!.ref.id,version:n,contentHash:contentHash(canonicalJson(definition))},definition,authoringStandard:{ref:forms.standard.ref,content:forms.standard.body.toString('utf8')},validation:{formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'}};}
async function fixture(page:Page){
 const current=version(2),errors:string[]=[],unknown:string[]=[],writes:string[]=[],offOrigin:string[]=[];let mode='GOOD',arrival:()=>void=()=>{},release:()=>void=()=>{};const arrived=new Promise<void>(r=>arrival=r),hold=new Promise<void>(r=>release=r);
 page.on('pageerror',e=>errors.push(e.name));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method());if(new URL(r.url()).origin!=='https://localhost:3830')offOrigin.push(r.url());});
 await page.route('**/*',r=>new URL(r.request().url()).origin==='https://localhost:3830'?r.fallback():r.abort('blockedbyclient'));
 await installWorkspaceBundle(page);
 await page.route('**/api/v1/**',r=>{unknown.push(new URL(r.request().url()).pathname);return r.fulfill({status:503,json:{code:'UNEXPECTED_QA_API'}});});
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:uid,displayName:'양식 이력 QA'},clientId:uid,csrfToken:'A'.repeat(43)}}));
 await page.route('**/api/v1/methodologies',r=>r.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:new Date().toISOString(),baselineVersion:null}}));
 await page.route('**/api/v1/forms',r=>r.fulfill({json:{items:[{ref:current.ref,formCode:current.definition.formCode,name:current.definition.name,scope:'USER_COMMON'}],hasMore:false,nextCursor:null,observedAt:new Date().toISOString(),baselineVersion:null}}));
 await page.route(`**/api/v1/forms/${current.ref.id}/versions/2`,r=>r.fulfill({json:current}));
 await page.route(`**/api/v1/forms/${current.ref.id}/versions/1`,async r=>{if(mode==='HOLD'){arrival();await hold;}if(mode==='DENY')return r.fulfill({status:403,json:{code:'ACCESS_DENIED'}});const old=version(1);return r.fulfill({json:mode==='HASH'?{...old,ref:{...old.ref,contentHash:'0'.repeat(64)}}:old});});
 await page.goto('/#/methodologies');await expect(page.getByRole('article',{name:'선택 양식 원본',exact:true})).toBeVisible();return{errors,unknown,writes,offOrigin,arrived,release,setMode:(v:string)=>{mode=v;}};
}
const panel=(p:Page)=>p.getByRole('region',{name:'저장 양식 버전 비교',exact:true});
const clean=(s:Awaited<ReturnType<typeof fixture>>)=>{expect(s.errors).toEqual([]);expect(s.unknown).toEqual([]);expect(s.writes).toEqual([]);expect(s.offOrigin).toEqual([]);};
test('저장 양식의 과거 이름·목적 차이를 열고 미저장 양식 편집과 원문 비실행을 유지한다',async({page})=>{
 const s=await fixture(page);await expect(panel(page)).toBeVisible();await page.getByRole('button',{name:'이 공통 양식 편집',exact:true}).click();await page.getByLabel('양식 이름',{exact:true}).fill('보존할 새 양식 이름');await panel(page).getByRole('button',{name:'저장 양식 비교',exact:true}).click();await expect(panel(page).getByLabel('비교 양식 차이 구간',{exact:true})).toContainText('이전 양식 이름');await expect(panel(page).getByLabel('비교 양식 차이 구간',{exact:true})).toContainText('과거 목적');await expect(page.getByLabel('양식 이름',{exact:true})).toHaveValue('보존할 새 양식 이름');await expect(panel(page).locator('pre svg')).toHaveCount(0);expect(await page.evaluate(()=>(window as any).FORM_EXECUTED)).toBeUndefined();clean(s);
});
test('양식 과거 응답 hash 변조는 차단하고 이후 권한거절은 현재 원문과 비교를 함께 회수한다',async({page})=>{
 const s=await fixture(page);await expect(panel(page)).toBeVisible();s.setMode('HASH');await panel(page).getByRole('button',{name:'저장 양식 비교',exact:true}).click();await expect(panel(page).getByRole('alert')).toContainText('RESPONSE_INVALID');await expect(panel(page).locator('pre')).toHaveCount(0);s.setMode('GOOD');await panel(page).getByRole('button',{name:'저장 양식 비교',exact:true}).click();await expect(panel(page).getByLabel('비교 양식 차이 구간',{exact:true})).toBeVisible();s.setMode('DENY');await panel(page).getByRole('button',{name:'저장 양식 비교',exact:true}).click();await expect(page.getByRole('alert').first()).toContainText('ACCESS_DENIED');await expect(page.getByRole('article',{name:'선택 양식 원본',exact:true})).toHaveCount(0);await expect(panel(page)).toHaveCount(0);clean(s);
});
test('비교 요청 도착 뒤 화면 이탈하면 늦은 양식 원문을 다시 표시하지 않는다',async({page})=>{
 const s=await fixture(page);await expect(panel(page)).toBeVisible();await page.evaluate(()=>{const original=crypto.subtle.digest.bind(crypto.subtle);(window as any).FORM_DIGESTS=0;crypto.subtle.digest=async(...args:Parameters<SubtleCrypto['digest']>)=>{const result=await original(...args);(window as any).FORM_DIGESTS++;return result;};});s.setMode('HOLD');await panel(page).getByRole('button',{name:'저장 양식 비교',exact:true}).click();await s.arrived;await page.evaluate(()=>{location.hash='#/';});await expect(panel(page)).toHaveCount(0);const response=page.waitForResponse(r=>r.url().endsWith('/versions/1'));s.release();await response;await expect.poll(()=>page.evaluate(()=>(window as any).FORM_DIGESTS)).toBe(4);await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));await expect(panel(page)).toHaveCount(0);clean(s);
});
