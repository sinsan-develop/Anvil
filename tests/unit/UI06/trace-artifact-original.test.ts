import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
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
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/design-trace/TraceViewer.tsx',import.meta.url));
 const api=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url));
 const result:any=await build({configFile:false,envFile:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:trace-artifact',name:'TraceArtifactTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'trace-memory-entry',resolveId(id){if(id.endsWith('virtual:trace-artifact'))return '\0trace-artifact';},load(id){if(id==='\0trace-artifact')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{TraceViewer}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(api)};export{React,createRoot,TraceViewer,ApiClient};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return TraceArtifactTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const body='<script>민감하지 않은 RAM 원문</script> & 텍스트',bodyB='다른 산출물 원문';
const artifact=(n=2,text=body)=>({kind:'ARTIFACT' as const,id:id(n),versionRef:{id:id(n),version:1,contentHash:contentHash(Buffer.from(text))}});
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}
function bytes(text=body){return new Response(Buffer.from(text),{headers:{'content-type':'application/octet-stream'}});}
async function fixture(){
 const designRef={id:id(4),version:2,contentHash:'d'.repeat(64)},a=artifact(),b=artifact(3,bodyB),calls:{path:string;options:RequestInit|undefined}[]=[];
 const controls={file:async(path:string)=>bytes(path.endsWith('/'+b.id)?bodyB:body)};let lost=0;
 const transport:typeof fetch=async(path,options)=>{const p=String(path);calls.push({path:p,options});assert.equal(options?.method,'GET');
 if(p.includes('/files/'))return controls.file(p);
 assert(p.includes('/traces?'));const q=new URL(p,'https://anvil.invalid').searchParams,ref={id:q.get('designId'),version:Number(q.get('version')),contentHash:designRef.contentHash},direction=q.get('direction');
 // 서버 traces.link의 허용 관계: ARTIFACT → PLAN_TASK / IMPLEMENTS.
 const task={kind:'PLAN_TASK',id:id(6),versionRef:{id:id(6),version:1,contentHash:'e'.repeat(64)},localCode:'FN01'};
 const edges=[a,b].map((source,index)=>{const data={from:source,to:task,relation:'IMPLEMENTS',reason:'저장 산출물 연결',designRefs:[ref]};return{id:id(10+index),...data,edgeHash:contentHash(canonicalJson(data)),createdAt:'2026-11-17T00:00:00Z'};});
 return Response.json({designRef:ref,direction,nodes:[{ref:a,title:'산출물 A',designRefs:[]},{ref:b,title:'산출물 B',designRefs:[]},{ref:task,title:'FN01 작업',designRefs:[ref]}],edges,traversal:edges.map(e=>({edgeId:e.id,from:direction==='FORWARD'?e.from:e.to,to:direction==='FORWARD'?e.to:e.from})),missingLinks:[],unknownEvidence:[{code:'EXECUTION_SOURCE_NOT_CONNECTED'},{code:'TEST_EVIDENCE_SOURCE_NOT_CONNECTED'}],baselineRef:null,hasMore:false,nextCursor:null,observedAt:edges[0]!.createdAt});
 };
 const client=new ui.ApiClient(transport),container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 let props={key:'session-a',client,projectId:id(1),designRef,onAuthenticationLost:()=>{lost++;}};
 const nodes=(n=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))];
 const button=(label:string)=>{const found=nodes().filter(n=>n.tagName==='BUTTON'&&n.textContent===label);assert.equal(found.length,1,label);return found[0]!;};
 const render=async(next=props)=>{props=next;await ui.React.act(async()=>root.render(ui.React.createElement(ui.TraceViewer,props)));};
 const click=async(label:string)=>{const n=button(label);assert(!n.disabled);await ui.React.act(async()=>n.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const settle=async()=>{await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});};
 const waitFor=async(check:()=>boolean)=>{for(let n=0;!check()&&n<100;n++)await ui.React.act(async()=>{await new Promise(r=>setTimeout(r,2));});assert(check(),container.textContent);};
 const close=async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);};
 await render();await waitFor(()=>container.textContent.includes('저장 산출물 연결'));
 return{a,b,client,calls,controls,lost:()=>lost,props:()=>props,render,click,settle,waitFor,close,nodes,text:()=>container.textContent,files:()=>calls.filter(c=>c.path.includes('/files/'))};
}
test('등록 산출물은 명시 클릭 GET1 뒤 exact SHA의 원문을 plain text로 표시하고 실행 연결을 주장하지 않는다',async()=>{
 const f=await fixture();try{assert.equal(f.files().length,0);await f.click('산출물 A 등록 산출물 텍스트 원문 보기');await f.waitFor(()=>f.text().includes(body));assert.equal(f.files().length,1);assert.equal(f.files()[0]!.path,`/api/v1/projects/${id(1)}/files/${f.a.id}`);assert.equal(f.files()[0]!.options?.credentials,'same-origin');assert.equal(f.files()[0]!.options?.redirect,'error');assert.equal(f.files()[0]!.options?.cache,'no-store');assert.equal(f.nodes().filter(n=>n.tagName==='SCRIPT').length,0);assert(f.nodes().some(n=>n.tagName==='PRE'&&n.textContent===body));assert.match(f.text(),/실제 실행\/시험 증거는 아직 미연결/);await f.click('등록 산출물 원문 닫기');assert(!f.text().includes(body));assert.equal(f.files().length,1);}finally{await f.close();}
});

