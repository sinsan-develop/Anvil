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
 const path=(name:string)=>JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/'+name,import.meta.url)));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:document-origin',name:'DocumentOriginTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'document-origin-memory',resolveId(id){if(id.endsWith('virtual:document-origin'))return '\0document-origin';},load(id){if(id==='\0document-origin')return `export * as React from 'react';export{createRoot}from'react-dom/client';export{KnowledgeDocumentSources}from${path('features/knowledge/KnowledgeDocumentSources.tsx')};export{ApiClient}from${path('api/client.ts')};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const [key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 uiCode=(Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return DocumentOriginTest;';ui=new Function(uiCode)();
});
after(()=>{for(const channel of channels){channel.port1.close();channel.port2.close();}for(const[key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});


const id=(n:number)=>'11a05921-1111-4111-8111-'+String(n).padStart(12,'0');
const pid=id(1),uid=id(2),cid=id(3),kid=id(4),did=id(5),aid=id(6),at='2026-11-27T00:00:00.000Z';
const body='고정 출처 원문 <script>text</script>',knowledgeBody='정확 지식 원문',formRef={id:id(7),version:1,contentHash:'b'.repeat(64)};
const artifact={artifactId:aid,bytes:Buffer.byteLength(body),contentHash:contentHash(body),mediaType:'text/markdown;charset=utf-8'};
const source={kind:'DOCUMENT_VERSION',id:did,version:1,contentHash:'a'.repeat(64)};
const entry={kind:'FACT',title:'관측 원문',contentRef:{...artifact,bytes:Buffer.byteLength(knowledgeBody),contentHash:contentHash(knowledgeBody)},sourceRefs:[source],reason:'당시 원문',scope:{projectId:pid,stageRefs:[],taskRefs:[]},relatedRefs:[]};
const view={ref:{id:kid,version:1,contentHash:contentHash(canonicalJson(entry))},entry,body:knowledgeBody,state:'PROPOSED',headVersion:1,supersedesRef:null,appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',agentDelivery:'NOT_CONNECTED',history:[{id:aid,kind:'PROPOSED',reason:entry.reason,actorRef:{kind:'HUMAN',userId:uid},recordedAt:at}]};
const original={id:did,version:1,contentHash:source.contentHash,title:'고정 문서',formRef,confirmed:false,stageNodeRef:null,content:{body:artifact,attachments:[],sections:[],sourceRefs:[]},validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[]};
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return{promise,resolve};}
async function fixture(){
 const sentA:string[]=[],sentB:string[]=[],held=deferred<Response>();
 let lost=0;
 async function respond(calls:string[],input:string,init?:RequestInit){assert.equal(init?.method,'GET');calls.push(input);
  if(input.includes('/knowledge/'))return calls===sentA&&calls.length===1?held.promise:Response.json(view);
  if(input.includes('/documents/'))return Response.json(original);
  if(input.includes('/files/'))return new Response(body,{headers:{'content-type':'application/octet-stream'}});
  assert.fail(input);
 }
 const transportA=(input:string,init?:RequestInit)=>respond(sentA,input,init),transportB=(input:string,init?:RequestInit)=>respond(sentB,input,init);
 const client=new ui.ApiClient(transportA),container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 let props={client,projectId:pid,session:{user:{id:uid},clientId:cid,csrfToken:'C'.repeat(43)},view,onAuthenticationLost:()=>{lost++;}};
 const render=async(next=props)=>{props=next;await ui.React.act(async()=>root.render(ui.React.createElement(ui.KnowledgeDocumentSources,props)));};
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 const find=(label:string)=>nodes().find(n=>n.tagName==='BUTTON'&&(n.getAttribute('aria-label')===label||n.textContent===label));
 const click=async(label:string)=>{const n=find(label);assert(n,label);await ui.React.act(async()=>n.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const waitFor=async(predicate:()=>boolean)=>{for(let i=0;!predicate()&&i<100;i++)await ui.React.act(async()=>{await new Promise(r=>setTimeout(r,2));});assert(predicate());};
 const settle=()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});
 const close=async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);};
 await render();
 return {sentA,sentB,held,client,transportA,transportB,container,waitFor,settle,render,props:()=>props,lost:()=>lost,click,find,close};
}
const open='문서 출처 1 원문 보기';
for(const status of [200,401])test('동일 ApiClient의 transport 교체 뒤 이전 '+status+'는 새 조회·인증에 영향을 주지 않는다',async()=>{
 const f=await fixture();try{
  assert.equal(f.sentA.length,0);
  await f.click(open);assert.equal(f.sentA.length,1);
  f.client.transport=f.transportB;
  await ui.React.act(async()=>f.held.resolve(status===200?Response.json(view):Response.json({code:'AUTH_REQUIRED'},{status})));
  await f.settle();
  assert.equal(f.sentB.length,0);assert.equal(f.lost(),0);assert(!f.container.textContent.includes(body));
  await f.render();
  assert.equal(f.sentB.length,0);
  await f.click(open);await f.waitFor(()=>f.container.textContent.includes(body));
  assert.deepEqual(f.sentB,[`/api/v1/projects/${pid}/knowledge/${kid}/versions/1`,`/api/v1/projects/${pid}/documents/${did}/versions/1`,`/api/v1/projects/${pid}/files/${aid}`]);
 }finally{await f.close();}
});

for(const change of ['CLOSE','RESELECT','VIEW','CSRF_ABA','TRANSPORT_ABA','UNMOUNT'] as const)test('이전 문서의 지연 401은 '+change+' 뒤 현재 보기에 전달되지 않는다',async()=>{
 const f=await fixture();let closed=false;
 try{
  const previous=f.props(),button=f.find(open);assert(button);
  const key=Object.keys(button).find(k=>k.startsWith('__reactProps'))!;
  const staleOpen=(button as any)[key].onClick as ()=>void;
  await f.click(open);
  if(change==='CLOSE')await f.click('출처 원문 닫기');
  if(change==='RESELECT'){
   await f.click(open);
   await f.waitFor(()=>f.container.textContent.includes(body));
  }
  if(change==='VIEW')await f.render({...previous,view:{...view,ref:{...view.ref,version:2}}});
  if(change==='CSRF_ABA'){
   await f.render({...previous,session:{...previous.session,csrfToken:'D'.repeat(43)}});
   await f.render(previous);
  }
  if(change==='TRANSPORT_ABA'){
   f.client.transport=f.transportB;await f.render();
   f.client.transport=f.transportA;await f.render();
  }
  if(change==='UNMOUNT'){await f.close();closed=true;}
  const readCount=f.sentA.length;
  await ui.React.act(async()=>f.held.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401})));
  await f.settle();
  if(['VIEW','CSRF_ABA','TRANSPORT_ABA','UNMOUNT'].includes(change))await ui.React.act(async()=>staleOpen());
  assert.equal(f.lost(),0);assert.equal(f.sentA.length,readCount);assert.equal(f.sentB.length,0);
  assert.equal(f.container.textContent.includes(body),change==='RESELECT');
 }finally{if(!closed)await f.close();}
});

test('현재 401은 인증소실을 전달하고 명시적인 원문 재열기를 유지한다',async()=>{
 const f=await fixture();try{
  await f.click(open);
  await ui.React.act(async()=>f.held.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401})));
  await f.waitFor(()=>f.lost()===1);
  assert.equal(f.sentA.length,1);assert(!f.container.textContent.includes(body));
  await f.click(open);await f.waitFor(()=>f.container.textContent.includes(body));
  assert.equal(f.sentA.length,4);assert.equal(f.lost(),1);
 }finally{await f.close();}
});
