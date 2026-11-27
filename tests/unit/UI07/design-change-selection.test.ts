import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {designChangeFixture,projectId} from './design-change-fixture.ts';
import {newDesignChangeRequest} from '../../../apps/web/src/features/design-change/request-api.ts';
import {newImpactReview, prepareImpactReview, type ImpactReviewBuffer} from '../../../apps/web/src/features/design-change/impact-review-api.ts';
import type {DesignChangePage} from '../../../apps/web/src/features/design-change/api.ts';
/** 실제 ReactDOM의 요소/이벤트/effect를 실행하는 최소 메모리 DOM. 레이아웃·브라우저 보안·시각 검증은 아니다. */
class MemoryNode{
 nodeType:number;nodeName:string;tagName:string;localName:string;namespaceURI='http://www.w3.org/1999/xhtml';parentNode:MemoryNode|null=null;childNodes:MemoryNode[]=[];ownerDocument:any;attributes=new Map<string,string>();style:Record<string,unknown>={};listeners=new Map<string,Function[]>();value='';checked=false;disabled=false;data='';
 constructor(name:string,type=1,owner?:any){this.nodeType=type;this.nodeName=type===1?name.toUpperCase():name;this.tagName=this.nodeName;this.localName=name;this.ownerDocument=owner;}
 get nodeValue():string|null{return this.nodeType===3?this.data:null;}set nodeValue(v:string|null){if(this.nodeType===3)this.data=v??'';}
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
const document:any=new MemoryNode('#document',9);document.ownerDocument=document;document.createElement=(n:string)=>new MemoryNode(n,1,document);document.createElementNS=(_ns:string,n:string)=>document.createElement(n);document.createTextNode=(s:string)=>{const n=new MemoryNode('#text',3,document);n.data=s;return n;};document.documentElement=document.createElement('html');document.body=document.createElement('body');document.documentElement.appendChild(document.body);document.activeElement=document.body;
const saved=new Map<string,PropertyDescriptor|undefined>();let ui:any;
const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
before(async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/design-change/DesignChangesPage.tsx',import.meta.url)),client=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:change-selection',name:'ChangeSelectionTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'change-selection-memory',resolveId(id){if(id.endsWith('virtual:change-selection'))return '\0change-selection';},load(id){if(id==='\0change-selection')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{DesignChangesPage}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(client)};export{React,createRoot,DesignChangesPage,ApiClient};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,location:{hash:'#/projects/'+projectId+'/changes'},HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return ChangeSelectionTest;')();
});
after(()=>{for(const channel of channels){channel.port1.close();channel.port2.close();}for(const[key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});

const hash=(v:unknown)=>contentHash(canonicalJson(v));
function page(id:string,reason:string):DesignChangePage{
 const p=designChangeFixture();p.change.ref.id=id;p.change.reason=reason;
 const{ref,status,requestedBy,createdAt,...snapshot}=p.change;p.change.ref.contentHash=hash(snapshot);
 for(const impact of [...p.impactVersions].reverse()){
  impact.changeRef=p.change.ref;const{ref,observedAt,...body}=impact;ref.contentHash=hash(body);
 }
 return p as DesignChangePage;
}
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{resolve,promise};}
const openA='등록한 변경 요청 재조회',openB='검토한 변경 요청 재조회';
async function fixture(editReview=false,restorePending=false){
 const a=page('22222222-2222-4222-8222-222222222222','선택 A 원문'),b=page('77777777-7777-4777-8777-777777777777','선택 B 원문');
 const session={user:{id:projectId},clientId:'88888888-8888-4888-8888-888888888888',csrfToken:'C'.repeat(43)};
 const buffer={...newDesignChangeRequest(projectId,session,1,a.change.beforeRef,a.change.afterProposalRef),result:a,dirty:false};
 const reviewBuffer=editReview?newImpactReview(projectId,session,1,a):{...newImpactReview(projectId,session,1,b),result:b,dirty:false};
 if(editReview){
  reviewBuffer.input.reason='사용자의 영향 검토';
  for(const item of reviewBuffer.input.items)item.reason='영향을 보여주는 자료 미확인';
  if(restorePending){reviewBuffer.pending=prepareImpactReview(reviewBuffer,session,true);reviewBuffer.uncertain=true;}
 }
 const calls:string[]=[],auth:string[]=[],effects:any[]=[];const gate=deferred<Response>();
 const posts:{path:string;body:string;idem:string|null}[]=[],updates:((before:ImpactReviewBuffer|null)=>ImpactReviewBuffer|null)[]=[];
 const currentControl=()=>Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:1,status:'HELD'}});
 type ReviewUpdate=(before:ImpactReviewBuffer|null)=>ImpactReviewBuffer|null;
 const controls={automatic:false,deferOutcome:false,access:async()=>currentControl(),read:async(path:string)=>path.includes(a.change.ref.id)?gate.promise:Response.json(b),post:async(_init:RequestInit):Promise<Response>=>{throw Error('합성 전송 응답 유실');}};
 const client=new ui.ApiClient(async(path:string,init:RequestInit)=>{
  if(init.method==='POST'){
   posts.push({path,body:String(init.body),idem:new Headers(init.headers).get('Idempotency-Key')});
   assert(editReview,'조회 중 POST 금지');return controls.post(init);
  }
  assert.equal(init.method,'GET');calls.push(path);
  if(path===`/api/v1/projects/${projectId}`)return controls.access();
  return controls.read(path);
 });
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 let props:any={client,projectId,session,buffer,reviewBuffer,onChange:()=>assert.fail('읽기로 원 요청 버퍼 변경'),onReviewChange:(update:ReviewUpdate)=>{
  assert(editReview,'읽기로 원 검토 버퍼 변경');updates.push(update);
 },activationBuffer:null,onActivationChange:(update:any)=>effects.push(typeof update==='function'?update(null):update),onActivationRequest:()=>assert.fail('승인 요청 없음'),onAuthenticationLost:()=>auth.push('401')};
 let managedBuffer:ImpactReviewBuffer|null=reviewBuffer,replaceManaged!:(value:ImpactReviewBuffer|null)=>void;
 function ReviewParent({pageProps}:{pageProps:typeof props}){
  const [value,setValue]=ui.React.useState(reviewBuffer);
  managedBuffer=value;replaceManaged=setValue;
  return ui.React.createElement(ui.DesignChangesPage,controls.automatic?{...pageProps,reviewBuffer:value,onReviewChange:(update:ReviewUpdate)=>{
   if(controls.deferOutcome&&posts.length)updates.push(update);else setValue(update);
  }}:pageProps);
 }
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 const button=(label:string)=>{const b=nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===label);assert(b,'버튼 '+label);return b;};
 const render=async(next=props)=>{props=next;await ui.React.act(async()=>root.render(ui.React.createElement(ReviewParent,{pageProps:props})));};
 const click=async(label:string)=>{const b=button(label);assert(!b.disabled);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0}));};
 const settle=async()=>{await ui.React.act(async()=>{await new Promise(r=>setTimeout(r,20));});};
 const wait=async(check:()=>boolean)=>{for(let i=0;i<80&&!check();i++)await settle();assert(check(),container.textContent);};
 const stored=()=>nodes().find(n=>n.getAttribute('aria-label')==='보관 설계 변경')?.textContent??'';
 await render();return{a,b,gate,calls,auth,effects,controls,client,button,click,settle,wait,stored,render,posts,updates,currentControl,props:()=>props,managed:()=>managedBuffer,
  replaceManaged:async(value:ImpactReviewBuffer|null)=>{await ui.React.act(async()=>replaceManaged(value));},
  submitLookup:async()=>{const form=nodes().find(n=>n.tagName==='FORM'&&n.textContent.includes('변경 요청 조회'));assert(form);await ui.React.act(async()=>{form.dispatchEvent({type:'submit'});});},
  acknowledge:async()=>{
   const checkbox=nodes().find(n=>n.tagName==='INPUT'&&n.parentNode?.textContent.includes('대상·미확인 공백을 보존'));
   assert(checkbox,'원 영향 확인 checkbox');
   await ui.React.act(async()=>{checkbox.checked=true;checkbox.dispatchEvent({type:'click',button:0});});
  },
  batch:async(labels:string[])=>{const selected=labels.map(button);assert(selected.every(b=>!b.disabled));await ui.React.act(async()=>{for(const b of selected)b.dispatchEvent({type:'click',button:0});});},
  input:()=>nodes().find(n=>n.tagName==='LABEL'&&n.textContent==='변경 요청 ID')?.childNodes.find(n=>n.tagName==='INPUT')?.value,
  text:()=>container.textContent,close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}

