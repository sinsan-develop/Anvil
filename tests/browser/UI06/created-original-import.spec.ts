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

// round1은 기존 positive를 바꾸지 않고 실제 컴포넌트의 거절/객체 교체 경계를 검증한다.
test('UI02 created original round1 regression',{timeout:90000},async t=>{
 assert.equal(process.env.ANVIL_UI02_CREATED_ORIGINAL_QA,'1');
 assert.equal(resolve(process.env.ANVIL_UI02_CREATED_ORIGINAL_QA_ROOT??''),root);
 assert.equal(process.env.USERDOMAIN+'\\'+process.env.USERNAME,'SINSAN\\cyhuh');
 for(const name of ['TEMP','TMP'])assert.equal(resolve(process.env[name]??''),join(root,'temp'));
 const info=await lstat(root);assert(info.isDirectory()&&!info.isSymbolicLink());
 assert.equal((await realpath(root)).toLowerCase(),root.toLowerCase());
 const entries=(await readdir(root)).sort();
 // 전체 실행에서 먼저 끝난 기존 positive의 browser만 허용한다. round1 프로필은 항상 새것이다.
 assert(entries.join(',')==='temp'||entries.join(',')==='browser,temp');
 for(const entry of entries){const path=join(root,entry),stat=await lstat(path);assert(stat.isDirectory()&&!stat.isSymbolicLink());assert.equal((await realpath(path)).toLowerCase(),path.toLowerCase());}
 const project='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',draftId='33333333-3333-4333-8333-333333333333',artifact='44444444-4444-4444-8444-444444444444',candidateId='55555555-5555-4555-8555-555555555555';
 const text='\uFEFF# round1 생성 자료\r\n<script>window.SHOULD_NOT_RUN=1</script>\r\n',bytes=Buffer.from(text);
 const ref={artifactId:artifact,bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'text/markdown;charset=utf-8'},formRef={id:user,version:1,contentHash:'a'.repeat(64)};
 const input={name:'프로젝트',purpose:'목적',desiredOutcome:'결과',sourceMode:'EMPTY',methodologySelection:null,artifactRefs:[ref]};
 const records=[{commandId:user,expectedVersion:1,state:'FINALIZED',ref,artifactState:'READY',projectId:project}],session={user:{id:user},clientId:user,csrfToken:'C'.repeat(43)};
 const seed={project,session,records,draft:{ownerUserId:user,input,draftId,version:2,dirty:false,pendingCommand:null,uploadHistory:[],storedArtifacts:records},buffer:{ownerUserId:user,projectId:project,documentId:null,baseVersion:0,formRef,title:'내 제목',body:'기존 미저장 입력',reason:'내 이유',mediaType:'text/markdown;charset=utf-8',content:{attachments:[],sections:[],sourceRefs:[]},criteria:[],controlGeneration:3,dirty:true,pending:null,savedRef:null,failure:null}};
 const candidate={id:candidateId,originalRef:ref,extractedContentRef:ref,intendedFormRef:formRef,parserVersion:'UTF8_IDENTITY_1',status:'READY',losses:[],issues:[]};
 const bundled=await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:false,sourcemap:false,lib:{entry:resolve('tests/browser/UI06/created-original-import-harness.tsx'),name:'AnvilCreatedOriginalRound1QA',formats:['iife']}}});
 const output=Array.isArray(bundled)?bundled[0]:bundled;assert(output&&typeof output==='object'&&'output'in output);const chunk=output.output[0];assert(chunk?.type==='chunk');
 const context=await chromium.launchPersistentContext(join(root,'browser-round1'),{channel:'msedge',headless:true,serviceWorkers:'block',timeout:15000,viewport:{width:1920,height:1080}});
 try{
  for(const scenario of ['FIRST_409','FIRST_422','LOSS_THEN_409','SAME_VALUE_CLONE','DELAYED_OBJECT_ABA'] as const){
   await t.test(scenario,async()=>{
    const page=await context.newPage();page.setDefaultTimeout(6000);
    const errors:string[]=[],unexpected:string[]=[],failures:unknown[]=[];
    const calls:{path:string;method:string;body:string|null}[]=[];
    let mode='NORMAL',releaseFile:(()=>void)|undefined;
    page.on('pageerror',e=>errors.push(e.message));
    // 독립된 기대값을 누적하여 uncertain 실패가 닫기/보존 관찰을 가리지 않는다.
    const check=(label:string,work:()=>void)=>{try{work();}catch(cause){failures.push(new Error(label,{cause}));}};
    try{
     await page.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin==='https://anvil.invalid'&&url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><div id="root"></div>'});
      if(url.origin!=='https://anvil.invalid'||!url.pathname.startsWith('/api/v1/')){unexpected.push(request.url());return route.abort();}
      calls.push({path:url.pathname+url.search,method:request.method(),body:request.postData()});
      if(request.method()==='GET'&&url.pathname===`/api/v1/projects/${project}/documents`)return route.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:'2026-10-26T09:00:00Z'}});
      if(request.method()==='GET'&&url.pathname===`/api/v1/project-drafts/${draftId}`)return route.fulfill({json:{draftId,version:2,step:4,editable:false,consumedProjectId:project,input,storedArtifacts:records}});
      if(request.method()==='GET'&&url.pathname===`/api/v1/projects/${project}/files/${artifact}`){
       if(mode==='FILE_DELAY'){mode='NORMAL';await new Promise<void>(done=>{releaseFile=done;});}
       return route.fulfill({contentType:'application/octet-stream',body:bytes});
      }
      if(request.method()==='GET'&&url.pathname===`/api/v1/projects/${project}/imports/${candidateId}`)return route.fulfill({json:{...candidate,createdAt:'2026-10-26T09:00:00Z',selections:[]}});
      if(request.method()==='POST'&&url.pathname===`/api/v1/projects/${project}/commands`){
       const command=request.postDataJSON();
       if(command.operation!=='importDocument'){unexpected.push(command.operation);return route.fulfill({status:503,json:{code:'UNEXPECTED_QA_API'}});}
       if(mode==='LOSS'){mode='NORMAL';return route.abort('failed');}
       if(mode==='REJECT409'||mode==='REJECT422')return route.fulfill({status:mode==='REJECT409'?409:422,json:{code:mode==='REJECT409'?'CONTROL_GENERATION_CONFLICT':'INPUT_INVALID'}});
       return route.fulfill({json:{operationId:user,commandId:command.commandId,projectId:project,status:'APPLIED',targetId:artifact,version:null,serverReceivedAt:'2026-10-26T09:00:00Z',data:{status:'IMPORT_CANDIDATE',candidate}}});
      }
      unexpected.push(request.url());return route.fulfill({status:503,json:{code:'UNEXPECTED_QA_API'}});
     });
     await page.goto('https://anvil.invalid/#/projects/new');await page.evaluate(seed=>(window as any).__originalSeed=seed,seed);await page.addScriptTag({content:chunk.code});
     await page.getByRole('link',{name:'이 원문으로 문서 가져오기 준비',exact:true}).click();
     const panel=page.getByRole('region',{name:'생성 자료 문서 가져오기',exact:true}),read=panel.getByRole('button',{name:'기존 원문 다시 확인',exact:true});await read.waitFor();
     const original=panel.getByLabel('생성 자료 후보 원문',{exact:true}),close=panel.getByRole('button',{name:'후보 선택 닫기',exact:true});
     const value=()=>page.evaluate(()=>JSON.parse(JSON.stringify((window as any).__originalQA.buffer,(_k,v)=>v instanceof Uint8Array?Array.from(v):v)));
     const inputs=(buffer:any)=>{const{importState,importPreparationId,...kept}=buffer;return kept;};
     const posts=()=>calls.filter(call=>call.method==='POST');
     const idle=()=>page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent==='기존 원문 다시 확인'&&!button.disabled));
     const hidden=async(label:string)=>{
      const body=await panel.innerText(),originalCount=await original.count(),checkboxCount=await panel.getByRole('checkbox').count(),adoptCount=await panel.getByRole('button',{name:'이 후보로 초안 준비',exact:true}).count();
      check(label+' hash',()=>assert(!body.includes(ref.contentHash)));
      check(label+' body',()=>{assert.equal(originalCount,0);assert(!body.includes('# round1 생성 자료'));});
      check(label+' 동의',()=>assert.equal(checkboxCount,0));check(label+' 채택',()=>assert.equal(adoptCount,0));
     };
     const create=async()=>{await panel.getByRole('button',{name:'기존 원문으로 후보 만들기',exact:true}).click();};
     const retry=async()=>{await panel.getByRole('button',{name:'같은 가져오기 명령 결과 확인',exact:true}).click();};
     const prepare=async()=>{await read.click();await panel.getByRole('button',{name:'기존 원문으로 후보 만들기',exact:true}).waitFor();};
     await prepare();const prepared=await value();assert.equal(prepared.importState.upload,null);assert.equal(posts().length,0);
     if(scenario==='FIRST_409'||scenario==='FIRST_422'){
      mode=scenario==='FIRST_409'?'REJECT409':'REJECT422';await create();await panel.getByRole('alert').waitFor();await idle();
      const rejected=await value();check('최초 확정 거절은 결과 미확인이 아님',()=>assert.equal(rejected.importState.uncertain,false));
      check('최초 거절 원입력/pending 보존',()=>assert.deepEqual(inputs(rejected),inputs(prepared)));
      check('최초 거절 원 명령 보존',()=>assert.deepEqual(rejected.importState.record,prepared.importState.record));
      await hidden('거절 직후');await read.click();await panel.getByRole('button',{name:'같은 가져오기 명령 결과 확인',exact:true}).waitFor();await idle();
      const canClose=await close.count();check('보호 재조회 후 명시 닫기 가능',()=>assert.equal(canClose,1));
      if(canClose){await close.click();await page.waitForFunction(()=>(window as any).__originalQA.buffer.importState===null);const closed=await value();check('닫기 후 원입력/pending 보존',()=>assert.deepEqual(inputs(closed),inputs(prepared)));}
      check('거절/재조회/닫기의 자동 POST 없음',()=>assert.equal(posts().length,1));
     }else if(scenario==='LOSS_THEN_409'){
      mode='LOSS';await create();await panel.getByRole('alert').waitFor();await idle();const lost=await value();assert.equal(lost.importState.uncertain,true);
      await read.click();await panel.getByRole('button',{name:'같은 가져오기 명령 결과 확인',exact:true}).waitFor();mode='REJECT409';await retry();await panel.getByRole('alert').waitFor();await idle();
      const rejected=await value();check('과거 실제 LOSS의 불확실성 보존',()=>assert.equal(rejected.importState.uncertain,true));
      check('LOSS 뒤 거절 원입력/pending 보존',()=>assert.deepEqual(inputs(rejected),inputs(prepared)));
      check('LOSS 뒤 원 명령 보존',()=>assert.deepEqual(rejected.importState.record,lost.importState.record));
      await read.click();await panel.getByRole('button',{name:'같은 가져오기 명령 결과 확인',exact:true}).waitFor();check('LOSS 뒤 거절은 닫기 금지',()=>assert.equal(rejected.importState.recordCommandId,lost.importState.recordCommandId));
      const closeCount=await close.count();check('LOSS 뒤 보호 재조회도 닫기 금지',()=>assert.equal(closeCount,0));
      mode='NORMAL';await retry();await original.waitFor();const recovered=await value();
      check('같은 명령 정상 복구',()=>{assert.equal(recovered.importState.uncertain,false);assert.equal(recovered.importState.candidate.id,candidateId);assert.deepEqual(inputs(recovered),inputs(prepared));assert.equal(posts().length,3);assert.deepEqual(posts()[0],posts()[1]);assert.deepEqual(posts()[1],posts()[2]);});
     }else{
      await create();await original.waitFor();await panel.getByRole('checkbox').check();const ready=await value();const callCount=calls.length;
      if(scenario==='SAME_VALUE_CLONE'){
       const identities=await page.evaluate(()=>{const q=(window as any).__originalQA;q.round1Saved=q.buffer;const old=q.buffer;q.replace({...old});return{changed:q.buffer!==old,sameState:q.buffer.importState===old.importState};});
       assert.deepEqual(identities,{changed:true,sameState:true});await hidden('같은 값 clone 직후');check('clone 자동 요청 없음',()=>assert.equal(calls.length,callCount));
       check('clone 원입력/명령/bytes 보존',()=>assert.deepEqual(inputs(ready),inputs(prepared)));assert.deepEqual(await value(),ready);
       await page.evaluate(()=>{const q=(window as any).__originalQA;q.replace(q.round1Saved);});await hidden('원객체 복귀 직후');assert.deepEqual(await value(),ready);
      }else{
       mode='FILE_DELAY';await read.click();
       // native fetch가 실제 보호 파일 GET에 도달한 후에만 객체 ABA를 발생시킨다.
       const until=Date.now()+6000;while(!releaseFile&&Date.now()<until)await new Promise(done=>setTimeout(done,10));assert(releaseFile,'보호 파일 GET 지연 도달');
       const identities=await page.evaluate(()=>{const q=(window as any).__originalQA;const old=q.buffer;q.replace({...old});const cloneObserved=q.buffer!==old&&q.buffer.importState===old.importState;q.replace(old);return{cloneObserved,returned:q.buffer===old};});
       assert.deepEqual(identities,{cloneObserved:true,returned:true});
       const responsePromise=page.waitForResponse(response=>new URL(response.url()).pathname===`/api/v1/projects/${project}/files/${artifact}`);releaseFile();releaseFile=undefined;
       const response=await responsePromise;assert.equal(response.status(),200);await response.finished();await idle();
       await hidden('지연 GET 완료 후 ABA');assert.deepEqual(await value(),ready);
       check('ABA는 원 POST 추가 없음',()=>assert.equal(posts().length,1));
      }
      // 명시 새 보호 조회만 표시를 복원하며 과거 동의는 복원되지 않는다.
      await read.click();await original.waitFor();check('명시 재조회 원문',()=>assert.equal(posts().length,1));
      const acknowledged=await panel.getByRole('checkbox').isChecked();check('재조회 동의 해제',()=>assert.equal(acknowledged,false));assert.deepEqual(await value(),ready);
     }
     const final=await value();check('자동 채택/저장 없음',()=>{assert.equal(final.body,seed.buffer.body);assert.equal(final.pending,null);assert.equal(final.importCandidateRef,undefined);});
     const draft=await page.evaluate(()=>(window as any).__originalQA.draft);check('초안 원문/업로드 이력 보존',()=>assert.deepEqual(draft,seed.draft));
     for(const post of posts()){const command=JSON.parse(post.body!);check('importDocument 원 wire',()=>{assert.equal(post.path,`/api/v1/projects/${project}/commands`);assert.equal(command.operation,'importDocument');assert.deepEqual(command.payload,{fileRef:ref,intendedFormRef:formRef,sourceRefs:[]});assert.equal(command.commandId,prepared.importState.recordCommandId);});}
     check('upload API 없음',()=>assert.equal(calls.filter(call=>call.method==='POST'&&call.path.includes('/files')).length,0));
     check('예상 밖 요청 없음',()=>assert.deepEqual(unexpected,[]));check('브라우저 runtime 오류 없음',()=>assert.deepEqual(errors,[]));
     check('원문 스크립트 실행 없음',()=>assert.equal(final.body,seed.buffer.body));assert.equal(await page.evaluate(()=>(window as any).SHOULD_NOT_RUN),undefined);
     if(failures.length)throw new AggregateError(failures,scenario+' DOM 반례 실패 '+failures.length+'건');
    }finally{releaseFile?.();await page.close();}
   });
  }
 }finally{await context.close();}
});

