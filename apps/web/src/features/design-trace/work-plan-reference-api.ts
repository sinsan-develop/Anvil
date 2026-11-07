import {ApiClient,ApiError} from '../../api/client.ts';
import {readWorkPlan,type PlanRef} from './work-plan-api.ts';
import {readDesignIndex,type DesignIndexView} from './design-index-api.ts';
import {readDocument} from './api.ts';
import {getPinnedForm} from '../methodologies/forms-api.ts';
import type {PlanTraceRef} from '../../../../server/modules/traceability/work-plan-card.ts';
import type {DesignAnchorSelection} from './design-anchor.ts';

export interface StoredPlanSelection{projectId:string;userId:string;clientId:string;planRef:PlanRef;taskCode:string;target:PlanTraceRef}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const validRef=(r:PlanRef)=>r&&uuid.test(r.id)&&Number.isSafeInteger(r.version)&&r.version>0&&/^[0-9a-f]{64}$/.test(r.contentHash);
const sameRef=(a:PlanRef,b:PlanRef)=>validRef(a)&&validRef(b)&&a.id===b.id&&a.version===b.version&&a.contentHash===b.contentHash;
const sameTarget=(a:PlanTraceRef,b:PlanTraceRef)=>a.kind===b.kind&&a.id===b.id&&a.localCode===b.localCode&&a.anchor===b.anchor&&sameRef(a.versionRef,b.versionRef);
const matchingDesign=(index:DesignIndexView,target:PlanTraceRef)=>index.items.find(i=>target.kind==='DESIGN_ITEM'&&i.id===target.id&&i.localCode===target.localCode&&i.anchor===target.anchor&&sameRef(i.documentRef,target.versionRef));

/** 서버 계약을 바꾸지 않는 보관 계획의 정확 참조 조회. 호출자는 주체/보기 변경 시 active를 닫는다. */
export async function readStoredPlanReference(client:ApiClient,selection:StoredPlanSelection,active:()=>boolean){
 if(!selection||![selection.projectId,selection.userId,selection.clientId].every(v=>uuid.test(v))||!validRef(selection.planRef)||typeof selection.taskCode!=='string'||!selection.target||!validRef(selection.target.versionRef))throw new ApiError('WORK_PLAN_REFERENCE_INVALID');
 const selected=structuredClone(selection),check=()=>{if(!active())throw new ApiError('WORK_PLAN_REFERENCE_PAUSED');},changed=()=>new ApiError('WORK_PLAN_REFERENCE_CHANGED');check();
 const plan=await readWorkPlan(client,selected.projectId,selected.planRef);check();
 const tasks=plan.tasks.filter(t=>t.taskCode===selected.taskCode),target=selected.target;
 if(plan.relationalProjection!=='STORED'||tasks.length!==1)throw changed();
 const task=tasks[0]!,refs=target.kind==='DESIGN_ITEM'?task.designRefs:target.kind==='SCREEN_REGION'?task.screenRefs:[];
 if(refs.filter(r=>sameTarget(r,target)).length!==1)throw changed();
 const index=await readDesignIndex(client,selected.projectId,plan.designRef);check();
 let screen:DesignIndexView['screenRegions'][number]|undefined;
 if(target.kind==='DESIGN_ITEM'){if(!sameRef(target.versionRef,plan.designRef)||!matchingDesign(index,target))throw changed();}
 else{
  screen=index.screenRegions.find(r=>r.id===target.id&&r.screenCode===target.localCode&&r.anchor===target.anchor&&sameRef(r.documentRef,target.versionRef));
  if(!screen||!task.designRefs.some(r=>matchingDesign(index,r)?.id===screen!.designItemId))throw changed();
 }
 const value=await readDocument(client,selected.projectId,target.versionRef.id,target.versionRef.version);check();
 if(!sameRef(value.document,target.versionRef))throw changed();
 if(screen){const a=screen.artifactRef,b=value.document.content.body;if(a.artifactId!==b.artifactId||a.bytes!==b.bytes||a.contentHash!==b.contentHash||a.mediaType!==b.mediaType)throw changed();}
 const form=await getPinnedForm(client,value.document.formRef);check();
 if(form.definition.formCode!==(target.kind==='DESIGN_ITEM'?'AF02':'AF03'))throw new ApiError('WORK_PLAN_REFERENCE_KIND_INVALID');
 const anchorSelection:DesignAnchorSelection={projectId:selected.projectId,documentRef:{...target.versionRef},bodyHash:value.document.content.body.contentHash,anchor:target.anchor};
 return {...value,anchorSelection};
}
