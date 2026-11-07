import{AuthFailure}from'../access/repository.ts';
import{canonicalJson}from'../../../../contracts/canonical.ts';
import{isVersionRef}from'../../../../contracts/references.ts';
import type{VersionRef}from'../../../../contracts/generated-types.ts';
import{exact,assertKnowledgeTextSafe}from'./knowledge-entry.ts';
import{randomUUID}from'node:crypto';
import type{PoolClient}from'pg';
import type{AuthenticatedIdentity}from'../access/repository.ts';
import{persistProjectReceipt,type ProjectCommand}from'../access/project-command.ts';
import type{KnowledgeEntry}from'./knowledge-entry.ts';
export const knowledgeContentReviewCriteria=Object.freeze({criteriaVersion:1,items:Object.freeze([
 {criterionId:'KNOWLEDGE_PURPOSE',title:'지식의 목적·종류·사용 범위가 분명한가'},
 {criterionId:'KNOWLEDGE_SOURCE',title:'원문·출처와 사실/가설을 구분했는가'},
 {criterionId:'KNOWLEDGE_REASON',title:'판단 이유·정정 전후·제외 이력을 보존했는가'},
 {criterionId:'KNOWLEDGE_SCOPE',title:'프로젝트 범위·민감 자료·공유 한계를 지켰는가'},
 {criterionId:'KNOWLEDGE_LIMITS',title:'미확인·충돌·적용 한계를 숨기지 않았는가'},
])});
export type KnowledgeReviewOutcome='ACCEPTED'|'REWORK'|'BLOCKED'|'NOT_EXECUTED';
export interface KnowledgeReviewInput{targetKind:'KNOWLEDGE';targetRef:VersionRef;criteriaVersion:1;items:{criterionId:string;outcome:KnowledgeReviewOutcome;evidenceRefs:never[];reason:string}[];outcome:KnowledgeReviewOutcome;reason:string}
export function readKnowledgeReviewInput(value:unknown,ref:VersionRef):KnowledgeReviewInput{
 const outcomes=['ACCEPTED','REWORK','BLOCKED','NOT_EXECUTED'],reason=(v:unknown):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=20000&&v.isWellFormed();
 if(!exact(value,['targetKind','targetRef','criteriaVersion','items','outcome','reason'])||value.targetKind!=='KNOWLEDGE'||!isVersionRef(value.targetRef)||canonicalJson(value.targetRef)!==canonicalJson(ref)||value.criteriaVersion!==1||!Array.isArray(value.items)||value.items.length!==knowledgeContentReviewCriteria.items.length||!outcomes.includes(String(value.outcome))||!reason(value.reason))throw new AuthFailure('KNOWLEDGE_REVIEW_INPUT_INVALID',422);
 const expected=new Set(knowledgeContentReviewCriteria.items.map(i=>i.criterionId)),seen=new Set<string>();assertKnowledgeTextSafe(value.reason);
 for(const i of value.items){if(!exact(i,['criterionId','outcome','evidenceRefs','reason'])||typeof i.criterionId!=='string'||!expected.has(i.criterionId)||seen.has(i.criterionId)||!outcomes.includes(String(i.outcome))||!reason(i.reason)||!Array.isArray(i.evidenceRefs))throw new AuthFailure('KNOWLEDGE_REVIEW_INPUT_INVALID',422);if(i.evidenceRefs.length)throw new AuthFailure('REVIEW_EVIDENCE_CONNECTION_PENDING',412);assertKnowledgeTextSafe(i.reason);seen.add(i.criterionId);}
 if(value.outcome==='ACCEPTED'&&value.items.some(i=>i.outcome!=='ACCEPTED'))throw new AuthFailure('KNOWLEDGE_REVIEW_INCOMPLETE',422);
 return structuredClone(value)as unknown as KnowledgeReviewInput;
}
export function knowledgeReviewCriteria(kind:KnowledgeEntry['kind']){return{...knowledgeContentReviewCriteria,knowledgeKind:kind};}
export interface KnowledgeReviewRef{id:string;targetRef:VersionRef;criteriaVersion:1;outcome:KnowledgeReviewOutcome}
export interface StoredKnowledgeReview{ref:KnowledgeReviewRef;criteria:ReturnType<typeof knowledgeReviewCriteria>;items:KnowledgeReviewInput['items'];reviewer:{kind:'HUMAN';userId:string;sameAsTargetRecorder:boolean};sourceKind:'HUMAN_REVIEW';reason:string;reviewedAt:string;serverSequence:number}
export async function writeKnowledgeReview(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,policyRef:VersionRef,version:{ref:VersionRef;entry:KnowledgeEntry;recorderId:string}){
 const p=readKnowledgeReviewInput(c.payload,version.ref);if(c.targetId!==p.targetRef.id||c.expectedVersion!==p.targetRef.version)throw new AuthFailure('KNOWLEDGE_REVIEW_INPUT_INVALID',422);
 const id=randomUUID(),reviewRef:KnowledgeReviewRef={id,targetRef:p.targetRef,criteriaVersion:1,outcome:p.outcome},criteria=knowledgeReviewCriteria(version.entry.kind),reviewer={kind:'HUMAN' as const,userId:actor.actorId,sameAsTargetRecorder:version.recorderId===actor.actorId},at=(await db.query('SELECT transaction_timestamp() at')).rows[0].at.toISOString();
 const review={ref:reviewRef,criteria,items:p.items,reviewer,sourceKind:'HUMAN_REVIEW' as const,reason:p.reason,reviewedAt:at};
 const receipt=await persistProjectReceipt(db,actor,c,version.ref,{status:'REVIEW_RECORDED',reviewRef,review},policyRef,'EXPLICIT_KNOWLEDGE_CONTENT_REVIEW');
 await db.query("INSERT INTO anvil.content_reviews(id,scope_kind,scope_id,project_id,target_kind,target_id,target_version,target_hash,criteria_version,criteria_snapshot_json,items_json,outcome,reviewer_user_id,client_id,reviewer_subject_ref,source_kind,reason,command_id) VALUES($1,'PROJECT',$2,$2,'KNOWLEDGE',$3,$4,$5,1,$6,$7,$8,$9,$10,$11,'HUMAN_REVIEW',$12,$13)",[id,c.projectId,version.ref.id,version.ref.version,version.ref.contentHash,JSON.stringify(criteria),JSON.stringify(p.items),p.outcome,actor.actorId,actor.clientId,JSON.stringify(reviewer),p.reason,receipt.id]);
 return receipt.result;
}
export async function knowledgeReviews(db:PoolClient,pid:string,ref:VersionRef,kind:KnowledgeEntry['kind'],recorderId:string,ids?:string[]):Promise<StoredKnowledgeReview[]>{
 if(ids&&(!ids.length||ids.length>200||ids.some(id=>typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))))throw new AuthFailure('KNOWLEDGE_REVIEW_INTEGRITY_FAILED',503);
 const rows=(await db.query("SELECT r.*,a.server_sequence,c.actor_id command_actor,c.client_id command_client,c.operation command_operation,c.result_ref command_result FROM anvil.content_reviews r JOIN anvil.audit_events a ON a.project_id=r.project_id AND a.command_id=r.command_id JOIN anvil.commands c ON c.id=r.command_id AND c.project_id=r.project_id WHERE r.scope_kind='PROJECT' AND r.project_id=$1 AND r.target_kind='KNOWLEDGE' AND r.target_id=$2 AND r.target_version=$3 AND r.target_hash=$4 AND ($5::uuid[] IS NULL OR r.id=ANY($5::uuid[])) ORDER BY a.server_sequence DESC LIMIT 200",[pid,ref.id,ref.version,ref.contentHash,ids??null])).rows;
 return rows.map(r=>{
  const p=readKnowledgeReviewInput({targetKind:'KNOWLEDGE',targetRef:ref,criteriaVersion:Number(r.criteria_version),items:r.items_json,outcome:r.outcome,reason:r.reason},ref),reviewRef:KnowledgeReviewRef={id:r.id,targetRef:ref,criteriaVersion:1,outcome:p.outcome},criteria=knowledgeReviewCriteria(kind),reviewer={kind:'HUMAN' as const,userId:r.reviewer_user_id,sameAsTargetRecorder:recorderId===r.reviewer_user_id},review={ref:reviewRef,criteria,items:p.items,reviewer,sourceKind:'HUMAN_REVIEW' as const,reason:p.reason,reviewedAt:r.created_at.toISOString()},c=r.command_result;
  if(r.source_kind!=='HUMAN_REVIEW'||r.command_operation!=='recordContentReview'||r.command_actor!==r.reviewer_user_id||r.command_client!==r.client_id||canonicalJson(r.criteria_snapshot_json)!==canonicalJson(criteria)||canonicalJson(r.reviewer_subject_ref)!==canonicalJson(reviewer)||!c||c.status!=='APPLIED'||c.projectId!==pid||c.targetId!==ref.id||c.version!==ref.version||canonicalJson(c.data?.ref??null)!==canonicalJson(ref)||c.data?.status!=='REVIEW_RECORDED'||canonicalJson(c.data?.reviewRef??null)!==canonicalJson(reviewRef)||canonicalJson(c.data?.review??null)!==canonicalJson(review)||!Number.isSafeInteger(Number(r.server_sequence)))throw new AuthFailure('KNOWLEDGE_REVIEW_INTEGRITY_FAILED',503);
  return{...review,serverSequence:Number(r.server_sequence)};
 });
}
export function acceptedKnowledgeReviews(ref:VersionRef,value:unknown,records:StoredKnowledgeReview[],requireLatest:boolean){
 if(!Array.isArray(value)||!value.length||value.length>200)throw new AuthFailure('CONTENT_REVIEW_REQUIRED',422);
 const seen=new Set<string>();for(const r of value){if(!exact(r,['id','targetRef','criteriaVersion','outcome'])||typeof r.id!=='string'||seen.has(r.id)||r.criteriaVersion!==1||r.outcome!=='ACCEPTED'||!isVersionRef(r.targetRef)||canonicalJson(r.targetRef)!==canonicalJson(ref)||!records.some(record=>canonicalJson(record.ref)===canonicalJson(r)))throw new AuthFailure('CONTENT_REVIEW_REQUIRED',422);seen.add(r.id);}
 if(requireLatest&&(!records[0]||records[0].ref.outcome!=='ACCEPTED'||!seen.has(records[0].ref.id)))throw new AuthFailure('CONTENT_REVIEW_REQUIRED',422);
 return structuredClone(value)as KnowledgeReviewRef[];
}
