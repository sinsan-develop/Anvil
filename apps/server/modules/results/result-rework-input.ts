import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceScopesV1,type SourceScopeV1} from '../../../../contracts/runtime/source-scope-v1.ts';
import {assertKnowledgeTextSafe} from '../knowledge/knowledge-entry.ts';
import {readProjectRole,readResponsibleSessionBinding} from '../assignments/responsible-sessions.ts';
import {prepareResultCriteria} from './result-criteria.ts';
import {prepareResultReview} from './result-review-input.ts';

export interface ResultReworkInput{resultRef:RuntimeRefV1;reviewRef:RuntimeRefV1;responsibleBindingRef:RuntimeRefV1;missingItems:string[];sourceScopes:SourceScopeV1[];reason:string}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
class ReworkInputFailure extends Error{}
function fail(code:string):never{throw new ReworkInputFailure('RESULT_REWORK_'+code);}
function input(raw:unknown):ResultReworkInput{
 const v=cloneV1(raw);
 if(!recordV1(v,['resultRef','reviewRef','responsibleBindingRef','missingItems','sourceScopes','reason'])||!refV1(v.resultRef)||!refV1(v.reviewRef)||!refV1(v.responsibleBindingRef)||!arrayV1(v.missingItems,100)||!v.missingItems.length||v.missingItems.some(id=>typeof id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(id))||new Set(v.missingItems).size!==v.missingItems.length||typeof v.reason!=='string'||!v.reason.trim()||!v.reason.isWellFormed()||v.reason.length>20000)fail('INPUT_INVALID');
 try{assertKnowledgeTextSafe(v.reason);return{...v,sourceScopes:readSourceScopesV1(v.sourceScopes)} as ResultReworkInput;}catch{fail('INPUT_INVALID');}
}
function within(child:SourceScopeV1[],parent:SourceScopeV1[]){return child.every(s=>{const p=parent.find(p=>same([p.sourceRootRef,p.mappingRef,p.observationRef,p.baselineRef],[s.sourceRootRef,s.mappingRef,s.observationRef,s.baselineRef]));return!!p&&s.targets.every(t=>p.targets.some(v=>v.relativePath===t.relativePath&&v.kind===t.kind&&v.recursive===t.recursive&&(v.access===t.access||v.access==='WRITE'&&t.access==='READ')));});}
function atOrBefore(at:unknown,now:string){return isoV1(at)&&Date.parse(at)<=Date.parse(now);}
/** 실 저장 reader가 가져온 원문을 결박하는 순수 준비다. 해시는 출처/현재성 증명이 아니다.
 * 현재 멤버/제어/정책·최신 binding·OS/실경로·영향 범위는 별도 저장/실행 경계에서 확인해야 한다.
 * 기존 SYNTHETIC_ONLY 검수 journal을 실 권한으로 승격하거나 새 임무/writer를 만들지 않는다. */
