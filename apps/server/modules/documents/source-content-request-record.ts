import {canonicalJson,contentHash,parseWireJson} from '../../../../contracts/canonical.ts';
import {recordV1,arrayV1,uuidV1,hashV1,isoV1,refV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceContentScopeV1,readSourceContentReportV1,type SourceContentReportV1} from '../../../../contracts/runtime/source-content-report-v1.ts';
import {readSourceContentPermitV1,sourceContentReportContextFromPermitV1,type SourceContentPermitV1} from '../../../../contracts/runtime/source-content-permit-v1.ts';
import {readSourceContentReportProofFromPermitCandidate} from '../connections/source-content-report-proof-input.ts';
import {readSourceContentDeclaredContextCandidate} from './source-content-request-context.ts';
import {readSourceContentRequestPolicyCandidate} from './source-content-request-policy.ts';
import {readSourceContentRequestPolicyLineageCandidate} from './source-content-request-policy-lineage.ts';
import {planSourceContentRevokeCandidate} from './source-content-revoke.ts';
import {readLatestSourceContentVerificationCandidate,readLatestSourceContentVerificationAfterReceivedCandidate,readLatestSourceContentVerificationLineageCandidate} from './source-content-verification-head.ts';
import {inspectSourceContentPolicyScopeCandidate} from './source-content-policy-scope.ts';
import type {SourceContentPolicyCandidate} from './source-content-policy-head.ts';
import {sourceContentRequestStatusFromParts} from './source-content-request-with-policy.ts';
import {readSourceContentChallengeV1} from '../../../../contracts/runtime/source-content-exchange-v1.ts';
import {planSourceContentRequestTransitionV1,type SourceContentRequestStateV1} from './source-content-request-transition.ts';
import {inspectSourceContentCreationEvidenceV1} from './source-content-creation-evidence.ts';
import {inspectSourceContentReportConsumptionV1} from './source-content-report-consumption.ts';

interface ReadClient {query(sql:string,args:unknown[]):Promise<{rows:unknown[]}>}
interface RecordCandidate {
 status:'UNVERIFIED_REQUEST_RECORD_CANDIDATE';view:SourceContentRequestStateV1;casDigest:string;
 creationEvidence:ReturnType<typeof inspectSourceContentCreationEvidenceV1>;
 reportConsumptionEvidence:ReturnType<typeof inspectSourceContentReportConsumptionV1>|null;
 storageMutationPerformed:false;executionAuthorized:false;linkAuthorized:false;
}
interface InternalObservation {permit:SourceContentPermitV1;report:SourceContentReportV1;receivedAt:string}
const fields=['project_id','id','version','scope_json','scope_digest','created_command_id','requested_by','client_id','credential_generation','control_generation','source_root_id','source_root_version','connector_id','registration_id','created_at','expires_at','updated_at','state','preflight_json','preflight_digest','challenge_json','challenge_issued_at','challenge_expires_at','credential_token_digest','credential_scope','credential_issued_at','credential_expires_at','observation_request_ref','observation_nonce_digest','permit_json','report_consumed_at','report_consumed_command_id','revoked_at','revoke_command_id','exchange_failures'];
const timeFields=['created_at','expires_at','updated_at','challenge_issued_at','challenge_expires_at','credential_issued_at','credential_expires_at','report_consumed_at','revoked_at'];
const invalid=():never=>{throw Error('SOURCE_CONTENT_RECORD_INVALID');};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const nonce=(v:unknown):v is string=>typeof v==='string'&&v.length===43&&/^[A-Za-z0-9_-]+$/.test(v)&&Buffer.from(v,'base64url').length===32&&Buffer.from(v,'base64url').toString('base64url')===v;
function integer(v:unknown):number {
 if(typeof v!=='number'&&(typeof v!=='string'||! /^(0|[1-9][0-9]{0,15})$/.test(v)))return invalid();
 const n=Number(v);if(!Number.isSafeInteger(n)||n<0)return invalid();return n;
}
function instant(v:unknown):string|null {
 if(v===null||isoV1(v))return v;
 if(v&&typeof v==='object'&&Object.getPrototypeOf(v)===Date.prototype){const s=Date.prototype.toISOString.call(v);if(isoV1(s))return s;}
 return invalid();
}
const sql=`SELECT ${fields.map(k=>`r.${k}`).join(',')},anvil.source_content_request_cas_digest(r) cas_digest,
 CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id',c.id,'scopeKind',c.scope_kind,'scopeId',c.scope_id,'projectId',c.project_id,'actorId',c.actor_id,'clientId',c.client_id,'operation',c.operation,'commandId',c.command_id,'requestHash',c.request_hash,'operationId',c.operation_id,'state',c.state,'authorizationReceiptId',c.authorization_receipt_id,'approvalConsumptionId',c.approval_consumption_id,'expectedVersion',c.expected_version,'controlGeneration',c.control_generation,'policyRef',c.policy_ref,'payloadRef',c.payload_ref,'resultRef',c.result_ref,'completedAt',anvil.source_read_iso(c.completed_at)) END created_command,
 CASE WHEN ar.id IS NULL THEN NULL ELSE jsonb_build_object('id',ar.id,'scopeKind',ar.scope_kind,'scopeId',ar.scope_id,'commandId',ar.command_id,'subjectRef',ar.subject_ref,'policyRef',ar.policy_ref,'scopeDigest',ar.scope_digest,'approvalDecisionRef',ar.approval_decision_ref) END authorization_receipt,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('projectId',a.project_id,'serverSequence',a.server_sequence,'eventId',a.event_id,'actorRef',a.actor_ref,'clientRef',a.client_ref,'commandId',a.command_id,'operationId',a.operation_id,'targetRef',a.target_ref,'policyRef',a.policy_ref,'approvalRef',a.approval_ref,'outcome',a.outcome,'reasonCode',a.reason_code,'scopeDigest',a.scope_digest,'sourceKind',a.source_kind,'correctionOf',a.correction_of)) FROM (SELECT * FROM anvil.audit_events ae WHERE ae.project_id=r.project_id AND ae.command_id=c.id LIMIT 2) a),'[]'::jsonb) creation_audits,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('projectId',a.project_id,'serverSequence',a.server_sequence,'eventId',a.event_id,'actorRef',a.actor_ref,'clientRef',a.client_ref,'commandId',a.command_id,'operationId',a.operation_id,'targetRef',a.target_ref,'policyRef',a.policy_ref,'approvalRef',a.approval_ref,'outcome',a.outcome,'reasonCode',a.reason_code,'scopeDigest',a.scope_digest,'sourceKind',a.source_kind,'correctionOf',a.correction_of,'recordedAt',anvil.source_read_iso(a.recorded_at))) FROM (SELECT * FROM anvil.audit_events ae WHERE ae.project_id=r.project_id AND o.id IS NOT NULL AND ae.target_ref=jsonb_build_object('id',o.id,'version',o.version,'contentHash',o.content_hash) LIMIT 2) a),'[]'::jsonb) report_audits,
 CASE WHEN o.id IS NULL THEN NULL ELSE jsonb_build_object('projectId',o.project_id,'id',o.id,'version',o.version,'requestId',o.request_id,'requestVersion',o.request_version,'scopeDigest',o.scope_digest,'reportCommandId',o.report_command_id,'report',o.report_json,'contentHash',o.content_hash,'signature',o.signature,'observedAt',anvil.source_read_iso(o.observed_at),'finishedAt',anvil.source_read_iso(o.finished_at),'receivedAt',anvil.source_read_iso(o.received_at),'evidenceClass',o.evidence_class,'osVerification',o.os_verification) END observation
 FROM anvil.source_content_requests r
 LEFT JOIN anvil.commands c ON c.project_id=r.project_id AND c.id=r.created_command_id
 LEFT JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind=c.scope_kind AND ar.scope_id=c.scope_id
 LEFT JOIN anvil.source_content_observations o ON o.project_id=r.project_id AND o.request_id=r.id
 WHERE r.project_id=$1 AND r.id=$2`;

