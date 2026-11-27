import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {seed,clientFixture} from './registered-preparation-options-fixture.ts';
import {prepareExecutionCommand,selectPreparationSources,type ExecutionPreparationBuffer} from '../../../apps/web/src/features/workspace/execution-preparation-api.ts';
import {transferFixture} from '../UI09/transfer-fixture.ts';

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
 const src=(s:string)=>JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/'+s,import.meta.url)));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:saved-context',name:'SavedContextTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'saved-context-memory',resolveId(id){if(id.endsWith('virtual:saved-context'))return '\0saved-context';},load(id){if(id==='\0saved-context')return `export * as React from 'react';export {createRoot} from 'react-dom/client';export {AssignmentContentDecision} from ${src('features/workspace/AssignmentContentDecision.tsx')};export {ExecutionPreparationEditor} from ${src('features/workspace/ExecutionPreparationEditor.tsx')};export {ApiClient} from ${src('api/client.ts')};export {newContextPreparation} from ${src('features/workspace/context-api.ts')};export {newExecutionPreparation} from ${src('features/workspace/execution-preparation-api.ts')};export {normalInitialUnderstandingOwner} from ${src('features/session-detail/understanding-review-write.ts')};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const [key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 uiCode=(Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return SavedContextTest;';ui=new Function(uiCode)();
});
after(()=>{for(const channel of channels){channel.port1.close();channel.port2.close();}for(const[key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});
const label='저장한 맥락 원문 확인 후 선택';
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}
async function fixture(){
 const f=seed(true),q=clientFixture(f),calls:{path:string;method:string}[]=[];
 const queued:Array<(previous:ExecutionPreparationBuffer|null)=>ExecutionPreparationBuffer|null>=[];let deferChange=false;
 let session=f.session,confirmed=f.confirmed,shown=true,lost=0,next:Response|null=null,hold:ReturnType<typeof deferred<Response>>|null=null;
 let context=ui.newContextPreparation(f.confirmed,f.session,1);context.resultRef=f.context.ref;context.dirty=false;
 let buffer=ui.newExecutionPreparation(f.confirmed,f.session);buffer.draft={roleBindingRef:f.binding.ref,contextBundleRef:null,capabilityRef:f.report.ref,sourceScopes:[f.scope],mode:'CONTEXT_REVIEW',reason:'목록 밖 고정 맥락 선택'};
 const client=new ui.ApiClient(async(path:string,init:any)=>{calls.push({path,method:init?.method??'GET'});if(path.includes('/context/')){if(hold){const d=hold;hold=null;return d.promise;}if(next){const r=next;next=null;return r;}}if(path.includes('/context?'))return Response.json({projectId:f.confirmed.projectId,assignmentRef:f.confirmed.ref,items:[],hasMore:true,limit:50,ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt:f.at});return q.client.transport(path,init);});
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 function render(){root.render(shown?ui.React.createElement(ui.ExecutionPreparationEditor,{client,confirmed,session,providedHumanReportRef:f.report.ref,savedContextBuffer:context,buffer,onChange:(change:any)=>{if(deferChange){queued.push(change);return;}buffer=typeof change==='function'?change(buffer):change;render();},owner:true,onAuthenticationLost:()=>lost++}):null);}
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 const button=(name:string)=>{const b=nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===name);assert(b,name);return b;};
 const settle=()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});
 const wait=async(check:()=>boolean)=>{for(let i=0;i<100&&!check();i++)await settle();assert(check(),container.textContent);};
 const click=async(name:string)=>{const b=button(name);assert(!b.disabled);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));};
 await ui.React.act(async()=>render());
 return{f,client,calls,queued,delayChange:()=>{deferChange=true;},applyChange:async()=>{const pending=queued.shift();assert(pending);await ui.React.act(async()=>{buffer=pending(buffer);render();});},button,click,wait,settle,container,buffer:()=>buffer,context:()=>context,lost:()=>lost,next:(r:Response)=>next=r,hold:()=>{hold=deferred<Response>();return hold;},replace:async(b:any)=>{buffer=b;await ui.React.act(async()=>render());},contextChange:async(c:any)=>{context=c;await ui.React.act(async()=>render());},session:async(s:any)=>{session=s;await ui.React.act(async()=>render());},project:async()=>{confirmed={...confirmed,projectId:f.otherProject};await ui.React.act(async()=>render());},route:async(show:boolean)=>{shown=show;await ui.React.act(async()=>render());},close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
test('목록 밖 저장 맥락은 명시 GET 한 번 뒤 exact 준비 원명령에 결박·POST 0',async()=>{
 const q=await fixture();try{assert.equal(q.calls.length,0);await q.click('보관 참조 목록 다시 조회');await q.wait(()=>q.calls.length===2&&!q.button(label).disabled);assert.equal(q.buffer().draft.contextBundleRef,null);const n=q.calls.length;await q.click(label);await q.wait(()=>!!q.buffer().draft.contextBundleRef);assert.equal(q.calls.length,n+1);assert.deepEqual(q.buffer().draft.contextBundleRef,q.f.context.ref);await q.click('의도 준비·입력 확인');await q.wait(()=>!!q.buffer().pending);assert.equal(q.buffer().pending.operation,'prepareExecution');assert.deepEqual(q.buffer().pending.payload.contextBundleRef,q.f.context.ref);assert.deepEqual(q.buffer().pending.payload.assignmentRef,q.f.confirmed.ref);assert.equal(q.calls.filter(c=>c.method==='POST').length,0);}finally{await q.close();}
});
for(const kind of ['hash','assignment','budget','project','403','401']as const)test('고정 맥락 거절 · '+kind,async()=>{
 const q=await fixture();try{
  const response=structuredClone(q.f.context);
  if(kind==='hash')response.manifest.unverified.push('변조');
  if(kind==='project')response.projectId=q.f.otherProject;
  if(kind==='assignment'||kind==='budget'){
   const key=kind==='assignment'?'assignmentRef':'budgetRef';response.manifest[key]={...response.manifest[key]!,contentHash:'e'.repeat(64)};response.manifest.preparationInput[key]=response.manifest[key];response.ref.contentHash=contentHash(canonicalJson(response.manifest));
   await q.contextChange({...q.context(),resultRef:response.ref});
  }
  q.next(kind==='401'||kind==='403'?Response.json({code:kind==='401'?'AUTH_REQUIRED':'PROJECT_OPERATION_DENIED'},{status:Number(kind)}):Response.json(response));await q.click(label);await q.wait(()=>q.container.textContent.includes(kind==='401'?'AUTH_REQUIRED':kind==='403'?'PROJECT_OPERATION_DENIED':kind==='hash'?'CONTEXT_INTEGRITY_FAILED':kind==='project'?'RESPONSE_INVALID':'EXECUTION_BINDING_MISMATCH'));
  assert.equal(q.buffer().draft.contextBundleRef,null);assert.equal(q.calls.length,1);assert.equal(q.lost(),kind==='401'?1:0);
 }finally{await q.close();}
});
for(const change of ['USER','PROJECT','CONTEXT_ABA','BUFFER','CLOSE']as const)for(const status of [200,401])test('늦은 '+status+' · '+change+' 뒤 선택·인증소실 0',async()=>{
 const q=await fixture();try{const hold=q.hold(),before=q.buffer(),context=q.context();await q.click(label);assert.equal(q.calls.length,1);
  if(change==='USER')await q.session({...q.f.session,user:{id:q.f.otherUser}});
  if(change==='PROJECT')await q.project();
  if(change==='CONTEXT_ABA'){await q.contextChange(null);await q.contextChange(context);}
  if(change==='BUFFER')await q.replace({...before,draft:{...before.draft,reason:'새 입력'}});
  if(change==='CLOSE'){await q.route(false);await q.route(true);}
  await ui.React.act(async()=>hold.resolve(status===200?Response.json(q.f.context):Response.json({code:'AUTH_REQUIRED'},{status})));for(let i=0;i<6;i++)await q.settle();
  assert.equal(q.buffer().draft.contextBundleRef,null);assert.equal(q.lost(),0);assert.equal(q.calls.length,1);if(change==='BUFFER')assert.equal(q.buffer().draft.reason,'새 입력');
 }finally{await q.close();}
});
test('저장 ref 부재·다른 임무/주체·pending/UNKNOWN은 GET·자동 선택 0',async()=>{
 const q=await fixture();try{const c=q.context(),b=q.buffer();for(const value of [null,{...c,resultRef:null},{...c,assignmentRef:{...c.assignmentRef,contentHash:'d'.repeat(64)}},{...c,ownerClientId:q.f.otherClient},{...c,projectId:q.f.otherProject}]){await q.contextChange(value);assert(!q.container.textContent.includes(label));assert.equal(q.calls.length,0);}
  await q.contextChange(c);const prepared=await prepareExecutionCommand(clientFixture(q.f).client,{...b,draft:{...b.draft,contextBundleRef:q.f.context.ref}},q.f.confirmed as any,q.f.session as any,q.f.report.ref,()=>true);for(const replacement of [{...b,uncertain:true},{...prepared,uncertain:true}]){await q.replace(replacement);assert(q.button(label).disabled);assert.equal(q.buffer(),replacement);assert.equal(q.calls.length,0);}
 }finally{await q.close();}
});
test('중복 클릭은 고정 GET 1 · 실패 후 같은 ref의 명시 재조회만 허용',async()=>{
 const q=await fixture();try{const hold=q.hold();await q.click(label);const b=q.button(label),key=Object.keys(b).find(k=>k.startsWith('__reactProps'))!;await ui.React.act(async()=>{(b as any)[key].onClick();});assert.equal(q.calls.length,1);await ui.React.act(async()=>hold.resolve(Response.json({code:'TEMPORARY_UNAVAILABLE'},{status:503})));await q.wait(()=>!q.button(label).disabled);assert.equal(q.buffer().draft.contextBundleRef,null);assert.equal(q.calls.length,1);await q.click(label);await q.wait(()=>!!q.buffer().draft.contextBundleRef);assert.equal(q.calls.length,2);}finally{await q.close();}
});
test('부모 확정 임무 화면의 저장 맥락 버퍼가 자식 명시 선택에 연결된다',async()=>{
 const f=transferFixture(),session={user:{id:f.draft.projectId},clientId:f.draft.projectId,csrfToken:'c'.repeat(43)},calls:string[]=[],errors:unknown[]=[];
 let context=ui.newContextPreparation(f.confirmed,session,1);context.resultRef=f.context.ref;context.dirty=false;let buffer=ui.newExecutionPreparation(f.confirmed,session);
 const client=new ui.ApiClient(async(path:string)=>{calls.push(path);const key=path.split('/projects/'+f.draft.projectId+'/')[1]!;assert(key in f.responses,key);return Response.json(f.responses[key]);});
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 function render(){root.render(ui.React.createElement(ui.AssignmentContentDecision,{client,session,draft:f.draft,buffer:null,onChange(){},contextBuffer:context,onContextChange(){},executionPreparationBuffer:buffer,onExecutionPreparationChange:(change:any)=>{buffer=change(buffer);render();},owner:true,busy:false,run:(fn:()=>Promise<void>)=>{void fn().catch(e=>errors.push(e));}}));}
 const wait=async(check:()=>boolean)=>{for(let i=0;i<100&&!check();i++)await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});assert(check(),container.textContent+' '+String(errors));};
 const click=async(name:string)=>{const b=nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===name);assert(b,name);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));};
 try{await ui.React.act(async()=>render());assert.equal(calls.length,0);await click('확정 임무 원본 재조회');await wait(()=>container.textContent.includes(label));assert.equal(calls.length,2);assert.equal(buffer.draft.contextBundleRef,null);await click(label);await wait(()=>!!buffer.draft.contextBundleRef);assert.deepEqual(buffer.draft.contextBundleRef,f.context.ref);assert.equal(calls.length,3);assert.deepEqual(errors,[]);}finally{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}
});

