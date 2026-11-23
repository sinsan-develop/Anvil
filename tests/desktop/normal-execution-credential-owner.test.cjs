'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const {canonicalJson,contentHash}=require('../../apps/desktop/src/runtime-catalogue-profile.cjs');
// 기존 실제 등록 owner/host-client fixture만 메모리 재사용. 기존 test는 등록/실행하지 않는다.
let fixtures,syntheticResultOwner;
test.before(async()=>{
 const file=require.resolve('./desktop-trust-registration.test.cjs'),m=new Module(file,module),before=[];
 const register=()=>{};register.before=fn=>before.push(fn);const original=Module.createRequire(file);
 m.filename=file;m.paths=module.paths;m.require=name=>name==='node:test'?register:original(name);
 m.withResultOwner=(factory,...args)=>{
  const owner=syntheticResultOwner;
  return m.exports.runtime.createOwnedSpoolController(owner?owner(factory):factory,...args);
 };
 const source=fs.readFileSync(file,'utf8').replace("name==='./native-proof-runtime.cjs'?nativeRuntime:original(name)","name==='./native-proof-runtime.cjs'?Object.freeze({...nativeRuntime,createOwnedSpoolController:module.withResultOwner}):original(name)");
 m._compile(source+'\nmodule.exports={liveNativeOwner,enrollmentFixture,setFiles(io){profileRamFiles=io;},get runtime(){return nativeRuntime;},get other(){return nativeRuntimeOther;}};',file);
 assert.equal(before.length,1);await before[0]();fixtures=m.exports;
});
const id=n=>'ce140001-0000-4000-8000-'+String(n).padStart(12,'0'),ref=n=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
function model(f,mode='NORMAL',profile=null){
 const row=f.stored(),scope={projectId:row.projectId,connectorId:row.registration.connectorRef.id,executionId:id(1),executionGeneration:1,grantRef:ref(2),credentialGeneration:1};
 const config={origin:row.origin,ca:'TEST_ONLY_EXPLICIT_CA',scope},calls=[],spawn=f.ports.spawn;let expiresAt=new Date(f.dependencies.now()+5000).toISOString();
 let metadata,reply,offset=0,onFrame=()=>{},respond,prepareRespond;
 const typedReply=request=>{
  const recordedAt=new Date(f.dependencies.now()).toISOString(),result={transport:'NORMAL_PROTECTED',proofResultRef:ref(20),cacheControl:'no-store',nonceConsumed:true,executionAuthorized:false,dispatchPerformed:false};
  if(request.method==='GET')return {...result,items:[],nextCursor:'cursor1',hasMore:false,observedAt:recordedAt,expiresAt};
  assert.equal(request.path.endsWith('/observations'),true);
  const execution={projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration};
  const snapshot={execution,highestContiguous:1,maxSequence:1,contiguousDigest:'b'.repeat(64),gaps:[],storedCount:1,writerReleaseVerified:false,executionAuthorized:false,dispatchPerformed:false,recordedAt};
  return {...result,ack:{ref:{...ref(21),contentHash:contentHash(canonicalJson(snapshot))},snapshot}};
 };
 const chunk=()=>{const part=reply.subarray(offset,offset+48000),start=offset;offset+=part.length;return{handle:id(7),offset:start,total:reply.length,hash:contentHash(reply),expiresAt,bytes:part.toString('base64url'),done:offset===reply.length};};
 f.ports.spawn=(...args)=>{const child=spawn(...args),write=child.stdin.write;child.stdin.write=(raw,encoding,done)=>{
  const v=JSON.parse(Buffer.from(raw).toString());if(!v.operation.startsWith('NORMAL_EXECUTION_')&&!(profile&&v.operation.startsWith('NORMAL_SPOOL_')))return write(raw,encoding,done);
  assert.ok(Buffer.byteLength(raw)<=65536);assert.equal(v.sequence,calls.filter(x=>x.child===child).length+4);calls.push({...v,child});
  queueMicrotask(()=>{let data;onFrame(v);
   if(profile&&(v.operation.startsWith('NORMAL_SPOOL_')||v.operation.startsWith('NORMAL_EXECUTION_UNDERSTANDING_RANGE_RESULT_')||['NORMAL_EXECUTION_BEGIN','NORMAL_EXECUTION_WRITE','NORMAL_EXECUTION_EXECUTE'].includes(v.operation)))data=profile.handle(v,child,metadata);
   else if(v.operation==='NORMAL_EXECUTION_BOOTSTRAP'){assert.equal(v.payload.attemptId,row.attemptId);assert.deepEqual(v.payload.scope,scope);metadata={slotId:id(3),receiptRef:ref(4),origin:row.origin,scope,expiresAt,caHash:contentHash(config.ca)};data=metadata;}
   else if(v.operation==='NORMAL_EXECUTION_RENEW'){assert.equal(v.payload.attemptId,row.attemptId);assert.deepEqual(v.payload.previous,metadata);assert.ok(Date.parse(metadata.expiresAt)<=f.dependencies.now());expiresAt=new Date(f.dependencies.now()+5000).toISOString();metadata={...metadata,slotId:id(11),receiptRef:ref(12),expiresAt};data=mode==='RENEW_UNKNOWN'?{...metadata,caHash:'b'.repeat(64)}:metadata;}
   else if(v.operation==='NORMAL_EXECUTION_CALL'){assert.equal(v.payload.attemptId,row.attemptId);assert.equal(v.payload.slotId,metadata.slotId);const r=v.payload.request;reply=Buffer.from(canonicalJson(['PREPARE','UNDERSTANDING_RANGE_PREPARE'].includes(v.payload.kind)?(prepareRespond?prepareRespond(r):{path:r.path,query:r.query,auth:r.path.endsWith('/understanding-response-read')?Buffer.from(canonicalJson({fixture:'original read proof'})).toString('base64url'):'A'.repeat(20),challengeRef:ref(5),requestId:id(6),expiresAt}):respond?respond(r,v.payload.body):mode==='PAIR'?typedReply(r):mode==='MAX'?{value:'x'.repeat(2812587-12)}:{commands:[]}));offset=0;data=chunk();}
   else if(v.operation==='NORMAL_EXECUTION_READ'){assert.equal(v.payload.handle,id(7));assert.equal(v.payload.offset,offset);data=chunk();}
   else throw Error('UNEXPECTED_NORMAL_OPERATION');
   child.stdout.emit('data',Buffer.from(canonicalJson({schemaVersion:1,purpose:'DESKTOP_TRUST_KEY_RESULT_V1',requestId:v.requestId,sequence:v.sequence,rootIdentity:mode==='ROOT'?'OTHER_ROOT':'TEST_ONLY_ROOT',data})+'\n'));done();
  });return true;
 };if(mode==='CLOSE'){child.stdin.end=(_a,_b,done)=>{queueMicrotask(()=>{child.stdout.emit('end');child.emit('close',1);done?.();});};}return child;};
 return{config,calls,expiresAt,respond(fn){respond=fn;},prepareRespond(fn){prepareRespond=fn;},onFrame(fn){onFrame=fn;},request:{method:'GET',path:'/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/commands',query:'',body:null,expiresAt}};
}
test('REGISTERED 실제 owner→bundle bootstrap→제한 host client, 매 작업 새 lease/root 검산',async()=>{
 const f=await fixtures.liveNativeOwner(),m=model(f),before=f.calls(),client=f.owner.createNormalCredentialBootstrap(m.config);
 const port=await client.bootstrap(new AbortController().signal);
 assert.equal(f.calls(),before+1);assert.equal(f.owner.isBusy(),false);assert.equal(f.timers(),0);
 assert.equal('credential' in port.metadata,false);assert.equal(typeof port.send,'undefined');assert.equal(typeof port.sign,'undefined');
 const prepared=await port.prepare(m.request,new AbortController().signal);
 assert.deepEqual(await port.request({...m.request,auth:prepared.auth},new AbortController().signal),{commands:[]});
 assert.equal(f.calls(),before+3);assert.equal(f.ends(),f.calls());assert.equal(f.timers(),0);
 assert.equal(m.calls.length,3);assert.equal(f.stored().state,'REGISTERED');
 for(const c of m.calls)assert.ok(c.sequence<=64);
});
test('동일 REGISTERED owner의 명시 갱신은 새 lease와 이전 metadata를 결박한다',async()=>{
 const f=await fixtures.liveNativeOwner(),base=f.dependencies.now();let offset=0;
 f.dependencies.now=()=>base+offset;f.ports.now=()=>base+offset;
 const m=model(f),client=f.owner.createNormalCredentialBootstrap(m.config),signal=new AbortController().signal;
 const old=await client.bootstrap(signal),count=f.calls();
 await assert.rejects(client.renew(old,signal),/NOT_EXPIRED/);assert.equal(f.calls(),count);
 offset=5000;const next=await client.renew(old,signal);
 assert.equal(f.calls(),count+1);assert.notDeepEqual(next.metadata.receiptRef,old.metadata.receiptRef);
 assert.equal(m.calls.at(-1).operation,'NORMAL_EXECUTION_RENEW');assert.equal(f.owner.isBusy(),false);assert.equal(f.timers(),0);
 const n=f.calls();await assert.rejects(client.renew(old,signal),/PREDECESSOR/);assert.equal(f.calls(),n);
});
test('미등록/다른 scope·origin·caller attempt는 host0 거절',async()=>{
 const empty=fixtures.enrollmentFixture();assert.throws(()=>empty.owner.createNormalCredentialBootstrap({}));assert.equal(empty.calls(),0);
 const f=await fixtures.liveNativeOwner(),m=model(f),before=f.calls();
 for(const input of [{...m.config,origin:'https://other.invalid'},{...m.config,scope:{...m.config.scope,projectId:id(9)}},{...m.config,scope:{...m.config.scope,connectorId:id(9)}},{...m.config,attemptId:id(8)}])assert.throws(()=>f.owner.createNormalCredentialBootstrap(input));
 assert.equal(f.calls(),before);
});
for(const mode of ['ROOT','CLOSE','REVOKED','MAPPING','INVALIDATE','ABORT'])test('owner '+mode+'는 성공·자동재발급 없이 닫힌다',async()=>{
 const f=await fixtures.liveNativeOwner(),m=model(f,mode),client=f.owner.createNormalCredentialBootstrap(m.config),abort=new AbortController();
 if(mode==='REVOKED'){const fetch=f.session.fetch;f.session.fetch=async function(...args){const response=await Reflect.apply(fetch,this,args),value=await response.json();value.basis={current:false,reasons:['REVOKED']};return new Response(canonicalJson(value),{headers:{'Content-Type':'application/json'}});};}
 if(mode==='MAPPING')f.stored().key.signerImageHash='f'.repeat(64);
 if(mode==='INVALIDATE')f.owner.invalidate();
 if(mode==='ABORT')abort.abort();
 const before=f.calls();await assert.rejects(client.bootstrap(abort.signal));
 assert.equal(f.owner.isBusy(),false);assert.equal(f.timers(),0);
 const after=f.calls();await assert.rejects(client.bootstrap(new AbortController().signal));assert.equal(f.calls(),after);
 if(['REVOKED','MAPPING','INVALIDATE','ABORT'].includes(mode))assert.equal(m.calls.length,0);
 if(['INVALIDATE','ABORT'].includes(mode))assert.equal(after,before);
});

