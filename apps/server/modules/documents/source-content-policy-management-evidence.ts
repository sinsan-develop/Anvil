import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,uuidV1,refV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {buildSourceContentPolicySnapshotCandidate} from './source-content-policy-definition.ts';
import {inspectSourceContentPolicyLineageCandidate} from './source-content-policy-lineage.ts';

const invalid=():never=>{throw Error('SOURCE_CONTENT_POLICY_MANAGEMENT_EVIDENCE_INVALID');};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const commandKeys=['id','scopeKind','scopeId','projectId','actorId','clientId','operation','commandId','requestHash','operationId','state','authorizationReceiptId','approvalConsumptionId','expectedVersion','controlGeneration','policyRef','payloadRef','resultRef','completedAt'];
const resultKeys=['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt'];
const receiptKeys=['id','scopeKind','scopeId','commandId','subjectRef','policyRef','scopeDigest','approvalDecisionRef'];
const auditKeys=['projectId','serverSequence','eventId','actorRef','clientRef','commandId','operationId','targetRef','policyRef','approvalRef','outcome','reasonCode','scopeDigest','sourceKind','correctionOf','recordedAt'];
/** 원관리 기록의 구조만 대조한다. 현재 관리허가·보호 원문 생산자·실제 DB 원자성을 증명하지 않는다. */
export function inspectSourceContentPolicyManagementEvidenceCandidate(value:unknown,expected:unknown){
 try{
  const raw=canonicalJson(value),expectedRaw=canonicalJson(expected);
  if(Buffer.byteLength(raw,'utf8')>4194304||Buffer.byteLength(expectedRaw,'utf8')>4096)return invalid();
  const v:unknown=JSON.parse(raw),e:unknown=JSON.parse(expectedRaw);
  if(!recordV1(v,['previousEvent','policyEvent','originalRequest','command','receipt','audit'])||!recordV1(e,['projectId','policyRef','previousPolicyRef','managementCommandId','actorId','clientId','controlGeneration','basePolicyRef'])||
   ![e.projectId,e.managementCommandId,e.actorId,e.clientId].every(uuidV1)||!refV1(e.policyRef)||e.policyRef.version!==1||!refV1(e.basePolicyRef)||!Number.isSafeInteger(e.controlGeneration)||e.controlGeneration<1||(e.previousPolicyRef!==null&&(!refV1(e.previousPolicyRef)||e.previousPolicyRef.version!==1)))return invalid();
  const lineage=inspectSourceContentPolicyLineageCandidate(v.previousEvent,v.policyEvent);
  if(!same(lineage.policyRef,e.policyRef)||!same(lineage.previousRef,e.previousPolicyRef))return invalid();
  const event=v.policyEvent,request=v.originalRequest,c=v.command,ar=v.receipt,a=v.audit;
  if(!recordV1(request,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||Buffer.byteLength(canonicalJson(request),'utf8')>1048576||
   !recordV1(c,commandKeys)||!uuidV1(c.commandId)||!uuidV1(c.operationId)||!uuidV1(c.authorizationReceiptId)||!recordV1(c.resultRef,resultKeys)||!recordV1(ar,receiptKeys)||!recordV1(a,auditKeys)||!uuidV1(a.eventId)||!Number.isSafeInteger(a.serverSequence)||a.serverSequence<1||!isoV1(a.recordedAt))return invalid();
  const candidate=buildSourceContentPolicySnapshotCandidate(request.payload,{projectId:e.projectId,actorId:e.actorId,sequence:lineage.sequence,recordedAt:event.recorded_at});
  if(event.management_command_id!==e.managementCommandId||!same(candidate.snapshot,event.snapshot_json)||candidate.contentHash!==e.policyRef.contentHash||!same(candidate.previousPolicyRef,e.previousPolicyRef))return invalid();
  const original={schemaVersion:1,projectId:e.projectId,commandId:c.commandId,clientId:e.clientId,controlGeneration:e.controlGeneration,operation:'defineSourceContentPolicy',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:request.payload};
  if(!same(request,original))return invalid();
  // hash는 보존된 원 envelope에서 계산한다. snapshot 재구성으로 원문을 대신하지 않는다.
  const requestHash=contentHash(canonicalJson(request)),result=c.resultRef,target=e.policyRef;
  if(!isoV1(result.serverReceivedAt)||result.serverReceivedAt!==c.completedAt||Date.parse(event.recorded_at)>Date.parse(c.completedAt)||Date.parse(a.recordedAt)>Date.parse(c.completedAt))return invalid();
  const data={ref:target,status:'CONTENT_POLICY_EVENT_RECORDED',policyRef:target,previousPolicyRef:e.previousPolicyRef,sequence:lineage.sequence,executionAuthorized:false,agentDispatchPerformed:false,baselineConfirmed:false,linkAuthorized:false};
  const storedResult={operationId:c.operationId,commandId:c.commandId,projectId:e.projectId,status:'APPLIED',targetId:target.id,version:1,data,evidenceRefs:[],warnings:[],serverReceivedAt:result.serverReceivedAt};
  if(!same(result,storedResult))return invalid();
  const command={id:e.managementCommandId,scopeKind:'PROJECT',scopeId:e.projectId,projectId:e.projectId,actorId:e.actorId,clientId:e.clientId,operation:'defineSourceContentPolicy',commandId:c.commandId,requestHash,operationId:c.operationId,state:'APPLIED',authorizationReceiptId:c.authorizationReceiptId,approvalConsumptionId:null,expectedVersion:0,controlGeneration:e.controlGeneration,policyRef:e.basePolicyRef,payloadRef:null,resultRef:storedResult,completedAt:result.serverReceivedAt};
  if(!same(c,command))return invalid();
  const digest=contentHash(canonicalJson({projectId:e.projectId,actorId:e.actorId,clientId:e.clientId,controlGeneration:e.controlGeneration,requestHash,policyRef:e.basePolicyRef,targetRef:target}));
  const receipt={id:c.authorizationReceiptId,scopeKind:'PROJECT',scopeId:e.projectId,commandId:e.managementCommandId,subjectRef:{kind:'HUMAN',userId:e.actorId,clientId:e.clientId},policyRef:e.basePolicyRef,scopeDigest:digest,approvalDecisionRef:null};
  if(!same(ar,receipt))return invalid();
  const audit={projectId:e.projectId,serverSequence:a.serverSequence,eventId:a.eventId,actorRef:{kind:'HUMAN',userId:e.actorId},clientRef:e.clientId,commandId:e.managementCommandId,operationId:c.operationId,targetRef:target,policyRef:e.basePolicyRef,approvalRef:null,outcome:'APPLIED',reasonCode:'SOURCE_CONTENT_POLICY_EVENT_RECORDED',scopeDigest:digest,sourceKind:'HUMAN_COMMAND',correctionOf:null,recordedAt:a.recordedAt};
  if(!same(a,audit))return invalid();
  return {status:'UNVERIFIED' as const,reason:'MANAGEMENT_EVIDENCE_SHAPE_ONLY' as const,policyRef:target,previousPolicyRef:e.previousPolicyRef,managementCommandId:e.managementCommandId,requestHash,receiptRef:{id:ar.id,version:1,contentHash:digest},auditEventId:a.eventId,
   managementEvidenceVerified:false as const,currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const};
 }catch{return invalid();}
}
