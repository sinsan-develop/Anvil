import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {documentTextDiff} from '../../../apps/server/modules/documents/document-diff.ts';
import {buildOfficialForms} from '../../../apps/server/modules/documents/forms.ts';
import type {DocumentVersion} from '../../../apps/web/src/features/design-trace/api.ts';
import type {DocumentReviewCommand} from '../../../apps/web/src/features/design-trace/review-api.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {parseRoute,documentVersionHref} from '../../../apps/web/src/shell/routes.ts';
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
 const result:any=await build({configFile:false,envFile:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:trace-artifact',name:'TraceArtifactTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'trace-memory-entry',resolveId(id){if(id.endsWith('virtual:trace-artifact'))return '\0trace-artifact';},load(id){if(id==='\0trace-artifact')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{MaterialLibrary}from${JSON.stringify(entry)};import{DocumentEditor}from${JSON.stringify(entry.replace('MaterialLibrary.tsx','DocumentEditor.tsx'))};import{ApiClient}from${JSON.stringify(api)};import{DocumentsPage}from${JSON.stringify(entry.replace('MaterialLibrary.tsx','DocumentsPage.tsx'))};export{React,createRoot,MaterialLibrary,DocumentEditor,DocumentsPage,ApiClient};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:',hash:''}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,location:window.location,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return TraceArtifactTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,pid=id(1),uid=id(2),cid=id(3),at='2026-11-17T00:00:00Z',session={user:{id:uid},clientId:cid,csrfToken:'C'.repeat(43)};
const H=(v:unknown)=>contentHash(canonicalJson(v));
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}
function data(coverage=false,formCode='AF02'){
 const files=new Map<string,string>(),file=(n:number,text:string,mediaType='text/plain;charset=utf-8')=>{const ref={artifactId:id(n),bytes:Buffer.byteLength(text),contentHash:contentHash(Buffer.from(text)),mediaType};files.set(ref.artifactId,text);return ref;};
 const standard='작성 기준',authoringStandardRef={id:id(41),version:1,contentHash:contentHash(Buffer.from(standard))};
 const items=[['PRESENT','작성한 필수 항목',true],['EMPTY','빈 필수 항목',true],['MISSING','연결하지 않은 필수 항목',true],['OPTIONAL','선택 항목',false]]
  .map(([itemId,title,required])=>({itemId,title,required,repeated:false,valueType:'TEXT',authoringRules:['작성'],reviewCriteria:['검토'],fields:[]}));
 const definition={scope:'SYSTEM',formCode,name:formCode==='AF04'?'작업계획 양식':'설계 양식',purpose:'구조 확인',authorRole:'작성자',reviewerRole:'검토자',confirmerRole:'확정자',requiredInputs:['설계'],items,authoringStandardRef};
 const formRef={id:id(4),version:1,contentHash:coverage?H(definition):'f'.repeat(64)};
 const form={ref:formRef,definition,authoringStandard:{ref:authoringStandardRef,content:standard},validation:{formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'}};
 const complete=coverage&&formCode==='AF04';
 const old='원 본문\n',next=complete?'본문 1\n본문 2\n본문 3\n':coverage?'필수 본문\r\n  \r\n선택 본문\r\n':'제안 본문\n';
 const sections=complete?[{itemId:'PRESENT',anchor:'line:1'},{itemId:'EMPTY',anchor:'line:2'},{itemId:'MISSING',anchor:'line:3'}]:coverage?[{itemId:'OPTIONAL',anchor:'line:3'},{itemId:'EMPTY',anchor:'line:2'},{itemId:'PRESENT',anchor:'line:1'}]:[];
 const before={body:file(5,old),attachments:[],sections:[],sourceRefs:[]},after={body:file(6,next),attachments:[],sections,sourceRefs:[]};
 const baseRef={id:id(7),version:2,contentHash:H({title:'원문',formRef,stageNodeRef:null,content:before})};
 const diff={...documentTextDiff(old,next),baseRef,baseBodyRef:before.body,proposedBodyRef:after.body,beforeContent:before,afterContent:after};
 const proposal={id:id(8),baseRef,proposedContentRef:after.body,diffRef:file(9,canonicalJson(diff),'application/json;charset=utf-8'),status:'PENDING',proposedContent:after,reason:'사람의 제안',createdAt:at,proposedBy:uid,selections:[]};
 const document={...baseRef,title:'원문',formRef,stageNodeRef:null,content:before,sourceRefs:[],confirmed:false,validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[]};
 const designRef={id:id(10),version:1,contentHash:'d'.repeat(64)};
 const task={taskCode:'FN01',type:'FUNCTION',title:'고정 업무',purpose:'수행',designRefs:[],screenRefs:[],ownerRole:'작업자',inputs:[],outputs:[],included:[],excluded:[],allowedFileRefs:[],startPrerequisites:[],acceptancePrerequisites:[],steps:[],acceptanceCriteria:[],evidenceRequirements:[],testCases:[],rollback:'복구',recoveryNotes:'기록'};
 const planSnapshot={documentRef:baseRef,designRef,screenReviewRefs:[],tasks:[task],dependencies:[],reason:'계획',issues:[],relationalProjection:'STORED'};
 const plan={ref:{id:id(11),version:3,contentHash:H(planSnapshot)},status:'DRAFT',...planSnapshot,executionEvidence:'NOT_CONNECTED',observedAt:at};
 return{files,proposal,document,plan,diff,designRef,old,next,baseRef,form};
}
async function fixture(coverage=false,formCode='AF02',selectionJourney=false){
 const d=data(coverage,formCode),calls:{path:string;method:string;body?:string}[]=[],controls={lose:false,receiptFault:'',generation:4,hook:null as null|((path:string,options?:RequestInit)=>Promise<Response|null>|Response|null)};let lost=0,latest:any=null,external:any;
 const transport:typeof fetch=async(path,options)=>{const p=String(path),method=options?.method??'GET',body=typeof options?.body==='string'?options.body:undefined;calls.push({path:p,method,body});const intercepted=await controls.hook?.(p,options);if(intercepted)return intercepted;
 if(method==='POST'){assert.equal(p,`/api/v1/projects/${pid}/commands`);const c=JSON.parse(body!);assert.equal(c.operation,'linkTrace');assert.equal(c.projectId,pid);assert.equal(c.clientId,cid);assert.equal(c.controlGeneration,4);assert.equal(c.targetId,null);assert.equal(c.expectedVersion,0);assert.deepEqual(c.baselineRefs,[]);assert.equal(c.approvalRef,null);assert.deepEqual(c.payload,{from:{kind:'ARTIFACT',id:d.proposal.diffRef.artifactId,versionRef:{id:d.proposal.diffRef.artifactId,version:1,contentHash:d.proposal.diffRef.contentHash}},to:{kind:'PLAN_TASK',id:d.plan.ref.id,versionRef:d.plan.ref,localCode:'FN01'},relation:'IMPLEMENTS',reason:'변경 구간을 업무에 연결'});
 const snapshot={...c.payload,designRefs:[d.designRef]},edge={id:id(20),...snapshot,edgeHash:H(snapshot),createdAt:at},ref={id:edge.id,version:1,contentHash:edge.edgeHash};
 if(controls.lose){controls.lose=false;throw Error('RAM 응답 유실');}
 if(controls.receiptFault==='HASH')edge.edgeHash='a'.repeat(64);
 if(controls.receiptFault==='TASK'){edge.to.localCode='FN02';edge.edgeHash=H({...snapshot,to:edge.to});ref.contentHash=edge.edgeHash;}
 return Response.json({commandId:controls.receiptFault==='COMMAND'?id(29):c.commandId,projectId:pid,status:'APPLIED',operationId:id(21),serverReceivedAt:at,targetId:edge.id,version:1,data:{status:'TRACE_LINKED',ref,edge}});
 }
 if(p.includes('/imports?'))return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:at});
 if(p.includes('/proposals?'))return Response.json({items:(coverage?[d.proposal.id,id(44)]:[d.proposal.id]).map(proposalId=>({id:proposalId,baseRef:d.baseRef,title:'보관 제안',status:'PENDING',proposedContentRef:d.proposal.proposedContentRef,diffRef:d.proposal.diffRef,integrity:'NOT_RECHECKED',createdAt:at})),hasMore:false,nextCursor:null,observedAt:at});
 if(p.endsWith('/proposals/'+d.proposal.id))return Response.json(d.proposal);
 if(coverage&&p.endsWith('/proposals/'+id(44)))return Response.json({...d.proposal,id:id(44)});
 if(p.includes('/documents/'))return Response.json(d.document);
 if(p.includes('/files/')){const text=d.files.get(p.split('/').at(-1)!);assert.notEqual(text,undefined);return new Response(Buffer.from(text!),{headers:{'content-type':'application/octet-stream'}});}
 if(p.includes('/work-plans?'))return Response.json({items:[{ref:d.plan.ref,status:'DRAFT',title:'고정 계획',documentRef:d.plan.documentRef,designRef:d.designRef,issueCount:0,updatedAt:at,integrity:'NOT_RECHECKED'}],hasMore:false,nextCursor:null,observedAt:at});
 if(p.includes('/work-plans/'))return Response.json(d.plan);
 if(p===`/api/v1/projects/${pid}`)return Response.json({id:pid,participation:'OWNER',controlState:{actorId:uid,clientId:cid,generation:controls.generation,status:'HELD'}});
 throw Error('UNMODELED_PROPOSAL_TRACE:'+p);
 };
 const client=new ui.ApiClient(transport),container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);let props={client,projectId:pid,session};
 function Parent(p:typeof props){const[b,setB]=ui.React.useState(null),[busy,setBusy]=ui.React.useState(false);latest=b;external=setB;return b?ui.React.createElement(ui.DocumentEditor,{client:p.client,session:p.session,buffer:b,onChange:setB,onSaved:()=>{if(!selectionJourney)throw Error('문서 저장 금지');setB(null);},onAuthenticationLost:()=>{lost++;}}):ui.React.createElement(ui.MaterialLibrary,{...p,canPrepare:!busy,onPrepared:setB,onBusy:setBusy,onAuthenticationLost:()=>{lost++;}});}
 const nodes=(n=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))];
 const button=(label:string)=>{const found=nodes().filter(n=>n.tagName==='BUTTON'&&(n.textContent===label||n.getAttribute('aria-label')===label));assert.equal(found.length,1,label+' / '+container.textContent);return found[0]!;};
 const render=async(next=props)=>{props=next;await ui.React.act(async()=>root.render(ui.React.createElement(Parent,props)));};
 const click=async(label:string)=>{const n=button(label);assert(!n.disabled,label);await ui.React.act(async()=>n.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const change=async(label:string,value:string)=>{const n=nodes().find(n=>n.getAttribute('aria-label')===label);assert(n,label);const k=Object.keys(n).find(k=>k.startsWith('__reactProps'))!;await ui.React.act(async()=>((n as any)[k].onChange({target:{value}})));};
 const settle=async()=>{await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});};
 const wait=async(check:()=>boolean)=>{for(let n=0;!check()&&n<100;n++)await ui.React.act(async()=>{await new Promise(r=>setTimeout(r,2));});assert(check(),container.textContent);};
 const close=async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);};
 await render();await wait(()=>container.textContent.includes('보관 제안'));
 const openDocument=async(ref:unknown)=>{function Page(){const[b,setB]=ui.React.useState(null),[review,setReview]=ui.React.useState(null);return ui.React.createElement(ui.DocumentsPage,{client,projectId:pid,session,requestedDocument:ref,buffer:b,onChange:setB,review,onReviewChange:setReview,confirmation:null,onConfirmationChange:()=>{throw Error('확정 금지');},onAuthenticationLost:()=>{lost++;}});}await ui.React.act(async()=>root.render(ui.React.createElement(Page)));};
 return{openDocument,d,client,calls,controls,nodes,props:()=>props,buffer:()=>latest,lost:()=>lost,render,click,change,settle,wait,close,text:()=>container.textContent,button,setBuffer:async(f:any)=>ui.React.act(async()=>external(f)),open:async(proposalId=d.proposal.id)=>{await click('보관 제안 '+proposalId+' 열기');await wait(()=>container.textContent.includes('보관 제안 변경 구간')||nodes().some(n=>n.getAttribute('aria-label')==='보관 제안 변경 구간'));}};
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

