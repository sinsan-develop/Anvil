import type {PoolClient} from 'pg';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type DispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1} from '../../../../contracts/runtime/dispatch-receipt-v1.ts';
import {validateProviderSessionClaim,type ProviderSessionClaim,type ProviderRef} from '../../../../contracts/runtime/provider-session-claim-v1.ts';
import {readServerExecutionFactV1,executionFactChecks} from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import {cloneV1,recordV1,refV1,uuidV1,hashV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import type {AuthenticatedIdentity} from '../access/repository.ts';
import type {ProviderWireAttempt} from '../../../connector/adapters/primary/provider-bound-wire.ts';
import type {SyntheticChallengeScope,SyntheticChallengeTransaction} from './execution-challenges.ts';
import type {SyntheticPermitFacts} from './execution-permit-store.ts';
import {readSyntheticStopCurrent} from './execution-stop.ts';
import {SyntheticPgStopCommandStore} from './execution-stop-store.ts';
import {SyntheticPgProviderClaimJournal} from './provider-session-claim-journal.ts';
import {readProviderChallengeContext} from './provider-send-current.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function fail():never{throw Error('PROVIDER_STOP_CURRENT_UNAVAILABLE');}
type Selection={claim:ProviderSessionClaim;parent:ProviderSessionClaim;claimRef:ProviderRef;commandRef:ProviderRef;attempt:ProviderWireAttempt};
/** Current normal-execution STOP only. Existing auth transaction/locks and fresh fact provider
 * are required; no new SEND permit, IDLE condition, reservation, OS kill or recovery grant is issued. */
export class BoundSyntheticProviderStopCurrent{
 readonly transport='SYNTHETIC_ONLY' as const;
 #db:PoolClient;#actor:AuthenticatedIdentity;#scope:SyntheticChallengeScope;#store:SyntheticPgStopCommandStore;#facts:SyntheticPermitFacts;#challenges:SyntheticChallengeTransaction;#selected:Selection;
 constructor(db:PoolClient,actor:AuthenticatedIdentity,scope:SyntheticChallengeScope,store:SyntheticPgStopCommandStore,facts:SyntheticPermitFacts,challenges:SyntheticChallengeTransaction,selection:Selection){
  if(typeof db?.query!=='function'||!(store instanceof SyntheticPgStopCommandStore)||!recordV1(scope,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||scope.mode!=='EXECUTION'||![scope.projectId,scope.connectorId,scope.executionId].every(uuidV1)||!refV1(scope.grantRef)||![scope.executionGeneration,scope.credentialGeneration].every(v=>Number.isSafeInteger(v)&&v>0)||!recordV1(selection,['claim','parent','claimRef','commandRef','attempt'])||!refV1(selection.commandRef))fail();
  const c=validateProviderSessionClaim(selection.claim,selection.parent);if(c.claim.kind!=='TURN'||!same(c.ref,selection.claimRef))fail();
  this.#db=db;this.#actor=cloneV1(actor);this.#scope=cloneV1(scope);this.#store=store;this.#facts=facts;this.#challenges=challenges;this.#selected=cloneV1(selection);this.#ports();
 }
 #ports(){if(this.#store.transport!=='SYNTHETIC_ONLY'||this.#facts?.transport!=='SYNTHETIC_ONLY'||typeof this.#facts.current!=='function'||typeof this.#challenges?.clock!=='function'||typeof this.#challenges.current!=='function')fail();}
 async #now(){this.#ports();const n=await this.#challenges.clock();if(!isoV1(n))return fail();return n;}
 async current(raw:DispatchEnvelopeV1,claimRef:ProviderRef){
  try{
   const now=await this.#now(),e=readDispatchEnvelopeV1(raw,Date.parse(now)),s=this.#scope,sel=this.#selected,c=sel.claim,a=sel.attempt,execution={projectId:s.projectId,executionId:s.executionId,executionGeneration:s.executionGeneration};
   if(e.operation!=='REQUEST_STOP'||!same(claimRef,sel.claimRef)||!recordV1(a,['key','envelopeHash','localAttemptRef','permitRef','instructionContentHash','bindingHash'])||!same(a.key,receiptKeyV1(e))||a.envelopeHash!==e.envelopeHash||!refV1(a.localAttemptRef)||a.localAttemptRef.version!==1||a.permitRef!==null||a.instructionContentHash!==null||!hashV1(a.bindingHash))fail();
   const context=readProviderChallengeContext(await this.#challenges.current(),s,now),record=await this.#store.read(this.#db,this.#actor,execution,sel.commandRef);
   if(!same(record.snapshot.envelope,e))fail();
   const inspect=async()=>{const at=await this.#now(),value=await this.#store.current(this.#db,this.#actor,execution);return readSyntheticStopCurrent(value,execution,record.snapshot.request,this.#actor,Date.parse(at));};
   const before=await inspect();if(before.c.grantKind!=='EXECUTION'||!same(before.c.grantRef,s.grantRef)||!same(before.binding,record.snapshot.currentBinding))fail();
   const entry=await new SyntheticPgProviderClaimJournal().read(this.#db,{projectId:c.projectId,agentSessionId:c.agentSessionRef.id,executionId:c.execution.id,generation:c.execution.generation,commandId:c.commandId,kind:'TURN',requestIdDigest:c.source.requestIdDigest,claimHash:sel.claimRef.contentHash});
   if(!entry||!same(entry.scope,s)||!same(entry.claim,c)||!same(entry.parentThreadClaim,sel.parent)||!same(entry.receipt.claimRef,sel.claimRef)||Date.parse(entry.receipt.recordedAt)>Date.parse(now))fail();
   const grants=(await this.#db.query('SELECT snapshot_json FROM anvil.execution_grants WHERE project_id=$1 AND id=$2 AND version=$3 AND content_hash=$4',[s.projectId,s.grantRef.id,s.grantRef.version,s.grantRef.contentHash])).rows;
   if(grants.length!==1)fail();const original=readServerExecutionFactV1(grants[0].snapshot_json?.binding);
   const fresh=async()=>{
    this.#ports();const f=readServerExecutionFactV1(await this.#facts.current(this.#db,cloneV1(s),cloneV1(original))),at=await this.#now(),i=f.intent;
    if(f.projectId!==s.projectId||f.executionId!==s.executionId||f.executionGeneration!==s.executionGeneration||f.writerState!=='OWNED'||!same(f.subject,before.c.grantSubject)||!same(f.agentSession.sessionRef,c.agentSessionRef)||!same(f.agentSession.roleBindingRef,c.responsibleBindingRef)||!same(f.registration.ref,c.executorRegistrationRef)||f.registration.connectorId!==s.connectorId||f.registration.hostPublicKeyFingerprint!==context.publicKeyFingerprint||!same(i.assignmentRef,c.assignmentRef)||!same(i.connectionRef,e.context.connectionRef)||!same(i.environmentRef,e.context.environmentRef)||!same(i.capabilityRef,e.context.capabilityRef)||!same(i.sourceScopes,e.context.sourceScopes)||!same(f.permissionPolicyRef,before.c.permissionPolicyRef)||!same(i.budgetPolicyRef,before.c.budgetPolicyRef)||!same(f.budgetReservationRef,before.c.budgetReservationRef)||!f.checks.osFence.evidenceRefs.some(r=>same(r,before.c.ownershipRef))||executionFactChecks.some(k=>k!=='understanding'&&f.checks[k].state!=='VERIFIED_CURRENT')||Date.parse(f.checkedAt)>Date.parse(at)||Date.parse(at)-Date.parse(f.checkedAt)>30000||Object.values(f.expires).some(v=>Date.parse(v)<=Date.parse(at)))fail();return f;
   };
   const first=await fresh(),after=await inspect(),last=await fresh(),ended=await this.#now(),finalContext=readProviderChallengeContext(await this.#challenges.current(),s,ended),stable=(f:typeof first)=>{const{checkedAt:_,...v}=f;return v;};
   if(!same(before.binding,after.binding)||!same(stable(first),stable(last))||!same(context,finalContext))fail();
   const deadline=Math.min(Date.parse(e.expiresAt),Date.parse(c.usableBefore),Date.parse(sel.parent.usableBefore),Date.parse(context.grantExpiresAt),Date.parse(before.c.expiresAt),Date.parse(after.c.expiresAt),Date.parse(before.c.checkedAt)+30000,Date.parse(after.c.checkedAt)+30000,Date.parse(first.checkedAt)+30000,Date.parse(last.checkedAt)+30000,...Object.values(first.expires).map(Date.parse),...Object.values(last.expires).map(Date.parse));
   if(deadline<=Date.parse(ended))fail();this.#ports();return{key:receiptKeyV1(e),envelopeHash:e.envelopeHash,claimRef:cloneV1(sel.claimRef),parentThreadClaimRef:cloneV1(c.parentThreadClaimRef),fact:cloneV1(last),expiresAt:new Date(deadline).toISOString()};
  }catch{return fail();}
 }
}
