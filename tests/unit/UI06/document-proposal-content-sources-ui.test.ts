import {documentTextDiff} from '../../../apps/server/modules/documents/document-diff.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
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


const id=(n:number)=>'a6f30000-0000-4000-8000-'+String(n).padStart(12,'0'),pid=id(1),uid=id(2),cid=id(3),at='2026-11-08T00:00:00.000Z';
const session={user:{id:uid},clientId:cid,csrfToken:'a'.repeat(43)};
let bundled:Promise<any>;
function bundle(){return bundled??=Promise.resolve().then(async()=>{
 const entry=['DocumentEditor.tsx','DocumentsPage.tsx','DocumentSourceRefs.tsx','editor-api.ts'].map(p=>fileURLToPath(new URL('../../../apps/web/src/features/design-trace/'+p,import.meta.url))),api=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:proposal-sources',name:'ProposalSourcesTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'document-source-memory-entry',resolveId(id){if(id.endsWith('virtual:proposal-sources'))return '\0proposal-sources';},load(id){if(id==='\0proposal-sources')return "import * as React from 'react';import{createRoot}from'react-dom/client';export{React,createRoot};export{DocumentEditor}from"+JSON.stringify(entry[0])+";export{DocumentsPage}from"+JSON.stringify(entry[1])+";export{DocumentSourceRefs}from"+JSON.stringify(entry[2])+";export*from"+JSON.stringify(entry[3])+";export{ApiClient}from"+JSON.stringify(api)+";export{resumeStoredProposal}from"+JSON.stringify(entry[3]!.replace("editor-api.ts","proposal-api.ts"))+";";}}]});
 const code=(Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code;
 return code+';return ProposalSourcesTest;';
});}
const reply=(v:unknown,status=200)=>Response.json(v,{status});
function data(){
 const standardRef={id:id(4),version:1,contentHash:'f'.repeat(64)},definition={scope:'USER_COMMON',formCode:'SOURCE',name:'합성 출처 양식',purpose:'문서 출처',requiredInputs:[],authorRole:'USER',reviewerRole:'USER',confirmerRole:'USER',items:[],authoringStandardRef:standardRef};
 const formRef={id:id(5),version:1,contentHash:contentHash(canonicalJson(definition))},form={ref:formRef,definition,authoringStandard:{ref:standardRef,content:'합성 작성 기준'},validation:{formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'}};
 const artifacts=new Map<string,{ref:any;body:string}>();
 const artifact=(n:number,body:string,mediaType='text/plain;charset=utf-8')=>{const ref={artifactId:id(n),bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType};artifacts.set(ref.artifactId,{ref,body});return ref;};
 const sourceBody=artifact(10,'정확 문서 출처 원문'),messageBody=artifact(11,'보호 대화 원문'),instructionBody=artifact(12,'보호 사용자 지시'),importBody=artifact(13,'보호 보관 텍스트');
 const document=(docid:string,version:number,title:string,body:any,sources:any[]=[])=>{
  const content={body,attachments:[],sections:[],sourceRefs:structuredClone(sources)};
  return {id:docid,version,title,confirmed:false,formRef,stageNodeRef:null,content,sourceRefs:structuredClone(sources),contentHash:contentHash(canonicalJson({title,formRef,stageNodeRef:null,content})),validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[]};
 };
 const source=document(id(20),2,'출처 문서',sourceBody),room=id(30);
 const message=(n:number,kind:string,bodyRef:any)=>{
  const message={kind,bodyRef,attachmentRefs:[],replyTo:null,supersedesInstructionRef:null,effectiveScope:{projectId:pid,stageRefs:[],taskRefs:[]}},authorRef={kind:'HUMAN',userId:uid};
  const snapshot={conversationId:room,targetRoleRef:null,message,sourceRefs:[],serverSequence:n,authorRef};
  return {sourceRef:{kind:'CONVERSATION',id:id(n),contentHash:contentHash(canonicalJson(snapshot))},conversationId:room,serverSequence:n,authorRef,message,body:artifacts.get(bodyRef.artifactId)!.body,deliveryState:'STORED',redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',recordedAt:at};
 };
 const messages=[message(32,'USER_INSTRUCTION',instructionBody),message(31,'USER_MESSAGE',messageBody)];
 const imported={id:id(40),originalRef:importBody,extractedContentRef:importBody,intendedFormRef:null,parserVersion:'UTF8_IDENTITY_1',status:'READY',losses:[],issues:[],createdAt:at,selections:[]};
 return {form,formRef,artifacts,artifact,document,source,room,messages,imported};
}
async function mount(mode:'page'|'picker'='page',failRead=false,loseReply=false,rejectCompletion=false){
 const code=await bundle(),saved=new Map<string,PropertyDescriptor|undefined>(),channels:MessageChannel[]=[];
 const document:any=new MemoryNode('#document',9);document.ownerDocument=document;
 document.createElement=(name:string)=>new MemoryNode(name,1,document);document.createElementNS=(_n:string,name:string)=>document.createElement(name);document.createTextNode=(text:string)=>{const n=new MemoryNode('#text',3,document);n.data=text;return n;};
 document.documentElement=document.createElement('html');document.body=document.createElement('body');document.documentElement.appendChild(document.body);document.activeElement=document.body;
 const window={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,getComputedStyle:()=>({})};document.defaultView=window;
 const Native=globalThis.MessageChannel;class OwnedChannel extends Native{constructor(){super();channels.push(this);}}
 for(const[k,v]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,MessageChannel:OwnedChannel,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});}
 const ui=new Function(code)(),container=document.createElement('main');document.body.appendChild(container);const root=ui.createRoot(container);
 const d=data(),calls:{path:string;method:string;packet?:any}[]=[],nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 let latest:any,external:any,settings={projectId:pid,session:{...session,user:{...session.user}},disabled:false},auth=0,stored:any=null,proposal:any=null,handler:((p:string,i:any)=>Response|Promise<Response>|null)|null=null;
 const transport=async(path:any,init:any)=>{
  const p=String(path),method=init?.method??'GET';assert.ok(p.startsWith('/api/v1/'));assert.equal(init?.credentials,'same-origin');
  const packet=method==='POST'?(typeof init.body==='string'?JSON.parse(init.body):JSON.parse(init.headers['X-Anvil-Command'])):undefined;calls.push({path:p,method,...(packet?{packet}: {})});
  if(handler){const custom=await handler(p,init);if(custom)return custom;}
  if(p.startsWith('/api/v1/forms/'))return reply(d.form);
  if(p.includes('/documents?'))return reply({items:[{id:d.source.id,title:d.source.title,headVersion:2,confirmedVersion:null,updatedAt:at}],hasMore:false,nextCursor:null,observedAt:at});
  if(p.includes('/documents/'+d.source.id+'/versions/2'))return reply(d.source);
  if(proposal&&p.endsWith('/proposals/'+proposal.id))return reply(proposal);
  if(p==='/api/v1/projects/'+pid)return reply({id:pid,participation:'OWNER',controlState:{actorId:uid,clientId:cid,generation:1,status:'HELD'}});
  if(stored&&p.includes('/documents/'+stored.id+'/versions/')){
   assert.ok(latest.savedRef,'원 ref는 후속 GET 전에 보존되어야 한다');assert.ok(container.textContent.includes('초안 버전 3 저장 확인'),'원 ref의 실제 DOM commit 뒤 읽는다');
   return failRead?reply({code:'NOT_FOUND'},404):reply(stored);
  }
  if(p.endsWith('/conversations?limit=50'))return reply({items:[{id:d.room,headSequence:32,targetRoleRef:null,updatedAt:at,integrity:'NOT_RECHECKED'}],hasMore:false,nextCursor:null,observedAt:at});
  if(p.includes('/conversations/'+d.room+'/messages?'))return reply({conversationId:d.room,observedHeadSequence:32,items:d.messages.map(m=>({sourceRef:m.sourceRef,serverSequence:m.serverSequence,authorRef:m.authorRef,kind:m.message.kind,replyTo:null,supersedesInstructionRef:null,recordedAt:at,deliveryState:'STORED'})),hasMore:false,nextCursor:null,observedAt:at});
  const message=d.messages.find(m=>p.endsWith('/messages/'+m.sourceRef.id));if(message)return reply(message);
  if(p.includes('/imports?'))return reply({items:[{...d.imported,integrity:'NOT_RECHECKED'}],hasMore:false,nextCursor:null,observedAt:at});
  if(p.endsWith('/imports/'+d.imported.id))return reply(d.imported);
  if(method==='GET'&&p.includes('/files/')){const a=d.artifacts.get(p.split('/').at(-1)!);assert.ok(a,'보호 원문 fixture 미등록');return new Response(Buffer.from(a.body),{headers:{'content-type':'application/octet-stream'}});}
  if(packet){
   const base={operationId:id(90),commandId:packet.commandId,projectId:pid,status:'APPLIED',serverReceivedAt:at};
   if(packet.operation==='uploadArtifact'){const text=new TextDecoder().decode(init.body);const ref=d.artifact(70,text);assert.deepEqual({...packet.payload}, {mediaType:ref.mediaType,bytes:ref.bytes,contentHash:ref.contentHash});return reply({...base,targetId:ref.artifactId,version:null,data:{status:'ARTIFACT_READY',artifactRef:ref}});}
   if(packet.operation==='proposeDocumentChange'){
    assert.deepEqual(packet.payload.sourceRefs,[]);const content=packet.payload.proposedContent,old=d.artifacts.get(d.source.content.body.artifactId)!.body,proposed=d.artifacts.get(content.body.artifactId)!.body;
    const diff={...documentTextDiff(old,proposed),baseRef:packet.payload.baseRef,baseBodyRef:d.source.content.body,proposedBodyRef:content.body,beforeContent:d.source.content,afterContent:content},diffRef=d.artifact(71,canonicalJson(diff),'application/json;charset=utf-8');
    const recorded={id:id(81),baseRef:packet.payload.baseRef,proposedContentRef:content.body,diffRef,status:'PENDING'};
    proposal={...recorded,proposedContent:structuredClone(content),reason:packet.payload.reason,createdAt:at,proposedBy:uid,selections:[]};
    return reply({...base,targetId:d.source.id,version:2,data:{status:'PROPOSAL_RECORDED',ref:packet.payload.baseRef,proposal:recorded}});
   }
   assert.equal(packet.operation,'saveDocumentDraft');assert.equal(packet.payload.proposalRef,proposal.id);stored=d.document(d.source.id,3,packet.payload.title,packet.payload.content.body,packet.payload.content.sourceRefs);proposal.selections=[{documentId:stored.id,version:3,selectedBy:uid,at}];
   if(loseReply){loseReply=false;throw Error('합성 응답 유실');}
   return reply({...base,targetId:stored.id,version:3,data:{status:'DRAFT',ref:{id:stored.id,version:3,contentHash:stored.contentHash},proposalRef:proposal.id}});
  }
  throw Error('UNMODELED_UI_SOURCE_REQUEST:'+p);
 };
 const client=new ui.ApiClient(transport);
 function Harness(){const[b,setB]=ui.React.useState(()=>({...ui.editDocument(pid,{document:d.source,body:d.artifacts.get(d.source.content.body.artifactId)!.body},uid,1),body:'명시 제안 새 원문',content:{attachments:[],sections:[],sourceRefs:[{kind:'DOCUMENT_VERSION',id:d.source.id,version:2,contentHash:d.source.contentHash},{kind:'CONVERSATION',id:d.messages[1]!.sourceRef.id,contentHash:d.messages[1]!.sourceRef.contentHash},{kind:'USER_INSTRUCTION',id:d.messages[0]!.sourceRef.id,contentHash:d.messages[0]!.sourceRef.contentHash},{kind:'ARTIFACT',id:d.imported.originalRef.artifactId,contentHash:d.imported.originalRef.contentHash}]},reason:'제안 출처 보존',dirty:true}));const[view,setView]=ui.React.useState(settings);latest=b;external={setB,setView};
  return mode==='page'?ui.React.createElement(ui.DocumentsPage,{client,projectId:view.projectId,session:view.session,buffer:b,onChange:(edit:any)=>setB((previous:any)=>{const next=typeof edit==='function'?edit(previous):edit;return rejectCompletion&&next?.savedRef&&!previous?.savedRef?previous:next;}),review:null,onReviewChange:()=>{},confirmation:null,onConfirmationChange:()=>{},onAuthenticationLost:()=>{auth++;}}):ui.React.createElement(ui.DocumentSourceRefs,{client,projectId:view.projectId,session:view.session,generation:1,value:b.content.sourceRefs,disabled:view.disabled,onChange:(refs:any)=>setB((p:any)=>({...p,content:{...p.content,sourceRefs:refs}})),onAuthenticationLost:()=>{auth++;}});
 }
 const flush=()=>ui.React.act(async()=>{await new Promise(resolve=>setImmediate(resolve));});
 const wait=async(check:()=>boolean)=>{for(let n=0;n<150&&!check();n++)await flush();assert.ok(check(),container.textContent);};
 const button=(text:string)=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===text);
 const click=async(text:string)=>{const target=button(text);assert.ok(target,'버튼 없음: '+text);assert.equal(target.disabled,false,text);await ui.React.act(async()=>target.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const change=async(label:string,value:string)=>{const target=nodes().find(n=>n.getAttribute('aria-label')===label);assert.ok(target,label);await ui.React.act(async()=>{target.value=value;target.dispatchEvent({type:'change',bubbles:true});});};
 await ui.React.act(async()=>root.render(ui.React.createElement(Harness)));
 return {ui,client,container,calls,d,click,change,wait,flush,nodes,button,get buffer(){return latest;},get auth(){return auth;},get stored(){return stored;},restore:async()=>{assert.ok(proposal);const value=await ui.resumeStoredProposal(client,pid,proposal.id,settings.session);await ui.React.act(async()=>external.setB(value));},setHandler:(h:typeof handler)=>{handler=h;},rerender:async(p:Partial<typeof settings>)=>{settings={...settings,...p};await ui.React.act(async()=>external.setView(settings));},setBuffer:async(fn:any)=>ui.React.act(async()=>external.setB(fn)),close:async()=>{await ui.React.act(async()=>root.unmount());for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);}};
}

async function proposeAndCompare(h:Awaited<ReturnType<typeof mount>>){
 await h.click('수정 제안으로 저장');await h.wait(()=>!!h.button('제안 차이 비교'));await h.click('제안 차이 비교');await h.wait(()=>!!h.button('이 제안으로 새 초안 저장'));await acknowledge(h);
}
async function acknowledge(h:Awaited<ReturnType<typeof mount>>){
 const checkbox=h.nodes().find(n=>n.tagName==='INPUT'&&n.parentNode?.textContent.includes('원문·첨부·항목 차이를 확인했고'));
 assert.ok(checkbox);const props=Object.keys(checkbox).find(k=>k.startsWith('__reactProps$'));assert.ok(props);await h.ui.React.act(async()=>{(checkbox as any)[props].onChange({target:{checked:true}});});
}
test('실제 Editor의 제안 비교·명시반영은 선택된4종출처를 buffer/savedRef/고정GET까지 보존한다',async()=>{
 const h=await mount();try{const sources=structuredClone(h.buffer.content.sourceRefs);await proposeAndCompare(h);await h.click('이 제안으로 새 초안 저장');await h.wait(()=>!!h.buffer.savedRef);assert.deepEqual(h.buffer.content.sourceRefs,sources);await h.wait(()=>h.nodes().some(n=>n.getAttribute('aria-label')==='문서 전체 출처 보관'));assert.deepEqual(h.stored.sourceRefs,sources);assert.equal(h.calls.filter(c=>c.method==='POST').length,3);}finally{await h.close();}
});
test('명시 제안반영 뒤 고정GET실패는 원refs/savedRef를 보존하고 추가POST0이다',async()=>{
 const h=await mount('page',true);try{const sources=structuredClone(h.buffer.content.sourceRefs);await proposeAndCompare(h);await h.click('이 제안으로 새 초안 저장');await h.wait(()=>!!h.buffer.savedRef);assert.deepEqual(h.buffer.content.sourceRefs,sources);await h.wait(()=>h.container.textContent.includes('NOT_FOUND'));assert.equal(h.buffer.savedRef.id,h.stored.id);assert.equal(h.calls.filter(c=>c.method==='POST').length,3);}finally{await h.close();}
});

test('보호 보관제안 재개는 업로드/제안 POST없이 실제 Editor의 명시반영과 출처 GET으로 이어진다',async()=>{
 const h=await mount();try{const sources=structuredClone(h.buffer.content.sourceRefs);await proposeAndCompare(h);const writes=h.calls.filter(c=>c.method==='POST').length;await h.restore();assert.equal(h.buffer.proposalState.snapshot,null);assert.deepEqual(h.buffer.proposalState.comparison.proposal.proposedContent.sourceRefs,sources);assert.equal(h.calls.filter(c=>c.method==='POST').length,writes);await acknowledge(h);await h.click('이 제안으로 새 초안 저장');await h.wait(()=>!!h.buffer.savedRef);await h.wait(()=>h.nodes().some(n=>n.getAttribute('aria-label')==='문서 전체 출처 보관'));assert.deepEqual(h.stored.sourceRefs,sources);assert.equal(h.calls.filter(c=>c.method==='POST').length,writes+1);}finally{await h.close();}
});
test('반영 응답유실은 원 명령/출처를 보존하며 자동 POST0·명시 동일packet 재확인만 한다',async()=>{
 const h=await mount('page',false,true);try{await proposeAndCompare(h);await h.click('이 제안으로 새 초안 저장');await h.wait(()=>!!h.buffer.proposalState?.uncertain);const original=structuredClone(h.buffer.proposalState.applyCommand),sources=structuredClone(h.buffer.content.sourceRefs),count=h.calls.filter(c=>c.method==='POST').length;assert.equal(count,3);assert.equal(h.buffer.savedRef,null);await h.flush();assert.equal(h.calls.filter(c=>c.method==='POST').length,count);await h.click('같은 제안 반영 명령 결과 확인');await h.wait(()=>!!h.buffer.savedRef);assert.deepEqual(h.calls.filter(c=>c.method==='POST').at(-1)!.packet,original);assert.deepEqual(h.buffer.content.sourceRefs,sources);assert.equal(h.calls.filter(c=>c.packet?.operation==='uploadArtifact').length,1);}finally{await h.close();}
});
test('제안 명시반영 직전 제어403은 원 출처/제안을 유지하며 save POST0이다',async()=>{
 const h=await mount();try{await proposeAndCompare(h);const before=structuredClone(h.buffer.content.sourceRefs);h.setHandler((p)=>p==='/api/v1/projects/'+pid?reply({code:'ACCESS_DENIED'},403):null);await h.click('이 제안으로 새 초안 저장');await h.wait(()=>h.buffer.proposalState?.failure?.status===403);assert.deepEqual(h.buffer.content.sourceRefs,before);assert.equal(h.buffer.savedRef,null);assert.equal(h.calls.filter(c=>c.packet?.operation==='saveDocumentDraft').length,0);}finally{await h.close();}
});
test('상세 GET중 외부buffer ABA 후 늦은401은 새본문/주체/제안과 auth를 변경하지 않는다',async()=>{
 const h=await mount();let release!:(r:Response)=>void;try{await h.click('수정 제안으로 저장');await h.wait(()=>!!h.button('제안 차이 비교'));let entered=false;h.setHandler(p=>p.includes('/proposals/')?(entered=true,new Promise<Response>(resolve=>{release=resolve;})):null);await h.click('제안 차이 비교');await h.wait(()=>entered);const original=h.buffer;await h.setBuffer((b:any)=>({...b,title:'다른 문서 buffer',proposalState:null}));await h.setBuffer(()=>original);release(reply({code:'AUTHENTICATION_REQUIRED'},401));await h.flush();await h.flush();assert.equal(h.auth,0);assert.equal(h.buffer.proposalState.comparison,null);assert.equal(h.buffer.failure,null);assert.equal(h.calls.filter(c=>c.packet?.operation==='saveDocumentDraft').length,0);}finally{release?.(reply({code:'AUTHENTICATION_REQUIRED'},401));await h.close();}
});
