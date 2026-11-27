import assert from 'node:assert/strict';
import {test,before,after} from 'node:test';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {ApiClient,ApiError} from '../../../apps/web/src/api/client.ts';
import {contentHash} from '../../../contracts/canonical.ts';
import {resultFixture,hash} from './result-view-fixture.ts';
async function module(){return import('../../../apps/web/src/features/session-detail/reported-command-evidence.ts');}
function fixture(){
 const f=resultFixture(),text='명령의 별도 근거\n',ref={id:'33333333-3333-4333-8333-333333333333',version:1,contentHash:contentHash(text)},outputRef={...ref,id:'44444444-4444-4444-8444-444444444444'},m:any=f.entry.snapshot.manifest;
 const evidence={sourceKind:'WORKER_CLAIM',ref,contentHash:ref.contentHash,environmentRef:f.a,recordedAt:f.entry.snapshot.submittedAt};
 m.commandResults=[{profileRef:f.a,argv:['check'],cwdRef:f.a,hostRef:f.entry.snapshot.scope.executionRef,executionRef:f.entry.snapshot.scope.executionRef,startedAt:null,finishedAt:null,exitCode:null,outputRef,evidence:[evidence]}];
 m.artifactRefs=[ref,outputRef];const rehash=()=>{f.entry.snapshot.manifestHash=hash(m);f.entry.ref.contentHash=hash(f.entry.snapshot);};rehash();
 const file=()=>({projectId:f.pid,resultRef:f.entry.ref,artifactRef:ref,bytes:Buffer.byteLength(text),mediaType:'text/plain;charset=utf-8',text,sourceState:'REGISTERED_BYTES_ONLY',evidenceProvenanceVerified:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false,observedAt:'2026-10-20T00:00:00.000Z'});
 return{...f,m,ref,outputRef,evidence,text,rehash,file,selection:{commandIndex:0,evidenceIndex:0}};
}
test('명령 output과 다른 개별 evidence만 기존 same-origin GET으로 대조한다',async()=>{
 const m=await module(),f=fixture(),calls:string[]=[];
 const result=await m.readReportedCommandEvidence(new ApiClient(async(path,options)=>{calls.push(String(path));assert.equal(options?.method,'GET');return Response.json(f.file());}),f.entry as any,f.selection,()=>true);
 assert(result);assert.equal(result.bytesState,'MATCHED_REGISTERED_BYTES');assert.equal(result.file!.text,f.text);assert.deepEqual(result.reported,f.evidence);assert.deepEqual(result.issues,[]);
 assert.deepEqual(calls,[`/api/v1/projects/${f.pid}/results/${f.entry.ref.id}/artifacts/${f.ref.id}/text`]);
 for(const key of ['evidenceProvenanceVerified','commandExecutionVerified','commandExitVerified','completionAccepted','executionAuthorized','dispatchPerformed'] as const)assert.equal(result[key],false);
});
test('다른 실행·선언hash/등록ref·중복파일·미지원 버전은 요청0과 이유를 보존한다',async()=>{
 const mod=await module();
 for(const [change,reason]of [
  [(f:any)=>f.m.commandResults[0].executionRef={...f.entry.snapshot.scope.executionRef,version:2},'COMMAND_EXECUTION_MISMATCH'],
  [(f:any)=>f.evidence.contentHash='f'.repeat(64),'DECLARED_EVIDENCE_HASH_MISMATCH'],
  [(f:any)=>f.m.artifactRefs=[],'FILE_NOT_DECLARED_IN_RESULT'],
  [(f:any)=>f.m.artifactRefs.push(f.ref),'AMBIGUOUS_FILE_ID'],
  [(f:any)=>f.m.artifactRefs[0]={...f.ref,contentHash:'f'.repeat(64)},'DECLARED_FILE_REF_MISMATCH'],
  [(f:any)=>{f.ref.version=2;},'FILE_VERSION_UNSUPPORTED'],
 ]as const){const f=fixture();change(f);f.rehash();let calls=0;const r=await mod.readReportedCommandEvidence(new ApiClient(async()=>{calls++;return Response.json(f.file());}),f.entry as any,f.selection,()=>true);assert(r);assert.equal(r.file,null);assert.equal(r.bytesState,'NOT_QUERIED_BINDING_MISMATCH');assert(r.issues.includes(reason));assert.equal(calls,0);}
});
test('변형 원제출·잘못된 선택은 요청0, 403과 선택교체 뒤 응답은 이전 성공으로 바꾸지 않는다',async()=>{
 const mod=await module();
 for(const alter of [(f:any)=>f.entry.ref.contentHash='f'.repeat(64),(f:any)=>f.m.rollback='변형',(f:any)=>f.selection.commandIndex=-1,(f:any)=>f.selection.evidenceIndex=1,(f:any)=>f.selection.extra=true]){
  const f=fixture();alter(f);let calls=0;await assert.rejects(mod.readReportedCommandEvidence(new ApiClient(async()=>{calls++;return Response.json(f.file());}),f.entry as any,f.selection,()=>true));assert.equal(calls,0);
 }
 const f=fixture();await assert.rejects(mod.readReportedCommandEvidence(new ApiClient(async()=>Response.json({code:'ACCESS_DENIED'},{status:403})),f.entry as any,f.selection,()=>true),(e:any)=>e instanceof ApiError&&e.status===403);
 let active=true;assert.equal(await mod.readReportedCommandEvidence(new ApiClient(async()=>{active=false;return Response.json(f.file());}),f.entry as any,f.selection,()=>active),null);
});
test('응답 headers 도착 뒤 JSON 처리 중 선택을 닫으면 원문을 반환하지 않는다',async()=>{
 const mod=await module(),f=fixture();let active=true,calls=0,release!:()=>void,entered!:()=>void;
 const waiting=new Promise<void>(resolve=>release=resolve),started=new Promise<void>(resolve=>entered=resolve);
 const client=new ApiClient(async()=>{
  calls++;const response=Response.json(f.file()),json=response.json.bind(response);
  response.json=async()=>{entered();await waiting;return json();};return response;
 });
 const reading=mod.readReportedCommandEvidence(client,f.entry as any,f.selection,()=>active);
 await started;active=false;release();assert.equal(await reading,null);assert.equal(calls,1);
});


