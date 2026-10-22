import assert from 'node:assert/strict';
import {test} from 'node:test';
import {resolve} from 'node:path';
import {build} from 'vite';
import {chromium} from '@playwright/test';
import {resultFixture,hash} from '../../unit/UI05/result-view-fixture.ts';
import {contentHash} from '../../../contracts/canonical.ts';

// Manual opt-in Node test outside the default unit/spec runner. Only approved QA root.
const qaRoot='D:/tmp/anvil-v3-fn12-command-evidence-dom-01';
test('UI05 DOM 선택·원문 안전표시·닫기 뒤 늦은JSON 폐기·403 부모 회수',{timeout:60000},async()=>{
 assert.equal(process.env.ANVIL_UI05_EVIDENCE_DOM_QA,'1','수동 QA 실행만 허용');
 await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{outDir:resolve(qaRoot,'bundle'),emptyOutDir:false,minify:false,sourcemap:false,
  lib:{entry:resolve('tests/browser/UI05/command-evidence-dom-harness.tsx'),name:'AnvilEvidenceQA',formats:['iife'],fileName:()=> 'evidence-dom.js'}}});
 const f=resultFixture(),text='SYNTHETIC ONLY <img src=x onerror="window.__unsafe=1">\n',ref={id:'33333333-3333-4333-8333-333333333333',version:1,contentHash:contentHash(text)},outputRef={...ref,id:'44444444-4444-4444-8444-444444444444'},m:any=f.entry.snapshot.manifest;
 m.commandResults=[{profileRef:f.a,argv:['check'],cwdRef:f.a,hostRef:f.entry.snapshot.scope.executionRef,executionRef:f.entry.snapshot.scope.executionRef,startedAt:null,finishedAt:null,exitCode:null,outputRef,evidence:[{sourceKind:'WORKER_CLAIM',ref,contentHash:ref.contentHash,environmentRef:f.a,recordedAt:f.entry.snapshot.submittedAt}]}];
 m.artifactRefs=[ref,outputRef];f.entry.snapshot.manifestHash=hash(m);f.entry.ref.contentHash=hash(f.entry.snapshot);
 const file={projectId:f.pid,resultRef:f.entry.ref,artifactRef:ref,bytes:Buffer.byteLength(text),mediaType:'text/plain;charset=utf-8',text,sourceState:'REGISTERED_BYTES_ONLY',evidenceProvenanceVerified:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false,observedAt:'2026-10-22T00:00:00.000Z'};
 const context=await chromium.launchPersistentContext(resolve(qaRoot,'browser'),{channel:'msedge',headless:true,serviceWorkers:'block',timeout:15000});
 try{
  const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(10000);
  const unexpected:string[]=[];await page.route('**/*',route=>{
   if(route.request().url()==='https://anvil.invalid:3830/')return route.fulfill({contentType:'text/html',body:'<!doctype html><div id="root"></div>'});
   unexpected.push(route.request().url());return route.abort();
  });
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
  await page.goto('https://anvil.invalid:3830/');await page.evaluate(seed=>{(window as any).__anvilEvidenceSeed=seed;},{result:f.entry,file});
  await page.addScriptTag({path:resolve(qaRoot,'bundle/evidence-dom.js')});
  const button=page.getByRole('button',{name:'명령 1 근거 1 원문 대조',exact:true}),article=page.getByRole('article',{name:'선택 명령 근거 대조'});
  await button.waitFor();assert.equal(await page.evaluate(()=>(window as any).__anvilEvidenceQA.calls.length),0);
  await button.click();await article.waitFor();assert((await article.textContent())!.includes(text));assert.equal(await page.locator('img').count(),0);assert.equal(await page.evaluate(()=>(window as any).__unsafe),undefined);
  assert.deepEqual(await page.evaluate(()=>(window as any).__anvilEvidenceQA.calls),[{path:`/api/v1/projects/${f.pid}/results/${f.entry.ref.id}/artifacts/${ref.id}/text`,method:'GET',credentials:'same-origin'}]);
  await page.getByRole('button',{name:'명령 근거 닫기',exact:true}).click();assert.equal(await article.count(),0);
  await page.evaluate(()=>{(window as any).__anvilEvidenceQA.mode='DELAY';});await button.click();await page.waitForFunction(()=>(window as any).__anvilEvidenceQA.pending===true);
  await page.getByRole('button',{name:'명령 근거 닫기',exact:true}).click();await page.evaluate(()=>{(window as any).__anvilEvidenceQA.release();});
  await page.waitForFunction(()=>{const qa=(window as any).__anvilEvidenceQA;return qa.jsonConsumed===1&&qa.getSettled===2;});
  // After actual JSON/get settlement, cross a browser task boundary so reader/effect
  // continuations run too. This is not an arbitrary delay or a longer timeout.
  await page.evaluate(()=>new Promise<void>(resolve=>setTimeout(resolve,0)));assert.equal(await article.count(),0);
  await page.evaluate(()=>{(window as any).__anvilEvidenceQA.mode='DENY';});await button.click();await page.getByRole('alert').filter({hasText:'조회 권한 회수됨'}).waitFor();
  assert.equal(await article.count(),0);assert.deepEqual(await page.evaluate(()=>(window as any).__anvilEvidenceQA.unavailable),['ACCESS_DENIED']);
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 }finally{await context.close();}
});
