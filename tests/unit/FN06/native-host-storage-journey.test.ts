import test from 'node:test';
import assert from 'node:assert/strict';
import {sign} from 'node:crypto';
import {canonicalJson} from '../../../contracts/canonical.ts';
import {nativeHash,nativeRequestProofBytes} from '../../../contracts/runtime/native-preparation-authority-v1.ts';
import {ownershipObservationBytesV1} from '../../../contracts/runtime/ownership-observation-v1.ts';
import {nativeFixture,id,ref,testOpaque,testPrivateKey} from './native-host-storage-fixture.ts';

async function prepared(version:1|2=2){
 const f=await nativeFixture(false,10000,true,false,false,false,version);
 try{
  f.nativeApp.addHook('onRequest',async request=>{Object.defineProperty(request.raw.socket,'encrypted',{value:true,configurable:true});});
  const made=await f.nativeApp.inject({method:'POST',url:'/api/v1/projects/'+f.pid+'/native-boundary-preparations',headers:f.headers,payload:f.nativeCommand});assert.equal(made.statusCode,200,made.body);
  const row=f.data().native[0],a=row.snapshot_json,ar={id:row.id,version:1,contentHash:row.content_hash},path='/api/v1/connector/native-preparations/'+row.id,headers={host:new URL(f.origin).host,authorization:'Bearer '+testOpaque};
  const body={schemaVersion:1,authorityRef:ar,localAttemptRef:ref(9881)},target={method:'POST',path:path+'/consume',queryHash:nativeHash({}),bodyHash:nativeHash(body)},request={schemaVersion:1,requestId:id(9882),authorityRef:ar,localAttemptRef:body.localAttemptRef,target};
  const post=(suffix:string,payload:unknown,extra={})=>f.nativeApp.inject({method:'POST',url:path+suffix,headers:{...headers,...extra},payload:payload as any});
  const current=await f.nativeApp.inject({url:path+'/current',headers});assert.equal(current.statusCode,200,current.body);
  const challenge=await post('/challenges',request);assert.equal(challenge.statusCode,200,challenge.body);
  const proof={requestId:request.requestId,...target,authorityRef:ar,credentialGeneration:a.credentialGeneration,serverNonce:challenge.json().serverNonce};
  const signed=(p=proof)=>({'x-anvil-native-proof':Buffer.from(canonicalJson(p)).toString('base64url'),'x-anvil-native-signature':sign('sha256',nativeRequestProofBytes(p),{key:testPrivateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')});
  return {...f,a,ar,row,path,headers,body,request,post,proof,signed,challenge:challenge.json()};
 }catch(error){await f.close();throw error;}
}

test('직접 표 거절 RAM DB에서 실제 다섯 host handler·원 서명·원장/head·replay가 연결된다',async()=>{
 const f=await prepared();try{
  const storage=f.hostStorage!;
  // 동일 packet 두 호출도 원 project 거래 직렬화 아래 challenge 추가 발급이 없다.
  const challenges=await Promise.all([f.post('/challenges',f.request),f.post('/challenges',f.request)]);for(const r of challenges){assert.equal(r.statusCode,200,r.body);assert.deepEqual(r.json(),f.challenge);}
  storage.failConsume=true;const partial=await f.post('/consume',f.body,f.signed());assert.equal(partial.statusCode,503);assert.equal(f.data().nativeEvents.length,2);storage.failConsume=false;
  const consumed=await f.post('/consume',f.body,f.signed());assert.equal(consumed.statusCode,200,consumed.body);assert.equal(consumed.json().disposition,'FIRST_COMMIT');assert.equal(f.data().nativeEvents.length,4);
  const replay=await f.post('/consume',f.body,f.signed());assert.equal(replay.statusCode,200,replay.body);assert.equal(replay.json().disposition,'REPLAY_ONLY');assert.equal(replay.json().factoryPermit,null);
  const processRef={runId:id(9883),generation:1,jobId:id(9884),pid:50,startTicks:'133000000000000000',executableHash:'e'.repeat(64)},request={schemaVersion:1,requestId:id(9885),authorityRef:f.ar,consumeReceiptRef:consumed.json().receipt.ref,localAttemptRef:f.body.localAttemptRef,processRef};
  f.service.connectNativeOwnershipReturn({current:async input=>{assert.equal('processRef'in input,false);return {authorityRef:f.ar,consumeReceiptRef:request.consumeReceiptRef,nativeFactoryRef:f.a.scope.nativeFactoryRef,registrationRef:f.a.scope.registrationRef,sourceScopeHash:f.a.scope.sourceScopeHash,observerRef:ref(9886),runId:processRef.runId,processGeneration:1,workerHash:processRef.executableHash,checkedAt:f.clockDate().toISOString(),expiresAt:f.a.expiresAt};}});
  const issued=await f.post('/ownership-requests',request);assert.equal(issued.statusCode,200,issued.body);
  const facts={processRef,state:'PREPARED',everResumed:false,active:1,processes:[{pid:50,startTicks:processRef.startTicks,inJob:true,executableHash:processRef.executableHash}],killOnClose:false,fileSandboxVerified:false},report={...issued.json().request,factsHash:nativeHash(facts),observedAt:f.clockDate().toISOString()};
  const packet={schemaVersion:1,authorityRef:f.ar,consumeReceiptRef:request.consumeReceiptRef,localAttemptRef:f.body.localAttemptRef,bindingRef:issued.json().bindingRef,report,facts,signature:sign('sha256',ownershipObservationBytesV1(report),{key:testPrivateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};
  const accepted=await f.post('/ownership-results',packet);assert.equal(accepted.statusCode,200,accepted.body);assert.equal(accepted.json().executionAuthorized,false);assert.equal(accepted.json().dispatchPerformed,false);
  const repeated=await f.post('/ownership-results',packet);assert.equal(repeated.statusCode,200,repeated.body);assert.deepEqual(repeated.json(),accepted.json());assert.equal(storage.state.events.length,3);assert.equal(storage.state.heads.length,1);
  assert.deepEqual(new Set(storage.purposes),new Set(['CURRENT','CHALLENGE','CONSUME','OWNERSHIP_REQUEST','OWNERSHIP_ACCEPT']));assert.deepEqual(storage.denied,[]);
 }finally{await f.close();}
});

test('원 Node 서명·세대·scope·등록 및 replay read 철회는 목적 저장 전에 거절한다',async()=>{
 const f=await prepared();try{
  for(const change of [(p:any)=>{p.credentialGeneration++;},(p:any)=>{p.authorityRef={...p.authorityRef,id:id(9991)};p.path='/api/v1/connector/native-preparations/'+id(9991)+'/consume';},(p:any)=>{p.serverNonce=Buffer.alloc(32,1).toString('base64url');}]){const p=structuredClone(f.proof);change(p);const r=await f.post('/consume',f.body,f.signed(p));assert.equal(r.statusCode,409,r.body);assert.equal(f.data().nativeEvents.length,2);}
  const forged=await f.post('/consume',f.body,{...f.signed(),'x-anvil-native-signature':Buffer.alloc(64,1).toString('base64url')});assert.equal(forged.statusCode,403,forged.body);assert.equal(f.data().nativeEvents.length,2);
  const consumed=await f.post('/consume',f.body,f.signed());assert.equal(consumed.statusCode,200,consumed.body);
  f.deny();const denied=await f.post('/consume',f.body,f.signed());assert.equal(denied.statusCode,403,denied.body);assert.equal(f.data().nativeEvents.length,4,'read 정책 철회 후 replay도 추가 기록0');
 }finally{await f.close();}
});

test('v1은 반환 권한이 없고 COMMIT ROLLBACK·만료는 성공 결과로 전환하지 않는다',async()=>{
 const f=await prepared(1);try{
  const storage=f.hostStorage!;storage.commitTag='ROLLBACK';const unknown=await f.post('/consume',f.body,f.signed());assert.equal(unknown.statusCode,503,unknown.body);assert.equal(unknown.json().code,'NATIVE_OUTCOME_UNKNOWN');assert.equal(f.data().nativeEvents.length,2);storage.commitTag='COMMIT';
  const consumed=await f.post('/consume',f.body,f.signed());assert.equal(consumed.statusCode,200,consumed.body);
  const request={schemaVersion:1,requestId:id(9885),authorityRef:f.ar,consumeReceiptRef:consumed.json().receipt.ref,localAttemptRef:f.body.localAttemptRef,processRef:{runId:id(9883),generation:1,jobId:id(9884),pid:50,startTicks:'133000000000000000',executableHash:'e'.repeat(64)}};
  const denied=await f.post('/ownership-requests',request);assert.equal(denied.statusCode,403,denied.body);assert.equal(storage.state.bindings.length,0);
  f.advanceClock(120000);const expired=await f.post('/consume',f.body,f.signed());assert.equal(expired.statusCode,412,expired.body);assert.equal(f.data().nativeEvents.length,4);
 }finally{await f.close();}
});
