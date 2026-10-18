import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {buildOfficialForms} from '../../../apps/server/modules/documents/forms.ts';
import {buildBuiltinMethodologies} from '../../../apps/server/modules/methodologies/builtins.ts';
import {validateMethodologyGraph} from '../../../apps/server/modules/methodologies/service.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const forms=buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md',import.meta.url)),await readFile(new URL('../../../docs/design/문서작성_공통기준.md',import.meta.url))),builtin=buildBuiltinMethodologies(await readFile(new URL('../../../docs/design/기본방법론_상세검토안.md',import.meta.url)),forms.forms)[0]!;
const uid='a6f20380-0000-4000-8000-000000000001',mid='a6f20380-0000-4000-8000-000000000002';
async function fixture(page:Page){
 const dist=process.env.ANVIL_UI03_DRAFT_NAV_DIST;if(dist!=='D:/tmp/anvil-v3-stage-b/ui03-draft-validation-01/dist')throw Error('REGISTERED_CANDIDATE_DIST_REQUIRED');
 const graph=structuredClone(builtin.graph);graph.nodes[1]!.completionCriteria=[];graph.edges[0]!.condition={fieldRef:{nodeId:'ST02',field:'USER_DECISION'},operator:'EQ',value:'CONTINUE'};
 const validation=validateMethodologyGraph(graph,forms.forms.map(f=>f.ref));validation.issues.push({code:'TEST_ENTRY',location:'entryNodeId',message:'시작 단계 확인',severity:'WARNING',relatedRefs:[]},{code:'TEST_TERMINAL',location:'terminalNodeIds',message:'종료 단계 확인',severity:'WARNING',relatedRefs:[]},{code:'UNKNOWN_LOCATION',location:'nodes.NOT_PRESENT',message:'<img src=x onerror="window.ISSUE_EXECUTED=1">',severity:'ERROR',relatedRefs:[]});
 const value={ref:{id:mid,version:1,contentHash:contentHash(canonicalJson(graph))},name:'편집 오류 이동 QA',purpose:'같은 저장본 오류 이동',scope:'USER_COMMON',systemCode:null,graph,confirmation:null,validation,runtimeReadiness:'PROJECT_BINDINGS_REQUIRED'},errors:string[]=[],unknown:string[]=[],writes:string[]=[],offOrigin:string[]=[];
 page.on('pageerror',e=>errors.push(e.name));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method());if(new URL(r.url()).origin!=='https://localhost:3830')offOrigin.push(new URL(r.url()).origin);});
 await page.route('**/*',r=>new URL(r.request().url()).origin==='https://localhost:3830'?r.fallback():r.abort('blockedbyclient'));
 await page.route('https://localhost:3830/**',async r=>{const path=new URL(r.request().url()).pathname;if(path.startsWith('/api/'))return r.fallback();if(r.request().method()!=='GET'||path!=='/'&&!/^\/assets\/[A-Za-z0-9_.-]+$/.test(path))return r.abort('blockedbyclient');const name=path==='/'?'index.html':path.slice(1);return r.fulfill({body:await readFile(new URL(name,pathToFileURL(dist+'/'))),contentType:name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'application/javascript'});});
 await page.route('**/api/v1/**',r=>{unknown.push(new URL(r.request().url()).pathname);return r.fulfill({status:503,json:{code:'UNEXPECTED_QA_API'}});});
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:uid,displayName:'편집 오류 QA'},clientId:uid,csrfToken:'A'.repeat(43)}}));
 await page.route('**/api/v1/auth/setup',r=>r.fulfill({json:{setupRequired:false,policyVersion:1}}));
 await page.route('**/api/v1/forms',r=>r.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:new Date().toISOString(),baselineVersion:null}}));
 await page.route(/\/api\/v1\/methodologies(?:\?.*)?$/,r=>r.fulfill({json:{items:[{...value,status:'DRAFT',sourceAvailable:false}],hasMore:false,nextCursor:null,observedAt:new Date().toISOString(),baselineVersion:null}}));
 await page.route(`**/api/v1/methodologies/${mid}/versions/1`,r=>r.fulfill({json:value}));
 await page.goto('/#/methodologies');await page.getByRole('button',{name:'이 공통본 편집',exact:true}).click();return{errors,unknown,writes,offOrigin,graph};
}
const panel=(page:Page)=>page.getByLabel('저장한 그래프 구조 검사',{exact:true});
function clean(s:Awaited<ReturnType<typeof fixture>>){expect(s.errors).toEqual([]);expect(s.unknown).toEqual([]);expect(s.writes).toEqual([]);expect(s.offOrigin).toEqual([]);}
test('편집 저장본의 연결·시작·종료 오류에서 정확 단계를 선택하고 원문·검사 조건은 보존한다',async({page})=>{
 const s=await fixture(page);await expect(panel(page)).toBeVisible();const edge=panel(page).getByRole('listitem').filter({hasText:`edges.${s.graph.edges[0]!.edgeId}`});
 await expect(edge.getByRole('button')).toHaveCount(2);await edge.getByRole('button',{name:'문제 단계 선택 ST02: 기능·데이터 분석',exact:true}).click();await expect(page.getByLabel('단계 이름 편집',{exact:true})).toHaveValue('기능·데이터 분석');
 await panel(page).getByRole('listitem').filter({hasText:'TEST_ENTRY'}).getByRole('button').click();await expect(page.getByLabel('단계 이름 편집',{exact:true})).toHaveValue(s.graph.nodes.find(n=>n.nodeId===s.graph.entryNodeId)!.name);
 const terminal=panel(page).getByRole('listitem').filter({hasText:'TEST_TERMINAL'});await expect(terminal.getByRole('button')).toHaveCount(s.graph.terminalNodeIds.length);await terminal.getByRole('button').first().click();await expect(page.getByLabel('단계 이름 편집',{exact:true})).toHaveValue(s.graph.nodes.find(n=>n.nodeId===s.graph.terminalNodeIds[0])!.name);
 await expect(panel(page)).toContainText('COMPLETION_CRITERIA_REQUIRED');await expect(panel(page)).toContainText('ERROR');await expect(page.getByRole('button',{name:'공통본 새 버전 저장',exact:true})).toBeDisabled();clean(s);
});
test('없는 오류 위치는 추측하지 않고 텍스트로만 표시하며 편집 뒤 이전 검사 이동은 없앤다',async({page})=>{
 const s=await fixture(page),unknown=panel(page).getByRole('listitem').filter({hasText:'UNKNOWN_LOCATION'});await expect(unknown.getByRole('button')).toHaveCount(0);await expect(unknown).toContainText('연결할 단계 미확인');await expect(unknown.locator('img')).toHaveCount(0);expect(await page.evaluate(()=>(window as any).ISSUE_EXECUTED)).toBeUndefined();
 await page.getByLabel('단계 목적 편집',{exact:true}).fill('기존 검사 후 바뀐 입력');await expect(panel(page)).toHaveCount(0);await expect(page.getByText('현재 입력은 검사 전입니다. 초안 저장 후 서버의 구조 검사 결과와 오류 위치를 확인하세요.',{exact:true})).toBeVisible();clean(s);
});
