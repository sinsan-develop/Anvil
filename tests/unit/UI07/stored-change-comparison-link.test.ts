import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {documentTextDiff} from '../../../apps/server/modules/documents/document-diff.ts';
/** 실제 ReactDOM의 요소/이벤트/effect를 실행하는 최소 메모리 DOM. 레이아웃·브라우저 보안·시각 검증은 아니다. */
class MemoryNode{
 nodeType:number;nodeName:string;tagName:string;localName:string;namespaceURI='http://www.w3.org/1999/xhtml';parentNode:MemoryNode|null=null;childNodes:MemoryNode[]=[];ownerDocument:any;attributes=new Map<string,string>();style:Record<string,unknown>={};listeners=new Map<string,Function[]>();value='';selected=false;checked=false;disabled=false;data='';
 constructor(name:string,type=1,owner?:any){this.nodeType=type;this.nodeName=type===1?name.toUpperCase():name;this.tagName=this.nodeName;this.localName=name;this.ownerDocument=owner;}
 get options():MemoryNode[]{return this.childNodes.flatMap(n=>n.tagName==='OPTION'?[n]:n.options);}
 get firstChild():MemoryNode|null{return this.childNodes[0]??null;}get lastChild():MemoryNode|null{return this.childNodes.at(-1)??null;}get nextSibling():MemoryNode|null{const a=this.parentNode?.childNodes;return a?.[a.indexOf(this)+1]??null;}
 get nodeValue():string|null{return this.nodeType===3?this.data:null;}set nodeValue(v:string|null){if(this.nodeType===3)this.data=v??'';}
 get textContent():string{return this.nodeType===3?this.data:this.childNodes.map(n=>n.textContent).join('');}
 set textContent(v:string){if(this.nodeType===3){this.data=String(v);return;}for(const n of this.childNodes)n.parentNode=null;this.childNodes=[];if(v)this.appendChild(this.ownerDocument.createTextNode(String(v)));}
 appendChild(n:MemoryNode){if(n.parentNode)n.parentNode.removeChild(n);n.parentNode=this;this.childNodes.push(n);return n;}
 insertBefore(n:MemoryNode,b:MemoryNode){if(n.parentNode)n.parentNode.removeChild(n);n.parentNode=this;const i=this.childNodes.indexOf(b);assert(i>=0);this.childNodes.splice(i,0,n);return n;}
 removeChild(n:MemoryNode){const i=this.childNodes.indexOf(n);assert(i>=0);this.childNodes.splice(i,1);n.parentNode=null;return n;}
 setAttribute(k:string,v:unknown){this.attributes.set(k,String(v));if(k==='disabled')this.disabled=true;if(k==='value'&&this.tagName==='OPTION')this.value=String(v);}removeAttribute(k:string){this.attributes.delete(k);if(k==='disabled')this.disabled=false;}getAttribute(k:string){return this.attributes.get(k)??null;}
 addEventListener(k:string,f:Function){this.listeners.set(k,[...(this.listeners.get(k)??[]),f]);}removeEventListener(k:string,f:Function){this.listeners.set(k,(this.listeners.get(k)??[]).filter(v=>v!==f));}
 contains(n:MemoryNode|null):boolean{return !!n&&(n===this||this.childNodes.some(c=>c.contains(n)));}focus(){this.ownerDocument.activeElement=this;}
 dispatchEvent(e:any){e.target=this;e.preventDefault??=()=>{e.defaultPrevented=true;};e.stopPropagation??=()=>{e.cancelBubble=true;};const chain:MemoryNode[]=[];for(let n:MemoryNode|null=this;n;n=n.parentNode)chain.push(n);for(const n of chain)for(const f of n.listeners.get(e.type)??[])f(e);return !e.defaultPrevented;}
}
const document:any=new MemoryNode('#document',9);document.ownerDocument=document;document.createElement=(n:string)=>new MemoryNode(n,1,document);document.createElementNS=(_ns:string,n:string)=>document.createElement(n);document.createTextNode=(s:string)=>{const n=new MemoryNode('#text',3,document);n.data=s;return n;};document.documentElement=document.createElement('html');document.body=document.createElement('body');document.documentElement.appendChild(document.body);document.activeElement=document.body;

