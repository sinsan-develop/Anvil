import {randomUUID} from 'node:crypto';import type {PoolClient} from 'pg';
import {canonicalJson} from '../../../../contracts/canonical.ts';import {encodeCommonSetupProjection,copyCommonSetupData,setupUuid,type ProjectSetupCopy,type SetupRef,type SetupSlot} from '../../../../contracts/runtime/user-common-setup-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';import {commonSetupHash} from '../user-common-setup/input.ts';import {resolveDraftSetupSelection} from './draft-common-setup.ts';
export interface ProjectSetupCopyRef extends SetupRef{slot:SetupSlot}
/** 호출자는 기존 createProject 인증 Tx/원 command를 소유한다. 여기서 별도 COMMIT/외부 효과를 만들지 않는다. */
export async function writeProjectSetupCopies(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,serverCommandId:string,selection:unknown):Promise<ProjectSetupCopyRef[]>{
 if(selection===undefined)return[];if(!setupUuid(projectId)||!setupUuid(serverCommandId))throw new AuthFailure('PROJECT_SETUP_INPUT_INVALID',422);
 const prepared=await resolveDraftSetupSelection(db,actor,selection);const refs:ProjectSetupCopyRef[]=[];
 for(const source of prepared!.sources){const snapshot:ProjectSetupCopy={id:randomUUID(),projectId,slot:source.slot,sourceRef:{...source.ref},sourceOwnerUserId:actor.actorId,definitionSnapshot:copyCommonSetupData(source.snapshot.definition),status:'UNBOUND'},hash=commonSetupHash(snapshot);
 await db.query('INSERT INTO anvil.project_setup_copies(project_id,id,slot,source_owner_user_id,source_id,source_version,source_hash,content_hash,snapshot_json,creation_command_id,snapshot_canonical) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[projectId,snapshot.id,snapshot.slot,actor.actorId,source.ref.id,source.ref.version,source.ref.contentHash,hash,JSON.stringify(encodeCommonSetupProjection(snapshot,canonicalJson)),serverCommandId,canonicalJson(snapshot)]);
 refs.push({id:snapshot.id,version:1,contentHash:hash,slot:snapshot.slot});}
 return refs;
}
/** 기존 원자 생성/원 artifact 비용 채택 이후에 실제 DB collector를 소비한다. */
export async function settleProjectSetupCopies(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,serverCommandId:string){
 const session=actor.authSession;if(!session||!setupUuid(projectId)||!setupUuid(serverCommandId))throw new AuthFailure('PROJECT_SETUP_STORAGE_INTEGRITY_FAILED',503);
 const commands=(await db.query('SELECT id,result_ref FROM anvil.commands WHERE project_id=$1 AND id=$2',[projectId,serverCommandId])).rows;if(commands.length!==1||commands[0].id!==serverCommandId||commands[0].result_ref?.id!==projectId)throw new AuthFailure('PROJECT_SETUP_STORAGE_INTEGRITY_FAILED',503);
 const rows=(await db.query('SELECT anvil.fn75_settle_project_setup($1,$2,$3,$4,$5,$6) AS complete',[session.id,actor.actorId,actor.clientId,projectId,serverCommandId,canonicalJson(commands[0].result_ref)])).rows;
 if(rows.length!==1||rows[0].complete!==true)throw new AuthFailure('PROJECT_SETUP_STORAGE_INTEGRITY_FAILED',503);
}

import {projectMember,authorizeMaterial,type ProjectCommand} from '../access/project-command.ts';
import {decodeCommonSetupProjection,readCommonSetupDefinition,setupRecord,setupRef} from '../../../../contracts/runtime/user-common-setup-v1.ts';
export class ProjectSetupCopies{
 async read(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,id:string,version:number){
 if(!setupUuid(projectId)||!setupUuid(id)||version!==1)throw new AuthFailure('INPUT_INVALID',400);await projectMember(db,actor,projectId);
 const policy=await authorizeMaterial(db,actor,{operation:'readProjectSetupCopy',projectId,clientId:actor.clientId,approvalRef:null} as ProjectCommand,true);if(policy.approvalRequired)throw new AuthFailure('PROJECT_SETUP_READ_APPROVAL_NOT_CONNECTED',412);
 const session=actor.authSession;if(!session)throw new AuthFailure('AUTH_REQUIRED',401);
 const current=()=>{const until=Math.min(Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt));if(!Number.isFinite(until)||until<=Date.now())throw new AuthFailure('AUTH_REQUIRED',401);if(!Number.isFinite(policy.validUntil)||policy.validUntil<=Date.now())throw new AuthFailure('PROJECT_OPERATION_DENIED',403);};current();
 const rows=(await db.query('SELECT anvil.fn75_project_setup_copy($1,$2,$3,$4,$5) AS value',[session.id,actor.actorId,actor.clientId,projectId,id])).rows;
 if(rows.length!==1||!rows[0].value)throw new AuthFailure('NOT_FOUND',404);const value=rows[0].value;let copy:ProjectSetupCopy;
 try{copy=decodeCommonSetupProjection(value.copy_json,canonicalJson);if(!setupRecord(copy,['id','projectId','slot','sourceRef','sourceOwnerUserId','definitionSnapshot','status'])||copy.id!==id||copy.projectId!==projectId||copy.status!=='UNBOUND'||!['COORDINATOR_TOOL','CODING_TOOL','ENVIRONMENT'].includes(copy.slot)||!setupUuid(copy.sourceOwnerUserId)||!setupRef(copy.sourceRef)||canonicalJson(readCommonSetupDefinition(copy.slot==='ENVIRONMENT'?'ENVIRONMENT':'TOOL',copy.definitionSnapshot))!==canonicalJson(copy.definitionSnapshot)||value.snapshot_canonical!==canonicalJson(copy)||!setupRef(value.ref)||value.ref.id!==id||value.ref.version!==1||value.ref.contentHash!==commonSetupHash(copy))throw Error();}catch{throw new AuthFailure('PROJECT_SETUP_INTEGRITY_FAILED',503);}
 current();return{projectId,ref:value.ref as SetupRef,copy,observedAt:new Date().toISOString(),readiness:'UNBOUND' as const,executionAuthorized:false as const};
 }
}

