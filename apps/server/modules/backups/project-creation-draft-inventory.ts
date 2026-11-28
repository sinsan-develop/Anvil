import {types} from 'node:util';
import type {PoolClient} from 'pg';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,uuidV1,refV1,isoV1,cloneV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readDraftArtifactRefs,validDraftUploadCommand} from '../../../../contracts/draft-artifacts.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {readDocumentInventoryInput} from './document-inventory-input.ts';
type Row=Record<string,any>;
const columns={project_drafts:'id owner_user_id client_id version step input_json consumed_project_id created_at updated_at'.split(' '),draft_artifact_selection_versions:'draft_id draft_version refs_json snapshot_hash command_id receipt_id'.split(' '),draft_artifact_selections:'draft_id draft_version artifact_id upload_intent_id ordinal ref_json'.split(' '),draft_artifact_adoptions:'artifact_id upload_intent_id original_command_id draft_id draft_version ref_json source_key target_key project_id creation_intent_id create_command_id actor_id client_id adopted_at'.split(' '),draft_creation_intents:'id draft_id actor_id client_id external_command_id expected_version request_hash request_json target_project_id refs_json sources_json selection_hash state attempt project_command_id result_json created_at'.split(' '),draft_upload_intents:'id draft_id actor_id client_id external_command_id expected_version request_hash request_json artifact_id server_command_id receipt_id operation_id ref_json staging_key final_key state attempt result_json created_at'.split(' '),artifacts:'id project_id draft_id bytes content_hash media_type storage_key state created_by client_id command_id created_at inspection_json'.split(' '),commands:'id scope_kind scope_id project_id draft_id actor_id client_id operation command_id request_hash operation_id state authorization_receipt_id approval_consumption_id expected_version control_generation policy_ref payload_ref result_ref received_at completed_at'.split(' '),authorization_receipts:'id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at'.split(' '),draft_audit_events:'draft_id server_sequence event_id actor_ref client_ref command_id operation_id operation outcome reason_code recorded_at'.split(' '),audit_events:'project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of'.split(' ')};
type Table=keyof typeof columns;
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),redacted={kind:'HUMAN',identity:'REDACTED'};
const own=new WeakSet<AuthFailure>();
function bad(code='PROJECT_CREATION_DRAFT_INVENTORY_INTEGRITY_FAILED',status=503):never{const e=new AuthFailure(code,status);own.add(e);throw e;}
function object(v:unknown,keys:string[]):Row{if(!recordV1(v,keys))return bad();return v as Row;}
function number(v:unknown,min=0):number{if(typeof v==='string'&&!/^(0|[1-9][0-9]*)$/.test(v))return bad();const n=typeof v==='number'||typeof v==='string'?Number(v):NaN;if(!Number.isSafeInteger(n)||n<min)return bad();return n;}
const digest=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function stamp(v:unknown):string{
 if(v instanceof Date){if(!Number.isFinite(v.getTime())||v.getUTCFullYear()<1||v.getUTCFullYear()>9999)return bad();return v.toISOString();}
 if(typeof v!=='string')return bad();const m=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d{1,6}))?(Z|[+-]\d\d:\d\d)$/.exec(v);if(!m)return bad();
 const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]),hour=Number(m[4]),minute=Number(m[5]),second=Number(m[6]),fraction=(m[7]??'').padEnd(3,'0').replace(/0+$/,'').padEnd(3,'0'),tz=m[8]!;
 if(year<1||year>9999||month<1||month>12||day<1||day>31||hour>23||minute>59||second>59)return bad();
 const local=new Date(0);local.setUTCFullYear(year,month-1,day);local.setUTCHours(hour,minute,second,Number(fraction.slice(0,3)));if(local.getUTCFullYear()!==year||local.getUTCMonth()!==month-1||local.getUTCDate()!==day)return bad();
 const offsetHour=tz==='Z'?0:Number(tz.slice(1,3)),offsetMinute=tz==='Z'?0:Number(tz.slice(4,6));if(offsetHour>15||offsetMinute>59)return bad();
 const offset=(offsetHour*60+offsetMinute)*(tz[0]==='-'?-1:1),utc=new Date(local.getTime()-offset*60000);if(!Number.isFinite(utc.getTime())||utc.getUTCFullYear()<1||utc.getUTCFullYear()>9999)return bad();return utc.toISOString().slice(0,19)+'.'+fraction+'Z';
}
function safe(v:unknown){if(inspectArtifact(Buffer.from(canonicalJson(v))).state==='SUSPECTED')bad('PROJECT_CREATION_DRAFT_INVENTORY_SENSITIVE_METADATA');}
export interface OwnedSystemCreationScope{
 sourceRef:RuntimeRefV1;creatorId:string;draftId:string;draftVersion:number;creationIntentId:string;
}
export function isOwnedSystemCreationScope(value:unknown):value is OwnedSystemCreationScope{
 return !types.isProxy(value)&&recordV1(value,['sourceRef','creatorId','draftId','draftVersion','creationIntentId'])
  &&!types.isProxy(value.sourceRef)&&refV1(value.sourceRef)&&uuidV1(value.creatorId)&&uuidV1(value.draftId)
  &&Number.isSafeInteger(value.draftVersion)&&value.draftVersion>0&&uuidV1(value.creationIntentId);
}
const ownedDraftFields=['t.id','t.owner_user_id','t.client_id','t.version','t.consumed_project_id',
 "t.input_json->'methodologySelection' AS selected_methodology"];
