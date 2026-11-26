import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {hash,resultFixture} from '../UI05/result-view-fixture.ts';
import {stopHistoryFor} from '../UI05/stop-request-history-fixture.ts';
import {assignmentPlanFixture} from '../UI05/assignment-plan-original-fixture.ts';
import {parseRoute,sessionDetailHref} from '../../../apps/web/src/shell/routes.ts';

class MemoryNode {
 parentNode:MemoryNode|null=null;
 childNodes:MemoryNode[]=[];
 attributes=new Map<string,string>();
 style={};
 value='';checked=false;disabled=false;
 listeners=new Map<string,Function[]>();
 namespaceURI='http://www.w3.org/1999/xhtml';
 nodeName:string;
 tagName:string;
 localName:string;
 nodeType:number;
 ownerDocument:any;
 data:string;
 constructor(localName:string,nodeType=1,ownerDocument:any=null,data=''){
  this.localName=localName;this.nodeType=nodeType;this.ownerDocument=ownerDocument;this.data=data;
  this.nodeName=this.tagName=nodeType===1?localName.toUpperCase():localName;
 }
 get firstChild():MemoryNode|null{return this.childNodes[0]??null;}
 get options():MemoryNode[]{return this.childNodes.flatMap(n=>n.tagName==='OPTION'?[n]:n.options);}
 get textContent():string{return this.nodeType===3?this.data:this.childNodes.map(n=>n.textContent).join('');}
 set textContent(value:string){
  if(this.nodeType===3){this.data=value;return;}
  for(const child of this.childNodes)child.parentNode=null;
  this.childNodes=[];
  if(value)this.appendChild(this.ownerDocument.createTextNode(value));
 }
 appendChild(node:MemoryNode){node.parentNode?.removeChild(node);node.parentNode=this;this.childNodes.push(node);return node;}
 insertBefore(node:MemoryNode,anchor:MemoryNode){
  node.parentNode?.removeChild(node);const i=this.childNodes.indexOf(anchor);assert(i>=0);
  this.childNodes.splice(i,0,node);node.parentNode=this;return node;
 }
 removeChild(node:MemoryNode){const i=this.childNodes.indexOf(node);assert(i>=0);this.childNodes.splice(i,1);node.parentNode=null;return node;}
 setAttribute(key:string,value:unknown){this.attributes.set(key,String(value));if(key==='disabled')this.disabled=true;}
 removeAttribute(key:string){this.attributes.delete(key);if(key==='disabled')this.disabled=false;}
 getAttribute(key:string){return this.attributes.get(key)??null;}
 addEventListener(key:string,listener:Function){this.listeners.set(key,[...(this.listeners.get(key)??[]),listener]);}
 removeEventListener(key:string,listener:Function){this.listeners.set(key,(this.listeners.get(key)??[]).filter(v=>v!==listener));}
 dispatchClick(){
  const event={type:'click',target:this,button:0,bubbles:true,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){}};
  for(let node:MemoryNode|null=this;node;node=node.parentNode)for(const listener of node.listeners.get('click')??[])listener(event);
  return !event.defaultPrevented;
 }
}

const document:any=new MemoryNode('#document',9);
document.ownerDocument=document;
document.createElement=(name:string)=>new MemoryNode(name,1,document);
document.createTextNode=(value:string)=>new MemoryNode('#text',3,document,value);
document.createElementNS=(_:string,name:string)=>document.createElement(name);
document.documentElement=document.createElement('html');
document.body=document.createElement('body');
document.documentElement.appendChild(document.body);
document.activeElement=document.body;
const prior=new Map<string,PropertyDescriptor|undefined>();
const channels:MessageChannel[]=[];
const NativeChannel=globalThis.MessageChannel;
class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
let ui:any;
before(async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/decisions/ApprovalsPage.tsx',import.meta.url));
 const api=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url));
 const program=await build({configFile:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},
  build:{write:false,lib:{entry:'virtual:issue-stops',name:'IssueStops',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},
  plugins:[{name:'issue-stops-memory',resolveId(id){if(id.endsWith('virtual:issue-stops'))return '\0issue-stops';},
   load(id){if(id==='\0issue-stops')return `import * as React from 'react';import {createRoot} from 'react-dom/client';export {ApprovalsPage} from ${JSON.stringify(entry)};export {ApiClient} from ${JSON.stringify(api)};export {React,createRoot};`;}}]});
 const compiled=(Array.isArray(program)?program[0]:program) as {output:{type:string;code:string}[]};
 const window={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},location:{protocol:'https:'}};
 document.defaultView=window;
 for(const [key,value] of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){
  prior.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
 }
 ui=new Function(compiled.output.find(o=>o.type==='chunk')!.code+';return IssueStops;')();
});
after(()=>{for(const channel of channels){channel.port1.close();channel.port2.close();}for(const [key,value] of prior)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});

