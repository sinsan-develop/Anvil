import test,{before,after} from 'node:test';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {resultFixture} from './result-view-fixture.ts';
import {reworkFixture} from '../FN12/result-rework-input-fixture.ts';
import {criteriaFixture,criteriaId as id,criteriaHash as hash} from '../FN12/result-criteria-fixture.ts';
import {prepareResultRework} from '../../../apps/server/modules/results/result-rework-input.ts';
import assert from 'node:assert/strict';
const m:any=await import('../../../apps/web/src/features/session-detail/result-rework-form.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
test('보완 입력은 같은 주체와 정확한 임무·결과·검수에만 다시 연결된다',()=>{
 assert.equal(typeof m.resultReworkFormKey,'function');
 const ref={id:'ref',version:1,contentHash:'a'.repeat(64)},scope={userId:'user',clientId:'client',projectId:'project',assignmentRef:{...ref},resultRef:{...ref},reviewRef:{...ref}},key=m.resultReworkFormKey(scope);
 const value={selected:['save'],files:['0:0'],bindingId:'binding',reason:'보완 사유'},store={[key]:value};
 assert.deepEqual(store[m.resultReworkFormKey(structuredClone(scope))],value);
 for(const field of ['userId','clientId','projectId'] as const){const changed=structuredClone(scope);changed[field]+='-other';assert.equal(store[m.resultReworkFormKey(changed)],undefined);}
 for(const field of ['assignmentRef','resultRef','reviewRef'] as const)for(const part of ['id','version','contentHash'] as const){const changed=structuredClone(scope);if(part==='version')changed[field].version++;else changed[field][part]+='other';assert.equal(store[m.resultReworkFormKey(changed)],undefined);}
 assert.deepEqual(scope.assignmentRef,ref);
});

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
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:stored-rework',name:'StoredReviewTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'rework-memory-entry',transform(code,id){if(id.replaceAll('\\','/').endsWith('/ResultReviewSources.tsx'))return code+'\nexport {ResultReworkEditor};';},resolveId(id){if(id.endsWith('virtual:stored-rework'))return '\0stored-rework';},load(id){if(id==='\0stored-rework')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{flushSync}from'react-dom';import{ResultReworkEditor}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};import * as writes from ${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/session-detail/result-rework-write-api.ts',import.meta.url)))};import{ResultCriteriaEditor}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/session-detail/ResultCriteriaEditor.tsx',import.meta.url)))};import * as criteriaWrites from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/session-detail/result-criteria-api.ts',import.meta.url)))};import{ResultSubmissionEditor}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/session-detail/ResultSubmissionEditor.tsx',import.meta.url)))};import * as submissionWrites from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/session-detail/result-submission-write-api.ts',import.meta.url)))};export{React,createRoot,flushSync,ResultReworkEditor,ResultCriteriaEditor,ResultSubmissionEditor,ApiClient,writes,criteriaWrites,submissionWrites};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return StoredReviewTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});



