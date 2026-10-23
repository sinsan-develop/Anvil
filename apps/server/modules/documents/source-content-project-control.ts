import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,arrayV1,uuidV1,hashV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';

interface ReadClient {query(sql:string,args:unknown[]):Promise<{rows:unknown[]}>}
const fields=['project_id','project_archived_at','member_user_id','participation','member_revoked_at','control_actor_id','control_client_id','control_generation','control_revoked_at','controller_user_id','controller_status','controller_revoked_at','controller_client_id','controller_client_user_id','controller_client_revoked_at','policy_id','policy_head_version','policy_record_project_id','policy_record_id','policy_record_version','rules_json','policy_hash','policy_reason','policy_review_refs'];
const sql=`SELECT p.id project_id,p.archived_at project_archived_at,m.user_id member_user_id,m.participation,m.revoked_at member_revoked_at,
 pc.actor_id control_actor_id,pc.client_id control_client_id,pc.generation control_generation,pc.revoked_at control_revoked_at,
 cu.id controller_user_id,cu.status controller_status,cu.revoked_at controller_revoked_at,
 cc.id controller_client_id,cc.user_id controller_client_user_id,cc.revoked_at controller_client_revoked_at,
 pp.id policy_id,pp.head_version policy_head_version,pv.project_id policy_record_project_id,pv.policy_id policy_record_id,pv.version policy_record_version,
 pv.rules_json,pv.content_hash policy_hash,pv.reason policy_reason,pv.review_refs policy_review_refs
 FROM anvil.projects p
 LEFT JOIN anvil.project_members m ON m.project_id=p.id AND m.user_id=$2
 LEFT JOIN anvil.project_control pc ON pc.project_id=p.id
 LEFT JOIN anvil.users cu ON cu.id=pc.actor_id
 LEFT JOIN anvil.clients cc ON cc.id=pc.client_id AND cc.user_id=pc.actor_id
 LEFT JOIN anvil.permission_policies pp ON pp.project_id=p.id
 LEFT JOIN anvil.permission_policy_versions pv ON pv.project_id=pp.project_id AND pv.policy_id=pp.id AND pv.version=pp.head_version
 WHERE p.id=$1`;
interface Candidate {status:'UNVERIFIED';projectId:string;actorId:string;clientId:string;controlGeneration:number;basePolicyRef:{id:string;version:number;contentHash:string}}
const result=(status:'UNAVAILABLE'|'DENIED'|'UNVERIFIED',reason:string,candidate:Candidate|null=null)=>({status,reason,candidate,
 currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const});
function integer(value:unknown):number|null{
 if(typeof value!=='number'&&(typeof value!=='string'||!/^[1-9][0-9]{0,15}$/.test(value)))return null;
 const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:null;
}
function instant(value:unknown):string|null{
 if(value===null||isoV1(value))return value;
 if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Date.prototype){const s=Date.prototype.toISOString.call(value);if(isoV1(s))return s;}
 throw Error('INVALID_TIME');
}
/** OWNER 제어 문맥의 최소 frame SOURCE. VIEWER 조회 권한·실제 인증/현재 제어/정책 의미·content 작업 허가가 아니다.
 * query는 잠금/쓰기 없이 현재 head만 읽으며 같은 statement도 실제 DB/transaction에서 실행하지 않았다. */
