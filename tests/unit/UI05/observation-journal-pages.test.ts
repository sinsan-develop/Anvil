import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {resultFixture} from './result-view-fixture.ts';
import {observationJournalFor} from './observation-journal-fixture.ts';

/** 실제 ReactDOM의 요소/이벤트/effect를 실행하는 최소 메모리 DOM. 레이아웃·브라우저 보안·시각 검증은 아니다. */
class MemoryNode{
 nodeType:number;nodeName:string;tagName:string;localName:string;namespaceURI='http://www.w3.org/1999/xhtml';parentNode:MemoryNode|null=null;childNodes:MemoryNode[]=[];ownerDocument:any;attributes=new Map<string,string>();style:Record<string,unknown>={};listeners=new Map<string,Function[]>();value='';checked=false;disabled=false;data='';
 constructor(name:string,type=1,owner?:any){this.nodeType=type;this.nodeName=type===1?name.toUpperCase():name;this.tagName=this.nodeName;this.localName=name;this.ownerDocument=owner;}
 get nodeValue():string|null{return this.nodeType===3?this.data:null;}set nodeValue(v:string|null){if(this.nodeType===3)this.data=v??'';}
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
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/session-detail/ObservationJournalPages.tsx',import.meta.url)),client=fileURLToPath(new URL('../../../apps/web/src/api/client.ts',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:observation-pages',name:'ObservationPagesTest',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'observation-pages-memory',resolveId(id){if(id.endsWith('virtual:observation-pages'))return '\0observation-pages';},load(id){if(id==='\0observation-pages')return `import * as React from 'react';import{createRoot}from'react-dom/client';import{ObservationJournalPages}from${JSON.stringify(entry)};import{ApiClient}from${JSON.stringify(client)};export{React,createRoot,ObservationJournalPages,ApiClient};`;}}]});
 const window:any={document,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 for(const[key,value]of Object.entries({window,document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 ui=new Function((Array.isArray(result)?result[0]:result).output.find((o:any)=>o.type==='chunk').code+';return ObservationPagesTest;')();
});
after(()=>{for(const channel of channels){channel.port1.close();channel.port2.close();}for(const[key,value]of saved)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);});

const hash=(v:unknown)=>contentHash(canonicalJson(v));
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{resolve,promise};}

