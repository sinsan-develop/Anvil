import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
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
let ui:any,currentTransport:typeof fetch;
const location={hash:'',protocol:'https:',origin:'https://anvil-synthetic.invalid'};
before(async()=>{
 const app=fileURLToPath(new URL('../../../apps/web/src/App.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:design-approval-impact-handoff',name:'DesignApprovalImpactHandoffApp',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'design-approval-impact-handoff-memory',resolveId(id){if(id.endsWith('virtual:design-approval-impact-handoff'))return '\0design-approval-impact-handoff';},load(id){if(id==='\0design-approval-impact-handoff')return `export * as React from 'react';export {createRoot} from 'react-dom/client';export {App} from ${JSON.stringify(app)};`;}}]});
 const Native=globalThis.MessageChannel;class Channel extends Native{constructor(){super();channels.push(this);}}
 const add=(k:string,f:Function)=>{let set=events.get(k);if(!set)events.set(k,set=new Set());set.add(f);},remove=(k:string,f:Function)=>events.get(k)?.delete(f),window={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener:add,removeEventListener:remove,getComputedStyle:()=>({}),location};document.defaultView=window;
 for(const[k,v]of Object.entries({window,document,location,addEventListener:add,removeEventListener:remove,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:Channel,confirm:()=>true,fetch:(...args:Parameters<typeof fetch>)=>currentTransport(...args)})){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((v:any)=>v.type==='chunk').code+';return DesignApprovalImpactHandoffApp;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});
const H=(v:unknown)=>contentHash(canonicalJson(v));
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}

