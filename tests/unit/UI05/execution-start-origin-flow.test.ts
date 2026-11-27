import test,{after,mock} from 'node:test';
import * as nodeCrypto from 'node:crypto';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {createHash,createHmac} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import type {OriginPage,OriginView} from '../../../apps/web/src/features/session-detail/execution-start-origin-api.ts';
import type {PreparationOriginal} from '../../../apps/web/src/features/session-detail/preparation-history-api.ts';
import {executionStartOriginFixture,installExecutionStartOriginMemoryFS} from '../FN09/execution-start-origin-fixture.ts';
await installExecutionStartOriginMemoryFS();
// 서버 발급 ID에 사전 정책이 존재하는 기존 RAM 오라클이다. 실제 정책 순환 해결은 아니다.
let originUuid:{executionId:string;calls:number}|undefined;
const originalUuid=nodeCrypto.randomUUID;
const cryptoExports={...Object.fromEntries(Object.entries(nodeCrypto).filter(([key])=>key!=='default')),randomUUID:()=>{const id=originalUuid();return originUuid&&++originUuid.calls===7?originUuid.executionId:id;}};
const cryptoMock=mock.module('node:crypto',{defaultExport:{...cryptoExports},namedExports:cryptoExports});
after(()=>{originUuid=undefined;cryptoMock.restore();});


