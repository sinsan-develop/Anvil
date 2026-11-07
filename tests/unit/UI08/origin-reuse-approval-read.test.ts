import assert from 'node:assert/strict';
import test,{before,after} from 'node:test';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {readApproval,prepareApprovalDecision,validApprovalDetails,bindCandidateApproval} from '../../../apps/web/src/features/decisions/api.ts';
import {sendOriginReuseDecision} from '../../../apps/web/src/features/decisions/origin-reuse-approval-api.ts';
import {browserCanonical} from '../../../apps/web/src/features/control-handoff/api.ts';
const id=(n:number)=>`10000000-0000-4000-8000-${n.toString(16).padStart(12,'0')}`;
const pid=id(1),uid=id(2),cid=id(3),rid=id(4),session={user:{id:uid},clientId:cid,csrfToken:'C'.repeat(43)};
const hash=(v:unknown)=>createHash('sha256').update(browserCanonical(v)).digest('hex');
const ref=(n:number,version=1)=>({id:id(n),version,contentHash:hash({n,version})});
/** 고정 보관 DTO의 합성 경계다. 서버 인증·현재성의 성공 대역이 아니다. */
function storedView():any{
 const preparationRef=ref(10),p1Ref=ref(11),p2Ref=ref(11,2),contextBundleRef=ref(12),originRef=ref(13),reservationRef=ref(14),budgetPolicyRef=ref(15);
 const sourceScopes=[{sourceRootRef:ref(20),mappingRef:null,observationRef:ref(21),baselineRef:ref(22),targets:[{relativePath:'src/main.ts',kind:'FILE',access:'READ',recursive:false}]}];
 const candidatePayload={preparationRef,executionId:id(30),executionGeneration:1,permissionPolicyRef:p2Ref,budgetPolicyRef,operation:'START_SESSION',payload:{contextBundleRef,optionsRef:preparationRef},originReuse:{originRef,reservationRef}};
 const candidateCommandId=id(31),candidatePayloadHash=hash(candidatePayload);
 const evidence={purpose:'FN09_ORIGIN_REUSE_SYNTHETIC_START_V1',projectId:pid,originRef,reservationRef,originCommand:{serverCommandId:id(32),commandId:id(33),requestHash:hash('원 원자료 명령')},subject:{kind:'HUMAN',userId:uid,clientId:cid,humanSessionId:id(34),credentialGeneration:1,controlGeneration:1},execution:{executionId:id(30),executionGeneration:1},p1Ref,p2Ref,stageRequestRef:ref(35),assignmentRef:ref(36),roleBindingRef:ref(37),sessionBindingRef:ref(38),preparationRef,connectionRef:ref(39),environmentRef:ref(40),contextBundleRef,optionsRef:preparationRef,sourceScopes,budgetPolicyRef,dependencies:[{kind:'CONNECTOR_REGISTRATION',ref:ref(41)},{kind:'CONNECTOR_STATUS',ref:ref(42)},{kind:'SOURCE_ROOT_DECLARATION',ref:ref(20)}],candidateCommandId,candidatePayloadHash,candidatePayload};
 const actionScope={operation:'queueExecutionCommand',targetRef:null,expectedVersion:0,payloadHash:candidatePayloadHash,baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:uid,clientId:cid},controlGeneration:1};
 const details={reason:'보관 요청 원문',risks:{data:'원본 보존',security:'실행 권위 없음',cost:'실행 없음',interruption:'없음',unverified:'실제 Agent 미관측'},rollback:{method:'원 이력 보존',limitations:'자동 재발행 없음',evidenceRefs:[]},expiresAt:'2026-11-08T01:10:00.000Z',actionScope,candidateCommandId};
 const snapshot={projectId:pid,details,scopeDigest:hash(actionScope),requiredDecider:{kind:'HUMAN',userId:uid},policyRef:p2Ref,requestedBy:{kind:'HUMAN',userId:uid,clientId:cid},controlGeneration:1,originReuseEvidence:evidence};
 return{request:{id:rid,version:1,status:'PENDING',...snapshot,createdAt:'2026-11-08T01:00:00.000Z'},requestRef:{id:rid,version:1,contentHash:hash(snapshot)},currentVersion:1,storedStatus:'PENDING',effectiveState:'PENDING',decision:null,consumption:null,expired:false,basisCurrent:true,executionAuthorized:false,observedAt:'2026-11-08T01:01:00.000Z'};
}
test('원자료 재사용 GET은 봉인 읽기·명시 결정 준비만 허용하고 범용 제작·결박은 닫는다',async()=>{
 const view=storedView();let posts=0;
 const api=new ApiClient(async(url,init)=>{assert.equal(url,`/api/v1/projects/${pid}/approvals/${rid}`);if(init?.method!=='GET')posts++;return Response.json(view);});
 assert.equal((await readApproval(api,pid,rid)).request.id,rid);
 assert.equal(validApprovalDetails(view.request.details),false);
 assert.equal((await prepareApprovalDecision(pid,currentStoredView(),'APPROVE','원 요청 명시 판단',session,1)).operation,'decideApproval');
 const b:any={projectId:pid,ownerUserId:uid,ownerClientId:cid,controlGeneration:1,input:{},pending:{projectId:pid,clientId:cid,controlGeneration:1,payload:{}}};await assert.rejects(bindCandidateApproval(api,b,rid,session),{code:'APPROVAL_PURPOSE_READ_ONLY'});
 assert.equal(posts,0);
});

