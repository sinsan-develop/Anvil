import test,{before,after,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

/** 실제 ReactDOM의 요소/이벤트/effect를 실행하는 최소 메모리 DOM. 레이아웃·브라우저 보안·시각 검증은 아니다. */
function completion(signal:AbortSignal,diagnostic:()=>string){
 const pending=new Set<Promise<unknown>>(),observers=new Set<()=>void>();let revision=0,closed=false;
 const changed=()=>{revision++;for(const notify of [...observers])notify();};
 // 이 fixture의 원 response gate와 hash promise만 수거한다.
 const tracked=<T,>(work:()=>Promise<T>):Promise<T>=>{const task=work();pending.add(task);return task.finally(()=>{pending.delete(task);changed();});};
 const subtle=crypto.subtle,digest=subtle.digest,descriptor=Object.getOwnPropertyDescriptor(subtle,'digest');
 Object.defineProperty(subtle,'digest',{configurable:true,value:(algorithm:AlgorithmIdentifier,data:BufferSource)=>tracked(()=>Reflect.apply(digest,subtle,[algorithm,data]))});
 return{changed,tracked,close:()=>{if(closed)return;closed=true;if(descriptor)Object.defineProperty(subtle,'digest',descriptor);else Reflect.deleteProperty(subtle,'digest');changed();},
  settle:()=>ui.React.act(async()=>{while(pending.size)await Promise.allSettled([...pending]);}),async wait(check:()=>boolean){
   while(true){
    if(closed)throw Error(diagnostic());
    const seen=revision;await ui.React.act(async()=>{});if(check())return;
    if(revision!==seen)continue;
    // 통지는 act 밖에서 기다려 React commit과 상호 대기하지 않는다.
    await new Promise<void>((resolve,reject)=>{
     const cleanup=()=>{observers.delete(notify);signal.removeEventListener('abort',abort);},notify=()=>{cleanup();resolve();},abort=()=>{cleanup();reject(Error(diagnostic()));};
     if(signal.aborted){abort();return;}observers.add(notify);signal.addEventListener('abort',abort,{once:true});
    });
   }
  }
 };
}
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
const saved=new Map<string,PropertyDescriptor|undefined>();let ui:any,uiCode:string;
const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
before(async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/knowledge/KnowledgeDecisionForm.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:scope-boundary',name:'ScopeBoundaryTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'scope-boundary-memory',resolveId(id){if(id.endsWith('virtual:scope-boundary'))return '\0scope-boundary';},load(id){if(id==='\0scope-boundary')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{KnowledgeDecisionForm}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};import{newKnowledge}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/knowledge/api.ts',import.meta.url)))};export{React,createRoot,KnowledgeDecisionForm,ApiClient,newKnowledge};export{App}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/App.tsx',import.meta.url)))};export * as decisions from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/knowledge/decision-api.ts',import.meta.url)))};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const [key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 uiCode=(Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return ScopeBoundaryTest;';ui=new Function(uiCode)();
});
after(()=>{for(const channel of channels){channel.port1.close();channel.port2.close();}for(const[key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});

const id=(n:number)=>`ab100031-0000-4000-8000-${String(n).padStart(12,'0')}`,pid=id(1),uid=id(2),cid=id(3),at='2026-10-31T00:00:00.000Z';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const session={user:{id:uid},clientId:cid,csrfToken:'c'.repeat(43)};
function draft(){
 const body='보존할 헌법',entry={kind:'CONSTITUTION',title:'소유 원칙',contentRef:{artifactId:id(4),bytes:Buffer.byteLength(body),contentHash:contentHash(body),mediaType:'text/plain;charset=utf-8'},sourceRefs:[],reason:'원칙',scope:{projectId:pid,stageRefs:[],taskRefs:[]},relatedRefs:[]},ref={id:id(5),version:1,contentHash:hash(entry)};
 const criteria={criteriaVersion:1,knowledgeKind:'CONSTITUTION',items:['KNOWLEDGE_PURPOSE','KNOWLEDGE_SOURCE','KNOWLEDGE_REASON','KNOWLEDGE_SCOPE','KNOWLEDGE_LIMITS'].map(criterionId=>({criterionId,title:criterionId}))};
 const review={ref:{id:id(6),targetRef:ref,criteriaVersion:1,outcome:'ACCEPTED'},criteria,items:criteria.items.map(i=>({criterionId:i.criterionId,outcome:'ACCEPTED',reason:'확인',evidenceRefs:[]})),reviewer:{kind:'HUMAN',userId:uid,sameAsTargetRecorder:true},sourceKind:'HUMAN_REVIEW',reason:'검토',reviewedAt:at,serverSequence:3};
 const confirmation={eventId:id(7),reviewRefs:[review.ref],reason:'확정',actorRef:{kind:'HUMAN',userId:uid},recordedAt:at};
 const target={ref,entry,body,state:'PROPOSED',headVersion:1,supersedesRef:null,confirmation:null,currentConfirmationValid:false,contentReviewCriteria:criteria,contentReviews:[review],appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',agentDelivery:'NOT_CONNECTED',history:[{id:id(8),kind:'PROPOSED',reason:entry.reason,actorRef:confirmation.actorRef,recordedAt:at}]};
 const b=ui.decisions.newKnowledgeDecision(pid,target,session,1,'CONFIRM');b.acknowledged=true;b.reason='원 확정 이유';return b;
}
function reviewDraft(outcome='ACCEPTED'){
 const target=structuredClone(draft().target),b=ui.decisions.newKnowledgeDecision(pid,target,session,1,'REVIEW');
 b.items=b.items.map((item:any,n:number)=>({...item,outcome,reason:`원 항목 ${n+1}`}));b.outcome=outcome;b.reason='원 검토 이유';return b;
}
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}
async function fixture(t:TestContext,initial:any=draft()){
 let buffer:any=initial,currentSession=structuredClone(session),visible=true,lost=0,changes=0,savedCount=0,stored:any;
 const writes:any[]=[],gets:string[]=[],pendingChanges:any[]=[],controls={read:async()=>Response.json(stored),control:async()=>Response.json({id:pid,participation:'OWNER',controlState:{actorId:uid,clientId:cid,generation:2,status:'HELD'}}),deferChange:false};
 const progress=completion(t.signal,()=>container.textContent+' / '+JSON.stringify({gets,writes:writes.length,savedCount}));t.after(progress.close);
 const transport=(path:string,init:any)=>progress.tracked(async()=>{
  if(init?.method==='POST'){
   const c=JSON.parse(init.body);writes.push(c);
   if(c.operation==='recordContentReview'){
    const review={ref:{id:id(20),targetRef:c.payload.targetRef,criteriaVersion:1,outcome:c.payload.outcome},criteria:structuredClone(buffer.target.contentReviewCriteria),items:structuredClone(c.payload.items),reviewer:{kind:'HUMAN',userId:uid,sameAsTargetRecorder:true},sourceKind:'HUMAN_REVIEW',reason:c.payload.reason,reviewedAt:at,serverSequence:4};
    stored={...structuredClone(buffer.target),contentReviews:[review,...structuredClone(buffer.target.contentReviews)]};
    return Response.json({operationId:id(9),commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:c.targetId,version:c.expectedVersion,data:{status:'REVIEW_RECORDED',ref:c.payload.targetRef,reviewRef:review.ref},serverReceivedAt:at});
   }
   const confirmation={eventId:id(7),reason:c.payload.reason,reviewRefs:c.payload.reviewRefs,actorRef:{kind:'HUMAN',userId:uid},recordedAt:at};
   stored={...structuredClone(buffer.target),state:'CONFIRMED',confirmation,currentConfirmationValid:true,history:[...structuredClone(buffer.target.history),{id:id(7),kind:'CONFIRMED',reason:confirmation.reason,reviewRefs:confirmation.reviewRefs,actorRef:confirmation.actorRef,recordedAt:at}]};
   return Response.json({operationId:id(9),commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:c.targetId,version:c.expectedVersion,data:{status:'CONFIRMED',eventId:id(7),confirmationId:id(7),reason:c.payload.reason,reviewRefs:c.payload.reviewRefs,ref:c.payload.versionRef},serverReceivedAt:at});
  }
  assert.equal(init.method,'GET');gets.push(path);if(path===`/api/v1/projects/${pid}`)return controls.control();return controls.read();
 });
 let client=new ui.ApiClient(transport);
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 const applyChange=(change:any)=>{changes++;buffer=typeof change==='function'?change(buffer):change;render();progress.changed();};
 function render(){root.render(visible&&buffer?ui.React.createElement(ui.KnowledgeDecisionForm,{client,session:currentSession,buffer,onChange:(change:any)=>{if(controls.deferChange)pendingChanges.push(change);else applyChange(change);},onSaved(){savedCount++;progress.changed();},onAuthenticationLost(){lost++;progress.changed();}}):null);}
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 const button=(name:string)=>{const b=nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===name);assert(b,name+' / '+container.textContent);return b;};
 const {settle,wait}=progress;
 const click=async(name:string)=>{const b=button(name);assert(!b.disabled);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));};
 await ui.React.act(async()=>render());
 return{writes,gets,controls,container,nodes,button,click,wait,settle,buffer:()=>buffer,stored:()=>stored,lost:()=>lost,changes:()=>changes,savedCount:()=>savedCount,client:()=>client,session:()=>currentSession,flushChange:async()=>{const change=pendingChanges.shift();assert(change);await ui.React.act(async()=>applyChange(change));},replace:async(b:any)=>{buffer=b;await ui.React.act(async()=>render());},context:async(s:any)=>{currentSession=s;await ui.React.act(async()=>render());},clientChange:async(c:any)=>{client=c;await ui.React.act(async()=>render());},render:async()=>{await ui.React.act(async()=>render());},route:async(show:boolean)=>{visible=show;await ui.React.act(async()=>render());},close:async()=>{try{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}finally{progress.close();}}};
}
async function save(f:Awaited<ReturnType<typeof fixture>>){await f.click(f.buffer().kind==='REVIEW'?'지식 검토 저장':'지식 확정 저장');await f.wait(()=>!!f.buffer()?.savedId);await f.settle();}
const open='저장된 지식 확정 사건 조회',detail='저장된 지식 확정 사건',reviewOpen='저장된 지식 검토 사건 조회',reviewDetail='저장된 지식 검토 사건';
test('저장한 REVIEW 영수증의 정확 사건을 명시 조회하고 기존 별도 확정 입력으로 선택한다',{timeout:15000},async t=>{
 const f=await fixture(t,reviewDraft());try{
  assert.equal(f.gets.length,0);await save(f);assert.equal(f.writes.length,1);assert.equal(f.gets.length,0);
  await f.click(reviewOpen);await f.wait(()=>f.nodes().some(n=>n.getAttribute('aria-label')===reviewDetail));
  assert.deepEqual(f.gets,[`/api/v1/projects/${pid}/knowledge/${id(5)}/versions/1`]);
  const panel=f.nodes().find(n=>n.getAttribute('aria-label')===reviewDetail)!;
  for(const value of [id(20),id(5),f.buffer().target.ref.contentHash,'원 검토 이유',uid,'원 항목 1','KNOWLEDGE_PURPOSE','ACCEPTED','근거 없음'])assert(panel.textContent.includes(value),value);
  await f.click('이 검토로 지식 별도 확정 준비');await f.wait(()=>f.buffer()?.kind==='CONFIRM');
  assert.deepEqual(f.gets,[`/api/v1/projects/${pid}/knowledge/${id(5)}/versions/1`,`/api/v1/projects/${pid}`]);
  assert.equal(f.buffer().savedId,null);assert.equal(f.buffer().target.contentReviews[0].ref.id,id(20));assert.equal(f.buffer().controlGeneration,2);assert.equal(f.writes.length,1);
 }finally{await f.close();}
});
test('과거·부적합 검토는 사건만 표시하고 부재·복수·변조·현재401은 fail closed다',{timeout:15000},async t=>{
 for(const mode of ['NOT_LATEST','SUPERSEDED','REWORK','ABSENT','DUPLICATE','ITEM','REASON','ACTOR','401']as const){
  const f=await fixture(t,reviewDraft(mode==='REWORK'?'REWORK':'ACCEPTED'));try{
   await save(f);const original=f.buffer(),view=structuredClone(f.stored()),saved=view.contentReviews[0];
   if(mode==='NOT_LATEST'){const newer=structuredClone(saved);newer.ref.id=id(30);newer.serverSequence=5;view.contentReviews.unshift(newer);}
   if(mode==='SUPERSEDED'){view.headVersion=2;view.state='SUPERSEDED';}
   if(mode==='ABSENT')view.contentReviews.shift();
   if(mode==='DUPLICATE'){const duplicate=structuredClone(saved);duplicate.serverSequence=3;view.contentReviews.push(duplicate);}
   if(mode==='ITEM')saved.items[0].reason='다른 항목 이유';
   if(mode==='REASON')saved.reason='다른 종합 이유';
   if(mode==='ACTOR')saved.reviewer.userId=id(31);
   f.controls.read=async()=>mode==='401'?Response.json({code:'AUTH_REQUIRED'},{status:401}):Response.json(view);
   await f.click(reviewOpen);
   if(['NOT_LATEST','SUPERSEDED','REWORK'].includes(mode)){await f.wait(()=>f.nodes().some(n=>n.getAttribute('aria-label')===reviewDetail));assert(!f.nodes().some(n=>n.textContent==='이 검토로 지식 별도 확정 준비'),mode);assert(f.container.textContent.includes('확인만 하며 확정 준비로 선택하지 않습니다.'),mode);}
   else{await f.wait(()=>f.container.textContent.includes('검토 사건 조회 미확인'));assert(!f.nodes().some(n=>n.getAttribute('aria-label')===reviewDetail),mode);}
   assert.equal(f.buffer(),original);assert.equal(f.writes.length,1);assert.equal(f.lost(),mode==='401'?1:0);
  }finally{await f.close();}
 }
});
test('검토 조회·제어권 재검산의 늦은 200/401과 문맥 ABA는 결과·인증·POST를 바꾸지 않는다',{timeout:15000},async t=>{
 for(const status of [200,401])for(const phase of ['READ','CONTROL']as const){
  const f=await fixture(t,reviewDraft()),late=deferred<Response>();try{
   await save(f);const original=f.buffer(),originalClient=f.client();
   if(phase==='READ'){f.controls.read=()=>late.promise;await f.click(reviewOpen);await f.wait(()=>f.gets.length===1);await f.replace({...original});await f.replace(original);}
   else{await f.click(reviewOpen);await f.wait(()=>f.nodes().some(n=>n.getAttribute('aria-label')===reviewDetail));f.controls.control=()=>late.promise;await f.click('이 검토로 지식 별도 확정 준비');await f.wait(()=>f.gets.length===2);const transport=originalClient.transport;originalClient.transport=async()=>{throw Error('unexpected');};await f.render();originalClient.transport=transport;await f.render();}
   late.resolve(status===200?(phase==='READ'?Response.json(f.stored()):Response.json({id:pid,participation:'OWNER',controlState:{actorId:uid,clientId:cid,generation:2,status:'HELD'}})):Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.settle();
   assert.equal(f.buffer(),original,phase);assert.equal(f.buffer().kind,'REVIEW');assert.equal(f.lost(),0);assert.equal(f.writes.length,1);assert(!f.nodes().some(n=>n.getAttribute('aria-label')===reviewDetail),phase);
  }finally{late.resolve(Response.json({}));await f.close();}
 }
});
test('검산된 REVIEW 선택은 부모의 지연 functional updater에서도 현재 문맥에 한 번만 인계된다',{timeout:15000},async t=>{
 const f=await fixture(t,reviewDraft());try{
  await save(f);await f.click(reviewOpen);await f.wait(()=>f.nodes().some(n=>n.getAttribute('aria-label')===reviewDetail));f.controls.deferChange=true;
  await f.click('이 검토로 지식 별도 확정 준비');await f.wait(()=>f.gets.length===2);await f.settle();assert.equal(f.buffer().kind,'REVIEW');
  await f.flushChange();assert.equal(f.buffer().kind,'CONFIRM');assert.equal(f.buffer().controlGeneration,2);assert.equal(f.writes.length,1);
 }finally{await f.close();}
});
test('실제 확정 POST 영수증 뒤 명시 고정 GET으로 같은 사건·이유·주체·선택 검토를 표시한다',{timeout:15000},async t=>{
 const f=await fixture(t);try{
  assert.equal(f.gets.length,0);assert(!f.nodes().some(n=>n.textContent===open));await save(f);assert.equal(f.writes.length,1);assert.equal(f.gets.length,0);
  const original=f.buffer(),before=JSON.stringify(original),changes=f.changes();await f.click(open);await f.wait(()=>f.nodes().some(n=>n.getAttribute('aria-label')===detail));
  assert.deepEqual(f.gets,[`/api/v1/projects/${pid}/knowledge/${original.target.ref.id}/versions/1`]);
  const panel=f.nodes().find(n=>n.getAttribute('aria-label')===detail)!;for(const value of [id(7),original.target.ref.id,original.target.ref.contentHash,'원 확정 이유',uid,id(6),at])assert(panel.textContent.includes(value),value);
  assert.equal(f.buffer(),original);assert.equal(JSON.stringify(original),before);assert.equal(f.changes(),changes);assert.equal(f.savedCount(),1);assert.equal(f.writes.length,1);assert(f.button('지식 확정 저장').disabled);
 }finally{await f.close();}
});
test('다른 사건·fullref·이유·주체·선택 검토는 원 reader와 영수증 대조에서 거절하며 재조회는 POST0이다',{timeout:15000},async t=>{
 for(const mode of ['ID','HASH','VERSION','REASON','ACTOR','REVIEW','ABSENT','401','403','404','CONNECTION']as const){
  const f=await fixture(t);try{
   await save(f);const original=f.buffer(),before=JSON.stringify(original),view=structuredClone(f.stored());
   const confirmation=view.confirmation,event=view.history[1];
   if(mode==='ID'){confirmation.eventId=id(40);event.id=id(40);}
   if(mode==='HASH')view.ref.contentHash='f'.repeat(64);
   if(mode==='VERSION')view.ref.version=2;
   if(mode==='REASON'){confirmation.reason='다른 이유';event.reason=confirmation.reason;}
   if(mode==='ACTOR'){confirmation.actorRef.userId=id(41);event.actorRef.userId=id(41);}
   if(mode==='REVIEW'){confirmation.reviewRefs[0].id=id(42);event.reviewRefs[0].id=id(42);view.currentConfirmationValid=false;}
   if(mode==='ABSENT'){view.confirmation=null;view.history.pop();view.state='PROPOSED';view.currentConfirmationValid=false;}
   f.controls.read=async()=>{if(mode==='CONNECTION')throw Error('PRIVATE_TRANSPORT');return ['401','403','404'].includes(mode)?Response.json({code:'ACCESS_DENIED',message:'PRIVATE_REASON'},{status:Number(mode)}):Response.json(view);};
   await f.click(open);await f.wait(()=>f.container.textContent.includes('확정 사건 조회 미확인'));
   assert(!f.nodes().some(n=>n.getAttribute('aria-label')===detail),mode);assert(f.container.textContent.includes('지식 확정 저장 확인'));assert(!f.container.textContent.includes('PRIVATE_'));assert.equal(f.lost(),mode==='401'?1:0);
   assert.equal(f.buffer(),original);assert.equal(JSON.stringify(original),before);assert(!f.button(open).disabled);assert.equal(f.writes.length,1);
   f.controls.read=async()=>Response.json(f.stored());await f.click(open);await f.wait(()=>f.nodes().some(n=>n.getAttribute('aria-label')===detail));assert.equal(f.gets.length,2);assert.equal(f.writes.length,1);assert.equal(JSON.stringify(original),before);
  }finally{await f.close();}
 }
});
test('이후 제외·대체·새 검토가 있어도 당시 정확 확정 사건을 현재 권위로 바꾸지 않고 조회한다',{timeout:15000},async t=>{
 for(const mode of ['EXCLUDED','SUPERSEDED','REVIEW']as const){const f=await fixture(t);try{
  await save(f);const v=structuredClone(f.stored());v.currentConfirmationValid=false;
  if(mode==='EXCLUDED'){v.state=mode;v.history.push({id:id(43),kind:'EXCLUDED',reason:'이후 제외',actorRef:{kind:'HUMAN',userId:uid},recordedAt:at});}
  if(mode==='SUPERSEDED'){v.state=mode;v.headVersion=2;}
  if(mode==='REVIEW'){const review=structuredClone(v.contentReviews[0]);review.ref.id=id(44);review.serverSequence=4;v.contentReviews.unshift(review);}
  f.controls.read=async()=>Response.json(v);await f.click(open);await f.wait(()=>f.nodes().some(n=>n.getAttribute('aria-label')===detail));assert(f.container.textContent.includes('현재 유효성·헌법 적용·Agent 전달을 뜻하지 않습니다.'));assert.equal(f.writes.length,1);
 }finally{await f.close();}}
});
test('같은 배치 중복 클릭 GET1·닫기와 재조회가 이전 결과를 숨기고 원 저장 입력은 보존한다',{timeout:15000},async t=>{
 const f=await fixture(t),late=deferred<Response>();try{
  await save(f);const original=f.buffer(),before=JSON.stringify(original);f.controls.read=()=>late.promise;
  const b=f.button(open);await ui.React.act(async()=>{b.dispatchEvent({type:'click',button:0});b.dispatchEvent({type:'click',button:0});});await f.wait(()=>f.gets.length===1);assert(f.button(open).disabled);
  await f.click('확정 사건 조회 닫기');late.resolve(Response.json(f.stored()));await f.settle();assert(!f.nodes().some(n=>n.getAttribute('aria-label')===detail));
  f.controls.read=async()=>Response.json(f.stored());await f.click(open);await f.wait(()=>f.nodes().some(n=>n.getAttribute('aria-label')===detail));
  const next=deferred<Response>();f.controls.read=()=>next.promise;await f.click(open);assert(!f.nodes().some(n=>n.getAttribute('aria-label')===detail));next.resolve(Response.json({code:'ACCESS_DENIED'},{status:403}));await f.wait(()=>f.container.textContent.includes('확정 사건 조회 미확인'));
  assert.equal(f.buffer(),original);assert.equal(JSON.stringify(original),before);assert.equal(f.writes.length,1);
 }finally{late.resolve(Response.json({}));await f.close();}
});
test('프로젝트·주체·세션·client·transport·버퍼 전환/ABA와 이탈 뒤 늦은200/401은 폐기한다',{timeout:15000},async t=>{
 for(const status of [200,401])for(const mode of ['PROJECT','USER','SESSION','CLIENT_ID','CLIENT','TRANSPORT','BUFFER','CLOSE','UNMOUNT']as const){
  const f=await fixture(t),late=deferred<Response>();try{
   await save(f);const original=f.buffer(),originalSession=f.session(),originalClient=f.client();f.controls.read=()=>late.promise;await f.click(open);await f.wait(()=>f.gets.length===1);
   if(mode==='PROJECT'){await f.replace({...original,projectId:id(50)});await f.replace(original);}
   if(mode==='BUFFER'){await f.replace({...original});await f.replace(original);}
   if(mode==='USER'||mode==='SESSION'||mode==='CLIENT_ID'){await f.context({...originalSession,...(mode==='USER'?{user:{id:id(51)}}:mode==='SESSION'?{csrfToken:'d'.repeat(43)}:{clientId:id(52)})});await f.context(originalSession);}
   if(mode==='CLIENT'){await f.clientChange(new ui.ApiClient(async()=>{throw Error('unexpected');}));await f.clientChange(originalClient);}
   if(mode==='TRANSPORT'){const transport=originalClient.transport;originalClient.transport=async()=>{throw Error('unexpected');};await f.render();originalClient.transport=transport;await f.render();}
   if(mode==='CLOSE')await f.click('확정 사건 조회 닫기');
   if(mode==='UNMOUNT')await f.route(false);
   late.resolve(status===200?Response.json(f.stored()):Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.settle();
   assert.equal(f.lost(),0,mode);assert(!f.nodes().some(n=>n.getAttribute('aria-label')===detail),mode);assert(!f.container.textContent.includes('확정 사건 조회 미확인'),mode);assert.equal(f.writes.length,1);assert.equal(f.gets.length,1);
   if(mode!=='UNMOUNT')assert(!f.button(open).disabled,mode);
  }finally{late.resolve(Response.json({}));await f.close();}
 }
});
test('저장·소유·원 target 입력 부적격은 GET0이며 해시 검산 대기 중 교체도 GET0이다',{timeout:15000},async t=>{
 const f=await fixture(t);try{
  await save(f);const original=f.buffer();
  for(const patch of [{savedId:null},{pending:f.writes[0]},{uncertain:true},{dirty:true},{failure:{code:'RESPONSE_INVALID',status:0}},{kind:'REVIEW'},{ownerUserId:id(70)},{ownerClientId:id(71)},{target:{...original.target,ref:{...original.target.ref,contentHash:'f'.repeat(64)}}}]){
   await assert.rejects(()=>ui.decisions.readSavedKnowledgeConfirmation(f.client(),{...original,...patch},f.session(),()=>true));assert.equal(f.gets.length,0);
  }
  const subtle=crypto.subtle,descriptor=Object.getOwnPropertyDescriptor(subtle,'digest'),digest=subtle.digest,gate=deferred<void>(),entry=deferred<void>();let entered=false;
  Object.defineProperty(subtle,'digest',{configurable:true,value:async(...args:any[])=>{const value=await Reflect.apply(digest,subtle,args);if(!entered){entered=true;entry.resolve();await gate.promise;}return value;}});
  try{await f.click(open);await ui.React.act(async()=>entry.promise);assert.equal(entered,true);await f.replace({...original});gate.resolve();await f.settle();assert.equal(f.gets.length,0);assert.equal(f.writes.length,1);}
  finally{gate.resolve();if(descriptor)Object.defineProperty(subtle,'digest',descriptor);else Reflect.deleteProperty(subtle,'digest');}
 }finally{await f.close();}
});