const coverageAction='고정 양식 필수 항목 확인';
const coveragePath=(f:Awaited<ReturnType<typeof fixture>>)=>`/api/v1/forms/${f.d.form.ref.id}/versions/${f.d.form.ref.version}`;
test('미반영 제안의 고정 양식·실제 구간으로 필수 항목을 확인한다 · 읽기 전용',async()=>{
 const f=await fixture(true);try{
  await f.open();assert.equal(f.calls.filter(c=>c.path.includes('/forms')).length,0);
  const path=coveragePath(f);
  f.controls.hook=(actual,init)=>{
   if(actual!==path)return null;
   assert.equal(init?.method,'GET');assert.equal(init?.credentials,'same-origin');assert.equal(init?.body,undefined);
   return Response.json(f.d.form);
  };
  await f.click(coverageAction);
  await f.wait(()=>f.text().includes('필수 항목 3개 중 2개 누락'));
  assert.match(f.text(),/EMPTY · 빈 필수 항목/);
  assert.match(f.text(),/MISSING · 연결하지 않은 필수 항목/);
  assert.doesNotMatch(f.text(),/PRESENT · 작성한 필수 항목|OPTIONAL · 선택 항목/);
  assert.deepEqual(f.calls.filter(c=>c.path.includes('/forms')).map(c=>c.path),[path]);
  assert.equal(f.buffer(),null);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
 }finally{await f.close();}
});

