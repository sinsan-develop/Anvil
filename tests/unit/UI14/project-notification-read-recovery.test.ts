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
 const entry=fileURLToPath(new URL('../../../apps/web/src/notifications/ProjectNotificationsPanel.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:scope-boundary',name:'ScopeBoundaryTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'scope-boundary-memory',resolveId(id){if(id.endsWith('virtual:scope-boundary'))return '\0scope-boundary';},load(id){if(id==='\0scope-boundary')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{ProjectNotificationsPanel}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};import{NotificationScope,mergeNotificationPending}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/notifications/project-notifications-api.ts',import.meta.url)))};export{React,createRoot,ProjectNotificationsPanel,ApiClient,NotificationScope,mergeNotificationPending};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const [key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return ScopeBoundaryTest;')();
});
after(()=>{Reflect.deleteProperty(subtle,'digest');for(const channel of channels){channel.port1.close();channel.port2.close();}for(const[key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});

const id=(n:number)=>`a6170000-0000-4000-8000-${String(n).padStart(12,'0')}`,pid=id(1),uid=id(2),cid=id(3),nid=id(4),at='2026-10-27T00:00:00.000Z';
const session={user:{id:uid},clientId:cid,csrfToken:'C'.repeat(43)};
function dto(readAt:string|null=null){return{id:nid,eventRef:{kind:'APPROVAL_REQUESTED',serverCommandId:id(7),requestRef:{id:id(5),version:1,contentHash:'a'.repeat(64)},channel:'IN_APP',occurredAt:at},recipientRef:{kind:'HUMAN',userId:uid},projectRef:{id:pid},severity:'ACTION_REQUIRED',reason:'APPROVAL_REQUESTED',authenticatedTarget:{kind:'APPROVAL_REQUEST',projectId:pid,approvalRequestId:id(5)},deliveryState:'STORED_IN_APP',readAt};}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}
async function fixture(){
 let pending:any=null,shown=true,currentSession=session,projectId:string|null=pid,lost=0,postLost=false,read=false,readMode:string|null='503',hold:ReturnType<typeof deferred<Response>>|null=null;
 const posts:string[]=[],gets:string[]=[],unknown:string[]=[],scope=new ui.NotificationScope();
 const client=new ui.ApiClient(async(path:string,init:any)=>{
  if(init?.method==='POST'){assert.equal(path,`/api/v1/projects/${pid}/commands`);posts.push(init.body);const c=JSON.parse(init.body);read=true;if(postLost){postLost=false;throw Error('response lost');}return Response.json({commandId:c.commandId,operationId:id(8),projectId:pid,status:'APPLIED',targetId:nid,version:1,data:{status:'NOTIFICATION_READ',ref:c.payload.notificationRef,readAt:at},evidenceRefs:[],warnings:[],serverReceivedAt:at});}
  gets.push(path);
  if(path===`/api/v1/projects/${pid}`)return Response.json({id:pid,participation:'OWNER',controlState:{actorId:uid,clientId:cid,generation:3,status:'HELD'}});
  if(path.startsWith(`/api/v1/projects/${pid}/notifications?`))return Response.json({items:[dto()],hasMore:false,nextCursor:null,observedAt:at,baselineVersion:null});
  if(path===`/api/v1/projects/${pid}/notifications/${nid}`){if(!read)return Response.json(dto());if(hold){const wait=hold;hold=null;return wait.promise;}if(readMode==='503'||readMode==='403'||readMode==='401')return Response.json({code:'NOTIFICATION_STORAGE_FAILED'},{status:Number(readMode)});if(readMode==='HASH')return Response.json({...dto(at),eventRef:{...dto().eventRef,serverCommandId:id(90)}});return Response.json(dto(readMode));}
  unknown.push(path);throw Error('UNEXPECTED_REQUEST');
 });
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 function render(){scope.bind(currentSession,client,projectId);const s=currentSession,p=projectId;root.render(shown?ui.React.createElement(ui.ProjectNotificationsPanel,{client,session:s,projectId:p,buffer:pending,scope,onChange:(expected:string|null,next:any)=>{if(s!==currentSession||p!==projectId)return false;const merged=ui.mergeNotificationPending(pending,expected,next);if(merged===pending)return false;pending=merged;render();return true;},onAuthenticationLost(){lost++;}}):null);}
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))],button=(name:string)=>{const b=nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===name);assert(b,name+' / '+container.textContent);return b;};
 const settle=()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));}),wait=async(check:()=>boolean)=>{for(let n=0;n<100&&!check();n++)await settle();assert(check(),container.textContent);};
 const click=async(name:string)=>{const b=button(name);assert(!b.disabled);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));};
 await ui.React.act(async()=>render());assert.equal(gets.length,0);await click('알림 처음 조회');await wait(()=>nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='알림 상세 조회'));await click('알림 상세 조회');await wait(()=>container.textContent.includes('선택한 승인 알림'));
 return{posts,gets,unknown,container,readVerified:()=>nodes().some(n=>n.tagName==='DD'&&n.textContent==='읽음 · '+at),button,click,wait,settle,pending:()=>pending,lost:()=>lost,mode:(mode:string|null)=>{readMode=mode;},losePost:()=>{postLost=true;},hold:()=>{hold=deferred<Response>();return hold;},route:async(show:boolean)=>{shown=show;await ui.React.act(async()=>render());},context:async(s=session,p:string|null=pid)=>{currentSession=s;projectId=p;await ui.React.act(async()=>render());},replace:async(next:any=null)=>{pending=next;await ui.React.act(async()=>render());},close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
test('읽음 POST확정 뒤 GET503은 원영수증 보존→명시 정확GET만으로 동일 readAt을 확인한다',async()=>{
 const f=await fixture();try{await f.click('명시적으로 읽음 표시');await f.wait(()=>f.container.textContent.includes('후속 조회 실패'));const original=f.pending(),before=f.gets.length;assert.equal(f.posts.length,1);assert.equal(original.receipt.readAt,at);
  f.mode(at);await f.click('읽음 원알림 다시 확인');await f.wait(()=>!f.container.textContent.includes('후속 조회 실패')&&f.readVerified());
  assert.equal(f.gets.length,before+1);assert.equal(f.gets.at(-1),`/api/v1/projects/${pid}/notifications/${nid}`);assert.equal(f.posts.length,1);assert.equal(f.pending().receipt,original.receipt);assert.equal(f.pending().command,original.command);assert.deepEqual(f.unknown,[]);
 }finally{await f.close();}
});
for(const mode of [null,'2026-10-27T00:00:01.000Z','HASH'])test(`확정 원알림 ${mode??'null readAt'} 응답은 재확인 성공이 아니며 POST를 추가하지 않는다`,async()=>{
 const f=await fixture();try{await f.click('명시적으로 읽음 표시');await f.wait(()=>f.container.textContent.includes('후속 조회 실패'));const receipt=f.pending().receipt,command=f.pending().command;
  f.mode(mode);await f.click('읽음 원알림 다시 확인');await f.wait(()=>f.container.textContent.includes('후속 조회 실패'));assert(!f.readVerified());assert.equal(f.posts.length,1);assert.equal(f.pending().receipt,receipt);assert.equal(f.pending().command,command);
  f.mode(at);await f.click('읽음 원알림 다시 확인');await f.wait(()=>f.readVerified());assert.equal(f.posts.length,1);
 }finally{await f.close();}
});
test('확정 상태 왕복은 자동GET·POST 없이 원영수증 재확인과 명시 닫기를 제공한다',async()=>{
 const f=await fixture();try{await f.click('명시적으로 읽음 표시');await f.wait(()=>f.container.textContent.includes('후속 조회 실패'));const original=f.pending(),before=f.gets.length;
  await f.route(false);await f.route(true);assert.equal(f.gets.length,before);assert.equal(f.posts.length,1);assert.equal(f.pending(),original);
  f.mode(at);await f.click('읽음 원알림 다시 확인');await f.wait(()=>f.readVerified());await f.click('상세 닫기');assert.equal(f.pending(),null);assert(!f.container.textContent.includes('읽음 처리 확인'));assert.equal(f.posts.length,1);
 }finally{await f.close();}
});
test('읽음 확정 후 권한403은 원영수증 보존·상세숨김, 접근재확인도 동일 readAt만 수용한다',async()=>{
 const f=await fixture();try{f.mode('403');await f.click('명시적으로 읽음 표시');await f.wait(()=>f.pending()?.accessLost);const receipt=f.pending().receipt;assert(receipt);assert(!f.container.textContent.includes('선택한 승인 알림'));
  f.mode(null);await f.click('원알림 접근 다시 확인');await f.wait(()=>f.container.textContent.includes('후속 조회 실패'));assert.equal(f.pending().accessLost,true);assert.equal(f.pending().receipt,receipt);assert(!f.container.textContent.includes('선택한 승인 알림'));
  f.mode(at);await f.click('원알림 접근 다시 확인');await f.wait(()=>f.readVerified());assert.equal(f.pending().accessLost,false);assert.equal(f.pending().receipt,receipt);assert.equal(f.posts.length,1);
 }finally{await f.close();}
});
test('재확인 연속 클릭은 원 ticket에서 정확GET 1개만 발행한다',async()=>{
 const f=await fixture();try{await f.click('명시적으로 읽음 표시');await f.wait(()=>f.container.textContent.includes('후속 조회 실패'));const late=f.hold(),before=f.gets.length,b=f.button('읽음 원알림 다시 확인');
  await ui.React.act(async()=>{b.dispatchEvent({type:'click',button:0});b.dispatchEvent({type:'click',button:0});});assert.equal(f.gets.length,before+1);late.resolve(Response.json(dto(at)));await f.wait(()=>f.readVerified());assert.equal(f.posts.length,1);
 }finally{await f.close();}
});
for(const status of [200,401])for(const change of ['프로젝트ABA','세션','이탈','버퍼','버퍼ABA']as const)test(`재확인 지연${status}은 ${change} 뒤 상세·인증 상태에 반영하지 않는다`,async()=>{
 const f=await fixture();try{await f.click('명시적으로 읽음 표시');await f.wait(()=>f.container.textContent.includes('후속 조회 실패'));const receipt=f.pending().receipt,late=f.hold();await f.click('읽음 원알림 다시 확인');
  if(change==='프로젝트ABA'){await f.context(session,id(9));await f.context();}else if(change==='세션')await f.context({...session,csrfToken:'D'.repeat(43)});else if(change==='이탈')await f.route(false);else if(change==='버퍼ABA'){const original=f.pending();await f.replace();await f.replace(original);}else await f.replace();
  const before=digestStarted;late.resolve(Response.json(status===200?dto(at):{code:'AUTH_REQUIRED'},{status}));if(status===200)await f.wait(()=>digestStarted>before&&digestCompleted===digestStarted);await f.settle();await f.settle();
  assert(!f.readVerified());assert.equal(f.lost(),0);assert.equal(f.posts.length,1);if(change!=='버퍼')assert.equal(f.pending().receipt,receipt);
 }finally{await f.close();}
});
test('현재 재확인401은 원 receipt를 보존하며 인증소실만 전달한다',async()=>{
 const f=await fixture();try{await f.click('명시적으로 읽음 표시');await f.wait(()=>f.container.textContent.includes('후속 조회 실패'));const receipt=f.pending().receipt;f.mode('401');await f.click('읽음 원알림 다시 확인');await f.wait(()=>f.lost()===1);assert.equal(f.pending().receipt,receipt);assert.equal(f.posts.length,1);
 }finally{await f.close();}
});
test('원 POST UNKNOWN은 화면 왕복 뒤 동일 명령 POST 재확인을 유지한다',async()=>{
 const f=await fixture();try{f.losePost();await f.click('명시적으로 읽음 표시');await f.wait(()=>f.container.textContent.includes('처리 결과 미확인.'));const original=f.pending();assert.equal(original.receipt,null);await f.route(false);await f.route(true);assert.equal(f.posts.length,1);
  f.mode(at);await f.click('같은 명령 결과 재확인');await f.wait(()=>f.container.textContent.includes('읽음 처리 확인'));assert.equal(f.posts.length,2);assert.equal(f.posts[0],f.posts[1]);assert.equal(f.pending().command,original.command);assert.equal(f.pending().body,original.body);
 }finally{await f.close();}
});
for(const status of [200,401])test(`최초 읽음 확정 직후 후속GET 지연${status}도 교체한 버퍼에 반영하지 않는다`,async()=>{
 const f=await fixture();try{const late=f.hold();await f.click('명시적으로 읽음 표시');await f.wait(()=>!!f.pending()?.receipt);const receipt=f.pending().receipt;assert.equal(receipt.readAt,at);await f.replace();
  const before=digestStarted;late.resolve(Response.json(status===200?dto(at):{code:'AUTH_REQUIRED'},{status}));if(status===200)await f.wait(()=>digestStarted>before&&digestCompleted===digestStarted);await f.settle();await f.settle();
  assert.equal(f.pending(),null);assert(!f.readVerified());assert.equal(f.lost(),0);assert.equal(f.posts.length,1);
 }finally{await f.close();}
});
