import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
/** 실제 ReactDOM의 요소/이벤트/effect를 실행하는 최소 메모리 DOM. 레이아웃·브라우저 보안·시각 검증은 아니다. */
class MemoryNode{
 nodeType:number;nodeName:string;tagName:string;localName:string;namespaceURI='http://www.w3.org/1999/xhtml';parentNode:MemoryNode|null=null;childNodes:MemoryNode[]=[];ownerDocument:any;attributes=new Map<string,string>();style:Record<string,unknown>={};listeners=new Map<string,Function[]>();value='';selected=false;checked=false;disabled=false;data='';
 constructor(name:string,type=1,owner?:any){this.nodeType=type;this.nodeName=type===1?name.toUpperCase():name;this.tagName=this.nodeName;this.localName=name;this.ownerDocument=owner;}
 get options():MemoryNode[]{return this.childNodes.flatMap(n=>n.tagName==='OPTION'?[n]:n.options);}
 get firstChild():MemoryNode|null{return this.childNodes[0]??null;}get lastChild():MemoryNode|null{return this.childNodes.at(-1)??null;}get nextSibling():MemoryNode|null{const a=this.parentNode?.childNodes;return a?.[a.indexOf(this)+1]??null;}
 get nodeValue():string|null{return this.nodeType===3?this.data:null;}set nodeValue(v:string|null){if(this.nodeType===3)this.data=v??'';}
 get textContent():string{return this.nodeType===3?this.data:this.childNodes.map(n=>n.textContent).join('');}
 set textContent(v:string){if(this.nodeType===3){this.data=String(v);return;}for(const n of this.childNodes)n.parentNode=null;this.childNodes=[];if(v)this.appendChild(this.ownerDocument.createTextNode(String(v)));}
 appendChild(n:MemoryNode){if(n.parentNode)n.parentNode.removeChild(n);n.parentNode=this;this.childNodes.push(n);return n;}
 insertBefore(n:MemoryNode,b:MemoryNode){if(n.parentNode)n.parentNode.removeChild(n);n.parentNode=this;const i=this.childNodes.indexOf(b);assert(i>=0);this.childNodes.splice(i,0,n);return n;}
 removeChild(n:MemoryNode){const i=this.childNodes.indexOf(n);assert(i>=0);this.childNodes.splice(i,1);n.parentNode=null;return n;}
 setAttribute(k:string,v:unknown){this.attributes.set(k,String(v));if(k==='disabled')this.disabled=true;if(k==='value'&&this.tagName==='OPTION')this.value=String(v);}removeAttribute(k:string){this.attributes.delete(k);if(k==='disabled')this.disabled=false;}getAttribute(k:string){return this.attributes.get(k)??null;}
 addEventListener(k:string,f:Function){this.listeners.set(k,[...(this.listeners.get(k)??[]),f]);}removeEventListener(k:string,f:Function){this.listeners.set(k,(this.listeners.get(k)??[]).filter(v=>v!==f));}
 contains(n:MemoryNode|null):boolean{return !!n&&(n===this||this.childNodes.some(c=>c.contains(n)));}focus(){this.ownerDocument.activeElement=this;}
 dispatchEvent(e:any){e.target=this;e.preventDefault??=()=>{e.defaultPrevented=true;};e.stopPropagation??=()=>{e.cancelBubble=true;};const chain:MemoryNode[]=[];for(let n:MemoryNode|null=this;n;n=n.parentNode)chain.push(n);for(const n of chain)for(const f of n.listeners.get(e.type)??[])f(e);return !e.defaultPrevented;}
}
const document:any=new MemoryNode('#document',9);document.ownerDocument=document;document.createElement=(n:string)=>new MemoryNode(n,1,document);document.createElementNS=(_ns:string,n:string)=>document.createElement(n);document.createTextNode=(s:string)=>{const n=new MemoryNode('#text',3,document);n.data=s;return n;};document.documentElement=document.createElement('html');document.body=document.createElement('body');document.documentElement.appendChild(document.body);document.activeElement=document.body;

