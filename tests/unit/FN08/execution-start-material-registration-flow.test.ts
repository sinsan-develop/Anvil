import {readMaterialCredentialBasis} from '../../../apps/server/modules/executions/execution-material-credential-basis.ts';
import {createStartMaterialCredentialFixture,createConcreteStartMaterialStore} from '../../support/execution-material-credential-fixture.ts';

import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,generateKeyPairSync,randomBytes,randomUUID,sign,verify} from 'node:crypto';
import {publicKeyFingerprint} from '../../../apps/server/modules/connections/registration-proof.ts';
import {SyntheticStartMaterialBasis} from '../../../apps/server/modules/executions/execution-start-material-basis.ts';
import {SyntheticAuthenticatedMaterials} from '../../../apps/server/modules/executions/execution-authenticated-materials.ts';
import {SyntheticExecutionChallenges} from '../../../apps/server/modules/executions/execution-challenges.ts';
import {executionTarget,executionChallengeRequestBytes,executionProofBytes} from '../../../apps/server/modules/executions/execution-proof.ts';
import {SyntheticMaterialReceiver} from '../../../apps/connector/runtime/execution-material-receiver.ts';
import {SyntheticStartMaterialParts} from '../../../apps/server/modules/executions/execution-start-material-parts.ts';
import {SyntheticPgStartMaterialRegistration} from '../../../apps/server/modules/executions/execution-start-material-registration-store.ts';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {ProjectInitialExecutionQueue} from '../../../apps/server/modules/executions/execution-commands.ts';
import {ProjectLimitPolicies} from '../../../apps/server/modules/executions/runtime-policy.ts';
import {SyntheticPgChallengeStore} from '../../../apps/server/modules/executions/execution-challenge-store.ts';
import type {SyntheticPgInstructionMaterialBasis} from '../../../apps/server/modules/executions/execution-instruction-material-basis.ts';
import {SyntheticPgInstructionMaterialStore} from '../../../apps/server/modules/executions/execution-instruction-material-store.ts';
import {ProjectExecutionBudget} from '../../../apps/server/modules/executions/execution-budget.ts';
import {compileExecutionPreparationOptions} from '../../../apps/server/modules/executions/preparation-input.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const id=(n:number)=>'af080078-1111-4111-8111-'+String(n).padStart(12,'0');
const H=(value:unknown)=>contentHash(canonicalJson(value));
/** 외부 DB와 원 current만 명시 SYNTHETIC_ONLY다. 실제 queue/권한/예산/receipt 코드는 그대로 소비한다.
 * 원문은 합성 참조 자료이며 실제 보호 supplier나 실행 권위를 구성했다는 증거가 아니다.
 */
const fixture=createStartMaterialCredentialFixture;

test('적합 START는 registrar 미구성 상태에서 등록 없는 성공을 반환하거나 domain 효과를 남기지 않는다',async()=>{
 const f=fixture();assert.notDeepEqual(f.request.payload.payload.contextBundleRef,f.request.payload.payload.optionsRef);assert.equal(contentHash(Buffer.from(f.options.body)),f.options.contentHash);assert.equal(Buffer.byteLength(f.options.body),f.options.utf8Bytes);
 await assert.rejects(async()=>{const result:any=await f.run();assert.equal(result.status,'APPLIED');assert.equal(result.data.status,'SYNTHETIC_QUEUE_STORED');assert.equal(result.data.executionAuthorized,false);assert.equal(result.data.dispatchPerformed,false);assert.equal(f.tables.execution_commands!.length,1);assert.equal(f.tables.execution_grants!.length,1);assert.equal(f.tables.usage_reservations!.length,1);assert.equal(f.tables.delivery_outbox!.length,1);assert.equal(f.tables.execution_material_manifests!.length,0);assert.equal(f.tables.execution_materials!.length,0);},(error:any)=>error?.message==='MATERIAL_REGISTRATION_REQUIRED'&&error?.statusCode===412);
 for(const table of ['commands','execution_commands','execution_grants','usage_reservations','writer_claims','delivery_outbox','execution_material_manifests','execution_materials'])assert.equal(f.tables[table]!.length,0,table);
});
test('START의 기존 DENY는 실제 권한 guard에서 domain 저장 전에 거절한다',async()=>{const f=fixture();f.deny();await assert.rejects(f.run(),/RUNTIME_OPERATION_DENIED/);for(const table of ['commands','execution_commands','execution_grants','usage_reservations','writer_claims','delivery_outbox','execution_material_manifests','execution_materials'])assert.equal(f.tables[table]!.length,0,table);});