test('커밋 전 저장 요청 A와 검토 결과 B의 명시 조회는 B만 채택하고 늦은 A 200/401을 버린다',async()=>{
 for(const status of [200,401]){const f=await fixture();try{
  await f.batch([openA,openB]);assert.equal(f.calls.length,2,'명시 B 조회가 A flight에 폐기됨');
  await f.wait(()=>f.stored().includes('선택 B 원문'));assert.equal(f.input(),f.b.change.ref.id);assert(!f.stored().includes('선택 A 원문'));
  f.gate.resolve(status===200?Response.json(f.a):Response.json({code:'AUTH_REQUIRED'},{status}));await f.settle();
  assert(f.stored().includes('선택 B 원문'));assert(!f.stored().includes('선택 A 원문'));assert.equal(f.auth.length,0);
  await f.click('설계 변경 적용 준비');await f.wait(()=>f.effects.length===1);assert.deepEqual(f.effects[0].input.changeRef,f.b.change.ref);assert.deepEqual(f.effects[0].input.impactRef,f.b.latestImpactRef);
 }finally{f.gate.resolve(Response.json(f.a));await f.close();}}
});

function impactReceipt(b:ImpactReviewBuffer){
 const command=b.pending!;assert(command);
 const snapshot={...command.payload,sourceKind:'HUMAN_REVIEW',beforeRef:b.change.beforeRef,requiresReview:true,inputs:b.base.inputs,reviewer:{kind:'HUMAN',userId:b.ownerUserId}};
 const ref={id:b.base.ref.id,version:b.base.ref.version+1,contentHash:hash(snapshot)};
 const impact={ref,...snapshot,observedAt:'2026-10-18T00:00:00Z'};
 return Response.json({operationId:crypto.randomUUID(),commandId:command.commandId,projectId,status:'APPLIED',targetId:ref.id,version:ref.version,data:{status:'DESIGN_IMPACT_REVIEWED',ref,impact,activatedAsBaseline:false},serverReceivedAt:impact.observedAt});
}

