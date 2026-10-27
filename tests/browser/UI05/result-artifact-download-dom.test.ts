import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {lstat,realpath,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'vite';
import {chromium,type Page} from '@playwright/test';
import {resultFixture,hash} from '../../unit/UI05/result-view-fixture.ts';
const qaRoot=resolve('D:/tmp/anvil-v3-stage-b/ui05-result-artifact-download-20261027-01');
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
function seed(){
 const f=resultFixture(),ids=['33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'],files:Record<string,number[]>={[ids[0]!]:[0,255,128,60,112,100,102,62],[ids[1]!]:[137,80,78,71,0,13,10]};
 f.entry.snapshot.manifest.artifactRefs=ids.map(id=>({id,version:1,contentHash:sha(new Uint8Array(files[id]!))})) as never;f.entry.snapshot.manifestHash=hash(f.entry.snapshot.manifest);f.entry.ref.contentHash=hash(f.entry.snapshot);
 return {result:f.entry,files,assignment:{projectId:f.pid,ref:f.a,snapshot:{definition:{}}},session:{user:{id:'55555555-5555-4555-8555-555555555555'},clientId:'66666666-6666-4666-8666-666666666666',csrfToken:'a'.repeat(43)},ids};
}
async function task(page:Page){await page.evaluate(()=>new Promise<void>(resolve=>setTimeout(resolve,0)));}
test('UI05 실제 부모의 명시 원본 다운로드·bytes와 오류·ABA/주체/결과/이탈을 보존한다',{timeout:60000},async()=>{
 assert.equal(process.env.ANVIL_UI05_ARTIFACT_DOWNLOAD_DOM_QA,'1','Main 사전 등록 뒤 수동 실행만 허용');
 for(const name of ['TEMP','TMP'])assert.equal(resolve(process.env[name]??''),resolve(qaRoot,'temp'));
 for(const path of [qaRoot,resolve(qaRoot,'temp'),resolve(qaRoot,'browser'),resolve(qaRoot,'downloads'),resolve(qaRoot,'results')]){const info=await lstat(path);assert(info.isDirectory()&&!info.isSymbolicLink());assert.equal((await realpath(path)).toLowerCase(),path.toLowerCase());}
 const built=await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:false,sourcemap:false,lib:{entry:resolve('tests/browser/UI05/result-artifact-download-dom-harness.tsx'),name:'ArtifactDownloadQA',formats:['iife']}}});
 const outputs=Array.isArray(built)?built:[built];const code=outputs.flatMap((v:any)=>v.output??[]).find((v:any)=>v.type==='chunk')?.code;assert.equal(typeof code,'string');
 const styles=await Promise.all(['apps/web/src/styles/tokens.css','apps/web/src/styles/app.css'].map(path=>readFile(resolve(path),'utf8')));
 const context=await chromium.launchPersistentContext(resolve(qaRoot,'browser'),{channel:'msedge',headless:true,viewport:{width:1920,height:1080},serviceWorkers:'block',acceptDownloads:true,downloadsPath:resolve(qaRoot,'downloads'),timeout:15000});
 try{
  const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(10000);const errors:string[]=[],unexpected:string[]=[],downloads:any[]=[];
  page.on('pageerror',error=>errors.push(error.name));page.on('download',value=>downloads.push(value));
  await page.route('**/*',route=>route.request().url()==='https://anvil.invalid:3830/'?route.fulfill({contentType:'text/html',body:'<!doctype html><div id="root"></div>'}):(unexpected.push(route.request().url()),route.abort()));
  const f=seed();await page.goto('https://anvil.invalid:3830/');for(const content of styles)await page.addStyleTag({content});await page.evaluate(value=>(window as any).__artifactDownloadSeed=value,f);await page.addScriptTag({content:code});
  const area=page.getByRole('region',{name:'등록 산출물 원본 다운로드',exact:true}),a=area.getByRole('button',{name:'원본 다운로드 '+f.ids[0],exact:true}),b=area.getByRole('button',{name:'원본 다운로드 '+f.ids[1],exact:true});
  await a.waitFor();assert.equal(await page.evaluate(()=>(window as any).__artifactDownloadQA.calls.length),0);
  const event=page.waitForEvent('download');await a.click();const download=await event;assert.equal(download.suggestedFilename(),'artifact-'+f.ids[0]+'.bin');const target=resolve(qaRoot,'downloads','verified-original.bin');await download.saveAs(target);assert.equal(sha(await readFile(target)),sha(new Uint8Array(f.files[f.ids[0]!]!)));
  await area.getByRole('status').filter({hasText:'브라우저에 다운로드를 요청했습니다'}).waitFor();
  await area.screenshot({path:resolve(qaRoot,'results','ui05-result-artifact-download.png'),animations:'disabled'});
  assert.deepEqual(await page.evaluate(()=>{const q=(window as any).__artifactDownloadQA;return{created:q.created.length,revoked:q.revoked.length,links:document.querySelectorAll('a[download]').length};}),{created:1,revoked:1,links:0});
  assert.equal(await page.getByRole('region',{name:'제출 산출물 원문',exact:true}).count(),1);
  for(const mode of ['STATUS_401','STATUS_403','STATUS_404','STATUS_412','TYPE','HASH','LOSS']){await page.evaluate(mode=>(window as any).__artifactDownloadQA.mode=mode,mode);await a.click();await area.getByRole('alert').waitFor();assert.equal(downloads.length,1);assert.equal((await area.textContent())!.includes('비밀'),false);}
  assert.equal(await page.evaluate(()=>(window as any).__artifactDownloadQA.authLost),1);assert.equal(await page.evaluate(()=>(window as any).__artifactDownloadQA.unavailable.length),3);
  // 같은 A로 돌아와도 최초 A/B 응답은 새 요청으로 승격되지 않는다.
  await page.evaluate(()=>(window as any).__artifactDownloadQA.mode='DELAY');await a.click();await b.click();await a.click();await page.waitForFunction(()=>(window as any).__artifactDownloadQA.releases.length===3);
  await page.evaluate(()=>{const q=(window as any).__artifactDownloadQA;q.releases.shift()();q.releases.shift()();});await page.waitForFunction(()=>(window as any).__artifactDownloadQA.cancelled>=2);await task(page);assert.equal(downloads.length,1);
  const last=page.waitForEvent('download');await page.evaluate(()=>(window as any).__artifactDownloadQA.releases.shift()());await last;assert.equal(downloads.length,2);
  for(const change of ['session','client','transport','result','unmount']){
   await a.click();await page.waitForFunction(()=>(window as any).__artifactDownloadQA.releases.length===1);
   await page.evaluate(({change,f})=>{const q=(window as any).__artifactDownloadQA;if(change==='session'){q.session({...f.session,user:{id:'77777777-7777-4777-8777-777777777777'}});q.session(f.session);}if(change==='client')q.client();if(change==='transport')q.transport();if(change==='result'){q.result({...f.result,ref:{...f.result.ref,id:'88888888-8888-4888-8888-888888888888'}});q.result(f.result);}if(change==='unmount')q.show(false);}, {change,f});
   const before=await page.evaluate(()=>(window as any).__artifactDownloadQA.cancelled);await page.evaluate(()=>(window as any).__artifactDownloadQA.releases.shift()());await page.waitForFunction(before=>(window as any).__artifactDownloadQA.cancelled>before,before);await task(page);assert.equal(downloads.length,2);
   if(change==='unmount')await page.evaluate(()=>(window as any).__artifactDownloadQA.show(true));
  }
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  const calls=await page.evaluate(()=>(window as any).__artifactDownloadQA.calls);assert(calls.every((v:any)=>v.path.startsWith('/api/v1/projects/')&&v.path.includes('/files/')&&v.method==='GET'&&v.credentials==='same-origin'&&v.redirect==='error'&&v.cache==='no-store'&&v.accept==='application/octet-stream'));
 }finally{await context.close();}
});
