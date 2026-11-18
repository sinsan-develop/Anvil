import assert from'node:assert/strict';import{test,before,after}from'node:test';
import{ApiClient,ApiError}from'../../../apps/web/src/api/client.ts';
import{workPlanReviewCriteria}from'../../../apps/server/modules/traceability/work-plan-reviews.ts';
const pid='51c0439f-791e-4bb5-8471-70938d6afaf1',uid='32b5f276-13e6-4d8a-b93f-27a15d21c788',ref={id:'a6f30000-0000-4000-8000-000000000090',version:1,contentHash:'1'.repeat(64)},at='2026-10-16T05:00:00Z',session={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)};
function target(){return{planRef:ref,headVersion:1,confirmedVersion:null,criteria:workPlanReviewCriteria,contentReviews:[],confirmation:null,validation:{validForConfirmation:true,issues:[],sourceRefs:[ref,ref],screenReviewRefs:[]},currentConfirmationValid:false,activatedAsBaseline:false,observedAt:at};}
test('계획 검토는 다른 주체·중단·전송 후 판단 변경을 차단하고 단절 뒤 같은 명령을 유지한다',async()=>{
 const m=await import('../../../apps/web/src/features/design-trace/work-plan-decision-api.ts').catch(()=>null);assert.ok(m,'계획 결정 Web 연결 필요');
 const b=m.newWorkPlanDecision(pid,target()as any,session as any,1,'REVIEW');b.items=b.items.map(i=>({...i,outcome:'ACCEPTED',reason:'합성 원문·업무 대조'}));b.outcome='ACCEPTED';b.reason='실제 인수 아닌 합성 검토';b.pending=m.prepareWorkPlanDecision(b,session as any);const captured=structuredClone(b.pending),calls:any[]=[];let fail=true;
 const client=new ApiClient(async(input,init)=>{const c=JSON.parse(String(init?.body));calls.push(c);if(fail){fail=false;throw Error('lost');}return Response.json({operationId:uid,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:ref.id,version:1,serverReceivedAt:at,data:{ref,status:'REVIEW_RECORDED',reviewRef:{id:uid,targetRef:ref,criteriaVersion:1,outcome:'ACCEPTED'}}});});
 await assert.rejects(m.sendWorkPlanDecision(client,b,{...session,user:{id:pid}}as any,()=>true));await assert.rejects(m.sendWorkPlanDecision(client,b,session as any,()=>false));assert.equal(calls.length,0);
 await assert.rejects(m.sendWorkPlanDecision(client,b,session as any,()=>true),(e:unknown)=>e instanceof ApiError&&e.code==='CONNECTION_LOST');assert.deepEqual(b.pending,captured);
 await assert.rejects(m.sendWorkPlanDecision(client,{...b,reason:'전송 뒤 변경'},session as any,()=>true));assert.equal(calls.length,1);assert.equal((await m.sendWorkPlanDecision(client,b,session as any,()=>true)).kind,'REVIEW');assert.deepEqual(calls[0],calls[1]);
});
test('계획 별도 확정은 최신 적합·현재 준비상태와 명시 확인을 요구하고 위조된 실행 활성화를 거절한다',async()=>{
 const m=await import('../../../apps/web/src/features/design-trace/work-plan-decision-api.ts').catch(()=>null);assert.ok(m,'계획 별도 확정 Web 연결 필요');
 const t=target(),rr={id:uid,targetRef:ref,criteriaVersion:1,outcome:'ACCEPTED'},review={ref:rr,criteria:workPlanReviewCriteria,items:workPlanReviewCriteria.items.map(i=>({criterionId:i.criterionId,outcome:'ACCEPTED',reason:'합성 판단',evidenceRefs:[]})),reviewer:{kind:'HUMAN',userId:uid,sameAsTargetRecorder:true},sourceKind:'HUMAN_REVIEW',reason:'합성 검토',reviewedAt:at,serverSequence:1};(t.contentReviews as any[]).push(review);
 const b=m.newWorkPlanDecision(pid,t as any,session as any,1,'CONFIRM');assert.throws(()=>m.prepareWorkPlanDecision(b,session as any));b.acknowledged=true;
 assert.throws(()=>m.prepareWorkPlanDecision({...b,target:{...b.target,validation:{...b.target.validation,validForConfirmation:false,issues:[{code:'NOT_READY',location:'plan',message:'미확인'}]}}},session as any));b.pending=m.prepareWorkPlanDecision(b,session as any);let forged=true;
 const client=new ApiClient(async()=>Response.json({operationId:uid,commandId:b.pending!.commandId,projectId:pid,status:'APPLIED',targetId:ref.id,version:1,serverReceivedAt:at,data:{ref,status:'CONFIRMED',confirmationId:uid,reviewRefs:[rr],validation:t.validation,activatedAsBaseline:forged}}));await assert.rejects(m.sendWorkPlanDecision(client,b,session as any,()=>true));forged=false;assert.equal((await m.sendWorkPlanDecision(client,b,session as any,()=>true)).kind,'CONFIRM');
});
test('계획 검토·확정 조회는 GET만 사용하고 다른 원문 참조·가짜 유효 확정을 채택하지 않는다',async()=>{
 const m=await import('../../../apps/web/src/features/design-trace/work-plan-decision-api.ts'),v=target(),calls:any[]=[];let value:any=v;const client=new ApiClient(async(input,init)=>{calls.push([input,init?.method]);return Response.json(value);}),plan:any={ref,documentRef:ref,designRef:ref,screenReviewRefs:[]};assert.equal((await m.readWorkPlanDecision(client,pid,plan)).confirmation,null);assert.equal(calls[0][1],'GET');value={...v,currentConfirmationValid:true};await assert.rejects(m.readWorkPlanDecision(client,pid,plan));value={...v,validation:{...v.validation,sourceRefs:[{...ref,version:2},ref]}};await assert.rejects(m.readWorkPlanDecision(client,pid,plan));assert.equal(calls.every(c=>c[1]==='GET'),true);
});

