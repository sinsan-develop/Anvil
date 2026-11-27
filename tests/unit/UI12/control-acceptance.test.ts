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
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:control-acceptance',name:'ControlAcceptanceMemoryTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'rework-memory-entry',resolveId(id){if(id.endsWith('virtual:control-acceptance'))return '\0control-acceptance';},load(id){if(id==='\0control-acceptance')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{ControlAccessPage}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};import{mergeControlBuffer}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/control-handoff/state.ts',import.meta.url)))};export{React,createRoot,ControlAccessPage,ApiClient,mergeControlBuffer};`;}}]});
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


for(const followup of ['정상','즉시','지연'])test(followup!=='정상'?'확정 수락 후 현재 제어 조회 '+followup+' 실패는 수락 GET만으로 복구한다':'실제 target 수락 화면은 READY를 확인해 원 명령을 먼저 보존하고 응답 유실 뒤 원 GET만 사용한다',async()=>{
 const followupFails=followup!=='정상',releaseState=Promise.withResolvers<void>();
 const summary=await protectedSummary(true);assert.equal(summary.snapshot.transferState,'READY');const savedNow=Date.now;Date.now=()=>Date.parse(now);
 const calls:{path:string;method:string}[]=[],target={...session,user:{id:requester,displayName:'수락 대상'},clientId:requesterClient},container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);let buffer:any={bindingId:id(80),ownerUserId:requester,ownerClientId:requesterClient,projectId,reason:'수락 원문 보존',expiresAt:'',pending:null},chain:ReturnType<typeof createControlAcceptanceChain>|null=null;
 const fixed={projectId,requestRef:request.requestRef,snapshot:request.snapshot,observedAt:now,current:{expired:false,baseControlState:'MATCHED'},executionAuthorized:false,controlTransferred:false};
 const client=new ui.ApiClient(async(path:string,init?:RequestInit)=>{const method=init?.method??'GET';calls.push({path,method});const url=new URL(path,'https://test.invalid');let value:unknown;
  if(method==='POST'&&url.pathname.endsWith('/acceptances')){const command=JSON.parse(String(init!.body));assert.equal(buffer.pending.status,'UNKNOWN');assert.deepEqual(buffer.pending.command,command);chain=createControlAcceptanceChain({projectId,command,requestRef:request.requestRef,summaryRef:summary.ref,before:baseControl,targetActorId:requester,recordedAt:now,ids:{acceptance:id(81),revocation:id(82),grant:id(83),receipt:id(84),audit:id(85)}});throw Error('COMMIT_REPLY_LOST');}
  if(url.pathname.includes('/acceptances/')){assert.ok(chain);value=chain.result;}
  else if(followupFails&&buffer.pending?.status==='CONFIRMED'&&url.pathname.endsWith('/control-state')){
   if(followup==='지연')await releaseState.promise;
   return Response.json({code:'NOT_CONNECTED'},{status:503});
  }
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
 const wait=async(text:string)=>{const deadline=performance.now()+2000;while(performance.now()<deadline){if(container.textContent.includes(text))return;await ui.React.act(async()=>{await new Promise<void>(r=>setTimeout(r,2));});}assert.fail('표시 정착 누락 '+text);};
 try{await ui.React.act(async()=>render());assert.equal(calls.length,0);await click('현재 제어 조회');await wait('OTHER_CLIENT');await click('내 요청 목록 조회');await wait('요청 1 원문 확인');await click('요청 1 원문 확인');await wait(request.snapshot.reason);await click('최신 보호요약 고정 원문 조회');await wait('보호 검산 READY');
  assert.equal(button('인수 수락 명령 보존')?.disabled,true);const checkbox=all(container).find(n=>n.tagName==='INPUT'&&Object.keys(n).some(k=>k.startsWith('__reactProps')&&(n as unknown as Record<string,{type?:string}>)[k]?.type==='checkbox'));assert.ok(checkbox);const props=(checkbox as unknown as Record<string,unknown>)[Object.keys(checkbox).find(k=>k.startsWith('__reactProps'))!]as {onChange:(e:unknown)=>void};await ui.React.act(async()=>props.onChange({target:{checked:true}}));await click('인수 수락 명령 보존');assert.equal(buffer.pending.command.operation,'acceptControl');assert.equal(calls.some(x=>x.method==='POST'),false);
  await click('보존한 명령 전송');await wait('현재 제어를 다시 조회하세요.');assert.ok(chain);assert.equal(buffer.pending.status,'UNKNOWN');const original=structuredClone(buffer.pending.command);await click('현재 제어 조회');await wait('HELD');await click('같은 명령 결과 재확인');
  if(followup==='지연'){await wait('CONFIRMED');await ui.React.act(async()=>releaseState.resolve());}
  if(followupFails)await wait('현재 제어를 다시 조회하세요.');else await wait('CONFIRMED');
  assert.equal(buffer.pending.status,'CONFIRMED');assert.deepEqual(buffer.pending.command,original);assert.equal(calls.filter(x=>x.method==='POST').length,1);assert.equal(calls.filter(x=>x.path.includes('/acceptances/')).length,1);if(followupFails){
   await wait('현재 제어를 다시 조회하세요.');
   assert.equal(container.textContent.includes('제어 전환 결과 확인'),false);
   const before=calls.length,confirmed=buffer;
   await click('수락 결과 다시 조회');await wait('제어 전환 결과 확인');
   assert.deepEqual(calls.slice(before),[calls.find(c=>c.path.includes('/acceptances/'))!]);
   assert.equal(buffer,confirmed);assert.ok(container.textContent.includes('현재 제어는 아직 확인하지 않았습니다.'));
  }else assert.equal(container.textContent.includes('제어 전환 결과 확인'),true);
 }finally{Date.now=savedNow;await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}
});

test('보존된 확정 수락의 명시 조회는 오류·다른 원명령을 거절하고 종료·주체 교체 뒤 응답을 폐기한다',async()=>{
 const summary=await protectedSummary(true),command={schemaVersion:1 as const,operation:'acceptControl' as const,commandId:id(88),projectId,clientId:requesterClient,payload:{requestRef:request.requestRef,summaryVersion:1,reason:'기록 확인'}};
 const makeResult=(commandId:string)=>createControlAcceptanceChain({projectId,command:{...command,commandId},requestRef:request.requestRef,summaryRef:summary.ref,before:baseControl,targetActorId:requester,recordedAt:now,ids:{acceptance:id(90),revocation:id(91),grant:id(92),receipt:id(93),audit:id(94)}}).result;
 const result=makeResult(command.commandId),other=makeResult(id(89)),target={...session,user:{id:requester,displayName:'원 수락자'},clientId:requesterClient};
 const buffer={bindingId:id(95),ownerUserId:requester,ownerClientId:requesterClient,projectId,reason:command.payload.reason,expiresAt:'',pending:{bindingId:id(96),kind:'ACCEPT',status:'CONFIRMED',command,summary}},original=structuredClone(buffer);
 const responses:Array<ReturnType<typeof Promise.withResolvers<Response>>>=[],calls:string[]=[];
 const client=new ui.ApiClient((path:string,init:RequestInit)=>{
  assert.equal(init.method,'GET');assert.equal(path,'/api/v1/projects/'+projectId+'/control-requests/'+request.requestRef.id+'/versions/1/acceptances/'+command.commandId+'?commandHash='+controlHash(command));
  calls.push(path);const response=Promise.withResolvers<Response>();responses.push(response);return response.promise;
 });
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 let authLost=0,changes=0;
 const props={client,projectId,session:target,buffer,onChange:()=>{changes++;return false;},onAuthenticationLost:()=>{authLost++;}};
 const render=async(overrides:Record<string,unknown>={})=>ui.React.act(async()=>root.render(ui.React.createElement(ui.ControlAccessPage,{...props,...overrides})));
 const find=(node:MemoryNode,label:string):MemoryNode|undefined=>node.tagName==='BUTTON'&&node.textContent===label?node:node.childNodes.map(n=>find(n,label)).find(Boolean);
 const lookup='수락 결과 다시 조회',success='제어 전환 결과 확인';
 const click=async(label:string)=>{const n=find(container,label);assert.ok(n,label);assert.equal(n.disabled,false);await ui.React.act(async()=>n.dispatchEvent({type:'click',button:0}));};
 const begin=async()=>{const count=calls.length;await click(lookup);const end=performance.now()+2000;while(calls.length===count&&performance.now()<end)await new Promise<void>(r=>setTimeout(r,2));assert.equal(calls.length,count+1);return responses[count]!;};
 const reply=async(response:typeof responses[number],value:unknown,status=200)=>ui.React.act(async()=>{response.resolve(Response.json(value,{status}));await response.promise;});
 try{
  await render();assert.equal(calls.length,0);
  for(const overrides of [{projectId:id(97)},{session},{buffer:{...buffer,pending:{...buffer.pending,status:'UNKNOWN'}}},{buffer:{...buffer,pending:null}}]){
   await render(overrides);assert.equal(find(container,lookup),undefined);
  }
  await render();assert.equal(calls.length,0);
  await reply(await begin(),result);assert.ok(container.textContent.includes(success));
  const expand='수락 기록 상세 펼치기',collapse='수락 기록 상세 접기';
  const refs=[result.requestRef,result.summaryRef,result.acceptanceRef,result.grantRef,result.receiptRef,result.auditRef];
  assert.equal(find(container,expand)?.getAttribute('aria-expanded'),'false');
  for(const ref of refs)assert.equal(container.textContent.includes(ref.contentHash),false);
  const readCount=calls.length;
  await click(expand);assert.equal(find(container,collapse)?.getAttribute('aria-expanded'),'true');
  for(const ref of refs)assert.ok(container.textContent.includes(`${ref.id} · v${ref.version} · ${ref.contentHash}`));
  for(const [label,basis]of [['이전 제어 기준',result.previousControl],['수락 후 제어 기준',result.nextControl]]as const){
   assert.ok(container.textContent.includes(`${label}사용자 ${basis.actorId} · 기기 ${basis.clientId} · 세대 ${basis.generation} · 버전 ${basis.version}`));
  }
  assert.ok(container.textContent.includes('기록 당시 시각 '+result.recordedAt));
  assert.ok(container.textContent.includes('현재 제어와 일반 작업 허가는 서버가 별도로 검산합니다.'));
  await click(collapse);assert.equal(calls.length,readCount);
  for(const ref of refs)assert.equal(container.textContent.includes(ref.contentHash),false);
  await click(expand);assert.equal(calls.length,readCount);
  for(const status of [403,404,503,200,401]){
   const pending=await begin();assert.equal(container.textContent.includes(success),false);await reply(pending,other,status);
   assert.ok(container.textContent.includes('수락 결과를 확인할 수 없습니다.'));assert.equal(container.textContent.includes(success),false);assert.equal(find(container,expand),undefined);assert.equal(find(container,collapse),undefined);
  }
  assert.equal(authLost,1);
  for(const stale of ['닫기','다른 주체 ABA','명령 교체','재마운트']){
   const pending=await begin();assert.equal(find(container,lookup)?.disabled,true);
   if(stale==='닫기')await click('수락 결과 닫기');
   else if(stale==='다른 주체 ABA'){await render({session});await render();}
   else if(stale==='명령 교체'){await render({buffer:{...buffer,bindingId:id(98)}});await render();}
   else{await ui.React.act(async()=>root.render(null));await render();}
   await reply(pending,result,stale==='닫기'||stale==='명령 교체'?200:401);
   assert.equal(authLost,1);assert.equal(container.textContent.includes(success),false);assert.equal(container.textContent.includes('수락 결과를 확인할 수 없습니다.'),false);
  }
  await reply(await begin(),result);assert.ok(container.textContent.includes(success));assert.ok(container.textContent.includes('현재 제어는 아직 확인하지 않았습니다.'));
  assert.equal(find(container,expand)?.getAttribute('aria-expanded'),'false');
  for(const overrides of [{session:{...target,csrfToken:'d'.repeat(43)}},{client:new ui.ApiClient(client.transport)},{projectId:id(97)}]){
   await click(expand);const count:number=calls.length;
   await render(overrides);assert.equal(find(container,expand),undefined);assert.equal(find(container,collapse),undefined);
   for(const ref of refs)assert.equal(container.textContent.includes(ref.contentHash),false);
   assert.equal(calls.length,count);await render();assert.equal(find(container,expand),undefined);
   await reply(await begin(),result);assert.equal(find(container,expand)?.getAttribute('aria-expanded'),'false');
  }
  assert.equal(changes,0);assert.deepEqual(buffer,original);
 }finally{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}
});

const handoffNotReady=(commandId:string)=>({code:'HANDOFF_NOT_READY',message:'요청을 처리하지 못했습니다',requestId:'req-1',targetId:null,retryDisposition:'not-retryable',details:{commandId}});
test('첫 수락 POST의 정확한 412만 명령 ID에 결박된 확정 거절이다',async()=>{
 const summary=await protectedSummary(true),target={...session,user:{...session.user,id:requester},clientId:requesterClient};
 const command={schemaVersion:1 as const,operation:'acceptControl' as const,commandId:id(99),projectId,clientId:requesterClient,payload:{requestRef:request.requestRef,summaryVersion:1,reason:'명시 수락'}};
 const original=handoffNotReady(command.commandId),savedNow=Date.now;Date.now=()=>Date.parse(now);
 try{
  const post=(body:Response)=>new ControlApi(async(_url,init)=>{assert.equal(init?.method,'POST');assert.equal(new Headers(init.headers).get('Idempotency-Key'),command.commandId);assert.deepEqual(JSON.parse(String(init.body)),command);return body;},target,projectId).accept(command,summary);
  await assert.rejects(post(Response.json(original,{status:412})),{code:'HANDOFF_NOT_READY',status:412,commandId:command.commandId});
  const invalid=[
   Response.json(handoffNotReady(id(98)),{status:412}),Response.json({...original,targetId:id(98)},{status:412}),
   Response.json({...original,retryDisposition:'reconcile-first'},{status:412}),Response.json({...original,details:{commandId:command.commandId,grantRef:{}}},{status:412}),
   Response.json({...original,requestId:'x'.repeat(5000)},{status:412}),Response.json(original,{status:503}),
   new Response(JSON.stringify(original).replace('"code":','"code":"HANDOFF_NOT_READY","code":'),{status:412,headers:{'content-type':'application/json'}}),
   new Response(JSON.stringify(original),{status:412,headers:{'content-type':'text/plain'}})
  ];
  for(const response of invalid)await assert.rejects(post(response),(error:any)=>error.code!=='HANDOFF_NOT_READY');
  const retry=new ControlApi(async(_url,init)=>{assert.equal(init?.method,'GET');return Response.json(original,{status:404});},target,projectId);
  await assert.rejects(retry.acceptanceResult(command,summary),{code:'NOT_FOUND',status:404});
 }finally{Date.now=savedNow;}
});

async function rejectedAcceptanceFixture(mode:'NOT_READY'|'HOLD'|'WRONG_ID',initialStatus:'READY'|'UNKNOWN'='READY'){
 const summary=await protectedSummary(true),target={...session,user:{id:requester,displayName:'수락 대상'},clientId:requesterClient},savedNow=Date.now;
 Date.now=()=>Date.parse(now);
 const command={schemaVersion:1 as const,operation:'acceptControl' as const,commandId:id(100),projectId,clientId:requesterClient,payload:{requestRef:request.requestRef,summaryVersion:1,reason:'이전 수락 원문'}};
 const initial={bindingId:id(101),ownerUserId:requester,ownerClientId:requesterClient,projectId,reason:command.payload.reason,expiresAt:'',pending:{bindingId:id(102),kind:'ACCEPT',status:initialStatus,command,summary}};
 let buffer:any=initial,selectedSession=target,lost=0,unmounted=false;
 const calls:{path:string;method:string}[]=[],posted:unknown[]=[],pending=Promise.withResolvers<Response>(),fixed={projectId,requestRef:request.requestRef,snapshot:request.snapshot,observedAt:now,current:{expired:false,baseControlState:'MATCHED'},executionAuthorized:false,controlTransferred:false};
 const client=new ui.ApiClient(async(path:string,init?:RequestInit)=>{
  const method=init?.method??'GET',url=new URL(path,'https://test.invalid');calls.push({path,method});
  if(method==='POST'&&url.pathname.endsWith('/acceptances')){
   const sent=JSON.parse(String(init?.body));posted.push(sent);assert.equal(buffer.pending.status,'UNKNOWN');assert.deepEqual(sent,command);
   return mode==='HOLD'?pending.promise:Response.json(handoffNotReady(mode==='WRONG_ID'?id(103):command.commandId),{status:412});
  }
  if(url.pathname.includes('/acceptances/'))return Response.json({code:'NOT_FOUND'},{status:404});
  if(url.pathname.endsWith('/control-state'))return Response.json({schemaVersion:1,projectId,observedAt:now,actorId:requester,clientId:requesterClient,participation:'HANDOFF_ELIGIBLE',control:{state:'OTHER_CLIENT',basis:baseControl},executionAuthorized:false,controlTransferred:false});
  if(url.pathname.endsWith('/control-requests'))return Response.json({projectId,view:'OWN',limit:50,observedAt:now,items:[{requestRef:request.requestRef,createdAt:request.snapshot.createdAt,expiresAt:request.snapshot.expiresAt,storedState:'PENDING',current:fixed.current,executionAuthorized:false,controlTransferred:false}],hasMore:false,nextCursor:null,executionAuthorized:false,controlTransferred:false});
  if(url.pathname.endsWith('/protected-handoff-summaries/head'))return Response.json({schemaVersion:2,purpose:'CONTROL_HANDOFF_PROTECTED_HEAD',projectId,requestRef:request.requestRef,observedAt:now,head:{state:'AVAILABLE',summaryRef:summary.ref},executionAuthorized:false,dispatchPerformed:false,controlTransferred:false});
  if(url.pathname.endsWith('/protected-handoff-summaries/1'))return Response.json(summary);
  if(url.pathname.endsWith('/versions/1'))return Response.json(fixed);
  throw Error('예상 밖 IO '+path);
 });
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 const render=()=>root.render(ui.React.createElement(ui.ControlAccessPage,{client,projectId,session:selectedSession,buffer,onChange:(expected:string|null,next:any)=>{
  const merged=ui.mergeControlBuffer(buffer,expected,next);if(merged===buffer)return false;buffer=merged;render();return true;
 },onAuthenticationLost:()=>{lost++;}}));
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))];
 const button=(label:string)=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===label);
 const click=async(label:string)=>{const node=button(label);assert(node&&!node.disabled,label);await ui.React.act(async()=>node.dispatchEvent({type:'click',button:0}));};
 const until=async(check:()=>boolean)=>{const deadline=performance.now()+2000;while(!check()&&performance.now()<deadline)await ui.React.act(async()=>new Promise(r=>setTimeout(r,2)));assert(check(),container.textContent);};
 await ui.React.act(async()=>render());
 return{client,command,calls,posted,button,click,until,text:()=>container.textContent,buffer:()=>buffer,lost:()=>lost,
  async confirm(){const n=nodes().find(n=>n.tagName==='INPUT'&&Object.keys(n).some(k=>k.startsWith('__reactProps')&&(n as any)[k]?.type==='checkbox'));assert(n);const prop=Object.keys(n).find(k=>k.startsWith('__reactProps'));assert(prop);await ui.React.act(async()=>(n as any)[prop].onChange({target:{checked:true}}));},
  async change(mode:string){
   if(mode==='TRANSPORT'){client.transport=client.transport.bind(null);return;}
   if(mode==='UNMOUNT'){await ui.React.act(async()=>root.unmount());unmounted=true;return;}
   if(mode==='PARENT_CAS'){buffer={...buffer,pending:{...buffer.pending}};return;}
   await ui.React.act(async()=>{if(mode==='CSRF')selectedSession={...selectedSession,csrfToken:'D'.repeat(43)};else buffer={...buffer,pending:{...buffer.pending}};render();});
  },
  resolve:()=>ui.React.act(async()=>pending.resolve(Response.json(handoffNotReady(command.commandId),{status:412}))),
  async close(){Date.now=savedNow;if(!unmounted)await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}
 };
}