test('최초 명령 근거 hash 대기 중 transport 교체는 후속 GET0',async()=>{
 const mod=await module(),f=fixture();let calls=0;const client=new ApiClient(async()=>{calls++;return Response.json(f.file());});
 const pending=mod.readReportedCommandEvidence(client,f.entry as any,f.selection,()=>true);client.transport=async()=>{calls++;return Response.json(f.file());};
 assert.equal((await pending)===null,true);assert.equal(calls,0);
});
for(const status of [200,401])test(`명령 근거 GET 대기 중 transport 교체는 이전 ${status}를 폐기`,async()=>{
 const mod=await module(),f=fixture();let finish!:(value:Response)=>void,enter!:()=>void,calls=0;const started=new Promise<void>(resolve=>enter=resolve);
 const client=new ApiClient(async()=>{calls++;enter();return new Promise<Response>(resolve=>finish=resolve);});
 const pending=mod.readReportedCommandEvidence(client,f.entry as any,f.selection,()=>true);await started;client.transport=async()=>{throw Error('UNEXPECTED_REQUEST');};
 finish(Response.json(status===200?f.file():{code:'AUTH_REQUIRED'},{status}));assert.equal((await pending)===null,true);assert.equal(calls,1);
});
test('명령 근거 이탈 뒤401은 폐기하고 현재401/403은 보존',async()=>{
 const mod=await module(),f=fixture();let active=true;const client=new ApiClient(async()=>{active=false;return Response.json({code:'AUTH_REQUIRED'},{status:401});});
 assert.equal(await mod.readReportedCommandEvidence(client,f.entry as any,f.selection,()=>active),null);active=true;
 for(const status of [401,403]){client.transport=async()=>Response.json({code:status===401?'AUTH_REQUIRED':'ACCESS_DENIED'},{status});await assert.rejects(mod.readReportedCommandEvidence(client,f.entry as any,f.selection,()=>active),(error:any)=>error instanceof ApiError&&error.status===status&&error.code===(status===401?'AUTH_REQUIRED':'ACCESS_DENIED'));}
});


