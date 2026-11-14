import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canonicalJson} from '../../../contracts/canonical.ts';
import {nativeHash,readNativeAuthority,nativeRequestProofBytes} from '../../../contracts/runtime/native-preparation-authority-v1.ts';
import * as returned from '../../../contracts/runtime/native-preparation-ownership-return-v1.ts';

const id=(n:number)=>'ad140001-0000-4000-8000-'+String(n).padStart(12,'0');
const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
function authority(){return {schemaVersion:1,purpose:'NATIVE_PREPARATION_AUTHORITY',authorityId:id(1),credentialId:id(2),credentialGeneration:1,scope:{installationId:id(3),projectId:id(4),executionId:id(5),executionGeneration:1,authorityEpoch:1,leaseId:id(6),registrationRef:ref(7),nativeFactoryRef:ref(8),sourceScopeHash:'b'.repeat(64),writerHeadRef:ref(9),preparationRef:ref(10),hostPublicKeyFingerprint:'c'.repeat(64)},subject:{userId:id(11),clientId:id(12),humanSessionId:id(13),controlGeneration:1,credentialGeneration:1},parent:{commandRef:ref(14),authorizationReceiptRef:ref(15),auditRef:ref(16)},policyRef:ref(17),channelProfileRef:ref(18),allowedOperations:['CHECK_NATIVE_PREPARATION_CURRENT','CONSUME_NATIVE_PREPARATION'],issuedAt:'2030-01-01T00:00:00.000Z',expiresAt:'2030-01-01T00:01:00.000Z',codingAgentExecutionAuthorized:false,agentDispatchPerformed:false};}
test('v2 RETURN 선택은 v1 판독기를 넓히지 않고 원 consume proof bytes를 보존한다',()=>{
 const v1=authority(),v2={...v1,schemaVersion:2,allowedOperations:[...v1.allowedOperations,'RETURN_NATIVE_PREPARATION_OWNERSHIP']};
 assert.deepEqual(readNativeAuthority(v1),v1);
 assert.throws(()=>readNativeAuthority(v2));
 assert.deepEqual(returned.readNativeReturnAuthority(v2),v2);
 assert.throws(()=>returned.readNativeReturnAuthority(v1));
 for(const change of [(x:any)=>x.allowedOperations.pop(),(x:any)=>x.allowedOperations.push('SIGN_PROOF'),(x:any)=>x.schemaVersion=1]){const n=structuredClone(v2);change(n);assert.throws(()=>returned.readNativeReturnAuthority(n));}
 const authorityRef={id:v1.authorityId,version:1,contentHash:nativeHash(v1)},proof={requestId:id(19),method:'POST',path:'/api/v1/connector/native-preparations/'+id(1)+'/consume',queryHash:nativeHash({}),bodyHash:nativeHash({schemaVersion:1,authorityRef,localAttemptRef:ref(20)}),authorityRef,credentialGeneration:1,serverNonce:'A'.repeat(43)};
 assert.equal(nativeRequestProofBytes(proof).toString(),canonicalJson({purpose:'NATIVE_PREPARATION_REQUEST_PROOF',request:proof}));
 assert.notEqual(nativeHash(v1),nativeHash(v2));
});
test('반환 request는 정확 원 tuple과 process만 받고 target/current/실행 권위를 받지 않는다',()=>{
 const request={schemaVersion:1,requestId:id(21),authorityRef:ref(1),consumeReceiptRef:ref(22),localAttemptRef:ref(20),processRef:{runId:id(23),generation:1,jobId:id(24),pid:20,startTicks:'133000000000000000',executableHash:'d'.repeat(64)}};
 assert.deepEqual(returned.readNativeOwnershipRequest(request),request);
 for(const change of [(x:any)=>x.expectedHeadRef=null,(x:any)=>x.current=true,(x:any)=>x.processRef.pid=0,(x:any)=>x.processRef.startTicks='1',(x:any)=>x.processRef.generation=0,(x:any)=>x.authorityRef.version=2]){const n=structuredClone(request);change(n);assert.throws(()=>returned.readNativeOwnershipRequest(n));}
});
test('native consume signer는 명시 v1/v2만 선택하고 원 authority hash 및 서명 목적을 보존한다',async()=>{
 const source=await readFile(new URL('../../../apps/connector/native/NativePreparationProofSource.cs',import.meta.url),'utf8');
 assert.match(source,/long authorityVersion = Positive\(a\["schemaVersion"\]\);/);
 assert.match(source,/authorityVersion != 1 && authorityVersion != 2/);
 assert.match(source,/authorityVersion == 1/);
 assert.match(source,/RETURN_NATIVE_PREPARATION_OWNERSHIP/);
 assert.ok(source.includes('Hash(Utf8.GetBytes(Canonical(a,0))) != Text(authorityRef,"contentHash")'));
 assert.ok(source.includes('NATIVE_PREPARATION_REQUEST_PROOF'));
 assert.doesNotMatch(source,/purpose.*OWNERSHIP_OBSERVATION/);
});
test('v2 선택기는 accessor를 실행하거나 v1 권위를 자동 승격하지 않는다',()=>{
 let reads=0;const value=authority();Object.defineProperty(value,'schemaVersion',{enumerable:true,get(){reads++;return 2;}});
 assert.throws(()=>returned.readNativePreparationAuthority(value));assert.equal(reads,0);
 assert.deepEqual(returned.readNativePreparationAuthority(authority()),authority());
});
test('v2 exact3 operation은 export 배열 변조로 추가·삭제·교체할 수 없다',()=>{
 const expected=['CHECK_NATIVE_PREPARATION_CURRENT','CONSUME_NATIVE_PREPARATION','RETURN_NATIVE_PREPARATION_OWNERSHIP'];
 const operations=returned.nativeReturnOperations as unknown as string[];
 for(const mutate of [(v:string[])=>v.push('SIGN_PROOF'),(v:string[])=>v.pop(),(v:string[])=>{v[2]='SIGN_PROOF';}]){
  try{
   assert.throws(()=>mutate(operations),TypeError);
   assert.deepEqual(operations,expected);
  }finally{
   // RED에서도 뒤 시험에 변조한 모듈 상태를 남기지 않는다.
   if(!Object.isFrozen(operations))operations.splice(0,operations.length,...expected);
  }
 }
 const v2={...authority(),schemaVersion:2,allowedOperations:[...expected]};
 assert.deepEqual(returned.readNativeReturnAuthority(v2),v2);
 for(const invalid of [[...expected,'SIGN_PROOF'],expected.slice(0,2),[...expected.slice(0,2),'SIGN_PROOF']])
  assert.throws(()=>returned.readNativeReturnAuthority({...v2,allowedOperations:invalid}));
});
test('v2 root와 중첩 Proxy는 trap0으로 거절하고 검산한 단일 snapshot만 반환한다',()=>{
 const plain={...authority(),schemaVersion:2,allowedOperations:[...returned.nativeReturnOperations] as string[]};
 let traps=0;
 const hooks={get(){traps++;throw Error('TRAP');},getPrototypeOf(){traps++;throw Error('TRAP');},ownKeys(){traps++;throw Error('TRAP');},getOwnPropertyDescriptor(){traps++;throw Error('TRAP');}};
 for(const value of [new Proxy(plain,hooks),{...plain,allowedOperations:new Proxy([...plain.allowedOperations],hooks)},{...plain,scope:new Proxy(plain.scope,hooks)}]){
  assert.throws(()=>returned.readNativeReturnAuthority(value));
  assert.throws(()=>returned.readNativePreparationAuthority(value));
 }
 assert.equal(traps,0);
 const read=returned.readNativeReturnAuthority(plain);plain.allowedOperations.push('SIGN_PROOF');
 assert.deepEqual(read.allowedOperations,returned.nativeReturnOperations);
});

