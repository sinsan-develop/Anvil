import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,arrayV1,uuidV1,hashV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceContentScopeV1,readSourceContentReportV1} from '../../../../contracts/runtime/source-content-report-v1.ts';
import {readSourceContentPermitV1,sourceContentReportContextFromPermitV1} from '../../../../contracts/runtime/source-content-permit-v1.ts';
import {readSourceContentChallengeV1} from '../../../../contracts/runtime/source-content-exchange-v1.ts';
import {planSourceContentRequestTransitionV1,type SourceContentRequestStateV1} from './source-content-request-transition.ts';
import {inspectSourceContentCreationEvidenceV1} from './source-content-creation-evidence.ts';

interface ReadClient {query(sql:string,args:unknown[]):Promise<{rows:unknown[]}>}
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
const sql=`SELECT ${fields.map(k=>`r.${k}`).join(',')},
 CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id',c.id,'scopeKind',c.scope_kind,'scopeId',c.scope_id,'projectId',c.project_id,'actorId',c.actor_id,'clientId',c.client_id,'operation',c.operation,'commandId',c.command_id,'requestHash',c.request_hash,'operationId',c.operation_id,'state',c.state,'authorizationReceiptId',c.authorization_receipt_id,'approvalConsumptionId',c.approval_consumption_id,'expectedVersion',c.expected_version,'controlGeneration',c.control_generation,'policyRef',c.policy_ref,'payloadRef',c.payload_ref,'resultRef',c.result_ref,'completedAt',anvil.source_read_iso(c.completed_at)) END created_command,
 CASE WHEN ar.id IS NULL THEN NULL ELSE jsonb_build_object('id',ar.id,'scopeKind',ar.scope_kind,'scopeId',ar.scope_id,'commandId',ar.command_id,'subjectRef',ar.subject_ref,'policyRef',ar.policy_ref,'scopeDigest',ar.scope_digest,'approvalDecisionRef',ar.approval_decision_ref) END authorization_receipt,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('projectId',a.project_id,'serverSequence',a.server_sequence,'eventId',a.event_id,'actorRef',a.actor_ref,'clientRef',a.client_ref,'commandId',a.command_id,'operationId',a.operation_id,'targetRef',a.target_ref,'policyRef',a.policy_ref,'approvalRef',a.approval_ref,'outcome',a.outcome,'reasonCode',a.reason_code,'scopeDigest',a.scope_digest,'sourceKind',a.source_kind,'correctionOf',a.correction_of)) FROM (SELECT * FROM anvil.audit_events ae WHERE ae.project_id=r.project_id AND ae.command_id=c.id LIMIT 2) a),'[]'::jsonb) creation_audits,
 CASE WHEN o.id IS NULL THEN NULL ELSE jsonb_build_object('projectId',o.project_id,'id',o.id,'version',o.version,'requestId',o.request_id,'requestVersion',o.request_version,'scopeDigest',o.scope_digest,'reportCommandId',o.report_command_id,'report',o.report_json,'contentHash',o.content_hash,'signature',o.signature,'observedAt',anvil.source_read_iso(o.observed_at),'finishedAt',anvil.source_read_iso(o.finished_at),'receivedAt',anvil.source_read_iso(o.received_at),'evidenceClass',o.evidence_class,'osVerification',o.os_verification) END observation
 FROM anvil.source_content_requests r
 LEFT JOIN anvil.commands c ON c.project_id=r.project_id AND c.id=r.created_command_id
 LEFT JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind=c.scope_kind AND ar.scope_id=c.scope_id
 LEFT JOIN anvil.source_content_observations o ON o.project_id=r.project_id AND o.request_id=r.id
 WHERE r.project_id=$1 AND r.id=$2`;

/** 보호 저장행·생성 영수증/감사의 구조 후보만 판독한다. 실제 SQL/현재 권위·서명·OS·원자 저장은 별도이며 route 미등록이다. */
export async function readSourceContentRequestRecordCandidate(db:ReadClient,installationId:string,projectId:string,requestId:string,nowMs:number) {
 if(![installationId,projectId,requestId].every(uuidV1)||!Number.isSafeInteger(nowMs))return invalid();
 // 한 statement snapshot에서 읽고 누락 command/관측을 INNER JOIN으로 숨기지 않는다. DB 오류는 그대로 전파한다.
 const {rows}=await db.query(sql,[projectId,requestId]);
 try {
  if(!arrayV1(rows,1))return invalid();if(rows.length===0)return null;
  if(!recordV1(rows[0],[...fields,'created_command','authorization_receipt','creation_audits','observation']))return invalid();
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
   if(Date.parse(permit.issuedAt)>Date.parse(v.updated_at))return invalid();
  }else if(v.credential_scope!==null)return invalid();
  const o=v.observation;
  let reportRef=null;
  if(o!==null){
   if(!permit||!recordV1(o,['projectId','id','version','requestId','requestVersion','scopeDigest','reportCommandId','report','contentHash','signature','observedAt','finishedAt','receivedAt','evidenceClass','osVerification'])||o.projectId!==projectId||!uuidV1(o.id)||integer(o.version)!==1||o.requestId!==requestId||integer(o.requestVersion)!==1||o.scopeDigest!==v.scope_digest||o.reportCommandId!==v.report_consumed_command_id||o.receivedAt!==v.report_consumed_at||o.evidenceClass!=='CONNECTOR_REPORTED'||o.osVerification!=='OS_UNVERIFIED')return invalid();
   const basis={scope:s,requestRef,observationRequestRef:permit.observationRequestRef,observationNonce:permit.observationNonce,credentialIssuedAt:permit.credential.issuedAt,credentialExpiresAt:permit.credential.expiresAt,issuedAt:permit.issuedAt,observeBefore:permit.observeBefore};
   const report=readSourceContentReportV1(o.report,sourceContentReportContextFromPermitV1(permit,basis,o.receivedAt));
   if(report.commandId!==o.reportCommandId||report.reportHash!==o.contentHash||report.signature!==o.signature||report.observedAt!==o.observedAt||report.finishedAt!==o.finishedAt)return invalid();
   reportRef={id:o.id,version:1,contentHash:o.contentHash};
  }
  const view:SourceContentRequestStateV1={scope:s,requestRef,state:v.state,preflightDigest:v.preflight_digest,challengeDigest:ch===null?null:contentHash(canonicalJson(ch)),challengeIssuedAt:v.challenge_issued_at,challengeExpiresAt:v.challenge_expires_at,credentialIssuedAt:v.credential_issued_at,credentialExpiresAt:v.credential_expires_at,observeBefore:permit?.observeBefore??null,credentialTokenDigest:v.credential_token_digest,observationRequestRef:v.observation_request_ref,observationNonceDigest:v.observation_nonce_digest,reportRef,reportCommandId:v.report_consumed_command_id,reportConsumedAt:v.report_consumed_at,revokedAt:v.revoked_at,revokeCommandId:v.revoke_command_id,exchangeFailures:integer(v.exchange_failures),updatedAt:v.updated_at};
  planSourceContentRequestTransitionV1(view,view,nowMs);
  return {status:'UNVERIFIED_REQUEST_RECORD_CANDIDATE' as const,view,creationEvidence,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const};
 }catch{return invalid();}
}
