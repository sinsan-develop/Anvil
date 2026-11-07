import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {lstat,realpath,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'vite';
import {chromium,type Page} from '@playwright/test';
import {resultFixture,hash} from '../../unit/UI05/result-view-fixture.ts';
const qaRoot=resolve('D:/tmp/anvil-v3-stage-b/ui08-reported-artifact-download-20261027-01');
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
function fixture(){
 const results=[0,1].map(n=>{
  const f=resultFixture(),bytes=n?[137,80,78,71,0,13,10]:[0,255,128,60,112,100,102,62],id=n?'44444444-4444-4444-8444-444444444444':'33333333-3333-4333-8333-333333333333',artifact={id,version:1,contentHash:sha(new Uint8Array(bytes))};
  f.entry.ref.id=n?'88888888-8888-4888-8888-888888888888':f.entry.ref.id;f.entry.snapshot.manifest.artifactRefs=[artifact] as never;f.entry.snapshot.manifestHash=hash(f.entry.snapshot.manifest);f.entry.ref.contentHash=hash(f.entry.snapshot);f.item.ref=f.entry.ref;f.item.manifestRef={id:f.entry.ref.id,version:1,contentHash:f.entry.snapshot.manifestHash};
  return{entry:f.entry,selection:{assignmentRef:f.a,returnDraftRef:f.a,item:f.item},artifact,bytes};
 });
 return{pid:resultFixture().pid,results,session:{user:{id:'55555555-5555-4555-8555-555555555555'},clientId:'66666666-6666-4666-8666-666666666666',csrfToken:'a'.repeat(43)},otherUser:'77777777-7777-4777-8777-777777777777',otherClient:'99999999-9999-4999-8999-999999999999'};
}
const panel=(page:Page)=>page.getByRole('region',{name:'선택 보고의 문제 원문',exact:true});
const original=(page:Page)=>panel(page).getByRole('article',{name:'선택 제출 원문',exact:true});
const area=(page:Page)=>panel(page).getByRole('region',{name:'등록 산출물 원본 다운로드',exact:true});
async function task(page:Page){await page.evaluate(()=>new Promise<void>(resolve=>setTimeout(resolve,0)));}
async function state(page:Page){return page.evaluate(()=>{const q=(window as any).__reportedDownloadQA;return{calls:q.calls.map((v:any)=>({...v})),pending:q.releases.length,cancelled:q.cancelled,authLost:q.authLost,unexpected:q.unexpected};});}
async function change(page:Page,kind:string,side:string){await page.evaluate(({kind,side})=>(window as any).__reportedDownloadQA.change(kind,side),{kind,side});}
async function reset(page:Page){await page.evaluate(()=>(window as any).__reportedDownloadQA.reset());}
async function open(page:Page){await panel(page).getByRole('button',{name:'선택 보고 원문 확인',exact:true}).click();await original(page).waitFor();await area(page).waitFor();}
async function release(page:Page){await page.evaluate(()=>{const q=(window as any).__reportedDownloadQA,item=q.releases.shift();if(!item)throw Error('대기 응답 없음');item.release();});await task(page);}

test('UI08 실제 보고 부모의 원본 다운로드·권한 회수·현재 세션과 선택 문맥 보호',{timeout:60000},async()=>{
 assert.equal(process.env.ANVIL_UI08_REPORTED_ARTIFACT_DOWNLOAD_DOM_QA,'1','Main 사전 등록 뒤 수동 실행만 허용');
 for(const name of ['TEMP','TMP'])assert.equal(resolve(process.env[name]??''),resolve(qaRoot,'temp'));
 for(const path of [qaRoot,resolve(qaRoot,'temp'),resolve(qaRoot,'browser'),resolve(qaRoot,'downloads'),resolve(qaRoot,'results')]){const info=await lstat(path);assert(info.isDirectory()&&!info.isSymbolicLink());assert.equal((await realpath(path)).toLowerCase(),path.toLowerCase());}
 const built=await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:false,sourcemap:false,lib:{entry:resolve('tests/browser/UI08/reported-artifact-download-dom-harness.tsx'),name:'ReportedArtifactDownloadQA',formats:['iife']}}});
 const outputs=Array.isArray(built)?built:[built],code=outputs.flatMap((v:any)=>v.output??[]).find((v:any)=>v.type==='chunk')?.code;assert.equal(typeof code,'string');
 const styles=await Promise.all(['apps/web/src/styles/tokens.css','apps/web/src/styles/app.css'].map(path=>readFile(resolve(path),'utf8')));
 const context=await chromium.launchPersistentContext(resolve(qaRoot,'browser'),{channel:'msedge',headless:true,viewport:{width:1920,height:1080},serviceWorkers:'block',acceptDownloads:true,downloadsPath:resolve(qaRoot,'downloads'),timeout:15000});
 try{
  const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(3500);const errors:string[]=[],unexpected:string[]=[],downloads:any[]=[];
  page.on('pageerror',error=>errors.push(error.name));page.on('download',value=>downloads.push(value));
  await page.route('**/*',route=>route.request().url()==='https://anvil.invalid:3830/'?route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><meta charset="utf-8"><div id="root"></div></html>'}):(unexpected.push(route.request().url()),route.abort()));
  const f=fixture();await page.goto('https://anvil.invalid:3830/');for(const content of styles)await page.addStyleTag({content});await page.evaluate(value=>(window as any).__reportedDownloadSeed=value,f);await page.addScriptTag({content:code});await panel(page).waitFor();
  assert.equal((await state(page)).calls.length,0);await open(page);assert.equal((await state(page)).calls.length,1);assert.equal(downloads.length,0);
  assert.equal(await panel(page).getByRole('region',{name:'제출 산출물 원문',exact:true}).count(),1);
  for(const n of [0,1]){
   if(n){await change(page,'selection','B');assert.equal(await original(page).count(),0);assert.equal(await area(page).count(),0);await open(page);}
   const r=f.results[n]!,event=page.waitForEvent('download');await area(page).getByRole('button',{name:'원본 다운로드 '+r.artifact.id,exact:true}).click();const download=await event;
   assert.equal(download.suggestedFilename(),'artifact-'+r.artifact.id+'.bin');const target=resolve(qaRoot,'downloads','verified-original-'+n+'.bin');await download.saveAs(target);assert.equal(sha(await readFile(target)),sha(new Uint8Array(r.bytes)));
   await area(page).getByRole('status').filter({hasText:'브라우저에 다운로드를 요청했습니다'}).waitFor();
  }
  for(const status of [401,403,404]){
   await reset(page);await open(page);const before=await state(page),count:number=downloads.length;await page.evaluate(status=>(window as any).__reportedDownloadQA.mode='STATUS_'+status,status);
   await area(page).getByRole('button',{name:'원본 다운로드 '+f.results[0]!.artifact.id,exact:true}).click();await panel(page).getByRole('alert').waitFor();assert.equal(await original(page).count(),0);assert.equal(await area(page).count(),0);assert.equal(downloads.length,count);assert.equal((await state(page)).authLost,before.authLost+(status===401?1:0));assert(!(await panel(page).textContent())!.includes('비밀'));
  }
  for(const mode of ['STATUS_412','TYPE','HASH','LOSS']){
   await reset(page);await open(page);const count:number=downloads.length;await page.evaluate(mode=>(window as any).__reportedDownloadQA.mode=mode,mode);await area(page).getByRole('button',{name:'원본 다운로드 '+f.results[0]!.artifact.id,exact:true}).click();await area(page).getByRole('alert').waitFor();assert.equal(downloads.length,count);assert.equal(await original(page).count(),1);assert(!(await panel(page).textContent())!.includes('비밀'));
  }
  for(const kind of ['user','device','session','client','transport','selection']){
   await reset(page);await open(page);const before=await state(page);for(const side of ['B','A']){await change(page,kind,side);assert.equal(await original(page).count(),0);assert.equal(await area(page).count(),0);}assert.equal((await state(page)).calls.length,before.calls.length);
   // 새로운 명시 원문 조회 뒤에만 다시 파일 동작이 가능하다.
   await open(page);assert.equal((await state(page)).calls.length,before.calls.length+1);
  }
  for(const kind of ['user','device','session','client','transport','selection','close','unmount']){
   await reset(page);await open(page);const before=await state(page),count:number=downloads.length;await page.evaluate(()=>(window as any).__reportedDownloadQA.mode='DELAY_401');await area(page).getByRole('button',{name:'원본 다운로드 '+f.results[0]!.artifact.id,exact:true}).click();await page.waitForFunction(()=>(window as any).__reportedDownloadQA.releases.length===1);
   if(kind==='close')await panel(page).getByRole('button',{name:'선택 보고 닫기',exact:true}).click();else{await change(page,kind,'B');if(kind!=='unmount')await change(page,kind,'A');}
   assert.equal(await original(page).count(),0);assert.equal(await area(page).count(),0);const calls=(await state(page)).calls.length;await release(page);await page.waitForFunction(before=>(window as any).__reportedDownloadQA.cancelled>before,before.cancelled);assert.equal(downloads.length,count);assert.equal((await state(page)).authLost,before.authLost);assert.equal((await state(page)).calls.length,calls);
  }
  for(const kind of ['user','transport','selection','close','unmount']){
   await reset(page);const before=await state(page);await page.evaluate(()=>(window as any).__reportedDownloadQA.resultDelay=true);await panel(page).getByRole('button',{name:'선택 보고 원문 확인',exact:true}).click();await page.waitForFunction(()=>(window as any).__reportedDownloadQA.releases.length===1);
   if(kind==='close')await panel(page).getByRole('button',{name:'선택 보고 닫기',exact:true}).click();else{await change(page,kind,'B');if(kind!=='unmount')await change(page,kind,'A');}
   await release(page);await page.waitForFunction(()=>(window as any).__reportedDownloadQA.calls.every((v:any)=>!v.held||v.settled));assert.equal(await original(page).count(),0);assert.equal(await area(page).count(),0);assert.equal((await state(page)).authLost,before.authLost);assert.equal((await state(page)).calls.length,before.calls.length+1);
  }
  await reset(page);await open(page);assert.equal(downloads.length,2);await area(page).screenshot({path:resolve(qaRoot,'results','ui08-reported-artifact-download.png'),animations:'disabled'});
  const final=await state(page);assert.equal(final.pending,0);assert.deepEqual(final.unexpected,[]);assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  assert(final.calls.every((v:any)=>v.path.startsWith('/api/v1/projects/')&&v.method==='GET'&&v.credentials==='same-origin'&&v.redirect==='error'&&v.cache==='no-store'));assert(final.calls.filter((v:any)=>v.path.includes('/files/')).every((v:any)=>v.accept==='application/octet-stream'));
 }finally{await context.close();}
});
