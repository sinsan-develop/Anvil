import assert from 'node:assert/strict';
import test,{before,after} from 'node:test';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import { contentHash, canonicalJson } from '../../../contracts/canonical.ts';
import { ApiClient, ApiError } from '../../../apps/web/src/api/client.ts';
const subject:any=await import('../../../apps/web/src/features/workspace/assignment-confirmation-api.ts');
const pid='11111111-1111-4111-8111-111111111111',parentId='22222222-2222-4222-8222-222222222222',at='2026-10-21T01:00:00Z';
const ref={id:pid,version:1,contentHash:'a'.repeat(64)};
function fixture(){
 const definition={taskRef:{planRef:ref,taskCode:'FN01',applicationRef:ref,nodeId:'N1'},purpose:'원 목적',goal:'부모 목표',baselineRefs:[ref],inputs:['입력'],outputs:['산출물'],acceptanceCriteria:['완료조건'],verificationRequirements:['검사'],included:['개발'],excluded:['운영'],allowedScopes:[],environmentRef:null,requiredCapabilities:['코드'],budgetRef:null,ownerRole:'책임자',parentAssignmentRef:null,recordingPolicyRef:null,integrationResponsibility:'검수'};
 const snapshot={definition,previousRef:null,reason:'보관 초안',basis:{planRef:ref,applicationRef:ref,designRef:ref,taskCode:'FN01',nodeId:'N1',taskCardHash:'b'.repeat(64)},readinessIssues:[{code:'EXECUTION_NOT_CONNECTED',location:'taskRef'}],status:'DRAFT',ready:false,executionAuthorized:false,dispatchPerformed:false};
 const draft={projectId:pid,ref:{id:parentId,version:1,contentHash:contentHash(canonicalJson(snapshot))},snapshot,headVersion:2,sourceCurrentness:'NOT_RECHECKED',observedAt:at};
 const confirmedSnapshot={draftRef:structuredClone(draft.ref),definition:structuredClone(definition),reviewRefs:[ref],reason:'내용만 확정',confirmedBy:{kind:'HUMAN',userId:pid},confirmedAt:at,contentConfirmed:true,readinessIssues:structuredClone(snapshot.readinessIssues),ready:false,executionAuthorized:false,dispatchPerformed:false};
 const parent={projectId:pid,ref:{id:parentId,version:1,contentHash:contentHash(canonicalJson(confirmedSnapshot))},snapshot:confirmedSnapshot,observedAt:at};
 const child:any={projectId:pid,ref, snapshot:{definition:{parentAssignmentRef:parent.ref}}};
 return {draft,parent,child};
}
function read(...args:any[]){assert.equal(typeof subject.readParentAssignmentOriginal,'function');return subject.readParentAssignmentOriginal(...args);}
test('과거 고정 부모는 confirmed와 원draft의 서로 다른 hash를 대조하며 최신으로 대체하지 않는다',async()=>{
 const q=fixture(),calls:string[]=[];
 const client=new ApiClient(async(path,init)=>{assert.equal(init?.method??'GET','GET');calls.push(String(path));return Response.json(String(path).includes('/assignment-drafts/')?q.draft:q.parent);});
 const result=await read(client,pid,q.child);
 assert.deepEqual(result.parent.ref,q.parent.ref);assert.deepEqual(result.draft.ref,q.draft.ref);assert.notEqual(result.parent.ref.contentHash,result.draft.ref.contentHash);
 assert.equal(result.draft.headVersion,2);assert.equal(result.sourceCurrentness,'NOT_RECHECKED');
 assert.deepEqual(calls,['/api/v1/projects/'+pid+'/assignments/'+parentId+'/versions/1','/api/v1/projects/'+pid+'/assignment-drafts/'+parentId+'/versions/1']);
});
test('닫기·이탈 뒤 늦은 부모 응답은 추가 초안 조회와 결과 채택을 하지 않는다',async()=>{
 const q=fixture(),calls:string[]=[];let active=true;
 const client=new ApiClient(async(path)=>{calls.push(String(path));active=false;return Response.json(String(path).includes('/assignment-drafts/')?q.draft:q.parent);});
 const result=await read(client,pid,q.child,()=>active);
 assert.equal(result,null);assert.equal(calls.length,1);
});

