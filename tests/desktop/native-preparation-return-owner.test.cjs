'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module');
const {EventEmitter}=require('node:events'),crypto=require('node:crypto');
const {canonicalJson,contentHash}=require('../../apps/desktop/src/runtime-catalogue-profile.cjs');
const hash=v=>contentHash(canonicalJson(v)),id=n=>'ad140007-0000-4000-8000-'+String(n).padStart(12,'0'),ref=n=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
// 기존 등록 fixture를 메모리에서만 재사용하며 기존 시험은 재등록하지 않는다.
let fixtures;
test.before(async()=>{const file=require.resolve('./desktop-trust-registration.test.cjs'),m=new Module(file,module),before=[],register=()=>{};register.before=fn=>before.push(fn);const original=Module.createRequire(file);m.filename=file;m.paths=module.paths;m.require=name=>name==='node:test'?register:original(name);m._compile(fs.readFileSync(file,'utf8')+'\nmodule.exports={liveNativeOwner,liveNativeModel,nativeRuntime};',file);assert.equal(before.length,1);await before[0]();fixtures=m.exports;});
test('REGISTERED owner의 반환 조립은 위조 receiver와 보호 journal 부재에서 host0으로 닫힌다',async()=>{
 const f=await fixtures.liveNativeOwner(),before=f.calls();
 assert.equal(typeof f.owner.returnNativePreparationOwnership,'function');
 await assert.rejects(f.owner.returnNativePreparationOwnership({getChannel:()=>({})}));
 assert.equal(f.calls(),before);assert.equal(f.owner.isBusy(),false);
});
async function journey(mode='OK'){
 const f=await fixtures.liveNativeOwner();let lateEnabled=false,lateCount=0,lateRelease,lateEntered;
 const lateReady=new Promise(resolve=>{lateEntered=resolve;});
 if(mode==='LATE_OPEN'){const create=f.dependencies.createOperation;f.dependencies.createOperation=async(...args)=>{const operation=await create(...args);if(lateEnabled&&++lateCount===2){lateEntered();await new Promise(resolve=>{lateRelease=resolve;});}return operation;};}
 const n=fixtures.liveNativeModel(f,()=>{},fixtures.nativeRuntime,true),authority=n.authority,a=authority.snapshot;
 a.schemaVersion=2;a.allowedOperations.push('RETURN_NATIVE_PREPARATION_OWNERSHIP');authority.ref.contentHash=hash(a);n.protectedSource.binding.authorityRef.contentHash=authority.ref.contentHash;
 let offset=0;const baseNow=f.dependencies.now(),schedule=f.dependencies.schedule,deadlines=new Set();f.dependencies.now=()=>baseNow+offset;f.ports.now=f.dependencies.now;f.dependencies.schedule=(callback,delay)=>{deadlines.add(callback);const cancel=schedule(callback,delay);return()=>{deadlines.delete(callback);cancel();};};
 const now=f.dependencies.now(),at=a.issuedAt,end=a.expiresAt,records=[],calls=[],hostCalls=[];let locked=false,challenge,receipt,plan,returnChild,alive=false;
 const journal={transport:'SOURCE_ONLY_MODEL',exclusive:async(_ref,work)=>{assert.equal(locked,false);locked=true;try{return await work({read:async()=>({complete:true,records:structuredClone(records)}),appendAndSync:async record=>{records.push(structuredClone(record));}});}finally{locked=false;}}};
 if(mode!=='NO_JOURNAL')f.dependencies.nativePreparationJournal=journal;
 const processRef={runId:id(50),generation:1,jobId:id(51),pid:50,startTicks:'133000000000000000',executableHash:'e'.repeat(64)};
 const {planNativeOwnershipRequest,planNativeOwnershipAcceptance}=await import('../../apps/server/modules/executions/native-preparation-ownership-return.ts');
 const {ownershipObservationBytesV1}=await import('../../contracts/runtime/ownership-observation-v1.ts');
 const b64=h=>Buffer.from(h,'hex').toString('base64url'),privateKey=crypto.createPrivateKey({key:{kty:'EC',crv:'P-256',x:b64('60FED4BA255A9D31C961EB74C6356D68C049B8923B61FA6CE669622E60F29FB6'),y:b64('7903FE1008B8BC99A41AE9E95628BC64F2F1B20C2D7E9F5177A3C294D4462299'),d:b64('C9AFA9D845BA75166B5C215767B1D6934E50C3DB36E89B127B8A622B120F6721')},format:'jwk'});
 const spawn=f.ports.spawn;
 f.ports.spawn=(...args)=>{const child=spawn(...args),write=child.stdin.write;child.stdin.write=(raw,encoding,done)=>{
  const v=JSON.parse(Buffer.from(raw).toString());if(!v.operation.startsWith('NATIVE_OWNERSHIP_RETURN_'))return write(raw,encoding,done);
  assert.ok(Buffer.byteLength(raw)<=65536);assert.ok(v.sequence<=64);assert.equal(v.payload.attemptId,f.stored().attemptId);hostCalls.push(v.operation);
  queueMicrotask(()=>{let data;
   if(v.operation==='NATIVE_OWNERSHIP_RETURN_OPEN'){assert.equal(records.length,2);assert.equal(records[1].snapshot.state,'FACTORY_ATTEMPTED');assert.deepEqual(v.payload.context.authority,authority);assert.deepEqual(v.payload.context.receipt,receipt);returnChild=child;alive=true;data={opened:mode!=='NO_NATIVE_PROVIDER'};}
   else {assert.equal(child,returnChild,'원 retained 객체는 같은 host에서만 사용한다');
    if(v.operation==='NATIVE_OWNERSHIP_RETURN_READ')data=processRef;
    else if(v.operation==='NATIVE_OWNERSHIP_RETURN_SIGN'){
     const response=v.payload.response;assert.deepEqual(response,plan.response);
     const facts={processRef,state:'PREPARED',everResumed:false,active:1,processes:[{pid:50,startTicks:processRef.startTicks,inJob:true,executableHash:processRef.executableHash}],killOnClose:false,fileSandboxVerified:false};
     const report={...response.request,factsHash:hash(facts),observedAt:at};data={report,facts,publicKeySpki:f.stored().key.publicKeySpki,signature:crypto.sign('sha256',ownershipObservationBytesV1(report),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};
    }else throw Error('UNEXPECTED_RETURN_OP');
   }
   child.stdout.emit('data',Buffer.from(canonicalJson({schemaVersion:1,purpose:'DESKTOP_TRUST_KEY_RESULT_V1',requestId:v.requestId,sequence:v.sequence,rootIdentity:mode==='ROOT'?'OTHER_ROOT':'TEST_ONLY_ROOT',data})+'\n'));done();
  });return true;
 };const close=child.stdin.end;child.stdin.end=(...args)=>{if(child===returnChild)alive=false;if(mode!=='CLOSE'||child!==returnChild)return close(...args);queueMicrotask(()=>{child.stdout.emit('end');child.emit('close',1);args.at(-1)?.();});};return child;};
 const driver=(url,options,callback)=>{const req=new EventEmitter();req.destroy=()=>req;req.end=bytes=>{const body=bytes?JSON.parse(Buffer.from(bytes).toString()):null;calls.push(url.pathname);queueMicrotask(()=>{try{
  assert.equal(options.rejectUnauthorized,true);assert.equal(options.headers.authorization,'Bearer '+'Z'.repeat(43));let result;
  if(url.pathname.endsWith('/current'))result=n.current();
  else if(url.pathname.endsWith('/challenges'))result=challenge={challengeRef:ref(30),requestId:body.requestId,authorityRef:authority.ref,localAttemptRef:body.localAttemptRef,target:body.target,serverNonce:Buffer.alloc(32,3).toString('base64url'),issuedAt:at,expiresAt:end};
  else if(url.pathname.endsWith('/consume')){
   const proof=JSON.parse(Buffer.from(options.headers['x-anvil-native-proof'],'base64url').toString()),s={schemaVersion:1,purpose:'NATIVE_PREPARATION_CONSUME_RECEIPT',authorityRef:authority.ref,preparationRef:a.scope.preparationRef,writerHeadRef:a.scope.writerHeadRef,requestId:proof.requestId,requestHash:hash(proof),challengeRef:challenge.challengeRef,proofEventRef:ref(31),localAttemptRef:body.localAttemptRef,at,expiresAt:end,codingAgentExecutionAuthorized:false,agentDispatchPerformed:false};
   receipt={ref:{id:id(32),version:1,contentHash:hash(s)},snapshot:s};const p={schemaVersion:1,purpose:'NATIVE_FACTORY_SINGLE_USE',authorityRef:authority.ref,consumeReceiptRef:receipt.ref,consumeRecordRef:ref(33),preparationRef:a.scope.preparationRef,writerHeadRef:a.scope.writerHeadRef,localAttemptRef:body.localAttemptRef,requestId:proof.requestId,requestHash:s.requestHash,scopeHash:a.scope.sourceScopeHash,issuedAt:at,expiresAt:end,codingAgentExecutionAuthorized:false,agentDispatchPerformed:false};
   result={receipt,recordRef:ref(33),disposition:'FIRST_COMMIT',factoryPermit:{ref:{id:id(34),version:1,contentHash:hash(p)},snapshot:p}};
  }else if(url.pathname.endsWith('/ownership-requests')){
   plan=planNativeOwnershipRequest({authority:a,consumeReceipt:receipt,consumeRecordRef:ref(33),input:body,basis:{authorityRef:authority.ref,consumeReceiptRef:receipt.ref,nativeFactoryRef:a.scope.nativeFactoryRef,registrationRef:a.scope.registrationRef,sourceScopeHash:a.scope.sourceScopeHash,observerRef:ref(35),runId:processRef.runId,processGeneration:1,workerHash:processRef.executableHash,checkedAt:at,expiresAt:end},nowMs:now,expiresAt:end,nonce:Buffer.alloc(32,4).toString('base64url'),ids:[id(36),id(37),id(38)]});result=plan.response;
  }else if(url.pathname.endsWith('/ownership-results')){assert.equal(alive,true,'원 process는 수용 POST 전 살아 있어야 한다');if(mode==='LOST_RESULT')throw Error('RAM_LOST_RESPONSE');result=planNativeOwnershipAcceptance({request:plan,input:body,spki:f.stored().key.publicKeySpki,nowMs:now,ids:[id(40),id(41),id(42),id(43),id(44)]}).response;}
  else throw Error('UNEXPECTED_TARGET');
  const res=new EventEmitter();res.statusCode=200;res.rawHeaders=['Content-Type','application/json'];res.destroy=()=>res;callback(res);res.emit('data',Buffer.from(canonicalJson(result)));res.emit('end');
 }catch(error){req.emit('error',error);}});};return req;};
 const human={userId:a.subject.userId,clientId:a.subject.clientId,credentialGeneration:a.subject.credentialGeneration,controlGeneration:a.subject.controlGeneration},without={schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_WINDOW',windowId:id(61),installationId:a.scope.installationId,projectId:a.scope.projectId,registrationRef:a.scope.registrationRef,connectorRef:f.stored().registration.connectorRef,hostPublicKeyFingerprint:a.scope.hostPublicKeyFingerprint,profileRef:ref(62),localReceiveAttemptId:id(63),human,writerHeadRef:a.scope.writerHeadRef,policyRef:a.policyRef,issuedAt:at,expiresAt:end},w={...without,authBindingHash:hash({authSessionId:a.subject.humanSessionId,window:without})},window={ref:{id:w.windowId,version:1,contentHash:hash(w)},snapshot:w};
 const snapshot={schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_DELIVERY',deliveryId:id(64),bindingRef:ref(65),armRef:ref(66),authorityRef:authority.ref,authority,commandHash:a.parent.commandRef.contentHash,metadata:{authorityRef:authority.ref,credentialId:a.credentialId,credentialGeneration:a.credentialGeneration,registrationRef:a.scope.registrationRef,channelProfileRef:a.channelProfileRef,expiresAt:end},issuedAt:at,expiresAt:end},delivery={ref:{id:snapshot.deliveryId,version:1,contentHash:hash(snapshot)},snapshot},wire=Buffer.from(canonicalJson(delivery)),frame=Buffer.alloc(wire.length+47);frame.writeUInt32BE(wire.length);wire.copy(frame,4);frame.fill('Z',wire.length+4);
 const receiver=f.owner.createNativeFirstReceiveReceiver(window,n.protectedSource,{request:driver});await receiver.accept(frame,new AbortController().signal);frame.fill(0);
 return{f,receiver,records,calls,hostCalls,alive:()=>alive,lateReady,lateEnable:()=>{lateEnabled=true;},lateRelease:()=>lateRelease?.(),expire:()=>{offset=6001;for(const callback of [...deadlines])callback();},close:()=>receiver.dispose()};
}
test('v2 보호 delivery→실제 owner/client/coordinator→동일 host→서버 계획 관측/head 종단',async()=>{
 const v=await journey();try{const outcome=await v.f.owner.returnNativePreparationOwnership(v.receiver);assert.equal(outcome.state,'OWNERSHIP_RETURNED',JSON.stringify({calls:v.calls,host:v.hostCalls,records:v.records.map(r=>r.snapshot.state)}));assert.equal(outcome.codingAgentExecutionAuthorized,false);assert.equal(outcome.agentDispatchPerformed,false);assert.equal(v.records.length,2);assert.deepEqual(v.hostCalls,['NATIVE_OWNERSHIP_RETURN_OPEN','NATIVE_OWNERSHIP_RETURN_READ','NATIVE_OWNERSHIP_RETURN_SIGN','NATIVE_OWNERSHIP_RETURN_READ']);assert.equal(v.calls.filter(p=>p.endsWith('/ownership-results')).length,1);const before=v.f.calls();await assert.rejects(v.f.owner.returnNativePreparationOwnership(v.receiver));assert.equal(v.f.calls(),before);assert.equal(v.f.ends(),v.f.calls()-1);}finally{v.close();}
});
test('원 retained 수명은 일회 HTTP 종료와 분리되고 명시 receiver 종료까지 보유한다',async()=>{
 const v=await journey();try{
  const outcome=await v.f.owner.returnNativePreparationOwnership(v.receiver);
  assert.equal(outcome.state,'OWNERSHIP_RETURNED');assert.equal(v.alive(),true);
  v.close();await new Promise(resolve=>setImmediate(resolve));assert.equal(v.alive(),false);
 }finally{v.close();}
});
test('retained 종료 불명은 과거 observation을 current로 승격하지 않고 owner UNKNOWN을 보존한다',async()=>{
 const v=await journey('CLOSE');try{
  assert.equal((await v.f.owner.returnNativePreparationOwnership(v.receiver)).state,'OWNERSHIP_RETURNED');
  assert.equal(v.alive(),true);v.close();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(v.f.owner.getState().phase,'UNKNOWN');const calls=v.f.calls();
  await assert.rejects(v.f.owner.returnNativePreparationOwnership(v.receiver));assert.equal(v.f.calls(),calls);
 }finally{v.close();}
});
test('REGISTERED owner 무효화는 보유 host를 회수하고 동일 delivery 재호출0이다',async()=>{
 const v=await journey();try{
  assert.equal((await v.f.owner.returnNativePreparationOwnership(v.receiver)).state,'OWNERSHIP_RETURNED');
  v.f.owner.invalidate();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(v.alive(),false);const calls=v.f.calls();await assert.rejects(v.f.owner.returnNativePreparationOwnership(v.receiver));assert.equal(v.f.calls(),calls);
 }finally{v.close();}
});
test('원 receiver 기한은 성공 뒤 재설정되지 않고 retained host 종료·재호출0을 강제한다',async()=>{
 const v=await journey();try{
  assert.equal((await v.f.owner.returnNativePreparationOwnership(v.receiver)).state,'OWNERSHIP_RETURNED');
  assert.equal(v.alive(),true);v.expire();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(v.alive(),false);const calls=v.f.calls();await assert.rejects(v.f.owner.returnNativePreparationOwnership(v.receiver));assert.equal(v.f.calls(),calls);
 }finally{v.close();}
});
test('retained open 대기중 중복은 효과0이고 receiver 취소 뒤 늦은 host도 회수한다',async()=>{
 const v=await journey('LATE_OPEN');v.lateEnable();
 let work;try{
  work=v.f.owner.returnNativePreparationOwnership(v.receiver);
  await Promise.race([v.lateReady,work.then(()=>{throw Error('retained open에 도달하지 않음');})]);
  const calls=v.f.calls();await assert.rejects(v.f.owner.returnNativePreparationOwnership(v.receiver));assert.equal(v.f.calls(),calls);
  v.close();v.lateRelease();await work.catch(()=>{});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(v.hostCalls.length,0);assert.equal(v.f.ends(),v.f.calls());
 }finally{v.lateRelease();await work?.catch(()=>{});v.close();}
});
for(const mode of ['NO_JOURNAL','NO_NATIVE_PROVIDER','ROOT','LOST_RESULT'])test('v2 owner '+mode+'는 추가 반환/재전송 없이 닫힌다',async()=>{
 const v=await journey(mode);try{let outcome;try{outcome=await v.f.owner.returnNativePreparationOwnership(v.receiver);}catch{}assert.notEqual(outcome?.state,'OWNERSHIP_RETURNED');const before=v.f.calls();await assert.rejects(v.f.owner.returnNativePreparationOwnership(v.receiver));assert.equal(v.f.calls(),before);if(mode==='NO_JOURNAL')assert.equal(v.calls.length,0);}finally{v.close();}
});
