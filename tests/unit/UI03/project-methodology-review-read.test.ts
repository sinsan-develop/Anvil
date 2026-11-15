import {emptyFormBuffer,type FormBuffer} from '../../../apps/web/src/features/methodologies/form-editor-state.ts';
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
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/methodology-editor/ProjectMethodologyPage.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:review-overflow',name:'ReviewOverflowTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'review-overflow-memory-entry',resolveId(id){if(id.endsWith('virtual:review-overflow'))return '\0review-overflow';},load(id){if(id==='\0review-overflow')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{ProjectMethodologyPage}from${JSON.stringify(entry)};import{StoredNodeDefinition}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/methodology-editor/StoredNodeDefinition.tsx',import.meta.url)))};import{emptyMethodBuffer}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/methodology-editor/common-api.ts',import.meta.url)))};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};import * as reviewApi from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/methodology-editor/project-methodology-review-api.ts',import.meta.url)))};import{CommonFormEditor}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/methodologies/CommonFormEditor.tsx',import.meta.url)))};import{CommonMethodEditor}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/methodology-editor/CommonMethodEditor.tsx',import.meta.url)))};export{React,createRoot,ProjectMethodologyPage,emptyMethodBuffer,ApiClient,reviewApi,CommonFormEditor,CommonMethodEditor};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const [key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return ReviewOverflowTest;')();
});
after(()=>{for(const channel of channels){channel.port1.close();channel.port2.close();}for(const[key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,pid=id(10),at='2026-10-31T01:00:00.000Z',hash=(v:unknown)=>contentHash(canonicalJson(v));
const criteria={criteriaVersion:1,items:[['METHOD_PURPOSE_SCOPE','방법론의 목적과 단계별 작업 범위가 분명한가'],['METHOD_FLOW_CONTROL','순서·분기·합류·재작업이 의도한 절차인가'],['METHOD_INPUT_OUTPUT','입력·산출물과 양식의 연결이 충분한가'],['METHOD_COMPLETION_APPROVAL','완료 기준·검수·사람 승인 경계가 충분한가'],['METHOD_RECORD_LIMITS','담당·작업 기록·한도와 미연결 사항을 분명히 했는가']].map(([criterionId,title])=>({criterionId,title}))};
function original(){const graph={nodes:[{nodeId:'N1',name:'보관 단계',purpose:'과거 원본',kind:'HUMAN',role:'USER',mode:'CASE_BY_CASE',position:{x:0,y:0},inputs:[],outputs:[],taskScope:{included:['검토'],excluded:[]},completionCriteria:['검토'],approvalBoundary:[],limitPolicyRef:null,recordRequirements:['원형']}],edges:[],entryNodeId:'N1',terminalNodeIds:['N1']};const ref={id:id(20),version:1,contentHash:hash(graph)};return{projectId:pid,ref,headVersion:2,name:'과다 검토',purpose:'누락 접근 복원',scope:'PROJECT',systemCode:null,graph,sourceApproval:{kind:'USER_AUTHORED'},reason:'합성 원본',createdAt:at,contentReviewCriteria:criteria,confirmation:{id:id(30),decision:'CONFIRMED',decidedBy:id(11),decided_at:at,reviewRefs:[{id:id(31),criteriaVersion:1,targetRef:ref,outcome:'ACCEPTED'}],validation:{validForConfirmation:true,issues:[]}},historyMode:'SEPARATE_PAGE',currentConfirmationState:'NOT_REEVALUATED',runtimeReadiness:'PROJECT_BINDINGS_REQUIRED',applicationTransition:'EXECUTION_STATE_UNVERIFIED'};}
function page(start=201,count=20,more=true){return{targetRef:original().ref,upperSequence:201,items:Array.from({length:count},(_,i)=>({ref:{id:id(1000+start-i),criteriaVersion:1,targetRef:original().ref,outcome:'ACCEPTED'},criteria,items:criteria.items.map(x=>({criterionId:x.criterionId,outcome:'ACCEPTED',reason:'검토 근거',evidenceRefs:[]})),reviewer:{kind:'HUMAN',userId:id(12),sameAsTargetRecorder:false},sourceKind:'HUMAN_REVIEW',reason:'원 검토 '+(start-i),reviewedAt:at,serverSequence:start-i})),hasMore:more,nextCursor:more?'cursor-'+start:null,observedAt:at};}
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}
async function fixture(){const record=original(),calls:{path:string;method:string}[]=[],controls={old:async(_url:string)=>Response.json({code:'METHOD_REVIEW_PAGINATION_NOT_READY'},{status:412}),overview:async()=>Response.json(original()),history:async(url:string)=>Response.json(url.includes('cursor=')?page(181):page())};let lost=0,changes=0;
 const transport:typeof fetch=async(path,options)=>{const url=String(path);calls.push({path:url,method:String(options?.method)});assert.equal(options?.method,'GET');if(url.endsWith('/overview')||url.includes('/overview?'))return controls.overview();if(url.includes('/content-reviews?'))return controls.history(url);if(url===`/api/v1/projects/${pid}`)return Response.json({id:pid,currentMethodologyRef:null});if(url.startsWith(`/api/v1/projects/${pid}/methodologies?`))return Response.json({projectId:pid,items:[{ref:record.ref,name:record.name,purpose:record.purpose,scope:'PROJECT'}],hasMore:false,nextAfterId:null,observedAt:at,applicationTransition:'EXECUTION_STATE_UNVERIFIED'});if(url==='/api/v1/methodologies')return Response.json({items:[],hasMore:false,nextCursor:null,observedAt:at,baselineVersion:null});if(url.includes('/methodologies/')&&url.includes('/versions/'))return controls.old(url);throw Error('UNMODELED_MEMORY_GET:'+url);};
 const client=new ui.ApiClient(transport),buffer=ui.emptyMethodBuffer(),before=structuredClone(buffer),container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);let props:any={client,projectId:pid,session:{user:{id:id(11)},clientId:id(12),csrfToken:'C'.repeat(43)},buffer,onChange:()=>changes++,onAuthenticationLost:()=>lost++};
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))],button=(label:string)=>{const a=nodes().filter(n=>n.tagName==='BUTTON'&&n.textContent===label);assert.equal(a.length,1,'버튼 '+label);return a[0]!;};const render=async(next=props)=>{props=next;await ui.React.act(async()=>root.render(ui.React.createElement(ui.ProjectMethodologyPage,props)));},click=async(label:string)=>{const b=button(label);assert(!b.disabled);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));},settle=async()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));}),waitFor=async(f:()=>boolean)=>{const end=Date.now()+2000;while(!f()&&Date.now()<end)await ui.React.act(async()=>{await new Promise(r=>setTimeout(r,2));});assert(f(),container.textContent);};await render();return{calls,controls,client,props:()=>props,nodes,button,render,click,settle,waitFor,text:()=>container.textContent,lost:()=>lost,changes:()=>changes,unchanged:()=>assert.deepEqual(buffer,before),open:async()=>{await waitFor(()=>nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='과다 검토 v1 열기'));await click('과다 검토 v1 열기');await waitFor(()=>nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='분리된 방법론 원본 조회'));},close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};}
test('실제 Page의 201거절 뒤 명시 원본 조회 버튼과 별도 readonly 원본을 연결한다',async()=>{const f=await fixture();try{await f.open();assert.equal(f.calls.filter(x=>x.path.includes('/overview')).length,0);await f.click('분리된 방법론 원본 조회');await f.waitFor(()=>f.text().includes('보관 단계'));assert.match(f.text(),/현재 확정 효력.*미확인/);assert(f.text().includes(id(31)));assert.equal(f.calls.filter(x=>x.path.includes('/content-reviews')).length,0);f.unchanged();assert.equal(f.changes(),0);}finally{await f.close();}});
test('검토 페이지는 명시 GET·성공한 이전왕복과 실패한 같은 대상 재시도를 보존한다',async()=>{const f=await fixture();try{await f.open();await f.click('분리된 방법론 원본 조회');await f.waitFor(()=>f.text().includes('보관 단계'));await f.click('검토 이력 첫 페이지 조회');await f.waitFor(()=>f.text().includes('검토 순번 201'));assert(f.button('검토 이전 페이지').disabled);f.controls.history=async()=>Response.json({code:'STORAGE_FAILED'},{status:500});await f.click('검토 다음 페이지');await f.waitFor(()=>f.text().includes('보관 자료 미확인'));assert(!f.text().includes('검토 순번 201'));const failed=f.calls.at(-1)!.path;f.controls.history=async()=>Response.json(page(181));await f.click('동일 조회 다시 시도');await f.waitFor(()=>f.text().includes('검토 순번 181'));assert.equal(f.calls.at(-1)!.path,failed);f.controls.history=async()=>Response.json(page());await f.click('검토 이전 페이지');await f.waitFor(()=>f.text().includes('검토 순번 201'));assert(f.button('검토 이전 페이지').disabled);f.unchanged();assert.equal(f.changes(),0);assert(f.calls.every(c=>c.method==='GET'));}finally{await f.close();}});
test('다른412/403/응답손상은 자동 fallback하지 않고 정상 0~200 원경로는 보존한다',async()=>{for(const kind of['OTHER412','403','INVALID','NORMAL']){const f=await fixture();try{f.controls.old=async()=>kind==='NORMAL'?Response.json({...original(),validation:{validForConfirmation:true,issues:[]},contentReviews:[]}):kind==='INVALID'?Response.json({ref:original().ref}):Response.json({code:kind==='OTHER412'?'OTHER_NOT_READY':'FORBIDDEN'},{status:kind==='OTHER412'?412:403});await f.waitFor(()=>f.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='과다 검토 v1 열기'));await f.click('과다 검토 v1 열기');await f.waitFor(()=>kind==='NORMAL'?f.nodes().some(n=>n.attributes.get('aria-label')==='프로젝트 방법론 원본 흐름'):f.nodes().some(n=>n.attributes.get('role')==='alert'));assert(!f.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='분리된 방법론 원본 조회'));assert.equal(f.calls.filter(c=>c.path.includes('/overview')||c.path.includes('/content-reviews')).length,0);f.unchanged();}finally{await f.close();}}});
test('overview의 graph/fullref·당시 refs와 별도 page의 순번/중복/표본/관측/상한 변조를 reader가 거절한다',async()=>{for(const kind of['GRAPH','REF','CONFIRM','FLAG','CONTENT_REVIEWS']){const v:any=original();if(kind==='GRAPH')v.graph.nodes[0].name='변조';if(kind==='REF')v.ref.id=id(90);if(kind==='CONFIRM')v.confirmation.reviewRefs[0].targetRef.contentHash='c'.repeat(64);if(kind==='FLAG')v.currentConfirmationState='VALID';if(kind==='CONTENT_REVIEWS')v.contentReviews=[];const client=new ui.ApiClient(async()=>Response.json(v));await assert.rejects(ui.reviewApi.readMethodOverview(client,pid,{id:id(20),version:1}),/서버 응답/);}
 for(const kind of['ORDER','DUPLICATE','TARGET','ITEM','OBSERVATION','UPPER','CURSOR']){const v:any=page();if(kind==='ORDER')v.items.reverse();if(kind==='DUPLICATE')v.items[1].ref.id=v.items[0].ref.id;if(kind==='TARGET')v.targetRef.id=id(91);if(kind==='ITEM')v.items[0].items[0].outcome=['ACCEPTED'];if(kind==='OBSERVATION')v.observedAt='2026-10-30T01:00:00.000Z';if(kind==='UPPER')v.upperSequence=0;if(kind==='CURSOR')v.nextCursor=null;await assert.rejects(ui.reviewApi.readStoredMethodReviews(new ui.ApiClient(async()=>Response.json(v)),pid,original().ref),/서버 응답/);}});
