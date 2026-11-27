import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {seed,clientFixture} from './registered-preparation-options-fixture.ts';
import {sessionDetailHref} from '../../../apps/web/src/shell/routes.ts';
import {stageQueueReasons} from '../../../apps/web/src/features/session-detail/stage-queue-api.ts';
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
 const result:any=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:workspace-stage-start',name:'WorkspaceStageStartApp',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'workspace-stage-start-memory',resolveId(id){if(id.endsWith('virtual:workspace-stage-start'))return '\0workspace-stage-start';},load(id){if(id==='\0workspace-stage-start')return `export * as React from 'react';export {createRoot} from 'react-dom/client';export {App} from ${JSON.stringify(app)};`;}}]});
 const Native=globalThis.MessageChannel;class Channel extends Native{constructor(){super();channels.push(this);}}
 const add=(k:string,f:Function)=>{let set=events.get(k);if(!set)events.set(k,set=new Set());set.add(f);},remove=(k:string,f:Function)=>events.get(k)?.delete(f),window={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener:add,removeEventListener:remove,getComputedStyle:()=>({}),location};document.defaultView=window;
 for(const[k,v]of Object.entries({window,document,location,addEventListener:add,removeEventListener:remove,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:Channel,confirm:()=>true,fetch:(...args:Parameters<typeof fetch>)=>currentTransport(...args)})){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((v:any)=>v.type==='chunk').code+';return WorkspaceStageStartApp;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});
const H=(v:unknown)=>contentHash(canonicalJson(v));
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}
function fixture(){
 const f=seed(),pid=f.confirmed.projectId;
 const node=(nodeId:string,name:string)=>({nodeId,name,purpose:'합성 대기 요청',kind:'AGENT',position:{x:0,y:0},role:'STAGE_OWNER',inputs:[],outputs:[],taskScope:{included:['개발'],excluded:['운영']},completionCriteria:['검수'],approvalBoundary:[],mode:'AUTO',limitPolicyRef:null,recordRequirements:['현황']});
 const graph={nodes:[node('N1','현재 단계'),node('N2','다른 단계')],edges:[{edgeId:'next',fromNodeId:'N1',toNodeId:'N2',kind:'SEQUENCE',condition:null,reason:'후속'}],entryNodeId:'N1',terminalNodeIds:['N2']};
 const applicationSnapshot={name:'합성 검사 방법론',purpose:'시험',graph,sourceRef:{...f.confirmed.ref,contentHash:H(graph)}};
 const applicationRef={...f.confirmed.ref,contentHash:H(applicationSnapshot)},application={projectId:pid,applicationRef,snapshot:applicationSnapshot,observedAt:f.at,executionState:'NOT_CONNECTED'};
 const definition={...f.confirmed.snapshot.definition,baselineRefs:[applicationRef],recordingPolicyRef:null,taskRef:{...f.confirmed.snapshot.definition.taskRef,applicationRef}};
 const snapshot={definition,reason:'보관 임무',previousRef:null,basis:{...definition.taskRef,designRef:definition.taskRef.planRef,taskCardHash:'c'.repeat(64)},readinessIssues:[],status:'DRAFT',ready:false,executionAuthorized:false,dispatchPerformed:false};
 const draft={projectId:pid,ref:{...f.confirmed.ref,contentHash:H(snapshot)},snapshot,headVersion:1,sourceCurrentness:'NOT_RECHECKED',observedAt:f.at};
 const reviewSnapshot={draftRef:draft.ref,criteriaVersion:1,items:['PURPOSE_SCOPE','BASELINE_TASK','INPUT_OUTPUT','COMPLETION_VERIFICATION','BOUNDARIES','RECORD_RECOVERY'].map(criterionId=>({criterionId,outcome:'ACCEPTED',reason:'현재 기준의 사람 판단 metadata',evidenceRefs:[]})),outcome:'ACCEPTED',reason:'현재 적합 검토',reviewedBy:{kind:'HUMAN',userId:f.session.user.id},reviewedAt:f.at,independence:'NOT_CLAIMED'},review={ref:{id:'af040058-1111-4111-8111-000000000088',version:1,contentHash:H(reviewSnapshot)},snapshot:reviewSnapshot,serverSequence:1,sameAuthor:true};
 f.confirmed.snapshot.reviewRefs=[review.ref];f.confirmed.snapshot.definition=definition;f.confirmed.snapshot.draftRef=draft.ref;f.confirmed.ref.contentHash=H(f.confirmed.snapshot);
 f.state.assignmentRef=f.confirmed.ref;f.state.bindings=[];f.state.roles=[];
 const decision={projectId:pid,draftRef:draft.ref,criteriaVersion:1,criteria:['PURPOSE_SCOPE','BASELINE_TASK','INPUT_OUTPUT','COMPLETION_VERIFICATION','BOUNDARIES','RECORD_RECOVERY'],reviews:[review],hasMoreReviews:false,contentIssues:[],currentIssue:null as string|null,confirmedRef:f.confirmed.ref,latestReviewAccepted:true,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt:f.at};
 let holdDraft:ReturnType<typeof deferred<Response>>|null=null;
 let participation='OWNER',holdControl:ReturnType<typeof deferred<Response>>|null=null,holdPolicy:ReturnType<typeof deferred<Response>>|null=null,holdQueue:ReturnType<typeof deferred<Response>>|null=null,queueItems:any[]|null=null,approvalRequired=false,receipt:any=null;
 const queueItem=()=>({requestRef:receipt.ref,state:'WAITING',sequence:receipt.snapshot.sequence,reasonCodes:stageQueueReasons,blockedBy:[],reservedBudgetRef:null});
 const project={id:pid,name:'합성 프로젝트',purpose:'App 단계 연결 검산',desiredOutcome:'정확 대기 요청',version:1,createdAt:f.at,updatedAt:f.at,currentMethodologyRef:applicationRef,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[],viewerPermissions:['READ_PROJECT'],controlState:{actorId:f.session.user.id,clientId:f.session.clientId,generation:1,status:'HELD'}};
 const q={calls:[] as {path:string;method:string}[],posts:[] as any[],unexpected:[] as string[]};
 const protectedTransport=clientFixture(f);
 currentTransport=async(url,init)=>{
  const path=String(url),method=init?.method??'GET';q.calls.push({path,method});
  if(path==='/api/v1/session')return Response.json({...f.session,user:{...f.session.user,displayName:'합성 소유자'}});
  if(path==='/api/v1/projects/'+pid){if(holdControl){const held=holdControl;holdControl=null;return held.promise;}return Response.json({...project,participation});}
  if(path.endsWith('/methodology-application'))return Response.json(application);
  if(path.includes('/conversations?'))return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:f.at});
  if(path.includes('/assignment-drafts?'))return Response.json({items:[{ref:draft.ref,status:'DRAFT',goal:definition.goal,taskRef:definition.taskRef,issueCount:0,updatedAt:f.at,ready:false,executionAuthorized:false}],hasMore:false,nextCursor:null,observedAt:f.at});
  if(path.endsWith('/assignment-drafts/'+draft.ref.id+'/versions/1')){if(holdDraft){const held=holdDraft;holdDraft=null;return held.promise;}return Response.json(draft);}
  if(path.endsWith('/assignment-drafts/'+draft.ref.id+'/versions/1/decision'))return Response.json(decision);
  if(path.endsWith('/assignments/'+f.confirmed.ref.id+'/versions/1'))return Response.json(f.confirmed);
  if(path.includes('/result-pages'))return Response.json({projectId:pid,assignmentRef:f.confirmed.ref,items:[],hasMore:false,nextCursor:null,selectionState:'NOT_SELECTED',observedAt:f.at});
  if(path.endsWith('/queue')){if(holdQueue){const held=holdQueue;holdQueue=null;return held.promise;}return Response.json({projectId:pid,items:queueItems??(receipt?[queueItem()]:[]),selection:'WAITING_ONLY',cancelledHistoryOmitted:true,observedAt:f.at,writerReservationPerformed:false,executionAuthorized:false,dispatchPerformed:false});}
  if(path.endsWith('/execution-preparations'))return Response.json({projectId:pid,assignmentRef:f.confirmed.ref,items:[],nextCursor:null,currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false});
  if(path.endsWith('/permission-policy')&&holdPolicy){const held=holdPolicy;holdPolicy=null;return held.promise;}
  if(path.endsWith('/commands')&&method==='POST'){
   const command=JSON.parse(String(init?.body));q.posts.push(command);assert.equal(command.operation,'startStage');
   if(q.posts.length===1)throw Error('synthetic response lost');
   if(approvalRequired)return Response.json({code:'APPROVAL_REQUIRED'},{status:412});
   const waiting={projectId:pid,requestId:f.requestId,version:1,sequence:1,state:'WAITING',input:command.payload,assignmentRef:null,readinessIssues:stageQueueReasons,queuedAt:f.at,cancelledAt:null,cancelledBy:null,cancellationReason:null,requestedBy:{kind:'HUMAN',userId:f.session.user.id,clientId:f.session.clientId},previousRef:null,slotReserved:false,writerReservationPerformed:false,executionAuthorized:false,dispatchPerformed:false};
   const ref={id:f.requestId,version:1,contentHash:H(waiting)};
   receipt={ref,queueState:'WAITING',snapshot:waiting};
   return Response.json({operationId:f.decisionId,commandId:command.commandId,projectId:pid,status:'APPLIED',targetId:ref.id,version:1,data:receipt,evidenceRefs:[],warnings:[],serverReceivedAt:f.at});
  }
  if(['/permission-policy','/execution-preparation-state','/role-bindings/','/context?','/context/','/connection-candidates/','/capability-reports/','/limit-policies/'].some(part=>path.includes(part)))return protectedTransport.client.transport(url,init);
  q.unexpected.push(path);return Response.json({code:'NOT_FOUND'},{status:404});
 };
 return{...q,pid,draft,f,project,decision,application,applicationRef,holdDraft(){holdDraft=deferred<Response>();return holdDraft;},role(mismatch=false){const fresh=seed(),roles=structuredClone(fresh.state.roles),binding=structuredClone(fresh.state.bindings[0]!);roles[1]!.snapshot.stageRef.applicationRef=applicationRef;roles[1]!.ref.contentHash=H(roles[1]!.snapshot);binding.snapshot.roleRef=roles[1]!.ref;binding.snapshot.assignmentRef=mismatch?{...f.confirmed.ref,contentHash:'f'.repeat(64)}:f.confirmed.ref;binding.snapshot.connectionRef=f.connection.ref;binding.ref.contentHash=H(binding.snapshot);f.state.roles=roles;f.state.bindings=[binding];},sessionRoute:sessionDetailHref(pid,draft.ref),workspace:'#/projects/'+pid+'/workspace',mobile:'#/projects/'+pid+'/mobile',
  hold(){holdControl=deferred<Response>();return holdControl;},holdPolicy(){holdPolicy=deferred<Response>();return holdPolicy;},holdQueue(){holdQueue=deferred<Response>();return holdQueue;},setQueueItems(value:any[]|null){queueItems=value;},queueItem,requireApproval(){approvalRequired=true;},bumpGeneration(){project.controlState.generation++;},viewer(){participation='VIEWER';},receipt:()=>receipt};
}
test('App UI04는 현재 단계의 확정 임무와 UI05의 동일 원 요청과 WAITING을 명시적으로 공유한다',async t=>{
 const q=fixture();location.hash=q.workspace;
 const container=document.createElement('main');document.body.appendChild(container);const root=ui.createRoot(container);
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 const button=(label:string)=>nodes().find(n=>n.tagName==='BUTTON'&&(n.textContent===label||n.getAttribute('aria-label')===label));
 const settle=()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});
 const wait=async(check:()=>boolean)=>{const until=Date.now()+2000;while(!check()&&Date.now()<until)await settle();assert(check(),container.textContent);};
 const click=async(label:string)=>{const n=button(label);assert(n,label);assert(!n.disabled,label);await ui.React.act(async()=>n.dispatchEvent({type:'click',button:0}));};
 const link=async(label:string)=>{const n=nodes().find(n=>n.tagName==='A'&&n.textContent===label);assert(n,label);await ui.React.act(async()=>n.dispatchEvent({type:'click',button:0}));};
 const change=async(n:MemoryNode,target:{value?:string;checked?:boolean})=>{const key=Object.keys(n).find(k=>k.startsWith('__reactProps'));assert(key);await ui.React.act(async()=>(n as any)[key].onChange({target}));};
 const go=async(hash:string)=>{await ui.React.act(async()=>{location.hash=hash;for(const f of events.get('hashchange')??[])f();});await settle();};
 const openAssignment=async()=>{
  await wait(()=>!!button('적용 절차 조회')||!!button('절차 정의: 현재 단계'));
  if(!button('절차 정의: 현재 단계'))await click('적용 절차 조회');
  await wait(()=>!!button('절차 정의: 현재 단계')&&!!button('임무 초안 목록 조회'));
  await click('임무 초안 목록 조회');await wait(()=>!!button('임무 버전 열기: 1'));await click('임무 버전 열기: 1');
  await wait(()=>!!button('확정 임무 원본 재조회'));assert(!button('단계 요청 작성'));await click('확정 임무 원본 재조회');
  await wait(()=>container.textContent.includes('원 초안 hash '+q.draft.ref.contentHash));
 };
 try{
  await ui.React.act(async()=>root.render(ui.React.createElement(ui.App)));await openAssignment();
  assert(button('단계 요청 작성'),'UI04 현재 단계의 고정 확정 임무에 작성 동선');
  const held=q.hold();await click('단계 요청 작성');await click('절차 정의: 다른 단계');assert(!button('단계 요청 작성'));
  held.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));await settle();assert(!container.textContent.includes('로그인'));
  assert.equal(q.posts.length,0);
  await click('절차 정의: 현재 단계');await openAssignment();await click('단계 요청 작성');
  await wait(()=>!!nodes().find(n=>n.getAttribute('aria-label')==='단계 요청 사유'));
  await change(nodes().find(n=>n.getAttribute('aria-label')==='단계 요청 사유')!,{value:'현재 단계 대기 요청'});
  await click('단계 요청 명령 준비');await wait(()=>!!button('단계 대기 요청 등록'));assert.equal(q.posts.length,0);
  const ack=()=>{const n=nodes().find(n=>n.tagName==='LABEL'&&n.textContent.includes('대기 요청 보관만 수행하며'))?.childNodes.find(n=>n.tagName==='INPUT');assert(n);return n;};
  const digest=crypto.subtle.digest.bind(crypto.subtle),paused=deferred<void>();let digestEntered=false;
  t.mock.method(crypto.subtle,'digest',async(...args:Parameters<SubtleCrypto['digest']>)=>{
   if(!digestEntered){digestEntered=true;await paused.promise;}
   return digest(...args);
  });
  await change(ack(),{checked:true});
  try{
   await click('단계 대기 요청 등록');await wait(()=>digestEntered);
   await click('절차 정의: 다른 단계');
  }finally{paused.resolve();}
  await settle();assert.equal(q.posts.length,0);
  await click('절차 정의: 현재 단계');await openAssignment();
  assert(button('단계 대기 요청 등록'));assert(!button('같은 시작 요청 명령 결과 재확인'),'미전송 원명령은 불명으로 남지 않는다');
  await change(ack(),{checked:true});await click('단계 대기 요청 등록');await wait(()=>q.posts.length===1&&container.textContent.includes('CONNECTION_LOST')&&!!button('같은 시작 요청 명령 결과 재확인'));
  assert.equal(q.posts.length,1);assert.equal(q.posts[0].payload.reason,'현재 단계 대기 요청');
  assert.deepEqual(q.posts[0].payload.startNodeRef,{applicationRef:q.applicationRef,nodeId:'N1'});
  assert(!('assignmentRef'in q.posts[0].payload));
  assert(nodes().some(n=>n.tagName==='A'&&n.getAttribute('href')===q.sessionRoute));
  await go(q.sessionRoute);await wait(()=>!!button('같은 시작 요청 명령 결과 재확인'));assert.equal(q.posts.length,1);
  assert(container.textContent.includes(q.posts[0].commandId));
  const beforeReturn=q.calls.length;await click('작업공간에서 이 임무 대조');await go(location.hash);await wait(()=>!!button('전달받은 임무 정확 재조회'));await click('전달받은 임무 정확 재조회');await wait(()=>container.textContent.includes('전달받은 정확 임무 원문'));assert(!button('새 맥락 준비 입력'));assert(!button('단계 요청 작성'));assert.equal(q.posts.length,1,'미결 원명령 복귀만으로 추가 POST0');assert(!q.calls.slice(beforeReturn).some(c=>c.path.includes('/assignment-drafts?')));await go(q.sessionRoute);await wait(()=>!!button('같은 시작 요청 명령 결과 재확인'));await click('같은 시작 요청 명령 결과 재확인');
  await wait(()=>container.textContent.includes('단계 요청 보관 영수증 확인'));
  assert.equal(q.posts.length,2);assert.deepEqual(q.posts[0],q.posts[1]);
  assert.equal(q.receipt().snapshot.assignmentRef,null);
  for(const flag of ['slotReserved','writerReservationPerformed','executionAuthorized','dispatchPerformed'])assert.equal(q.receipt().snapshot[flag],false);
  const continueLabel='확인한 대기 요청으로 START 원자료 준비 열기',hintLabel='이 영수증의 대기 요청 원장에서 확인·선택';
  const continueLink=()=>nodes().find(n=>n.tagName==='A'&&n.textContent===continueLabel);
  const stage=()=>nodes().find(n=>n.tagName==='SELECT'&&n.getAttribute('aria-label')==='대기 요청');
  const selectedStage=()=>stage()?.options.find(n=>n.selected)?.value;
  const queueReads=()=>q.calls.filter(c=>c.path.endsWith('/queue')).length;
  const beforeHintRoute=queueReads();
  await go(q.workspace);await openAssignment();assert(!continueLink());assert.equal(queueReads(),beforeHintRoute);
  await click('같은 WAITING 요청 원장 재조회');await wait(()=>container.textContent.includes('동일 WAITING 요청 원장 확인'));
  assert.equal(continueLink()?.getAttribute('href'),q.sessionRoute);
  const good=q.queueItem(),other={...good,requestRef:{...good.requestRef,contentHash:'d'.repeat(64)}};
  q.setQueueItems([other]);await click('같은 WAITING 요청 원장 재조회');
  await wait(()=>container.textContent.includes('STAGE_START_QUEUE_NOT_FOUND'));assert(!continueLink());
  q.setQueueItems(null);await click('같은 WAITING 요청 원장 재조회');await wait(()=>!!continueLink());
  const beforeUI05=queueReads();
  await go(continueLink()!.getAttribute('href')!);await wait(()=>!!button(hintLabel));
  assert.equal(queueReads(),beforeUI05);assert(!stage());
  for(const mismatch of [[],[other],[{...good,sequence:good.sequence+1}],[good,{...good,sequence:good.sequence+1}]]){
   q.setQueueItems(mismatch);const before=q.calls.length;
   await click(hintLabel);
   await wait(()=>!button(hintLabel)?.disabled);
   assert(!stage());assert(!button('등록 준비 고정'));
   assert.deepEqual(q.calls.slice(before).map(c=>c.path),['/api/v1/projects/'+q.pid+'/queue']);
  }
  q.setQueueItems([good,{...good,requestRef:{...good.requestRef,id:q.f.decisionId},sequence:good.sequence+1}]);const beforeSelection=queueReads();
  await click(hintLabel);await wait(()=>!!stage());
  assert.equal(queueReads(),beforeSelection+1);assert.equal(selectedStage(),good.requestRef.id);
  assert.deepEqual(stage()!.options.map(n=>n.value),['',good.requestRef.id]);
  assert.equal(q.posts.length,2);
  await click('원자료 선택 목록 조회');await wait(()=>!!stage()&&selectedStage()==='');
  assert.deepEqual(stage()!.options.map(n=>n.value),['',good.requestRef.id,q.f.decisionId]);
  const oldQueue=q.holdQueue();await click(hintLabel);await go(q.workspace);await openAssignment();
  oldQueue.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));await settle();
  assert(button('같은 WAITING 요청 원장 재조회'),container.textContent);assert(!button('로그인'));assert.equal(q.posts.length,2);
  await go(q.mobile);await openAssignment();await wait(()=>container.textContent.includes('단계 요청 보관 영수증 확인'));
  await link('절차 상세');assert(!button('같은 WAITING 요청 원장 재조회'));
  await link('대화·작업');assert(button('같은 WAITING 요청 원장 재조회'));assert.equal(q.posts.length,2);
  q.bumpGeneration();await click('프로젝트 원본 새로고침');await openAssignment();
  assert(container.textContent.includes('제어 세대가 바뀌었습니다'));assert(!button('같은 WAITING 요청 원장 재조회')?.disabled);

  await click('시작 요청 영수증 닫기');q.requireApproval();await click('단계 요청 작성');
  await wait(()=>!!nodes().find(n=>n.getAttribute('aria-label')==='단계 요청 사유'));
  await change(nodes().find(n=>n.getAttribute('aria-label')==='단계 요청 사유')!,{value:'승인이 필요한 별도의 대기 요청'});
  await click('단계 요청 명령 준비');await wait(()=>!!button('단계 대기 요청 등록'));
  await change(ack(),{checked:true});await click('단계 대기 요청 등록');
  await wait(()=>!!button('단계 승인 요청 준비')&&!button('단계 승인 요청 준비')!.disabled);
  const approvalCommand=q.posts[2]!.commandId;await click('단계 승인 요청 준비');await wait(()=>!!button('단계 원명령 승인 요청 저장'));
  for(const name of ['단계 승인 요청 이유','단계 데이터 위험','단계 보안 위험','단계 비용 위험','단계 중단 영향','단계 미확인 사항','단계 복구 방법','단계 복구 한계','단계 승인 만료 UTC']){
   const label=nodes().find(n=>n.tagName==='LABEL'&&n.textContent===name),input=label?.childNodes.find(n=>n.tagName==='TEXTAREA'||n.tagName==='INPUT');assert(input,name);
   await change(input,{value:name==='단계 승인 만료 UTC'?new Date(Date.now()+60000).toISOString():'확정 임무 대기 요청 확인'});
  }
  const beforeApproval=q.calls.length,approvalPolicy=q.holdPolicy();await click('단계 원명령 승인 요청 저장');
  await wait(()=>q.calls.slice(beforeApproval).some(c=>c.path.endsWith('/permission-policy')));
  await link('절차 상세');assert(!button('단계 원명령 승인 요청 저장'));
  approvalPolicy.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));await settle();
  assert.equal(q.posts.length,3);
  await link('대화·작업');assert(button('단계 원명령 승인 요청 저장'));assert(container.textContent.includes(approvalCommand));
  assert(!button('같은 단계 승인 요청 결과 확인'));
  q.bumpGeneration();await click('프로젝트 원본 새로고침');await openAssignment();
  assert(container.textContent.includes('제어 세대가 바뀌었습니다'));assert(button('단계 원명령 승인 요청 저장')?.disabled);
  assert(container.textContent.includes(approvalCommand));
  q.viewer();await go(q.workspace);await click('프로젝트 원본 새로고침');await openAssignment();
  assert(!button('단계 요청 작성'));assert(!button('같은 WAITING 요청 원장 재조회'));
  assert(!button('단계 원명령 승인 요청 저장'));assert.equal(q.posts.length,3);assert.deepEqual(q.unexpected,[]);
 }finally{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}
});


