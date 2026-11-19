import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

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
const saved=new Map<string,PropertyDescriptor|undefined>();let ui:any,uiCode:string;
const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
before(async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/knowledge/KnowledgePage.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:scope-boundary',name:'ScopeBoundaryTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'scope-boundary-memory',resolveId(id){if(id.endsWith('virtual:scope-boundary'))return '\0scope-boundary';},load(id){if(id==='\0scope-boundary')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{KnowledgePage}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};import{newKnowledge}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/knowledge/api.ts',import.meta.url)))};export{React,createRoot,KnowledgePage,ApiClient,newKnowledge};export{App}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/App.tsx',import.meta.url)))};export * as exclusions from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/knowledge/exclusion-api.ts',import.meta.url)))};export * as corrections from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/knowledge/correction-api.ts',import.meta.url)))};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const [key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 uiCode=(Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return ScopeBoundaryTest;';ui=new Function(uiCode)();
});
after(()=>{for(const channel of channels){channel.port1.close();channel.port2.close();}for(const[key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});

const id=(n:number)=>`ab100031-0000-4000-8000-${String(n).padStart(12,'0')}`,pid=id(1),uid=id(2),cid=id(3),at='2026-10-31T00:00:00.000Z';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const session={user:{id:uid},clientId:cid,csrfToken:'c'.repeat(43)};
function draft(base=0){
 const body='보존할 헌법',entry={kind:'CONSTITUTION',title:'소유 원칙',contentRef:{artifactId:id(4),bytes:Buffer.byteLength(body),contentHash:contentHash(body),mediaType:'text/plain;charset=utf-8'},sourceRefs:[],reason:'원칙',scope:{projectId:pid,stageRefs:[],taskRefs:[]},relatedRefs:[]},ref={id:id(5),version:1,contentHash:hash(entry)};
 const criteria={criteriaVersion:1,knowledgeKind:'CONSTITUTION',items:['KNOWLEDGE_PURPOSE','KNOWLEDGE_SOURCE','KNOWLEDGE_REASON','KNOWLEDGE_SCOPE','KNOWLEDGE_LIMITS'].map(criterionId=>({criterionId,title:criterionId}))};
 const review={ref:{id:id(6),targetRef:ref,criteriaVersion:1,outcome:'ACCEPTED'},criteria,items:criteria.items.map(i=>({criterionId:i.criterionId,outcome:'ACCEPTED',reason:'확인',evidenceRefs:[]})),reviewer:{kind:'HUMAN',userId:uid,sameAsTargetRecorder:true},sourceKind:'HUMAN_REVIEW',reason:'검토',reviewedAt:at,serverSequence:3};
 const confirmation={eventId:id(7),reviewRefs:[review.ref],reason:'확정',actorRef:{kind:'HUMAN',userId:uid},recordedAt:at};
 const target={ref,entry,body,state:'CONFIRMED',headVersion:1,supersedesRef:null,confirmation,currentConfirmationValid:true,contentReviewCriteria:criteria,contentReviews:[review],appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',agentDelivery:'NOT_CONNECTED',history:[{id:id(8),kind:'PROPOSED',reason:entry.reason,actorRef:confirmation.actorRef,recordedAt:at},{id:confirmation.eventId,kind:'CONFIRMED',reason:confirmation.reason,actorRef:confirmation.actorRef,reviewRefs:confirmation.reviewRefs,recordedAt:at}]};
 const b=ui.exclusions.newKnowledgeExclusion(pid,target,session,1);b.reason='원 제외 이유';b.dirty=true;return b;
}
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}
async function fixture(){
 let buffer:any=draft(),stored:any=null,currentProject=pid,shown=true,identity={},currentSession=session,lost=0,hold:ReturnType<typeof deferred<Response>>|null=null,fail=false;
 const writes:any[]=[],gets:string[]=[],responses:Response[]=[],controls={read:async()=>Response.json(stored)};
 const client=new ui.ApiClient(async(path:string,init:any)=>{
  if(init?.method==='POST'){
   const c=JSON.parse(init.body);writes.push(c);
   stored={...structuredClone(buffer.target),state:'EXCLUDED',currentConfirmationValid:false,history:[...structuredClone(buffer.target.history),{id:id(10),kind:'EXCLUDED',reason:c.payload.reason,actorRef:{kind:'HUMAN',userId:uid},recordedAt:at}]};
   const response=Response.json({operationId:id(9),commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:c.targetId,version:c.expectedVersion,data:{status:'EXCLUDED',ref:c.payload.versionRef,reason:c.payload.reason,eventId:id(10)},serverReceivedAt:at});responses.push(response);
   if(hold){const wait=hold;hold=null;return wait.promise;}if(fail){fail=false;throw Error('transport');}return response;
  }
  gets.push(path);
  if(path.includes('/knowledge?'))return Response.json({items:[],hasMore:false,nextCursor:null,searchScope:'TITLE_REASON',observedAt:at});
  if(path.includes('/conversations?'))return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:at});
  if(path.includes('/knowledge/'))return controls.read();
  throw Error('unexpected '+path);
 });
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 function render(){const captured=identity;root.render(shown?ui.React.createElement(ui.KnowledgePage,{client,projectId:currentProject,session:currentSession,buffer:null,onChange(){},conversationBuffer:null,onConversationChange(){},exclusion:buffer,onExclusionChange:(...args:any[])=>{
  if(captured!==identity)return false;
  // 이전 값 전달 계약과 보완된 expected/next CAS를 각각 그대로 소비한다.
  if(args.length===1)buffer=args[0];else{if(buffer!==args[0])return false;buffer=args[1];}
  render();return true;
 },correction:null,onCorrectionChange(){},decision:null,onDecisionChange(){},onAuthenticationLost(){lost++;}}):null);}
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 const button=(name:string)=>{const b=nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===name);assert(b,name+' / '+container.textContent);return b;};
 const settle=()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});
 const wait=async(check:()=>boolean)=>{for(let n=0;n<100&&!check();n++)await settle();assert(check(),container.textContent);};
 const click=async(name:string)=>{const b=button(name);assert(!b.disabled);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const change=async(value:string)=>{const n=nodes().find(n=>n.getAttribute('aria-label')==='지식 제외 사유')!;const k=Object.keys(n).find(k=>k.startsWith('__reactProps'))!;await ui.React.act(async()=>{(n as any)[k].onChange({target:{value}});});};
 await ui.React.act(async()=>render());
 return{writes,gets,responses,controls,nodes,stored:()=>stored,button,click,change,wait,settle,container,buffer:()=>buffer,lost:()=>lost,fail:()=>{fail=true;},hold:()=>{hold=deferred<Response>();return hold;},replace:async(b:any)=>{buffer=b;await ui.React.act(async()=>render());},route:async(show:boolean)=>{shown=show;await ui.React.act(async()=>render());},context:async(s:typeof session,p=pid)=>{identity={};currentSession=s;currentProject=p;await ui.React.act(async()=>render());},close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
function holdDigest(){
 const subtle=crypto.subtle,descriptor=Object.getOwnPropertyDescriptor(subtle,'digest'),original=subtle.digest;
 const gate=deferred<void>();let entered=false,done=false;
 Object.defineProperty(subtle,'digest',{configurable:true,value:async(...args:any[])=>{const bytes=await Reflect.apply(original,subtle,args);if(!entered){entered=true;await gate.promise;}return bytes;}});
 return{entered:()=>entered,release:()=>{done=true;gate.resolve();},restore:()=>{if(!done)gate.resolve();if(descriptor)Object.defineProperty(subtle,'digest',descriptor);else Reflect.deleteProperty(subtle,'digest');}};
}
for(const mode of ['편집','닫기']as const)test('제외 prepare · 이탈 재진입 '+mode+' 후 old digest는 버퍼·POST를 만들지 않는다',async()=>{
 const f=await fixture(),digest=holdDigest(),confirmDescriptor=Object.getOwnPropertyDescriptor(globalThis,'confirm');Object.defineProperty(globalThis,'confirm',{configurable:true,value:()=>true});
 try{
  await f.click('사용 제외 저장');await f.wait(digest.entered);await f.route(false);await f.route(true);
  if(mode==='편집')await f.change('새 화면의 제외 이유');else await f.click('지식 제외 닫기');
  const selected=f.buffer();digest.release();for(let i=0;i<8;i++)await f.settle();
  assert.equal(f.buffer(),selected);assert.equal(f.writes.length,0);assert.equal(f.lost(),0);
 }finally{digest.restore();if(confirmDescriptor)Object.defineProperty(globalThis,'confirm',confirmDescriptor);else Reflect.deleteProperty(globalThis,'confirm');await f.close();}
});

test('제외 저장 정상·UNKNOWN 왕복은 원 command/body 재확인을 보존한다',async()=>{
 const f=await fixture();try{
  f.fail();await f.click('사용 제외 저장');await f.wait(()=>f.buffer().uncertain);const pending=structuredClone(f.buffer().pending);
  await f.route(false);await f.route(true);assert.equal(f.writes.length,1);assert.deepEqual(f.buffer().pending,pending);
  await f.click('같은 제외 명령 결과 확인');await f.wait(()=>!!f.buffer().savedEventId);
  assert.deepEqual(f.writes,[pending,pending]);assert.equal(f.buffer().uncertain,false);assert.equal(f.lost(),0);
 }finally{await f.close();}
});

test('전송한 원 dispatch 성공은 이탈 후에도 같은 원버퍼에만 보존한다',async()=>{
 const f=await fixture(),late=f.hold();try{
  await f.click('사용 제외 저장');await f.wait(()=>f.writes.length===1);await f.route(false);
  const reads=f.gets.length;late.resolve(f.responses[0]!);await f.wait(()=>!!f.buffer().savedEventId);
  assert.equal(f.gets.length,reads);await f.route(true);assert.match(f.container.textContent,/사용 제외 저장 확인/);assert.equal(f.writes.length,1);
 }finally{await f.close();}
});

for(const code of [200,401])test('같은 명령의 새 dispatch는 이전 '+code+'로 확정·인증소실되지 않는다',async()=>{
 const f=await fixture(),first=f.hold();try{
  await f.click('사용 제외 저장');await f.wait(()=>f.writes.length===1);await f.route(false);await f.route(true);
  const second=f.hold();await f.click('같은 제외 명령 결과 확인');await f.wait(()=>f.writes.length===2);
  const owned=f.buffer(),reads=f.gets.length;first.resolve(code===200?f.responses[0]!:Response.json({code:'AUTH_REQUIRED'},{status:401}));
  for(let n=0;n<8;n++)await f.settle();assert.equal(f.buffer(),owned);assert.equal(f.lost(),0);assert.equal(f.gets.length,reads);
  second.resolve(f.responses[1]!);await f.wait(()=>!!f.buffer().savedEventId);assert.deepEqual(f.writes[0],f.writes[1]);
 }finally{await f.close();}
});

for(const mode of ['버퍼','세션','이탈']as const)for(const status of [200,401])test('제외 늦은 '+status+' · '+mode+' 결과·인증·목록 갱신 차단',async()=>{
 const f=await fixture(),late=f.hold();try{
  await f.click('사용 제외 저장');await f.wait(()=>f.writes.length===1);
  if(mode==='버퍼')await f.replace(draft());else if(mode==='세션')await f.context({...session,csrfToken:'d'.repeat(43)});else await f.route(false);
  const selected=f.buffer(),reads=f.gets.length;late.resolve(status===200?f.responses[0]!:Response.json({code:'AUTH_REQUIRED'},{status:401}));
  for(let n=0;n<8;n++)await f.settle();if(mode!=='이탈')assert.equal(f.buffer(),selected);
  assert.equal(f.lost(),0);assert.equal(f.gets.length,reads);assert.equal(f.writes.length,1);
 }finally{await f.close();}
});
test('현재401과 잘못된 성공 영수증은 원 pending을 보존한다',async()=>{
 for(const status of [401,200]){const f=await fixture(),late=f.hold();try{
  await f.click('사용 제외 저장');await f.wait(()=>f.writes.length===1);const pending=structuredClone(f.buffer().pending);
  if(status===401)late.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));
  else{const receipt=await f.responses[0]!.json();receipt.data.ref={...receipt.data.ref,contentHash:'f'.repeat(64)};late.resolve(Response.json(receipt));}
  await f.wait(()=>!!f.buffer().failure);assert.deepEqual(f.buffer().pending,pending);assert.equal(f.buffer().savedEventId,null);assert.equal(f.lost(),status===401?1:0);
 }finally{await f.close();}}
});

