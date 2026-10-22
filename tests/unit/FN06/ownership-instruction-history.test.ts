import test from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {providerTurnFixture} from './provider-turn-fixture.ts';
import {ownershipPreparationReceiptFixture} from './ownership-preparation-receipt-fixture.ts';
import {SyntheticPgInstructionPermitJournal} from '../../../apps/server/modules/executions/execution-instruction-permit-journal.ts';
import {SyntheticInstructionPermits} from '../../../apps/server/modules/executions/execution-instruction-permits.ts';
import {readSyntheticInstructionQueueRecord} from '../../../apps/server/modules/executions/execution-instruction-queue.ts';
import {readOwnershipHumanPolicyRegistrationBasis} from '../../../apps/server/modules/executions/ownership-human-basis.ts';
import {executionTarget} from '../../../apps/server/modules/executions/execution-proof.ts';
const m=await import(new URL('../../../apps/server/modules/executions/ownership-instruction-history.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const hash=(v:unknown)=>contentHash(canonicalJson(v));
async function fixture(options:{humanCredentialGeneration?:number;disposition?:'AUTO'|'REQUIRE_APPROVAL'}={}){
 const f=await ownershipPreparationReceiptFixture(options),x=await providerTurnFixture(),scope=f.prep.snapshot.scope;
 const delta=Date.parse(f.prep.snapshot.at)-Date.parse(x.permit.snapshot.issuedAt);
 const shift=(v:any):any=>typeof v==='string'&&/^2026-10-22T/.test(v)?new Date(Date.parse(v)+delta).toISOString():Array.isArray(v)?v.map(shift):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,a])=>[k,shift(a)])):v;
 const record:any=shift(x.record),permit:any=shift(x.permit),s=record.snapshot,p=permit.snapshot,fact=p.currentFact;
 Object.assign(fact,{projectId:scope.projectId,executionId:scope.executionId,subject:structuredClone(f.prep.snapshot.subject),preparationRef:structuredClone(f.prep.ref)});
 fact.intent.projectId=scope.projectId;fact.registration.ref=structuredClone(f.prep.snapshot.registrationRef);fact.registration.hostPublicKeyFingerprint=f.prep.snapshot.payload.publicKeyFingerprint;fact.checks.registration.evidenceRefs=[structuredClone(fact.registration.ref)];
 Object.assign(p.scope,{projectId:scope.projectId,executionId:scope.executionId});
 Object.assign(s.scope,{projectId:scope.projectId,executionId:scope.executionId});
 Object.assign(s.request,{projectId:scope.projectId,targetId:scope.executionId,clientId:fact.subject.clientId,controlGeneration:fact.subject.controlGeneration});s.requestHash=hash(s.request);
 const{checkedAt:_,...storedFact}=fact;s.currentBinding.fact=storedFact;s.currentBinding.scope=structuredClone(s.scope);s.currentBinding.grantSubject=structuredClone(fact.subject);
 const e=s.envelope;e.executorRegistrationRef=structuredClone(fact.registration.ref);Object.assign(e.context,{projectId:scope.projectId,executionId:scope.executionId});
 const seal=()=>{const{envelopeHash:_,...unsigned}=e;e.envelopeHash=hash(unsigned);const{request:__,envelope:___,...intent}=s;record.ref.contentHash=hash(intent);p.commandRef=structuredClone(record.ref);p.request.envelopeHash=e.envelopeHash;const{checkedAt:____,expires:_____,...binding}=fact;p.bindingHash=hash({scope:p.scope,commandRef:record.ref,authorizationReceiptRef:p.authorizationReceiptRef,reservationRef:p.reservationRef,fact:binding});p.requestHash=hash(p.request);permit.ref.contentHash=hash(p);};seal();
 const budget:any=shift(x.reservation);Object.assign(budget.snapshot.claim,{projectId:scope.projectId,executionId:scope.executionId});budget.ref.contentHash=hash(budget.snapshot);s.reservationRef=structuredClone(budget.ref);p.reservationRef=structuredClone(budget.ref);e.context.budgetRef=structuredClone(budget.ref);seal();
 const digest=hash({projectId:scope.projectId,actorId:fact.subject.userId,clientId:fact.subject.clientId,controlGeneration:fact.subject.controlGeneration,requestHash:s.requestHash,policyRef:fact.permissionPolicyRef,targetRef:record.ref});
 p.authorizationReceiptRef={...p.authorizationReceiptRef,contentHash:digest};e.context.authorizationReceiptRef=structuredClone(p.authorizationReceiptRef);seal();
 // 서명 검증을 주장하지 않는 저장 이력: 원 1→소비2 및 원 receipt를 별도로 작성한다.
 const originals:any[]=shift(x.f.state().challenges),old=originals.find(v=>v.snapshot.consumption?.resultRef.id===p.proofRef.id),issued=originals.find(v=>v.ref.id===old.ref.id&&v.ref.version===1),cs=structuredClone(issued.snapshot);
 cs.sequence=1;Object.assign(cs.binding,{projectId:scope.projectId,executionId:scope.executionId,publicKeyFingerprint:fact.registration.hostPublicKeyFingerprint});cs.request.target=executionTarget('POST','/api/v1/connectors/'+p.scope.connectorId+'/executions/'+scope.executionId+'/commands/'+p.commandId+'/permit',[],canonicalJson(p.request));cs.requestHash=hash(cs.request);
 const original={ref:{...issued.ref,contentHash:hash(cs)},snapshot:cs},proofSnapshot={kind:'SYNTHETIC_PROOF_RESULT',challengeRef:original.ref,requestId:cs.request.requestId,proofHash:old.snapshot.consumption.proofHash,recordedAt:p.issuedAt,credentialIssued:false,executionAuthorized:false,dispatchPerformed:false};
 p.proofRef={...p.proofRef,contentHash:hash(proofSnapshot)};permit.ref.contentHash=hash(p);
 const consumedSnapshot={...structuredClone(cs),sequence:2,previousRef:original.ref,consumption:{proofHash:proofSnapshot.proofHash,resultRef:p.proofRef,consumedAt:p.issuedAt}},consumed={ref:{id:original.ref.id,version:2,contentHash:hash(consumedSnapshot)},snapshot:consumedSnapshot};
 const proofRow:any={project_id:scope.projectId,id:p.proofRef.id,version:1,grant_id:p.scope.grantRef.id,grant_version:p.scope.grantRef.version,challenge_id:original.ref.id,challenge_version:1,content_hash:p.proofRef.contentHash,snapshot_json:proofSnapshot};
 const permitRow:any={project_id:scope.projectId,execution_id:scope.executionId,generation:1,id:permit.ref.id,version:1,content_hash:permit.ref.contentHash,snapshot_json:p,command_id:p.commandId,command_record_id:record.ref.id,command_record_version:1,grant_id:p.scope.grantRef.id,grant_version:1,reservation_id:p.reservationRef.id,reservation_version:1,proof_result_id:p.proofRef.id,proof_result_version:1,envelope_hash:e.envelopeHash};
 const row:any={project_id:scope.projectId,execution_id:scope.executionId,generation:1,id:record.ref.id,version:1,content_hash:record.ref.contentHash,snapshot_json:s,grant_id:p.scope.grantRef.id,grant_version:1,envelope_hash:e.envelopeHash,authorization_ref:e.context.authorizationReceiptRef};
 const{request:rq,envelope:ev,...storedIntent}=s;
 Object.assign(row,{command_actor:fact.subject.userId,command_client:fact.subject.clientId,command_key:rq.commandId,operation:'queueExecutionCommand',operation_id:scope.executionId,command_scope_kind:'PROJECT',command_scope_id:scope.projectId,state:'APPLIED',request_hash:s.requestHash,expected_version:1,control_generation:fact.subject.controlGeneration,policy_ref:fact.permissionPolicyRef,authorization_id:p.authorizationReceiptRef.id,authorization_subject:{kind:'HUMAN',userId:fact.subject.userId,clientId:fact.subject.clientId},authorization_policy:fact.permissionPolicyRef,authorization_scope:digest,audit_scope:digest,audit_outcome:'APPLIED',audit_source:'HUMAN_COMMAND',outbox_kind:'EXECUTION_INSTRUCTION_SYNTHETIC_ONLY',outbox_state:'HELD_SYNTHETIC_ONLY',destination_ref:{transport:'SYNTHETIC_ONLY',registrationRef:fact.registration.ref,executionId:scope.executionId,generation:1,grantKind:'EXECUTION'},payload_ref:{commandRef:record.ref,grantRef:p.scope.grantRef,envelopeHash:e.envelopeHash},outbox_scope:hash({scope:s.scope,commandRef:record.ref,grantRef:p.scope.grantRef,envelopeHash:e.envelopeHash}),budget_id:budget.ref.id,budget_version:1,budget_hash:budget.ref.contentHash,budget_snapshot:budget.snapshot,budget_sequence:budget.snapshot.sequence,budget_command:rq.commandId,result_ref:{projectId:scope.projectId,commandId:rq.commandId,operationId:scope.executionId,status:'APPLIED',targetId:record.ref.id,version:1,data:{status:'SYNTHETIC_INSTRUCTION_QUEUE_STORED',executionAuthorized:false,dispatchPerformed:false,ref:record.ref,snapshot:storedIntent}}});
 const selection:any={permitScope:structuredClone(p.scope),permitRef:structuredClone(permit.ref),commandRef:structuredClone(record.ref),localAttemptRef:structuredClone(p.request.localAttemptRef),osOwnershipRef:structuredClone(p.request.osOwnershipRef),envelopeHash:e.envelopeHash};
 let mode='';const queries:string[]=[];const db={async query(sql:string,args:any[]=[]){queries.push(sql);
  if(sql.includes('FROM anvil.execution_instruction_permits')){assert.deepEqual(args,[scope.projectId,scope.executionId,1]);return{rows:mode==='MISSING'?[]:[permitRow]};}
  if(sql.includes('FROM anvil.execution_receipts')){assert.deepEqual(args,[scope.projectId,p.proofRef.id,1]);return{rows:mode==='NO_PROOF'?[]:[proofRow]};}
  if(sql.includes('FROM anvil.execution_challenges')){assert.deepEqual(args,[scope.projectId,p.scope.grantRef.id,p.scope.grantRef.version]);return{rows:[original,consumed].map(v=>({project_id:scope.projectId,id:v.ref.id,version:v.ref.version,grant_id:p.scope.grantRef.id,grant_version:p.scope.grantRef.version,server_sequence:v.snapshot.sequence,content_hash:v.ref.contentHash,snapshot_json:v.snapshot}))};}
  if(sql.includes('FROM anvil.execution_commands')){assert.deepEqual(args.slice(0,5),[scope.projectId,scope.executionId,1,selection.commandRef.id,1]);if(sql.includes('JOIN anvil.commands'))assert.equal(args[5],selection.commandRef.contentHash);if(mode==='REVOKE')(f.row as any).revoked_at=f.now;if(mode==='EXPIRE')f.late();return{rows:[{...row,...(mode==='NO_GRAPH'?{audit_outcome:'DENIED'}:{})}]};}
  if(sql.includes('FROM anvil.projects p JOIN anvil.project_members')&&!sql.includes('FOR UPDATE')){assert.deepEqual(args,[scope.projectId,f.row.uid]);return{rows:[f.member]};}
  return f.db.query(sql,args);
 },release(){throw Error('CALLER_OWNS_CONNECTION');}} as unknown as PoolClient;
 const read=()=>{assert.equal(typeof m.readOwnershipInstructionHistory,'function','원 SEND/permit 읽기 결박이 필요하다');return m.readOwnershipInstructionHistory(db,f.access,f.token,f.csrf,scope,f.prep.ref,selection);};
 // 기존 production codec도 독립 호출해 잘못된 fixture가 모든 음성을 가리지 않도록 한다.
 if(options.disposition!=='REQUIRE_APPROVAL')await f.read();else assert.equal((await readOwnershipHumanPolicyRegistrationBasis(db,f.access,f.token,f.csrf,f.prep)).approvalRequired,true);
 SyntheticInstructionPermits.readStoredLedger(await new SyntheticPgInstructionPermitJournal().read(db,p.scope),p.scope,f.now.toISOString());readSyntheticInstructionQueueRecord(record,s.scope);queries.length=0;
 return{f,scope,row,permitRow,record,permit,selection,read,queries,mode(v:string){mode=v;}};
}
test('현재 AUTO 준비 아래 원 pair만 읽고 실제 SEND·proof·OS 권위는 미확인으로 남긴다',async()=>{
 const f=await fixture(),r=await f.read();assert.equal(r.purpose,'OWNERSHIP_INSTRUCTION_HISTORY_ONLY');assert.deepEqual(r.commandRef,f.record.ref);assert.deepEqual(r.permitRef,f.permit.ref);
 assert.equal(r.executionAuthorized,false);assert.equal(r.dispatchPerformed,false);assert.equal(r.bindingAuthorized,false);assert.equal(r.proofConsumptionVerified,false);assert.equal(r.writerState,'UNKNOWN');
 assert(r.missingEvidence.includes('PROOF_SIGNATURE_VERIFICATION'));assert(r.missingEvidence.includes('CURRENT_SEND_AUTHORITY'));assert(r.missingEvidence.includes('ACTUAL_LOCAL_ATTEMPT_PARENT_OS'));
 assert(f.queries.every(q=>q.startsWith('SELECT ')));
});
test('선택 echo나 원 row/ref/hash/세대 불일치로 pair를 만들지 않는다',async()=>{
 for(const change of [(f:any)=>f.selection.localAttemptRef.contentHash='0'.repeat(64),(f:any)=>f.selection.osOwnershipRef.id=f.scope.projectId,(f:any)=>f.selection.commandRef.contentHash='0'.repeat(64),(f:any)=>f.selection.envelopeHash='0'.repeat(64),(f:any)=>f.permitRow.proof_result_id=f.scope.projectId,(f:any)=>f.row.generation=2,(f:any)=>f.row.authorization_ref={...f.row.authorization_ref,contentHash:'0'.repeat(64)},(f:any)=>f.row.snapshot_json.request.clientId=f.scope.projectId]){
  const f=await fixture();change(f);await assert.rejects(f.read(),/OWNERSHIP_INSTRUCTION_HISTORY_UNAVAILABLE/);
 }
 const f=await fixture();f.mode('MISSING');await assert.rejects(f.read(),/OWNERSHIP_INSTRUCTION_HISTORY_UNAVAILABLE/);
});
test('조회 도중 HUMAN 회수·기한 경과는 원 pair가 일치해도 거절한다',async()=>{
 for(const mode of ['REVOKE','EXPIRE']){const f=await fixture();f.mode(mode);await assert.rejects(f.read(),/OWNERSHIP_INSTRUCTION_HISTORY_UNAVAILABLE/);assert(f.queries.some(q=>q.includes('FROM anvil.execution_commands')));}
});
test('REQUIRE 준비를 AUTO로 우회하거나 읽기 전에 malformed scope를 쿼리하지 않는다',async()=>{
 const f=await fixture();f.selection.extra=true;await assert.rejects(f.read(),/OWNERSHIP_INSTRUCTION_HISTORY_UNAVAILABLE/);assert.equal(f.queries.length,0);
 const g=await fixture({disposition:'REQUIRE_APPROVAL'});await assert.rejects(g.read(),/OWNERSHIP_INSTRUCTION_HISTORY_UNAVAILABLE/);assert(!g.queries.some(q=>q.includes('FROM anvil.execution_instruction_permits')));
});
test('갱신 HUMAN 세대2와 실행 credential 세대1을 혼동하지 않는다',async()=>{
 const f=await fixture({humanCredentialGeneration:2}),r=await f.read();assert.equal(r.subject.credentialGeneration,2);assert.equal(f.permit.snapshot.scope.credentialGeneration,1);assert.equal(r.executionAuthorized,false);
});
test('현재 HUMAN 준비 재대조 전에 실제 원 proof 소비 이력도 읽으며 누락은 거절한다',async()=>{
 const f=await fixture(),r=await f.read();assert.equal(r.proofHistory?.purpose,'OWNERSHIP_INSTRUCTION_PROOF_HISTORY_ONLY');assert.deepEqual(r.proofHistory.proofRef,f.permit.snapshot.proofRef);assert.equal(r.proofHistory.signatureVerified,false);
 const g=await fixture();g.mode('NO_PROOF');await assert.rejects(g.read(),/OWNERSHIP_INSTRUCTION_HISTORY_UNAVAILABLE/);
});
test('원 SEND 허가/감사·예약/outbox graph를 기존 verifier로 읽고 거절 자료는 반환하지 않는다',async()=>{
 const f=await fixture(),r=await f.read();assert.equal(r.sendAuthorizationGraphRead,true);
 const g=await fixture();g.mode('NO_GRAPH');await assert.rejects(g.read(),/OWNERSHIP_INSTRUCTION_HISTORY_UNAVAILABLE/);assert(g.queries.some(q=>q.includes('JOIN anvil.audit_events')));
});
test('원 허가 주체·예약·outbox가 서로 달라도 저장 pair만으로 허용하지 않는다',async()=>{
 for(const change of [(f:any)=>f.row.authorization_subject.userId=f.scope.projectId,(f:any)=>f.row.budget_hash='0'.repeat(64),(f:any)=>f.row.payload_ref.commandRef={...f.record.ref,contentHash:'0'.repeat(64)},(f:any)=>f.row.outbox_state='PENDING']){const f=await fixture();change(f);await assert.rejects(f.read(),/OWNERSHIP_INSTRUCTION_HISTORY_UNAVAILABLE/);assert(f.queries.some(q=>q.includes('JOIN anvil.audit_events')));}
});