/** 실제 ReactDOM과 GET decoder를 소비한다. served 브라우저·서버 권한의 검증은 아니다. */
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
let ui:any;const saved=new Map<string,PropertyDescriptor|undefined>(),channels:MessageChannel[]=[];let document:any;
before(async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/decisions/ApprovalsPage.tsx',import.meta.url)),api=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:registered-preparation',name:'RegisteredPreparationFlow',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'origin-reuse-memory',resolveId(id){if(id.endsWith('virtual:registered-preparation'))return '\0registered-preparation';},load(id){if(id==='\0registered-preparation')return "import * as React from 'react';import{createRoot}from'react-dom/client';import{ApprovalsPage}from"+JSON.stringify(entry)+";import{ApiClient}from"+JSON.stringify(api)+";export{React,createRoot,ApprovalsPage,ApiClient};";}}]});
 document=new MemoryNode('#document',9);document.ownerDocument=document;document.createElement=(n:string)=>new MemoryNode(n,1,document);document.createElementNS=(_ns:string,n:string)=>document.createElement(n);document.createTextNode=(s:string)=>{const n=new MemoryNode('#text',3,document);n.data=s;return n;};document.documentElement=document.createElement('html');document.body=document.createElement('body');document.documentElement.appendChild(document.body);document.activeElement=document.body;
 const NativeChannel=globalThis.MessageChannel;class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[k,v]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((x:any)=>x.type==='chunk').code+';return RegisteredPreparationFlow;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});

