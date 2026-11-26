import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {contentCriteria} from '../../../apps/web/src/features/workspace/assignment-confirmation-api.ts';
import {checkpointFixture} from '../FN13/checkpoint-fixture.ts';
import {createCheckpointRecord} from '../../../apps/server/modules/checkpoints/checkpoint-record.ts';
import {freezeCheckpointSave,checkpointBufferKey} from '../../../apps/web/src/features/session-detail/checkpoint-api.ts';
import {emptyCheckpointForm} from '../../../apps/web/src/features/session-detail/checkpoint-form-restore.ts';
import {capabilityNames} from '../../../apps/web/src/features/connections/api.ts';
import {understandingHistoryFixture} from './understanding-history-fixture.ts';
import {prepareCheckpointDraft} from '../../../apps/server/modules/checkpoints/checkpoint-input.ts';
import {resultFixture} from './result-view-fixture.ts';
import {observationJournalFor} from './observation-journal-fixture.ts';
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
 const preparation=fileURLToPath(new URL('../../../apps/web/src/features/session-detail/PreparationHistory.tsx',import.meta.url));
 const comparison=fileURLToPath(new URL('../../../apps/web/src/features/session-detail/CheckpointJournalComparison.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:session-context',name:'SessionContextTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'session-memory-entry',resolveId(id){if(id.endsWith('virtual:session-context'))return '\0session-context';},load(id){if(id==='\0session-context')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{SessionDetailPage}from${JSON.stringify(entry)};import * as Preparation from${JSON.stringify(preparation)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};import{CheckpointEditor}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/session-detail/CheckpointEditor.tsx',import.meta.url)))};import{CheckpointJournalComparison}from${JSON.stringify(comparison)};export{React,createRoot,SessionDetailPage,Preparation,CheckpointEditor,CheckpointJournalComparison,ApiClient};`;}}]});
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

async function mountCheckpointRestore(initial:ReturnType<typeof emptyCheckpointForm>|null=null){
 const f=checkpointFixture(),input=structuredClone(f.input);input.state.completedItems[0].itemId='completed-1';input.state.remaining[0].itemId='remaining-1';const prepared=prepareCheckpointDraft(f.assignment,input),record=createCheckpointRecord(prepared,f.by,f.at),ref={id:crypto.randomUUID(),version:1,contentHash:contentHash(canonicalJson(record.snapshot))},stored={projectId:f.assignment.projectId,ref,...record,observedAt:'2026-11-01T00:00:01.000Z',serverSequence:7},page={items:[{ref,assignmentRef:f.assignment.ref,previousRef:null,recordedAt:f.at,serverSequence:7}],hasMore:false,nextCursor:null,observedAt:stored.observedAt},calls:{path:string;method:string}[]=[];let conflict=false;
 const transport=async(path:any,options:any)=>{const method=options?.method??'GET';calls.push({path:String(path),method});const base=`/api/v1/projects/${f.assignment.projectId}`;if(String(path).startsWith(base+'/checkpoints?')&&method==='GET')return Response.json(page);if(String(path)===base+'/checkpoints/'+ref.id&&method==='GET')return conflict?Response.json({code:'VERSION_CONFLICT'},{status:409}):Response.json(stored);assert.fail('복원 동선 밖 요청 '+method+' '+path);};
 let client=new ui.ApiClient(transport),session={user:{id:f.by.userId},clientId:f.by.clientId,csrfToken:'C'.repeat(43)},current:any=initial,observedBuffers:any=initial?null:{},visible=true,deferChange=false,pendingChange:(()=>void)|null=null,replaceCurrent:(v:any)=>void=()=>{};const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 function Host(){const[buffers,setBuffers]=ui.React.useState(()=>{const key=checkpointBufferKey(session,f.assignment.projectId,f.assignment.ref);return(initial?{[key]:initial}:{} as any);}),key=checkpointBufferKey(session,f.assignment.projectId,f.assignment.ref);observedBuffers=buffers;current=buffers[key]??null;const apply=(k:string,change:any)=>setBuffers((old:any)=>{const previous=old[k]??null,next=change(previous);current=next;return next===previous?old:{...old,[k]:next};});replaceCurrent=v=>setBuffers((old:any)=>({...old,[key]:v}));return visible?ui.React.createElement(ui.CheckpointEditor,{client,assignment:f.assignment,session,storage:{buffers,onChange:(k:string,change:any)=>{if(deferChange)pendingChange=()=>apply(k,change);else apply(k,change);}},onUnavailable:()=>{}}):null;}
 async function render(){await ui.React.act(async()=>root.render(ui.React.createElement(Host)));}
 async function flush(){await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});}
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))],button=(name:string,partial=false)=>{const values=nodes().filter(n=>n.tagName==='BUTTON'&&(partial?n.textContent.includes(name):n.textContent===name));assert.equal(values.length,1,name);return values[0]!;};
 async function click(name:string,partial=false){const b=button(name,partial);assert(!b.disabled,name);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));}
 async function waitFor(check:()=>boolean){const end=Date.now()+2000;while(!check()&&Date.now()<end)await flush();assert(check(),container.textContent);}
 await render();return{f,ref,stored,calls,container,nodes,button,click,waitFor,flush,current:()=>current,buffers:()=>observedBuffers,pending:()=>!!pendingChange,render,transport,conflict(){conflict=true;},defer(){deferChange=true;},async flushChange(){const change=pendingChange;assert(change);pendingChange=null;deferChange=false;await ui.React.act(async()=>change());},async replace(v:any){await ui.React.act(async()=>replaceCurrent(v));},changeSession:async()=>{session={...session,csrfToken:'D'.repeat(43)};await render();},changeClient:async()=>{client=new ui.ApiClient(transport);await render();},swapTransport:async(rendered=true)=>{client.transport=transport.bind(null);if(rendered)await render();},hide:async()=>{visible=false;await render();},close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}

test('서버에서 고정 조회한 체크포인트만 명시 클릭으로 빈 편집 입력과 다음 기준에 복원한다',async()=>{
 const f=await mountCheckpointRestore();try{assert.equal(f.calls.length,0);assert.equal(f.current(),null);await f.click('보관 기록 목록 조회');await f.waitFor(()=>f.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent.includes('기록 선택')));await f.click('기록 선택',true);await f.waitFor(()=>f.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='기록 닫기'));assert.equal(f.current(),null);assert.equal(f.calls.length,2);await f.click('이 기록을 빈 입력으로 복원');await f.waitFor(()=>f.current()?.position==='구현 뒤 검수 중');assert.equal(f.current().serverWork.baseRef.id,f.ref.id);assert.equal(f.calls.length,2);assert(f.calls.every(c=>c.method==='GET'));assert.equal(f.current().serverWork.pending,null);assert.equal(f.current().serverWork.uncertain,false);}finally{await f.close();}
});
test('복원 updater가 늦게 평가돼도 같은 조회 문맥의 빈 값만 바꾸고 입력·세션·client·transport·조회 epoch 경합은 보존한다',async()=>{
 async function open(f:Awaited<ReturnType<typeof mountCheckpointRestore>>){await f.click('보관 기록 목록 조회');await f.waitFor(()=>f.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent.includes('기록 선택')));await f.click('기록 선택',true);await f.waitFor(()=>f.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='기록 닫기'));}
 const positive=await mountCheckpointRestore();try{await open(positive);positive.defer();await positive.click('이 기록을 빈 입력으로 복원');await positive.waitFor(positive.pending);assert.equal(positive.current(),null);await positive.flushChange();assert.equal(positive.current().position,'구현 뒤 검수 중');assert.equal(positive.current().serverWork.baseRef.id,positive.ref.id);}finally{await positive.close();}
 for(const mode of['INPUT','SESSION','CLIENT','TRANSPORT','RECORD_EPOCH']as const){const f=await mountCheckpointRestore();try{await open(f);f.defer();await f.click('이 기록을 빈 입력으로 복원');await f.waitFor(f.pending);if(mode==='INPUT')await f.replace({...emptyCheckpointForm(),position:'사용자 작성 중'});if(mode==='SESSION')await f.changeSession();if(mode==='CLIENT')await f.changeClient();if(mode==='TRANSPORT')await f.swapTransport(false);if(mode==='RECORD_EPOCH')await f.click('보관 기록 목록 조회');await f.flushChange();assert.notEqual(f.current()?.position,'구현 뒤 검수 중',mode);if(mode==='INPUT')assert.equal(f.current()?.position,'사용자 작성 중');else assert.equal(Object.keys(f.buffers()).length,0,mode+' stale updater 전역 상태 no-op');}finally{await f.close();}}
 const authored=await mountCheckpointRestore({...emptyCheckpointForm(),position:'기존 작성'});try{await open(authored);assert.equal(authored.button('이 기록을 빈 입력으로 복원').disabled,true);assert.equal(authored.current()?.position,'기존 작성');assert.equal(authored.calls.length,2);}finally{await authored.close();}
 const conflict=await mountCheckpointRestore();try{await conflict.click('보관 기록 목록 조회');await conflict.waitFor(()=>conflict.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent.includes('기록 선택')));conflict.conflict();await conflict.click('기록 선택',true);await conflict.waitFor(()=>conflict.container.textContent.includes('VERSION_CONFLICT'));assert.equal(conflict.current(),null);assert(!conflict.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='이 기록을 빈 입력으로 복원'));assert(conflict.calls.every(c=>c.method==='GET'));}finally{await conflict.close();}
});

test('정상 보호 원문 후 동일 App key의 새 CSRF 첫 commit은 이전 상세를 숨긴다',async()=>{
 const f=await mount();try{f.hold();const count=f.commits.length;f.props.criteria={...f.props.criteria,session:{...f.props.criteria.session,csrfToken:'d'.repeat(43)}};await f.render();assert(!f.commits[count]!.includes('등록된 임무 조회'),'새 CSRF 첫 commit 원문0');assert(f.release,'새 문맥 보호 GET');await ui.React.act(async()=>f.release!(Response.json(f.f.draft)));await f.waitFor('등록된 임무 조회');assert.equal(f.lost(),0);assert.equal(f.mutations(),0);}finally{await f.close();}
});


test('부모 방어: 실제 child에서 직접 캡처한 callback은 unmount 후 무효이며 실제 child 도달 반례와 구분한다',async()=>{
 const f=await mount(true);let closed=false;try{const checkpoint=f.fiber('CheckpointEditor'),reader=f.fiber('CheckpointFileReader');assert.equal(typeof checkpoint.onUnavailable,'function');assert.equal(typeof reader.onRestore,'function');await f.close();closed=true;await ui.React.act(async()=>{checkpoint.onUnavailable('AUTH_REQUIRED');reader.onRestore(emptyCheckpointForm());});assert.deepEqual({lost:f.lost(),changes:f.mutations()},{lost:0,changes:0});}finally{if(!closed)await f.close();}
});
test('상세 부모는 현재 scope에서 검산된 서버 체크포인트만 결과 대조에 전달한다',async()=>{
 const f=await mount(true);try{
  const editor=f.fiber('CheckpointEditor'),stored={ref:{id:aid,version:1,contentHash:'9'.repeat(64)}};assert.equal(typeof editor.onStoredCheckpoint,'function');
  await ui.React.act(async()=>editor.onStoredCheckpoint(stored));assert.deepEqual(f.fiber('SessionResults').checkpointStored,stored);
 }finally{await f.close();}
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

function normalWorkReview(){
 const f=understandingHistoryFixture(),history:any=structuredClone(f.history),row=history.items[0],binding=row.snapshot.currentBinding;
 const extra=(n:number)=>({id:`22222222-2222-4222-8222-${String(n).padStart(12,'0')}`,version:1,contentHash:String(n%10).repeat(64)}),responseRef={...binding.responseRef,version:1},responsePartRef={...binding.responsePartRefs[0],version:1};
 row.snapshot.input.responseRef=responseRef;for(const item of row.snapshot.input.items)item.responsePartRefs=[responsePartRef];row.snapshot.request.payload=structuredClone(row.snapshot.input);row.snapshot.requestHash=hash(row.snapshot.request);
 history.transport='NORMAL_PROTECTED';binding.transport='NORMAL_PROTECTED';binding.responseRef=responseRef;binding.responsePartRefs=[responsePartRef];for(const item of binding.criteria)item.responsePartRefs=[responsePartRef];binding.sourceBasis={bundleRef:binding.bundleRef,preparationRef:extra(21),grantRef:extra(22),startCommandRef:extra(23),manifestRef:extra(24),roleBindingRef:binding.subjectBindingRef,agentSessionRef:extra(25),roleRef:extra(26),subjectBindingRef:binding.subjectBindingRef,requestRef:extra(27),responseRef:binding.responseRef,basisRefs:binding.basisRefs,requiredPartRefs:binding.requiredPartRefs,receivedPartRefs:binding.receivedPartRefs,deliveryReceiptRefs:[extra(28)],responsePartRefs:binding.responsePartRefs,latestInstructionRefs:binding.latestInstructionRefs,status:'SOURCE_BASIS_ONLY',subjectBindingState:'VERIFIED',reviewAvailable:false,scope:f.scope,executionAuthorized:false,dispatchPerformed:false};
 row.ref.contentHash=hash(row.snapshot);return{history,scope:f.scope,reviewRef:row.ref};
}
async function mountWorkReview(){
 assert.equal(typeof ui.Preparation.WorkPreparationUnderstandingSource,'function');const source=normalWorkReview(),calls:{path:string;method:string}[]=[],container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 let basis={scope:source.scope,reviewRef:source.reviewRef},mode:'OK'|'HOLD'|'AUTH'='OK',release:((value:Response)=>void)|null=null,lost=0;
 const client=new ui.ApiClient(async(url:any,options:any)=>{calls.push({path:String(url),method:options?.method??'GET'});if(mode==='HOLD')return new Promise<Response>(resolve=>{release=resolve;});if(mode==='AUTH')return Response.json({code:'AUTH_REQUIRED'},{status:401});return Response.json(source.history);});
 const originalTransport=client.transport;
 const nodes=(n=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))];
 function Host(){return ui.React.createElement(ui.Preparation.WorkPreparationUnderstandingSource,{client,basis,onAuthenticationLost:()=>{lost++;}});}
 async function render(){await ui.React.act(async()=>root.render(ui.React.createElement(Host)));}
 async function flush(){await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});}
 async function waitFor(value:string){const end=Date.now()+2000;while(!container.textContent.includes(value)&&Date.now()<end)await flush();assert(container.textContent.includes(value),value);}
 async function click(){const found=nodes().filter(n=>n.tagName==='BUTTON'&&n.textContent==='정착 이해 판단 원문 검산');assert.equal(found.length,1);await ui.React.act(async()=>found[0]!.dispatchEvent({type:'click',button:0,bubbles:true}));}
 await render();return{source,calls,container,nodes,click,flush,waitFor,lost:()=>lost,originalTransport,hold(){mode='HOLD';},auth(){mode='AUTH';},ok(){mode='OK';},replaceReview(reviewRef:any){basis={...basis,reviewRef};return render();},replaceTransport(transport:typeof fetch){client.transport=transport;return render();},finish(value=Response.json(source.history)){assert(release);const send=release;release=null;return ui.React.act(async()=>send!(value));},async close(){await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
test('WORK 준비 정착 판단은 명시 클릭 1GET 후 6항목·이유·참조만 표시한다',async()=>{
 const f=await mountWorkReview();try{assert.equal(f.calls.length,0);await f.click();await f.waitFor('과거 별도 사람 검토');assert.deepEqual(f.calls,[{path:`/api/v1/projects/${f.source.scope.projectId}/executions/${f.source.scope.executionId}/understanding-reviews?generation=1`,method:'GET'}]);for(const value of ['왜 이 일을 하는가','기준과 권한','결정과 이유','완료·현재 위치','실제 차이와 공백','다음 행동과 미확인','원문을 대조한 보관 판단 <img src=x>','현재 실행·재개 허가가 아닙니다'])assert(f.container.textContent.includes(value),value);assert(!f.nodes().some(n=>n.tagName==='IMG'));assert(!/currentBinding|CONVERSATION|claudeQueryParams|secret/i.test(f.container.textContent));assert(f.calls.every(c=>c.method==='GET'));}finally{await f.close();}
});
test('WORK 판단 재검산은 늦은 응답·fullref 불일치를 버리고 401은 이전 본문을 지운다',async()=>{
 const f=await mountWorkReview();try{await f.click();await f.waitFor('과거 별도 사람 검토');f.hold();await f.click();assert(!f.container.textContent.includes('과거 별도 사람 검토'));
  await f.replaceReview({...f.source.reviewRef,contentHash:'0'.repeat(64)});await f.finish();await f.flush();assert(!f.container.textContent.includes('과거 별도 사람 검토'));assert.equal(f.lost(),0);
  f.ok();await f.click();await f.waitFor('UNDERSTANDING_HISTORY_RESPONSE_INVALID');assert(!f.container.textContent.includes('과거 별도 사람 검토'));
  f.auth();await f.click();await f.waitFor('AUTH_REQUIRED');assert.equal(f.lost(),1);assert(!f.container.textContent.includes('과거 별도 사람 검토'));
 }finally{await f.close();}
});
test('WORK 판단은 동일 client의 transport 교체·ABA에서 이전 본문과 늦은 응답을 채택하지 않는다',async()=>{
 const f=await mountWorkReview();try{await f.click();await f.waitFor('과거 별도 사람 검토');const replacement:typeof fetch=async()=>Response.json(f.source.history);
  await f.replaceTransport(replacement);assert(!f.container.textContent.includes('과거 별도 사람 검토'));
  await f.replaceTransport(f.originalTransport);assert(!f.container.textContent.includes('과거 별도 사람 검토'));
  f.hold();await f.click();await f.replaceTransport(replacement);await f.replaceTransport(f.originalTransport);await f.finish();await f.flush();assert(!f.container.textContent.includes('과거 별도 사람 검토'));assert(!f.container.textContent.includes('UNDERSTANDING_HISTORY_RESPONSE_INVALID'));assert.equal(f.lost(),0);
 }finally{await f.close();}
});

async function mountCheckpoint(replies: ('APPLIED'|'LOST'|'503'|'OK'|'HOLD')[]) {
 const f=checkpointFixture(), session={user:{id:f.by.userId},clientId:f.by.clientId,csrfToken:'c'.repeat(43)};
 const key=checkpointBufferKey(session,f.assignment.projectId,f.assignment.ref);
 const control=new ApiClient(async()=>Response.json({id:f.assignment.projectId,participation:'OWNER',controlState:{actorId:f.by.userId,clientId:f.by.clientId,generation:1,status:'HELD'}}));
 const pending=await freezeCheckpointSave(control,f.assignment,f.input,session,()=>true);
 assert(pending);
 const record=createCheckpointRecord(f.prepared,f.by,f.at);
 const ref={id:aid,version:1,contentHash:hash(record.snapshot)};
 const data={status:'CHECKPOINT_RECORDED',ref,snapshot:record.snapshot,checkpointStored:true,recordFileStored:false,
  currentFactsVerified:false,writerReleaseVerified:false,resumeAuthorized:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false};
 const detail={projectId:f.assignment.projectId,ref,...record,serverSequence:1,observedAt:f.at};
 const base='/api/v1/projects/'+f.assignment.projectId,posts:string[]=[],gets:string[]=[],lost:string[]=[];
 let release:((r:Response)=>void)|undefined;
 const transport:typeof fetch=async(url,options)=>{
  const reply=replies.shift();
  if(options?.method==='POST'){
   assert.equal(url,base+'/commands');posts.push(String(options.body));
   assert.equal(new Headers(options.headers).get('Idempotency-Key'),pending.command.commandId);
   if(reply==='LOST')throw Error('synthetic response lost');
   assert.equal(reply,'APPLIED');
   return Response.json({status:'APPLIED',commandId:pending.command.commandId,projectId:f.assignment.projectId,operationId:pid,
    targetId:ref.id,version:1,data,evidenceRefs:[],warnings:[],serverReceivedAt:f.at});
  }
  assert.equal(url,base+'/checkpoints/'+ref.id);gets.push(String(url));
  if(reply==='HOLD')return new Promise<Response>(resolve=>{release=resolve;});
  if(reply==='503')return Response.json({code:'CHECKPOINT_SOURCE_UNAVAILABLE'},{status:503});
  assert.equal(reply,'OK');return Response.json(detail);
 };
 let client=new ui.ApiClient(transport),currentSession=session,visible=true,selectedCheckpoint:any=null;
 const container:MemoryNode=document.createElement('div');document.body.appendChild(container);
 const root=ui.createRoot(container),seed={...emptyCheckpointForm(),position:'원 입력 보존',serverWork:{pending,uncertain:false,rejected:null,storedRef:null}};
 let buffers:Record<string,any>={[key]:seed};
 function Host(){
  const [saved,setSaved]=ui.React.useState(buffers);buffers=saved;
  const storage={buffers:saved,onChange:(k:string,fn:Function)=>setSaved((prev:Record<string,any>)=>({...prev,[k]:fn(prev[k]??null)}))};
  return visible?ui.React.createElement(ui.CheckpointEditor,{client,session:currentSession,assignment:f.assignment,storage,onUnavailable:(code:string)=>lost.push(code),onStoredCheckpoint:(value:any)=>{selectedCheckpoint=value;}}):null;
 }
 async function render(){await ui.React.act(async()=>root.render(ui.React.createElement(Host)));}
 async function waitFor(check:()=>boolean){const until=Date.now()+2500;while(!check()&&Date.now()<until)await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});assert(check(),container.textContent);}
 function button(label:string,node=container):MemoryNode|undefined{if(node.tagName==='BUTTON'&&node.textContent===label)return node;for(const child of node.childNodes){const hit=button(label,child);if(hit)return hit;}}
 async function click(label:string){const b=button(label);assert(b,label);assert(!b.disabled,label);await ui.React.act(async()=>{b.dispatchEvent({type:'click',button:0,bubbles:true});});}
 await render();
 return {posts,gets,lost,pending,ref,record,container,button,click,waitFor,work:()=>buffers[key].serverWork,buffers:()=>buffers,selectedCheckpoint:()=>selectedCheckpoint,
  async show(value:boolean){visible=value;await render();},
  async replace(subject:'user'|'client'){if(subject==='user')currentSession={...session,user:{id:pid}};else client=new ui.ApiClient(transport);await render();},
  held:()=>!!release,async finish(ok:boolean){assert(release);await ui.React.act(async()=>release!(ok?Response.json(detail):Response.json({code:'AUTH_REQUIRED'},{status:401})));},
  async close(){await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}
 };
}

test('체크포인트 저장 영수증 후 GET503과 화면 왕복에도 원 참조 GET만 재조회한다',async()=>{
 const x=await mountCheckpoint(['APPLIED','503','OK']);try{
  await x.click('서버 기록 명시 저장');await x.waitFor(()=>x.container.textContent.includes('CHECKPOINT_SOURCE_UNAVAILABLE'));
  assert.deepEqual(x.work(),{pending:null,uncertain:false,rejected:null,storedRef:x.ref});assert(!x.button('같은 기록 저장 명령 재확인'));
  await x.show(false);await x.show(true);assert.equal(x.gets.length,1);assert.equal(x.posts.length,1);
  await x.click('저장된 체크포인트 원문 조회');await x.waitFor(()=>x.container.textContent.includes(x.record.recordText));
  assert.equal(x.gets.length,2);assert.equal(x.gets[0],x.gets[1]);assert.equal(x.posts.length,1);
  assert.deepEqual(x.work(),{pending:null,uncertain:false,rejected:null,storedRef:x.ref});
 }finally{await x.close();}
});

test('검산된 서버 체크포인트 선택은 같은 원객체를 상위에 전달하고 닫기에서 즉시 폐기한다',async()=>{
 const x=await mountCheckpoint(['APPLIED','OK']);try{
  await x.click('서버 기록 명시 저장');await x.waitFor(()=>x.container.textContent.includes(x.record.recordText));
  assert.deepEqual(x.selectedCheckpoint()?.ref,x.ref);assert.deepEqual(x.selectedCheckpoint()?.snapshot,x.record.snapshot);
  await x.click('기록 닫기');assert.equal(x.selectedCheckpoint(),null);assert.equal(x.posts.length,1);assert.equal(x.gets.length,1);
 }finally{await x.close();}
});

function checkpointComparisonFixture(){
 const f=checkpointFixture(),result=resultFixture().entry;
 result.snapshot.scope.projectId=f.assignment.projectId;result.snapshot.scope.assignmentRef=f.assignment.ref;result.snapshot.manifest.assignmentRef=f.assignment.ref;
 f.input.state.executionRefs=[result.snapshot.scope.executionRef];
 const prepared=prepareCheckpointDraft(f.assignment,f.input),record=createCheckpointRecord(prepared,f.by,f.at),checkpointRef={id:aid,version:1,contentHash:hash(record.snapshot)};
 (result.snapshot.manifest as any).checkpointRef=checkpointRef;result.snapshot.manifestHash=hash(result.snapshot.manifest);result.ref.contentHash=hash(result.snapshot);
 const stored={projectId:f.assignment.projectId,ref:checkpointRef,...record,serverSequence:1,observedAt:f.at},journal=observationJournalFor(result);
 return{stored,result,journal};
}

async function mountCheckpointComparison(reply:'OK'|'HOLD'){
 const f=checkpointComparisonFixture(),lost:string[]=[],container:MemoryNode=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);let release:((value:Response)=>void)|null=null,calls=0;
 const transport:typeof fetch=async()=>{calls++;if(reply==='HOLD')return new Promise<Response>(resolve=>{release=resolve;});return Response.json(f.journal);},client=new ui.ApiClient(transport);
 const nodes=(n=container):MemoryNode[]=>[n,...n.childNodes.flatMap((child:MemoryNode)=>nodes(child))];
 function Host(){return ui.React.createElement(ui.CheckpointJournalComparison,{client,file:null,stored:f.stored,result:f.result,onUnavailable:(code:string)=>lost.push(code)});}
 async function render(){await ui.React.act(async()=>root.render(ui.React.createElement(Host)));}
 async function flush(){await ui.React.act(async()=>{await new Promise(resolve=>setImmediate(resolve));});}
 async function click(){const buttons=nodes().filter(n=>n.tagName==='BUTTON'&&n.textContent==='서버 기록과 보관 ACK 대조');assert.equal(buttons.length,1);assert(!buttons[0]!.disabled,'현재 transport 대조 버튼 복구');await ui.React.act(async()=>buttons[0]!.dispatchEvent({type:'click',button:0,bubbles:true}));}
 await render();return{...f,client,container,lost,calls:()=>calls,click,render,flush,held:()=>!!release,finish(value:Response){assert(release);const send=release;release=null;return ui.React.act(async()=>send!(value));},async close(){await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}

test('체크포인트 비교는 동일 client transport 교체에서 이전 본문을 즉시 숨긴다',async()=>{
 const f=await mountCheckpointComparison('OK');try{await f.click();const until=Date.now()+2000;while(!f.container.textContent.includes('보관 원장 조회 시각')&&Date.now()<until)await f.flush();assert(f.container.textContent.includes('보관 원장 조회 시각'));f.client.transport=async()=>Response.json(f.journal);await f.render();assert(!f.container.textContent.includes('보관 원장 조회 시각'));}finally{await f.close();}
});

test('체크포인트 비교는 무렌더 transport 교체 뒤 늦은 200·401을 폐기한다',async()=>{
 for(const status of[200,401]){const f=await mountCheckpointComparison('HOLD');try{await f.click();const until=Date.now()+2000;while(!f.held()&&Date.now()<until)await f.flush();assert(f.held());let replacementCalls=0;f.client.transport=async()=>{replacementCalls++;return Response.json(f.journal);};await f.finish(status===200?Response.json(f.journal):Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.flush();assert(!f.container.textContent.includes('보관 원장 조회 시각'));assert(!f.container.textContent.includes('AUTH_REQUIRED'));assert.deepEqual(f.lost,[]);assert.equal(f.calls(),1);await f.click();const observed=Date.now()+2000;while(!f.container.textContent.includes('보관 원장 조회 시각')&&Date.now()<observed)await f.flush();assert(f.container.textContent.includes('보관 원장 조회 시각'));assert.equal(replacementCalls,1);}finally{await f.close();}}
});

test('체크포인트 지연 GET은 사용자·클라이언트 교체 및 화면 종료 후 원문·인증 상태를 변경하지 않는다',async()=>{
 for(const mode of ['user','client','unmount'] as const)for(const ok of [true,false]){
  const x=await mountCheckpoint(['APPLIED','HOLD']);try{
   await x.click('서버 기록 명시 저장');await x.waitFor(x.held);
   assert.deepEqual(x.work().storedRef,x.ref);
   if(mode==='unmount')await x.show(false);else await x.replace(mode);
   const before=structuredClone(x.buffers());await x.finish(ok);
   assert.deepEqual(x.buffers(),before);assert.deepEqual(x.lost,[]);
   assert(!x.container.textContent.includes(x.record.recordText));assert(!x.container.textContent.includes('AUTH_REQUIRED'));
   assert.equal(x.posts.length,1);assert.equal(x.gets.length,1);
  }finally{await x.close();}
 }
});

test('체크포인트 POST 응답 유실은 고정 원명령과 해시를 보존하고 명시 재확인만 허용한다',async()=>{
 const x=await mountCheckpoint(['LOST','APPLIED','OK']);try{
  await x.click('서버 기록 명시 저장');await x.waitFor(()=>x.container.textContent.includes('CONNECTION_LOST'));
  assert.deepEqual(x.work(),{pending:x.pending,uncertain:true,rejected:null,storedRef:null});
  await x.show(false);await x.show(true);assert.equal(x.posts.length,1);assert.equal(x.gets.length,0);
  await x.click('같은 기록 저장 명령 재확인');await x.waitFor(()=>x.container.textContent.includes(x.record.recordText));
  assert.deepEqual(x.posts,[JSON.stringify(x.pending.command),JSON.stringify(x.pending.command)]);assert.equal(x.gets.length,1);
 }finally{await x.close();}
});
