import test,{before,after} from 'node:test';import {build} from 'vite';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
import {ControlApi} from '../../../apps/web/src/features/control-handoff/api.ts';
import {controlHash,createControlAcceptanceChain} from '../../../apps/server/modules/control-handoff/control-grant.ts';
import {HandoffBudget,createControlHandoffEvidenceSource} from '../../../apps/server/modules/control-handoff/control-handoff-evidence-source.ts';
import {issueProtectedHandoffSummary} from '../../../apps/server/modules/control-handoff/control-handoff-protected-summary.ts';
import {requestBundle,projectId,baseControl,now,controller,controllerClient,requester,requesterClient} from '../FN15/control-handoff-summary-fixture.ts';
const id=(n:number)=>'88888888-8888-4888-8888-'+String(n).padStart(12,'0');
const request=requestBundle().request,session={user:{id:controller,displayName:'사용자'},clientId:controllerClient,csrfToken:'c'.repeat(43)};
function api(value:unknown,seen:string[]=[],target=false){return new ControlApi(async(path)=>{seen.push(String(path));return new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});},target?{...session,user:{...session.user,id:requester},clientId:requesterClient}:session,projectId);}
async function protectedSummary(managedAbsence=false){
 const scope={projectId,requestRef:request.requestRef,baseControl,sessionId:id(1),actorId:controller,clientId:controllerClient},lease=new HandoffBudget(30000,{now:()=>Date.parse(now),monotonic:()=>0});
 const db={query:async()=>({rows:[{packet:{projectId,requestRef:request.requestRef,baseControl,writer:{head:null,events:[],commands:[],receipts:[],audits:[],approvals:[]},executions:[],pendingCommands:[],pendingApprovals:[],checkpoints:[],proofBasis:null}}]})};
 if(managedAbsence){
  const tables=["executions","execution_grants","usage_reservations","writer_claims","execution_commands","delivery_outbox","execution_credentials","execution_challenges","execution_receipts","execution_observations","execution_acknowledgements","execution_observation_results","execution_start_permits","execution_instruction_permits","execution_grant_revocations","project_writer_authority_events","project_writer_authority_heads","execution_ownership_events","execution_ownership_observations","execution_ownership_anchors","execution_ownership_bindings","execution_ownership_heads","native_preparation_authorities","native_preparation_authority_events","execution_preparations","execution_preparation_approval_candidates","understanding_reviews","stage_runs","queue_requests","project_storage_reservations","context_bundles","context_items","assignment_versions","source_roots","source_root_versions","project_source_declarations","project_roles","agent_sessions","role_bindings","execution_material_manifests","execution_materials","execution_material_proof_bindings"];
  const query=db.query.bind(db);db.query=async()=>{const result=await query(),packet=result.rows[0]!.packet,birth={intentId:id(30),draftId:id(31),draftVersion:1,commandRef:{id:id(32),version:1,contentHash:'b'.repeat(64)},requestHash:'b'.repeat(64),receiptId:id(33),scopeDigest:'c'.repeat(64),auditEventId:id(34),auditScopeDigest:'c'.repeat(64),initialControl:{actorId:controller,clientId:controllerClient,generation:1,version:1},anchorHash:'d'.repeat(64)},snapshot={schemaVersion:1,purpose:'FN15_CLOSED_MANAGED_ABSENCE',projectId,requestRef:request.requestRef,baseControl,subject:{actorId:controller,clientId:controllerClient,sessionId:id(1)},birth,sources:tables.map(table=>({table,rows:[]})),guardHash:'c210cba4f937b35290c98e4dfbbc5d46c383f1ed2c704e65400cc15e38c577c4',observedAt:now,expiresAt:request.snapshot.expiresAt};return{rows:[{packet:{...packet,emptyClosure:{snapshot,contentHash:controlHash(snapshot)}}}]};};
 }
 const evidence=await createControlHandoffEvidenceSource().collect(db as never,scope,lease),summary=issueProtectedHandoffSummary({scope,request:request.snapshot,version:1,observedAt:now,evidence},db,lease);await lease.close();return summary;
}
test('실제 보호요약 생산결과의 UNKNOWN을 브라우저 고정 route/hash/문맥으로 읽으며 v1과 분리한다',async()=>{
 const summary=await protectedSummary(),seen:string[]=[],command={schemaVersion:1 as const,operation:'prepareControlHandoff' as const,commandId:id(2),projectId,clientId:controllerClient,payload:{requestRef:request.requestRef}};
 assert.deepEqual(await api(summary,seen).prepareProtected(command),summary);assert.match(seen[0]!,/\/protected-handoff-summaries$/);assert.equal(summary.snapshot.transferState,'UNKNOWN');
 assert.deepEqual(await api(summary,seen).protectedSummary(request.requestRef,summary.ref),summary);assert.match(seen[1]!,/summaryHash=/);
 for(const value of [{...summary,snapshot:{...summary.snapshot,transferState:'READY'}},{...summary,ref:{...summary.ref,contentHash:'a'.repeat(64)}},{...summary,snapshot:{...summary.snapshot,projectId:id(8)}}])await assert.rejects(()=>api(value).prepareProtected(command));
});
test('UNKNOWN 요약의 새 수락은 POST0이며 원결과 GET은 역사와 현재 권위를 분리한다',async()=>{
 const command={schemaVersion:1 as const,operation:'acceptControl' as const,commandId:id(3),projectId,clientId:requesterClient,payload:{requestRef:request.requestRef,summaryVersion:1,reason:'명시 수락'}},summary=await protectedSummary();
 const chain=createControlAcceptanceChain({projectId,command,requestRef:request.requestRef,summaryRef:summary.ref,before:baseControl,targetActorId:requester,recordedAt:now,ids:{acceptance:id(4),revocation:id(5),grant:id(6),receipt:id(7),audit:id(8)}}),seen:string[]=[];
 await assert.rejects(()=>api(chain.result,seen,true).accept(command,summary));assert.equal(seen.length,0);
 assert.deepEqual(await api(chain.result,seen,true).acceptanceResult(command,summary),chain.result);assert.ok(seen[0]!.startsWith('/api/v1/projects/'+projectId+'/control-requests/'+request.requestRef.id+'/versions/1/acceptances/'+command.commandId+'?commandHash='));
 for(const value of [{...chain.result,commandId:id(9)},{...chain.result,nextControl:{...chain.result.nextControl,generation:baseControl.generation}},{...chain.result,nextControl:{...chain.result.nextControl,actorId:id(9)}},{...chain.result,grantRef:{...chain.result.grantRef,version:2}},{...chain.result,executionAuthorized:true}])await assert.rejects(()=>api(value,[],true).acceptanceResult(command,summary));
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
const saved=new Map<string,PropertyDescriptor|undefined>();let ui:any;
const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}

before(async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/control-handoff/ControlAccessPage.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:control-acceptance',name:'ControlAcceptanceMemoryTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'rework-memory-entry',resolveId(id){if(id.endsWith('virtual:control-acceptance'))return '\0control-acceptance';},load(id){if(id==='\0control-acceptance')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{ControlAccessPage}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};export{React,createRoot,ControlAccessPage,ApiClient};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return ControlAcceptanceMemoryTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});


