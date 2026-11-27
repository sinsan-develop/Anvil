import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {resultFixture,hash} from './result-view-fixture.ts';

// ReactDOM의 event/layout effect만 실행하는 합성 DOM이며 실제 다운로드를 하지 않는다.
class MemoryNode{
 nodeType:number;nodeName:string;tagName:string;localName:string;namespaceURI='http://www.w3.org/1999/xhtml';
 parentNode:MemoryNode|null=null;childNodes:MemoryNode[]=[];ownerDocument:any;listeners=new Map<string,Array<(e:any)=>void>>();
 attributes=new Map<string,string>();style={};data='';href='';download='';
 constructor(name:string,type=1,owner?:any){this.nodeType=type;this.nodeName=type===1?name.toUpperCase():name;this.tagName=this.nodeName;this.localName=name;this.ownerDocument=owner;}
 get firstChild():MemoryNode|null{return this.childNodes[0]??null;}get lastChild():MemoryNode|null{return this.childNodes.at(-1)??null;}
 get nextSibling():MemoryNode|null{const list=this.parentNode?.childNodes;return list?.[list.indexOf(this)+1]??null;}
 get nodeValue(){return this.nodeType===3?this.data:null;}set nodeValue(s:string|null){if(this.nodeType===3)this.data=s??'';}
 get textContent():string{return this.nodeType===3?this.data:this.childNodes.map(n=>n.textContent).join('');}
 set textContent(s:string){for(const n of this.childNodes)n.parentNode=null;this.childNodes=[];if(s)this.appendChild(this.ownerDocument.createTextNode(String(s)));}
 appendChild(n:MemoryNode){n.remove();n.parentNode=this;this.childNodes.push(n);return n;}
 insertBefore(n:MemoryNode,b:MemoryNode){n.remove();n.parentNode=this;const i=this.childNodes.indexOf(b);assert(i>=0);this.childNodes.splice(i,0,n);return n;}
 removeChild(n:MemoryNode){const i=this.childNodes.indexOf(n);assert(i>=0);this.childNodes.splice(i,1);n.parentNode=null;return n;}
 remove(){this.parentNode?.removeChild(this);}
 setAttribute(k:string,v:unknown){this.attributes.set(k,String(v));}removeAttribute(k:string){this.attributes.delete(k);}
 addEventListener(k:string,f:(e:any)=>void){this.listeners.set(k,[...(this.listeners.get(k)??[]),f]);}
 removeEventListener(k:string,f:(e:any)=>void){this.listeners.set(k,(this.listeners.get(k)??[]).filter(v=>v!==f));}
 click(){const e={type:'click',button:0,bubbles:true,target:this};for(let n:MemoryNode|null=this;n;n=n.parentNode)for(const f of n.listeners.get(e.type)??[])f(e);}
}

function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}
const artifact='33333333-3333-4333-8333-333333333333',other='44444444-4444-4444-8444-444444444444';
function fixture(id=artifact){
 const f=resultFixture(),bytes=new Uint8Array([1,2,128,255]);
 f.entry.snapshot.manifest.artifactRefs.push({id,version:1,contentHash:createHash('sha256').update(bytes).digest('hex')} as never);
 f.entry.snapshot.manifestHash=hash(f.entry.snapshot.manifest);f.entry.ref.contentHash=hash(f.entry.snapshot);
 return{...f,bytes};
}