test('최대 encoded 응답 2812587 bytes는 실제 host 62 frames/64 이내, 임의 URL·메서드0',async()=>{
 const f=await fixtures.liveNativeOwner(),m=model(f,'MAX'),port=await f.owner.createNormalCredentialBootstrap(m.config).bootstrap(new AbortController().signal);
 const result=await port.request({...m.request,auth:'A'.repeat(20)},new AbortController().signal);
 assert.equal(Buffer.byteLength(canonicalJson(result)),2812587);assert.equal(m.calls.length,60);assert.equal(m.calls.at(-1).sequence,62);assert.equal(f.timers(),0);
 const count=f.calls();for(const request of [{...m.request,method:'DELETE'},{...m.request,path:'/api/v1/projects/anything'},{...m.request,path:'https://other.invalid/commands'}])await assert.rejects(port.request({...request,auth:'A'},new AbortController().signal));assert.equal(f.calls(),count);
});
for(const mode of ['ABORT_LATE','DEADLINE','BUSY'])test('owner '+mode+'의 늦은 operation 정리와 다른 교환 보호',async()=>{
 const f=await fixtures.liveNativeOwner(),m=model(f),create=f.dependencies.createOperation;let release,entered=false,closes=0;
 f.dependencies.createOperation=async(...args)=>{const operation=await create(...args);entered=true;await new Promise(resolve=>{release=resolve;});return Object.freeze({...operation,close:async()=>{closes++;return operation.close();}});};
 const a=f.owner.createNormalCredentialBootstrap(m.config),b=f.owner.createNormalCredentialBootstrap(m.config),signal=new AbortController();
 const pending=a.bootstrap(signal.signal);const rejected=mode==='BUSY'?null:assert.rejects(pending);for(let i=0;i<100&&!entered;i++)await Promise.resolve();assert.equal(entered,true);
 if(mode==='BUSY'){await assert.rejects(b.bootstrap(new AbortController().signal));release();assert.ok((await pending).metadata);assert.equal(m.calls.length,1);}
 else{if(mode==='ABORT_LATE')signal.abort();else f.fireDeadline();await rejected;release();for(let i=0;i<100&&closes===0;i++)await Promise.resolve();assert.equal(closes,1);assert.equal(m.calls.length,0);await assert.rejects(a.bootstrap(new AbortController().signal));}
 assert.equal(f.owner.isBusy(),false);assert.equal(f.timers(),0);
});
test('REGISTERED owner가 같은 번들의 보호 GET과 POST를 조립해 준비·전송한다',async()=>{
 const f=await fixtures.liveNativeOwner(),m=model(f,'PAIR'),signal=new AbortController().signal;
 const source=f.owner.createNormalExecutionClients(m.config),pair=await source.bootstrap(signal);
 assert.deepEqual(Object.keys(pair).sort(),['expiresAt','get','post']);assert.equal(pair.expiresAt,m.expiresAt);
 const pagePacket=await pair.get.prepareCommandPage({afterSequence:0,waitMs:0},signal);
 const page=await pair.get.send(pagePacket,signal);assert.deepEqual(page.items,[]);assert.equal(page.nextCursor,'cursor1');
 const s=m.config.scope,scope={projectId:s.projectId,executionId:s.executionId,executionGeneration:s.executionGeneration};
 const events=[{...scope,sequence:1,eventId:id(30),type:'RECEIVED',commandId:id(31),envelopeHash:'b'.repeat(64),localRecordRef:ref(32),processRef:null,occurredAt:new Date(f.dependencies.now()).toISOString(),reasonCode:'NONE'}];
 const batch={events,batchHash:contentHash(canonicalJson(events))};
 const observationPacket=await pair.post.prepareObservations(batch,signal),result=await pair.post.send(observationPacket,signal);
 assert.equal(result.ack.snapshot.highestContiguous,1);assert.equal(result.executionAuthorized,false);
 assert.deepEqual(m.calls.map(c=>c.operation==='NORMAL_EXECUTION_BOOTSTRAP'?'BOOTSTRAP':[c.payload.kind,c.payload.request.method]),['BOOTSTRAP',['PREPARE','GET'],['REQUEST','GET'],['PREPARE','POST'],['REQUEST','POST']]);
 assert.equal(m.calls.at(-1).payload.body,canonicalJson(batch));assert.equal(f.owner.isBusy(),false);assert.equal(f.timers(),0);
});
test('명시 갱신은 같은 owner의 직전 쌍만 받고 구쌍·dispose 뒤 두 클라이언트의 host 전송은 0이다',async()=>{
 const f=await fixtures.liveNativeOwner(),base=f.dependencies.now();let offset=0;
 f.dependencies.now=()=>base+offset;f.ports.now=()=>base+offset;
 const m=model(f,'PAIR'),source=f.owner.createNormalExecutionClients(m.config),signal=new AbortController().signal;
 const pair=await source.bootstrap(signal),input={afterSequence:0,waitMs:0},events=[{sequence:1}],batch={events,batchHash:contentHash(canonicalJson(events))};
 const getPacket=await pair.get.prepareCommandPage(input,signal),postPacket=await pair.post.prepareObservations(batch,signal);
 const foreign=f.owner.createNormalExecutionClients(m.config),before=f.calls();
 await assert.rejects(source.renew({...pair},signal),/PREDECESSOR/);await assert.rejects(foreign.renew(pair,signal),/PREDECESSOR/);
 await assert.rejects(source.renew(pair,signal),/NOT_EXPIRED/);assert.equal(f.calls(),before);
 offset=5000;const next=await source.renew(pair,signal);assert.equal(f.calls(),before+1);assert.notEqual(next.expiresAt,pair.expiresAt);
 assert.equal(m.calls.at(-1).operation,'NORMAL_EXECUTION_RENEW');
 const after=f.calls();await assert.rejects(source.renew(pair,signal),/PREDECESSOR/);
 await assert.rejects(pair.get.send(getPacket,signal));await assert.rejects(pair.post.send(postPacket,signal));assert.equal(f.calls(),after);
 const nextGet=await next.get.prepareCommandPage(input,signal),nextPost=await next.post.prepareObservations(batch,signal);
 const final=f.calls(),frames=m.calls.length;source.dispose();source.dispose();
 await assert.rejects(next.get.send(nextGet,signal));await assert.rejects(next.post.send(nextPost,signal));
 await assert.rejects(next.get.prepareCommandPage(input,signal));await assert.rejects(next.post.prepareObservations(batch,signal));
 await assert.rejects(source.renew(next,signal));assert.equal(f.calls(),final);assert.equal(m.calls.length,frames);
 assert.equal(f.timers(),0);assert.equal(f.owner.isBusy(),false);foreign.dispose();
});
test('갱신 요청 전 거절 뒤 유효한 원 쌍으로 GET을 보낼 수 있다',async()=>{
 const f=await fixtures.liveNativeOwner(),m=model(f,'PAIR'),signal=new AbortController().signal,source=f.owner.createNormalExecutionClients(m.config);
 const pair=await source.bootstrap(signal),packet=await pair.get.prepareCommandPage({afterSequence:0,waitMs:0},signal),before=m.calls.length;
 await assert.rejects(source.renew(pair,signal),/NOT_EXPIRED/);assert.equal(m.calls.length,before);
 assert.equal((await pair.get.send(packet,signal)).nextCursor,'cursor1');assert.equal(m.calls.length,before+1);
 source.dispose();assert.equal(f.timers(),0);
});
test('갱신 전송 후 반환 CA 불일치는 불명을 유지하고 추가 host 요청을 차단한다',async()=>{
 const f=await fixtures.liveNativeOwner(),base=f.dependencies.now();let offset=0;
 f.dependencies.now=()=>base+offset;f.ports.now=()=>base+offset;
 const m=model(f,'RENEW_UNKNOWN'),source=f.owner.createNormalExecutionClients(m.config),signal=new AbortController().signal;
 const pair=await source.bootstrap(signal),packet=await pair.get.prepareCommandPage({afterSequence:0,waitMs:0},signal);
 offset=5000;await assert.rejects(source.renew(pair,signal),/NORMAL_OWNED_UNKNOWN/);
 const after=m.calls.length,hosts=f.calls();assert.equal(m.calls.filter(c=>c.operation==='NORMAL_EXECUTION_RENEW').length,1);
 await assert.rejects(source.renew(pair,signal),/NORMAL_OWNED_UNKNOWN/);await assert.rejects(pair.get.send(packet,signal));
 assert.equal(m.calls.length,after);assert.equal(f.calls(),hosts);assert.equal(f.timers(),0);assert.equal(f.owner.isBusy(),false);source.dispose();
});
test('bundle factory는 다른 grant·CA·세대·기한·번들·caller credential을 효과 전에 거절한다',async()=>{
 const f=await fixtures.liveNativeOwner(),m=model(f,'PAIR'),signal=new AbortController().signal;
 const port=await f.owner.createNormalCredentialBootstrap(m.config).bootstrap(signal),options={...m.config,credentialExpiresAt:port.metadata.expiresAt},runtime=fixtures.runtime;
 const before=f.calls(),clock=()=>f.dependencies.now(),scope=options.scope;
 for(const bad of [{...options,credential:'caller'},{...options,signer:{}},{...options,ca:'DIFFERENT'},{...options,origin:'https://other.invalid'},
  {...options,credentialExpiresAt:new Date(Date.parse(options.credentialExpiresAt)+1).toISOString()},{...options,scope:{...scope,executionId:id(33)}},
  {...options,scope:{...scope,executionGeneration:2}},{...options,scope:{...scope,credentialGeneration:2}},
  {...options,scope:{...scope,grantRef:{...scope.grantRef,contentHash:'b'.repeat(64)}}}]){
  assert.throws(()=>runtime.createNormalProtectedClientPair(bad,port,clock));
 }
 assert.throws(()=>fixtures.other.createNormalProtectedClientPair(options,port,clock));assert.throws(()=>runtime.createNormalProtectedClientPair(options,{matches:()=>true},clock));
 assert.equal(f.calls(),before);for(const key of ['NormalOwnedCredentialPort','NormalProtectedGetClient','NormalProtectedPostClient'])assert(!Object.hasOwn(runtime,key));
});
test('owner invalidate 뒤 준비된 GET·POST를 사용해도 host 요청이 추가되지 않는다',async()=>{
 const f=await fixtures.liveNativeOwner(),m=model(f,'PAIR'),signal=new AbortController().signal,source=f.owner.createNormalExecutionClients(m.config);
 const pair=await source.bootstrap(signal),g=await pair.get.prepareCommandPage({afterSequence:0,waitMs:0},signal),events=[{sequence:1}];
 const p=await pair.post.prepareObservations({events,batchHash:contentHash(canonicalJson(events))},signal),count=f.calls();
 f.owner.invalidate();await assert.rejects(pair.get.send(g,signal));await assert.rejects(pair.post.send(p,signal));assert.equal(f.calls(),count);source.dispose();
});
test('이미 발송한 GET 도중 dispose는 늦은 응답을 성공으로 바꾸지 않는다',async()=>{
 const f=await fixtures.liveNativeOwner(),m=model(f,'PAIR'),signal=new AbortController().signal,source=f.owner.createNormalExecutionClients(m.config);
 const pair=await source.bootstrap(signal),packet=await pair.get.prepareCommandPage({afterSequence:0,waitMs:0},signal);
 m.onFrame(v=>{if(v.payload.kind==='REQUEST')source.dispose();});
 const count=f.calls();await assert.rejects(pair.get.send(packet,signal),error=>error.outcomeUnknown===true);
 assert.equal(f.calls(),count+1);await assert.rejects(pair.get.send(packet,signal));assert.equal(f.calls(),count+1);
 assert.equal(f.owner.isBusy(),false);assert.equal(f.timers(),0);
});