test('수락 화면은 정확한 최초 거절만 닫고 새 현재 제어·보호요약을 확인하기 전에는 새 명령을 보존하지 않는다',async()=>{
 const f=await rejectedAcceptanceFixture('NOT_READY');try{
  await f.click('보존한 명령 전송');await f.until(()=>f.text().includes('수락 거절 확인'));
  assert.equal(f.buffer().pending.status,'REJECTED');assert.deepEqual(f.buffer().pending.command,f.command);
  assert(f.text().includes(f.command.commandId));assert(f.button('인수 수락 명령 보존')?.disabled);
  assert.equal(f.button('같은 명령 결과 재확인'),undefined);assert.equal(f.button('보존한 명령 전송'),undefined);
  assert.equal(f.calls.length,1);assert.equal(f.posted.length,1);assert(!f.text().includes('제어 전환 결과 확인'));
  await f.click('현재 제어 조회');await f.until(()=>f.text().includes('OTHER_CLIENT'));
  await f.click('내 요청 목록 조회');await f.until(()=>!!f.button('요청 1 원문 확인'));
  await f.click('요청 1 원문 확인');await f.until(()=>!!f.button('최신 보호요약 고정 원문 조회'));
  await f.click('최신 보호요약 고정 원문 조회');await f.until(()=>f.text().includes('보호 검산 READY'));
  assert(f.button('인수 수락 명령 보존')?.disabled);
  await f.confirm();await f.click('인수 수락 명령 보존');
  assert.equal(f.buffer().pending.status,'READY');assert.notEqual(f.buffer().pending.command.commandId,f.command.commandId);
  assert.equal(f.posted.length,1);assert.equal(f.calls.filter(c=>c.path.includes('/acceptances/')).length,0);
 }finally{await f.close();}
});

