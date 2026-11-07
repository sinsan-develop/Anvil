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
 const base=fileURLToPath(new URL('../../../apps/web/src/',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:child',name:'ChildTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'child-memory',resolveId(id){if(id.endsWith('virtual:child'))return '\0child';},load(id){if(id==='\0child')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{WorkspaceAssignments}from${JSON.stringify(base+'/features/workspace/WorkspaceAssignments.tsx')};import{AssignmentContentDecision}from${JSON.stringify(base+'/features/workspace/AssignmentContentDecision.tsx')};import{ApiClient}from${JSON.stringify(base+'/api/client.ts')};import{newAssignmentDecision}from${JSON.stringify(base+'/features/workspace/assignment-confirmation-api.ts')};export{React,createRoot,WorkspaceAssignments,AssignmentContentDecision,ApiClient,newAssignmentDecision};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel,confirm:()=>true})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return ChildTest;')();
});
after(()=>{for(const channel of channels){channel.port1.close();channel.port2.close();}for(const[key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});

const pid='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',ref={id:pid,version:1,contentHash:'a'.repeat(64)},at='2026-10-18T01:40:00.000Z';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{resolve,promise};}
async function fixture(page=false,child=true){
 const definition:any={taskRef:{planRef:ref,taskCode:'FN01',applicationRef:ref,nodeId:'N1'},purpose:'하위 목적',goal:'하위 목표',baselineRefs:[ref],inputs:['입력'],outputs:['출력'],acceptanceCriteria:['완료'],verificationRequirements:['검증'],included:['개발'],excluded:['운영'],allowedScopes:[{sourceRootRef:ref,mappingRef:null,observationRef:ref,baselineRef:ref,targets:[{relativePath:'src/a.ts',kind:'FILE',access:'WRITE',recursive:false}]}],environmentRef:null,requiredCapabilities:['코드'],budgetRef:null,ownerRole:'책임자',parentAssignmentRef:child?ref:null,recordingPolicyRef:null,integrationResponsibility:'부모 통합'};
 const snapshot={definition,reason:'원형 준비',previousRef:null,basis:{planRef:ref,applicationRef:ref,designRef:ref,taskCode:'FN01',nodeId:'N1',taskCardHash:'b'.repeat(64)},readinessIssues:[],status:'DRAFT',ready:false,executionAuthorized:false,dispatchPerformed:false};
 const draft={projectId:pid,ref:{id,version:1,contentHash:hash(snapshot)},snapshot,headVersion:1,sourceCurrentness:'NOT_RECHECKED',observedAt:at};
 const session={user:{id:pid},clientId:pid,csrfToken:'C'.repeat(43)},calls:{path:string;method:string;body:any}[]=[],errors:any[]=[];
 const criteria=['PURPOSE_SCOPE','BASELINE_TASK','INPUT_OUTPUT','COMPLETION_VERIFICATION','BOUNDARIES','RECORD_RECOVERY'];
 const reviewSnapshot={draftRef:draft.ref,criteriaVersion:1,items:criteria.map(criterionId=>({criterionId,outcome:'ACCEPTED',reason:'검토 원문',evidenceRefs:[]})),outcome:'ACCEPTED',reason:'사람 검토',reviewedBy:{kind:'HUMAN',userId:pid},reviewedAt:at,independence:'NOT_CLAIMED'};
 const review={ref:{id:crypto.randomUUID(),version:1,contentHash:hash(reviewSnapshot)},snapshot:reviewSnapshot,serverSequence:1,sameAuthor:true};
 const cs={draftRef:draft.ref,definition,reviewRefs:[review.ref],reason:'내용만 확정',confirmedBy:{kind:'HUMAN',userId:pid},confirmedAt:at,contentConfirmed:true,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false};
 const confirmed={projectId:pid,ref:{id,version:1,contentHash:hash(cs)},snapshot:cs,observedAt:at};
 const decision={projectId:pid,draftRef:draft.ref,criteriaVersion:1,criteria,reviews:[review],hasMoreReviews:false,contentIssues:[],currentIssue:null,confirmedRef:confirmed.ref,latestReviewAccepted:true,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt:at};
 const controls={decision:async()=>Response.json(decision),confirmed:async()=>Response.json(confirmed),control:async()=>Response.json({id:pid,participation:'OWNER',controlState:{status:'HELD',actorId:pid,clientId:pid,generation:1}}),post:async(c:any)=>Response.json({operationId:crypto.randomUUID(),commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:confirmed.ref.id,version:1,data:{status:'ASSIGNMENT_CONTENT_CONFIRMED',ref:confirmed.ref,snapshot:cs,confirmationId:crypto.randomUUID()},evidenceRefs:[],warnings:[],serverReceivedAt:at})};
 const transport:typeof fetch=async(path,options)=>{const url=String(path),method=String(options?.method);calls.push({path:url,method,body:options?.body?JSON.parse(String(options.body)):null});if(method==='POST')return controls.post(calls.at(-1)!.body);if(url.endsWith('/decision'))return controls.decision();if(url.includes('/assignments/'))return controls.confirmed();if(url===`/api/v1/projects/${pid}`)return controls.control();if(url.includes('/assignment-drafts/'))return Response.json(draft);throw Error('UNMODELED_MEMORY_GET:'+url);};
 const client=new ui.ApiClient(transport),container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);let buffer:any=null;
 let props:any=page?{client,project:{id:pid,currentMethodologyRef:ref,participation:'OWNER',controlState:{status:'HELD',actorId:pid,clientId:pid}},session,stage:null,buffer:{bindingId:'outer',projectId:pid,ownerUserId:pid,ownerClientId:pid,controlGeneration:1,expectedDesignRef:ref,input:{baseRef:null,definition,reason:'원형 준비'},ref:draft.ref,result:draft,pending:null,uncertain:false,dirty:false,failure:null},onChange:(change:any)=>{props.buffer=typeof change==='function'?change(props.buffer):change;},onAuthenticationLost:()=>errors.push('AUTH')}: {client,session,draft,buffer:null,onChange:(change:any)=>{buffer=typeof change==='function'?change(buffer):change;props.buffer=buffer;void render();},contextBuffer:null,onContextChange:()=>{},responsibleBuffer:null,onResponsibleChange:()=>{},executionPreparationBuffer:null,onExecutionPreparationChange:()=>{},owner:true,busy:false,run:(action:()=>Promise<void>)=>{void action().catch(e=>errors.push(e));}};
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];const button=(label:string)=>{const a=nodes().filter(n=>n.tagName==='BUTTON'&&n.textContent===label);assert.equal(a.length,1,'버튼 '+label);return a[0]!;};
 async function render(next=props){props=next;await ui.React.act(async()=>root.render(ui.React.createElement(page?ui.WorkspaceAssignments:ui.AssignmentContentDecision,props)));}
 const click=async(label:string)=>{const b=button(label);assert(!b.disabled);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const settle=async()=>{await ui.React.act(async()=>{await new Promise(r=>setTimeout(r,15));});};
 const waitFor=async(check:()=>boolean)=>{const end=Date.now()+2000;while(!check()&&Date.now()<end)await ui.React.act(async()=>{await new Promise(r=>setTimeout(r,2));});assert(check(),container.textContent+' ERR '+errors.map(e=>e.code??e));};
 const edit=async(n:MemoryNode,value:any)=>{const key=Object.keys(n).find(k=>k.startsWith('__reactProps'));assert(key);const props=(n as any)[key!];await ui.React.act(async()=>props.onChange({target:typeof value==='boolean'?{checked:value}:{value}}));};
 await render();return{edit,props:()=>props,render,client,calls,controls,errors,draft,decision,confirmed,session,button,click,nodes,settle,waitFor,text:()=>container.textContent,buffer:()=>buffer,seed:async(b:any)=>{buffer=b;await render({...props,buffer:b});},close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
test('실제 Workspace의 저장 child 원본에 HUMAN 내용 패널이 연결된다',async()=>{const f=await fixture(true);try{assert(f.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='임무 판단 이력 조회'),'하위 HUMAN 내용 패널 부재');assert.equal(f.calls.length,0);}finally{await f.close();}});

test('child 과거 확정 원문은 실제 decoder/hash를 거치며 후속 패널 GET/POST와 이동이 없다',async()=>{
 const f=await fixture();try{await f.click('확정 임무 원본 재조회');await f.waitFor(()=>f.text().includes('내용 확정 임무'));
 assert(f.text().includes('부모 현재성 재검사 전'));assert(f.text().includes(f.confirmed.ref.contentHash));
 assert(!f.nodes().some(n=>n.tagName==='A'&&n.textContent==='책임자·실행 상세'));
 assert.equal(f.calls.length,2);assert(f.calls.every(c=>c.method==='GET'&&(/decision$/.test(c.path)||c.path.includes('/assignments/'))));
 await f.click('임무 판단 원문 닫기');assert(!f.text().includes(f.confirmed.ref.contentHash));
 }finally{await f.close();}
});
test('느린 JSON/현재401·403/손상은 닫기·주체·버전·client·transport 변경 뒤 원문을 복구하지 않는다',async()=>{
 for(const change of ['CLOSE','USER','VERSION','PROJECT','CLIENT','TRANSPORT','ABA']){
 const f=await fixture(),gate=deferred<unknown>();let reached=false;try{f.controls.decision=async()=>{const r=Response.json({code:'AUTH_REQUIRED'},{status:401});r.json=()=>{reached=true;return gate.promise;};return r;};await f.click('임무 판단 이력 조회');assert(reached);
 const old=f.props();if(change==='CLOSE')await f.click('임무 판단 원문 닫기');
 if(change==='USER')await f.render({...old,session:{...old.session,user:{id}}});
 if(change==='VERSION')await f.render({...old,draft:{...old.draft,ref:{...old.draft.ref,version:2}}});
 if(change==='PROJECT')await f.render({...old,draft:{...old.draft,projectId:id}});
 if(change==='CLIENT')await f.render({...old,client:new ui.ApiClient(async()=>Response.json(f.decision))});
 if(change==='TRANSPORT'||change==='ABA'){const original=f.client.transport;f.client.transport=async()=>Response.json(f.decision);if(change==='ABA'){await f.render();f.client.transport=original;await f.render();}}
 gate.resolve({code:'AUTH_REQUIRED'});await f.settle();assert.equal(f.errors.length,0,change);assert(!f.text().includes('검토 원문'),change);
 }finally{gate.resolve({code:'AUTH_REQUIRED'});await f.close();}}
 for(const kind of ['401','403','HASH']){const f=await fixture();try{f.controls.decision=async()=>{if(kind!=='HASH')return Response.json({code:'AUTH_REQUIRED'},{status:Number(kind)});const v=structuredClone(f.decision);v.reviews[0]!.snapshot.reason='변조';return Response.json(v);};await f.click('임무 판단 이력 조회');await f.waitFor(()=>f.errors.length===1);assert(!f.text().includes('검토 원문'));}finally{await f.close();}}
});
test('native hash 반환 대기 중 무렌더 transport 교체와 닫기는 옛 원문을 폐기한다',async()=>{
 for(const kind of ['TRANSPORT','CLOSE']){const f=await fixture(),gate=deferred<void>(),subtle=crypto.subtle,original=subtle.digest,descriptor=Object.getOwnPropertyDescriptor(subtle,'digest');let reached=false;
 try{Object.defineProperty(subtle,'digest',{configurable:true,value:async(...args:any[])=>{const value=await Reflect.apply(original,subtle,args);reached=true;await gate.promise;return value;}});await f.click('임무 판단 이력 조회');await f.waitFor(()=>reached);if(kind==='CLOSE')await f.click('임무 판단 원문 닫기');else f.client.transport=async()=>Response.json(f.decision);gate.resolve();await f.settle();assert(!f.text().includes('검토 원문'));assert.equal(f.errors.length,0);
 }finally{gate.resolve();if(descriptor)Object.defineProperty(subtle,'digest',descriptor);else Reflect.deleteProperty(subtle,'digest');await f.close();}}
});
test('전송 뒤 응답 불명은 원 command/body를 보존하고 자동 재전송하지 않는다',async()=>{
 const f=await fixture(),gate=deferred<Response>();try{const b=ui.newAssignmentDecision(f.draft,f.session,1,'CONFIRM',[f.decision.reviews[0]!.ref]);b.input.reason='내용만 확정';b.acknowledged=true;await f.seed(b);
 f.controls.post=async()=>gate.promise;await f.click('임무 내용 판단 저장');await f.waitFor(()=>f.calls.some(c=>c.method==='POST'));const sent=structuredClone(f.calls.find(c=>c.method==='POST')!.body);
 assert.equal(f.buffer().pending.commandId,sent.commandId);assert.equal(f.buffer().uncertain,true);await f.render({...f.props(),owner:false});gate.resolve(Response.json({code:'OUTCOME_UNKNOWN'},{status:503}));await f.settle();assert.deepEqual(f.buffer().pending,sent);assert.equal(f.buffer().uncertain,true);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
 }finally{gate.resolve(Response.json({code:'OUTCOME_UNKNOWN'},{status:503}));await f.close();}
});

test('사람 검토 준비·입력·명시 저장과 별도 확정은 기존 API 및 보호 고정GET 후에만 성공한다',async()=>{
 const f=await fixture();try{
 const state:any={...f.decision,reviews:[],latestReviewAccepted:false,confirmedRef:null};f.controls.decision=async()=>Response.json(state);
 f.controls.post=async(c:any)=>{const review=c.operation==='reviewAssignmentContent',snapshot=review?{...c.payload,reviewedBy:{kind:'HUMAN',userId:pid},reviewedAt:at,independence:'NOT_CLAIMED'}:{draftRef:c.payload.draftRef,definition:f.draft.snapshot.definition,reviewRefs:c.payload.reviewRefs,reason:c.payload.reason,confirmedBy:{kind:'HUMAN',userId:pid},confirmedAt:at,contentConfirmed:true,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false};const reference={id:review?crypto.randomUUID():id,version:1,contentHash:hash(snapshot)};
 if(review){state.reviews=[{ref:reference,snapshot,serverSequence:1,sameAuthor:true}];state.latestReviewAccepted=true;}else{state.confirmedRef=reference;f.controls.confirmed=async()=>Response.json({projectId:pid,ref:reference,snapshot,observedAt:at});}
 return Response.json({operationId:crypto.randomUUID(),commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:reference.id,version:1,data:{status:review?'ASSIGNMENT_CONTENT_REVIEWED':'ASSIGNMENT_CONTENT_CONFIRMED',ref:reference,snapshot,...(!review?{confirmationId:crypto.randomUUID()}:{})},evidenceRefs:[],warnings:[],serverReceivedAt:at});};
 await f.click('임무 내용 검토 준비');await f.waitFor(()=>!!f.buffer());
 for(const n of f.nodes().filter(n=>n.tagName==='SELECT'))await f.edit(n,'ACCEPTED');
 for(const n of f.nodes().filter(n=>n.tagName==='TEXTAREA'))await f.edit(n,'사람이 직접 내용 확인');
 await f.edit(f.nodes().find(n=>n.tagName==='INPUT')!,true);
 await f.click('임무 내용 판단 저장');await f.waitFor(()=>f.text().includes('임무 내용 검토 저장 확인'));
 assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert.equal(f.buffer().uncertain,false);
 await f.click('임무 별도 확정 준비');await f.waitFor(()=>f.buffer().mode==='CONFIRM');
 for(const n of f.nodes().filter(n=>n.tagName==='TEXTAREA'))await f.edit(n,'사람 내용만 별도 확정');await f.edit(f.nodes().find(n=>n.tagName==='INPUT')!,true);
 await f.click('임무 내용 판단 저장');await f.waitFor(()=>f.text().includes('임무 내용 확정 저장 확인'));
 assert.equal(f.calls.filter(c=>c.method==='POST').length,2);assert(f.calls.at(-1)!.path.includes('/assignments/'));
 assert(f.calls.filter(c=>c.method==='POST').every(c=>['reviewAssignmentContent','confirmAssignment'].includes(c.body.operation)));assert.equal(f.errors.length,0);
 }finally{await f.close();}
});

test('확정 POST409/422는 원명령을 보존한 명시 수정만 열고 손상응답·성공뒤 GET실패는 불명이다',async()=>{
 for(const kind of ['409','422','MALFORMED','AFTER_GET']){const f=await fixture();try{const b=ui.newAssignmentDecision(f.draft,f.session,1,'CONFIRM',[f.decision.reviews[0]!.ref]);b.input.reason='내용만 확정';b.acknowledged=true;await f.seed(b);
 const post=f.controls.post;if(kind==='AFTER_GET')f.controls.confirmed=async()=>Response.json({code:'PROJECT_OPERATION_DENIED'},{status:403});else f.controls.post=async()=>kind==='MALFORMED'?new Response('broken',{status:409}):Response.json({code:kind==='409'?'VERSION_CONFLICT':'ASSIGNMENT_CONTENT_INCOMPLETE'},{status:Number(kind)});
 await f.click('임무 내용 판단 저장');await f.waitFor(()=>f.errors.length===1);assert(f.buffer().pending);const sent=f.calls.find(c=>c.method==='POST')!.body;assert.deepEqual(f.buffer().pending,sent);
 if(kind==='409'||kind==='422'){assert.equal(f.buffer().uncertain,false);await f.click('거절 임무 판단 확인 후 수정');assert.equal(f.buffer().pending,null);assert.equal(f.buffer().input.reason,'내용만 확정');}else assert.equal(f.buffer().uncertain,true);
 assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
 }finally{await f.close();}}
});

test('저장 전 control 대기 중 실제 client·transport·주체 ABA·원입력 변경은 POST0이다',async()=>{
 for(const kind of ['CLIENT','TRANSPORT','ABA','INPUT']){const f=await fixture(),gate=deferred<Response>();try{const b=ui.newAssignmentDecision(f.draft,f.session,1,'CONFIRM',[f.decision.reviews[0]!.ref]);b.input.reason='내용만 확정';b.acknowledged=true;await f.seed(b);const control=f.controls.control;f.controls.control=async()=>gate.promise;
 await f.click('임무 내용 판단 저장');await f.waitFor(()=>f.calls.some(c=>c.path===`/api/v1/projects/${pid}`));const props=f.props();
 if(kind==='CLIENT')await f.render({...props,client:new ui.ApiClient(async()=>Response.json(f.decision))});if(kind==='TRANSPORT')f.client.transport=async()=>Response.json(f.decision);
 if(kind==='ABA'){await f.render({...props,session:{...props.session,user:{id}}});await f.render(props);}
 if(kind==='INPUT'){const changed=structuredClone(f.buffer());changed.input.reason='대기 중 새 입력';await f.seed(changed);}
 gate.resolve(await control());await f.settle();assert.equal(f.calls.filter(c=>c.method==='POST').length,0,kind);assert.equal(f.buffer().pending,null);if(kind==='INPUT')assert.equal(f.buffer().input.reason,'대기 중 새 입력');assert.equal(f.errors.length,0);
 }finally{gate.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.close();}}
});
test('기존 root 원문은 실행상세 이동과 기존 후속 패널을 보존한다',async()=>{
 const f=await fixture(false,false);try{await f.click('확정 임무 원본 재조회');await f.waitFor(()=>f.text().includes('내용 확정 임무'));assert(f.nodes().some(n=>n.tagName==='A'&&n.textContent==='책임자·실행 상세'));assert(!f.text().includes('부모 현재성 재검사 전'));assert.equal(f.calls.filter(c=>c.method==='POST').length,0);}finally{await f.close();}
});
