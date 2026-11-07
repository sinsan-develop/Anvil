import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile,lstat,mkdir,realpath} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium,type Page} from '@playwright/test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {buildOfficialForms} from '../../../apps/server/modules/documents/forms.ts';
const qaRoot=resolve('D:/Project/Anvil/.av3-data/ui06-history-original-20261025-01');
const uid=(n:number)=>`a6f20690-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function fixture(){
 const catalog=buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md',import.meta.url)),await readFile(new URL('../../../docs/design/문서작성_공통기준.md',import.meta.url))),form=catalog.forms[3]!;
 const bodies:Record<number,string>={},documents:Record<number,unknown>={},plans:Record<number,unknown>={},at='2026-10-25T00:00:00.000Z';
 for(const n of [1,2,3]){const body=`\uFEFF# 서로 다른 당시 문서 v${n}\r\n<script>globalThis.historyUnsafe=true</script>`,content={body:{artifactId:uid(10+n),bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/markdown;charset=utf-8'},attachments:[],sections:[],sourceRefs:[]},title=`합성 원문 v${n}`,snapshot={title,formRef:form.ref,stageNodeRef:null,content};
  const document={id:uid(4),version:n,...snapshot,contentHash:contentHash(canonicalJson(snapshot)),confirmed:false,validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef:form.ref,items:[]},contentReviews:[]},documentRef={id:document.id,version:n,contentHash:document.contentHash},planSnapshot={documentRef,designRef:documentRef,screenReviewRefs:[],tasks:[],dependencies:[],reason:`합성 계획 v${n}`,issues:[],relationalProjection:'ISSUES_ONLY'};
  bodies[n]=body;documents[n]=document;plans[n]={ref:{id:uid(3),version:n,contentHash:contentHash(canonicalJson(planSnapshot))},status:'DRAFT',...planSnapshot,executionEvidence:'NOT_CONNECTED',observedAt:at};
 }
 return{pid:uid(1),userA:uid(5),userB:uid(6),clientA:uid(7),clientB:uid(8),at,plans,documents,bodies,form:{...form,authoringStandard:{ref:catalog.standard.ref,content:catalog.standard.body.toString('utf8')},validation:{formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'}}};
}
const history=(page:Page)=>page.getByRole('region',{name:'보관 작업계획 버전 조회',exact:true});
const original=(page:Page)=>history(page).getByRole('region',{name:'계획 작성 문서 고정 원문',exact:true});
interface QAState{requests:{path:string;client:number;method:string;jsonStarted:boolean;settled:boolean}[];authLost:number;render:number;unexpected:string[]}
async function state(page:Page):Promise<QAState>{return page.evaluate(()=>{const q=(window as any).__historyOriginalQA;return{requests:q.requests.map((r:any)=>({path:r.path,client:r.client,method:r.method,jsonStarted:r.jsonStarted,settled:r.settled})),authLost:q.authLost,render:q.render,unexpected:q.unexpected};});}
async function openHistory(page:Page,version='1'){await history(page).getByLabel('조회할 보관 계획 버전',{exact:true}).fill(version);await history(page).getByRole('button',{name:'지정 보관 계획 버전 열기',exact:true}).click();await history(page).getByRole('heading',{name:`계획 v${version}`,exact:true}).waitFor();}
async function openOriginal(page:Page){await history(page).getByRole('button',{name:'계획 작성 문서 고정 원문 보기',exact:true}).click();}
async function ready(page:Page,version='1'){await original(page).getByRole('heading',{name:`합성 원문 v${version}`,exact:true}).waitFor();}

test('UI06 과거 계획에 연결된 서로 다른 작성 문서의 실제 React DOM 조회',{timeout:120000},async t=>{
 assert.equal(process.env.ANVIL_UI06_HISTORY_ORIGINAL_DOM_QA,'1','Main 명시 합성 QA만 허용');
 for(const name of ['TEMP','TMP'])assert.equal(resolve(process.env[name]??''),resolve(qaRoot,'temp'));
 const parent=dirname(qaRoot),info=await lstat(parent);assert(info.isDirectory()&&!info.isSymbolicLink());assert.equal((await realpath(parent)).toLowerCase(),parent.toLowerCase());
 try{await lstat(qaRoot);assert.fail('기존 후보 root 재사용 금지');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 await mkdir(qaRoot);await mkdir(resolve(qaRoot,'temp'));
 const result=await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:false,sourcemap:false,lib:{entry:fileURLToPath(new URL('./work-plan-history-original-dom-harness.tsx',import.meta.url)),name:'AnvilHistoryOriginalQA',formats:['iife']}}});
 const outputs=Array.isArray(result)?result:[result];assert.equal(outputs.length,1);const output=outputs[0];assert(output&&typeof output==='object'&&'output'in output&&Array.isArray(output.output));assert.equal(output.output.length,1);const chunk=output.output[0];assert(chunk?.type==='chunk','단일 chunk/asset0만 허용');
 const context=await chromium.launchPersistentContext(resolve(qaRoot,'browser'),{channel:'msedge',headless:true,serviceWorkers:'block',timeout:15000,viewport:{width:1280,height:900}});
 try{const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(3500);const unknown:string[]=[],errors:string[]=[];
  await page.route('**/*',r=>{if(r.request().url()==='https://anvil.invalid:3830/'&&r.request().method()==='GET')return r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><meta charset="utf-8"><div id="root"></div></html>'});unknown.push(r.request().method()+' '+r.request().url());return r.abort();});page.on('pageerror',e=>errors.push(e.message));
  const seed=await fixture();await page.goto('https://anvil.invalid:3830/');await page.evaluate(value=>(window as any).__historyOriginalSeed=value,seed);await page.addScriptTag({content:chunk.code});
  await page.getByRole('button',{name:`보관 계획 ${uid(3)} 열기`,exact:true}).click();await history(page).waitFor();
  await t.test('과거 v1/v2의 정확 문서만 명시 조회하고 안전 텍스트·닫기를 제공',async()=>{
   assert.equal((await state(page)).requests.filter(r=>r.path.includes('/documents/')).length,0);await openHistory(page);assert.equal((await state(page)).requests.filter(r=>r.path.includes('/documents/')).length,0);
   // 과거 버전 패널의 소비 연결 누락이면 여기서 RED가 발생한다.
   await openOriginal(page);await ready(page);assert.equal(await original(page).getByLabel('계획 작성 문서 보관 본문',{exact:true}).textContent(),seed.bodies[1]);
   assert.equal(await page.locator('script').count(),1);assert.equal(await page.evaluate(()=>(window as any).historyUnsafe),undefined);
   await original(page).getByRole('button',{name:'계획 문서 원문 닫기',exact:true}).click();assert.equal(await original(page).count(),0);
   await openHistory(page,'2');await openOriginal(page);await ready(page,'2');assert.equal(await original(page).getByLabel('계획 작성 문서 보관 본문',{exact:true}).textContent(),seed.bodies[2]);
   const docs=(await state(page)).requests.filter(r=>r.path.includes('/documents/')).map(r=>r.path);assert.deepEqual(docs,[`/api/v1/projects/${seed.pid}/documents/${uid(4)}/versions/1`,`/api/v1/projects/${seed.pid}/documents/${uid(4)}/versions/2`]);
   assert((await page.getByRole('region',{name:'보관 작업계획 상세',exact:true}).textContent())!.includes('계획 v3'));
  });
  async function reset(){await page.getByRole('button',{name:'시험 초기화',exact:true}).click();await page.getByRole('button',{name:`보관 계획 ${uid(3)} 열기`,exact:true}).click();await history(page).waitFor();}
  async function pendingDocument(status=200){const before=(await state(page)).requests.length;await page.evaluate(status=>(window as any).__historyOriginalQA.pending={status:status===200?undefined:status,delayJSON:true},status);await openOriginal(page);await page.waitForFunction(before=>{const q=(window as any).__historyOriginalQA;return q.requests.slice(before).some((r:any)=>r.path.includes('/documents/')&&r.jsonStarted);},before);return(await state(page)).requests.findLastIndex((r,i)=>i>=before&&r.path.includes('/documents/'));}
  async function release(index:number){await page.evaluate(i=>(window as any).__historyOriginalQA.release(i),index);await page.waitForFunction(i=>(window as any).__historyOriginalQA.requests[i]?.settled,index);await page.evaluate(()=>new Promise<void>(done=>setTimeout(done,0)));}
  await t.test('버전 입력·원문 닫기·과거 조회 닫기·부모 새로고침은 지연 원문을 폐기',async()=>{
   for(const action of ['입력','원문 닫기','과거 닫기','새로고침','부모 닫기']){await reset();await openHistory(page);const index=await pendingDocument(),before=(await state(page)).requests.length;
    if(action==='입력')await history(page).getByLabel('조회할 보관 계획 버전',{exact:true}).fill('2');
    else if(action==='원문 닫기')await original(page).getByRole('button',{name:'계획 문서 원문 닫기',exact:true}).click();
    else if(action==='과거 닫기')await history(page).getByRole('button',{name:'과거 계획 원문 닫기',exact:true}).click();
    else if(action==='새로고침')await page.getByRole('button',{name:'작업계획 목록 새로고침',exact:true}).click();
    else await page.getByRole('button',{name:'보관함 표시 전환',exact:true}).click();
    await release(index);assert.equal(await original(page).count(),0);assert.equal((await state(page)).requests.slice(before).filter(r=>r.path.includes('/files/')||r.path.includes('/documents/')).length,0);
    if(action==='부모 닫기')await page.getByRole('button',{name:'보관함 표시 전환',exact:true}).click();
   }
  });
  await t.test('현재 주체·기기·client 객체 ABA는 표시와 늦은401을 복원하지 않음',async()=>{
   for(const kind of ['주체','기기','클라이언트 객체']){
    await reset();await openHistory(page);await openOriginal(page);await ready(page);const shown=(await state(page)).requests.filter(r=>r.path.includes('/documents/')).length;
    for(const side of ['B','A']){await page.getByRole('button',{name:`${kind} ${side}`,exact:true}).click();await history(page).waitFor();assert.equal(await original(page).count(),0);}
    assert.equal((await state(page)).requests.filter(r=>r.path.includes('/documents/')).length,shown);
    await openHistory(page);const index=await pendingDocument(401),auth=(await state(page)).authLost;
    for(const side of ['B','A']){await page.getByRole('button',{name:`${kind} ${side}`,exact:true}).click();await history(page).waitFor();}
    await openHistory(page,'2');await openOriginal(page);await ready(page,'2');await release(index);await ready(page,'2');assert.equal((await state(page)).authLost,auth);assert.equal(await original(page).getByRole('alert').count(),0);
   }
  });
  await t.test('현재401만 인증상실 통지하며403/404는 이전·현재 다른 버전으로 대체하지 않음',async()=>{
   for(const status of [401,403,404]){await reset();await openHistory(page);const before=await state(page),auth=before.authLost;
    await page.evaluate(status=>(window as any).__historyOriginalQA.pending={status},status);await openOriginal(page);await original(page).getByRole('alert').waitFor();assert((await original(page).textContent())!.includes(status===401?'AUTH_REQUIRED':status===403?'ACCESS_DENIED':'NOT_FOUND'));assert(!(await original(page).textContent())!.includes('비공개 오류 원문'));
    assert.equal(await original(page).getByLabel('계획 작성 문서 보관 본문',{exact:true}).count(),0);assert.equal((await state(page)).authLost,auth+(status===401?1:0));
    assert.equal((await state(page)).requests.slice(before.requests.length).filter(r=>r.path.includes('/files/')||r.path.endsWith('/documents/'+uid(4)+'/versions/3')).length,0);
   }
  });
  assert.deepEqual((await state(page)).unexpected,[]);assert((await state(page)).requests.every(r=>r.method==='GET'));assert.deepEqual(unknown,[]);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
