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
 const result:any=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:document-sources',name:'DocumentSourcesTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'document-source-memory-entry',resolveId(id){if(id.endsWith('virtual:document-sources'))return '\0document-sources';},load(id){if(id==='\0document-sources')return "import * as React from 'react';import{createRoot}from'react-dom/client';export{React,createRoot};export{DocumentEditor}from"+JSON.stringify(entry[0])+";export{DocumentsPage}from"+JSON.stringify(entry[1])+";export{DocumentSourceRefs}from"+JSON.stringify(entry[2])+";export*from"+JSON.stringify(entry[3])+";export{ApiClient}from"+JSON.stringify(api)+";";}}]});
 const code=(Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code;
 return code+';return DocumentSourcesTest;';
});}
const reply=(v:unknown,status=200)=>Response.json(v,{status});
function data(){
 const standardRef={id:id(4),version:1,contentHash:'f'.repeat(64)},definition={scope:'USER_COMMON',formCode:'SOURCE',name:'합성 출처 양식',purpose:'문서 출처',requiredInputs:[],authorRole:'USER',reviewerRole:'USER',confirmerRole:'USER',items:[],authoringStandardRef:standardRef};
 const formRef={id:id(5),version:1,contentHash:contentHash(canonicalJson(definition))},form={ref:formRef,definition,authoringStandard:{ref:standardRef,content:'합성 작성 기준'},validation:{formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'}};
 const artifacts=new Map<string,{ref:any;body:string}>();
 const artifact=(n:number,body:string)=>{const ref={artifactId:id(n),bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/plain;charset=utf-8'};artifacts.set(ref.artifactId,{ref,body});return ref;};
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
 let latest:any,external:any,settings={projectId:pid,session:{...session,user:{...session.user}},disabled:false},auth=0,stored:any=null,handler:((p:string,i:any)=>Response|Promise<Response>|null)|null=null;
 const transport=async(path:any,init:any)=>{
  const p=String(path),method=init?.method??'GET';assert.ok(p.startsWith('/api/v1/'));assert.equal(init?.credentials,'same-origin');
  const packet=method==='POST'?(typeof init.body==='string'?JSON.parse(init.body):JSON.parse(init.headers['X-Anvil-Command'])):undefined;calls.push({path:p,method,...(packet?{packet}: {})});
  if(handler){const custom=await handler(p,init);if(custom)return custom;}
  if(p.startsWith('/api/v1/forms/'))return reply(d.form);
  if(p.includes('/documents?'))return reply({items:[{id:d.source.id,title:d.source.title,headVersion:2,confirmedVersion:null,updatedAt:at}],hasMore:false,nextCursor:null,observedAt:at});
  if(p.includes('/documents/'+d.source.id+'/versions/'))return reply(d.source);
  if(stored&&p.includes('/documents/'+stored.id+'/versions/')){
   assert.ok(latest.savedRef,'원 ref는 후속 GET 전에 보존되어야 한다');assert.ok(container.textContent.includes('초안 버전 1 저장 확인'),'원 ref의 실제 DOM commit 뒤 읽는다');
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
   assert.equal(packet.operation,'saveDocumentDraft');stored=d.document(id(80),1,packet.payload.title,packet.payload.content.body,packet.payload.content.sourceRefs);
   if(loseReply){loseReply=false;throw Error('합성 응답 유실');}
   return reply({...base,targetId:stored.id,version:1,data:{status:'DRAFT',ref:{id:stored.id,version:1,contentHash:stored.contentHash}}});
  }
  throw Error('UNMODELED_UI_SOURCE_REQUEST:'+p);
 };
 const client=new ui.ApiClient(transport);
 function Harness(){const[b,setB]=ui.React.useState(()=>({...ui.newDocument(pid,d.form,uid,1),title:'새 출처 문서',body:'내 초안',mediaType:'text/plain;charset=utf-8',reason:'출처 보존',dirty:true}));const[view,setView]=ui.React.useState(settings);latest=b;external={setB,setView};
  return mode==='page'?ui.React.createElement(ui.DocumentsPage,{client,projectId:view.projectId,session:view.session,buffer:b,onChange:(edit:any)=>setB((previous:any)=>{const next=typeof edit==='function'?edit(previous):edit;return rejectCompletion&&next?.savedRef&&!previous?.savedRef?previous:next;}),review:null,onReviewChange:()=>{},confirmation:null,onConfirmationChange:()=>{},onAuthenticationLost:()=>{auth++;}}):ui.React.createElement(ui.DocumentSourceRefs,{client,projectId:view.projectId,session:view.session,generation:1,value:b.content.sourceRefs,disabled:view.disabled,onChange:(refs:any)=>setB((p:any)=>({...p,content:{...p.content,sourceRefs:refs}})),onAuthenticationLost:()=>{auth++;}});
 }
 const flush=()=>ui.React.act(async()=>{await new Promise(resolve=>setImmediate(resolve));});
 const wait=async(check:()=>boolean)=>{for(let n=0;n<150&&!check();n++)await flush();assert.ok(check(),container.textContent);};
 const button=(text:string)=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===text);
 const click=async(text:string)=>{const target=button(text);assert.ok(target,'버튼 없음: '+text);assert.equal(target.disabled,false,text);await ui.React.act(async()=>target.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const change=async(label:string,value:string)=>{const target=nodes().find(n=>n.getAttribute('aria-label')===label);assert.ok(target,label);await ui.React.act(async()=>{target.value=value;target.dispatchEvent({type:'change',bubbles:true});});};
 await ui.React.act(async()=>root.render(ui.React.createElement(Harness)));
 return {ui,client,container,calls,d,click,change,wait,flush,nodes,button,get buffer(){return latest;},get auth(){return auth;},get stored(){return stored;},setHandler:(h:typeof handler)=>{handler=h;},rerender:async(p:Partial<typeof settings>)=>{settings={...settings,...p};await ui.React.act(async()=>external.setView(settings));},setBuffer:async(fn:any)=>ui.React.act(async()=>external.setB(fn)),close:async()=>{await ui.React.act(async()=>root.unmount());for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);}};
}
async function selectFour(h:Awaited<ReturnType<typeof mount>>){
 await h.click('출처 목록 조회');await h.click('출처 문서: 출처 문서');await h.click('출처 버전 원문 확인');await h.wait(()=>!!h.button('확인한 출처 추가'));await h.click('확인한 출처 추가');
 for(const kind of ['CONVERSATION','USER_INSTRUCTION']){await h.change('문서 출처 종류',kind);await h.click('출처 목록 조회');await h.click('출처 대화방 #32');await h.click(kind==='CONVERSATION'?'출처 발언 #31':'출처 발언 #32');await h.wait(()=>!!h.button('확인한 출처 추가'));await h.click('확인한 출처 추가');}
 await h.change('문서 출처 종류','ARTIFACT');await h.click('출처 목록 조회');await h.click('출처 보관 텍스트 '+h.d.imported.id);await h.wait(()=>!!h.button('확인한 출처 추가'));await h.click('확인한 출처 추가');
}
test('실제 Page/Editor에서 4종 보호선택→원pending→저장→고정 GET과 출처 표시를 연결한다',async()=>{
 const h=await mount();try{await selectFour(h);assert.equal(h.buffer.content.sourceRefs.length,4);assert.equal(h.calls.filter(c=>c.method==='POST').length,0);
  const sources=structuredClone(h.buffer.content.sourceRefs);await h.click('새 초안 버전 저장');await h.wait(()=>!!h.buffer.savedRef&&h.nodes().some(n=>n.getAttribute('aria-label')==='문서 전체 출처 보관'));
  assert.deepEqual(h.stored.sourceRefs,sources);assert.deepEqual(h.buffer.content.sourceRefs,sources);assert.equal(h.calls.filter(c=>c.method==='POST').length,2);assert.equal(h.auth,0);
 }finally{await h.close();}
});
test('저장 후 보호 GET 실패도 원 savedRef/refs를 보존하고 추가POST를 하지 않는다',async()=>{
 const h=await mount('page',true);try{await selectFour(h);await h.click('새 초안 버전 저장');await h.wait(()=>!!h.buffer.savedRef&&h.container.textContent.includes('NOT_FOUND'));assert.equal(h.buffer.savedRef.id,h.stored.id);assert.equal(h.buffer.content.sourceRefs.length,4);assert.equal(h.calls.filter(c=>c.method==='POST').length,2);}finally{await h.close();}
});
test('UNKNOWN은 원 packet을 보존하고 선택을 잠근 채 명시 동일 명령만 재확인한다',async()=>{
 const h=await mount('page',false,true);try{await selectFour(h);await h.click('새 초안 버전 저장');await h.wait(()=>!!h.buffer.pending&&h.container.textContent.includes('CONNECTION_LOST'));const packet=structuredClone(h.buffer.pending.save),sources=structuredClone(h.buffer.pending.content.sourceRefs);assert.equal(h.calls.filter(c=>c.method==='POST').length,2);
  assert.ok(h.nodes().find(n=>n.getAttribute('aria-label')==='문서 출처 종류')!.disabled);await h.flush();assert.equal(h.calls.filter(c=>c.method==='POST').length,2);
  await h.click('같은 저장 명령 결과 확인');await h.wait(()=>!!h.buffer.savedRef);assert.deepEqual(h.calls.filter(c=>c.method==='POST').at(-1)!.packet,packet);assert.deepEqual(h.buffer.content.sourceRefs,sources);assert.equal(h.calls.filter(c=>c.packet?.operation==='uploadArtifact').length,1);
 }finally{await h.close();}
});


test('실제 Editor의 문서buffer A→B→A 교체는 원preview/늦은401을 새대상에 붙이지 않는다',async()=>{
 const h=await mount();try{
  await h.click('출처 목록 조회');await h.click('출처 문서: 출처 문서');await h.click('출처 버전 원문 확인');await h.wait(()=>!!h.button('확인한 출처 추가'));
  const original=h.buffer;await h.setBuffer((b:any)=>({...b,documentId:id(95),baseVersion:1,baseHash:'e'.repeat(64),body:'B 문서'}));assert.equal(h.button('확인한 출처 추가'),undefined);
  await h.setBuffer(()=>original);assert.equal(h.button('확인한 출처 추가'),undefined);
  let resolve!:(r:Response)=>void,started=false;h.setHandler(p=>p.includes('/documents/'+h.d.source.id+'/versions/')?new Promise<Response>(r=>{resolve=r;started=true;}):null);
  await h.click('출처 목록 조회');await h.click('출처 문서: 출처 문서');await h.click('출처 버전 원문 확인');await h.wait(()=>started);
  await h.setBuffer((b:any)=>({...b,documentId:id(96),baseVersion:1,body:'새 문서'}));await h.ui.React.act(async()=>resolve(reply({code:'AUTHENTICATION_REQUIRED'},401)));await h.flush();
  assert.equal(h.auth,0);assert.equal(h.button('확인한 출처 추가'),undefined);assert.deepEqual(h.buffer.content.sourceRefs,[]);assert.equal(h.calls.filter(c=>c.method==='POST').length,0);
 }finally{await h.close();}
});

test('같은 ApiClient transport 교체와 주체/선택ABA는 늦은본문·후속파일GET·401을 폐기한다',async()=>{
 const h=await mount('picker');try{
  let resolve!:(r:Response)=>void,started=false;h.setHandler(p=>p.includes('/documents/'+h.d.source.id+'/versions/')?new Promise<Response>(r=>{resolve=r;started=true;}):null);
  await h.click('출처 목록 조회');await h.click('출처 문서: 출처 문서');await h.click('출처 버전 원문 확인');await h.wait(()=>started);
  let newCalls=0;const old=h.client.transport;h.client.transport=async()=>{newCalls++;throw Error('새 transport의 후속GET 금지');};
  await h.ui.React.act(async()=>resolve(reply(h.d.source)));await h.flush();assert.equal(newCalls,0);assert.equal(h.button('확인한 출처 추가'),undefined);assert.deepEqual(h.buffer.content.sourceRefs,[]);
  h.client.transport=old;h.setHandler(null);await h.rerender({});
  let late!:(r:Response)=>void;h.setHandler(p=>p.includes('/documents/'+h.d.source.id+'/versions/')?new Promise<Response>(r=>{late=r;}):null);
  await h.click('출처 목록 조회');await h.click('출처 문서: 출처 문서');await h.click('출처 버전 원문 확인');
  await h.rerender({session:{...session,user:{id:id(97)},clientId:id(98)}});await h.rerender({session:{...session,user:{...session.user}}});
  await h.ui.React.act(async()=>late(reply({code:'AUTHENTICATION_REQUIRED'},401)));await h.flush();assert.equal(h.auth,0);assert.equal(h.button('확인한 출처 추가'),undefined);assert.deepEqual(h.buffer.content.sourceRefs,[]);assert.equal(h.calls.filter(c=>c.method==='POST').length,0);
 }finally{await h.close();}
});


test('실제 보호조회403은 출처선택을 만들지 않고 같은출처 중복은 기존목록을 보존한다',async()=>{
 const h=await mount('picker');try{
  h.setHandler(p=>p.includes('/documents/'+h.d.source.id+'/versions/')?reply({code:'ACCESS_DENIED'},403):null);
  await h.click('출처 목록 조회');await h.click('출처 문서: 출처 문서');await h.click('출처 버전 원문 확인');await h.wait(()=>h.container.textContent.includes('ACCESS_DENIED'));assert.deepEqual(h.buffer.content.sourceRefs,[]);assert.equal(h.button('확인한 출처 추가'),undefined);assert.equal(h.auth,0);
  h.setHandler(null);await h.click('출처 버전 원문 확인');await h.wait(()=>!!h.button('확인한 출처 추가'));await h.click('확인한 출처 추가');const before=structuredClone(h.buffer.content.sourceRefs);
  await h.click('출처 버전 원문 확인');await h.wait(()=>!!h.button('확인한 출처 추가'));await h.click('확인한 출처 추가');assert.deepEqual(h.buffer.content.sourceRefs,before);assert.ok(h.container.textContent.includes('DOCUMENT_SOURCE_DUPLICATED'));assert.equal(h.calls.filter(c=>c.method==='POST').length,0);
 }finally{await h.close();}
});

test('출처preview를 유지한 같은 문서의 일반 제목 편집은 source scope를 초기화하지 않는다',async()=>{
 const h=await mount();try{
  await h.click('출처 목록 조회');await h.click('출처 문서: 출처 문서');await h.click('출처 버전 원문 확인');await h.wait(()=>!!h.button('확인한 출처 추가'));
  const title=h.nodes().find(n=>n.tagName==='INPUT'&&n.value==='새 출처 문서');assert.ok(title);
  const props=Object.keys(title).find(k=>k.startsWith('__reactProps$'));assert.ok(props);
  await h.ui.React.act(async()=>{(title as any)[props].onChange({target:{value:'수정한 제목'}});});
  assert.equal(h.buffer.title,'수정한 제목');assert.ok(h.button('확인한 출처 추가'));await h.click('확인한 출처 추가');assert.equal(h.buffer.content.sourceRefs.length,1);assert.equal(h.calls.filter(c=>c.method==='POST').length,0);
 }finally{await h.close();}
});


test('부모가 완료 CAS를 거절한 뒤 외부buffer A→B→A가 복귀해도 옛 onSaved GET을 열지 않는다',async()=>{
 const h=await mount('page',false,false,true);try{
  await selectFour(h);await h.click('새 초안 버전 저장');await h.wait(()=>h.calls.filter(c=>c.method==='POST').length===2&&h.button('같은 저장 명령 결과 확인')?.disabled===false);
  const original=h.buffer,packet=structuredClone(original.pending.save),ref={id:h.stored.id,version:1,contentHash:h.stored.contentHash};
  assert.equal(original.savedRef,null);assert.equal(h.calls.filter(c=>c.path.includes('/documents/'+ref.id+'/versions/')).length,0);
  await h.setBuffer((b:any)=>({...b,documentId:id(95),baseVersion:1,body:'다른 buffer',pending:null,savedRef:null}));
  await h.setBuffer(()=>({...original,pending:null,savedRef:ref,documentId:ref.id,baseVersion:1}));await h.flush();
  assert.equal(h.calls.filter(c=>c.path.includes('/documents/'+ref.id+'/versions/')).length,0);assert.deepEqual(original.pending.save,packet);assert.equal(h.calls.filter(c=>c.method==='POST').length,2);
 }finally{await h.close();}
});