/** 보호 저장행·생성 영수증/감사의 구조 후보만 판독한다. 실제 SQL/현재 권위·서명·OS·원자 저장은 별도이며 route 미등록이다. */
async function readRecord<T>(db:ReadClient,installationId:string,projectId:string,requestId:string,nowMs:number,consume:(record:RecordCandidate,observation:InternalObservation|null)=>T):Promise<T|null> {
 if(![installationId,projectId,requestId].every(uuidV1)||!Number.isSafeInteger(nowMs))return invalid();
 // 한 statement snapshot에서 읽고 누락 command/관측을 INNER JOIN으로 숨기지 않는다. DB 오류는 그대로 전파한다.
 const {rows}=await db.query(sql,[projectId,requestId]);
 try {
  if(!arrayV1(rows,1))return invalid();if(rows.length===0)return null;
  if(!recordV1(rows[0],[...fields,'cas_digest','created_command','authorization_receipt','creation_audits','report_audits','observation'])||!hashV1(rows[0].cas_digest))return invalid();
  const raw=rows[0],r:Record<string,any>={...raw};
  for(const k of timeFields)r[k]=instant(r[k]);
  const encoded=canonicalJson(r);if(Buffer.byteLength(encoded,'utf8')>4*1048576)return invalid();
  const v=JSON.parse(encoded) as Record<string,any>,s=readSourceContentScopeV1(v.scope_json);
  if(v.project_id!==projectId||v.id!==requestId||integer(v.version)!==1||s.installationId!==installationId||s.projectId!==projectId||contentHash(canonicalJson(s))!==v.scope_digest||s.userId!==v.requested_by||s.clientId!==v.client_id||s.credentialGeneration!==integer(v.credential_generation)||s.controlGeneration!==integer(v.control_generation)||s.sourceRootRef.id!==v.source_root_id||s.sourceRootRef.version!==integer(v.source_root_version)||s.connectorRef.id!==v.connector_id||s.registrationRef.id!==v.registration_id||s.requestedAt!==v.created_at||s.expiresAt!==v.expires_at||Date.parse(v.updated_at)>nowMs)return invalid();
  const c=v.created_command;
  const requestRef={id:requestId,version:1,contentHash:v.scope_digest};
  if(!c||typeof c!=='object'||!arrayV1(v.creation_audits,1)||v.creation_audits.length!==1)return invalid();
  const audit=v.creation_audits[0];
  if(!recordV1(audit,['projectId','serverSequence','eventId','actorRef','clientRef','commandId','operationId','targetRef','policyRef','approvalRef','outcome','reasonCode','scopeDigest','sourceKind','correctionOf'])||audit.correctionOf!==null)return invalid();
  const {correctionOf,...creationAudit}=audit;
  const payload=Object.fromEntries(['sourceRootRef','connectorRef','registrationRef','observerRef','targets','limits','expiresAt','reason'].map(k=>[k,s[k as keyof typeof s]]));
  const request={schemaVersion:1,projectId,commandId:c.commandId,clientId:s.clientId,controlGeneration:s.controlGeneration,operation:'requestSourceContentHash',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload};
  const creationEvidence=inspectSourceContentCreationEvidenceV1({request,command:c,receipt:v.authorization_receipt,audit:creationAudit},{scope:s,requestRef,createdCommandId:v.created_command_id});
  const ch=v.challenge_json;
  if(ch!==null){
   if(!recordV1(ch,['protocolVersion','purpose','installationId','projectId','connectorRef','registrationRef','observerRef','requestRef','scopeDigest','publicKeyFingerprint','clientNonce','expiresAt','serverNonce','issuedAt'])||ch.protocolVersion!==1||ch.purpose!=='SOURCE_CONTENT_EXCHANGE'||ch.installationId!==installationId||ch.projectId!==projectId||!['connectorRef','registrationRef','observerRef'].every(k=>same(ch[k],s[k as 'connectorRef']))||!same(ch.requestRef,requestRef)||ch.scopeDigest!==v.scope_digest||!hashV1(ch.publicKeyFingerprint)||!nonce(ch.clientNonce)||!nonce(ch.serverNonce)||ch.clientNonce===ch.serverNonce||ch.issuedAt!==v.challenge_issued_at||ch.expiresAt!==v.challenge_expires_at)return invalid();
   if(v.preflight_json===null||contentHash(canonicalJson(v.preflight_json))!==v.preflight_digest)return invalid();
   // 저장된 최초 원문을 사용한다. challenge에서 원 preflight를 역으로 재구성하지 않는다.
   readSourceContentChallengeV1(ch,v.preflight_json,{scope:s,requestRef,publicKeyFingerprint:ch.publicKeyFingerprint},Date.parse(ch.issuedAt));
  }else if(v.preflight_json!==null)return invalid();
  const p=v.permit_json;
  let permit:ReturnType<typeof readSourceContentPermitV1>|null=null;
  if(p!==null){
   if(!p||typeof p!=='object'||!nonce(p.observationNonce)||!isoV1(p.issuedAt)||!isoV1(p.serverNow)||Date.parse(p.serverNow)>Date.parse(v.updated_at)||contentHash(Buffer.from(p.observationNonce,'base64url'))!==v.observation_nonce_digest||v.credential_scope!=='SOURCE_DOCUMENT_CONTENT_HASH_ONLY')return invalid();
   const basis={scope:s,requestRef,observationRequestRef:v.observation_request_ref,observationNonce:p.observationNonce,credentialIssuedAt:v.credential_issued_at,credentialExpiresAt:v.credential_expires_at,issuedAt:p.issuedAt,observeBefore:p.observeBefore};
   // 관측 당시 고정 자료만 검사한다. 과거 행 조회를 현재 permit 유효 판정으로 사용하지 않는다.
   permit=readSourceContentPermitV1(p,basis,Date.parse(p.serverNow));
   if(ch===null||permit.observationNonce===ch.clientNonce||permit.observationNonce===ch.serverNonce)return invalid();
   if(Date.parse(permit.issuedAt)>Date.parse(v.updated_at))return invalid();
  }else if(v.credential_scope!==null)return invalid();
  const o=v.observation;
  let reportRef=null,observationInput:InternalObservation|null=null;
  if(o!==null){
   if(!permit||!recordV1(o,['projectId','id','version','requestId','requestVersion','scopeDigest','reportCommandId','report','contentHash','signature','observedAt','finishedAt','receivedAt','evidenceClass','osVerification'])||o.projectId!==projectId||!uuidV1(o.id)||integer(o.version)!==1||o.requestId!==requestId||integer(o.requestVersion)!==1||o.scopeDigest!==v.scope_digest||o.reportCommandId!==v.report_consumed_command_id||o.receivedAt!==v.report_consumed_at||o.evidenceClass!=='CONNECTOR_REPORTED'||o.osVerification!=='OS_UNVERIFIED')return invalid();
   const basis={scope:s,requestRef,observationRequestRef:permit.observationRequestRef,observationNonce:permit.observationNonce,credentialIssuedAt:permit.credential.issuedAt,credentialExpiresAt:permit.credential.expiresAt,issuedAt:permit.issuedAt,observeBefore:permit.observeBefore};
   const report=readSourceContentReportV1(o.report,sourceContentReportContextFromPermitV1(permit,basis,o.receivedAt));
   if(report.commandId!==o.reportCommandId||report.reportHash!==o.contentHash||report.signature!==o.signature||report.observedAt!==o.observedAt||report.finishedAt!==o.finishedAt)return invalid();
   reportRef={id:o.id,version:1,contentHash:o.contentHash};
   observationInput={permit,report,receivedAt:o.receivedAt};
  }
  const view:SourceContentRequestStateV1={scope:s,requestRef,state:v.state,preflightDigest:v.preflight_digest,challengeDigest:ch===null?null:contentHash(canonicalJson(ch)),challengeIssuedAt:v.challenge_issued_at,challengeExpiresAt:v.challenge_expires_at,credentialIssuedAt:v.credential_issued_at,credentialExpiresAt:v.credential_expires_at,observeBefore:permit?.observeBefore??null,credentialTokenDigest:v.credential_token_digest,observationRequestRef:v.observation_request_ref,observationNonceDigest:v.observation_nonce_digest,reportRef,reportCommandId:v.report_consumed_command_id,reportConsumedAt:v.report_consumed_at,revokedAt:v.revoked_at,revokeCommandId:v.revoke_command_id,exchangeFailures:integer(v.exchange_failures),updatedAt:v.updated_at};
  planSourceContentRequestTransitionV1(view,view,nowMs);
  if(!arrayV1(v.report_audits,1)||v.report_audits.length!==(reportRef===null?0:1))return invalid();
  const reportConsumptionEvidence=reportRef===null?null:inspectSourceContentReportConsumptionV1(view,v.report_audits[0]);
  return consume({status:'UNVERIFIED_REQUEST_RECORD_CANDIDATE',view,casDigest:v.cas_digest,creationEvidence,reportConsumptionEvidence,storageMutationPerformed:false,executionAuthorized:false,linkAuthorized:false},observationInput);
 }catch{return invalid();}
}