for(const mode of ['READ_SEND_OK','READ_SEND_CHUNK','READ_SEND_MISSING','READ_SEND_CLOSE_UNKNOWN','READ_SEND_EXPIRE_CLOSE','READ_SEND_BAD_PROOF','READ_OK','READ_REPEAT','READ_FORGED','READ_BAD_HASH','READ_BAD_REF','READ_METADATA','READ_UNKNOWN','READ_NONORDINARY','READ_CLOSE_UNKNOWN','READ_DEADLINE','READ_PRE_BODY','READ_REVOKED','OK','REPLAY_TIME','EXACT_BYTES','NONE','DENIED','EXPIRED','GET_DENIED','NO_SDK','NO_ORIGIN','START','BUNDLE','BUNDLE_HASH','SESSION','SESSION_HASH','SOURCE_CHANGED_BEFORE','SOURCE_CHANGED_CLOSE','SCOPE','REGISTRATION','ASSIGNMENT','PACKET','CREDENTIAL','RANGE_REF','SOURCE_REF','SEQUENCE','INIT_ALIAS','TAIL_ALIAS','BLOCKS','TOTAL_BYTES','EXTRA','DISCOVERY','CANCELLED','CLOSE_UNKNOWN','EXPIRED_CLOSE','REVOKED'])test('FN09 등록 실행기의 명시 고정 범위 획득·원 close 및 읽기0 '+mode,async()=>{
 const sendMode=mode.startsWith('READ_SEND_'),rangeText=mode==='READ_SEND_CHUNK'?'가'.repeat(25000):'선택된 이해 근거';
 const q=await outputProfile(),x=await pollingFixture(q.profile,true,true,sendMode&&mode!=='READ_SEND_MISSING'?{mode:'NORMAL_PROTECTED',purpose:'FN09_FIXED_RANGE_SELECTION'}:undefined),{wire:unused,...input}=x.input;
 q.bind(x);
 input.timeoutMs=2000;
 // 기존 DISCOVERY와 같은 원 worker/FIRST/init 경로다. SDK/파일/프로세스는 모두 기존 RAM fixture다.
 let sdkMessages=0;
 const sdk={expiresAt:x.clock()+4000,check:scope=>({scopeDigest:contentHash(canonicalJson(scope)),expiresAt:x.clock()+4000}),classify:()=> 'ORDINARY',close:async()=>{},
  async create(request,prompt){await prompt[Symbol.asyncIterator]().next();const sid=request.plannedSid;return{[Symbol.asyncIterator](){return{async next(){
   const i=sdkMessages++;if(i===0)return{done:false,value:{type:'system',subtype:'init',uuid:'init',session_id:sid,apiKeySource:'none',claude_code_version:'2.1.224',cwd:'fixture',tools:[],mcp_servers:[],model:'fixture',permissionMode:'default',slash_commands:[],output_style:'fixture',skills:[],plugins:[]}};
   if(i===1)return{done:false,value:{type:'assistant',uuid:'answer',session_id:sid,parent_tool_use_id:null,message:{content:[{type:'text',text:rangeText}]}}};
   return{done:true,value:undefined};
  }}}};}};
 const worker=x.source.createWorkerStartPolling(x.pair,input,mode==='NO_SDK'?undefined:sdk),signal=new AbortController(),scope=x.m.config.scope;
 if(!['NO_SDK','NO_ORIGIN'].includes(mode)){
  assert.equal((await worker.run(x.signal)).state,'LIMIT_REACHED');
  for(let i=0;i<50&&(q.state.holds.size||sdkMessages<3);i++)await new Promise(r=>setImmediate(r));
  assert.ok(sdkMessages>=3);assert.equal(q.state.holds.size,0);
 }
 const before=x.m.calls.length,stamp=new Date(x.clock()).toISOString(),end=new Date(x.clock()+3000).toISOString();
 assert.equal(x.m.calls.length,before);assert.equal(typeof worker.acquireUnderstandingRange,'function');
 if(mode==='OK'){const ordinary=x.source.createStartPolling(x.pair,x.input);await assert.rejects(ordinary.acquireUnderstandingRange(signal.signal));assert.equal(x.m.calls.length,before);}
 const path='/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/understanding-response-read/range',hash=v=>contentHash(canonicalJson(v));
 const target={method:'GET',path,queryHash:hash({}),bodyHash:hash(null)},frame={schemaVersion:1,challengeRef:ref(5),proof:{...target,requestId:id(6),grantRef:scope.grantRef,credentialGeneration:scope.credentialGeneration,serverNonce:Buffer.alloc(32,1).toString('base64url')},signature:Buffer.alloc(64,2).toString('base64url')};
 const context={...scope,registrationRef:x.f.stored().registration.registrationRef,startCommandId:id(56),startCommandRef:ref(785),assignmentRef:ref(40),preparationRef:ref(784),contextBundleRef:ref(50),sessionBindingRef:ref(92)};
 const selection={requestRef:ref(777),resultRef:ref(778),initConfirmationRef:ref(779),tailRef:ref(781),firstSequence:3,lastSequence:3,ranges:[{outputRef:ref(780),sequence:3,payloadDigest:'d'.repeat(64),textBlocks:1,textBytes:20}]};
 let rangeRows;
 if(mode.startsWith('READ_')){
  const files=[...q.local.files].filter(([p])=>require('node:path').basename(p).startsWith('sdk-session-output.')&&p.endsWith('.json')).sort(([a],[b])=>a.localeCompare(b));
  rangeRows=files.map(([,f])=>JSON.parse(f.bytes));assert.equal(rangeRows.length,3);
  const row=rangeRows[2];
  if(mode==='READ_NONORDINARY'){row.snapshot.classification='QUARANTINED';row.ref.contentHash=hash(row.snapshot);files[2][1].bytes=Buffer.from(canonicalJson(row)+'\n');}
  selection.initConfirmationRef=rangeRows[1].ref;selection.tailRef=row.ref;selection.ranges=[{outputRef:row.ref,sequence:3,payloadDigest:row.snapshot.payloadDigest,textBlocks:1,textBytes:Buffer.byteLength(rangeText)}];
 }

 if(mode==='SCOPE')context.executionGeneration++;if(mode==='REGISTRATION')context.registrationRef=ref(790);if(mode==='ASSIGNMENT')context.assignmentRef=ref(790);
 if(mode==='START')context.startCommandId=id(790);if(mode==='BUNDLE')context.contextBundleRef=ref(790);if(mode==='SESSION')context.sessionBindingRef=ref(790);
 if(mode==='BUNDLE_HASH')context.contextBundleRef.contentHash='e'.repeat(64);if(mode==='SESSION_HASH')context.sessionBindingRef.contentHash='e'.repeat(64);
 if(mode==='SOURCE_REF')selection.resultRef.version=2;if(mode==='SEQUENCE')selection.ranges[0].sequence++;
 if(mode==='INIT_ALIAS')selection.ranges[0].outputRef=selection.initConfirmationRef;if(mode==='TAIL_ALIAS')selection.ranges[0].outputRef={...selection.tailRef,contentHash:'e'.repeat(64)};
 if(mode==='BLOCKS')selection.ranges[0].textBlocks=201;
 if(mode==='EXACT_BYTES')selection.ranges[0].textBytes=2097152;
 if(mode==='TOTAL_BYTES'){selection.lastSequence=4;selection.ranges[0].textBytes=1048576;selection.ranges.push({...selection.ranges[0],outputRef:ref(782),sequence:4,textBytes:1048577});}
 let terminal=['NONE','DENIED','EXPIRED','GET_DENIED'].includes(mode),closes=0;
 const outcome=(status,stage)=>({kind:'NORMAL_UNDERSTANDING_RANGE_NOT_ACQUIRED',status,stage,path,query:'',requestId:id(6),slotRef:ref(4),expiresAt:end});
 x.m.prepareRespond(r=>{assert.equal(r.path,path);return terminal&&mode!=='GET_DENIED'?outcome(mode,'PREPARE'):{path,query:'',auth:Buffer.from(canonicalJson(frame)).toString('base64url'),challengeRef:frame.challengeRef,requestId:id(6),expiresAt:end};});
 let exact;
 x.m.respond(r=>{
  assert.equal(r.path,path);assert.equal(r.method,'GET');assert.equal(r.query,'');assert.equal(r.body,null);
  if(terminal&&mode==='GET_DENIED')return outcome('DENIED','REQUEST');
  const receipt={kind:'NORMAL_UNDERSTANDING_RANGE_ACQUIRED',binding:{...scope,transport:'NORMAL_PROTECTED',mode:'EXECUTION',scopeDigest:'b'.repeat(64),publicKeyFingerprint:'c'.repeat(64)},credentialRef:mode==='CREDENTIAL'?ref(799):ref(4),challengeRef:frame.challengeRef,packetHash:mode==='PACKET'?'f'.repeat(64):hash({frame,target}),target,requestId:id(6),rangeRequestRef:{...ref(787),version:mode==='RANGE_REF'?2:1},context,selection,observedAt:stamp,expiresAt:end};
  exact={transport:'NORMAL_PROTECTED',status:mode==='DISCOVERY'?'DISCOVERY_ACQUIRED':'RANGE_ACQUIRED',proofResultRef:{...ref(788),contentHash:hash(receipt)},receipt,sourceAvailable:false,selectionAvailable:false,cacheControl:'no-store',nonceConsumed:true,executionAuthorized:false,dispatchPerformed:false};
  if(mode==='EXTRA')exact.text='허용하지 않은 원문';return exact;
 });
 const children=new Set(),concurrent=[];
 x.m.onFrame(v=>{
  const child=x.m.calls.at(-1).child;
  if(mode==='READ_PRE_BODY'&&v.operation==='NORMAL_SPOOL_PROFILE_STATE')x.advance(3500);
  if(!children.has(child)){children.add(child);child.once('close',()=>{closes++;if(mode==='EXPIRED_CLOSE')x.advance(5000);if(mode==='SOURCE_CHANGED_CLOSE')sdk.expiresAt++;});}
  if(v.payload.kind==='UNDERSTANDING_RANGE_PREPARE'){
   concurrent.push(assert.rejects(worker.acquireUnderstandingRange(signal.signal)),assert.rejects(worker.run(signal.signal)),assert.rejects(worker.renew(signal.signal)));
   if(mode==='CLOSE_UNKNOWN')child.stdin.end=(_a,_b,done)=>{queueMicrotask(()=>{child.stdout.emit('end');child.emit('close',1);done?.();});};
  }
 });
 if(mode==='REPLAY_TIME')x.advance(10);if(mode==='CANCELLED')signal.abort();if(mode==='REVOKED')x.f.owner.invalidate();
 if(mode==='SOURCE_CHANGED_BEFORE')sdk.expiresAt++;
 const files=canonicalJson([...q.local.files].map(([p,f])=>[p,f.bytes.toString('base64')]));
 if(mode.startsWith('READ_')||['OK','REPLAY_TIME','EXACT_BYTES','NONE','DENIED','EXPIRED','GET_DENIED'].includes(mode)){
  if(terminal){assert.deepEqual(await worker.acquireUnderstandingRange(signal.signal),{kind:'NOT_ACQUIRED',status:mode==='GET_DENIED'?'DENIED':mode});terminal=false;}
  const result=await worker.acquireUnderstandingRange(signal.signal);assert.equal(result.kind,'RANGE_ACQUIRED');
  assert.deepEqual(result.rangeRequestRef,exact.receipt.rangeRequestRef);assert.deepEqual(result.selection,selection);assert.notDeepEqual(result.rangeRequestRef,selection.requestRef);
  assert.equal(Object.isFrozen(result),true);assert.equal(Object.isFrozen(result.selection.ranges[0]),true);assert.equal(closes,children.size);
  assert.equal(result.sourceAvailable,false);assert.equal(result.executionAuthorized,false);assert.equal('ticket'in result,false);assert.equal(/"text"|plannedSid|session_id|private|bodyHash/.test(JSON.stringify(result)),false);
  await assert.rejects(x.pair.get.send(result,signal.signal));await assert.rejects(x.pair.post.send(result,signal.signal));
  if(mode.startsWith('READ_')){
   assert.equal(typeof worker.readUnderstandingRange,'function');
   const projection={schemaVersion:1,kind:'FIXED_RANGE_SELECTION',attribution:'SESSION_ONLY',projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration,requestRef:result.rangeRequestRef,acquisitionRef:result.acquisitionRef,sourceRequestRef:selection.requestRef,sourceResultRef:selection.resultRef,contextBundleRef:context.contextBundleRef,initConfirmationRef:selection.initConfirmationRef,tailRef:selection.tailRef,firstSequence:3,lastSequence:3,beforeRef:rangeRows[1].ref,afterRef:null,parts:[{outputRef:rangeRows[2].ref,sequence:3,payloadDigest:rangeRows[2].snapshot.payloadDigest,blockIndex:0,kind:'ASSISTANT_TEXT',text:rangeText,textHash:contentHash(rangeText)}],wholeConversationComplete:false,executionAuthorized:false};
   const expectedBody=canonicalJson(projection),expectedHash=hash(projection),handle=q.profile.handle,steps=[];let nativeReads=0,prepareCount=0,sendCount=0,parentChild,physicalClosed=false,upload=[],uploadOffset=0;
   const sendProof={...frame,proof:{...frame.proof,method:'POST',path:path.replace(/\/range$/,'/'+result.rangeRequestRef.id+'/result'),bodyHash:expectedHash}};
   const auth=Buffer.from(canonicalJson(sendProof)).toString('base64url');
   const consume=bytes=>{assert.equal(physicalClosed,true);assert.equal(bytes.toString(),expectedBody);assert.equal(contentHash(bytes),expectedHash);steps.push('send');sendCount++;return {state:'TEST_ONLY_TRANSPORT_UNCONFIRMED'};};
   q.profile.handle=(v,...args)=>{
    if(v.operation==='NORMAL_EXECUTION_UNDERSTANDING_RANGE_RESULT_PREPARE'){
     assert.equal(args[0],parentChild);assert.equal(physicalClosed,false);steps.push('prepare');prepareCount++;
     assert.deepEqual(v.payload,{attemptId:x.f.stored().attemptId,slotId:id(3),requestRef:result.rangeRequestRef,acquisitionRef:result.acquisitionRef,bodyHash:expectedHash});
     const bad=mode==='READ_SEND_BAD_PROOF'?Buffer.from(canonicalJson({...sendProof,proof:{...sendProof.proof,bodyHash:'f'.repeat(64)}})).toString('base64url'):auth;
     return {state:'NATIVE_RANGE_RESULT_PREPARED',requestRef:result.rangeRequestRef,acquisitionRef:result.acquisitionRef,preparedHash:'b'.repeat(64),auth:bad,expiresAt:end};
    }
    if(v.operation==='NORMAL_EXECUTION_UNDERSTANDING_RANGE_RESULT_SEND'){assert.notEqual(args[0],parentChild);return consume(Buffer.from(v.payload.body));}
    if(v.operation==='NORMAL_EXECUTION_BEGIN'){assert.equal(v.payload.kind,'UNDERSTANDING_RANGE_RESULT_SEND');assert.equal(v.payload.bodyHash,expectedHash);assert.notEqual(args[0],parentChild);return {handle:id(810)};}
    if(v.operation==='NORMAL_EXECUTION_WRITE'){assert.equal(v.payload.handle,id(810));assert.equal(v.payload.offset,uploadOffset);const b=Buffer.from(v.payload.bytes,'base64url');upload.push(b);uploadOffset+=b.length;return {handle:id(810),offset:uploadOffset};}
    if(v.operation==='NORMAL_EXECUTION_EXECUTE'){assert.equal(v.payload.handle,id(810));return consume(Buffer.concat(upload));}

    if(v.operation==='NORMAL_SPOOL_CLOSE'&&v.payload.understandingRange){
     nativeReads++;parentChild=args[0];steps.push('native-close');parentChild.once('close',()=>{physicalClosed=true;steps.push('physical-close');if(mode==='READ_SEND_EXPIRE_CLOSE')x.advance(5000);});const received=v.payload.understandingRange;
     assert.deepEqual(received,{requestRef:result.rangeRequestRef,acquisitionRef:result.acquisitionRef,selection,bodyHash:expectedHash});
     if(mode==='READ_UNKNOWN')return {state:'UNKNOWN'};
     const child=args[0];
     if(mode==='READ_CLOSE_UNKNOWN'||mode==='READ_SEND_CLOSE_UNKNOWN')child.stdin.end=(_a,_b,done)=>{queueMicrotask(()=>{child.stdout.emit('end');child.emit('close',1);done?.();});};
     if(mode==='READ_DEADLINE')child.once('close',()=>x.advance(5000));
     if(mode==='READ_REVOKED')x.f.owner.invalidate();
     return {state:'CLOSED_CONFIRMED',understandingRange:{state:mode==='READ_METADATA'?'NATIVE_METADATA_CLOSED':'NATIVE_RANGE_CLOSED',requestRef:result.rangeRequestRef,acquisitionRef:mode==='READ_BAD_REF'?ref(899):result.acquisitionRef,bodyHash:mode==='READ_BAD_HASH'?'f'.repeat(64):expectedHash}};
    }return handle(v,...args);
   };
   const beforeRead=x.m.calls.length,read=()=>sendMode?worker.transmitUnderstandingRange(result,signal.signal):worker.readUnderstandingRange(mode==='READ_FORGED'?structuredClone(result):result,signal.signal);
   if(sendMode&&['READ_SEND_OK','READ_SEND_CHUNK','READ_SEND_MISSING'].includes(mode)){
    const selected=await read();assert.deepEqual(selected,{state:mode==='READ_SEND_MISSING'?'SIGNING_UNAVAILABLE':'TRANSMISSION_UNCONFIRMED',requestRef:result.rangeRequestRef,acquisitionRef:result.acquisitionRef,bodyHash:expectedHash,executionAuthorized:false,dispatchPerformed:false});
    assert.equal(JSON.stringify(selected).includes(rangeText),false);assert.equal(nativeReads,1);
    assert.equal(prepareCount,mode==='READ_SEND_MISSING'?0:1);assert.equal(sendCount,mode==='READ_SEND_MISSING'?0:1);
    if(sendCount)assert.deepEqual(steps.slice(0,4),['native-close','prepare','physical-close','send']);
   }else if(['READ_OK','READ_REPEAT'].includes(mode)){const selected=await read();assert.deepEqual(selected,{kind:'RANGE_READ_VERIFIED',requestRef:result.rangeRequestRef,acquisitionRef:result.acquisitionRef,bodyHash:expectedHash,executionAuthorized:false,dispatchPerformed:false});assert.equal('projection'in selected,false);assert.equal(JSON.stringify(selected).includes('선택된 이해 근거'),false);assert.equal(nativeReads,1);assert.equal(/session_id|plannedSid|cwd|subjectBindingRef|basisRefs/.test(JSON.stringify(selected)),false);}
   else {await assert.rejects(read);if(sendMode)assert.equal(sendCount,0);}
   if(mode==='READ_FORGED')assert.equal(x.m.calls.length,beforeRead);
   if(mode==='READ_PRE_BODY')assert.equal(x.m.calls.slice(beforeRead).some(v=>v.operation==='NORMAL_SPOOL_RESUME'||v.operation==='NORMAL_SPOOL_CLOSE'),false);
   const count=x.m.calls.length;await assert.rejects(read);assert.equal(x.m.calls.length,count);
  }

 }else{
  await assert.rejects(worker.acquireUnderstandingRange(signal.signal));const n=x.m.calls.length;
  await assert.rejects(worker.acquireUnderstandingRange(signal.signal));assert.equal(x.m.calls.length,n);
 }
 await Promise.all(concurrent);
 const calls=x.m.calls.slice(before);assert.ok(calls.every(v=>v.operation==='NORMAL_EXECUTION_READ'||mode.startsWith('READ_')&&['NORMAL_SPOOL_PROFILE_STATE','NORMAL_SPOOL_RESUME','NORMAL_SPOOL_CLOSE'].includes(v.operation)||sendMode&&['NORMAL_EXECUTION_UNDERSTANDING_RANGE_RESULT_PREPARE','NORMAL_EXECUTION_UNDERSTANDING_RANGE_RESULT_SEND','NORMAL_EXECUTION_BEGIN','NORMAL_EXECUTION_WRITE','NORMAL_EXECUTION_EXECUTE'].includes(v.operation)||v.operation==='NORMAL_EXECUTION_CALL'&&['UNDERSTANDING_RANGE_PREPARE','UNDERSTANDING_RANGE_REQUEST'].includes(v.payload.kind)));
 if(['NO_SDK','NO_ORIGIN','SOURCE_CHANGED_BEFORE'].includes(mode))assert.equal(calls.length,0);
 assert.equal(calls.filter(v=>(!mode.startsWith('READ_')&&v.operation.startsWith('NORMAL_SPOOL_'))||['NORMAL_SPOOL_RESERVE','NORMAL_SPOOL_SETTLE'].includes(v.operation)||v.payload.request?.method==='POST'||v.operation.includes('UNDERSTANDING_RESULT')).length,0);
 assert.equal(canonicalJson([...q.local.files].map(([p,f])=>[p,f.bytes.toString('base64')])),files);
});