test('정확 영향 상세 재선택 또는 raw 경로 이탈 뒤 늦은 제어 읽기는 영향 검토를 전송하지 않는다',async t=>{
 for(const mode of ['SELECTION','RAW_ROUTE'] as const)await t.test(mode,async()=>{
  const f=await readyImpactSave(),control=deferred<Response>(),nextPage=deferred<Response>(),route=location.hash;
  try{
   f.controls.access=()=>control.promise;f.controls.read=()=>nextPage.promise;f.controls.automatic=true;await f.render();
   await f.click(impactSave);await f.wait(()=>f.calls.includes(`/api/v1/projects/${projectId}`));
   if(mode==='SELECTION')await f.submitLookup();else location.hash='#/projects/'+projectId+'/documents';
   await ui.React.act(async()=>control.resolve(f.currentControl()));await f.settle();
   assert.equal(f.posts.length,0);assert.equal(f.managed()?.pending,null);assert.equal(f.auth.length,0);
  }finally{location.hash=route;control.resolve(f.currentControl());nextPage.resolve(Response.json(f.a));await f.close();}
 });
});

test('영향 검토 영수증의 늦은 부모 반영은 정확 전송표식만 변경한다',async()=>{
 const f=await readyImpactSave();
 try{
  f.controls.automatic=true;f.controls.deferOutcome=true;await f.render();const original=f.managed();assert(original);
  f.controls.post=async()=>{const staged=f.managed();assert(staged?.pending);return impactReceipt(staged);};
  await f.click(impactSave);await f.wait(()=>f.posts.length===1&&f.updates.length===1);
  const staged=f.managed();assert(staged?.pending);assert.equal(staged.uncertain,true);
  const outcome=f.updates.shift()!;
  await f.replaceManaged(original);
  assert.equal(outcome(original),original);assert.equal(outcome(staged),staged);
  assert(!f.text().includes('영향 검토 저장 영수증 확인'));assert.equal(f.auth.length,0);assert.equal(f.effects.length,0);
 }finally{await f.close();}
});

