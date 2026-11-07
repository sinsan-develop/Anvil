import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

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
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/backups/BackupPolicyPanel.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:history-decision',name:'HistoryDecisionTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'history-memory-entry',resolveId(id){if(id.endsWith('virtual:history-decision'))return '\0history-decision';},load(id){if(id==='\0history-decision')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{BackupPolicyPanel}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};import * as policyApi from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/backups/backup-policy-api.ts',import.meta.url)))};import {ApprovalsPage} from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/decisions/ApprovalsPage.tsx',import.meta.url)))};export{React,createRoot,BackupPolicyPanel,ApiClient,policyApi,ApprovalsPage};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const [key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return HistoryDecisionTest;')();
});
after(()=>{for(const channel of channels){channel.port1.close();channel.port2.close();}for(const[key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});

const id=(n:number)=>'af160063-0000-4000-8000-'+String(n).padStart(12,'0'),pid=id(1),session={user:{id:id(2)},clientId:id(3),csrfToken:'c'.repeat(43)};
async function fixture(){
 const calls:{path:string;method:string}[]=[],responses:{next:()=>Promise<Response>}={next:async()=>Response.json({items:[],hasMore:false,nextCursor:null,observedAt:new Date().toISOString()})};
 const api=new ui.ApiClient(async(path:any,options:any)=>{calls.push({path:String(path),method:options?.method??'GET'});return responses.next();});
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);let lost=0,buffer:any=null,props:any={client:api,projectId:pid,session,buffer:null,approvalRequestId:null,onApprovalRequest:()=>false,onAuthenticationLost:()=>{lost++;}};
 const nodes=(n=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))],button=(label:string)=>{const v=nodes().filter(n=>n.tagName==='BUTTON'&&n.textContent===label);assert.equal(v.length,1,label);return v[0]!;};
 const render=async(p=props)=>{props=p;await ui.React.act(async()=>root.render(ui.React.createElement(ui.BackupPolicyPanel,props)));};
 props.onChange=(expected:any,next:any)=>{if(buffer!==expected)return false;buffer=next;props={...props,buffer:next};root.render(ui.React.createElement(ui.BackupPolicyPanel,props));return true;};
 const click=async(label:string)=>{const n=button(label);assert(!n.disabled,label);await ui.React.act(async()=>n.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const change=async(label:string,value:string|boolean)=>{const n=nodes().find(n=>n.getAttribute('aria-label')===label)!;assert(n,label);const key=Object.keys(n).find(k=>k.startsWith('__reactProps'))!;await ui.React.act(async()=>((n as any)[key].onChange({target:{value,checked:value}})));};
 await render();return{root,api,calls,responses,lost:()=>lost,render,seed:async(value:any)=>{buffer=value;await render({...props,buffer:value});},props:()=>props,button,click,change,buffer:()=>buffer,text:()=>container.textContent,close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
test('실제 React 패널은 별도 정책 초안과 미완성 입력을 보존하며 명시 조회 전 GET/POST0',async()=>{const f=await fixture();try{assert.equal(f.calls.length,0);await f.click('새 수동 정책 작성');await f.change('수동 정책 이유','[');await f.change('수동 정책 한도 bytes','x');assert.equal(f.buffer().draft.reason,'[');assert.equal(f.buffer().draft.maxBytes,'x');assert.equal(f.calls.length,0);await f.click('수동 정책 목록 조회');assert.equal(f.calls.length,1);assert(f.calls.every(c=>c.method==='GET'));assert.equal(f.buffer().draft.reason,'[');}finally{await f.close();}});
test('느린 목록 JSON은 실제client/transport 교체와 닫힌 owner 이후 버리며 새 명시 조회를 회복한다',async()=>{for(const mode of ['CLIENT','TRANSPORT','ABA']){const f=await fixture();let resolve!:(v:any)=>void,started=false;const gate=new Promise(r=>resolve=r);try{f.responses.next=async()=>{const r=Response.json({});r.json=()=>{started=true;return gate;};return r;};await f.click('수동 정책 목록 조회');assert(started);const props=f.props(),old=f.api.transport,newTransport=async()=>Response.json({items:[],hasMore:false,nextCursor:null,observedAt:new Date().toISOString()});if(mode==='CLIENT')await f.render({...props,client:new ui.ApiClient(newTransport)});else{f.api.transport=newTransport;await f.render();if(mode==='ABA'){f.api.transport=old;await f.render();}}resolve({items:[],hasMore:false,nextCursor:null,observedAt:new Date().toISOString()});await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});assert(!f.button('수동 정책 목록 조회').disabled);assert(f.calls.every(c=>c.method==='GET'));}finally{resolve?.({});await f.close();}}});

function policyPending(api:any){const p={policy:{targetProtectedRef:{id:id(10),version:1,contentHash:'a'.repeat(64)},encryptionKeyRef:{id:id(11),version:1,contentHash:'a'.repeat(64)},retentionPolicyRef:{id:id(12),version:1,contentHash:'a'.repeat(64)},verificationPolicyRef:{id:id(13),version:1,contentHash:'a'.repeat(64)},include:{documents:true,conversations:false,knowledge:false,decisions:false,plans:false,results:false,artifacts:false,sourceSelection:{kind:'NONE'}},schedule:'MANUAL',maxBytes:1024},previousRef:null,reason:'정확 합성 정책 원명령'},b=ui.policyApi.newBackupPolicyBuffer(api,pid,session),command={schemaVersion:1,projectId:pid,commandId:id(30),clientId:session.clientId,controlGeneration:1,operation:'saveBackupPolicy',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:p};b.pending={command,body:canonicalJson(command),state:'PREPARED',receipt:null,wasUnknown:false,approvalEligible:false};return b;}
test('실POST 도달 후 문맥전환은 부모 buffer UNKNOWN/원명령을 유지하고 복귀시 자동POST0·동일명령 재확인만 허용한다',async()=>{const f=await fixture();let release!:(r:Response)=>void,post=0;try{f.api.transport=async(path:any,options:any)=>{if(options?.method==='POST'){post++;return new Promise<Response>(r=>release=r);}return Response.json({id:pid,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:1,status:'HELD'}});};await f.seed(policyPending(f.api));const body=f.buffer().pending.body;await f.click('같은 수동 정책 명령 저장·재확인');assert.equal(post,1);assert.equal(f.buffer().pending.state,'UNKNOWN');assert.equal(f.buffer().uncertain,true);const props=f.props();await f.render({...props,session:{...session,user:{id:id(99)}}});release(Response.json({code:'VERSION_CONFLICT'},{status:409}));await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});await f.render({...props,buffer:f.buffer()});assert.equal(post,1);assert.equal(f.buffer().pending.body,body);assert.match(f.text(),/결과 미확인/);assert(!f.button('같은 수동 정책 명령 저장·재확인').disabled);}finally{release?.(Response.json({code:'VERSION_CONFLICT'},{status:409}));await f.close();}});
test('실POST 명확거절은 원명령 보존·명시 수정만 허용하고 수정 전후 자동POST0',async()=>{const f=await fixture();let post=0;try{f.api.transport=async(_path:any,options:any)=>{if(options?.method==='POST'){post++;return Response.json({code:'VERSION_CONFLICT'},{status:409});}return Response.json({id:pid,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:1,status:'HELD'}});};await f.seed(policyPending(f.api));await f.click('같은 수동 정책 명령 저장·재확인');assert.equal(post,1);assert.equal(f.buffer().pending.state,'REJECTED');assert.equal(f.buffer().uncertain,false);await f.click('정책 거절 확인 후 수정');assert.equal(f.buffer().pending,null);assert.equal(post,1);}finally{await f.close();}});