async function workWithUnderstanding(q:Awaited<ReturnType<typeof fixture>>, sameContext:boolean):Promise<ExecutionPreparationBuffer>{
 const f=q.f,base=clientFixture(f),original:ExecutionPreparationBuffer=q.buffer();
 const sources=await selectPreparationSources(base.client,f.confirmed as any,
   {roleBindingRef:f.binding.ref,contextBundleRef:f.context.ref,capabilityRef:f.report.ref},f.report.ref,()=>true);
 const originalContext=structuredClone(sources.context);
 if(!sameContext){
  originalContext.manifest.preparationInput.reason='앞서 선택한 동형 참조의 다른 맥락';
  originalContext.ref.contentHash=contentHash(canonicalJson(originalContext.manifest));
 }
 const contextBundleRef=originalContext.ref;
 return {...original,draft:{...original.draft,contextBundleRef,mode:'WORK'},
   sources:{...sources,context:originalContext},understandingSelection:{
    ownerEpoch:ui.normalInitialUnderstandingOwner(q.client,f.session),
    basis:{kind:'NORMAL_UNDERSTANDING_WORK_BASIS',reviewRef:f.report.ref,scope:{projectId:f.confirmed.projectId,executionId:f.report.ref.id,executionGeneration:1},
     preparationRef:f.report.ref,assignmentRef:f.confirmed.ref,roleBindingRef:f.binding.ref,agentSessionRef:f.binding.snapshot.sessionRef,
     contextBundleRef,connectionRef:f.connection.ref,environmentRef:f.environment.ref,responseRef:f.report.ref,requestRef:f.report.ref,
     basisRefs:[f.confirmed.ref],latestInstructionRefs:[]},
   }};
}

