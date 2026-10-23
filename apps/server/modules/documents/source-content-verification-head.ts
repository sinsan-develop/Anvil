import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,arrayV1,uuidV1,refV1,hashV1,isoV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {isRelativeSourceFileV1} from '../../../../contracts/runtime/source-scope-v1.ts';
import {inspectSourceContentVerificationLineageCandidate} from './source-content-verification-lineage.ts';

interface ReadClient {query(sql:string,args:unknown[]):Promise<{rows:unknown[]}>}
interface Context {observationRef:RuntimeRefV1;targetIndex:number;relativePath:string;documentRef:RuntimeRefV1;observerImplementationRef:RuntimeRefV1}
interface Candidate {status:'UNAVAILABLE'|'DENIED'|'UNVERIFIED';reason:string;verificationRef:RuntimeRefV1|null;storageMutationPerformed:false;executionAuthorized:false;linkAuthorized:false}
const result=(status:Candidate['status'],reason:string,verificationRef:RuntimeRefV1|null=null):Candidate=>({status,reason,verificationRef,storageMutationPerformed:false,executionAuthorized:false,linkAuthorized:false});
const keys=['project_id','id','version','observation_id','observation_version','observation_hash','target_index','relative_path','document_id','document_version','document_hash','observer_implementation_ref','decision','verified_at','expires_at','previous_ref','snapshot_json','content_hash'];
const malformed=()=>result('DENIED','MALFORMED_HEAD');
const inputInvalid=():never=>{throw Error('SOURCE_CONTENT_VERIFICATION_INPUT_INVALID');};
function integer(value:unknown,min=1):number|null {
 if(typeof value!=='number'&&(typeof value!=='string'||!/^(0|[1-9][0-9]{0,15})$/.test(value)))return null;
 const n=Number(value);return Number.isSafeInteger(n)&&n>=min?n:null;
}
function instant(value:unknown):string|null {
 if(isoV1(value))return value;
 if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Date.prototype){try{const s=Date.prototype.toISOString.call(value);return isoV1(s)?s:null;}catch{return null;}}
 return null;
}
function context(value:unknown):Context {
 try {
  const raw=canonicalJson(value);if(Buffer.byteLength(raw,'utf8')>1048576)return inputInvalid();
  const v:unknown=JSON.parse(raw);
  if(!recordV1(v,['observationRef','targetIndex','relativePath','documentRef','observerImplementationRef'])||!refV1(v.observationRef)||v.observationRef.version!==1
   ||!Number.isSafeInteger(v.targetIndex)||v.targetIndex<0||v.targetIndex>199||!isRelativeSourceFileV1(v.relativePath)||!refV1(v.documentRef)||!refV1(v.observerImplementationRef))return inputInvalid();
  return v as unknown as Context;
 }catch{return inputInvalid();}
}
/** 최신 저장 head의 구조 후보만 읽는다. snapshot 내부 의미·실 predecessor·현재 verifier/서명/OS 검증은 없고 route 미등록이다. */
export async function readLatestSourceContentVerificationCandidate(db:ReadClient,projectId:string,expected:unknown,nowMs:number):Promise<Candidate> {
 return readHead(db,projectId,expected,nowMs,null);
}
/** 원관측 수신 이전의 양성만 별도 경로에서 닫는다. 수신시각의 출처·실제 verifier 권위는 증명하지 않는다. */
export async function readLatestSourceContentVerificationAfterReceivedCandidate(db:ReadClient,projectId:string,expected:unknown,receivedAt:unknown,nowMs:number):Promise<Candidate> {
 if(!isoV1(receivedAt)||!Number.isSafeInteger(nowMs)||Date.parse(receivedAt)>nowMs)return inputInvalid();
 return readHead(db,projectId,expected,nowMs,Date.parse(receivedAt));
}
async function readHead(db:ReadClient,projectId:string,expected:unknown,nowMs:number,receivedAtMs:number|null):Promise<Candidate> {
 if(!uuidV1(projectId)||!Number.isSafeInteger(nowMs))return inputInvalid();
 const c=context(expected);
 // 유효/양성/기한/ref hash를 WHERE에서 미리 골라 과거 ACCEPTED로 fallback하지 않는다.
 const {rows}=await db.query(`SELECT ${keys.join(',')} FROM anvil.source_content_verifications WHERE project_id=$1 AND observation_id=$2 AND target_index=$3 ORDER BY version DESC LIMIT 1`,[projectId,c.observationRef.id,c.targetIndex]);
 return inspectRows(rows,projectId,c,nowMs,receivedAtMs);
}
/** 동일 head 행검사를 기존 단독 판독과 새 계보 판독이 공유한다. 외부 접점/허가는 추가하지 않는다. */
function inspectRows(rows:unknown,projectId:string,c:Context,nowMs:number,receivedAtMs:number|null):Candidate {
 if(!arrayV1(rows,1))return malformed();if(rows.length===0)return result('UNAVAILABLE','VERIFICATION_ABSENT');
 try {
  const row=rows[0];if(!recordV1(row,keys))return malformed();
  const verified=instant(row.verified_at),expires=instant(row.expires_at);
  if(!verified||!expires||Date.parse(verified)>nowMs||Date.parse(expires)<=Date.parse(verified)||Date.parse(expires)-Date.parse(verified)>30000)return malformed();
  const raw=canonicalJson({...row,verified_at:verified,expires_at:expires});if(Buffer.byteLength(raw,'utf8')>2*1048576)return malformed();
  const r=JSON.parse(raw) as Record<string,any>,version=integer(r.version);
  if(r.project_id!==projectId||!uuidV1(r.id)||version===null||r.observation_id!==c.observationRef.id||integer(r.observation_version)!==1||r.observation_hash!==c.observationRef.contentHash
   ||integer(r.target_index,0)!==c.targetIndex||r.relative_path!==c.relativePath||r.document_id!==c.documentRef.id||integer(r.document_version)!==c.documentRef.version||r.document_hash!==c.documentRef.contentHash
   ||canonicalJson(r.observer_implementation_ref)!==canonicalJson(c.observerImplementationRef)||!['ACCEPTED','REVOKED','INVALID'].includes(r.decision)||!hashV1(r.content_hash))return malformed();
  if(version===1){if(r.decision!=='ACCEPTED'||r.previous_ref!==null)return malformed();}
  else if(r.decision==='ACCEPTED'||!refV1(r.previous_ref)||r.previous_ref.id!==r.id||r.previous_ref.version!==version-1)return malformed();
  if(!r.snapshot_json||typeof r.snapshot_json!=='object'||Array.isArray(r.snapshot_json))return malformed();
  const snapshot=canonicalJson(r.snapshot_json);if(Buffer.byteLength(snapshot,'utf8')>1048576||contentHash(snapshot)!==r.content_hash)return malformed();
  const ref={id:r.id,version,contentHash:r.content_hash};
  if(r.decision==='REVOKED')return result('DENIED','VERIFICATION_REVOKED',ref);
  if(r.decision==='INVALID')return result('DENIED','VERIFICATION_INVALID',ref);
  if(Date.parse(expires)<=nowMs)return result('DENIED','VERIFICATION_EXPIRED',ref);
  if(receivedAtMs!==null&&Date.parse(verified)<receivedAtMs)return result('DENIED','VERIFICATION_BEFORE_OBSERVATION',ref);
  return result('UNVERIFIED','CURRENT_VERIFIER_UNAVAILABLE',ref);
 }catch{return malformed();}
}