async function fixture(){
 const result=resultFixture().entry,base=observationJournalFor(result);
 const rows=Array.from({length:41},(_,i)=>{const row=structuredClone(base.items[0]!);row.ref.id=`${String(41-i).padStart(8,'0')}-1111-4111-8111-111111111111`;row.snapshot.event.eventId=row.ref.id;row.snapshot.event.sequence=41-i;row.ref.contentHash=hash(row.snapshot);return row;});
 const page=(cursor:string|null)=>{const before=cursor===null||cursor==='page-root'?null:Number(cursor.slice(5)),visible=rows.filter(r=>before===null||r.snapshot.event.sequence<before),items=visible.slice(0,20),hasMore=visible.length>20,ack=structuredClone(base.ack);Object.assign(ack.snapshot,{highestContiguous:41,maxSequence:41,gaps:[],storedCount:41});ack.ref.contentHash=hash(ack.snapshot);return{...base,items,ack,storedCount:41,hasMore,snapshotMaxSequence:41,snapshotDigest:hash(rows.map(r=>r.ref)),snapshotCount:41,beforeSequence:before,cursorExpiresAt:'2026-10-20T00:00:30.000Z',pageCursor:cursor??'page-root',nextCursor:hasMore?'page-'+items.at(-1)!.snapshot.event.sequence:null};};
 const calls:(string|null)[]=[],errors:string[]=[],controls={read:async(cursor:string|null)=>Response.json(page(cursor))};
 const client=new ui.ApiClient(async(input:any,init:any)=>{assert.equal(init?.method,'GET');const cursor=new URL(String(input),'https://synthetic.invalid').searchParams.get('cursor');calls.push(cursor);return controls.read(cursor);});
 const container=document.createElement('div');document.body.appendChild(container);const root=ui.createRoot(container);let props:any={client,result,onOpen:()=>{},onUnavailable:(code:string)=>errors.push(code)};
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(c=>nodes(c))],has=(text:string)=>nodes().some(n=>n.tagName==='BUTTON'&&n.textContent===text),button=(text:string)=>{const n=nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===text);assert.ok(n,'버튼 '+text);return n;};
 const render=async(next=props)=>{props=next;await ui.React.act(async()=>root.render(ui.React.createElement(ui.ObservationJournalPages,props)));};
 const click=async(text:string)=>{const b=button(text);assert(!b.disabled);await ui.React.act(async()=>b.dispatchEvent({type:'click',button:0}));};
 const settle=async()=>{await ui.React.act(async()=>{await new Promise(r=>setTimeout(r,15));});};
 const wait=async(check:()=>boolean)=>{const end=Date.now()+2000;while(!check()&&Date.now()<end)await settle();assert(check(),container.textContent);};
 await render();return{props:()=>props,render,client,calls,errors,controls,page,button,has,click,settle,wait,text:()=>container.textContent,close:async()=>{await ui.React.act(async()=>root.unmount());document.body.removeChild(container);}};
}
const retry='같은 관측 페이지 재조회';
async function open(f:Awaited<ReturnType<typeof fixture>>){assert.equal(f.calls.length,0);await f.click('관측 페이지 탐색');await f.wait(()=>f.text().includes('페이지 1'));}
test('관측 다음 페이지 전송 실패는 원 cursor 재조회와 이전 페이지 복귀를 보존한다',async()=>{
 const f=await fixture();try{await open(f);await f.click('페이지 관측 원문 41');const normal=f.controls.read;f.controls.read=async()=>{throw Error('synthetic transport');};await f.click('더 이전 관측 20건');await f.wait(()=>f.text().includes('CONNECTION_LOST'));assert(!f.text().includes('페이지 선택 관측 원문'));assert(!f.text().includes('기록 ID'));assert(f.has(retry),'명시 동일 cursor 재조회 누락');assert.deepEqual(f.calls,[null,'page-22']);await f.settle();assert.equal(f.calls.length,2,'자동 재조회 금지');f.controls.read=normal;await f.click(retry);await f.wait(()=>f.text().includes('페이지 2'));assert.deepEqual(f.calls,[null,'page-22','page-22']);await f.click('이후 관측 페이지');await f.wait(()=>f.text().includes('페이지 1'));assert.equal(f.calls.at(-1),'page-root');}finally{await f.close();}
});
test('관측 권한·형상·만료·서버 동명 오류는 재조회 위치를 폐기한다',async()=>{
 for(const mode of ['401','403','404','503','INVALID503','HASH','EXPIRED','SNAPSHOT']){const f=await fixture();try{await open(f);f.controls.read=async c=>{if(/^\d/.test(mode))return Response.json({code:'CONNECTION_LOST'},{status:Number(mode)});if(mode==='INVALID503')return new Response('invalid',{status:503});const p:any=f.page(c);if(mode==='HASH')p.items[0].ref.contentHash='f'.repeat(64);if(mode==='EXPIRED')p.cursorExpiresAt=p.observedAt;if(mode==='SNAPSHOT')p.snapshotDigest='f'.repeat(64);return Response.json(p);};await f.click('더 이전 관측 20건');await f.wait(()=>f.text().includes('페이지 미확인'));assert(!f.has(retry),mode);assert(!f.text().includes('순번 41'));assert.equal(f.errors.length,['401','403','404'].includes(mode)?1:0);}finally{await f.close();}}
});
test('관측 재조회는 동시 클릭 한 건만 보내고 원 탐색 기한을 연장하지 않는다',async()=>{
 const f=await fixture(),gate=deferred<Response>();const original=Object.getOwnPropertyDescriptor(performance,'now'),now=performance.now.bind(performance);let offset=0;
 try{Object.defineProperty(performance,'now',{configurable:true,value:()=>now()+offset});await open(f);f.controls.read=async()=>{throw Error('transport');};await f.click('더 이전 관측 20건');await f.wait(()=>f.has(retry));f.controls.read=()=>gate.promise;const b=f.button(retry);await ui.React.act(async()=>{b.dispatchEvent({type:'click',button:0});b.dispatchEvent({type:'click',button:0});});assert.equal(f.calls.length,3);offset=31000;gate.resolve(Response.json(f.page('page-22')));await f.wait(()=>f.text().includes('RESULT_OBSERVATION_RESPONSE_INVALID'));assert(!f.has(retry));assert(!f.text().includes('페이지 2'));assert.equal(f.calls.length,3);}finally{gate.resolve(Response.json(f.page('page-22')));if(original)Object.defineProperty(performance,'now',original);else Reflect.deleteProperty(performance,'now');await f.close();}
});
test('관측 지연 성공·실패는 프로젝트·원 보고·transport 교체 후 반영하지 않는다',async()=>{
 for(const mode of ['PROJECT','RESULT','TRANSPORT'])for(const status of [200,401]){const f=await fixture(),gate=deferred<Response>();try{await open(f);f.controls.read=()=>gate.promise;await f.click('더 이전 관측 20건');const p=f.props();if(mode==='TRANSPORT'){f.client.transport=async()=>Response.json(f.page(null));await f.render();}else{const r=structuredClone(p.result);if(mode==='PROJECT')r.snapshot.scope.projectId=crypto.randomUUID();else r.ref.id=crypto.randomUUID();await f.render({...p,result:r});}gate.resolve(status===401?Response.json({code:'AUTH_REQUIRED'},{status}):Response.json(f.page('page-22')));await f.settle();assert(!f.text().includes('페이지 2'),mode);assert(!f.has(retry));assert.equal(f.errors.length,0);assert(!f.button('관측 페이지 탐색').disabled);}finally{gate.resolve(Response.json(f.page('page-22')));await f.close();}}
});

test('재조회 대기 중 기한 소실은 GET0이며 현재 401 콜백은 기한과 별도로 유지한다',async()=>{
 for(const mode of ['RETRY_EXPIRED','401']){const f=await fixture(),gate=deferred<Response>(),descriptor=Object.getOwnPropertyDescriptor(performance,'now'),now=performance.now.bind(performance);let offset=0;
 try{Object.defineProperty(performance,'now',{configurable:true,value:()=>now()+offset});await open(f);
 if(mode==='RETRY_EXPIRED'){f.controls.read=async()=>{throw Error('transport');};await f.click('더 이전 관측 20건');await f.wait(()=>f.has(retry));const count=f.calls.length;offset=31000;await f.click(retry);assert.equal(f.calls.length,count);assert(!f.has(retry));assert(f.text().includes('CURSOR_EXPIRED'));}
 else{f.controls.read=()=>gate.promise;await f.click('더 이전 관측 20건');offset=31000;gate.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));await f.wait(()=>f.errors.length===1);assert.deepEqual(f.errors,['AUTH_REQUIRED']);assert(!f.has(retry));}
 }finally{gate.resolve(Response.json({code:'AUTH_REQUIRED'},{status:401}));if(descriptor)Object.defineProperty(performance,'now',descriptor);else Reflect.deleteProperty(performance,'now');await f.close();}}
});
