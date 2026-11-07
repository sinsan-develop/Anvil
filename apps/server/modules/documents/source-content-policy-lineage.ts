import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,refV1,uuidV1,hashV1,isoV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';

const keys=['project_id','id','version','sequence','subject_user_id','disposition','recorded_at','expires_at','snapshot_json','content_hash','previous_ref','management_command_id'];
const invalid=():never=>{throw Error('SOURCE_CONTENT_POLICY_LINEAGE_INVALID');};
function integer(value:unknown):number {
 if(typeof value!=='number'&&(typeof value!=='string'||!/^[1-9][0-9]{0,15}$/.test(value)))return invalid();
 const n=Number(value);if(!Number.isSafeInteger(n)||n<1)return invalid();return n;
}
function instant(value:unknown):string {
 if(isoV1(value))return value;
 if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Date.prototype){const s=Date.prototype.toISOString.call(value);if(isoV1(s))return s;}
 return invalid();
}
function row(value:unknown){
 if(!recordV1(value,keys))return invalid();
 const d=Object.getOwnPropertyDescriptors(value),copy=Object.fromEntries(keys.map(k=>[k,d[k]!.value]));
 copy.recorded_at=instant(copy.recorded_at);copy.expires_at=instant(copy.expires_at);
 const raw=canonicalJson(copy);if(Buffer.byteLength(raw,'utf8')>2097152)return invalid();
 const r=JSON.parse(raw),sequence=integer(r.sequence);
 if(![r.project_id,r.id,r.subject_user_id,r.management_command_id].every(uuidV1)||integer(r.version)!==1||!['AUTO','DENY','REVOKED'].includes(r.disposition)||!hashV1(r.content_hash)||Date.parse(r.expires_at)<=Date.parse(r.recorded_at))return invalid();
 if(sequence===1?r.previous_ref!==null:!refV1(r.previous_ref)||r.previous_ref.version!==1)return invalid();
 const s=r.snapshot_json;
 if(!s||typeof s!=='object'||Array.isArray(s))return invalid();
 const encoded=canonicalJson(s);if(Buffer.byteLength(encoded,'utf8')>1048576||contentHash(encoded)!==r.content_hash||s.projectId!==r.project_id||s.subjectUserId!==r.subject_user_id||s.sequence!==sequence||s.disposition!==r.disposition||s.recordedAt!==r.recorded_at||s.expiresAt!==r.expires_at)return invalid();
 return {projectId:r.project_id as string,id:r.id as string,sequence,recordedAt:r.recorded_at as string,managementCommandId:r.management_command_id as string,previousRef:r.previous_ref as RuntimeRefV1|null,ref:{id:r.id as string,version:1,contentHash:r.content_hash as string}};
}
/** 미적용 SQL의 인접 append 구조만 대조한다. full policy·targets/관리근거·현재권한 진위는 미검증이다. */
export function inspectSourceContentPolicyLineageCandidate(previous:unknown,current:unknown){
 try {
  const n=row(current);
  if(n.sequence===1){if(previous!==null)return invalid();}
  else {
   const p=row(previous);
   if(n.projectId!==p.projectId||n.sequence!==p.sequence+1||n.id===p.id||n.managementCommandId===p.managementCommandId||canonicalJson(n.previousRef)!==canonicalJson(p.ref)||Date.parse(n.recordedAt)<Date.parse(p.recordedAt))return invalid();
  }
  return {status:'UNVERIFIED' as const,reason:'POLICY_LINEAGE_SHAPE_ONLY' as const,policyRef:n.ref,previousRef:n.previousRef,sequence:n.sequence,
   managementEvidenceVerified:false as const,currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const};
 }catch{return invalid();}
}
