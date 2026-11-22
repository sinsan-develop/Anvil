import assert from 'node:assert/strict';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'vite';
import {ApiClient} from '../../../apps/web/src/api/client.ts';

type UI=typeof import('../../../apps/web/src/features/workspace/NormalUnderstandingDiscovery.tsx');
type Workspace=typeof import('../../../apps/web/src/features/workspace/WorkspaceResponsibleSessions.tsx');
let compiled:Promise<UI>|undefined;
function load(){
 return compiled??=compile();
}
async function compile(hooks?:string):Promise<UI>;
async function compile(hooks:string,entryFile:'WorkspaceResponsibleSessions'):Promise<Workspace>;
async function compile(hooks?:string,entryFile='NormalUnderstandingDiscovery'):Promise<UI|Workspace>{
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
 }`);
type ElementNode={type?:unknown;props?:{children?:unknown;onClick?:()=>void;disabled?:boolean}};
function button(tree:unknown,label:string):ElementNode['props']{
 if(Array.isArray(tree)){for(const item of tree){const found=button(item,label);if(found)return found;}return;}
 if(!tree||typeof tree!=='object')return;
 const node=tree as ElementNode;
 if(node.type==='button'&&node.props?.children===label)return node.props;
 return button(node.props?.children,label);
}

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
  assert.match(markup(),/구간 요청 보관 · 현재 원문 조회 불가/);
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
