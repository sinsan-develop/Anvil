import {ApiError} from '../../api/client.ts';
import type {DocumentBuffer,DocumentSession} from './editor-api.ts';
import {isKnownDocumentRejection} from './mutation-result.ts';
const normalized=(v:any):any=>Array.isArray(v)?v.map(normalized):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalized(v[k])])):v;
const same=(a:unknown,b:unknown)=>JSON.stringify(normalized(a))===JSON.stringify(normalized(b));
export function canReopenRejectedWorkPlan(b:DocumentBuffer,projectId:string,session:DocumentSession):boolean{
 const s=b.workPlanState,c=s?.pending;
 return b.projectId===projectId&&b.ownerUserId===session.user.id&&!b.pending&&!b.importState&&!b.importPreparationId&&!b.proposalState&&!b.designIndexState
  &&!!s&&!!c&&!s.uncertain&&!s.result&&!s.decision&&!s.traceLink&&isKnownDocumentRejection(s.failure)&&s.failure?.code!=='ARTIFACT_QUARANTINED'
  &&c.schemaVersion===1&&c.operation==='saveWorkPlanDraft'&&c.projectId===projectId&&c.clientId===session.clientId&&Number.isSafeInteger(b.controlGeneration)&&b.controlGeneration>0&&c.controlGeneration===b.controlGeneration
  &&c.targetId===(s.planRef?.id??null)&&c.expectedVersion===(s.planRef?.version??0)&&(c.approvalRef===null||!!s.approval?.commandHash&&!s.approval.request.uncertain&&!s.approval.request.pending&&same({...c,approvalRef:null},s.approval.request.candidate))&&Array.isArray(c.baselineRefs)&&c.baselineRefs.length===0
  &&same(c.payload,s.input)&&same(s.input.documentRef,{id:b.documentId,version:b.baseVersion,contentHash:b.baseHash});
}
/** 확실한 거절만 사용자 확인 뒤 재편집한다. 기준·입력·세대는 보존하고 저장은 별도 명령이다. */
export function reopenRejectedWorkPlan(b:DocumentBuffer,projectId:string,session:DocumentSession):DocumentBuffer{
 if(!canReopenRejectedWorkPlan(b,projectId,session))throw new ApiError('WORK_PLAN_REOPEN_BLOCKED');
 const s=b.workPlanState!;
 return{...b,dirty:true,workPlanState:{...s,pending:null,failure:null,sent:false,approval:undefined,approvalHistory:s.approval?[...s.approvalHistory??[],s.approval]:s.approvalHistory}};
}
