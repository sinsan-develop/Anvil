import test,{after,before} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {ApiClient,ApiError} from '../../../apps/web/src/api/client.ts';
import {createReportedEvidenceTrace} from '../../../apps/web/src/features/session-detail/reported-evidence-trace.ts';
import {readReportedEvidenceArtifact} from '../../../apps/web/src/features/session-detail/reported-evidence-artifact.ts';
import type {SubmittedResultView} from '../../../apps/web/src/features/session-detail/result-api.ts';
import type {RegisteredCriteria} from '../../../apps/web/src/features/session-detail/result-criteria-api.ts';
import type {TraceRef} from '../../../apps/web/src/features/design-trace/trace-api.ts';
import {contentHash} from '../../../contracts/canonical.ts';
import {assignmentPlanFixture,planProject} from './assignment-plan-original-fixture.ts';
import {resultFixture,hash} from './result-view-fixture.ts';

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
const at='2026-10-20T00:00:00.000Z';
async function fixture(){
 const {detail,plan,task}=assignmentPlanFixture(),testResult=resultFixture();
 const indexed={kind:'DESIGN_ITEM' as const,id:id(21),versionRef:plan.designRef,localCode:'DES-01',anchor:'line:23'};
 const screen={kind:'SCREEN_REGION' as const,id:id(22),versionRef:ref(23),localCode:'UI-06',anchor:'line:12'};
 task.designRefs=[indexed];task.screenRefs=[screen];
 const {ref:planRef,status,executionEvidence,observedAt,...planSnapshot}=plan;
 planRef.contentHash=hash(planSnapshot);
 detail.draft.snapshot.basis.taskCardHash=hash(task);
 detail.draft.ref.contentHash=hash(detail.draft.snapshot);
 detail.confirmed!.ref.contentHash=hash(detail.confirmed!.snapshot);
 const assignmentRef=detail.confirmed!.ref,environmentRef=ref(25),baselineRefs=[planRef],text='합성 근거 원문';
 const artifact={...ref(24),contentHash:contentHash(text)};
 const result=testResult.entry as unknown as SubmittedResultView;
 Object.assign(result.snapshot.scope,{assignmentRef,projectId:planProject});
 Object.assign(result.snapshot.manifest,{assignmentRef,baselineRefs,artifactRefs:[artifact],unexecuted:[],
  testResults:[{criterionId:'verify',testId:'T1',baselineRefs,status:'PASS',evidence:[
   {ref:artifact,environmentRef,sourceKind:'TEST_ARTIFACT',contentHash:artifact.contentHash,recordedAt:at}
  ]}]});
 result.snapshot.manifestHash=hash(result.snapshot.manifest);
 result.ref.contentHash=hash(result.snapshot);
 const criteriaSnapshot={assignmentRef,baselineRefs,items:[{criterionId:'verify',testId:'T1',kind:'UNIT',environmentRef,required:true}]};
 const criteria={projectId:planProject,ref:{...ref(26),contentHash:hash(criteriaSnapshot)},snapshot:criteriaSnapshot,
  registryStored:true,reviewStored:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false} as unknown as RegisteredCriteria;
 const evidence=await readReportedEvidenceArtifact(new ApiClient(async()=>Response.json({
  projectId:planProject,resultRef:result.ref,artifactRef:artifact,bytes:Buffer.byteLength(text),mediaType:'text/plain;charset=utf-8',text,
  sourceState:'REGISTERED_BYTES_ONLY',evidenceProvenanceVerified:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false,observedAt:at
 })),result,criteria,{criterionId:'verify',reportIndex:0,evidenceIndex:0},()=>true);
 assert(evidence?.bytesState==='MATCHED_REGISTERED_BYTES');
 const source={kind:'ARTIFACT' as const,id:artifact.id,versionRef:artifact},job={kind:'PLAN_TASK' as const,id:planRef.id,versionRef:planRef,localCode:task.taskCode};
 const otherJob={...job,id:id(27),versionRef:ref(27)};
 const edge=(from:TraceRef,to:TraceRef,n:number,relation:'IMPLEMENTS'|'DEPENDS_ON'='IMPLEMENTS')=>{
  const data={from,to,relation,reason:'합성 저장 연결',designRefs:[plan.designRef]};
  return {id:id(n),...data,edgeHash:hash(data),createdAt:at};
 };
 const proof=edge(source,job,10),toDesign=edge(job,indexed,11),toScreen=edge(job,screen,12);
 function page(edges:ReturnType<typeof edge>[],nextCursor:string|null=null){
  const nodes=[...new Map(edges.flatMap(e=>[e.from,e.to]).map(endpoint=>[JSON.stringify(endpoint),endpoint])).values()].map(endpoint=>({
   ref:endpoint,title:endpoint.kind==='DESIGN_ITEM'?'고정 설계 항목':endpoint.localCode??'등록 원문',
   designRefs:endpoint.kind==='ARTIFACT'?[]:[plan.designRef]
  }));
  return {designRef:plan.designRef,direction:'REVERSE',nodes,edges,traversal:edges.map(e=>({edgeId:e.id,from:e.to,to:e.from})),
   missingLinks:[],unknownEvidence:[{code:'EXECUTION_SOURCE_NOT_CONNECTED'},{code:'TEST_EVIDENCE_SOURCE_NOT_CONNECTED'}],
   baselineRef:null,hasMore:nextCursor!==null,nextCursor,observedAt:at};
 }
 return {detail,result,criteria,evidence,source,job,otherJob,indexed,screen,edge,proof,toDesign,toScreen,plan,page};
}

