import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type DispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1} from '../../../../contracts/runtime/dispatch-receipt-v1.ts';
import {validateProviderSessionClaim,type ProviderSessionClaim,type ProviderRef} from '../../../../contracts/runtime/provider-session-claim-v1.ts';
import {cloneV1,recordV1,refV1,uuidV1,isoV1,hashV1} from '../../../../contracts/runtime/validation-v1.ts';
import type {AuthenticatedIdentity} from '../access/repository.ts';
import type {ProviderWireAttempt} from '../../../connector/adapters/primary/provider-bound-wire.ts';
import {SyntheticPgInstructionPermitBasis} from './execution-instruction-permit-basis.ts';
import {SyntheticPgInstructionPermitJournal} from './execution-instruction-permit-journal.ts';
import {SyntheticInstructionPermits} from './execution-instruction-permits.ts';
import {SyntheticPgProviderClaimJournal} from './provider-session-claim-journal.ts';
import {readConsumedExecutionRequest,type SyntheticChallengeTransaction,type SyntheticChallengeScope} from './execution-challenges.ts';
import {publicKeyFingerprint} from '../connections/registration-proof.ts';
import {executionTarget} from './execution-proof.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function fail():never{throw Error('PROVIDER_SEND_CURRENT_UNAVAILABLE');}
const factBinding=(f:any)=>{const{checkedAt:_,expires:__,...value}=f;return value;};
/** Read-only shape/current binding check; only a trusted existing challenge transaction supplies raw. */
export function readProviderChallengeContext(value:unknown,s:SyntheticChallengeScope,now:string){
 const raw=cloneV1(value);if(!isoV1(now)||!recordV1(raw,['context','spki','checkedAt'])||!isoV1(raw.checkedAt)||Date.parse(raw.checkedAt)>Date.parse(now)||Date.parse(now)-Date.parse(raw.checkedAt)>30000)return fail();const c=raw.context;
 if(!recordV1(c,['transport','mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration','scopeDigest','publicKeyFingerprint','grantExpiresAt'])||c.transport!=='SYNTHETIC_ONLY'||!hashV1(c.scopeDigest)||!hashV1(c.publicKeyFingerprint)||!isoV1(c.grantExpiresAt)||Date.parse(c.grantExpiresAt)<=Date.parse(now)||publicKeyFingerprint(raw.spki)!==c.publicKeyFingerprint||Object.keys(s).some(k=>!same(c[k],(s as any)[k])))fail();return c;
}
/** Bound inside the EXISTING authenticated execution transaction. No pool/BEGIN/COMMIT,
 * permit consumption, reservation issuance, HTTP activation or actual provider/OS authority.
 * Caller owns auth/grant locks and the local transport's durable attempt; never HTTP-supplied actor. */
