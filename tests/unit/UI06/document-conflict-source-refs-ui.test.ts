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
const sources=[{kind:'DOCUMENT_VERSION',id:id(8),version:1,contentHash:'b'.repeat(64)},{kind:'CONVERSATION',id:id(9),contentHash:'c'.repeat(64)},{kind:'USER_INSTRUCTION',id:id(10),contentHash:'d'.repeat(64)},{kind:'ARTIFACT',id:id(11),contentHash:'e'.repeat(64)}];
// 실제 Page/Editor와 공개 API helper를 사용한다. GET/POST와 저장행은 메모리 모형이다.
async function mount(manual=false,refs:any[]=sources){
 const code=await bundle(),saved=new Map<string,PropertyDescriptor|undefined>(),channels:MessageChannel[]=[];
 const document:any=new MemoryNode('#document',9);document.ownerDocument=document;document.createElement=(n:string)=>new MemoryNode(n,1,document);document.createElementNS=(_n:string,n:string)=>document.createElement(n);document.createTextNode=(v:string)=>{const n=new MemoryNode('#text',3,document);n.data=v;return n;};document.documentElement=document.createElement('html');document.body=document.createElement('body');document.documentElement.appendChild(document.body);document.activeElement=document.body;const window={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,getComputedStyle:()=>({})};document.defaultView=window;
 const Native=globalThis.MessageChannel;class OwnedChannel extends Native{constructor(){super();channels.push(this);}}
 for(const[k,v]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,MessageChannel:OwnedChannel,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});}
 const ui=new Function(code)(),container=document.createElement('main');document.body.appendChild(container);const root=ui.createRoot(container),files=new Map<string,{ref:any;body:string}>();
 const file=(n:number,body:string)=>{const ref={artifactId:id(n),bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/plain;charset=utf-8'};files.set(ref.artifactId,{ref,body});return ref;};
 const oldForm={id:id(5),version:1,contentHash:'a'.repeat(64)},newForm=manual?{id:id(6),version:2,contentHash:'f'.repeat(64)}:oldForm;
 const wire=(version:number,body:any,refs:any[],form=oldForm,sections:any[]=[])=>{const content={body,attachments:[],sections,sourceRefs:structuredClone(refs)},title='고정 원문';return{id:id(20),version,title,formRef:form,stageNodeRef:null,content,sourceRefs:structuredClone(refs),contentHash:contentHash(canonicalJson({title,formRef:form,stageNodeRef:null,content})),confirmed:false,validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef:form,items:[]},contentReviews:[]};};
 const ownSources=[{kind:'ARTIFACT',id:id(30),contentHash:'9'.repeat(64)}],base=wire(2,file(12,'이전 고정 원문'),ownSources),latest=wire(3,file(13,'서버 최신 비공개 본문'),refs,newForm,[{itemId:'LATEST',anchor:'line:1'}]);
 let queued:any=null,defer=false;let latestBuffer:any,external:any,settings={session:{...session,user:{...session.user}},projectId:pid},auth=0,stored:any=null,lost=false,handler:((p:string,init:any)=>Response|Promise<Response>|null)|null=null;
 const calls:{path:string;method:string;packet?:any}[]=[];
 const transport=async(url:any,init:any)=>{const path=String(url),method=init?.method??'GET',packet=method==='POST'?(typeof init.body==='string'?JSON.parse(init.body):JSON.parse(init.headers['X-Anvil-Command'])):undefined;calls.push({path,method,...(packet?{packet}: {})});assert.ok(path.startsWith('/api/v1/'));assert.equal(init?.credentials,'same-origin');if(handler){const r=await handler(path,init);if(r)return r;}
  if(packet){const receipt={operationId:id(80),commandId:packet.commandId,projectId:pid,status:'APPLIED',serverReceivedAt:at};
   if(packet.operation==='uploadArtifact'){const ref=file(40,new TextDecoder().decode(init.body));assert.equal(ref.contentHash,packet.payload.contentHash);return reply({...receipt,targetId:ref.artifactId,version:null,data:{status:'ARTIFACT_READY',artifactRef:ref}});}
   assert.equal(packet.operation,'saveDocumentDraft');if(lost){lost=false;throw Error('합성 응답유실');}if(packet.expectedVersion===2)return reply({code:'VERSION_CONFLICT'},409);assert.equal(packet.expectedVersion,3);stored=wire(4,packet.payload.content.body,packet.payload.content.sourceRefs,packet.payload.formRef,packet.payload.content.sections);stored.title=packet.payload.title;stored.contentHash=contentHash(canonicalJson({title:stored.title,formRef:stored.formRef,stageNodeRef:null,content:stored.content}));return reply({...receipt,targetId:stored.id,version:4,data:{status:'DRAFT',ref:{id:stored.id,version:4,contentHash:stored.contentHash}}});
  }
  if(path==='/api/v1/projects/'+pid)return reply({id:pid,participation:'OWNER',controlState:{actorId:uid,clientId:cid,generation:1,status:'HELD'}});
  if(path.includes('/documents?'))return reply({items:[{id:latest.id,title:latest.title,headVersion:3,confirmedVersion:null,updatedAt:at}],hasMore:false,nextCursor:null,observedAt:at});
  if(path.endsWith('/documents/'+latest.id+'/versions/3'))return reply(latest);
  if(stored&&path.endsWith('/documents/'+stored.id+'/versions/4')){assert.ok(latestBuffer.savedRef,'고정 GET 전에 원 ref가 부모에 저장되어야 한다');return reply(stored);}
  if(path.includes('/files/')){const f=files.get(path.split('/').at(-1)!);assert.ok(f,'MEMORY_ARTIFACT_NOT_REGISTERED');return new Response(Buffer.from(f.body),{headers:{'content-type':'application/octet-stream'}});}
  throw Error('UNMODELED_CONFLICT_UI_REQUEST:'+path);
 };
 const client=new ui.ApiClient(transport);
 function Harness(){const[b,setB]=ui.React.useState(()=>({...ui.editDocument(pid,{document:base,body:files.get(base.content.body.artifactId)!.body},uid,1),title:'내 제목',body:'내 미저장 원문',reason:'명시 충돌조정',content:{attachments:[],sections:[{itemId:'INPUT',anchor:'line:1'}],sourceRefs:structuredClone(ownSources)},dirty:true}));const[view,setView]=ui.React.useState(settings);latestBuffer=b;external={setB,setView};return ui.React.createElement(ui.DocumentsPage,{client,projectId:view.projectId,session:view.session,buffer:b,onChange:(edit:any)=>{if(defer){defer=false;queued=edit;}else setB(edit);},review:null,onReviewChange:()=>{},confirmation:null,onConfirmationChange:()=>{},onAuthenticationLost:()=>{auth++;}});}
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))],button=(s:string)=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===s),flush=()=>ui.React.act(async()=>{await new Promise(resolve=>setImmediate(resolve));});
 const wait=async(check:()=>boolean)=>{for(let n=0;n<180&&!check();n++)await flush();assert.ok(check(),container.textContent);};
 const click=async(text:string)=>{const b=button(text);assert.ok(b,text);assert.equal(b.disabled,false,text);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const ack=async(manual=false)=>{const n=nodes().find(n=>n.tagName==='INPUT'&&n.parentNode?.textContent.includes(manual?'최신 양식·첨부·형식을 유지하고':'양쪽 내용을 비교했고'));assert.ok(n);const p=Object.keys(n).find(k=>k.startsWith('__reactProps$'))!;await ui.React.act(async()=>(n as any)[p].onChange({target:{checked:true}}));};
 await ui.React.act(async()=>root.render(ui.React.createElement(Harness)));
 return{client,container,nodes,button,click,ack,wait,flush,calls,latest,ownSources,get buffer(){return latestBuffer;},get auth(){return auth;},get stored(){return stored;},defer:()=>{defer=true;},commitQueued:async()=>{assert.ok(queued);const edit=queued;queued=null;await ui.React.act(async()=>external.setB((p:any)=>typeof edit==='function'?edit(p):edit));},lose:()=>{lost=true;},setHandler:(f:typeof handler)=>{handler=f;},setBuffer:async(f:any)=>ui.React.act(async()=>external.setB(f)),rerender:async(v:Partial<typeof settings>)=>{settings={...settings,...v};await ui.React.act(async()=>external.setView(settings));},close:async()=>{await ui.React.act(async()=>root.unmount());for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);}};
}
async function rejected(h:Awaited<ReturnType<typeof mount>>){await h.click('새 초안 버전 저장');await h.wait(()=>h.buffer.failure?.code==='VERSION_CONFLICT');assert.equal(h.buffer.pending.save.expectedVersion,2);}
test('실제409에서 4종 비교·ACK·KEEP_INPUT 조정 후 명시저장/고정GET은 내 refs를 보존한다',async()=>{
 const h=await mount();try{await rejected(h);const prior=structuredClone(h.buffer.pending),count=h.calls.filter(c=>c.method==='POST').length;await h.click('최신 버전과 비교');await h.wait(()=>!!h.nodes().find(n=>n.getAttribute('aria-label')==='문서 버전 충돌 비교'));assert.equal(h.container.textContent.includes('수동 조정이 필요합니다'),false);await h.ack();assert.equal(h.button('내 입력으로 새 기준 초안 준비')!.disabled,false);await h.click('내 입력으로 새 기준 초안 준비');assert.equal(h.buffer.pending,null);assert.deepEqual(h.buffer.content.sourceRefs,h.ownSources);assert.deepEqual(h.buffer.reconciliation.rejectedSnapshot,prior);assert.equal(h.calls.filter(c=>c.method==='POST').length,count);await h.click('새 초안 버전 저장');await h.wait(()=>!!h.buffer.savedRef);await h.wait(()=>h.calls.some(c=>c.path.endsWith('/versions/4')));assert.deepEqual(h.stored.sourceRefs,h.ownSources);}finally{await h.close();}
});
test('원 비교 GET중 scope 변경 뒤 늦은401은 새 auth/비교본문을 건드리지 않는다',async()=>{
 const h=await mount(false,[]);let release!:(r:Response)=>void;try{await rejected(h);let entered=false;h.setHandler(p=>p.includes('/documents?')?(entered=true,new Promise<Response>(r=>{release=r;})):null);await h.click('최신 버전과 비교');await h.wait(()=>entered);await h.rerender({session:{...session,csrfToken:'b'.repeat(43)}});release(reply({code:'AUTHENTICATION_REQUIRED'},401));await h.flush();await h.flush();assert.equal(h.auth,0);assert.equal(h.nodes().some(n=>n.getAttribute('aria-label')==='서버 최신 원문'),false);}finally{release?.(reply({},401));await h.close();}
});

