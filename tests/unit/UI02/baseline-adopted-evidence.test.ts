import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

// 실제 ReactDOM을 위한 메모리 DOM. 브라우저 다운로드와 원격 접속은 실행하지 않는다.
class MemoryNode{
 nodeType:number;nodeName:string;tagName:string;localName:string;namespaceURI='http://www.w3.org/1999/xhtml';parentNode:MemoryNode|null=null;childNodes:MemoryNode[]=[];ownerDocument:any;attributes=new Map<string,string>();style:Record<string,unknown>={};listeners=new Map<string,Function[]>();value='';checked=false;disabled=false;data='';href='';download='';
 constructor(name:string,type=1,owner?:any){this.nodeType=type;this.nodeName=type===1?name.toUpperCase():name;this.tagName=this.nodeName;this.localName=name;this.ownerDocument=owner;}
 get firstChild():MemoryNode|null{return this.childNodes[0]??null;}get lastChild():MemoryNode|null{return this.childNodes.at(-1)??null;}get nextSibling():MemoryNode|null{const siblings=this.parentNode?.childNodes;return siblings?.[siblings.indexOf(this)+1]??null;}
 get nodeValue():string|null{return this.nodeType===3?this.data:null;}set nodeValue(value:string|null){if(this.nodeType===3)this.data=value??'';}
 get textContent():string{return this.nodeType===3?this.data:this.childNodes.map(n=>n.textContent).join('');}
 set textContent(value:string){if(this.nodeType===3){this.data=String(value);return;}for(const n of this.childNodes)n.parentNode=null;this.childNodes=[];if(value)this.appendChild(this.ownerDocument.createTextNode(String(value)));}
 appendChild(n:MemoryNode){if(n.parentNode)n.parentNode.removeChild(n);n.parentNode=this;this.childNodes.push(n);return n;}
 insertBefore(n:MemoryNode,b:MemoryNode){if(n.parentNode)n.parentNode.removeChild(n);n.parentNode=this;const i=this.childNodes.indexOf(b);assert(i>=0);this.childNodes.splice(i,0,n);return n;}
 removeChild(n:MemoryNode){const i=this.childNodes.indexOf(n);assert(i>=0);this.childNodes.splice(i,1);n.parentNode=null;return n;}
 setAttribute(key:string,value:unknown){this.attributes.set(key,String(value));if(key==='disabled')this.disabled=true;}
 removeAttribute(key:string){this.attributes.delete(key);if(key==='disabled')this.disabled=false;}
 getAttribute(key:string){return this.attributes.get(key)??null;}
 addEventListener(key:string,fn:Function){this.listeners.set(key,[...(this.listeners.get(key)??[]),fn]);}
 removeEventListener(key:string,fn:Function){this.listeners.set(key,(this.listeners.get(key)??[]).filter(v=>v!==fn));}
 contains(n:MemoryNode|null):boolean{return !!n&&(n===this||this.childNodes.some(c=>c.contains(n)));}
 click(){assert.equal(this.tagName,'A');this.ownerDocument.downloads.push({href:this.href,name:this.download});}
 dispatchEvent(event:any){event.target=this;event.preventDefault??=()=>{event.defaultPrevented=true;};event.stopPropagation??=()=>{event.cancelBubble=true;};const chain:MemoryNode[]=[];for(let n:MemoryNode|null=this;n;n=n.parentNode)chain.push(n);for(const n of chain)for(const fn of n.listeners.get(event.type)??[])fn(event);}
}
let ui:any;
const document:any=new MemoryNode('#document',9),saved=new Map<string,PropertyDescriptor|undefined>();
document.ownerDocument=document;document.downloads=[];document.createElement=(n:string)=>new MemoryNode(n,1,document);document.createElementNS=(_ns:string,n:string)=>new MemoryNode(n,1,document);document.createTextNode=(s:string)=>{const n=new MemoryNode('#text',3,document);n.data=s;return n;};document.documentElement=document.createElement('html');document.body=document.createElement('body');document.documentElement.appendChild(document.body);document.activeElement=document.body;
const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];
class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
before(async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/project-create/ProjectBaselinePanel.tsx',import.meta.url));
 const api=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:baseline-evidence',name:'BaselineEvidenceTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'baseline-evidence',resolveId(id){if(id.endsWith('virtual:baseline-evidence'))return '\0baseline-evidence';},load(id){if(id==='\0baseline-evidence')return `import * as React from 'react';import {createRoot} from 'react-dom/client';import {ProjectBaselinePanel} from ${JSON.stringify(entry)};import {ApiClient} from ${JSON.stringify(api)};export {React,createRoot,ProjectBaselinePanel,ApiClient};`;}}]});
 const window={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,getComputedStyle:()=>({})};document.defaultView=window;
 for(const [key,value] of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((v:any)=>v.type==='chunk').code+';return BaselineEvidenceTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const [key,value] of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});

const id=(n:number)=>'a16e0000-0000-4000-8000-'+String(n).padStart(12,'0'),pid=id(1),uid=id(2),cid=id(3),at='2026-11-09T00:00:00.000Z';
const flags={sourceAuthorizationVerified:false,coverageVerified:false,executionAuthorized:false,dispatchPerformed:false};
const ref=(id:string,snapshot:unknown)=>({id,version:1,contentHash:contentHash(canonicalJson(snapshot))});
const text='고정 텍스트 근거 <script>합성</script>',textBytes=Buffer.from(text),binaryBytes=Buffer.from([0,255,2]);
const artifact=(artifactId:string,bytes:Buffer,mediaType:string)=>({artifactId,bytes:bytes.length,contentHash:contentHash(bytes),mediaType});
const a=artifact(id(20),textBytes,'text/markdown;charset=utf-8'),b=artifact(id(21),binaryBytes,'application/octet-stream');
const currentName='현재 채택본 FN-A 근거 원문 조회 '+a.artifactId,pastName='과거 채택본 FN-B 근거 원문 조회 '+b.artifactId;
const octets=(bytes:Buffer)=>new Response(new Uint8Array(bytes),{headers:{'content-type':'application/octet-stream'}});
function adopted(record:number,itemId:string,evidenceRefs:(typeof a)[]){
 const input={baseRef:null,source:{kind:'NONE_SELECTED',declarationRef:null,sourceRootRef:null,snapshotRef:null,grantRef:null,unverifiedReason:'소스 미확인'},items:[{itemId,title:'고정 기능 '+itemId,designRef:null,featureState:'PARTIAL',evidenceRefs,limitations:'범위 미검산',reason:'함께 채택한 근거'}],coverageReason:'일부만 관측',reason:'기록 보관'};
 const snapshot={schemaVersion:1,kind:'FEATURE_STATUS_V1',draftRef:ref(id(record+10),input),input,
  sourceBinding:{kind:'NONE_SELECTED',declaration:null,observation:null,declarationReportRelation:'UNVERIFIED'},
  evidenceBindings:[{itemId,evidenceRefs}],reviewRefs:[ref(id(record+20),{itemId})],previousBaselineRef:null,reason:'사용자가 상태 기록을 채택',
  acknowledged:true,adoptedBy:{kind:'HUMAN',userId:uid},adoptedAt:at,contentConfirmed:true,...flags};
 return {projectId:pid,status:'FEATURE_STATUS_V1',ref:ref(id(record),snapshot),snapshot,currentCheck:{state:'UNAVAILABLE',issues:['CURRENT_REVIEW_EVIDENCE_UNAVAILABLE']},currentContentReviewValid:false,contentConfirmed:true,observedAt:at,...flags};
}
async function mount(){
 const current=adopted(30,'FN-A',[a]),past=adopted(31,'FN-B',[b]),empty=adopted(32,'FN-C',[]);
 const legacy={projectId:pid,status:'LEGACY_UNVERIFIED',ref:null,legacyRef:ref(id(33),{}),snapshot:null,contentConfirmed:false,currentCheck:{state:'UNAVAILABLE',issues:['LEGACY_BINDING_MISSING']},...flags};
 const unconfirmed={projectId:pid,status:'UNCONFIRMED',ref:null,contentConfirmed:false,...flags};
 const project={id:pid,name:'합성 프로젝트',purpose:'보호 근거 검수',desiredOutcome:'고정 근거 읽기',version:1,createdAt:at,updatedAt:at,currentMethodologyRef:null,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[],viewerPermissions:['READ_PROJECT'],participation:'VIEWER',controlState:{actorId:id(5),clientId:id(6),generation:2,status:'HELD'}};
 const base='/api/v1/projects/'+pid,history=[past,legacy,empty],calls:string[]=[];
 let currentView:unknown=current,authLost=0,writes=0,intercept:(path:string,signal?:AbortSignal|null)=>Response|Promise<Response>|null=()=>null;
 const transport:typeof fetch=async(url,init)=>{
  const path=String(url);calls.push(path);assert.equal(init?.method,'GET');assert.equal(init?.credentials,'same-origin');
  const override=intercept(path,init?.signal);if(override)return override;
  if(path===base)return Response.json(project);
  if(path===base+'/baseline-current')return Response.json(currentView);
  if(path===base+'/baselines?limit=50')return Response.json({projectId:pid,items:history.map(v=>v.ref?{ref:v.ref,status:'STORED_ADOPTION_NOT_RECHECKED'}:{ref:null,legacyRef:v.legacyRef,status:'LEGACY_UNVERIFIED'}),hasMore:false,nextCursor:null,metadataIntegrity:'NOT_RECHECKED',...flags});
  for(const v of history){const r=v.ref??('legacyRef'in v?v.legacyRef:null);if(r&&path===`${base}/baselines/${r.id}/versions/1`)return Response.json(v);}
  if(path===base+'/files/'+a.artifactId)return octets(textBytes);
  if(path===base+'/files/'+b.artifactId)return octets(binaryBytes);
  assert.fail('승인 동선 밖 GET '+path);
 };
 const client=new ui.ApiClient(transport),container=document.createElement('main'),root=ui.createRoot(container);document.body.appendChild(container);
 let live=true;
 const props={client,projectId:pid,session:{user:{id:uid},clientId:cid,csrfToken:'c'.repeat(43)},buffer:null,onChange:()=>{writes++;},onAuthenticationLost:()=>{authLost++;}};
 const render=async()=>{await ui.React.act(async()=>root.render(live?ui.React.createElement(ui.ProjectBaselinePanel,props):null));};
 const tick=()=>ui.React.act(async()=>{await new Promise(resolve=>setImmediate(resolve));});
 const until=async(text:string)=>{const end=Date.now()+2000;while(!container.textContent.includes(text)&&Date.now()<end)await tick();assert(container.textContent.includes(text),text+' / '+container.textContent);};
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 const button=(label:string,index=0)=>nodes().filter(n=>n.tagName==='BUTTON'&&(n.textContent===label||n.getAttribute('aria-label')===label))[index];
 const click=async(label:string,index=0)=>{const node=button(label,index);assert(node&&!node.disabled,label);await ui.React.act(async()=>node.dispatchEvent({type:'click',button:0}));};
 const close=async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);};
 await render();await until('현재 참여 VIEWER');
 return {current,past,base,calls,container,render,tick,until,nodes,button,click,close,props,transport,authLost:()=>authLost,writes:()=>writes,intercept(fn:typeof intercept){intercept=fn;},async hide(){live=false;await render();},useUnconfirmed(){currentView=unconfirmed;},setCurrent(value:unknown){currentView=value;}};
}