export class BoundSyntheticProviderSendCurrent{
 readonly transport='SYNTHETIC_ONLY' as const;
 #db:PoolClient;#actor:AuthenticatedIdentity;#scope:SyntheticChallengeScope;#basis:SyntheticPgInstructionPermitBasis;#challenges:SyntheticChallengeTransaction;
 #claim:ProviderSessionClaim;#claimRef:ProviderRef;#attempt:ProviderWireAttempt;
 constructor(db:PoolClient,actor:AuthenticatedIdentity,scope:SyntheticChallengeScope,basis:SyntheticPgInstructionPermitBasis,challenges:SyntheticChallengeTransaction,selection:{claim:ProviderSessionClaim;claimRef:ProviderRef;attempt:ProviderWireAttempt}){
  if(typeof db?.query!=='function'||!(basis instanceof SyntheticPgInstructionPermitBasis)||!recordV1(scope,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||scope.mode!=='EXECUTION'||![scope.projectId,scope.connectorId,scope.executionId].every(uuidV1)||!refV1(scope.grantRef)||![scope.executionGeneration,scope.credentialGeneration].every(v=>Number.isSafeInteger(v)&&v>0)||!recordV1(selection,['claim','claimRef','attempt']))fail();
  const c=validateProviderSessionClaim(selection.claim);if(c.claim.kind!=='THREAD'||!same(c.ref,selection.claimRef))fail();
  this.#db=db;this.#actor=cloneV1(actor);this.#scope=cloneV1(scope);this.#basis=basis;this.#challenges=challenges;this.#claim=c.claim;this.#claimRef=c.ref;this.#attempt=cloneV1(selection.attempt);this.#ports();
 }
 #ports(){if(this.#basis.transport!=='SYNTHETIC_ONLY'||typeof this.#challenges?.clock!=='function'||typeof this.#challenges.current!=='function'||typeof this.#challenges.read!=='function')fail();}
 async #now(){this.#ports();const n=await this.#challenges.clock();if(!isoV1(n))return fail();return n;}
 async #context(now:string){
  return readProviderChallengeContext(await this.#challenges.current(),this.#scope,now);
 }
 async current(raw:DispatchEnvelopeV1,claimRef:ProviderRef){
  try{
   const now=await this.#now(),e=readDispatchEnvelopeV1(raw,Date.parse(now)),s=this.#scope,c=this.#claim,a=this.#attempt;
   if(e.operation!=='SEND_INSTRUCTION'||!same(claimRef,this.#claimRef)||!recordV1(a,['key','envelopeHash','localAttemptRef','permitRef','instructionContentHash','bindingHash'])||!same(a.key,receiptKeyV1(e))||a.envelopeHash!==e.envelopeHash||!refV1(a.localAttemptRef)||a.localAttemptRef.version!==1||!refV1(a.permitRef)||a.permitRef.version!==1||!hashV1(a.instructionContentHash)||!hashV1(a.bindingHash))fail();
   const context=await this.#context(now),before=await this.#basis.current(this.#db,this.#actor,s,e.commandId),f=before.fact;
   if(!same(before.record.snapshot.envelope,e)||before.turnState!=='IDLE'||!same(before.grantRef,s.grantRef)||c.projectId!==s.projectId||c.execution.id!==s.executionId||c.execution.generation!==s.executionGeneration||!same(c.agentSessionRef,e.payload.sessionBindingRef)||!same(c.assignmentRef,f.intent.assignmentRef)||!same(c.responsibleBindingRef,f.agentSession.roleBindingRef)||!same(c.executorRegistrationRef,f.registration.ref)||!same(c.connectionRef,e.context.connectionRef)||!same(c.environmentRef,e.context.environmentRef)||f.registration.hostPublicKeyFingerprint!==context.publicKeyFingerprint)fail();
   const entry=await new SyntheticPgProviderClaimJournal().read(this.#db,{projectId:c.projectId,agentSessionId:c.agentSessionRef.id,executionId:c.execution.id,generation:c.execution.generation,commandId:c.commandId,kind:'THREAD',requestIdDigest:c.source.requestIdDigest,claimHash:this.#claimRef.contentHash});
   if(!entry||!same(entry.claim,c)||!same(entry.receipt.claimRef,this.#claimRef)||!same(entry.scope,s))fail();
   if(s.mode!=='EXECUTION')return fail();
   const permits=SyntheticInstructionPermits.readStoredLedger(await new SyntheticPgInstructionPermitJournal().read(this.#db,s),{...s,mode:'EXECUTION'},now),matches=permits.filter(p=>p.snapshot.commandId===e.commandId);if(matches.length!==1)fail();
   const p=matches[0]!,v=p.snapshot;
   if(!same(p.ref,a.permitRef)||!same(v.scope,s)||!same(v.commandRef,before.record.ref)||!same(v.reservationRef,before.reservation.ref)||!same(v.authorizationReceiptRef,e.context.authorizationReceiptRef)||v.request.envelopeHash!==e.envelopeHash||!same(v.request.localAttemptRef,a.localAttemptRef)||!same(factBinding(v.currentFact),factBinding(f)))fail();
   const sourceRefs=[...new Map(f.intent.sourceScopes.map(x=>[canonicalJson(x.observationRef),x.observationRef])).values()];if(!same(v.request.sourceObservationRefs,sourceRefs)||!f.checks.osFence.evidenceRefs.some(r=>same(r,v.request.osOwnershipRef)))fail();
   const original=readConsumedExecutionRequest(await this.#challenges.read(),s,v.proofRef,executionTarget('POST','/api/v1/connectors/'+s.connectorId+'/executions/'+s.executionId+'/commands/'+e.commandId+'/permit',[],canonicalJson(v.request)),now,v.issuedAt,context.publicKeyFingerprint);
   if(v.proofExpiresAt!==original.expiresAt)fail();
   const after=await this.#basis.current(this.#db,this.#actor,s,e.commandId),ended=await this.#now(),last=await this.#context(ended);
   if(!same({...before,fact:factBinding(before.fact)},{...after,fact:factBinding(after.fact)})||!same(context,last))fail();
   const deadline=Math.min(Date.parse(e.expiresAt),Date.parse(c.usableBefore),Date.parse(before.grantExpiresAt),Date.parse(last.grantExpiresAt),Date.parse(v.expiresAt),Date.parse(v.commandExpiresAt),Date.parse(v.proofExpiresAt),Date.parse(v.grantExpiresAt),Date.parse(f.checkedAt)+30000,Date.parse(after.fact.checkedAt)+30000,...Object.values(f.expires).map(Date.parse),...Object.values(after.fact.expires).map(Date.parse));
   if(deadline<=Date.parse(ended))fail();this.#ports();return{key:receiptKeyV1(e),envelopeHash:e.envelopeHash,claimRef:cloneV1(this.#claimRef),parentThreadClaimRef:null,fact:cloneV1(after.fact),expiresAt:new Date(deadline).toISOString()};
  }catch{return fail();}
 }
}