test('UI08 실제 요청저장→전체원문표시→별도결정은 정책 명령을 자동 소비하지 않는다',async()=>{
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container),calls:{operation:string;body:any}[]=[];
 const now=new Date().toISOString(),expires='2099-01-01T00:00:00.000Z',rules=[{ruleId:'policy',subjectRef:{kind:'HUMAN',userId:session.user.id},operations:['saveBackupPolicy'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'REQUIRE_APPROVAL',limitPolicyRef:null,expiresAt:expires}],policy={rules,reason:'명시 합성 현재정책',reviewRefs:[],createdAt:now,ref:{id:id(4),version:1,contentHash:contentHash(canonicalJson({rules,reason:'명시 합성 현재정책',reviewRefs:[]}))}};
 let view:any=null,pageBuffer:any=null,props:any;
 const api=new ui.ApiClient(async(path:any,options:any)=>{
  if(options?.method==='POST'){
   const c=JSON.parse(options.body);calls.push({operation:c.operation,body:c});
   if(c.operation==='requestApproval'){
    const body={projectId:pid,details:c.payload.details,scopeDigest:contentHash(canonicalJson(c.payload.details.actionScope)),requiredDecider:{kind:'HUMAN',userId:session.user.id},policyRef:policy.ref,requestedBy:{kind:'HUMAN',userId:session.user.id,clientId:session.clientId},controlGeneration:1},ref={id:id(60),version:1,contentHash:contentHash(canonicalJson(body))},request={...body,id:ref.id,version:1,status:'PENDING',createdAt:now};
    view={request,requestRef:ref,currentVersion:1,storedStatus:'PENDING',effectiveState:'PENDING',decision:null,consumption:null,expired:false,basisCurrent:true,executionAuthorized:false,observedAt:now,candidateBackupPolicy:{candidateCommandId:c.payload.details.candidateCommandId,payloadHash:c.payload.details.actionScope.payloadHash,payload:c.payload.candidatePayload}};
    return Response.json({commandId:c.commandId,operationId:id(61),projectId:pid,status:'APPLIED',targetId:ref.id,version:1,data:{status:'APPROVAL_REQUESTED',ref,request},evidenceRefs:[],warnings:[],serverReceivedAt:now});
   }
   assert.equal(c.operation,'decideApproval');const body={requestId:view.request.id,requestVersion:1,requestRef:view.requestRef,scopeDigest:view.request.scopeDigest,decision:c.payload.decision,reason:c.payload.reason,decidedBy:{kind:'HUMAN',userId:session.user.id,clientId:session.clientId},controlGeneration:1,policyRef:policy.ref},ref={id:id(62),version:1,contentHash:contentHash(canonicalJson(body))},decision={...body,id:ref.id,decidedAt:now};
   view={...view,currentVersion:2,storedStatus:'APPROVED',effectiveState:'APPROVED',decision:{...decision,ref}};
   return Response.json({commandId:c.commandId,operationId:id(63),projectId:pid,status:'APPLIED',targetId:ref.id,version:1,data:{status:'APPROVAL_DECIDED',ref,decision},evidenceRefs:[],warnings:[],serverReceivedAt:now});
  }
  if(String(path).endsWith('/permission-policy'))return Response.json({configured:true,policy});
  if(String(path).endsWith('/'+pid))return Response.json({id:pid,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:1,status:'HELD'}});
  if(String(path).includes('/approvals/'))return Response.json(view);
  return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:now});
 });
 const backup=policyPending(api);backup.pending.state='REQUIRED';const request=ui.policyApi.newBackupPolicyApproval(backup,session);request.details={reason:'범위검토',risks:{data:'보관',security:'키없음',cost:'실행없음',interruption:'없음',unverified:'실백업미검증'},rollback:{method:'새개정',limitations:'역사유지',evidenceRefs:[]},expiresAt:expires};
 pageBuffer={projectId:pid,ownerUserId:session.user.id,ownerClientId:session.clientId,selectedId:null,request,decision:null};
 const render=async()=>{await ui.React.act(async()=>root.render(ui.React.createElement(ui.ApprovalsPage,props)));};
 props={client:api,projectId:pid,session,buffer:pageBuffer,backupPolicyBuffer:backup,candidate:null,onCandidateChange:()=>{throw Error('UNRELATED_CANDIDATE');},onAuthenticationLost:()=>{throw Error('AUTH_LOST');},onChange:(change:any)=>{pageBuffer=typeof change==='function'?change(pageBuffer):change;props={...props,buffer:pageBuffer};root.render(ui.React.createElement(ui.ApprovalsPage,props));}};
 const nodes=(n=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))],button=(label:string)=>{const n=nodes().filter(n=>n.tagName==='BUTTON'&&n.textContent===label);assert.equal(n.length,1,label);return n[0]!;},click=async(label:string)=>{assert(!button(label).disabled,label);await ui.React.act(async()=>button(label).dispatchEvent({type:'click',button:0,bubbles:true}));},settle=async(check:()=>boolean)=>{const end=Date.now()+2000;while(!check()&&Date.now()<end)await ui.React.act(async()=>{await new Promise(r=>setTimeout(r,2));});assert(check(),container.textContent);};
 try{
  await render();await click('승인 요청 저장');await settle(()=>container.textContent.includes('수동 백업 정책 전체 후보')||container.textContent.includes('수동 백업 정책 저장 승인'));
  assert.equal(calls.length,1);assert.equal(calls[0]!.operation,'requestApproval');assert.deepEqual(calls[0]!.body.payload.candidatePayload,backup.pending.command.payload);assert.match(container.textContent,/정확 합성 정책 원명령/);
  const reason=nodes().find(n=>n.getAttribute('aria-label')==='결정 이유')!,reasonKey=Object.keys(reason).find(k=>k.startsWith('__reactProps'))!,ack=nodes().find(n=>n.tagName==='INPUT'&&((n as any)[Object.keys(n).find(k=>k.startsWith('__reactProps'))!]?.type==='checkbox'))!;
  await ui.React.act(async()=>{(reason as any)[reasonKey].onChange({target:{value:'별도 승인'}});});
  const ackKey=Object.keys(ack).find(k=>k.startsWith('__reactProps'))!;await ui.React.act(async()=>{(ack as any)[ackKey].onChange({target:{checked:true}});});
  await click('이번만 승인');await settle(()=>view?.effectiveState==='APPROVED'&&pageBuffer.decision?.resultId&&container.textContent.includes('저장 APPROVED'));await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});
  assert.deepEqual(calls.map(c=>c.operation),['requestApproval','decideApproval']);assert.equal(backup.pending.state,'REQUIRED');assert.equal(backup.pending.command.approvalRef,null);assert(nodes().some(n=>n.tagName==='A'&&n.textContent==='수동 정책 원명령으로 돌아가 별도 승인 결박·저장'));
 }finally{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}
});