export function prepareResultRework(rawSources:unknown,rawInput:unknown,now:string){
 try{
  const s=cloneV1(rawSources),v=input(rawInput);
  if(!isoV1(now)||!recordV1(s,['assignment','result','criteria','review','role','binding'])||Buffer.byteLength(canonicalJson({sources:s,input:v}))>2*1024*1024)fail('SOURCE_INVALID');
  const {assignment:a,result:r,criteria:c,review:review,role,binding:b}=s;
  if(!recordV1(c,['projectId','ref','snapshot','input','sourceBindings','createdBy','registeredAt','registryStored','reviewStored','completionAccepted','executionAuthorized','dispatchPerformed','observedAt'])||!refV1(c.ref)||c.projectId!==a?.projectId||c.registryStored!==true||c.reviewStored!==false||c.completionAccepted!==false||c.executionAuthorized!==false||c.dispatchPerformed!==false||!uuidV1(c.createdBy)||!atOrBefore(c.registeredAt,now)||!atOrBefore(c.observedAt,now)||!atOrBefore(a?.observedAt,now))fail('SOURCE_INVALID');
  let p:ReturnType<typeof prepareResultCriteria>;
  try{p=prepareResultCriteria(a,c.input);}catch{fail('SOURCE_INVALID');}
  if(!same(p.criteriaSnapshot,c.snapshot)||!same(p.sourceBindings,c.sourceBindings)||p.contentHash!==c.ref.contentHash||!same(r?.ref,v.resultRef))fail('SOURCE_INVALID');
  if(!recordV1(review,['projectId','ref','snapshot','reviewStored','completionAccepted','formalFailureCounted','evidenceProvenanceVerified','executionAuthorized','dispatchPerformed','observedAt'])||!refV1(review.ref)||review.ref.version!==1||!same(review.ref,v.reviewRef)||review.ref.contentHash!==hash(review.snapshot)||review.projectId!==a.projectId||review.reviewStored!==true||review.completionAccepted!==false||review.formalFailureCounted!==false||review.evidenceProvenanceVerified!==false||review.executionAuthorized!==false||review.dispatchPerformed!==false||!atOrBefore(review.observedAt,now))fail('REVIEW_INVALID');
  const rs=review.snapshot;
  if(!recordV1(rs,['scope','input','reviewedBy','sameAsSubmitter','reviewedAt','evidenceProvenanceVerified','completionAccepted','formalFailureCounted','executionAuthorized','dispatchPerformed'])||!recordV1(rs.reviewedBy,['kind','userId','clientId'])||rs.reviewedBy.kind!=='HUMAN'||!uuidV1(rs.reviewedBy.userId)||!uuidV1(rs.reviewedBy.clientId)||!atOrBefore(rs.reviewedAt,now)||rs.evidenceProvenanceVerified!==false||rs.completionAccepted!==false||rs.formalFailureCounted!==false||rs.executionAuthorized!==false||rs.dispatchPerformed!==false)fail('REVIEW_INVALID');
  let reviewPrepared:ReturnType<typeof prepareResultReview>;
  try{reviewPrepared=prepareResultReview(r,{ref:c.ref,snapshot:c.snapshot},rs.input,now);}catch{fail('REVIEW_INVALID');}
  if(!same(rs.input.resultRef,v.resultRef)||!same(rs.scope,reviewPrepared.scope)||rs.scope.projectId!==a.projectId||!same(rs.scope.assignmentRef,a.ref)||Date.parse(rs.reviewedAt)<Date.parse(r.snapshot.submittedAt)||rs.sameAsSubmitter!==(rs.reviewedBy.userId===r.snapshot.submittedByRef.id))fail('REVIEW_INVALID');
  if(!recordV1(role,['projectId','ref','snapshot'])||role.projectId!==a.projectId||!refV1(role.ref)||role.ref.version!==1||role.ref.contentHash!==hash(role.snapshot)||!recordV1(role.snapshot,['kind','stageRef','parentRoleRef','reason','definedBy','definedAt']))fail('BINDING_INVALID');
  const roleS=role.snapshot;
  try{readProjectRole({kind:roleS.kind,stageRef:roleS.stageRef,parentRoleRef:roleS.parentRoleRef,reason:roleS.reason});}catch{fail('BINDING_INVALID');}
  if(roleS.kind!=='STAGE_OWNER'||!same(roleS.stageRef,{applicationRef:a.snapshot.definition.taskRef.applicationRef,nodeId:a.snapshot.definition.taskRef.nodeId})||!recordV1(roleS.definedBy,['kind','userId'])||roleS.definedBy.kind!=='HUMAN'||!uuidV1(roleS.definedBy.userId)||!atOrBefore(roleS.definedAt,now))fail('BINDING_INVALID');
  if(!recordV1(b,['projectId','ref','snapshot'])||b.projectId!==a.projectId||!refV1(b.ref)||!same(b.ref,v.responsibleBindingRef)||b.ref.contentHash!==hash(b.snapshot)||!recordV1(b.snapshot,['assignmentRef','roleRef','connectionRef','existingSessionBindingRef','reason','sessionRef','generation','state','externalSessionHandleRef','connectionReadiness','executionAuthorized','dispatchPerformed','boundBy','boundAt']))fail('BINDING_INVALID');
  const bs=b.snapshot;
  try{readResponsibleSessionBinding({assignmentRef:bs.assignmentRef,roleRef:bs.roleRef,connectionRef:bs.connectionRef,existingSessionBindingRef:bs.existingSessionBindingRef,reason:bs.reason});}catch{fail('BINDING_INVALID');}
  if(!same(bs.assignmentRef,a.ref)||!same(bs.roleRef,role.ref)||!refV1(bs.sessionRef)||bs.generation!==b.ref.version||bs.state!=='RESERVED'||bs.externalSessionHandleRef!==null||bs.connectionReadiness!=='CANDIDATE_ONLY'||bs.executionAuthorized!==false||bs.dispatchPerformed!==false||!recordV1(bs.boundBy,['kind','userId'])||bs.boundBy.kind!=='HUMAN'||!uuidV1(bs.boundBy.userId)||!atOrBefore(bs.boundAt,now)||Date.parse(bs.boundAt)<Date.parse(roleS.definedAt))fail('BINDING_INVALID');
  const missing=rs.input.items.filter((i:any)=>i.outcome==='REWORK'||i.outcome==='BLOCKED').map((i:any)=>i.criterionId) as string[];
  if(v.missingItems.some(id=>!missing.includes(id)))fail('NONMISSING_ITEM');
  let allowed:SourceScopeV1[];try{allowed=readSourceScopesV1(a.snapshot.definition.allowedScopes);}catch{fail('SCOPE_EXPANSION');}
  if(!within(v.sourceScopes,allowed))fail('SCOPE_EXPANSION');
  return cloneV1({status:'REWORK_ASSIGNMENT_DRAFT' as const,scope:reviewPrepared.scope,originalResultRef:v.resultRef,criteriaRef:c.ref,reviewRef:v.reviewRef,responsibleBindingRef:b.ref,roleRef:role.ref,stageSessionRef:bs.sessionRef,missingItems:v.missingItems,preservedItems:[] as string[],remainingMissingItems:missing.filter(id=>!v.missingItems.includes(id)),sourceScopes:v.sourceScopes,reason:v.reason,scopeVerification:'ASSIGNMENT_SUBSET_ONLY_NOT_OS_VERIFIED' as const,preparedAt:now,reworkStored:false as const,currentBindingVerified:false as const,currentAuthorityVerified:false as const,completionAccepted:false as const,formalFailureCounted:false as const,executionAuthorized:false as const,dispatchPerformed:false as const});
 }catch(error){if(error instanceof ReworkInputFailure)throw error;fail('SOURCE_INVALID');}
}
