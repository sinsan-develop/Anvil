import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import type {SyntheticChallengeScope} from './execution-challenges.ts';
import {AuthFailure} from '../access/repository.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function fail():never{throw new AuthFailure('SYNTHETIC_CREDENTIAL_RESERVATION_UNAVAILABLE',412);}
/** Existing authenticated grant transaction only. SELECT an existing reservation;
 * never reserve/issue a credential, open a transaction, or create authority. */
export async function readExistingSyntheticCredentialReservation(db:PoolClient,scope:SyntheticChallengeScope,now:string){
 try{
  if(!recordV1(scope,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||scope.mode!=='EXECUTION'||![scope.projectId,scope.executionId,scope.connectorId].every(uuidV1)||!Number.isSafeInteger(scope.executionGeneration)||scope.executionGeneration<1||!refV1(scope.grantRef)||scope.credentialGeneration!==1||!isoV1(now))return fail();
  const rows=(await db.query('SELECT * FROM anvil.execution_credentials WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3 AND credential_generation=1',[scope.projectId,scope.grantRef.id,scope.grantRef.version])).rows;
  if(!Array.isArray(rows)||rows.length!==1)return fail();const row=rows[0],s=row.snapshot_json;
  if(row.project_id!==scope.projectId||row.grant_id!==scope.grantRef.id||Number(row.grant_version)!==scope.grantRef.version||Number(row.credential_generation)!==1||!recordV1(s,['transport','state','grantRef','credentialGeneration','reservedAt','credentialIssued','executionAuthorized','dispatchPerformed'])||s.transport!=='SYNTHETIC_ONLY'||s.state!=='SYNTHETIC_RESERVED_NO_TOKEN'||!same(s.grantRef,scope.grantRef)||s.credentialGeneration!==1||!isoV1(s.reservedAt)||Date.parse(s.reservedAt)>Date.parse(now)||s.credentialIssued!==false||s.executionAuthorized!==false||s.dispatchPerformed!==false||contentHash(canonicalJson(s))!==row.content_hash)return fail();
  // PG row timestamps may be Date objects. Only the validated JSON reservation
  // and its hash are needed; never serialize unrelated driver fields.
  return{content_hash:row.content_hash,snapshot_json:cloneV1(s)};
 }catch{return fail();}
}