test('새 작성은 실제 보호 GET 검산·명시 선택만 받고 전체 프로필 미지원412에서 POST0로 닫힌다',async()=>{
 const f=await fixture(),refs:any[]=[];const now=new Date().toISOString();
 for(const [n,kind]of ['TARGET','ENCRYPTION_KEY','RETENTION','VERIFICATION'].entries()){
  const snapshot={kind,displayName:'보호 '+kind,spec:kind==='RETENTION'?{automaticDeletion:false}:kind==='VERIFICATION'?{checks:['FILE_HASH'],limitsRef:{id:id(90),version:1,contentHash:'a'.repeat(64)}}:{installationResourceRef:{id:id(80+n),version:1,contentHash:'a'.repeat(64)}},reason:'보호 metadata 대역'},rid=id(10+n);
  refs.push({ref:{id:rid,version:1,contentHash:contentHash(canonicalJson({projectId:pid,id:rid,version:1,snapshot,previousRef:null}))},snapshot,previousRef:null,createdAt:now,commandRecordId:id(40+n),clientCommandId:id(50+n),operationId:id(60+n),auditEventId:id(70+n),current:{eligible:kind!=='RETENTION',reasonCodes:[],observedAt:now}});
 }
 const calls:{path:string;method:string}[]=[];
 try{
  f.api.transport=async(path:any,options:any)=>{const url=String(path);calls.push({path:url,method:options?.method??'GET'});assert.notEqual(options?.method,'POST');
   if(url.endsWith('/'+pid))return Response.json({id:pid,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:1,status:'HELD'}});
   if(url.includes('/backup-references?')){const kind=new URL(url,'https://anvil.invalid').searchParams.get('kind');return Response.json({items:refs.filter(v=>v.snapshot.kind===kind),hasMore:false,nextCursor:null,observedAt:now});}
   const found=refs.find(v=>url.includes('/'+v.ref.id+'/'));assert(found,url);return Response.json(found);
  };
  await f.click('새 수동 정책 작성');assert.equal(calls.length,0);
  for(const [n,field]of ui.policyApi.policyFields.entries()){
   await f.change('정책 보호참조 종류',field);await f.click('정책 보호참조 목록 조회');
   const label=refs[n].snapshot.displayName+' · v1 정확 선택';const end=Date.now()+1500;while(!f.text().includes(label)&&Date.now()<end)await ui.React.act(async()=>{await new Promise(r=>setTimeout(r,2));});
   await f.click(label);await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});
  }
  await f.change('수동 정책 이유','정확 정책 범위');await f.change('수동 정책 한도 bytes','1024');await f.change('수동 정책 범위 확인',true);await f.click('수동 정책 원명령 준비');
  const end=Date.now()+1500;while(!f.text().includes('BACKUP_POLICY_COVERAGE_UNAVAILABLE')&&Date.now()<end)await ui.React.act(async()=>{await new Promise(r=>setTimeout(r,2));});
  assert.match(f.text(),/BACKUP_POLICY_COVERAGE_UNAVAILABLE/);assert.equal(f.buffer().pending,null);assert(calls.every(c=>c.method==='GET'));assert.equal(calls.filter(c=>c.path.includes('/versions/')).length,8);
 }finally{await f.close();}
});