async function pollingFixture(profile=null,workerOptions=false,mixed=false,resultConfiguration=undefined){
 const f=await fixtures.liveNativeOwner(),base=f.dependencies.now();let offset=0;
 f.dependencies.now=()=>base+offset;f.ports.now=()=>base+offset;
 const m=model(f,'PAIR',profile),scope=m.config.scope,clock=f.dependencies.now,signal=new AbortController().signal;
 const {root,memoryFiles}=await import('../unit/FN08/normal-start-local-fixture.ts');
 const {NormalStartFileStore}=await import('../../apps/connector/runtime/normal-start-file-store.ts');
 const local={projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration};
 const memory=memoryFiles(),store=new NormalStartFileStore(root,local,memory.fs);
 const expected={context:{...local,assignmentId:id(40),connectionRef:f.stored().registration.connectorRef,environmentRef:ref(42),authorizationReceiptRef:ref(43),capabilityRef:ref(44),budgetRef:ref(45),sourceScopes:[{sourceRootRef:ref(46),mappingRef:null,observationRef:ref(47),baselineRef:ref(48),targets:[{relativePath:'sample.txt',kind:'FILE',access:'READ',recursive:false}]}]},executorRegistrationRef:f.stored().registration.registrationRef};
 const bodies=['{"context":1}',workerOptions?'{"claudeQueryParams":{"model":"ram-model"}}':'{"options":1}'],hash=x=>contentHash(canonicalJson(x));
 const groups=bodies.map((body,i)=>({kind:i?'START_OPTIONS':'CONTEXT_BUNDLE',payloadRef:ref(50+i),sourceRef:ref(52+i),sourceBytes:Buffer.byteLength(body),contentHash:contentHash(body),mediaType:'application/json',parts:[{materialId:id(54+i),partIndex:1,byteOffset:0,utf8Bytes:Buffer.byteLength(body),contentHash:contentHash(body)}]}));
 const issuedAt=new Date(clock()).toISOString(),unsigned={schemaVersion:1,commandId:id(56),issuedAt,expiresAt:new Date(clock()+30000).toISOString(),...expected,operation:'START_SESSION',payload:{contextBundleRef:groups[0].payloadRef,optionsRef:groups[1].payloadRef}};
 const envelope={...unsigned,envelopeHash:hash(unsigned)},item={sequence:1,commandRef:ref(57),envelope,materials:{manifestRef:ref(58),groups}};
 const instruction='보호 출력 시험 입력',partsRef=ref(94),instructionRef=ref(95),bodyHash=contentHash(instruction);
 const sendBase={...unsigned,commandId:id(90),operation:'SEND_INSTRUCTION',payload:{sessionBindingRef:ref(92),partsRef,instructionRef}};
 const send={...sendBase,envelopeHash:hash(sendBase)};
 const extra={kind:'INSTRUCTION',payloadRef:partsRef,sourceRef:instructionRef,sourceBytes:Buffer.byteLength(instruction),contentHash:bodyHash,
  mediaType:'text/plain;charset=utf-8',parts:[{materialId:id(97),partIndex:1,byteOffset:0,utf8Bytes:Buffer.byteLength(instruction),contentHash:bodyHash}]};
 const items=mixed?[item,{sequence:2,commandRef:ref(98),envelope:send,materials:{manifestRef:ref(99),groups:[extra]}}]:[item];
 const nextText='다음 명령 🙂',nextBase={...sendBase,commandId:id(130),payload:{sessionBindingRef:send.payload.sessionBindingRef,partsRef:ref(131),instructionRef:ref(132)}};
 const nextEnvelope={...nextBase,envelopeHash:hash(nextBase)},nextHash=contentHash(nextText),nextBytes=Buffer.byteLength(nextText);
 const nextGroup={...extra,payloadRef:ref(131),sourceRef:ref(132),sourceBytes:nextBytes,contentHash:nextHash,
  parts:[{materialId:id(133),partIndex:1,byteOffset:0,utf8Bytes:nextBytes,contentHash:nextHash}]};
 if(mixed==='FOLLOW')items.push({sequence:3,commandRef:ref(134),envelope:nextEnvelope,materials:{manifestRef:ref(135),groups:[nextGroup]}});
 const seen={permits:0,wires:0,events:[],loseAck:false};
 m.respond((r,body)=>{
  const result={transport:'NORMAL_PROTECTED',proofResultRef:ref(59),cacheControl:'no-store',nonceConsumed:true,executionAuthorized:false,dispatchPerformed:false};
  const observedAt=new Date(clock()).toISOString(),expiresAt=new Date(clock()+5000).toISOString();
  if(r.path.endsWith('/commands'))return {...result,items:seen.startOnly?[item]:items,nextCursor:'cursor1',hasMore:false,observedAt,expiresAt};
  const all=mixed==='FOLLOW'?[...groups,extra,nextGroup]:mixed?[...groups,extra]:groups,i=all.findIndex(g=>r.path.endsWith('/materials/'+g.parts[0].materialId));
  if(i>=0){const g=all[i],p=g.parts[0];return {...result,observedAt,expiresAt,material:{materialId:p.materialId,sourceRef:g.sourceRef,partIndex:1,partCount:1,contentHash:p.contentHash,bytes:Buffer.from(i===3?nextText:i===2?instruction:bodies[i]).toString('base64url')}};}
  if(r.path.endsWith('/permit')){const cmd=mixed==='FOLLOW'&&r.path.includes(nextEnvelope.commandId)?nextEnvelope:mixed&&r.path.includes(send.commandId)?send:envelope;seen.permits++;return {...result,...(seen.largePermit?{padding:'x'.repeat(2700000)}:{}),executionAuthorized:true,permit:{ref:ref(cmd===nextEnvelope?136:cmd===send?96:60),commandId:cmd.commandId,envelopeHash:cmd.envelopeHash,issuedAt:observedAt,expiresAt}};}
  assert.ok(r.path.endsWith('/observations'));const batch=JSON.parse(body).events,events=mixed?[...seen.events,...batch]:batch;seen.events=events;
  const snapshot={execution:local,highestContiguous:events.length,maxSequence:events.length,contiguousDigest:events.reduce((previous,e)=>hash({previous,eventHash:hash(e)}),hash([])),gaps:[],storedCount:events.length,writerReleaseVerified:false,executionAuthorized:false,dispatchPerformed:false,recordedAt:observedAt};
  return {...result,ack:seen.loseAck?null:{ref:{...ref(61),version:mixed?events.length:1,contentHash:hash(snapshot)},snapshot}};
 });
 const current={transport:'NORMAL_PROTECTED',async current(e,attempt){return {transport:'NORMAL_PROTECTED',key:{...local,commandId:e.commandId},envelopeHash:e.envelopeHash,grantRef:scope.grantRef,localAttemptRef:attempt,sourceObservationRefs:[ref(47)],osOwnershipRef:ref(62),checkedAt:new Date(clock()).toISOString(),expiresAt:new Date(clock()+5000).toISOString()};}};
 const wire={transport:'NORMAL_PROTECTED',async send(value){seen.wires++;assert.equal(Buffer.from(value.options.bytes).toString(),bodies[1]);return {transport:'NORMAL_PROTECTED',responseRef:ref(63),processRef:null};}};
 const input={expected,intakeStore:store.intake(),journalStore:store,current,wire,timeoutMs:1000,deadline:clock()+30000,maxPages:1,idleMs:1};
 const source=profile?f.owner.createProfileExecutionClients(m.config,resultConfiguration):f.owner.createNormalExecutionClients(m.config),pair=await source.bootstrap(signal);
 if(profile){delete input.intakeStore;delete input.journalStore;}
 return {f,m,local,clock,signal,memory,input,source,pair,seen,advance(ms){offset+=ms;}};
}
test('등록 원owner의 profile START가 원 permit·wire·ACK를 처리하며 중첩 permit은 같은 물리 host에 남는다',async t=>{
 const {root,memoryFiles}=await import('../unit/FN08/normal-start-local-fixture.ts');
 const local=memoryFiles(),allocation=id(81),folder=path.resolve('Anvil','Trust','v1','owned-spool-profile.v1','data-'+allocation);
 const localPath=p=>{assert.ok(p===folder||p.startsWith(folder+path.sep));return path.join(root,path.relative(folder,p));};
 const io={lstat:p=>local.fs.lstat(localPath(p)),realpath:async p=>{localPath(p);return p;},open:(p,...a)=>local.fs.open(localPath(p),...a),
   readdir:p=>local.fs.readdir(localPath(p)),unlink:p=>local.fs.unlink(localPath(p)),unlinkSync:p=>{assert.ok(local.files.delete(localPath(p)));}};
 fixtures.setFiles(io);
 let allocated=false;
 const holds=new Map(),committed=[],physical=new Map();
 const profile={handle(v,child,metadata){
  assert.equal(v.payload.slotId,metadata.slotId);assert.equal(v.payload.writer,'NORMAL_EXECUTION');
  (physical.get(child)??physical.set(child,[]).get(child)).push(v.operation);
  if(v.operation==='NORMAL_SPOOL_PROFILE_STATE')return {allocated,profileId:id(80)};
  if(v.operation==='NORMAL_SPOOL_RESUME'||v.operation==='NORMAL_SPOOL_ALLOCATE'){
   const old=allocated;allocated=true;return {state:old?'RESUMED':'ALLOCATED',profileId:id(80),allocation,root:folder,directoryIdentity:'NATIVE-RAM-DIR'};}
  assert.equal(v.payload.allocation,allocation);
  if(v.operation==='NORMAL_SPOOL_RESERVE'){assert.equal(v.payload.nodeStamp,'1:1');assert.ok(!holds.has(v.payload.channel));const reservation=id(100+committed.length+holds.size);holds.set(v.payload.channel,reservation);return {reservation,before:{count:0,bytes:0,tail:null}};}
  if(v.operation==='NORMAL_SPOOL_SETTLE'){assert.equal(v.payload.reservation,holds.get(v.payload.channel));holds.delete(v.payload.channel);committed.push(v.payload.channel);return {state:'SETTLED',summary:{count:0,bytes:0,tail:null}};}
  assert.equal(v.operation,'NORMAL_SPOOL_CLOSE');assert.equal(holds.size,0);return {state:'CLOSED_CONFIRMED'};
 }};
 try{
  const x=await pollingFixture(profile),wire=x.input.wire.send;
  // 실제 host 프레임 전송 경로에서 이어진 비동기 작업은 부모 permit 거래에 참여할 수 없다.
  let release,descendant,leaked=0,scheduled=0;
  x.m.onFrame(v=>{
   if(v.operation==='NORMAL_SPOOL_RESERVE'&&v.payload.channel.startsWith('attempt-')){
    scheduled++;const gate=new Promise(r=>{release=r;});descendant=gate.then(async()=>{
     try{await x.pair.get.prepareCommandPage({afterSequence:0,waitMs:0},x.signal);leaked++;}catch{}
    });
   }
  });
  let attempted=false,borrowed=false;
  x.input.wire.send=async(...args)=>{
   attempted=true;release();await descendant;
   try{await x.pair.get.prepareCommandPage({afterSequence:0,waitMs:0},x.signal);borrowed=true;}catch{}
   return Reflect.apply(wire,x.input.wire,args);
  };
  const poll=x.source.createStartPolling(x.pair,x.input),result=await poll.run(x.signal);
  assert.ok(scheduled>0);assert.equal(leaked,0,'물리 host send의 늦은 자손에게 ticket을 전달하지 않는다');
  assert.equal(attempted,true);assert.equal(borrowed,false,'외부 wire의 TLS challenge는 원 transaction을 빌릴 수 없다');
  assert.equal(result.state,'LIMIT_REACHED');assert.deepEqual(result.cursor,{afterSequence:1,afterCursor:'cursor1'});
  assert.equal(x.seen.permits,1);assert.equal(x.seen.wires,1);assert.ok(committed.includes('observations')&&committed.includes('acks'));
  const calls=x.m.calls,permit=calls.find(c=>c.payload.request?.path.endsWith('/permit')&&c.payload.kind==='REQUEST');
  assert.ok(permit);const same=calls.filter(c=>c.child===permit.child);
  assert.ok(same.some(c=>c.operation==='NORMAL_SPOOL_RESERVE'&&c.payload.channel.startsWith('attempt-')));
  assert.ok(same.some(c=>c.operation==='NORMAL_SPOOL_SETTLE'&&c.payload.channel.startsWith('attempt-')));
  for(const child of physical.keys()){const rows=calls.filter(c=>c.child===child);assert.ok(rows.at(-1).sequence<=64);assert.equal(rows[0].sequence,4);}
  t.diagnostic('RAM 핵심 permit 물리 host의 수신 sequence 1..'+same.at(-1).sequence+' / 상한64, wire1, ACK cursor1');
  x.source.dispose();
  local.files.clear();allocated=false;holds.clear();committed.length=0;physical.clear();
  const ready=await pollingFixture(profile,true),{wire:unusedWire,...readyInput}=ready.input;
  const originalCurrent=readyInput.current.current;let checks=0;
  readyInput.current={transport:'NORMAL_PROTECTED',async current(...args){
   checks++;
   if(checks===1){
    const count=ready.m.calls.length;
    const nested=await ready.source.createWorkerStartPolling(ready.pair,readyInput).run(ready.signal);
    assert.equal(nested.state,'UNKNOWN');assert.equal(nested.cursor.afterSequence,0);assert.equal(ready.m.calls.length,count);
   }
   await assert.rejects(ready.pair.get.prepareCommandPage({afterSequence:0,waitMs:0},ready.signal));
   return Reflect.apply(originalCurrent,ready.input.current,args);
  }};
  const readyResult=await ready.source.createWorkerStartPolling(ready.pair,readyInput).run(ready.signal);
  assert.equal(readyResult.state,'LIMIT_REACHED',readyResult.reason);assert.deepEqual(readyResult.cursor,{afterSequence:1,afterCursor:'cursor1'});
  assert.equal(checks,4);assert.equal(ready.seen.permits,1);assert.equal(ready.seen.wires,0);
  assert.deepEqual(ready.seen.events.map(e=>e.type),['RECEIVED','PREPARED','START_ATTEMPTED','PERMIT_RECORDED']);
  const attempts=[...local.files].filter(([name])=>name.includes('attempt-')&&name.endsWith('.json')).map(([,file])=>JSON.parse(file.bytes).snapshot);
  assert.deepEqual(attempts.map(row=>row.state),['START_ATTEMPTED','PERMIT_RECORDED','START_READY_RECORDED']);
  assert.equal(attempts[2].responseRef,null);assert.equal(attempts[2].processRef,null);
  const readyPermit=ready.m.calls.find(c=>c.payload.request?.path.endsWith('/permit')&&c.payload.kind==='REQUEST');
  const readyFrames=ready.m.calls.filter(c=>c.child===readyPermit.child);
  assert.ok(readyFrames.some(c=>c.operation==='NORMAL_SPOOL_RESERVE'&&c.payload.channel.startsWith('intake-')));assert.ok(readyFrames.at(-1).sequence<=64);
  t.diagnostic('READY 원 permit host의 sequence 1..'+readyFrames.at(-1).sequence+' / 상한64, 준비행1, 필수 관측4 ACK');
  const replay=await ready.source.createWorkerStartPolling(ready.pair,readyInput).run(ready.signal);
  assert.deepEqual(replay.cursor,readyResult.cursor);assert.equal(ready.seen.permits,1);assert.equal(checks,4);
  ready.source.dispose();
  // A second isolated RAM owner exhausts the physical child budget during its permit read.
  local.files.clear();allocated=false;holds.clear();committed.length=0;physical.clear();
  const full=await pollingFixture(profile);full.seen.largePermit=true;
  const failed=await full.source.createStartPolling(full.pair,full.input).run(full.signal);
  assert.equal(failed.state,'UNKNOWN');assert.equal(full.seen.wires,0);
  const issued=full.m.calls.find(c=>c.payload.kind==='REQUEST'&&c.payload.request?.path.endsWith('/permit'));
  assert.ok(issued);const capped=full.m.calls.filter(c=>c.child===issued.child);
  assert.equal(capped.at(-1).sequence,64);assert.ok(holds.size>0);
  assert.equal(full.m.calls.filter(c=>c.payload.kind==='REQUEST'&&c.payload.request?.path.endsWith('/permit')).length,1);
  full.source.dispose();
 }finally{fixtures.setFiles(undefined);}
});

