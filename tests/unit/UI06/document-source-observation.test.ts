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
  if(sql.includes('document_source_read_context'))return{rows:[{document_source_read_context:null}]};
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
 participation='OWNER';disposition='REQUIRE_APPROVAL';policyExpiresAt:string|null=null;
 override db(){const parent=super.db();return{query:async(sql:string,args:unknown[])=>{
  if(sql.startsWith('SELECT content_hash FROM anvil.document_versions'))return{rows:[{content_hash:doc.contentHash}]};
  if(sql.startsWith('SELECT v.* FROM anvil.source_roots'))return{rows:[{status:'DECLARED'}]};
  const result=await Reflect.apply(parent.query,parent,[sql,args]);
  if(sql.includes('FROM anvil.projects p JOIN anvil.project_members'))result.rows[0].participation=this.participation;
  if(sql.includes('FROM anvil.permission_policies p JOIN')){const row=result.rows[0];row.rules_json[0].disposition=this.disposition;if(this.policyExpiresAt)row.rules_json[0].expiresAt=this.policyExpiresAt;row.content_hash=contentHash(canonicalJson({rules:row.rules_json,reason:row.reason,reviewRefs:row.review_refs}));}
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


import {registrationRef,connectorRef} from '../../../apps/server/modules/connections/project-registrations.ts';
import {sourceEventQuotaAccounting} from '../../../apps/server/modules/projects/project-storage-quota.ts';
/** 인증 Tx·SQL 저장은 메모리 모델이다. 제품 App/원 source command/quota/receipt/고정reader를 그대로 소비한다.
 * SQL trigger/PG COMMIT·OS 관측의 실행 증거가 아니다. 허용하지 않은 query는 즉시 실패한다. */
class SourceCommandMemoryAccess extends SourceOptionsMemoryAccess{
 state:{quota:Record<string,any>[];commands:Record<string,any>[];receipts:Record<string,any>[];audit:Record<string,any>[];links:Record<string,any>[];legacy:Record<string,any>[];events:Record<string,any>[];heads:Record<string,any>[]}={quota:[],commands:[],receipts:[],audit:[],links:[],legacy:[],events:[],heads:[]};
 used=0n;held=0n;tx=0;reads=0;currents=0;loseCommitReply=false;lastFailure:string|null=null;failures:string[]=[];
 root:any;registration:any;observation:any;rootQueries=0;registrationQueries=0;afterRoot:((count:number)=>void)|null=null;afterPolicy:((tx:number)=>void)|null=null;onQuery:((sql:string)=>void)|null=null;clockHold:(()=>Promise<void>)|null=null;activeCallbacks=0;onAuthSettled:(()=>void)|null=null;
 constructor(){super();this.disposition='AUTO';const declaration={hostLabel:'메모리 환경',displayName:'원문 보관',pathHint:'보호 root 표시',reason:'합성 선택',connectorId:id(82)},value={declaration,status:'DECLARED',authority:'USER_DECLARED',readiness:'UNVERIFIED',reason:'합성 root'};
  this.root={project_id:pid,root_id:id(8),version:1,head_version:1,content_hash:contentHash(canonicalJson(value)),declaration_json:declaration,status:value.status,authority:value.authority,readiness:value.readiness,reason:value.reason,connector_id:id(82)};
  this.registration={id:id(81),version:4,state:'ISSUED',scope_digest:'d'.repeat(64),connector_id:id(82),generation:1,connector_status:'TRUSTED',connector_revoked:null,revoked_at:null,basis_current:true,credential_generation:1,control_generation:1};
  const snapshot={...optionFixture().record.snapshot,scope:{...optionFixture().record.snapshot.scope,relativePath:'a.md'},sourceRootRef:{id:this.root.root_id,version:1,contentHash:this.root.content_hash},registrationRef:registrationRef(this.registration),connectorRef:connectorRef(this.registration,1)};this.observation={ref:{id:id(83),version:1,contentHash:contentHash(canonicalJson(snapshot))},snapshot};
 }
 port(){return{read:async(_db:PoolClient,_actor:AuthenticatedIdentity,scope:unknown,snapshot:unknown)=>{this.reads++;assert.deepEqual(scope,this.observation.snapshot.scope);assert.deepEqual(snapshot,this.observation.snapshot.sourceSnapshotRef);return structuredClone(this.observation);},current:async()=>{this.currents++;return structuredClone(this.observation);}};}
 override async authenticated<T>(_token:string,_csrf:string|null,body:(db:PoolClient,a:AuthenticatedIdentity)=>Promise<T>){const previous=structuredClone(this.state),used=this.used,held=this.held;this.tx++;this.activeCallbacks++;let result:T;
  try{try{result=await body(this.db(),actor);}catch(e){this.state=previous;this.used=used;this.held=held;this.failures.push(e instanceof Error?e.stack??e.message:String(e));this.lastFailure=this.failures.join(' || ');throw e;}if(this.loseCommitReply&&this.state.commands.length>previous.commands.length)throw new Error('MODEL_COMMIT_REPLY_LOST');return result;}
  finally{this.activeCallbacks--;if(this.activeCallbacks===0)this.onAuthSettled?.();}
 }
 commandRow(key:string){return this.state.commands.find(c=>c.command_id===key);}
 legacyView(linkId:string){const h=this.state.links.find(h=>h.id===linkId);if(!h)return{participation:'OWNER',document_hash:doc.contentHash,link_id:null,head_version:null,link_state:null,events:[]};return{participation:'OWNER',document_hash:doc.contentHash,link_id:h.id,head_version:h.link_version,link_state:h.state,events:this.state.legacy.filter(e=>e.link_id===linkId).map(e=>{const c=this.state.commands.find(c=>c.id===e.command_id)!,ar=this.state.receipts.find(r=>r.command_id===c.id)!;return{ref:{id:e.link_id,version:e.link_version,contentHash:e.content_hash},snapshot:e.snapshot_json,commandId:c.id,commandProjectId:pid,actorId:c.actor_id,clientId:c.client_id,commandKey:c.command_id,operation:c.operation,commandState:c.state,expectedVersion:c.expected_version,policyRef:c.policy_ref,result:c.result_ref,receipt:{commandId:c.id,scopeKind:'PROJECT',scopeId:pid,subjectRef:ar.subject_ref,policyRef:ar.policy_ref}};})};}
 projections(commandId:string){const c=this.state.commands.find(c=>c.id===commandId)!,e=this.state.events.find(e=>e.command_id===commandId)!,origin=this.state.legacy.find(l=>l.command_id===commandId),ar=this.state.receipts.find(r=>r.command_id===commandId),audit=this.state.audit.find(a=>a.command_id===commandId),head=this.state.heads.find(h=>h.stream_id===e.stream_id);
  const normalized=structuredClone(e.snapshot_json);normalized.recordedAt=null;if(origin)delete normalized.sourceLinkRef.contentHash;
  const projection={link:origin?{ref:{id:origin.link_id,version:1},snapshot:{...origin.snapshot_json,recordedAt:null}}:null,record:{ref:{id:e.stream_id,version:e.version},snapshot:normalized},candidate:null,proposal:null};
  const records=[{kind:'SOURCE_EVENT',row:e},{kind:'COMMAND',row:c},{kind:'AUTHORIZATION_RECEIPT',row:ar},{kind:'AUDIT',row:audit}];
  if(origin)records.push({kind:'LINK_EVENT',row:origin},{kind:'LINK_HEAD',row:this.state.links.find(h=>h.id===origin.link_id)});if(e.version===1)records.push({kind:'STREAM_HEAD',row:head});records.push({kind:'RESERVATION',row:{...this.state.quota[0],plan_json:this.state.quota[0]!.plan_json,phase:'IO_STARTED'}});
  return{projection,record_projections:records,diff_bytes:'0'};
 }
 override db(){const parent=super.db();return{query:async(sql:string,args:unknown[]=[])=>{
  this.onQuery?.(sql);const json=(n:number)=>JSON.parse(String(args[n]));
  if(sql.includes('clock_timestamp()')&&this.clockHold)await this.clockHold();
  if(sql.startsWith('SELECT transaction_timestamp()'))return{rows:[{at:new Date(Date.parse('2026-11-03T00:00:00.000Z')+this.tx*1000)}]};
  if(sql.includes('FROM anvil.commands WHERE scope_kind')){const c=this.commandRow(String(args[2]));return{rows:c?[{operation:c.operation,request_hash:c.request_hash,result_ref:c.result_ref}]:[]};}
  if(sql.startsWith('SELECT v.*,r.head_version FROM anvil.source_roots')){this.rootQueries++;this.afterRoot?.(this.rootQueries);return{rows:[structuredClone(this.root)]};}
  if(sql.includes('anvil.connector_basis_current(r.id,false)')){this.registrationQueries++;return{rows:[structuredClone(this.registration)]};}
  if(sql.includes('quota_existing'))return{rows:[{value:this.commandRow((json(4) as any).commandId)?{replay:true}:null}]};
  if(sql.includes('quota_account'))return{rows:[{coverage_state:'VERIFIED',generation:'1',used_bytes:String(this.used),held_bytes:String(this.held)}]};
  if(sql.includes('quota_reserve')){const plan=json(4),part=plan.parts[0];this.state.quota=[{id:id(84),project_id:pid,actor_id:actor.actorId,client_id:actor.clientId,external_command_id:plan.request.commandId,operation:plan.request.operation,command_hash:plan.commandHash,plan_hash:plan.planHash,part_key:part.key,part_kind:part.kind,reserved_bytes:part.reservedBytes,phase:'RESERVED',start_fence:'0',generation:'1',plan_json:plan}];this.held=BigInt(part.reservedBytes);return{rows:[{value:structuredClone(this.state.quota)}]};}
  if(sql.includes('quota_start')){this.state.quota[0]!.phase='IO_STARTED';this.state.quota[0]!.start_fence='1';return{rows:[{value:structuredClone(this.state.quota)}]};}
  if(sql.includes('quota_require_started'))return{rows:[{value:this.state.quota[0]?.phase==='IO_STARTED'}]};
  if(sql.includes('document_source_quota_projection'))return{rows:[this.projections(String(args[1]))]};
  if(sql.includes('quota_settle')){const v=json(4),r=this.state.quota[0]!,part=r.plan_json.parts[0],c=this.state.commands.find(c=>c.id===v.facts.serverCommandId),ar=this.state.receipts.find(ar=>ar.id===v.facts.authorizationReceiptId);assert(c&&ar);assert.equal(c.id,ar.command_id);assert.equal(ar.scope_digest,v.facts.scopeDigest);assert.equal(c.request_hash,contentHash(canonicalJson(v.request)));const actual=this.projections(c.id),expected=sourceEventQuotaAccounting(c.operation,part,actual.projection,0,actual.record_projections);assert.deepEqual(v.sourceAccounting,expected);this.used+=BigInt(expected.actualBytes!);this.held-=BigInt(r.reserved_bytes);r.phase='SETTLED';r.server_command_id=c.id;return{rows:[{value:true}]};}
  if(sql.startsWith('INSERT INTO anvil.commands(')){this.state.commands.push({id:args[0],project_id:args[1],actor_id:args[2],client_id:args[3],operation:args[4],command_id:args[5],request_hash:args[6],operation_id:args[7],authorization_receipt_id:args[8],approval_consumption_id:args[9],expected_version:args[10],control_generation:args[11],policy_ref:json(12),payload_ref:args[13]===null?null:json(13),result_ref:json(14),state:'APPLIED'});return{rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.authorization_receipts(')){this.state.receipts.push({id:args[0],scope_id:args[1],command_id:args[2],subject_ref:json(3),policy_ref:json(4),scope_digest:args[5],approval_decision_ref:args[6]});return{rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.audit_events(')&&sql.includes("'DENIED'"))return{rows:[],rowCount:1};
  if(sql.startsWith('INSERT INTO anvil.audit_events(')){this.state.audit.push({project_id:args[0],event_id:args[1],actor_ref:json(2),client_ref:args[3],command_id:args[4],operation_id:args[5],target_ref:json(6),policy_ref:json(7),approval_ref:args[8]===null?null:json(8),reason_code:args[9],scope_digest:args[10],outcome:'APPLIED',source_kind:'HUMAN_COMMAND'});return{rows:[],rowCount:1};}
  if(sql.startsWith("SELECT set_config('anvil.actor_id'"))return{rows:[]};
  if(sql.startsWith('INSERT INTO anvil.document_source_links(')){this.state.links.push({project_id:args[0],id:args[1],document_id:args[2],version:args[3],source_root_id:args[4],relative_path:args[5],source_snapshot_ref:json(6),blob_hash:args[7],link_version:1,state:'ACTIVE',current_event_id:args[8],linked_at:args[9],updated_at:args[9]});return{rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.document_source_link_events(')){this.state.legacy.push({id:args[0],project_id:args[1],link_id:args[2],link_version:1,content_hash:args[3],snapshot_json:json(4),command_id:args[5],created_at:args[6]});return{rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.document_source_observation_events(')){this.state.events.push({id:args[0],project_id:args[1],link_id:args[2],stream_id:args[3],version:args[4],content_hash:args[5],snapshot_json:json(6),command_id:args[7],projection_hash:args[8],created_at:args[9]});return{rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.document_source_observation_heads(')){this.state.heads.push({project_id:args[0],link_id:args[1],stream_id:args[2],head_version:args[3],head_hash:args[4]});return{rows:[],rowCount:1};}
  if(sql.startsWith('WITH member_scope'))return{rows:[this.legacyView(String(args[4]))]};
  if(sql.includes('FROM anvil.document_source_observation_events e JOIN anvil.commands')){const e=this.state.events.find(e=>e.project_id===args[0]&&e.link_id===args[1]&&e.stream_id===args[2]&&e.version===args[3]);if(!e)return{rows:[]};const c=this.state.commands.find(c=>c.id===e.command_id)!,ar=this.state.receipts.find(ar=>ar.command_id===c.id)!,origin=this.state.legacy.find(l=>l.link_id===e.link_id&&l.link_version===1)!;return{rows:[{...e,operation:c.operation,command_state:c.state,command_key:c.command_id,command_actor:c.actor_id,command_client:c.client_id,expected_version:c.expected_version,policy_ref:c.policy_ref,result_ref:c.result_ref,receipt_command_id:ar.command_id,subject_ref:ar.subject_ref,receipt_policy_ref:ar.policy_ref,audit_count:1,initial_hash:origin.content_hash,previous_hash:null}]};}
  const result=await Reflect.apply(parent.query,parent,[sql,args]);if(sql.includes('FROM anvil.permission_policies p JOIN'))this.afterPolicy?.(this.tx);return result;
 }} as unknown as PoolClient;}
}

test('실제 App sourcecommand 전체 메모리: LINK 원명령1/준비재검산/영수증·quota정산→고정GET→replay 추가0',async()=>{
 const repository=new SourceCommandMemoryAccess(),source=repository.port(),app=buildApp({},undefined,{repository,origin:'https://anvil.invalid'},undefined,undefined,undefined,undefined,null,source),s=repository.observation.snapshot;
 const command={schemaVersion:1,projectId:pid,commandId:id(85),clientId:actor.clientId,controlGeneration:1,operation:'linkDocumentSource',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{documentRef:doc,sourceRootId:id(8),relativePath:'a.md',sourceSnapshotRef:s.sourceSnapshotRef,blobHash:s.blobHash,reason:'관측으로 원문 연결'}};
 const send=()=>app.inject({method:'POST',url:`/api/v1/projects/${pid}/commands`,headers:{host:'anvil.invalid',origin:'https://anvil.invalid','content-type':'application/json','x-anvil-csrf':'C'.repeat(43)},payload:command});
 try{const first=await send();assert.equal(first.statusCode,200,first.body+' · '+repository.lastFailure);const result=first.json();assert.equal(result.status,'APPLIED');assert.equal(repository.state.commands.length,1);assert.equal(repository.state.receipts.length,1);assert.equal(repository.state.audit.length,1);assert.equal(repository.state.links[0]!.link_version,1);assert.equal(repository.state.events.length,1);assert.equal(repository.state.quota[0]!.phase,'SETTLED');assert.equal(repository.held,0n);assert(repository.used>0n);assert.equal(repository.reads,2);assert.equal(repository.currents,2);
  const e=result.data.sourceEvent,read=await app.inject({method:'GET',url:`/api/v1/projects/${pid}/documents/${doc.id}/source-links/${result.data.ref.id}/observations/${e.ref.id}/versions/1?version=1&contentHash=${doc.contentHash}`,headers:{host:'anvil.invalid'}});assert.equal(read.statusCode,200,read.body);assert.deepEqual(read.json().record,e);assert.equal(read.json().currentObservationVerified,false);
  const replay=await send();assert.equal(replay.statusCode,200,replay.body);assert.deepEqual(replay.json(),result);assert.equal(repository.state.commands.length,1);assert.equal(repository.reads,2);
 }finally{await app.close();}
});


test('실제 sourcecommand 원기한: DB root 조회 후 원10초가 소진되면 후속 등록query·저장0',async()=>{
 const saved=Object.getOwnPropertyDescriptor(globalThis,'performance')!;let mono=0;Object.defineProperty(globalThis,'performance',{value:{now:()=>mono},configurable:true,writable:true});
 const repository=new SourceCommandMemoryAccess();repository.afterRoot=()=>{mono=10001;};const app=buildApp({},undefined,{repository,origin:'https://anvil.invalid'},undefined,undefined,undefined,undefined,null,repository.port()),o=repository.observation.snapshot;
 try{const response=await app.inject({method:'POST',url:`/api/v1/projects/${pid}/commands`,headers:{host:'anvil.invalid',origin:'https://anvil.invalid','x-anvil-csrf':'C'.repeat(43)},payload:{schemaVersion:1,projectId:pid,commandId:id(86),clientId:actor.clientId,controlGeneration:1,operation:'linkDocumentSource',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{documentRef:doc,sourceRootId:id(8),relativePath:'a.md',sourceSnapshotRef:o.sourceSnapshotRef,blobHash:o.blobHash,reason:'원 기한 확인'}}});assert.equal(response.statusCode,409,response.body);assert.equal(repository.registrationQueries,0);assert.equal(repository.state.commands.length,0);assert.equal(repository.held,0n);}finally{await app.close();Object.defineProperty(globalThis,'performance',saved);}
});


import {ArtifactStore} from '../../../apps/server/storage/artifact-store.ts';
import {ProjectDocuments} from '../../../apps/server/modules/documents/project-documents.ts';
import {resolve} from 'node:path';
class SourceCommandMemoryStore extends ArtifactStore{
 data=new Map<string,Buffer>();reads=0;puts=0;verifies=0;
 constructor(){super(resolve('FN03_SOURCE_MEMORY_ONLY_NOT_CREATED'));}
 override async read(_pid:string,key:string,expected:{bytes:number;contentHash:string}){this.reads++;const bytes=this.data.get(key);assert(bytes);assert.equal(bytes.length,expected.bytes);assert.equal(contentHash(bytes),expected.contentHash);return Buffer.from(bytes);}
 override async put(pid:string,key:string,bytes:Buffer){this.puts++;this.data.set(key,Buffer.from(bytes));return`blobs/${pid}/${key}`;}
 override async verifyPublished(_pid:string,key:string,expected:{bytes:number;contentHash:string}){this.verifies++;const bytes=this.data.get(key);assert(bytes);assert.equal(bytes.length,expected.bytes);assert.equal(contentHash(bytes),expected.contentHash);}
}
test('COLLECT 명시메모리 store DI는 실제 원Artifact reader의 DB/ref/bytes/hash/격리 검산을 소비한다',async()=>{
 const store=new SourceCommandMemoryStore(),bytes=Buffer.from('원문'),artifact={artifactId:id(91),bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'text/plain;charset=utf-8'};store.data.set(artifact.artifactId,bytes);
 const documents=Reflect.construct(ProjectDocuments,[undefined,store]) as ProjectDocuments,db={query:async(_sql:string,args:unknown[])=>{assert.deepEqual(args,[artifact.artifactId,pid,artifact.contentHash,artifact.bytes,artifact.mediaType]);return{rows:[{state:'READY',storage_key:`blobs/${pid}/${artifact.artifactId}`,inspection_json:null}]};}} as unknown as PoolClient;
 assert.deepEqual(await documents.sourceArtifact(db,pid,artifact),bytes);assert.equal(store.reads,1);store.data.set(artifact.artifactId,Buffer.from('다름'));await assert.rejects(documents.sourceArtifact(db,pid,artifact));
});


for(const phase of ['초기','최종'] as const)test(`실제 sourcecommand ${phase} 인증callback: policyawait 원10초소진 뒤 clock/query 재진입0`,async()=>{
 const saved=Object.getOwnPropertyDescriptor(globalThis,'performance')!;let mono=0,lateClock=0;Object.defineProperty(globalThis,'performance',{value:{now:()=>mono},configurable:true,writable:true});
 const repository=new SourceCommandMemoryAccess();repository.afterPolicy=tx=>{if(phase==='초기'||tx>=5)mono=10001;};repository.onQuery=sql=>{if(mono>=10000&&sql.includes('clock_timestamp()'))lateClock++;};const app=buildApp({},undefined,{repository,origin:'https://anvil.invalid'},undefined,undefined,undefined,undefined,null,repository.port()),o=repository.observation.snapshot;
 try{const response=await app.inject({method:'POST',url:`/api/v1/projects/${pid}/commands`,headers:{host:'anvil.invalid',origin:'https://anvil.invalid','x-anvil-csrf':'C'.repeat(43)},payload:{schemaVersion:1,projectId:pid,commandId:id(87),clientId:actor.clientId,controlGeneration:1,operation:'linkDocumentSource',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{documentRef:doc,sourceRootId:id(8),relativePath:'a.md',sourceSnapshotRef:o.sourceSnapshotRef,blobHash:o.blobHash,reason:'인증callback 원 기한'}}});assert.equal(response.statusCode,phase==='초기'?409:503,response.body);assert.equal(lateClock,0);assert.equal(repository.state.commands.length,0);if(phase==='초기')assert.equal(repository.held,0n);else assert(repository.held>0n);}finally{await app.close();Object.defineProperty(globalThis,'performance',saved);}
});


test('최초짧은policy→clock query 미정착: 원100ms응답·인증callback정착분리·추가query0',async()=>{
 const repository=new SourceCommandMemoryAccess(),app=buildApp({},undefined,{repository,origin:'https://anvil.invalid'},undefined,undefined,undefined,undefined,null,repository.port());await app.ready();
 const performanceDescriptor=Object.getOwnPropertyDescriptor(globalThis,'performance')!,set=globalThis.setTimeout,clear=globalThis.clearTimeout,dateNow=Date.now;let mono=0;const wall=dateNow(),timers=new Map<object,{due:number;run:()=>void}>(),marker=Symbol('source-test-timer');
 Object.defineProperty(globalThis,'performance',{value:{now:()=>mono},configurable:true,writable:true});Date.now=()=>wall;
 globalThis.setTimeout=((fn:Function,ms:number,...args:unknown[])=>{const timer={[marker]:true,unref(){return this;},ref(){return this;}};timers.set(timer,{due:mono+ms,run:()=>fn(...args)});return timer;}) as unknown as typeof setTimeout;
 globalThis.clearTimeout=((timer:unknown)=>{if(timer&&typeof timer==='object'&&marker in timer)timers.delete(timer);else clear(timer as ReturnType<typeof setTimeout>);}) as typeof clearTimeout;
 let queries=0;repository.onQuery=()=>queries++;repository.policyExpiresAt=new Date(wall+100).toISOString();let entered!:()=>void,release!:()=>void,settled!:()=>void;const started=new Promise<void>(r=>entered=r),held=new Promise<void>(r=>release=r),authSettled=new Promise<void>(r=>settled=r);repository.clockHold=async()=>{entered();await held;};let response:any=null;
 const o=repository.observation.snapshot,pending=app.inject({method:'POST',url:`/api/v1/projects/${pid}/commands`,headers:{host:'anvil.invalid',origin:'https://anvil.invalid','x-anvil-csrf':'C'.repeat(43)},payload:{schemaVersion:1,projectId:pid,commandId:id(88),clientId:actor.clientId,controlGeneration:1,operation:'linkDocumentSource',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{documentRef:doc,sourceRootId:id(8),relativePath:'a.md',sourceSnapshotRef:o.sourceSnapshotRef,blobHash:o.blobHash,reason:'최초정책 pending 경계'}}});void pending.then(v=>response=v);
 try{await started;repository.onAuthSettled=settled;const beforeQueries=queries;assert.equal(repository.activeCallbacks,1);mono=200;for(const [timer,task]of [...timers].sort((a,b)=>a[1].due-b[1].due))if(task.due<=mono){timers.delete(timer);task.run();}for(let i=0;i<4;i++)await new Promise<void>(r=>setImmediate(r));
  assert(response,'고정wall/mono200에서도 원policy100ms에 응답해야 함');assert.equal(response.statusCode,503,response.body);assert.equal(repository.activeCallbacks,1,'응답기한종료가 raw query 정착은 아님');assert.equal(repository.state.commands.length,0);release();await authSettled;assert.equal(queries,beforeQueries,'기한후 raw query 정착뒤 추가 source query0');
 }finally{release();await authSettled;await pending;globalThis.setTimeout=set;globalThis.clearTimeout=clear;Date.now=dateNow;Object.defineProperty(globalThis,'performance',performanceDescriptor);await app.close();}assert.equal(repository.activeCallbacks,0);assert.equal(timers.size,0);
});