const draftSelectionFields=['t.draft_id','t.draft_version','t.command_id','t.receipt_id'];
const resultFields=(column:string)=>[`${column}->'id' AS result_project_id`,`${column}->'version' AS result_project_version`,
 `${column}->'currentMethodologyRef' AS result_application_ref`,`${column}->'createdAt' AS result_project_created_at`];
const intentFields=['t.id','t.draft_id','t.actor_id','t.client_id','t.external_command_id','t.expected_version','t.request_hash','t.request_json',
 't.target_project_id','t.state','t.attempt','t.project_command_id',...resultFields('t.result_json')];
const commandFields=columns.commands.filter(field=>field!=='result_ref').map(field=>'t.'+field);
const creationCommandFields=[...commandFields,...resultFields('t.result_ref')];
const draftCommandFields=[...commandFields,"t.result_ref->'draftId' AS result_draft_id","t.result_ref->'version' AS result_draft_version",
 "t.result_ref->'input'->'methodologySelection' AS selected_methodology"];
const fieldNames=(fields:readonly string[])=>fields.map(f=>f.includes(' AS ')?f.split(' AS ')[1]!:f.slice(f.indexOf('.')+1));

export interface OwnedSystemCreationRows{
 draft:Row;selection:Row;draftCommand:Row;draftReceipt:Row;intent:Row;projectCommand:Row;projectReceipt:Row;projectAudit:Row;
}
function checkOwnedDraft(projectId:string,scope:OwnedSystemCreationScope,value:unknown){
 const draft=object(value,fieldNames(ownedDraftFields));
 if(draft.id!==scope.draftId||draft.owner_user_id!==scope.creatorId||draft.consumed_project_id!==projectId
  ||number(draft.version,1)!==scope.draftVersion||!uuidV1(draft.client_id)
  ||!same(draft.selected_methodology,{kind:'CONFIRMED_REFERENCE',versionRef:scope.sourceRef}))return bad();
 return draft;
}
function checkOwnedDraftSelection(scope:OwnedSystemCreationScope,value:unknown){
 const selection=object(value,fieldNames(draftSelectionFields));
 if(selection.draft_id!==scope.draftId||number(selection.draft_version,1)!==scope.draftVersion
  ||!uuidV1(selection.command_id)||!uuidV1(selection.receipt_id))return bad();
 return selection;
}
function checkCreationResult(projectId:string,applicationRef:RuntimeRefV1,applicationCreatedAt:unknown,row:Row){
 // #detail은 DB 시각을 Date.toISOString()으로 내보내므로 DTO에만 ms 정밀도를 적용한다.
 const createdAt=stamp(applicationCreatedAt).replace(/(\.\d{3})\d+Z$/,'$1Z');
 if(row.result_project_id!==projectId||row.result_project_version!==1||!same(row.result_application_ref,applicationRef)
  ||row.result_project_created_at!==createdAt)return bad();
}
function checkIntent(projectId:string,scope:OwnedSystemCreationScope,applicationRef:RuntimeRefV1,applicationCreatedAt:unknown,draft:Row,value:unknown){
 const intent=object(value,fieldNames(intentFields));
 if(intent.id!==scope.creationIntentId||intent.draft_id!==scope.draftId||intent.actor_id!==scope.creatorId
  ||intent.client_id!==draft.client_id||!uuidV1(intent.external_command_id)||!uuidV1(intent.project_command_id)
  ||number(intent.expected_version,1)!==scope.draftVersion||intent.target_project_id!==projectId||intent.state!=='COMMITTED'
  ||number(intent.attempt,1)<1)return bad();
 const request=object(intent.request_json,['schemaVersion','commandId','clientId','draftId','draftVersion']);
 if(!same(request,{schemaVersion:1,commandId:intent.external_command_id,clientId:draft.client_id,draftId:scope.draftId,draftVersion:scope.draftVersion})
  ||hash(request)!==intent.request_hash)return bad();
 checkCreationResult(projectId,applicationRef,applicationCreatedAt,intent);
 return intent;
}
function checkCreationCommand(command:Row,creatorId:string,clientId:string){
 if(command.actor_id!==creatorId||command.client_id!==clientId||command.state!=='APPLIED'||!uuidV1(command.id)||!uuidV1(command.command_id)
  ||!uuidV1(command.operation_id)||!uuidV1(command.authorization_receipt_id)||!digest(command.request_hash)
  ||command.policy_ref!==null||command.payload_ref!==null||command.approval_consumption_id!==null
  ||command.completed_at!==command.received_at)return bad();
 stamp(command.received_at);
}
function checkCreationReceipt(receipt:Row,command:Row,scopeDigest:string,subject:object){
 if(receipt.id!==command.authorization_receipt_id||receipt.command_id!==command.id||receipt.scope_kind!==command.scope_kind
  ||receipt.scope_id!==command.scope_id||!same(receipt.subject_ref,subject)||receipt.policy_ref!==null||receipt.approval_decision_ref!==null
  ||receipt.scope_digest!==scopeDigest||receipt.authorized_at!==command.received_at)return bad();
}

