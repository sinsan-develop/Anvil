import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {blankPlanTask} from '../../../apps/web/src/features/design-trace/work-plan-api.ts';
import type {SessionDetail} from '../../../apps/web/src/features/session-detail/api.ts';
export const planProject='11111111-1111-4111-8111-111111111111',planId='33333333-3333-4333-8333-333333333333',assignmentId='22222222-2222-4222-8222-222222222222';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
export function assignmentPlanFixture(){
 const ref={id:planProject,version:1,contentHash:'a'.repeat(64)},at='2026-10-20T00:00:00.000Z';
 const task={...blankPlanTask(),taskCode:'FN09',title:'고정 계획의 원 업무',purpose:'단계책임자가 계획을 확인',ownerRole:'단계책임자',inputs:['고정 설계'],outputs:['처리 결과'],included:['요청 범위'],excluded:['운영 변경'],steps:['기준 확인'],acceptanceCriteria:['핵심 동작'],evidenceRequirements:['직접 증거'],rollback:'원본 유지',recoveryNotes:'미확인 별도 기록'};
 const planSnapshot={documentRef:ref,designRef:ref,screenReviewRefs:[],tasks:[task],dependencies:[],reason:'당시 작업 분해',issues:[],relationalProjection:'STORED' as const},planRef={id:planId,version:2,contentHash:hash(planSnapshot)};
 const plan={ref:planRef,status:'DRAFT' as const,...planSnapshot,executionEvidence:'NOT_CONNECTED' as const,observedAt:at};
 const definition={taskRef:{planRef,taskCode:'FN09',applicationRef:ref,nodeId:'개발'},baselineRefs:[],allowedScopes:[],environmentRef:null,budgetRef:null,parentAssignmentRef:null,recordingPolicyRef:null,purpose:'개발 통제',goal:'고정 임무의 업무 원문 확인',ownerRole:'단계책임자',integrationResponsibility:'검수',inputs:['설계'],outputs:['구현'],acceptanceCriteria:['동작'],verificationRequirements:['실패'],included:['임무'],excluded:['운영'],requiredCapabilities:[]};
 const snapshot={definition,reason:'고정 원문',previousRef:null,basis:{planRef,applicationRef:ref,designRef:ref,taskCode:'FN09',nodeId:'개발',taskCardHash:hash(task)},readinessIssues:[],status:'DRAFT' as const,ready:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
 const draftRef={id:assignmentId,version:1,contentHash:hash(snapshot)},draft={projectId:planProject,ref:draftRef,snapshot,headVersion:1,sourceCurrentness:'NOT_RECHECKED' as const,observedAt:at};
 const cs={draftRef,definition,reviewRefs:[ref],reason:'과거 내용 확정',confirmedBy:{kind:'HUMAN' as const,userId:planProject},confirmedAt:at,contentConfirmed:true as const,readinessIssues:[],ready:false as const,executionAuthorized:false as const,dispatchPerformed:false as const},confirmed={projectId:planProject,ref:{id:assignmentId,version:1,contentHash:hash(cs)},snapshot:cs,observedAt:at};
 const detail:Pick<SessionDetail,'projectId'|'draft'|'confirmed'>={projectId:planProject,draft,confirmed};
 return{detail,plan,task};
}