/** 기존 공개 반환을 보존하며 관측 원자료는 비공개 소비 접점 밖으로 보내지 않는다. */
export async function readSourceContentRequestRecordCandidate(db:ReadClient,installationId:string,projectId:string,requestId:string,nowMs:number) {
 return readRecord(db,installationId,projectId,requestId,nowMs,record=>record);
}

const proofFlags={storedRequestAuthenticated:false as const,signatureVerified:false as const,currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const};
/** 원보고 전체 성공/원target에서 조회 문맥만 도출한다. 보고의 주장과 저장head를 실제 verifier 권위로 승격하지 않는다. */
export async function readSourceContentStoredVerificationForDeclaredContextCandidate(db:ReadClient,value:unknown,targetIndex:number,nowMs:number){
 const c=readSourceContentDeclaredContextCandidate(value,nowMs);
 if(!Number.isSafeInteger(targetIndex)||targetIndex<0||targetIndex>199)throw Error('SOURCE_CONTENT_STORED_VERIFICATION_INPUT_INVALID');
 const flags={...proofFlags,bodyBytesVerified:false as const,readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const};
 const close=(reason:string)=>({status:'UNAVAILABLE' as const,reason,requestRef:null,observationRef:null,verificationRef:null,targetIndex:null,...flags});
 const result=await readRecord(db,c.installationId,c.projectId,c.requestRef.id,nowMs,async(record,observation)=>{
  if(!same(record.view.requestRef,c.requestRef))return close('STORED_REQUEST_REF_MISMATCH');
  const s=record.view.scope;
  if(s.userId!==c.userId||s.clientId!==c.clientId||s.credentialGeneration!==c.credentialGeneration||s.controlGeneration!==c.controlGeneration||!same(s.basePolicyRef,c.basePolicyRef))return close('DECLARED_VERIFICATION_CONTEXT_MISMATCH');
  if(!observation||!record.view.reportRef)return close('OBSERVATION_ABSENT');
  const report=observation.report;
  if(report.root.state!=='OBSERVED'||!report.localEvidence.completed||report.files.some(f=>f.state!=='HASHED'))return close('REPORT_NOT_COMPLETE');
  const target=s.targets[targetIndex];if(!target)return close('TARGET_INDEX_UNAVAILABLE');
  const head=await readLatestSourceContentVerificationCandidate(db,c.projectId,{observationRef:record.view.reportRef,targetIndex,relativePath:target.relativePath,documentRef:target.documentRef,observerImplementationRef:s.observerRef},nowMs);
  return {...head,requestRef:record.view.requestRef,observationRef:record.view.reportRef,targetIndex,...flags};
 });
 return result??close('REQUEST_ABSENT');
}
/** 원관측의 내부 수신시각만 사용한다. 기존 공개 검증 소비는 변경하지 않고 실제 verifier/현재 권위를 추가하지 않는다. */
export async function readSourceContentStoredVerificationAfterReceivedForDeclaredContextCandidate(db:ReadClient,value:unknown,targetIndex:number,nowMs:number){
 const c=readSourceContentDeclaredContextCandidate(value,nowMs);
 if(!Number.isSafeInteger(targetIndex)||targetIndex<0||targetIndex>199)throw Error('SOURCE_CONTENT_STORED_VERIFICATION_INPUT_INVALID');
 const flags={...proofFlags,bodyBytesVerified:false as const,readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const};
 const close=(reason:string)=>({status:'UNAVAILABLE' as const,reason,requestRef:null,observationRef:null,verificationRef:null,targetIndex:null,...flags});
 const result=await readRecord(db,c.installationId,c.projectId,c.requestRef.id,nowMs,async(record,observation)=>{
  if(!same(record.view.requestRef,c.requestRef))return close('STORED_REQUEST_REF_MISMATCH');
  const s=record.view.scope;
  if(s.userId!==c.userId||s.clientId!==c.clientId||s.credentialGeneration!==c.credentialGeneration||s.controlGeneration!==c.controlGeneration||!same(s.basePolicyRef,c.basePolicyRef))return close('DECLARED_VERIFICATION_CONTEXT_MISMATCH');
  if(!observation||!record.view.reportRef)return close('OBSERVATION_ABSENT');
  const report=observation.report;
  if(report.root.state!=='OBSERVED'||!report.localEvidence.completed||report.files.some(f=>f.state!=='HASHED'))return close('REPORT_NOT_COMPLETE');
  const target=s.targets[targetIndex];if(!target)return close('TARGET_INDEX_UNAVAILABLE');
  const head=await readLatestSourceContentVerificationAfterReceivedCandidate(db,c.projectId,{observationRef:record.view.reportRef,targetIndex,relativePath:target.relativePath,documentRef:target.documentRef,observerImplementationRef:s.observerRef},observation.receivedAt,nowMs);
  return {...head,requestRef:record.view.requestRef,observationRef:record.view.reportRef,targetIndex,...flags};
 });
 return result??close('REQUEST_ABSENT');
}
/** 제시된 관리 근거와 별도 최신 정책을 구분한다. 실제 현재 권위·원자성은 증명하지 않는다. */
export async function readSourceContentStoredVerificationLineageWithLatestPolicyForDeclaredContextCandidate(db:ReadClient,value:unknown,managementValue:unknown,operation:unknown,targetIndex:number,nowMs:number){
 const c=readSourceContentDeclaredContextCandidate(value,nowMs);
 if(!Number.isSafeInteger(targetIndex)||targetIndex<0||targetIndex>199)throw Error('SOURCE_CONTENT_STORED_VERIFICATION_INPUT_INVALID');
 let management:Record<string,any>;
 try{
  const raw=canonicalJson(managementValue);if(Buffer.byteLength(raw,'utf8')>4198400||typeof operation!=='string'||!['linkDocumentSource','requestSourceContentHash','revokeSourceContentHash'].includes(operation))throw Error();
  const v:unknown=JSON.parse(raw);if(!recordV1(v,['evidence','expected']))throw Error();management=v;
 }catch{throw Error('SOURCE_CONTENT_STORED_MANAGEMENT_INPUT_INVALID');}
 const flags={...proofFlags,managementEvidenceVerified:false as const,bodyBytesVerified:false as const,verifierEvidenceVerified:false as const,readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const};
 const close=(reason:string)=>({status:'UNAVAILABLE' as const,reason,requestRef:null,observationRef:null,policyRef:null,verificationRef:null,targetIndex:null,policyLineage:null,lineage:null,...flags});
 const result=await readRecord(db,c.installationId,c.projectId,c.requestRef.id,nowMs,async(record,observation)=>{
  if(!same(record.view.requestRef,c.requestRef))return close('STORED_REQUEST_REF_MISMATCH');
  const s=record.view.scope;
  if(s.userId!==c.userId||s.clientId!==c.clientId||s.credentialGeneration!==c.credentialGeneration||s.controlGeneration!==c.controlGeneration||!same(s.basePolicyRef,c.basePolicyRef))return close('DECLARED_VERIFICATION_CONTEXT_MISMATCH');
  if(record.view.state==='REVOKED')return close('REQUEST_REVOKED');
  if(record.view.state==='EXPIRED')return close('REQUEST_EXPIRED');
  if(!observation||!record.view.reportRef)return close('OBSERVATION_ABSENT');
  const report=observation.report;
  if(report.root.state!=='OBSERVED'||!report.localEvidence.completed||report.files.some(f=>f.state!=='HASHED'))return close('REPORT_NOT_COMPLETE');
  const target=s.targets[targetIndex];if(!target)return close('TARGET_INDEX_UNAVAILABLE');
  const managementPolicy=inspectSourceContentPolicyScopeCandidate(management.evidence,management.expected,s,operation,nowMs);
  if(managementPolicy.status!=='UNVERIFIED')return {...close(managementPolicy.reason),status:managementPolicy.status};
  const policy=await readSourceContentRequestPolicyLineageCandidate(db,s,nowMs);
  if(policy.status!=='UNVERIFIED')return {...close(policy.reason),status:policy.status};
  const head=await readLatestSourceContentVerificationLineageCandidate(db,c.projectId,{observationRef:record.view.reportRef,targetIndex,relativePath:target.relativePath,documentRef:target.documentRef,observerImplementationRef:s.observerRef},observation.receivedAt,nowMs);
  return {...head,requestRef:record.view.requestRef,observationRef:record.view.reportRef,policyRef:policy.policyRef,policyLineage:policy.lineage,targetIndex,...flags};
 });
 return result??close('REQUEST_ABSENT');
}
/** 원저장 관리범위·원수신시각을 최신 검증계보에 전달한다. 기존 head-only 경로와 실제 허가는 유지한다. */
export async function readSourceContentStoredVerificationLineageWithManagementForDeclaredContextCandidate(db:ReadClient,value:unknown,managementValue:unknown,operation:unknown,targetIndex:number,nowMs:number){
 const c=readSourceContentDeclaredContextCandidate(value,nowMs);
 if(!Number.isSafeInteger(targetIndex)||targetIndex<0||targetIndex>199)throw Error('SOURCE_CONTENT_STORED_VERIFICATION_INPUT_INVALID');
 let management:Record<string,any>;
 try{
  const raw=canonicalJson(managementValue);if(Buffer.byteLength(raw,'utf8')>4198400||typeof operation!=='string'||!['linkDocumentSource','requestSourceContentHash','revokeSourceContentHash'].includes(operation))throw Error();
  const v:unknown=JSON.parse(raw);if(!recordV1(v,['evidence','expected']))throw Error();management=v;
 }catch{throw Error('SOURCE_CONTENT_STORED_MANAGEMENT_INPUT_INVALID');}
 const flags={...proofFlags,managementEvidenceVerified:false as const,bodyBytesVerified:false as const,verifierEvidenceVerified:false as const,readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const};
 const close=(reason:string)=>({status:'UNAVAILABLE' as const,reason,requestRef:null,observationRef:null,policyRef:null,verificationRef:null,targetIndex:null,lineage:null,...flags});
 const result=await readRecord(db,c.installationId,c.projectId,c.requestRef.id,nowMs,async(record,observation)=>{
  if(!same(record.view.requestRef,c.requestRef))return close('STORED_REQUEST_REF_MISMATCH');
  const s=record.view.scope;
  if(s.userId!==c.userId||s.clientId!==c.clientId||s.credentialGeneration!==c.credentialGeneration||s.controlGeneration!==c.controlGeneration||!same(s.basePolicyRef,c.basePolicyRef))return close('DECLARED_VERIFICATION_CONTEXT_MISMATCH');
  if(record.view.state==='REVOKED')return close('REQUEST_REVOKED');
  if(record.view.state==='EXPIRED')return close('REQUEST_EXPIRED');
  if(!observation||!record.view.reportRef)return close('OBSERVATION_ABSENT');
  const report=observation.report;
  if(report.root.state!=='OBSERVED'||!report.localEvidence.completed||report.files.some(f=>f.state!=='HASHED'))return close('REPORT_NOT_COMPLETE');
  const target=s.targets[targetIndex];if(!target)return close('TARGET_INDEX_UNAVAILABLE');
  const policy=inspectSourceContentPolicyScopeCandidate(management.evidence,management.expected,s,operation,nowMs);
  if(policy.status!=='UNVERIFIED')return {...close(policy.reason),status:policy.status};
  const head=await readLatestSourceContentVerificationLineageCandidate(db,c.projectId,{observationRef:record.view.reportRef,targetIndex,relativePath:target.relativePath,documentRef:target.documentRef,observerImplementationRef:s.observerRef},observation.receivedAt,nowMs);
  return {...head,requestRef:record.view.requestRef,observationRef:record.view.reportRef,policyRef:policy.policyRef,targetIndex,...flags};
 });
 return result??close('REQUEST_ABSENT');
}
/** 한 원저장 판독에서 관리 범위와 원관측 수신시각을 결박한다. 현재 권위나 원자 조회를 증명하지 않는다. */
export async function readSourceContentStoredVerificationWithManagementForDeclaredContextCandidate(db:ReadClient,value:unknown,managementValue:unknown,operation:unknown,targetIndex:number,nowMs:number){
 const c=readSourceContentDeclaredContextCandidate(value,nowMs);
 if(!Number.isSafeInteger(targetIndex)||targetIndex<0||targetIndex>199)throw Error('SOURCE_CONTENT_STORED_VERIFICATION_INPUT_INVALID');
 let management:Record<string,any>;
 try{
  const raw=canonicalJson(managementValue);if(Buffer.byteLength(raw,'utf8')>4198400||typeof operation!=='string'||!['linkDocumentSource','requestSourceContentHash','revokeSourceContentHash'].includes(operation))throw Error();
  const v:unknown=JSON.parse(raw);if(!recordV1(v,['evidence','expected']))throw Error();management=v;
 }catch{throw Error('SOURCE_CONTENT_STORED_MANAGEMENT_INPUT_INVALID');}
 const flags={...proofFlags,managementEvidenceVerified:false as const,bodyBytesVerified:false as const,readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const};
 const close=(reason:string)=>({status:'UNAVAILABLE' as const,reason,requestRef:null,observationRef:null,policyRef:null,verificationRef:null,targetIndex:null,...flags});
 const result=await readRecord(db,c.installationId,c.projectId,c.requestRef.id,nowMs,async(record,observation)=>{
  if(!same(record.view.requestRef,c.requestRef))return close('STORED_REQUEST_REF_MISMATCH');
  const s=record.view.scope;
  if(s.userId!==c.userId||s.clientId!==c.clientId||s.credentialGeneration!==c.credentialGeneration||s.controlGeneration!==c.controlGeneration||!same(s.basePolicyRef,c.basePolicyRef))return close('DECLARED_VERIFICATION_CONTEXT_MISMATCH');
  if(record.view.state==='REVOKED')return close('REQUEST_REVOKED');
  if(record.view.state==='EXPIRED')return close('REQUEST_EXPIRED');
  if(!observation||!record.view.reportRef)return close('OBSERVATION_ABSENT');
  const report=observation.report;
  if(report.root.state!=='OBSERVED'||!report.localEvidence.completed||report.files.some(f=>f.state!=='HASHED'))return close('REPORT_NOT_COMPLETE');
  const target=s.targets[targetIndex];if(!target)return close('TARGET_INDEX_UNAVAILABLE');
  const policy=inspectSourceContentPolicyScopeCandidate(management.evidence,management.expected,s,operation,nowMs);
  if(policy.status!=='UNVERIFIED')return {...close(policy.reason),status:policy.status};
  const head=await readLatestSourceContentVerificationAfterReceivedCandidate(db,c.projectId,{observationRef:record.view.reportRef,targetIndex,relativePath:target.relativePath,documentRef:target.documentRef,observerImplementationRef:s.observerRef},observation.receivedAt,nowMs);
  return {...head,requestRef:record.view.requestRef,observationRef:record.view.reportRef,policyRef:policy.policyRef,targetIndex,...flags};
 });
 return result??close('REQUEST_ABSENT');
}
/** 저장 증거/선언 문맥의 과거 결박만 소비한다. 현재 회수 허가·실제 UPDATE/route를 만들지 않는다. */
export async function readSourceContentStoredRevokeForDeclaredContextCandidate(db:ReadClient,value:unknown,payloadValue:unknown,commandId:unknown,nowMs:number){
 const c=readSourceContentDeclaredContextCandidate(value,nowMs);
 const flags={storedRequestAuthenticated:false as const,currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const};
 const close=(reason:string)=>({status:'UNAVAILABLE' as const,reason,candidate:null,...flags});
 let payload:Record<string,any>;
 try {
  const raw=canonicalJson(payloadValue);if(Buffer.byteLength(raw,'utf8')>1048576||!uuidV1(commandId))throw Error();
  const p:unknown=JSON.parse(raw);if(!recordV1(p,['requestRef','reason'])||!refV1(p.requestRef)||p.requestRef.version!==1)throw Error();payload=p;
 }catch{throw Error('SOURCE_CONTENT_STORED_REVOKE_INPUT_INVALID');}
 if(!same(payload.requestRef,c.requestRef))return close('REVOKE_PAYLOAD_REQUEST_REF_MISMATCH');
 const result=await readRecord(db,c.installationId,c.projectId,c.requestRef.id,nowMs,async record=>{
  if(!same(record.view.requestRef,c.requestRef))return close('STORED_REQUEST_REF_MISMATCH');
  const s=record.view.scope;
  if(s.userId!==c.userId||s.clientId!==c.clientId||s.credentialGeneration!==c.credentialGeneration||s.controlGeneration!==c.controlGeneration||!same(s.basePolicyRef,c.basePolicyRef))return close('DECLARED_REVOKE_CONTEXT_MISMATCH');
  const candidate=planSourceContentRevokeCandidate(record.view,payload,commandId,record.casDigest,nowMs);
  return {status:'UNVERIFIED' as const,reason:'STORED_REVOKE_TRANSITION_ONLY',candidate,...flags};
 });
 return result??close('REQUEST_ABSENT');
}
const storedLineageFlags={storedRequestAuthenticated:false as const,managementEvidenceVerified:false as const,currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const};
/** 원문 파싱만 선행하고 기존 선언/저장 판독을 그대로 소비한다. 보호 원문 생산자나 실제 인증은 추가하지 않는다. */
export async function readSourceContentStoredManagementScopeWireForDeclaredContextCandidate(db:ReadClient,value:unknown,raw:unknown,expected:unknown,operation:unknown,nowMs:number){
 let evidence:unknown;
 try{
  if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>4194304)throw Error();
  evidence=parseWireJson(raw);
 }catch{throw Error('SOURCE_CONTENT_STORED_MANAGEMENT_WIRE_INVALID');}
 // await/catch로 기존 비동기 DB·저장 증거 오류를 원문 파싱 오류로 바꾸지 않는다.
 return readSourceContentStoredManagementScopeForDeclaredContextCandidate(db,value,{evidence,expected},operation,nowMs);
}
/** 원저장 scope만 관리 범위 후보에 전달한다. 제공된 관리 기록과 저장행은 현재 인증·원자 조회 증거가 아니다. */
export async function readSourceContentStoredManagementScopeForDeclaredContextCandidate(db:ReadClient,value:unknown,managementValue:unknown,operation:unknown,nowMs:number){
 const c=readSourceContentDeclaredContextCandidate(value,nowMs);
 let management:Record<string,any>;
 try{
  const raw=canonicalJson(managementValue);if(Buffer.byteLength(raw,'utf8')>4198400||typeof operation!=='string'||!['linkDocumentSource','requestSourceContentHash','revokeSourceContentHash'].includes(operation))throw Error();
  const v:unknown=JSON.parse(raw);if(!recordV1(v,['evidence','expected']))throw Error();management=v;
 }catch{throw Error('SOURCE_CONTENT_STORED_MANAGEMENT_INPUT_INVALID');}
 const close=(reason:string)=>({status:'UNAVAILABLE' as const,reason,requestRef:null,policyRef:null,readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const,...storedLineageFlags});
 const result=await readRecord(db,c.installationId,c.projectId,c.requestRef.id,nowMs,async record=>{
  if(!same(record.view.requestRef,c.requestRef))return close('STORED_REQUEST_REF_MISMATCH');
  const s=record.view.scope;
  if(s.userId!==c.userId||s.clientId!==c.clientId||s.credentialGeneration!==c.credentialGeneration||s.controlGeneration!==c.controlGeneration||!same(s.basePolicyRef,c.basePolicyRef))return close('DECLARED_MANAGEMENT_CONTEXT_MISMATCH');
  if(record.view.state==='REVOKED')return close('REQUEST_REVOKED');
  if(record.view.state==='EXPIRED')return close('REQUEST_EXPIRED');
  const policy=inspectSourceContentPolicyScopeCandidate(management.evidence,management.expected,s,operation,nowMs);
  return {status:policy.status,reason:policy.reason,requestRef:record.view.requestRef,policyRef:policy.policyRef,readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const,...storedLineageFlags};
 });
 return result??close('REQUEST_ABSENT');
}
/** 원요청의 선언 문맥과 인접 정책계보만 결박한다. 기존 정책/표시/proof 경로와 실제 권한은 변경하지 않는다. */
export async function readSourceContentStoredPolicyLineageForDeclaredContextCandidate(db:ReadClient,value:unknown,nowMs:number) {
 const c=readSourceContentDeclaredContextCandidate(value,nowMs);
 const close=(reason:string)=>({status:'UNAVAILABLE' as const,reason,requestRef:null,policyRef:null,lineage:null,readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const,...storedLineageFlags});
 const result=await readRecord(db,c.installationId,c.projectId,c.requestRef.id,nowMs,async record=>{
  if(!same(record.view.requestRef,c.requestRef))return close('STORED_REQUEST_REF_MISMATCH');
  const s=record.view.scope;
  if(s.userId!==c.userId||s.clientId!==c.clientId||s.credentialGeneration!==c.credentialGeneration||s.controlGeneration!==c.controlGeneration||!same(s.basePolicyRef,c.basePolicyRef))return close('DECLARED_POLICY_CONTEXT_MISMATCH');
  const policy=await readSourceContentRequestPolicyLineageCandidate(db,s,nowMs);
  return {status:policy.status,reason:policy.reason,requestRef:record.view.requestRef,policyRef:policy.policyRef,lineage:policy.lineage,readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const,...storedLineageFlags};
 });
 return result??close('REQUEST_ABSENT');
}
const proofClosed=(reason:string)=>({status:'UNAVAILABLE' as const,reason,candidate:null,...proofFlags});
/** 저장 자료의 과거 결박만 소비한다. 실제 DB·서명/current 권위가 아니며 기본 route 미등록이다. */
export async function readSourceContentStoredReportProofCandidate(db:ReadClient,value:unknown,nowMs:number) {
 return readStoredProof(db,value,nowMs,null);
}
/** 선언 문맥 대조일 뿐 인증이 아니다. 기존 exact3 경로의 반환·거절은 변경하지 않는다. */
export async function readSourceContentStoredReportProofForDeclaredContextCandidate(db:ReadClient,value:unknown,nowMs:number) {
 const c=readSourceContentDeclaredContextCandidate(value,nowMs);
 return readStoredProof(db,{installationId:c.installationId,projectId:c.projectId,requestRef:c.requestRef},nowMs,c);
}
interface ProofBinding {userId:string;clientId:string;credentialGeneration:number;controlGeneration:number;basePolicyRef:RuntimeRefV1}
async function readStoredProof(db:ReadClient,value:unknown,nowMs:number,binding:ProofBinding|null) {
 let basis:{installationId:string;projectId:string;requestRef:RuntimeRefV1};
 try {
  const raw=canonicalJson(value);if(Buffer.byteLength(raw,'utf8')>4096)throw Error();
  const v:unknown=JSON.parse(raw);
  if(!recordV1(v,['installationId','projectId','requestRef'])||!uuidV1(v.installationId)||!uuidV1(v.projectId)||!refV1(v.requestRef)||v.requestRef.version!==1||!Number.isSafeInteger(nowMs))throw Error();
  basis=v as unknown as typeof basis;
 }catch{throw Error('SOURCE_CONTENT_PROOF_BASIS_INVALID');}
 const result=await readRecord(db,basis.installationId,basis.projectId,basis.requestRef.id,nowMs,(record,observation)=>projectStoredProof(record,observation,basis.requestRef,binding));
 return result??proofClosed('REQUEST_ABSENT');
}
function projectStoredProof(record:RecordCandidate,observation:InternalObservation|null,requestRef:RuntimeRefV1,binding:ProofBinding|null) {
  if(!same(record.view.requestRef,requestRef))return proofClosed('STORED_PROOF_REQUEST_REF_MISMATCH');
  const s=record.view.scope;
  if(binding&&(s.userId!==binding.userId||s.clientId!==binding.clientId||s.credentialGeneration!==binding.credentialGeneration||s.controlGeneration!==binding.controlGeneration||!same(s.basePolicyRef,binding.basePolicyRef)))return proofClosed('DECLARED_PROOF_CONTEXT_MISMATCH');
  if(!observation)return proofClosed('OBSERVATION_ABSENT');
  const p=observation.permit;
  const expected={scope:record.view.scope,requestRef:record.view.requestRef,observationRequestRef:record.view.observationRequestRef,observationNonce:p.observationNonce,credentialIssuedAt:record.view.credentialIssuedAt,credentialExpiresAt:record.view.credentialExpiresAt,issuedAt:p.issuedAt,observeBefore:record.view.observeBefore};
  const input=readSourceContentReportProofFromPermitCandidate(observation.report,p,expected,observation.receivedAt);
  return {status:'UNVERIFIED' as const,reason:'STORED_REPORT_PROOF_INPUT_ONLY',candidate:{requestRef:record.view.requestRef,reportRef:record.view.reportRef,proofDomain:'ANVIL_SOURCE_CONTENT_REPORT_V1',proofInputHash:contentHash(input.candidate.proofBytes)},...proofFlags};
}

