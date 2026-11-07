import {canonicalJson,contentHash,parseWireJson} from '../../../../contracts/canonical.ts';
import {validateProviderSessionClaim,type ProviderSessionClaim,type ProviderRef} from '../../../../contracts/runtime/provider-session-claim-v1.ts';
import {readDispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1} from '../../../../contracts/runtime/dispatch-receipt-v1.ts';
import {readServerExecutionFactV1,executionFactChecks} from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import {cloneV1,recordV1,refV1,uuidV1,isoV1,hashV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {SyntheticExecutionChallenges,type SyntheticChallengeScope,type SyntheticChallengeTransaction} from './execution-challenges.ts';
import {executionTarget} from './execution-proof.ts';
import {readProviderTurnBasis} from './provider-session-turn-basis.ts';

export interface ProviderClaimReceipt {
 claimRef:ProviderRef;recordedAt:string;state:'PROVIDER_CLAIM_RECORDED';sourceVerification:'PROVIDER_CLAIM_ONLY';nonceConsumed:true;
 credentialIssued:false;executionAuthorized:false;dispatchPerformed:false;workAccepted:false;
}
export interface SyntheticProviderClaimEntry {scope:SyntheticChallengeScope;eventKey:string;claim:ProviderSessionClaim;receipt:ProviderClaimReceipt}
export interface SyntheticProviderClaimTransaction {
 challenges:SyntheticChallengeTransaction;
 /** Internal locked resolver, never supplied by the HTTP caller. Includes exact immutable START/permit records. */
 current(commandId:string):Promise<unknown>;
 claims:{findEvent(key:string):Promise<SyntheticProviderClaimEntry|null>;findId(id:string):Promise<SyntheticProviderClaimEntry|null>;append(entry:SyntheticProviderClaimEntry):Promise<void>};
 results:{bind(ref:ProviderRef,value:{bodyHash:string;receipt:ProviderClaimReceipt}):Promise<void>;read(ref:ProviderRef):Promise<{bodyHash:string;receipt:ProviderClaimReceipt}|null>};
 audit:{append(value:{kind:'PROVIDER_SESSION_CLAIM_RECORDED';scope:SyntheticChallengeScope;claimRef:ProviderRef;proofResultRef:ProviderRef;recordedAt:string}):Promise<void>};
}
export interface SyntheticProviderClaimStore {
 transport:'SYNTHETIC_ONLY';
 /** Single execution/generation lock and transaction for current/nonce/receipt/claim/audit; errors must rollback all writes. */
 transaction<T>(scope:SyntheticChallengeScope,body:(tx:SyntheticProviderClaimTransaction)=>Promise<T>):Promise<T>;
}
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const reject=():never=>{throw new AuthFailure('PROVIDER_SESSION_CLAIM_REJECTED',412);};
const conflict=():never=>{throw new AuthFailure('PROVIDER_SESSION_CLAIM_CONFLICT',409);};
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const eventKey=(c:ProviderSessionClaim)=>hash([c.projectId,c.execution.id,c.execution.generation,c.commandId,c.kind,c.source.requestIdDigest]);
const queueKeys=['transport','executionId','executionGeneration','state','grantRef','reservationRef','executorRegistrationRef','operation','payload','humanSessionId','sourceScopes','budgetPolicyRef','queuedAt','executionAuthorized','dispatchPerformed'];
const receiptKeys=['claimRef','recordedAt','state','sourceVerification','nonceConsumed','credentialIssued','executionAuthorized','dispatchPerformed','workAccepted'];
export function readProviderClaimReceipt(raw:unknown,claim:ProviderSessionClaim,now:string,parent?:ProviderSessionClaim):ProviderClaimReceipt{
 const expected=validateProviderSessionClaim(claim,parent).ref;
 if(!recordV1(raw,receiptKeys)||!same(raw.claimRef,expected)||!isoV1(raw.recordedAt)||Date.parse(raw.recordedAt)<Date.parse(claim.capturedAt)||Date.parse(raw.recordedAt)>Date.parse(now)
  ||raw.state!=='PROVIDER_CLAIM_RECORDED'||raw.sourceVerification!=='PROVIDER_CLAIM_ONLY'||raw.nonceConsumed!==true||raw.credentialIssued!==false||raw.executionAuthorized!==false||raw.dispatchPerformed!==false||raw.workAccepted!==false)return reject();
 return cloneV1(raw) as unknown as ProviderClaimReceipt;
}
/** Source-only authenticated THREAD receiver. No actual provider/HTTP/DB fallback or permission issuance. */
export class SyntheticProviderSessionClaims {
 readonly transport='SYNTHETIC_ONLY' as const;
 readonly store:SyntheticProviderClaimStore;
 constructor(store:SyntheticProviderClaimStore){this.store=store;this.#port();}
 #port(){if(this.store?.transport!=='SYNTHETIC_ONLY'||typeof this.store.transaction!=='function')return reject();}
 async #basis(tx:SyntheticProviderClaimTransaction,scope:SyntheticChallengeScope,claim:ProviderSessionClaim){
  this.#port();const raw=cloneV1(await tx.current(claim.commandId)),now=await tx.challenges.clock();this.#port();
  if(claim.kind==='TURN'){
   const parent=await this.#parent(tx,scope,claim,now),current=cloneV1(await tx.challenges.current());
   return readProviderTurnBasis(raw,scope,claim,parent,now,(current.context as any).publicKeyFingerprint,await tx.challenges.read());
  }
  if(!isoV1(now)||!recordV1(raw,['fact','grantRef','grantExpiresAt','commandRef','commandSnapshot','authorizationReceiptRef','permit','localAttemptRef'])
   ||!same(raw.grantRef,scope.grantRef)||!isoV1(raw.grantExpiresAt)||!refV1(raw.commandRef)||!same(raw.authorizationReceiptRef,claim.authorizationReceiptRef)||!same(raw.localAttemptRef,claim.localAttemptRef)
   ||!recordV1(raw.commandSnapshot,[...queueKeys,'envelope']))return reject();
  const f=readServerExecutionFactV1(raw.fact),e=readDispatchEnvelopeV1(raw.commandSnapshot.envelope,Date.parse(now)),{envelope:_,...q}=raw.commandSnapshot;
  if(f.projectId!==scope.projectId||f.executionId!==scope.executionId||f.executionGeneration!==scope.executionGeneration||f.registration.connectorId!==scope.connectorId||f.writerState!=='OWNED'
   ||Date.parse(f.checkedAt)>Date.parse(now)||Date.parse(now)-Date.parse(f.checkedAt)>30000||executionFactChecks.some(k=>k!=='understanding'&&f.checks[k].state!=='VERIFIED_CURRENT')
   ||f.intent.mode==='WORK'&&(f.understandingReviewRef===null||f.checks.understanding.state!=='VERIFIED_CURRENT')||f.intent.mode==='CONTEXT_REVIEW'&&f.intent.sourceScopes.some(s=>s.targets.some(t=>t.access!=='READ'))
   ||!same(claim.assignmentRef,f.intent.assignmentRef)||!same(claim.agentSessionRef,f.agentSession.sessionRef)||!same(claim.responsibleBindingRef,f.agentSession.roleBindingRef)
   ||!same(claim.connectionRef,f.intent.connectionRef)||!same(claim.environmentRef,f.intent.environmentRef)||!same(claim.executorRegistrationRef,f.registration.ref))return reject();
  const ch=cloneV1(await tx.challenges.current());
  if(!recordV1(ch.context,['transport','mode','projectId','connectorId','executionId','executionGeneration','grantRef','scopeDigest','credentialGeneration','publicKeyFingerprint','grantExpiresAt'])||ch.context.publicKeyFingerprint!==f.registration.hostPublicKeyFingerprint)return reject();
  if(raw.commandRef.contentHash!==hash(q)||q.transport!=='SYNTHETIC_ONLY'||q.state!=='SYNTHETIC_QUEUED'||q.executionAuthorized!==false||q.dispatchPerformed!==false
   ||q.executionId!==scope.executionId||q.executionGeneration!==scope.executionGeneration||!same(q.grantRef,scope.grantRef)||!same(q.reservationRef,f.budgetReservationRef)||!same(q.executorRegistrationRef,f.registration.ref)
   ||q.operation!=='START_SESSION'||e.operation!=='START_SESSION'||e.commandId!==claim.commandId||e.envelopeHash!==claim.envelopeHash||!same(q.payload,e.payload)||q.humanSessionId!==f.subject.humanSessionId
   ||!same(q.sourceScopes,f.intent.sourceScopes)||!same(q.budgetPolicyRef,f.intent.budgetPolicyRef)||q.queuedAt!==e.issuedAt||!same(e.executorRegistrationRef,f.registration.ref)
   ||!same(e.context,{projectId:f.projectId,assignmentId:f.intent.assignmentRef.id,executionId:f.executionId,executionGeneration:f.executionGeneration,connectionRef:f.intent.connectionRef,environmentRef:f.intent.environmentRef,authorizationReceiptRef:claim.authorizationReceiptRef,capabilityRef:f.intent.capabilityRef,budgetRef:f.budgetReservationRef,sourceScopes:f.intent.sourceScopes})
   ||!same(e.payload.contextBundleRef,f.intent.contextBundleRef)||claim.source.requestIdDigest!==hash(hash({key:receiptKeyV1(e),envelopeHash:e.envelopeHash})))return reject();
  const p=raw.permit,s=p?.snapshot;
  if(!recordV1(p,['ref','snapshot'])||!same(p.ref,claim.permitRef)||!refV1(p.ref)||p.ref.version!==1||p.ref.contentHash!==hash(s)
   ||!recordV1(s,['scope','commandId','commandRef','request','requestHash','proofRef','bindingHash','currentFact','state','issuedAt','expiresAt','executionAuthorized','dispatchPerformed'])
   ||!same(s.scope,scope)||s.commandId!==claim.commandId||!same(s.commandRef,raw.commandRef)||!refV1(s.proofRef)||!hashV1(s.bindingHash)||s.state!=='SYNTHETIC_CONSUMED_NO_AUTHORITY'||s.executionAuthorized!==false||s.dispatchPerformed!==false
   ||!isoV1(s.issuedAt)||!isoV1(s.expiresAt)||Date.parse(s.expiresAt)<=Date.parse(s.issuedAt)||Date.parse(s.expiresAt)>Date.parse(s.issuedAt)+30000||Date.parse(s.issuedAt)>Date.parse(claim.capturedAt)
   ||!recordV1(s.request,['envelopeHash','localAttemptRef','sourceObservationRefs','osOwnershipRef'])||s.requestHash!==hash(s.request)||s.request.envelopeHash!==claim.envelopeHash||!same(s.request.localAttemptRef,claim.localAttemptRef)||!refV1(s.request.osOwnershipRef))return reject();
  const old=readServerExecutionFactV1(s.currentFact),{checkedAt:__,...oldBinding}=old,{checkedAt:___,...factBinding}=f;
  const sourceRefs=[...new Map(f.intent.sourceScopes.map(v=>[canonicalJson(v.observationRef),v.observationRef])).values()];
  if(!same(oldBinding,factBinding)||s.bindingHash!==hash({scope,commandRef:raw.commandRef,authorizationReceiptRef:claim.authorizationReceiptRef,fact:oldBinding})
   ||!same(s.request.sourceObservationRefs,sourceRefs)||!f.checks.osFence.evidenceRefs.some(r=>same(r,s.request.osOwnershipRef)))return reject();
  const deadline=Math.min(Date.parse(raw.grantExpiresAt),Date.parse(s.expiresAt),Date.parse(e.expiresAt),Date.parse(claim.usableBefore),...Object.values(f.expires).map(Date.parse));
  if(Date.parse(claim.capturedAt)>Date.parse(now)||deadline<=Date.parse(now))return reject();
  return{now,deadline,bindingHash:hash({...raw,fact:factBinding})};
 }
 async #parent(tx:SyntheticProviderClaimTransaction,scope:SyntheticChallengeScope,claim:any,now:string):Promise<ProviderSessionClaim>{
  if(!refV1(claim?.parentThreadClaimRef)||claim.parentThreadClaimRef.version!==1)return reject();const raw=cloneV1(await tx.claims.findId(claim.parentThreadClaimRef.id));
  if(!recordV1(raw,['scope','eventKey','claim','receipt'])||!recordV1(raw.scope,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||raw.scope.mode!=='EXECUTION'||!refV1(raw.scope.grantRef)
   ||!['projectId','connectorId','executionId','executionGeneration','credentialGeneration'].every(k=>same((raw.scope as any)[k],(scope as any)[k]))||!raw.claim||raw.claim.kind!=='THREAD')return reject();
  const parent=await this.#entry(tx,raw,raw.scope as unknown as SyntheticChallengeScope,now);if(!parent||!same(validateProviderSessionClaim(parent.claim).ref,claim.parentThreadClaimRef))return reject();return parent.claim;
 }
 async #entry(tx:SyntheticProviderClaimTransaction,raw:unknown,scope:SyntheticChallengeScope,now:string):Promise<SyntheticProviderClaimEntry|null>{
  if(raw===null)return null;
  if(!recordV1(raw,['scope','eventKey','claim','receipt'])||!same(raw.scope,scope))return reject();
  const parent=(raw.claim as any)?.kind==='TURN'?await this.#parent(tx,scope,raw.claim,now):undefined,c=validateProviderSessionClaim(raw.claim,parent).claim;
  if(c.projectId!==scope.projectId||c.execution.id!==scope.executionId||c.execution.generation!==scope.executionGeneration||raw.eventKey!==eventKey(c))return reject();
  return{scope:cloneV1(scope),eventKey:raw.eventKey,claim:c,receipt:readProviderClaimReceipt(raw.receipt,c,now,parent)};
 }
 async #find(tx:SyntheticProviderClaimTransaction,scope:SyntheticChallengeScope,claim:ProviderSessionClaim,now:string){
  const byEvent=await this.#entry(tx,await tx.claims.findEvent(eventKey(claim)),scope,now),byId=await this.#entry(tx,await tx.claims.findId(claim.claimId),scope,now);
  if(byEvent!==null&&byEvent.eventKey!==eventKey(claim)||byId!==null&&byId.claim.claimId!==claim.claimId)return reject();
  if(byEvent===null&&byId===null)return null;
  if(!byEvent||!byId||!same(byEvent,byId)||!same(byEvent.claim,claim))return conflict();
  return byEvent;
 }
 async ingest(rawScope:unknown,challengeRef:unknown,rawProof:unknown,signature:unknown,bodyRaw:unknown){return(await this.ingestWithDeadline(rawScope,challengeRef,rawProof,signature,bodyRaw)).result;}
 async ingestWithDeadline(rawScope:unknown,challengeRef:unknown,rawProof:unknown,signature:unknown,bodyRaw:unknown){
  try{
   this.#port();if(!recordV1(rawScope,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||rawScope.mode!=='EXECUTION'
    ||![rawScope.projectId,rawScope.connectorId,rawScope.executionId].every(uuidV1)||!positive(rawScope.executionGeneration)||!positive(rawScope.credentialGeneration)||!refV1(rawScope.grantRef)||!refV1(challengeRef)||challengeRef.version!==1
    ||typeof signature!=='string'||signature.length>128||typeof bodyRaw!=='string'||Buffer.byteLength(bodyRaw)>16384)return reject();
   const scope=cloneV1(rawScope) as unknown as SyntheticChallengeScope,body=parseWireJson(bodyRaw);if(!recordV1(body,['claim']))return reject();
   const proof=cloneV1(rawProof),target=executionTarget('POST','/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/provider-session-claims',[],bodyRaw);
   if(!recordV1(proof,['requestId','method','path','queryHash','bodyHash','grantRef','credentialGeneration','serverNonce'])||!same({method:proof.method,path:proof.path,queryHash:proof.queryHash,bodyHash:proof.bodyHash},target))return reject();
   return await this.store.transaction(cloneV1(scope),async tx=>{
    const parent=(body.claim as any)?.kind==='TURN'?await this.#parent(tx,scope,body.claim,await tx.challenges.clock()):undefined,claim=validateProviderSessionClaim(body.claim,parent).claim;
    if(claim.projectId!==scope.projectId||claim.execution.id!==scope.executionId||claim.execution.generation!==scope.executionGeneration)return reject();
    const challenges=new SyntheticExecutionChallenges({transport:'SYNTHETIC_ONLY',transaction:async(s,fn)=>{
     if(!same(s,scope))return reject();return fn({...tx.challenges,recordResult:async value=>{
      const before=await this.#basis(tx,scope,claim),existing=await this.#find(tx,scope,claim,before.now);
      const r:ProviderClaimReceipt=existing?.receipt??{claimRef:validateProviderSessionClaim(claim,parent).ref,recordedAt:before.now,state:'PROVIDER_CLAIM_RECORDED',sourceVerification:'PROVIDER_CLAIM_ONLY',nonceConsumed:true,credentialIssued:false,executionAuthorized:false,dispatchPerformed:false,workAccepted:false};
      if(!existing)await tx.claims.append({scope:cloneV1(scope),eventKey:eventKey(claim),claim:cloneV1(claim),receipt:r});
      const resultRef=await tx.challenges.recordResult(value);if(!refV1(resultRef))return reject();
      await tx.results.bind(resultRef,{bodyHash:target.bodyHash,receipt:r});
      if(!existing)await tx.audit.append({kind:'PROVIDER_SESSION_CLAIM_RECORDED',scope:cloneV1(scope),claimRef:cloneV1(r.claimRef),proofResultRef:cloneV1(resultRef),recordedAt:r.recordedAt});
      const after=await this.#basis(tx,scope,claim);if(before.bindingHash!==after.bindingHash||Date.parse(after.now)>=before.deadline)return reject();
      return resultRef;
     }});
    }});
    const before=await challenges.consume(scope,cloneV1(challengeRef),proof,signature),basis=await this.#basis(tx,scope,claim),stored=cloneV1(await tx.results.read(before.resultRef));
    if(!recordV1(stored,['bodyHash','receipt'])||stored.bodyHash!==target.bodyHash)return reject();
    const selected=readProviderClaimReceipt(stored.receipt,claim,basis.now,parent),entry=await this.#find(tx,scope,claim,basis.now);if(!entry||!same(entry.receipt,selected))return reject();
    const final=await challenges.consume(scope,cloneV1(challengeRef),proof,signature),after=await this.#basis(tx,scope,claim);
    if(!same(before,final)||before.nonceConsumed!==true||before.credentialIssued!==false||before.executionAuthorized!==false||before.dispatchPerformed!==false||basis.bindingHash!==after.bindingHash||Date.parse(after.now)>=basis.deadline)return reject();
    return{parentThreadClaim:parent?cloneV1(parent):null,validUntil:new Date(Math.min(basis.deadline,after.deadline)).toISOString(),result:{transport:'SYNTHETIC_ONLY' as const,proofResultRef:cloneV1(before.resultRef),receipt:selected,nonceConsumed:true as const,executionAuthorized:false as const,dispatchPerformed:false as const}};
   });
  }catch(error){if(error instanceof AuthFailure&&error.message==='PROVIDER_SESSION_CLAIM_CONFLICT')throw error;return reject();}
 }
}