// 기존 REGISTERED owner/원 CJS 제어 및 파일 저장 코드에 합성 native metadata/SDK만 공급한다.
async function outputProfile(){
 const {root,memoryFiles}=await import('../unit/FN08/normal-start-local-fixture.ts');
 const local=memoryFiles(),allocation=id(81),folder=path.resolve('Anvil','Trust','v1','owned-spool-profile.v1','data-'+allocation);
 const convert=p=>{assert.ok(p===folder||p.startsWith(folder+path.sep));return path.join(root,path.relative(folder,p));};
 fixtures.setFiles({lstat:p=>local.fs.lstat(convert(p)),realpath:async p=>{convert(p);return p;},open:(p,...a)=>local.fs.open(convert(p),...a),
  readdir:p=>local.fs.readdir(convert(p)),unlink:p=>local.fs.unlink(convert(p)),unlinkSync:p=>{assert.ok(local.files.delete(convert(p)));}});
 const state={allocated:false,seq:500,holds:new Map(),parked:null,claimed:0,settlements:0,denials:[],mode:'OK',room:256*1024**2};
 const output='sdk-session-output',summary=c=>{
  const rows=[...local.files].filter(([p])=>path.basename(p).startsWith(c+'.')&&p.endsWith('.json')).sort(([a],[b])=>a.localeCompare(b));
  return {count:rows.length,bytes:rows.reduce((n,[,v])=>n+v.bytes.length,0),tail:rows.length?contentHash(rows.at(-1)[1].bytes):null};
 };
 const handle=(v,child,slot)=>{
  const p=v.payload;assert.equal(p.slotId,slot.slotId);
  if(v.operation==='NORMAL_SPOOL_PROFILE_STATE')return {profileId:id(80),allocated:state.allocated};
  if(v.operation==='NORMAL_SPOOL_ALLOCATE'||v.operation==='NORMAL_SPOOL_RESUME'){
   if(p.challenge){const h=state.parked;assert.ok(h&&h.challenge===p.challenge&&h.id===p.reservation&&p.scopeDigest===h.scopeDigest&&p.requestDigest===h.requestDigest);
    assert.notEqual(h.child,child);h.child=child;state.parked=null;state.claimed++;}
   const result={state:state.allocated?'RESUMED':'ALLOCATED',profileId:id(80),allocation,root:folder,directoryIdentity:'RAM'};
   if(p.outputBinding)Object.assign(result,{profileRef:ref(80),assignmentRef:ref(81)});
   state.allocated=true;return result;
  }
  if(v.operation==='NORMAL_SPOOL_RESERVE'){
   assert.equal(p.nodeStamp,'1:1');const before=summary(p.channel),key=id(++state.seq);
   assert.ok(!state.holds.has(p.channel));if(p.channel!==output){state.holds.set(p.channel,{id:key,child});return {reservation:key,before};}
   assert.deepEqual(p.scope.registrationRef,f.stored().registration.registrationRef);assert.deepEqual(p.scope.slotRef,slot.receiptRef);
   assert.deepEqual(p.scope.profileRef,ref(80));assert.deepEqual(p.scope.assignmentRef,ref(81));assert.deepEqual(p.scope.grantRef,slot.scope.grantRef);
   const digest=contentHash(canonicalJson(p.request));
   const used=[...local.files].filter(([name])=>name.endsWith('.json')).reduce((n,[,file])=>n+file.bytes.length,0);
   if(state.room-used<p.request.dataBytes+8192)return {state:'CAPACITY_EXCEEDED'};
   state.holds.set(output,{id:key,child,scopeDigest:p.request.scopeDigest,requestDigest:digest});return {id:key,requestDigest:digest,
    normalUsed:used,normalHeldBefore:0,channelBytes:before.bytes,channelRows:before.count,channelHeldRows:0,channelHeldBytes:0,managementBytes:8192};
  }
  if(v.operation==='NORMAL_SPOOL_CLOSE'&&p.reservation){
   const h=state.holds.get(output);assert.ok(h&&h.id===p.reservation&&h.child===child);
   h.challenge=id(++state.seq)+id(++state.seq);state.parked=h;return {state:'SDK_READ_CLOSED',challenge:h.challenge};
  }
  if(v.operation==='NORMAL_SPOOL_SETTLE'){
   const h=state.holds.get(p.channel);assert.ok(h&&h.child===child&&h.id===p.reservation);
   state.holds.delete(p.channel);if(p.channel===output){state.settlements++;if(state.mode==='LOSE')return {state:'UNKNOWN'};}
   return {state:'SETTLED',summary:summary(p.channel)};
  }
  assert.equal(v.operation,'NORMAL_SPOOL_CLOSE');return {state:'CLOSED_CONFIRMED'};
 };
 let f;return {local,state,profile:{handle:(...args)=>{try{return handle(...args);}catch(e){state.denials.push(String(e));return{state:'UNKNOWN'};}}},bind(x){f=x.f;}};
}
for(const scenario of ['OK','CAPACITY','WRONG_PROOF','LOST_SETTLE','OWNER_LOST','EXPIRED','MIDDLE_CHANGED','TAIL_LOST','ITERATOR_PROXY'])test(
 scenario==='OK'?'등록 owner 원 Query의 SDK 대기 중 독립 START ACK가 끝나고 같은 보호 예약에 출력이 정착한다':'보호 SDK 출력 거절 '+scenario,async()=>{
 const q=await outputProfile(),x=await pollingFixture(q.profile,true,true);q.bind(x);
 const {wire:unused,...input}=x.input;input.timeoutMs=2000;
 let sid;const message={type:'assistant',uuid:'private',session_id:sid,parent_tool_use_id:null,message:{content:[{type:'text',text:'합성 격리 본문'}]}};
 const init={type:'system',subtype:'init',uuid:'init',session_id:null,apiKeySource:'none',claude_code_version:'2.1.224',cwd:'fixture',tools:[],mcp_servers:[],model:'fixture',permissionMode:'default',slash_commands:[],output_style:'fixture',skills:[],plugins:[]};
 let created=0,reads=0,independent,asked=0,valid=true,iteratorCalls=0,callGetter=0,proxyCalls=0,alternativeReads=0,ownQuery;const closed=[];
 if(scenario==='CAPACITY')q.state.room=0;if(scenario==='LOST_SETTLE')q.state.mode='LOSE';
 const sdk={expiresAt:x.clock()+(scenario==='EXPIRED'?200:4000),check:scope=>valid?{scopeDigest:contentHash(canonicalJson(scope)),expiresAt:x.clock()+4000}:null,
  classify:v=>v.uuid==='private'?'SENSITIVE':'ORDINARY',close:async query=>{closed.push(query);},
  async create(request,prompt){
   created++;sid=request.plannedSid;assert.match(sid,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);assert.equal(request.scope.plannedSidDigest,contentHash(canonicalJson(sid)));message.session_id=sid;init.session_id=sid;const user=await prompt[Symbol.asyncIterator]().next();assert.equal(user.value.message.content,'보호 출력 시험 입력');assert.equal(user.value.session_id,sid);
   const query={};ownQuery=query;const acquire=function(){assert.equal(this,query);iteratorCalls++;return {async next(){
    const n=reads++;assert.ok(q.state.parked);
    if(n===0&&scenario==='OK'){
     x.seen.startOnly=true;
     independent=await x.source.createWorkerStartPolling(x.pair,input).run(x.signal);x.seen.startOnly=false;asked++;
    }
    if(n===0&&scenario==='WRONG_PROOF')q.state.parked.challenge='discarded';
    if(n===0&&scenario==='OWNER_LOST')valid=false;
    if(n===0&&scenario==='EXPIRED')x.advance(300);
    if(scenario==='MIDDLE_CHANGED'||scenario==='TAIL_LOST'){
     if(n===1)return {done:false,value:{...message,uuid:'private-second'}};
     if(n===2){
      const files=[...q.local.files].filter(([key])=>path.basename(key).startsWith('sdk-session-output.')&&key.endsWith('.json')).sort(([a],[b])=>a.localeCompare(b));
      assert.equal(files.length,2);
      if(scenario==='TAIL_LOST')q.local.files.delete(files[1][0]);
      else{const file=files[0][1],old=file.bytes.toString();file.bytes=Buffer.from(old.replace('QUARANTINED','QUARANTINEX'));assert.equal(file.bytes.length,Buffer.byteLength(old));assert.notEqual(file.bytes.toString(),old);}
      return {done:false,value:init};
     }
    }
    return n<2?{done:false,value:n===0?message:init}:{done:true,value:undefined};
   }};};
   Object.defineProperty(acquire,'call',{get(){callGetter++;return ()=>({async next(){alternativeReads++;return {done:true};}});}});
   query[Symbol.asyncIterator]=scenario==='ITERATOR_PROXY'?new Proxy(acquire,{apply(){proxyCalls++;throw Error('proxy');}}):acquire;
   return query;
  }};
 try{
  const done=await x.source.createWorkerStartPolling(x.pair,input,sdk).run(x.signal);
  assert.equal(callGetter,0);assert.equal(alternativeReads,0);assert.equal(proxyCalls,0);assert.equal(iteratorCalls,scenario==='ITERATOR_PROXY'?0:1);
  if(scenario!=='OK'){
   assert.equal(done.state,'UNKNOWN',JSON.stringify(done));assert.ok(done.cursor.afterSequence<2);assert.equal(created,1);
   const states=[...q.local.files].filter(([key])=>key.endsWith('.json')).map(([,file])=>JSON.parse(file.bytes).snapshot?.state);
   assert.ok(!states.includes('FIRST_SEND_INPUT_AND_INIT_RECORDED'));assert.ok(!states.includes('SESSION_INIT_CONFIRMED'));
   assert.equal(reads,scenario==='CAPACITY'||scenario==='ITERATOR_PROXY'?0:scenario==='MIDDLE_CHANGED'||scenario==='TAIL_LOST'?3:1);
   if(scenario==='ITERATOR_PROXY'){assert.equal(closed.length,1);assert.equal(closed[0],ownQuery);assert.equal(closed.filter(q=>q!==ownQuery).length,0);}
   if(scenario==='LOST_SETTLE')assert.equal(q.state.settlements,1);
   else if(scenario==='MIDDLE_CHANGED'||scenario==='TAIL_LOST')assert.equal(q.state.settlements,2);
   else assert.equal(q.state.settlements,0);
   if(scenario==='WRONG_PROOF')assert.equal(q.state.denials.length,1);
   if(scenario==='WRONG_PROOF'||scenario==='OWNER_LOST'||scenario==='EXPIRED')assert.ok(q.state.holds.has('sdk-session-output'));
   return;
  }
  assert.equal(done.state,'LIMIT_REACHED',JSON.stringify({done,independent,created,reads,denials:q.state.denials,rows:[...q.local.files.entries()].filter(([k])=>k.endsWith('.json')).map(([k,r])=>[path.basename(k),JSON.parse(r.bytes).snapshot?.state]),frames:x.m.calls.slice(-12).map(v=>[v.operation,v.payload.channel])}));
  assert.equal(done.cursor.afterSequence,2);assert.equal(independent.state,'LIMIT_REACHED');assert.equal(independent.cursor.afterSequence,1);
  assert.equal(created,1);assert.equal(asked,1);assert.equal(x.seen.permits,2);
  const rows=[...q.local.files.entries()].filter(([p])=>path.basename(p).startsWith('sdk-session-output.')&&p.endsWith('.json')).sort().map(([,f])=>JSON.parse(f.bytes));
  assert.deepEqual(rows.map(r=>r.snapshot.state),['OUTPUT_PENDING_SESSION','OUTPUT_PENDING_SESSION','SESSION_INIT_CONFIRMED']);
  assert.equal(rows[0].snapshot.classification,'QUARANTINED');assert.deepEqual(JSON.parse(Buffer.from(rows[0].snapshot.body,'base64')),message);
  assert.deepEqual(rows[2].snapshot.scope,rows[0].snapshot.scope);
  assert.ok(q.state.claimed>=2&&q.state.settlements>=2);assert.deepEqual(q.state.denials,[]);
 }finally{x.source.dispose();fixtures.setFiles(undefined);}
});

for(const mode of ['CALLER_SID','RNG_FAILURE','INVALID_UUID','EXPIRED','CANCELLED','EXPIRED_DURING_ISSUE','SID_ADDED'])test('등록 FIRST SID 발급의 효과 전 거절과 재발급0 '+mode,async(t)=>{
 const q=await outputProfile(),x=await pollingFixture(q.profile,true,true);q.bind(x);
 const {wire:unused,...input}=x.input;input.timeoutMs=1200;
 let creates=0,issued=0;
 const sdk={expiresAt:x.clock()+(mode==='EXPIRED'?0:4000),check:scope=>({scopeDigest:contentHash(canonicalJson(scope)),expiresAt:x.clock()+4000}),
  classify:()=> 'ORDINARY',close:async()=>{},create:async()=>{creates++;throw Error('UNEXPECTED_QUERY');}};
 if(mode==='CALLER_SID')sdk.plannedSid='caller-selected';
 const crypto=require('node:crypto'),original=crypto.randomUUID;
 const mocked=t.mock.method(crypto,'randomUUID',function(...args){
  if(new Error().stack.includes('takeProfileFirstSid')){
   issued++;if(mode==='RNG_FAILURE')throw Error('TEST_ONLY_RANDOM_UNAVAILABLE');
   if(mode==='INVALID_UUID')return 'not-a-uuid';if(mode==='EXPIRED_DURING_ISSUE')x.advance(5000);if(mode==='SID_ADDED')sdk.plannedSid='late-caller-sid';
  }
  return Reflect.apply(original,crypto,args);
 });
 try{
  if(mode==='CALLER_SID'){assert.throws(()=>x.source.createWorkerStartPolling(x.pair,input,sdk));}
  else{
   const poll=x.source.createWorkerStartPolling(x.pair,input,sdk);
   if(mode==='CANCELLED')x.source.dispose();
   await poll.run(x.signal).catch(()=>{});
   const first=issued;await poll.run(x.signal).catch(()=>{});assert.equal(issued,first,'동일 원 시도 재입장으로 UUID 재발급0');
  }
  assert.equal(creates,0);assert.equal(q.state.settlements,0);
  assert.equal(issued,['RNG_FAILURE','INVALID_UUID','EXPIRED_DURING_ISSUE','SID_ADDED'].includes(mode)?1:0);
 }finally{mocked.mock.restore();x.source.dispose();fixtures.setFiles(undefined);}
});

