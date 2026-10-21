import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {contentCriteria} from '../../../apps/web/src/features/workspace/assignment-confirmation-api.ts';
import {contextSlotCodes,readContextPreparationInput} from '../../../apps/server/modules/context/context-input.ts';
import {planContextText} from '../../../apps/server/modules/context/context-text-plan.ts';
import {buildContextManifest} from '../../../apps/server/modules/context/context-manifest.ts';
export const pid='11111111-1111-4111-8111-111111111111',aid='22222222-2222-4222-8222-222222222222',at='2026-10-21T12:00:00.000Z';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
export function transferFixture(){
 const ref={id:pid,version:1,contentHash:'a'.repeat(64)};
 const definition={taskRef:{planRef:ref,taskCode:'FN09',applicationRef:ref,nodeId:'개발'},baselineRefs:[],allowedScopes:[],environmentRef:null,budgetRef:null,parentAssignmentRef:null,recordingPolicyRef:null,purpose:'Agent가 바뀌어도 프로젝트 주도권 보존',goal:'고정 임무 읽기 인계 준비',ownerRole:'단계책임자',integrationResponsibility:'이력과 원문 연결',inputs:['설계'],outputs:['개발'],acceptanceCriteria:['핵심 처리 확인'],verificationRequirements:['직접 영향 검사'],included:['정확한 임무'],excluded:['새 Agent 실행'],requiredCapabilities:[]};
 const snapshot={definition,reason:'고정 임무',previousRef:null,basis:{planRef:ref,applicationRef:ref,designRef:ref,taskCode:'FN09',nodeId:'개발',taskCardHash:'b'.repeat(64)},readinessIssues:[],status:'DRAFT',ready:false,executionAuthorized:false,dispatchPerformed:false};
 const draftRef={id:aid,version:1,contentHash:hash(snapshot)},draft={projectId:pid,ref:draftRef,snapshot,headVersion:1,sourceCurrentness:'NOT_RECHECKED',observedAt:at};
 const fixed={draftRef,definition,reviewRefs:[ref],reason:'과거 내용 확정',confirmedBy:{kind:'HUMAN',userId:pid},confirmedAt:at,contentConfirmed:true,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false};
 const confirmedRef={id:aid,version:1,contentHash:hash(fixed)},confirmed={projectId:pid,ref:confirmedRef,snapshot:fixed,observedAt:at};
 const decision={projectId:pid,draftRef,criteriaVersion:1,criteria:contentCriteria,reviews:[],hasMoreReviews:false,contentIssues:[],currentIssue:'REVIEW_REQUIRED',confirmedRef,latestReviewAccepted:false,readinessIssues:[],ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt:at};
 const state={projectId:pid,assignmentRef:confirmedRef,roles:[],bindings:[],preparations:[],hasMorePreparations:false,currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false};
 const input=readContextPreparationInput({assignmentRef:confirmedRef,budgetRef:null,slots:contextSlotCodes.map(code=>({code,sources:[],reason:'원문 미선택 보존'})),limits:{maxPartBytes:1024,maxParts:20},reason:'기존 맥락 조회'});
 const originals=input.slots.map(slot=>({itemId:slot.code,category:slot.code,required:true,sourceRef:null,reason:slot.reason,state:'MISSING',bodyRef:null,body:null}));
 const planned=planContextText(originals,input.limits),prepared:any={preparationInput:input,assignmentRef:confirmedRef,baselineRefs:[],constitutionRef:null,budgetRef:null,bindings:originals.map(item=>({itemId:item.itemId,selection:null,bodyRef:null,sourceState:'NOT_SELECTED'})),...planned,unverified:[]};
 const built=buildContextManifest('33333333-3333-4333-8333-333333333333',pid,prepared),currentCheck={state:'MATCHED_METADATA',issues:[]};
 const context={projectId:pid,...built,currentCheck,ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt:at};
 const contexts={projectId:pid,assignmentRef:confirmedRef,items:[{ref:built.ref,missingRequired:built.manifest.missingRequired,excluded:built.manifest.excluded,currentCheck}],hasMore:true,limit:50,ready:false,executionAuthorized:false,dispatchPerformed:false,observedAt:at};
 const responses:Record<string,unknown>={['assignment-drafts/'+aid+'/versions/1']:draft,['assignment-drafts/'+aid+'/versions/1/decision']:decision,['assignments/'+aid+'/versions/1']:confirmed,['assignments/'+aid+'/versions/1/execution-preparation-state']:state,context:contexts,['context/'+built.ref.id+'/versions/1']:context};
 return{draft,confirmed,decision,state,context,contexts,responses};
}
