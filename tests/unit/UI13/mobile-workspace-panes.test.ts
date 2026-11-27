import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {HandoffBudget,createControlHandoffEvidenceSource} from '../../../apps/server/modules/control-handoff/control-handoff-evidence-source.ts';
import {issueProtectedHandoffSummary} from '../../../apps/server/modules/control-handoff/control-handoff-protected-summary.ts';
import {createControlRequestSnapshot} from '../../../apps/server/modules/control-handoff/control-request-snapshot.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {fixture as existingApprovalFixture} from '../FN17/notification-fixture.ts';

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
let controlTransport:((path:string,init:RequestInit|undefined)=>Promise<Response>|Response|undefined)|null=null;
let approvalTransport:((path:string)=>Promise<Response>|Response|undefined)|null=null;
const project={id:pid,name:'모바일 합성 프로젝트',purpose:'같은 작업영역 전환',desiredOutcome:'원입력 보존',version:1,createdAt:at,updatedAt:at,currentMethodologyRef:null,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[],viewerPermissions:['READ_PROJECT'],participation:'VIEWER',controlState:{actorId:null,clientId:null,generation:null,status:'UNASSIGNED'}};
const transport:typeof fetch=async(input,init)=>{
 const path=String(input),method=init?.method??'GET';calls.push({path,method});const controlled=controlTransport?.(path,init);if(controlled)return controlled;assert.equal(method,'GET','시험은 조회만 허용한다');
 if(path==='/api/v1/session')return Response.json(identity);
 if(/^\/api\/v1\/projects\/[0-9a-f-]+$/.test(path)){if(denyNextProject){denyNextProject=false;return Response.json({code:'AUTH_REQUIRED'},{status:401});}return Response.json({...project,id:path.split('/').at(-1),currentMethodologyRef:richProject?applicationRef:null,...(projectOwner?{participation:'OWNER',controlState:{actorId:identity.user.id,clientId:identity.clientId,generation:1,status:'HELD'}}:{})});}
 if(path===`/api/v1/projects/${pid}/methodology-application`)return Response.json({projectId:pid,applicationRef:richProject?applicationRef:null,snapshot:richProject?snapshot:null,observedAt:at,executionState:'NOT_CONNECTED'});
 if(path.startsWith(`/api/v1/projects/${pid}/conversations?`))return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:at});
 const stored=approvalTransport?.(path);if(stored)return stored;
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
 location.hash=`#/projects/${pid}/mobile`;identity={user:{id:uid,displayName:'합성 조회자'},clientId:cid,csrfToken:'c'.repeat(43)};denyNextProject=false;richProject=methodology;projectOwner=owner;approvalTransport=null;controlTransport=null;calls.length=0;
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