test('교차project/부모 변조·가짜 draft귀속·본문·권한 true·거절은 고정 부모로 채택하지 않는다',async()=>{
 for(const mode of ['PROJECT','HASH','DRAFT_ID','DRAFT_HASH','BODY','READY','DENIED','ROOT']){
  const q=fixture(),calls:string[]=[];
  if(mode==='PROJECT')q.parent.projectId=parentId;
  if(mode==='HASH')q.parent.snapshot.reason='변조';
  if(mode==='DRAFT_ID'){q.parent.snapshot.draftRef={...q.parent.snapshot.draftRef,id:pid};q.parent.ref.contentHash=contentHash(canonicalJson(q.parent.snapshot));q.child.snapshot.definition.parentAssignmentRef=structuredClone(q.parent.ref);}
  if(mode==='DRAFT_HASH')q.draft.ref.contentHash='f'.repeat(64);
  if(mode==='BODY')q.draft.snapshot.definition.goal='다른 본문';
  if(mode==='READY'){q.parent.snapshot.ready=true;q.parent.ref.contentHash=contentHash(canonicalJson(q.parent.snapshot));q.child.snapshot.definition.parentAssignmentRef=structuredClone(q.parent.ref);}
  if(mode==='ROOT')q.child.snapshot.definition.parentAssignmentRef=null;
  const client=new ApiClient(async(path)=>{calls.push(String(path));return mode==='DENIED'?Response.json({code:'PERMISSION_DENIED'},{status:403}):Response.json(String(path).includes('/assignment-drafts/')?q.draft:q.parent);});
  await assert.rejects(read(client,pid,q.child), (e:unknown)=>e instanceof ApiError,mode);
  if(['PROJECT','HASH','DRAFT_ID','ROOT'].includes(mode))assert(calls.length<2,mode);
  assert(calls.every(path=>path.startsWith('/api/v1/projects/'+pid+'/')),mode);
 }
});

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
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/workspace/AssignmentParentOriginal.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:control-acceptance',name:'ControlAcceptanceMemoryTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'rework-memory-entry',resolveId(id){if(id.endsWith('virtual:control-acceptance'))return '\0control-acceptance';},load(id){if(id==='\0control-acceptance')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{AssignmentParentOriginal}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};import{renderToStaticMarkup}from'react-dom/server';export{React,createRoot,AssignmentParentOriginal,ApiClient,renderToStaticMarkup};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return ControlAcceptanceMemoryTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});