function reseal(v:any){const {id:requestId,version,status,createdAt,...snapshot}=v.request;v.requestRef.contentHash=hash(snapshot);return v;}
test('보관 원후보·근거·주체·refs·범위·false 권위의 오염은 읽기에서 거절한다',async()=>{
 const changes=[(v:any)=>v.request.originReuseEvidence.originCommand.requestHash='f'.repeat(64),(v:any)=>v.requestRef.contentHash='f'.repeat(64),(v:any)=>v.request.scopeDigest='f'.repeat(64),(v:any)=>v.request.originReuseEvidence.candidatePayload.operation='SEND',(v:any)=>v.request.originReuseEvidence.subject.clientId=id(90),(v:any)=>v.request.originReuseEvidence.subject.userId=id(90),(v:any)=>v.request.originReuseEvidence.optionsRef=ref(90),(v:any)=>v.request.originReuseEvidence.dependencies.push(v.request.originReuseEvidence.dependencies[0]),(v:any)=>v.request.originReuseEvidence.token='금지 외피',(v:any)=>v.executionAuthorized=true,(v:any)=>v.decision={},(v:any)=>v.consumption={}];
 for(const change of changes){const v=storedView();change(v);await assert.rejects(readApproval(new ApiClient(async()=>Response.json(v)),pid,rid),{code:'RESPONSE_INVALID'});}
 for(const change of [(v:any)=>v.request.originReuseEvidence.subject.clientId=id(90),(v:any)=>v.request.originReuseEvidence.p2Ref=ref(90),(v:any)=>v.request.originReuseEvidence.candidatePayload.payload.optionsRef=ref(90)]){const v=storedView();change(v);reseal(v);await assert.rejects(readApproval(new ApiClient(async()=>Response.json(v)),pid,rid),{code:'RESPONSE_INVALID'});}
});
test('만료 보관 이력은 현재 실행 증명으로 승격하지 않고 원 봉인대로 읽는다',async()=>{
 const v=storedView();v.observedAt='2026-11-08T01:11:00.000Z';v.expired=true;v.effectiveState='EXPIRED';
 assert.equal((await readApproval(new ApiClient(async()=>Response.json(v)),pid,rid)).executionAuthorized,false);
 v.effectiveState='PENDING';await assert.rejects(readApproval(new ApiClient(async()=>Response.json(v)),pid,rid),{code:'RESPONSE_INVALID'});
});
async function mounted(transport:typeof fetch,providedSession:any=structuredClone(session),initialBuffer:any=null,parentMode?:'REJECT_PENDING'|'REPLACE_PENDING'){
 const container=document.createElement('main');document.body.appendChild(container);const root=ui.createRoot(container);let buffer:any=null,authLost=0,changes=0,setParent:((value:any)=>void)|undefined;
 const props:any={client:new ui.ApiClient(transport),projectId:pid,requestId:rid,session:providedSession,candidate:null,onCandidateChange(){throw Error('후보 변경 금지');},onAuthenticationLost(){authLost++;}};
 function Host(){const [value,set]=ui.React.useState(initialBuffer);buffer=value;setParent=set;return ui.React.createElement(ui.ApprovalsPage,{...props,buffer:value,onChange:(change:any)=>{changes++;if(!parentMode){set(change);return;}set((previous:any)=>{const next=typeof change==='function'?change(previous):change;if(next?.decision?.pending&&!previous?.decision?.pending){if(parentMode==='REJECT_PENDING')return previous;return{...previous,decision:{...previous.decision,reason:'부모의 별도 판단',acknowledged:false,pending:null}};}return next;});}});}
 const render=async()=>{await ui.React.act(async()=>root.render(ui.React.createElement(Host)));};
 const flush=async()=>{await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});};
 const wait=async(check:()=>boolean)=>{for(let n=0;n<100&&!check();n++)await flush();assert(check(),'메모리 관측 정착 / '+container.textContent.slice(0,700));};
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 const click=async(text:string)=>{const node=nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===text);assert(node,text);await ui.React.act(async()=>node.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const fillDecision=async(reason:string)=>{for(const [kind,target]of[['reason',{value:reason}],['ack',{checked:true}]] as const){const node=kind==='reason'?nodes().find(n=>n.getAttribute('aria-label')==='결정 이유'):nodes().find(n=>n.tagName==='INPUT'&&((n as any).type==='checkbox'||n.getAttribute('type')==='checkbox'));assert(node,'명시 이유/확인 입력');const key=Object.keys(node).find(k=>k.startsWith('__reactProps$'));assert(key);await ui.React.act(async()=>(node as any)[key].onChange({target}));}};
 const lookup=async()=>{const form=nodes().find(n=>n.tagName==='FORM');assert(form);const key=Object.keys(form).find(k=>k.startsWith('__reactProps$'));assert(key);await ui.React.act(async()=>(form as any)[key].onSubmit({preventDefault(){}}));};
 const replaceDecision=async(value:any)=>{assert(setParent);await ui.React.act(async()=>setParent!((previous:any)=>({...previous,decision:value})));};
 const busy=()=>nodes().find(n=>n.tagName==='FIELDSET'&&n.textContent.includes('정확 승인 요청 원문 찾기'))?.disabled??false;
 const close=async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);};
 await render();return{container,props,render,flush,wait,nodes,click,fillDecision,lookup,replaceDecision,busy,close,get authLost(){return authLost;},get changes(){return changes;},get buffer(){return buffer;}};
}
function replies(view=storedView(),options:{status?:number;hold?:()=>Promise<void>}={}){let posts=0,details=0;const calls:string[]=[];
 const transport:typeof fetch=async(url,init)=>{calls.push(String(url));if(init?.method!=='GET'){posts++;throw Error('POST 금지');}assert(String(url).startsWith('/api/v1/'));if(String(url).includes('/approvals?'))return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:view.observedAt});if(!String(url).endsWith('/'+rid))return Response.json({code:'ACCESS_DENIED'},{status:403});details++;await options.hold?.();return options.status?Response.json({code:options.status===401?'AUTH_REQUIRED':'ACCESS_DENIED'},{status:options.status}):Response.json(view);};
 return{transport,calls,get posts(){return posts;},get details(){return details;}};
}
test('실제 상세 화면은 검산된 원후보·근거와 저장한정 상태를 표시하고 결정·결박 POST0',async()=>{
 const q=replies(),m=await mounted(q.transport);try{await m.wait(()=>m.container.textContent.includes('원자료 재사용 · PENDING 요청 보관'));assert(m.container.textContent.includes('credential 미발급'));assert(m.container.textContent.includes('실제 실행 미관측'));assert(m.container.textContent.includes('START_SESSION'));assert(m.container.textContent.includes('FN09_ORIGIN_REUSE_SYNTHETIC_START_V1'));const buttons=m.nodes().filter(n=>n.tagName==='BUTTON').map(n=>n.textContent);for(const text of ['이번만 승인','거절','수정 요청','이 승인을 원 후보에 결박'])assert(!buttons.includes(text),text);assert.equal(m.buffer.decision,null);assert.equal(q.posts,0);}finally{await m.close();}
});
test('실제 상세 화면의 교차 actor/client 보관 원문과 보호 GET 거절은 숨긴다',async()=>{
 for(const field of ['userId','clientId']){const v=storedView();v.request.requestedBy[field]=id(90);v.request.details.actionScope.requestedSubjectRef[field]=id(90);v.request.originReuseEvidence.subject[field]=id(90);if(field==='userId')v.request.requiredDecider.userId=id(90);v.request.scopeDigest=hash(v.request.details.actionScope);reseal(v);const q=replies(v),m=await mounted(q.transport);try{await m.wait(()=>m.container.textContent.includes('APPROVAL_OWNER_MISMATCH'));assert(!m.container.textContent.includes('보관 요청 원문'));assert.equal(q.posts,0);}finally{await m.close();}}
 for(const status of [401,403]){const q=replies(storedView(),{status}),m=await mounted(q.transport);try{await m.wait(()=>m.container.textContent.includes(status===401?'AUTH_REQUIRED':'ACCESS_DENIED'));assert(!m.container.textContent.includes('보관 요청 원문'));assert.equal(m.authLost,status===401?1:0);assert.equal(q.posts,0);}finally{await m.close();}}
});
test('세션 스칼라·transport·project·선택 ID 이탈 후 늦은 성공과 401은 새 화면을 바꾸지 않는다',async()=>{
 for(const change of ['user','client','transport','project','id'])for(const status of [0,401]){let release!:()=>void;const hold=new Promise<void>(r=>release=r),q=replies(storedView(),{hold:()=>hold,...(status?{status}: {})}),m=await mounted(q.transport);try{await m.wait(()=>q.details>0);if(change==='user')m.props.session.user.id=id(80);if(change==='client')m.props.session.clientId=id(80);if(change==='transport')m.props.client.transport=replies(storedView(),{status:403}).transport;if(change==='project')m.props.projectId=id(80);if(change==='id')m.props.requestId=id(80);await m.render();const changes=m.changes,auth=m.authLost;await ui.React.act(async()=>release());await m.flush();assert(!m.container.textContent.includes('원자료 재사용 · PENDING 요청 보관'),change);assert.equal(m.authLost,auth,change+' 오래된 401');assert.equal(m.changes,changes,change+' 오래된 부모 상태');assert.equal(q.posts,0);}finally{release();await m.close();}}
});