test('다른 명령 412와 동일 명령 GET404는 원 수락 UNKNOWN을 보존한다',async()=>{
 const f=await rejectedAcceptanceFixture('WRONG_ID');try{
  await f.click('보존한 명령 전송');await f.until(()=>f.text().includes('현재 제어를 다시 조회하세요.'));
  assert.equal(f.buffer().pending.status,'UNKNOWN');assert.deepEqual(f.buffer().pending.command,f.command);
  await f.click('현재 제어 조회');await f.until(()=>f.text().includes('OTHER_CLIENT'));
  await f.click('같은 명령 결과 재확인');await f.until(()=>f.text().includes('현재 제어를 다시 조회하세요.'));
  assert.equal(f.buffer().pending.status,'UNKNOWN');assert.deepEqual(f.buffer().pending.command,f.command);
  assert.equal(f.posted.length,1);assert.equal(f.calls.filter(c=>c.path.includes('/acceptances/')).length,1);
 }finally{await f.close();}
});

test('늦은 정확한 수락 거절도 버퍼·transport·CSRF·화면 교체 후에는 반영하지 않는다',async()=>{
 for(const mode of ['BUFFER','PARENT_CAS','TRANSPORT','CSRF','UNMOUNT']){
  const f=await rejectedAcceptanceFixture('HOLD');try{
   await f.click('보존한 명령 전송');await f.until(()=>f.posted.length===1);
   await f.change(mode);const before=f.buffer();await f.resolve();
   assert.equal(f.buffer(),before,mode);assert.equal(before.pending.status,'UNKNOWN',mode);
   assert(!f.text().includes('수락 거절 확인'),mode);assert(!f.text().includes('현재 제어를 다시 조회하세요.'),mode);
   assert.equal(f.lost(),0,mode);assert.equal(f.calls.length,1,mode);
  }finally{await f.close();}
 }
});

