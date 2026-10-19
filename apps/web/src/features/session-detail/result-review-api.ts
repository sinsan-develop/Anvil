import {ApiClient,ApiError} from '../../api/client.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import type {SubmittedResultView} from './result-api.ts';
export interface ResultReviewSourcesView{projectId:string;result:SubmittedResultView;assignment:ConfirmedAssignmentView;criteriaState:'TEXT_ONLY_NOT_MAPPED';issues:string[];reviewStored:false;completionAccepted:false;executionAuthorized:false;dispatchPerformed:false}
const exact=(v:any,keys:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(','),same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const ref=(v:any)=>exact(v,['id','version','contentHash'])&&uuid(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&typeof v.contentHash==='string'&&/^[a-f0-9]{64}$/.test(v.contentHash);
const date=(v:any)=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
function fail():never{throw new ApiError('RESULT_REVIEW_SOURCE_RESPONSE_INVALID');}
async function digest(v:unknown){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ordered(v))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
/** 앞서 hash 검증한 선택 제출/확정 임무와 같은 원문만 소비한다. 원문의 내용 적합·현재 기준 적용을 확정하지 않는다. */
export async function readResultReviewSources(client:ApiClient,projectId:string,result:SubmittedResultView,assignment:ConfirmedAssignmentView,active:()=>boolean):Promise<ResultReviewSourcesView|null>{
 if(!uuid(projectId)||!ref(result?.ref)||!ref(assignment?.ref)||result.snapshot?.scope?.projectId!==projectId||assignment.projectId!==projectId||!same(result.snapshot.scope.assignmentRef,assignment.ref))fail();
 const expectedResult=structuredClone(result),expectedAssignment=structuredClone(assignment);if(!active())return null;
 const v=await client.get<ResultReviewSourcesView>(`/api/v1/projects/${projectId}/results/${expectedResult.ref.id}/review-sources`);if(!active())return null;
 if(!exact(v,['projectId','result','assignment','criteriaState','issues','reviewStored','completionAccepted','executionAuthorized','dispatchPerformed'])||v.projectId!==projectId||!same(v.result,expectedResult)||!exact(v.assignment,['projectId','ref','snapshot','observedAt'])||v.assignment.projectId!==projectId||!same(v.assignment.ref,expectedAssignment.ref)||!same(v.assignment.snapshot,expectedAssignment.snapshot)||!date(v.assignment.observedAt)||v.criteriaState!=='TEXT_ONLY_NOT_MAPPED'||v.reviewStored!==false||v.completionAccepted!==false||v.executionAuthorized!==false||v.dispatchPerformed!==false||new TextEncoder().encode(ordered(v)).length>2*1024*1024)fail();
 const d=expectedAssignment.snapshot.definition,issues=['TYPED_CRITERIA_NOT_REGISTERED'];
 if(!same(expectedResult.snapshot.manifest.baselineRefs,d.baselineRefs))issues.push('RESULT_BASELINES_MISMATCH');
 if(d.environmentRef===null)issues.push('ENVIRONMENT_NOT_DEFINED');
 if(!d.acceptanceCriteria.length||d.acceptanceCriteria.some(s=>!s.trim()))issues.push('ACCEPTANCE_CRITERIA_MISSING');
 if(!d.verificationRequirements.length||d.verificationRequirements.some(s=>!s.trim()))issues.push('VERIFICATION_REQUIREMENTS_MISSING');
 if(!same(v.issues,issues)||await digest(v.result.snapshot)!==expectedResult.ref.contentHash||await digest(v.assignment.snapshot)!==expectedAssignment.ref.contentHash)fail();
 return active()?structuredClone(v):null;
}
