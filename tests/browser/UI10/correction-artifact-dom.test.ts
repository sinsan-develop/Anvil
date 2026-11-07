import assert from 'node:assert/strict';
import {test} from 'node:test';
import {resolve} from 'node:path';
import {build} from 'vite';
import {chromium} from '@playwright/test';
import {correctionFixture,session,pid} from '../../unit/FN05/knowledge-correction-source-fixture.ts';
import {contentHash} from '../../../contracts/canonical.ts';
const qaRoot='D:/tmp/anvil-v3-fn05-correction-artifact-dom-01';
test('정정 파일원문 확인→선택/해제·동결·CAS거절·metadata이탈 GET0',{timeout:60000},async()=>{
 assert.equal(process.env.ANVIL_FN05_CORRECTION_ARTIFACT_DOM_QA,'1');
 await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{outDir:resolve(qaRoot,'bundle'),emptyOutDir:false,minify:false,sourcemap:false,lib:{entry:resolve('tests/browser/UI10/correction-artifact-dom-harness.tsx'),name:'ArtifactCorrectionQA',formats:['iife'],fileName:()=> 'artifact.js'}}});
 const {buffer}=correctionFixture(),body='<img src=x onerror="window.__unsafe=1"> 보존파일',at='2026-10-22T00:00:00Z',artifact={artifactId:'77777777-7777-4777-8777-777777777777',bytes:Buffer.byteLength(body),contentHash:contentHash(body),mediaType:'text/plain;charset=utf-8'},candidate={id:'88888888-8888-4888-8888-888888888888',originalRef:artifact,intendedFormRef:null,parserVersion:'UTF8_IDENTITY_1',extractedContentRef:artifact,status:'READY',losses:[],issues:[],createdAt:at,selections:[]};
 const seed={buffer,session,body,candidate,list:{items:[{...candidate,integrity:'NOT_RECHECKED'}],hasMore:false,nextCursor:null,observedAt:at}};
 const context=await chromium.launchPersistentContext(resolve(qaRoot,'browser'),{channel:'msedge',headless:true,serviceWorkers:'block',timeout:15000});
 try{
  const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(10000);const unexpected:string[]=[],errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
  await page.route('**/*',route=>route.request().url()==='https://anvil.invalid:3830/'?route.fulfill({contentType:'text/html',body:'<!doctype html><div id="root"></div>'}):(unexpected.push(route.request().url()),route.abort()));
  await page.goto('https://anvil.invalid:3830/');await page.evaluate(seed=>{(window as any).__artifactSeed=seed;},seed);await page.addScriptTag({path:resolve(qaRoot,'bundle/artifact.js')});
  const select=page.getByRole('button',{name:'보관 파일 출처 선택',exact:true}),inspect=page.getByRole('button',{name:'출처 파일 1 원문 확인',exact:true}),attach=page.getByRole('button',{name:'이 파일을 지식 출처에 붙이기',exact:true}),remove=page.getByRole('button',{name:'파일 출처 1 선택 해제',exact:true});
  await select.click();await inspect.click();await page.getByLabel('붙일 파일 원문').waitFor();assert.equal(await page.locator('img').count(),0);await page.evaluate(()=>{(window as any).__artifactQA.reject=true;});await attach.click();await page.evaluate(()=>new Promise<void>(resolve=>setTimeout(resolve,0)));assert.equal(await remove.count(),0);assert.deepEqual(await page.evaluate(()=>(window as any).__artifactQA.buffer),buffer);
  await page.evaluate(()=>{(window as any).__artifactQA.reject=false;});await select.click();await inspect.click();await attach.click();await remove.waitFor();assert.deepEqual(await page.evaluate(()=>(window as any).__artifactQA.buffer.additionalArtifactSources),[{kind:'ARTIFACT',id:artifact.artifactId,contentHash:artifact.contentHash}]);
  assert.deepEqual(await page.evaluate(()=>(window as any).__artifactQA.buffer.target),buffer.target);assert.equal(await page.evaluate(()=>(window as any).__artifactQA.buffer.body),buffer.body);await remove.click();await page.waitForFunction(()=>(window as any).__artifactQA.buffer.additionalArtifactSources.length===0);
  await page.evaluate(()=>{(window as any).__artifactQA.mode='DENY';});await select.click();await inspect.click();await page.getByRole('alert').filter({hasText:'ARTIFACT_READ_DENIED'}).waitFor();assert.equal(await attach.count(),0);
  await page.evaluate(()=>{(window as any).__artifactQA.mode='DELAY';});await select.click();await inspect.click();await page.waitForFunction(()=>(window as any).__artifactQA.pending);const calls=await page.evaluate(()=>(window as any).__artifactQA.calls.length);
  await page.getByRole('button',{name:'파일 출처 선택 닫기',exact:true}).click();await page.evaluate(()=>{(window as any).__artifactQA.release();});await page.waitForFunction(()=>(window as any).__artifactQA.consumed===1);await page.evaluate(()=>new Promise<void>(resolve=>setTimeout(resolve,0)));assert.equal(await attach.count(),0);assert.equal(await page.evaluate(()=>(window as any).__artifactQA.calls.length),calls);
  await page.getByRole('button',{name:'QA 미확인 전환',exact:true}).click();assert.equal(await select.isDisabled(),true);assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  assert((await page.evaluate(()=>(window as any).__artifactQA.calls)).every((call:string)=>call.startsWith('GET /api/v1/projects/'+pid+'/')));
 }finally{await context.close();}
});
