import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';

const fail=():never=>{throw Error('OWNERSHIP_PREPARATION_INTENT_INVALID');};
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const hash=(v:unknown)=>contentHash(canonicalJson(v));
/** 비순환 구조 PLAN만 조립한다. ids는 서버 내부에서 확보한 ID이며 신뢰/인증 근거가 아니다.
 * writerState=NONE도 입력 선언일 뿐 실제 writer/회수 증거가 아니다.
 * DB·감사·허가·PREPARATION_GRANTED 생성/저장·준비 실행을 하지 않는다. */
export function planOwnershipPreparationIntent(value:unknown,serverIds:unknown,nowMs:number){
 try{
  const v=cloneV1(value),ids=cloneV1(serverIds);
  if(!Number.isSafeInteger(nowMs)||!recordV1(ids,['intentId','commandId'])||!uuidV1(ids.intentId)||!uuidV1(ids.commandId)||ids.intentId===ids.commandId||!recordV1(v,['schemaVersion','purpose','scope','subject','registrationRef','details','at','expiresAt','executionAuthorized','dispatchPerformed'])||v.schemaVersion!==1||v.purpose!=='OWNERSHIP_PREPARATION_INTENT'||v.executionAuthorized!==false||v.dispatchPerformed!==false)return fail();
  const s=v.scope,u=v.subject,p=v.details;
  if(!recordV1(s,['installationId','projectId','executionId','executionGeneration'])||!['installationId','projectId','executionId'].every(k=>uuidV1(s[k]))||!positive(s.executionGeneration)||!recordV1(u,['userId','clientId','humanSessionId','controlGeneration','credentialGeneration'])||!['userId','clientId','humanSessionId'].every(k=>uuidV1(u[k]))||!positive(u.controlGeneration)||!positive(u.credentialGeneration)||!refV1(v.registrationRef))return fail();
  if(!recordV1(p,['policyRef','observerRef','publicKeyFingerprint','hostHash','workerHash','rootId','runId','processGeneration','actions','writerState'])||!refV1(p.policyRef)||!refV1(p.observerRef)||!['publicKeyFingerprint','hostHash','workerHash'].every(k=>hashV1(p[k]))||!uuidV1(p.rootId)||!uuidV1(p.runId)||!positive(p.processGeneration)||!arrayV1(p.actions,3)||canonicalJson(p.actions)!==canonicalJson(['PREPARE','OBSERVE','CANCEL_PREPARED'])||p.writerState!=='NONE')return fail();
  if(!isoV1(v.at)||!isoV1(v.expiresAt)||Date.parse(v.at)>nowMs||Date.parse(v.expiresAt)<=nowMs||Date.parse(v.expiresAt)-Date.parse(v.at)>120000||Buffer.byteLength(canonicalJson(v))>256*1024)return fail();
  const intentRef={id:ids.intentId,version:1,contentHash:hash(v)};
  const commandSnapshot={schemaVersion:1,projectId:s.projectId,commandId:ids.commandId,clientId:u.clientId,controlGeneration:u.controlGeneration,operation:'prepareOwnershipAnchor',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{intent:cloneV1(v)}};
  return{purpose:'OWNERSHIP_PREPARATION_INTENT_PLAN_ONLY' as const,intent:cloneV1(v),intentRef,commandSnapshot,requestHash:hash(commandSnapshot),missingEvidence:['CURRENT_HUMAN_POLICY_REGISTRATION','ORIGINAL_COMMAND_RECEIPT_AUDIT','VERIFIED_WRITER_NONE_OR_RECLAIM','CANDIDATE_PROVENANCE'] as const,preparationAuthorized:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
 }catch{return fail();}
}
