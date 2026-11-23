import assert from 'node:assert/strict';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'vite';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readNormalClaimRangeHistory} from '../../../apps/web/src/features/workspace/claim-understanding-history.ts';

type UI=typeof import('../../../apps/web/src/features/workspace/NormalUnderstandingDiscovery.tsx');
type Workspace=typeof import('../../../apps/web/src/features/workspace/WorkspaceResponsibleSessions.tsx');
type HistoricalUI=typeof import('../../../apps/web/src/features/workspace/NormalUnderstandingRangeHistory.tsx');
let compiled:Promise<UI>|undefined;
function load(){
 return compiled??=compile();
}
async function compile(hooks?:string):Promise<UI>;
async function compile(hooks:string,entryFile:'WorkspaceResponsibleSessions'):Promise<Workspace>;
async function compile(hooks:string,entryFile:'NormalUnderstandingRangeHistory'):Promise<HistoricalUI>;
async function compile(hooks?:string,entryFile='NormalUnderstandingDiscovery'):Promise<UI|Workspace|HistoricalUI>{
  const entry=fileURLToPath(new URL(`../../../apps/web/src/features/workspace/${entryFile}.tsx`,import.meta.url));
  const built=await build({configFile:false,logLevel:'error',build:{write:false,lib:{entry,formats:['es']},rollupOptions:{external:['react','react/jsx-runtime']}}});
  const output=Array.isArray(built)?built[0]:built;
  assert.ok(output&&'output'in output);
  const chunk=output.output.find(value=>value.type==='chunk');assert.ok(chunk&&chunk.type==='chunk');
  const code=chunk.code.replace(/(["'])(react(?:\/jsx-runtime)?)\1/g,(_match,_quote,name)=>JSON.stringify(name==='react'&&hooks?hooks:import.meta.resolve(name)));
  return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}

const id=(n:number)=>`af090102-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
const projectId=id(1),session={user:{id:id(2)},clientId:id(3),csrfToken:'c'.repeat(43)},assignmentRef=ref(5),preparationRef=ref(6);

function rangeSource(){
 const part={outputRef:ref(44),sequence:3,payloadDigest:'b'.repeat(64),blockIndex:0,kind:'ASSISTANT_TEXT' as const,text:'<script>원 선택만</script>',textHash:contentHash('<script>원 선택만</script>')};
 const selection={requestRef:ref(40),resultRef:ref(41),initConfirmationRef:ref(42),tailRef:ref(45),firstSequence:3,lastSequence:3,ranges:[{outputRef:part.outputRef,sequence:3,payloadDigest:part.payloadDigest,textBlocks:1,textBytes:Buffer.byteLength(part.text)}]};
 const request={projectId,executionId:id(8),executionGeneration:7,assignmentRef,preparationRef,requestRef:ref(46)};
 const input={request,controlGeneration:9,expiresAt:new Date(Date.now()+25000).toISOString(),selection};
 const body={schemaVersion:1 as const,kind:'FIXED_RANGE_SELECTION' as const,attribution:'SESSION_ONLY' as const,projectId,executionId:request.executionId,executionGeneration:7,requestRef:request.requestRef,acquisitionRef:ref(47),sourceRequestRef:selection.requestRef,sourceResultRef:selection.resultRef,contextBundleRef:{...ref(48),version:4},initConfirmationRef:selection.initConfirmationRef,tailRef:selection.tailRef,firstSequence:3,lastSequence:3,beforeRef:ref(49),afterRef:selection.tailRef,parts:[part],wholeConversationComplete:false as const,executionAuthorized:false as const};
 const result={status:'RANGE_STORED' as const,request,resultRef:ref(50),responseRef:{...ref(51),contentHash:contentHash(canonicalJson(body))},partRefs:[{...ref(52),contentHash:contentHash(canonicalJson(part))}],currentness:'CURRENT' as const,observedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+20000).toISOString(),selectionAvailable:true as const,body};
 return {input,result};
}

test('FN09 고정 보관 원문 reader는 원 선택·hash와 같은 제어의 명시 same-origin GET만 반환한다',async()=>{
 const m=await load(),f=rangeSource(),calls:{path:string;init?:RequestInit}[]=[];
 const client=new ApiClient(async(url,init)=>{const path=String(url);calls.push({path,init});return path===`/api/v1/projects/${projectId}`?Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}}):Response.json(f.result);});
 const signal=new AbortController().signal;
 assert.deepEqual(await m.readNormalUnderstandingRange(client,session,f.input,signal,()=>true),f.result);
 assert.equal(calls.length,3);assert.ok(calls[1]!.path.includes('/'+f.input.request.requestRef.id+'/range-current?'));
 assert.notEqual(calls[0]!.init?.signal,signal);assert.equal(calls[0]!.init?.signal?.aborted,false);
 for(const call of calls){assert.equal(call.init?.method,'GET');assert.equal(call.init?.credentials,'same-origin');assert.equal(call.init?.cache,'no-store');assert.equal(call.init?.signal,calls[0]!.init?.signal);assert.equal(call.init?.body,undefined);}
 assert.equal(new Headers(calls[1]!.init?.headers).get('x-anvil-csrf'),session.csrfToken);
});

test('FN09 정착 원문은 원 전달 +31초 뒤 명시 GET의 새 제어·30초 창을 쓰며 만료 pending이나 늦은 새 응답을 보존하지 않는다',async t=>{
 const m=await load(),f=rangeSource(),start=Date.now();let now=start+31000,mode='stored',calls=0;
 f.input.expiresAt=new Date(start+30000).toISOString();t.mock.method(Date,'now',()=>now);
 const client=new ApiClient(async()=>{calls++;if(calls%3!==2)return Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}});
  if(mode==='pending')return Response.json({status:'PENDING_SOURCE',request:f.input.request});
  return Response.json({...f.result,observedAt:new Date(now).toISOString(),expiresAt:new Date(mode==='expired'?now-1:now+20000).toISOString()});});
 try{
  assert.equal((await m.readNormalUnderstandingRange(client,session,f.input,new AbortController().signal,()=>true)).status,'RANGE_STORED');assert.equal(calls,3);
  mode='pending';assert.equal((await m.readNormalUnderstandingRange(client,session,f.input,new AbortController().signal,()=>true)).status,'CURRENT_UNAVAILABLE');assert.equal(calls,6);
  mode='expired';await assert.rejects(m.readNormalUnderstandingRange(client,session,f.input,new AbortController().signal,()=>true),{code:'RESPONSE_INVALID'});assert.equal(calls,8);
 }finally{t.mock.restoreAll();}
});

test('FN09 원문 reader는 source/part/경계 오염·UTF8·중복키와 현재성 변경을 원문 반환 전에 거절한다',async t=>{
 const m=await load();
 const changes=[(v:any)=>{v.request.requestRef=ref(90);},(v:any)=>{v.body.acquisitionRef=null;},(v:any)=>{v.body.sourceRequestRef=ref(90);},
  (v:any)=>{v.body.sourceResultRef=ref(90);},(v:any)=>{v.body.firstSequence=2;},(v:any)=>{v.body.contextBundleRef=null;},
  (v:any)=>{v.body.parts[0].blockIndex=1;},(v:any)=>{v.body.parts[0].kind='SYSTEM_INIT';},(v:any)=>{v.body.parts[0].text+='changed';},
  (v:any)=>{v.body.parts[0].textHash='0'.repeat(64);},(v:any)=>{v.partRefs[0].contentHash='0'.repeat(64);},(v:any)=>{v.partRefs[0].id=v.resultRef.id;},
  (v:any)=>{v.responseRef.id=v.body.parts[0].outputRef.id;},(v:any)=>{v.body.beforeRef=v.body.parts[0].outputRef;},(v:any)=>{v.body.afterRef={...v.body.tailRef,contentHash:'0'.repeat(64)};},
  (v:any)=>{v.body.parts[0].text='\ud800';},(v:any)=>{v.body.raw='private';},(v:any)=>{v.body.executionAuthorized=true;},(v:any)=>{v.currentness='HISTORICAL';},
  (v:any)=>{v.expiresAt=new Date(0).toISOString();},(v:any)=>{v.responseRef.contentHash='0'.repeat(64);}];
 for(const [i,change]of changes.entries()){const f=rangeSource();change(f.result);if(i!==changes.length-1&&f.result.body.parts[0]!.text.isWellFormed())f.result.responseRef.contentHash=contentHash(canonicalJson(f.result.body));let calls=0;const client=new ApiClient(async()=>++calls===1?Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}}):Response.json(f.result));
  await assert.rejects(m.readNormalUnderstandingRange(client,session,f.input,new AbortController().signal,()=>true),{code:'RESPONSE_INVALID'});assert.equal(calls,2);
 }
 for(const mode of ['duplicate','utf8','pending-raw','late401','changed-input','changed-transport','post-control','hash-current']){
  const f=rangeSource();let calls=0,active=true;const transport:typeof fetch=async()=>{
   calls++;if(calls!==2)return Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:mode==='post-control'&&calls===3?10:9,status:'HELD'}});
   if(mode==='duplicate')return new Response(JSON.stringify(f.result).replace('{','{"status":"PENDING_SOURCE",'),{headers:{'content-type':'application/json'}});
   if(mode==='utf8')return new Response(new Uint8Array([255]),{headers:{'content-type':'application/json'}});
   if(mode==='pending-raw')return Response.json({status:'PENDING_SOURCE',request:f.input.request,body:f.result.body});
   if(mode==='late401'){active=false;return Response.json({code:'AUTH_REQUIRED'},{status:401});}
   if(mode==='changed-input')f.input.request.assignmentRef=ref(99);
   if(mode==='changed-transport')client.transport=async()=>{throw Error('NEW_TRANSPORT_NOT_CALLED');};
   return Response.json(f.result);
  },client=new ApiClient(transport);
  if(mode==='hash-current'){const digest=crypto.subtle.digest.bind(crypto.subtle);t.mock.method(crypto.subtle,'digest',async(...args:Parameters<typeof digest>)=>{active=false;return digest(...args);});}
  try{const value=m.readNormalUnderstandingRange(client,session,f.input,new AbortController().signal,()=>active);
   if(mode==='post-control')assert.equal((await value).status,'CURRENT_UNAVAILABLE');else await assert.rejects(value,{code:['late401','changed-input','changed-transport','hash-current'].includes(mode)?'DISCOVERY_SCOPE_CHANGED':'RESPONSE_INVALID'});
   assert.equal(calls,mode==='post-control'?3:2);
  }finally{t.mock.restoreAll();}
 }
});

test('FN09 원문 HTTP 전체 2MiB는 실제 bytes로 수용하고 +1/끝없는 stream은 잘림 없이 취소한다',async()=>{
 const m=await load();
 for(const extra of [0,1]){const f=rangeSource(),p=f.result.body.parts[0]!;p.text='';p.textHash=contentHash('');
  const size=Buffer.byteLength(canonicalJson(f.result));p.text='x'.repeat(2097152-size+extra);p.textHash=contentHash(p.text);f.input.selection.ranges[0]!.textBytes=Buffer.byteLength(p.text);
  f.result.responseRef.contentHash=contentHash(canonicalJson(f.result.body));f.result.partRefs[0]!.contentHash=contentHash(canonicalJson(p));assert.equal(Buffer.byteLength(JSON.stringify(f.result)),2097152+extra);
  let calls=0;const client=new ApiClient(async()=>++calls===2?Response.json(f.result):Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}}));
  if(extra)await assert.rejects(m.readNormalUnderstandingRange(client,session,f.input,new AbortController().signal,()=>true),{code:'RESPONSE_INVALID'});
  else assert.deepEqual(await m.readNormalUnderstandingRange(client,session,f.input,new AbortController().signal,()=>true),f.result);
  assert.equal(calls,extra?2:3);
 }
 const f=rangeSource();let calls=0,cancelled=0,pulls=0;
 const client=new ApiClient(async()=>++calls===1?Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}}):new Response(new ReadableStream({pull(c){pulls++;c.enqueue(new Uint8Array(700000));},cancel(){cancelled++;}}),{headers:{'content-type':'application/json','content-length':'1'}}));
 await assert.rejects(m.readNormalUnderstandingRange(client,session,f.input,new AbortController().signal,()=>true),{code:'RESPONSE_INVALID'});assert.equal(calls,2);assert.equal(cancelled,1);assert.ok(pulls<=5);
});

test('FN09 원문 stream 중 취소는 원 reader를 닫고 늦은 body나 다음 제어 조회를 수용하지 않는다',async()=>{
 const m=await load(),f=rangeSource(),controller=new AbortController();let calls=0,cancelled=0,streamed!:()=>void;
 const started=new Promise<void>(resolve=>{streamed=resolve;});
 const client=new ApiClient(async()=>++calls===1?Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}}):new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'));streamed();},cancel(){cancelled++;}}),{headers:{'content-type':'application/json'}}));
 const pending=m.readNormalUnderstandingRange(client,session,f.input,controller.signal,()=>true);await started;controller.abort();
 await assert.rejects(pending,{code:'DISCOVERY_SCOPE_CHANGED'});assert.equal(cancelled,1);assert.equal(calls,2);
});

test('FN09 원문 stream은 활성 read의 원 mono 만료 뒤 parse나 다음 제어 조회를 하지 않는다',async t=>{
 const m=await load();
 for(const mode of ['mono','wall','input']){const f=rangeSource();let mono=100,wall=Date.now(),calls=0,parsed=0,pulls=0,late:Uint8Array|undefined;
  f.input.expiresAt=new Date(wall+1000).toISOString();f.result.expiresAt=f.input.expiresAt;
  const raw=new TextEncoder().encode(JSON.stringify(f.result)),parse=JSON.parse;
  t.mock.method(performance,'now',()=>mono);t.mock.method(Date,'now',()=>wall);t.mock.method(JSON,'parse',(text:string,...rest:any[])=>{if(text.includes('FIXED_RANGE_SELECTION'))parsed++;return parse(text,...rest);});
  const client=new ApiClient(async()=>++calls===1?Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}}):new Response(new ReadableStream({pull(c){if(++pulls===1)c.enqueue(raw.slice(0,100));else{
   if(mode==='mono')mono+=31000;else if(mode==='wall')wall+=31000;else f.input.selection.ranges[0]!.payloadDigest='0'.repeat(64);
   late=raw.slice(100);c.enqueue(late);c.close();
  }}},{highWaterMark:0}),{headers:{'content-type':'application/json'}}));
  try{await assert.rejects(m.readNormalUnderstandingRange(client,session,f.input,new AbortController().signal,()=>true),{code:'DISCOVERY_SCOPE_CHANGED'});assert.equal(parsed,0);assert.equal(calls,2);assert.equal(pulls,2);assert.ok(late?.every(n=>n===0));}finally{t.mock.restoreAll();}
 }
});

test('FN09 원문의 새 30초 호출 기한은 멈춘 read도 취소하고 종결 뒤 timer를 남기지 않는다',async t=>{
 const m=await load(),f=rangeSource(),external=new AbortController();let mono=100,calls=0,cancelled=0,ready!:()=>void,outcome='PENDING';
 f.input.expiresAt=new Date(Date.now()+1000).toISOString();
 const started=new Promise<void>(resolve=>{ready=resolve;});t.mock.method(performance,'now',()=>mono);t.mock.timers.enable({apis:['setTimeout']});
 const client=new ApiClient(async()=>++calls===1?Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}}):new Response(new ReadableStream({pull(){ready();},cancel(){cancelled++;}},{highWaterMark:0}),{headers:{'content-type':'application/json'}}));
 const operation=m.readNormalUnderstandingRange(client,session,f.input,external.signal,()=>true).then(()=>{outcome='OK';},e=>{outcome=e.code;});
 try{await started;mono+=31000;t.mock.timers.tick(31000);for(let i=0;i<3;i++)await new Promise<void>(resolve=>setImmediate(resolve));
  assert.equal(outcome,'DISCOVERY_SCOPE_CHANGED');assert.equal(cancelled,1);assert.equal(calls,2);
 }finally{external.abort();await operation;t.mock.timers.reset();t.mock.restoreAll();}
});

test('FN09 원문 성공·실패 종결은 원 TTL timer와 외부 abort listener를 모두 회수한다',async t=>{
 const m=await load();
 for(const invalid of [false,true]){const f=rangeSource(),external=new AbortController();let calls=0,owned:AbortSignal|null|undefined;
  t.mock.timers.enable({apis:['setTimeout']});
  const client=new ApiClient(async(_url,options)=>{calls++;owned=options?.signal;return calls===2?Response.json(invalid?{status:'PENDING_SOURCE',request:f.input.request,body:{raw:'not-accepted'}}:{status:'PENDING_SOURCE',request:f.input.request}):Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}});});
  try{const read=m.readNormalUnderstandingRange(client,session,f.input,external.signal,()=>true);if(invalid)await assert.rejects(read,{code:'RESPONSE_INVALID'});else assert.equal((await read).status,'PENDING_SOURCE');
   assert.ok(owned);assert.notEqual(owned,external.signal);assert.equal(owned.aborted,false);external.abort();t.mock.timers.tick(30001);assert.equal(owned.aborted,false);assert.equal(calls,invalid?2:3);
  }finally{t.mock.timers.reset();}
 }
});

test('FN09 원문은 행별 원 textBytes와 조회 전 mono 기한도 독립 검산한다',async t=>{
 const m=await load();
 for(const mode of ['row-bytes','mono-expiry']){const f=rangeSource();let calls=0,mono=100;
  if(mode==='row-bytes')f.input.selection.ranges[0]!.textBytes++;
  else{f.result.expiresAt=new Date(Date.now()+1000).toISOString();t.mock.method(performance,'now',()=>mono);}
  const client=new ApiClient(async()=>{calls++;if(calls!==2)return Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}});if(mode==='mono-expiry')mono+=1500;return Response.json(f.result);});
  try{await assert.rejects(m.readNormalUnderstandingRange(client,session,f.input,new AbortController().signal,()=>true),{code:mode==='row-bytes'?'RESPONSE_INVALID':'DISCOVERY_SCOPE_CHANGED'});assert.equal(calls,2);}finally{t.mock.restoreAll();}
 }
});

// Run the real click handlers in memory; the fixture owns hook state/effect cleanup and opens no browser.
const reactMemory='data:text/javascript,'+encodeURIComponent(`
 let cursor=0,slots=[],effects=new Map(),pending=[];
 const roots=new Map();
 export function useState(initial){
  const id=cursor++,owned=slots;
  if(!(id in slots))slots[id]=initial;
  return [slots[id],value=>{owned[id]=typeof value==='function'?value(owned[id]):value;}];
 }
 export function useRef(value){
  const id=cursor++;
  return slots[id]??=( {current:value} );
 }
 export function useMemo(build,deps){
  const id=cursor++,old=slots[id];
  if(!old||deps.some((value,i)=>value!==old.deps[i]))slots[id]={deps,value:build()};
  return slots[id].value;
 }
 export function useEffect(effect,deps){
  const id=cursor++,owned=effects,old=owned.get(id);
  if(!old||deps.some((value,i)=>value!==old.deps[i]))pending.push(()=>{old?.clean?.();owned.set(id,{deps,clean:effect()});});
 }
 export function draw(render,key='default'){
  if(!roots.has(key))roots.set(key,{slots:[],effects:new Map(),pending:[]});
  ({slots,effects,pending}=roots.get(key));cursor=0;
  const tree=render();for(const effect of pending.splice(0))effect();return tree;
 }
 export function unmount(key='default'){
  const root=roots.get(key);if(!root)return;
  for(const {clean} of root.effects.values())clean?.();roots.delete(key);
 }
 export function snapshot(key='default'){return roots.get(key)?.slots;}`);
type ElementNode={type?:unknown;props?:{children?:unknown;onClick?:()=>void;disabled?:boolean}};
function button(tree:unknown,label:string):ElementNode['props']{
 if(Array.isArray(tree)){for(const item of tree){const found=button(item,label);if(found)return found;}return;}
 if(!tree||typeof tree!=='object')return;
 const node=tree as ElementNode;
 if(node.type==='button'&&node.props?.children===label)return node.props;
 return button(node.props?.children,label);
}

test('FN09 UI04 원문은 원 구간 요청에서만 명시 조회하고 취소·실패·선택/reader/인증 변경과 만료 때 폐기한다',async t=>{
 const hooks=await import(reactMemory),m=await compile(reactMemory),f=rangeSource(),posts:string[]=[];
 const client=new ApiClient(async(_url,init)=>{
  if(init?.method==='GET')return Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}});
  posts.push(String(init?.body));const q=JSON.parse(String(init?.body));
  return Response.json({operationId:id(24),commandId:q.commandId,projectId,status:'APPLIED',targetId:f.input.request.requestRef.id,version:1,
   data:{ref:f.input.request.requestRef,requestRef:f.input.request.requestRef,status:'NORMAL_UNDERSTANDING_RANGE_REQUESTED',state:'PENDING_SOURCE',sourceAvailable:false,selectionAvailable:false,expiresAt:f.input.expiresAt},evidenceRefs:[],warnings:[],serverReceivedAt:new Date().toISOString()});
 });
 const commands=m.createNormalUnderstandingRangeCommands(client,session,projectId,canonicalJson(assignmentRef),()=>true),s=f.input.selection;
 await commands.request({request:{...f.input.request,requestRef:s.requestRef},resultRef:s.resultRef,contextBundleRef:f.result.body.contextBundleRef,initConfirmationRef:s.initConfirmationRef,tailRef:s.tailRef,firstSequence:s.firstSequence,lastSequence:s.lastSequence,ranges:s.ranges},new AbortController().signal,()=>true);
 type Reader=NonNullable<Parameters<UI['NormalUnderstandingDiscovery']>[0]['rangeReader']>;
 const calls:{input:Parameters<Reader>[0];signal:AbortSignal;resolve:(v:Awaited<ReturnType<Reader>>)=>void;reject:(e:unknown)=>void}[]=[];
 const original:Reader=(input,signal)=>new Promise((resolve,reject)=>calls.push({input,signal,resolve,reject}));let reader:Reader|undefined=original,projection=session,busy=false;
 const draw=()=>hooks.draw(()=>m.NormalUnderstandingDiscovery({client,session:projection,projectId,assignmentRef,preparations:[],busy,rangeRequester:commands.request,rangeRecovery:commands.recover,rangeReader:reader}));
 const markup=()=>renderToStaticMarkup(draw()),click=(label:string)=>{const b=button(draw(),label);assert.ok(b?.onClick);assert.equal(!!b.disabled,false);b.onClick();};
 const settle=async()=>{for(let i=0;i<16;i++)await new Promise<void>(resolve=>setImmediate(resolve));};
 const reveal=async()=>{click('보관 원문 확인');calls.at(-1)!.resolve(f.result);const until=performance.now()+2000;while(!markup().includes('선택 원문 보관 확인')&&performance.now()<until)await new Promise<void>(resolve=>setImmediate(resolve));assert.match(markup(),/선택 원문 보관 확인/);assert.match(markup(),/&lt;script&gt;원 선택만&lt;\/script&gt;/);assert.doesNotMatch(markup(),/<script>/);};
 const findSelect=(tree:any):any=>Array.isArray(tree)?tree.map(findSelect).find(Boolean):tree&&typeof tree==='object'?(tree.type==='select'?tree:findSelect(tree.props?.children)):undefined;
 t.mock.timers.enable({apis:['setTimeout']});
 try{
  assert.equal(calls.length,0);assert.match(markup(),/보관 원문 확인/);assert.doesNotMatch(markup(),/선택 원문 보관 확인/);
  click('보관 원문 확인');assert.deepEqual(calls[0]!.input,f.input);assert.equal(button(draw(),'보관 원문 확인')?.disabled,true);
  click('원문 조회 취소');assert.equal(calls[0]!.signal.aborted,true);calls[0]!.resolve(f.result);await settle();assert.doesNotMatch(markup(),/원 선택만/);
  for(const status of ['PENDING_SOURCE','CURRENT_UNAVAILABLE'] as const){click('보관 원문 확인');calls.at(-1)!.resolve({status,request:f.input.request});await settle();assert.match(markup(),status==='PENDING_SOURCE'?/선택 원문 보관 대기/:/현재 원문 조회 불가/);}
  await reveal();assert.match(markup(),/전체 대화가 아닙니다/);assert.match(markup(),/검토·승인·작업 실행을 뜻하지 않습니다/);
  click('보관 원문 확인');assert.doesNotMatch(markup(),/원 선택만/);calls.at(-1)!.reject(Error('RAW_PRIVATE_DETAIL'));await settle();assert.match(markup(),/원문 조회 결과 미확인/);assert.doesNotMatch(markup(),/RAW_PRIVATE_DETAIL|원 선택만/);
  await reveal();click('원문 닫기');assert.doesNotMatch(markup(),/원 선택만/);
  await reveal();findSelect(draw()).props.onChange({target:{value:'changed'}});assert.doesNotMatch(markup(),/원 선택만/);
  await reveal();reader=undefined;assert.doesNotMatch(markup(),/원 선택만/);reader=original;assert.doesNotMatch(markup(),/원 선택만/);
  click('보관 원문 확인');const late=calls.at(-1)!;reader=async()=>{throw Error('NOT_AUTOMATIC');};draw();assert.equal(late.signal.aborted,true);reader=original;late.resolve(f.result);await settle();assert.doesNotMatch(markup(),/원 선택만/);
  await reveal();busy=true;draw();busy=false;assert.doesNotMatch(markup(),/원 선택만/);
  await reveal();draw();
  // 새 조회로 화면 원문 timeout을 mock clock에 등록한다. network polling은 없다.
  await reveal();draw();const count=calls.length;t.mock.timers.tick(25001);assert.doesNotMatch(markup(),/원 선택만/);assert.equal(calls.length,count);
  click('보관 원문 확인');const authLate=calls.at(-1)!;projection={...session,csrfToken:'r'.repeat(43)};draw();assert.equal(authLate.signal.aborted,true);authLate.resolve(f.result);await settle();assert.doesNotMatch(markup(),/원 선택만/);
  projection=session;assert.doesNotMatch(markup(),/원 선택만/);assert.equal(posts.length,1);assert.ok(!posts[0]!.includes('원 선택만'));assert.ok(!JSON.stringify([...m.normalUnderstandingRecords(session,client)]).includes('원 선택만'));
 }finally{hooks.unmount();t.mock.timers.reset();}
});

test('FN09 UI04 원 전달 +31초의 클릭은 실제 reader로 새 OWNER 제어를 확인하고 같은 저장 원문만 보여 주며 추가 POST가 없다',async t=>{
 const hooks=await import(reactMemory),m=await compile(reactMemory),f=rangeSource(),start=Date.now();let now=start,mono=100,mode='stored';const calls:{path:string;method:string}[]=[];
 const client=new ApiClient(async(url,init)=>{const path=String(url);calls.push({path,method:init?.method??'GET'});
  if(init?.method==='POST'){const q=JSON.parse(String(init.body));return Response.json({operationId:id(24),commandId:q.commandId,projectId,status:'APPLIED',targetId:f.input.request.requestRef.id,version:1,
   data:{ref:f.input.request.requestRef,requestRef:f.input.request.requestRef,status:'NORMAL_UNDERSTANDING_RANGE_REQUESTED',state:'PENDING_SOURCE',sourceAvailable:false,selectionAvailable:false,expiresAt:f.input.expiresAt},evidenceRefs:[],warnings:[],serverReceivedAt:new Date(now).toISOString()});}
  if(path===`/api/v1/projects/${projectId}`)return Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}});
  assert.ok(path.includes('/range-current?'));return Response.json(mode==='stored'?{...f.result,observedAt:new Date(now).toISOString(),expiresAt:new Date(now+20000).toISOString()}:{status:'CURRENT_UNAVAILABLE',request:f.input.request});
 });
 const commands=m.createNormalUnderstandingRangeCommands(client,session,projectId,canonicalJson(assignmentRef),()=>true),s=f.input.selection;
 await commands.request({request:{...f.input.request,requestRef:s.requestRef},resultRef:s.resultRef,contextBundleRef:f.result.body.contextBundleRef,initConfirmationRef:s.initConfirmationRef,tailRef:s.tailRef,firstSequence:s.firstSequence,lastSequence:s.lastSequence,ranges:s.ranges},new AbortController().signal,()=>true);
 const before=calls.length,rangeReader:NonNullable<Parameters<UI['NormalUnderstandingDiscovery']>[0]['rangeReader']>=(input,signal)=>m.readNormalUnderstandingRange(client,session,input,signal,()=>true);
 const draw=()=>hooks.draw(()=>m.NormalUnderstandingDiscovery({client,session,projectId,assignmentRef,preparations:[],busy:false,rangeRequester:commands.request,rangeRecovery:commands.recover,rangeReader}));
 const waitFor=async(predicate:()=>boolean,label:string)=>{const end=process.hrtime.bigint()+10000000000n;while(!predicate()){assert.ok(process.hrtime.bigint()<end,label);await new Promise<void>(resolve=>setImmediate(resolve));}};
 const settle=async(pattern:RegExp)=>{await waitFor(()=>pattern.test(renderToStaticMarkup(draw())),String(pattern));assert.match(renderToStaticMarkup(draw()),pattern);};
 t.mock.method(Date,'now',()=>now);t.mock.method(performance,'now',()=>mono);t.mock.timers.enable({apis:['setTimeout']});
 try{now=start+31000;assert.doesNotMatch(renderToStaticMarkup(draw()),/원 선택만/);const read=button(draw(),'보관 원문 확인');assert.ok(read?.onClick);assert.equal(read.disabled,false);read.onClick();
  await settle(/선택 원문 보관 확인/);assert.match(renderToStaticMarkup(draw()),/&lt;script&gt;원 선택만/);assert.deepEqual(calls.slice(before).map(c=>c.method),['GET','GET','GET']);assert.equal(calls.filter(c=>c.method==='POST').length,1);
  button(draw(),'보관 원문 확인')!.onClick!();await waitFor(()=>hooks.snapshot()?.some((slot:any)=>slot?.value?.status==='RANGE_STORED'),'원 reader 및 component hash 검산 뒤 publication');
  mono+=10000;assert.match(renderToStaticMarkup(draw()),/선택 원문 보관 확인/);assert.ok(JSON.stringify(hooks.snapshot()).includes('원 선택만'));
  mono+=10001;t.mock.timers.tick(10001);assert.ok(!JSON.stringify(hooks.snapshot()).includes('원 선택만'),'더 짧은 mono 표시 기한에 원문 state도 폐기한다');
  mode='unavailable';button(draw(),'보관 원문 확인')!.onClick!();assert.doesNotMatch(renderToStaticMarkup(draw()),/원 선택만/);await settle(/현재 원문 조회 불가/);assert.doesNotMatch(renderToStaticMarkup(draw()),/원 선택만/);assert.equal(calls.filter(c=>c.method==='POST').length,1);
  hooks.unmount();assert.doesNotMatch(renderToStaticMarkup(draw()),/원 선택만/);
 }finally{hooks.unmount();t.mock.timers.reset();t.mock.restoreAll();}
});

test('FN09 range confirmation uses exact contiguous metadata and invalidates cancelled or replaced drafts',async()=>{
 const hooks=await import(reactMemory),m=await compile(reactMemory),f=fixture();
 const command=m.prepareNormalUnderstandingCommand({scope:f.ready,clientId:session.clientId,controlGeneration:9});
 const requestRef=ref(26),request={requestRef,projectId,executionId:command.targetId,executionGeneration:command.expectedVersion,assignmentRef,preparationRef};
 m.normalUnderstandingRecords(session,f.client).set('stored',{command,body:JSON.stringify(command),state:'PENDING_SOURCE',requestRef});
 type Props=Parameters<UI['NormalUnderstandingDiscovery']>[0];
 type Reader=NonNullable<Props['metadataReader']>;
 type Requester=NonNullable<Props['rangeRequester']>;
 const ranges=[3,4,6,7].map(sequence=>({sequence,outputRef:ref(29+sequence),payloadDigest:'b'.repeat(64),textBlocks:1,textBytes:sequence>=6?1100000:8}));
 const stored:Awaited<ReturnType<Reader>>={status:'METADATA_STORED',request,resultRef:ref(27),observedAt:f.ready.observedAt,expiresAt:f.ready.expiresAt,currentness:'CURRENT',selectionAvailable:false,
  metadata:{attribution:'SESSION_ONLY',contextBundleRef:ref(28),initConfirmationRef:ref(29),tailRef:ref(36),wholeConversationComplete:false,ranges}};
 const calls:{draft:Parameters<Requester>[0];signal:AbortSignal;resolve:()=>void}[]=[];
 const submit:Requester=(draft,signal)=>new Promise(resolve=>calls.push({draft,signal,resolve}));
 let metadataReader:Reader=async()=>stored,rangeRequester:Requester|undefined;
 const draw=()=>hooks.draw(()=>m.NormalUnderstandingDiscovery({client:f.client,session,projectId,assignmentRef,preparations:[],busy:false,metadataReader,rangeRequester}));
 const find=(tree:unknown,match:(v:any)=>boolean):any=>{
  if(Array.isArray(tree)){for(const entry of tree){const found=find(entry,match);if(found)return found;}return;}
  return tree&&typeof tree==='object'?(match(tree)?tree:find((tree as ElementNode).props?.children,match)):undefined;
 };
 const pane=()=>{
  const node=find(draw(),node=>node.props?.requestRange);
  if(!node){hooks.unmount('range');return null;}
  return hooks.draw(()=>node.type(node.props),'range');
 };
 const select=(label:string,value:string)=>find(pane(),node=>node.type==='select'&&node.props['aria-label']===label).props.onChange({target:{value}});
 const pick=(from:number,to:number)=>{select('출력 구간 시작 순번',String(from));select('출력 구간 끝 순번',String(to));};
 const read=async()=>{button(draw(),'탐색 결과 확인')?.onClick?.();await new Promise<void>(resolve=>setImmediate(resolve));};
 try{
  await read();assert.equal(pane(),null);assert.equal(calls.length,0);
  rangeRequester=submit;pane();
  for(const [from,to] of [[3,6],[6,7],[4,3],[5,5]] as const){
   pick(from,to);assert.equal(button(pane(),'선택 구간 조회 요청')?.disabled,true);
   button(pane(),'선택 구간 조회 요청')?.onClick?.();
  }
  assert.equal(calls.length,0);
  pick(3,4);const old=button(pane(),'선택 구간 조회 요청');assert.equal(old?.disabled,false);assert.equal(calls.length,0);
  old?.onClick?.();old?.onClick?.();assert.equal(calls.length,1);
  assert.deepEqual(calls[0]!.draft,{request,resultRef:stored.resultRef,contextBundleRef:stored.metadata.contextBundleRef,initConfirmationRef:stored.metadata.initConfirmationRef,tailRef:stored.metadata.tailRef,firstSequence:3,lastSequence:4,ranges:ranges.slice(0,2)});
  assert.equal('text' in calls[0]!.draft.ranges[0]!,false);
  button(pane(),'구간 선택 취소')?.onClick?.();assert.equal(calls[0]!.signal.aborted,true);
  old?.onClick?.();calls[0]!.resolve();await Promise.resolve();
  assert.equal(calls.length,1);assert.ok(!renderToStaticMarkup(pane()).includes('구간 요청 전달'));
  pick(3,4);assert.equal(button(pane(),'선택 구간 조회 요청')?.disabled,true);
  pick(3,3);const previous=button(pane(),'선택 구간 조회 요청');
  metadataReader=async()=>structuredClone(stored);pane();
  await read();pane();previous?.onClick?.();assert.equal(calls.length,1);
  assert.equal(button(pane(),'선택 구간 조회 요청')?.disabled,true);
  pick(4,4);const previousRequester=button(pane(),'선택 구간 조회 요청');
  rangeRequester=undefined;assert.equal(pane(),null);
  rangeRequester=submit;pane();previousRequester?.onClick?.();assert.equal(calls.length,1);
  pick(4,4);const aboutToExpire=button(pane(),'선택 구간 조회 요청'),clock=Date.now;
  try{Date.now=()=>Date.parse(stored.expiresAt);aboutToExpire?.onClick?.();assert.equal(pane(),null);}
  finally{Date.now=clock;}
  assert.equal(calls.length,1);
  assert.deepEqual(f.calls,[]);
 }finally{hooks.unmount('range');hooks.unmount();}
});

test('FN09 range provider preserves the exact uncertain command and only sends it again by explicit confirmation',async()=>{
 const hooks=await import(reactMemory),m=await compile(reactMemory);
 const posts:{path:string;body:string;signal:AbortSignal|null|undefined}[]=[];
 const newRef=ref(47),requestRef=ref(46),executionId=id(8),signal=new AbortController().signal;
 const range={outputRef:ref(44),sequence:3,payloadDigest:'b'.repeat(64),textBlocks:1,textBytes:12};
 const nextRange={...range,sequence:4,outputRef:ref(48)};
 const draft={request:{requestRef,projectId,executionId,executionGeneration:7,assignmentRef,preparationRef},resultRef:ref(42),
  contextBundleRef:ref(43),initConfirmationRef:ref(45),tailRef:nextRange.outputRef,firstSequence:3,lastSequence:3,ranges:[range]};
 const different={...draft,firstSequence:4,lastSequence:4,ranges:[nextRange]};
 let resumeControl!:()=>void,resumePost!:()=>void;
 const controlWait=new Promise<void>(resolve=>{resumeControl=resolve;});
 const postWait=new Promise<void>(resolve=>{resumePost=resolve;});
 const metadataReader:NonNullable<Parameters<UI['NormalUnderstandingDiscovery']>[0]['metadataReader']>=async()=>({
  status:'METADATA_STORED',request:draft.request,resultRef:draft.resultRef,currentness:'CURRENT',observedAt:new Date().toISOString(),
  expiresAt:new Date(Date.now()+30000).toISOString(),selectionAvailable:false,metadata:{contextBundleRef:draft.contextBundleRef,
    initConfirmationRef:draft.initConfirmationRef,tailRef:draft.tailRef,ranges:[range,nextRange],attribution:'SESSION_ONLY',wholeConversationComplete:false}
 });
 let generation=9,mode='UNKNOWN',active=true,reads=0;
 const client=new ApiClient(async(url,init)=>{
  if(init?.method==='GET'){if(++reads===1)await controlWait;return Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation,status:'HELD'}});}
  const body=String(init?.body);posts.push({path:String(url),body,signal:init?.signal});
  assert.equal(init?.method,'POST');assert.equal(init?.credentials,'same-origin');assert.equal(init?.cache,'no-store');
  assert.equal(new Headers(init?.headers).get('x-anvil-csrf'),session.csrfToken);
  if(mode==='UNKNOWN'){await postWait;return Response.json({code:'NORMAL_UNDERSTANDING_REQUEST_INVALID'},{status:422});}
  const original=JSON.parse(body),at=Date.now()-(mode==='HISTORICAL'?30000:0),observedAt=new Date(at).toISOString(),expiresAt=new Date(at+10000).toISOString();
  return Response.json({operationId:id(24),commandId:original.commandId,projectId,status:'APPLIED',targetId:newRef.id,version:1,
   data:{ref:newRef,status:'NORMAL_UNDERSTANDING_RANGE_REQUESTED',requestRef:newRef,state:'PENDING_SOURCE',sourceAvailable:false,selectionAvailable:false,expiresAt},
   evidenceRefs:[],warnings:[],serverReceivedAt:observedAt});
 });
 const assignmentKey=JSON.stringify({contentHash:assignmentRef.contentHash,id:assignmentRef.id,version:assignmentRef.version});
 let projection=session,commands=m.createNormalUnderstandingRangeCommands(client,session,projectId,assignmentKey,()=>active);
 const draw=()=>hooks.draw(()=>m.NormalUnderstandingDiscovery({client,session:projection,projectId,assignmentRef,preparations:[],busy:false,metadataReader,
  rangeRequester:commands.request,rangeRecovery:commands.recover}));
 const markup=()=>renderToStaticMarkup(draw());
 const recover=()=>{const control=button(draw(),'같은 구간 명령 결과 확인');assert.ok(control?.onClick);control.onClick();};
 const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
 try{
  assert.equal(markup(),'');assert.equal(posts.length,0);assert.equal(reads,0);
  const originalCall=commands.request(draft,signal,()=>true);
  const rejected=assert.rejects(originalCall,{code:'NORMAL_UNDERSTANDING_REQUEST_INVALID'});
  await assert.rejects(commands.request(different,signal,()=>true),{code:'NORMAL_UNDERSTANDING_RANGE_ORIGINAL_REQUIRED'});
  assert.equal(reads,1);assert.equal(posts.length,0);
  resumeControl();await settle();
  await assert.rejects(commands.request(different,signal,()=>true),{code:'NORMAL_UNDERSTANDING_RANGE_ORIGINAL_REQUIRED'});
  assert.equal(reads,1);assert.equal(posts.length,1);
  resumePost();await rejected;
  assert.equal(posts.length,1);
  assert.equal(posts[0]!.path,`/api/v1/projects/${projectId}/executions/${executionId}/understanding-response-read-requests`);
  assert.equal(posts[0]!.signal,signal);
  const original=JSON.parse(posts[0]!.body);
  assert.deepEqual(original,{schemaVersion:1,projectId,commandId:original.commandId,clientId:session.clientId,controlGeneration:9,operation:'readNormalUnderstandingResponse',
   targetId:executionId,expectedVersion:7,baselineRefs:[],approvalRef:null,payload:{assignmentRef,preparationRef,selection:{requestRef,resultRef:draft.resultRef,
    initConfirmationRef:draft.initConfirmationRef,tailRef:draft.tailRef,firstSequence:3,lastSequence:3,ranges:[range]}}});
  await assert.rejects(commands.request(draft,signal,()=>true),{code:'NORMAL_UNDERSTANDING_RANGE_ORIGINAL_REQUIRED'});
  await assert.rejects(commands.request(different,signal,()=>true),{code:'NORMAL_UNDERSTANDING_RANGE_ORIGINAL_REQUIRED'});
  assert.equal(posts.length,1);assert.equal(reads,1);
  assert.match(markup(),new RegExp(original.commandId));assert.match(markup(),/구간 요청 결과 미확인/);
  projection={...session,user:{...session.user}};
  commands=m.createNormalUnderstandingRangeCommands(client,projection,projectId,assignmentKey,()=>active);
  assert.match(markup(),/같은 구간 명령 결과 확인/);
  const metadataCommand=m.prepareNormalUnderstandingCommand({clientId:session.clientId,controlGeneration:9,
   scope:{projectId,executionId,executionGeneration:7,assignmentRef,preparationRef,
    observedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+30000).toISOString()}});
  m.normalUnderstandingRecords(projection,client).set('original-metadata',{
   command:metadataCommand,body:JSON.stringify(metadataCommand),state:'PENDING_SOURCE',requestRef
  });
  button(draw(),'탐색 결과 확인')?.onClick?.();await settle();
  assert.match(markup(),/출력 메타데이터 보관/);assert.doesNotMatch(markup(),/선택 구간 조회 요청/);
  generation=10;recover();await settle();assert.equal(posts.length,1);
  assert.match(markup(),/구간 요청 결과 미확인/);
  generation=9;mode='ACK';recover();await settle();
  assert.equal(posts.length,2);assert.equal(posts[1]!.body,posts[0]!.body);
  assert.match(markup(),/구간 요청 보관 · 원문 대기/);assert.doesNotMatch(markup(),/같은 구간 명령 결과 확인|출력 원문/);
  await assert.rejects(commands.request(different,signal,()=>true),{code:'NORMAL_UNDERSTANDING_RANGE_ORIGINAL_REQUIRED'});
  await assert.rejects(commands.request({...draft,firstSequence:4,lastSequence:4},signal,()=>false),{code:'DISCOVERY_SCOPE_CHANGED'});
  assert.equal(posts.length,2);
  mode='HISTORICAL';
  assert.deepEqual(await commands.request({...draft,request:{...draft.request,executionId:id(81),requestRef:ref(82)}},signal,()=>true),newRef);
  assert.equal(posts.length,3);assert.notEqual(JSON.parse(posts[2]!.body).commandId,original.commandId);
  assert.match(markup(),/구간 요청 보관 · 전달 기한 경과/);
  active=false;projection={...session,csrfToken:'r'.repeat(43)};assert.equal(markup(),'');
 }finally{resumeControl();resumePost();hooks.unmount();}
});

test('FN09 workspace keeps the metadata reader across equivalent owner projections and invalidates old readers',async()=>{
 const hooks=await import(reactMemory),m=await compile(reactMemory,'WorkspaceResponsibleSessions');
 const client=new ApiClient(async()=>{throw Error('UNEXPECTED_FETCH');});
 type Reader=NonNullable<Parameters<UI['NormalUnderstandingDiscovery']>[0]['metadataReader']>;
 const receiver=(tree:unknown):Reader|undefined=>{
  if(Array.isArray(tree)){for(const item of tree){const found=receiver(item);if(found)return found;}return;}
  if(!tree||typeof tree!=='object')return;
  const props=(tree as {props?:{children?:unknown;metadataReader?:Reader}}).props;
  return props?.metadataReader??receiver(props?.children);
 };
 const draw=(projection=session,owner=true)=>hooks.draw(()=>m.WorkspaceResponsibleSessions({client,confirmed:{projectId,ref:{...assignmentRef}} as any,session:projection,
  owner,buffer:null,onChange:()=>{},busy:false,run:()=>{}}));
 try{
  const original=receiver(draw());assert.ok(original);
  assert.strictEqual(receiver(draw({...session,user:{...session.user}})),original);
  assert.equal(receiver(draw(session,false)),undefined);
  const renewed=receiver(draw());assert.ok(renewed);assert.notStrictEqual(renewed,original);
  const req={projectId,executionId:id(8),executionGeneration:7,assignmentRef,preparationRef,requestRef:ref(26)},signal=new AbortController().signal;
  await assert.rejects(original(req,signal),{code:'DISCOVERY_SCOPE_CHANGED'});
  await assert.rejects(renewed({...req,assignmentRef:ref(39)},signal),{code:'DISCOVERY_SCOPE_CHANGED'});
 }finally{hooks.unmount();}
});

test('FN09 실제 workspace의 원문 reader 공급은 OWNER 명시 호출만 허용하고 이전 소유자는 복귀해도 무효다',async()=>{
 const hooks=await import(reactMemory),m=await compile(reactMemory,'WorkspaceResponsibleSessions'),f=rangeSource(),calls:string[]=[];
 const client=new ApiClient(async(url)=>{calls.push(String(url));return String(url)===`/api/v1/projects/${projectId}`?Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}}):Response.json(f.result);});
 type Reader=NonNullable<Parameters<UI['NormalUnderstandingDiscovery']>[0]['rangeReader']>;
 const find=(tree:any):Reader|undefined=>Array.isArray(tree)?tree.map(find).find(Boolean):tree&&typeof tree==='object'?(tree.props?.rangeReader??find(tree.props?.children)):undefined;
 const draw=(owner=true,projection=session)=>hooks.draw(()=>m.WorkspaceResponsibleSessions({client,confirmed:{projectId,ref:{...assignmentRef}} as any,session:projection,owner,buffer:null,onChange:()=>{},busy:false,run:()=>{}}));
 try{const first=find(draw());assert.ok(first);assert.equal(calls.length,0);assert.equal(find(draw(true,{...session,user:{...session.user}})),first);
  assert.deepEqual(await first(f.input,new AbortController().signal),f.result);assert.equal(calls.length,3);
  assert.equal(find(draw(false)),undefined);const fresh=find(draw());assert.ok(fresh);assert.notEqual(fresh,first);
  await assert.rejects(first(f.input,new AbortController().signal),{code:'DISCOVERY_SCOPE_CHANGED'});
  await assert.rejects(fresh({...f.input,request:{...f.input.request,assignmentRef:ref(99)}},new AbortController().signal),{code:'DISCOVERY_SCOPE_CHANGED'});assert.equal(calls.length,3);
  const sameObject={...session,user:{...session.user}};draw(true,sameObject);sameObject.csrfToken='r'.repeat(43);
  await assert.rejects(fresh(f.input,new AbortController().signal),{code:'DISCOVERY_SCOPE_CHANGED'});assert.equal(calls.length,3);
 }finally{hooks.unmount();}
});

test('FN09 metadata click is scoped, current-only, cancellable, and independent from POST recovery',async()=>{
 const hooks=await import(reactMemory),m=await compile(reactMemory),f=fixture();
 const command=m.prepareNormalUnderstandingCommand({scope:f.ready,clientId:session.clientId,controlGeneration:9});
 const requestRef=ref(26),record={command,body:JSON.stringify(command),state:'PENDING_SOURCE' as const,requestRef};
 const expected={requestRef,projectId,executionId:command.targetId,executionGeneration:command.expectedVersion,assignmentRef,preparationRef};
 m.normalUnderstandingRecords(session,f.client).set('stored',record);
 m.normalUnderstandingRecords(session,f.client).set('uncertain',{...record,state:'UNKNOWN'});
 type Result=Awaited<ReturnType<NonNullable<Parameters<UI['NormalUnderstandingDiscovery']>[0]['metadataReader']>>>;
 const calls:{request:unknown;signal:AbortSignal;resolve:(value:Result)=>void;reject:(cause:unknown)=>void}[]=[];
 let reader:Parameters<UI['NormalUnderstandingDiscovery']>[0]['metadataReader']=(request,signal)=>new Promise((resolve,reject)=>calls.push({request,signal,resolve,reject}));
 let projection=session;
 const draw=()=>hooks.draw(()=>m.NormalUnderstandingDiscovery({client:f.client,session:projection,projectId,assignmentRef,preparations:[],busy:false,metadataReader:reader}));
 const markup=()=>renderToStaticMarkup(draw());
 const click=(label:string)=>{
  const target=button(draw(),label);assert.ok(target?.onClick);assert.equal(!!target.disabled,false);target.onClick();
 };
 const stored:Result={status:'METADATA_STORED',request:expected,resultRef:ref(27),observedAt:f.ready.observedAt,expiresAt:f.ready.expiresAt,currentness:'CURRENT',selectionAvailable:false,
  metadata:{attribution:'SESSION_ONLY',contextBundleRef:ref(28),initConfirmationRef:ref(29),tailRef:ref(30),wholeConversationComplete:false,
   ranges:[{outputRef:ref(30),sequence:3,payloadDigest:'b'.repeat(64),textBlocks:1,textBytes:8}]}};
 const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
 try{
  const original=reader;reader=undefined;
  assert.ok(!markup().includes('탐색 결과 확인'));assert.ok(markup().includes('같은 탐색 명령 결과 확인'));
  reader=original;
  assert.ok(markup().includes('자료 대기'));assert.equal(calls.length,0);
  click('탐색 결과 확인');assert.deepEqual(calls[0]!.request,expected);
  assert.ok(markup().includes('탐색 결과 확인 중'));assert.equal(button(draw(),'탐색 결과 확인')?.disabled,true);
  click('조회 취소');assert.equal(calls[0]!.signal.aborted,true);
  calls[0]!.resolve(stored);await settle();assert.ok(!markup().includes('출력 메타데이터 보관'));
  click('탐색 결과 확인');calls[1]!.resolve({status:'PENDING_SOURCE',request:expected});await settle();assert.ok(markup().includes('자료 대기'));
  click('탐색 결과 확인');calls[2]!.resolve({status:'CURRENT_UNAVAILABLE',request:expected});await settle();assert.ok(markup().includes('현재 조회 불가'));
  click('탐색 결과 확인');calls[3]!.reject(Error('fixture error text'));await settle();assert.ok(markup().includes('조회 결과 미확인'));assert.ok(!markup().includes('fixture error text'));
  click('탐색 결과 확인');calls[4]!.resolve({...stored,request:{...expected,requestRef:ref(99)}});await settle();assert.ok(markup().includes('조회 결과 미확인'));
  click('탐색 결과 확인');calls[5]!.resolve({...stored,metadata:{...stored.metadata,text:'보호 원문 표식'}} as Result);await settle();assert.ok(markup().includes('조회 결과 미확인'));
  click('탐색 결과 확인');calls[6]!.resolve(stored);await settle();
  assert.match(markup(),/출력 메타데이터 보관/);assert.match(markup(),/순번 3/);
  assert.doesNotMatch(markup(),/보호 원문 표식|발췌|검토 저장/);assert.ok(markup().includes('같은 탐색 명령 결과 확인'));
  reader=undefined;assert.ok(!markup().includes('출력 메타데이터 보관'));
  reader=original;assert.ok(!markup().includes('출력 메타데이터 보관'));assert.equal(calls.length,7);
  click('탐색 결과 확인');const replacement:NonNullable<typeof reader>=async()=>{throw Error('UNEXPECTED_REPLACEMENT_READ');};
  reader=replacement;assert.ok(!markup().includes('탐색 결과 확인 중'));assert.equal(calls[7]!.signal.aborted,true);
  reader=original;calls[7]!.resolve(stored);await settle();
  assert.ok(!markup().includes('출력 메타데이터 보관'));assert.equal(calls.length,8);
  assert.ok(markup().includes('같은 탐색 명령 결과 확인'));
  click('탐색 결과 확인');projection={...session,csrfToken:'r'.repeat(43)};draw();
  assert.equal(calls[8]!.signal.aborted,true);calls[8]!.resolve(stored);await settle();
  assert.ok(!markup().includes('출력 메타데이터 보관'));assert.deepEqual(f.calls,[]);
 }finally{hooks.unmount();}
});

function fixture(){
 const observedAt=new Date().toISOString(),expiresAt=new Date(Date.now()+30000).toISOString();
 const ready={projectId,assignmentRef,preparationRef,executionId:id(8),executionGeneration:7,observedAt,expiresAt};
 const calls:{path:string;init:RequestInit|undefined}[]=[];
 let bad=false,unknown=false;
 const client=new ApiClient(async(url,init)=>{
  const path=String(url);calls.push({path,init});
  if(path===`/api/v1/projects/${projectId}`)return Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}});
  if(path.includes('understanding-response-readiness?'))return Response.json(bad?{...ready,preparationRef:ref(99)}:ready);
  if(unknown){unknown=false;throw Error('RAM_LOST');}
  const command=JSON.parse(String(init?.body)),requestRef=ref(26);
  return Response.json({operationId:id(24),commandId:command.commandId,projectId,status:'APPLIED',targetId:requestRef.id,version:requestRef.version,
   data:{ref:requestRef,status:'NORMAL_UNDERSTANDING_METADATA_REQUESTED',requestRef,state:'PENDING_SOURCE',sourceAvailable:false,selectionAvailable:false,expiresAt},
   evidenceRefs:[],warnings:[],serverReceivedAt:observedAt});
 });
 return {client,calls,ready,bad:()=>{bad=true;},unknown:()=>{unknown=true;}};
}

test('FN09 Web initial render uses only registered CONTEXT_REVIEW preparation and performs no request',async()=>{
 const m=await load(),f=fixture();
 const preparation=(n:number,mode:string,connectionKind?:string)=>({projectId,ref:ref(n),snapshot:{intent:{mode,connectionKind,assignmentRef}}});
 const markup=renderToStaticMarkup(createElement(m.NormalUnderstandingDiscovery,{client:f.client,session,projectId,assignmentRef,busy:false,
  preparations:[preparation(6,'CONTEXT_REVIEW','REGISTERED_DEFINITION'),preparation(7,'WORK','REGISTERED_DEFINITION'),preparation(9,'CONTEXT_REVIEW')]}));
 assert.ok(markup.includes(preparationRef.id));assert.ok(!markup.includes(id(7)));assert.ok(!markup.includes(id(9)));
 assert.ok(!markup.includes(f.ready.executionId));assert.ok(!markup.includes('최초 이해 자료 탐색 요청'));assert.equal(f.calls.length,0);
});

test('FN09 Web gets only exact selected basis and explicitly retries the same body after an uncertain POST',async()=>{
 const m=await load(),f=fixture(),signal=new AbortController().signal;
 const basis=await m.readNormalUnderstandingBasis(f.client,session,projectId,assignmentRef,preparationRef,signal);
 assert.equal(f.calls.length,2);const readiness=f.calls[1]!;
 assert.equal(readiness.init?.method,'GET');
 const query=new URL(readiness.path,'https://anvil.invalid').searchParams;
 assert.equal(query.get('assignmentId'),assignmentRef.id);assert.equal(query.get('preparationHash'),preparationRef.contentHash);assert.equal(query.has('executionId'),false);
 const command=m.prepareNormalUnderstandingCommand(basis),body=JSON.stringify(command);
 assert.equal(command.targetId,f.ready.executionId);assert.equal(command.expectedVersion,7);assert.equal(command.controlGeneration,9);
 assert.deepEqual(command.payload,{assignmentRef,preparationRef});
 f.unknown();await assert.rejects(m.sendNormalUnderstandingCommand(f.client,session,command,body,signal),{code:'CONNECTION_LOST'});
 assert.equal(f.calls.length,3);
 assert.deepEqual(await m.sendNormalUnderstandingCommand(f.client,session,command,body,signal),ref(26));
 assert.deepEqual(f.calls.slice(2).map(call=>[call.path,call.init?.method,call.init?.body]),[
  [`/api/v1/projects/${projectId}/executions/${f.ready.executionId}/understanding-response-read-requests`,'POST',body],
  [`/api/v1/projects/${projectId}/executions/${f.ready.executionId}/understanding-response-read-requests`,'POST',body]
 ]);
});

test('FN09 Web rejects mismatched preparation projection before any POST',async()=>{
 const m=await load(),f=fixture();f.bad();
 await assert.rejects(m.readNormalUnderstandingBasis(f.client,session,projectId,assignmentRef,preparationRef,new AbortController().signal),{code:'RESPONSE_INVALID'});
 assert.ok(f.calls.every(call=>call.init?.method==='GET'));
});

test('FN09 protected metadata GET rechecks exact control and only requests canonical current scope',async()=>{
 const m=await load(),calls:{path:string;init:RequestInit|undefined}[]=[];
 const signal=new AbortController().signal;
 const req={projectId,executionId:id(8),executionGeneration:7,assignmentRef,preparationRef,requestRef:ref(26)};
 const current={status:'PENDING_SOURCE',request:req};
 let answer=()=>Response.json(current);
 const client=new ApiClient(async(url,init)=>{
  const path=String(url);calls.push({path,init});
  return path===`/api/v1/projects/${projectId}`?Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}}):answer();
 });
 const read=()=>m.readNormalUnderstandingMetadata(client,session,req,signal,()=>true);
 assert.deepEqual(await read(),current);assert.equal(calls.length,2);
 const metadata=calls[1]!,params=new URLSearchParams({controlGeneration:'9',executionGeneration:'7',requestVersion:'1',requestHash:req.requestRef.contentHash,
  assignmentId:assignmentRef.id,assignmentVersion:'1',assignmentHash:assignmentRef.contentHash,preparationId:preparationRef.id,preparationVersion:'1',preparationHash:preparationRef.contentHash});
 assert.equal(metadata.path,`/api/v1/projects/${projectId}/executions/${req.executionId}/understanding-response-read-requests/${req.requestRef.id}/current?${params}`);
 assert.equal(calls[0]!.init?.signal,signal);assert.equal(metadata.init?.signal,signal);
 assert.equal(metadata.init?.method,'GET');assert.equal(metadata.init?.credentials,'same-origin');assert.equal(metadata.init?.redirect,'error');
 assert.equal(metadata.init?.cache,'no-store');assert.equal(new Headers(metadata.init?.headers).get('x-anvil-csrf'),session.csrfToken);
 assert.equal(metadata.init?.body,undefined);
 answer=()=>Response.json({code:'REAUTHENTICATION_REQUIRED'},{status:412});
 await assert.rejects(read(),{code:'REAUTHENTICATION_REQUIRED'});
 answer=()=>Response.json({code:'NORMAL_UNDERSTANDING_METADATA_CURRENT_REQUIRED'},{status:412});
 assert.deepEqual(await read(),{status:'CURRENT_UNAVAILABLE',request:req});
 answer=()=>Response.json({code:'NORMAL_UNDERSTANDING_METADATA_CURRENT_REQUIRED'},{status:403});
 await assert.rejects(read(),{code:'NORMAL_UNDERSTANDING_METADATA_CURRENT_REQUIRED',status:403});
 answer=()=>Response.json({code:'NORMAL_UNDERSTANDING_METADATA_NOT_FOUND'},{status:404});
 await assert.rejects(read(),{code:'NORMAL_UNDERSTANDING_METADATA_NOT_FOUND'});
 answer=()=>Response.json({code:'NORMAL_UNDERSTANDING_METADATA_UNKNOWN'},{status:503});
 await assert.rejects(read(),{code:'NORMAL_UNDERSTANDING_METADATA_UNKNOWN'});
 answer=()=>Response.json({...current,request:{...req,executionGeneration:6}});
 await assert.rejects(read(),{code:'RESPONSE_INVALID'});
 assert.ok(calls.every(call=>call.init?.method==='GET'));
});

test('FN09 protected metadata checks active channel on both sides of current control lookup',async()=>{
 const m=await load();
 const req={projectId,executionId:id(8),executionGeneration:7,assignmentRef,preparationRef,requestRef:ref(26)};
 for(const mode of ['transport','selection','cancel'] as const){
  const controller=new AbortController();let active=true,calls=0,replacement=0,unblock!:()=>void;
  const pending=new Promise<void>(resolve=>{unblock=resolve;});
  const client=new ApiClient(async()=>{calls++;await pending;return Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}});});
  const read=m.readNormalUnderstandingMetadata(client,session,req,controller.signal,()=>active);
  if(mode==='transport')client.transport=async()=>{replacement++;throw Error('UNEXPECTED_FETCH');};
  if(mode==='selection')active=false;
  if(mode==='cancel')controller.abort();
  unblock();
  await assert.rejects(read,{code:'DISCOVERY_SCOPE_CHANGED'});assert.equal(calls,1);assert.equal(replacement,0);
 }
});

test('FN09 Web never sends readiness or a late POST through changed scope or transport',async()=>{
 const m=await load(),signal=new AbortController().signal;
 for(const change of ['transport','selection'] as const){
  const f=fixture(),transport=f.client.transport;let active=true,release!:()=>void,replacement=0;
  const waiting=new Promise<void>(resolve=>{release=resolve;});
  f.client.transport=async(...args)=>{await waiting;return transport(...args);};
  const read=m.readNormalUnderstandingBasis(f.client,session,projectId,assignmentRef,preparationRef,signal,()=>active);
  if(change==='transport')f.client.transport=async()=>{replacement++;return Response.json(f.ready);};
  else active=false;
  release();await assert.rejects(read,{code:'DISCOVERY_SCOPE_CHANGED'});assert.equal(replacement,0);assert.equal(f.calls.length,1);
 }
 const f=fixture(),basis=await m.readNormalUnderstandingBasis(f.client,session,projectId,assignmentRef,preparationRef,signal);
 const command=m.prepareNormalUnderstandingCommand(basis);
 await assert.rejects(m.sendNormalUnderstandingCommand(f.client,session,command,JSON.stringify(command),signal,()=>false),{code:'DISCOVERY_SCOPE_CHANGED'});
 assert.equal(f.calls.some(call=>call.init?.method==='POST'),false);
});

test('FN09 Web preserves an uncertain command across an equivalent session projection and isolates other channels',async()=>{
 const m=await load(),f=fixture(),signal=new AbortController().signal;
 const basis=await m.readNormalUnderstandingBasis(f.client,session,projectId,assignmentRef,preparationRef,signal);
 const command=m.prepareNormalUnderstandingCommand(basis),body=JSON.stringify(command),originalTransport=f.client.transport;
 const ledger=m.normalUnderstandingRecords(session,f.client);
 f.unknown();await assert.rejects(m.sendNormalUnderstandingCommand(f.client,session,command,body,signal),{code:'CONNECTION_LOST'});
 ledger.set('original-command-scope',{command,body,state:'UNKNOWN'});
 const props={client:f.client,projectId,assignmentRef,preparations:[],busy:false};
 const render=(projection:typeof session,client=f.client)=>renderToStaticMarkup(createElement(m.NormalUnderstandingDiscovery,{...props,client,session:projection}));
 const refreshed={...session,user:{...session.user}};
 assert.notStrictEqual(refreshed,session);
 assert.strictEqual(m.normalUnderstandingRecords(refreshed,f.client),ledger);
 const markup=render(refreshed);
 assert.ok(markup.includes(command.commandId));assert.ok(markup.includes('같은 탐색 명령 결과 확인'));
 assert.equal(f.calls.filter(call=>call.init?.method==='POST').length,1);
 for(const other of [{...refreshed,csrfToken:'r'.repeat(43)},{...refreshed,clientId:id(30)},
  {...refreshed,user:{id:id(31)}}])assert.ok(!render(other).includes(command.commandId));
 assert.ok(!render(refreshed,new ApiClient(originalTransport)).includes(command.commandId));
 f.client.transport=async()=>{throw Error('UNEXPECTED_TRANSPORT');};
 assert.ok(!render(refreshed).includes(command.commandId));
 f.client.transport=originalTransport;
 const retained=m.normalUnderstandingRecords(refreshed,f.client).get('original-command-scope');
 assert.equal(retained?.state,'UNKNOWN');assert.ok(retained);
 assert.deepEqual(await m.sendNormalUnderstandingCommand(f.client,refreshed,retained.command,retained.body,signal),ref(26));
 assert.deepEqual(f.calls.filter(call=>call.init?.method==='POST').map(call=>call.init?.body),[body,body]);
});

test('UI04 production 원문 view는 retained exact 준비와 normal review 저장소를 별도 최초 폼에 공급하고 원문은 원장에 보존하지 않는다',async()=>{
 const hooks=await import(reactMemory),m=await compile(reactMemory),f=rangeSource(),snapshot={intent:{projectId,assignmentRef,connectionKind:'REGISTERED_DEFINITION',mode:'CONTEXT_REVIEW',contextBundleRef:f.result.body.contextBundleRef,roleBindingRef:ref(65)},basisRefs:[ref(66)],executionAuthorized:false,dispatchPerformed:false},preparation={projectId,ref:{...preparationRef,contentHash:contentHash(canonicalJson(snapshot))},snapshot};f.input.request.preparationRef=preparation.ref;
 const client=new ApiClient(async(_path,options)=>options?.method==='GET'?Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}}):(()=>{const q=JSON.parse(String(options?.body));return Response.json({operationId:id(24),commandId:q.commandId,projectId,status:'APPLIED',targetId:f.input.request.requestRef.id,version:1,data:{ref:f.input.request.requestRef,requestRef:f.input.request.requestRef,status:'NORMAL_UNDERSTANDING_RANGE_REQUESTED',state:'PENDING_SOURCE',sourceAvailable:false,selectionAvailable:false,expiresAt:f.input.expiresAt},evidenceRefs:[],warnings:[],serverReceivedAt:new Date().toISOString()});})());
 const commands=m.createNormalUnderstandingRangeCommands(client,session,projectId,canonicalJson(assignmentRef),()=>true),s=f.input.selection;await commands.request({request:{...f.input.request,requestRef:s.requestRef},resultRef:s.resultRef,contextBundleRef:f.result.body.contextBundleRef,initConfirmationRef:s.initConfirmationRef,tailRef:s.tailRef,firstSequence:s.firstSequence,lastSequence:s.lastSequence,ranges:s.ranges},new AbortController().signal,()=>true);
 const storage={buffers:{},read:()=>null,onChange:()=>{}},reader=async()=>f.result,draw=()=>hooks.draw(()=>m.NormalUnderstandingDiscovery({client,session,projectId,assignmentRef,preparations:[preparation],busy:false,reviewStorage:storage,rangeRequester:commands.request,rangeRecovery:commands.recover,rangeReader:reader}));
 const node=(t:any):any=>Array.isArray(t)?t.map(node).find(Boolean):t&&typeof t==='object'?(t.props?.storage===storage?t:node(t.props?.children)):undefined;
 try{draw();assert.equal(node(draw()).props.source,null);button(draw(),'보관 원문 확인')!.onClick!();const end=performance.now()+3000;while(!node(draw())?.props.source&&performance.now()<end)await new Promise<void>(r=>setImmediate(r));const provided=node(draw());assert.deepEqual(provided.props.source,f.result);assert.deepEqual(provided.props.preparation.ref,preparation.ref);assert.deepEqual(provided.props.request.preparationRef,preparation.ref);assert.equal(provided.props.viewActive(),true);button(draw(),'원문 닫기')!.onClick!();assert.equal(provided.props.viewActive(),false);assert.equal(node(draw()).props.source,null);assert.ok(!JSON.stringify([...m.normalUnderstandingRecords(session,client)]).includes('원 선택만'));assert.deepEqual(storage.buffers,{});}finally{hooks.unmount();}
});

function historicalSource(){const f=rangeSource(),v=f.result;return{...f,history:{status:'RANGE_STORED_HISTORICAL',requestRef:v.request.requestRef,resultRef:v.resultRef,responseRef:v.responseRef,partRefs:v.partRefs,currentness:'NOT_RECHECKED',observedAt:v.observedAt,expiresAt:v.expiresAt,selectionAvailable:false,reviewAvailable:false,executionAuthorized:false,dispatchPerformed:false,body:v.body}};}
test('역사 원문 reader는 old 전달 기한 뒤 새 제어·세션의 exact sibling GET만 읽고 CURRENT로 승격하지 않는다',async()=>{
 const m=await load(),f=historicalSource(),calls:{path:string;init?:RequestInit}[]=[];f.input.expiresAt=new Date(Date.now()-31000).toISOString();
 const client=new ApiClient(async(path,init)=>{calls.push({path:String(path),init});return String(path).includes('/range-history?')?Response.json(f.history):Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:10,status:'HELD'}});});
 const value=await m.readNormalUnderstandingRangeHistory(client,session,f.input,new AbortController().signal,()=>true);assert.deepEqual(value,f.history);assert.equal(value.status,'RANGE_STORED_HISTORICAL');assert.equal(calls.length,3);assert.match(calls[1]!.path,/range-history\?controlGeneration=10&/);for(const call of calls){assert.equal(call.init?.method,'GET');assert.equal(call.init?.credentials,'same-origin');assert.equal(call.init?.cache,'no-store');assert.equal(call.init?.redirect,'error');assert.equal(call.init?.body,undefined);}
 assert.equal((await m.readNormalUnderstandingRange(client,session,f.input,new AbortController().signal,()=>true)).status,'CURRENT_UNAVAILABLE');assert.equal(calls.length,4);
});

test('역사 reader는 CURRENT/선택/검토 권위·fullref/부분 오염과 다른 current 제어를 모두 거절하고 fallback하지 않는다',async()=>{
 const m=await load();
 const changes=[(v:any)=>{v.status='RANGE_STORED';},(v:any)=>{v.currentness='CURRENT';},(v:any)=>{v.selectionAvailable=true;},(v:any)=>{v.reviewAvailable=true;},(v:any)=>{v.executionAuthorized=true;},(v:any)=>{v.dispatchPerformed=true;},(v:any)=>{v.request={};},(v:any)=>{v.requestRef=ref(99);},(v:any)=>{v.body.executionGeneration++;},(v:any)=>{v.body.sourceResultRef=ref(99);},(v:any)=>{v.body.contextBundleRef=null;},(v:any)=>{v.body.parts[0].textHash='0'.repeat(64);},(v:any)=>{v.partRefs[0].contentHash='0'.repeat(64);},(v:any)=>{v.body.parts[0].blockIndex++;},(v:any)=>{v.body.tailRef=ref(99);},(v:any)=>{v.body.parts[0].text='\ud800';},(v:any)=>{v.expiresAt=v.observedAt;}];
 for(const change of changes){const f=historicalSource(),bad=structuredClone(f.history);change(bad);if(bad.body.parts[0]!.text.isWellFormed())bad.responseRef.contentHash=contentHash(canonicalJson(bad.body));let calls=0;
  const client=new ApiClient(async()=>{calls++;return calls===1?Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}}):Response.json(bad);});
  await assert.rejects(m.readNormalUnderstandingRangeHistory(client,session,f.input,new AbortController().signal,()=>true));assert.equal(calls,2);
 }
 for(const code of ['NORMAL_UNDERSTANDING_RANGE_NOT_FOUND','NORMAL_UNDERSTANDING_RANGE_HISTORY_NOT_STORED','NORMAL_UNDERSTANDING_RANGE_HISTORY_UNKNOWN']){let calls=0;const f=historicalSource(),client=new ApiClient(async()=>++calls===1?Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}}):Response.json({code},{status:code.endsWith('NOT_FOUND')?404:code.endsWith('NOT_STORED')?412:503}));await assert.rejects(m.readNormalUnderstandingRangeHistory(client,session,f.input,new AbortController().signal,()=>true),{code});assert.equal(calls,2);}
 const f=historicalSource();let calls=0;const client=new ApiClient(async()=>{calls++;return calls===2?Response.json(f.history):Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:calls===1?9:10,status:'HELD'}});});await assert.rejects(m.readNormalUnderstandingRangeHistory(client,session,f.input,new AbortController().signal,()=>true),{code:'CONTROL_GENERATION_CONFLICT'});assert.equal(calls,3);
 let currentCalls=0;const mixed=new ApiClient(async()=>++currentCalls===1?Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}}):Response.json(f.history));await assert.rejects(m.readNormalUnderstandingRange(mixed,session,f.input,new AbortController().signal,()=>true),{code:'RESPONSE_INVALID'});assert.equal(currentCalls,2);
});
test('역사 HTTP 원문은 실제 전체 2MiB/UTF8/중복키를 검산하고 초과·불완전 stream을 닫는다',async()=>{
 const m=await load();
 for(const mode of ['exact','over','utf8','duplicate','stream']){const f=historicalSource(),v=f.history,p=v.body.parts[0]!;p.text='';p.textHash=contentHash('');v.partRefs[0]!.contentHash=contentHash(canonicalJson(p));v.responseRef.contentHash=contentHash(canonicalJson(v.body));const overhead=Buffer.byteLength(canonicalJson(v));p.text='x'.repeat(2097152-overhead+(mode==='over'?1:0));p.textHash=contentHash(p.text);v.partRefs[0]!.contentHash=contentHash(canonicalJson(p));v.responseRef.contentHash=contentHash(canonicalJson(v.body));f.input.selection.ranges[0]!.textBytes=Buffer.byteLength(p.text);assert.equal(Buffer.byteLength(canonicalJson(v)),2097152+(mode==='over'?1:0));let calls=0,cancelled=0;
  const client=new ApiClient(async()=>{calls++;if(calls!==2)return Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}});if(mode==='utf8')return new Response(new Uint8Array([0xc3,0x28]),{headers:{'content-type':'application/json'}});if(mode==='duplicate')return new Response(canonicalJson(v).replace('"currentness":"NOT_RECHECKED"','"currentness":"NOT_RECHECKED","currentness":"NOT_RECHECKED"'),{headers:{'content-type':'application/json'}});if(mode==='stream')return new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(2097153));},cancel(){cancelled++;}}),{headers:{'content-type':'application/json'}});return Response.json(v);});
  if(mode==='exact'){const out=await m.readNormalUnderstandingRangeHistory(client,session,f.input,new AbortController().signal,()=>true);assert.equal(out.body.parts[0]!.text,p.text);assert.equal(calls,3);}else{await assert.rejects(m.readNormalUnderstandingRangeHistory(client,session,f.input,new AbortController().signal,()=>true),{code:'RESPONSE_INVALID'});assert.equal(calls,2);if(mode==='stream')assert.equal(cancelled,1);}
 }
});
test('역사 reader의 새 호출 기한은 멈춘 body를 취소하고 늦은 응답/owner 상실 뒤 제어 조회나 본문 파싱을 하지 않는다',async t=>{
 const m=await load(),f=historicalSource();let calls=0,cancelled=0,ready!:()=>void;const pending=new Promise<void>(r=>{ready=r;});
 const client=new ApiClient(async()=>++calls===1?Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}}):new Response(new ReadableStream({pull(){ready();},cancel(){cancelled++;}},{highWaterMark:0}),{headers:{'content-type':'application/json'}}));
 t.mock.timers.enable({apis:['setTimeout']});try{const result=m.readNormalUnderstandingRangeHistory(client,session,f.input,new AbortController().signal,()=>true);await pending;t.mock.timers.tick(30000);await assert.rejects(result);assert.equal(cancelled,1);assert.equal(calls,2);t.mock.timers.tick(30000);assert.equal(cancelled,1);}finally{t.mock.timers.reset();}
 let release!:(r:Response)=>void,started!:()=>void;const waiting=new Promise<void>(r=>{started=r;});calls=0;let active=true;const late=new ApiClient(async()=>{calls++;if(calls===1)return Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}});started();return new Promise<Response>(r=>{release=r;});});const result=m.readNormalUnderstandingRangeHistory(late,session,f.input,new AbortController().signal,()=>active);await waiting;active=false;release(Response.json(f.history));await assert.rejects(result);assert.equal(calls,2);
});


test('역사 UI 실제 workspace→보관 요청→명시 버튼은 새 보호 GET만 잇고 현재 검토·원장으로 원문을 넘기지 않는다',async t=>{
 const hooks=await import(reactMemory),w=await compile(reactMemory,'WorkspaceResponsibleSessions'),f=historicalSource();
 const calls:{path:string;method:string;body?:BodyInit|null}[]=[],at=Date.now(),old=f.input.expiresAt;
 let answer='STORED',projection=session;
 const client=new ApiClient(async(url,options)=>{
  const path=String(url),method=options?.method??'GET';calls.push({path,method,body:options?.body});
  if(path===`/api/v1/projects/${projectId}`)return Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:10,status:'HELD'}});
  if(method==='POST'){
   const command=JSON.parse(String(options?.body));
   return Response.json({operationId:id(24),commandId:command.commandId,projectId,status:'APPLIED',targetId:f.input.request.requestRef.id,version:1,
    data:{ref:f.input.request.requestRef,requestRef:f.input.request.requestRef,status:'NORMAL_UNDERSTANDING_RANGE_REQUESTED',state:'PENDING_SOURCE',sourceAvailable:false,selectionAvailable:false,expiresAt:old},evidenceRefs:[],warnings:[],serverReceivedAt:new Date().toISOString()});
  }
  assert.match(path,/\/range-history\?/);
  if(answer==='STORED')return Response.json(f.history);
  const status=answer==='NOT_FOUND'?404:answer==='NOT_STORED'?412:answer==='DENIED'?403:503;
  const code=answer==='NOT_FOUND'?'NORMAL_UNDERSTANDING_RANGE_NOT_FOUND':answer==='NOT_STORED'?'NORMAL_UNDERSTANDING_RANGE_HISTORY_NOT_STORED':answer==='DENIED'?'PROJECT_OPERATION_DENIED':'NORMAL_UNDERSTANDING_RANGE_HISTORY_UNKNOWN';
  return Response.json({code},{status});
 });
 const find=(tree:any,predicate:(node:any)=>boolean):any=>Array.isArray(tree)?tree.map(n=>find(n,predicate)).find(Boolean):tree&&typeof tree==='object'?(predicate(tree)?tree:find(tree.props?.children,predicate)):undefined;
 const workspace=(owner=true)=>hooks.draw(()=>w.WorkspaceResponsibleSessions({client,confirmed:{projectId,ref:assignmentRef} as any,session:projection,owner,buffer:null,onChange:()=>{},busy:false,run:()=>{}}),'workspace-history');
 const discovery=()=>find(workspace(),n=>typeof n.props?.rangeHistoryReader==='function');
 const draw=()=>{const n=discovery();assert.ok(n);return hooks.draw(()=>n.type(n.props),'discovery-history');};
 const history=()=>find(draw(),n=>typeof n.props?.verify==='function'&&typeof n.props?.reader==='function');
 const drawHistory=()=>{const n=history();assert.ok(n);return hooks.draw(()=>n.type(n.props),'history');};
 const markup=()=>renderToStaticMarkup(drawHistory());
 const click=()=>{const b=button(drawHistory(),'과거 보관 원문 확인');assert.ok(b?.onClick);assert.equal(!!b.disabled,false);b.onClick();};
 const wait=async(text:string)=>{const until=performance.now()+3000;while(!markup().includes(text)&&performance.now()<until)await new Promise<void>(r=>setImmediate(r));assert.ok(markup().includes(text));};
 try{
  const supplied=discovery();assert.ok(supplied);assert.equal(calls.length,0);
  assert.ok(renderToStaticMarkup(draw()).includes('정확한 구간 요청 참조가 없어'));assert.equal(history(),undefined);
  const s=f.input.selection;
  await supplied.props.rangeRequester({request:{...f.input.request,requestRef:s.requestRef},resultRef:s.resultRef,contextBundleRef:f.history.body.contextBundleRef,initConfirmationRef:s.initConfirmationRef,tailRef:s.tailRef,firstSequence:s.firstSequence,lastSequence:s.lastSequence,ranges:s.ranges},new AbortController().signal,()=>true);
  t.mock.method(Date,'now',()=>at+31000);f.history.observedAt=new Date(at+31000).toISOString();f.history.expiresAt=new Date(at+51000).toISOString();
  const initial=calls.length,n=history();assert.ok(n);assert.deepEqual(n.props.input.request,f.input.request);assert.equal(n.props.input.expiresAt,old);assert.equal(n.props.input.controlGeneration,10);assert.ok(!JSON.stringify(n.props.input).includes('원 선택만'));
  const firstReader=supplied.props.rangeHistoryReader;
  assert.equal(calls.length,initial);click();await wait('현재 실행·검토 근거 없음');
  assert.equal(calls.length,initial+3);assert.ok(calls.slice(initial).every(c=>c.method==='GET'&&c.body===undefined));assert.match(calls[initial+1]!.path,/range-history\?controlGeneration=10&/);
  assert.match(markup(),/&lt;script&gt;원 선택만&lt;\/script&gt;/);assert.doesNotMatch(markup(),/<script>|현재 읽기 권한 미재검산|검토 명령 준비|승인 요청|현재 원문 보관 확인/);
  assert.ok(!JSON.stringify(hooks.snapshot('discovery-history')).includes('원 선택만'));assert.ok(!JSON.stringify(hooks.snapshot('workspace-history')).includes('원 선택만'));
  button(drawHistory(),'과거 원문 닫기')!.onClick!();assert.doesNotMatch(markup(),/원 선택만/);assert.ok(!JSON.stringify(hooks.snapshot('history')).includes('원 선택만'));
  for(const [mode,message] of [['NOT_STORED','아직 정착되지 않았습니다'],['NOT_FOUND','찾을 수 없습니다'],['DENIED','현재 인증·제어·읽기 권한'],['UNKNOWN','결과 미확인']] as const){
   answer=mode;const before:number=calls.length;click();await wait(message);assert.equal(calls.length,before+2);assert.doesNotMatch(markup(),/원 선택만/);
  }
  const before=calls.length;projection={...session,csrfToken:'r'.repeat(43)};assert.equal(history(),undefined);hooks.unmount('history');
  assert.ok(renderToStaticMarkup(draw()).includes('정확한 구간 요청 참조가 없어'));assert.equal(calls.length,before);
  await assert.rejects(firstReader(f.input,new AbortController().signal),{code:'DISCOVERY_SCOPE_CHANGED'});assert.equal(calls.length,before);
  workspace(false);projection=session;workspace();await assert.rejects(firstReader(f.input,new AbortController().signal),{code:'DISCOVERY_SCOPE_CHANGED'});assert.equal(calls.length,before);
  assert.equal(calls.filter(c=>c.method==='POST').length,1);
 }finally{hooks.unmount('history');hooks.unmount('discovery-history');hooks.unmount('workspace-history');t.mock.restoreAll();}
});

test('역사 별도 view는 취소·변경·ABA·늦은 결과·유한 기한에서 raw를 폐기하고 다음 동작을 만들지 않는다',async t=>{
 const hooks=await import(reactMemory),h=await compile(reactMemory,'NormalUnderstandingRangeHistory'),m=await load(),f=historicalSource();
 type Reader=NonNullable<Parameters<UI['NormalUnderstandingDiscovery']>[0]['rangeHistoryReader']>;
 const calls:{input:Parameters<Reader>[0];signal:AbortSignal;resolve:(value:Awaited<ReturnType<Reader>>)=>void;reject:(error:unknown)=>void}[]=[];
 const original:Reader=(input,signal)=>new Promise((resolve,reject)=>calls.push({input,signal,resolve,reject}));
 let reader=original,input=structuredClone(f.input),active=true,disabled=false,entryOwner={entry:'exact-retained'},scopeOwner={scope:'exact-auth-owner'};
 const draw=()=>hooks.draw(()=>h.NormalUnderstandingRangeHistory({input,reader,verify:m.verifyNormalUnderstandingRangeHistory,active:()=>active,disabled,scopeOwner,entryOwner}),'history-lifetime');
 const markup=()=>renderToStaticMarkup(draw());
 const click=(label='과거 보관 원문 확인')=>{const b=button(draw(),label);assert.ok(b?.onClick);assert.equal(!!b.disabled,false);b.onClick();};
 const settle=async()=>{for(let i=0;i<8;i++)await new Promise<void>(r=>setImmediate(r));};
 const reveal=async()=>{click();calls.at(-1)!.resolve(structuredClone(f.history) as Awaited<ReturnType<Reader>>);const until=performance.now()+3000;while(!markup().includes('현재 실행·검토 근거 없음')&&performance.now()<until)await new Promise<void>(r=>setImmediate(r));assert.match(markup(),/원 선택만/);};
 try{
  assert.doesNotMatch(markup(),/원 선택만/);assert.equal(calls.length,0);
  const staleClick=button(draw(),'과거 보관 원문 확인')!.onClick!;staleClick();staleClick();assert.equal(calls.length,1);
  click('과거 원문 조회 취소');assert.equal(calls[0]!.signal.aborted,true);calls[0]!.resolve(f.history as Awaited<ReturnType<Reader>>);await settle();assert.doesNotMatch(markup(),/원 선택만/);
  await reveal();click('과거 원문 닫기');assert.ok(!JSON.stringify(hooks.snapshot('history-lifetime')).includes('원 선택만'));
  for(const change of ['input','reader','owner','busy','entry','scope'] as const){
   await reveal();const retained=structuredClone(input);
   if(change==='input')input.request.preparationRef=ref(99);else if(change==='reader')reader=(...args)=>original(...args);else if(change==='owner')active=false;else if(change==='busy')disabled=true;else if(change==='entry')entryOwner={...entryOwner};else scopeOwner={...scopeOwner};
   assert.doesNotMatch(markup(),/원 선택만/);assert.ok(!JSON.stringify(hooks.snapshot('history-lifetime')).includes('원 선택만'));
   input=retained;reader=original;active=true;disabled=false;assert.doesNotMatch(markup(),/원 선택만/);
  }
  click();const swapped=calls.at(-1)!,oldEntry=entryOwner;entryOwner={...oldEntry};draw();assert.equal(swapped.signal.aborted,true);entryOwner=oldEntry;draw();swapped.resolve(f.history as Awaited<ReturnType<Reader>>);await settle();assert.doesNotMatch(markup(),/원 선택만/);
  click();const late=calls.at(-1)!;reader=(...args)=>original(...args);draw();assert.equal(late.signal.aborted,true);reader=original;draw();late.reject(Error('raw-private-error'));await settle();assert.doesNotMatch(markup(),/원 선택만|raw-private-error/);
  t.mock.timers.enable({apis:['setTimeout']});
  try{
   click();const stalled=calls.at(-1)!;t.mock.timers.tick(30000);assert.equal(stalled.signal.aborted,true);assert.match(markup(),/결과 미확인/);stalled.resolve(f.history as Awaited<ReturnType<Reader>>);await settle();assert.doesNotMatch(markup(),/원 선택만/);t.mock.timers.tick(30000);assert.doesNotMatch(markup(),/원 선택만/);
   await reveal();t.mock.timers.tick(20001);assert.doesNotMatch(markup(),/원 선택만/);assert.ok(!JSON.stringify(hooks.snapshot('history-lifetime')).includes('원 선택만'));
  }finally{t.mock.timers.reset();}
 }finally{hooks.unmount('history-lifetime');}
});


test('역사 응답의 새 최단 기한은 유효한 과거 관측은 허용하되 이미 만료한 exact 응답을 되살리지 않는다',async t=>{
 const m=await load(),at=Date.now();t.mock.method(Date,'now',()=>at);
 try{
  for(const [observed,expires,ok] of [[at-15000,at+1000,true],[at-20000,at-1,false],[at,at+1000,true]] as const){
   const f=historicalSource();f.history.observedAt=new Date(observed).toISOString();f.history.expiresAt=new Date(expires).toISOString();let calls=0;
   const client=new ApiClient(async()=>++calls===2?Response.json(f.history):Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}}));
   if(ok)assert.deepEqual(await m.readNormalUnderstandingRangeHistory(client,session,f.input,new AbortController().signal,()=>true),f.history);
   else await assert.rejects(m.readNormalUnderstandingRangeHistory(client,session,f.input,new AbortController().signal,()=>true));
   assert.equal(calls,ok?3:2);
   if(!ok)await assert.rejects(m.verifyNormalUnderstandingRangeHistory(f.history,f.input,()=>{}),{code:'RESPONSE_INVALID'});
  }
 }finally{t.mock.restoreAll();}
});


test('역사 별도 보기의 표시 timer는 과거 관측 간격보다 이번 응답 절대 expiry가 짧으면 먼저 원문을 폐기한다',async t=>{
 const hooks=await import(reactMemory),h=await compile(reactMemory,'NormalUnderstandingRangeHistory'),m=await load(),at=Date.now();
 t.mock.method(Date,'now',()=>at);t.mock.timers.enable({apis:['setTimeout']});
 const f=historicalSource();f.history.observedAt=new Date(at-15000).toISOString();f.history.expiresAt=new Date(at+1000).toISOString();
 let calls=0;const reader=async()=>{calls++;return f.history as Awaited<ReturnType<NonNullable<Parameters<UI['NormalUnderstandingDiscovery']>[0]['rangeHistoryReader']>>>;};
 const scopeOwner={},entryOwner={};
 const draw=()=>hooks.draw(()=>h.NormalUnderstandingRangeHistory({input:f.input,reader,verify:m.verifyNormalUnderstandingRangeHistory,active:()=>true,disabled:false,scopeOwner,entryOwner}),'history-absolute');
 const markup=()=>renderToStaticMarkup(draw());
 try{
  button(draw(),'과거 보관 원문 확인')!.onClick!();const until=performance.now()+3000;
  while(!markup().includes('현재 실행·검토 근거 없음')&&performance.now()<until)await new Promise<void>(r=>setImmediate(r));
  assert.match(markup(),/원 선택만/);assert.equal(calls,1);t.mock.timers.tick(1001);assert.doesNotMatch(markup(),/원 선택만/);assert.ok(!JSON.stringify(hooks.snapshot('history-absolute')).includes('원 선택만'));
  f.history.expiresAt=new Date(at-1).toISOString();button(draw(),'과거 보관 원문 확인')!.onClick!();
  for(let i=0;i<5;i++)await new Promise<void>(r=>setImmediate(r));assert.doesNotMatch(markup(),/원 선택만/);assert.match(markup(),/결과 미확인/);assert.equal(calls,2);
 }finally{hooks.unmount('history-absolute');t.mock.timers.reset();t.mock.restoreAll();}
});


test('현재·역사 공통 body 검산은 spoof 본문 SHA 및 result/response ID alias를 각각 거절한다',async()=>{
 const m=await load();
 for(const historical of [false,true])for(const mismatch of ['body-hash','result-id','source-id'] as const){
  const f=historicalSource(),value=historical?f.history:f.result;
  if(mismatch==='body-hash')value.responseRef.contentHash='0'.repeat(64);
  else value.responseRef.id=mismatch==='result-id'?value.resultRef.id:f.input.selection.requestRef.id;
  let calls=0;const client=new ApiClient(async()=>++calls===1?Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:9,status:'HELD'}}):Response.json(value));
  const read=historical?m.readNormalUnderstandingRangeHistory:m.readNormalUnderstandingRange;
  await assert.rejects(read(client,session,f.input,new AbortController().signal,()=>true),{code:'RESPONSE_INVALID'});assert.equal(calls,2);
 }
});


function normalClaimSource(){
 const f=historicalSource(),scope={projectId,executionId:f.input.request.executionId,executionGeneration:f.input.request.executionGeneration},sessionRef=ref(64),subject=ref(65),basisRefs=[ref(66)],received=[ref(67)],at=new Date().toISOString();
 const optionsBody=canonicalJson({claudeQueryParams:{model:'auto'}});
 const snapshot={intent:{projectId,assignmentRef,roleBindingRef:subject,contextBundleRef:f.history.body.contextBundleRef,connectionRef:ref(68),environmentRef:ref(69),capabilityRef:ref(70),budgetPolicyRef:ref(71),sourceScopes:[{sourceRootRef:ref(72),mappingRef:null,observationRef:ref(73),baselineRef:ref(74),targets:[{relativePath:'src/main.ts',kind:'FILE',access:'READ',recursive:false}]}],mode:'CONTEXT_REVIEW',reason:'등록 준비 당시 원형',connectionKind:'REGISTERED_DEFINITION',optionsFormat:'CLAUDE_QUERY_DATA_V1'},basisRefs,latestInstructionRefs:[],checkedAt:at,missingConditions:['RESPONSIBLE_SESSION_RESERVED','CONNECTION_DEFINITION_ONLY','ENVIRONMENT_DEFINITION_ONLY','CAPABILITY_UNVERIFIED','BUDGET_POLICY_UNVERIFIED','SOURCE_AUTHORIZATION_UNVERIFIED','HOST_OS_FENCE_UNVERIFIED'],authorizationState:'NOT_AUTHORIZED',preparedBy:{kind:'HUMAN',userId:session.user.id},executionAuthorized:false,dispatchPerformed:false,options:{format:'CLAUDE_QUERY_DATA_V1',mediaType:'application/json',body:optionsBody,utf8Bytes:Buffer.byteLength(optionsBody),contentHash:contentHash(optionsBody)}};
 const preparation={projectId,ref:{...preparationRef,contentHash:contentHash(canonicalJson(snapshot))},snapshot,currentness:'NOT_RECHECKED'};f.input.request.preparationRef=preparation.ref;
 const codes=['PURPOSE_REASON','BASELINE_AUTHORITY','DECISIONS_REASON','CURRENT_POSITION','ACTUAL_GAPS','NEXT_ACTION'];
 const input={bundleRef:f.history.body.contextBundleRef,responseRef:f.history.responseRef,subjectBindingRef:subject,criteriaVersion:1,items:codes.map(code=>({code,sourceRefs:basisRefs,responsePartRefs:f.history.partRefs,judgement:'INSUFFICIENT',reason:'당시 사람의 부족 판단'})),reason:'정확 보관 범위로 판단한 당시 기록'};
 const request={schemaVersion:1,projectId,commandId:id(75),clientId:session.clientId,controlGeneration:9,operation:'reviewUnderstanding',targetId:scope.executionId,expectedVersion:scope.executionGeneration,baselineRefs:[],approvalRef:null,payload:input};
 const ground={bundleRef:input.bundleRef,preparationRef:preparation.ref,grantRef:ref(76),startCommandRef:ref(77),manifestRef:ref(78),roleBindingRef:subject,agentSessionRef:sessionRef,roleRef:ref(79),subjectBindingRef:subject,requestRef:f.input.request.requestRef,responseRef:input.responseRef,basisRefs,requiredPartRefs:received,receivedPartRefs:received,deliveryReceiptRefs:[ref(80)],responsePartRefs:f.history.partRefs,latestInstructionRefs:[],status:'SOURCE_BASIS_ONLY',subjectBindingState:'VERIFIED',reviewAvailable:false,scope,executionAuthorized:false,dispatchPerformed:false};
 const binding={transport:'NORMAL_PROTECTED',scope,bundleRef:input.bundleRef,responseRef:input.responseRef,subjectBindingRef:subject,basisRefs,latestInstructionRefs:[],requiredPartRefs:received,receivedPartRefs:received,responsePartRefs:f.history.partRefs,criteria:input.items.map(({judgement:_j,reason:_r,...item})=>item),sourceState:'AVAILABLE',responseSubject:'EXTERNAL_AGENT',sourceBasis:ground};
 const review={scope,sequence:1,previousRef:null,request,requestHash:contentHash(canonicalJson(request)),reviewer:{kind:'HUMAN',userId:session.user.id,clientId:session.clientId,humanSessionId:id(81),credentialGeneration:1,controlGeneration:9},policyRef:ref(82),currentBinding:binding,input,outcome:'NOT_ACCEPTED',recordedAt:at,executionAuthorized:false,dispatchPerformed:false};
 const normal={transport:'NORMAL_PROTECTED',scope,items:[{ref:{...ref(83),contentHash:contentHash(canonicalJson(review))},snapshot:review}],currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false};
 const claimRef=ref(84),query={projectId,agentSessionId:sessionRef.id,executionId:scope.executionId,generation:scope.executionGeneration,commandId:id(85),kind:'THREAD' as const,requestIdDigest:'b'.repeat(64),claimHash:claimRef.contentHash};
 const receipt={claimRef:{...claimRef,version:1 as const},recordedAt:at,state:'PROVIDER_CLAIM_RECORDED' as const,sourceVerification:'PROVIDER_CLAIM_ONLY' as const,nonceConsumed:true as const,credentialIssued:false as const,executionAuthorized:false as const,dispatchPerformed:false as const,workAccepted:false as const},item={query,receipt};
 const original={found:true,receipt,observedAt:at,historyOnly:true,executionAuthorized:false,dispatchPerformed:false};
 const page={projectId,agentSessionId:sessionRef.id,agentSessionRef:sessionRef,items:[item],hasMore:false,nextCursor:null,observedAt:at,historyOnly:true,availability:'UNVERIFIED',executionAuthorized:false,dispatchPerformed:false};
 return {...f,scope,sessionRef,preparation,normal,item,original,page};
}

test('새 로그인의 normal 참조 재발견은 exact claim→정상 판단 v1→정확 준비 버전만 GET하고 옛 선택·기한을 만들지 않는다',async()=>{
 const f=normalClaimSource(),calls:string[]=[];
 const client=new ApiClient(async(url,options)=>{calls.push(String(url));assert.equal(options?.method,'GET');return Response.json(calls.length===1?f.original:calls.length===2?f.normal:f.preparation);});
 const result=await readNormalClaimRangeHistory(client,projectId,f.sessionRef,f.item,new AbortController().signal,()=>true);
 assert.equal(result.status,'EXACT_NORMAL_RANGE_REFS');assert.equal(calls.length,3);assert.match(calls[0]!,/provider-session-claim-receipt\?/);assert.equal(calls[1],`/api/v1/projects/${projectId}/executions/${f.scope.executionId}/understanding-reviews?generation=7`);assert.equal(calls[2],`/api/v1/projects/${projectId}/execution-preparations/${preparationRef.id}/versions/1`);
 if(result.status!=='EXACT_NORMAL_RANGE_REFS')assert.fail();assert.deepEqual(result.origin.request,f.input.request);assert.deepEqual(result.origin.responseRef,f.history.responseRef);assert.deepEqual(result.origin.partRefs,f.history.partRefs);assert.equal('selection'in result.origin,false);assert.equal('expiresAt'in result.origin,false);assert.ok(!JSON.stringify(result).includes('원 선택만'));
 const m=await load();let rawCalls=0;const rawClient=new ApiClient(async(url,options)=>{rawCalls++;assert.equal(options?.method,'GET');return String(url).includes('/range-history?')?Response.json(f.history):Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:11,status:'HELD'}});});
 assert.deepEqual(await m.readReviewedNormalUnderstandingRangeHistory(rawClient,{...session,csrfToken:'r'.repeat(43)},result.origin,new AbortController().signal,()=>true),f.history);assert.equal(rawCalls,3);
});

test('normal claim 탐색은 합성 혼입·제로·손상·다른 세션/준비/판단 scope를 원문 권위나 최신 대체로 바꾸지 않는다',async()=>{
 for(const mode of ['EMPTY','SYNTHETIC','SESSION','PREP_HASH','PREP_ROLE','PREP_BUNDLE','PREP_BASIS','PREP_PATH','HISTORY_REF','MISSING','DENY']){
  const f=normalClaimSource(),h:any=structuredClone(f.normal),p=structuredClone(f.preparation),o=structuredClone(f.original);let calls=0;
  if(mode==='EMPTY')h.items=[];if(mode==='SYNTHETIC')h.transport='SYNTHETIC_ONLY';if(mode==='SESSION'){h.items[0].snapshot.currentBinding.sourceBasis.agentSessionRef=ref(99);h.items[0].ref.contentHash=contentHash(canonicalJson(h.items[0].snapshot));}if(mode==='HISTORY_REF')h.items[0].ref.contentHash='0'.repeat(64);if(mode==='MISSING'){o.found=false;(o as any).receipt=null;}
  if(mode==='PREP_HASH')p.snapshot.intent.reason+='tamper';if(mode==='PREP_ROLE')p.snapshot.intent.roleBindingRef=ref(99);if(mode==='PREP_BUNDLE')p.snapshot.intent.contextBundleRef=ref(99);if(mode==='PREP_BASIS')p.snapshot.basisRefs=[ref(99)];if(mode==='PREP_PATH')p.snapshot.intent.sourceScopes[0]!.targets[0]!.relativePath='../private';
  if(['PREP_ROLE','PREP_BUNDLE','PREP_BASIS','PREP_PATH'].includes(mode)){p.ref.contentHash=contentHash(canonicalJson(p.snapshot));h.items[0].snapshot.currentBinding.sourceBasis.preparationRef=p.ref;h.items[0].ref.contentHash=contentHash(canonicalJson(h.items[0].snapshot));}
  const client=new ApiClient(async()=>{calls++;return mode==='DENY'?Response.json({code:'FORBIDDEN'},{status:403}):Response.json(calls===1?o:calls===2?h:p);});
  const value=readNormalClaimRangeHistory(client,projectId,f.sessionRef,f.item,new AbortController().signal,()=>true);
  if(mode==='EMPTY')assert.deepEqual(await value,{status:'NO_NORMAL_REVIEW'});else await assert.rejects(value,mode);
  assert.equal(calls,['DENY','MISSING'].includes(mode)?1:['EMPTY','SYNTHETIC','SESSION','HISTORY_REF'].includes(mode)?2:3);
 }
});

test('normal claim 탐색의 각 await 뒤 이탈·취소는 후속 GET0이고 원 transport와 선택 객체를 끝까지 고정한다',async()=>{
 for(const stop of [1,2,3])for(const mode of ['OWNER','ABORT','ITEM','TRANSPORT']){
  const f=normalClaimSource(),controller=new AbortController();let calls=0,active=true,replacement=0;
  const client=new ApiClient(async()=>{calls++;if(calls===stop){if(mode==='OWNER')active=false;else if(mode==='ABORT')controller.abort();else if(mode==='ITEM')f.item.query.generation++;else client.transport=async()=>{replacement++;throw Error('WRONG_TRANSPORT');};}return Response.json(calls===1?f.original:calls===2?f.normal:f.preparation);});
  await assert.rejects(readNormalClaimRangeHistory(client,projectId,f.sessionRef,f.item,controller.signal,()=>active));assert.equal(calls,stop);assert.equal(replacement,0);
 }
});


test('실제 Provider claim 목록의 명시 버튼→normal exact 참조→별도 과거 원문은 새 로그인에서 원장 없이 GET만 수행한다',async()=>{
 const hooks=await import(reactMemory),w=await compile(reactMemory,'WorkspaceResponsibleSessions'),f=normalClaimSource(),calls:{path:string;init?:RequestInit}[]=[];
 let projection={...session,csrfToken:'r'.repeat(43)},active=true;
 const client=new ApiClient(async(url,init)=>{
  const path=String(url);calls.push({path,init});assert.equal(init?.method,'GET');
  if(path.includes('/provider-session-claims?'))return Response.json(f.page);
  if(path.includes('/provider-session-claim-receipt?'))return Response.json(f.original);
  if(path.includes('/understanding-reviews?'))return Response.json(f.normal);
  if(path.includes('/execution-preparations/'))return Response.json(f.preparation);
  if(path.includes('/range-history?'))return Response.json(f.history);
  assert.equal(path,`/api/v1/projects/${projectId}`);return Response.json({id:projectId,participation:'OWNER',controlState:{actorId:session.user.id,clientId:session.clientId,generation:12,status:'HELD'}});
 });
 const find=(tree:any,pred:(n:any)=>boolean):any=>Array.isArray(tree)?tree.map(n=>find(n,pred)).find(Boolean):tree&&typeof tree==='object'?(pred(tree)?tree:find(tree.props?.children,pred)):undefined;
 const draw=()=>hooks.draw(()=>w.ProviderClaimHistoryPanel({client,projectId,sessionRef:f.sessionRef,subjectKey:session.user.id+':'+session.clientId,normalSession:projection,normalActive:()=>active,onAuthenticationLost:()=>{throw Error('UNEXPECTED_AUTH_FAILURE');}}),'claim-list');
 const normal=()=>find(draw(),n=>n.props?.entryOwner&&n.props?.item&&n.props?.session);
 const drawNormal=()=>{const n=normal();assert.ok(n);return hooks.draw(()=>n.type(n.props),'claim-normal');};
 const source=()=>find(drawNormal(),n=>n.props?.input?.kind==='NORMAL_REVIEW_HISTORY');
 const raw=()=>{const n=source();assert.ok(n);return hooks.draw(()=>n.type(n.props),'claim-raw');};
 const html=()=>renderToStaticMarkup(raw());
 const until=async(check:()=>boolean)=>{const end=performance.now()+3000;while(!check()&&performance.now()<end)await new Promise<void>(r=>setImmediate(r));assert.ok(check());};
 try{
  draw();assert.equal(calls.length,0);button(draw(),'공급자 세션 기록 조회')!.onClick!();
  await until(()=>!!find(draw(),n=>typeof n.props?.onNormalHistory==='function'));
  const row=find(draw(),n=>typeof n.props?.onNormalHistory==='function'),tree=row.type(row.props);
  assert.match(renderToStaticMarkup(tree),/이 실행의 이해 검토 이력/);
  const choose=find(tree,n=>n.type==='button'&&String(n.props.children).includes('과거 원문 참조 확인'));assert.ok(choose);choose.props.onClick();drawNormal();
  await until(()=>!!source());assert.equal(calls.length,4);assert.equal(source().props.input.kind,'NORMAL_REVIEW_HISTORY');assert.equal('selection'in source().props.input,false);assert.equal('expiresAt'in source().props.input,false);assert.doesNotMatch(renderToStaticMarkup(drawNormal()),/원 선택만/);
  const selected=source().props.input;assert.deepEqual(selected.request,f.input.request);button(raw(),'과거 보관 원문 확인')!.onClick!();await until(()=>html().includes('현재 실행·검토 근거 없음'));
  assert.equal(calls.length,7);assert.match(html(),/&lt;script&gt;원 선택만&lt;\/script&gt;/);assert.doesNotMatch(html(),/<script>|검토 명령|승인 요청/);
  assert.match(calls[5]!.path,/range-history\?controlGeneration=12&/);assert.equal(new Headers(calls[5]!.init?.headers).get('x-anvil-csrf'),projection.csrfToken);
  assert.ok(!JSON.stringify(hooks.snapshot('claim-list')).includes('원 선택만'));assert.ok(!JSON.stringify(hooks.snapshot('claim-normal')).includes('원 선택만'));
  button(raw(),'과거 원문 닫기')!.onClick!();assert.doesNotMatch(html(),/원 선택만/);
  button(drawNormal(),'과거 원문 참조 확인 취소·닫기')!.onClick!();assert.equal(normal(),undefined);hooks.unmount('claim-raw');hooks.unmount('claim-normal');
  const before=calls.length;projection={...projection,csrfToken:'s'.repeat(43)};draw();assert.equal(find(draw(),n=>typeof n.props?.onNormalHistory==='function'),undefined);assert.equal(calls.length,before);
  assert.ok(calls.every(c=>c.init?.method==='GET'&&c.init?.body===undefined));
 }finally{hooks.unmount('claim-raw');hooks.unmount('claim-normal');hooks.unmount('claim-list');}
});

test('normal claim 다단계 await 중 same-value 선택 객체/owner ABA와 취소는 원 요청을 닫고 늦은 결과·후속 GET을 폐기한다',async()=>{
 const hooks=await import(reactMemory),w=await compile(reactMemory,'WorkspaceResponsibleSessions');
 for(const phase of [1,2,3]){
  const f=normalClaimSource();let calls=0,active=true,release!:(r:Response)=>void,ready!:()=>void,owned:AbortSignal|null|undefined;
  const waiting=new Promise<void>(r=>{ready=r;}),scopeOwner={},originalOwner={key:'choice'},originalItem=f.item;
  let entryOwner=originalOwner,item=originalItem;
  const value=()=>calls===1?f.original:calls===2?f.normal:f.preparation;
  const client=new ApiClient(async(_url,init)=>{calls++;if(calls===phase){owned=init?.signal;ready();return new Promise<Response>(r=>{release=r;});}return Response.json(value());});
  const draw=()=>hooks.draw(()=>w.NormalClaimRangeHistoryPanel({client,session,projectId,sessionRef:f.sessionRef,item,scopeOwner,entryOwner,active:()=>active,onClose:()=>{active=false;}}),'claim-await');
  try{
   draw();await waiting;assert.equal(calls,phase);active=false;item=structuredClone(originalItem);entryOwner={...originalOwner};draw();assert.equal(owned?.aborted,true);
   item=originalItem;entryOwner=originalOwner;draw();release(Response.json(value()));for(let i=0;i<12;i++)await new Promise<void>(r=>setImmediate(r));
   assert.equal(calls,phase);assert.doesNotMatch(renderToStaticMarkup(draw()),/과거 보관 원문 확인|원 선택만/);assert.ok(!JSON.stringify(hooks.snapshot('claim-await')).includes('원 선택만'));
  }finally{hooks.unmount('claim-await');}
 }
});

test('재발견 원문도 exact review body/part/bundle 및 공용 유한 prefix 문법 오염을 선택 payload 복원 없이 거절한다',async()=>{
 const m=await load(),f=normalClaimSource();const basis=await readNormalClaimRangeHistory(new ApiClient(async(url)=>Response.json(String(url).includes('claim-receipt')?f.original:String(url).includes('understanding-reviews')?f.normal:f.preparation)),projectId,f.sessionRef,f.item,new AbortController().signal,()=>true);assert.equal(basis.status,'EXACT_NORMAL_RANGE_REFS');if(basis.status!=='EXACT_NORMAL_RANGE_REFS')assert.fail();
 const changes=[(v:any)=>v.body.parts[0].sequence++,(v:any)=>v.body.parts[0].blockIndex++,(v:any)=>v.body.parts[0].kind='SYSTEM_INIT',(v:any)=>v.body.contextBundleRef=ref(99),(v:any)=>v.body.executionGeneration++,(v:any)=>v.partRefs[0]=ref(99),(v:any)=>v.body.beforeRef=null,(v:any)=>v.body.afterRef=v.body.parts[0].outputRef,(v:any)=>v.body.parts[0].text='\ud800',(v:any)=>v.responseRef.id=v.resultRef.id,(v:any)=>v.responseRef.contentHash='0'.repeat(64),(v:any)=>v.currentness='CURRENT'];
 for(const [index,change] of changes.entries()){const v:any=structuredClone(f.history),input=structuredClone(basis.origin);change(v);
  if(v.body.parts[0].text.isWellFormed()&&v.responseRef.contentHash!=='0'.repeat(64)){v.body.parts[0].textHash=contentHash(v.body.parts[0].text);v.partRefs[0].contentHash=contentHash(canonicalJson(v.body.parts[0]));v.responseRef.contentHash=contentHash(canonicalJson(v.body));if(input.responseRef.id===v.responseRef.id)input.responseRef=v.responseRef;if(input.partRefs[0]!.id===v.partRefs[0].id)input.partRefs=v.partRefs;}
  await assert.rejects(m.verifyReviewedNormalUnderstandingRangeHistory(v,input,()=>{}),{code:'RESPONSE_INVALID'},'case '+index);
 }
});


test('normal claim의 새 30초 탐색과 취소는 멈춘 각 원 fetch도 닫고 늦은 응답을 파싱하거나 후속 조회하지 않는다',async t=>{
 for(const phase of [1,2,3])for(const mode of ['EXPIRE','ABORT']){
  const f=normalClaimSource(),controller=new AbortController();let calls=0,cancelled=0,ready!:()=>void,release!:(r:Response)=>void,owned:AbortSignal|null|undefined;
  const gate=new Promise<void>(r=>{ready=r;}),value=()=>calls===1?f.original:calls===2?f.normal:f.preparation;
  const client=new ApiClient(async(_url,init)=>{calls++;if(calls===phase){owned=init?.signal;ready();return new Promise<Response>(r=>{release=r;});}return Response.json(value());});
  t.mock.timers.enable({apis:['setTimeout']});
  try{
   const result=readNormalClaimRangeHistory(client,projectId,f.sessionRef,f.item,controller.signal,()=>true);await gate;const rejected=assert.rejects(result);
   if(mode==='EXPIRE')t.mock.timers.tick(30000);else controller.abort();await rejected;assert.equal(owned?.aborted,true);assert.equal(calls,phase);
   release(new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(JSON.stringify(value())));},cancel(){cancelled++;}}),{headers:{'content-type':'application/json'}}));
   for(let i=0;i<8;i++)await new Promise<void>(r=>setImmediate(r));assert.equal(cancelled,1);assert.equal(calls,phase);t.mock.timers.tick(30000);assert.equal(calls,phase);
  }finally{controller.abort();t.mock.timers.reset();}
 }
});