for(const mode of ['편집','닫기']as const)test('실제 App 제외 CAS · digest 대기 중 왕복 '+mode+' 보존',async()=>{
 const events=new Map<string,Set<Function>>(),location=new URL(`https://anvil.invalid/#/projects/${pid}/knowledge`),writes:any[]=[],gets:string[]=[],unknown:string[]=[];
 const source=draft().target,project={id:pid,name:'원 프로젝트',purpose:'읽기',desiredOutcome:'보존',version:1,createdAt:at,updatedAt:at,currentMethodologyRef:null,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[],viewerPermissions:['READ_PROJECT'],participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:cid,generation:1}};
 const fetch=async(input:unknown,init:any)=>{const path=String(input);if(init?.method==='POST'){
  const c=JSON.parse(init.body);writes.push(c);assert.equal(c.operation,'excludeKnowledge');
  return Response.json({operationId:id(9),commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:c.targetId,version:c.expectedVersion,data:{status:'EXCLUDED',ref:c.payload.versionRef,reason:c.payload.reason,eventId:id(10)},serverReceivedAt:at}); }gets.push(path);
  if(path==='/api/v1/session')return Response.json({...session,user:{...session.user,displayName:'합성 사용자'}});
  if(path===`/api/v1/projects/${pid}`)return Response.json(project);
  if(path.startsWith('/api/v1/projects?'))return Response.json({items:[],nextCursor:null,hasMore:false,observedAt:at,baselineVersion:null});
  if(path.includes('/knowledge?'))return Response.json({items:[{versionRef:source.ref,title:source.entry.title,kind:source.entry.kind,sourceRefs:[],reasonSnippet:source.entry.reason,state:'CONFIRMED',currentConfirmationValid:true}],hasMore:false,nextCursor:null,searchScope:'TITLE_REASON',observedAt:at});
  if(path===`/api/v1/projects/${pid}/knowledge/${source.ref.id}/versions/1`)return Response.json(source);
  if(path.includes('/conversations?'))return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:at});
  if(path.includes('/constitution?'))return Response.json({current:null,history:[],hasMore:false,nextBeforeVersion:null,agentDelivery:'NOT_CONNECTED',compliance:'NOT_ASSESSED',observedAt:at});
  unknown.push(path);throw Error('UNEXPECTED_MEMORY_REQUEST');
 };
 const local=new Map<string,PropertyDescriptor|undefined>(),addEventListener=(name:string,fn:Function)=>{const set=events.get(name)??new Set();set.add(fn);events.set(name,set);},removeEventListener=(name:string,fn:Function)=>events.get(name)?.delete(fn);
 for(const[key,value]of Object.entries({location,fetch,addEventListener,removeEventListener})){local.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 const originalUi=ui;ui=new Function(uiCode)();
 const window=document.defaultView,oldLocation=window.location,oldAdd=window.addEventListener,oldRemove=window.removeEventListener;window.location=location;window.addEventListener=addEventListener;window.removeEventListener=removeEventListener;window.matchMedia=()=>({matches:false});document.getElementById=()=>null;
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))],settle=()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));}),wait=async(check:()=>boolean)=>{for(let n=0;n<100&&!check();n++)await settle();assert(check(),container.textContent);};
 const click=async(name:string)=>{const b=nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===name);assert(b,name);assert(!b.disabled);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const nav=async(hash:string)=>{await ui.React.act(async()=>{location.hash=hash;for(const fn of events.get('hashchange')??[])fn();});};
 let digest:ReturnType<typeof holdDigest>|null=null;
 const confirmDescriptor=Object.getOwnPropertyDescriptor(globalThis,'confirm');Object.defineProperty(globalThis,'confirm',{configurable:true,value:()=>true});
 const change=async(value:string)=>{const n=nodes().find(n=>n.getAttribute('aria-label')==='지식 제외 사유')!;const k=Object.keys(n).find(k=>k.startsWith('__reactProps'))!;await ui.React.act(async()=>{(n as any)[k].onChange({target:{value}});});};
 try{
  await ui.React.act(async()=>root.render(ui.React.createElement(ui.App)));await wait(()=>nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='지식 원문 보기'));
  await click('지식 원문 보기');await wait(()=>nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='이 지식 사용 제외'));
  await click('이 지식 사용 제외');await wait(()=>nodes().some(n=>n.getAttribute('aria-label')==='지식 제외 사유'));await change('원 제외 이유');
  digest=holdDigest();await click('사용 제외 저장');await wait(digest.entered);await nav('#/projects');await nav(`#/projects/${pid}/knowledge`);
  await wait(()=>nodes().some(n=>n.getAttribute('aria-label')==='지식 제외 사유'));
  if(mode==='편집')await change('새 화면 이유');else await click('지식 제외 닫기');
  digest.release();for(let i=0;i<8;i++)await settle();assert.equal(writes.length,0);assert.deepEqual(unknown,[]);
  if(mode==='편집'){const n=nodes().find(n=>n.getAttribute('aria-label')==='지식 제외 사유')!;assert.equal(n.value,'새 화면 이유');await click('사용 제외 저장');await wait(()=>container.textContent.includes('사용 제외 저장 확인'));assert.equal(writes.length,1);assert.equal(writes[0].payload.reason,'새 화면 이유');}
  else assert.equal(nodes().filter(n=>n.getAttribute('aria-label')==='지식 사용 제외 요청').length,0);
 }finally{
  digest?.restore();if(confirmDescriptor)Object.defineProperty(globalThis,'confirm',confirmDescriptor);else Reflect.deleteProperty(globalThis,'confirm');
  await ui.React.act(async()=>root.unmount());document.body.removeChild(container);window.location=oldLocation;window.addEventListener=oldAdd;window.removeEventListener=oldRemove;ui=originalUi;for(const[key,value]of local)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);
 }
});