test('START 실제 registrar는 같은 원 Tx에서 두 그룹을 manifest 한 개와 정확14 부분으로 저장한다',async()=>{
 const f=fixture(true),r:any=await f.run();assert.equal(r.status,'APPLIED');assert.equal(f.tables.execution_material_manifests!.length,1);assert.equal(f.tables.execution_materials!.length,2);
 const d=f.tables.execution_material_manifests![0]!.snapshot_json;assert.deepEqual(d.payload,f.request.payload.payload);assert.deepEqual(d.groups.map((g:any)=>g.kind),['CONTEXT_BUNDLE','START_OPTIONS']);
 for(const m of f.tables.execution_materials!){assert.equal(Object.keys(m.snapshot_json).length,14);assert.equal(m.content_hash,H(m.snapshot_json));assert.equal(m.created_command_id,f.tables.commands![0]!.id);}
 assert.equal(f.tables.execution_material_proof_bindings!.length,0);assert.equal(f.trace.filter(q=>q==='COMMIT').length,1);
 const before=structuredClone(f.tables);assert.deepEqual(await f.run(),r);assert.deepEqual(f.tables,before);
});
test('START 실제 registrar의 source 변조·접근 거절·Tx 교체·원문 유실은 원 저장 전부 rollback한다',async()=>{
 for(const mode of ['CHANGED_BODY','DENY_SOURCE','TX_SWAP','LOST_BODY']){const f=fixture(true);f.mode(mode);await assert.rejects(f.run());for(const table of Object.keys(f.tables).filter(n=>n!=='audit_events'))assert.equal(f.tables[table]!.length,0,mode+'→'+table);assert.equal(f.trace.find(q=>q==='COMMIT'||q==='ROLLBACK'),'ROLLBACK');}
});

test('START의 만료된 원 등록 역사 replay는 새 source·부분조회·등록 없이 원 결과만 반환한다',async()=>{
 const f=fixture(true);f.mode('SHORT_RESOURCE');const first=await f.run(),before=structuredClone(f.tables),reads=f.trace.filter(q=>q.startsWith('SELECT m.*,d.content_hash')).length,sourceCalls=f.trace.filter(q=>q.startsWith('SOURCE_')).length;
 f.advance(4000);f.mode('LOST_BODY');assert.deepEqual(await f.run(),first);assert.deepEqual(f.tables,before);
 assert.equal(f.trace.filter(q=>q.startsWith('SELECT m.*,d.content_hash')).length>reads,true);assert.equal(f.trace.filter(q=>q.startsWith('SOURCE_')).length,sourceCalls);f.mode('CURRENT');await assert.rejects(f.freshPart(),/MATERIAL_REGISTRATION_CURRENT_REQUIRED/);
});
test('START의 원 내부 command fullref는 다른 actor의 같은 외부 commandId 이력과 섞이지 않는다',async()=>{
 const f=fixture(true),other=fixture(true,1),first=await f.run();await other.run();assert.equal(f.request.commandId,other.request.commandId);assert.notEqual(f.request.clientId,other.request.clientId);
 for(const table of ['commands','execution_commands','execution_grants','execution_material_manifests','execution_materials'])f.tables[table]!.push(...structuredClone(other.tables[table]!));
 const before=structuredClone(f.tables);assert.deepEqual(await f.run(),first);assert.deepEqual(f.tables,before);
});

