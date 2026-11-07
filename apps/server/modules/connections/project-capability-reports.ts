import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {authorizeMaterial,currentProjectController,projectMember,projectReplay,persistProjectReceipt,recordProjectDenial,type ProjectCommand} from '../access/project-command.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import type {ProjectDocuments} from '../documents/project-documents.ts';
import {ProjectConnectionCandidates} from './project-candidates.ts';
import {readCapabilityReportClaim,capabilityReportSnapshot,type CapabilityReportClaim,type CapabilityArtifactRef} from './capability-report-input.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function integrity():never{throw new AuthFailure('CAPABILITY_REPORT_INTEGRITY_FAILED',503);}
const H=(v:unknown)=>contentHash(canonicalJson(v));
const unique=(claim:CapabilityReportClaim)=>[...new Map(claim.capabilities.flatMap(c=>c.evidenceRefs).map(a=>[a.artifactId,a])).values()];
export class ProjectCapabilityReports {
 #access:AccessRepository;#candidates:Pick<ProjectConnectionCandidates,'read'>;#documents:Pick<ProjectDocuments,'originalText'>;
 constructor(access:AccessRepository,candidates:Pick<ProjectConnectionCandidates,'read'>,documents:Pick<ProjectDocuments,'originalText'>){this.#access=access;this.#candidates=candidates;this.#documents=documents;}
 async #evidence(db:PoolClient,projectId:string,ref:CapabilityArtifactRef){
  const row=(await db.query('SELECT id,project_id,state,content_hash,bytes,media_type FROM anvil.artifacts WHERE project_id=$1 AND id=$2',[projectId,ref.artifactId])).rows[0];
  if(!row)throw new AuthFailure('NOT_FOUND',404);
  if(row.state==='QUARANTINED')throw new AuthFailure('ARTIFACT_QUARANTINED',412);
  if(row.content_hash!==ref.contentHash||Number(row.bytes)!==ref.bytes||row.media_type!==ref.mediaType)throw new AuthFailure('ARTIFACT_INTEGRITY_FAILED',503);
  // 실제 원문 검산은 기존 보호 reader만 수행하며 본문은 반환하지 않는다.
  await this.#documents.originalText(db,projectId,ref);
 }
 async #stored(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,id:string){
  const rows=(await db.query('SELECT * FROM anvil.capability_reports WHERE project_id=$1 AND id=$2 AND version=1',[projectId,id])).rows;
  if(!rows.length)throw new AuthFailure('NOT_FOUND',404);if(rows.length!==1)integrity();const r=rows[0];
  try{
   const at=new Date(r.created_at),claim=readCapabilityReportClaim(r.claim_json,{now:at});
   const snapshot=capabilityReportSnapshot(claim,projectId,id,{actorId:r.created_by,clientId:r.client_id},at),ref={id,version:1,contentHash:r.content_hash};
   if(r.project_id!==projectId||Number(r.version)!==1||!isVersionRef(ref)||H(claim)!==r.claim_hash||H(snapshot)!==r.content_hash||!same(snapshot,r.snapshot_json)||!same(claim.connectionRef,{id:r.connection_id,version:Number(r.connection_version),contentHash:r.connection_hash})||!same(claim.environmentRef,{id:r.environment_id,version:Number(r.environment_version),contentHash:r.environment_hash})||!same(claim.supersedesRef,r.supersedes_id===null?null:{id:r.supersedes_id,version:Number(r.supersedes_version),contentHash:r.supersedes_hash}))integrity();
   const cs=(await db.query('SELECT * FROM anvil.commands WHERE project_id=$1 AND id=$2',[projectId,r.command_id])).rows;if(cs.length!==1)integrity();const c=cs[0];
   const request:ProjectCommand={schemaVersion:1,projectId,commandId:c.command_id,clientId:r.client_id,controlGeneration:Number(c.control_generation),operation:'recordCapabilityReport',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:claim as unknown as Record<string,unknown>};
   if(c.scope_kind!=='PROJECT'||c.scope_id!==projectId||c.project_id!==projectId||c.actor_id!==r.created_by||c.client_id!==r.client_id||c.operation!==request.operation||c.state!=='APPLIED'||Number(c.expected_version)!==0||!Number.isSafeInteger(request.controlGeneration)||request.controlGeneration<1||c.approval_consumption_id!==null||c.payload_ref!==null||!isVersionRef(c.policy_ref)||c.request_hash!==H(request))integrity();
   const result=c.result_ref,data={ref,status:'CAPABILITY_REPORT_RECORDED',snapshot,effectiveForExecution:false,dispatchPerformed:false};
   if(!result||result.status!=='APPLIED'||result.commandId!==request.commandId||result.projectId!==projectId||result.targetId!==id||result.version!==1||!same(result.data,data)||!Array.isArray(result.evidenceRefs)||result.evidenceRefs.length||!Array.isArray(result.warnings)||result.warnings.length||result.serverReceivedAt!==snapshot.recordedAt)integrity();
   const receipts=(await db.query('SELECT * FROM anvil.authorization_receipts WHERE command_id=$1',[c.id])).rows;
   const audits=(await db.query("SELECT * FROM anvil.audit_events WHERE project_id=$1 AND command_id=$2 AND source_kind='HUMAN_COMMAND' AND outcome='APPLIED' AND correction_of IS NULL",[projectId,c.id])).rows;
   const digest=H({projectId,actorId:r.created_by,clientId:r.client_id,controlGeneration:request.controlGeneration,requestHash:H(request),policyRef:c.policy_ref,targetRef:ref});
   if(receipts.length!==1||audits.length!==1)integrity();const receipt=receipts[0],audit=audits[0];
   if(receipt.id!==c.authorization_receipt_id||receipt.scope_kind!=='PROJECT'||receipt.scope_id!==projectId||!same(receipt.subject_ref,{kind:'HUMAN',userId:r.created_by,clientId:r.client_id})||!same(receipt.policy_ref,c.policy_ref)||receipt.scope_digest!==digest||receipt.approval_decision_ref!==null||audit.operation_id!==c.operation_id||result.operationId!==c.operation_id||!same(audit.actor_ref,{kind:'HUMAN',userId:r.created_by})||audit.client_ref!==r.client_id||!same(audit.target_ref,ref)||!same(audit.policy_ref,c.policy_ref)||audit.approval_ref!==null||audit.scope_digest!==digest||audit.reason_code!=='HUMAN_CAPABILITY_CLAIM_ONLY')integrity();
   const es=(await db.query('SELECT project_id,report_id,report_version,capability_code,artifact_id,artifact_hash,bytes,media_type FROM anvil.capability_report_evidence WHERE project_id=$1 AND report_id=$2 ORDER BY capability_code,artifact_id',[projectId,id])).rows;
   const tuples=(values:unknown[])=>values.map(H).sort();
   const expected=claim.capabilities.flatMap(cap=>cap.evidenceRefs.map(a=>({project_id:projectId,report_id:id,report_version:1,capability_code:cap.code,artifact_id:a.artifactId,artifact_hash:a.contentHash,bytes:a.bytes,media_type:a.mediaType})));
   const normalized=es.map(e=>({...e,report_version:Number(e.report_version),bytes:Number(e.bytes)}));if(!same(tuples(normalized),tuples(expected)))integrity();
   return {ref,snapshot,claim,result};
  }catch(error){if(error instanceof AuthFailure&&error.message==='CAPABILITY_REPORT_INTEGRITY_FAILED')throw error;integrity();}
 }
 async command(token:string,csrf:string,request:ProjectCommand){
  try{return await this.#access.authenticated(token,csrf,async(db,actor)=>{
   await currentProjectController(db,actor,request);
   if(request.operation!=='recordCapabilityReport')throw new AuthFailure('PROJECT_OPERATION_DENIED',403);
   if(!actor.reauthUntil||actor.reauthUntil.getTime()<=Date.now())throw new AuthFailure('REAUTHENTICATION_REQUIRED',412);
   const policy=await authorizeMaterial(db,actor,request);
   const current=(expiresAt=Infinity)=>{const now=Date.now();if(!actor.reauthUntil||actor.reauthUntil.getTime()<=now)throw new AuthFailure('REAUTHENTICATION_REQUIRED',412);if(actor.authSession&&[actor.authSession.idleExpiresAt,actor.authSession.absoluteExpiresAt].some(v=>!Number.isFinite(Date.parse(v))||Date.parse(v)<=now))throw new AuthFailure('AUTH_REQUIRED',401);if(policy.validUntil<=now)throw new AuthFailure('PROJECT_OPERATION_DENIED',403);if(expiresAt<=now)throw new AuthFailure('CAPABILITY_REPORT_EXPIRY_EXCEEDED',412);};current();
   if(request.targetId!==null||request.expectedVersion!==0||request.baselineRefs.length)throw new AuthFailure('CAPABILITY_REPORT_INPUT_INVALID',422);
   const replay=await projectReplay(db,actor,request);
   if(replay!==undefined){const ref=(replay as {data?:{ref?:VersionRef}})?.data?.ref;if(!isVersionRef(ref))integrity();const old=await this.#stored(db,actor,request.projectId,ref.id);if(!same(old.ref,ref)||!same(old.result,replay))integrity();current();return replay;}
   const at=(await db.query('SELECT transaction_timestamp() AS at')).rows[0].at as Date;
   let claim=readCapabilityReportClaim(request.payload,{now:at});
   if(Date.parse(claim.expiresAt)>policy.validUntil)throw new AuthFailure('CAPABILITY_REPORT_EXPIRY_EXCEEDED',412);
   for(const [ref,kind]of [[claim.connectionRef,'CONNECTION_CANDIDATE'],[claim.environmentRef,'ENVIRONMENT_CANDIDATE']] as const){
    const head=(await db.query('SELECT kind,head_version FROM anvil.connection_candidates WHERE project_id=$1 AND id=$2 FOR SHARE',[request.projectId,ref.id])).rows[0];if(!head)throw new AuthFailure('NOT_FOUND',404);
    const read=await this.#candidates.read(db,actor,request.projectId,ref.id,ref.version);
    if(head.kind!==kind||read.candidate.kind!==kind||Number(head.head_version)!==ref.version||!same(read.ref,ref))throw new AuthFailure('CAPABILITY_REPORT_BINDING_CONFLICT',409);
    if(Date.parse(read.candidate.input.expiresAt)<=at.getTime()||Date.parse(claim.expiresAt)>Date.parse(read.candidate.input.expiresAt))throw new AuthFailure('CAPABILITY_REPORT_EXPIRY_EXCEEDED',412);
   }
   if(claim.supersedesRef){const old=await this.#stored(db,actor,request.projectId,claim.supersedesRef.id);if(!same(old.ref,claim.supersedesRef)||!same(old.claim.connectionRef,claim.connectionRef)||!same(old.claim.environmentRef,claim.environmentRef))throw new AuthFailure('CAPABILITY_REPORT_BINDING_CONFLICT',409);}
   for(const a of unique(claim))await this.#evidence(db,request.projectId,a);
   current(Date.parse(claim.expiresAt));
   const id=randomUUID(),snapshot=capabilityReportSnapshot(claim,request.projectId,id,actor,at),ref={id,version:1,contentHash:H(snapshot)};
   const receipt=await persistProjectReceipt(db,actor,request,ref,{status:'CAPABILITY_REPORT_RECORDED',snapshot,effectiveForExecution:false,dispatchPerformed:false},policy.ref,'HUMAN_CAPABILITY_CLAIM_ONLY');
   await db.query('INSERT INTO anvil.capability_reports(id,project_id,version,connection_id,connection_version,connection_hash,environment_id,environment_version,environment_hash,claim_json,claim_hash,snapshot_json,content_hash,supersedes_id,supersedes_version,supersedes_hash,created_by,client_id,command_id,created_at) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)',[id,request.projectId,claim.connectionRef.id,claim.connectionRef.version,claim.connectionRef.contentHash,claim.environmentRef.id,claim.environmentRef.version,claim.environmentRef.contentHash,JSON.stringify(claim),H(claim),JSON.stringify(snapshot),ref.contentHash,claim.supersedesRef?.id??null,claim.supersedesRef?.version??null,claim.supersedesRef?.contentHash??null,actor.actorId,actor.clientId,receipt.id,at]);
   for(const cap of claim.capabilities)for(const a of cap.evidenceRefs)await db.query('INSERT INTO anvil.capability_report_evidence(project_id,report_id,report_version,capability_code,artifact_id,artifact_hash,bytes,media_type) VALUES($1,$2,1,$3,$4,$5,$6,$7)',[request.projectId,id,cap.code,a.artifactId,a.contentHash,a.bytes,a.mediaType]);
   current(Date.parse(claim.expiresAt));return receipt.result;
  });}catch(error){await recordProjectDenial(this.#access,token,request.projectId,error);throw error;}
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,id:string,version:number){
  await projectMember(db,actor,projectId);if(version!==1||!isVersionRef({id,version,contentHash:'0'.repeat(64)}))throw new AuthFailure('INPUT_INVALID',400);
  const stored=await this.#stored(db,actor,projectId,id),issues:Array<{code:string;target:null|{kind:string;ref:VersionRef|CapabilityArtifactRef}}>=[];
  const add=(code:string,kind?:string,ref?:VersionRef|CapabilityArtifactRef)=>{const issue={code,target:kind&&ref?{kind,ref}:null};if(!issues.some(i=>same(i,issue)))issues.push(issue);};
  add('CANDIDATE_ONLY');add('HUMAN_CLAIM_UNVERIFIED');
  for(const [ref,kind,prefix]of [[stored.claim.connectionRef,'CONNECTION_CANDIDATE','CONNECTION'],[stored.claim.environmentRef,'ENVIRONMENT_CANDIDATE','ENVIRONMENT']] as const){
   try{const head=(await db.query('SELECT kind,head_version FROM anvil.connection_candidates WHERE project_id=$1 AND id=$2',[projectId,ref.id])).rows[0];
    if(!head||head.kind!==kind||Number(head.head_version)!==ref.version){add(prefix+'_HEAD_CHANGED',kind,ref);continue;}
    const current=await this.#candidates.read(db,actor,projectId,ref.id,ref.version);if(!same(current.ref,ref))add(prefix+'_HEAD_CHANGED',kind,ref);if(current.expired)add(prefix+'_EXPIRED',kind,ref);
   }catch(error){add(error instanceof AuthFailure&&error.statusCode===404?prefix+'_HEAD_CHANGED':'CURRENTNESS_UNAVAILABLE',kind,ref);}
  }
  if(Date.parse(stored.claim.expiresAt)<=Date.now())add('REPORT_EXPIRED','REPORT',stored.ref);
  for(const a of unique(stored.claim))try{await this.#evidence(db,projectId,a);}catch(error){let code='CURRENTNESS_UNAVAILABLE';if(error instanceof AuthFailure){if(error.statusCode===404||error.message==='ARTIFACT_NOT_READY')code='EVIDENCE_UNAVAILABLE';else if(error.message==='ARTIFACT_QUARANTINED')code='EVIDENCE_QUARANTINED';else if(error.message==='ARTIFACT_INTEGRITY_FAILED')code='EVIDENCE_HASH_MISMATCH';}add(code,'ARTIFACT',a);}
  await projectMember(db,actor,projectId);
  return {projectId,ref:stored.ref,snapshot:stored.snapshot,currentnessIssues:issues,effectiveForExecution:false as const,dispatchPerformed:false as const,checkedAt:new Date().toISOString()};
 }
}
