import{ApiClient,ApiError}from'../../api/client.ts';import{readDesignChange}from'./api.ts';import{readDocument}from'../design-trace/api.ts';import{validRef}from'../connections/api.ts';import{ordered}from'../knowledge/review-view.ts';import type{ImpactPlanSelection}from'./impact-plan-task-read.ts';
export type ImpactDocumentSelection=ImpactPlanSelection & {evidenceFor?:ImpactPlanSelection['target']};
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v),same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
/** 저장된 영향의 동일 구간/고정 문서만 읽는다. 다른 원문·최신 버전·권한으로 대체하지 않는다. */
export async function readImpactDocument(client:ApiClient,selection:ImpactDocumentSelection,active:()=>boolean){
 const target=selection?.target;
 if(!selection||![selection.projectId,selection.userId,selection.clientId].every(uuid)||!validRef(selection.changeRef)||selection.changeRef.version!==1||!validRef(selection.impactRef)||!target||target.kind!=='DOCUMENT_VERSION'||target.id!==target.versionRef?.id||!validRef(target.versionRef)||target.localCode!==undefined||target.anchor!==undefined||selection.beforeVersion!==null&&(!Number.isSafeInteger(selection.beforeVersion)||selection.beforeVersion<1||selection.beforeVersion>999999999999999))throw new ApiError('IMPACT_DOCUMENT_TARGET_INVALID');
 const chosen=structuredClone(selection),check=()=>{if(!active())throw new ApiError('IMPACT_DOCUMENT_READ_PAUSED');};check();
 const page=await readDesignChange(client,chosen.projectId,chosen.changeRef.id,chosen.beforeVersion);check();const impacts=page.impactVersions.filter(i=>same(i.ref,chosen.impactRef));
 if(!same(page.change.ref,chosen.changeRef)||impacts.length!==1)throw new ApiError('IMPACT_DOCUMENT_TARGET_CHANGED');
 const items=impacts[0]!.items.filter(i=>same(i.targetRef,chosen.evidenceFor===undefined?chosen.target:chosen.evidenceFor));
 if(items.length!==1||chosen.evidenceFor!==undefined&&items[0]!.evidenceRefs.filter(ref=>same(ref,chosen.target)).length!==1)throw new ApiError('IMPACT_DOCUMENT_TARGET_CHANGED');
 const value=await readDocument(client,chosen.projectId,chosen.target.id,chosen.target.versionRef.version,{expectedContentHash:chosen.target.versionRef.contentHash,active});check();return value;
}
