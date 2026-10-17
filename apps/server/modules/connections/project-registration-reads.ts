import {AuthFailure} from '../access/repository.ts';
import type {AuthenticatedIdentity} from '../access/repository.ts';
import type {PoolClient} from 'pg';
import {currentPolicy,projectMember} from '../access/project-command.ts';
import {ProjectListCodec} from '../projects/service.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {registrationRef,connectorRef} from './project-registrations.ts';
import {publicKeyFingerprint} from './registration-proof.ts';
import {trustRegistrationOperations} from './trust-registration-input.ts';

export function readTrustListQuery(query:Record<string,unknown>){
 if(Object.keys(query).some(k=>!['limit','cursor'].includes(k))||query.limit!==undefined&&(typeof query.limit!=='string'||!/^[1-9][0-9]{0,2}$/.test(query.limit)||Number(query.limit)>200)||query.cursor!==undefined&&(typeof query.cursor!=='string'||!query.cursor||query.cursor.length>4096))throw new AuthFailure('INPUT_INVALID',400);
 return{limit:query.limit===undefined?50:Number(query.limit),cursor:query.cursor===undefined?null:query.cursor as string};
}
export function trustScopeProjection(scope:any){
 return{kind:scope.kind,installationId:scope.installationId,projectId:scope.projectId,subject:{kind:scope.subject.kind,userId:scope.subject.userId,clientId:scope.subject.clientId,credentialGeneration:scope.subject.credentialGeneration,controlGeneration:scope.subject.controlGeneration},policyRef:{id:scope.policyRef.id,version:scope.policyRef.version,contentHash:scope.policyRef.contentHash},expectedHostFingerprint:scope.expectedHostFingerprint,hostLabel:scope.hostLabel,expiresAt:scope.expiresAt,credentialScope:scope.credentialScope,grants:[]};
}

