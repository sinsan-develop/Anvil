import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {reworkFixture} from '../FN12/result-rework-input-fixture.ts';
import {criteriaHash as hash,criteriaId as id} from '../FN12/result-criteria-fixture.ts';
import {prepareResultRework} from '../../../apps/server/modules/results/result-rework-input.ts';
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

function fixture(registered=false){const f=reworkFixture();if(registered){Object.assign(f.sources.binding.snapshot,{connectionKind:'REGISTERED_DEFINITION',connectionReadiness:'REGISTERED_DEFINITION_ONLY'});f.sources.binding.ref.contentHash=hash(f.sources.binding.snapshot);f.input.responsibleBindingRef=structuredClone(f.sources.binding.ref);}const p=prepareResultRework(f.sources,f.input,f.now),at='2026-10-20T00:02:00.000Z',snapshot={scope:p.scope,input:f.input,criteriaRef:p.criteriaRef,roleRef:p.roleRef,stageSessionRef:p.stageSessionRef,remainingMissingItems:p.remainingMissingItems,preservedItems:[],requestedBy:{kind:'HUMAN',userId:id(6),clientId:id(24)},requestedAt:at,scopeVerification:'ASSIGNMENT_SUBSET_ONLY_NOT_OS_VERIFIED',completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false},ref={id:id(40),version:1,contentHash:hash(snapshot)},flags={reworkStored:true,currentBindingVerified:false,currentAuthorityVerified:false,completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false},stored={projectId:p.scope.projectId,ref,status:'RESULT_REWORK_DRAFT_STORED',snapshot,...flags,observedAt:at},item={ref,reviewRef:p.reviewRef,responsibleBindingRef:p.responsibleBindingRef,stageSessionRef:p.stageSessionRef,missingItems:p.missingItems,remainingMissingItems:p.remainingMissingItems,requestedBy:snapshot.requestedBy,requestedAt:at,...flags},list={projectId:p.scope.projectId,resultRef:p.originalResultRef,items:[item],hasMore:false,selectionState:'NOT_SELECTED',observedAt:at};return{...f,stored,item,list};}

before(async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/session-detail/StoredResultReworkHistory.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:stored-rework',name:'StoredReworkTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'rework-memory-entry',resolveId(id){if(id.endsWith('virtual:stored-rework'))return '\0stored-rework';},load(id){if(id==='\0stored-rework')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{StoredResultReworkHistory}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};export {ReportedIssueReviewHistory} from ${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/decisions/ReportedIssueReviewHistory.tsx',import.meta.url)))};export{React,createRoot,StoredResultReworkHistory,ApiClient};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return StoredReworkTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});
const cursor='signed_page.'+'a'.repeat(64);
async function mount(registered=false){
 const f=fixture(registered),calls:{path:string;method:string}[]=[],requests:(string|null)[]=[],container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);let lost=0,unavailable:string[]=[];
 const state:{next:null|number|'DELAY'|'JSON';release:null|((r:Response)=>void);releaseJson:null|(()=>void);sessionEpoch:number;responsibility?:(kind:'role'|'binding')=>Response|Promise<Response>|undefined}={next:null,release:null,releaseJson:null,sessionEpoch:0};
 function page(next:string|null){return{...f.list,projectId:props.result.snapshot.scope.projectId,resultRef:props.result.ref,items:next?[{...f.item,ref:{...f.item.ref,id:id(20)}}]:Array.from({length:20},(_,n)=>({...f.item,ref:{...f.item.ref,id:id(40-n)}})),hasMore:next===null,nextCursor:next?null:cursor};}
 function client(){return new ui.ApiClient(async(url:any,options:any)=>{const path=String(url),method=options?.method??'GET';calls.push({path,method});assert.equal(method,'GET','POST0');const u=new URL(path,'https://anvil.invalid');if(u.pathname.endsWith('/rework-pages'))requests.push(u.searchParams.get('cursor'));const mode=state.next;state.next=null;if(mode==='DELAY')return new Promise<Response>(r=>{state.release=r;});if(typeof mode==='number')return Response.json({code:mode===401?'AUTH_REQUIRED':'ACCESS_DENIED'},{status:mode});if(u.pathname.endsWith('/rework-pages')){const next=u.searchParams.get('cursor');const response=Response.json(page(next));if(mode==='JSON'){const original=response.json.bind(response);response.json=async()=>{await new Promise<void>(resolve=>{state.releaseJson=resolve;});return original();};}return response;}if(u.pathname.includes('/result-reworks/'))return Response.json({...f.stored,ref:{...f.stored.ref,id:u.pathname.split('/').at(-1)}});if(u.pathname.includes('/result-reviews/'))return Response.json(f.sources.review);if(u.pathname.includes('/project-roles/'))return state.responsibility?.('role')??Response.json(f.sources.role);if(u.pathname.includes('/role-bindings/'))return state.responsibility?.('binding')??Response.json(f.sources.binding);assert.fail('미모델 요청 '+path);});}
 const props:any={client:client(),result:f.sources.result,assignment:f.sources.assignment,onAuthenticationLost:()=>{lost++;},onAccessUnavailable:(code:string)=>unavailable.push(code)};
 const commits:string[]=[];function Host(){ui.React.useLayoutEffect(()=>{commits.push(container.textContent);});return ui.React.createElement(ui.StoredResultReworkHistory,{...props,key:state.sessionEpoch});}
 const nodes=(n=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))],buttons=(label:string)=>nodes().filter(n=>n.tagName==='BUTTON'&&n.textContent===label);
 async function render(){await ui.React.act(async()=>root.render(ui.React.createElement(Host)));}
 async function flush(){await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});}
 async function waitFor(value:string){const end=Date.now()+2000;while(!container.textContent.includes(value)&&Date.now()<end)await flush();assert(container.textContent.includes(value),'도달: '+value);}
 async function click(label:string){const a=buttons(label);assert.equal(a.length,1,label+' 버튼');assert(!a[0]!.disabled);await ui.React.act(async()=>a[0]!.dispatchEvent({type:'click',button:0,bubbles:true}));}
 async function close(){await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}
 await render();return{f,state,props,calls,requests,container,commits,nodes,buttons,render,flush,waitFor,click,close,client,page,lost:()=>lost,unavailable:()=>unavailable};
}

