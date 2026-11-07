import type{PoolClient}from'pg';
import{AuthFailure,type AuthenticatedIdentity}from'../access/repository.ts';
import{persistProjectReceipt,projectMember,type ProjectCommand}from'../access/project-command.ts';
import{canonicalJson,contentHash}from'../../../../contracts/canonical.ts';
import type{VersionRef}from'../../../../contracts/generated-types.ts';
import type{ProjectKnowledge}from'./knowledge.ts';
import{constitutionEligibility,readConstitutionApplication}from'./knowledge-state.ts';
import{constitutionRecord,currentConstitutionRecord}from'./constitution-records.ts';
export class ProjectConstitutions{
 #knowledge:ProjectKnowledge;
 constructor(knowledge:ProjectKnowledge){this.#knowledge=knowledge;}
 async apply(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,policyRef:VersionRef){
  const input=readConstitutionApplication(c.payload);
  if(c.targetId!==c.projectId)throw new AuthFailure('CONSTITUTION_INPUT_INVALID',422);
  const previous=await currentConstitutionRecord(db,c.projectId);
  if(c.expectedVersion!==(previous?.ref.version??0)||!Number.isSafeInteger(c.expectedVersion+1))throw new AuthFailure('VERSION_CONFLICT',409);
  const source=await this.#knowledge.read(db,actor,c.projectId,input.versionRef.id,input.versionRef.version);
  if(canonicalJson(source.ref)!==canonicalJson(input.versionRef)||source.confirmation?.eventId!==input.confirmationId)throw new AuthFailure('VERSION_CONFLICT',409);
  const eligibility=constitutionEligibility(source);if(!eligibility.usable)throw new AuthFailure('CONSTITUTION_NOT_CURRENTLY_USABLE',412);
  if(previous&&canonicalJson(previous.application.versionRef)===canonicalJson(source.ref))throw new AuthFailure('CONSTITUTION_ALREADY_APPLIED',409);
  const application={projectId:c.projectId,...input,reviewRef:source.contentReviews[0]!.ref,previousApplicationRef:previous?.ref??null,appliedBy:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId},controlGeneration:c.controlGeneration};
  const ref={id:c.projectId,version:c.expectedVersion+1,contentHash:contentHash(canonicalJson(application))};
  const receipt=await persistProjectReceipt(db,actor,c,ref,{status:'CONSTITUTION_APPLIED',application},policyRef,'EXPLICIT_PROJECT_CONSTITUTION_APPLICATION');
  await db.query('INSERT INTO anvil.constitution_applications(project_id,application_version,content_hash,entry_id,version,confirmation_id,snapshot_json,applied_by,client_id,command_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[c.projectId,ref.version,ref.contentHash,source.ref.id,source.ref.version,input.confirmationId,JSON.stringify(application),actor.actorId,actor.clientId,receipt.id,receipt.result.serverReceivedAt]);
  if(previous)await db.query('UPDATE anvil.project_constitutions SET application_version=$2,application_hash=$3,entry_id=$4,version=$5 WHERE project_id=$1',[c.projectId,ref.version,ref.contentHash,source.ref.id,source.ref.version]);
  else await db.query('INSERT INTO anvil.project_constitutions(project_id,application_version,application_hash,entry_id,version) VALUES($1,$2,$3,$4,$5)',[c.projectId,ref.version,ref.contentHash,source.ref.id,source.ref.version]);
  return receipt.result;
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,pid:string,q:Record<string,unknown>){
  await projectMember(db,actor,pid);
  if(Object.keys(q).some(k=>!['limit','beforeVersion'].includes(k))||q.limit!==undefined&&(typeof q.limit!=='string'||!/^([1-9]|1[0-9]|20)$/.test(q.limit))||q.beforeVersion!==undefined&&(typeof q.beforeVersion!=='string'||!/^[1-9][0-9]{0,14}$/.test(q.beforeVersion)||!Number.isSafeInteger(Number(q.beforeVersion))))throw new AuthFailure('INPUT_INVALID',400);
  const pointer=await currentConstitutionRecord(db,pid),limit=q.limit===undefined?10:Number(q.limit),before=q.beforeVersion===undefined?null:Number(q.beforeVersion);
  let current=null;
  if(pointer){const source=await this.#knowledge.read(db,actor,pid,pointer.application.versionRef.id,pointer.application.versionRef.version);if(canonicalJson(source.ref)!==canonicalJson(pointer.application.versionRef)||source.confirmation?.eventId!==pointer.application.confirmationId)throw new AuthFailure('CONSTITUTION_INTEGRITY_FAILED',503);current={...pointer,source,eligibility:constitutionEligibility(source)};}
  const rows=(await db.query('SELECT application_version FROM anvil.constitution_applications WHERE project_id=$1 AND ($2::bigint IS NULL OR application_version<$2) ORDER BY application_version DESC LIMIT $3',[pid,before,limit+1])).rows;
  const history=[];for(const row of rows.slice(0,limit)){const record=await constitutionRecord(db,pid,Number(row.application_version));if(record.ref.version>1){const prior=await constitutionRecord(db,pid,record.ref.version-1);if(canonicalJson(record.application.previousApplicationRef)!==canonicalJson(prior.ref))throw new AuthFailure('CONSTITUTION_INTEGRITY_FAILED',503);}history.push(record);}
  if(!pointer&&rows.length)throw new AuthFailure('CONSTITUTION_INTEGRITY_FAILED',503);
  return{current,history,hasMore:rows.length>limit,nextBeforeVersion:rows.length>limit?history.at(-1)!.ref.version:null,agentDelivery:'NOT_CONNECTED',compliance:'NOT_ASSESSED',observedAt:new Date().toISOString()};
 }
}
