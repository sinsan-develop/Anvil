import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {contentCriteria} from '../../../apps/web/src/features/workspace/assignment-confirmation-api.ts';
import {checkpointBufferKey} from '../../../apps/web/src/features/session-detail/checkpoint-api.ts';
import {emptyCheckpointForm} from '../../../apps/web/src/features/session-detail/checkpoint-form-restore.ts';
import {capabilityNames} from '../../../apps/web/src/features/connections/api.ts';
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

const pid='11111111-1111-4111-8111-111111111111',aid='22222222-2222-4222-8222-222222222222',at='2026-10-19T10:00:00.000Z',ref={id:pid,version:1,contentHash:'a'.repeat(64)},hash=(v:unknown)=>contentHash(canonicalJson(v));
export function fixture(tools=false){
 const definition={taskRef:{planRef:ref,taskCode:'FN09',applicationRef:ref,nodeId:'개발'},baselineRefs:[],allowedScopes:[],environmentRef:null,budgetRef:null,parentAssignmentRef:null,recordingPolicyRef:null,purpose:'요구사항에 따른 개발',goal:'등록된 임무 조회',ownerRole:'단계책임자',integrationResponsibility:'원문과 검수 연결',inputs:['설계'],outputs:['구현'],acceptanceCriteria:['핵심 동작 확인'],verificationRequirements:['필요 범위 검사'],included:['정확 임무'],excluded:['다른 프로젝트'],requiredCapabilities:[]},snapshot={definition,reason:'시험 원문',previousRef:null,basis:{planRef:ref,applicationRef:ref,designRef:ref,taskCode:'FN09',nodeId:'개발',taskCardHash:'b'.repeat(64)},readinessIssues:[],status:'DRAFT',ready:false,executionAuthorized:false,dispatchPerformed:false},draftRef={id:aid,version:1,contentHash:hash(snapshot)},draft={projectId:pid,ref:draftRef,snapshot,headVersion:1,sourceCurrentness:'NOT_RECHECKED',observedAt:at};
 const confirmedSnapshot={draftRef,definition,reviewRefs:[ref],reason:'과거 내용 확정',confirmedBy:{kind:'HUMAN',userId:pid},confirmedAt:at,contentConfirmed:true,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false},confirmedRef={id:aid,version:1,contentHash:hash(confirmedSnapshot)},confirmed={projectId:pid,ref:confirmedRef,snapshot:confirmedSnapshot,observedAt:at},decision={projectId:pid,draftRef,criteriaVersion:1,criteria:contentCriteria,reviews:[],hasMoreReviews:false,contentIssues:[],currentIssue:'REVIEW_REQUIRED',confirmedRef,latestReviewAccepted:false,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt:at},state={projectId:pid,assignmentRef:confirmedRef,roles:[],bindings:[],preparations:[],hasMorePreparations:false,currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false},calls:string[]=[];let fault='',after=()=>{};
 const input={kind:'CONNECTION_CANDIDATE',candidateRef:null,policyRef:ref,expiresAt:'2099-01-01T00:00:00.000Z',candidate:{label:'저장된 도구 후보',toolProduct:'합성 코딩 도구',toolVersion:'시험 버전',adapterKind:'CLI'},reason:'도구 표시'},candidate={kind:input.kind,input,readiness:{state:'NOT_READY',executionAuthorized:false,missingRequirements:[]},capabilities:Object.keys(capabilityNames).map(code=>({code,documentation:null,measurement:{state:'UNVERIFIED',toolVersion:null,environmentRef:null,executionRef:null,evidenceRefs:[]},controlLevel:'UNVERIFIED',limitations:[]}))},toolRef={...ref,id:'33333333-3333-4333-8333-333333333333',contentHash:hash(candidate)},tool={ref:toolRef,candidate,expired:false,createdAt:at,recordedBy:pid,executionAuthorized:false,observedAt:at};
 if(tools){const roleSnapshot={kind:'COORDINATOR',stageRef:null,parentRoleRef:null,reason:'총괄',definedBy:{kind:'HUMAN',userId:pid},definedAt:at},roleRef={...ref,contentHash:hash(roleSnapshot)},bindingSnapshot={assignmentRef:confirmedRef,roleRef,connectionRef:toolRef,existingSessionBindingRef:null,reason:'예약',sessionRef:ref,generation:1,state:'RESERVED',externalSessionHandleRef:null,connectionReadiness:'CANDIDATE_ONLY',executionAuthorized:false,dispatchPerformed:false,boundBy:{kind:'HUMAN',userId:pid},boundAt:at};(state.roles as any[]).push({projectId:pid,ref:roleRef,snapshot:roleSnapshot});(state.bindings as any[]).push({projectId:pid,ref:{...ref,id:'44444444-4444-4444-8444-444444444444',contentHash:hash(bindingSnapshot)},snapshot:bindingSnapshot});}
 const client=new ApiClient(async(url,options)=>{assert.equal(options?.method??'GET','GET');const path=String(url);calls.push(path);const base='/api/v1/projects/'+pid+'/';let value:any;
  if(path===base+'assignment-drafts/'+aid+'/versions/1')value=draft;
  else if(path===base+'assignment-drafts/'+aid+'/versions/1/decision')value=decision;
  else if(path===base+'assignments/'+aid+'/versions/1')value=confirmed;
  else if(path===base+'assignments/'+aid+'/versions/1/execution-preparation-state')value=state;
  else if(path===base+'connection-candidates/'+toolRef.id+'/versions/1'){if(fault==='TOOL_DENIED')return Response.json({code:'ACCESS_DENIED'},{status:403});if(fault==='TOOL_EXPIRED_AUTH')return Response.json({code:'AUTH_REQUIRED'},{status:401});value=tool;}
  else assert.fail('NO_UNREGISTERED_PATH');
  after();if(fault==='DENIED')return Response.json({error:{code:'FORBIDDEN'}},{status:403});if(fault==='HASH'&&value===confirmed)value={...confirmed,snapshot:{...confirmedSnapshot,reason:'변조'}};if(fault==='PROJECT'&&value===state)value={...state,projectId:aid};return Response.json(value);
 });return{client,draft,decision,confirmed,state,tool,calls,fault:(v:string)=>fault=v,after:(fn:()=>void)=>after=fn};
}

