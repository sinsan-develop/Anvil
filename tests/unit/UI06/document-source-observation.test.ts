import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {AccessRepository,type AuthenticatedIdentity} from '../../../apps/server/modules/access/repository.ts';
import {buildApp} from '../../../apps/server/app.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,pid=id(1),doc={id:id(2),version:1,contentHash:'a'.repeat(64)};
const actor:AuthenticatedIdentity={actorId:id(3),clientId:id(4),serverOwner:false,credentialGeneration:1,reauthUntil:null,authSession:{id:id(5),idleExpiresAt:'2099-01-01T00:00:00.000Z',absoluteExpiresAt:'2099-01-01T00:00:00.000Z'}};
class SourceAppMemoryAccess extends AccessRepository{
 writes=0;constructor(){super({} as never,{installationId:id(6),key:Buffer.alloc(32)});}
 override async authenticated<T>(_token:string,_csrf:string|null,body:(db:PoolClient,a:AuthenticatedIdentity)=>Promise<T>){return body(this.db(),actor);}
 db(){return{query:async(sql:string)=>{
  if(/INSERT|UPDATE anvil\./.test(sql))this.writes++;
  if(sql.includes('FROM anvil.projects p JOIN anvil.project_members'))return{rows:[{id:pid,archived_at:null,participation:'OWNER'}]};
  if(sql.includes('FROM anvil.project_control'))return{rows:[{actor_id:actor.actorId,client_id:actor.clientId,generation:1,revoked_at:null}]};
  if(sql.includes('FROM anvil.permission_policies p JOIN')){const rules=[{ruleId:'source',subjectRef:{kind:'HUMAN',userId:actor.actorId},operations:['linkDocumentSource','proposeDocumentSourceChange'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}],value={rules,reason:'메모리 정책',reviewRefs:[]};return{rows:[{id:id(7),head_version:1,rules_json:rules,content_hash:contentHash(canonicalJson(value)),reason:value.reason,review_refs:[],created_at:new Date('2026-11-03T00:00:00.000Z')}]};}
  if(sql.includes('clock_timestamp()'))return{rows:[{at:new Date('2026-11-03T00:00:00.000Z')}]};
  if(sql.includes('FROM anvil.commands WHERE scope_kind'))return{rows:[]};
  if(sql.includes('quota_existing'))return{rows:[{value:null}]};
  throw Error('UNMODELED_SOURCE_APP_QUERY');
 }} as unknown as PoolClient;}
}
test('실제 App 명령 route는 승인된 두 소스 명령을 받아 기본 보호포트 부재412로 닫는다',async()=>{
 const repository=new SourceAppMemoryAccess(),app=buildApp({},undefined,{repository,origin:'https://anvil.invalid'});
 try{for(const operation of ['linkDocumentSource','proposeDocumentSourceChange']){
  const payload=operation==='linkDocumentSource'?{documentRef:doc,sourceRootId:id(8),relativePath:'a.md',sourceSnapshotRef:doc,blobHash:doc.contentHash,reason:'관측 연결'}:{sourceLinkRef:doc,observedSnapshotRef:doc,choice:'KEEP_SERVER',reason:'서버 보존'};
  const response=await app.inject({method:'POST',url:`/api/v1/projects/${pid}/commands`,headers:{host:'anvil.invalid',origin:'https://anvil.invalid','content-type':'application/json','x-anvil-csrf':'C'.repeat(43)},payload:{schemaVersion:1,projectId:pid,commandId:id(9),clientId:actor.clientId,controlGeneration:1,operation,targetId:operation==='linkDocumentSource'?null:doc.id,expectedVersion:operation==='linkDocumentSource'?0:1,baselineRefs:[],approvalRef:null,payload}});
  assert.equal(response.statusCode,412,response.body);assert.equal(response.json().code,'DOCUMENT_SOURCE_OBSERVATION_UNAVAILABLE');
 }assert.equal(repository.writes,0);}finally{await app.close();}
});

import {readApprovalDetails,assertApprovalCandidate} from '../../../apps/server/modules/approvals/approval-input.ts';
import {consumableOperations} from '../../../apps/server/modules/approvals/project-approvals.ts';
import type {ProjectCommand} from '../../../apps/server/modules/access/project-command.ts';
function sourceApproval(operation:'linkDocumentSource'|'proposeDocumentSourceChange'){
 const command:ProjectCommand={schemaVersion:1,projectId:pid,commandId:id(10),clientId:actor.clientId,controlGeneration:1,operation,targetId:operation==='linkDocumentSource'?null:doc.id,expectedVersion:operation==='linkDocumentSource'?0:1,baselineRefs:[],approvalRef:null,payload:operation==='linkDocumentSource'?{documentRef:doc,sourceRootId:id(8),relativePath:'a.md',sourceSnapshotRef:doc,blobHash:doc.contentHash,reason:'관측 연결'}:{sourceLinkRef:doc,observedSnapshotRef:doc,choice:'KEEP_SERVER',reason:'원 본문 보존'}};
 const details={reason:'원 명령 검토',risks:{data:'본문 보존',security:'보호 관측 필요',cost:'추가 비용 없음',interruption:'명시 전송',unverified:'실측 미검증'},rollback:{method:'본문 변경 없음',limitations:'자동 재전송 없음',evidenceRefs:[]},expiresAt:'2099-01-01T00:00:00.000Z',candidateCommandId:command.commandId,actionScope:{operation,targetRef:operation==='linkDocumentSource'?null:doc,expectedVersion:command.expectedVersion,payloadHash:contentHash(canonicalJson(command.payload)),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId},controlGeneration:1}};
 return{command,details};
}
test('source 승인: 실제 소비 allowlist와 null/0 최초·ACTIVE1 선택 target을 원 payloadHash에 결박한다',()=>{
 for(const operation of ['linkDocumentSource','proposeDocumentSourceChange'] as const){const f=sourceApproval(operation);const details=readApprovalDetails(f.details,{actorId:actor.actorId,clientId:actor.clientId,controlGeneration:1,allowedOperations:consumableOperations,now:new Date('2026-11-03T00:00:00.000Z')});assertApprovalCandidate(details,f.command,actor.actorId,pid);assert.throws(()=>assertApprovalCandidate(details,{...f.command,payload:{...f.command.payload,reason:'다른 이유'}},actor.actorId,pid));}
});