/** 실제 서버가 커밋한 원자료/명령 행만 판독한다. PG/OS 검증을 대신하지 않는 RAM 모델. */
async function normalSourceFixture(f:Awaited<ReturnType<typeof executionStartOriginFixture>>){
 const base=f.db.query;
 f.db.query=(async(sql:string,a:any[]=[])=>{
  if(sql==='SELECT anvil.fn111_normal_start_parent_current($1,$2,$3,$4,$5::jsonb,$6) AS valid'){
   assert(f.active());assert.deepEqual(a.slice(0,4),[f.actor.authSession.id,f.actor.actorId,f.actor.clientId,f.pid]);assert.equal(a[5],String(f.modes.tx));
   const input=JSON.parse(a[4]),q=input.request,p=q.payload,o=f.tables.origins!.find(r=>r.project_id===f.pid&&r.execution_id===p.executionId);
   assert.equal(input.purpose,'NORMAL_START_ORIGIN_PARENT_CURRENT');assert.equal(input.mode,'DIRECT');
   return{rows:[{valid:!!o&&o.execution_generation===p.executionGeneration&&canonicalJson(p.originParent)===canonicalJson({originRef:{id:o.origin_id,version:o.version,contentHash:o.content_hash},reservationRef:{id:o.credential_id,version:1,contentHash:o.reservation_hash}})&&!f.tables.executions!.some(r=>r.id===p.executionId&&f.commands.get(r.command_id)?.command_id!==q.commandId)}]};
  }
  if(sql.startsWith('SELECT c.id AS command_id FROM anvil.executions e JOIN anvil.commands c'))return{rows:f.tables.executions!.filter(r=>r.project_id===a[0]&&r.id===a[1]&&r.generation===a[2]).flatMap(r=>{const c=f.commands.get(r.command_id);return c&&c.project_id===a[0]&&c.command_id===a[3]&&c.actor_id===a[4]&&c.client_id===a[5]&&c.request_hash===a[6]&&canonicalJson(c.result_ref)===a[7]?[{command_id:c.id}]:[];})};
  if(sql==='SELECT anvil.normal_start_material_complete($1,$2) AS complete'){
   const c=f.commands.get(a[1]),x=f.tables.execution_commands!.filter(r=>r.project_id===a[0]&&r.created_command_id===a[1]),g=f.tables.execution_grants!.filter(r=>r.project_id===a[0]&&r.command_id===a[1]);
   const {envelope:_,...snapshot}=x[0]?.snapshot_json??{};
   return{rows:[{complete:!!c&&x.length===1&&g.length===1&&g[0].content_hash===contentHash(canonicalJson(g[0].snapshot_json))&&x[0].content_hash===contentHash(canonicalJson(snapshot))&&canonicalJson(snapshot)===canonicalJson(c.result_ref.data.snapshot)}]};
  }
  return base(sql,a);
 })as typeof f.db.query;
 const {registrationRef}=await import('../../../apps/server/modules/connections/project-registrations.ts'),prep=f.preparation.data,intent=prep.snapshot.intent;
 const refs={basis:prep.snapshot.basisRefs,source:intent.sourceScopes.map((v:any)=>v.observationRef),capability:[intent.capabilityRef],osFence:[prep.ref],storage:[prep.ref]};
 return{async observe(scope:any,checkedAt:string,signal:AbortSignal){assert(f.active());assert(!signal.aborted);return{scope,checkedAt,expiresAt:f.actor.authSession.idleExpiresAt,registrationRef:registrationRef(f.registration!.row as any),writerState:'NONE',stageRef:f.stage.data.snapshot.input.stageRef,demand:{attempts:1,calls:1,spoolBytes:1024,cost:null,costStatus:'VERIFIED_NO_CHARGE'},understandingReviewRef:null,checks:{...Object.fromEntries(Object.entries(refs).map(([k,evidenceRefs])=>[k,{state:'VERIFIED_CURRENT',evidenceRefs}])),understanding:{state:'NOT_REQUIRED',evidenceRefs:[]}}};}};
}
async function apiFixture(normal=false){const eid=originalUuid(),f=await executionStartOriginFixture(normal?{normalExecutionId:eid,connectorEnvironment:true,richContext:true,constitutionContext:true,environmentDependencies:true,snapshotRoot:true,originConsumptionStorage:true}:{}),{buildApp}=await import('../../../apps/server/app.ts'),{ApiClient}=await import('../../../apps/web/src/api/client.ts'),normalSource=normal?await normalSourceFixture(f):undefined,app=buildApp({},undefined,{repository:f.access,origin:'https://anvil-synthetic.invalid',artifactRoot:f.root},undefined,undefined,undefined,undefined,null,undefined,undefined,normalSource),session={user:{id:f.uid},clientId:f.cid,csrfToken:f.csrf},sent:{path:string;body:any;init:any}[]=[],mode={getDenied:false,lost:false,controlDenied:false,queueResponse:0,login:null as any,extraReservation:'NONE',afterPost:null as null|(()=>Promise<void>),getOverride:null as null|((path:string)=>Response|Promise<Response>|undefined)};let network=Promise.resolve();const client=new ApiClient(async(input:any,init:any={})=>{const path=String(input);assert(path.startsWith('/api/v1/'));assert.equal(init.credentials,'same-origin');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');sent.push({path,body:init.body?JSON.parse(init.body):null,init});if(path==='/api/v1/auth/login'&&mode.login)return Response.json(mode.login);if(init.method==='GET'){const projected=mode.getOverride?.(path);if(projected)return projected;}if(mode.getDenied&&path.includes('/execution-start-origins/'))return new Response(JSON.stringify({code:'PROJECT_OPERATION_DENIED'}),{status:403,headers:{'Content-Type':'application/json'}});const previous=network;let release!:()=>void;network=new Promise<void>(yes=>release=yes);await previous;let response;try{if(normal&&init.method==='POST'&&JSON.parse(init.body).operation==='registerExecutionStartOrigin')originUuid={executionId:eid,calls:0};response=await app.inject({method:init.method??'GET',url:path,headers:{...init.headers,host:'anvil-synthetic.invalid',origin:'https://anvil-synthetic.invalid',cookie:'__Host-anvil.sid='+f.token},...(init.body?{payload:JSON.parse(init.body)}:{})});}finally{originUuid=undefined;release();}if(response.statusCode===503&&f.state.unsupported.length)throw Error('미지원 메모리 SQL: '+f.state.unsupported.at(-1));if(init.method==='POST'&&mode.afterPost)await mode.afterPost();if(mode.lost&&init.method==='POST')throw Error('원 응답 유실');if(mode.queueResponse&&init.method==='POST'&&JSON.parse(init.body).operation==='queueExecutionCommand')return Response.json({code:'AUTH_REQUIRED'},{status:mode.queueResponse});let body=response.body;if(mode.extraReservation===(init.method==='POST'?'POST':'GET')&&response.statusCode===200&&(init.method==='POST'||path.includes('/execution-start-origins/'))){const value=JSON.parse(body),reservation=init.method==='POST'?value.data?.reservation:value.reservation;if(reservation)reservation.token='synthetic-forbidden-extra';body=JSON.stringify(value);}return new Response(body,{status:response.statusCode,headers:{'Content-Type':'application/json'}});});return{f,app,client,session,sent,mode,selection:{stageRequestRef:f.stage.data.ref,assignmentRef:f.confirmed.data.ref,preparationRef:f.preparation.data.ref,roleBindingRef:f.binding.data.ref}};}

test('Web 원 packet은 실제 App 저장 receipt를 후행 GET보다 먼저 보존하고 원 hash·false를 검산한다',async()=>{const q=await apiFixture(),api=await import('../../../apps/web/src/features/session-detail/execution-start-origin-api.ts');try{const packet=await api.prepareOrigin(q.client,q.session,q.f.pid,q.selection,'명시 원자료 저장',()=>true);assert(packet);let receipt:any;const view=await api.sendOrigin(q.client,q.session,packet,()=>true,()=>true,r=>receipt=r);assert(receipt);assert(view);assert.deepEqual(view.snapshot,receipt.data.snapshot);assert.equal(view.executionAuthorized,false);assert.equal(q.sent.filter(v=>v.init.method==='POST').length,1);const page=await api.readOriginHistory(q.client,q.f.pid,q.f.confirmed.data.ref,null,()=>true);assert.deepEqual(page!.items[0]!.ref,view.ref);await assert.rejects(api.sendOrigin(q.client,q.session,packet,()=>true,()=>true,()=>{}),(error:any)=>error.code==='ORIGIN_PACKET_UNAVAILABLE');}finally{await q.app.close();}assert.equal(q.f.active(),false);assert.deepEqual(q.f.state.unsupported,[]);});

test('POST 유실 UNKNOWN과 확정 receipt 뒤 보호 GET 거절은 다른 상태로 보존하고 추가 POST를 막는다',async()=>{const api=await import('../../../apps/web/src/features/session-detail/execution-start-origin-api.ts');for(const mode of ['LOST','DENIED']){const q=await apiFixture();try{const packet=await api.prepareOrigin(q.client,q.session,q.f.pid,q.selection,'원 외피 보존',()=>true);assert(packet);q.mode.lost=mode==='LOST';q.mode.getDenied=mode==='DENIED';let receipt:any;await assert.rejects(api.sendOrigin(q.client,q.session,packet,()=>true,()=>true,r=>receipt=r),(error:any)=>error.code===(mode==='LOST'?'CONNECTION_LOST':'PROJECT_OPERATION_DENIED'));assert.equal(api.packetStatus(packet),mode==='LOST'?'UNKNOWN':'SAVED');assert.equal(!!receipt,mode==='DENIED');const body=q.sent.find(v=>v.init.method==='POST')!.body;assert.deepEqual(body,packet.command);assert.equal(Object.keys(body).length,11);await assert.rejects(api.sendOrigin(q.client,q.session,packet,()=>true,()=>true,()=>{}),(error:any)=>error.code==='ORIGIN_PACKET_UNAVAILABLE');assert.equal(q.sent.filter(v=>v.init.method==='POST').length,1);assert.equal(q.f.tables.origins!.length,1);}finally{await q.app.close();}assert.equal(q.f.active(),false);}});

test('동일 packet 동시 공급과 transport 교체는 추가 효과 전에 거절한다',async()=>{const q=await apiFixture(),api=await import('../../../apps/web/src/features/session-detail/execution-start-origin-api.ts');try{const packet=await api.prepareOrigin(q.client,q.session,q.f.pid,q.selection,'단발 공급',()=>true);assert(packet);const results=await Promise.allSettled([api.sendOrigin(q.client,q.session,packet,()=>true,()=>true,()=>{}),api.sendOrigin(q.client,q.session,packet,()=>true,()=>true,()=>{})]);assert.equal(results.filter(v=>v.status==='fulfilled').length,1);assert.equal(results.filter(v=>v.status==='rejected').length,1);assert.equal(q.sent.filter(v=>v.init.method==='POST').length,1);const next=await api.prepareOrigin(q.client,q.session,q.f.pid,q.selection,'포트 교체',()=>true);assert(next);const old=q.client.transport;q.client.transport=async(...args:any[])=>Reflect.apply(old,globalThis,args);await assert.rejects(api.sendOrigin(q.client,q.session,next,()=>true,()=>true,()=>{}),(error:any)=>error.code==='ORIGIN_PACKET_UNAVAILABLE');assert.equal(q.sent.filter(v=>v.init.method==='POST').length,1);}finally{await q.app.close();}assert.equal(q.f.active(),false);});

test('정상 S/Q hash를 보존해도 GET·POST reservation 외피 추가 token은 반환·보존 콜백에 도달하지 않는다',async()=>{const api=await import('../../../apps/web/src/features/session-detail/execution-start-origin-api.ts');for(const mode of ['POST','GET']){const q=await apiFixture();try{const packet=await api.prepareOrigin(q.client,q.session,q.f.pid,q.selection,'외피 검산',()=>true);assert(packet);q.mode.extraReservation=mode;const receipts:any[]=[];await assert.rejects(api.sendOrigin(q.client,q.session,packet,()=>true,()=>true,r=>receipts.push(r)),(e:any)=>e.code==='EXECUTION_START_ORIGIN_RESPONSE_INVALID');assert.equal(receipts.length,mode==='POST'?0:1);for(const receipt of receipts)assert.equal(Object.hasOwn(receipt.data.reservation,'token'),false);assert.equal(api.packetStatus(packet),mode==='POST'?'UNKNOWN':'SAVED');assert.equal(q.sent.filter(v=>v.init.method==='POST').length,1);}finally{await q.app.close();}}});

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

let bundle:Promise<string>|undefined;
async function uiCode(){return bundle??=Promise.resolve().then(async()=>{const app=fileURLToPath(new URL('../../../apps/web/src/App.tsx',import.meta.url)),panel=fileURLToPath(new URL('../../../apps/web/src/features/session-detail/ExecutionStartOriginPanel.tsx',import.meta.url)),client=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url));const result:any=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:start-origin',name:'StartOriginUI',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'start-origin-memory',resolveId(id){if(id.endsWith('virtual:start-origin'))return '\0start-origin';},load(id){if(id==='\0start-origin')return "import * as React from 'react';import{createRoot}from'react-dom/client';import{App}from"+JSON.stringify(app)+";import{ExecutionStartOriginPanel}from"+JSON.stringify(panel)+";import{ApiClient}from"+JSON.stringify(client)+";export{React,createRoot,App,ExecutionStartOriginPanel,ApiClient};";}}]});return(Array.isArray(result)?result[0]:result).output.find((v:any)=>v.type==='chunk').code+';return StartOriginUI;';});}
async function mountApp(normal=false){const q=await apiFixture(normal),saved=new Map<string,PropertyDescriptor|undefined>(),channels:MessageChannel[]=[],events=new Map<string,Function[]>(),document:any=new MemoryNode('#document',9);document.ownerDocument=document;document.createElement=(name:string)=>new MemoryNode(name,1,document);document.createElementNS=(_ns:string,name:string)=>document.createElement(name);document.createTextNode=(text:string)=>{const n=new MemoryNode('#text',3,document);n.data=text;return n;};document.documentElement=document.createElement('html');document.body=document.createElement('body');document.documentElement.appendChild(document.body);document.activeElement=document.body;
 const actualCsrf=createHmac('sha256',Buffer.alloc(32,7)).update('csrf:'+q.f.token).digest('base64url'),raw=q.f.db.query;
 q.f.db.query=async(sql:string,args:any[]=[])=>{if(sql==='UPDATE anvil.auth_sessions SET last_seen_at=$2,idle_expires_at=$3 WHERE id=$1'){assert.equal(args[0],q.f.actor.authSession.id);return{rows:[]};}const value=await raw(sql,args);return sql.startsWith('SELECT s.*,u.id AS uid')?{...value,rows:value.rows.map((r:any)=>({...r,display_name:'메모리 사용자',csrf_digest:createHash('sha256').update(q.mode.login?.csrfToken??actualCsrf).digest('hex')}))}:value;};
 const location={hash:`#/projects/${q.f.pid}/session/assignments/${q.f.confirmed.data.snapshot.draftRef.id}/versions/${q.f.confirmed.data.snapshot.draftRef.version}/${q.f.confirmed.data.snapshot.draftRef.contentHash}`,protocol:'https:'},add=(k:string,f:Function)=>events.set(k,[...(events.get(k)??[]),f]),remove=(k:string,f:Function)=>events.set(k,(events.get(k)??[]).filter(v=>v!==f)),NativeChannel=globalThis.MessageChannel;class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
 const window:any={document,location,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener:add,removeEventListener:remove,getComputedStyle:()=>({})};document.defaultView=window;
 for(const[k,v]of Object.entries({document,window,location,fetch:q.client.transport,addEventListener:add,removeEventListener:remove,HTMLElement:MemoryNode,Node:MemoryNode,MessageChannel:OwnedChannel,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});}
 const ui=new Function(await uiCode())(),container=document.createElement('main');document.body.appendChild(container);const root=ui.createRoot(container),nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(v=>nodes(v))],flush=async()=>ui.React.act(async()=>{await new Promise(yes=>setImmediate(yes));}),wait=async(check:()=>boolean)=>{for(let n=0;n<300&&!check();n++)await flush();assert(check(),container.textContent.slice(-1500)+JSON.stringify(q.f.state.unsupported));},click=async(text:string)=>{const choices=nodes().filter(n=>n.tagName==='BUTTON'&&n.textContent===text);assert.equal(choices.length,1,text+' / '+container.textContent.slice(-1200));assert.equal(choices[0]!.disabled,false,text+' 활성');await ui.React.act(async()=>choices[0]!.dispatchEvent({type:'click',button:0,bubbles:true}));},change=async(label:string,value:any)=>{const node=nodes().find(n=>n.getAttribute('aria-label')===label);assert(node,label);const key=Object.keys(node).find(k=>k.startsWith('__reactProps$'));assert(key);await ui.React.act(async()=>{(node as any)[key].onChange({target:typeof value==='boolean'?{checked:value}:{value}});});};
 await ui.React.act(async()=>root.render(ui.React.createElement(ui.App)));return{...q,container,nodes,wait,click,change,flush,ui,root,navigate:async(hash:string)=>{location.hash=hash;await ui.React.act(async()=>{for(const f of events.get('hashchange')??[])f();});},close:async()=>{await ui.React.act(async()=>root.unmount());for(const channel of channels){channel.port1.close();channel.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);await q.app.close();}};
}

test('실제 App·SessionDetail·Panel은 명시 선택과 원 packet CAS로 저장·보호 원문을 연결한다',async()=>{const q=await mountApp();try{await q.wait(()=>q.nodes().some(n=>n.getAttribute('aria-label')==='START 원자료 저장'));await q.click('원자료 선택 목록 조회');await q.wait(()=>q.nodes().some(n=>n.getAttribute('aria-label')==='대기 요청'));await q.change('대기 요청',q.f.stage.data.ref.id);await q.change('등록 준비',q.f.preparation.data.ref.id);await q.change('책임 예약',q.f.binding.data.ref.id);await q.change('기록 이유','원 App 명시 저장');await q.click('등록 준비 고정');await q.wait(()=>q.container.textContent.includes('상태 PREPARED'));const check=q.nodes().find(n=>n.tagName==='INPUT'&&n.parentNode?.textContent.includes('선택 원자료의 비실행 저장을 확인했습니다'));assert(check);const prop=Object.keys(check).find(k=>k.startsWith('__reactProps$'));assert.equal((check as any)[prop!].type,'checkbox');await q.ui.React.act(async()=>{(check as any)[prop!].onChange({target:{checked:true}});});await q.click('원자료 명시 저장');await q.wait(()=>q.nodes().some(n=>n.getAttribute('aria-label')==='START 원자료 보호 원문'));assert(q.container.textContent.includes('원 App 명시 저장'));assert.equal(q.f.tables.origins!.length,1);assert.equal(q.sent.filter(v=>v.init.method==='POST'&&v.body.operation==='registerExecutionStartOrigin').length,1);await q.click('보호 이력 조회');await q.wait(()=>q.container.textContent.includes(q.f.tables.origins![0].origin_id+' 원문 조회'));assert(!q.nodes().some(n=>n.getAttribute('aria-label')==='START 원자료 보호 원문'));}finally{await q.close();}assert.equal(q.f.active(),false);assert.deepEqual(q.f.state.unsupported,[]);});

async function prepareInApp(q:Awaited<ReturnType<typeof mountApp>>){await q.wait(()=>q.nodes().some(n=>n.getAttribute('aria-label')==='START 원자료 저장'));await q.click('원자료 선택 목록 조회');await q.wait(()=>q.nodes().some(n=>n.getAttribute('aria-label')==='대기 요청'));await q.change('대기 요청',q.f.stage.data.ref.id);await q.change('등록 준비',q.f.preparation.data.ref.id);await q.change('책임 예약',q.f.binding.data.ref.id);await q.change('기록 이유','원 packet 이탈 검산');await q.click('등록 준비 고정');await q.wait(()=>q.container.textContent.includes('상태 PREPARED'));const check=q.nodes().find(n=>n.tagName==='INPUT'&&n.parentNode?.textContent.includes('선택 원자료의 비실행 저장을 확인했습니다'));assert(check);const prop=Object.keys(check).find(k=>k.startsWith('__reactProps$'));assert.equal((check as any)[prop!].type,'checkbox');await q.ui.React.act(async()=>{(check as any)[prop!].onChange({target:{checked:true}});});}
function detailHash(q:Awaited<ReturnType<typeof mountApp>>){const ref=q.f.confirmed.data.snapshot.draftRef;return `#/projects/${q.f.pid}/session/assignments/${ref.id}/versions/${ref.version}/${ref.contentHash}`;}
function originPosts(q:Awaited<ReturnType<typeof mountApp>>){return q.sent.filter(v=>v.init.method==='POST'&&v.body.operation==='registerExecutionStartOrigin');}

const recordHash=(value:unknown)=>contentHash(canonicalJson(value));
const exampleRef=(n:number)=>({id:'89911122-2222-4222-8222-'+String(n).padStart(12,'0'),version:1,contentHash:String(n%10).repeat(64)});
const hasPanel=(q:Awaited<ReturnType<typeof mountApp>>,label:string)=>q.nodes().some(node=>node.getAttribute('aria-label')===label);
const linkedPreparationLabel='START에 보관된 준비 원문 검산';
const linkedPreparationResult='START에 연결된 준비 원문 검산 결과';
const originPanelLabel='START 원자료 보호 원문';
async function saveAppOrigin(q:Awaited<ReturnType<typeof mountApp>>){
 await prepareInApp(q);
 await q.click('원자료 명시 저장');
 await q.wait(()=>hasPanel(q,originPanelLabel));
}

test('실제 App은 선택·보호 조회한 원자료가 있을 때만 정상 START 접수를 명시 준비한다',{timeout:30000},async()=>{
 const q=await mountApp();
 try{
  await q.wait(()=>hasPanel(q,'START 원자료 저장'));
  assert(!q.nodes().some(node=>node.tagName==='BUTTON'&&node.textContent==='정상 START 접수 준비'));
  await saveAppOrigin(q);
  assert(q.nodes().some(node=>node.tagName==='BUTTON'&&node.textContent==='정상 START 접수 준비'));
  assert.equal(q.sent.filter(value=>value.body?.operation==='queueExecutionCommand').length,0);
 }finally{await q.close();}
});

async function prepareAppNormal(q:Awaited<ReturnType<typeof mountApp>>){
 await saveAppOrigin(q);
 await q.click('정상 START 접수 준비');
 await q.wait(()=>q.container.textContent.includes('접수 준비 · 미전송')||q.nodes().some(n=>n.getAttribute('aria-label')==='정상 START 접수'&&n.childNodes.some(c=>c.getAttribute('role')==='alert')));assert(q.container.textContent.includes('접수 준비 · 미전송'),q.nodes().find(n=>n.getAttribute('aria-label')==='정상 START 접수')?.textContent+JSON.stringify(q.sent.slice(-4).map(v=>v.path)));
 const checkbox=q.nodes().find(n=>n.tagName==='INPUT'&&n.parentNode?.textContent.includes('이 원자료와 고정 실행 ID로 접수 저장을 요청합니다'));assert(checkbox);
 const prop=Object.keys(checkbox).find(k=>k.startsWith('__reactProps$'));assert(prop);
 await q.ui.React.act(async()=>{(checkbox as any)[prop].onChange({target:{checked:true}});});
}
const normalPosts=(q:Awaited<ReturnType<typeof apiFixture>>)=>q.sent.filter(v=>v.body?.operation==='queueExecutionCommand');
test('실제 App 정상 START는 별도 확인·상위 원명령 CAS 뒤 실제 서버의 접수 저장만 표시한다',{timeout:30000},async()=>{
 const q=await mountApp(true);
 try{
  await prepareAppNormal(q);assert.equal(normalPosts(q).length,0);
  const origin=q.f.tables.origins![0]!;
  await q.click('정상 START 명시 접수');
  await q.wait(()=>q.container.textContent.includes('정상 START 접수 저장 확인')||q.container.textContent.includes('접수 거절')||q.container.textContent.includes('접수 결과 불명'));
  assert.match(q.container.textContent,/정상 START 접수 저장 확인/);
  const [post]=normalPosts(q);assert(post);const p=post.body.payload;
  assert.equal(p.executionId,origin.execution_id);assert.equal(p.executionGeneration,1);
  assert.deepEqual(p.originParent,{originRef:{id:origin.origin_id,version:1,contentHash:origin.content_hash},reservationRef:{id:origin.credential_id,version:1,contentHash:origin.reservation_hash}});
  assert.deepEqual(p.permissionPolicyRef,q.f.policyRef);assert.deepEqual(p.budgetPolicyRef,origin.snapshot_json.budgetPolicyRef);
  assert.deepEqual(p.payload,{contextBundleRef:origin.snapshot_json.contextBundleRef,optionsRef:origin.snapshot_json.preparationRef});
  assert.equal(q.f.tables.executions!.length,1);assert.equal(q.f.tables.execution_grants!.length,1);
  assert.match(q.container.textContent,/실행 허가·시작 완료는 별도/);assert.deepEqual(q.f.state.unsupported,[]);
 }finally{await q.close();}
});

test('실제 App 정상 START 유실 뒤 원자료를 닫아도 같은 본문·멱등키만 재확인한다',{timeout:30000},async()=>{
 const q=await mountApp(true);
 try{
  await prepareAppNormal(q);q.mode.lost=true;await q.click('정상 START 명시 접수');
  await q.wait(()=>q.container.textContent.includes('접수 결과 불명'));assert.equal(q.f.tables.executions!.length,1);
  const first=normalPosts(q)[0]!;await q.click('START 원자료 보호 원문 닫기');q.mode.lost=false;
  const n=q.sent.length;await q.click('같은 START 원명령 재확인');
  await q.wait(()=>q.container.textContent.includes('정상 START 접수 저장 확인'));
  const second=normalPosts(q)[1]!;assert.equal(second.init.body,first.init.body);assert.equal(second.init.headers['Idempotency-Key'],first.init.headers['Idempotency-Key']);
  assert.deepEqual(q.sent.slice(n).map(v=>[v.init.method,v.path]),[['GET',`/api/v1/projects/${q.f.pid}`],['POST',`/api/v1/projects/${q.f.pid}/commands`]]);
  assert.equal(q.f.tables.executions!.length,1);assert.equal(q.f.tables.execution_grants!.length,1);assert.deepEqual(q.f.state.unsupported,[]);
 }finally{await q.close();}
});

test('실제 App 재인증은 원 UNKNOWN을 보존하고 새 CSRF로 같은 명령만 명시 재확인한다',{timeout:30000},async()=>{
 const q=await mountApp(true);
 try{
  await prepareAppNormal(q);q.mode.lost=true;await q.click('정상 START 명시 접수');await q.wait(()=>q.container.textContent.includes('접수 결과 불명'));
  const original=normalPosts(q)[0]!;q.mode.lost=false;q.mode.queueResponse=401;
  q.mode.getOverride=path=>path==='/api/v1/auth/setup'?Response.json({setupRequired:false,policyVersion:1}):undefined;
  await q.click('같은 START 원명령 재확인');await q.wait(()=>q.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='로그인'&&!n.disabled));
  assert(!q.container.textContent.includes(original.body.commandId));
  q.mode.queueResponse=0;q.mode.login={user:{id:q.f.uid,displayName:'다시 인증한 사용자'},clientId:q.f.cid,csrfToken:'b'.repeat(43)};
  const form=q.nodes().find(n=>n.tagName==='FORM');assert(form);const prop=Object.keys(form).find(k=>k.startsWith('__reactProps$'));assert(prop);
  await q.ui.React.act(async()=>{await(form as any)[prop].onSubmit({preventDefault(){}});});
  await q.wait(()=>q.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='같은 START 원명령 재확인'));
  assert(q.container.textContent.includes(original.body.commandId));assert(q.container.textContent.includes('접수 결과 불명'));
  const n=q.sent.length;await q.click('같은 START 원명령 재확인');await q.wait(()=>q.container.textContent.includes('정상 START 접수 저장 확인'));
  const recovered=normalPosts(q).at(-1)!;assert.equal(recovered.init.body,original.init.body);assert.equal(recovered.init.headers['Idempotency-Key'],original.init.headers['Idempotency-Key']);assert.equal(recovered.init.headers['X-Anvil-CSRF'],'b'.repeat(43));
  assert.deepEqual(q.sent.slice(n).map(v=>[v.init.method,v.path]),[['GET',`/api/v1/projects/${q.f.pid}`],['POST',`/api/v1/projects/${q.f.pid}/commands`]]);assert.equal(q.f.tables.executions!.length,1);
 }finally{await q.close();}
});

test('실제 App 정상 START의 이탈 뒤 늦은 200·401은 새 화면과 인증에 반영하지 않는다',{timeout:30000},async()=>{
 for(const status of [200,401]){
  const q=await mountApp(true);let release!:()=>void;
  try{
   await prepareAppNormal(q);const held=new Promise<void>(resolve=>{release=resolve;});q.mode.afterPost=()=>held;q.mode.queueResponse=status===401?401:0;
   await q.click('정상 START 명시 접수');await q.wait(()=>q.f.tables.executions!.length===1);
   await q.navigate('#/projects/'+q.f.pid+'/session');q.mode.afterPost=null;
   await q.ui.React.act(async()=>{release();await new Promise(resolve=>setImmediate(resolve));});
   await q.navigate(detailHash(q));await q.wait(()=>q.container.textContent.includes('접수 결과 불명'));
   assert.doesNotMatch(q.container.textContent,/정상 START 접수 저장 확인|Anvil 로그인/);assert.equal(normalPosts(q).length,1);
  }finally{release?.();await q.close();}
 }
});

test('실제 App 정상 START는 현재 정책 head 교체와 이탈 직전 DOM 클릭에서 새 POST를 보내지 않는다',{timeout:30000},async()=>{
 const q=await mountApp(true);
 try{
  await prepareAppNormal(q);q.f.modes.policyVersion++;
  await q.click('정상 START 명시 접수');await q.wait(()=>q.container.textContent.includes('RUNTIME_POLICY_NOT_CURRENT'));
  assert.equal(normalPosts(q).length,0);assert(q.container.textContent.includes('접수 준비 · 미전송'));
  const start=q.nodes().find(n=>n.tagName==='BUTTON'&&n.textContent==='정상 START 명시 접수');assert(start);
  globalThis.location.hash='#/projects';await q.ui.React.act(async()=>start.dispatchEvent({type:'click',button:0,bubbles:true}));await q.flush();
  assert.equal(normalPosts(q).length,0);assert.equal(q.f.tables.executions!.length,0);
 }finally{await q.close();}
});

test('실제 App 정상 START의 서버 현재성 412는 저장·실행 성공으로 바꾸거나 자동 재전송하지 않는다',{timeout:30000},async()=>{
 const q=await mountApp(true);
 try{
  await prepareAppNormal(q);q.f.registration!.row.revoked_at=new Date();
  await q.click('정상 START 명시 접수');await q.wait(()=>q.container.textContent.includes('접수 거절')||q.container.textContent.includes('접수 결과 불명'));
  assert.equal(normalPosts(q).length,1);assert.equal(q.f.tables.executions!.length,0);assert.equal(q.f.tables.execution_grants!.length,0);
  assert.match(q.container.textContent,/현재 준비·환경·등록·권한 조건을 확인하지 못했습니다/);assert.doesNotMatch(q.container.textContent,/정상 START 접수 저장 확인/);
 }finally{await q.close();}
});

async function normalPacketFixture(){
 const q=await apiFixture(true),originApi=await import('../../../apps/web/src/features/session-detail/execution-start-origin-api.ts'),normal=await import('../../../apps/web/src/features/session-detail/normal-start-write-api.ts');
 const original=await originApi.prepareOrigin(q.client,q.session,q.f.pid,q.selection,'정상 START 호출 수명 검산',()=>true);assert(original);
 const selected=await originApi.sendOrigin(q.client,q.session,original,()=>true,()=>true,()=>{});assert(selected);
 const assignment={projectId:q.f.pid,...q.f.confirmed.data,observedAt:new Date().toISOString()};
 const packet=await normal.prepareNormalStart(q.client,q.session,assignment,selected,()=>true);assert(packet);
 return{...q,normal,packet,selected};
}
test('정상 START 원 UNKNOWN은 같은 주체의 새 CSRF·transport에서 동일 JSON으로 회복하고 타 주체·위조 packet은 거절한다',{timeout:30000},async()=>{
 const q=await normalPacketFixture();let saved=0;
 const hooks={beforeDispatch:()=>true,notSent:()=>{},stored:()=>{saved++;return true;},unknown:()=>{}};
 try{
  q.mode.lost=true;await assert.rejects(q.normal.sendNormalStart(q.client,q.session,q.packet,()=>true,hooks));assert.equal(q.normal.normalStartStatus(q.packet),'UNKNOWN');
  const first=normalPosts(q)[0]!;const original=q.client.transport,newSession={...q.session,csrfToken:'b'.repeat(43)};
  q.client.transport=async(input,init)=>{const headers={...init?.headers,'X-Anvil-CSRF':q.f.csrf};return original(input,{...init,headers});};q.mode.lost=false;
  for(const status of [401,403,412]){
   const current=q.client.transport;q.client.transport=async(input,init)=>init?.method==='POST'?new Response(JSON.stringify({code:'PROJECT_OPERATION_DENIED'}),{status,headers:{'Content-Type':'application/json'}}):current(input,init);
   await assert.rejects(q.normal.sendNormalStart(q.client,newSession,q.packet,()=>true,hooks));assert.equal(q.normal.normalStartStatus(q.packet),'UNKNOWN');q.client.transport=current;
  }
  await assert.rejects(q.normal.sendNormalStart(q.client,{...newSession,clientId:originalUuid()},q.packet,()=>true,hooks),{code:'NORMAL_START_PACKET_UNAVAILABLE'});
  await assert.rejects(q.normal.sendNormalStart(q.client,newSession,structuredClone(q.packet),()=>true,hooks),{code:'NORMAL_START_PACKET_UNAVAILABLE'});
  const n=q.sent.length;await q.normal.sendNormalStart(q.client,newSession,q.packet,()=>true,hooks);
  assert.equal(saved,1);assert.equal(q.normal.normalStartStatus(q.packet),'STORED');assert.equal(normalPosts(q).at(-1)!.init.body,first.init.body);
  assert.equal(normalPosts(q).at(-1)!.init.headers['Idempotency-Key'],first.init.headers['Idempotency-Key']);
  assert.deepEqual(q.sent.slice(n).map(v=>v.init.method),['GET','POST']);assert.equal(q.f.tables.executions!.length,1);
 }finally{await q.app.close();}
});

test('정상 START 최종 CAS 뒤 current 상실은 전송 전 원 phase 복원하고 동시 전송은 하나만 허용한다',{timeout:30000},async()=>{
 const q=await normalPacketFixture();let current=true,restored=0,unknown=0;
 try{
  await q.normal.sendNormalStart(q.client,q.session,q.packet,()=>current,{beforeDispatch:()=>{current=false;return true;},notSent:()=>{restored++;},stored:()=>false,unknown:()=>{unknown++;}});
  assert.equal(restored,1);assert.equal(unknown,0);assert.equal(q.normal.normalStartStatus(q.packet),'PREPARED');assert.equal(normalPosts(q).length,0);
  current=true;const hooks={beforeDispatch:()=>true,notSent:()=>{},stored:()=>true,unknown:()=>{unknown++;}};
  const values=await Promise.allSettled([q.normal.sendNormalStart(q.client,q.session,q.packet,()=>true,hooks),q.normal.sendNormalStart(q.client,q.session,q.packet,()=>true,hooks)]);
  assert.equal(values.filter(v=>v.status==='fulfilled').length,1);assert.equal(normalPosts(q).length,1);assert.equal(unknown,0);
 }finally{await q.app.close();}
});

test('정상 START 저장 응답의 원 hash·고정 실행·비실행 플래그 손상은 성공 콜백에 도달하지 않는다',{timeout:30000},async()=>{
 for(const mode of ['HASH','EXECUTION','AUTHORITY']){
  const q=await normalPacketFixture();let stored=0;
  try{
   const original=q.client.transport;q.client.transport=async(input,init)=>{
    const response=await original(input,init);if(init?.method!=='POST')return response;
    assert.equal(response.status,200);const value=await response.json();
    if(mode==='HASH')value.data.ref.contentHash='f'.repeat(64);
    else{if(mode==='EXECUTION')value.data.snapshot.executionId=originalUuid();else value.data.snapshot.executionAuthorized=true;value.data.ref.contentHash=contentHash(canonicalJson(value.data.snapshot));}
    return Response.json(value);
   };
   await assert.rejects(q.normal.sendNormalStart(q.client,q.session,q.packet,()=>true,{beforeDispatch:()=>true,notSent:()=>{},stored:()=>{stored++;return true;},unknown:()=>{}}),{code:'NORMAL_START_RESPONSE_INVALID'});
   assert.equal(stored,0);assert.equal(q.normal.normalStartStatus(q.packet),'UNKNOWN');assert.equal(normalPosts(q).length,1);assert.equal(q.f.tables.executions!.length,1);
  }finally{await q.app.close();}
 }
});

test('실제 START 원자료는 명시 GET으로 정확 CONTEXT_REVIEW 준비만 표시하고 원 receipt를 그대로 둔다',async()=>{
 const q=await mountApp();
 try{
  await saveAppOrigin(q);
  const n=q.sent.length;
  assert(!hasPanel(q,linkedPreparationResult));
  await q.click(linkedPreparationLabel);
  await q.wait(()=>hasPanel(q,linkedPreparationResult));
  assert.deepEqual(q.sent.slice(n).map(v=>[v.init.method,v.path]),[['GET',`/api/v1/projects/${q.f.pid}/execution-preparations/${q.f.preparation.data.ref.id}/versions/1`]]);
  assert.match(q.container.textContent,/CONTEXT_REVIEW · 연결된 준비 원문/);
  assert.match(q.container.textContent,/확정 receipt 보존/);
  assert.doesNotMatch(q.container.textContent,/정착 이해 판단 원문 검산/);
  await q.click('연결된 준비 원문 닫기');assert(!hasPanel(q,linkedPreparationResult));assert(hasPanel(q,originPanelLabel));
  assert.equal(originPosts(q).length,1);
 }finally{await q.close();}
});

function fixedWorkProjection(origin:OriginView,preparation:PreparationOriginal,mode:string){
 const s=origin.snapshot,prep=preparation.snapshot,intent=prep.intent;
 const scope={projectId:origin.projectId,executionId:exampleRef(1).id,executionGeneration:4};
 const reviewedRole=mode==='REVIEW_ROLE'?exampleRef(21):s.roleBindingRef;
 const ground={
  bundleRef:intent.contextBundleRef,preparationRef:exampleRef(2),grantRef:exampleRef(3),startCommandRef:exampleRef(4),manifestRef:exampleRef(5),
  roleBindingRef:reviewedRole,agentSessionRef:s.sessionBindingRef,roleRef:exampleRef(6),subjectBindingRef:reviewedRole,
  requestRef:exampleRef(7),responseRef:exampleRef(8),basisRefs:prep.basisRefs,latestInstructionRefs:prep.latestInstructionRefs,
  requiredPartRefs:[exampleRef(9)],receivedPartRefs:[exampleRef(9)],deliveryReceiptRefs:[exampleRef(10)],responsePartRefs:[exampleRef(11)],
  status:'SOURCE_BASIS_ONLY',subjectBindingState:'VERIFIED',reviewAvailable:false,scope,executionAuthorized:false,dispatchPerformed:false
 };
 const criteria=['PURPOSE_REASON','BASELINE_AUTHORITY','DECISIONS_REASON','CURRENT_POSITION','ACTUAL_GAPS','NEXT_ACTION']
  .map(code=>({code,sourceRefs:[ground.basisRefs[0]],responsePartRefs:ground.responsePartRefs}));
 const binding={transport:'NORMAL_PROTECTED',scope,bundleRef:ground.bundleRef,responseRef:ground.responseRef,subjectBindingRef:ground.subjectBindingRef,
  basisRefs:ground.basisRefs,latestInstructionRefs:ground.latestInstructionRefs,requiredPartRefs:ground.requiredPartRefs,receivedPartRefs:ground.receivedPartRefs,
  responsePartRefs:ground.responsePartRefs,criteria,sourceState:'AVAILABLE',responseSubject:'EXTERNAL_AGENT',sourceBasis:ground};
 const rows:any[]=[];
 for(const version of [1,2]){
  const input={bundleRef:binding.bundleRef,responseRef:binding.responseRef,subjectBindingRef:binding.subjectBindingRef,criteriaVersion:1,
   items:criteria.map(c=>({...c,judgement:version===1?'MATCH':'MISMATCH',reason:version===1?'당시 근거 대조':'최신 판단의 별도 근거'})),
   reason:version===1?'이 START 준비에 고정된 당시 판단':'더 새 판단으로 대체하면 안 됨'};
  const request={schemaVersion:1,projectId:scope.projectId,commandId:exampleRef(11+version).id,clientId:s.subject.clientId,controlGeneration:s.subject.controlGeneration,
   operation:'reviewUnderstanding',targetId:scope.executionId,expectedVersion:scope.executionGeneration,baselineRefs:[],approvalRef:null,payload:input};
  const snapshot={scope,sequence:version,previousRef:rows[0]?.ref??null,request,requestHash:recordHash(request),reviewer:s.subject,policyRef:s.observedPolicyRef,
   currentBinding:binding,input,outcome:version===1?'ACCEPTED':'NOT_ACCEPTED',recordedAt:s.recordedAt,executionAuthorized:false,dispatchPerformed:false};
  rows.push({ref:{id:exampleRef(14).id,version,contentHash:recordHash(snapshot)},snapshot});
 }
 intent.mode='WORK';
 prep.missingConditions=[...new Set([...prep.missingConditions,'UNDERSTANDING_NOT_REVIEWED'])];
 s.unresolvedChecks=[...new Set([...s.unresolvedChecks,'UNDERSTANDING_NOT_REVIEWED'])];
 if(mode!=='LEGACY')prep.understandingBasis={kind:'NORMAL_UNDERSTANDING_WORK_BASIS',scope,reviewRef:rows[0].ref,preparationRef:ground.preparationRef,
  assignmentRef:intent.assignmentRef,roleBindingRef:intent.roleBindingRef,agentSessionRef:mode==='SESSION'?exampleRef(19):ground.agentSessionRef,
  contextBundleRef:intent.contextBundleRef,connectionRef:intent.connectionRef,environmentRef:intent.environmentRef,responseRef:ground.responseRef,
  requestRef:ground.requestRef,basisRefs:prep.basisRefs,latestInstructionRefs:prep.latestInstructionRefs};
 if(mode==='MISMATCH_ROLE'){
  intent.roleBindingRef=exampleRef(20);prep.understandingBasis.roleBindingRef=intent.roleBindingRef;
 }
 preparation.ref.contentHash=recordHash(prep);
 s.preparationRef=preparation.ref;s.options.preparationRef=preparation.ref;
 if(mode==='OPTIONS')s.options.utf8Bytes++;
 const observation=s.sourceObservations.find((v:any)=>v.kind==='PREPARATION');observation.ref=preparation.ref;observation.observationHash=preparation.ref.contentHash;
 origin.ref.contentHash=recordHash(s);
 origin.reservation.snapshot.originRef=origin.ref;origin.reservation.ref.contentHash=recordHash(origin.reservation.snapshot);
 if(mode==='VERSION')preparation.ref={...preparation.ref,version:2};
 return {transport:'NORMAL_PROTECTED',scope,items:rows,currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false};
}

test('START 보호 상세의 WORK 준비는 당시 판단을 별도 검산하며 교차 역할·세션·options·버전을 차단한다',async()=>{
 for(const mode of ['WORK','LEGACY','SESSION','MISMATCH_ROLE','OPTIONS','VERSION','DENIED','NOT_FOUND','REVIEW_ROLE']){
  const q=await mountApp();
  try{
   await saveAppOrigin(q);
   const {readOrigin,readOriginHistory}=await import('../../../apps/web/src/features/session-detail/execution-start-origin-api.ts');
   const list=(await readOriginHistory(q.client,q.f.pid,q.f.confirmed.data.ref,null,()=>true)) as OriginPage;
   const origin=(await readOrigin(q.client,q.f.pid,list.items[0]!.ref,q.f.confirmed.data.ref,()=>true)) as OriginView;
   const preparation:PreparationOriginal={projectId:q.f.pid,...structuredClone(q.f.preparation.data),currentness:'NOT_RECHECKED'};
   delete (preparation as any).status;
   const history=fixedWorkProjection(origin,preparation,mode);
   list.items[0]!.ref=origin.ref;
   const preparationPath=`/api/v1/projects/${q.f.pid}/execution-preparations/${origin.snapshot.preparationRef.id}/versions/1`;
   const historyPath=`/api/v1/projects/${q.f.pid}/executions/${history.scope.executionId}/understanding-reviews?generation=4`;
   q.mode.getOverride=path=>{
    if(path.endsWith('/execution-start-origins'))return Response.json(list);
    if(path.includes('/execution-start-origins/'))return Response.json(origin);
    if(path===preparationPath)return mode==='DENIED'?Response.json({code:'PROJECT_OPERATION_DENIED'},{status:403}):mode==='NOT_FOUND'?Response.json({code:'NOT_FOUND'},{status:404}):Response.json(preparation);
    if(path===historyPath)return Response.json(history);
   };
   await q.click('보호 이력 조회');
   await q.wait(()=>q.container.textContent.includes(origin.ref.id+' 원문 조회'));
   await q.click(list.items[0]!.recordedAt+' · '+origin.ref.id+' 원문 조회');
   await q.wait(()=>hasPanel(q,originPanelLabel));
   let n=q.sent.length;
   assert(!hasPanel(q,linkedPreparationResult));
   await q.click(linkedPreparationLabel);
   if(mode==='WORK'||mode==='LEGACY'||mode==='REVIEW_ROLE'){
    await q.wait(()=>hasPanel(q,linkedPreparationResult));
    assert.match(q.container.textContent,/WORK · 연결된 준비 원문/);
   }else{
    await q.wait(()=>q.container.textContent.includes('보관된 준비 원문 확인 실패'));
    assert(!hasPanel(q,linkedPreparationResult));
   }
   assert.deepEqual(q.sent.slice(n).map(v=>[v.init.method,v.path]),[['GET',preparationPath]]);
   if(mode==='REVIEW_ROLE'){
    n=q.sent.length;
    await q.click('정착 이해 판단 원문 검산');
    await q.wait(()=>q.container.textContent.includes('UNDERSTANDING_HISTORY_RESPONSE_INVALID'));
    assert.doesNotMatch(q.container.textContent,/이 START 준비에 고정된 당시 판단|당시 근거 대조/);
    assert.deepEqual(q.sent.slice(n).map(v=>[v.init.method,v.path]),[['GET',historyPath]]);
   }else if(mode==='WORK'){
    n=q.sent.length;
    await q.click('정착 이해 판단 원문 검산');
    await q.wait(()=>q.container.textContent.includes('이 START 준비에 고정된 당시 판단'));
    for(const label of ['왜 이 일을 하는가','기준과 권한','결정과 이유','완료·현재 위치','실제 차이와 공백','다음 행동과 미확인','당시 근거 대조',history.items[0]!.snapshot.currentBinding.responsePartRefs[0].contentHash])assert(q.container.textContent.includes(label),label);
    assert.doesNotMatch(q.container.textContent,/더 새 판단으로 대체하면 안 됨/);
    assert.deepEqual(q.sent.slice(n).map(v=>[v.init.method,v.path]),[['GET',historyPath]]);
    for(const [close,status] of [['연결된 준비 원문 닫기',401],['보호 이력 조회',403]] as const){
     const override:typeof q.mode.getOverride=q.mode.getOverride;
     let release:(value:Response)=>void=()=>{},waiting=false;
     const held=new Promise<Response>(resolve=>{release=resolve;});
     q.mode.getOverride=path=>{if(path===historyPath){waiting=true;return held;}return override?.(path);};
     try{
      await q.click('정착 이해 판단 원문 검산');await q.wait(()=>waiting);
      const closeButton=q.nodes().find(v=>v.tagName==='BUTTON'&&v.textContent===close)!;
      await q.ui.React.act(async()=>{
       closeButton.dispatchEvent({type:'click',button:0,bubbles:true});
       release(Response.json({code:status===401?'AUTH_REQUIRED':'PROJECT_OPERATION_DENIED'},{status}));
      });
      await q.flush();
      assert.doesNotMatch(q.container.textContent,/이 START 준비에 고정된 당시 판단|AUTH_REQUIRED|PROJECT_OPERATION_DENIED/);
      assert.match(q.container.textContent,/확정 receipt 보존/);
     }finally{release(Response.json(history));q.mode.getOverride=override;}
     if(close==='보호 이력 조회'){
      await q.wait(()=>q.container.textContent.includes(origin.ref.id+' 원문 조회'));
      await q.click(list.items[0]!.recordedAt+' · '+origin.ref.id+' 원문 조회');
      await q.wait(()=>hasPanel(q,originPanelLabel));
     }
     await q.click(linkedPreparationLabel);
     await q.wait(()=>hasPanel(q,linkedPreparationResult));
    }
   }else assert.doesNotMatch(q.container.textContent,/정착 이해 판단 원문 검산/);
   assert(hasPanel(q,originPanelLabel));assert.match(q.container.textContent,/확정 receipt 보존/);
   assert.equal(originPosts(q).length,1);
  }finally{await q.close();}
 }
});

test('START에서 늦은 준비 GET은 닫기·페이지 전환 및 사용자/client/transport 교체 후 결과나 권한 오류를 반영하지 않는다',async()=>{
 for(const mode of ['CLOSE','PAGE','USER','CLIENT','TRANSPORT','CURRENT_401']){
  const q=await mountApp();
  let release:(value:Response)=>void=()=>{};
  try{
   await saveAppOrigin(q);
   const row=q.f.tables.origins![0]!,assignment={projectId:q.f.pid,...q.f.confirmed.data},transport=q.client.transport,client=new q.ui.ApiClient(transport);
   let session=q.session;
   const unavailable:string[]=[];
   const storage={buffers:{},onChange:()=>assert.fail('읽기 중 상태 쓰기')};
   const render=()=>q.ui.React.act(async()=>q.root.render(q.ui.React.createElement(q.ui.ExecutionStartOriginPanel,{client,assignment,session,storage,onUnavailable:(code:string)=>unavailable.push(code)})));
   await render();
   await q.click('보호 이력 조회');
   await q.wait(()=>q.container.textContent.includes(row.origin_id+' 원문 조회'));
   await q.click(row.recorded_at.toISOString()+' · '+row.origin_id+' 원문 조회');
   await q.wait(()=>hasPanel(q,originPanelLabel));
   const prepPath=`/api/v1/projects/${q.f.pid}/execution-preparations/${q.f.preparation.data.ref.id}/versions/1`;
   let waiting=false;
   const held=new Promise<Response>(resolve=>{release=resolve;});
   q.mode.getOverride=path=>{if(path===prepPath){waiting=true;return held;}};
   await q.click(linkedPreparationLabel);await q.wait(()=>waiting);
   if(mode==='CLOSE')await q.click('START 원자료 보호 원문 닫기');
   else if(mode==='PAGE'){await q.click('보호 이력 조회');await q.wait(()=>q.container.textContent.includes(row.origin_id+' 원문 조회'));}
   else if(mode!=='CURRENT_401'){
    if(mode==='USER')session={...q.session,user:{id:exampleRef(30).id}};
    if(mode==='CLIENT')session={...q.session,clientId:exampleRef(31).id};
    if(mode==='TRANSPORT')client.transport=async()=>assert.fail('교체 transport 요청');
    await render();
    session=q.session;client.transport=transport;
    await render();
   }
   const n=q.sent.length;
   await q.ui.React.act(async()=>release(Response.json({code:'AUTH_REQUIRED'},{status:401})));
   await q.flush();
   assert.equal(q.sent.length,n);
   assert.equal(originPosts(q).length,1);
   assert.deepEqual(unavailable,mode==='CURRENT_401'?['AUTH_REQUIRED']:[]);
   assert(!hasPanel(q,linkedPreparationResult));
   if(mode==='CURRENT_401')assert.match(q.container.textContent,/AUTH_REQUIRED/);
   else assert.doesNotMatch(q.container.textContent,/AUTH_REQUIRED/);
  }finally{release(Response.json({code:'AUTH_REQUIRED'},{status:401}));await q.close();}
 }
});

test('실제 App은 POST 응답 HOLD 중 이탈·복귀의 늦은 성공을 새 본문으로 표시하지 않고 원 packet UNKNOWN을 보존한다',async()=>{const q=await mountApp();let release!:()=>void;const held=new Promise<void>(yes=>release=yes);try{await prepareInApp(q);q.mode.afterPost=()=>held;await q.click('원자료 명시 저장');await q.wait(()=>q.f.tables.origins!.length===1);const original=structuredClone(originPosts(q)[0]!.body);await q.navigate(`#/projects/${q.f.pid}`);await q.navigate(detailHash(q));await q.wait(()=>q.container.textContent.includes('상태 SENDING'));assert(!q.nodes().some(n=>n.getAttribute('aria-label')==='START 원자료 보호 원문'));release();await q.wait(()=>q.container.textContent.includes('상태 UNKNOWN'));assert(q.container.textContent.includes(original.commandId));assert(!q.nodes().some(n=>n.getAttribute('aria-label')==='START 원자료 보호 원문'));assert(!q.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='원자료 명시 저장'));assert.equal(originPosts(q).length,1);assert.deepEqual(originPosts(q)[0]!.body,original);assert.equal(q.f.tables.origins!.length,1);assert.deepEqual(q.f.state.unsupported,[]);}finally{release();await q.close();}assert.equal(q.f.active(),false);});

