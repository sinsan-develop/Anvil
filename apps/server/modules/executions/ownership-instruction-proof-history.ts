import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {SyntheticInstructionPermits,type SyntheticInstructionPermit} from './execution-instruction-permits.ts';
import {readConsumedExecutionRequest,type SyntheticChallengeScope} from './execution-challenges.ts';
import {executionTarget} from './execution-proof.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=():never=>{throw new AuthFailure('OWNERSHIP_INSTRUCTION_PROOF_HISTORY_UNAVAILABLE',412);};
/** 상위의 동일 인증 tx가 선택한 원 permit에 대한 저수준 이력 reader.
 * 발급/소비·현재 권한을 판정하지 않으며 서명 원문이 없어 서명검증이라고 부르지 않는다. */
export async function readOwnershipInstructionProofHistory(db:PoolClient,rawPermit:unknown,rawScope:SyntheticChallengeScope,now:string){
 try{
  const scope=cloneV1(rawScope);if(scope.mode!=='EXECUTION')return fail();
  const permit=SyntheticInstructionPermits.readStoredLedger({complete:true,permits:[cloneV1(rawPermit)]},scope as SyntheticChallengeScope&{mode:'EXECUTION'},now)[0] as SyntheticInstructionPermit;
  const p=permit.snapshot,ref=p.proofRef;if(!same(p.scope,scope))return fail();
  const rows=(await db.query('SELECT project_id,id,version,grant_id,grant_version,challenge_id,challenge_version,content_hash,snapshot_json FROM anvil.execution_receipts WHERE project_id=$1 AND id=$2 AND version=$3 LIMIT 2',[scope.projectId,ref.id,1])).rows;
  if(rows.length!==1)return fail();const row=rows[0],s=cloneV1(row.snapshot_json);
  if(row.project_id!==scope.projectId||row.id!==ref.id||Number(row.version)!==1||row.grant_id!==scope.grantRef.id||Number(row.grant_version)!==scope.grantRef.version||Number(row.challenge_version)!==1||row.content_hash!==ref.contentHash||ref.contentHash!==hash(s)||!recordV1(s,['kind','challengeRef','requestId','proofHash','recordedAt','credentialIssued','executionAuthorized','dispatchPerformed'])||s.kind!=='SYNTHETIC_PROOF_RESULT'||!refV1(s.challengeRef)||s.challengeRef.version!==1||row.challenge_id!==s.challengeRef.id||!isoV1(s.recordedAt)||s.credentialIssued!==false||s.executionAuthorized!==false||s.dispatchPerformed!==false)return fail();
  const challengeRows=(await db.query('SELECT project_id,id,version,grant_id,grant_version,server_sequence,content_hash,snapshot_json FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3 ORDER BY server_sequence LIMIT 20001',[scope.projectId,scope.grantRef.id,scope.grantRef.version])).rows;
  if(challengeRows.length>20000)return fail();const events=challengeRows.map(r=>{if(r.project_id!==scope.projectId||r.grant_id!==scope.grantRef.id||Number(r.grant_version)!==scope.grantRef.version||Number(r.server_sequence)!==r.snapshot_json?.sequence)return fail();return{ref:{id:r.id,version:Number(r.version),contentHash:r.content_hash},snapshot:r.snapshot_json};});
  const target=executionTarget('POST','/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/commands/'+p.commandId+'/permit',[],canonicalJson(p.request));
  const consumed=readConsumedExecutionRequest({complete:true,events},scope,ref,target,now,p.issuedAt,p.currentFact.registration.hostPublicKeyFingerprint);
  const original=events.find(e=>same(e.ref,s.challengeRef)),head=events.find(e=>e.ref.id===s.challengeRef.id&&e.ref.version===2);
  if(!original||!head||original.snapshot.request.requestId!==s.requestId||!same(head.snapshot.previousRef,s.challengeRef)||consumed.proofHash!==s.proofHash||consumed.expiresAt!==p.proofExpiresAt||Date.parse(s.recordedAt)<Date.parse(original.snapshot.publicChallenge.issuedAt)||Date.parse(s.recordedAt)>Date.parse(consumed.consumedAt))return fail();
  return{purpose:'OWNERSHIP_INSTRUCTION_PROOF_HISTORY_ONLY' as const,proofRef:cloneV1(ref),challengeRef:cloneV1(s.challengeRef),consumedChallengeRef:cloneV1(head.ref),proofHash:consumed.proofHash,consumedAt:consumed.consumedAt,expiresAt:consumed.expiresAt,signatureVerified:false as const,currentAuthorityVerified:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
 }catch{return fail();}
}
