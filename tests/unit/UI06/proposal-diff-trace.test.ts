import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {documentTextDiff} from '../../../apps/server/modules/documents/document-diff.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
/** 실제 ReactDOM의 요소/이벤트/effect를 실행하는 최소 메모리 DOM. 레이아웃·브라우저 보안·시각 검증은 아니다. */
class MemoryNode{
 nodeType:number;nodeName:string;tagName:string;localName:string;namespaceURI='http://www.w3.org/1999/xhtml';parentNode:MemoryNode|null=null;childNodes:MemoryNode[]=[];ownerDocument:any;attributes=new Map<string,string>();style:Record<string,unknown>={};listeners=new Map<string,Function[]>();value='';checked=false;disabled=false;data='';
 constructor(name:string,type=1,owner?:any){this.nodeType=type;this.nodeName=type===1?name.toUpperCase():name;this.tagName=this.nodeName;this.localName=name;this.ownerDocument=owner;}
 get options():MemoryNode[]{return this.childNodes.flatMap(n=>n.tagName==='OPTION'?[n]:n.options);}
 get firstChild():MemoryNode|null{return this.childNodes[0]??null;}get lastChild():MemoryNode|null{return this.childNodes.at(-1)??null;}get nextSibling():MemoryNode|null{const a=this.parentNode?.childNodes;return a?.[a.indexOf(this)+1]??null;}
 get textContent():string{return this.nodeType===3?this.data:this.childNodes.map(n=>n.textContent).join('');}
 get nodeValue():string|null{return this.nodeType===3?this.data:null;}set nodeValue(value:string|null){if(this.nodeType===3)this.data=value??'';}
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
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/design-trace/MaterialLibrary.tsx',import.meta.url));
 const api=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url));
 const result:any=await build({configFile:false,envFile:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:trace-artifact',name:'TraceArtifactTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'trace-memory-entry',resolveId(id){if(id.endsWith('virtual:trace-artifact'))return '\0trace-artifact';},load(id){if(id==='\0trace-artifact')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{MaterialLibrary}from${JSON.stringify(entry)};import{DocumentEditor}from${JSON.stringify(entry.replace('MaterialLibrary.tsx','DocumentEditor.tsx'))};import{ApiClient}from${JSON.stringify(api)};export{React,createRoot,MaterialLibrary,DocumentEditor,ApiClient};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return TraceArtifactTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,pid=id(1),uid=id(2),cid=id(3),at='2026-11-17T00:00:00Z',session={user:{id:uid},clientId:cid,csrfToken:'C'.repeat(43)};
const H=(v:unknown)=>contentHash(canonicalJson(v));
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}
function data(){
 const files=new Map<string,string>(),file=(n:number,text:string,mediaType='text/plain;charset=utf-8')=>{const ref={artifactId:id(n),bytes:Buffer.byteLength(text),contentHash:contentHash(Buffer.from(text)),mediaType};files.set(ref.artifactId,text);return ref;};
 const old='원 본문\n',next='제안 본문\n',formRef={id:id(4),version:1,contentHash:'f'.repeat(64)},before={body:file(5,old),attachments:[],sections:[],sourceRefs:[]},after={body:file(6,next),attachments:[],sections:[],sourceRefs:[]};
 const baseRef={id:id(7),version:2,contentHash:H({title:'원문',formRef,stageNodeRef:null,content:before})};
 const diff={...documentTextDiff(old,next),baseRef,baseBodyRef:before.body,proposedBodyRef:after.body,beforeContent:before,afterContent:after};
 const proposal={id:id(8),baseRef,proposedContentRef:after.body,diffRef:file(9,canonicalJson(diff),'application/json;charset=utf-8'),status:'PENDING',proposedContent:after,reason:'사람의 제안',createdAt:at,proposedBy:uid,selections:[]};
 const document={...baseRef,title:'원문',formRef,stageNodeRef:null,content:before,sourceRefs:[],confirmed:false,validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[]};
 const designRef={id:id(10),version:1,contentHash:'d'.repeat(64)};
 const task={taskCode:'FN01',type:'FUNCTION',title:'고정 업무',purpose:'수행',designRefs:[],screenRefs:[],ownerRole:'작업자',inputs:[],outputs:[],included:[],excluded:[],allowedFileRefs:[],startPrerequisites:[],acceptancePrerequisites:[],steps:[],acceptanceCriteria:[],evidenceRequirements:[],testCases:[],rollback:'복구',recoveryNotes:'기록'};
 const planSnapshot={documentRef:baseRef,designRef,screenReviewRefs:[],tasks:[task],dependencies:[],reason:'계획',issues:[],relationalProjection:'STORED'};
 const plan={ref:{id:id(11),version:3,contentHash:H(planSnapshot)},status:'DRAFT',...planSnapshot,executionEvidence:'NOT_CONNECTED',observedAt:at};
 return{files,proposal,document,plan,diff,designRef,old,next,baseRef};
}
async function fixture(){
 const d=data(),calls:{path:string;method:string;body?:string}[]=[],controls={lose:false,receiptFault:'',generation:4,hook:null as null|((path:string,options?:RequestInit)=>Promise<Response|null>|Response|null)};let lost=0,latest:any=null,external:any;
 const transport:typeof fetch=async(path,options)=>{const p=String(path),method=options?.method??'GET',body=typeof options?.body==='string'?options.body:undefined;calls.push({path:p,method,body});const intercepted=await controls.hook?.(p,options);if(intercepted)return intercepted;
 if(method==='POST'){assert.equal(p,`/api/v1/projects/${pid}/commands`);const c=JSON.parse(body!);assert.equal(c.operation,'linkTrace');assert.equal(c.projectId,pid);assert.equal(c.clientId,cid);assert.equal(c.controlGeneration,4);assert.equal(c.targetId,null);assert.equal(c.expectedVersion,0);assert.deepEqual(c.baselineRefs,[]);assert.equal(c.approvalRef,null);assert.deepEqual(c.payload,{from:{kind:'ARTIFACT',id:d.proposal.diffRef.artifactId,versionRef:{id:d.proposal.diffRef.artifactId,version:1,contentHash:d.proposal.diffRef.contentHash}},to:{kind:'PLAN_TASK',id:d.plan.ref.id,versionRef:d.plan.ref,localCode:'FN01'},relation:'IMPLEMENTS',reason:'변경 구간을 업무에 연결'});
 const snapshot={...c.payload,designRefs:[d.designRef]},edge={id:id(20),...snapshot,edgeHash:H(snapshot),createdAt:at},ref={id:edge.id,version:1,contentHash:edge.edgeHash};
 if(controls.lose){controls.lose=false;throw Error('RAM 응답 유실');}
 if(controls.receiptFault==='HASH')edge.edgeHash='a'.repeat(64);
 if(controls.receiptFault==='TASK'){edge.to.localCode='FN02';edge.edgeHash=H({...snapshot,to:edge.to});ref.contentHash=edge.edgeHash;}
 return Response.json({commandId:controls.receiptFault==='COMMAND'?id(29):c.commandId,projectId:pid,status:'APPLIED',operationId:id(21),serverReceivedAt:at,targetId:edge.id,version:1,data:{status:'TRACE_LINKED',ref,edge}});
 }
 if(p.includes('/imports?'))return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:at});
 if(p.includes('/proposals?'))return Response.json({items:[{id:d.proposal.id,baseRef:d.baseRef,title:'보관 제안',status:'PENDING',proposedContentRef:d.proposal.proposedContentRef,diffRef:d.proposal.diffRef,integrity:'NOT_RECHECKED',createdAt:at}],hasMore:false,nextCursor:null,observedAt:at});
 if(p.endsWith('/proposals/'+d.proposal.id))return Response.json(d.proposal);
 if(p.includes('/documents/'))return Response.json(d.document);
 if(p.includes('/files/')){const text=d.files.get(p.split('/').at(-1)!);assert.notEqual(text,undefined);return new Response(Buffer.from(text!),{headers:{'content-type':'application/octet-stream'}});}
 if(p.includes('/work-plans?'))return Response.json({items:[{ref:d.plan.ref,status:'DRAFT',title:'고정 계획',documentRef:d.plan.documentRef,designRef:d.designRef,issueCount:0,updatedAt:at,integrity:'NOT_RECHECKED'}],hasMore:false,nextCursor:null,observedAt:at});
 if(p.includes('/work-plans/'))return Response.json(d.plan);
 if(p===`/api/v1/projects/${pid}`)return Response.json({id:pid,participation:'OWNER',controlState:{actorId:uid,clientId:cid,generation:controls.generation,status:'HELD'}});
 throw Error('UNMODELED_PROPOSAL_TRACE:'+p);
 };
 const client=new ui.ApiClient(transport),container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);let props={client,projectId:pid,session};
 function Parent(p:typeof props){const[b,setB]=ui.React.useState(null),[busy,setBusy]=ui.React.useState(false);latest=b;external=setB;return b?ui.React.createElement(ui.DocumentEditor,{client:p.client,session:p.session,buffer:b,onChange:setB,onSaved:()=>{throw Error('문서 저장 금지');},onAuthenticationLost:()=>{lost++;}}):ui.React.createElement(ui.MaterialLibrary,{...p,canPrepare:!busy,onPrepared:setB,onBusy:setBusy,onAuthenticationLost:()=>{lost++;}});}
 const nodes=(n=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))];
 const button=(label:string)=>{const found=nodes().filter(n=>n.tagName==='BUTTON'&&(n.textContent===label||n.getAttribute('aria-label')===label));assert.equal(found.length,1,label+' / '+container.textContent);return found[0]!;};
 const render=async(next=props)=>{props=next;await ui.React.act(async()=>root.render(ui.React.createElement(Parent,props)));};
 const click=async(label:string)=>{const n=button(label);assert(!n.disabled,label);await ui.React.act(async()=>n.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const change=async(label:string,value:string)=>{const n=nodes().find(n=>n.getAttribute('aria-label')===label);assert(n,label);const k=Object.keys(n).find(k=>k.startsWith('__reactProps'))!;await ui.React.act(async()=>((n as any)[k].onChange({target:{value}})));};
 const settle=async()=>{await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});};
 const wait=async(check:()=>boolean)=>{for(let n=0;!check()&&n<100;n++)await ui.React.act(async()=>{await new Promise(r=>setTimeout(r,2));});assert(check(),container.textContent);};
 const close=async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);};
 await render();await wait(()=>container.textContent.includes('보관 제안'));
 return{d,client,calls,controls,props:()=>props,buffer:()=>latest,lost:()=>lost,render,click,change,settle,wait,close,text:()=>container.textContent,button,setBuffer:async(f:any)=>ui.React.act(async()=>external(f)),open:async()=>{await click('보관 제안 '+d.proposal.id+' 열기');await wait(()=>container.textContent.includes('보관 제안 변경 구간')||nodes().some(n=>n.getAttribute('aria-label')==='보관 제안 변경 구간'));}};
}
test('보관 제안에서 명시 diff 업무 연결 준비는 실제 Editor로 이어지고 POST0이다',async()=>{const f=await fixture();try{
 await f.open();await f.click('서버 생성 diff를 고정 업무에 연결');await f.wait(()=>!!f.buffer()?.proposalState?.diffTrace);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);assert.match(f.text(),/문서 제안 diff와 고정 업무 연결/);assert.equal(f.buffer().proposalState.proposal.diffRef.artifactId,f.d.proposal.diffRef.artifactId);
 }finally{await f.close();}});

