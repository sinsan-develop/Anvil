import assert from 'node:assert/strict';
import {test} from 'node:test';
import {lstat,mkdir,realpath} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {build} from 'vite';
import {chromium,type Page} from '@playwright/test';
import {impactDesignItemFixture} from '../../unit/UI07/impact-design-item-fixture.ts';

const qaRoot=resolve('D:/Project/Anvil/.av3-data/ui07-impact-design-item-20261025-01');
const original=(page:Page)=>page.getByRole('region',{name:'영향 설계 항목 고정 원문',exact:true});
const open=(page:Page)=>page.getByRole('button',{name:'영향 설계 항목 D01 고정 원문 보기',exact:true}).first();
async function state(page:Page){return page.evaluate(()=>{const q=(window as any).__impactDesignItemQA;return{requests:q.requests.map((r:any)=>({path:r.path,method:r.method,kind:r.kind,jsonStarted:r.jsonStarted,settled:r.settled,pending:!!r.release})),authLost:q.authLost,unexpected:q.unexpected};});}

test('UI07 저장 영향 설계 항목을 명시 선택해 등록 상세·고정 줄을 확인하고 늦은 응답을 폐기한다',{timeout:120000},async t=>{
 assert.equal(process.env.ANVIL_UI07_IMPACT_DESIGN_ITEM_DOM_QA,'1','Main 사전등록 QA만 실행');
 assert.equal(resolve(process.env.ANVIL_UI07_IMPACT_DESIGN_ITEM_QA_ROOT??''),qaRoot);
 assert.equal(process.env.USERDOMAIN+'\\'+process.env.USERNAME,'SINSAN\\cyhuh');
 for(const name of ['TEMP','TMP'])assert.equal(resolve(process.env[name]??''),resolve(qaRoot,'temp'));
 const parent=dirname(qaRoot),info=await lstat(parent);assert(info.isDirectory()&&!info.isSymbolicLink());assert.equal((await realpath(parent)).toLowerCase(),parent.toLowerCase());
 try{await lstat(qaRoot);assert.fail('기존 QA root 재사용 금지');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 await mkdir(qaRoot);await mkdir(resolve(qaRoot,'temp'));
 const result=await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:false,sourcemap:false,lib:{entry:resolve('tests/browser/UI07/impact-design-item-dom-harness.tsx'),name:'AnvilImpactDesignItemQA',formats:['iife']}}});
 const outputs=Array.isArray(result)?result:[result];assert.equal(outputs.length,1);const output=outputs[0];assert(output&&typeof output==='object'&&'output'in output&&Array.isArray(output.output));assert.equal(output.output.length,1);const chunk=output.output[0];assert(chunk?.type==='chunk');
 const context=await chromium.launchPersistentContext(resolve(qaRoot,'browser'),{channel:'msedge',headless:true,serviceWorkers:'block',timeout:15000,viewport:{width:1920,height:1080}});
 try{
  const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(4000);const errors:string[]=[],unexpected:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{if(r.request().url()==='https://anvil.invalid:3830/'&&r.request().method()==='GET')return r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><meta charset="utf-8"><div id="root"></div></html>'});unexpected.push(r.request().url());return r.abort();});
  const {bytes,...seed}=impactDesignItemFixture();await page.goto('https://anvil.invalid:3830/');await page.evaluate(seed=>(window as any).__impactDesignItemSeed=seed,seed);await page.addScriptTag({content:chunk.code});
  async function load(history=false){await page.getByRole('textbox',{name:'변경 요청 ID',exact:true}).fill(seed.selection.changeRef.id);await page.getByRole('button',{name:'변경 요청 조회',exact:true}).click();await page.getByRole('region',{name:'보관 설계 변경',exact:true}).waitFor();if(history){await page.getByRole('button',{name:'이전 영향 이력 조회',exact:true}).click();await page.getByText('v2 이전 구간',{exact:false}).waitFor();}}
  async function reset(history=false){await page.evaluate(()=>(window as any).__impactDesignItemQA.reset());await load(history);}
  async function pending(kind:string,status?:number){const before=(await state(page)).requests.length;await page.evaluate(value=>{const q=(window as any).__impactDesignItemQA;if(value.kind.endsWith('-hash'))q.hashPending=value.kind;else q.pending=value;},{kind,status});await open(page).click();await page.waitForFunction(({before,kind})=>(window as any).__impactDesignItemQA.requests.some((r:any,n:number)=>n>=before&&r.kind===kind&&r.jsonStarted&&!r.settled&&r.release),{before,kind});return page.evaluate(({before,kind})=>(window as any).__impactDesignItemQA.requests.findLastIndex((r:any,n:number)=>n>=before&&r.kind===kind&&r.release),{before,kind});}
  async function release(index:number){await page.evaluate(index=>(window as any).__impactDesignItemQA.release(index),index);await page.waitForFunction(index=>(window as any).__impactDesignItemQA.requests[index]?.settled,index);await page.evaluate(()=>new Promise<void>(r=>setTimeout(r,0)));}
  await load();assert.equal((await state(page)).requests.length,1,'명시 열기 전 추가 GET0');
  // 최초 RED는 기존 페이지에 설계 항목 명시 열기 진입이 없는 행동을 검사한다.
  assert.equal(await open(page).count(),1,'저장 영향 D01의 등록 상세·원문 열기가 필요하다');
  await t.test('저장 등록 제목/id/itemHash·같은 고정 줄/본문을 한 곳에서 확인하고 닫는다',async()=>{
   await open(page).click();await original(page).getByRole('heading',{name:'D01 · '+seed.item.title,exact:true}).waitFor();
   const text=await original(page).innerText();for(const expected of [seed.item.id,seed.item.itemHash,seed.document.contentHash])assert(text.includes(expected));
   assert.equal(await original(page).getByLabel('문서 원문',{exact:true}).textContent(),seed.body);assert.equal(await original(page).getByLabel('선택한 설계 원문 줄',{exact:true}).textContent(),seed.body.split('\n')[1]);assert.equal(await original(page).getByRole('status').innerText(),'설계 원문 위치 · v1 · 2줄');
   assert.equal(await page.evaluate(()=>(window as any).impactItemUnsafe),undefined);assert.equal((await state(page)).requests.length,5);
   await original(page).getByRole('button',{name:'영향 설계 항목 원문 닫기',exact:true}).click();assert.equal(await original(page).count(),0);assert.equal((await state(page)).requests.length,5);
  });
  await t.test('과거 구간을 다시 확인하고 최신 영향/다른 원문으로 대체하지 않는다',async()=>{await reset(true);const before=(await state(page)).requests.length;await open(page).click();await original(page).getByLabel('선택한 설계 원문 줄',{exact:true}).waitFor();const reads=(await state(page)).requests.slice(before);assert.equal(reads.length,4);assert.match(reads[0]!.path,/beforeVersion=2$/);assert.equal(reads[1]!.path,'/api/v1/projects/'+seed.selection.projectId+'/design-index?documentId='+seed.document.id+'&version=1');});
  await t.test('미등록/손상 항목·문서hash/본문 변조는 등록 상세·원문을 채택하지 않는다',async()=>{for(const mode of ['ABSENT','ITEM_HASH','DOCUMENT_HASH','BODY_HASH']){await reset();await page.evaluate(mode=>(window as any).__impactDesignItemQA.mode=mode,mode);const before=(await state(page)).requests.length;await open(page).click();await original(page).getByRole('alert').waitFor();assert.equal(await original(page).getByLabel('문서 원문',{exact:true}).count(),0);assert.equal(await original(page).getByRole('heading').count(),0);if(mode==='ABSENT'||mode==='ITEM_HASH')assert.equal((await state(page)).requests.slice(before).some((r:{kind:string})=>r.kind==='document'||r.kind==='file'),false);}});
  await t.test('401/403 응답 뒤 이전 등록 상세·본문을 숨기고 401만 인증상실을 전달한다',async()=>{for(const status of [401,403])for(const kind of ['index','document']){await reset();await open(page).click();await original(page).getByLabel('문서 원문',{exact:true}).waitFor();const auth=(await state(page)).authLost,index=await pending(kind,status);assert.equal(await original(page).getByLabel('문서 원문',{exact:true}).count(),0);await release(index);await original(page).getByRole('alert').waitFor();assert.equal(await original(page).getByRole('heading').count(),0);assert.equal((await state(page)).authLost,auth+(status===401?1:0));assert(!(await original(page).innerText()).includes('노출 금지 오류 원문'));}});
  await t.test('응답 대기 중 닫기/요청 선택 해제/주체·기기·client·project 교체/이탈은 후속 GET0',async()=>{
   for(const kind of ['change','index','document'])for(const change of ['close','selection','user','device','client','project','unmount']){
    await reset();const index=await pending(kind),count=(await state(page)).requests.length;
    if(change==='close')await original(page).getByRole('button',{name:'영향 설계 항목 원문 닫기',exact:true}).click();else if(change==='selection')await page.getByRole('textbox',{name:'변경 요청 ID',exact:true}).fill('');else await page.evaluate(change=>(window as any).__impactDesignItemQA.context(change),change);
    assert.equal(await original(page).count(),0);await release(index);assert.equal(await original(page).count(),0);assert.equal((await state(page)).requests.length,count,'늦은 '+kind+' JSON 뒤 후속 조회 금지 · '+change);
   }
  });
  await t.test('index/body hash 계산 중 닫기와 늦은 401은 상세·원문·인증관측에 반영하지 않는다',async()=>{
   for(const kind of ['index-hash','body-hash']){await reset();const index=await pending(kind),count=(await state(page)).requests.length;await original(page).getByRole('button',{name:'영향 설계 항목 원문 닫기',exact:true}).click();await release(index);assert.equal(await original(page).count(),0);assert.equal((await state(page)).requests.length,count);}
   await reset();const auth=(await state(page)).authLost,index=await pending('index',401);await original(page).getByRole('button',{name:'영향 설계 항목 원문 닫기',exact:true}).click();await release(index);assert.equal((await state(page)).authLost,auth);assert.equal(await original(page).count(),0);
  });
  const final=await state(page);assert.deepEqual(final.unexpected,[]);assert(final.requests.filter((r:{kind:string})=>!r.kind.endsWith('-hash')).every((r:{method:string|undefined})=>r.method==='GET'));assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 }finally{await context.close();}
});