test('수락 원문 hash 대기 중 문맥이 바뀌면 첫 POST와 동일 명령 GET을 모두 보내지 않는다',async()=>{
 for(const mode of ['POST','GET']){
  const f=await rejectedAcceptanceFixture('NOT_READY',mode==='POST'?'READY':'UNKNOWN');
  const subtle=crypto.subtle,digest=subtle.digest,descriptor=Object.getOwnPropertyDescriptor(subtle,'digest'),release=Promise.withResolvers<void>();
  let waiting=false;
  Object.defineProperty(subtle,'digest',{configurable:true,value:async(...args:Parameters<SubtleCrypto['digest']>)=>{
   const raw=new TextDecoder().decode(args[1]);
   if(!waiting&&(mode==='POST'||raw.includes('"operation":"acceptControl"'))){waiting=true;await release.promise;}
   return digest.apply(subtle,args);
  }});
  try{
   await f.click(mode==='POST'?'보존한 명령 전송':'같은 명령 결과 재확인');
   await f.until(()=>waiting);assert.equal(f.buffer().pending.status,'UNKNOWN');
   await f.change(mode==='POST'?'TRANSPORT':'BUFFER');const before=f.buffer();
   await ui.React.act(async()=>{release.resolve();await new Promise(r=>setImmediate(r));});
   assert.equal(f.calls.length,0,mode);assert.equal(f.buffer(),before,mode);assert.equal(f.lost(),0,mode);
  }finally{
   release.resolve();
   if(descriptor)Object.defineProperty(subtle,'digest',descriptor);else Reflect.deleteProperty(subtle,'digest');
   await f.close();
  }
 }
});

