import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {resultFixture} from './result-view-fixture.ts';
import {resultExecutionSourceFor} from './result-execution-source-fixture.ts';
export function understandingHistoryFixture(){
 const f=resultFixture(),source=resultExecutionSourceFor(f.entry),s=source.execution.snapshot,scope={projectId:f.pid,executionId:s.executionId,executionGeneration:s.executionGeneration},at='2026-10-20T00:00:00.000Z';
 const ref=(n:number)=>({id:f.pid,version:n,contentHash:String(n).repeat(64)}),hash=(v:unknown)=>contentHash(canonicalJson(v));
 const codes=['PURPOSE_REASON','BASELINE_AUTHORITY','DECISIONS_REASON','CURRENT_POSITION','ACTUAL_GAPS','NEXT_ACTION'];
 const input={bundleRef:ref(1),responseRef:ref(2),subjectBindingRef:ref(3),criteriaVersion:1,items:codes.map(code=>({code,sourceRefs:[ref(4)],responsePartRefs:[ref(6)],judgement:'MATCH',reason:'원문을 대조한 보관 판단 <img src=x>'})),reason:'과거 별도 사람 검토'};
 const request={schemaVersion:1,projectId:f.pid,commandId:f.pid,clientId:f.pid,controlGeneration:1,operation:'reviewUnderstanding',targetId:s.executionId,expectedVersion:s.executionGeneration,baselineRefs:[],approvalRef:null,payload:input};
 const currentBinding={transport:'SYNTHETIC_ONLY',scope,bundleRef:ref(1),responseRef:ref(2),subjectBindingRef:ref(3),basisRefs:[ref(4)],latestInstructionRefs:[],requiredPartRefs:[ref(5)],receivedPartRefs:[ref(5)],responsePartRefs:[ref(6)],criteria:codes.map(code=>({code,sourceRefs:[ref(4)],responsePartRefs:[ref(6)]})),sourceState:'AVAILABLE',responseSubject:'EXTERNAL_AGENT'};
 const snapshot={scope,sequence:1,previousRef:null,request,requestHash:hash(request),reviewer:{kind:'HUMAN',userId:f.pid,clientId:f.pid,humanSessionId:f.pid,credentialGeneration:1,controlGeneration:1},policyRef:ref(7),currentBinding,input,outcome:'ACCEPTED',recordedAt:at,executionAuthorized:false,dispatchPerformed:false};
 const history={transport:'SYNTHETIC_ONLY',scope,items:[{ref:{id:f.pid,version:1,contentHash:hash(snapshot)},snapshot}],currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false};
 return{result:f.entry,source,history,scope,hash};
}
