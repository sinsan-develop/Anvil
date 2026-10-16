import{ApiClient,ApiError}from'../../api/client.ts';import{readDocument,type DocumentVersion}from'./api.ts';import{getPinnedForm}from'../methodologies/forms-api.ts';import type{TaskCard}from'../../../../server/modules/traceability/work-plan-card.ts';import type{WorkPlanInput,PlanRef}from'./work-plan-api.ts';
type Review=DocumentVersion['contentReviews'][number];
export interface ScreenReviewChoice{documentRef:PlanRef;title:string;latestReview:Review|null;available:boolean;reasonCode:'LATEST_ACCEPTED'|'LATEST_NOT_ACCEPTED'|'NO_REVIEW'}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,ref=(r:any):r is PlanRef=>!!r&&Object.keys(r).sort().join(',')==='contentHash,id,version'&&uuid.test(r.id)&&Number.isSafeInteger(r.version)&&r.version>0&&/^[0-9a-f]{64}$/.test(r.contentHash),key=(r:PlanRef)=>r.id+':'+r.version+':'+r.contentHash;
function linked(tasks:TaskCard[]){if(!Array.isArray(tasks)||tasks.length>200)throw new ApiError('SCREEN_REVIEW_INPUT_INVALID');const refs=new Map<string,PlanRef>();for(const t of tasks){if(!Array.isArray(t?.screenRefs)||t.screenRefs.length>200)throw new ApiError('SCREEN_REVIEW_INPUT_INVALID');for(const r of t.screenRefs){if(r?.kind!=='SCREEN_REGION'||!ref(r.versionRef))throw new ApiError('SCREEN_REVIEW_INPUT_INVALID');refs.set(key(r.versionRef),r.versionRef);}}if(refs.size>200)throw new ApiError('SCREEN_REVIEW_INPUT_INVALID');return refs;}
export async function readWorkPlanScreenReviews(client:ApiClient,pid:string,tasks:TaskCard[]):Promise<ScreenReviewChoice[]>{
 const refs=linked(tasks),choices:ScreenReviewChoice[]=[];
 for(const expected of refs.values()){
  const v=await readDocument(client,pid,expected.id,expected.version);if(v.document.contentHash!==expected.contentHash)throw new ApiError('SCREEN_REVIEW_VERSION_MISMATCH',409);const form=await getPinnedForm(client,v.document.formRef);if(form.definition.formCode!=='AF03')throw new ApiError('SCREEN_REVIEW_DOCUMENT_KIND_INVALID',422);
  const ids=new Set(form.definition.items.map(i=>i.itemId)),reviews=v.document.contentReviews;let previous=Number.MAX_SAFE_INTEGER;const seen=new Set<string>();
  for(const r of reviews){if(seen.has(r.ref.id)||r.serverSequence>=previous||Object.keys(r.ref).sort().join(',')!=='criteriaVersion,id,outcome,targetRef'||r.items.length!==ids.size||new Set(r.items.map(i=>i.criterionId)).size!==ids.size||r.items.some(i=>!ids.has(i.criterionId)||!i.reason.trim())||r.ref.outcome==='ACCEPTED'&&r.items.some(i=>i.outcome!=='ACCEPTED'))throw new ApiError('RESPONSE_INVALID');seen.add(r.ref.id);previous=r.serverSequence;}
  const latestReview=reviews[0]??null,available=latestReview?.ref.outcome==='ACCEPTED';choices.push({documentRef:{...expected},title:v.document.title,latestReview:latestReview?structuredClone(latestReview):null,available,reasonCode:available?'LATEST_ACCEPTED':latestReview?'LATEST_NOT_ACCEPTED':'NO_REVIEW'});
 }
 return choices;
}
export function selectWorkPlanScreenReview(input:WorkPlanInput,choice:ScreenReviewChoice,selected:boolean):WorkPlanInput{
 const refs=linked(input.tasks),r=choice.latestReview?.ref;if(!ref(choice.documentRef)||!refs.has(key(choice.documentRef))||!Array.isArray(input.screenReviewRefs)||input.screenReviewRefs.length>200)throw new ApiError('SCREEN_REVIEW_INPUT_INVALID');
 if(selected&&(!choice.available||!r||r.outcome!=='ACCEPTED'||!ref(r.targetRef)||key(r.targetRef)!==key(choice.documentRef)||r.criteriaVersion!==1||!uuid.test(r.id)))throw new ApiError('SCREEN_REVIEW_REQUIRED',422);
 const remaining=input.screenReviewRefs.filter((old:any)=>!old?.targetRef||old.targetRef.id!==choice.documentRef.id||old.targetRef.version!==choice.documentRef.version);
 return{...input,screenReviewRefs:selected?[...remaining,structuredClone(r!)]:remaining};
}