function storedApproval(){
 const original=existingApprovalFixture().source.request_json,{id:_id,version,status,createdAt,...snapshot}=original;
 snapshot.projectId=pid;
 snapshot.requestedBy={kind:'HUMAN',userId:uid,clientId:cid};snapshot.requiredDecider={kind:'HUMAN',userId:uid};
 snapshot.details.actionScope.requestedSubjectRef=snapshot.requestedBy;
 snapshot.scopeDigest=hash(snapshot.details.actionScope);
 const requestRef={id:id(20),version:1,contentHash:hash(snapshot)},request={id:requestRef.id,version,status,...snapshot,createdAt};
 const approval={request,requestRef,currentVersion:1,storedStatus:'PENDING',effectiveState:'PENDING',decision:null,consumption:null,
  expired:false,basisCurrent:true,executionAuthorized:false,observedAt:at};
 const notification={id:id(21),eventRef:{kind:'APPROVAL_REQUESTED',serverCommandId:id(22),requestRef,channel:'IN_APP',occurredAt:at},
  recipientRef:{kind:'HUMAN',userId:uid},projectRef:{id:pid},severity:'ACTION_REQUIRED',reason:'APPROVAL_REQUESTED',
  authenticatedTarget:{kind:'APPROVAL_REQUEST',projectId:pid,approvalRequestId:requestRef.id},deliveryState:'STORED_IN_APP',readAt:null};
 const page={items:[notification],hasMore:false,nextCursor:null,observedAt:at,baselineVersion:null};
 return {approval,notification,page,list:`/api/v1/projects/${pid}/notifications?limit=50&readState=ALL`,detail:`/api/v1/projects/${pid}/notifications/${notification.id}`,
  approvalPath:`/api/v1/projects/${pid}/approvals/${request.id}`,mobile:`#/projects/${pid}/mobile/approvals/requests/${request.id}`,
  pc:`#/projects/${pid}/approvals/requests/${request.id}`};
}
async function openMobileNotifications(root:MemoryNode){
 await click(navItems(root)[3]!);
 const disclosure=all(root).find(n=>n.tagName==='SUMMARY'&&n.textContent==='보관 승인 알림');
 assert(disclosure,'모바일 승인 탭의 보관 알림');
 await click(disclosure);
 return labelled(root,'본인 프로젝트 승인 알림');
}
test('push_denied_in_app_fallback: 푸시 거부 시 실제 모바일 App의 보관 알림에서 같은 원 승인·위험·복구 내용을 조회한다',async()=>{
 const f=await fixture(),stored=storedApproval();
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'Notification');
 let pushCalls=0;
 Object.defineProperty(globalThis,'Notification',{configurable:true,value:{permission:'denied',requestPermission:()=>{pushCalls++;throw Error('UNEXPECTED_PUSH_PROMPT');}}});
 try{
  approvalTransport=path=>path===stored.list?Response.json(stored.page):path===stored.detail?Response.json(stored.notification):
   path===stored.approvalPath?Response.json(stored.approval):undefined;
  const panel=await openMobileNotifications(f.container);
  assert.equal(calls.filter(v=>v.path.includes('/notifications')||v.path===stored.approvalPath).length,0);
  await click(button(panel,'알림 처음 조회'));await wait(()=>panel.textContent.includes('이번 응답 1건'));
  assert(!all(panel).some(n=>n.getAttribute('href')===stored.mobile));
  await click(button(panel,'알림 상세 조회'));await wait(()=>all(panel).some(n=>n.getAttribute('href')===stored.mobile));
  const selected=labelled(panel,'선택한 승인 알림'),links=all(selected).filter(n=>n.tagName==='A');
  assert.deepEqual(links.map(link=>link.getAttribute('href')),[stored.mobile]);
  assert.match(selected.textContent,/미읽음/);assert.doesNotMatch(selected.textContent,/명시적으로 읽음 표시/);
  assert.equal(calls.filter(v=>v.path===stored.approvalPath).length,0);
  await click(links[0]!);
  assert.equal(location.hash,stored.mobile);
  await wait(()=>f.container.textContent.includes(stored.approval.request.details.reason));
  const mobile=labelled(f.container,'승인 요청 상세').textContent;
  for(const label of [stored.approval.request.id,stored.approval.request.details.reason,...Object.values(stored.approval.request.details.risks),
   stored.approval.request.details.rollback.method,stored.approval.request.details.rollback.limitations])assert(mobile.includes(String(label)));
  assert(!all(f.container).some(n=>n.getAttribute('aria-label')==='본인 프로젝트 승인 알림'));
  await navigate(stored.pc);await wait(()=>f.container.textContent.includes(stored.approval.request.details.reason));
  assert.equal(labelled(f.container,'승인 요청 상세').textContent,mobile);
  const input=labelled(f.container,'결정 이유'),key=Object.keys(input).find(k=>k.startsWith('__reactProps'))!;
  await ui.React.act(async()=>{(input as any)[key].onChange({target:{value:'보존할 확인 의견'}});});
  await navigate(stored.mobile);await wait(()=>f.container.textContent.includes(stored.approval.request.details.reason));
  assert.equal(labelled(f.container,'결정 이유').value,'보존할 확인 의견');
  assert.deepEqual(calls.filter(v=>v.path.includes('/notifications')).map(v=>v.path),[stored.list,stored.detail]);
  assert.equal(pushCalls,0);assert(calls.every(v=>v.method==='GET'));
 }finally{
  if(descriptor)Object.defineProperty(globalThis,'Notification',descriptor);else Reflect.deleteProperty(globalThis,'Notification');
  approvalTransport=null;await f.close();
 }
});