before(async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/session-detail/SessionDetailPage.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:session-context',name:'SessionContextTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'session-memory-entry',resolveId(id){if(id.endsWith('virtual:session-context'))return '\0session-context';},load(id){if(id==='\0session-context')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{SessionDetailPage}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};export{React,createRoot,SessionDetailPage,ApiClient};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return SessionContextTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});

/** 현재 App.tsx:225/316과 같은 user/client/project/fullref key. 무key 단독 Page로 재현하지 않는다. */
async function mount(confirmed=false){
 const f=fixture();f.client=new ui.ApiClient(f.client.transport);if(!confirmed)Object.assign(f.decision,{confirmedRef:null});const transport=f.client.transport;let delay=false,jsonDelay=false,jsonRelease:(()=>void)|null=null,release:((r:Response)=>void)|null=null,lost=0,mutations=0;
 const calls:{path:string;method:string}[]=[],commits:string[]=[],container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 const wrap=()=>async(url:any,options:any)=>{const method=options?.method??'GET';calls.push({path:String(url),method});assert.equal(method,'GET');if(delay){delay=false;return new Promise<Response>(r=>{release=r;});}if(String(url).endsWith('/result-pages'))return Response.json({projectId:pid,assignmentRef:f.confirmed.ref,items:[],hasMore:false,nextCursor:null,selectionState:'NOT_SELECTED',observedAt:at});const response=await transport(url,options);if(jsonDelay){jsonDelay=false;const original=response.json.bind(response);response.json=async()=>{await new Promise<void>(resolve=>{jsonRelease=resolve;});return original();};}return response;};
 f.client.transport=wrap();
 const session={user:{id:pid},clientId:pid,csrfToken:'c'.repeat(43)},props:any={client:f.client,projectId:pid,assignmentRef:f.draft.ref,criteria:{session},checkpoint:{buffers:{},onChange:()=>{mutations++;}},onAuthenticationLost:()=>{lost++;}};
 if(confirmed)props.checkpoint.buffers[checkpointBufferKey(session,pid,f.confirmed.ref)]={...emptyCheckpointForm(),position:'보존할 미완료 기록',next:'다음 검수',reason:'합성 입력 보존'};
 function Host(){ui.React.useLayoutEffect(()=>{commits.push(container.textContent);});const s=props.criteria.session,key=s.user.id+':'+s.clientId+':'+props.projectId+':'+props.assignmentRef.id+':'+props.assignmentRef.version+':'+props.assignmentRef.contentHash;return ui.React.createElement(ui.SessionDetailPage,{...props,key});}
 async function render(){await ui.React.act(async()=>root.render(ui.React.createElement(Host)));}
 async function flush(){await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});}
 async function waitFor(value:string){const end=Date.now()+2000;while(!container.textContent.includes(value)&&Date.now()<end)await flush();assert(container.textContent.includes(value),'기존 정상 보호 원문 도달: '+value);}
 const nodes=(n=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))];
 async function click(label:string){const found=nodes().filter(n=>n.tagName==='BUTTON'&&n.textContent===label);assert.equal(found.length,1,label);assert(!found[0]!.disabled);await ui.React.act(async()=>found[0]!.dispatchEvent({type:'click',button:0,bubbles:true}));}
 async function close(){await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}
 await render();await waitFor('등록된 임무 조회');return{f,props,calls,commits,container,nodes,fiber(name:string){for(const n of nodes()){const key=Object.keys(n).find(k=>k.startsWith('__reactFiber$'));for(let fiber=key?(n as any)[key]:null;fiber;fiber=fiber.return)if(fiber.type?.name===name)return fiber.memoizedProps;}assert.fail('실제 child '+name);},render,flush,waitFor,click,close,wrap,lost:()=>lost,mutations:()=>mutations,hold(){delay=true;},holdJson(){jsonDelay=true;},get jsonRelease(){return jsonRelease;},get release(){return release;}};
}

