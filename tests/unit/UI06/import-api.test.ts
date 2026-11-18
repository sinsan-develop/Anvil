import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rejectedDocumentImport, type DocumentImportBuffer } from '../../../apps/web/src/features/design-trace/import-api.ts';
import { prepareDocumentSave, type DocumentBuffer } from '../../../apps/web/src/features/design-trace/editor-api.ts';
test('확실한 거절과 결과 미확인을 구별하고 파일 준비 중에는 초안 저장을 시작하지 않는다', async () => {
  for (const failure of [{ status: 0, code: 'CONNECTION_LOST' }, { status: 503, code: 'REQUEST_FAILED' }, { status: 409, code: 'RESPONSE_INVALID' }]) assert.equal(rejectedDocumentImport({ failure } as DocumentImportBuffer), false);
  assert.equal(rejectedDocumentImport({ failure: { status: 409, code: 'CONTROL_GENERATION_CONFLICT' } } as DocumentImportBuffer), true);
  assert.equal(rejectedDocumentImport({ uncertain: true, failure: { status: 409, code: 'CONTROL_GENERATION_CONFLICT' } } as DocumentImportBuffer), false, '과거 미확인 명령은 이후4xx만으로 미적용이 되지 않는다');
  await assert.rejects(prepareDocumentSave({ importPreparationId: 'reserved-before-file-read' } as DocumentBuffer, {} as any), (e: unknown) => (e as { code: string }).code === 'IMPORT_SELECTION_REQUIRED');
});

import {ApiClient,ApiError} from '../../../apps/web/src/api/client.ts';
import {adoptDocumentImport,prepareDocumentImport} from '../../../apps/web/src/features/design-trace/import-api.ts';
import {contentHash} from '../../../contracts/canonical.ts';

async function uploadedCandidate(){
 const id=(n:number)=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0');
 const session={user:{id:id(1)},clientId:id(2),csrfToken:'C'.repeat(43)};
 const buffer:DocumentBuffer={ownerUserId:id(1),projectId:id(3),documentId:null,baseVersion:0,formRef:{id:id(4),version:1,contentHash:'a'.repeat(64)},title:'원 제목',body:'편집 중 원문',reason:'원 이유',mediaType:'text/markdown;charset=utf-8',content:{attachments:[],sections:[],sourceRefs:[]},criteria:[],controlGeneration:1,dirty:true,pending:null,savedRef:null,failure:null};
 const bytes=new TextEncoder().encode('# 선택한 가져오기 원문'),state=await prepareDocumentImport(buffer,session,{name:'original.md',bytes});
 const ref={artifactId:id(5),bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'text/markdown;charset=utf-8'};
 state.candidate={id:id(6),originalRef:ref,extractedContentRef:ref,intendedFormRef:buffer.formRef,parserVersion:'UTF8_IDENTITY_1',status:'READY',issues:[],losses:[]};
 state.record={...state.upload,commandId:state.recordCommandId,operation:'importDocument',payload:{fileRef:ref,intendedFormRef:buffer.formRef,sourceRefs:[]}};
 buffer.importState=state;
 return{buffer,session,state,ref,bytes};
}

test('업로드 후보 채택 현재성: 정상 GET은 원 제목·이유와 명령을 보존하고 명시 채택만 반환한다',async()=>{
 const f=await uploadedCandidate(),before=structuredClone(f.buffer),calls:string[]=[];
 const client=new ApiClient(async(url,init)=>{assert.equal(init?.method,'GET');calls.push(String(url));return Response.json(f.state.candidate);});
 const result=await adoptDocumentImport(client,f.buffer,f.session,()=>true);
 assert.equal(result.body,new TextDecoder().decode(f.bytes));assert.equal(result.title,f.buffer.title);assert.equal(result.reason,f.buffer.reason);
 assert.equal(result.importState,null);assert.equal(result.importCandidateRef,f.state.candidate!.id);assert.equal(result.pending,null);
 assert.deepEqual(f.buffer,before);assert.deepEqual(calls,[`/api/v1/projects/${f.buffer.projectId}/imports/${f.state.candidate!.id}`]);
});

