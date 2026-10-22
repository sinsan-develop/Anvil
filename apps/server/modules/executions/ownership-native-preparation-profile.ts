import type {PoolClient} from 'pg';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readOwnershipEventV1} from '../../../../contracts/runtime/ownership-ledger-v1.ts';
import {AccessRepository,AuthFailure} from '../access/repository.ts';
import {readOwnershipPreparationReceiptBasis} from './ownership-preparation-receipt.ts';

const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=():never=>{throw new AuthFailure('OWNERSHIP_NATIVE_PREPARATION_PROFILE_UNAVAILABLE',412);};
/** 같은 caller 인증 transaction의 원 준비 입력 투영. 실제 native 인증 채널이 아니다.
 * scalar metadata는 caller가 아니라 검증한 원기록에서 얻고, 실제 키/OS/권한은 제공하지 않는다. */
export async function readOwnershipNativePreparationProfile(db:PoolClient,access:AccessRepository,token:string,csrf:string,scopeValue:unknown,preparationRefValue:unknown){
 try{
  const scope=cloneV1(scopeValue),ref=cloneV1(preparationRefValue);
  const first=await readOwnershipPreparationReceiptBasis(db,access,token,csrf,scope,ref);
  const rows=(await db.query('SELECT project_id,execution_id,execution_generation,event_id,version,content_hash,snapshot_json FROM anvil.execution_ownership_events WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 AND event_id=$4 AND version=$5',[first.scope.projectId,first.scope.executionId,first.scope.executionGeneration,first.preparationRef.id,first.preparationRef.version])).rows;
  if(rows.length!==1)return fail();const row=rows[0];
  if(row.project_id!==first.scope.projectId||row.execution_id!==first.scope.executionId||Number(row.execution_generation)!==first.scope.executionGeneration)return fail();
  const prep=readOwnershipEventV1({ref:{id:row.event_id,version:Number(row.version),contentHash:row.content_hash},snapshot:cloneV1(row.snapshot_json)}),p=prep.snapshot,d=p.payload;
  if(p.kind!=='PREPARATION_GRANTED'||!same(prep.ref,first.preparationRef)||!same(p.scope,first.scope)||!same(p.subject,first.subject)||!same(p.registrationRef,first.registrationRef)||!same(d.policyRef,first.policyRef)||!same(p.authorizationReceiptRef,first.authorizationReceiptRef))return fail();
  const selection={
   installationId:p.scope.installationId,projectId:p.scope.projectId,executionId:p.scope.executionId,
   userId:p.subject.userId,clientId:p.subject.clientId,humanSessionId:p.subject.humanSessionId,
   rootId:d.rootId,runId:d.runId,preparationId:prep.ref.id,authorizationReceiptId:p.authorizationReceiptRef.id,
   policyId:d.policyRef.id,registrationId:p.registrationRef.id,observerId:d.observerRef.id,
   executionGeneration:String(p.scope.executionGeneration),controlGeneration:String(p.subject.controlGeneration),credentialGeneration:String(p.subject.credentialGeneration),processGeneration:String(d.processGeneration),
   preparationVersion:String(prep.ref.version),authorizationReceiptVersion:String(p.authorizationReceiptRef.version),policyVersion:String(d.policyRef.version),registrationVersion:String(p.registrationRef.version),observerVersion:String(d.observerRef.version),
   preparationHash:prep.ref.contentHash,authorizationReceiptHash:p.authorizationReceiptRef.contentHash,policyHash:d.policyRef.contentHash,registrationHash:p.registrationRef.contentHash,observerHash:d.observerRef.contentHash,
   publicKeyFingerprint:d.publicKeyFingerprint,hostHash:d.hostHash,workerHash:d.workerHash,issuedAt:p.at,expiresAt:p.expiresAt
  };
  const last=await readOwnershipPreparationReceiptBasis(db,access,token,csrf,scope,ref);
  for(const key of ['scope','subject','preparationRef','intentRef','commandRef','authorizationReceiptRef','auditRef','policyRef','registrationRef','publicKeySpki','approvalRequired','approvalState'] as const)if(!same(first[key],last[key]))return fail();
  const expiresAt=new Date(Math.min(Date.parse(first.expiresAt),Date.parse(last.expiresAt),Date.parse(p.expiresAt))).toISOString();
  if(!isoV1(last.checkedAt)||Date.parse(last.checkedAt)<Date.parse(first.checkedAt)||Date.parse(last.checkedAt)>=Date.parse(expiresAt))return fail();
  return{purpose:'OWNERSHIP_NATIVE_PREPARATION_PROFILE_BASIS_ONLY' as const,selection:cloneV1(selection),policyDisposition:'AUTO' as const,registrationScope:'REGISTRATION_STATUS_ONLY' as const,grants:[] as string[],checkedAt:last.checkedAt,expiresAt,
   processCreationAuthorized:false as const,preparationAuthorized:false as const,executionAuthorized:false as const,dispatchPerformed:false as const,
   missingEvidence:[...last.missingEvidence,'AUTHENTICATED_NATIVE_CHANNEL','RETAINED_PROCESS_JOB_FACTORY','OBSERVATION_SIGNER'] as const};
 }catch{return fail();}
}
