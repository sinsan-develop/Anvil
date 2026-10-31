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
const saved=new Map<string,PropertyDescriptor|undefined>(),events=new Map<string,Function[]>();let ui:any;
const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];
class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
const id=(n:number)=>`ab130031-0000-4000-8000-${String(n).padStart(12,'0')}`,pid=id(1),uid=id(2),cid=id(3),at='2026-10-31T00:00:00.000Z';
const location={hash:`#/projects/${pid}/mobile`,protocol:'https:'};
const calls:{path:string;method:string}[]=[];
let identity={user:{id:uid,displayName:'합성 조회자'},clientId:cid,csrfToken:'c'.repeat(43)},denyNextProject=false,richProject=false,projectOwner=false;
const project={id:pid,name:'모바일 합성 프로젝트',purpose:'같은 작업영역 전환',desiredOutcome:'원입력 보존',version:1,createdAt:at,updatedAt:at,currentMethodologyRef:null,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[],viewerPermissions:['READ_PROJECT'],participation:'VIEWER',controlState:{actorId:null,clientId:null,generation:null,status:'UNASSIGNED'}};
const transport:typeof fetch=async(input,init)=>{
 const path=String(input),method=init?.method??'GET';calls.push({path,method});assert.equal(method,'GET','시험은 조회만 허용한다');
 if(path==='/api/v1/session')return Response.json(identity);
 if(/^\/api\/v1\/projects\/[0-9a-f-]+$/.test(path)){if(denyNextProject){denyNextProject=false;return Response.json({code:'AUTH_REQUIRED'},{status:401});}return Response.json({...project,id:path.split('/').at(-1),currentMethodologyRef:richProject?applicationRef:null,...(projectOwner?{participation:'OWNER',controlState:{actorId:identity.user.id,clientId:identity.clientId,generation:1,status:'HELD'}}:{})});}
 if(path===`/api/v1/projects/${pid}/methodology-application`)return Response.json({projectId:pid,applicationRef:richProject?applicationRef:null,snapshot:richProject?snapshot:null,observedAt:at,executionState:'NOT_CONNECTED'});
 if(path.startsWith(`/api/v1/projects/${pid}/conversations?`))return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:at});
 return Response.json({code:'SYNTHETIC_NOT_SELECTED'},{status:403});
};
before(async()=>{
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,location,getComputedStyle:()=>({})};
 const listen=(key:string,fn:Function)=>events.set(key,[...(events.get(key)??[]),fn]),unlisten=(key:string,fn:Function)=>events.set(key,(events.get(key)??[]).filter(x=>x!==fn));
 window.addEventListener=listen;window.removeEventListener=unlisten;document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,location,fetch:transport,addEventListener:listen,removeEventListener:unlisten,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 const entry=fileURLToPath(new URL('../../../apps/web/src/App.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:mobile-panes',name:'MobilePanesTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'mobile-panes-memory',resolveId(id){if(id.endsWith('virtual:mobile-panes'))return '\0mobile-panes';},load(id){if(id==='\0mobile-panes')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{App}from${JSON.stringify(entry)};import{MobileNavigation}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/mobile/MobileNavigation.tsx',import.meta.url)))};import{WorkspacePage}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/workspace/WorkspacePage.tsx',import.meta.url)))};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};import{newAssignmentDraft}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/workspace/assignment-api.ts',import.meta.url)))};import{newConversation,prepareConversation}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/knowledge/conversation-api.ts',import.meta.url)))};export{React,createRoot,App,MobileNavigation,WorkspacePage,ApiClient,newConversation,prepareConversation,newAssignmentDraft};`;}}]});
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return MobilePanesTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});
function all(n:MemoryNode):MemoryNode[]{return[n,...n.childNodes.flatMap(all)];}
function labelled(root:MemoryNode,label:string){const n=all(root).find(n=>n.getAttribute('aria-label')===label);assert.ok(n,'실제 렌더 영역: '+label);return n;}
function hidden(n:MemoryNode){for(let p:MemoryNode|null=n;p;p=p.parentNode)if(p.attributes.has('hidden')||p.getAttribute('aria-hidden')==='true'||p.style.display==='none')return true;return false;}
async function settle(){await ui.React.act(async()=>{await new Promise<void>(resolve=>setImmediate(resolve));});}
async function wait(fn:()=>boolean){const end=Date.now()+2500;while(!fn()&&Date.now()<end)await settle();assert.ok(fn(),'실제 App/decoder 준비 완료');}
async function fixture(methodology=false,owner=false){
 location.hash=`#/projects/${pid}/mobile`;identity={user:{id:uid,displayName:'합성 조회자'},clientId:cid,csrfToken:'c'.repeat(43)};denyNextProject=false;richProject=methodology;projectOwner=owner;calls.length=0;
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 await ui.React.act(async()=>root.render(ui.React.createElement(ui.App)));
 await wait(()=>container.textContent.includes(project.name)&&all(container).some(n=>n.getAttribute('aria-label')==='총괄 작업'));
 await settle();
 return{container,async close(){await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
// 실제 App의 세션 GET→Workspace decoder→MobileNavigation/WorkspacePage를 실행한다.
// 합성 VIEWER/미적용방법론은 최초 pane 표시만 검증하며 임무작성·단계선택·UNKNOWN 보존 증거로 승격하지 않는다.
// MemoryNode는 CSS 레이아웃/브라우저 탭 순서/실제 native 입력 검증이 아니다.
test('mobilePane 실제 App 기본 대화는 같은 Workspace의 절차·자료를 접근성에서 숨긴다',async()=>{
 const f=await fixture();try{
  const nav=labelled(f.container,'모바일 작업 탐색'),items=nav.childNodes.filter(n=>n.nodeType===1);assert.equal(items.length,4,'하단 탐색은 기존 네 개뿐');
  const chat=labelled(f.container,'총괄 작업'),steps=labelled(f.container,'개발 절차'),docs=labelled(f.container,'프로젝트 자료');
  assert.equal(hidden(chat),false,'기본 대화 표시');assert.equal(hidden(steps),true,'기본 대화에서 절차는 숨김');assert.equal(hidden(docs),true,'기본 대화에서 자료는 숨김');
  assert.equal(location.hash,`#/projects/${pid}/mobile`);assert.equal(calls.filter(c=>c.method==='POST').length,0);
 }finally{await f.close();}
});

async function navigate(hash:string){await ui.React.act(async()=>{location.hash=hash;for(const fn of events.get('hashchange')??[])fn();});await settle();}
async function click(n:MemoryNode){assert.equal(n.disabled,false);const priorHash=location.hash,e:any={type:'click',button:0};await ui.React.act(async()=>n.dispatchEvent(e));if(location.hash!==priorHash)await navigate(location.hash);if(n.tagName==='A'&&!e.defaultPrevented&&n.getAttribute('href')?.startsWith('#/'))await navigate(n.getAttribute('href')!);await settle();}
function button(root:MemoryNode,text:string){const n=all(root).find(n=>n.tagName==='BUTTON'&&n.textContent===text);assert.ok(n,'실제 버튼: '+text);return n;}
function navItems(root:MemoryNode){return labelled(root,'모바일 작업 탐색').childNodes.filter(n=>n.nodeType===1);}
const hash=(value:unknown)=>contentHash(canonicalJson(value));
const graph={nodes:['A','B'].map((nodeId,n)=>({nodeId,name:n?'둘째 단계':'첫 단계',purpose:'선택 보존',kind:'HUMAN',position:{x:n,y:0},role:'USER',inputs:[],outputs:[],taskScope:{included:['검토'],excluded:[]},completionCriteria:['기록'],approvalBoundary:['사람'],mode:'CASE_BY_CASE',limitPolicyRef:null,recordRequirements:['기록']})),edges:[],entryNodeId:'A',terminalNodeIds:['B']};
const sourceRef={id:id(4),version:1,contentHash:hash(graph)},snapshot={name:'모바일 고정 절차',purpose:'표시 전환 검증',graph,sourceRef},applicationRef={id:id(5),version:1,contentHash:hash(snapshot)};
const session={user:{id:uid,displayName:'합성 소유자'},clientId:cid,csrfToken:'c'.repeat(43)};
// App의 실제 하단callback→pane wiring은 별도의 actual App 시험이 검증한다.
// 이 composition은 기존 Workspace/Navigation의 mount·선택·원버퍼를 집중 검증하며 App buffer store의 대체 구현이 아니다.
async function composition(uncertain:boolean,pc=false){
 let observed:any,observedAssignment:any,changes=0,assignmentChanges=0;const localCalls:{path:string;method:string}[]=[];
 const b=ui.newConversation(pid,session,1);b.body='보존할 대화\n두 번째 줄';b.dirty=true;
 if(uncertain){b.pending=await ui.prepareConversation(b,session);b.uncertain=true;b.failure={code:'CONNECTION_LOST',status:0};}
 const assignment=ui.newAssignmentDraft(pid,session,1,{ref:{id:id(6),version:1,contentHash:'a'.repeat(64)},designRef:sourceRef,tasks:[{taskCode:'UI13',title:'보관 임무',purpose:'임무 초안 목적',inputs:[],outputs:[],acceptanceCriteria:['보존'],testCases:[],included:['확인'],excluded:[],ownerRole:'작성자'}]},'UI13',applicationRef,'B');
 const originalAssignment=structuredClone(assignment),original=structuredClone(b),bytes=canonicalJson(b.pending),client=new ui.ApiClient(async(input:any,init:any)=>{
  const path=String(input),method=init?.method??'GET';localCalls.push({path,method});assert.equal(method,'GET');
  if(path===`/api/v1/projects/${pid}`)return Response.json({...project,currentMethodologyRef:applicationRef,participation:'OWNER',controlState:{actorId:uid,clientId:cid,generation:1,status:'HELD'}});
  if(path.endsWith('/methodology-application'))return Response.json({projectId:pid,applicationRef,snapshot,observedAt:at,executionState:'NOT_CONNECTED'});
  if(path.includes('/conversations?'))return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:at});
  return Response.json({code:'SYNTHETIC_NOT_SELECTED'},{status:403});
 });
 function Host(){const[pane,setPane]=ui.React.useState('chat'),[buffer,setBuffer]=ui.React.useState(b),[assignmentBuffer,setAssignment]=ui.React.useState(assignment);observed=buffer;observedAssignment=assignmentBuffer;
  return ui.React.createElement(ui.React.Fragment,null,!pc&&ui.React.createElement(ui.MobileNavigation,{route:{screen:'mobile',projectId:pid},pane,onPaneChange:setPane}),ui.React.createElement(ui.WorkspacePage,{client,projectId:pid,session,mobilePane:pc?undefined:pane,assignmentBuffer,onAssignmentChange:(change:any)=>{assignmentChanges++;setAssignment(change);},conversationBuffer:buffer,onConversationChange:(v:any)=>{changes++;setBuffer(v);},onAuthenticationLost:()=>{throw Error('UNEXPECTED_AUTH_LOSS');}}));
 }
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 await ui.React.act(async()=>root.render(ui.React.createElement(Host)));await wait(()=>container.textContent.includes(project.name)&&all(container).some(n=>n.tagName==='TEXTAREA'));await settle();
 return{container,original,originalAssignment,bytes,localCalls,get observedAssignment(){return observedAssignment;},get assignmentChanges(){return assignmentChanges;},get observed(){return observed;},get changes(){return changes;},async close(){await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
for(const uncertain of [false,true])test('mobilePane 실제 Workspace 단계·대화 '+(uncertain?'UNKNOWN 원명령':'draft')+'은 세 pane 전환으로 바뀌지 않는다',async()=>{
 const f=await composition(uncertain);try{
  const workspace=labelled(f.container,'프로젝트 작업'),chat=labelled(f.container,'총괄 작업'),steps=labelled(f.container,'개발 절차'),docs=labelled(f.container,'프로젝트 자료'),textarea=all(chat).find(n=>n.tagName==='TEXTAREA'&&n.value===f.original.body);assert.ok(textarea);assert.equal(textarea.value,f.original.body);
  await click(navItems(f.container)[1]!);assert.equal(hidden(steps),false,'절차 선택은 같은 Workspace 절차를 표시');assert.equal(hidden(chat),true);
  await click(button(steps,'적용 절차 조회'));await wait(()=>all(steps).some(n=>n.getAttribute('aria-label')==='절차 정의: 둘째 단계'));
  await click(labelled(steps,'절차 정의: 둘째 단계'));await settle();const settledCalls=f.localCalls.length;
  await click(navItems(f.container)[2]!);assert.equal(hidden(docs),false);assert.ok(docs.textContent.includes('선택 정의: 둘째 단계'),'동일 선택단계 자료');assert.equal(labelled(f.container,'프로젝트 작업'),workspace);
  await click(navItems(f.container)[0]!);assert.equal(hidden(chat),false);assert.equal(all(chat).find(n=>n.tagName==='TEXTAREA'&&n.value===f.original.body),textarea,'대화 노드 remount0');assert.equal(textarea.value,f.original.body);
  await click(navItems(f.container)[1]!);assert.equal(labelled(steps,'절차 정의: 둘째 단계').getAttribute('aria-pressed'),'true');
  await click(navItems(f.container)[0]!);assert.equal(f.localCalls.length,settledCalls,'pane 전환 추가 GET/POST0');assert.deepEqual(f.observed,f.original);assert.equal(canonicalJson(f.observed.pending),f.bytes,'원명령 bytes 불변');assert.equal(f.changes,0);assert.deepEqual(f.observedAssignment,f.originalAssignment);assert.equal(f.assignmentChanges,0);assert.ok(all(chat).some(n=>n.tagName==='TEXTAREA'&&n.value==='임무 초안 목적'));
 }finally{await f.close();}
});
test('mobilePane PC Workspace는 pane 미지정이면 기존 세 영역을 함께 유지한다',async()=>{const f=await composition(false,true);try{for(const name of ['총괄 작업','개발 절차','프로젝트 자료'])assert.equal(hidden(labelled(f.container,name)),false);assert.equal(all(f.container).filter(n=>n.getAttribute('aria-label')==='모바일 작업 탐색').length,0);assert.ok(all(f.container).some(n=>n.getAttribute('href')===`#/projects/${pid}/methodologies`));assert.ok(all(f.container).some(n=>n.getAttribute('href')===`#/projects/${pid}/documents`));}finally{await f.close();}});

test('mobilePane 실제 App 앞3 전환은 route·Workspace·추가요청을 바꾸지 않는다',async()=>{
 const f=await fixture(true);try{const workspace=labelled(f.container,'프로젝트 작업'),original=location.hash;await click(navItems(f.container)[1]!);await selectSecondStage(f.container);const count=calls.length;
 for(const[index,pane]of [[1,'개발 절차'],[2,'프로젝트 자료'],[0,'총괄 작업']] as const){await click(navItems(f.container)[index]!);assert.equal(location.hash,original,'앞3은 동일 mobile route');assert.equal(labelled(f.container,'프로젝트 작업'),workspace);assert.equal(hidden(labelled(f.container,pane)),false);assert.equal(navItems(f.container)[index]!.getAttribute('aria-current'),'page');}
 assert.equal(calls.length,count,'pane 전환은 조회/송신 추가0');assert.equal(labelled(f.container,'절차 정의: 둘째 단계').getAttribute('aria-pressed'),'true');
 }finally{await f.close();}
});
test('mobilePane 실제 App project/user/client 교체는 기본대화로 초기화하고 자동송신하지 않는다',async()=>{
 const f=await fixture(true);try{
  await click(navItems(f.container)[1]!);await selectSecondStage(f.container);await click(navItems(f.container)[2]!);assert.equal(hidden(labelled(f.container,'프로젝트 자료')),false);
  await navigate(`#/projects/${id(9)}/mobile`);await wait(()=>f.container.textContent.includes(project.name));assert.equal(hidden(labelled(f.container,'총괄 작업')),false,'다른 project 기본chat');assert.ok(labelled(f.container,'프로젝트 자료').textContent.includes('선택 단계 없음'));assert.equal(hidden(labelled(f.container,'프로젝트 자료')),true);
  await navigate(`#/projects/${pid}/mobile`);await wait(()=>f.container.textContent.includes(project.name));assert.equal(hidden(labelled(f.container,'총괄 작업')),false,'project 복귀도 chat');
  for(const next of [{user:{id:id(8),displayName:'새 주체'},clientId:cid,csrfToken:'d'.repeat(43)},{user:{id:id(8),displayName:'새 주체'},clientId:id(7),csrfToken:'e'.repeat(43)}]){
   await click(navItems(f.container)[1]!);await selectSecondStage(f.container);denyNextProject=true;await click(button(f.container,'프로젝트 원본 새로고침'));await wait(()=>f.container.textContent.includes('로그인 확인 필요'));identity=next;await click(button(f.container,'접근 상태 다시 확인'));await wait(()=>f.container.textContent.includes(project.name));
   assert.equal(hidden(labelled(f.container,'총괄 작업')),false,'주체/기기 교체 첫 Workspace render는 chat');assert.ok(labelled(f.container,'프로젝트 자료').textContent.includes('선택 단계 없음'));assert.equal(hidden(labelled(f.container,'개발 절차')),true);
  }
  assert.equal(calls.filter(c=>c.method!=='GET').length,0,'문맥교체 자동송신0');
 }finally{await f.close();}
});
test('mobilePane 실제 App 승인 상세는 기존 exact 경로이고 앞3 선택만 mobile home으로 복귀한다',async()=>{
 const f=await fixture();try{
  assert.equal(navItems(f.container)[3]!.getAttribute('href'),`#/projects/${pid}/mobile/approvals`);
  await navigate(`#/projects/${pid}/mobile/approvals/requests/${id(20)}`);assert.equal(navItems(f.container)[3]!.getAttribute('aria-current'),'page');
  await click(navItems(f.container)[1]!);await wait(()=>f.container.textContent.includes(project.name));assert.equal(location.hash,`#/projects/${pid}/mobile`);assert.equal(hidden(labelled(f.container,'개발 절차')),false);
  assert.ok(all(f.container).some(n=>n.getAttribute('href')===`#/projects/${pid}/methodologies`));assert.ok(all(f.container).some(n=>n.getAttribute('href')===`#/projects/${pid}/documents`));assert.equal(calls.filter(c=>c.method!=='GET').length,0);
 }finally{await f.close();}
});

async function selectSecondStage(root:MemoryNode){await click(button(root,'적용 절차 조회'));await wait(()=>all(root).some(n=>n.getAttribute('aria-label')==='절차 정의: 둘째 단계'));await click(labelled(root,'절차 정의: 둘째 단계'));await settle();}
const unhandled:unknown[]=[];const onUnhandled=(e:unknown)=>unhandled.push(e);before(()=>process.on('unhandledRejection',onUnhandled));after(()=>{process.off('unhandledRejection',onUnhandled);assert.deepEqual(unhandled,[]);assert.equal(document.body.childNodes.length,0,'소유 React container 회수');for(const listeners of events.values())assert.equal(listeners.length,0,'App global listener 회수');});

test('mobilePane 실제 anchor는 modifier·중간버튼·이미취소된 click을 가로채지 않고 Enter click은 전환한다',async()=>{
 const f=await fixture();try{
  for(const extra of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1},{defaultPrevented:true}]){
   const target=navItems(f.container)[1]!,e:any={type:'click',button:0,...extra},originalPrevented=!!e.defaultPrevented;
   await ui.React.act(async()=>target.dispatchEvent(e));await settle();assert.equal(!!e.defaultPrevented,originalPrevented,'수정키/비기본/기취소 이벤트의 기본동작 보존');assert.equal(navItems(f.container)[0]!.getAttribute('aria-current'),'page','pane callback0');assert.equal(target.getAttribute('href'),`#/projects/${pid}/mobile`);
  }
  await ui.React.act(async()=>navItems(f.container)[1]!.dispatchEvent({type:'click',button:0,detail:0}));await settle();assert.equal(navItems(f.container)[1]!.getAttribute('aria-current'),'page','키보드 활성화가 생성하는 button0 click 전환');
 }finally{await f.close();}
});

test('mobilePane 실제 App 단계·새대화·PC 왕복 뒤 헌법과 대화출처 패널은 각각 정확 하나다',async()=>{
 const f=await fixture(true,true);try{
  const count=(label:string)=>all(f.container).filter(n=>n.getAttribute('aria-label')===label).length;
  assert.equal(count('프로젝트 적용 헌법'),1,'최초 헌법 한 개');assert.equal(count('사용자 발언·지시 원문 조회'),1,'최초 대화출처 한 개');
  await click(navItems(f.container)[1]!);await selectSecondStage(f.container);await click(navItems(f.container)[0]!);await click(button(f.container,'새 프로젝트 대화'));
  await wait(()=>all(f.container).some(n=>n.getAttribute('aria-label')==='대화 원문'));const textarea=labelled(f.container,'대화 원문');
  // React 소유 onChange를 호출한다. 실제 브라우저 native 입력 증거와 구분한다.
  const props=(textarea as any)[Object.keys(textarea).find(k=>k.startsWith('__reactProps$'))!];assert.equal(typeof props?.onChange,'function');
  await ui.React.act(async()=>props.onChange({target:{value:'중복 패널 재현 합성 대화 초안'}}));await settle();
  await click(navItems(f.container)[2]!);await navigate(`#/projects/${pid}/workspace`);await wait(()=>f.container.textContent.includes(project.name));await navigate(`#/projects/${pid}/mobile`);await wait(()=>f.container.textContent.includes(project.name));await click(navItems(f.container)[2]!);
  assert.equal(labelled(f.container,'대화 원문').value,'중복 패널 재현 합성 대화 초안','실App buffer 보존');assert.equal(labelled(f.container,'절차 정의: 둘째 단계').getAttribute('aria-pressed'),'true');
  assert.equal(count('프로젝트 적용 헌법'),1,'동일 Workspace 렌더 뒤 헌법 패널 중복0');assert.equal(count('사용자 발언·지시 원문 조회'),1,'대화출처 패널 중복0');assert.equal(calls.filter(c=>c.method!=='GET').length,0);
 }finally{await f.close();}
});