test('실제 보관 보완 widget은 첫→더 이전→방금 본 더 최근 페이지로 기존 cursor GET을 왕복한다',async()=>{
 const f=await mount();try{assert.equal(f.calls.length,0);await f.click('보관 보완 목록 조회');await f.waitFor('보관 보완 1페이지');await f.click('더 이전 보완 목록 조회');await f.waitFor('보관 보완 2페이지');await f.click('더 최근 보완 목록 조회');await f.waitFor('보관 보완 1페이지');assert.deepEqual(f.requests,[null,cursor,null]);assert(f.calls.every(c=>c.method==='GET'));}finally{await f.close();}
});

const responsibilityButton='당시 책임 역할·예약 원문 열기',closeResponsibility='당시 책임 역할·예약 원문 닫기';
async function openRework(f:Awaited<ReturnType<typeof mount>>){
 await f.click('보관 보완 목록 조회');await f.waitFor('보관 보완 1페이지');
 await f.click('보관 보완 원문 '+f.f.item.ref.id);await f.waitFor(f.f.input.reason);
}
const responsibilityCalls=(f:Awaited<ReturnType<typeof mount>>)=>f.calls.filter(c=>/\/(?:project-roles|role-bindings)\//.test(c.path));
for(const registered of [false,true])test(`보완 당시 책임 원문 · ${registered?'등록 정의':'후보'}의 고정 역할과 예약을 명시 GET2로 표시한다`,async()=>{
 const f=await mount(registered);
 try{
  await openRework(f);assert.equal(responsibilityCalls(f).length,0);
  await f.click(responsibilityButton);await f.waitFor('같은 단계 예약');
  const {role,binding}=f.f.sources;
  assert.deepEqual(responsibilityCalls(f),[
   {path:`/api/v1/projects/${role.projectId}/project-roles/${role.ref.id}/versions/${role.ref.version}`,method:'GET'},
   {path:`/api/v1/projects/${binding.projectId}/role-bindings/${binding.ref.id}/versions/${binding.ref.version}`,method:'GET'}
  ]);
  assert.match(f.container.textContent,registered?/REGISTERED_DEFINITION_ONLY/:/CANDIDATE_ONLY/);
  assert(f.container.textContent.includes(role.ref.contentHash));assert(f.container.textContent.includes(binding.ref.contentHash));
  assert(f.container.textContent.includes(binding.snapshot.sessionRef.contentHash));
  await f.click(closeResponsibility);assert.doesNotMatch(f.container.textContent,/같은 단계 예약/);
  assert.equal(responsibilityCalls(f).length,2);assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});

for(const mode of ['roleHash','coordinator','bindingHash','generation','session','project','401','403','404'] as const){
 test(`보완 당시 책임 원문 · ${mode} 실패는 예약·역할 본문을 표시하지 않는다`,async()=>{
  const f=await mount();
  try{
   const role=structuredClone(f.f.sources.role),binding=structuredClone(f.f.sources.binding);
   if(mode==='roleHash'){role.snapshot.reason='다른 역할 이유';role.ref.contentHash=hash(role.snapshot);}
   else if(mode==='coordinator'){
    Object.assign(role.snapshot,{kind:'COORDINATOR',stageRef:null,parentRoleRef:null});
    role.ref.contentHash=hash(role.snapshot);
    f.f.stored.snapshot.roleRef=role.ref;f.f.stored.ref.contentHash=hash(f.f.stored.snapshot);
   }else if(mode==='bindingHash'){binding.snapshot.reason='다른 예약 이유';binding.ref.contentHash=hash(binding.snapshot);}
   else if(mode==='generation'){binding.snapshot.generation++;binding.ref.contentHash=hash(binding.snapshot);}
   else if(mode==='session'){
    const wrongSession={...binding.snapshot.sessionRef,contentHash:'d'.repeat(64)};
    f.f.stored.snapshot.stageSessionRef=wrongSession;f.f.item.stageSessionRef=wrongSession;
    f.f.stored.ref.contentHash=hash(f.f.stored.snapshot);
   }else if(mode==='project')binding.projectId=id(99);
   f.state.responsibility=(kind)=>['401','403','404'].includes(mode)&&kind==='binding'?
    Response.json({code:mode==='401'?'AUTH_REQUIRED':'ACCESS_DENIED'},{status:Number(mode)}):Response.json(kind==='role'?role:binding);
   await openRework(f);
   await f.click(responsibilityButton);
   if(['401','403','404'].includes(mode)){
    const until=Date.now()+2000;
    while(!f.unavailable().length&&Date.now()<until)await f.flush();
    assert.equal(f.unavailable().length,1);
   }else await f.waitFor('당시 책임 관계 미확인');
   assert.doesNotMatch(f.container.textContent,/같은 단계 예약|다른 예약 이유|다른 역할 이유/);
   assert.equal(responsibilityCalls(f).length,['roleHash','coordinator'].includes(mode)?1:2);
   assert.equal(f.lost(),mode==='401'?1:0);assert(f.calls.every(c=>c.method==='GET'));
  }finally{await f.close();}
 });
}

for(const change of ['page','session','transport','close'] as const)for(const status of [200,401])test(`보완 당시 책임 원문 · ${change} 뒤 늦은 ${status}와 연속 클릭은 이전 원문·인증을 변경하지 않는다`,async()=>{
 const f=await mount();let release:((response:Response)=>void)|undefined;
 try{
  await openRework(f);
  const stage=change==='page'||change==='transport'?'role':'binding';
  f.state.responsibility=kind=>kind===stage?new Promise<Response>(resolve=>{release=resolve;}):undefined;
  const first=f.buttons(responsibilityButton)[0]!,eventKey=Object.keys(first).find(k=>k.startsWith('__reactProps'))!;
  await ui.React.act(async()=>{(first as any)[eventKey].onClick();(first as any)[eventKey].onClick();});
  const until=Date.now()+2000;
  while(!release&&Date.now()<until)await f.flush();
  assert(release);
  const count=stage==='role'?1:2;assert.equal(responsibilityCalls(f).length,count);
  if(change==='page'){await f.click('더 이전 보완 목록 조회');await f.waitFor('보관 보완 2페이지');}
  else if(change==='session'){f.state.sessionEpoch++;await f.render();assert.equal(f.buttons('보관 보완 목록 조회').length,1);}
  else if(change==='transport'){
   const original=f.props.client.transport;f.props.client.transport=f.client().transport;await f.render();
   f.props.client.transport=original;await f.render();
  }else await f.click(closeResponsibility);
  await ui.React.act(async()=>release!(Response.json(status===200?f.f.sources[stage]:{code:'AUTH_REQUIRED'},{status})));
  await f.flush();
  assert.equal(responsibilityCalls(f).length,count);
  assert.doesNotMatch(f.container.textContent,/같은 단계 예약|AUTH_REQUIRED/);
  assert.equal(f.lost(),0);assert.deepEqual(f.unavailable(),[]);
  assert(f.calls.every(c=>c.method==='GET'));
 }finally{release?.(Response.json(f.f.sources.binding));await f.close();}
});


test('이전/최근 실패는 성공 위치를 확정하지 않고 같은 target cursor만 명시 재조회한다',async()=>{
 const f=await mount();try{await f.click('보관 보완 목록 조회');await f.waitFor('보관 보완 1페이지');f.state.next=503;await f.click('더 이전 보완 목록 조회');await f.waitFor('보완 이력 미확인');assert(!f.container.textContent.includes('보관 보완 2페이지'));const n=f.calls.length;await f.flush();assert.equal(f.calls.length,n,'자동 재시도0');await f.click('같은 보완 목록 다시 조회');await f.waitFor('보관 보완 2페이지');assert.deepEqual(f.requests,[null,cursor,cursor]);f.state.next=503;await f.click('더 최근 보완 목록 조회');await f.waitFor('보완 이력 미확인');assert(!f.container.textContent.includes('보관 보완 1페이지'));await f.click('같은 보완 목록 다시 조회');await f.waitFor('보관 보완 1페이지');assert.deepEqual(f.requests.slice(-2),[null,null]);}finally{await f.close();}
});

test('페이지 이동은 보호 원문을 즉시 숨기고 명시 재선택 전 고정 GET을 추가하지 않는다',async()=>{
 const f=await mount();try{const inputs=JSON.stringify([f.props.result,f.props.assignment]);await f.click('보관 보완 목록 조회');await f.waitFor('보관 보완 1페이지');assert.equal(f.calls.filter(c=>c.path.includes('/result-reworks/')).length,0);await f.click('보관 보완 원문 '+f.f.item.ref.id);await f.waitFor(f.f.input.reason);assert.equal(f.calls.filter(c=>c.path.includes('/result-reworks/')).length,1);f.state.next='DELAY';await f.click('더 이전 보완 목록 조회');assert(!f.container.textContent.includes(f.f.input.reason),'이동 즉시 원문 숨김');const end=Date.now()+2000;while(!f.state.release&&Date.now()<end)await f.flush();assert(f.state.release);await ui.React.act(async()=>f.state.release!(Response.json(f.page(cursor))));await f.waitFor('보관 보완 2페이지');await f.click('더 최근 보완 목록 조회');await f.waitFor('보관 보완 1페이지');assert.equal(f.calls.filter(c=>c.path.includes('/result-reworks/')).length,1,'자동 재선택0');await f.click('보관 보완 원문 '+f.f.item.ref.id);await f.waitFor(f.f.input.reason);assert.equal(f.calls.filter(c=>c.path.includes('/result-reworks/')).length,2);assert.equal(JSON.stringify([f.props.result,f.props.assignment]),inputs);assert(f.calls.every(c=>c.method==='GET'));}finally{await f.close();}
});

test('API/result/assignment fullref의 관측 ABA는 옛401을 버리고 새 문맥에서 명시 조회한다',async()=>{
 for(const mode of['API','RESULT','ASSIGNMENT']){const f=await mount();try{f.state.next='DELAY';await f.click('보관 보완 목록 조회');const end=Date.now()+2000;while(!f.state.release&&Date.now()<end)await f.flush();const release=f.state.release!;assert(release);const original={client:f.props.client,result:f.props.result,assignment:f.props.assignment};if(mode==='API')f.props.client=f.client();if(mode==='RESULT')f.props.result={...f.props.result,ref:{...f.props.result.ref,id:id(90)}};if(mode==='ASSIGNMENT')f.props.assignment={...f.props.assignment,ref:{...f.props.assignment.ref,id:id(91)}};await f.render();assert.equal(f.buttons('보관 보완 목록 조회').length,1);Object.assign(f.props,original);await f.render();await f.click('보관 보완 목록 조회');await f.waitFor('보관 보완 1페이지');const count=f.calls.length;await ui.React.act(async()=>release(Response.json({code:'AUTH_REQUIRED'},{status:401})));await f.flush();assert.equal(f.lost(),0);assert.deepEqual(f.unavailable(),[]);assert.equal(f.calls.length,count);assert.match(f.container.textContent,/보관 보완 1페이지/);}finally{await f.close();}}
});

test('무렌더 transport 교체·unmount 후 늦은401은 폐기하고 현 문맥 버튼은 회복한다',async()=>{
 for(const mode of['TRANSPORT','UNMOUNT']){const f=await mount();let closed=false;try{f.state.next='DELAY';await f.click('보관 보완 목록 조회');const end=Date.now()+2000;while(!f.state.release&&Date.now()<end)await f.flush();const release=f.state.release!;assert(release);if(mode==='TRANSPORT')f.props.client.transport=f.client().transport;else{await f.close();closed=true;}await ui.React.act(async()=>release(Response.json({code:'AUTH_REQUIRED'},{status:401})));await f.flush();assert.equal(f.lost(),0);assert.deepEqual(f.unavailable(),[]);if(mode==='TRANSPORT'){await f.click('보관 보완 목록 조회');await f.waitFor('보관 보완 1페이지');}}finally{if(!closed)await f.close();}}
});

test('현재401/403과 중복클릭은 기존 보호 의미를 유지하고 읽기 외 호출0이다',async()=>{
 for(const status of[401,403]){const f=await mount();try{f.state.next='DELAY';await f.click('보관 보완 목록 조회');const button=f.buttons('보관 보완 목록 다시 조회')[0]!;assert(button.disabled);const count=f.calls.length;await ui.React.act(async()=>button.dispatchEvent({type:'click',button:0,bubbles:true}));const end=Date.now()+2000;while(!f.state.release&&Date.now()<end)await f.flush();assert.equal(f.calls.length,count);await ui.React.act(async()=>f.state.release!(Response.json({code:status===401?'AUTH_REQUIRED':'ACCESS_DENIED'},{status})));await f.waitFor('보완 이력 미확인');assert.equal(f.lost(),status===401?1:0);assert.equal(f.unavailable().length,1);assert(f.calls.every(c=>c.method==='GET'));}finally{await f.close();}}
});


test('선택 원문 GET 대기 중 transport 교체도 옛403을 버리고 목록 명시 조회를 회복한다',async()=>{
 const f=await mount();try{await f.click('보관 보완 목록 조회');await f.waitFor('보관 보완 1페이지');f.state.next='DELAY';await f.click('보관 보완 원문 '+f.f.item.ref.id);const end=Date.now()+2000;while(!f.state.release&&Date.now()<end)await f.flush();const release=f.state.release!;assert(release);f.props.client.transport=f.client().transport;await ui.React.act(async()=>release(Response.json({code:'ACCESS_DENIED'},{status:403})));await f.flush();assert.deepEqual(f.unavailable(),[]);await f.click('보관 보완 목록 조회');await f.waitFor('보관 보완 1페이지');assert.equal(f.lost(),0);}finally{await f.close();}
});


test('목록 JSON 대기 중 문맥 변경은 원문·위치·하위 조회를 부활시키지 않는다',async()=>{
 const f=await mount();try{f.state.next='JSON';await f.click('보관 보완 목록 조회');const end=Date.now()+2000;while(!f.state.releaseJson&&Date.now()<end)await f.flush();const release=f.state.releaseJson;assert(release);f.props.client=f.client();await f.render();assert.equal(f.buttons('보관 보완 목록 조회').length,1);await f.click('보관 보완 목록 조회');await f.waitFor('보관 보완 1페이지');const count=f.calls.length;await ui.React.act(async()=>release());await f.flush();assert.equal(f.calls.length,count);assert.equal(f.lost(),0);assert.deepEqual(f.unavailable(),[]);assert.equal(f.calls.filter(c=>c.path.includes('/result-reworks/')).length,0);}finally{await f.close();}
});


async function mountReportedReworks(outcome:'REWORK'|'BLOCKED'='REWORK'){
 const f=fixture(true),review=f.sources.review,base=f.sources.result.snapshot.scope.projectId,rows=Array.from({length:20},(_,n)=>({...f.item,ref:{...f.item.ref,id:id(80-n)},reviewRef:{...review.ref,id:id(99)}}));
 rows[0]!.reviewRef={...review.ref,contentHash:'a'.repeat(64)};
 if(outcome==='BLOCKED'){review.snapshot.input.outcome='BLOCKED';review.snapshot.input.items=review.snapshot.input.items.map(i=>({...i,outcome:'BLOCKED'}));review.ref.contentHash=hash(review.snapshot);}
 const flags={reviewStored:true,completionAccepted:false,formalFailureCounted:false,evidenceProvenanceVerified:false,executionAuthorized:false,dispatchPerformed:false},summary={ref:review.ref,criteriaRef:review.snapshot.input.criteriaRef,outcome,reviewedBy:review.snapshot.reviewedBy,sameAsSubmitter:review.snapshot.sameAsSubmitter,reviewedAt:review.snapshot.reviewedAt,...flags},window={startedAt:review.observedAt,expiresAt:'2026-10-20T00:31:00.000Z'},reviewPage={projectId:base,resultRef:f.sources.result.ref,items:[summary],hasMore:false,nextCursor:null,selectionState:'NOT_SELECTED',observedAt:review.observedAt,pageSize:20,window};
 const calls:string[]=[],unavailable:string[]=[],container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);let lost=0,shown=true,sourceCurrent=true,key=0,holdPath:string|null=null,release:((v:Response)=>void)|null=null;
 const reworkPage=(next:string|null)=>({...f.list,items:next?[f.item]:rows,hasMore:!next,nextCursor:next?null:cursor});
 const controls={read:(path:string):Response=>{if(path.endsWith('/review-pages'))return Response.json(reviewPage);if(path.includes('/result-reviews/'))return Response.json(review);if(path.includes('/rework-pages'))return Response.json(reworkPage(new URL('https://anvil.invalid'+path).searchParams.get('cursor')));if(path.includes('/result-reworks/'))return Response.json(f.stored);if(path.includes('/project-roles/'))return Response.json(f.sources.role);if(path.includes('/role-bindings/'))return Response.json(f.sources.binding);assert.fail('미모델 GET '+path);}};
 const client=new ui.ApiClient(async(url:string,options:RequestInit)=>{assert.equal(options.method,'GET','쓰기0');const path=String(url);calls.push(path);if(holdPath&&path.includes(holdPath))return new Promise<Response>(r=>release=r);return controls.read(path);});
 const props:any={client,result:f.sources.result,assignment:f.sources.assignment,isSourceCurrent:()=>sourceCurrent,onUnavailable:(code:string)=>unavailable.push(code),onAuthenticationLost:()=>lost++};
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))],buttons=(label:string)=>nodes().filter(n=>n.tagName==='BUTTON'&&n.textContent===label);
 const render=async()=>ui.React.act(async()=>root.render(shown?ui.React.createElement(ui.ReportedIssueReviewHistory,{...props,key}):null)),flush=async()=>ui.React.act(async()=>new Promise(r=>setImmediate(r))),wait=async(check:()=>boolean)=>{const end=Date.now()+2000;while(!check()&&Date.now()<end)await flush();assert(check(),container.textContent);},click=async(label:string)=>{const b=buttons(label);assert.equal(b.length,1,label);assert(!b[0]!.disabled,label);await ui.React.act(async()=>b[0]!.dispatchEvent({type:'click',button:0,bubbles:true}));};
 await render();return{f,review,props,calls,controls,reworkPage,container,nodes,buttons,render,flush,wait,click,lost:()=>lost,unavailable,hold(path:string){holdPath=path;},held:()=>!!release,async finish(v:Response){assert(release);const send=release;release=null;holdPath=null;await ui.React.act(async()=>send(v));await flush();},async leave(mode:string){if(mode==='SOURCE')sourceCurrent=false;if(mode==='KEY')key++;if(mode==='UNMOUNT')shown=false;if(mode==='RESULT')props.result={...props.result,ref:{...props.result.ref,version:2}};if(mode==='ASSIGNMENT')props.assignment={...props.assignment,ref:{...props.assignment.ref,version:2}};await render();},async close(){await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
async function openReportedReview(f:Awaited<ReturnType<typeof mountReportedReworks>>){await f.click('검수 이력 조회');await f.wait(()=>f.buttons('검수 원문 '+f.review.ref.id).length===1);await f.click('검수 원문 '+f.review.ref.id);await f.wait(()=>f.container.textContent.includes(f.review.snapshot.input.reason));}

test('UI08 exact REWORK 선택 뒤만 보완 초안을 원 cursor로 찾고 부족조건·당시 책임을 명시 조회한다',{timeout:15000},async()=>{
 const f=await mountReportedReworks();try{
  assert.equal(f.calls.length,0);await openReportedReview(f);assert.equal(f.calls.length,2);assert.equal(f.buttons('이 검수의 보완 목록 조회').length,1,'선택 검수의 보완 이력 연결 없음');
  await f.click('이 검수의 보완 목록 조회');await f.wait(()=>f.container.textContent.includes('보관 보완 1페이지'));assert(f.container.textContent.includes('현재 페이지에 이 검수의 보완 없음'));assert(!f.container.textContent.includes('보관 보완 원문 '+id(80)));
  await f.click('더 이전 보완 목록 조회');await f.wait(()=>f.buttons('보관 보완 원문 '+f.f.item.ref.id).length===1);assert(f.calls.at(-1)!.endsWith('/rework-pages?cursor='+cursor));
  await f.click('보관 보완 원문 '+f.f.item.ref.id);await f.wait(()=>f.container.textContent.includes(f.f.input.reason));assert(f.container.textContent.includes('선택 부족 조건: save'));assert(f.container.textContent.includes('남은 부족 조건: denied'));assert.equal(f.calls.filter(p=>p.includes('/project-roles/')||p.includes('/role-bindings/')).length,0);
  await f.click(responsibilityButton);await f.wait(()=>f.container.textContent.includes('같은 단계 예약'));assert(f.container.textContent.includes('REGISTERED_DEFINITION_ONLY'));assert(f.container.textContent.includes('실제 배정/실행 아님'));assert.equal(f.calls.filter(p=>p.includes('/project-roles/')||p.includes('/role-bindings/')).length,2);
  await f.click('더 최근 보완 목록 조회');await f.wait(()=>f.container.textContent.includes('보관 보완 1페이지'));assert(!f.container.textContent.includes(f.f.input.reason));assert.equal(f.calls.at(-1),'/api/v1/projects/'+f.f.sources.result.snapshot.scope.projectId+'/results/'+f.f.sources.result.ref.id+'/rework-pages');assert.equal(f.lost(),0);
 }finally{await f.close();}
});


test('UI08 다른 판정은 보완 자동조회0이며 exact 검수·조건과 다른 보완 원문은 거절한다',{timeout:15000},async()=>{
 const blocked=await mountReportedReworks('BLOCKED');try{await openReportedReview(blocked);assert.equal(blocked.buttons('이 검수의 보완 목록 조회').length,0);assert.equal(blocked.calls.length,2);}finally{await blocked.close();}
 for(const mode of ['CRITERIA','ITEMS','REVIEW_HASH']){
  const f=await mountReportedReworks();try{
   await openReportedReview(f);await f.click('이 검수의 보완 목록 조회');await f.wait(()=>f.container.textContent.includes('보관 보완 1페이지'));await f.click('더 이전 보완 목록 조회');await f.wait(()=>f.buttons('보관 보완 원문 '+f.f.item.ref.id).length===1);
   if(mode==='CRITERIA')f.f.stored.snapshot.criteriaRef={...f.f.stored.snapshot.criteriaRef,contentHash:'d'.repeat(64)};
   if(mode==='ITEMS'){f.f.stored.snapshot.input.missingItems=['foreign'];f.f.item.missingItems=['foreign'];}
   if(mode==='REVIEW_HASH')f.f.stored.snapshot.input.reviewRef={...f.f.stored.snapshot.input.reviewRef,contentHash:'d'.repeat(64)};
   f.f.stored.ref.contentHash=hash(f.f.stored.snapshot);
   // SUMMARY와 원문을 함께 바꾸어도 선택한 원 검수/조건과의 관계 대조가 필요하다.
   await f.click('더 최근 보완 목록 조회');await f.wait(()=>f.container.textContent.includes('보관 보완 1페이지'));await f.click('더 이전 보완 목록 조회');await f.wait(()=>f.buttons('보관 보완 원문 '+f.f.item.ref.id).length===1);await f.click('보관 보완 원문 '+f.f.item.ref.id);await f.wait(()=>f.container.textContent.includes('보완 원문 미확인'));assert(!f.container.textContent.includes(f.f.input.reason));assert.equal(f.lost(),0);assert.equal(f.calls.filter(p=>p.includes('/project-roles/')||p.includes('/role-bindings/')).length,0);
  }finally{await f.close();}
 }
});


async function reachReportedStage(f:Awaited<ReturnType<typeof mountReportedReworks>>,stage:string){
 if(stage==='REVIEW_PAGE')f.hold('/review-pages');await f.click('검수 이력 조회');if(stage==='REVIEW_PAGE')return;
 await f.wait(()=>f.buttons('검수 원문 '+f.review.ref.id).length===1);if(stage==='REVIEW')f.hold('/result-reviews/');await f.click('검수 원문 '+f.review.ref.id);if(stage==='REVIEW')return;
 await f.wait(()=>f.buttons('이 검수의 보완 목록 조회').length===1);if(stage==='REWORK_PAGE')f.hold('/rework-pages');await f.click('이 검수의 보완 목록 조회');if(stage==='REWORK_PAGE')return;
 await f.wait(()=>f.container.textContent.includes('보관 보완 1페이지'));await f.click('더 이전 보완 목록 조회');await f.wait(()=>f.buttons('보관 보완 원문 '+f.f.item.ref.id).length===1);if(stage==='REWORK')f.hold('/result-reworks/');await f.click('보관 보완 원문 '+f.f.item.ref.id);if(stage==='REWORK')return;
 await f.wait(()=>f.container.textContent.includes(f.f.input.reason));f.hold(stage==='ROLE'?'/project-roles/':'/role-bindings/');await f.click(responsibilityButton);
}

test('UI08 원 검수부터 보완 책임까지 raw route 이탈·전달 ABA 후 늦은200/401과 옛 클릭은 효과0이다',{timeout:15000},async()=>{
 const names=['location','addEventListener','removeEventListener'] as const,descriptors=new Map(names.map(n=>[n,Object.getOwnPropertyDescriptor(globalThis,n)])),listeners=new Set<(event:any)=>void>(),location={hash:'#/projects/'+id(1)+'/approvals'},route=location.hash,other='#/projects/'+id(1)+'/session';
 Object.defineProperties(globalThis,{location:{value:location,configurable:true},addEventListener:{value:(type:string,fn:any)=>{assert.equal(type,'hashchange');listeners.add(fn);},configurable:true},removeEventListener:{value:(type:string,fn:any)=>{assert.equal(type,'hashchange');listeners.delete(fn);},configurable:true}});
 try{for(const stage of ['REVIEW_PAGE','REVIEW','REWORK_PAGE','REWORK','ROLE','BINDING'])for(const mode of ['RAW','RENDER_ABA','EVENT_ABA'])for(const status of [200,401]){
  location.hash=route;const f=await mountReportedReworks();try{
   await reachReportedStage(f,stage);await f.wait(f.held);const path=f.calls.at(-1)!,count=f.calls.length,b=f.buttons('검수 이력 다시 조회')[0]!,oldClick=(b as any)[Object.keys(b).find(k=>k.startsWith('__reactProps'))!].onClick;
   if(mode==='RAW')location.hash=other;
   else if(mode==='RENDER_ABA'){location.hash=other;await f.render();location.hash=route;await f.render();}
   else await ui.React.act(async()=>{location.hash=other;location.hash=route;for(const event of [{oldURL:'https://anvil.invalid'+route,newURL:'https://anvil.invalid'+other},{oldURL:'https://anvil.invalid'+other,newURL:'https://anvil.invalid'+route}])for(const fn of [...listeners])fn(event);});
   await f.finish(status===200?f.controls.read(path):Response.json({code:'AUTH_REQUIRED'},{status:401}));assert.equal(f.calls.length,count,stage+' 후속GET0');assert.equal(f.lost(),0,stage);assert.deepEqual(f.unavailable,[]);assert(!f.container.textContent.includes('같은 단계 예약'));if(mode!=='RAW'||!['ROLE','BINDING'].includes(stage))assert(!f.container.textContent.includes(f.f.input.reason));assert(!f.container.textContent.includes('AUTH_REQUIRED'));
   await ui.React.act(async()=>oldClick());assert.equal(f.calls.length,count,'옛 route callback GET0');
   if(mode!=='RAW'){await f.click('검수 이력 조회');await f.wait(()=>f.buttons('검수 원문 '+f.review.ref.id).length===1);assert.equal(f.calls.length,count+1,'새 명시 조회만 복구');}
  }finally{if(f.held())await f.finish(Response.json({}));await f.close();assert.equal(listeners.size,0,'원 listener cleanup');}
 }}finally{for(const name of names){const descriptor=descriptors.get(name);if(descriptor)Object.defineProperty(globalThis,name,descriptor);else Reflect.deleteProperty(globalThis,name);}}
});

test('UI08 보완 상세의 close·검수/제출/주체·transport 교체는 late 결과와 책임 조회를 폐기한다',{timeout:15000},async()=>{
 for(const mode of ['CLOSE_REWORK','CLOSE_REVIEW','RELOAD','SOURCE','RESULT','ASSIGNMENT','KEY','UNMOUNT','TRANSPORT'])for(const status of [200,401]){
  const f=await mountReportedReworks();try{
   await reachReportedStage(f,'REWORK');await f.wait(f.held);const count=f.calls.length;
   if(mode==='CLOSE_REWORK')await f.click('보관 보완 이력 닫기');else if(mode==='CLOSE_REVIEW')await f.click('검수 원문 닫기');else if(mode==='RELOAD'){await f.click('검수 이력 다시 조회');await f.wait(()=>f.buttons('검수 원문 '+f.review.ref.id).length===1);}else if(mode==='TRANSPORT'){f.props.client.transport=async()=>assert.fail('교체 port GET0');await f.render();}else await f.leave(mode);
   const after=f.calls.length;await f.finish(status===200?Response.json(f.f.stored):Response.json({code:'AUTH_REQUIRED'},{status:401}));assert.equal(f.calls.length,after);assert(!f.container.textContent.includes(f.f.input.reason));assert.equal(f.buttons(responsibilityButton).length,0);assert.equal(f.lost(),0);assert.deepEqual(f.unavailable,[]);assert.equal(after-count,mode==='RELOAD'?1:0,'명시 reload만 GET');
  }finally{if(f.held())await f.finish(Response.json({}));await f.close();}
 }
 for(const status of [401,403]){const f=await mountReportedReworks();try{await reachReportedStage(f,'REWORK_PAGE');await f.wait(f.held);await f.finish(Response.json({code:status===401?'AUTH_REQUIRED':'ACCESS_DENIED'},{status}));await f.wait(()=>f.container.textContent.includes('보완 이력 미확인'));assert.equal(f.lost(),status===401?1:0);assert.deepEqual(f.unavailable,[status===401?'AUTH_REQUIRED':'ACCESS_DENIED']);}finally{await f.close();}}
});
