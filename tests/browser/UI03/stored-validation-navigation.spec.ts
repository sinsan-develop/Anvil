import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {buildOfficialForms} from '../../../apps/server/modules/documents/forms.ts';
import {buildBuiltinMethodologies} from '../../../apps/server/modules/methodologies/builtins.ts';
import {validateMethodologyGraph} from '../../../apps/server/modules/methodologies/service.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const forms=buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md',import.meta.url)),await readFile(new URL('../../../docs/design/문서작성_공통기준.md',import.meta.url))),builtin=buildBuiltinMethodologies(await readFile(new URL('../../../docs/design/기본방법론_상세검토안.md',import.meta.url)),forms.forms)[0]!;
const pid='a6f20370-0000-4000-8000-000000000001',uid='a6f20370-0000-4000-8000-000000000002',mid='a6f20370-0000-4000-8000-000000000003';
async function fixture(page:Page,project:boolean){
 const dist=process.env.ANVIL_UI03_ISSUE_NAV_DIST;if(dist!=='D:/tmp/anvil-v3-stage-b/ui03-issue-navigation-01/dist')throw Error('REGISTERED_CANDIDATE_DIST_REQUIRED');
 const graph=structuredClone(builtin.graph);graph.nodes[1]!.completionCriteria=[];graph.edges[0]!.condition={fieldRef:{nodeId:'ST02',field:'USER_DECISION'},operator:'EQ',value:'CONTINUE'};
 const validation=validateMethodologyGraph(graph,forms.forms.map(f=>f.ref));validation.issues.push({code:'UNKNOWN_LOCATION',location:'nodes.NOT_PRESENT',message:'<img src=x onerror="window.ISSUE_EXECUTED=1">',severity:'ERROR',relatedRefs:[]});
 const value={projectId:pid,headVersion:1,ref:{id:mid,version:1,contentHash:contentHash(canonicalJson(graph))},name:'문제 위치 조회 QA',purpose:'정확 원본 단계 조회',scope:project?'PROJECT':'USER_COMMON',systemCode:null,graph,confirmation:null,contentReviews:[],validation,runtimeReadiness:'PROJECT_BINDINGS_REQUIRED',applicationTransition:'EXECUTION_STATE_UNVERIFIED'},errors:string[]=[],unknown:string[]=[],writes:string[]=[],offOrigin:string[]=[];let denied=false;
 page.on('pageerror',e=>errors.push(e.name));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method());if(new URL(r.url()).origin!=='https://localhost:3830')offOrigin.push(new URL(r.url()).origin);});
 await page.route('**/*',r=>new URL(r.request().url()).origin==='https://localhost:3830'?r.fallback():r.abort('blockedbyclient'));
 await page.route('https://localhost:3830/**',async r=>{const path=new URL(r.request().url()).pathname;if(path.startsWith('/api/'))return r.fallback();if(r.request().method()!=='GET'||path!=='/'&&!/^\/assets\/[A-Za-z0-9_.-]+$/.test(path))return r.abort('blockedbyclient');const name=path==='/'?'index.html':path.slice(1);return r.fulfill({body:await readFile(new URL(name,pathToFileURL(dist+'/'))),contentType:name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'application/javascript'});});
 await page.route('**/api/v1/**',r=>{unknown.push(new URL(r.request().url()).pathname);return r.fulfill({status:503,json:{code:'UNEXPECTED_QA_API'}});});
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:uid,displayName:'구조 오류 조회 QA'},clientId:uid,csrfToken:'A'.repeat(43)}}));
 await page.route('**/api/v1/auth/setup',r=>r.fulfill({json:{setupRequired:false,policyVersion:1}}));
 await page.route('**/api/v1/forms',r=>r.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:new Date().toISOString(),baselineVersion:null}}));
 await page.route(/\/api\/v1\/methodologies(?:\?.*)?$/,r=>r.fulfill({json:{items:project?[]:[{...value,status:'DRAFT',sourceAvailable:false}],hasMore:false,nextCursor:null,observedAt:new Date().toISOString(),baselineVersion:null}}));
 await page.route(`**/api/v1/methodologies/${mid}/versions/1`,r=>r.fulfill({json:value}));
 await page.route(`**/api/v1/projects/${pid}`,r=>r.fulfill({json:{id:pid,currentMethodologyRef:{id:mid,version:1,contentHash:'a'.repeat(64)},participation:'OWNER',controlState:{actorId:uid,clientId:uid,generation:1,status:'HELD'}}}));
 await page.route(`**/api/v1/projects/${pid}/methodologies?*`,r=>denied?r.fulfill({status:403,json:{code:'PROJECT_OPERATION_DENIED'}}):r.fulfill({json:{projectId:pid,items:[{ref:value.ref,name:value.name,purpose:value.purpose,scope:'PROJECT'}],hasMore:false,nextAfterId:null,observedAt:new Date().toISOString(),applicationTransition:'EXECUTION_STATE_UNVERIFIED'}}));
 await page.route(`**/api/v1/projects/${pid}/methodologies/${mid}/versions/1`,r=>r.fulfill({json:value}));
 await page.goto(project?`/#/projects/${pid}/methodologies`:'/#/methodologies');if(project)await page.getByRole('button',{name:'문제 위치 조회 QA v1 열기',exact:true}).click();else await expect(page.getByRole('region',{name:'선택 방법론 원본',exact:true})).toBeVisible();
 return{errors,unknown,writes,offOrigin,deny:()=>{denied=true;}};
}
const panel=(page:Page)=>page.getByRole('region',{name:'저장 원본 구조 검사',exact:true});
function clean(s:Awaited<ReturnType<typeof fixture>>){expect(s.errors).toEqual([]);expect(s.unknown).toEqual([]);expect(s.writes).toEqual([]);expect(s.offOrigin).toEqual([]);}
test('전용 저장 원본 오류에서 정확 단계와 연결 양끝을 조회하며 쓰기 없이 원 오류를 유지한다',async({page})=>{
 const s=await fixture(page,true);await page.getByText('절차 원문과 구조 검사',{exact:true}).click();const completion=panel(page).getByRole('listitem').filter({hasText:'COMPLETION_CRITERIA_REQUIRED'});await completion.getByRole('button',{name:'문제 단계 조회 ST02: 기능·데이터 분석',exact:true}).click();await expect(page.getByRole('region',{name:'전용 원본 선택 단계 상세',exact:true})).toContainText('ST02');await expect(page.getByRole('group',{name:'프로젝트 방법론 원본 흐름',exact:true}).getByRole('button',{name:'흐름도 단계 ST02: 기능·데이터 분석',exact:true})).toHaveAttribute('aria-pressed','true');
 const edge=panel(page).getByRole('listitem').filter({hasText:'HUMAN_DECISION_REQUIRED'});await expect(edge.getByRole('button')).toHaveCount(2);await edge.getByRole('button',{name:'문제 단계 조회 ST01: 요구·현행 분석',exact:true}).click();await expect(page.getByRole('region',{name:'전용 원본 선택 단계 상세',exact:true})).toContainText('ST01');await expect(panel(page)).toContainText('COMPLETION_CRITERIA_REQUIRED');await expect(page.getByRole('button',{name:'프로젝트 적용 전환',exact:true})).toBeDisabled();clean(s);
});
test('공통 저장 원본도 같은 오류 위치에서 상세를 선택하며 없는 위치와 원문은 실행·추측하지 않는다',async({page})=>{
 const s=await fixture(page,false);await page.getByText('구조 검사 결과 · 실제 실행 검증 아님',{exact:true}).click();await panel(page).getByRole('listitem').filter({hasText:'COMPLETION_CRITERIA_REQUIRED'}).getByRole('button',{name:'문제 단계 조회 ST02: 기능·데이터 분석',exact:true}).click();await expect(page.getByRole('region',{name:'선택 단계 상세',exact:true})).toContainText('ST02');const unknown=panel(page).getByRole('listitem').filter({hasText:'UNKNOWN_LOCATION'});await expect(unknown.getByRole('button')).toHaveCount(0);await expect(unknown).toContainText('연결할 단계 미확인');await expect(unknown.locator('img')).toHaveCount(0);expect(await page.evaluate(()=>(window as any).ISSUE_EXECUTED)).toBeUndefined();clean(s);
});
test('원본 재조회 403이면 오류 목록과 선택 상세를 함께 숨긴다',async({page})=>{
 const s=await fixture(page,true);await page.getByText('절차 원문과 구조 검사',{exact:true}).click();await panel(page).getByRole('listitem').filter({hasText:'COMPLETION_CRITERIA_REQUIRED'}).getByRole('button',{name:'문제 단계 조회 ST02: 기능·데이터 분석',exact:true}).click();await expect(page.getByRole('region',{name:'전용 원본 선택 단계 상세',exact:true})).toBeVisible();s.deny();await page.getByRole('button',{name:'전용 방법론 목록 갱신',exact:true}).click();await expect(page.getByRole('region',{name:'선택한 전용 원본',exact:true})).toHaveCount(0);await expect(panel(page)).toHaveCount(0);await expect(page.getByRole('region',{name:'전용 원본 선택 단계 상세',exact:true})).toHaveCount(0);clean(s);
});
