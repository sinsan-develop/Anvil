import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,refV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceContentScopeV1} from '../../../../contracts/runtime/source-content-report-v1.ts';
import {readStageNodeRef} from './document-stage.ts';

interface ReadClient {query(sql:string,args:unknown[]):Promise<{rows:unknown[]}>}
/** 전체 target의 metadata 준비 후보만 묶는다. 하나라도 닫히면 앞선 후보를 폐기하고 후속 조회를 하지 않는다.
 * 분리 SELECT들의 조합이며 원문 byte 검증·원자 snapshot이나 실행/LINK 허가가 아니다. */
export async function readSourceContentTargetDocumentsCandidate(db:ReadClient,value:unknown,nowMs:number){
 if(!Number.isSafeInteger(nowMs))throw Error('SOURCE_CONTENT_DOCUMENT_INPUT_INVALID');
 const scope=readSourceContentScopeV1(value),targets=[];
 for(let i=0;i<scope.targets.length;i++){
  const current=await readSourceContentTargetDocumentCandidate(db,scope,i,nowMs);
  if(current.status!=='UNVERIFIED')return {...current,failedTargetIndex:i,readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const};
  const t=scope.targets[i]!;targets.push({targetIndex:i,documentRef:{...t.documentRef},documentBlobRef:{...t.documentBlobRef}});
 }
 return {...result('UNVERIFIED','ALL_DOCUMENT_ARTIFACT_METADATA_ONLY',{targets}),failedTargetIndex:null,readConsistency:'SEPARATE_READS_NOT_ATOMIC' as const};
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const integer=(v:unknown,min=1):number|null=>{if(typeof v==='string'&&/^(0|[1-9][0-9]*)$/.test(v))v=Number(v);return typeof v==='number'&&Number.isSafeInteger(v)&&v>=min?v:null;};
const result=(status:'UNVERIFIED'|'UNAVAILABLE'|'DENIED',reason:string,candidate:unknown=null)=>({status,reason,candidate,
 bodyBytesVerified:false as const,currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const});
const keys=['document_project_id','document_id','head_version','confirmed_version','version_project_id','version_document_id','version','form_definition_id','form_version','form_hash','stage_ref_json','body_artifact_id','title','content_json','document_hash','artifact_id','artifact_project_id','artifact_draft_id','artifact_bytes','artifact_hash','artifact_media_type','artifact_state','artifact_storage_key','inspection_json','body_link_count','body_link_artifact_id'];
/** exact 문서/본문 Artifact의 저장 metadata만 대조한다. 원문/파일 읽기·재해시·비밀 완전탐지·현재권위는 없다.
 * 기존 ProjectDocuments.version()의 보호 원문 읽기를 호출하지 않으며 실제 route/DB에 연결하지 않는다. */
export async function readSourceContentTargetDocumentCandidate(db:ReadClient,value:unknown,targetIndex:number,nowMs:number){
 if(!Number.isSafeInteger(nowMs)||!Number.isSafeInteger(targetIndex)||targetIndex<0)throw Error('SOURCE_CONTENT_DOCUMENT_INPUT_INVALID');
 const scope=readSourceContentScopeV1(value),target=scope.targets[targetIndex];
 if(!target)throw Error('SOURCE_CONTENT_DOCUMENT_INPUT_INVALID');
 if(nowMs<Date.parse(scope.requestedAt)||nowMs>=Date.parse(scope.expiresAt))return result('DENIED','REQUEST_OUTSIDE_ORIGINAL_LIFETIME');
 const rows=(await db.query(`SELECT d.project_id document_project_id,d.id document_id,d.head_version,d.confirmed_version,
 v.project_id version_project_id,v.document_id version_document_id,v.version,v.form_definition_id,v.form_version,v.form_hash,
 v.stage_ref_json,v.body_artifact_id,v.title,v.content_json,v.content_hash document_hash,
 a.id artifact_id,a.project_id artifact_project_id,a.draft_id artifact_draft_id,a.bytes artifact_bytes,a.content_hash artifact_hash,
 a.media_type artifact_media_type,a.state artifact_state,a.storage_key artifact_storage_key,a.inspection_json,
 bl.body_link_count,bl.body_link_artifact_id
 FROM anvil.documents d LEFT JOIN anvil.document_versions v ON v.project_id=d.project_id AND v.document_id=d.id AND v.version=$3
 LEFT JOIN anvil.artifacts a ON a.project_id=v.project_id AND a.id=v.body_artifact_id
 LEFT JOIN LATERAL (SELECT count(*)::text body_link_count,min(l.artifact_id::text) body_link_artifact_id
 FROM anvil.document_artifact_links l WHERE l.project_id=v.project_id AND l.document_id=v.document_id AND l.version=v.version AND l.kind='BODY') bl ON true
 WHERE d.project_id=$1 AND d.id=$2`,[scope.projectId,target.documentRef.id,target.documentRef.version])).rows;
 if(rows.length===0)return result('UNAVAILABLE','DOCUMENT_ABSENT');
 try{
  if(rows.length!==1||!recordV1(rows[0],keys))return result('DENIED','DOCUMENT_METADATA_INVALID');
  const raw=canonicalJson(rows[0]);if(Buffer.byteLength(raw,'utf8')>4194304)return result('DENIED','DOCUMENT_METADATA_INVALID');
  const r=JSON.parse(raw),version=integer(r.version),head=integer(r.head_version),confirmed=integer(r.confirmed_version),formVersion=integer(r.form_version);
  if(r.document_project_id!==scope.projectId||r.version_project_id!==scope.projectId||r.document_id!==target.documentRef.id||r.version_document_id!==target.documentRef.id
   ||version!==target.documentRef.version||head===null||head<version||confirmed!==version||formVersion===null)return result('DENIED','DOCUMENT_VERSION_UNAVAILABLE');
  const formRef={id:r.form_definition_id,version:formVersion,contentHash:r.form_hash},content=r.content_json,stageNodeRef=readStageNodeRef(r.stage_ref_json);
  if(!refV1(formRef)||typeof r.title!=='string'||!r.title.trim()||r.title.length>200||!recordV1(content,['body','attachments','sections','sourceRefs'])
   ||!Array.isArray(content.attachments)||content.attachments.length>200||!Array.isArray(content.sections)||content.sections.length>200||!same(content.sourceRefs,[])
   ||contentHash(canonicalJson({title:r.title,formRef,stageNodeRef,content}))!==r.document_hash)return result('DENIED','DOCUMENT_METADATA_INVALID');
  if(r.document_hash!==target.documentRef.contentHash)return result('DENIED','DOCUMENT_REF_CHANGED');
  if(!same(content.body,target.documentBlobRef))return result('DENIED','DOCUMENT_BODY_REF_CHANGED');
  const blob=target.documentBlobRef;
  if(r.artifact_id!==blob.artifactId||r.body_artifact_id!==blob.artifactId||r.artifact_project_id!==scope.projectId||r.artifact_draft_id!==null
   ||integer(r.artifact_bytes,0)!==blob.bytes||r.artifact_hash!==blob.contentHash||r.artifact_media_type!==blob.mediaType
   ||!['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(blob.mediaType)
   ||r.artifact_storage_key!==`blobs/${scope.projectId}/${blob.artifactId}`||integer(r.body_link_count)!==1||r.body_link_artifact_id!==blob.artifactId)return result('DENIED','ARTIFACT_METADATA_INVALID');
  if(r.artifact_state==='QUARANTINED')return result('DENIED','ARTIFACT_QUARANTINED');
  if(r.artifact_state!=='READY')return result('DENIED','ARTIFACT_NOT_READY');
  if(r.inspection_json!==null){const i=r.inspection_json;
   if(!recordV1(i,['policyVersion','method','complete','state','reasonCodes'])||i.policyVersion!==1||i.method!=='KNOWN_PATTERNS_RAW_BYTES'||i.complete!==false)return result('DENIED','ARTIFACT_INSPECTION_METADATA_INVALID');
   if(i.state==='SUSPECTED')return result('DENIED','ARTIFACT_QUARANTINED');
   if(i.state!=='NO_KNOWN_MARKER'||!same(i.reasonCodes,[]))return result('DENIED','ARTIFACT_INSPECTION_METADATA_INVALID');
  }
  return result('UNVERIFIED','DOCUMENT_ARTIFACT_METADATA_ONLY',{targetIndex,documentRef:{...target.documentRef},documentBlobRef:{...blob}});
 }catch{return result('DENIED','DOCUMENT_METADATA_INVALID');}
}
