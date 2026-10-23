import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,uuidV1,refV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceContentScopeV1} from '../../../../contracts/runtime/source-content-report-v1.ts';

const invalid=():never=>{throw Error('SOURCE_CONTENT_CREATION_EVIDENCE_INVALID');};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function snapshot(value:unknown):unknown {const raw=canonicalJson(value);if(Buffer.byteLength(raw,'utf8')>4*1048576)return invalid();return JSON.parse(raw);}
const requestKeys=['sourceRootRef','connectorRef','registrationRef','observerRef','targets','limits','expiresAt','reason'];
const commandKeys=['id','scopeKind','scopeId','projectId','actorId','clientId','operation','commandId','requestHash','operationId','state','authorizationReceiptId','approvalConsumptionId','expectedVersion','controlGeneration','policyRef','payloadRef','resultRef','completedAt'];
const resultKeys=['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt'];
const receiptKeys=['id','scopeKind','scopeId','commandId','subjectRef','policyRef','scopeDigest','approvalDecisionRef'];
const auditKeys=['projectId','serverSequence','eventId','actorRef','clientRef','commandId','operationId','targetRef','policyRef','approvalRef','outcome','reasonCode','scopeDigest','sourceKind'];

/** 생성 당시 보호 기록의 구조만 대조한다. 현재 권한·실제 DB 원자성은 증명하지 않는다. */
export function inspectSourceContentCreationEvidenceV1(value:unknown,expected:unknown) {
 try {
  const v=snapshot(value),e=snapshot(expected);
  if(!recordV1(v,['request','command','receipt','audit'])||!recordV1(e,['scope','requestRef','createdCommandId'])||!uuidV1(e.createdCommandId)||!refV1(e.requestRef)||e.requestRef.version!==1)return invalid();
  const scope=readSourceContentScopeV1(e.scope),target=e.requestRef;
  if(contentHash(canonicalJson(scope))!==target.contentHash)return invalid();
  const request=v.request,c=v.command,ar=v.receipt,a=v.audit;
  if(!recordV1(c,commandKeys)||!uuidV1(c.commandId)||!uuidV1(c.operationId)||!uuidV1(c.authorizationReceiptId)||!recordV1(c.resultRef,resultKeys)||!recordV1(ar,receiptKeys)||!recordV1(a,auditKeys)||!uuidV1(a.eventId)||!Number.isSafeInteger(a.serverSequence)||a.serverSequence<1)return invalid();
  const payload=Object.fromEntries(requestKeys.map(k=>[k,scope[k as keyof typeof scope]]));
  const original={schemaVersion:1,projectId:scope.projectId,commandId:c.commandId,clientId:scope.clientId,controlGeneration:scope.controlGeneration,operation:'requestSourceContentHash',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload};
  if(!same(request,original))return invalid();
  const requestHash=contentHash(canonicalJson(original)),result=c.resultRef;
  if(!isoV1(result.serverReceivedAt)||result.serverReceivedAt!==c.completedAt||Date.parse(result.serverReceivedAt)>Date.parse(scope.requestedAt))return invalid();
  const data={ref:target,status:'CONTENT_REQUEST_RECORDED',requestRef:target,scopeDigest:target.contentHash,storedState:'CREATED',scope,observationPermit:'NOT_ISSUED',executionAuthorized:false,agentDispatchPerformed:false,baselineConfirmed:false,linkAuthorized:false};
  const storedResult={operationId:c.operationId,commandId:c.commandId,projectId:scope.projectId,status:'APPLIED',targetId:target.id,version:1,data,evidenceRefs:[],warnings:[],serverReceivedAt:result.serverReceivedAt};
  if(!same(result,storedResult))return invalid();
  const storedCommand={id:e.createdCommandId,scopeKind:'PROJECT',scopeId:scope.projectId,projectId:scope.projectId,actorId:scope.userId,clientId:scope.clientId,operation:'requestSourceContentHash',commandId:c.commandId,requestHash,operationId:c.operationId,state:'APPLIED',authorizationReceiptId:c.authorizationReceiptId,approvalConsumptionId:null,expectedVersion:0,controlGeneration:scope.controlGeneration,policyRef:scope.basePolicyRef,payloadRef:null,resultRef:storedResult,completedAt:result.serverReceivedAt};
  if(!same(c,storedCommand))return invalid();
  const digest=contentHash(canonicalJson({projectId:scope.projectId,actorId:scope.userId,clientId:scope.clientId,controlGeneration:scope.controlGeneration,requestHash,policyRef:scope.basePolicyRef,targetRef:target}));
  const receipt={id:c.authorizationReceiptId,scopeKind:'PROJECT',scopeId:scope.projectId,commandId:e.createdCommandId,subjectRef:{kind:'HUMAN',userId:scope.userId,clientId:scope.clientId},policyRef:scope.basePolicyRef,scopeDigest:digest,approvalDecisionRef:null};
  if(!same(ar,receipt))return invalid();
  const audit={projectId:scope.projectId,serverSequence:a.serverSequence,eventId:a.eventId,actorRef:{kind:'HUMAN',userId:scope.userId},clientRef:scope.clientId,commandId:e.createdCommandId,operationId:c.operationId,targetRef:target,policyRef:scope.basePolicyRef,approvalRef:null,outcome:'APPLIED',reasonCode:'EXPLICIT_SOURCE_CONTENT_HASH_REQUEST',scopeDigest:digest,sourceKind:'HUMAN_COMMAND'};
  if(!same(a,audit))return invalid();
  return {status:'UNVERIFIED_CREATION_EVIDENCE_CANDIDATE' as const,requestRef:target,receiptRef:{id:ar.id,version:1,contentHash:digest},auditEventId:a.eventId,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const};
 }catch{return invalid();}
}