test('업로드 후보 채택 현재성: 닫힌 준비는 GET0이다',async()=>{
 const f=await uploadedCandidate();let calls=0;
 const client=new ApiClient(async()=>{calls++;return Response.json(f.state.candidate);});
 await assert.rejects(adoptDocumentImport(client,f.buffer,f.session,()=>false),e=>e instanceof ApiError&&e.code==='IMPORT_SOURCE_READ_PAUSED');assert.equal(calls,0);
});

for(const status of [200,401])test('업로드 후보 채택 현재성: 늦은 '+status+'은 교체된 초안을 채택하지 않는다',async()=>{
  const f=await uploadedCandidate(),before=structuredClone(f.buffer);let calls=0;
  let resolve!:(r:Response)=>void,started!:()=>void;
  const reached=new Promise<void>(r=>{started=r;}),reply=new Promise<Response>(r=>{resolve=r;});
  const client=new ApiClient(async()=>{calls++;started();return reply;});
  let current:DocumentBuffer|null=f.buffer;
  const active=()=>current===f.buffer;
  current=f.buffer;const operation=adoptDocumentImport(client,f.buffer,f.session,active);await reached;
  const next={...f.buffer,title:'현재 초안 제목',reason:'현재 초안 이유'};current=next;
  resolve(status===200?Response.json(f.state.candidate):Response.json({code:'AUTH_REQUIRED'},{status}));
  await assert.rejects(operation,e=>e instanceof ApiError&&e.code==='IMPORT_SOURCE_READ_PAUSED');
  assert.equal(current,next);assert.equal(current.title,'현재 초안 제목');assert.deepEqual(f.buffer,before);assert.equal(calls,1);
});

test('업로드 후보 채택 현재성: 현재 401은 기존 인증 오류로 유지한다',async()=>{
 const f=await uploadedCandidate(),client=new ApiClient(async()=>Response.json({code:'AUTH_REQUIRED'},{status:401}));
 await assert.rejects(adoptDocumentImport(client,f.buffer,f.session,()=>true),e=>e instanceof ApiError&&e.status===401&&e.code==='AUTH_REQUIRED');
});


test('업로드 후보 채택 현재성: 해시 계산 중 초안 폐기와 hash 불일치는 멈춤으로 처리한다',async t=>{
 const f=await uploadedCandidate();let active=true,release!:(v:ArrayBuffer)=>void,started!:()=>void;
 const reached=new Promise<void>(r=>{started=r;});
 t.mock.method(crypto.subtle,'digest',()=>{started();return new Promise<ArrayBuffer>(r=>{release=r;});});
 const client=new ApiClient(async()=>Response.json(f.state.candidate));
 const operation=adoptDocumentImport(client,f.buffer,f.session,()=>active);await reached;active=false;release(new ArrayBuffer(32));
 await assert.rejects(operation,e=>e instanceof ApiError&&e.code==='IMPORT_SOURCE_READ_PAUSED');
});

