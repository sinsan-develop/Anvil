import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {seed} from './registered-preparation-options-fixture.ts';
import {newContextPreparation} from '../../../apps/web/src/features/workspace/context-api.ts';

// 제품 ReactDOM의 이벤트·효과를 실행하는 메모리 DOM이다.
class MemoryNode {
 nodeType:number;nodeName:string;tagName:string;localName:string;namespaceURI='http://www.w3.org/1999/xhtml';
 parentNode:MemoryNode|null=null;childNodes:MemoryNode[]=[];ownerDocument:any;listeners=new Map<string,Array<(event:any)=>void>>();
 attributes=new Map<string,string>();style={};data='';disabled=false;value='';type='';checked=false;
 constructor(name:string,type=1,owner?:any){this.nodeType=type;this.nodeName=type===1?name.toUpperCase():name;this.tagName=this.nodeName;this.localName=name;this.ownerDocument=owner;}
 get firstChild():MemoryNode|null{return this.childNodes[0]??null;}get lastChild():MemoryNode|null{return this.childNodes.at(-1)??null;}
 get nextSibling():MemoryNode|null{const nodes=this.parentNode?.childNodes;return nodes?.[nodes.indexOf(this)+1]??null;}
 get options():MemoryNode[]{return this.childNodes.flatMap(n=>n.tagName==='OPTION'?[n]:n.options);}
 get nodeValue():string|null{return this.nodeType===3?this.data:null;}set nodeValue(v:string|null){if(this.nodeType===3)this.data=v??'';}
 get textContent():string{return this.nodeType===3?this.data:this.childNodes.map(n=>n.textContent).join('');}
 set textContent(v:string){for(const n of this.childNodes)n.parentNode=null;this.childNodes=[];if(v)this.appendChild(this.ownerDocument.createTextNode(String(v)));}
 appendChild(n:MemoryNode){n.parentNode?.removeChild(n);n.parentNode=this;this.childNodes.push(n);return n;}
 insertBefore(n:MemoryNode,b:MemoryNode){n.parentNode?.removeChild(n);const at=this.childNodes.indexOf(b);assert(at>=0);n.parentNode=this;this.childNodes.splice(at,0,n);return n;}
 removeChild(n:MemoryNode){const at=this.childNodes.indexOf(n);assert(at>=0);this.childNodes.splice(at,1);n.parentNode=null;return n;}
 setAttribute(k:string,v:unknown){this.attributes.set(k,String(v));if(k==='disabled')this.disabled=true;}
 removeAttribute(k:string){this.attributes.delete(k);if(k==='disabled')this.disabled=false;}
 getAttribute(k:string){return this.attributes.get(k)??null;}
 addEventListener(k:string,f:(event:any)=>void){this.listeners.set(k,[...(this.listeners.get(k)??[]),f]);}
 removeEventListener(k:string,f:(event:any)=>void){this.listeners.set(k,(this.listeners.get(k)??[]).filter(v=>v!==f));}
 click(){const event={type:'click',button:0,bubbles:true,target:this};for(let n:MemoryNode|null=this;n;n=n.parentNode)for(const f of n.listeners.get(event.type)??[])f(event);}
}
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const kitId='a6170000-0000-4000-8000-000000000011',bodyId='a6170000-0000-4000-8000-000000000012';
const at='2026-11-24T00:00:00.000Z';
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}

