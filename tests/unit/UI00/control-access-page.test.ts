import assert from 'node:assert/strict';
import {test,after,before} from 'node:test';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {createControlHandoffSummary} from '../../../apps/server/modules/control-handoff/control-handoff-summary.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
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
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/control-handoff/ControlAccessPage.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:control-acceptance',name:'ControlAcceptanceMemoryTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'rework-memory-entry',resolveId(id){if(id.endsWith('virtual:control-acceptance'))return '\0control-acceptance';},load(id){if(id==='\0control-acceptance')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{ControlAccessPage,ControlSummaryView}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};import{renderToStaticMarkup}from'react-dom/server';export{React,createRoot,ControlAccessPage,ControlSummaryView,ApiClient,renderToStaticMarkup};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return ControlAcceptanceMemoryTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});


async function render(projectId:string){
 const {ControlAccessPage}=ui;let calls=0,lost=0;
 const html=ui.renderToStaticMarkup(ui.React.createElement(ControlAccessPage,{client:new ApiClient(async()=>{calls++;throw Error('페이지 열기 요청 금지');}),projectId,onAuthenticationLost:()=>{lost++;}}));
 assert.equal(calls,0);assert.equal(lost,0);return html;
}
test('인계 메뉴는 기존 제어 조회를 제공하되 열기만으로 조회·허가·수락하지 않는다',async()=>{
 const html=await render('11111111-1111-4111-8111-111111111111');
 for(const text of ['작업 권한 인계','선택 프로젝트 제어·준비 상태 조회','명시적으로 수락합니다','조회는 인수 요청·수락·새 권한 발급이 아닙니다'])assert.ok(html.includes(text),text);
 // UI12 adds explicit FN15 queries and a preserved SELF form; opening still sends nothing.
 assert.equal((html.match(/<button/g)??[]).length,6);
 assert.equal((html.match(/<textarea/g)??[]).length,1);assert.equal((html.match(/<input/g)??[]).length,1);assert.doesNotMatch(html,/<form/);
 for(const label of ['현재 제어 조회','인수 요청 이유','요청 만료 시각','내 요청 목록 조회','현재 제어자 요청 목록 조회','인수 수락 명령 보존','실제 보호 근거가 없으면 수락할 수 없습니다.']) assert.ok(html.includes(label),label);
 assert.match(html,/<button[^>]*disabled[^>]*>인수 수락 명령 보존<\/button>/);
});
test('제어 메뉴의 이동은 선택 프로젝트에만 연결하고 다른 프로젝트를 섞지 않는다',async()=>{
 const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';
 const html=await render(second);assert.ok(html.includes('#/projects/'+second+'/workspace'));assert.equal(html.includes(first),false);
});

test('요약 30초 기한 경과와 원요청 20분 기한 내를 서버 관측으로 분리 표시한다',async()=>{
 const {ControlSummaryView}=ui;
 const projectId='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',requestRef={id,version:1,contentHash:'a'.repeat(64)},basis={actorId:id,clientId:'33333333-3333-4333-8333-333333333333',generation:1,version:1};
 const expiresAt='2026-10-26T00:20:00.000Z';const record=createControlHandoffSummary({projectId,requestRef,version:1,controller:basis,baseControl:basis,observedAt:'2026-10-26T00:00:00.000Z',requestExpiresAt:expiresAt,collections:{activeExecutions:null,pendingCommands:null,pendingApprovals:null,sourceCheckpointRefs:null}});
 const summary={projectId,requestRef,summaryRef:record.summaryRef,body:record.body,observedAt:'2026-10-26T00:01:00.000Z',current:{expired:false,baseControlState:'MATCHED'},executionAuthorized:false,controlTransferred:false};
 const html=ui.renderToStaticMarkup(ui.React.createElement(ControlSummaryView,{summary,requestExpiresAt:expiresAt}));
 assert.ok(html.includes('요약 기한 경과'));assert.ok(html.includes('원요청은 관측 시점 기한 내'));assert.ok(html.includes(summary.observedAt));assert.ok(html.includes(record.body.validUntil));assert.doesNotMatch(html,/관측 시점 요약 기한 내/);
});