for(const mode of ['PULL','NO_PULL','DISPOSE','CURRENT_LOST','EARLY_RETURN'])test('동일 등록 Query가 실제 소비한 후속 입력만 정착한다 '+mode,async()=>{
 const q=await outputProfile(),x=await pollingFixture(q.profile,true,'FOLLOW');q.bind(x);
 const {wire:unused,...input}=x.input;input.timeoutMs=1200;
 let queryCount=0,iterators=0,reader,pull,outputs=0,duplicate,valid=true;
 const delivered=[];
 const init={type:'system',subtype:'init',uuid:'init',session_id:null,apiKeySource:'none',claude_code_version:'2.1.224',cwd:'fixture',tools:[],mcp_servers:[],model:'fixture',permissionMode:'default',slash_commands:[],output_style:'fixture',skills:[],plugins:[]};
 const sdk={expiresAt:x.clock()+4000,check:scope=>valid?{scopeDigest:contentHash(canonicalJson(scope)),expiresAt:x.clock()+4000}:null,
  classify:()=> 'ORDINARY',close:async()=>{},async create(request,prompt){
   init.session_id=request.plannedSid;assert.match(init.session_id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);queryCount++;reader=prompt[Symbol.asyncIterator]();const first=await reader.next();delivered.push(first.value.message.content);
   if(mode!=='NO_PULL'){
    pull=reader.next().then(r=>{if(!r.done)delivered.push(r.value.message.content);},()=>{});
    duplicate=reader.next().then(()=>false,()=>true);
   }
   return {[Symbol.asyncIterator](){iterators++;return {async next(){return outputs++?{done:true,value:undefined}:{done:false,value:init};}};}};
  }};
 try{
  x.m.onFrame(v=>{if(v.operation==='NORMAL_EXECUTION_CALL'&&v.payload.kind==='REQUEST'&&v.payload.request.path.includes(id(130))&&v.payload.request.path.endsWith('/permit')){
   if(mode==='DISPOSE')x.source.dispose();else if(mode==='CURRENT_LOST')valid=false;else if(mode==='EARLY_RETURN')void reader.return();
  }});
  const result=await x.source.createWorkerStartPolling(x.pair,input,sdk).run(x.signal);
  if(mode==='PULL')assert.equal(result.state,'LIMIT_REACHED',JSON.stringify({result,delivered,denials:q.state.denials,permits:x.seen.permits,
   states:[...q.local.files].filter(([p])=>p.endsWith('.json')&&p.includes('attempt-')).map(([,v])=>JSON.parse(v.bytes).snapshot.state),
   requests:x.m.calls.filter(c=>c.payload.kind==='REQUEST').slice(-8).map(c=>c.payload.request.path),frames:x.m.calls.slice(-6).map(c=>[c.operation,c.payload.channel])}));
  else assert.notEqual(result.state,'LIMIT_REACHED');
  assert.equal(queryCount,1);assert.equal(iterators,1);
  const rows=[...q.local.files].filter(([key])=>key.endsWith('.json')).map(([,file])=>JSON.parse(file.bytes));
  const terminal=rows.filter(r=>r.snapshot?.state==='LIVE_SEND_INPUT_YIELDED');
  assert.equal(rows.filter(r=>r.snapshot?.state==='FIRST_SEND_INPUT_AND_INIT_RECORDED').length,1);
  if(mode==='PULL'){
   await pull;assert.equal(await duplicate,true);assert.deepEqual(delivered,['보호 출력 시험 입력','다음 명령 🙂']);
   assert.equal(result.cursor.afterSequence,3);assert.equal(x.seen.permits,3);assert.equal(terminal.length,1);
   assert.equal(terminal[0].snapshot.inputEvidence.instructionDigest,contentHash('다음 명령 🙂'));
   assert.ok(x.seen.events.some(e=>e.commandId===id(130)));
  }else{assert.equal(terminal.length,0);assert.ok(result.cursor.afterSequence<3);assert.deepEqual(delivered,['보호 출력 시험 입력']);}
 }finally{x.source.dispose();fixtures.setFiles(undefined);}
 if(pull)await pull;await assert.rejects(reader.next());assert.equal(delivered.length,mode==='PULL'?2:1);
});

for(const mode of ['VALID','CURRENT_LOST','COMMAND_EXPIRED','STOP'])test('원 후속 yield와 마지막 SDK 전달 사이의 동기 검산 '+mode,async()=>{
 const {liveStopFixture}=await import('../unit/FN07/normal-first-send-owner.test.ts');
 const {prepareLiveFollowup}=await import('../unit/FN08/normal-instruction-dispatch-fixture.ts');
 const {confirmNormalLiveInputDelivery,requestNormalLiveStop}=await import('../../apps/connector/runtime/normal-first-send-owner.ts');
 let f,saved,delivered=0,originalYield=0;
 const port={async provide(query,input){
  const step=await input[Symbol.asyncIterator]().next();assert.equal(step.done,false);originalYield++;
  saved={input,query};await Promise.resolve();
  for(const args of [[{},f.worker,query,port],[input,{},query,port],[input,f.worker,{},port],[input,f.worker,query,{}]])
   assert.throws(()=>confirmNormalLiveInputDelivery(...args));
  if(mode==='CURRENT_LOST')f.effects.current=false;
  if(mode==='COMMAND_EXPIRED')f.mode.wall+=12000;
  if(mode==='STOP')await requestNormalLiveStop(f.worker,f.stopItem,f.original,f.stop.store,f.signal,()=>{});
  confirmNormalLiveInputDelivery(input,f.worker,query,port);delivered++;
  assert.throws(()=>confirmNormalLiveInputDelivery(input,f.worker,query,port));
 }};
 f=await liveStopFixture(port);
 try{
  assert.equal((await f.run()).state,'LIMIT_REACHED');const {item,c,prepared}=await prepareLiveFollowup(f,'마지막 경계 원문');
  const result=c.dispatch(item.envelope,prepared,f.wire,f.signal);
  if(mode==='VALID')assert.equal((await result).state,'LIVE_SEND_INPUT_YIELDED');else await assert.rejects(result);
  assert.equal(originalYield,1);assert.equal(delivered,mode==='VALID'?1:0);assert.equal(f.effects.create,1);
  assert.throws(()=>confirmNormalLiveInputDelivery(saved.input,f.worker,saved.query,port));
 }finally{f.authority.abort();await f.h.close();}
});

test('등록 receipt 목적 입구는 connector의 등록 fullref/프로젝트를 벗어나면 slot 발급이나 host open 전에 거절한다',async()=>{
 const f=await fixtures.liveNativeOwner(),m=model(f,'NORMAL'),inbox=f.owner.createProfileReceiptInbox(),count=f.calls();
 assert.deepEqual(Object.keys(inbox).sort(),['dispose','receive']);
 const signal=new AbortController().signal;
 for(const expected of [{context:{projectId:id(99)},executorRegistrationRef:f.stored().registration.registrationRef},
  {context:{projectId:f.stored().projectId},executorRegistrationRef:ref(99)}]){
  assert.throws(()=>inbox.receive({maxBytes:4096,maxEntries:10},{},expected,signal),/SCOPE_INVALID/);
 }
 assert.equal(f.calls(),count);assert.equal(m.calls.length,0);inbox.dispose();
});

test('외부 TS coordinator는 실제 CJS pair의 첫 START를 거절하고 같은 번들 조립은 ACK까지 처리한다',async()=>{
 const x=await pollingFixture(),p=x.input;
 const {NormalStartIntake}=await import('../../apps/connector/runtime/normal-start-intake.ts');
 const {NormalObservationSpool}=await import('../../apps/connector/runtime/normal-observation-spool.ts');
 const {NormalStartPolling}=await import('../../apps/connector/runtime/normal-start-polling.ts');
 const {NormalStartCoordinator}=await import('../../apps/connector/runtime/normal-start-coordinator.ts');
 const start={intake:new NormalStartIntake(p.intakeStore,p.expected,x.clock),spool:new NormalObservationSpool(p.journalStore,x.local,x.clock),store:p.journalStore,current:p.current,wire:p.wire,grantRef:x.m.config.scope.grantRef,clock:x.clock,timeoutMs:p.timeoutMs};
 assert.throws(()=>new NormalStartCoordinator({...start,post:x.pair.post}),/NORMAL_START_PORTS_REQUIRED/);
 const cross=new NormalStartPolling({clients:x.pair,start,owner:()=>'RAM',deadline:p.deadline,maxPages:1,idleMs:1});
 assert.equal((await cross.run(x.signal)).state,'UNKNOWN');assert.equal(x.m.calls.length,3);assert.equal(x.memory.files.size,0);
 const before=x.m.calls.length,poller=x.source.createStartPolling(x.pair,p);
 assert.equal(x.m.calls.length,before);assert.equal(x.memory.files.size,0);
 const result=await poller.run(x.signal);
 assert.equal(result.state,'LIMIT_REACHED');assert.deepEqual(result.cursor,{afterSequence:1,afterCursor:'cursor1'});
 assert.equal(x.seen.permits,1);assert.equal(x.seen.wires,1);assert.equal(x.seen.events.length,5);assert.equal(result.agentSuccessVerified,false);
 x.source.dispose();
});

test('조립은 원 쌍·등록·실행세대와 포트를 확인하고 GET 전송 전에 거절한다',async()=>{
 const x=await pollingFixture(),p=x.input,before=x.m.calls.length;
 const foreign=x.f.owner.createNormalExecutionClients(x.m.config);
 assert.throws(()=>foreign.createStartPolling(x.pair,p),/PREDECESSOR/);
 assert.throws(()=>x.source.createStartPolling({...x.pair},p),/PREDECESSOR/);
 for(const field of ['intakeStore','journalStore','wire','current']){
  assert.throws(()=>x.source.createStartPolling(x.pair,{...p,[field]:undefined}));
 }
 for(const changed of [{projectId:id(90)},{executionId:id(91)},{executionGeneration:2}]){
  assert.throws(()=>x.source.createStartPolling(x.pair,{...p,expected:{...p.expected,context:{...p.expected.context,...changed}}}),/SCOPE/);
 }
 assert.throws(()=>x.source.createStartPolling(x.pair,{...p,expected:{...p.expected,executorRegistrationRef:{...p.expected.executorRegistrationRef,contentHash:'f'.repeat(64)}}}),/SCOPE/);
 Object.defineProperty(x.pair.get,'send',{get(){assert.fail('변경된 accessor 호출');}});
 assert.throws(()=>x.source.createStartPolling(x.pair,p),/CLIENTS_CHANGED/);
 assert.equal(x.m.calls.length,before);assert.equal(x.memory.files.size,0);foreign.dispose();x.source.dispose();
});
test('동일 owner의 명시 갱신 뒤 구 poller 전송0, 새 쌍으로만 첫 START를 처리한다',async()=>{
 const x=await pollingFixture(),poller=x.source.createStartPolling(x.pair,x.input),old=x.source.createStartPolling(x.pair,x.input);
 const before=x.m.calls.length;
 await assert.rejects(poller.renew(x.signal),/NOT_EXPIRED/);x.advance(5000);
 assert.equal((await poller.run(x.signal)).state,'NEEDS_RENEWAL');assert.equal(x.m.calls.length,before);
 await poller.renew(x.signal);assert.equal(x.m.calls.length,before+1);
 assert.equal((await old.run(x.signal)).reason,'OWNER_CHANGED');assert.equal(x.m.calls.length,before+1);
 assert.throws(()=>x.source.createStartPolling(x.pair,x.input),/PREDECESSOR/);
 const result=await poller.run(x.signal);assert.equal(result.state,'LIMIT_REACHED');assert.equal(x.seen.wires,1);assert.equal(x.seen.permits,1);
 x.source.dispose();const count=x.m.calls.length;
 assert.equal((await poller.run(x.signal)).reason,'OWNER_CHANGED');assert.equal(x.m.calls.length,count);
});
test('ACK 결과 불명은 원 cursor를 유지하고 같은 poller 재호출로 permit·wire를 반복하지 않는다',async()=>{
 const x=await pollingFixture(),poller=x.source.createStartPolling(x.pair,x.input);x.seen.loseAck=true;
 const result=await poller.run(x.signal);assert.equal(result.state,'UNKNOWN');assert.deepEqual(result.cursor,{afterSequence:0});
 assert.equal(x.seen.events.length,5);assert.equal(x.seen.wires,1);assert.equal(x.seen.permits,1);
 const before=x.m.calls.length;assert.equal((await poller.run(x.signal)).state,'UNKNOWN');await assert.rejects(poller.renew(x.signal),/UNKNOWN/);
 assert.equal(x.m.calls.length,before);x.source.dispose();
});


for(const mode of ['OK','NO_REQUEST','WRONG_ATTEMPT','CLOSE_UNKNOWN','CANCELLED'])test('FN09 원 등록 GET→private output read→정상 host close '+mode,async()=>{
 const q=await outputProfile(),x=await pollingFixture(q.profile,true,true);q.bind(x);
 const {wire:unused,...input}=x.input;input.timeoutMs=2000;
 let n=0,closed=0;
 const sdk={expiresAt:x.clock()+4000,check:scope=>({scopeDigest:contentHash(canonicalJson(scope)),expiresAt:x.clock()+4000}),classify:()=> 'ORDINARY',close:async()=>{},
  async create(request,prompt){await prompt[Symbol.asyncIterator]().next();const sid=request.plannedSid;return{[Symbol.asyncIterator](){return{async next(){
   const i=n++;if(i===0)return{done:false,value:{type:'system',subtype:'init',uuid:'init',session_id:sid,apiKeySource:'none',claude_code_version:'2.1.224',cwd:'fixture',tools:[],mcp_servers:[],model:'fixture',permissionMode:'default',slash_commands:[],output_style:'fixture',skills:[],plugins:[]}};
   if(i===1)return{done:false,value:{type:'assistant',uuid:'answer',session_id:sid,parent_tool_use_id:null,message:{content:[{type:'text',text:'선택된 이해 근거'}]}}};
   return{done:true,value:undefined};
  }}}};}};
 try{
  const worker=x.source.createWorkerStartPolling(x.pair,input,sdk);assert.equal(x.m.calls.filter(v=>v.payload.request?.path?.endsWith('/understanding-response-read')).length,0);
  const start=await worker.run(x.signal);assert.equal(start.state,'LIMIT_REACHED');
  for(let i=0;i<50&&(q.state.holds.size||n<3);i++)await new Promise(r=>setImmediate(r));
  const rows=[...q.local.files].filter(([p])=>path.basename(p).startsWith('sdk-session-output.')&&p.endsWith('.json')).sort(([a],[b])=>a.localeCompare(b)).map(([,f])=>JSON.parse(f.bytes));
  assert.deepEqual(rows.map(r=>r.snapshot.state),['OUTPUT_PENDING_SESSION','SESSION_INIT_CONFIRMED','SESSION_OUTPUT']);
  const hash=v=>contentHash(canonicalJson(v)),stamp=new Date(x.clock()).toISOString(),end=new Date(x.clock()+3000).toISOString();
  const request={schemaVersion:1,requestId:id(777),attemptId:mode==='WRONG_ATTEMPT'?id(778):x.f.stored().attemptId,
   selection:{scope:rows[0].snapshot.scope,initConfirmationRef:rows[1].ref,tailRef:rows[2].ref,firstSequence:3,lastSequence:3},
   binding:{scope:rows[0].snapshot.scope,mode:'CONTEXT_REVIEW',bundleRef:ref(780),subjectBindingRef:ref(781),basisRefs:[ref(782)],requiredPartRefs:[ref(782)],receivedPartRefs:[ref(782)],checkedAt:stamp,expiresAt:end}};
  const {executionTarget}=await import('../../apps/server/modules/executions/execution-proof.ts');
  x.m.respond(r=>{
   assert.equal(r.method,'GET');assert.ok(r.path.endsWith('/understanding-response-read'));
   if(mode==='NO_REQUEST')return {code:'NORMAL_UNDERSTANDING_RESPONSE_SOURCE_UNAVAILABLE'};
   const requestRef={...ref(777),contentHash:hash(request)},receipt={kind:'NORMAL_UNDERSTANDING_READ_ACQUIRED',target:executionTarget('GET',r.path,[],null),packetHash:hash({fixture:'original read proof'}),challengeRef:ref(5),slotRef:ref(4),requestRef,observedAt:stamp,expiresAt:end};
   return{transport:'NORMAL_PROTECTED',proofResultRef:{...ref(783),contentHash:hash(receipt)},receipt,requestRef,request,cacheControl:'no-store',nonceConsumed:true,executionAuthorized:false,dispatchPerformed:false};
  });
  const handle=q.profile.handle;q.profile.handle=(v,...rest)=>{if(v.operation==='NORMAL_SPOOL_CLOSE'&&!v.payload.reservation){closed++;if(mode==='CLOSE_UNKNOWN')return{state:'UNKNOWN'};}return handle(v,...rest);};
  const before=x.m.calls.length,files=canonicalJson([...q.local.files].map(([p,f])=>[p,f.bytes.toString('base64')])),a=new AbortController();if(mode==='CANCELLED')a.abort();
  const concurrent=[],phases=new Set();
  if(mode==='OK')x.m.onFrame(v=>{
   const phase=v.operation==='NORMAL_SPOOL_PROFILE_STATE'?'PRIVATE_READ':v.payload.request?.path?.endsWith('/understanding-response-read')?v.payload.kind:null;
   if(!phase||phases.has(phase))return;phases.add(phase);
   concurrent.push(assert.rejects(worker.readUnderstanding(a.signal)),assert.rejects(worker.run(a.signal)),assert.rejects(worker.renew(a.signal)));
  });
  if(mode==='OK'){
   const result=await worker.readUnderstanding(a.signal);assert.equal(result.parts[0].text,'선택된 이해 근거');assert.equal(result.attribution,'SESSION_ONLY');assert.equal(result.executionAuthorized,false);assert.equal(closed,1);await Promise.all(concurrent);assert.deepEqual([...phases],['PREPARE','REQUEST','PRIVATE_READ']);
   assert.equal(/session_id|plannedSid|private|cwd/.test(JSON.stringify(result)),false);
   const count=x.m.calls.length;await assert.rejects(worker.readUnderstanding(a.signal));assert.equal(x.m.calls.slice(count).filter(v=>v.operation.startsWith('NORMAL_SPOOL_')).length,0);
  }else{await assert.rejects(worker.readUnderstanding(a.signal));const count=x.m.calls.length;await assert.rejects(worker.readUnderstanding(a.signal));assert.equal(x.m.calls.length,count);}
  const calls=x.m.calls.slice(before);assert.equal(calls.filter(v=>v.payload.request?.method==='POST'||['NORMAL_SPOOL_ALLOCATE','NORMAL_SPOOL_RESERVE','NORMAL_SPOOL_SETTLE'].includes(v.operation)).length,0);
  if(['NO_REQUEST','WRONG_ATTEMPT','CANCELLED'].includes(mode))assert.equal(calls.filter(v=>v.operation.startsWith('NORMAL_SPOOL_')).length,0);
  assert.equal(canonicalJson([...q.local.files].map(([p,f])=>[p,f.bytes.toString('base64')])),files);
  assert.equal(x.f.owner.isBusy(),false);assert.equal(x.f.timers(),0);
 }finally{x.source.dispose();fixtures.setFiles(undefined);}
});

