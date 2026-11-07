import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type DispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {readSourceScopesV1,type SourceScopeV1} from '../../../../contracts/runtime/source-scope-v1.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
type Scope={projectId:string;executionId:string;executionGeneration:number};
export interface SyntheticQueuedCommandRecord{ref:Ref;snapshot:{transport:'SYNTHETIC_ONLY';executionId:string;executionGeneration:number;state:'SYNTHETIC_QUEUED';grantRef:Ref;reservationRef:Ref;executorRegistrationRef:Ref;operation:'START_SESSION';payload:{contextBundleRef:Ref;optionsRef:Ref};humanSessionId:string;sourceScopes:SourceScopeV1[];budgetPolicyRef:Ref;queuedAt:string;executionAuthorized:false;dispatchPerformed:false;envelope:DispatchEnvelopeV1}}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const reject=():never=>{throw new AuthFailure('QUEUED_COMMAND_RECORD_INVALID',503);};
/** 최초 queue의 불변 intent hash와 별도 receipt-bound 봉투를 대조한다.
 * 역사 문법뿐이며 현재grant/실제HUMAN영수증·outbox·명령순번/실제전달은 후속 저장 제공자가 별도로 확인해야 한다. */
export function readSyntheticQueuedCommandRecord(raw:unknown,scope:Scope):SyntheticQueuedCommandRecord{
 try{
  if(!recordV1(scope,['projectId','executionId','executionGeneration'])||!uuidV1(scope.projectId)||!uuidV1(scope.executionId)||!Number.isSafeInteger(scope.executionGeneration)||scope.executionGeneration<1||!recordV1(raw,['ref','snapshot'])||!refV1(raw.ref)||raw.ref.version!==1||!recordV1(raw.snapshot,['transport','executionId','executionGeneration','state','grantRef','reservationRef','executorRegistrationRef','operation','payload','humanSessionId','sourceScopes','budgetPolicyRef','queuedAt','executionAuthorized','dispatchPerformed','envelope'])||Buffer.byteLength(canonicalJson(raw))>2097152)return reject();
  const s=raw.snapshot,{envelope:_,...intent}=s;
  if(s.transport!=='SYNTHETIC_ONLY'||s.state!=='SYNTHETIC_QUEUED'||s.executionId!==scope.executionId||s.executionGeneration!==scope.executionGeneration||s.operation!=='START_SESSION'||s.executionAuthorized!==false||s.dispatchPerformed!==false||!uuidV1(s.humanSessionId)||!isoV1(s.queuedAt)||![s.grantRef,s.reservationRef,s.executorRegistrationRef,s.budgetPolicyRef].every(refV1)||raw.ref.contentHash!==contentHash(canonicalJson(intent)))return reject();
  readSourceScopesV1(s.sourceScopes);const e=readDispatchEnvelopeV1(s.envelope,Date.parse(s.queuedAt)),c=e.context;
  if(e.operation!=='START_SESSION'||e.issuedAt!==s.queuedAt||!same(e.executorRegistrationRef,s.executorRegistrationRef)||!same(e.payload,s.payload)||c.projectId!==scope.projectId||c.executionId!==scope.executionId||c.executionGeneration!==scope.executionGeneration||!same(c.sourceScopes,s.sourceScopes)||!same(c.budgetRef,s.reservationRef))return reject();
  return cloneV1(raw) as unknown as SyntheticQueuedCommandRecord;
 }catch{return reject();}
}