test('재렌더 전 transport 교체와 같은 scope 복귀도 늦은 보관 원문을 부활시키지 않는다',async()=>{
 let release!:()=>void;const hold=new Promise<void>(r=>release=r),q=replies(storedView(),{hold:()=>hold}),m=await mounted(q.transport);
 try{await m.wait(()=>q.details>0);m.props.client.transport=replies(storedView(),{status:403}).transport;const changes=m.changes;await ui.React.act(async()=>release());await m.flush();assert(!m.container.textContent.includes('보관 요청 원문'));assert.equal(m.changes,changes);await m.render();m.props.client.transport=q.transport;await m.render();await m.wait(()=>q.details>=2&&m.container.textContent.includes('보관 요청 원문'));assert.equal(q.posts,0);}finally{release();await m.close();}
});
test('같은 원 ID의 새 보호조회 거절 뒤 이전 본문은 표시되지 않고 명시 조회로 복구한다',async()=>{
 let denied=false;const q=replies(),m=await mounted(async(url,init)=>denied&&!String(url).includes('/approvals?')?Response.json({code:'ACCESS_DENIED'},{status:403}):q.transport(url,init));
 try{await m.wait(()=>m.container.textContent.includes('보관 요청 원문'));denied=true;await m.lookup();await m.wait(()=>m.container.textContent.includes('ACCESS_DENIED'));assert(!m.container.textContent.includes('보관 요청 원문'));denied=false;await m.lookup();await m.wait(()=>m.container.textContent.includes('보관 요청 원문'));assert.equal(q.posts,0);}finally{await m.close();}
});

test('이전 scope의 지연 목록 401도 현재 인증과 상세 본문을 바꾸지 않는다',async()=>{
 let release!:()=>void;const hold=new Promise<void>(r=>release=r);let lists=0;
 const q=replies(),m=await mounted(async(url,init)=>{if(String(url).includes('/approvals?')&&++lists===1){await hold;return Response.json({code:'AUTH_REQUIRED'},{status:401});}return q.transport(url,init);});
 try{await m.wait(()=>m.container.textContent.includes('보관 요청 원문'));m.props.client.transport=q.transport;await m.render();await m.wait(()=>q.details>=2&&m.container.textContent.includes('보관 요청 원문'));await ui.React.act(async()=>release());await m.flush();assert.equal(m.authLost,0);assert(m.container.textContent.includes('보관 요청 원문'));assert.equal(q.posts,0);}finally{release();await m.close();}
});

test('기존 일반목적의 동일 scope 재렌더는 상세 GET을 늘리거나 보존 결정 입력을 바꾸지 않는다',async()=>{
 const v=storedView();delete v.request.originReuseEvidence;v.request.details.actionScope.operation='registerConnection';v.request.scopeDigest=hash(v.request.details.actionScope);reseal(v);
 const decision={requestId:rid,reason:'이전 결정 원문 보존',acknowledged:true,pending:{commandId:id(70)},resultId:null,failure:{code:'CONNECTION_LOST',status:0},uncertain:true};
 const initial={projectId:pid,ownerUserId:uid,ownerClientId:cid,selectedId:rid,request:null,decision};
 const q=replies(v),m=await mounted(q.transport,structuredClone(session),initial);
 try{await m.wait(()=>m.container.textContent.includes('보관 요청 원문'));const reads=q.details;assert.equal(reads,1);await m.render();await m.render();await m.flush();assert.equal(q.details,reads);assert.deepEqual(m.buffer.decision,decision);assert(m.container.textContent.includes('같은 결정 명령 결과 확인'));assert(!m.container.textContent.includes('원자료 재사용 · PENDING 요청 보관'));assert.equal(q.posts,0);}finally{await m.close();}
});

