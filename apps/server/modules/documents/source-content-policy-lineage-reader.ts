import {canonicalJson} from '../../../../contracts/canonical.ts';
import {recordV1,arrayV1,uuidV1,isoV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {inspectSourceContentPolicyHeadCandidate,type SourceContentPolicyCandidate} from './source-content-policy-head.ts';
import {inspectSourceContentPolicyLineageCandidate} from './source-content-policy-lineage.ts';

interface ReadClient {query(sql:string,args:unknown[]):Promise<{rows:unknown[]}>}
const headKeys=['project_id','id','version','sequence','subject_user_id','disposition','recorded_at','expires_at','snapshot_json','content_hash'];
const keys=[...headKeys,'previous_ref','management_command_id'];
const json=(alias:string)=>`jsonb_build_object(${keys.map(k=>`'${k}',${k==='recorded_at'||k==='expires_at'?`anvil.source_read_iso(${alias}.${k})`:`${alias}.${k}`}`).join(',')})`;
const sql=`WITH head AS (SELECT ${keys.join(',')} FROM anvil.source_content_policy_events WHERE project_id=$1 ORDER BY sequence DESC LIMIT 1)
 SELECT ${json('h')} AS "current",CASE WHEN p.id IS NULL THEN NULL ELSE ${json('p')} END AS "previous"
 FROM head h LEFT JOIN anvil.source_content_policy_events p ON p.project_id=h.project_id AND p.sequence=h.sequence-1`;
const result=(status:SourceContentPolicyCandidate['status'],reason:string,policyRef:RuntimeRefV1|null=null,lineage:ReturnType<typeof inspectSourceContentPolicyLineageCandidate>|null=null)=>({status,reason,policyRef,lineage,
 managementEvidenceVerified:false as const,currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const});
function copyRow(value:unknown):Record<string,any>{
 if(!recordV1(value,keys))throw Error('ROW_INVALID');
 const d=Object.getOwnPropertyDescriptors(value),r=Object.fromEntries(keys.map(k=>[k,d[k]!.value]));
 for(const k of ['recorded_at','expires_at']){
  if(isoV1(r[k]))continue;
  if(r[k]&&typeof r[k]==='object'&&Object.getPrototypeOf(r[k])===Date.prototype){r[k]=Date.prototype.toISOString.call(r[k]);if(isoV1(r[k]))continue;}
  throw Error('ROW_INVALID');
 }
 const raw=canonicalJson(r);if(Buffer.byteLength(raw,'utf8')>2097152)throw Error('ROW_INVALID');return JSON.parse(raw);
}
/** 최신 head를 먼저 고정한 비활성 SOURCE. 실제 SQL/관리근거/current 권위·fullscope/targets는 미검증이다. */
export async function readLatestSourceContentPolicyLineageCandidate(db:ReadClient,projectId:string,subjectUserId:string,nowMs:number){
 if(!uuidV1(projectId)||!uuidV1(subjectUserId)||!Number.isSafeInteger(nowMs))throw Error('SOURCE_CONTENT_POLICY_INPUT_INVALID');
 const {rows}=await db.query(sql,[projectId]); // 실제 DB 오류는 구조 음성으로 덮지 않는다.
 if(!arrayV1(rows,1))return result('DENIED','MALFORMED_HEAD');
 if(rows.length===0)return result('UNAVAILABLE','POLICY_ABSENT');
 try {
  if(!recordV1(rows[0],['current','previous']))return result('DENIED','MALFORMED_HEAD');
  const d=Object.getOwnPropertyDescriptors(rows[0]),current=copyRow(d.current!.value);
  const head=inspectSourceContentPolicyHeadCandidate([Object.fromEntries(headKeys.map(k=>[k,current[k]]))],projectId,subjectUserId,nowMs);
  if(head.status!=='UNVERIFIED')return result(head.status,head.reason,head.policyRef);
  try {
   const previous=d.previous!.value===null?null:copyRow(d.previous!.value);
   const lineage=inspectSourceContentPolicyLineageCandidate(previous,current);
   if(canonicalJson(lineage.policyRef)!==canonicalJson(head.policyRef))return result('DENIED','POLICY_LINEAGE_UNAVAILABLE',head.policyRef);
   return result('UNVERIFIED','POLICY_LINEAGE_SHAPE_ONLY',head.policyRef,lineage);
  }catch{return result('DENIED','POLICY_LINEAGE_UNAVAILABLE',head.policyRef);}
 }catch{return result('DENIED','MALFORMED_HEAD');}
}