test('영향 검토 전송 뒤 이탈한 상세의 늦은 영수증·401은 원 미확인 명령만 남긴다',async t=>{
 for(const status of [200,401])await t.test(String(status),async()=>{
  const f=await readyImpactSave(),response=deferred<Response>(),route=location.hash;
  try{
   f.controls.automatic=true;f.controls.post=()=>response.promise;await f.render();
   await f.click(impactSave);await f.wait(()=>f.posts.length===1);
   const staged=f.managed();assert(staged?.pending);assert.equal(staged.uncertain,true);
   location.hash='#/projects/'+projectId+'/documents';
   await ui.React.act(async()=>response.resolve(status===200?impactReceipt(staged):Response.json({code:'AUTH_REQUIRED'},{status})));
   await f.settle();
   assert.equal(f.managed(),staged);assert.equal(f.posts.length,1);
   assert.equal(f.auth.length,0);assert.equal(f.effects.length,0);assert(!f.text().includes('영향 검토 저장 영수증 확인'));
  }finally{location.hash=route;response.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.close();}
 });
});

test('조회 없이 복원된 원 영향 검토 명령은 동일 packet으로 정확한 영수증을 복구한다',async()=>{
 const f=await fixture(true,true);
 try{
  f.controls.automatic=true;await f.render();const original=f.managed();assert(original?.pending);
  f.controls.post=async()=>impactReceipt(original);
  await f.click(impactRetry);await f.wait(()=>f.text().includes('영향 검토 저장 영수증 확인'));
  assert.equal(f.posts.length,1);assert.equal(f.posts[0]!.body,JSON.stringify(original.pending));assert.equal(f.posts[0]!.idem,original.pending.commandId);
  assert.deepEqual(f.calls,[`/api/v1/projects/${projectId}`]);assert.equal(f.managed()?.result?.activatedAsBaseline,false);
  assert.deepEqual(f.managed()?.result?.impactVersions[0]?.coverageGaps,original.input.coverageGaps);assert.equal(f.effects.length,0);
 }finally{await f.close();}
});

const impactSave='사람 영향 검토 저장',impactRetry='같은 영향 검토 명령 결과 확인';
async function readyImpactSave(){
 const f=await fixture(true);
 try{
  await f.click(openA);f.gate.resolve(Response.json(f.a));await f.wait(()=>f.stored().includes('선택 A 원문'));
  await f.acknowledge();assert.equal(f.button(impactSave).disabled,false);
  return f;
 }catch(cause){await f.close();throw cause;}
}

test('영향 검토 저장은 부모 반영 보류·거절·교체·경로 이탈에서 POST하지 않는다',async t=>{
 for(const mode of ['HELD','REJECTED','REPLACED','ROUTE'] as const)await t.test(mode,async()=>{
  const f=await readyImpactSave(),route=location.hash;
  try{
   const original=f.props().reviewBuffer;
   await f.click(impactSave);await f.wait(()=>f.updates.length>0);
   const stage=f.updates.shift()!;
   if(mode==='ROUTE')location.hash='#/projects/'+projectId+'/documents';
   if(mode!=='HELD'){
    const replacement=mode==='REPLACED'?{...original,input:{...original.input,reason:'부모의 새 입력'}}:original;
    const next=mode==='REPLACED'?stage(replacement):replacement;
    await f.render({...f.props(),reviewBuffer:next});
    assert.equal(f.props().reviewBuffer,replacement);
   }
   await f.settle();
   assert.equal(f.posts.length,0,'정확한 부모 반영 전 POST 0');
   if(mode==='HELD'||mode==='ROUTE')assert.equal(stage(original),original,'종료된 반영 요청은 늦게 원 버퍼를 바꾸지 않음');
   assert.equal(f.auth.length,0);assert.equal(f.effects.length,0);
  }finally{location.hash=route;await f.close();}
 });
});

