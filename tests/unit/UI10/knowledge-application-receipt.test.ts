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
const saved=new Map<string,PropertyDescriptor|undefined>();let ui:any,uiCode:string;
const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
before(async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/knowledge/KnowledgePage.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:scope-boundary',name:'ScopeBoundaryTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'scope-boundary-memory',resolveId(id){if(id.endsWith('virtual:scope-boundary'))return '\0scope-boundary';},load(id){if(id==='\0scope-boundary')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{KnowledgePage}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};import{newKnowledge}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/knowledge/api.ts',import.meta.url)))};export{React,createRoot,KnowledgePage,ApiClient,newKnowledge};export{App}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/App.tsx',import.meta.url)))};export * as decisions from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/knowledge/decision-api.ts',import.meta.url)))};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const [key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 uiCode=(Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return ScopeBoundaryTest;';ui=new Function(uiCode)();
});
after(()=>{for(const channel of channels){channel.port1.close();channel.port2.close();}for(const[key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});

const id=(n:number)=>`ab100031-0000-4000-8000-${String(n).padStart(12,'0')}`,pid=id(1),uid=id(2),cid=id(3),at='2026-10-31T00:00:00.000Z';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const session={user:{id:uid},clientId:cid,csrfToken:'c'.repeat(43)};
function draft(base=0){
 const body='보존할 헌법',entry={kind:'CONSTITUTION',title:'소유 원칙',contentRef:{artifactId:id(4),bytes:Buffer.byteLength(body),contentHash:contentHash(body),mediaType:'text/plain;charset=utf-8'},sourceRefs:[],reason:'원칙',scope:{projectId:pid,stageRefs:[],taskRefs:[]},relatedRefs:[]},ref={id:id(5),version:1,contentHash:hash(entry)};
 const criteria={criteriaVersion:1,knowledgeKind:'CONSTITUTION',items:['KNOWLEDGE_PURPOSE','KNOWLEDGE_SOURCE','KNOWLEDGE_REASON','KNOWLEDGE_SCOPE','KNOWLEDGE_LIMITS'].map(criterionId=>({criterionId,title:criterionId}))};
 const review={ref:{id:id(6),targetRef:ref,criteriaVersion:1,outcome:'ACCEPTED'},criteria,items:criteria.items.map(i=>({criterionId:i.criterionId,outcome:'ACCEPTED',reason:'확인',evidenceRefs:[]})),reviewer:{kind:'HUMAN',userId:uid,sameAsTargetRecorder:true},sourceKind:'HUMAN_REVIEW',reason:'검토',reviewedAt:at,serverSequence:3};
 const confirmation={eventId:id(7),reviewRefs:[review.ref],reason:'확정',actorRef:{kind:'HUMAN',userId:uid},recordedAt:at};
 const target={ref,entry,body,state:'CONFIRMED',headVersion:1,supersedesRef:null,confirmation,currentConfirmationValid:true,contentReviewCriteria:criteria,contentReviews:[review],appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',agentDelivery:'NOT_CONNECTED',history:[{id:id(8),kind:'PROPOSED',reason:entry.reason,actorRef:confirmation.actorRef,recordedAt:at},{id:confirmation.eventId,kind:'CONFIRMED',reason:confirmation.reason,actorRef:confirmation.actorRef,reviewRefs:confirmation.reviewRefs,recordedAt:at}]};
 const b=ui.decisions.newKnowledgeDecision(pid,target,session,1,'APPLY');b.applicationBaseRef=base?{id:pid,version:base,contentHash:'a'.repeat(64)}:null;b.acknowledged=true;b.reason='원 헌법 적용';return b;
}
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}
async function fixture(){
 let store:any={buffers:{[pid]:draft()},applications:{},scope:null},scope={},shown=true,currentSession=session,currentProject=pid,lost=0,changes=0,constitution:any=null,hold:ReturnType<typeof deferred<Response>>|null=null,fail=false;
 const writes:any[]=[],packets:{body:string;key:string|null}[]=[],gets:string[]=[],receipts:any[]=[],records:any[]=[],responses:Response[]=[];
 let deferChanges=false;const queued:(()=>void)[]=[];
 const client=new ui.ApiClient(async(path:string,init:any)=>{
  if(init?.method==='POST'){
   const c=JSON.parse(init.body);writes.push(c);packets.push({body:String(init.body),key:new Headers(init.headers).get('Idempotency-Key')});
   const b=store.buffers[pid];assert.deepEqual(b.pending,c,'원 POST 전에 부모가 exact pending 명령을 실제 보관');const application={projectId:pid,...c.payload,reviewRef:b.target.contentReviews[0].ref,previousApplicationRef:b.applicationBaseRef,appliedBy:{kind:'HUMAN',userId:uid,clientId:cid},controlGeneration:1},ref={id:pid,version:c.expectedVersion+1,contentHash:hash(application)};receipts.push(ref);records.push({ref,application,appliedAt:at});
   const response=Response.json({operationId:id(9),commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:pid,version:ref.version,data:{status:'CONSTITUTION_APPLIED',ref,application},serverReceivedAt:at});responses.push(response);
   if(hold){const wait=hold;hold=null;return wait.promise;}if(fail){fail=false;throw Error('transport');}return response;
  }
  gets.push(path);
  if(path.includes('/constitution?'))return Response.json(constitution??{current:null,history:[],hasMore:false,nextBeforeVersion:null,agentDelivery:'NOT_CONNECTED',compliance:'NOT_ASSESSED',observedAt:at});
  if(path.includes('/knowledge?'))return Response.json({items:[],hasMore:false,nextCursor:null,searchScope:'TITLE_REASON',observedAt:at});
  if(path.includes('/conversations?'))return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:at});
  throw Error('unexpected '+path);
 });
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 function render(){const captured=scope,s=currentSession,p=currentProject;root.render(shown?ui.React.createElement(ui.KnowledgePage,{client,projectId:p,session:s,buffer:null,onChange(){},conversationBuffer:null,onConversationChange(){},exclusion:null,onExclusionChange(){},correction:null,onCorrectionChange(){},decision:store.buffers[p]??null,applicationReceiptRef:store.scope===scope?store.applications[p]:undefined,onDecisionChange:(change:any)=>{changes++;const apply=()=>{if(scope!==captured)return;store=ui.decisions.changeKnowledgeDecisionStore?ui.decisions.changeKnowledgeDecisionStore(store,p,s,scope,change):{...store,buffers:{...store.buffers,[p]:typeof change==='function'?change(store.buffers[p]??null):change}};render();};if(deferChanges)queued.push(apply);else apply();},onAuthenticationLost(){lost++;}}):null);}
 const nodes=(predicate:(n:MemoryNode)=>boolean)=>{const all:MemoryNode[]=[];function visit(n:MemoryNode){if(predicate(n))all.push(n);n.childNodes.forEach(visit);}visit(container);return all;};
 const button=(name:string)=>{const b=nodes(n=>n.tagName==='BUTTON'&&n.textContent===name)[0];assert(b,name+' / '+container.textContent);return b;};
 const settle=()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});
 const wait=async(check:()=>boolean)=>{for(let n=0;n<100&&!check();n++)await settle();assert(check(),container.textContent);};
 const click=async(name:string)=>{const b=button(name);assert(!b.disabled);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));};
 await ui.React.act(async()=>render());
 return{client,writes,packets,gets,receipts,records,responses,defer:()=>{deferChanges=true;},flush:async()=>{deferChanges=false;await ui.React.act(async()=>{for(const apply of queued.splice(0))apply();});},setConstitution:(v:any)=>{constitution=v;},button,click,wait,settle,container,store:()=>store,lost:()=>lost,changes:()=>changes,fail:()=>{fail=true;},hold:()=>{hold=deferred<Response>();return hold;},replace:async(b:any)=>{store={...store,buffers:{...store.buffers,[pid]:b}};await ui.React.act(async()=>render());},route:async(show:boolean)=>{shown=show;await ui.React.act(async()=>render());},context:async(s=session,p=pid)=>{if(s!==currentSession)scope={};currentSession=s;currentProject=p;await ui.React.act(async()=>render());},close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
test('APPLY 검산 fullref는 닫기와 화면 왕복 후 보존되어 현재 없음 GET을 거절한다',async()=>{
 const f=await fixture();try{await f.click('헌법 프로젝트 적용');await f.wait(()=>!!f.store().buffers[pid]?.savedId);
  assert.deepEqual(f.store().buffers[pid].applicationReceipt?.ref,f.receipts[0]);
  await f.click('지식 판단 닫기');assert.equal(f.store().buffers[pid],null);await f.route(false);await f.route(true);
  assert(f.container.textContent.includes('적용 영수증 · 세대 1'));assert.equal(f.gets.filter(p=>p.includes('/constitution?')).length,0);
  await f.click('프로젝트 헌법 조회');await f.wait(()=>f.container.textContent.includes('CONSTITUTION_CURRENT_UNCONFIRMED'));assert.equal(f.writes.length,1);
 }finally{await f.close();}
});
test('다음 적용의 더 높은 영수증은 이전 성공 버퍼 재반영으로 강등되지 않는다',async()=>{
 const f=await fixture();try{await f.click('헌법 프로젝트 적용');await f.wait(()=>!!f.store().buffers[pid]?.savedId);const old=f.store().buffers[pid];
  await f.click('지식 판단 닫기');await f.replace(draft(1));await f.click('헌법 프로젝트 적용');await f.wait(()=>f.store().applications[pid]?.version===2);
  assert.equal(f.writes[1].expectedVersion,1);assert.notDeepEqual(f.receipts[0],f.receipts[1]);
  const state=f.store(),merged=ui.decisions.changeKnowledgeDecisionStore(state,pid,session,state.scope,old);assert.deepEqual(merged.applications[pid],f.receipts[1]);
  await f.click('지식 판단 닫기');await f.route(false);await f.route(true);assert(f.container.textContent.includes('적용 영수증 · 세대 2'));assert.equal(f.writes.length,2);
 }finally{await f.close();}
});
test('프로젝트 왕복은 원 영수증만 복원하고 세션 변경은 이전 영수증을 노출하지 않는다',async()=>{
 const f=await fixture();try{await f.click('헌법 프로젝트 적용');await f.wait(()=>!!f.store().buffers[pid]?.savedId);await f.click('지식 판단 닫기');
  await f.context(session,id(40));assert(!f.container.textContent.includes('적용 영수증'));await f.context();assert(f.container.textContent.includes('적용 영수증 · 세대 1'));
  await f.context({...session,csrfToken:'d'.repeat(43)});assert(!f.container.textContent.includes('적용 영수증'));await f.route(false);await f.route(true);assert(!f.container.textContent.includes('적용 영수증'));assert.equal(f.writes.length,1);
 }finally{await f.close();}
});
test('원 POST 불명은 왕복 뒤 자동 재전송 없이 같은 명령만 명시 재확인한다',async()=>{
 const f=await fixture();try{f.fail();await f.click('헌법 프로젝트 적용');await f.wait(()=>f.store().buffers[pid]?.uncertain);const pending=structuredClone(f.store().buffers[pid].pending);
  assert.deepEqual(f.store().applications,{});await f.route(false);await f.route(true);assert.equal(f.writes.length,1);assert.deepEqual(f.store().buffers[pid].pending,pending);
  await f.click('같은 지식 판단 명령 결과 확인');await f.wait(()=>!!f.store().buffers[pid]?.savedId);assert.deepEqual(f.writes[0],f.writes[1]);assert.deepEqual(f.store().applications[pid],f.receipts[1]);assert.equal(f.writes.length,2);
 }finally{await f.close();}
});
test('교체한 새 적용 버퍼에 늦은 이전 성공이 영수증·저장상태를 덮지 않는다',async()=>{
 const f=await fixture(),late=f.hold();try{await f.click('헌법 프로젝트 적용');await f.wait(()=>f.writes.length===1);const replacement=draft(1);await f.replace(replacement);
  const before=f.changes();late.resolve(f.responses[0]!);await f.wait(()=>f.changes()>before);assert.equal(f.store().buffers[pid],replacement);assert.deepEqual(f.store().applications,{});assert(!f.container.textContent.includes('적용 영수증'));assert.equal(f.writes.length,1);
 }finally{late.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.close();}
});
test('왕복 뒤 같은 명령의 새 dispatch가 진행 중이면 이전 성공은 확정하지 않는다',async()=>{
 const f=await fixture(),old=f.hold();try{await f.click('헌법 프로젝트 적용');await f.wait(()=>f.writes.length===1);await f.route(false);await f.route(true);const current=f.hold();
  await f.click('같은 지식 판단 명령 결과 확인');await f.wait(()=>f.writes.length===2);assert.deepEqual(f.writes[0],f.writes[1]);const owned=f.store().buffers[pid];
  const before=f.changes();old.resolve(f.responses[0]!);await f.wait(()=>f.changes()>before);assert.equal(f.store().buffers[pid],owned);assert.equal(owned.savedId,null);assert.deepEqual(f.store().applications,{});
  current.resolve(f.responses[1]!);await f.wait(()=>!!f.store().buffers[pid]?.savedId);assert.deepEqual(f.store().applications[pid],f.receipts[1]);
 }finally{await f.close();}
});
for(const mode of ['이탈','세션','버퍼']as const)test(`늦은401 ${mode} 뒤 새 인증·영수증을 변경하지 않는다`,async()=>{
 const f=await fixture(),late=f.hold();try{await f.click('헌법 프로젝트 적용');await f.wait(()=>f.writes.length===1);
  if(mode==='이탈')await f.route(false);else if(mode==='세션')await f.context({...session,csrfToken:'d'.repeat(43)});else await f.replace(draft(1));
  late.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.settle();await f.settle();assert.equal(f.lost(),0);assert.deepEqual(f.store().applications,{});assert.equal(f.writes.length,1);
 }finally{await f.close();}
});
test('인증 세대 A→B→A 뒤 이전401은 부모 CAS와 별개인 인증소실도 일으키지 않는다',async()=>{
 const f=await fixture(),late=f.hold();try{await f.click('헌법 프로젝트 적용');await f.wait(()=>f.writes.length===1);
  const owned=f.store().buffers[pid];await f.context({...session,csrfToken:'d'.repeat(43)});await f.context(session);
  late.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.settle();await f.settle();
  assert.equal(f.lost(),0);assert.equal(f.store().buffers[pid],owned);assert.equal(owned.savedId,null);assert.equal(f.writes.length,1);
 }finally{await f.close();}
});

for(const uncertain of [false,true])test(`부모 updater 보류 중 POST0이며 명시 재시도 뒤 ${uncertain?'불명 원명령':'정상 저장'}을 보존한다`,async()=>{
 const f=await fixture();try{f.defer();if(uncertain)f.fail();const button=f.button('헌법 프로젝트 적용');
  await ui.React.act(async()=>{button.dispatchEvent({type:'click',button:0,bubbles:true});button.dispatchEvent({type:'click',button:0,bubbles:true});});
  await f.wait(()=>f.changes()>=1&&!f.button('헌법 프로젝트 적용').disabled);await f.settle();assert.equal(f.writes.length,0);assert.equal(f.store().buffers[pid].pending,null);
  await f.flush();assert.equal(f.writes.length,0,'보류된 updater의 뒤늦은 반영만으로 전송0');
  await f.click('헌법 프로젝트 적용');await f.wait(()=>uncertain?f.store().buffers[pid].uncertain:!!f.store().buffers[pid].savedId);
  if(uncertain){assert.deepEqual(f.store().buffers[pid].pending,f.writes[0]);assert.equal(f.store().buffers[pid].savedId,null);
   await f.click('같은 지식 판단 명령 결과 확인');await f.wait(()=>!!f.store().buffers[pid].savedId);assert.deepEqual(f.writes[0],f.writes[1]);assert.deepEqual(f.packets[0],f.packets[1]);
  }else assert.deepEqual(f.store().applications[pid],f.receipts[0]);
  assert.equal(f.lost(),0);
 }finally{await f.close();}
});

test('현재401은 기존 인증소실 처리와 원명령 보존을 유지한다',async()=>{
 const f=await fixture(),late=f.hold();try{await f.click('헌법 프로젝트 적용');await f.wait(()=>f.writes.length===1);late.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.wait(()=>f.lost()===1);assert(f.store().buffers[pid].pending);assert.deepEqual(f.store().applications,{});
 }finally{await f.close();}
});
test('영수증 필드가 없는 과거 성공 버퍼는 fullref를 만들어 내지 않는다',async()=>{
 const f=await fixture();try{const old={...draft(),savedId:pid,dirty:false};await f.replace(old);await f.route(false);await f.route(true);assert(!f.container.textContent.includes('적용 영수증'));assert.equal(f.writes.length,0);
  await f.click('프로젝트 헌법 조회');await f.wait(()=>f.container.textContent.includes('프로젝트 적용 헌법 없음'));assert.equal(f.writes.length,0);
 }finally{await f.close();}
});
test('왕복 후 동일 세대의 다른 검산 hash 거절과 정확한 원 영수증 GET 성공을 유지한다',async()=>{
 const f=await fixture();try{await f.click('헌법 프로젝트 적용');await f.wait(()=>!!f.store().buffers[pid]?.savedId);await f.click('지식 판단 닫기');await f.route(false);await f.route(true);
  const page=(record:any)=>({current:{...record,source:{...draft().target,appliedAsConstitution:true,constitutionApplication:record},eligibility:{usable:true,reasons:[]}},history:[record],hasMore:false,nextBeforeVersion:null,agentDelivery:'NOT_CONNECTED',compliance:'NOT_ASSESSED',observedAt:at});
  const original=f.records[0],application={...original.application,reason:'다른 적용 내용'},changed={...original,application,ref:{...original.ref,contentHash:hash(application)}};
  f.setConstitution(page(changed));await f.click('프로젝트 헌법 조회');await f.wait(()=>f.container.textContent.includes('CONSTITUTION_CURRENT_UNCONFIRMED'));assert(!f.container.textContent.includes('현재 사용 가능한 헌법'));
  f.setConstitution(page(original));await f.click('프로젝트 헌법 조회');await f.wait(()=>f.container.textContent.includes('현재 사용 가능한 헌법'));assert(f.container.textContent.includes('보존할 헌법'));assert.equal(f.writes.length,1);
 }finally{await f.close();}
});
test('화면 이탈 뒤 원 dispatch의 검산 성공은 원 버퍼에 보존하며 자동 재전송하지 않는다',async()=>{
 const f=await fixture(),late=f.hold();try{await f.click('헌법 프로젝트 적용');await f.wait(()=>f.writes.length===1);await f.route(false);late.resolve(f.responses[0]!);await f.wait(()=>!!f.store().buffers[pid]?.savedId);
  await f.route(true);assert(f.container.textContent.includes('적용 영수증 · 세대 1'));assert.equal(f.writes.length,1);assert.equal(f.lost(),0);
 }finally{await f.close();}
});
test('실제 App의 저장→닫기→다른 화면→재진입은 영수증을 보존하고 낮은 현재 응답을 거절한다',async()=>{
 const events=new Map<string,Set<Function>>(),location=new URL(`https://anvil.invalid/#/projects/${pid}/knowledge`),writes:any[]=[],gets:string[]=[],unknown:string[]=[];
 const source=draft().target,project={id:pid,name:'원 프로젝트',purpose:'읽기',desiredOutcome:'보존',version:1,createdAt:at,updatedAt:at,currentMethodologyRef:null,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[],viewerPermissions:['READ_PROJECT'],participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:cid,generation:1}};
 const fetch=async(input:unknown,init:any)=>{const path=String(input);if(init?.method==='POST'){
  const c=JSON.parse(init.body);writes.push(c);assert.equal(c.operation,'applyConstitution');const application={projectId:pid,...c.payload,reviewRef:source.contentReviews[0].ref,previousApplicationRef:null,appliedBy:{kind:'HUMAN',userId:uid,clientId:cid},controlGeneration:1},ref={id:pid,version:1,contentHash:hash(application)};
  return Response.json({operationId:id(9),commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:pid,version:1,data:{status:'CONSTITUTION_APPLIED',ref,application},serverReceivedAt:at});
 }gets.push(path);
  if(path==='/api/v1/session')return Response.json({...session,user:{...session.user,displayName:'합성 사용자'}});
  if(path===`/api/v1/projects/${pid}`)return Response.json(project);
  if(path.startsWith('/api/v1/projects?'))return Response.json({items:[],nextCursor:null,hasMore:false,observedAt:at,baselineVersion:null});
  if(path.includes('/knowledge?'))return Response.json({items:[{versionRef:source.ref,title:source.entry.title,kind:source.entry.kind,sourceRefs:[],reasonSnippet:source.entry.reason,state:'CONFIRMED',currentConfirmationValid:true}],hasMore:false,nextCursor:null,searchScope:'TITLE_REASON',observedAt:at});
  if(path===`/api/v1/projects/${pid}/knowledge/${source.ref.id}/versions/1`)return Response.json(source);
  if(path.includes('/conversations?'))return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:at});
  if(path.includes('/constitution?'))return Response.json({current:null,history:[],hasMore:false,nextBeforeVersion:null,agentDelivery:'NOT_CONNECTED',compliance:'NOT_ASSESSED',observedAt:at});
  unknown.push(path);throw Error('UNEXPECTED_MEMORY_REQUEST');
 };
 const local=new Map<string,PropertyDescriptor|undefined>(),addEventListener=(name:string,fn:Function)=>{const set=events.get(name)??new Set();set.add(fn);events.set(name,set);},removeEventListener=(name:string,fn:Function)=>events.get(name)?.delete(fn);
 for(const[key,value]of Object.entries({location,fetch,addEventListener,removeEventListener})){local.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 const originalUi=ui;ui=new Function(uiCode)();
 const window=document.defaultView,oldLocation=window.location,oldAdd=window.addEventListener,oldRemove=window.removeEventListener;window.location=location;window.addEventListener=addEventListener;window.removeEventListener=removeEventListener;window.matchMedia=()=>({matches:false});document.getElementById=()=>null;
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))],settle=()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));}),wait=async(check:()=>boolean)=>{for(let n=0;n<100&&!check();n++)await settle();assert(check(),container.textContent);};
 const click=async(name:string)=>{const b=nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===name);assert(b,name);assert(!b.disabled);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const nav=async(hash:string)=>{await ui.React.act(async()=>{location.hash=hash;for(const fn of events.get('hashchange')??[])fn();});};
 try{await ui.React.act(async()=>root.render(ui.React.createElement(ui.App)));await wait(()=>nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='지식 원문 보기'));
  await click('지식 원문 보기');await wait(()=>nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='프로젝트 헌법으로 적용'));await click('프로젝트 헌법으로 적용');await wait(()=>nodes().some(n=>n.getAttribute('aria-label')==='지식 판단 이유'));
  const reason=nodes().find(n=>n.getAttribute('aria-label')==='지식 판단 이유')!,ack=nodes().find(n=>n.tagName==='INPUT'&&((n as any).type==='checkbox'||n.getAttribute('type')==='checkbox'))!;
  const props=(n:any)=>n[Object.keys(n).find(k=>k.startsWith('__reactProps$'))!];
  await ui.React.act(async()=>props(reason).onChange({target:{value:'보존할 적용 이유'}}));await ui.React.act(async()=>props(ack).onChange({target:{checked:true}}));
  await click('헌법 프로젝트 적용');await wait(()=>container.textContent.includes('헌법 프로젝트 적용 확인'));assert.equal(writes.length,1);await click('지식 판단 닫기');
  await nav('#/projects');await nav(`#/projects/${pid}/knowledge`);await wait(()=>container.textContent.includes('적용 영수증 · 세대 1'));const before=gets.filter(p=>p.includes('/constitution?')).length;
  await click('프로젝트 헌법 조회');await wait(()=>container.textContent.includes('CONSTITUTION_CURRENT_UNCONFIRMED'));assert.equal(gets.filter(p=>p.includes('/constitution?')).length,before+1);assert.equal(writes.length,1);assert.deepEqual(unknown,[]);
 }finally{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);window.location=oldLocation;window.addEventListener=oldAdd;window.removeEventListener=oldRemove;ui=originalUi;for(const[key,value]of local)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}
});