for(const mode of ['listUnavailable','listDenied','wrongProject','wrongRecipient','detailDenied','detailMissing','detailDisconnected','detailPrecondition','changedRequest','sessionExpired'] as const){
 test(`모바일 보관 알림 · ${mode}에서는 원 승인 링크를 표시하지 않는다`,async()=>{
  const f=await fixture(),stored=storedApproval();
  try{
   const detailFailure=['detailDenied','detailMissing','detailDisconnected','detailPrecondition','sessionExpired','changedRequest'].includes(mode);
   const list=structuredClone(stored.page),detail=structuredClone(stored.notification);
   if(mode==='wrongProject'){
    list.items[0]!.projectRef.id=id(91);list.items[0]!.authenticatedTarget.projectId=id(91);
   }else if(mode==='wrongRecipient')list.items[0]!.recipientRef.userId=id(92);
   else if(mode==='changedRequest'){
    detail.eventRef.requestRef.id=id(93);detail.authenticatedTarget.approvalRequestId=id(93);
   }
   const denied=(status:number)=>Response.json({code:status===401?'AUTH_REQUIRED':'ACCESS_DENIED'},{status});
   approvalTransport=path=>{
    if(path===stored.list)return mode==='listUnavailable'?denied(503):mode==='listDenied'?denied(403):Response.json(list);
    if(path!==stored.detail)return;
    if(mode==='detailDisconnected')throw Error('합성 연결 단절');
    if(mode==='detailPrecondition')return denied(412);
    return mode==='detailDenied'?denied(403):mode==='detailMissing'?denied(404):mode==='sessionExpired'?denied(401):Response.json(detail);
   };
   const panel=await openMobileNotifications(f.container);
   await click(button(panel,'알림 처음 조회'));
   if(detailFailure){
    await wait(()=>panel.textContent.includes('이번 응답 1건'));
    await click(button(panel,'알림 상세 조회'));
   }
   if(mode==='sessionExpired')await wait(()=>f.container.textContent.includes('로그인 확인 필요'));
   else{
    await wait(()=>all(panel).some(n=>n.getAttribute('role')==='alert'));
    assert.doesNotMatch(panel.textContent,/조회된 알림이 없습니다/);
    if(mode==='detailDisconnected'||mode==='detailPrecondition'){
     assert.match(panel.textContent,/목록부터 다시 조회하세요/);
     assert.doesNotMatch(panel.textContent,/같은 명령|읽음 정책/);
    }
   }
   assert(!all(f.container).some(n=>n.getAttribute('aria-label')==='선택한 승인 알림'||n.getAttribute('href')===stored.mobile));
   assert.deepEqual(calls.filter(v=>v.path.includes('/notifications')).map(v=>v.path),detailFailure?[stored.list,stored.detail]:[stored.list]);
   assert.equal(calls.filter(v=>v.path===stored.approvalPath).length,0);
   assert(calls.every(v=>v.method==='GET'));
  }finally{approvalTransport=null;await f.close();}
 });
}

for(const [phase,change,status] of [['list','project',200],['detail','direct',401],['detail','settings',200]] as const){
 test(`모바일 보관 알림 · ${phase} 중 ${change} 이동 뒤 지연 ${status}를 폐기한다`,async()=>{
  const f=await fixture(),stored=storedApproval();let release:((response:Response)=>void)|undefined;
  try{
   const gate=()=>new Promise<Response>(resolve=>{release=resolve;});
   approvalTransport=path=>path===stored.list?phase==='list'?gate():Response.json(stored.page):
    path===stored.detail?gate():path===stored.approvalPath?Response.json(stored.approval):undefined;
   const panel=await openMobileNotifications(f.container);
   await click(button(panel,'알림 처음 조회'));
   if(phase==='detail'){
    await wait(()=>panel.textContent.includes('이번 응답 1건'));
    await click(button(panel,'알림 상세 조회'));
   }
   await wait(()=>!!release);
   const destination=change==='project'?`#/projects/${id(96)}/mobile/approvals`:change==='settings'?`#/projects/${pid}/settings`:stored.mobile;
   await navigate(destination);
   if(change==='direct')await wait(()=>f.container.textContent.includes(stored.approval.request.details.reason));
   await ui.React.act(async()=>release!(status===401?Response.json({code:'AUTH_REQUIRED'},{status}):Response.json(phase==='list'?stored.page:stored.notification)));
   await settle();
   assert.equal(location.hash,destination);
   assert.doesNotMatch(f.container.textContent,/로그인 확인 필요|이번 응답 1건/);
   assert(!all(f.container).some(n=>n.getAttribute('aria-label')==='선택한 승인 알림'));
   assert(calls.every(v=>v.method==='GET'));
  }finally{release?.(Response.json(stored.notification));approvalTransport=null;await f.close();}
 });
}