test('실제 App은 응답 유실 UNKNOWN을 이탈·복귀 뒤 같은 명령으로 보존하고 자동 POST를 보내지 않는다',async()=>{const q=await mountApp();try{await prepareInApp(q);q.mode.lost=true;await q.click('원자료 명시 저장');await q.wait(()=>q.container.textContent.includes('상태 UNKNOWN'));const original=structuredClone(originPosts(q)[0]!.body);await q.navigate(`#/projects/${q.f.pid}`);await q.navigate(detailHash(q));await q.wait(()=>q.container.textContent.includes('상태 UNKNOWN'));assert(q.container.textContent.includes(original.commandId));assert(!q.nodes().some(n=>n.getAttribute('aria-label')==='START 원자료 보호 원문'));assert(!q.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='원자료 명시 저장'));assert.equal(originPosts(q).length,1);assert.deepEqual(originPosts(q)[0]!.body,original);assert.deepEqual(q.f.state.unsupported,[]);}finally{await q.close();}assert.equal(q.f.active(),false);});
test('실제 App은 확정 receipt 뒤 보호 GET 거절에도 원 receipt를 보존하고 복귀 후 원 ref GET만 재조회한다',async()=>{const q=await mountApp();try{await prepareInApp(q);q.mode.getDenied=true;await q.click('원자료 명시 저장');await q.wait(()=>q.container.textContent.includes('PROJECT_OPERATION_DENIED'));const original=structuredClone(originPosts(q)[0]!.body);assert(!q.nodes().some(n=>n.getAttribute('aria-label')==='START 원자료 보호 원문'));await q.navigate(`#/projects/${q.f.pid}`);await q.navigate(detailHash(q));await q.wait(()=>q.container.textContent.includes('상태 SAVED'));assert(q.container.textContent.includes(original.commandId));assert(q.container.textContent.includes('확정 receipt 보존'));assert(!q.nodes().some(n=>n.getAttribute('aria-label')==='START 원자료 보호 원문'));q.mode.getDenied=false;await q.click('저장 원문 다시 조회');await q.wait(()=>q.nodes().some(n=>n.getAttribute('aria-label')==='START 원자료 보호 원문'));assert(q.container.textContent.includes('원 packet 이탈 검산'));assert.equal(originPosts(q).length,1);assert.deepEqual(originPosts(q)[0]!.body,original);assert.deepEqual(q.f.state.unsupported,[]);}finally{await q.close();}assert.equal(q.f.active(),false);});
test('실제 Panel은 주체·포트 교체와 원 문맥 복귀 뒤 늦은 응답을 본문에 귀속하지 않는다',async()=>{for(const mode of ['ACTOR','TRANSPORT']){const q=await mountApp();let release!:()=>void;const held=new Promise<void>(yes=>release=yes);try{await q.wait(()=>q.nodes().some(n=>n.getAttribute('aria-label')==='START 원자료 저장'));const baseSession={...q.session,csrfToken:createHmac('sha256',Buffer.alloc(32,7)).update('csrf:'+q.f.token).digest('base64url')},assignment={projectId:q.f.pid,...q.f.confirmed.data},transport=q.client.transport;let currentSession=baseSession;function Host(){const[state,setState]=q.ui.React.useState({}),live=q.ui.React.useRef(state);return q.ui.React.createElement(q.ui.ExecutionStartOriginPanel,{client:q.client,assignment,session:currentSession,storage:{buffers:state,onChange:(key:string,change:Function)=>{const prior=live.current[key]??null,next=change(prior);if(prior===next)return false;live.current={...live.current,[key]:next};setState(live.current);return true;}},onUnavailable:(code:string)=>{throw Error(code);}});}const render=()=>q.ui.React.act(async()=>q.root.render(q.ui.React.createElement(Host)));await render();await prepareInApp(q);q.mode.afterPost=()=>held;await q.click('원자료 명시 저장');await q.wait(()=>q.f.tables.origins!.length===1);const original=structuredClone(originPosts(q)[0]!.body);if(mode==='ACTOR')currentSession={...baseSession,user:{id:'00000000-0000-4000-8000-000000000999'}};else q.client.transport=async(...args:any[])=>Reflect.apply(transport,globalThis,args);await render();assert(!q.nodes().some(n=>n.getAttribute('aria-label')==='START 원자료 보호 원문'));currentSession=baseSession;q.client.transport=transport;await render();release();await q.wait(()=>q.container.textContent.includes('상태 UNKNOWN'));assert(q.container.textContent.includes(original.commandId));assert(!q.nodes().some(n=>n.getAttribute('aria-label')==='START 원자료 보호 원문'));assert(!q.container.textContent.includes('확정 receipt 보존'));assert.equal(originPosts(q).length,1);assert.deepEqual(originPosts(q)[0]!.body,original);assert.deepEqual(q.f.state.unsupported,[]);}finally{release();await q.close();}assert.equal(q.f.active(),false);}});