for(const mode of ['replacement','unmount','session'] as const)test('부모 pending 보류 뒤 '+mode+'는 이전 명시 저장을 전송하지 않는다',async()=>{
 const f=await fixture();try{f.defer();await f.click('헌법 프로젝트 적용');await f.wait(()=>f.changes()>0);
  const replacement=draft(1);if(mode==='replacement')await f.replace(replacement);else if(mode==='unmount')await f.route(false);else await f.context({...session,csrfToken:'d'.repeat(43)});
  await f.flush();await f.settle();assert.equal(f.writes.length,0);assert.equal(f.lost(),0);if(mode==='replacement')assert.equal(f.store().buffers[pid],replacement);
  if(mode==='unmount'){await f.route(true);await f.settle();assert.equal(f.writes.length,0,'복귀는 자동 전송0');}
 }finally{await f.close();}
});
test('새 판단 buffer 렌더 뒤 옛 저장 callback은 pending/POST를 만들지 않는다',async()=>{
 const f=await fixture();try{const button=f.button('헌법 프로젝트 적용'),key=Object.keys(button).find(k=>k.startsWith('__reactProps'));assert(key);const old=(button as any)[key].onClick,close=f.button('지식 판단 닫기'),closeKey=Object.keys(close).find(k=>k.startsWith('__reactProps'))!,oldClose=(close as any)[closeKey].onClick;const nodes=(n:MemoryNode):MemoryNode[]=>[n,...n.childNodes.flatMap(nodes)],reason=nodes(f.container).find(n=>n.getAttribute('aria-label')==='지식 판단 이유')!,reasonKey=Object.keys(reason).find(k=>k.startsWith('__reactProps'))!,oldEdit=(reason as any)[reasonKey].onChange,replacement=draft(1);await f.replace(replacement);const changes=f.changes();await ui.React.act(async()=>{old();oldClose();oldEdit({target:{value:'옛 입력 반영 금지'}});await new Promise(r=>setImmediate(r));});await f.settle();assert.equal(f.writes.length,0);assert.equal(f.changes(),changes);assert.equal(f.store().buffers[pid],replacement);}finally{await f.close();}
});


