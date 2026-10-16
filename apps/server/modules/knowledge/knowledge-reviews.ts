import{AuthFailure}from'../access/repository.ts';
import{canonicalJson}from'../../../../contracts/canonical.ts';
import{isVersionRef}from'../../../../contracts/references.ts';
import type{VersionRef}from'../../../../contracts/generated-types.ts';
import{exact,assertKnowledgeTextSafe}from'./knowledge-entry.ts';
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
