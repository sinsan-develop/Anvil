import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {NativePreparationClient} from '../../../apps/connector/runtime/native-preparation-client.ts';
import {NativePreparationHttpsChannel} from '../../../apps/connector/runtime/native-preparation-https.ts';
import {NativePreparationOwnershipReturn} from '../../../apps/connector/runtime/native-preparation-ownership-return.ts';
import {nativeHash} from '../../../contracts/runtime/native-preparation-authority-v1.ts';
import {ownershipObservationBytesV1} from '../../../contracts/runtime/ownership-observation-v1.ts';
import {planNativeOwnershipRequest,planNativeOwnershipAcceptance} from '../../../apps/server/modules/executions/native-preparation-ownership-return.ts';

const id=(n:number)=>'ad140003-0000-4000-8000-'+String(n).padStart(12,'0'),ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
function fixture(mode='OK'){
 const key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=key.publicKey.export({type:'spki',format:'der'}).toString('base64url'),fingerprint=createHash('sha256').update(Buffer.from(spki,'base64url')).digest('hex');
 const now=Date.parse('2030-01-01T00:00:00.000Z'),at=new Date(now).toISOString(),expiresAt=new Date(now+30000).toISOString();let wall=now;
 const a={schemaVersion:2,purpose:'NATIVE_PREPARATION_AUTHORITY',authorityId:id(1),credentialId:id(2),credentialGeneration:1,scope:{installationId:id(3),projectId:id(4),executionId:id(5),executionGeneration:1,authorityEpoch:1,leaseId:id(6),registrationRef:ref(7),nativeFactoryRef:ref(8),sourceScopeHash:'b'.repeat(64),writerHeadRef:ref(9),preparationRef:ref(10),hostPublicKeyFingerprint:fingerprint},subject:{userId:id(11),clientId:id(12),humanSessionId:id(13),controlGeneration:1,credentialGeneration:1},parent:{commandRef:ref(14),authorizationReceiptRef:ref(15),auditRef:ref(16)},policyRef:ref(17),channelProfileRef:ref(18),allowedOperations:['CHECK_NATIVE_PREPARATION_CURRENT','CONSUME_NATIVE_PREPARATION','RETURN_NATIVE_PREPARATION_OWNERSHIP'],issuedAt:at,expiresAt,codingAgentExecutionAuthorized:false,agentDispatchPerformed:false};
 const authority={ref:{id:a.authorityId,version:1,contentHash:nativeHash(a)},snapshot:a},identity={origin:'https://return.invalid',channelProfileRef:a.channelProfileRef,registrationRef:a.scope.registrationRef,credentialPurpose:'NATIVE_PREPARATION_ONLY' as const,credentialGeneration:1};
 const processRef={runId:id(25),generation:1,jobId:id(26),pid:50,startTicks:'133000000000000000',executableHash:'e'.repeat(64)};
 let challenge:any,receipt:any,plan:any,next=100,locked=false,opens=0,signs=0,closes=0,reads=0;const records:any[]=[],calls:string[]=[];
 const journal={transport:'SOURCE_ONLY_MODEL' as const,exclusive:async<T>(_ref:any,work:(tx:any)=>Promise<T>)=>{assert.equal(locked,false);locked=true;try{return await work({read:async()=>{reads++;return {complete:true,records:structuredClone(records)};},appendAndSync:async(r:any)=>{records.push(structuredClone(r));}});}finally{locked=false;}}};
 const driver:any=(url:URL,options:any,callback:(response:any)=>void)=>{
  const req:any=new EventEmitter();req.destroy=()=>req;req.end=(bytes?:Buffer)=>{const body=bytes?JSON.parse(bytes.toString()):null;calls.push(url.pathname);
   queueMicrotask(()=>{try{
    let result:any;
    if(url.pathname.endsWith('/current'))result={authorityRef:authority.ref,writerHeadRef:a.scope.writerHeadRef,registrationRef:a.scope.registrationRef,scopeHash:a.scope.sourceScopeHash,phase:'RESERVED',checkedAt:at,expiresAt,codingAgentExecutionAuthorized:false,agentDispatchPerformed:false};
    else if(url.pathname.endsWith('/challenges'))result=challenge={challengeRef:ref(30),requestId:body.requestId,authorityRef:authority.ref,localAttemptRef:body.localAttemptRef,target:body.target,serverNonce:Buffer.alloc(32,3).toString('base64url'),issuedAt:at,expiresAt};
    else if(url.pathname.endsWith('/consume')){
     const proof=JSON.parse(Buffer.from(options.headers['x-anvil-native-proof'],'base64url').toString()),s={schemaVersion:1,purpose:'NATIVE_PREPARATION_CONSUME_RECEIPT',authorityRef:authority.ref,preparationRef:a.scope.preparationRef,writerHeadRef:a.scope.writerHeadRef,requestId:proof.requestId,requestHash:nativeHash(proof),challengeRef:challenge.challengeRef,proofEventRef:ref(31),localAttemptRef:body.localAttemptRef,at,expiresAt,codingAgentExecutionAuthorized:false,agentDispatchPerformed:false};
     receipt={ref:{id:id(32),version:1,contentHash:nativeHash(s)},snapshot:s};
     const p={schemaVersion:1,purpose:'NATIVE_FACTORY_SINGLE_USE',authorityRef:authority.ref,consumeReceiptRef:receipt.ref,consumeRecordRef:ref(33),preparationRef:a.scope.preparationRef,writerHeadRef:a.scope.writerHeadRef,localAttemptRef:body.localAttemptRef,requestId:proof.requestId,requestHash:s.requestHash,scopeHash:a.scope.sourceScopeHash,issuedAt:at,expiresAt,codingAgentExecutionAuthorized:false,agentDispatchPerformed:false};
     result={receipt,recordRef:ref(33),disposition:'FIRST_COMMIT',factoryPermit:{ref:{id:id(34),version:1,contentHash:nativeHash(p)},snapshot:p}};
    }else if(url.pathname.endsWith('/ownership-requests')){
     plan=planNativeOwnershipRequest({authority:a,consumeReceipt:receipt,consumeRecordRef:ref(33),input:body,basis:{authorityRef:authority.ref,consumeReceiptRef:receipt.ref,nativeFactoryRef:a.scope.nativeFactoryRef,registrationRef:a.scope.registrationRef,sourceScopeHash:a.scope.sourceScopeHash,observerRef:ref(35),runId:processRef.runId,processGeneration:1,workerHash:processRef.executableHash,checkedAt:at,expiresAt},nowMs:now,expiresAt,nonce:Buffer.alloc(32,4).toString('base64url'),ids:[id(36),id(37),id(38)]});
     result=plan.response;if(mode==='WRONG_ANCHOR'){result=structuredClone(result);result.candidateAnchor.snapshot.parent.localAttemptRef=ref(999);result.candidateAnchor.ref.contentHash=nativeHash(result.candidateAnchor.snapshot);result.request.anchorRef=result.candidateAnchor.ref;}
    }else if(url.pathname.endsWith('/ownership-results')){
     if(mode==='LOST_RESULT')throw Error('RAM_LOST_RESPONSE');
     result=planNativeOwnershipAcceptance({request:plan,input:body,spki,nowMs:now,ids:[id(40),id(41),id(42),id(43),id(44)]}).response;
    }else throw Error('UNEXPECTED_TARGET');
    const res:any=new EventEmitter();res.statusCode=200;res.rawHeaders=['Content-Type','application/json'];res.destroy=()=>res;callback(res);res.emit('data',Buffer.from(JSON.stringify(result)));res.emit('end');
   }catch(error){req.emit('error',error);}});
  };return req;
 };
 const binding={authorityRef:authority.ref,identity,hostPublicKeyFingerprint:fingerprint},protection={transport:'SOURCE_ONLY_MODEL' as const,binding,read:async()=>({binding,ca:'RAM_CA_ONLY',bearer:'A'.repeat(43),profileExpiresAt:expiresAt,credentialExpiresAt:expiresAt,signerExpiresAt:expiresAt}),sign:async(bytes:Buffer)=>sign('sha256',bytes,{key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};
 const channel=new NativePreparationHttpsChannel({authority,identity},protection,{request:driver,now:()=>now});
 const retained={transport:'SOURCE_ONLY_MODEL' as const,ref:a.scope.nativeFactoryRef,open:async(context:any,_signal:AbortSignal)=>{
  opens++;assert.equal(records.length,2);assert.equal(records[1].snapshot.state,'FACTORY_ATTEMPTED');assert.deepEqual(context.receipt,receipt);
  return {read:async()=>{if(mode==='EXPIRED')wall=now+10001;return structuredClone(processRef);},sign:async(response:any)=>{signs++;const facts={processRef:structuredClone(processRef),state:'PREPARED',everResumed:false,active:1,processes:[{pid:50,startTicks:processRef.startTicks,inJob:true,executableHash:processRef.executableHash}],killOnClose:false,fileSandboxVerified:false};if(mode==='CHANGED_PROCESS')facts.processRef.pid++;
   const report={...response.request,factsHash:nativeHash(facts),observedAt:at};return {report,facts,publicKeySpki:spki,signature:sign('sha256',ownershipObservationBytesV1(report),{key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};},close:async()=>{closes++;return {closed:mode!=='CLOSE_UNKNOWN'};}};
 }};
 const factory=new NativePreparationOwnershipReturn(channel,retained,{now:()=>wall,allocate:()=>id(next++)});
 const client=new NativePreparationClient(channel,journal,factory,{wall:()=>now,monotonic:()=>performance.now(),allocate:()=>id(next++)});
 const restart=()=>{const freshChannel=new NativePreparationHttpsChannel({authority,identity},protection,{request:driver,now:()=>now});const freshFactory=new NativePreparationOwnershipReturn(freshChannel,retained,{now:()=>wall,allocate:()=>id(next++)});return {client:new NativePreparationClient(freshChannel,journal,freshFactory,{wall:()=>now,monotonic:()=>performance.now(),allocate:()=>id(next++)}),factory:freshFactory};};
 return{client,authority,factory,calls,records,restart,reads:()=>reads,counts:()=>({opens,signs,closes})};
}

test('RETURN client는 원 consume/ticket과 내구 시도 뒤 retained 자료를 기존 서명/요청으로 한 번 수용한다',async()=>{
 const f=fixture(),result=await f.client.run(f.authority,id(90));assert.equal(result.state,'CREATED_OBSERVED');
 assert.deepEqual(f.counts(),{opens:1,signs:1,closes:0});assert.equal(f.calls.filter(x=>x.endsWith('/ownership-results')).length,1);
 assert.equal(f.factory.outcome()?.executionAuthorized,false);assert.equal(f.factory.outcome()?.dispatchPerformed,false);
 const effects=f.calls.filter(x=>!x.endsWith('/current')),before=structuredClone(f.records),outcome=f.factory.outcome();assert.equal((await f.client.run(f.authority,id(90))).state,'UNKNOWN');assert.deepEqual(f.calls.filter(x=>!x.endsWith('/current')),effects);assert.equal(f.counts().opens,1);assert.deepEqual(f.records,before);assert.deepEqual(f.factory.outcome(),outcome);
 await f.factory.close();assert.equal(f.counts().closes,1);
});
test('RETURN 변조·재서명된 다른 process·응답유실 뒤 재시도는 새 nonce/factory를 만들지 않는다',async()=>{
 for(const mode of ['WRONG_ANCHOR','CHANGED_PROCESS','LOST_RESULT']){const f=fixture(mode),result=await f.client.run(f.authority,id(90));assert.equal(result.state,'UNKNOWN',mode);assert.equal(f.factory.outcome(),null);
  const effects=f.calls.filter(x=>!x.endsWith('/current')),before=structuredClone(f.records);assert.equal((await f.client.run(f.authority,id(90))).state,'UNKNOWN');assert.deepEqual(f.calls.filter(x=>!x.endsWith('/current')),effects);assert.equal(f.counts().opens,1);assert.equal(f.counts().closes,1);assert.deepEqual(f.records,before);assert.equal(f.factory.outcome(),null);
  assert.equal(f.calls.filter(x=>x.endsWith('/ownership-results')).length,mode==='LOST_RESULT'?1:0);
 }
});
test('RETURN 위조 ticket/사전 취소/원 기한 소진은 새로운 요청·서명 호출을 허용하지 않는다',async()=>{
 for(const aborted of [false,true]){const f=fixture(),controller=new AbortController();if(aborted)controller.abort();assert.equal((await f.factory.invoke({consume:async()=>({})},controller.signal)).state,'UNKNOWN');assert.deepEqual(f.counts(),{opens:0,signs:0,closes:0});assert.equal(f.calls.length,0);await assert.rejects(()=>f.factory.invoke({},controller.signal));}
 const f=fixture('EXPIRED');assert.equal((await f.client.run(f.authority,id(90))).state,'UNKNOWN');assert.equal(f.calls.filter(x=>x.endsWith('/ownership-requests')).length,0);assert.deepEqual(f.counts(),{opens:1,signs:0,closes:1});
});
test('RETURN 새 client/channel도 기존 journal을 실제 읽은 뒤 정상·불명 시도를 재실행하지 않는다',async()=>{
 for(const mode of ['OK','LOST_RESULT']){const f=fixture(mode);assert.equal((await f.client.run(f.authority,id(90))).state,mode==='OK'?'CREATED_OBSERVED':'UNKNOWN');
  const records=structuredClone(f.records),effects=f.calls.filter(x=>!x.endsWith('/current')),counts=f.counts(),reads=f.reads(),current=f.calls.filter(x=>x.endsWith('/current')).length;
  const fresh=f.restart();assert.equal((await fresh.client.run(f.authority,id(90))).state,'UNKNOWN');
  assert.equal(f.reads(),reads+1);assert.equal(f.calls.filter(x=>x.endsWith('/current')).length,current+1);assert.deepEqual(f.records,records);assert.deepEqual(f.calls.filter(x=>!x.endsWith('/current')),effects);assert.deepEqual(f.counts(),counts);assert.equal(fresh.factory.outcome(),null);await f.factory.close();
 }
});