import {build} from 'vite';
import {fileURLToPath} from 'node:url';
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
const globals=new Map<string,PropertyDescriptor|undefined>();let ui:any;
const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
before(async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/design-trace/WorkPlanDecisionEditor.tsx',import.meta.url));
 const result:any=await build({configFile:false,envFile:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:decision-context',name:'DecisionContextTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'decision-memory',resolveId(id){if(id.endsWith('virtual:decision-context'))return '\0decision-context';},load(id){if(id==='\0decision-context')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{WorkPlanDecisionEditor}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};export{React,createRoot,WorkPlanDecisionEditor,ApiClient};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const [key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){globals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return DecisionContextTest;')();
});
after(()=>{for(const channel of channels){channel.port1.close();channel.port2.close();}for(const[key,value]of globals)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{resolve,promise};}
async function editorFixture(kind:'REVIEW'|'CONFIRM'){
 const api=await import('../../../apps/web/src/features/design-trace/work-plan-decision-api.ts');
 const t:any=target();if(kind==='CONFIRM')t.contentReviews=[{ref:{id:uid,targetRef:ref,criteriaVersion:1,outcome:'ACCEPTED'},criteria:workPlanReviewCriteria,items:workPlanReviewCriteria.items.map(i=>({criterionId:i.criterionId,outcome:'ACCEPTED',reason:'합성 판단',evidenceRefs:[]})),reviewer:{kind:'HUMAN',userId:uid,sameAsTargetRecorder:true},sourceKind:'HUMAN_REVIEW',reason:'합성 검토',reviewedAt:at,serverSequence:1}];
 const decision=api.newWorkPlanDecision(pid,t,session as any,1,kind);decision.items=decision.items.map(i=>({...i,outcome:'ACCEPTED',reason:'합성 검토'}));decision.outcome='ACCEPTED';decision.reason='합성 검토 이유';decision.acknowledged=true;
 let delayed=false;const updates:any[]=[];
 let buffer:any={projectId:pid,ownerUserId:uid,controlGeneration:1,dirty:true,workPlanState:{bindingId:'decision-context',decision}},currentSession=session,lost=0;
 const writes:{body:string;csrf:string|null}[]=[],gates:ReturnType<typeof deferred<Response>>[]=[];
 const client=new ui.ApiClient(async(_input:unknown,init:RequestInit)=>{writes.push({body:String(init.body),csrf:new Headers(init.headers).get('x-anvil-csrf')});const gate=deferred<Response>();gates.push(gate);return gate.promise;});
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 const render=()=>root.render(buffer?ui.React.createElement(ui.WorkPlanDecisionEditor,{client,session:currentSession,buffer,onChange:(change:any)=>{if(delayed){updates.push(change);return;}buffer=typeof change==='function'?change(buffer):change;render();},onAuthenticationLost(){lost++;}}):null);
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 const settle=()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});
 const wait=async(check:()=>boolean)=>{for(let i=0;i<80&&!check();i++)await settle();assert(check(),container.textContent);};
 const click=async(twice=false)=>{const button=nodes().find(n=>n.tagName==='BUTTON'&&/계획 (내용검토 저장|별도 확정|검토 명령 결과 확인|확정 명령 결과 확인)/.test(n.textContent));assert(button&&!button.disabled,container.textContent);await ui.React.act(async()=>{button.dispatchEvent({type:'click',button:0});if(twice)button.dispatchEvent({type:'click',button:0});});};
 const reply=async(index:number,status:number)=>{const c=JSON.parse(writes[index]!.body);const data=kind==='REVIEW'?{ref,status:'REVIEW_RECORDED',reviewRef:{id:uid,targetRef:ref,criteriaVersion:1,outcome:'ACCEPTED'}}:{ref,status:'CONFIRMED',confirmationId:uid,reviewRefs:c.payload.reviewRefs,validation:t.validation,activatedAsBaseline:false};await ui.React.act(async()=>gates[index]!.resolve(status===200?Response.json({operationId:uid,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:ref.id,version:1,serverReceivedAt:at,data}):Response.json({code:status===401?'AUTH_REQUIRED':'SERVICE_UNAVAILABLE'},{status})));for(let i=0;i<3;i++)await settle();};
 await ui.React.act(async()=>render());
 return{writes,click,reply,wait,settle,deferUpdates:()=>{delayed=true;},flush:async()=>{await ui.React.act(async()=>{delayed=false;for(const change of updates.splice(0))buffer=typeof change==='function'?change(buffer):change;render();});},saveDisabled:()=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent.includes('명령 결과 확인'))?.disabled,buffer:()=>buffer,lost:()=>lost,refresh:async()=>{currentSession={...session,csrfToken:'D'.repeat(43)};await ui.React.act(async()=>render());},replace:async()=>{buffer={...buffer,workPlanState:{...buffer.workPlanState,decision:{...decision,reason:'새 판단 입력'}}};await ui.React.act(async()=>render());},hide:async()=>{await ui.React.act(async()=>root.render(null));},show:async()=>{await ui.React.act(async()=>render());},close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
test('계획 판단 화면 RAM: 현재 정상 저장·401·UNKNOWN의 같은 명령 재확인을 보존한다',async()=>{
 for(const kind of ['REVIEW','CONFIRM']as const)for(const status of [200,401,503]){const f=await editorFixture(kind);try{await f.click(true);await f.wait(()=>f.writes.length===1);const pending=structuredClone(f.buffer().workPlanState.decision.pending);await f.reply(0,status);assert.equal(f.lost(),status===401?1:0);if(status===200)assert.equal(f.buffer().workPlanState.decision.savedId,uid);else{assert.deepEqual(f.buffer().workPlanState.decision.pending,pending);if(status===503){assert.equal(f.buffer().workPlanState.decision.uncertain,true);await f.click();await f.wait(()=>f.writes.length===2);assert.equal(f.writes[1]!.body,f.writes[0]!.body);await f.reply(1,200);assert.equal(f.buffer().workPlanState.decision.savedId,uid);}}}finally{await f.close();}}
});
test('계획 판단 화면 RAM: 정상 세션 갱신 뒤 이전 200·401은 새 화면 효과가 없다',async()=>{
 for(const kind of ['REVIEW','CONFIRM']as const)for(const status of [200,401]){const f=await editorFixture(kind);try{await f.click();await f.wait(()=>f.writes.length===1);const original=f.buffer();await f.refresh();await f.click();await f.wait(()=>f.writes.length===2);assert.equal(f.writes[1]!.body,f.writes[0]!.body);assert.equal(f.writes[1]!.csrf,'D'.repeat(43));await f.reply(0,status);assert.equal(f.lost(),0);assert.equal(f.buffer(),original);assert.equal(f.saveDisabled(),true,'이전 finally는 현재 전송 잠금을 풀지 않는다');await f.reply(1,200);assert.equal(f.buffer().workPlanState.decision.savedId,uid);}finally{await f.close();}}
});
test('계획 판단 화면 RAM: 화면 이탈·판단 교체 뒤 이전 실패는 새 입력을 바꾸지 않는다',async()=>{
 for(const change of ['HIDE','REPLACE']){const f=await editorFixture('REVIEW');try{await f.click();await f.wait(()=>f.writes.length===1);if(change==='HIDE'){await f.hide();await f.show();}else await f.replace();const current=f.buffer();await f.reply(0,401);assert.equal(f.lost(),0);assert.equal(f.buffer(),current);}finally{await f.close();}}
});

test('계획 판단 화면 RAM: finally 뒤 부모 updater 평가도 원 정상·UNKNOWN 결과를 보존한다',async()=>{
 for(const status of [200,503]){const f=await editorFixture('REVIEW');try{
  await f.click();await f.wait(()=>f.writes.length===1);const before=f.buffer();f.deferUpdates();await f.reply(0,status);assert.equal(f.buffer(),before);await f.flush();
  if(status===200)assert.equal(f.buffer().workPlanState.decision.savedId,uid);
  else{assert.equal(f.buffer().workPlanState.decision.uncertain,true);await f.click();await f.wait(()=>f.writes.length===2);assert.equal(f.writes[0]!.body,f.writes[1]!.body);await f.reply(1,200);assert.equal(f.buffer().workPlanState.decision.savedId,uid);}
 }finally{await f.close();}}
});
