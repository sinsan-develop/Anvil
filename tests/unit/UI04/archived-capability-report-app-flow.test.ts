import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {seed,clientFixture} from './registered-preparation-options-fixture.ts';
import {newContextPreparation} from '../../../apps/web/src/features/workspace/context-api.ts';
import {buildContextManifest} from '../../../apps/server/modules/context/context-manifest.ts';
import {planContextText} from '../../../apps/server/modules/context/context-text-plan.ts';
import {definitionCapabilityReportSnapshot} from '../../../apps/server/modules/connections/definition-capability-report-input.ts';
/** 실제 ReactDOM의 요소/이벤트/effect를 실행하는 최소 메모리 DOM. 레이아웃·브라우저 보안·시각 검증은 아니다. */
class MemoryNode{
 nodeType:number;nodeName:string;tagName:string;localName:string;namespaceURI='http://www.w3.org/1999/xhtml';parentNode:MemoryNode|null=null;childNodes:MemoryNode[]=[];ownerDocument:any;attributes=new Map<string,string>();style:Record<string,unknown>={};listeners=new Map<string,Function[]>();value='';checked=false;disabled=false;data='';
 constructor(name:string,type=1,owner?:any){this.nodeType=type;this.nodeName=type===1?name.toUpperCase():name;this.tagName=this.nodeName;this.localName=name;this.ownerDocument=owner;}
 get options():MemoryNode[]{return this.childNodes.flatMap(n=>n.tagName==='OPTION'?[n]:n.options);}
 get firstChild():MemoryNode|null{return this.childNodes[0]??null;}get lastChild():MemoryNode|null{return this.childNodes.at(-1)??null;}get nextSibling():MemoryNode|null{const a=this.parentNode?.childNodes;return a?.[a.indexOf(this)+1]??null;}
 get nodeValue():string|null{return this.nodeType===3?this.data:null;}set nodeValue(v:string|null){if(this.nodeType===3)this.data=v??'';}
 get textContent():string{return this.nodeType===3?this.data:this.childNodes.map(n=>n.textContent).join('');}
 set textContent(v:string){if(this.nodeType===3){this.data=String(v);return;}for(const n of this.childNodes)n.parentNode=null;this.childNodes=[];if(v)this.appendChild(this.ownerDocument.createTextNode(String(v)));}
 appendChild(n:MemoryNode){if(n.parentNode)n.parentNode.removeChild(n);n.parentNode=this;this.childNodes.push(n);return n;}
 insertBefore(n:MemoryNode,b:MemoryNode){if(n.parentNode)n.parentNode.removeChild(n);n.parentNode=this;const i=this.childNodes.indexOf(b);assert(i>=0);this.childNodes.splice(i,0,n);return n;}
 removeChild(n:MemoryNode){const i=this.childNodes.indexOf(n);assert(i>=0);this.childNodes.splice(i,1);n.parentNode=null;return n;}
 setAttribute(k:string,v:unknown){this.attributes.set(k,String(v));if(k==='disabled')this.disabled=true;}removeAttribute(k:string){this.attributes.delete(k);if(k==='disabled')this.disabled=false;}getAttribute(k:string){return this.attributes.get(k)??null;}
 addEventListener(k:string,f:Function){this.listeners.set(k,[...(this.listeners.get(k)??[]),f]);}removeEventListener(k:string,f:Function){this.listeners.set(k,(this.listeners.get(k)??[]).filter(v=>v!==f));}
 contains(n:MemoryNode|null):boolean{return !!n&&(n===this||this.childNodes.some(c=>c.contains(n)));}focus(){this.ownerDocument.activeElement=this;}
 dispatchEvent(e:any){e.target=this;e.preventDefault??=()=>{e.defaultPrevented=true;};e.stopPropagation??=()=>{e.cancelBubble=true;};const chain:MemoryNode[]=[];for(let n:MemoryNode|null=this;n;n=n.parentNode)chain.push(n);for(const n of chain)for(const f of n.listeners.get(e.type)??[])f(e);return !e.defaultPrevented;}
}
const document:any=new MemoryNode('#document',9);document.ownerDocument=document;document.createElement=(n:string)=>new MemoryNode(n,1,document);document.createElementNS=(_ns:string,n:string)=>document.createElement(n);document.createTextNode=(s:string)=>{const n=new MemoryNode('#text',3,document);n.data=s;return n;};document.documentElement=document.createElement('html');document.body=document.createElement('body');document.documentElement.appendChild(document.body);document.activeElement=document.body;