async function selectOriginSources(q:Awaited<ReturnType<typeof mountApp>>){
 await q.wait(()=>q.nodes().some(n=>n.getAttribute('aria-label')==='START 원자료 저장'));
 await q.click('원자료 선택 목록 조회');
 await q.wait(()=>q.nodes().some(n=>n.getAttribute('aria-label')==='대기 요청'));
 await q.change('대기 요청',q.f.stage.data.ref.id);
 await q.change('등록 준비',q.f.preparation.data.ref.id);
 await q.change('책임 예약',q.f.binding.data.ref.id);
 await q.change('기록 이유','대기 원자료의 최신 대조');
}

test('등록 준비는 원 대기 항목을 다시 읽고 취소·변경·중복을 로컬에서 거절한다',async()=>{
 const q=await mountApp();try{
  const pid=q.f.pid,path=`/api/v1/projects/${pid}/queue`;
  const waiting={requestRef:q.f.stage.data.ref,state:'WAITING',sequence:q.f.stage.data.snapshot.sequence,reasonCodes:q.f.stage.data.snapshot.readinessIssues,blockedBy:[],reservedBudgetRef:null};
  const variant=[
   {items:[],code:'STAGE_START_QUEUE_NOT_FOUND'},
   {items:[{...waiting,requestRef:{...waiting.requestRef,contentHash:'d'.repeat(64)}}],code:'STAGE_START_QUEUE_NOT_FOUND'},
   {items:[{...waiting,sequence:waiting.sequence+1}],code:'STAGE_START_QUEUE_NOT_FOUND'},
   {items:[waiting,waiting],code:'STAGE_QUEUE_RESPONSE_INVALID'},
   {items:[{...waiting,state:'CANCELLED'}],code:'STAGE_QUEUE_RESPONSE_INVALID'},
  ];
  for(const {items,code} of variant){
   q.mode.getOverride=null;
   await selectOriginSources(q);
   q.mode.getOverride=url=>url===path?Response.json({projectId:pid,items,selection:'WAITING_ONLY',cancelledHistoryOmitted:true,observedAt:q.f.stage.data.snapshot.queuedAt,writerReservationPerformed:false,executionAuthorized:false,dispatchPerformed:false}):undefined;
   const begin=q.sent.length;
   await q.click('등록 준비 고정');
   await q.wait(()=>q.container.textContent.includes(code)||q.container.textContent.includes('상태 PREPARED'));
   assert(q.container.textContent.includes(code),code+'를 준비 단계에서 표시해야 합니다.');
   assert(!q.container.textContent.includes('상태 PREPARED'));
   const calls=q.sent.slice(begin).map(v=>v.path);
   assert(calls[0]?.includes('/execution-preparations/'));
   assert(calls[1]?.includes('/role-bindings/'));
   assert.deepEqual(calls.slice(2),[`/api/v1/projects/${pid}`,path]);
   assert.equal(q.sent.filter(v=>v.init.method==='POST').length,0);
  }
  q.mode.getOverride=null;
  await selectOriginSources(q);
  const before=q.sent.length;
  await q.click('등록 준비 고정');
  await q.wait(()=>q.container.textContent.includes('상태 PREPARED'));
  assert.equal(q.sent.slice(before).filter(v=>v.path===path).length,1);
  assert.equal(q.sent.filter(v=>v.init.method==='POST').length,0);
 }finally{await q.close();}
});