test('START 역사 replay는 현재 credential 새 세대에도 원 저장 세대를 보존하며 fresh 부분은 거절한다',async()=>{
 const f=fixture(true),first=await f.run(),before=structuredClone(f.tables);f.credential(4);
 assert.deepEqual(await f.run(),first);assert.deepEqual(f.tables,before);await assert.rejects(f.freshPart(),/MATERIAL_REGISTRATION_CURRENT_REQUIRED/);
});
test('START 역사 replay의 현재 다른 actor·client와 원 command payload 변조는 거절한다',async()=>{
 for(const kind of ['ACTOR','CLIENT','PAYLOAD']){const f=fixture(true);await f.run();const before=structuredClone(f.tables);if(kind==='PAYLOAD')f.request.payload.payload.optionsRef.version=2;else f.login(kind);await assert.rejects(f.run());for(const table of Object.keys(f.tables).filter(n=>n!=='audit_events'))assert.deepEqual(f.tables[table],before[table],kind+'→'+table);}
});

test('START 실 registrar→기존 보호 proof 포트→원 부분 수신→startOptions는 같은 원 자료를 소비한다',async()=>{
 // 메모리 P256만 사용한다. 실제 OS key/helper·네트워크·DB는 실행하지 않는다.
 const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=keys.publicKey.export({format:'der',type:'spki'}).toString('base64url'),f=fixture(true,0,publicKeyFingerprint(spki));
 await f.prepareConcretePolicy(3);await f.run();const registrar=f.registrar!,parts=new SyntheticStartMaterialParts(registrar),basis=new SyntheticStartMaterialBasis(parts),descriptor=f.tables.execution_material_manifests![0]!.snapshot_json,scope=descriptor.scope,stored=f.tables.execution_commands![0]!.snapshot_json,grant=f.tables.execution_grants![0]!.snapshot_json,events=f.tables.execution_challenges!;
 const executionScope={...scope,credentialGeneration:1};await new SyntheticPgChallengeStore(f.pool as any,{transport:'SYNTHETIC_ONLY',key:async()=>spki}).transaction(executionScope,tx=>tx.current());
 const store:any={transport:'SYNTHETIC_ONLY',transaction:async(s:any,body:any)=>{assert.deepEqual(s,executionScope);return f.transaction(async(db,actor)=>{const mapped=await readMaterialCredentialBasis(db,s,'EXECUTION');assert.deepEqual(mapped.materialScope,scope);assert.equal(mapped.materialScope.mode,'EXECUTION');const materialScope={...mapped.materialScope,mode:'EXECUTION' as const};
  const joint:any={challenges:{clock:async()=>f.clock(),current:async()=>({context:{transport:'SYNTHETIC_ONLY',...executionScope,scopeDigest:grant.scopeDigest,publicKeyFingerprint:publicKeyFingerprint(spki),grantExpiresAt:grant.expiresAt},spki,checkedAt:f.clock()}),read:async()=>({complete:true,events:events.map(r=>({ref:{id:r.id,version:r.version,contentHash:r.content_hash},snapshot:structuredClone(r.snapshot_json)}))}),append:async(e:any)=>{events.push({project_id:scope.projectId,id:e.ref.id,version:e.ref.version,content_hash:e.ref.contentHash,snapshot_json:structuredClone(e.snapshot)});},recordResult:async(v:any)=>{const snapshot={kind:'SYNTHETIC_PROOF_RESULT',...v,recordedAt:f.clock(),credentialIssued:false,executionAuthorized:false,dispatchPerformed:false},ref={id:randomUUID(),version:1,contentHash:H(snapshot)};f.tables.execution_receipts!.push({project_id:scope.projectId,id:ref.id,version:1,content_hash:ref.contentHash,grant_id:scope.grantRef.id,grant_version:scope.grantRef.version,challenge_id:v.challengeRef.id,snapshot_json:snapshot});return ref;}},materials:{clock:async()=>f.clock(),current:(commandId:string,materialId:string)=>basis.current(db,actor,materialScope,commandId,materialId),readPart:(r:any)=>parts.readPart(db,materialScope,r)},results:{bind:(r:any,b:any)=>registrar.bind(db,materialScope,r,b),read:(r:any)=>registrar.read(db,materialScope,r)}};
  return body(joint);
 });}};
 await consumeRegisteredStart(f,store,keys,spki,false,undefined,executionScope);
});

