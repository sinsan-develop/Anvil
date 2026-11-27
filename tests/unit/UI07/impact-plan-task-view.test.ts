import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {workspaceTaskHref,parseRoute} from '../../../apps/web/src/shell/routes.ts';
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,build} from 'vite';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {designChangeFixture,projectId} from './design-change-fixture.ts';
const compiler=await createServer({configFile:fileURLToPath(new URL('../../../apps/web/vite.config.ts',import.meta.url)),server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true},logLevel:'silent'});
const module=await compiler.ssrLoadModule('/src/features/design-change/ImpactPlanTaskOriginal.tsx');
await compiler.close();
test('계획 영향은 명시 열기만 제공하고 조회 전 원문/API·쓰기·실행을 만들지 않는다',()=>{const page=designChangeFixture();let calls=0;const props={client:new ApiClient(async()=>{calls++;throw Error('UNEXPECTED_CALL');}),projectId,session:{user:{id:projectId},clientId:projectId},changeRef:page.change.ref,impactRef:page.latestImpactRef,beforeVersion:null,target:page.impactVersions[0]!.items[0]!.targetRef,onAuthenticationLost:()=>{}};const html=renderToStaticMarkup(createElement(module.ImpactPlanTaskOriginal,props));assert.ok(html.includes('영향 업무 FN01 고정 원문 보기'));assert.equal(html.includes('aria-label="영향 계획 업무 고정 원문"'),false);assert.equal(calls,0);});
test('다른 영향 종류에 계획 원문 버튼을 붙이거나 임의 계획을 제안하지 않는다',()=>{const page=designChangeFixture(),html=renderToStaticMarkup(createElement(module.ImpactPlanTaskOriginal,{client:new ApiClient(async()=>{throw Error('UNEXPECTED_CALL');}),projectId,session:{user:{id:projectId},clientId:projectId},changeRef:page.change.ref,impactRef:page.latestImpactRef,beforeVersion:null,target:{...page.impactVersions[0]!.items[0]!.targetRef,kind:'EXECUTION'},onAuthenticationLost:()=>{}}));assert.equal(html,'');});

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
 const app=fileURLToPath(new URL('../../../apps/web/src/features/design-change/ImpactPlanTaskOriginal.tsx',import.meta.url));
 const api=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:impact-plan-task-link',name:'ImpactTaskLinkApp',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'impact-plan-task-link-memory',resolveId(id){if(id.endsWith('virtual:impact-plan-task-link'))return '\0impact-plan-task-link';},load(id){if(id==='\0impact-plan-task-link')return `export * as React from 'react';export {createRoot} from 'react-dom/client';export {ImpactPlanTaskOriginal as Component} from ${JSON.stringify(app)};export {ApiClient} from ${JSON.stringify(api)};`;}}]});
 const Native=globalThis.MessageChannel;class Channel extends Native{constructor(){super();channels.push(this);}}
 const add=(k:string,f:Function)=>{let set=events.get(k);if(!set)events.set(k,set=new Set());set.add(f);},remove=(k:string,f:Function)=>events.get(k)?.delete(f),window={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener:add,removeEventListener:remove,getComputedStyle:()=>({}),location};document.defaultView=window;
 for(const[k,v]of Object.entries({window,document,location,addEventListener:add,removeEventListener:remove,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:Channel,confirm:()=>true})){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((v:any)=>v.type==='chunk').code+';return ImpactTaskLinkApp;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});

function planFixture(count=1,alter:(kind:string,value:any)=>any=(_kind,value)=>value,projection='STORED'){
 const page:any=designChangeFixture(),rawRef={id:projectId,version:1,contentHash:'a'.repeat(64)},task={taskCode:'FN01',type:'FUNCTION',title:'고정 업무 원문',purpose:'연결 범위 확인',designRefs:[],screenRefs:[],ownerRole:'개발 담당',inputs:['입력'],outputs:['산출물'],included:['처리'],excluded:['운영'],allowedFileRefs:['apps/server/example.ts'],startPrerequisites:['P01'],acceptancePrerequisites:['IX01'],steps:['작성'],testCases:[{id:'TC01',kind:'NORMAL',steps:['저장'],expected:'재조회',environment:'개발'}],acceptanceCriteria:['저장 확인'],evidenceRequirements:['원 결과'],rollback:'이전 commit',recoveryNotes:'중단 위치'};
 const snapshot={documentRef:rawRef,designRef:rawRef,screenReviewRefs:[],tasks:Array.from({length:count},()=>structuredClone(task)),dependencies:[],reason:'영향 검토 근거',issues:[],relationalProjection:projection},planRef={id:page.impactVersions[0].items[0].targetRef.id,version:1,contentHash:contentHash(canonicalJson(snapshot))};
 const target={kind:'PLAN_TASK',id:planRef.id,versionRef:planRef,localCode:'FN01'};
 for(const impact of [...page.impactVersions].reverse()){impact.items[0].targetRef=target;impact.inputs.planRefs=[planRef];if(impact.sourceKind==='HUMAN_REVIEW')impact.baseImpactRef=page.impactVersions[1].ref;const {ref,observedAt,...snapshot}=impact;impact.ref={...ref,contentHash:contentHash(canonicalJson(snapshot))};}page.latestImpactRef=page.impactVersions[0].ref;
 const plan={ref:planRef,status:'DRAFT',...snapshot,executionEvidence:'NOT_CONNECTED',observedAt:page.observedAt},calls:string[]=[];
 const client=new ApiClient(async(url,init)=>{const path=String(url);calls.push(path);assert.equal(init?.method,'GET');if(path.includes('/design-changes/'))return Response.json(alter('change',page));if(path.includes('/work-plans/'))return Response.json(alter('plan',plan));throw Error('UNEXPECTED_CALL');});
 return{client,calls,page,selection:{projectId,userId:projectId,clientId:projectId,changeRef:structuredClone(page.change.ref),impactRef:structuredClone(page.impactVersions[0].ref),beforeVersion:null,target:structuredClone(target)}};
}

async function mountTask(projection='STORED',status=200,count=1){
 const f=planFixture(count,(_kind,value)=>value,projection);
 location.hash='#/projects/'+projectId+'/changes';
 let hold:{promise:Promise<Response>;kind:string}|null=null,current=true,lost=0;
 const calls:{path:string;method:string}[]=[],transport:typeof fetch=async(url,init)=>{
  calls.push({path:String(url),method:init?.method??'GET'});assert.equal(init?.method,'GET','모든 원문 검산은 GET만');
  if(hold&&String(url).includes(hold.kind))return hold.promise;
  if(status!==200)return Response.json({code:status===401?'AUTH_REQUIRED':'ACCESS_DENIED'},{status});
  return f.client.transport(url,init);
 };
 const client=new ui.ApiClient(transport),container=document.createElement('main');document.body.appendChild(container);const root=ui.createRoot(container);
 const session={user:{id:projectId},clientId:projectId,csrfToken:'a'.repeat(43)},props:any={client,projectId,session,changeRef:f.selection.changeRef,impactRef:f.selection.impactRef,beforeVersion:null,target:f.selection.target,isCurrent:()=>current,onAuthenticationLost:()=>lost++};
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))],button=(text:string)=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===text),link=()=>nodes().find(n=>n.tagName==='A');
 const render=async(value=props)=>{await ui.React.act(async()=>root.render(ui.React.createElement(ui.Component,value)));};
 const settle=()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});
 const wait=async(check:()=>boolean)=>{for(let i=0;i<150&&!check();i++)await settle();assert(check(),container.textContent);};
 const click=async(text:string)=>{const node=button(text);assert(node,text);await ui.React.act(async()=>node.dispatchEvent({type:'click',button:0}));await settle();};
 await render();return{f,client,calls,container,props,nodes,button,link,render,settle,wait,click,lost:()=>lost,hold:(value:Promise<Response>|null,kind='/design-changes/')=>hold=value?{promise:value,kind}:null,revoke:()=>current=false,close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
test('보호 확인한 STORED 영향 업무는 exact plan fullref/taskCode의 기존 UI04 링크만 명시 제공한다',{timeout:15000},async()=>{
 const f=await mountTask();try{
  assert.equal(f.calls.length,0);assert.equal(f.link(),undefined);await f.click('영향 업무 고정 원문 보기');await f.wait(()=>f.container.textContent.includes('선택 업무 상세: FN01'));
  const link=f.link();assert(link,'검산한 고정 업무의 준비 경로 없음');
  assert.equal(link.getAttribute('href'),workspaceTaskHref(projectId,f.f.selection.target.versionRef,'FN01'));
  const route=parseRoute(link.getAttribute('href')!);assert.equal(route.projectId,projectId);assert.deepEqual(route.planTask,{planRef:f.f.selection.target.versionRef,taskCode:'FN01'});
  const before=f.calls.length;assert.equal(link.dispatchEvent({type:'click',button:0}),true);assert.equal(f.calls.length,before,'링크 클릭이 새 GET/적용/POST를 호출하지 않음');assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});

test('legacy 영향 계획 원문은 읽되 STORED·유일 업무 또는 현재 접근 검산 없이는 링크를 만들지 않는다',{timeout:15000},async()=>{
 for(const [projection,status,count] of [['ISSUES_ONLY',200,1],['STORED',200,0],['STORED',200,2],['STORED',403,1],['STORED',401,1]] as const){
  const f=await mountTask(projection,status,count);try{
   await f.click('영향 업무 고정 원문 보기');await f.wait(()=>f.container.textContent.includes('선택 업무 상세: FN01')||!!f.nodes().find(n=>n.getAttribute('role')==='alert'));
   assert.equal(f.link(),undefined);assert.equal(f.lost(),status===401?1:0);if(projection==='ISSUES_ONLY')assert(f.container.textContent.includes('고정 업무 원문'),'legacy 본문을 숨기지 않음');assert(f.calls.every(c=>c.method==='GET'));
  }finally{await f.close();}
 }
});
test('영향 업무의 옛 click·auxclick은 닫기·재조회·인증/transport·parent 폐기·route 이탈 뒤 이동하지 않는다',{timeout:15000},async()=>{
 for(const mode of ['CLOSE','REOPEN','OWNER_ABA','AUTH_SESSION','PROJECT_ABA','SELECTION_ABA','CSRF','TRANSPORT','PARENT','ROUTE']){
  const f=await mountTask();try{
   await f.click('영향 업무 고정 원문 보기');await f.wait(()=>!!f.link());const link=f.link()!,props=(link as any)[Object.keys(link).find(k=>k.startsWith('__reactProps'))!],before=f.calls.length;
   if(mode==='CLOSE')await f.click('영향 업무 원문 닫기');
   if(mode==='REOPEN')await f.click('영향 업무 고정 원문 보기');
   if(mode==='OWNER_ABA'){await f.render({...f.props,session:{...f.props.session,clientId:'99999999-9999-4999-8999-999999999999'}});await f.render();}
   if(mode==='AUTH_SESSION')await f.render({...f.props,session:{...f.props.session}});
   if(mode==='PROJECT_ABA'){await f.render({...f.props,projectId:'99999999-9999-4999-8999-999999999999'});await f.render();}
   if(mode==='SELECTION_ABA'){await f.render({...f.props,impactRef:{...f.props.impactRef,contentHash:'f'.repeat(64)}});await f.render();}
   if(mode==='CSRF')f.props.session.csrfToken='b'.repeat(43);
   if(mode==='TRANSPORT'){const original=f.client.transport;f.client.transport=(...args:any[])=>original(...args);}
   if(mode==='PARENT')f.revoke();
   if(mode==='ROUTE')location.hash='#/projects/'+projectId+'/workspace';
   const afterInvalidation=f.calls.length;
   for(const handler of ['onClick','onAuxClick']){let prevented=false;props[handler]({preventDefault:()=>prevented=true});assert.equal(prevented,true,mode+'/'+handler);}
   assert.equal(f.calls.length,afterInvalidation,'옛 링크는 후속 요청/쓰기0');assert.equal(f.lost(),0);if(mode!=='REOPEN')assert.equal(f.calls.length,before);await f.render();if(mode!=='REOPEN')assert.equal(f.link(),undefined);if(mode==='ROUTE'){location.hash='#/projects/'+projectId+'/changes';await f.render();assert.equal(f.link(),undefined,'주소 ABA 새 렌더에도 옛 선택 재표시0');}
  }finally{await f.close();}
 }
});
test('영향 업무 조회의 change/plan 대기 뒤 닫기·owner ABA·parent 폐기·이탈은 늦은200/401과 후속GET를 버린다',{timeout:15000},async()=>{
 for(const stage of ['/design-changes/','/work-plans/'])for(const status of [200,401])for(const mode of ['CLOSE','OWNER_ABA','PARENT','ROUTE']){
  const f=await mountTask();let resolve!:(value:Response)=>void;const waiting=new Promise<Response>(r=>resolve=r);f.hold(waiting,stage);
  try{
   await f.click('영향 업무 고정 원문 보기');await f.wait(()=>f.calls.some(c=>c.path.includes(stage)));const before=f.calls.length;
   if(mode==='CLOSE')await f.click('영향 업무 원문 닫기');
   if(mode==='OWNER_ABA'){await f.render({...f.props,session:{...f.props.session,clientId:'99999999-9999-4999-8999-999999999999'}});await f.render();}
   if(mode==='PARENT')f.revoke();if(mode==='ROUTE')location.hash='#/projects/'+projectId+'/workspace';
   let response:Response;if(status===401)response=Response.json({code:'AUTH_REQUIRED'},{status});else if(stage==='/design-changes/')response=Response.json(f.f.page);else response=await f.f.client.transport(f.calls.at(-1)!.path,{method:'GET'});
   await ui.React.act(async()=>{resolve(response);await new Promise(r=>setImmediate(r));});await f.settle();await f.render();assert.equal(f.link(),undefined);assert.equal(f.lost(),0);assert.equal(f.calls.length,before,'이탈 후 다음 보호GET0');assert(!f.container.textContent.includes('고정 업무 원문'));assert(!f.container.textContent.includes('AUTH_REQUIRED'));
  }finally{resolve(Response.json({code:'CANCELLED'},{status:503}));await f.close();}
 }
});
