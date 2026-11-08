import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {buildOfficialForms} from '../../../apps/server/modules/documents/forms.ts';
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

const id=(n:number)=>'a6f80000-0000-4000-8000-'+String(n).padStart(12,'0'),pid=id(1),uid=id(2),cid=id(3),did=id(4),aid=id(5),at='2026-11-08T00:00:00.000Z';
const session={user:{id:uid},clientId:cid,csrfToken:'C'.repeat(43)};
const sources=[{kind:'DOCUMENT_VERSION',id:id(6),version:1,contentHash:'a'.repeat(64)},{kind:'CONVERSATION',id:id(7),contentHash:'b'.repeat(64)},{kind:'USER_INSTRUCTION',id:id(8),contentHash:'c'.repeat(64)},{kind:'ARTIFACT',id:id(9),contentHash:'d'.repeat(64)}];
const forms=buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md',import.meta.url)),await readFile(new URL('../../../docs/design/문서작성_공통기준.md',import.meta.url)));
let bundled:Promise<string>;
function bundle(){return bundled??=Promise.resolve().then(async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/project-create/ProjectBaselinePanel.tsx',import.meta.url)),api=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)),baseline=fileURLToPath(new URL('../../../apps/web/src/features/project-create/baseline-api.ts',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:baseline-screen',name:'BaselineScreenTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'baseline-screen-memory-entry',resolveId(id){if(id.endsWith('virtual:baseline-screen'))return '\0baseline-screen';},load(id){if(id==='\0baseline-screen')return `import * as React from 'react';import{createRoot}from'react-dom/client';export{React,createRoot};export{ProjectBaselinePanel}from${JSON.stringify(entry)};export{ApiClient}from${JSON.stringify(api)};export*from${JSON.stringify(baseline)};`;}}]});
 const code=(Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code;return code+';return BaselineScreenTest;';
});}
const reply=(v:unknown,status=200)=>Response.json(v,{status});
// common-setup-screen의 MemoryNode/가상entry/채널회수 선례를 지역 재사용한다.
// 인증·프로젝트·문서·baseline 저장 응답은 합성이며 실제 Panel/Picker/API validator를 우회하지 않는다.
async function mount(refs:any[]=sources){
 const code=await bundle(),saved=new Map<string,PropertyDescriptor|undefined>(),channels:MessageChannel[]=[];
 const document:any=new MemoryNode('#document',9);document.ownerDocument=document;document.createElement=(n:string)=>new MemoryNode(n,1,document);document.createElementNS=(_ns:string,n:string)=>document.createElement(n);document.createTextNode=(s:string)=>{const n=new MemoryNode('#text',3,document);n.data=s;return n;};document.documentElement=document.createElement('html');document.body=document.createElement('body');document.documentElement.appendChild(document.body);document.activeElement=document.body;
 const window={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,getComputedStyle:()=>({})};document.defaultView=window;
 const Native=globalThis.MessageChannel;class OwnedChannel extends Native{constructor(){super();channels.push(this);}}
 let ui:any,root:any,released=false;
 const release=async()=>{if(released)return;released=true;const errors:unknown[]=[],ports=channels.flatMap(c=>[c.port1,c.port2]);
  const settled=await Promise.allSettled(ports.map(port=>new Promise<void>(resolve=>(port as any).close(resolve))));for(const r of settled)if(r.status==='rejected')errors.push(r.reason);
  for(const[k,v]of saved)try{if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,k),v);}catch(e){errors.push(e);}
  for(const port of ports)try{assert.equal((port as any).hasRef(),false);}catch(e){errors.push(e);}if(errors.length)throw new AggregateError(errors,'MEMORY_RESOURCE_CLEANUP_FAILED');
 };
 try{
 for(const[k,v]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,MessageChannel:OwnedChannel,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});}
 ui=new Function(code)();const container=document.createElement('main');document.body.appendChild(container);root=ui.createRoot(container);
 const form=forms.forms.find(f=>f.definition.formCode==='AF02')!,body='# 출처가 있는 기준 설계',content={body:{artifactId:aid,bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/markdown;charset=utf-8'},attachments:[],sections:[],sourceRefs:structuredClone(refs)};
 const doc={id:did,version:2,title:'선택할 AF02 설계',formRef:form.ref,stageNodeRef:null,content,sourceRefs:structuredClone(refs),contentHash:contentHash(canonicalJson({title:'선택할 AF02 설계',formRef:form.ref,stageNodeRef:null,content})),confirmed:false,validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef:form.ref,items:[]},contentReviews:[]};
 const project={id:pid,name:'합성 프로젝트',purpose:'기준선 화면 검수',desiredOutcome:'명시 선택',version:1,createdAt:at,updatedAt:at,currentMethodologyRef:null,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[],viewerPermissions:['READ_PROJECT'],participation:'OWNER',controlState:{actorId:uid,clientId:cid,generation:3,status:'HELD'}};
 let current:any,external:any,settings={session:{...session,user:{...session.user}},projectId:pid},auth=0,lost=false,rejectApply=false,hook:((kind:string,v:any)=>any|Promise<any>)|null=null,closed=false;
 const calls:{path:string;method:string;packet?:any}[]=[],unexpected:string[]=[];
 const transport=async(url:any,init:any)=>{const path=String(url),method=init?.method??'GET';calls.push({path,method});assert.equal(init?.credentials,'same-origin');assert.equal(init?.redirect,'error');assert.equal(init?.cache,'no-store');const emit=async(kind:string,value:any)=>{const changed=hook?await hook(kind,value):value;return changed instanceof Response?changed:kind==='body'?new Response(Buffer.from(changed),{headers:{'content-type':'application/octet-stream'}}):reply(changed);};
  if(method==='GET'){
   if(path==='/api/v1/projects/'+pid)return emit('project',project);
   if(path===`/api/v1/projects/${pid}/documents?limit=50`)return emit('list',{items:[{id:did,title:doc.title,headVersion:2,confirmedVersion:null,updatedAt:at}],hasMore:false,nextCursor:null,observedAt:at});
   if(path===`/api/v1/projects/${pid}/documents/${did}/versions/2`)return emit('document',doc);
   if(path===`/api/v1/projects/${pid}/files/${aid}`)return emit('body',body);
   if(path===`/api/v1/forms/${form.ref.id}/versions/${form.ref.version}`)return emit('form',{...form,authoringStandard:{ref:forms.standard.ref,content:forms.standard.body.toString('utf8')},validation:{formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'}});
  }
  if(method==='POST'&&path===`/api/v1/projects/${pid}/commands`){const packet=JSON.parse(init.body);calls.at(-1)!.packet=packet;assert.deepEqual(Object.keys(packet).sort(),['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'].sort());assert.equal(packet.operation,'saveBaselineDraft');assert.equal(packet.projectId,pid);assert.equal(packet.clientId,cid);assert.equal(packet.controlGeneration,3);assert.equal(packet.targetId,null);assert.equal(packet.expectedVersion,0);assert.deepEqual(packet.baselineRefs,[]);assert.equal(packet.approvalRef,null);assert.equal(init.headers['X-Anvil-CSRF'],session.csrfToken);assert.equal(init.headers['Idempotency-Key'],packet.commandId);assert.match(packet.commandId,/^[0-9a-f-]{36}$/);
   if(lost){lost=false;throw Error('합성 응답 유실');}
   const input=structuredClone(packet.payload),snapshot={schemaVersion:1,input,sourceBinding:{kind:input.source.kind,declaration:null,observation:null,declarationReportRelation:'UNVERIFIED'},evidenceBindings:input.items.map((i:any)=>({itemId:i.itemId,evidenceRefs:i.evidenceRefs})),issues:[{code:'CONTENT_REVIEW_REQUIRED',location:'items'},{code:'SOURCE_UNVERIFIED',location:'source'},{code:'COVERAGE_UNVERIFIED',location:'coverageReason'},{code:'EXECUTION_NOT_CONNECTED',location:'execution'}],recordedBy:{kind:'HUMAN',userId:uid},recordedAt:at,contentConfirmed:false,sourceAuthorizationVerified:false,coverageVerified:false,executionAuthorized:false,dispatchPerformed:false};
   const ref={id:id(80),version:1,contentHash:contentHash(canonicalJson(snapshot))};return emit('receipt',{operationId:id(81),commandId:packet.commandId,projectId:pid,status:'APPLIED',targetId:ref.id,version:1,data:{status:'BASELINE_DRAFT_STORED',ref,snapshot},serverReceivedAt:at});
  }
  unexpected.push(method+' '+path);throw Error('UNMODELED_BASELINE_SCREEN_REQUEST');
 };
 const client=new ui.ApiClient(transport);
 const initial=()=>{const b=ui.newBaselineBuffer(pid,session,3,null);b.input={baseRef:null,source:{kind:'NONE_SELECTED',declarationRef:null,sourceRootRef:null,snapshotRef:null,grantRef:null,unverifiedReason:'관측하지 않았다'},items:[{itemId:'F1',title:'명시 기능',designRef:null,featureState:'PARTIAL',evidenceRefs:[],limitations:'나머지 미확인',reason:'사람 분류'},{itemId:'F2',title:'보존할 기능',designRef:{id:id(90),version:1,contentHash:'f'.repeat(64)},featureState:'NOT_IMPLEMENTED',evidenceRefs:[],limitations:'미구현',reason:'대기'}],coverageReason:'범위 미확인',reason:'명시 기준선'};return b;};
 function Harness(){const[b,setB]=ui.React.useState(initial),[view,setView]=ui.React.useState(settings);current=b;external={setB,setView};return ui.React.createElement(ui.ProjectBaselinePanel,{client,projectId:view.projectId,session:view.session,buffer:b,onChange:(edit:any)=>setB((previous:any)=>{const next=typeof edit==='function'?edit(previous):edit;return rejectApply&&next?.input?.items[0]?.designRef&&!previous?.input?.items[0]?.designRef?previous:next;}),onAuthenticationLost:()=>{auth++;}});}
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))],buttons=(text:string)=>nodes().filter(n=>n.tagName==='BUTTON'&&n.textContent===text),flush=()=>ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});
 const wait=async(check:()=>boolean)=>{for(let i=0;i<180&&!check();i++)await flush();assert.ok(check(),container.textContent);};
 const click=async(text:string,index=0)=>{const b=buttons(text)[index];assert.ok(b,text);assert.equal(b.disabled,false,text);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const close=async()=>{if(closed)return;closed=true;const errors:unknown[]=[];try{if(root)await ui.React.act(async()=>root.unmount());root=null;}catch(e){errors.push(e);}try{await release();}catch(e){errors.push(e);}try{assert.deepEqual(unexpected,[]);}catch(e){errors.push(e);}if(errors.length)throw new AggregateError(errors,'MEMORY_SCREEN_CLOSE_FAILED');};
 try{await ui.React.act(async()=>root.render(ui.React.createElement(Harness)));await wait(()=>!!buttons('설계 문서 선택')[0]&&!buttons('설계 문서 선택')[0]!.disabled);}catch(e){await close();throw e;}
 return{client,doc,project,body,calls,nodes,buttons,click,wait,flush,get buffer(){return current;},get auth(){return auth;},setHook:(h:typeof hook)=>{hook=h;},lose:()=>{lost=true;},rejectApply:()=>{rejectApply=true;},setBuffer:async(fn:any)=>ui.React.act(async()=>external.setB(fn)),rerender:async(v:Partial<typeof settings>)=>{settings={...settings,...v};await ui.React.act(async()=>external.setView(settings));},unmount:async()=>{if(root)await ui.React.act(async()=>root.unmount());root=null;},close};
 }catch(error){const errors:unknown[]=[error];try{if(root&&ui)await ui.React.act(async()=>root.unmount());}catch(e){errors.push(e);}try{await release();}catch(e){errors.push(e);}if(errors.length>1)throw new AggregateError(errors,'MEMORY_SCREEN_SETUP_FAILED');throw error;}
}
async function preview(h:Awaited<ReturnType<typeof mount>>){await h.click('설계 문서 선택');await h.wait(()=>!!h.buttons('설계 후보: 선택할 AF02 설계')[0]);await h.click('설계 후보: 선택할 AF02 설계');await h.click('설계 원문·양식 확인');await h.wait(()=>!!h.buttons('확인한 설계 버전 연결')[0]);}
async function select(h:Awaited<ReturnType<typeof mount>>){await preview(h);await h.click('확인한 설계 버전 연결');await h.wait(()=>!!h.buffer.input.items[0].designRef);}
test('실제 Panel→Picker의 4종 출처 선택은 부모에 root1만 commit하고 명시저장 POST1/strict결과로 완료한다',async()=>{
 for(const refs of [...sources.map(r=>[r]),sources]){const h=await mount(refs);try{const before=structuredClone(h.buffer.input.items);await select(h);const root={id:did,version:2,contentHash:h.doc.contentHash};assert.deepEqual(h.buffer.input.items[0].designRef,root);assert.deepEqual({...h.buffer.input.items[0],designRef:null},before[0]);assert.deepEqual(h.buffer.input.items[1],before[1]);assert.equal(h.calls.filter(c=>c.method==='POST').length,0);await h.click('초안 저장 · 미확정');await h.wait(()=>!!h.buffer.saved&&!h.buffer.pending&&!h.buffer.dirty);assert.deepEqual(h.buffer.saved.snapshot.input.items[0].designRef,root);assert.equal(h.buffer.saved.snapshot.executionAuthorized,false);const writes=h.calls.filter(c=>c.method==='POST');assert.equal(writes.length,1);assert.deepEqual(writes[0]!.packet.payload,h.buffer.saved.snapshot.input);}finally{await h.close();}}
});