const jsonRow=(alias:string)=>`jsonb_build_object(${keys.map(k=>`'${k}',${k==='verified_at'||k==='expires_at'?`anvil.source_read_iso(${alias}.${k})`:`${alias}.${k}`}`).join(',')})`;
const lineageSql=`WITH head AS (SELECT ${keys.join(',')} FROM anvil.source_content_verifications WHERE project_id=$1 AND observation_id=$2 AND target_index=$3 ORDER BY version DESC LIMIT 1)
 SELECT ${jsonRow('h')} AS "current",CASE WHEN p.id IS NULL THEN NULL ELSE ${jsonRow('p')} END AS "previous"
 FROM head h LEFT JOIN anvil.source_content_verifications p ON p.project_id=h.project_id AND p.id=h.id AND p.version=h.version-1`;
/** 최신 head와 인접 이전 버전의 구조만 읽는 미등록 SOURCE. 실제 DB/current verifier·원자성을 증명하지 않는다. */
export async function readLatestSourceContentVerificationLineageCandidate(db:ReadClient,projectId:string,expected:unknown,receivedAt:unknown,nowMs:number){
 if(!uuidV1(projectId)||!Number.isSafeInteger(nowMs)||!isoV1(receivedAt)||Date.parse(receivedAt)>nowMs)return inputInvalid();
 const c=context(expected),receivedAtMs=Date.parse(receivedAt);
 const {rows}=await db.query(lineageSql,[projectId,c.observationRef.id,c.targetIndex]);
 const resultWithLineage=(head:Candidate,lineage:ReturnType<typeof inspectSourceContentVerificationLineageCandidate>|null=null)=>({...head,lineage,verifierEvidenceVerified:false as const,currentAuthorityVerified:false as const});
 if(!arrayV1(rows,1))return resultWithLineage(malformed());
 if(rows.length===0)return resultWithLineage(result('UNAVAILABLE','VERIFICATION_ABSENT'));
 if(!recordV1(rows[0],['current','previous']))return resultWithLineage(malformed());
 const d=Object.getOwnPropertyDescriptors(rows[0]),current=d.current!.value,previous=d.previous!.value;
 const head=inspectRows([current],projectId,c,nowMs,receivedAtMs);
 if(head.verificationRef===null)return resultWithLineage(head);
 try{
  const lineage=inspectSourceContentVerificationLineageCandidate(previous,current);
  return resultWithLineage(head,lineage);
 }catch{
  // 최신 회수/무효/만료는 보존하고 누락·변조된 이전행을 과거 양성으로 대체하지 않는다.
  return resultWithLineage(head.status==='UNVERIFIED'?result('DENIED','VERIFICATION_LINEAGE_UNAVAILABLE',head.verificationRef):head);
 }
}