async function correctionFixture(){
 const target=draft().target;let correction:any=ui.corrections.newKnowledgeCorrection(pid,target,session,1),currentSession=session,projectId=pid,stored:any=null,lost=0;
 correction={...correction,title:'정정한 새 제목',body:'정정해서 보관한 본문',reason:'새 이유',changeReason:'정정 근거',dirty:true};
 const calls:{path:string;method:string}[]=[],writes:any[]=[],controls={read:async()=>Response.json(stored)};
 const client=new ui.ApiClient(async(path:string,init:any)=>{
  calls.push({path,method:init.method});
  if(init.method==='POST'){
   const upload=path.endsWith('/files'),c=JSON.parse(upload?new Headers(init.headers).get('x-anvil-command')!:init.body);writes.push(c);
   if(!upload){const entry=c.payload.entry;stored={ref:{id:target.ref.id,version:2,contentHash:hash(entry)},entry,body:correction.body,state:'PROPOSED',headVersion:2,supersedesRef:target.ref,appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',agentDelivery:'NOT_CONNECTED',history:[{id:id(19),kind:'CORRECTED',baseRef:target.ref,sourceRefs:c.payload.sourceRefs,reason:correction.changeReason,actorRef:{kind:'HUMAN',userId:uid},recordedAt:at}]};}
   return Response.json({operationId:id(18),commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:upload?id(17):target.ref.id,version:upload?null:2,data:upload?{status:'ARTIFACT_READY',artifactRef:{artifactId:id(17),...c.payload}}:{status:'PROPOSED',ref:stored.ref,entry:stored.entry,baseRef:target.ref,supersedesRef:target.ref,reason:correction.changeReason,changeSources:c.payload.sourceRefs,eventId:id(19)},serverReceivedAt:at});
  }
  if(path.includes('/knowledge?'))return Response.json({items:[],hasMore:false,nextCursor:null,searchScope:'TITLE_REASON',observedAt:at});
  if(path.includes('/conversations?'))return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:at});
  if(path.includes('/knowledge/'))return controls.read();
  throw Error('UNEXPECTED_RAM_REQUEST');
 });
 const container=document.createElement('main'),root=ui.createRoot(container);document.body.appendChild(container);
 const render=()=>root.render(ui.React.createElement(ui.KnowledgePage,{client,projectId,session:currentSession,buffer:null,onChange(){},conversationBuffer:null,onConversationChange(){},exclusion:null,onExclusionChange(){},correction,onCorrectionChange:(v:any)=>{correction=typeof v==='function'?v(correction):v;render();},decision:null,onDecisionChange(){},onAuthenticationLost(){lost++;}}));
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))],find=(label:string)=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===label);
 const settle=()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});
 const wait=async(check:()=>boolean)=>{for(let n=0;n<150&&!check();n++)await settle();assert(check(),container.textContent);};
 const click=async(label:string)=>{const button=find(label);assert(button&&!button.disabled,label);await ui.React.act(async()=>button.dispatchEvent({type:'click',button:0}));};
 await ui.React.act(async()=>render());
 return{calls,writes,controls,find,nodes,click,wait,settle,stored:()=>stored,buffer:()=>correction,lost:()=>lost,text:()=>container.textContent,replace:async(b:any)=>{correction=b;await ui.React.act(async()=>render());},context:async(s:typeof session,p=pid)=>{currentSession=s;projectId=p;await ui.React.act(async()=>render());},close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
const correctionRead='저장한 정정본 고정 원문 보기';
async function saveCorrection(f:Awaited<ReturnType<typeof correctionFixture>>){await f.click('지식 정정 저장');await f.wait(()=>!!f.buffer()?.savedRef);await f.settle();}

test('정정 저장 고정 조회: 검색 결과가 비어도 savedRef의 정확 원문·이력을 명시 GET한다',async()=>{
 const originalError=console.error;let duplicateKeys=0;
 console.error=(...args:unknown[])=>{if(args.some(v=>typeof v==='string'&&v.includes('Encountered two children with the same key')))duplicateKeys++;Reflect.apply(originalError,console,args);};
 try{const f=await correctionFixture();try{
  assert(!f.find(correctionRead));await saveCorrection(f);assert.equal(f.writes.length,2);assert.equal(f.calls.filter(c=>c.path.includes('/knowledge/')).length,0);
  const saved=f.buffer();await f.click(correctionRead);await f.wait(()=>f.nodes().some(n=>n.getAttribute('aria-label')==='보관 지식 원문'&&n.textContent===f.stored().body));
  assert.equal(f.buffer(),saved);assert.equal(f.writes.length,2);assert.equal(f.calls.filter(c=>c.path.includes('/knowledge/')).length,1);assert(f.calls.some(c=>c.path===`/api/v1/projects/${pid}/knowledge/${saved.savedRef.id}/versions/2`));assert(f.text().includes('CORRECTED'));assert.equal(duplicateKeys,0,'형제 출처 중복 key 경고');
 }finally{await f.close();}}finally{console.error=originalError;}
});

test('정정 저장 고정 조회: 늦은200/401과 교체·닫기·세션 변경은 원문 및 인증 효과0',async()=>{
 for(const status of [200,401])for(const change of ['REPLACE','CLOSE','SESSION','PROJECT']){
  const f=await correctionFixture(),gate=deferred<Response>();try{
   await saveCorrection(f);f.controls.read=()=>gate.promise;await f.click(correctionRead);const original=f.buffer();
   if(change==='REPLACE')await f.replace({...original,savedRef:null,dirty:true});if(change==='CLOSE')await f.replace(null);if(change==='SESSION')await f.context({...session,csrfToken:'d'.repeat(43)});if(change==='PROJECT')await f.context(session,id(21));
   gate.resolve(status===200?Response.json(f.stored()):Response.json({code:'AUTH_REQUIRED'},{status}));for(let n=0;n<8;n++)await f.settle();
   assert(!f.nodes().some(n=>n.getAttribute('aria-label')==='보관 지식 원문'));assert.equal(f.lost(),0);assert.equal(f.writes.length,2);
  }finally{gate.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.close();}
 }
});

test('정정 저장 고정 조회: UNKNOWN·미저장 차단 및 다른 hash·현재401 거절',async()=>{
 const f=await correctionFixture();try{
  await saveCorrection(f);const saved=f.buffer();await f.replace({...saved,uncertain:true});assert(!f.find(correctionRead));await f.replace(saved);
  for(const field of ['ref','supersedesRef']){f.controls.read=async()=>{const value=structuredClone(f.stored());value[field].contentHash='f'.repeat(64);if(field==='supersedesRef')value.history[0].baseRef={...value.supersedesRef};return Response.json(value);};await f.click(correctionRead);await f.wait(()=>f.text().includes('RESPONSE_INVALID'));assert(!f.nodes().some(n=>n.getAttribute('aria-label')==='보관 지식 원문'));}
  f.controls.read=async()=>Response.json({code:'AUTH_REQUIRED'},{status:401});await f.click(correctionRead);await f.wait(()=>f.lost()===1);assert.equal(f.writes.length,2);
 }finally{await f.close();}
});


const exclusionRead='제외한 지식 고정 원문·이력 보기';
async function saveExclusion(f:Awaited<ReturnType<typeof fixture>>){await f.click('사용 제외 저장');await f.wait(()=>!!f.buffer()?.savedEventId);await f.settle();}
const hasStoredOriginal=(f:Awaited<ReturnType<typeof fixture>>)=>f.nodes().some(n=>n.getAttribute('aria-label')==='보관 지식 원문');
test('제외 저장 고정 조회: ACTIVE 빈목록에서도 원 영수증 사건·원문을 명시 GET으로 확인한다',async()=>{
 const f=await fixture();try{
  assert(!f.nodes().some(n=>n.textContent===exclusionRead));await saveExclusion(f);const saved=f.buffer();assert.equal(f.writes.length,1);assert.equal(f.gets.filter(p=>p.includes('/knowledge/')).length,0);
  await f.click(exclusionRead);await f.wait(()=>hasStoredOriginal(f));assert(f.container.textContent.includes('EXCLUDED'));assert(f.container.textContent.includes(saved.savedEventId));assert.equal(f.buffer(),saved);assert.equal(f.writes.length,1);
  assert.deepEqual(f.gets.filter(p=>p.includes('/knowledge/')),[`/api/v1/projects/${pid}/knowledge/${saved.target.ref.id}/versions/${saved.target.ref.version}`]);
  assert(f.gets.filter(p=>p.includes('/knowledge?')).every(p=>!p.includes('EXCLUDED')));
  await f.replace(null);assert(!hasStoredOriginal(f));
 }finally{await f.close();}
});

test('제외 저장 고정 조회: 다른 사건·사유·작성자·hash와 미제외 응답은 원 영수증 확인이 아니다',async()=>{
 const f=await fixture();try{
  await saveExclusion(f);
  for(const mode of ['EVENT','REASON','ACTOR','HASH','ABSENT']){
   f.controls.read=async()=>{const v=structuredClone(f.stored()),e=v.history.at(-1);if(mode==='EVENT')e.id=id(27);if(mode==='REASON')e.reason='다른 합성 사유';if(mode==='ACTOR')e.actorRef.userId=id(28);if(mode==='HASH')v.ref.contentHash='f'.repeat(64);if(mode==='ABSENT'){v.history.pop();v.state='CONFIRMED';v.currentConfirmationValid=true;}return Response.json(v);};
   await f.click(exclusionRead);await f.wait(()=>f.container.textContent.includes('RESPONSE_INVALID'));assert(!hasStoredOriginal(f),mode);assert.equal(f.lost(),0);
  }
  for(const status of [403,401]){f.controls.read=async()=>Response.json({code:status===401?'AUTH_REQUIRED':'FORBIDDEN'},{status});await f.click(exclusionRead);await f.wait(()=>f.container.textContent.includes(status===401?'AUTH_REQUIRED':'FORBIDDEN'));assert(!hasStoredOriginal(f));}
  assert.equal(f.lost(),1);assert.equal(f.writes.length,1);
 }finally{await f.close();}
});

test('제외 저장 고정 조회: UNKNOWN·미저장과 교체·닫기·세션/프로젝트 뒤 늦은 결과를 차단한다',async()=>{
 for(const status of [200,401])for(const mode of ['REPLACE','CLOSE','SESSION','USER','DEVICE','PROJECT']){
  const f=await fixture(),gate=deferred<Response>();try{
   await saveExclusion(f);const saved=f.buffer();await f.replace({...saved,uncertain:true});assert(!f.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent===exclusionRead));await f.replace(saved);
   f.controls.read=()=>gate.promise;await f.click(exclusionRead);
   if(mode==='REPLACE')await f.replace({...saved,savedEventId:null});if(mode==='CLOSE')await f.replace(null);if(mode==='SESSION')await f.context({...session,csrfToken:'d'.repeat(43)});if(mode==='USER')await f.context({...session,user:{...session.user,id:id(30)}});if(mode==='DEVICE')await f.context({...session,clientId:id(31)});if(mode==='PROJECT')await f.context(session,id(29));
   gate.resolve(status===200?Response.json(f.stored()):Response.json({code:'AUTH_REQUIRED'},{status}));for(let n=0;n<8;n++)await f.settle();assert(!hasStoredOriginal(f));assert.equal(f.lost(),0);assert.equal(f.writes.length,1);
  }finally{gate.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.close();}
 }
});