for(const mode of ['OK','NONE','DENIED','EXPIRED','GET_DENIED','PACKET','START','CONTEXT','REGISTRATION','CLOSE_UNKNOWN','NATIVE_BODY','NATIVE_EXTRA','NATIVE_UNKNOWN','NATIVE_HOST_CLOSE','CANCELLED','SEND_ONCE','SEND_PROVIDER_MISSING','SEND_NEXT_PROVIDER_MISSING','SEND_PARENT_UNKNOWN','SEND_CANCEL_CLOSE','SEND_EXPIRE_CLOSE','SEND_BAD_PROOF','SEND_LOST','SEND_LATE_PARENT_OPEN','SEND_LATE_NEXT_OPEN'])test('FN09 DISCOVERY 실제 registered owner→GET→원 close 메타 '+mode,async()=>{
 const sendMode=mode.startsWith('SEND_'),steps=[];
 let stagePrepare,stageSend,finishClose,releaseLate,firstSlot;
 let lateClosed=0,discoveryStarted=false;
 if(sendMode)syntheticResultOwner=factory=>({async open(signal,slot){
  const native=await factory.open(signal,slot),isNext=steps.includes('physical-close');
  if(slot){
   if(isNext)assert.deepEqual(slot,firstSlot);
   else firstSlot=structuredClone(slot);
  }
  let isParent=false;
  const host={...native,
   async prepareUnderstandingResult(binding){isParent=true;steps.push('prepare');return stagePrepare(binding);},
   async close(disposition){
    const result=await native.close(disposition);
    if(!isParent)return result;
    assert.equal(result.state,'CLOSED_CONFIRMED');
    if(disposition!=='HOST_REQUEST_VALIDATED')return result;
    steps.push('physical-close');
    finishClose();
    return mode==='SEND_PARENT_UNKNOWN'?{state:'UNKNOWN'}:result;
   },
   ...((mode==='SEND_PROVIDER_MISSING'||mode==='SEND_NEXT_PROVIDER_MISSING'&&isNext)?{}:{async sendUnderstandingResult(operation,payload){
    assert.equal(operation,'NORMAL_EXECUTION_UNDERSTANDING_RESULT_SEND');
    steps.push('send');return stageSend(payload);
   }})
  };
  if(discoveryStarted&&slot&&(mode==='SEND_LATE_PARENT_OPEN'&&!isNext||mode==='SEND_LATE_NEXT_OPEN'&&isNext)){
   return new Promise(resolve=>{releaseLate=()=>resolve({...host,close(disposition){
    assert.equal(disposition,'OPERATION_UNKNOWN');lateClosed++;return host.close(disposition);
   }});});
  }
  return host;
 }});
 const q=await outputProfile(),x=await pollingFixture(q.profile,true,true);q.bind(x);
 syntheticResultOwner=undefined;
 const {wire:unused,...input}=x.input;input.timeoutMs=2000;
 let n=0,closed=0;
 const sdk={expiresAt:x.clock()+4000,check:scope=>({scopeDigest:contentHash(canonicalJson(scope)),expiresAt:x.clock()+4000}),classify:()=> 'ORDINARY',close:async()=>{},
  async create(request,prompt){await prompt[Symbol.asyncIterator]().next();const sid=request.plannedSid;return{[Symbol.asyncIterator](){return{async next(){
   const i=n++;if(i===0)return{done:false,value:{type:'system',subtype:'init',uuid:'init',session_id:sid,apiKeySource:'none',claude_code_version:'2.1.224',cwd:'fixture',tools:[],mcp_servers:[],model:'fixture',permissionMode:'default',slash_commands:[],output_style:'fixture',skills:[],plugins:[]}};
   if(i===1)return{done:false,value:{type:'assistant',uuid:'answer',session_id:sid,parent_tool_use_id:null,message:{content:[{type:'text',text:'선택된 이해 근거'}]}}};
   return{done:true,value:undefined};
  }}}};}};
 try{
  const worker=x.source.createWorkerStartPolling(x.pair,input,sdk);assert.equal(x.m.calls.filter(v=>v.payload.request?.path?.endsWith('/understanding-response-read')).length,0);
  const start=await worker.run(x.signal);assert.equal(start.state,'LIMIT_REACHED');
  for(let i=0;i<50&&(q.state.holds.size||n<3);i++)await new Promise(r=>setImmediate(r));
  const rows=[...q.local.files].filter(([p])=>path.basename(p).startsWith('sdk-session-output.')&&p.endsWith('.json')).sort(([a],[b])=>a.localeCompare(b)).map(([,f])=>JSON.parse(f.bytes));
  assert.deepEqual(rows.map(r=>r.snapshot.state),['OUTPUT_PENDING_SESSION','SESSION_INIT_CONFIRMED','SESSION_OUTPUT']);
  const hash=v=>contentHash(canonicalJson(v)),stamp=new Date(x.clock()).toISOString(),end=new Date(x.clock()+(mode.startsWith('SEND_LATE_')?1200:3000)).toISOString();
  const {executionTarget}=await import('../../apps/server/modules/executions/execution-proof.ts');
  const scope=x.m.config.scope,base='/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/understanding-response-read',target=executionTarget('GET',base,[],null);
  const frame={schemaVersion:1,challengeRef:ref(5),proof:{requestId:id(6),...target,grantRef:scope.grantRef,credentialGeneration:scope.credentialGeneration,serverNonce:Buffer.alloc(32,1).toString('base64url')},signature:Buffer.alloc(64,2).toString('base64url')};
  let terminal=['NONE','DENIED','EXPIRED','GET_DENIED'].includes(mode),prepares=0;
  const outcome=(status,stage)=>({kind:'NORMAL_UNDERSTANDING_NOT_ACQUIRED',status,stage,path:base,query:'',requestId:id(6),slotRef:ref(4),expiresAt:end});
  x.m.prepareRespond(r=>{prepares++;if(terminal&&mode!=='GET_DENIED')return outcome(mode,'PREPARE');return {path:r.path,query:'',auth:Buffer.from(canonicalJson(frame)).toString('base64url'),challengeRef:frame.challengeRef,requestId:frame.proof.requestId,expiresAt:end};});
  const sourceScope=rows[0].snapshot.scope;
  const context={...scope,registrationRef:sourceScope.registrationRef,startCommandId:id(56),startCommandRef:ref(785),assignmentRef:ref(40),preparationRef:ref(784),contextBundleRef:ref(50),sessionBindingRef:sourceScope.sessionBindingRef};
  assert.notEqual(context.startCommandId,context.startCommandRef.id); // 원 queue 행 ref와 envelope 명령 ID는 독립이다.
  if(mode==='START')context.startCommandId=id(789);
  if(mode==='CONTEXT')context.contextBundleRef=ref(789);if(mode==='REGISTRATION')context.registrationRef=ref(789);
  x.m.respond(r=>{
   assert.equal(r.method,'GET');assert.equal(r.path,base);
   if(terminal&&mode==='GET_DENIED')return outcome('DENIED','REQUEST');
   const receipt={kind:'NORMAL_UNDERSTANDING_DISCOVERY_ACQUIRED',binding:{...scope,transport:'NORMAL_PROTECTED',mode:'EXECUTION',scopeDigest:'b'.repeat(64),publicKeyFingerprint:'c'.repeat(64)},credentialRef:ref(4),challengeRef:frame.challengeRef,packetHash:mode==='PACKET'?'f'.repeat(64):hash({frame,target}),target,requestId:frame.proof.requestId,understandingRequestRef:ref(777),context,observedAt:stamp,expiresAt:end};
   acquisitionRef={...ref(783),contentHash:hash(receipt)};return {transport:'NORMAL_PROTECTED',status:'DISCOVERY_ACQUIRED',proofResultRef:acquisitionRef,receipt,sourceAvailable:false,selectionAvailable:false,cacheControl:'no-store',nonceConsumed:true,executionAuthorized:false,dispatchPerformed:false};
  });
  // RAM native 대역. 입력 해시를 그대로 권위로 반사하지 않고 이 fixture의 원 행/획득으로 별도 기대값을 구성한다.
  let acquisitionRef;
  const expectedMetadata=()=>({attribution:'SESSION_ONLY',projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration,requestRef:ref(777),acquisitionRef,contextBundleRef:context.contextBundleRef,initConfirmationRef:rows[1].ref,tailRef:rows[2].ref,ranges:[{outputRef:rows[2].ref,sequence:3,payloadDigest:rows[2].snapshot.payloadDigest,textBlocks:1,textBytes:Buffer.byteLength('선택된 이해 근거')}],wholeConversationComplete:false,executionAuthorized:false});
  const expectedBody=()=>canonicalJson({schemaVersion:1,kind:'DISCOVERY_METADATA',metadata:expectedMetadata()});
  let exactPrepared;
  stagePrepare=binding=>{
   assert.deepEqual(steps,['metadata-close','prepare']);
   const expected=expectedMetadata(),body=expectedBody();
   assert.deepEqual(binding,{attemptId:x.f.stored().attemptId,slotId:id(3),requestRef:expected.requestRef,acquisitionRef:expected.acquisitionRef,bodyHash:contentHash(body)});
   const resultTarget=executionTarget('POST',base+'/'+expected.requestRef.id+'/result',[],body);
   const proof={requestId:id(812),...resultTarget,grantRef:scope.grantRef,credentialGeneration:scope.credentialGeneration,serverNonce:Buffer.alloc(32,3).toString('base64url')};
   if(mode==='SEND_BAD_PROOF')proof.credentialGeneration++;
   const auth=Buffer.from(canonicalJson({schemaVersion:1,challengeRef:ref(813),proof,signature:Buffer.alloc(64,4).toString('base64url')})).toString('base64url');
   exactPrepared={attemptId:binding.attemptId,slotId:binding.slotId,requestRef:binding.requestRef,acquisitionRef:binding.acquisitionRef,preparedHash:contentHash('protected synthetic row'),auth};
   return {state:'NATIVE_DISCOVERY_RESULT_PREPARED',requestRef:binding.requestRef,acquisitionRef:binding.acquisitionRef,preparedHash:exactPrepared.preparedHash,auth,expiresAt:end};
  };
  stageSend=payload=>{
   assert.deepEqual(steps,['metadata-close','prepare','physical-close','send']);
   assert.deepEqual(payload,{...exactPrepared,body:expectedBody()});
   if(mode==='SEND_LOST')throw Error('SYNTHETIC_REPLY_LOST');
   return {unverified:'fixture'};
  };
  const handle=q.profile.handle;q.profile.handle=(v,...rest)=>{
   if(v.operation==='NORMAL_SPOOL_CLOSE'&&!v.payload.reservation){closed++;if(mode==='CLOSE_UNKNOWN')return{state:'UNKNOWN'};
    if(v.payload.understanding){
     steps.push('metadata-close');
     if(mode==='NATIVE_HOST_CLOSE'){const child=rest[0];child.stdin.end=(_a,_b,done)=>{queueMicrotask(()=>{child.stdout.emit('end');child.emit('close',1);done?.();});};}
     const request=v.payload.understanding,expected=expectedMetadata(),bodyHash=hash({schemaVersion:1,kind:'DISCOVERY_METADATA',metadata:expected});
     assert.deepEqual(request,{requestRef:expected.requestRef,acquisitionRef:expected.acquisitionRef,bodyHash});
     if(mode==='NATIVE_UNKNOWN')return{state:'UNKNOWN'};
     return{state:'CLOSED_CONFIRMED',understanding:{state:'NATIVE_METADATA_CLOSED',requestRef:expected.requestRef,acquisitionRef:expected.acquisitionRef,bodyHash:mode==='NATIVE_BODY'?'f'.repeat(64):bodyHash,...(mode==='NATIVE_EXTRA'?{verified:true}:{})}};
    }
   }return handle(v,...rest);
  };
  const before=x.m.calls.length,files=canonicalJson([...q.local.files].map(([p,f])=>[p,f.bytes.toString('base64')])),a=new AbortController();if(mode==='CANCELLED')a.abort();
  finishClose=()=>{
   if(mode==='SEND_CANCEL_CLOSE')a.abort();
   if(mode==='SEND_EXPIRE_CLOSE')x.advance(Date.parse(end)-x.clock());
  };
  const concurrent=[],phases=new Set();
  if(mode==='OK')x.m.onFrame(v=>{
   const phase=v.operation==='NORMAL_SPOOL_PROFILE_STATE'?'PRIVATE_READ':v.payload.request?.path?.endsWith('/understanding-response-read')?v.payload.kind:null;
   if(!phase||phases.has(phase))return;phases.add(phase);
   concurrent.push(assert.rejects(worker.discoverUnderstanding(a.signal)),assert.rejects(worker.run(a.signal)),assert.rejects(worker.renew(a.signal)));
  });
  // 최초 START 조회도 slot을 전달하므로, 늦은 open은 DISCOVERY 진입 이후에만 주입한다.
  discoveryStarted=true;
  if(terminal){
   const result=await worker.discoverUnderstanding(a.signal);assert.deepEqual(result,{kind:'NOT_ACQUIRED',status:mode==='GET_DENIED'?'DENIED':mode});
   assert.equal(closed,0);assert.equal(x.m.calls.slice(before).filter(v=>v.operation.startsWith('NORMAL_SPOOL_')).length,0);terminal=false;
  }
  if(['OK','NONE','DENIED','EXPIRED','GET_DENIED','SEND_ONCE','SEND_PROVIDER_MISSING'].includes(mode)){
   const result=await worker.discoverUnderstanding(a.signal);assert.equal(result.kind,'DISCOVERY');assert.equal(result.metadata.ranges.length,1);assert.equal(result.metadata.ranges[0].sequence,3);assert.deepEqual(result.metadata.initConfirmationRef,rows[1].ref);assert.deepEqual(result.metadata.tailRef,rows[2].ref);assert.equal(closed,2);await Promise.all(concurrent);
   const body=canonicalJson({schemaVersion:1,kind:'DISCOVERY_METADATA',metadata:result.metadata});
   assert.deepEqual(result.preparation,{state:mode==='SEND_ONCE'?'TRANSMISSION_UNCONFIRMED':'SIGNING_UNAVAILABLE',requestRef:result.metadata.requestRef,acquisitionRef:result.metadata.acquisitionRef,bodyHash:executionTarget('POST',base+'/'+result.metadata.requestRef.id+'/result',[],body).bodyHash,executionAuthorized:false,dispatchPerformed:false});
   assert.equal(Object.isFrozen(result.preparation),true);assert.equal(Object.isFrozen(result.preparation.acquisitionRef),true);
   const beforeForged=x.m.calls.length;
   await assert.rejects(x.pair.post.send(result.preparation,a.signal),/NORMAL_POST_PACKET_INVALID/);
   assert.equal('sendUnderstandingResult' in x.pair.post,false);
   assert.equal(x.m.calls.length,beforeForged);
   if(mode==='OK')assert.deepEqual([...phases],['PREPARE','REQUEST','PRIVATE_READ']);
   assert.equal(/선택된|session_id|plannedSid|private|cwd|textHash/.test(JSON.stringify(result)),false);
   const count=x.m.calls.length;await assert.rejects(worker.discoverUnderstanding(a.signal));assert.equal(x.m.calls.slice(count).filter(v=>v.operation.startsWith('NORMAL_SPOOL_')).length,0);
  }else{await assert.rejects(worker.discoverUnderstanding(a.signal));const count=x.m.calls.length;await assert.rejects(worker.discoverUnderstanding(a.signal));assert.equal(x.m.calls.length,count);}
  if(mode.startsWith('SEND_LATE_')){
   assert.equal(typeof releaseLate,'function');
   releaseLate();
   await new Promise(resolve=>setImmediate(resolve));
   assert.equal(lateClosed,1);
  }
  const calls=x.m.calls.slice(before);assert.equal(calls.filter(v=>v.payload.request?.method==='POST'||['NORMAL_SPOOL_ALLOCATE','NORMAL_SPOOL_RESERVE','NORMAL_SPOOL_SETTLE'].includes(v.operation)).length,0);
  if(sendMode)assert.equal(steps.filter(step=>step==='send').length,['SEND_ONCE','SEND_LOST'].includes(mode)?1:0);
  if(mode==='SEND_PROVIDER_MISSING')assert.deepEqual(steps,['metadata-close']);
  if(mode==='SEND_NEXT_PROVIDER_MISSING')assert.deepEqual(steps,['metadata-close','prepare','physical-close']);
  if(mode==='SEND_LATE_PARENT_OPEN')assert.deepEqual(steps,[]);
  if(mode==='SEND_LATE_NEXT_OPEN')assert.deepEqual(steps,['metadata-close','prepare','physical-close']);
  if(['PACKET','START','CONTEXT','REGISTRATION','CANCELLED'].includes(mode))assert.equal(calls.filter(v=>v.operation.startsWith('NORMAL_SPOOL_')).length,0);
  assert.equal(canonicalJson([...q.local.files].map(([p,f])=>[p,f.bytes.toString('base64')])),files);
  assert.equal(x.f.owner.isBusy(),false);assert.equal(x.f.timers(),0);
 }finally{x.source.dispose();fixtures.setFiles(undefined);}
});

