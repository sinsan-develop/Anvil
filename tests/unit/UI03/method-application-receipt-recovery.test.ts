import assert from 'node:assert/strict';
import {test,before,after} from 'node:test';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {emptyMethodBuffer} from '../../../apps/web/src/features/methodology-editor/common-api.ts';
import {prepareMethodApplication} from '../../../apps/web/src/features/methodology-editor/project-api.ts';
const id=(n:number)=>'a6f20071-0000-4000-8000-'+String(n).padStart(12,'0'),pid=id(1),uid=id(2),cid=id(3),at='2026-11-17T00:00:00.000Z';
const graph={nodes:[],edges:[],entryNodeId:'',terminalNodeIds:[]},sourceRef={id:id(4),version:2,contentHash:contentHash(canonicalJson(graph))};
const snapshot={name:'확정 방법론',purpose:'별도 적용',graph,sourceRef},receiptRef={id:id(5),version:1,contentHash:contentHash(canonicalJson(snapshot))};
const nodes=(n:MemoryNode):MemoryNode[]=>[n,...n.childNodes.flatMap(nodes)];
async function settle(check:()=>boolean){for(let i=0;i<80;i++){if(check())return;await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});}assert.fail('RAM 정착 실패');}
async function fixture(start=false){
 const session={user:{id:uid},clientId:cid,csrfToken:'C'.repeat(43)},calls:{path:string;method:string;body?:string}[]=[];
 let mode='PREPARE',release=()=>{},waiting=false,lost=0,applied=0;
 const api=new ui.ApiClient(async(path:string,options?:RequestInit)=>{
  const method=options?.method??'GET';calls.push({path,method,body:options?.body as string|undefined});
  if(method==='POST'){
   assert.equal(path,'/api/v1/projects/'+pid+'/commands');if(mode==='LOST')throw Error('합성 POST 응답 유실');
   if(mode==='WAITPOST'){waiting=true;await new Promise<void>(r=>release=r);}
   const request=JSON.parse(String(options?.body));
   return Response.json({operationId:id(6),commandId:request.commandId,projectId:pid,status:'APPLIED',targetId:receiptRef.id,version:receiptRef.version,data:{ref:receiptRef,status:'METHODOLOGY_APPLIED',snapshot,reason:request.payload.reason,previousApplicationRef:null},serverReceivedAt:at});
  }
  assert.equal(path,'/api/v1/projects/'+pid);
  const selected=calls.some(c=>c.method==='POST')?mode:'PREPARE';if(selected.startsWith('WAIT')){waiting=true;await new Promise<void>(r=>release=r);}
  if(['503','401','403','WAIT401'].includes(selected))return Response.json({code:selected==='503'?'READ_UNAVAILABLE':'ACCESS_DENIED'},{status:selected==='WAIT401'?401:Number(selected)});
  return Response.json({id:pid,currentMethodologyRef:selected==='PREPARE'?null:selected==='OTHER'?{...receiptRef,version:2}:selected==='HASH'?{...receiptRef,contentHash:'f'.repeat(64)}:receiptRef,participation:'OWNER',controlState:{actorId:uid,clientId:selected==='READ_ONLY'?id(90):cid,generation:1,status:'HELD'}});
 });
 const request=await prepareMethodApplication(api,pid,session,sourceRef,null,'원 적용 이유');mode='503';
 let buffer:any={...emptyMethodBuffer(),ownerUserId:uid,application:{ownerUserId:uid,clientId:cid,reason:'원 적용 이유',preparationId:null,pending:start?null:{request,previous:null,uncertain:false},verifiedRef:null}};
 const container=document.createElement('div');document.body.appendChild(container);let root=ui.createRoot(container);
 const reviewRef={id:id(7),targetRef:sourceRef,criteriaVersion:1,outcome:'ACCEPTED'};
 let props:any={client:api,projectId:pid,session,source:start?{scope:'PROJECT',ref:sourceRef,headVersion:2,validation:{validForConfirmation:true},contentReviews:[{ref:reviewRef}],confirmation:{reviewRefs:[reviewRef]}}:null,appliedRef:null,unavailable:false,buffer,onAuthenticationLost:()=>{lost++;},onApplied:(ref:any)=>{applied++;props={...props,appliedRef:ref};root.render(ui.React.createElement(ui.MethodApplicationPanel,props));}};
 const render=async(p=props)=>{props=p;await ui.React.act(async()=>root.render(ui.React.createElement(ui.MethodApplicationPanel,props)));};
 props.onChange=(update:any)=>{buffer=typeof update==='function'?update(buffer):update;props={...props,buffer};root.render(ui.React.createElement(ui.MethodApplicationPanel,props));};
 const button=(label:string)=>{const found=nodes(container).filter(n=>n.tagName==='BUTTON'&&n.textContent===label);assert.equal(found.length,1,label);return found[0]!;};
 const click=async(label:string)=>{const b=button(label);assert(!b.disabled,label);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0}));};
 await render();
 return{request,calls,api,buffer:()=>buffer,props:()=>props,render,button,click,text:()=>container.textContent,nodes:()=>nodes(container),setMode:(v:string)=>{mode=v;},waiting:()=>waiting,release:()=>release(),lost:()=>lost,applied:()=>applied,replace:async(next:any,silent=false)=>{buffer=next;if(!silent)await render({...props,buffer});},remount:async()=>{await ui.React.act(async()=>root.unmount());root=ui.createRoot(container);await render();},close:async()=>{release();await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
const recover='확정 적용 결과 다시 조회';
async function failedRead(f:Awaited<ReturnType<typeof fixture>>){
 await f.click('같은 적용 명령 결과 확인');await settle(()=>!f.text().includes('명시 적용과 서버 재조회를 확인하고 있습니다.'));
 assert.equal(f.calls.filter(c=>c.method==='GET').length,2,f.text());
 assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert.equal(f.applied(),0);
}
test('APPLIED 뒤 GET503은 영수증을 보존하고 왕복 뒤 명시 GET만 복구한다',async()=>{
 const f=await fixture();try{
  await failedRead(f);const pending=f.buffer().application.pending;
  assert.deepEqual(pending.receiptRef,receiptRef);assert.equal(pending.uncertain,false);assert.equal(pending.request,f.request);
  await f.remount();const count=f.calls.length;f.setMode('OK');assert.equal(f.calls.length,count);
  await f.click(recover);await settle(()=>f.text().includes('서버 적용·재조회 확인'));
  assert.equal(f.calls.length,count+1);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
  assert.equal(f.buffer().application.pending,null);assert.deepEqual(f.buffer().application.verifiedRef,receiptRef);assert.equal(f.applied(),1);
 }finally{await f.close();}
});
test('새 적용의 준비→POST→GET503도 확정 ref를 남기며 쓰기 권한 재검사 없이 GET만 복구한다',async()=>{
 const f=await fixture(true);try{
  const checkbox=f.nodes().find(n=>n.tagName==='INPUT'&&Object.entries(n).some(([k,v])=>k.startsWith('__reactProps$')&&(v as any).type==='checkbox'));assert(checkbox);
  const props=Object.entries(checkbox).find(([k])=>k.startsWith('__reactProps$'))?.[1] as any;
  await ui.React.act(async()=>props.onChange({target:{checked:true}}));
  await f.click('확정 방법론 별도 적용');await settle(()=>f.text().includes('적용 저장 확인'));
  assert.deepEqual(f.buffer().application.pending.receiptRef,receiptRef);assert.equal(f.buffer().application.pending.uncertain,false);
  const count=f.calls.length;f.setMode('READ_ONLY');await f.click(recover);await settle(()=>f.applied()===1);
  assert.equal(f.calls.length,count+1);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
 }finally{await f.close();}
});
for(const mode of ['OTHER','HASH','401','403','503'])test('확정 재조회 '+mode+'는 성공을 표시하지 않고 원 영수증·명령을 보존한다',async()=>{
 const f=await fixture();try{
  await failedRead(f);const pending=f.buffer().application.pending,count=f.calls.length;f.setMode(mode);
  await f.click(recover);await settle(()=>!f.text().includes('명시 적용과 서버 재조회를 확인하고 있습니다.'));
  assert.equal(f.calls.length,count+1);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);assert.equal(f.applied(),0);
  assert.equal(f.buffer().application.pending.request,pending.request);assert.deepEqual(f.buffer().application.pending.receiptRef,receiptRef);assert.equal(f.buffer().application.pending.uncertain,false);
  assert.equal(f.buffer().application.verifiedRef,null);assert.equal(f.lost(),mode==='401'?1:0);assert.doesNotMatch(f.text(),/서버 적용·재조회 확인/);
 }finally{await f.close();}
});
for(const mode of ['PROJECT','PROJECT_ABA','USER','DEVICE','CSRF','CLIENT','TRANSPORT','SOURCE','LATE401','UNMOUNT'] as const)test('확정 재조회 지연 '+mode+'는 다른 문맥에 결과를 주지 않는다',async()=>{
 const f=await fixture();let closed=false;try{
  await failedRead(f);const pending=f.buffer().application.pending,original=f.props();f.setMode(mode==='LATE401'?'WAIT401':'WAIT200');
  await f.click(recover);await settle(f.waiting);const count=f.calls.length;
  if(mode==='PROJECT'||mode==='PROJECT_ABA'){await f.render({...original,projectId:id(80)});if(mode==='PROJECT_ABA')await f.render(original);}
  else if(mode==='USER'||mode==='LATE401')await f.render({...original,session:{...original.session,user:{id:id(81)}}});
  else if(mode==='DEVICE')await f.render({...original,session:{...original.session,clientId:id(82)}});
  else if(mode==='CSRF')await f.render({...original,session:{...original.session,csrfToken:'D'.repeat(43)}});
  else if(mode==='CLIENT')await f.render({...original,client:new ui.ApiClient(async()=>{throw Error('호출 금지');})});
  else if(mode==='TRANSPORT'){f.api.transport=async()=>{throw Error('호출 금지');};await f.render(original);}
  else if(mode==='SOURCE')await f.render({...original,source:{ref:{...sourceRef,version:3}}});
  else{await f.close();closed=true;}
  await ui.React.act(async()=>{f.release();await new Promise(r=>setImmediate(r));});
  assert.equal(f.applied(),0);assert.equal(f.lost(),0);assert.equal(f.calls.length,count);assert.equal(f.buffer().application.pending,pending);assert.doesNotMatch(f.text(),/서버 적용·재조회 확인/);
 }finally{if(!closed)await f.close();}
});
test('원 POST 유실은 영수증을 만들지 않고 왕복 후 같은 명령만 재전송한다',async()=>{
 const f=await fixture();try{
  f.setMode('LOST');await f.click('같은 적용 명령 결과 확인');await settle(()=>f.buffer().application.pending.uncertain);
  assert.equal(f.buffer().application.pending.receiptRef,undefined);assert(!f.text().includes(recover));assert.equal(f.calls.filter(c=>c.method==='GET').length,1);
  await f.remount();f.setMode('OK');await f.click('같은 적용 명령 결과 확인');await settle(()=>f.applied()===1);
  const sent=f.calls.filter(c=>c.method==='POST');assert.equal(sent.length,2);assert.equal(sent[0]!.body,sent[1]!.body);assert.equal(f.buffer().application.pending,null);
 }finally{await f.close();}
});
test('확정 GET 연속 조작은 요청 하나이고 프로젝트 교체 후 옛 callback은 GET0이다',async()=>{
 const f=await fixture();try{
  await failedRead(f);const b=f.button(recover),props=Object.entries(b).find(([k])=>k.startsWith('__reactProps$'))?.[1] as any;assert(props?.onClick);
  f.setMode('WAIT200');const count=f.calls.length;await ui.React.act(async()=>{props.onClick();props.onClick();});await settle(f.waiting);assert.equal(f.calls.length,count+1);
  await f.render({...f.props(),projectId:id(80)});await ui.React.act(async()=>props.onClick());assert.equal(f.calls.length,count+1);
  await ui.React.act(async()=>{f.release();await new Promise(r=>setImmediate(r));});assert.equal(f.applied(),0);assert.equal(f.lost(),0);
 }finally{await f.close();}
});
test('프로젝트 교체 뒤 늦은 POST 성공은 영수증이나 후속 GET을 만들지 않는다',async()=>{
 const f=await fixture();try{
  f.setMode('WAITPOST');await f.click('같은 적용 명령 결과 확인');await settle(f.waiting);const count=f.calls.length,pending=f.buffer().application.pending;
  await f.render({...f.props(),projectId:id(80)});await ui.React.act(async()=>{f.release();await new Promise(r=>setImmediate(r));});
  assert.equal(f.calls.length,count);assert.equal(f.applied(),0);assert.equal(f.buffer().application.pending,pending);assert.equal(pending.receiptRef,undefined);
 }finally{await f.close();}
});
for(const mode of ['BUFFER','BUFFER_ABA','CAS','BUFFER401','CAS401'])test('같은 문맥 '+mode+' 교체 뒤 원 조회의 성공·401은 전달하지 않는다',async()=>{
 const f=await fixture();try{
  await failedRead(f);const original=f.buffer();f.setMode(mode.endsWith('401')?'WAIT401':'WAIT200');await f.click(recover);await settle(f.waiting);
  const next={...original,application:{...original.application,pending:{...original.application.pending,request:{...original.application.pending.request,commandId:id(99)}}}};
  await f.replace(next,mode.startsWith('CAS'));if(mode==='BUFFER_ABA')await f.replace(original);
  await ui.React.act(async()=>{f.release();await new Promise(r=>setImmediate(r));});
  assert.equal(f.applied(),0);assert.equal(f.lost(),0);assert.equal(f.buffer(),mode==='BUFFER_ABA'?original:next);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
 }finally{await f.close();}
});
for(const mode of ['WAIT200','WAIT401'])test('POST 뒤 최초 GET '+mode+' 중 버퍼 교체도 성공·인증 callback을 버린다',async()=>{
 const f=await fixture();try{
  f.setMode(mode);await f.click('같은 적용 명령 결과 확인');await settle(f.waiting);
  const original=f.buffer();assert.deepEqual(original.application.pending.receiptRef,receiptRef);
  const replacement={...original,application:{...original.application,pending:null}};await f.replace(replacement);
  await ui.React.act(async()=>{f.release();await new Promise(r=>setImmediate(r));});
  assert.equal(f.applied(),0);assert.equal(f.lost(),0);assert.equal(f.buffer(),replacement);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
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
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/methodology-editor/MethodApplicationPanel.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:control-acceptance',name:'ControlAcceptanceMemoryTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'rework-memory-entry',resolveId(id){if(id.endsWith('virtual:control-acceptance'))return '\0control-acceptance';},load(id){if(id==='\0control-acceptance')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{MethodApplicationPanel}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};import{renderToStaticMarkup}from'react-dom/server';export{React,createRoot,MethodApplicationPanel,ApiClient,renderToStaticMarkup};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return ControlAcceptanceMemoryTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});
