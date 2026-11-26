import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {prepareCheckpointDraft} from '../../../apps/server/modules/checkpoints/checkpoint-input.ts';
import {createCheckpointRecord} from '../../../apps/server/modules/checkpoints/checkpoint-record.ts';
import {transferFixture,pid} from './transfer-fixture.ts';
import {resultFixture,hash} from '../UI05/result-view-fixture.ts';
import {observationJournalFor} from '../UI05/observation-journal-fixture.ts';
import {stopHistoryFor} from '../UI05/stop-request-history-fixture.ts';

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
const saved=new Map<string,PropertyDescriptor|undefined>();
const NativeChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];
class OwnedChannel extends NativeChannel{constructor(){super();channels.push(this);}}
let bundle:string;
before(async()=>{
 const entry=fileURLToPath(new URL('../../browser/UI09/transfer-checkpoint-dom-harness.tsx',import.meta.url));
 const output:any=await build({configFile:false,envDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:transfer-checkpoint-qa',name:'TransferCheckpointMemory',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'transfer-checkpoint-qa',resolveId(id){if(id.endsWith('virtual:transfer-checkpoint-qa'))return '\0transfer-checkpoint-qa';},load(id){if(id==='\0transfer-checkpoint-qa')return 'import '+JSON.stringify(entry)+";export{act}from'react';";}}]});
 bundle=(Array.isArray(output)?output[0]:output).output.find((o:any)=>o.type==='chunk').code;
 for(const [key,value]of Object.entries({document,HTMLElement:MemoryNode,Node:MemoryNode,IS_REACT_ACT_ENVIRONMENT:true,MessageChannel:OwnedChannel})){
  saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
 }
 saved.set('window',Object.getOwnPropertyDescriptor(globalThis,'window'));
});
after(()=>{
 for(const channel of channels){channel.port1.close();channel.port2.close();}
 for(const [key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
});

const at='2026-10-21T12:01:00.000Z',id=(n:number)=>'af140059-1111-4111-8111-'+String(n).padStart(12,'0');
const apiPath='/api/v1/projects/'+pid+'/';
type SeedOptions={checkpoint?:'MISSING'|'WRONG_HASH';execution?:'WRONG_HASH';result?:'WRONG_PROJECT'|'WRONG_ASSIGNMENT';source?:'WRONG_REF'};
function seed(options:SeedOptions={}){
 const fixture=transferFixture(),original=fixture.confirmed,run=resultFixture(),execution=run.entry.snapshot.scope.executionRef;
 const record=(n:number)=>{
  const input:any={baseRef:null,reason:'인계용 기록',state:{assignmentRef:original.ref,executionRefs:[execution],baselineRefs:original.snapshot.definition.baselineRefs,currentPosition:{taskRef:original.snapshot.definition.taskRef,description:'작업 확인 중'},completedItems:[],inProgress:[],remaining:[],sourceSnapshotRefs:[],changedFiles:[],verificationRefs:[],errorFingerprints:[],attemptCounts:[],lastLocalSequence:3,lastServerAck:null,untransmittedRefs:[],pendingDecisions:[],nextAction:'사람 판단',forbiddenActions:['자동 재개'],recordFileRef:null}};
  const entry=createCheckpointRecord(prepareCheckpointDraft(original,input),{kind:'HUMAN',userId:id(11),clientId:id(12)},at);
  return{projectId:pid,ref:{id:id(n),version:1,contentHash:hash(entry.snapshot)},...entry,observedAt:at,serverSequence:n};
 };
 const records=[record(1),record(2)],checkpoint=records[1]!,older=records[0]!;
 const cp=options.checkpoint==='MISSING'?null:options.checkpoint==='WRONG_HASH'?{...checkpoint.ref,contentHash:'f'.repeat(64)}:checkpoint.ref;
 const resultExecution=options.execution==='WRONG_HASH'?{...execution,contentHash:'f'.repeat(64)}:execution;
 const resultAssignment=options.result==='WRONG_ASSIGNMENT'?{...original.ref,contentHash:'e'.repeat(64)}:original.ref;
 const result=(n:number,foreign=false)=>{
  const item=resultFixture().entry,scope={projectId:foreign&&options.result==='WRONG_PROJECT'?id(99):pid,assignmentRef:foreign?resultAssignment:original.ref,executionRef:resultExecution};
  Object.assign(item.snapshot,{scope,manifest:{...item.snapshot.manifest,assignmentRef:scope.assignmentRef,executionRef:resultExecution,checkpointRef:cp}});
  item.snapshot.manifestHash=hash(item.snapshot.manifest);item.ref={id:id(n),version:1,contentHash:hash(item.snapshot)};
  return item;
 };
 const first=result(30),second=result(31,true),detail=options.source==='WRONG_REF'?{...second,ref:{...second.ref,contentHash:'f'.repeat(64)}}:second;
 const summary=(item:typeof first)=>({ref:item.ref,manifestRef:{id:item.ref.id,version:1,contentHash:item.snapshot.manifestHash},executionRef:item.snapshot.scope.executionRef,submissionState:item.snapshot.manifest.submissionState,submittedByRef:item.snapshot.submittedByRef,submittedAt:item.snapshot.submittedAt,sourceKind:'WORKER_CLAIM',evidenceProvenanceVerified:false,completionAccepted:false});
 const listUrl='assignments/'+original.ref.id+'/versions/'+original.ref.version+'/result-pages',base={projectId:pid,assignmentRef:original.ref,observedAt:at,selectionState:'NOT_SELECTED'};
 const nextCursor='opaque cursor /+';
 // Existing API requires 20 records before a next cursor. IDs provide deterministic newest-first order at equal time.
 const firstPage=Array.from({length:20},(_,i)=>summary(result(80-i)));
 const resultResponses:Record<string,unknown>={
  [listUrl]:{...base,items:firstPage,hasMore:true,nextCursor},
  [listUrl+'?cursor='+encodeURIComponent(nextCursor)]:{...base,items:[summary(second),summary(first)],hasMore:false,nextCursor:null},
  ['results/'+second.ref.id]:detail,['results/'+first.ref.id]:first,
  ['results/'+second.ref.id+'/observation-journal']:observationJournalFor(second),
  ['results/'+second.ref.id+'/stop-requests']:stopHistoryFor(second),
 };
 const compact=(r:typeof checkpoint)=>({ref:r.ref,assignmentRef:original.ref,previousRef:null,recordedAt:at,serverSequence:r.serverSequence});
 const session={user:{id:id(11)},clientId:id(12),csrfToken:'a'.repeat(43)};
 return{manualMount:true,session,fixture,records,pages:[{items:[compact(checkpoint),compact(older)],hasMore:false,nextCursor:null,observedAt:at}],otherProject:id(99),resultResponses,checkpoint,older,first,second,listUrl,nextCursor};
}

async function host(options:SeedOptions={}){
 const data=seed(options),container=document.createElement('div');container.setAttribute('id','root');document.body.appendChild(container);
 document.getElementById=(v:string)=>v==='root'?container:null;
 const window:any={document,__transferCheckpointSeed:data,HTMLElement:MemoryNode,HTMLIFrameElement:class{},Node:MemoryNode,addEventListener(){},removeEventListener(){},getComputedStyle:()=>({}),location:{protocol:'https:'}};document.defaultView=window;
 Object.defineProperty(globalThis,'window',{value:window,writable:true,configurable:true});
 const ui=new Function(bundle+';return TransferCheckpointMemory;')(),qa=window.__transferCheckpointQA;
 await ui.act(async()=>qa.mount());
 const nodes=(n:MemoryNode=container):MemoryNode[]=>[n,...n.childNodes.flatMap(nodes)];
 const buttons=(name:string)=>nodes().filter(n=>n.tagName==='BUTTON'&&n.textContent===name);
 const click=async(name:string)=>{const matches=buttons(name);assert.equal(matches.length,1,name+' '+container.textContent.slice(-550));const b=matches[0]!;assert(!b.disabled,name);await ui.act(async()=>b.dispatchEvent({type:'click',button:0,bubbles:true}));};
 const settle=async(check:()=>boolean)=>{const end=Date.now()+2000;while(!check()&&Date.now()<end)await ui.act(async()=>{await new Promise(r=>setTimeout(r,2));});assert(check(),container.textContent.slice(-900));};
 const region=(name:string)=>nodes().some(n=>n.getAttribute('aria-label')===name);
 const primary=async()=>{await settle(()=>buttons('기존 인계 기록 조회').length===1);await click('기존 인계 기록 조회');await settle(()=>buttons('이전 작업현황 목록 조회').length===1);await click('이전 작업현황 목록 조회');await settle(()=>buttons('작업현황 원문 '+data.checkpoint.ref.id).length===1);await click('작업현황 원문 '+data.checkpoint.ref.id);await settle(()=>region('이전 작업현황 고정 원문'));};
 const change=async(v:string)=>{await ui.act(async()=>qa.change(v));};
 const release=async()=>{await ui.act(async()=>qa.release());};
 const beforeCommit=async(first:string,second:string)=>{
  const handlers=[first,second].map(name=>{
   const [b]=buttons(name);assert(b&&!b.disabled,name);
   const key=Object.keys(b).find(k=>k.startsWith('__reactProps'));assert(key,name);
   return(b as any)[key].onClick as ()=>void;
  });
  await ui.act(async()=>{
   handlers[0]!();handlers[1]!();
   await new Promise(resolve=>setTimeout(resolve,25));
  });
 };
 const close=async()=>{if(qa.release)await release();await ui.act(async()=>qa.unmount());qa.restoreCrypto();document.body.removeChild(container);};
 return{data,qa,click,settle,buttons,region,primary,change,release,beforeCommit,close,text:()=>container.textContent,get calls():string[]{return qa.calls.map((c:{url:string})=>c.url);}};
}

const listLabel='체크포인트의 제출 결과 목록 조회',nextLabel='이전 제출 결과 더 보기',resultLabel=(item:{ref:{id:string}})=>'제출 결과 원문 대조 '+item.ref.id,comparison='현황 기록·보관 ACK 비교';
const advance=async(f:Awaited<ReturnType<typeof host>>)=>{
 await f.click(listLabel);await f.settle(()=>f.buttons(nextLabel).length===1);await f.click(nextLabel);
 await f.settle(()=>f.buttons(resultLabel(f.data.second)).length===1);
};
test('UI09는 명시 페이지·원문 선택 뒤에만 같은 실행의 ACK·중지 비교를 조회한다',async()=>{
 const f=await host();
 try{
  await f.primary();
  assert(f.calls.every((u:string)=>!u.includes('/result-pages')&&!u.includes('/results/')));
  await advance(f);
  assert.deepEqual(f.calls.filter((u:string)=>u.includes('/result-pages')),[apiPath+f.data.listUrl,apiPath+f.data.listUrl+'?cursor='+encodeURIComponent(f.data.nextCursor)]);
  assert(!f.region(comparison));
  assert(f.calls.every((u:string)=>!u.includes('/results/')));
  await f.click(resultLabel(f.data.second));await f.settle(()=>f.region(comparison));
  assert.equal(f.buttons('선택 기록과 보관 ACK 대조').length,0);
  assert(!f.text().includes('로컬 파일 대조는 위의 현황 기록 파일'));
  const root=apiPath+'results/'+f.data.second.ref.id;
  assert.deepEqual(f.calls.filter((u:string)=>u.includes('/results/')),[root]);
  await f.click('서버 기록과 보관 ACK 대조');
  await f.settle(()=>f.buttons('재개 전 중지 기록 대조').length===1);
  assert(f.text().includes('재개 불가'));
  await f.click('재개 전 중지 기록 대조');
  await f.settle(()=>f.region('재개 전 보관 중지 기록 대조 결과'));
  assert(f.text().includes('합성 원장'));
  assert(f.text().includes('쓰기 소유와 권한 회수 미확인'));
  assert.equal(f.qa.writes.length,0);
 }finally{await f.close();}
});

test('결과 원문의 체크포인트·실행·임무·프로젝트·결과 버전 참조를 바꿔도 대조는 열리지 않는다',async()=>{
 const cases:SeedOptions[]=[{checkpoint:'MISSING'},{checkpoint:'WRONG_HASH'},{execution:'WRONG_HASH'},{result:'WRONG_ASSIGNMENT'},{result:'WRONG_PROJECT'},{source:'WRONG_REF'}];
 for(const options of cases){
  const f=await host(options);
  try{
   await f.primary();
   if(options.execution){
    await f.click(listLabel);await f.settle(()=>f.buttons(nextLabel).length===1);
    await f.click(nextLabel);await f.settle(()=>f.text().includes('실행과 일치하는 제출 결과 없음'));
    assert.equal(f.buttons(resultLabel(f.data.second)).length,0);
    assert.equal(f.calls.filter(u=>u.includes('/results/')).length,0);
   }else{
    await advance(f);await f.click(resultLabel(f.data.second));
    await f.settle(()=>f.text().includes(options.checkpoint?'CHECKPOINT_RESULT_NOT_MATCHED':'RESULT_RESPONSE_INVALID'));
    assert.equal(f.calls.filter(u=>u.includes('/results/')).length,1);
   }
   assert(!f.region(comparison));
   assert(!f.calls.some(u=>u.endsWith('/observation-journal')||u.endsWith('/stop-requests')));
   assert.equal(f.qa.writes.length,0);
  }finally{await f.close();}
 }
});

test('보호 원문 401·403·404는 같은 선택을 폐기하고 401만 현재 인증에 전달한다',async()=>{
 for(const mode of ['AUTH','DENIED','MISSING']){
  const f=await host();
  try{
   await f.primary();await advance(f);f.qa.next=mode;
   await f.click(resultLabel(f.data.second));
   await f.settle(()=>f.text().includes(mode==='AUTH'?'AUTH_REQUIRED':mode==='DENIED'?'PROJECT_READ_DENIED':'NOT_FOUND'));
   assert.equal(f.qa.authLost,mode==='AUTH'?1:0);
   assert(!f.region(comparison));
   assert.equal(f.qa.writes.length,0);
  }finally{await f.close();}
 }
});

test('선택 교체와 페이지 이탈 뒤 이전 원문·401은 후속 맥락에 도달하지 않는다',async()=>{
 for(const mode of ['DELAY','DELAY_AUTH'])for(const transition of ['ANOTHER_RESULT','ANOTHER_CHECKPOINT','REF','HIDE','CSRF','NEW_CLIENT','TRANSPORT']){
  const f=await host();
  try{
   await f.primary();await advance(f);f.qa.next=mode;
   await f.click(resultLabel(f.data.second));await f.settle(()=>typeof f.qa.release==='function');
   if(transition==='ANOTHER_RESULT'){
    // 다른 명시 선택이 들어오면 이전 결과의 권한과 표시를 폐기한다.
    f.qa.next='MISSING';await f.click(resultLabel(f.data.first));
    await f.settle(()=>f.text().includes('NOT_FOUND'));
   }else if(transition==='ANOTHER_CHECKPOINT'){
    await f.click('작업현황 원문 '+f.data.older.ref.id);
    await f.settle(()=>f.region('이전 작업현황 고정 원문')&&f.text().includes(f.data.older.ref.contentHash));
   }else if(transition==='TRANSPORT')f.qa.swapWithoutRender();
   else await f.change(transition);
   await f.release();
   assert.equal(f.qa.authLost,0,transition);
   assert(!f.region(comparison),transition);
   assert(!f.calls.some(u=>u.endsWith('/observation-journal')||u.endsWith('/stop-requests')),transition);
   assert.equal(f.qa.writes.length,0);
  }finally{await f.close();}
 }
});

test('결과 선택 폐기 직후 DOM 정착 전의 기존 ACK·중지 버튼은 보호 GET을 시작하지 않는다',async()=>{
 for(const compare of [false,true])for(const source of ['RESULT','CHECKPOINT']){
  const f=await host();
  try{
   await f.primary();await advance(f);await f.click(resultLabel(f.data.second));await f.settle(()=>f.region(comparison));
   if(compare){await f.click('서버 기록과 보관 ACK 대조');await f.settle(()=>f.buttons('재개 전 중지 기록 대조').length===1);}
   const old=apiPath+'results/'+f.data.second.ref.id;
   const before=f.calls.filter(u=>u.startsWith(old+'/')).length;
   f.qa.next='DELAY';
   await f.beforeCommit(source==='RESULT'?resultLabel(f.data.first):'이전 작업현황 원문 닫기',compare?'재개 전 중지 기록 대조':'서버 기록과 보관 ACK 대조');
   assert.equal(f.calls.filter(u=>u.startsWith(old+'/')).length,before);
   assert.equal(f.qa.authLost,0);
   assert.equal(f.qa.writes.length,0);
  }finally{await f.close();}
 }
});

test('공유 보관 비교의 늦은 401은 결과 교체 후 새 인증이나 요청에 영향을 주지 않는다',async()=>{
 for(const resume of [false,true]){
  const f=await host();
  try{
   await f.primary();await advance(f);await f.click(resultLabel(f.data.second));await f.settle(()=>f.region(comparison));
   if(resume){await f.click('서버 기록과 보관 ACK 대조');await f.settle(()=>f.buttons('재개 전 중지 기록 대조').length===1);}
   f.qa.next='DELAY_AUTH';
   await f.click(resume?'재개 전 중지 기록 대조':'서버 기록과 보관 ACK 대조');
   await f.settle(()=>typeof f.qa.release==='function');
   const next=apiPath+'results/'+f.data.first.ref.id;
   await f.click(resultLabel(f.data.first));
   await f.settle(()=>f.region(comparison)&&f.qa.calls.some((entry:any)=>entry.url===next&&entry.settled));
   await f.release();
   assert.equal(f.qa.authLost,0);
   assert.equal(f.calls.filter(u=>u.startsWith(next+'/')).length,0);
   assert(f.region(comparison));
   assert.equal(f.qa.writes.length,0);
  }finally{await f.close();}
 }
});