const saved=new Map<string,PropertyDescriptor|undefined>(),events=new Map<string,Set<Function>>(),channels:MessageChannel[]=[];
let ui:any;
const location={hash:'',protocol:'https:',origin:'https://anvil-synthetic.invalid'};
before(async()=>{
 const app=fileURLToPath(new URL('../../../apps/web/src/features/design-change/StoredChangeComparison.tsx',import.meta.url));
 const api=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:stored-change-comparison-link',name:'StoredComparisonLinkApp',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'stored-change-comparison-link-memory',resolveId(id){if(id.endsWith('virtual:stored-change-comparison-link'))return '\0stored-change-comparison-link';},load(id){if(id==='\0stored-change-comparison-link')return `export * as React from 'react';export {createRoot} from 'react-dom/client';export {StoredChangeComparison as Component} from ${JSON.stringify(app)};export {ApiClient} from ${JSON.stringify(api)};`;}}]});
 const Native=globalThis.MessageChannel;class Channel extends Native{constructor(){super();channels.push(this);}}
 const add=(k:string,f:Function)=>{let set=events.get(k);if(!set)events.set(k,set=new Set());set.add(f);},remove=(k:string,f:Function)=>events.get(k)?.delete(f),window={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener:add,removeEventListener:remove,getComputedStyle:()=>({}),location};document.defaultView=window;
 for(const[k,v]of Object.entries({window,document,location,addEventListener:add,removeEventListener:remove,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:Channel,confirm:()=>true})){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((v:any)=>v.type==='chunk').code+';return StoredComparisonLinkApp;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});
const id=(n:number)=>'ed140000-0000-4000-8000-'+String(n).padStart(12,'0');
const pid=id(1),otherProject=id(2),did=id(3),proposalId=id(4),at='2026-11-12T00:00:00.000Z';
const label='변경 전 고정 설계 원문 열기';
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}
async function mount(mode:'MATCH'|'MISMATCH'|'DENIED'|'UNAUTHENTICATED'='MATCH'){
 const old='이전 원문\n',body='변경 원문\n',title='고정 설계';
 const formRef={id:id(6),version:1,contentHash:'b'.repeat(64)};
 const artifact=(n:number,value:string,mediaType='text/plain;charset=utf-8')=>({artifactId:id(n),bytes:Buffer.byteLength(value),contentHash:contentHash(Buffer.from(value)),mediaType});
 const baseContent={body:artifact(10,old),attachments:[],sections:[],sourceRefs:[]};
 const content={...baseContent,body:artifact(11,body)};
 const baseRef={id:did,version:3,contentHash:contentHash(canonicalJson({title,formRef,stageNodeRef:null,content:baseContent}))};
 const diff=canonicalJson({...documentTextDiff(old,body),baseRef,baseBodyRef:baseContent.body,proposedBodyRef:content.body,beforeContent:baseContent,afterContent:content});
 const files=new Map([[id(10),old],[id(11),body],[id(12),diff]]);
 const proposal={id:proposalId,baseRef,proposedContentRef:content.body,diffRef:artifact(12,diff,'application/json;charset=utf-8'),status:'PENDING',
  proposedContent:content,reason:'제안 이유',createdAt:at,proposedBy:id(9),selections:[]};
 const documentWire={...baseRef,title,formRef,stageNodeRef:null,content:baseContent,sourceRefs:[],confirmed:true,validation:{validForConfirmation:false,issues:[]},statusHistory:[],
  contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[]};
 const change={ref:{id:id(5),version:1,contentHash:'c'.repeat(64)},beforeRef:mode==='MISMATCH'?{...baseRef,contentHash:'d'.repeat(64)}:baseRef,afterProposalRef:proposalId};
 const calls:{path:string;method:string}[]=[];
 let hold:Promise<Response>|null=null,authLost=0,current=true;
 const transport:typeof fetch=async(url,init)=>{
  const path=String(url),method=init?.method??'GET';calls.push({path,method});assert.equal(method,'GET');
  assert(path.startsWith('/api/v1/projects/'+pid+'/'));
  if(path.endsWith('/proposals/'+proposalId)){
   if(hold)return hold;
   if(mode==='DENIED')return Response.json({code:'ACCESS_DENIED'},{status:403});
   if(mode==='UNAUTHENTICATED')return Response.json({code:'AUTH_REQUIRED'},{status:401});
   return Response.json(proposal);
  }
  if(path.endsWith('/documents/'+did+'/versions/3'))return Response.json(documentWire);
  const file=files.get(path.split('/').at(-1)??'');if(file!==undefined)return new Response(Buffer.from(file),{headers:{'content-type':'application/octet-stream'}});
  throw Error('UNMODELED_REQUEST');
 };
 const client=new ui.ApiClient(transport),container=document.createElement('main');
 document.body.appendChild(container);const root=ui.createRoot(container);
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 const button=(text:string)=>nodes().find(node=>node.tagName==='BUTTON'&&node.textContent===text);
 const link=()=>nodes().find(node=>node.tagName==='A'&&node.textContent===label);
 const flush=async()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});
 const until=async(check:()=>boolean)=>{for(let i=0;i<60&&!check();i++)await flush();assert(check(),container.textContent);};
 const onAuthenticationLost=()=>{authLost++;},isCurrent=()=>current;
 const render=async(projectId=pid)=>ui.React.act(async()=>root.render(ui.React.createElement(ui.Component,{client,projectId,change,onAuthenticationLost,isCurrent})));
 const click=async(node:MemoryNode|undefined)=>{assert(node);let navigable=false;await ui.React.act(async()=>{navigable=node.dispatchEvent({type:'click',bubbles:true,button:0});});return navigable;};
 await render();
 return{calls,baseRef,proposal,container,client,transport,render,link,flush,until,click,open:()=>click(button('보관 변경 전후 원문·diff 조회')),
  closeSource:()=>click(button('보관 변경 원문 닫기')),hold:(pending:Promise<Response>)=>{hold=pending;},revoke:()=>{current=false;},authLost:()=>authLost,
  close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
test('검산한 변경 전의 고정 설계만 기존 문서 경로로 연결한다',async()=>{
 const f=await mount();try{
  assert.equal(f.link(),undefined);assert.equal(f.calls.length,0);
  await f.open();await f.until(()=>f.container.textContent.includes('이전 원문'));
  const link=f.link();assert(link);
  assert.equal(link.getAttribute('href'),'#/projects/'+pid+'/documents/'+did+'/versions/3/'+f.baseRef.contentHash);
  assert.equal(f.calls.length,5);assert(await f.click(link));assert.equal(f.calls.length,5);
  await f.closeSource();assert.equal(f.link(),undefined);
 }finally{await f.close();}
});
for(const mode of ['MISMATCH','DENIED','UNAUTHENTICATED'] as const)test(mode+'에서 고정 설계 링크를 열지 않는다',async()=>{
 const f=await mount(mode);try{
  const error={DENIED:'ACCESS_DENIED',UNAUTHENTICATED:'AUTH_REQUIRED',MISMATCH:'DESIGN_CHANGE_COMPARISON_MISMATCH'}[mode];
  await f.open();await f.until(()=>f.container.textContent.includes(error));
  assert.equal(f.link(),undefined);assert.equal(f.authLost(),mode==='UNAUTHENTICATED'?1:0);assert(f.calls.every(call=>call.method==='GET'));
 }finally{await f.close();}
});
test('대상 교체 또는 화면 이탈 뒤 보류된 200과 401은 후속 원문 조회와 인증 콜백을 호출하지 않는다',async()=>{
 for(const status of [200,401]){
  const f=await mount(),pending=deferred<Response>();try{
   f.hold(pending.promise);await f.open();assert.equal(f.calls.length,1);
   if(status===200)await f.render(otherProject);else f.revoke();
   pending.resolve(status===200?Response.json(f.proposal):Response.json({code:'AUTH_REQUIRED'},{status:401}));
   await f.flush();assert.equal(f.calls.length,1);assert.equal(f.link(),undefined);assert.equal(f.authLost(),0);
  }finally{await f.close();}
 }
});
test('동일 API 객체의 전송이 렌더 전에 바뀌면 기존 앵커의 기본 이동을 막는다',async()=>{
 const f=await mount();try{
  await f.open();await f.until(()=>!!f.link());const link=f.link();
  f.client.transport=async()=>{assert.fail('교체 전송 요청');};
  assert.equal(await f.click(link),false);assert.equal(f.calls.length,5);
  await f.render();assert.equal(f.link(),undefined);
 }finally{await f.close();}
});
