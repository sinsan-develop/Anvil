import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {validateProviderSessionClaim,type ProviderSessionClaim} from '../../../../contracts/runtime/provider-session-claim-v1.ts';
import {cloneV1,recordV1,uuidV1,hashV1,refV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {readProviderClaimReceipt,type SyntheticProviderClaimEntry} from './provider-session-claims.ts';

export interface ProviderClaimReceiptQuery {projectId:string;agentSessionId:string;executionId:string;generation:number;commandId:string;kind:'THREAD'|'TURN';requestIdDigest:string;claimHash:string}
export type ProviderClaimHistoryEntry=SyntheticProviderClaimEntry&{parentThreadClaim?:ProviderSessionClaim};
export interface SyntheticProviderClaimHistoryStore {
 transport:'SYNTHETIC_ONLY';
 /** Lock current authenticated HUMAN/session and project read permission. Never use an old execution credential or caller actor. */
 transaction<T>(scope:{projectId:string;agentSessionId:string},body:(tx:{clock():Promise<string>;current():Promise<unknown>;read(query:ProviderClaimReceiptQuery):Promise<ProviderClaimHistoryEntry|null>})=>Promise<T>):Promise<T>;
}
type Tx=Parameters<Parameters<SyntheticProviderClaimHistoryStore['transaction']>[1]>[0];
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0,same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const reject=():never=>{throw new AuthFailure('PROVIDER_SESSION_HISTORY_REJECTED',403);};
/** Read-only synthetic source service. Historical receipt does not restore credentials, current dispatch or work acceptance. */
export class SyntheticProviderClaimHistory {
 readonly store:SyntheticProviderClaimHistoryStore;
 constructor(store:SyntheticProviderClaimHistoryStore){this.store=store;this.#port();}
 #port(){if(this.store?.transport!=='SYNTHETIC_ONLY'||typeof this.store.transaction!=='function')return reject();}
 async #current(tx:Tx,q:ProviderClaimReceiptQuery){
  this.#port();const a=cloneV1(await tx.current()),now=await tx.clock();this.#port();
  if(!isoV1(now)||!recordV1(a,['transport','subject','projectId','agentSessionRef','participation','readPermission','responsibleBindingRef','checkedAt','expiresAt'])||a.transport!=='SYNTHETIC_ONLY'
   ||!recordV1(a.subject,['kind','userId','clientId','sessionId','credentialGeneration'])||a.subject.kind!=='HUMAN'||![a.subject.userId,a.subject.clientId,a.subject.sessionId].every(uuidV1)||!positive(a.subject.credentialGeneration)
   ||a.projectId!==q.projectId||!refV1(a.agentSessionRef)||a.agentSessionRef.id!==q.agentSessionId||!['OWNER','RESPONSIBLE'].includes(a.participation)||a.readPermission!=='VERIFIED_CURRENT'
   ||(a.participation==='OWNER'?a.responsibleBindingRef!==null:!refV1(a.responsibleBindingRef))||!isoV1(a.checkedAt)||!isoV1(a.expiresAt)||Date.parse(a.checkedAt)>Date.parse(now)||Date.parse(now)-Date.parse(a.checkedAt)>30000||Date.parse(a.expiresAt)<=Date.parse(now))return reject();
  const {checkedAt:_,...binding}=a;return{access:a,now,bindingHash:contentHash(canonicalJson(binding)),deadline:Math.min(Date.parse(a.expiresAt),Date.parse(a.checkedAt)+30000)};
 }
 async read(rawQuery:unknown){
  try{
   this.#port();if(!recordV1(rawQuery,['projectId','agentSessionId','executionId','generation','commandId','kind','requestIdDigest','claimHash'])
    ||![rawQuery.projectId,rawQuery.agentSessionId,rawQuery.executionId,rawQuery.commandId].every(uuidV1)||!positive(rawQuery.generation)||!['THREAD','TURN'].includes(rawQuery.kind)||!hashV1(rawQuery.requestIdDigest)||!hashV1(rawQuery.claimHash))return reject();
   const q=cloneV1(rawQuery) as unknown as ProviderClaimReceiptQuery;
   return await this.store.transaction({projectId:q.projectId,agentSessionId:q.agentSessionId},async tx=>{
    const before=await this.#current(tx,q),raw=cloneV1(await tx.read(cloneV1(q)));let receipt=null,conflicted=false;
    if(raw!==null){
     if(!recordV1(raw,['scope','eventKey','claim','receipt',...(q.kind==='TURN'?['parentThreadClaim']:[])])||!recordV1(raw.scope,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||raw.scope.mode!=='EXECUTION'
      ||raw.scope.projectId!==q.projectId||raw.scope.executionId!==q.executionId||raw.scope.executionGeneration!==q.generation||!uuidV1(raw.scope.connectorId)||!refV1(raw.scope.grantRef)||!positive(raw.scope.credentialGeneration))return reject();
     const {claim,ref}=validateProviderSessionClaim(raw.claim,raw.parentThreadClaim);
     if(claim.projectId!==q.projectId||!same(claim.agentSessionRef,before.access.agentSessionRef)||claim.execution.id!==q.executionId||claim.execution.generation!==q.generation||claim.commandId!==q.commandId||claim.kind!==q.kind||claim.source.requestIdDigest!==q.requestIdDigest
      ||raw.eventKey!==contentHash(canonicalJson([claim.projectId,claim.execution.id,claim.execution.generation,claim.commandId,claim.kind,claim.source.requestIdDigest]))
      ||before.access.participation==='RESPONSIBLE'&&!same(before.access.responsibleBindingRef,claim.responsibleBindingRef))return reject();
     conflicted=ref.contentHash!==q.claimHash;
     receipt=readProviderClaimReceipt(raw.receipt,claim,before.now,raw.parentThreadClaim);
    }
    const after=await this.#current(tx,q);if(before.bindingHash!==after.bindingHash||Date.parse(after.now)>=before.deadline)return reject();
    if(conflicted)throw new AuthFailure('PROVIDER_SESSION_CLAIM_CONFLICT',409);
    return{transport:'SYNTHETIC_ONLY' as const,result:{found:receipt!==null,receipt,observedAt:after.now,historyOnly:true as const,executionAuthorized:false as const,dispatchPerformed:false as const}};
   });
  }catch(error){if(error instanceof AuthFailure&&error.message==='PROVIDER_SESSION_CLAIM_CONFLICT')throw error;return reject();}
 }
}