test('모바일 직접 승인 링크는 재접속 후 같은 원문을 조회하고 설정의 기존 알림 동선을 보존한다',async()=>{
 const f=await fixture(),stored=storedApproval();let authDenied=true;
 try{
  approvalTransport=path=>path===stored.approvalPath?authDenied?Response.json({code:'AUTH_REQUIRED'},{status:401}):Response.json(stored.approval):
   path===stored.list?Response.json(stored.page):path===stored.detail?Response.json(stored.notification):undefined;
  await navigate(stored.mobile);await wait(()=>f.container.textContent.includes('로그인 확인 필요'));
  assert.equal(location.hash,stored.mobile);
  authDenied=false;
  await click(button(f.container,'접근 상태 다시 확인'));
  await wait(()=>f.container.textContent.includes(stored.approval.request.details.reason));
  assert.equal(location.hash,stored.mobile);
  assert.equal(calls.filter(v=>v.path.includes('/notifications')).length,0);
  assert.equal(calls.filter(v=>v.path==='/api/v1/session').length,2);
  await navigate(`#/projects/${pid}/settings`);
  const panel=labelled(f.container,'본인 프로젝트 승인 알림');
  await click(button(panel,'알림 처음 조회'));await wait(()=>panel.textContent.includes('이번 응답 1건'));
  await click(button(panel,'알림 상세 조회'));
  await wait(()=>all(panel).some(n=>n.getAttribute('href')===stored.mobile));
  const selected=labelled(panel,'선택한 승인 알림');
  assert.deepEqual(all(selected).filter(n=>n.tagName==='A').map(n=>n.getAttribute('href')),[stored.pc,stored.mobile]);
  assert(button(selected,'명시적으로 읽음 표시'));
  assert(calls.every(v=>v.method==='GET'));
 }finally{approvalTransport=null;await f.close();}
});