const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export class ProjectRegistrationReads{
 readonly installationId:string;
 constructor(installationId:string){this.installationId=installationId;}
 async #authority(db:PoolClient,actor:AuthenticatedIdentity,pid:string){
  const member=await projectMember(db,actor,pid);if(member.participation!=='OWNER')throw new AuthFailure('NOT_FOUND',404);
  if(member.archived_at)throw new AuthFailure('PROJECT_ARCHIVED',412);
  const control=(await db.query('SELECT * FROM anvil.project_control WHERE project_id=$1 FOR SHARE',[pid])).rows[0];
  if(!control||control.revoked_at)throw new AuthFailure('PROJECT_CONTROL_REQUIRED',403);
  if(control.actor_id!==actor.actorId||control.client_id!==actor.clientId)throw new AuthFailure('NOT_FOUND',404);
  const policy=await currentPolicy(db,pid);if(!policy)throw new AuthFailure('PERMISSION_POLICY_UNCONFIGURED',412);
  const now=(await db.query('SELECT clock_timestamp() at')).rows[0].at as Date;
  const rules=policy.rules.filter(r=>r.subjectRef.kind==='HUMAN'&&r.subjectRef.userId===actor.actorId&&r.targetScopes.some(t=>t.kind==='PROJECT'&&t.projectId===pid)&&r.operations.some(op=>(trustRegistrationOperations as readonly string[]).includes(op))&&Date.parse(r.expiresAt)>now.getTime());
  if(!rules.length||rules.some(r=>r.disposition==='DENY'))throw new AuthFailure('PROJECT_OPERATION_DENIED',403);
  return{control,policy,now,rules,validUntil:Math.min(...rules.map(r=>Date.parse(r.expiresAt)))};
 }
 async #record(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string){
  const row=(await db.query('SELECT r.*,h.owner_user_id,h.client_id host_client,h.credential_generation host_credential_generation,h.generation,h.host_label,h.host_fingerprint,h.public_key_spki,h.status connector_state,h.revoked_at host_revoked_at,c.operation created_operation,c.actor_id created_actor,c.client_id created_client,c.state created_state,c.result_ref created_result FROM anvil.connector_registrations r JOIN anvil.connectors h ON h.project_id=r.project_id AND h.id=r.connector_id AND h.registration_id=r.id JOIN anvil.commands c ON c.project_id=r.project_id AND c.id=r.created_command_id WHERE r.project_id=$1 AND r.id=$2 AND r.requested_by=$3 AND r.client_id=$4',[pid,id,actor.actorId,actor.clientId])).rows[0];
  if(!row)throw new AuthFailure('NOT_FOUND',404);
  try{
   const s=row.scope_json,created=row.created_result?.data,projection=trustScopeProjection(s);
   if(!same(s,projection)||s.kind!=='HOST_TRUST_REGISTRATION'||s.installationId!==this.installationId||s.projectId!==pid||s.subject.kind!=='HUMAN'||s.subject.userId!==row.requested_by||s.subject.clientId!==row.client_id||s.subject.credentialGeneration!==Number(row.credential_generation)||s.subject.controlGeneration!==Number(row.control_generation)||!same(s.policyRef,row.policy_ref)||!isVersionRef(s.policyRef)||s.expiresAt!==row.expires_at.toISOString()||s.expectedHostFingerprint!==row.expected_host_fingerprint||s.hostLabel!==row.host_label||s.credentialScope!=='REGISTRATION_STATUS_ONLY'||!same(s.grants,[])||contentHash(canonicalJson(s))!==row.scope_digest||row.host_fingerprint!==row.expected_host_fingerprint||row.owner_user_id!==row.requested_by||row.host_client!==row.client_id||Number(row.host_credential_generation)!==Number(row.credential_generation)||row.created_operation!=='registerConnector'||row.created_state!=='APPLIED'||row.created_actor!==row.requested_by||row.created_client!==row.client_id||row.created_result.status!=='APPLIED'||created?.status!=='REGISTRATION_CREATED'||!same(created.scope,s)||created.scopeDigest!==row.scope_digest||!same(created.registrationRef,registrationRef({...row,version:1,state:'CREATED'}))||!same(created.connectorRef,connectorRef(row,1))||created.oneTimeCode!==null)throw Error();
   if(row.public_key_spki!==null&&(publicKeyFingerprint(row.public_key_spki)!==row.expected_host_fingerprint||row.observed_host_fingerprint!==row.expected_host_fingerprint))throw Error();
   if(row.proofed_at&&(!row.public_key_spki||!row.observed_host_fingerprint))throw Error();
  }catch{throw new AuthFailure('CONNECTOR_REGISTRATION_INTEGRITY_FAILED',503);}
  return row;
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string){
  if(!uuid.test(id))throw new AuthFailure('INPUT_INVALID',400);
  const auth=await this.#authority(db,actor,pid),r=await this.#record(db,actor,pid,id),now=auth.now;
  const credential=(await db.query('SELECT issued_at,expires_at,revoked_at FROM anvil.connector_credentials WHERE project_id=$1 AND registration_id=$2',[pid,id])).rows[0];
  const reasons:string[]=[];
  if(r.revoked_at||r.connector_state==='REVOKED')reasons.push('REVOKED');
  if(r.expires_at.getTime()<=now.getTime())reasons.push('REGISTRATION_EXPIRED');
  if(!same(r.policy_ref,auth.policy.ref))reasons.push('POLICY_CHANGED');
  if(Number(r.control_generation)!==Number(auth.control.generation))reasons.push('CONTROL_GENERATION_CHANGED');
  if(Number(r.credential_generation)!==actor.credentialGeneration)reasons.push('CREDENTIAL_GENERATION_CHANGED');
  if(!(await db.query('SELECT anvil.connector_basis_current($1,false) ok',[id])).rows[0].ok)reasons.push('SESSION_OR_POLICY_NOT_CURRENT');
  if(Number(r.failed_attempts)>=5)reasons.push('PROOF_ATTEMPT_LIMIT');
  const current=reasons.length===0,confirmationReasons=[...reasons];
  if(!auth.rules.some(rule=>rule.operations.includes('confirmConnectorRegistration')))confirmationReasons.push('CONFIRMATION_POLICY_DENIED');
  if(r.state!=='PROVED_WAITING_CONFIRMATION'||!r.proofed_at)confirmationReasons.push('PROOF_NOT_READY');
  if(!actor.reauthUntil||actor.reauthUntil.getTime()<=now.getTime())confirmationReasons.push('REAUTHENTICATION_REQUIRED');
  return{registrationRef:registrationRef(r),connectorRef:connectorRef(r,Number(r.generation)),projectId:pid,hostLabel:r.host_label,state:r.state,connectorState:r.connector_state,derivedExpired:r.expires_at.getTime()<=now.getTime(),expectedHostFingerprint:r.expected_host_fingerprint,observedHostFingerprint:r.observed_host_fingerprint,scopeDigest:r.scope_digest,scope:trustScopeProjection(r.scope_json),policyRef:{...auth.policy.ref},createdAt:r.created_at.toISOString(),expiresAt:r.expires_at.toISOString(),proofedAt:r.proofed_at?.toISOString()??null,issuedAt:r.issued_at?.toISOString()??null,revokedAt:r.revoked_at?.toISOString()??null,failedAttempts:Number(r.failed_attempts),credential:credential?{issued:true,expiresAt:credential.expires_at.toISOString(),revokedAt:credential.revoked_at?.toISOString()??null,status:credential.revoked_at?'REVOKED':credential.expires_at<=now?'EXPIRED':current&&r.connector_state==='TRUSTED'?'ACTIVE_STATUS_ONLY':'BASIS_NOT_CURRENT'}:{issued:false,expiresAt:null,revokedAt:null,status:'NOT_ISSUED'},basis:{current,reasons},confirmation:{allowed:confirmationReasons.length===0,reasons:confirmationReasons},grants:[],executionAuthorized:false as const,observedAt:now.toISOString()};
 }
 async list(db:PoolClient,actor:AuthenticatedIdentity,pid:string,query:Record<string,unknown>,codec:ProjectListCodec){
  const{limit,cursor}=readTrustListQuery(query),auth=await this.#authority(db,actor,pid);
  const filter={query:canonicalJson({view:'HOST_TRUST_REGISTRATIONS_ONLY',projectId:pid,clientId:actor.clientId,policyRef:auth.policy.ref,validUntil:auth.validUntil,controlGeneration:Number(auth.control.generation),order:'created_at_desc,id_desc'}),archived:false,limit};
  let position:{at:string;id:string}|null=null;
  if(cursor!==null){try{position=codec.read(cursor,actor.actorId,filter,auth.now);}catch{throw new AuthFailure('CURSOR_INVALID',400);}}
  const rows=(await db.query("SELECT r.id,to_char(r.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') cursor_at FROM anvil.connector_registrations r WHERE r.project_id=$1 AND r.requested_by=$2 AND r.client_id=$3 AND ($4::timestamptz IS NULL OR (r.created_at,r.id)<($4::timestamptz,$5::uuid)) ORDER BY r.created_at DESC,r.id DESC LIMIT $6",[pid,actor.actorId,actor.clientId,position?.at??null,position?.id??null,limit+1])).rows;
  const items=[];for(const hit of rows.slice(0,limit)){const r=await this.#record(db,actor,pid,hit.id);items.push({registrationRef:registrationRef(r),connectorRef:connectorRef(r,Number(r.generation)),hostLabel:r.host_label,state:r.state,derivedExpired:r.expires_at<=auth.now,expiresAt:r.expires_at.toISOString(),proofedAt:r.proofed_at?.toISOString()??null,revokedAt:r.revoked_at?.toISOString()??null});}
  const hasMore=rows.length>limit,last=rows.slice(0,limit).at(-1);
  // 기존 codec의 30분 상한보다 현재 정책 기한이 이르면 cursor 역시 그 시각에 만료한다.
  return{view:'HOST_TRUST_REGISTRATIONS_ONLY',items,hasMore,nextCursor:hasMore?codec.create(actor.actorId,filter,{at:last!.cursor_at,id:last!.id},new Date(Math.min(auth.now.getTime(),auth.validUntil-30*60000))):null,observedAt:auth.now.toISOString()};
 }
}