/** 동일 creator의 소비 초안 선택과 프로젝트 최초 적용 결과의 원 정착만 검산한다. */
export function checkOwnedSystemCreationRows(projectId:string,scope:OwnedSystemCreationScope,applicationRef:RuntimeRefV1,
 applicationCreatedAt:unknown,value:unknown){
 if(!uuidV1(projectId)||!isOwnedSystemCreationScope(scope)||!refV1(applicationRef)||applicationRef.version!==1)return bad();
 const rows=object(value,['draft','selection','draftCommand','draftReceipt','intent','projectCommand','projectReceipt','projectAudit']);
 const draft=checkOwnedDraft(projectId,scope,rows.draft),selection=checkOwnedDraftSelection(scope,rows.selection);
 const {creatorId,draftId}=scope,clientId=draft.client_id,human={kind:'HUMAN',userId:creatorId};
 const saved=object(rows.draftCommand,fieldNames(draftCommandFields));
 checkCreationCommand(saved,creatorId,clientId);
 if(saved.id!==selection.command_id||saved.authorization_receipt_id!==selection.receipt_id||saved.scope_kind!=='DRAFT'||saved.scope_id!==draftId
  ||saved.draft_id!==draftId||saved.project_id!==null||saved.control_generation!==null
  ||saved.operation!==(scope.draftVersion===1?'createProjectDraft':'saveProjectDraft')||number(saved.expected_version)!==scope.draftVersion-1
  ||saved.result_draft_id!==draftId||saved.result_draft_version!==scope.draftVersion||!same(saved.selected_methodology,draft.selected_methodology))return bad();
 checkCreationReceipt(object(rows.draftReceipt,columns.authorization_receipts),saved,
  hash({kind:'DRAFT',draftId,operation:saved.operation,actorId:creatorId,clientId,requestHash:saved.request_hash}),human);
 const intent=checkIntent(projectId,scope,applicationRef,applicationCreatedAt,draft,rows.intent);
 const created=object(rows.projectCommand,fieldNames(creationCommandFields));
 checkCreationCommand(created,creatorId,clientId);
 if(created.id!==intent.project_command_id||created.scope_kind!=='PROJECT'||created.scope_id!==projectId||created.project_id!==projectId
  ||created.draft_id!==null||created.operation!=='createProject'||created.command_id!==intent.external_command_id||created.request_hash!==intent.request_hash
  ||number(created.expected_version)!==0||number(created.control_generation,1)!==1||created.received_at!==applicationCreatedAt)return bad();
 checkCreationResult(projectId,applicationRef,applicationCreatedAt,created);
 const scopeDigest=hash({operation:'createProject',draftId,draftVersion:scope.draftVersion,projectId,actorId:creatorId,clientId,requestHash:intent.request_hash});
 checkCreationReceipt(object(rows.projectReceipt,columns.authorization_receipts),created,scopeDigest,{...human,clientId});
 const audit=object(rows.projectAudit,columns.audit_events);
 if(audit.project_id!==projectId||number(audit.server_sequence,1)!==1||!uuidV1(audit.event_id)||!same(audit.actor_ref,human)||audit.client_ref!==clientId
  ||audit.command_id!==created.id||audit.operation_id!==created.operation_id||!same(audit.target_ref,{id:projectId,version:1})
  ||audit.policy_ref!==null||audit.approval_ref!==null||audit.outcome!=='APPLIED'||audit.scope_digest!==scopeDigest
  ||audit.reason_code!=='FIRST_PROJECT_FROM_OWNED_DRAFT'||audit.source_kind!=='HUMAN_COMMAND'||audit.correction_of!==null
  ||audit.recorded_at!==created.received_at)return bad();
 safe(rows);
 return {sequence:1,draftSelectionRequestReconstructed:false as const};
}

/** 승인된 query-only 거래에서 기존 본인 소비 초안 범위의 필요한 열만 읽는다. */
export async function readOwnedSystemCreationRows(db:Pick<PoolClient,'query'>,projectId:string,scope:OwnedSystemCreationScope,
 applicationRef:RuntimeRefV1,applicationCreatedAt:unknown,metadataBytes:number):Promise<OwnedSystemCreationRows>{
 if(!uuidV1(projectId)||!isOwnedSystemCreationScope(scope)||!refV1(applicationRef)||applicationRef.version!==1)return bad();
 let remaining=metadataBytes;
 async function read(table:Table,fields:readonly string[],where:string,args:unknown[]){
  if(!Number.isSafeInteger(remaining)||remaining<1)return bad('PROJECT_CREATION_DRAFT_INVENTORY_LIMIT',413);
  const cap=args.length+1;
  const {rows}=await db.query(`/*FN16_D2_INITIAL_CREATION*/ WITH material AS (
   SELECT ${fields.join(',')} FROM anvil.${table} t WHERE ${where} LIMIT 2
  ) SELECT CASE WHEN octet_length(to_jsonb(material)::text)<=$${cap}::bigint THEN to_jsonb(material) END AS inventory_data,
   octet_length(to_jsonb(material)::text) AS row_bytes FROM material`,[...args,remaining]);
  if(rows.length!==1)return bad();
  const envelope=object(rows[0],['inventory_data','row_bytes']),size=number(envelope.row_bytes,1);
  if(size>remaining)return bad('PROJECT_CREATION_DRAFT_INVENTORY_LIMIT',413);
  const row=object(envelope.inventory_data,fieldNames(fields));
  if(Buffer.byteLength(canonicalJson(row))>size)return bad();
  remaining-=size;
  return cloneV1(row);
 }
 const draft=await read('project_drafts',ownedDraftFields,
  't.id=$1::uuid AND t.owner_user_id=$2::uuid AND t.consumed_project_id=$3::uuid AND t.version=$4::bigint',
  [scope.draftId,scope.creatorId,projectId,scope.draftVersion]);
 checkOwnedDraft(projectId,scope,draft);
 const selection=await read('draft_artifact_selection_versions',draftSelectionFields,'t.draft_id=$1::uuid AND t.draft_version=$2::bigint',
  [scope.draftId,scope.draftVersion]);
 checkOwnedDraftSelection(scope,selection);
 const draftCommand=await read('commands',draftCommandFields,"t.id=$1::uuid AND t.scope_kind='DRAFT' AND t.draft_id=$2::uuid AND t.actor_id=$3::uuid",
  [selection.command_id,scope.draftId,scope.creatorId]);
 const receiptColumns=columns.authorization_receipts.map(field=>'t.'+field);
 const draftReceipt=await read('authorization_receipts',receiptColumns,"t.id=$1::uuid AND t.command_id=$2::uuid AND t.scope_kind='DRAFT' AND t.scope_id=$3::uuid",
  [selection.receipt_id,selection.command_id,scope.draftId]);
 const intent=await read('draft_creation_intents',intentFields,
  "t.id=$1::uuid AND t.target_project_id=$2::uuid AND t.actor_id=$3::uuid AND t.draft_id=$4::uuid AND t.expected_version=$5::bigint",
  [scope.creationIntentId,projectId,scope.creatorId,scope.draftId,scope.draftVersion]);
 checkIntent(projectId,scope,applicationRef,applicationCreatedAt,draft,intent);
 const projectCommand=await read('commands',creationCommandFields,
  "t.id=$1::uuid AND t.scope_kind='PROJECT' AND t.project_id=$2::uuid AND t.actor_id=$3::uuid AND t.operation='createProject'",
  [intent.project_command_id,projectId,scope.creatorId]);
 if(!uuidV1(projectCommand.authorization_receipt_id))return bad();
 const projectReceipt=await read('authorization_receipts',receiptColumns,"t.id=$1::uuid AND t.command_id=$2::uuid AND t.scope_kind='PROJECT' AND t.scope_id=$3::uuid",
  [projectCommand.authorization_receipt_id,projectCommand.id,projectId]);
 const projectAudit=await read('audit_events',columns.audit_events.map(field=>'t.'+field),
  't.project_id=$1::uuid AND t.command_id=$2::uuid AND t.correction_of IS NULL',[projectId,projectCommand.id]);
 const rows={draft,selection,draftCommand,draftReceipt,intent,projectCommand,projectReceipt,projectAudit};
 checkOwnedSystemCreationRows(projectId,scope,applicationRef,applicationCreatedAt,rows);
 return rows;
}