test('의존 참조는 임의 건수 상한 없이 전체 2MiB 경계 안에서 정확 정렬·봉인을 검산한다',async()=>{
 const v=storedView();v.request.originReuseEvidence.dependencies=Array.from({length:1001},(_,n)=>({kind:'SOURCE_ROOT_DECLARATION',ref:ref(100+n)}));reseal(v);
 assert.equal((await readApproval(new ApiClient(async()=>Response.json(v)),pid,rid)).request.originReuseEvidence!.dependencies.length,1001);
});

function currentStoredView(){const v=storedView(),at=Date.now();v.request.createdAt=new Date(at-1000).toISOString();v.request.details.expiresAt=new Date(at+60000).toISOString();v.observedAt=new Date(at-500).toISOString();return reseal(v);}
function storedDecision(view:any,choice='APPROVE',reason='원 요청 명시 판단'){
 const body={requestId:view.request.id,requestVersion:1,requestRef:view.requestRef,scopeDigest:view.request.scopeDigest,decision:choice,reason,decidedBy:{...view.request.requestedBy},controlGeneration:view.request.controlGeneration,policyRef:view.request.policyRef};
 const ref={id:id(99),version:1,contentHash:hash(body)},decision={id:ref.id,...body,decidedAt:new Date().toISOString()};return{ref,decision};
}
function decidedView(view:any,choice='APPROVE',reason='원 요청 명시 판단'){const{ref,decision}=storedDecision(view,choice,reason),status=({APPROVE:'APPROVED',REJECT:'REJECTED',REQUEST_CHANGE:'CHANGE_REQUESTED'} as Record<string,string>)[choice];return{...structuredClone(view),currentVersion:2,storedStatus:status,effectiveState:status,decision:{ref,...decision},observedAt:new Date().toISOString()};}
test('세 명시 결정 GET v2는 v1 원문과 부모 fullref를 보존한 봉인만 읽는다',async()=>{
 const original=currentStoredView();for(const choice of ['APPROVE','REJECT','REQUEST_CHANGE']){const v=decidedView(original,choice);const read=await readApproval(new ApiClient(async()=>Response.json(v)),pid,rid);assert.equal(read.currentVersion,2);assert.deepEqual(read.request,original.request);assert.deepEqual(read.requestRef,original.requestRef);assert.equal(read.decision!.decision,choice);assert.equal(read.consumption,null);assert.equal(read.executionAuthorized,false);}
});
test('현재 원 요청의 명시 결정은 원 control·P2·scope만 가진 기존 decideApproval 명령이다',async()=>{
 const v=currentStoredView(),c=await prepareApprovalDecision(pid,v,'APPROVE','원 요청 명시 판단',session,1);
 assert.equal(c.operation,'decideApproval');assert.equal(c.targetId,rid);assert.equal(c.expectedVersion,1);assert.deepEqual(c.payload,{requestId:rid,expectedVersion:1,scopeDigest:v.request.scopeDigest,decision:'APPROVE',reason:'원 요청 명시 판단'});assert.equal(c.approvalRef,null);
});

