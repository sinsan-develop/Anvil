import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readCandidateInput,candidateReadiness,candidateCapabilities} from '../../../apps/server/modules/connections/candidate-input.ts';
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
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/connections/ConnectionsPage.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:candidate-pagination',name:'CandidatePaginationTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'candidate-memory-entry',resolveId(id){if(id.endsWith('virtual:candidate-pagination'))return '\0candidate-pagination';},load(id){if(id==='\0candidate-pagination')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{ConnectionsPage}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};import * as api from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/connections/api.ts',import.meta.url)))};export{React,createRoot,ConnectionsPage,ApiClient,api};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return CandidatePaginationTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});
const id=(n:number)=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const at='2026-11-01T00:00:00.000Z';
const claim=readCandidateInput('registerConnection',{kind:'CONNECTION_CANDIDATE',candidate:{label:'상세 원본 이름'},candidateRef:null,policyRef:{id:id(9),version:1,contentHash:'b'.repeat(64)},expiresAt:new Date(Date.now()+600000).toISOString(),reason:'합성 원형'},{now:new Date(),policyExpiresAt:new Date(Date.now()+1800000)});
const candidate={kind:claim.kind,input:claim,readiness:candidateReadiness(claim),capabilities:candidateCapabilities(claim)},detail={ref:{id:id(3),version:1,contentHash:contentHash(canonicalJson(candidate))},candidate,expired:false,createdAt:at,recordedBy:id(2),executionAuthorized:false,observedAt:at};
function page(cursor:string|null){return{view:'CANDIDATES_ONLY',items:[{ref:{id:id(cursor?4:3),version:1,contentHash:detail.ref.contentHash},kind:'CONNECTION_CANDIDATE',label:cursor?'두 번째 후보':'첫 후보',readiness:'NOT_READY',expiresAt:'2099-01-01T00:00:00.000Z',integrity:'NOT_RECHECKED'}],hasMore:!cursor,nextCursor:cursor?null:'CURSOR-1',observedAt:at};}
async function mount(){
 const calls:{url:string;method:string}[]=[],requests:string[]=[],container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);let changes=0,lost=0;
 const session={user:{id:id(2)},clientId:id(2),csrfToken:'c'.repeat(43)};
 const state:{next:null|'FAIL'|'DELAY';release:null|((r:Response)=>void)}={next:null,release:null};
 function client(){return new ui.ApiClient(async(url:any,options:any)=>{const raw=String(url),u=new URL(raw,'https://anvil.invalid');const method=options?.method??'GET';calls.push({url:raw,method});assert.equal(method,'GET','목록 동작 POST0');if(u.pathname.endsWith('/connection-candidates')){requests.push(u.searchParams.get('cursor')??'FIRST');const mode=state.next;state.next=null;if(mode==='DELAY')return new Promise<Response>(resolve=>{state.release=resolve;});if(mode==='FAIL')return Response.json({code:'CANDIDATE_LIST_UNAVAILABLE'},{status:503});return Response.json(page(u.searchParams.get('cursor')));}if(u.pathname.includes('/connection-candidates/'))return Response.json(detail);return Response.json({code:'PROJECT_OPERATION_DENIED'},{status:403});});}
 const props:any={client:client(),projectId:id(1),session,buffer:null,onChange:()=>{changes++;},onAuthenticationLost:()=>{lost++;}};
 for(const k of['trust','limit','policy','materialPolicy','preparationPolicy','resultPolicy','limitPolicy','sourceObservationPolicy','hostTrustPolicy','baselinePolicy','sourceDeclarationPolicy','capabilityReport']){props[k+'Buffer']=null;props['on'+k[0]!.toUpperCase()+k.slice(1)+'Change']=()=>{changes++;};}
 const nodes=(n=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))];
 const buttons=(label:string)=>nodes().filter(n=>n.tagName==='BUTTON'&&n.textContent===label);
 const commits:string[]=[];function Host(){ui.React.useLayoutEffect(()=>{commits.push(container.textContent);});return ui.React.createElement(ui.ConnectionsPage,props);}
 async function render(){await ui.React.act(async()=>root.render(ui.React.createElement(Host)));}
 async function click(label:string){const found=buttons(label);assert.equal(found.length,1,label+' 버튼');assert(!found[0]!.disabled,label+' 활성');await ui.React.act(async()=>found[0]!.dispatchEvent({type:'click',button:0,bubbles:true}));}
 async function filter(value:string){const node=nodes().find(n=>n.tagName==='SELECT'&&n.attributes.get('aria-label')==='후보 종류 필터');assert(node);const key=Object.keys(node).find(k=>k.startsWith('__reactProps$'));assert(key);await ui.React.act(async()=>{(node as any)[key].onChange({target:{value}});});}
 async function flush(){await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});}
 async function close(){await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}
 await render();return{props,state,calls,requests,container,commits,buttons,nodes,render,click,filter,flush,close,client,changes:()=>changes,lost:()=>lost};
}

test('실제 후보 Page는 첫→다음→이전 cursor GET으로 돌아가며 조회만 수행한다',async()=>{
 const f=await mount();try{assert.match(f.container.textContent,/첫 후보/);await f.click('후보 다음 목록');assert.match(f.container.textContent,/두 번째 후보/);await f.click('후보 이전 목록');assert.match(f.container.textContent,/첫 후보/);assert.deepEqual(f.requests,['FIRST','CURSOR-1','FIRST']);assert.equal(f.changes(),0);}finally{await f.close();}
});