test('StrictMode owner는 이전 헤더 GET을 취소하고 새 검산 다운로드만 click·URL 회수를 한다',async t=>{
 const document:any=new MemoryNode('#document',9);document.ownerDocument=document;
 const clicks:{url:string;name:string}[]=[],blobs:Blob[]=[],revoked:string[]=[];
 document.createElement=(name:string)=>{
  const n=new MemoryNode(name,1,document);
  if(name==='a')n.click=()=>{assert.equal(n.parentNode,document.body);clicks.push({url:n.href,name:n.download});};
  return n;
 };
 document.createElementNS=(_ns:string,name:string)=>document.createElement(name);
 document.createTextNode=(text:string)=>{const n=new MemoryNode('#text',3,document);n.data=text;return n;};
 document.documentElement=document.createElement('html');document.body=document.createElement('body');
 document.documentElement.appendChild(document.body);document.appendChild(document.documentElement);document.activeElement=document.body;
 const window={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};
 document.defaultView=window;
 const saved=new Map<string,PropertyDescriptor|undefined>(),channels:MessageChannel[]=[];
 const NativeChannel=globalThis.MessageChannel;
 class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
 for(const[k,v]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){
  saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
 }
 t.after(()=>{
  for(const c of channels){c.port1.close();c.port2.close();}
  for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);
 });
 t.mock.method(URL,'createObjectURL',(blob:Blob)=>{blobs.push(blob);return 'blob:download-'+blobs.length;});
 t.mock.method(URL,'revokeObjectURL',(url:string)=>{revoked.push(url);});
 const path=(name:string)=>JSON.stringify(fileURLToPath(new URL(name,import.meta.url)));
 const bundle:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},
  build:{write:false,lib:{entry:'virtual:download-owner',formats:['iife'],name:'DownloadOwnerTest'},rolldownOptions:{output:{codeSplitting:false}}},
  plugins:[{name:'download-owner-dom',resolveId(id){if(id.endsWith('virtual:download-owner'))return '\0download-owner';},load(id){if(id==='\0download-owner')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';import{ResultArtifactDownloads}from${path('../../../apps/web/src/features/session-detail/ResultArtifactDownloads.tsx')};import{ApiClient}from${path('../../../apps/web/src/api/client.ts')};export{React,createRoot,flushSync,ResultArtifactDownloads,ApiClient};`;}}]});
 const ui=new Function((Array.isArray(bundle)?bundle[0]:bundle).output.find((o:any)=>o.type==='chunk').code+';return DownloadOwnerTest;')();
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 const flush=()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});
 const until=async(check:()=>boolean)=>{const deadline=Date.now()+2000;while(!check()&&Date.now()<deadline)await flush();assert(check(),container.textContent);};
 const nodes=(n:MemoryNode):MemoryNode[]=>[n,...n.childNodes.flatMap(nodes)];
 async function click(id:string){const button=nodes(container).find(n=>n.tagName==='BUTTON'&&n.textContent===`원본 다운로드 ${id}`);assert(button);await ui.React.act(async()=>button.click());}
 const calls:{path:string;signal:AbortSignal|null|undefined;reply:ReturnType<typeof deferred<Response>>;aborts:number}[]=[];
 const transport:typeof fetch=async(path,init)=>{
  assert.equal(init?.method,'GET');
  const call={path:String(path),signal:init?.signal,reply:deferred<Response>(),aborts:0};calls.push(call);
  call.signal?.addEventListener('abort',()=>{call.aborts++;},{once:true});return call.reply.promise;
 };
 const client=new ui.ApiClient(transport),f=fixture(),alternate=fixture(other);
 let entry=f.entry,session={user:{id:f.pid},clientId:f.pid,csrfToken:'a'.repeat(43)},lost=0,newLost=0,denied=0,mounted=true;
 let deniedAction:()=>void=()=>{},onAuthenticationLost=()=>{lost++;};
 const onAccessUnavailable=()=>{denied++;deniedAction();};
 const tree=()=>ui.React.createElement(ui.React.StrictMode,null,
  ui.React.createElement(ui.ResultArtifactDownloads,{client,session,result:entry,onAuthenticationLost,onAccessUnavailable}));
 const render=()=>ui.React.act(async()=>root.render(tree()));
 const unmount=async()=>{await ui.React.act(async()=>root.unmount());mounted=false;};
 const late401=()=>new Response('synthetic auth error',{status:401});
 const binary=()=>new Response(f.bytes,{headers:{'content-type':'application/octet-stream'}});
 try{
  await render();assert.equal(calls.length,0);
  await click(artifact);await until(()=>calls.length===1);
  // 같은 화면에서 새 요청이 앞선 GET을 대체한다. 옛 완료가 새 요청을 지우면 다음 변경에서 취소되지 않는다.
  await click(artifact);await until(()=>calls.length===2);
  const first=calls[0]!,second=calls[1]!;
  assert.equal(first.aborts,1);assert(first.signal?.aborted);assert(!second.signal?.aborted);
  first.reply.resolve(late401());await flush();assert.equal(lost+denied+clicks.length+blobs.length,0);
  entry=alternate.entry;await render();assert.equal(second.aborts,1);
  second.reply.resolve(binary());await flush();assert.equal(lost+denied+clicks.length+blobs.length,0);

  await click(other);await until(()=>calls.length===3);const oldSession=calls[2]!;
  session={...session,csrfToken:'b'.repeat(43)};await render();assert.equal(oldSession.aborts,1);
  oldSession.reply.resolve(late401());await flush();
  await click(other);await until(()=>calls.length===4);const oldTransport=calls[3]!;
  client.transport=(...args:Parameters<typeof fetch>)=>transport(...args);await render();assert.equal(oldTransport.aborts,1);
  oldTransport.reply.resolve(late401());await flush();assert.equal(lost+denied+clicks.length+blobs.length,0);

  await click(other);await until(()=>calls.length===5);const successful=calls[4]!;
  successful.reply.resolve(binary());await until(()=>container.textContent.includes('브라우저에 다운로드를 요청했습니다'));
  assert.deepEqual(clicks,[{url:'blob:download-1',name:`artifact-${other}.bin`}]);
  assert.deepEqual(revoked,['blob:download-1']);assert.deepEqual(new Uint8Array(await blobs[0]!.arrayBuffer()),f.bytes);
  assert.equal(nodes(document.body).filter(n=>n.tagName==='A').length,0);

  await click(other);await until(()=>calls.length===6);assert.equal(successful.aborts,0);
  deniedAction=()=>{
   session={...session,user:{id:other}};onAuthenticationLost=()=>{newLost++;};
   ui.flushSync(()=>root.render(tree()));
  };
  const prior401=calls[5]!;prior401.reply.resolve(late401());await until(()=>denied===1);
  assert.deepEqual({lost,newLost,aborts:prior401.aborts},{lost:0,newLost:0,aborts:0},'동기 소유자 교체 후 원 401이 인증을 지우지 않는다');

  deniedAction=()=>{};await click(other);await until(()=>calls.length===7);
  calls[6]!.reply.resolve(late401());await until(()=>newLost===1&&denied===2);

  deniedAction=()=>ui.flushSync(()=>root.render(null));await click(other);await until(()=>calls.length===8);
  const received401=calls[7]!;received401.reply.resolve(late401());await until(()=>denied===3);
  assert.equal(received401.aborts,0,'현재 401 처리 중 언마운트되어도 정착된 GET은 취소하지 않는다');

  await render();await click(other);await until(()=>calls.length===9);
  const closing=calls[8]!;await unmount();assert.equal(closing.aborts,1);
  closing.reply.resolve(late401());await flush();assert.deepEqual({lost,newLost,denied},{lost:0,newLost:1,denied:3});
  assert.equal(clicks.length,1);assert.equal(blobs.length,1);
  assert.deepEqual(calls.map(c=>c.path),[artifact,artifact,...Array<string>(7).fill(other)].map(id=>`/api/v1/projects/${f.pid}/files/${id}`));
 }finally{if(mounted)await unmount();for(const call of calls)call.reply.resolve(late401());container.remove();}
});