function updatedHistory(entry:ReturnType<typeof resultFixture>['entry'],change:(value:any)=>void){
 const {contentHash:_,...value}=stopHistoryFor(entry);change(value);return {...value,contentHash:hash(value)};
}

const reviewLookup='검수 이력 조회',olderReviews='더 이전 검수 목록 조회';
const reviewId=(n:number)=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const reviewCursor=`root.${'a'.repeat(64)}.position.${'b'.repeat(64)}`;
function reviewFixtures(result:ReturnType<typeof resultFixture>['entry'],detail:ReturnType<typeof assignmentPlanFixture>['detail']){
 const a=detail.confirmed!;const d=a.snapshot.definition,at='2026-10-20T00:00:00.000Z';
 const sources=(['acceptanceCriteria','verificationRequirements'] as const).map(field=>({field,index:0,contentHash:hash(d[field][0])}));
 const fields={criterionId:'flow',testId:'FLOW-01',kind:'INTEGRATION',environmentRef:d.environmentRef};
 const criteriaSnapshot={assignmentRef:a.ref,baselineRefs:d.baselineRefs,items:[{...fields,required:true}]},criteriaRef={id:reviewId(77),version:1,contentHash:hash(criteriaSnapshot)};
 const criteria={projectId:a.projectId,ref:criteriaRef,snapshot:criteriaSnapshot,input:{assignmentRef:a.ref,baseRef:null,items:[{...fields,sources}],reason:'고정된 당시 검수 기준'},sourceBindings:[{criterionId:'flow',sources}],createdBy:a.projectId,registeredAt:at,observedAt:at,registryStored:true,reviewStored:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false};
 const reviewedBy={kind:'HUMAN',userId:a.projectId,clientId:a.ref.id},sameAsSubmitter=reviewedBy.userId===result.snapshot.submittedByRef.id;
 const flags={completionAccepted:false,formalFailureCounted:false,evidenceProvenanceVerified:false,executionAuthorized:false,dispatchPerformed:false};
 const reviews=Array.from({length:21},(_,i)=>{
  const reason=`보관 검수 원문 ${i+1}`,input={resultRef:result.ref,criteriaRef,outcome:'BLOCKED',items:[{criterionId:'flow',outcome:'BLOCKED',evidenceRefs:[],reason}],reason};
  const snapshot={scope:result.snapshot.scope,input,reviewedBy,sameAsSubmitter,reviewedAt:at,...flags};
  const ref={id:reviewId(90-i),version:1,contentHash:hash(snapshot)};
  return {view:{projectId:a.projectId,ref,snapshot,observedAt:at,reviewStored:true,...flags},item:{ref,criteriaRef,outcome:input.outcome,reviewedBy,sameAsSubmitter,reviewedAt:at,reviewStored:true,...flags}};
 });
 const page=(cursor:string|null)=>({projectId:a.projectId,resultRef:result.ref,items:(cursor?reviews.slice(20):reviews.slice(0,20)).map(v=>v.item),hasMore:!cursor,nextCursor:cursor?null:reviewCursor,selectionState:'NOT_SELECTED',observedAt:at,pageSize:20,window:{startedAt:at,expiresAt:'2026-10-20T00:30:00.000Z'}});
 const basis=(review:typeof reviews[number]['view'])=>({projectId:a.projectId,resultRef:result.ref,reviewRef:review.ref,assignmentRef:a.ref,applicationRef:d.taskRef.applicationRef,nodeId:d.taskRef.nodeId,nodeName:'고정된 당시 단계',action:'WAIT_HUMAN_UNBLOCK_DECISION',reviewOutcome:'BLOCKED',sourceAssurance:'SERVER_STORED_REVIEW_WITH_CURRENT_METHODOLOGY',resultTransport:'SYNTHETIC_ONLY',reviewObservedAt:at,applicationObservedAt:at,reasonCodes:['COMPLETION_NOT_ACCEPTED','RUNTIME_STATE_NOT_VERIFIED','CURRENT_AUTHORITY_BUDGET_NOT_REVALIDATED'],completionAccepted:false,runtimeStateVerified:false,automaticTransitionPerformed:false,executionAuthorized:false,dispatchPerformed:false});
 return {reviews,page,criteria,basis};
}

