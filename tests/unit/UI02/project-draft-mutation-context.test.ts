import assert from 'node:assert/strict';
import {test,before,after} from 'node:test';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {emptyDraft} from '../../../apps/web/src/features/project-create/api.ts';
const id=(n:number)=>'a6f20082-0000-4000-8000-'+String(n).padStart(12,'0'),uid=id(1),cid=id(2),did=id(3),pid=id(4);
const nodes=(n:MemoryNode):MemoryNode[]=>[n,...n.childNodes.flatMap(nodes)];
async function settle(check:()=>boolean){for(let i=0;i<80;i++){if(check())return;await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});}assert.fail('RAM 정착 실패');}
async function fixture(creating:boolean){
 const session={user:{id:uid},clientId:cid,csrfToken:'C'.repeat(43)},calls:{path:string;method:string;body?:string}[]=[];
 const input={...emptyDraft().input,name:'원 프로젝트',purpose:'원 목적',desiredOutcome:'원 결과',methodologySelection:{kind:'CONFIRMED_REFERENCE',versionRef:{id:id(5),version:1,contentHash:'a'.repeat(64)}}};
 let buffer:any={...emptyDraft(),ownerUserId:uid,input,draftId:creating?did:null,version:creating?1:0,wizardStep:creating?4:1,dirty:!creating};
 let status=401,waiting=false,lost=0,release=()=>{},mounted=true,immediate=false;
 Object.defineProperty(globalThis,'location',{configurable:true,value:new URL('https://anvil.invalid/'+(creating?'?draftId='+did:'')+'#/projects/new')});
 const api=new ui.ApiClient(async(path:string,options?:RequestInit)=>{
  const method=options?.method??'GET';calls.push({path,method,body:options?.body as string|undefined});
  if(method==='GET'){assert.equal(path,'/api/v1/project-drafts/'+did);return Response.json({draftId:did,version:1,step:4,input,editable:true,consumedProjectId:null,methodologyState:null,storedArtifacts:[]});}
  assert.equal(method,'POST');assert.equal(path,creating?'/api/v1/projects':'/api/v1/project-drafts');
  const selected=status;waiting=true;if(!immediate)await new Promise<void>(r=>release=r);
  if(selected===0)throw Error('합성 유실');
  if(selected!==200)return Response.json({code:'AUTH_REQUIRED'},{status:selected});
  return Response.json(creating?{id:pid,...input,version:1,currentMethodologyRef:{id:id(6),version:1,contentHash:'b'.repeat(64)},baselineRef:null,readinessIssues:[],participation:'OWNER',controlState:{actorId:uid,clientId:cid,generation:1,status:'HELD'}}:{draftId:did,version:1,step:1,input,methodologyState:null});
 });
 const container=document.createElement('div');document.body.appendChild(container);let root=ui.createRoot(container);
 let props:any={client:api,session,buffer,onAuthenticationLost:()=>{lost++;}};
 const render=async(p=props)=>{props=p;await ui.React.act(async()=>root.render(ui.React.createElement(ui.ProjectCreatePage,props)));};
 props.onChange=(update:any)=>{buffer=typeof update==='function'?update(buffer):update;props={...props,buffer};if(mounted)root.render(ui.React.createElement(ui.ProjectCreatePage,props));};
 const click=async(label:string)=>{const b=nodes(container).find(n=>n.tagName==='BUTTON'&&n.textContent===label);assert(b,label);assert(!b.disabled,label);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0}));};
 const begin=async()=>{
  waiting=false;
  if(creating)await click(buffer.pendingAction?'같은 생성 명령 결과 확인':'저장 초안으로 프로젝트 생성');
  else {const form=nodes(container).find(n=>n.tagName==='FORM');assert(form);const p=Object.entries(form).find(([k])=>k.startsWith('__reactProps$'))?.[1] as any;assert(p?.onSubmit);await ui.React.act(async()=>{p.onSubmit({preventDefault(){}});});}
  await settle(()=>waiting);
 };
 await render();if(creating)await settle(()=>!container.textContent.includes('처리 확인 중'));
 return{api,calls,begin,props:()=>props,render,buffer:()=>buffer,lost:()=>lost,setStatus:(n:number)=>status=n,immediate:()=>{immediate=true;},pending:()=>creating?buffer.pendingAction:buffer.pendingCommand,
  release:async()=>{await ui.React.act(async()=>{release();await new Promise(r=>setImmediate(r));});},
  replace:async()=>{const k=creating?'pendingAction':'pendingCommand';buffer={...buffer,[k]:{...buffer[k],dispatchId:id(99)}};await render({...props,buffer});},
  unmount:async()=>{await ui.React.act(async()=>root.unmount());mounted=false;},
  remount:async()=>{await ui.React.act(async()=>root.unmount());root=ui.createRoot(container);await render();},
  close:async()=>{release();if(mounted)await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}
 };
}
for(const creating of [false,true])for(const mode of ['CURRENT','UNMOUNT','REMOUNT','USER','DEVICE','CSRF','CLIENT','TRANSPORT','REQUEST','CSRF_ABA']){
 test((creating?'생성':'저장')+' POST '+mode+' 401은 원 화면·주체·요청에만 인증 소실을 전달한다',async()=>{
  const f=await fixture(creating);try{
   await f.begin();const original=f.props(),pending=f.pending(),input=f.buffer().input;
   if(mode==='UNMOUNT')await f.unmount();
   else if(mode==='REMOUNT')await f.remount();
   else if(mode==='USER')await f.render({...original,session:{...original.session,user:{id:id(9)}}});
   else if(mode==='DEVICE')await f.render({...original,session:{...original.session,clientId:id(9)}});
   else if(mode==='CSRF'||mode==='CSRF_ABA'){await f.render({...original,session:{...original.session,csrfToken:'D'.repeat(43)}});if(mode==='CSRF_ABA')await f.render(original);}
   else if(mode==='CLIENT')await f.render({...original,client:new ui.ApiClient(async()=>Response.json({code:'READ_FAILED'},{status:503}))});
   else if(mode==='TRANSPORT')f.api.transport=async()=>{throw Error('새 전송 금지');};
   else if(mode==='REQUEST')await f.replace();
   const retained=f.pending();await f.release();
   assert.equal(f.lost(),mode==='CURRENT'?1:0);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
   if(mode!=='CURRENT'){assert.equal(f.pending(),retained);assert.equal(f.buffer().input,input);if(mode!=='REQUEST')assert.equal(f.pending(),pending);}
  }finally{await f.close();}
 });
}
for(const creating of [false,true])test((creating?'생성':'저장')+' 즉시 현재 401도 인증 소실을 전달한다',async()=>{
 const f=await fixture(creating);try{f.immediate();await f.begin();assert.equal(f.lost(),1);assert.equal(f.pending(),null);}finally{await f.close();}
});
for(const creating of [false,true])test((creating?'생성':'저장')+' 유실 후 현재 401은 원 명령을 유지하고 동일 재확인 성공한다',async()=>{
 const f=await fixture(creating);try{
  f.setStatus(0);await f.begin();const pending=f.pending();await f.release();assert.equal(f.pending(),pending);
  f.setStatus(401);await f.begin();await f.release();assert.equal(f.lost(),1);assert.deepEqual(f.pending().body,pending.body);
  f.setStatus(200);await f.begin();await f.release();assert.equal(f.pending(),null);
  const posts=f.calls.filter(c=>c.method==='POST');assert.equal(posts.length,3);assert(posts.every(p=>p.body===posts[0]!.body));
  if(creating)assert.equal(f.buffer().createdProject.id,pid);else assert.equal(f.buffer().draftId,did);
 }finally{await f.close();}
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
const saved=new Map<string,PropertyDescriptor|undefined>(); saved.set('location',Object.getOwnPropertyDescriptor(globalThis,'location')); saved.set('history',Object.getOwnPropertyDescriptor(globalThis,'history')); Object.defineProperty(globalThis,'history',{configurable:true,value:{state:null,replaceState(){}}});let ui:any;
const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}

before(async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/project-create/ProjectCreatePage.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:control-acceptance',name:'ControlAcceptanceMemoryTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'rework-memory-entry',resolveId(id){if(id.endsWith('virtual:control-acceptance'))return '\0control-acceptance';},load(id){if(id==='\0control-acceptance')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{ProjectCreatePage}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};import{renderToStaticMarkup}from'react-dom/server';export{React,createRoot,ProjectCreatePage,ApiClient,renderToStaticMarkup};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return ControlAcceptanceMemoryTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});