test('명령 개별 evidence의 바이너리 보관 bytes는 기존 bounded 파일 GET으로 길이·SHA만 대조한다',async()=>{
 const mod=await module(),read=(mod as any).readReportedCommandEvidenceBytes;assert.equal(typeof read,'function','명시 보관 bytes 대조 reader 부재');const f=fixture(),bytes=new Uint8Array([0,255,128,1,0,254]);f.ref.contentHash=contentHash(bytes);f.evidence.contentHash=f.ref.contentHash;f.rehash();const calls:string[]=[];
 const value=await read(new ApiClient(async(path,options)=>{calls.push(String(path));assert.equal(options?.method,'GET');assert.equal((options?.headers as any).Accept,'application/octet-stream');return new Response(bytes,{headers:{'content-type':'application/octet-stream','content-length':String(bytes.byteLength)}});}),f.entry,f.selection,()=>true);
 assert(value);assert.equal(value.bytesState,'MATCHED_REGISTERED_BYTES');assert.deepEqual(value.file,{artifactRef:f.ref,bytes:bytes.byteLength,sha256:f.ref.contentHash});assert.deepEqual(calls,[`/api/v1/projects/${f.pid}/files/${f.ref.id}`]);assert.equal(JSON.stringify(value).includes('filename'),false);assert.equal('text' in value.file,false);
 for(const key of ['evidenceProvenanceVerified','commandExecutionVerified','commandExitVerified','completionAccepted','executionAuthorized','dispatchPerformed'])assert.equal(value[key],false);
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
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/session-detail/ReportedCommandEvidenceFiles.tsx',import.meta.url)),client=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url));
 const output:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:command-evidence',name:'CommandEvidenceTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'command-evidence-memory',resolveId(id){if(id.endsWith('virtual:command-evidence'))return '\0command-evidence';},load(id){if(id==='\0command-evidence')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{ReportedCommandEvidenceFiles}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(client)};export{React,createRoot,ReportedCommandEvidenceFiles,ApiClient};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(output)?output[0]:output).output.find((v:any)=>v.type==='chunk').code+';return CommandEvidenceTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});

async function mountEvidence(binary=true){
 const f=fixture(),bytes=binary?new Uint8Array([0,255,128,1,0,254]):new TextEncoder().encode(f.text);if(binary){f.ref.contentHash=contentHash(bytes);f.evidence.contentHash=f.ref.contentHash;f.rehash();}
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container),calls:string[]=[],signals:AbortSignal[]=[],unavailable:string[]=[];let parent=true,lost=0,hold=false,release:((v:Response)=>void)|null=null,shown=true,key=0;
 const response=()=>new Response(bytes,{headers:{'content-type':'application/octet-stream','content-length':String(bytes.byteLength)}});
 const transport=async(path:string,options:RequestInit)=>{assert.equal(options.method,'GET');calls.push(String(path));if(options.signal)signals.push(options.signal);if(hold)return new Promise<Response>(resolve=>release=resolve);return path.endsWith('/text')?Response.json(f.file()):response();},props:any={client:new ui.ApiClient(transport),result:f.entry,isCurrent:()=>parent,onAuthenticationLost:()=>lost++,onAccessUnavailable:(code:string)=>unavailable.push(code)};
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))],button=(label:string)=>{const b=nodes().filter(n=>n.tagName==='BUTTON'&&n.textContent===label);assert.equal(b.length,1,label);return b[0]!;},render=async()=>ui.React.act(async()=>root.render(shown?ui.React.createElement(ui.ReportedCommandEvidenceFiles,{...props,key}):null)),flush=async()=>ui.React.act(async()=>new Promise(r=>setImmediate(r))),wait=async(check:()=>boolean)=>{const end=Date.now()+2000;while(!check()&&Date.now()<end)await flush();assert(check(),container.textContent);},click=async(label:string)=>{const b=button(label);assert(!b.disabled,label);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));};
 await render();return{f,bytes,props,container,calls,signals,unavailable,nodes,button,render,flush,wait,click,response,lost:()=>lost,parent(value:boolean){parent=value;},held:()=>!!release,hold(){hold=true;},async finish(v:Response){assert(release);const send=release;release=null;hold=false;await ui.React.act(async()=>send(v));await flush();},async leave(mode:string){if(mode==='UNMOUNT')shown=false;if(mode==='OWNER')key++;if(mode==='RESULT')props.result=structuredClone(props.result);if(mode==='TRANSPORT')props.client.transport=transport.bind(null);await render();},async close(){await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
const bytesButton='명령 1 근거 1 보관 bytes 대조';
test('실제 명령 근거 UI는 바이너리 바이트의 길이·SHA만 명시 대조하고 텍스트·다운로드를 생성하지 않는다',{timeout:15000},async()=>{
 const f=await mountEvidence();try{assert.equal(f.calls.length,0);assert(f.nodes().some(n=>n.tagName==='BUTTON'&&n.textContent===bytesButton),'바이트 대조 UI 없음');await f.click(bytesButton);await f.wait(()=>f.container.textContent.includes('보관 bytes 길이 6'));assert(f.container.textContent.includes('SHA256 '+f.f.ref.contentHash));assert.equal(f.calls.length,1);assert(f.calls[0]!.endsWith('/files/'+f.f.ref.id));assert.equal(f.nodes().filter(n=>n.tagName==='A').length,0);assert(!f.container.textContent.includes('명령의 별도 근거'));await f.click('명령 근거 닫기');assert(!f.container.textContent.includes('보관 bytes 길이'));assert.equal(f.calls.length,1);assert.equal(f.lost(),0);}finally{await f.close();}
});


test('보관 bytes 대조는 실행 세대·manifest·선언 hash 교차에서 GET0이고 파일 hash/길이/한도를 거절한다',async()=>{
 const {readReportedCommandEvidenceBytes:read}=await module();
 for(const change of [(f:any)=>f.m.commandResults[0].executionRef={...f.entry.snapshot.scope.executionRef,version:2},(f:any)=>f.m.artifactRefs=[],(f:any)=>f.m.artifactRefs.push(f.ref),(f:any)=>f.m.artifactRefs[0]={...f.ref,contentHash:'f'.repeat(64)},(f:any)=>f.evidence.contentHash='f'.repeat(64)]){
  const f=fixture();change(f);f.rehash();let calls=0;const v=await read(new ApiClient(async()=>{calls++;assert.fail('교차 GET0');}),f.entry as any,f.selection,()=>true);assert(v);assert.equal(v.bytesState,'NOT_QUERIED_BINDING_MISMATCH');assert.equal(calls,0);
 }
 const crossed=fixture();crossed.m.assignmentRef={...crossed.a,version:2};crossed.rehash();await assert.rejects(read(new ApiClient(async()=>assert.fail('교차 임무 GET0')),crossed.entry as any,crossed.selection,()=>true));
 for(const mode of ['HASH','LENGTH','LIMIT','TYPE']){const f=fixture(),body=new TextEncoder().encode(f.text),headers={'content-type':mode==='TYPE'?'text/plain':'application/octet-stream','content-length':String(mode==='LIMIT'?20*1024*1024+1:mode==='LENGTH'?body.byteLength+1:body.byteLength)};if(mode==='HASH')body[0]=body[0]!^1;let calls=0;await assert.rejects(read(new ApiClient(async()=>{calls++;return new Response(body,{headers});}),f.entry as any,f.selection,()=>true),(e:any)=>e instanceof ApiError&&e.code==='RESULT_ARTIFACT_RESPONSE_INVALID');assert.equal(calls,1);}
});

test('보관 bytes의 pending 원 stream은 취소 1회 후 metadata·fallback을 반환하지 않는다',async()=>{
 const {readReportedCommandEvidenceBytes:read}=await module(),f=fixture(),cancel=new AbortController();let entered!:()=>void,cancels=0,calls=0;const started=new Promise<void>(resolve=>entered=resolve);
 const body=new ReadableStream<Uint8Array>({start(c){c.enqueue(new TextEncoder().encode(f.text));},pull(){entered();return new Promise(()=>{});},cancel(){cancels++;}});
 const pending=read(new ApiClient(async()=>{calls++;return new Response(body,{headers:{'content-type':'application/octet-stream'}});}),f.entry as any,f.selection,()=>true,cancel.signal);await started;cancel.abort();assert.equal(await pending,null);assert.equal(cancels,1);assert.equal(calls,1);
});

test('실제 명령 bytes UI의 현재401/403·hash 실패는 원문 fallback0이며 기존 text 선택은 유지한다',{timeout:15000},async()=>{
 const text=await mountEvidence(false);try{await text.click('명령 1 근거 1 원문 대조');await text.wait(()=>text.container.textContent.includes(text.f.text));assert(text.calls[0]!.endsWith('/text'));assert(!text.container.textContent.includes('보관 bytes 길이'));await text.click(bytesButton);await text.wait(()=>text.container.textContent.includes('보관 bytes 길이 '+text.bytes.byteLength));assert(text.calls[1]!.endsWith('/files/'+text.f.ref.id));assert(!text.container.textContent.includes(text.f.text));}finally{await text.close();}
 for(const mode of ['401','403','HASH']){const f=await mountEvidence();try{f.hold();await f.click(bytesButton);await f.wait(f.held);await f.finish(mode==='HASH'?new Response(new Uint8Array([9,9]),{headers:{'content-type':'application/octet-stream','content-length':'2'}}):Response.json({code:'PRIVATE_UNDISCLOSED'},{status:Number(mode)}));await f.wait(()=>f.container.textContent.includes('근거 미확인'));assert.equal(f.calls.length,1);assert(!f.calls[0]!.endsWith('/text'));assert(!f.container.textContent.includes('보관 bytes 길이'));assert.equal(f.lost(),mode==='401'?1:0);assert.equal(f.unavailable.length,mode==='HASH'?0:1);}finally{await f.close();}}
});

test('실제 명령 근거 scope/transport 교체는 기존 선택 자동GET0과 옛 클릭0을 유지한다',{timeout:15000},async()=>{
 for(const mode of ['RESULT','TRANSPORT','OWNER']){const f=await mountEvidence();try{await f.click(bytesButton);await f.wait(()=>f.container.textContent.includes('보관 bytes 길이'));const b=f.button(bytesButton),oldClick=(b as any)[Object.keys(b).find(k=>k.startsWith('__reactProps'))!].onClick,count=f.calls.length;await f.leave(mode);assert(!f.container.textContent.includes('보관 bytes 길이'));await f.flush();assert.equal(f.calls.length,count,'기존 선택 자동GET0');await ui.React.act(async()=>oldClick());assert.equal(f.calls.length,count,'옛 선택 callback GET0');await f.click(bytesButton);await f.wait(()=>f.container.textContent.includes('보관 bytes 길이'));assert.equal(f.calls.length,count+1);}finally{await f.close();}}
});

test('실제 명령 bytes GET의 close·scope·raw route/전달 ABA 뒤 late200/401은 metadata·인증효과0이다',{timeout:15000},async()=>{
 const names=['location','addEventListener','removeEventListener'] as const,descriptors=new Map(names.map(n=>[n,Object.getOwnPropertyDescriptor(globalThis,n)])),listeners=new Set<(e:any)=>void>(),location={hash:'#/projects/test/session'},route=location.hash,other='#/projects/test/approvals';
 Object.defineProperties(globalThis,{location:{value:location,configurable:true},addEventListener:{value:(name:string,fn:any)=>{assert.equal(name,'hashchange');listeners.add(fn);},configurable:true},removeEventListener:{value:(name:string,fn:any)=>{assert.equal(name,'hashchange');listeners.delete(fn);},configurable:true}});
 try{for(const mode of ['CLOSE','RESULT','TRANSPORT','OWNER','UNMOUNT','RAW','RENDER_ABA','EVENT_ABA'])for(const status of [200,401]){
  location.hash=route;const f=await mountEvidence();try{f.hold();await f.click(bytesButton);await f.wait(f.held);const count=f.calls.length;
   if(mode==='CLOSE')await f.click('명령 근거 닫기');else if(['RESULT','TRANSPORT','OWNER','UNMOUNT'].includes(mode))await f.leave(mode);else if(mode==='RAW')location.hash=other;else if(mode==='RENDER_ABA'){location.hash=other;await f.render();location.hash=route;await f.render();}else await ui.React.act(async()=>{location.hash=other;location.hash=route;for(const event of [{oldURL:'https://anvil.invalid'+route,newURL:'https://anvil.invalid'+other},{oldURL:'https://anvil.invalid'+other,newURL:'https://anvil.invalid'+route}])for(const fn of [...listeners])fn(event);});
   await f.finish(status===200?f.response():Response.json({code:'AUTH_REQUIRED'},{status:401}));assert.equal(f.calls.length,count,'다른 선택/원문 fallback0');assert.equal(f.lost(),0);assert.deepEqual(f.unavailable,[]);assert(!f.container.textContent.includes('보관 bytes 길이'));assert(!f.container.textContent.includes('AUTH_REQUIRED'));
  }finally{if(f.held())await f.finish(Response.json({}));await f.close();assert.equal(listeners.size,0,'listener cleanup');}
 }}finally{for(const name of names){const d=descriptors.get(name);if(d)Object.defineProperty(globalThis,name,d);else Reflect.deleteProperty(globalThis,name);}}
});


test('옛 명령 근거 닫기 callback은 새 선택·scope의 원 stream을 취소하거나 화면을 지우지 않는다',{timeout:15000},async()=>{
 for(const mode of ['SELECTION','RESULT','TRANSPORT']){const f=await mountEvidence();try{
  await f.click(bytesButton);await f.wait(()=>f.container.textContent.includes('보관 bytes 길이'));const b=f.button('명령 근거 닫기'),oldClose=(b as any)[Object.keys(b).find(k=>k.startsWith('__reactProps'))!].onClick;
  if(mode!=='SELECTION')await f.leave(mode);f.hold();await f.click(bytesButton);await f.wait(f.held);const signal=f.signals.at(-1)!;assert(signal);assert.equal(signal.aborted,false);const count=f.calls.length;
  await ui.React.act(async()=>oldClose());assert.equal(signal.aborted,false,'옛 close가 현재 요청을 abort하지 않음');assert.equal(f.calls.length,count);await f.finish(f.response());await f.wait(()=>f.container.textContent.includes('보관 bytes 길이'));assert.equal(f.lost(),0);assert.deepEqual(f.unavailable,[]);
 }finally{if(f.held())await f.finish(Response.json({}));await f.close();}}
});


test('같은 명령 근거 child props에서 부모 선택이 폐기되면 late200/401·옛 클릭/close0이고 새 명시 선택만 복구한다',{timeout:15000},async()=>{
 for(const status of [200,401]){const f=await mountEvidence();try{
  f.hold();await f.click(bytesButton);await f.wait(f.held);const button=f.button(bytesButton),close=f.button('명령 근거 닫기'),event=(b:MemoryNode)=>(b as any)[Object.keys(b).find(k=>k.startsWith('__reactProps'))!].onClick,oldClick=event(button),oldClose=event(close),count=f.calls.length,signal=f.signals.at(-1)!;
  f.parent(false);await ui.React.act(async()=>{oldClick();oldClose();});assert.equal(f.calls.length,count);assert.equal(signal.aborted,false,'폐기된 버튼은 현재 controller도 변경0');
  await f.finish(status===200?f.response():Response.json({code:'AUTH_REQUIRED'},{status:401}));assert.equal(f.lost(),0);assert.deepEqual(f.unavailable,[]);assert(!f.container.textContent.includes('보관 bytes 길이'));assert(!f.container.textContent.includes('AUTH_REQUIRED'));
  f.parent(true);await f.render();await f.flush();assert.equal(f.calls.length,count,'부모 복귀 자동 GET0');await ui.React.act(async()=>{oldClick();oldClose();});assert.equal(f.calls.length,count,'옛 owner callback 복귀0');await f.click(bytesButton);await f.wait(()=>f.container.textContent.includes('보관 bytes 길이'));assert.equal(f.calls.length,count+1);
 }finally{if(f.held())await f.finish(Response.json({}));await f.close();}}
});
