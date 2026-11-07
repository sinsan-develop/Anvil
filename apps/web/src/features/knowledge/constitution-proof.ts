import{ApiError}from'../../api/client.ts';
import{ordered,knowledgeReason,type KnowledgeRef,type KnowledgeReviewRef}from'./review-view.ts';
export interface ConstitutionRecord{ref:KnowledgeRef;application:{projectId:string;versionRef:KnowledgeRef;confirmationId:string;reason:string;acknowledged:true;reviewRef:KnowledgeReviewRef;previousApplicationRef:KnowledgeRef|null;appliedBy:{kind:'HUMAN';userId:string;clientId:string};controlGeneration:number};appliedAt:string}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const constitutionRef=(r:any):r is KnowledgeRef=>!!r&&Object.keys(r).sort().join(',')==='contentHash,id,version'&&uuid.test(r.id)&&Number.isSafeInteger(r.version)&&r.version>0&&/^[0-9a-f]{64}$/.test(r.contentHash);
export async function constitutionHash(value:unknown){const bytes=new TextEncoder().encode(ordered(value));return[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function validateConstitutionRecord(record:ConstitutionRecord,pid:string){
 const a=record?.application,rr=a?.reviewRef,previous=a?.previousApplicationRef;
 if(!record||!constitutionRef(record.ref)||record.ref.id!==pid||!a||Object.keys(a).sort().join(',')!=='acknowledged,appliedBy,confirmationId,controlGeneration,previousApplicationRef,projectId,reason,reviewRef,versionRef'||a.projectId!==pid||!constitutionRef(a.versionRef)||!uuid.test(a.confirmationId)||a.acknowledged!==true||!knowledgeReason(a.reason)||a.appliedBy?.kind!=='HUMAN'||!uuid.test(a.appliedBy.userId)||!uuid.test(a.appliedBy.clientId)||!Number.isSafeInteger(a.controlGeneration)||a.controlGeneration<1||!Number.isFinite(Date.parse(record.appliedAt))||!rr||!uuid.test(rr.id)||rr.criteriaVersion!==1||rr.outcome!=='ACCEPTED'||ordered(rr.targetRef)!==ordered(a.versionRef)||(record.ref.version===1?previous!==null:!constitutionRef(previous)||previous.id!==pid||previous.version!==record.ref.version-1)||await constitutionHash(a)!==record.ref.contentHash)throw new ApiError('RESPONSE_INVALID');
 return record;
}
