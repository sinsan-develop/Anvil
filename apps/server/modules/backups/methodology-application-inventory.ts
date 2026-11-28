import type {PoolClient} from 'pg';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {readApplicationSnapshot} from '../methodologies/application-snapshot.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {readDocumentInventoryInput} from './document-inventory-input.ts';
import {checkProjectHistoryOrigin,projectHistoryOriginColumns,readProjectHistoryOrigin} from './document-inventory.ts';
type Row=Record<string,any>;
const columns={
 project_methodologies:'id project_id application_version source_definition_id source_version source_hash snapshot_json snapshot_hash created_by created_at application_command_id'.split(' '),
 commands:'id command_id scope_kind scope_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id payload_ref completed_at operation_id request_hash'.split(' '),
 audit_events:'event_id project_id command_id server_sequence'.split(' ')
};
type Table=keyof typeof columns;
const text=(v:unknown,max=20000):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=max&&v.isWellFormed();
const ownErrors=new WeakSet<AuthFailure>();
function bad(code='METHODOLOGY_APPLICATION_INVENTORY_INTEGRITY_FAILED',status=503):never{const e=new AuthFailure(code,status);ownErrors.add(e);throw e;}
const hash=(value:unknown)=>contentHash(canonicalJson(value));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function object(value:unknown,keys:string[],exact=true):Row{
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return bad();
 const ds=Object.getOwnPropertyDescriptors(value),names=Reflect.ownKeys(ds);if(exact&&(names.length!==keys.length||names.some(k=>typeof k!=='string'||!keys.includes(k))))return bad();const out:Row={};
 for(const key of keys){const d=ds[key];if(!d||!d.enumerable||!Object.hasOwn(d,'value'))return bad();out[key]=d.value;}return out;
}
function integer(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):number{if(typeof v==='string'&&!/^(0|[1-9][0-9]*)$/.test(v))return bad();const n=typeof v==='number'||typeof v==='string'?Number(v):NaN;if(!Number.isSafeInteger(n)||n<min||n>max)return bad();return n;}
function stamp(v:unknown):string{if(!(v instanceof Date)&&typeof v!=='string')return bad();const d=new Date(v);if(!Number.isFinite(d.getTime()))return bad();return d.toISOString();}
function digest(v:unknown):v is string{return typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);}
function identitySnapshot(actor:AuthenticatedIdentity):AuthenticatedIdentity{
 const a=object(actor,['actorId','clientId','credentialGeneration','authSession'],false),s=object(a.authSession,['id','idleExpiresAt','absoluteExpiresAt']);
 if(!uuidV1(a.actorId)||!uuidV1(a.clientId)||!uuidV1(s.id)||typeof s.idleExpiresAt!=='string'||typeof s.absoluteExpiresAt!=='string'||!Number.isFinite(Date.parse(s.idleExpiresAt))||!Number.isFinite(Date.parse(s.absoluteExpiresAt)))return bad('AUTH_REQUIRED',401);
 return Object.freeze({actorId:a.actorId,clientId:a.clientId,credentialGeneration:integer(a.credentialGeneration,1),serverOwner:false,reauthUntil:null,authSession:Object.freeze({id:s.id,idleExpiresAt:s.idleExpiresAt,absoluteExpiresAt:s.absoluteExpiresAt})});
}
const identityKey=(a:AuthenticatedIdentity)=>[a.actorId,a.clientId,a.credentialGeneration,a.authSession!.id];
function compare(a:(string|number)[],b:(string|number)[]){for(let i=0;i<a.length;i++){if(a[i]!==b[i])return a[i]!<b[i]!?-1:1;}return 0;}
/** 원문 접근 없는 내부 방법론 전체 적용 역사 metadata 관측이다. archive/복원·명령 실행 권한을 발급하지 않는다. */
function checkExactApplicationRow(projectId:string,ref:RuntimeRefV1,value:unknown){
 if(!uuidV1(projectId)||!refV1(ref))return bad();
 const row=object(value,columns.project_methodologies);
 if(integer(row.application_version,1)!==ref.version||!uuidV1(row.created_by)
  ||(row.application_command_id===null?ref.version!==1:!uuidV1(row.application_command_id)))return bad();
 stamp(row.created_at);
 integer(row.source_version,1);
 const parsed=readApplicationSnapshot(projectId,[row]);
 if(!same(parsed.applicationRef,ref)||!parsed.snapshot)return bad();
 return {row,snapshot:parsed.snapshot};
}

