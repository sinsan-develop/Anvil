import{AuthFailure}from'../access/repository.ts';
import{canonicalJson}from'../../../../contracts/canonical.ts';
import{isVersionRef}from'../../../../contracts/references.ts';
import type{VersionRef}from'../../../../contracts/generated-types.ts';
import{exactKeys,planText}from'./work-plan-card.ts';
import{randomUUID}from'node:crypto';
import type{PoolClient}from'pg';
import type{AuthenticatedIdentity}from'../access/repository.ts';
import{persistProjectReceipt,type ProjectCommand}from'../access/project-command.ts';
export const workPlanReviewCriteria=Object.freeze({criteriaVersion:1,items:Object.freeze([
 {criterionId:'PLAN_SCOPE',title:'업무 단위와 포함·제외 범위가 분명한가'},
 {criterionId:'PLAN_TRACE',title:'정확한 설계·화면·계획 원문에 연결되는가'},
 {criterionId:'PLAN_DEPENDENCIES',title:'착수·연결검수 선행과 담당이 빠짐없이 분리됐는가'},
 {criterionId:'PLAN_TESTS',title:'정상·중요 실패·직접 영향 검사와 검수 증거가 구체적인가'},
 {criterionId:'PLAN_RECOVERY',title:'중단·복구·변경 이력과 미확인 범위를 보존하는가'},
])});
export type WorkPlanReviewOutcome='ACCEPTED'|'REWORK'|'BLOCKED'|'NOT_EXECUTED';
export interface WorkPlanReviewInput{targetKind:'WORK_PLAN';targetRef:VersionRef;criteriaVersion:1;items:{criterionId:string;outcome:WorkPlanReviewOutcome;evidenceRefs:never[];reason:string}[];outcome:WorkPlanReviewOutcome;reason:string}
export interface WorkPlanReviewRef{id:string;targetRef:VersionRef;criteriaVersion:1;outcome:WorkPlanReviewOutcome}
export function readWorkPlanReviewInput(value:unknown,ref:VersionRef):WorkPlanReviewInput{
 const outcomes=['ACCEPTED','REWORK','BLOCKED','NOT_EXECUTED'],reason=(v:unknown)=>planText(v)&&!!v.trim();
 if(!exactKeys(value,['targetKind','targetRef','criteriaVersion','items','outcome','reason'])||value.targetKind!=='WORK_PLAN'||!isVersionRef(value.targetRef)||canonicalJson(value.targetRef)!==canonicalJson(ref)||value.criteriaVersion!==1||!Array.isArray(value.items)||value.items.length!==workPlanReviewCriteria.items.length||!outcomes.includes(String(value.outcome))||!reason(value.reason))throw new AuthFailure('WORK_PLAN_REVIEW_INPUT_INVALID',422);
 const expected=new Set(workPlanReviewCriteria.items.map(i=>i.criterionId)),seen=new Set<string>();
 for(const i of value.items){if(!exactKeys(i,['criterionId','outcome','evidenceRefs','reason'])||typeof i.criterionId!=='string'||!expected.has(i.criterionId)||seen.has(i.criterionId)||!outcomes.includes(String(i.outcome))||!reason(i.reason)||!Array.isArray(i.evidenceRefs))throw new AuthFailure('WORK_PLAN_REVIEW_INPUT_INVALID',422);if(i.evidenceRefs.length)throw new AuthFailure('REVIEW_EVIDENCE_CONNECTION_PENDING',412);seen.add(i.criterionId);}
 if(value.outcome==='ACCEPTED'&&value.items.some(i=>i.outcome!=='ACCEPTED'))throw new AuthFailure('WORK_PLAN_REVIEW_INCOMPLETE',422);
 return structuredClone(value)as unknown as WorkPlanReviewInput;
}
export function acceptedWorkPlanReviews(ref:VersionRef,value:unknown,records:{ref:unknown}[]):WorkPlanReviewRef[]{
 if(!Array.isArray(value)||!value.length||value.length>200)throw new AuthFailure('CONTENT_REVIEW_REQUIRED',422);
 const seen=new Set<string>();for(const r of value){if(!exactKeys(r,['id','targetRef','criteriaVersion','outcome'])||typeof r.id!=='string'||seen.has(r.id)||r.criteriaVersion!==1||r.outcome!=='ACCEPTED'||!isVersionRef(r.targetRef)||canonicalJson(r.targetRef)!==canonicalJson(ref)||!records.some(record=>canonicalJson(record.ref)===canonicalJson(r)))throw new AuthFailure('CONTENT_REVIEW_REQUIRED',422);seen.add(r.id);}
 const latest=records[0]?.ref as WorkPlanReviewRef|undefined;
 if(!latest||latest.outcome!=='ACCEPTED'||!seen.has(latest.id))throw new AuthFailure('CONTENT_REVIEW_REQUIRED',422);
 return structuredClone(value)as WorkPlanReviewRef[];
}
export async function writeWorkPlanReview(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,policyRef:VersionRef,ref:VersionRef,recorderId:string){
 const p=readWorkPlanReviewInput(c.payload,ref);if(c.targetId!==ref.id||c.expectedVersion!==ref.version)throw new AuthFailure('WORK_PLAN_REVIEW_INPUT_INVALID',422);
 const reviewRef={id:randomUUID(),targetRef:ref,criteriaVersion:1,outcome:p.outcome},review={ref:reviewRef,criteria:workPlanReviewCriteria,items:p.items,reviewer:{kind:'HUMAN',userId:actor.actorId,sameAsTargetRecorder:recorderId===actor.actorId},sourceKind:'HUMAN_REVIEW',reason:p.reason,reviewedAt:(await db.query('SELECT transaction_timestamp() at')).rows[0].at.toISOString()};
 const receipt=await persistProjectReceipt(db,actor,c,ref,{status:'REVIEW_RECORDED',reviewRef,review},policyRef,'EXPLICIT_WORK_PLAN_CONTENT_REVIEW');
 await db.query("INSERT INTO anvil.content_reviews(id,scope_kind,scope_id,project_id,target_kind,target_id,target_version,target_hash,criteria_version,criteria_snapshot_json,items_json,outcome,reviewer_user_id,client_id,reviewer_subject_ref,source_kind,reason,command_id) VALUES($1,'PROJECT',$2,$2,'WORK_PLAN',$3,$4,$5,1,$6,$7,$8,$9,$10,$11,'HUMAN_REVIEW',$12,$13)",[reviewRef.id,c.projectId,ref.id,ref.version,ref.contentHash,JSON.stringify(workPlanReviewCriteria),JSON.stringify(p.items),p.outcome,actor.actorId,actor.clientId,JSON.stringify(review.reviewer),p.reason,receipt.id]);return receipt.result;
}
export async function workPlanReviews(db:PoolClient,pid:string,ref:VersionRef,recorderId:string){
 const rows=(await db.query("SELECT r.*,a.server_sequence,c.actor_id command_actor,c.client_id command_client,c.operation command_operation,c.result_ref command_result FROM anvil.content_reviews r JOIN anvil.audit_events a ON a.project_id=r.project_id AND a.command_id=r.command_id JOIN anvil.commands c ON c.id=r.command_id AND c.project_id=r.project_id WHERE r.scope_kind='PROJECT' AND r.project_id=$1 AND r.target_kind='WORK_PLAN' AND r.target_id=$2 AND r.target_version=$3 AND r.target_hash=$4 ORDER BY a.server_sequence DESC LIMIT 200",[pid,ref.id,ref.version,ref.contentHash])).rows;
 return rows.map(r=>{
  const p=readWorkPlanReviewInput({targetKind:'WORK_PLAN',targetRef:ref,criteriaVersion:Number(r.criteria_version),items:r.items_json,outcome:r.outcome,reason:r.reason},ref),review={ref:{id:r.id,targetRef:ref,criteriaVersion:1 as const,outcome:p.outcome},criteria:workPlanReviewCriteria,items:p.items,reviewer:{kind:'HUMAN',userId:r.reviewer_user_id,sameAsTargetRecorder:r.reviewer_user_id===recorderId},sourceKind:'HUMAN_REVIEW',reason:p.reason,reviewedAt:r.created_at.toISOString()},c=r.command_result;
  if(r.source_kind!=='HUMAN_REVIEW'||r.command_operation!=='recordContentReview'||r.command_actor!==r.reviewer_user_id||r.command_client!==r.client_id||canonicalJson(r.criteria_snapshot_json)!==canonicalJson(workPlanReviewCriteria)||canonicalJson(r.reviewer_subject_ref)!==canonicalJson(review.reviewer)||!c||c.status!=='APPLIED'||c.projectId!==pid||c.targetId!==ref.id||c.version!==ref.version||c.data?.status!=='REVIEW_RECORDED'||canonicalJson(c.data?.ref??null)!==canonicalJson(ref)||canonicalJson(c.data?.reviewRef??null)!==canonicalJson(review.ref)||canonicalJson(c.data?.review??null)!==canonicalJson(review)||!Number.isSafeInteger(Number(r.server_sequence)))throw new AuthFailure('WORK_PLAN_REVIEW_INTEGRITY_FAILED',503);
  return{...review,serverSequence:Number(r.server_sequence)};
 });
}
