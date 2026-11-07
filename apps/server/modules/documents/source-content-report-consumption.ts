import {canonicalJson} from '../../../../contracts/canonical.ts';
import {recordV1,uuidV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {planSourceContentRequestTransitionV1,type SourceContentRequestStateV1} from './source-content-request-transition.ts';

const invalid=():never=>{throw Error('SOURCE_CONTENT_REPORT_CONSUMPTION_INVALID');};
function snapshot(value:unknown):unknown {const raw=canonicalJson(value);if(Buffer.byteLength(raw,'utf8')>4*1048576)return invalid();return JSON.parse(raw);}
/** 원 보고 소비 view/프로토콜 감사의 구조 후보만 검사한다. 원문·서명/current 진위·nonce CAS/실DB 저장은 별도다. */
export function inspectSourceContentReportConsumptionV1(viewValue:unknown,auditValue:unknown) {
 try {
  const value=snapshot(viewValue),audit=snapshot(auditValue);
  if(!value||typeof value!=='object'||Array.isArray(value))return invalid();
  const view=value as SourceContentRequestStateV1;
  planSourceContentRequestTransitionV1(view,view,Date.parse(view.updatedAt));
  if(view.reportRef===null||view.reportCommandId===null||view.reportConsumedAt===null||!recordV1(audit,['projectId','serverSequence','eventId','actorRef','clientRef','commandId','operationId','targetRef','policyRef','approvalRef','outcome','reasonCode','scopeDigest','sourceKind','correctionOf','recordedAt'])||!uuidV1(audit.eventId)||!Number.isSafeInteger(audit.serverSequence)||audit.serverSequence<1||!isoV1(audit.recordedAt))return invalid();
  if(Date.parse(audit.recordedAt)<Date.parse(view.scope.requestedAt)||Date.parse(audit.recordedAt)>Date.parse(view.reportConsumedAt))return invalid();
  const s=view.scope,expected={projectId:s.projectId,serverSequence:audit.serverSequence,eventId:audit.eventId,actorRef:{kind:'CONNECTOR',connectorId:s.connectorRef.id,registrationId:s.registrationRef.id},clientRef:s.clientId,commandId:null,operationId:null,targetRef:view.reportRef,policyRef:s.basePolicyRef,approvalRef:null,outcome:'APPLIED',reasonCode:'SOURCE_CONTENT_REPORT_STORED',scopeDigest:view.requestRef.contentHash,sourceKind:'SOURCE_CONTENT_OBSERVATION_PROTOCOL',correctionOf:null,recordedAt:audit.recordedAt};
  if(canonicalJson(audit)!==canonicalJson(expected))return invalid();
  return {status:'UNVERIFIED_REPORT_CONSUMPTION_CANDIDATE' as const,requestRef:view.requestRef,reportRef:view.reportRef,reportCommandId:view.reportCommandId,auditEventId:audit.eventId,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const};
 }catch{return invalid();}
}