function decisionReplies(options:{lost?:boolean;deny?:boolean;denyReadAfterPost?:boolean;controlStatus?:number;generation?:number;holdControl?:()=>Promise<void>;holdPost?:()=>Promise<void>;mutate?:(result:any)=>void}={}){
 let view=currentStoredView(),saved:any=null,originalBody:string|null=null,stored=0,controls=0;const bodies:string[]=[];
 const transport:typeof fetch=async(url,init)=>{
  if(init?.method==='POST'){assert.equal(url,`/api/v1/projects/${pid}/commands`);const body=String(init.body),c=JSON.parse(body);bodies.push(body);assert.equal(c.operation,'decideApproval');assert.equal(c.targetId,rid);await options.holdPost?.();if(options.deny)return Response.json({code:'PROJECT_OPERATION_DENIED'},{status:403});
   if(!saved){originalBody=body;const{ref,decision}=storedDecision(view,c.payload.decision,c.payload.reason);saved={operationId:id(101),commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:ref.id,version:1,data:{ref,status:'APPROVAL_DECIDED',decision},evidenceRefs:[],warnings:[],serverReceivedAt:decision.decidedAt};view={...view,currentVersion:2,storedStatus:({APPROVE:'APPROVED',REJECT:'REJECTED',REQUEST_CHANGE:'CHANGE_REQUESTED'} as any)[decision.decision],effectiveState:({APPROVE:'APPROVED',REJECT:'REJECTED',REQUEST_CHANGE:'CHANGE_REQUESTED'} as any)[decision.decision],decision:{ref,...decision},observedAt:decision.decidedAt};stored++;if(options.lost)throw Error('응답 유실');}
   else assert.equal(body,originalBody,'원 결정 packet 동일');const result=structuredClone(saved);options.mutate?.(result);return Response.json(result);
  }
  assert.equal(init?.method,'GET');if(String(url).includes('/approvals?'))return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:view.observedAt});
  if(url===`/api/v1/projects/${pid}`){controls++;await options.holdControl?.();if(options.controlStatus)return Response.json({code:'AUTH_REQUIRED'},{status:options.controlStatus});return Response.json({id:pid,participation:'OWNER',controlState:{actorId:uid,clientId:cid,generation:options.generation??1,status:'HELD'}});}
  assert.equal(url,`/api/v1/projects/${pid}/approvals/${rid}`);if(options.denyReadAfterPost&&stored)return Response.json({code:'ACCESS_DENIED'},{status:403});return Response.json(view);
 };
 return{transport,bodies,get view(){return view;},get stored(){return stored;},get controls(){return controls;}};
}
test('실제 Page의 세 명시 결정은 이유·확인·현재 제어 뒤 POST1과 원 GET v2로 연결된다',async()=>{
 for(const [choice,label]of[['APPROVE','이번만 승인'],['REJECT','거절'],['REQUEST_CHANGE','수정 요청']] as const){const q=decisionReplies(),m=await mounted(q.transport);try{
  await m.wait(()=>m.container.textContent.includes('원자료 재사용 · PENDING 요청 보관'));assert.equal(q.bodies.length,0);await m.click('이 요청 결정 준비');await m.fillDecision('원 요청 명시 판단');await m.click(label);
  await m.wait(()=>m.buffer?.decision?.resultId!==null&&m.container.textContent.includes('명시 결정 보관'));assert.equal(q.bodies.length,1);assert.equal(q.controls,1);assert.equal(q.stored,1);assert.equal(m.buffer.decision.uncertain,false);assert.equal(q.view.decision.decision,choice);assert(m.container.textContent.includes('결정 저장 영수증'));assert(!m.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='이 승인을 원 후보에 결박'));
 }finally{await m.close();}}
});