const allNodes=(n:MemoryNode):MemoryNode[]=>[n,...n.childNodes.flatMap(allNodes)];
async function mountParent(){
 const q=fixture(),calls:string[]=[],errors:unknown[]=[];let release:((value:Response)=>void)|null=null,hold=false;
 const client=new ui.ApiClient(async(path:string,init?:RequestInit)=>{
  assert.equal(init?.method??'GET','GET');calls.push(path);
  if(hold){hold=false;return new Promise<Response>(r=>release=r);}
  return Response.json(path.includes('/assignment-drafts/')?q.draft:q.parent);
 });
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 let pending:Promise<void>|null=null;
 const props:any={client,child:q.child,session:{user:{id:pid},clientId:parentId,csrfToken:'C'.repeat(43)},busy:false,run:(action:()=>Promise<void>)=>{pending=action().catch(e=>{errors.push(e);});},renderConditions:()=>ui.React.createElement('p',null,'원 부모 조건')};
 const render=async()=>ui.React.act(async()=>root.render(ui.React.createElement(ui.AssignmentParentOriginal,props)));
 const click=async(label:string)=>{const b=allNodes(container).find(n=>n.tagName==='BUTTON'&&n.textContent===label);assert.ok(b,label);assert.equal(b.disabled,false);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0}));};
 const wait=async()=>ui.React.act(async()=>{await pending;});
 await render();return{q,calls,errors,props,render,click,wait,links:()=>allNodes(container).filter(n=>n.tagName==='A'),text:()=>container.textContent,hold:()=>{hold=true;},release:async(value:Response)=>{assert.ok(release);release(value);await wait();},close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
test('부모 원문 RAM 명시 조회 후 원초안 exact 상세 링크만 제공하고 닫으면 제거한다',async()=>{
 const f=await mountParent();try{
  assert.equal(f.calls.length,0);assert.equal(f.links().length,0);await f.click('고정 부모 원문 열기');await f.wait();
  assert.equal(f.calls.length,2);assert.match(f.text(),/원 부모 조건/);assert.equal(f.links().length,1,'부모 책임자·실행 상세 이동 누락');
  assert.equal(f.links()[0]!.getAttribute('href'),'#/projects/'+pid+'/session/assignments/'+parentId+'/versions/1/'+f.q.draft.ref.contentHash);
  assert.notEqual(f.q.parent.ref.contentHash,f.q.draft.ref.contentHash);assert.equal(f.q.draft.headVersion,2);
  await f.click('부모 원문 닫기');assert.equal(f.links().length,0);assert.equal(f.calls.length,2);
 }finally{await f.close();}
});
for(const mode of ['401','403','MISSING','HASH'])test('부모 원문 RAM '+mode+'는 상세 링크를 제공하지 않는다',async()=>{
 const f=await mountParent();try{
  f.hold();await f.click('고정 부모 원문 열기');await f.release(mode==='401'||mode==='403'?Response.json({code:'ACCESS_DENIED'},{status:Number(mode)}):Response.json(mode==='MISSING'?{}:{...f.q.parent,ref:{...f.q.parent.ref,contentHash:'f'.repeat(64)}}));
  assert.equal(f.links().length,0);assert.equal(f.calls.length,1);assert.equal(f.errors.length,1);
 }finally{await f.close();}
});
for(const change of ['SESSION','CSRF','TRANSPORT','CHILD','CLOSE'] as const)for(const status of [200,401])test('부모 원문 RAM '+change+' 뒤 늦은'+status+'는 원문·링크·오류를 반영하지 않는다',async()=>{
 const f=await mountParent();try{
  await f.click('고정 부모 원문 열기');await f.wait();f.hold();await f.click('고정 부모 원문 열기');
  if(change==='SESSION')f.props.session={...f.props.session};
  else if(change==='CSRF')f.props.session.csrfToken='D'.repeat(43);
  else if(change==='TRANSPORT'){const old=f.props.client.transport;f.props.client.transport=(...args:Parameters<typeof fetch>)=>old(...args);}
  else if(change==='CHILD')f.props.child={...f.props.child,ref:{...f.props.child.ref,version:2}};
  else await f.click('부모 원문 닫기');
  await f.render();await f.release(Response.json(status===200?f.q.parent:{code:'AUTH_REQUIRED'},{status}));
  assert.equal(f.links().length,0);assert(!f.text().includes('부모 확정 원문'));assert.equal(f.calls.length,3);assert.equal(f.errors.length,0);
 }finally{await f.close();}
});

test('부모 원문 RAM 이미 연 원문도 문맥 변경에 숨고 같은 값 복귀로 되살아나지 않는다',async()=>{
 for(const change of ['SESSION','CSRF','TRANSPORT','CHILD']){
  const f=await mountParent();try{
   await f.click('고정 부모 원문 열기');await f.wait();assert.equal(f.links().length,1);
   const oldSession=f.props.session,oldCsrf=oldSession.csrfToken,oldTransport=f.props.client.transport,oldChild=f.props.child;
   if(change==='SESSION')f.props.session={...oldSession};
   if(change==='CSRF')f.props.session.csrfToken='D'.repeat(43);
   if(change==='TRANSPORT')f.props.client.transport=(...args:Parameters<typeof fetch>)=>oldTransport(...args);
   if(change==='CHILD')f.props.child={...oldChild,projectId:parentId};
   await f.render();assert.equal(f.links().length,0,change);assert(!f.text().includes('부모 확정 원문'));
   f.props.session=oldSession;oldSession.csrfToken=oldCsrf;f.props.client.transport=oldTransport;f.props.child=oldChild;
   await f.render();assert.equal(f.links().length,0,change);assert.equal(f.calls.length,2);
   await f.click('고정 부모 원문 열기');await f.wait();assert.equal(f.links().length,1);assert.equal(f.calls.length,4);
  }finally{await f.close();}
 }
});
