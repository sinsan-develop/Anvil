import {ApiClient,ApiError} from '../../api/client.ts';
import {readDocument} from './api.ts';
import {readDesignIndex,type ScreenRegion} from './design-index-api.ts';
import {getPinnedForm} from '../methodologies/forms-api.ts';
import {resolveDesignAnchor,type DesignAnchorSelection} from './design-anchor.ts';
type Ref=ScreenRegion['documentRef'];
export interface ScreenRegionContext{projectId:string;userId:string;clientId:string;sourceRef:Ref}
export interface ScreenRegionSelection extends ScreenRegionContext{region:ScreenRegion}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,hash=/^[0-9a-f]{64}$/;
const ref=(r:Ref)=>r&&uuid.test(r.id)&&Number.isSafeInteger(r.version)&&r.version>0&&hash.test(r.contentHash);
const same=(a:Ref,b:Ref)=>ref(a)&&ref(b)&&a.id===b.id&&a.version===b.version&&a.contentHash===b.contentHash;
const context=(c:ScreenRegionContext)=>c&&uuid.test(c.projectId)&&uuid.test(c.userId)&&uuid.test(c.clientId)&&ref(c.sourceRef);
const artifact=(a:ScreenRegion['artifactRef'],b:ScreenRegion['artifactRef'])=>a&&b&&a.artifactId===b.artifactId&&a.bytes===b.bytes&&a.contentHash===b.contentHash&&a.mediaType===b.mediaType;
/** 저장/API 계약을 바꾸지 않는 정확 고정 시안 조회. 주체/원설계가 바뀌면 caller가 active를 닫는다. */
export async function readRegisteredScreen(client:ApiClient,current:ScreenRegionContext,selection:ScreenRegionSelection,active:()=>boolean){
 if(!context(current)||!context(selection)||current.projectId!==selection.projectId||current.userId!==selection.userId||current.clientId!==selection.clientId||!same(current.sourceRef,selection.sourceRef)||!selection.region||!ref(selection.region.documentRef))throw new ApiError('SCREEN_REGION_CONTEXT_CHANGED');
 const selected=structuredClone(selection),check=()=>{if(!active())throw new ApiError('SCREEN_REGION_CONTINUATION_PAUSED');};check();
 const index=await readDesignIndex(client,selected.projectId,selected.sourceRef);check();
 const chosen=selected.region,region=index.screenRegions.find(r=>r.id===chosen.id);
 if(!region||region.designItemId!==chosen.designItemId||region.screenCode!==chosen.screenCode||region.anchor!==chosen.anchor||region.regionHash!==chosen.regionHash||!same(region.documentRef,chosen.documentRef)||!artifact(region.artifactRef,chosen.artifactRef))throw new ApiError('SCREEN_REGION_REFERENCE_CHANGED');
 const value=await readDocument(client,selected.projectId,region.documentRef.id,region.documentRef.version);check();
 if(!same(value.document,region.documentRef)||!artifact(value.document.content.body,region.artifactRef))throw new ApiError('SCREEN_REGION_REFERENCE_CHANGED');
 const form=await getPinnedForm(client,value.document.formRef);check();
 if(form.definition.formCode!=='AF03')throw new ApiError('SCREEN_REGION_DOCUMENT_KIND_INVALID');
 const anchorSelection:DesignAnchorSelection={projectId:selected.projectId,documentRef:{...region.documentRef},bodyHash:region.artifactRef.contentHash,anchor:region.anchor};
 const located=resolveDesignAnchor(value.body,anchorSelection,anchorSelection);
 if(located.kind!=='READY'||!new RegExp('(?<![A-Za-z0-9_-])'+region.screenCode+'(?![A-Za-z0-9_-])').test(located.line))throw new ApiError('SCREEN_REGION_ANCHOR_UNVERIFIED');
 check();return {...value,anchorSelection};
}