test('실제409의 LATEST_METADATA는 최신4종 refs/양식과 내 원문·거절packet을 보존한다',async()=>{
 const h=await mount(true);try{await rejected(h);const rejectedPacket=structuredClone(h.buffer.pending),posts=h.calls.filter(c=>c.method==='POST').length;await h.click('최신 버전과 비교');await h.wait(()=>!!h.button('최신 양식·첨부로 수동 조정 초안 준비'));assert.equal(h.button('최신 양식·첨부로 수동 조정 초안 준비')!.disabled,true);assert.ok(h.nodes().find(n=>n.getAttribute('aria-label')==='충돌 양식·첨부·항목 비교')!.textContent.includes('USER_INSTRUCTION'));await h.ack(true);await h.click('최신 양식·첨부로 수동 조정 초안 준비');assert.deepEqual(h.buffer.content.sourceRefs,sources);assert.deepEqual(h.buffer.content.sections,[]);assert.deepEqual(h.buffer.formRef,h.latest.formRef);assert.equal(h.buffer.body,'내 미저장 원문');assert.deepEqual(h.buffer.reconciliation.rejectedSnapshot,rejectedPacket);assert.equal(h.calls.filter(c=>c.method==='POST').length,posts);await h.click('새 초안 버전 저장');await h.wait(()=>!!h.buffer.savedRef);await h.wait(()=>h.calls.some(c=>c.path.endsWith('/versions/4')));assert.deepEqual(h.stored.sourceRefs,sources);}finally{await h.close();}
});
test('성공한 비교도 외부buffer A/B/A·원pending clone·transport 변경에서 즉시 숨기고 POST0이다',async()=>{
 for(const mode of ['ABA','PENDING','TRANSPORT']){const h=await mount(false,[]);try{await rejected(h);await h.click('최신 버전과 비교');await h.wait(()=>h.nodes().some(n=>n.getAttribute('aria-label')==='서버 최신 원문'));const posts=h.calls.filter(c=>c.method==='POST').length,original=h.buffer;
  if(mode==='ABA'){await h.setBuffer((b:any)=>({...b,title:'B buffer'}));assert.equal(h.nodes().some(n=>n.getAttribute('aria-label')==='서버 최신 원문'),false);await h.setBuffer(()=>original);}
  else if(mode==='PENDING')await h.setBuffer((b:any)=>({...b,pending:structuredClone(b.pending)}));
  else{const old=h.client.transport;h.client.transport=async(...args:any[])=>old(...args);await h.rerender({});}
  assert.equal(h.nodes().some(n=>n.getAttribute('aria-label')==='서버 최신 원문'),false);assert.equal(h.calls.filter(c=>c.method==='POST').length,posts);
 }finally{await h.close();}}
});
test('채택 부모CAS가 지연된 동안 같은command ID의 다른buffer가 오면 덮어쓰기/POST0이다',async()=>{
 const h=await mount(false,[]);try{await rejected(h);await h.click('최신 버전과 비교');await h.wait(()=>h.nodes().some(n=>n.getAttribute('aria-label')==='서버 최신 원문'));await h.ack();const command=h.buffer.pending.saveCommandId,posts=h.calls.filter(c=>c.method==='POST').length;h.defer();await h.click('내 입력으로 새 기준 초안 준비');assert.ok(h.buffer.pending);await h.setBuffer((b:any)=>({...b,reason:'같은 명령의 별도 buffer',pending:structuredClone(b.pending)}));const before=h.buffer;assert.equal(before.pending.saveCommandId,command);await h.commitQueued();assert.equal(h.buffer===before,true);assert.equal(h.buffer.reconciliation,undefined);assert.equal(h.calls.filter(c=>c.method==='POST').length,posts);}finally{await h.close();}
});
test('UNKNOWN 원packet은 뒤409에도 잠기며 비교/새명령을 만들지 않는다',async()=>{
 const h=await mount();try{const lists=h.calls.filter(c=>c.path.includes('/documents?')).length;h.lose();await h.click('새 초안 버전 저장');await h.wait(()=>h.buffer.saveUncertain===true);const pending=structuredClone(h.buffer.pending),packet=h.calls.filter(c=>c.packet?.operation==='saveDocumentDraft').at(-1)!.packet;assert.equal(h.button('최신 버전과 비교'),undefined);await h.click('같은 저장 명령 결과 확인');await h.wait(()=>h.buffer.failure?.code==='VERSION_CONFLICT');assert.equal(h.buffer.saveUncertain,true);assert.equal(h.button('최신 버전과 비교'),undefined);assert.deepEqual(h.buffer.pending,pending);assert.deepEqual(h.calls.filter(c=>c.packet?.operation==='saveDocumentDraft').at(-1)!.packet,packet);assert.equal(h.calls.filter(c=>c.path.includes('/documents?')).length,lists);}finally{await h.close();}
});

