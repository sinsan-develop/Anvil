import {randomUUID} from 'node:crypto';
import {types} from 'node:util';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type DispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {readNormalStopTargetV1,normalStopScopeRefV1,type NormalStopTargetV1} from '../../../../contracts/runtime/normal-stop-target-v1.ts';
import {arrayV1,cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {currentProjectController,persistProjectReceipt,projectReplay,recordProjectDenial,type ProjectCommand} from '../access/project-command.ts';
import {assertKnowledgeTextSafe} from '../knowledge/knowledge-entry.ts';
import {ProjectLimitPolicies} from './runtime-policy.ts';
import {NormalStopTargets,normalStopHumanDeadline} from './normal-stop-target.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const fail=(code='STOP_COMMAND_INPUT_INVALID',status=412):never=>{throw new AuthFailure(code,status);};
type Scope={projectId:string;executionId:string;executionGeneration:number};
type Subject={userId:string;clientId:string;humanSessionId:string;credentialGeneration:number;controlGeneration:number};
type Intent={transport:'NORMAL_PROTECTED';state:'STOP_REQUEST_STORED';scope:Scope;requestHash:string;requestedBy:Subject;target:NormalStopTargetV1;reason:string;requestedAt:string;expiresAt:string;executionAuthorized:false;dispatchPerformed:false;writerReleaseVerified:false};
export interface NormalStopRecord{ref:Ref;snapshot:Intent&{request:ProjectCommand;envelope:DispatchEnvelopeV1}}
export function readNormalStopRequest(raw:unknown):ProjectCommand {
 if(!raw||typeof raw!=='object'||types.isProxy(raw)||!recordV1(raw,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||raw.schemaVersion!==1||![raw.projectId,raw.commandId,raw.clientId,raw.targetId].every(uuidV1)||!positive(raw.controlGeneration)||!positive(raw.expectedVersion)||raw.operation!=='requestExecutionStop'||!arrayV1(raw.baselineRefs,0)||raw.approvalRef!==null||types.isProxy(raw.payload)||
  !recordV1(raw.payload,['grantRef','sessionBindingRef','stopScopeRef','permissionPolicyRef','budgetPolicyRef','reason'])||!['grantRef','sessionBindingRef','stopScopeRef','permissionPolicyRef','budgetPolicyRef'].every(k=>!types.isProxy(raw.payload[k])&&refV1(raw.payload[k]))||typeof raw.payload.reason!=='string'||!raw.payload.reason.trim()||raw.payload.reason.length>20000||Buffer.byteLength(canonicalJson(raw))>2097152)return fail();
 assertKnowledgeTextSafe(raw.payload.reason);return cloneV1(raw) as unknown as ProjectCommand;
}
/** 역사 저장 형상만 검산한다. 원 START namespace/DB graph·현재성은 별도 필수다. */
export function readNormalStopRecord(raw:unknown,scope:Scope,originalStartCommandId:string):NormalStopRecord {
 try{
  if(!raw||typeof raw!=='object'||types.isProxy(raw)||!recordV1(raw,['ref','snapshot'])||!refV1(raw.ref)||raw.ref.version!==1||!recordV1(raw.snapshot,['transport','state','scope','requestHash','requestedBy','target','reason','requestedAt','expiresAt','executionAuthorized','dispatchPerformed','writerReleaseVerified','request','envelope']))throw Error();
  const s=raw.snapshot,target=readNormalStopTargetV1(s.target),request=readNormalStopRequest(s.request),r=s.requestedBy;
  if(s.transport!=='NORMAL_PROTECTED'||s.state!=='STOP_REQUEST_STORED'||!same(s.scope,scope)||!recordV1(r,['userId','clientId','humanSessionId','credentialGeneration','controlGeneration'])||![r.userId,r.clientId,r.humanSessionId].every(uuidV1)||!positive(r.credentialGeneration)||!positive(r.controlGeneration)||!isoV1(s.requestedAt)||!isoV1(s.expiresAt)||Date.parse(s.expiresAt)<=Date.parse(s.requestedAt)||Date.parse(s.expiresAt)>Date.parse(s.requestedAt)+30000||s.executionAuthorized!==false||s.dispatchPerformed!==false||s.writerReleaseVerified!==false)throw Error();
  const envelope=readDispatchEnvelopeV1(s.envelope,Date.parse(s.requestedAt)),{request:_,envelope:__,...intent}=s;
  if(envelope.operation!=='REQUEST_STOP'||raw.ref.contentHash!==hash(intent)||s.requestHash!==hash(request)||s.reason!==request.payload.reason||request.projectId!==scope.projectId||request.targetId!==scope.executionId||request.expectedVersion!==scope.executionGeneration||request.clientId!==r.clientId||request.controlGeneration!==r.controlGeneration||target.projectId!==scope.projectId||target.executionId!==scope.executionId||target.executionGeneration!==scope.executionGeneration||!same(request.payload.grantRef,target.grantRef)||!same(request.payload.sessionBindingRef,target.sessionBindingRef)||!same(request.payload.stopScopeRef,normalStopScopeRefV1(target,originalStartCommandId))||envelope.commandId!==request.commandId||envelope.issuedAt!==s.requestedAt||envelope.expiresAt!==s.expiresAt||!same(envelope.executorRegistrationRef,target.executorRegistrationRef)||envelope.context.projectId!==scope.projectId||envelope.context.executionId!==scope.executionId||envelope.context.executionGeneration!==scope.executionGeneration||!same(envelope.payload,{sessionBindingRef:target.sessionBindingRef,stopScopeRef:request.payload.stopScopeRef})||Buffer.byteLength(canonicalJson(raw))>2097152)throw Error();
  return cloneV1(raw) as unknown as NormalStopRecord;
 }catch{return fail('NORMAL_STOP_RECORD_INVALID',503);}
}
const targetCurrent=NormalStopTargets.prototype.current;
/** 새 current 권위를 주입하지 않는다. 현재는 원기록 검산 후 CURRENT_NOT_CONNECTED로 닫는다. */
export class NormalStopCommands {
 readonly #access:AccessRepository;readonly #targets:NormalStopTargets;
 constructor(access:AccessRepository,policies:Pick<ProjectLimitPolicies,'resolveCurrent'>=new ProjectLimitPolicies()){this.#access=access;this.#targets=new NormalStopTargets(access,policies);}
 async #current(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand){
  if(NormalStopTargets.prototype.current!==targetCurrent||this.#targets.current!==targetCurrent)return fail('NORMAL_STOP_CURRENT_NOT_CONNECTED');
  const value=await targetCurrent.call(this.#targets,db,actor,request.projectId,request.targetId!,{generation:request.expectedVersion,grantRef:request.payload.grantRef as Ref},request);
  if(!same(value.projection.stopScopeRef,request.payload.stopScopeRef)||!same(value.projection.sessionBindingRef,request.payload.sessionBindingRef))return fail('NORMAL_STOP_TARGET_CHANGED');return value;
 }
 async command(token:string,csrf:string,raw:ProjectCommand){
  const request=readNormalStopRequest(raw),scope={projectId:request.projectId,executionId:request.targetId!,executionGeneration:request.expectedVersion};
  try{return await this.#access.authenticated(token,csrf,async(db,actor)=>{
   await currentProjectController(db,actor,request);const first=await this.#current(db,actor,request),replay:any=await projectReplay(db,actor,request);
   if(replay!==undefined){
    const rows=(await db.query('SELECT * FROM anvil.normal_stop_record($1,$2,$3,$4)',[scope.projectId,scope.executionId,scope.executionGeneration,request.commandId])).rows;
    if(rows.length!==1||rows[0].valid!==true||!same(rows[0].result_ref,replay))return fail('NORMAL_STOP_RECORD_INVALID',503);
    const old=readNormalStopRecord({ref:replay.data?.ref,snapshot:rows[0].snapshot_json},scope,first.parentEnvelope.commandId);if(!same(old.snapshot.request,request)||!same(old.snapshot.target,first.projection.target))return fail('NORMAL_STOP_TARGET_CHANGED');return replay;
   }
   const identity=await this.#access.authenticateInTransaction(db,token,csrf),next=await this.#current(db,identity,request);
   if(!same(first.projection.target,next.projection.target))return fail('NORMAL_STOP_TARGET_CHANGED');
   const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))return fail('NORMAL_STOP_CLOCK_INVALID',503);
   const end=Math.min(Date.parse(first.projection.expiresAt),Date.parse(next.projection.expiresAt),normalStopHumanDeadline(identity,at.getTime()),at.getTime()+30000);if(end<=at.getTime())return fail('NORMAL_STOP_EXPIRED');
   const intent:Intent={transport:'NORMAL_PROTECTED',state:'STOP_REQUEST_STORED',scope,requestHash:hash(request),requestedBy:{userId:identity.actorId,clientId:identity.clientId,humanSessionId:identity.authSession!.id,credentialGeneration:identity.credentialGeneration,controlGeneration:request.controlGeneration},target:first.projection.target,reason:request.payload.reason as string,requestedAt:at.toISOString(),expiresAt:new Date(end).toISOString(),executionAuthorized:false,dispatchPerformed:false,writerReleaseVerified:false};
   const ref={id:randomUUID(),version:1,contentHash:hash(intent)},receipt=await persistProjectReceipt(db,identity,request,ref,{status:'NORMAL_STOP_STORED',snapshot:intent,executionAuthorized:false,dispatchPerformed:false,writerReleaseVerified:false},next.policyRef,'EXPLICIT_NORMAL_STOP');
   const unsigned={schemaVersion:1,commandId:request.commandId,issuedAt:intent.requestedAt,expiresAt:intent.expiresAt,executorRegistrationRef:intent.target.executorRegistrationRef,context:{...first.parentEnvelope.context,authorizationReceiptRef:receipt.authorizationReceiptRef},operation:'REQUEST_STOP',payload:{sessionBindingRef:request.payload.sessionBindingRef,stopScopeRef:request.payload.stopScopeRef}},envelope=readDispatchEnvelopeV1({...unsigned,envelopeHash:hash(unsigned)},at.getTime());
   const record=readNormalStopRecord({ref,snapshot:{...intent,request,envelope}},scope,first.parentEnvelope.commandId);
   const quota=(await db.query("SELECT count(*)::int AS count,COALESCE(sum(octet_length(anvil.execution_authority_canonical(snapshot_json))),0)::bigint AS total FROM anvil.execution_commands WHERE project_id=$1 AND execution_id=$2 AND generation=$3 AND snapshot_json->>'state'='STOP_REQUEST_STORED'",[scope.projectId,scope.executionId,scope.executionGeneration])).rows[0];
   if(!quota||!Number.isSafeInteger(Number(quota.count))||Number(quota.count)<0||Number(quota.count)>=100||!Number.isSafeInteger(Number(quota.total))||Number(quota.total)<0||Number(quota.total)+Buffer.byteLength(canonicalJson(record.snapshot))>2097152)return fail('STOP_COMMAND_TOO_LARGE',422);
   const write=async(sql:string,args:unknown[])=>{if((await db.query(sql,args)).rowCount!==1)return fail('NORMAL_STOP_STORAGE_FAILED',503);};
   await write('INSERT INTO anvil.execution_commands(project_id,id,version,execution_id,generation,grant_id,grant_version,content_hash,envelope_hash,snapshot_json,authorization_ref,created_command_id) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[scope.projectId,ref.id,scope.executionId,scope.executionGeneration,intent.target.grantRef.id,intent.target.grantRef.version,ref.contentHash,envelope.envelopeHash,JSON.stringify(record.snapshot),JSON.stringify(receipt.authorizationReceiptRef),receipt.id]);
   await write('INSERT INTO anvil.delivery_outbox(id,project_id,command_id,kind,destination_ref,payload_ref,state,scope_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),scope.projectId,receipt.id,'EXECUTION_NORMAL',JSON.stringify({transport:'NORMAL_PROTECTED',registrationRef:envelope.executorRegistrationRef,executionId:scope.executionId,generation:scope.executionGeneration}),JSON.stringify({commandRef:ref,grantRef:intent.target.grantRef,envelopeHash:envelope.envelopeHash}),'PENDING',next.scopeDigest]);
   const final=await this.#current(db,await this.#access.authenticateInTransaction(db,token,csrf),request);if(!same(final.projection.target,intent.target)||Date.parse(final.projection.expiresAt)<end)return fail('NORMAL_STOP_TARGET_CHANGED');return receipt.result;
  });}catch(error){await recordProjectDenial(this.#access,token,request.projectId,error);throw error;}
 }
}