async function mount(strict=false,withAssignment=false,withReviews=false){
 const original=resultFixture(),second=resultFixture();
 const {detail}=assignmentPlanFixture();assert(detail.confirmed);
 if(withReviews){
  const baseline=detail.draft.snapshot.definition.taskRef.applicationRef;
  const definition={...detail.draft.snapshot.definition,environmentRef:baseline,baselineRefs:[baseline]};
  detail.draft.snapshot.definition=definition;detail.draft.ref.contentHash=hash(detail.draft.snapshot);
  detail.confirmed.snapshot={...detail.confirmed.snapshot,draftRef:detail.draft.ref,definition};detail.confirmed.ref.contentHash=hash(detail.confirmed.snapshot);
 }
 if(withAssignment)for(const f of [original,second]){
  f.a=detail.confirmed.ref;f.entry.snapshot.scope.assignmentRef=f.a;f.entry.snapshot.manifest.assignmentRef=f.a;
  f.entry.snapshot.manifestHash=hash(f.entry.snapshot.manifest);f.item.manifestRef.contentHash=f.entry.snapshot.manifestHash;
  f.entry.ref.contentHash=hash(f.entry.snapshot);
 }
 const later='55555555-5555-4555-8555-555555555555';
 second.entry.ref.id=later;second.item.manifestRef.id=later;
 const select=(f:typeof original)=>({assignmentRef:f.a,returnDraftRef:withAssignment?detail.draft.ref:f.a,item:f.item});
 const calls:{path:string;method:string}[]=[];
 const stored=(f:typeof original)=>reviewFixtures(f.entry,detail);
 const controls={readStops:(f:typeof original):Response|Promise<Response>=>Response.json(stopHistoryFor(f.entry)),
  readPages:():Response|Promise<Response>=>assert.fail('과거 페이지 자동 조회'),
  readIssueBasis:():Response=>assert.fail('문제 근거 자동 조회'),
  readAssignment:(draft:boolean):Response|Promise<Response>=>Response.json(draft?detail.draft:detail.confirmed),
  readReviewPage:(f:typeof original,cursor:string|null):Response|Promise<Response>=>Response.json(stored(f).page(cursor)),
  readReview:(view:ReturnType<typeof stored>['reviews'][number]['view']):Response|Promise<Response>=>Response.json(view),
  readCriteria:(view:ReturnType<typeof stored>['criteria']):Response|Promise<Response>=>Response.json(view),
  readCoverage:():Response|Promise<Response>=>assert.fail('조건별 보고 자동 조회'),
  readBasis:(view:ReturnType<ReturnType<typeof stored>['basis']>):Response|Promise<Response>=>Response.json(view)};
 const transport:typeof fetch=async(url,init)=>{
  const path=String(url),method=init?.method??'GET';calls.push({path,method});
  assert.equal(method,'GET');assert.equal(init?.credentials,'same-origin');
  if(path.includes('/approvals?'))return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:original.page.observedAt});
  const prefix=`/api/v1/projects/${detail.projectId}`;
  if(withAssignment&&path===`${prefix}/assignment-drafts/${detail.draft.ref.id}/versions/${detail.draft.ref.version}`)return controls.readAssignment(true);
  if(withAssignment&&detail.confirmed&&path===`${prefix}/assignments/${detail.confirmed.ref.id}/versions/${detail.confirmed.ref.version}`)return controls.readAssignment(false);
  for(const f of [original,second]){
   const resultPath=`/api/v1/projects/${f.pid}/results/${f.entry.ref.id}`;
   if(path===resultPath)return Response.json(f.entry);
   if(path===resultPath+'/stop-requests')return controls.readStops(f);
   if(path===resultPath+'/stop-request-pages')return controls.readPages();
   if(path===resultPath+'/issue-basis')return controls.readIssueBasis();
   if(withReviews&&path.startsWith(resultPath+'/review-pages'))return controls.readReviewPage(f,new URL(path,'https://test.invalid').searchParams.get('cursor'));
   if(withReviews&&path===resultPath+'/reviews'){
    const {nextCursor:_,pageSize:__,window:___,...legacy}=stored(f).page(null);return Response.json(legacy);
   }
   if(withReviews){
    const reviews=stored(f);
    if(path===`${resultPath}/criteria/${reviews.criteria.ref.id}/versions/${reviews.criteria.ref.version}/reported-coverage`)return controls.readCoverage();
    if(path===`${prefix}/result-criteria/${reviews.criteria.ref.id}/versions/${reviews.criteria.ref.version}`)return controls.readCriteria(reviews.criteria);
    for(const {view} of reviews.reviews){
     const reviewPath=`${prefix}/result-reviews/${view.ref.id}`;
     if(path===reviewPath)return controls.readReview(view);
     if(path===reviewPath+'/next-action-basis')return controls.readBasis(reviews.basis(view));
    }
   }
  }
  assert.fail('허용되지 않은 조회 '+path);
 };
 const client=new ui.ApiClient(transport),element=document.createElement('main');document.body.appendChild(element);
 const root=ui.createRoot(element);
 let session={user:{id:original.pid},clientId:original.a.id,csrfToken:'Q'.repeat(43)},selection:ReturnType<typeof select>|null=select(original),authLost=0;
 const write=()=>assert.fail('보호 읽기 중 command 상태 변경');
 const component=()=>ui.React.createElement(ui.ApprovalsPage,{client,projectId:original.pid,session,buffer:null,onChange:write,candidate:null,onCandidateChange:write,
  resultIssueSelection:selection,onResultIssueClose:()=>{selection=null;root.render(component());},onAuthenticationLost:()=>{authLost++;}});
 const render=()=>ui.React.act(async()=>root.render(strict?ui.React.createElement(ui.React.StrictMode,null,component()):component()));
 const nodes=(node:MemoryNode=element):MemoryNode[]=>[node,...node.childNodes.flatMap(child=>nodes(child))];
 const button=(text:string)=>{
  const found=nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===text);
  assert(found,text);assert.equal(found.disabled,false,text);return found;
 };
 const click=(text:string)=>ui.React.act(async()=>button(text).dispatchClick());
 const flush=()=>ui.React.act(async()=>{await new Promise<void>(resolve=>setImmediate(resolve));});
 const wait=async(check:()=>boolean)=>{const end=performance.now()+3000;while(!check()&&performance.now()<end)await flush();assert(check(),element.textContent);};
 const report=async()=>{await click('선택 보고 원문 확인');await wait(()=>element.textContent.includes('검수 미실행'));};
 await render();
 return {original,second,detail,stored,controls,calls,report,click,button,wait,flush,render,client,transport,nodes,authLost:()=>authLost,text:()=>element.textContent,
  async choose(f:typeof original){selection=select(f);await render();},
  async actor(field:'USER'|'CLIENT'){session=field==='USER'?{...session,user:{id:crypto.randomUUID()}}:{...session,clientId:crypto.randomUUID()};await render();},
  async close(){await ui.React.act(async()=>root.unmount());document.body.removeChild(element);},
  async exit(onCommit:()=>void){
   function NextScreen(){ui.React.useLayoutEffect(onCommit,[]);return ui.React.createElement('p',null,'다른 화면');}
   await ui.React.act(async()=>root.render(ui.React.createElement(NextScreen)));
  },
  async act(fn:()=>void){await ui.React.act(async()=>fn());}
 };
}
const lookup='중지 요청 이력 조회';
const stopPath=(f:ReturnType<typeof resultFixture>)=>`/api/v1/projects/${f.pid}/results/${f.entry.ref.id}/stop-requests`;
const stopCalls=(f:Awaited<ReturnType<typeof mount>>)=>f.calls.filter(call=>call.path.endsWith('/stop-requests'));

