import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {resultFixture} from './result-view-fixture.ts';
import {reworkFixture} from '../FN12/result-rework-input-fixture.ts';
import {criteriaId as id,criteriaHash as hash} from '../FN12/result-criteria-fixture.ts';
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
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:stored-rework',name:'StoredReviewTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'rework-memory-entry',transform(code,id){if(id.replaceAll('\\','/').endsWith('/ResultReviewSources.tsx'))return code+'\nexport {StoredResultReviewHistory};';},resolveId(id){if(id.endsWith('virtual:stored-rework'))return '\0stored-rework';},load(id){if(id==='\0stored-rework')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{StoredResultReviewHistory}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};export{React,createRoot,StoredResultReviewHistory,ApiClient};`;}}]});
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
 async function render(){await ui.React.act(async()=>root.render(ui.React.createElement(ui.StoredResultReviewHistory,props)));}
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

async function mountReviewEvidence(fault=''){
 const h=await mount(),f=reworkFixture(),{assignment,result,criteria,review}=f.sources;
 const {contentHash}=await import('../../../contracts/canonical.ts');
 const {prepareReportedCoverage}=await import('../../../apps/server/modules/results/reported-coverage.ts');
 const text='합성 보관 시험 근거',artifact={id:id(145),version:1,contentHash:contentHash(text)},m:any=result.snapshot.manifest;
 m.baselineRefs=structuredClone(criteria.snapshot.baselineRefs);m.artifactRefs=[artifact];m.unexecuted=[];
 m.testResults=[{criterionId:'save',testId:'SAVE-01',baselineRefs:m.baselineRefs,expected:'저장 확인',actual:'수행자 보고',status:'PASS',evidence:[{sourceKind:'TEST_ARTIFACT',ref:artifact,contentHash:artifact.contentHash,environmentRef:criteria.snapshot.items[0]!.environmentRef,recordedAt:result.snapshot.submittedAt}]}];
 result.snapshot.manifestHash=hash(m);result.ref.contentHash=hash(result.snapshot);review.snapshot.input.resultRef=structuredClone(result.ref);review.ref.contentHash=hash(review.snapshot);
 const calls:string[]=[],gate=Promise.withResolvers<Response>();let delayed=false;
 const prefix='/api/v1/projects/'+assignment.projectId,coveragePath=prefix+'/results/'+result.ref.id+'/criteria/'+criteria.ref.id+'/versions/1/reported-coverage',filePath=prefix+'/results/'+result.ref.id+'/artifacts/'+artifact.id+'/text';
 const coverage=()=>prepareReportedCoverage(result,{ref:criteria.ref,snapshot:criteria.snapshot},f.now);
 const file=()=>({projectId:assignment.projectId,resultRef:result.ref,artifactRef:artifact,bytes:Buffer.byteLength(text),mediaType:'text/plain;charset=utf-8',text,sourceState:'REGISTERED_BYTES_ONLY',evidenceProvenanceVerified:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false,observedAt:f.now});
 h.props.result=result;h.props.assignment=assignment;h.props.client=new ui.ApiClient(async(url:any,init:any)=>{
  assert.equal(init.method,'GET');const path=String(url);calls.push(path);
  if(path.endsWith('/review-pages')){const page=h.page(null);return Response.json({...page,resultRef:result.ref,items:[{ref:review.ref,criteriaRef:criteria.ref,outcome:review.snapshot.input.outcome,reviewedBy:review.snapshot.reviewedBy,sameAsSubmitter:review.snapshot.sameAsSubmitter,reviewedAt:review.snapshot.reviewedAt,reviewStored:true,completionAccepted:false,formalFailureCounted:false,evidenceProvenanceVerified:false,executionAuthorized:false,dispatchPerformed:false}],hasMore:false,nextCursor:null});}
  if(path===prefix+'/result-reviews/'+review.ref.id)return Response.json(review);
  if(path===prefix+'/result-criteria/'+criteria.ref.id+'/versions/1'){const value=structuredClone(criteria);if(fault==='criteria')value.ref.contentHash='f'.repeat(64);return Response.json(value);}
  if(path===coveragePath){if(fault==='403'||fault==='401')return Response.json({code:'ACCESS_DENIED'},{status:Number(fault)});if(fault.startsWith('late')){delayed=true;return gate.promise;}const value=coverage();if(fault==='result')value.resultRef={...value.resultRef,contentHash:'f'.repeat(64)};return Response.json(value);}
  if(path===filePath)return Response.json(file());
  assert.fail('승인되지 않은 합성 GET');
 });
 await h.render();return{...h,calls,text,review,criteria,coveragePath,filePath,gate,coverage,delayed:()=>delayed};
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
 }finally{await h.close();}
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