test('UI04의 고정 임무는 선택한 단계·업무 범위에서만 후보를 요청하며 정확 원문 선택 전에는 쓰지 않는다',async t=>{
 const document:any=new MemoryNode('#document',9);document.ownerDocument=document;
 document.createElement=(name:string)=>new MemoryNode(name,1,document);
 document.createElementNS=(_ns:string,name:string)=>document.createElement(name);
 document.createTextNode=(text:string)=>{const n=new MemoryNode('#text',3,document);n.data=text;return n;};
 document.documentElement=document.createElement('html');document.body=document.createElement('body');
 document.documentElement.appendChild(document.body);document.appendChild(document.documentElement);document.activeElement=document.body;
 const window={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};
 document.defaultView=window;
 const saved=new Map<string,PropertyDescriptor|undefined>(),channels:MessageChannel[]=[];
 const NativeChannel=globalThis.MessageChannel;
 class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
 for(const[k,v]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){
  saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
 }
 t.after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});
 const source=(name:string)=>JSON.stringify(fileURLToPath(new URL(name,import.meta.url)));
 const bundle:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},
  build:{write:false,lib:{entry:'virtual:context-scope',formats:['iife'],name:'ContextScopeTest'},rolldownOptions:{output:{codeSplitting:false}}},
  plugins:[{name:'context-scope-memory',resolveId(id){if(id.endsWith('virtual:context-scope'))return '\0context-scope';},load(id){if(id==='\0context-scope')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{WorkspaceContextPreparation}from${source('../../../apps/web/src/features/workspace/WorkspaceContextPreparation.tsx')};import{ApiClient}from${source('../../../apps/web/src/api/client.ts')};export{React,createRoot,WorkspaceContextPreparation,ApiClient};`;}}]});
 const ui=new Function((Array.isArray(bundle)?bundle[0]:bundle).output.find((o:any)=>o.type==='chunk').code+';return ContextScopeTest;')();
 const f=seed(),session=f.session,pid=f.confirmed.projectId;
 let confirmed=f.confirmed,buffer=newContextPreparation(confirmed,session,1);
 const task=f.confirmed.snapshot.definition.taskRef,stageRef={applicationRef:task.applicationRef,nodeId:task.nodeId},taskRef={planRef:task.planRef,taskCode:task.taskCode};
 const body='검산된 원문 본문',entry={kind:'FACT',title:'현재 임무 지식 후보',contentRef:{artifactId:bodyId,bytes:Buffer.byteLength(body),contentHash:contentHash(body),mediaType:'text/plain;charset=utf-8'},sourceRefs:[],reason:'업무 검색 근거',scope:{projectId:pid,stageRefs:[stageRef],taskRefs:[taskRef]},relatedRefs:[]};
 const ref={id:kitId,version:1,contentHash:hash(entry)},view={ref,entry,body,state:'PROPOSED',headVersion:1,supersedesRef:null,appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',agentDelivery:'NOT_CONNECTED',history:[{id:bodyId,kind:'PROPOSED',reason:entry.reason,actorRef:{kind:'HUMAN',userId:session.user.id},recordedAt:at}]};
 const hit={versionRef:ref,title:entry.title,kind:'FACT',reasonSnippet:entry.reason,sourceRefs:[],state:'PROPOSED'};
 const reply=(items:unknown[]=[],nextCursor:string|null=null)=>Response.json({items,hasMore:!!nextCursor,nextCursor,searchScope:'TITLE_REASON',observedAt:at});
 const constitutionBody='현재 적용 헌법의 보호 원문';
 const constitutionEntry={...entry,kind:'CONSTITUTION',title:'현재 헌법',contentRef:{...entry.contentRef,bytes:Buffer.byteLength(constitutionBody),contentHash:contentHash(constitutionBody)},scope:{projectId:pid,stageRefs:[],taskRefs:[]}};
 const constitutionRef={id:kitId,version:1,contentHash:hash(constitutionEntry)};
 const criteria={criteriaVersion:1,knowledgeKind:'CONSTITUTION',items:['KNOWLEDGE_PURPOSE','KNOWLEDGE_SOURCE','KNOWLEDGE_REASON','KNOWLEDGE_SCOPE','KNOWLEDGE_LIMITS'].map(criterionId=>({criterionId,title:criterionId}))};
 const review={ref:{id:'00000000-0000-4000-8000-000000000020',targetRef:constitutionRef,criteriaVersion:1,outcome:'ACCEPTED'},criteria,items:criteria.items.map(i=>({criterionId:i.criterionId,outcome:'ACCEPTED',reason:'확인',evidenceRefs:[]})),reviewer:{kind:'HUMAN',userId:session.user.id,sameAsTargetRecorder:true},sourceKind:'HUMAN_REVIEW',reason:'검토',reviewedAt:at,serverSequence:3};
 const confirmation={eventId:'00000000-0000-4000-8000-000000000021',reviewRefs:[review.ref],reason:'확정',actorRef:{kind:'HUMAN',userId:session.user.id},recordedAt:at};
 const application={projectId:pid,versionRef:constitutionRef,confirmationId:confirmation.eventId,reason:'현재 적용',acknowledged:true,reviewRef:review.ref,previousApplicationRef:null,appliedBy:{...confirmation.actorRef,clientId:session.clientId},controlGeneration:1};
 const record={ref:{id:pid,version:1,contentHash:hash(application)},application,appliedAt:at};
 const constitutionSource={...view,ref:constitutionRef,entry:constitutionEntry,body:constitutionBody,state:'CONFIRMED',confirmation,currentConfirmationValid:true,contentReviewCriteria:criteria,contentReviews:[review],appliedAsConstitution:true,constitutionApplication:record,history:[{id:bodyId,kind:'PROPOSED',reason:constitutionEntry.reason,actorRef:confirmation.actorRef,recordedAt:at},{id:confirmation.eventId,kind:'CONFIRMED',reason:confirmation.reason,actorRef:confirmation.actorRef,reviewRefs:confirmation.reviewRefs,recordedAt:at}]};
 const constitution={current:{...record,source:constitutionSource,eligibility:{usable:true,reasons:[]}},history:[record],hasMore:false,nextBeforeVersion:null,agentDelivery:'NOT_CONNECTED',compliance:'NOT_ASSESSED',observedAt:at};
 const urls:URL[]=[],errors:unknown[]=[],actions:Promise<void>[]=[];let staged:ReturnType<typeof deferred<Response>>|null=null,badOriginal=false,updates=0,singleFlight=false,running=0;
 const transport:typeof fetch=async(path,init)=>{
  assert.equal(init?.method,'GET');const url=new URL(String(path),'https://anvil.invalid');urls.push(url);
  if(staged){const wait=staged;staged=null;return wait.promise;}
  if(url.pathname===`/api/v1/projects/${pid}/constitution`)return Response.json(constitution);
  if(url.pathname===`/api/v1/projects/${pid}/knowledge/${kitId}/versions/1`)return Response.json(badOriginal?{...view,body:'다른 본문'}:view);
  if(url.pathname===`/api/v1/projects/${pid}/knowledge`){
   if(url.searchParams.get('kind')==='CONSTITUTION')return reply();
   return reply([hit],url.searchParams.has('cursor')?null:'opaque-stage-page');
  }
  if(url.pathname===`/api/v1/projects/${pid}/conversations`)return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:at});
  assert.fail(url.pathname);
 };
 const client=new ui.ApiClient(transport),container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 const render=()=>root.render(ui.React.createElement(ui.React.StrictMode,null,ui.React.createElement(ui.WorkspaceContextPreparation,{
  client,confirmed,session,buffer,owner:true,busy:false,
  onChange:(fn:typeof buffer|((b:typeof buffer)=>typeof buffer))=>{buffer=typeof fn==='function'?fn(buffer):fn;updates++;render();},
  run:(action:()=>Promise<void>)=>{
   if(singleFlight&&running)return;
   running++;
   actions.push(action().catch(error=>{errors.push(error);}).finally(()=>{running--;}));
  },
 })));
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))],findButton=(label:string)=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===label);
 const act=ui.React.act,selectLabel='이 정확 원문을 선택 슬롯에 추가';
 async function click(label:string){const button=findButton(label);assert(button,label);assert(!button.disabled,label);await act(async()=>button.click());}
 async function change(node:MemoryNode,target:{value?:string;checked?:boolean}){const key=Object.keys(node).find(k=>k.startsWith('__reactProps'));assert(key);await act(async()=>(node as any)[key].onChange({target}));}
 const byLabel=(label:string)=>{const node=nodes().find(n=>n.getAttribute('aria-label')===label);assert(node,label);return node;};
 const slot=()=>{const node=nodes().find(n=>n.tagName==='SELECT'&&!n.getAttribute('aria-label'));assert(node);return node;};
 const flush=()=>act(async()=>{await new Promise(r=>setImmediate(r));});
 const settle=()=>act(async()=>{await Promise.all(actions);});
 const parseScope=(url:URL)=>JSON.parse(url.searchParams.get('scope')??'null');
 const delayed:ReturnType<typeof deferred<Response>>[]=[];
 function hold(){const response=deferred<Response>();delayed.push(response);staged=response;return response;}
 try{
  await act(async()=>render());assert.equal(urls.length,0);
  await change(slot(),{value:'CURRENT_POSITION'});
  singleFlight=true;const first=hold(),button=findButton('지식 원문 목록');assert(button);
  await act(async()=>{button.click();button.click();});assert.equal(urls.length,1);
  first.resolve(reply([hit],'opaque-stage-page'));await settle();singleFlight=false;
  assert.equal(parseScope(urls.at(-1)!),null);assert(findButton('원문 다음 목록'),'제어기가 수락한 첫 GET 결과가 유지된다');
  const scope=()=>byLabel('지식 검색 범위');
  await change(scope(),{value:'STAGE'});assert(!findButton('원문 다음 목록'));assert.equal(urls.length,1);
  await click('지식 원문 목록');await settle();assert.deepEqual(parseScope(urls.at(-1)!),{stageRef,taskRef:null,includeProjectWide:false});
  await click('원문 다음 목록');await settle();assert.equal(urls.at(-1)?.searchParams.get('cursor'),'opaque-stage-page');
  assert.deepEqual(parseScope(urls.at(-1)!),parseScope(urls.at(-2)!));
  const old=hold();await click('지식 원문 목록');
  await change(scope(),{value:'TASK'});
  old.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));await settle();
  assert.equal(errors.length,0);assert(!findButton('원문 열기'));assert(!findButton('원문 다음 목록'));
  await click('지식 원문 목록');await settle();assert.deepEqual(parseScope(urls.at(-1)!),{stageRef:null,taskRef,includeProjectWide:false});assert.equal(urls.at(-1)?.searchParams.get('cursor'),null);
  const before=urls.length;await change(scope(),{value:'STAGE_OR_TASK'});
  const common=nodes().find(n=>n.tagName==='INPUT'&&n.type==='checkbox');assert(common);
  await change(common,{checked:true});assert.equal(urls.length,before);
  await click('지식 원문 목록');await settle();assert.deepEqual(parseScope(urls.at(-1)!),{stageRef,taskRef,includeProjectWide:true});
  assert.equal(updates,0);assert(!findButton(selectLabel));
  badOriginal=true;await click('원문 열기');await settle();assert.equal(errors.length,1);assert(!findButton(selectLabel));
  badOriginal=false;await click('원문 열기');await settle();assert.equal(urls.at(-1)?.search,'');assert(container.textContent.includes(body));assert.equal(updates,0);
  await click(selectLabel);
  assert.equal(updates,1);assert.deepEqual(buffer.input.slots.find(s=>s.code==='CURRENT_POSITION')?.sources,[{kind:'KNOWLEDGE_VERSION',versionRef:ref}]);

  const oldAssignment=hold();await click('지식 원문 목록');
  confirmed=structuredClone(confirmed);confirmed.snapshot.definition.taskRef={...task,nodeId:'다음 단계',taskCode:'T2',planRef:{...task.planRef,version:2}};
  confirmed.ref={...confirmed.ref,version:2,contentHash:hash(confirmed.snapshot)};buffer=newContextPreparation(confirmed,session,1);
  await act(async()=>render());oldAssignment.resolve(reply([hit],'old-assignment-cursor'));await settle();
  assert(!findButton('원문 열기'));assert(!findButton('원문 다음 목록'));
  await change(scope(),{value:'STAGE_OR_TASK'});await click('지식 원문 목록');await settle();
  assert.deepEqual(parseScope(urls.at(-1)!),{stageRef:{...stageRef,nodeId:'다음 단계'},taskRef:{planRef:{...task.planRef,version:2},taskCode:'T2'},includeProjectWide:false});
  assert.equal(buffer.input.slots.find(s=>s.code==='CURRENT_POSITION')?.sources.length,0);
  await change(slot(),{value:'RULES_SCOPE'});assert(!nodes().some(n=>n.getAttribute('aria-label')==='지식 검색 범위'));
  assert(!findButton('지식 원문 목록'),'일반 헌법 목록에서는 RULES_SCOPE를 선택할 수 없다');
  const prior=urls.length,changes=updates;
  await click('현재 적용 헌법 원문 조회');await settle();
  assert.equal(urls.at(-1)?.pathname,`/api/v1/projects/${pid}/constitution`);
  assert.equal(urls.length,prior+1);assert.equal(updates,changes);
  assert(container.textContent.includes(constitutionBody));assert(container.textContent.includes(record.ref.contentHash));
  const rules=()=>buffer.input.slots.find(s=>s.code==='RULES_SCOPE')?.sources;
  const event=(node:MemoryNode)=>{const key=Object.keys(node).find(k=>k.startsWith('__reactProps'))!;return (node as any)[key].onClick as ()=>void;};
  const originalAdd=findButton(selectLabel);assert(originalAdd);
  const oldAdd=event(originalAdd);
  await click(selectLabel);
  assert.deepEqual(rules(),[{kind:'KNOWLEDGE_VERSION',versionRef:constitutionRef}]);
  assert.equal(urls.length,prior+1);
  assert(!JSON.stringify(buffer.input).includes(constitutionBody));
  await click('현재 적용 헌법 원문 조회');await settle();
  assert(findButton(selectLabel)?.disabled,'한 원문 제한은 명시 제거까지 유지');
  await click('이 원문 선택 해제');
  assert.deepEqual(rules(),[]);
  const afterRemove=updates;
  await act(async()=>oldAdd());
  assert.equal(updates,afterRemove);assert.deepEqual(rules(),[]);

  const responseViews=[
   {...constitution,current:null,history:[]},
   {...constitution,current:{...constitution.current,source:{...constitutionSource,state:'SUPERSEDED',headVersion:2,currentConfirmationValid:false},eligibility:{usable:false,reasons:['SUPERSEDED']}}},
   {...constitution,current:{...constitution.current,source:{...constitutionSource,state:'EXCLUDED',currentConfirmationValid:false,history:[...constitutionSource.history,{id:'00000000-0000-4000-8000-000000000022',kind:'EXCLUDED',reason:'제외',actorRef:confirmation.actorRef,recordedAt:at}]},eligibility:{usable:false,reasons:['EXCLUDED']}}},
  ];
  for (const unavailable of responseViews) {
   const rejectionCount:number=errors.length,waiting=hold();
   await click('현재 적용 헌법 원문 조회');
   waiting.resolve(Response.json(unavailable));await settle();
   assert(!findButton(selectLabel));assert.deepEqual(rules(),[]);
   assert.equal(errors.length,rejectionCount);
   assert(container.textContent.includes(unavailable.current?'현재 사용 불가':'프로젝트 적용 헌법 없음'));
  }
  for (const rejection of [
   Response.json({...constitution,current:{...constitution.current,source:{...constitutionSource,body:'변조 본문'}}}),
   Response.json({...constitution,current:{...constitution.current,ref:{...record.ref,contentHash:'b'.repeat(64)}}}),
   Response.json({code:'AUTH_REQUIRED'},{status:401}),
   Response.json({code:'PROJECT_FORBIDDEN'},{status:403}),
  ]) {
   await click('현재 적용 헌법 원문 조회');await settle();assert(findButton(selectLabel));
   const rejectionCount:number=errors.length,waiting=hold();
   await click('현재 적용 헌법 원문 조회');
   waiting.resolve(rejection);await settle();
   assert(!findButton(selectLabel));assert.deepEqual(rules(),[]);assert.equal(errors.length,rejectionCount+1);
  }
  await click('현재 적용 헌법 원문 조회');await settle();
  const addBeforeBufferChange=findButton(selectLabel);assert(addBeforeBufferChange);
  const readBeforeBufferChange=findButton('현재 적용 헌법 원문 조회');assert(readBeforeBufferChange);
  const staleAdd=event(addBeforeBufferChange),staleRead=event(readBeforeBufferChange);
  const waiting=hold(),beforeStaleErrors=errors.length;
  await click('현재 적용 헌법 원문 조회');
  buffer={...buffer};
  await act(async()=>render());
  waiting.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));await settle();
  const beforeStaleRead=urls.length;
  await act(async()=>{staleAdd();staleRead();});
  assert(!findButton(selectLabel));assert.deepEqual(rules(),[]);
  assert.equal(errors.length,beforeStaleErrors);assert.equal(urls.length,beforeStaleRead);

  const oldRules=hold();await click('현재 적용 헌법 원문 조회');
  await change(slot(),{value:'NEXT_ACTION'});await change(slot(),{value:'RULES_SCOPE'});
  oldRules.resolve(Response.json(constitution));await settle();
  assert(!findButton(selectLabel));assert.deepEqual(rules(),[]);
  assert(!urls.some(url=>url.searchParams.get('kind')==='CONSTITUTION'));
  await change(slot(),{value:'LATEST_INSTRUCTIONS'});assert(!nodes().some(n=>n.getAttribute('aria-label')==='지식 검색 범위'));
  await click('사용자 지시 대화 목록');await settle();assert.equal(urls.at(-1)?.pathname,`/api/v1/projects/${pid}/conversations`);
  await flush();
 }finally{for(const response of delayed)response.resolve(reply());await act(async()=>root.unmount());document.body.removeChild(container);}
});
