import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {documentDraftHash} from '../../../apps/web/src/features/design-trace/editor-api.ts';

/** 실제 ReactDOM의 요소/이벤트/effect를 실행하는 최소 메모리 DOM. 레이아웃·브라우저 보안·시각 검증은 아니다. */
class MemoryNode{
 nodeType:number;nodeName:string;tagName:string;localName:string;namespaceURI='http://www.w3.org/1999/xhtml';parentNode:MemoryNode|null=null;childNodes:MemoryNode[]=[];ownerDocument:any;attributes=new Map<string,string>();style:Record<string,unknown>={};listeners=new Map<string,Function[]>();value='';checked=false;disabled=false;data='';
 constructor(name:string,type=1,owner?:any){this.nodeType=type;this.nodeName=type===1?name.toUpperCase():name;this.tagName=this.nodeName;this.localName=name;this.ownerDocument=owner;}
 get options():MemoryNode[]{return this.childNodes.flatMap(n=>n.tagName==='OPTION'?[n]:n.options);}
 get firstChild():MemoryNode|null{return this.childNodes[0]??null;}get lastChild():MemoryNode|null{return this.childNodes.at(-1)??null;}get nextSibling():MemoryNode|null{const a=this.parentNode?.childNodes;return a?.[a.indexOf(this)+1]??null;}
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
const saved=new Map<string,PropertyDescriptor|undefined>();let ui:any;
const warnings:unknown[][]=[],originalError=console.error;
const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
before(async()=>{
 console.error=(...args:unknown[])=>{warnings.push(args);originalError(...args);};
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/design-trace/WorkPlanLibrary.tsx',import.meta.url));
 const result:any=await build({configFile:false,envFile:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:plan-revision',name:'PlanRevisionTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'history-memory-entry',resolveId(id){if(id.endsWith('virtual:plan-revision'))return '\0plan-revision';},load(id){if(id==='\0plan-revision')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{WorkPlanLibrary}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};export{React,createRoot,WorkPlanLibrary,ApiClient};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const [key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return PlanRevisionTest;')();
});
after(()=>{console.error=originalError;for(const channel of channels){channel.port1.close();channel.port2.close();}for(const[key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);assert.equal(warnings.filter(args=>args.some(x=>String(x).includes('same key'))).length,0,'실제 React 중복 key 경고0');});

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,at='2026-11-17T00:00:00.000Z';
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}
async function fixture(){
 const pid=id(1),docid=id(2),formRef={id:id(3),version:1,contentHash:'c'.repeat(64)},oldRef={id:docid,version:1,contentHash:'a'.repeat(64)},designRef={id:id(4),version:1,contentHash:'d'.repeat(64)},body='선택한 AF04 새 원문';
 const content={body:{artifactId:id(5),bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/markdown;charset=utf-8'},attachments:[],sections:[],sourceRefs:[]};
 const doc={id:docid,version:2,title:'새 계획 원문',contentHash:await documentDraftHash('새 계획 원문',formRef,content,null),formRef,stageNodeRef:null,content,confirmed:false,validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[]};
 const snap={documentRef:oldRef,designRef,screenReviewRefs:[],tasks:[],dependencies:[],reason:'원 계획',issues:[],relationalProjection:'STORED'},plan={ref:{id:id(6),version:3,contentHash:contentHash(canonicalJson(snap))},status:'DRAFT',...snap,executionEvidence:'NOT_CONNECTED',observedAt:at};
 const form={ref:formRef,definition:{scope:'USER_COMMON',formCode:'AF04',name:'계획',purpose:'작성',requiredInputs:[],authorRole:'작성',reviewerRole:'검토',confirmerRole:'사용자',items:[],authoringStandardRef:formRef},authoringStandard:{ref:formRef,content:'기준'},validation:{formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'}};
 const controls={document:async()=>Response.json(doc),head:2},calls:{path:string;method:string}[]=[],prepared:any[]=[],busy:boolean[]=[];let lost=0;
 const transport:typeof fetch=async(path,options)=>{const p=String(path);calls.push({path:p,method:String(options?.method)});assert.equal(options?.method,'GET');
 if(p.includes('/work-plans?'))return Response.json({items:[{ref:plan.ref,status:'DRAFT',title:'보관 계획',documentRef:oldRef,designRef,issueCount:0,updatedAt:at,integrity:'NOT_RECHECKED'}],hasMore:false,nextCursor:null,observedAt:at});
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
 function Parent(p:typeof props){const[starting,setStarting]=ui.React.useState(false);return ui.React.createElement(ui.WorkPlanLibrary,{...p,canPrepare:p.canPrepare&&!starting,onBusy:(b:boolean)=>{p.onBusy(b);setStarting(b);}});}
 const render=async(next=props)=>{props=next;await ui.React.act(async()=>root.render(ui.React.createElement(Parent,props)));};
 const click=async(label:string)=>{const b=button(label);assert(!b.disabled,label+' 활성');await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const settle=async()=>{await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});};
 const change=async(kind:'checkbox'|'number',value:string|boolean)=>{const n=nodes().find(n=>n.tagName==='INPUT'&&((n as any)[Object.keys(n).find(k=>k.startsWith('__reactProps'))!]?.type===kind)&&(kind==='checkbox'||n.getAttribute('aria-label')==='개정할 원문 버전'));assert(n,'입력 '+kind);const key=Object.keys(n).find(k=>k.startsWith('__reactProps'))!;await ui.React.act(async()=>((n as any)[key].onChange({target:{value,checked:value}})));};
 const close=async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);};
 const waitFor=async(check:()=>boolean)=>{for(let n=0;!check()&&n<100;n++)await ui.React.act(async()=>{await new Promise(r=>setTimeout(r,2));});assert(check(),container.textContent);};
 await render();return{client,plan,doc,calls,controls,prepared,busy,lost:()=>lost,text:()=>container.textContent,props:()=>props,render,click,button,change,settle,close,waitFor,open:async()=>{await click('보관 계획 '+plan.ref.id+' 열기');await waitFor(()=>container.textContent.includes('이 계획에서 개정 준비'));}};
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