function observationHistoryFixture(){
 const snapshot={projectId:pid,documentRef:doc,sourceRootId:id(8),relativePath:'a.md',sourceSnapshotRef:doc,blobHash:doc.contentHash,reason:'연결',kind:'LINKED',state:'ACTIVE',previousRef:null,recordedAt:'2026-11-03T00:00:00.000Z'},linkRef={id:id(11),version:1,contentHash:contentHash(canonicalJson(snapshot))},policyRef={id:id(7),version:1,contentHash:'b'.repeat(64)};
 const result={operationId:id(12),commandId:id(10),projectId:pid,status:'APPLIED',targetId:linkRef.id,version:1,data:{ref:linkRef,snapshot,status:'DOCUMENT_SOURCE_LINKED'},serverReceivedAt:snapshot.recordedAt};
 const legacy={participation:'OWNER',document_hash:doc.contentHash,link_id:linkRef.id,head_version:1,link_state:'ACTIVE',events:[{ref:linkRef,snapshot,commandId:id(13),commandProjectId:pid,actorId:actor.actorId,clientId:actor.clientId,commandKey:id(10),operation:'linkDocumentSource',commandState:'APPLIED',expectedVersion:0,policyRef,result,receipt:{commandId:id(13),scopeKind:'PROJECT',scopeId:pid,subjectRef:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId},policyRef}}]};
 const observedSnapshot={scope:{projectId:pid,documentRef:doc,sourceRootId:id(8),relativePath:'a.md',actorId:actor.actorId,clientId:actor.clientId,humanSessionId:actor.authSession!.id,controlGeneration:1},sourceRootRef:{...doc,id:id(8)},sourceSnapshotRef:doc,blobHash:'c'.repeat(64),artifactRef:null,registrationRef:doc,connectorRef:doc,proofRef:doc,observedAt:snapshot.recordedAt,expiresAt:'2026-11-03T00:01:00.000Z'},observation={ref:{id:id(14),version:1,contentHash:contentHash(canonicalJson(observedSnapshot))},snapshot:observedSnapshot};
 const eventSnapshot={projectId:pid,sourceLinkRef:linkRef,observation,choice:'KEEP_SERVER',reason:'서버 보존',previousRef:null,proposalId:null,importId:null,recordedAt:snapshot.recordedAt},eventRef={id:id(15),version:1,contentHash:contentHash(canonicalJson(eventSnapshot))};
 const eventResult={...result,commandId:id(16),targetId:eventRef.id,data:{ref:eventRef,snapshot:eventSnapshot,status:'DOCUMENT_SOURCE_CHANGE_RECORDED',sourceEvent:{ref:eventRef,snapshot:eventSnapshot}}};
 const row={id:id(17),project_id:pid,link_id:linkRef.id,stream_id:eventRef.id,version:1,content_hash:eventRef.contentHash,snapshot_json:eventSnapshot,command_id:id(18),operation:'proposeDocumentSourceChange',command_state:'APPLIED',command_key:id(16),command_actor:actor.actorId,command_client:actor.clientId,expected_version:1,policy_ref:policyRef,result_ref:eventResult,receipt_command_id:id(18),subject_ref:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId},receipt_policy_ref:policyRef,audit_count:1,initial_hash:linkRef.contentHash};
 return{legacy,row,linkRef,eventRef};
}
class SourceHistoryMemoryAccess extends SourceAppMemoryAccess{
 fixture=observationHistoryFixture();
 override db(){const parent=super.db();return{query:async(sql:string,args:unknown[])=>{if(sql.startsWith('WITH member_scope'))return{rows:[structuredClone(this.fixture.legacy)]};if(sql.includes('FROM anvil.document_source_observation_events'))return{rows:[structuredClone(this.fixture.row)]};return Reflect.apply(parent.query,parent,[sql,args]);}} as unknown as PoolClient;}
}
test('관측 고정조회는 원v1 이력과 영수증을 검산하며 과거 관측을 현재 권한으로 승격하지 않는다',async()=>{
 const repository=new SourceHistoryMemoryAccess(),app=buildApp({},undefined,{repository,origin:'https://anvil.invalid'}),f=repository.fixture;
 try{const response=await app.inject({method:'GET',url:`/api/v1/projects/${pid}/documents/${doc.id}/source-links/${f.linkRef.id}/observations/${f.eventRef.id}/versions/1?version=1&contentHash=${doc.contentHash}`,headers:{host:'anvil.invalid'}});assert.equal(response.statusCode,200,response.body);assert.deepEqual(response.json().record,{ref:f.eventRef,snapshot:f.row.snapshot_json});assert.equal(response.json().comparison,'DRIFT');assert.equal(response.json().currentObservationVerified,false);assert.equal(repository.writes,0);}finally{await app.close();}
});

