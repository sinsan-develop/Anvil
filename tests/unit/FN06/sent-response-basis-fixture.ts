import assert from 'node:assert/strict';

import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {receiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {readDispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {SyntheticPgInstructionPermitBasis} from '../../../apps/server/modules/executions/execution-instruction-permit-basis.ts';
import {providerTurnFixture} from './provider-turn-fixture.ts';
import {providerBindingHash} from '../../../contracts/runtime/provider-session-claim-v1.ts';
import {SyntheticProviderHandleReader} from '../../../apps/connector/adapters/primary/provider-handle-reader.ts';
import {SyntheticProviderBoundWire} from '../../../apps/connector/adapters/primary/provider-bound-wire.ts';
export async function sentResponseBasisFixture(){
 const x=await providerTurnFixture(),f=x.f,e=readDispatchEnvelopeV1(x.record.snapshot.envelope,Date.parse(f.basis.fact.checkedAt)),subject=f.basis.fact.subject,at=f.basis.fact.checkedAt,scope=f.scope,entry=f.state().entries[0],c=entry.claim,pr=x.permit.snapshot;
 const actor:any={actorId:subject.userId,clientId:subject.clientId,credentialGeneration:subject.credentialGeneration,serverOwner:false,reauthUntil:null,authSession:{id:subject.humanSessionId,idleExpiresAt:'2026-10-22T02:02:00.000Z',absoluteExpiresAt:'2026-10-22T02:02:00.000Z'}},attempt={key:receiptKeyV1(e),envelopeHash:e.envelopeHash,localAttemptRef:pr.request.localAttemptRef,permitRef:x.permit.ref,instructionContentHash:'a'.repeat(64),bindingHash:'b'.repeat(64)};
 const claimRow={project_id:c.projectId,claim_id:c.claimId,version:1,execution_id:c.execution.id,generation:1,command_id:c.commandId,agent_session_id:c.agentSessionRef.id,agent_session_version:1,grant_id:scope.grantRef.id,grant_version:1,permit_id:c.permitRef.id,permit_version:1,kind:'THREAD',request_id_digest:c.source.requestIdDigest,event_key:entry.eventKey,content_hash:contentHash(canonicalJson(c)),snapshot_json:entry,recorded_at:new Date(entry.receipt.recordedAt)};
 const permitRow={project_id:scope.projectId,execution_id:scope.executionId,generation:1,id:x.permit.ref.id,version:1,content_hash:x.permit.ref.contentHash,snapshot_json:pr,command_id:pr.commandId,command_record_id:pr.commandRef.id,command_record_version:1,grant_id:scope.grantRef.id,grant_version:1,reservation_id:pr.reservationRef.id,reservation_version:1,proof_result_id:pr.proofRef.id,proof_result_version:1,envelope_hash:e.envelopeHash};
 let fault='';const calls:string[]=[],basis=new SyntheticPgInstructionPermitBasis({transport:'SYNTHETIC_ONLY',read:async()=>structuredClone(x.record),current:async()=>({...structuredClone(x.record.snapshot.currentBinding),fact:structuredClone(f.basis.fact),checkedAt:at,expiresAt:e.expiresAt,turnState:fault==='busy'?'BUSY':'IDLE'})} as any,{checkDelivery:async()=>({record:structuredClone(x.reservation),policyRef:f.basis.fact.intent.budgetPolicyRef,checkedAt:at,persisted:false,executionAuthorized:false,dispatchPerformed:false})} as any);
 async function bound<T>(body:(s:any)=>Promise<T>,wrapChallenges:(c:any)=>any=c=>c){const m=await import('../../../apps/server/modules/executions/provider-send-current.ts');assert.equal(typeof m.BoundSyntheticProviderSendCurrent,'function');return f.store.transaction(scope,async(tx:any)=>{
  const db:any={query:async(sql:string)=>{calls.push(sql);if(sql==='SELECT clock_timestamp() AS at')return{rows:[{at:new Date(await tx.challenges.clock())}]};if(sql.includes('FROM anvil.execution_commands'))return{rows:[{id:x.record.ref.id,version:1,content_hash:x.record.ref.contentHash}]};if(sql.includes('FROM anvil.provider_session_claims'))return{rows:fault==='missingClaim'?[]:[claimRow]};if(sql.includes('FROM anvil.execution_instruction_permits'))return{rows:fault==='missingPermit'?[]:[permitRow]};throw Error('UNEXPECTED_QA_QUERY');}};
  const current=new m.BoundSyntheticProviderSendCurrent(db,actor,scope,basis,wrapChallenges(tx.challenges),{claim:c,claimRef:entry.receipt.claimRef,attempt});return body(current);
 });}
 return{x,f,e,actor,basis,attempt,claim:c,claimRef:entry.receipt.claimRef,permitRow,calls,bound,fault:(v:string)=>fault=v};
}
