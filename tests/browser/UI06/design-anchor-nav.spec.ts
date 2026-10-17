import{test,expect,type Page}from'@playwright/test';
import{readFile}from'node:fs/promises';import{pathToFileURL}from'node:url';
import{canonicalJson,contentHash}from'../../../contracts/canonical.ts';
const qa='D:/tmp/anvil-v3-stage-b/browser/ui06-design-anchor-nav-01';process.env.TEMP=qa+'/browser-temp';process.env.TMP=process.env.TEMP;
const dist=pathToFileURL(qa+'/dist/');
const project='51c0439f-791e-4bb5-8471-70938d6afaf1',other='51c0439f-791e-4bb5-8471-70938d6afaf2',id='32b5f276-13e6-4d8a-b93f-27a15d21c788',aid='a6f30000-0000-4000-8000-000000000099',at='2026-10-16T04:00:00.000Z';
const literal='<img src=x onerror="window.ANCHOR_EXECUTED=true">',body='\uFEFF# 설계 원문\r\n'+literal+'\r\n끝';
test.beforeEach(async({page})=>{
 await page.route('https://localhost:3830/**',async r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/'))return r.fallback();if(r.request().method()!=='GET'||u.pathname!=='/'&&!/^\/assets\/[A-Za-z0-9_.-]+$/.test(u.pathname))return r.abort('blockedbyclient');const p=u.pathname==='/'?'index.html':u.pathname.slice(1);return r.fulfill({body:await readFile(new URL(p,dist)),contentType:p.endsWith('.html')?'text/html':p.endsWith('.css')?'text/css':'application/javascript'});});
});
async function fixture(page:Page,options:{body?:string;anchor?:string;delayed?:boolean;wrongVersion?:boolean}={}){
 const writes:string[]=[],unknown:string[]=[],errors:string[]=[],offOrigin:string[]=[];let release=()=>{},seen=()=>{};
 const pending=new Promise<void>(resolve=>{release=resolve;}),requested=new Promise<void>(resolve=>{seen=resolve;});
 page.on('pageerror',e=>errors.push(e.name));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method());if(new URL(r.url()).origin!=='https://localhost:3830')offOrigin.push(new URL(r.url()).origin);});
 await page.route('**/api/v1/**',r=>{unknown.push(new URL(r.request().url()).pathname);return r.fulfill({status:503,json:{code:'UNEXPECTED_QA_API'}});});
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id,displayName:'위치 조회 QA'},clientId:id,csrfToken:'C'.repeat(43)}}));
 for(const p of [project,other]){
  await page.route(`**/api/v1/projects/${p}`,r=>r.fulfill({json:{id:p,participation:'OWNER',controlState:{actorId:id,clientId:id,generation:1,status:'HELD'}}}));
  await page.route(`**/api/v1/projects/${p}/documents?*`,r=>r.fulfill({json:{items:[{id,title:'설계 원문',headVersion:2,confirmedVersion:null,updatedAt:at}],nextCursor:null,hasMore:false,observedAt:at}}));
 }
 const text=options.body??body,artifact={artifactId:aid,bytes:Buffer.byteLength(text),contentHash:contentHash(Buffer.from(text)),mediaType:'text/markdown;charset=utf-8'};
 await page.route(`**/api/v1/projects/*/documents/${id}/versions/*`,r=>{const version=Number(new URL(r.request().url()).pathname.split('/').pop());return r.fulfill({json:{id,version,title:'설계 원문 v'+version,confirmed:false,contentHash:(version===2?'b':'c').repeat(64),formRef:{id:aid,version:1,contentHash:'a'.repeat(64)},stageNodeRef:null,content:{body:artifact,attachments:[],sections:[],sourceRefs:[]},validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef:{id:aid,version:1,contentHash:'a'.repeat(64)},items:[]},contentReviews:[]}});});
 await page.route(`**/api/v1/projects/*/files/${aid}`,r=>r.fulfill({contentType:'application/octet-stream',body:Buffer.from(text)}));
 await page.route('**/api/v1/projects/*/design-index?*',async r=>{seen();if(options.delayed)await pending;const version=options.wrongVersion?1:Number(new URL(r.request().url()).searchParams.get('version')),documentRef={id,version,contentHash:(version===2?'b':'c').repeat(64)},item={documentRef,localCode:'D01',title:'설계 위치',anchor:options.anchor??'line:2'};try{await r.fulfill({json:{documentRef,items:[{id:aid,...item,itemHash:contentHash(canonicalJson(item))}],screenRegions:[],status:'INDEXED',observedAt:at}});}catch{/* 이동으로 폐기된 합성 요청만 */}});
 return{writes,unknown,errors,offOrigin,text,release,requested};
}
async function open(page:Page){await page.goto(`/#/projects/${project}/documents`);await page.getByRole('button',{name:'설계 원문 열기',exact:true}).click();await page.getByRole('button',{name:'이 버전 설계 추적 조회',exact:true}).click();}
test('정확 버전 설계 항목 선택은 원문 해당 줄로 이동·강조하고 버전 변경 때 해제한다',async({page})=>{
 const s=await fixture(page);await open(page);const button=page.getByRole('button',{name:'D01 원문 위치 보기',exact:true});await expect(button).toBeVisible();await button.click();
 const mark=page.getByLabel('선택한 설계 원문 줄',{exact:true});await expect(mark).toHaveText(literal);await expect(mark).toBeFocused();expect(await page.getByLabel('문서 원문',{exact:true}).textContent()).toBe(body);await expect(page.getByLabel('문서 원문',{exact:true}).locator('img,script')).toHaveCount(0);expect(await page.evaluate(()=>(window as any).ANCHOR_EXECUTED)).toBeUndefined();
 await page.getByLabel('조회 버전',{exact:true}).fill('1');await page.getByRole('button',{name:'지정 버전 조회',exact:true}).click();await expect(page.getByRole('heading',{name:'설계 원문 v1',exact:true})).toBeVisible();await expect(mark).toHaveCount(0);expect(s.writes).toEqual([]);expect(s.unknown).toEqual([]);expect(s.errors).toEqual([]);expect(s.offOrigin).toEqual([]);
});
for(const c of [{name:'없는 줄',options:{anchor:'line:99'}},{name:'큰 문서',options:{body:'가'.repeat(131073)}}])test(c.name+'은 원문을 유지하고 추측 강조 없이 미확인으로 표시한다',async({page})=>{
 const s=await fixture(page,c.options);await open(page);await page.getByRole('button',{name:'D01 원문 위치 보기',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'원문 위치 미확인'})).toBeVisible();await expect(page.getByLabel('선택한 설계 원문 줄',{exact:true})).toHaveCount(0);expect(await page.getByLabel('문서 원문',{exact:true}).textContent()).toBe(s.text);expect(s.writes).toEqual([]);expect(s.unknown).toEqual([]);
});
test('다른 프로젝트 이동 뒤 늦은 추적 응답은 원문 선택을 되살리지 않는다',async({page})=>{
 const s=await fixture(page,{delayed:true});await open(page);await s.requested;await page.evaluate(p=>{location.hash='#/projects/'+p+'/documents';},other);await expect(page.getByRole('button',{name:'설계 원문 열기',exact:true})).toBeVisible();const late=page.waitForResponse(r=>r.url().includes('/design-index?'));s.release();await(await late).finished();await expect(page.getByLabel('선택한 설계 원문 줄',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'D01 원문 위치 보기',exact:true})).toHaveCount(0);expect(s.writes).toEqual([]);expect(s.unknown).toEqual([]);
});
test('추적의 다른 버전 응답은 거절하고 원문 위치를 임의로 대체하지 않는다',async({page})=>{
 const s=await fixture(page,{wrongVersion:true});await open(page);await expect(page.getByRole('alert')).toContainText('RESPONSE_INVALID');await expect(page.getByRole('button',{name:'D01 원문 위치 보기',exact:true})).toHaveCount(0);await expect(page.getByLabel('선택한 설계 원문 줄',{exact:true})).toHaveCount(0);expect(s.writes).toEqual([]);expect(s.unknown).toEqual([]);
});
test('위치 조회와 해제는 미저장 편집 입력을 바꾸거나 저장 명령을 만들지 않는다',async({page})=>{
 const s=await fixture(page);await open(page);await page.getByRole('button',{name:'이 버전에서 편집',exact:true}).click();const input=page.getByLabel('문서 본문 편집',{exact:true});await input.fill('내 미저장 편집\n별도 저장 전');await page.getByRole('button',{name:'D01 원문 위치 보기',exact:true}).click();await expect(page.getByLabel('선택한 설계 원문 줄',{exact:true})).toHaveText(literal);await expect(input).toHaveValue('내 미저장 편집\n별도 저장 전');await page.getByRole('button',{name:'원문 위치 선택 해제',exact:true}).click();await expect(page.getByLabel('선택한 설계 원문 줄',{exact:true})).toHaveCount(0);await expect(input).toHaveValue('내 미저장 편집\n별도 저장 전');expect(s.writes).toEqual([]);
 await page.route(`**/api/v1/projects/${project}/files`,r=>r.abort('connectionreset'));await page.getByLabel('문서 변경 이유',{exact:true}).fill('별도 저장 시도');await page.getByRole('button',{name:'새 초안 버전 저장',exact:true}).click();await expect(page.getByRole('alert')).toContainText('CONNECTION_LOST');await expect(page.getByRole('button',{name:'같은 저장 명령 결과 확인',exact:true})).toBeVisible();await page.getByRole('button',{name:'D01 원문 위치 보기',exact:true}).click();await page.getByRole('button',{name:'원문 위치 선택 해제',exact:true}).click();await expect(input).toHaveValue('내 미저장 편집\n별도 저장 전');await expect(input).toHaveAttribute('readonly','');await expect(page.getByRole('button',{name:'같은 저장 명령 결과 확인',exact:true})).toBeVisible();expect(s.writes).toEqual(['POST']);expect(s.unknown).toEqual([]);
});