for (const [fault, code, status] of [
 ['missing','FORM_NOT_FOUND',404],
 ['denied','FORM_ACCESS_DENIED',403],
 ['wrongVersion','RESPONSE_INVALID',200],
 ['wrongDefinition','RESPONSE_INVALID',200],
 ['expired','AUTH_REQUIRED',401],
] as const) test('고정 양식 ' + fault + ' · 다른 양식으로 바꾸지 않는다',async()=>{
 const f=await fixture(true);try{
  await f.open();
  const path=coveragePath(f), form=structuredClone(f.d.form);
  if(fault==='wrongVersion')form.ref.version++;
  if(fault==='wrongDefinition')form.definition.items[0]!.required=false;
  f.controls.hook=p=>p!==path?null:status===200?Response.json(form):Response.json({code},{status});
  await f.click(coverageAction);
  if(status===401)await f.wait(()=>f.lost()===1);
  else {
   await f.wait(()=>f.text().includes('필수 항목 확인 불가 · '+code));
   assert.match(f.text(),/아직 반영하지 않은 제안입니다/);
   assert.equal(f.lost(),0);
  }
  assert.doesNotMatch(f.text(),/개 누락|EMPTY · 빈 필수 항목/);
  assert.deepEqual(f.calls.filter(c=>c.path.includes('/forms')).map(c=>c.path),[path]);
  assert.equal(f.buffer(),null);
  assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
 }finally{await f.close();}
});

test('고정 AF04 양식에서 모든 필수 구간이 작성된 경우 누락 0개를 보여준다',async()=>{
 const f=await fixture(true,'AF04');try{
  await f.open();
  f.controls.hook=p=>p===coveragePath(f)?Response.json(f.d.form):null;
  await f.click(coverageAction);
  await f.wait(()=>f.text().includes('고정 양식 AF04 v1 · 필수 항목 3개 중 0개 누락'));
  assert.equal(f.buffer(),null);
  assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
 }finally{await f.close();}
});

test('경로 전환 직후 이전 화면 버튼은 고정 양식 요청을 시작하지 않는다',async()=>{
 const f=await fixture(true), route=location.hash;try{
  await f.open();
  location.hash='#/different';
  await f.click(coverageAction);
  assert.equal(f.calls.filter(c=>c.path.includes('/forms')).length,0);
  assert.equal(f.buffer(),null);
 }finally{location.hash=route;await f.close();}
});

for(const scope of ['route','project','transport','proposal','unmount'] as const) for(const status of [200,401]) test('고정 양식 지연 '+status+' · '+scope+' 전환 뒤 결과·인증효과 없음',async()=>{
 const f=await fixture(true), route=location.hash, gate=deferred<Response>();let unmounted=false;
 const response=()=>status===200?Response.json(f.d.form):Response.json({code:'AUTH_REQUIRED'},{status});
 try{
  await f.open();
  const path=coveragePath(f);
  f.controls.hook=p=>p===path?gate.promise:null;
  await f.click(coverageAction);
  await f.wait(()=>f.calls.some(c=>c.path===path));
  if(scope==='route')location.hash='#/different';
  if(scope==='project')await f.render({...f.props(),projectId:id(42)});
  if(scope==='transport')f.client.transport=async()=>{throw Error('새 transport에 고정 양식을 요청하지 않는다');};
  if(scope==='proposal')await f.open(id(44));
  if(scope==='unmount'){await f.close();unmounted=true;}
  gate.resolve(response());
  await f.settle();
  assert.doesNotMatch(f.text(),/개 누락|필수 항목 확인 불가/);
  assert.equal(f.lost(),0);
  assert.deepEqual(f.calls.filter(c=>c.path.includes('/forms')).map(c=>c.path),[path]);
  assert.equal(f.buffer(),null);
  assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
 }finally{
  gate.resolve(response());
  location.hash=route;
  if(!unmounted)await f.close();
 }
});

