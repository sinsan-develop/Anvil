import {randomUUID} from 'node:crypto';
import {AccessRepository,AuthFailure} from '../access/repository.ts';
import {authorizeMaterial,currentProjectController,persistProjectReceipt,projectReplay,recordProjectDenial,type ProjectCommand} from '../access/project-command.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {readSourceReadScopeV1} from '../../../../contracts/runtime/source-read-observation-v1.ts';
import {readSourceReadInput} from './source-read-input.ts';
import {ProjectSourceRoots} from './project-source-roots.ts';
import {ProjectRegistrationReads} from './project-registration-reads.ts';
import {SourceReadRecords} from './source-read-records.ts';
import {refV1} from '../../../../contracts/runtime/validation-v1.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const flags={executionAuthorized:false as const,agentDispatchPerformed:false as const,baselineConfirmed:false as const};
/** HUMAN 명시 요청만 기록한다. credential 발급·OS 관측·Agent 실행 권한이 아니다. */
export class ProjectSourceReadGrants{
 readonly access:AccessRepository;
 constructor(access:AccessRepository){this.access=access;}
 async command(token:string,csrf:string,request:ProjectCommand){
  try{return await this.access.authenticated(token,csrf,async(db,actor)=>{
   await currentProjectController(db,actor,request);
   if(!actor.reauthUntil||actor.reauthUntil.getTime()<=Date.now())throw new AuthFailure('REAUTHENTICATION_REQUIRED',412);
   if(request.approvalRef!==null)throw new AuthFailure('SOURCE_READ_APPROVAL_NOT_CONNECTED',412);
   if(request.baselineRefs.length)throw new AuthFailure('REFERENCE_CONNECTION_PENDING',412);
   const policy=await authorizeMaterial(db,actor,request,true);
   if(policy.approvalRequired)throw new AuthFailure('SOURCE_READ_APPROVAL_NOT_CONNECTED',412);
   const now=(await db.query('SELECT clock_timestamp() at')).rows[0]?.at;
   if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw new AuthFailure('SOURCE_READ_INTEGRITY_FAILED',503);
   const previous=await projectReplay(db,actor,request);
   // 현재 주체 확인 후 같은 명령의 보관 결과만 돌려준다. 새 발급/기한 연장 없음.
   const records=new SourceReadRecords(this.access.installationId);
   if(previous!==undefined){
    const result=previous as any,ref=result?.data?.grantRef;
    if(!refV1(ref)||ref.version!==1)throw new AuthFailure('SOURCE_READ_INTEGRITY_FAILED',503);
    const record=await records.load(db,request.projectId,ref.id);
    if(!same(ref,record.grantRef))throw new AuthFailure('SOURCE_READ_INTEGRITY_FAILED',503);
    if(request.operation==='requestSourceReadObservation'){
     if(record.scope.userId!==actor.actorId||record.scope.clientId!==actor.clientId||!same(result,record.receipt))throw new AuthFailure('SOURCE_READ_INTEGRITY_FAILED',503);
    }else if(request.operation==='revokeSourceReadObservation'){
     const revoked=(await db.query('SELECT operation,state,actor_id,client_id,result_ref FROM anvil.commands WHERE project_id=$1 AND id=$2',[request.projectId,record.row.revoke_command_id])).rows[0];
     if(!record.row.revoked_at||!revoked||revoked.operation!==request.operation||revoked.state!=='APPLIED'||revoked.actor_id!==actor.actorId||revoked.client_id!==actor.clientId||!same(revoked.result_ref,result)||result.data.status!=='GRANT_REVOKED'||result.data.executionAuthorized!==false||result.data.agentDispatchPerformed!==false||result.data.baselineConfirmed!==false)throw new AuthFailure('SOURCE_READ_INTEGRITY_FAILED',503);
    }else throw new AuthFailure('SOURCE_READ_INPUT_INVALID',422);
    return previous;
   }
   const value=readSourceReadInput(request.operation,request.payload,now.getTime());
   if(value.operation==='revokeSourceReadObservation'){
    const input=value.input;
    if(request.targetId!==input.grantRef.id||request.expectedVersion!==1)throw new AuthFailure('SOURCE_READ_VERSION_CONFLICT',409);
    const record=await records.load(db,request.projectId,input.grantRef.id,true);
    if(!same(record.grantRef,input.grantRef)||record.row.revoked_at)throw new AuthFailure('SOURCE_READ_VERSION_CONFLICT',409);
    const receipt=await persistProjectReceipt(db,actor,request,record.grantRef,{status:'GRANT_REVOKED',grantRef:record.grantRef,scopeDigest:record.grantRef.contentHash,storedState:'REVOKED',...flags},policy.ref,'EXPLICIT_SOURCE_READ_REVOCATION');
    const changed=await db.query('UPDATE anvil.source_read_grants SET revoked_at=$3,revoke_command_id=$4 WHERE project_id=$1 AND id=$2 AND revoked_at IS NULL',[request.projectId,input.grantRef.id,now,receipt.id]);
    if(changed.rowCount!==1)throw new AuthFailure('SOURCE_READ_VERSION_CONFLICT',409);
    await db.query('UPDATE anvil.source_read_credentials SET revoked_at=$3 WHERE project_id=$1 AND grant_id=$2 AND revoked_at IS NULL',[request.projectId,input.grantRef.id,now]);
    return receipt.result;
   }
   const input=value.input;
   if(request.targetId!==null||request.expectedVersion!==0)throw new AuthFailure('SOURCE_READ_VERSION_CONFLICT',409);
   const head=(await db.query('SELECT head_version FROM anvil.source_roots WHERE project_id=$1 AND id=$2 FOR SHARE',[request.projectId,input.sourceRootRef.id])).rows[0];
   if(!head)throw new AuthFailure('NOT_FOUND',404);
   if(Number(head.head_version)!==input.sourceRootRef.version)throw new AuthFailure('SOURCE_READ_VERSION_CONFLICT',409);
   const root=await new ProjectSourceRoots(this.access).read(db,actor,request.projectId,input.sourceRootRef.id,input.sourceRootRef.version);
   if(!root.rawAllowed||root.status!=='DECLARED'||!same(root.ref,input.sourceRootRef)||root.headVersion!==input.sourceRootRef.version||root.snapshot.declaration.connectorId!==input.connectorRef.id)throw new AuthFailure('SOURCE_READ_SOURCE_NOT_CURRENT',412);
   const registration=await new ProjectRegistrationReads(this.access.installationId).read(db,actor,request.projectId,input.registrationRef.id);
   if(!registration.basis.current||registration.derivedExpired||registration.state!=='ISSUED'||registration.connectorState!=='TRUSTED'||!same(registration.registrationRef,input.registrationRef)||!same(registration.connectorRef,input.connectorRef)||!same(registration.policyRef,policy.ref))throw new AuthFailure('SOURCE_READ_REGISTRATION_NOT_CURRENT',412);
   const sessions=(await db.query('SELECT id,absolute_expires_at,credential_generation FROM anvil.auth_sessions WHERE token_digest=$1 AND user_id=$2 AND client_id=$3',[contentHash(token),actor.actorId,actor.clientId])).rows;
   const session=sessions[0];
   if(sessions.length!==1||!(session.absolute_expires_at instanceof Date)||!Number.isFinite(session.absolute_expires_at.getTime())||Number(session.credential_generation)!==actor.credentialGeneration)throw new AuthFailure('SOURCE_READ_SESSION_NOT_CURRENT',412);
   // 2시간은 상한이다. 기존 등록과 현재 정책/원 세션의 기한을 늘리지 않는다.
   if(Date.parse(input.expiresAt)>Math.min(policy.validUntil,Date.parse(registration.expiresAt),session.absolute_expires_at.getTime()))throw new AuthFailure('SOURCE_READ_EXPIRY_INVALID',422);
   const scope=readSourceReadScopeV1({...input,protocolVersion:1,purpose:'SOURCE_READ_OBSERVATION',installationId:this.access.installationId,projectId:request.projectId,pathHintHash:contentHash(root.snapshot.declaration.pathHint),hostFingerprint:registration.expectedHostFingerprint,userId:actor.actorId,clientId:actor.clientId,credentialGeneration:actor.credentialGeneration,controlGeneration:request.controlGeneration,policyRef:policy.ref,requestedAt:now.toISOString()});
   const id=randomUUID(),grantRef={id,version:1 as const,contentHash:contentHash(canonicalJson(scope))};
   const receipt=await persistProjectReceipt(db,actor,request,grantRef,{status:'GRANT_RECORDED',grantRef,scopeDigest:grantRef.contentHash,storedState:'CREATED',scope,observationPermit:'NOT_ISSUED',...flags},policy.ref,'EXPLICIT_SOURCE_READ_OBSERVATION');
   await db.query('INSERT INTO anvil.source_read_grants(project_id,id,version,source_root_id,source_root_version,source_root_hash,connector_id,connector_generation,registration_id,registration_version,requested_by,client_id,session_id,credential_generation,control_generation,policy_ref,scope_json,scope_digest,created_command_id,created_at,expires_at) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)',[request.projectId,id,input.sourceRootRef.id,input.sourceRootRef.version,input.sourceRootRef.contentHash,input.connectorRef.id,input.connectorRef.version,input.registrationRef.id,input.registrationRef.version,actor.actorId,actor.clientId,session.id,actor.credentialGeneration,request.controlGeneration,JSON.stringify(policy.ref),JSON.stringify(scope),grantRef.contentHash,receipt.id,now,input.expiresAt]);
   return receipt.result;
  });}catch(error){await recordProjectDenial(this.access,token,request.projectId,error);throw error;}
 }
}
