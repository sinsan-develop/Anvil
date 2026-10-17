import {randomBytes,randomUUID,createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {AccessRepository,AuthFailure} from '../access/repository.ts';
import type {AuthenticatedIdentity} from '../access/repository.ts';
import {authorizeMaterial,currentProjectController,persistProjectReceipt,projectReplay,recordProjectDenial} from '../access/project-command.ts';
import type {ProjectCommand} from '../access/project-command.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {readHostTrustRegistration,readHostTrustConfirmation,trustRegistrationOperations} from './trust-registration-input.ts';

export function registrationRef(row:{id:string;version:number|string;state:string;scope_digest:string}){const version=Number(row.version);return{id:row.id,version,contentHash:contentHash(canonicalJson({registrationId:row.id,version,state:row.state,scopeDigest:row.scope_digest}))};}
export function connectorRef(row:{connector_id:string;id:string;scope_digest:string},generation:number){return{id:row.connector_id,version:generation,contentHash:contentHash(canonicalJson({connectorId:row.connector_id,registrationId:row.id,scopeDigest:row.scope_digest,generation}))};}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
export class ProjectConnectorRegistrations {
 readonly access:AccessRepository;
 constructor(access:AccessRepository){this.access=access;}
 async command(token:string,csrf:string,request:ProjectCommand){
  try{return await this.access.authenticated(token,csrf,async(db,actor)=>{
   if(!trustRegistrationOperations.includes(request.operation as typeof trustRegistrationOperations[number]))throw new AuthFailure('CONNECTOR_OPERATION_NOT_SUPPORTED',412);
   await currentProjectController(db,actor,request);
   if(!actor.reauthUntil||actor.reauthUntil.getTime()<=Date.now())throw new AuthFailure('REAUTHENTICATION_REQUIRED',412);
   const policy=await authorizeMaterial(db,actor,request);if(request.baselineRefs.length)throw new AuthFailure('REFERENCE_CONNECTION_PENDING',412);
   const previous=await projectReplay(db,actor,request);if(previous!==undefined)return previous;
   const now=(await db.query('SELECT clock_timestamp() at')).rows[0].at as Date;
   if(request.operation==='registerConnector'){
    const input=readHostTrustRegistration(request.payload,now);if(!same(input.policyRef,policy.ref))throw new AuthFailure('CONNECTOR_POLICY_CHANGED',409);
    if(request.targetId!==null||request.expectedVersion!==0)throw new AuthFailure('CONNECTOR_VERSION_CONFLICT',409);
    if(Date.parse(input.expiresAt)>policy.validUntil)throw new AuthFailure('CONNECTOR_EXCEEDS_POLICY_EXPIRY',422);
    const id=randomUUID(),connectorId=randomUUID(),oneTimeCode=randomBytes(32).toString('base64url');
    const session=(await db.query('SELECT id FROM anvil.auth_sessions WHERE token_digest=$1 AND user_id=$2 AND client_id=$3',[createHash('sha256').update(token).digest('hex'),actor.actorId,actor.clientId])).rows[0];if(!session)throw new AuthFailure('AUTH_REQUIRED',401);
    const scope={kind:'HOST_TRUST_REGISTRATION',installationId:this.access.installationId,projectId:request.projectId,subject:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId,credentialGeneration:actor.credentialGeneration,controlGeneration:request.controlGeneration},policyRef:policy.ref,expectedHostFingerprint:input.expectedHostFingerprint,hostLabel:input.hostLabel,expiresAt:input.expiresAt,credentialScope:'REGISTRATION_STATUS_ONLY',grants:[]};
    const scopeDigest=contentHash(canonicalJson(scope)),row={id,connector_id:connectorId,version:1,state:'CREATED',scope_digest:scopeDigest},ref=registrationRef(row),hostRef=connectorRef(row,1);
    const safe={status:'REGISTRATION_CREATED',registrationRef:ref,connectorRef:hostRef,scopeDigest,scope,expiresAt:input.expiresAt,previousRef:null,oneTimeCode:null,secretDisposition:'ALREADY_ISSUED_RECONCILE',grants:[],executionAuthorized:false};
    const receipt=await persistProjectReceipt(db,actor,request,ref,safe,policy.ref,'EXPLICIT_STATUS_ONLY_HOST_REGISTRATION');
    await db.query("INSERT INTO anvil.connectors(id,project_id,owner_user_id,client_id,credential_generation,host_label,host_fingerprint,registration_id,generation,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,'REGISTRATION_PENDING')",[connectorId,request.projectId,actor.actorId,actor.clientId,actor.credentialGeneration,input.hostLabel,input.expectedHostFingerprint,id]);
    await db.query("INSERT INTO anvil.connector_registrations(id,connector_id,project_id,requested_by,client_id,session_id,credential_generation,control_generation,version,state,expected_host_fingerprint,code_digest,scope_json,scope_digest,policy_ref,expires_at,created_command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,'CREATED',$9,$10,$11,$12,$13,$14,$15)",[id,connectorId,request.projectId,actor.actorId,actor.clientId,session.id,actor.credentialGeneration,request.controlGeneration,input.expectedHostFingerprint,contentHash(oneTimeCode),JSON.stringify(scope),scopeDigest,JSON.stringify(policy.ref),input.expiresAt,receipt.id]);
    return{...receipt.result,data:{...receipt.result.data,oneTimeCode,secretDisposition:'DELIVERED_ONCE'}};
   }
   if(request.operation==='confirmConnectorRegistration')return this.#confirm(db,actor,request,policy.ref,now);
   return this.#revoke(db,actor,request,policy.ref,now);
  });}catch(error){await recordProjectDenial(this.access,token,request.projectId,error);throw error;}
 }
 async #confirm(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,policyRef:unknown,now:Date){
  const input=readHostTrustConfirmation(c.payload);if(c.targetId!==input.registrationId)throw new AuthFailure('CONNECTOR_VERSION_CONFLICT',409);
  const row=(await db.query('SELECT r.*,h.generation,h.public_key_spki FROM anvil.connector_registrations r JOIN anvil.connectors h ON h.id=r.connector_id AND h.project_id=r.project_id WHERE r.project_id=$1 AND r.id=$2 FOR UPDATE OF r,h',[c.projectId,input.registrationId])).rows[0];
  if(!row)throw new AuthFailure('NOT_FOUND',404);
  if(row.requested_by!==actor.actorId||row.client_id!==actor.clientId||Number(row.credential_generation)!==actor.credentialGeneration||Number(row.control_generation)!==c.controlGeneration||!same(row.policy_ref,policyRef))throw new AuthFailure('CONNECTOR_BASIS_NOT_CURRENT',412);
  if(Number(row.version)!==c.expectedVersion||row.state!=='PROVED_WAITING_CONFIRMATION')throw new AuthFailure('CONNECTOR_VERSION_CONFLICT',409);
  if(!(await db.query('SELECT anvil.connector_basis_current($1,true) ok',[row.id])).rows[0].ok)throw new AuthFailure('CONNECTOR_BASIS_NOT_CURRENT',412);
  if(row.expires_at.getTime()<=now.getTime()||!row.public_key_spki)throw new AuthFailure('CONNECTOR_REGISTRATION_EXPIRED',412);
  if(input.scopeDigest!==row.scope_digest||input.observedHostFingerprint!==row.expected_host_fingerprint||input.observedHostFingerprint!==row.observed_host_fingerprint)throw new AuthFailure('CONNECTOR_COMPARISON_MISMATCH',409);
  const previousRef=registrationRef(row),version=Number(row.version)+1,state=input.decision==='APPROVE'?'CONFIRMED':'REJECTED',ref=registrationRef({...row,version,state});
  const receipt=await persistProjectReceipt(db,actor,c,ref,{status:state,registrationRef:ref,connectorRef:connectorRef(row,Number(row.generation)),scopeDigest:row.scope_digest,previousRef,grants:[],executionAuthorized:false},policyRef as any,'EXPLICIT_HOST_FINGERPRINT_COMPARISON');
  const changed=await db.query('UPDATE anvil.connector_registrations SET version=$3,state=$4,decision_command_id=$5 WHERE project_id=$1 AND id=$2 AND version=$6',[c.projectId,row.id,version,state,receipt.id,c.expectedVersion]);if(changed.rowCount!==1)throw new AuthFailure('CONNECTOR_VERSION_CONFLICT',409);return receipt.result;
 }
 async #revoke(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,policyRef:unknown,now:Date){
  const p=c.payload;
  if(!p||Object.keys(p).sort().join(',')!=='connectorRef,reason'||!isVersionRef(p.connectorRef)||typeof p.reason!=='string'||!p.reason.trim()||p.reason.length>20000||!p.reason.isWellFormed())throw new AuthFailure('CONNECTOR_REVOCATION_INPUT_INVALID',422);
  if(inspectArtifact(Buffer.from(p.reason,'utf8')).state==='SUSPECTED')throw new AuthFailure('CONNECTOR_REGISTRATION_SENSITIVE_CONTENT_SUSPECTED',412);
  if(c.targetId!==p.connectorRef.id||c.expectedVersion!==p.connectorRef.version)throw new AuthFailure('CONNECTOR_VERSION_CONFLICT',409);
  const row=(await db.query('SELECT r.*,h.generation,h.owner_user_id,h.status connector_status FROM anvil.connector_registrations r JOIN anvil.connectors h ON h.id=r.connector_id AND h.project_id=r.project_id WHERE r.project_id=$1 AND h.id=$2 FOR UPDATE OF r,h',[c.projectId,c.targetId])).rows[0];if(!row)throw new AuthFailure('NOT_FOUND',404);
  if(row.owner_user_id!==actor.actorId||row.client_id!==actor.clientId)throw new AuthFailure('CONNECTOR_REVOKE_DENIED',403);
  const previousRef=connectorRef(row,Number(row.generation));if(row.connector_status==='REVOKED'||!same(previousRef,p.connectorRef))throw new AuthFailure('CONNECTOR_VERSION_CONFLICT',409);
  const generation=Number(row.generation)+1,ref=connectorRef(row,generation);
  const receipt=await persistProjectReceipt(db,actor,c,ref,{status:'REVOKED',connectorRef:ref,registrationId:row.id,scopeDigest:row.scope_digest,previousRef,grants:[],executionAuthorized:false},policyRef as any,'EXPLICIT_STATUS_ONLY_HOST_REVOCATION');
  await db.query("UPDATE anvil.connectors SET generation=$3,status='REVOKED',revoked_at=$4 WHERE project_id=$1 AND id=$2",[c.projectId,row.connector_id,generation,now]);
  await db.query("UPDATE anvil.connector_registrations SET version=version+1,state='REVOKED',revoked_at=$3 WHERE project_id=$1 AND id=$2",[c.projectId,row.id,now]);
  await db.query('UPDATE anvil.connector_credentials SET revoked_at=$3 WHERE project_id=$1 AND connector_id=$2 AND revoked_at IS NULL',[c.projectId,row.connector_id,now]);return receipt.result;
 }
}