test('조회 전용 사용자가 정확 현재본과 과거 채택본의 근거를 명시 GET으로 확인한다',async t=>{
 const f=await mount(),urls:Blob[]=[],revoked:string[]=[];
 t.mock.method(URL,'createObjectURL',(blob:Blob)=>{urls.push(blob);return 'blob:synthetic';});
 t.mock.method(URL,'revokeObjectURL',(url:string)=>{revoked.push(url);});
 document.downloads=[];
 try{
  assert(f.button('새 기준선 초안 작성')?.disabled);
  await f.click('현재 채택본 조회');await f.until('고정 기능 FN-A');assert.equal(f.calls.filter(p=>p.includes('/files/')).length,0);
  await f.click(currentName);await f.until(text);assert.equal(f.nodes().filter(n=>n.tagName==='SCRIPT').length,0);
  assert.equal(f.calls.at(-1),f.base+'/files/'+a.artifactId);assert.equal(f.writes(),0);assert.equal(urls.length,0);
  await f.click('채택 이력 목록');await f.click('고정 이력 조회');await f.until('고정 기능 FN-B');
  assert(!f.container.textContent.includes(text));assert.equal(f.calls.filter(p=>p.includes('/files/')).length,1);
  await f.click(pastName);await f.until('텍스트로 표시하지 않는 형식');
  assert.equal(f.calls.at(-1),f.base+'/files/'+b.artifactId);assert.equal(urls.length,0);
  await f.click('원문 파일 다운로드');assert.equal(urls.length,1);assert.equal(urls[0]!.type,'application/octet-stream');
  assert.deepEqual(new Uint8Array(await urls[0]!.arrayBuffer()),new Uint8Array(binaryBytes));
  assert.deepEqual(document.downloads,[{href:'blob:synthetic',name:'evidence-'+b.artifactId+'.bin'}]);
  await new Promise(resolve=>setTimeout(resolve,5));assert.deepEqual(revoked,['blob:synthetic']);assert.equal(f.writes(),0);
 }finally{await f.close();}
});

