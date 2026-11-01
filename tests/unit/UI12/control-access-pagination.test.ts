import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {createControlRequestSnapshot} from '../../../apps/server/modules/control-handoff/control-request-snapshot.ts';
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
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/control-handoff/ControlAccessPage.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:control-pagination',name:'ControlPaginationTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'rework-memory-entry',resolveId(id){if(id.endsWith('virtual:control-pagination'))return '\0control-pagination';},load(id){if(id==='\0control-pagination')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{ControlAccessPage}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};export{React,createRoot,ControlAccessPage,ApiClient};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return ControlPaginationTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});

const projectId='11111111-1111-4111-8111-111111111111',actorId='22222222-2222-4222-8222-222222222222',clientId='33333333-3333-4333-8333-333333333333',other='44444444-4444-4444-8444-444444444444',id='55555555-5555-4555-8555-555555555555';
const session={user:{id:actorId,displayName:'사용자'},clientId,csrfToken:'c'.repeat(43)},now='2026-10-26T00:00:00.000Z',basis={actorId,clientId:other,generation:2,version:7};
const input={targetActorRef:{userId:actorId},targetClientRef:{userId:actorId,clientId},baseControl:basis,reason:'고정 인수 원문',expiresAt:'2026-10-26T00:20:00.000Z'};
const request=createControlRequestSnapshot({id,projectId,requestedBy:{actorId,clientId},input,createdAt:now});
const fixed={projectId,...request,observedAt:now,current:{expired:false,baseControlState:'MATCHED'},executionAuthorized:false,controlTransferred:false};
const cursor='signed.control.page';
async function mount(){
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container),calls:string[]=[],lists:{view:string;cursor:string|null}[]=[];let lost=0,changes=0;
 const state:{next:number|'DELAY'|null;release:((r:Response)=>void)|null;held:boolean}={next:null,release:null,held:true};
 const control=()=>({schemaVersion:1,projectId:props.projectId,observedAt:now,actorId:props.session.user.id,clientId:props.session.clientId,participation:'OWNER',control:{state:state.held?'HELD':'OTHER_CLIENT',basis:{...basis,actorId:props.session.user.id,clientId:state.held?props.session.clientId:other}},executionAuthorized:false,controlTransferred:false});
 const page=(view:string,c:string|null)=>({projectId:props.projectId,view,limit:50,observedAt:now,items:[{requestRef:request.requestRef,createdAt:now,expiresAt:input.expiresAt,storedState:'PENDING',current:fixed.current,executionAuthorized:false,controlTransferred:false}],hasMore:c===null,nextCursor:c===null?cursor:null,executionAuthorized:false,controlTransferred:false});
 function client(){return new ui.ApiClient(async(url:any,options:any)=>{assert.equal(options?.method??'GET','GET','POST0');const path=String(url);calls.push(path);const u=new URL(path,'https://anvil.invalid');if(u.pathname.endsWith('/control-state'))return Response.json(control());if(u.pathname.endsWith('/control-requests')){lists.push({view:u.searchParams.get('view')!,cursor:u.searchParams.get('cursor')});const n=state.next;state.next=null;if(n==='DELAY')return new Promise<Response>(r=>{state.release=r;});if(typeof n==='number')return Response.json({code:'DENIED'},{status:n});return Response.json(page(u.searchParams.get('view')!,u.searchParams.get('cursor')));}if(u.pathname.includes('/control-requests/'))return Response.json(fixed);assert.fail('미모델 GET '+path);});}
 const buffer={bindingId:id,ownerUserId:actorId,ownerClientId:clientId,projectId,reason:'부모 초안',expiresAt:input.expiresAt,pending:null};
 const props:any={client:client(),projectId,session,buffer,onChange:()=>{changes++;return true;},onAuthenticationLost:()=>lost++};
 const nodes=(n=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))],buttons=(label:string)=>nodes().filter(n=>n.tagName==='BUTTON'&&n.textContent===label);
 async function render(){await ui.React.act(async()=>root.render(ui.React.createElement(ui.ControlAccessPage,props)));}
 async function flush(){await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});}
 async function waitFor(s:string){for(let n=0;n<100&&!container.textContent.includes(s);n++)await flush();assert(container.textContent.includes(s),s);}
 async function click(s:string){const a=buttons(s);assert.equal(a.length,1,s+' 버튼');assert(!a[0]!.disabled,s+' 활성');await ui.React.act(async()=>a[0]!.dispatchEvent({type:'click',button:0,bubbles:true}));}
 async function close(){await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}
 await render();return{container,props,state,calls,lists,buttons,click,close,render,flush,waitFor,client,page,lost:()=>lost,changes:()=>changes};
}
test('정상 제어·실목록을 거친 다음/이전 페이지 왕복은 성공 cursor 이력으로 GET한다',async()=>{
 const f=await mount();try{await f.click('현재 제어 조회');await f.waitFor('HELD');await f.click('내 요청 목록 조회');await f.waitFor('요청 1 원문 확인');await f.click('다음 요청 목록 조회');await f.waitFor('요청 1 원문 확인');await f.click('이전 요청 목록 조회');await f.waitFor('요청 1 원문 확인');assert.deepEqual(f.lists,[{view:'OWN',cursor:null},{view:'OWN',cursor},{view:'OWN',cursor:null}]);assert.equal(f.changes(),0);}finally{await f.close();}
});