/** 현재 적용 head가 아니라 임무가 기록한 정확 역사 행과 노드를 검산한다. */
export function checkAssignmentApplicationHistoryRow(projectId:string,ref:RuntimeRefV1,nodeId:string,value:unknown){
 const {row,snapshot}=checkExactApplicationRow(projectId,ref,value);
 const {nodes}=object(snapshot.graph,['nodes'],false);
 if(!Array.isArray(nodes)||!nodes.some(node=>node.nodeId===nodeId))return bad();
 if(inspectArtifact(Buffer.from(canonicalJson(row))).state==='SUSPECTED')return bad('METHODOLOGY_APPLICATION_INVENTORY_SENSITIVE_METADATA');
 return row;
}

export async function readAssignmentApplicationHistoryRow(db:Pick<PoolClient,'query'>,projectId:string,ref:RuntimeRefV1,nodeId:string,metadataBytes:number){
 if(!uuidV1(projectId)||!refV1(ref))return bad();
 if(!Number.isSafeInteger(metadataBytes)||metadataBytes<1)return bad('METHODOLOGY_APPLICATION_INVENTORY_LIMIT',413);
 const {rows}=await db.query(`/*FN16_D2_ASSIGNMENT_APPLICATION*/ WITH material AS (
  SELECT ${columns.project_methodologies.join(',')} FROM anvil.project_methodologies
  WHERE project_id=$1::uuid AND id=$2::uuid AND application_version=$3::bigint AND snapshot_hash=$4::text LIMIT 2
 ) SELECT CASE WHEN octet_length(to_jsonb(material)::text)<=$5::bigint THEN to_jsonb(material) END AS inventory_data,
  octet_length(to_jsonb(material)::text) AS row_bytes FROM material`,[projectId,ref.id,ref.version,ref.contentHash,metadataBytes]);
 if(rows.length!==1)return bad();
 const envelope=object(rows[0],['inventory_data','row_bytes']),size=integer(envelope.row_bytes,1);
 if(size>metadataBytes)return bad('METHODOLOGY_APPLICATION_INVENTORY_LIMIT',413);
 const row=checkAssignmentApplicationHistoryRow(projectId,ref,nodeId,envelope.inventory_data);
 if(Buffer.byteLength(canonicalJson(row))>size)return bad();
 return cloneV1(row);
}

const explicitSourceFields=['d.project_id','d.scope','v.definition_id','v.version','v.name','v.purpose','v.graph_json','v.content_hash'];
const previousFields=['project_id','id','application_version','snapshot_hash','source_definition_id','source_version','source_hash'];
export interface ExplicitApplicationHistoryRows{
 source:Row;
 previous:Row|null;
 origin:Awaited<ReturnType<typeof readProjectHistoryOrigin>>;
}
function explicitApplication(projectId:string,ref:RuntimeRefV1,sourceRef:RuntimeRefV1,value:unknown){
 const {row,snapshot}=checkExactApplicationRow(projectId,ref,value);
 if(!refV1(sourceRef)||!uuidV1(row.application_command_id)||Object.hasOwn(snapshot,'draftConfirmationRef')
  ||!same(snapshot.sourceRef,sourceRef))return bad();
 return {row,snapshot:object(snapshot,['name','purpose','graph','sourceRef'])};
}
function explicitApplicationSource(projectId:string,ref:RuntimeRefV1,snapshot:Row,value:unknown){
 const row=object(value,explicitSourceFields.map(f=>f.slice(f.indexOf('.')+1)));
 if(row.project_id!==projectId||row.scope!=='PROJECT'||row.definition_id!==ref.id||integer(row.version,1)!==ref.version
  ||row.content_hash!==ref.contentHash||hash(row.graph_json)!==ref.contentHash
  ||!same(snapshot,{name:row.name,purpose:row.purpose,graph:row.graph_json,sourceRef:ref}))return bad();
}
function previousApplicationRef(projectId:string,ref:RuntimeRefV1,sourceRef:RuntimeRefV1,value:unknown){
 if(ref.version===1)return value===null?null:bad();
 const row=object(value,previousFields);
 const previous={id:row.id,version:integer(row.application_version,1),contentHash:row.snapshot_hash};
 const previousSource={id:row.source_definition_id,version:integer(row.source_version,1),contentHash:row.source_hash};
 if(row.project_id!==projectId||!refV1(previous)||!refV1(previousSource)||previous.id===ref.id||previous.version!==ref.version-1
  ||same(previousSource,sourceRef))return bad();
 return previous;
}