import {build} from 'vite';
import {fileURLToPath} from 'node:url';
// 실제 ReactDOM 이벤트/렌더만 RAM에서 실행한다. 브라우저/서비스 검증이 아니다.
class MemoryNode{
 nodeType:number;nodeName:string;tagName:string;localName:string;namespaceURI='http://www.w3.org/1999/xhtml';parentNode:MemoryNode|null=null;childNodes:MemoryNode[]=[];ownerDocument:any;attributes=new Map<string,string>();style:Record<string,unknown>={};listeners=new Map<string,Function[]>();type='';value='';checked=false;disabled=false;data='';
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

test('업로드 후보 채택 화면: 정상과 CSRF·초안 교체의 지연200/401을 실제 버튼에서 구분한다',async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/design-trace/DocumentImport.tsx',import.meta.url)),api=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url));
 const result=await build({configFile:false,envFile:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:import-adopt',name:'ImportAdoptTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'import-adopt-memory',resolveId(id){if(id.endsWith('virtual:import-adopt'))return '\0import-adopt';},load(id){if(id==='\0import-adopt')return `import * as React from 'react';export {React};export {createRoot} from 'react-dom/client';export {DocumentImport} from ${JSON.stringify(entry)};export {ApiClient} from ${JSON.stringify(api)};`;}}]});
 const output=Array.isArray(result)?result[0]:result;assert(output&&'output'in output);const chunk=output.output.find(o=>o.type==='chunk');assert(chunk&&chunk.type==='chunk');
 const document:any=new MemoryNode('#document',9);document.ownerDocument=document;document.createElement=(n:string)=>new MemoryNode(n,1,document);document.createElementNS=(_ns:string,n:string)=>document.createElement(n);document.createTextNode=(s:string)=>{const n=new MemoryNode('#text',3,document);n.data=s;return n;};document.documentElement=document.createElement('html');document.body=document.createElement('body');document.documentElement.appendChild(document.body);document.activeElement=document.body;
 const window={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,getComputedStyle:()=>({})};document.defaultView=window;
 const saved=new Map<string,PropertyDescriptor|undefined>(),channels:MessageChannel[]=[],Native=globalThis.MessageChannel;class OwnedChannel extends Native{constructor(){super();channels.push(this);}}
 for(const[k,v]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,MessageChannel:OwnedChannel,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});}
 try{
  const ui=new Function(chunk.code+';return ImportAdoptTest;')();
  for(const mode of ['NORMAL','CURRENT401','CSRF200','CSRF401','BUFFER200','CLOSE200']){
   const f=await uploadedCandidate();let current:DocumentBuffer|null=f.buffer,session=f.session,lost=0,changed=0,calls=0,release!:(r:Response)=>void;
   const reply=new Promise<Response>(r=>{release=r;}),client=new ui.ApiClient(async(_path:string,init:RequestInit)=>{assert.equal(init.method,'GET');calls++;return reply;});
   const container=document.createElement('main'),root=ui.createRoot(container);document.body.appendChild(container);
   const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
   const render=()=>root.render(current?ui.React.createElement(ui.DocumentImport,{client,session,buffer:current,onAuthenticationLost:()=>{lost++;},onChange:(change:any)=>{const next=typeof change==='function'?change(current):change;if(next!==current)changed++;current=next;render();}}):null);
   try{
    await ui.React.act(async()=>render());assert.equal(calls,0);
    const checkbox=nodes().find(n=>n.tagName==='INPUT'&&n.type==='checkbox');assert(checkbox,mode);checkbox.checked=true;
    await ui.React.act(async()=>checkbox.dispatchEvent({type:'click',button:0}));
    const button=nodes().find(n=>n.tagName==='BUTTON'&&n.textContent==='이 후보로 초안 준비');assert(button&&!button.disabled,mode);
    await ui.React.act(async()=>button.dispatchEvent({type:'click',button:0}));assert.equal(calls,1);
    if(mode.startsWith('CSRF'))session={...session,csrfToken:'D'.repeat(43)};
    if(mode==='BUFFER200')current={...f.buffer,title:'새 초안',reason:'새 이유'};
    if(mode==='CLOSE200')current=null;
    await ui.React.act(async()=>render());const expected=current;
    await ui.React.act(async()=>{release(mode.endsWith('401')?Response.json({code:'AUTH_REQUIRED'},{status:401}):Response.json(f.state.candidate));await new Promise(r=>setTimeout(r,20));});
    if(mode==='NORMAL'){assert.equal(changed,1);assert.equal(current?.importState,null);assert.equal(current?.body,new TextDecoder().decode(f.bytes));assert.equal(current?.title,f.buffer.title);}
    else{assert.equal(current,expected,mode);assert.equal(changed,0,mode);}
    assert.equal(lost,mode==='CURRENT401'?1:0,mode);assert.equal(calls,1);
   }finally{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}
  }
 }finally{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);}
});
