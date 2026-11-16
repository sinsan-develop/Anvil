import assert from 'node:assert/strict';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {stageDocumentFixture} from './stage-document-fixture.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

// UI06가 사용하는 RAM DOM의 이벤트·렌더링 표면만 제공한다.
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

const files=['DocumentEditor.tsx','NewStageDocumentForm.tsx','stage-document-draft.ts','form-document-outline.ts','editor-api.ts'];
const web=(p:string)=>fileURLToPath(new URL('../../../apps/web/src/'+p,import.meta.url));
let compiled:Promise<string>|undefined;
function bundle(){
 return compiled??=(async()=>{
  const exports=files.map((p,i)=>'export {'+['DocumentEditor','NewStageDocumentForm','prepareStageDocumentDraft','prepareStageFormOutline','editDocument'][i]+'} from '+JSON.stringify(web('features/design-trace/'+p))+';').join('\n');
  const result=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},
   build:{write:false,minify:false,lib:{entry:'virtual:prepared-stage',name:'StageTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},
   plugins:[{name:'prepared-stage',resolveId(id){if(id.endsWith('virtual:prepared-stage'))return '\0prepared-stage';},load(id){if(id==='\0prepared-stage')return exports+"import * as React from 'react';export {React};export {createRoot} from 'react-dom/client';export {ApiClient} from "+JSON.stringify(web('api/client.ts'))+";";}}]});
  const output=Array.isArray(result)?result[0]:result;
  assert.ok(output&&'output' in output);
  const chunk=output.output.find(o=>o.type==='chunk');
  assert.ok(chunk&&chunk.type==='chunk');return chunk.code+';return StageTest;';
 })();
}
async function mount(){
 const code=await bundle(),saved=new Map<string,PropertyDescriptor|undefined>(),channels:MessageChannel[]=[];
 const document:any=new MemoryNode('#document',9);document.ownerDocument=document;
 document.createElement=(name:string)=>new MemoryNode(name,1,document);
 document.createElementNS=(_ns:string,name:string)=>document.createElement(name);
 document.createTextNode=(text:string)=>{const n=new MemoryNode('#text',3,document);n.data=text;return n;};
 document.documentElement=document.createElement('html');document.body=document.createElement('body');document.documentElement.appendChild(document.body);document.activeElement=document.body;
 const window={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,getComputedStyle:()=>({})};document.defaultView=window;
 const Native=globalThis.MessageChannel;class OwnedChannel extends Native{constructor(){super();channels.push(this);}}
 for(const[k,v]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,MessageChannel:OwnedChannel,IS_REACT_ACT_ENVIRONMENT:true})){
  saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
 }
 const ui=new Function(code)(),container=document.createElement('main'),root=ui.createRoot(container);
 document.body.appendChild(container);
 const f=stageDocumentFixture(),node=f.application.snapshot.graph.nodes[0]!;
 node.outputs[0]!.itemId=f.form.definition.items[0]!.itemId;
 node.outputs.push({...node.outputs[0]!,itemId:'METHOD_ARTIFACT_B'});
 f.application.snapshot.sourceRef.contentHash=contentHash(canonicalJson(f.application.snapshot.graph));
 f.choice.applicationRef.contentHash=contentHash(canonicalJson(f.application.snapshot));
 const choice={...f.choice,itemId:'METHOD_ARTIFACT_B'};
 const calls:string[]=[];let intercept:((path:string,init:any)=>Promise<Response|null>)|undefined;
 const transport=async(url:string,init:any)=>{
  const path=String(url);calls.push(path);const answer=await intercept?.(path,init);if(answer)return answer;
  assert.equal(init.method,'GET');
  return Response.json(path.includes('/methodology-application')?f.application:path.includes('/stage-options')?f.options:path.includes('/forms/')?f.form:f.project);
 };
 const client=new ui.ApiClient(transport);
 let buffer:any,replace:any,props:any={client,session:f.session},mode:'editor'|'form'='editor',prepared=0,lost=0,saves=0;
 function Host(){const [b,set]=ui.React.useState(buffer);buffer=b;replace=set;
  if(mode==='form')return ui.React.createElement(ui.NewStageDocumentForm,{...props,projectId:f.projectId,onPrepared:()=>prepared++,onBack:()=>{},onAuthenticationLost:()=>lost++});
  return ui.React.createElement(ui.DocumentEditor,{...props,buffer:b,onChange:set,onSaved:()=>saves++,onAuthenticationLost:()=>lost++});
 }
 const render=async()=>ui.React.act(async()=>root.render(ui.React.createElement(Host)));
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))];
 function event(node:MemoryNode,name:string,arg:unknown){const key=Object.keys(node).find(k=>k.startsWith('__reactProps$'));assert.ok(key);return (node as any)[key][name](arg);}
 const button=(part:string)=>{const n=nodes().find(n=>n.tagName==='BUTTON'&&n.textContent.includes(part));assert.ok(n,part);return n;};
 const marker=()=>container.textContent.includes('저장 전 선택한 산출물 METHOD_ARTIFACT_B · 서버 귀속 미확인');
 return {ui,f,client,choice,calls,transport,props,render,nodes,button,event,marker,container,
  state:()=>buffer,initial:(v:any)=>{buffer=v;},replace:(v:any)=>ui.React.act(async()=>replace(v)),
  form:()=>{mode='form';},counts:()=>({prepared,lost,saves}),hook:(fn:typeof intercept)=>{intercept=fn;},
  async close(){try{await ui.React.act(async()=>root.unmount());}finally{
    for(const c of channels){c.port1.close();c.port2.close();}
    for(const[k,v]of saved){if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);}
  }}};
}
test('원 B 표식을 별도 초안의 첫 화면에 이식해도 표시하지 않는다',async()=>{
 const h=await mount();try{
  const original=await h.ui.prepareStageDocumentDraft(h.client,h.choice,h.f.session,()=>true);
  const other=await h.ui.prepareStageDocumentDraft(h.client,{...h.choice,itemId:h.f.form.definition.items[0]!.itemId},h.f.session,()=>true);
  other.preparedStageOutput=original.preparedStageOutput;
  h.initial(other);await h.render();assert.equal(h.marker(),false);
  assert.equal(h.state().preparedStageOutput,undefined);
 }finally{await h.close();}
});
test('선택 항목과 적용본·양식 참조를 수정해 다른 선택으로 표시할 수 없다',async()=>{
 const h=await mount();try{
  const original=await h.ui.prepareStageDocumentDraft(h.client,h.choice,h.f.session,()=>true);
  const s=original.preparedStageOutput;
  assert.equal(Reflect.set(s,'itemId','METHOD_ARTIFACT_A'),false);
  assert.equal(Reflect.set(s.applicationRef,'version',3),false);
  assert.equal(Reflect.set(s.formRef,'contentHash','0'.repeat(64)),false);
  h.initial(original);await h.render();assert.ok(h.marker());
 }finally{await h.close();}
});
test('표식 복사와 원 버퍼의 선택 제거·복귀가 폐기된 표시를 되살리지 않는다',async()=>{
 const h=await mount();try{
  const original=await h.ui.prepareStageDocumentDraft(h.client,h.choice,h.f.session,()=>true);
  const marker=original.preparedStageOutput;
  h.initial(original);await h.render();assert.ok(h.marker());
  delete original.preparedStageOutput;await h.render();assert.equal(h.marker(),false);
  original.preparedStageOutput=marker;await h.render();assert.equal(h.marker(),false);
  const next=await h.ui.prepareStageDocumentDraft(h.client,h.choice,h.f.session,()=>true);
  next.preparedStageOutput=structuredClone(next.preparedStageOutput);await h.replace(next);
  assert.equal(h.marker(),false);assert.equal(h.state().preparedStageOutput,undefined);
 }finally{await h.close();}
});
for(const outline of [false,true])test((outline?'작성틀':'빈 초안')+' B만 표시하고 입력 편집 후 보존, API client ABA 뒤 폐기',async()=>{
 const h=await mount();try{
  const b=await (outline?h.ui.prepareStageFormOutline:h.ui.prepareStageDocumentDraft)(h.client,h.choice,h.f.session,()=>true);
  h.initial(b);await h.render();assert.ok(h.marker());if(outline)assert.equal(b.content.sections[0].itemId,h.f.form.definition.items[0]!.itemId);
  const title=h.nodes().find(n=>n.tagName==='INPUT'&&n.getAttribute('maxlength')==='200')??h.nodes().find(n=>n.tagName==='INPUT'&&n.parentNode?.textContent.startsWith('문서 제목'));
  const body=h.nodes().find(n=>n.tagName==='TEXTAREA'&&n.getAttribute('id')==='document-body-null');
  assert.ok(title&&body);
  await h.ui.React.act(async()=>h.event(title,'onChange',{target:{value:'제목'}}));
  await h.ui.React.act(async()=>h.event(body,'onChange',{target:{value:'본문'}}));
  assert.equal(h.state().body,'본문');assert.ok(h.marker());
  h.props.client=new h.ui.ApiClient(h.transport);await h.render();
  assert.equal(h.marker(),false);assert.equal(h.state().preparedStageOutput,undefined);
  h.props.client=h.client;await h.render();assert.equal(h.marker(),false);assert.equal(h.state().title,'제목');
 }finally{await h.close();}
});
for(const status of [200,401])test('오래된 준비 응답 '+status+'은 주체 ABA 이후 준비나 인증 소실을 표시하지 않는다',async()=>{
 const h=await mount();try{
  h.form();await h.render();await h.ui.React.act(async()=>h.event(h.button('적용 단계의 산출문서 조회'),'onClick',{}));
  const deadline=Date.now()+3000;
  while(!h.nodes().some(n=>n.tagName==='SELECT')&&Date.now()<deadline){
   await h.ui.React.act(async()=>new Promise<void>(resolve=>setImmediate(resolve)));
  }
  const select=h.nodes().find(n=>n.tagName==='SELECT');assert.ok(select,h.container.textContent);
  await h.ui.React.act(async()=>h.event(select,'onChange',{target:{value:'1'}}));
  let resolve!:(v:Response)=>void;const wait=new Promise<Response>(r=>{resolve=r;});
  h.hook(async()=>wait);
  await h.ui.React.act(async()=>{h.event(h.button('빈 초안 준비'),'onClick',{});});
  h.props.session={...h.f.session,clientId:h.f.projectId};await h.render();
  h.props.session=h.f.session;await h.render();
  await h.ui.React.act(async()=>resolve(Response.json(status===401?{code:'AUTHENTICATION_REQUIRED'}:h.f.project,{status})));
  assert.deepEqual(h.counts(),{prepared:0,lost:0,saves:0});assert.equal(h.calls.length,3);
 }finally{await h.close();}
});
async function waitFor(h:Awaited<ReturnType<typeof mount>>,predicate:()=>boolean){
 const deadline=Date.now()+3000;
 while(!predicate()&&Date.now()<deadline)await h.ui.React.act(async()=>new Promise<void>(r=>setImmediate(r)));
 assert.ok(predicate(),h.container.textContent);
}
for(const status of [409,503,200,'OTHER_ITEM'] as const)test('저장 결과 '+status+' 뒤 준비 표식을 폐기하고 영수증을 검산한다',async()=>{
 const h=await mount();try{
  const b=await h.ui.prepareStageDocumentDraft(h.client,h.choice,h.f.session,()=>true);
  Object.assign(b,{title:'입력 제목',body:'입력 본문',reason:'저장 사유'});h.initial(b);await h.render();assert.ok(h.marker());
  const sent:string[]=[];
  h.hook(async(_path,init)=>{
   if(init.method!=='POST')return null;
   const headers=new Headers(init.headers);
   const packet=JSON.parse(headers.get('X-Anvil-Command')??String(init.body));sent.push(packet.operation);
   const reply={operationId:h.f.userId,commandId:packet.commandId,projectId:h.f.projectId,status:'APPLIED',serverReceivedAt:'2026-11-16T00:00:00Z'};
   if(packet.operation==='uploadArtifact')return Response.json({...reply,targetId:h.f.clientId,version:null,data:{status:'ARTIFACT_READY',artifactRef:{artifactId:h.f.clientId,...packet.payload}}});
   assert.equal(packet.operation,'saveDocumentDraft');assert.deepEqual(packet.payload.stageOutputItem,{applicationRef:h.choice.applicationRef,itemId:h.choice.itemId});
   if(status===409||status===503)return Response.json({code:status===409?'VERSION_CONFLICT':'SERVICE_UNAVAILABLE'},{status});
   const {title,formRef,stageNodeRef,content}=packet.payload;
   const ref={id:h.f.clientId,version:1,contentHash:contentHash(canonicalJson({title,formRef,stageNodeRef,content}))};
   return Response.json({...reply,targetId:ref.id,version:1,data:{status:'DRAFT',ref,stageOutputItem:status==='OTHER_ITEM'?{...packet.payload.stageOutputItem,itemId:'A'}:packet.payload.stageOutputItem}});
  });
  await h.ui.React.act(async()=>{h.event(h.button('새 초안 버전 저장'),'onClick',{});});
  await waitFor(h,()=>!!(h.state().failure||h.state().savedRef));
  assert.deepEqual(sent,['uploadArtifact','saveDocumentDraft']);assert.equal(h.marker(),false);
  assert.equal(h.state().preparedStageOutput,undefined);assert.equal(h.state().body,'입력 본문');
  assert.deepEqual(h.state().stageNodeRef,b.stageNodeRef);
  if(status==='OTHER_ITEM'){assert.equal(h.state().failure.code,'RESPONSE_INVALID');assert.equal(h.state().savedRef,null);assert.equal(h.counts().saves,0);}
  else if(status===200){assert.deepEqual(h.state().stageOutputItem,{applicationRef:h.choice.applicationRef,itemId:h.choice.itemId});assert.equal(h.state().savedRef.version,1);assert.equal(h.state().pending,null);assert.equal(h.counts().saves,1);}
  else{assert.equal(h.state().failure.status,status);assert.ok(h.state().pending.save);assert.equal(h.state().saveUncertain,status===503);}
 }finally{await h.close();}
});
test('교체된 버퍼와 달라진 단계·양식·프로젝트·고정 버전에 선택을 이식하지 않는다',async()=>{
 const h=await mount();try{
  let prior:any;
  for(const change of ['buffer','stage','form','project','version']){
   const original=await h.ui.prepareStageDocumentDraft(h.client,h.choice,h.f.session,()=>true);
   if(!prior){h.initial(original);await h.render();}else await h.replace(original);
   assert.ok(h.marker());
   let next={...original};
   if(change==='stage')next.stageNodeRef={...next.stageNodeRef,nodeId:'OTHER'};
   if(change==='form')next.formRef={...next.formRef,version:3};
   if(change==='project')next.projectId=h.f.userId;
   if(change==='version'){
    const document={id:h.f.clientId,version:1,contentHash:'a'.repeat(64),title:'고정 원문',stageNodeRef:null,formRef:original.formRef,
     content:{...original.content,body:{mediaType:original.mediaType}},contentReviewCriteria:{items:original.criteria}};
    next=h.ui.editDocument(h.f.projectId,{document,body:'조회한 원문'},h.f.userId,original.controlGeneration);
    assert.equal(next.preparedStageOutput,undefined);
   }
   await h.replace(next);assert.equal(h.marker(),false);assert.equal(h.state().preparedStageOutput,undefined);
   await h.replace(original);assert.equal(h.marker(),false);prior=original;
  }
 }finally{await h.close();}
});
