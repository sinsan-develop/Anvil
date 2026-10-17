import {randomUUID} from 'node:crypto';import type {PoolClient} from 'pg';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {authorizeMaterial,currentProjectController,persistProjectReceipt,projectMember,projectReplay,recordProjectDenial,type ProjectCommand} from '../access/project-command.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';import {isVersionRef} from '../../../../contracts/references.ts';
import {readSourceRootInput,readRootDeclaration,sourceRootSnapshot,sourceRootOperations,type SourceRootSnapshot} from './source-root-input.ts';
import {readTrustListQuery} from './project-registration-reads.ts';import type {ProjectListCodec} from '../projects/service.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),uuid=(id:unknown)=>isVersionRef({id,version:1,contentHash:'0'.repeat(64)});
export class ProjectSourceRoots{
 readonly access:AccessRepository;constructor(access:AccessRepository){this.access=access;}
 async command(token:string,csrf:string,request:ProjectCommand){try{return await this.access.authenticated(token,csrf,async(db,actor)=>{
  await currentProjectController(db,actor,request);
  if(!(sourceRootOperations as readonly string[]).includes(request.operation))throw new AuthFailure('SOURCE_ROOT_OPERATION_INVALID',412);
  if(!actor.reauthUntil||actor.reauthUntil.getTime()<=Date.now())throw new AuthFailure('REAUTHENTICATION_REQUIRED',412);
  if(request.approvalRef!==null)throw new AuthFailure('SOURCE_ROOT_APPROVAL_NOT_CONNECTED',412);
  const policy=await authorizeMaterial(db,actor,request);
  if(request.baselineRefs.length)throw new AuthFailure('REFERENCE_CONNECTION_PENDING',412);
  const previous=await projectReplay(db,actor,request);
  if(previous!==undefined){const receipt=previous as any,r=receipt?.data?.ref;if(!isVersionRef(r))throw new AuthFailure('SOURCE_ROOT_INTEGRITY_FAILED',503);const stored=await this.#record(db,request.projectId,r.id,r.version);if(!same(stored.ref,r)||!same(stored.snapshot,receipt.data.snapshot))throw new AuthFailure('SOURCE_ROOT_INTEGRITY_FAILED',503);return previous;}
  const input=readSourceRootInput(request.operation,request.payload);let id:string,version:number,old:Awaited<ReturnType<ProjectSourceRoots['read']>>|null=null;
  if(request.operation==='saveSourceRoot'){if(request.targetId!==null||request.expectedVersion!==0||input.baseRef!==null)throw new AuthFailure('SOURCE_ROOT_VERSION_CONFLICT',409);id=randomUUID();version=1;}
  else{
   if(!uuid(request.targetId)||!input.baseRef||input.baseRef.id!==request.targetId||input.baseRef.version!==request.expectedVersion)throw new AuthFailure('SOURCE_ROOT_VERSION_CONFLICT',409);
   const head=(await db.query('SELECT head_version FROM anvil.source_roots WHERE project_id=$1 AND id=$2 FOR UPDATE',[request.projectId,request.targetId])).rows[0];if(!head)throw new AuthFailure('NOT_FOUND',404);
   if(Number(head.head_version)!==request.expectedVersion)throw new AuthFailure('SOURCE_ROOT_VERSION_CONFLICT',409);
   old=await this.read(db,actor,request.projectId,request.targetId,request.expectedVersion);
   if(!old.rawAllowed||!same(old.ref,input.baseRef)||old.status==='REVOKED')throw new AuthFailure('SOURCE_ROOT_VERSION_CONFLICT',409);
   id=request.targetId!;version=request.expectedVersion+1;if(!Number.isSafeInteger(version))throw new AuthFailure('SOURCE_ROOT_VERSION_CONFLICT',409);
  }
  const snapshot=sourceRootSnapshot(input,old?.rawAllowed?old.snapshot.declaration:undefined),connectorId=snapshot.declaration.connectorId;
  if(connectorId!==null&&request.operation!=='revokeSourceRoot'){
   const row=(await db.query("SELECT c.id FROM anvil.connectors c JOIN anvil.connector_registrations r ON r.project_id=c.project_id AND r.connector_id=c.id WHERE c.project_id=$1 AND c.id=$2 AND c.status='TRUSTED' AND c.revoked_at IS NULL AND anvil.connector_basis_current(r.id,false)",[request.projectId,connectorId])).rows[0];if(!row)throw new AuthFailure('SOURCE_ROOT_CONNECTOR_UNAVAILABLE',412);
  }
  const ref={id,version,contentHash:contentHash(canonicalJson(snapshot))},protectedRef=`db-source-root-version:${id}:${version}`;
  const receipt=await persistProjectReceipt(db,actor,request,ref,{status:'SOURCE_ROOT_VERSION_STORED',snapshot,previousRef:input.baseRef,protectedRef},policy.ref,'EXPLICIT_UNVERIFIED_SOURCE_ROOT');
  if(version===1)await db.query('INSERT INTO anvil.source_roots(project_id,id,head_version,created_by,client_id) VALUES($1,$2,1,$3,$4)',[request.projectId,id,actor.actorId,actor.clientId]);
  else await db.query('UPDATE anvil.source_roots SET head_version=$3 WHERE project_id=$1 AND id=$2',[request.projectId,id,version]);
  await db.query('INSERT INTO anvil.source_root_versions(project_id,root_id,version,content_hash,declaration_json,status,authority,readiness,reason,actor_id,client_id,command_id,connector_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[request.projectId,id,version,ref.contentHash,JSON.stringify(snapshot.declaration),snapshot.status,snapshot.authority,snapshot.readiness,snapshot.reason,actor.actorId,actor.clientId,receipt.id,connectorId]);
  return receipt.result;
 });}catch(e){await recordProjectDenial(this.access,token,request.projectId,e);throw e;}}
 async #record(db:PoolClient,pid:string,id:string,version:number){
  if(!uuid(id)||!Number.isSafeInteger(version)||version<1)throw new AuthFailure('INPUT_INVALID',400);
  const row=(await db.query('SELECT v.*,r.head_version,c.result_ref,c.operation,c.state,c.expected_version,c.actor_id command_actor,c.client_id command_client FROM anvil.source_root_versions v JOIN anvil.source_roots r ON r.project_id=v.project_id AND r.id=v.root_id JOIN anvil.commands c ON c.project_id=v.project_id AND c.id=v.command_id WHERE v.project_id=$1 AND v.root_id=$2 AND v.version=$3',[pid,id,version])).rows[0];if(!row)throw new AuthFailure('NOT_FOUND',404);
  const snapshot={declaration:row.declaration_json,status:row.status,authority:row.authority,readiness:row.readiness,reason:row.reason} as SourceRootSnapshot,ref={id,version,contentHash:row.content_hash},data=row.result_ref?.data;
  try{
   if(snapshot.authority!=='USER_DECLARED'||snapshot.readiness!=='UNVERIFIED'||!['DECLARED','REVOKED'].includes(snapshot.status)||Number(row.head_version)<version||row.state!=='APPLIED'||row.result_ref.status!=='APPLIED'||row.command_actor!==row.actor_id||row.command_client!==row.client_id||Number(row.expected_version)!==version-1||data?.status!=='SOURCE_ROOT_VERSION_STORED'||!same(data.ref,ref)||!same(data.snapshot,snapshot)||contentHash(canonicalJson(snapshot))!==ref.contentHash||data.protectedRef!==`db-source-root-version:${id}:${version}`||row.connector_id!==snapshot.declaration.connectorId)throw Error();
   readRootDeclaration(snapshot.declaration);
   const input=readSourceRootInput(row.operation,row.operation==='revokeSourceRoot'?{baseRef:data.previousRef,reason:snapshot.reason}:{declaration:snapshot.declaration,baseRef:data.previousRef,reason:snapshot.reason});
   if(!same(sourceRootSnapshot(input,snapshot.declaration),snapshot)||version===1&&(row.operation!=='saveSourceRoot'||data.previousRef!==null)||version>1&&row.operation==='saveSourceRoot')throw Error();
   if(version>1){const old=(await db.query('SELECT content_hash,declaration_json,status FROM anvil.source_root_versions WHERE project_id=$1 AND root_id=$2 AND version=$3',[pid,id,version-1])).rows[0];if(!old||old.status!=='DECLARED'||!same(data.previousRef,{id,version:version-1,contentHash:old.content_hash})||row.operation==='revokeSourceRoot'&&!same(snapshot.declaration,old.declaration_json))throw Error();}
  }catch{throw new AuthFailure('SOURCE_ROOT_INTEGRITY_FAILED',503);}
  return{ref,snapshot,headVersion:Number(row.head_version),recordedBy:row.actor_id as string,recordedAt:(row.created_at as Date).toISOString(),protectedRef:data.protectedRef as string};
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string,version:number){const member=await projectMember(db,actor,pid),value=await this.#record(db,pid,id,version);const shared={projectId:pid,ref:value.ref,headVersion:value.headVersion,displayName:value.snapshot.declaration.displayName,status:value.snapshot.status,authority:'USER_DECLARED' as const,readiness:'UNVERIFIED' as const,executionAuthorized:false as const};return member.participation==='OWNER'?{...shared,rawAllowed:true as const,snapshot:value.snapshot,recordedBy:value.recordedBy,recordedAt:value.recordedAt,protectedRef:value.protectedRef}:{...shared,rawAllowed:false as const};}
 async list(db:PoolClient,actor:AuthenticatedIdentity,pid:string,query:Record<string,unknown>,codec:ProjectListCodec){const member=await projectMember(db,actor,pid),{limit,cursor}=readTrustListQuery(query),filter={query:canonicalJson({view:'SOURCE_ROOT_DECLARATIONS',projectId:pid,participation:member.participation}),archived:false,limit};let position:{at:string;id:string}|null=null;
  if(cursor!==null){try{position=codec.read(cursor,actor.actorId,filter);}catch{throw new AuthFailure('CURSOR_INVALID',400);}}
  const rows=(await db.query("SELECT id,head_version,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') cursor_at FROM anvil.source_roots WHERE project_id=$1 AND ($2::timestamptz IS NULL OR (created_at,id)<($2::timestamptz,$3::uuid)) ORDER BY created_at DESC,id DESC LIMIT $4",[pid,position?.at??null,position?.id??null,limit+1])).rows;
  const items=[];for(const row of rows.slice(0,limit)){const r=await this.#record(db,pid,row.id,Number(row.head_version));items.push({ref:r.ref,displayName:r.snapshot.declaration.displayName,status:r.snapshot.status,authority:'USER_DECLARED' as const,readiness:'UNVERIFIED' as const,executionAuthorized:false as const});}
  const hasMore=rows.length>limit,last=rows.slice(0,limit).at(-1);return{view:'SOURCE_ROOT_DECLARATIONS' as const,items,hasMore,nextCursor:hasMore?codec.create(actor.actorId,filter,{at:last!.cursor_at,id:last!.id}):null,observedAt:new Date().toISOString()};
 }
}