test('reverse_trace_from_test는 명시 GET 두 종류로 양쪽 실제 edge와 고정 설계·시안 위치를 확인한다',async()=>{
 const f=await fixture(),calls:string[]=[];
 const client=new ApiClient(async(path,init)=>{
  assert.equal(init?.method,'GET');assert.equal(init?.credentials,'same-origin');calls.push(String(path));
  return Response.json(calls.length===1?f.plan:f.page([f.proof,f.toDesign,f.toScreen]));
 });
 const lookup=createReportedEvidenceTrace(client,f.detail,f.result,f.evidence,()=>true);
 assert.deepEqual(calls,[]);
 const v=await lookup.next();
 assert.equal(v?.state,'FINISHED');
 assert.deepEqual(v?.matches.map(m=>[m.target.anchor,m.title,m.artifactEdgeId,m.targetEdgeId]),
  [['line:23','고정 설계 항목',f.proof.id,f.toDesign.id],['line:12','UI-06',f.proof.id,f.toScreen.id]]);
 assert.equal(calls[0],`/api/v1/projects/${planProject}/work-plans/${f.plan.ref.id}/versions/${f.plan.ref.version}`);
 assert.equal(calls[1],`/api/v1/projects/${planProject}/traces?designId=${f.plan.designRef.id}&version=1&direction=REVERSE&limit=50`);
 assert.equal(await lookup.next(),null);
});

test('첫 페이지가 부족하면 명시 다음 페이지까지 후보를 숨기고 다른 계획·무관 위치를 배제한다',async()=>{
 const f=await fixture(),offCard={...f.indexed,id:id(28)},calls:string[]=[];
 const responses=[f.plan,f.page([f.edge(f.source,f.otherJob,13),f.toDesign],'next'),f.page([f.proof,f.edge(f.job,offCard,14)])];
 const lookup=createReportedEvidenceTrace(new ApiClient(async path=>{calls.push(String(path));return Response.json(responses.shift());}),f.detail,f.result,f.evidence,()=>true);
 assert.deepEqual(await lookup.next(),{state:'MORE',matches:[]});
 assert.equal(calls.length,2);
 assert.deepEqual((await lookup.next())?.matches.map(m=>m.target),[f.indexed]);
 assert.equal(calls.length,3);assert.equal(new URL(calls[2]!,'https://anvil.invalid').searchParams.get('cursor'),'next');
});

test('동일 cursor·중복 연결·충돌한 대상 메타데이터는 결과를 숨긴다',async()=>{
 const f=await fixture();
 const changed=f.page([f.toDesign]);
 changed.nodes.find(n=>n.ref.id===f.indexed.id)!.title='다른 명칭';
 const sameIdDifferentTarget=f.page([f.edge(f.job,f.screen,11)]);
 assert.equal(sameIdDifferentTarget.edges[0]?.id,f.toDesign.id);
 assert.notEqual(sameIdDifferentTarget.edges[0]?.edgeHash,f.toDesign.edgeHash);
 for(const next of [f.page([],'next'),f.page([f.edge(f.source,f.job,61)]),changed,sameIdDifferentTarget]){
  const reactions=[f.plan,f.page([f.proof,f.toDesign],'next'),next];
  const lookup=createReportedEvidenceTrace(new ApiClient(async()=>Response.json(reactions.shift())),f.detail,f.result,f.evidence,()=>true);
  assert.deepEqual(await lookup.next(),{state:'MORE',matches:[]});
  await assert.rejects(lookup.next(),{code:'REPORTED_EVIDENCE_TRACE_INCONSISTENT'});
  assert.equal(await lookup.next(),null);
 }
});