const id=(n:number)=>'ed140000-0000-4000-8000-'+String(n).padStart(12,'0');
const pid=id(1),uid=id(2),cid=id(3),requestId=id(8),at='2026-11-12T00:00:00.000Z',base='/api/v1/projects/'+pid;
const destination='#/projects/'+pid+'/changes',sourceRoute='#/projects/'+pid+'/approvals/requests/'+requestId;
const label='승인 요청의 변경·영향 원문 보기';
const simpleRef=(n:number,version=1)=>({id:id(n),version,contentHash:'a'.repeat(64)});
async function mount(initial=sourceRoute,mode:'OK'|'CROSS'|'OVERFLOW'='OK'){
 const creator={kind:'HUMAN',userId:uid,clientId:cid};
 const beforeRef=simpleRef(4),changeCore={beforeRef,afterProposalRef:id(5),reason:'정확 변경 원문',sourceRefs:[]};
 const changeRef={...simpleRef(6),contentHash:H(changeCore)};
 const change={ref:changeRef,status:'PROPOSED',...changeCore,requestedBy:{kind:'HUMAN',userId:uid},createdAt:at};
 const mechanical={changeRef,sourceKind:'MECHANICAL_TRACE',beforeRef,items:[],coverageGaps:[],requiresReview:true,inputs:{planRefs:[],indexedDesign:true}};
 const oldRef={...simpleRef(7),contentHash:H(mechanical)};
 const oldest={...mechanical,ref:oldRef,observedAt:at};
 const review={...mechanical,sourceKind:'HUMAN_REVIEW',baseImpactRef:oldRef,reason:'다른 최신 영향',reviewer:{kind:'HUMAN',userId:uid}};
 const latestImpactRef={...oldRef,version:2,contentHash:H(review)},newest={...review,ref:latestImpactRef,observedAt:at};
 const page={change,impactVersions:[oldest],latestImpactRef,hasMoreImpacts:false,nextBeforeVersion:null,activatedAsBaseline:false,observedAt:at};
 const candidate=()=>({changeRef,impactRef:oldRef,approvedDesignRef:simpleRef(4,2),confirmedPlanRef:simpleRef(9),reason:'승인 후보 원문'});
 const candidatePayload=candidate(),approvalProject=mode==='CROSS'?id(88):pid;
 if(mode==='OVERFLOW')candidatePayload.impactRef={...oldRef,version:999_999_999_999_999};
 function approval(){
  const scope={operation:'activateDesignChange',targetRef:candidatePayload.changeRef,expectedVersion:1,payloadHash:H(candidatePayload),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:creator,controlGeneration:1};
  const details={actionScope:scope,candidateCommandId:id(10),reason:'명시 기준 변경',risks:{data:'입력 보호',security:'권한 확인',cost:'없음',interruption:'없음',unverified:'안전 검산'},rollback:{method:'기존 기준',limitations:'원본 보존',evidenceRefs:[]},expiresAt:'2099-01-01T00:00:00.000Z'};
  const snapshot={projectId:approvalProject,details,scopeDigest:H(scope),requiredDecider:{kind:'HUMAN',userId:uid},requestedBy:creator,policyRef:simpleRef(11),controlGeneration:1};
  return {request:{...snapshot,id:requestId,version:1,status:'PENDING',createdAt:at},requestRef:{id:requestId,version:1,contentHash:H(snapshot)},currentVersion:1,storedStatus:'PENDING',effectiveState:'PENDING',decision:null,consumption:null,expired:false,basisCurrent:true,executionAuthorized:false,observedAt:at,candidateActivation:{candidateCommandId:details.candidateCommandId,payloadHash:scope.payloadHash,payload:candidatePayload}};
 }
 const me={user:{id:uid,displayName:'합성 제어자'},clientId:cid,csrfToken:'c'.repeat(43)};
 const project={id:pid,name:'합성 변경 프로젝트',purpose:'근거 확인',desiredOutcome:'정확 영향',version:1,createdAt:at,updatedAt:at,currentMethodologyRef:null,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[],viewerPermissions:['READ_PROJECT'],participation:'OWNER',controlState:{actorId:uid,clientId:cid,generation:1,status:'HELD'}};
 const calls:{path:string;method:string}[]=[];
 let historical=async()=>Response.json(page);
 let proposal=async()=>Response.json({code:'NOT_FOUND'},{status:404});
 currentTransport=async(url,init)=>{
  const path=String(url),method=init?.method??'GET';calls.push({path,method});assert.equal(method,'GET');
  if(path==='/api/v1/session')return Response.json(me);
  if(path===base)return Response.json(project);
  if(path===base+'/approvals/'+requestId)return Response.json(approval());
  if(path.startsWith(base+'/approvals?'))return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:at});
  if(path===base+'/design-changes/'+changeRef.id+'?limit=10&beforeVersion=2')return historical();
  if(path===base+'/design-changes/'+changeRef.id+'?limit=10')return Response.json({...page,impactVersions:[newest,oldest]});
  if(path===base+'/proposals/'+change.afterProposalRef)return proposal();
  return Response.json({code:'NOT_FOUND'},{status:404});
 };
 location.hash=initial;
 const container=document.createElement('main');document.body.appendChild(container);const root=ui.createRoot(container);
 const nodes=(node:MemoryNode=container):MemoryNode[]=>[node,...node.childNodes.flatMap(c=>nodes(c))];
 const button=(label:string)=>nodes().find(n=>n.tagName==='BUTTON'&&(n.textContent===label||n.getAttribute('aria-label')===label));
 const flush=async()=>ui.React.act(async()=>{await new Promise(resolve=>setImmediate(resolve));});
 const until=async(condition:()=>boolean)=>{const end=Date.now()+2000;while(!condition()&&Date.now()<end)await flush();assert(condition(),container.textContent);};
 const click=async(label:string)=>{const node=button(label);assert(node&&!node.disabled,label);await ui.React.act(async()=>node.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const announceRoute=async()=>ui.React.act(async()=>{for(const listener of events.get('hashchange')??[])listener();});
 const go=async(hash:string)=>{location.hash=hash;await announceRoute();await flush();};
 await ui.React.act(async()=>root.render(ui.React.createElement(ui.App)));
 return{calls,page,changeRef,oldRef,latestImpactRef,container,nodes,button,click,until,go,announceRoute,flush,
  hold(fn:typeof historical){historical=fn;},holdProposal(fn:typeof proposal){proposal=fn;},
  close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
test('승인 상세는 명시 이동으로 최신 영향과 구분한 정확한 당시 영향을 읽는다',async()=>{
 const f=await mount();try{
  await f.until(()=>f.container.textContent.includes('설계 변경 적용 전체 입력'));
  assert(!f.calls.some(c=>c.path.includes('/design-changes/')));
  await f.click(label);assert.equal(location.hash,destination);await f.announceRoute();
  await f.until(()=>f.container.textContent.includes('승인 요청의 당시 영향'));
  assert(f.container.textContent.includes(f.oldRef.contentHash));
  assert(f.container.textContent.includes(f.latestImpactRef.contentHash));
  assert(!f.button('설계 변경 적용 준비'));assert(!f.button('영향 검토 준비'));
  assert.deepEqual(f.calls.filter(c=>c.path.includes('/design-changes/')).map(c=>c.path),[base+'/design-changes/'+f.changeRef.id+'?limit=10&beforeVersion=2']);
  assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});

for(const mode of ['WRONG_HASH','EMPTY','DUPLICATE','CURRENT_403'] as const)test('승인 당시 영향의 '+mode+'는 보호된 대상을 다른 이력으로 바꾸지 않는다',async()=>{
 const f=await mount();try{
  await f.until(()=>!!f.button(label));
  f.hold(async()=>{
   if(mode==='CURRENT_403')return Response.json({code:'ACCESS_DENIED'},{status:403});
   const {ref,observedAt,...values}=f.page.impactVersions[0]!;
   const changedImpact={...values,inputs:{...values.inputs,indexedDesign:false}};
   const items=mode==='EMPTY'?[]:mode==='DUPLICATE'?f.page.impactVersions.concat(f.page.impactVersions):[{...changedImpact,observedAt,ref:{...ref,contentHash:H(changedImpact)}}];
   return Response.json({...f.page,impactVersions:items});
  });
  await f.click(label);await f.announceRoute();
  await f.until(()=>f.container.textContent.includes('이전 조회 원문은 숨겼습니다'));
  assert(!f.container.textContent.includes('승인 요청의 당시 영향'));
  assert(!f.button('설계 변경 적용 준비'));
  assert.equal(f.calls.filter(c=>c.path.includes('/design-changes/')).length,1);
  assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});

for(const mode of ['CROSS','OVERFLOW'] as const)test('다른 프로젝트 승인과 조회 한도를 넘는 버전은 후속 조회하지 않는다 · '+mode,async()=>{
 const f=await mount(sourceRoute,mode);try{
  if(mode==='CROSS'){
   await f.until(()=>f.container.textContent.includes('RESPONSE_INVALID'));assert(!f.button(label));
  }else{
   await f.until(()=>!!f.button(label));await f.click(label);await f.announceRoute();
   await f.until(()=>f.container.textContent.includes('DESIGN_APPROVAL_IMPACT_INVALID'));
  }
  assert(!f.calls.some(c=>c.path.includes('/design-changes/')));
  assert(!f.container.textContent.includes('승인 요청의 당시 영향'));
 }finally{await f.close();}
});

for(const status of [200,401])test('이미 떠난 승인 당시 영향의 '+status+' 응답은 같은 화면 재진입에도 표시하지 않는다',async()=>{
 const f=await mount(),held=deferred<Response>();try{
  await f.until(()=>!!f.button(label));f.hold(()=>held.promise);
  await f.click(label);await f.announceRoute();await f.until(()=>f.calls.some(c=>c.path.endsWith('beforeVersion=2')));
  await f.go(sourceRoute);await f.go(destination);
  await ui.React.act(async()=>held.resolve(status===200?Response.json(f.page):Response.json({code:'AUTH_REQUIRED'},{status})));
  await f.flush();
  assert(!f.container.textContent.includes('승인 요청의 당시 영향'));
  assert(f.button('설계 변경 적용 준비'),'별도 재진입의 일반 조회가 남습니다.');
  assert.equal(f.calls.filter(c=>c.path.includes('/design-changes/')).length,1);
  assert(f.calls.every(c=>c.method==='GET'));
 }finally{held.resolve(Response.json(f.page));await f.close();}
});

test('수동 변경 요청 조회는 승인 이력 화면에서 최신 조회로 명시 전환한다',async()=>{
 const f=await mount();try{
  await f.until(()=>!!f.button(label));await f.click(label);await f.announceRoute();
  await f.until(()=>f.container.textContent.includes('승인 요청의 당시 영향'));
  const form=f.nodes().find(n=>n.tagName==='FORM'&&n.textContent.includes('저장된 요청 찾기'));assert(form);
  await ui.React.act(async()=>form.dispatchEvent({type:'submit',bubbles:true}));
  await f.until(()=>f.container.textContent.includes('다른 최신 영향'));
  assert(!f.container.textContent.includes('승인 요청의 당시 영향'));assert(f.button('설계 변경 적용 준비'));
  assert.equal(f.calls.filter(c=>c.path.includes('/design-changes/')).length,2);
  assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});

test('다른 경로가 먼저 열리면 승인 당시 영향 선택을 이후 일반 이동에 재사용하지 않는다',async()=>{
 const f=await mount();try{
  await f.until(()=>!!f.button(label));await f.click(label);
  await f.go(sourceRoute);
  await f.go(destination);
  assert(!f.calls.some(c=>c.path.includes('/design-changes/')));
  assert(f.button('설계 변경 적용 준비'));assert(!f.container.textContent.includes('승인 요청의 당시 영향'));
 }finally{await f.close();}
});

test('승인 이력의 하위 원문에서 늦은 401이 경로 변경 직후 현재 로그인을 해제하지 않는다',async()=>{
 const f=await mount(),pending=deferred<Response>();try{
  await f.until(()=>!!f.button(label));await f.click(label);await f.announceRoute();
  await f.until(()=>f.container.textContent.includes('승인 요청의 당시 영향'));
  f.holdProposal(()=>pending.promise);
  await f.click('보관 변경 전후 원문·diff 조회');assert(f.calls.some(c=>c.path.includes('/proposals/')));
  location.hash=sourceRoute;
  pending.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));
  await f.flush();
  await f.announceRoute();
  await f.until(()=>!!f.button(label));
  assert(!f.container.textContent.includes('승인 요청의 당시 영향'));
  assert(f.calls.every(c=>c.method==='GET'));
 }finally{pending.resolve(Response.json({code:'NOT_FOUND'},{status:404}));await f.close();}
});