for(const status of [401,403,404])test('현재 산출물 GET '+status+'는 원문 비노출과 현재401만 인증 소실',async()=>{
 const f=await fixture();try{f.controls.file=async()=>new Response(null,{status});await f.click('산출물 A 등록 산출물 텍스트 원문 보기');await f.waitFor(()=>f.text().includes('ARTIFACT_READ_FAILED'));assert(!f.text().includes(body));assert.equal(f.lost(),status===401?1:0);assert.equal(f.files().length,1);}finally{await f.close();}
});
for(const kind of ['HASH','UTF8','NUL','MEDIA','LIMIT'])test('명시 원문 '+kind+' 실패는 보호 원문을 표시하지 않는다',async()=>{
 const f=await fixture();try{
  if(kind==='HASH')f.controls.file=async()=>bytes('해시가 다른 원문');
  // 참조 해시와 먼저 충돌하는 UI 오류는 본문 표시를 허용하지 않는다. UTF8/NUL 고유 검산은 아래 reader 시험에서 확인한다.
  if(kind==='UTF8')f.controls.file=async()=>new Response(new Uint8Array([0xff]),{headers:{'content-type':'application/octet-stream'}});
  if(kind==='NUL')f.controls.file=async()=>bytes('x\0y');
  if(kind==='MEDIA')f.controls.file=async()=>new Response(body,{headers:{'content-type':'text/html'}});
  if(kind==='LIMIT')f.controls.file=async()=>new Response(new Uint8Array(2*1024*1024+1),{headers:{'content-type':'application/octet-stream'}});
  await f.click('산출물 A 등록 산출물 텍스트 원문 보기');await f.waitFor(()=>f.nodes().some(n=>n.getAttribute('role')==='alert'));
  assert.equal(f.nodes().filter(n=>n.tagName==='PRE').length,0);assert.equal(f.files().length,1);assert.equal(f.lost(),0);
 }finally{await f.close();}
});
for(const change of ['CLOSE','SELECT_B','RESELECT_A','PROJECT','DESIGN','SESSION','CLIENT','TRANSPORT','ABA','REFRESH','UNMOUNT']as const)for(const status of [200,401])test('산출물 지연 '+status+'는 '+change+' 뒤 원문/인증 효과0',async()=>{
 const f=await fixture(),gate=deferred<Response>();let closed=false;try{
  f.controls.file=()=>gate.promise;await f.click('산출물 A 등록 산출물 텍스트 원문 보기');assert.equal(f.files().length,1);const original=f.props();
  f.controls.file=async(path)=>bytes(path.endsWith('/'+f.b.id)?bodyB:body);
  if(change==='CLOSE')await f.click('등록 산출물 원문 닫기');
  if(change==='SELECT_B'){await f.click('산출물 B 등록 산출물 텍스트 원문 보기');await f.waitFor(()=>f.text().includes(bodyB));}
  if(change==='RESELECT_A'){await f.click('산출물 A 등록 산출물 텍스트 원문 보기');await f.waitFor(()=>f.text().includes(body));}
  if(change==='PROJECT')await f.render({...original,projectId:id(8)});
  if(change==='DESIGN')await f.render({...original,designRef:{...original.designRef,version:3}});
  if(change==='SESSION')await f.render({...original,key:'session-b'});
  if(change==='CLIENT')await f.render({...original,client:new ui.ApiClient(f.client.transport)});
  if(change==='TRANSPORT'){f.client.transport=async()=>{throw Error('새 transport 사용금지');};await f.render(original);}
  if(change==='ABA'){await f.render({...original,projectId:id(8)});await f.render(original);}
  if(change==='REFRESH')await f.click('업무 연결 새로고침');
  if(change==='UNMOUNT'){await f.close();closed=true;}
  gate.resolve(status===200?bytes():new Response(null,{status}));await f.settle();assert.equal(f.lost(),0);
  if(change==='SELECT_B'){assert(f.text().includes(bodyB));assert(!f.text().includes(body));}else if(change==='RESELECT_A')assert(f.text().includes(body));else assert(!f.text().includes(body));
  assert.equal(f.files().length,['SELECT_B','RESELECT_A'].includes(change)?2:1);
 }finally{gate.resolve(bytes());if(!closed)await f.close();}
});
test('이미 표시된 원문은 다른 선택/재조회/문맥 교체에 남지 않는다',async()=>{
 const f=await fixture();try{await f.click('산출물 A 등록 산출물 텍스트 원문 보기');await f.waitFor(()=>f.text().includes(body));
 await f.click('산출물 B 등록 산출물 텍스트 원문 보기');await f.waitFor(()=>f.text().includes(bodyB));assert(!f.text().includes(body));
 await f.click('업무 연결 새로고침');assert(!f.text().includes(bodyB));await f.waitFor(()=>f.text().includes('저장 산출물 연결'));assert.equal(f.files().length,2);
 await f.click('산출물 A 등록 산출물 텍스트 원문 보기');await f.waitFor(()=>f.text().includes(body));await f.render({...f.props(),key:'새 주체'});assert(!f.text().includes(body));assert.equal(f.files().length,3);
 }finally{await f.close();}
});