async function shareRecoveryFixture(){
 let share:any=null,shown=true,currentSession=session,currentProject=pid,lost=0;
 const source=draft().target,writes:string[]=[],gets:string[]=[],controls={read:async()=>Response.json(source)};
 const client=new ui.ApiClient(async(path:string,init:any)=>{
  if(init?.method==='POST'){writes.push(String(init.body));throw Error('합성 응답 유실');}
  gets.push(path);
  if(path.includes('/knowledge?'))return Response.json({items:[{versionRef:source.ref,title:source.entry.title,kind:source.entry.kind,sourceRefs:[],reasonSnippet:source.entry.reason,state:source.state,currentConfirmationValid:true}],hasMore:false,nextCursor:null,searchScope:'TITLE_REASON',observedAt:at});
  if(path.includes('/knowledge/'))return controls.read();
  if(path.includes('/conversations?'))return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:at});
  if(path===`/api/v1/projects/${pid}`)return Response.json({id:pid,participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:cid,generation:1}});
  if(path.startsWith('/api/v1/projects?'))return Response.json({items:[{id:id(40),name:'명시 대상',purpose:'합성 대상',version:1,updatedAt:at}],hasMore:false,nextCursor:null,observedAt:at,baselineVersion:null});
  throw Error('예상 밖 합성 GET');
 });
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 function render(){root.render(shown?ui.React.createElement(ui.KnowledgePage,{client,projectId:currentProject,session:currentSession,buffer:null,onChange(){throw Error('지식 버퍼 변경 금지');},conversationBuffer:null,onConversationChange(){},exclusion:null,onExclusionChange(){},correction:null,onCorrectionChange(){},decision:null,onDecisionChange(){},shareBuffer:share,onShareChange:(change:any)=>{share=typeof change==='function'?change(share):change;render();},onAuthenticationLost(){lost++;}}):null);}
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 const button=(name:string)=>{const b=nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===name);assert(b,name);return b;};
 const settle=()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});
 const wait=async(check:()=>boolean)=>{for(let n=0;n<100&&!check();n++)await settle();assert(check(),container.textContent.slice(-1200));};
 const click=async(name:string)=>{const b=button(name);assert(!b.disabled,name);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const input=async(node:MemoryNode,value:any)=>{const k=Object.keys(node).find(k=>k.startsWith('__reactProps'))!;await ui.React.act(async()=>{(node as any)[k].onChange({target:value});});};
 await ui.React.act(async()=>render());await wait(()=>nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='지식 원문 보기'));
 async function prepareUnknown(){await click('지식 원문 보기');await wait(()=>!button('선택 지식으로 요청 작성').disabled);await click('선택 지식으로 요청 작성');await wait(()=>!!share);await click('허가된 대상 프로젝트 조회');await wait(()=>nodes().some(n=>n.tagName==='INPUT'&&n.parentNode?.textContent==='명시 대상'));const check=nodes().find(n=>n.tagName==='INPUT'&&n.parentNode?.textContent==='명시 대상')!;await input(check,{checked:true});await input(nodes().find(n=>n.getAttribute('aria-label')==='공유 요청 목적')!,{value:'원 지식의 명시 요청'});await click('공유 요청 보관');await wait(()=>!!share?.uncertain&&!!share?.failure);}
 return{source,client,controls,gets,writes,container,nodes,button,click,settle,wait,prepareUnknown,buffer:()=>share,lost:()=>lost,render:()=>ui.React.act(async()=>render()),route:async(value:boolean)=>{shown=value;await ui.React.act(async()=>render());},replace:async(value:any)=>{share=value;await ui.React.act(async()=>render());},context:async(s:typeof session,p=pid)=>{currentSession=s;currentProject=p;await ui.React.act(async()=>render());},close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
test('미결 공유 원 지식: 검색 선택·응답 유실·화면 왕복 뒤 정확 원문 명시 재선택',async()=>{
 const f=await shareRecoveryFixture();try{
  await f.prepareUnknown();const original=f.buffer(),command=JSON.stringify(original.pending);assert.equal(f.writes.length,1);
  await f.route(false);await f.route(true);await f.wait(()=>!f.container.textContent.includes('검색 중'));assert(f.button('원명령 재확인').disabled);const count=f.gets.filter(p=>p.includes('/knowledge/')).length;
  await f.click('미결 공유 요청의 원 지식 열기');await f.wait(()=>!f.button('원명령 재확인').disabled);
  assert.equal(f.gets.filter(p=>p.includes('/knowledge/')).length,count+1);assert.equal(f.buffer(),original);assert.equal(JSON.stringify(f.buffer().pending),command);assert.equal(f.writes.length,1);assert(f.button('선택 지식으로 요청 작성').disabled);assert(f.container.textContent.includes(f.source.body));
  await f.click('원명령 재확인');await f.wait(()=>f.writes.length===2&&!!f.buffer().failure);assert.equal(f.writes[0],f.writes[1]);assert.equal(JSON.stringify(f.buffer().pending),command);
 }finally{await f.close();}
});

test('미결 공유 원 지식: 현재 최신판이 달라도 원 고정 버전을 선택하고 검색 조건을 보존한다',async()=>{
 const f=await shareRecoveryFixture();try{await f.prepareUnknown();const b=f.buffer();await f.route(false);f.source.headVersion=2;f.source.state='SUPERSEDED';f.source.currentConfirmationValid=false;await f.route(true);await f.wait(()=>!f.button('미결 공유 요청의 원 지식 열기').disabled);const count=f.gets.length;await f.click('미결 공유 요청의 원 지식 열기');await f.wait(()=>!f.button('원명령 재확인').disabled);assert.equal(f.buffer(),b);assert.deepEqual(f.gets.slice(count),[`/api/v1/projects/${pid}/knowledge/${b.versionRefs[0].id}/versions/1`]);assert.equal(f.nodes().find(n=>n.getAttribute('aria-label')==='지식 검색')!.value,'');const filter=f.nodes().find(n=>n.getAttribute('aria-label')==='지식 상태 필터')!,props=Object.keys(filter).find(k=>k.startsWith('__reactProps'))!;assert.equal((filter as any)[props].value,'ACTIVE');assert.equal(f.writes.length,1);}finally{await f.close();}
});
for(const invalid of ['owner','client','project','commandRef','invalidRef'] as const)test('미결 공유 원 지식: '+invalid+'는 버튼·GET0',async()=>{
 const f=await shareRecoveryFixture();try{await f.prepareUnknown();await f.route(false);const b=structuredClone(f.buffer());if(invalid==='owner')b.ownerUserId=id(90);if(invalid==='client')b.ownerClientId=id(90);if(invalid==='project')b.projectId=id(90);if(invalid==='commandRef')b.pending.payload.versionRefs[0].contentHash='b'.repeat(64);if(invalid==='invalidRef')b.versionRefs[0].contentHash='bad';await f.replace(b);await f.route(true);await f.settle();assert(!f.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='미결 공유 요청의 원 지식 열기'));assert.equal(f.gets.filter(p=>p.includes('/knowledge/')).length,1);assert.equal(f.writes.length,1);assert.equal(f.buffer(),b);}finally{await f.close();}
});
for(const invalid of ['hash','401','403'] as const)test('미결 공유 원 지식: '+invalid+' 거절은 선택0·원명령 보존',async()=>{
 const f=await shareRecoveryFixture();try{await f.prepareUnknown();const b=f.buffer();await f.route(false);await f.route(true);await f.wait(()=>!f.button('미결 공유 요청의 원 지식 열기').disabled);f.controls.read=async()=>invalid==='hash'?Response.json({...f.source,ref:{...f.source.ref,contentHash:'b'.repeat(64)}}):Response.json({code:'AUTH_REQUIRED'},{status:Number(invalid)});await f.click('미결 공유 요청의 원 지식 열기');await f.wait(()=>!f.button('미결 공유 요청의 원 지식 열기').disabled);assert(f.button('원명령 재확인').disabled);assert(!f.nodes().some(n=>n.getAttribute('aria-label')==='보관 지식 원문'));assert.equal(f.buffer(),b);assert.equal(f.writes.length,1);assert.equal(f.lost(),invalid==='401'?1:0);}finally{await f.close();}
});
for(const boundary of ['bufferABA','project','session','transport','leave'] as const)for(const status of [200,401])test('미결 공유 원 지식: '+boundary+' 대기 중 old'+status+' 폐기',async()=>{
 const f=await shareRecoveryFixture(),gate=deferred<Response>();try{await f.prepareUnknown();const original=f.buffer();await f.route(false);await f.route(true);await f.wait(()=>!f.button('미결 공유 요청의 원 지식 열기').disabled);f.controls.read=()=>gate.promise;const count=f.gets.filter(p=>p.includes('/knowledge/')).length,button=f.button('미결 공유 요청의 원 지식 열기');await ui.React.act(async()=>{button.dispatchEvent({type:'click',button:0,bubbles:true});button.dispatchEvent({type:'click',button:0,bubbles:true});});assert.equal(f.gets.filter(p=>p.includes('/knowledge/')).length,count+1);
 if(boundary==='bufferABA'){await f.replace(structuredClone(original));await f.replace(original);}
 if(boundary==='project'){await f.context(session,id(99));await f.context(session);}
 if(boundary==='session'){await f.context({...session,csrfToken:'d'.repeat(43)});await f.context(session);}
 if(boundary==='transport'){const transport=f.client.transport;f.client.transport=async()=>Response.json({code:'UNUSED'},{status:403});await f.render();f.client.transport=transport;await f.render();}
 if(boundary==='leave'){await f.route(false);await f.route(true);}
 gate.resolve(Response.json(status===200?f.source:{code:'AUTH_REQUIRED'},{status}));for(let n=0;n<8;n++)await f.settle();assert(!f.nodes().some(n=>n.getAttribute('aria-label')==='보관 지식 원문'));assert(f.button('원명령 재확인').disabled);assert.equal(f.lost(),0);assert.equal(f.writes.length,1);assert.equal(f.buffer(),original);
 }finally{gate.resolve(Response.json({code:'CANCELLED'},{status:503}));await f.settle();await f.close();}
});
