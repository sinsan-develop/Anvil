import{AuthFailure}from'../access/repository.ts';
import{canonicalJson}from'../../../../contracts/canonical.ts';
import{exactKeys,planText}from'./work-plan-card.ts';
import{isImpactTargetRef,type ImpactTargetRef}from'./design-impact.ts';
export interface HumanImpactItem{targetRef:ImpactTargetRef;state:'AFFECTED'|'UNAFFECTED'|'UNKNOWN';reason:string;evidenceRefs:ImpactTargetRef[]}
export interface HumanImpactReview{items:HumanImpactItem[];coverageGaps:{code:string;targetRef?:ImpactTargetRef}[];reason:string}
/** 참조의 실제 프로젝트/원문/hash 검증은 저장 경로가 수행한다. 이 함수는 의미 판단을 자동 승인하지 않는다. */
export function readImpactReview(value:unknown,base:{items:{targetRef:unknown}[];coverageGaps:unknown[]}):HumanImpactReview{
 const reason=(v:unknown)=>planText(v)&&!!v.trim();
 if(!exactKeys(value,['items','coverageGaps','reason'])||!Array.isArray(value.items)||value.items.length!==base.items.length||value.items.length>2000||!Array.isArray(value.coverageGaps)||value.coverageGaps.length>5000||!reason(value.reason))throw new AuthFailure('IMPACT_REVIEW_INPUT_INVALID',422);
 const expected=new Set(base.items.map(i=>canonicalJson(i.targetRef))),seen=new Set<string>();
 for(const item of value.items){if(!exactKeys(item,['targetRef','state','reason','evidenceRefs'])||!isImpactTargetRef(item.targetRef)||!['AFFECTED','UNAFFECTED','UNKNOWN'].includes(item.state)||!reason(item.reason)||!Array.isArray(item.evidenceRefs)||item.evidenceRefs.length>200)throw new AuthFailure('IMPACT_REVIEW_INPUT_INVALID',422);const key=canonicalJson(item.targetRef);if(!expected.has(key)||seen.has(key))throw new AuthFailure('IMPACT_REVIEW_TARGET_MISMATCH',422);seen.add(key);const evidence=new Set<string>();for(const ref of item.evidenceRefs){if(!isImpactTargetRef(ref)||ref.kind!=='DOCUMENT_VERSION')throw new AuthFailure('IMPACT_REVIEW_EVIDENCE_NOT_CONNECTED',412);const e=canonicalJson(ref);if(evidence.has(e))throw new AuthFailure('IMPACT_REVIEW_INPUT_INVALID',422);evidence.add(e);}if(item.state==='UNAFFECTED'&&!item.evidenceRefs.length)throw new AuthFailure('IMPACT_REVIEW_EVIDENCE_REQUIRED',422);}
 for(const gap of value.coverageGaps){if(!gap||typeof gap!=='object'||Array.isArray(gap)||Object.keys(gap).some(k=>!['code','targetRef'].includes(k))||typeof gap.code!=='string'||!/^[A-Z][A-Z0-9_]{0,63}$/.test(gap.code)||gap.targetRef!==undefined&&(!isImpactTargetRef(gap.targetRef)||!expected.has(canonicalJson(gap.targetRef))))throw new AuthFailure('IMPACT_REVIEW_INPUT_INVALID',422);}
 if(base.coverageGaps.some(gap=>!value.coverageGaps.some((g:unknown)=>canonicalJson(g)===canonicalJson(gap))))throw new AuthFailure('IMPACT_REVIEW_COVERAGE_PRESERVE_REQUIRED',422);
 return structuredClone(value)as HumanImpactReview;
}