test('정상 보호 원문 후 동일 App key의 새 CSRF 첫 commit은 이전 상세를 숨긴다',async()=>{
 const f=await mount();try{f.hold();const count=f.commits.length;f.props.criteria={...f.props.criteria,session:{...f.props.criteria.session,csrfToken:'d'.repeat(43)}};await f.render();assert(!f.commits[count]!.includes('등록된 임무 조회'),'새 CSRF 첫 commit 원문0');assert(f.release,'새 문맥 보호 GET');await ui.React.act(async()=>f.release!(Response.json(f.f.draft)));await f.waitFor('등록된 임무 조회');assert.equal(f.lost(),0);assert.equal(f.mutations(),0);}finally{await f.close();}
});


test('부모 방어: 실제 child에서 직접 캡처한 callback은 unmount 후 무효이며 실제 child 도달 반례와 구분한다',async()=>{
 const f=await mount(true);let closed=false;try{const checkpoint=f.fiber('CheckpointEditor'),reader=f.fiber('CheckpointFileReader');assert.equal(typeof checkpoint.onUnavailable,'function');assert.equal(typeof reader.onRestore,'function');await f.close();closed=true;await ui.React.act(async()=>{checkpoint.onUnavailable('AUTH_REQUIRED');reader.onRestore(emptyCheckpointForm());});assert.deepEqual({lost:f.lost(),changes:f.mutations()},{lost:0,changes:0});}finally{if(!closed)await f.close();}
});


test('정상 상세 새로고침은 기존 GET만 재조회하며 현재401/403은 원문을 숨기고 구분한다',async()=>{
 for(const status of[401,403]){const f=await mount();try{f.hold();await f.click('상세 원본 새로고침');assert(!f.container.textContent.includes('등록된 임무 조회'));assert(f.release);await ui.React.act(async()=>f.release!(Response.json({code:status===401?'AUTH_REQUIRED':'ACCESS_DENIED'},{status})));await f.flush();assert.equal(f.lost(),status===401?1:0);assert(!f.container.textContent.includes('등록된 임무 조회'));assert.equal(f.mutations(),0);await f.click('상세 원본 새로고침');await f.waitFor('등록된 임무 조회');assert(f.calls.every(c=>c.method==='GET'));}finally{await f.close();}}
});