async function choose(f:Awaited<ReturnType<typeof fixture>>,version='3'){
 await f.open();await f.click('서버 생성 diff를 고정 업무에 연결');await f.wait(()=>!!f.buffer()?.proposalState?.diffTrace);
 assert.equal(f.calls.filter(c=>c.path.includes('/work-plans')).length,0);
 await f.click('고정 계획 목록 조회');await f.wait(()=>f.text().includes('계획 선택'));
 await f.change('연결할 고정 계획',f.d.plan.ref.id);await f.change('연결할 계획 버전',version);await f.click('선택한 계획 버전 읽기');await f.wait(()=>!!f.buffer()?.proposalState?.diffTrace.planRef);
 await f.change('연결할 고정 업무','FN01');await f.change('제안 diff 연결 사유','변경 구간을 업무에 연결');
}
async function prepare(f:Awaited<ReturnType<typeof fixture>>){await choose(f);await f.click('원문·고정 업무 대조 후 연결 준비');await f.wait(()=>!!f.buffer()?.proposalState?.diffTrace.pending);}
test('보관 제안→고정 버전·업무→명령 준비 POST0→응답유실→같은원명령 재확인/정확edge를 보존한다',async()=>{
 const f=await fixture();try{await prepare(f);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);const command=structuredClone(f.buffer().proposalState.diffTrace.pending);
 f.controls.lose=true;await f.click('제안 diff 업무 연결 저장');await f.wait(()=>f.buffer()?.proposalState?.diffTrace.failure?.code==='CONNECTION_LOST');
 assert.equal(f.buffer().proposalState.diffTrace.uncertain,true);assert.deepEqual(f.buffer().proposalState.diffTrace.pending,command);assert(f.button('diff 연결 작업 닫기').disabled);const first=f.calls.filter(c=>c.method==='POST')[0]!.body;await f.settle();assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
 await f.click('같은 diff 연결 명령 결과 확인');await f.wait(()=>!!f.buffer()?.proposalState?.diffTrace.result);
 assert.equal(f.calls.filter(c=>c.method==='POST').length,2);assert.equal(f.calls.filter(c=>c.method==='POST')[1]!.body,first);assert.deepEqual(f.buffer().proposalState.diffTrace.result.from,command.payload.from);assert.deepEqual(f.buffer().proposalState.diffTrace.result.to,command.payload.to);assert.equal(f.buffer().proposalState.diffTrace.uncertain,false);assert.equal(f.buffer().savedRef,null);assert.equal(f.buffer().proposalState.applyCommand,null);assert.match(f.text(),/실제 Git diff·시험 출처·구현 완료의 증거가 아닙니다/);
 }finally{await f.close();}
});
for(const fault of ['HASH','TASK','COMMAND'])test('제안 diff 연결 '+fault+' 영수증은 성공으로 채택하지 않고 원명령 UNKNOWN 보존',async()=>{
 const f=await fixture();try{await prepare(f);const c=structuredClone(f.buffer().proposalState.diffTrace.pending);f.controls.receiptFault=fault;await f.click('제안 diff 업무 연결 저장');await f.wait(()=>!!f.buffer()?.proposalState?.diffTrace.failure);assert.equal(f.buffer().proposalState.diffTrace.result,null);assert.equal(f.buffer().proposalState.diffTrace.uncertain,true);assert.deepEqual(f.buffer().proposalState.diffTrace.pending,c);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);}finally{await f.close();}
});
for(const fault of ['DIFF_HASH','DIFF_END','BASE_HASH','PROPOSAL_ID','PLAN_HASH','PLAN_VERSION','TASK_MISSING','AMBIGUOUS','GENERATION'])test('원 diff/계획 '+fault+' 변경은 연결명령 준비/POST0',async()=>{
 const f=await fixture();try{await choose(f);
 f.controls.hook=(path)=>{
  if(fault==='GENERATION'){f.controls.generation=5;return null;}
  if(path.endsWith('/proposals/'+f.d.proposal.id)&&fault==='PROPOSAL_ID')return Response.json({...f.d.proposal,id:id(30)});
  if(path.endsWith('/files/'+f.d.proposal.diffRef.artifactId)&&fault==='DIFF_HASH')return new Response('변조',{headers:{'content-type':'application/octet-stream'}});
  if(fault==='DIFF_END'){const diff={...f.d.diff,after:['다른 원문']},text=canonicalJson(diff),p={...f.d.proposal,diffRef:{...f.d.proposal.diffRef,bytes:Buffer.byteLength(text),contentHash:contentHash(Buffer.from(text))}};if(path.endsWith('/proposals/'+p.id))return Response.json(p);if(path.endsWith('/files/'+p.diffRef.artifactId))return new Response(text,{headers:{'content-type':'application/octet-stream'}});}
  if(path.includes('/documents/')&&fault==='BASE_HASH')return Response.json({...f.d.document,contentHash:'b'.repeat(64)});
  if(path.includes('/work-plans/')){const p=structuredClone(f.d.plan);if(fault==='PLAN_HASH')p.ref.contentHash='a'.repeat(64);if(fault==='PLAN_VERSION')p.ref.version=2;if(fault==='TASK_MISSING'||fault==='AMBIGUOUS'){p.tasks=fault==='TASK_MISSING'?[]:[p.tasks[0]!,p.tasks[0]!];const{ref,status,executionEvidence,observedAt,...snapshot}=p;p.ref.contentHash=H(snapshot);}return Response.json(p);}
  return null;
 };
 await f.click('원문·고정 업무 대조 후 연결 준비');await f.wait(()=>f.text().includes('자동 재전송하지 않습니다'));assert.equal(f.buffer().proposalState.diffTrace.pending,null);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
 }finally{await f.close();}
});
for(const status of [401,403,412])test('현재 보호 거절 '+status+'는 원 pending/실패를 보존하고 승인/명령을 우회하지 않는다',async()=>{
 const f=await fixture();try{await prepare(f);const c=structuredClone(f.buffer().proposalState.diffTrace.pending);f.controls.hook=(_p,o)=>o?.method==='POST'?Response.json({code:status===412?'APPROVAL_REQUIRED':'ACCESS_DENIED'},{status}):null;
 await f.click('제안 diff 업무 연결 저장');await f.wait(()=>!!f.buffer()?.proposalState?.diffTrace.failure);assert.deepEqual(f.buffer().proposalState.diffTrace.pending,c);assert.equal(f.buffer().proposalState.diffTrace.result,null);assert.equal(f.buffer().proposalState.diffTrace.uncertain,false);assert.equal(f.lost(),status===401?1:0);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);if(status===403)assert(!f.text().includes('ANVIL_TEXT_DIFF_1'));
 }finally{await f.close();}
});
for(const change of ['USER','CLIENT_ID','CSRF','CLIENT','TRANSPORT','BUFFER','ABA','UNMOUNT']as const)for(const status of [200,401])test('저장중 '+change+' 뒤 지연'+status+'는 새buffer/인증효과0',async()=>{
 const f=await fixture(),gate=deferred<Response>();let closed=false;try{await prepare(f);const originalBuffer=f.buffer(),c=structuredClone(originalBuffer.proposalState.diffTrace.pending),originalProps=f.props();let entered=false;
 f.controls.hook=(_p,o)=>o?.method==='POST'?(entered=true,gate.promise):null;await f.click('제안 diff 업무 연결 저장');await f.wait(()=>entered);const retained=f.buffer();assert(retained.proposalState.diffTrace.uncertain);
 if(change==='USER')await f.render({...originalProps,session:{...session,user:{id:id(31)}}});
 if(change==='CLIENT_ID')await f.render({...originalProps,session:{...session,clientId:id(32)}});
 if(change==='CSRF')await f.render({...originalProps,session:{...session,csrfToken:'D'.repeat(43)}});
 if(change==='CLIENT')await f.render({...originalProps,client:new ui.ApiClient(f.client.transport)});
 if(change==='TRANSPORT'){f.client.transport=async()=>{throw Error('새 transport 금지');};await f.render(originalProps);}
 if(change==='BUFFER')await f.setBuffer((b:any)=>({...b,proposalState:{...b.proposalState,bindingId:id(33)}}));
 if(change==='ABA'){await f.setBuffer((b:any)=>({...b,proposalState:{...b.proposalState,bindingId:id(33)}}));await f.setBuffer(()=>retained);}
 if(change==='UNMOUNT'){await f.close();closed=true;}
 const data={...c.payload,designRefs:[f.d.designRef]},edge={id:id(20),...data,edgeHash:H(data),createdAt:at};
 gate.resolve(status===401?Response.json({code:'AUTH_REQUIRED'},{status}):Response.json({commandId:c.commandId,projectId:pid,status:'APPLIED',operationId:id(21),serverReceivedAt:at,targetId:edge.id,version:1,data:{status:'TRACE_LINKED',ref:{id:edge.id,version:1,contentHash:edge.edgeHash},edge}}));
 await f.settle();assert.equal(f.lost(),0);assert.equal(f.buffer().proposalState.diffTrace.result,null);assert.equal(f.buffer().proposalState.diffTrace.uncertain,true);assert.deepEqual(f.buffer().proposalState.diffTrace.pending,c);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
 }finally{gate.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));if(!closed)await f.close();}
});
test('동일명령 재진입도 명시 클릭 전 자동POST0이며 다른 프로젝트 이식은 준비거절',async()=>{
 const f=await fixture();try{await prepare(f);const original=f.buffer(),m=await import('../../../apps/web/src/features/design-trace/proposal-diff-trace.ts');await assert.rejects(m.sendProposalDiffTrace(f.client,session,{...original,projectId:id(40)},()=>true),{code:'PROPOSAL_TRACE_INVALID'});assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
 await f.setBuffer((b:any)=>({...b}));await f.settle();assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
 }finally{await f.close();}
});
function traceView(edge:any,designRef:any){return{designRef,direction:'FORWARD',nodes:[{ref:edge.from,title:'서버 제안 diff',designRefs:[]},{ref:edge.to,title:'고정 업무',designRefs:[designRef]}],edges:[edge],traversal:[{edgeId:edge.id,from:edge.from,to:edge.to}],missingLinks:[],unknownEvidence:[{code:'EXECUTION_SOURCE_NOT_CONNECTED'},{code:'TEST_EVIDENCE_SOURCE_NOT_CONNECTED'}],baselineRef:null,hasMore:false,nextCursor:null,observedAt:at};}
test('저장 후 명시 버튼만 기존 traces GET1을 호출하고 저장 edge/hash를 재검산한다',async()=>{
 const f=await fixture();try{await prepare(f);await f.click('제안 diff 업무 연결 저장');await f.wait(()=>!!f.buffer()?.proposalState?.diffTrace.result);const edge=structuredClone(f.buffer().proposalState.diffTrace.result);
 assert.equal(f.calls.filter(c=>c.path.includes('/traces?')).length,0);f.controls.hook=p=>p.includes('/traces?')?Response.json(traceView(edge,f.d.designRef)):null;
 await f.click('저장한 diff 연결 조회');await f.wait(()=>f.text().includes('연결 '+edge.id+' · SHA256 '+edge.edgeHash));assert.equal(f.calls.filter(c=>c.path.includes('/traces?')).length,1);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
 f.controls.hook=p=>p.includes('/traces?')?Response.json(traceView({...edge,edgeHash:'b'.repeat(64)},f.d.designRef)):null;await f.click('업무 연결 새로고침');await f.wait(()=>f.text().includes('TRACE_INTEGRITY_FAILED'));assert(!f.text().includes('연결 '+edge.id+' · SHA256'));assert.deepEqual(f.buffer().proposalState.diffTrace.result,edge);
 }finally{await f.close();}
});
test('명시한 과거 계획 v2는 목록 head v3와 구분하여 정확 v2/hash로 연결 준비한다',async()=>{
 const f=await fixture();try{const prior=structuredClone(f.d.plan);prior.ref.version=2;prior.reason='이전 고정 계획';const{ref,status,executionEvidence,observedAt,...snapshot}=prior;prior.ref.contentHash=H(snapshot);
 f.controls.hook=p=>p.includes('/work-plans/')&&p.endsWith('/versions/2')?Response.json(prior):null;await choose(f,'2');await f.click('원문·고정 업무 대조 후 연결 준비');await f.wait(()=>!!f.buffer()?.proposalState?.diffTrace.pending);assert.deepEqual(f.buffer().proposalState.diffTrace.pending.payload.to.versionRef,prior.ref);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);assert(!f.calls.some(c=>c.path.includes('/work-plans/')&&c.path.endsWith('/versions/3')));
 }finally{await f.close();}
});
for(const fault of ['TASK_MISSING','AMBIGUOUS'])test('선택 hash 자체가 일치해도 '+fault+' 업무는 명령 발급0',async()=>{
 const f=await fixture();try{await choose(f);const plan=structuredClone(f.d.plan);plan.tasks=fault==='TASK_MISSING'?[]:[plan.tasks[0]!,plan.tasks[0]!];const{ref,status,executionEvidence,observedAt,...snapshot}=plan;plan.ref.contentHash=H(snapshot);const b=structuredClone(f.buffer());b.proposalState.diffTrace.planRef=plan.ref;f.controls.hook=p=>p.includes('/work-plans/')?Response.json(plan):null;
 const m=await import('../../../apps/web/src/features/design-trace/proposal-diff-trace.ts');await assert.rejects(m.prepareProposalDiffTrace(f.client,session,b,()=>true));assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
 }finally{await f.close();}
});
for(const fault of ['DIFF','TASK','GENERATION','PROJECT'])test('보존 명령 '+fault+' 변조는 POST 전 거절',async()=>{
 const f=await fixture();try{await prepare(f);const b=structuredClone(f.buffer()),c=b.proposalState.diffTrace.pending;if(fault==='DIFF')c.payload.from.versionRef.contentHash='b'.repeat(64);if(fault==='TASK')c.payload.to.localCode='FN02';if(fault==='GENERATION')c.controlGeneration=5;if(fault==='PROJECT')c.projectId=id(40);
 const m=await import('../../../apps/web/src/features/design-trace/proposal-diff-trace.ts');await assert.rejects(m.sendProposalDiffTrace(f.client,session,b,()=>true),{code:'PROPOSAL_TRACE_INVALID'});assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
 }finally{await f.close();}
});
for(const stage of ['PREPARE','TRACE'])for(const status of [200,401])test(stage+' GET 지연'+status+'는 CSRF 교체 후 결과/인증효과0',async()=>{
 const f=await fixture(),gate=deferred<Response>();try{let entered=false;if(stage==='PREPARE'){await f.open();f.controls.hook=p=>p.endsWith('/proposals/'+f.d.proposal.id)?(entered=true,gate.promise):null;await f.click('서버 생성 diff를 고정 업무에 연결');}else{await prepare(f);await f.click('제안 diff 업무 연결 저장');await f.wait(()=>!!f.buffer()?.proposalState?.diffTrace.result);f.controls.hook=p=>p.includes('/traces?')?(entered=true,gate.promise):null;await f.click('저장한 diff 연결 조회');}
 await f.wait(()=>entered);const count=f.calls.length,edge=stage==='TRACE'?structuredClone(f.buffer().proposalState.diffTrace.result):null;await f.render({...f.props(),session:{...session,csrfToken:'D'.repeat(43)}});gate.resolve(status===401?Response.json({code:'AUTH_REQUIRED'},{status}):Response.json(stage==='PREPARE'?f.d.proposal:traceView(edge,f.d.designRef)));await f.settle();assert.equal(f.lost(),0);assert.deepEqual(f.calls.slice(count).filter(c=>!c.path.includes('/imports?')&&!c.path.includes('/proposals?')),[]);if(stage==='PREPARE')assert.equal(f.buffer(),null);else assert(!f.text().includes('연결 '+edge.id+' · SHA256'));
 }finally{gate.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.close();}
});
