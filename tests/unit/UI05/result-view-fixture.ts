import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
export const hash=(v:unknown)=>contentHash(canonicalJson(v));
export function resultFixture(){
 const pid='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',at='2026-10-19T10:00:00.000Z',a={id,version:1,contentHash:'a'.repeat(64)},r={id:pid,version:1,contentHash:'b'.repeat(64)},scope={projectId:pid,assignmentRef:a,executionRef:r};
 const manifest={assignmentRef:a,executionRef:r,baselineRefs:[],submissionState:'INCOMPLETE',changes:[{path:'src/task.ts',kind:'MODIFIED',diffRef:null,beforeHash:null,afterHash:null}],commandResults:[],testResults:[{criterionId:'C1',testId:'T1',baselineRefs:[],expected:'저장',actual:'미실행',status:'NOT_EXECUTED',evidence:[]}],artifactRefs:[],unexecuted:[{criterionId:'C1',testId:'T1',reason:'실제 Agent 미연결'}],risks:['검수 미실행'],rollback:'원본 보존',checkpointRef:null};
 const snapshot={transport:'SYNTHETIC_ONLY',scope,submittedByRef:r,authorizationReceiptRef:r,manifest,manifestHash:hash(manifest),submittedAt:at,sourceKind:'WORKER_CLAIM',evidenceProvenanceVerified:false,completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false},entry={ref:{id,version:1,contentHash:hash(snapshot)},snapshot};
 const item={ref:entry.ref,manifestRef:{id,version:1,contentHash:snapshot.manifestHash},executionRef:r,submissionState:'INCOMPLETE',submittedByRef:r,submittedAt:at,sourceKind:'WORKER_CLAIM',evidenceProvenanceVerified:false,completionAccepted:false};
 const page={projectId:pid,assignmentRef:a,items:[item],hasMore:false,observedAt:at};return{pid,a,entry,item,page};
}