test('403과 hash-valid 출처오염·본문/양식변조는 원 연결을 보존하고 새 적용/POST0이다',async()=>{
 for(const mode of ['403','SOURCE','BODY','FORM']){const h=await mount();try{await select(h);const before=h.buffer,formGets=h.calls.filter(c=>c.path.includes('/forms/')).length;h.setHook((kind,v)=>{
   if(mode==='403'&&kind==='document')return reply({code:'ACCESS_DENIED'},403);
   if(mode==='SOURCE'&&kind==='document'){const content={...v.content,sourceRefs:[{...sources[0],kind:'REMOTE_FILE'}]};return{...v,content,sourceRefs:content.sourceRefs,contentHash:contentHash(canonicalJson({title:v.title,formRef:v.formRef,stageNodeRef:null,content}))};}
   if(mode==='BODY'&&kind==='body')return '변조된 원문';
   if(mode==='FORM'&&kind==='form')return{...v,definition:{...v.definition,formCode:'AF01'}};return v;
  });await h.click('설계 문서 선택');await h.wait(()=>!!h.buttons('설계 후보: 선택할 AF02 설계')[0]);await h.click('설계 후보: 선택할 AF02 설계');await h.click('설계 원문·양식 확인');await h.wait(()=>h.nodes().some(n=>n.getAttribute('role')==='alert'));assert.equal(h.buttons('확인한 설계 버전 연결').length,0);assert.equal(h.buffer===before,true);assert.equal(h.calls.filter(c=>c.method==='POST').length,0);if(mode==='403'||mode==='SOURCE')assert.equal(h.calls.filter(c=>c.path.includes('/forms/')).length,formGets);
 }finally{await h.close();}}
});
test('metadata/body/form 대기중 새buffer·다른owner/client는 늦은원문/적용·후속GET0이다',async()=>{
 for(const [stage,mode]of [['document','BUFFER'],['body','OWNER'],['form','CLIENT']] as const){const h=await mount();let release!:(v:any)=>void;try{let entered=false;h.setHook((kind,v)=>kind===stage?(entered=true,new Promise<any>(r=>{release=r;})):v);await h.click('설계 문서 선택');await h.wait(()=>!!h.buttons('설계 후보: 선택할 AF02 설계')[0]);await h.click('설계 후보: 선택할 AF02 설계');await h.click('설계 원문·양식 확인');await h.wait(()=>entered);
  if(mode==='BUFFER')await h.setBuffer((b:any)=>({...b,bindingId:crypto.randomUUID(),input:{...b.input,reason:'다른 초안'}}));
  else if(mode==='OWNER')await h.rerender({session:{...session,user:{id:id(99)}}});
  else await h.rerender({session:{...session,clientId:id(99)}});
  const count=h.calls.length;release(stage==='document'?h.doc:stage==='body'?h.body:reply({code:'AUTH_REQUIRED'},401));await h.flush();await h.flush();assert.equal(h.buttons('확인한 설계 버전 연결').length,0);assert.equal(h.nodes().some(n=>n.getAttribute('aria-label')==='연결할 설계 원문'),false);assert.equal(h.calls.length,count);assert.equal(h.calls.filter(c=>c.method==='POST').length,0);assert.equal(h.buffer.input.items[0].designRef,null);assert.equal(h.auth,0);
 }finally{release?.(reply({},401));await h.close();}}
});
test('실제 Picker unmount는 늦은metadata의 본문 GET과 인증callback을 만들지 않는다',async()=>{
 const h=await mount();let release!:(v:any)=>void;try{let entered=false;h.setHook((kind,v)=>kind==='document'?(entered=true,new Promise<any>(r=>{release=r;})):v);await h.click('설계 문서 선택');await h.wait(()=>!!h.buttons('설계 후보: 선택할 AF02 설계')[0]);await h.click('설계 후보: 선택할 AF02 설계');await h.click('설계 원문·양식 확인');await h.wait(()=>entered);await h.unmount();const count=h.calls.length;release(reply({code:'AUTH_REQUIRED'},401));await h.flush();await h.flush();assert.equal(h.calls.length,count);assert.equal(h.auth,0);assert.equal(h.calls.filter(c=>c.method==='POST').length,0);}finally{release?.(reply({},401));await h.close();}
});
test('선택 부모CAS 거절은 연결성공을 표시하지 않고 현재제어 교체도 명시저장 POST0이다',async()=>{
 const h=await mount();try{const before=h.buffer;h.rejectApply();await preview(h);await h.click('확인한 설계 버전 연결');await h.flush();assert.equal(h.buffer===before,true);assert.equal(h.buffer.input.items[0].designRef,null);assert.equal(h.buttons('확인한 설계 버전 연결').length,0);assert.equal(h.calls.filter(c=>c.method==='POST').length,0);}finally{await h.close();}
 const g=await mount();try{await select(g);const ref=structuredClone(g.buffer.input.items[0].designRef);g.setHook((kind,v)=>kind==='project'?{...v,controlState:{...v.controlState,generation:4}}:v);await g.click('초안 저장 · 미확정');await g.wait(()=>g.nodes().some(n=>n.getAttribute('role')==='alert'));assert.deepEqual(g.buffer.input.items[0].designRef,ref);assert.equal(g.buffer.saved,null);assert.equal(g.calls.filter(c=>c.method==='POST').length,0);}finally{await g.close();}
});
test('저장응답 유실은 원packet UNKNOWN·자동POST0이며 명시 재확인만 동일UUID/body로 완료한다',async()=>{
 const h=await mount();try{await select(h);h.lose();await h.click('초안 저장 · 미확정');await h.wait(()=>!!h.buffer.pending&&h.buffer.uncertain&&h.buffer.failure?.code==='CONNECTION_LOST');const packet=structuredClone(h.buffer.pending);assert.equal(h.buffer.saved,null);assert.equal(h.calls.filter(c=>c.method==='POST').length,1);await h.flush();assert.equal(h.calls.filter(c=>c.method==='POST').length,1);await h.click('동일 원명령 재확인');await h.wait(()=>!!h.buffer.saved&&!h.buffer.pending);assert.equal(h.calls.filter(c=>c.method==='POST').length,2);assert.deepEqual(h.calls.filter(c=>c.method==='POST')[1]!.packet,packet);assert.equal(h.buffer.uncertain,false);}finally{await h.close();}
});
test('strict 저장결과의 true 권위표식은 saved로 채택하지 않고 원pending/UNKNOWN을 보존한다',async()=>{
 const h=await mount();try{await select(h);h.setHook((kind,v)=>{if(kind!=='receipt')return v;const snapshot={...v.data.snapshot,executionAuthorized:true};return{...v,data:{...v.data,snapshot,ref:{...v.data.ref,contentHash:contentHash(canonicalJson(snapshot))}}};});await h.click('초안 저장 · 미확정');await h.wait(()=>h.buffer.failure?.code==='RESPONSE_INVALID');assert.equal(h.buffer.saved,null);assert.ok(h.buffer.pending);assert.equal(h.buffer.uncertain,true);assert.equal(h.calls.filter(c=>c.method==='POST').length,1);}finally{await h.close();}
});