test('실제 target 화면은 고정 보호 head→원문을 명시 조회하며 UNKNOWN에서 수락하지 않는다',async()=>{
 const summary=await protectedSummary(),calls:string[]=[],container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 const target={...session,user:{id:requester,displayName:'수락 대상'},clientId:requesterClient},original={bindingId:id(71),ownerUserId:requester,ownerClientId:requesterClient,projectId,reason:'원 입력 보존',expiresAt:'',pending:null};let changes=0;
 const fixed={projectId,requestRef:request.requestRef,snapshot:request.snapshot,observedAt:now,current:{expired:false,baseControlState:'MATCHED'},executionAuthorized:false,controlTransferred:false};
 const client=new ui.ApiClient(async(path:string)=>{calls.push(path);const url=new URL(path,'https://test.invalid');let value:unknown;
  if(url.pathname.endsWith('/control-state'))value={schemaVersion:1,projectId,observedAt:now,actorId:requester,clientId:requesterClient,participation:'HANDOFF_ELIGIBLE',control:{state:'OTHER_CLIENT',basis:baseControl},executionAuthorized:false,controlTransferred:false};
  else if(url.pathname.endsWith('/control-requests'))value={projectId,view:'OWN',limit:50,observedAt:now,items:[{requestRef:request.requestRef,createdAt:request.snapshot.createdAt,expiresAt:request.snapshot.expiresAt,storedState:'PENDING',current:fixed.current,executionAuthorized:false,controlTransferred:false}],hasMore:false,nextCursor:null,executionAuthorized:false,controlTransferred:false};
  else if(url.pathname.endsWith('/protected-handoff-summaries/head'))value={schemaVersion:2,purpose:'CONTROL_HANDOFF_PROTECTED_HEAD',projectId,requestRef:request.requestRef,observedAt:now,head:{state:'AVAILABLE',summaryRef:summary.ref},executionAuthorized:false,dispatchPerformed:false,controlTransferred:false};
  else if(url.pathname.endsWith('/protected-handoff-summaries/1'))value=summary;
  else if(url.pathname.endsWith('/versions/1'))value=fixed;else throw Error('예상 밖 IO '+path);
  return Response.json(value);
 });
 const props={client,projectId,session:target,buffer:original,onChange:()=>{changes++;return false;},onAuthenticationLost:()=>{throw Error('인증상실 없음');}};
 const all=(n:MemoryNode):MemoryNode[]=>[n,...n.childNodes.flatMap(all)];
 const click=async(label:string)=>{const node=all(container).find(n=>n.tagName==='BUTTON'&&n.textContent===label);assert.ok(node,label);assert.equal(node.disabled,false,label);await ui.React.act(async()=>{node.dispatchEvent({type:'click',button:0});});};
 const wait=async(text:string)=>{for(let i=0;i<40;i++){if(container.textContent.includes(text))return;await ui.React.act(async()=>{await new Promise<void>(r=>setImmediate(r));});}assert.fail('표시 정착 누락 '+text);};
 try{await ui.React.act(async()=>root.render(ui.React.createElement(ui.ControlAccessPage,props)));assert.equal(calls.length,0);
  await click('현재 제어 조회');await wait('OTHER_CLIENT');await click('내 요청 목록 조회');await wait('요청 1 원문 확인');await click('요청 1 원문 확인');await wait(request.snapshot.reason);
  await click('최신 보호요약 고정 원문 조회');await wait('보호 검산 UNKNOWN');assert.ok(calls.some(x=>x.includes('/protected-handoff-summaries/head?requestHash=')));assert.ok(calls.some(x=>x.includes('/protected-handoff-summaries/1?requestHash=')));assert.equal(changes,0);assert.equal(props.buffer,original);assert.ok(all(container).some(n=>n.tagName==='BUTTON'&&n.textContent.includes('인수 수락')&&n.disabled));
 }finally{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}
});


