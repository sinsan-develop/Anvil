import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {readServerExecutionFactV1} from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import type {SyntheticChallengeScope as Scope} from './execution-challenges.ts';
import {readExistingSyntheticCredentialReservation} from './execution-credential-reservation-read.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const reject=():never=>{throw new AuthFailure('MATERIAL_CREDENTIAL_BASIS_INVALID',412);};
function scope(raw:unknown):Scope {
 if(!recordV1(raw,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||raw.mode!=='EXECUTION'||![raw.projectId,raw.connectorId,raw.executionId].every(uuidV1)||!refV1(raw.grantRef)||![raw.executionGeneration,raw.credentialGeneration].every(v=>Number.isSafeInteger(v)&&Number(v)>0))return reject();
 return cloneV1(raw) as Scope;
}
/** 원 PoolClient의 같은 grant·기존 E1 예약만 읽는다. H/E scope를 새로 저장하거나 예약을 생산하지 않는다. */
export async function readMaterialCredentialBasis(db:PoolClient,rawScope:Scope,namespace:'EXECUTION'|'MATERIAL'){
 if(namespace!=='EXECUTION'&&namespace!=='MATERIAL')return reject();const selected=scope(rawScope),query=db.query;
 const tx=async()=>{if(db.query!==query)return reject();const r=(await db.query('SELECT txid_current()::text AS transaction_id')).rows;if(db.query!==query||r.length!==1||typeof r[0]?.transaction_id!=='string'||!/^[1-9][0-9]*$/.test(r[0].transaction_id))return reject();return r[0].transaction_id as string;},original=await tx();
 const rows=(await db.query('SELECT * FROM anvil.execution_grants WHERE project_id=$1::uuid AND id=$2::uuid AND version=$3::bigint AND content_hash=$4::text LIMIT 2',[selected.projectId,selected.grantRef.id,selected.grantRef.version,selected.grantRef.contentHash])).rows;
 if(await tx()!==original||rows.length!==1)return reject();const g=rows[0],s=g.snapshot_json;
 if(g.project_id!==selected.projectId||g.id!==selected.grantRef.id||Number(g.version)!==selected.grantRef.version||g.content_hash!==selected.grantRef.contentHash||g.execution_id!==selected.executionId||Number(g.generation)!==selected.executionGeneration||!recordV1(s,['kind','state','transport','binding','allowedOperations','expiresAt','scopeDigest','factHash','plannedAt','executionAuthorized','dispatchPerformed'])||hash(s)!==g.content_hash||s.kind!=='EXECUTION'||s.state!=='SYNTHETIC_PLAN'||s.transport!=='SYNTHETIC_ONLY'||s.executionAuthorized!==false||s.dispatchPerformed!==false||!isoV1(s.expiresAt)||!isoV1(s.plannedAt)||!same(s.allowedOperations,['START_SESSION','SEND_INSTRUCTION','REQUEST_STOP']))return reject();
 const fact=readServerExecutionFactV1(s.binding);
 if(fact.projectId!==selected.projectId||fact.executionId!==selected.executionId||fact.executionGeneration!==selected.executionGeneration||fact.registration.connectorId!==selected.connectorId||s.factHash!==hash(fact)||s.scopeDigest!==hash({binding:fact,allowedOperations:s.allowedOperations,expiresAt:s.expiresAt}))return reject();
 const materialScope:Scope={...cloneV1(selected),credentialGeneration:fact.subject.credentialGeneration},executionScope:Scope={...cloneV1(selected),credentialGeneration:1};
 if(!same(selected,namespace==='EXECUTION'?executionScope:materialScope))return reject();
 const clock=(await db.query('SELECT clock_timestamp() AS at')).rows;if(await tx()!==original||clock.length!==1||!(clock[0]?.at instanceof Date)||!Number.isFinite(clock[0].at.getTime()))return reject();
 const reservation=await readExistingSyntheticCredentialReservation(db,executionScope,clock[0].at.toISOString());if(await tx()!==original)return reject();
 return cloneV1({executionScope,materialScope,fact,reservation});
}
