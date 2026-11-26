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
import {stopHistoryFor} from './stop-request-history-fixture.ts';
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

async function mountCheckpointRestore(initial:ReturnType<typeof emptyCheckpointForm>|null=null,structured=false){
 const f=checkpointFixture(),input=structuredClone(f.input);input.state.completedItems[0].itemId='completed-1';input.state.remaining[0].itemId='remaining-1';
 if(structured){input.state.completedItems[0]={itemId:'manual-work.17',description:'서버 기록 복원\n두 번째 줄 검토',evidenceRefs:[ref]};input.state.pendingDecisions=[{decisionId:'manual-decision.4',question:'작업 범위 확인\n추가 검토 담당',reason:'원 판단 사유',requiredFrom:'COORDINATOR',sourceRef:ref}];input.state.forbiddenActions=['자동 완료\n재개 금지'];}
 const prepared=prepareCheckpointDraft(f.assignment,input),record=createCheckpointRecord(prepared,f.by,f.at),storedRef={id:crypto.randomUUID(),version:1,contentHash:contentHash(canonicalJson(record.snapshot))},stored={projectId:f.assignment.projectId,ref:storedRef,...record,observedAt:'2026-11-01T00:00:01.000Z',serverSequence:7},page={items:[{ref:storedRef,assignmentRef:f.assignment.ref,previousRef:null,recordedAt:f.at,serverSequence:7}],hasMore:false,nextCursor:null,observedAt:stored.observedAt},calls:{path:string;method:string}[]=[],prepareBodies:any[]=[];let conflict=false;
 const transport=async(path:any,options:any)=>{const method=options?.method??'GET';calls.push({path:String(path),method});const base=`/api/v1/projects/${f.assignment.projectId}`;if(String(path).startsWith(base+'/checkpoints?')&&method==='GET')return Response.json(page);if(String(path)===base+'/checkpoints/'+storedRef.id&&method==='GET')return conflict?Response.json({code:'VERSION_CONFLICT'},{status:409}):Response.json(stored);if(String(path)===base+'/checkpoints/prepare'&&method==='POST'){const body=JSON.parse(options.body);prepareBodies.push(body);assert.deepEqual(body.assignmentRef,f.assignment.ref);return Response.json({projectId:f.assignment.projectId,assignmentRef:f.assignment.ref,sourceState:'FIXED_ASSIGNMENT_REFERENCE_ONLY',...prepareCheckpointDraft(f.assignment,body.input)});}assert.fail('복원 동선 밖 요청 '+method+' '+path);};
 let client=new ui.ApiClient(transport),session={user:{id:f.by.userId},clientId:f.by.clientId,csrfToken:'C'.repeat(43)},current:any=initial,observedBuffers:any=initial?null:{},visible=true,deferChange=false,pendingChange:(()=>void)|null=null,replaceCurrent:(v:any)=>void=()=>{};const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 function Host(){const[buffers,setBuffers]=ui.React.useState(()=>{const key=checkpointBufferKey(session,f.assignment.projectId,f.assignment.ref);return(initial?{[key]:initial}:{} as any);}),key=checkpointBufferKey(session,f.assignment.projectId,f.assignment.ref);observedBuffers=buffers;current=buffers[key]??null;const apply=(k:string,change:any)=>setBuffers((old:any)=>{const previous=old[k]??null,next=change(previous);current=next;return next===previous?old:{...old,[k]:next};});replaceCurrent=v=>setBuffers((old:any)=>({...old,[key]:v}));return visible?ui.React.createElement(ui.CheckpointEditor,{client,assignment:f.assignment,session,storage:{buffers,onChange:(k:string,change:any)=>{if(deferChange)pendingChange=()=>apply(k,change);else apply(k,change);}},onUnavailable:()=>{}}):null;}
 async function render(){await ui.React.act(async()=>root.render(ui.React.createElement(Host)));}
 async function flush(){await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});}
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))],button=(name:string,partial=false)=>{const values=nodes().filter(n=>n.tagName==='BUTTON'&&(partial?n.textContent.includes(name):n.textContent===name));assert.equal(values.length,1,name);return values[0]!;};
 async function click(name:string,partial=false){const b=button(name,partial);assert(!b.disabled,name);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));}
 async function waitFor(check:()=>boolean){const end=Date.now()+2000;while(!check()&&Date.now()<end)await flush();assert(check(),container.textContent);}
 await render();return{f,ref:storedRef,stored,prepareBodies,calls,container,nodes,button,click,waitFor,flush,current:()=>current,buffers:()=>observedBuffers,pending:()=>!!pendingChange,render,transport,conflict(){conflict=true;},defer(){deferChange=true;},async submit(){const node=nodes().find(n=>n.tagName==='FORM');assert(node);await ui.React.act(async()=>node.dispatchEvent({type:'submit',bubbles:true}));},async flushChange(){const change=pendingChange;assert(change);pendingChange=null;deferChange=false;await ui.React.act(async()=>change());},async replace(v:any){await ui.React.act(async()=>replaceCurrent(v));},changeSession:async()=>{session={...session,csrfToken:'D'.repeat(43)};await render();},changeClient:async()=>{client=new ui.ApiClient(transport);await render();},swapTransport:async(rendered=true)=>{client.transport=transport.bind(null);if(rendered)await render();},hide:async()=>{visible=false;await render();},close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}

