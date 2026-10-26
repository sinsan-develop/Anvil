import assert from 'node:assert/strict';
import {test} from 'node:test';
import {lstat,realpath,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {build} from 'vite';
import {chromium} from '@playwright/test';
import {contentHash} from '../../../contracts/canonical.ts';
const root=resolve('D:/tmp/anvil-v3-stage-b/ui02-created-original-dom-20261026-01');
test('UI02 귀속 원문→UI06 후보 명시 생성/채택과 현재성·거절·동일 명령 보존',{timeout:90000},async()=>{
 assert.equal(process.env.ANVIL_UI02_CREATED_ORIGINAL_QA,'1');assert.equal(resolve(process.env.ANVIL_UI02_CREATED_ORIGINAL_QA_ROOT??''),root);assert.equal(process.env.USERDOMAIN+'\\'+process.env.USERNAME,'SINSAN\\cyhuh');for(const name of ['TEMP','TMP'])assert.equal(resolve(process.env[name]??''),join(root,'temp'));
 const info=await lstat(root);assert(info.isDirectory()&&!info.isSymbolicLink());assert.equal((await realpath(root)).toLowerCase(),root.toLowerCase());assert.deepEqual((await readdir(root)).sort(),['temp']);
 const project='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',draftId='33333333-3333-4333-8333-333333333333',artifact='44444444-4444-4444-8444-444444444444',candidateId='55555555-5555-4555-8555-555555555555',other='66666666-6666-4666-8666-666666666666';
 const text='\uFEFF# 생성 자료\r\n<script>window.SHOULD_NOT_RUN=1</script>\r\n',bytes=Buffer.from(text),ref={artifactId:artifact,bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'text/markdown;charset=utf-8'},formRef={id:user,version:1,contentHash:'a'.repeat(64)};
 const input={name:'프로젝트',purpose:'목적',desiredOutcome:'결과',sourceMode:'EMPTY',methodologySelection:null,artifactRefs:[ref]},records=[{commandId:user,expectedVersion:1,state:'FINALIZED',ref,artifactState:'READY',projectId:project}],session={user:{id:user},clientId:user,csrfToken:'C'.repeat(43)};
 const seed={project,session,records,draft:{ownerUserId:user,input,draftId,version:2,dirty:false,pendingCommand:null,uploadHistory:[],storedArtifacts:records},buffer:{ownerUserId:user,projectId:project,documentId:null,baseVersion:0,formRef,title:'내 제목',body:'기존 미저장 입력',reason:'내 이유',mediaType:'text/markdown;charset=utf-8',content:{attachments:[],sections:[],sourceRefs:[]},criteria:[],controlGeneration:3,dirty:true,pending:null,savedRef:null,failure:null}};
 const candidate={id:candidateId,originalRef:ref,extractedContentRef:ref,intendedFormRef:formRef,parserVersion:'UTF8_IDENTITY_1',status:'READY',losses:[],issues:[]};
 const bundled=await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:false,sourcemap:false,lib:{entry:resolve('tests/browser/UI06/created-original-import-harness.tsx'),name:'AnvilCreatedOriginalQA',formats:['iife']}}});const output=Array.isArray(bundled)?bundled[0]:bundled;assert(output&&typeof output==='object'&&'output'in output);const chunk=output.output[0];assert(chunk?.type==='chunk');
 const context=await chromium.launchPersistentContext(join(root,'browser'),{channel:'msedge',headless:true,serviceWorkers:'block',timeout:15000,viewport:{width:1920,height:1080}});
 try{
  const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(6000);const errors:string[]=[],unexpected:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());if(url.origin==='https://anvil.invalid'&&url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><div id="root"></div>'});
   if(url.origin!=='https://anvil.invalid'||!url.pathname.startsWith('/api/v1/')){unexpected.push(request.url());return route.abort();}
   const wire={path:url.pathname+url.search,method:request.method(),body:request.postData()},mode=await page.evaluate(wire=>{const q=(window as any).__originalQA;q.calls.push(wire);return q.mode;},wire);
   if(url.pathname===`/api/v1/projects/${project}/documents`)return route.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:'2026-10-26T09:00:00Z'}});
   if(url.pathname===`/api/v1/project-drafts/${draftId}`){
    if(mode.startsWith('DENY'))return route.fulfill({status:Number(mode.slice(4)),json:{code:'ACCESS_DENIED'}});
    if(mode==='DRAFT_DELAY')await page.evaluate(()=>{const q=(window as any).__originalQA;q.waiting=true;q.mode='NORMAL';return new Promise<void>(done=>q.release=()=>{q.waiting=false;done();});});
    return route.fulfill({json:{draftId,version:2,step:4,editable:false,consumedProjectId:project,input,storedArtifacts:records}});
   }
   if(url.pathname===`/api/v1/projects/${project}/files/${artifact}`){if(mode==='FILE_DELAY')await page.evaluate(()=>{const q=(window as any).__originalQA;q.waiting=true;q.mode='NORMAL';return new Promise<void>(done=>q.release=()=>{q.waiting=false;done();});});return route.fulfill({contentType:'application/octet-stream',body:bytes});}
   if(url.pathname===`/api/v1/projects/${project}/imports/${candidateId}`)return route.fulfill({json:{...candidate,createdAt:'2026-10-26T09:00:00Z',selections:[]}});
   if(url.pathname===`/api/v1/projects/${project}/commands`){const command=request.postDataJSON();assert.equal(command.operation,'importDocument');assert.deepEqual(command.payload,{fileRef:ref,intendedFormRef:formRef,sourceRefs:[]});if(mode==='LOSS'){await page.evaluate(()=>(window as any).__originalQA.mode='NORMAL');return route.abort('failed');}return route.fulfill({json:{operationId:user,commandId:command.commandId,projectId:project,status:'APPLIED',targetId:artifact,version:null,serverReceivedAt:'2026-10-26T09:00:00Z',data:{status:'IMPORT_CANDIDATE',candidate}}});}
   unexpected.push(request.url());return route.fulfill({status:503,json:{code:'UNEXPECTED_QA_API'}});
  });
  await page.goto('https://anvil.invalid/#/projects/new');await page.evaluate(seed=>(window as any).__originalSeed=seed,seed);await page.addScriptTag({content:chunk.code});
  await page.getByRole('link',{name:'이 원문으로 문서 가져오기 준비',exact:true}).click();
  const panel=page.getByRole('region',{name:'생성 자료 문서 가져오기',exact:true}),read=panel.getByRole('button',{name:'기존 원문 다시 확인',exact:true});await read.waitFor();
  const value=()=>page.evaluate(()=>JSON.parse(JSON.stringify((window as any).__originalQA.buffer,(_k,v)=>v instanceof Uint8Array?Array.from(v):v))),posts=()=>page.evaluate(()=>(window as any).__originalQA.calls.filter((c:any)=>c.method==='POST'));
  const hidden=async()=>assert(!(await panel.innerText()).includes(ref.contentHash),'보호 재조회 전 hash 비노출');const settle=()=>page.evaluate(()=>new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))));
  assert.equal((await posts()).length,0);await hidden();await read.click();await panel.getByRole('button',{name:'기존 원문으로 후보 만들기',exact:true}).waitFor();assert.equal((await value()).body,seed.buffer.body);assert.equal((await posts()).length,0);
  await page.evaluate(()=>(window as any).__originalQA.mode='LOSS');await panel.getByRole('button',{name:'기존 원문으로 후보 만들기',exact:true}).click();await panel.getByRole('alert').waitFor();await hidden();const lost=await value();assert.equal(lost.importState.uncertain,true);assert.equal(lost.importState.upload,null);assert.equal(lost.body,seed.buffer.body);
  await read.click();await panel.getByRole('button',{name:'같은 가져오기 명령 결과 확인',exact:true}).click();await panel.getByLabel('생성 자료 후보 원문',{exact:true}).waitFor();const commands=await posts();assert.equal(commands.length,2);assert.deepEqual(commands[0],commands[1]);assert.equal((await value()).body,seed.buffer.body);assert.equal(await page.evaluate(()=>(window as any).SHOULD_NOT_RUN),undefined);
  // 보호 조회 거절은 표시만 닫고 원 input/pending/import command를 보존한다.
  for(const status of [401,403,404]){const kept=await value();await page.evaluate(status=>(window as any).__originalQA.mode='DENY'+status,status);await read.click();await panel.getByRole('alert').waitFor();await hidden();assert.deepEqual(await value(),kept);await page.evaluate(()=>(window as any).__originalQA.mode='NORMAL');await read.click();await panel.getByLabel('생성 자료 후보 원문',{exact:true}).waitFor();}
  // remount, 같은 user/client CSRF 교체, ApiClient 교체는 오래된 표시를 복구하지 않는다.
  for(const change of ['remount','csrf','client']){const kept=await value();await page.evaluate(change=>{const q=(window as any).__originalQA;if(change==='remount'){q.show(false);q.show(true);}else if(change==='csrf')q.session({...q.sessionValue,csrfToken:'R'.repeat(43)});else q.client();},change);await settle();await hidden();assert.deepEqual(await value(),kept);await read.click();await panel.getByLabel('생성 자료 후보 원문',{exact:true}).waitFor();}
  // 지연 GET 중 source A→B→A, 사용자/기기·양식/세대·대상 교체 후 원입력 불변.
  for(const change of ['source','user','clientId','form','generation','target']){
   const kept=await value();await page.evaluate(()=>(window as any).__originalQA.mode='FILE_DELAY');await read.click();await page.waitForFunction(()=>(window as any).__originalQA.waiting);
   await page.evaluate(({change,other})=>{const q=(window as any).__originalQA;q.saved={buffer:q.buffer,session:q.sessionValue,hash:location.hash};if(change==='source')q.route(location.hash.replace('/artifacts/'+location.hash.split('/').at(-1),'/artifacts/'+other));else if(change==='user')q.session({...q.sessionValue,user:{id:other}});else if(change==='clientId')q.session({...q.sessionValue,clientId:other});else if(change==='form')q.replace({...q.buffer,formRef:{...q.buffer.formRef,version:2}});else if(change==='generation')q.replace({...q.buffer,controlGeneration:4});else q.replace({...q.buffer,documentId:other,baseVersion:1});},{change,other});
   await settle();await page.evaluate(()=>{const q=(window as any).__originalQA;q.route(q.saved.hash);q.session(q.saved.session);q.replace(q.saved.buffer);q.release();});await page.waitForFunction(()=>!(window as any).__originalQA.waiting);await settle();await hidden();assert.deepEqual(await value(),kept);await read.click();await panel.getByLabel('생성 자료 후보 원문',{exact:true}).waitFor();
  }
  await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'이 후보로 초안 준비',exact:true}).click();await page.waitForFunction(()=>(window as any).__originalQA.buffer.importCandidateRef!==undefined);const adopted=await value();assert.equal(adopted.body,text);assert.equal(adopted.title,seed.buffer.title);assert.equal(adopted.reason,seed.buffer.reason);assert.deepEqual(adopted.content.attachments,[ref]);assert.equal(adopted.pending,null);assert.equal((await posts()).length,2);assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 }finally{await context.close();}
});
