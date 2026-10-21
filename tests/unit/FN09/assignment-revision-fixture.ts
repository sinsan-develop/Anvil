import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
export function assignmentRevisionFixture(){
 const pid='11111111-1111-4111-8111-111111111111',id='55555555-5555-4555-8555-555555555555',ref={id:pid,version:1,contentHash:'a'.repeat(64)};
 const definition={taskRef:{planRef:ref,taskCode:'FN01',applicationRef:ref,nodeId:'N1'},purpose:'원 목적',goal:'이전 목표',baselineRefs:[ref],inputs:['입력'],outputs:['산출물'],acceptanceCriteria:['완료조건'],verificationRequirements:['검사'],included:['개발'],excluded:['운영'],allowedScopes:[],environmentRef:null,requiredCapabilities:['코드'],budgetRef:null,ownerRole:'책임자',parentAssignmentRef:null,recordingPolicyRef:null,integrationResponsibility:'검수'};
 const snapshot={definition,previousRef:null,reason:'이전 이유',basis:{planRef:ref,applicationRef:ref,designRef:ref,taskCode:'FN01',nodeId:'N1',taskCardHash:'b'.repeat(64)},readinessIssues:[{code:'EXECUTION_NOT_CONNECTED',location:'taskRef'}],status:'DRAFT',ready:false,executionAuthorized:false,dispatchPerformed:false};
 const previous={projectId:pid,ref:{id,version:1,contentHash:contentHash(canonicalJson(snapshot))},snapshot,headVersion:2,sourceCurrentness:'NOT_RECHECKED',observedAt:'2026-10-22T00:00:00Z'};
 const next:any=structuredClone(snapshot);next.previousRef=structuredClone(previous.ref);next.definition.goal='개정 목표 <script>globalThis.revisionExecuted=true</script>';next.reason='개정 이유';
 const current={...structuredClone(previous),ref:{id,version:2,contentHash:contentHash(canonicalJson(next))},snapshot:next};return{previous,current};
}