const allNodes=(n:MemoryNode):MemoryNode[]=>[n,...n.childNodes.flatMap(allNodes)];
async function settleUi(check:()=>boolean){for(let i=0;i<40;i++){if(check())return;await ui.React.act(async()=>{await new Promise<void>(r=>setImmediate(r));});}assert.fail('유한 React 정착 누락');}
const fixedIds={project:'11111111-1111-4111-8111-111111111111',actor:'44444444-4444-4444-8444-444444444444',client:'55555555-5555-4555-8555-555555555555'};
async function followupFixture(options:{role:string;state?:string;expired?:boolean;wrongActor?:boolean;wrongBasis?:boolean}){
 const facts=await import('../FN15/control-handoff-summary-fixture.ts'),bundle=facts.requestBundle(),request=bundle.request,projectId=facts.projectId,targetSession={user:{id:facts.controller,displayName:'현재 제어 사용자'},clientId:facts.controllerClient,csrfToken:'c'.repeat(43)};
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container),calls:string[]=[];let buffer:any={bindingId:'99999999-9999-4999-8999-000000000090',ownerUserId:targetSession.user.id,ownerClientId:targetSession.clientId,projectId,reason:'원 입력',expiresAt:'',pending:null},lost=0;
 const state={schemaVersion:1,projectId,observedAt:facts.now,actorId:options.wrongActor?facts.requester:facts.controller,clientId:facts.controllerClient,participation:options.role,control:{state:options.state??'HELD',basis:options.wrongBasis?{...facts.baseControl,clientId:facts.requesterClient}:facts.baseControl},executionAuthorized:false,controlTransferred:false};
 const current={expired:options.expired??false,baseControlState:'MATCHED'},read={projectId,requestRef:request.requestRef,snapshot:request.snapshot,observedAt:facts.now,current,executionAuthorized:false,controlTransferred:false};
 const client=new ui.ApiClient(async(path:string,init?:RequestInit)=>{calls.push(path);assert.notEqual(init?.method,'POST','명령 보존 전후 자동 POST0');const url=new URL(path,'https://test.invalid');
  if(url.pathname.endsWith('/control-state'))return Response.json(state);
  if(url.pathname.endsWith('/control-requests'))return Response.json({projectId,view:'CONTROLLER',limit:50,observedAt:facts.now,items:[{requestRef:request.requestRef,createdAt:request.snapshot.createdAt,expiresAt:request.snapshot.expiresAt,storedState:'PENDING',current,executionAuthorized:false,controlTransferred:false}],hasMore:false,nextCursor:null,executionAuthorized:false,controlTransferred:false});
  if(url.pathname.endsWith('/versions/1'))return Response.json(read);throw Error('예상 밖 IO '+path);
 });
 const props:any={client,projectId,session:targetSession,buffer,onChange:(expected:string|null,next:any)=>{if(buffer.bindingId!==expected)return false;buffer=next;props.buffer=buffer;root.render(ui.React.createElement(ui.ControlAccessPage,props));return true;},onAuthenticationLost:()=>{lost++;}};
 const render=async()=>ui.React.act(async()=>root.render(ui.React.createElement(ui.ControlAccessPage,props)));
 const button=(label:string)=>{const n=allNodes(container).find(x=>x.tagName==='BUTTON'&&x.textContent===label);assert.ok(n,label);return n;};
 const click=async(label:string)=>{const n=button(label);assert.equal(n.disabled,false,label);await ui.React.act(async()=>n.dispatchEvent({type:'click',button:0}));};
 const close=async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);};await render();return{container,props,calls,render,button,click,close,getBuffer:()=>buffer,lost:()=>lost};
}

test('실제 UI의 물리검산 HELD 응답은 OWNER와 HE 모두 CONTROLLER조회·후속 보호요약 명령으로 연결한다',async()=>{
 for(const role of ['OWNER','HANDOFF_ELIGIBLE']){const f=await followupFixture({role});try{
  assert.equal(f.calls.length,0);await f.click('현재 제어 조회');await settleUi(()=>f.container.textContent.includes('HELD'));await f.click('현재 제어자 요청 목록 조회');await settleUi(()=>f.container.textContent.includes('요청 1 원문 확인'));await f.click('요청 1 원문 확인');await settleUi(()=>f.container.textContent.includes('선택한 고정 요청'));
  assert.equal(f.button('미확인 요약 준비 명령 보존').disabled,false);await f.click('보호요약 준비 명령 보존');assert.equal(f.getBuffer().pending.kind,'PROTECTED_PREPARE');assert.equal(f.getBuffer().pending.command.operation,'prepareControlHandoff');assert.equal(f.getBuffer().pending.command.clientId,f.props.session.clientId);assert.equal(f.getBuffer().pending.status,'READY');assert.equal(f.calls.length,3);
 }finally{await f.close();}}
});

test('HE 역할만·미확인·다른client·VIEWER·일치하지않는응답·만료요청·폐기문맥은 후속 UI를 열지 않는다',async()=>{
 for(const options of [{role:'HANDOFF_ELIGIBLE',state:'UNVERIFIED'},{role:'HANDOFF_ELIGIBLE',state:'OTHER_CLIENT'},{role:'VIEWER'},{role:'HANDOFF_ELIGIBLE',wrongActor:true},{role:'HANDOFF_ELIGIBLE',wrongBasis:true}]){const f=await followupFixture(options);try{await f.click('현재 제어 조회');await settleUi(()=>!f.container.textContent.includes('조회·결과 확인 중입니다.'));assert.equal(f.button('현재 제어자 요청 목록 조회').disabled,true);assert.equal(f.calls.length,1);assert.equal(f.getBuffer().pending,null);}finally{await f.close();}}
 const expired=await followupFixture({role:'HANDOFF_ELIGIBLE',expired:true});try{await expired.click('현재 제어 조회');await settleUi(()=>expired.container.textContent.includes('HELD'));await expired.click('현재 제어자 요청 목록 조회');await settleUi(()=>expired.container.textContent.includes('요청 1 원문 확인'));await expired.click('요청 1 원문 확인');await settleUi(()=>expired.container.textContent.includes('선택한 고정 요청'));assert.equal(expired.button('보호요약 준비 명령 보존').disabled,true);assert.equal(expired.button('미확인 요약 준비 명령 보존').disabled,true);assert.equal(expired.getBuffer().pending,null);}finally{await expired.close();}
 const stale=await followupFixture({role:'HANDOFF_ELIGIBLE'});try{await stale.click('현재 제어 조회');await settleUi(()=>stale.container.textContent.includes('HELD'));const original=stale.getBuffer();original.pending={bindingId:'99999999-9999-4999-8999-000000000091',status:'UNKNOWN',command:{schemaVersion:1,operation:'prepareControlHandoff',commandId:'99999999-9999-4999-8999-000000000092',projectId:stale.props.projectId,clientId:stale.props.session.clientId,payload:{requestRef:{id:fixedIds.project,version:1,contentHash:'a'.repeat(64)}}}};stale.props.session={...stale.props.session};await stale.render();assert.equal(stale.button('현재 제어자 요청 목록 조회').disabled,true);assert.equal(stale.getBuffer(),original);assert.equal(stale.getBuffer().pending.status,'UNKNOWN');assert.equal(stale.calls.length,1);assert.equal(stale.lost(),0);}finally{await stale.close();}
});