test('기존 제어 조회가 대기 중 취소된 요청은 제어 응답 뒤 다시 원장에서 확인한다',async()=>{
 const q=await mountApp();let release!:(response:Response)=>void;const held=new Promise<Response>(resolve=>{release=resolve;});
 try{
  await selectOriginSources(q);
  const project=`/api/v1/projects/${q.f.pid}`,queue=project+'/queue';
  let cancels=false;
  q.mode.getOverride=url=>{
   if(url===project)return held;
   if(url===queue&&cancels)return Response.json({projectId:q.f.pid,items:[],selection:'WAITING_ONLY',cancelledHistoryOmitted:true,observedAt:q.f.stage.data.snapshot.queuedAt,writerReservationPerformed:false,executionAuthorized:false,dispatchPerformed:false});
  };
  const begin=q.sent.length;
  await q.click('등록 준비 고정');
  await q.wait(()=>q.sent.slice(begin).some(v=>v.path===project));
  assert(!q.sent.slice(begin).some(v=>v.path===queue),'제어 조회를 마친 뒤 원장을 한 번 읽습니다.');
  cancels=true;
  release(Response.json({id:q.f.pid,participation:'OWNER',controlState:{status:'HELD',actorId:q.f.uid,clientId:q.f.cid,generation:1}}));
  await q.wait(()=>q.container.textContent.includes('STAGE_START_QUEUE_NOT_FOUND'));
  assert.equal(q.sent.slice(begin).filter(v=>v.path===queue).length,1);
  assert(!q.container.textContent.includes('상태 PREPARED'));
  assert.equal(q.sent.filter(v=>v.init.method==='POST').length,0);
 }finally{release(Response.json({}));await q.close();}
});