const saved=new Map<string,PropertyDescriptor|undefined>(),events=new Map<string,Set<Function>>(),channels:MessageChannel[]=[];
let ui:any,currentTransport:typeof fetch;
const location={hash:'',protocol:'https:',origin:'https://anvil-synthetic.invalid'};
before(async()=>{
 const app=fileURLToPath(new URL('../../../apps/web/src/App.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:archived-report-app',name:'ArchivedReportApp',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'archived-report-app-memory',resolveId(id){if(id.endsWith('virtual:archived-report-app'))return '\0archived-report-app';},load(id){if(id==='\0archived-report-app')return `export * as React from 'react';export {createRoot} from 'react-dom/client';export {App} from ${JSON.stringify(app)};`;}}]});
 const Native=globalThis.MessageChannel;class Channel extends Native{constructor(){super();channels.push(this);}}
 const add=(k:string,f:Function)=>{let set=events.get(k);if(!set)events.set(k,set=new Set());set.add(f);},remove=(k:string,f:Function)=>events.get(k)?.delete(f),window={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener:add,removeEventListener:remove,getComputedStyle:()=>({}),location};document.defaultView=window;
 for(const[k,v]of Object.entries({window,document,location,addEventListener:add,removeEventListener:remove,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:Channel,confirm:()=>true,fetch:(...args:Parameters<typeof fetch>)=>currentTransport(...args)})){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((v:any)=>v.type==='chunk').code+';return ArchivedReportApp;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});
const H=(v:unknown)=>contentHash(canonicalJson(v));
function fixture(registered=false,intercept?:(path:string,init:RequestInit|undefined)=>Response|Promise<Response>|undefined){
 const f=seed(registered),definition={...f.confirmed.snapshot.definition,baselineRefs:[],recordingPolicyRef:null},task=definition.taskRef;
 const snapshot={definition,reason:'보관 임무',previousRef:null,basis:{...task,designRef:task.planRef,taskCardHash:'c'.repeat(64)},readinessIssues:[],status:'DRAFT',ready:false,executionAuthorized:false,dispatchPerformed:false};
 const draft={projectId:f.confirmed.projectId,ref:{...f.confirmed.ref,contentHash:H(snapshot)},snapshot,headVersion:1,sourceCurrentness:'NOT_RECHECKED',observedAt:f.at};
 f.confirmed.snapshot.definition=definition;f.confirmed.snapshot.draftRef=draft.ref;f.confirmed.ref.contentHash=H(f.confirmed.snapshot);
 f.binding.snapshot.assignmentRef=f.confirmed.ref;f.binding.ref.contentHash=H(f.binding.snapshot);f.state.assignmentRef=f.confirmed.ref;f.state.bindings=[f.binding];
 const cb=newContextPreparation(f.confirmed,f.session,1);cb.input.reason='원 맥락';const planned=planContextText(cb.input.slots.map(slot=>({itemId:slot.code,category:slot.code,required:true,sourceRef:null,reason:slot.reason,state:'MISSING',bodyRef:null,body:null})),cb.input.limits);
 const prepared:any={preparationInput:cb.input,assignmentRef:f.confirmed.ref,baselineRefs:[task.planRef],constitutionRef:null,budgetRef:f.budget.ref,bindings:cb.input.slots.map(slot=>({itemId:slot.code,selection:null,bodyRef:null,sourceState:'NOT_SELECTED'})),...planned,unverified:[]};
 f.context={...f.context,...buildContextManifest(f.context.ref.id,f.confirmed.projectId,prepared)};
 const decision={projectId:draft.projectId,draftRef:draft.ref,criteriaVersion:1,criteria:['PURPOSE_SCOPE','BASELINE_TASK','INPUT_OUTPUT','COMPLETION_VERIFICATION','BOUNDARIES','RECORD_RECOVERY'],reviews:[],hasMoreReviews:false,contentIssues:[],currentIssue:null,confirmedRef:f.confirmed.ref,latestReviewAccepted:false,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt:f.at};
 const project=(pid:string)=>({id:pid,name:'합성 프로젝트',purpose:'App 연결 검산',desiredOutcome:'보관 보고 명시 선택',version:1,createdAt:f.at,updatedAt:f.at,currentMethodologyRef:null,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[],viewerPermissions:['READ_PROJECT'],participation:'OWNER',controlState:{actorId:f.session.user.id,clientId:f.session.clientId,generation:1,status:'HELD'}});
 const q=clientFixture(f),calls:{path:string;method:string}[]=[],unexpected:string[]=[];
 // 합성 보관 보고를 기존 v2 생산 함수로 구성한다. 실측·실행 권위나 실제 서버 저장 증거가 아니다.
 const reportSnapshot=registered?definitionCapabilityReportSnapshot({...f.report.snapshot.claim,schemaVersion:2,tool:{product:f.connection.definition.toolProduct,version:f.connection.definition.toolVersion,adapterVersion:'등록 어댑터의 사람 주장'},reason:'UI11에만 표시할 원주장 본문'},draft.projectId,'af040058-1111-4111-8111-000000000093',{actorId:f.session.user.id,clientId:f.session.clientId},new Date(f.at)):null;
 const registeredReport=reportSnapshot?{projectId:draft.projectId,ref:{id:reportSnapshot.reportId,version:1,contentHash:H(reportSnapshot)},snapshot:reportSnapshot,currentnessIssues:[{code:'REGISTERED_DEFINITION_ONLY',target:null},{code:'HUMAN_CLAIM_UNVERIFIED',target:null}],effectiveForExecution:false,dispatchPerformed:false,checkedAt:f.at}:null;
 currentTransport=async(url,init)=>{
  const path=String(url),method=init?.method??'GET';calls.push({path,method});const overridden=intercept?.(path,init);if(overridden)return overridden;assert.equal(method,'GET','선택/준비만, 저장 명령 전송0');
  if(path==='/api/v1/session')return Response.json({...f.session,user:{...f.session.user,displayName:'합성 소유자'}});
  const pid=/^\/api\/v1\/projects\/([^/?]+)/.exec(path)?.[1];
  if(path===`/api/v1/projects/${pid}`)return Response.json(project(pid!));
  if(path.endsWith('/methodology-application'))return Response.json({projectId:pid,applicationRef:null,snapshot:null,observedAt:f.at,executionState:'NOT_CONNECTED'});
  const emptyViews:Record<string,string>={'connector-registrations?limit=50':'HOST_TRUST_REGISTRATIONS_ONLY','source-read-grants?limit=20':'SOURCE_READ_GRANTS','source-roots?limit=50':'SOURCE_ROOT_DECLARATIONS'};
  for(const [suffix,view]of Object.entries(emptyViews))if(path===`/api/v1/projects/${pid}/${suffix}`)return Response.json({view,items:[],hasMore:false,nextCursor:null,observedAt:f.at});
  if(path===`/api/v1/projects/${pid}/conversations?limit=50`)return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:f.at});
  if(path.includes('/connection-candidates?'))return Response.json({view:'CANDIDATES_ONLY',items:[],hasMore:false,nextCursor:null,observedAt:f.at});
  if(path.includes('/assignment-drafts?'))return Response.json({items:[{ref:draft.ref,status:'DRAFT',goal:definition.goal,taskRef:task,issueCount:0,updatedAt:f.at,ready:false,executionAuthorized:false}],hasMore:false,nextCursor:null,observedAt:f.at});
  if(path===`/api/v1/projects/${draft.projectId}/assignment-drafts/${draft.ref.id}/versions/1`)return Response.json(draft);
  if(path===`/api/v1/projects/${draft.projectId}/assignment-drafts/${draft.ref.id}/versions/1/decision`)return Response.json(decision);
  if(path===`/api/v1/projects/${draft.projectId}/assignments/${f.confirmed.ref.id}/versions/1`)return Response.json(f.confirmed);
  if(registeredReport&&path===`/api/v1/projects/${draft.projectId}/definition-capability-reports/${registeredReport.ref.id}/versions/1`)return Response.json(registeredReport);
  if(registered&&pid===draft.projectId&&['/connections/','/environments/'].some(part=>path.includes(part)))return q.client.transport(url,init);
  if(pid===draft.projectId&&['/permission-policy','/execution-preparation-state','/role-bindings/','/context?','/context/','/connection-candidates/','/capability-reports/','/limit-policies/'].some(part=>path.includes(part)))return q.client.transport(url,init);
  unexpected.push(path);return Response.json({code:'NOT_FOUND'},{status:404});
 };
 return{f,draft,calls,unexpected,registeredReport,preparation:q};
}
test('실제 App의 보관 보고 GET→명시 선택→hash 이동→UI04 원 준비 입력과 route/project 선택 수명',async()=>{
 const q=fixture(),pid=q.f.confirmed.projectId;location.hash=`#/projects/${pid}/connections`;
 const container=document.createElement('main');document.body.appendChild(container);const root=ui.createRoot(container);
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 const button=(name:string)=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===name);
 const settle=()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});
 const wait=async(check:()=>boolean)=>{for(let i=0;i<150&&!check();i++)await settle();assert(check(),container.textContent);};
 const click=async(name:string)=>{const b=button(name);assert(b,name);assert(!b.disabled);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0}));await settle();};
 const change=async(name:string,value:string|boolean)=>{const n=nodes().find(n=>n.getAttribute('aria-label')===name);assert(n,name);const key=Object.keys(n).find(k=>k.startsWith('__reactProps'));assert(key);await ui.React.act(async()=>(n as any)[key].onChange({target:{value,checked:value}}));await settle();};
 const go=async(hash:string,link=false)=>{if(link)assert(nodes().some(n=>n.tagName==='A'&&n.getAttribute('href')===hash),'실제 화면 링크');await ui.React.act(async()=>{location.hash=hash;for(const f of events.get('hashchange')??[])f();});await settle();};
 const openAssignment=async()=>{await wait(()=>!!button('임무 초안 목록 조회'));await click('임무 초안 목록 조회');await wait(()=>!!button('임무 버전 열기: 1'));await click('임무 버전 열기: 1');await wait(()=>!!button('확정 임무 원본 재조회'));await click('확정 임무 원본 재조회');await wait(()=>!!button('새 실행 의도 준비'));};
 const selectReport=async()=>{await wait(()=>!!button('고정 보고 조회'));await change('기존 보고 조회',JSON.stringify(q.f.report.ref));await click('고정 보고 조회');await wait(()=>!!button('이 보고를 실행 준비 입력으로 선택'));await click('이 보고를 실행 준비 입력으로 선택');};
 try{
  await ui.React.act(async()=>root.render(ui.React.createElement(ui.App)));await wait(()=>!!button('고정 보고 조회'));
  assert.equal(q.calls.filter(c=>c.path.includes('/capability-reports/')).length,0);await selectReport();assert.equal(q.calls.filter(c=>c.path.includes('/capability-reports/')).length,1);
  await go(`#/projects/${pid}/workspace`,true);await openAssignment();await click('새 실행 의도 준비');await wait(()=>!!button('이 사람보고 명시 선택'));await click('이 사람보고 명시 선택');
  await change('준비 예약binding',q.f.binding.ref.id);await change('준비 맥락',q.f.context.ref.id);await change('준비 범위 src/main.ts READ',true);await change('준비 mode','CONTEXT_REVIEW');await change('준비 이유','보관 원 보고로 준비');await click('의도 준비·입력 확인');await wait(()=>!!button('준비본 보관'));
  const payload=nodes().filter(n=>n.tagName==='PRE').map(n=>{try{return JSON.parse(n.textContent);}catch{return null;}}).find(v=>v?.capabilityRef);
  assert.deepEqual(payload.capabilityRef,q.f.report.ref);assert.deepEqual(payload.assignmentRef,q.f.confirmed.ref);assert(q.calls.filter(c=>c.path.includes('/capability-reports/')).length>=2,'원 준비에서 보호 보고 재검산');
  await go('#/no-such-screen');await go(`#/projects/${pid}/workspace`);await openAssignment();assert(!button('이 사람보고 명시 선택'),'다른 route 왕복으로 선택 부활0');
  await go(`#/projects/${pid}/connections`,true);await selectReport();await go(`#/projects/${q.f.otherProject}/connections`);await wait(()=>!!button('고정 보고 조회'));assert(!button('이 보고를 실행 준비 입력으로 선택'),'타 프로젝트로 보관 원문 누수0');
  await go(`#/projects/${pid}/workspace`);await openAssignment();assert(!button('이 사람보고 명시 선택'),'프로젝트 ABA 후 과거 선택 부활0');assert(button('준비본 보관'),'원 프로젝트의 준비 명령 자체는 보존');
  assert.equal(q.calls.filter(c=>c.method!=='GET').length,0);assert.deepEqual(q.unexpected,[]);
 }finally{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}
});


