import test,{after,before} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

const id=(n:number)=>'92000000-0000-4000-8000-'+String(n).padStart(12,'0'),pid=id(1),uid=id(2),cid=id(3),at='2026-11-27T00:00:00.000Z';
class MemoryNode{
 nodeType:number;nodeName:string;tagName:string;localName:string;namespaceURI='http://www.w3.org/1999/xhtml';parentNode:MemoryNode|null=null;childNodes:MemoryNode[]=[];ownerDocument:any;attributes=new Map<string,string>();style:Record<string,unknown>={};listeners=new Map<string,Function[]>();value='';checked=false;disabled=false;data='';
 constructor(name:string,type=1,owner?:any){this.nodeType=type;this.nodeName=type===1?name.toUpperCase():name;this.tagName=this.nodeName;this.localName=name;this.ownerDocument=owner;}
 get firstChild():MemoryNode|null{return this.childNodes[0]??null;}get lastChild():MemoryNode|null{return this.childNodes.at(-1)??null;}get nextSibling():MemoryNode|null{const a=this.parentNode?.childNodes;return a?.[a.indexOf(this)+1]??null;}
 get nodeValue(){return this.nodeType===3?this.data:null;}set nodeValue(v:string|null){if(this.nodeType===3)this.data=v??'';}
 get textContent():string{return this.nodeType===3?this.data:this.childNodes.map(n=>n.textContent).join('');}set textContent(v:string){if(this.nodeType===3){this.data=String(v);return;}for(const n of this.childNodes)n.parentNode=null;this.childNodes=[];if(v)this.appendChild(this.ownerDocument.createTextNode(String(v)));}
 appendChild(n:MemoryNode){if(n.parentNode)n.parentNode.removeChild(n);n.parentNode=this;this.childNodes.push(n);return n;}insertBefore(n:MemoryNode,b:MemoryNode){if(n.parentNode)n.parentNode.removeChild(n);n.parentNode=this;const i=this.childNodes.indexOf(b);assert(i>=0);this.childNodes.splice(i,0,n);return n;}removeChild(n:MemoryNode){const i=this.childNodes.indexOf(n);assert(i>=0);this.childNodes.splice(i,1);n.parentNode=null;return n;}
 setAttribute(k:string,v:unknown){this.attributes.set(k,String(v));if(k==='disabled')this.disabled=true;}removeAttribute(k:string){this.attributes.delete(k);if(k==='disabled')this.disabled=false;}getAttribute(k:string){return this.attributes.get(k)??null;}
 addEventListener(k:string,f:Function){this.listeners.set(k,[...(this.listeners.get(k)??[]),f]);}removeEventListener(k:string,f:Function){this.listeners.set(k,(this.listeners.get(k)??[]).filter(v=>v!==f));}contains(n:MemoryNode|null):boolean{return !!n&&(n===this||this.childNodes.some(c=>c.contains(n)));}focus(){this.ownerDocument.activeElement=this;}
 dispatchEvent(e:any){e.target=this;e.preventDefault??=()=>{e.defaultPrevented=true;};e.stopPropagation??=()=>{e.cancelBubble=true;};const chain:MemoryNode[]=[];for(let n:MemoryNode|null=this;n;n=n.parentNode)chain.push(n);for(const n of chain)for(const f of n.listeners.get(e.type)??[])f(e);return !e.defaultPrevented;}
}
const document:any=new MemoryNode('#document',9);document.ownerDocument=document;document.createElement=(n:string)=>new MemoryNode(n,1,document);document.createElementNS=(_ns:string,n:string)=>document.createElement(n);document.createTextNode=(s:string)=>{const n=new MemoryNode('#text',3,document);n.data=s;return n;};document.documentElement=document.createElement('html');document.body=document.createElement('body');document.documentElement.appendChild(document.body);document.activeElement=document.body;
const saved=new Map<string,PropertyDescriptor|undefined>();let ui:any;const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
before(async()=>{
 const page=fileURLToPath(new URL('../../../apps/web/src/features/workspace/WorkspacePage.tsx',import.meta.url)),api=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:workspace-policy',name:'WorkspacePolicyTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'workspace-policy-memory',resolveId(value){if(value.endsWith('virtual:workspace-policy'))return '\0workspace-policy';},load(value){if(value==='\0workspace-policy')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{WorkspacePage}from${JSON.stringify(page)};import{ApiClient}from${JSON.stringify(api)};export{React,createRoot,WorkspacePage,ApiClient};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return WorkspacePolicyTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);assert.equal(document.body.childNodes.length,0);});