for(const loss of ['CURRENT','TRANSPORT','CLOSE','ROLE_TRANSPORT'] as const)test('원자료 준비 조회의 401은 '+loss+' 소유 범위에서만 전달한다',async()=>{
 const q=await mountApp();let release!:(response:Response)=>void;const held=new Promise<Response>(resolve=>{release=resolve;});
 const unavailable:string[]=[];
 const session={...q.session,csrfToken:createHmac('sha256',Buffer.alloc(32,7)).update('csrf:'+q.f.token).digest('base64url')};
 const assignment={projectId:q.f.pid,...q.f.confirmed.data},path=`/api/v1/projects/${q.f.pid}/queue`,transport=q.client.transport,client=new q.ui.ApiClient(transport);
 let visible=true;const packets:unknown[]=[];
 function Host(){return visible?q.ui.React.createElement(q.ui.ExecutionStartOriginPanel,{client,session,assignment,storage:{buffers:{},onChange:(_k:string,action:(previous:null)=>unknown)=>{packets.push(action(null));return true;}},onUnavailable:(code:string)=>unavailable.push(code)}):null;}
 const render=()=>q.ui.React.act(async()=>q.root.render(q.ui.React.createElement(Host)));
 try{
  await render();await selectOriginSources(q);
  const protectedPath=loss==='ROLE_TRANSPORT'?`/api/v1/projects/${q.f.pid}/role-bindings/${q.f.binding.data.ref.id}/versions/${q.f.binding.data.ref.version}`:path;
  q.mode.getOverride=url=>url===protectedPath?held:undefined;
  const begin=q.sent.length;
  await q.click('등록 준비 고정');
  await q.wait(()=>q.sent.slice(begin).some(x=>x.path===protectedPath));
  if(loss==='TRANSPORT'||loss==='ROLE_TRANSPORT'){
   client.transport=(...args:Parameters<typeof transport>)=>transport(...args);
   await render();
  }
  if(loss==='CLOSE'){visible=false;await render();}
  await q.ui.React.act(async()=>release(Response.json({code:'AUTH_REQUIRED'},{status:401})));
  if(loss==='CURRENT')await q.wait(()=>!q.container.textContent.includes('원 보호 자료 확인 중'));
  else for(let i=0;i<6;i++)await q.flush();
  assert.deepEqual(unavailable,loss==='CURRENT'?['AUTH_REQUIRED']:[],q.container.textContent);
  assert.equal(packets.length,0);assert.equal(q.sent.filter(v=>v.init.method==='POST').length,0);
  if(loss==='ROLE_TRANSPORT')assert.equal(q.sent.slice(begin).filter(v=>v.path===path).length,0);
  if(loss==='TRANSPORT'){
   q.mode.getOverride=null;
   await selectOriginSources(q);
   await q.click('등록 준비 고정');
   await q.wait(()=>packets.length===1);
   const saved=packets.at(0);assert(saved&&typeof saved==='object'&&'phase' in saved);assert.equal(saved.phase,'PREPARED');
  }
 }finally{release(Response.json({}));await q.close();}
});