test('미채택·옛 미확인·빈 근거와 변조 채택본은 파일 GET을 열지 않는다',async()=>{
 const f=await mount();
 try{
  f.useUnconfirmed();await f.click('현재 채택본 조회');await f.until('아직 채택된 기준선 없음');assert(!f.button(currentName));
  await f.click('채택 이력 목록');await f.click('고정 이력 조회',1);await f.until('옛 기록 · 결박 미확인');assert(!f.button(pastName));
  await f.click('고정 이력 조회',2);await f.until('고정 기능 FN-C');assert(!f.button(pastName));
  f.setCurrent({...f.current,snapshot:{...f.current.snapshot,evidenceBindings:[{itemId:'FN-A',evidenceRefs:[b]}]}});
  await f.click('현재 채택본 조회');await f.until('RESPONSE_INVALID');assert(!f.button(currentName));
  assert.equal(f.calls.filter(p=>p.includes('/files/')).length,0);assert.equal(f.authLost(),0);assert.equal(f.writes(),0);
 }finally{await f.close();}
});

test('다른 채택 기록, 원문 닫기, 새 인증 범위 뒤의 바이트와 401을 폐기한다',async()=>{
 const f=await mount();
 let release!: (response:Response)=>void;
 const holdA=()=>f.intercept(path=>path.endsWith('/files/'+a.artifactId)?new Promise<Response>(resolve=>{release=resolve;}):null);
 try{
  await f.click('현재 채택본 조회');await f.until('고정 기능 FN-A');
  holdA();await f.click(currentName);assert(release);
  await f.click('채택 이력 목록');await f.click('고정 이력 조회');await f.until('고정 기능 FN-B');
  await ui.React.act(async()=>release(Response.json({code:'AUTH_REQUIRED'},{status:401})));
  assert.equal(f.authLost(),0);assert(!f.container.textContent.includes(text));
  await f.click(currentName);await f.click('채택 근거 원문 닫기');
  await ui.React.act(async()=>release(octets(textBytes)));assert(!f.container.textContent.includes(text));
  await f.click(currentName);f.props.session={...f.props.session,csrfToken:'d'.repeat(43)};await f.render();
  await ui.React.act(async()=>release(Response.json({code:'AUTH_REQUIRED'},{status:401})));
  assert(!f.button(currentName));assert.equal(f.authLost(),0);
  await f.click('현재 채택본 조회');await f.until('고정 기능 FN-A');await f.click(currentName);
  f.props.client.transport=f.transport.bind(null);
  await ui.React.act(async()=>release(Response.json({code:'AUTH_REQUIRED'},{status:401})));
  assert.equal(f.authLost(),0);
  await f.render();await f.click('현재 채택본 조회');await f.until('고정 기능 FN-A');await f.click(currentName);
  await f.hide();await ui.React.act(async()=>release(Response.json({code:'AUTH_REQUIRED'},{status:401})));
  assert.equal(f.authLost(),0);assert.equal(f.writes(),0);
 }finally{await f.close();}
});

