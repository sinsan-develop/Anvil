import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import type {SourceScopeV1} from '../../../../contracts/runtime/source-scope-v1.ts';
import {readAssignmentDraftInput} from '../assignments/assignment-input.ts';
import {prepareResultRework} from './result-rework-input.ts';

const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const hash=(v:unknown)=>contentHash(canonicalJson(v));
class ReworkSuccessorFailure extends Error{}
function fail(code:string):never{throw new ReworkSuccessorFailure('REWORK_SUCCESSOR_'+code);}
const atOrBefore=(at:unknown,now:string)=>isoV1(at)&&Date.parse(at)<=Date.parse(now);

function within(child:SourceScopeV1[],parent:SourceScopeV1[]){
 return child.every(scope=>{
  const source=parent.find(item=>same(
   [item.sourceRootRef,item.mappingRef,item.observationRef,item.baselineRef],
   [scope.sourceRootRef,scope.mappingRef,scope.observationRef,scope.baselineRef]));
  return !!source&&scope.targets.every(target=>source.targets.some(original=>
   original.relativePath===target.relativePath&&original.kind===target.kind&&original.recursive===target.recursive
   &&(original.access===target.access||original.access==='WRITE'&&target.access==='READ')));
 });
}

/** B안의 순수 관계 검사/준비. 호출자는 저장 reader의 정확 원문을 전달해야 한다.
 * hash는 인증/멤버/허가/영수증/현재성/잠금/실제 출처를 증명하지 않는다.
 * 아직 draft/origin을 저장하지 않으며 기존 명령·확정/예약 경계를 열지 않는다. */