const saved=new Map<string,PropertyDescriptor|undefined>(),events=new Map<string,Set<Function>>(),channels:MessageChannel[]=[];
let ui:any,currentTransport:typeof fetch;
const location={hash:'',protocol:'https:',origin:'https://anvil-synthetic.invalid'};
before(async()=>{
 const app=fileURLToPath(new URL('../../../apps/web/src/App.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:applied-stage-handoff',name:'AppliedStageHandoffApp',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'applied-stage-handoff-memory',resolveId(id){if(id.endsWith('virtual:applied-stage-handoff'))return '\0applied-stage-handoff';},load(id){if(id==='\0applied-stage-handoff')return `export * as React from 'react';export {createRoot} from 'react-dom/client';export {App} from ${JSON.stringify(app)};`;}}]});
 const Native=globalThis.MessageChannel;class Channel extends Native{constructor(){super();channels.push(this);}}
 const add=(k:string,f:Function)=>{let set=events.get(k);if(!set)events.set(k,set=new Set());set.add(f);},remove=(k:string,f:Function)=>events.get(k)?.delete(f),window={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener:add,removeEventListener:remove,getComputedStyle:()=>({}),location};document.defaultView=window;
 for(const[k,v]of Object.entries({window,document,location,addEventListener:add,removeEventListener:remove,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:Channel,confirm:()=>true,fetch:(...args:Parameters<typeof fetch>)=>currentTransport(...args)})){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((v:any)=>v.type==='chunk').code+';return AppliedStageHandoffApp;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});
const H=(v:unknown)=>contentHash(canonicalJson(v));
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}

