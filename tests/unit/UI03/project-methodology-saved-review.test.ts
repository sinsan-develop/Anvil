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
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/methodology-editor/ProjectMethodologyPage.tsx',import.meta.url));
 const common=fileURLToPath(new URL('../../../apps/web/src/features/methodology-editor/common-api.ts',import.meta.url));
 const api=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:project-saved-review',name:'ProjectSavedReviewTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'project-saved-review-memory-entry',resolveId(id){if(id.endsWith('virtual:project-saved-review'))return '\0project-saved-review';},load(id){if(id==='\0project-saved-review')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{ProjectMethodologyPage}from${JSON.stringify(entry)};import{emptyMethodBuffer}from${JSON.stringify(common)};import{ApiClient}from${JSON.stringify(api)};export{React,createRoot,ProjectMethodologyPage,emptyMethodBuffer,ApiClient};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const [key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return ProjectSavedReviewTest;')();
});
after(()=>{for(const channel of channels){channel.port1.close();channel.port2.close();}for(const [key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});

const id=(value:number)=>'b3a00000-0000-4000-8000-'+String(value).padStart(12,'0');
const pid=id(1),uid=id(2),cid=id(3),mid=id(4),at='2026-11-12T00:00:00.000Z',name='정확 전용 방법론',purpose='프로젝트 기존 승인 목적';
const path='/api/v1/projects/'+pid,methodPath=path+'/methodologies/'+mid+'/versions/';
const openSaved='저장한 버전 검사·검토 열기',save='전용본 새 버전 저장';
const criteria={criteriaVersion:1,items:[{criterionId:'METHOD_PURPOSE_SCOPE',title:'목적과 작업 범위 검사'}]};
const graph=(version:number)=>({nodes:[{nodeId:'N1',name:'고정 단계 v'+version,purpose:'저장된 당시 단계',kind:'HUMAN',role:'USER',mode:'CASE_BY_CASE',position:{x:0,y:0},inputs:[],outputs:[],taskScope:{included:['작업'],excluded:['운영']},completionCriteria:['검토'],approvalBoundary:[],limitPolicyRef:null,recordRequirements:['근거']}],edges:[],entryNodeId:'N1',terminalNodeIds:['N1']});
function version(n:number,headVersion=n){
 const definition=graph(n),ref={id:mid,version:n,contentHash:contentHash(canonicalJson(definition))};
 return {projectId:pid,ref,headVersion,name,purpose,scope:'PROJECT',systemCode:null,graph:definition,confirmation:null,contentReviewCriteria:criteria,contentReviews:[],validation:{validForConfirmation:false,issues:[]},runtimeReadiness:'PROJECT_BINDINGS_REQUIRED',applicationTransition:'EXECUTION_STATE_UNVERIFIED'};
}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return{promise,resolve};}

async function mount(){
 const old=version(1),stored=version(2),calls:{method:string;url:string}[]=[],posts:any[]=[];
 const session={user:{id:uid},clientId:cid,csrfToken:'c'.repeat(43)};
 const initial={...ui.emptyMethodBuffer(),ownerUserId:uid,targetId:mid,version:1,name,purpose,reason:'개정한 원 명령',graph:stored.graph,nodeId:'N1',dirty:true};
 let authLost=0,ownReads=0,visible=true,rejectSettlement=false,dropResponse=false,listFailure=0,buffer=initial,pendingObserved:any=null;
 let readSaved:()=>Response|Promise<Response>=()=>Response.json(stored);
 const transport:typeof fetch=async(url,options)=>{
  const key=String(url),method=options?.method??'GET';calls.push({method,url:key});
  if(key===path&&method==='GET')return Response.json({id:pid,participation:'OWNER',controlState:{actorId:uid,clientId:cid,status:'HELD',generation:4},currentMethodologyRef:null});
  if(key==='/api/v1/methodologies')return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:at,baselineVersion:null});
  if(key==='/api/v1/forms')return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:at,baselineVersion:null});
  if(key===path+'/methodologies?limit=20'){
   ownReads++;
   if(ownReads>1&&listFailure)return Response.json({code:listFailure===503?'STORAGE_FAILED':'FORBIDDEN'},{status:listFailure});
   return Response.json({projectId:pid,items:ownReads===1?[{ref:old.ref,name,purpose,scope:'PROJECT'}]:[],hasMore:false,nextAfterId:null,observedAt:at,applicationTransition:'EXECUTION_STATE_UNVERIFIED'});
  }
  if(key===methodPath+'1'&&method==='GET')return Response.json(old);
  if(key===methodPath+'2'&&method==='GET')return readSaved();
  if(key===path+'/commands'&&method==='POST'){
   const command=JSON.parse(String(options?.body));posts.push(command);
   assert.equal(command.operation,'saveMethodologyDraft');assert.equal(command.targetId,mid);assert.equal(command.expectedVersion,1);
   assert.deepEqual(command.payload.graph,stored.graph);assert.equal(command.projectId,pid);assert.equal(command.clientId,cid);
   if(dropResponse)throw new Error('합성 저장 응답 유실');
   return Response.json({operationId:id(5),commandId:command.commandId,projectId:pid,status:'APPLIED',targetId:mid,version:2,data:{ref:stored.ref,status:'DRAFT'},serverReceivedAt:at});
  }
  assert.fail('정본 동선 밖 요청: '+method+' '+key);
 };
 const client=new ui.ApiClient(transport),props={client,projectId:pid,session,onAuthenticationLost:()=>{authLost++;}};
 const container=document.createElement('main'),root=ui.createRoot(container);document.body.appendChild(container);
 let setBuffer:(v:any)=>void=()=>{};
 function Host(){
  const [value,setValue]=ui.React.useState(initial);buffer=value;setBuffer=setValue;
  return visible?ui.React.createElement(ui.ProjectMethodologyPage,{...props,buffer:value,onChange:(change:any)=>setValue((previous:any)=>{
   const next=typeof change==='function'?change(previous):change;
   if(next.pending)pendingObserved=next.pending.request;
   return rejectSettlement&&next.version===2&&!next.pending?previous:next;
  })}):null;
 }
 const render=async()=>ui.React.act(async()=>root.render(ui.React.createElement(Host)));
 const flush=async()=>ui.React.act(async()=>{await new Promise(resolve=>setImmediate(resolve));});
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 const button=(label:string)=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===label);
 const click=async(label:string)=>{const node=button(label);assert(node&&!node.disabled,label);await ui.React.act(async()=>node.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const until=async(condition:()=>boolean)=>{const end=Date.now()+2000;while(!condition()&&Date.now()<end)await flush();assert(condition(),container.textContent);};
 const close=async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);};
 await render();await until(()=>!!button(name+' v1 열기')&&!button(name+' v1 열기')!.disabled);
 return {props,container,calls,posts,stored,transport,nodes,button,click,until,flush,close,render,
  buffer:()=>buffer,pendingObserved:()=>pendingObserved,authLost:()=>authLost,source:()=>nodes().find(n=>n.getAttribute('aria-label')==='선택한 전용 원본'),
  readSaved(fn:typeof readSaved){readSaved=fn;},lose(value=true){dropResponse=value;},failList(status=503){listFailure=status;},rejectSettlement(){rejectSettlement=true;},
  replace:async(value:any)=>ui.React.act(async()=>setBuffer(value)),hide:async()=>{visible=false;await render();}};
}

