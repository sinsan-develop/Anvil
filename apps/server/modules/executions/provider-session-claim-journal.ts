import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {validateProviderSessionClaim,type ProviderSessionClaim} from '../../../../contracts/runtime/provider-session-claim-v1.ts';
import {cloneV1,recordV1,uuidV1,refV1,hashV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {readProviderClaimReceipt} from './provider-session-claims.ts';
import type {ProviderClaimReceiptQuery,ProviderClaimHistoryEntry} from './provider-session-claim-history.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const reject=():never=>{throw new AuthFailure('PROVIDER_CLAIM_JOURNAL_UNAVAILABLE',503);};
/** Read primitive for the caller's locked, authenticated HUMAN history transaction.
 * No pool/BEGIN/COMMIT, authorization resolver, DML or actual activation here.
 * Missing rows and hash conflicts are not safety/currentness decisions; the history service checks current access before returning them. */
export class SyntheticPgProviderClaimJournal {
 readonly transport='SYNTHETIC_ONLY' as const;
 async read(db:Pick<PoolClient,'query'>,raw:ProviderClaimReceiptQuery):Promise<ProviderClaimHistoryEntry|null>{
  try{
   if(!recordV1(raw,['projectId','agentSessionId','executionId','generation','commandId','kind','requestIdDigest','claimHash'])||![raw.projectId,raw.agentSessionId,raw.executionId,raw.commandId].every(uuidV1)
    ||!Number.isSafeInteger(raw.generation)||raw.generation<1||!['THREAD','TURN'].includes(raw.kind)||!hashV1(raw.requestIdDigest)||!hashV1(raw.claimHash))return reject();
   const q=cloneV1(raw),key=hash([q.projectId,q.executionId,q.generation,q.commandId,q.kind,q.requestIdDigest]);
   // Do not filter by the caller's claimHash: preserve the original row so the authorized history service can report an exact conflict.
   const rows=(await db.query('SELECT project_id,claim_id,version,execution_id,generation,command_id,agent_session_id,agent_session_version,grant_id,grant_version,permit_id,permit_version,kind,request_id_digest,event_key,content_hash,snapshot_json,recorded_at FROM anvil.provider_session_claims WHERE project_id=$1::uuid AND agent_session_id=$2::uuid AND event_key=$3::text LIMIT 2',[q.projectId,q.agentSessionId,key])).rows;
   if(!Array.isArray(rows)||rows.length>1)return reject();if(!rows.length)return null;
   const row=rows[0],v=cloneV1(row.snapshot_json);if(!recordV1(v,['scope','eventKey','claim','receipt'])||Buffer.byteLength(canonicalJson(v))>32768)return reject();
   let parent:ProviderSessionClaim|undefined;
   if(q.kind==='TURN'){
    if(v.claim?.kind!=='TURN'||!refV1(v.claim.parentThreadClaimRef))return reject();const r=v.claim.parentThreadClaimRef;
    const parents=(await db.query('SELECT project_id,claim_id,version,execution_id,generation,command_id,agent_session_id,agent_session_version,grant_id,grant_version,permit_id,permit_version,kind,request_id_digest,event_key,content_hash,snapshot_json,recorded_at FROM anvil.provider_session_claims WHERE project_id=$1::uuid AND agent_session_id=$2::uuid AND claim_id=$3::uuid LIMIT 2',[q.projectId,q.agentSessionId,r.id])).rows;
    if(!Array.isArray(parents)||parents.length!==1||parents[0].kind!=='THREAD'||parents[0].snapshot_json?.claim?.kind!=='THREAD')return reject();
    const p=parents[0],pc=p.snapshot_json.claim;
    // Reuse the full THREAD row/receipt checks without accepting a recursive TURN parent.
    const entry=this.#row(p,{...q,executionId:pc.execution.id,generation:pc.execution.generation,commandId:pc.commandId,kind:'THREAD',requestIdDigest:pc.source.requestIdDigest,claimHash:r.contentHash});
    if(!same(entry.scope,v.scope)||!same(entry.receipt.claimRef,r))return reject();parent=entry.claim;
   }
   return this.#row(row,q,parent);
  }catch{return reject();}
 }
 #row(row:any,q:ProviderClaimReceiptQuery,parent?:ProviderSessionClaim):ProviderClaimHistoryEntry{
   const v=cloneV1(row.snapshot_json);if(!recordV1(v,['scope','eventKey','claim','receipt'])||Buffer.byteLength(canonicalJson(v))>32768)return reject();
   const c=validateProviderSessionClaim(v.claim,parent).claim,s=v.scope,key=hash([q.projectId,q.executionId,q.generation,q.commandId,q.kind,q.requestIdDigest]);
   if(c.kind!==q.kind||!recordV1(s,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||s.mode!=='EXECUTION'||!uuidV1(s.connectorId)||!refV1(s.grantRef)||!Number.isSafeInteger(s.credentialGeneration)||s.credentialGeneration<1
    ||s.projectId!==q.projectId||s.executionId!==q.executionId||s.executionGeneration!==q.generation||c.projectId!==q.projectId||c.agentSessionRef.id!==q.agentSessionId||!same(c.execution,{id:q.executionId,generation:q.generation})||c.commandId!==q.commandId||c.source.requestIdDigest!==q.requestIdDigest||v.eventKey!==key
    ||row.project_id!==q.projectId||row.claim_id!==c.claimId||Number(row.version)!==1||row.execution_id!==q.executionId||Number(row.generation)!==q.generation||row.command_id!==q.commandId||row.agent_session_id!==q.agentSessionId||Number(row.agent_session_version)!==c.agentSessionRef.version
    ||row.grant_id!==s.grantRef.id||Number(row.grant_version)!==s.grantRef.version||row.permit_id!==c.permitRef.id||Number(row.permit_version)!==c.permitRef.version||row.kind!==c.kind||row.request_id_digest!==q.requestIdDigest||row.event_key!==key||row.content_hash!==hash(c)
    ||!(row.recorded_at instanceof Date)||!Number.isFinite(row.recorded_at.getTime()))return reject();
   const receipt=readProviderClaimReceipt(v.receipt,c,row.recorded_at.toISOString(),parent);if(receipt.recordedAt!==row.recorded_at.toISOString())return reject();
   return{scope:cloneV1(s),eventKey:key,claim:c,receipt,...(parent?{parentThreadClaim:cloneV1(parent)}:{})} as ProviderClaimHistoryEntry;
 }
}
