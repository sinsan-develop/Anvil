import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,refV1,uuidV1,hashV1,isoV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {isRelativeSourceFileV1} from '../../../../contracts/runtime/source-scope-v1.ts';

const keys=['project_id','id','version','observation_id','observation_version','observation_hash','target_index','relative_path','document_id','document_version','document_hash','observer_implementation_ref','decision','verified_at','expires_at','previous_ref','snapshot_json','content_hash'];
const identities=['project_id','id','observation_id','observation_version','observation_hash','target_index','relative_path','document_id','document_version','document_hash','observer_implementation_ref'];
const invalid=():never=>{throw Error('SOURCE_CONTENT_VERIFICATION_LINEAGE_INVALID');};
function integer(value:unknown,min=1):number{
 if(typeof value!=='number'&&(typeof value!=='string'||!/^(0|[1-9][0-9]{0,15})$/.test(value)))return invalid();
 const n=Number(value);if(!Number.isSafeInteger(n)||n<min)return invalid();return n;
}
function instant(value:unknown):string{
 if(isoV1(value))return value;
 if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Date.prototype){const s=Date.prototype.toISOString.call(value);if(isoV1(s))return s;}
 return invalid();
}
function row(value:unknown){
 if(!recordV1(value,keys))return invalid();
 const d=Object.getOwnPropertyDescriptors(value),copy=Object.fromEntries(keys.map(k=>[k,d[k]!.value]));
 copy.verified_at=instant(copy.verified_at);copy.expires_at=instant(copy.expires_at);
 const raw=canonicalJson(copy);if(Buffer.byteLength(raw,'utf8')>2097152)return invalid();
 const r=JSON.parse(raw);for(const k of ['version','observation_version','document_version'])r[k]=integer(r[k]);r.target_index=integer(r.target_index,0);
 if(![r.project_id,r.id,r.observation_id,r.document_id].every(uuidV1)||r.observation_version!==1||r.target_index>199||!isRelativeSourceFileV1(r.relative_path)
  ||![r.observation_hash,r.document_hash,r.content_hash].every(hashV1)||!refV1(r.observer_implementation_ref)||!['ACCEPTED','REVOKED','INVALID'].includes(r.decision))return invalid();
 const duration=Date.parse(r.expires_at)-Date.parse(r.verified_at);if(duration<=0||duration>30000)return invalid();
 if(r.version===1){if(r.decision!=='ACCEPTED'||r.previous_ref!==null)return invalid();}
 else if(r.decision==='ACCEPTED'||!refV1(r.previous_ref)||r.previous_ref.id!==r.id||r.previous_ref.version!==r.version-1)return invalid();
 if(!r.snapshot_json||typeof r.snapshot_json!=='object'||Array.isArray(r.snapshot_json))return invalid();
 const snapshot=canonicalJson(r.snapshot_json);if(Buffer.byteLength(snapshot,'utf8')>1048576||contentHash(snapshot)!==r.content_hash)return invalid();
 return {version:r.version as number,verifiedAt:r.verified_at as string,identity:identities.map(k=>r[k]),previousRef:r.previous_ref as RuntimeRefV1|null,ref:{id:r.id as string,version:r.version as number,contentHash:r.content_hash as string}};
}
/** 기존 미적용 SQL의 인접 append 모양만 대조한다. snapshot 의미/실제 verifier·현재 권위·허가는 검증하지 않는다. */
export function inspectSourceContentVerificationLineageCandidate(previous:unknown,current:unknown){
 try {
  const n=row(current);
  if(n.version===1){if(previous!==null)return invalid();}
  else {const p=row(previous);if(n.version!==p.version+1||canonicalJson(n.previousRef)!==canonicalJson(p.ref)||canonicalJson(n.identity)!==canonicalJson(p.identity)||Date.parse(n.verifiedAt)<Date.parse(p.verifiedAt))return invalid();}
  return {status:'UNVERIFIED' as const,reason:'VERIFICATION_LINEAGE_SHAPE_ONLY' as const,verificationRef:n.ref,previousRef:n.previousRef,
   verifierEvidenceVerified:false as const,currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const};
 }catch{return invalid();}
}
