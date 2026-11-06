import assert from 'node:assert/strict';
import test from 'node:test';
import {generateKeyPairSync,randomBytes,randomUUID,sign} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {publicKeyFingerprint} from '../../../apps/server/modules/connections/registration-proof.ts';
import {SyntheticPgChallengeStore} from '../../../apps/server/modules/executions/execution-challenge-store.ts';
import {SyntheticExecutionChallenges} from '../../../apps/server/modules/executions/execution-challenges.ts';
import {SyntheticAuthenticatedMaterials} from '../../../apps/server/modules/executions/execution-authenticated-materials.ts';
import {executionTarget,executionChallengeRequestBytes,executionProofBytes} from '../../../apps/server/modules/executions/execution-proof.ts';
import {createStartMaterialCredentialFixture,createConcreteStartMaterialStore} from '../../support/execution-material-credential-fixture.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
async function start(H=3){
 const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=keys.publicKey.export({format:'der',type:'spki'}).toString('base64url'),f=createStartMaterialCredentialFixture(true,0,publicKeyFingerprint(spki));await f.prepareConcretePolicy(H);await f.run();
 const d=f.tables.execution_material_manifests![0]!.snapshot_json,m=f.tables.execution_materials![0]!,scope={...structuredClone(d.scope),credentialGeneration:1},host={transport:'SYNTHETIC_ONLY' as const,key:async()=>spki},general=new SyntheticPgChallengeStore(f.pool as any,host),store=createConcreteStartMaterialStore(f,spki),consumer=new SyntheticAuthenticatedMaterials(store);
 return{f,keys,spki,d,m,scope,general,store,consumer};
}
async function issue(p:Awaited<ReturnType<typeof start>>,beforeMs=0){
 if(beforeMs){await p.general.transaction(p.scope,tx=>tx.current());p.f.advance(beforeMs);}
 const target=executionTarget('GET','/api/v1/connectors/'+p.scope.connectorId+'/executions/'+p.scope.executionId+'/commands/'+p.d.commandId+'/materials/'+p.m.id,[],null),request={requestId:randomUUID(),purpose:'EXECUTION_REQUEST',grantRef:p.scope.grantRef,credentialGeneration:1,target,clientNonce:randomBytes(32).toString('base64url'),issuedAt:p.f.clock()};
 const issued=await new SyntheticExecutionChallenges(p.general).issue(p.scope,request,sign('sha256',executionChallengeRequestBytes('EXECUTION',request),{key:p.keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')),proof={requestId:request.requestId,...target,grantRef:p.scope.grantRef,credentialGeneration:1,serverNonce:issued.challenge.serverNonce},signature=sign('sha256',executionProofBytes('EXECUTION_REQUEST_PROOF',proof),{key:p.keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 return{issued,proof,signature,read:()=>p.consumer.read(p.scope,p.d.commandId,p.m.id,issued.ref,proof,signature)};
}
test('구체 START H3/E1은 원 descriptor·예약과 이전/동일 발급시각을 보존하고 consumed replay 추가기록0이다',async()=>{
 for(const beforeMs of [0,1]){
  const p=await start(),q=await issue(p,beforeMs),descriptor=structuredClone(p.d),reservation=structuredClone(p.f.tables.execution_credentials![0]),from=p.f.trace.length,result=await q.read();
  assert.deepEqual(Buffer.from(result.material.bytes),p.f.contextBytes);assert.equal(result.executionAuthorized,false);assert.equal(result.dispatchPerformed,false);
  assert.equal(p.f.tables.execution_material_proof_bindings![0]!.snapshot_json.scope.credentialGeneration,3);assert.equal(p.f.tables.execution_challenges![1]!.snapshot_json.binding.credentialGeneration,1);assert.equal(q.issued.challenge.credentialGeneration,1);assert.deepEqual(p.f.tables.execution_material_manifests![0]!.snapshot_json,descriptor);assert.deepEqual(p.f.tables.execution_credentials![0],reservation);
  assert(!p.f.trace.slice(from).some(sql=>sql.startsWith('INSERT INTO anvil.execution_credentials')));
  const stored=structuredClone(p.f.tables);assert.deepEqual(await q.read(),result);assert.deepEqual(p.f.tables,stored);
 }
});
test('원 publicChallenge 뒤의 E예약은 현재 시각 이하이고 hash가 맞아도 사후 proof 수선에 쓰지 못한다',async()=>{
 const p=await start(),q=await issue(p);p.f.advance(1);const row=p.f.tables.execution_credentials![0]!;row.snapshot_json.reservedAt=p.f.clock();row.content_hash=hash(row.snapshot_json);assert(Date.parse(row.snapshot_json.reservedAt)>Date.parse(q.issued.challenge.issuedAt));
 const before=structuredClone(p.f.tables),from=p.f.trace.length;await assert.rejects(q.read());assert.deepEqual(p.f.tables,before);assert.equal(p.f.tables.execution_receipts!.length,0);assert.equal(p.f.tables.execution_material_proof_bindings!.length,0);assert.equal(p.f.tables.execution_challenges!.length,1);assert(!p.f.trace.slice(from).some(sql=>sql.startsWith('INSERT INTO anvil.execution_credentials')));
});
test('구체 자료 callback 전 기존 실행예약이 없으면 새 예약·자료·nonce·callback을 만들지 않는다',async()=>{
 const p=await start(),before=structuredClone(p.f.tables),from=p.f.trace.length;let callbacks=0;
 await assert.rejects(p.store.transaction(p.scope,async()=>{callbacks++;}));assert.equal(callbacks,0);assert.deepEqual(p.f.tables,before);assert(!p.f.trace.slice(from).some(sql=>sql.startsWith('INSERT INTO')));assert.equal(p.f.tables.execution_credentials!.length,0);
});
test('구체 자료 경계는 손상 E예약·현재 다른 HUMAN/Session/세대를 효과 없이 거절한다',async()=>{
 for(const mode of ['HASH','GRANT','E','ISSUED','ACTOR','CLIENT','H']){
  const p=await start(),q=await issue(p),row=p.f.tables.execution_credentials![0]!;
  if(mode==='HASH')row.content_hash='f'.repeat(64);if(mode==='GRANT')row.grant_id=randomUUID();if(mode==='E')row.credential_generation=3;if(mode==='ISSUED'){row.snapshot_json.credentialIssued=true;row.content_hash=hash(row.snapshot_json);}
  if(mode==='ACTOR'||mode==='CLIENT')p.f.login(mode);if(mode==='H')p.f.credential(4);
  const before=structuredClone(p.f.tables),from=p.f.trace.length;await assert.rejects(q.read());assert.deepEqual(p.f.tables,before,mode);assert(!p.f.trace.slice(from).some(sql=>sql.startsWith('INSERT INTO')),mode);assert.deepEqual(p.f.unsupportedSql,[]);
 }
});
test('자료 source await 뒤 HUMAN/예약/Tx 변경과 callback 뒤 만료는 마지막 반환을 닫는다',async()=>{
 for(const mode of ['H','RESERVATION','TX','EXPIRE']){
  const p=await start(),q=await issue(p),source=p.f.source.inspect,query=p.f.db.query;let reads=0,swapped=false;
  if(mode==='TX')p.f.db.query=async(sql:string,args:any[]=[])=>{const value=await query.call(p.f.db,sql,args);return swapped&&sql==='SELECT txid_current()::text AS transaction_id'?{rows:[{transaction_id:'2'}]}:value;};
  p.f.source.inspect=async(...args:any[])=>{const out=await source(...args);if(++reads===2){if(mode==='H')p.f.credential(4);if(mode==='RESERVATION'){const row=p.f.tables.execution_credentials![0]!;row.snapshot_json.executionAuthorized=true;row.content_hash=hash(row.snapshot_json);}if(mode==='TX')swapped=true;}return out;};
  const from=p.f.trace.length;
  if(mode==='EXPIRE'){let callbacks=0;await assert.rejects(p.store.transaction(p.scope,async()=>{callbacks++;p.f.advance(3600000);}));assert.equal(callbacks,1);}
  else await assert.rejects(q.read());
  p.f.db.query=query;assert.equal(p.f.tables.execution_receipts!.length,0);assert.equal(p.f.tables.execution_material_proof_bindings!.length,0);assert.equal(p.f.tables.execution_challenges!.length,1);assert(!p.f.trace.slice(from).some(sql=>sql.startsWith('INSERT INTO anvil.execution_credentials')));
 }
});
test('구체 자료 COMMIT 응답 불명은 원 E와 소비결과를 보존하고 자동 새서명/예약을 만들지 않는다',async()=>{
 const p=await start(),q=await issue(p),from=p.f.trace.length;p.f.mode('COMMIT_LOST');await assert.rejects(q.read());assert.equal(p.f.tables.execution_credentials!.length,1);assert.equal(p.f.tables.execution_receipts!.length,1);assert.equal(p.f.tables.execution_material_proof_bindings!.length,1);assert.equal(p.f.tables.execution_challenges!.length,2);
 assert.equal(p.f.trace.slice(from).filter(sql=>sql==='COMMIT').length,1);assert(!p.f.trace.slice(from).some(sql=>sql.startsWith('INSERT INTO anvil.execution_credentials')));
 const saved=structuredClone(p.f.tables);p.f.mode('CURRENT');await q.read();assert.deepEqual(p.f.tables,saved);
});

import {ProjectExecutionInstructionQueue} from '../../../apps/server/modules/executions/execution-instruction-queue.ts';
import {SyntheticPgInstructionQueueStore} from '../../../apps/server/modules/executions/execution-instruction-store.ts';
import {SyntheticPgMaterialRegistration} from '../../../apps/server/modules/executions/execution-material-registration-store.ts';
import {SyntheticInstructionMaterialParts} from '../../../apps/server/modules/executions/execution-instruction-material-parts.ts';
import {SyntheticPgInstructionPermitBasis} from '../../../apps/server/modules/executions/execution-instruction-permit-basis.ts';
import {SyntheticPgInstructionMaterialBasis} from '../../../apps/server/modules/executions/execution-instruction-material-basis.ts';
import {SyntheticPgInstructionMaterialStore} from '../../../apps/server/modules/executions/execution-instruction-material-store.ts';
import {ProjectExecutionBudget} from '../../../apps/server/modules/executions/execution-budget.ts';
import {readMaterialDescriptor} from '../../../apps/server/modules/executions/execution-material-registration-input.ts';
async function send(){
 const p=await start(),f=p.f,grant=f.tables.execution_grants![0]!,root=grant.snapshot_json.binding,scope=p.d.scope,small={projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration},body=Buffer.from('namespace 합성 후속 지시문','utf8');
 const reference=(n:number)=>({id:'af080079-1111-4111-8111-'+String(n).padStart(12,'0'),version:1,contentHash:hash({purpose:'SYNTHETIC_REFERENCE_ONLY_V1',n})}),instructionRef=reference(1),partsRef=reference(2),commandId=randomUUID();
 const d:any={schemaVersion:1,id:reference(3).id,sourceKind:'SYNTHETIC_REFERENCE_ONLY_V1',scope:structuredClone(scope),commandId,source:{sourceRef:reference(4),bodyRef:{...reference(5),contentHash:contentHash(body)},partsRef,originRef:root.intent.assignmentRef,contentHash:contentHash(body),sourceBytes:body.length,mediaType:'text/plain'},parts:[{materialId:reference(6).id,partIndex:1,byteOffset:0,utf8Bytes:body.length,contentHash:contentHash(body)}],expiresAt:grant.snapshot_json.expiresAt},plan=readMaterialDescriptor(d);
 const expectedBasis={subject:root.subject,permissionPolicyRef:root.permissionPolicyRef,basisRefs:root.basisRefs,latestInstructionRefs:root.latestInstructionRefs,instructionRef};
 const source:any={transport:'SYNTHETIC_ONLY',describe:async(db:any,actor:any,s:any,r:any)=>{assert.equal(db,f.db);assert.equal(actor.credentialGeneration,3);assert.deepEqual(s,scope);assert.equal(r.commandId,commandId);return structuredClone(d);},inspect:async(db:any,s:any,descriptor:any,basis:any)=>{assert.equal(db,f.db);assert.deepEqual(s,scope);assert.deepEqual(descriptor,d);assert.deepEqual(basis,expectedBasis);return{scope:structuredClone(scope),descriptorHash:plan.manifestRef.contentHash,basis:structuredClone(basis),access:'READ',quarantined:false,superseded:false,excluded:false,checkedAt:f.clock(),expiresAt:d.expiresAt};},current:async(db:any,s:any,selection:any)=>{assert.equal(db,f.db);assert.deepEqual(s,scope);const command=f.tables.execution_commands!.find(r=>r.snapshot_json.envelope.commandId===commandId)!;assert.deepEqual(selection,{commandRef:{id:command.id,version:1,contentHash:command.content_hash},manifestRef:plan.manifestRef,source:d.source,basis:expectedBasis});return{...structuredClone(selection),scope:structuredClone(scope),access:'READ',quarantined:false,superseded:false,excluded:false,checkedAt:f.clock(),expiresAt:d.expiresAt};},readBody:async(db:any,s:any,selection:any)=>{await source.current(db,s,selection);return new Uint8Array(body);}};
 // 소유/원문 관측은 기존 명시 합성 current/source 포트다. 실제 OS/Agent/보호 supplier를 대신했다고 하지 않는다.
 const facts:any={transport:'SYNTHETIC_ONLY',current:async(db:any,actor:any,s:any)=>{assert.equal(db,f.db);assert.deepEqual(s,small);assert.equal(actor.actorId,root.subject.userId);assert.equal(actor.clientId,root.subject.clientId);assert.equal(actor.credentialGeneration,3);return{transport:'SYNTHETIC_ONLY',scope:small,grantRef:scope.grantRef,grantKind:'EXECUTION',grantState:'ACTIVE',grantExpiresAt:grant.snapshot_json.expiresAt,grantSubject:root.subject,grantAllowedOperations:grant.snapshot_json.allowedOperations,sessionBindingRef:root.agentSession.sessionRef,instructionRef,partsRef,materialManifestRef:plan.manifestRef,turnState:'IDLE',fact:{...structuredClone(root),writerState:'OWNED',checkedAt:f.clock()},checkedAt:f.clock(),expiresAt:grant.snapshot_json.expiresAt};},claim:async(db:any,actor:any,s:any,r:any)=>{assert.equal(db,f.db);assert.equal(actor.credentialGeneration,3);assert.deepEqual(s,small);return{...small,commandId:r.commandId,assignmentRef:root.intent.assignmentRef,stageRef:f.tables.usage_reservations![0]!.snapshot_json.claim.stageRef,policyRef:root.intent.budgetPolicyRef,operation:'SEND_INSTRUCTION',demand:{attempts:0,calls:1,spoolBytes:body.length,cost:null,costStatus:'VERIFIED_NO_CHARGE'}};}};
 const registrar=new SyntheticPgMaterialRegistration(source),queueStore=new SyntheticPgInstructionQueueStore(facts,registrar),budgets=new ProjectExecutionBudget(),request:any={schemaVersion:1,projectId:scope.projectId,commandId,clientId:root.subject.clientId,controlGeneration:root.subject.controlGeneration,operation:'queueExecutionCommand',targetId:scope.executionId,expectedVersion:scope.executionGeneration,baselineRefs:[],approvalRef:null,payload:{grantRef:scope.grantRef,sessionBindingRef:root.agentSession.sessionRef,instructionRef,partsRef,permissionPolicyRef:root.permissionPolicyRef,budgetPolicyRef:root.intent.budgetPolicyRef,reason:'두 namespace 합성 후속 자료'}};
 const result=await new ProjectExecutionInstructionQueue(f.access,queueStore,budgets).command(f.token,f.csrf,request);assert.equal(result.data?.status,'SYNTHETIC_INSTRUCTION_QUEUE_STORED');
 const manifest=f.tables.execution_material_manifests!.find(r=>r.command_id===commandId)!,material=f.tables.execution_materials!.find(r=>r.command_id===commandId)!,parts=new SyntheticInstructionMaterialParts(registrar,source),permit=new SyntheticPgInstructionPermitBasis(queueStore,budgets),basis=new SyntheticPgInstructionMaterialBasis(permit,parts),store=new SyntheticPgInstructionMaterialStore(f.pool as any,{transport:'SYNTHETIC_ONLY',key:async()=>p.spki},basis,parts,registrar);
 return{...p,d:manifest.snapshot_json,m:material,scope:{...structuredClone(scope),credentialGeneration:1},store,consumer:new SyntheticAuthenticatedMaterials(store),body};
}
test('실제 SEND queue·등록·PermitBasis와 구체 wrapper도 원 H3/E1 자료와 binding을 별도로 소비한다',async()=>{
 const p=await send(),q=await issue(p),before=structuredClone(p.d),reservation=structuredClone(p.f.tables.execution_credentials![0]),result=await q.read();
 assert.deepEqual(Buffer.from(result.material.bytes),p.body);assert.equal(result.material.completeContextVerified,false);assert.equal(result.dispatchPerformed,false);assert.equal(p.f.tables.execution_material_proof_bindings![0]!.snapshot_json.scope.credentialGeneration,3);assert.equal(q.issued.challenge.credentialGeneration,1);assert.deepEqual(p.f.tables.execution_material_manifests!.find(r=>r.command_id===p.d.commandId)!.snapshot_json,before);assert.deepEqual(p.f.tables.execution_credentials![0],reservation);const saved=structuredClone(p.f.tables);assert.deepEqual(await q.read(),result);assert.deepEqual(p.f.tables,saved);assert.deepEqual(p.f.unsupportedSql,[]);
});
test('SEND의 원 공개 challenge보다 늦게 재봉인한 E예약도 소비·binding 사후 보충을 못한다',async()=>{
 const p=await send(),q=await issue(p);p.f.advance(1);const row=p.f.tables.execution_credentials![0]!;row.snapshot_json.reservedAt=p.f.clock();row.content_hash=hash(row.snapshot_json);const before=structuredClone(p.f.tables);await assert.rejects(q.read());assert.deepEqual(p.f.tables,before);assert.equal(p.f.tables.execution_receipts!.length,0);assert.equal(p.f.tables.execution_material_proof_bindings!.length,0);
});