test('UI02 created original round2 preparation cleanup',{timeout:90000},async t=>{
 assert.equal(process.env.ANVIL_UI02_CREATED_ORIGINAL_QA,'1');assert.equal(resolve(process.env.ANVIL_UI02_CREATED_ORIGINAL_QA_ROOT??''),root);
 assert.equal(process.env.USERDOMAIN+'\\'+process.env.USERNAME,'SINSAN\\cyhuh');for(const name of ['TEMP','TMP'])assert.equal(resolve(process.env[name]??''),join(root,'temp'));
 const info=await lstat(root);assert(info.isDirectory()&&!info.isSymbolicLink());assert.equal((await realpath(root)).toLowerCase(),root.toLowerCase());
 const entries=(await readdir(root)).sort();assert(entries.includes('temp'));assert(entries.every(entry=>['temp','browser','browser-round1'].includes(entry)));
 for(const entry of entries){const path=join(root,entry),stat=await lstat(path);assert(stat.isDirectory()&&!stat.isSymbolicLink());assert.equal((await realpath(path)).toLowerCase(),path.toLowerCase());}
 const project='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',draftId='33333333-3333-4333-8333-333333333333',artifact='44444444-4444-4444-8444-444444444444',otherPreparation='77777777-7777-4777-8777-777777777777';
 const text='\uFEFF# round2 보호 원문\r\n',bytes=Buffer.from(text),ref={artifactId:artifact,bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'text/markdown;charset=utf-8'},formRef={id:user,version:1,contentHash:'a'.repeat(64)};
 const input={name:'프로젝트',purpose:'목적',desiredOutcome:'결과',sourceMode:'EMPTY',methodologySelection:null,artifactRefs:[ref]},records=[{commandId:user,expectedVersion:1,state:'FINALIZED',ref,artifactState:'READY',projectId:project}],session={user:{id:user},clientId:user,csrfToken:'C'.repeat(43)};
 const seed={project,session,records,draft:{ownerUserId:user,input,draftId,version:2,dirty:false,pendingCommand:null,uploadHistory:[],storedArtifacts:records},buffer:{ownerUserId:user,projectId:project,documentId:null,baseVersion:0,formRef,title:'내 제목',body:'기존 미저장 입력',reason:'내 이유',mediaType:'text/markdown;charset=utf-8',content:{attachments:[],sections:[],sourceRefs:[]},criteria:[],controlGeneration:3,dirty:true,pending:null,savedRef:null,failure:null}};
 const bundled=await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:false,sourcemap:false,lib:{entry:resolve('tests/browser/UI06/created-original-import-harness.tsx'),name:'AnvilCreatedOriginalRound2QA',formats:['iife']}}});
 const output=Array.isArray(bundled)?bundled[0]:bundled;assert(output&&typeof output==='object'&&'output'in output);const chunk=output.output[0];assert(chunk?.type==='chunk');
 const context=await chromium.launchPersistentContext(join(root,'browser-round2'),{channel:'msedge',headless:true,serviceWorkers:'block',timeout:15000,viewport:{width:1920,height:1080}});
 try{
  for(const scenario of ['INITIAL_UNMOUNT','INITIAL_CSRF','INITIAL_SAME_VALUE_CLONE','NEW_PREPARATION_PRESERVED'] as const){
   await t.test(scenario,async()=>{
    const page=await context.newPage();page.setDefaultTimeout(6000);
    const errors:string[]=[],unexpected:string[]=[],failures:unknown[]=[];
    const calls:{path:string;method:string}[]=[];let delay=true,releaseDraft:(()=>void)|undefined;
    const check=(label:string,work:()=>void)=>{try{work();}catch(cause){failures.push(new Error(label,{cause}));}};
    page.on('pageerror',e=>errors.push(e.message));
    try{
     await page.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin==='https://anvil.invalid'&&url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><div id="root"></div>'});
      if(url.origin!=='https://anvil.invalid'||!url.pathname.startsWith('/api/v1/')){unexpected.push(request.url());return route.abort();}
      calls.push({path:url.pathname,method:request.method()});
      if(request.method()==='GET'&&url.pathname===`/api/v1/projects/${project}/documents`)return route.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:'2026-10-26T09:00:00Z'}});
      if(request.method()==='GET'&&url.pathname===`/api/v1/project-drafts/${draftId}`){
       if(delay){delay=false;await new Promise<void>(done=>{releaseDraft=done;});}
       return route.fulfill({json:{draftId,version:2,step:4,editable:false,consumedProjectId:project,input,storedArtifacts:records}});
      }
      if(request.method()==='GET'&&url.pathname===`/api/v1/projects/${project}/files/${artifact}`)return route.fulfill({contentType:'application/octet-stream',body:bytes});
      unexpected.push(request.url());return route.fulfill({status:503,json:{code:'UNEXPECTED_QA_API'}});
     });
     await page.goto('https://anvil.invalid/#/projects/new');await page.evaluate(seed=>(window as any).__originalSeed=seed,seed);await page.addScriptTag({content:chunk.code});
     await page.getByRole('link',{name:'이 원문으로 문서 가져오기 준비',exact:true}).click();
     const panel=page.getByRole('region',{name:'생성 자료 문서 가져오기',exact:true}),read=panel.getByRole('button',{name:'기존 원문 다시 확인',exact:true});await read.waitFor();
     const value=()=>page.evaluate(()=>JSON.parse(JSON.stringify((window as any).__originalQA.buffer,(_k,v)=>v instanceof Uint8Array?Array.from(v):v)));
     const inputs=(buffer:any)=>{const{importState,importPreparationId,...kept}=buffer;return kept;};
     assert.equal((await value()).importState,undefined);await read.click();
     const until=Date.now()+6000;while(!releaseDraft&&Date.now()<until)await new Promise(done=>setTimeout(done,10));assert(releaseDraft,'최초 보호 초안 GET 지연 도달');
     const preparing=await value();assert.equal(preparing.importState,undefined);assert.match(preparing.importPreparationId,/^[0-9a-f-]{36}$/);assert.notEqual(preparing.importPreparationId,otherPreparation);
     const identity=await page.evaluate(({scenario,otherPreparation})=>{
      const q=(window as any).__originalQA,old=q.buffer;
      if(scenario==='INITIAL_UNMOUNT')q.show(false);
      else if(scenario==='INITIAL_CSRF')q.session({...q.sessionValue,csrfToken:'R'.repeat(43)});
      else q.replace({...old,...(scenario==='NEW_PREPARATION_PRESERVED'?{importPreparationId:otherPreparation}:{})});
      return{sameState:q.buffer.importState===old.importState,changed:q.buffer!==old};
     },{scenario,otherPreparation});
     if(scenario==='INITIAL_UNMOUNT')assert.equal(await panel.count(),0);
     if(scenario==='INITIAL_SAME_VALUE_CLONE')assert.deepEqual(identity,{sameState:true,changed:true});
     const responsePromise=page.waitForResponse(response=>new URL(response.url()).pathname===`/api/v1/project-drafts/${draftId}`);releaseDraft();releaseDraft=undefined;
     const response=await responsePromise;assert.equal(response.status(),200);await response.finished();
     if(scenario==='NEW_PREPARATION_PRESERVED'){
      // 살아 있는 컴포넌트의 실제 finally가 busy를 내린 뒤 새 작업 잠금 보존을 확인한다.
      await panel.getByText('현재 원문과 권한 확인 중',{exact:true}).waitFor({state:'hidden'});
     }else{
      // 제한시간 내 정리되지 않아도 다음 보존/비노출 기대를 계속 관찰한다.
      await page.waitForFunction(()=>(window as any).__originalQA.buffer.importPreparationId===null,undefined,{timeout:6000}).catch(()=>{});
     }
     if(scenario==='INITIAL_UNMOUNT'){await page.evaluate(()=>(window as any).__originalQA.show(true));await read.waitFor();}
     const completed=await value();
     check('응답 종료 뒤 자기 준비 잠금만 정리',()=>assert.equal(completed.importPreparationId,scenario==='NEW_PREPARATION_PRESERVED'?otherPreparation:null));
     check('원입력/pending 보존',()=>assert.deepEqual(inputs(completed),inputs(preparing)));
     check('옛 응답은 가져오기 명령을 만들지 않음',()=>assert.equal(completed.importState,undefined));
     const visible=await panel.innerText(),bodyCount=await panel.getByLabel('생성 자료 후보 원문',{exact:true}).count(),ackCount=await panel.getByRole('checkbox').count();
     check('옛 metadata/본문/동의 비노출',()=>{assert(!visible.includes(ref.contentHash));assert(!visible.includes('# round2 보호 원문'));assert.equal(bodyCount,0);assert.equal(ackCount,0);});
     check('무효 응답 이후 파일 GET 없음',()=>assert.equal(calls.filter(call=>call.path===`/api/v1/projects/${project}/files/${artifact}`).length,0));
     const enabled=await read.isEnabled();check('자기 작업 정리 뒤 새 명시 조회 가능',()=>assert.equal(enabled,scenario!=='NEW_PREPARATION_PRESERVED'));
     if(scenario!=='NEW_PREPARATION_PRESERVED'&&enabled){
      const draftReads=calls.filter(call=>call.path===`/api/v1/project-drafts/${draftId}`).length;await read.click();await panel.getByRole('button',{name:'기존 원문으로 후보 만들기',exact:true}).waitFor();
      const fresh=await value();check('새 명시 조회는 현재 권한으로 원문 재확인',()=>{assert.equal(calls.filter(call=>call.path===`/api/v1/project-drafts/${draftId}`).length,draftReads+1);assert.equal(calls.filter(call=>call.path===`/api/v1/projects/${project}/files/${artifact}`).length,1);assert.equal(fresh.importPreparationId,null);assert.deepEqual(fresh.importState.record.payload.fileRef,ref);assert.deepEqual(inputs(fresh),inputs(preparing));});
     }
     check('후보 생성/업로드/저장 POST 없음',()=>assert.equal(calls.filter(call=>call.method==='POST').length,0));
     const draft=await page.evaluate(()=>(window as any).__originalQA.draft);check('원문/명령/이력 보존',()=>assert.deepEqual(draft,seed.draft));
     check('예상 밖 요청 없음',()=>assert.deepEqual(unexpected,[]));check('브라우저 runtime 오류 없음',()=>assert.deepEqual(errors,[]));
     if(failures.length)throw new AggregateError(failures,scenario+' 최초 준비 DOM 반례 실패 '+failures.length+'건');
    }finally{releaseDraft?.();await page.close();}
   });
  }
 }finally{await context.close();}
});
