import assert from 'node:assert/strict';
import {test} from 'node:test';
import {lstat,mkdir,realpath} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium,type Page} from '@playwright/test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const qaRoot=resolve('D:/Project/Anvil/.av3-data/ui10-scope-comparison-20261025-01');
const uid=(n:number)=>`a6f51090-0000-4000-8000-${String(n).padStart(12,'0')}`;
function fixture(){
 const pid=uid(1),at='2026-10-25T00:00:00Z',docRef={id:uid(9),version:1,contentHash:'a'.repeat(64)};
 const graph={nodes:[1,2].map(n=>({nodeId:`N${n}`,name:`당시 단계 ${n}`,purpose:`단계 원문 ${n} <script>globalThis.scopeUnsafe=true</script>`,kind:'HUMAN',position:{x:n,y:0},role:'USER',inputs:[],outputs:[],taskScope:{included:['설계'],excluded:[]},completionCriteria:['원문'],approvalBoundary:['사람'],mode:'CASE_BY_CASE',limitPolicyRef:null,recordRequirements:['기록']})),edges:[],entryNodeId:'N1',terminalNodeIds:['N2']};
 const snapshot={name:'고정 방법론',purpose:'원문',graph,sourceRef:{...docRef,contentHash:contentHash(canonicalJson(graph))}},applicationRef={id:uid(8),version:1,contentHash:contentHash(canonicalJson(snapshot))};
 const plans:Record<number,any>={},knowledge:Record<number,any>={},body='같은 지식 본문';
 for(const n of [1,2,3]){
  const task={taskCode:'FN05',type:'FUNCTION',title:`당시 업무 v${n}`,purpose:`업무 원문 ${n} <script>globalThis.scopeUnsafe=true</script>`,designRefs:[],screenRefs:[],ownerRole:'단계책임자',inputs:[],outputs:[],included:[],excluded:[],allowedFileRefs:[],startPrerequisites:[],acceptancePrerequisites:[],steps:[],testCases:[],acceptanceCriteria:[],evidenceRequirements:[],rollback:'새 정정',recoveryNotes:'원문 보존'};
  const planSnapshot={documentRef:docRef,designRef:docRef,screenReviewRefs:[],tasks:[task],dependencies:[],reason:'고정 업무',issues:[],relationalProjection:'STORED'},planRef={id:uid(3),version:n,contentHash:contentHash(canonicalJson(planSnapshot))};
  plans[n]={ref:planRef,status:'DRAFT',...planSnapshot,executionEvidence:'NOT_CONNECTED',observedAt:at};
  const entry={kind:'FACT',title:'같은 제목',reason:'같은 판단 이유',contentRef:{artifactId:uid(4),bytes:Buffer.byteLength(body),contentHash:contentHash(body),mediaType:'text/plain;charset=utf-8'},sourceRefs:[],relatedRefs:[],scope:{projectId:pid,stageRefs:[{applicationRef,nodeId:n===1?'N1':'N2'}],taskRefs:[{planRef,taskCode:'FN05'}]}};
  const ref={id:uid(2),version:n,contentHash:contentHash(canonicalJson(entry))},before=n===1?null:knowledge[n-1].ref;
  knowledge[n]={ref,entry,body,state:n===1?'SUPERSEDED':'PROPOSED',headVersion:n===1?2:n,supersedesRef:before,appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',agentDelivery:'NOT_CONNECTED',history:[{id:uid(10+n),kind:n===1?'PROPOSED':'CORRECTED',reason:n===1?entry.reason:'관련성만 정정',actorRef:{kind:'HUMAN',userId:uid(5)},recordedAt:at,...(before?{baseRef:before,sourceRefs:[]}:{} )}]};
 }
 return{pid,userA:uid(5),userB:uid(6),clientA:uid(7),clientB:uid(17),otherProject:uid(18),plans,knowledge,method:{projectId:pid,applicationRef,snapshot,observedAt:at,executionState:'NOT_CONNECTED'},project:{id:pid,name:'프로젝트',purpose:'기록',desiredOutcome:'보존',version:1,createdAt:at,updatedAt:at,currentMethodologyRef:applicationRef,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[],viewerPermissions:['READ_PROJECT'],participation:'OWNER',controlState:{status:'HELD',actorId:uid(5),clientId:uid(7),generation:1}}};
}
const comparison=(page:Page)=>page.getByRole('region',{name:'보관 지식 버전 비교',exact:true});
const side=(page:Page,which='앞')=>comparison(page).getByRole('region',{name:`${which} 보관 버전의 고정 관련성`,exact:true});
const original=(page:Page,which='앞')=>side(page,which).getByRole('region',{name:'지식 관련 고정 원문',exact:true});
interface State{requests:{path:string;method:string;client:number;jsonStarted:boolean;settled:boolean}[];authLost:number;unexpected:string[];buffer:unknown}
async function state(page:Page):Promise<State>{return page.evaluate(()=>{const q=(window as any).__scopeComparisonQA;return{requests:q.requests.map((r:any)=>({path:r.path,method:r.method,client:r.client,jsonStarted:r.jsonStarted,settled:r.settled})),authLost:q.authLost,unexpected:q.unexpected,buffer:q.buffer};});}
async function open(page:Page){await page.getByRole('button',{name:'앞 버전과 보관 원문 비교',exact:true}).click();await side(page).waitFor();}
async function readTask(page:Page,which='앞'){await side(page,which).getByRole('button',{name:'관련 업무 1 원문 확인',exact:true}).click();}

test('UI10 본문이 같은 보관 버전의 서로 다른 고정 관련성 실제 React DOM 비교',{timeout:120000},async t=>{
 assert.equal(process.env.ANVIL_UI10_SCOPE_COMPARISON_DOM_QA,'1','Main 명시 합성 QA만 허용');for(const name of ['TEMP','TMP'])assert.equal(resolve(process.env[name]??''),resolve(qaRoot,'temp'));
 const parent=dirname(qaRoot),info=await lstat(parent);assert(info.isDirectory()&&!info.isSymbolicLink());assert.equal((await realpath(parent)).toLowerCase(),parent.toLowerCase());
 try{await lstat(qaRoot);assert.fail('기존 root 재사용 금지');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}await mkdir(qaRoot);await mkdir(resolve(qaRoot,'temp'));
 const result=await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:false,sourcemap:false,lib:{entry:fileURLToPath(new URL('./knowledge-scope-comparison-dom-harness.tsx',import.meta.url)),name:'AnvilScopeComparisonQA',formats:['iife']}}});
 const outputs=Array.isArray(result)?result:[result];assert.equal(outputs.length,1);const output=outputs[0];assert(output&&typeof output==='object'&&'output'in output&&Array.isArray(output.output));assert.equal(output.output.length,1);const chunk=output.output[0];assert(chunk?.type==='chunk','단일 chunk/asset0');
 const context=await chromium.launchPersistentContext(resolve(qaRoot,'browser'),{channel:'msedge',headless:true,serviceWorkers:'block',timeout:15000,viewport:{width:1920,height:1080}});
 try{const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(3500);const errors:string[]=[],unknown:string[]=[];
  await page.route('**/*',r=>{if(r.request().url()==='https://anvil.invalid:3830/'&&r.request().method()==='GET')return r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><meta charset="utf-8"><div id="root"></div></html>'});unknown.push(r.request().url());return r.abort();});page.on('pageerror',e=>errors.push(e.message));
  const seed=fixture();await page.goto('https://anvil.invalid:3830/');await page.evaluate(v=>(window as any).__scopeComparisonSeed=v,seed);await page.addScriptTag({content:chunk.code});await page.getByRole('button',{name:'앞 버전과 보관 원문 비교',exact:true}).waitFor();
  await page.getByLabel('정정 지식 제목',{exact:true}).fill('미저장 제목');await page.getByLabel('정정 지식 원문',{exact:true}).fill('미저장 본문');await page.getByLabel('지식 정정 사유',{exact:true}).fill('미저장 사유');const buffer=(await state(page)).buffer;
  async function reset(){await page.getByRole('button',{name:'시험 초기화',exact:true}).click();await open(page);}
  async function pending(target:'knowledge'|'plan'|'method',status=200,which='앞',stage=false){
   const before=(await state(page)).requests.length,version=which==='앞'?1:2,base=`/api/v1/projects/${seed.pid}`;
   const targetPath=target==='knowledge'?`${base}/knowledge/${uid(2)}/versions/${version}`:target==='plan'?`${base}/work-plans/${uid(3)}/versions/${version}`:`${base}/methodology-application`;
   await page.evaluate(v=>(window as any).__scopeComparisonQA.pending=v,{target,status:status===200?undefined:status,delayJSON:true});
   if(stage)await side(page,which).getByRole('button',{name:'관련 단계 1 원문 확인',exact:true}).click();else await readTask(page,which);
   await page.waitForFunction(({before,targetPath})=>(window as any).__scopeComparisonQA.requests.some((r:any,i:number)=>i>=before&&r.path===targetPath&&r.jsonStarted&&!r.settled&&typeof r.release==='function'),{before,targetPath});
   const index=await page.evaluate(({before,targetPath})=>(window as any).__scopeComparisonQA.requests.findLastIndex((r:any,i:number)=>i>=before&&r.path===targetPath&&r.jsonStarted&&!r.settled&&typeof r.release==='function'),{before,targetPath});
   assert(index>=before,'지정 원문의 실제 JSON 대기 장벽만 이탈 전에 선택');return index;
  }
  async function release(index:number){await page.evaluate(i=>(window as any).__scopeComparisonQA.release(i),index);await page.waitForFunction(i=>(window as any).__scopeComparisonQA.requests[i]?.settled,index);await page.evaluate(()=>new Promise<void>(r=>setTimeout(r,0)));}
  await t.test('관련성만 다른 양쪽 요약·정확 당시 업무/단계를 명시 조회하고 안전하게 닫음',async()=>{
   assert.equal((await state(page)).requests.length,0);await open(page);assert.equal((await state(page)).requests.length,1);
   assert((await side(page).textContent())!.includes('단계 N1'));assert((await side(page,'선택').textContent())!.includes('단계 N2'));
   assert((await side(page).textContent())!.includes(seed.plans[1].ref.contentHash));assert((await side(page,'선택').textContent())!.includes(seed.plans[2].ref.contentHash));assert.equal(await comparison(page).getByLabel('본문 변경 상태').textContent(),'변경 없음');
   await readTask(page);await original(page).getByRole('heading',{name:'FN05 · 당시 업무 v1',exact:true}).waitFor();await readTask(page,'선택');await original(page,'선택').getByRole('heading',{name:'FN05 · 당시 업무 v2',exact:true}).waitFor();
   assert((await original(page).textContent())!.includes('업무 원문 1 <script>globalThis.scopeUnsafe=true</script>'));assert.equal(await page.evaluate(()=>(window as any).scopeUnsafe),undefined);
   const plans=(await state(page)).requests.filter(r=>r.path.includes('/work-plans/')).map(r=>r.path);assert.deepEqual(plans,[`/api/v1/projects/${seed.pid}/work-plans/${uid(3)}/versions/1`,`/api/v1/projects/${seed.pid}/work-plans/${uid(3)}/versions/2`]);
   await side(page).getByRole('button',{name:'관련 고정 원문 닫기',exact:true}).click();assert.equal(await original(page).count(),0);assert.equal(await original(page,'선택').count(),1);
   for(const which of ['앞','선택']){await side(page,which).getByRole('button',{name:'관련 단계 1 원문 확인',exact:true}).click();await original(page,which).getByRole('heading',{name:`고정 방법론 · ${which==='앞'?'N1 · 당시 단계 1':'N2 · 당시 단계 2'}`,exact:true}).waitFor();}
   await comparison(page).getByRole('button',{name:'보관 버전 비교 닫기',exact:true}).click();assert.equal(await comparison(page).count(),0);assert.deepEqual((await state(page)).buffer,buffer);
  });
  await t.test('지연 업무/단계·지식재검사 응답은 닫기·재조회 후 표시나 후속GET을 복원하지 않음',async()=>{
   for(const action of ['원문 닫기','비교 닫기','재조회','부모 닫기']){for(const target of ['knowledge','plan','method'] as const){await reset();const index=await pending(target,200,'앞',target==='method'),before=(await state(page)).requests.length;
    if(action==='원문 닫기')await side(page).getByRole('button',{name:'관련 고정 원문 닫기',exact:true}).click();else if(action==='비교 닫기')await comparison(page).getByRole('button',{name:'보관 버전 비교 닫기',exact:true}).click();else if(action==='재조회'){await page.getByRole('button',{name:'보관 버전 비교 다시 조회',exact:true}).click();await side(page).waitFor();}else await page.getByRole('button',{name:'비교 표시 전환',exact:true}).click();
    const count=(await state(page)).requests.length;await release(index);assert.equal(await page.getByRole('region',{name:'지식 관련 고정 원문',exact:true}).count(),0);assert.equal((await state(page)).requests.length,count);assert(count>=before);if(action==='부모 닫기')await page.getByRole('button',{name:'비교 표시 전환',exact:true}).click();
   }}
  });
  await t.test('주체·기기·client객체·프로젝트·선택 버전 ABA는 옛 원문과401을 폐기',async()=>{
   for(const kind of ['주체','기기','클라이언트 객체','프로젝트','선택 버전','선택 해시']){await reset();await readTask(page);await original(page).getByRole('heading',{name:'FN05 · 당시 업무 v1',exact:true}).waitFor();
    for(const name of ['B','A']){await page.getByRole('button',{name:`${kind} ${name}`,exact:true}).click();assert.equal(await page.getByRole('region',{name:'지식 관련 고정 원문',exact:true}).count(),0);}await open(page);const auth=(await state(page)).authLost,index=await pending('plan',401);
    for(const name of ['B','A'])await page.getByRole('button',{name:`${kind} ${name}`,exact:true}).click();await open(page);await readTask(page,'선택');await original(page,'선택').getByRole('heading',{name:'FN05 · 당시 업무 v2',exact:true}).waitFor();await release(index);assert.equal((await state(page)).authLost,auth);assert.equal(await original(page).count(),0);assert.equal(await original(page,'선택').count(),1);
   }
  });
  await t.test('현재401만 통지하고403/404는 원문 노출·다른 버전 대체 없이 실패',async()=>{
   for(const status of [401,403,404]){await reset();const before=await state(page);await page.evaluate(status=>(window as any).__scopeComparisonQA.pending={target:'plan',status},status);await readTask(page);await side(page).getByRole('alert').waitFor();assert.equal(await original(page).count(),0);assert(!(await side(page).textContent())!.includes('비공개 오류 원문'));assert.equal((await state(page)).authLost,before.authLost+(status===401?1:0));assert.equal((await state(page)).requests.slice(before.requests.length).filter(r=>r.path.includes('/work-plans/')).length,1);assert.deepEqual((await state(page)).buffer,buffer);}
  });
  assert.deepEqual((await state(page)).unexpected,[]);assert((await state(page)).requests.every(r=>r.method==='GET'));assert.deepEqual(unknown,[]);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