test('영향 검토 저장은 정확한 부모 반영 후 원 명령만 보내고 유실 뒤 같은 packet을 재확인한다',async()=>{
 const f=await readyImpactSave();
 try{
  f.controls.automatic=true;await f.render();
  await f.click(impactSave);await f.wait(()=>f.posts.length===1&&f.text().includes('CONNECTION_LOST'));
  const sent=JSON.parse(f.posts[0]!.body);
  assert.equal(f.posts[0]!.path,`/api/v1/projects/${projectId}/commands`);
  assert.equal(f.posts[0]!.idem,sent.commandId);assert.equal(sent.operation,'reviewChangeImpact');assert.equal(sent.approvalRef,null);
  assert.deepEqual(sent.payload.baseImpactRef,f.a.latestImpactRef);assert.deepEqual(sent.payload.coverageGaps,f.a.impactVersions[0]!.coverageGaps);
  await f.click(impactRetry);await f.wait(()=>f.posts.length===2&&f.text().includes('CONNECTION_LOST'));
  assert.deepEqual(f.posts[1],f.posts[0]);assert.equal(f.managed()?.uncertain,true);
  assert(f.text().includes('보존하는 미확인 공백'));assert(f.stored().includes('선택 A 원문'));
  assert.equal(f.effects.length,0);assert.equal(f.auth.length,0);
 }finally{await f.close();}
});

test('같은 요청·같은 이력 위치의 커밋 전 중복 조회는 GET 한 건과 정상 결과를 유지한다',async()=>{
 const f=await fixture();try{await f.batch([openA,openA]);assert.equal(f.calls.length,1);f.gate.resolve(Response.json(f.a));await f.wait(()=>f.stored().includes('선택 A 원문'));assert(!f.button(openB).disabled);}finally{f.gate.resolve(Response.json(f.a));await f.close();}
});

test('프로젝트·세션·transport 교체 후 늦은 조회 200/401은 원문·인증 효과를 만들지 않는다',async()=>{
 for(const mode of ['PROJECT','SESSION','TRANSPORT'])for(const status of [200,401]){const f=await fixture();try{
  await f.click(openA);const p=f.props();
  if(mode==='PROJECT')await f.render({...p,projectId:'99999999-9999-4999-8999-999999999999'});
  else if(mode==='SESSION')await f.render({...p,session:{...p.session,csrfToken:'D'.repeat(43)}});
  else{f.client.transport=async()=>Response.json(f.b);await f.render();}
  assert.equal(f.stored(),'');f.gate.resolve(status===200?Response.json(f.a):Response.json({code:'AUTH_REQUIRED'},{status}));await f.settle();
  assert.equal(f.stored(),'');assert.equal(f.auth.length,0);assert(!f.text().includes('변경 요청·영향 이력 조회 중'));
 }finally{f.gate.resolve(Response.json(f.a));await f.close();}}
});


test('이전 A의 종결은 대기 중 B 잠금을 풀지 않으며 현재 B 권한 오류만 전달한다',async()=>{
 const f=await fixture(),b=deferred<Response>();try{
  const read=f.controls.read;f.controls.read=path=>path.includes(f.b.change.ref.id)?b.promise:read(path);
  await f.batch([openA,openB]);f.gate.resolve(Response.json(f.a));await f.settle();
  assert.equal(f.input(),f.b.change.ref.id);assert.equal(f.stored(),'');assert(f.button(openB).disabled);assert.equal(f.calls.length,2);
  b.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.wait(()=>f.auth.length===1);
  assert.equal(f.stored(),'');assert(f.text().includes('AUTH_REQUIRED'));assert(!f.button(openB).disabled);
 }finally{b.resolve(Response.json(f.b));f.gate.resolve(Response.json(f.a));await f.close();}
});