import {build} from 'vite';
import {fileURLToPath} from 'node:url';
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

const savedDom=new Map<string,PropertyDescriptor|undefined>();let ui:any;
const OriginalChannel=globalThis.MessageChannel,ownedChannels:MessageChannel[]=[];
class SourceOwnedChannel extends OriginalChannel{constructor(){super();ownedChannels.push(this);}}
before(async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/design-trace/DocumentSourceLinks.tsx',import.meta.url)),api=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)),sourceApi=fileURLToPath(new URL('../../../apps/web/src/features/design-trace/source-link-command-api.ts',import.meta.url));
 const output=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:source-links-memory',name:'SourceLinksMemory',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'source-links-memory',resolveId(v){if(v.endsWith('virtual:source-links-memory'))return'\0source-links-memory';},load(v){if(v==='\0source-links-memory')return`import * as React from 'react';import{createRoot}from'react-dom/client';import{DocumentSourceLinks}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(api)};import * as sourceApi from${JSON.stringify(sourceApi)};export{React,createRoot,DocumentSourceLinks,ApiClient,sourceApi};`;}}]});
 const built=Array.isArray(output)?output[0]:output;if(!built||!('output'in built))throw Error('MEMORY_BUILD_OUTPUT_REQUIRED');const chunk=built.output.find(v=>v.type==='chunk');if(!chunk||chunk.type!=='chunk')throw Error('MEMORY_CHUNK_REQUIRED');
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const [key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:SourceOwnedChannel})){savedDom.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function(chunk.code+';return SourceLinksMemory;')();
});
after(()=>{for(const c of ownedChannels){c.port1.close();c.port2.close();}for(const [key,value]of savedDom)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});
async function mountSourceUI(extra?:(url:string,init?:RequestInit)=>Response|undefined){
 const calls:{url:string;method:string}[]=[],session={user:{id:actor.actorId},clientId:actor.clientId,csrfToken:'C'.repeat(43)};
 const transport=async(input:string|URL|Request,init?:RequestInit)=>{const url=String(input);calls.push({url,method:init?.method??'GET'});if(url===`/api/v1/projects/${pid}/documents/${doc.id}/source-links?version=1&contentHash=${doc.contentHash}`)return Response.json({projectId:pid,documentRef:doc,items:[],hasMore:false,observedAt:'2026-11-03T00:00:00.000Z'});const fixed=extra?.(url,init);if(fixed)return fixed;throw Error('UNALLOWED_SOURCE_UI_ENDPOINT');};
 const client=new ui.ApiClient(transport),container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container),state:{buffer:any}={buffer:null};let lost=0;
 function Harness(){const[buffer,setBuffer]=ui.React.useState(state.buffer);state.buffer=buffer;return ui.React.createElement(ui.DocumentSourceLinks,{client,projectId:pid,documentRef:doc,session,commandBuffer:buffer,onCommandChange:(change:Function)=>setBuffer((previous:any)=>change(previous)),onAuthenticationLost:()=>lost++});}
 const render=()=>ui.React.act(async()=>{root.render(ui.React.createElement(Harness));});await render();
 const nodes=():MemoryNode[]=>{const visit=(n:MemoryNode):MemoryNode[]=>[n,...n.childNodes.flatMap(visit)];return visit(container);};
 const flush=()=>ui.React.act(async()=>{await new Promise<void>(r=>setImmediate(r));});await flush();
 const click=async(text:string)=>{const node=nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===text);assert(node,`버튼 ${text}`);assert.equal(node.disabled,false);await ui.React.act(async()=>node.dispatchEvent({type:'click',button:0}));await flush();};
 const change=async(label:string,value:string)=>{const node=nodes().find(n=>n.getAttribute('aria-label')===label);assert(node,label);await ui.React.act(async()=>{node.value=value;node.dispatchEvent({type:'change'});});await flush();};
 return{container,state,calls,client,session,nodes,click,change,flush,lost:()=>lost,close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
test('메모리 React 실제 소스 화면: 명시 새연결 준비는 원문 관측/POST를 자동 시작하지 않는다',async()=>{
 const f=await mountSourceUI();try{await f.click('새 소스 연결 준비');assert(f.state.buffer);assert.equal(f.state.buffer.operation,'linkDocumentSource');assert.equal(f.state.buffer.pending,null);assert.equal(f.calls.some(x=>x.method==='POST'),false);assert.equal(f.lost(),0);}finally{await f.close();}
});


test('보호 선택 준비 GET은 기본 공급자 부재412이며 기존 목록 GET과 구분한다',async()=>{
 const repository=new SourceAppMemoryAccess(),app=buildApp({},undefined,{repository,origin:'https://anvil.invalid'});
 try{const response=await app.inject({method:'GET',url:`/api/v1/projects/${pid}/documents/${doc.id}/source-links?view=options&version=1&contentHash=${doc.contentHash}&mode=LINK&rootId=${id(8)}`,headers:{host:'anvil.invalid'}});assert.equal(response.statusCode,412,response.body);assert.equal(response.json().code,'DOCUMENT_SOURCE_OBSERVATION_UNAVAILABLE');assert.equal(repository.writes,0);}finally{await app.close();}
});


function optionFixture(){
 const snapshot={scope:{projectId:pid,documentRef:doc,sourceRootId:id(8),relativePath:'설계/원문.md',actorId:actor.actorId,clientId:actor.clientId,humanSessionId:actor.authSession!.id,controlGeneration:1},sourceRootRef:{...doc,id:id(8)},sourceSnapshotRef:{...doc,id:id(70)},blobHash:'c'.repeat(64),artifactRef:null,registrationRef:doc,connectorRef:doc,proofRef:doc,observedAt:'2026-11-03T00:00:00.000Z',expiresAt:'2090-01-01T00:00:00.000Z'};
 return{label:'개발 환경 · 보관된 원문',record:{ref:{id:id(71),version:1,contentHash:contentHash(canonicalJson(snapshot))},snapshot}};
}
class SourceOptionsMemoryAccess extends SourceAppMemoryAccess{
 participation='OWNER';disposition='REQUIRE_APPROVAL';
 override db(){const parent=super.db();return{query:async(sql:string,args:unknown[])=>{
  if(sql.startsWith('SELECT content_hash FROM anvil.document_versions'))return{rows:[{content_hash:doc.contentHash}]};
  if(sql.startsWith('SELECT v.* FROM anvil.source_roots'))return{rows:[{status:'DECLARED'}]};
  const result=await Reflect.apply(parent.query,parent,[sql,args]);
  if(sql.includes('FROM anvil.projects p JOIN anvil.project_members'))result.rows[0].participation=this.participation;
  if(sql.includes('FROM anvil.permission_policies p JOIN')){const row=result.rows[0];row.rules_json[0].disposition=this.disposition;row.content_hash=contentHash(canonicalJson({rules:row.rules_json,reason:row.reason,reviewRefs:row.review_refs}));}
  return result;
 }} as unknown as PoolClient;}
}
async function optionsRequest(repository:SourceOptionsMemoryAccess,options:Function){
 const source={read:async()=>{throw Error('READ_FORBIDDEN_IN_OPTIONS');},current:async()=>{throw Error('CURRENT_FORBIDDEN_IN_OPTIONS');},options},app=buildApp({},undefined,{repository,origin:'https://anvil.invalid'},undefined,undefined,undefined,undefined,null,source);
 try{return await app.inject({method:'GET',url:`/api/v1/projects/${pid}/documents/${doc.id}/source-links?view=options&version=1&contentHash=${doc.contentHash}&mode=LINK&rootId=${id(8)}`,headers:{host:'anvil.invalid'}});}finally{await app.close();}
}
test('보호 선택 준비: REQUIRE_APPROVAL도 원문/승인IO 없이 보관 후보를 표시하고 exact 참조를 내부 전달한다',async()=>{
 const repository=new SourceOptionsMemoryAccess();let calls=0;
 const response=await optionsRequest(repository,async()=>{calls++;return{items:[optionFixture()],hasMore:false};});
 assert.equal(response.statusCode,200,response.body);const body=response.json();assert.equal(body.view,'DOCUMENT_SOURCE_OPTIONS');assert.equal(body.items[0].relativePath,'설계/원문.md');assert.deepEqual(body.items[0].observedSnapshotRef,optionFixture().record.snapshot.sourceSnapshotRef);assert.equal('proofRef'in body.items[0],false);assert.equal('verified'in body,false);assert.equal(calls,1);assert.equal(repository.writes,0);
});
test('보호 선택 준비: VIEWER/정책없음·DENY는 공급자 진입0, await 뒤 제어정책 변경은 후보0',async()=>{
 for(const input of ['VIEWER','DENY']){const repository=new SourceOptionsMemoryAccess();if(input==='VIEWER')repository.participation=input;else repository.disposition=input;let calls=0;const response=await optionsRequest(repository,async()=>{calls++;return{items:[optionFixture()],hasMore:false};});assert.equal(response.statusCode,403,response.body);assert.equal(calls,0);}
 const repository=new SourceOptionsMemoryAccess();const response=await optionsRequest(repository,async()=>{repository.disposition='DENY';return{items:[optionFixture()],hasMore:false};});assert.equal(response.statusCode,403,response.body);
});
test('보호 선택 준비: 공급자 getter/Proxy·다른scope/만료 후보를 실행·노출하지 않는다',async()=>{
 let gets=0;const dangerous=Object.defineProperty({},'items',{enumerable:true,get(){gets++;throw Error('GETTER');}});
 for(const raw of [dangerous,new Proxy({items:[],hasMore:false},{get(_target,key){if(key==='then')return undefined;gets++;throw Error('PROXY');}}),{items:[{...optionFixture(),record:{...optionFixture().record,snapshot:{...optionFixture().record.snapshot,scope:{...optionFixture().record.snapshot.scope,actorId:id(90)}}}}],hasMore:false}]){const response=await optionsRequest(new SourceOptionsMemoryAccess(),async()=>raw);assert.equal(response.statusCode,503,response.body);}
 assert.equal(gets,0);
});

test('메모리 React: 사용자에게 root/snapshot UUID·blob hash 입력을 요구하지 않고 명시 보호 선택을 제공한다',async()=>{
 const f=await mountSourceUI();try{await f.click('새 소스 연결 준비');const labels=f.nodes().filter(n=>n.tagName==='INPUT').map(n=>n.getAttribute('aria-label'));for(const label of ['소스 root ID','원본 blob SHA256','관측 snapshot ID','관측 snapshot SHA256'])assert(!labels.includes(label),label);assert(f.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='등록 환경 조회'));assert.equal(f.calls.some(x=>x.url.includes('view=options')),false);}finally{await f.close();}
});

