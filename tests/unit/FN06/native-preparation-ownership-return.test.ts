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
 return {authority,receipt,input,basis,spki,plan,result,at,expiresAt,signReport:(report:unknown)=>sign('sha256',ownershipObservationBytesV1(report),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};
}
test('native 원 consume→request→실 RAM P256 report는 원 ledger accepted/adopted/head 계획에 연결된다',()=>{
 const f=fixture(),p=f.plan(),body=f.result(p),accepted=planNativeOwnershipAcceptance({request:p,input:body,spki:f.spki,nowMs:Date.parse(body.report.observedAt),ids:[id(40),id(41),id(42),id(43),id(44)]});
 assert.equal(p.requestEvent.snapshot.kind,'OBSERVATION_REQUESTED');assert.equal(p.requestEvent.snapshot.previousRef,null);
 assert.equal(p.response.candidateAnchor.snapshot.transport,'NATIVE_PREPARATION_RETURN');
 assert.deepEqual(accepted.events.map(e=>e.snapshot.kind),['OBSERVATION_ACCEPTED','ANCHOR_ADOPTED']);
 assert.deepEqual(accepted.head.snapshot.currentEventRef,accepted.events[1]!.ref);
 assert.deepEqual(accepted.receipt.snapshot.observationRef,accepted.observation.ref);
 assert.equal(accepted.response.executionAuthorized,false);assert.equal(accepted.response.dispatchPerformed,false);
});
test('보호 basis 미설정·다른 원 factory/image/consume·만료는 caller process 후보로 대체할 수 없다',()=>{
 const f=fixture(),base={authority:f.authority,consumeReceipt:f.receipt,consumeRecordRef:ref(28),input:f.input,basis:f.basis,nowMs:Date.parse(f.at),expiresAt:f.expiresAt,nonce:Buffer.alloc(32,5).toString('base64url'),ids:[id(29),id(30),id(31)]};
 for(const change of [(x:any)=>x.basis=null,(x:any)=>x.basis.workerHash='f'.repeat(64),(x:any)=>x.basis.nativeFactoryRef=ref(90),(x:any)=>x.basis.consumeReceiptRef=ref(90),(x:any)=>x.basis.checkedAt='2029-01-01T00:00:00.000Z',(x:any)=>x.authority.schemaVersion=1,(x:any)=>x.input.processRef.generation=2]){const x=structuredClone(base);change(x);assert.throws(()=>planNativeOwnershipRequest(x));}
});
test('원 nonce·head·report/facts·서명 교체와 만료 request의 새 수용을 거절한다',()=>{
 const f=fixture(),p=f.plan(),body=f.result(p),base={request:p,input:body,spki:f.spki,nowMs:Date.parse(body.report.observedAt),ids:[id(40),id(41),id(42),id(43),id(44)]};
 for(const change of [(x:any)=>x.input.report.nonce='A'.repeat(43),(x:any)=>x.input.bindingRef=ref(91),(x:any)=>x.input.facts.processRef.pid++,(x:any)=>x.input.signature=Buffer.alloc(64,1).toString('base64url'),(x:any)=>x.nowMs=Date.parse(p.response.request.expiresAt),(x:any)=>x.request.binding.snapshot.requestInputHash='f'.repeat(64)]){const x=structuredClone(base);change(x);assert.throws(()=>planNativeOwnershipAcceptance(x));}
});
test('원 consume/basis/current 기한 각각이 request의 최단 TTL이며 다른 SPKI의 재서명도 거절한다',()=>{
 const f=fixture(),end='2030-01-01T00:00:02.000Z';
 for(const shorter of ['consume','basis','current']){
  const receipt=structuredClone(f.receipt),input=structuredClone(f.input),basis=structuredClone(f.basis);
  if(shorter==='consume'){receipt.snapshot.expiresAt=end;receipt.ref.contentHash=nativeHash(receipt.snapshot);input.consumeReceiptRef=receipt.ref;basis.consumeReceiptRef=receipt.ref;}
  if(shorter==='basis')basis.expiresAt=end;
  const p=planNativeOwnershipRequest({authority:f.authority,consumeReceipt:receipt,consumeRecordRef:ref(28),input,basis,nowMs:Date.parse(f.at),expiresAt:shorter==='current'?end:f.expiresAt,nonce:Buffer.alloc(32,5).toString('base64url'),ids:[id(29),id(30),id(31)]});
  assert.equal(p.response.request.expiresAt,end);
 }
 const p=f.plan(),body=f.result(p),other=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 body.signature=sign('sha256',ownershipObservationBytesV1(body.report),{key:other.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 assert.throws(()=>planNativeOwnershipAcceptance({request:p,input:body,spki:f.spki,nowMs:Date.parse(body.report.observedAt),ids:[id(40),id(41),id(42),id(43),id(44)]}),/OWNERSHIP_OBSERVATION_PROOF_INVALID/);
 const changed=f.result(p);changed.facts.processRef.pid=51;changed.facts.processes[0]!.pid=51;changed.report.factsHash=nativeHash(changed.facts);
 changed.signature=f.signReport(changed.report);
 // 다른 process를 원 등록 키로 다시 서명해도 원 request의 process와 달라 거절된다.
 assert.throws(()=>planNativeOwnershipAcceptance({request:p,input:changed,spki:f.spki,nowMs:Date.parse(changed.report.observedAt),ids:[id(40),id(41),id(42),id(43),id(44)]}));
});
