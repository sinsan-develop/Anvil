import{ApiError}from'../../api/client.ts';
export type KnowledgeRef={id:string;version:number;contentHash:string};
export type KnowledgeOutcome='ACCEPTED'|'REWORK'|'BLOCKED'|'NOT_EXECUTED';
export interface KnowledgeReviewRef{id:string;targetRef:KnowledgeRef;criteriaVersion:1;outcome:KnowledgeOutcome}
export interface KnowledgeReviewCriteria{criteriaVersion:1;knowledgeKind:string;items:{criterionId:string;title:string}[]}
export interface KnowledgeStoredReview{ref:KnowledgeReviewRef;criteria:KnowledgeReviewCriteria;items:{criterionId:string;outcome:KnowledgeOutcome;evidenceRefs:[];reason:string}[];reviewer:{kind:'HUMAN';userId:string;sameAsTargetRecorder:boolean};sourceKind:'HUMAN_REVIEW';reason:string;reviewedAt:string;serverSequence:number}
export const knowledgeCriterionIds=['KNOWLEDGE_PURPOSE','KNOWLEDGE_SOURCE','KNOWLEDGE_REASON','KNOWLEDGE_SCOPE','KNOWLEDGE_LIMITS'];
export const knowledgeOutcomes:KnowledgeOutcome[]=['ACCEPTED','REWORK','BLOCKED','NOT_EXECUTED'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const ordered=(value:any):string=>JSON.stringify(Array.isArray(value)?value.map(v=>JSON.parse(ordered(v))):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(ordered(value[k]))])):value);
export const knowledgeReason=(v:unknown):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=20000&&v.isWellFormed();
export function validateKnowledgeReviewMetadata(v:any){
 const fail=()=>{throw new ApiError('RESPONSE_INVALID');},same=(a:any,b:any)=>a!==undefined&&b!==undefined&&ordered(a)===ordered(b);
 const criteria=v.contentReviewCriteria,reviews=v.contentReviews,confirmation=v.confirmation,confirmed=v.history.find((e:any)=>e.kind==='CONFIRMED');
 // 이전 제안/과거 조회에는 검토 가능성을 만들어 주지 않는다. 실제 판단 명령은 아래 메타데이터 전체를 요구한다.
 if(criteria===undefined&&reviews===undefined&&confirmation===undefined&&v.currentConfirmationValid===undefined){if(confirmed||v.state==='CONFIRMED')fail();return;}
 if(!criteria||criteria.criteriaVersion!==1||criteria.knowledgeKind!==v.entry.kind||!Array.isArray(criteria.items)||criteria.items.length!==5||criteria.items.some((i:any,n:number)=>i?.criterionId!==knowledgeCriterionIds[n]||!knowledgeReason(i.title))||!Array.isArray(reviews)||reviews.length>200||typeof v.currentConfirmationValid!=='boolean')fail();
 const seen=new Set<string>();let previous=Number.MAX_SAFE_INTEGER;
 for(const r of reviews){if(!r||!uuid.test(r.ref?.id)||seen.has(r.ref.id)||!same(r.ref.targetRef,v.ref)||r.ref.criteriaVersion!==1||!knowledgeOutcomes.includes(r.ref.outcome)||!same(r.criteria,criteria)||!Array.isArray(r.items)||r.items.length!==5||new Set(r.items.map((i:any)=>i?.criterionId)).size!==5||r.items.some((i:any)=>!knowledgeCriterionIds.includes(i?.criterionId)||!knowledgeOutcomes.includes(i.outcome)||!knowledgeReason(i.reason)||!Array.isArray(i.evidenceRefs)||i.evidenceRefs.length)||r.ref.outcome==='ACCEPTED'&&r.items.some((i:any)=>i.outcome!=='ACCEPTED')||r.reviewer?.kind!=='HUMAN'||!uuid.test(r.reviewer.userId)||typeof r.reviewer.sameAsTargetRecorder!=='boolean'||r.sourceKind!=='HUMAN_REVIEW'||!knowledgeReason(r.reason)||!Number.isFinite(Date.parse(r.reviewedAt))||!Number.isSafeInteger(r.serverSequence)||r.serverSequence<1||r.serverSequence>=previous)fail();seen.add(r.ref.id);previous=r.serverSequence;}
 if(!confirmed){if(confirmation!==null||v.currentConfirmationValid!==false)fail();return;}
 if(!confirmation||confirmation.eventId!==confirmed.id||confirmation.reason!==confirmed.reason||!same(confirmation.actorRef,confirmed.actorRef)||confirmation.recordedAt!==confirmed.recordedAt||!same(confirmation.reviewRefs,confirmed.reviewRefs)||!Array.isArray(confirmation.reviewRefs)||!confirmation.reviewRefs.length||confirmation.reviewRefs.length>200||new Set(confirmation.reviewRefs.map((r:any)=>r?.id)).size!==confirmation.reviewRefs.length||confirmation.reviewRefs.some((r:any)=>r?.outcome!=='ACCEPTED'||!same(r.targetRef,v.ref)||r.criteriaVersion!==1||!uuid.test(r.id)))fail();
 // 오래된 확정 검토는 서버에서 원 명령까지 대조한다. 현재 유효성은 실제 최신 검토가 확정 참조에 포함되는지로만 판단한다.
 const expected=v.state==='CONFIRMED'&&reviews[0]?.ref.outcome==='ACCEPTED'&&confirmation.reviewRefs.some((r:any)=>same(r,reviews[0].ref));if(v.currentConfirmationValid!==expected)fail();
}
