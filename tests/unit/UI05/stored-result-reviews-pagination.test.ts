import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {resultFixture} from './result-view-fixture.ts';
import {reworkFixture} from '../FN12/result-rework-input-fixture.ts';
import {criteriaId as id,criteriaHash as hash} from '../FN12/result-criteria-fixture.ts';
import {assignmentPlanFixture} from './assignment-plan-original-fixture.ts';
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
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/session-detail/ResultReviewSources.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:stored-rework',name:'StoredReviewTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'rework-memory-entry',transform(code,id){if(id.replaceAll('\\','/').endsWith('/ResultReviewSources.tsx'))return code+'\nexport {StoredResultReviewHistory};';},resolveId(id){if(id.endsWith('virtual:stored-rework'))return '\0stored-rework';},load(id){if(id==='\0stored-rework')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{StoredResultReviewHistory,ResultReviewSources}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};export{React,createRoot,StoredResultReviewHistory,ResultReviewSources,ApiClient};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return StoredReviewTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});

const rootCursor='root.'+'a'.repeat(64),cursor=rootCursor+'.position.'+'b'.repeat(64);
async function mount(){
 const result=resultFixture().entry,container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container),requests:(string|null)[]=[],originalRequests:string[]=[];let lost=0;
 const state:{many:boolean;mode:number|'DELAY'|null;release:((r:Response)=>void)|null}={many:false,mode:null,release:null};
 const page=(next:string|null)=>{const last=!!next&&next!==rootCursor&&!state.many;return {projectId:props.result.snapshot.scope.projectId,resultRef:props.result.ref,items:Array.from({length:last?1:20},(_,n)=>{const key=id(last?70:90-n);return {ref:{id:key,version:1,contentHash:hash(snapshotFor(key))},criteriaRef:{id:id(20),version:1,contentHash:'b'.repeat(64)},outcome:'BLOCKED',reviewedBy:{kind:'HUMAN',userId:id(6),clientId:id(7)},sameAsSubmitter:id(6)===result.snapshot.submittedByRef.id,reviewedAt:'2026-10-20T00:00:00.000Z',reviewStored:true,completionAccepted:false,formalFailureCounted:false,evidenceProvenanceVerified:false,executionAuthorized:false,dispatchPerformed:false};}),hasMore:!last,nextCursor:state.many?rootCursor+'.position_'+requests.length+'.'+'b'.repeat(64):last?null:cursor,selectionState:'NOT_SELECTED',observedAt:'2026-10-20T00:01:00.000Z',pageSize:20,window:{startedAt:'2026-10-20T00:01:00.000Z',expiresAt:'2026-10-20T00:31:00.000Z'}};};
 const originalSnapshot={scope:result.snapshot.scope,input:{resultRef:result.ref,criteriaRef:{id:id(20),version:1,contentHash:'b'.repeat(64)},outcome:'BLOCKED',items:[{criterionId:'flow',outcome:'BLOCKED',evidenceRefs:[],reason:'보관 이유'}],reason:'선택 원문만 보존'},reviewedBy:{kind:'HUMAN',userId:id(6),clientId:id(7)},sameAsSubmitter:id(6)===result.snapshot.submittedByRef.id,reviewedAt:'2026-10-20T00:00:00.000Z',evidenceProvenanceVerified:false,completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false};
 const snapshotFor=(key:string)=>key===id(70)?{...originalSnapshot,input:{...originalSnapshot.input,reason:'21번째 검수 원문'}}:originalSnapshot;
 const client=()=>new ui.ApiClient(async(url:any,opts:any)=>{
  assert.equal(opts.method,'GET');const u=new URL(String(url),'https://anvil.invalid');
  if(u.pathname.includes('/result-reviews/')){
   const key=u.pathname.split('/').at(-1)!;originalRequests.push(key);const snapshot=snapshotFor(key);
   return Response.json({projectId:result.snapshot.scope.projectId,ref:{id:key,version:1,contentHash:hash(snapshot)},snapshot,reviewStored:true,completionAccepted:false,formalFailureCounted:false,evidenceProvenanceVerified:false,executionAuthorized:false,dispatchPerformed:false,observedAt:'2026-10-20T00:01:00.000Z'});
  }
  assert(u.pathname.endsWith('/review-pages'),'새 page endpoint 소비');const next=u.searchParams.get('cursor');requests.push(next);const mode=state.mode;state.mode=null;
  if(mode==='DELAY')return new Promise<Response>(resolve=>{state.release=resolve;});if(typeof mode==='number')return Response.json({code:'AUTH_REQUIRED'},{status:mode});return Response.json(page(next));
 });
 const props:any={client:client(),result,assignment:reworkFixture().sources.assignment,session:{user:{id:id(6)},clientId:id(7),csrfToken:'c'.repeat(43)},onAuthenticationLost:()=>lost++,onAccessUnavailable:()=>{}};
 const nodes=(n=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))];const buttons=(text:string)=>nodes().filter(n=>n.tagName==='BUTTON'&&n.textContent===text);
 async function render(component=ui.StoredResultReviewHistory){await ui.React.act(async()=>root.render(ui.React.createElement(component,props)));}
 async function flush(){await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});}
 async function waitFor(text:string){for(let i=0;i<100&&!container.textContent.includes(text);i++)await flush();assert(container.textContent.includes(text),'유한 도달: '+text);}
 async function click(text:string){const b=buttons(text);assert.equal(b.length,1,text);assert(!b[0]!.disabled);await ui.React.act(async()=>b[0]!.dispatchEvent({type:'click',button:0,bubbles:true}));}
 await render();return{props,state,requests,originalRequests,container,buttons,client,render,flush,waitFor,click,page,lost:()=>lost,close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
test('실제 검수 React는 첫/다음/이전 page를 명시 GET하고 실패 target을 보존한다',async()=>{const f=await mount();try{assert.equal(f.requests.length,0);await f.click('보관 검수 목록 조회');await f.waitFor('보관 검수 1페이지');f.state.mode=503;await f.click('더 이전 검수 목록 조회');await f.waitFor('검수 이력 미확인');assert(!f.container.textContent.includes('보관 검수 2페이지'));await f.click('같은 검수 목록 다시 조회');await f.waitFor('보관 검수 2페이지');await f.click('더 최근 검수 목록 조회');await f.waitFor('보관 검수 1페이지');assert.deepEqual(f.requests,[null,cursor,cursor,rootCursor]);}finally{await f.close();}});
test('실제 검수 React는 session/client/transport ABA 뒤 옛401을 폐기한다',async()=>{for(const mode of ['SESSION','CLIENT','TRANSPORT']){const f=await mount();try{f.state.mode='DELAY';await f.click('보관 검수 목록 조회');for(let n=0;n<100&&!f.state.release;n++)await f.flush();assert(f.state.release);const release=f.state.release!,original={...f.props};if(mode==='SESSION')f.props.session={...f.props.session,csrfToken:'d'.repeat(43)};if(mode==='CLIENT')f.props.client=f.client();if(mode==='TRANSPORT')f.props.client.transport=f.client().transport;await f.render();if(mode!=='TRANSPORT')Object.assign(f.props,original);await f.render();await f.click('보관 검수 목록 조회');await f.waitFor('보관 검수 1페이지');await ui.React.act(async()=>release(Response.json({code:'AUTH_REQUIRED'},{status:401})));await f.flush();assert.equal(f.lost(),0);assert(f.container.textContent.includes('보관 검수 1페이지'));}finally{await f.close();}}});

test('실제 검수 페이지는 이전위치100을 넘기면 알리고 오래된위치를 버리되 앞으로 계속간다',async()=>{const f=await mount();try{f.state.many=true;await f.click('보관 검수 목록 조회');await f.waitFor('보관 검수 1페이지');for(let n=2;n<=103;n++){await f.click('더 이전 검수 목록 조회');await f.waitFor('보관 검수 '+n+'페이지');}assert(f.container.textContent.includes('이전 위치는 최근100개만'));for(let n=102;n>=3;n--){await f.click('더 최근 검수 목록 조회');await f.waitFor('보관 검수 '+n+'페이지');}assert.equal(f.buttons('더 최근 검수 목록 조회').length,0);assert.equal(f.requests.length,203);}finally{await f.close();}});
test('실제 검수 원문은 명시 선택만 GET하고 페이지 이동/오류에 즉시 숨긴다',async()=>{const f=await mount();try{await f.click('보관 검수 목록 조회');await f.waitFor('보관 검수 1페이지');const before=f.requests.length;await f.click('보관 검수 원문 '+id(90));await f.waitFor('선택 원문만 보존');assert.equal(f.requests.length,before,'페이지 재조회0');f.state.mode='DELAY';await f.click('더 이전 검수 목록 조회');assert(!f.container.textContent.includes('선택 원문만 보존'));for(let n=0;n<100&&!f.state.release;n++)await f.flush();assert(f.state.release);await ui.React.act(async()=>f.state.release!(Response.json({code:'AUTH_REQUIRED'},{status:401})));await f.waitFor('검수 이력 미확인');assert.equal(f.lost(),1);assert(!f.container.textContent.includes('선택 원문만 보존'));}finally{await f.close();}});

test('첫위치 root 복귀의 다른window 응답은 성공위치로 확정하지 않는다',async()=>{const f=await mount();try{await f.click('보관 검수 목록 조회');await f.waitFor('보관 검수 1페이지');await f.click('더 이전 검수 목록 조회');await f.waitFor('보관 검수 2페이지');f.state.mode='DELAY';await f.click('더 최근 검수 목록 조회');for(let n=0;n<100&&!f.state.release;n++)await f.flush();assert(f.state.release);const wrong=f.page(rootCursor);wrong.window={startedAt:'2026-10-20T00:00:00.000Z',expiresAt:'2026-10-20T00:30:00.000Z'};await ui.React.act(async()=>f.state.release!(Response.json(wrong)));await f.waitFor('검수 이력 미확인');assert(!f.container.textContent.includes('보관 검수 1페이지'));await f.click('같은 검수 목록 다시 조회');await f.waitFor('보관 검수 1페이지');assert.deepEqual(f.requests.slice(-2),[rootCursor,rootCursor]);}finally{await f.close();}});

test('같은 window의 다른 root나 반복 cursor는 다음 위치와 원문 동선을 열지 않는다',async t=>{
 for(const mode of ['NEXT_FOREIGN_ROOT','NEXT_REPEAT','BACK_FOREIGN_ROOT'] as const)await t.test(mode,async()=>{
  const f=await mount();try{
   await f.click('보관 검수 목록 조회');await f.waitFor('보관 검수 1페이지');
   const back=mode==='BACK_FOREIGN_ROOT';
   if(back){await f.click('더 이전 검수 목록 조회');await f.waitFor('보관 검수 2페이지');}
   f.state.mode='DELAY';await f.click(back?'더 최근 검수 목록 조회':'더 이전 검수 목록 조회');
   for(let n=0;n<100&&!f.state.release;n++)await f.flush();assert(f.state.release);
   // 오류 응답은 기존 window·정상 페이지 형상을 유지하고 cursor만 바꾼다.
   const wrong={...f.page(rootCursor),nextCursor:mode==='NEXT_REPEAT'?cursor:cursor.replace('root.','foreign.')};
   await ui.React.act(async()=>f.state.release!(Response.json(wrong)));
   await f.waitFor('RESULT_REVIEW_HISTORY_RESPONSE_INVALID');
   assert.equal(f.buttons('더 이전 검수 목록 조회').length,0);
   assert.equal(f.buttons('보관 검수 원문 '+id(90)).length,0);
   assert.deepEqual(f.requests,back?[null,cursor,rootCursor]:[null,cursor]);
   assert.deepEqual(f.originalRequests,[]);assert.equal(f.lost(),0);
   await f.click('같은 검수 목록 다시 조회');await f.waitFor(back?'보관 검수 1페이지':'보관 검수 2페이지');
   assert.equal(f.requests.at(-1),back?rootCursor:cursor);
  }finally{await f.close();}
 });
});
test('21번째 검수의 정확 원문을 선택하고 같은 root 두 분절로 최근 목록에 복귀한다',async()=>{
 const f=await mount();try{
  await f.click('보관 검수 목록 조회');await f.waitFor('보관 검수 1페이지');assert.equal(f.buttons('보관 검수 원문 '+id(70)).length,0);
  await f.click('더 이전 검수 목록 조회');await f.waitFor('보관 검수 2페이지');assert.equal(f.buttons('더 이전 검수 목록 조회').length,0);
  await f.click('보관 검수 원문 '+id(70));await f.waitFor('21번째 검수 원문');assert.deepEqual(f.originalRequests,[id(70)]);
  await f.click('더 최근 검수 목록 조회');await f.waitFor('보관 검수 1페이지');
  assert(!f.container.textContent.includes('21번째 검수 원문'));
  assert.deepEqual(f.requests,[null,cursor,rootCursor]);assert.deepEqual(f.originalRequests,[id(70)]);
 }finally{await f.close();}
});

async function mountReviewEvidence(fault='',withTrace=false){
 const h=await mount(),f=reworkFixture(),{assignment,result,criteria,review}=f.sources;
 const {contentHash}=await import('../../../contracts/canonical.ts');
 const {prepareReportedCoverage}=await import('../../../apps/server/modules/results/reported-coverage.ts');
 const trace=assignmentPlanFixture(),target={kind:'DESIGN_ITEM' as const,id:id(146),versionRef:trace.plan.designRef,localCode:'DES-01',anchor:'line:23'};
 if(withTrace){
  // 같은 합성 확정 임무의 고정 계획/초안 쌍을 만들고 기존 기준 생산자로 모든 참조를 다시 결박한다.
  trace.task.taskCode=assignment.snapshot.definition.taskRef.taskCode;trace.task.designRefs=[target];
  const {ref:planRef,status,executionEvidence,observedAt,...snapshot}=trace.plan;planRef.contentHash=hash(snapshot);
  assignment.snapshot.definition.taskRef.planRef=structuredClone(planRef);assignment.snapshot.definition.baselineRefs=[structuredClone(planRef)];
  const draft=trace.detail.draft,taskRef=assignment.snapshot.definition.taskRef;
  draft.projectId=assignment.projectId;draft.ref.id=assignment.ref.id;draft.snapshot.definition=structuredClone(assignment.snapshot.definition);
  Object.assign(draft.snapshot.basis,{planRef:structuredClone(planRef),applicationRef:taskRef.applicationRef,taskCode:taskRef.taskCode,nodeId:taskRef.nodeId,taskCardHash:hash(trace.task)});
  draft.ref.contentHash=hash(draft.snapshot);assignment.snapshot.draftRef=structuredClone(draft.ref);assignment.ref.contentHash=hash(assignment.snapshot);
  trace.detail.projectId=assignment.projectId;trace.detail.confirmed=assignment;
  const {prepareResultCriteria}=await import('../../../apps/server/modules/results/result-criteria.ts');
  const prepared=prepareResultCriteria(assignment,{...criteria.input,assignmentRef:assignment.ref});
  criteria.snapshot=prepared.criteriaSnapshot;criteria.input=prepared.input;criteria.sourceBindings=prepared.sourceBindings;criteria.ref.contentHash=prepared.contentHash;
  result.snapshot.scope.assignmentRef=structuredClone(assignment.ref);result.snapshot.manifest.assignmentRef=structuredClone(assignment.ref);
  review.snapshot.scope.assignmentRef=structuredClone(assignment.ref);review.snapshot.input.criteriaRef=structuredClone(criteria.ref);
 }
 const text='합성 보관 시험 근거',artifact={id:id(145),version:1,contentHash:contentHash(text)},m:any=result.snapshot.manifest;
 m.baselineRefs=structuredClone(criteria.snapshot.baselineRefs);m.artifactRefs=[artifact];m.unexecuted=[];
 m.testResults=[{criterionId:'save',testId:'SAVE-01',baselineRefs:m.baselineRefs,expected:'저장 확인',actual:'수행자 보고',status:'PASS',evidence:[{sourceKind:'TEST_ARTIFACT',ref:artifact,contentHash:artifact.contentHash,environmentRef:criteria.snapshot.items[0]!.environmentRef,recordedAt:result.snapshot.submittedAt}]}];
 result.snapshot.manifestHash=hash(m);result.ref.contentHash=hash(result.snapshot);review.snapshot.input.resultRef=structuredClone(result.ref);review.ref.contentHash=hash(review.snapshot);
 const calls:string[]=[],gate=Promise.withResolvers<Response>();let delayed=false,sourceCurrent=true;
 const prefix='/api/v1/projects/'+assignment.projectId,coveragePath=prefix+'/results/'+result.ref.id+'/criteria/'+criteria.ref.id+'/versions/1/reported-coverage',filePath=prefix+'/results/'+result.ref.id+'/artifacts/'+artifact.id+'/text';
 const planPath=prefix+'/work-plans/'+trace.plan.ref.id+'/versions/'+trace.plan.ref.version,tracePath=prefix+'/traces?designId='+trace.plan.designRef.id+'&version=1&direction=REVERSE&limit=50';
 const from={kind:'ARTIFACT',id:artifact.id,versionRef:artifact},task={kind:'PLAN_TASK',id:trace.plan.ref.id,versionRef:trace.plan.ref,localCode:trace.task.taskCode};
 const edges=[[from,task],[task,target]].map(([from,to],n)=>{const data={from,to,relation:'IMPLEMENTS',reason:'같은 합성 원문의 저장 연결',designRefs:[trace.plan.designRef]};return{id:id(147+n),...data,edgeHash:hash(data),createdAt:result.snapshot.submittedAt};});
 const tracePage={designRef:trace.plan.designRef,direction:'REVERSE',nodes:[from,task,target].map(ref=>({ref,title:ref.kind==='DESIGN_ITEM'?'고정 설계 항목':ref.kind,designRefs:ref.kind==='ARTIFACT'?[]:[trace.plan.designRef]})),edges,traversal:edges.map(e=>({edgeId:e.id,from:e.to,to:e.from})),missingLinks:[],unknownEvidence:[{code:'EXECUTION_SOURCE_NOT_CONNECTED'},{code:'TEST_EVIDENCE_SOURCE_NOT_CONNECTED'}],baselineRef:null,hasMore:false,nextCursor:null,observedAt:f.now};
 const coverage=()=>prepareReportedCoverage(result,{ref:criteria.ref,snapshot:criteria.snapshot},f.now);
 const file=()=>({projectId:assignment.projectId,resultRef:result.ref,artifactRef:artifact,bytes:Buffer.byteLength(text),mediaType:'text/plain;charset=utf-8',text,sourceState:'REGISTERED_BYTES_ONLY',evidenceProvenanceVerified:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false,observedAt:f.now});
 h.props.result=result;h.props.assignment=assignment;h.props.client=new ui.ApiClient(async(url:any,init:any)=>{
  assert.equal(init.method,'GET');const path=String(url);calls.push(path);
  if(path.endsWith('/review-pages')){if(fault==='history401')return Response.json({code:'AUTH_REQUIRED'},{status:401});const page=h.page(null);return Response.json({...page,resultRef:result.ref,items:[{ref:review.ref,criteriaRef:criteria.ref,outcome:review.snapshot.input.outcome,reviewedBy:review.snapshot.reviewedBy,sameAsSubmitter:review.snapshot.sameAsSubmitter,reviewedAt:review.snapshot.reviewedAt,reviewStored:true,completionAccepted:false,formalFailureCounted:false,evidenceProvenanceVerified:false,executionAuthorized:false,dispatchPerformed:false}],hasMore:false,nextCursor:null});}
  if(path===prefix+'/result-reviews/'+review.ref.id)return Response.json(review);
  if(path===prefix+'/result-criteria/'+criteria.ref.id+'/versions/1'){const value=structuredClone(criteria);if(fault==='criteria')value.ref.contentHash='f'.repeat(64);return Response.json(value);}
  if(path===coveragePath){if(fault==='403'||fault==='401')return Response.json({code:'ACCESS_DENIED'},{status:Number(fault)});if(fault.startsWith('late')){delayed=true;return gate.promise;}const value=coverage();if(fault==='result')value.resultRef={...value.resultRef,contentHash:'f'.repeat(64)};return Response.json(value);}
  if(path===filePath)return Response.json(file());
  if(withTrace&&path===planPath)return Response.json(trace.plan);
  if(withTrace&&path===tracePath){if(fault.startsWith('trace-late')){delayed=true;return gate.promise;}if(fault==='trace401')return Response.json({code:'AUTH_REQUIRED'},{status:401});return Response.json(tracePage);}
  assert.fail('승인되지 않은 합성 GET');
 });
 if(withTrace){h.props.projectId=assignment.projectId;h.props.traceDetail=fault==='trace-cross'?{...trace.detail,projectId:id(151)}:trace.detail;h.props.criteria={session:h.props.session};h.props.isCurrent=()=>sourceCurrent;}
 await h.render(withTrace?ui.ResultReviewSources:ui.StoredResultReviewHistory);return{...h,calls,text,review,criteria,coveragePath,filePath,planPath,tracePath,tracePage,target,gate,coverage,delayed:()=>delayed,invalidate:()=>{sourceCurrent=false;}};
}
async function openReviewCriteria(h:Awaited<ReturnType<typeof mountReviewEvidence>>){
 assert.equal(h.calls.length,0);await h.click('보관 검수 목록 조회');await h.waitFor('보관 검수 1페이지');await h.click('보관 검수 원문 '+h.review.ref.id);await h.waitFor('검수 기준·원조건 열기');
 assert.equal(h.calls.length,2);await h.click('검수 기준·원조건 열기');await h.waitFor('조건별 실제 시험 계획');
}
test('보관 검수 실제 부모는 고정 기준에서 원 제출 보고·등록 근거를 명시 조회한다',async()=>{
 const h=await mountReviewEvidence();try{
  await openReviewCriteria(h);assert.equal(h.calls.length,3);assert.equal(h.buttons('조건별 보고 부족 대조').length,1);
  await h.click('조건별 보고 부족 대조');await h.waitFor('근거 파일 대조 save 보고 1 근거 1');assert.equal(h.calls.length,4);assert.equal(h.calls[3],h.coveragePath);assert(!h.container.textContent.includes(h.text));
  await h.click('근거 파일 대조 save 보고 1 근거 1');await h.waitFor(h.text);assert.equal(h.calls[4],h.filePath);assert.equal(h.calls.length,5);assert(h.container.textContent.includes('실행은 하지 않았습니다'));
  assert.equal(h.buttons('시험 근거에서 원 설계 위치 확인').length,0,'보호 임무 원문이 없으면 역조회 후보를 만들지 않음');
 }finally{await h.close();}
});

test('보관 검수의 실제 결과 부모는 같은 제출 근거에서 고정 계획과 원 설계로 명시 역조회한다',async()=>{
 const h=await mountReviewEvidence('',true);try{
  await openReviewCriteria(h);await h.click('조건별 보고 부족 대조');await h.waitFor('근거 파일 대조 save 보고 1 근거 1');
  assert.equal(h.buttons('시험 근거에서 원 설계 위치 확인').length,0);assert.equal(h.calls.length,4);
  await h.click('근거 파일 대조 save 보고 1 근거 1');await h.waitFor(h.text);assert.equal(h.calls.length,5);
  assert.equal(h.buttons('시험 근거에서 원 설계 위치 확인').length,1,'저장 검수에서도 같은 보호 역조회 소비자를 제공');
  await h.click('시험 근거에서 원 설계 위치 확인');await h.waitFor('고정 설계 원문 열기');
  assert.deepEqual(h.calls.slice(5),[h.planPath,h.tracePath]);
  const nodes=(n:MemoryNode):MemoryNode[]=>[n,...n.childNodes.flatMap(nodes)],links=nodes(h.container).filter(n=>n.tagName==='A'&&n.textContent==='고정 설계 원문 열기');assert.equal(links.length,1);
  const {parseRoute}=await import('../../../apps/web/src/shell/routes.ts'),route=parseRoute(links[0]!.getAttribute('href')!);
  assert.equal(route.screen,'documents');assert.equal(route.projectId,h.props.result.snapshot.scope.projectId);assert.deepEqual(route.documentRef,h.target.versionRef);
  assert(h.container.textContent.includes(h.target.anchor));assert(h.container.textContent.includes(h.review.ref.contentHash));
  assert(h.container.textContent.includes('명령과 종료 코드·출처·완료는 미검증'));assert.equal(h.lost(),0);
 }finally{await h.close();}
});

test('보관 검수 역조회는 다른 프로젝트 원문을 현재 임무로 대체하지 않는다',async()=>{
 const h=await mountReviewEvidence('trace-cross',true);try{
  await openReviewCriteria(h);await h.click('조건별 보고 부족 대조');await h.waitFor('근거 파일 대조 save 보고 1 근거 1');
  await h.click('근거 파일 대조 save 보고 1 근거 1');await h.waitFor('시험 근거에서 원 설계 위치 확인');
  assert.equal(h.calls.length,5);await h.click('시험 근거에서 원 설계 위치 확인');await h.waitFor('REPORTED_EVIDENCE_TRACE_BINDING_INVALID');
  assert.equal(h.calls.length,5,'교차 결박은 계획/연결 GET 전에 거절');assert(!h.container.textContent.includes('고정 설계 원문 열기'));assert.equal(h.lost(),0);
 }finally{await h.close();}
});

test('보관 검수·페이지·근거 선택과 재조회는 React commit 전 옛 설계 링크를 무효화한다',async t=>{
 for(const action of ['보관 검수 원문','보관 검수 목록 다시 조회','근거 파일 대조 save 보고 1 근거 1','선택 근거 파일 다시 대조'])await t.test(action,async()=>{
 const h=await mountReviewEvidence('',true);try{
  await openReviewCriteria(h);await h.click('조건별 보고 부족 대조');await h.waitFor('근거 파일 대조 save 보고 1 근거 1');await h.click('근거 파일 대조 save 보고 1 근거 1');await h.waitFor('시험 근거에서 원 설계 위치 확인');await h.click('시험 근거에서 원 설계 위치 확인');await h.waitFor('고정 설계 원문 열기');
  const nodes=(n:MemoryNode):MemoryNode[]=>[n,...n.childNodes.flatMap(nodes)],link=nodes(h.container).find(n=>n.tagName==='A'&&n.textContent==='고정 설계 원문 열기')!;
  await ui.React.act(()=>{
   h.buttons(action==='보관 검수 원문'?action+' '+h.review.ref.id:action)[0]!.dispatchEvent({type:'click',button:0,bubbles:true});
   assert(h.container.contains(link),'아직 이전 child가 commit 전 DOM에 남음');
   for(const type of ['click','auxclick']){const event:any={type,button:type==='click'?0:1,bubbles:true};link.dispatchEvent(event);assert.equal(event.defaultPrevented,true);}
  });
  assert.equal(h.calls.filter(path=>path===h.tracePath).length,1);assert.equal(h.lost(),0);
 }finally{await h.close();}
 });
});

test('보관 검수 상위 current 폐기는 남은 옛 근거·역조회 클릭의 GET도 막는다',async()=>{
 const h=await mountReviewEvidence('',true);try{
  await openReviewCriteria(h);await h.click('조건별 보고 부족 대조');await h.waitFor('근거 파일 대조 save 보고 1 근거 1');await h.click('근거 파일 대조 save 보고 1 근거 1');await h.waitFor('시험 근거에서 원 설계 위치 확인');
  h.invalidate();await h.click('시험 근거에서 원 설계 위치 확인');await h.click('근거 파일 대조 save 보고 1 근거 1');await h.flush();assert.equal(h.calls.length,5);assert.equal(h.lost(),0);
 }finally{await h.close();}
});

for(const status of [200,401])test('보관 검수 상위 current 폐기 뒤 같은 props의 늦은 trace '+status+'는 효과0',async()=>{
 const h=await mountReviewEvidence('trace-late',true);try{
  await openReviewCriteria(h);await h.click('조건별 보고 부족 대조');await h.waitFor('근거 파일 대조 save 보고 1 근거 1');await h.click('근거 파일 대조 save 보고 1 근거 1');await h.waitFor('시험 근거에서 원 설계 위치 확인');await h.click('시험 근거에서 원 설계 위치 확인');
  for(let n=0;n<100&&!h.delayed();n++)await h.flush();assert(h.delayed());h.invalidate();const count=h.calls.length;
  h.gate.resolve(status===401?Response.json({code:'AUTH_REQUIRED'},{status}):Response.json(h.tracePage));await h.flush();await h.flush();
  assert.equal(h.lost(),0);assert.equal(h.calls.length,count);assert(!h.container.textContent.includes('고정 설계 원문 열기'));
 }finally{h.gate.resolve(Response.json(h.tracePage));await h.close();}
});

test('보관 검수 현재 trace401은 보존하되 접근 callback의 재진입 폐기 뒤 인증 효과를 이어가지 않는다',async()=>{
 for(const reenter of [false,true]){
  const h=await mountReviewEvidence('trace401',true);let unavailable=0;try{
   h.props.onAccessUnavailable=()=>{unavailable++;if(reenter)h.invalidate();};await h.render(ui.ResultReviewSources);
   await openReviewCriteria(h);await h.click('조건별 보고 부족 대조');await h.waitFor('근거 파일 대조 save 보고 1 근거 1');await h.click('근거 파일 대조 save 보고 1 근거 1');await h.waitFor('시험 근거에서 원 설계 위치 확인');await h.click('시험 근거에서 원 설계 위치 확인');await h.waitFor('AUTH_REQUIRED');
   assert.equal(unavailable,1);assert.equal(h.lost(),reenter?0:1);assert.equal(h.calls.length,7);assert(!h.container.textContent.includes('고정 설계 원문 열기'));
  }finally{await h.close();}
 }
});

test('보관 검수 목록 현재401도 접근 callback 뒤 원 ticket이 유지될 때만 인증 효과를 낸다',async()=>{
 for(const reenter of [false,true]){
  const h=await mountReviewEvidence('history401',true);let unavailable=0;try{
   h.props.onAccessUnavailable=()=>{unavailable++;if(reenter)h.invalidate();};await h.render(ui.ResultReviewSources);
   await h.click('보관 검수 목록 조회');await h.waitFor('AUTH_REQUIRED');assert.equal(unavailable,1);assert.equal(h.lost(),reenter?0:1);assert.equal(h.calls.length,1);
  }finally{await h.close();}
 }
});

test('보관 검수 역조회 pending 뒤 선택·인증·transport 교체의 늦은 원문과401은 폐기한다',async t=>{
 for(const mode of ['SELECTION','SESSION','TRANSPORT'] as const)for(const status of [200,401])await t.test(mode+' '+status,async()=>{
  const h=await mountReviewEvidence('trace-late',true);try{
   await openReviewCriteria(h);await h.click('조건별 보고 부족 대조');await h.waitFor('근거 파일 대조 save 보고 1 근거 1');
   await h.click('근거 파일 대조 save 보고 1 근거 1');await h.waitFor('시험 근거에서 원 설계 위치 확인');await h.click('시험 근거에서 원 설계 위치 확인');
   for(let n=0;n<100&&!h.delayed();n++)await h.flush();assert(h.delayed());assert.deepEqual(h.calls.slice(5),[h.planPath,h.tracePath]);
   if(mode==='SELECTION'){await h.click('보관 검수 원문 '+h.review.ref.id);await h.waitFor('검수 기준·원조건 열기');}
   if(mode==='SESSION'){h.props.criteria={session:{...h.props.session,csrfToken:'d'.repeat(43)}};await h.render(ui.ResultReviewSources);}
   if(mode==='TRANSPORT'){h.props.client.transport=async()=>{assert.fail('교체만으로 보호 GET 하지 않음');};await h.render(ui.ResultReviewSources);}
   const count=h.calls.length;h.gate.resolve(status===401?Response.json({code:'AUTH_REQUIRED'},{status}):Response.json(h.tracePage));await h.flush();await h.flush();
   assert.equal(h.calls.length,count);assert.equal(h.lost(),0);assert.equal(h.buttons('시험 근거 설계 위치 닫기').length,0);assert(!h.container.textContent.includes('고정 설계 원문 열기'));
  }finally{h.gate.resolve(Response.json(h.tracePage));await h.close();}
 });
});
for(const fault of ['criteria','result','403','401','late200','late401'])test('보관 검수 부모의 보고·근거 대조: '+fault+'는 원문0',async()=>{
 const h=await mountReviewEvidence(fault);try{
  if(fault==='criteria'){
   await h.click('보관 검수 목록 조회');await h.waitFor('보관 검수 1페이지');await h.click('보관 검수 원문 '+h.review.ref.id);await h.waitFor('검수 기준·원조건 열기');await h.click('검수 기준·원조건 열기');await h.waitFor('기준 원문 미확인');
   assert.equal(h.buttons('조건별 보고 부족 대조').length,0);assert.equal(h.calls.length,3);
  }else{
   await openReviewCriteria(h);await h.click('조건별 보고 부족 대조');
   if(fault.startsWith('late')){
    for(let n=0;n<100&&!h.delayed();n++)await h.flush();assert(h.delayed());
    h.props.result={...h.props.result,ref:{...h.props.result.ref,id:id(150)}};await h.render();
    h.gate.resolve(fault==='late401'?Response.json({code:'AUTH_REQUIRED'},{status:401}):Response.json(h.coverage()));await h.flush();await h.flush();
    assert.equal(h.buttons('조건별 보고 부족 대조').length,0);assert.equal(h.lost(),0);
   }else{await h.waitFor('부족 대조 미확인');assert.equal(h.lost(),fault==='401'?1:0);}
   assert.equal(h.calls.length,4);assert.equal(h.calls[3],h.coveragePath);
  }
  assert(!h.calls.includes(h.filePath));assert(!h.container.textContent.includes(h.text));assert.equal(h.buttons('근거 파일 대조 save 보고 1 근거 1').length,0);
 }finally{h.gate.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));await h.close();}
});