test('실패 target은 성공 이력과 분리되며 같은 cursor 명시 재조회·이전 복귀만 수행한다',async()=>{
 const f=await mount();try{f.state.next='FAIL';await f.click('후보 다음 목록');assert.deepEqual(f.requests,['FIRST','CURSOR-1']);await f.flush();assert.deepEqual(f.requests,['FIRST','CURSOR-1'],'자동 재시도0');await f.click('같은 후보 목록 다시 조회');assert.match(f.container.textContent,/두 번째 후보/);assert.deepEqual(f.requests,['FIRST','CURSOR-1','CURSOR-1']);f.state.next='FAIL';await f.click('후보 이전 목록');assert.deepEqual(f.requests.slice(-1),['FIRST']);await f.click('같은 후보 목록 다시 조회');assert.match(f.container.textContent,/첫 후보/);assert.deepEqual(f.requests.slice(-2),['FIRST','FIRST']);assert.equal(f.changes(),0);}finally{await f.close();}
});

test('목록 전환은 실제 helper로 준비한 UNKNOWN 후보 원명령과 부모 buffer bytes를 바꾸지 않는다',async()=>{
 const f=await mount();try{const b=ui.api.newCandidate(f.props.projectId,f.props.session,1,'CONNECTION_CANDIDATE');b.draft={candidate:{label:'보존 후보'},candidateRef:null,expiresAt:'2099-01-01T00:00:00.000Z',reason:'합성 보존'};b.input={kind:b.kind,...b.draft,policyRef:{id:id(9),version:1,contentHash:'b'.repeat(64)}};b.pending=await ui.api.prepareCandidate(b,f.props.session);b.uncertain=true;b.failure={code:'CONNECTION_LOST',status:503};f.props.buffer=b;await f.render();const before=JSON.stringify(b);await f.click('후보 다음 목록');await f.click('후보 이전 목록');await f.filter('CONNECTION_CANDIDATE');assert.equal(JSON.stringify(f.props.buffer),before);assert.equal(f.props.buffer,b);assert.equal(f.changes(),0);assert(f.calls.every(c=>c.method==='GET'));}finally{await f.close();}
});

test('project/user/client/CSRF/filter/API identity ABA는 이전 cursor·늦은401을 복원하지 않는다',async()=>{
 for(const change of['project','user','clientId','csrf','filter','api']){const f=await mount();try{await f.click('후보 다음 목록');f.state.next='DELAY';await f.click('후보 목록 새로고침');assert(f.state.release);const release=f.state.release;const original={projectId:f.props.projectId,session:f.props.session,client:f.props.client};if(change==='project')f.props.projectId=id(8);if(change==='user')f.props.session={...f.props.session,user:{id:id(8)}};if(change==='clientId')f.props.session={...f.props.session,clientId:id(8)};if(change==='csrf')f.props.session={...f.props.session,csrfToken:'d'.repeat(43)};if(change==='api')f.props.client=f.client();if(change==='filter')await f.filter('CONNECTION_CANDIDATE');else await f.render();Object.assign(f.props,original);if(change==='filter')await f.filter('');else await f.render();const before=f.requests.length;await ui.React.act(async()=>release(Response.json({code:'SESSION_EXPIRED'},{status:401})));await f.flush();assert.equal(f.lost(),0,change+' 옛401 폐기');assert.equal(f.requests.length,before);assert.match(f.container.textContent,/첫 후보/);assert.equal(f.buttons('후보 이전 목록').length,0);assert.equal(f.changes(),0);}finally{await f.close();}}
});

test('무렌더 transport 교체와 unmount 후 늦은 응답은 새 원문·authLost로 채택하지 않는다',async()=>{
 for(const mode of['TRANSPORT','UNMOUNT']){const f=await mount();let closed=false;try{f.state.next='DELAY';await f.click('후보 다음 목록');const release=f.state.release!;assert(release);if(mode==='TRANSPORT')f.props.client.transport=f.client().transport;else{await f.close();closed=true;}await ui.React.act(async()=>release(Response.json({code:'SESSION_EXPIRED'},{status:401})));await f.flush();assert.equal(f.lost(),0);assert.equal(f.changes(),0);if(mode==='TRANSPORT'){assert.match(f.container.textContent,/첫 후보/);assert.equal(f.buttons('후보 이전 목록').length,0);await f.click('후보 다음 목록');assert.match(f.container.textContent,/두 번째 후보/);}}finally{if(!closed)await f.close();}}
});

test('현재401은 authLost를 전달하고 loading 동안 중복 클릭 요청은 0이다',async()=>{
 const f=await mount();try{f.state.next='DELAY';await f.click('후보 다음 목록');const release=f.state.release!,button=f.buttons('후보 목록 새로고침')[0]!;assert(button.disabled);const before=f.requests.length;await ui.React.act(async()=>button.dispatchEvent({type:'click',button:0,bubbles:true}));assert.equal(f.requests.length,before);await ui.React.act(async()=>release(Response.json({code:'SESSION_EXPIRED'},{status:401})));assert.equal(f.lost(),1);assert.equal(f.changes(),0);}finally{await f.close();}
});


test('정상 보호 상세를 연 뒤 API/CSRF 새 scope 첫 commit부터 이전 원문을 숨긴다',async()=>{
 for(const mode of['api','csrf']){const f=await mount();try{await f.click('정확 후보 버전 보기');const deadline=Date.now()+2000;while(!f.container.textContent.includes('상세 원본 이름')&&Date.now()<deadline)await f.flush();assert(f.container.textContent.includes('상세 원본 이름'),'기존 정상 상세 도달');f.state.next='DELAY';const before=f.commits.length;if(mode==='api')f.props.client=f.client();else f.props.session={...f.props.session,csrfToken:'d'.repeat(43)};await f.render();assert(f.state.release);assert(!f.commits[before]!.includes('상세 원본 이름'),mode+' 첫 commit');assert(!f.container.textContent.includes('상세 원본 이름'));await ui.React.act(async()=>f.state.release!(Response.json(page(null))));}finally{await f.close();}}
});