test('같은 실제 App에서 UI11 v2 보호 보고를 명시 선택해 UI04 등록 준비 capabilityRef에만 연결한다',{timeout:15000},async()=>{
 const q=fixture(true),pid=q.f.confirmed.projectId,report=q.registeredReport!;location.hash='#/projects/'+pid+'/connections';
 const container=document.createElement('main');document.body.appendChild(container);const root=ui.createRoot(container);
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 const button=(name:string,within=container)=>nodes(within).find(n=>n.tagName==='BUTTON'&&n.textContent===name);
 const settle=()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});
 const wait=async(check:()=>boolean)=>{for(let i=0;i<150&&!check();i++)await settle();assert(check(),container.textContent);};
 const click=async(name:string,within=container)=>{const b=button(name,within);assert(b,name);assert(!b.disabled,name);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0}));await settle();};
 const change=async(name:string,value:string|boolean,within=container)=>{const n=nodes(within).find(n=>n.getAttribute('aria-label')===name);assert(n,name);const key=Object.keys(n).find(k=>k.startsWith('__reactProps'));assert(key);await ui.React.act(async()=>(n as any)[key].onChange({target:{value,checked:value}}));await settle();};
 const reportPath='/api/v1/projects/'+pid+'/definition-capability-reports/'+report.ref.id+'/versions/1';
 try{
  await ui.React.act(async()=>root.render(ui.React.createElement(ui.App)));
  await wait(()=>nodes().some(n=>n.getAttribute('aria-label')==='등록 정의 사람 보고'));
  const panel=nodes().find(n=>n.getAttribute('aria-label')==='등록 정의 사람 보고')!;
  assert.equal(q.calls.filter(c=>c.path===reportPath).length,0);
  await change('기존 보고 조회',JSON.stringify(report.ref),panel);await click('고정 보고 조회',panel);
  await wait(()=>!!button('이 등록 정의 보고를 준비 입력으로 선택',panel));assert.equal(q.calls.filter(c=>c.path===reportPath).length,1);
  assert(panel.textContent.includes(report.snapshot.claim.reason));const before=q.calls.length;
  await click('이 등록 정의 보고를 준비 입력으로 선택',panel);assert.equal(q.calls.length,before,'refs-only 명시 선택은 추가 GET/POST 없음');
  const href='#/projects/'+pid+'/workspace';assert(nodes().some(n=>n.tagName==='A'&&n.getAttribute('href')===href),'기존 동일 프로젝트 UI04 링크');
  await ui.React.act(async()=>{location.hash=href;for(const listener of events.get('hashchange')??[])listener();});
  await wait(()=>!!button('임무 초안 목록 조회'));await click('임무 초안 목록 조회');await wait(()=>!!button('임무 버전 열기: 1'));await click('임무 버전 열기: 1');
  await wait(()=>!!button('확정 임무 원본 재조회'));await click('확정 임무 원본 재조회');await wait(()=>!!button('새 실행 의도 준비'));await click('새 실행 의도 준비');
  await wait(()=>!!button('이 등록 정의 보고를 보호 대조 후 선택')&&nodes().some(n=>n.getAttribute('aria-label')==='준비 예약binding'));
  assert(!button('이 사람보고 명시 선택'),'기존 v1 보고를 대신 공급하지 않음');assert(!container.textContent.includes(report.snapshot.claim.reason),'App·UI04에는 보고 원문을 보존하지 않음');
  await change('준비 예약binding',q.f.binding.ref.id);await change('준비 맥락',q.f.context.ref.id);await click('이 등록 정의 보고를 보호 대조 후 선택');
  await wait(()=>container.textContent.includes('고정한 등록 보고'));
  await change('준비 범위 src/main.ts READ',true);await change('준비 mode','CONTEXT_REVIEW');await change('준비 이유','등록 보고는 준비 참조로만 보관');await click('의도 준비·입력 확인');await wait(()=>!!button('준비본 보관'));
  const payload=nodes().filter(n=>n.tagName==='PRE').map(n=>{try{return JSON.parse(n.textContent);}catch{return null;}}).find(v=>v?.capabilityRef);
  assert(payload);assert.deepEqual(payload.capabilityRef,report.ref);assert.deepEqual(payload.assignmentRef,q.f.confirmed.ref);assert.deepEqual(payload.roleBindingRef,q.f.binding.ref);assert.deepEqual(payload.connectionRef,q.f.connection.ref);assert.deepEqual(payload.environmentRef,q.f.environment.ref);
  assert.equal(payload.connectionKind,'REGISTERED_DEFINITION');assert(!Object.hasOwn(payload,'definitionReportSelection'));
  assert.equal(q.calls.filter(c=>c.path===reportPath).length,3,'UI11 고정GET·UI04 명시 선택·준비 동결의 보호 재대조');
  assert.equal(q.calls.filter(c=>c.path.includes('/capability-reports/')).length,0,'v1 fallback 없음');assert.equal(q.calls.filter(c=>c.method!=='GET').length,0,'승인/저장/실행 POST 없음');assert.deepEqual(q.unexpected,[]);
  assert.equal(report.effectiveForExecution,false);assert.equal(report.dispatchPerformed,false);assert(report.snapshot.capabilities.every(v=>v.measurement.state==='UNVERIFIED'));
 }finally{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}
});