test('같은 App mount의 CSRF/API 교체와 ABA는 옛401·응답을 새 문맥으로 채택하지 않는다',async()=>{
 for(const mode of['CSRF','API','USER','CLIENT_ID']){const f=await mount();try{f.hold();await f.click('상세 원본 새로고침');const release=f.release!;assert(release);const session=f.props.criteria.session,client=f.props.client;if(mode==='CSRF')f.props.criteria={...f.props.criteria,session:{...session,csrfToken:'d'.repeat(43)}};if(mode==='API')f.props.client=new ui.ApiClient(f.wrap());if(mode==='USER')f.props.criteria={...f.props.criteria,session:{...session,user:{id:aid}}};if(mode==='CLIENT_ID')f.props.criteria={...f.props.criteria,session:{...session,clientId:aid}};await f.render();await f.waitFor('등록된 임무 조회');f.props.criteria={...f.props.criteria,session};f.props.client=client;await f.render();await f.waitFor('등록된 임무 조회');const before=f.calls.length;await ui.React.act(async()=>release(Response.json({code:'AUTH_REQUIRED'},{status:401})));await f.flush();assert.equal(f.lost(),0,mode);assert.equal(f.calls.length,before,'옛 요청 후속GET0');assert.match(f.container.textContent,/등록된 임무 조회/);assert.equal(f.mutations(),0);}finally{await f.close();}}
});

test('동일 ApiClient의 무렌더 transport 교체는 옛401 폐기 후 현재 재조회·loading을 회복한다',async()=>{
 const f=await mount();try{f.hold();await f.click('상세 원본 새로고침');const release=f.release!;assert(release);f.props.client.transport=f.wrap();await ui.React.act(async()=>release(Response.json({code:'AUTH_REQUIRED'},{status:401})));await f.waitFor('등록된 임무 조회');assert.equal(f.lost(),0);await f.click('상세 원본 새로고침');await f.waitFor('등록된 임무 조회');assert.equal(f.mutations(),0);}finally{await f.close();}
});

test('정상 확정 child 표시·부모 buffer 참조와 bytes는 조회 세대 변경으로 초기화되지 않는다',async()=>{
 const f=await mount(true);try{assert(f.container.textContent.includes('상세 작업현황 초안'));assert(f.nodes().some(n=>n.tagName==='TEXTAREA'&&Object.keys(n).some(k=>k.startsWith('__reactProps$')&&(n as any)[k].value==='보존할 미완료 기록')));const checkpoint=f.props.checkpoint,criteria=f.props.criteria,buffers=checkpoint.buffers,before=JSON.stringify(buffers);f.props.criteria={...criteria,session:{...criteria.session,csrfToken:'d'.repeat(43)}};await f.render();await f.waitFor('등록된 임무 조회');assert(f.container.textContent.includes('상세 작업현황 초안'));assert.equal(f.props.checkpoint,checkpoint);assert.equal(f.props.checkpoint.buffers,buffers);assert.equal(JSON.stringify(buffers),before);assert.equal(f.mutations(),0);}finally{await f.close();}
});


test('원문 JSON 대기 중 CSRF 교체와 unmount는 옛 원문·후속 GET·인증 해제를 채택하지 않는다',async()=>{
 for(const mode of['CSRF','UNMOUNT']){const f=await mount();let closed=false;try{f.holdJson();await f.click('상세 원본 새로고침');const end=Date.now()+2000;while(!f.jsonRelease&&Date.now()<end)await f.flush();const release=f.jsonRelease;assert(release);if(mode==='CSRF'){f.props.criteria={...f.props.criteria,session:{...f.props.criteria.session,csrfToken:'d'.repeat(43)}};await f.render();await f.waitFor('등록된 임무 조회');}else{await f.close();closed=true;}const before=f.calls.length;await ui.React.act(async()=>release());await f.flush();assert.equal(f.calls.length,before);assert.equal(f.lost(),0);assert.equal(f.mutations(),0);}finally{if(!closed)await f.close();}}
});