async function mountAssignmentReturn(q:ReturnType<typeof fixture>){
 location.hash=q.sessionRoute;const container=document.createElement('main');document.body.appendChild(container);const root=ui.createRoot(container),nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))],button=(label:string)=>nodes().find(n=>n.tagName==='BUTTON'&&(n.textContent===label||n.getAttribute('aria-label')===label)),settle=()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));}),wait=async(check:()=>boolean)=>{const end=Date.now()+2000;while(!check()&&Date.now()<end)await settle();assert(check(),container.textContent);},click=async(label:string)=>{const n=button(label);assert(n,label);assert(!n.disabled,label);await ui.React.act(async()=>n.dispatchEvent({type:'click',button:0}));},arrival=async()=>{await click('작업공간에서 이 임무 대조');await ui.React.act(async()=>{for(const f of events.get('hashchange')??[])f();});await wait(()=>!!button('전달받은 임무 정확 재조회'));};
 await ui.React.act(async()=>root.render(ui.React.createElement(ui.App)));await wait(()=>!!button('단계 요청 작성'));
 return{container,nodes,button,settle,wait,click,arrival,async close(){await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}

test('App UI05의 검산된 임무는 UI04에서 목록 없이 정확 원문·역할을 읽기 전용 재조회한다',{timeout:15000},async()=>{
 const q=fixture();q.role();const v=await mountAssignmentReturn(q);try{const before=q.calls.length;await v.arrival();await v.wait(()=>v.container.textContent.includes('선택 정의: 현재 단계'));assert(!q.calls.slice(before).some(c=>c.path.includes('/assignment-drafts?')));await v.click('전달받은 임무 정확 재조회');await v.wait(()=>v.container.textContent.includes('전달받은 정확 임무 원문'));assert(v.container.textContent.includes(q.draft.ref.contentHash));assert(v.container.textContent.includes('원 역할·책임 결박 ref 대조 일치'));assert(v.container.textContent.includes('검산한 초안 참조'));assert(v.container.textContent.includes('검산한 확정 참조'));assert(v.container.textContent.includes(q.f.confirmed.ref.contentHash));assert(!v.button('새 맥락 준비 입력'));assert(!v.button('확정 임무 원본 재조회'));assert(!v.button('단계 요청 작성'));assert(v.button('현재 버전으로 개정 준비')!.disabled);assert.equal(q.posts.length,0);assert(!q.calls.slice(before).some(c=>c.path.includes('/assignment-drafts?')));assert.deepEqual(q.unexpected,[]);}finally{await v.close();}
});
for(const mode of ['HEAD','APPLICATION','ROLE_CHANGED','BINDING_OTHER_ASSIGNMENT','REVIEW_REWORK'] as const)test('App 읽기 전용 임무 복귀의 '+mode+'는 원문과 대조 결과만 표시한다',{timeout:15000},async()=>{
 const q=fixture();if(mode==='ROLE_CHANGED'||mode==='BINDING_OTHER_ASSIGNMENT')q.role();const v=await mountAssignmentReturn(q);try{if(mode==='HEAD'){q.draft.headVersion=2;q.decision.currentIssue='ASSIGNMENT_DRAFT_NOT_CURRENT';}if(mode==='APPLICATION')q.project.currentMethodologyRef={...q.applicationRef,version:2};if(mode==='ROLE_CHANGED'){q.f.state.bindings[0]!.ref.version=2;q.f.state.bindings[0]!.snapshot.generation=2;q.f.state.bindings[0]!.snapshot.existingSessionBindingRef={...q.f.state.bindings[0]!.ref,version:1};q.f.state.bindings[0]!.ref.contentHash=H(q.f.state.bindings[0]!.snapshot);}if(mode==='BINDING_OTHER_ASSIGNMENT')q.role(true);if(mode==='REVIEW_REWORK'){const review=structuredClone(q.decision.reviews[0]!);review.snapshot.outcome='REWORK';review.snapshot.reason='확정 이후 최신 검토 보완';review.ref={...review.ref,id:'af040058-1111-4111-8111-000000000099',contentHash:H(review.snapshot)};review.serverSequence=2;q.decision.reviews.unshift(review);q.decision.latestReviewAccepted=false;}
  await v.arrival();await v.click('전달받은 임무 정확 재조회');await v.wait(()=>v.container.textContent.includes('전달받은 정확 임무 원문'));assert(v.container.textContent.includes(q.draft.ref.contentHash));await v.click('저장 버전 재조회');await v.wait(()=>!v.button('저장 버전 재조회')!.disabled);assert(v.container.textContent.includes('읽기 전용 · 새 준비·예약·실행 없음'));assert(v.button('현재 버전으로 개정 준비')!.disabled);assert(v.button('이 임무를 부모로 하위 초안 준비')!.disabled);assert(!v.button('새 맥락 준비 입력'));assert(!v.button('단계 요청 작성'));if(mode==='ROLE_CHANGED')assert(v.container.textContent.includes('원 역할·책임 결박 ref 대조 다름'));if(mode==='BINDING_OTHER_ASSIGNMENT')assert(v.container.textContent.includes('단계 결박의 임무 다름'));if(mode==='REVIEW_REWORK')assert(v.container.textContent.includes('조회된 최신 검토 적합 미확인'));assert.equal(q.posts.length,0);
 }finally{await v.close();}
});
test('App 읽기 전용 임무 복귀는 동일 도착의 부모 재렌더 중 보호 조회를 유지한다',{timeout:15000},async()=>{const q=fixture(),v=await mountAssignmentReturn(q);try{await v.arrival();await v.wait(()=>v.container.textContent.includes('선택 정의: 현재 단계'));const held=q.holdDraft();await v.click('전달받은 임무 정확 재조회');await v.click('메뉴');held.resolve(Response.json(q.draft));await v.wait(()=>v.container.textContent.includes('전달받은 정확 임무 원문'));assert.equal(q.posts.length,0);}finally{await v.close();}});
for(const mode of ['CROSS_PROJECT','RAW_EXIT'] as const)test('App UI05 '+mode+' 뒤 옛 임무 복귀 클릭은 탐색·GET0',{timeout:15000},async()=>{const q=fixture(),v=await mountAssignmentReturn(q);try{const node=v.button('작업공간에서 이 임무 대조')!,key=Object.keys(node).find(k=>k.startsWith('__reactProps'));assert(key);const before=q.calls.length,target=mode==='CROSS_PROJECT'?'#/projects/af040058-1111-4111-8111-000000000099/workspace':q.workspace;location.hash=target;await ui.React.act(async()=>(node as any)[key].onClick());await v.settle();assert.equal(location.hash,target);assert.equal(q.calls.length,before);assert.equal(q.posts.length,0);}finally{await v.close();}});
for(const status of [200,401])test('App 읽기 전용 임무 재조회 이탈 late'+status+'는 원문·인증효과0',{timeout:15000},async()=>{const q=fixture(),v=await mountAssignmentReturn(q);try{await v.arrival();await v.wait(()=>v.container.textContent.includes('선택 정의: 현재 단계'));const held=q.holdDraft();await v.click('전달받은 임무 정확 재조회');const before=q.calls.length;location.hash=q.sessionRoute;held.resolve(Response.json(status===200?q.draft:{code:'AUTH_REQUIRED'},{status}));await v.settle();assert(!v.container.textContent.includes('전달받은 정확 임무 원문'));assert(!v.container.textContent.includes('Anvil 로그인'));assert.equal(q.calls.length,before);assert.equal(q.posts.length,0);}finally{await v.close();}});
for(const mode of ['STATE_MISSING','DUPLICATE_ROLE','CONFIRMATION_REPLACED'] as const)test('App 읽기 전용 임무 재조회의 '+mode+'는 대체0',{timeout:15000},async()=>{const q=fixture();q.role();const v=await mountAssignmentReturn(q);try{if(mode==='STATE_MISSING')q.f.state.roles=[];if(mode==='DUPLICATE_ROLE')q.f.state.roles.push(structuredClone(q.f.state.roles[0]!));if(mode==='CONFIRMATION_REPLACED'){q.f.confirmed.snapshot.reason='다른 확인';q.f.confirmed.ref.contentHash=H(q.f.confirmed.snapshot);q.role();}await v.arrival();await v.click('전달받은 임무 정확 재조회');await v.wait(()=>v.container.textContent.includes(mode==='CONFIRMATION_REPLACED'?'ASSIGNMENT_BINDING_INVALID':'RESPONSE_INVALID'));assert(!v.container.textContent.includes('전달받은 정확 임무 원문'));assert(!v.button('새 맥락 준비 입력'));assert.equal(q.posts.length,0);}finally{await v.close();}});
test('App 읽기 전용 임무의 옛 고정 재조회는 raw 이탈 뒤 GET0',{timeout:15000},async()=>{const q=fixture(),v=await mountAssignmentReturn(q);try{await v.arrival();await v.click('전달받은 임무 정확 재조회');await v.wait(()=>v.container.textContent.includes('전달받은 정확 임무 원문'));const node=v.button('저장 버전 재조회')!,key=Object.keys(node).find(k=>k.startsWith('__reactProps'));assert(key);location.hash=q.sessionRoute;const before=q.calls.length;await ui.React.act(async()=>(node as any)[key].onClick());await v.settle();assert.equal(q.calls.length,before);assert.equal(q.posts.length,0);assert(!v.container.textContent.includes('Anvil 로그인'));}finally{await v.close();}});
