import assert from 'node:assert/strict';
import {test} from 'node:test';
import {lstat,mkdir,realpath} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium,type Page} from '@playwright/test';
import {contentHash} from '../../../contracts/canonical.ts';
import {resultFixture,hash} from '../../unit/UI05/result-view-fixture.ts';
const qaRoot=resolve('D:/Project/Anvil/.av3-data/ui08-reported-artifact-20261025-01');
const uid=(n:number)=>`a6081200-0000-4000-8000-${String(n).padStart(12,'0')}`;
function fixture(){
 const results=[1,2].map(n=>{
  const f=resultFixture(),text=`등록 명령 출력 ${n} <img src=x onerror="window.issueUnsafe=1">`,diff=`--- src/task.ts\n+++ src/task.ts\n+보관 diff ${n}`,ref=(i:number,body:string)=>({id:uid(i),version:1,contentHash:contentHash(Buffer.from(body))}),output=ref(n*10,text),change=ref(n*10+1,diff),execution=f.entry.snapshot.scope.executionRef;
  f.entry.ref.id=uid(n);f.entry.snapshot.manifest.artifactRefs=[output,change] as never;
  f.entry.snapshot.manifest.changes=[{path:'src/task.ts',kind:'MODIFIED',diffRef:change,beforeHash:null,afterHash:null},{path:'src/other.ts',kind:'MODIFIED',diffRef:{...change,contentHash:'f'.repeat(64)},beforeHash:null,afterHash:null}] as never;
  const command={profileRef:execution,argv:['합성 보고'],cwdRef:execution,hostRef:execution,executionRef:execution,startedAt:null,finishedAt:null,exitCode:null,outputRef:output,evidence:[]};
  f.entry.snapshot.manifest.commandResults=[command,{...command,executionRef:{...execution,contentHash:'f'.repeat(64)}}] as never;
  f.entry.snapshot.manifestHash=hash(f.entry.snapshot.manifest);f.entry.ref.contentHash=hash(f.entry.snapshot);f.item.ref=f.entry.ref;f.item.manifestRef={id:f.entry.ref.id,version:1,contentHash:f.entry.snapshot.manifestHash};
  const artifacts=[{ref:output,text},{ref:change,text:diff}].map(v=>({path:`/api/v1/projects/${f.pid}/results/${f.entry.ref.id}/artifacts/${v.ref.id}/text`,response:{projectId:f.pid,resultRef:f.entry.ref,artifactRef:v.ref,bytes:Buffer.byteLength(v.text),mediaType:'text/plain;charset=utf-8',text:v.text,sourceState:'REGISTERED_BYTES_ONLY',evidenceProvenanceVerified:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false,observedAt:'2026-10-25T00:00:00.000Z'}}));
  return{entry:f.entry,selection:{assignmentRef:f.a,returnDraftRef:f.a,item:f.item},artifacts,text,diff};
 });return{pid:resultFixture().pid,otherProject:uid(99),results};
}
const panel=(page:Page)=>page.getByRole('region',{name:'선택 보고의 문제 원문',exact:true});
const reader=(page:Page)=>panel(page).getByRole('region',{name:'제출 산출물 원문',exact:true});
const body=(page:Page)=>reader(page).getByRole('article',{name:'선택 산출물 텍스트',exact:true});
interface State{requests:{path:string;method:string;client:number;held:boolean;settled:boolean}[];authLost:number;unexpected:string[]}
async function state(page:Page):Promise<State>{return page.evaluate(()=>{const q=(window as any).__issueArtifactQA;return{requests:q.requests.map((r:any)=>({path:r.path,method:r.method,client:r.client,held:r.held,settled:r.settled})),authLost:q.authLost,unexpected:q.unexpected};});}
async function open(page:Page){await panel(page).getByRole('button',{name:'선택 보고 원문 확인',exact:true}).click();await reader(page).waitFor();}
async function output(page:Page){await reader(page).getByRole('button',{name:'명령 출력 1 원문 보기',exact:true}).click();}
test('UI08 선택 보고의 기존 등록 산출물·명령 출력·diff 읽기 실제 React DOM',{timeout:120000},async t=>{
 assert.equal(process.env.ANVIL_UI08_REPORTED_ARTIFACT_DOM_QA,'1','Main 명시 합성 QA만 허용');for(const name of ['TEMP','TMP'])assert.equal(resolve(process.env[name]??''),resolve(qaRoot,'temp'));
 const parent=dirname(qaRoot),info=await lstat(parent);assert(info.isDirectory()&&!info.isSymbolicLink());assert.equal((await realpath(parent)).toLowerCase(),parent.toLowerCase());
 try{await lstat(qaRoot);assert.fail('기존 root 재사용 금지');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}await mkdir(qaRoot);await mkdir(resolve(qaRoot,'temp'));
 const built=await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:false,sourcemap:false,lib:{entry:fileURLToPath(new URL('./reported-issue-artifact-dom-harness.tsx',import.meta.url)),name:'AnvilIssueArtifactQA',formats:['iife']}}});
 const outputs=Array.isArray(built)?built:[built];assert.equal(outputs.length,1);const outputChunk=outputs[0];assert(outputChunk&&typeof outputChunk==='object'&&'output'in outputChunk&&Array.isArray(outputChunk.output));assert.equal(outputChunk.output.length,1);const chunk=outputChunk.output[0];assert(chunk?.type==='chunk');
 const context=await chromium.launchPersistentContext(resolve(qaRoot,'browser'),{channel:'msedge',headless:true,serviceWorkers:'block',timeout:15000,viewport:{width:1920,height:1080}});
 try{const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(3500);const errors:string[]=[],unknown:string[]=[];
  await page.route('**/*',route=>{if(route.request().url()==='https://anvil.invalid:3830/'&&route.request().method()==='GET')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><meta charset="utf-8"><div id="root"></div></html>'});unknown.push(route.request().url());return route.abort();});page.on('pageerror',e=>errors.push(e.message));
  const seed=fixture();await page.goto('https://anvil.invalid:3830/');await page.evaluate(v=>(window as any).__issueArtifactSeed=v,seed);await page.addScriptTag({content:chunk.code});await panel(page).waitFor();
  async function reset(){await page.getByRole('button',{name:'시험 초기화',exact:true}).click();await open(page);}
  async function pending(status=200){const before=(await state(page)).requests.length,path=seed.results[0]!.artifacts[0]!.path;await page.evaluate(status=>(window as any).__issueArtifactQA.pending={delay:true,...(status===200?{}:{status})},status);await output(page);await page.waitForFunction(({before,path})=>(window as any).__issueArtifactQA.requests.some((r:any,i:number)=>i>=before&&r.path===path&&r.held&&!r.settled&&typeof r.release==='function'),{before,path});return page.evaluate(({before,path})=>(window as any).__issueArtifactQA.requests.findLastIndex((r:any,i:number)=>i>=before&&r.path===path&&r.held&&!r.settled&&typeof r.release==='function'),{before,path});}
  async function release(index:number){await page.evaluate(i=>(window as any).__issueArtifactQA.release(i),index);await page.waitForFunction(i=>(window as any).__issueArtifactQA.requests[i]?.settled,index);await page.evaluate(()=>new Promise<void>(resolve=>setTimeout(resolve,0)));}
  await t.test('명시 클릭 전 파일 GET0·등록 출력/diff exact 조회·HTML 안전 텍스트',async()=>{
   assert.equal((await state(page)).requests.length,0);await open(page);assert.equal((await state(page)).requests.length,1);
   assert.equal(await reader(page).getByRole('button',{name:'명령 출력 2 원문 보기',exact:true}).isDisabled(),true);assert.equal(await reader(page).getByRole('button',{name:'변경 diff 2 원문 보기',exact:true}).isDisabled(),true);
   await output(page);await body(page).waitFor();assert.equal(await body(page).locator('pre').textContent(),seed.results[0]!.text);assert.equal(await page.locator('img').count(),0);assert.equal(await page.evaluate(()=>(window as any).issueUnsafe),undefined);
   await reader(page).getByRole('button',{name:'변경 diff 1 원문 보기',exact:true}).click();await page.waitForFunction(text=>document.querySelector('[aria-label="선택 산출물 텍스트"] pre')?.textContent===text,seed.results[0]!.diff);
   assert.deepEqual((await state(page)).requests.slice(1).map(r=>r.path),seed.results[0]!.artifacts.map(a=>a.path));assert((await body(page).textContent())!.includes('시험 PASS/Agent 수행 증명 아님'));
  });
  await t.test('403/401은 부모 제출까지 숨기고401만 한 번 통지·격리/변조/다른 fullref는 원문 비노출',async()=>{
   for(const mode of [403,401,422,'tamper','mismatch'] as const){await reset();await output(page);await body(page).waitFor();const before=await state(page);await page.evaluate(mode=>(window as any).__issueArtifactQA.pending=typeof mode==='number'?{status:mode}:{[mode]:true},mode);await reader(page).getByRole('button',{name:'선택 산출물 다시 조회',exact:true}).click();await panel(page).getByRole('alert').waitFor();assert.equal(await body(page).count(),0);assert(!(await panel(page).textContent())!.includes('비공개 오류 원문'));assert.equal((await state(page)).authLost,before.authLost+(mode===401?1:0));if(mode===401||mode===403)assert.equal(await panel(page).getByRole('article',{name:'선택 제출 원문',exact:true}).count(),0);}
  });
  await t.test('닫기·보고 선택·부모 재조회·client/project ABA는 이전 본문과 지연401 폐기',async()=>{
   for(const action of ['닫기','선택','선택 해시','재조회','클라이언트','프로젝트']){await reset();await output(page);await body(page).waitFor();const before=await state(page),index=await pending(401);
    if(action==='닫기')await panel(page).getByRole('button',{name:'선택 보고 닫기',exact:true}).click();else if(action==='선택'){await page.getByRole('button',{name:'선택 B',exact:true}).click();await page.getByRole('button',{name:'선택 A',exact:true}).click();}else if(action==='재조회'){await panel(page).getByRole('button',{name:'선택 보고 원문 다시 확인',exact:true}).click();await reader(page).waitFor();}else{for(const side of ['B','A'])await page.getByRole('button',{name:action+' '+side,exact:true}).click();}
    assert.equal(await body(page).count(),0);const calls=(await state(page)).requests.length;await release(index);assert.equal(await body(page).count(),0);assert.equal((await state(page)).authLost,before.authLost);assert.equal((await state(page)).requests.length,calls);
   }
  });
  await t.test('완료 본문도 client·project·다른 보고 전환 즉시 숨기고 새 명시 조회만 허용',async()=>{
   for(const kind of ['클라이언트','프로젝트','선택','선택 해시']){await reset();await output(page);await body(page).waitFor();const calls=(await state(page)).requests.length;await page.getByRole('button',{name:kind+' B',exact:true}).click();assert.equal(await body(page).count(),0);assert.equal(await panel(page).getByRole('article',{name:'선택 제출 원문',exact:true}).count(),0);assert.equal((await state(page)).requests.length,calls);await page.getByRole('button',{name:kind+' A',exact:true}).click();assert.equal(await body(page).count(),0);assert.equal((await state(page)).requests.length,calls);}
  });
  assert.deepEqual((await state(page)).unexpected,[]);assert((await state(page)).requests.every(r=>r.method==='GET'));assert.deepEqual(unknown,[]);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