const selectedDraftAction='선택한 초안의 양식·사람 검토 열기';
test('IX02 QA B4/B5 미반영 제안 선택 저장부터 같은 초안의 HUMAN REWORK 원문 재조회까지 연결된다',{timeout:15000},async()=>{
 const f=await fixture(true,'AF02',true),rows=new Map<number,any>(),posts:any[]=[],readbacks:any[]=[];
 const recordedAt=new Date(at).toISOString(),reviewedAt='2026-11-17T00:01:00.000Z',reason='빈 필수 항목과 연결하지 않은 항목을 보완해야 합니다';
 const selectedPath=`/api/v1/projects/${pid}/documents/${f.d.baseRef.id}/versions/${f.d.baseRef.version+1}`;
 const receipt=(c:any,when:string,data:unknown)=>Response.json({commandId:c.commandId,projectId:pid,status:'APPLIED',operationId:id(60+posts.length),serverReceivedAt:when,targetId:c.targetId,version:c.operation==='saveDocumentDraft'?c.expectedVersion+1:c.expectedVersion,data});
 f.controls.hook=(path,options)=>{
  assert(['GET','POST'].includes(options?.method??'GET'),'기존 보호 GET과 정확 두 POST 외 요청은 금지한다');
  if(options?.method==='POST'){
   assert.equal(path,`/api/v1/projects/${pid}/commands`);
   const c=JSON.parse(String(options.body));posts.push(c);
   assert.equal(c.projectId,pid);assert.equal(c.clientId,cid);assert.equal(c.controlGeneration,4);
   assert.equal(new Headers(options.headers).get('X-Anvil-CSRF'),session.csrfToken);
   assert.equal(new Headers(options.headers).get('Idempotency-Key'),c.commandId);
   assert.deepEqual(c.baselineRefs,[]);assert.equal(c.approvalRef,null);
   if(c.operation==='saveDocumentDraft'){
    assert.equal(rows.size,0,'선택 POST 이전에는 새 초안 행이 없다');
    assert.equal(c.targetId,f.d.baseRef.id);assert.equal(c.expectedVersion,f.d.baseRef.version);
    assert.equal(c.payload.proposalRef,f.d.proposal.id);assert.equal(c.payload.importCandidateRef,null);
    assert.deepEqual(c.payload.content,f.d.proposal.proposedContent);assert.deepEqual(c.payload.formRef,f.d.form.ref);
    const {title,formRef,stageNodeRef,content}=c.payload,version=c.expectedVersion+1;
    const draft={...structuredClone(f.d.document),version,title,formRef,stageNodeRef,content,contentHash:H({title,formRef,stageNodeRef,content}),authorRef:{kind:'HUMAN',userId:uid},createdAt:recordedAt,
     statusHistory:[{kind:'DRAFT_SAVED',reason:c.payload.reason,at:recordedAt,actorRef:{kind:'HUMAN',userId:uid}}],
     contentReviewCriteria:{criteriaVersion:1,formRef,items:f.d.form.definition.items.map(i=>({criterionId:i.itemId,title:i.title,reviewCriteria:i.reviewCriteria}))},contentReviews:[]};
    rows.set(version,draft);
    (f.d.proposal.selections as any[]).push({documentId:draft.id,version,selectedBy:uid,at:recordedAt});
    return receipt(c,recordedAt,{status:'DRAFT',ref:{id:draft.id,version,contentHash:draft.contentHash},proposalRef:f.d.proposal.id});
   }
   assert.equal(c.operation,'recordContentReview','선택과 사람 검토 외 POST는 금지한다');
   const draft=rows.get(c.expectedVersion);assert(draft);assert.equal(draft.contentReviews.length,0);assert.equal(c.targetId,draft.id);
   assert.deepEqual(c.payload.targetRef,{id:draft.id,version:draft.version,contentHash:draft.contentHash});
   assert.equal(c.payload.targetKind,'DOCUMENT');assert.equal(c.payload.criteriaVersion,1);assert.equal(c.payload.outcome,'REWORK');assert.equal(c.payload.reason,reason);
   assert.deepEqual(c.payload.items,draft.contentReviewCriteria.items.map((i:any)=>({criterionId:i.criterionId,outcome:'REWORK',evidenceRefs:[],reason:i.title+' · 사람이 확인한 보완 필요'})));
   const reviewRef={id:id(70),criteriaVersion:1,targetRef:structuredClone(c.payload.targetRef),outcome:'REWORK'};
   draft.contentReviews.push({ref:reviewRef,items:structuredClone(c.payload.items),reviewer:{kind:'HUMAN',userId:uid,sameAsTargetRecorder:true},sourceKind:'HUMAN_REVIEW',reason,reviewedAt,serverSequence:1});
   return receipt(c,reviewedAt,{status:'REVIEW_RECORDED',reviewRef});
  }
  if(path===selectedPath){const row=rows.get(f.d.baseRef.version+1);assert(row,'저장하지 않은 초안 원문을 제공하지 않는다');readbacks.push(structuredClone(row));return Response.json(row);}
  if(path.includes('/documents?'))return Response.json({items:[...rows.values()].map(row=>({id:row.id,title:row.title,headVersion:row.version,confirmedVersion:null,updatedAt:recordedAt})),hasMore:false,nextCursor:null,observedAt:recordedAt});
  if(path===coveragePath(f))return Response.json(f.d.form);
  return null;
 };
 try{
  assert.equal(f.d.proposal.status,'PENDING');assert.deepEqual(f.d.proposal.selections,[]);assert.equal(rows.size,0);
  const change=(node:MemoryNode,event:unknown)=>{const key=Object.keys(node).find(k=>k.startsWith('__reactProps'))!;return (node as any)[key].onChange(event);};
  await f.open();
  const openCheck=f.nodes().find(n=>n.tagName==='INPUT'&&n.parentNode?.textContent.includes('보관 제안의 차이를 확인했고'))!;assert(openCheck);
  await ui.React.act(async()=>change(openCheck,{target:{checked:true}}));await f.click('보관 제안 반영 작업 열기');await f.wait(()=>!!f.buffer()?.proposalState?.comparison);
  assert.equal(posts.length,0);assert.equal(rows.size,0);
  const check=f.nodes().find(n=>n.tagName==='INPUT'&&n.parentNode?.textContent.includes('원문·첨부·항목 차이를 확인했고'))!;assert(check);
  await ui.React.act(async()=>change(check,{target:{checked:true}}));await f.click('이 제안으로 새 초안 저장');
  await f.wait(()=>rows.size===1&&f.buffer()===null);
  const draft=rows.get(3),ref={id:draft.id,version:draft.version,contentHash:draft.contentHash};
  assert.equal(draft.confirmed,false);assert.deepEqual(draft.contentReviews,[]);assert.equal(f.d.proposal.status,'PENDING','제안 원형은 보존하고 선택 관계만 기록한다');
  assert.deepEqual(f.d.proposal.selections,[{documentId:ref.id,version:ref.version,selectedBy:uid,at:recordedAt}]);
  await f.open();await f.click('반영 결과 원문 보기');await f.wait(()=>f.nodes().some(n=>n.tagName==='A'&&n.textContent===selectedDraftAction));
  const href=f.nodes().find(n=>n.tagName==='A'&&n.textContent===selectedDraftAction)!.getAttribute('href')!;
  assert.equal(href,documentVersionHref(pid,ref));const route=parseRoute(href);assert.deepEqual(route,{screen:'documents',projectId:pid,documentRef:ref});
  assert.equal(readbacks.length,1);assert.deepEqual(readbacks[0].content,draft.content);
  await f.openDocument((route as any).documentRef);await f.wait(()=>f.text().includes('이 버전 내용 검토 작성'));
  assert.match(f.text(),/형식 검사/);assert.match(f.text(),/아직 내용 검토가 기록되지 않았습니다/);
  await f.click('이 버전 내용 검토 작성');await f.wait(()=>f.text().includes('문서 내용 검토 작성'));
  for(const [i,item]of draft.contentReviewCriteria.items.entries()){
   const outcome=f.nodes().find(n=>n.getAttribute('id')==='review-outcome-'+i)!,why=f.nodes().find(n=>n.getAttribute('id')==='review-reason-'+i)!;assert(outcome&&why);
   await ui.React.act(async()=>change(outcome,{target:{value:'REWORK'}}));
   await ui.React.act(async()=>change(why,{target:{value:item.title+' · 사람이 확인한 보완 필요'}}));
  }
  await ui.React.act(async()=>change(f.nodes().find(n=>n.getAttribute('id')==='document-review-outcome')!,{target:{value:'REWORK'}}));
  await ui.React.act(async()=>change(f.nodes().find(n=>n.getAttribute('id')==='document-review-reason')!,{target:{value:reason}}));
  await f.click('내용 검토 기록 저장');await f.wait(()=>f.text().includes('내용 검토 저장 확인'));
  const readsBefore=readbacks.length;await f.click('저장된 검토 사건 조회');await f.wait(()=>f.text().includes('검토 사건 원문 일치'));
  assert.equal(readbacks.length,readsBefore+1,'저장 응답과 별개의 보호 GET으로 같은 초안 검토를 재확인한다');
  const fresh=readbacks.at(-1);assert.deepEqual({id:fresh.id,version:fresh.version,contentHash:fresh.contentHash},ref);
  assert.deepEqual(fresh.content,f.d.proposal.proposedContent);assert.equal(fresh.confirmed,false);
  assert.equal(fresh.contentReviews.length,1);assert.deepEqual(fresh.contentReviews[0].reviewer,{kind:'HUMAN',userId:uid,sameAsTargetRecorder:true});
  assert.equal(fresh.contentReviews[0].reviewedAt,reviewedAt);assert.equal(fresh.contentReviews[0].reason,reason);assert.equal(fresh.contentReviews[0].ref.outcome,'REWORK');
  assert.deepEqual(posts.map(c=>c.operation),['saveDocumentDraft','recordContentReview']);assert.equal(f.calls.filter(c=>c.method==='POST').length,2);assert.equal(f.lost(),0);
  assert.equal(rows.size,1);assert.equal(f.d.document.version,2);assert.equal(f.d.document.confirmed,false);
 }finally{await f.close();}
});
test('IX02 QA A AF05 보호 원문을 사람이 검토하고 같은 원문 바이트와 검토 사건을 재확인한다',{timeout:15000},async()=>{
 const [fixtureManifest,formSource,standardSource]=await Promise.all([
  readFile(new URL('../../integration/IX02/fixtures/v1/manifest.json',import.meta.url),'utf8'),
  readFile(new URL('../../../docs/design/공식산출물_양식정의.md',import.meta.url)),
  readFile(new URL('../../../docs/design/문서작성_공통기준.md',import.meta.url)),
 ]);
 const {qaA,sourceOnly,actualExecutionAuthorized}=JSON.parse(fixtureManifest);
 assert.equal(sourceOnly,true);assert.equal(actualExecutionAuthorized,false);
 assert.deepEqual(qaA.prescribedArgv,['node','--test','test/ready-state.test.mjs']);
 assert.deepEqual(qaA.expectedBaseline,{state:'EXPECTED_RED',tests:3,pass:2,fail:1,failingTest:'ASCII edge whitespace must preserve READY'});
 const argv=JSON.stringify(qaA.prescribedArgv),expected=qaA.expectedBaseline;
 const catalog=buildOfficialForms(formSource,standardSource),form=catalog.forms.find(entry=>entry.definition.formCode==='AF05');assert(form);
 const sections=[
  'IX02 QA A 합성 원형, 고정 업무와 시험 계획의 내용 확인 범위',
  '별도 QA 대상과 실행 환경 미확정. 입력은 고정 manifest의 합성 자료',
  `업무 IX02, 합성 TC IX02-QA-A-READY, 중요 실패 조건: ${expected.failingTest}`,
  `재현 인자 ${argv} · 관측 위치: 지정 시험 출력 · 기대 기준 ${expected.state}, 전체 ${expected.tests}, 통과 ${expected.pass}, 실패 ${expected.fail}`,
  '직접 실행 근거 미확인. 이 검토는 문서의 계획과 원문 일치만 확인',
  '실제 실행·사용자 인수 미실행. 원본 자료를 그대로 보존',
 ];
 assert.equal(form.definition.items.length,sections.length);
 const title='IX02 QA A 테스트계획 원형',body=Buffer.from(sections.join('\n')+'\n','utf8');
 const content={body:{artifactId:id(81),bytes:body.length,contentHash:contentHash(body),mediaType:'text/plain;charset=utf-8'},attachments:[],sourceRefs:[],sections:form.definition.items.map((item,index)=>({itemId:item.itemId,anchor:`line:${index+1}`}))};
 const ref={id:id(82),version:2,contentHash:H({title,formRef:form.ref,stageNodeRef:null,content})};
 const criteria:DocumentVersion['contentReviewCriteria']={criteriaVersion:1,formRef:form.ref,items:form.definition.items.map(item=>({criterionId:item.itemId,title:item.title,reviewCriteria:item.reviewCriteria}))};
 const document:DocumentVersion={...ref,title,confirmed:false,authorRef:{kind:'HUMAN',userId:id(80)},createdAt:new Date(at).toISOString(),formRef:form.ref,stageNodeRef:null,content,sourceRefs:[],validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:criteria,contentReviews:[]};
 const root=`/api/v1/projects/${pid}`,documentPath=`${root}/documents/${ref.id}/versions/${ref.version}`,artifactPath=`${root}/files/${content.body.artifactId}`;
 const reason='고정 원형과 기대 결과를 대조했습니다. 실제 시험은 미실행입니다.',reviewedAt='2026-11-17T00:03:00.000Z';
 const reviewRef={id:id(83),criteriaVersion:1,targetRef:ref,outcome:'ACCEPTED' as const};
 const items=criteria.items.map((item,index)=>({criterionId:item.criterionId,outcome:'ACCEPTED',reason:sections[index]!,evidenceRefs:[]}));
 const posts:DocumentReviewCommand[]=[],reads:DocumentVersion[]=[];
 let corruptBody=false;
 const f=await fixture();
 f.controls.hook=(path,request)=>{
  if(request?.method==='POST'){
   assert.equal(path,`${root}/commands`);assert.equal(posts.length,0);
   const command:DocumentReviewCommand=JSON.parse(String(request.body));
   assert.equal(new Headers(request.headers).get('X-Anvil-CSRF'),session.csrfToken);
   assert.equal(new Headers(request.headers).get('Idempotency-Key'),command.commandId);
   const {commandId,...requestFields}=command;
   assert.match(commandId,/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
   assert.deepEqual(requestFields,{schemaVersion:1,projectId:pid,clientId:cid,controlGeneration:4,operation:'recordContentReview',targetId:ref.id,expectedVersion:ref.version,baselineRefs:[],approvalRef:null,payload:{targetKind:'DOCUMENT',targetRef:ref,criteriaVersion:1,items,outcome:'ACCEPTED',reason}});
   posts.push(command);
   document.contentReviews.push({ref:reviewRef,items:structuredClone(command.payload.items),reviewer:{kind:'HUMAN',userId:uid,sameAsTargetRecorder:false},sourceKind:'HUMAN_REVIEW',reason:command.payload.reason,reviewedAt,serverSequence:1});
   return Response.json({commandId:command.commandId,projectId:pid,status:'APPLIED',operationId:id(84),serverReceivedAt:reviewedAt,targetId:ref.id,version:ref.version,data:{status:'REVIEW_RECORDED',reviewRef}});
  }
  assert.equal(request?.method??'GET','GET');
  if(path===documentPath){reads.push(structuredClone(document));return Response.json(document);}
  if(path===artifactPath){
   assert.equal(new Headers(request?.headers).get('Accept'),'application/octet-stream');
   const bytes=new Uint8Array(body);
   if(corruptBody)bytes[0]=33;
   return new Response(bytes,{headers:{'content-type':'application/octet-stream'}});
  }
  if(path===`/api/v1/forms/${form.ref.id}/versions/${form.ref.version}`)return Response.json({...form,authoringStandard:{ref:catalog.standard.ref,content:catalog.standard.body.toString('utf8')},validation:{formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'}});
  if(path.startsWith(`${root}/documents?`))return Response.json({items:[{id:ref.id,title,headVersion:ref.version,confirmedVersion:null,updatedAt:reviewedAt}],hasMore:false,nextCursor:null,observedAt:reviewedAt});
  if(path===root)return null;
  throw Error(`UNMODELED_AF05_QA_READ:${path}`);
 };
 try{
  await f.openDocument(ref);await f.wait(()=>f.text().includes(argv)&&f.text().includes(expected.failingTest));
  assert(f.text().includes(`통과 ${expected.pass}, 실패 ${expected.fail}`));
  assert.equal(posts.length,0);assert.equal(reads.at(-1)?.contentReviews.length,0);
  await f.click('이 버전 내용 검토 작성');await f.wait(()=>f.text().includes('문서 내용 검토 작성'));assert.equal(posts.length,0);
  const change=async(field:string,value:string)=>{
   const node=f.nodes().find(item=>item.getAttribute('id')===field);assert(node,field);
   const propsKey=Object.keys(node).find(key=>key.startsWith('__reactProps'));assert(propsKey,field);
   await ui.React.act(async()=>(node as unknown as Record<string,{onChange:(event:{target:{value:string}})=>void}>)[propsKey]!.onChange({target:{value}}));
  };
  for(const [index,item] of items.entries()){
   await change(`review-outcome-${index}`,item.outcome);await change(`review-reason-${index}`,item.reason);
  }
  await change('document-review-outcome','ACCEPTED');await change('document-review-reason',reason);
  await f.click('내용 검토 기록 저장');await f.wait(()=>f.text().includes(`검토자 ${uid}`));
  assert(f.text().includes('내용 검토 저장 확인 · 문서 확정 아님'));assert(!f.text().includes('검토 사건 원문 일치'));
  const verify=async(expectedText:string)=>{
   const readCount=reads.length,callCount=f.calls.length;
   await f.click('저장된 검토 사건 조회');await f.wait(()=>f.text().includes(expectedText));
   assert.equal(reads.length,readCount+1);
   assert.deepEqual(f.calls.slice(callCount).map(call=>[call.method,call.path]),[['GET',documentPath],['GET',artifactPath]]);
  };
  corruptBody=true;await verify('검토 사건 조회 미확인');assert(!f.text().includes('검토 사건 원문 일치'));
  corruptBody=false;await verify('검토 사건 원문 일치');
  const fresh=reads.at(-1)!;
  assert.deepEqual({id:fresh.id,version:fresh.version,contentHash:fresh.contentHash},ref);
  assert.deepEqual(fresh.content.body,content.body);assert.deepEqual(fresh.formRef,form.ref);
  assert.notEqual(fresh.authorRef?.userId,uid);
  assert.deepEqual(fresh.contentReviews,[{ref:reviewRef,items,reviewer:{kind:'HUMAN',userId:uid,sameAsTargetRecorder:false},sourceKind:'HUMAN_REVIEW',reason,reviewedAt,serverSequence:1}]);
  assert.equal(fresh.confirmed,false);assert.deepEqual(posts.map(post=>post.operation),['recordContentReview']);
  assert.equal(f.calls.filter(call=>call.method==='POST').length,1);assert.equal(f.lost(),0);
 }finally{await f.close();}
});
async function selectedDraftFixture(){
 const f=await fixture(true),version=f.d.baseRef.version+1;
 (f.d.proposal.selections as any[]).push({documentId:f.d.baseRef.id,version,selectedBy:uid,at});
 const document={...f.d.document,version,content:f.d.proposal.proposedContent,contentHash:H({title:f.d.document.title,formRef:f.d.document.formRef,stageNodeRef:null,content:f.d.proposal.proposedContent})};
 const path=`/api/v1/projects/${pid}/documents/${document.id}/versions/${version}`;
 f.controls.hook=p=>p===path?Response.json(document):null;
 return{...f,selectedDocument:document,selectedPath:path,links:()=>f.nodes().filter(n=>n.tagName==='A'&&n.textContent===selectedDraftAction)};
}

test('검산된 사람 선택 초안은 exact UI06 양식·별도 HUMAN 검토 경로로만 이어지고 자동 조회·쓰기는 없다',{timeout:15000},async()=>{
 const f=await selectedDraftFixture();try{
  await f.open();assert.equal(f.links().length,0);assert.equal(f.calls.filter(c=>c.path===f.selectedPath).length,0);
  await f.click('반영 결과 원문 보기');await f.wait(()=>f.text().includes('반영 결과 · 버전 3'));
  const links=f.links();assert.equal(links.length,1,'선택한 미확정 초안의 기존 UI06 진입 링크가 필요하다');
  const ref={id:f.selectedDocument.id,version:3,contentHash:f.selectedDocument.contentHash},href=links[0]!.getAttribute('href');assert.equal(href,documentVersionHref(pid,ref));
  assert.deepEqual(parseRoute(href!),{screen:'documents',projectId:pid,documentRef:ref});
  assert.equal(links[0]!.dispatchEvent({type:'click',button:0,bubbles:true}),true,'현재 exact 선택의 기본 탐색은 막지 않는다');
  assert.equal(f.calls.filter(c=>c.path===f.selectedPath).length,1);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);assert.equal(f.buffer(),null);
 }finally{await f.close();}
});

test('미선택·다른 선택 관계·원문 hash/ID 손상·확정 문서는 선택 초안 검토 링크를 만들지 않는다',{timeout:15000},async()=>{
 for(const fault of ['unselected','selection-id','selection-version','hash','document-id','confirmed']){
  const f=await selectedDraftFixture();try{
   const selection=(f.d.proposal.selections as any[])[0];
   if(fault==='unselected')f.d.proposal.selections=[];
   if(fault==='selection-id')selection.documentId=id(49);
   if(fault==='selection-version')selection.version++;
   if(fault==='hash')f.selectedDocument.contentHash='a'.repeat(64);
   if(fault==='document-id')f.selectedDocument.id=id(49);
   if(fault==='confirmed')f.selectedDocument.confirmed=true;
   await f.open();
   if(['unselected','selection-id','selection-version'].includes(fault)){
    assert.equal(f.nodes().filter(n=>n.tagName==='BUTTON'&&n.textContent==='반영 결과 원문 보기').length,0);assert.equal(f.calls.filter(c=>c.path===f.selectedPath).length,0);
   }else{
    await f.click('반영 결과 원문 보기');await f.wait(()=>fault==='confirmed'?f.text().includes('반영 결과 · 버전 3'):f.nodes().some(n=>n.getAttribute('role')==='alert'));
   }
   assert.equal(f.links().length,0,fault);assert.equal(f.buffer(),null);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
  }finally{await f.close();}
 }
});

test('선택 초안의 이전 경로 버튼·link는 route 전환 직후 GET과 기본 탐색을 시작하지 않는다',{timeout:15000},async()=>{
 const route=location.hash,f=await selectedDraftFixture();try{
  await f.open();location.hash='#/other';await f.click('반영 결과 원문 보기');assert.equal(f.calls.filter(c=>c.path===f.selectedPath).length,0);
  location.hash=route;await f.click('반영 결과 원문 보기');await f.wait(()=>f.links().length===1);
  const link=f.links()[0]!,count=f.calls.length;location.hash='#/other';assert.equal(link.dispatchEvent({type:'click',button:0,bubbles:true}),false,'unmount 전 원 anchor도 늦은 탐색을 막는다');
  assert.equal(link.dispatchEvent({type:'auxclick',button:1,bubbles:true}),false,'보조 클릭도 같은 원 선택과 경로를 검산한다');
  await f.render();assert.equal(f.links().length,0);assert.equal(f.calls.length,count);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
 }finally{location.hash=route;await f.close();}
});

test('다른 제안 open의 동기 시작 뒤 이전 선택 결과 버튼은 commit 전에도 GET을 재시작하지 않는다',{timeout:15000},async()=>{
 const f=await selectedDraftFixture(),gate=deferred<Response>();try{
  await f.open();const oldButton=f.button('반영 결과 원문 보기'),nextButton=f.button('보관 제안 '+id(44)+' 열기');
  const handler=(node:MemoryNode)=>{const key=Object.keys(node).find(k=>k.startsWith('__reactProps'))!;return(node as any)[key].onClick;};
  f.controls.hook=p=>p.endsWith('/proposals/'+id(44))?gate.promise:p===f.selectedPath?Response.json(f.selectedDocument):null;
  await ui.React.act(async()=>{handler(nextButton)();handler(oldButton)();});
  assert.equal(f.calls.filter(c=>c.path===f.selectedPath).length,0);assert.equal(f.links().length,0);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
  gate.resolve(Response.json({...f.d.proposal,id:id(44)}));await f.settle();assert.equal(f.links().length,0);assert.equal(f.buffer(),null);
 }finally{gate.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.close();}
});

test('선택 초안 결과 조회는 같은 선택의 trace 준비 중에도 완료되고 준비 실패 뒤 loading에 갇히지 않는다',{timeout:15000},async()=>{
 const f=await selectedDraftFixture(),read=deferred<Response>(),prepare=deferred<Response>();try{
  await f.open();f.controls.hook=p=>p===f.selectedPath?read.promise:p===`/api/v1/projects/${pid}`?prepare.promise:null;
  await f.click('반영 결과 원문 보기');await f.wait(()=>f.calls.some(c=>c.path===f.selectedPath));
  await f.click('서버 생성 diff를 고정 업무에 연결');await f.wait(()=>f.calls.some(c=>c.path===`/api/v1/projects/${pid}`));
  read.resolve(Response.json(f.selectedDocument));await f.wait(()=>f.text().includes('반영 결과 · 버전 3'));
  assert.equal(f.links()[0]!.dispatchEvent({type:'click',button:0,bubbles:true}),false,'trace 준비 중 탐색은 허용하지 않는다');
  assert.equal(f.links()[0]!.dispatchEvent({type:'auxclick',button:1,bubbles:true}),false);
  prepare.resolve(Response.json({code:'TRACE_PREPARE_UNAVAILABLE'},{status:503}));await f.wait(()=>!f.button('서버 생성 diff를 고정 업무에 연결').disabled);
  assert.equal(f.links().length,1);assert.equal(f.links()[0]!.dispatchEvent({type:'click',button:0,bubbles:true}),true);assert.doesNotMatch(f.text(),/반영 결과 원문 조회 중/);
  assert.equal(f.calls.filter(c=>c.path===f.selectedPath).length,1);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);assert.equal(f.buffer(),null);
 }finally{read.resolve(Response.json(f.selectedDocument));prepare.resolve(Response.json({code:'TRACE_PREPARE_UNAVAILABLE'},{status:503}));await f.close();}
});

for(const status of [200,401])test('선택 초안 결과 지연 '+status+'는 route·project·proposal·인증·전송·unmount 교체 후 링크/인증효과0',{timeout:15000},async()=>{
 for(const scope of ['route','project','proposal','csrf','transport','unmount']){
  const f=await selectedDraftFixture(),route=location.hash,gate=deferred<Response>();let closed=false;
  try{
   await f.open();f.controls.hook=p=>p===f.selectedPath?gate.promise:null;await f.click('반영 결과 원문 보기');await f.wait(()=>f.calls.some(c=>c.path===f.selectedPath));
   if(scope==='route')location.hash='#/other';
   if(scope==='project')await f.render({...f.props(),projectId:id(42)});
   if(scope==='proposal')await f.open(id(44));
   if(scope==='csrf')await f.render({...f.props(),session:{...session,csrfToken:'D'.repeat(43)}});
   if(scope==='transport')f.client.transport=async()=>{throw Error('교체된 transport에서 선택 원문 조회 금지');};
   if(scope==='unmount'){await f.close();closed=true;}
   const count=f.calls.length;gate.resolve(status===200?Response.json(f.selectedDocument):Response.json({code:'AUTH_REQUIRED'},{status}));await f.settle();
   assert.equal(f.links().length,0,scope);assert.doesNotMatch(f.text(),/반영 결과 · 버전 3/);assert.equal(f.lost(),0,scope);
   assert.equal(f.calls.slice(count).filter(c=>!c.path.includes('/imports?')&&!c.path.includes('/proposals?')).length,0,scope);assert.equal(f.calls.filter(c=>c.method==='POST').length,0);assert.equal(f.buffer(),null);
  }finally{gate.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));location.hash=route;if(!closed)await f.close();}
 }
});

test('원 양식 404 뒤 같은 제안에서 명시 재조회로 구조를 확인한다',async()=>{
 const f=await fixture(true);try{
  await f.open();
  const path=coveragePath(f);
  let attempt=0;
  f.controls.hook=p=>p!==path?null:++attempt===1
   ?Response.json({code:'FORM_NOT_FOUND'},{status:404})
   :Response.json(f.d.form);
  await f.click(coverageAction);
  await f.wait(()=>f.text().includes('필수 항목 확인 불가 · FORM_NOT_FOUND'));
  assert.equal(attempt,1);
  await f.click(coverageAction);
  await f.settle();
  assert.equal(attempt,2);
  await f.wait(()=>f.text().includes('필수 항목 3개 중 2개 누락'));
  assert.doesNotMatch(f.text(),/FORM_NOT_FOUND/);
  assert.deepEqual(f.calls.filter(c=>c.path.includes('/forms')).map(c=>c.path),[path,path]);
  assert.equal(f.buffer(),null);
  assert.equal(f.calls.filter(c=>c.method==='POST').length,0);
 }finally{await f.close();}
});
