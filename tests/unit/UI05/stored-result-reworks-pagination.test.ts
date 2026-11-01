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

function fixture(){const f=reworkFixture(),p=prepareResultRework(f.sources,f.input,f.now),at='2026-10-20T00:02:00.000Z',snapshot={scope:p.scope,input:f.input,criteriaRef:p.criteriaRef,roleRef:p.roleRef,stageSessionRef:p.stageSessionRef,remainingMissingItems:p.remainingMissingItems,preservedItems:[],requestedBy:{kind:'HUMAN',userId:id(6),clientId:id(24)},requestedAt:at,scopeVerification:'ASSIGNMENT_SUBSET_ONLY_NOT_OS_VERIFIED',completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false},ref={id:id(40),version:1,contentHash:hash(snapshot)},flags={reworkStored:true,currentBindingVerified:false,currentAuthorityVerified:false,completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false},stored={projectId:p.scope.projectId,ref,status:'RESULT_REWORK_DRAFT_STORED',snapshot,...flags,observedAt:at},item={ref,reviewRef:p.reviewRef,responsibleBindingRef:p.responsibleBindingRef,stageSessionRef:p.stageSessionRef,missingItems:p.missingItems,remainingMissingItems:p.remainingMissingItems,requestedBy:snapshot.requestedBy,requestedAt:at,...flags},list={projectId:p.scope.projectId,resultRef:p.originalResultRef,items:[item],hasMore:false,selectionState:'NOT_SELECTED',observedAt:at};return{...f,stored,item,list};}

before(async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/session-detail/StoredResultReworkHistory.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:stored-rework',name:'StoredReworkTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'rework-memory-entry',resolveId(id){if(id.endsWith('virtual:stored-rework'))return '\0stored-rework';},load(id){if(id==='\0stored-rework')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{StoredResultReworkHistory}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};export{React,createRoot,StoredResultReworkHistory,ApiClient};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return StoredReworkTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});
const cursor='signed_page.'+'a'.repeat(64);
async function mount(){
 const f=fixture(),calls:{path:string;method:string}[]=[],requests:(string|null)[]=[],container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);let lost=0,unavailable:string[]=[];
 const state:{next:null|number|'DELAY'|'JSON';release:null|((r:Response)=>void);releaseJson:null|(()=>void)}={next:null,release:null,releaseJson:null};
 function page(next:string|null){return{...f.list,projectId:props.result.snapshot.scope.projectId,resultRef:props.result.ref,items:next?[{...f.item,ref:{...f.item.ref,id:id(20)}}]:Array.from({length:20},(_,n)=>({...f.item,ref:{...f.item.ref,id:id(40-n)}})),hasMore:next===null,nextCursor:next?null:cursor};}
 function client(){return new ui.ApiClient(async(url:any,options:any)=>{const path=String(url),method=options?.method??'GET';calls.push({path,method});assert.equal(method,'GET','POST0');const u=new URL(path,'https://anvil.invalid');if(u.pathname.endsWith('/rework-pages'))requests.push(u.searchParams.get('cursor'));const mode=state.next;state.next=null;if(mode==='DELAY')return new Promise<Response>(r=>{state.release=r;});if(typeof mode==='number')return Response.json({code:mode===401?'AUTH_REQUIRED':'ACCESS_DENIED'},{status:mode});if(u.pathname.endsWith('/rework-pages')){const next=u.searchParams.get('cursor');const response=Response.json(page(next));if(mode==='JSON'){const original=response.json.bind(response);response.json=async()=>{await new Promise<void>(resolve=>{state.releaseJson=resolve;});return original();};}return response;}if(u.pathname.includes('/result-reworks/'))return Response.json({...f.stored,ref:{...f.stored.ref,id:u.pathname.split('/').at(-1)}});if(u.pathname.includes('/result-reviews/'))return Response.json(f.sources.review);assert.fail('미모델 요청 '+path);});}
 const props:any={client:client(),result:f.sources.result,assignment:f.sources.assignment,onAuthenticationLost:()=>{lost++;},onAccessUnavailable:(code:string)=>unavailable.push(code)};
 const commits:string[]=[];function Host(){ui.React.useLayoutEffect(()=>{commits.push(container.textContent);});return ui.React.createElement(ui.StoredResultReworkHistory,props);}
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
