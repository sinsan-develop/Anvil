'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const {canonicalJson,contentHash}=require('../../apps/desktop/src/runtime-catalogue-profile.cjs');
// 기존 실제 등록 owner/host-client fixture만 메모리 재사용. 기존 test는 등록/실행하지 않는다.
let fixtures;
test.before(async()=>{
 const file=require.resolve('./desktop-trust-registration.test.cjs'),m=new Module(file,module),before=[];
 const register=()=>{};register.before=fn=>before.push(fn);const original=Module.createRequire(file);
 m.filename=file;m.paths=module.paths;m.require=name=>name==='node:test'?register:original(name);
 m._compile(fs.readFileSync(file,'utf8')+'\nmodule.exports={liveNativeOwner,enrollmentFixture,setFiles(io){profileRamFiles=io;},get runtime(){return nativeRuntime;},get other(){return nativeRuntimeOther;}};',file);
 assert.equal(before.length,1);await before[0]();fixtures=m.exports;
});
const id=n=>'ce140001-0000-4000-8000-'+String(n).padStart(12,'0'),ref=n=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
function model(f,mode='NORMAL',profile=null){
 const row=f.stored(),scope={projectId:row.projectId,connectorId:row.registration.connectorRef.id,executionId:id(1),executionGeneration:1,grantRef:ref(2),credentialGeneration:1};
 const config={origin:row.origin,ca:'TEST_ONLY_EXPLICIT_CA',scope},calls=[],spawn=f.ports.spawn;let expiresAt=new Date(f.dependencies.now()+5000).toISOString();
 let metadata,reply,offset=0,onFrame=()=>{},respond;
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
   if(profile&&v.operation.startsWith('NORMAL_SPOOL_'))data=profile.handle(v,child,metadata);
   else if(v.operation==='NORMAL_EXECUTION_BOOTSTRAP'){assert.equal(v.payload.attemptId,row.attemptId);assert.deepEqual(v.payload.scope,scope);metadata={slotId:id(3),receiptRef:ref(4),origin:row.origin,scope,expiresAt,caHash:contentHash(config.ca)};data=metadata;}
   else if(v.operation==='NORMAL_EXECUTION_RENEW'){assert.equal(v.payload.attemptId,row.attemptId);assert.deepEqual(v.payload.previous,metadata);assert.ok(Date.parse(metadata.expiresAt)<=f.dependencies.now());expiresAt=new Date(f.dependencies.now()+5000).toISOString();metadata={...metadata,slotId:id(11),receiptRef:ref(12),expiresAt};data=mode==='RENEW_UNKNOWN'?{...metadata,caHash:'b'.repeat(64)}:metadata;}
   else if(v.operation==='NORMAL_EXECUTION_CALL'){assert.equal(v.payload.attemptId,row.attemptId);assert.equal(v.payload.slotId,metadata.slotId);const r=v.payload.request;reply=Buffer.from(canonicalJson(v.payload.kind==='PREPARE'?{path:r.path,query:r.query,auth:'A'.repeat(20),challengeRef:ref(5),requestId:id(6),expiresAt}:respond?respond(r,v.payload.body):mode==='PAIR'?typedReply(r):mode==='MAX'?{value:'x'.repeat(2812587-12)}:{commands:[]}));offset=0;data=chunk();}
   else if(v.operation==='NORMAL_EXECUTION_READ'){assert.equal(v.payload.handle,id(7));assert.equal(v.payload.offset,offset);data=chunk();}
   else throw Error('UNEXPECTED_NORMAL_OPERATION');
   child.stdout.emit('data',Buffer.from(canonicalJson({schemaVersion:1,purpose:'DESKTOP_TRUST_KEY_RESULT_V1',requestId:v.requestId,sequence:v.sequence,rootIdentity:mode==='ROOT'?'OTHER_ROOT':'TEST_ONLY_ROOT',data})+'\n'));done();
  });return true;
 };if(mode==='CLOSE'){child.stdin.end=(_a,_b,done)=>{queueMicrotask(()=>{child.stdout.emit('end');child.emit('close',1);done?.();});};}return child;};
 return{config,calls,expiresAt,respond(fn){respond=fn;},onFrame(fn){onFrame=fn;},request:{method:'GET',path:'/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/commands',query:'',body:null,expiresAt}};
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

async function pollingFixture(profile=null,workerOptions=false){
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
 const seen={permits:0,wires:0,events:[],loseAck:false};
 m.respond((r,body)=>{
  const result={transport:'NORMAL_PROTECTED',proofResultRef:ref(59),cacheControl:'no-store',nonceConsumed:true,executionAuthorized:false,dispatchPerformed:false};
  const observedAt=new Date(clock()).toISOString(),expiresAt=new Date(clock()+5000).toISOString();
  if(r.path.endsWith('/commands'))return {...result,items:[item],nextCursor:'cursor1',hasMore:false,observedAt,expiresAt};
  const i=groups.findIndex(g=>r.path.endsWith('/materials/'+g.parts[0].materialId));
  if(i>=0){const g=groups[i],p=g.parts[0];return {...result,observedAt,expiresAt,material:{materialId:p.materialId,sourceRef:g.sourceRef,partIndex:1,partCount:1,contentHash:p.contentHash,bytes:Buffer.from(bodies[i]).toString('base64url')}};}
  if(r.path.endsWith('/permit')){seen.permits++;return {...result,...(seen.largePermit?{padding:'x'.repeat(2700000)}:{}),executionAuthorized:true,permit:{ref:ref(60),commandId:envelope.commandId,envelopeHash:envelope.envelopeHash,issuedAt:observedAt,expiresAt}};}
  assert.ok(r.path.endsWith('/observations'));const {events}=JSON.parse(body);seen.events=events;
  const snapshot={execution:local,highestContiguous:events.length,maxSequence:events.length,contiguousDigest:events.reduce((previous,e)=>hash({previous,eventHash:hash(e)}),hash([])),gaps:[],storedCount:events.length,writerReleaseVerified:false,executionAuthorized:false,dispatchPerformed:false,recordedAt:observedAt};
  return {...result,ack:seen.loseAck?null:{ref:{...ref(61),contentHash:hash(snapshot)},snapshot}};
 });
 const current={transport:'NORMAL_PROTECTED',async current(e,attempt){return {transport:'NORMAL_PROTECTED',key:{...local,commandId:e.commandId},envelopeHash:e.envelopeHash,grantRef:scope.grantRef,localAttemptRef:attempt,sourceObservationRefs:[ref(47)],osOwnershipRef:ref(62),checkedAt:new Date(clock()).toISOString(),expiresAt:new Date(clock()+5000).toISOString()};}};
 const wire={transport:'NORMAL_PROTECTED',async send(value){seen.wires++;assert.equal(Buffer.from(value.options.bytes).toString(),bodies[1]);return {transport:'NORMAL_PROTECTED',responseRef:ref(63),processRef:null};}};
 const input={expected,intakeStore:store.intake(),journalStore:store,current,wire,timeoutMs:1000,deadline:clock()+30000,maxPages:1,idleMs:1};
 const source=profile?f.owner.createProfileExecutionClients(m.config):f.owner.createNormalExecutionClients(m.config),pair=await source.bootstrap(signal);
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