test('교차 프로젝트·임무·실행/증거 ref·불일치 파일은 GET0으로 거절한다',async()=>{
 const f=await fixture(),client=new ApiClient(async()=>{assert.fail('unexpected GET');});
 for(const [detail,result,evidence] of [
  [{...f.detail,projectId:id(41)},f.result,f.evidence],
  [{...f.detail,confirmed:null},f.result,f.evidence],
  [f.detail,{...f.result,snapshot:{...f.result.snapshot,scope:{...f.result.snapshot.scope,executionRef:ref(42)}}},f.evidence],
  [f.detail,f.result,{...f.evidence,resultRef:ref(43)}],
  [f.detail,f.result,{...f.evidence,file:{...f.evidence.file,artifactRef:ref(44)}}],
  [f.detail,f.result,{...f.evidence,bytesState:'NOT_QUERIED_BINDING_MISMATCH',file:null} as const]
 ] as const){
  const lookup=createReportedEvidenceTrace(client,detail,result,evidence,()=>true);
  await assert.rejects(lookup.next(),{code:'REPORTED_EVIDENCE_TRACE_BINDING_INVALID'});
 }
});

test('401/403/404 원 오류를 보존하며 선택 이탈·transport 변경·동시 클릭은 후속 효과0',async()=>{
 const f=await fixture();
 for(const status of [401,403,404]){
  let calls=0;
  const client=new ApiClient(async()=>++calls===1?Response.json(f.plan):Response.json({code:'SOURCE_UNAVAILABLE'},{status}));
  const lookup=createReportedEvidenceTrace(client,f.detail,f.result,f.evidence,()=>true);
  await assert.rejects(lookup.next(),e=>e instanceof ApiError&&e.status===status);
  assert.equal(await lookup.next(),null);assert.equal(calls,2);
 }
 for(const replaceTransport of [false,true]){
  let active=true,calls=0,send!:(response:Response)=>void,enter!:()=>void;
  const gate=new Promise<Response>(resolve=>{send=resolve;});
  const entered=new Promise<void>(resolve=>{enter=resolve;});
  const client=new ApiClient(()=>{calls++;enter();return gate;});
  const lookup=createReportedEvidenceTrace(client,f.detail,f.result,f.evidence,()=>active);
  const pending=lookup.next();
  await entered;
  assert.equal(await lookup.next(),null);
  if(replaceTransport)client.transport=async()=>{assert.fail('unexpected replacement GET');};else active=false;
  send(Response.json({code:'AUTH_REQUIRED'},{status:401}));
  assert.equal(await pending,null);assert.equal(calls,1);
 }
});

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

