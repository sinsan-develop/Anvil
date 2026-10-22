import type {Pool,PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,recordV1,refV1,uuidV1,isoV1,hashV1} from '../../../../contracts/runtime/validation-v1.ts';
import {validateProviderSessionClaim,type ProviderRef} from '../../../../contracts/runtime/provider-session-claim-v1.ts';
import {readServerExecutionFactV1} from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {SyntheticPgPermitStore,type SyntheticPermitFacts} from './execution-permit-store.ts';
import {SyntheticPgInstructionPermitJournal} from './execution-instruction-permit-journal.ts';
import type {SyntheticHostKeys} from './execution-challenge-store.ts';
import type {SyntheticAuthenticatedPermitStore} from './execution-authenticated-permits.ts';
import type {SyntheticChallengeScope as Scope} from './execution-challenges.ts';
import {readProviderClaimReceipt,type ProviderClaimReceipt,type SyntheticProviderClaimEntry as Entry,type SyntheticProviderClaimStore,type SyntheticProviderClaimTransaction as Tx} from './provider-session-claims.ts';
type Joint=Parameters<Parameters<SyntheticAuthenticatedPermitStore['transaction']>[1]>[0];
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function reject():never{throw new AuthFailure('PROVIDER_CLAIM_STORE_UNAVAILABLE',503);}
function scopeOf(v:unknown):Scope{
 if(!recordV1(v,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||v.mode!=='EXECUTION'||![v.projectId,v.connectorId,v.executionId].every(uuidV1)||!refV1(v.grantRef)||v.grantRef.version!==1||![v.executionGeneration,v.credentialGeneration].every(n=>Number.isSafeInteger(n)&&n>0))return reject();return cloneV1(v) as unknown as Scope;
}
/** Pending 0037 source adapter. The existing grant/permit store owns the only connection and transaction.
 * Claim/mapping/audit are staged until the signed nonce has been consumed, then passed to one protected DB function.
 * Table DML/migrator fallback, role creation, manifest registration, real credentials and HTTP activation are absent. */
export class SyntheticPgProviderClaimStore implements SyntheticProviderClaimStore {
 readonly transport='SYNTHETIC_ONLY' as const;readonly pool:Pick<Pool,'connect'>;readonly keys:SyntheticHostKeys;readonly facts:SyntheticPermitFacts;
 constructor(pool:Pick<Pool,'connect'>,keys:SyntheticHostKeys,facts:SyntheticPermitFacts){new SyntheticPgPermitStore(pool,keys,facts);this.pool=pool;this.keys=keys;this.facts=facts;}
 async transaction<T>(raw:Scope,body:(tx:Tx)=>Promise<T>):Promise<T>{
  const scope=scopeOf(raw);let db:PoolClient|undefined;
  const pool={connect:async()=>{db=await this.pool.connect();return db;}};
  return new SyntheticPgPermitStore(pool,this.keys,this.facts).transaction(scope,async joint=>{
   if(!db)return reject();const bound=this.bind(db,scope,joint),result=await body(bound.tx);await bound.flush();return result;
  });
 }
 /** Caller must already hold the existing authenticated execution transaction/locks. No nested transaction here. */
 bind(db:PoolClient,raw:Scope,joint:Joint){
  const scope=scopeOf(raw);if(typeof db?.query!=='function'||typeof joint?.challenges?.clock!=='function'||typeof joint.permits?.current!=='function'||typeof joint.permits?.read!=='function')return reject();
  let staged:Entry|null=null,audit:Parameters<Tx['audit']['append']>[0]|null=null,finished=false,lastBasis:{hash:string;deadline:number}|null=null;
  const maps=new Map<string,{ref:ProviderRef;bodyHash:string;receipt:ProviderClaimReceipt}>();
  const open=()=>{if(finished)return reject();};
  const entry=async(raw:unknown,now:string):Promise<Entry>=>{
   if(!recordV1(raw,['scope','eventKey','claim','receipt'])||!same(raw.scope,scope))return reject();
   let parent:Entry|null=null;if((raw.claim as any)?.kind==='TURN'){if(!refV1((raw.claim as any).parentThreadClaimRef))return reject();parent=await find('claim_id',(raw.claim as any).parentThreadClaimRef.id,true);if(!parent||parent.claim.kind!=='THREAD')return reject();}
   const c=validateProviderSessionClaim(raw.claim,parent?.claim).claim;
   if(c.projectId!==scope.projectId||c.execution.id!==scope.executionId||c.execution.generation!==scope.executionGeneration||raw.eventKey!==hash([c.projectId,c.execution.id,c.execution.generation,c.commandId,c.kind,c.source.requestIdDigest]))return reject();
   return{scope:cloneV1(scope),eventKey:raw.eventKey,claim:c,receipt:readProviderClaimReceipt(raw.receipt,c,now,parent?.claim)};
  };
  const current=async(commandId:string)=>{
   if(!uuidV1(commandId))return reject();const value=cloneV1(await joint.permits.current(commandId));
   if(!recordV1(value,['fact','grantRef','grantExpiresAt','commandRef','commandSnapshot','authorizationReceiptRef']))return reject();
   const send=value.commandSnapshot?.state==='SYNTHETIC_INSTRUCTION_QUEUED',ledger=send?await new SyntheticPgInstructionPermitJournal().read(db,scope):await joint.permits.read();
   const selected=ledger.permits.filter(p=>p.snapshot.commandId===commandId);if(!ledger.complete||selected.length!==1||!send&&ledger.permits.length!==1)return reject();
   const permit=cloneV1(selected[0]);if(!permit||!same(permit.snapshot.scope,scope)||!same(permit.snapshot.commandRef,value.commandRef))return reject();
   let instructionReservation:unknown;
   if(send){const r=value.commandSnapshot.reservationRef;if(!refV1(r))return reject();const rows=(await db.query('SELECT reservation_id,version,content_hash,snapshot_json FROM anvil.usage_reservations WHERE project_id=$1::uuid AND reservation_id=$2::uuid AND version=$3::bigint AND content_hash=$4::text LIMIT 2',[scope.projectId,r.id,r.version,r.contentHash])).rows;if(rows.length!==1||rows[0].reservation_id!==r.id||Number(rows[0].version)!==r.version||rows[0].content_hash!==r.contentHash)return reject();instructionReservation={ref:cloneV1(r),snapshot:cloneV1(rows[0].snapshot_json)};}
   const result={...value,permit,localAttemptRef:cloneV1(permit.snapshot.request.localAttemptRef),...(send?{instructionReservation}:{})},fact=readServerExecutionFactV1(value.fact),{checkedAt:_,...factBinding}=fact,now=await joint.challenges.clock();
   if(!isoV1(now)||!isoV1(value.grantExpiresAt)||!isoV1(permit.snapshot.expiresAt)||!isoV1(value.commandSnapshot.envelope?.expiresAt))return reject();
   const deadline=Math.min(Date.parse(value.grantExpiresAt),Date.parse(permit.snapshot.expiresAt),Date.parse(value.commandSnapshot.envelope.expiresAt),Date.parse(fact.checkedAt)+30000,...Object.values(fact.expires).map(Date.parse));
   if(deadline<=Date.parse(now))return reject();lastBasis={hash:hash({...result,fact:factBinding}),deadline};return result;
  };
  const find=async(kind:'event_key'|'claim_id',value:string,threadOnly=false):Promise<Entry|null>=>{
   open();if(kind==='event_key'?!hashV1(value):!uuidV1(value))return reject();
   if(staged&&(kind==='event_key'?staged.eventKey===value:staged.claim.claimId===value)){if(threadOnly&&staged.claim.kind!=='THREAD')return reject();return cloneV1(staged);}
   const sql=kind==='event_key'?'SELECT snapshot_json,content_hash,claim_id,project_id,execution_id,generation FROM anvil.provider_session_claims WHERE project_id=$1::uuid AND execution_id=$2::uuid AND generation=$3::bigint AND event_key=$4::text LIMIT 2':'SELECT snapshot_json,content_hash,claim_id,project_id,execution_id,generation FROM anvil.provider_session_claims WHERE project_id=$1::uuid AND execution_id=$2::uuid AND generation=$3::bigint AND claim_id=$4::uuid LIMIT 2';
   const rows=(await db.query(sql,[scope.projectId,scope.executionId,scope.executionGeneration,value])).rows;if(rows.length>1)return reject();if(!rows.length)return null;
   const row=rows[0];if(threadOnly&&row.snapshot_json?.claim?.kind!=='THREAD')return reject();const e=await entry(cloneV1(row.snapshot_json),await joint.challenges.clock());
   if(row.project_id!==scope.projectId||row.execution_id!==scope.executionId||Number(row.generation)!==scope.executionGeneration||row.claim_id!==e.claim.claimId||row.content_hash!==hash(e.claim)||(kind==='event_key'?e.eventKey!==value:e.claim.claimId!==value))return reject();return e;
  };
  const tx:Tx={challenges:joint.challenges,current:async id=>{open();return current(id);},claims:{findEvent:key=>find('event_key',key),findId:id=>find('claim_id',id),append:async raw=>{
   open();if(staged)return reject();staged=await entry(cloneV1(raw),await joint.challenges.clock());
  }},results:{bind:async(ref,value)=>{
   open();if(!refV1(ref)||ref.version!==1||!recordV1(value,['bodyHash','receipt'])||!hashV1(value.bodyHash))return reject();
   const e=await find('claim_id',value.receipt?.claimRef?.id);if(!e||!same(e.receipt,value.receipt))return reject();
   const key=canonicalJson(ref),m={ref:cloneV1(ref),bodyHash:value.bodyHash,receipt:cloneV1(value.receipt)},previous=maps.get(key);if(previous&&!same(previous,m))return reject();maps.set(key,m);if(maps.size>1)return reject();
  },read:async ref=>{
   open();if(!refV1(ref)||ref.version!==1)return reject();const stagedMap=maps.get(canonicalJson(ref));if(stagedMap)return{bodyHash:stagedMap.bodyHash,receipt:cloneV1(stagedMap.receipt)};
   const rows=(await db.query('SELECT m.*,c.snapshot_json AS entry_snapshot,p.content_hash AS proof_content_hash,p.snapshot_json AS proof_snapshot FROM anvil.provider_session_claim_proof_results m JOIN anvil.provider_session_claims c ON c.project_id=m.project_id AND c.claim_id=m.claim_id AND c.version=m.claim_version JOIN anvil.execution_receipts p ON p.project_id=m.project_id AND p.id=m.proof_result_id AND p.version=m.proof_result_version WHERE m.project_id=$1::uuid AND m.execution_id=$2::uuid AND m.generation=$3::bigint AND m.proof_result_id=$4::uuid AND m.proof_result_version=$5::bigint LIMIT 2',[scope.projectId,scope.executionId,scope.executionGeneration,ref.id,ref.version])).rows;
   if(rows.length>1)return reject();if(!rows.length)return null;const row=rows[0],e=await entry(row.entry_snapshot,await joint.challenges.clock()),p=row.proof_snapshot;
   if(row.project_id!==scope.projectId||row.execution_id!==scope.executionId||Number(row.generation)!==scope.executionGeneration||row.proof_result_id!==ref.id||Number(row.proof_result_version)!==ref.version||row.proof_content_hash!==ref.contentHash||hash(p)!==ref.contentHash||!hashV1(row.body_hash)||!same(row.receipt_json,e.receipt)
    ||!recordV1(p,['kind','challengeRef','requestId','proofHash','recordedAt','credentialIssued','executionAuthorized','dispatchPerformed'])||p.kind!=='SYNTHETIC_PROOF_RESULT'||!refV1(p.challengeRef)||!uuidV1(p.requestId)||!hashV1(p.proofHash)||!isoV1(p.recordedAt)||p.credentialIssued!==false||p.executionAuthorized!==false||p.dispatchPerformed!==false)return reject();
   return{bodyHash:row.body_hash,receipt:cloneV1(e.receipt)};
  }},audit:{append:async raw=>{
   open();if(audit||!recordV1(raw,['kind','scope','claimRef','proofResultRef','recordedAt'])||raw.kind!=='PROVIDER_SESSION_CLAIM_RECORDED'||!same(raw.scope,scope)||!staged||!same(raw.claimRef,staged.receipt.claimRef)||raw.recordedAt!==staged.receipt.recordedAt||!maps.has(canonicalJson(raw.proofResultRef)))return reject();audit=cloneV1(raw);
  }}};
  return{tx,flush:async()=>{
   open();const stagedEntry=staged as Entry|null,savedAudit=audit as Parameters<Tx['audit']['append']>[0]|null,expected=lastBasis as {hash:string;deadline:number}|null;
   if(!maps.size){finished=true;if(stagedEntry||savedAudit)return reject();return;}
   const mapping=[...maps.values()][0]!,selected=await find('claim_id',mapping.receipt.claimRef.id);finished=true;
   if(!selected||!expected||stagedEntry&&!savedAudit||!stagedEntry&&savedAudit||savedAudit&&!same(savedAudit.proofResultRef,mapping.ref))return reject();
   await current(selected.claim.commandId);if(!lastBasis||lastBasis.hash!==expected.hash)return reject();
   const rows=(await db.query('SELECT anvil.record_provider_session_claim($1::jsonb,$2::jsonb,$3::jsonb,$4::text,$5::jsonb) AS result',[canonicalJson(scope),canonicalJson(selected),canonicalJson(mapping.ref),mapping.bodyHash,canonicalJson(savedAudit)])).rows;
   const r=rows[0]?.result;if(rows.length!==1||!recordV1(r,['claimRef','proofResultRef','recorded','executionAuthorized','dispatchPerformed'])||!same(r.claimRef,selected.receipt.claimRef)||!same(r.proofResultRef,mapping.ref)||r.recorded!==true||r.executionAuthorized!==false||r.dispatchPerformed!==false)return reject();
   await current(selected.claim.commandId);const ended=await joint.challenges.clock();if(!lastBasis||lastBasis.hash!==expected.hash||!isoV1(ended)||Date.parse(ended)>=Math.min(expected.deadline,lastBasis.deadline,Date.parse(selected.claim.usableBefore)))return reject();
  }};
 }
}
