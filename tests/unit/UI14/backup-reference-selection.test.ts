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
let digestStarted=0,digestCompleted=0;const subtle=globalThis.crypto.subtle,originalDigest=subtle.digest;
const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
before(async()=>{
 Object.defineProperty(subtle,'digest',{configurable:true,value:async(...args:Parameters<SubtleCrypto['digest']>)=>{digestStarted++;try{return await Reflect.apply(originalDigest,subtle,args);}finally{digestCompleted++;}}});
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/backups/BackupReferencePanel.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:scope-boundary',name:'ScopeBoundaryTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'scope-boundary-memory',resolveId(id){if(id.endsWith('virtual:scope-boundary'))return '\0scope-boundary';},load(id){if(id==='\0scope-boundary')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{BackupReferencePanel}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};import{BackupReferenceScope,mergeBackupReferenceBuffer}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/backups/backup-reference-api.ts',import.meta.url)))};export{React,createRoot,BackupReferencePanel,ApiClient,BackupReferenceScope,mergeBackupReferenceBuffer};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const [key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return ScopeBoundaryTest;')();
});
after(()=>{Reflect.deleteProperty(subtle,'digest');for(const channel of channels){channel.port1.close();channel.port2.close();}for(const[key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});

const id=(n:number)=>`a6140000-0000-4000-8000-${String(n).padStart(12,'0')}`,pid=id(1),uid=id(2),cid=id(3),at='2026-10-28T00:00:00.000Z';
const session={user:{id:uid,displayName:'합성'},clientId:cid,csrfToken:'C'.repeat(43)};
import {contentHash,canonicalJson} from '../../../contracts/canonical.ts';
function reference(n=80,name='선택 A'){
 const snapshot={kind:'RETENTION',displayName:name,spec:{automaticDeletion:false},reason:'합성 metadata'},previousRef=null;
 return {ref:{id:id(n),version:1,contentHash:contentHash(canonicalJson({projectId:pid,id:id(n),version:1,snapshot,previousRef}))},snapshot,previousRef,createdAt:at,commandRecordId:id(81),clientCommandId:id(82),operationId:id(83),auditEventId:id(84),current:{eligible:false,reasonCodes:['RESOURCE_PROVIDER_NOT_CONNECTED'],observedAt:at}};
}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}
async function fixture(){
 let buffer:any=null,currentSession=session,projectId:string|null=pid,shown=true,lost=0,response:Response|null=null,hold:ReturnType<typeof deferred<Response>>|null=null;
 const a=reference(),b=reference(90,'선택 B'),gets:string[]=[],posts:string[]=[],scope=new ui.BackupReferenceScope();
 const client=new ui.ApiClient(async(path:string,init:any)=>{
  if(init?.method==='POST'){posts.push(init.body);throw Error('response lost');}
  gets.push(path);
  if(path===`/api/v1/projects/${pid}`)return Response.json({id:pid,participation:'OWNER',controlState:{actorId:uid,clientId:cid,generation:3,status:'HELD'}});
  if(path.includes('/backup-references?'))return Response.json({items:[a,b],hasMore:false,nextCursor:null,observedAt:at});
  if(path.includes('/backup-references/')&&path.endsWith('/versions/1')){if(hold){const h=hold;hold=null;return h.promise;}if(response){const r=response;response=null;return r;}return Response.json(path.includes(b.ref.id)?b:a);}
  throw Error('UNEXPECTED_REQUEST '+path);
 });
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 function render(){scope.bind(currentSession,client,projectId);root.render(shown?ui.React.createElement(ui.BackupReferencePanel,{client,session:currentSession,projectId,buffer,scope,approvalRequestId:null,onChange:(expected:any,next:any)=>{const merged=ui.mergeBackupReferenceBuffer(buffer,expected,next);if(merged===buffer)return false;buffer=merged;render();return true;},onApprovalRequest:()=>false,onAuthenticationLost:()=>{lost++;}}):null);}
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 const button=(name:string)=>{const b=nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===name);assert(b,name+' / '+container.textContent);return b;};
 const settle=()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});
 const wait=async(check:()=>boolean)=>{for(let n=0;n<100&&!check();n++)await settle();assert(check(),container.textContent);};
 const props=(n:MemoryNode)=>(n as any)[Object.keys(n).find(k=>k.startsWith('__reactProps$'))!];
 const click=async(name:string)=>{const b=button(name);assert(!b.disabled);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const field=async(label:string,value:unknown)=>{const n=nodes().find(n=>n.getAttribute('aria-label')===label);assert(n,label);await ui.React.act(async()=>props(n).onChange({target:{value,checked:value}}));};
 const detail=()=>nodes().find(n=>n.getAttribute('aria-label')==='고정 보호참조 상세');
 await ui.React.act(async()=>render());assert.equal(gets.length,0);await click('보호참조 목록 조회');await wait(()=>nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='선택 A · 현재 v1'));
 return{a,b,gets,posts,container,nodes,button,click,field,wait,settle,detail,buffer:()=>buffer,lost:()=>lost,response:(r:Response)=>{response=r;},hold:()=>{hold=deferred<Response>();return hold;},
 direct:async()=>{const n=nodes().find(n=>n.tagName==='FORM');assert(n);await ui.React.act(async()=>props(n).onSubmit({preventDefault(){}}));},
 context:async(s=session,p:string|null=pid)=>{currentSession=s;projectId=p;await ui.React.act(async()=>render());},
 route:async(show:boolean)=>{shown=show;await ui.React.act(async()=>render());},
 close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
test('목록 fullref와 다른 유효 hash 본문은 개정·회수 입력으로 열리지 않는다',async()=>{
 const f=await fixture();try{const before=f.gets.length;f.response(Response.json(reference(80,'다른 정상 본문')));await f.click('선택 A · 현재 v1');await f.wait(()=>!f.button('보호참조 목록 조회').disabled);
 assert.equal(f.gets.length,before+1);assert(!f.detail());assert(f.container.textContent.includes('RESPONSE_INVALID'));assert.equal(f.buffer(),null);assert.equal(f.posts.length,0);
 }finally{await f.close();}
});
for(const mode of ['REVISE','REVOKE'])test('정확 목록 선택의 '+mode+' 준비는 원 fullref를 사용하고 POST0',async()=>{
 const f=await fixture();try{await f.click('선택 A · 현재 v1');await f.wait(()=>!!f.detail());assert(f.detail()!.textContent.includes(f.a.ref.contentHash));
 await f.click(mode==='REVISE'?'조회 버전 개정 작성':'조회 버전 신규사용 회수 준비');
 assert.deepEqual(mode==='REVISE'?f.buffer().draft.baseRef:f.buffer().draft.referenceRef,f.a.ref);
 await f.field('보호참조 이유','정확 대상 준비');await f.field('참조 metadata·정확 대상 확인',true);await f.click('보호참조 명령 준비');await f.wait(()=>!!f.buffer().pending);
 const c=f.buffer().pending.command;assert.equal(c.targetId,f.a.ref.id);assert.equal(c.expectedVersion,1);assert.deepEqual(f.buffer().pending.headRef,f.a.ref);if(mode==='REVOKE')assert.deepEqual(c.payload.referenceRef,f.a.ref);assert.equal(f.posts.length,0);
 }finally{await f.close();}
});
test('id/version 직접 조회는 목록 hash를 요구하지 않고 정확 조회로 유지',async()=>{
 const f=await fixture();try{const other=reference(80,'명시 직접 원문');f.response(Response.json(other));await f.field('조회할 참조 ID',other.ref.id);const before=f.gets.length;await f.direct();await f.wait(()=>!!f.detail());assert(f.detail()!.textContent.includes(other.ref.contentHash));assert.equal(f.gets.length,before+1);assert.equal(f.posts.length,0);}finally{await f.close();}
});
test('A 다음 B 선택은 B 원참조로 상세와 개정 입력을 교체한다',async()=>{
 const f=await fixture();try{await f.click('선택 A · 현재 v1');await f.wait(()=>!!f.detail());await f.click('보호참조 목록 조회');await f.wait(()=>!f.button('보호참조 목록 조회').disabled);assert(!f.detail());await f.click('선택 B · 현재 v1');await f.wait(()=>!!f.detail());assert(!f.detail()!.textContent.includes(f.a.ref.contentHash));await f.click('조회 버전 개정 작성');assert.deepEqual(f.buffer().draft.baseRef,f.b.ref);assert.equal(f.posts.length,0);}finally{await f.close();}
});
for(const status of [401,403])test('현재 목록 선택 '+status+'는 상세·입력 비노출 및 인증 분기 유지',async()=>{
 const f=await fixture();try{f.response(Response.json({code:'ACCESS_DENIED'},{status}));await f.click('선택 A · 현재 v1');await f.wait(()=>!f.button('보호참조 목록 조회').disabled);assert(!f.detail());assert.equal(f.buffer(),null);assert.equal(f.lost(),status===401?1:0);assert.equal(f.posts.length,0);}finally{await f.close();}
});
for(const mode of ['route','project','session','csrf'])for(const status of [200,401])test(mode+' 교체 뒤 늦은 '+status+'는 상세·인증효과0',async()=>{
 const f=await fixture();try{const held=f.hold();await f.click('선택 A · 현재 v1');
 if(mode==='route'){await f.route(false);await f.route(true);}else if(mode==='project'){await f.context(session,id(200));await f.context();}else if(mode==='session'){await f.context({...session,user:{id:id(201),displayName:'다른 사람'}});await f.context();}else{await f.context({...session,csrfToken:'D'.repeat(43)});await f.context();}
 await ui.React.act(async()=>held.resolve(status===200?Response.json(f.a):Response.json({code:'UNAUTHENTICATED'},{status:401})));for(let i=0;i<3;i++)await f.settle();
 assert(!f.detail());assert.equal(f.buffer(),null);assert.equal(f.lost(),0);assert.equal(f.posts.length,0);
 }finally{await f.close();}
});
test('UNKNOWN 원명령은 다른 목록 선택의 조회에도 보존되고 개정·회수 전환을 막는다',async()=>{
 const f=await fixture();try{await f.click('선택 A · 현재 v1');await f.wait(()=>!!f.detail());await f.click('조회 버전 개정 작성');await f.field('보호참조 이유','원명령 유지');await f.field('참조 metadata·정확 대상 확인',true);await f.click('보호참조 명령 준비');await f.wait(()=>!!f.buffer().pending);
 await f.click('같은 보호참조 명령 전송·재확인');await f.wait(()=>f.container.textContent.includes('결과 미확인'));const original=f.buffer(),body=original.pending.body;assert.equal(f.posts.length,1);
 await f.click('보호참조 목록 조회');await f.wait(()=>!f.button('보호참조 목록 조회').disabled);await f.click('선택 B · 현재 v1');await f.wait(()=>!!f.detail());assert(f.detail()!.textContent.includes(f.b.ref.contentHash));assert(f.button('조회 버전 개정 작성').disabled);assert(f.button('조회 버전 신규사용 회수 준비').disabled);assert.equal(f.buffer(),original);assert.equal(f.buffer().pending.body,body);assert.equal(f.posts.length,1);
 await f.click('같은 보호참조 명령 전송·재확인');await f.wait(()=>!f.button('보호참조 목록 조회').disabled);assert.equal(f.posts.length,2);assert.equal(f.posts[0],f.posts[1]);
 }finally{await f.close();}
});