const assignmentLookup='고정 임무 조건 조회',transferLink='해당 임무 인계 기록 보기';
const assignmentCalls=(f:Awaited<ReturnType<typeof mount>>)=>f.calls.filter(call=>/\/(assignment-drafts|assignments)\//.test(call.path));
const transferAnchor=(f:Awaited<ReturnType<typeof mount>>)=>f.nodes().find(n=>n.tagName==='A'&&n.textContent===transferLink);

async function openReviewList(f:Awaited<ReturnType<typeof mount>>){
 await f.report();await f.click(assignmentLookup);await f.wait(()=>f.text().includes(reviewLookup));
 await f.click(reviewLookup);await f.wait(()=>f.text().includes('검수 원문 '+reviewId(90)));
}
test('같은 보고의 처음 20개와 명시 다음 페이지의 21번째 검수 원문·기준·다음 근거를 연다',async()=>{
 const f=await mount(false,true,true);
 try{
  await openReviewList(f);
  const first=`/api/v1/projects/${f.original.pid}/results/${f.original.entry.ref.id}/review-pages`;
  assert.equal(f.calls.at(-1)?.path,first);assert(!f.text().includes(reviewId(70)));
  await f.click(olderReviews);await f.wait(()=>f.text().includes('검수 원문 '+reviewId(70)));
  assert(!f.text().includes('검수 원문 '+reviewId(90)));assert(!f.text().includes('보관 검수 원문 21'));
  assert.equal(f.calls.at(-1)?.path,first+'?cursor='+reviewCursor);
  await f.click('검수 원문 '+reviewId(70));await f.wait(()=>f.text().includes('보관 검수 원문 21'));
  await f.click('검수 기준·원조건 열기');await f.wait(()=>f.text().includes('고정된 당시 검수 기준'));
  await f.click('다음 행동 근거 확인');await f.wait(()=>f.text().includes('고정된 당시 단계'));
  assert.deepEqual(f.calls.slice(-3).map(c=>c.path),[
   `/api/v1/projects/${f.original.pid}/result-reviews/${reviewId(70)}`,
   `/api/v1/projects/${f.original.pid}/result-criteria/${reviewId(77)}/versions/1`,
   `/api/v1/projects/${f.original.pid}/result-reviews/${reviewId(70)}/next-action-basis`,
  ]);
  assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});

test('검수 다음 페이지의 다른 조회창·root·반복 cursor·교차 결과·겹친 경계는 선택하지 않는다',async()=>{
 for(const mode of ['WINDOW','ROOT','REPEATED_CURSOR','RESULT','OVERLAP']){
  const f=await mount(false,true,true);
  try{
   await openReviewList(f);
   f.controls.readReviewPage=(result,cursor)=>{
    assert.equal(cursor,reviewCursor);const page=f.stored(result).page(cursor);
    if(mode==='WINDOW')page.window.expiresAt='2026-10-20T00:20:00.000Z';
    else if(mode==='RESULT')page.resultRef={...page.resultRef,contentHash:'e'.repeat(64)};
    else if(mode==='OVERLAP')page.items=f.stored(result).page(null).items.slice(-1);
    else{
     page.hasMore=true;page.nextCursor=mode==='ROOT'?reviewCursor.replace('root.','foreign.'):reviewCursor;
     page.items=Array.from({length:20},(_,i)=>({...page.items[0]!,ref:{...page.items[0]!.ref,id:reviewId(70-i)}}));
    }
    return Response.json(page);
   };
   await f.click(olderReviews);await f.wait(()=>f.text().includes('RESULT_REVIEW_HISTORY_RESPONSE_INVALID'));
   assert(!f.text().includes('검수 원문 '+reviewId(70)),mode);assert(!f.text().includes(olderReviews),mode);
   assert.equal(f.calls.filter(c=>c.path.includes('/review-pages')).length,2);
   assert.equal(f.calls.filter(c=>c.path.includes('/result-reviews/')).length,0);
  }finally{await f.close();}
 }
});

test('표시 시각이 같은 과거 페이지는 UUID 순서로 서버 cursor 위치를 재추정하지 않는다',async()=>{
 const f=await mount(false,true,true);
 try{
  await openReviewList(f);
  f.controls.readReviewPage=(result,cursor)=>{
   const page=f.stored(result).page(cursor),item=page.items[0]!;
   item.ref={...item.ref,id:reviewId(99)};
   return Response.json(page);
  };
  await f.click(olderReviews);await f.wait(()=>f.text().includes('검수 원문 '+reviewId(99)));
  assert.equal(f.calls.filter(c=>c.path.includes('/review-pages')).length,2);
  assert(!f.calls.some(c=>c.path.includes('/result-reviews/')));
 }finally{await f.close();}
});

test('현재 검수 페이지·원문·하위 근거의 접근 거절은 보고를 숨기고 현재 401만 인증을 알린다',async()=>{
 for(const target of ['PAGE','DETAIL','CRITERIA','BASIS','COVERAGE'])for(const status of [401,403,404]){
  const f=await mount(false,true,true);
  const rejected=()=>Response.json({code:status===401?'AUTH_REQUIRED':status===403?'PROJECT_OPERATION_DENIED':'NOT_FOUND'},{status});
  try{
   await openReviewList(f);
   if(target==='PAGE'){f.controls.readReviewPage=rejected;await f.click(olderReviews);}
   else if(target==='DETAIL'){f.controls.readReview=rejected;await f.click('검수 원문 '+reviewId(90));}
   else{
    await f.click('검수 원문 '+reviewId(90));await f.wait(()=>f.text().includes('보관 검수 원문 1'));
    if(target==='CRITERIA'){f.controls.readCriteria=rejected;await f.click('검수 기준·원조건 열기');}
    else if(target==='BASIS'){f.controls.readBasis=rejected;await f.click('다음 행동 근거 확인');}
    else{
     await f.click('검수 기준·원조건 열기');await f.wait(()=>f.text().includes('고정된 당시 검수 기준'));
     f.controls.readCoverage=rejected;await f.click('조건별 보고 부족 대조');
    }
   }
   await f.wait(()=>f.text().includes('보고 원문 미확인'));
   assert.equal(f.authLost(),status===401?1:0);assert(!f.text().includes(olderReviews));assert(!f.text().includes('선택한 보관 검수 원문'));
   assert(f.calls.every(c=>c.method==='GET'));
  }finally{await f.close();}
 }
});

test('검수 부모 선택·transport·페이지 이동 뒤 지연된 원문과 근거는 새 맥락에 전파되지 않는다',async()=>{
 for(const mode of ['PAGE_REPORT','PAGE_TRANSPORT','DETAIL_PAGE','CHILD_PAGE','CHILD_PENDING','COVERAGE_PAGE','COVERAGE_PENDING']){
  const f=await mount(true,true,true);const releases:((value:Response)=>void)[]=[];
  const hold=()=>new Promise<Response>(resolve=>releases.push(resolve));
  try{
   await openReviewList(f);
   if(mode.startsWith('PAGE_')){
    f.controls.readReviewPage=hold;await f.click(olderReviews);await f.wait(()=>releases.length===1);
    if(mode==='PAGE_REPORT')await f.choose(f.second);
    else f.client.transport=async()=>assert.fail('다른 transport의 추가 요청');
   }else if(mode==='DETAIL_PAGE'){
    f.controls.readReview=hold;await f.click('검수 원문 '+reviewId(90));await f.wait(()=>releases.length===1);
    await f.click(olderReviews);
   }else{
    await f.click('검수 원문 '+reviewId(90));await f.wait(()=>f.text().includes('보관 검수 원문 1'));
    const next=f.button(olderReviews),criteria=f.button('검수 기준·원조건 열기'),basis=f.button('다음 행동 근거 확인');
    if(mode==='CHILD_PAGE')await f.act(()=>{next.dispatchClick();criteria.dispatchClick();basis.dispatchClick();});
    else if(mode==='CHILD_PENDING'){
     f.controls.readCriteria=hold;f.controls.readBasis=hold;
     await f.act(()=>{criteria.dispatchClick();basis.dispatchClick();});await f.wait(()=>releases.length===2);
     await f.click(olderReviews);
    }else{
     await f.click('검수 기준·원조건 열기');await f.wait(()=>f.text().includes('고정된 당시 검수 기준'));
     const coverage=f.button('조건별 보고 부족 대조');
     if(mode==='COVERAGE_PAGE')await f.act(()=>{next.dispatchClick();coverage.dispatchClick();});
     else{
      f.controls.readCoverage=hold;await f.click('조건별 보고 부족 대조');await f.wait(()=>releases.length===1);
      await f.click(olderReviews);
     }
    }
   }
   for(const release of releases)release(Response.json({code:'AUTH_REQUIRED'},{status:401}));
   if(!mode.startsWith('PAGE_'))await f.wait(()=>f.text().includes('검수 원문 '+reviewId(70)));
   await f.flush();assert.equal(f.authLost(),0,mode);assert(!f.text().includes('AUTH_REQUIRED'),mode);
   assert(!f.text().includes('보관 검수 원문 1'),mode);
   if(mode==='CHILD_PAGE')assert(!f.calls.some(c=>c.path.includes('/result-criteria/')||c.path.endsWith('/next-action-basis')));
   if(mode.startsWith('COVERAGE_'))assert.equal(f.calls.filter(c=>c.path.endsWith('/reported-coverage')).length,mode==='COVERAGE_PENDING'?1:0);
   assert(f.calls.every(c=>c.method==='GET'));
  }finally{for(const release of releases)release(Response.json({}));await f.close();}
 }
});

test('문제 카드의 고정 임무 원문이 대조되어야 기존 인계 경로를 정확한 초안으로 연다',async()=>{
 const f=await mount(false,true);
 try{
  await f.report();assert.equal(transferAnchor(f),undefined);assert.equal(assignmentCalls(f).length,0);
  const back=f.nodes().find(n=>n.tagName==='A'&&n.textContent==='원 임무 상세로 돌아가기');
  assert.equal(back?.getAttribute('href'),sessionDetailHref(f.detail.projectId,f.detail.draft.ref));
  const lookupButton=f.button(assignmentLookup);
  await f.act(()=>{lookupButton.dispatchClick();lookupButton.dispatchClick();});
  await f.wait(()=>f.text().includes('고정 임무의 업무 원문 확인'));
  const anchor=transferAnchor(f);assert(anchor);
  assert.deepEqual(parseRoute(anchor.getAttribute('href')!),{screen:'transfers',projectId:f.detail.projectId,assignmentRef:f.detail.draft.ref});
  const before=f.calls.length;await f.act(()=>assert.equal(anchor.dispatchClick(),true));assert.equal(f.calls.length,before);
  assert.equal(assignmentCalls(f).length,2);
  f.client.transport=async()=>assert.fail('폐기된 링크에서 조회');
  await f.act(()=>assert.equal(anchor.dispatchClick(),false));
  f.client.transport=f.transport;
  await f.choose(f.second);assert.equal(transferAnchor(f),undefined);
  await f.report();assert.equal(transferAnchor(f),undefined);assert.equal(assignmentCalls(f).length,2);
 }finally{await f.close();}
});

test('다른 확정 임무나 보호 거절은 인계 링크를 숨기고 기존 돌아가기 경로를 유지한다',async()=>{
 for(const mode of ['WRONG_HASH',401,403,404] as const){
  const f=await mount(false,true);
  try{
   await f.report();await f.click(assignmentLookup);await f.wait(()=>!!transferAnchor(f));
   f.controls.readAssignment=(draft)=>draft?Response.json(f.detail.draft):mode==='WRONG_HASH'?
    Response.json({...f.detail.confirmed,ref:{...f.detail.confirmed!.ref,contentHash:'a'.repeat(64)}}):
    Response.json({code:mode===401?'AUTH_REQUIRED':mode===403?'PROJECT_OPERATION_DENIED':'NOT_FOUND'},{status:mode});
   await f.click('고정 임무 조건 다시 조회');await f.wait(()=>f.nodes().some(n=>n.getAttribute('role')==='alert'));
   assert.equal(transferAnchor(f),undefined,String(mode));assert.equal(f.authLost(),mode===401?1:0);
   assert.equal(f.nodes().find(n=>n.textContent==='원 임무 상세로 돌아가기')?.getAttribute('href'),sessionDetailHref(f.detail.projectId,f.detail.draft.ref));
   assert.equal(assignmentCalls(f).length,4);
  }finally{await f.close();}
 }
});

test('보고를 닫거나 바꾼 뒤 늦은 고정 임무 응답은 링크와 인증을 바꾸지 않는다',async()=>{
 for(const mode of ['LATE_SUCCESS','LATE_401','SAME_COMMIT_CLICK']){
  const f=await mount(true,true);
  let release:(reply:Response)=>void=()=>{};
  try{
   await f.report();
   if(mode==='SAME_COMMIT_CLICK'){
    await f.click(assignmentLookup);await f.wait(()=>!!transferAnchor(f));
    const link=transferAnchor(f)!;const close=f.button('선택 보고 닫기');
    await f.act(()=>{close.dispatchClick();assert.equal(link.dispatchClick(),false);});
   }else{
    f.controls.readAssignment=(draft)=>draft?Response.json(f.detail.draft):new Promise(resolve=>{release=resolve;});
    await f.click(assignmentLookup);await f.wait(()=>assignmentCalls(f).length===2);
    if(mode==='LATE_SUCCESS')await f.choose(f.second);
    else await f.exit(()=>release(Response.json({code:'AUTH_REQUIRED'},{status:401})));
    if(mode==='LATE_SUCCESS')release(Response.json(f.detail.confirmed));
    await f.flush();
   }
   assert.equal(f.authLost(),0,mode);assert.equal(transferAnchor(f),undefined,mode);
   assert.equal(assignmentCalls(f).length,2);
  }finally{release(Response.json({}));await f.close();}
 }
});

test('승인·문제 화면은 검산된 선택 보고에서만 보관 중지 이력을 명시 GET하며 보고 전환에 재조회하지 않는다',async()=>{
 const f=await mount();
 try{
  assert(!f.text().includes(lookup));assert.deepEqual(stopCalls(f),[]);
  await f.report();assert.deepEqual(stopCalls(f),[]);
  await f.click(lookup);await f.wait(()=>f.text().includes('사용자가 중지 요청'));
  assert.deepEqual(stopCalls(f),[{method:'GET',path:stopPath(f.original)}]);
  assert.match(f.text(),/합성 경계/);assert.match(f.text(),/실제 중지·쓰기 회수: 미확인/);
  await f.choose(f.second);assert.doesNotMatch(f.text(),/사용자가 중지 요청/);
  await f.report();assert.equal(stopCalls(f).length,1);
  await f.click(lookup);await f.wait(()=>f.text().includes('사용자가 중지 요청'));
  assert.deepEqual(stopCalls(f).map(v=>v.path),[stopPath(f.original),stopPath(f.second)]);
  assert(f.calls.every(v=>v.method==='GET'));
 }finally{await f.close();}
});

test('선택 보고의 보관 조회는 보호 거절 및 다시 해시한 다른 보고·실행·프로젝트·전송 종류를 닫는다',async()=>{
 for(const mode of ['401','403','404','RESULT','EXECUTION','PROJECT','NORMAL','WRITER']){
  const f=await mount();
  try{
   await f.report();
   f.controls.readStops=()=>Response.json(/^40/.test(mode)?{code:mode==='401'?'AUTH_REQUIRED':mode==='403'?'PROJECT_OPERATION_DENIED':'NOT_FOUND'}:
    updatedHistory(f.original.entry,value=>{
     if(mode==='RESULT')value.resultRef.version++;
     if(mode==='EXECUTION')value.executionRef.contentHash='0'.repeat(64);
     if(mode==='PROJECT')value.projectId=f.original.a.id;
     if(mode==='NORMAL')value.transport='NORMAL_PROTECTED';
     if(mode==='WRITER')value.writerReleaseVerified=true;
    }),{status:/^40/.test(mode)?Number(mode):200});
   await f.click(lookup);
   await f.wait(()=>f.text().includes(/^40/.test(mode)?'보고 원문 미확인':'중지 요청 이력 미확인'));
   assert.doesNotMatch(f.text(),/사용자가 중지 요청/);
   assert.equal(f.authLost(),mode==='401'?1:0);
   assert.deepEqual(stopCalls(f),[{method:'GET',path:stopPath(f.original)}]);
  }finally{await f.close();}
 }
});

test('선택 닫기·새로 확인·다른 보고와 사용자/client/transport 전환 뒤 늦은 401은 인증과 새 보고를 건드리지 않는다',async()=>{
 for(const mode of ['CLOSE','REFRESH','REPORT','USER','CLIENT','TRANSPORT']){
  const f=await mount();
  let release:(value:Response)=>void=()=>{};
  try{
   await f.report();
   const held=new Promise<Response>(resolve=>{release=resolve;});
   f.controls.readStops=()=>held;
   await f.click(lookup);await f.wait(()=>stopCalls(f).length===1);
   const denied=Response.json({code:'AUTH_REQUIRED'},{status:401});
   if(mode==='CLOSE'||mode==='REFRESH'){
    const trigger=f.button(mode==='CLOSE'?'선택 보고 닫기':'선택 보고 원문 다시 확인');
    await f.act(()=>{trigger.dispatchClick();release(denied);});
   }else{
    if(mode==='REPORT'){await f.choose(f.second);await f.report();}
    if(mode==='USER'||mode==='CLIENT'){await f.actor(mode);await f.report();}
    if(mode==='TRANSPORT'){
     f.client.transport=async()=>assert.fail('교체 transport 요청');
     release(denied);await f.flush();
     f.client.transport=f.transport;
    }else release(denied);
   }
   await f.flush();
   assert.equal(f.authLost(),0,mode);
   assert.doesNotMatch(f.text(),/AUTH_REQUIRED|사용자가 중지 요청/,mode);
   assert.equal(stopCalls(f).length,1);
  }finally{release(Response.json({}));await f.close();}
 }
});

test('같은 보고의 과거 중지 페이지도 명시 시작하고, 보고 재조회와 늦은 페이지 401을 분리한다',async()=>{
 const f=await mount();let release:(value:Response)=>void=()=>{};
 try{
  const pagePath=stopPath(f.original).replace(/stop-requests$/,'stop-request-pages');
  f.controls.readStops=()=>Response.json(updatedHistory(f.original.entry,value=>{
   value.items=Array.from({length:20},(_,n)=>({...value.items[0],ref:{...value.items[0].ref,id:String(20-n).padStart(8,'0')+'-1111-4111-8111-111111111111'}}));
   value.hasMore=true;
  }));
  f.controls.readPages=()=>new Promise<Response>(resolve=>{release=resolve;});
  await f.report();await f.click(lookup);await f.wait(()=>f.text().includes('표시 요청 20건'));
  assert.equal(f.calls.filter(call=>call.path===pagePath).length,0);
  await f.click('과거 중지 요청 페이지 탐색');await f.wait(()=>f.calls.some(call=>call.path===pagePath));
  const refresh=f.button('선택 보고 원문 다시 확인');
  await f.act(()=>{refresh.dispatchClick();release(Response.json({code:'AUTH_REQUIRED'},{status:401}));});
  await f.wait(()=>f.text().includes('검수 미실행'));
  assert.equal(f.authLost(),0);
  assert.equal(f.calls.filter(call=>call.path===pagePath).length,1);
  assert.equal(stopCalls(f).length,1);
  assert.doesNotMatch(f.text(),/AUTH_REQUIRED|사용자가 중지 요청/);
 }finally{release(Response.json({}));await f.close();}
});

test('다른 보호 패널이 보고를 숨기거나 StrictMode에서 화면을 나가면 늦은 중지 요청 401은 인증을 지우지 않는다',async()=>{
 for(const mode of ['ISSUE_DENIED','STRICT_EXIT']){
  const f=await mount(mode==='STRICT_EXIT');
  let release:(value:Response)=>void=()=>{};
  try{
   await f.report();
   f.controls.readStops=()=>new Promise<Response>(resolve=>{release=resolve;});
   await f.click(lookup);await f.wait(()=>stopCalls(f).length===1);
   const denied=Response.json({code:'AUTH_REQUIRED'},{status:401});
   if(mode==='ISSUE_DENIED'){
    f.controls.readIssueBasis=()=>Response.json({code:'PROJECT_OPERATION_DENIED'},{status:403});
    await f.click('문제 근거 조회');
    await f.wait(()=>f.text().includes('보고 원문 미확인'));
    release(denied);
   }else{
    await f.exit(()=>release(denied));
    assert.match(f.text(),/다른 화면/);
   }
   await f.flush();
   assert.equal(f.authLost(),0);
   assert.equal(stopCalls(f).length,1);
   assert.doesNotMatch(f.text(),/AUTH_REQUIRED|사용자가 중지 요청/);
  }finally{release(Response.json({}));await f.close();}
 }
});
