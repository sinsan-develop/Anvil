import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {documentDraftHash} from '../../../apps/web/src/features/design-trace/editor-api.ts';
import type {DocumentBuffer} from '../../../apps/web/src/features/design-trace/editor-api.ts';
import {analyzeWorkPlanCards} from '../../../apps/server/modules/traceability/work-plan-card.ts';

/** 실제 ReactDOM의 요소/이벤트/effect를 실행하는 최소 메모리 DOM. 레이아웃·브라우저 보안·시각 검증은 아니다. */
class MemoryNode{
 nodeType:number;nodeName:string;tagName:string;localName:string;namespaceURI='http://www.w3.org/1999/xhtml';parentNode:MemoryNode|null=null;childNodes:MemoryNode[]=[];ownerDocument:any;attributes=new Map<string,string>();style:Record<string,unknown>={};listeners=new Map<string,Function[]>();value='';checked=false;disabled=false;data='';
 constructor(name:string,type=1,owner?:any){this.nodeType=type;this.nodeName=type===1?name.toUpperCase():name;this.tagName=this.nodeName;this.localName=name;this.ownerDocument=owner;}
 get options():MemoryNode[]{return this.childNodes.flatMap(n=>n.tagName==='OPTION'?[n]:n.options);}
 get firstChild():MemoryNode|null{return this.childNodes[0]??null;}get lastChild():MemoryNode|null{return this.childNodes.at(-1)??null;}get nextSibling():MemoryNode|null{const a=this.parentNode?.childNodes;return a?.[a.indexOf(this)+1]??null;}
 get textContent():string{return this.nodeType===3?this.data:this.childNodes.map(n=>n.textContent).join('');}
 get nodeValue():string|null{return this.nodeType===3?this.data:null;}set nodeValue(value:string|null){if(this.nodeType===3)this.data=value??'';}
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
const saved=new Map<string,PropertyDescriptor|undefined>();let ui:any;
const warnings:unknown[][]=[],originalError=console.error;
const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
before(async()=>{
 console.error=(...args:unknown[])=>{warnings.push(args);originalError(...args);};
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/design-trace/WorkPlanLibrary.tsx',import.meta.url));
 const result:any=await build({configFile:false,envFile:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:plan-revision',name:'PlanRevisionTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'history-memory-entry',resolveId(id){if(id.endsWith('virtual:plan-revision'))return '\0plan-revision';},load(id){if(id==='\0plan-revision')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{WorkPlanLibrary}from${JSON.stringify(entry)};import{WorkPlanEditor}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/design-trace/WorkPlanEditor.tsx',import.meta.url)))};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};export{React,createRoot,WorkPlanLibrary,WorkPlanEditor,ApiClient};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const [key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return PlanRevisionTest;')();
});
after(()=>{console.error=originalError;for(const channel of channels){channel.port1.close();channel.port2.close();}for(const[key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);assert.equal(warnings.filter(args=>args.some(x=>String(x).includes('same key'))).length,0,'실제 React 중복 key 경고0');});

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,at='2026-11-17T00:00:00.000Z';
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}
async function fixture(integration=false){
 const pid=id(1),docid=id(2),formRef={id:id(3),version:1,contentHash:'c'.repeat(64)},oldRef={id:docid,version:1,contentHash:'a'.repeat(64)},designRef={id:id(4),version:1,contentHash:'d'.repeat(64)},body='선택한 AF04 새 원문';
 const content={body:{artifactId:id(5),bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/markdown;charset=utf-8'},attachments:[],sections:[],sourceRefs:[]};
 const doc={id:docid,version:2,title:'새 계획 원문',contentHash:await documentDraftHash('새 계획 원문',formRef,content,null),formRef,stageNodeRef:null,content,confirmed:false,validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[]};
 const snap={documentRef:oldRef,designRef,screenReviewRefs:[],tasks:[],dependencies:[],reason:'원 계획',issues:[],relationalProjection:'STORED'},plan={ref:{id:id(6),version:3,contentHash:contentHash(canonicalJson(snap))},status:'DRAFT',...snap,executionEvidence:'NOT_CONNECTED',observedAt:at};
 const form={ref:formRef,definition:{scope:'USER_COMMON',formCode:'AF04',name:'계획',purpose:'작성',requiredInputs:[],authorRole:'작성',reviewerRole:'검토',confirmerRole:'사용자',items:[],authoringStandardRef:formRef},authoringStandard:{ref:formRef,content:'기준'},validation:{formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'}};
 const expectedPayload={documentRef:{id:docid,version:2,contentHash:doc.contentHash},designRef,screenReviewRefs:[],tasks:[],reason:'원 계획'},analysis=analyzeWorkPlanCards(expectedPayload.tasks);
 const storedSnapshot={...expectedPayload,dependencies:analysis.dependencies,issues:[...analysis.issues,{code:'PLAN_DOCUMENT_NOT_CONFIRMED',location:'documentRef',message:'작업계획 원문 미확정'},{code:'DESIGN_NOT_CONFIRMED',location:'designRef',message:'설계 원문 미확정'}],relationalProjection:'STORED'};
 const storedPlan={ref:{id:plan.ref.id,version:4,contentHash:contentHash(canonicalJson(storedSnapshot))},status:'DRAFT',...storedSnapshot};
 const controls={document:async()=>Response.json(doc),head:2,loseFirstResponse:true,receiptFault:'',fixedFault:false},calls:{path:string;method:string}[]=[],prepared:any[]=[],busy:boolean[]=[],writes:{body:string;headers:Headers}[]=[],fixtureErrors:unknown[]=[];
 let lost=0,storedReceipt:any=null,persisted=0,currentBuffer:DocumentBuffer|null=null;
 // RAM transport 기록이다. 서버/DB 수락의 증거가 아니며 실제 Web 명령 검산을 우회하지 않는다.
 const transport:typeof fetch=async(path,options)=>{const p=String(path);calls.push({path:p,method:String(options?.method)});
 if(options?.method==='POST'){
   assert(integration,'조회 전용 시험의 POST 금지');const body=String(options.body),command=JSON.parse(body),headers=new Headers(options.headers);writes.push({body,headers});
   try{assert.equal(p,`/api/v1/projects/${pid}/commands`);assert.equal(command.projectId,pid);assert.equal(command.clientId,id(8));assert.equal(command.controlGeneration,4);assert.equal(command.operation,'saveWorkPlanDraft');assert.equal(command.targetId,plan.ref.id);assert.equal(command.expectedVersion,plan.ref.version);assert.deepEqual(command.payload,expectedPayload);assert.equal(command.approvalRef,null);assert.deepEqual(command.baselineRefs,[]);assert.equal(headers.get('idempotency-key'),command.commandId);assert.equal(headers.get('x-anvil-csrf'),'C'.repeat(43));if(writes.length>1)assert.equal(body,writes[0]!.body);}catch(cause){fixtureErrors.push(cause);throw cause;}
   if(!storedReceipt){persisted++;storedReceipt={commandId:command.commandId,projectId:pid,status:'APPLIED',operationId:id(30),serverReceivedAt:at,targetId:storedPlan.ref.id,version:storedPlan.ref.version,data:{status:'WORK_PLAN_DRAFT_SAVED',ref:storedPlan.ref,workPlan:storedPlan}};}
   if(writes.length===1&&controls.loseFirstResponse)throw new Error('RAM: 저장 응답 전달 유실');
   const receipt=structuredClone(storedReceipt);if(controls.receiptFault==='COMMAND')receipt.commandId=id(31);if(controls.receiptFault==='TARGET')receipt.targetId=id(32);if(controls.receiptFault==='VERSION')receipt.version=5;if(controls.receiptFault==='HASH')receipt.data.ref.contentHash='b'.repeat(64);
   if(controls.receiptFault==='DOCUMENT'){receipt.data.workPlan.documentRef=oldRef;const {ref:ignored,status,...snapshot}=receipt.data.workPlan;const h=contentHash(canonicalJson(snapshot));receipt.data.workPlan.ref.contentHash=h;receipt.data.ref.contentHash=h;}
   return Response.json(receipt);
 }
 assert.equal(options?.method,'GET');
 if(p.includes('/work-plans?'))return Response.json({items:[{ref:plan.ref,status:'DRAFT',title:'보관 계획',documentRef:oldRef,designRef,issueCount:0,updatedAt:at,integrity:'NOT_RECHECKED'}],hasMore:false,nextCursor:null,observedAt:at});
 if(p===`/api/v1/projects/${pid}/work-plans/${plan.ref.id}/versions/4`){assert(storedReceipt,'미저장 v4 GET 금지');return Response.json({...storedPlan,...(controls.fixedFault?{reason:'원문 변조'}:{}),executionEvidence:'NOT_CONNECTED',observedAt:at});}
 if(p.includes('/work-plans/'))return Response.json(plan);
 if(p.includes('/documents?'))return Response.json({items:[{id:docid,title:doc.title,headVersion:controls.head,confirmedVersion:null,updatedAt:at}],hasMore:false,nextCursor:null,observedAt:at});
 if(p.includes('/documents/'))return p.endsWith('/versions/1')?Response.json({...doc,version:1,contentHash:oldRef.contentHash}):controls.document();
 if(p.includes('/files/'))return new Response(Buffer.from(body),{headers:{'content-type':'application/octet-stream'}});
 if(p.includes('/forms/'))return Response.json(form);
 if(p.includes('/design-index?'))return Response.json({documentRef:designRef,items:[],screenRegions:[],status:'NOT_INDEXED',observedAt:at});
 return Response.json({id:pid,participation:'OWNER',controlState:{actorId:id(7),clientId:id(8),generation:4,status:'HELD'}});};
 const client=new ui.ApiClient(transport),container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);let props={client,projectId:pid,session:{user:{id:id(7)},clientId:id(8),csrfToken:'C'.repeat(43)},documents:[],canPrepare:true,onPrepared:(b:any)=>prepared.push(b),onBusy:(b:boolean)=>busy.push(b),onAuthenticationLost:()=>{lost++;}};
 const nodes=(n=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))],button=(label:string)=>{const m=nodes().filter(n=>n.tagName==='BUTTON'&&(n.textContent===label||n.getAttribute('aria-label')===label));assert.equal(m.length,1,'버튼 '+label);return m[0]!;};
 // 실제 상위 DocumentsPage처럼 자신이 요청한 onBusy(true)도 canPrepare=false로 반영한다.
 function Parent(p:typeof props){const[starting,setStarting]=ui.React.useState(false),[buffer,setBuffer]=ui.React.useState(null);currentBuffer=buffer;
  if(integration&&buffer)return ui.React.createElement(ui.WorkPlanEditor,{client:p.client,session:p.session,buffer,documents:p.documents,onChange:setBuffer,onAuthenticationLost:p.onAuthenticationLost});
  return ui.React.createElement(ui.WorkPlanLibrary,{...p,canPrepare:p.canPrepare&&!starting,onPrepared:(b:DocumentBuffer)=>{p.onPrepared(b);if(integration)setBuffer((previous:DocumentBuffer|null)=>previous===null?b:previous);},onBusy:(b:boolean)=>{p.onBusy(b);setStarting(b);}});
 }
 const render=async(next=props)=>{props=next;await ui.React.act(async()=>root.render(ui.React.createElement(Parent,props)));};
 const click=async(label:string)=>{const b=button(label);assert(!b.disabled,label+' 활성');await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const settle=async()=>{await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});};
 const change=async(kind:'checkbox'|'number',value:string|boolean)=>{const n=nodes().find(n=>n.tagName==='INPUT'&&((n as any)[Object.keys(n).find(k=>k.startsWith('__reactProps'))!]?.type===kind)&&(kind==='checkbox'||n.getAttribute('aria-label')==='개정할 원문 버전'));assert(n,'입력 '+kind);const key=Object.keys(n).find(k=>k.startsWith('__reactProps'))!;await ui.React.act(async()=>((n as any)[key].onChange({target:{value,checked:value}})));};
 const close=async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);};
 const waitFor=async(check:()=>boolean)=>{for(let n=0;!check()&&n<100;n++)await ui.React.act(async()=>{await new Promise(r=>setTimeout(r,2));});assert(check(),container.textContent);};
 await render();return{client,plan,doc,calls,controls,prepared,busy,writes,fixtureErrors,storedPlan,expectedPayload,persisted:()=>persisted,buffer:()=>currentBuffer,lost:()=>lost,text:()=>container.textContent,props:()=>props,render,click,button,change,settle,close,waitFor,open:async()=>{await click('보관 계획 '+plan.ref.id+' 열기');await waitFor(()=>container.textContent.includes('이 계획에서 개정 준비'));}};
}
test('명시 버전 입력 전 준비 GET0, 선택 후 같은 계획의 새 AF04 원문을 준비하고 POST0',async()=>{const f=await fixture();try{
 await f.open();await f.change('checkbox',true);await f.change('number','2');assert.equal(f.calls.filter(c=>c.path.endsWith('/documents/'+f.doc.id+'/versions/2')).length,0);
 await f.click('선택한 원문 버전으로 개정 준비');await f.waitFor(()=>f.prepared.length===1);const b=f.prepared[0];assert.equal(b.baseVersion,2);assert.equal(b.baseHash,f.doc.contentHash);assert.deepEqual(b.workPlanState.planRef,f.plan.ref);assert.deepEqual(b.workPlanState.input.documentRef,{id:f.doc.id,version:2,contentHash:f.doc.contentHash});assert.equal(b.workPlanState.pending,null);assert(f.calls.every(c=>c.method==='GET'));assert.deepEqual(f.busy,[true,false]);assert.match(f.text(),/보관 원문.*v1/);
 }finally{await f.close();}});
test('다른 편집 pending 또는 UNKNOWN이 있으면 기존 canPrepare=false가 준비를 막는다',async()=>{const f=await fixture();try{await f.open();await f.change('checkbox',true);await f.change('number','2');await f.render({...f.props(),canPrepare:false});const before=f.calls.length;assert(f.button('선택한 원문 버전으로 개정 준비').disabled);assert(f.button('이 계획에서 개정 준비').disabled);assert.equal(f.prepared.length,0);assert.equal(f.calls.length,before);}finally{await f.close();}});
for(const status of [401,403,409])test('현재 개정 조회 '+status+'는 새 버퍼를 만들지 않는다',async()=>{const f=await fixture();try{await f.open();await f.change('checkbox',true);await f.change('number','2');f.controls.document=async()=>Response.json({code:status===409?'VERSION_CONFLICT':'AUTH_REQUIRED'},{status});await f.click('선택한 원문 버전으로 개정 준비');await f.waitFor(()=>f.busy.at(-1)===false);assert.equal(f.prepared.length,0);assert.equal(f.lost(),status===401?1:0);assert(f.calls.every(c=>c.method==='GET'));}finally{await f.close();}});
for(const change of ['USER','CLIENT_ID','CSRF','PROJECT','CLIENT','TRANSPORT','ABA','CLOSE']as const)for(const status of [200,401])test('개정 지연 '+status+'는 '+change+' 뒤 준비·인증 소실을 만들지 않는다',async()=>{
 const f=await fixture(),gate=deferred<Response>();let closed=false;try{await f.open();await f.change('checkbox',true);await f.change('number','2');let started=false;f.controls.document=()=>{started=true;return gate.promise;};await f.click('선택한 원문 버전으로 개정 준비');await f.waitFor(()=>started);const original=f.props();
 if(change==='USER')await f.render({...original,session:{...original.session,user:{id:id(20)}}});if(change==='CLIENT_ID')await f.render({...original,session:{...original.session,clientId:id(21)}});if(change==='CSRF')await f.render({...original,session:{...original.session,csrfToken:'D'.repeat(43)}});if(change==='PROJECT')await f.render({...original,projectId:id(22)});if(change==='CLIENT')await f.render({...original,client:new ui.ApiClient(original.client.transport)});if(change==='TRANSPORT')f.client.transport=async()=>{throw Error('새 transport로 이어 가지 않음');};if(change==='ABA'){await f.render({...original,projectId:id(22)});await f.render(original);}if(change==='CLOSE'){await f.close();closed=true;}
 gate.resolve(status===200?Response.json(f.doc):Response.json({code:'AUTH_REQUIRED'},{status}));await f.settle();assert.equal(f.prepared.length,0);assert.equal(f.lost(),0);assert(f.calls.every(c=>c.method==='GET'));
 }finally{gate.resolve(Response.json(f.doc));if(!closed)await f.close();}
});

async function prepareEditor(f:Awaited<ReturnType<typeof fixture>>){
 await f.open();await f.change('checkbox',true);await f.change('number','2');await f.click('선택한 원문 버전으로 개정 준비');
 await f.waitFor(()=>f.text().includes('작업계획 작성'));assert.equal(f.writes.length,0);assert.equal(f.buffer()?.baseVersion,2);assert.equal(f.buffer()?.body,'선택한 AF04 새 원문');assert.deepEqual(f.buffer()?.workPlanState?.planRef,f.plan.ref);
}
test('Library→실제 Editor 저장은 P CAS·AF04 v2를 전송하고 응답 유실 뒤 동일 body 재확인→P v4 고정 GET으로 이어진다',async()=>{
 const f=await fixture(true);try{
  await prepareEditor(f);const originalPlan=structuredClone(f.plan),fixedPath=`/api/v1/projects/${id(1)}/work-plans/${f.plan.ref.id}/versions/4`;
  await f.click('작업계획 초안 저장');await f.waitFor(()=>f.buffer()?.workPlanState?.failure?.code==='CONNECTION_LOST');
  assert.deepEqual(f.fixtureErrors,[]);assert.equal(f.writes.length,1);assert.equal(f.persisted(),1);assert.equal(f.buffer()?.workPlanState?.uncertain,true);assert.equal(f.buffer()?.workPlanState?.result,null);assert(!f.text().includes('작업계획 초안 저장 확인'));assert(f.button('작업계획 작성 닫기').disabled);assert.equal(f.calls.filter(c=>c.path===fixedPath).length,0);
  const pending=structuredClone(f.buffer()!.workPlanState!.pending),command=JSON.parse(f.writes[0]!.body);
  assert.equal(command.targetId,f.plan.ref.id);assert.equal(command.expectedVersion,3);assert.deepEqual(command.payload,f.expectedPayload);assert.deepEqual(command,pending);
  await f.click('같은 작업계획 명령 결과 확인');await f.waitFor(()=>!!f.buffer()?.workPlanState?.result);
  assert.deepEqual(f.fixtureErrors,[]);assert.equal(f.writes.length,2);assert.equal(f.writes[1]!.body,f.writes[0]!.body);assert.equal(f.persisted(),1);assert.equal(f.buffer()?.workPlanState?.uncertain,false);assert.deepEqual(f.buffer()?.workPlanState?.pending,pending);assert.deepEqual(f.buffer()?.workPlanState?.result?.ref,f.storedPlan.ref);assert.match(f.text(),/작업계획 초안 저장 확인/);assert(!f.text().includes('저장한 버전 재조회 확인'));assert.equal(f.calls.filter(c=>c.path===fixedPath).length,0,'저장 성공 후 자동 재조회0');
  await f.click('저장한 작업계획 재조회');await f.waitFor(()=>f.text().includes('저장한 버전 재조회 확인'));
  assert.equal(f.calls.filter(c=>c.path===fixedPath&&c.method==='GET').length,1);assert.deepEqual(f.buffer()?.workPlanState?.result,{...f.storedPlan,executionEvidence:'NOT_CONNECTED',observedAt:at});assert.equal(f.writes.length,2);assert.deepEqual(f.plan,originalPlan);assert.equal(f.lost(),0);
 }finally{await f.close();}
});
for(const fault of ['COMMAND','TARGET','VERSION','HASH','DOCUMENT'])test('실제 Editor는 '+fault+' 영수증을 P 개정 성공으로 표시하지 않고 원 명령을 보존한다',async()=>{
 const f=await fixture(true);try{
  f.controls.loseFirstResponse=false;f.controls.receiptFault=fault;await prepareEditor(f);await f.click('작업계획 초안 저장');await f.waitFor(()=>!!f.buffer()?.workPlanState?.failure);
  assert.deepEqual(f.fixtureErrors,[]);assert.equal(f.writes.length,1);assert.equal(f.persisted(),1);assert.equal(f.buffer()?.workPlanState?.result,null);assert.equal(f.buffer()?.workPlanState?.uncertain,true);assert.deepEqual(f.buffer()?.workPlanState?.pending,JSON.parse(f.writes[0]!.body));assert(!f.text().includes('작업계획 초안 저장 확인'));assert(!f.calls.some(c=>c.path.endsWith(`/work-plans/${f.plan.ref.id}/versions/4`)));assert.equal(f.lost(),0);
 }finally{await f.close();}
});
test('성공 영수증 뒤 변조된 P v4 GET은 재조회 확인이 아니며 원 영수증 결과를 보존한다',async()=>{
 const f=await fixture(true);try{f.controls.loseFirstResponse=false;await prepareEditor(f);await f.click('작업계획 초안 저장');await f.waitFor(()=>!!f.buffer()?.workPlanState?.result);const saved=structuredClone(f.buffer()!.workPlanState!.result);f.controls.fixedFault=true;await f.click('저장한 작업계획 재조회');await f.waitFor(()=>f.buffer()?.workPlanState?.failure?.code==='WORK_PLAN_INTEGRITY_FAILED');assert(!f.text().includes('저장한 버전 재조회 확인'));assert.deepEqual(f.buffer()?.workPlanState?.result,saved);assert.equal(f.writes.length,1);assert.deepEqual(f.fixtureErrors,[]);}finally{await f.close();}
});