test('실패는 현재 상태를 지우고 같은 view/cursor 재조회 전 새 상태를 검산한다',async()=>{
 const f=await mount();try{await f.click('현재 제어 조회');await f.click('내 요청 목록 조회');f.state.next=503;await f.click('다음 요청 목록 조회');await f.waitFor('현재 제어는 아직 확인하지 않았습니다.');assert(f.buttons('내 요청 목록 조회')[0]!.disabled);const count=f.calls.length;await f.flush();assert.equal(f.calls.length,count);await f.click('같은 요청 목록 다시 조회');await f.waitFor('요청 1 원문 확인');assert.deepEqual(f.calls.slice(-2).map(p=>new URL(p,'https://a.invalid').pathname.split('/').at(-1)),['control-state','control-requests']);assert.deepEqual(f.lists.slice(-2),[{view:'OWN',cursor},{view:'OWN',cursor}]);f.state.next=403;await f.click('이전 요청 목록 조회');await f.waitFor('현재 제어는 아직 확인하지 않았습니다.');await f.click('같은 요청 목록 다시 조회');await f.waitFor('요청 1 원문 확인');assert.deepEqual(f.lists.slice(-2),[{view:'OWN',cursor:null},{view:'OWN',cursor:null}]);}finally{await f.close();}
});
test('CONTROLLER 실패 후 제어 상실은 cached HELD로 목록을 복원하지 않는다',async()=>{
 const f=await mount();try{await f.click('현재 제어 조회');await f.click('현재 제어자 요청 목록 조회');f.state.next=503;await f.click('다음 요청 목록 조회');await f.waitFor('현재 제어는 아직 확인하지 않았습니다.');const count=f.lists.length;f.state.held=false;await f.click('같은 요청 목록 다시 조회');await f.waitFor('현재 제어는 아직 확인하지 않았습니다.');assert.equal(f.lists.length,count);assert(f.buttons('현재 제어자 요청 목록 조회')[0]!.disabled);assert(f.buttons('인수 요청 명령 보존')[0]!.disabled);assert.equal(f.changes(),0);}finally{await f.close();}
});
test('OWN/CONTROLLER 성공 이력은 분리되고 이동 즉시 고정 원문을 숨긴다',async()=>{
 const f=await mount();try{await f.click('현재 제어 조회');await f.click('내 요청 목록 조회');await f.click('다음 요청 목록 조회');await f.click('요청 1 원문 확인');await f.waitFor(input.reason);await f.click('현재 제어자 요청 목록 조회');await f.waitFor('요청 1 원문 확인');assert(!f.container.textContent.includes(input.reason));assert.equal(f.buttons('이전 요청 목록 조회').length,0);await f.click('다음 요청 목록 조회');await f.click('이전 요청 목록 조회');assert.deepEqual(f.lists.slice(-3),[{view:'CONTROLLER',cursor:null},{view:'CONTROLLER',cursor},{view:'CONTROLLER',cursor:null}]);assert.equal(f.calls.filter(p=>p.includes('/versions/')).length,1);assert.equal(f.changes(),0);}finally{await f.close();}
});
test('주체/API/CSRF의 관측 ABA와 unmount는 늦은401·옛 목록을 폐기한다',async()=>{
 for(const mode of ['API','SESSION','PROJECT','CSRF','UNMOUNT']){const f=await mount();let closed=false;try{await f.click('현재 제어 조회');f.state.next='DELAY';await f.click('내 요청 목록 조회');assert(f.state.release);const release=f.state.release!,original={...f.props};if(mode==='UNMOUNT'){await f.close();closed=true;}else{if(mode==='API')f.props.client=f.client();if(mode==='SESSION')f.props.session={...session,clientId:other};if(mode==='PROJECT')f.props.projectId=other;if(mode==='CSRF')f.props.session={...session,csrfToken:'d'.repeat(43)};await f.render();assert(!f.container.textContent.includes('요청 1 원문 확인'));Object.assign(f.props,original);await f.render();await f.click('현재 제어 조회');await f.click('내 요청 목록 조회');}await ui.React.act(async()=>release(Response.json({code:'AUTH_REQUIRED'},{status:401})));await f.flush();assert.equal(f.lost(),0);assert.equal(f.changes(),0);}finally{if(!closed)await f.close();}}
});
test('현재401은 인증상실을 전달하고 현재403은 제어·원문을 모두 숨긴다',async()=>{
 for(const status of [401,403]){const f=await mount();try{await f.click('현재 제어 조회');await f.click('내 요청 목록 조회');await f.click('요청 1 원문 확인');await f.waitFor(input.reason);f.state.next=status;await f.click('다음 요청 목록 조회');await f.waitFor('현재 제어는 아직 확인하지 않았습니다.');assert(!f.container.textContent.includes(input.reason));assert.equal(f.lost(),status===401?1:0);assert.equal(f.changes(),0);}finally{await f.close();}}
});