for(const aba of [false,true])test('부모 exact pending commit 뒤 payload 검산 중 '+(aba?'전달된 route ABA':'raw route 이탈')+'은 POST0·불명0이며 복귀도 명시 재확인한다',async t=>{
 const events=new Map<string,Set<Function>>(),savedEvents=new Map(['addEventListener','removeEventListener'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 Object.defineProperty(globalThis,'addEventListener',{configurable:true,value:(name:string,fn:Function)=>{if(!events.has(name))events.set(name,new Set());events.get(name)!.add(fn);}});Object.defineProperty(globalThis,'removeEventListener',{configurable:true,value:(name:string,fn:Function)=>events.get(name)?.delete(fn)});
 t.after(()=>{for(const[key,value]of savedEvents)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'location'),location={hash:'#/projects/'+pid+'/knowledge'};Object.defineProperty(globalThis,'location',{configurable:true,value:location});
 t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'location',descriptor);else Reflect.deleteProperty(globalThis,'location');});
 const f=await fixture(),digest=crypto.subtle.digest;let release:(()=>void)|undefined,held=false;
 const spy=t.mock.method(crypto.subtle,'digest',function(this:SubtleCrypto,...args:any[]){
  if(!held&&f.store().buffers[pid]?.pending){held=true;const wait=deferred<void>();release=()=>wait.resolve();return wait.promise.then(()=>Reflect.apply(digest,this,args));}
  return Reflect.apply(digest,this,args);
 });
 try{
  const mountedForm=f.button('헌법 프로젝트 적용').parentNode;await f.click('헌법 프로젝트 적용');await f.wait(()=>held);const pending=structuredClone(f.store().buffers[pid].pending);assert(pending);assert.equal(f.writes.length,0);
  await ui.React.act(async()=>{const a=location.hash,b='#/projects/'+pid+'/documents';location.hash=b;if(aba){for(const fn of events.get('hashchange')??[])fn({oldURL:'https://anvil.invalid/'+a,newURL:'https://anvil.invalid/'+b});location.hash=a;for(const fn of events.get('hashchange')??[])fn({oldURL:'https://anvil.invalid/'+b,newURL:'https://anvil.invalid/'+a});}release!();await new Promise(r=>setImmediate(r));});await f.wait(()=>f.writes.length>0||!f.button('같은 지식 판단 명령 결과 확인').disabled);assert.equal(f.writes.length,0);assert.equal(f.store().buffers[pid].uncertain,false);assert.equal(f.store().buffers[pid].failure,null);assert.deepEqual(f.store().buffers[pid].pending,pending);
  if(!aba){await f.route(false);location.hash='#/projects/'+pid+'/knowledge';await f.route(true);}else assert.equal(f.button('같은 지식 판단 명령 결과 확인').parentNode,mountedForm,'ABA 복구는 동일 Form mount의 새 handler');await f.settle();assert.equal(f.writes.length,0);await f.click('같은 지식 판단 명령 결과 확인');await f.wait(()=>!!f.store().buffers[pid].savedId);assert.deepEqual(f.writes,[pending]);
 }finally{release?.();spy.mock.restore();await f.close();assert([...events.values()].every(value=>value.size===0),'hashchange listener 회수');if(descriptor)Object.defineProperty(globalThis,'location',descriptor);else Reflect.deleteProperty(globalThis,'location');}
});


test('실제 POST 뒤 부모가 같은 원 초안 객체를 다시 표시하면 늦은 결과가 덮지 않는다',async()=>{
 const f=await fixture(),original=f.store().buffers[pid],late=f.hold();try{await f.click('헌법 프로젝트 적용');await f.wait(()=>f.writes.length===1);assert.notEqual(f.store().buffers[pid],original);await f.replace(original);const before=f.changes();late.resolve(f.responses[0]!);await f.wait(()=>f.changes()>before);assert.equal(f.store().buffers[pid],original);assert.equal(original.savedId,null);assert.equal(original.pending,null);assert.deepEqual(f.store().applications,{});assert.equal(f.writes.length,1);}finally{late.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.close();}
});