async function consumeRegisteredStart(f:ReturnType<typeof fixture>,store:any,keys:ReturnType<typeof generateKeyPairSync>,spki:string,failBinding=false,proofFault?:'TARGET'|'GRANT',executionScope?:any){
 const descriptor=f.tables.execution_material_manifests![0]!.snapshot_json,scope=executionScope??descriptor.scope,stored=f.tables.execution_commands![0]!.snapshot_json,events=f.tables.execution_challenges!;
 const challengeStore:any=store instanceof SyntheticPgInstructionMaterialStore?new SyntheticPgChallengeStore(f.pool as any,{transport:'SYNTHETIC_ONLY',key:async()=>spki}):{transport:'SYNTHETIC_ONLY',transaction:async(s:any,body:any)=>store.transaction(s,(tx:any)=>body(tx.challenges))},consumer=new SyntheticAuthenticatedMaterials(store);
 const received:any[]=[],blobs=new Map<string,Uint8Array>(),materials=f.tables.execution_materials!.map(r=>({ref:{id:r.id,version:1,contentHash:r.content_hash},snapshot:structuredClone(r.snapshot_json)})),inbox:any={transport:'SYNTHETIC_ONLY',exclusive:async(_s:any,body:any)=>body({read:async()=>({complete:true,events:structuredClone(received)}),readPart:async(r:any)=>new Uint8Array(blobs.get(r.id)!),appendAndSync:async(e:any,bytes:Uint8Array)=>{received.push(structuredClone(e));blobs.set(e.ref.id,new Uint8Array(bytes));}})},receiver=new SyntheticMaterialReceiver(inbox,{context:stored.envelope.context,executorRegistrationRef:stored.envelope.executorRegistrationRef},materials,{maxBytes:2097152,maxParts:200,clock:()=>Date.parse(f.clock())});
 let last:any;
 for(const m of materials){
  const target=executionTarget('GET','/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/commands/'+descriptor.commandId+'/materials/'+m.ref.id,[],null),request={requestId:randomUUID(),purpose:'EXECUTION_REQUEST',grantRef:scope.grantRef,credentialGeneration:scope.credentialGeneration,target,clientNonce:randomBytes(32).toString('base64url'),issuedAt:f.clock()};
  const issued=await new SyntheticExecutionChallenges(challengeStore).issue(scope,request,sign('sha256',executionChallengeRequestBytes('EXECUTION',request),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')),proof={requestId:request.requestId,...target,grantRef:scope.grantRef,credentialGeneration:scope.credentialGeneration,serverNonce:issued.challenge.serverNonce};if(proofFault==='TARGET')Object.assign(proof,executionTarget('GET','/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/commands/'+id(99)+'/materials/'+m.ref.id,[],null));if(proofFault==='GRANT')proof.grantRef={...scope.grantRef,version:scope.grantRef.version+1};const signature=sign('sha256',executionProofBytes('EXECUTION_REQUEST_PROOF',proof),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  if(proofFault){assert.equal(verify('sha256',executionProofBytes('EXECUTION_REQUEST_PROOF',proof),{key:keys.publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')),true);const before=structuredClone(f.tables),bodyReads=f.trace.filter(q=>q==='SOURCE_BODY').length;await assert.rejects(consumer.read(scope,descriptor.commandId,m.ref.id,issued.ref,proof,signature));assert.deepEqual(f.tables,before);assert.equal(f.trace.filter(q=>q==='SOURCE_BODY').length,bodyReads);assert.equal(received.length,0);return;}
  if(failBinding){const before=structuredClone(f.tables);f.mode('FAIL_BIND');await assert.rejects(consumer.read(scope,descriptor.commandId,m.ref.id,issued.ref,proof,signature));assert.deepEqual(f.tables,before);assert.equal(received.length,0);return;}
  const result=await consumer.read(scope,descriptor.commandId,m.ref.id,issued.ref,proof,signature);assert.equal(result.executionAuthorized,false);assert.equal(result.dispatchPerformed,false);await receiver.record(stored.envelope,result.material);
  assert.deepEqual(await consumer.read(scope,descriptor.commandId,m.ref.id,issued.ref,proof,signature),result);last={m,issued,proof,signature};
 }
 assert.equal(received.length,2);assert.equal(events.length,4);assert.equal(f.tables.execution_material_proof_bindings!.length,2);
 const out=await receiver.startOptions(stored.envelope);assert.deepEqual(Buffer.from(out.bytes),Buffer.from(f.options.body));assert.equal(out.contentHash,f.options.contentHash);assert.deepEqual(out.optionsRef,descriptor.payload.optionsRef);
 const before=f.trace.filter(q=>q==='SOURCE_BODY').length;f.tables.execution_material_proof_bindings!.splice(1,1);await assert.rejects(consumer.read(scope,descriptor.commandId,last.m.ref.id,last.issued.ref,last.proof,last.signature));assert.equal(f.tables.execution_material_proof_bindings!.length,1);assert.equal(f.trace.filter(q=>q==='SOURCE_BODY').length,before);
}