test('메모리 React: 환경·경로·관측시각 선택은 exact refs/hash를 원 draft에 결박하며 원문/POST0',async()=>{
 const item=optionFixture(),chosen={label:item.label,relativePath:item.record.snapshot.scope.relativePath,observedSnapshotRef:item.record.snapshot.sourceSnapshotRef,blobHash:item.record.snapshot.blobHash,artifactRef:null,observedAt:item.record.snapshot.observedAt,expiresAt:item.record.snapshot.expiresAt};
 const f=await mountSourceUI(url=>{
  if(url===`/api/v1/projects/${pid}/source-roots?limit=50`)return Response.json({view:'SOURCE_ROOT_DECLARATIONS',items:[{ref:{...doc,id:id(8)},displayName:'개발 PC',status:'DECLARED',authority:'USER_DECLARED',readiness:'UNVERIFIED',executionAuthorized:false}],hasMore:false,nextCursor:null,observedAt:'2026-11-03T00:00:00.000Z'});
  if(url===`/api/v1/projects/${pid}/documents/${doc.id}/source-links?view=options&version=1&contentHash=${doc.contentHash}&mode=LINK&limit=50&rootId=${id(8)}`)return Response.json({view:'DOCUMENT_SOURCE_OPTIONS',projectId:pid,documentRef:doc,mode:'LINK',rootId:id(8),sourceLinkRef:null,items:[chosen],hasMore:false,nextCursor:null});
 });
 try{await f.click('새 소스 연결 준비');await f.click('등록 환경 조회');await f.change('등록 환경',id(8));await f.click('보관 관측 후보 조회');await f.change('보관 관측','0');assert.equal(f.state.buffer.payload.sourceRootId,id(8));assert.equal(f.state.buffer.payload.relativePath,chosen.relativePath);assert.deepEqual(f.state.buffer.payload.sourceSnapshotRef,chosen.observedSnapshotRef);assert.equal(f.state.buffer.payload.blobHash,chosen.blobHash);assert.equal(f.state.buffer.pending,null);assert.equal(f.calls.some(x=>x.method==='POST'),false);assert.equal(f.calls.some(x=>/snapshot.*versions|artifacts/.test(x.url)),false);}finally{await f.close();}
});
