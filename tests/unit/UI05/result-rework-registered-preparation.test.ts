import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {reworkFixture} from '../FN12/result-rework-input-fixture.ts';
import {criteriaId as id,criteriaHash as hash} from '../FN12/result-criteria-fixture.ts';
import {prepareResultRework} from '../../../apps/server/modules/results/result-rework-input.ts';
/** 실제 ReactDOM의 요소/이벤트/effect를 실행하는 최소 메모리 DOM. 레이아웃·브라우저 보안·시각 검증은 아니다. */
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
const document:any=new MemoryNode('#document',9);document.ownerDocument=document;document.createElement=(n:string)=>new MemoryNode(n,1,document);document.createElementNS=(_ns:string,n:string)=>document.createElement(n);document.createTextNode=(s:string)=>{const n=new MemoryNode('#text',3,document);n.data=s;return n;};document.documentElement=document.createElement('html');document.body=document.createElement('body');document.documentElement.appendChild(document.body);document.activeElement=document.body;
const saved=new Map<string,PropertyDescriptor|undefined>();let ui:any;
const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}

before(async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/session-detail/ResultReviewSources.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:stored-rework',name:'StoredReviewTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'rework-memory-entry',transform(code,id){if(id.replaceAll('\\','/').endsWith('/ResultReviewSources.tsx'))return code+'\nexport {ResultReworkEditor};';},resolveId(id){if(id.endsWith('virtual:stored-rework'))return '\0stored-rework';},load(id){if(id==='\0stored-rework')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{ResultReworkEditor}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};export{React,createRoot,ResultReworkEditor,ApiClient};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return StoredReviewTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});


async function mount(){
 const f=reworkFixture(),binding:any=f.sources.binding;
 f.input.sourceScopes=structuredClone(f.sources.assignment.snapshot.definition.allowedScopes.slice(0,1).map((scope:(typeof f.input.sourceScopes)[number])=>({...scope,targets:scope.targets.slice(0,1)})));
 Object.assign(binding.snapshot,{connectionKind:'REGISTERED_DEFINITION',connectionReadiness:'REGISTERED_DEFINITION_ONLY'});binding.ref.contentHash=hash(binding.snapshot);f.input.responsibleBindingRef=structuredClone(binding.ref);
 const requests:{url:string;body:any}[]=[],container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 const state:{delay:boolean;release:(()=>void)|null;status:number}={delay:false,release:null,status:200};
 const client=new ui.ApiClient(async(url:any,options:any)=>{
  assert.equal(String(url),`/api/v1/projects/${f.sources.assignment.projectId}/result-reworks/prepare`);assert.equal(options.method,'POST');assert.equal(options.credentials,'same-origin');assert.equal(new Headers(options.headers).get('X-Anvil-CSRF'),'C'.repeat(43));
  const body=JSON.parse(options.body);requests.push({url:String(url),body});const response=state.status===200?Response.json(prepareResultRework(f.sources,body,f.now)):Response.json({code:'ACCESS_DENIED'},{status:state.status});
  return state.delay?new Promise<Response>(resolve=>{state.release=()=>resolve(response);}):response;
 });
 let lost=0,unavailable=0;
 const props={client,assignment:f.sources.assignment,result:f.sources.result,review:f.sources.review,responsibleState:{roles:[f.sources.role],bindings:[binding]},session:{user:{id:id(6)},clientId:id(24),csrfToken:'C'.repeat(43)},onAuthenticationLost:()=>lost++,onAccessUnavailable:()=>unavailable++};
 const nodes=(n=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))];
 async function flush(){await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});}
 async function waitFor(check:()=>boolean){for(let n=0;n<100&&!check();n++)await flush();assert(check(),'유한 실제 React 관측');}
 async function change(label:string,value?:string){const node=nodes().find(n=>n.attributes.get('aria-label')===label);assert(node,label);const key=Object.keys(node).find(k=>k.startsWith('__reactProps$'));assert(key);const handler=(node as any)[key].onChange;assert.equal(typeof handler,'function');await ui.React.act(async()=>handler({target:{value}}));}
 async function click(text:string){const node=nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===text);assert(node,text);assert(!node.disabled);await ui.React.act(async()=>node.dispatchEvent({type:'click',button:0,bubbles:true}));}
 await ui.React.act(async()=>root.render(ui.React.createElement(ui.ResultReworkEditor,props)));
 async function fill(){assert(nodes().some(n=>n.tagName==='OPTION'&&n.attributes.get('value')===binding.ref.id),'상위 Form은 등록정의 예약을 실제 선택지로 제공한다');await change('보완 조건 save');await change('보완 대상 예약 세션',binding.ref.id);await change('보완 파일 '+f.input.sourceScopes[0]!.targets[0]!.relativePath);await change('보완 요청 이유',f.input.reason);}
 return{f,props,requests,container,state,fill,click,waitFor,flush,unavailable:()=>unavailable,lost:()=>lost,close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
test('실제 보완 Form은 등록정의 예약 선택→명시 준비→서버 pure 응답 표시만 수행한다',async()=>{
 const m=await mount();try{assert.equal(m.requests.length,0);await m.fill();await m.click('보완 초안 명시 준비');await m.waitFor(()=>m.requests.length===1||m.container.textContent.includes('RESULT_REWORK_INPUT_INVALID'));assert.equal(m.requests.length,1,m.container.textContent);await m.waitFor(()=>m.container.textContent.includes('보완 초안 · 미저장/미실행'));assert.deepEqual(m.requests[0]!.body,m.f.input);assert.equal(m.requests.filter(r=>r.url.endsWith('/commands')).length,0);assert.equal(m.unavailable(),0);assert.equal(m.lost(),0);}finally{await m.close();}
});
test('등록정의 Form의 준비 403과 이탈 뒤 늦은 성공은 원문·새 저장으로 채택하지 않는다',async()=>{
 for(const mode of ['403','LATE'] as const){const m=await mount();let closed=false;try{m.state.status=mode==='403'?403:200;m.state.delay=mode==='LATE';await m.fill();await m.click('보완 초안 명시 준비');await m.waitFor(()=>m.requests.length===1);if(mode==='403'){await m.waitFor(()=>m.container.textContent.includes('ACCESS_DENIED'));assert.equal(m.unavailable(),1);assert(!m.container.textContent.includes('보완 초안 · 미저장/미실행'));}else{assert(m.state.release);await m.close();closed=true;await ui.React.act(async()=>m.state.release!());await m.flush();assert.equal(m.container.textContent,'');assert.equal(m.unavailable(),0);}assert.equal(m.requests.length,1);}finally{if(!closed)await m.close();}}
});