test('START HUMAN1은 실제 구체 PgInstructionMaterialStore와 원 정책·P256·receiver 종단을 소비한다',async()=>{
 const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=keys.publicKey.export({format:'der',type:'spki'}).toString('base64url'),f=fixture(true,0,publicKeyFingerprint(spki));await f.prepareConcretePolicy();await f.run();
 const store=concreteMaterialStore(f,spki);
 await consumeRegisteredStart(f,store,keys,spki);assert.equal(f.tables.execution_credentials!.length,1);assert.equal(f.tables.execution_credentials![0].snapshot_json.credentialIssued,false);
});
test('START 외부 E3의 기존 구체 adapter 제한은 연결/콜백 전에 거절한다',async()=>{
 let connections=0,callbacks=0;const pool:any={connect:async()=>{connections++;throw Error('예상 외 연결');}},host:any={transport:'SYNTHETIC_ONLY',key:async()=>''},port:any={transport:'SYNTHETIC_ONLY',current:async()=>({}),readPart:async()=>new Uint8Array(),bind:async()=>{},read:async()=>null},store=new SyntheticPgInstructionMaterialStore(pool,host,port,port,port),scope:any={mode:'EXECUTION',projectId:id(1),connectorId:id(10),executionId:id(5),executionGeneration:1,grantRef:{id:id(6),version:1,contentHash:'a'.repeat(64)},credentialGeneration:3};
 await assert.rejects(store.transaction(scope,async()=>{callbacks++;}));assert.equal(connections,0);assert.equal(callbacks,0);
});

