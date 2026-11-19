'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const read=p=>readFileSync(path.resolve(__dirname,'../../',p),'utf8');
test('native 원 FIRST3 판독은 두 채널의 최근 정산·정확 3행/원바이트·참조연쇄를 검사하는 읽기 전용 경로다',()=>{
  const file=read('apps/connector/native/NormalExecutionSpoolProfileSource.cs');
  const part=file.slice(file.indexOf('internal string ReadSdkFirstAttempt('),file.indexOf('static Row LastOutputPhase('));
  assert.match(part,/Log\(false,[\s\S]*Has\(rows,"REGISTERED",H\(record\)\)[\s\S]*S\(r,"slotHash"\)==H\(slot\)[\s\S]*Allocate\(rows,log,Normal,tuple,true\)/);
  assert.match(part,/OutputScope\(scope,rows,allocation,record,slot\)[\s\S]*startCommand,true[\s\S]*sendCommand,false/);
  assert.match(part,/Unsettled\(rows\)[\s\S]*"SETTLED"[\s\S]*N\(summary\["count"\]\)!=3[\s\S]*Inspect\(/);
  assert.match(part,/FileMode.Open,FileAccess.Read,FileShare.Read[\s\S]*FileIdentity\(f,path\)[\s\S]*DesktopTrustKeyHostSource.Parse\(bytes,true\)/);
  assert.match(part,/S\(reference,"contentHash"\)!=H\(snapshot\)[\s\S]*J\(snapshot\["previousRef"\]\)!=J\(previous\)/);
  assert.match(part,/hashes\[2\]!=S\(summary,"tail"\)/);
  assert.doesNotMatch(part,/Append\(|FileMode.Create|FileAccess.Write/);
});
test('원 slot 재판독과 cwd·env 권위 부재 거절은 신규 SDK/CLI 실행을 발급하지 않는다',()=>{
  const src=read('apps/connector/native/NormalExecutionCredentialSource.cs');
  const fn=src.slice(src.indexOf('internal object InspectSdkFirst'),src.indexOf('internal sealed class RowRequest'));
  assert.match(fn,/Record\(request.AttemptId\)[\s\S]*LoadSlot\(request.SlotId,record\)[\s\S]*ReadSdkFirstAttempt[\s\S]*Acquire\(peer\)[\s\S]*H\(LoadSlot\(request.SlotId,record\)\)!=H\(slot\)[\s\S]*ReadSdkFirstAttempt[\s\S]*SDK_CONFIGURATION_UNAVAILABLE/);
  assert.doesNotMatch(fn,/CreateProcess|ResumeThread|Process.Start|CLOSED_CONFIRMED/);
});

test('등록 전 SDK bootstrap은 별도 고정 mode에서 원 peer/package만 검산하고 등록 root를 만들지 않는다',()=>{
 const code=read('apps/connector/native/DesktopTrustKeyHostSource.cs');
 assert.match(code,/args.Length==1&&args\[0\]=="--normal-sdk-bootstrap"/);
 const body=code.slice(code.indexOf('internal async Task<int> RunSdkBootstrapAsync()'),code.indexOf('void Check()'));
 assert(body.length>0);
 assert.match(body,/DesktopTrustKeyPeerSource.Open[\s\S]*NormalSdkWorkerPackageSource.Acquire[\s\S]*ExecutionRecipe/);
 assert.match(body,/SDK_BOOTSTRAP_PREPARE[\s\S]*SDK_BOOTSTRAP_ACCEPT/);
 assert.doesNotMatch(body,/RootSource.Open|IssueFreshRoot|BindingStore|Dispatch\(|CreateKey|CreateProcess|ReadSdkFirstAttempt/);
 assert.match(body,/package.Dispose\(\)/);
});

const {EventEmitter}=require('node:events');
const {createHash,randomUUID}=require('node:crypto');
const {canonicalJson}=require('../../apps/desktop/src/runtime-catalogue-profile.cjs');
const {createSdkBootstrapClient}=require('../../apps/desktop/src/trust-key-host-client.cjs');
function bootstrapCarrier(change=x=>x){
 const image=Buffer.from('synthetic-helper'),sha=createHash('sha256').update(image).digest('hex'),calls=[];
 const endpoint={stdin:new EventEmitter(),stdout:new EventEmitter(),stderr:new EventEmitter()};Object.setPrototypeOf(endpoint,EventEmitter.prototype);EventEmitter.call(endpoint);
 let seq=0;endpoint.stdin.write=(bytes,_encoding,callback)=>{const f=JSON.parse(bytes.toString());calls.push(f.operation);seq++;let data;
  if(f.operation==='SDK_BOOTSTRAP_PREPARE')data={state:'SDK_BOOTSTRAP_PREPARED',...f.payload,manifestHash:'a'.repeat(64),recipeRef:{id:randomUUID(),version:1,contentHash:'b'.repeat(64)},expiresAt:new Date(end).toISOString()};
  else data={state:'SDK_BOOTSTRAP_ACCEPTED',...f.payload};
  queueMicrotask(()=>{callback();endpoint.stdout.emit('data',Buffer.from(canonicalJson({schemaVersion:1,purpose:'DESKTOP_TRUST_KEY_RESULT_V1',requestId:f.requestId,sequence:seq,rootIdentity:'SDK_BOOTSTRAP',data:change(data)})+'\n'));});return true;
 };
 endpoint.stdin.end=()=>queueMicrotask(()=>endpoint.emit('close',0));
 const abort=new AbortController();let end=Date.now()+9000;
 const lease={signal:abort.signal,narrow:value=>{end=Math.min(end,value);},check(){if(abort.signal.aborted)throw Error('CONTEXT_CHANGED');},remainingMs:()=>end-Date.now(),callExpiresAt:()=>new Date(end).toISOString()};
 const client=createSdkBootstrapClient({path:'C:\\Anvil\\AnvilTrustKeyHost.exe',signerRef:{id:randomUUID(),version:1,contentHash:sha},helperHash:sha},{readImage:async()=>Buffer.from(image),companion:async()=> 'ABSENT',environment:()=>({SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'}),uuid:randomUUID,spawn:(_exe,args)=>{assert.deepEqual(args,['--normal-sdk-bootstrap']);return endpoint;}});
 return{client,lease,calls,abort};
}
test('원 bootstrap 채널만 같은 endpoint·epoch에서 한 번 수령하고 확정 폐쇄한다',async()=>{
 const m=bootstrapCarrier(),lease=await m.client.open(m.lease,4),proof=lease.read();assert.equal(proof.epoch,4);
 await lease.accept();await assert.rejects(lease.accept());assert.equal((await lease.close()).state,'CLOSED_CONFIRMED');assert.throws(()=>lease.read());
 assert.deepEqual(m.calls,['SDK_BOOTSTRAP_PREPARE','SDK_BOOTSTRAP_ACCEPT']);await assert.rejects(m.client.open(m.lease,4));
});
test('bootstrap 교차 endpoint·세대·불명 recipe는 수령0이며 취소 뒤 다시 열지 않는다',async()=>{
 for(const change of [x=>({...x,endpointId:randomUUID()}),x=>({...x,epoch:x.epoch+1}),x=>({...x,recipeRef:null})]){
  const m=bootstrapCarrier(change);await assert.rejects(m.client.open(m.lease,4));assert.deepEqual(m.calls,['SDK_BOOTSTRAP_PREPARE']);
 }
 const m=bootstrapCarrier(),lease=await m.client.open(m.lease,4);m.abort.abort();assert.throws(()=>lease.read());await assert.rejects(lease.accept());await lease.close();assert.deepEqual(m.calls,['SDK_BOOTSTRAP_PREPARE']);
});

const {createRegistrationSessionEndpoint,createRegistrationWorkerChannel,createWorkerRegistrationClient}=require('../../apps/desktop/src/normal-sdk-worker-entry.cjs');
async function registrationEndpoint(session,context){const m=bootstrapCarrier(),original=await m.client.open(m.lease,4);await original.accept();const endpoint=createRegistrationSessionEndpoint(original,session,context);assert.equal((await original.close()).state,'CLOSED_CONFIRMED');return endpoint;}
function registrationHuman(){
 const id='11111111-1111-4111-8111-111111111111',now=Date.now(),fp='a'.repeat(64),policy={id,version:1,contentHash:'b'.repeat(64)};
 const scope={kind:'HOST_TRUST_REGISTRATION',installationId:id,projectId:id,subject:{kind:'HUMAN',userId:id,clientId:id,credentialGeneration:1,controlGeneration:1},policyRef:policy,expectedHostFingerprint:fp,hostLabel:'합성 등록',expiresAt:new Date(now+60000).toISOString(),credentialScope:'REGISTRATION_STATUS_ONLY',grants:[]};
 const hash=v=>createHash('sha256').update(canonicalJson(v)).digest('hex'),digest=hash(scope),state='CREATED',version=1;
 return{registrationRef:{id,version,contentHash:hash({registrationId:id,version,state,scopeDigest:digest})},connectorRef:{id,version:7,contentHash:hash({connectorId:id,registrationId:id,scopeDigest:digest,generation:7})},scopeDigest:digest,grants:[],executionAuthorized:false,
 projectId:id,hostLabel:scope.hostLabel,state,connectorState:'REGISTRATION_PENDING',derivedExpired:false,expiresAt:scope.expiresAt,proofedAt:null,revokedAt:null,expectedHostFingerprint:fp,observedHostFingerprint:null,scope,policyRef:policy,createdAt:new Date(now).toISOString(),issuedAt:null,failedAttempts:0,credential:{issued:false,expiresAt:null,revokedAt:null,status:'NOT_ISSUED'},basis:{current:true,reasons:[]},confirmation:{allowed:false,reasons:['PROOF_NOT_READY']},observedAt:new Date(now).toISOString()};
}
function registrationLease(){const abort=new AbortController();let end=Date.now()+8000;return{abort,lease:{signal:abort.signal,check(){if(abort.signal.aborted||Date.now()>=end)throw Error('CONTEXT_CHANGED');},callExpiresAt:()=>new Date(end).toISOString(),narrow:n=>{end=Math.min(end,n);}}};}
test('원 bootstrap을 소비한 전용 Session endpoint만 기존 등록 GET을 원 origin·lease로 중계한다',async()=>{
 const human=registrationHuman(),calls=[],context={origin:'https://project.invalid',identity:'view-1',authEpoch:2};
 const session={fetch:async function(url,options){assert.equal(this,session);calls.push(url);assert.equal(url,context.origin+'/api/v1/projects/'+human.projectId+'/connector-registrations/'+human.registrationRef.id);assert.equal(options.method,'GET');assert.equal(options.credentials,'include');return new Response(JSON.stringify(human),{headers:{'content-type':'application/json'}});}};
 const bridge=await registrationEndpoint(session,()=>context),worker=createRegistrationWorkerChannel(bridge.port),owned=registrationLease();
 try{const client=createWorkerRegistrationClient(bridge.endpoint,worker,owned.lease);assert.deepEqual(await client.human(human.projectId,human.registrationRef.id),human);assert.equal(calls.length,1);}finally{worker.close();bridge.close();}
 assert.throws(()=>createRegistrationSessionEndpoint({},session,()=>context));
});
test('등록 Session endpoint는 원 auth 문맥 변경 후 늦은 200/401을 폐기하고 임의 요청을 중계하지 않는다',async()=>{
 for(const status of [200,401]){
  const human=registrationHuman();let epoch=2,release;const pending=new Promise(resolve=>{release=resolve;});let fetched=false;
  const session={fetch:async()=>{fetched=true;await pending;return new Response(JSON.stringify(status===200?human:{code:'AUTH_REQUIRED'}),{status,headers:{'content-type':'application/json'}});}};
  const context=()=>({origin:'https://project.invalid',identity:'view-1',authEpoch:epoch});
  const bridge=await registrationEndpoint(session,context),worker=createRegistrationWorkerChannel(bridge.port),owned=registrationLease();
  try{const client=createWorkerRegistrationClient(bridge.endpoint,worker,owned.lease),result=client.human(human.projectId,human.registrationRef.id);while(!fetched)await new Promise(resolve=>setImmediate(resolve));epoch++;release();await assert.rejects(result,/CONTEXT_CHANGED/);}finally{worker.close();bridge.close();}
 }
 let calls=0;const context=()=>({origin:'https://project.invalid',identity:'view-1',authEpoch:2}),bridge=await registrationEndpoint({fetch:async()=>{calls++;throw Error('MUST_NOT_CALL');}},context),worker=createRegistrationWorkerChannel(bridge.port);
 try{await assert.rejects(worker.request({...bridge.endpoint,operationId:randomUUID(),deadline:Date.now()+8000,method:'fetch',args:['https://other.invalid']}));assert.equal(calls,0);}finally{worker.close();bridge.close();}
});

test('등록 endpoint는 원 package 채널이 열린 수령 직후에만 생성되고 폐쇄 뒤 재사용은 거절한다',async()=>{
 const context=()=>({origin:'https://project.invalid',identity:'view-1',authEpoch:2}),session={fetch:async()=>{throw Error('MUST_NOT_CALL');}};
 const m=bootstrapCarrier(),cap=await m.client.open(m.lease,4);await cap.accept();let endpoint;
 try{endpoint=createRegistrationSessionEndpoint(cap,session,context);assert.throws(()=>createRegistrationSessionEndpoint(cap,session,context));}finally{endpoint?.close();await cap.close();}
 const n=bootstrapCarrier(),closed=await n.client.open(n.lease,4);await closed.accept();await closed.close();assert.throws(()=>createRegistrationSessionEndpoint(closed,session,context));
});

test('등록 endpoint는 생성 때 원 Session transport를 보존하고 교체 뒤 GET을 발행하지 않는다',async()=>{
 const human=registrationHuman();let calls=0;const session={fetch:async()=>{calls++;return new Response(JSON.stringify(human),{headers:{'content-type':'application/json'}});}},context=()=>({origin:'https://project.invalid',identity:'view-1',authEpoch:2});
 const bridge=await registrationEndpoint(session,context),worker=createRegistrationWorkerChannel(bridge.port),owned=registrationLease();
 try{const client=createWorkerRegistrationClient(bridge.endpoint,worker,owned.lease);session.fetch=async()=>{calls++;throw Error('MUST_NOT_CALL');};await assert.rejects(client.human(human.projectId,human.registrationRef.id),/CONTEXT_CHANGED/);assert.equal(calls,0);}finally{worker.close();bridge.close();}
});

test('worker 등록 변이는 원 lease에 송신을 표시하며 표시 실패 때 중계를 시작하지 않는다',async()=>{
 const events=[],endpoint={endpointId:randomUUID(),epoch:4},owned=registrationLease(),channel={request:async()=>{events.push('SEND');return{ok:false,code:'OUTCOME_UNKNOWN'};},cancel:()=>{}};
 const lease={...owned.lease,markEffect:()=>events.push('EFFECT')},client=createWorkerRegistrationClient(endpoint,channel,lease);
 await assert.rejects(client.enroll({},{}),/OUTCOME_UNKNOWN/);assert.deepEqual(events,['EFFECT','SEND']);
 events.length=0;const denied=createWorkerRegistrationClient(endpoint,channel,{...owned.lease,markEffect:()=>{throw Error('CONTEXT_CHANGED');}});await assert.rejects(denied.enroll({},{}),/CONTEXT_CHANGED/);assert.equal(events.length,0);
});

test('등록 endpoint의 끝난 요청은 native host frame 한도로 누적 제한하지 않는다',async()=>{
 const human=registrationHuman();let calls=0;const session={fetch:async()=>{calls++;return new Response(JSON.stringify(human),{headers:{'content-type':'application/json'}});}},context=()=>({origin:'https://project.invalid',identity:'view-1',authEpoch:2});
 const bridge=await registrationEndpoint(session,context),worker=createRegistrationWorkerChannel(bridge.port),owned=registrationLease();
 try{const client=createWorkerRegistrationClient(bridge.endpoint,worker,owned.lease);for(let i=0;i<65;i++)await client.human(human.projectId,human.registrationRef.id);assert.equal(calls,65);}finally{worker.close();bridge.close();}
});
