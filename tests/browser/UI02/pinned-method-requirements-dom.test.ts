import assert from 'node:assert/strict';
import {test} from 'node:test';
import {lstat,mkdir,realpath} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium,type Page} from '@playwright/test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {emptyDraft} from '../../../apps/web/src/features/project-create/api.ts';

// 일반 UI02 합성 DOM 시험이다. 실제 서비스·DB·사용자 자료·OS 실행 권한의 증거가 아니다.
// 새 전용 root만 생성하며 삭제/kill은 하지 않는다. Main이 원 process0/실경로를 확인해 정리한다.
const qaRoot=resolve('D:/Project/Anvil/.av3-data/ui02-pinned-dom-20261025-01');
const uid=(suffix:string)=>`a6f20390-0000-4000-8000-${suffix.padStart(12,'0')}`;
function fixture(){
 const graph=(side:string)=>({nodes:[{nodeId:'N1',name:`합성 ${side} 단계`,purpose:'준비 요구 확인',kind:'HUMAN' as const,position:{x:0,y:0},role:'USER' as const,mode:'CASE_BY_CASE' as const,inputs:[],outputs:[],taskScope:{included:[],excluded:[]},completionCriteria:[],approvalBoundary:[],limitPolicyRef:null,recordRequirements:[],requirements:{capabilities:[`합성 ${side} 능력`],environment:[`<img src=x onerror="window.__unsafe=1"> 합성 ${side} 환경`]}},{nodeId:'N2',name:'빈 요구',purpose:'빈 요구',kind:'HUMAN' as const,position:{x:1,y:0},role:'USER' as const,mode:'CASE_BY_CASE' as const,inputs:[],outputs:[],taskScope:{included:[],excluded:[]},completionCriteria:[],approvalBoundary:[],limitPolicyRef:null,recordRequirements:[],requirements:{capabilities:['   '],environment:[]}}],edges:[],entryNodeId:'N1',terminalNodeIds:['N2']});
 const value=(side:string,id:string)=>{const source=graph(side);return{ref:{id,version:2,contentHash:contentHash(canonicalJson(source))},name:`합성 ${side}`,purpose:'저장된 합성 요구',scope:'USER_COMMON',systemCode:null,graph:source,confirmation:null,validation:{validForConfirmation:false,issues:[]},runtimeReadiness:'PROJECT_BINDINGS_REQUIRED'};};
 const values={A:value('A',uid('1')),B:value('B',uid('2'))},userA=uid('3'),userB=uid('4'),clientA=uid('5'),clientB=uid('6'),draftA=uid('7'),draftB=uid('8');
 return{values,userA,userB,clientA,clientB,draftA,draftB,command:uid('9'),buffer:{...emptyDraft(),ownerUserId:userA,draftId:draftA,version:2,wizardStep:3,input:{...emptyDraft().input,name:'원래 프로젝트 이름',purpose:'원래 목적',desiredOutcome:'원래 기대 결과',methodologySelection:{kind:'CONFIRMED_REFERENCE' as const,versionRef:values.A.ref}}}};
}
async function absent(path:string){try{await lstat(path);assert.fail('기존 후보 root를 덮어쓰지 않습니다.');}catch(error:unknown){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
function singleBuildOutput(result:Awaited<ReturnType<typeof build>>){
 const outputs=Array.isArray(result)?result:[result];
 assert.equal(outputs.length,1,'메모리 빌드 output은 정확히 하나만 허용');
 const output=outputs[0];
 assert(output&&typeof output==='object'&&'output' in output&&Array.isArray(output.output),'단일 메모리 번들 반환형만 허용');
 return output;
}
async function settle(page:Page){await page.evaluate(()=>new Promise<void>(done=>setTimeout(done,0)));}
async function state(page:Page){return page.evaluate(()=>{const q=(window as any).__anvilPinnedQA,record=(r:any)=>({path:r.path,client:r.client,method:r.method,credentials:r.credentials,jsonStarted:r.jsonStarted,jsonConsumed:r.jsonConsumed,settled:r.settled});return{requests:q.requests.map(record),listRequests:q.listRequests.map(record),digests:q.digests.map((d:any)=>({pending:d.pending,settled:d.settled})),authLost:q.authLost,changes:q.changes,render:q.render,buffer:q.buffer,unexpected:q.unexpected};});}
const reader=(page:Page)=>page.getByRole('region',{name:'고정 방법론의 저장된 준비 요구',exact:true});
const load=(page:Page)=>page.getByRole('button',{name:'저장된 준비 요구 조회',exact:true}).click();
const close=(page:Page)=>page.getByRole('button',{name:'준비 요구 닫기',exact:true}).click();
async function hidden(page:Page){assert.equal(await reader(page).getByText('합성 A 능력',{exact:true}).count(),0);assert.equal(await reader(page).getByText('합성 B 능력',{exact:true}).count(),0);}
async function ready(page:Page,side='A'){await reader(page).getByText(`합성 ${side} 능력`,{exact:true}).waitFor();}
async function reset(page:Page){const before=(await state(page)).render;await page.getByRole('button',{name:'시험 초기화',exact:true}).click();await page.waitForFunction(render=>(window as any).__anvilPinnedQA.render>render,before);await hidden(page);}
async function switchContext(page:Page,kind:string,side:string){const before=(await state(page)).render;await page.getByRole('button',{name:`${kind} ${side}`,exact:true}).click();await page.waitForFunction(render=>(window as any).__anvilPinnedQA.render>render,before);await hidden(page);}
async function enqueue(page:Page,plan:{status?:number;delayJSON?:boolean}){await page.evaluate(value=>(window as any).__anvilPinnedQA.enqueue(value),plan);}
async function waitJSON(page:Page,index:number){await page.waitForFunction(i=>(window as any).__anvilPinnedQA.requests[i]?.jsonStarted,index);}
async function releaseJSON(page:Page,index:number){await page.evaluate(i=>(window as any).__anvilPinnedQA.releaseJSON(i),index);await page.waitForFunction(i=>(window as any).__anvilPinnedQA.requests[i]?.settled,index);await settle(page);}

test('UI02 실제 React DOM — 명시조회·닫기·문맥 ABA·늦은 JSON/hash·거절·입력 보존',{timeout:120000},async t=>{
 assert.equal(process.env.ANVIL_UI02_PINNED_DOM_QA,'1','Main의 명시 합성 QA 실행만 허용');
 assert.equal(resolve(process.env.TEMP??''),resolve(qaRoot,'temp'),'TEMP는 등록 후보 내부만 허용');
 assert.equal(resolve(process.env.TMP??''),resolve(qaRoot,'temp'),'TMP는 등록 후보 내부만 허용');
 const parent=dirname(qaRoot),parentInfo=await lstat(parent);
 assert(parentInfo.isDirectory()&&!parentInfo.isSymbolicLink(),'후보 부모는 실제 디렉터리여야 합니다.');
 assert.equal((await realpath(parent)).toLowerCase(),parent.toLowerCase(),'부모 링크/경로 치환을 거절합니다.');
 await absent(qaRoot);await mkdir(qaRoot);await mkdir(resolve(qaRoot,'temp'));
 const output=singleBuildOutput(await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:false,sourcemap:false,lib:{entry:fileURLToPath(new URL('./pinned-method-requirements-dom-harness.tsx',import.meta.url)),name:'AnvilPinnedQA',formats:['iife']}}}));
 const chunks=output.output.filter(item=>item.type==='chunk');assert.equal(chunks.length,1);assert.equal(output.output.length,1,'별도 파일/asset을 허용하지 않습니다.');
 const context=await chromium.launchPersistentContext(resolve(qaRoot,'browser'),{channel:'msedge',headless:true,serviceWorkers:'block',timeout:15000,viewport:{width:1280,height:900}});
 try{
  const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(7000);
  const unexpected:string[]=[],errors:string[]=[];
  await page.route('**/*',route=>{if(route.request().url()==='https://anvil.invalid:3830/'&&route.request().method()==='GET')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><meta charset="utf-8"><div id="root"></div></html>'});unexpected.push(`${route.request().method()} ${route.request().url()}`);return route.abort();});
  page.on('pageerror',error=>errors.push(error.name+': '+error.message));
  await page.goto('https://anvil.invalid:3830/');await page.evaluate(seed=>(window as any).__anvilPinnedSeed=seed,fixture());await page.addScriptTag({content:chunks[0]!.code});
  await reader(page).waitFor();
  await t.test('명시 GET·텍스트 표시·닫기/새 조회와 자동 요청0',async()=>{
   assert.equal((await state(page)).requests.length,0);assert.equal((await state(page)).listRequests.length,0);const before=(await state(page)).buffer;
   await load(page);await ready(page);
   assert((await reader(page).textContent())!.includes('<img src=x onerror="window.__unsafe=1"> 합성 A 환경'));
   assert.equal(await page.locator('img').count(),0);assert.equal(await page.evaluate(()=>(window as any).__unsafe),undefined);
   await reader(page).getByText('요구 능력 미작성',{exact:true}).waitFor();await reader(page).getByText('요구 환경 미작성',{exact:true}).waitFor();
   await close(page);await hidden(page);assert.equal((await state(page)).requests.length,1);
   await load(page);await ready(page);assert.equal((await state(page)).requests.length,2);assert.deepEqual((await state(page)).buffer,before);
  });
  const contexts=['선택','주체','클라이언트 객체','기기','초안'];
  await t.test('표시 중인 원문은 각 문맥 A→B→A에서 즉시 사라지고 자동 복원/재조회하지 않음',async()=>{
   for(const kind of contexts){await reset(page);await load(page);await ready(page);const calls=(await state(page)).requests.length;
    await switchContext(page,kind,'B');assert.equal((await state(page)).requests.length,calls);
    await load(page);await ready(page,kind==='선택'?'B':'A');assert.equal((await state(page)).requests.length,calls+1);
    await switchContext(page,kind,'A');assert.equal((await state(page)).requests.length,calls+1);
    await load(page);await ready(page);assert.equal((await state(page)).requests.length,calls+2);
   }
  });
  await t.test('각 문맥 ABA 뒤 늦은 JSON을 버리고 hash 시작0·새 조회만 수용',async()=>{
   for(const kind of contexts){await reset(page);const before=await state(page),index=before.requests.length;await enqueue(page,{delayJSON:true});await load(page);await waitJSON(page,index);
    await switchContext(page,kind,'B');await switchContext(page,kind,'A');await releaseJSON(page,index);await hidden(page);
    assert.equal((await state(page)).digests.length,before.digests.length);assert.equal((await state(page)).requests.length,index+1);
    await load(page);await ready(page);assert.equal((await state(page)).requests.length,index+2);
   }
  });
  await t.test('각 문맥 ABA 뒤 늦은 실제 SHA-256 결과도 원문으로 채택하지 않음',async()=>{
   for(const kind of contexts){await reset(page);const index=(await state(page)).digests.length;await page.evaluate(()=>(window as any).__anvilPinnedQA.holdDigest=true);await load(page);
    await page.waitForFunction(i=>(window as any).__anvilPinnedQA.digests[i]?.pending,index);await switchContext(page,kind,'B');await switchContext(page,kind,'A');
    await page.evaluate(i=>(window as any).__anvilPinnedQA.releaseDigest(i),index);await page.waitForFunction(i=>(window as any).__anvilPinnedQA.digests[i]?.settled,index);await settle(page);await hidden(page);
    await load(page);await ready(page);
   }
  });
  await t.test('닫기는 지연 JSON/hash를 폐기하고 재조회는 별도 시도',async()=>{
   for(const phase of ['JSON','HASH']){await reset(page);const before=await state(page);if(phase==='JSON')await enqueue(page,{delayJSON:true});else await page.evaluate(()=>(window as any).__anvilPinnedQA.holdDigest=true);
    await load(page);if(phase==='JSON')await waitJSON(page,before.requests.length);else await page.waitForFunction(i=>(window as any).__anvilPinnedQA.digests[i]?.pending,before.digests.length);
    await close(page);await hidden(page);if(phase==='JSON')await releaseJSON(page,before.requests.length);else{await page.evaluate(i=>(window as any).__anvilPinnedQA.releaseDigest(i),before.digests.length);await page.waitForFunction(i=>(window as any).__anvilPinnedQA.digests[i]?.settled,before.digests.length);await settle(page);}
    await hidden(page);assert.equal((await state(page)).requests.length,before.requests.length+1);await load(page);await ready(page);
   }
  });
  await t.test('제품의 3→4→3 실제 버튼 이동은 표시·지연 JSON/hash를 복원하지 않음',async()=>{
   for(const phase of ['READY','JSON','HASH']){await reset(page);const before=await state(page);if(phase==='JSON')await enqueue(page,{delayJSON:true});if(phase==='HASH')await page.evaluate(()=>(window as any).__anvilPinnedQA.holdDigest=true);
    await load(page);if(phase==='READY')await ready(page);else if(phase==='JSON')await waitJSON(page,before.requests.length);else await page.waitForFunction(i=>(window as any).__anvilPinnedQA.digests[i]?.pending,before.digests.length);
    await page.getByRole('button',{name:'생성 전 확인으로 다음',exact:true}).click();await page.getByRole('region',{name:'생성 전 입력 확인',exact:true}).waitFor();assert.equal(await reader(page).count(),0);
    await page.getByRole('button',{name:'총괄·환경으로 이전',exact:true}).click();await reader(page).waitFor();await hidden(page);
    if(phase==='JSON')await releaseJSON(page,before.requests.length);if(phase==='HASH'){await page.evaluate(i=>(window as any).__anvilPinnedQA.releaseDigest(i),before.digests.length);await page.waitForFunction(i=>(window as any).__anvilPinnedQA.digests[i]?.settled,before.digests.length);await settle(page);}
    await hidden(page);assert.equal((await state(page)).requests.length,before.requests.length+1);assert.deepEqual((await state(page)).buffer,before.buffer);await load(page);await ready(page);
   }
  });
  await t.test('현재401만 callback·과거401 무시·403/404 원문 비노출/자동 재시도0',async()=>{
   for(const kind of [...contexts,'닫기','단계']){await reset(page);const before=await state(page),index=before.requests.length;await enqueue(page,{status:401,delayJSON:true});await load(page);await waitJSON(page,index);
    if(kind==='닫기')await close(page);else if(kind==='단계'){await page.getByRole('button',{name:'생성 전 확인으로 다음',exact:true}).click();await page.getByRole('button',{name:'총괄·환경으로 이전',exact:true}).click();}else{await switchContext(page,kind,'B');await switchContext(page,kind,'A');}
    // 새 현재 시도를 먼저 표시한 다음 과거401을 풀어, 새 원문/오류 상태도
    // 과거 시도가 덮어쓸 수 없음을 실제 DOM과 callback 횟수로 확인한다.
    await load(page);await ready(page);await releaseJSON(page,index);await ready(page);
    assert.equal((await state(page)).authLost,before.authLost);assert.equal(await reader(page).getByRole('alert').count(),0);assert.equal((await state(page)).requests.length,index+2);
   }
   for(const status of [401,403,404]){await reset(page);const before=await state(page);await enqueue(page,{status});await load(page);await reader(page).getByRole('alert').waitFor();await settle(page);
    await hidden(page);assert(!(await reader(page).textContent())!.includes('비공개 오류 원문'));assert.equal((await state(page)).authLost,before.authLost+(status===401?1:0));assert.equal((await state(page)).requests.length,before.requests.length+1);
    await close(page);await load(page);await ready(page);
   }
  });
  await t.test('실제 입력·dirty·미확인 저장/생성 명령은 조회 성공/거절/닫기에도 보존',async()=>{
   for(const pending of ['없음','저장','생성']){await reset(page);
    const navigation=await state(page);
    await page.getByRole('button',{name:'방법론·자료로 이전',exact:true}).click();
    await page.waitForFunction(count=>{const q=(window as any).__anvilPinnedQA;return q.listRequests.length===count+1&&q.listRequests[count]?.settled;},navigation.listRequests.length);
    assert.equal((await state(page)).requests.length,navigation.requests.length,'2단계 목록 mount는 원문을 자동 조회하지 않음');
    await page.getByRole('button',{name:'목적·소스로 이전',exact:true}).click();await page.getByLabel('프로젝트 이름',{exact:true}).fill('미저장 입력 보존');
    // dirty 상태의 정상 전진은 잠겨 있다. 부모 시험 제어가 단계만 바꾸고,
    // 실제 입력 이벤트로 작성한 buffer/dirty/명령은 그대로 둔다.
    await page.getByRole('button',{name:'합성 준비 단계 열기',exact:true}).click();
    if(pending!=='없음')await page.getByRole('button',{name:pending==='저장'?'미확인 저장 명령 설정':'미확인 생성 명령 설정',exact:true}).click();
    const before=await state(page);assert.equal(before.buffer.dirty,true);assert.equal(before.buffer.input.name,'미저장 입력 보존');
    await load(page);await ready(page);await close(page);await enqueue(page,{status:403});await load(page);await reader(page).getByRole('alert').waitFor();await close(page);
    assert.deepEqual((await state(page)).buffer,before.buffer);assert.equal((await state(page)).changes,before.changes);assert.equal(await page.getByRole('button',{name:'저장 초안으로 프로젝트 생성',exact:true}).isDisabled(),true);
   }
  });
  const final=await state(page),seed=fixture();assert.equal(final.unexpected.length,0);assert.equal(final.requests.length>0,true);
  for(const request of final.requests){assert.equal(request.method,'GET');assert.equal(request.credentials,'same-origin');assert([seed.values.A,seed.values.B].some(value=>request.path===`/api/v1/methodologies/${value.ref.id}/versions/2`));assert.equal(request.settled,true);}
  assert.equal(final.listRequests.length,3,'입력 보존의 세 번 정상2단계 mount만 목록을 조회');
  for(const request of final.listRequests){assert.equal(request.path,'/api/v1/methodologies');assert.equal(request.method,'GET');assert.equal(request.credentials,'same-origin');assert.equal(request.jsonConsumed,true);assert.equal(request.settled,true);}
  assert(final.digests.every((digest:{settled:boolean})=>digest.settled));assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 }finally{
  // 원 context만 닫는다. 종료 불명일 때는 profile/root를 그대로 보존한다.
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{await Promise.race([context.close(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('원 브라우저 종료 미확인 · root 보존')),15000);})]);}finally{if(timer)clearTimeout(timer);}
 }
});
