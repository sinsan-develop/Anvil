import assert from 'node:assert/strict';
import {test,before,after} from 'node:test';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {fixture as activationFixture,pid,actor,id,at} from '../FN04/baseline-activation-fixture.ts';
import {activationHash,newDesignActivation,prepareDesignActivation} from '../../../apps/web/src/features/design-change/activation-api.ts';
const nodes=(n:MemoryNode):MemoryNode[]=>[n,...n.childNodes.flatMap(nodes)];
async function settle(check:()=>boolean){for(let i=0;i<80;i++){if(check())return;await ui.React.act(async()=>{await new Promise(r=>setImmediate(r));});}assert.fail('RAM 정착 실패');}
async function fixture(withBuffer=false,distinctDesign=false){
 const f=activationFixture(),previous=f.record();
 if(distinctDesign){previous.snapshot.approvedDesignRef={...previous.snapshot.approvedDesignRef,version:1,contentHash:'b'.repeat(64)};previous.ref.contentHash=await activationHash(previous.snapshot);}
 const record=f.record(2,previous.ref),session={user:{id:actor.actorId},clientId:id(90),csrfToken:'C'.repeat(43)};
 const current={projectId:pid,current:{state:'PRESENT' as const,activationRef:record.ref,designRef:record.snapshot.approvedDesignRef,planRef:record.snapshot.confirmedPlanRef},observedAt:at,executionAuthorized:false as const,dispatchPerformed:false as const};
 const calls:{path:string;method:string}[]=[];let mode='OK',release=()=>{},waiting=false,lost=0,changes=0,requests=0;
 const api=new ui.ApiClient(async(path:string,options?:RequestInit)=>{
  calls.push({path,method:options?.method??'GET'});assert.equal(options?.method??'GET','GET');
  const selected=mode;if(selected.startsWith('WAIT')){waiting=true;await new Promise<void>(r=>release=r);}
  if(['401','403','WAIT401'].includes(selected))return Response.json({code:'ACCESS_DENIED'},{status:selected==='WAIT401'?401:Number(selected)});
  if(path==='/api/v1/projects/'+pid+'/baseline-activations/current')return Response.json(mode==='NONE'?{...current,current:{state:'NONE'}}:current);
  const r=[record,previous].find(r=>path==='/api/v1/projects/'+pid+'/baseline-activations/'+r.ref.id+'/versions/'+r.ref.version);assert(r,path);
  return Response.json({projectId:pid,...r,currentActivationRef:record.ref,isCurrent:r===record,observedAt:at,executionAuthorized:false,dispatchPerformed:false});
 });
 let buffer=withBuffer?newDesignActivation(api,pid,session,1,f.input,null):null;
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);
 let props:any={client:api,projectId:pid,session,page:null,selectionId:'',buffer,onRequest:()=>{requests++;return true;},onAuthenticationLost:()=>{lost++;}};
 const render=async(p=props)=>{props=p;await ui.React.act(async()=>root.render(ui.React.createElement(ui.DesignActivationPanel,props)));};
 props.onChange=(update:any)=>{changes++;buffer=typeof update==='function'?update(buffer):update;props={...props,buffer};root.render(ui.React.createElement(ui.DesignActivationPanel,props));};
 const button=(label:string)=>{const found=nodes(container).filter(n=>n.tagName==='BUTTON'&&n.textContent===label);assert.equal(found.length,1,label);return found[0]!;};
 const click=async(label:string)=>{const b=button(label);assert(!b.disabled,label);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0}));};
 await render();
 return{f,record,previous,current,calls,api,session,buffer:()=>buffer,props:()=>props,render,button,click,text:()=>container.textContent,region:(label:string)=>nodes(container).filter(n=>n.getAttribute('aria-label')===label),setMode:(v:string)=>{mode=v;},waiting:()=>waiting,release:()=>release(),lost:()=>lost,changes:()=>changes,requests:()=>requests,replace:async(b:any)=>{buffer=b;await render({...props,buffer});},close:async()=>{release();await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
const originalLinks=(f:Awaited<ReturnType<typeof fixture>>)=>f.region('설계 변경 적용').flatMap(nodes).filter(n=>n.tagName==='A'&&n.textContent==='당시 확정 설계 원문 보기');
test('당시 확정 설계 링크는 고정 현재/직전 버전의 fullref만 사용하고 미결 명령을 보존한다',async()=>{
 const f=await fixture(true,true);try{
  const base=f.buffer()!,pending=prepareDesignActivation({...base,current:{...f.current,current:{state:'NONE'}}},f.session),retained={...base,pending,uncertain:true};await f.replace(retained);
  assert.equal(originalLinks(f).length,0);
  await f.click('현재 적용 기준 확인');await settle(()=>f.region('현재 적용 기준').length===1);assert.equal(originalLinks(f).length,0);
  for(const [button,record] of [['적용 이력 원문 확인',f.record],['직전 적용 이력 확인',f.previous]] as const){
   await f.click(button);await settle(()=>f.region('고정 적용 이력')[0]?.textContent.includes(record.ref.contentHash)??false);
   const links=originalLinks(f),ref=record.snapshot.approvedDesignRef;assert.equal(links.length,1);
   assert.equal(links[0]!.getAttribute('href'),`#/projects/${pid}/documents/${ref.id}/versions/${ref.version}/${ref.contentHash}`);
   const count=f.calls.length;await ui.React.act(async()=>links[0]!.dispatchEvent({type:'click',button:0}));assert.equal(f.calls.length,count);assert.equal(f.buffer(),retained);
  }
  assert.equal(f.changes(),0);assert.equal(f.requests(),0);assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});
for(const mode of ['CSRF','TRANSPORT'] as const)test('당시 확정 설계 링크는 '+mode+' 교체 후 이전 응답을 노출하지 않는다',async()=>{
 const f=await fixture();try{await f.click('현재 적용 기준 확인');await settle(()=>f.region('현재 적용 기준').length===1);await f.click('적용 이력 원문 확인');await settle(()=>originalLinks(f).length===1);
  if(mode==='CSRF')await f.render({...f.props(),session:{...f.session,csrfToken:'D'.repeat(43)}});
  else{const old=f.api.transport;f.api.transport=(...args:any[])=>old(...args);await f.render();}
  assert.equal(originalLinks(f).length,0);assert.equal(f.changes(),0);assert.equal(f.requests(),0);assert.equal(f.calls.length,2);
 }finally{await f.close();}
});
test('버퍼 없는 다른 제어 기기의 OWNER는 현재→고정→직전 이력을 GET만으로 읽는다',async()=>{
 const f=await fixture();try{
  assert.equal(f.calls.length,0);assert.equal(f.button('설계 변경 적용 준비').disabled,true);
  await f.click('현재 적용 기준 확인');await settle(()=>f.region('현재 적용 기준').length===1);
  await f.click('적용 이력 원문 확인');await settle(()=>f.region('고정 적용 이력')[0]?.textContent.includes(f.record.ref.contentHash)??false);
  await f.click('직전 적용 이력 확인');await settle(()=>f.region('고정 적용 이력')[0]?.textContent.includes(f.previous.ref.contentHash)??false);
  assert.deepEqual(f.calls.map(c=>c.method),['GET','GET','GET']);assert.equal(f.changes(),0);assert.equal(f.requests(),0);assert.equal(f.buffer(),null);
  assert.equal(f.calls.some(c=>!c.path.includes('/baseline-activations/')),false);
 }finally{await f.close();}
});
for(const status of ['401','403'])for(const endpoint of ['current','fixed'])test(endpoint+' '+status+'는 이전 보호 이력을 숨기고 명령을 만들지 않는다',async()=>{
 const f=await fixture();try{
  await f.click('현재 적용 기준 확인');await settle(()=>f.region('현재 적용 기준').length===1);
  await f.click('적용 이력 원문 확인');await settle(()=>f.region('고정 적용 이력').length===1);
  f.setMode(status);await f.click(endpoint==='current'?'현재 적용 기준 확인':'직전 적용 이력 확인');await settle(()=>f.text().includes('ACCESS_DENIED'));
  assert.equal(f.region('현재 적용 기준').length,0);assert.equal(f.region('고정 적용 이력').length,0);assert.equal(f.lost(),status==='401'?1:0);assert.equal(f.changes(),0);assert.equal(f.requests(),0);assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});
for(const mode of ['PROJECT','PROJECT_ABA','USER','DEVICE','CSRF','SELECTION_ABA','UNMOUNT','LATE401'] as const)test('늦은 이력 '+mode+'는 바뀐 문맥에 반영하지 않는다',async()=>{
 const f=await fixture();let closed=false;try{
  await f.click('현재 적용 기준 확인');await settle(()=>f.region('현재 적용 기준').length===1);
  f.setMode(mode==='LATE401'?'WAIT401':'WAIT200');await f.click('적용 이력 원문 확인');await settle(f.waiting);const original=f.props(),count=f.calls.length;
  if(mode==='UNMOUNT'){await f.close();closed=true;}
  else if(mode==='PROJECT'||mode==='PROJECT_ABA'){await f.render({...original,projectId:id(80)});if(mode==='PROJECT_ABA')await f.render(original);}
  else if(mode==='SELECTION_ABA'){await f.render({...original,selectionId:id(81)});await f.render(original);}
  else await f.render({...original,session:mode==='DEVICE'?{...original.session,clientId:id(82)}:mode==='CSRF'?{...original.session,csrfToken:'D'.repeat(43)}:{...original.session,user:{id:id(83)}}});
  await ui.React.act(async()=>{f.release();await new Promise(r=>setImmediate(r));});
  assert.equal(f.region('고정 적용 이력').length,0);assert.equal(f.region('현재 적용 기준').length,0);assert.equal(f.lost(),0);assert.equal(f.calls.length,count);assert.equal(f.changes(),0);assert.equal(f.requests(),0);assert.doesNotMatch(f.text(),/ACCESS_DENIED/);
 }finally{if(!closed)await f.close();}
});
test('현재 기준 NONE도 조회 결과이며 준비나 승인 상태를 생성하지 않는다',async()=>{
 const f=await fixture();try{f.setMode('NONE');await f.click('현재 적용 기준 확인');await settle(()=>f.text().includes('최초 기준 등록'));assert.equal(f.buffer(),null);assert.equal(f.changes(),0);assert.equal(f.requests(),0);assert.equal(f.calls.length,1);}finally{await f.close();}
});
test('작성 중인 원 후보는 현재 기준을 갱신하지만 확인 체크 전 고정은 불가하다',async()=>{
 const f=await fixture(true);try{
  const original=f.buffer();await f.click('현재 적용 기준 확인');await settle(()=>!!f.buffer()?.current);
  assert.deepEqual(f.buffer()?.input,original?.input);assert.equal(f.buffer()?.bindingId,original?.bindingId);assert.equal(f.buffer()?.pending,null);assert.equal(f.button('적용 후보 고정').disabled,true);
  const checkbox=nodes(f.region('설계 변경 적용')[0]!).find(n=>n.tagName==='INPUT'&&Object.entries(n).some(([k,v])=>k.startsWith('__reactProps$')&&(v as any).type==='checkbox'));assert(checkbox);
  const props=Object.entries(checkbox).find(([k])=>k.startsWith('__reactProps$'))?.[1] as any;assert(props?.onChange);
  await ui.React.act(async()=>props.onChange({target:{checked:true}}));
  await f.click('적용 후보 고정');await settle(()=>!!f.buffer()?.pending);
  assert.deepEqual(f.buffer()?.pending?.baselineRefs,[f.record.ref]);assert.deepEqual(f.buffer()?.pending?.payload,original?.input);assert.equal(f.requests(),0);assert.equal(f.calls.length,1);
 }finally{await f.close();}
});
for(const state of ['PENDING','UNKNOWN','FOREIGN'])test('이력 조회는 '+state+' 원 버퍼·입력·명령을 변경하지 않는다',async()=>{
 const f=await fixture(true);try{
  const base=f.buffer()!;const current={...f.current,current:{state:'NONE' as const}};
  const pending=prepareDesignActivation({...base,current},f.session);
  const retained={...base,current,pending,uncertain:state==='UNKNOWN',failure:state==='UNKNOWN'?{code:'CONNECTION_LOST',status:0}:null,...(state==='FOREIGN'?{ownerClientId:actor.clientId}:{})};
  await f.replace(retained);await f.click('현재 적용 기준 확인');await settle(()=>f.region('현재 적용 기준').length===1);
  await f.click('적용 이력 원문 확인');await settle(()=>f.region('고정 적용 이력').length===1);
  assert.equal(f.buffer(),retained);assert.equal(f.changes(),0);assert.equal(f.requests(),0);assert(f.calls.every(c=>c.method==='GET'));
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
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/design-change/DesignActivationPanel.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:control-acceptance',name:'ControlAcceptanceMemoryTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'rework-memory-entry',resolveId(id){if(id.endsWith('virtual:control-acceptance'))return '\0control-acceptance';},load(id){if(id==='\0control-acceptance')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{DesignActivationPanel}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};import{renderToStaticMarkup}from'react-dom/server';export{React,createRoot,DesignActivationPanel,ApiClient,renderToStaticMarkup};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return ControlAcceptanceMemoryTest;')();
});
after(()=>{for(const c of channels){c.port1.close();c.port2.close();}for(const[k,v]of saved)if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);});
