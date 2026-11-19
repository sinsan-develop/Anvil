import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {fixtureData,pid,uid,cid,mid,at} from '../FN05/knowledge-conversation-source-fixture.ts';

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
 contains(n:MemoryNode|null):boolean{return !!n&&(n===this||this.childNodes.some(c=>c.contains(n)));}focus(){this.ownerDocument.activeElement=this;}scrolls=0;scrollIntoView(){this.scrolls++;}
 dispatchEvent(e:any){e.target=this;e.preventDefault??=()=>{e.defaultPrevented=true;};e.stopPropagation??=()=>{e.cancelBubble=true;};const chain:MemoryNode[]=[];for(let n:MemoryNode|null=this;n;n=n.parentNode)chain.push(n);for(const n of chain)for(const f of n.listeners.get(e.type)??[])f(e);return !e.defaultPrevented;}
}
const document:any=new MemoryNode('#document',9);document.ownerDocument=document;document.createElement=(n:string)=>new MemoryNode(n,1,document);document.createElementNS=(_ns:string,n:string)=>document.createElement(n);document.createTextNode=(s:string)=>{const n=new MemoryNode('#text',3,document);n.data=s;return n;};document.documentElement=document.createElement('html');document.body=document.createElement('body');document.documentElement.appendChild(document.body);document.activeElement=document.body;
const saved=new Map<string,PropertyDescriptor|undefined>();let ui:any,uiCode:string;
const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
before(async()=>{
 const path=(relative:string)=>fileURLToPath(new URL('../../../apps/web/src/'+relative,import.meta.url));
 const built:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:navigation',name:'NavigationTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'navigation-memory',resolveId(id){if(id.endsWith('virtual:navigation'))return '\0navigation';},load(id){if(id==='\0navigation')return `import * as React from 'react';export{React};export{createRoot}from'react-dom/client';export{KnowledgePage}from${JSON.stringify(path('features/knowledge/KnowledgePage.tsx'))};export{ApiClient}from${JSON.stringify(path('api/client.ts'))};export{newConversation,prepareConversation}from${JSON.stringify(path('features/knowledge/conversation-api.ts'))};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 uiCode=(Array.isArray(built)?built[0]:built).output.find((x:any)=>x.type==='chunk').code+';return NavigationTest;';ui=new Function(uiCode)();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
const session={user:{id:uid},clientId:uid,csrfToken:'c'.repeat(43)};
async function fixture(pending=false,withDraft=true){
 const data=fixtureData(false),gets:string[]=[],writes:string[]=[],changes:unknown[]=[];let currentSession=session,currentProject=pid,shown=true,lost=0;
 const buffer=withDraft?ui.newConversation(pid,session,7,cid,100):null;if(buffer)buffer.body='보존할 미저장 대화';if(pending){buffer.pending=await ui.prepareConversation(buffer,session);buffer.uncertain=true;}
 const baseline=JSON.stringify(buffer),messagePath=`/api/v1/projects/${pid}/conversations/${cid}/messages/${mid}`;
 const controls={project:async()=>Response.json({id:pid,participation:'OWNER',controlState:{actorId:uid,clientId:uid,generation:7,status:'HELD'}}),message:async()=>Response.json(data.conversation),page:async()=>Response.json({conversationId:cid,observedHeadSequence:100,items:[],hasMore:true,nextCursor:'older-page',observedAt:at}),list:async()=>Response.json({items:[{id:cid,headSequence:100,targetRoleRef:null,integrity:'NOT_RECHECKED',updatedAt:at}],hasMore:false,nextCursor:null,observedAt:at})};
 const client=new ui.ApiClient(async(path:string,init:any)=>{
  if(init?.method==='POST'){writes.push(path);throw Error('unexpected POST');}gets.push(path);
  if(path===`/api/v1/projects/${pid}`)return controls.project();
  if(path.includes('/knowledge?'))return Response.json({items:[{versionRef:data.knowledge.ref,title:data.knowledge.entry.title,kind:'FACT',sourceRefs:[data.source],reasonSnippet:'원문 보존',state:'PROPOSED'}],hasMore:false,nextCursor:null,searchScope:'TITLE_REASON',observedAt:at});
  if(path.includes('/knowledge/'))return Response.json(data.knowledge);
  if(path===messagePath)return controls.message();
  if(path.includes('/messages?'))return controls.page();
  if(path.includes('/conversations?'))return controls.list();
  throw Error('unexpected GET');
 });
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 const render=()=>root.render(shown?ui.React.createElement(ui.KnowledgePage,{client,projectId:currentProject,session:currentSession,buffer:null,onChange:(b:unknown)=>changes.push(b),conversationBuffer:buffer,onConversationChange:(b:unknown)=>changes.push(b),exclusion:null,onExclusionChange(){},correction:null,onCorrectionChange(){},decision:null,onDecisionChange(){},onAuthenticationLost(){lost++;}}):null);
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 const find=(name:string)=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===name);
 const settle=()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});
 const wait=async(check:()=>boolean)=>{for(let n=0;n<100&&!check();n++)await settle();assert(check(),container.textContent);};
 const click=async(name:string)=>{const b=find(name);assert(b,name);assert(!b.disabled);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));};
 await ui.React.act(async()=>render());await wait(()=>!!find('지식 원문 보기'));
 const source=async()=>{await click('지식 원문 보기');await wait(()=>!!find('대화 원문 보기'));await click('대화 원문 보기');await wait(()=>!!find('대화 '+cid+'에서 원문 확인'));await click('대화 '+cid+'에서 원문 확인');await wait(()=>nodes().some(n=>n.getAttribute('aria-label')==='출처 대화 원문'));};
 return {data,client,gets,writes,changes,controls,baseline,buffer,nodes,find,click,wait,settle,source,lost:()=>lost,container,
  context:async(s:typeof session,p=pid)=>{currentSession=s;currentProject=p;await ui.React.act(async()=>render());},
  route:async(show:boolean)=>{shown=show;await ui.React.act(async()=>render());},
  close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}

test('UI10 원문 이동: 검산 뒤 명시 클릭만 정확 원발언·방을 열고 첫 페이지 밖 및 UNKNOWN 버퍼 보존',async()=>{
 const f=await fixture(true);try{
  assert.equal(f.gets.filter(p=>p.includes('/messages')).length,0);assert(!f.find('이 원발언의 대화 열기'));
  await f.source();assert(f.find('이 원발언의 대화 열기'));assert.equal(f.gets.filter(p=>p.endsWith('/'+mid)).length,1);
  assert(!f.nodes().some(n=>n.getAttribute('aria-label')==='보관 대화 원문'));
  await f.click('이 원발언의 대화 열기');await f.wait(()=>f.nodes().some(n=>n.getAttribute('aria-label')==='보관 대화 원문'));
  assert.equal(f.nodes().find(n=>n.getAttribute('aria-label')==='보관 대화 원문')!.textContent,f.data.conversation.body);
  const original=f.nodes().find(n=>n.getAttribute('aria-label')==='보관 발언')!;assert(document.activeElement===original,'원발언 영역에 초점');assert.equal(original.scrolls,1);
  assert.equal(f.gets.filter(p=>p.endsWith('/'+mid)).length,2);assert.equal(f.gets.filter(p=>p.includes('/messages?')).length,1);
  assert(f.find('이전 발언 더 보기'));assert.equal(JSON.stringify(f.buffer),f.baseline);assert.equal(f.changes.length,0);assert.equal(f.writes.length,0);
 }finally{await f.close();}
});

test('UI10 원문 이동: room page 지연 중 같은 프로젝트 세션 교체 뒤 새 조회 잠금이 남지 않는다',async()=>{
 for(const status of [200,401]){const f=await fixture();try{
  await f.source();const gate=deferred<Response>(),page=await f.controls.page();f.controls.page=()=>gate.promise;
  await f.click('이 원발언의 대화 열기');await f.wait(()=>f.gets.some(p=>p.includes('/messages?')));
  await f.context({...session,csrfToken:'e'.repeat(43)});assert(!f.find('대화 목록 새로 확인')!.disabled);
  await f.click('대화 목록 새로 확인');gate.resolve(status===200?page:Response.json({error:{code:'AUTH_REQUIRED',message:'거절'}},{status:401}));for(let i=0;i<4;i++)await f.settle();
  assert.equal(f.lost(),0);assert(!f.nodes().some(n=>n.getAttribute('aria-label')==='보관 대화 원문'));assert(!f.find('대화 목록 새로 확인')!.disabled);
 }finally{await f.close();}}
});

test('UI10 원문 이동: 작성 준비 중 거절된 이동은 원 준비 요청을 취소하지 않는다',async()=>{
 const f=await fixture(false,false);try{
  await f.source();const gate=deferred<Response>(),project=await f.controls.project();f.controls.project=()=>gate.promise;
  await f.click('새 프로젝트 대화');await f.click('이 원발언의 대화 열기');await f.wait(()=>f.container.textContent.includes('CONVERSATION_NAVIGATION_BUSY'));
  gate.resolve(project);await f.wait(()=>f.changes.length===1);
  assert.equal((f.changes[0] as any).conversationId,null);assert.equal((f.changes[0] as any).controlGeneration,7);assert.equal(f.gets.filter(p=>p.includes('/messages?')).length,0);assert.equal(f.writes.length,0);
 }finally{await f.close();}
});

test('UI10 원문 이동: 클릭 재검산 403·401·hash 오류는 패널을 변경하지 않는다',async()=>{
 for(const mode of ['403','401','hash']as const){const f=await fixture();try{
  await f.source();f.controls.message=async()=>mode==='hash'?Response.json({...f.data.conversation,body:'다른 본문'}):Response.json({error:{code:mode==='401'?'AUTH_REQUIRED':'FORBIDDEN',message:'거절'}},{status:Number(mode)});
  await f.click('이 원발언의 대화 열기');await f.wait(()=>f.container.textContent.includes('원문을 채택하지 않았습니다'));
  assert.equal(f.gets.filter(p=>p.includes('/messages?')).length,0);assert(!f.nodes().some(n=>n.getAttribute('aria-label')==='보관 대화 원문'));assert.equal(f.lost(),mode==='401'?1:0);assert.equal(f.writes.length,0);
 }finally{await f.close();}}
});

test('UI10 원문 이동: 지연 재검산 뒤 닫기·세션·프로젝트 전환은 이동과 늦은401을 버린다',async()=>{
 for(const mode of ['close','session','project']as const){for(const status of [200,401]){const f=await fixture();try{
  await f.source();const gate=deferred<Response>();f.controls.message=()=>gate.promise;
  await f.click('이 원발언의 대화 열기');await f.wait(()=>f.gets.filter(p=>p.endsWith('/'+mid)).length===2);
  if(mode==='close')await f.click('대화 출처 원문 닫기');else await f.context({...session,csrfToken:'d'.repeat(43)},mode==='project'?'77777777-7777-4777-8777-777777777777':pid);
  gate.resolve(status===200?Response.json(f.data.conversation):Response.json({error:{code:'AUTH_REQUIRED',message:'거절'}},{status:401}));for(let i=0;i<4;i++)await f.settle();
  assert.equal(f.gets.filter(p=>p.includes('/messages?')).length,0);assert(!f.nodes().some(n=>n.getAttribute('aria-label')==='보관 대화 원문'));assert.equal(f.lost(),0);assert.equal(f.changes.length,0);
 }finally{await f.close();}}}
});

test('UI10 원문 이동: 앞선 목록 응답이 뒤늦게 와도 새 고정 선택을 덮지 않는다',async()=>{
 const f=await fixture();try{
  await f.source();const old=deferred<Response>();f.controls.list=()=>old.promise;
  await f.click('대화 목록 새로 확인');await f.click('이 원발언의 대화 열기');await f.wait(()=>f.nodes().some(n=>n.getAttribute('aria-label')==='보관 대화 원문'));
  old.resolve(Response.json({error:{code:'AUTH_REQUIRED',message:'거절'}},{status:401}));for(let i=0;i<4;i++)await f.settle();
  assert.equal(f.lost(),0);assert.equal(f.nodes().find(n=>n.getAttribute('aria-label')==='보관 대화 원문')!.textContent,f.data.conversation.body);assert.equal(f.changes.length,0);
 }finally{await f.close();}
});