test('서버에서 고정 조회한 체크포인트만 명시 클릭으로 빈 편집 입력과 다음 기준에 복원한다',async()=>{
 const f=await mountCheckpointRestore();try{assert.equal(f.calls.length,0);assert.equal(f.current(),null);await f.click('보관 기록 목록 조회');await f.waitFor(()=>f.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent.includes('기록 선택')));await f.click('기록 선택',true);await f.waitFor(()=>f.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='기록 닫기'));assert.equal(f.current(),null);assert.equal(f.calls.length,2);await f.click('이 기록을 빈 입력으로 복원');await f.waitFor(()=>f.current()?.position==='구현 뒤 검수 중');assert.equal(f.current().serverWork.baseRef.id,f.ref.id);assert.equal(f.calls.length,2);assert(f.calls.every(c=>c.method==='GET'));assert.equal(f.current().serverWork.pending,null);assert.equal(f.current().serverWork.uncertain,false);}finally{await f.close();}
});
test('실제 편집기의 서버 복원은 수동 ID·여러 줄·원 근거를 유지하고 명시 준비에만 정확 payload를 보낸다',async()=>{
 const f=await mountCheckpointRestore(null,true);
 try{
  await f.click('보관 기록 목록 조회');await f.waitFor(()=>f.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent.includes('기록 선택')));await f.click('기록 선택',true);await f.waitFor(()=>f.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='기록 닫기'));
  await f.click('이 기록을 빈 입력으로 복원');await f.waitFor(()=>f.nodes().some(n=>n.tagName==='TEXTAREA'&&n.parentNode?.textContent.includes('manual-work.17')));
  const value=(label:string)=>{const node=f.nodes().find(n=>n.tagName==='TEXTAREA'&&n.parentNode?.textContent.includes(label));assert(node);const key=Object.keys(node).find(k=>k.startsWith('__reactProps$'));assert(key);return(node as any)[key].value;};
  assert.equal(value('manual-work.17'),'서버 기록 복원\n두 번째 줄 검토');assert.equal(value('manual-decision.4'),'작업 범위 확인\n추가 검토 담당');assert.equal(value('금지 행동 forbidden-1'),'자동 완료\n재개 금지');
  assert.equal(f.calls.length,2);assert.equal(f.prepareBodies.length,0);
  await f.submit();await f.waitFor(()=>f.container.textContent.includes('서버·파일 저장 미수행'));
  assert.deepEqual(f.prepareBodies,[{assignmentRef:f.f.assignment.ref,input:{...f.stored.snapshot.input,baseRef:f.ref}}]);
  assert.deepEqual(f.calls.map(c=>c.method),['GET','GET','POST']);assert(f.calls.at(-1)?.path.endsWith('/checkpoints/prepare'));
  await f.click('완료한 내용 · 수행자 주장 추가');const added=f.current().workRows.completed.at(-1).id;assert.notEqual(added,'manual-work.17');assert.equal(f.current().workRows.completed[0].id,'manual-work.17');
  await f.click('완료한 내용 · 수행자 주장 '+added+' 제거');assert.equal(f.current().workRows.completed.length,1);assert.equal(f.current().workDetails.evidence[0].itemId,'manual-work.17');
 }finally{await f.close();}
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
 const f=checkpointComparisonFixture(),lost:string[]=[],requests:string[]=[],container:MemoryNode=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 let release:((value:Response)=>void)|null=null,result=f.result,stored=f.stored,key='original',show=true,holdPath:string|null=null,stopStatus=200;
 const stop=stopHistoryFor(f.result);
 const transport:typeof fetch=async(url,init)=>{
  const path=String(url).split('/').at(-1)!;requests.push(path);assert.equal(init?.method,'GET');
  if(reply==='HOLD'||holdPath===path)return new Promise<Response>(resolve=>{release=resolve;});
  if(path==='observation-journal')return Response.json(f.journal);
  assert.equal(path,'stop-requests');
  return stopStatus===200?Response.json(stop):Response.json({code:stopStatus===401?'AUTH_REQUIRED':stopStatus===403?'PROJECT_OPERATION_DENIED':'NOT_FOUND'},{status:stopStatus});
 },client=new ui.ApiClient(transport);
 const nodes=(n=container):MemoryNode[]=>[n,...n.childNodes.flatMap((child:MemoryNode)=>nodes(child))];
 function Host(){return show?ui.React.createElement(ui.CheckpointJournalComparison,{key,client,file:null,stored,result,onUnavailable:(code:string)=>lost.push(code)}):null;}
 async function render(){await ui.React.act(async()=>root.render(ui.React.createElement(Host)));}
 async function flush(){await ui.React.act(async()=>{await new Promise(resolve=>setImmediate(resolve));});}
 async function click(label='서버 기록과 보관 ACK 대조'){const buttons=nodes().filter(n=>n.tagName==='BUTTON'&&n.textContent===label);assert.equal(buttons.length,1,label);assert(!buttons[0]!.disabled,label);await ui.React.act(async()=>buttons[0]!.dispatchEvent({type:'click',button:0,bubbles:true}));}
 async function waitFor(check:()=>boolean){const until=Date.now()+2000;while(!check()&&Date.now()<until)await flush();assert(check(),container.textContent);}
 await render();return{...f,client,container,lost,requests,calls:()=>requests.length,click,render,flush,waitFor,held:()=>!!release,
  hold(path:string){holdPath=path;},stopStatus(status:number){stopStatus=status;},async leave(mode:string){
   if(mode==='UNMOUNT')show=false;
   if(mode==='OWNER')key='changed-owner';
   if(mode==='RESULT')result={...f.result,ref:{...f.result.ref,version:2}};
   if(mode==='CHECKPOINT')stored=structuredClone(f.stored);
   await render();
  },finish(value:Response){assert(release);const send=release;release=null;return ui.React.act(async()=>send!(value));},async close(){await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}

test('보관 체크포인트 ACK 비교와 별도 중지 대조는 서로의 조회 수명을 끊지 않는다',async()=>{
 const f=await mountCheckpointComparison('OK');
 try{
  assert(!f.container.textContent.includes('재개 전 중지 기록 대조'));assert.deepEqual(f.requests,[]);
  f.journal.items[0]!.snapshot.event.type='STOPPED';f.journal.items[0]!.ref.contentHash=hash(f.journal.items[0]!.snapshot);
  await f.click();await f.waitFor(()=>f.container.textContent.includes('재개 전 중지 기록 대조'));
  assert.deepEqual(f.requests,['observation-journal']);
  await f.click('재개 전 중지 기록 대조');await f.waitFor(()=>f.container.textContent.includes('사용자가 중지 요청'));
  assert.deepEqual(f.requests,['observation-journal','observation-journal','stop-requests']);
  assert.match(f.container.textContent,/STOPPED · 공급자 주장/);
  assert.match(f.container.textContent,/보관 공백 1~1/);
  assert.match(f.container.textContent,/개별 중지 요청과 관측의 대응은 확인되지 않았습니다/);
  assert.match(f.container.textContent,/쓰기 소유와 권한 회수 미확인 · 재개 불가/);
  await f.click('재개 전 중지 기록 닫기');assert.doesNotMatch(f.container.textContent,/사용자가 중지 요청/);
  assert.match(f.container.textContent,/보관 원장 조회 시각/);
  await f.click('재개 전 중지 기록 대조');await f.waitFor(()=>f.container.textContent.includes('사용자가 중지 요청'));
  assert.deepEqual(f.requests,['observation-journal','observation-journal','stop-requests','observation-journal','stop-requests']);
 }finally{await f.close();}
});

test('재개 전 대조에서 현재 보호 거절만 전달하며 이탈 후 늦은 401은 새 화면을 건드리지 않는다',async()=>{
 for(const mode of ['401','403','404','CLOSE','RESULT','CHECKPOINT','OWNER','UNMOUNT','TRANSPORT']){
  const f=await mountCheckpointComparison('OK');
  try{
   await f.click();await f.waitFor(()=>f.container.textContent.includes('재개 전 중지 기록 대조'));
   if(/^40/.test(mode)){
    f.stopStatus(Number(mode));
    await f.click('재개 전 중지 기록 대조');await f.waitFor(()=>f.lost.length===1);
    assert.deepEqual(f.lost,[mode==='401'?'AUTH_REQUIRED':mode==='403'?'PROJECT_OPERATION_DENIED':'NOT_FOUND']);
    assert.match(f.container.textContent,/보관 중지 기록 미확인/);
   }else{
    const beforeStop=mode==='CLOSE'||mode==='RESULT'||mode==='CHECKPOINT';
    f.hold(beforeStop?'observation-journal':'stop-requests');
    await f.click('재개 전 중지 기록 대조');await f.waitFor(f.held);
    if(mode==='CLOSE')await f.click('재개 전 중지 기록 닫기');
    else if(mode==='TRANSPORT')f.client.transport=async()=>assert.fail('교체 transport 요청');
    else await f.leave(mode);
    await f.finish(Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.flush();
    assert.deepEqual(f.lost,[],mode);
    assert.equal(f.requests.filter(path=>path==='stop-requests').length,beforeStop?0:1,mode);
    assert.doesNotMatch(f.container.textContent,/AUTH_REQUIRED/);
   }
   assert.doesNotMatch(f.container.textContent,/사용자가 중지 요청/);
  }finally{if(f.held())await f.finish(Response.json({}));await f.close();}
 }
});

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

async function mountReviewWrite(pendingInitially:boolean){
 const assignment=fixture(),definition=assignment.confirmed.snapshot.definition;
 Object.assign(definition,{environmentRef:ref,baselineRefs:[ref]});
 assignment.draft.ref.contentHash=hash(assignment.draft.snapshot);assignment.confirmed.ref.contentHash=hash(assignment.confirmed.snapshot);
 const result=resultFixture();Object.assign(result.entry.snapshot.scope,{projectId:pid,assignmentRef:assignment.confirmed.ref});
 Object.assign(result.entry.snapshot.manifest,{assignmentRef:assignment.confirmed.ref,baselineRefs:[ref]});
 result.entry.snapshot.manifestHash=hash(result.entry.snapshot.manifest);result.entry.ref.contentHash=hash(result.entry.snapshot);
 result.item.manifestRef.contentHash=result.entry.snapshot.manifestHash;
 const {prepareResultReviewWrite,resultReviewBufferKey}=await import('../../../apps/web/src/features/session-detail/result-review-write-api.ts');
 const {criteriaId}=await import('../FN12/result-criteria-fixture.ts');
 const submitted=result.entry as Parameters<typeof prepareResultReviewWrite>[0];
 const items=[{criterionId:'verify',testId:'VERIFY',kind:'INTEGRATION' as const,environmentRef:ref,required:true}];
 const snapshot={assignmentRef:assignment.confirmed.ref,baselineRefs:[ref],items};
 const criteriaRef={id:criteriaId(48),version:1,contentHash:hash(snapshot)};
 const sources=[{field:'acceptanceCriteria',index:0,contentHash:hash(definition.acceptanceCriteria[0])},{field:'verificationRequirements',index:0,contentHash:hash(definition.verificationRequirements[0])}];
 const flags={registryStored:true as const,reviewStored:false as const,completionAccepted:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
 const criteria={projectId:pid,ref:criteriaRef,snapshot,input:{assignmentRef:assignment.confirmed.ref,baseRef:null,items:[{criterionId:'verify',testId:'VERIFY',kind:'INTEGRATION' as const,environmentRef:ref,sources}],reason:'판정 기준'},sourceBindings:[{criterionId:'verify',sources}],createdBy:pid,registeredAt:at,observedAt:at,...flags};
 let session={user:{id:pid},clientId:criteriaId(6),csrfToken:'C'.repeat(43)};
 const key=resultReviewBufferKey(session,submitted,criteria as Parameters<typeof prepareResultReviewWrite>[1]);
 const input={resultRef:result.entry.ref,criteriaRef,outcome:'BLOCKED' as const,items:[{criterionId:'verify',outcome:'BLOCKED' as const,reason:'증거 보완',evidenceRefs:[]}],reason:'근거 확인이 필요합니다'};
 const pending=await prepareResultReviewWrite(submitted,criteria as Parameters<typeof prepareResultReviewWrite>[1],input,session,1);
 const initial={bindingId:criteriaId(49),ownerUserId:pid,ownerClientId:session.clientId,resultRef:input.resultRef,criteriaRef,controlGeneration:1,
  rows:input.items.map(({evidenceRefs,...item})=>item),outcome:'BLOCKED' as const,reason:input.reason,pending:pendingInitially?pending:null,stored:null,dirty:true,uncertain:false,failure:null};
 const sourceTransport=assignment.client.transport;
 const posts:{body:unknown;csrf:string|null;id:string|null}[]=[],reads:string[]=[];
 let hold:'CONTROL'|'POST'|null=null,release:((value:Response)=>void)|null=null,readback:unknown,rendered=initial as any,visible=true,lost=0,ignoreUpdates=false,deferred:(()=>void)|null=null;
 const base='/api/v1/projects/'+pid,container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 const transport:typeof fetch=async(url,options)=>{
  const path=String(url),method=options?.method??'GET';
  if(method==='POST'){
   const body=JSON.parse(String(options?.body)),headers=new Headers(options?.headers);
   posts.push({body,csrf:headers.get('X-Anvil-CSRF'),id:headers.get('Idempotency-Key')});
   if(hold==='POST'){hold=null;return new Promise<Response>(resolve=>{release=resolve;});}
   assert.equal(path,base+'/commands');
   const snap={scope:result.entry.snapshot.scope,input:body.payload,reviewedBy:{kind:'HUMAN',userId:session.user.id,clientId:session.clientId},
    sameAsSubmitter:true,reviewedAt:at,evidenceProvenanceVerified:false,completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false};
   const rr={id:criteriaId(52),version:1,contentHash:hash(snap)};
   const record={ref:rr,snapshot:snap,reviewStored:true,completionAccepted:false,formalFailureCounted:false,evidenceProvenanceVerified:false,executionAuthorized:false,dispatchPerformed:false};
   readback={projectId:pid,...record,observedAt:at};
   return Response.json({commandId:body.commandId,operationId:criteriaId(53),projectId:pid,status:'APPLIED',targetId:rr.id,version:1,data:{...record,status:'RESULT_REVIEW_RECORDED'},serverReceivedAt:at});
  }
  reads.push(path);
  if(path===base){
   if(hold==='CONTROL'){hold=null;return new Promise<Response>(resolve=>{release=resolve;});}
   return control();
  }
  if(path.endsWith('/result-pages'))return Response.json({...result.page,assignmentRef:assignment.confirmed.ref,nextCursor:null,selectionState:'NOT_SELECTED'});
  if(path===base+'/results/'+result.entry.ref.id)return Response.json(result.entry);
  if(path.endsWith('/review-sources'))return Response.json({projectId:pid,result:result.entry,assignment:assignment.confirmed,
   criteriaState:'TEXT_ONLY_NOT_MAPPED',issues:['TYPED_CRITERIA_NOT_REGISTERED'],reviewStored:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false});
  if(path.endsWith('/result-criteria'))return Response.json({projectId:pid,assignmentRef:assignment.confirmed.ref,
   items:[{ref:criteriaRef,createdBy:pid,registeredAt:at,conditionCount:items.length,...flags}],hasMore:false,selectionState:'NOT_SELECTED',observedAt:at});
  if(path.endsWith('/result-criteria/'+criteriaRef.id+'/versions/1'))return Response.json(criteria);
  if(path.endsWith('/result-reviews/'+criteriaId(52)))return Response.json(readback);
  return sourceTransport(url,options);
 };
 const client=new ui.ApiClient(transport);
 const control=()=>Response.json({id:pid,participation:'OWNER',controlState:{status:'HELD',actorId:session.user.id,clientId:session.clientId,generation:1}});
 const updates:((value:unknown)=>unknown)[]=[];
 let replacementOnUpdate:object|null=null,onMarker:(()=>void)|null=null,replace:(next:unknown)=>void=()=>{};
 function Host(){
  const [buffers,setBuffers]=ui.React.useState({[key]:initial});
  rendered=buffers[key];replace=next=>setBuffers({...buffers,[key]:next});
  ui.React.useLayoutEffect(()=>{if(rendered?.uncertain&&onMarker){const run=onMarker;onMarker=null;run();}});
  const reviews={buffers,onChange:(k:string,update:(previous:unknown)=>unknown)=>{
   updates.push(update);
   const apply=()=>setBuffers((previous:Record<string,unknown>)=>{const next=update(previous[k]??null);return next===previous[k]?previous:{...previous,[k]:next};});
   if(replacementOnUpdate){const next=replacementOnUpdate;replacementOnUpdate=null;setBuffers((previous:Record<string,unknown>)=>({...previous,[k]:next}));}
   if(ignoreUpdates)deferred=apply;else apply();
  }};
  return visible?ui.React.createElement(ui.SessionDetailPage,{client,projectId:pid,assignmentRef:assignment.draft.ref,criteria:{session,reviews,buffer:null,onChange:()=>{}},
   checkpoint:{buffers:{},onChange:()=>{}},onAuthenticationLost:()=>{lost++;}}):null;
 }
 const render=async()=>ui.React.act(async()=>root.render(ui.React.createElement(Host)));
 const tick=async()=>ui.React.act(async()=>{await new Promise(done=>setImmediate(done));});
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 const button=(label:string)=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===label);
 const waitFor=async(check:()=>boolean)=>{const end=Date.now()+2000;while(!check()&&Date.now()<end)await tick();assert(check(),container.textContent);};
 const click=async(label:string)=>{const n=button(label);assert.ok(n,label);assert(!n.disabled,label);await ui.React.act(async()=>n.dispatchEvent({type:'click',button:0,bubbles:true}));};
 async function open(){
 for(const label of ['제출 원문 '+result.entry.ref.id,'검수 기준 원문 조회','보관 기준 목록 조회','보관 기준 원문 '+criteriaRef.id+' v1']){
  await waitFor(()=>!!button(label));await click(label);
 }
 }
 await render();await open();await waitFor(()=>!!button(pendingInitially?'검수 기록 명시 저장':'검수 기록 저장 준비'));
 return{posts,reads,button,waitFor,click,tick,pending,control,lost:()=>lost,current:()=>rendered,
  replaceOnUpdate(value:object){replacementOnUpdate=value;},text:()=>container.textContent,
  reopen:async()=>{await render();await open();},swapAfterCommit:()=>{onMarker=()=>{client.transport=transport.bind(null);};},replay:(previous:unknown)=>updates.reduce((value,change)=>change(value),previous),
  wait(point:'CONTROL'|'POST'){hold=point;},waiting:()=>!!release,finish:async(value:Response)=>ui.React.act(async()=>{const done=release;assert.ok(done);release=null;done(value);}),
  swap(){client.transport=(...args:Parameters<typeof fetch>)=>transport(...args);},setSession(update:Partial<typeof session>){Object.assign(session,update);},replace:async(value:unknown)=>ui.React.act(async()=>replace(value)),
  defer(){ignoreUpdates=true;},queued:()=>!!deferred,flushDeferred:async()=>ui.React.act(async()=>{ignoreUpdates=false;const fn=deferred;assert.ok(fn);deferred=null;fn();}),
  hide:async()=>{visible=false;await render();},close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}

for(const mode of ['PREPARE_TRANSPORT','SAVE_TRANSPORT','SAVE_CSRF','SAVE_BUFFER','SAVE_UNMOUNT'] as const)
test('검수 제어 조회 뒤 현재 문맥이 바뀌면 미발송 원 상태를 유지한다 '+mode,async()=>{
 const isSave=mode!=='PREPARE_TRANSPORT',f=await mountReviewWrite(isSave);
 try{
  const before=f.current();f.wait('CONTROL');
  await f.click(isSave?'검수 기록 명시 저장':'검수 기록 저장 준비');await f.waitFor(f.waiting);
  if(mode.endsWith('TRANSPORT'))f.swap();
  if(mode==='SAVE_CSRF')f.setSession({csrfToken:'D'.repeat(43)});
  const replacement={...before,reason:'다른 작업의 버퍼'};
  if(mode==='SAVE_BUFFER')await f.replace(replacement);
  if(mode==='SAVE_UNMOUNT')await f.hide();
  await f.finish(f.control());await f.tick();
  assert.equal(f.current(),mode==='SAVE_BUFFER'?replacement:before);
  assert.equal(f.posts.length,0);assert.equal(f.lost(),0);
 }finally{await f.close();}
});

test('검수 명령 실제 POST 뒤 바뀐 연결은 늦은 401 없이 원명령을 남기고 현재 토큰으로 동일 명령만 재확인한다',async()=>{
 const f=await mountReviewWrite(true);
 try{
  const original=f.current();f.wait('POST');
  await f.click('검수 기록 명시 저장');await f.waitFor(f.waiting);
  assert.ok(f.current().uncertain);assert.equal(f.current().pending,original.pending);
  const count=f.reads.length;
  f.swap();f.setSession({csrfToken:'D'.repeat(43)});
  await f.finish(Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.tick();
  assert.equal(f.lost(),0);assert.equal(f.reads.length,count);assert.equal(f.posts.length,1);
  assert.equal(f.current().pending,original.pending);assert.equal(f.current().uncertain,true);
  await f.reopen();await f.waitFor(()=>!!f.button('같은 검수 기록 명령 재확인'));
  await f.click('같은 검수 기록 명령 재확인');await f.waitFor(()=>!!f.current().stored);
  assert.equal(f.current().stored.snapshot.input.outcome,'BLOCKED');
  assert.equal(f.current().uncertain,false);
  assert.equal(f.replay(original),f.current(),'부모의 이전 기반 재평가에도 확정 표시를 같은 객체로 재현한다');
  assert.deepEqual(f.posts.map(p=>p.body),[original.pending.command,original.pending.command]);
  assert.deepEqual(f.posts.map(p=>p.id),[original.pending.command.commandId,original.pending.command.commandId]);
  assert.deepEqual(f.posts.map(p=>p.csrf),['C'.repeat(43),'D'.repeat(43)]);
 }finally{await f.close();}
});

test('부모가 발송 전 exact 검수 버퍼 정착을 보류하면 POST와 늦은 updater 모두 효과가 없다',async()=>{
 const f=await mountReviewWrite(true);
 try{
  const original=f.current();f.defer();await f.click('검수 기록 명시 저장');await f.waitFor(f.queued);
  await f.waitFor(()=>!f.button('검수 기록 명시 저장')?.disabled);
  assert.equal(f.posts.length,0);await f.flushDeferred();
  assert.equal(f.current(),original);assert.equal(f.current().uncertain,false);assert.equal(f.posts.length,0);
 }finally{await f.close();}
});

test('발송 표시 커밋 직후 transport가 교체되면 미발송 표시만 복구한다',async()=>{
 const f=await mountReviewWrite(true);
 try{
  const original=f.current();f.swapAfterCommit();await f.click('검수 기록 명시 저장');
  await f.waitFor(()=>f.current()===original&&!f.button('검수 기록 명시 저장')?.disabled);
  assert.equal(f.posts.length,0);assert.equal(f.lost(),0);assert.equal(f.current().pending,original.pending);
  assert.equal(f.replay(original),original);
 }finally{await f.close();}
});

for(const status of [401,403,404])test('POST 실패 반영 대기와 같은 프레임의 교체 버퍼는 과거 접근 오류를 받지 않는다 '+status,async()=>{
 const f=await mountReviewWrite(true);
 try{
  f.wait('POST');await f.click('검수 기록 명시 저장');await f.waitFor(f.waiting);
  const replacement={...f.current(),reason:'별도 현재 작업',uncertain:false,failure:null};
  f.replaceOnUpdate(replacement);
  await f.finish(Response.json({code:'ACCESS_DENIED'},{status}));await f.tick();
  assert.equal(f.current(),replacement);assert.equal(f.lost(),0);
  assert.doesNotMatch(f.text(),/ACCESS_DENIED/);assert.equal(f.posts.length,1);
 }finally{await f.close();}
});

test('현재 같은 검수 명령의 401은 기존 인증 종료로 전달한다',async()=>{
 const f=await mountReviewWrite(true);
 try{
  f.wait('POST');await f.click('검수 기록 명시 저장');await f.waitFor(f.waiting);
  await f.finish(Response.json({code:'AUTH_REQUIRED'},{status:401}));
  await f.waitFor(()=>f.lost()===1);assert.equal(f.posts.length,1);assert.ok(f.current().pending);
 }finally{await f.close();}
});

test('현재 검수 준비와 미전송 해제는 입력을 보존하고 POST하지 않는다',async()=>{
 const f=await mountReviewWrite(false),saved=Object.getOwnPropertyDescriptor(globalThis,'confirm');
 Object.defineProperty(globalThis,'confirm',{configurable:true,value:()=>true});
 try{
  const original=f.current();await f.click('검수 기록 저장 준비');
  await f.waitFor(()=>!!f.current().pending&&!!f.button('미전송 검수 저장 준비 해제')&&!f.button('미전송 검수 저장 준비 해제')?.disabled);
  assert.deepEqual(f.current().pending.command.payload,f.pending.command.payload);
  assert.equal(f.current().bindingId,original.bindingId);
  await f.click('미전송 검수 저장 준비 해제');await f.waitFor(()=>f.current().pending===null);
  assert.deepEqual(f.current(),original);assert.equal(f.posts.length,0);assert.equal(f.lost(),0);
 }finally{
  if(saved)Object.defineProperty(globalThis,'confirm',saved);else Reflect.deleteProperty(globalThis,'confirm');
  await f.close();
 }
});
