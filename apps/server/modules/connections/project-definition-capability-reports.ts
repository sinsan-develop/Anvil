import {assertEnvironmentConfigurationCapacity} from './project-environment-resources.ts';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {authorizeMaterial,currentProjectController,projectMember,projectReplay,persistProjectReceipt,recordProjectDenial,type ProjectCommand} from '../access/project-command.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import type {ProjectDocuments} from '../documents/project-documents.ts';
import {ProjectConnectionDefinitions} from './project-connection-definitions.ts';
import type {ProjectListCodec} from '../projects/service.ts';
import {readDefinitionCapabilityReportClaim,definitionCapabilityReportSnapshot,type DefinitionCapabilityReportClaim,type CapabilityArtifactRef} from './definition-capability-report-input.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function integrity():never{throw new AuthFailure('CAPABILITY_REPORT_INTEGRITY_FAILED',503);}
const H=(v:unknown)=>contentHash(canonicalJson(v));
const unique=(claim:DefinitionCapabilityReportClaim)=>[...new Map(claim.capabilities.flatMap(c=>c.evidenceRefs).map(a=>[a.artifactId,a])).values()];
export class ProjectDefinitionCapabilityReports {
 #access:AccessRepository;#definitions:Pick<ProjectConnectionDefinitions,'read'>;#documents:Pick<ProjectDocuments,'originalText'>;
 constructor(access:AccessRepository,definitions:Pick<ProjectConnectionDefinitions,'read'>,documents:Pick<ProjectDocuments,'originalText'>){this.#access=access;this.#definitions=definitions;this.#documents=documents;}
 async #evidence(db:PoolClient,projectId:string,ref:CapabilityArtifactRef){
  const row=(await db.query('SELECT id,project_id,state,content_hash,bytes,media_type FROM anvil.artifacts WHERE project_id=$1 AND id=$2',[projectId,ref.artifactId])).rows[0];
  if(!row)throw new AuthFailure('NOT_FOUND',404);
  if(row.state==='QUARANTINED')throw new AuthFailure('ARTIFACT_QUARANTINED',412);
  if(row.content_hash!==ref.contentHash||Number(row.bytes)!==ref.bytes||row.media_type!==ref.mediaType)throw new AuthFailure('ARTIFACT_INTEGRITY_FAILED',503);
  // 실제 원문 검산은 기존 보호 reader만 수행하며 본문은 반환하지 않는다.
  await this.#documents.originalText(db,projectId,ref);
 }
 async #stored(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,id:string){
  const rows=(await db.query('SELECT * FROM anvil.definition_capability_reports WHERE project_id=$1 AND id=$2 AND version=1',[projectId,id])).rows;
  if(!rows.length)throw new AuthFailure('NOT_FOUND',404);if(rows.length!==1)integrity();const r=rows[0];
  try{
   const at=new Date(r.created_at),claim=readDefinitionCapabilityReportClaim(r.claim_json,{now:at});
   const snapshot=definitionCapabilityReportSnapshot(claim,projectId,id,{actorId:r.created_by,clientId:r.client_id},at),ref={id,version:1,contentHash:r.content_hash};
   if(r.project_id!==projectId||Number(r.version)!==1||!isVersionRef(ref)||H(claim)!==r.claim_hash||H(snapshot)!==r.content_hash||!same(snapshot,r.snapshot_json)||!same(claim.connectionRef,{id:r.connection_id,version:Number(r.connection_version),contentHash:r.connection_hash})||!same(claim.environmentRef,r.environment_id===null?null:{id:r.environment_id,version:Number(r.environment_version),contentHash:r.environment_hash})||!same(claim.supersedesRef,r.supersedes_id===null?null:{id:r.supersedes_id,version:Number(r.supersedes_version),contentHash:r.supersedes_hash}))integrity();
   const cs=(await db.query('SELECT * FROM anvil.commands WHERE project_id=$1 AND id=$2',[projectId,r.command_id])).rows;if(cs.length!==1)integrity();const c=cs[0];
   const request:ProjectCommand={schemaVersion:1,projectId,commandId:c.command_id,clientId:r.client_id,controlGeneration:Number(c.control_generation),operation:'recordCapabilityReport',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:claim as unknown as Record<string,unknown>};
   if(c.scope_kind!=='PROJECT'||c.scope_id!==projectId||c.project_id!==projectId||c.actor_id!==r.created_by||c.client_id!==r.client_id||c.operation!==request.operation||c.state!=='APPLIED'||Number(c.expected_version)!==0||!Number.isSafeInteger(request.controlGeneration)||request.controlGeneration<1||c.approval_consumption_id!==null||c.payload_ref!==null||!isVersionRef(c.policy_ref)||c.request_hash!==H(request))integrity();
   if(!same(r.request_json,request)||Number(r.canonical_bytes)!==this.#bytes(claim,snapshot))integrity();
   const result=c.result_ref,data={ref,status:'CAPABILITY_REPORT_RECORDED',snapshot,effectiveForExecution:false,dispatchPerformed:false};
   if(!result||result.status!=='APPLIED'||result.commandId!==request.commandId||result.projectId!==projectId||result.targetId!==id||result.version!==1||!same(result.data,data)||!Array.isArray(result.evidenceRefs)||result.evidenceRefs.length||!Array.isArray(result.warnings)||result.warnings.length||result.serverReceivedAt!==snapshot.recordedAt)integrity();
   const receipts=(await db.query('SELECT * FROM anvil.authorization_receipts WHERE command_id=$1',[c.id])).rows;
   const audits=(await db.query("SELECT * FROM anvil.audit_events WHERE project_id=$1 AND command_id=$2 AND source_kind='HUMAN_COMMAND' AND outcome='APPLIED' AND correction_of IS NULL",[projectId,c.id])).rows;
   const digest=H({projectId,actorId:r.created_by,clientId:r.client_id,controlGeneration:request.controlGeneration,requestHash:H(request),policyRef:c.policy_ref,targetRef:ref});
   if(receipts.length!==1||audits.length!==1)integrity();const receipt=receipts[0],audit=audits[0];
   if(receipt.id!==c.authorization_receipt_id||receipt.scope_kind!=='PROJECT'||receipt.scope_id!==projectId||!same(receipt.subject_ref,{kind:'HUMAN',userId:r.created_by,clientId:r.client_id})||!same(receipt.policy_ref,c.policy_ref)||receipt.scope_digest!==digest||receipt.approval_decision_ref!==null||audit.operation_id!==c.operation_id||result.operationId!==c.operation_id||!same(audit.actor_ref,{kind:'HUMAN',userId:r.created_by})||audit.client_ref!==r.client_id||!same(audit.target_ref,ref)||!same(audit.policy_ref,c.policy_ref)||audit.approval_ref!==null||audit.scope_digest!==digest||audit.reason_code!=='HUMAN_CAPABILITY_CLAIM_ONLY')integrity();
   const es=(await db.query('SELECT project_id,report_id,report_version,capability_code,artifact_id,artifact_hash,bytes,media_type FROM anvil.definition_capability_report_evidence WHERE project_id=$1 AND report_id=$2 ORDER BY capability_code,artifact_id',[projectId,id])).rows;
   const tuples=(values:unknown[])=>values.map(H).sort();
   const expected=claim.capabilities.flatMap(cap=>cap.evidenceRefs.map(a=>({project_id:projectId,report_id:id,report_version:1,capability_code:cap.code,artifact_id:a.artifactId,artifact_hash:a.contentHash,bytes:a.bytes,media_type:a.mediaType})));
   const normalized=es.map(e=>({...e,report_version:Number(e.report_version),bytes:Number(e.bytes)}));if(!same(tuples(normalized),tuples(expected)))integrity();
   return {ref,snapshot,claim,result};
  }catch(error){if(error instanceof AuthFailure&&error.message==='CAPABILITY_REPORT_INTEGRITY_FAILED')throw error;integrity();}
 }
 #bytes(claim:DefinitionCapabilityReportClaim,snapshot:unknown){return Buffer.byteLength(canonicalJson(claim))+Buffer.byteLength(canonicalJson(snapshot))+claim.capabilities.flatMap(c=>c.evidenceRefs.map(a=>Buffer.byteLength(canonicalJson({capabilityCode:c.code,...a})))).reduce((a,b)=>a+b,0);}
 async #capacity(db:PoolClient,actor:AuthenticatedIdentity,pid:string,amount:number){
 const accounts=(await db.query('SELECT * FROM anvil.quota_account($1,$2,$3,$4)',[actor.authSession!.id,actor.actorId,actor.clientId,pid])).rows;
 if(accounts.length!==1||accounts[0].coverage_state!=='VERIFIED')throw new AuthFailure('PROJECT_STORAGE_QUOTA_UNVERIFIED',412);
 const account=accounts[0];if(![account.used_bytes,account.held_bytes].every(v=>/^(0|[1-9][0-9]{0,18})$/.test(String(v))))integrity();
 const rows=(await db.query('SELECT id,canonical_bytes FROM anvil.definition_capability_reports WHERE project_id=$1 ORDER BY id',[pid])).rows;let total=0n;
 for(const row of rows){const stored=await this.#stored(db,actor,pid,row.id);const bytes=this.#bytes(stored.claim,stored.snapshot);if(String(bytes)!==String(row.canonical_bytes))integrity();total+=BigInt(bytes);}
 const configuration=await assertEnvironmentConfigurationCapacity(db,actor,pid,BigInt(amount),'EXISTING_WRITE');let definitionBytes=0n;
 if(configuration.heads>0||configuration.versions>0){definitionBytes=configuration.definitionBytes;if(configuration.reportBytes!==total)integrity();}
 else{const definitions=(await db.query('SELECT connection_id,version,canonical_bytes FROM anvil.connection_definition_versions WHERE project_id=$1 ORDER BY connection_id,version',[pid])).rows;
 for(const row of definitions){const d=await this.#definitions.read(db,actor,pid,row.connection_id,Number(row.version),false);const bytes=Buffer.byteLength(canonicalJson(d.definition));if(String(bytes)!==String(row.canonical_bytes))integrity();definitionBytes+=BigInt(bytes);}}
 if(rows.length+1>10000||total+BigInt(amount)>67108864n||BigInt(account.used_bytes)+BigInt(account.held_bytes)+definitionBytes+total+BigInt(amount)>10737418240n)throw new AuthFailure('CAPABILITY_REPORT_STORAGE_LIMIT_REACHED',429);
 }
 async command(token:string,csrf:string,request:ProjectCommand){
  const started=performance.now(),wallStarted=Date.now();try{return await this.#access.authenticated(token,csrf,async(db,actor)=>{
   await currentProjectController(db,actor,request);
   if(request.operation!=='recordCapabilityReport')throw new AuthFailure('PROJECT_OPERATION_DENIED',403);
   if(!actor.reauthUntil||actor.reauthUntil.getTime()<=Date.now())throw new AuthFailure('REAUTHENTICATION_REQUIRED',412);
   const policy=await authorizeMaterial(db,actor,request);
   const deadline=Math.min(started+30000,started+policy.validUntil-wallStarted,started+(actor.reauthUntil?.getTime()??0)-wallStarted,...[actor.authSession?.idleExpiresAt,actor.authSession?.absoluteExpiresAt].map(v=>started+Date.parse(v??'')-wallStarted));
   const current=async(expiresAt=Infinity)=>{const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at,session=actor.authSession;
    if(!(at instanceof Date)||!session||![session.idleExpiresAt,session.absoluteExpiresAt].every(v=>Number.isFinite(Date.parse(v))&&Date.parse(v)>at.getTime()))throw new AuthFailure('AUTH_REQUIRED',401);
    if(!actor.reauthUntil||!Number.isFinite(actor.reauthUntil.getTime())||actor.reauthUntil.getTime()<=at.getTime())throw new AuthFailure('REAUTHENTICATION_REQUIRED',412);
    if(!Number.isFinite(policy.validUntil)||Math.min(policy.validUntil,expiresAt)<=at.getTime()||!Number.isFinite(deadline)||performance.now()>=Math.min(deadline,started+expiresAt-wallStarted))throw new AuthFailure('CAPABILITY_REPORT_EXPIRY_EXCEEDED',412);
    await currentProjectController(db,actor,request);const next=await authorizeMaterial(db,actor,request,true);if(!same(next.ref,policy.ref))throw new AuthFailure('CAPABILITY_REPORT_BINDING_CONFLICT',409);
   };await current();
   if(request.targetId!==null||request.expectedVersion!==0||request.baselineRefs.length)throw new AuthFailure('CAPABILITY_REPORT_INPUT_INVALID',422);
   const replay=await projectReplay(db,actor,request);
   if(replay!==undefined){const ref=(replay as {data?:{ref?:VersionRef}})?.data?.ref;if(!isVersionRef(ref))integrity();const old=await this.#stored(db,actor,request.projectId,ref.id);if(!same(old.ref,ref)||!same(old.result,replay))integrity();await current();return replay;}
   const at=(await db.query('SELECT transaction_timestamp() AS at')).rows[0].at as Date;
   let claim=readDefinitionCapabilityReportClaim(request.payload,{now:at});
   if(Date.parse(claim.expiresAt)>policy.validUntil)throw new AuthFailure('CAPABILITY_REPORT_EXPIRY_EXCEEDED',412);
   if(claim.environmentRef!==null)throw new AuthFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);
   const definition=await this.#definitions.read(db,actor,request.projectId,claim.connectionRef.id,claim.connectionRef.version,false);
   const heads=(await db.query('SELECT head_version FROM anvil.agent_connections WHERE project_id=$1 AND id=$2',[request.projectId,claim.connectionRef.id])).rows;
   if(heads.length!==1||Number(heads[0].head_version)!==claim.connectionRef.version||!same(definition.ref,claim.connectionRef)||definition.definition.toolProduct!==claim.tool.product||definition.definition.toolVersion!==claim.tool.version||!same(definition.definition.environmentRef,claim.environmentRef))throw new AuthFailure('CAPABILITY_REPORT_BINDING_CONFLICT',409);
   if(claim.supersedesRef){const old=await this.#stored(db,actor,request.projectId,claim.supersedesRef.id);if(!same(old.ref,claim.supersedesRef)||!same(old.claim.connectionRef,claim.connectionRef)||!same(old.claim.environmentRef,claim.environmentRef))throw new AuthFailure('CAPABILITY_REPORT_BINDING_CONFLICT',409);}
   for(const a of unique(claim))await this.#evidence(db,request.projectId,a);
   await current(Date.parse(claim.expiresAt));
   const id=randomUUID(),snapshot=definitionCapabilityReportSnapshot(claim,request.projectId,id,actor,at),ref={id,version:1,contentHash:H(snapshot)};
   await this.#capacity(db,actor,request.projectId,this.#bytes(claim,snapshot));
   const receipt=await persistProjectReceipt(db,actor,request,ref,{status:'CAPABILITY_REPORT_RECORDED',snapshot,effectiveForExecution:false,dispatchPerformed:false},policy.ref,'HUMAN_CAPABILITY_CLAIM_ONLY');
   await db.query('INSERT INTO anvil.definition_capability_reports(id,project_id,version,connection_id,connection_version,connection_hash,environment_id,environment_version,environment_hash,claim_json,claim_hash,snapshot_json,content_hash,supersedes_id,supersedes_version,supersedes_hash,created_by,client_id,command_id,created_at,request_json,canonical_bytes) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)',[id,request.projectId,claim.connectionRef.id,claim.connectionRef.version,claim.connectionRef.contentHash,null,null,null,JSON.stringify(claim),H(claim),JSON.stringify(snapshot),ref.contentHash,claim.supersedesRef?.id??null,claim.supersedesRef?.version??null,claim.supersedesRef?.contentHash??null,actor.actorId,actor.clientId,receipt.id,at,JSON.stringify(request),String(this.#bytes(claim,snapshot))]);
   for(const cap of claim.capabilities)for(const a of cap.evidenceRefs)await db.query('INSERT INTO anvil.definition_capability_report_evidence(project_id,report_id,report_version,capability_code,artifact_id,artifact_hash,bytes,media_type) VALUES($1,$2,1,$3,$4,$5,$6,$7)',[request.projectId,id,cap.code,a.artifactId,a.contentHash,a.bytes,a.mediaType]);
   await current(Date.parse(claim.expiresAt));return receipt.result;
  });}catch(error){const e=error as {code?:unknown;message?:unknown};let safe=error;if(e?.code==='P0001'&&typeof e.message==='string'){if(e.message==='CAPABILITY_REPORT_STORAGE_LIMIT_REACHED')safe=new AuthFailure(e.message,429);else if(e.message==='PROJECT_STORAGE_QUOTA_UNVERIFIED')safe=new AuthFailure(e.message,412);else if(['CAPABILITY_REPORT_INTEGRITY_FAILED','PROJECT_STORAGE_QUOTA_INTEGRITY_FAILED','CONNECTION_DEFINITION_INTEGRITY_FAILED'].includes(e.message))safe=new AuthFailure(e.message,503);}await recordProjectDenial(this.#access,token,request.projectId,safe);throw safe;}
 }
 async list(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,query:Record<string,unknown>,codec:ProjectListCodec){
 await projectMember(db,actor,projectId);
 if(Object.keys(query).some(k=>!['view','limit','cursor','connectionRef'].includes(k))||query.view!=='REGISTERED_DEFINITION_HUMAN_REPORTS'||query.limit!==undefined&&query.limit!=='20'||query.cursor!==undefined&&(typeof query.cursor!=='string'||query.cursor.length>4096)||query.connectionRef!==undefined&&(typeof query.connectionRef!=='string'||query.connectionRef.length>2048))throw new AuthFailure('INPUT_INVALID',400);
 let selected:VersionRef|null=null;if(query.connectionRef!==undefined){try{selected=JSON.parse(query.connectionRef as string);if(!isVersionRef(selected)||canonicalJson(selected)!==query.connectionRef)throw Error();}catch{throw new AuthFailure('INPUT_INVALID',400);}}
 const filter={query:canonicalJson({projectId,view:query.view,connectionRef:selected,order:'created_at,id DESC'}),archived:false,limit:20};let position:{at:string;id:string}|null=null;
 if(query.cursor!==undefined)try{position=codec.read(query.cursor as string,actor.actorId,filter);}catch{throw new AuthFailure('CURSOR_INVALID',400);}
 const rows=(await db.query("SELECT *,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') cursor_at FROM anvil.definition_capability_reports WHERE project_id=$1 AND ($2::uuid IS NULL OR (connection_id=$2 AND connection_version=$3 AND connection_hash=$4)) AND ($5::timestamptz IS NULL OR (created_at,id)<($5::timestamptz,$6::uuid)) ORDER BY created_at DESC,id DESC LIMIT 21",[projectId,selected?.id??null,selected?.version??null,selected?.contentHash??null,position?.at??null,position?.id??null])).rows;
 const items=rows.slice(0,20).map(r=>{const ref={id:r.id,version:1,contentHash:r.content_hash};if(!isVersionRef(ref)||r.project_id!==projectId)integrity();const claim=readDefinitionCapabilityReportClaim(r.claim_json,{now:new Date(r.created_at)});return{ref,connectionRef:claim.connectionRef,environmentRef:claim.environmentRef,tool:claim.tool,expiresAt:claim.expiresAt,recordedAt:new Date(r.created_at).toISOString(),reportedBy:{kind:'HUMAN',userId:r.created_by,clientId:r.client_id},sourceAssurance:'HUMAN_CLAIM',bindingKind:'REGISTERED_DEFINITION_ONLY',integrity:'NOT_RECHECKED'};});
 const last=rows[Math.min(rows.length,20)-1];await projectMember(db,actor,projectId);return{items,hasMore:rows.length>20,nextCursor:rows.length>20?codec.create(actor.actorId,filter,{at:last.cursor_at,id:last.id}):null,observedAt:new Date().toISOString(),effectiveForExecution:false,dispatchPerformed:false};
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,id:string,version:number){
  await projectMember(db,actor,projectId);if(version!==1||!isVersionRef({id,version,contentHash:'0'.repeat(64)}))throw new AuthFailure('INPUT_INVALID',400);
  const stored=await this.#stored(db,actor,projectId,id),issues:Array<{code:string;target:null|{kind:string;ref:VersionRef|CapabilityArtifactRef}}>=[];
  const add=(code:string,kind?:string,ref?:VersionRef|CapabilityArtifactRef)=>{const issue={code,target:kind&&ref?{kind,ref}:null};if(!issues.some(i=>same(i,issue)))issues.push(issue);};
  add('REGISTERED_DEFINITION_ONLY');add('HUMAN_CLAIM_UNVERIFIED');if(stored.claim.environmentRef===null)add('ENVIRONMENT_NOT_DEFINED');
  const ref=stored.claim.connectionRef;
  try{const heads=(await db.query('SELECT head_version FROM anvil.agent_connections WHERE project_id=$1 AND id=$2',[projectId,ref.id])).rows;
   if(heads.length!==1||Number(heads[0].head_version)!==ref.version)add('CONNECTION_HEAD_CHANGED','CONNECTION_DEFINITION',ref);
   else {const current=await this.#definitions.read(db,actor,projectId,ref.id,ref.version,false);if(!same(current.ref,ref))add('CONNECTION_HEAD_CHANGED','CONNECTION_DEFINITION',ref);}
  }catch(error){add(error instanceof AuthFailure&&error.statusCode===404?'CONNECTION_HEAD_CHANGED':'CURRENTNESS_UNAVAILABLE','CONNECTION_DEFINITION',ref);}
  if(Date.parse(stored.claim.expiresAt)<=Date.now())add('REPORT_EXPIRED','REPORT',stored.ref);
  for(const a of unique(stored.claim))try{await this.#evidence(db,projectId,a);}catch(error){let code='CURRENTNESS_UNAVAILABLE';if(error instanceof AuthFailure){if(error.statusCode===404||error.message==='ARTIFACT_NOT_READY')code='EVIDENCE_UNAVAILABLE';else if(error.message==='ARTIFACT_QUARANTINED')code='EVIDENCE_QUARANTINED';else if(error.message==='ARTIFACT_INTEGRITY_FAILED')code='EVIDENCE_HASH_MISMATCH';}add(code,'ARTIFACT',a);}
  await projectMember(db,actor,projectId);
  return {projectId,ref:stored.ref,snapshot:stored.snapshot,currentnessIssues:issues,effectiveForExecution:false as const,dispatchPerformed:false as const,checkedAt:new Date().toISOString()};
 }
}
