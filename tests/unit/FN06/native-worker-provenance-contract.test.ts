import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeHash} from '../../../contracts/runtime/native-preparation-authority-v1.ts';
import {createHash} from 'node:crypto';

const id=(n:number)=>'ad140002-0000-4000-8000-'+String(n).padStart(12,'0');
const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
function vector(){
 const at='2030-01-01T00:00:00.000Z',end='2030-01-01T00:00:30.000Z';
 const authority={schemaVersion:2,purpose:'NATIVE_PREPARATION_AUTHORITY',authorityId:id(1),credentialId:id(2),credentialGeneration:1,scope:{installationId:id(3),projectId:id(4),executionId:id(5),executionGeneration:1,authorityEpoch:1,leaseId:id(6),registrationRef:ref(7),nativeFactoryRef:ref(8),sourceScopeHash:'b'.repeat(64),writerHeadRef:ref(9),preparationRef:ref(10),hostPublicKeyFingerprint:'c'.repeat(64)},subject:{userId:id(11),clientId:id(12),humanSessionId:id(13),controlGeneration:1,credentialGeneration:1},parent:{commandRef:ref(14),authorizationReceiptRef:ref(15),auditRef:ref(16)},policyRef:ref(17),channelProfileRef:ref(18),allowedOperations:['CHECK_NATIVE_PREPARATION_CURRENT','CONSUME_NATIVE_PREPARATION','RETURN_NATIVE_PREPARATION_OWNERSHIP'],issuedAt:at,expiresAt:end,codingAgentExecutionAuthorized:false,agentDispatchPerformed:false};
 const authorityRef={id:id(1),version:1,contentHash:nativeHash(authority)};
 const snapshot={schemaVersion:1,purpose:'NATIVE_PREPARATION_CONSUME_RECEIPT',authorityRef,preparationRef:ref(10),writerHeadRef:ref(9),requestId:id(19),requestHash:'d'.repeat(64),challengeRef:ref(21),proofEventRef:ref(22),localAttemptRef:ref(20),at,expiresAt:end,codingAgentExecutionAuthorized:false,agentDispatchPerformed:false};
 const receipt={ref:{id:id(23),version:1,contentHash:nativeHash(snapshot)},snapshot};
 const ds={schemaVersion:1,purpose:'NATIVE_PREPARATION_WORKER_DESCRIPTOR',nativeFactoryRef:ref(8),packageRef:ref(40),buildReceiptRef:ref(41),rootId:id(42),relativePath:'OwnershipEvidenceWorker.exe',workerHash:'e'.repeat(64),issuedAt:at,expiresAt:end};
 const descriptor={ref:{id:id(8),version:1,contentHash:nativeHash(ds)},snapshot:ds};
 return {authority,receipt,consumeRecordRef:ref(28),descriptor,at,end};
}
async function api(){const m=await import('../../../contracts/runtime/native-worker-provenance-v1.ts').catch(()=>null);assert.ok(m,'worker descriptor/consume 파생기가 아직 없다');return m;}