/** 명시 적용의 원 요청·정착만 검산한다. 초기 생성 원장은 이 범위를 사용하지 않는다. */
export function checkExplicitApplicationHistoryRows(projectId:string,ref:RuntimeRefV1,sourceRef:RuntimeRefV1,application:unknown,
 assignmentDraftSequence:unknown,value:unknown){
 const {row,snapshot}=explicitApplication(projectId,ref,sourceRef,application);
 const {source,previous,origin}=object(value,['source','previous','origin']);
 explicitApplicationSource(projectId,sourceRef,snapshot,source);
 const preceding=previousApplicationRef(projectId,ref,sourceRef,previous);
 const {command}=object(origin,['command','receipt','audit']);
 const cmd=object(command,['client_id','result_ref'],false);
 const result=object(cmd.result_ref,['data'],false);
 const {reason}=object(result.data,['ref','status','snapshot','reason','previousApplicationRef']);
 if(!text(reason))return bad();
 // apply()는 사용자 reason을 변환하지 않고 원 receipt data에도 그대로 남긴다.
 const expectedApplicationVersion=ref.version-1;
 const {sequence}=checkProjectHistoryOrigin(projectId,ref,origin,{operation:'applyMethodology',
  reasonCode:'EXPLICIT_EMPTY_PROJECT_METHODOLOGY_APPLICATION',commandId:row.application_command_id,actorId:row.created_by,
  clientId:cmd.client_id,createdAt:row.created_at,requestBinding:{targetId:projectId,expectedVersion:expectedApplicationVersion},
  payload:{methodologyRef:sourceRef,expectedApplicationVersion,reason},
  resultData:{status:'METHODOLOGY_APPLIED',snapshot,reason,previousApplicationRef:preceding}});
 if(sequence>=integer(assignmentDraftSequence,1))return bad();
 if(inspectArtifact(Buffer.from(canonicalJson(value))).state==='SUSPECTED')return bad('METHODOLOGY_APPLICATION_INVENTORY_SENSITIVE_METADATA');
 return {applicationSourceRef:sourceRef,previousApplicationRef:preceding,applicationOriginVerified:true as const,
  explicitApplicationProjectionHash:hash(value)};
}

export async function readExplicitApplicationHistoryRows(db:Pick<PoolClient,'query'>,projectId:string,ref:RuntimeRefV1,sourceRef:RuntimeRefV1,
 application:unknown,assignmentDraftSequence:unknown,metadataBytes:number):Promise<ExplicitApplicationHistoryRows>{
 const {row,snapshot}=explicitApplication(projectId,ref,sourceRef,application);
 let remaining=metadataBytes;
 async function fixed(from:string,fields:readonly string[],predicate:string,args:unknown[]){
  if(!Number.isSafeInteger(remaining)||remaining<1)return bad('METHODOLOGY_APPLICATION_INVENTORY_LIMIT',413);
  const cap=args.length+1;
  const {rows}=await db.query(`/*FN16_D2_EXPLICIT_APPLY*/ WITH material AS (
   SELECT ${fields.join(',')} FROM ${from} WHERE ${predicate} LIMIT 2
  ) SELECT CASE WHEN octet_length(to_jsonb(material)::text)<=$${cap}::bigint THEN to_jsonb(material) END AS inventory_data,
   octet_length(to_jsonb(material)::text) AS row_bytes FROM material`,[...args,remaining]);
  if(rows.length!==1)return bad();
  const envelope=object(rows[0],['inventory_data','row_bytes']),size=integer(envelope.row_bytes,1);
  if(size>remaining)return bad('METHODOLOGY_APPLICATION_INVENTORY_LIMIT',413);
  const row=object(envelope.inventory_data,fields.map(f=>f.slice(f.indexOf('.')+1)));
  if(Buffer.byteLength(canonicalJson(row))>size)return bad();
  remaining-=size;
  return cloneV1(row);
 }
 const source=await fixed('anvil.methodology_definitions d JOIN anvil.methodology_versions v ON v.definition_id=d.id',explicitSourceFields,
  "d.project_id=$1::uuid AND d.scope='PROJECT' AND d.id=$2::uuid AND v.version=$3::bigint AND v.content_hash=$4::text",
  [projectId,sourceRef.id,sourceRef.version,sourceRef.contentHash]);
 explicitApplicationSource(projectId,sourceRef,snapshot,source);
 const previous=ref.version===1?null:await fixed('anvil.project_methodologies t',previousFields.map(c=>'t.'+c),
  't.project_id=$1::uuid AND t.application_version=$2::bigint',[projectId,ref.version-1]);
 previousApplicationRef(projectId,ref,sourceRef,previous);
 const origin=await readProjectHistoryOrigin((table,predicate,args)=>fixed(`anvil.${table} t`,projectHistoryOriginColumns[table].map(c=>'t.'+c),
  `${table==='authorization_receipts'?'t.scope_id':'t.project_id'}=$1::uuid AND ${predicate}`,[projectId,...args]),row.application_command_id,'applyMethodology');
 const history={source,previous,origin};
 checkExplicitApplicationHistoryRows(projectId,ref,sourceRef,application,assignmentDraftSequence,history);
 return history;
}