test('느린 JSON·활성401은 닫기/주체/project/client 객체·transport 전환 뒤 폐기한다',async()=>{for(const change of['CLOSE','USER','PROJECT','CLIENT_ID','CLIENT_OBJECT','TRANSPORT','ABA']){const f=await fixture(),gate=deferred<any>();let started=false;try{await f.open();f.controls.overview=async()=>{const r=Response.json({code:'AUTH_REQUIRED'},{status:401});r.json=()=>{started=true;return gate.promise;};return r;};await f.click('분리된 방법론 원본 조회');assert(started);const props=f.props(),transport=f.client.transport;if(change==='CLOSE')await f.click('분리 조회 닫기');if(change==='USER')await f.render({...props,session:{...props.session,user:{id:id(90)}}});if(change==='PROJECT')await f.render({...props,projectId:id(91)});if(change==='CLIENT_ID')await f.render({...props,session:{...props.session,clientId:id(92)}});if(change==='CLIENT_OBJECT')await f.render({...props,client:new ui.ApiClient(transport)});if(change==='TRANSPORT')f.client.transport=async()=>Response.json(original());if(change==='ABA'){await f.render({...props,session:{...props.session,user:{id:id(90)}}});await f.render(props);}gate.resolve({code:'AUTH_REQUIRED'});await f.settle();assert.equal(f.lost(),0,change);assert(!f.text().includes('보관 자료 미확인'),change);assert(!f.text().includes('보관 단계'),change);f.unchanged();assert.equal(f.changes(),0);}finally{gate.resolve({code:'AUTH_REQUIRED'});await f.close();}}const f=await fixture();try{await f.open();f.controls.overview=async()=>Response.json({code:'AUTH_REQUIRED'},{status:401});await f.click('분리된 방법론 원본 조회');await f.waitFor(()=>f.lost()===1);assert(!f.text().includes('보관 단계'));}finally{await f.close();}});
test('실제 native digest 완료 후 닫기·무렌더 transport 교체·관측 ABA에서 옛 원본은 폐기한다',async()=>{for(const change of['CLOSE','TRANSPORT','ABA']){const f=await fixture(),gate=deferred<void>(),subtle=globalThis.crypto.subtle,native=subtle.digest,descriptor=Object.getOwnPropertyDescriptor(subtle,'digest');let done=false;try{await f.open();Object.defineProperty(subtle,'digest',{configurable:true,value:async(...args:any[])=>{const result=await Reflect.apply(native,subtle,args);done=true;await gate.promise;return result;}});await f.click('분리된 방법론 원본 조회');await f.waitFor(()=>done);const props=f.props();if(change==='CLOSE')await f.click('분리 조회 닫기');if(change==='TRANSPORT')f.client.transport=async()=>Response.json(original());if(change==='ABA'){await f.render({...props,session:{...props.session,user:{id:id(90)}}});await f.render(props);}gate.resolve();await f.settle();assert(!f.text().includes('보관 단계'),change);assert.equal(f.changes(),0);}finally{gate.resolve();if(descriptor)Object.defineProperty(subtle,'digest',descriptor);else Reflect.deleteProperty(subtle,'digest');await f.close();}}});
test('페이지 JSON 대기 중 닫기/중복 클릭/이탈은 GET1·POST0와 원초안을 유지한다',async()=>{const f=await fixture(),gate=deferred<any>();let started=false;try{await f.open();await f.click('분리된 방법론 원본 조회');await f.waitFor(()=>f.text().includes('보관 단계'));f.controls.history=async()=>{const r=Response.json(page());r.json=()=>{started=true;return gate.promise;};return r;};await f.click('검토 이력 첫 페이지 조회');assert(started);const button=f.button('검토 이력 첫 페이지 조회');assert(button.disabled);await ui.React.act(async()=>button.dispatchEvent({type:'click',button:0,bubbles:true}));assert.equal(f.calls.filter(x=>x.path.includes('/content-reviews')).length,1);await f.click('분리 조회 닫기');gate.resolve(page());await f.settle();assert(!f.text().includes('검토 순번 201'));f.unchanged();assert.equal(f.changes(),0);assert(f.calls.every(c=>c.method==='GET'));}finally{gate.resolve(page());await f.close();}});
test('이전·다음 버전의 hash 미보유 lookup은 원문 graph 검산 뒤 fullref로 페이지를 고정한다',async()=>{const f=await fixture();try{f.controls.old=async(url:string)=>url.endsWith('/versions/2')?Response.json({code:'METHOD_REVIEW_PAGINATION_NOT_READY'},{status:412}):Response.json({...original(),validation:{validForConfirmation:true,issues:[]},contentReviews:[]});await f.waitFor(()=>f.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='과다 검토 v1 열기'));await f.click('과다 검토 v1 열기');await f.waitFor(()=>f.text().includes('현재 조회 1 / 최신 2'));await f.click('다음 방법론 버전');await f.waitFor(()=>f.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent==='분리된 방법론 원본 조회'));const v:any=original();v.ref.version=2;v.confirmation=null;f.controls.overview=async()=>Response.json(v);await f.click('분리된 방법론 원본 조회');await f.waitFor(()=>f.text().includes('보관 절차 원문'));assert(f.calls.at(-1)!.path.endsWith('/versions/2/overview'));f.controls.history=async()=>{const p=page();p.targetRef=v.ref;p.items.forEach(x=>x.ref.targetRef=v.ref);return Response.json(p);};await f.click('검토 이력 첫 페이지 조회');await f.waitFor(()=>f.text().includes('검토 순번 201'));assert(f.calls.at(-1)!.path.includes('/versions/2/content-reviews?targetHash='+v.ref.contentHash));f.unchanged();assert.equal(f.changes(),0);}finally{await f.close();}});
test('실패한 이전 이동은 성공 이력을 pop하지 않고 같은 대상 재시도 후 왕복한다',async()=>{const f=await fixture();try{await f.open();await f.click('분리된 방법론 원본 조회');await f.waitFor(()=>f.text().includes('보관 단계'));f.controls.history=async(url:string)=>Response.json(url.includes('cursor=cursor-181')?page(161):url.includes('cursor=cursor-201')?page(181):page());await f.click('검토 이력 첫 페이지 조회');await f.waitFor(()=>f.text().includes('검토 순번 201'));await f.click('검토 다음 페이지');await f.waitFor(()=>f.text().includes('검토 순번 181'));await f.click('검토 다음 페이지');await f.waitFor(()=>f.text().includes('검토 순번 161'));const normal=f.controls.history;f.controls.history=async()=>Response.json({code:'STORAGE_FAILED'},{status:500});await f.click('검토 이전 페이지');await f.waitFor(()=>f.text().includes('보관 자료 미확인'));const failed=f.calls.at(-1)!.path;f.controls.history=normal;await f.click('동일 조회 다시 시도');await f.waitFor(()=>f.text().includes('검토 순번 181'));assert.equal(f.calls.at(-1)!.path,failed);await f.click('검토 다음 페이지');await f.waitFor(()=>f.text().includes('검토 순번 161'));await f.click('검토 이전 페이지');await f.waitFor(()=>f.text().includes('검토 순번 181'));await f.click('검토 이전 페이지');await f.waitFor(()=>f.text().includes('검토 순번 201'));assert(f.button('검토 이전 페이지').disabled);}finally{await f.close();}});
test('페이지 JSON 중 닫기후 목록 재조회·프로젝트·transport 전환은 옛 페이지·401을 복구하지 않는다',async()=>{for(const change of['PROJECT','REFRESH','TRANSPORT']){const f=await fixture(),gate=deferred<any>();let started=false;try{await f.open();await f.click('분리된 방법론 원본 조회');await f.waitFor(()=>f.text().includes('보관 단계'));f.controls.history=async()=>{const r=Response.json({code:'AUTH_REQUIRED'},{status:401});r.json=()=>{started=true;return gate.promise;};return r;};await f.click('검토 이력 첫 페이지 조회');assert(started);if(change==='PROJECT')await f.render({...f.props(),projectId:id(90)});if(change==='TRANSPORT')f.client.transport=async()=>Response.json(page());if(change==='REFRESH'){await f.click('분리 조회 닫기');await f.click('전용 방법론 목록 갱신');}gate.resolve({code:'AUTH_REQUIRED'});await f.settle();assert.equal(f.lost(),0);assert(!f.text().includes('검토 순번 201'));f.unchanged();}finally{gate.resolve({code:'AUTH_REQUIRED'});await f.close();}}});
test('페이지 실패 뒤 원본 재조회 실패의 동일 재시도는 옛 page가 아닌 overview를 다시 호출한다',async()=>{const f=await fixture();try{await f.open();await f.click('분리된 방법론 원본 조회');await f.waitFor(()=>f.text().includes('보관 단계'));f.controls.history=async()=>Response.json({code:'STORAGE_FAILED'},{status:500});await f.click('검토 이력 첫 페이지 조회');await f.waitFor(()=>f.text().includes('보관 자료 미확인'));f.controls.overview=async()=>Response.json({code:'STORAGE_FAILED'},{status:500});await f.click('보관 원본 다시 조회');await f.waitFor(()=>f.text().includes('보관 자료 미확인')&&!f.button('동일 조회 다시 시도').disabled);const n=f.calls.filter(c=>c.path.includes('/overview')).length;f.controls.overview=async()=>Response.json(original());await f.click('동일 조회 다시 시도');await f.waitFor(()=>f.calls.filter(c=>c.path.includes('/overview')).length===n+1);await f.waitFor(()=>f.text().includes('보관 단계'));}finally{await f.close();}});
test('큰20건 거절 뒤 사용자 명시 limit1 선택만 새페이지를 읽고 이력을 초기화한다',async()=>{const f=await fixture();try{await f.open();await f.click('분리된 방법론 원본 조회');await f.waitFor(()=>f.text().includes('보관 단계'));f.controls.history=async()=>Response.json({code:'METHOD_REVIEW_PAGE_TOO_LARGE'},{status:503});await f.click('검토 이력 첫 페이지 조회');await f.waitFor(()=>f.text().includes('보관 자료 미확인'));const n=f.calls.filter(c=>c.path.includes('/content-reviews')).length,select=f.nodes().find(n=>n.tagName==='SELECT'&&n.options.some(o=>o.textContent==='20개'))!;assert(select);assert(select.options.some(o=>o.value==='1'||o.attributes.get('value')==='1'||o.textContent==='1개'),'명시적인 limit1 선택');await ui.React.act(async()=>{const props=Object.getOwnPropertyNames(select).find(k=>k.startsWith('__reactProps'));assert(props);(select as any)[props].onChange({target:{value:'1'}});});assert.equal(f.calls.filter(c=>c.path.includes('/content-reviews')).length,n,'자동축소 GET0');f.controls.history=async()=>Response.json(page(201,1,true));await f.click('검토 이력 첫 페이지 조회');await f.waitFor(()=>f.text().includes('검토 순번 201'));assert(f.calls.at(-1)!.path.endsWith('limit=1'));assert(f.button('검토 이전 페이지').disabled);f.unchanged();assert.equal(f.changes(),0);}finally{await f.close();}});

