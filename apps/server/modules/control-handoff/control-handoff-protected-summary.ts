import {AuthFailure} from '../access/repository.ts';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {isoV1,recordV1,refV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import type {ControlRequestSnapshot} from './control-request-snapshot.ts';
import {assertHandoffEvidence,handoffCategories,type HandoffEvidence,type HandoffEvidenceScope,HandoffBudget} from './control-handoff-evidence-source.ts';
import {controlHash,copyControlData,freezeControl,isControlBasis,sameControl,type ControlBasis} from './control-grant.ts';
const fail=():never=>{throw new AuthFailure('PROTECTED_HANDOFF_SUMMARY_INVALID',503);};
export interface ProtectedHandoffSnapshot{schemaVersion:2;purpose:'CONTROL_HANDOFF_PROTECTED_SUMMARY';projectId:string;requestRef:RuntimeRefV1;summaryVersion:number;baseControl:ControlBasis;targetActorRef:{userId:string};targetClientRef:{userId:string;clientId:string};observedAt:string;validUntil:string;collections:HandoffEvidence['collections'];gaps:string[];transferState:HandoffEvidence['transferState'];executionAuthorized:false;dispatchPerformed:false;controlTransferred:false}
export interface ProtectedHandoffSummary{ref:RuntimeRefV1;snapshot:ProtectedHandoffSnapshot}
export function issueProtectedHandoffSummary(input:{scope:HandoffEvidenceScope;request:ControlRequestSnapshot;version:number;observedAt:string;evidence:HandoffEvidence},db:object,lease:HandoffBudget):ProtectedHandoffSummary{
 assertHandoffEvidence(input.evidence,db,input.scope,lease);const request=copyControlData(input.request),scope=copyControlData(input.scope);
 if(!sameControl(request.baseControl,scope.baseControl)||request.projectId!==scope.projectId||!Number.isSafeInteger(input.version)||input.version<1||!isoV1(input.observedAt)||Math.abs(Date.parse(input.observedAt)-lease.at())>1)fail();
 const validUntil=new Date(Math.min(Date.parse(input.observedAt)+30000,Date.parse(request.expiresAt),Date.parse(input.evidence.validUntil))).toISOString();lease.narrow(validUntil);
 const snapshot:ProtectedHandoffSnapshot={schemaVersion:2,purpose:'CONTROL_HANDOFF_PROTECTED_SUMMARY',projectId:scope.projectId,requestRef:scope.requestRef,summaryVersion:input.version,baseControl:scope.baseControl,targetActorRef:request.targetActorRef,targetClientRef:request.targetClientRef,observedAt:input.observedAt,validUntil,collections:copyControlData(input.evidence.collections),gaps:[...input.evidence.gaps],transferState:input.evidence.transferState,executionAuthorized:false,dispatchPerformed:false,controlTransferred:false};
 return readProtectedHandoffSummary({ref:{id:scope.requestRef.id,version:input.version,contentHash:controlHash(snapshot)},snapshot});
}
/** 저장 원형만 검산한다. 이 함수는 새 현재성/private provenance를 발급하지 않는다. */
export function readProtectedHandoffSummary(value:unknown):ProtectedHandoffSummary{
 const v=copyControlData(value,2*1024*1024);if(!recordV1(v,['ref','snapshot'])||!refV1(v.ref)||!recordV1(v.snapshot,['schemaVersion','purpose','projectId','requestRef','summaryVersion','baseControl','targetActorRef','targetClientRef','observedAt','validUntil','collections','gaps','transferState','executionAuthorized','dispatchPerformed','controlTransferred']))return fail();
 const s=v.snapshot;if(s.schemaVersion!==2||s.purpose!=='CONTROL_HANDOFF_PROTECTED_SUMMARY'||!refV1(s.requestRef)||v.ref.id!==s.requestRef.id||v.ref.version!==s.summaryVersion||v.ref.contentHash!==controlHash(s)||!isControlBasis(s.baseControl)||!isoV1(s.observedAt)||!isoV1(s.validUntil)||Date.parse(s.validUntil)<=Date.parse(s.observedAt)||Date.parse(s.validUntil)-Date.parse(s.observedAt)>30000||s.executionAuthorized!==false||s.dispatchPerformed!==false||s.controlTransferred!==false||!recordV1(s.collections,handoffCategories)||!Array.isArray(s.gaps))return fail();
 let unknown=s.gaps.length>0,waiting=false;for(const key of handoffCategories){const c=s.collections[key];if(!recordV1(c,['state','scope','observedAt','expiresAt','coverage','items','gaps'])||!recordV1(c.scope,['projectId','requestRef','baseControl'])||c.scope.projectId!==s.projectId||!sameControl(c.scope.requestRef,s.requestRef)||!sameControl(c.scope.baseControl,s.baseControl)||!Array.isArray(c.items)||c.items.length>200||!Array.isArray(c.gaps)||!['VERIFIED_CURRENT','WAITING','UNKNOWN'].includes(c.state))fail();unknown ||=c.state==='UNKNOWN'||c.gaps.length>0;waiting ||=c.state==='WAITING';}
 if(s.transferState!==(unknown?'UNKNOWN':waiting?'WAITING':'READY')||Buffer.byteLength(canonicalJson(v))>2*1024*1024)fail();return freezeControl(v as unknown as ProtectedHandoffSummary);
}
