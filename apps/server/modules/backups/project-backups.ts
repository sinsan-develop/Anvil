import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {persistProjectReceipt,projectMember,type ProjectCommand} from '../access/project-command.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {ArtifactStore} from '../../storage/artifact-store.ts';
import {assertStoredArtifactReadable} from '../../storage/sensitive-inspection.ts';
import {ProjectListCodec} from '../projects/service.ts';
import {ProjectExportStore} from './project-export-store.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {readExportPayload,exportQuery,exact,omitted,type ExportSelection,type ExportManifest,type ExportJob} from './project-backups-input.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
async function storage<T>(fn:()=>Promise<T>):Promise<T>{try{return await fn();}catch(e){if(e instanceof AuthFailure)throw e;throw new AuthFailure(['42P01','42703','42501'].includes((e as {code?:string})?.code??'')?'EXPORT_STORAGE_NOT_READY':'EXPORT_STORAGE_FAILED',503);}}
export class ProjectBackups {
 private source:ArtifactStore|null;private target:ProjectExportStore|null;private artifactRoot:string|undefined;
 constructor(artifactRoot?:string,exportRoot?:string){this.artifactRoot=artifactRoot;this.source=artifactRoot?new ArtifactStore(artifactRoot):null;this.target=exportRoot?new ProjectExportStore(exportRoot):null;}
 async scope(db:PoolClient,a:AuthenticatedIdentity){await db.query("SELECT set_config('anvil.actor_id',$1,true),set_config('anvil.client_id',$2,true)",[a.actorId,a.clientId]);}
 async current(db:PoolClient,a:AuthenticatedIdentity){const before=performance.now(),at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;notificationSessionDeadline(a,at,before);return at as Date;}
 async ready(db:PoolClient){if(!this.target||!this.source)throw new AuthFailure('EXPORT_STORAGE_UNCONFIGURED',503);if(!(await db.query("SELECT to_regclass('anvil.project_artifact_exports')::text AS storage")).rows[0]?.storage)throw new AuthFailure('EXPORT_STORAGE_NOT_READY',503);}
 async sourceRow(db:PoolClient,pid:string,s:ExportSelection){
  const d=(await db.query('SELECT * FROM anvil.document_versions WHERE project_id=$1 AND document_id=$2 AND version=$3',[pid,s.documentRef.id,s.documentRef.version])).rows[0];
  if(!d)throw new AuthFailure('NOT_FOUND',404);
  const formRef={id:d.form_definition_id,version:Number(d.form_version),contentHash:d.form_hash};
  if(d.content_hash!==s.documentRef.contentHash||contentHash(canonicalJson({title:d.title,formRef,stageNodeRef:d.stage_ref_json,content:d.content_json}))!==d.content_hash)throw new AuthFailure('EXPORT_DOCUMENT_REF_CONFLICT',409);
  const c=d.content_json;if(!c||!Array.isArray(c.attachments)||![c.body,...c.attachments].some(ref=>same(ref,s.artifactRef)))throw new AuthFailure('EXPORT_ARTIFACT_NOT_IN_VERSION',422);
  const a=s.artifactRef,r=(await db.query('SELECT * FROM anvil.artifacts WHERE project_id=$1 AND id=$2 AND content_hash=$3 AND bytes=$4 AND media_type=$5 FOR SHARE',[pid,a.artifactId,a.contentHash,a.bytes,a.mediaType])).rows[0];
  if(!r||r.storage_key!==`blobs/${pid}/${a.artifactId}`)throw new AuthFailure('EXPORT_ARTIFACT_INTEGRITY_FAILED',503);
  return r;
 }
 async create(db:PoolClient,a:AuthenticatedIdentity,c:ProjectCommand,policyRef:VersionRef,deadline:number){return storage(async()=>{
  const p=readExportPayload(c.payload);if(c.operation!=='exportProject'||c.targetId!==null||c.expectedVersion!==0||c.approvalRef!==null||c.baselineRefs.length)throw new AuthFailure('EXPORT_INPUT_INVALID',422);
  await this.ready(db);this.target!.check(deadline);
  const row=await this.sourceRow(db,c.projectId,p.selection),bytes=await this.source!.read(c.projectId,p.selection.artifactRef.artifactId,p.selection.artifactRef);assertStoredArtifactReadable(row,bytes);this.target!.check(deadline);
  const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date))throw new AuthFailure('EXPORT_STORAGE_FAILED',503);
  const id=randomUUID(),manifest:ExportManifest={schemaVersion:1,kind:'SELECTED_DOCUMENT_ARTIFACT_EXPORT',projectId:c.projectId,includeSource:false,selection:p.selection,files:[{artifactRef:p.selection.artifactRef,downloadName:p.selection.artifactRef.artifactId+'.bin'}],omitted,createdAt:at.toISOString(),createdBy:{kind:'HUMAN',userId:a.actorId}},ref={id,version:1,contentHash:contentHash(canonicalJson(manifest))};
  await this.target!.copy(this.artifactRoot!,c.projectId,id,p.selection.artifactRef,manifest,deadline);
  // 파일 복사는 DB transaction과 원자적이지 않다. 실패·COMMIT 불명 사본은 보존한다.
  const receipt=await persistProjectReceipt(db,a,c,ref,{status:'EXPORT_STORED'},policyRef,'EXPLICIT_SELECTED_DOCUMENT_ARTIFACT_EXPORT');
  await db.query('INSERT INTO anvil.project_artifact_exports(id,project_id,document_id,document_version,document_content_hash,artifact_id,artifact_content_hash,actor_id,client_id,command_id,manifest_json,content_hash,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[id,c.projectId,p.selection.documentRef.id,p.selection.documentRef.version,p.selection.documentRef.contentHash,p.selection.artifactRef.artifactId,p.selection.artifactRef.contentHash,a.actorId,a.clientId,receipt.id,JSON.stringify(manifest),ref.contentHash,at]);
  this.target!.check(deadline);return receipt.result;
 });}
 async job(db:PoolClient,a:AuthenticatedIdentity,pid:string,row:Record<string,any>):Promise<ExportJob>{
  const m=row.manifest_json as ExportManifest,ref={id:row.id,version:1,contentHash:row.content_hash};
  try{if(!exact(m,['schemaVersion','kind','projectId','includeSource','selection','files','omitted','createdAt','createdBy'])||m.schemaVersion!==1||m.kind!=='SELECTED_DOCUMENT_ARTIFACT_EXPORT'||m.projectId!==pid||m.includeSource!==false||!same(m.omitted,omitted)||m.createdAt!==row.created_at.toISOString()||!same(m.createdBy,{kind:'HUMAN',userId:row.actor_id})||m.selection.documentRef.id!==row.document_id||m.selection.documentRef.version!==Number(row.document_version)||m.selection.documentRef.contentHash!==row.document_content_hash||m.selection.artifactRef.artifactId!==row.artifact_id||m.selection.artifactRef.contentHash!==row.artifact_content_hash||m.files.length!==1||!same(m.files[0],{artifactRef:m.selection.artifactRef,downloadName:row.artifact_id+'.bin'})||contentHash(canonicalJson(m))!==ref.contentHash)throw Error();readExportPayload({includeSource:false,selection:m.selection,reason:'stored'});
   const command=(await db.query("SELECT c.*,r.subject_ref FROM anvil.commands c JOIN anvil.authorization_receipts r ON r.id=c.authorization_receipt_id AND r.command_id=c.id WHERE c.id=$1 AND c.project_id=$2",[row.command_id,pid])).rows[0];
   if(!command||command.scope_kind!=='PROJECT'||command.operation!=='exportProject'||command.state!=='APPLIED'||command.actor_id!==row.actor_id||command.client_id!==row.client_id||!same(command.subject_ref,{kind:'HUMAN',userId:row.actor_id,clientId:row.client_id})||command.result_ref?.projectId!==pid||command.result_ref?.status!=='APPLIED'||command.result_ref?.data?.status!=='EXPORT_STORED'||!same(command.result_ref?.data?.ref,ref))throw Error();
  }catch{throw new AuthFailure('EXPORT_INTEGRITY_FAILED',503);}
  const source=await this.sourceRow(db,pid,m.selection);let sourceAvailability:'READY'|'BLOCKED'='READY';
  // DB 귀속·격리만 대조한다. 원본 물리 파일 소실은 별도 보관 사본을 막지 않는다.
  if(source.state!=='READY'||source.inspection_json!=null&&source.inspection_json.state!=='NO_KNOWN_MARKER')sourceAvailability='BLOCKED';
  return{ref,manifest:m,sourceAvailability};
 }
 async read(db:PoolClient,a:AuthenticatedIdentity,pid:string,id:string){return storage(async()=>{await projectMember(db,a,pid,true);await this.scope(db,a);await this.ready(db);const row=(await db.query('SELECT * FROM anvil.project_artifact_exports WHERE project_id=$1 AND id=$2',[pid,id])).rows[0];if(!row)throw new AuthFailure('NOT_FOUND',404);const value=await this.job(db,a,pid,row);await this.current(db,a);return value;});}
 async list(db:PoolClient,a:AuthenticatedIdentity,pid:string,q:Record<string,unknown>,codec:ProjectListCodec){return storage(async()=>{
  await projectMember(db,a,pid,true);await this.scope(db,a);await this.ready(db);const input=exportQuery(q),filter={query:canonicalJson({projectId:pid,view:'SELECTED_ARTIFACT_EXPORTS'}),archived:false,limit:input.limit};let pos:{at:string;id:string}|null=null;if(input.cursor)try{pos=codec.read(input.cursor,a.actorId,filter);}catch{throw new AuthFailure('CURSOR_INVALID',400);}
  const rows=(await db.query(`SELECT *,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') cursor_at FROM anvil.project_artifact_exports WHERE project_id=$1 AND ($2::timestamptz IS NULL OR (created_at,id)<($2::timestamptz,$3::uuid)) ORDER BY created_at DESC,id DESC LIMIT $4`,[pid,pos?.at??null,pos?.id??null,input.limit+1])).rows,items:ExportJob[]=[];for(const r of rows)items.push(await this.job(db,a,pid,r));const hasMore=rows.length>input.limit,last=rows.slice(0,input.limit).at(-1),at=await this.current(db,a);
  return{items:items.slice(0,input.limit),hasMore,nextCursor:hasMore?codec.create(a.actorId,filter,{at:last.cursor_at,id:last.id},at):null,observedAt:at.toISOString(),baselineVersion:null};
 });}
 async file(db:PoolClient,a:AuthenticatedIdentity,pid:string,id:string,deadline:number){const j=await this.read(db,a,pid,id);if(j.sourceAvailability!=='READY')throw new AuthFailure('EXPORT_SOURCE_BLOCKED',412);const bytes=await this.target!.read(pid,id,j.manifest.selection.artifactRef,deadline);const source=await this.sourceRow(db,pid,j.manifest.selection);assertStoredArtifactReadable(source,bytes);return{bytes,name:j.manifest.files[0].downloadName};}
}