test('GET v2의 자체 hash를 다시 맞춘 부모·정책·주체·제어·상태 오염도 거절한다',async()=>{
 for(const change of [(v:any)=>v.decision.requestRef=ref(90),(v:any)=>v.decision.policyRef=ref(90),(v:any)=>v.decision.controlGeneration=2,(v:any)=>v.decision.decidedBy.clientId=id(90),(v:any)=>v.storedStatus='REJECTED',(v:any)=>v.currentVersion=3,(v:any)=>v.consumption={},(v:any)=>v.executionAuthorized=true]){const v=decidedView(currentStoredView());change(v);const{ref:decisionRef,id:decisionId,decidedAt,...body}=v.decision;decisionRef.contentHash=hash(body);await assert.rejects(readApproval(new ApiClient(async()=>Response.json(v)),pid,rid),{code:'RESPONSE_INVALID'});}
});
test('목적 sender는 정합 재봉인된 결정 응답도 원 부모·P2·control과 다르면 반환하지 않는다',async()=>{
 for(const change of [(d:any)=>d.requestRef=ref(91),(d:any)=>d.policyRef=ref(91),(d:any)=>d.controlGeneration=2]){const v=currentStoredView(),c=await prepareApprovalDecision(pid,v,'APPROVE','원 요청 명시 판단',session,1),q=decisionReplies({mutate:r=>{change(r.data.decision);const{id:decisionId,decidedAt,...body}=r.data.decision;r.data.ref.contentHash=hash(body);}});
  await assert.rejects(sendOriginReuseDecision(new ApiClient(q.transport),v,c,session,()=>true),{code:'RESPONSE_INVALID'});assert.equal(q.bodies.length,1);
 }
});
test('실제 Page의 UNKNOWN은 원 packet을 보존하고 명시 같은 결과확인만 POST한다',async()=>{
 const q=decisionReplies({lost:true}),m=await mounted(q.transport);try{await m.wait(()=>m.container.textContent.includes('PENDING 요청 보관'));await m.click('이 요청 결정 준비');await m.fillDecision('원 요청 명시 판단');await m.click('이번만 승인');await m.wait(()=>m.buffer?.decision?.uncertain===true);const packet=structuredClone(m.buffer.decision.pending),body=q.bodies[0];assert.equal(q.bodies.length,1);assert.equal(q.stored,1);assert.equal(m.buffer.decision.resultId,null);
  await m.lookup();await m.wait(()=>m.container.textContent.includes('명시 결정 보관'));assert.deepEqual(m.buffer.decision.pending,packet);assert.equal(q.bodies.length,1);
  await m.click('같은 결정 명령 결과 확인');await m.wait(()=>m.buffer?.decision?.resultId===id(99));assert.equal(q.bodies.length,2);assert.equal(q.bodies[1],body);assert.deepEqual(m.buffer.decision.pending,packet);assert.equal(q.stored,1);assert.equal(m.buffer.decision.uncertain,false);
 }finally{await m.close();}
});
test('현재 control 충돌은 POST0이고 실제 403·위조응답은 원 결정 packet을 보존한다',async()=>{
 for(const mode of ['control','deny','parent']){const q=decisionReplies(mode==='control'?{generation:2}:mode==='deny'?{deny:true}:{mutate:r=>{r.data.decision.requestRef=ref(95);const{id:decisionId,decidedAt,...body}=r.data.decision;r.data.ref.contentHash=hash(body);}}),m=await mounted(q.transport);try{await m.wait(()=>m.container.textContent.includes('PENDING 요청 보관'));await m.click('이 요청 결정 준비');await m.fillDecision('원 요청 명시 판단');await m.click('이번만 승인');await m.wait(()=>!!m.buffer?.decision?.failure);assert.equal(m.buffer.decision.resultId,null);assert.equal(q.bodies.length,mode==='control'?0:1);assert.equal(m.buffer.decision.failure.code,mode==='control'?'APPROVAL_DECIDER_DENIED':mode==='deny'?'PROJECT_OPERATION_DENIED':'RESPONSE_INVALID');assert.equal(m.buffer.decision.uncertain,mode==='parent');if(mode!=='control')assert.equal(JSON.stringify(m.buffer.decision.pending),q.bodies[0]);assert(!m.container.textContent.includes('결정 저장 영수증'));}finally{await m.close();}}
});
test('결정 영수증 뒤 보호 GET403은 본문을 숨기고 원 receipt·packet과 POST1을 유지한다',async()=>{
 const options={denyReadAfterPost:true},q=decisionReplies(options),m=await mounted(q.transport);try{await m.wait(()=>m.container.textContent.includes('PENDING 요청 보관'));await m.click('이 요청 결정 준비');await m.fillDecision('원 요청 명시 판단');await m.click('거절');await m.wait(()=>m.buffer?.decision?.resultId===id(99)&&m.container.textContent.includes('ACCESS_DENIED'));assert(m.container.textContent.includes('결정 저장 영수증'));assert(!m.container.textContent.includes('보관 요청 원문'));const packet=structuredClone(m.buffer.decision.pending);assert.equal(q.bodies.length,1);options.denyReadAfterPost=false;await m.lookup();await m.wait(()=>m.container.textContent.includes('명시 결정 보관'));assert.deepEqual(m.buffer.decision.pending,packet);assert.equal(q.bodies.length,1);}finally{await m.close();}
});
test('결정 control 대기 중 scope 이탈의 늦은 성공·401은 POST와 새 owner callback0',async()=>{
 for(const change of ['user','client','transport','project','id'])for(const controlStatus of [0,401]){let release!:()=>void;const hold=new Promise<void>(r=>release=r),q=decisionReplies({holdControl:()=>hold,controlStatus}),m=await mounted(q.transport);try{await m.wait(()=>m.container.textContent.includes('PENDING 요청 보관'));await m.click('이 요청 결정 준비');await m.fillDecision('원 요청 명시 판단');await m.click('이번만 승인');await m.wait(()=>q.controls===1);if(change==='user')m.props.session.user.id=id(80);if(change==='client')m.props.session.clientId=id(80);if(change==='transport')m.props.client.transport=replies(storedView(),{status:403}).transport;if(change==='project')m.props.projectId=id(80);if(change==='id')m.props.requestId=id(80);await m.render();await m.flush();const changes=m.changes,auth=m.authLost;await ui.React.act(async()=>release());await m.flush();assert.equal(q.bodies.length,0,change);assert.equal(m.changes,changes,change);assert.equal(m.authLost,auth,change);assert(!m.container.textContent.includes('결정 저장 영수증'));}finally{release();await m.close();}}
});
test('결정 POST 뒤 scope 이탈은 이미 보낸 packet을 재전송·새 scope에 인계하지 않는다',async()=>{
 for(const change of ['client','transport','project','id']){let release!:()=>void;const hold=new Promise<void>(r=>release=r),q=decisionReplies({holdPost:()=>hold}),m=await mounted(q.transport);try{await m.wait(()=>m.container.textContent.includes('PENDING 요청 보관'));await m.click('이 요청 결정 준비');await m.fillDecision('원 요청 명시 판단');await m.click('이번만 승인');await m.wait(()=>q.bodies.length===1&&!!m.buffer?.decision?.pending);const packet=structuredClone(m.buffer.decision.pending);if(change==='client')m.props.session.clientId=id(80);if(change==='transport')m.props.client.transport=replies(storedView(),{status:403}).transport;if(change==='project')m.props.projectId=id(80);if(change==='id')m.props.requestId=id(80);await m.render();await m.flush();const changes=m.changes;await ui.React.act(async()=>release());await m.flush();assert.equal(m.changes,changes);assert.deepEqual(m.buffer.decision.pending,packet);assert.equal(m.buffer.decision.resultId,null);assert.equal(q.bodies.length,1);assert(!m.container.textContent.includes('명시 결정 보관'));assert(!m.container.textContent.includes('결정 저장 영수증'));}finally{release();await m.close();}}
});

