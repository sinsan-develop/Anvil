'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const read=p=>readFileSync(path.resolve(__dirname,'../../',p),'utf8');

test('FIRST 보호 설정은 원 환경의 유일 현재 head와 저장 원 그래프를 재판독하고 원 cwd 핀을 보유한다',()=>{
 const config=read('apps/connector/native/NormalExecutionConfigurationSource.cs');
 const consume=read('apps/connector/native/NormalExecutionCredentialSource.cs');
 assert.match(consume,/using\(var configuration=source.PinFirst\(inspected,package\)\)[\s\S]*configuration.Check\(\)/);
 assert.match(config,/internal FirstConfiguration PinFirst\(/);
 assert.match(config,/internal Row UniqueFirstEnvelope\(/);
 assert.match(config,/candidates.Length!=1/);
 assert.match(config,/Graph\(Map\(envelope\["environment"\]\),Map\(envelope\["profile"\]\)/);
 assert.match(config,/pins=new DirectoryPins\(peer,[\s\S]*pins.Require\(envelope\["physical"\]\)/);
 assert.match(config,/headHash!=Hash\(records.UniqueFirstEnvelope\(fact,original,recipe\)\)/);
 assert.match(config,/package.Check\(\);pins.Check\(\);check\(\)/);
 const method=config.slice(config.indexOf('internal Row UniqueFirstEnvelope('),config.indexOf('internal Row Head('));
 assert.doesNotMatch(method,/New\(|Open\(true\)|Confirm\(|Revoke\(|OrderByDescending/);
 assert.doesNotMatch(consume,/new NormalSdkChildHostSource|CreateProcess|ResumeThread/);
});

test('FIRST 설정 재판독은 원 검산 객체와 기한에 묶이고 원문 대신 hash만 임시 수집한다',()=>{
 const config=read('apps/connector/native/NormalExecutionConfigurationSource.cs');
 const consume=read('apps/connector/native/NormalExecutionCredentialSource.cs');
 assert.match(config,/PinFirst\(NormalExecutionCredentialSource.FirstInspection inspected,/);
 assert.match(config,/Hash\(original\)!=inspected.RecordHash/);
 assert.match(config,/wall\(\)>=expires/);
 assert.match(config,/Scan\(bool firstHashes=false\)/);
 assert.match(config,/if\(firstHashes\)result.envelopeHashes.Add/);
 assert.doesNotMatch(config,/Dictionary<string,Row> envelopes/);
 assert.match(config,/Hash\(envelope\)!=envelopeHash/);
 assert.match(config,/heads.Where\(r=>S\(r,"state"\)=="CONFIRMED"&&Same\(r\["environmentRef"\],environmentRef\)/);
 assert.match(config,/group.Single\(r=>DesktopTrustKeyHostSource.Positive\(r\["revision"\]\)==revision\)/);
 assert.match(config,/S\(d,"access"\)=="READ"/);
 assert.match(config,/if\(closed\)throw Invalid\(\)/);
 assert.match(config,/public void Dispose\(\)\{if\(closed\)return;closed=true;pins.Dispose\(\);\}/);
 assert.match(consume,/final.CanonicalSource!=inspected.CanonicalSource[\s\S]*configuration.Check\(\);originalCheck\(\)/);
 assert.match(consume,/return new Dictionary<string,object>\{\{"state","SDK_CONFIGURATION_UNAVAILABLE"\}\}/);
});

test('FIRST 보호 인계는 원 core에서 native 읽기 검사로만 소비하고 FIRST3와 C hash를 독립 대조한다',()=>{
 const runtime=read('apps/connector/runtime/normal-owned-spool-profile.ts');
 assert.match(runtime,/takeNormalFirstPermitHandoff\(request,source\)/);
 assert.match(runtime,/await this\.#inspectFirst\(handoff,life,verify\)/);
 const host=read('apps/connector/native/DesktopTrustKeyHostSource.cs');
 assert.match(host,/value.ContainsKey\("transferId"\)[\s\S]*ReceiveSdkFirstPart\(value,peer\)/);
 const credential=read('apps/connector/native/NormalExecutionCredentialSource.cs');
 assert.match(credential,/sealed class FirstInspection/);
 assert.match(credential,/S\(permitRef,"contentHash"\)!=H\(snapshot\)/);
 assert.match(credential,/J\(scope\)!=J\(expectedScope\)/);
 assert.match(credential,/J\(snapshot\["authorizationReceiptRef"\]\)!=J\(context\["authorizationReceiptRef"\]\)/);
 assert.match(credential,/J\(snapshot\["reservationRef"\]\)!=J\(context\["budgetRef"\]\)/);
 assert.match(credential,/firstConsumed=true;unknown=true;ClearFirst\(\);throw/);
 assert.match(credential,/public void Dispose\(\)[^\n]*ClearFirst\(\)/);
 assert.match(host,/normalExecution.IncompleteSdkFirstTransfer/);
 assert.match(host,/normalExecution.HasSdkFirstTransfer&&\(operation!="NORMAL_SDK_FIRST_INSPECT"/);
 const spool=read('apps/connector/native/NormalExecutionSpoolProfileSource.cs');
 assert.match(spool,/RequireSdkFirst\(snapshot,reference,handoff,start,i\)/);
 assert.doesNotMatch(credential,/new NormalSdkChildHostSource|CreateProcess|ResumeThread/);
});

test('SDK 원 child 소유 primitive는 atomic Job와 자식 stdio 세 끝만 생성 전에 결박한다',()=>{
 const source=read('apps/connector/native/NormalSdkChildHostSource.cs');
 const create=source.slice(source.indexOf('void CreateSuspended()'),source.indexOf('void VerifyOriginal('));
 assert.match(create,/attempted=true[\s\S]*CreateJobObjectW[\s\S]*ActiveProcessLimit=1/);
 assert.match(create,/new IntPtr\(0x00020002\)[\s\S]*new IntPtr\(0x0002000D\)[\s\S]*CreateProcessW/);
 assert.match(create,/Marshal.WriteIntPtr\(handles,stdinRead\)[\s\S]*Marshal.WriteIntPtr\(handles,IntPtr.Size,stdoutWrite\)[\s\S]*Marshal.WriteIntPtr\(handles,IntPtr.Size\*2,stderrWrite\)/);
 assert.match(create,/created=ok\|\|original.Process!=IntPtr.Zero\|\|original.Thread!=IntPtr.Zero\|\|original.Pid!=0\|\|original.Tid!=0;[\s\S]*if\(!created\)\{creationRejected=true;throw Invalid\(\);\}[\s\S]*VerifyOriginal\(true\)/);
 assert.doesNotMatch(source,/AssignProcessToJobObject|OpenProcess|GetEnvironmentVariables|Process\.Start|Console\.|public static/);
 assert.match(require('../../apps/desktop/scripts/desktop-trust-key-host-build.cjs').SOURCE_FILES.join('\n'),/apps\/connector\/native\/NormalSdkChildHostSource\.cs/);
});

test('SDK 원 child 소유 primitive는 원 핸들 검산 뒤 resume·stdio 인계를 각 한 번만 허용한다',()=>{
 const source=read('apps/connector/native/NormalSdkChildHostSource.cs');
 assert.match(source,/void VerifyOriginal\(bool first\)[\s\S]*GetProcessId\(original.Process\)[\s\S]*GetProcessIdOfThread\(original.Thread\)[\s\S]*GetThreadId\(original.Thread\)[\s\S]*GetProcessTimes[\s\S]*GetThreadTimes[\s\S]*IsProcessInJob[\s\S]*Members\(\)!=1[\s\S]*QueryFullProcessImageNameW/);
 const resume=source.slice(source.indexOf('void ResumeOriginal()'),source.indexOf('StreamSet TakeStreams()'));
 assert.match(resume,/resumeAttempted=true;[\s\S]*Check\(\);VerifyOriginal\(false\);Check\(\);[\s\S]*ResumeThread\(original.Thread\)!=1[\s\S]*resumed=true/);
 assert.match(source,/if\(streamsTaken\|\|!resumed\)[\s\S]*streamsTaken=true/);
 assert.match(source,/cancellation.IsCancellationRequested[\s\S]*watch.Elapsed.TotalMilliseconds>=budgetMs/);
 assert.match(source,/package.Check\(\);directories.Check\(\)/);
 assert.match(source,/if\(returned<8\|\|returned>\(uint\)bytes\)throw Invalid\(\);[\s\S]*Marshal.ReadInt32\(buffer\)[\s\S]*returned<\(uint\)\(8\+count\*IntPtr.Size\)[\s\S]*Marshal.ReadIntPtr\(buffer,8\)/);
 assert.match(resume,/catch\{unknown=true;Dispose\(\);throw;\}/);
 // 원 lease 소비자는 다음 구간이다. 임의 callback/JSON 또는 공개 factory로 기술 primitive를 활성화하지 않는다.
 assert.match(source,/private NormalSdkChildHostSource\(/);
 assert.doesNotMatch(source,/internal static .*Create|internal .*Open\(/);
});

test('SDK 원 child 소유 primitive는 종료 불명과 닫힘 실패의 원 핸들을 보존한다',()=>{
 const source=read('apps/connector/native/NormalSdkChildHostSource.cs');
 assert.match(source,/WaitForSingleObject\(original.Process,0\)[\s\S]*GetExitCodeProcess\(original.Process,out code\)/);
 assert.match(source,/TerminateProcess\(original.Process/);
 assert.match(source,/if\(!CloseHandle\(handle\)\)[\s\S]*return;[\s\S]*handle=IntPtr.Zero/);
 const dispose=source.slice(source.indexOf('public void Dispose()'));
 assert.match(dispose,/if\(cleanupAttempted\)[\s\S]*cleanupAttempted=true/);
 assert.match(dispose,/CloseOwned\(ref stdinRead[\s\S]*CloseOwned\(ref stdoutWrite[\s\S]*CloseOwned\(ref stderrWrite/);
 assert.match(dispose,/if\(created&&!exitConfirmed\)[\s\S]*failed=true/);
 assert.match(dispose,/if\(exitConfirmed&&streams.Input!=null\)/);
 assert.match(dispose,/if\(failed\)[\s\S]*unconfirmed.Add\(this\)[\s\S]*throw Unknown\(\)/);
 assert.doesNotMatch(dispose,/original=default|unconfirmed.Clear|GC.Collect/);
});
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
function bootstrapCarrier(change=x=>x,normal=false){
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
 const factory=normal?require('../../apps/desktop/src/trust-key-host-client.cjs').createTrustKeyHostClient:createSdkBootstrapClient;
 const client=factory({path:'C:\\Anvil\\AnvilTrustKeyHost.exe',signerRef:{id:randomUUID(),version:1,contentHash:sha},helperHash:sha},{readImage:async()=>Buffer.from(image),companion:async()=> 'ABSENT',environment:()=>({SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'}),uuid:randomUUID,spawn:(_exe,args)=>{assert.deepEqual(args,normal?[]:['--normal-sdk-bootstrap']);return endpoint;}});
 return{client,lease,calls,abort,child:endpoint};
}

test('FIRST 읽기 수송 예산은 실제 채널의 선행 READ_STATE PUBLIC_KEY 사용분을 제외한다',async()=>{
 const fixture=bootstrapCarrier(x=>x,true),channel=await fixture.client.open(fixture.lease);
 try{
  assert.equal(channel.inspectionBudget().frames,64);
  await channel.send('READ_STATE',{});await channel.send('PUBLIC_KEY',{});
  assert.equal(channel.inspectionBudget().frames,62);assert(channel.inspectionBudget().remainingMs>0);
  await channel.send('NORMAL_SDK_FIRST_INSPECT',{});assert.equal(channel.inspectionBudget().frames,61);
  assert.deepEqual(fixture.calls,['READ_STATE','PUBLIC_KEY','NORMAL_SDK_FIRST_INSPECT']);
 }finally{assert.equal((await channel.close()).state,'CLOSED_CONFIRMED');}
 assert.throws(()=>channel.inspectionBudget());
});
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

test('등록 session은 설정과 첫 수신을 같은 원 owner에 보유하고 미등록에는 보호 기능을 열지 않는다',async()=>{
 const {createTrustEnrollmentSession}=require('../../apps/desktop/src/trust-enrollment-owner.cjs');
 const session=createTrustEnrollmentSession(()=>({origin:'https://project.invalid',identity:'one',authEpoch:1}),null);
 assert.equal(session.getState().attemptId,null);assert.equal(session.isBusy(),false);
 const result=await session.handleReceive('native-receive-status',{attemptId:randomUUID(),epoch:1});assert.equal(result.ok,false);
 assert.equal((await session.configuration('PREPARE',{attemptId:randomUUID(),epoch:1,selection:{}})).ok,false);
 assert.equal('createNativeFirstReceiveReceiver'in session,false);assert.equal('createExecutionConfigurationController'in session,false);
 session.invalidate();assert.equal(session.getState().attemptId,null);
});

test('열린 package 채널의 조기 종료 뒤에는 원 endpoint를 발급하지 않는다',async()=>{
 const m=bootstrapCarrier(),original=await m.client.open(m.lease,4);await original.accept();
 m.child.emit('close',0);
 assert.throws(()=>require('../../apps/desktop/src/trust-key-host-client.cjs').takeSdkBootstrapEndpoint(original),/PROTECTION_UNAVAILABLE|OUTCOME_UNKNOWN/);
 assert.equal((await original.close()).state,'UNKNOWN');
});

function isolatedWorkerFixture(closeState='CLOSED_CONFIRMED'){
 const Module=require('node:module'),threads=require('node:worker_threads'),instances=[],owners=[];
 const compile=(name,overrides)=>{const file=require.resolve('../../apps/desktop/src/'+name),loaded=new Module(file,module),base=Module.createRequire(file);loaded.filename=file;loaded.paths=module.paths;loaded.require=id=>Object.hasOwn(overrides,id)?overrides[id]:base(id);loaded._compile(readFileSync(file,'utf8'),file);return loaded.exports;};
 const realOwner=require('../../apps/desktop/src/trust-enrollment-owner.cjs'),dependencies=[];
 const deps={uuid:randomUUID,now:Date.now,monotonic:()=>performance.now(),schedule:(f,ms)=>{const timer=setTimeout(f,ms);return()=>clearTimeout(timer);},createOperation:async(lease,pending)=>{
  let record=structuredClone(pending);const material={value:{snapshot:{expiresAt:new Date(Date.now()+8000).toISOString(),entries:[{sha256:'a'.repeat(64)}]}}};
  return{current:async()=>material,readState:async()=>({record}),appendRecord:async row=>{record=structuredClone(row);return{record};},createKey:async id=>({keyId:id,publicKeySpki:'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEYP7UuiVanTHJYet0xjVtaMBJuJI7Yfps5mliLmDyn7Z5A_4QCLi8maQa6elWKLxk8vGyDC1-n1F3o8KU1EYimQ',fingerprint:'5a7a78cca4a0f420d9bc62bb669c3c2759e39f723d3ae10dcbe0f0815a07ecd4'}),close:async()=>({state:closeState})};
 }};
 class RamWorker extends EventEmitter{
  constructor(file,options){super();instances.push(this);this.stdout=new EventEmitter();this.stderr=new EventEmitter();this.file=file;this.options=options;this.parent=new EventEmitter();this.parent.postMessage=v=>queueMicrotask(()=>this.emit('message',structuredClone(v)));queueMicrotask(()=>{try{compile('normal-sdk-worker-entry.cjs',{'node:worker_threads':{...threads,isMainThread:false,workerData:options.workerData,parentPort:this.parent},'./trust-enrollment-owner.cjs':{...realOwner,createDesktopTrustDependencies:()=>({...deps}),createTrustEnrollmentSession:(...args)=>{const owner=realOwner.createTrustEnrollmentSession(...args);owners.push(owner);dependencies.push(args[1]);return owner;}}});}catch(e){this.emit('error',e);}});}
  async terminate(){this.terminations=(this.terminations??0)+1;this.parent.emit('close');this.emit('exit',0);return 0;}
 }
 const host=compile('trust-key-host-client.cjs',{'node:worker_threads':{...threads,Worker:RamWorker}}),entry=compile('normal-sdk-worker-entry.cjs',{'./trust-key-host-client.cjs':host});
 return{host,entry,instances,owners,dependencies,deps};
}
test('고정 worker entry는 열린 package와 원 endpoint 안에서 등록 owner 하나를 처음 생성한다',async()=>{
 const f=isolatedWorkerFixture(),m=bootstrapCarrier(),context={origin:'https://project.invalid',identity:'view-1',authEpoch:2};
 // 같은 원 carrier fixture를 새 host 모듈에 그대로 연결한다. 실제 Worker/OS child는 0이다.
 const image=Buffer.from('synthetic-helper'),hash=createHash('sha256').update(image).digest('hex');
 const native=f.host.createSdkBootstrapClient({path:'C:\\Anvil\\resources\\AnvilTrustKeyHost.exe',signerRef:{id:randomUUID(),version:1,contentHash:hash},helperHash:hash},{readImage:async()=>Buffer.from(image),companion:async()=>'ABSENT',environment:()=>({SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'}),uuid:randomUUID,spawn:()=>m.child});
 const original=await native.open(m.lease,4);await original.accept();
 const proxy=await f.entry.createSdkEnrollmentSession(original,{fetch:async()=>{assert.fail('unexpected HUMAN');}},()=>context,'1.0.0',async()=>{assert.fail('unexpected dialog');},()=>{});
 try{
  assert.equal(f.instances.length,1);assert.equal(f.owners.length,1);assert.equal(proxy.getState().contextEpoch,4);assert.equal(proxy.getState().phase,'IDLE');
  assert.equal(f.instances[0].file,'C:\\Anvil\\resources\\app.asar\\src\\normal-sdk-worker-entry.cjs');assert.deepEqual(f.instances[0].options.execArgv,[]);assert.deepEqual(f.instances[0].options.env,{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'});
  const pending=proxy.handle('trust-begin',{requestId:randomUUID(),epoch:4,confirmNewKey:true,label:'원 worker'});assert.equal(proxy.isBusy(),true);const result=await pending;
  assert.equal(result.ok,true);assert.equal(result.state.phase,'KEY_READY');assert.equal(proxy.getState().attemptId,f.owners[0].getState().attemptId);assert.equal(proxy.isBusy(),false);
  assert.equal((await proxy.handleReceive('native-receive-status',{attemptId:result.state.attemptId,epoch:4})).ok,false);
  assert.equal((await proxy.configuration('PREPARE',{attemptId:result.state.attemptId,epoch:4,selection:{}})).ok,false);
  await assert.rejects(f.host.launchSdkBootstrapWorker(original,{},context,'1.0.0'));assert.equal(f.instances.length,1);
 }finally{assert.equal((await proxy.close()).state,'CLOSED_CONFIRMED');}
});

async function openWorkerModel(session,directory=async()=>null,options={}){
 const f=isolatedWorkerFixture(options.closeState),m=bootstrapCarrier(),context=options.context??{origin:'https://project.invalid',identity:'view-1',authEpoch:2},image=Buffer.from('synthetic-helper'),hash=createHash('sha256').update(image).digest('hex');
 const native=f.host.createSdkBootstrapClient({path:'C:\\Anvil\\resources\\AnvilTrustKeyHost.exe',signerRef:{id:randomUUID(),version:1,contentHash:hash},helperHash:hash},{readImage:async()=>Buffer.from(image),companion:async()=>'ABSENT',environment:()=>({SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'}),uuid:randomUUID,spawn:()=>m.child});
 const original=await native.open(m.lease,options.epoch??4);await original.accept();
 const proxy=await f.entry.createSdkEnrollmentSession(original,session,options.current??(()=>context),'1.0.0',directory,()=>{});
 return{...f,proxy,context};
}
function existingConfigurationFixture(){
 // 기존 설정 fixture의 원 정의만 RAM으로 재사용한다. 기존 시험/실제 파일 포트는 실행하지 않는다.
 const file=require.resolve('./normal-execution-configuration.test.cjs'),source=readFileSync(file,'utf8'),end=source.indexOf('function harness(');
 return new Function('require',source.slice(0,end)+'\nreturn fixture();')(require('node:module').createRequire(file));
}
test('원 worker 설정 client는 고정 HUMAN 두 GET과 원기한 폴더 대화만 main에 중계한다',async()=>{
 const fixture=existingConfigurationFixture(),calls=[];let dialog=0;
 const h=await openWorkerModel({fetch:async(url,options)=>{calls.push(url);assert.equal(options.method,'GET');assert.equal(options.credentials,'include');return new Response(canonicalJson(fixture.views[calls.length-1]),{headers:{'content-type':'application/json'}});}},async lease=>{lease.check();dialog++;return'C:\\source';});
 try{const life=new AbortController(),lease={signal:life.signal,check:()=>{},expiresAt:Date.now()+3000},reader=await h.dependencies[0].createExecutionConfigurationClient(lease);
  const result=await reader.read(fixture.selection);assert.deepEqual(result.environment.snapshot,fixture.views[0].snapshot);assert.deepEqual(result.profile.snapshot,fixture.views[1].snapshot);assert.equal(calls.length,2);
  assert.equal(await h.dependencies[0].selectExecutionDirectory(lease),'C:\\source');assert.equal(dialog,1);assert.equal(h.owners.length,1);
  await assert.rejects(h.dependencies[0].selectExecutionDirectory({...lease,expiresAt:undefined}));assert.equal(dialog,1);
 }finally{assert.equal((await h.proxy.close()).state,'CLOSED_CONFIRMED');}
});
test('원 worker 폴더 대기 중 인증 세대가 바뀌면 늦은 선택을 폐기하고 원 채널을 회수한다',async()=>{
 let release,entered;const waiting=new Promise(resolve=>{entered=resolve;});
 const h=await openWorkerModel({fetch:async()=>assert.fail('GET0')},lease=>{lease.check();entered();return new Promise(resolve=>{release=resolve;});});
 const result=h.dependencies[0].selectExecutionDirectory({check:()=>{},expiresAt:Date.now()+3000});await waiting;h.context.authEpoch++;
 release('C:\\source');await assert.rejects(result);assert.equal((await h.proxy.close()).state,'CLOSED_CONFIRMED');assert.equal(h.instances.length,1);
});
test('원 worker HUMAN 첫 응답 중 문맥 상실은 두 번째 GET과 설정 채택을 막는다',async()=>{
 const fixture=existingConfigurationFixture();let h,calls=0;
 h=await openWorkerModel({fetch:async()=>{calls++;h.context.authEpoch++;return new Response(canonicalJson(fixture.views[0]),{headers:{'content-type':'application/json'}});}});
 const reader=await h.dependencies[0].createExecutionConfigurationClient({signal:new AbortController().signal,check:()=>{}});
 await assert.rejects(reader.read(fixture.selection));assert.equal(calls,1);assert.equal((await h.proxy.close()).state,'CLOSED_CONFIRMED');
});

function existingElectronFixture(){
 const s=readFileSync(require.resolve('./desktop-trust-registration.test.cjs'),'utf8'),start=s.indexOf('function electronFixture(){'),end=s.indexOf('async function until',start);
 return new Function('require','assert','EventEmitter',s.slice(start,end)+'return electronFixture();')(require,assert,EventEmitter);
}
async function shellModel(bootstrap){
 const e=existingElectronFixture(),f=isolatedWorkerFixture(),Module=require('node:module'),file=require.resolve('../../apps/desktop/src/shell.cjs'),m=new Module(file,module),base=Module.createRequire(file),owner=require('../../apps/desktop/src/trust-enrollment-owner.cjs');
 e.electron.app.getVersion=()=> '1.0.0';e.electron.session.fromPartition('persist:anvil-web').fetch=async()=>assert.fail('unexpected Session request');m.filename=file;m.paths=module.paths;m.require=id=>id==='node:fs/promises'?e.io:id==='./trust-enrollment-owner.cjs'?{...owner,createDesktopTrustDependencies:()=>({...f.deps}),createDesktopSdkEnrollmentSession:bootstrap}:base(id);m._compile(readFileSync(file,'utf8'),file);const shell=await m.exports.createShell(e.electron);
 const call=(name,input)=>{const w=e.windows[0].webContents;return e.handlers.get('anvil:'+name)({sender:w,senderFrame:w.mainFrame},input);};
 await call('connect',{serverOrigin:'https://project.invalid',replaceInvalidConfig:false});return{...e,shell,call};
}
test('shell은 원 KEY_READY 등록을 신규 SDK owner로 자동 교체하지 않는다',async()=>{
 let bootstraps=0;const h=await shellModel(async()=>{bootstraps++;return null;});let status=await h.call('trust-status',{attemptId:null,epoch:null});
 const first=await h.call('trust-begin',{requestId:randomUUID(),epoch:status.state.contextEpoch,confirmNewKey:true,label:'원 등록'});assert.equal(first.ok,true);assert.equal(first.state.phase,'KEY_READY');assert.equal(bootstraps,1);
 const second=await h.call('trust-begin',{requestId:randomUUID(),epoch:first.state.contextEpoch,confirmNewKey:true,label:'새 시도'});assert.equal(second.ok,false);assert.equal(bootstraps,1);
 status=await h.call('trust-status',{attemptId:first.state.attemptId,epoch:first.state.contextEpoch});assert.equal(status.state.attemptId,first.state.attemptId);
});
test('shell 인증 전환 중 늦은 bootstrap은 일반 등록을 재개하지 않고 새 owner도 채택하지 않는다',async()=>{
 let release,entered;const started=new Promise(resolve=>{entered=resolve;});let bootstraps=0;
 const h=await shellModel(async()=>{bootstraps++;entered();return new Promise(resolve=>{release=resolve;});});const status=await h.call('trust-status',{attemptId:null,epoch:null});
 const work=h.call('trust-begin',{requestId:randomUUID(),epoch:status.state.contextEpoch,confirmNewKey:true,label:'원 시도'});await started;
 await assert.rejects(h.call('client-quit',{ackUnverifiedRuntime:true}),/CLIENT_BUSY_OR_UNKNOWN/);assert.equal(h.quits(),0);
 h.sessions.get('persist:anvil-web').cookies.emit('changed');release(null);const result=await work;assert.equal(result.ok,false);assert.equal(result.error.code,'CONTEXT_CHANGED');
 const current=await h.call('trust-status',{attemptId:null,epoch:null});assert.equal(current.state.attemptId,null);assert.equal(current.state.phase,'IDLE');
 const retry=await h.call('trust-begin',{requestId:randomUUID(),epoch:current.state.contextEpoch,confirmNewKey:true,label:'새 시도'});assert.equal(retry.error.code,'OUTCOME_UNKNOWN');assert.equal(bootstraps,1);
});

test('shell 정상 종료는 신규 원 worker의 native close 후 두 endpoint와 worker를 한 번 회수한다',async()=>{
 let model;const h=await shellModel(async(_electron,session,current,epoch,directory)=>{model=await openWorkerModel(session,directory,{context:current(),current,epoch});return model.proxy;});
 const status=await h.call('trust-status',{attemptId:null,epoch:null}),begun=await h.call('trust-begin',{requestId:randomUUID(),epoch:status.state.contextEpoch,confirmNewKey:true,label:'고정 worker'});
 assert.equal(begun.ok,true,JSON.stringify({code:begun.error?.code,phase:begun.state?.phase,model:model?.proxy.getState().phase,epoch:model?.proxy.getState().contextEpoch}));assert.equal(begun.state.phase,'KEY_READY');assert.equal(model.owners.length,1);
 await h.call('client-quit',{ackUnverifiedRuntime:true});assert.equal(h.quits(),1);assert.equal(model.instances[0].terminations,1);assert.equal((await model.proxy.close()).state,'CLOSED_CONFIRMED');assert.equal(model.instances[0].terminations,1);
});
test('원 worker native close 불명은 정상 종료와 재발급을 열지 않는다',async()=>{
 const h=await openWorkerModel({fetch:async()=>assert.fail('GET0')},undefined,{closeState:'UNKNOWN'});
 const result=await h.proxy.handle('trust-begin',{requestId:randomUUID(),epoch:4,confirmNewKey:true,label:'종료 불명'});assert.equal(result.ok,false);assert.equal(h.proxy.getState().phase,'UNKNOWN');
 assert.equal((await h.proxy.close()).state,'UNKNOWN');assert.equal((await h.proxy.close()).state,'UNKNOWN');assert.equal(h.instances[0].terminations??0,0);
 assert.equal(h.proxy.getState().phase,'UNKNOWN');
 // 보존 판정 뒤 시험 소유 RAM MessagePort만 해제한다. 제품 close 재시도나 OS 회수가 아니다.
 h.instances[0].options.workerData.port.close();h.instances[0].options.workerData.registrationPort.close();h.instances[0].parent.emit('close');
});
test('고정 배포 profile이 없으면 shell bootstrap은 파일·원 worker·SDK를 열지 않는다',async()=>{
 let reads=0;const electron=new Proxy({}, {get(){reads++;assert.fail('no application observation');}});
 assert.equal(await require('../../apps/desktop/src/trust-enrollment-owner.cjs').createDesktopSdkEnrollmentSession(electron,null,()=>{assert.fail('no context');},1,()=>{assert.fail('no dialog');},()=>{}),null);assert.equal(reads,0);
});

test('복사한 endpoint·다른 port 또는 폐쇄한 native 채널은 고정 worker 생성0이다',async()=>{
 for(const kind of ['copy','port','closed']){
  const f=isolatedWorkerFixture(),m=bootstrapCarrier(),image=Buffer.from('synthetic-helper'),hash=createHash('sha256').update(image).digest('hex');
  const native=f.host.createSdkBootstrapClient({path:'C:\\Anvil\\resources\\AnvilTrustKeyHost.exe',signerRef:{id:randomUUID(),version:1,contentHash:hash},helperHash:hash},{readImage:async()=>Buffer.from(image),companion:async()=>'ABSENT',environment:()=>({SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'}),uuid:randomUUID,spawn:()=>m.child});
  const original=await native.open(m.lease,4);await original.accept();const endpoint=f.host.createSdkBootstrapEndpoint(original);
  const other=new(require('node:worker_threads').MessageChannel)();try{if(kind==='closed')await original.close();await assert.rejects(f.host.launchSdkBootstrapWorker(original,kind==='copy'?{...endpoint}:kind==='port'?{...endpoint,port:other.port2}:endpoint,{origin:'https://project.invalid',identity:'view',authEpoch:1},'1.0.0'));assert.equal(f.instances.length,0);}finally{other.port1.close();other.port2.close();endpoint.close();await original.close();}
 }
});