async function mountFormSave(replies: ('APPLIED'|'LOST'|'503'|'WRONG_HASH'|'OK'|'HOLD')[],copy=false) {
 const standard={id:id(71),version:1,contentHash:'a'.repeat(64)};
 const definition={formCode:'TEST',name:'새 공통 양식',scope:'USER_COMMON' as const,purpose:'',authorRole:'',reviewerRole:'',confirmerRole:'',requiredInputs:[],items:[],authoringStandardRef:standard};
 const ref={id:id(72),version:1,contentHash:hash(definition)},version={ref,definition,authoringStandard:{ref:standard,content:'공통 작성 기준'},validation:{formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'}};
 const posts:string[]=[],gets:string[]=[],held=deferred<Response>();let saved=0,lost=0;
 let session={user:{id:id(73)},clientId:id(74),csrfToken:'c'.repeat(43)},visible=true;
 const transport:typeof fetch=async(url,options)=>{
  const reply=replies.shift();
  if(options?.method==='POST'){
   assert.equal(url,'/api/v1/user-common/commands');const body=String(options.body);posts.push(body);
   const request=JSON.parse(body);assert.equal(request.operation,copy?'copyForm':'saveFormDraft');assert.equal(request.targetId,null);
   if(reply==='LOST')throw Error('응답 유실');
   assert.equal(reply,'APPLIED');
   return Response.json({scopeKind:'USER_COMMON',ownerUserId:id(73),commandId:request.commandId,status:'APPLIED',operationId:id(75),targetId:ref.id,version:1,data:{status:'DRAFT',ref},serverReceivedAt:at});
  }
  assert.equal(options?.method,'GET');assert.equal(url,'/api/v1/forms/'+ref.id+'/versions/1');gets.push(String(url));
  if(reply==='503')return Response.json({code:'FORM_READ_UNAVAILABLE'},{status:503});
  if(reply==='HOLD')return held.promise;
  if(reply==='WRONG_HASH')return Response.json({...version,ref:{...ref,contentHash:'f'.repeat(64)}});
  assert.equal(reply,'OK');return Response.json(version);
 };
 let client=new ui.ApiClient(transport),buffer:FormBuffer={...emptyFormBuffer(),ownerUserId:session.user.id,definition,reason:'새 내용',dirty:true};
 const review={ref:standard,criteriaVersion:1,criteria:[],items:[],outcome:'NOT_EXECUTED' as const,reason:'보존할 검토 입력',dirty:true,pending:null};
 buffer.review=review;
 const source={...version,ref:{...ref,id:id(77),contentHash:'b'.repeat(64)}};
 let selection=source;
 if(copy)buffer.pending={name:definition.name,formCode:definition.formCode,request:{schemaVersion:1,commandId:id(78),operation:'copyForm',targetId:null,expectedVersion:0,clientId:session.clientId,payload:{sourceRef:source.ref,name:definition.name,scope:'USER_COMMON',reason:'복사'}}};
 const container:MemoryNode=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 function Host(){const [value,setValue]=ui.React.useState(buffer);buffer=value;const captured=selection;
  return visible?ui.React.createElement(ui.CommonFormEditor,{client,session,source:null,copySelection:copy?{source:captured,current:()=>selection===captured,clear:()=>{}}:undefined,buffer:value,onChange:setValue,onSaved:()=>saved++,onAuthenticationLost:()=>lost++}):null;}
 async function render(){await ui.React.act(async()=>root.render(ui.React.createElement(Host)));}
 function button(label:string,node=container):MemoryNode|undefined{if(node.tagName==='BUTTON'&&node.textContent===label)return node;for(const child of node.childNodes){const match=button(label,child);if(match)return match;}}
 async function click(label:string){const found=button(label);assert(found,label);assert(!found.disabled,label);await ui.React.act(async()=>{found.dispatchEvent({type:'click',button:0,bubbles:true});});}
 await render();
 return {posts,gets,ref,version,review,held,click,button,async replaceCopy(){selection={...source,ref:{...source.ref,id:id(79)}};await render();},buffer:()=>buffer,count:()=>({saved,lost}),text:()=>container.textContent,
  async show(value:boolean){visible=value;await render();},async change(which:'user'|'client'){if(which==='user')session={...session,user:{id:id(76)}};else client=new ui.ApiClient(transport);await render();},
  async close(){await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}
 };
}

test('공통 양식 새 저장 영수증은 GET503 뒤에도 원버퍼에 남아 왕복 후 GET만 복구한다',async()=>{
 const x=await mountFormSave(['APPLIED','503','WRONG_HASH','OK']);try{
  await x.click('공통 양식 새 버전 저장');
  const request=JSON.parse(x.posts[0]!);
  assert.deepEqual(x.buffer().pending,{request,name:'새 공통 양식',formCode:'TEST',storedRef:x.ref});
  assert(x.buffer().dirty);assert.equal(x.buffer().targetId,null);assert.deepEqual(x.count(),{saved:0,lost:0});
  assert(!x.button('같은 양식 명령 결과 확인'));await x.show(false);await x.show(true);assert.equal(x.gets.length,1);
  await x.click('저장된 양식 원문 조회');assert.deepEqual(x.count(),{saved:0,lost:0});assert.deepEqual(x.buffer().pending?.storedRef,x.ref);
  await x.click('저장된 양식 원문 조회');assert.equal(x.posts.length,1);assert.equal(x.gets.length,3);
  assert.equal(x.buffer().pending,null);assert.equal(x.buffer().targetId,x.ref.id);assert.equal(x.buffer().version,1);assert(!x.buffer().dirty);assert.deepEqual(x.buffer().review,x.review);assert.deepEqual(x.count(),{saved:1,lost:0});
 }finally{await x.close();}
});

test('공통 양식 원문 조회 중 사용자·클라이언트 교체나 닫기 후 늦은 성공·401은 폐기한다',async()=>{
 for(const change of ['user','client','unmount'] as const)for(const ok of [true,false]){
  const x=await mountFormSave(['APPLIED','503','HOLD']);try{
   await x.click('공통 양식 새 버전 저장');await x.click('저장된 양식 원문 조회');assert.equal(x.gets.length,2);
   if(change==='unmount')await x.show(false);else await x.change(change);
   const before=structuredClone(x.buffer());
   await ui.React.act(async()=>x.held.resolve(ok?Response.json(x.version):Response.json({code:'AUTH_REQUIRED'},{status:401})));
   assert.deepEqual(x.buffer(),before);assert.deepEqual(x.count(),{saved:0,lost:0});assert.equal(x.posts.length,1);
  }finally{await x.close();}
 }
});

test('공통 양식 POST 응답 유실은 같은 명령의 명시적 재확인으로만 복구한다',async()=>{
 const x=await mountFormSave(['LOST','APPLIED','OK']);try{
  await x.click('공통 양식 새 버전 저장');
  assert.deepEqual(x.buffer().pending?.request,JSON.parse(x.posts[0]!));assert.equal(x.buffer().pending?.storedRef,undefined);
  assert(!x.button('저장된 양식 원문 조회'));await x.show(false);await x.show(true);
  assert.equal(x.posts.length,1);assert.equal(x.gets.length,0);await x.click('같은 양식 명령 결과 확인');
  assert.equal(x.posts.length,2);assert.equal(x.posts[0],x.posts[1]);assert.equal(x.gets.length,1);assert.deepEqual(x.count(),{saved:1,lost:0});
 }finally{await x.close();}
});

test('복사 원본을 교체하면 진행 중인 저장 양식 원문 조회를 편집 버퍼에 반영하지 않는다',async()=>{
 const x=await mountFormSave(['APPLIED','503','HOLD'],true);try{
  await x.click('같은 양식 명령 결과 확인');assert.deepEqual(x.buffer().pending?.storedRef,x.ref);
  await x.click('저장된 양식 원문 조회');await x.replaceCopy();const before=structuredClone(x.buffer());
  await ui.React.act(async()=>x.held.resolve(Response.json(x.version)));
  assert.deepEqual(x.buffer(),before);assert.deepEqual(x.buffer().review,x.review);assert.deepEqual(x.count(),{saved:0,lost:0});assert.equal(x.posts.length,1);assert.equal(x.gets.length,2);
 }finally{await x.close();}
});

async function methodEditorSave(mode:'save'|'copy'|'project'='save') {
 const name='새 방법론',purpose='검산할 목적',graph=ui.emptyMethodBuffer().graph;
 const ref={id:id(81),version:1,contentHash:hash(graph)},version={ref,name,purpose,graph,scope:'USER_COMMON',systemCode:null,confirmation:null,validation:{validForConfirmation:false,issues:[]},runtimeReadiness:'PROJECT_BINDINGS_REQUIRED'};
 let read:()=>Promise<Response>=async()=>Response.json({code:'STORAGE_FAILED'},{status:503});
 let userSession={user:{id:id(82)},clientId:id(83),csrfToken:'x'.repeat(43)},visible=true,saved=0,lost=0,losePost=false;
 let source={...version,ref:{...ref,id:id(84)}};
 const posts:string[]=[],gets:string[]=[],projectCalls:string[]=[];
 const transport:typeof fetch=async(path,options)=>{
  if(path==='/api/v1/forms')return Response.json({items:[],hasMore:false,nextCursor:null,baselineVersion:null,observedAt:at});
  if(options?.method==='POST'){
   assert.equal(path,'/api/v1/user-common/commands');const body=String(options.body);posts.push(body);const request=JSON.parse(body);
   if(losePost){losePost=false;throw Error('응답 유실');}
   assert.equal(request.targetId,null);assert.equal(request.operation,mode==='copy'?'copyMethodology':'saveMethodologyDraft');
   return Response.json({scopeKind:'USER_COMMON',ownerUserId:id(82),commandId:request.commandId,status:'APPLIED',operationId:id(85),targetId:ref.id,version:1,data:{status:'DRAFT',ref},serverReceivedAt:at});
  }
  assert.equal(options?.method,'GET');assert.equal(path,'/api/v1/methodologies/'+ref.id+'/versions/1');gets.push(String(path));return read();
 };
 let client=new ui.ApiClient(transport),buffer={...ui.emptyMethodBuffer(),ownerUserId:userSession.user.id,name,purpose,reason:'작업 입력',dirty:mode!=='copy'};
 const review={ref,criteriaVersion:1,criteria:[],items:[],outcome:'NOT_EXECUTED',reason:'기존 검토',dirty:mode!=='copy',pending:null};buffer.review=review;
 if(mode==='project')buffer.pending={request:{schemaVersion:1,commandId:id(90),operation:'saveMethodologyDraft',clientId:userSession.clientId,targetId:null,expectedVersion:0,payload:{scope:'PROJECT'}},name,purpose,storedRef:ref};
 const gateway={prepare:async(request:any)=>{projectCalls.push('prepare');return {...request,projectId:pid};},write:async(request:any)=>{assert.equal(request.projectId,pid);projectCalls.push('write');return {data:{ref}};},read:async()=>{projectCalls.push('read');return {...version,scope:'PROJECT'};}};
 const container:MemoryNode=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 function Host(){const [value,setValue]=ui.React.useState(buffer);buffer=value;const originalSource=source;
  return visible?ui.React.createElement(ui.CommonMethodEditor,{client,session:userSession,source:mode==='copy'?source:null,copySelection:mode==='copy'?{source,current:()=>originalSource===source,clear:()=>{}}:undefined,buffer:value,onChange:setValue,onSaved:()=>saved++,onAuthenticationLost:()=>lost++,gateway:mode==='project'?gateway:undefined}):null;}
 async function render(){await ui.React.act(async()=>root.render(ui.React.createElement(Host)));}
 function find(predicate:(node:MemoryNode)=>boolean,node=container):MemoryNode|undefined{if(predicate(node))return node;for(const child of node.childNodes){const match=find(predicate,child);if(match)return match;}}
 async function click(label:string){const button=find(n=>n.tagName==='BUTTON'&&n.textContent===label);assert(button,label);assert(!button.disabled);await ui.React.act(async()=>button.dispatchEvent({type:'click',button:0,bubbles:true}));}
 async function start(){if(mode==='copy'){const input=find(n=>n.tagName==='INPUT'&&n.parentNode?.textContent==='복사본 이름');assert(input);const prop=Object.getOwnPropertyNames(input).find(k=>k.startsWith('__reactProps'));assert(prop);await ui.React.act(async()=>(input as any)[prop].onChange({target:{value:name}}));await click('내 공통본으로 복사');}else await click(mode==='project'?'전용본 새 버전 저장':'공통본 새 버전 저장');}
 await render();return {start,click,posts,gets,ref,version,projectCalls,buffer:()=>buffer,count:()=>({saved,lost}),setRead(fn:typeof read){read=fn;},lose(){losePost=true;},
  async show(next:boolean){visible=next;await render();},async change(which:string){if(which==='client')client=new ui.ApiClient(transport);else if(which==='user')userSession={...userSession,user:{id:id(86)}};else if(which==='copy')source={...source,ref:{...source.ref,id:id(87)}};else visible=false;await render();},
  async close(){await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}
 };
}
test('공통 방법론 저장·복사 영수증은 화면 왕복 후 원문 GET만 복구한다',async()=>{
 for(const mode of ['save','copy'] as const){const x=await methodEditorSave(mode);try{
  await x.start();assert.equal(x.gets.length,1);assert.equal(x.posts.length,1);
  assert.deepEqual(x.buffer().pending?.storedRef,x.ref);assert.deepEqual(x.buffer().pending.request,JSON.parse(x.posts[0]!));assert.equal(x.buffer().targetId,null);assert.equal(x.buffer().review.reason,'기존 검토');
  await x.show(false);await x.show(true);assert.equal(x.gets.length,1);assert.equal(x.posts.length,1);
  x.setRead(async()=>Response.json({...x.version,ref:{...x.ref,contentHash:'f'.repeat(64)}}));await x.click('저장된 방법론 원문 조회');assert.deepEqual(x.count(),{saved:0,lost:0});assert.deepEqual(x.buffer().pending.storedRef,x.ref);
  x.setRead(async()=>Response.json(x.version));await x.click('저장된 방법론 원문 조회');assert.equal(x.posts.length,1);assert.equal(x.gets.length,3);assert.equal(x.buffer().pending,null);assert.equal(x.buffer().targetId,x.ref.id);assert.equal(x.buffer().review.reason,'기존 검토');assert.deepEqual(x.count(),{saved:1,lost:0});
 }finally{await x.close();}}
});
test('공통 방법론 POST 유실은 원 명령만 재확인하고 프로젝트 저장은 준비·쓰기·조회 순서를 보존한다',async()=>{
 const x=await methodEditorSave();try{x.lose();await x.start();assert.equal(x.buffer().pending?.storedRef,undefined);assert.deepEqual(x.buffer().pending.request,JSON.parse(x.posts[0]!));assert.equal(x.gets.length,0);x.setRead(async()=>Response.json(x.version));await x.click('같은 명령 결과 다시 확인');assert.equal(x.posts.length,2);assert.equal(x.posts[0],x.posts[1]);assert.deepEqual(x.count(),{saved:1,lost:0});}finally{await x.close();}
 const p=await methodEditorSave('project');try{await p.click('같은 명령 결과 다시 확인');assert.deepEqual(p.projectCalls,['prepare','write','read']);assert.equal(p.posts.length+p.gets.length,0);assert.deepEqual(p.count(),{saved:1,lost:0});}finally{await p.close();}
});
test('공통 방법론 지연 원문·401은 주체·클라이언트·복사원본 교체와 화면 종료 뒤 폐기한다',async()=>{
 for(const change of ['user','client','copy','unmount'])for(const ok of [true,false]){
  const x=await methodEditorSave(change==='copy'?'copy':'save'),held=deferred<Response>();try{
   await x.start();x.setRead(()=>held.promise);await x.click('저장된 방법론 원문 조회');assert.equal(x.gets.length,2);
   await x.change(change);const before=structuredClone(x.buffer());await ui.React.act(async()=>held.resolve(ok?Response.json(x.version):Response.json({code:'AUTH_REQUIRED'},{status:401})));
   if(change==='copy'){await x.click('저장된 방법론 원문 조회');assert.equal(x.gets.length,2);}
   assert.deepEqual(x.buffer(),before);assert.equal(x.posts.length,1);assert.deepEqual(x.count(),{saved:0,lost:0});
  }finally{await x.close();}
 }
});