test('v2 저장·원문 확인 뒤 명시 보호 GET이 첫 목록 실패와 별개로 정확 v2 검사·검토를 연다',async()=>{
 const f=await mount();
 try{
  await f.click(name+' v1 열기');await f.until(()=>!!f.source()?.textContent.includes('버전 1'));
  assert(!f.button(openSaved));f.failList();await f.click(save);await f.until(()=>f.container.textContent.includes('서버 저장·재조회 확인 · 버전 2'));
  assert.equal(f.posts.length,1);assert.equal(f.calls.filter(v=>v.url===methodPath+'2').length,1);
  assert(f.source()?.textContent.includes('버전 1'));assert(!f.button('이 방법론 내용 검토 시작'));
  assert(f.button(openSaved)&&!f.button(openSaved)!.disabled);
  await f.click(openSaved);await f.until(()=>!!f.source()?.textContent.includes('버전 2'));
  assert.equal(f.calls.filter(v=>v.url===methodPath+'2').length,2);
  assert(f.source()?.textContent.includes(f.stored.ref.contentHash));assert(f.button('이 방법론 내용 검토 시작'));
  assert(f.button('확정 방법론 별도 적용')?.disabled);
  assert.equal(f.buffer().review,null);assert.equal(f.posts.length,1);assert.equal(f.authLost(),0);
 }finally{await f.close();}
});

test('저장 유실, 다른 hash 원문, 실제 부모 정착 거절에서는 후보가 생기지 않는다',async()=>{
 for(const mode of ['LOST','WRONG_HASH','CAS_REJECT']){
  const f=await mount();
  try{
   if(mode==='LOST')f.lose();
   if(mode==='WRONG_HASH'){const wrong=version(3);f.readSaved(()=>Response.json({...wrong,ref:{...wrong.ref,version:2}}));}
   if(mode==='CAS_REJECT')f.rejectSettlement();
   await f.click(save);await f.until(()=>!!f.button('같은 명령 결과 다시 확인'));
   assert(!f.button(openSaved),mode);assert.equal(f.posts.length,1);assert.equal(f.buffer().pending.request.commandId,f.posts[0].commandId);
  }finally{await f.close();}
 }
});