test('UI04 영수증 경로도 원장을 다시 대조하며 지연한 이전 저장 반영을 막는다',async()=>{
 const q=await mountApp();
 const session={...q.session,csrfToken:createHmac('sha256',Buffer.alloc(32,7)).update('csrf:'+q.f.token).digest('base64url')};
 const assignment={projectId:q.f.pid,...q.f.confirmed.data},receipt=q.f.stage.data,path=`/api/v1/projects/${q.f.pid}/queue`;
 const transport=q.client.transport,client=new q.ui.ApiClient(transport),updates:((previous:null)=>unknown)[]=[];
 function Host(){return q.ui.React.createElement(q.ui.ExecutionStartOriginPanel,{client,session,assignment,waitingHint:receipt,storage:{buffers:{},onChange:(_k:string,action:(previous:null)=>unknown)=>{updates.push(action);return true;}},onUnavailable:(code:string)=>assert.fail(code)});}
 const render=()=>q.ui.React.act(async()=>q.root.render(q.ui.React.createElement(Host)));
 try{
  await render();
  const before=q.sent.length;
  await q.click('이 영수증의 대기 요청 원장에서 확인·선택');
  await q.wait(()=>q.nodes().some(v=>v.getAttribute('aria-label')==='대기 요청'));
  await q.change('등록 준비',q.f.preparation.data.ref.id);
  await q.change('책임 예약',q.f.binding.data.ref.id);
  await q.change('기록 이유','검산한 UI04 원 영수증');
  await q.click('등록 준비 고정');await q.wait(()=>updates.length===1);
  assert.equal(q.sent.slice(before).filter(v=>v.path===path).length,2);
  client.transport=(...args:Parameters<typeof transport>)=>transport(...args);
  assert.equal(updates[0]!(null),null);
  assert(!q.container.textContent.includes('상태 PREPARED'));
  assert.equal(q.sent.filter(v=>v.init.method==='POST').length,0);
 }finally{await q.close();}
});