export async function readSourceContentProjectControlCandidate(db:ReadClient,projectId:string,identity:unknown){
 let actor:Record<string,any>;
 try{
  if(!uuidV1(projectId)||!recordV1(identity,['status','actorId','clientId','credentialGeneration']))throw Error();
  actor=JSON.parse(canonicalJson(identity));
  if(actor.status!=='UNVERIFIED'||!uuidV1(actor.actorId)||!uuidV1(actor.clientId)||typeof actor.credentialGeneration!=='number'||integer(actor.credentialGeneration)===null)throw Error();
 }catch{throw Error('SOURCE_CONTENT_PROJECT_CONTROL_INPUT_INVALID');}
 const {rows}=await db.query(sql,[projectId,actor.actorId]); // DB 오류는 부재로 바꾸지 않는다.
 if(!arrayV1(rows,1))return result('DENIED','MALFORMED_CONTROL_PROJECTION');
 if(rows.length===0)return result('UNAVAILABLE','PROJECT_ABSENT');
 try{
  if(!recordV1(rows[0],fields))return result('DENIED','MALFORMED_CONTROL_PROJECTION');
  const v={...rows[0]};
  for(const key of ['project_archived_at','member_revoked_at','control_revoked_at','controller_revoked_at','controller_client_revoked_at'])v[key]=instant(v[key]);
  const raw=canonicalJson(v);if(Buffer.byteLength(raw,'utf8')>2097152)return result('DENIED','MALFORMED_CONTROL_PROJECTION');
  const r=JSON.parse(raw),generation=integer(r.control_generation);
  if(r.project_id!==projectId)return result('DENIED','MALFORMED_CONTROL_PROJECTION');
  if(r.project_archived_at!==null)return result('DENIED','PROJECT_ARCHIVED');
  if(r.member_user_id!==actor.actorId||r.participation!=='OWNER'||r.member_revoked_at!==null)return result('DENIED','OWNER_CONTROL_UNAVAILABLE');
  if(r.control_actor_id!==actor.actorId||r.control_client_id!==actor.clientId||generation===null||r.control_revoked_at!==null
   ||r.controller_user_id!==actor.actorId||r.controller_status!=='ACTIVE'||r.controller_revoked_at!==null
   ||r.controller_client_id!==actor.clientId||r.controller_client_user_id!==actor.actorId||r.controller_client_revoked_at!==null)return result('DENIED','PROJECT_CONTROL_UNAVAILABLE');
  if(r.policy_id===null)return result('UNAVAILABLE','BASE_POLICY_ABSENT');
  const version=integer(r.policy_head_version);
  if(!uuidV1(r.policy_id)||version===null||r.policy_record_project_id!==projectId||r.policy_record_id!==r.policy_id||integer(r.policy_record_version)!==version)return result('DENIED','BASE_POLICY_HEAD_UNAVAILABLE');
  if(!Array.isArray(r.rules_json)||r.rules_json.some((rule:any)=>!rule||typeof rule.disposition!=='string'||!['AUTO','REQUIRE_APPROVAL','DENY'].includes(rule.disposition))
   ||typeof r.policy_reason!=='string'||!r.policy_reason.trim()||!Array.isArray(r.policy_review_refs)||!hashV1(r.policy_hash)
   ||contentHash(canonicalJson({rules:r.rules_json,reason:r.policy_reason,reviewRefs:r.policy_review_refs}))!==r.policy_hash)return result('DENIED','BASE_POLICY_SHAPE_UNAVAILABLE');
  return result('UNVERIFIED','PROJECT_CONTROL_FRAME_ONLY',{status:'UNVERIFIED',projectId,actorId:actor.actorId,clientId:actor.clientId,controlGeneration:generation,basePolicyRef:{id:r.policy_id,version,contentHash:r.policy_hash}});
 }catch{return result('DENIED','MALFORMED_CONTROL_PROJECTION');}
}

/** 비활성 서버 포트 형식으로만 투영한다. UNVERIFIED 자료는 인증·허가가 아니며 부재/거절도 원요청 읽기를 허용하지 않는다. */
export async function readSourceContentProjectControlPortCandidate(db:ReadClient,projectId:string,identity:unknown){
 const value=await readSourceContentProjectControlCandidate(db,projectId,identity);
 if(value.status==='UNVERIFIED'&&value.candidate!==null)return value.candidate;
 return {status:value.status==='UNAVAILABLE'?'UNAVAILABLE' as const:'DENIED' as const,
  reason:value.status==='UNVERIFIED'?'MALFORMED_CONTROL_PROJECTION':value.reason};
}