const id=(value:number)=>'ed120000-0000-4000-8000-'+String(value).padStart(12,'0');
const pid=id(1),uid=id(2),cid=id(3),aid=id(4),at='2026-11-12T00:00:00.000Z',base='/api/v1/projects/'+pid;
const methodRoute='#/projects/'+pid+'/methodologies',workRoute='#/projects/'+pid+'/workspace';
const preparedLabel='이 단계 준비 열기',selectedLabel='선택 정의: 고정 인계 단계';
function applied(version=1){
 const node=(nodeId:string,name:string)=>({nodeId,name,purpose:'합성 적용 정의',kind:'AGENT',position:{x:0,y:0},role:'STAGE_OWNER',inputs:[],outputs:[],taskScope:{included:['개발'],excluded:['운영']},completionCriteria:['검수'],approvalBoundary:[],mode:'CASE_BY_CASE',limitPolicyRef:null,recordRequirements:['현황']});
 const graph={nodes:[node('N1','고정 첫 단계'),node('N2','고정 인계 단계')],edges:[{edgeId:'next',fromNodeId:'N1',toNodeId:'N2',kind:'SEQUENCE',condition:null,reason:'후속'}],entryNodeId:'N1',terminalNodeIds:['N2']};
 const snapshot={name:'합성 적용 세대 '+version,purpose:'단계 인계 시험',graph,sourceRef:{id:id(5),version:1,contentHash:H(graph)}};
 return {projectId:pid,applicationRef:{id:aid,version,contentHash:H(snapshot)},snapshot,executionState:'NOT_CONNECTED',observedAt:at};
}
async function mount(participation:'OWNER'|'VIEWER'='VIEWER',initial=methodRoute){
 const original=applied(),calls:{path:string;method:string;hash:string}[]=[],unexpected:string[]=[];
 const me={user:{id:uid,displayName:'합성 조회자'},clientId:cid,csrfToken:'c'.repeat(43)};
 const project={id:pid,name:'합성 적용 프로젝트',purpose:'기존 읽기 연동',desiredOutcome:'정확 단계 준비',version:1,createdAt:at,updatedAt:at,currentMethodologyRef:original.applicationRef,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[],viewerPermissions:['READ_PROJECT'],participation,
  controlState:participation==='OWNER'?{actorId:uid,clientId:cid,generation:1,status:'HELD'}:{actorId:null,clientId:null,generation:null,status:'UNASSIGNED'}};
 let destinationProject=()=>Promise.resolve(Response.json(project)),destinationApplication=()=>Promise.resolve(Response.json(original));
 currentTransport=async(url,init)=>{
  const path=String(url),method=init?.method??'GET',hash=location.hash;calls.push({path,method,hash});assert.equal(method,'GET');
  if(path==='/api/v1/session')return Response.json(me);
  if(path===base)return hash===workRoute?destinationProject():Response.json(project);
  if(path===base+'/methodologies?limit=20')return Response.json({projectId:pid,items:[],hasMore:false,nextAfterId:null,observedAt:at,applicationTransition:'EXECUTION_STATE_UNVERIFIED'});
  if(path==='/api/v1/methodologies')return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:at,baselineVersion:null});
  if(path===base+'/methodology-application')return hash===workRoute?destinationApplication():Response.json(original);
  if(path.includes('/conversations?'))return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:at});
  unexpected.push(path);return Response.json({code:'NOT_FOUND'},{status:404});
 };
 location.hash=initial;
 const container=document.createElement('main');document.body.appendChild(container);const root=ui.createRoot(container);
 const nodes=(node:MemoryNode=container):MemoryNode[]=>[node,...node.childNodes.flatMap(c=>nodes(c))];
 const button=(label:string)=>nodes().find(n=>n.tagName==='BUTTON'&&(n.textContent===label||n.getAttribute('aria-label')===label));
 const flush=async()=>ui.React.act(async()=>{await new Promise(resolve=>setImmediate(resolve));});
 const until=async(condition:()=>boolean)=>{const end=Date.now()+2000;while(!condition()&&Date.now()<end)await flush();assert(condition(),container.textContent);};
 const click=async(label:string)=>{const node=button(label);assert(node&&!node.disabled,label);await ui.React.act(async()=>node.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const announceRoute=async()=>ui.React.act(async()=>{for(const listener of events.get('hashchange')??[])listener();});
 const go=async(hash:string)=>{location.hash=hash;await announceRoute();await flush();};
 await ui.React.act(async()=>root.render(ui.React.createElement(ui.App)));
 return {calls,unexpected,original,project,container,nodes,button,click,until,go,announceRoute,flush,
  holdProject(fn:typeof destinationProject){destinationProject=fn;},holdApplication(fn:typeof destinationApplication){destinationApplication=fn;},
  close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
async function chooseSecond(f:Awaited<ReturnType<typeof mount>>){
 await f.until(()=>!!f.button('현재 적용 절차 원문 보기'));await f.click('현재 적용 절차 원문 보기');
 await f.until(()=>f.container.textContent.includes('고정 첫 단계'));
 assert(!f.button(preparedLabel)||f.button(preparedLabel)!.disabled,'기본 표시 노드는 명시 선택이 아니다');
 const picker=f.nodes().find(n=>n.tagName==='SELECT'&&n.options.some(o=>o.textContent.includes('고정 인계 단계')));assert(picker);
 const react=Object.keys(picker).find(k=>k.startsWith('__reactProps$'));assert(react);
 await ui.React.act(async()=>(picker as any)[react].onChange({target:{value:'N2'}}));
}
const destinationApplicationReads=(f:Awaited<ReturnType<typeof mount>>)=>f.calls.filter(c=>c.hash===workRoute&&c.path===base+'/methodology-application');

test('App에서 명시 선택한 고정 노드는 Workspace 보호 프로젝트와 적용본 뒤 한 번만 선택된다',async()=>{
 const f=await mount('OWNER');
 try{
  await chooseSecond(f);assert.equal(destinationApplicationReads(f).length,0);
  const held=deferred<Response>();f.holdApplication(()=>held.promise);
  await f.click(preparedLabel);assert.equal(location.hash,workRoute);await f.announceRoute();
  await f.until(()=>destinationApplicationReads(f).length===1);
  assert(f.calls.findIndex(c=>c.hash===workRoute&&c.path===base)<f.calls.indexOf(destinationApplicationReads(f)[0]!));
  assert(!f.container.textContent.includes(selectedLabel));
  held.resolve(Response.json(f.original));
  await f.until(()=>f.container.textContent.includes(selectedLabel));
  assert.equal(f.button('절차 정의: 고정 인계 단계')?.getAttribute('aria-pressed'),'true');
  assert.equal(f.button('절차 정의: 고정 첫 단계')?.getAttribute('aria-pressed'),'false');
  assert.equal(f.button('선택 단계 산출문서 작성')?.disabled,false);
  assert(!f.nodes().some(n=>n.getAttribute('aria-label')==='방법론 산출문서 초안 준비'));
  f.holdApplication(async()=>Response.json(f.original));
  await f.go(methodRoute);await f.go(workRoute);await f.until(()=>!!f.button('적용 절차 조회'));
  assert(!f.container.textContent.includes(selectedLabel));
  await f.click('적용 절차 조회');await f.until(()=>f.container.textContent.includes('선택 정의: 고정 첫 단계'));
  assert(f.calls.every(c=>c.method==='GET'));assert.deepEqual(f.unexpected,[]);
 }finally{await f.close();}
});

test('목적지 프로젝트나 적용본이 다른 버전이면 자동 선택·entry fallback이 없다',async()=>{
 for(const failure of ['PROJECT','PROJECT_HASH','APPLICATION']){
  const f=await mount();
  try{
   await chooseSecond(f);
   if(failure==='PROJECT')f.holdProject(async()=>Response.json({...f.project,currentMethodologyRef:applied(2).applicationRef}));
   if(failure==='PROJECT_HASH')f.holdProject(async()=>Response.json({...f.project,currentMethodologyRef:{...f.original.applicationRef,contentHash:'e'.repeat(64)}}));
   if(failure==='APPLICATION')f.holdApplication(async()=>Response.json(applied(2)));
   await f.click(preparedLabel);await f.announceRoute();
   await f.until(()=>f.container.textContent.includes('단계를 선택하지 않았습니다'));
   assert(!f.container.textContent.includes('선택 정의:'));
   assert.equal(destinationApplicationReads(f).length,failure==='APPLICATION'?1:0);
   assert(f.calls.every(c=>c.method==='GET'));assert.deepEqual(f.unexpected,[]);
  }finally{await f.close();}
 }
});

test('원문 닫기 뒤의 오래된 클릭은 화면 이동이나 보호 GET을 만들지 않는다',async()=>{
 const f=await mount();
 try{
  await chooseSecond(f);
  const node=f.button(preparedLabel);assert(node);
  const react=Object.keys(node).find(k=>k.startsWith('__reactProps$'));assert(react);
  const oldClick=(node as any)[react].onClick;
  await f.click('적용 절차 원문 닫기');
  await ui.React.act(async()=>oldClick());
  assert.equal(location.hash,methodRoute);
  assert.equal(destinationApplicationReads(f).length,0);
  assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});

test('다른 화면으로 떠난 뒤 늦은 목적지 401과 재진입에는 기존 단계를 복구하지 않는다',async()=>{
 const f=await mount(),held=deferred<Response>();
 try{
  await chooseSecond(f);f.holdApplication(()=>held.promise);
  await f.click(preparedLabel);await f.announceRoute();await f.until(()=>destinationApplicationReads(f).length===1);
  await f.go(methodRoute);await f.until(()=>!!f.button('현재 적용 절차 원문 보기'));
  held.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.flush();
  assert(!f.button('로그인'));
  await f.go(workRoute);await f.until(()=>!!f.button('적용 절차 조회'));
  assert.equal(destinationApplicationReads(f).length,1);assert(!f.container.textContent.includes(selectedLabel));
 }finally{held.resolve(Response.json(f.original));await f.close();}
});
