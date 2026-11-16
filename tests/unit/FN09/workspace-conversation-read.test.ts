import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const reader=await import(new URL('../../../apps/web/src/features/workspace/workspace-conversation-reader.ts',import.meta.url).href).catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const presenter=await import(new URL('../../../apps/web/src/features/workspace/conversation-source-read-only.ts',import.meta.url).href).catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const pid='11111111-1111-4111-8111-111111111111',cid='22222222-2222-4222-8222-222222222222',mid='33333333-3333-4333-8333-333333333333',uid='44444444-4444-4444-8444-444444444444',at='2026-10-18T05:00:00Z';
function fixture(){
 const body='<script>window.RUN=1</script>\n개발 주도권은 사용자에게 있다',authorRef={kind:'HUMAN' as const,userId:uid},message={kind:'USER_INSTRUCTION' as const,bodyRef:{artifactId:uid,bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/plain;charset=utf-8' as const},attachmentRefs:[] as never[],replyTo:null,supersedesInstructionRef:{kind:'CONVERSATION' as const,id:uid,contentHash:'c'.repeat(64)},effectiveScope:{projectId:pid,stageRefs:[] as never[],taskRefs:[] as never[]}};
 const sourceRef={kind:'CONVERSATION' as const,id:mid,contentHash:contentHash(canonicalJson({conversationId:cid,targetRoleRef:null,message,sourceRefs:[],serverSequence:2,authorRef}))},source={sourceRef,conversationId:cid,serverSequence:2,authorRef,message,body,deliveryState:'STORED' as const,redactionState:'NOT_REDACTED' as const,sensitiveInspection:'KNOWN_PATTERNS_ONLY' as const,recordedAt:at};
 const conversations={items:[{id:cid,headSequence:2,targetRoleRef:null,updatedAt:at,integrity:'NOT_RECHECKED' as const}],hasMore:false,nextCursor:null,observedAt:at};
 const messages={conversationId:cid,observedHeadSequence:2,items:[{sourceRef,serverSequence:2,authorRef,kind:message.kind,replyTo:null,supersedesInstructionRef:message.supersedesInstructionRef,recordedAt:at,deliveryState:'STORED' as const}],hasMore:false,nextCursor:null,observedAt:at};
 return{body,sourceRef,source,conversations,messages};
}
function make(client:ApiClient,onState=(value:any)=>{},onAuth=()=>{}){assert.equal(typeof reader.WorkspaceConversationReader,'function');return new reader.WorkspaceConversationReader(client,pid,onState,onAuth);}
test('목록→대화→정확 발언 GET으로 원문을 읽고 저장·전달·효력을 구분한다',async()=>{
 const f=fixture(),calls:string[]=[],client=new ApiClient(async(path,init)=>{calls.push(String(path));assert.equal(init?.method,'GET');assert.equal(init.credentials,'same-origin');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');if(String(path).endsWith('/messages/'+mid))return Response.json(f.source);if(String(path).includes('/messages?'))return Response.json(f.messages);return Response.json(f.conversations);});
 const model=make(client);await model.list();assert.equal(model.state.source,null);await model.open(cid);await model.read(f.sourceRef);assert.equal(model.state.source?.body,f.body);assert.equal(calls.length,3);
 assert.equal(typeof presenter.ConversationSourceReadOnly,'function');const html=renderToStaticMarkup(createElement(presenter.ConversationSourceReadOnly,{source:model.state.source}));
 for(const value of ['사용자 지시 원문','서버 순번 2',mid,f.sourceRef.contentHash,'정정 대상',uid,'현재 유효한 지시 선별·임무 맥락 편입은 미판정','Agent 전달·수신·이해 확인이 아닙니다.'])assert.ok(html.includes(value),value);
 assert.ok(html.includes('&lt;script&gt;window.RUN=1&lt;/script&gt;'));assert.equal(html.includes('<script>'),false);assert.equal(html.includes('<button'),false);model.dispose();
});
test('목록 밖 참조는 조회하지 않고 본문 변조·401 뒤 이전 원문을 남기지 않는다',async()=>{
 const f=fixture();let mode='valid',sourceCalls=0,auth=0;const client=new ApiClient(async(path)=>{if(String(path).endsWith('/messages/'+mid)){sourceCalls++;return mode==='401'?Response.json({code:'AUTH_REQUIRED'},{status:401}):Response.json(mode==='bad'?{...f.source,body:'변조'}:f.source);}return Response.json(String(path).includes('/messages?')?f.messages:f.conversations);});
 const model=make(client,()=>{},()=>auth++);await model.list();await model.open(cid);await model.read({...f.sourceRef,contentHash:'f'.repeat(64)});assert.equal(sourceCalls,0);assert.equal(model.state.source,null);assert.equal(model.state.error?.code,'CONVERSATION_SELECTION_INVALID');
 await model.read(f.sourceRef);assert.equal(model.state.source?.body,f.body);mode='bad';await model.read(f.sourceRef);assert.equal(model.state.source,null);assert.equal(model.state.error?.code,'CONVERSATION_INTEGRITY_FAILED');mode='401';await model.read(f.sourceRef);assert.equal(model.state.source,null);assert.equal(auth,1);model.dispose();
});
test('해제 뒤 늦은 응답과 재사용은 상태·인증 콜백이나 새 조회를 만들지 않는다',async()=>{
 let release!:(value:Response)=>void,calls=0;const gate=new Promise<Response>(resolve=>{release=resolve;}),states:any[]=[];const model=make(new ApiClient(async()=>{calls++;return gate;}),value=>states.push(value));const pending=model.list();const count=states.length;model.dispose();release(Response.json(fixture().conversations));await pending;assert.equal(states.length,count);await model.list();assert.equal(calls,1);
});

function correctionFixture(kind:'USER_INSTRUCTION'|'USER_MESSAGE'='USER_INSTRUCTION',sequence=1){
 const f=fixture(),previous=structuredClone(f.source);previous.body='정정 전 보존된 사용자 원칙';previous.serverSequence=sequence;previous.message.kind=kind as any;previous.message.supersedesInstructionRef=null as any;previous.message.bodyRef={...previous.message.bodyRef,bytes:Buffer.byteLength(previous.body),contentHash:contentHash(Buffer.from(previous.body))};
 const digest=(value:any)=>contentHash(canonicalJson({conversationId:cid,targetRoleRef:null,message:value.message,sourceRefs:[],serverSequence:value.serverSequence,authorRef:value.authorRef}));
 previous.sourceRef={kind:'CONVERSATION',id:uid,contentHash:digest(previous)};f.source.message.supersedesInstructionRef=previous.sourceRef;f.messages.items[0]!.supersedesInstructionRef=previous.sourceRef;f.sourceRef.contentHash=digest(f.source);
 return{...f,previous};
}
function correctionReader(f:ReturnType<typeof correctionFixture>){const calls:string[]=[];const client=new ApiClient(async(path)=>{calls.push(String(path));if(String(path).endsWith('/messages/'+uid))return Response.json(f.previous);if(String(path).endsWith('/messages/'+mid))return Response.json(f.source);return Response.json(String(path).includes('/messages?')?f.messages:f.conversations);});return{model:make(client),calls};}
test('목록 밖 이전 지시도 현재 원문의 정확 정정 ref로만 같은 대화에서 읽는다',async()=>{
 const f=correctionFixture(),{model,calls}=correctionReader(f);assert.equal(typeof model.previous,'function');await model.list();await model.open(cid);await model.read(f.sourceRef);await model.previous();assert.equal(model.state.source?.body,'정정 전 보존된 사용자 원칙');assert.equal(model.state.source?.serverSequence,1);assert.equal(calls.at(-1),`/api/v1/projects/${pid}/conversations/${cid}/messages/${uid}`);assert.equal(calls.length,4);await model.previous();assert.equal(calls.length,4);assert.equal(model.state.source,null);assert.equal(model.state.error?.code,'CONVERSATION_PREVIOUS_UNAVAILABLE');model.dispose();
});
test('정정 참조가 유효해도 이전 순번이 아니거나 사용자 발언이면 원문을 채택하지 않는다',async()=>{
 for(const f of [correctionFixture('USER_INSTRUCTION',2),correctionFixture('USER_MESSAGE',1)]){const {model}=correctionReader(f);assert.equal(typeof model.previous,'function');await model.list();await model.open(cid);await model.read(f.sourceRef);await model.previous();assert.equal(model.state.source,null);assert.equal(model.state.error?.code,'CONVERSATION_PREVIOUS_INVALID');model.dispose();}
});
function replyFixture(kind:'USER_MESSAGE'|'USER_INSTRUCTION'='USER_MESSAGE',sequence=1){
 const f=correctionFixture(kind,sequence);
 const message={...f.source.message,replyTo:{...f.previous.sourceRef},supersedesInstructionRef:null};
 const sourceRef={...f.sourceRef,contentHash:contentHash(canonicalJson({conversationId:cid,targetRoleRef:null,message,sourceRefs:[],serverSequence:2,authorRef:f.source.authorRef}))};
 const source={...f.source,message,sourceRef},item={...f.messages.items[0]!,replyTo:message.replyTo,supersedesInstructionRef:null,sourceRef};
 return{...f,sourceRef,source,messages:{...f.messages,items:[item]}};
}
function replyTransport(f:ReturnType<typeof replyFixture>,responses:()=>Promise<Response>|Response=()=>Response.json(f.previous)){
 const calls:string[]=[];
 const transport:typeof fetch=async(path,opts)=>{
  assert.equal(opts?.method,'GET');assert.equal(opts.credentials,'same-origin');
  const url=String(path);calls.push(url);
  if(url===`/api/v1/projects/${pid}/conversations/${cid}/messages/${uid}`)return responses();
  if(url===`/api/v1/projects/${pid}/conversations/${cid}/messages/${mid}`)return Response.json(f.source);
  return Response.json(url.includes('/messages?')?f.messages:f.conversations);
 };
 return{calls,transport};
}
test('답글에서 목록 밖 원 발언을 정확 GET 1회로 열고 원 발언에 답글 대상이 없으면 추가 GET은 없다',async()=>{
 for(const kind of ['USER_MESSAGE','USER_INSTRUCTION'] as const){
  const f=replyFixture(kind),{calls,transport}=replyTransport(f);
  const model=make(new ApiClient(transport));
  try{
   await model.list();await model.open(cid);await model.read(f.sourceRef);
   assert.equal(model.state.source?.body,f.body);assert.equal(calls.length,3);
   await model.replyOriginal();
   assert.deepEqual(model.state.source,f.previous);assert.equal(calls.length,4);
   assert.equal(calls.at(-1),`/api/v1/projects/${pid}/conversations/${cid}/messages/${uid}`);
   await model.replyOriginal();assert.equal(calls.length,4);
   assert.equal(model.state.source,null);assert.equal(model.state.error?.code,'CONVERSATION_REPLY_UNAVAILABLE');
  }finally{model.dispose();}
 }
});
test('답글 대상의 대화·ref·본문·순번·권한 및 네트워크 오류에서 이전 원문을 제거한다',async()=>{
 for(const mode of ['conversation','hash','body','same','later','403','401','network']){
  const f=replyFixture('USER_MESSAGE',mode==='same'?2:mode==='later'?3:1);
  const {calls,transport}=replyTransport(f,()=>{
   if(mode==='401'||mode==='403')return Response.json({code:mode==='401'?'AUTH_REQUIRED':'FORBIDDEN'},{status:Number(mode)});
   if(mode==='network')throw Error('memory transport failed');
   const original=structuredClone(f.previous);
   if(mode==='hash')original.sourceRef.contentHash='f'.repeat(64);
   if(mode==='conversation')original.conversationId=pid;
   if(mode==='body')original.body+='변조';
   return Response.json(original);
  });
  let auth=0;const model=make(new ApiClient(transport),()=>{},()=>auth++);
  try{
   await model.list();await model.open(cid);await model.read(f.sourceRef);assert.deepEqual(model.state.source,f.source);
   await model.replyOriginal();assert.equal(calls.length,4);assert.equal(model.state.source,null);
   const code=mode==='same'||mode==='later'?'CONVERSATION_REPLY_INVALID':mode==='body'?'CONVERSATION_INTEGRITY_FAILED':
    mode==='401'?'AUTH_REQUIRED':mode==='403'?'FORBIDDEN':mode==='network'?'CONNECTION_LOST':'RESPONSE_INVALID';
   assert.equal(model.state.error?.code,code);assert.equal(auth,mode==='401'?1:0);
  }finally{model.dispose();}
 }
});
test('답글 대상 GET 중 연속 진입과 해제 후 늦은 200·401은 추가 조회·상태·인증 콜백을 만들지 않는다',async()=>{
 for(const status of [200,401]){
  const f=replyFixture();let release!:(v:Response)=>void;
  const {calls,transport}=replyTransport(f,()=>new Promise(resolve=>{release=resolve;}));
  let states=0,auth=0;const model=make(new ApiClient(transport),()=>states++,()=>auth++);
  await model.list();await model.open(cid);await model.read(f.sourceRef);
  const pending=model.replyOriginal();await model.replyOriginal();
  assert.equal(model.state.pending,true);assert.equal(model.state.source,null);assert.equal(calls.length,4);
  model.dispose();const before=states;release(Response.json(status===200?f.previous:{code:'AUTH_REQUIRED'},{status}));
  await pending;await model.replyOriginal();assert.equal(states,before);assert.equal(auth,0);
  assert.equal(calls.length,4);assert.equal(model.state.source,null);
 }
});

// UI04 기존 ReactDOM 메모리 노드로 실제 버튼의 이벤트와 원문 표시를 관찰한다.
class MemoryNode{
 nodeType:number;nodeName:string;tagName:string;localName:string;namespaceURI='http://www.w3.org/1999/xhtml';parentNode:MemoryNode|null=null;childNodes:MemoryNode[]=[];ownerDocument:any;attributes=new Map<string,string>();style:Record<string,unknown>={};listeners=new Map<string,Function[]>();value='';checked=false;disabled=false;data='';
 constructor(name:string,type=1,owner?:any){this.nodeType=type;this.nodeName=type===1?name.toUpperCase():name;this.tagName=this.nodeName;this.localName=name;this.ownerDocument=owner;}
 get options():MemoryNode[]{return this.childNodes.flatMap(n=>n.tagName==='OPTION'?[n]:n.options);}
 get firstChild():MemoryNode|null{return this.childNodes[0]??null;}get lastChild():MemoryNode|null{return this.childNodes.at(-1)??null;}get nextSibling():MemoryNode|null{const a=this.parentNode?.childNodes;return a?.[a.indexOf(this)+1]??null;}
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
test('작업대 답글의 원 발언 버튼은 성공한 조회 뒤에 표시되고 클릭하면 목록 밖 본문을 연다',async()=>{
 const {build}=await import('vite');
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/workspace/WorkspaceConversationSources.tsx',import.meta.url));
 const clientEntry=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url));
 const built=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',
  define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,
   lib:{entry:'virtual:reply',name:'ReplyUI',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},
  plugins:[{name:'reply-memory',resolveId(id){if(id.endsWith('virtual:reply'))return '\0reply';},
   load(id){if(id==='\0reply')return `export * as React from 'react';export {createRoot} from 'react-dom/client';export {WorkspaceConversationSources} from ${JSON.stringify(entry)};export {ApiClient} from ${JSON.stringify(clientEntry)};`;}}]});
 const doc:any=new MemoryNode('#document',9);doc.ownerDocument=doc;
 doc.createElement=(n:string)=>new MemoryNode(n,1,doc);doc.createElementNS=(_ns:string,n:string)=>doc.createElement(n);
 doc.createTextNode=(value:string)=>{const n=new MemoryNode('#text',3,doc);n.data=value;return n;};
 doc.documentElement=doc.createElement('html');doc.body=doc.createElement('body');doc.documentElement.appendChild(doc.body);doc.activeElement=doc.body;
 doc.defaultView={document:doc,Node:MemoryNode,HTMLElement:MemoryNode,HTMLIFrameElement:class{},location:{protocol:'https:'}};
 const saved=new Map<string,PropertyDescriptor|undefined>(),channels:MessageChannel[]=[];
 class OwnedChannel extends MessageChannel{constructor(){super();channels.push(this);}}
 const f=replyFixture(),{calls,transport}=replyTransport(f);let root:any,ui:any;const container=doc.createElement('div');doc.body.appendChild(container);
 try{
  for(const [key,value] of Object.entries({window:doc.defaultView,document:doc,Node:MemoryNode,HTMLElement:MemoryNode,MessageChannel:OwnedChannel,IS_REACT_ACT_ENVIRONMENT:true})){
   saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  }
  const output=(Array.isArray(built)?built[0]:built) as import('rolldown').RolldownOutput;
  ui=new Function(output.output[0].code+';return ReplyUI;')();root=ui.createRoot(container);
  const nodes=(n:MemoryNode):MemoryNode[]=>[n,...n.childNodes.flatMap(nodes)];
  const button=(label:string)=>nodes(container).find(n=>n.tagName==='BUTTON'&&n.textContent===label);
  const click=async(label:string)=>{const b=button(label);assert.ok(b&&!b.disabled,label);await ui.React.act(async()=>{b.dispatchEvent({type:'click',button:0,bubbles:true});});};
  async function until(check:()=>boolean){for(let i=0;i<100&&!check();i++)await ui.React.act(async()=>{await new Promise(r=>setTimeout(r,2));});assert.ok(check());}
  const label='답글의 원 발언 열기';
  await ui.React.act(async()=>root.render(ui.React.createElement(ui.WorkspaceConversationSources,{client:new ui.ApiClient(transport),projectId:pid,onAuthenticationLost:()=>assert.fail('인증 콜백')})));
  assert.equal(button(label),undefined);assert.equal(calls.length,0);
  await click('사용자 대화 목록 조회');await click('대화 발언 목록 열기: '+cid);await click('발언 원문 열기: 2');await until(()=>!!button(label));
  assert.equal(calls.length,3);await click(label);await until(()=>container.textContent.includes(f.previous.body));
  assert.equal(button(label),undefined);assert.equal(calls.length,4);assert.equal(calls.at(-1),`/api/v1/projects/${pid}/conversations/${cid}/messages/${uid}`);
 }finally{
  if(root)await ui.React.act(async()=>root.unmount());doc.body.removeChild(container);
  for(const channel of channels){channel.port1.close();channel.port2.close();}
  for(const [key,descriptor] of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);
 }
});