function returnFixture(){
 const original=authority();original.scope.registrationRef.version=4;
 const a=returned.readNativeReturnAuthority({...original,schemaVersion:2,allowedOperations:[...returned.nativeReturnOperations]}),ar={id:a.authorityId,version:1,contentHash:nativeHash(a)};
 const input={schemaVersion:1 as const,requestId:id(21),authorityRef:ar,consumeReceiptRef:ref(22),localAttemptRef:ref(20),processRef:{runId:id(23),generation:1,jobId:id(24),pid:20,startTicks:'133000000000000000',executableHash:'d'.repeat(64)}};
 const snapshot={schemaVersion:2,purpose:'PROCESS_OWNERSHIP_ANCHOR',transport:'NATIVE_PREPARATION_RETURN',scope:{installationId:a.scope.installationId,projectId:a.scope.projectId,executionId:a.scope.executionId,executionGeneration:a.scope.executionGeneration,executorRegistrationRef:a.scope.registrationRef},parent:{authorityRef:ar,consumeReceiptRef:input.consumeReceiptRef,localAttemptRef:input.localAttemptRef},processRef:input.processRef,observerRef:ref(25),recordedAt:a.issuedAt,expiresAt:'2030-01-01T00:00:10.000Z',state:'BOUND',fileSandboxVerified:false,executionAuthorized:false,dispatchPerformed:false};
 const candidateAnchor={ref:{id:id(26),version:1,contentHash:nativeHash(snapshot)},snapshot};
 const request={protocolVersion:1,purpose:'OWNERSHIP_OBSERVATION',installationId:a.scope.installationId,projectId:a.scope.projectId,executionId:a.scope.executionId,executionGeneration:a.scope.executionGeneration,registrationRef:a.scope.registrationRef,publicKeyFingerprint:a.scope.hostPublicKeyFingerprint,observerRef:ref(25),anchorRef:candidateAnchor.ref,preparationRef:a.scope.preparationRef,requestRef:ref(27),phase:'BOOTSTRAP_PREPARED',expectedHeadRef:null,nonce:'A'.repeat(43),requestedAt:snapshot.recordedAt,expiresAt:snapshot.expiresAt};
 return {a,input,response:{bindingRef:ref(28),request,candidateAnchor}};
}
test('채택 native anchor는 원 authority/consume/process/hash와 정확 결박하고 synthetic 부모를 받지 않는다',()=>{
 const {a,input,response}=returnFixture(),read=(returned as any).matchNativeOwnershipResponse;
 assert.deepEqual(read(response,input,a),response);
 for(const change of [(x:any)=>x.candidateAnchor.snapshot.transport='SYNTHETIC_ONLY',(x:any)=>x.candidateAnchor.snapshot.parent.localAttemptRef=ref(99),(x:any)=>x.candidateAnchor.snapshot.scope.executorRegistrationRef=ref(99),(x:any)=>x.candidateAnchor.snapshot.processRef.pid++,(x:any)=>x.candidateAnchor.snapshot.sessionBindingRef=ref(99),(x:any)=>x.request.phase='CURRENT',(x:any)=>x.request.anchorRef=ref(99),(x:any)=>x.request.publicKeyFingerprint='e'.repeat(64),(x:any)=>x.candidateAnchor.ref.contentHash='f'.repeat(64)]){
  const x=structuredClone(response);change(x);
  if(nativeHash(x.candidateAnchor.snapshot)!==nativeHash(response.candidateAnchor.snapshot)){
   x.candidateAnchor.ref.contentHash=nativeHash(x.candidateAnchor.snapshot);x.request.anchorRef={...x.candidateAnchor.ref};
  }
  assert.throws(()=>read(x,input,a));
 }
 // 원 만료 request 역사 응답은 형상 검산 가능하며 새 수용 기한 검사는 서버가 별도로 수행한다.
 assert.deepEqual(read(response,input,a).request.expiresAt,response.request.expiresAt);
});
test('native result는 기존 ownership report/facts를 재사용하고 CURRENT·facts 변조·signature 형식을 거절한다',()=>{
 const {input,response}=returnFixture();
 const facts={processRef:input.processRef,state:'PREPARED',everResumed:false,active:1,processes:[{pid:20,startTicks:input.processRef.startTicks,inJob:true,executableHash:input.processRef.executableHash}],killOnClose:false,fileSandboxVerified:false};
 const body={schemaVersion:1,authorityRef:input.authorityRef,consumeReceiptRef:input.consumeReceiptRef,localAttemptRef:input.localAttemptRef,bindingRef:response.bindingRef,report:{...response.request,factsHash:nativeHash(facts),observedAt:'2030-01-01T00:00:01.000Z'},facts,signature:Buffer.alloc(64,1).toString('base64url')};
 const read=(returned as any).readNativeOwnershipResult;
 assert.deepEqual(read(body),body);
 for(const change of [(x:any)=>x.facts.processes[0].pid++,(x:any)=>x.report.phase='CURRENT',(x:any)=>x.signature+='=',(x:any)=>x.facts.fileSandboxVerified=true,(x:any)=>x.method='POST']){const x=structuredClone(body);change(x);assert.throws(()=>read(x));}
});
