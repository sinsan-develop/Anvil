import assert from 'node:assert/strict';
import {test} from 'node:test';
import {resolve} from 'node:path';
import {build} from 'vite';
import {chromium} from '@playwright/test';
import {correctionFixture,session,documentSource,aid,uid} from '../../unit/FN05/knowledge-correction-source-fixture.ts';
import {contentHash} from '../../../contracts/canonical.ts';
const qaRoot='D:/tmp/anvil-v3-fn05-correction-source-dom-01';
test('정정 문서근거 DOM의 채택·해제와 CAS 거절 성공표시 차단',{timeout:60000},async()=>{
 assert.equal(process.env.ANVIL_FN05_CORRECTION_DOM_QA,'1');
 await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{outDir:resolve(qaRoot,'bundle'),emptyOutDir:false,minify:false,sourcemap:false,lib:{entry:resolve('tests/browser/UI10/correction-source-dom-harness.tsx'),name:'CorrectionQA',formats:['iife'],fileName:()=> 'correction.js'}}});
 const {buffer}=correctionFixture(),body='<img src=x onerror="window.__unsafe=1"> 고정 근거',formRef={id:uid,version:1,contentHash:'b'.repeat(64)},at='2026-10-22T00:00:00Z';
 const seed={buffer,session,body,list:{items:[{id:documentSource.id,title:'선택 근거',headVersion:2,confirmedVersion:null,updatedAt:at}],hasMore:false,nextCursor:null,observedAt:at},document:{id:documentSource.id,version:2,contentHash:documentSource.contentHash,title:'선택 근거',confirmed:false,formRef,stageNodeRef:null,content:{body:{artifactId:aid,bytes:Buffer.byteLength(body),contentHash:contentHash(body),mediaType:'text/plain;charset=utf-8'},attachments:[],sections:[],sourceRefs:[]},validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[]}};
 const context=await chromium.launchPersistentContext(resolve(qaRoot,'browser'),{channel:'msedge',headless:true,serviceWorkers:'block',timeout:15000});
 try{
  const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(10000);
  const unexpected:string[]=[],errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
  await page.route('**/*',route=>route.request().url()==='https://anvil.invalid:3830/'?route.fulfill({contentType:'text/html',body:'<!doctype html><div id="root"></div>'}):(unexpected.push(route.request().url()),route.abort()));
  await page.goto('https://anvil.invalid:3830/');await page.evaluate(seed=>{(window as any).__correctionSeed=seed;},seed);await page.addScriptTag({path:resolve(qaRoot,'bundle/correction.js')});
  await page.getByRole('button',{name:'문서 출처 선택',exact:true}).click();await page.getByRole('button',{name:'출처 문서 선택: 선택 근거',exact:true}).click();await page.getByRole('button',{name:'선택 버전 원문 확인',exact:true}).click();
  await page.getByLabel('붙일 문서 원문',{exact:true}).waitFor();assert.equal(await page.locator('img').count(),0);
  const attach=page.getByRole('button',{name:'이 버전을 지식 출처에 붙이기',exact:true}),success=page.getByText('선택 출처에 추가했습니다 · 지식 저장 전',{exact:true}),remove=page.getByRole('button',{name:'이번 문서 근거 선택 해제',exact:true});
  await page.evaluate(()=>{(window as any).__correctionQA.reject=true;});await attach.click();await page.evaluate(()=>new Promise<void>(resolve=>setTimeout(resolve,0)));
  assert.equal(await success.count(),0);assert.equal(await remove.count(),0);assert.deepEqual(await page.evaluate(()=>(window as any).__correctionQA.buffer),buffer);
  await page.evaluate(()=>{(window as any).__correctionQA.reject=false;});await attach.click();await success.waitFor();assert.equal(await remove.count(),1);
  assert.deepEqual(await page.evaluate(()=>(window as any).__correctionQA.buffer.additionalDocumentSources),[documentSource]);
  await remove.click();await page.waitForFunction(()=>(window as any).__correctionQA.buffer.additionalDocumentSources.length===0);assert.equal(await success.count(),0);
  assert.deepEqual(await page.evaluate(()=>(window as any).__correctionQA.buffer.target),buffer.target);assert.equal(await page.evaluate(()=>(window as any).__correctionQA.buffer.body),buffer.body);
  assert.equal(await page.evaluate(()=>(window as any).__correctionQA.calls.length),3);assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