export async function readProjectSetupCopyRefs(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,expected:unknown):Promise<ProjectSetupCopyRef[]|undefined>{
 if(expected===undefined)return undefined;
 const valid=(value:unknown):value is ProjectSetupCopyRef[]=>Array.isArray(value)&&value.length<=3&&value.every(v=>setupRecord(v,['id','version','contentHash','slot'])&&setupRef({id:v.id,version:v.version,contentHash:v.contentHash})&&v.version===1&&['COORDINATOR_TOOL','CODING_TOOL','ENVIRONMENT'].includes(v.slot))&&new Set(value.map(v=>v.id)).size===value.length&&new Set(value.map(v=>v.slot)).size===value.length;
 if(!valid(expected)||!actor.authSession)throw new AuthFailure('PROJECT_SETUP_INTEGRITY_FAILED',503);
 const current=()=>{const until=Math.min(Date.parse(actor.authSession!.idleExpiresAt),Date.parse(actor.authSession!.absoluteExpiresAt));if(!Number.isFinite(until)||until<=Date.now())throw new AuthFailure('AUTH_REQUIRED',401);};current();
 const rows=(await db.query('SELECT anvil.fn75_project_setup_refs($1,$2,$3,$4) AS value',[actor.authSession.id,actor.actorId,actor.clientId,projectId])).rows;
 if(rows.length!==1||!valid(rows[0].value)||canonicalJson(rows[0].value)!==canonicalJson(expected))throw new AuthFailure('PROJECT_SETUP_INTEGRITY_FAILED',503);current();return rows[0].value;
}