for(const sameContext of [true,false])test('저장 맥락 선택은 전체 참조 일치 여부에 따라 WORK 판단을 보존한다 ('+sameContext+')',async()=>{
 const q=await fixture();try{
  const before=await workWithUnderstanding(q,sameContext);
  await q.replace(before);
  assert.match(q.container.textContent,/선택 판단/);
  await q.click(label);
  await q.wait(()=>q.buffer()!==before);
  assert.deepEqual(q.buffer().draft.contextBundleRef,q.f.context.ref);
  assert.deepEqual(q.buffer().understandingSelection,sameContext?before.understandingSelection:undefined);
  assert.deepEqual(before.understandingSelection?.basis.contextBundleRef,before.draft.contextBundleRef);
  assert.equal(q.buffer().sources,null);
  assert.equal(q.buffer().dirty,true);
  assert.deepEqual(q.calls.map(call=>call.method),['GET']);
 }finally{await q.close();}
});

test('이전 저장 맥락 GET의 늦은 성공은 교체한 WORK 입력·판단을 보존한다',async()=>{
 const q=await fixture();try{
  const before=await workWithUnderstanding(q,false);
  await q.replace(before);
  const held=q.hold();await q.click(label);
  const replacement={...before,draft:{...before.draft,reason:'새 사용자 입력'}};
  await q.replace(replacement);
  await ui.React.act(async()=>held.resolve(Response.json(q.f.context)));
  for(let i=0;i<6;i++)await q.settle();
  assert.equal(q.buffer(),replacement);
  assert.deepEqual(q.buffer().understandingSelection,before.understandingSelection);
  assert.deepEqual(q.calls.map(call=>call.method),['GET']);
 }finally{await q.close();}
});

for(const change of ['CURRENT','SAVED_CONTEXT','TRANSPORT'] as const)test('지연 부모 반영은 현재 저장 맥락 조회에만 적용한다 · '+change,async()=>{
 const q=await fixture();try{
  const original=await workWithUnderstanding(q,false);await q.replace(original);
  q.delayChange();
  await q.click(label);
  await q.wait(()=>q.queued.length===1);
  if(change==='SAVED_CONTEXT')await q.contextChange({...q.context()});
  if(change==='TRANSPORT'){
   const transport=q.client.transport;
   q.client.transport=(path:string,init:RequestInit)=>transport(path,init);
  }
  await q.applyChange();
  if(change==='CURRENT'){
   assert.deepEqual(q.buffer().draft.contextBundleRef,q.f.context.ref);
   assert.equal(q.buffer().understandingSelection,undefined);
  }else{
   assert.equal(q.buffer(),original);
   assert.deepEqual(q.buffer().understandingSelection,original.understandingSelection);
  }
  assert.deepEqual(q.calls.map(call=>call.method),['GET']);
 }finally{await q.close();}
});
