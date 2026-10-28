import type {PoolClient} from 'pg';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {notificationSessionDeadline,notificationFromRow,notificationRef} from '../notifications/notification-input.ts';
import {readApprovalDetails} from '../approvals/approval-input.ts';
import {consumableOperations} from '../approvals/project-approvals.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {readDocumentInventoryInput} from './document-inventory-input.ts';
type Row=Record<string,any>;
const columns={
 notifications:'id project_id source_command_id approval_request_id request_version request_content_hash recipient_user_id event_kind channel severity reason_code delivery_state created_at content_hash'.split(' '),
 notification_reads:'project_id notification_id recipient_user_id client_id command_id notification_content_hash read_at'.split(' '),
 approval_requests:'id project_id version candidate_command_id action_scope_json scope_digest details_json required_decider_ref status expires_at created_by created_at client_id command_id policy_ref content_hash request_json'.split(' '),
 commands:'id command_id scope_kind scope_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id payload_ref completed_at operation_id request_hash'.split(' '),
 authorization_receipts:'id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at'.split(' '),
 audit_events:'project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of'.split(' ')
};
type Table=keyof typeof columns;
const ownErrors=new WeakSet<AuthFailure>();
function bad(code='NOTIFICATION_INVENTORY_INTEGRITY_FAILED',status=503):never{const e=new AuthFailure(code,status);ownErrors.add(e);throw e;}
const hash=(value:unknown)=>contentHash(canonicalJson(value));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function object(value:unknown,keys:string[],exact=true):Row{
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return bad();
 const ds=Object.getOwnPropertyDescriptors(value),names=Reflect.ownKeys(ds);if(exact&&(names.length!==keys.length||names.some(k=>typeof k!=='string'||!keys.includes(k))))return bad();const out:Row={};
 for(const key of keys){const d=ds[key];if(!d||!d.enumerable||!Object.hasOwn(d,'value'))return bad();out[key]=d.value;}return out;
}
function integer(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):number{if(typeof v==='string'&&!/^(0|[1-9][0-9]*)$/.test(v))return bad();const n=typeof v==='number'||typeof v==='string'?Number(v):NaN;if(!Number.isSafeInteger(n)||n<min||n>max)return bad();return n;}
function stamp(v:unknown):string{
 if(!(v instanceof Date)){
  if(typeof v!=='string')return bad();
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(v);if(!m)return bad();
  const [year,month,day,hour,minute,second]=m.slice(1,7).map(Number);const calendar=new Date(0);calendar.setUTCFullYear(year!,month!-1,day!);calendar.setUTCHours(0,0,0,0);
  if(calendar.getUTCFullYear()!==year||calendar.getUTCMonth()!==month!-1||calendar.getUTCDate()!==day||hour!>23||minute!>59||second!>59||m[8]!=='Z'&&(Number(m[8]!.slice(1,3))>23||Number(m[8]!.slice(4))>59))return bad();
 }
 const d=new Date(v);if(!Number.isFinite(d.getTime()))return bad();return d.toISOString();
}
function digest(v:unknown):v is string{return typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);}
function identitySnapshot(actor:AuthenticatedIdentity):AuthenticatedIdentity{
 const a=object(actor,['actorId','clientId','credentialGeneration','authSession'],false),s=object(a.authSession,['id','idleExpiresAt','absoluteExpiresAt']);
 if(!uuidV1(a.actorId)||!uuidV1(a.clientId)||!uuidV1(s.id)||typeof s.idleExpiresAt!=='string'||typeof s.absoluteExpiresAt!=='string'||!Number.isFinite(Date.parse(s.idleExpiresAt))||!Number.isFinite(Date.parse(s.absoluteExpiresAt)))return bad('AUTH_REQUIRED',401);
 return Object.freeze({actorId:a.actorId,clientId:a.clientId,credentialGeneration:integer(a.credentialGeneration,1),serverOwner:false,reauthUntil:null,authSession:Object.freeze({id:s.id,idleExpiresAt:s.idleExpiresAt,absoluteExpiresAt:s.absoluteExpiresAt})});
}
const identityKey=(a:AuthenticatedIdentity)=>[a.actorId,a.clientId,a.credentialGeneration,a.authSession!.id];

