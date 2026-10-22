import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readOwnershipEventV1} from '../../../../contracts/runtime/ownership-ledger-v1.ts';
import {AccessRepository,AuthFailure} from '../access/repository.ts';
import {currentPolicy,projectMember} from '../access/project-command.ts';
import {publicKeyFingerprint} from '../connections/registration-proof.ts';

const fail=():never=>{throw new AuthFailure('OWNERSHIP_HUMAN_BASIS_UNAVAILABLE',412);};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const date=(v:unknown):v is Date=>v instanceof Date&&Number.isFinite(v.getTime());

/** 호출자가 transaction/timeout/종료를 소유하는 내부 읽기 전용 source.
 * HUMAN/policy/registration의 일부 근거뿐이며 준비 receipt/approval·writer·provenance를 증명하지 않는다.
 * 실제 키/credential 발급·policy 변경·route 등록·OS/Agent 동작은 없다. */
export async function readOwnershipHumanPolicyRegistrationBasis(db:PoolClient,access:AccessRepository,token:string,csrf:string,preparationValue:unknown){
 try{
  const prep=readOwnershipEventV1(preparationValue),p=prep.snapshot;
  if(p.kind!=='PREPARATION_GRANTED'||!(access instanceof AccessRepository)||access.installationId!==p.scope.installationId)return fail();
  const actor=await access.authenticateInTransaction(db,token,csrf);
  if(!actor.authSession||!same({userId:actor.actorId,clientId:actor.clientId,humanSessionId:actor.authSession.id,controlGeneration:p.subject.controlGeneration,credentialGeneration:actor.credentialGeneration},p.subject)||!date(actor.reauthUntil))return fail();
  const member=await projectMember(db,actor,p.scope.projectId,true);
  if(member.archived_at!==null||member.participation!=='OWNER')return fail();
  const control=(await db.query('SELECT actor_id,client_id,generation,revoked_at FROM anvil.project_control WHERE project_id=$1 FOR UPDATE',[p.scope.projectId])).rows[0];
  if(!control||control.revoked_at!==null||control.actor_id!==actor.actorId||control.client_id!==actor.clientId||Number(control.generation)!==p.subject.controlGeneration)return fail();
  const policy=await currentPolicy(db,p.scope.projectId);
  if(!policy||!refV1(policy.ref)||!same(policy.ref,p.payload.policyRef))return fail();
  const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;
  if(!date(at)||Date.parse(p.at)>at.getTime()||Date.parse(p.expiresAt)<=at.getTime())return fail();
  const matched=[];
  for(const rule of policy.rules){
   if(!recordV1(rule,['ruleId','subjectRef','operations','targetScopes','disposition','limitPolicyRef','expiresAt'])||!recordV1(rule.subjectRef,['kind','userId'])||rule.subjectRef.kind!=='HUMAN'||!Array.isArray(rule.operations)||rule.operations.some(op=>typeof op!=='string')||!Array.isArray(rule.targetScopes)||rule.targetScopes.length!==1||!isoV1(rule.expiresAt))return fail();
   const target=rule.targetScopes[0];
   if(rule.subjectRef.userId===actor.actorId&&recordV1(target,['kind','projectId'])&&target.kind==='PROJECT'&&target.projectId===p.scope.projectId&&rule.operations.includes('prepareOwnershipAnchor')&&Date.parse(rule.expiresAt)>at.getTime()){
    if(rule.limitPolicyRef!==null)return fail();matched.push(rule);
   }
  }
  if(!matched.length||matched.some(r=>r.disposition==='DENY'))return fail();
  const registration=(await db.query('SELECT r.id,r.project_id,r.version,r.state,r.requested_by,r.client_id,r.session_id,r.credential_generation,r.control_generation,r.revoked_at,r.scope_json,r.scope_digest,r.policy_ref,r.expires_at,r.expected_host_fingerprint,r.observed_host_fingerprint,h.public_key_spki,h.status AS connector_status,h.revoked_at AS connector_revoked_at,h.owner_user_id,h.client_id AS connector_client_id,h.credential_generation AS connector_credential_generation,h.host_fingerprint FROM anvil.connector_registrations r JOIN anvil.connectors h ON h.id=r.connector_id AND h.project_id=r.project_id WHERE r.project_id=$1 AND r.id=$2 FOR SHARE OF r,h',[p.scope.projectId,p.registrationRef.id])).rows[0];
  if(!registration||registration.project_id!==p.scope.projectId||registration.id!==p.registrationRef.id||registration.state!=='ISSUED'||registration.connector_status!=='TRUSTED'||registration.revoked_at!==null||registration.connector_revoked_at!==null||registration.requested_by!==actor.actorId||registration.owner_user_id!==actor.actorId||registration.client_id!==actor.clientId||registration.connector_client_id!==actor.clientId||registration.session_id!==actor.authSession.id||Number(registration.credential_generation)!==actor.credentialGeneration||Number(registration.connector_credential_generation)!==actor.credentialGeneration||Number(registration.control_generation)!==p.subject.controlGeneration||!same(registration.policy_ref,policy.ref)||!date(registration.expires_at)||publicKeyFingerprint(registration.public_key_spki)!==p.payload.publicKeyFingerprint)return fail();
  // 준비 사건과 등록 원자료 양쪽을 같은 실제 공개키 지문에 결박한다.
  if(publicKeyFingerprint(registration.public_key_spki)!==registration.expected_host_fingerprint)return fail();
  const scope=registration.scope_json;
  if(!recordV1(scope,['kind','installationId','projectId','subject','policyRef','expectedHostFingerprint','hostLabel','expiresAt','credentialScope','grants'])||scope.kind!=='HOST_TRUST_REGISTRATION'||scope.installationId!==p.scope.installationId||scope.projectId!==p.scope.projectId||!same(scope.subject,{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId,credentialGeneration:actor.credentialGeneration,controlGeneration:p.subject.controlGeneration})||!same(scope.policyRef,policy.ref)||scope.credentialScope!=='REGISTRATION_STATUS_ONLY'||!same(scope.grants,[])||scope.expectedHostFingerprint!==registration.expected_host_fingerprint||scope.expectedHostFingerprint!==registration.observed_host_fingerprint||scope.expectedHostFingerprint!==registration.host_fingerprint||!isoV1(scope.expiresAt)||scope.expiresAt!==registration.expires_at.toISOString()||hash(scope)!==registration.scope_digest)return fail();
  const registrationRef={id:registration.id,version:Number(registration.version),contentHash:hash({registrationId:registration.id,version:Number(registration.version),state:registration.state,scopeDigest:registration.scope_digest})};
  if(!refV1(registrationRef)||!same(registrationRef,p.registrationRef))return fail();
  const expires=Math.min(Date.parse(p.expiresAt),Date.parse(actor.authSession.idleExpiresAt),Date.parse(actor.authSession.absoluteExpiresAt),actor.reauthUntil.getTime(),registration.expires_at.getTime(),...matched.map(r=>Date.parse(r.expiresAt)));
  const last=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;
  if(!date(last)||last.getTime()<at.getTime()||!Number.isFinite(expires)||last.getTime()>=expires||access.installationId!==p.scope.installationId)return fail();
  return{purpose:'OWNERSHIP_HUMAN_POLICY_REGISTRATION_BASIS_ONLY' as const,scope:cloneV1(p.scope),subject:cloneV1(p.subject),preparationRef:cloneV1(prep.ref),policyRef:cloneV1(policy.ref),registrationRef,publicKeySpki:registration.public_key_spki as string,approvalRequired:matched.some(r=>r.disposition==='REQUIRE_APPROVAL'),checkedAt:last.toISOString(),expiresAt:new Date(expires).toISOString(),missingEvidence:['ORIGINAL_PREPARATION_RECEIPT_AND_APPROVAL','VERIFIED_WRITER_NONE_OR_RECLAIM','CANDIDATE_PROVENANCE'] as const,preparationAuthorized:false as const,observationRequestAuthorized:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
 }catch{return fail();}
}
