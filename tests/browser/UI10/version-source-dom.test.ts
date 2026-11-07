import assert from 'node:assert/strict';
import {test} from 'node:test';
import {resolve} from 'node:path';
import {build} from 'vite';
import {chromium} from '@playwright/test';
import {knowledgeVersionPair,comparisonProject as pid,comparisonUser as uid} from '../../unit/FN05/knowledge-version-comparison-fixture.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const qaRoot='D:/tmp/anvil-v3-fn05-version-source-dom-01';
test('보관 비교 두버전 출처 exact 조회·거절/불일치·닫기뒤 늦은응답 폐기',{timeout:60000},async()=>{
 assert.equal(process.env.ANVIL_FN05_VERSION_SOURCE_DOM_QA,'1');
 await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{outDir:resolve(qaRoot,'bundle'),emptyOutDir:false,minify:false,sourcemap:false,lib:{entry:resolve('tests/browser/UI10/version-source-dom-harness.tsx'),name:'VersionSourceQA',formats:['iife'],fileName:()=> 'version-source.js'}}});
 const pair=knowledgeVersionPair(),did='77777777-7777-4777-8777-777777777777',bodies=['앞 근거 <img src=x onerror="window.__unsafe=1">','정정 뒤 근거'],formRef={id:uid,version:1,contentHash:'b'.repeat(64)};
 const sources=[1,2].map(version=>({kind:'DOCUMENT_VERSION' as const,id:did,version,contentHash:String(version).repeat(64)}));
 pair.before.entry.sourceRefs=[sources[0]!];pair.before.ref.contentHash=contentHash(canonicalJson(pair.before.entry));pair.after.entry.sourceRefs=sources;pair.after.ref.contentHash=contentHash(canonicalJson(pair.after.entry));pair.after.supersedesRef={...pair.before.ref};pair.after.history[0]!.baseRef={...pair.before.ref};pair.after.history[0]!.sourceRefs=sources;
 const documents=sources.map((source,index)=>({id:did,version:source.version,contentHash:source.contentHash,title:'근거 v'+source.version,confirmed:false,formRef,stageNodeRef:null,content:{body:{artifactId:index===0?'88888888-8888-4888-8888-888888888888':'99999999-9999-4999-8999-999999999999',bytes:Buffer.byteLength(bodies[index]!),contentHash:contentHash(bodies[index]!),mediaType:'text/plain;charset=utf-8'},attachments:[],sections:[],sourceRefs:[]},validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[]}));
 const context=await chromium.launchPersistentContext(resolve(qaRoot,'browser'),{channel:'msedge',headless:true,serviceWorkers:'block',timeout:15000});
 try{
  const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(10000);const unexpected:string[]=[],errors:string[]=[];page.on('pageerror',error=>errors.push(error.name));
  await page.route('**/*',route=>route.request().url()==='https://anvil.invalid:3830/'?route.fulfill({contentType:'text/html',body:'<!doctype html><div id="root"></div>'}):(unexpected.push(route.request().url()),route.abort()));
  await page.goto('https://anvil.invalid:3830/');await page.evaluate(seed=>{(window as any).__versionSeed=seed;},{...pair,documents,bodies,projectId:pid,session:{user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)}});await page.addScriptTag({path:resolve(qaRoot,'bundle/version-source.js')});
  await page.getByRole('button',{name:'앞 버전과 보관 원문 비교',exact:true}).click();await page.getByLabel('제목 변경 전',{exact:true}).waitFor();
  const before=page.getByRole('region',{name:'앞 보관 버전의 고정 출처',exact:true}),after=page.getByRole('region',{name:'선택 보관 버전의 고정 출처',exact:true});
  await before.getByRole('button',{name:'문서 출처 1 원문 보기',exact:true}).click();await before.getByLabel('출처 문서 원문',{exact:true}).waitFor();assert.equal(await before.getByLabel('출처 문서 원문').textContent(),bodies[0]);
  await after.getByRole('button',{name:'문서 출처 2 원문 보기',exact:true}).click();await after.getByLabel('출처 문서 원문').waitFor();assert.equal(await after.getByLabel('출처 문서 원문').textContent(),bodies[1]);assert.equal(await page.locator('img').count(),0);
  const requests=await page.evaluate(()=>(window as any).__versionQA.calls);assert.deepEqual(requests,[`GET /api/v1/projects/${pid}/knowledge/${pair.before.ref.id}/versions/1`,`GET /api/v1/projects/${pid}/knowledge/${pair.before.ref.id}/versions/1`,`GET /api/v1/projects/${pid}/documents/${did}/versions/1`,`GET /api/v1/projects/${pid}/files/88888888-8888-4888-8888-888888888888`,`GET /api/v1/projects/${pid}/knowledge/${pair.after.ref.id}/versions/2`,`GET /api/v1/projects/${pid}/documents/${did}/versions/2`,`GET /api/v1/projects/${pid}/files/99999999-9999-4999-8999-999999999999`]);
  for(const [mode,code] of [['DENY','SOURCE_READ_DENIED'],['WRONG_HASH','KNOWLEDGE_SOURCE_CHANGED']]){
   await after.getByRole('button',{name:'출처 원문 닫기',exact:true}).click();await page.evaluate(mode=>{(window as any).__versionQA.mode=mode;},mode);await after.getByRole('button',{name:'문서 출처 2 원문 보기',exact:true}).click();await after.getByRole('alert').filter({hasText:code!}).waitFor();assert.equal(await after.getByLabel('출처 문서 원문').count(),0);
  }
  await after.getByRole('button',{name:'출처 원문 닫기',exact:true}).click();await page.evaluate(()=>{(window as any).__versionQA.mode='DELAY';(window as any).__versionQA.bodyHashSettled=0;});await after.getByRole('button',{name:'문서 출처 2 원문 보기',exact:true}).click();await page.waitForFunction(()=>(window as any).__versionQA.pending);
  const callsBeforeClose=await page.evaluate(()=>(window as any).__versionQA.calls.length);await page.getByRole('button',{name:'보관 버전 비교 닫기',exact:true}).click();await page.evaluate(()=>{(window as any).__versionQA.release();});await page.waitForFunction(()=>(window as any).__versionQA.consumed===1);await page.evaluate(()=>new Promise<void>(resolve=>setTimeout(resolve,0)));assert.equal(await page.getByRole('region',{name:'보관 지식 버전 비교',exact:true}).count(),0);assert.equal(await page.evaluate(()=>(window as any).__versionQA.calls.length),callsBeforeClose);assert.equal(await page.evaluate(()=>(window as any).__versionQA.bodyHashSettled),0);assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