test('실제 App의 등록 정의 명시 선택은 기존 임무 상세를 거쳐 UI09 초안 대상만 재검산한다',{timeout:15000},async()=>{
 for(const scenario of ['GOOD','ROUTE','PROJECT','LATE200','LATE401','SOURCE_LATE200','SOURCE_LATE401']){
 let target:any,mode='READ',release=()=>{},waiting=false,posted:any=null;
 const q=fixture(true,(path,init)=>{
  if(init?.method==='POST'){posted=JSON.parse(String(init.body));assert.equal(posted.operation,'createTransferPreparationRecord');return Response.json({code:'CONNECTION_LOST'},{status:503});}
  if(target&&path.endsWith('/connections/'+target.ref.id+'/versions/1')){
   if(mode==='403')return Response.json({code:'ACCESS_DENIED'},{status:403});
   if(mode==='CROSS')return Response.json({...target,projectId:q.f.otherProject});
   if(mode==='LATE200'||mode==='LATE401'){
    const response=Response.json(mode==='LATE200'?target:{code:'AUTH_REQUIRED'},{status:mode==='LATE200'?200:401}),json=response.json.bind(response);
    response.json=async()=>{await new Promise<void>(resolve=>{waiting=true;release=resolve;});return json();};return response;
   }
   return Response.json(target);
  }
 }),pid=q.f.confirmed.projectId;
 const definition={...q.f.connection.definition,id:q.f.otherClient,label:'교체할 별도 등록 도구'},reference={id:definition.id,version:1,contentHash:H(definition)};
 target={...q.f.connection,ref:reference,definition};location.hash='#/projects/'+pid+'/connections';
 const container=document.createElement('main');document.body.appendChild(container);const root=ui.createRoot(container);
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))],button=(name:string)=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===name);
 const settle=()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});
 const wait=async(check:()=>boolean)=>{for(let i=0;i<150&&!check();i++)await settle();assert(check(),container.textContent);};
 const click=async(name:string)=>{const b=button(name);assert(b,name);assert(!b.disabled,name);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0}));await settle();};
 const change=async(name:string,value:string)=>{const n=nodes().find(n=>n.getAttribute('aria-label')===name);assert(n,name);const key=Object.keys(n).find(k=>k.startsWith('__reactProps'))!;await ui.React.act(async()=>(n as any)[key].onChange({target:{value}}));await settle();};
 const go=async(hash:string,link=false)=>{if(link)await wait(()=>nodes().some(n=>n.tagName==='A'&&n.getAttribute('href')===hash));await ui.React.act(async()=>{const oldURL=location.origin+location.hash;location.hash=hash;for(const listener of events.get('hashchange')??[])listener({oldURL,newURL:location.origin+hash});});await settle();};
 const select='이 등록 정의를 인계 준비 대상으로 선택',apply='선택한 등록 정의를 보호 대조 후 대상으로 선택';
 const targetPath='/api/v1/projects/'+pid+'/connections/'+reference.id+'/versions/1';
 const selectDefinition=async()=>{await wait(()=>!!button('알려진 연결 정의 조회'));await change('정의 조회 ID',reference.id);await change('정의 조회 버전','1');await change('정의 조회 hash',reference.contentHash);await click('알려진 연결 정의 조회');await wait(()=>!!button(select));const before=q.calls.length;await click(select);assert.equal(q.calls.length,before,'App에는 ref만 보관, 선택은 IO0');};
 const openTransfer=async()=>{
  await go('#/projects/'+pid+'/workspace',true);await wait(()=>!!button('임무 초안 목록 조회'));await click('임무 초안 목록 조회');await wait(()=>!!button('임무 버전 열기: 1'));await click('임무 버전 열기: 1');await wait(()=>!!button('확정 임무 원본 재조회'));await click('확정 임무 원본 재조회');
  const sessionHref='#/projects/'+pid+'/session/assignments/'+q.draft.ref.id+'/versions/1/'+q.draft.ref.contentHash;await go(sessionHref,true);await wait(()=>!!button('상세 원본 새로고침'));
  const transferHref=sessionHref.replace('/session/assignments/','/transfers/assignments/');await go(transferHref,true);await wait(()=>!!button('기존 인계 기록 조회'));await click('기존 인계 기록 조회');await wait(()=>!!button('새 준비기록 작성')||!!button('준비기록 원명령 준비'));if(button('새 준비기록 작성'))await click('새 준비기록 작성');
 };
 try{
  await ui.React.act(async()=>root.render(ui.React.createElement(ui.App)));
  if(scenario==='SOURCE_LATE200'||scenario==='SOURCE_LATE401'){
   await wait(()=>!!button('알려진 연결 정의 조회'));await change('정의 조회 ID',reference.id);await change('정의 조회 hash',reference.contentHash);mode=scenario==='SOURCE_LATE200'?'LATE200':'LATE401';await click('알려진 연결 정의 조회');await wait(()=>waiting);
   location.hash='#/no-such-screen';await ui.React.act(async()=>{release();await new Promise(r=>setImmediate(r));});await settle();assert(!button(select),'이탈 직전 늦은 원문을 선택하지 않음');assert(!container.textContent.includes('AUTH_REQUIRED'),'이탈한 원문401의 인증콜백0');assert.equal(q.calls.filter(c=>c.method==='POST').length,0);continue;
  }
  await selectDefinition();await openTransfer();
  assert(button(apply),'UI11의 exact 선택 참조가 동일 인증의 UI09까지 도착');assert(!container.textContent.includes(definition.label),'선택한 정의 원문은 App에 보존하지 않음');
  if(scenario==='ROUTE'){
   const node=button(apply)!,prop=Object.keys(node).find(k=>k.startsWith('__reactProps'))!,before=q.calls.length;
   location.hash='#/no-such-screen';await ui.React.act(async()=>(node as any)[prop].onClick());assert.equal(q.calls.length,before,'이탈 직전 옛 DOM 클릭은 보호GET0');continue;
  }
  if(scenario==='PROJECT'){
   await go('#/projects/'+q.f.otherProject+'/connections');await wait(()=>!!button('알려진 연결 정의 조회'));
   await go('#/projects/'+pid+'/transfers/assignments/'+q.draft.ref.id+'/versions/1/'+q.draft.ref.contentHash);await click('기존 인계 기록 조회');await wait(()=>!!button('준비기록 원명령 준비'));assert(!button(apply),'프로젝트 ABA는 옛 선택을 부활시키지 않음');assert.equal(q.calls.filter(c=>c.method==='POST').length,0);continue;
  }
  if(scenario==='LATE200'||scenario==='LATE401'){
   mode=scenario;const before=q.calls.length;await click(apply);await wait(()=>waiting);
   await go('#/projects/'+pid+'/workspace');await go('#/projects/'+pid+'/transfers/assignments/'+q.draft.ref.id+'/versions/1/'+q.draft.ref.contentHash);await click('기존 인계 기록 조회');await wait(()=>!!button('준비기록 원명령 준비'));
   await ui.React.act(async()=>{release();await new Promise(r=>setImmediate(r));});await settle();
   assert(!container.textContent.includes('대상 '+reference.id),'이탈·재진입 뒤 옛 대상 응답 적용0');assert(!container.textContent.includes('AUTH_REQUIRED'),'옛401이 현재 인증을 무효화하지 않음');assert(button(apply),'현재 같은 인증의 refs-only 선택은 재검산 가능');assert.equal(q.calls.slice(before).filter(c=>c.path===targetPath).length,1);assert.equal(q.calls.filter(c=>c.method==='POST').length,0);continue;
  }
  for(const failure of ['403','CROSS']){mode=failure;await click(apply);await wait(()=>/ACCESS_DENIED|CONNECTION_/.test(container.textContent));assert(!container.textContent.includes('대상 '+reference.id),'보호 재검산 실패는 원 초안 유지');}
  mode='READ';const before=q.calls.length;await click(apply);await wait(()=>container.textContent.includes('대상 '+reference.id));assert.equal(q.calls.slice(before).filter(c=>c.path===targetPath).length,1);
  await change('준비기록 이유','다른 등록 도구는 참조만 고정');await click('맥락 미수집 명시 선택');await click('역할 미선택 명시');await click('기존 결박 미수집 명시 선택');await click('준비기록 원명령 준비');await wait(()=>!!button('같은 준비기록 명령 저장·재확인'));
  assert.equal(q.calls.filter(c=>c.method==='POST').length,0,'별도 저장 클릭 전 POST0');assert(!button(apply),'잠긴 원명령은 대상 교체 불가');await click('같은 준비기록 명령 저장·재확인');await wait(()=>container.textContent.includes('결과 미확인'));
  assert.deepEqual(posted.payload.targetConnectionRef,reference);assert.deepEqual(posted.payload.assignmentRef,q.f.confirmed.ref);assert.equal(q.calls.filter(c=>c.method==='POST').length,1);
  const body=JSON.stringify(posted);await go('#/projects/'+q.f.otherProject+'/connections');await wait(()=>!!button('알려진 연결 정의 조회'));await go('#/projects/'+pid+'/transfers/assignments/'+q.draft.ref.id+'/versions/1/'+q.draft.ref.contentHash);await click('기존 인계 기록 조회');await wait(()=>container.textContent.includes('결과 미확인'));assert(!button(apply));assert.equal(JSON.stringify(posted),body,'UNKNOWN 원명령 보존');assert.equal(q.calls.filter(c=>c.method==='POST').length,1);
  assert.deepEqual(q.unexpected,[]);
 }finally{release();await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}
 }
});