/** 본인에게 속한 소비 초안의 선택·귀속 metadata다. 원문/쓰기/복원 권한을 발급하지 않는다. */
export async function collectProjectCreationDraftInventory(access:AccessRepository,token:string,value:unknown,signal:AbortSignal):Promise<Row>{
 const request=readDocumentInventoryInput(value),started=performance.now();let authDeadline=Infinity,identity:AuthenticatedIdentity|undefined,metadataUsed=0;
 const check=()=>{if(signal.aborted)bad('PROJECT_CREATION_DRAFT_INVENTORY_CANCELLED',409);if(performance.now()-started>=request.limits.deadlineMs||performance.now()>=authDeadline)bad('PROJECT_CREATION_DRAFT_INVENTORY_DEADLINE',413);};
 async function query(db:PoolClient,sql:string,values:unknown[]=[]){check();const ms=Math.floor(Math.min(2147483647,request.limits.deadlineMs-(performance.now()-started),authDeadline-performance.now()));if(ms<1)bad('PROJECT_CREATION_DRAFT_INVENTORY_DEADLINE',413);await db.query("SELECT set_config('statement_timeout',$1,true)",[String(ms)]);check();const before=performance.now(),result=await db.query(sql,values);check();return{result,before};}
 async function owner(db:PoolClient,a:AuthenticatedIdentity){const p=await projectMember({query:async(s:string,v:unknown[])=>(await query(db,s,v)).result}as unknown as PoolClient,a,request.projectId,false);if(p.id!==request.projectId||p.archived_at!==null||p.participation!=='OWNER')bad('NOT_FOUND',404);}

 let initialFingerprint:string|undefined,initialIds:string[]|undefined;
 const integerKeys=new Set(['version','draft_version','step','expected_version','control_generation','server_sequence','ordinal','attempt','bytes']);
 function normalize(table:Table,row:Row){return Object.fromEntries(columns[table].map(k=>[k,row[k]===null?null:integerKeys.has(k)?number(row[k],['version','draft_version','step','server_sequence','control_generation'].includes(k)?1:0):k.endsWith('_at')?stamp(row[k]):row[k]]));}
 async function rows(db:PoolClient,table:Table,filters:Row):Promise<Row[]>{const out:Row[]=[],keys=table==='draft_artifact_selection_versions'?['draft_id','draft_version']:table==='draft_artifact_selections'?['draft_id','draft_version','artifact_id']:table==='draft_artifact_adoptions'?['artifact_id']:table==='draft_audit_events'?['draft_id','server_sequence']:table==='audit_events'?['server_sequence','event_id']:['id'];let last:unknown[]|null=null;
  for(const[k,v]of Object.entries(filters))if(!columns[table].includes(k)||Array.isArray(v)&&v.length===0)return out;
  for(;;){check();const values:unknown[]=[],bind=(v:unknown)=>{values.push(v);return'$'+values.length;},conditions=Object.entries(filters).map(([k,v])=>Array.isArray(v)?`t.${k}=ANY(${bind(v)}::${integerKeys.has(k)?'bigint':'uuid'}[])`:`t.${k}=${bind(v)}::${typeof v==='number'?'bigint':uuidV1(v)?'uuid':'text'}`);if(!conditions.length)bad();if(last)conditions.push(`(${keys.map(k=>'t.'+k).join(',')})>(${last.map((v,i)=>bind(v)+(integerKeys.has(keys[i]!)?'::bigint':'::uuid')).join(',')})`);const remaining=request.limits.metadataBytes-metadataUsed;if(remaining<1)bad('PROJECT_CREATION_DRAFT_INVENTORY_LIMIT',413);const cap=bind(remaining),sql=`WITH inventory_row AS (SELECT ${columns[table].map(k=>'t.'+k).join(',')} FROM anvil.${table} t WHERE ${conditions.join(' AND ')} ORDER BY ${keys.map(k=>'t.'+k).join(',')} LIMIT 200) SELECT CASE WHEN octet_length(to_jsonb(inventory_row)::text)<=${cap}::bigint THEN to_jsonb(inventory_row) ELSE NULL END AS inventory_data,octet_length(to_jsonb(inventory_row)::text) AS row_bytes FROM inventory_row ORDER BY ${keys.map(k=>'inventory_row.'+k).join(',')}`;const result=(await query(db,sql,values)).result;if(!Array.isArray(result.rows)||result.rows.length>200)bad();
   for(const raw of result.rows){const wrapped=object(raw,['inventory_data','row_bytes']),size=number(wrapped.row_bytes,1);if(size>remaining||metadataUsed+size>request.limits.metadataBytes)bad('PROJECT_CREATION_DRAFT_INVENTORY_LIMIT',413);const row=object(wrapped.inventory_data,columns[table]);for(const[k,v]of Object.entries(filters))if(Array.isArray(v)?!v.map(String).includes(String(row[k])):String(row[k])!==String(v))bad();const tuple=keys.map(k=>integerKeys.has(k)?number(row[k],k==='ordinal'?0:1):row[k]);if(tuple.some((v,i)=>!integerKeys.has(keys[i]!)&&!uuidV1(v)))bad();if(last){let cmp=0;for(let i=0;i<tuple.length;i++){if(tuple[i]!<last[i]!){cmp=-1;break;}if(tuple[i]!>last[i]!){cmp=1;break;}}if(cmp<=0)bad();}last=tuple;metadataUsed+=size;out.push(structuredClone(row));}if(result.rows.length<200)return out;
  }}
 function index(list:Row[],key:string){const map=new Map<string,Row>();for(const r of list){if(!uuidV1(r[key])||map.has(r[key]))bad();map.set(r[key],r);}return map;}
 async function by(db:PoolClient,table:Table,key:string,ids:string[],extra:Row={}){const unique=[...new Set(ids)].sort();if(unique.some(v=>!uuidV1(v)))bad();const out:Row[]=[];for(let i=0;i<unique.length;i+=200)out.push(...await rows(db,table,{...extra,[key]:unique.slice(i,i+200)}));return out;}
 const artifactRef=(a:Row)=>({artifactId:a.id,bytes:number(a.bytes),contentHash:a.content_hash,mediaType:a.media_type});
 async function current(db:PoolClient,a:AuthenticatedIdentity){const drafts=await rows(db,'project_drafts',{owner_user_id:a.actorId,consumed_project_id:request.projectId}),allArtifacts:Row[]=[],allUploads:Row[]=[];
  for(const d of drafts){if(!uuidV1(d.id)||!uuidV1(d.client_id)||number(d.version,1)<1||number(d.step,1)>4)bad();safe(d.input_json);const refs=readDraftArtifactRefs(d.input_json?.artifactRefs??[]),artifacts=index(await by(db,'artifacts','id',refs.map(r=>r.artifactId)),'id'),uploads=await by(db,'draft_upload_intents','server_command_id',[...artifacts.values()].map(r=>r.command_id));
   for(const ref of refs){const f=artifacts.get(ref.artifactId);if(!f)bad('NOT_FOUND',404);if(!same(artifactRef(f),ref))bad();const origins=uploads.filter(u=>u.artifact_id===f.id&&u.server_command_id===f.command_id);if(origins.length!==1||origins[0]!.draft_id!==d.id)bad('NOT_FOUND',404);if(f.project_id){await projectMember({query:async(s:string,v:unknown[])=>(await query(db,s,v)).result}as unknown as PoolClient,a,f.project_id);}else if(f.draft_id!==d.id)bad('NOT_FOUND',404);if(f.state!=='READY')bad('NOT_FOUND',404);if(f.storage_key!==(f.project_id?`blobs/${f.project_id}/${f.id}`:`draft-blobs/${d.id}/${f.id}`))bad();}
   allArtifacts.push(...artifacts.values());allUploads.push(...uploads);
  }
  const fingerprint=hash({drafts:drafts.map(r=>normalize('project_drafts',r)),artifacts:allArtifacts.map(r=>normalize('artifacts',r)),uploads:allUploads.map(r=>normalize('draft_upload_intents',r))});return{drafts,allArtifacts,allUploads,fingerprint};
 }
 async function boundary(){check();return access.authenticated(token,null,async(db,a)=>{check();if(!a||!uuidV1(a.actorId)||!uuidV1(a.clientId)||!Number.isSafeInteger(a.credentialGeneration)||a.credentialGeneration<1||!a.authSession||!uuidV1(a.authSession.id))bad('AUTH_REQUIRED',401);if(identity&&(identity.actorId!==a.actorId||identity.clientId!==a.clientId||identity.credentialGeneration!==a.credentialGeneration||identity.authSession!.id!==a.authSession.id))bad('AUTH_REQUIRED',401);const isolation=(await query(db,"SELECT current_setting('transaction_isolation') AS isolation")).result.rows;if(!Array.isArray(isolation)||isolation.length!==1||isolation[0]?.isolation!=='read committed')bad();await owner(db,a);const clock=await query(db,'SELECT clock_timestamp() AS at'),at=clock.result.rows?.length===1?clock.result.rows[0]?.at:null;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))bad();authDeadline=Math.min(authDeadline,notificationSessionDeadline(a,at,clock.before));identity??=structuredClone(a);const packet=await current(db,a);const currentIds=packet.drafts.map(d=>d.id);if(initialIds!==undefined&&!same(initialIds,currentIds))bad('NOT_FOUND',404);initialIds??=currentIds;if(initialFingerprint!==undefined&&initialFingerprint!==packet.fingerprint)bad();initialFingerprint??=packet.fingerprint;check();return packet;});}
 async function observation(db:PoolClient){const rows=(await query(db,"SELECT current_setting('transaction_isolation') AS isolation,current_setting('transaction_read_only') AS read_only,pg_current_snapshot()::text AS snapshot,clock_timestamp() AS at")).result.rows,r=rows?.length===1?rows[0]:null;if(r?.isolation!=='repeatable read'||r.read_only!=='on'||typeof r.snapshot!=='string'||!/^\d+:\d+:[\d,]*$/.test(r.snapshot)||!(r.at instanceof Date)||!Number.isFinite(r.at.getTime()))bad();return r.snapshot;}
 const opaque=(table:Table,row:Row,key='id')=>({id:row[key],derivedMetadataHash:hash(normalize(table,row))});
 try{await boundary();let db:PoolClient|undefined,beginSent=false,begun=false,rollbackTried=false,releaseError:Error|undefined;
  try{db=await access.pool.connect();check();beginSent=true;await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;check();const start=await observation(db);await owner(db,identity!);const packet=await current(db,identity!);if(!same(initialIds,packet.drafts.map(d=>d.id)))bad('NOT_FOUND',404);if(packet.fingerprint!==initialFingerprint)bad();const drafts:Row[]=[],selections:Row[]=[],adoptions:Row[]=[],artifacts:Row[]=[],evidence:Row[]=[],issues:Row[]=[],externalDependencies:Row[]=[],returnedArtifacts=new Set<string>();let declaredBytes=0;
   for(const d of packet.drafts){check();const refs=readDraftArtifactRefs(d.input_json.artifactRefs??[]),snapshots=await rows(db,'draft_artifact_selection_versions',{draft_id:d.id,draft_version:number(d.version,1)});if(snapshots.length!==1)bad();const sv=snapshots[0]!,selRows=await rows(db,'draft_artifact_selections',{draft_id:d.id,draft_version:number(d.version,1)}),creationRows=await rows(db,'draft_creation_intents',{draft_id:d.id,target_project_id:request.projectId,state:'COMMITTED'});if(creationRows.length!==1||selRows.length!==refs.length||sv.snapshot_hash!==hash(sv.refs_json)||!same(sv.refs_json,refs))bad();const cr=creationRows[0]!;safe(cr.request_json);safe(cr.result_json);if(cr.actor_id!==identity!.actorId||cr.client_id!==d.client_id||number(cr.expected_version,1)!==number(d.version,1)||!same(cr.refs_json,refs)||cr.selection_hash!==sv.snapshot_hash||!uuidV1(cr.project_command_id)||!uuidV1(cr.external_command_id)||!uuidV1(cr.id)||number(cr.attempt,1)<1)bad();const req=object(cr.request_json,['schemaVersion','commandId','clientId','draftId','draftVersion']);if(!same(req,{schemaVersion:1,commandId:cr.external_command_id,clientId:cr.client_id,draftId:d.id,draftVersion:number(d.version,1)})||hash(req)!==cr.request_hash)bad();
    const selected=new Map<number,Row>();for(const s of selRows){const ordinal=number(s.ordinal);if(ordinal>=refs.length||selected.has(ordinal)||!same(s.ref_json,refs[ordinal])||s.artifact_id!==refs[ordinal]!.artifactId||!uuidV1(s.upload_intent_id))bad();selected.set(ordinal,s);}
    const ads=await rows(db,'draft_artifact_adoptions',{draft_id:d.id,project_id:request.projectId,draft_version:number(d.version,1)});if(ads.length!==refs.length)bad();const adMap=index(ads,'artifact_id'),uploadMap=index(packet.allUploads,'id'),fileMap=index(packet.allArtifacts,'id');const sources=refs.map((ref,i)=>({ref,uploadId:selected.get(i)!.upload_intent_id}));if(!same(cr.sources_json,[...sources].sort((a,b)=>a.ref.artifactId.localeCompare(b.ref.artifactId))))bad();
    const draftCreate=await rows(db,'commands',{scope_kind:'DRAFT',draft_id:d.id,actor_id:d.owner_user_id,client_id:d.client_id,operation:'createProject',command_id:cr.external_command_id});if(draftCreate.length!==1)bad();const ids=[sv.command_id,cr.project_command_id,draftCreate[0]!.id,...sources.map(x=>uploadMap.get(x.uploadId)?.server_command_id)],commands=index(await by(db,'commands','id',ids),'id'),arRows=await by(db,'authorization_receipts','command_id',ids),receipts=index(arRows,'command_id'),draftAuditRows=await by(db,'draft_audit_events','command_id',ids,{draft_id:d.id}),projectAuditRows=await by(db,'audit_events','command_id',[cr.project_command_id],{project_id:request.projectId}),audits=index([...draftAuditRows,...projectAuditRows],'command_id');if(commands.size!==ids.length||receipts.size!==ids.length||audits.size!==ids.length)bad();const used=new Set<string>(),sequence=new Set<number>(),eventIds=new Set<string>();for(const a of draftAuditRows){const n=number(a.server_sequence,1);if(sequence.has(n)||!uuidV1(a.event_id)||eventIds.has(a.event_id))bad();sequence.add(n);eventIds.add(a.event_id);}
    function command(id:string,scope:string,operation:string,expected:number,result:unknown,requestHash?:string){const c=commands.get(id),a=receipts.get(id),e=audits.get(id),scopeId=scope==='DRAFT'?d.id:request.projectId;if(!c||!a||!e||used.has(id)||c.scope_kind!==scope||c.scope_id!==scopeId||c.project_id!==(scope==='PROJECT'?request.projectId:null)||c.draft_id!==(scope==='DRAFT'?d.id:null)||c.actor_id!==d.owner_user_id||c.client_id!==d.client_id||c.operation!==operation||c.state!=='APPLIED'||!uuidV1(c.command_id)||!uuidV1(c.operation_id)||number(c.expected_version)!==expected||c.control_generation!==(scope==='PROJECT'?1:null)||c.policy_ref!==null||c.payload_ref!==null||c.approval_consumption_id!==null||!digest(c.request_hash)||requestHash!==undefined&&c.request_hash!==requestHash||!same(c.result_ref,result))bad();const sd=scope==='DRAFT'?hash({kind:'DRAFT',draftId:d.id,operation,actorId:c.actor_id,clientId:c.client_id,requestHash:c.request_hash}):hash({operation:'createProject',draftId:d.id,draftVersion:number(d.version,1),projectId:request.projectId,actorId:c.actor_id,clientId:c.client_id,requestHash:c.request_hash});if(a.id!==c.authorization_receipt_id||a.scope_kind!==scope||a.scope_id!==scopeId||!same(a.subject_ref,scope==='DRAFT'?{kind:'HUMAN',userId:c.actor_id}:{kind:'HUMAN',userId:c.actor_id,clientId:c.client_id})||a.policy_ref!==null||a.approval_decision_ref!==null||a.scope_digest!==sd||!same(e.actor_ref,{kind:'HUMAN',userId:c.actor_id})||e.client_ref!==c.client_id||e.operation_id!==c.operation_id||e.outcome!=='APPLIED')bad();if(scope==='DRAFT'){if(e.draft_id!==d.id||e.operation!==operation||e.reason_code!==(operation==='uploadProjectDraftArtifact'?'EXPLICIT_DRAFT_FILE_UPLOAD':'OWNED_DRAFT_ONLY')||operation==='uploadProjectDraftArtifact'&&e.event_id!==c.operation_id)bad();}else if(e.project_id!==request.projectId||!same(e.target_ref,{id:request.projectId,version:1})||e.policy_ref!==null||e.approval_ref!==null||e.source_kind!=='HUMAN_COMMAND'||e.correction_of!==null||e.reason_code!=='FIRST_PROJECT_FROM_OWNED_DRAFT'||e.scope_digest!==sd)bad();safe(result);number(e.server_sequence,1);stamp(c.received_at);stamp(c.completed_at);stamp(a.authorized_at);stamp(e.recorded_at);used.add(id);evidence.push({command:opaque('commands',c),receipt:opaque('authorization_receipts',a),audit:opaque(scope==='DRAFT'?'draft_audit_events':'audit_events',e,'event_id'),requestReconstructionVerification:requestHash===undefined?'NOT_PERFORMED':'HASH_MATCH'});return c;}
    const selectedCommand=commands.get(sv.command_id);if(!selectedCommand||!['createProjectDraft','saveProjectDraft'].includes(selectedCommand.operation)||selectedCommand.result_ref?.draftId!==d.id||selectedCommand.result_ref.version!==number(d.version,1)||!same(selectedCommand.result_ref.input,d.input_json)||sv.receipt_id!==selectedCommand.authorization_receipt_id)bad();command(sv.command_id,'DRAFT',selectedCommand.operation,number(d.version,1)-1,selectedCommand.result_ref);
    const result=cr.result_json;if(!result||typeof result!=='object'||Array.isArray(result)||result.id!==request.projectId||result.version!==1)bad();const pc=command(cr.project_command_id,'PROJECT','createProject',0,result,cr.request_hash),dc=command(draftCreate[0]!.id,'DRAFT','createProject',number(d.version,1),result,cr.request_hash);if(pc.command_id!==cr.external_command_id||dc.command_id!==cr.external_command_id)bad();
    for(let i=0;i<refs.length;i++){const ref=refs[i]!,sel=selected.get(i)!,ad=adMap.get(ref.artifactId),u=uploadMap.get(sel.upload_intent_id),f=fileMap.get(ref.artifactId);if(!ad||!u||!f||u.state!=='FINALIZED'||u.draft_id!==d.id||u.actor_id!==d.owner_user_id||u.client_id!==d.client_id||u.artifact_id!==ref.artifactId||!same(u.ref_json,ref)||!same(artifactRef(f),ref)||f.state!=='READY'||f.project_id!==request.projectId||f.draft_id!==null||f.created_by!==u.actor_id||f.client_id!==u.client_id||f.command_id!==u.server_command_id||u.staging_key!==`draft-staging/${d.id}/${u.id}/body`||u.final_key!==`draft-blobs/${d.id}/${f.id}`||f.storage_key!==`blobs/${request.projectId}/${f.id}`)bad();if(!validDraftUploadCommand(u.request_json)||u.request_json.clientId!==u.client_id||u.request_json.commandId!==u.external_command_id||u.request_json.expectedVersion!==number(u.expected_version,1)||!same({...u.request_json.payload,artifactId:f.id},ref)||hash({operation:'uploadProjectDraftArtifact',draftId:d.id,command:u.request_json})!==u.request_hash)bad();const uploaded=object(u.result_json,['scopeKind','draftId','commandId','clientId','version','status','data']);if(!same(uploaded,{scopeKind:'DRAFT',draftId:d.id,commandId:u.external_command_id,clientId:u.client_id,version:number(u.expected_version,1),status:'APPLIED',data:{artifactRef:ref,status:'ARTIFACT_READY',inspection:f.inspection_json}}))bad();const uc=command(u.server_command_id,'DRAFT','uploadProjectDraftArtifact',number(u.expected_version,1),uploaded,u.request_hash);if(uc.command_id!==u.external_command_id||uc.operation_id!==u.operation_id||uc.authorization_receipt_id!==u.receipt_id)bad();if(ad.upload_intent_id!==u.id||ad.original_command_id!==u.server_command_id||ad.draft_id!==d.id||number(ad.draft_version,1)!==number(d.version,1)||!same(ad.ref_json,ref)||ad.source_key!==u.final_key||ad.target_key!==f.storage_key||ad.project_id!==request.projectId||ad.creation_intent_id!==cr.id||ad.create_command_id!==pc.id||ad.actor_id!==d.owner_user_id||ad.client_id!==d.client_id)bad();stamp(ad.adopted_at);if(returnedArtifacts.has(ref.artifactId))bad();returnedArtifacts.add(ref.artifactId);if(returnedArtifacts.size>request.limits.fileCount||declaredBytes>request.limits.inputBytes-ref.bytes)bad('PROJECT_CREATION_DRAFT_INVENTORY_LIMIT',413);declaredBytes+=ref.bytes;artifacts.push({ref,state:'READY',inspectionStatus:f.inspection_json?.state==='NO_KNOWN_MARKER'?'NO_KNOWN_MARKER':f.inspection_json?.state==='SUSPECTED'?'SUSPECTED':'UNKNOWN',blobVerification:'NOT_PERFORMED'});adoptions.push({ref,draftId:d.id,draftVersion:number(d.version,1),creationId:cr.id,uploadId:u.id,originalCommandId:u.server_command_id,createCommandId:pc.id,derivedMetadataHash:hash(normalize('draft_artifact_adoptions',ad))});}
    if(used.size!==ids.length)bad();drafts.push({id:d.id,version:number(d.version,1),step:number(d.step,1),consumedProjectId:request.projectId,inputHash:hash(d.input_json),derivedMetadataHash:hash(normalize('project_drafts',d))});selections.push({draftId:d.id,draftVersion:number(d.version,1),selectionHash:sv.snapshot_hash,entries:refs.map((ref,i)=>({ordinal:i,ref}))});
   }
   const end=await observation(db);if(end!==start)bad();await owner(db,identity!);const projection={kind:'PROJECT_CREATION_DRAFT_INVENTORY_V1',projectId:request.projectId,drafts,selections,adoptions,artifacts,evidence,issues,externalDependencies},result:Row={...projection,scope:'OWN_CONSUMED_PROJECT_DRAFT_SELECTED_ADOPTIONS_ONLY',inventoryHash:hash(projection),usage:{metadataBytes:0,inputBytes:declaredBytes,fileCount:returnedArtifacts.size},originalDraftContentHash:'NOT_STORED',sourceDeclarationHistory:'NOT_COLLECTED',wholeDraftHistory:'NOT_COLLECTED',unselectedUploads:'NOT_COLLECTED',privateQuota:'NOT_COLLECTED',originalSourceBytes:'NOT_PERFORMED',blobVerification:'NOT_PERFORMED',creationWriteProof:'NOT_PERFORMED',authorizationRestorationVerification:'NOT_PERFORMED',fullProjectCoverage:false,restorable:false,authorizationRestoration:false,executionAuthorized:false,dispatchPerformed:false,atomicSnapshotVerified:false};
   check();rollbackTried=true;await db.query('ROLLBACK');begun=false;beginSent=false;const releasing=db;db=undefined;releasing.release();await boundary();check();for(let i=0;i<17;i++){const n=Buffer.byteLength(canonicalJson(result));if(metadataUsed+n>request.limits.metadataBytes)bad('PROJECT_CREATION_DRAFT_INVENTORY_LIMIT',413);if(n===result.usage.metadataBytes)return result;result.usage.metadataBytes=n;}return bad();
  }catch(error){if(db){if(beginSent&&!begun)releaseError=new Error('PROJECT_CREATION_DRAFT_INVENTORY_BEGIN_UNKNOWN');if(begun){if(rollbackTried)releaseError=new Error('PROJECT_CREATION_DRAFT_INVENTORY_CLEANUP_UNKNOWN');else{rollbackTried=true;try{await db.query('ROLLBACK');begun=false;}catch{releaseError=new Error('PROJECT_CREATION_DRAFT_INVENTORY_CLEANUP_UNKNOWN');}}}}if(releaseError)bad('PROJECT_CREATION_DRAFT_INVENTORY_STORAGE_FAILED');throw error;}finally{if(db)try{db.release(releaseError);}catch{bad('PROJECT_CREATION_DRAFT_INVENTORY_STORAGE_FAILED');}}
 }catch(error){if(error instanceof AuthFailure&&own.has(error))throw error;if(error instanceof AuthFailure&&error.statusCode===401&&error.message==='AUTH_REQUIRED')throw new AuthFailure('AUTH_REQUIRED',401);if(error instanceof AuthFailure&&error.statusCode===404&&error.message==='NOT_FOUND')throw new AuthFailure('NOT_FOUND',404);return bad('PROJECT_CREATION_DRAFT_INVENTORY_STORAGE_FAILED');}
}