test('reader는 닫힌 ARTIFACT exact ref와 project만 허용하며 inactive/형상 오류는 GET0',async()=>{
 const {readTraceArtifactOriginal:read}=await import('../../../apps/web/src/features/design-trace/trace-artifact-original.ts');let calls=0;const client=new ApiClient(async()=>{calls++;return bytes();});
 await assert.rejects(read(client,id(1),artifact(),()=>false),{code:'TRACE_ARTIFACT_READ_PAUSED'});
 for(const target of [{...artifact(),kind:'DOCUMENT_VERSION'},{...artifact(),localCode:'extra'},{...artifact(),id:id(9)},{...artifact(),versionRef:{...artifact().versionRef,version:2}}])await assert.rejects(read(client,id(1),target as any,()=>true),{code:'TRACE_ARTIFACT_REFERENCE_INVALID'});
 await assert.rejects(read(client,'../other',artifact(),()=>true),{code:'TRACE_ARTIFACT_REFERENCE_INVALID'});assert.equal(calls,0);
});
for(const raw of [new Uint8Array([0xff]),new TextEncoder().encode('a\0b')])test('해시 일치해도 fatal UTF8/NUL 원문 거절 '+raw.length,async()=>{
 const {readTraceArtifactOriginal:read}=await import('../../../apps/web/src/features/design-trace/trace-artifact-original.ts'),target=artifact();target.versionRef.contentHash=contentHash(Buffer.from(raw));
 await assert.rejects(read(new ApiClient(async()=>new Response(raw,{headers:{'content-type':'application/octet-stream'}})),id(1),target,()=>true),{code:'TRACE_ARTIFACT_TEXT_UNSUPPORTED'});
});
test('reader는 BOM을 보존하고 정확2MiB 허용/초과 스트림취소 및 lock해제',async()=>{
 const {readTraceArtifactOriginal:read}=await import('../../../apps/web/src/features/design-trace/trace-artifact-original.ts');
 const text='\uFEFF'+ 'a'.repeat(2*1024*1024-3),target=artifact(2,text);
 const result=await read(new ApiClient(async()=>bytes(text)),id(1),target,()=>true);assert.equal(result.body,text);assert.equal(result.bytes,2*1024*1024);
 let cancelled=0;const stream=new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array(2*1024*1024));c.enqueue(new Uint8Array(1));},cancel(){cancelled++;}});
 await assert.rejects(read(new ApiClient(async()=>new Response(stream,{headers:{'content-type':'application/octet-stream'}})),id(1),target,()=>true),{code:'TRACE_ARTIFACT_TEXT_LIMIT'});assert.equal(cancelled,1);assert.equal(stream.locked,false);
});
test('stream read 뒤 취소는 추가read/해시/본문반환 없이 원reader를 취소한다',async()=>{
 const {readTraceArtifactOriginal:read}=await import('../../../apps/web/src/features/design-trace/trace-artifact-original.ts');let active=true,cancelled=0,pulls=0;
 const stream=new ReadableStream<Uint8Array>({pull(c){pulls++;active=false;c.enqueue(new TextEncoder().encode(body));},cancel(){cancelled++;}},{highWaterMark:0});
 await assert.rejects(read(new ApiClient(async()=>new Response(stream,{headers:{'content-type':'application/octet-stream'}})),id(1),artifact(),()=>active),{code:'TRACE_ARTIFACT_READ_PAUSED'});assert.equal(pulls,1);assert.equal(cancelled,1);assert.equal(stream.locked,false);
});
test('SHA256 대기 뒤 문맥이 닫히면 검산 결과를 반환하지 않는다',async()=>{
 const {readTraceArtifactOriginal:read}=await import('../../../apps/web/src/features/design-trace/trace-artifact-original.ts'),original=crypto.subtle.digest,gate=deferred<ArrayBuffer>();let entered=false,active=true;
 crypto.subtle.digest=async()=>{entered=true;return gate.promise;};try{const work=read(new ApiClient(async()=>bytes()),id(1),artifact(),()=>active);
 for(let n=0;!entered&&n<10;n++)await new Promise(r=>setImmediate(r));assert(entered);active=false;gate.resolve(new Uint8Array(Buffer.from(artifact().versionRef.contentHash,'hex')).buffer);
 await assert.rejects(work,{code:'TRACE_ARTIFACT_READ_PAUSED'});}finally{crypto.subtle.digest=original;}
});
