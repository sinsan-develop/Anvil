import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readAssignmentDraftInput} from '../assignments/assignment-input.ts';
import {prepareReworkSuccessorDefinition} from './rework-successor-input.ts';

const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
class OriginMaterialFailure extends Error{}
function fail(code:string):never{throw new OriginMaterialFailure('REWORK_ORIGIN_'+code);}

/** 향후 저장할 snapshot material만 만든다. 그 안의 linkageStored=true는 저장 후 원장 규격이며
 * 이 반환의 storageVerified=false를 대체하지 않는다. public reader로 직접 반환하지 않는다.
 * context 시각/주체는 이후 authenticated transaction 경계가 제공하고 검증해야 한다.
 * 여기서는 실제 DB/영수증/감사·원자성/현재 권한을 검증하거나 저장하지 않는다. */
export function prepareReworkOriginMaterial(rawSources:unknown,rawRework:unknown,rawInput:unknown,rawDraft:unknown,rawContext:unknown,now:string){
 try{
  if(!isoV1(now)||Buffer.byteLength(canonicalJson({sources:rawSources,rework:rawRework,input:rawInput,draft:rawDraft,context:rawContext}))>2*1024*1024)fail('INPUT_LIMIT');
  const p=prepareReworkSuccessorDefinition(rawSources,rawRework,rawInput,now),draft=cloneV1(rawDraft),context=cloneV1(rawContext);
  if(!recordV1(context,['originId','userId','clientId','transactionAt'])||!uuidV1(context.originId)||!uuidV1(context.userId)||!uuidV1(context.clientId)
   ||!isoV1(context.transactionAt)||Date.parse(context.transactionAt)>Date.parse(now))fail('CONTEXT_INVALID');
  if(!recordV1(draft,['ref','snapshot'])||!refV1(draft.ref)||draft.ref.version!==1||draft.ref.id===p.sourceAssignmentRef.id)fail('DRAFT_INVALID');
  const s=draft.snapshot;
  if(!recordV1(s,['definition','reason','previousRef','basis','readinessIssues','status','ready','executionAuthorized','dispatchPerformed'])
   ||!same(s.definition,p.definition)||s.reason!==p.reason||s.previousRef!==null||s.status!=='DRAFT'||s.ready!==false||s.executionAuthorized!==false||s.dispatchPerformed!==false
   ||hash(s)!==draft.ref.contentHash)fail('DRAFT_INVALID');
  const b=s.basis,d=p.definition;
  if(!recordV1(b,['planRef','applicationRef','designRef','taskCode','nodeId','taskCardHash'])||!same(b.planRef,d.taskRef.planRef)||!same(b.applicationRef,d.taskRef.applicationRef)
   ||b.taskCode!==d.taskRef.taskCode||b.nodeId!==d.taskRef.nodeId||!refV1(b.designRef)||!hashV1(b.taskCardHash)
   ||!d.baselineRefs.some(ref=>same(ref,b.designRef)))fail('BASIS_INVALID');
  const analysis=readAssignmentDraftInput({baseRef:null,definition:s.definition,reason:s.reason});
  if(!same(s.readinessIssues,analysis.readinessIssues))fail('READINESS_INVALID');

  const originSnapshot={kind:'REWORK_ASSIGNMENT_ORIGIN_V1' as const,projectId:p.projectId,
   sourceReworkRef:p.sourceReworkRef,sourceResultRef:p.sourceResultRef,sourceReviewRef:p.sourceReviewRef,sourceCriteriaRef:p.sourceCriteriaRef,
   sourceAssignmentRef:p.sourceAssignmentRef,sourceExecutionRef:p.sourceExecutionRef,sourceRoleRef:p.sourceRoleRef,sourceBindingRef:p.sourceBindingRef,
   stageSessionRef:p.stageSessionRef,connectionRef:p.connectionRef,stageRef:p.stageRef,sourceTaskRef:p.sourceTaskRef,
   selectedCriteriaIds:p.selectedCriteriaIds,remainingCriteriaIds:p.remainingCriteriaIds,preservedCriteriaIds:p.preservedCriteriaIds,sourceScopes:p.sourceScopes,
   successorDraftRef:draft.ref,definitionHash:p.definitionHash,requestedBy:{userId:context.userId,clientId:context.clientId},requestedAt:context.transactionAt,
   linkageStored:true,contentConfirmed:false,currentReservationVerified:false,executionAuthorized:false,dispatchPerformed:false,completionAccepted:false,formalFailureCounted:false};
  const originRef={id:context.originId,version:1,contentHash:hash(originSnapshot)};
  return cloneV1({status:'REWORK_ORIGIN_MATERIAL_NOT_STORED' as const,originRef,originSnapshot,storageVerified:false,currentAuthorityVerified:false,executionAuthorized:false,dispatchPerformed:false});
 }catch(error){if(error instanceof OriginMaterialFailure)throw error;fail('INPUT_INVALID');}
}
