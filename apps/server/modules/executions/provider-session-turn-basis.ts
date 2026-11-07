import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,recordV1,refV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {validateProviderSessionClaim,type ProviderSessionClaim} from '../../../../contracts/runtime/provider-session-claim-v1.ts';
import {readServerExecutionFactV1,executionFactChecks} from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import {receiptKeyV1} from '../../../../contracts/runtime/dispatch-receipt-v1.ts';
import {SyntheticInstructionPermits} from './execution-instruction-permits.ts';
import {readSyntheticInstructionQueueRecord} from './execution-instruction-queue.ts';
import {readSyntheticInstructionReservation} from './execution-instruction-store.ts';
import type {SyntheticChallengeScope as Scope} from './execution-challenges.ts';
import {readConsumedExecutionRequest} from './execution-challenges.ts';
import {executionTarget} from './execution-proof.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
function reject():never{throw Error('PROVIDER_TURN_BASIS_REJECTED');}
/** A stored consumed SEND is evidence for recording a reply, not authority to send again.
 * Does not call permit.consume/admission, require live IDLE, create reservations or extend original time limits. */
export function readProviderTurnBasis(raw:unknown,scope:Scope,claim:ProviderSessionClaim,parent:ProviderSessionClaim,now:string,publicKeyFingerprint:string,challengeJournal:unknown){
 const c=validateProviderSessionClaim(claim,parent).claim;
 if(scope.mode!=='EXECUTION'||c.kind!=='TURN'||c.source.method!=='turn/start'||!isoV1(now)||!recordV1(raw,['fact','grantRef','grantExpiresAt','commandRef','commandSnapshot','authorizationReceiptRef','permit','localAttemptRef','instructionReservation'])||!refV1(raw.commandRef)||!same(raw.grantRef,scope.grantRef)||!isoV1(raw.grantExpiresAt)||!same(raw.authorizationReceiptRef,c.authorizationReceiptRef)||!same(raw.localAttemptRef,c.localAttemptRef))return reject();
 const f=readServerExecutionFactV1(raw.fact),record=readSyntheticInstructionQueueRecord({ref:raw.commandRef,snapshot:raw.commandSnapshot},{projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration}),s=record.snapshot,e=s.envelope,reservation=readSyntheticInstructionReservation(raw.instructionReservation,record),p=SyntheticInstructionPermits.readStoredLedger({complete:true,permits:[raw.permit]},{...scope,mode:'EXECUTION'},now)[0];
 if(!p)return reject();const ps=p.snapshot,{checkedAt:_,expires:__,...factBinding}=f,{checkedAt:___,expires:____,...permitFact}=ps.currentFact,{expires:_____,...queuedFact}=s.currentBinding.fact;
 if(!same(factBinding,permitFact)||!same(permitFact,queuedFact)||!same(ps.scope,scope)||!same(ps.commandRef,record.ref)||!same(ps.authorizationReceiptRef,c.authorizationReceiptRef)||!same(ps.reservationRef,reservation.ref)||!same(p.ref,c.permitRef)||!same(ps.request.localAttemptRef,c.localAttemptRef)||ps.request.envelopeHash!==c.envelopeHash||ps.commandId!==c.commandId||e.commandId!==c.commandId||e.envelopeHash!==c.envelopeHash||e.operation!=='SEND_INSTRUCTION'||!same(e.payload.sessionBindingRef,c.agentSessionRef)||!same(s.currentBinding.grantRef,scope.grantRef)||s.currentBinding.grantExpiresAt!==raw.grantExpiresAt
  ||c.source.requestIdDigest!==hash(hash({key:receiptKeyV1(e),envelopeHash:e.envelopeHash}))||!same(e.context.authorizationReceiptRef,c.authorizationReceiptRef)||f.projectId!==scope.projectId||f.executionId!==scope.executionId||f.executionGeneration!==scope.executionGeneration||f.registration.connectorId!==scope.connectorId||f.registration.hostPublicKeyFingerprint!==publicKeyFingerprint||f.writerState!=='OWNED'
  ||!same(c.agentSessionRef,f.agentSession.sessionRef)||!same(c.responsibleBindingRef,f.agentSession.roleBindingRef)||!same(c.assignmentRef,f.intent.assignmentRef)||!same(c.connectionRef,f.intent.connectionRef)||!same(c.environmentRef,f.intent.environmentRef)||!same(c.executorRegistrationRef,f.registration.ref)||!same(e.context.budgetRef,reservation.ref)
  ||executionFactChecks.some(k=>k!=='understanding'&&f.checks[k].state!=='VERIFIED_CURRENT')||f.intent.mode==='WORK'&&(f.understandingReviewRef===null||f.checks.understanding.state!=='VERIFIED_CURRENT')||f.intent.mode==='CONTEXT_REVIEW'&&f.intent.sourceScopes.some(source=>source.targets.some(t=>t.access!=='READ'))||Date.parse(f.checkedAt)>Date.parse(now)||Date.parse(now)-Date.parse(f.checkedAt)>30000||Date.parse(ps.issuedAt)>Date.parse(c.capturedAt)||Date.parse(c.capturedAt)>Date.parse(now))return reject();
 const sourceRefs=[...new Map(f.intent.sourceScopes.map(v=>[canonicalJson(v.observationRef),v.observationRef])).values()];if(!same(ps.request.sourceObservationRefs,sourceRefs)||!f.checks.osFence.evidenceRefs.some(r=>same(r,ps.request.osOwnershipRef)))return reject();
 const consumed=readConsumedExecutionRequest(challengeJournal,scope,ps.proofRef,executionTarget('POST','/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/commands/'+c.commandId+'/permit',[],canonicalJson(ps.request)),now,ps.issuedAt,publicKeyFingerprint);
 if(Date.parse(ps.expiresAt)>Date.parse(consumed.expiresAt)||Date.parse(ps.proofExpiresAt)!==Date.parse(consumed.expiresAt))return reject();
 const deadline=Math.min(Date.parse(raw.grantExpiresAt),Date.parse(ps.expiresAt),Date.parse(ps.commandExpiresAt),Date.parse(ps.proofExpiresAt),Date.parse(ps.grantExpiresAt),Date.parse(e.expiresAt),Date.parse(c.usableBefore),Date.parse(parent.usableBefore),Date.parse(f.checkedAt)+30000,...Object.values(f.expires).map(Date.parse));
 if(deadline<=Date.parse(now))return reject();return{now,deadline,bindingHash:hash({...cloneV1(raw),fact:factBinding,parent:validateProviderSessionClaim(parent).ref})};
}