test('START COMMIT 응답 불명은 정상 성공·자동 재발급 없이 원 저장과 명령 식별자를 보존한다',async()=>{
 const f=fixture(true);f.mode('COMMIT_LOST');await assert.rejects(f.run(),error=>error===f.commitLost);assert.equal(f.releases.at(-1),f.commitLost);assert.equal(f.tables.execution_material_manifests!.length,1);assert.equal(f.tables.execution_materials!.length,2);assert.equal(f.tables.commands!.length,1);assert.equal(f.trace.filter(q=>q==='COMMIT').length,1);const before=structuredClone(f.tables);f.mode('CURRENT');const result:any=await f.run();assert.equal(result.commandId,f.request.commandId);assert.deepEqual(f.tables,before);
});
test('START 실제 registrar의 전체 이력 count admission은 기존 project/grant의 합산 경계에서 rollback한다',async()=>{
 for(const [field,limit]of [['project_count',100000],['grant_count',10000]] as const)for(const extra of [0,1]){
  const f=fixture(true);f.capacity(field,limit-3+extra);if(extra){await assert.rejects(f.run(),/MATERIAL_REGISTRATION_LIMIT/);for(const table of ['commands','execution_commands','execution_grants','usage_reservations','writer_claims','delivery_outbox','execution_material_manifests','execution_materials'])assert.equal(f.tables[table]!.length,0,field+'→'+table);}else{await f.run();assert.equal(f.tables.execution_material_manifests!.length+f.tables.execution_materials!.length,3);}
 }
});
test('START 원 등록·부분 orphan과 저장 snapshot 변조는 역사 replay로 사후 복구하지 않는다',async()=>{
 for(const mode of ['MANIFEST','PART','SNAPSHOT']){const f=fixture(true);await f.run();if(mode==='MANIFEST')f.tables.execution_material_manifests!.splice(0);if(mode==='PART')f.tables.execution_materials!.pop();if(mode==='SNAPSHOT')f.tables.execution_commands![0].snapshot_json.payload.optionsRef.version=2;const before=structuredClone(f.tables);await assert.rejects(f.run());for(const table of Object.keys(f.tables).filter(n=>n!=='audit_events'))assert.deepEqual(f.tables[table],before[table],mode+'→'+table);}
});

test('START 구체 보호 wrapper는 proof binding 저장 유실에서 receipt·nonce를 함께 rollback하고 수신하지 않는다',async()=>{
 const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=keys.publicKey.export({format:'der',type:'spki'}).toString('base64url'),f=fixture(true,0,publicKeyFingerprint(spki));await f.prepareConcretePolicy();await f.run();
 const store=concreteMaterialStore(f,spki);await consumeRegisteredStart(f,store,keys,spki,true);
 assert.equal(f.tables.execution_material_proof_bindings!.length,0);assert.equal(f.tables.execution_receipts!.length,0);assert.equal(f.tables.execution_challenges!.length,1);
});

const concreteMaterialStore=createConcreteStartMaterialStore;

test('START 유효 서명도 다른 target·grant proof이면 원 부분·수신·nonce·binding 효과가 없다',async()=>{
 for(const fault of ['TARGET','GRANT'] as const){const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=keys.publicKey.export({format:'der',type:'spki'}).toString('base64url'),f=fixture(true,0,publicKeyFingerprint(spki));await f.prepareConcretePolicy();await f.run();await consumeRegisteredStart(f,concreteMaterialStore(f,spki),keys,spki,false,fault);assert.equal(f.tables.execution_receipts!.length,0);assert.equal(f.tables.execution_material_proof_bindings!.length,0);assert.equal(f.tables.execution_challenges!.length,1);}
});
test('START 실제 registrar는 SEND·다른 grant버전·만료 이력 bytes의 project/grant 합산 경계를 보존한다',async()=>{
 for(const field of ['project_bytes','grant_bytes'] as const)for(const extra of [0,1]){
  const f=fixture(true);f.admitBytes(field,extra);
  if(extra){await assert.rejects(f.run(),/MATERIAL_REGISTRATION_LIMIT/);for(const table of ['commands','execution_commands','execution_grants','usage_reservations','writer_claims','delivery_outbox','execution_material_manifests','execution_materials'])assert.equal(f.tables[table]!.length,0,field+'→'+table);}
  else{await f.run();assert.equal(f.tables.execution_material_manifests!.length,1);assert.equal(f.tables.execution_materials!.length,2);}
 }
});