test('결정 준비·응답 hash 대기 중 scope 교체는 늦은 packet/영수증을 새 owner에게 쓰지 않는다',async()=>{
 for(const phase of ['prepare','response']){const q=decisionReplies(),m=await mounted(q.transport);let release!:()=>void;const hold=new Promise<void>(r=>release=r),subtle=crypto.subtle,descriptor=Object.getOwnPropertyDescriptor(subtle,'digest'),digest=subtle.digest;let entered=false;
  try{await m.wait(()=>m.container.textContent.includes('PENDING 요청 보관'));await m.click('이 요청 결정 준비');await m.fillDecision('원 요청 명시 판단');
   Object.defineProperty(subtle,'digest',{configurable:true,value:async(...args:any[])=>{const result=await Reflect.apply(digest,subtle,args);if(!entered&&(phase==='prepare'?q.bodies.length===0:q.bodies.length===1)){entered=true;await hold;}return result;}});
   await m.click('이번만 승인');await m.wait(()=>entered);if(phase==='prepare')m.props.session.clientId=id(80);else m.props.projectId=id(80);await m.render();await m.flush();const changes=m.changes,auth=m.authLost;await ui.React.act(async()=>release());await m.flush();assert.equal(q.bodies.length,phase==='prepare'?0:1);assert.equal(m.changes,changes);assert.equal(m.authLost,auth);assert.equal(m.buffer.decision.resultId,null);assert(!m.container.textContent.includes('결정 저장 영수증'));
  }finally{release?.();if(descriptor)Object.defineProperty(subtle,'digest',descriptor);else Reflect.deleteProperty(subtle,'digest');await m.close();}
 }
});
test('결정 POST 대기 중 언마운트 후에는 원 packet 외 추가 callback·POST0',async()=>{
 let release!:()=>void;const hold=new Promise<void>(r=>release=r),q=decisionReplies({holdPost:()=>hold}),m=await mounted(q.transport);let closed=false;
 try{await m.wait(()=>m.container.textContent.includes('PENDING 요청 보관'));await m.click('이 요청 결정 준비');await m.fillDecision('원 요청 명시 판단');await m.click('이번만 승인');await m.wait(()=>q.bodies.length===1&&!!m.buffer?.decision?.pending);const packet=structuredClone(m.buffer.decision.pending),changes=m.changes;await m.close();closed=true;await ui.React.act(async()=>release());await m.flush();assert.equal(m.changes,changes);assert.deepEqual(m.buffer.decision.pending,packet);assert.equal(q.bodies.length,1);}finally{release();if(!closed)await m.close();}
});

test('부모가 pending 선보존을 실제 거부·교체하면 같은 scope에서도 원 결정 POST0',async t=>{
 for(const mode of ['REJECT_PENDING','REPLACE_PENDING'] as const)await t.test(mode,async()=>{
  const q=decisionReplies(),m=await mounted(q.transport,structuredClone(session),null,mode);try{await m.wait(()=>m.container.textContent.includes('PENDING 요청 보관'));await m.click('이 요청 결정 준비');await m.fillDecision('원 요청 명시 판단');await m.click('이번만 승인');await m.wait(()=>q.controls===1&&!m.busy());
   assert.equal(q.bodies.length,0,'부모에 원 pending commit이 없으면 POST0');assert.equal(m.buffer.decision.pending,null);assert.equal(m.buffer.decision.reason,mode==='REPLACE_PENDING'?'부모의 별도 판단':'원 요청 명시 판단');assert.equal(m.buffer.decision.resultId,null);assert(!m.container.textContent.includes('결정 저장 영수증'));
  }finally{await m.close();}
 });
});
test('control 대기 중 부모 work 삭제도 원 readScope가 같더라도 결정 진행을 중단한다',async()=>{
 let release!:()=>void;const hold=new Promise<void>(r=>release=r),q=decisionReplies({holdControl:()=>hold}),m=await mounted(q.transport);
 try{await m.wait(()=>m.container.textContent.includes('PENDING 요청 보관'));await m.click('이 요청 결정 준비');await m.fillDecision('원 요청 명시 판단');await m.click('이번만 승인');await m.wait(()=>q.controls===1);await m.replaceDecision(null);await ui.React.act(async()=>release());await m.wait(()=>!m.busy());assert.equal(q.bodies.length,0);assert.equal(m.buffer.decision,null);assert(!m.container.textContent.includes('결정 저장 영수증'));}finally{release();await m.close();}
});
