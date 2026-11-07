import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {buildOfficialForms} from '../../../apps/server/modules/documents/forms.ts';
import {buildBuiltinMethodologies} from '../../../apps/server/modules/methodologies/builtins.ts';
import {validateMethodologyGraph} from '../../../apps/server/modules/methodologies/service.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const forms=buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md',import.meta.url)),await readFile(new URL('../../../docs/design/문서작성_공통기준.md',import.meta.url))),builtin=buildBuiltinMethodologies(await readFile(new URL('../../../docs/design/기본방법론_상세검토안.md',import.meta.url)),forms.forms)[0]!;
const pid='a6f20350-0000-4000-8000-000000000001',uid='a6f20350-0000-4000-8000-000000000002',cid='a6f20350-0000-4000-8000-000000000003',mid='a6f20350-0000-4000-8000-000000000004';
async function fixture(page:Page,options:{denySecond?:boolean;delay?:boolean;corrupt?:boolean}={}){
 const dist=process.env.ANVIL_UI03_METHOD_COMPARE_DIST;if(dist!=='D:/tmp/anvil-v3-stage-b/ui03-method-comparison-01/dist')throw Error('REGISTERED_CANDIDATE_DIST_REQUIRED');
 const errors:string[]=[],unknown:string[]=[],writes:string[]=[],offOrigin:string[]=[],reads:number[]=[];let release=()=>{},seen=()=>{},oldReads=0;const pending=new Promise<void>(r=>release=r),requested=new Promise<void>(r=>seen=r);
 const version=(v:number)=>{const graph=structuredClone(builtin.graph);graph.nodes[0]!.purpose=v===1?'이전 단계 목적 <script>window.METHOD_COMPARE_EXECUTED=1</script>':'현재 단계 목적';return{projectId:pid,headVersion:3,ref:{id:mid,version:v,contentHash:contentHash(canonicalJson(graph))},name:v===1?'이전 방법론':'현재 방법론',purpose:v===1?'이전 프로젝트 목적':'현재 프로젝트 목적',scope:'PROJECT',systemCode:null,graph,confirmation:null,contentReviews:[],validation:validateMethodologyGraph(graph,forms.forms.map(f=>f.ref)),runtimeReadiness:'PROJECT_BINDINGS_REQUIRED',applicationTransition:'EXECUTION_STATE_UNVERIFIED'};};
 page.on('pageerror',e=>errors.push(e.name));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method());if(new URL(r.url()).origin!=='https://localhost:3830')offOrigin.push(new URL(r.url()).origin);});
 await page.route('**/*',r=>new URL(r.request().url()).origin==='https://localhost:3830'?r.fallback():r.abort('blockedbyclient'));
 await page.route('https://localhost:3830/**',async r=>{const path=new URL(r.request().url()).pathname;if(path.startsWith('/api/'))return r.fallback();if(r.request().method()!=='GET'||path!=='/'&&!/^\/assets\/[A-Za-z0-9_.-]+$/.test(path))return r.abort('blockedbyclient');const name=path==='/'?'index.html':path.slice(1);return r.fulfill({body:await readFile(new URL(name,pathToFileURL(dist+'/'))),contentType:name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'application/javascript'});});
 await page.route('**/api/v1/**',r=>{unknown.push(new URL(r.request().url()).pathname);return r.fulfill({status:503,json:{code:'UNEXPECTED_QA_API'}});});
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:uid,displayName:'저장 방법론 비교 QA'},clientId:cid,csrfToken:'A'.repeat(43)}}));
 await page.route('**/api/v1/auth/setup',r=>r.fulfill({json:{setupRequired:false,policyVersion:1}}));
 await page.route('**/api/v1/forms',r=>r.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:new Date().toISOString(),baselineVersion:null}}));
 await page.route(/\/api\/v1\/methodologies(?:\?.*)?$/,r=>r.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:new Date().toISOString(),baselineVersion:null}}));
 await page.route(`**/api/v1/projects/${pid}`,r=>r.fulfill({json:{id:pid,currentMethodologyRef:{id:mid,version:1,contentHash:'a'.repeat(64)},participation:'OWNER',controlState:{actorId:uid,clientId:cid,generation:1,status:'HELD'}}}));
 await page.route(`**/api/v1/projects/${pid}/methodologies?*`,r=>r.fulfill({json:{projectId:pid,items:[{ref:version(3).ref,name:'현재 방법론',purpose:'현재 프로젝트 목적',scope:'PROJECT'}],hasMore:false,nextAfterId:null,observedAt:new Date().toISOString(),applicationTransition:'EXECUTION_STATE_UNVERIFIED'}}));
 await page.route(`**/api/v1/projects/${pid}/methodologies/${mid}/versions/*`,async r=>{const v=Number(new URL(r.request().url()).pathname.split('/').at(-1));reads.push(v);if(v===1){oldReads++;if(options.delay){seen();await pending;}if(options.denySecond&&oldReads>1)return r.fulfill({status:403,json:{code:'PROJECT_OPERATION_DENIED'}});}const value=version(v);if(options.corrupt&&v===1)value.ref.contentHash='f'.repeat(64);return r.fulfill({json:value});});
 return{errors,unknown,writes,offOrigin,reads,requested,release};
}
async function open(page:Page){await page.goto(`/#/projects/${pid}/methodologies`);await page.getByRole('button',{name:'현재 방법론 v3 열기',exact:true}).click();await expect(page.getByRole('region',{name:'선택한 전용 원본',exact:true})).toBeVisible();}
const panel=(p:Page)=>p.getByRole('region',{name:'저장 방법론 버전 비교',exact:true});
async function compare(p:Page,v='1'){await panel(p).getByRole('spinbutton',{name:'비교할 방법론 버전',exact:true}).fill(v);await panel(p).getByRole('button',{name:'저장 방법론 버전 비교',exact:true}).click();}
function clean(s:Awaited<ReturnType<typeof fixture>>){expect(s.errors).toEqual([]);expect(s.unknown).toEqual([]);expect(s.writes).toEqual([]);expect(s.offOrigin).toEqual([]);}
test('같은 전용 방법론의 저장 전후 이름·목적·절차 차이를 읽고 적용·쓰기·원문 실행은 하지 않는다',async({page})=>{
 const s=await fixture(page);await open(page);await page.getByRole('button',{name:'이 전용본 편집',exact:true}).click();await page.getByLabel('방법론 이름',{exact:true}).fill('보존할 미저장 편집');await compare(page);await expect(panel(page)).toContainText('기준 v3');await expect(panel(page)).toContainText('비교 v1');await expect(panel(page).getByLabel('기준 방법론 차이 구간',{exact:true})).toContainText('현재 프로젝트 목적');await expect(panel(page).getByLabel('비교 방법론 차이 구간',{exact:true})).toContainText('이전 단계 목적');await expect(panel(page)).toContainText('이전 방법론');await expect(panel(page).locator('script')).toHaveCount(0);expect(await page.evaluate(()=>(window as any).METHOD_COMPARE_EXECUTED)).toBeUndefined();await expect(page.getByLabel('방법론 이름',{exact:true})).toHaveValue('보존할 미저장 편집');await expect(page.getByRole('button',{name:'프로젝트 적용 전환',exact:true})).toBeDisabled();expect(s.reads).toEqual([3,1]);clean(s);
});
test('비교 재조회 권한 거절은 직전 원문을 숨기고 원 선택/편집을 바꾸지 않는다',async({page})=>{
 const s=await fixture(page,{denySecond:true});await open(page);await compare(page);await expect(panel(page).getByLabel('비교 방법론 차이 구간',{exact:true})).toBeVisible();await panel(page).getByRole('button',{name:'저장 방법론 버전 비교',exact:true}).click();await expect(panel(page).getByRole('alert')).toContainText('PROJECT_OPERATION_DENIED');await expect(panel(page).getByLabel('비교 방법론 차이 구간',{exact:true})).toHaveCount(0);await expect(page.getByRole('region',{name:'선택한 전용 원본',exact:true})).toContainText('현재 방법론');clean(s);
});
test('버전 선택 뒤 늦은 비교는 새 결과로 표시하지 않는다',async({page})=>{
 const s=await fixture(page,{delay:true});await open(page);for(const v of['0','4','1.5']){await panel(page).getByRole('spinbutton',{name:'비교할 방법론 버전',exact:true}).fill(v);await expect(panel(page).getByRole('button',{name:'저장 방법론 버전 비교',exact:true})).toBeDisabled();}await compare(page);await s.requested;await compare(page,'2');await expect(panel(page)).toContainText('표시 내용이 같습니다');const done=page.waitForResponse(r=>r.url().endsWith('/versions/1'));s.release();await(await done).finished();await expect(panel(page)).toContainText('비교 v2');await expect(panel(page).getByLabel('비교 방법론 차이 구간',{exact:true})).toHaveCount(0);clean(s);
});
test('비교 응답 graph hash 불일치를 거절하고 현재 선택을 보존한다',async({page})=>{const s=await fixture(page,{corrupt:true});await open(page);await compare(page);await expect(panel(page).getByRole('alert')).toContainText('RESPONSE_INVALID');await expect(panel(page).getByLabel('비교 방법론 차이 구간',{exact:true})).toHaveCount(0);clean(s);});