export function prepareReworkSuccessorDefinition(rawSources:unknown,rawRework:unknown,rawInput:unknown,now:string){
 try{
  if(!isoV1(now)||Buffer.byteLength(canonicalJson({sources:rawSources,rework:rawRework,input:rawInput}))>2*1024*1024)fail('INPUT_LIMIT');
  const sources=cloneV1(rawSources) as any,rework=cloneV1(rawRework),input=cloneV1(rawInput);
  if(!recordV1(input,['sourceReworkRef','definition','reason'])||!refV1(input.sourceReworkRef))fail('INPUT_INVALID');
  if(!recordV1(rework,['projectId','ref','status','snapshot','reworkStored','currentBindingVerified','currentAuthorityVerified','completionAccepted','formalFailureCounted','executionAuthorized','dispatchPerformed','observedAt'])
   ||!uuidV1(rework.projectId)||!refV1(rework.ref)||rework.ref.version!==1||!same(rework.ref,input.sourceReworkRef)
   ||rework.status!=='RESULT_REWORK_DRAFT_STORED'||rework.reworkStored!==true
   ||rework.currentBindingVerified!==false||rework.currentAuthorityVerified!==false||rework.completionAccepted!==false
   ||rework.formalFailureCounted!==false||rework.executionAuthorized!==false||rework.dispatchPerformed!==false
   ||!atOrBefore(rework.observedAt,now))fail('SOURCE_INVALID');
  const stored=rework.snapshot;
  if(!recordV1(stored,['scope','input','criteriaRef','roleRef','stageSessionRef','remainingMissingItems','preservedItems','requestedBy','requestedAt','scopeVerification','completionAccepted','formalFailureCounted','executionAuthorized','dispatchPerformed'])
   ||!recordV1(stored.requestedBy,['kind','userId','clientId'])||stored.requestedBy.kind!=='HUMAN'
   ||!uuidV1(stored.requestedBy.userId)||!uuidV1(stored.requestedBy.clientId)||!atOrBefore(stored.requestedAt,now)
   ||Date.parse(stored.requestedAt)>Date.parse(rework.observedAt)||hash(stored)!==rework.ref.contentHash)fail('SOURCE_INVALID');

  // 기존 reader와 같은 원보완 준비를 다시 계산해 caller가 재해시한 관계 변조도 거절한다.
  const prepared=prepareResultRework(sources,stored.input,now);
  const expected={scope:prepared.scope,input:stored.input,criteriaRef:prepared.criteriaRef,roleRef:prepared.roleRef,
   stageSessionRef:prepared.stageSessionRef,remainingMissingItems:prepared.remainingMissingItems,preservedItems:prepared.preservedItems,
   requestedBy:stored.requestedBy,requestedAt:stored.requestedAt,scopeVerification:prepared.scopeVerification,
   completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false};
  // requestedAt은 기존 transaction_timestamp이며 COMMIT/원문 생성의 상한이 아니다.
  // 잠금 대기 중 생긴 정합 원문을 시각만으로 거절하지 않는다. 현재성은 저장 경계의 책임이다.
  if(rework.projectId!==prepared.scope.projectId||!same(stored,expected))fail('SOURCE_MISMATCH');
  const analysis=readAssignmentDraftInput({baseRef:null,definition:input.definition,reason:input.reason});
  const definition=analysis.input.definition,original=sources.assignment.snapshot.definition;
  if(definition.parentAssignmentRef!==null)fail('ROOT_REQUIRED');

  // 첫 구현은 선택 조건/파일 범위와 설명 외 원임무 계약을 그대로 보존한다.
  // baseline/환경/예산/능력 등을 임의 축소·확대해 같은 조건인 것처럼 만들지 않는다.
  for(const key of ['taskRef','baselineRefs','inputs','outputs','included','excluded','environmentRef','requiredCapabilities','budgetRef','ownerRole','recordingPolicyRef','integrationResponsibility'] as const){
   if(!same(definition[key],original[key]))fail('CONTRACT_CHANGED');
  }
  if(!within(definition.allowedScopes,prepared.sourceScopes)||!definition.allowedScopes.length)fail('SCOPE_EXPANSION');

  const derived:{acceptanceCriteria:string[];verificationRequirements:string[]}={acceptanceCriteria:[],verificationRequirements:[]};
  const covered=new Set<string>();
  for(const criterionId of prepared.missingItems){
   const binding=sources.criteria.sourceBindings.find((item:any)=>item.criterionId===criterionId);
   if(!binding)fail('CRITERIA_MISSING');
   for(const source of binding.sources){
    // prepareResultRework의 기준 재계산이 field/index/hash를 이미 검증한다.
    const field=source.field as keyof typeof derived,key=field+':'+source.index;
    if(!covered.has(key)){covered.add(key);derived[field].push(original[field][source.index]);}
   }
  }
  if(!same(definition.acceptanceCriteria,derived.acceptanceCriteria)||!same(definition.verificationRequirements,derived.verificationRequirements))fail('CRITERIA_MISMATCH');

  return cloneV1({status:'REWORK_SUCCESSOR_PREPARED_NOT_STORED' as const,projectId:rework.projectId,
   sourceReworkRef:rework.ref,sourceResultRef:prepared.originalResultRef,sourceReviewRef:prepared.reviewRef,
   sourceCriteriaRef:prepared.criteriaRef,sourceAssignmentRef:prepared.scope.assignmentRef,sourceExecutionRef:prepared.scope.executionRef,
   sourceRoleRef:prepared.roleRef,sourceBindingRef:prepared.responsibleBindingRef,stageSessionRef:prepared.stageSessionRef,
   connectionRef:sources.binding.snapshot.connectionRef,stageRef:{applicationRef:definition.taskRef.applicationRef,nodeId:definition.taskRef.nodeId},
   sourceTaskRef:original.taskRef,selectedCriteriaIds:prepared.missingItems,remainingCriteriaIds:prepared.remainingMissingItems,
   preservedCriteriaIds:prepared.preservedItems,sourceScopes:definition.allowedScopes,definition,definitionHash:hash(definition),reason:analysis.input.reason,
   linkageStored:false,contentConfirmed:false,currentReservationVerified:false,completionAccepted:false,formalFailureCounted:false,
   executionAuthorized:false,dispatchPerformed:false});
 }catch(error){if(error instanceof ReworkSuccessorFailure)throw error;fail('INPUT_INVALID');}
}