test('metadata 대기중 CSRF·transport·선택ABA 이탈은 늦은성공의 본문 GET/비교를 만들지 않는다',async()=>{
 for(const mode of ['CSRF','TRANSPORT','ABA']){const h=await mount(false,[]);let release!:(v:Response)=>void;try{await rejected(h);let entered=false;h.setHandler(p=>p.endsWith('/versions/3')?(entered=true,new Promise<Response>(r=>{release=r;})):null);await h.click('최신 버전과 비교');await h.wait(()=>entered);const posts=h.calls.filter(c=>c.method==='POST').length;
  if(mode==='CSRF')await h.rerender({session:{...session,csrfToken:'b'.repeat(43)}});
  else if(mode==='TRANSPORT'){const original=h.client.transport;h.client.transport=async(...args:any[])=>original(...args);}
  else{const a=h.buffer;await h.setBuffer((b:any)=>({...b,title:'B'}));await h.setBuffer(()=>a);}
  release(reply(h.latest));await h.flush();await h.flush();assert.equal(h.calls.some(c=>c.path.endsWith('/files/'+id(13))),false);assert.equal(h.nodes().some(n=>n.getAttribute('aria-label')==='서버 최신 원문'),false);assert.equal(h.auth,0);assert.equal(h.calls.filter(c=>c.method==='POST').length,posts);
 }finally{release?.(reply(h.latest));await h.close();}}
});
test('현재 비교권한403은 원 pending/입력 보존·조정0·추가POST0이다',async()=>{
 const h=await mount();try{await rejected(h);const before=structuredClone(h.buffer.pending),posts=h.calls.filter(c=>c.method==='POST').length;h.setHandler(p=>p==='/api/v1/projects/'+pid?reply({code:'ACCESS_DENIED'},403):null);await h.click('최신 버전과 비교');await h.wait(()=>h.container.textContent.includes('ACCESS_DENIED'));assert.deepEqual(h.buffer.pending,before);assert.equal(h.buffer.reconciliation,undefined);assert.equal(h.nodes().some(n=>n.getAttribute('aria-label')==='서버 최신 원문'),false);assert.equal(h.calls.filter(c=>c.method==='POST').length,posts);}finally{await h.close();}
});

test('새 비교 요청 뒤 늦게 실행된 이전 채택CAS는 같은 원 pending이어도 무효다',async()=>{
 const h=await mount(false,[]);try{await rejected(h);await h.click('최신 버전과 비교');await h.wait(()=>h.nodes().some(n=>n.getAttribute('aria-label')==='서버 최신 원문'));await h.ack();h.defer();await h.click('내 입력으로 새 기준 초안 준비');const before=h.buffer;await h.click('최신 버전과 비교');await h.wait(()=>h.nodes().some(n=>n.getAttribute('aria-label')==='서버 최신 원문'));await h.commitQueued();assert.equal(h.buffer===before,true);assert.equal(h.buffer.reconciliation,undefined);}finally{await h.close();}
});
