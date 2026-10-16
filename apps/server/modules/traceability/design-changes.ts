import{randomUUID}from'node:crypto';
import type{PoolClient}from'pg';
import{AuthFailure,type AuthenticatedIdentity}from'../access/repository.ts';
import{persistProjectReceipt,projectMember,type ProjectCommand}from'../access/project-command.ts';
import type{ProjectDocuments}from'../documents/project-documents.ts';
import{ProjectDesignIndex}from'./design-index.ts';
import{ProjectWorkPlans}from'./work-plans.ts';
import{calculateDesignImpact,type ImpactTarget,type ImpactTargetRef}from'./design-impact.ts';
import{exactKeys,planText}from'./work-plan-card.ts';
import{isVersionRef}from'../../../../contracts/references.ts';
import{canonicalJson,contentHash}from'../../../../contracts/canonical.ts';
import type{VersionRef}from'../../../../contracts/generated-types.ts';
const uuid=(id:unknown):id is string=>isVersionRef({id,version:1,contentHash:'0'.repeat(64)});
export class ProjectDesignChanges{
 #documents:ProjectDocuments;#index:ProjectDesignIndex;#plans:ProjectWorkPlans;
 constructor(documents:ProjectDocuments){this.#documents=documents;this.#index=new ProjectDesignIndex(documents);this.#plans=new ProjectWorkPlans(documents);}
 async #source(db:PoolClient,actor:AuthenticatedIdentity,pid:string,ref:VersionRef,proposalId:string,current:boolean){
  const source=await this.#documents.version(db,actor,pid,ref.id,ref.version);if(source.contentHash!==ref.contentHash)throw new AuthFailure('VERSION_CONFLICT',409);
  const code=(await db.query("SELECT definition_json->>'formCode' code FROM anvil.form_versions WHERE definition_id=$1 AND version=$2 AND content_hash=$3",[source.formRef.id,source.formRef.version,source.formRef.contentHash])).rows[0];if(code?.code!=='AF02')throw new AuthFailure('DESIGN_CHANGE_SOURCE_KIND_INVALID',422);
  if(current){const head=(await db.query('SELECT head_version,confirmed_version FROM anvil.documents WHERE project_id=$1 AND id=$2 FOR SHARE',[pid,ref.id])).rows[0];if(Number(head?.head_version)!==ref.version||Number(head?.confirmed_version)!==ref.version||!source.confirmed||!source.validation.validForConfirmation||source.contentReviews[0]?.ref.outcome!=='ACCEPTED')throw new AuthFailure('DESIGN_CHANGE_BASE_NOT_READY',422);}
  const proposal=await this.#documents.proposal(db,actor,pid,proposalId);if(canonicalJson(proposal.baseRef)!==canonicalJson(ref))throw new AuthFailure('DESIGN_CHANGE_PROPOSAL_MISMATCH',409);if(current&&proposal.selections.length)throw new AuthFailure('DESIGN_CHANGE_PROPOSAL_ALREADY_SELECTED',409);return{source,proposal};
 }
 async #impact(db:PoolClient,actor:AuthenticatedIdentity,pid:string,beforeRef:VersionRef,changeRef:VersionRef){
  const index=await this.#index.read(db,actor,pid,beforeRef.id,beforeRef.version),targets:ImpactTarget[]=[],planRefs:VersionRef[]=[],gaps:{code:string}[]=[];
  for(const i of index.items)targets.push({ref:{kind:'DESIGN_ITEM',id:i.id,versionRef:i.documentRef,localCode:i.localCode,anchor:i.anchor},designRefs:[beforeRef],dependencies:[]});
  for(const s of index.screenRegions)targets.push({ref:{kind:'SCREEN_REGION',id:s.id,versionRef:s.documentRef,localCode:s.screenCode,anchor:s.anchor},designRefs:[beforeRef],dependencies:[]});
  const plans=(await db.query('SELECT w.id,w.head_version FROM anvil.work_plans w JOIN anvil.work_plan_versions v ON v.project_id=w.project_id AND v.plan_id=w.id AND v.version=w.head_version WHERE w.project_id=$1 AND v.design_id=$2 AND v.design_version=$3 AND v.design_hash=$4 ORDER BY w.id LIMIT 9',[pid,beforeRef.id,beforeRef.version,beforeRef.contentHash])).rows;
  for(const row of plans.slice(0,8)){const plan=await this.#plans.read(db,actor,pid,row.id,Number(row.head_version));planRefs.push(plan.ref);if(plan.relationalProjection!=='STORED'){gaps.push({code:'PLAN_RELATIONS_NOT_READY'});continue;}const taskRef=(code:string):ImpactTargetRef=>({kind:'PLAN_TASK',id:plan.ref.id,versionRef:plan.ref,localCode:code});for(const t of plan.tasks)targets.push({ref:taskRef(t.taskCode),designRefs:t.designRefs.map((r:any)=>r.versionRef),dependencies:[...new Set<string>([...t.startPrerequisites,...t.acceptancePrerequisites])].map(taskRef)});}
  if(index.status!=='INDEXED')gaps.push({code:'DESIGN_INDEX_NOT_READY'});
  const calculation=calculateDesignImpact(beforeRef,targets,plans.length>8),snapshot={changeRef,...calculation,coverageGaps:[...calculation.coverageGaps,...gaps],inputs:{planRefs,indexedDesign:index.status==='INDEXED'}};
  const ref={id:randomUUID(),version:1,contentHash:contentHash(canonicalJson(snapshot))};return{ref,...snapshot,observedAt:(await db.query('SELECT transaction_timestamp() at')).rows[0].at.toISOString()};
 }
 async propose(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,policyRef:VersionRef){
  const p=c.payload;if(c.targetId!==null||c.expectedVersion!==0||!exactKeys(p,['beforeRef','afterProposalRef','reason','sourceRefs'])||!isVersionRef(p.beforeRef)||!uuid(p.afterProposalRef)||!planText(p.reason)||!p.reason.trim()||!Array.isArray(p.sourceRefs))throw new AuthFailure('DESIGN_CHANGE_INPUT_INVALID',422);if(p.sourceRefs.length)throw new AuthFailure('DESIGN_CHANGE_SOURCE_CONNECTION_PENDING',412);
  await this.#source(db,actor,c.projectId,p.beforeRef,p.afterProposalRef,true);
  if((await db.query('SELECT 1 FROM anvil.design_changes WHERE project_id=$1 AND proposal_id=$2',[c.projectId,p.afterProposalRef])).rowCount)throw new AuthFailure('DESIGN_CHANGE_ALREADY_EXISTS',409);
  const snapshot={beforeRef:p.beforeRef,afterProposalRef:p.afterProposalRef,reason:p.reason,sourceRefs:p.sourceRefs},ref={id:randomUUID(),version:1,contentHash:contentHash(canonicalJson(snapshot))},change={ref,status:'PROPOSED',...snapshot,requestedBy:{kind:'HUMAN',userId:actor.actorId},createdAt:(await db.query('SELECT transaction_timestamp() at')).rows[0].at.toISOString()},impact=await this.#impact(db,actor,c.projectId,p.beforeRef,ref);
  const receipt=await persistProjectReceipt(db,actor,c,ref,{status:'DESIGN_CHANGE_PROPOSED',change,impact,activatedAsBaseline:false},policyRef,'EXPLICIT_DESIGN_CHANGE_PROPOSAL');
  await db.query('INSERT INTO anvil.design_changes(id,project_id,version,before_id,before_version,before_hash,proposal_id,content_hash,change_json,created_by,client_id,command_id) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[ref.id,c.projectId,p.beforeRef.id,p.beforeRef.version,p.beforeRef.contentHash,p.afterProposalRef,ref.contentHash,JSON.stringify(change),actor.actorId,actor.clientId,receipt.id]);
  await db.query("INSERT INTO anvil.design_change_impacts(id,project_id,version,change_id,change_hash,source_kind,content_hash,impact_json,created_by,client_id,command_id) VALUES($1,$2,1,$3,$4,'MECHANICAL_TRACE',$5,$6,$7,$8,$9)",[impact.ref.id,c.projectId,ref.id,ref.contentHash,impact.ref.contentHash,JSON.stringify(impact),actor.actorId,actor.clientId,receipt.id]);return receipt.result;
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string){
  await projectMember(db,actor,pid);const row=(await db.query('SELECT d.*,c.result_ref,c.operation,c.actor_id,c.client_id command_client FROM anvil.design_changes d JOIN anvil.commands c ON c.id=d.command_id AND c.project_id=d.project_id WHERE d.project_id=$1 AND d.id=$2',[pid,id])).rows[0];if(!row)throw new AuthFailure('NOT_FOUND',404);
  const change=row.change_json,{ref,status,requestedBy,createdAt,...snapshot}=change;
  if(status!=='PROPOSED'||!isVersionRef(ref)||ref.id!==id||ref.version!==Number(row.version)||ref.contentHash!==row.content_hash||contentHash(canonicalJson(snapshot))!==row.content_hash||canonicalJson(snapshot.beforeRef)!==canonicalJson({id:row.before_id,version:Number(row.before_version),contentHash:row.before_hash})||snapshot.afterProposalRef!==row.proposal_id||row.operation!=='proposeDesignChange'||row.result_ref?.status!=='APPLIED'||row.result_ref.data?.status!=='DESIGN_CHANGE_PROPOSED'||canonicalJson(row.result_ref.data?.change)!==canonicalJson(change)||canonicalJson(row.result_ref.data?.ref)!==canonicalJson(ref)||requestedBy?.kind!=='HUMAN'||requestedBy.userId!==row.created_by||row.actor_id!==row.created_by||row.command_client!==row.client_id||createdAt!==row.created_at.toISOString())throw new AuthFailure('DESIGN_CHANGE_INTEGRITY_FAILED',503);
  await this.#source(db,actor,pid,snapshot.beforeRef,snapshot.afterProposalRef,false);
  const impacts=(await db.query('SELECT * FROM anvil.design_change_impacts WHERE project_id=$1 AND change_id=$2 ORDER BY version DESC',[pid,id])).rows;const impactVersions=[];
  for(const i of impacts){const impact=i.impact_json,{ref:impactRef,observedAt,...value}=impact;if(!isVersionRef(impactRef)||impactRef.id!==i.id||impactRef.version!==Number(i.version)||impactRef.contentHash!==i.content_hash||contentHash(canonicalJson(value))!==i.content_hash||canonicalJson(value.changeRef)!==canonicalJson(ref)||value.sourceKind!==i.source_kind||i.change_hash!==ref.contentHash||observedAt!==i.created_at.toISOString()||i.command_id!==row.command_id||canonicalJson(row.result_ref.data?.impact)!==canonicalJson(impact))throw new AuthFailure('DESIGN_IMPACT_INTEGRITY_FAILED',503);impactVersions.push(impact);}
  if(impactVersions.length!==1)throw new AuthFailure('DESIGN_IMPACT_INTEGRITY_FAILED',503);
  return{change,impactVersions,activatedAsBaseline:false,observedAt:new Date().toISOString()};
 }
}
