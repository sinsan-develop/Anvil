import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',aid='33333333-3333-4333-8333-333333333333',kid='44444444-4444-4444-8444-444444444444',at='2026-10-25T00:00:00Z';
const graph={nodes:[{nodeId:'N1',name:'설계 검토',purpose:'고정 기준',kind:'HUMAN',position:{x:0,y:0},role:'USER',inputs:[],outputs:[],taskScope:{included:['검토'],excluded:[]},completionCriteria:['기록'],approvalBoundary:['사람 승인'],mode:'CASE_BY_CASE',limitPolicyRef:null,recordRequirements:['기록']}],edges:[],entryNodeId:'N1',terminalNodeIds:['N1']};
const sourceRef={id:uid,version:1,contentHash:contentHash(canonicalJson(graph))},snapshot={name:'고정 방법론',purpose:'관련성',graph,sourceRef},applicationRef={id:aid,version:2,contentHash:contentHash(canonicalJson(snapshot))};
const card={taskCode:'UI10',type:'SCREEN',title:'지식 화면',purpose:'저장·조회',designRefs:[],screenRefs:[],ownerRole:'담당',inputs:[],outputs:[],included:[],excluded:[],allowedFileRefs:[],startPrerequisites:[],acceptancePrerequisites:[],steps:[],testCases:[],acceptanceCriteria:[],evidenceRequirements:[],rollback:'별도 정정',recoveryNotes:'이력 보존'};
const planSnapshot={documentRef:sourceRef,designRef:sourceRef,screenReviewRefs:[],tasks:[card],dependencies:[],reason:'고정 업무',issues:[],relationalProjection:'STORED'},planRef={id:uid,version:3,contentHash:contentHash(canonicalJson(planSnapshot))};
async function setup(page:Page,deny=false,duplicate=false){
 const writes:any[]=[],unknown:string[]=[];let entry:any=null,ref:any=null,body='';
 const selectedSnapshot=duplicate?{...planSnapshot,tasks:[card,{...card,title:'중복 코드의 다른 업무'}],relationalProjection:'ISSUES_ONLY',issues:[{code:'DUPLICATE_TASK_CODE',location:'tasks[1]',message:'업무 코드 중복'}]}:planSnapshot,selectedRef={...planRef,contentHash:contentHash(canonicalJson(selectedSnapshot))};
 await page.route('https://localhost:3830/**',async r=>{const p=new URL(r.request().url()).pathname;if(p.startsWith('/api/'))return r.fallback();if(p!=='/'&&!/^\/assets\/[A-Za-z0-9_.-]+$/.test(p))return r.abort();const name=p==='/'?'index.html':p.slice(1);return r.fulfill({body:await readFile(new URL('../../../apps/web/dist/'+name,import.meta.url)),contentType:name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'application/javascript'});});
 await page.route('**/api/v1/**',r=>{unknown.push(r.request().method()+' '+new URL(r.request().url()).pathname);return r.fulfill({status:503,json:{code:'UNEXPECTED_QA_API'}});});
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:uid,displayName:'관련성 QA'},clientId:uid,csrfToken:'C'.repeat(43)}}));
 await page.route(`**/api/v1/projects/${pid}`,r=>r.fulfill({json:{id:pid,name:'고정 프로젝트',purpose:'사용자 소유',desiredOutcome:'보존',version:1,createdAt:at,updatedAt:at,currentMethodologyRef:applicationRef,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[],viewerPermissions:['READ_PROJECT'],participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:uid,generation:1}}}));
 await page.route(`**/api/v1/projects/${pid}/methodology-application`,r=>r.fulfill(deny?{status:403,json:{code:'PROJECT_OPERATION_DENIED'}}:{json:{projectId:pid,applicationRef,snapshot,observedAt:at,executionState:'NOT_CONNECTED'}}));
 await page.route(`**/api/v1/projects/${pid}/work-plans?*`,r=>r.fulfill({json:{items:[{ref:selectedRef,status:'DRAFT',title:'계획 초안',documentRef:sourceRef,designRef:sourceRef,issueCount:selectedSnapshot.issues.length,updatedAt:at,integrity:'NOT_RECHECKED'}],hasMore:false,nextCursor:null,observedAt:at}}));
 await page.route(`**/api/v1/projects/${pid}/work-plans/${uid}/versions/3`,r=>r.fulfill({json:{ref:selectedRef,status:'DRAFT',...selectedSnapshot,executionEvidence:'NOT_CONNECTED',observedAt:at}}));
 await page.route(`**/api/v1/projects/${pid}/conversations?*`,r=>r.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:at}}));
 await page.route(`**/api/v1/projects/${pid}/knowledge?*`,r=>r.fulfill({json:{items:ref?[{versionRef:ref,title:entry.title,kind:entry.kind,sourceRefs:entry.sourceRefs,reasonSnippet:entry.reason,state:'PROPOSED'}]:[],hasMore:false,nextCursor:null,searchScope:'TITLE_REASON',observedAt:at}}));
 function receipt(c:any,data:any,targetId:string,version:number|null){return{operationId:kid,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId,version,data,serverReceivedAt:at};}
 await page.route(`**/api/v1/projects/${pid}/files`,r=>{const c=JSON.parse(r.request().headers()['x-anvil-command']!);writes.push(c);body=r.request().postDataBuffer()!.toString('utf8');return r.fulfill({json:receipt(c,{status:'ARTIFACT_READY',artifactRef:{artifactId:aid,...c.payload}},aid,null)});});
 await page.route(`**/api/v1/projects/${pid}/commands`,r=>{const c=r.request().postDataJSON();writes.push(c);entry=c.payload.entry;ref={id:kid,version:1,contentHash:contentHash(canonicalJson(entry))};return r.fulfill({json:receipt(c,{status:'PROPOSED',entry,ref},kid,1)});});
 await page.route(`**/api/v1/projects/${pid}/knowledge/${kid}/versions/1`,r=>r.fulfill({json:{ref,entry,body,state:'PROPOSED',headVersion:1,supersedesRef:null,appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',agentDelivery:'NOT_CONNECTED',history:[{id:aid,kind:'PROPOSED',reason:entry.reason,actorRef:{kind:'HUMAN',userId:uid},recordedAt:at}]}}));
 await page.goto(`/#/projects/${pid}/knowledge`);await page.getByRole('button',{name:'새 지식 작성',exact:true}).click();await page.getByLabel('지식 제목',{exact:true}).fill('관련성 관측');await page.getByLabel('지식 원문',{exact:true}).fill('원문');await page.getByLabel('지식 작성 이유',{exact:true}).fill('고정 업무와 관련');return{writes,unknown};
}
test('고정 단계·업무 선택→초안 저장→정확 지식 조회에서 관련성만 보존한다',async({page})=>{
 const f=await setup(page);await page.getByRole('button',{name:'관련 단계 조회',exact:true}).click();await page.getByRole('button',{name:'단계 N1 관련성 추가',exact:true}).click();
 await page.getByRole('button',{name:'관련 업무 계획 조회',exact:true}).click();await page.getByRole('button',{name:'계획 1 업무 확인',exact:true}).click();await page.getByRole('button',{name:'업무 UI10 관련성 추가',exact:true}).click();
 await page.getByRole('button',{name:'지식 초안 저장',exact:true}).click();await expect(page.getByText('지식 초안 저장 확인 · v1 · 별도 확정 전',{exact:true})).toBeVisible();
 expect(f.writes[1].payload.entry.scope).toEqual({projectId:pid,stageRefs:[{applicationRef,nodeId:'N1'}],taskRefs:[{planRef,taskCode:'UI10'}]});
 await page.getByRole('button',{name:'작성 닫기',exact:true}).click();await page.getByRole('button',{name:'지식 원문 보기',exact:true}).click();await expect(page.getByLabel('보관 지식 관련성',{exact:true})).toContainText('UI10');await expect(page.getByLabel('보관 지식 관련성',{exact:true})).toContainText(applicationRef.contentHash);expect(f.writes).toHaveLength(2);expect(f.unknown).toEqual([]);
});
test('단계 조회 거절은 관련성 추가나 쓰기로 전환하지 않는다',async({page})=>{const f=await setup(page,true);await page.getByRole('button',{name:'관련 단계 조회',exact:true}).click();await expect(page.getByRole('alert')).toContainText('PROJECT_OPERATION_DENIED');await expect(page.getByRole('button',{name:'단계 N1 관련성 추가',exact:true})).toHaveCount(0);expect(f.writes).toEqual([]);expect(f.unknown).toEqual([]);});
test('같은 업무 코드가 둘인 정확 초안은 임의 업무를 골라 관련성으로 저장하지 않는다',async({page})=>{
 const f=await setup(page,false,true);await page.getByRole('button',{name:'관련 업무 계획 조회',exact:true}).click();await page.getByRole('button',{name:'계획 1 업무 확인',exact:true}).click();const buttons=page.getByRole('button',{name:'업무 UI10 관련성 추가',exact:true});await expect(buttons).toHaveCount(2);await expect(buttons.nth(0)).toBeDisabled();await expect(buttons.nth(1)).toBeDisabled();expect(f.writes).toEqual([]);expect(f.unknown).toEqual([]);
});
test('관련성 선택을 닫은 뒤 늦은 적용본 응답은 후보나 선택값을 되살리지 않는다',async({page})=>{
 const f=await setup(page);let release!:()=>void,requested!:()=>void;const gate=new Promise<void>(r=>release=r),began=new Promise<void>(r=>requested=r);
 await page.evaluate(()=>{
  const state={jsonDone:0,digestStarted:0,digestDone:0};(window as any).__scopeRead=state;
  const json=Response.prototype.json;Response.prototype.json=async function(this:Response){const value=await json.call(this);if(this.url.endsWith('/methodology-application'))state.jsonDone++;return value;};
  const digest=crypto.subtle.digest.bind(crypto.subtle);Object.defineProperty(crypto.subtle,'digest',{configurable:true,value:async(algorithm:AlgorithmIdentifier,data:BufferSource)=>{state.digestStarted++;try{return await digest(algorithm,data);}finally{state.digestDone++;}}});
 });
 await page.route(`**/api/v1/projects/${pid}/methodology-application`,async r=>{requested();await gate;await r.fulfill({json:{projectId:pid,applicationRef,snapshot,observedAt:at,executionState:'NOT_CONNECTED'}});});
 await page.getByRole('button',{name:'관련 단계 조회',exact:true}).click();await began;await page.getByRole('button',{name:'관련성 선택 닫기',exact:true}).click();
 const response=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/methodology-application'));release();await(await response).finished();await page.waitForFunction(()=>{const s=(window as any).__scopeRead;return s.jsonDone===1&&s.digestStarted===2&&s.digestDone===2;});await page.evaluate(()=>new Promise(r=>setTimeout(r,0)));await expect(page.getByRole('button',{name:'단계 N1 관련성 추가',exact:true})).toHaveCount(0);expect(f.writes).toEqual([]);expect(f.unknown).toEqual([]);
});
test('목적·헌법으로 변경하면 기존 관련성을 각각 해제한 후 프로젝트 공통으로 저장한다',async({page})=>{
 const f=await setup(page);await page.getByRole('button',{name:'관련 단계 조회',exact:true}).click();await page.getByRole('button',{name:'단계 N1 관련성 추가',exact:true}).click();await page.getByRole('button',{name:'관련 업무 계획 조회',exact:true}).click();await page.getByRole('button',{name:'계획 1 업무 확인',exact:true}).click();await page.getByRole('button',{name:'업무 UI10 관련성 추가',exact:true}).click();
 await page.getByLabel('지식 종류',{exact:true}).selectOption('CONSTITUTION');await expect(page.getByRole('button',{name:'관련 단계 조회',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'단계 N1 관련성 해제',exact:true}).click();await expect(page.getByRole('button',{name:'단계 N1 관련성 해제',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'업무 UI10 관련성 해제',exact:true}).click();await page.getByRole('button',{name:'지식 초안 저장',exact:true}).click();await expect(page.getByText('지식 초안 저장 확인 · v1 · 별도 확정 전',{exact:true})).toBeVisible();expect(f.writes[1].payload.entry.scope).toEqual({projectId:pid,stageRefs:[],taskRefs:[]});expect(f.unknown).toEqual([]);
});
