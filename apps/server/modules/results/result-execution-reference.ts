import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSyntheticQueuedCommandRecord} from '../executions/execution-command-record.ts';
import {planSyntheticExecutionGrant} from '../executions/execution-grants.ts';

const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
function reject():never {throw new Error('RESULT_EXECUTION_REFERENCE_INVALID');}
/** FN12 결과용 역사 실행 ref의 내부 정규화다. executions의 없는 hash 열을 추정하지 않는다.
 * 기존 START/원 grant를 원 plannedAt에서 문법 대조하고 (실행ID,세대,임무,원명령,grant,봉투/영수증)을 고정한다.
 * planner의 새 임시 UUID/ref는 사용·저장하지 않고 원 snapshot 동일성만 대조한다. 새 grant/허가 발행이 아니다.
 * 원 DB/권한·영수증/명령 출처는 caller 제공자가 검증해야 하며 hash만으로 출처/현재 허가를 증명하지 않는다. */
export function readSyntheticResultExecutionReference(expected:unknown,raw:unknown){
 try{
  if(!recordV1(expected,['projectId','assignmentRef','executionId','executionGeneration'])||!uuidV1(expected.projectId)||!refV1(expected.assignmentRef)||!uuidV1(expected.executionId)||!Number.isSafeInteger(expected.executionGeneration)||expected.executionGeneration<1||!recordV1(raw,['command','grant']))return reject();
  const scope={projectId:expected.projectId,executionId:expected.executionId,executionGeneration:expected.executionGeneration},command=readSyntheticQueuedCommandRecord(raw.command,scope),grant=raw.grant;
  if(!recordV1(grant,['ref','snapshot'])||!refV1(grant.ref)||grant.ref.version!==1||!same(grant.ref,command.snapshot.grantRef)||grant.ref.contentHash!==hash(grant.snapshot)||!recordV1(grant.snapshot,['kind','state','transport','binding','allowedOperations','expiresAt','scopeDigest','factHash','plannedAt','executionAuthorized','dispatchPerformed']))return reject();
  const g=grant.snapshot,planned=planSyntheticExecutionGrant(g.binding,g.plannedAt),f=planned.snapshot.binding,s=command.snapshot,c=s.envelope.context;
  if(!same(planned.snapshot,g)||g.plannedAt!==s.queuedAt||g.expiresAt!==s.envelope.expiresAt||f.projectId!==scope.projectId||f.executionId!==scope.executionId||f.executionGeneration!==scope.executionGeneration||!same(f.intent.assignmentRef,expected.assignmentRef)||c.assignmentId!==expected.assignmentRef.id||!same(s.executorRegistrationRef,f.registration.ref)||!same(s.reservationRef,f.budgetReservationRef)||s.humanSessionId!==f.subject.humanSessionId||!same(s.budgetPolicyRef,f.intent.budgetPolicyRef)||!same(s.sourceScopes,f.intent.sourceScopes)||!same(s.payload.contextBundleRef,f.intent.contextBundleRef)||!same(c.connectionRef,f.intent.connectionRef)||!same(c.environmentRef,f.intent.environmentRef)||!same(c.capabilityRef,f.intent.capabilityRef))return reject();
  const snapshot={schemaVersion:1,kind:'SYNTHETIC_RESULT_EXECUTION_REFERENCE',...scope,assignmentRef:cloneV1(expected.assignmentRef),initialCommandRef:cloneV1(command.ref),grantRef:cloneV1(grant.ref),envelopeHash:s.envelope.envelopeHash,authorizationReceiptRef:cloneV1(c.authorizationReceiptRef)};
  return{transport:'SYNTHETIC_ONLY' as const,scope:{projectId:scope.projectId,assignmentRef:cloneV1(expected.assignmentRef),executionRef:{id:scope.executionId,version:scope.executionGeneration,contentHash:hash(snapshot)}},snapshot,sourceAuthenticationVerified:false as const,currentAuthorizationVerified:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
 }catch{return reject();}
}