async function selectSecondStage(root:MemoryNode){await click(button(root,'적용 절차 조회'));await wait(()=>all(root).some(n=>n.getAttribute('aria-label')==='절차 정의: 둘째 단계'));await click(labelled(root,'절차 정의: 둘째 단계'));await settle();}
async function documentPreparationFixture(){
 let currentProject=pid,currentRef={...applicationRef},available=true,prepared=0,lost=0;
 let held:Promise<Response>|null=null;const requests:string[]=[];
 const client=new ui.ApiClient(async(input:any,init:any)=>{
  assert.equal(init?.method??'GET','GET');const path=String(input);requests.push(path);
  if(path===`/api/v1/projects/${currentProject}`){if(held){const p=held;held=null;return p;}return Response.json({...project,id:currentProject,currentMethodologyRef:currentRef,participation:'OWNER',controlState:{actorId:uid,clientId:cid,generation:1,status:'HELD'}});}
  if(path.endsWith('/methodology-application'))return Response.json({projectId:currentProject,applicationRef:currentRef,snapshot,observedAt:at,executionState:'NOT_CONNECTED'});
  if(path.includes('/conversations?'))return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:at});
  return Response.json({code:'SYNTHETIC_NOT_SELECTED'},{status:403});
 });
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 const render=async()=>{await ui.React.act(async()=>root.render(ui.React.createElement(ui.WorkspacePage,{client,projectId:currentProject,session,assignmentBuffer:null,onAssignmentChange:()=>assert.fail('임무 변경 금지'),conversationBuffer:null,onConversationChange:()=>assert.fail('대화 변경 금지'),onAuthenticationLost:()=>lost++,documentPreparation:{available,onPrepared:()=>prepared++}})));await settle();};
 await render();await wait(()=>container.textContent.includes(project.name));
 const select=async()=>{await click(button(container,'적용 절차 조회'));await wait(()=>all(container).some(n=>n.getAttribute('aria-label')==='절차 정의: 첫 단계'));};await select();
 return{container,requests,select,render,hold(p:Promise<Response>){held=p;},async changeProject(){currentProject=id(91);await render();await wait(()=>container.textContent.includes(project.name));await select();},nextApplication(){currentRef={...currentRef,version:currentRef.version+1};},async setAvailable(value:boolean){available=value;await render();},get prepared(){return prepared;},get lost(){return lost;},async close(){await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
const preparationVisible=(root:MemoryNode)=>all(root).some(n=>n.getAttribute('aria-label')==='방법론 산출문서 초안 준비');
test('단계 문서 준비는 같은 단계 재선택만 유지하고 A→B→A에는 명시 클릭이 필요하다',async()=>{
 const f=await documentPreparationFixture();try{
  assert.equal(preparationVisible(f.container),false);await click(button(f.container,'선택 단계 산출문서 작성'));assert.equal(preparationVisible(f.container),true);
  const originalForm=labelled(f.container,'방법론 산출문서 초안 준비');await click(labelled(f.container,'절차 정의: 첫 단계'));assert.equal(labelled(f.container,'방법론 산출문서 초안 준비')===originalForm,true);
  await click(labelled(f.container,'절차 정의: 둘째 단계'));assert.equal(preparationVisible(f.container),false,'B 폼 자동 열기 금지');
  await click(labelled(f.container,'절차 정의: 첫 단계'));assert.equal(preparationVisible(f.container),false,'A 복귀도 다시 클릭 필요');
  await click(button(f.container,'선택 단계 산출문서 작성'));assert.equal(preparationVisible(f.container),true);await click(button(f.container,'단계 문서 준비 닫기'));assert.equal(preparationVisible(f.container),false);assert.equal(f.prepared,0);
 }finally{await f.close();}
});
test('단계 문서 준비는 절차·원본 새로고침과 적용 세대·프로젝트 교체 후 자동 재개하지 않는다',async()=>{
 const f=await documentPreparationFixture();try{
  await click(button(f.container,'선택 단계 산출문서 작성'));await click(button(f.container,'적용 절차 새로고침'));await wait(()=>all(f.container).some(n=>n.getAttribute('aria-label')==='절차 정의: 첫 단계'));assert.equal(preparationVisible(f.container),false);
  for(const next of [false,true]){await click(button(f.container,'선택 단계 산출문서 작성'));if(next)f.nextApplication();await click(button(f.container,'프로젝트 원본 새로고침'));await wait(()=>all(f.container).some(n=>n.tagName==='BUTTON'&&n.textContent==='적용 절차 조회'));await f.select();assert.equal(preparationVisible(f.container),false);}
  await click(button(f.container,'선택 단계 산출문서 작성'));await f.changeProject();assert.equal(preparationVisible(f.container),false);
  await click(button(f.container,'선택 단계 산출문서 작성'));await f.setAvailable(false);assert.equal(button(f.container,'선택 단계 산출문서 작성').disabled,true);await f.setAvailable(true);assert.equal(preparationVisible(f.container),false,'준비 가능 상태로 복귀해도 자동 열기 금지');assert.equal(f.prepared,0);
 }finally{await f.close();}
});
test('이전 단계 준비 조회의 늦은 응답은 새 단계 폼·외부 버퍼·인증에 반영하지 않는다',async()=>{
 for(const status of [200,401]){
  const f=await documentPreparationFixture();try{
   await click(button(f.container,'선택 단계 산출문서 작성'));let resolve!:(r:Response)=>void;f.hold(new Promise(r=>{resolve=r;}));
   await click(button(f.container,'적용 단계의 산출문서 조회'));await click(labelled(f.container,'절차 정의: 둘째 단계'));
   const before=f.requests.length;await ui.React.act(async()=>resolve(status===401?Response.json({code:'AUTH_REQUIRED'},{status}):Response.json({id:pid,currentMethodologyRef:applicationRef})));await settle();
   assert.equal(preparationVisible(f.container),false);assert.equal(f.requests.length,before,'이전 준비의 후속 조회 금지');assert.equal(f.prepared,0);assert.equal(f.lost,0);
  }finally{await f.close();}
 }
});
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


test('모바일 제어권 명시 진입은 기존 네 탐색과 같은 App 보호 화면을 사용한다',async()=>{
 const f=await fixture();try{
  const open=all(f.container).find(n=>n.tagName==='A'&&n.textContent==='제어권');assert(open,'모바일 별도 제어권 창');
  assert.equal(navItems(f.container).length,4);const before=calls.length;
  await click(open);await wait(()=>all(f.container).some(n=>n.getAttribute('aria-label')==='작업 권한 인계'));
  assert.equal(location.hash,'#/projects/'+pid+'/mobile');assert.equal(all(f.container).filter(n=>n.getAttribute('aria-label')==='작업 권한 인계').length,1);
  assert.equal(calls.filter(c=>c.path.includes('/control-')).length,0,'진입 자동 control GET0');assert.equal(calls.filter(c=>c.method==='POST').length,0);
  assert(calls.length>=before);await click(navItems(f.container)[0]!);await wait(()=>all(f.container).some(n=>n.getAttribute('aria-label')==='총괄 작업'));
  assert.equal(all(f.container).filter(n=>n.getAttribute('aria-label')==='작업 권한 인계').length,0);
 }finally{await f.close();}
});


function handler(node:MemoryNode,name='onClick'){const key=Object.keys(node).find(k=>k.startsWith('__reactProps'));assert(key);return (node as any)[key][name] as Function;}
function controlState(){return{schemaVersion:1,projectId:pid,actorId:uid,clientId:cid,observedAt:at,participation:'OWNER',control:{state:'OTHER_CLIENT',basis:{actorId:uid,clientId:id(70),generation:2,version:7}},executionAuthorized:false,controlTransferred:false};}
async function openMobileControl(root:MemoryNode){const n=all(root).find(n=>n.tagName==='A'&&n.textContent==='제어권');assert(n);await click(n);await wait(()=>all(root).some(n=>n.getAttribute('aria-label')==='작업 권한 인계'));return labelled(root,'작업 권한 인계');}
async function controlInput(root:MemoryNode,label:string,value:string){const parent=all(root).find(n=>n.tagName==='LABEL'&&n.textContent===label);assert(parent,label);const input=parent.childNodes.find(n=>['INPUT','TEXTAREA'].includes(n.tagName));assert(input);await ui.React.act(async()=>handler(input,'onChange')({target:{value}}));await settle();}
for(const lost of [false,true])test('모바일·PC 제어권의 READY/UNKNOWN은 같은 원 요청과 App CAS를 보존 · '+lost,{timeout:15000},async()=>{
 const f=await fixture(false,true),posts:{body:string;key:string|null}[]=[];let lose=lost,record:ReturnType<typeof createControlRequestSnapshot>|null=null;
 try{
  controlTransport=(path,init)=>{
   if(path.endsWith('/control-state'))return Response.json(controlState());
   if(path.endsWith('/control-requests')&&init?.method==='POST'){
    const c=JSON.parse(String(init.body));posts.push({body:String(init.body),key:new Headers(init.headers).get('Idempotency-Key')});
    assert.equal(c.operation,'requestControl');assert.equal(c.projectId,pid);assert.equal(c.clientId,cid);assert.deepEqual(c.payload.targetActorRef,{userId:uid});assert.deepEqual(c.payload.targetClientRef,{userId:uid,clientId:cid});
    record=createControlRequestSnapshot({id:id(71),projectId:pid,requestedBy:{actorId:uid,clientId:cid},input:c.payload,createdAt:at});
    const response=Response.json({...record,receipt:{schemaVersion:1,commandId:c.commandId,commandHash:hash(c),projectId:pid,actorId:uid,clientId:cid,requestRef:record.requestRef,outcome:'REQUEST_STORED'}});
    if(lose){lose=false;return Promise.reject(new TypeError('합성 응답 유실'));}return response;
   }
   if(path.includes('/control-requests/')&&record)return Response.json({projectId:pid,...record,observedAt:at,current:{expired:false,baseControlState:'MATCHED'},executionAuthorized:false,controlTransferred:false});
   return undefined;
  };
  let panel=await openMobileControl(f.container);assert.equal(posts.length,0);await click(button(panel,'현재 제어 조회'));await wait(()=>panel.textContent.includes('OTHER_CLIENT'));
  await controlInput(panel,'인수 요청 이유','같은 원 기기의 명시 인수 요청');await controlInput(panel,'요청 만료 시각 (UTC)','2026-10-31T00:20:00.000Z');await click(button(panel,'인수 요청 명령 보존'));await wait(()=>panel.textContent.includes('인수 요청 · READY'));const oldSend=handler(button(panel,'보존한 명령 전송'));
  location.hash='#/projects/'+pid+'/control';await ui.React.act(async()=>oldSend());assert.equal(posts.length,0,'raw 이탈·commit 전 READY 전송0');
  await navigate(location.hash);await wait(()=>all(f.container).some(n=>n.getAttribute('aria-label')==='작업 권한 인계'));panel=labelled(f.container,'작업 권한 인계');assert.equal(all(f.container).filter(n=>n.getAttribute('aria-label')==='작업 권한 인계').length,1);assert.match(panel.textContent,/인수 요청 · READY/);assert.equal(posts.length,0);
  await ui.React.act(async()=>oldSend());assert.equal(posts.length,0,'옛 모바일 callback 전송0');
  await click(button(panel,'보존한 명령 전송'));await wait(()=>panel.textContent.includes(lost?'인수 요청 · UNKNOWN':'인수 요청 · CONFIRMED'));assert.equal(posts.length,1);const original=posts[0]!;
  await navigate('#/projects/'+pid+'/mobile');panel=await openMobileControl(f.container);assert.match(panel.textContent,lost?/인수 요청 · UNKNOWN/:/인수 요청 · CONFIRMED/);assert.match(panel.textContent,/같은 원 기기의 명시 인수 요청/);assert.equal(posts.length,1);
  if(lost){await click(button(panel,'같은 명령 결과 재확인'));await wait(()=>panel.textContent.includes('인수 요청 · CONFIRMED'));assert.deepEqual(posts[1],original,'같은 JSON·commandId·멱등키만 명시 재확인');}
  assert.equal(button(panel,'인수 수락 명령 보존').disabled,true,'요청 저장은 수락·현재 권한이 아님');assert.match(panel.textContent,/미확인 자료로 권한을 부여하지 않습니다/);
  const before=posts.length;await navigate('#/projects/'+id(95)+'/mobile');await openMobileControl(f.container);assert.doesNotMatch(labelled(f.container,'작업 권한 인계').textContent,/같은 원 기기의 명시 인수 요청/);assert.equal(posts.length,before,'타 프로젝트 버퍼/전송0');
 }finally{controlTransport=null;await f.close();}
});
for(const status of [200,401])test('모바일 제어권 raw 주소 이탈의 늦은 '+status+'와 옛 읽기·편집·전송은 효과0',{timeout:15000},async()=>{
 const f=await fixture(false,true);let release:((r:Response)=>void)|undefined;let reads=0;
 try{
  controlTransport=path=>path.endsWith('/control-state')?(reads++,new Promise<Response>(resolve=>{release=resolve;})):undefined;
  const panel=await openMobileControl(f.container),oldRead=handler(button(panel,'현재 제어 조회'));
  const label=all(panel).find(n=>n.tagName==='TEXTAREA')!,oldEdit=handler(label,'onChange');
  await click(button(panel,'현재 제어 조회'));await wait(()=>!!release);assert.equal(reads,1);
  location.hash='#/projects/'+pid+'/control'; // hashchange/React가 아직 이전 모바일 화면을 유지한다.
  await ui.React.act(async()=>{oldRead();oldEdit({target:{value:'옛 편집 금지'}});release!(status===401?Response.json({code:'AUTH_REQUIRED'},{status:401}):Response.json(controlState()));await new Promise(r=>setImmediate(r));});
  assert.equal(reads,1,'raw 이탈 뒤 옛 읽기 GET0');assert.doesNotMatch(f.container.textContent,/OTHER_CLIENT|옛 편집 금지|로그인 확인 필요/);assert.equal(calls.filter(c=>c.method==='POST').length,0);
  await navigate(location.hash);await wait(()=>all(f.container).some(n=>n.getAttribute('aria-label')==='작업 권한 인계'));assert.doesNotMatch(labelled(f.container,'작업 권한 인계').textContent,/OTHER_CLIENT|옛 편집 금지/);
  controlTransport=path=>path.endsWith('/control-state')?Response.json(controlState()):undefined;await click(button(f.container,'현재 제어 조회'));await wait(()=>f.container.textContent.includes('OTHER_CLIENT'));
 }finally{release?.(Response.json(controlState()));controlTransport=null;await f.close();}
});


test('같은 모바일 App의 고정 보호요약 UNKNOWN은 명시 GET만이며 인수 수락을 열지 않는다',{timeout:15000},async()=>{
 const f=await fixture(false,true),basis=controlState().control.basis,input={targetActorRef:{userId:uid},targetClientRef:{userId:uid,clientId:cid},baseControl:basis,reason:'보호요약의 원 요청',expiresAt:'2026-10-31T00:20:00.000Z'},request=createControlRequestSnapshot({id:id(80),projectId:pid,requestedBy:{actorId:uid,clientId:cid},input,createdAt:at});
 const scope={projectId:pid,requestRef:request.requestRef,baseControl:basis,sessionId:id(81),actorId:uid,clientId:basis.clientId},lease=new HandoffBudget(30000,{now:()=>Date.parse(at),monotonic:()=>0});
 const db={query:async()=>({rows:[{packet:{projectId:pid,requestRef:request.requestRef,baseControl:basis,writer:{head:null,events:[],commands:[],receipts:[],audits:[],approvals:[]},executions:[],pendingCommands:[],pendingApprovals:[],checkpoints:[],proofBasis:null}}]})};
 try{
  const evidence=await createControlHandoffEvidenceSource().collect(db as never,scope,lease),summary=issueProtectedHandoffSummary({scope,request:request.snapshot,version:1,observedAt:at,evidence},db,lease);await lease.close();assert.equal(summary.snapshot.transferState,'UNKNOWN');
  controlTransport=(path,init)=>{
   assert.notEqual(init?.method,'POST','보호요약 조회는 요청·준비·수락 자동 POST0');
   if(path.endsWith('/control-state'))return Response.json(controlState());
   if(path.includes('/control-requests?'))return Response.json({projectId:pid,view:'OWN',limit:50,observedAt:at,items:[{requestRef:request.requestRef,createdAt:at,expiresAt:input.expiresAt,storedState:'PENDING',current:{expired:false,baseControlState:'MATCHED'},executionAuthorized:false,controlTransferred:false}],hasMore:false,nextCursor:null,executionAuthorized:false,controlTransferred:false});
   if(path.includes('/protected-handoff-summaries/head?'))return Response.json({schemaVersion:2,purpose:'CONTROL_HANDOFF_PROTECTED_HEAD',projectId:pid,requestRef:request.requestRef,observedAt:at,head:{state:'AVAILABLE',summaryRef:summary.ref},executionAuthorized:false,dispatchPerformed:false,controlTransferred:false});
   if(path.includes('/protected-handoff-summaries/1?'))return Response.json(summary);
   if(path.includes('/control-requests/'+request.requestRef.id+'/versions/1?'))return Response.json({projectId:pid,...request,observedAt:at,current:{expired:false,baseControlState:'MATCHED'},executionAuthorized:false,controlTransferred:false});
   return undefined;
  };
  const panel=await openMobileControl(f.container);await click(button(panel,'현재 제어 조회'));await wait(()=>panel.textContent.includes('OTHER_CLIENT'));await click(button(panel,'내 요청 목록 조회'));await wait(()=>panel.textContent.includes('요청 1 원문 확인'));await click(button(panel,'요청 1 원문 확인'));await wait(()=>panel.textContent.includes(input.reason));
  assert.equal(calls.filter(c=>c.path.includes('/protected-handoff-summaries')).length,0);await click(button(panel,'최신 보호요약 고정 원문 조회'));await wait(()=>panel.textContent.includes('보호 검산 UNKNOWN'));
  assert.equal(calls.filter(c=>c.path.includes('/protected-handoff-summaries')).length,2);assert.equal(button(panel,'인수 수락 명령 보존').disabled,true);assert.equal(calls.filter(c=>c.method==='POST').length,0);assert.match(panel.textContent,/보관 원문 조회만으로 현재 수락 권한을 만들지 않습니다/);
 }finally{await lease.close();controlTransport=null;await f.close();}
});
for(const status of [200,401])test('모바일 제어권 전달된 route ABA 뒤 옛 결과 '+status+'는 새 surface에 적용0',{timeout:15000},async()=>{
 const f=await fixture(false,true);let release:((r:Response)=>void)|undefined;
 try{
  controlTransport=path=>path.endsWith('/control-state')?new Promise<Response>(r=>{release=r;}):undefined;
  const panel=await openMobileControl(f.container);await click(button(panel,'현재 제어 조회'));await wait(()=>!!release);
  await ui.React.act(async()=>{
   location.hash='#/projects/'+pid+'/control';for(const fn of events.get('hashchange')??[])fn();
   location.hash='#/projects/'+pid+'/mobile';for(const fn of events.get('hashchange')??[])fn();
   release!(status===401?Response.json({code:'AUTH_REQUIRED'},{status:401}):Response.json(controlState()));await new Promise(r=>setImmediate(r));
  });
  assert.doesNotMatch(f.container.textContent,/OTHER_CLIENT|로그인 확인 필요/);assert.equal(calls.filter(c=>c.method==='POST').length,0);
  controlTransport=path=>path.endsWith('/control-state')?Response.json(controlState()):undefined;await click(button(f.container,'현재 제어 조회'));await wait(()=>f.container.textContent.includes('OTHER_CLIENT'));
 }finally{release?.(Response.json(controlState()));controlTransport=null;await f.close();}
});


test('현재 모바일 제어권 재선택은 진행 중 원 조회의 owner와 완료를 보존한다',{timeout:15000},async()=>{
 const f=await fixture(false,true);let release:((r:Response)=>void)|undefined;let reads=0;
 try{
  controlTransport=path=>path.endsWith('/control-state')?(reads++,new Promise<Response>(r=>{release=r;})):undefined;
  const panel=await openMobileControl(f.container);await click(button(panel,'현재 제어 조회'));await wait(()=>!!release);await openMobileControl(f.container);assert.equal(labelled(f.container,'작업 권한 인계'),panel,'동일 pane remount0');assert.equal(reads,1);
  await ui.React.act(async()=>{release!(Response.json(controlState()));await new Promise(r=>setImmediate(r));});await wait(()=>panel.textContent.includes('OTHER_CLIENT'));assert.equal(button(panel,'현재 제어 조회').disabled,false);assert.equal(reads,1);assert.equal(calls.filter(c=>c.method==='POST').length,0);
 }finally{release?.(Response.json(controlState()));controlTransport=null;await f.close();}
});