const combinedProofClosed=(reason:string)=>({status:'UNAVAILABLE' as const,reason,historicalProof:null,policy:null,readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const,...proofFlags});
/** 과거 proof와 별도 최신 정책을 병기한다. 최신 음성을 과거 후보로 덮거나 현재 허가로 승격하지 않는다. */
export async function readSourceContentStoredReportProofWithPolicyForDeclaredContextCandidate(db:ReadClient,value:unknown,nowMs:number) {
 return readProofWithPolicy(db,value,nowMs,(_record,historicalProof,policy)=>({status:policy.status,reason:policy.reason,historicalProof,policy:{status:policy.status,reason:policy.reason,ref:policy.policyRef},readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const,...proofFlags}),combinedProofClosed);
}
/** 기존 exact13 상태와 별도 proof 표시값을 동일 판독 자료에서 만든다. 실제 전송/route는 없다. */
export async function readSourceContentScreenForDeclaredContextCandidate(db:ReadClient,value:unknown,nowMs:number) {
 const close=(reason:string)=>({status:'UNAVAILABLE' as const,reason,summary:null,proof:null,readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const,...proofFlags});
 return readProofWithPolicy(db,value,nowMs,(record,proof,policy)=>({status:policy.status,reason:policy.reason,summary:sourceContentRequestStatusFromParts(record,policy),proof,readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const,...proofFlags}),close);
}
async function readProofWithPolicy<T,C>(db:ReadClient,value:unknown,nowMs:number,consume:(record:RecordCandidate,proof:ReturnType<typeof projectStoredProof>,policy:SourceContentPolicyCandidate)=>T,close:(reason:string)=>C) {
 const c=readSourceContentDeclaredContextCandidate(value,nowMs);
 const result=await readRecord(db,c.installationId,c.projectId,c.requestRef.id,nowMs,async(record,observation)=>{
  const historicalProof=projectStoredProof(record,observation,c.requestRef,c);
  if(historicalProof.reason==='STORED_PROOF_REQUEST_REF_MISMATCH'||historicalProof.reason==='DECLARED_PROOF_CONTEXT_MISMATCH')return close(historicalProof.reason);
  const policy=await readSourceContentRequestPolicyCandidate(db,record.view.scope,nowMs);
  return consume(record,historicalProof,policy);
 });
 return result??close('REQUEST_ABSENT');
}
