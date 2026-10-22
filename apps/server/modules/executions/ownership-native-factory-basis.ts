import type {PoolClient} from 'pg';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {cloneV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readOwnershipEventV1} from '../../../../contracts/runtime/ownership-ledger-v1.ts';
import {AccessRepository,AuthFailure} from '../access/repository.ts';
import {readOwnershipNativePreparationProfile} from './ownership-native-preparation-profile.ts';
import {readOwnershipWriterClaimHistory} from './ownership-writer-history.ts';

const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=():never=>{throw new AuthFailure('OWNERSHIP_NATIVE_FACTORY_BASIS_UNAVAILABLE',412);};
/** 같은 caller 인증 transaction의 factory 선행 읽기 SOURCE. 알려진 미회수 claim은
 * 차단하지만 빈/회수 이력은 실제 NONE·OS 회수·process 생성 허가가 아니다. */
export async function readOwnershipNativeFactoryBasis(db:PoolClient,access:AccessRepository,token:string,csrf:string,scopeValue:unknown,preparationRefValue:unknown){
 try{
  const scope=cloneV1(scopeValue),ref=cloneV1(preparationRefValue);
  const first=await readOwnershipNativePreparationProfile(db,access,token,csrf,scope,ref),s=first.selection;
  const rows=(await db.query('SELECT project_id,execution_id,execution_generation,event_id,version,content_hash,snapshot_json FROM anvil.execution_ownership_events WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 AND event_id=$4 AND version=$5',[s.projectId,s.executionId,Number(s.executionGeneration),s.preparationId,Number(s.preparationVersion)])).rows;
  if(rows.length!==1)return fail();const row=rows[0];
  if(row.project_id!==s.projectId||row.execution_id!==s.executionId||String(row.execution_generation)!==s.executionGeneration)return fail();
  const prep=readOwnershipEventV1({ref:{id:row.event_id,version:Number(row.version),contentHash:row.content_hash},snapshot:cloneV1(row.snapshot_json)}),p=prep.snapshot;
  if(p.kind!=='PREPARATION_GRANTED'||!same(prep.ref,ref)||prep.ref.id!==s.preparationId||prep.ref.contentHash!==s.preparationHash||!same(p.scope,scope))return fail();
  const intent={schemaVersion:1,purpose:'OWNERSHIP_PREPARATION_INTENT',scope:cloneV1(p.scope),subject:cloneV1(p.subject),registrationRef:cloneV1(p.registrationRef),details:cloneV1(p.payload),at:p.at,expiresAt:p.expiresAt,executionAuthorized:false,dispatchPerformed:false};
  const before=await readOwnershipWriterClaimHistory(db,access,token,csrf,intent);
  if(before.hasUnreclaimedClaim||Date.parse(before.checkedAt)<Date.parse(first.checkedAt))return fail();
  const last=await readOwnershipNativePreparationProfile(db,access,token,csrf,scope,ref);
  if(!same(first.selection,last.selection)||first.policyDisposition!==last.policyDisposition||first.registrationScope!==last.registrationScope||!same(first.grants,last.grants)||Date.parse(last.checkedAt)<Date.parse(before.checkedAt))return fail();
  const after=await readOwnershipWriterClaimHistory(db,access,token,csrf,intent);
  if(after.hasUnreclaimedClaim||before.historyHash!==after.historyHash||!same(after.scope,scope)||Date.parse(after.checkedAt)<Date.parse(last.checkedAt))return fail();
  const expiresAt=new Date(Math.min(Date.parse(first.expiresAt),Date.parse(before.expiresAt),Date.parse(last.expiresAt),Date.parse(after.expiresAt))).toISOString();
  if(Date.parse(after.checkedAt)>=Date.parse(expiresAt))return fail();
  return{purpose:'OWNERSHIP_NATIVE_FACTORY_BASIS_ONLY' as const,selection:cloneV1(last.selection),writerHistoryHash:after.historyHash,recordedClaimCount:after.claims.length,hasUnreclaimedClaim:false as const,writerState:'UNKNOWN' as const,actualWriterAbsenceVerified:false as const,
   checkedAt:after.checkedAt,expiresAt,factoryReady:false as const,processCreationAuthorized:false as const,preparationAuthorized:false as const,executionAuthorized:false as const,dispatchPerformed:false as const,
   missingEvidence:[...new Set([...last.missingEvidence,...after.missingEvidence,'CURRENT_NATIVE_PREPARATION_AUTHORITY'])]};
 }catch{return fail();}
}