test('같은 근거 연타를 막고 다른 근거·닫기에서 대기 중인 GET과 스트림을 각각 취소한다',async()=>{
 const f=await mount();
 let signalled=0,cancelled=0,chunkReading=false;
 try{
  await f.click('현재 채택본 조회');await f.until('고정 기능 FN-A');
  await f.click('채택 이력 목록');await f.click('고정 이력 조회');await f.until('고정 기능 FN-B');
  f.intercept((path,signal)=>{
   if(!path.endsWith('/files/'+a.artifactId))return null;
   assert(signal);return new Promise<Response>((_,reject)=>signal.addEventListener('abort',()=>{signalled++;reject(new DOMException('취소','AbortError'));},{once:true}));
  });
  await f.click(currentName);await f.click(currentName);
  assert.equal(f.calls.filter(p=>p.endsWith('/files/'+a.artifactId)).length,1);
  await f.click(pastName);await f.until('텍스트로 표시하지 않는 형식');
  assert.equal(signalled,1);assert.equal(f.authLost(),0);
  f.intercept((path,signal)=>{
   if(!path.endsWith('/files/'+a.artifactId))return null;
   assert(signal);
   const stream=new ReadableStream<Uint8Array>({
    start(controller){controller.enqueue(new Uint8Array(textBytes.subarray(0,1)));},
    pull(){chunkReading=true;},
    cancel(){cancelled++;}
   });
   return new Response(stream,{headers:{'content-type':'application/octet-stream'}});
  });
  await f.click(currentName);assert(chunkReading);
  await f.click('채택 근거 원문 닫기');await f.tick();
  assert.equal(cancelled,1);assert(!f.container.textContent.includes(text));
  f.intercept(path=>path.endsWith('/files/'+a.artifactId)?octets(Buffer.alloc(a.bytes,97)):null);
  await f.click(currentName);await f.until('ARTIFACT_INTEGRITY_FAILED');
  assert(!f.button('원문 파일 다운로드'));assert.equal(f.writes(),0);
 }finally{await f.close();}
});
