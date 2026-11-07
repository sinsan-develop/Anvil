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
const saved=new Map<string,PropertyDescriptor|undefined>();let ui:any;
const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
before(async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/knowledge/KnowledgePage.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:scope-boundary',name:'ScopeBoundaryTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'scope-boundary-memory',resolveId(id){if(id.endsWith('virtual:scope-boundary'))return '\0scope-boundary';},load(id){if(id==='\0scope-boundary')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{KnowledgePage}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};import{newKnowledge}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/knowledge/api.ts',import.meta.url)))};export{React,createRoot,KnowledgePage,ApiClient,newKnowledge};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const [key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return ScopeBoundaryTest;')();
});
after(()=>{for(const channel of channels){channel.port1.close();channel.port2.close();}for(const[key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});

// 제품 수정 없이 실제 부모·child·reader·decoder/native hash를 검증한다.
// MemoryNode는 레이아웃·브라우저 보안 검증이 아니며 모든 응답은 합성 메모리다.
const id=(n:number)=>`ab100031-0000-4000-8000-${String(n).padStart(12,'0')}`,pid=id(1),uid=id(2),cid=id(3),at='2026-10-31T00:00:00.000Z';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const graph={nodes:[{nodeId:'N1',name:'고정 단계',purpose:'원 단계 내용',kind:'HUMAN',position:{x:0,y:0},role:'USER',inputs:[],outputs:[],taskScope:{included:['검토'],excluded:[]},completionCriteria:['기록'],approvalBoundary:['사람 승인'],mode:'CASE_BY_CASE',limitPolicyRef:null,recordRequirements:['기록']}],edges:[],entryNodeId:'N1',terminalNodeIds:['N1']};
const sourceRef={id:id(4),version:1,contentHash:hash(graph)},methodSnapshot={name:'단계 원본',purpose:'관련성',graph,sourceRef},applicationRef={id:id(5),version:2,contentHash:hash(methodSnapshot)};
function card(name:string){return{taskCode:'UI10',type:'SCREEN',title:name,purpose:name+' 목적',designRefs:[],screenRefs:[],ownerRole:'담당',inputs:[],outputs:[],included:[],excluded:[],allowedFileRefs:[],startPrerequisites:[],acceptancePrerequisites:[],steps:[],testCases:[],acceptanceCriteria:[],evidenceRequirements:[],rollback:'별도 정정',recoveryNotes:'원문 보존'};}
function records(which:'A'|'B'){
 const n=which==='A'?10:20,planSnapshot={documentRef:sourceRef,designRef:sourceRef,screenReviewRefs:[],tasks:[card(which+' 고정업무')],dependencies:[],reason:'고정 업무',issues:[],relationalProjection:'STORED'},planRef={id:id(n),version:3,contentHash:hash(planSnapshot)};
 const body=which+' 부모본문',entry={kind:'FACT',title:'지식 '+which,reason:'관계 확인',scope:{projectId:pid,stageRefs:[{applicationRef,nodeId:'N1'}],taskRefs:[{planRef,taskCode:'UI10'}]},sourceRefs:[],relatedRefs:[],contentRef:{artifactId:id(n+1),bytes:Buffer.byteLength(body),contentHash:contentHash(body),mediaType:'text/plain;charset=utf-8'}},ref={id:id(n+2),version:1,contentHash:hash(entry)};
 return{knowledge:{ref,entry,body,state:'PROPOSED',headVersion:1,supersedesRef:null,appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',agentDelivery:'NOT_CONNECTED',history:[{id:id(n+3),kind:'PROPOSED',reason:entry.reason,actorRef:{kind:'HUMAN',userId:uid},recordedAt:at}]},plan:{ref:planRef,status:'DRAFT',...planSnapshot,executionEvidence:'NOT_CONNECTED',observedAt:at}};
}
const A=records('A'),B=records('B');
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}
function delayedJson(value:unknown,status=200){
 const parsed=deferred<void>(),release=deferred<void>(),state={parsed:0,returned:0},response=Response.json(value,{status}),json=response.json.bind(response);
 response.json=async()=>{const data=await json();state.parsed++;parsed.resolve();await release.promise;state.returned++;return data;};
 return{response,state,entered:parsed.promise,release:()=>release.resolve()};
}
const rejections:unknown[]=[];const onRejection=(e:unknown)=>rejections.push(e);before(()=>process.on('unhandledRejection',onRejection));after(()=>{process.off('unhandledRejection',onRejection);assert.deepEqual(rejections,[]);});
async function fixture(managed=false){
 const calls:{path:string;method:string}[]=[],unknown:string[]=[],controls:{plan:Map<string,()=>Response|Promise<Response>>;method:null|(()=>Response|Promise<Response>)}={plan:new Map(),method:null};let changes=0,lost=0;
 const client=new ui.ApiClient(async(path:any,init:any)=>{const p=String(path),method=init?.method??'GET';calls.push({path:p,method});assert.equal(method,'GET');
  if(p.startsWith(`/api/v1/projects/${pid}/conversations?`))return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:at});
  if(p.startsWith(`/api/v1/projects/${pid}/knowledge?`))return Response.json({items:[A,B].map(r=>({versionRef:r.knowledge.ref,title:r.knowledge.entry.title,kind:'FACT',sourceRefs:[],reasonSnippet:'관련성',state:'PROPOSED'})),hasMore:false,nextCursor:null,searchScope:'TITLE_REASON',observedAt:at});
  for(const r of[A,B]){if(p===`/api/v1/projects/${pid}/knowledge/${r.knowledge.ref.id}/versions/1`)return Response.json(r.knowledge);if(p===`/api/v1/projects/${pid}/work-plans/${r.plan.ref.id}/versions/3`)return controls.plan.has(r.plan.ref.id)?controls.plan.get(r.plan.ref.id)!():Response.json(r.plan);}
  if(p===`/api/v1/projects/${pid}`)return Response.json({id:pid,name:'프로젝트',purpose:'보관',desiredOutcome:'보존',version:1,createdAt:at,updatedAt:at,currentMethodologyRef:applicationRef,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[],viewerPermissions:['READ_PROJECT'],participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:cid,generation:1}});
  if(p===`/api/v1/projects/${pid}/methodology-application`)return controls.method?controls.method():Response.json({projectId:pid,applicationRef,snapshot:methodSnapshot,observedAt:at,executionState:'NOT_CONNECTED'});
  unknown.push(p);throw Error('UNEXPECTED_MEMORY_GET');
 });
 const session={user:{id:uid},clientId:cid,csrfToken:'c'.repeat(43)},buffer=ui.newKnowledge(pid,session,1);buffer.title='보존할 편집입력';buffer.reason='변경 금지';const original=structuredClone(buffer);
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 let liveBuffer=buffer;const change=()=>{changes++;};const props={client,projectId:pid,session,buffer,onChange:change,conversationBuffer:null,onConversationChange:change,exclusion:null,onExclusionChange:change,correction:null,onCorrectionChange:change,decision:null,onDecisionChange:change,onAuthenticationLost:()=>{lost++;}};
 function ManagedPage(){const[current,setCurrent]=ui.React.useState(buffer);liveBuffer=current;return ui.React.createElement(ui.KnowledgePage,{...props,buffer:current,onChange:(value:any)=>{changes++;setCurrent(value);}});}
 const nodes=(predicate:(n:any)=>boolean)=>{const all:any[]=[];function visit(n:any){if(predicate(n))all.push(n);for(const c of n.childNodes)visit(c);}visit(container);return all;};
 const button=(name:string)=>{const b=nodes(n=>n.tagName==='BUTTON'&&n.textContent===name)[0];assert(b,'버튼 없음: '+name+' / '+container.textContent);return b;};
 const click=async(b:any)=>{assert(!b.disabled,'비활성 버튼');await ui.React.act(async()=>{b.dispatchEvent({type:'click',button:0,bubbles:true});});};
 const settle=async()=>{await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});};
 const wait=async(check:()=>boolean)=>{const end=Date.now()+2000;while(!check()&&Date.now()<end)await settle();assert(check(),container.textContent);};
 const shown=()=>nodes(n=>n.getAttribute('aria-label')==='지식 관련 고정 원문'),status=()=>nodes(n=>n.getAttribute('role')==='status'),alerts=()=>nodes(n=>n.getAttribute('role')==='alert');
 const open=async(which:'A'|'B')=>{const b=nodes(n=>{if(n.tagName!=='BUTTON'||n.textContent!=='지식 원문 보기')return false;let p=n.parentNode;while(p&&p.tagName!=='LI')p=p.parentNode;return p?.textContent.includes('지식 '+which);})[0];assert(b,'지식 선택 없음');await click(b);await wait(()=>nodes(n=>n.getAttribute('aria-label')==='보관 지식 원문'&&n.textContent===which+' 부모본문').length===1);};
 await ui.React.act(async()=>root.render(managed?ui.React.createElement(ManagedPage):ui.React.createElement(ui.KnowledgePage,props)));await wait(()=>nodes(n=>n.tagName==='BUTTON'&&n.textContent==='지식 원문 보기').length===2);
 return{calls,unknown,controls,client,buffer,original,currentBuffer:()=>liveBuffer,container,button,click,settle,wait,shown,status,alerts,open,lost:()=>lost,changes:()=>changes,unchanged:()=>assert.deepEqual(buffer,original),close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
function traceDigest(holdSnapshot=false){
 const subtle=globalThis.crypto.subtle,descriptor=Object.getOwnPropertyDescriptor(subtle,'digest'),native=subtle.digest.bind(subtle),entered=deferred<void>(),gate=deferred<void>();
 const state={started:0,done:0,targetNativeDone:0,targetReturned:0,held:false,completedHashes:new Set<string>()};
 Object.defineProperty(subtle,'digest',{configurable:true,value:async(algorithm:AlgorithmIdentifier,input:BufferSource)=>{
  const bytes=ArrayBuffer.isView(input)?new Uint8Array(input.buffer,input.byteOffset,input.byteLength):new Uint8Array(input),target=new TextDecoder().decode(bytes)===canonicalJson(methodSnapshot);state.started++;
  const result=await native(algorithm,input);state.done++;state.completedHashes.add(Buffer.from(result).toString('hex'));if(target){state.targetNativeDone++;if(holdSnapshot&&!state.held){state.held=true;entered.resolve();await gate.promise;}state.targetReturned++;}return result;
 }});
 return{state,entered:entered.promise,release:()=>gate.resolve(),restore:()=>{if(descriptor)Object.defineProperty(subtle,'digest',descriptor);else Reflect.deleteProperty(subtle,'digest');}};
}
function assertReadOnly(f:Awaited<ReturnType<typeof fixture>>){assert(f.calls.every(c=>c.method==='GET'));assert.deepEqual(f.unknown,[]);assert.equal(f.changes(),0);f.unchanged();}

test('scopeBoundary 실제 부모 fullref A→B→A는 늦은 A성공을 새선택에 채택하지 않는다',async()=>{
 const f=await fixture(),late=delayedJson(A.plan),trace=traceDigest();try{await f.open('A');f.controls.plan.set(A.plan.ref.id,()=>late.response);await f.click(f.button('관련 업무 1 원문 확인'));await late.entered;assert.equal(late.state.parsed,1);
  await f.open('B');assert.equal(f.shown().length,0);late.release();await f.wait(()=>late.state.returned===1&&trace.state.completedHashes.has(A.plan.ref.contentHash)&&trace.state.done===trace.state.started);await f.settle();assert.equal(f.shown().length,0);assert.equal(f.alerts().length,0);assert(f.container.textContent.includes('B 부모본문'));assert(!f.container.textContent.includes('A 고정업무'));
  await f.click(f.button('관련 업무 1 원문 확인'));await f.wait(()=>f.shown().length===1);assert(f.shown()[0].textContent.includes('B 고정업무'));
  f.controls.plan.delete(A.plan.ref.id);await f.open('A');assert.equal(f.shown().length,0);await f.click(f.button('관련 업무 1 원문 확인'));await f.wait(()=>f.shown().length===1);assert(f.shown()[0].textContent.includes('A 고정업무'));assert.equal(f.lost(),0);assertReadOnly(f);
 }finally{late.release();trace.release();try{await f.close();await f.settle();}finally{trace.restore();}}
});

test('scopeBoundary 실제 부모 교체 뒤 늦은401은 새선택 오류·인증상실로 전파되지 않는다',async()=>{
 const f=await fixture(),late=delayedJson({code:'OLD_SCOPE_AUTH_REQUIRED'},401);try{await f.open('A');f.controls.plan.set(A.plan.ref.id,()=>late.response);await f.click(f.button('관련 업무 1 원문 확인'));await late.entered;await f.open('B');late.release();await f.wait(()=>late.state.returned===1);await f.settle();assert.equal(f.lost(),0);assert.equal(f.alerts().length,0);assert(!f.container.textContent.includes('OLD_SCOPE_AUTH_REQUIRED'));assert(f.container.textContent.includes('B 부모본문'));assert.equal(f.shown().length,0);await f.click(f.button('관련 업무 1 원문 확인'));await f.wait(()=>f.shown().length===1);assert(f.shown()[0].textContent.includes('B 고정업무'));assertReadOnly(f);
 }finally{late.release();await f.close();await f.settle();}
});

test('scopeBoundary Stage 최종JSON 반환대기 중 닫기는 실제hash 완료 뒤에도 원문을 숨긴다',async()=>{
 const f=await fixture(),late=delayedJson({projectId:pid,applicationRef,snapshot:methodSnapshot,observedAt:at,executionState:'NOT_CONNECTED'}),trace=traceDigest();try{
  await f.open('A');f.controls.method=()=>late.response;await f.click(f.button('관련 단계 1 원문 확인'));await late.entered;const calls=f.calls.length;
  await f.click(f.button('관련 고정 원문 닫기'));late.release();await f.wait(()=>late.state.returned===1&&trace.state.targetReturned>=1&&trace.state.done===trace.state.started);await f.settle();assert.equal(f.shown().length,0);assert.equal(f.status().length,0);assert.equal(f.alerts().length,0);assert.equal(f.calls.length,calls);assert.equal(f.lost(),0);
  f.controls.method=null;assert(!f.button('관련 단계 1 원문 확인').disabled);await f.click(f.button('관련 단계 1 원문 확인'));await f.wait(()=>f.shown().length===1);assert(f.shown()[0].textContent.includes('단계 원본'));assertReadOnly(f);
 }finally{late.release();trace.release();try{await f.close();await f.settle();}finally{trace.restore();}}
});

test('scopeBoundary Stage native snapshot digest 완료후 반환대기 중 닫기는 재조회만 허용한다',async()=>{
 const f=await fixture(),trace=traceDigest(true);try{await f.open('A');await f.click(f.button('관련 단계 1 원문 확인'));await trace.entered;assert.equal(trace.state.targetNativeDone,1);assert.equal(trace.state.targetReturned,0);const calls=f.calls.length;
  await f.click(f.button('관련 고정 원문 닫기'));trace.release();await f.wait(()=>trace.state.targetReturned===1&&trace.state.done===trace.state.started);await f.settle();assert.equal(f.shown().length,0);assert.equal(f.status().length,0);assert.equal(f.alerts().length,0);assert.equal(f.calls.length,calls);assert(!f.button('관련 단계 1 원문 확인').disabled);
  await f.click(f.button('관련 단계 1 원문 확인'));await f.wait(()=>f.shown().length===1);assert(f.shown()[0].textContent.includes('고정 단계'));assert.equal(f.lost(),0);assertReadOnly(f);
 }finally{trace.release();try{await f.close();await f.settle();}finally{trace.restore();}}
});
// 실제 Page를 React host state에 연결하며 기존4의 고정callback fixture는 그대로 유지한다.
// 입력은 React 소유 onChange로 반영하므로 native 브라우저 입력 검증과 구분한다.
test('pickerIdentity 실제 편집buffer·원문 A→B→A·입력변경 뒤 선택기는 각각 하나다',async()=>{
 const f=await fixture(true);try{
  const nodes=(predicate:(n:any)=>boolean)=>{const result:any[]=[];function visit(n:any){if(predicate(n))result.push(n);for(const child of n.childNodes)visit(child);}visit(f.container);return result;};
  const panels=(label:string)=>nodes(n=>n.getAttribute('aria-label')===label),documents=()=>nodes(n=>n.tagName==='BUTTON'&&n.textContent==='문서 출처 선택');
  assert.ok(panels('지식 보관파일 출처 작성').length>0);assert.ok(panels('지식 관련성 선택').length>0);assert.equal(documents().length,1);
  await f.open('A');await f.open('B');await f.open('A');assert.equal(f.changes(),0,'부모 원문선택은 초안을 바꾸지 않는다');const before=f.calls.length;
  const title=panels('지식 제목')[0];assert.ok(title);const props=title[Object.keys(title).find(k=>k.startsWith('__reactProps$'))!];assert.equal(typeof props?.onChange,'function');
  await ui.React.act(async()=>props.onChange({target:{value:'명시적으로 바꾼 제목'}}));await f.settle();
  assert.deepEqual(f.currentBuffer(),{...f.original,title:'명시적으로 바꾼 제목',dirty:true,failure:null},'명시제목 외 원body·scope·sourceRefs·pending 보존');assert.equal(f.changes(),1);assert.equal(f.calls.length,before,'로컬 입력의 추가GET/POST0');assert.equal(f.unknown.length,0);assert(f.calls.every(c=>c.method==='GET'));assert.equal(f.lost(),0);
  assert.deepEqual({artifact:panels('지식 보관파일 출처 작성').length,scope:panels('지식 관련성 선택').length,documentButtons:documents().length},{artifact:1,scope:1,documentButtons:1},'같은 Page의 편집 선택기 중복0');
 }finally{await f.close();await f.settle();}
});