test('FN09 native 목적 부정 응답은 exact TLS HTTP412 또는 정상 NONE만 값으로 보존 · 정적',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../../apps/connector/native/NormalExecutionCredentialSource.cs'),'utf8');
 assert.match(source,/sealed class DiscoveryRefusal:Dictionary/);
 assert.ok(source.includes('if(value is DiscoveryRefusal)return'));
 assert.match(source,/original.StatusCode!=HttpStatusCode.PreconditionFailed/);
 assert.match(source,/transport,status,challenge,nonceConsumed,executionAuthorized,dispatchPerformed/);
 assert.match(source,/code,message,requestId,targetId,retryDisposition,details/);
 assert.ok(source.includes('NORMAL_UNDERSTANDING_DISCOVERY_DENIED')&&source.includes('NORMAL_UNDERSTANDING_DISCOVERY_EXPIRED'));
 assert.ok(source.includes('NORMAL_UNDERSTANDING_NOT_ACQUIRED'));
 assert.ok(source.includes('req.AllowAutoRedirect=false;req.Proxy=null;req.UseDefaultCredentials=false;req.Credentials=null;'));
 assert.ok(source.includes('response.ResponseUri.AbsoluteUri!=S(record,"origin")+path+query'));
 assert.ok(source.includes('if(H(Record(Id(h,"attemptId")))!=recordHash||clock()>=end)throw Invalid();'));
});


test('FN09 raw result native Call은 출처 증명 없이 CA·challenge·서명 전에 거절 · 정적',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../../apps/connector/native/NormalExecutionCredentialSource.cs'),'utf8');
 const call=source.slice(source.indexOf('object Call(Dictionary<string,object> h,byte[] bodyBytes)'));
 const gate=call.indexOf('S(target,"path").StartsWith(Base(scope)+"/understanding-response-read/",StringComparison.Ordinal))throw Invalid();');
 assert.ok(gate>=0&&gate<call.indexOf('ProtectedStore.LoadNormalOwned'));
 assert.ok(gate<call.indexOf('ChallengeRequest(')&&gate<call.indexOf('Sign('));
});

test('FN09 native 원 획득과 원 파일 close가 목적 body 증거를 독립 도출 · 정적',()=>{
 const credential=fs.readFileSync(path.resolve(__dirname,'../../apps/connector/native/NormalExecutionCredentialSource.cs'),'utf8');
 const profile=fs.readFileSync(path.resolve(__dirname,'../../apps/connector/native/NormalExecutionSpoolProfileSource.cs'),'utf8');
 assert.match(credential,/ValidateUnderstandingPickup\(answer,record,slot,packet,target/);
 assert.ok(credential.includes('answer.ContainsKey("status")&&Object.Equals(answer["status"],"DISCOVERY_ACQUIRED")'));
 assert.match(profile,/UNDERSTANDING_PICKUP/);
 assert.match(profile,/UNDERSTANDING_READ_STARTED/);
 assert.match(profile,/UNDERSTANDING_READ_CLOSED/);
 assert.match(profile,/ReadUnderstandingOutput/);
 assert.ok(profile.includes('S(pickup,"pickupHost")==understandingHost'));
 assert.ok(profile.includes('Has(rows,"UNDERSTANDING_READ_STARTED",key)'));
 assert.ok(profile.includes('Unsettled(rows).Values.Any(r=>S(r,"allocation")==id)'));
 assert.ok(profile.includes('FileIdentity(file,path)!=identity'));
 assert.ok(profile.includes('cipher.Length>MaxEntry')&&profile.includes('ManagementHold(rows))>AdminCap'));
 assert.ok(credential.includes('new JsonKeys(text,64).Check()'));
 assert.ok(credential.includes('Double.IsNaN(n)||Double.IsInfinity(n)'));
 assert.ok(!profile.includes('H(message)'));
 assert.ok(profile.indexOf('var metadata=ReadUnderstandingOutput')<profile.indexOf('Append(log,rows,R("kind","UNDERSTANDING_READ_CLOSED"'));
 assert.match(profile,/metadataHash!=S\(purpose,"bodyHash"\)/);
 assert.match(profile,/Array.Clear\(bytes,0,bytes.Length\)/);
});

// C#은 실행하지 않는다. 작은 동일성 식을 원 source에서 꺼내 RAM 값으로 대조하며,
// 실제 DPAPI/파일/host 종료는 이 시험의 입증 범위가 아니다.
test('FN09 pickup exact replay 원 시각·보호 동일성·무쓰기 분기 · source RAM',()=>{
 const credential=fs.readFileSync(path.resolve(__dirname,'../../apps/connector/native/NormalExecutionCredentialSource.cs'),'utf8');
 const profile=fs.readFileSync(path.resolve(__dirname,'../../apps/connector/native/NormalExecutionSpoolProfileSource.cs'),'utf8');
 const validation=credential.slice(credential.indexOf('void ValidateUnderstandingPickup('),credential.indexOf('object Call(Dictionary'));
 assert.equal(validation.includes('At(receipt,"observedAt")<started'),false,'fresh HTTP 시작은 기존 protected pickup의 하한이 아니다');
 const expression=profile.match(/static bool SameUnderstandingPickup\([^\n]+\)\{\s*return ([\s\S]*?);\s*\}/)?.[1];assert.ok(expression);
 const hash=v=>contentHash(canonicalJson(v)),stamp=1000,expiry=3000;
 const record={attemptId:id(21)},slot={slotId:id(22)},requestRef=ref(23),acquisitionRef=ref(24),context={startCommandId:id(25)};
 const pickup={recordHash:hash(record),slotHash:hash(slot),attemptId:record.attemptId,requestRef,acquisitionRef,context,observedAt:stamp,expiresAt:expiry};
 const compare=new Function('S','H','J','Time','pickup','record','slot','requestRef','acquisitionRef','context','observed','expires','return '+expression.replaceAll('DesktopTrustKeyHostSource.Time','Time'));
 const check=(p=pickup,r=record,s=slot,q=requestRef,a=acquisitionRef,c=context,o=stamp,e=expiry)=>compare((v,k)=>v[k],hash,canonicalJson,(v,k)=>v[k],p,r,s,q,a,c,o,e);
 assert.equal(check(),true);
 for(const key of ['recordHash','slotHash','attemptId','requestRef','acquisitionRef','context','observedAt','expiresAt']){
  const changed=structuredClone(pickup);changed[key]=typeof changed[key]==='object'?{...changed[key],changed:true}:String(changed[key])+'changed';assert.equal(check(changed),false,key);
 }
 assert.equal(check(pickup,{attemptId:id(26)}),false);assert.equal(check(pickup,record,{slotId:id(26)}),false);
 const bind=profile.slice(profile.indexOf('internal void BindUnderstandingPickup('),profile.indexOf('Row ReadUnderstandingRow('));
 assert.ok(bind.includes('DesktopTrustKeyHostSource.Exact(pickup,'));
 const replay=bind.slice(bind.indexOf('if(pickup!=null)'),bind.indexOf('if(observed<started)'));
 assert.ok(replay.includes('SameUnderstandingPickup(')&&replay.includes('return true;'));
 assert.equal(/Append\(|pickup\[[^\]]+\]\s*=/.test(replay),false);
 assert.ok(bind.indexOf('expires<=DateTime.UtcNow')<bind.indexOf('if(pickup!=null)'));
 assert.ok(bind.includes('begun.Count!=1||closed.Count!=1'));
 assert.ok(bind.includes('S(closed[0],"pickupHash")!=H(pickup)'));
 const partial=bind.match(/if\((begun\.Count!=1[\s\S]*?)\)throw Invalid\(\);/)?.[1];assert.ok(partial);
 const incomplete=new Function('S','H','Time','begun','closed','pickup','expires','return '+partial.replaceAll('.Count','.length').replaceAll('DesktopTrustKeyHostSource.Time','Time'));
 const started={pickupHash:hash(pickup),host:id(29)},ended={...started,expiresAt:expiry};
 const bad=(begun,closed)=>incomplete((v,k)=>v[k],hash,(v,k)=>v[k],begun,closed,pickup,expiry);
 assert.equal(bad([started],[ended]),false);
 for(const [begun,closed] of [[[started],[]],[[],[ended]],[[started,started],[ended]],[[started],[{...ended,pickupHash:'f'.repeat(64)}]],[[started],[{...ended,host:id(30)}]],[[started],[{...ended,expiresAt:expiry+1}]]])assert.equal(bad(begun,closed),true);

 assert.ok(bind.indexOf('if(observed<started)')<bind.indexOf('Append(log,rows,R("kind","UNDERSTANDING_PICKUP"'));
 assert.ok(profile.includes('Has(rows,"UNDERSTANDING_READ_STARTED",key)'));
});

test('FN09 lower owned GET 동일 packet 명시 재확인은 원 응답·정상 host close만 반환 · RAM',async()=>{
 const f=await fixtures.liveNativeOwner(),base=f.dependencies.now();let offset=0;
 f.dependencies.now=()=>base+offset;f.ports.now=()=>base+offset;
 const m=model(f),port=await f.owner.createNormalCredentialBootstrap(m.config).bootstrap(new AbortController().signal),signal=new AbortController().signal;
 const target={method:'GET',path:'/api/v1/connectors/'+m.config.scope.connectorId+'/executions/'+m.config.scope.executionId+'/understanding-response-read',query:'',body:null,auth:Buffer.from(canonicalJson({proof:{requestId:id(6)}})).toString('base64url'),expiresAt:m.expiresAt};
 const receipt={kind:'NORMAL_UNDERSTANDING_DISCOVERY_ACQUIRED',binding:m.config.scope,credentialRef:ref(4),challengeRef:ref(5),packetHash:'a'.repeat(64),target:{method:'GET',path:target.path},requestId:id(6),understandingRequestRef:ref(777),context:{startCommandId:id(56)},observedAt:new Date(base).toISOString(),expiresAt:m.expiresAt};
 const response={transport:'NORMAL_PROTECTED',status:'DISCOVERY_ACQUIRED',proofResultRef:{...ref(783),contentHash:contentHash(canonicalJson(receipt))},receipt,sourceAvailable:false,selectionAvailable:false,cacheControl:'no-store',nonceConsumed:true,executionAuthorized:false,dispatchPerformed:false};
 // native 진위 검산은 위 source 검사와 구분한다. 이 RAM host는 수송/close만 대행한다.
 m.respond(()=>response);const before=m.calls.length,first=await port.requestUnderstandingDiscovery(target,signal);offset=10;
 const replay=await port.requestUnderstandingDiscovery(target,signal);assert.deepEqual(replay,first);assert.equal(replay.kind,'RESPONSE');assert.equal(replay.value.receipt.observedAt,new Date(base).toISOString());
 const calls=m.calls.slice(before);assert.equal(calls.length,2);assert.ok(calls.every(v=>v.operation==='NORMAL_EXECUTION_CALL'&&v.payload.kind==='REQUEST'));
 assert.deepEqual(calls[0].payload,calls[1].payload);assert.equal(f.ends(),f.calls());assert.equal(f.owner.isBusy(),false);assert.equal(f.timers(),0);
 const n=m.calls.length;offset=5001;await assert.rejects(port.requestUnderstandingDiscovery(target,signal));assert.equal(m.calls.length,n);
});
