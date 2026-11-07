import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,recordV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceScopesV1} from '../../../../contracts/runtime/source-scope-v1.ts';
import {AccessRepository,AuthFailure} from '../access/repository.ts';
import {readOwnershipPreparationIntentBasis} from './ownership-human-basis.ts';

const fail=():never=>{throw new AuthFailure('OWNERSHIP_WRITER_HISTORY_UNAVAILABLE',412);};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const date=(v:unknown):v is Date=>v instanceof Date&&Number.isFinite(v.getTime());
const positive=(v:unknown)=>Number.isSafeInteger(Number(v))&&Number(v)>0;
/** 기존0017의 SYNTHETIC_CLAIM 원기록만 읽는다. 빈 결과/만료/reclaimed_at은
 * 실제 NONE·OS/WRITE 회수 증거가 아니다. caller 소유 transaction이며 DML/연결 종료0. */
export async function readOwnershipWriterClaimHistory(db:PoolClient,access:AccessRepository,token:string,csrf:string,intentValue:unknown){
 try{
  const intent=cloneV1(intentValue),first=await readOwnershipPreparationIntentBasis(db,access,token,csrf,intent);
  const rows=(await db.query('SELECT project_id,id,execution_id,generation,grant_id,grant_version,scope_json,expires_at,ownership_state,created_command_id,issued_at,reclaimed_at FROM anvil.writer_claims WHERE project_id=$1 ORDER BY issued_at,id LIMIT 201',[first.scope.projectId])).rows;
  if(rows.length>200)return fail();const seen=new Set<string>();
  const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;
  if(!date(at)||at.getTime()<Date.parse(first.checkedAt))return fail();
  const claims=rows.map(r=>{
   if(!recordV1(r,['project_id','id','execution_id','generation','grant_id','grant_version','scope_json','expires_at','ownership_state','created_command_id','issued_at','reclaimed_at'])||r.project_id!==first.scope.projectId||!['id','execution_id','grant_id','created_command_id'].every(k=>uuidV1(r[k]))||seen.has(r.id)||!positive(r.generation)||!positive(r.grant_version)||r.ownership_state!=='SYNTHETIC_CLAIM'||!date(r.issued_at)||!date(r.expires_at)||r.issued_at.getTime()>at.getTime()||r.expires_at.getTime()<=r.issued_at.getTime()||r.reclaimed_at!==null&&(!date(r.reclaimed_at)||r.reclaimed_at.getTime()<r.issued_at.getTime()||r.reclaimed_at.getTime()>at.getTime()))return fail();seen.add(r.id);
   return{claimId:r.id,projectId:r.project_id,executionId:r.execution_id,executionGeneration:Number(r.generation),grantId:r.grant_id,grantVersion:Number(r.grant_version),sourceScopes:readSourceScopesV1(r.scope_json),recordedOwnershipState:'SYNTHETIC_CLAIM' as const,createdCommandId:r.created_command_id,issuedAt:r.issued_at.toISOString(),expiresAt:r.expires_at.toISOString(),recordedReclaimedAt:r.reclaimed_at?.toISOString()??null,recordedExpired:r.expires_at.getTime()<=at.getTime()};
  });
  if(Buffer.byteLength(canonicalJson(claims))>2*1024*1024)return fail();
  const last=await readOwnershipPreparationIntentBasis(db,access,token,csrf,intent);
  for(const k of ['scope','subject','policyRef','registrationRef','publicKeySpki','approvalRequired','intentHash'] as const)if(!same(first[k],last[k]))return fail();
  const expiresAt=new Date(Math.min(Date.parse(first.expiresAt),Date.parse(last.expiresAt))).toISOString();
  if(Date.parse(last.checkedAt)<at.getTime()||Date.parse(last.checkedAt)>=Date.parse(expiresAt))return fail();
  return{purpose:'OWNERSHIP_WRITER_CLAIM_HISTORY_ONLY' as const,scope:cloneV1(first.scope),claims:cloneV1(claims),historyHash:hash(claims.map(({recordedExpired:_,...stored})=>stored)),hasUnreclaimedClaim:claims.some(r=>r.recordedReclaimedAt===null),writerState:'UNKNOWN' as const,checkedAt:last.checkedAt,expiresAt,missingEvidence:['ACTUAL_EXCLUSIVE_WRITER_AUTHORITY','OS_AND_SOURCE_WRITE_RECLAIM','CANDIDATE_PROVENANCE'] as const,writerReleaseVerified:false as const,preparationAuthorized:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
 }catch{return fail();}
}
