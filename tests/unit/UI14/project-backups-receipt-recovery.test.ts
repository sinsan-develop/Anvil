import assert from 'node:assert/strict';
import {test,before,after} from 'node:test';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {ExportScope} from '../../../apps/web/src/features/backups/project-backups-api.ts';
const id=(n:number)=>'af140070-0000-4000-8000-'+String(n).padStart(12,'0'),pid=id(1),uid=id(2),cid=id(3),at='2026-11-17T00:00:00.000Z';
const artifact={artifactId:id(5),bytes:8,contentHash:contentHash('ordinary'),mediaType:'application/octet-stream'},formRef={id:id(7),version:1,contentHash:'a'.repeat(64)},attachmentArtifact={...artifact,artifactId:id(6),bytes:12,contentHash:contentHash('second bytes')},content={body:artifact,attachments:[attachmentArtifact],sections:[],sourceRefs:[]};
const basis={title:'보관 원문',formRef,stageNodeRef:null,content},documentValue={id:id(4),version:1,...basis,contentHash:contentHash(canonicalJson(basis))};
const selection={kind:'DOCUMENT_ARTIFACT' as const,documentRef:{id:id(4),version:1,contentHash:documentValue.contentHash},artifactRef:artifact};
function jobFor(mode='OK',attachment=false){
 const original=attachment?attachmentArtifact:artifact;
 const chosen=mode==='SELECTION'?{...selection,documentRef:{...selection.documentRef,id:id(98)}}:{...selection,artifactRef:original};
 const manifest={schemaVersion:1,kind:'SELECTED_DOCUMENT_ARTIFACT_EXPORT',projectId:pid,includeSource:false,selection:chosen,files:[{artifactRef:original,downloadName:original.artifactId+'.bin'}],omitted:['PROJECT_DB_SNAPSHOT','PROJECT_SOURCE','OTHER_PROJECT_MATERIALS','EXECUTION_STATE_RESTORE'],createdAt:at,createdBy:{kind:'HUMAN',userId:mode==='ACTOR'?id(99):uid}};
 return{ref:{id:id(attachment?21:20),version:1,contentHash:contentHash(canonicalJson(manifest))},manifest,sourceAvailability:mode==='BLOCKED'?'BLOCKED':'READY'};
}
const nodes=(n:MemoryNode):MemoryNode[]=>[n,...n.childNodes.flatMap(nodes)];
async function settle(check:()=>boolean){for(let i=0;i<80;i++){if(check())return;await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});}assert.fail('RAM 정착 실패');}
async function fixture(receiptMode='OK',browse=false){
 const session={user:{id:uid},clientId:cid,csrfToken:'C'.repeat(43)},calls:{path:string;method:string;body?:string}[]=[];
 let mode='503',listMode='MISSING',release=()=>{},waiting=false,lost=0;
 const responseJob=jobFor(receiptMode);
 const api=new ui.ApiClient(async(path:string,options?:RequestInit)=>{
  const method=options?.method??'GET';calls.push({path,method,body:options?.body as string|undefined});
  if(method==='POST'){
   if(mode==='LOST')throw Error('합성 POST 응답 유실');
   const c=JSON.parse(String(options?.body));
   return Response.json({commandId:c.commandId,operationId:id(30),projectId:pid,status:'APPLIED',targetId:responseJob.ref.id,version:1,data:{status:'EXPORT_STORED',ref:responseJob.ref},evidenceRefs:[],warnings:[],serverReceivedAt:at});
  }
  if(path==='/api/v1/projects/'+pid)return Response.json({id:pid,participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:cid,generation:1}});
  if(path==='/api/v1/projects/'+pid+'/documents?limit=50'||path==='/api/v1/projects/'+pid+'/documents?limit=50&cursor=NEXT'){
   if(listMode==='DENIED')return Response.json({code:'ACCESS_DENIED'},{status:403});
   return Response.json({items:listMode==='EMPTY'?[]:[{id:id(listMode==='PRESENT'?4:42),title:'현재 목록 문서',headVersion:1,confirmedVersion:1,updatedAt:at}],hasMore:listMode==='MISSING_PAGE',nextCursor:listMode==='MISSING_PAGE'?'NEXT':null,observedAt:at});
  }
  if(path==='/api/v1/projects/'+pid+'/documents/'+id(4)+'/versions/1'){
   const selectedMode=mode;
   if(selectedMode==='WAIT_DOCUMENT_401'){waiting=true;await new Promise<void>(r=>release=r);return Response.json({code:'AUTH_REQUIRED'},{status:401});}
   if(selectedMode==='DOCUMENT_HASH'||selectedMode==='ARTIFACT_TUPLE'){
    const changed=selectedMode==='DOCUMENT_HASH'?{...basis,title:'새 문서 내용'}:{...basis,content:{...content,body:{...artifact,bytes:9,mediaType:'text/plain'}}};
    return Response.json({...documentValue,...changed,contentHash:contentHash(canonicalJson(changed))});
   }
   return Response.json(documentValue);
  }
  if(browse&&path==='/api/v1/projects/'+pid+'/backups?view=SELECTED_ARTIFACT_EXPORTS&limit=50')return Response.json({items:[responseJob,jobFor(receiptMode,true)],hasMore:false,nextCursor:null,observedAt:at,baselineVersion:null});
  const detailJob=browse&&path.endsWith(id(21))?jobFor(receiptMode,true):responseJob;
  assert.equal(path,'/api/v1/projects/'+pid+'/backups/'+detailJob.ref.id);
  const selectedMode=mode;
  if(mode.startsWith('WAIT')){waiting=true;await new Promise<void>(r=>release=r);}
  if(['503','403','401','WAIT401'].includes(selectedMode))return Response.json({code:selectedMode==='503'?'EXPORT_STORAGE_FAILED':'ACCESS_DENIED'},{status:selectedMode==='WAIT401'?401:Number(selectedMode)});
  return Response.json(selectedMode==='HASH'?{...responseJob,ref:{...responseJob.ref,contentHash:'f'.repeat(64)}}:detailJob);
 });
 let buffer=(browse?null:await ui.prepareExport(api,pid,session,selection,'보관 이유',()=>true)) as any;
 const scope=new ExportScope();scope.bind(session,api,pid);
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 let props:any={client:api,session,projectId:pid,buffer,scope,onAuthenticationLost:()=>{lost++;}};
 const render=async(p=props)=>{props=p;scope.bind(props.session,props.client,props.projectId);await ui.React.act(async()=>root.render(ui.React.createElement(ui.ProjectBackupsPanel,props)));};
 props.onChange=(expected:string|null,next:any)=>{const updated=ui.mergeExportPending(buffer,expected,next);if(updated===buffer)return false;buffer=updated;props={...props,buffer};root.render(ui.React.createElement(ui.ProjectBackupsPanel,props));return true;};
 const button=(label:string,index?:number)=>{const found=nodes(container).filter(n=>n.tagName==='BUTTON'&&n.textContent===label);if(index===undefined)assert.equal(found.length,1,label);assert.ok(found[index??0],label);return found[index??0]!;};
 const click=async(label:string,index?:number)=>{const b=button(label,index);assert(!b.disabled,label);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0}));};
 await render();
 return{details:()=>nodes(container).find(n=>n.getAttribute('aria-label')==='보관 반출 상세'),calls,scope,render,props:()=>props,buffer:()=>buffer,nodes:()=>nodes(container),button,click,text:()=>container.textContent,links:()=>nodes(container).filter(n=>n.tagName==='A'),setMode:(v:string)=>{mode=v;},setListMode:(v:string)=>{listMode=v;},waiting:()=>waiting,release:()=>release(),lost:()=>lost,replace:async(next:any)=>{buffer=next;await render({...props,buffer});},close:async()=>{release();await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
const recover='확정 반출 결과 다시 조회';
async function failedFollowup(f:Awaited<ReturnType<typeof fixture>>){
 await f.click('같은 반출 명령 전송·재확인');await settle(()=>f.text().includes('후속 조회 실패'));
 assert.ok(f.buffer().receipt);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert.equal(f.links().length,0);
}
test('POST 성공 후 GET503은 원영수증 GET만 명시 복구해 링크를 연다',async()=>{
 const f=await fixture();try{
  await failedFollowup(f);const original=f.buffer(),count=f.calls.length;f.setMode('OK');
  assert.equal(f.calls.length,count);
  await f.click(recover);await settle(()=>f.links().some(a=>a.textContent==='별도 보관 복사본 다운로드'));
  assert.equal(f.links().find(a=>a.textContent==='별도 보관 복사본 다운로드')!.getAttribute('href'),'/api/v1/projects/'+pid+'/backups/'+id(20)+'/file');
  assert.equal(f.calls.length,count+1);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert.equal(f.buffer(),original);
 }finally{await f.close();}
});
for(const mode of ['ACTOR','SELECTION','HASH','403','401'] as const)test('확정 결과 재조회 '+mode+'는 링크 없이 원영수증을 보존한다',async()=>{
 const f=await fixture(mode==='ACTOR'||mode==='SELECTION'?mode:'OK');try{
  await failedFollowup(f);const original=f.buffer();f.setMode(mode==='ACTOR'||mode==='SELECTION'?'OK':mode);
  await f.click(recover);await settle(()=>!f.text().includes('처리 중입니다.'));
  assert.equal(f.links().length,0);assert.deepEqual(f.buffer().receipt,original.receipt);assert.equal(f.buffer().command,original.command);
  assert.ok(f.text().includes(mode==='ACTOR'||mode==='SELECTION'?'EXPORT_RECEIPT_SCOPE_MISMATCH':mode==='HASH'?'RESPONSE_INVALID':'ACCESS_DENIED'));
  if(mode==='403'){assert.equal(f.buffer().accessLost,true);assert.equal(f.button(recover).disabled,true);}
  assert.equal(f.lost(),mode==='401'?1:0);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
 }finally{await f.close();}
});
for(const mode of ['BUFFER','BUFFER_ABA','CLOSE','SESSION','PROJECT','LATE401'] as const)test('확정 재조회 지연 '+mode+'는 원buffer·문맥 교체 뒤 반영하지 않는다',async()=>{
 const f=await fixture();try{
  await failedFollowup(f);const original=f.buffer(),props=f.props();f.setMode(mode==='LATE401'?'WAIT401':'WAIT200');
  await f.click(recover);await settle(f.waiting);
  if(mode==='SESSION'||mode==='LATE401')await f.render({...props,session:{...props.session,user:{id:id(90)}}});
  else if(mode==='PROJECT')await f.render({...props,projectId:id(91)});
  else if(mode==='CLOSE')await f.replace(null);
  else{await f.replace({...original});if(mode==='BUFFER_ABA')await f.replace(original);}
  await ui.React.act(async()=>{f.release();await new Promise(r=>setImmediate(r));});
  assert.equal(f.links().length,0);assert.equal(f.lost(),0);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
  assert.deepEqual(original.receipt,jobFor().ref);assert.doesNotMatch(f.text(),/ACCESS_DENIED/);
 }finally{await f.close();}
});
test('확정 재조회 연속 조작은 GET1이며 결과 닫기 뒤 링크와 옛버튼 요청은 없다',async()=>{
 const f=await fixture();try{
  await failedFollowup(f);f.setMode('WAIT200');const before=f.calls.length,b=f.button(recover),key=Object.keys(b).find(k=>k.startsWith('__reactProps'))!;
  const action=(b as any)[key].onClick;
  await ui.React.act(async()=>{action();action();});await settle(f.waiting);assert.equal(f.calls.length,before+1);
  await ui.React.act(async()=>{f.release();await new Promise(r=>setImmediate(r));});await settle(()=>f.links().some(a=>a.textContent==='별도 보관 복사본 다운로드'));
  await f.click('확인 결과 닫기');assert.equal(f.buffer(),null);assert.equal(f.links().length,0);
  await ui.React.act(async()=>{action();});assert.equal(f.calls.length,before+1);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
 }finally{await f.close();}
});
test('최초 POST 성공 뒤 자동 후속 GET도 교체된 원buffer에 링크를 붙이지 않는다',async()=>{
 const f=await fixture();try{
  f.setMode('WAIT200');await f.click('같은 반출 명령 전송·재확인');await settle(f.waiting);
  const confirmed=f.buffer();assert.ok(confirmed.receipt);await f.replace({...confirmed});
  await ui.React.act(async()=>{f.release();await new Promise(r=>setImmediate(r));});
  assert.equal(f.links().length,0);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert.equal(f.lost(),0);
 }finally{await f.close();}
});
test('POST 자체 유실은 UNKNOWN 원명령을 보존하며 영수증 재조회로 전환하지 않는다',async()=>{
 const f=await fixture();try{
  const original=f.buffer();f.setMode('LOST');await f.click('같은 반출 명령 전송·재확인');
  await settle(()=>f.text().includes('CONNECTION_LOST'));
  assert.equal(f.buffer().receipt,null);assert.equal(f.buffer().dispatchState,'UNKNOWN');assert.equal(f.buffer().command,original.command);assert.equal(f.buffer().body,original.body);
  assert.equal(f.text().includes(recover),false);assert.equal(f.links().length,0);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert.equal(f.calls.filter(c=>c.path.includes('/backups/')).length,0);
 }finally{await f.close();}
});
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
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/backups/ProjectBackupsPanel.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:control-acceptance',name:'ControlAcceptanceMemoryTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'rework-memory-entry',resolveId(id){if(id.endsWith('virtual:control-acceptance'))return '\0control-acceptance';},load(id){if(id==='\0control-acceptance')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{ProjectBackupsPanel}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};import{prepareExport,mergeExportPending}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/backups/project-backups-api.ts',import.meta.url)))};import{renderToStaticMarkup}from'react-dom/server';export{React,createRoot,ProjectBackupsPanel,ApiClient,renderToStaticMarkup,prepareExport,mergeExportPending};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return ControlAcceptanceMemoryTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});


test('보관 목록의 같은 문서 판별 원본 상세는 exact ref·artifact·시각과 명시 원문 링크를 구분한다',async()=>{
 const f=await fixture('OK',true);try{
  f.setMode('OK');assert.equal(f.calls.length,0);await f.click('보관 결과 목록 조회');await settle(()=>f.text().includes(id(20)));
  assert.equal(f.details(),undefined);assert.equal(f.links().length,0);assert.equal(f.calls.length,1);
  for(const index of [0,1]){
   await f.click('보관 결과 상세 조회',index);await settle(()=>!f.text().includes('처리 중입니다.'));
   assert.equal(f.links().filter(a=>a.textContent==='반출한 고정 문서 원문 열기').length,1,'명시 고정 원문 이동 누락');
   const job=jobFor('OK',index===1),detail=f.details();assert.ok(detail,'검산한 원본 식별 상세');
   for(const value of [job.manifest.selection.documentRef.id,job.manifest.selection.documentRef.contentHash,job.manifest.selection.artifactRef.artifactId,String(job.manifest.selection.artifactRef.bytes),job.manifest.selection.artifactRef.contentHash,job.ref.id,job.ref.contentHash,at])assert.ok(detail.textContent.includes(value),value);
   const originals=f.links().filter(a=>a.textContent==='반출한 고정 문서 원문 열기');assert.equal(originals.length,1);
   assert.equal(originals[0]!.getAttribute('href'),'#/projects/'+pid+'/documents/'+id(4)+'/versions/1/'+documentValue.contentHash);
   assert.equal(f.links().find(a=>a.textContent==='별도 보관 복사본 다운로드')!.getAttribute('href'),'/api/v1/projects/'+pid+'/backups/'+job.ref.id+'/file');
   assert.equal(f.calls.length,index+2);assert.equal(f.calls.at(-1)!.path,'/api/v1/projects/'+pid+'/backups/'+job.ref.id);
  }
  assert.equal(f.calls.every(c=>c.method==='GET'),true);assert.equal(f.buffer(),null);
 }finally{await f.close();}
});
for(const mode of ['BLOCKED','403','401','SESSION','TRANSPORT','PROJECT','LATE401'] as const)test('보관 상세 '+mode+'는 고정 원문·다운로드 링크를 노출하지 않는다',async()=>{
 const f=await fixture(mode==='BLOCKED'?'BLOCKED':'OK',true);try{
  f.setMode('OK');await f.click('보관 결과 목록 조회');await settle(()=>f.text().includes(id(20)));
  const changed=['SESSION','TRANSPORT','PROJECT','LATE401'].includes(mode);
  f.setMode(changed?(mode==='LATE401'?'WAIT401':'WAIT200'):mode==='BLOCKED'?'OK':mode);
  await f.click('보관 결과 상세 조회',0);
  if(changed){
   await settle(f.waiting);const props=f.props();
   if(mode==='TRANSPORT'){const old=props.client.transport;props.client.transport=(...args:Parameters<typeof fetch>)=>old(...args);await f.render(props);}
   else await f.render(mode==='PROJECT'?{...props,projectId:id(91)}:{...props,session:{...props.session}});
   assert.equal(f.links().length,0);await ui.React.act(async()=>{f.release();await new Promise(r=>setImmediate(r));});
  }else await settle(()=>!f.text().includes('처리 중입니다.'));
  assert.equal(f.links().length,0);assert.equal(f.lost(),mode==='401'?1:0);assert.equal(f.calls.length,2);assert.equal(f.calls.every(c=>c.method==='GET'),true);assert.equal(f.buffer(),null);
  if(mode==='BLOCKED')assert.match(f.text(),/다운로드를 차단/);else assert.equal(f.details(),undefined);
 }finally{await f.close();}
});


test('이미 열린 보관 상세는 인증·전송·프로젝트 문맥 교체 즉시 두 링크를 숨긴다',async()=>{
 for(const mode of ['SESSION','CSRF','TRANSPORT','PROJECT']){
  const f=await fixture('OK',true);try{
   f.setMode('OK');await f.click('보관 결과 목록 조회');await settle(()=>f.text().includes(id(20)));
   await f.click('보관 결과 상세 조회',0);await settle(()=>f.links().length===2);const before=f.calls.length,props=f.props();
   if(mode==='CSRF'){props.session.csrfToken='D'.repeat(43);await f.render(props);}
   else if(mode==='TRANSPORT'){const transport=props.client.transport;props.client.transport=(...args:Parameters<typeof fetch>)=>transport(...args);await f.render(props);}
   else await f.render(mode==='PROJECT'?{...props,projectId:id(91)}:{...props,session:{...props.session}});
   assert.equal(f.links().length,0);assert.equal(f.details(),undefined);assert.equal(f.calls.length,before);assert.equal(f.buffer(),null);
  }finally{await f.close();}
 }
});

const versionLookup='고정 버전 조회',documentsPath='/api/v1/projects/'+pid+'/documents?limit=50',fixedPath='/api/v1/projects/'+pid+'/documents/'+id(4)+'/versions/1';
async function releaseForEdit(f:Awaited<ReturnType<typeof fixture>>){
 const before=f.calls.length;
 await f.click('미전송 준비 해제·편집');await f.click('해제하고 편집으로 돌아가기');
 assert.equal(f.buffer(),null);assert.equal(f.calls.length,before);assert(!f.nodes().some(n=>n.getAttribute('aria-label')==='원본 1개'));
 assert.equal(f.nodes().find(n=>n.getAttribute('aria-label')==='반출 이유')?.value,'보관 이유');
}
function clickHandler(button:MemoryNode){const key=Object.keys(button).find(k=>k.startsWith('__reactProps'));assert(key);return (button as any)[key].onClick as ()=>void;}

test('복귀한 미전송의 원문은 정상 목록에서 빠져도 명시적으로 정확한 한 버전만 재조회한다',async()=>{
 for(const mode of ['MISSING','EMPTY']){
  const f=await fixture();try{
   await releaseForEdit(f);const before=f.calls.length;
   assert(f.button(versionLookup).disabled,'remount 뒤 현재 목록을 먼저 확인한다');
   f.setListMode(mode);await f.click('반출할 문서 조회');await settle(()=>!f.text().includes('처리 중입니다.'));
   assert(!f.button(versionLookup).disabled,mode);assert.equal(f.calls.length,before+1);
   await f.click(versionLookup);await settle(()=>f.nodes().some(n=>n.getAttribute('aria-label')==='원본 1개'));
   assert.deepEqual(f.calls.slice(before).map(c=>c.path),[documentsPath,fixedPath]);
   const selected=f.nodes().find(n=>n.getAttribute('aria-label')==='원본 1개');assert(selected);
   const control=Object.keys(selected).find(k=>k.startsWith('__reactProps'));assert(control);
   assert.equal((selected as any)[control].value,artifact.artifactId);
   assert.equal(f.nodes().find(n=>n.getAttribute('aria-label')==='반출 이유')?.value,'보관 이유');
   assert(f.button('반출 명령 준비').disabled);assert.equal(f.buffer(),null);
   assert(f.calls.every(c=>c.method==='GET'));
  }finally{await f.close();}
 }
});

test('목록 밖 복구는 다른 버전과 실패한 목록에 열리지 않으며 원문·원본 참조를 재검산한다',async()=>{
 for(const mode of ['OTHER_VERSION','LIST_DENIED','DOCUMENT_HASH','ARTIFACT_TUPLE']){
  const f=await fixture();try{
   await releaseForEdit(f);
   if(mode==='LIST_DENIED')f.setListMode('MISSING_PAGE');
   await f.click('반출할 문서 조회');await settle(()=>!f.text().includes('처리 중입니다.'));
   const stale=clickHandler(f.button(versionLookup)),before=f.calls.length;
   if(mode==='OTHER_VERSION'){
    const input=f.nodes().find(n=>n.tagName==='INPUT'&&n.getAttribute('inputmode')==='numeric')??f.nodes().find(n=>n.tagName==='INPUT'&&n.value==='1');
    assert(input);const key=Object.keys(input).find(k=>k.startsWith('__reactProps'));assert(key);
    await ui.React.act(async()=>{(input as any)[key].onChange({target:{value:'2'}});stale();});
    assert(f.button(versionLookup).disabled);assert.equal(f.calls.length,before);
   }else if(mode==='LIST_DENIED'){
    f.setListMode('DENIED');await f.click('문서 다음 페이지');await settle(()=>f.text().includes('ACCESS_DENIED'));
    assert(f.button(versionLookup).disabled);assert(!f.button('문서 다음 페이지').disabled);
    assert(f.nodes().some(n=>n.tagName==='OPTION'&&n.textContent.includes('현재 목록 문서')));
    await ui.React.act(async()=>stale());assert.equal(f.calls.length,before+1);
    assert.equal(f.calls.at(-1)?.path,documentsPath+'&cursor=NEXT');
   }else{
    f.setMode(mode);await f.click(versionLookup);await settle(()=>f.text().includes('EXPORT_CONTEXT_CHANGED'));
    assert.equal(f.calls.length,before+1);
   }
   assert(!f.nodes().some(n=>n.getAttribute('aria-label')==='원본 1개'),mode);
   assert(f.button('반출 명령 준비').disabled,mode);assert.equal(f.buffer(),null);assert(f.calls.every(c=>c.method==='GET'));
  }finally{await f.close();}
 }
});

test('문맥이 바뀐 미전송 복귀 조회는 옛 버튼과 늦은 401을 폐기한다',async()=>{
 for(const mode of ['BEFORE_TRANSPORT','LATE_401']){
  const f=await fixture();try{
   await releaseForEdit(f);await f.click('반출할 문서 조회');await settle(()=>!f.text().includes('처리 중입니다.'));
   assert(!f.button(versionLookup).disabled);
   const original=clickHandler(f.button(versionLookup)),props=f.props(),before=f.calls.length;
   if(mode==='LATE_401'){f.setMode('WAIT_DOCUMENT_401');await f.click(versionLookup);await settle(f.waiting);}
   const transport=props.client.transport;props.client.transport=transport.bind(null);
   if(mode==='BEFORE_TRANSPORT')await ui.React.act(async()=>original());
   else{await f.render(props);await ui.React.act(async()=>{f.release();await new Promise(r=>setImmediate(r));});}
   assert.equal(f.calls.length,before+(mode==='LATE_401'?1:0));assert.equal(f.lost(),0);
   assert(!f.text().includes('AUTH_REQUIRED'));assert(f.calls.every(c=>c.method==='GET'));assert.equal(f.buffer(),null);
  }finally{await f.close();}
 }
});