test('실제 target 수락 화면은 READY를 확인해 원 명령을 먼저 보존하고 응답 유실 뒤 원 GET만 사용한다',async()=>{
 const summary=await protectedSummary(true);assert.equal(summary.snapshot.transferState,'READY');const savedNow=Date.now;Date.now=()=>Date.parse(now);
 const calls:{path:string;method:string}[]=[],target={...session,user:{id:requester,displayName:'수락 대상'},clientId:requesterClient},container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);let buffer:any={bindingId:id(80),ownerUserId:requester,ownerClientId:requesterClient,projectId,reason:'수락 원문 보존',expiresAt:'',pending:null},chain:ReturnType<typeof createControlAcceptanceChain>|null=null;
 const fixed={projectId,requestRef:request.requestRef,snapshot:request.snapshot,observedAt:now,current:{expired:false,baseControlState:'MATCHED'},executionAuthorized:false,controlTransferred:false};
 const client=new ui.ApiClient(async(path:string,init?:RequestInit)=>{const method=init?.method??'GET';calls.push({path,method});const url=new URL(path,'https://test.invalid');let value:unknown;
  if(method==='POST'&&url.pathname.endsWith('/acceptances')){const command=JSON.parse(String(init!.body));assert.equal(buffer.pending.status,'UNKNOWN');assert.deepEqual(buffer.pending.command,command);chain=createControlAcceptanceChain({projectId,command,requestRef:request.requestRef,summaryRef:summary.ref,before:baseControl,targetActorId:requester,recordedAt:now,ids:{acceptance:id(81),revocation:id(82),grant:id(83),receipt:id(84),audit:id(85)}});throw Error('COMMIT_REPLY_LOST');}
  if(url.pathname.includes('/acceptances/')){assert.ok(chain);value=chain.result;}
  else if(url.pathname.endsWith('/control-state'))value={schemaVersion:1,projectId,observedAt:now,actorId:requester,clientId:requesterClient,participation:'HANDOFF_ELIGIBLE',control:chain?{state:'HELD',basis:chain.result.nextControl}:{state:'OTHER_CLIENT',basis:baseControl},executionAuthorized:false,controlTransferred:false};
  else if(url.pathname.endsWith('/control-requests'))value={projectId,view:'OWN',limit:50,observedAt:now,items:[{requestRef:request.requestRef,createdAt:request.snapshot.createdAt,expiresAt:request.snapshot.expiresAt,storedState:'PENDING',current:fixed.current,executionAuthorized:false,controlTransferred:false}],hasMore:false,nextCursor:null,executionAuthorized:false,controlTransferred:false};
  else if(url.pathname.endsWith('/protected-handoff-summaries/head'))value={schemaVersion:2,purpose:'CONTROL_HANDOFF_PROTECTED_HEAD',projectId,requestRef:request.requestRef,observedAt:now,head:{state:'AVAILABLE',summaryRef:summary.ref},executionAuthorized:false,dispatchPerformed:false,controlTransferred:false};
  else if(url.pathname.endsWith('/protected-handoff-summaries/1'))value=summary;
  else if(url.pathname.endsWith('/versions/1'))value=fixed;else throw Error('예상 밖 IO '+path);
  return Response.json(value);
 });
 const render=()=>root.render(ui.React.createElement(ui.ControlAccessPage,{client,projectId,session:target,buffer,onChange:(expected:string|null,next:any)=>{if(buffer.bindingId!==expected)return false;buffer=next;render();return true;},onAuthenticationLost:()=>{throw Error('인증상실 없음');}}));
 const all=(n:MemoryNode):MemoryNode[]=>[n,...n.childNodes.flatMap(all)];const button=(label:string)=>all(container).find(n=>n.tagName==='BUTTON'&&n.textContent===label);
 const click=async(label:string)=>{const n=button(label);assert.ok(n,label);assert.equal(n.disabled,false,label);await ui.React.act(async()=>n.dispatchEvent({type:'click',button:0}));};
 const wait=async(text:string)=>{for(let i=0;i<40;i++){if(container.textContent.includes(text))return;await ui.React.act(async()=>{await new Promise<void>(r=>setImmediate(r));});}assert.fail('표시 정착 누락 '+text);};
 try{await ui.React.act(async()=>render());assert.equal(calls.length,0);await click('현재 제어 조회');await wait('OTHER_CLIENT');await click('내 요청 목록 조회');await wait('요청 1 원문 확인');await click('요청 1 원문 확인');await wait(request.snapshot.reason);await click('최신 보호요약 고정 원문 조회');await wait('보호 검산 READY');
  assert.equal(button('인수 수락 명령 보존')?.disabled,true);const checkbox=all(container).find(n=>n.tagName==='INPUT'&&Object.keys(n).some(k=>k.startsWith('__reactProps')&&(n as unknown as Record<string,{type?:string}>)[k]?.type==='checkbox'));assert.ok(checkbox);const props=(checkbox as unknown as Record<string,unknown>)[Object.keys(checkbox).find(k=>k.startsWith('__reactProps'))!]as {onChange:(e:unknown)=>void};await ui.React.act(async()=>props.onChange({target:{checked:true}}));await click('인수 수락 명령 보존');assert.equal(buffer.pending.command.operation,'acceptControl');assert.equal(calls.some(x=>x.method==='POST'),false);
  await click('보존한 명령 전송');await wait('현재 제어를 다시 조회하세요.');assert.ok(chain);assert.equal(buffer.pending.status,'UNKNOWN');const original=structuredClone(buffer.pending.command);await click('현재 제어 조회');await wait('HELD');await click('같은 명령 결과 재확인');await wait('CONFIRMED');assert.deepEqual(buffer.pending.command,original);assert.equal(calls.filter(x=>x.method==='POST').length,1);assert.equal(calls.filter(x=>x.path.includes('/acceptances/')).length,1);assert.equal(container.textContent.includes('제어 전환 결과 확인'),true);
 }finally{Date.now=savedNow;await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}
});