const location={hash:'#/projects/'+planProject+'/sessions'};
let ui:any;const savedGlobals=new Map<string,PropertyDescriptor|undefined>(),channels:MessageChannel[]=[],NativeChannel=globalThis.MessageChannel;class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
before(async()=>{const component=fileURLToPath(new URL('../../../apps/web/src/features/session-detail/ReportedEvidenceFiles.tsx',import.meta.url)),api=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url));const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:reported-evidence',name:'ReportedEvidenceTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'reported-evidence-memory',resolveId(id){if(id.endsWith('virtual:reported-evidence'))return '\0reported-evidence';},load(id){if(id==='\0reported-evidence')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{ReportedEvidenceFiles}from${JSON.stringify(component)};import{ApiClient}from${JSON.stringify(api)};export{React,createRoot,ReportedEvidenceFiles,ApiClient};`;}}]});const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;for(const[key,value]of Object.entries({window,document,location,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){savedGlobals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return ReportedEvidenceTest;')();});
after(()=>{for(const channel of channels){channel.port1.close();channel.port2.close();}for(const[key,descriptor]of savedGlobals)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete(globalThis as any)[key];});

test('React 근거 파일에서만 명시 역추적, 다음 페이지, 닫기와 지연401 무효화를 확인한다',async()=>{
 const f=await fixture(),calls:string[]=[],container=document.createElement('div');
 document.body.appendChild(container);
 const root=ui.createRoot(container),nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(child=>nodes(child))];
 let traces=0,lost=0,unavailable=0,holdTrace=false,traceResponse:Response|null=null,release:((value:Response)=>void)|undefined;
 const client=new ui.ApiClient(async(path:string,init:RequestInit)=>{
  assert.equal(init.method,'GET');calls.push(path);
  if(path.endsWith('/text'))return Response.json(f.evidence.file);
  if(path.includes('/work-plans/'))return Response.json(f.plan);
  assert(path.includes('/traces?'));
  if(holdTrace)return new Promise<Response>(resolve=>{release=resolve;});
  if(traceResponse)return traceResponse;
  return Response.json(++traces===1?f.page([f.proof],'continue'):f.page([f.toDesign,f.toScreen]));
 });
 const coverage={items:[{criterionId:'verify',testId:'T1',requiredKind:'UNIT',reports:[{evidence:[{}]}]}]};
 const session={user:{id:id(51)},clientId:id(52),csrfToken:'c'.repeat(43)};
 const props={client,result:f.result,criteria:f.criteria,coverage,onAuthenticationLost:()=>{lost++;},onAccessUnavailable:()=>{unavailable++;}};
 const button=(label:string)=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===label);
 const render=async(withContext:boolean)=>ui.React.act(async()=>root.render(ui.React.createElement(ui.ReportedEvidenceFiles,
  withContext?{...props,session,traceDetail:f.detail}:props)));
 const click=async(label:string)=>{const n=button(label);assert(n,label);await ui.React.act(async()=>n.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const settle=async(check:()=>boolean)=>{
  for(let i=0;i<80&&!check();i++)await ui.React.act(async()=>{await new Promise(resolve=>setImmediate(resolve));});
  assert(check());
 };
 const open='시험 근거에서 원 설계 위치 확인',close='시험 근거 설계 위치 닫기';
 const links=()=>nodes().filter(n=>n.tagName==='A');
 try{
  await render(false);
  assert.equal(calls.length,0);
  await click('근거 파일 대조 verify 보고 1 근거 1');
  await settle(()=>container.textContent.includes('합성 근거 원문'));
  assert.equal(button(open),undefined);
  await render(true);
  assert(button(open));
  assert.equal(calls.length,1);
  await click(open);
  await settle(()=>!!button('다음 설계 연결 더 보기'));
  assert.equal(calls.length,3);
  assert.doesNotMatch(container.textContent,/line:23/);
  assert.deepEqual(links(),[]);
  await click('다음 설계 연결 더 보기');
  await settle(()=>container.textContent.includes('line:23'));
  assert.equal(calls.length,4);
  assert.match(container.textContent,/고정 설계 항목/);
  assert.match(container.textContent,/출처·완료는 미검증/);
  assert.deepEqual(links().map(link=>link.getAttribute('href')),[f.indexed,f.screen].map(({versionRef:r})=>'#/projects/'+planProject+'/documents/'+r.id+'/versions/'+r.version+'/'+r.contentHash));
  const currentLinks=links();
  for(const link of currentLinks)assert(link.dispatchEvent({type:'click',button:0,bubbles:true}));
  const route=location.hash;location.hash='#/projects';
  try{
   for(const link of currentLinks){
    assert.equal(link.dispatchEvent({type:'click',button:0,bubbles:true}),false);
    assert.equal(link.dispatchEvent({type:'auxclick',button:1,bubbles:true}),false);
   }
  }finally{location.hash=route;}
  assert.equal(calls.length,4);
  await click(close);
  assert.deepEqual(links(),[]);
  assert.doesNotMatch(container.textContent,/line:23/);
  holdTrace=true;
  await click(open);
  await settle(()=>!!release);
  await click(close);
  await ui.React.act(async()=>release?.(Response.json({code:'AUTH_REQUIRED'},{status:401})));
  assert.equal(calls.length,6);
  assert.equal(lost,0);assert.equal(unavailable,0);
  assert.doesNotMatch(container.textContent,/AUTH_REQUIRED|line:23/);
  holdTrace=false;
  traceResponse=Response.json({code:'ACCESS_DENIED'},{status:403});
  await click(open);await settle(()=>container.textContent.includes('ACCESS_DENIED'));
  assert.equal(unavailable,1);assert.deepEqual(links(),[]);
  await click(close);
  const wrongTarget={...f.indexed,versionRef:{...f.indexed.versionRef,contentHash:'b'.repeat(64)}};
  traceResponse=Response.json(f.page([f.proof,f.edge(f.job,wrongTarget,16)]));
  await click(open);await settle(()=>container.textContent.includes('REPORTED_EVIDENCE_TRACE_INCONSISTENT'));
  assert.deepEqual(links(),[]);assert.equal(lost,0);assert.equal(calls.length,10);
 }finally{
  await ui.React.act(async()=>{release?.(Response.json(f.page([])));root.unmount();});
  document.body.removeChild(container);
 }
});
