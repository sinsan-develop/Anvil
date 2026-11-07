import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,cloneV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import type {SyntheticChallengeScope as Scope} from './execution-challenges.ts';
import type {SyntheticInstructionPermit as Permit} from './execution-instruction-permits.ts';

const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const reject=():never=>{throw new AuthFailure('INSTRUCTION_PERMIT_JOURNAL_REJECTED',503);};
function scopeOf(v:unknown):Scope{
 if(!recordV1(v,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||v.mode!=='EXECUTION'||![v.projectId,v.connectorId,v.executionId].every(uuidV1)||!refV1(v.grantRef)||![v.executionGeneration,v.credentialGeneration].every(n=>Number.isSafeInteger(n)&&Number(n)>0))return reject();return cloneV1(v) as unknown as Scope;
}
function recordOf(raw:unknown,scope:Scope):Permit{
 if(!recordV1(raw,['ref','snapshot'])||!refV1(raw.ref)||raw.ref.version!==1||raw.ref.contentHash!==hash(raw.snapshot)||!recordV1(raw.snapshot,['scope','commandId','commandRef','request','requestHash','proofRef','authorizationReceiptRef','bindingHash','currentFact','reservationRef','state','issuedAt','expiresAt','commandExpiresAt','grantExpiresAt','proofExpiresAt','executionAuthorized','dispatchPerformed']))return reject();
 const s=raw.snapshot,sc=scopeOf(s.scope),r=s.request;
 if(sc.projectId!==scope.projectId||sc.executionId!==scope.executionId||sc.executionGeneration!==scope.executionGeneration||sc.connectorId!==scope.connectorId||!uuidV1(s.commandId)||![s.commandRef,s.reservationRef,s.proofRef,s.authorizationReceiptRef].every(refV1)||s.commandRef.version!==1||s.reservationRef.version!==1||s.proofRef.version!==1||s.state!=='SYNTHETIC_INSTRUCTION_CONSUMED_NO_AUTHORITY'||s.executionAuthorized!==false||s.dispatchPerformed!==false||![s.issuedAt,s.expiresAt,s.commandExpiresAt,s.grantExpiresAt,s.proofExpiresAt].every(isoV1)||!recordV1(r,['envelopeHash','localAttemptRef','sourceObservationRefs','osOwnershipRef'])||!refV1(r.localAttemptRef)||!refV1(r.osOwnershipRef)||!arrayV1(r.sourceObservationRefs,200)||!r.sourceObservationRefs.length||!r.sourceObservationRefs.every(refV1)||s.requestHash!==hash(r)||Buffer.byteLength(canonicalJson(raw))>2097152)return reject();
 return cloneV1(raw) as unknown as Permit;
}
/** 동일 caller db/실행 잠금 안에서만 사용하는 전용 journal adapter다.
 * 별도 pool/BEGIN/COMMIT·권한/nonce 소비·START표·실제 전달은 만들지 않는다.
 * 현재성/전이·역사 의미는 consumer, 저장 권한/FK/원자성은 전용 SQL guard와 상위 tx가 검사한다. */
export class SyntheticPgInstructionPermitJournal{
 readonly transport='SYNTHETIC_ONLY' as const;
 async read(db:PoolClient,rawScope:Scope){
  try{
   const scope=scopeOf(rawScope),rows=(await db.query('SELECT * FROM anvil.execution_instruction_permits WHERE project_id=$1::uuid AND execution_id=$2::uuid AND generation=$3::bigint ORDER BY id LIMIT 51',[scope.projectId,scope.executionId,scope.executionGeneration])).rows;
   if(rows.length>50)return reject();const permits=rows.map(row=>{
    const record=recordOf({ref:{id:row.id,version:Number(row.version),contentHash:row.content_hash},snapshot:row.snapshot_json},scope),s=record.snapshot;
    if(row.project_id!==scope.projectId||row.execution_id!==scope.executionId||Number(row.generation)!==scope.executionGeneration||row.command_id!==s.commandId||row.command_record_id!==s.commandRef.id||Number(row.command_record_version)!==s.commandRef.version||row.grant_id!==s.scope.grantRef.id||Number(row.grant_version)!==s.scope.grantRef.version||row.reservation_id!==s.reservationRef.id||Number(row.reservation_version)!==s.reservationRef.version||row.proof_result_id!==s.proofRef.id||Number(row.proof_result_version)!==s.proofRef.version||row.envelope_hash!==s.request.envelopeHash)return reject();return record;
   });
   const result={complete:true as const,permits};if(Buffer.byteLength(canonicalJson(result))>2097152)return reject();return result;
  }catch{return reject();}
 }
 async append(db:PoolClient,rawScope:Scope,raw:Permit){
  try{
   const scope=scopeOf(rawScope),record=recordOf(raw,scope),s=record.snapshot;if(!same(s.scope,scope))return reject();
   // canonical wrapper와 배열 구분자 크기를 포함한다. SQL guard도 전체 이력 상한을 별도로 검사한다.
   const rows=(await db.query("SELECT count(*)::int AS count,COALESCE(sum(octet_length(anvil.execution_authority_canonical(jsonb_build_object('ref',jsonb_build_object('id',id,'version',version,'contentHash',content_hash),'snapshot',snapshot_json)))),0)::bigint AS total FROM anvil.execution_instruction_permits WHERE project_id=$1::uuid AND execution_id=$2::uuid AND generation=$3::bigint",[scope.projectId,scope.executionId,scope.executionGeneration])).rows;
   const count=Number(rows[0]?.count),total=Number(rows[0]?.total),bytes=total+Buffer.byteLength(canonicalJson({complete:true,permits:[record]}))+count;
   if(rows.length!==1||!Number.isSafeInteger(count)||count<0||count>=50||!Number.isSafeInteger(total)||total<0||bytes>2097152)return reject();
   const result=await db.query('INSERT INTO anvil.execution_instruction_permits(project_id,execution_id,generation,id,version,command_id,command_record_id,command_record_version,grant_id,grant_version,reservation_id,reservation_version,proof_result_id,proof_result_version,envelope_hash,content_hash,snapshot_json) VALUES($1::uuid,$2::uuid,$3::bigint,$4::uuid,1,$5::uuid,$6::uuid,$7::bigint,$8::uuid,$9::bigint,$10::uuid,$11::bigint,$12::uuid,$13::bigint,$14::text,$15::text,$16::jsonb)',[scope.projectId,scope.executionId,scope.executionGeneration,record.ref.id,s.commandId,s.commandRef.id,s.commandRef.version,s.scope.grantRef.id,s.scope.grantRef.version,s.reservationRef.id,s.reservationRef.version,s.proofRef.id,s.proofRef.version,s.request.envelopeHash,record.ref.contentHash,JSON.stringify(s)]);
   if(result.rowCount!==1)return reject();
  }catch{return reject();}
 }
}