for(const arrival of ['chat','steps','requestLost'] as const)test('실제 mobile App 준비→정확 승인→원 대화 준비 복귀 · '+arrival,{timeout:15000},async()=>{
 let oracle:ReturnType<typeof clientFixture>|undefined,lose=arrival==='requestLost';
 const posts:{body:string;idempotency:string|null}[]=[];
 const q=fixture(false,(path,init)=>{
  if(init?.method==='POST'){
   posts.push({body:String(init.body),idempotency:new Headers(init.headers).get('Idempotency-Key')});
   const response=oracle!.client.transport(path,init);
   if(lose){lose=false;return Promise.resolve(response).then(()=>{throw new TypeError('합성 응답 유실');});}
   return response;
  }
  if(path.includes('/approvals/'))return oracle!.client.transport(path,init);
  if(path.endsWith('/approvals?limit=50'))return Response.json({projectId:q.f.confirmed.projectId,items:[],hasMore:false,nextCursor:null,observedAt:q.f.at});
 });
 oracle=q.preparation;oracle.setPolicy('REQUIRE_APPROVAL');
 const pid=q.f.confirmed.projectId;location.hash='#/projects/'+pid+'/connections';
 const container=document.createElement('main');document.body.appendChild(container);const root=ui.createRoot(container);
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 const button=(text:string)=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===text);
 const settle=()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});
 const wait=async(check:()=>boolean)=>{const end=Date.now()+4000;while(!check()&&Date.now()<end)await settle();assert(check(),container.textContent);};
 const click=async(n:MemoryNode)=>{assert(n);assert(!n.disabled);const e:any={type:'click',button:0};await ui.React.act(async()=>n.dispatchEvent(e));if(n.tagName==='A'&&!e.defaultPrevented)await go(n.getAttribute('href')!);await settle();};
 const press=async(text:string)=>{const n=button(text);assert(n,text);await click(n);};
 const change=async(label:string,value:string|boolean)=>{const n=nodes().find(n=>n.getAttribute('aria-label')===label);assert(n,label);const key=Object.keys(n).find(k=>k.startsWith('__reactProps'));assert(key);await ui.React.act(async()=>(n as any)[key].onChange({target:{value,checked:value}}));await settle();};
 const go=async(hash:string)=>{await ui.React.act(async()=>{const oldURL=location.origin+location.hash;location.hash=hash;for(const fn of events.get('hashchange')??[])fn({oldURL,newURL:location.origin+hash});});await settle();};
 const open=async()=>{await wait(()=>!!button('임무 초안 목록 조회'));await press('임무 초안 목록 조회');await wait(()=>!!button('임무 버전 열기: 1'));await press('임무 버전 열기: 1');await wait(()=>!!button('확정 임무 원본 재조회'));await press('확정 임무 원본 재조회');await wait(()=>!!button('새 실행 의도 준비'));};
 const link=(text:string)=>nodes().find(n=>n.tagName==='A'&&n.textContent===text);
 try{
  await ui.React.act(async()=>root.render(ui.React.createElement(ui.App)));await wait(()=>!!button('고정 보고 조회'));
  await change('기존 보고 조회',JSON.stringify(q.f.report.ref));await press('고정 보고 조회');await wait(()=>!!button('이 보고를 실행 준비 입력으로 선택'));await press('이 보고를 실행 준비 입력으로 선택');
  await go('#/projects/'+pid+'/mobile');await open();await press('새 실행 의도 준비');await wait(()=>!!button('이 사람보고 명시 선택'));await press('이 사람보고 명시 선택');
  await change('준비 예약binding',q.f.binding.ref.id);await change('준비 맥락',q.f.context.ref.id);await change('준비 범위 src/main.ts READ',true);await change('준비 mode','CONTEXT_REVIEW');await change('준비 이유','모바일에서 보관한 동일 준비');await press('의도 준비·입력 확인');await wait(()=>!!button('준비본 보관 승인 요청 준비'));
  await press('준비본 보관 승인 요청 준비');await wait(()=>!!button('준비 승인 요청 명시 보관'));
  await change('준비 승인 이유','원 모바일 준비 보관만');for(const k of ['data','security','cost','interruption','unverified'])await change('준비 승인 위험 '+k,'실측·실행 미검증');await change('준비 승인 복구방법','원 자료 유지');await change('준비 승인 복구한계','실행 허가 아님');await change('준비 승인 기한',new Date(Date.now()+1800000).toISOString());
  assert.equal(posts.length,0);await press('준비 승인 요청 명시 보관');
  if(arrival==='requestLost'){
   await wait(()=>!!button('같은 준비 승인 요청 재확인'));assert.equal(link('UI08에서 별도 결정'),undefined);assert.equal(posts.length,1);
   await press('같은 준비 승인 요청 재확인');await wait(()=>!!link('UI08에서 별도 결정'));assert.deepEqual(posts[1],posts[0],'유실 재확인은 같은 JSON·멱등키');
  }else await wait(()=>!!link('UI08에서 별도 결정'));
  const approval=link('UI08에서 별도 결정')!,href='#/projects/'+pid+'/mobile/approvals/requests/'+q.f.requestId;
  assert.equal(approval.getAttribute('href'),href);const original=JSON.parse(posts[0]!.body).payload.candidatePayload;
  await click(approval);await wait(()=>!!button('이번만 승인'));
  if(arrival==='steps'){
   const steps=nodes().find(n=>n.tagName==='A'&&n.textContent==='절차 상세');assert(steps);await click(steps);await go(href);await wait(()=>!!button('이번만 승인'));
  }
  await change('결정 이유','준비본 저장만 명시 승인');const ack=nodes().find(n=>n.tagName==='LABEL'&&n.textContent==='정확 범위·위험·복구 한계를 확인했습니다')?.childNodes.find(n=>n.tagName==='INPUT');assert(ack);const ackProps=Object.keys(ack).find(k=>k.startsWith('__reactProps'))!;await ui.React.act(async()=>(ack as any)[ackProps].onChange({target:{checked:true}}));await press('이번만 승인');await wait(()=>!!link('원 준비를 이어갈 작업공간으로 돌아가기'));
  const back=link('원 준비를 이어갈 작업공간으로 돌아가기')!;assert.equal(back.getAttribute('href'),'#/projects/'+pid+'/mobile');const count=posts.length;await click(back);await open();
  assert.equal(location.hash,'#/projects/'+pid+'/mobile');const chat=nodes().find(n=>n.getAttribute('aria-label')==='총괄 작업');assert(chat);assert(!chat.attributes.has('hidden'),'복귀는 원 작업 chat 표시');assert(button('별도 결정을 같은 준비 원명령에 결박'));assert.equal(posts.length,count,'복귀는 승인 결박·저장 자동 POST0');
  const payloads=nodes().filter(n=>n.tagName==='PRE').map(n=>{try{return JSON.parse(n.textContent);}catch{return null;}});assert(payloads.some(v=>v&&canonicalJson(v)===canonicalJson(original)),'App의 원 준비 payload 불변');assert.deepEqual(posts.map(p=>JSON.parse(p.body).operation),arrival==='requestLost'?['requestApproval','requestApproval','decideApproval']:['requestApproval','decideApproval']);assert.deepEqual(q.unexpected,[]);
 }finally{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}
});