const historicalSummaryLabel='이 수락의 과거 보호요약 조회';
async function confirmedSummaryFixture(){
 const summary=await protectedSummary(true),command={schemaVersion:1 as const,operation:'acceptControl' as const,commandId:id(130),projectId,clientId:requesterClient,payload:{requestRef:request.requestRef,summaryVersion:summary.ref.version,reason:'과거 보호요약 읽기'}};
 const chain=createControlAcceptanceChain({projectId,command,requestRef:request.requestRef,summaryRef:summary.ref,before:baseControl,targetActorId:requester,recordedAt:now,ids:{acceptance:id(131),revocation:id(132),grant:id(133),receipt:id(134),audit:id(135)}});
 const target={...session,user:{id:requester,displayName:'원 수락 대상'},clientId:requesterClient},buffer={bindingId:id(136),ownerUserId:requester,ownerClientId:requesterClient,projectId,reason:'불변 원 입력',expiresAt:'',pending:{bindingId:id(137),kind:'ACCEPT',status:'CONFIRMED',command,summary}};
 const calls:{path:string;method:string}[]=[];let summaryReply=async()=>Response.json(summary),acceptanceReply=async()=>Response.json(chain.result),lost=0,changes=0;
 const client=new ui.ApiClient(async(path:string,init:RequestInit)=>{
  calls.push({path,method:init.method??'GET'});assert.equal(init.method,'GET','이력 열기는 POST0');
  if(path.includes('/acceptances/'))return acceptanceReply();
  if(path.includes('/protected-handoff-summaries/'+summary.ref.version+'?'))return summaryReply();
  if(path.endsWith('/control-state'))return Response.json({schemaVersion:1,projectId,observedAt:now,actorId:requester,clientId:requesterClient,participation:'OWNER',control:{state:'HELD',basis:chain.result.nextControl},executionAuthorized:false,controlTransferred:false});
  assert.fail('원 고정참조 외 head/목록/자동 조회 금지: '+path);
 });
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container),props:any={client,projectId,session:target,buffer,onChange:()=>{changes++;return false;},onAuthenticationLost:()=>lost++};
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))],button=(text:string)=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===text);
 const render=async(overrides={})=>ui.React.act(async()=>root.render(ui.React.createElement(ui.ControlAccessPage,{...props,...overrides})));
 const tick=()=>ui.React.act(async()=>new Promise(resolve=>setImmediate(resolve)));
 const until=async(check:()=>boolean)=>{const end=performance.now()+2000;while(!check()){assert(performance.now()<end,container.textContent);await tick();}};
 const click=async(text:string)=>{const n=button(text);assert(n,text);assert(!n.disabled,text);await ui.React.act(async()=>n.dispatchEvent({type:'click',button:0}));};
 await render();return{summary,chain,buffer,props,client,calls,container,nodes,button,render,tick,until,click,lost:()=>lost,changes:()=>changes,summaryReply:(read:()=>Promise<Response>)=>summaryReply=read,acceptanceReply:(read:()=>Promise<Response>)=>acceptanceReply=read,confirm:async()=>{await click('수락 결과 다시 조회');await until(()=>container.textContent.includes('제어 전환 결과 확인'));},close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
test('현재 검산된 CONFIRMED 수락의 exact 과거 보호요약만 명시 GET1로 읽고 만료 당시값을 현재 권위로 바꾸지 않는다',{timeout:15000},async()=>{
 const f=await confirmedSummaryFixture();try{
  assert.equal(f.calls.length,0);assert.equal(f.button(historicalSummaryLabel),undefined);await f.confirm();const original=structuredClone(f.buffer),before=f.calls.length;
  assert(f.button(historicalSummaryLabel),'검산된 수락에서 과거 보호요약 진입 누락');assert(Date.parse(f.summary.snapshot.validUntil)<Date.now(),'과거 만료 요약 fixture');await f.click(historicalSummaryLabel);await f.until(()=>f.container.textContent.includes(f.summary.ref.contentHash));
  assert.deepEqual(f.calls.slice(before),[{path:'/api/v1/projects/'+projectId+'/control-requests/'+request.requestRef.id+'/versions/1/protected-handoff-summaries/'+f.summary.ref.version+'?requestHash='+request.requestRef.contentHash+'&summaryHash='+f.summary.ref.contentHash,method:'GET'}]);
  assert(f.container.textContent.includes(f.summary.ref.contentHash));await f.click('항목별 인계 판정 펼치기');assert(f.container.textContent.includes('저장 당시 관측입니다.'));assert(f.container.textContent.includes('저장 당시 확인된 빈 목록'));assert.equal(f.changes(),0);assert.deepEqual(f.buffer,original);assert.equal(f.lost(),0);assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});

test('수락 과거 보호요약의 교차 참조·범위/본문 오염·401/403/404는 현재 결과와 원명령을 바꾸지 않는다',{timeout:15000},async()=>{
 for(const mode of ['REQUEST','HASH','PROJECT','TARGET','BASE','401','403','404']){
  const f=await confirmedSummaryFixture();try{
   await f.confirm();const original=structuredClone(f.buffer),value=structuredClone(f.summary);
   if(mode==='REQUEST')value.snapshot.requestRef={...value.snapshot.requestRef,id:id(140)};
   if(mode==='HASH')value.ref.contentHash='f'.repeat(64);
   if(mode==='PROJECT')value.snapshot.projectId=id(141);
   if(mode==='TARGET')value.snapshot.targetClientRef.clientId=id(142);
   if(mode==='BASE')value.snapshot.baseControl.generation++;
   f.summaryReply(async()=>['401','403','404'].includes(mode)?Response.json({code:'ACCESS_DENIED'},{status:Number(mode)}):Response.json(value));
   await f.click(historicalSummaryLabel);await f.until(()=>f.container.textContent.includes('수락 당시 보호요약을 확인할 수 없습니다.'));
   assert(!f.container.textContent.includes(f.summary.ref.contentHash));assert(f.container.textContent.includes('제어 전환 결과 확인'));assert.equal(f.lost(),mode==='401'?1:0);assert.equal(f.changes(),0);assert.deepEqual(f.buffer,original);assert.equal(f.calls.length,2);
  }finally{await f.close();}
 }
});
test('수락 과거 요약은 원 표시·close·재조회·route와 인증/transport ABA의 늦은200/401을 폐기한다',{timeout:15000},async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'location'),location={hash:'#/projects/'+projectId+'/control'};Object.defineProperty(globalThis,'location',{value:location,configurable:true});
 try{for(const mode of ['SUMMARY_CLOSE','SUMMARY_REQUERY','RESULT_CLOSE','RESULT_REQUERY','ACTOR','CLIENT','CSRF','TRANSPORT','ROUTE_RAW','ROUTE_ABA'])for(const status of [200,401]){
  location.hash='#/projects/'+projectId+'/control';const f=await confirmedSummaryFixture(),gate=Promise.withResolvers<Response>(),second=Promise.withResolvers<Response>();
  try{
   await f.confirm();const original=structuredClone(f.buffer);f.summaryReply(()=>gate.promise);await f.click(historicalSummaryLabel);
   const old=f.button(historicalSummaryLabel)!,oldClick=(old as any)[Object.keys(old).find(k=>k.startsWith('__reactProps'))!].onClick,oldClose=f.button('수락 당시 보호요약 닫기')!,oldCloseClick=(oldClose as any)[Object.keys(oldClose).find(k=>k.startsWith('__reactProps'))!].onClick;
   if(mode==='SUMMARY_CLOSE'||mode==='SUMMARY_REQUERY')await f.click('수락 당시 보호요약 닫기');
   if(mode==='SUMMARY_REQUERY'){f.summaryReply(()=>second.promise);await f.click(historicalSummaryLabel);}
   if(mode==='RESULT_CLOSE')await f.click('수락 결과 닫기');
   if(mode==='RESULT_REQUERY'){f.acceptanceReply(()=>second.promise);await f.click('수락 결과 다시 조회');}
   if(['ACTOR','CLIENT','CSRF','TRANSPORT'].includes(mode)){
    const changed:any={};if(mode==='ACTOR')changed.session={...f.props.session,user:{id:controller}};if(mode==='CLIENT')changed.session={...f.props.session,clientId:controllerClient};if(mode==='CSRF')changed.session={...f.props.session,csrfToken:'z'.repeat(43)};
    const transport=f.client.transport;if(mode==='TRANSPORT')f.client.transport=async()=>{throw Error('대체 전송 호출 금지');};await f.render(changed);f.client.transport=transport;await f.render();
   }
   if(mode==='ROUTE_RAW')location.hash='#/projects/'+projectId+'/workspace';
   if(mode==='ROUTE_ABA'){location.hash='#/projects/'+projectId+'/workspace';await f.render();location.hash='#/projects/'+projectId+'/control';await f.render();}
   const before=f.calls.length;
   if(!['SUMMARY_CLOSE','SUMMARY_REQUERY'].includes(mode))await ui.React.act(async()=>oldClick());
   await ui.React.act(async()=>{gate.resolve(status===200?Response.json(f.summary):Response.json({code:'AUTH_REQUIRED'},{status:401}));await new Promise(r=>setImmediate(r));});await f.tick();
   assert.equal(f.calls.length,before,'옛 클릭/응답으로 새 조회0');assert(!f.container.textContent.includes(f.summary.ref.contentHash));assert(!f.container.textContent.includes('수락 당시 보호요약을 확인할 수 없습니다.'));assert.equal(f.lost(),0);assert.deepEqual(f.buffer,original);assert.equal(f.changes(),0);
   if(mode==='SUMMARY_REQUERY'){
    await ui.React.act(async()=>{second.resolve(Response.json(f.summary));await new Promise(r=>setImmediate(r));});await f.until(()=>f.container.textContent.includes(f.summary.ref.contentHash));
    await ui.React.act(async()=>oldCloseClick());assert(f.container.textContent.includes(f.summary.ref.contentHash),'옛 close가 새 조회 원문을 닫지 않음');
   }
  }finally{gate.resolve(Response.json({}));second.resolve(Response.json({}));await f.close();}
 }}finally{if(descriptor)Object.defineProperty(globalThis,'location',descriptor);else Reflect.deleteProperty(globalThis,'location');}
});