export async function collectMethodologyApplicationInventory(access:AccessRepository,token:string,value:unknown,signal:AbortSignal):Promise<Row>{
 const request=readDocumentInventoryInput(value),started=performance.now();let authDeadline=Infinity,identity:AuthenticatedIdentity|undefined,metadataUsed=0;
 const check=()=>{if(signal.aborted)bad('METHODOLOGY_APPLICATION_INVENTORY_CANCELLED',409);if(performance.now()-started>=request.limits.deadlineMs||performance.now()>=authDeadline)bad('METHODOLOGY_APPLICATION_INVENTORY_DEADLINE',413);};
 async function query(db:PoolClient,sql:string,values:unknown[]=[]){
  check();const remaining=Math.floor(Math.min(request.limits.deadlineMs-(performance.now()-started),authDeadline-performance.now()));if(remaining<1)bad('METHODOLOGY_APPLICATION_INVENTORY_DEADLINE',413);
  await db.query("SELECT set_config('statement_timeout',$1,true)",[String(Math.min(2147483647,remaining))]);check();const before=performance.now(),result=await db.query(sql,values);check();return{result,before};
 }
 async function owner(db:PoolClient,actor:AuthenticatedIdentity){const scoped={query:async(sql:string,values:unknown[]) =>(await query(db,sql,values)).result}as unknown as PoolClient;const p=await projectMember(scoped,actor,request.projectId,false);if(p.id!==request.projectId||p.archived_at!==null||p.participation!=='OWNER')bad('NOT_FOUND',404);}
 async function boundary(){
  check();const observed=await access.authenticated(token,null,async(db,actor)=>{
   check();let a:AuthenticatedIdentity;try{a=identitySnapshot(actor);}catch{bad('AUTH_REQUIRED',401);}if(identity&&!same(identityKey(identity),identityKey(a!)))bad('AUTH_REQUIRED',401);
   const rows=(await query(db,"SELECT current_setting('transaction_isolation') AS isolation")).result.rows;if(rows.length!==1||rows[0]?.isolation!=='read committed')bad();await owner(db,a!);
   const clock=await query(db,'SELECT clock_timestamp() AS at'),at=clock.result.rows.length===1?clock.result.rows[0]?.at:undefined;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))bad();
   authDeadline=Math.min(authDeadline,notificationSessionDeadline(a!,at,clock.before));check();if(!identity)identity=a!;return at.toISOString();
  });check();return observed;
 }
 async function pageRows(db:PoolClient,table:Table,selection?:string[]){
  const out:Row[]=[],keys=table==='project_methodologies'?['application_version']:table==='audit_events'?['event_id']:['id'];let last:(string|number)[]|null=null;
  for(;;){
   check();const values:unknown[]=[request.projectId],conditions=['t.project_id=$1::uuid'],bind=(v:unknown)=>{values.push(v);return'$'+values.length;};
   if(table==='commands')conditions.push("t.scope_kind='PROJECT'",'t.scope_id=$1::uuid',"t.operation='applyMethodology'");
   if(table!=='project_methodologies'&&(!selection||!selection.length||selection.length>200))bad();
   if(selection)conditions.push(`t.${table==='audit_events'?'command_id':'id'}=ANY(${bind(selection)}::uuid[])`);
   if(last)conditions.push(`(${keys.map(k=>'t.'+k).join(',')})>(${last.map((v,i)=>bind(v)+(keys[i]==='application_version'?'::bigint':'::uuid')).join(',')})`);
   const remaining=request.limits.metadataBytes-metadataUsed;if(remaining<=0)bad('METHODOLOGY_APPLICATION_INVENTORY_LIMIT',413);const cap=bind(remaining);
   const sql=`WITH inventory_row AS (SELECT ${columns[table].map(k=>'t.'+k).join(',')} FROM anvil.${table} t WHERE ${conditions.join(' AND ')} ORDER BY ${keys.map(k=>'t.'+k).join(',')} LIMIT 200)
    SELECT CASE WHEN octet_length(to_jsonb(inventory_row)::text)<=${cap}::bigint THEN to_jsonb(inventory_row) ELSE NULL END AS inventory_data,
    octet_length(to_jsonb(inventory_row)::text) AS row_bytes FROM inventory_row ORDER BY ${keys.map(k=>'inventory_row.'+k).join(',')}`;
   const result=(await query(db,sql,values)).result;if(!Array.isArray(result.rows)||result.rows.length>200)bad();
   for(const raw of result.rows){
    check();const envelope=object(raw,['inventory_data','row_bytes']),size=integer(envelope.row_bytes,1);if(size>remaining||metadataUsed>request.limits.metadataBytes-size)bad('METHODOLOGY_APPLICATION_INVENTORY_LIMIT',413);
    const row=object(envelope.inventory_data,columns[table]),tuple=keys.map(k=>k==='application_version'?integer(row[k],1):row[k]);if(row.project_id!==request.projectId||tuple.some((v,i)=>keys[i]==='application_version'?false:!uuidV1(v))||last&&compare(tuple,last)<=0||selection&&!selection.includes(row[table==='audit_events'?'command_id':'id']))bad();last=tuple;metadataUsed+=size;out.push(structuredClone(row));
   }
   if(result.rows.length<200)return out;
  }
 }
 async function selectedRows(db:PoolClient,table:'commands'|'audit_events',ids:string[]){const selected=[...new Set(ids)].sort();if(selected.some(id=>!uuidV1(id)))bad();const out:Row[]=[];for(let batchStart=0;batchStart<selected.length;batchStart+=200)out.push(...await pageRows(db,table,selected.slice(batchStart,batchStart+200)));return out;}
 async function rrObservation(db:PoolClient){const rows=(await query(db,"SELECT current_setting('transaction_isolation') AS isolation,current_setting('transaction_read_only') AS read_only,pg_current_snapshot()::text AS snapshot,clock_timestamp() AS at")).result.rows;const state=rows.length===1?rows[0]:null;if(state?.isolation!=='repeatable read'||state.read_only!=='on'||typeof state.snapshot!=='string'||!/^\d+:\d+:[\d,]*$/.test(state.snapshot)||!(state.at instanceof Date)||!Number.isFinite(state.at.getTime()))bad();return{snapshot:state.snapshot,at:state.at.toISOString()};}
 try{
  await boundary();let db:PoolClient|undefined,beginSent=false,begun=false,rollbackTried=false,releaseError:Error|undefined;
  try{
   db=await access.pool.connect();check();beginSent=true;await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;check();const start=await rrObservation(db);await owner(db,identity!);
   const rows=await pageRows(db,'project_methodologies'),commandIds=rows.filter(r=>r.application_command_id!==null).map(r=>r.application_command_id);
   if(new Set(commandIds).size!==commandIds.length)bad();
   const commandRows=await selectedRows(db,'commands',commandIds),commands=new Map(commandRows.map(c=>[c.id,c]));if(commands.size!==commandIds.length)bad();
   const auditRows=await selectedRows(db,'audit_events',commandIds),auditMap=new Map<string,number>(),auditSequences=new Set<number>();
   for(const a of auditRows){const sequence=integer(a.server_sequence,1);if(!commands.has(a.command_id)||auditMap.has(a.command_id)||auditSequences.has(sequence))bad();auditMap.set(a.command_id,sequence);auditSequences.add(sequence);}if(auditMap.size!==commands.size)bad();
   const applications:Row[]=[],issues:Row[]=[],externalDependencies:Row[]=[],externalKeys=new Set<string>(),ids=new Set<string>(),usedRequests=new Set<string>();
   const safe=(v:unknown)=>{if(inspectArtifact(Buffer.from(canonicalJson(v))).state==='SUSPECTED')bad('METHODOLOGY_APPLICATION_INVENTORY_SENSITIVE_METADATA',503);};
   function external(v:Row){safe(v);const k=canonicalJson(v);if(!externalKeys.has(k)){externalKeys.add(k);externalDependencies.push(structuredClone(v));}}
   function externalRef(kind:string,value:unknown){if(!isVersionRef(value))bad();external({kind,ref:value,verification:'NOT_PERFORMED'});}
   for(const row of rows){
    check();const version=integer(row.application_version,1),previous=applications.at(-1);if(version!==applications.length+1||!uuidV1(row.id)||ids.has(row.id)||!uuidV1(row.created_by)||!digest(row.snapshot_hash)||!digest(row.source_hash))bad();ids.add(row.id);
    row.application_version=version;row.source_version=integer(row.source_version,1);const recordedAt=stamp(row.created_at),parsed=readApplicationSnapshot(request.projectId,[row]);
    if(!parsed.applicationRef||!parsed.snapshot)bad();const ref=parsed.applicationRef,previousApplicationRef=previous?.ref??null;const snapshot:Row=structuredClone(parsed.snapshot);safe(snapshot);
    // 원 snapshot의 hash는 보존한다. 구조 검사는 현재 source/form의 접근 가능성을 증명하지 않는다.
    externalRef('METHODOLOGY_VERSION',snapshot.sourceRef);
    for(const node of snapshot.graph.nodes){for(const item of[...node.inputs,...node.outputs])externalRef('FORM_VERSION',item.formRef);if(node.limitPolicyRef!==null)externalRef('LIMIT_POLICY_VERSION',node.limitPolicyRef);}
    const projection:Row={ref,snapshot,recordedAt,previousApplicationRef,provenance:row.application_command_id===null?'INITIAL_CREATION':'APPLY_COMMAND',reason:null,actor:{kind:'HUMAN'}};
    if(row.application_command_id===null){
     if(version!==1)bad();issues.push({code:'INITIAL_CREATION_EVIDENCE_NOT_COLLECTED',applicationRef:ref});
     if(snapshot.draftConfirmationRef!==undefined)external({kind:'DRAFT_CONFIRMATION',draftRef:snapshot.draftConfirmationRef.draftRef,confirmationId:snapshot.draftConfirmationRef.confirmationId,verification:'NOT_PERFORMED'});
    }else{
     if(!uuidV1(row.application_command_id))bad();const c=commands.get(row.application_command_id);if(!c||c.scope_kind!=='PROJECT'||c.scope_id!==request.projectId||c.project_id!==request.projectId||c.operation!=='applyMethodology'||c.state!=='APPLIED'||c.actor_id!==row.created_by||!uuidV1(c.client_id)||!uuidV1(c.command_id)||!uuidV1(c.operation_id)||integer(c.expected_version)!==version-1||!isVersionRef(c.policy_ref)||!uuidV1(c.authorization_receipt_id)||c.approval_consumption_id!==null||c.payload_ref!==null||!digest(c.request_hash))bad();
     integer(c.control_generation,1);const requestKey=c.actor_id+':'+c.command_id;if(usedRequests.has(requestKey))bad();usedRequests.add(requestKey);object(snapshot,['name','purpose','graph','sourceRef']);
     if(previous&&same(previous.snapshot.sourceRef,snapshot.sourceRef))bad();
     const receipt=object(c.result_ref,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt']);
     if(receipt.operationId!==c.operation_id||receipt.commandId!==c.command_id||receipt.projectId!==request.projectId||receipt.status!=='APPLIED'||receipt.targetId!==ref.id||receipt.version!==version||!Array.isArray(receipt.evidenceRefs)||receipt.evidenceRefs.length||!Array.isArray(receipt.warnings)||receipt.warnings.length||stamp(receipt.serverReceivedAt)!==recordedAt||stamp(c.completed_at)!==recordedAt)bad();
     const data=object(receipt.data,['ref','status','snapshot','reason','previousApplicationRef']);if(!same(data.ref,ref)||data.status!=='METHODOLOGY_APPLIED'||!same(data.snapshot,snapshot)||!same(data.previousApplicationRef,previousApplicationRef)||!text(data.reason))bad();safe(data);
     const original={schemaVersion:1,projectId:request.projectId,commandId:c.command_id,clientId:c.client_id,controlGeneration:integer(c.control_generation,1),operation:'applyMethodology',targetId:request.projectId,expectedVersion:integer(c.expected_version),baselineRefs:[],approvalRef:null,payload:{methodologyRef:snapshot.sourceRef,expectedApplicationVersion:integer(c.expected_version),reason:data.reason}};
     if(hash(original)!==c.request_hash)bad();projection.reason=data.reason;projection.serverSequence=auditMap.get(c.id)!;
     externalRef('POLICY_VERSION',c.policy_ref);external({kind:'AUTHORIZATION_RECEIPT',id:c.authorization_receipt_id,verification:'NOT_PERFORMED'});
    }
    applications.push({...projection,projectionHash:hash(projection)});
   }
   externalDependencies.sort((a,b)=>canonicalJson(a)<canonicalJson(b)?-1:canonicalJson(a)>canonicalJson(b)?1:0);
   const end=await rrObservation(db);if(end.snapshot!==start.snapshot)bad();const projection={projectId:request.projectId,applications,issues,externalDependencies};safe(projection);
   const result:Row={kind:'METHODOLOGY_APPLICATION_INVENTORY_V1',scope:'PROJECT_METHODOLOGY_APPLICATION_HISTORY_ONLY',...projection,observation:{snapshot:start.snapshot,startedAt:start.at,finishedAt:end.at,isolation:'repeatable read',readOnly:true,authBoundary:'START_AND_END_READ_COMMITTED'},contentHash:hash(projection),usage:{metadataBytes:0,inputBytes:0,fileCount:0},metadataComplete:issues.length===0&&externalDependencies.length===0,blobVerification:'NOT_PERFORMED',sourceVersionVerification:'NOT_PERFORMED',authorizationBindingVerification:'NOT_PERFORMED',formAvailabilityVerification:'NOT_PERFORMED',auditChainVerification:'NOT_PERFORMED',executionEvidence:'NOT_CONNECTED',fullProjectCoverage:false,restorable:false,executionAuthorized:false,dispatchPerformed:false,atomicSnapshotVerified:false};
   check();rollbackTried=true;await db.query('ROLLBACK');begun=false;beginSent=false;const releasing=db;db=undefined;releasing.release();result.observation.finishedAt=await boundary();check();
   for(let n=0;n<17;n++){const bytes=Buffer.byteLength(canonicalJson(result));if(bytes>request.limits.metadataBytes)bad('METHODOLOGY_APPLICATION_INVENTORY_LIMIT',413);if(bytes===result.usage.metadataBytes){check();return result;}result.usage.metadataBytes=bytes;}return bad();
  }catch(error){
   if(db){if(beginSent&&!begun)releaseError=new Error('METHODOLOGY_APPLICATION_INVENTORY_BEGIN_UNKNOWN');if(begun){if(rollbackTried)releaseError=new Error('METHODOLOGY_APPLICATION_INVENTORY_CLEANUP_UNKNOWN');else{rollbackTried=true;try{await db.query('ROLLBACK');begun=false;}catch{releaseError=new Error('METHODOLOGY_APPLICATION_INVENTORY_CLEANUP_UNKNOWN');}}}}
   if(releaseError)bad('METHODOLOGY_APPLICATION_INVENTORY_STORAGE_FAILED',503);throw error;
  }finally{if(db){try{db.release(releaseError);}catch{bad('METHODOLOGY_APPLICATION_INVENTORY_STORAGE_FAILED',503);}}}
 }catch(error){if(error instanceof AuthFailure&&(ownErrors.has(error)||error.message==='AUTH_REQUIRED'&&error.statusCode===401||error.message==='NOT_FOUND'&&error.statusCode===404))throw new AuthFailure(error.message,error.statusCode);throw new AuthFailure('METHODOLOGY_APPLICATION_INVENTORY_INTEGRITY_FAILED',503);}
}