/** 본인 수신 승인알림과 최초 읽음의 내부 metadata 관측이며 실행 권한을 발급하지 않는다. */
export async function collectNotificationInventory(access:AccessRepository,token:string,value:unknown,signal:AbortSignal):Promise<Row>{
 const request=readDocumentInventoryInput(value),started=performance.now();let authDeadline=Infinity,identity:AuthenticatedIdentity|undefined,metadataUsed=0;
 const check=()=>{if(signal.aborted)bad('NOTIFICATION_INVENTORY_CANCELLED',409);if(performance.now()-started>=request.limits.deadlineMs||performance.now()>=authDeadline)bad('NOTIFICATION_INVENTORY_DEADLINE',413);};
 async function query(db:PoolClient,sql:string,values:unknown[]=[]){
  check();const remaining=Math.floor(Math.min(request.limits.deadlineMs-(performance.now()-started),authDeadline-performance.now()));if(remaining<1)bad('NOTIFICATION_INVENTORY_DEADLINE',413);
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
  const out:Row[]=[],key=table==='notification_reads'?'notification_id':table==='audit_events'?'event_id':'id';let last:string|null=null;
  const ownTable=table==='notifications'||table==='notification_reads';
  for(;;){
   check();const values:unknown[]=[request.projectId],conditions=[table==='authorization_receipts'?'t.scope_id=$1::uuid':'t.project_id=$1::uuid'],bind=(v:unknown)=>{values.push(v);return'$'+values.length;};
   if(ownTable)conditions.push(`t.recipient_user_id=${bind(identity!.actorId)}::uuid`);
   if(table==='commands')conditions.push("t.scope_kind='PROJECT'",'t.scope_id=$1::uuid',"t.operation IN ('requestApproval','markNotificationRead')");
   if(table==='authorization_receipts')conditions.push("t.scope_kind='PROJECT'");
   if(!ownTable&&(!selection||!selection.length||selection.length>200))bad();
   if(selection)conditions.push(`t.${table==='audit_events'?'command_id':'id'}=ANY(${bind(selection)}::uuid[])`);
   if(last!==null)conditions.push(`t.${key}>${bind(last)}::uuid`);
   const remaining=request.limits.metadataBytes-metadataUsed;if(remaining<=0)bad('NOTIFICATION_INVENTORY_LIMIT',413);const cap=bind(remaining);
   const sql=`WITH inventory_row AS (SELECT ${columns[table].map(k=>'t.'+k).join(',')} FROM anvil.${table} t WHERE ${conditions.join(' AND ')} ORDER BY t.${key} LIMIT 200)
    SELECT CASE WHEN octet_length(to_jsonb(inventory_row)::text)<=${cap}::bigint THEN to_jsonb(inventory_row) ELSE NULL END AS inventory_data,
    octet_length(to_jsonb(inventory_row)::text) AS row_bytes FROM inventory_row ORDER BY inventory_row.${key}`;
   const result=(await query(db,sql,values)).result;if(!Array.isArray(result.rows)||result.rows.length>200)bad();
   for(const raw of result.rows){
    check();const envelope=object(raw,['inventory_data','row_bytes']),size=integer(envelope.row_bytes,1);if(size>remaining||metadataUsed>request.limits.metadataBytes-size)bad('NOTIFICATION_INVENTORY_LIMIT',413);
    const row=object(envelope.inventory_data,columns[table]),id=row[key];
    if(!uuidV1(id)||last!==null&&id<=last||(table==='authorization_receipts'?row.scope_kind!=='PROJECT'||row.scope_id!==request.projectId:row.project_id!==request.projectId)||ownTable&&row.recipient_user_id!==identity!.actorId||selection&&!selection.includes(row[table==='audit_events'?'command_id':'id']))bad();
    last=id;metadataUsed+=size;out.push(structuredClone(row));
   }
   if(result.rows.length<200)return out;
  }
 }
 async function selectedRows(db:PoolClient,table:Exclude<Table,'notifications'|'notification_reads'>,ids:string[]){const selected=[...new Set(ids)].sort();if(selected.some(id=>!uuidV1(id)))bad();const out:Row[]=[];for(let batchStart=0;batchStart<selected.length;batchStart+=200)out.push(...await pageRows(db,table,selected.slice(batchStart,batchStart+200)));return out;}
 async function rrObservation(db:PoolClient){const rows=(await query(db,"SELECT current_setting('transaction_isolation') AS isolation,current_setting('transaction_read_only') AS read_only,pg_current_snapshot()::text AS snapshot,clock_timestamp() AS at")).result.rows;const state=rows.length===1?rows[0]:null;if(state?.isolation!=='repeatable read'||state.read_only!=='on'||typeof state.snapshot!=='string'||!/^\d+:\d+:[\d,]*$/.test(state.snapshot)||!(state.at instanceof Date)||!Number.isFinite(state.at.getTime()))bad();return{snapshot:state.snapshot,at:state.at.toISOString()};}
 const safe=(v:unknown)=>{if(inspectArtifact(Buffer.from(canonicalJson(v))).state==='SUSPECTED')bad('NOTIFICATION_INVENTORY_SENSITIVE_METADATA',503);};
 try{
  await boundary();let db:PoolClient|undefined,beginSent=false,begun=false,rollbackTried=false,releaseError:Error|undefined;
  try{
   db=await access.pool.connect();check();beginSent=true;await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;check();const start=await rrObservation(db);await owner(db,identity!);
   // RLS 조회 문맥일 뿐 명령 실행 권한은 아니다. 본인 자료 SQL보다 먼저 설정한다.
   await query(db,"SELECT set_config('anvil.actor_id',$1,true),set_config('anvil.client_id',$2,true)",[identity!.actorId,identity!.clientId]);
   const rows=await pageRows(db,'notifications'),readRows=await pageRows(db,'notification_reads'),notificationIds=new Set(rows.map(n=>n.id));
   const readMap=new Map<string,Row>(),readCommandIds=new Set<string>();
   for(const r of readRows){if(!notificationIds.has(r.notification_id)||readMap.has(r.notification_id)||!uuidV1(r.client_id)||!uuidV1(r.command_id)||readCommandIds.has(r.command_id)||!digest(r.notification_content_hash))bad();readMap.set(r.notification_id,r);readCommandIds.add(r.command_id);stamp(r.read_at);}
   const requestIds=rows.map(n=>n.approval_request_id),originIds=rows.map(n=>n.source_command_id);if(new Set(requestIds).size!==requestIds.length||new Set(originIds).size!==originIds.length||originIds.some(id=>readCommandIds.has(id)))bad();
   const requestRows=await selectedRows(db,'approval_requests',requestIds),requests=new Map(requestRows.map(r=>[r.id,r]));if(requests.size!==requestIds.length)bad();
   const commandIds=[...originIds,...readCommandIds],commandRows=await selectedRows(db,'commands',commandIds),commands=new Map(commandRows.map(c=>[c.id,c]));if(commands.size!==commandIds.length)bad();
   const authIds=commandRows.map(c=>c.authorization_receipt_id);if(new Set(authIds).size!==authIds.length)bad();
   const authRows=await selectedRows(db,'authorization_receipts',authIds),authMap=new Map(authRows.map(a=>[a.id,a]));if(authMap.size!==authIds.length)bad();
   const auditRows=await selectedRows(db,'audit_events',commandIds),auditMap=new Map<string,Row>(),auditSequences=new Set<number>();
   for(const a of auditRows){const seq=integer(a.server_sequence,1);if(!commands.has(a.command_id)||auditMap.has(a.command_id)||auditSequences.has(seq))bad();a.server_sequence=seq;auditMap.set(a.command_id,a);auditSequences.add(seq);}if(auditMap.size!==commands.size)bad();
   const notifications:Row[]=[],issues:Row[]=[],externalDependencies:Row[]=[],externalKeys=new Set<string>(),usedRequests=new Set<string>();
   function external(item:Row){safe(item);const key=canonicalJson(item);if(!externalKeys.has(key)){externalKeys.add(key);externalDependencies.push(structuredClone(item));}}
   function externalRef(kind:string,value:unknown){if(!isVersionRef(value))bad();external({kind,ref:value,verification:'NOT_PERFORMED'});}
   function evidence(c:Row|undefined,operation:string,ref:Row,client:string){
    if(!c||c.project_id!==request.projectId||c.scope_kind!=='PROJECT'||c.scope_id!==request.projectId||c.operation!==operation||c.state!=='APPLIED'||c.actor_id!==identity!.actorId||c.client_id!==client||!uuidV1(client)||!uuidV1(c.command_id)||!uuidV1(c.operation_id)||!uuidV1(c.authorization_receipt_id)||!isVersionRef(c.policy_ref)||!digest(c.request_hash)||c.approval_consumption_id!==null||c.payload_ref!==null||integer(c.expected_version)!==(operation==='requestApproval'?0:1))bad();
    const generation=integer(c.control_generation,1),requestKey=c.actor_id+':'+c.command_id;if(usedRequests.has(requestKey))bad();usedRequests.add(requestKey);
    const receipt=object(c.result_ref,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt']);
    if(receipt.commandId!==c.command_id||receipt.operationId!==c.operation_id||receipt.projectId!==request.projectId||receipt.status!=='APPLIED'||receipt.targetId!==ref.id||receipt.version!==1||!Array.isArray(receipt.evidenceRefs)||receipt.evidenceRefs.length||!Array.isArray(receipt.warnings)||receipt.warnings.length||stamp(receipt.serverReceivedAt)!==stamp(c.completed_at))bad();
    const ar=authMap.get(c.authorization_receipt_id),audit=auditMap.get(c.id),scopeDigest=hash({projectId:request.projectId,actorId:c.actor_id,clientId:client,controlGeneration:generation,requestHash:c.request_hash,policyRef:c.policy_ref,targetRef:ref});
    if(!ar||ar.command_id!==c.id||ar.scope_kind!=='PROJECT'||ar.scope_id!==request.projectId||!same(ar.subject_ref,{kind:'HUMAN',userId:c.actor_id,clientId:client})||!same(ar.policy_ref,c.policy_ref)||ar.scope_digest!==scopeDigest||ar.approval_decision_ref!==null)bad();stamp(ar.authorized_at);
    if(!audit||audit.command_id!==c.id||audit.project_id!==request.projectId||audit.operation_id!==c.operation_id||!same(audit.actor_ref,{kind:'HUMAN',userId:c.actor_id})||audit.client_ref!==client||!same(audit.target_ref,ref)||!same(audit.policy_ref,c.policy_ref)||audit.approval_ref!==null||audit.outcome!=='APPLIED'||audit.reason_code!==(operation==='requestApproval'?'EXPLICIT_ONE_TIME_APPROVAL_REQUEST':'EXPLICIT_NOTIFICATION_READ')||audit.scope_digest!==scopeDigest||audit.source_kind!=='HUMAN_COMMAND'||audit.correction_of!==null)bad();stamp(audit.recorded_at);
    externalRef('POLICY_VERSION',c.policy_ref);external({kind:'AUTHORIZATION_RECEIPT',id:ar.id,verification:'NOT_PERFORMED'});
    return{receipt,generation,projection:{serverSequence:audit.server_sequence,authorizationReceiptRef:{id:ar.id,version:1,contentHash:scopeDigest}}};
   }
   for(const n of rows){
    check();integer(n.request_version,1,1);const read=readMap.get(n.id),dto=notificationFromRow({...n,created_at:new Date(stamp(n.created_at)),read_at:read?new Date(stamp(read.read_at)):null}),ref=notificationRef(dto),r=requests.get(n.approval_request_id),c=commands.get(n.source_command_id);
    if(!r||r.id!==dto.eventRef.requestRef.id||r.project_id!==request.projectId||r.created_by!==identity!.actorId||!uuidV1(r.client_id)||r.command_id!==n.source_command_id||!digest(r.content_hash)||r.content_hash!==dto.eventRef.requestRef.contentHash||!['PENDING','APPROVED','REJECTED','CHANGE_REQUESTED','EXPIRED','REVOKED','CONSUMED'].includes(r.status))bad();
    const observedVersion=integer(r.version,1),q=object(r.request_json,['id','version','status','projectId','details','scopeDigest','requiredDecider','policyRef','requestedBy','controlGeneration','createdAt']);
    const {id:requestId,version,status,createdAt,...snapshot}=q;
    if(requestId!==r.id||version!==1||status!=='PENDING'||stamp(createdAt)!==dto.eventRef.occurredAt||stamp(r.created_at)!==dto.eventRef.occurredAt||snapshot.projectId!==request.projectId||hash(snapshot)!==r.content_hash||!same(snapshot.requiredDecider,{kind:'HUMAN',userId:identity!.actorId})||!same(snapshot.requiredDecider,r.required_decider_ref)||!same(snapshot.requestedBy,{kind:'HUMAN',userId:identity!.actorId,clientId:r.client_id})||!same(snapshot.policyRef,r.policy_ref)||!same(snapshot.details,r.details_json)||!digest(snapshot.scopeDigest)||snapshot.scopeDigest!==r.scope_digest||hash(r.action_scope_json)!==r.scope_digest||!same(snapshot.details?.actionScope,r.action_scope_json)||snapshot.details?.candidateCommandId!==r.candidate_command_id||!uuidV1(r.candidate_command_id)||stamp(r.expires_at)!==snapshot.details?.expiresAt)bad();
    const generation=integer(snapshot.controlGeneration,1);readApprovalDetails(snapshot.details,{actorId:identity!.actorId,clientId:r.client_id,controlGeneration:generation,allowedOperations:consumableOperations,now:new Date(0)});safe(snapshot);
    const source=evidence(c,'requestApproval',dto.eventRef.requestRef,r.client_id);if(source.generation!==generation||!same(c!.policy_ref,r.policy_ref)||stamp(source.receipt.serverReceivedAt)!==dto.eventRef.occurredAt)bad();
    const sourceData=object(source.receipt.data,['ref','status','request']);if(!same(sourceData.ref,dto.eventRef.requestRef)||sourceData.status!=='APPROVAL_REQUESTED'||!same(sourceData.request,q))bad();
    let firstRead:Row|null=null;
    if(read){
     if(read.notification_content_hash!==ref.contentHash)bad();const rc=commands.get(read.command_id),seen=evidence(rc,'markNotificationRead',ref,read.client_id),data=object(seen.receipt.data,['ref','status','readAt']);
     if(!same(data.ref,ref)||data.status!=='NOTIFICATION_READ'||data.readAt!==dto.readAt)bad();
     const original={schemaVersion:1,projectId:request.projectId,commandId:rc!.command_id,clientId:rc!.client_id,controlGeneration:seen.generation,operation:'markNotificationRead',targetId:ref.id,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:{notificationRef:ref}};
     if(hash(original)!==rc!.request_hash)bad();firstRead={readAt:dto.readAt,reader:{kind:'HUMAN'},...seen.projection};
    }
    const projected=structuredClone(snapshot);projected.requiredDecider={kind:'HUMAN'};projected.requestedBy={kind:'HUMAN'};projected.details.actionScope.requestedSubjectRef={kind:'HUMAN'};
    const scope=snapshot.details.actionScope;if(scope.targetRef!==null)externalRef('REQUEST_TARGET',scope.targetRef);for(const baseline of scope.baselineRefs)externalRef('REQUEST_BASELINE',baseline);
    const projection={ref,eventRef:dto.eventRef,recipientRef:{kind:'HUMAN'},projectRef:dto.projectRef,severity:dto.severity,reason:dto.reason,authenticatedTarget:dto.authenticatedTarget,deliveryState:dto.deliveryState,request:{ref:dto.eventRef.requestRef,snapshot:projected,observedState:{version:observedVersion,status:r.status}},firstRead,sourceEvidence:source.projection};safe(projection);
    notifications.push({...projection,projectionHash:hash(projection)});
   }
   if(notifications.length)issues.push({code:'ORIGIN_COMMAND_PREIMAGE_NOT_PERFORMED'},{code:'CURRENT_APPROVAL_AND_POLICY_NOT_PERFORMED'});
   externalDependencies.sort((a,b)=>canonicalJson(a)<canonicalJson(b)?-1:canonicalJson(a)>canonicalJson(b)?1:0);
   const end=await rrObservation(db);if(end.snapshot!==start.snapshot)bad();const projection={projectId:request.projectId,notifications,issues,externalDependencies};safe(projection);
   const result:Row={kind:'NOTIFICATION_INVENTORY_V1',scope:'OWN_APPROVAL_IN_APP_NOTIFICATIONS_AND_FIRST_READS_ONLY',...projection,observation:{snapshot:start.snapshot,startedAt:start.at,finishedAt:end.at,isolation:'repeatable read',readOnly:true,authBoundary:'START_AND_END_READ_COMMITTED'},contentHash:hash(projection),usage:{metadataBytes:0,inputBytes:0,fileCount:0},metadataComplete:issues.length===0&&externalDependencies.length===0,otherRecipients:'NOT_COLLECTED',notificationSettings:'NOT_COLLECTED',repeatedReadCommands:'NOT_COLLECTED',approvalDecisionHistory:'NOT_COLLECTED',approvalConsumptionHistory:'NOT_COLLECTED',originCommandPreimageVerification:'NOT_PERFORMED',policyVerification:'NOT_PERFORMED',approvalBindingVerification:'NOT_PERFORMED',auditChainVerification:'NOT_PERFORMED',blobVerification:'NOT_PERFORMED',executionEvidence:'NOT_CONNECTED',fullProjectCoverage:false,restorable:false,executionAuthorized:false,dispatchPerformed:false,atomicSnapshotVerified:false};
   check();rollbackTried=true;await db.query('ROLLBACK');begun=false;beginSent=false;const releasing=db;db=undefined;releasing.release();result.observation.finishedAt=await boundary();check();
   for(let n=0;n<17;n++){const bytes=Buffer.byteLength(canonicalJson(result));if(bytes>request.limits.metadataBytes)bad('NOTIFICATION_INVENTORY_LIMIT',413);if(bytes===result.usage.metadataBytes){check();return result;}result.usage.metadataBytes=bytes;}return bad();
  }catch(error){
   if(db){if(beginSent&&!begun)releaseError=new Error('NOTIFICATION_INVENTORY_BEGIN_UNKNOWN');if(begun){if(rollbackTried)releaseError=new Error('NOTIFICATION_INVENTORY_CLEANUP_UNKNOWN');else{rollbackTried=true;try{await db.query('ROLLBACK');begun=false;}catch{releaseError=new Error('NOTIFICATION_INVENTORY_CLEANUP_UNKNOWN');}}}}
   if(releaseError)bad('NOTIFICATION_INVENTORY_STORAGE_FAILED',503);throw error;
  }finally{if(db){try{db.release(releaseError);}catch{bad('NOTIFICATION_INVENTORY_STORAGE_FAILED',503);}}}
 }catch(error){if(error instanceof AuthFailure&&(ownErrors.has(error)||error.message==='AUTH_REQUIRED'&&error.statusCode===401||error.message==='NOT_FOUND'&&error.statusCode===404))throw new AuthFailure(error.message,error.statusCode);throw new AuthFailure('NOTIFICATION_INVENTORY_INTEGRITY_FAILED',503);}
}
