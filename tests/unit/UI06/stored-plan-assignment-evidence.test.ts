import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

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
import {blankPlanTask} from '../../../apps/web/src/features/design-trace/work-plan-api.ts';
import {workPlanReviewCriteria} from '../../../apps/server/modules/traceability/work-plan-reviews.ts';
import {sessionDetailHref} from '../../../apps/web/src/shell/routes.ts';

const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];
class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
before(async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/design-trace/WorkPlanLibrary.tsx',import.meta.url));
 const api=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:plan-assignment-evidence',name:'PlanAssignmentEvidence',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'plan-assignment-evidence-memory-entry',resolveId(id){if(id.endsWith('virtual:plan-assignment-evidence'))return '\0plan-assignment-evidence';},load(id){if(id==='\0plan-assignment-evidence')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{WorkPlanLibrary}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(api)};export{React,createRoot,WorkPlanLibrary,ApiClient};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const [key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return PlanAssignmentEvidence;')();
});
after(()=>{for(const channel of channels){channel.port1.close();channel.port2.close();}for(const[key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});

const id=(n:number)=>'e6a10000-0000-4000-8000-'+String(n).padStart(12,'0');
const pid=id(1),uid=id(2),cid=id(3),time='2026-11-16T00:00:00.000Z',base='/api/v1/projects/'+pid;
const staticRef=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)}),doc=staticRef(4),design=staticRef(5);
const task=(taskCode:string)=>({...blankPlanTask(),taskCode,title:'저장 업무 '+taskCode,purpose:'정해진 범위',ownerRole:'단계책임자',rollback:'기록 유지',recoveryNotes:'확인'});
const plan=(n:number,tasks=[task('FN09'),task('FN10')],relationalProjection:'STORED'|'ISSUES_ONLY'='STORED')=>{
 const snapshot={documentRef:doc,designRef:design,screenReviewRefs:[],tasks,dependencies:[],reason:'보관 원문',issues:[],relationalProjection};
 return {ref:{id:id(n),version:1,contentHash:contentHash(canonicalJson(snapshot))},status:'DRAFT',...snapshot,executionEvidence:'NOT_CONNECTED',observedAt:time};
};
const asg=staticRef(9),draft={...asg,contentHash:'b'.repeat(64)},openEvidence='결과·검수·원문 조회 연결 확인',linkLabel='기존 결과·검수·원문 보호 조회 열기';
function decision(view:ReturnType<typeof plan>,kind:'HISTORICAL'|'NONE'|'BROKEN'|'BROKEN_SCREEN'){
 const criteria=workPlanReviewCriteria,reviewRef={id:id(7),targetRef:view.ref,criteriaVersion:1,outcome:'ACCEPTED'};
 const validation={validForConfirmation:true,issues:[],sourceRefs:[view.documentRef,view.designRef],screenReviewRefs:view.screenReviewRefs};
 const storedValidation=kind==='BROKEN'?{...validation,sourceRefs:[view.documentRef,staticRef(80)]}:kind==='BROKEN_SCREEN'?{...validation,screenReviewRefs:[staticRef(81)]}:validation;
 return {planRef:view.ref,headVersion:2,confirmedVersion:2,criteria,contentReviews:[],confirmation:kind==='NONE'?null:{id:id(8),planRef:view.ref,reviewRefs:[reviewRef],validation:storedValidation,confirmedBy:{kind:'HUMAN',userId:uid},confirmedAt:time},validation,currentConfirmationValid:false,activatedAsBaseline:false,observedAt:time};
}
function delayed<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
async function mount(first=plan(10),history?:ReturnType<typeof plan>){
 const second=plan(11),items=[first,second],originals=[...items,...(history?[history]:[])],calls:{path:string;method:string}[]=[];
 let lost=0,prepared=0,visible=true,decisionKind:'HISTORICAL'|'NONE'|'BROKEN'|'BROKEN_SCREEN'='HISTORICAL';
 let decisionRead:((view:ReturnType<typeof plan>)=>Response|Promise<Response>)|null=null;
 let evidence=(view:ReturnType<typeof plan>,taskCode:string):Response|Promise<Response>=>Response.json({projectId:pid,planRef:view.ref,taskCode,state:'MATCHED',assignmentRef:asg,draftRef:draft,observedAt:time});
 const transport:typeof fetch=async(url,init)=>{
  const path=String(url),method=init?.method??'GET';calls.push({path,method});assert.equal(method,'GET');
  if(path.startsWith(base+'/work-plans?'))return Response.json({items:items.map(i=>({ref:i.ref,status:'DRAFT',title:'계획 '+i.ref.id,documentRef:i.documentRef,designRef:i.designRef,issueCount:0,updatedAt:time,integrity:'NOT_RECHECKED'})),hasMore:false,nextCursor:null,observedAt:time});
  for(const view of originals){
   const original=`${base}/work-plans/${view.ref.id}/versions/${view.ref.version}`;
   if(path===original)return Response.json(view);
   if(path===original+'/decision')return decisionRead?decisionRead(view):Response.json(decision(view,decisionKind));
  }
  if(path.startsWith(base+'/traces/task-evidence?')){
   const q=new URLSearchParams(path.split('?')[1]),view=originals.find(v=>q.get('planId')===v.ref.id&&q.get('planVersion')===String(v.ref.version)&&q.get('planHash')===v.ref.contentHash);assert(view);
   assert.equal(q.get('planVersion'),String(view.ref.version));assert.equal(q.get('planHash'),view.ref.contentHash);
   const taskCode=q.get('taskCode')!;assert.equal(view.tasks.filter(t=>t.taskCode===taskCode).length,1);
   return evidence(view,taskCode);
  }
  assert.fail('계획 조회 범위 밖 보호 GET '+path);
 };
 const client=new ui.ApiClient(transport),props={client,projectId:pid,session:{user:{id:uid},clientId:cid,csrfToken:'c'.repeat(43)},documents:[],canPrepare:false,onPrepared:()=>{prepared++;},onBusy:()=>{},onAuthenticationLost:()=>{lost++;}};
 const container=document.createElement('div'),root=ui.createRoot(container);document.body.appendChild(container);
 const render=async()=>ui.React.act(async()=>root.render(visible?ui.React.createElement(ui.WorkPlanLibrary,props):null));
 const flush=async()=>ui.React.act(async()=>{await new Promise(resolve=>setImmediate(resolve));});
 const until=async(condition:()=>boolean)=>{const end=Date.now()+2000;while(!condition()&&Date.now()<end)await flush();assert(condition(),container.textContent);};
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 const button=(label:string)=>nodes().find(n=>n.tagName==='BUTTON'&&(n.textContent===label||n.getAttribute('aria-label')===label));
 const picker=(historical=false)=>nodes().find(n=>n.tagName==='SELECT'&&n.getAttribute('aria-label')===(historical?'과거 확정 임무를 찾을 업무':'확정 임무를 찾을 업무'));
 const link=()=>nodes().find(n=>n.tagName==='A'&&n.textContent===linkLabel);
 const click=async(label:string)=>{const node=button(label);assert(node&&!node.disabled,label);await ui.React.act(async()=>node.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const choose=async(code:string,historical=false)=>{const select=picker(historical);assert(select);const react=Object.keys(select).find(key=>key.startsWith('__reactProps$'));assert(react);await ui.React.act(async()=>(select as any)[react].onChange({target:{value:code}}));};
 const open=async(view=first)=>{await click('보관 계획 '+view.ref.id+' 열기');await until(()=>container.textContent.includes(view.ref.contentHash));};
 const openDecision=async()=>{await click('계획 검토·확정 상태 조회');await until(()=>container.textContent.includes('현재 확정 조건'));};
 const requests=()=>calls.filter(call=>call.path.includes('/traces/task-evidence?'));
 const historyOpen=async()=>{await click('지정 보관 계획 버전 열기');await until(()=>container.textContent.includes('계획 v1')&&!!button('이 버전 검토·확정 이력 조회'));};
 const historyDecision=async()=>{await click('이 버전 검토·확정 이력 조회');await until(()=>container.textContent.includes('현재 확정 유효하지 않음'));};
 await render();await until(()=>!!button('보관 계획 '+first.ref.id+' 열기'));
 return {props,transport,first,second,container,historyOpen,historyDecision,render,flush,until,open,openDecision,click,choose,picker,link,button,requests,calls,
  lost:()=>lost,prepared:()=>prepared,decision(kind:typeof decisionKind){decisionKind=kind;},decisionRead(fn:typeof decisionRead){decisionRead=fn;},read(fn:typeof evidence){evidence=fn;},hide:async()=>{visible=false;await render();},
  close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}

test('보관된 과거 확정 계획에서 명시 선택한 업무만 읽기 전용 상세로 연결한다',async()=>{
 const f=await mount();
 try{
  await f.open();assert(!f.picker());assert.equal(f.calls.filter(c=>c.path.endsWith('/decision')).length,0);
  await f.openDecision();assert(f.container.textContent.includes('현재 확정 조건: 미충족'));assert(f.picker());assert(!f.button(openEvidence));
  await f.choose('FN09');assert.equal(f.requests().length,0);
  await f.click(openEvidence);await f.until(()=>!!f.link());
  assert.equal(f.requests().length,1);assert(f.requests()[0]!.path.endsWith('taskCode=FN09'));
  assert.equal(f.link()!.getAttribute('href'),sessionDetailHref(pid,draft));assert.equal(f.prepared(),0);
  const prior=f.link()!,react=Object.keys(prior).find(key=>key.startsWith('__reactProps$'));assert(react);
  const oldClick=(prior as any)[react].onClick;
  await f.choose('FN10');assert(!f.link());assert.equal(f.requests().length,1);
  let blocked=false;await ui.React.act(async()=>oldClick({preventDefault(){blocked=true;}}));assert(blocked);
  assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});

test('미확정·잘못된 확정·관계 미보관·중복 업무에는 연결 조회가 생기지 않는다',async()=>{
 for(const kind of ['NONE','BROKEN','ISSUES_ONLY','DUPLICATE'] as const){
  const source=kind==='ISSUES_ONLY'?plan(10,undefined,'ISSUES_ONLY'):kind==='DUPLICATE'?plan(10,[task('FN09'),task('FN09')]):plan(10);
  const f=await mount(source);
  try{
   if(kind==='NONE'||kind==='BROKEN')f.decision(kind);
   await f.open();
   if(kind==='BROKEN'){await f.click('계획 검토·확정 상태 조회');await f.until(()=>f.container.textContent.includes('RESPONSE_INVALID'));}
   else await f.openDecision();
   assert(!f.picker(),kind);assert(!f.link());assert.equal(f.requests().length,0);
  }finally{await f.close();}
 }
});

test('정확 업무의 확정 임무가 없거나 복수·교차 참조면 상세 링크 없이 닫힌다',async()=>{
 const f=await mount();
 try{
  await f.open();await f.openDecision();await f.choose('FN09');
  for(const [state,expected] of [['ASSIGNMENT_NOT_FOUND','배정이 없습니다'],['ASSIGNMENT_AMBIGUOUS','배정이 복수'],['PLAN_REFERENCE_MISMATCH','fullref가 일치하지 않습니다'],['MISMATCHED_REF','TRACE_TASK_EVIDENCE_RESPONSE_INVALID'],['OTHER_TASK','TRACE_TASK_EVIDENCE_RESPONSE_INVALID']] as const){
   f.read((view,taskCode)=>Response.json({projectId:pid,planRef:{...view.ref,contentHash:state==='MISMATCHED_REF'?'d'.repeat(64):view.ref.contentHash},
    taskCode:state==='OTHER_TASK'?'FN10':taskCode,state:['MISMATCHED_REF','OTHER_TASK'].includes(state)?'MATCHED':state,assignmentRef:['MISMATCHED_REF','OTHER_TASK'].includes(state)?asg:null,draftRef:['MISMATCHED_REF','OTHER_TASK'].includes(state)?draft:null,observedAt:time}));
   const before=f.requests().length;await f.click(before?'같은 확정 배정 다시 확인':openEvidence);await f.until(()=>f.container.textContent.includes(expected));
   assert(!f.link());assert.equal(f.requests().length,before+1);
  }
 }finally{await f.close();}
});

test('계획·업무·목록 발생·인증·전송 교체 및 닫기에서는 지연 응답과 옛 callback을 폐기한다',async()=>{
 for(const mode of ['TASK','PLAN','LIST','CSRF','TRANSPORT','CLOSE']){
  const f=await mount(),held=delayed<Response>();
  try{
   await f.open();await f.openDecision();await f.choose('FN09');
   f.read(()=>held.promise);await f.click(openEvidence);
   if(mode==='TASK')await f.choose('FN10');
   if(mode==='PLAN'){await f.open(f.second);await f.openDecision();}
   if(mode==='LIST'){
    await f.click('작업계획 목록 새로고침');await f.until(()=>!!f.picker());
    assert(f.container.textContent.includes('별도 계획 확정 이력 있음'));assert(!f.button(openEvidence));
   }
   if(mode==='CSRF'){f.props.session={...f.props.session,csrfToken:'d'.repeat(43)};await f.render();}
   if(mode==='TRANSPORT')f.props.client.transport=f.transport.bind(null);
   if(mode==='CLOSE')await f.hide();
   held.resolve(mode==='TASK'?Response.json({projectId:pid,planRef:f.first.ref,taskCode:'FN09',state:'MATCHED',assignmentRef:asg,draftRef:draft,observedAt:time}):Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.flush();
   assert.equal(f.lost(),0,mode);assert(!f.link(),mode);assert.equal(f.requests().length,1,mode);
  }finally{held.resolve(Response.json({}));await f.close();}
 }
});


test('동일 업무 코드의 과거 v1은 당시 확정 fullref로만 기존 상세 근거를 연다',{timeout:15000},async()=>{
 const old=plan(10),current=plan(10,[{...task('FN09'),title:'현재 버전의 다른 업무'}]);current.ref.version=2;current.documentRef=staticRef(60);current.designRef=staticRef(61);const {ref:_ref,status:_status,executionEvidence:_execution,observedAt:_at,...snapshot}=current;current.ref.contentHash=contentHash(canonicalJson(snapshot));const f=await mount(current,old);
 try{
  f.read((view,taskCode)=>Response.json({projectId:pid,planRef:view.ref,taskCode,state:'MATCHED',assignmentRef:view.ref.version===1?asg:staticRef(90),draftRef:view.ref.version===1?draft:{...staticRef(90),contentHash:'b'.repeat(64)},observedAt:time}));
  await f.open();await f.openDecision();await f.choose('FN09');await f.click(openEvidence);await f.until(()=>!!f.link());assert.equal(f.link()!.getAttribute('href'),sessionDetailHref(pid,{...staticRef(90),contentHash:'b'.repeat(64)}));assert.equal(new URLSearchParams(f.requests()[0]!.path.split('?')[1]).get('planVersion'),'2');await f.choose('');assert(!f.link());await f.historyOpen();assert(!f.picker(true));assert.equal(f.requests().length,1);
  await f.historyDecision();assert(f.picker(true),'당시 확인한 확정 업무의 명시 선택');assert(!f.button(openEvidence));
  await f.choose('FN09',true);assert.equal(f.requests().length,1);await f.click(openEvidence);await f.until(()=>!!f.link());
  assert.equal(f.requests().length,2);const q=new URLSearchParams(f.requests()[1]!.path.split('?')[1]);assert.equal(q.get('planVersion'),'1');assert.equal(q.get('planHash'),old.ref.contentHash);assert.equal(q.get('taskCode'),'FN09');assert.equal(f.link()!.getAttribute('href'),sessionDetailHref(pid,draft));assert(f.container.textContent.includes(asg.id));assert(f.container.textContent.includes('현재 확정 조건: 미충족'));assert.equal(f.prepared(),0);assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});


for(const kind of ['NONE','BROKEN','BROKEN_SCREEN','ISSUES_ONLY','DUPLICATE','INVALID_TASK'] as const)test('과거 업무 근거의 '+kind+'는 보호 증거 조회0',{timeout:15000},async()=>{
 const old=kind==='ISSUES_ONLY'?plan(10,undefined,'ISSUES_ONLY'):kind==='DUPLICATE'?plan(10,[task('FN09'),task('FN09')]):plan(10),current=plan(10);current.ref.version=2;const f=await mount(current,old);
 try{if(kind==='NONE'||kind==='BROKEN'||kind==='BROKEN_SCREEN')f.decision(kind);await f.open();await f.historyOpen();
  if(kind==='BROKEN'||kind==='BROKEN_SCREEN'){await f.click('이 버전 검토·확정 이력 조회');await f.until(()=>f.container.textContent.includes('RESPONSE_INVALID'));}else await f.historyDecision();
  if(kind==='INVALID_TASK'){assert(f.picker(true));await f.choose('OTHER_TASK',true);assert(!f.button(openEvidence));}else assert(!f.picker(true),kind);
  assert(!f.link());assert.equal(f.requests().length,0);assert.equal(f.prepared(),0);assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});

test('과거 업무 근거는 교차 계획·업무·프로젝트 응답을 상세 링크로 쓰지 않는다',{timeout:15000},async()=>{
 const old=plan(10),current=plan(10);current.ref.version=2;const f=await mount(current,old);
 try{await f.open();await f.historyOpen();await f.historyDecision();await f.choose('FN09',true);
  for(const mismatch of ['PLAN','TASK','PROJECT']){f.read((view,taskCode)=>Response.json({projectId:mismatch==='PROJECT'?id(90):pid,planRef:mismatch==='PLAN'?current.ref:view.ref,taskCode:mismatch==='TASK'?'FN10':taskCode,state:'MATCHED',assignmentRef:asg,draftRef:draft,observedAt:time}));
   const count=f.requests().length;await f.click(count?'같은 확정 배정 다시 확인':openEvidence);await f.until(()=>f.container.textContent.includes('TRACE_TASK_EVIDENCE_RESPONSE_INVALID'));assert(!f.link());assert.equal(f.requests().length,count+1);
  }
 }finally{await f.close();}
});

function historyRoute(t:import('node:test').TestContext){const keys=['location','addEventListener','removeEventListener'],saved=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)])),listeners=new Set<Function>(),a='#/projects/'+pid+'/documents',b='#/projects/'+pid+'/workspace',location={hash:a};Object.defineProperty(globalThis,'location',{configurable:true,value:location});Object.defineProperty(globalThis,'addEventListener',{configurable:true,value:(type:string,fn:Function)=>{if(type==='hashchange')listeners.add(fn);}});Object.defineProperty(globalThis,'removeEventListener',{configurable:true,value:(type:string,fn:Function)=>{if(type==='hashchange')listeners.delete(fn);}});t.after(()=>{try{assert.equal(listeners.size,0);}finally{for(const[key,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}});return{location,a,b,aba(){location.hash=b;for(const fn of listeners)fn({oldURL:'https://anvil.invalid/'+a,newURL:'https://anvil.invalid/'+b});location.hash=a;for(const fn of listeners)fn({oldURL:'https://anvil.invalid/'+b,newURL:'https://anvil.invalid/'+a});}};}
for(const mode of ['TASK','CLOSE','VERSION_CLOSE','CSRF','TRANSPORT','RAW_ROUTE','ROUTE_ABA'] as const)for(const status of [200,401])test('과거 업무 근거 '+mode+' 뒤 late'+status+'는 링크·인증효과0',{timeout:15000},async t=>{
 const route=historyRoute(t),old=plan(10),current=plan(10);current.ref.version=2;const f=await mount(current,old),held=delayed<Response>();
 try{await f.open();await f.historyOpen();await f.historyDecision();await f.choose('FN09',true);const oldHandler=(()=>{const n=f.button(openEvidence)!;const key=Object.keys(n).find(k=>k.startsWith('__reactProps$'));assert(key);return(n as any)[key].onClick;})();f.read(()=>held.promise);await f.click(openEvidence);assert.equal(f.requests().length,1);
  if(mode==='TASK')await f.choose('FN10',true);if(mode==='CLOSE')await f.click('이 버전 검토·확정 이력 닫기');if(mode==='VERSION_CLOSE')await f.click('과거 계획 원문 닫기');if(mode==='CSRF'){f.props.session={...f.props.session,csrfToken:'d'.repeat(43)};await f.render();}if(mode==='TRANSPORT')f.props.client.transport=f.transport.bind(null);if(mode==='RAW_ROUTE')route.location.hash=route.b;if(mode==='ROUTE_ABA')await ui.React.act(async()=>route.aba());
  held.resolve(Response.json(status===200?{projectId:pid,planRef:old.ref,taskCode:'FN09',state:'MATCHED',assignmentRef:asg,draftRef:draft,observedAt:time}:{code:'AUTH_REQUIRED'},{status}));await f.flush();assert(!f.link());assert.equal(f.lost(),0);await ui.React.act(async()=>oldHandler());await f.flush();assert.equal(f.requests().length,1,'폐기한 선택의 옛 재조회0');assert.equal(f.prepared(),0);assert(f.calls.every(c=>c.method==='GET'));
 }finally{held.resolve(Response.json({}));await f.close();}
});

for(const status of [401,403])test('과거 업무 근거의 현재 '+status+'는 기존 보호 오류 의미를 유지한다',{timeout:15000},async()=>{
 const old=plan(10),current=plan(10);current.ref.version=2;const f=await mount(current,old);
 try{await f.open();await f.historyOpen();await f.historyDecision();await f.choose('FN09',true);f.read(()=>Response.json({code:status===401?'AUTH_REQUIRED':'PROJECT_OPERATION_DENIED'},{status}));await f.click(openEvidence);await f.until(()=>f.container.textContent.includes(status===401?'AUTH_REQUIRED':'PROJECT_OPERATION_DENIED'));assert.equal(f.lost(),status===401?1:0);assert(!f.link());assert.equal(f.requests().length,1);assert(f.calls.every(c=>c.method==='GET'));}finally{await f.close();}
});

for(const aba of [false,true])for(const status of [200,401])test('과거 확정 선행 GET '+(aba?'전달 ABA':'raw 이탈')+' late'+status+' 폐기 뒤 같은 mount에서 명시 복구한다',{timeout:15000},async t=>{
 const route=historyRoute(t),old=plan(10),current=plan(10);current.ref.version=2;const f=await mount(current,old),held=delayed<Response>();
 try{await f.open();await f.historyOpen();f.decisionRead(()=>held.promise);await f.click('이 버전 검토·확정 이력 조회');assert.equal(f.calls.filter(c=>c.path.endsWith('/decision')).length,1);
  const button=f.button('이 버전 검토·확정 이력 조회')!,key=Object.keys(button).find(k=>k.startsWith('__reactProps$'));assert(key);const oldClick=(button as any)[key].onClick;
  await ui.React.act(async()=>{if(aba)route.aba();else route.location.hash=route.b;held.resolve(Response.json(status===200?decision(old,'HISTORICAL'):{code:'AUTH_REQUIRED'},{status}));});await f.flush();assert(!f.picker(true));assert(!f.link());assert.equal(f.lost(),0);assert.equal(f.requests().length,0);
  await ui.React.act(async()=>oldClick());assert.equal(f.calls.filter(c=>c.path.endsWith('/decision')).length,1,'폐기된 조회 handler의 추가GET0');
  route.location.hash=route.a;f.decisionRead(null);if(f.button('이 버전 검토·확정 이력 닫기'))await f.click('이 버전 검토·확정 이력 닫기');await f.historyDecision();assert(f.picker(true));assert.equal(f.calls.filter(c=>c.path.endsWith('/decision')).length,2);assert.equal(f.lost(),0);assert.equal(f.requests().length,0);await f.choose('FN09',true);await f.click(openEvidence);await f.until(()=>!!f.link());assert.equal(f.link()!.getAttribute('href'),sessionDetailHref(pid,draft));
 }finally{held.resolve(Response.json({}));await f.close();}
});
