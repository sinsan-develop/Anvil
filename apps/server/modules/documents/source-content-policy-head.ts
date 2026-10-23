import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,arrayV1,uuidV1,hashV1,isoV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';

interface ReadClient {query(sql:string,args:unknown[]):Promise<{rows:unknown[]}>}
export interface SourceContentPolicyCandidate {
 status:'UNAVAILABLE'|'DENIED'|'UNVERIFIED';reason:string;policyRef:RuntimeRefV1|null;
 executionAuthorized:false;linkAuthorized:false;
}
const result=(status:SourceContentPolicyCandidate['status'],reason:string,policyRef:RuntimeRefV1|null=null):SourceContentPolicyCandidate=>({status,reason,policyRef,executionAuthorized:false,linkAuthorized:false});
const keys=['project_id','id','version','sequence','subject_user_id','disposition','recorded_at','expires_at','snapshot_json','content_hash'];
function integer(value:unknown):number|null {
 if(typeof value!=='number'&&(typeof value!=='string'||!/^[1-9][0-9]{0,15}$/.test(value)))return null;
 const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:null;
}
function instant(value:unknown):string|null {
 if(isoV1(value))return value;
 if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Date.prototype){try{return Date.prototype.toISOString.call(value);}catch{return null;}}
 return null;
}
/** 보호 저장소의 최신 한 건을 먼저 읽는다. scope/관리 receipt/현재 권한/이력 계보 검증은 미구현이며 AUTO도 허가가 아니다. */
export async function readLatestSourceContentPolicyCandidate(db:ReadClient,projectId:string,subjectUserId:string,nowMs:number):Promise<SourceContentPolicyCandidate> {
 if(!uuidV1(projectId)||!uuidV1(subjectUserId)||!Number.isSafeInteger(nowMs))throw Error('SOURCE_CONTENT_POLICY_INPUT_INVALID');
 // 최신 회수·만료·다른 subject를 제외하여 과거 AUTO로 fallback하지 않는다.
 const {rows}=await db.query('SELECT project_id,id,version,sequence,subject_user_id,disposition,recorded_at,expires_at,snapshot_json,content_hash FROM anvil.source_content_policy_events WHERE project_id=$1 ORDER BY sequence DESC LIMIT 1',[projectId]);
 return inspectSourceContentPolicyHeadCandidate(rows,projectId,subjectUserId,nowMs);
}
/** 기존 head의 최소 구조/음성 대조만 재사용한다. 현재 관리권위·전체 정책 검증이 아니다. */
export function inspectSourceContentPolicyHeadCandidate(rows:unknown,projectId:string,subjectUserId:string,nowMs:number):SourceContentPolicyCandidate {
 if(!uuidV1(projectId)||!uuidV1(subjectUserId)||!Number.isSafeInteger(nowMs))throw Error('SOURCE_CONTENT_POLICY_INPUT_INVALID');
 if(!arrayV1(rows,1))return result('DENIED','MALFORMED_HEAD');
 if(rows.length===0)return result('UNAVAILABLE','POLICY_ABSENT');
 try {
  const row=rows[0];
  if(!recordV1(row,keys)||row.project_id!==projectId||!uuidV1(row.id)||integer(row.version)!==1||!integer(row.sequence)||!uuidV1(row.subject_user_id)||!['AUTO','DENY','REVOKED'].includes(row.disposition)||!hashV1(row.content_hash))return result('DENIED','MALFORMED_HEAD');
  const recorded=instant(row.recorded_at),expires=instant(row.expires_at);
  if(!recorded||!expires||Date.parse(recorded)>nowMs||Date.parse(expires)<=Date.parse(recorded))return result('DENIED','MALFORMED_HEAD');
  const raw=canonicalJson(row.snapshot_json);
  if(Buffer.byteLength(raw,'utf8')>1048576||contentHash(raw)!==row.content_hash)return result('DENIED','MALFORMED_HEAD');
  const s:unknown=JSON.parse(raw);
  if(!s||typeof s!=='object'||Array.isArray(s))return result('DENIED','MALFORMED_HEAD');
  const v=s as Record<string,unknown>;
  if(v.projectId!==projectId||v.subjectUserId!==row.subject_user_id||v.sequence!==integer(row.sequence)||v.disposition!==row.disposition||v.recordedAt!==recorded||v.expiresAt!==expires)return result('DENIED','MALFORMED_HEAD');
  const ref={id:row.id,version:1,contentHash:row.content_hash};
  if(row.disposition==='REVOKED')return result('DENIED','POLICY_REVOKED',ref);
  if(row.disposition==='DENY')return result('DENIED','POLICY_DENIED',ref);
  if(Date.parse(expires)<=nowMs)return result('DENIED','POLICY_EXPIRED',ref);
  if(row.subject_user_id!==subjectUserId)return result('DENIED','SUBJECT_MISMATCH',ref);
  return result('UNVERIFIED','CURRENT_AUTHORITY_UNAVAILABLE',ref);
 }catch{return result('DENIED','MALFORMED_HEAD');}
}