test('고정 canonical bytes/SHA는 receipt run·record observer·별도 bridge UUID를 구분한다',async()=>{
 const expected="{\"authorityRef\":{\"contentHash\":\"c219596c5cedc0fcc3a964e60b0117c859d3bd99c5e40b385a46d904da008385\",\"id\":\"ad140002-0000-4000-8000-000000000001\",\"version\":1},\"consumeReceiptRef\":{\"contentHash\":\"f59164e52990b51da1654ae36ca7fcbba385438025479794a5cc4c5678365ee9\",\"id\":\"ad140002-0000-4000-8000-000000000023\",\"version\":1},\"consumeRecordRef\":{\"contentHash\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"id\":\"ad140002-0000-4000-8000-000000000028\",\"version\":1},\"nativeFactoryRef\":{\"contentHash\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"id\":\"ad140002-0000-4000-8000-000000000008\",\"version\":1},\"processGeneration\":1,\"purpose\":\"NATIVE_PREPARATION_OBSERVER_BASIS\",\"registrationRef\":{\"contentHash\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"id\":\"ad140002-0000-4000-8000-000000000007\",\"version\":1},\"runId\":\"ad140002-0000-4000-8000-000000000023\",\"schemaVersion\":1,\"sourceScopeHash\":\"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\",\"workerDescriptorRef\":{\"contentHash\":\"6310bcc23d2a34b9e43cdaefa4d0b721cb3a60a10e4123de0d5dadea14df76e6\",\"id\":\"ad140002-0000-4000-8000-000000000008\",\"version\":1}}";
 const expectedHash='49ef33f028085d78f933f9306b3c053e4f48e32613d2b8e5723ca2aacc9277b9',bridgeRunId=id(77),v=vector(),m=await api();
 const result=m.deriveNativeWorkerBasis(v.authority,v.receipt,v.consumeRecordRef,v.descriptor,Date.parse(v.at));
 assert.deepEqual(result.observer.snapshot,JSON.parse(expected));
 assert.equal(createHash('sha256').update(expected,'utf8').digest('hex'),expectedHash);
 assert.equal(result.observer.ref.contentHash,expectedHash);assert.equal(v.descriptor.ref.contentHash,'6310bcc23d2a34b9e43cdaefa4d0b721cb3a60a10e4123de0d5dadea14df76e6');
 assert.equal(new Set([v.authority.authorityId,v.receipt.ref.id,v.consumeRecordRef.id,bridgeRunId]).size,4);
 assert.notEqual(result.basis.runId,bridgeRunId);assert.equal(result.observer.ref.id,v.consumeRecordRef.id);
 assert.notEqual(result.observer.ref.contentHash,v.consumeRecordRef.contentHash);
});
test('원 descriptor의 별도 목적 hash와 consume receipt/record별 identity를 파생한다',async()=>{
 const m=await api(),v=vector(),r=m.deriveNativeWorkerBasis(v.authority,v.receipt,v.consumeRecordRef,v.descriptor,Date.parse(v.at));
 assert.equal(r.basis.runId,id(23));assert.equal(r.basis.processGeneration,1);assert.equal(r.basis.observerRef.id,id(28));assert.notDeepEqual(r.basis.observerRef,v.consumeRecordRef);
 assert.equal(r.observer.snapshot.purpose,'NATIVE_PREPARATION_OBSERVER_BASIS');assert.deepEqual(r.observer.snapshot.workerDescriptorRef,v.descriptor.ref);assert.notDeepEqual(v.descriptor.ref,v.descriptor.snapshot.nativeFactoryRef);
 assert.deepEqual(m.deriveNativeWorkerBasis(v.authority,v.receipt,v.consumeRecordRef,v.descriptor,Date.parse(v.at)),r);
 const wrong=structuredClone(v.receipt);wrong.snapshot.authorityRef=ref(99);wrong.ref.contentHash=nativeHash(wrong.snapshot);assert.throws(()=>m.deriveNativeWorkerBasis(v.authority,wrong,v.consumeRecordRef,v.descriptor,Date.parse(v.at)));
 const changed=structuredClone(v.descriptor);changed.snapshot.nativeFactoryRef=ref(99);changed.ref.id=id(99);changed.ref.contentHash=nativeHash(changed.snapshot);assert.throws(()=>m.deriveNativeWorkerBasis(v.authority,v.receipt,v.consumeRecordRef,changed,Date.parse(v.at)));
 assert.throws(()=>m.deriveNativeWorkerBasis(v.authority,v.receipt,v.consumeRecordRef,v.descriptor,Date.parse(v.end)));
});
test('Proxy/accessor는 trap0으로 거절하며 목적 교체·추가필드·미래 발행을 거절한다',async()=>{
 const m=await api(),v=vector();let traps=0;
 const p=new Proxy(v.descriptor,{get(){traps++;throw Error('trap');},getOwnPropertyDescriptor(){traps++;throw Error('trap');},getPrototypeOf(){traps++;throw Error('trap');}});
 assert.throws(()=>m.readNativeWorkerDescriptor(p));assert.equal(traps,0);
 const x={...v.descriptor,get snapshot(){traps++;return v.descriptor.snapshot;}};assert.throws(()=>m.readNativeWorkerDescriptor(x));assert.equal(traps,0);
 for(const field of ['purpose','relativePath']){const d:any=structuredClone(v.descriptor);d.snapshot[field]='OTHER';d.ref.contentHash=nativeHash(d.snapshot);assert.throws(()=>m.readNativeWorkerDescriptor(d));}
 assert.throws(()=>m.readNativeWorkerDescriptor({...v.descriptor,extra:1}));
 assert.throws(()=>m.deriveNativeWorkerBasis(v.authority,v.receipt,v.consumeRecordRef,v.descriptor,Date.parse(v.at)-1));
});