test('수락 과거요약은 렌더 없는 hashchange A→B→A 전달 뒤 늦은200/401을 폐기하고 listener를 정리한다',{timeout:15000},async()=>{
 const keys=['location','addEventListener','removeEventListener'] as const,saved=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)])),route='#/projects/'+projectId+'/control',other='#/projects/'+projectId+'/workspace',location={hash:route},listeners=new Set<(event:any)=>void>();
 Object.defineProperty(globalThis,'location',{value:location,configurable:true});Object.defineProperty(globalThis,'addEventListener',{value:(kind:string,callback:(event:any)=>void)=>{assert.equal(kind,'hashchange');listeners.add(callback);},configurable:true});Object.defineProperty(globalThis,'removeEventListener',{value:(kind:string,callback:(event:any)=>void)=>{assert.equal(kind,'hashchange');listeners.delete(callback);},configurable:true});
 try{for(const status of [200,401]){
  location.hash=route;const f=await confirmedSummaryFixture(),gate=Promise.withResolvers<Response>();
  try{
   await f.confirm();assert.equal(listeners.size,1);f.summaryReply(()=>gate.promise);await f.click(historicalSummaryLabel);const before=f.calls.length,original=structuredClone(f.buffer);
   // 브라우저가 전달한 두 이벤트의 원 URL을 사용한다. 이벤트 전달 전 동기 왕복의 검출을 주장하지 않는다.
   location.hash=other;location.hash=route;
   await ui.React.act(async()=>{
    for(const listener of listeners)listener({oldURL:'https://anvil.invalid/'+route,newURL:'https://anvil.invalid/'+other});
    for(const listener of listeners)listener({oldURL:'https://anvil.invalid/'+other,newURL:'https://anvil.invalid/'+route});
    gate.resolve(status===200?Response.json(f.summary):Response.json({code:'AUTH_REQUIRED'},{status:401}));await new Promise(r=>setImmediate(r));
   });await f.tick();
   assert(!f.container.textContent.includes(f.summary.ref.contentHash));assert(!f.container.textContent.includes('수락 당시 보호요약을 확인할 수 없습니다.'));assert.equal(f.lost(),0);assert.equal(f.calls.length,before);assert.deepEqual(f.buffer,original);assert.equal(f.changes(),0);
  }finally{gate.resolve(Response.json({}));await f.close();assert.equal(listeners.size,0,'unmount의 exact hashchange listener 해제');}
 }}finally{for(const key of keys){const value=saved.get(key);if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}}
});
