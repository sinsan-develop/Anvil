import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {buildOfficialForms} from '../../../apps/server/modules/documents/forms.ts';
import {buildBuiltinMethodologies} from '../../../apps/server/modules/methodologies/builtins.ts';
import {validateMethodologyGraph} from '../../../apps/server/modules/methodologies/service.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const forms=buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md',import.meta.url)),await readFile(new URL('../../../docs/design/문서작성_공통기준.md',import.meta.url))),builtin=buildBuiltinMethodologies(await readFile(new URL('../../../docs/design/기본방법론_상세검토안.md',import.meta.url)),forms.forms)[0]!;
const uid='a6f20400-0000-4000-8000-000000000001',mid='a6f20400-0000-4000-8000-000000000002';
async function fixture(page:Page){
 const dist=process.env.ANVIL_UI03_COMMON_COMPARE_DIST;if(dist!=='D:/tmp/anvil-v3-stage-b/ui03-common-comparison-01/dist')throw Error('REGISTERED_CANDIDATE_DIST_REQUIRED');
 const version=(n:number)=>{const graph=structuredClone(builtin.graph);graph.nodes[0]!.purpose=n===1?'과거 단계 목적 <svg onload="window.COMPARE_EXECUTED=1">':'현재 단계 목적';return{ref:{id:mid,version:n,contentHash:contentHash(canonicalJson(graph))},name:n===1?'공통 과거 이름':'공통 현재 이름',purpose:n===1?'과거 방법론 목적':'현재 방법론 목적',scope:'USER_COMMON',systemCode:null,graph,confirmation:null,validation:validateMethodologyGraph(graph,forms.forms.map(f=>f.ref)),runtimeReadiness:'PROJECT_BINDINGS_REQUIRED'};};
 const current=version(2),errors:string[]=[],unknown:string[]=[],writes:string[]=[],offOrigin:string[]=[];let mode:'GOOD'|'HASH'|'DENY'='GOOD';
 page.on('pageerror',e=>errors.push(e.name));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method());if(new URL(r.url()).origin!=='https://localhost:3830')offOrigin.push(new URL(r.url()).origin);});
 await page.route('**/*',r=>new URL(r.request().url()).origin==='https://localhost:3830'?r.fallback():r.abort('blockedbyclient'));
 await page.route('https://localhost:3830/**',async r=>{const path=new URL(r.request().url()).pathname;if(path.startsWith('/api/'))return r.fallback();if(r.request().method()!=='GET'||path!=='/'&&!/^\/assets\/[A-Za-z0-9_.-]+$/.test(path))return r.abort('blockedbyclient');const name=path==='/'?'index.html':path.slice(1);return r.fulfill({body:await readFile(new URL(name,pathToFileURL(dist+'/'))),contentType:name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'application/javascript'});});
 await page.route('**/api/v1/**',r=>{unknown.push(new URL(r.request().url()).pathname);return r.fulfill({status:503,json:{code:'UNEXPECTED_QA_API'}});});
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:uid,displayName:'공통 비교 QA'},clientId:uid,csrfToken:'A'.repeat(43)}}));await page.route('**/api/v1/auth/setup',r=>r.fulfill({json:{setupRequired:false,policyVersion:1}}));
 await page.route('**/api/v1/forms',r=>r.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:new Date().toISOString(),baselineVersion:null}}));
 await page.route(/\/api\/v1\/methodologies(?:\?.*)?$/,r=>r.fulfill({json:{items:[{...current,status:'DRAFT',sourceAvailable:false}],hasMore:false,nextCursor:null,observedAt:new Date().toISOString(),baselineVersion:null}}));
 await page.route(`**/api/v1/methodologies/${mid}/versions/2`,r=>r.fulfill({json:current}));
 await page.route(`**/api/v1/methodologies/${mid}/versions/1`,r=>{if(mode==='DENY')return r.fulfill({status:403,json:{code:'ACCESS_DENIED'}});const v=version(1);return r.fulfill({json:mode==='HASH'?{...v,ref:{...v.ref,contentHash:'0'.repeat(64)}}:v});});
 await page.goto('/#/methodologies');await expect(page.getByRole('region',{name:'선택 방법론 원본',exact:true})).toBeVisible();return{errors,unknown,writes,offOrigin,setMode:(v:typeof mode)=>{mode=v;}};
}
const panel=(p:Page)=>p.getByRole('region',{name:'공통 저장 방법론 버전 비교',exact:true});
function clean(s:Awaited<ReturnType<typeof fixture>>){expect(s.errors).toEqual([]);expect(s.unknown).toEqual([]);expect(s.writes).toEqual([]);expect(s.offOrigin).toEqual([]);}
test('공통 저장본의 이름·목적·단계 차이를 조회하며 미저장 편집과 원문 비실행을 유지한다',async({page})=>{
 const s=await fixture(page);await expect(panel(page)).toBeVisible();await page.getByRole('button',{name:'이 공통본 편집',exact:true}).click();await page.getByLabel('방법론 이름',{exact:true}).fill('보존할 미저장 초안');await panel(page).getByRole('button',{name:'공통 저장 버전 비교',exact:true}).click();await expect(panel(page).getByLabel('비교 공통 방법론 차이 구간',{exact:true})).toContainText('공통 과거 이름');await expect(panel(page).getByLabel('비교 공통 방법론 차이 구간',{exact:true})).toContainText('과거 단계 목적');await expect(page.getByLabel('방법론 이름',{exact:true})).toHaveValue('보존할 미저장 초안');await expect(panel(page).locator('pre svg')).toHaveCount(0);expect(await page.evaluate(()=>(window as any).COMPARE_EXECUTED)).toBeUndefined();clean(s);
});
test('비교 응답 hash 변조와 403은 차이를 표시하지 않으며 먼저 조회한 결과도 숨긴다',async({page})=>{
 const s=await fixture(page);s.setMode('HASH');await panel(page).getByRole('button',{name:'공통 저장 버전 비교',exact:true}).click();await expect(panel(page).getByRole('alert')).toContainText('RESPONSE_INVALID');await expect(panel(page).locator('pre')).toHaveCount(0);s.setMode('GOOD');await panel(page).getByRole('button',{name:'공통 저장 버전 비교',exact:true}).click();await expect(panel(page).locator('pre')).toHaveCount(2);s.setMode('DENY');await panel(page).getByRole('button',{name:'공통 저장 버전 비교',exact:true}).click();await expect(panel(page).getByRole('alert')).toContainText('ACCESS_DENIED');await expect(panel(page).locator('pre')).toHaveCount(0);clean(s);
});
