import{AuthFailure}from'../access/repository.ts';
import{canonicalJson}from'../../../../contracts/canonical.ts';
import{isVersionRef}from'../../../../contracts/references.ts';
import type{VersionRef}from'../../../../contracts/generated-types.ts';
import{exactKeys,planText}from'./work-plan-card.ts';
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