test('START H3/E1의 원 등록 자료는 기존 구체 wrapper에서 원 실행 예약으로 조회된다',async()=>{
 const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=keys.publicKey.export({format:'der',type:'spki'}).toString('base64url'),f=fixture(true,0,publicKeyFingerprint(spki));
 await f.prepareConcretePolicy(3);await f.run();
 const descriptor=f.tables.execution_material_manifests![0]!.snapshot_json,material=f.tables.execution_materials![0]!,grant=f.tables.execution_grants![0]!;
 assert.equal(grant.snapshot_json.binding.subject.credentialGeneration,3);assert.equal(descriptor.scope.credentialGeneration,3);assert.equal(material.credential_generation,3);
 const executionScope={...structuredClone(descriptor.scope),credentialGeneration:1},host={transport:'SYNTHETIC_ONLY' as const,key:async()=>spki},challengeStore=new SyntheticPgChallengeStore(f.pool as any,host);
 const target=executionTarget('GET','/api/v1/connectors/'+executionScope.connectorId+'/executions/'+executionScope.executionId+'/commands/'+descriptor.commandId+'/materials/'+material.id,[],null),request={requestId:randomUUID(),purpose:'EXECUTION_REQUEST',grantRef:executionScope.grantRef,credentialGeneration:1,target,clientNonce:randomBytes(32).toString('base64url'),issuedAt:f.clock()};
 // 원 일반 challenge 생산자가 기존 E1 예약을 만든다. 자료 조회는 이를 읽기만 해야 한다.
 const issued=await new SyntheticExecutionChallenges(challengeStore).issue(executionScope,request,sign('sha256',executionChallengeRequestBytes('EXECUTION',request),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url'));
 assert.equal(f.tables.execution_credentials!.length,1);const reservation=f.tables.execution_credentials![0]!;
 assert.equal(reservation.credential_generation,1);assert.equal(reservation.content_hash,H(reservation.snapshot_json));assert.deepEqual(reservation.snapshot_json.grantRef,executionScope.grantRef);assert.equal(reservation.snapshot_json.state,'SYNTHETIC_RESERVED_NO_TOKEN');assert.equal(reservation.snapshot_json.credentialIssued,false);
 assert.equal(issued.challenge.credentialGeneration,1);assert.equal(f.tables.execution_challenges![0]!.snapshot_json.binding.credentialGeneration,1);
 const proof={requestId:request.requestId,...target,grantRef:executionScope.grantRef,credentialGeneration:1,serverNonce:issued.challenge.serverNonce},signature=sign('sha256',executionProofBytes('EXECUTION_REQUEST_PROOF',proof),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 assert.equal(verify('sha256',executionProofBytes('EXECUTION_REQUEST_PROOF',proof),{key:keys.publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')),true);
 const consumer=new SyntheticAuthenticatedMaterials(concreteMaterialStore(f,spki));let result:Awaited<ReturnType<SyntheticAuthenticatedMaterials['read']>>;
 try{result=await consumer.read(executionScope,descriptor.commandId,material.id,issued.ref,proof,signature);}catch(error){
  assert.deepEqual(f.unsupportedSql,[],'fixture SQL 미구성은 기능 실패로 세지 않는다');assert(f.trace.some(q=>q.startsWith('SELECT m.*,d.content_hash')),'원 자료 lookup까지 실제 호출했다');assert.equal(f.tables.execution_credentials!.length,1);assert.equal(f.tables.execution_receipts!.length,0);assert.equal(f.tables.execution_material_proof_bindings!.length,0);assert.equal(f.tables.execution_challenges!.length,1);throw error;
 }
 assert.deepEqual(Buffer.from(result.material.bytes),f.contextBytes);assert.equal(result.executionAuthorized,false);assert.equal(result.dispatchPerformed,false);assert.equal(f.tables.execution_credentials!.length,1);
 assert.equal(f.tables.execution_material_manifests![0]!.snapshot_json.scope.credentialGeneration,3);assert.equal(f.tables.execution_material_proof_bindings![0]!.snapshot_json.scope.credentialGeneration,3);
});