const project=(projectId:string)=>({id:projectId,name:'권한 정책 프로젝트',purpose:'보호 정책 확인',desiredOutcome:'명시 조회',version:1,createdAt:at,updatedAt:at,currentMethodologyRef:null,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[{code:'PERMISSION_POLICY_UNCONFIGURED'}],viewerPermissions:['READ_PROJECT'],participation:'VIEWER',controlState:{actorId:null,clientId:null,generation:null,status:'UNASSIGNED'}});
const policy=(projectId:string)=>{const body={rules:[
 {ruleId:'AUTO_RULE',subjectRef:{kind:'HUMAN',userId:uid},operations:['readProject'],targetScopes:[{kind:'PROJECT',projectId}],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'},
 {ruleId:'DENY_RULE',subjectRef:{kind:'HUMAN',userId:uid},operations:['saveProject'],targetScopes:[{kind:'PROJECT',projectId}],disposition:'DENY',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'},
 {ruleId:'APPROVAL_RULE',subjectRef:{kind:'HUMAN',userId:uid},operations:['runProject'],targetScopes:[{kind:'PROJECT',projectId}],disposition:'REQUIRE_APPROVAL',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}],reason:'저장된 현재 정책',reviewRefs:[]};return{configured:true,policy:{...body,ref:{id:id(9),version:1,contentHash:contentHash(canonicalJson(body))},createdAt:at}};};
const deferred=<T>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};};
async function fixture(){
 const calls:{path:string;method:string;transport:number}[]=[];let policyReply:()=>Promise<Response>|Response=()=>Response.json(policy(pid)),transportNumber=1,lost=0,props:any;
 const makeTransport=(number:number)=>(async(path:string,init:RequestInit)=>{calls.push({path:String(path),method:init?.method??'GET',transport:number});if(String(path).endsWith('/permission-policy'))return policyReply();const match=String(path).match(/^\/api\/v1\/projects\/([^/]+)$/);if(match)return Response.json(project(match[1]!));if(String(path).endsWith('/methodology-application')){const projectId=String(path).split('/')[4]!;return Response.json({projectId,applicationRef:null,snapshot:null,observedAt:at,executionState:'NOT_CONNECTED'});}throw Error('UNEXPECTED_PATH '+path);}) as typeof fetch;
 let client=new ui.ApiClient(makeTransport(transportNumber)),session={user:{id:uid},clientId:cid,csrfToken:'c'.repeat(43)};const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 props={client,projectId:pid,session,assignmentBuffer:null,onAssignmentChange:()=>assert.fail('assignment change'),conversationBuffer:null,onConversationChange:()=>assert.fail('conversation change'),onAuthenticationLost:()=>lost++};
 const render=async(next:Partial<typeof props>={})=>{props={...props,...next};await ui.React.act(async()=>root.render(ui.React.createElement(ui.WorkspacePage,props)));};
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))],button=(label:string)=>{const found=nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===label);assert(found,label+' / '+container.textContent);return found;};
 const settle=()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));}),wait=async(check:()=>boolean)=>{for(let n=0;!check()&&n<150;n++)await settle();assert(check(),container.textContent);},click=async(label:string)=>{const target=button(label);assert.equal(target.disabled,false,label);await ui.React.act(async()=>target.dispatchEvent({type:'click',button:0,bubbles:true}));await settle();};
 await render();await wait(()=>container.textContent.includes('권한 정책 프로젝트'));
 return{calls,container,nodes,button,click,render,settle,wait,text:()=>container.textContent,lost:()=>lost,setReply(value:()=>Promise<Response>|Response){policyReply=value;},sameSession(){session={...session,user:{...session.user}};return render({session});},changeUser(){session={...session,user:{id:id(20)}};return render({session});},changeSessionClient(){session={...session,clientId:id(21)};return render({session});},changeProject(){return render({projectId:id(30)});},changeClient(){client=new ui.ApiClient(makeTransport(++transportNumber));return render({client});},changeTransport(){client.transport=makeTransport(++transportNumber);return render({client});},async close(){await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}

test('작업 화면은 명시 클릭만 기존 정책 GET1을 열고 저장 AUTO/DENY/REQUIRE_APPROVAL·미구성을 실행허가 없이 표시한다',async()=>{
 const f=await fixture();try{
  assert.equal(f.calls.filter(c=>c.path.endsWith('/permission-policy')).length,0);await f.sameSession();assert.equal(f.calls.filter(c=>c.path.endsWith('/permission-policy')).length,0,'재렌더 자동 정책 조회0');
  await f.click('현재 권한 정책 조회');await f.wait(()=>f.text().includes('정의상 허용'));assert.match(f.text(),/정의상 허용/);assert.match(f.text(),/정의상 거절/);assert.match(f.text(),/정의상 별도 승인/);assert.match(f.text(),/현재 행동을 허용한다고 판정하지 않습니다/);
  assert.equal(f.calls.filter(c=>c.path.endsWith('/permission-policy')).length,1);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
  f.setReply(()=>Response.json({configured:false,policy:null}));await f.click('현재 권한 정책 조회');await f.wait(()=>f.text().includes('현재 권한 정책이 설정되지 않았습니다.'));assert.equal(f.calls.filter(c=>c.path.endsWith('/permission-policy')).length,2);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
 }finally{await f.close();}
});

test('project·client·session·transport·닫기·unmount 뒤 늦은 200/401은 폐기하고 현재 401만 인증 상실이다',async()=>{
 for(const kind of ['project','client','user','sessionClient','transport','close','unmount'] as const)for(const status of [200,401]){
  const f=await fixture();let closed=false;try{
   const gate=deferred<Response>();f.setReply(()=>gate.promise);await f.click('현재 권한 정책 조회');assert.equal(f.calls.filter(c=>c.path.endsWith('/permission-policy')).length,1);
   if(kind==='project')await f.changeProject();else if(kind==='client')await f.changeClient();else if(kind==='user')await f.changeUser();else if(kind==='sessionClient')await f.changeSessionClient();else if(kind==='transport')await f.changeTransport();else if(kind==='close')await f.click('현재 권한 정책 닫기');else{await f.close();closed=true;}
   await ui.React.act(async()=>gate.resolve(status===200?Response.json(policy(pid)):Response.json({code:'AUTH_REQUIRED'},{status:401})));await f.settle();
   if(!closed){assert(!f.text().includes('정의상 허용'),kind);assert.equal(f.lost(),0,kind);assert.equal(f.calls.filter(c=>c.path.endsWith('/permission-policy')).length,1);}
  }finally{if(!closed)await f.close();}
 }
 const current=await fixture();try{current.setReply(()=>Response.json({code:'AUTH_REQUIRED'},{status:401}));await current.click('현재 권한 정책 조회');await current.wait(()=>current.text().includes('현재 권한 정책을 확인하지 못했습니다.'));assert.equal(current.lost(),1);assert.equal(current.calls.filter(c=>c.path.endsWith('/permission-policy')).length,1);}finally{await current.close();}
});
