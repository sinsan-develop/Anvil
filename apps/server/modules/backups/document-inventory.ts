import type {PoolClient} from 'pg';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,recordV1,uuidV1,hashV1,refV1,isoV1,cloneV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readApplicationSnapshot} from '../methodologies/application-snapshot.ts';
import {readStageNodeRef,nodeUsesForm,documentDraftReason} from '../documents/document-stage.ts';
import {readDocumentSourceLinkHistory} from '../documents/document-source-link-history.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {isImportArtifact} from '../documents/project-imports.ts';
import {documentReviewCriteria} from '../documents/project-content-review.ts';
import {readDocumentInventoryInput,type DocumentInventoryRequest} from './document-inventory-input.ts';

type Row=Record<string,any>;
type Ref={id:string;version:number;contentHash:string};
interface Spec{from:string;columns:string[];keys:string[];scope:'PROJECT'|'FORM'|'METHOD'|'STANDARD';id:string;version?:string;hash?:string}
const cols=(s:string)=>s.split(' ');
const project=(table:string,columns:string,keys='id'):Spec=>({from:`anvil.${table} t`,columns:cols(columns).map(c=>`t.${c}`),keys:cols(keys),scope:'PROJECT',id:'t.id'});
const specs:Record<string,Spec>={
 documents:project('documents','id project_id title head_version confirmed_version created_by created_at updated_at'),
 document_versions:project('document_versions','project_id document_id version form_definition_id form_version form_hash stage_ref_json body_artifact_id title source_refs_json content_json content_hash sections_json author_ref_json validation_json reason client_id command_id created_at','document_id version'),
 document_artifact_links:project('document_artifact_links','project_id document_id version artifact_id kind','document_id version artifact_id kind'),
 artifacts:project('artifacts','id project_id bytes content_hash media_type state inspection_json'),
 document_imports:project('document_imports','id project_id original_artifact_id form_definition_id form_version form_hash candidate_json content_hash created_by client_id command_id created_at'),
 document_import_selections:project('document_import_selections','id project_id import_id document_id version created_by client_id command_id created_at'),
 document_proposals:project('document_proposals','id project_id document_id base_version base_hash body_artifact_id diff_artifact_id content_json proposal_json content_hash reason created_by client_id command_id created_at'),
 document_proposal_selections:project('document_proposal_selections','id project_id proposal_id document_id version created_by client_id command_id created_at'),
 content_reviews:project('content_reviews','id scope_kind scope_id project_id target_kind target_id target_version target_hash criteria_version criteria_snapshot_json items_json outcome reviewer_user_id client_id reviewer_subject_ref source_kind reason command_id created_at'),
 document_version_events:project('document_version_events','id project_id document_id version event_kind review_ref actor_ref reason command_id created_at'),
 document_confirmations:project('document_confirmations','id project_id document_id version target_hash form_ref review_refs validation_json confirmed_by client_id command_id created_at'),
 document_source_links:project('document_source_links','project_id id document_id version source_root_id relative_path source_snapshot_ref blob_hash link_version state current_event_id linked_at updated_at'),
 document_source_link_events:project('document_source_link_events','id project_id link_id link_version content_hash snapshot_json command_id created_at'),
 project_methodologies:project('project_methodologies','id project_id application_version source_definition_id source_version source_hash snapshot_json snapshot_hash created_by created_at'),
 form_definitions:{from:'anvil.form_definitions d JOIN anvil.form_versions v ON v.definition_id=d.id',columns:cols('d.id d.scope d.owner_user_id d.project_id d.form_code d.name v.version v.definition_json v.content_hash v.authoring_standard_id v.authoring_standard_version v.authoring_standard_hash v.authoring_standard_ref v.origin_ref_json v.created_by v.created_at'),keys:['id','version'],scope:'FORM',id:'d.id',version:'v.version',hash:'v.content_hash'},
 authoring_standard_versions:{from:'anvil.authoring_standard_versions t',columns:cols('id version content_hash created_at').map(c=>`t.${c}`),keys:['id','version'],scope:'STANDARD',id:'t.id',version:'t.version',hash:'t.content_hash'},
 methodology_definitions:{from:'anvil.methodology_definitions d JOIN anvil.methodology_versions v ON v.definition_id=d.id',columns:cols('d.id d.scope d.owner_user_id d.project_id d.system_code v.version v.name v.purpose v.graph_json v.content_hash v.origin_ref_json v.reason v.created_by v.created_at'),keys:['id','version'],scope:'METHOD',id:'d.id',version:'v.version',hash:'v.content_hash'}
};
const ownFailures=new WeakSet<AuthFailure>();
const bad=(code='DOCUMENT_INVENTORY_INTEGRITY_FAILED',status=503):never=>{const error=new AuthFailure(code,status);ownFailures.add(error);throw error;};
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const integer=(value:unknown,min=0):number=>{if(typeof value==='string'&&!/^(0|[1-9][0-9]*)$/.test(value))return bad();const n=typeof value==='number'||typeof value==='string'?Number(value):NaN;if(!Number.isSafeInteger(n)||n<min)return bad();return n;};
function stamp(v:unknown){if(!(v instanceof Date)&&typeof v!=='string')return bad();const d=new Date(v);if(!Number.isFinite(d.getTime()))return bad();return d.toISOString();}
function exactRef(value:unknown):Ref{if(!refV1(value))return bad();return cloneV1(value);}
const rk=(r:Ref)=>`${r.id}:${r.version}:${r.contentHash}`;
const vk=(id:string,version:number)=>`${id}:${version}`;
function rowRef(row:Row,id='id',version='version',digest='content_hash'):Ref{return exactRef({id:row[id],version:integer(row[version],1),contentHash:row[digest]});}
function metadata(row:Row):Row{const result:Row={};for(const [key,value]of Object.entries(row)){if(key==='project_id')continue;result[key.replace(/_([a-z])/g,(_,c:string)=>c.toUpperCase())]=key.endsWith('_at')&&value!==null?stamp(value):cloneV1(value);}return result;}
function safeMetadata(value:unknown){if(inspectArtifact(Buffer.from(canonicalJson(value))).state==='SUSPECTED')bad('DOCUMENT_INVENTORY_SENSITIVE_METADATA',503);}
function tuple(row:Row,keys:string[]){return keys.map(k=>k==='version'?integer(row[k],1):row[k]);}
function compare(a:unknown[],b:unknown[]){for(let i=0;i<a.length;i++){const x=a[i],y=b[i];if(typeof x==='number'&&typeof y==='number'){if(x!==y)return x<y?-1:1;}else{if(typeof x!=='string'||typeof y!=='string')return bad();if(x!==y)return x<y?-1:1;}}return 0;}

export interface DocumentBodyHistoryRows {
 readonly version: Row;
 readonly link: Row;
 readonly artifact: Row;
}
export interface DocumentDraftHistoryRows extends DocumentBodyHistoryRows {
 readonly origin:{command:Row;receipt:Row;audit:Row};
}
export interface DocumentSystemFormHistoryRows extends DocumentDraftHistoryRows {
 readonly systemForm:{definition:Row;standard:Row};
}
type DocumentCommandOrigin=DocumentDraftHistoryRows['origin'];
export interface DocumentConfirmationHistoryRows extends DocumentSystemFormHistoryRows {
 readonly confirmation:{row:Row;origin:DocumentCommandOrigin;latestBefore:Row;reviews:{row:Row;origin:DocumentCommandOrigin}[]};
}
const systemFormProjection={
 from:specs.form_definitions!.from,
 columns:cols('d.id d.scope d.owner_user_id d.project_id d.form_code v.version v.definition_json v.content_hash v.authoring_standard_id v.authoring_standard_version v.authoring_standard_hash v.authoring_standard_ref v.created_by v.created_at')
};
const standardProjection=specs.authoring_standard_versions!;
export const projectHistoryOriginColumns={
 commands:cols('id project_id draft_id scope_kind scope_id actor_id client_id operation command_id request_hash operation_id state authorization_receipt_id approval_consumption_id expected_version control_generation policy_ref payload_ref result_ref received_at completed_at'),
 authorization_receipts:cols('id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at'),
 audit_events:cols('project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of')
};
const confirmationOrderProjection={
 from:'anvil.content_reviews t JOIN anvil.audit_events a ON a.project_id=t.project_id AND a.command_id=t.command_id',
 columns:['t.id','t.outcome','a.server_sequence']
};
const projectDocumentReview="t.scope_kind='PROJECT' AND t.scope_id=$1::uuid AND t.target_kind='DOCUMENT' AND t.criteria_version=1 AND t.source_kind='HUMAN_REVIEW'";
const projectDocumentReviewTarget='t.target_id=$2::uuid AND t.target_version=$3::bigint AND t.target_hash=$4::text';

