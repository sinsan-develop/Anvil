import {ApiClient,ApiError} from '../../api/client.ts';import {readWorkPlan,type PlanRef} from './work-plan-api.ts';import {readDocument} from './api.ts';import {getPinnedForm} from '../methodologies/forms-api.ts';import {ordered} from '../knowledge/review-view.ts';
export interface PlanDocumentSelection{projectId:string;userId:string;clientId:string;planRef:PlanRef;documentRef:PlanRef}
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const ref=(v:PlanRef)=>v&&Object.keys(v).sort().join(',')==='contentHash,id,version'&&uuid(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&typeof v.contentHash==='string'&&/^[0-9a-f]{64}$/.test(v.contentHash);
/** 보관 계획이 가리키는 정확 작성 문서만 읽고 현재 버전으로 대체하지 않는다. */
export async function readPlanDocumentOriginal(client:ApiClient,selection:PlanDocumentSelection,active:()=>boolean){
 if(!selection||![selection.projectId,selection.userId,selection.clientId].every(uuid)||!ref(selection.planRef)||!ref(selection.documentRef))throw new ApiError('PLAN_DOCUMENT_REFERENCE_INVALID');
 const chosen=structuredClone(selection),check=()=>{if(!active())throw new ApiError('PLAN_DOCUMENT_READ_PAUSED');};check();
 const plan=await readWorkPlan(client,chosen.projectId,chosen.planRef);check();
 if(ordered(plan.documentRef)!==ordered(chosen.documentRef))throw new ApiError('PLAN_DOCUMENT_REFERENCE_CHANGED');
 const value=await readDocument(client,chosen.projectId,chosen.documentRef.id,chosen.documentRef.version,{expectedContentHash:chosen.documentRef.contentHash,active});check();
 const form=await getPinnedForm(client,value.document.formRef);check();if(form.definition.formCode!=='AF04')throw new ApiError('PLAN_DOCUMENT_KIND_INVALID');
 return value;
}
