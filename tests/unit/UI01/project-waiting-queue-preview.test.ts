import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
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
const saved=new Map<string,PropertyDescriptor|undefined>();let ui:any;
const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
before(async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/projects/ProjectsPage.tsx',import.meta.url));
 const result:any=await build({configFile:false,envFile:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:queue-preview',name:'QueuePreviewTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'queue-memory-entry',resolveId(id){if(id.endsWith('virtual:queue-preview'))return '\0queue-preview';},load(id){if(id==='\0queue-preview')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{ProjectListResults}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};export{React,createRoot,ProjectListResults,ApiClient};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return QueuePreviewTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,pid=id(10),at='2026-11-21T00:00:00.000Z';
const session={user:{id:id(1)},clientId:id(2),csrfToken:'a'.repeat(43)};
const reasons=['ASSIGNMENT_BINDING_UNVERIFIED','BASELINE_STATE_UNVERIFIED','EXECUTION_STATE_UNVERIFIED','DISPATCH_NOT_CONNECTED'];
function queue(projectId=pid){return{projectId,items:[{requestRef:{id:id(30),version:1,contentHash:'b'.repeat(64)},state:'WAITING',sequence:7,reasonCodes:reasons,blockedBy:[],reservedBudgetRef:null}],selection:'WAITING_ONLY',cancelledHistoryOmitted:true,observedAt:at,writerReservationPerformed:false,executionAuthorized:false,dispatchPerformed:false};}
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}
async function fixture(){
 const calls:string[]=[],controls={reply:async(_path:string):Promise<Response>=>Response.json(queue())};let lost=0;
 const client=new ui.ApiClient(async(path:string,options:any)=>{assert.equal(options.method,'GET');calls.push(String(path));return controls.reply(String(path));});
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 let props:any={client,membership:{session:structuredClone(session),buffers:{},onChange:()=>false,onApproval:()=>false},pending:false,error:null,onAuthenticationLost:()=>lost++,snapshot:{client,query:'',archived:false,refresh:0,cursor:null,current:true,itemObservedAt:{[pid]:at,[id(11)]:at},page:{items:[{id:pid,name:'첫 프로젝트',purpose:'목적',version:1,updatedAt:at},{id:id(11),name:'둘째 프로젝트',purpose:'목적',version:1,updatedAt:at}],nextCursor:null,hasMore:false,observedAt:at,baselineVersion:null}}};
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))],button=(label:string)=>{const found=nodes().filter(n=>n.tagName==='BUTTON'&&n.textContent===label);assert.equal(found.length,1,'버튼 '+label);return found[0]!;};
 const render=async(next=props)=>{props=next;await ui.React.act(async()=>root.render(ui.React.createElement(ui.ProjectListResults,props)));};
 const click=async(label:string)=>{const b=button(label);assert(!b.disabled);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const settle=async()=>{await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});};
 await render();return{client,calls,controls,button,nodes,render,click,settle,text:()=>container.textContent,props:()=>props,lost:()=>lost,close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
test('프로젝트 두 카드 렌더 GET0, 명시 클릭한 카드만 기존 queue GET1과 저장 근거를 표시한다',async()=>{
 const f=await fixture();try{assert.equal(f.calls.length,0);await f.click('첫 프로젝트 단계 시작 대기 요청 조회');assert.deepEqual(f.calls,[`/api/v1/projects/${pid}/queue`]);assert.match(f.text(),/서버 순번7/);assert.match(f.text(),new RegExp(id(30)));assert.match(f.text(),/b{64}/);assert.match(f.text(),/현재 실행 단계·다음 행동: 미확인/);assert.match(f.text(),/저장된 사유/);assert.match(f.text(),/서버 관측/);}finally{await f.close();}
});

test('정상 빈 응답·미확인·413·권한 실패를 구분하고 현재401만 인증 상실을 알린다',async()=>{
 for(const fault of ['EMPTY','INVALID','OTHER_PROJECT','CONNECTION','413','401','403','404']){
  const f=await fixture();try{
   await f.click('첫 프로젝트 단계 시작 대기 요청 조회');assert.match(f.text(),new RegExp(id(30)));
   f.controls.reply=async()=>{
    if(fault==='CONNECTION')throw Error('PRIVATE_TRANSPORT');
    if(fault==='EMPTY')return Response.json({...queue(),items:[]});
    if(fault==='INVALID')return Response.json({...queue(),dispatchPerformed:true});
    if(fault==='OTHER_PROJECT')return Response.json(queue(id(11)));
    return Response.json({code:fault==='413'?'QUEUE_VIEW_LIMIT_EXCEEDED':'AUTH_REQUIRED'},{status:Number(fault)});
   };
   await f.click('첫 프로젝트 단계 시작 대기 요청 다시 조회');assert(!f.text().includes(id(30)));assert.equal(f.calls.length,2);
   if(fault==='EMPTY')assert.match(f.text(),/이번 응답에 저장된 단계 시작 대기 요청이 없습니다/);
   else{assert(!f.text().includes('이번 응답에 저장된 단계 시작 대기 요청이 없습니다'));assert(!f.text().includes('이번 응답 0건'));assert(f.nodes().some(n=>n.getAttribute('role')==='alert'));}
   if(fault==='413')assert.match(f.text(),/조회 한도를 넘어/);assert.equal(f.lost(),fault==='401'?1:0);assert(!f.text().includes('PRIVATE'));
  }finally{await f.close();}
 }
});

test('같은 배치의 중복 클릭은 GET1, 닫기 후 늦은 응답은 폐기하고 새 명시 조회만 연다',async()=>{
 const f=await fixture(),gate=deferred<unknown>();try{
  f.controls.reply=async()=>{const r=Response.json(queue());r.json=()=>gate.promise;return r;};
  const button=f.button('첫 프로젝트 단계 시작 대기 요청 조회');await ui.React.act(async()=>{button.dispatchEvent({type:'click',button:0,bubbles:true});button.dispatchEvent({type:'click',button:0,bubbles:true});});assert.equal(f.calls.length,1);
  assert(f.button('첫 프로젝트 단계 시작 대기 요청 다시 조회').disabled);await f.click('단계 시작 대기 요청 닫기');gate.resolve(queue());await f.settle();assert(!f.text().includes(id(30)));
  f.controls.reply=async()=>Response.json(queue());await f.click('첫 프로젝트 단계 시작 대기 요청 조회');assert.equal(f.calls.length,2);assert.match(f.text(),new RegExp(id(30)));
 }finally{gate.resolve(queue());await f.close();}
});

test('목록 current·pending·새로고침·project·client·세션 교체/ABA 뒤 old200·401은 채택하지 않는다',async()=>{
 for(const status of [200,401])for(const change of ['CURRENT','PENDING','REFRESH','PROJECT','CLIENT','SESSION','USER','CLIENT_ID','TRANSPORT']){
  const f=await fixture(),gate=deferred<unknown>();try{
   const value=status===200?queue():{code:'AUTH_REQUIRED'};f.controls.reply=async()=>{const r=Response.json(value,{status});r.json=()=>gate.promise;return r;};await f.click('첫 프로젝트 단계 시작 대기 요청 조회');const props=f.props();
   if(change==='CURRENT'){await f.render({...props,snapshot:{...props.snapshot,current:false}});await f.render(props);}
   if(change==='PENDING'){await f.render({...props,pending:true});await f.render(props);}
   if(change==='REFRESH')await f.render({...props,snapshot:{...props.snapshot,refresh:1}});
   if(change==='PROJECT')await f.render({...props,snapshot:{...props.snapshot,page:{...props.snapshot.page,items:[{...props.snapshot.page.items[0],id:id(12)}]}}});
   if(change==='CLIENT'){const client=new ui.ApiClient(async()=>Response.json(queue()));await f.render({...props,client,snapshot:{...props.snapshot,client}});}
   if(['SESSION','USER','CLIENT_ID'].includes(change)){const old=props.membership.session,newSession={...old,user:{...old.user}};if(change==='SESSION')newSession.csrfToken='c'.repeat(43);if(change==='USER')newSession.user.id=id(3);if(change==='CLIENT_ID')newSession.clientId=id(4);await f.render({...props,membership:{...props.membership,session:newSession}});await f.render(props);}
   if(change==='TRANSPORT'){const old=f.client.transport;f.client.transport=async()=>Response.json(queue());await f.render();f.client.transport=old;await f.render();}
   gate.resolve(value);await f.settle();assert.equal(f.lost(),0,change);assert(!f.text().includes(id(30)),change);assert(!f.text().includes('AUTH_REQUIRED'),change);assert.equal(f.calls.length,1);
   assert(!f.button('첫 프로젝트 단계 시작 대기 요청 조회').disabled);
  }finally{gate.resolve(queue());await f.close();}
 }
});

test('무렌더 transport 교체·화면 이탈 후 늦은401은 callback0이고 기존 결과도 다음 문맥에 숨긴다',async()=>{
 for(const change of ['TRANSPORT','UNMOUNT']){const f=await fixture(),gate=deferred<unknown>();let closed=false;try{
  f.controls.reply=async()=>{const r=Response.json({code:'AUTH_REQUIRED'},{status:401});r.json=()=>gate.promise;return r;};await f.click('첫 프로젝트 단계 시작 대기 요청 조회');
  if(change==='TRANSPORT')f.client.transport=async()=>Response.json(queue());else{await f.close();closed=true;}
  gate.resolve({code:'AUTH_REQUIRED'});await f.settle();assert.equal(f.lost(),0);assert.equal(f.calls.length,1);assert(!f.text().includes('AUTH_REQUIRED'));
 }finally{gate.resolve({code:'AUTH_REQUIRED'});if(!closed)await f.close();}}
 const f=await fixture();try{await f.click('첫 프로젝트 단계 시작 대기 요청 조회');assert.match(f.text(),new RegExp(id(30)));const p=f.props();await f.render({...p,membership:{...p.membership,session:{...p.membership.session,csrfToken:'d'.repeat(43)}}});assert(!f.text().includes(id(30)));assert.equal(f.calls.length,1);}finally{await f.close();}
});

test('조회 문맥이 잠긴 카드와 session 없는 카드는 명시 요청도 보내지 않는다',async()=>{
 const f=await fixture();try{const p=f.props();for(const next of [{...p,pending:true},{...p,snapshot:{...p.snapshot,current:false}},{...p,membership:undefined}]){await f.render(next);const button=f.button('첫 프로젝트 단계 시작 대기 요청 조회');assert(button.disabled);await ui.React.act(async()=>button.dispatchEvent({type:'click',button:0,bubbles:true}));assert.equal(f.calls.length,0);}}finally{await f.close();}
});