/** 원형과 BODY 관계만 검사한다. 현재 권한이나 전체 문서 역사의 완결을 표시하지 않는다. */
export function checkDocumentBodyHistoryRows(projectId:string,ref:Ref,value:unknown){
 if(!uuidV1(projectId)||!refV1(ref)||!recordV1(value,['version','link','artifact']))return bad();
 const {version,link,artifact}=value;
 const keys=(spec:Spec)=>spec.columns.map(c=>c.slice(c.indexOf('.')+1));
 if(!recordV1(version,keys(specs.document_versions!))||!recordV1(link,keys(specs.document_artifact_links!))
  ||!recordV1(artifact,keys(specs.artifacts!))||[version,link,artifact].some(row=>row.project_id!==projectId)
  ||!same(rowRef(version,'document_id'),ref)||link.document_id!==ref.id||integer(link.version,1)!==ref.version||link.kind!=='BODY')return bad();
 const formRef=exactRef({id:version.form_definition_id,version:integer(version.form_version,1),contentHash:version.form_hash});
 const content=version.content_json;
 if(typeof version.title!=='string'||!recordV1(content,['body','attachments','sections','sourceRefs'])||!isImportArtifact(content.body)
  ||!same(version.sections_json,content.sections)||!same(version.source_refs_json,content.sourceRefs)
  ||hash({title:version.title,formRef,stageNodeRef:version.stage_ref_json,content})!==ref.contentHash
  ||version.body_artifact_id!==content.body.artifactId||link.artifact_id!==version.body_artifact_id)return bad();
 const body={artifactId:artifact.id,bytes:integer(artifact.bytes),contentHash:artifact.content_hash,mediaType:artifact.media_type};
 const inspection=artifact.inspection_json;
 if(!same(body,content.body)||body.bytes>20*1024*1024||artifact.state!=='READY'
  ||!recordV1(inspection,['policyVersion','method','complete','state','reasonCodes'])||inspection.policyVersion!==1
  ||inspection.method!=='KNOWN_PATTERNS_RAW_BYTES'||inspection.complete!==false||inspection.state!=='NO_KNOWN_MARKER'
  ||!same(inspection.reasonCodes,[]))return bad();
 safeMetadata(value);
 return body;
}

