import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,hashV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AccessRepository,AuthFailure} from '../access/repository.ts';
import {publicKeyFingerprint} from '../connections/registration-proof.ts';
import {readOwnershipPreparationReceiptBasis} from './ownership-preparation-receipt.ts';
import {SyntheticPgInstructionPermitJournal} from './execution-instruction-permit-journal.ts';
import {SyntheticInstructionPermits} from './execution-instruction-permits.ts';
import {readSyntheticInstructionQueueRecord} from './execution-instruction-queue.ts';
import {readOwnershipInstructionProofHistory} from './ownership-instruction-proof-history.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const fail=():never=>{throw new AuthFailure('OWNERSHIP_INSTRUCTION_HISTORY_UNAVAILABLE',412);};

/** 호출자 소유 인증 transaction의 읽기 전용 일부 source다. 원 SEND/permit pair를
 * 대조하지만 proof 서명·원 HUMAN SEND 허가 graph·local attempt/OS의 진위를 증명하지 않는다.
 * stored CURRENT/CONSUMED 표식은 과거 합성 계약일 뿐 실제 binding/SEND 허가가 아니다. */
export async function readOwnershipInstructionHistory(db:PoolClient,access:AccessRepository,token:string,csrf:string,rawScope:unknown,rawPreparationRef:unknown,rawSelection:unknown){
 try{
  // 첫 await 전에 전체 선택값을 고정한다. caller가 행 원문을 대신 전달할 수 없다.
  const scope=cloneV1(rawScope),preparationRef=cloneV1(rawPreparationRef),selection=cloneV1(rawSelection);
  if(!recordV1(scope,['installationId','projectId','executionId','executionGeneration'])||!['installationId','projectId','executionId'].every(k=>uuidV1(scope[k]))||!Number.isSafeInteger(scope.executionGeneration)||scope.executionGeneration<1||!refV1(preparationRef)||!recordV1(selection,['permitScope','permitRef','commandRef','localAttemptRef','osOwnershipRef','envelopeHash'])||!['permitRef','commandRef','localAttemptRef','osOwnershipRef'].every(k=>refV1(selection[k]))||selection.permitRef.version!==1||selection.commandRef.version!==1||!hashV1(selection.envelopeHash))return fail();
  const sc=selection.permitScope;
  if(!recordV1(sc,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||sc.mode!=='EXECUTION'||sc.projectId!==scope.projectId||sc.executionId!==scope.executionId||sc.executionGeneration!==scope.executionGeneration||!uuidV1(sc.connectorId)||!refV1(sc.grantRef)||!Number.isSafeInteger(sc.credentialGeneration)||sc.credentialGeneration<1)return fail();
  const first=await readOwnershipPreparationReceiptBasis(db,access,token,csrf,scope,preparationRef);
  // 실행 credential 세대와 HUMAN 계정 세대는 별도 도메인이다.
  // HUMAN은 아래 subject 전부로, 실행 세대는 저장 permit/proof 범위로 대조한다.
  const permits=SyntheticInstructionPermits.readStoredLedger(await new SyntheticPgInstructionPermitJournal().read(db,sc as any),sc as any,first.checkedAt);
  const permit=permits.find(p=>same(p.ref,selection.permitRef));if(!permit||!same(permit.snapshot.scope,sc))return fail();
  const p=permit.snapshot,f=p.currentFact;
  if(!same(p.commandRef,selection.commandRef)||!same(p.request.localAttemptRef,selection.localAttemptRef)||!same(p.request.osOwnershipRef,selection.osOwnershipRef)||p.request.envelopeHash!==selection.envelopeHash||!same(f.subject,first.subject)||!same(f.registration.ref,first.registrationRef)||f.registration.hostPublicKeyFingerprint!==publicKeyFingerprint(first.publicKeySpki)||!same(f.preparationRef,preparationRef))return fail();
  const rows=(await db.query('SELECT project_id,execution_id,generation,id,version,content_hash,snapshot_json,grant_id,grant_version,envelope_hash,authorization_ref FROM anvil.execution_commands WHERE project_id=$1 AND execution_id=$2 AND generation=$3 AND id=$4 AND version=$5 LIMIT 2',[scope.projectId,scope.executionId,scope.executionGeneration,selection.commandRef.id,1])).rows;
  if(rows.length!==1)return fail();const row=rows[0],record=readSyntheticInstructionQueueRecord({ref:{id:row.id,version:Number(row.version),contentHash:row.content_hash},snapshot:row.snapshot_json},{projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration}),s=record.snapshot,e=s.envelope;
  const{checkedAt:_,...storedFact}=f;
  if(row.project_id!==scope.projectId||row.execution_id!==scope.executionId||Number(row.generation)!==scope.executionGeneration||row.grant_id!==sc.grantRef.id||Number(row.grant_version)!==sc.grantRef.version||row.envelope_hash!==selection.envelopeHash||!same(row.authorization_ref,p.authorizationReceiptRef)||!same(record.ref,p.commandRef)||!same(s.currentBinding.fact,storedFact)||!same(s.currentBinding.grantSubject,first.subject)||!same(s.currentBinding.grantRef,sc.grantRef)||e.commandId!==p.commandId||e.envelopeHash!==selection.envelopeHash||!same(e.context.authorizationReceiptRef,p.authorizationReceiptRef)||!same(s.reservationRef,p.reservationRef)||e.expiresAt!==p.commandExpiresAt||s.currentBinding.grantExpiresAt!==p.grantExpiresAt)return fail();
  const proofHistory=await readOwnershipInstructionProofHistory(db,permit,p.scope,first.checkedAt);
  const last=await readOwnershipPreparationReceiptBasis(db,access,token,csrf,scope,preparationRef);
  for(const key of ['scope','subject','preparationRef','policyRef','registrationRef','publicKeySpki','intentRef','commandRef','authorizationReceiptRef','auditRef'] as const)if(!same(first[key],last[key]))return fail();
  const expiresAt=new Date(Math.min(Date.parse(first.expiresAt),Date.parse(last.expiresAt),Date.parse(p.expiresAt))).toISOString();
  if(Date.parse(last.checkedAt)<Date.parse(first.checkedAt)||Date.parse(last.checkedAt)>=Date.parse(expiresAt))return fail();
  return{purpose:'OWNERSHIP_INSTRUCTION_HISTORY_ONLY' as const,scope:cloneV1(scope),preparationRef,subject:cloneV1(last.subject),registrationRef:cloneV1(last.registrationRef),permitRef:cloneV1(permit.ref),commandRef:cloneV1(record.ref),proofRef:cloneV1(p.proofRef),proofHistory,authorizationReceiptRef:cloneV1(p.authorizationReceiptRef),localAttemptRef:cloneV1(p.request.localAttemptRef),osOwnershipRef:cloneV1(p.request.osOwnershipRef),envelopeHash:e.envelopeHash,pairHash:hash({permit,command:record}),checkedAt:last.checkedAt,expiresAt,storedPermitState:p.state,proofConsumptionVerified:false as const,writerState:'UNKNOWN' as const,missingEvidence:['PROOF_SIGNATURE_VERIFICATION','EXECUTION_CREDENTIAL_CURRENTNESS','ORIGINAL_SEND_AUTHORIZATION_GRAPH','ACTUAL_LOCAL_ATTEMPT_PARENT_OS','VERIFIED_WRITER_NONE_OR_RECLAIM','CANDIDATE_PROVENANCE'] as const,bindingAuthorized:false as const,preparationAuthorized:false as const,observationRequestAuthorized:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
 }catch{return fail();}
}