test('같은 API의 무렌더 transport 교체는 늦은401을 폐기하고 명시 조회를 회복한다',async()=>{
 const f=await mount();try{await f.click('현재 제어 조회');f.state.next='DELAY';await f.click('내 요청 목록 조회');const release=f.state.release!;f.props.client.transport=f.client().transport;await ui.React.act(async()=>release(Response.json({code:'AUTH_REQUIRED'},{status:401})));await f.flush();assert.equal(f.lost(),0);assert(!f.container.textContent.includes('요청 1 원문 확인'));await f.click('현재 제어 조회');await f.click('내 요청 목록 조회');await f.waitFor('요청 1 원문 확인');assert.equal(f.changes(),0);}finally{await f.close();}
});
test('UNKNOWN 원명령·부모 buffer는 목록 왕복과 실패 재조회에도 byte 동일하고 POST0이다',async()=>{
 const f=await mount();try{const command={schemaVersion:1,operation:'requestControl',commandId:id,projectId,clientId,payload:input};f.props.buffer={...f.props.buffer,pending:{bindingId:other,command,status:'UNKNOWN'}};const original=f.props.buffer,bytes=JSON.stringify(original);await f.render();await f.click('현재 제어 조회');await f.click('내 요청 목록 조회');f.state.next=503;await f.click('다음 요청 목록 조회');await f.waitFor('현재 제어는 아직 확인하지 않았습니다.');await f.click('같은 요청 목록 다시 조회');await f.click('이전 요청 목록 조회');assert.equal(f.props.buffer,original);assert.equal(JSON.stringify(f.props.buffer),bytes);assert.equal(f.changes(),0);assert(f.buttons('인수 수락 (미구현)')[0]!.disabled);assert.equal(f.buttons('같은 명령 결과 재확인').length,1);}finally{await f.close();}
});