/** 원 명령·인가·감사 관계만 검산한다. 원 요청 본문이나 현재 권위를 발급하지 않는다. */
export function checkDocumentDraftHistoryRows(projectId:string,ref:Ref,value:unknown){
 if(!recordV1(value,['version','link','artifact','origin'])||!recordV1(value.origin,['command','receipt','audit']))return bad();
 const {version,link,artifact,origin:{command,receipt,audit}}=value;
 const body=checkDocumentBodyHistoryRows(projectId,ref,{version,link,artifact});
 if(!recordV1(command,projectHistoryOriginColumns.commands)||!recordV1(receipt,projectHistoryOriginColumns.authorization_receipts)
  ||!recordV1(audit,projectHistoryOriginColumns.audit_events)||![command.id,command.command_id,command.actor_id,command.client_id,
   command.operation_id,command.authorization_receipt_id,audit.event_id].every(uuidV1)||!hashV1(command.request_hash)
  ||command.id!==version.command_id||command.client_id!==version.client_id||command.project_id!==projectId
  ||!same(version.author_ref_json,{kind:'HUMAN',userId:command.actor_id})||version.stage_ref_json!==null
  ||command.scope_kind!=='PROJECT'||command.scope_id!==projectId||command.draft_id!==null||command.operation!=='saveDocumentDraft'
  ||command.state!=='APPLIED'||integer(command.expected_version)!==ref.version-1
  ||command.approval_consumption_id!==null||command.payload_ref!==null||!refV1(command.policy_ref))return bad();
 const scopeDigest=hash({projectId,actorId:command.actor_id,clientId:command.client_id,controlGeneration:integer(command.control_generation,1),
  requestHash:command.request_hash,policyRef:command.policy_ref,targetRef:ref});
 if(receipt.id!==command.authorization_receipt_id||receipt.command_id!==command.id||receipt.scope_kind!=='PROJECT'||receipt.scope_id!==projectId
  ||receipt.approval_decision_ref!==null||!same(receipt.policy_ref,command.policy_ref)||receipt.scope_digest!==scopeDigest
  ||!same(receipt.subject_ref,{kind:'HUMAN',userId:command.actor_id,clientId:command.client_id}))return bad();
 const result=command.result_ref;
 const validation=version.validation_json;
 if(!recordV1(validation,['validForConfirmation','issues','formatOnly','contentReview','userAcceptance'])||validation.formatOnly!==true
  ||validation.contentReview!=='NOT_PERFORMED'||validation.userAcceptance!=='NOT_PERFORMED'||!arrayV1(validation.issues,200)
  ||validation.validForConfirmation!==(validation.issues.length===0)
  ||validation.issues.some(issue=>!recordV1(issue,['code','location','severity','message'])||issue.code!=='REQUIRED_SECTION_MISSING'
   ||typeof issue.location!=='string'||!issue.location.startsWith('sections.')||issue.severity!=='ERROR'||issue.message!=='양식의 필수 항목과 원문 위치를 연결하세요.'))return bad();
 if(!recordV1(result,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt'])
  ||result.operationId!==command.operation_id||result.commandId!==command.command_id||result.projectId!==projectId||result.status!=='APPLIED'
  ||result.targetId!==ref.id||result.version!==ref.version||!isoV1(result.serverReceivedAt)||result.serverReceivedAt!==stamp(command.received_at)
  ||!same(result.evidenceRefs,[])||!same(result.warnings,[])
  ||!same(result.data,{ref,status:'DRAFT',validation,stageNodeRef:null,stageBinding:null,importCandidateRef:null,proposalRef:null}))return bad();
 if(audit.project_id!==projectId||audit.command_id!==command.id||audit.operation_id!==command.operation_id
  ||!same(audit.actor_ref,version.author_ref_json)||audit.client_ref!==command.client_id
  ||!same(audit.target_ref,ref)||!same(audit.policy_ref,command.policy_ref)||audit.approval_ref!==null
  ||audit.outcome!=='APPLIED'||audit.reason_code!==documentDraftReason()||audit.source_kind!=='HUMAN_COMMAND'
  ||audit.scope_digest!==scopeDigest||audit.correction_of!==null
  ||![command.completed_at,receipt.authorized_at,audit.recorded_at,version.created_at].every(at=>at===command.received_at))return bad();
 integer(audit.server_sequence,1);
 safeMetadata(value.origin);
 // 이 ref들은 비권한 역사 투영의 지문이다. 인가 scopeDigest는 원 관계 검산에만 사용한다.
 return {body,commandProjectionRef:{id:command.id,version:1,contentHash:hash(command)},
  receiptProjectionRef:{id:receipt.id,version:1,contentHash:hash(receipt)},auditProjectionRef:{id:audit.event_id,version:1,contentHash:hash(audit)}};
}

/** 호출자가 이미 보유한 보호 거래만 사용한다. 직접 인증, 연결, 거래 시작을 하지 않는다. */
type ProjectHistoryOperation='saveDocumentDraft'|'recordContentReview'|'confirmDocument'|'saveWorkPlanDraft'|'confirmWorkPlan';
type OriginTable=keyof typeof projectHistoryOriginColumns;

/** 내부 scope·예산이 이미 적용되는 reader에서 별도 승인 소비 없는 원행만 읽는다. */
export async function readProjectHistoryOrigin(readRow:(table:OriginTable,predicate:string,args:unknown[])=>Promise<Row>,
 commandId:unknown,operation:ProjectHistoryOperation){
 if(!uuidV1(commandId))return bad();
 const command=await readRow('commands',`t.id=$2::uuid AND t.scope_kind='PROJECT' AND t.draft_id IS NULL AND t.operation='${operation}' AND t.approval_consumption_id IS NULL AND t.payload_ref IS NULL`,[commandId]);
 if(!uuidV1(command.authorization_receipt_id))return bad();
 const receipt=await readRow('authorization_receipts',"t.id=$2::uuid AND t.scope_kind='PROJECT' AND t.command_id=$3::uuid AND t.approval_decision_ref IS NULL",[command.authorization_receipt_id,commandId]);
 const audit=await readRow('audit_events','t.command_id=$2::uuid AND t.correction_of IS NULL',[commandId]);
 return {command,receipt,audit};
}

export async function readDocumentSystemFormHistoryRows(db:Pick<PoolClient,'query'>,projectId:string,ref:Ref,expectedFormRef:Ref,metadataBytes:number,confirmationId:string):Promise<DocumentConfirmationHistoryRows>;
export async function readDocumentSystemFormHistoryRows(db:Pick<PoolClient,'query'>,projectId:string,ref:Ref,expectedFormRef:Ref,metadataBytes:number):Promise<DocumentSystemFormHistoryRows>;
export async function readDocumentSystemFormHistoryRows(db:Pick<PoolClient,'query'>,projectId:string,ref:Ref,expectedFormRef:Ref,metadataBytes:number,confirmationId?:string):Promise<DocumentSystemFormHistoryRows|DocumentConfirmationHistoryRows>{
 if(!uuidV1(projectId)||!refV1(ref)||!refV1(expectedFormRef)||!Number.isSafeInteger(metadataBytes)||metadataBytes<1
  ||confirmationId!==undefined&&!uuidV1(confirmationId))return bad();
 let remaining=metadataBytes;
 async function fixed(spec:{from:string;columns:string[]},predicate:string,args:unknown[],exactLatest=false){
  const cap=args.length+1;
  const sql=`/*FN16_D2_BODY*/ WITH material AS (
   SELECT ${spec.columns.join(',')} FROM ${spec.from} WHERE ${predicate}${exactLatest?' ORDER BY a.server_sequence DESC LIMIT 1':' LIMIT 2'}
  ) SELECT CASE WHEN octet_length(to_jsonb(material)::text)<=$${cap}::bigint THEN to_jsonb(material) END AS inventory_data,
   octet_length(to_jsonb(material)::text) AS row_bytes FROM material`;
  const {rows}=await db.query(sql,[...args,remaining]);
  if(rows.length!==1||!recordV1(rows[0],['inventory_data','row_bytes']))return bad();
  const count=integer(rows[0].row_bytes,1),row=rows[0].inventory_data;
  if(count>remaining||!recordV1(row,spec.columns.map(c=>c.slice(c.indexOf('.')+1)))
   ||Buffer.byteLength(canonicalJson(row))>count)return bad();
  remaining-=count;
  return cloneV1(row);
 }
 function projectRow(table:'document_versions'|'document_artifact_links'|'artifacts'|'document_confirmations'|'content_reviews'|keyof typeof projectHistoryOriginColumns,predicate:string,args:unknown[]){
  const projection=Object.hasOwn(projectHistoryOriginColumns,table)
   ?{from:`anvil.${table} t`,columns:projectHistoryOriginColumns[table as keyof typeof projectHistoryOriginColumns].map(c=>`t.${c}`)}
   :specs[table]!;
  const scope=table==='authorization_receipts'?'t.scope_id':'t.project_id';
  return fixed(projection,`${scope}=$1::uuid AND ${predicate}`,[projectId,...args]);
 }
 const version=await projectRow('document_versions','t.document_id=$2::uuid AND t.version=$3::bigint AND t.content_hash=$4::text',[ref.id,ref.version,ref.contentHash]);
 if(!uuidV1(version.body_artifact_id)||!uuidV1(version.command_id)||version.stage_ref_json!==null)return bad();
 const formRef=exactRef({id:version.form_definition_id,version:integer(version.form_version,1),contentHash:version.form_hash});
 if(!same(formRef,expectedFormRef))return bad();
 const link=await projectRow('document_artifact_links',"t.document_id=$2::uuid AND t.version=$3::bigint AND t.kind='BODY'",[ref.id,ref.version]);
 const artifact=await projectRow('artifacts',"t.id=$2::uuid AND t.draft_id IS NULL AND t.storage_key='blobs/'||t.project_id::text||'/'||t.id::text",[version.body_artifact_id]);
 checkDocumentBodyHistoryRows(projectId,ref,{version,link,artifact});
 const rows={version,link,artifact,origin:await readProjectHistoryOrigin(projectRow,version.command_id,'saveDocumentDraft')};
 checkDocumentDraftHistoryRows(projectId,ref,rows);
 const definition=await fixed(systemFormProjection,"d.id=$1::uuid AND v.version=$2::bigint AND v.content_hash=$3::text AND d.scope='SYSTEM' AND d.owner_user_id IS NULL AND d.project_id IS NULL",
  [formRef.id,formRef.version,formRef.contentHash]);
 const standardRef=checkSystemFormDefinition(definition,formRef);
 const standard=await fixed(standardProjection,'t.id=$1::uuid AND t.version=$2::bigint AND t.content_hash=$3::text',
  [standardRef.id,standardRef.version,standardRef.contentHash]);
 const complete={...rows,systemForm:{definition,standard}};
 checkDocumentSystemFormHistoryRows(projectId,ref,complete);
 if(confirmationId===undefined)return complete;
 const confirmation=await projectRow('document_confirmations','t.id=$2::uuid AND t.document_id=$3::uuid AND t.version=$4::bigint AND t.target_hash=$5::text',
  [confirmationId,ref.id,ref.version,ref.contentHash]);
 const selected=checkConfirmationRow(projectId,ref,confirmationId,formRef,version,confirmation);
 const origin=await readProjectHistoryOrigin(projectRow,confirmation.command_id,'confirmDocument');
 const sequence=checkConfirmationOrigin(projectId,ref,confirmation,origin).sequence;
 // 원 확정 쿼리의 정렬을 원 확정 sequence 직전으로 제한한다. 이후 검토·정정은 포함하지 않는다.
 const latestBefore=await fixed(confirmationOrderProjection,
  `t.project_id=$1::uuid AND ${projectDocumentReview} AND ${projectDocumentReviewTarget} AND a.server_sequence<$5::bigint`,
  [projectId,ref.id,ref.version,ref.contentHash,sequence],true);
 const reviews=[];
 for(const selection of selected){
  const row=await projectRow('content_reviews',
   `t.id=$2::uuid AND ${projectDocumentReview} AND t.target_id=$3::uuid AND t.target_version=$4::bigint AND t.target_hash=$5::text`,
   [selection.id,ref.id,ref.version,ref.contentHash]);
  if(row.id!==selection.id||row.project_id!==projectId||!same(rowRef(row,'target_id','target_version','target_hash'),ref))return bad();
  reviews.push({row,origin:await readProjectHistoryOrigin(projectRow,row.command_id,'recordContentReview')});
 }
 const confirmed={...complete,confirmation:{row:confirmation,origin,latestBefore,reviews}};
 checkDocumentConfirmationHistoryRows(projectId,ref,confirmationId,confirmed);
 return confirmed;
}

function checkSystemFormDefinition(row:unknown,ref:Ref){
 if(!recordV1(row,systemFormProjection.columns.map(c=>c.slice(c.indexOf('.')+1)))||!same(rowRef(row),ref)
  ||row.scope!=='SYSTEM'||row.owner_user_id!==null||row.project_id!==null||row.created_by!==null)return bad();
 const definition=row.definition_json;
 if(!recordV1(definition,['formCode','name','purpose','scope','authorRole','reviewerRole','confirmerRole','requiredInputs','items','authoringStandardRef'])
  ||definition.scope!=='SYSTEM'||typeof row.form_code!=='string'||!/^AF0[1-8]$/.test(row.form_code)||definition.formCode!==row.form_code
  ||hash(definition)!==ref.contentHash)return bad();
 stamp(row.created_at);
 const standardRef=exactRef({id:row.authoring_standard_id,version:integer(row.authoring_standard_version,1),contentHash:row.authoring_standard_hash});
 if(!same(row.authoring_standard_ref,standardRef)||!same(definition.authoringStandardRef,standardRef))return bad();
 safeMetadata(row);
 return standardRef;
}

/** 시스템 양식 버전의 원 정의와 작성 표준의 참조 투영을 검산한다. 표준 본문·효력은 증명하지 않는다. */
export function checkDocumentSystemFormHistoryRows(projectId:string,ref:Ref,value:unknown){
 if(!recordV1(value,['version','link','artifact','origin','systemForm'])||!recordV1(value.systemForm,['definition','standard']))return bad();
 const {version,link,artifact,origin,systemForm:{definition,standard}}=value;
 const draft=checkDocumentDraftHistoryRows(projectId,ref,{version,link,artifact,origin});
 const formRef=exactRef({id:version.form_definition_id,version:integer(version.form_version,1),contentHash:version.form_hash});
 const standardRef=checkSystemFormDefinition(definition,formRef);
 if(!recordV1(standard,standardProjection.columns.map(c=>c.slice(c.indexOf('.')+1)))||!same(rowRef(standard),standardRef))return bad();
 stamp(standard.created_at);
 return {...draft,formRef,formProjectionHash:hash(definition),standardRef,standardProjectionHash:hash(standard)};
}

function checkConfirmationRow(projectId:string,ref:Ref,confirmationId:string,formRef:Ref,version:Row,row:unknown){
 if(!recordV1(row,cols('id project_id document_id version target_hash form_ref review_refs validation_json confirmed_by client_id command_id created_at'))
  ||!uuidV1(confirmationId)||row.id!==confirmationId||row.project_id!==projectId||!same(rowRef(row,'document_id','version','target_hash'),ref)
  ||!same(row.form_ref,formRef)||!same(row.validation_json,version.validation_json)||row.validation_json.validForConfirmation!==true
  ||!arrayV1(row.review_refs,200)||row.review_refs.length===0)return bad();
 const ids=new Set<string>();
 for(const selected of row.review_refs){
  if(!recordV1(selected,['id','targetRef','outcome','criteriaVersion'])||!uuidV1(selected.id)||ids.has(selected.id)
   ||!same(selected.targetRef,ref)||selected.outcome!=='ACCEPTED'||selected.criteriaVersion!==1)return bad();
  ids.add(selected.id);
 }
 return row.review_refs as {id:string;targetRef:Ref;outcome:'ACCEPTED';criteriaVersion:1}[];
}

export function checkProjectHistoryOrigin(projectId:string,ref:Ref,origin:unknown,source:{
 operation:ProjectHistoryOperation;reasonCode:string;commandId:unknown;actorId:unknown;clientId:unknown;createdAt:unknown;
 payload:object;resultData:object;requestBinding?:{targetId:string|null;expectedVersion:number};
}){
 const {targetId,expectedVersion}=source.requestBinding??{targetId:ref.id,expectedVersion:ref.version};
 if(!recordV1(origin,['command','receipt','audit']))return bad();
 const {command,receipt,audit}=origin;
 if(!recordV1(command,projectHistoryOriginColumns.commands)||!recordV1(receipt,projectHistoryOriginColumns.authorization_receipts)||!recordV1(audit,projectHistoryOriginColumns.audit_events)
  ||![command.id,command.command_id,command.operation_id,command.actor_id,command.client_id,command.authorization_receipt_id,audit.event_id].every(uuidV1)
  ||command.id!==source.commandId||command.actor_id!==source.actorId||command.client_id!==source.clientId
  ||command.scope_kind!=='PROJECT'||command.scope_id!==projectId||command.project_id!==projectId||command.draft_id!==null
  ||command.operation!==source.operation||command.state!=='APPLIED'||integer(command.expected_version)!==expectedVersion
  ||command.approval_consumption_id!==null||command.payload_ref!==null||!refV1(command.policy_ref))return bad();
 const {actor_id:actorId,client_id:clientId,policy_ref:policyRef}=command;
 const controlGeneration=integer(command.control_generation,1);
 // 일반 자료 명령의 baselineRefs는 빈 배열이고 이 보호 사본은 별도 승인 소비가 없는 원 요청만 포함한다.
 const requestHash=hash({schemaVersion:1,projectId,commandId:command.command_id,clientId,controlGeneration,
  operation:source.operation,targetId,expectedVersion,baselineRefs:[],approvalRef:null,payload:source.payload});
 if(command.request_hash!==requestHash)return bad();
 const scopeDigest=hash({projectId,actorId,clientId,controlGeneration,requestHash,policyRef,targetRef:ref});
 const human={kind:'HUMAN',userId:actorId};
 if(receipt.id!==command.authorization_receipt_id||receipt.command_id!==command.id||receipt.scope_kind!=='PROJECT'||receipt.scope_id!==projectId
  ||receipt.approval_decision_ref!==null||!same(receipt.policy_ref,policyRef)||receipt.scope_digest!==scopeDigest
  ||!same(receipt.subject_ref,{...human,clientId}))return bad();
 if(!same(command.result_ref,{operationId:command.operation_id,commandId:command.command_id,projectId,
  status:'APPLIED',targetId:ref.id,version:ref.version,data:{ref,...source.resultData},evidenceRefs:[],warnings:[],serverReceivedAt:stamp(command.received_at)}))return bad();
 if(audit.project_id!==projectId||audit.command_id!==command.id||audit.operation_id!==command.operation_id
  ||!same(audit.actor_ref,human)||audit.client_ref!==clientId||!same(audit.target_ref,ref)||!same(audit.policy_ref,policyRef)||audit.approval_ref!==null
  ||audit.outcome!=='APPLIED'||audit.reason_code!==source.reasonCode||audit.source_kind!=='HUMAN_COMMAND'
  ||audit.scope_digest!==scopeDigest||audit.correction_of!==null
  ||![command.completed_at,receipt.authorized_at,audit.recorded_at,source.createdAt].every(at=>at===command.received_at))return bad();
 return {sequence:integer(audit.server_sequence,1)};
}

function checkConfirmationOrigin(projectId:string,ref:Ref,row:Row,origin:unknown){
 return checkProjectHistoryOrigin(projectId,ref,origin,{operation:'confirmDocument',reasonCode:'EXPLICIT_DOCUMENT_CONFIRMATION',
  commandId:row.command_id,actorId:row.confirmed_by,clientId:row.client_id,createdAt:row.created_at,
  payload:{versionRef:ref,formRef:row.form_ref,reviewRefs:row.review_refs},resultData:{status:'CONFIRMED',confirmationId:row.id}});
}

function checkSelectedReview(projectId:string,ref:Ref,selected:Row,row:unknown,version:Row,criteria:ReturnType<typeof documentReviewCriteria>){
 if(!recordV1(row,cols('id scope_kind scope_id project_id target_kind target_id target_version target_hash criteria_version criteria_snapshot_json items_json outcome reviewer_user_id client_id reviewer_subject_ref source_kind reason command_id created_at'))
  ||row.id!==selected.id||row.project_id!==projectId||row.scope_kind!=='PROJECT'||row.scope_id!==projectId||row.target_kind!=='DOCUMENT'
  ||!same(rowRef(row,'target_id','target_version','target_hash'),ref)||integer(row.criteria_version,1)!==1
  ||row.outcome!=='ACCEPTED'||row.source_kind!=='HUMAN_REVIEW'||!same(row.criteria_snapshot_json,criteria)
  ||!same(row.reviewer_subject_ref,{kind:'HUMAN',userId:row.reviewer_user_id,sameAsTargetRecorder:version.author_ref_json.userId===row.reviewer_user_id})
  ||typeof row.reason!=='string'||row.reason.length>20_000||!row.reason.trim()||!arrayV1(row.items_json,200))return bad();
 const criteriaIds=new Set(criteria.items.map(item=>item.criterionId));
 if(criteriaIds.size!==criteria.items.length||row.items_json.length!==criteriaIds.size)return bad();
 for(const item of row.items_json){
  if(!recordV1(item,['criterionId','outcome','evidenceRefs','reason'])||!criteriaIds.delete(item.criterionId)
   ||item.outcome!=='ACCEPTED'||!arrayV1(item.evidenceRefs,0)||typeof item.reason!=='string'||item.reason.length>20_000||!item.reason.trim())return bad();
 }
 return row;
}

/** 확정 원행과 당시 명시 선택만 검산한다. 현재 확정이나 복원 권위를 부여하지 않는다. */
export function checkDocumentConfirmationHistoryRows(projectId:string,ref:Ref,confirmationId:string,value:unknown){
 if(!recordV1(value,['version','link','artifact','origin','systemForm','confirmation'])
  ||!recordV1(value.confirmation,['row','origin','latestBefore','reviews']))return bad();
 const {confirmation,...systemRows}=value;
 const form=checkDocumentSystemFormHistoryRows(projectId,ref,systemRows);
 const {row,origin,latestBefore,reviews}=confirmation;
 const selected=checkConfirmationRow(projectId,ref,confirmationId,form.formRef,systemRows.version,row);
 const confirmationSequence=checkConfirmationOrigin(projectId,ref,row,origin).sequence;
 const draftSequence=integer(systemRows.origin.audit.server_sequence,1);
 if(!recordV1(latestBefore,['id','outcome','server_sequence'])||!uuidV1(latestBefore.id)||latestBefore.outcome!=='ACCEPTED'
  ||!arrayV1(reviews,200)||reviews.length!==selected.length)return bad();
 const latestSequence=integer(latestBefore.server_sequence,1);
 if(latestSequence>=confirmationSequence)return bad();
 const criteria=documentReviewCriteria(form.formRef,systemRows.systemForm.definition.definition_json);
 const sequences=new Set<number>();
 const chosen=selected.map((selection,index)=>{
  if(!recordV1(reviews[index],['row','origin']))return bad();
  const {row:review,origin:proof}=reviews[index];
  const verified=checkSelectedReview(projectId,ref,selection,review,systemRows.version,criteria);
  const {sequence}=checkProjectHistoryOrigin(projectId,ref,proof,{operation:'recordContentReview',reasonCode:'EXPLICIT_DOCUMENT_CONTENT_REVIEW',
   commandId:verified.command_id,actorId:verified.reviewer_user_id,clientId:verified.client_id,createdAt:verified.created_at,
   payload:{targetKind:'DOCUMENT',targetRef:ref,criteriaVersion:1,items:verified.items_json,outcome:verified.outcome,reason:verified.reason},
   resultData:{status:'REVIEW_RECORDED',reviewRef:selection}});
  if(sequence<=draftSequence||sequence>latestSequence||sequences.has(sequence))return bad();
  sequences.add(sequence);
  return {id:selection.id,sequence,projectionHash:hash({row:review,origin:proof})};
 });
 const latest=chosen.find(review=>review.id===latestBefore.id);
 // 보정 감사가 조회순서를 바꾸더라도 검토의 원 감사로 승격하지 않는다.
 if(!latest||latest.sequence!==latestSequence)return bad();
 safeMetadata(confirmation);
 return {...form,confirmationId,confirmationProjectionHash:hash({row,origin}),
  selectedReviewProjections:chosen.map(({id,projectionHash})=>({id,projectionHash}))};
}

/** 내부 metadata 조회 구현이며 공개 route/job/백업 형식에는 연결하지 않는다. */
export async function collectDocumentInventory(access:AccessRepository,token:string,value:unknown,signal:AbortSignal):Promise<Row>{
 const request=readDocumentInventoryInput(value),started=performance.now();let deadline=started+request.limits.deadlineMs,authDeadline=Infinity;
 const check=()=>{if(signal.aborted)bad('DOCUMENT_INVENTORY_CANCELLED',409);if(performance.now()-started>=request.limits.deadlineMs||performance.now()>=authDeadline)bad('DOCUMENT_INVENTORY_DEADLINE',413);};
 let identity:AuthenticatedIdentity|undefined,metadataUsed=0;
 async function timeout(db:PoolClient){check();const remaining=Math.min(deadline,authDeadline)-performance.now();if(remaining<=0)bad('DOCUMENT_INVENTORY_DEADLINE',413);await db.query("SELECT set_config('statement_timeout',$1,true)",[String(Math.max(1,Math.min(2147483647,Math.floor(remaining))))]);check();}
 const includedForms:Ref[]=[],includedMethods:Ref[]=[];
 const identityKey=(a:AuthenticatedIdentity)=>{if(!uuidV1(a.actorId)||!uuidV1(a.clientId)||!a.authSession||!uuidV1(a.authSession.id)||!Number.isSafeInteger(a.credentialGeneration)||a.credentialGeneration<1)bad('AUTH_REQUIRED',401);return[a.actorId,a.clientId,a.authSession!.id,a.credentialGeneration];};
 async function owner(db:PoolClient,a:AuthenticatedIdentity){const p=await projectMember(db,a,request.projectId,false);if(p.archived_at||p.participation!=='OWNER')bad('NOT_FOUND',404);}
 async function boundary(final:boolean){check();await access.authenticated(token,null,async(db,a)=>{
  if(identity&&!same(identityKey(a),identityKey(identity)))bad('AUTH_REQUIRED',401);else identityKey(a);
  const setting=(await db.query("SELECT current_setting('transaction_isolation') AS isolation")).rows[0];if(setting?.isolation!=='read committed')bad();
  await owner(db,a);const before=performance.now(),at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;
  authDeadline=Math.min(authDeadline,notificationSessionDeadline(a,at,before));check();
  if(!identity)identity=Object.freeze({...a,authSession:Object.freeze({...a.authSession!})});
  if(final){for(const [table,wanted]of [['form_definitions',includedForms],['methodology_definitions',includedMethods]]as const){const current=await selected(db,table,[...wanted],false);if(current.length!==wanted.length)bad('DOCUMENT_INVENTORY_SOURCE_CHANGED',503);const refs=new Set(current.map(r=>rk(rowRef(r))));if(wanted.some(r=>!refs.has(rk(r))))bad('DOCUMENT_INVENTORY_SOURCE_CHANGED',503);}}
  check();
 });check();}
 async function rows(db:PoolClient,table:string,selection?:Ref[]|string[],charge=true):Promise<Row[]>{
  const spec=specs[table];if(!spec)return bad();const out:Row[]=[];let last:unknown[]|null=null;
  for(;;){check();const values:unknown[]=[],bind=(v:unknown)=>{values.push(v);return`$${values.length}`;},conditions:string[]=[];
   if(spec.scope==='PROJECT')conditions.push(`t.project_id=${bind(request.projectId)}::uuid`);
   if(spec.scope==='FORM')conditions.push(`(d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=${bind(identity!.actorId)}::uuid)`);
   if(spec.scope==='METHOD')conditions.push(`(d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=${bind(identity!.actorId)}::uuid OR d.scope='PROJECT' AND d.project_id=${bind(request.projectId)}::uuid)`);
   if(table==='content_reviews')conditions.push(`t.scope_kind='PROJECT' AND t.scope_id=${bind(request.projectId)}::uuid AND t.target_kind='DOCUMENT'`);
   if(selection){if(!selection.length)return[];if(typeof selection[0]==='string')conditions.push(`${spec.id}=ANY(${bind(selection)}::uuid[])`);else conditions.push('('+selection.map(v=>{const r=v as Ref;return`(${spec.id}=${bind(r.id)}::uuid AND ${spec.version}=${bind(r.version)}::bigint AND ${spec.hash}=${bind(r.contentHash)}::text)`;}).join(' OR ')+')');}
   const keyExpr=spec.keys.map(k=>spec.columns.find(c=>c.endsWith('.'+k))!);
   if(last)conditions.push(`(${keyExpr.join(',')})>(${last.map((v,i)=>bind(v)+(spec.keys[i]==='version'?'::bigint':spec.keys[i]==='kind'?'::text':'::uuid')).join(',')})`);
   const remaining=request.limits.metadataBytes-(charge?metadataUsed:0);if(remaining<=0)bad('DOCUMENT_INVENTORY_LIMIT',413);const cap=bind(remaining);
   const sql=`WITH inventory_row AS (SELECT ${spec.columns.join(',')} FROM ${spec.from} WHERE ${conditions.length?conditions.join(' AND '):'FALSE'} ORDER BY ${keyExpr.join(',')} LIMIT 200)
    SELECT CASE WHEN octet_length(to_jsonb(inventory_row)::text)<=${cap}::bigint THEN to_jsonb(inventory_row) ELSE NULL END AS inventory_data,
     octet_length(to_jsonb(inventory_row)::text) AS row_bytes FROM inventory_row ORDER BY ${spec.keys.map(k=>'inventory_row.'+k).join(',')}`;
   if(charge)await timeout(db);const result=await db.query(sql,values);check();if(!Array.isArray(result.rows)||result.rows.length>200)bad();
   for(const envelope of result.rows){check();const size=integer(envelope.row_bytes);if(size>remaining||charge&&metadataUsed>request.limits.metadataBytes-size)bad('DOCUMENT_INVENTORY_LIMIT',413);
    const r=envelope.inventory_data;if(!r||typeof r!=='object'||Array.isArray(r))bad();const expected=spec.columns.map(c=>c.slice(c.indexOf('.')+1));if(!recordV1(r,expected))bad();
    if(spec.scope==='PROJECT'&&r.project_id!==request.projectId)bad();const t=tuple(r,spec.keys);if(t.some((v,i)=>spec.keys[i]==='version'?!Number.isSafeInteger(v):spec.keys[i]==='kind'?!['BODY','ATTACHMENT','SOURCE'].includes(String(v)):!uuidV1(v))||last&&compare(t,last)<=0)bad();last=t;
    if(spec.scope==='FORM'&&!(r.scope==='SYSTEM'&&r.owner_user_id===null&&r.project_id===null||r.scope==='USER_COMMON'&&r.owner_user_id===identity!.actorId&&r.project_id===null))bad();
    if(spec.scope==='METHOD'&&!(r.scope==='SYSTEM'&&r.owner_user_id===null&&r.project_id===null||r.scope==='USER_COMMON'&&r.owner_user_id===identity!.actorId&&r.project_id===null||r.scope==='PROJECT'&&r.owner_user_id===null&&r.project_id===request.projectId))bad();
    if(selection&&!(typeof selection[0]==='string'?(selection as string[]).includes(r.id):(selection as Ref[]).some(w=>w.id===r.id&&w.version===integer(r.version,1)&&w.contentHash===r.content_hash)))bad();
    if(charge)metadataUsed+=size;out.push(cloneV1(r));
   }
   if(result.rows.length<200)return out;
  }
 }
 async function selected(db:PoolClient,table:string,selection:Ref[]|string[],charge=true){const result:Row[]=[];for(let i=0;i<selection.length;i+=200)result.push(...await rows(db,table,selection.slice(i,i+200)as Ref[]|string[],charge));return result;}
 const tables:Record<string,Row[]>={};let observation:Row;
 try{
  check();await boundary(false);check();let db:PoolClient|undefined,beginStarted=false,begun=false,releaseError:Error|undefined;
  try{
   db=await access.pool.connect();check();beginStarted=true;await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;check();
   await timeout(db);
   const state=(await db.query("SELECT current_setting('transaction_isolation') AS isolation,current_setting('transaction_read_only') AS read_only,pg_current_snapshot()::text AS snapshot,clock_timestamp() AS at")).rows[0];
   if(state?.isolation!=='repeatable read'||state.read_only!=='on'||typeof state.snapshot!=='string'||!/^\d+:\d+:[\d,]*$/.test(state.snapshot))bad();check();await timeout(db);await owner(db,identity!);
   observation={snapshot:state.snapshot,startedAt:stamp(state.at),finishedAt:stamp(state.at),isolation:'repeatable read',readOnly:true,authBoundary:'START_AND_END_READ_COMMITTED'};
   for(const table of ['documents','document_versions','document_artifact_links','document_imports','document_import_selections','document_proposals','document_proposal_selections','content_reviews','document_version_events','document_confirmations','document_source_links','document_source_link_events'])tables[table]=await rows(db,table);
   const appIds=new Set<string>();for(const v of tables.document_versions!){const stage=readStageNodeRef(v.stage_ref_json);if(stage)appIds.add(stage.applicationId);}
   tables.project_methodologies=await selected(db,'project_methodologies',[...appIds].sort());
   const formRefs=new Map<string,Ref>(),addForm=(v:unknown)=>{const r=exactRef(v);formRefs.set(rk(r),r);};
   for(const v of tables.document_versions!)addForm({id:v.form_definition_id,version:integer(v.form_version,1),contentHash:v.form_hash});
   for(const v of tables.document_imports!)if(v.form_definition_id!==null)addForm({id:v.form_definition_id,version:integer(v.form_version,1),contentHash:v.form_hash});
   for(const r of tables.content_reviews!)addForm(r.criteria_snapshot_json?.formRef);
   for(const r of tables.document_confirmations!)addForm(r.form_ref);
   const methodRefs=new Map<string,Ref>();for(const a of tables.project_methodologies!){const checked=readApplicationSnapshot(request.projectId,[a]);const snapshot=checked.snapshot as Row|null;if(!snapshot)return bad();const source=exactRef(snapshot.sourceRef);methodRefs.set(rk(source),source);for(const node of snapshot.graph.nodes)for(const item of [...node.inputs,...node.outputs])addForm(item.formRef);}
   tables.form_definitions=await selected(db,'form_definitions',[...formRefs.values()].sort((a,b)=>rk(a).localeCompare(rk(b))));
   const standardRefs=new Map<string,Ref>();for(const f of tables.form_definitions!){const r=exactRef({id:f.authoring_standard_id,version:integer(f.authoring_standard_version,1),contentHash:f.authoring_standard_hash});standardRefs.set(rk(r),r);}
   tables.authoring_standard_versions=await selected(db,'authoring_standard_versions',[...standardRefs.values()].sort((a,b)=>rk(a).localeCompare(rk(b))));
   tables.methodology_definitions=await selected(db,'methodology_definitions',[...methodRefs.values()].sort((a,b)=>rk(a).localeCompare(rk(b))));
   includedForms.push(...tables.form_definitions!.map(r=>rowRef(r)));includedMethods.push(...tables.methodology_definitions!.map(r=>rowRef(r)));
   const declared=new Map<string,Row>(),addArtifact=(v:unknown)=>{if(!isImportArtifact(v))bad();const r=v as unknown as Row,old=declared.get(r.artifactId);if(old&&!same(old,r))bad();declared.set(r.artifactId,cloneV1(r));};
   for(const v of tables.document_versions!){addArtifact(v.content_json?.body);if(!Array.isArray(v.content_json?.attachments))bad();v.content_json.attachments.forEach(addArtifact);}
   for(const r of tables.document_imports!){addArtifact(r.candidate_json?.originalRef);if(r.candidate_json?.extractedContentRef!==null)addArtifact(r.candidate_json?.extractedContentRef);}
   for(const r of tables.document_proposals!){addArtifact(r.proposal_json?.proposedContentRef);addArtifact(r.proposal_json?.diffRef);if(!Array.isArray(r.content_json?.attachments))bad();r.content_json.attachments.forEach(addArtifact);}
   const artifactIds=new Set([...declared.keys(),...tables.document_artifact_links!.map(r=>r.artifact_id)]);if([...artifactIds].some(v=>!uuidV1(v)))bad();
   tables.artifacts=await selected(db,'artifacts',[...artifactIds].sort());
   const result=assemble(tables,request,observation,formRefs,methodRefs,declared,check);
   check();await db.query('ROLLBACK');begun=false;beginStarted=false;db.release();db=undefined;
   await boundary(true);check();result.observation.finishedAt=new Date().toISOString();finishSize(result,request);check();return result;
  }catch(error){if(db&&beginStarted&&!begun)releaseError=new Error('DOCUMENT_INVENTORY_BEGIN_UNKNOWN');if(db&&begun){try{await db.query('ROLLBACK');begun=false;}catch{releaseError=new Error('DOCUMENT_INVENTORY_CLEANUP_UNKNOWN');}}if(releaseError)bad('DOCUMENT_INVENTORY_STORAGE_FAILED',503);throw error;}
  finally{if(db)db.release(releaseError);}
 }catch(error){if(error instanceof AuthFailure){if(ownFailures.has(error)||error.message==='AUTH_REQUIRED'&&error.statusCode===401||error.message==='NOT_FOUND'&&error.statusCode===404)throw new AuthFailure(error.message,error.statusCode);throw new AuthFailure('DOCUMENT_INVENTORY_INTEGRITY_FAILED',503);}throw new AuthFailure('DOCUMENT_INVENTORY_STORAGE_FAILED',503);}
}

function finishSize(result:Row,request:DocumentInventoryRequest){
 result.usage.metadataBytes=0;for(let i=0;i<17;i++){const size=Buffer.byteLength(canonicalJson(result));if(size>request.limits.metadataBytes)bad('DOCUMENT_INVENTORY_LIMIT',413);if(size===result.usage.metadataBytes)return;result.usage.metadataBytes=size;}bad();
}
function assemble(t:Record<string,Row[]>,request:DocumentInventoryRequest,observation:Row,requiredForms:Map<string,Ref>,requiredMethods:Map<string,Ref>,declared:Map<string,Row>,check:()=>void):Row{
 const get=(name:string)=>t[name]!,versions=new Map<string,Row>(),docs=new Map<string,Row>(),artifacts=new Map<string,Row>(),issues:Row[]=[],external:Row[]=[];
 const depend=(kind:string,value:unknown,reasonCode='OUTSIDE_DOCUMENT_HISTORY')=>{const r=exactRef(value);if(!external.some(e=>e.kind===kind&&same(e.ref,r)&&e.reasonCode===reasonCode))external.push({kind,ref:r,reasonCode});};
 const refs=(values:unknown,kind:string)=>{if(!Array.isArray(values))return bad();for(const v of values){if(refV1(v))depend(kind,v);else if(recordV1(v,['kind','ref'])&&typeof v.kind==='string')depend(v.kind,v.ref);else bad();}};
 const vref=(v:Row)=>rowRef(v,'document_id');
 const find=(id:unknown,version:unknown,digest?:unknown)=>{if(!uuidV1(id))return bad();const v=versions.get(vk(id,integer(version,1)));if(!v||digest!==undefined&&v.content_hash!==digest)return bad();return v;};
 for(const d of get('documents')){if(!uuidV1(d.id)||docs.has(d.id)||typeof d.title!=='string')bad();integer(d.head_version,1);if(d.confirmed_version!==null)integer(d.confirmed_version,1);docs.set(d.id,d);}
 for(const v of get('document_versions')){check();const key=vk(v.document_id,integer(v.version,1)),formRef=exactRef({id:v.form_definition_id,version:integer(v.form_version,1),contentHash:v.form_hash});
  if(!docs.has(v.document_id)||versions.has(key)||typeof v.title!=='string'||!recordV1(v.content_json,['body','attachments','sections','sourceRefs'])||hash({title:v.title,formRef,stageNodeRef:v.stage_ref_json,content:v.content_json})!==v.content_hash||v.body_artifact_id!==v.content_json.body.artifactId||!same(v.sections_json,v.content_json.sections)||!same(v.source_refs_json,v.content_json.sourceRefs))bad();
  refs(v.source_refs_json,'DOCUMENT_SOURCE');versions.set(key,v);
 }
 for(const d of docs.values()){find(d.id,d.head_version);if(d.confirmed_version!==null)find(d.id,d.confirmed_version);}
 let inputBytes=0;for(const a of get('artifacts')){check();const bytes=integer(a.bytes);if(bytes>20971520||!uuidV1(a.id)||!hashV1(a.content_hash)||typeof a.media_type!=='string'||!a.media_type.length||a.media_type.length>200||artifacts.has(a.id)||!['READY','QUARANTINED','STAGING','FAILED'].includes(a.state))bad();
  const r={artifactId:a.id,bytes,contentHash:a.content_hash,mediaType:a.media_type};if(declared.has(a.id)&&!same(declared.get(a.id),r))bad();
  if(inputBytes>Number.MAX_SAFE_INTEGER-bytes||inputBytes>request.limits.inputBytes-bytes||artifacts.size>=request.limits.fileCount)bad('DOCUMENT_INVENTORY_LIMIT',413);inputBytes+=bytes;
  const inspection=a.inspection_json;let inspectionStatus='UNKNOWN';if(recordV1(inspection,['policyVersion','method','complete','state','reasonCodes'])&&inspection.policyVersion===1&&inspection.method==='KNOWN_PATTERNS_RAW_BYTES'&&inspection.complete===false&&Array.isArray(inspection.reasonCodes)&&['NO_KNOWN_MARKER','SUSPECTED'].includes(inspection.state))inspectionStatus=inspection.state;
  artifacts.set(a.id,{...r,state:a.state,inspectionStatus,blobVerification:'NOT_PERFORMED'});if(a.state!=='READY'||inspectionStatus!=='NO_KNOWN_MARKER')issues.push({code:a.state!=='READY'?'ARTIFACT_NOT_READY':'ARTIFACT_INSPECTION_UNKNOWN',kind:'ARTIFACT',ref:r});
 }
 for(const key of declared.keys())if(!artifacts.has(key))bad();
 const artifactLinks:Row[]=[],linkSet=new Set<string>();for(const l of get('document_artifact_links')){const d=find(l.document_id,l.version),a=artifacts.get(l.artifact_id);if(!a||!['BODY','ATTACHMENT','SOURCE'].includes(l.kind))return bad();const key=[l.document_id,l.version,l.artifact_id,l.kind].join(':');if(linkSet.has(key))bad();linkSet.add(key);const artifactRef={artifactId:a.artifactId,bytes:a.bytes,contentHash:a.contentHash,mediaType:a.mediaType};if(l.kind==='BODY'&&!same(artifactRef,d.content_json.body)||l.kind==='ATTACHMENT'&&!d.content_json.attachments.some((x:unknown)=>same(x,artifactRef)))bad();artifactLinks.push({documentRef:vref(d),artifactRef,kind:l.kind});}
 for(const v of versions.values()){if(!linkSet.has([v.document_id,v.version,v.body_artifact_id,'BODY'].join(':')))bad();for(const a of v.content_json.attachments)if(!linkSet.has([v.document_id,v.version,a.artifactId,'ATTACHMENT'].join(':')))bad();}
 const imports=new Map<string,Row>();for(const r of get('document_imports')){const c=r.candidate_json;if(!c||hash(c)!==r.content_hash||c.id!==r.id||c.originalRef?.artifactId!==r.original_artifact_id||imports.has(r.id)||!['READY','FAILED','UNSUPPORTED'].includes(c.status))bad();const fr=r.form_definition_id===null?null:{id:r.form_definition_id,version:integer(r.form_version,1),contentHash:r.form_hash};if(!same(c.intendedFormRef,fr))bad();imports.set(r.id,r);}
 for(const s of get('document_import_selections')){const r=imports.get(s.import_id),v=find(s.document_id,s.version);if(!r||r.candidate_json.status!=='READY'||!r.candidate_json.extractedContentRef||!same(r.candidate_json.originalRef,v.content_json.body)&&!v.content_json.attachments.some((a:unknown)=>same(a,r.candidate_json.originalRef)))bad();}
 const proposals=new Map<string,Row>();for(const r of get('document_proposals')){const p=r.proposal_json;if(!p||hash({proposal:p,content:r.content_json,reason:r.reason})!==r.content_hash||p.id!==r.id||p.baseRef?.id!==r.document_id||p.baseRef?.version!==integer(r.base_version,1)||p.baseRef?.contentHash!==r.base_hash||p.proposedContentRef?.artifactId!==r.body_artifact_id||p.diffRef?.artifactId!==r.diff_artifact_id||!same(p.proposedContentRef,r.content_json.body)||proposals.has(r.id))bad();find(r.document_id,r.base_version,r.base_hash);proposals.set(r.id,r);}
 for(const s of get('document_proposal_selections')){const p=proposals.get(s.proposal_id),v=find(s.document_id,s.version);if(!p||p.document_id!==s.document_id||!same(p.content_json,v.content_json))bad();}
 const reviewOutcomes=['ACCEPTED','REWORK','BLOCKED','NOT_EXECUTED'];
 const reason=(value:unknown)=>typeof value==='string'&&!!value.trim()&&value.length<=20000;
 const reviews=new Map<string,Row>();for(const r of get('content_reviews')){const v=find(r.target_id,r.target_version,r.target_hash),fr={id:v.form_definition_id,version:integer(v.form_version,1),contentHash:v.form_hash};if(r.scope_kind!=='PROJECT'||r.scope_id!==request.projectId||r.target_kind!=='DOCUMENT'||!same(r.criteria_snapshot_json?.formRef,fr)||integer(r.criteria_version,1)!==r.criteria_snapshot_json?.criteriaVersion||!Array.isArray(r.items_json)||!Array.isArray(r.criteria_snapshot_json?.items)||reviews.has(r.id))bad();if(r.items_json.length>200||!reviewOutcomes.includes(r.outcome)||!reason(r.reason)||r.items_json.some((i:unknown)=>!recordV1(i,['criterionId','outcome','evidenceRefs','reason'])||typeof i.criterionId!=='string'||!reviewOutcomes.includes(String(i.outcome))||!reason(i.reason)||!Array.isArray(i.evidenceRefs))||r.outcome==='ACCEPTED'&&r.items_json.some((i:Row)=>i.outcome!=='ACCEPTED'))bad();const expected=new Set(r.criteria_snapshot_json.items.map((i:Row)=>i.criterionId));if(expected.size!==r.items_json.length||new Set(r.items_json.map((i:Row)=>i.criterionId)).size!==expected.size||r.items_json.some((i:Row)=>!expected.has(i.criterionId)))bad();for(const item of r.items_json)refs(item.evidenceRefs,'REVIEW_EVIDENCE');reviews.set(r.id,r);}
 for(const r of get('document_confirmations')){const v=find(r.document_id,r.version,r.target_hash);if(!same(r.form_ref,{id:v.form_definition_id,version:integer(v.form_version,1),contentHash:v.form_hash})||!Array.isArray(r.review_refs)||!r.review_refs.length)bad();for(const q of r.review_refs){const review=reviews.get(q.id);if(!review||!same({id:review.target_id,version:integer(review.target_version,1),contentHash:review.target_hash},q.targetRef)||!same(q.targetRef,vref(v))||q.criteriaVersion!==integer(review.criteria_version,1)||q.outcome!==review.outcome)bad();}}
 for(const e of get('document_version_events')){find(e.document_id,e.version);if(e.review_ref!==null){const r=reviews.get(e.review_ref.id);if(!r||r.target_id!==e.document_id||integer(r.target_version,1)!==integer(e.version,1))bad();}}
 const sourceLinks:Row[]=[];for(const h of get('document_source_links')){const v=find(h.document_id,h.version),events=get('document_source_link_events').filter(e=>e.link_id===h.id).sort((a,b)=>integer(a.link_version,1)-integer(b.link_version,1));const checked=readDocumentSourceLinkHistory({projectId:request.projectId,documentRef:vref(v)},events.map(e=>({ref:{id:h.id,version:integer(e.link_version,1),contentHash:e.content_hash},snapshot:e.snapshot_json})));const last=events.at(-1),current=checked.at(-1);if(!last||!current||last.id!==h.current_event_id||current.ref.version!==integer(h.link_version,1)||current.snapshot.state!==h.state||current.snapshot.sourceRootId!==h.source_root_id||current.snapshot.relativePath!==h.relative_path||!same(current.snapshot.sourceSnapshotRef,h.source_snapshot_ref)||current.snapshot.blobHash!==h.blob_hash)bad();
  const projected=checked.map(e=>{const s=e.snapshot,projection={projectId:s.projectId,documentRef:s.documentRef,sourceRootId:s.sourceRootId,sourceSnapshotRef:s.sourceSnapshotRef,blobHash:s.blobHash,kind:s.kind,state:s.state,previousRef:s.previousRef,recordedAt:s.recordedAt};depend('SOURCE_SNAPSHOT',s.sourceSnapshotRef);return{sourceRef:e.ref,projection,projectionHash:hash(projection)};});sourceLinks.push({id:h.id,documentRef:vref(v),headVersion:integer(h.link_version,1),state:h.state,events:projected});}
 if(get('document_source_link_events').some(e=>!get('document_source_links').some(h=>h.id===e.link_id)))bad();
 function originMetadata(row:Row,kind:'FORM'|'METHODOLOGY'):Row{
  const source=row.origin_ref_json;let projection:Row|null=null;
  if(source!==null){
   if(!source||typeof source!=='object'||Array.isArray(source)||typeof source.kind!=='string')return bad();
   const form=kind==='FORM',extra=form?['reason']:[];
   if(source.kind==='COPY'||source.kind==='REVISION'){
    if(!recordV1(source,['kind','parentRef',...extra])||form&&!reason(source.reason))return bad();
    const parentRef=exactRef(source.parentRef);depend(kind,parentRef);projection={kind:source.kind,parentRef,...(form?{reason:source.reason}:{})};
   }else if(source.kind==='USER_AUTHORED'){
    if(!recordV1(source,['kind',...extra])||form&&!reason(source.reason))return bad();projection=cloneV1(source);
   }else if(source.kind==='DRAFT_CONFIRMED_SOURCE'&&!form){
    if(!recordV1(source,['kind','draftRef','confirmationId','sourceRefs'])||!uuidV1(source.confirmationId)||!Array.isArray(source.sourceRefs)||source.sourceRefs.length>200)return bad();
    const draftRef=exactRef(source.draftRef),sourceRefs=source.sourceRefs.map(exactRef);depend('DRAFT',draftRef);for(const ref of sourceRefs)depend('METHODOLOGY',ref);
    projection={kind:source.kind,draftRef,confirmationId:source.confirmationId,sourceRefs};
   }else if(source.kind==='P01_APPROVED_SOURCE'){
    const keys=form?['kind','sourcePath','sourceHash','productAcceptance']:['kind','approvalRecord','sourceHash','implementationRevision','productAcceptance'];
    if(!recordV1(source,keys)||!hashV1(source.sourceHash)||source.productAcceptance!==false||!reason(form?source.sourcePath:source.approvalRecord))return bad();
    projection={kind:source.kind,sourceHash:source.sourceHash,productAcceptance:false,...(form?{}:{implementationRevision:integer(source.implementationRevision,1)})};
   }else return bad();
  }
  const {origin_ref_json:omitted,...remaining}=row;void omitted;
  return{...metadata(remaining),originProjection:projection,originProjectionHash:hash(projection)};
 }
 const formMap=new Map<string,Row>();for(const f of get('form_definitions')){const r=rowRef(f),standard={id:f.authoring_standard_id,version:integer(f.authoring_standard_version,1),contentHash:f.authoring_standard_hash};if(hash(f.definition_json)!==r.contentHash||!same(f.definition_json?.authoringStandardRef,standard)||!same(f.authoring_standard_ref,standard)||formMap.has(rk(r)))bad();formMap.set(rk(r),f);}
 for(const r of requiredForms.values())if(!formMap.has(rk(r)))depend('FORM',r,'SOURCE_ACCESS_UNAVAILABLE');
 const standardMap=new Map(get('authoring_standard_versions').map(s=>[rk(rowRef(s)),s]));for(const f of formMap.values())if(!standardMap.has(rk(exactRef(f.authoring_standard_ref))))bad();
 const appMap=new Map<string,any>();for(const a of get('project_methodologies')){const checked=readApplicationSnapshot(request.projectId,[a]);const snapshot=checked.snapshot as Row|null;if(!snapshot)return bad();appMap.set(a.id,checked);const d=snapshot.draftConfirmationRef;if(d)depend('DRAFT',d.draftRef);}
 for(const v of versions.values()){const stage=readStageNodeRef(v.stage_ref_json);if(stage){const a=appMap.get(stage.applicationId),node=a?.snapshot.graph.nodes.find((n:Row)=>n.nodeId===stage.nodeId);if(!node||!nodeUsesForm(node,{id:v.form_definition_id,version:integer(v.form_version,1),contentHash:v.form_hash}).length)bad();}}
 const methods=new Map<string,Row>();for(const m of get('methodology_definitions')){const r=rowRef(m);if(hash(m.graph_json)!==r.contentHash||methods.has(rk(r)))bad();methods.set(rk(r),m);}
 for(const r of requiredMethods.values())if(!methods.has(rk(r)))depend('METHODOLOGY',r,'SOURCE_ACCESS_UNAVAILABLE');
 const result:Row={kind:'DOCUMENT_INVENTORY_V1',scope:'DOCUMENT_HISTORY_ONLY',projectId:request.projectId,observation,
 documents:get('documents').map(metadata),versions:get('document_versions').map(v=>({sourceRef:vref(v),...metadata(v)})),artifactRefs:[...artifacts.values()],artifactLinks,
 imports:get('document_imports').map(metadata),importSelections:get('document_import_selections').map(metadata),proposals:get('document_proposals').map(metadata),proposalSelections:get('document_proposal_selections').map(metadata),reviews:get('content_reviews').map(metadata),confirmations:get('document_confirmations').map(metadata),events:get('document_version_events').map(metadata),sourceLinks,
 forms:get('form_definitions').map(row=>originMetadata(row,'FORM')),standards:get('authoring_standard_versions').map(s=>({ref:rowRef(s),createdAt:stamp(s.created_at),bodyVerification:'NOT_PERFORMED'})),applications:get('project_methodologies').map(metadata),methodologies:get('methodology_definitions').map(row=>originMetadata(row,'METHODOLOGY')),externalDependencies:external.sort((a,b)=>canonicalJson(a).localeCompare(canonicalJson(b))),issues,limits:request.limits,usage:{metadataBytes:0,inputBytes,fileCount:artifacts.size},metadataComplete:issues.length===0&&external.length===0,blobVerification:'NOT_PERFORMED',fullProjectCoverage:false,restorable:false};
 check();safeMetadata(result);finishSize(result,request);return result;
}