test('실Panel APPLIED 뒤 fixed403/401은 UNKNOWN·원body·재확인만 남기고 현재401만 인증상실을 알린다',async()=>{for(const mode of ['403','401','OLD401']){const f=await fixture();let posts=0,release!:(r:Response)=>void;try{
 const now=new Date().toISOString();f.api.transport=async(path:any,options:any)=>{if(options?.method==='POST'){posts++;const c=JSON.parse(options.body),snapshot={policy:c.payload.policy,reason:c.payload.reason},ref={id:id(50),version:1,contentHash:contentHash(canonicalJson({projectId:pid,id:id(50),version:1,snapshot,previousRef:null}))};return Response.json({commandId:c.commandId,operationId:id(52),projectId:pid,status:'APPLIED',targetId:ref.id,version:1,data:{status:'BACKUP_POLICY_STORED',ref,previousRef:null,backupCreated:false,executionAuthorized:false},evidenceRefs:[],warnings:[],serverReceivedAt:now});}if(String(path).includes('/backup-policies/')){if(mode==='OLD401')return new Promise<Response>(r=>release=r);return Response.json({code:'NOT_FOUND'},{status:Number(mode)});}return Response.json({id:pid,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:1,status:'HELD'}});};
 await f.seed(policyPending(f.api));const original=f.buffer().pending.body;await f.click('같은 수동 정책 명령 저장·재확인');
 const end=Date.now()+1500;while((mode==='OLD401'?!release:!f.buffer().failure)&&Date.now()<end)await ui.React.act(async()=>{await new Promise(r=>setTimeout(r,2));});
 if(mode==='OLD401'){await f.render({...f.props(),session:{...session,user:{id:id(99)}}});release(Response.json({code:'AUTH_REQUIRED'},{status:401}));await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});}
 assert.equal(posts,1);assert.equal(f.buffer().pending.state,'UNKNOWN');assert.equal(f.buffer().uncertain,true);assert.equal(f.buffer().pending.body,original);assert.equal(f.lost(),mode==='401'?1:0);
 if(mode!=='OLD401'){assert(!f.button('같은 수동 정책 명령 저장·재확인').disabled);assert(!f.text().includes('정책 거절 확인 후 수정'));}
 }finally{release?.(Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.close();}}});
