import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,refV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceContentScopeV1} from '../../../../contracts/runtime/source-content-report-v1.ts';
import {registrationRef,connectorRef} from '../connections/project-registrations.ts';

interface ReadClient {query(sql:string,args:unknown[]):Promise<{rows:unknown[]}>}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const positive=(v:unknown):number|null=>{if(typeof v==='string'&&/^[1-9][0-9]*$/.test(v))v=Number(v);return typeof v==='number'&&Number.isSafeInteger(v)&&v>0?v:null;};
const result=(status:'UNVERIFIED'|'UNAVAILABLE'|'DENIED',reason:string,candidate:unknown=null)=>({status,reason,candidate,
 currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const});
const keys=['connector_id','connector_project_id','connector_owner_user_id','connector_client_id','connector_credential_generation','connector_generation','connector_registration_id','connector_status','connector_revoked_at','host_fingerprint','host_label','registration_id','registration_project_id','registration_connector_id','registration_version','registration_state','requested_by','client_id','credential_generation','control_generation','expected_host_fingerprint','observed_host_fingerprint','registration_revoked_at','registration_created_at','registration_expires_at','scope_json','scope_digest','policy_ref'];
/** 기존 상태전용 등록과 content 원scope의 참조/frame만 결박한다. 상태 credential을 content 허가로 사용하지 않는다.
 * 실제 현재 인증/정책·등록 키와 서명·observer/OS 권위는 미확인이다. route/실제DB에는 연결하지 않는다. */
export async function readSourceContentRegistrationFrameCandidate(db:ReadClient,value:unknown,nowMs:number){
 if(!Number.isSafeInteger(nowMs))throw Error('SOURCE_CONTENT_REGISTRATION_INPUT_INVALID');
 const scope=readSourceContentScopeV1(value);
 if(nowMs<Date.parse(scope.requestedAt)||nowMs>=Date.parse(scope.expiresAt))return result('DENIED','REQUEST_OUTSIDE_ORIGINAL_LIFETIME');
 const rows=(await db.query(`SELECT h.id connector_id,h.project_id connector_project_id,h.owner_user_id connector_owner_user_id,
 h.client_id connector_client_id,h.credential_generation connector_credential_generation,h.generation connector_generation,
 h.registration_id connector_registration_id,h.status connector_status,h.revoked_at connector_revoked_at,h.host_fingerprint,h.host_label,
 r.id registration_id,r.project_id registration_project_id,r.connector_id registration_connector_id,r.version registration_version,
 r.state registration_state,r.requested_by,r.client_id,r.credential_generation,r.control_generation,r.expected_host_fingerprint,
 r.observed_host_fingerprint,r.revoked_at registration_revoked_at,r.created_at registration_created_at,r.expires_at registration_expires_at,
 r.scope_json,r.scope_digest,r.policy_ref
 FROM anvil.connectors h LEFT JOIN anvil.connector_registrations r ON r.project_id=h.project_id AND r.id=h.registration_id
 WHERE h.project_id=$1 AND h.id=$2`,[scope.projectId,scope.connectorRef.id])).rows;
 if(rows.length===0)return result('UNAVAILABLE','CONNECTOR_ABSENT');
 try{
  if(rows.length!==1||!recordV1(rows[0],keys))return result('DENIED','REGISTRATION_FRAME_INVALID');
  const fields=Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(rows[0])).map(([k,p])=>[k,p.value]));
  for(const k of ['registration_created_at','registration_expires_at'])if(fields[k] instanceof Date)fields[k]=Date.prototype.toISOString.call(fields[k]);
  const raw=canonicalJson(fields);if(Buffer.byteLength(raw,'utf8')>65536)return result('DENIED','REGISTRATION_FRAME_INVALID');
  const r=JSON.parse(raw),version=positive(r.registration_version),generation=positive(r.connector_generation);
  if(r.connector_project_id!==scope.projectId||r.registration_project_id!==scope.projectId||r.connector_id!==scope.connectorRef.id
   ||r.registration_connector_id!==r.connector_id||r.connector_registration_id!==r.registration_id||version===null||generation===null)return result('DENIED','REGISTRATION_FRAME_INVALID');
  if(r.connector_status!=='TRUSTED'||r.registration_state!=='ISSUED'||r.connector_revoked_at!==null||r.registration_revoked_at!==null)return result('DENIED','REGISTRATION_NOT_AVAILABLE');
  if(!isoV1(r.registration_created_at)||!isoV1(r.registration_expires_at))return result('DENIED','REGISTRATION_FRAME_INVALID');
  const created=Date.parse(r.registration_created_at),expires=Date.parse(r.registration_expires_at);
  if(created>nowMs||nowMs>=expires||expires<=created||expires-created>600000)return result('DENIED','REGISTRATION_NOT_AVAILABLE');
  const s=r.scope_json;
  if(!recordV1(s,['kind','installationId','projectId','subject','policyRef','expectedHostFingerprint','hostLabel','expiresAt','credentialScope','grants'])
   ||s.kind!=='HOST_TRUST_REGISTRATION'||s.installationId!==scope.installationId||s.projectId!==scope.projectId
   ||!recordV1(s.subject,['kind','userId','clientId','credentialGeneration','controlGeneration'])
   ||!same(s.subject,{kind:'HUMAN',userId:scope.userId,clientId:scope.clientId,credentialGeneration:scope.credentialGeneration,controlGeneration:scope.controlGeneration})
   ||r.requested_by!==scope.userId||r.connector_owner_user_id!==scope.userId||r.client_id!==scope.clientId||r.connector_client_id!==scope.clientId
   ||positive(r.credential_generation)!==scope.credentialGeneration||positive(r.connector_credential_generation)!==scope.credentialGeneration||positive(r.control_generation)!==scope.controlGeneration
   ||s.expectedHostFingerprint!==scope.hostFingerprint||r.expected_host_fingerprint!==scope.hostFingerprint||r.observed_host_fingerprint!==scope.hostFingerprint||r.host_fingerprint!==scope.hostFingerprint
   ||typeof s.hostLabel!=='string'||!s.hostLabel.trim()||s.hostLabel.length>200||/[\u0000-\u001f\u007f]/.test(s.hostLabel)||s.hostLabel!==r.host_label||s.expiresAt!==r.registration_expires_at
   ||s.credentialScope!=='REGISTRATION_STATUS_ONLY'||!same(s.grants,[])||!refV1(s.policyRef)||!same(s.policyRef,r.policy_ref)||!same(r.policy_ref,scope.basePolicyRef)
   ||contentHash(canonicalJson(s))!==r.scope_digest)return result('DENIED','REGISTRATION_FRAME_INVALID');
  const basis={id:r.registration_id,version,state:r.registration_state,scope_digest:r.scope_digest,connector_id:r.connector_id};
  const registration=registrationRef(basis),connector=connectorRef(basis,generation);
  if(!same(registration,scope.registrationRef)||!same(connector,scope.connectorRef))return result('DENIED','REGISTRATION_REF_CHANGED');
  return result('UNVERIFIED','REGISTRATION_FRAME_ONLY',{registrationRef:registration,connectorRef:connector});
 }catch{return result('DENIED','REGISTRATION_FRAME_INVALID');}
}
