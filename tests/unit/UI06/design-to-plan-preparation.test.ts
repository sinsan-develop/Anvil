import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {contentHash} from '../../../contracts/canonical.ts';
import {documentDraftHash,editDocument} from '../../../apps/web/src/features/design-trace/editor-api.ts';
import type {DocumentBuffer} from '../../../apps/web/src/features/design-trace/editor-api.ts';


/** 실제 ReactDOM의 요소/이벤트/effect를 실행하는 최소 메모리 DOM. 레이아웃·브라우저 보안·시각 검증은 아니다. */
class MemoryNode{
 nodeType:number;nodeName:string;tagName:string;localName:string;namespaceURI='http://www.w3.org/1999/xhtml';parentNode:MemoryNode|null=null;childNodes:MemoryNode[]=[];ownerDocument:any;attributes=new Map<string,string>();style:Record<string,unknown>={};listeners=new Map<string,Function[]>();value='';checked=false;disabled=false;data='';
 constructor(name:string,type=1,owner?:any){this.nodeType=type;this.nodeName=type===1?name.toUpperCase():name;this.tagName=this.nodeName;this.localName=name;this.ownerDocument=owner;}
 get options():MemoryNode[]{return this.childNodes.flatMap(n=>n.tagName==='OPTION'?[n]:n.options);}
 get firstChild():MemoryNode|null{return this.childNodes[0]??null;}get lastChild():MemoryNode|null{return this.childNodes.at(-1)??null;}get nextSibling():MemoryNode|null{const a=this.parentNode?.childNodes;return a?.[a.indexOf(this)+1]??null;}
 get textContent():string{return this.nodeType===3?this.data:this.childNodes.map(n=>n.textContent).join('');}
 get nodeValue():string|null{return this.nodeType===3?this.data:null;}set nodeValue(value:string|null){if(this.nodeType===3)this.data=value??'';}
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
const warnings:unknown[][]=[],originalError=console.error;
const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
before(async()=>{
 console.error=(...args:unknown[])=>{warnings.push(args);originalError(...args);};
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/design-trace/DocumentsPage.tsx',import.meta.url));
 const result:any=await build({configFile:false,envFile:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:plan-revision',name:'PlanRevisionTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'history-memory-entry',resolveId(id){if(id.endsWith('virtual:plan-revision'))return '\0plan-revision';},load(id){if(id==='\0plan-revision')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{DocumentsPage}from${JSON.stringify(entry)};import{WorkPlanEditor}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/features/design-trace/WorkPlanEditor.tsx',import.meta.url)))};import{ApiClient}from${JSON.stringify(fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url)))};export{React,createRoot,DocumentsPage,ApiClient};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const [key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return PlanRevisionTest;')();
});
after(()=>{console.error=originalError;for(const channel of channels){channel.port1.close();channel.port2.close();}for(const[key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);assert.equal(warnings.filter(args=>args.some(x=>String(x).includes('same key'))).length,0,'실제 React 중복 key 경고0');});

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const at='2026-11-17T00:00:00.000Z';

async function fixture(){
 const projectId=id(1),userId=id(7),clientId=id(8),calls:{path:string;method:string}[]=[];
 function formVersion(code:string,formId:string){
   const ref={id:formId,version:1,contentHash:'c'.repeat(64)};
   return {ref,definition:{scope:'USER_COMMON',formCode:code,name:code,purpose:'작성',requiredInputs:[],authorRole:'작성',reviewerRole:'검토',confirmerRole:'사용자',items:[],authoringStandardRef:ref},authoringStandard:{ref,content:'기준'},validation:{formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'}};
 }
 const forms={AF02:formVersion('AF02',id(3)),AF04:formVersion('AF04',id(4))};
 async function documentVersion(n:number,version:number,form:typeof forms.AF02,title:string,body:string,confirmed:boolean){
   const formRef=form.ref;
   const content={body:{artifactId:id(n+version+100),bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/markdown;charset=utf-8'},attachments:[],sections:[],sourceRefs:[]};
   const ref={id:id(n),version,contentHash:await documentDraftHash(title,formRef,content,null)};
   return {ref,body,doc:{...ref,title,formRef,stageNodeRef:null,content,confirmed,validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[]}};
 }
 const [design,plan,head]=await Promise.all([
   documentVersion(10,1,forms.AF02,'확정 설계','설계 원문',true),
   documentVersion(20,1,forms.AF04,'계획 문서','고정 계획 본문 v1',false),
   documentVersion(20,2,forms.AF04,'계획 문서','다른 계획 원문 v2',false),
 ]);
 const versions=[design,plan,head];
 const flags={designConfirmed:true,badSourceHash:false,badIndex:false,badTargetHash:false,wrongForm:false,badFormHash:false,controlGeneration:4,target:undefined as undefined|(()=>Promise<Response>)};
 const transport:typeof fetch=async(path,options)=>{
   const p=String(path),method=String(options?.method);calls.push({path:p,method});assert.equal(method,'GET');
   const scope=`/api/v1/projects/${projectId}`;
   if(p===scope)return Response.json({id:projectId,participation:'OWNER',controlState:{actorId:userId,clientId,generation:flags.controlGeneration,status:'HELD'}});
   if(p.startsWith(scope+'/documents?'))return Response.json({items:[{id:design.ref.id,title:design.doc.title,headVersion:1,confirmedVersion:1,updatedAt:at},{id:plan.ref.id,title:plan.doc.title,headVersion:2,confirmedVersion:null,updatedAt:at}],hasMore:false,nextCursor:null,observedAt:at});
   for(const v of versions){
     if(p===scope+`/documents/${v.ref.id}/versions/${v.ref.version}`){
       if(v===design)return Response.json({...v.doc,confirmed:flags.designConfirmed,title:flags.badSourceHash?'변조 설계':v.doc.title});
       if(v===plan&&flags.target)return flags.target();
       if(v===plan&&flags.badTargetHash)return Response.json({...v.doc,contentHash:'e'.repeat(64)});
       if(v===plan&&flags.wrongForm)return Response.json({...v.doc,formRef:design.doc.formRef,contentHash:await documentDraftHash(v.doc.title,design.doc.formRef,v.doc.content,null),contentReviewCriteria:{...v.doc.contentReviewCriteria,formRef:design.doc.formRef}});
       return Response.json(v.doc);
     }
     if(p===scope+`/files/${v.doc.content.body.artifactId}`)return new Response(v.body,{headers:{'content-type':'application/octet-stream'}});
   }
   for(const form of Object.values(forms))if(p.endsWith(`/forms/${form.ref.id}/versions/1`))return Response.json(flags.badFormHash&&form===forms.AF04?{...form,ref:{...form.ref,contentHash:'f'.repeat(64)}}:form);
   if(p.startsWith(scope+'/design-index?'))return Response.json({documentRef:flags.badIndex?{...design.ref,contentHash:'f'.repeat(64)}:design.ref,items:[],screenRegions:[],status:'NOT_INDEXED',observedAt:at});
   throw new Error('지정되지 않은 합성 조회 '+p);
 };
 let lost=0,current:DocumentBuffer|null=null,changeBuffer:(b:DocumentBuffer|null)=>void=()=>{throw new Error('missing mount');};
 const client=new ui.ApiClient(transport),container=document.createElement('div');document.body.appendChild(container);
 const root=ui.createRoot(container);
 let props={client,projectId,session:{user:{id:userId},clientId,csrfToken:'C'.repeat(43)},onAuthenticationLost:()=>{lost++;}};
 function Parent(p:typeof props){
   const [buffer,setBuffer]=ui.React.useState(null);current=buffer;changeBuffer=setBuffer;
   return ui.React.createElement(ui.DocumentsPage,{...p,buffer,onChange:setBuffer,review:null,onReviewChange:()=>{},confirmation:null,onConfirmationChange:()=>{}});
 }
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap((c:MemoryNode)=>nodes(c))];
 const button=(label:string)=>nodes().find(n=>n.tagName==='BUTTON'&&(n.textContent===label||n.getAttribute('aria-label')===label));
 const render=async(next=props)=>{props=next;await ui.React.act(async()=>root.render(ui.React.createElement(Parent,props)));};
 const click=async(label:string)=>{const b=button(label);assert(b&&!b.disabled,'버튼 '+label);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const waitFor=async(check:()=>boolean)=>{for(let n=0;!check()&&n<80;n++)await ui.React.act(async()=>{await new Promise(r=>setTimeout(r,2));});assert(check(),container.textContent);};
 const change=async(label:string,value:string)=>{const n=nodes().find(v=>v.getAttribute('aria-label')===label);assert(n,'입력 '+label);const key=Object.keys(n).find(k=>k.startsWith('__reactProps'))!;await ui.React.act(async()=>((n as any)[key].onChange({target:{value}})));};
 const close=async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);};
 const hasText=(s:string)=>container.textContent.includes(s);
 const openDesign=async()=>{await click('확정 설계 열기');await waitFor(()=>hasText('설계 원문'));await click('이 버전에서 작업계획 작성');await waitFor(()=>hasText('작업계획 원문 후보'));};
 const choose=async()=>{await change('작업계획 원문 후보',plan.ref.id);await change('작업계획 원문 버전','1');};
 await render();
 return {flags,design,plan,head,transport,calls,button,click,waitFor,render,props:()=>props,change,close,openDesign,choose,hasText,buffer:()=>current,setBuffer:async(v:DocumentBuffer|null)=>{await ui.React.act(async()=>changeBuffer(v));},lost:()=>lost};
}

test('확정 AF02에서 명시 선택한 별도 AF04 정확 버전만 원문 작업계획 초안에 연결한다',async()=>{
 const f=await fixture();try{
   await f.openDesign();
   assert.equal(f.calls.filter(c=>c.path.endsWith('/documents/'+f.plan.ref.id+'/versions/1')).length,0);
   await f.choose();
   assert.equal(f.calls.filter(c=>c.path.endsWith('/documents/'+f.plan.ref.id+'/versions/1')).length,0);
   await f.click('선택한 AF04 버전에서 작업계획 준비');
   await f.waitFor(()=>!!f.buffer()?.workPlanState);
   const b=f.buffer()!;assert.equal(b.body,f.plan.body);assert.equal(b.documentId,f.plan.ref.id);assert.equal(b.baseHash,f.plan.ref.contentHash);
   assert.deepEqual(b.workPlanState?.input.documentRef,f.plan.ref);assert.deepEqual(b.workPlanState?.input.designRef,f.design.ref);
   assert.equal(b.workPlanState?.pending,null);assert.equal(b.workPlanState?.result,null);
   assert.equal(f.calls.some(c=>c.path.endsWith('/documents/'+f.head.ref.id+'/versions/2')),false);
   assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});

test('기존 AF04 직접 준비는 별도 설계 선택과 설계 인덱스 조회 없이 유지한다',async()=>{
 const f=await fixture();try{
   await f.click('계획 문서 열기');await f.waitFor(()=>f.hasText(f.head.body));
   await f.click('이 버전에서 작업계획 작성');
   await f.waitFor(()=>!!f.buffer()?.workPlanState);
   assert.deepEqual(f.buffer()?.workPlanState?.input.documentRef,f.head.ref);
   assert.equal(f.buffer()?.workPlanState?.input.designRef,null);
   assert.equal(f.calls.some(c=>c.path.includes('/design-index?')),false);
   assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});

for(const failure of ['UNCONFIRMED','SOURCE_HASH','TARGET_HASH','WRONG_FORM','PINNED_FORM','INDEX_SCOPE','CONTROL','CURRENT_401'] as const)test('설계에서 계획 준비 실패 '+failure+'는 초안을 적용하지 않는다',async()=>{
 const f=await fixture();try{
   await f.openDesign();await f.choose();
   const expected={
     UNCONFIRMED:'DESIGN_NOT_CONFIRMED',
     SOURCE_HASH:'DOCUMENT_REFERENCE_CHANGED',
     TARGET_HASH:'DOCUMENT_REFERENCE_CHANGED',
     WRONG_FORM:'WORK_PLAN_DOCUMENT_KIND_INVALID',
     PINNED_FORM:'RESPONSE_INVALID',
     INDEX_SCOPE:'RESPONSE_INVALID',
     CONTROL:'PROJECT_CONTROL_CHANGED',
     CURRENT_401:'AUTH_REQUIRED',
   }[failure];
   if(failure==='UNCONFIRMED')f.flags.designConfirmed=false;
   if(failure==='SOURCE_HASH')f.flags.badSourceHash=true;
   if(failure==='TARGET_HASH')f.flags.badTargetHash=true;
   if(failure==='WRONG_FORM')f.flags.wrongForm=true;
   if(failure==='PINNED_FORM')f.flags.badFormHash=true;
   if(failure==='INDEX_SCOPE')f.flags.badIndex=true;
   if(failure==='CONTROL')f.flags.controlGeneration=5;
   if(failure==='CURRENT_401')f.flags.target=async()=>Response.json({code:'AUTH_REQUIRED'},{status:401});
   await f.click('선택한 AF04 버전에서 작업계획 준비');
   await f.waitFor(()=>f.hasText(expected));
   assert.equal(f.buffer(),null);
   if(failure==='SOURCE_HASH'||failure==='UNCONFIRMED')assert(!f.calls.some(c=>c.path.endsWith('/documents/'+f.plan.ref.id+'/versions/1')));
   assert.equal(f.lost(),failure==='CURRENT_401'?1:0);
   assert.equal(f.calls.some(c=>c.path.includes('/design-index?')),failure==='INDEX_SCOPE'||failure==='CONTROL');
   assert(f.calls.every(c=>c.method==='GET'));
 }finally{await f.close();}
});

for(const leave of ['TRANSPORT','CSRF_ABA','CLOSE_PICKER','CHANGED_VERSION','CHANGED_SELECTION','LIST_REFRESH','UNMOUNT','REPLACED_BUFFER'] as const)test('지연 AF04 조회는 '+leave+' 뒤 보호 상태를 변경하지 않는다',async()=>{
 const f=await fixture();let closed=false;
 let arrive!:()=>void,finish!:(response:Response)=>void;
 const requested=new Promise<void>(resolve=>{arrive=resolve;});
 const response=new Promise<Response>(resolve=>{finish=resolve;});
 try{
   await f.openDesign();await f.choose();
   f.flags.target=()=>{arrive();return response;};
   await f.click('선택한 AF04 버전에서 작업계획 준비');
   await requested;
   const original=f.props();
   const dirty={...editDocument(original.projectId,{document:f.plan.doc,body:f.plan.body},original.session.user.id,4),dirty:true};
   if(leave==='TRANSPORT')original.client.transport=async(p:string,o:RequestInit)=>f.transport(p,o);
   if(leave==='CSRF_ABA'){
     await f.render({...original,session:{...original.session,csrfToken:'Y'.repeat(43)}});
     await f.render(original);
     assert.equal(f.button('선택한 AF04 버전에서 작업계획 준비'),undefined);
   }
   if(leave==='CLOSE_PICKER')await f.click('작업계획 원문 선택 닫기');
   if(leave==='CHANGED_VERSION')await f.change('작업계획 원문 버전','2');
   if(leave==='CHANGED_SELECTION')await f.click('계획 문서 열기');
   if(leave==='LIST_REFRESH')await f.click('문서 목록 새로고침');
   if(leave==='UNMOUNT'){await f.close();closed=true;}
   if(leave==='REPLACED_BUFFER')await f.setBuffer(dirty);
   if(leave==='CHANGED_SELECTION')await f.waitFor(()=>f.hasText(f.head.body));
   const before=f.calls.length;
   await ui.React.act(async()=>{finish(leave==='REPLACED_BUFFER'?Response.json(f.plan.doc):Response.json({code:'AUTH_REQUIRED'},{status:401}));await new Promise(r=>setImmediate(r));});
   assert.equal(f.buffer(),leave==='REPLACED_BUFFER'?dirty:null);
   assert.equal(f.lost(),0);
   assert.equal(f.calls.length,before);
   assert(f.calls.every(c=>c.method==='GET'));
 }finally{if(!closed)await f.close();}
});

for(const reopen of [false,true])test('이전 화면의 작업계획 작성 버튼은 새 인증 문맥을 빌려 조회하지 않는다 (ABA '+reopen+')',async()=>{
 const f=await fixture();try{
   await f.click('확정 설계 열기');await f.waitFor(()=>f.hasText(f.design.body));
   const b=f.button('이 버전에서 작업계획 작성');assert(b);
   const key=Object.keys(b).find(k=>k.startsWith('__reactProps'))!;
   const oldClick=(b as any)[key].onClick;
   const original=f.props();
   await f.render({...original,session:{...original.session,csrfToken:'Y'.repeat(43)}});
   if(reopen)await f.render(original);
   else {await f.click('계획 문서 열기');await f.waitFor(()=>f.hasText(f.head.body));}
   const before=f.calls.length;
   await ui.React.act(async()=>{oldClick();await new Promise(r=>setImmediate(r));});
   assert.equal(f.calls.length,before);
   assert.equal(f.buffer(),null);
   assert.equal(f.button('선택한 AF04 버전에서 작업계획 준비'),undefined);
   assert.equal(f.lost(),0);
 }finally{await f.close();}
});