test('확인 뒤 head가 전진하면 당시 저장 원문만 열고 현재 검토는 시작하지 않는다',async()=>{
 const f=await mount();
 try{
  await f.click(save);await f.until(()=>!!f.button(openSaved));
  const historical=version(2,3),reviewRef={id:id(30),criteriaVersion:1,targetRef:historical.ref,outcome:'ACCEPTED'};
  f.readSaved(()=>Response.json({...historical,confirmation:{id:id(31),decision:'CONFIRMED',decided_at:at,decidedBy:uid,reviewRefs:[reviewRef]},
   contentReviews:[{ref:reviewRef,items:[],reviewer:{kind:'HUMAN',userId:uid,sameAsTargetRecorder:true},sourceKind:'HUMAN_REVIEW',reason:'과거 적합 검토 기록',reviewedAt:at,serverSequence:1}]}));
  await f.click(openSaved);await f.until(()=>!!f.source()?.textContent.includes('최신 3'));
  assert(f.button('이 방법론 내용 검토 시작')?.disabled);assert(f.button('이 방법론 버전 확정')?.disabled);
  assert(f.container.textContent.includes('과거 적합 검토 기록'));assert(f.container.textContent.includes('저장된 확정 사건 상세 보기'));
  assert.equal(f.posts.length,1);assert.equal(f.buffer().review,null);
 }finally{await f.close();}
});

test('새 원문을 여는 중 버퍼·토큰·transport 폐기는 늦은 응답과 401을 버린다',async()=>{
 for(const mode of ['BUFFER','BUFFER_ABA','TOKEN','TRANSPORT','UNMOUNT']){
  const f=await mount(),held=deferred<Response>();
  try{
   await f.click(save);await f.until(()=>!!f.button(openSaved));f.readSaved(()=>held.promise);
   await f.click(openSaved);assert.equal(f.calls.filter(v=>v.url===methodPath+'2').length,2);
   if(mode==='BUFFER')await f.replace({...f.buffer(),name:'사용자 미저장 변경',dirty:true});
   if(mode==='BUFFER_ABA'){const original=f.buffer();await f.replace({...original,name:'잠시 바꾼 입력',dirty:true});await f.replace(original);}
   if(mode==='TOKEN'){f.props.session={...f.props.session,csrfToken:'d'.repeat(43)};await f.render();}
   if(mode==='TRANSPORT')f.props.client.transport=f.transport.bind(null);
   if(mode==='UNMOUNT')await f.hide();
   held.resolve(mode==='BUFFER'?Response.json(f.stored):Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.flush();
   assert(!f.source()?.textContent.includes('버전 2'),mode);assert.equal(f.authLost(),0,mode);assert.equal(f.posts.length,1,mode);
  }finally{held.resolve(Response.json(f.stored));await f.close();}
 }
});

test('저장 직후 원문 대기 중 기존 pending을 교체하면 늦은 401과 후보를 폐기한다',async()=>{
 const f=await mount(),held=deferred<Response>();
 try{
  f.readSaved(()=>held.promise);await f.click(save);
  await f.until(()=>f.calls.filter(v=>v.url===methodPath+'2').length===1);
  const previous=f.buffer(),newRequest={...previous.pending.request,commandId:id(90)};
  await f.replace({...previous,pending:{...previous.pending,request:newRequest}});
  held.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.flush();
  assert(!f.button(openSaved));assert.equal(f.authLost(),0);assert.equal(f.buffer().pending.request,newRequest);assert.equal(f.posts.length,1);
 }finally{held.resolve(Response.json(f.stored));await f.close();}
});

test('저장 원문 또는 목록의 현재 보호 거절은 펼친 원문과 검토를 닫는다',async()=>{
 for(const source of ['SAVED_READ','LIST_REFRESH']){
  const f=await mount();
  try{
   await f.click(name+' v1 열기');await f.until(()=>!!f.source()?.textContent.includes('버전 1'));
   await f.click(save);await f.until(()=>!!f.button(openSaved));
   if(source==='SAVED_READ'){
    f.readSaved(()=>Response.json({code:'FORBIDDEN'},{status:403}));await f.click(openSaved);
    await f.until(()=>f.container.textContent.includes('저장한 버전의 원문을 확인하지 못했습니다.'));
   }else{
    await f.click(openSaved);await f.until(()=>!!f.source()?.textContent.includes('버전 2'));
    f.failList(404);await f.until(()=>!f.button('전용 방법론 목록 갱신')!.disabled);await f.click('전용 방법론 목록 갱신');
    await f.until(()=>f.container.textContent.includes('이전 목록은 현재 자료로 간주하지 않습니다.'));
   }
   assert(!f.source(),source);assert(!f.button('이 방법론 내용 검토 시작'),source);assert(f.button('확정 방법론 별도 적용')?.disabled);
   assert.equal(f.authLost(),0);assert.equal(f.posts.length,1);
  }finally{await f.close();}
 }
});
