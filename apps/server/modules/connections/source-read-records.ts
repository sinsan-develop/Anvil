import type {PoolClient} from 'pg';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {readSourceReadScopeV1,type SourceReadScopeV1} from '../../../../contracts/runtime/source-read-observation-v1.ts';
import {uuidV1,refV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readRootDeclaration} from './source-root-input.ts';
import {readSourceReadListQuery} from './source-read-input.ts';
import {readSourceReadReportV1,type SourceReadReportV1} from '../../../../contracts/runtime/source-read-report-v1.ts';
import type {ProjectListCodec} from '../projects/service.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const time=(v:unknown):v is Date=>v instanceof Date&&Number.isFinite(v.getTime());
const flags={executionAuthorized:false as const,agentDispatchPerformed:false as const,baselineConfirmed:false as const};
export interface SourceReadGrantRecord{row:any;scope:SourceReadScopeV1;grantRef:{id:string;version:1;contentHash:string};declaredPathHint:string;displayName:string;receipt:any}
/** 저장 무결성·조회 projection만 담당한다. 현재성 true만으로 token/OS 권한을 발급하지 않는다. */
export class SourceReadRecords{
 readonly installationId:string;constructor(installationId:string){this.installationId=installationId;}
 async load(db:PoolClient,pid:string,id:string,lock=false):Promise<SourceReadGrantRecord>{
  if(!uuidV1(pid)||!uuidV1(id))throw new AuthFailure('SOURCE_READ_INPUT_INVALID',422);
  const row=(await db.query(`SELECT g.*,c.operation created_operation,c.state created_state,c.actor_id created_actor,c.client_id created_client,c.expected_version created_expected_version,c.result_ref created_result,v.declaration_json source_declaration_json,v.status source_status,v.authority source_authority,v.readiness source_readiness,v.reason source_reason,v.content_hash source_content_hash,r.head_version source_head_version FROM anvil.source_read_grants g JOIN anvil.commands c ON c.project_id=g.project_id AND c.id=g.created_command_id JOIN anvil.source_root_versions v ON v.project_id=g.project_id AND v.root_id=g.source_root_id AND v.version=g.source_root_version JOIN anvil.source_roots r ON r.project_id=v.project_id AND r.id=v.root_id WHERE g.project_id=$1 AND g.id=$2 ${lock?'FOR UPDATE OF g':''}`,[pid,id])).rows[0];
  if(!row)throw new AuthFailure('NOT_FOUND',404);
  try{
   const scope=readSourceReadScopeV1(row.scope_json),grantRef={id,version:1 as const,contentHash:row.scope_digest},data=row.created_result?.data;
   const declaration=readRootDeclaration(row.source_declaration_json),source={declaration,status:row.source_status,authority:row.source_authority,readiness:row.source_readiness,reason:row.source_reason};
   if(scope.installationId!==this.installationId||scope.projectId!==pid||row.project_id!==pid||row.id!==id||Number(row.version)!==1||!refV1(grantRef)||contentHash(canonicalJson(scope))!==row.scope_digest||!time(row.created_at)||row.created_at.toISOString()!==scope.requestedAt||!time(row.expires_at)||row.expires_at.toISOString()!==scope.expiresAt||!Number.isInteger(row.exchange_failures)||row.exchange_failures<0||row.exchange_failures>5)throw Error();
   if(scope.sourceRootRef.id!==row.source_root_id||scope.sourceRootRef.version!==Number(row.source_root_version)||scope.sourceRootRef.contentHash!==row.source_root_hash||scope.connectorRef.id!==row.connector_id||scope.connectorRef.version!==Number(row.connector_generation)||scope.registrationRef.id!==row.registration_id||scope.registrationRef.version!==Number(row.registration_version)||scope.userId!==row.requested_by||scope.clientId!==row.client_id||scope.credentialGeneration!==Number(row.credential_generation)||scope.controlGeneration!==Number(row.control_generation)||!same(scope.policyRef,row.policy_ref))throw Error();
   if(source.status!=='DECLARED'||source.authority!=='USER_DECLARED'||source.readiness!=='UNVERIFIED'||Number(row.source_head_version)<scope.sourceRootRef.version||contentHash(canonicalJson(source))!==row.source_content_hash||row.source_content_hash!==scope.sourceRootRef.contentHash||contentHash(declaration.pathHint)!==scope.pathHintHash||declaration.connectorId!==scope.connectorRef.id)throw Error();
   if(row.created_operation!=='requestSourceReadObservation'||row.created_state!=='APPLIED'||row.created_actor!==scope.userId||row.created_client!==scope.clientId||Number(row.created_expected_version)!==0||row.created_result?.status!=='APPLIED'||row.created_result.targetId!==id||row.created_result.version!==1||data?.status!=='GRANT_RECORDED'||!same(data.ref,grantRef)||!same(data.grantRef,grantRef)||data.scopeDigest!==row.scope_digest||!same(data.scope,scope)||data.storedState!=='CREATED'||data.observationPermit!=='NOT_ISSUED'||data.executionAuthorized!==false||data.agentDispatchPerformed!==false||data.baselineConfirmed!==false)throw Error();
   if(row.revoked_at!==null&&(!time(row.revoked_at)||row.revoked_at<row.created_at||!uuidV1(row.revoke_command_id))||row.revoked_at===null&&row.revoke_command_id!==null)throw Error();
   return{row,scope,grantRef,declaredPathHint:declaration.pathHint,displayName:declaration.displayName,receipt:row.created_result};
  }catch{throw new AuthFailure('SOURCE_READ_INTEGRITY_FAILED',503);}
 }
 async current(db:PoolClient,record:SourceReadGrantRecord,now:Date){
  const reasons:string[]=[];
  if(record.row.revoked_at)reasons.push('REVOKED');if(record.row.expires_at<=now)reasons.push('EXPIRED');if(Number(record.row.exchange_failures)>=5)reasons.push('EXCHANGE_ATTEMPT_LIMIT');
  const current=(await db.query('SELECT anvil.source_read_basis_current($1,$2) ok',[record.scope.projectId,record.grantRef.id])).rows[0]?.ok;
  if(current!==true)reasons.push('BASIS_NOT_CURRENT');return reasons;
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string){
  const member=await projectMember(db,actor,pid),r=await this.load(db,pid,id),now=(await db.query('SELECT clock_timestamp() at')).rows[0].at as Date;
  if(!time(now))throw new AuthFailure('SOURCE_READ_INTEGRITY_FAILED',503);
  const reasons=await this.current(db,r,now);
  const credential=(await db.query('SELECT id FROM anvil.source_read_credentials WHERE project_id=$1 AND grant_id=$2',[pid,id])).rows;
  const challenge=(await db.query('SELECT id FROM anvil.source_read_challenges WHERE project_id=$1 AND grant_id=$2',[pid,id])).rows;
  const snapshots=(await db.query('SELECT id,content_hash FROM anvil.source_snapshots WHERE project_id=$1 AND grant_id=$2',[pid,id])).rows;
  if([credential,challenge,snapshots].some(rows=>rows.length>1||rows.some(r=>!uuidV1(r.id))))throw new AuthFailure('SOURCE_READ_INTEGRITY_FAILED',503);
  const snapshotRef=snapshots.length?{id:snapshots[0]!.id,version:1 as const,contentHash:snapshots[0]!.content_hash}:null;
  if(snapshotRef!==null&&!refV1(snapshotRef))throw new AuthFailure('SOURCE_READ_INTEGRITY_FAILED',503);
  const storedState=r.row.revoked_at?'REVOKED':snapshots.length?'REPORT_STORED':credential.length?'PERMIT_ISSUED':challenge.length?'CHALLENGED':'CREATED';
  const shared={projectId:pid,grantRef:r.grantRef,snapshotRef,scopeDigest:r.row.scope_digest,displayName:r.displayName,targetCount:r.scope.targets.length,storedState,effectiveState:reasons[0]??(snapshots.length?'REPORTED_OS_UNVERIFIED':credential.length?'PENDING_REPORT':challenge.length?'PENDING_EXCHANGE_PROOF':'PENDING_EXCHANGE'),invalidReasons:reasons,expiresAt:r.scope.expiresAt,observedAt:now.toISOString(),...flags};
  return member.participation==='OWNER'?{...shared,rawAllowed:true as const,scope:r.scope,declaredPathHint:r.declaredPathHint}:{...shared,rawAllowed:false as const};
 }
 async list(db:PoolClient,actor:AuthenticatedIdentity,pid:string,query:Record<string,unknown>,codec:ProjectListCodec){
  const member=await projectMember(db,actor,pid),{limit,cursor}=readSourceReadListQuery(query),filter={query:canonicalJson({view:'SOURCE_READ_GRANTS',projectId:pid,participation:member.participation}),archived:false,limit};let position:{at:string;id:string}|null=null;
  if(cursor!==null){try{position=codec.read(cursor,actor.actorId,filter);}catch{throw new AuthFailure('CURSOR_INVALID',400);}}
  const rows=(await db.query("SELECT id,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') cursor_at FROM anvil.source_read_grants WHERE project_id=$1 AND ($2::timestamptz IS NULL OR (created_at,id)<($2::timestamptz,$3::uuid)) ORDER BY created_at DESC,id DESC LIMIT $4",[pid,position?.at??null,position?.id??null,limit+1])).rows;
  const items=[];for(const hit of rows.slice(0,limit)){const v=await this.read(db,actor,pid,hit.id);const{projectId,grantRef,snapshotRef,scopeDigest,displayName,targetCount,storedState,effectiveState,invalidReasons,expiresAt,observedAt}=v;items.push({projectId,grantRef,snapshotRef,scopeDigest,displayName,targetCount,storedState,effectiveState,invalidReasons,expiresAt,observedAt,...flags});}
  const hasMore=rows.length>limit,last=rows.slice(0,limit).at(-1);return{view:'SOURCE_READ_GRANTS',items,hasMore,nextCursor:hasMore?codec.create(actor.actorId,filter,{at:last!.cursor_at,id:last!.id}):null,observedAt:new Date().toISOString()};
 }
 async readSnapshot(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string){
  if(!uuidV1(pid)||!uuidV1(id))throw new AuthFailure('SOURCE_READ_INPUT_INVALID',422);
  const member=await projectMember(db,actor,pid),rows=(await db.query('SELECT * FROM anvil.source_snapshots WHERE project_id=$1 AND id=$2 AND version=1',[pid,id])).rows;
  if(!rows.length)throw new AuthFailure('NOT_FOUND',404);
  if(rows.length!==1)throw new AuthFailure('SOURCE_READ_INTEGRITY_FAILED',503);
  const row=rows[0],grant=await this.load(db,pid,row.grant_id),s=grant.scope;
  const credentials=(await db.query('SELECT id,project_id,grant_id,connector_id,connector_generation,scope,scope_digest,issued_at,expires_at,consumed_at FROM anvil.source_read_credentials WHERE project_id=$1 AND grant_id=$2',[pid,grant.grantRef.id])).rows;
  let report:SourceReadReportV1;
  try{
   const c=credentials[0];
   if(credentials.length!==1||!uuidV1(c.id)||c.project_id!==pid||c.grant_id!==grant.grantRef.id||c.connector_id!==s.connectorRef.id||Number(c.connector_generation)!==s.connectorRef.version||c.scope!=='SOURCE_OBSERVE_READ_ONLY'||c.scope_digest!==grant.grantRef.contentHash||![c.issued_at,c.expires_at,c.consumed_at,row.observed_at,row.finished_at,row.received_at].every(time)||c.consumed_at.getTime()!==row.received_at.getTime())throw Error();
   if(row.project_id!==pid||row.id!==id||Number(row.version)!==1||row.grant_id!==grant.grantRef.id||row.source_root_id!==s.sourceRootRef.id||Number(row.source_root_version)!==s.sourceRootRef.version||row.connector_id!==s.connectorRef.id||Number(row.generation)!==s.connectorRef.version||row.scope_digest!==grant.grantRef.contentHash||row.evidence_class!=='CONNECTOR_REPORTED'||row.os_verification!=='UNVERIFIED')throw Error();
   report=readSourceReadReportV1(row.report_json,{scope:s,grantRef:grant.grantRef,credentialIssuedAt:c.issued_at.toISOString(),credentialExpiresAt:c.expires_at.toISOString(),receivedAt:row.received_at.toISOString()});
   if(row.content_hash!==report.contentHash||row.signature!==report.signature||row.report_command_id!==report.commandId||row.observed_at.toISOString()!==report.observedAt||row.finished_at.toISOString()!==report.finishedAt)throw Error();
   const audit=(await db.query("SELECT EXISTS(SELECT 1 FROM anvil.audit_events WHERE project_id=$1 AND outcome='APPLIED' AND source_kind='SOURCE_OBSERVATION_PROTOCOL' AND reason_code='SOURCE_READ_REPORT_STORED' AND target_ref=$2::jsonb AND scope_digest=$3 AND actor_ref=$4::jsonb AND client_ref=$5 AND policy_ref=$6::jsonb) ok",[pid,JSON.stringify({id,version:1,contentHash:row.content_hash}),grant.grantRef.contentHash,JSON.stringify({kind:'CONNECTOR',connectorId:s.connectorRef.id,registrationId:s.registrationRef.id}),s.clientId,JSON.stringify(s.policyRef)])).rows[0]?.ok;
   if(audit!==true)throw Error();
  }catch{throw new AuthFailure('SOURCE_READ_INTEGRITY_FAILED',503);}
  const observedSummary={rootState:report.root.state,total:report.files.length,observed:0,missing:0,denied:0,changed:0,unverified:0};
  for(const file of report.files)observedSummary[({OBSERVED:'observed',MISSING:'missing',DENIED:'denied',CHANGED:'changed',UNVERIFIED:'unverified'} as const)[file.state]]++;
  const shared={projectId:pid,snapshotRef:{id,version:1,contentHash:row.content_hash},grantRef:grant.grantRef,sourceRootRef:s.sourceRootRef,connectorRef:s.connectorRef,observedSummary,observedAt:report.observedAt,finishedAt:report.finishedAt,receivedAt:row.received_at.toISOString(),evidenceClass:'CONNECTOR_REPORTED' as const,osVerification:'UNVERIFIED' as const,...flags};
  // 현재 실행 유효성과 과거 보관을 분리한다. 과거 report를 새 OS 증거로 승격하지 않는다.
  return member.participation==='OWNER'?{...shared,rawAllowed:true as const,report}:{...shared,rawAllowed:false as const};
 }
}
