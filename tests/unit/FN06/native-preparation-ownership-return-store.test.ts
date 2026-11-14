import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {nativeHash} from '../../../contracts/runtime/native-preparation-authority-v1.ts';
import {ownershipObservationBytesV1} from '../../../contracts/runtime/ownership-observation-v1.ts';
import {publicKeyFingerprint} from '../../../apps/server/modules/connections/registration-proof.ts';
import {planNativeOwnershipRequest,planNativeOwnershipAcceptance} from '../../../apps/server/modules/executions/native-preparation-ownership-return.ts';

const id=(n:number)=>'ad140002-0000-4000-8000-'+String(n).padStart(12,'0'),ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
function fixture(){
 const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=keys.publicKey.export({type:'spki',format:'der'}).toString('base64url');
 const at='2030-01-01T00:00:00.000Z',expiresAt='2030-01-01T00:00:30.000Z';
 const authority={schemaVersion:2,purpose:'NATIVE_PREPARATION_AUTHORITY',authorityId:id(1),credentialId:id(2),credentialGeneration:1,scope:{installationId:id(3),projectId:id(4),executionId:id(5),executionGeneration:1,authorityEpoch:1,leaseId:id(6),registrationRef:ref(7),nativeFactoryRef:ref(8),sourceScopeHash:'b'.repeat(64),writerHeadRef:ref(9),preparationRef:ref(10),hostPublicKeyFingerprint:publicKeyFingerprint(spki)},subject:{userId:id(11),clientId:id(12),humanSessionId:id(13),controlGeneration:1,credentialGeneration:1},parent:{commandRef:ref(14),authorizationReceiptRef:ref(15),auditRef:ref(16)},policyRef:ref(17),channelProfileRef:ref(18),allowedOperations:['CHECK_NATIVE_PREPARATION_CURRENT','CONSUME_NATIVE_PREPARATION','RETURN_NATIVE_PREPARATION_OWNERSHIP'],issuedAt:at,expiresAt,codingAgentExecutionAuthorized:false,agentDispatchPerformed:false};
 const authorityRef={id:id(1),version:1,contentHash:nativeHash(authority)},localAttemptRef=ref(20);
 const cs={schemaVersion:1,purpose:'NATIVE_PREPARATION_CONSUME_RECEIPT',authorityRef,preparationRef:ref(10),writerHeadRef:ref(9),requestId:id(19),requestHash:'d'.repeat(64),challengeRef:ref(21),proofEventRef:ref(22),localAttemptRef,at,expiresAt,codingAgentExecutionAuthorized:false,agentDispatchPerformed:false};
 const receipt={ref:{id:id(23),version:1,contentHash:nativeHash(cs)},snapshot:cs};
 const input={schemaVersion:1,requestId:id(24),authorityRef,consumeReceiptRef:receipt.ref,localAttemptRef,processRef:{runId:id(25),generation:1,jobId:id(26),pid:50,startTicks:'133000000000000000',executableHash:'e'.repeat(64)}};
 const basis={authorityRef,consumeReceiptRef:receipt.ref,nativeFactoryRef:ref(8),registrationRef:ref(7),sourceScopeHash:authority.scope.sourceScopeHash,observerRef:ref(27),runId:id(25),processGeneration:1,workerHash:'e'.repeat(64),checkedAt:at,expiresAt};
 const plan=()=>planNativeOwnershipRequest({authority,consumeReceipt:receipt,consumeRecordRef:ref(28),input,basis,nowMs:Date.parse(at),expiresAt,nonce:Buffer.alloc(32,5).toString('base64url'),ids:[id(29),id(30),id(31)]});
 const result=(p:ReturnType<typeof plan>)=>{const facts={processRef:input.processRef,state:'PREPARED',everResumed:false,active:1,processes:[{pid:50,startTicks:input.processRef.startTicks,inJob:true,executableHash:basis.workerHash}],killOnClose:false,fileSandboxVerified:false};const report={...p.response.request,factsHash:nativeHash(facts),observedAt:'2030-01-01T00:00:01.000Z'};return {schemaVersion:1,authorityRef,consumeReceiptRef:receipt.ref,localAttemptRef,bindingRef:p.binding.ref,report,facts,signature:sign('sha256',ownershipObservationBytesV1(report),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};};
 return {authority,receipt,input,basis,spki,plan,result,at,expiresAt};
}

import {NativeOwnershipReturnStore} from '../../../apps/server/modules/executions/native-preparation-ownership-return-store.ts';
import {createRequire} from 'node:module';
import {createNativeWorkerOwnershipBasisSource} from '../../../apps/server/modules/executions/native-worker-ownership-basis-source.ts';
const {withWorkerBuild,workerPE}=createRequire(import.meta.url)('../../desktop/native-worker-build.test.cjs');
function memory(f:ReturnType<typeof fixture>){
 const bindings:any[]=[],events:any[]=[],results:any[]=[],observations:any[]=[],heads:any[]=[];let now=Date.parse(f.at),reads=0;
 const db={async query(sql:string,args:any[]=[]):Promise<any>{
  if(sql.includes('FROM anvil.native_preparation_ownership_bindings'))return {rows:bindings};
  if(sql.includes('FROM anvil.native_preparation_ownership_results'))return {rows:results};
  if(sql.includes('FROM anvil.execution_ownership_heads'))return {rows:heads};
  if(sql.includes('COALESCE(MAX(project_sequence)'))return {rows:[{value:events.length}]};
  if(sql.includes('FROM anvil.execution_ownership_events'))return {rows:events};
  if(sql.startsWith('INSERT INTO anvil.native_preparation_ownership_bindings'))bindings.push({id:args[3],content_hash:args[7],snapshot_json:JSON.parse(args[8]),plan_json:JSON.parse(args[9])});
  else if(sql.startsWith('INSERT INTO anvil.execution_ownership_events'))events.push({event_id:args[3],version:1,sequence:args[4],project_sequence:args[5],content_hash:args[6],snapshot_json:JSON.parse(args[7])});
  else if(sql.startsWith('INSERT INTO anvil.native_preparation_ownership_results'))results.push({id:args[2],packet_hash:args[3],content_hash:args[4],snapshot_json:JSON.parse(args[5])});
  else if(sql.startsWith('INSERT INTO anvil.execution_ownership_observations'))observations.push(args);
  else if(sql.startsWith('INSERT INTO anvil.execution_ownership_heads'))heads.push(args);
  else if(!sql.startsWith('INSERT INTO anvil.execution_ownership_anchors'))throw Error('UNEXPECTED_SQL '+sql);
  return {rows:[],rowCount:1};
 }};
 const current=async()=>({checkedAt:new Date(now).toISOString(),expiresAt:f.expiresAt,publicKeySpki:f.spki});
 const source={current:async(_input:unknown)=>{reads++;return {...f.basis,checkedAt:new Date(now).toISOString()};}};
 let serial=100;const store=new NativeOwnershipReturnStore(source,n=>Array.from({length:n},()=>id(serial++)),()=>Buffer.alloc(32,5).toString('base64url'));
 const context={db:db as any,authority:f.authority,consumeReceipt:f.receipt,consumeRecordRef:ref(28),current,check:()=>{},signal:new AbortController().signal};
 return {store,context,source,bindings,events,results,observations,heads,setNow:(at:number)=>{now=at;},reads:()=>reads};
}
test('store는 request 한 번과 원 만료 역사 재조회, 서명된 수용 한 번과 원 receipt 재조회를 유지한다',async()=>{
 const f=fixture(),m=memory(f),first=await m.store.request(m.context,f.input);
 assert.equal(m.bindings.length,1);assert.equal(m.events.length,1);
 assert.deepEqual((await m.store.request(m.context,f.input)).payload,first.payload);
 await assert.rejects(m.store.request(m.context,{...f.input,requestId:id(98)}));
 const p=m.bindings[0].plan_json,body=f.result(p);m.setNow(Date.parse(body.report.observedAt));
 const accepted=await m.store.accept(m.context,body);assert.equal(m.observations.length,1);assert.equal(m.heads.length,1);assert.equal(m.results.length,1);
 assert.deepEqual((await m.store.accept(m.context,body)).payload,accepted.payload);
 assert.equal(m.events.length,3);
 m.setNow(Date.parse(f.at)+11000);
 assert.deepEqual((await m.store.request(m.context,f.input)).payload,first.payload);
 assert.deepEqual((await m.store.accept(m.context,body)).payload,accepted.payload);
});
test('store는 basis 미설정·교체/현재성 철회와 expired 미수용을 닫고 원 nonce를 다시 만들지 않는다',async()=>{
 const f=fixture(),m=memory(f);
 const absent=new NativeOwnershipReturnStore(null,n=>Array.from({length:n},()=>id(50)),()=>Buffer.alloc(32).toString('base64url'));
 await assert.rejects(absent.request(m.context,f.input));assert.equal(m.events.length,0);
 await m.store.request(m.context,f.input);const p=m.bindings[0].plan_json;
 m.setNow(Date.parse(p.response.request.expiresAt));
 await assert.rejects(m.store.accept(m.context,f.result(p)),/NATIVE_SOURCE_EXPIRED/);
 assert.equal(m.observations.length,0);assert.equal(m.events.length,1);
 m.source.current=async()=>({...f.basis});
 await assert.rejects(m.store.request(m.context,f.input));
});
test('basis가 abort를 무시해도 거래 대기를 끝내고 늦은 관측 결과로 DB에 쓰지 않는다',async()=>{
 const f=fixture(),m=memory(f),controller=new AbortController();let resolve!:(v:unknown)=>void,entered!:(v?:unknown)=>void;
 const ready=new Promise(r=>{entered=r;}),source={current:async(input:any)=>{assert.equal('db'in input,false);entered();return new Promise(r=>{resolve=r;});}};
 const store=new NativeOwnershipReturnStore(source,n=>Array.from({length:n},(_,i)=>id(60+i)),()=>Buffer.alloc(32).toString('base64url'));
 const work=store.request({...m.context,signal:controller.signal},f.input);await ready;controller.abort();
 await assert.rejects(work,/NATIVE_OUTCOME_UNKNOWN/);resolve(f.basis);await new Promise(r=>setImmediate(r));
 assert.equal(m.bindings.length,0);assert.equal(m.events.length,0);
});

test('원 worker build reader→basis→기존 store의 요청·실서명 수용은 동일 consume와 observer에 결박된다',async()=>{
 await withWorkerBuild(async(w:any)=>{
  const build=await w.worker.createNativeWorkerBuild({factoryArtifact:w.artifact,configuration:w.config},w.ports),token=await build.build(async()=>workerPE());
  const descriptor=w.worker.readNativeWorkerProduct(token).descriptor,f=fixture();
  Object.assign(f.authority.scope.nativeFactoryRef,w.artifact.factoryRef);
  f.input.authorityRef.contentHash=nativeHash(f.authority);
  f.receipt.ref.contentHash=nativeHash(f.receipt.snapshot);
  f.input.processRef.runId=f.receipt.ref.id;f.input.processRef.executableHash=descriptor.snapshot.workerHash;f.basis.workerHash=descriptor.snapshot.workerHash;
  const m=memory(f);let revoked=false,observed=0;
  const deployment={readCurrent:async(q:any)=>{observed++;if(revoked)throw Error('RAM_REVOKED');return{product:token,checkedAt:q.checkedAt,expiresAt:w.config.expiresAt};}};
  const source=createNativeWorkerOwnershipBasisSource(token,deployment,{readOriginal:w.worker.readNativeWorkerProduct});let serial=300;
  const store=new NativeOwnershipReturnStore(source,n=>Array.from({length:n},()=>id(serial++)),()=>Buffer.alloc(32,5).toString('base64url'));
  const first=await store.request(m.context,f.input),plan=m.bindings[0].plan_json;
  assert.equal(m.bindings.length,1);assert.equal(m.events.length,1);assert.equal(plan.response.request.observerRef.id,m.context.consumeRecordRef.id);
  assert.notEqual(plan.response.request.observerRef.contentHash,m.context.consumeRecordRef.contentHash);
  assert.deepEqual((await store.request(m.context,f.input)).payload,first.payload);
  const body=f.result(plan);m.setNow(Date.parse(body.report.observedAt));
  await store.accept(m.context,body);assert.equal(m.observations.length,1);assert.equal(m.heads.length,1);assert.equal(m.events.length,3);assert.ok(observed>=6);
  revoked=true;await assert.rejects(store.request(m.context,f.input));assert.equal(m.events.length,3);
 });
});