async function mount(){
 const f=reworkFixture(),binding:any=f.sources.binding,requests:{url:string;body:any}[]=[],container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 const controls:(()=>void)[]=[],commits:(()=>void)[]=[];
 const state:{deferBuffer?:boolean;delayControl?:boolean;delay:boolean;release:(()=>void)|null;status:number;readbackStatus:number}={delay:false,release:null,status:200,readbackStatus:200};let stored:any=null,lost=0,unavailable=0,buffers:Record<string,any>={},drafts:Record<string,any>={};
 const props:any={assignment:f.sources.assignment,result:f.sources.result,review:f.sources.review,responsibleState:{roles:[f.sources.role],bindings:[binding]},session:{user:{id:id(6)},clientId:id(24),csrfToken:'C'.repeat(43)},onAuthenticationLost:()=>lost++,onAccessUnavailable:()=>unavailable++};
 props.client=new ui.ApiClient(async(url:any,options:any)=>{
  const path=String(url),body=options?.body?JSON.parse(options.body):null;requests.push({url:path,body});let response:Response;
  if(path.endsWith('/result-reworks/prepare'))response=Response.json(prepareResultRework(f.sources,body,f.now));
  else if(path.endsWith('/commands')){
   const prepared=Object.values(buffers)[0]?.pending.prepared,at='2026-10-20T00:02:00.000Z',snapshot={scope:prepared.scope,input:body.payload,criteriaRef:prepared.criteriaRef,roleRef:prepared.roleRef,stageSessionRef:prepared.stageSessionRef,remainingMissingItems:prepared.remainingMissingItems,preservedItems:[],requestedBy:{kind:'HUMAN',userId:props.session.user.id,clientId:props.session.clientId},requestedAt:at,scopeVerification:prepared.scopeVerification,completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false};
   const ref={id:id(40),version:1,contentHash:hash(snapshot)},data={ref,status:'RESULT_REWORK_DRAFT_STORED',snapshot,reworkStored:true,currentBindingVerified:false,currentAuthorityVerified:false,completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false};stored={projectId:f.sources.assignment.projectId,...data,observedAt:at};
   response=Response.json(state.status===200?{commandId:body.commandId,operationId:id(41),projectId:f.sources.assignment.projectId,targetId:ref.id,version:1,status:'APPLIED',serverReceivedAt:at,data}:{code:'ACCESS_DENIED'},{status:state.status});
   if(state.delay)return new Promise<Response>(resolve=>{state.release=()=>resolve(response);});
  }else if(path.includes('/result-reworks/'))response=Response.json(state.readbackStatus===200?stored:{code:'ACCESS_DENIED'},{status:state.readbackStatus});
  else{assert.equal(path,'/api/v1/projects/'+f.sources.assignment.projectId);response=Response.json({id:f.sources.assignment.projectId,participation:'OWNER',controlState:{actorId:props.session.user.id,clientId:props.session.clientId,generation:3,status:'HELD'}});}
  if(state.delayControl&&path==='/api/v1/projects/'+f.sources.assignment.projectId)return new Promise<Response>(resolve=>controls.push(()=>resolve(response)));
  return response;
 });
 function render(){root.render(ui.React.createElement(ui.ResultReworkEditor,{...props,reworks:{buffers,onChange:(key:string,value:any)=>{const commit=()=>{buffers={...buffers,[key]:typeof value==='function'?value(buffers[key]??null):value};render();};if(state.deferBuffer)commits.push(commit);else commit();},form:{drafts,onChange:(key:string,value:any)=>{drafts={...drafts,[key]:typeof value==='function'?value(drafts[key]??null):value};render();}}}}));}
 const nodes=(n=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))];
 async function flush(){await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});}
 async function waitFor(check:()=>boolean){for(let n=0;n<100&&!check();n++)await flush();assert(check(),container.textContent);}
 const button=(text:string)=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===text);
 async function click(text:string){const node=button(text);assert(node,text);assert(!node.disabled);await ui.React.act(async()=>node.dispatchEvent({type:'click',button:0,bubbles:true}));}
 function captureChange(label:string){const node=nodes().find(n=>n.attributes.get('aria-label')===label);assert(node,label);const key=Object.keys(node).find(k=>k.startsWith('__reactProps$'));assert(key);return (node as any)[key].onChange as (event:{target:{value?:string}})=>void;}
 async function change(label:string,value?:string){const change=captureChange(label);await ui.React.act(async()=>change({target:{value}}));}
 async function prepareDraft(){await change('보완 조건 save');await change('보완 대상 예약 세션',binding.ref.id);await change('보완 파일 '+f.input.sourceScopes[0]!.targets[0]!.relativePath);await change('보완 요청 이유',f.input.reason);await click('보완 초안 명시 준비');await waitFor(()=>!!button('보완 저장 명령 준비'));}
 async function prepare(){await prepareDraft();await click('보완 저장 명령 준비');await waitFor(()=>!!Object.values(buffers)[0]);}
 await ui.React.act(async()=>render());
 return{f,props,requests,container,state,controls,commits,button,captureChange,change,click,prepare,prepareDraft,waitFor,flush,syncRender:()=>ui.flushSync(render),buffer:()=>Object.values(buffers)[0],replace:async(value:any)=>{await ui.React.act(async()=>{buffers={...buffers,[Object.keys(buffers)[0]!]:value};render();});},render:async()=>{await ui.React.act(async()=>render());},lost:()=>lost,unavailable:()=>unavailable,close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
const releaseLabel='미전송 보완 준비 해제 후 입력 수정';
test('실제 보완 화면: 명시 해제 취소/확인→입력 보존→새 준비→기존 저장',async()=>{
 const m=await mount();const oldConfirm=globalThis.confirm;try{
  await m.prepare();const original=m.buffer(),oldId=original.pending.command.commandId;assert(m.button(releaseLabel));
  globalThis.confirm=()=>false;await m.click(releaseLabel);assert.equal(m.buffer(),original);
  globalThis.confirm=()=>true;await m.click(releaseLabel);assert.equal(m.buffer(),null);assert.equal(m.requests.filter(r=>r.url.endsWith('/commands')).length,0);
  assert(!m.button('보완 저장 명령 준비'),'기존 준비 결과를 재사용하지 않음');
  await m.change('보완 요청 이유','수정한 이유');await m.click('보완 초안 명시 준비');await m.waitFor(()=>!!m.button('보완 저장 명령 준비'));await m.click('보완 저장 명령 준비');await m.waitFor(()=>!!m.buffer());
  assert.notEqual(m.buffer().pending.command.commandId,oldId);assert.deepEqual(m.buffer().pending.command.payload.missingItems,original.pending.command.payload.missingItems);assert.deepEqual(m.buffer().pending.command.payload.sourceScopes,original.pending.command.payload.sourceScopes);assert.equal(m.buffer().pending.command.payload.responsibleBindingRef.id,original.pending.command.payload.responsibleBindingRef.id);
  await m.click('보완 초안 명시 저장');await m.waitFor(()=>!!m.buffer().stored);assert.equal(m.requests.filter(r=>r.url.endsWith('/commands')).length,1);assert(!m.button(releaseLabel));
 }finally{globalThis.confirm=oldConfirm;await m.close();}
});

function handler(node:MemoryNode|undefined){assert(node);const key=Object.keys(node).find(k=>k.startsWith('__reactProps$'));assert(key);return (node as any)[key].onClick as ()=>void;}
test('명시 확인 중 원 buffer 변경·직접 전송은 해제하지 않는다',async()=>{
 for(const kind of ['mutation','direct-send']){const m=await mount(),oldConfirm=globalThis.confirm;try{await m.prepare();const original=m.buffer();
  if(kind==='mutation'){globalThis.confirm=()=>{original.pending.prepared.reason+='변경';return true;};await m.click(releaseLabel);}
  else{await assert.rejects(ui.writes.saveResultReworkWrite(new ui.ApiClient(async()=>{throw Error('synthetic loss');}),structuredClone(original.pending),m.props.session,()=>true));let confirmations=0;globalThis.confirm=()=>{confirmations++;return true;};await m.click(releaseLabel);assert.equal(confirmations,0);}
  assert.equal(m.buffer(),original);assert.equal(m.requests.filter(r=>r.url.endsWith('/commands')).length,0);
 }finally{globalThis.confirm=oldConfirm;await m.close();}}
});
test('버퍼 교체 ABA와 주체/session/client/transport/자료 ABA는 새 해제 자격이 아니다',async()=>{
 for(const kind of ['buffer','session','csrf','user','clientId','transport','client','project','result','review']){const m=await mount(),oldConfirm=globalThis.confirm;try{
  await m.prepare();const original=m.buffer(),stale=handler(m.button(releaseLabel));let confirmations=0;globalThis.confirm=()=>{confirmations++;return true;};
  if(kind==='buffer'){await m.replace({...original,bindingId:id(98)});await m.replace(original);}
  else{const originalProps={...m.props},originalSession=m.props.session,transport=m.props.client.transport;
   if(kind==='session')m.props.session={...originalSession};
   if(kind==='csrf')m.props.session={...originalSession,csrfToken:'D'.repeat(43)};
   if(kind==='user')m.props.session={...originalSession,user:{id:id(98)}};
   if(kind==='clientId')m.props.session={...originalSession,clientId:id(98)};
   if(kind==='transport')m.props.client.transport=async()=>Response.json({});
   if(kind==='client')m.props.client=new ui.ApiClient(transport);
   if(kind==='project')m.props.assignment={...m.props.assignment,projectId:id(98)};
   if(kind==='result')m.props.result={...m.props.result,ref:{...m.props.result.ref,contentHash:'a'.repeat(64)}};
   if(kind==='review')m.props.review={...m.props.review,ref:{...m.props.review.ref,contentHash:'b'.repeat(64)}};
   await m.render();Object.assign(m.props,originalProps);m.props.client.transport=transport;await m.render();
  }
  await ui.React.act(async()=>stale());assert.equal(confirmations,0,kind);assert.equal(m.buffer(),original,kind);assert(!m.button(releaseLabel),kind);assert.equal(m.requests.filter(r=>r.url.endsWith('/commands')).length,0);
 }finally{globalThis.confirm=oldConfirm;await m.close();}}
});
test('확인창 안의 세션 변경 및 화면 이탈 이후 오래된 클릭은 해제하지 않는다',async()=>{
 const m=await mount(),oldConfirm=globalThis.confirm;let closed=false;try{await m.prepare();const original=m.buffer(),stale=handler(m.button(releaseLabel));globalThis.confirm=()=>{m.props.session={...m.props.session,csrfToken:'D'.repeat(43)};m.syncRender();return true;};await m.click(releaseLabel);assert.equal(m.buffer(),original);
  await m.close();closed=true;globalThis.confirm=()=>{assert.fail('이탈 후 확인창 금지');};stale();assert.equal(m.buffer(),original);
 }finally{globalThis.confirm=oldConfirm;if(!closed)await m.close();}
});
test('전송 중·UNKNOWN·APPLIED 조회 실패는 원 명령 보존, 세션 변경 뒤 늦은401은 폐기',async()=>{
 for(const kind of ['inflight','readback','old401']){const m=await mount(),oldConfirm=globalThis.confirm;try{await m.prepare();const original=m.buffer(),stale=handler(m.button(releaseLabel));globalThis.confirm=()=>{assert.fail('전송 이후 미전송 확인 금지');};
  if(kind==='readback')m.state.readbackStatus=403;else{m.state.delay=true;if(kind==='old401')m.state.status=401;}
  await m.click('보완 초안 명시 저장');await m.waitFor(()=>m.requests.some(r=>r.url.endsWith('/commands')));await ui.React.act(async()=>stale());assert.equal(m.buffer().pending,original.pending);assert(!m.button(releaseLabel));
  if(kind==='old401'){m.props.session={...m.props.session,csrfToken:'D'.repeat(43)};await m.render();await ui.React.act(async()=>m.state.release!());await m.flush();assert.equal(m.lost(),0);assert.equal(m.unavailable(),0);assert.equal(m.buffer().uncertain,true);}
  else if(kind==='inflight'){await ui.React.act(async()=>m.state.release!());await m.waitFor(()=>!!m.buffer().stored);}
  else{await m.waitFor(()=>!!m.buffer().failure);assert.equal(m.buffer().uncertain,true);assert(m.button('같은 보완 명령 재확인'));assert(!m.button('확인된 거절 이후 보완 입력 수정'));}
  assert.equal(m.requests.filter(r=>r.url.endsWith('/commands')).length,1);
 }finally{globalThis.confirm=oldConfirm;await m.close();}}
});

test('같은 문맥에서 원 buffer 교체/ABA 후 지연401은 원 미결과 콜백을 바꾸지 않는다',async()=>{
 for(const aba of [false,true]){const m=await mount();try{await m.prepare();m.state.delay=true;m.state.status=401;await m.click('보완 초안 명시 저장');await m.waitFor(()=>!!m.state.release);const sent=m.buffer(),replacement={...sent,bindingId:id(97)};await m.replace(replacement);if(aba)await m.replace(sent);await ui.React.act(async()=>m.state.release!());await m.flush();assert.equal(m.buffer(),aba?sent:replacement);assert.equal(m.buffer().failure,null);assert.equal(m.lost(),0);assert.equal(m.unavailable(),0);assert.equal(m.requests.filter(r=>r.url.endsWith('/commands')).length,1);}finally{await m.close();}}
});
test('명확한 서버 거절의 기존 입력 수정과 동일 명령 재확인 버튼은 보존한다',async()=>{
 const m=await mount();try{await m.prepare();const original=m.buffer();m.state.status=403;await m.click('보완 초안 명시 저장');await m.waitFor(()=>!!m.buffer().failure);assert.equal(m.buffer().uncertain,false);assert(!m.button(releaseLabel));assert(m.button('같은 보완 명령 재확인'));await m.click('확인된 거절 이후 보완 입력 수정');assert.equal(m.buffer(),null);assert(m.button('보완 저장 명령 준비'));assert.equal(m.requests.filter(r=>r.url.endsWith('/commands')).length,1);assert.equal(original.pending.command.payload.reason,m.f.input.reason);}finally{await m.close();}
});


test('제어 GET 대기 중 수정 뒤 새 준비는 원 입력을 유지하고 이전 준비를 폐기한다',async()=>{
 const m=await mount();try{
  await m.prepareDraft();m.state.delayControl=true;await m.click('보완 저장 명령 준비');await m.waitFor(()=>m.controls.length===1);
  await m.change('보완 요청 이유','대기 중 수정한 이유');
  await ui.React.act(async()=>m.controls[0]!());await m.flush();assert.equal(m.buffer(),undefined);
  m.state.delayControl=false;await m.click('보완 초안 명시 준비');await m.waitFor(()=>!!m.button('보완 저장 명령 준비'));
  await m.click('보완 저장 명령 준비');await m.waitFor(()=>!!m.buffer());
  assert.equal(m.buffer().pending.command.payload.reason,'대기 중 수정한 이유');assert.equal(m.requests.filter(r=>r.url.endsWith('/commands')).length,0);
 }finally{await m.close();}
});

test('늦은 이전 PREPARE finally는 최신 준비 잠금과 상태를 회수하지 않는다',async()=>{
 const m=await mount();try{
  await m.prepareDraft();m.state.delayControl=true;await m.click('보완 저장 명령 준비');await m.waitFor(()=>m.controls.length===1);
  await m.change('보완 요청 이유','새 원 준비');await m.click('보완 초안 명시 준비');await m.waitFor(()=>!!m.button('보완 저장 명령 준비'));
  await m.click('보완 저장 명령 준비');await m.waitFor(()=>m.controls.length===2);
  await ui.React.act(async()=>m.controls[0]!());await m.flush();assert.equal(m.buffer(),undefined);assert.equal(m.button('보완 저장 명령 준비')!.disabled,true);
  await ui.React.act(async()=>m.controls[1]!());await m.waitFor(()=>!!m.buffer());assert.equal(m.buffer().pending.command.payload.reason,'새 원 준비');
  assert.equal(m.requests.filter(r=>r.url.endsWith('/commands')).length,0);
 }finally{await m.close();}
});


test('이전 입력 이벤트는 진행 중 SAVE의 원 명령·잠금·결과 수거를 무효화하지 않는다',async()=>{
 const m=await mount();try{
  await m.prepareDraft();const stale=m.captureChange('보완 요청 이유');await m.click('보완 저장 명령 준비');await m.waitFor(()=>!!m.buffer());
  const original=m.buffer().pending;m.state.delay=true;await m.click('보완 초안 명시 저장');await m.waitFor(()=>!!m.state.release);
  await ui.React.act(async()=>stale({target:{value:'늦은 수정'}}));await m.flush();
  assert.equal(m.buffer().pending,original);assert.equal(m.button('같은 보완 명령 재확인')!.disabled,true);
  await ui.React.act(async()=>m.state.release!());await m.waitFor(()=>!!m.buffer().stored);
  assert.equal(m.buffer().pending,original);assert.equal(m.buffer().stored.snapshot.input.reason,original.command.payload.reason);
  assert.equal(m.requests.filter(r=>r.url.endsWith('/commands')).length,1);
 }finally{await m.close();}
});


test('완료된 PREPARE의 지연 부모 updater는 잠금 회수 후에도 원 pending을 보존한다',async()=>{
 const m=await mount();try{
  await m.prepareDraft();m.state.deferBuffer=true;await m.click('보완 저장 명령 준비');
  await m.waitFor(()=>m.commits.length===1&&!m.button('보완 저장 명령 준비')!.disabled);
  assert.equal(m.buffer(),undefined);await ui.React.act(async()=>m.commits[0]!());
  assert(m.buffer()?.pending,'finally 이후 원 준비 commit');assert.equal(m.buffer().pending.command.payload.reason,m.f.input.reason);
  assert.equal(m.requests.filter(r=>r.url.endsWith('/commands')).length,0);
 }finally{await m.close();}
});

test('완료 PREPARE의 지연 부모 updater는 그 사이 입력 변경 뒤 pending을 만들지 않는다',async()=>{
 const m=await mount();try{
  await m.prepareDraft();m.state.deferBuffer=true;await m.click('보완 저장 명령 준비');
  await m.waitFor(()=>m.commits.length===1&&!m.button('보완 저장 명령 준비')!.disabled);
  await m.change('보완 요청 이유','지연 commit 이전 수정');await ui.React.act(async()=>m.commits[0]!());assert.equal(m.buffer(),null);
  m.state.deferBuffer=false;await m.click('보완 초안 명시 준비');await m.waitFor(()=>!!m.button('보완 저장 명령 준비'));await m.click('보완 저장 명령 준비');await m.waitFor(()=>!!m.buffer());
  assert.equal(m.buffer().pending.command.payload.reason,'지연 commit 이전 수정');assert.equal(m.requests.filter(r=>r.url.endsWith('/commands')).length,0);
 }finally{await m.close();}
});


test('지연 PREPARE commit은 새 시도 또는 문맥 교체 뒤 재생되지 않는다',async()=>{
 for(const kind of ['attempt','context']){const m=await mount();try{
  await m.prepareDraft();m.state.deferBuffer=true;await m.click('보완 저장 명령 준비');await m.waitFor(()=>m.commits.length===1&&!m.button('보완 저장 명령 준비')!.disabled);
  if(kind==='attempt'){await m.click('보완 저장 명령 준비');await m.waitFor(()=>m.commits.length===2&&!m.button('보완 저장 명령 준비')!.disabled);}
  else{m.props.session={...m.props.session,csrfToken:'D'.repeat(43)};await m.render();}
  await ui.React.act(async()=>m.commits[0]!());assert.equal(m.buffer(),null,kind);
  if(kind==='attempt'){await ui.React.act(async()=>m.commits[1]!());assert(m.buffer()?.pending);}
  assert.equal(m.requests.filter(r=>r.url.endsWith('/commands')).length,0);
 }finally{await m.close();}}
});


async function mountCriteria(){
 const f=criteriaFixture(),session={user:{id:id(6)},clientId:id(8),csrfToken:'A'.repeat(43)},rows=[{field:'acceptanceCriteria',index:0,criterionId:'save',testId:'SAVE-01',kind:'INTEGRATION'},{field:'verificationRequirements',index:0,criterionId:'denied',testId:'DENY-01',kind:'SECURITY'}];
 const pending=await ui.criteriaWrites.prepareCriteriaRegistration(f.assignment,rows,'원 기준 입력',session,3);
 let buffer:any={bindingId:id(90),ownerUserId:session.user.id,ownerClientId:session.clientId,assignmentRef:f.assignment.ref,controlGeneration:3,rows,reason:'원 기준 입력',pending,stored:null,dirty:true,uncertain:false,failure:null},shown=true;
 const original=buffer,updates:(()=>void)[]=[],controls:(()=>void)[]=[],requests:string[]=[],state={defer:false},container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 const props:any={assignment:f.assignment,session,onAuthenticationLost(){},onAccessUnavailable(){}};
 props.client=new ui.ApiClient(async(url:any,options:any)=>{requests.push(options?.method??'GET');assert.notEqual(options?.method,'POST');return new Promise<Response>(resolve=>controls.push(()=>resolve(Response.json({code:'ACCESS_DENIED'},{status:403}))));});
 function render(){root.render(shown?ui.React.createElement(ui.ResultCriteriaEditor,{...props,buffer,onChange:(change:any)=>{const update=()=>{buffer=typeof change==='function'?change(buffer):change;render();};if(state.defer)updates.push(update);else update();}}):null);}
 const nodes=(n=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))];
 const button=(label:string)=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===label);
 const flush=async()=>ui.React.act(async()=>{await new Promise(resolve=>setImmediate(resolve));});
 await ui.React.act(async()=>render());
 return{props,original,pending,state,updates,controls,requests,button,buffer:()=>buffer,flush,render:()=>ui.React.act(async()=>render()),depart:()=>ui.flushSync(()=>{shown=false;render();}),
  close:async()=>{await ui.React.act(async()=>{for(const finish of controls)finish();await new Promise(resolve=>setImmediate(resolve));});await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
const criteriaRelease='미전송 기준 저장 준비 해제';
test('기준 해제 confirm 중 SAVE 진입 또는 editor 이탈은 원 준비를 보존한다',async()=>{
 for(const mode of ['save','unmount']){const m=await mountCriteria(),oldConfirm=globalThis.confirm;try{
  const save=handler(m.button('검수 기준 명시 저장')),release=handler(m.button(criteriaRelease));
  globalThis.confirm=()=>{if(mode==='save')save();else m.depart();return true;};
  await ui.React.act(async()=>release());assert.equal(m.buffer().pending===m.pending,true,mode);assert.equal(m.requests.filter(v=>v==='GET').length,mode==='save'?1:0);assert(!m.requests.includes('POST'));
 }finally{globalThis.confirm=oldConfirm;await m.close();}}
});
test('기준 해제 취소와 정상 확인은 원 입력을 유지하고 명령만 한 번 해제한다',async()=>{
 const m=await mountCriteria(),oldConfirm=globalThis.confirm;try{
  const release=handler(m.button(criteriaRelease));globalThis.confirm=()=>false;await ui.React.act(async()=>release());assert.equal(m.buffer(),m.original);
  globalThis.confirm=()=>true;await ui.React.act(async()=>release());assert.deepEqual(m.buffer(),{...m.original,pending:null,dirty:true});assert.equal(m.requests.length,0);
 }finally{globalThis.confirm=oldConfirm;await m.close();}
});
test('지연 기준 해제 updater는 SAVE 또는 문맥 변경 뒤 원 pending을 비우지 않는다',async()=>{
 for(const mode of ['save','session','transport','generation']){const m=await mountCriteria(),oldConfirm=globalThis.confirm;try{
  m.state.defer=true;globalThis.confirm=()=>true;await ui.React.act(async()=>handler(m.button(criteriaRelease))());assert.equal(m.updates.length,1);
  if(mode==='save')await ui.React.act(async()=>handler(m.button('검수 기준 명시 저장'))());
  else if(mode==='session'){m.props.session={...m.props.session,csrfToken:'D'.repeat(43)};await m.render();}
  else if(mode==='transport'){m.props.client.transport=async()=>{throw Error('MUST_NOT_CALL');};await m.render();}
  else{m.original.controlGeneration++;await m.render();}
  await ui.React.act(async()=>m.updates[0]!());assert.equal(m.buffer().pending===m.pending,true,mode);assert(!m.requests.includes('POST'));
 }finally{globalThis.confirm=oldConfirm;await m.close();}}
});


async function mountSubmission(rejected=false){
 const assignment=criteriaFixture().assignment,session={user:{id:id(6)},clientId:id(8),csrfToken:'A'.repeat(43)},f=resultFixture();
 const scope={...f.entry.snapshot.scope,projectId:assignment.projectId,assignmentRef:assignment.ref},manifest={...f.entry.snapshot.manifest,assignmentRef:assignment.ref};
 let buffer=await ui.submissionWrites.prepareResultSubmissionFile(new TextEncoder().encode(JSON.stringify({scope,manifest})),assignment.projectId,assignment.ref,session,3);
 if(rejected){buffer.pending=await ui.submissionWrites.prepareResultSubmitCommand(buffer,session,true);buffer.failure={code:'ACCESS_DENIED',status:403};}
 const original=buffer,key=ui.submissionWrites.resultSubmissionKey(session,assignment.projectId,assignment.ref),updates:(()=>void)[]=[],controls:(()=>void)[]=[],requests:string[]=[],state={defer:false};let shown=true;
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container),props:any={assignment,session,onStored(){},onAuthenticationLost(){}};
 props.client=new ui.ApiClient(async(_url:any,options:any)=>{requests.push(options?.method??'GET');assert.notEqual(options?.method,'POST');return new Promise<Response>(resolve=>controls.push(()=>resolve(Response.json({code:'ACCESS_DENIED'},{status:403}))));});
 function render(){root.render(shown?ui.React.createElement(ui.ResultSubmissionEditor,{...props,storage:{buffers:{[key]:buffer},onChange:(chosenKey:string,change:any)=>{assert.equal(chosenKey,key);const commit=()=>{buffer=change(buffer);render();};if(state.defer)updates.push(commit);else commit();}}}):null);}
 const nodes=(n=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))];const button=(label:string)=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===label);
 await ui.React.act(async()=>render());
 // Explicit acknowledgement through the actual React handler, without selecting a file.
 if(!rejected)await ui.React.act(async()=>{const node=nodes().filter(n=>n.tagName==='INPUT').at(-1)!;const prop=Object.keys(node).find(k=>k.startsWith('__reactProps$'))!;(node as any)[prop].onChange({target:{checked:true}});});
 return{props,original,state,updates,requests,button,buffer:()=>buffer,render:()=>ui.React.act(async()=>render()),replace:(value:any)=>{buffer=value;},depart:()=>ui.flushSync(()=>{shown=false;render();}),
 close:async()=>{await ui.React.act(async()=>{for(const finish of controls)finish();await new Promise(resolve=>setImmediate(resolve));});await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
const submissionReset=(rejected:boolean)=>rejected?'결과 제출 거절 확인 후 준비로 돌아가기':'결과 준비 입력 비우기';
const submissionSave=(rejected:boolean)=>rejected?'같은 결과 제출 명령 결과 확인':'결과 제출 내용 등록';
for(const rejected of [false,true]){
 test(`제출 ${rejected?'거절 복귀':'입력 비우기'} confirm 중 SAVE는 원 입력과 명령을 보존한다`,async()=>{
  const m=await mountSubmission(rejected),oldConfirm=globalThis.confirm;try{
   const save=handler(m.button(submissionSave(rejected)));globalThis.confirm=()=>{save();return true;};
   await ui.React.act(async()=>handler(m.button(submissionReset(rejected)))());assert.equal(m.buffer()===m.original,true);assert.deepEqual(m.requests,['GET']);
  }finally{globalThis.confirm=oldConfirm;await m.close();}
 });
 test(`제출 ${rejected?'거절 복귀':'입력 비우기'} confirm 중 이탈은 원 입력과 명령을 보존한다`,async()=>{
  const m=await mountSubmission(rejected),oldConfirm=globalThis.confirm;try{
   globalThis.confirm=()=>{m.depart();return true;};await ui.React.act(async()=>handler(m.button(submissionReset(rejected)))());assert.equal(m.buffer()===m.original,true);assert.equal(m.requests.length,0);
  }finally{globalThis.confirm=oldConfirm;await m.close();}
 });
 test(`제출 ${rejected?'거절 복귀':'입력 비우기'} 지연 updater는 새 시도와 문맥 교체 뒤 폐기된다`,async()=>{
  for(const mode of ['save','session','transport','buffer','assignment','generation','aba']){const m=await mountSubmission(rejected),oldConfirm=globalThis.confirm;try{
   m.state.defer=true;globalThis.confirm=()=>true;await ui.React.act(async()=>handler(m.button(submissionReset(rejected)))());assert.equal(m.updates.length,1);
   if(mode==='save')await ui.React.act(async()=>handler(m.button(submissionSave(rejected)))());
   else if(mode==='session')m.props.session={...m.props.session,csrfToken:'D'.repeat(43)};
   else if(mode==='transport')m.props.client.transport=async()=>{throw Error('MUST_NOT_CALL');};
   else if(mode==='buffer')m.replace({...m.original});
   else if(mode==='assignment')m.props.assignment={...m.props.assignment,ref:{...m.props.assignment.ref,version:2}};
   else if(mode==='generation')m.original.controlGeneration++;
   else{const original=m.props.session;m.props.session={...original,csrfToken:'D'.repeat(43)};await m.render();m.props.session=original;}
   await m.render();const before=m.buffer();await ui.React.act(async()=>m.updates[0]!());assert.equal(m.buffer()===before,true,mode);assert(!m.requests.includes('POST'));
  }finally{globalThis.confirm=oldConfirm;await m.close();}}
 });
 test(`제출 ${rejected?'거절 복귀':'입력 비우기'} 취소와 정상 지연 확인은 기존 의미를 유지한다`,async()=>{
  const m=await mountSubmission(rejected),oldConfirm=globalThis.confirm;try{
   globalThis.confirm=()=>false;await ui.React.act(async()=>handler(m.button(submissionReset(rejected)))());assert.equal(m.buffer(),m.original);
   m.state.defer=true;globalThis.confirm=()=>true;await ui.React.act(async()=>handler(m.button(submissionReset(rejected)))());assert.equal(m.buffer(),m.original);assert.equal(m.updates.length,1);
   await ui.React.act(async()=>m.updates[0]!());assert.deepEqual(m.buffer(),rejected?{...m.original,pending:null,failure:null}:null);assert.equal(m.requests.length,0);
  }finally{globalThis.confirm=oldConfirm;await m.close();}
 });
}
