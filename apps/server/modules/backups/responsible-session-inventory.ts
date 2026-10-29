import type {PoolClient} from 'pg';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {readAssignmentDraftInput} from '../assignments/assignment-input.ts';
import {readAssignmentConfirmation} from '../assignments/assignment-confirmation-input.ts';
import {readProjectRole,readResponsibleSessionBinding} from '../assignments/responsible-sessions.ts';
import {readApprovalDetails,readApprovalDecision} from '../approvals/approval-input.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {readDocumentInventoryInput} from './document-inventory-input.ts';
type Row=Record<string,any>;
const columns={
 project_roles:'project_id role_id version content_hash snapshot_json created_by client_id command_id created_at'.split(' '),
 agent_sessions:'project_id session_id version role_id content_hash snapshot_json created_by client_id command_id created_at'.split(' '),
 role_bindings:'project_id binding_id version role_id session_id assignment_id assignment_version content_hash snapshot_json created_by client_id command_id created_at'.split(' '),
 assignment_versions:'project_id assignment_id version content_hash version_json created_by created_at'.split(' '),
 approval_consumptions:'id project_id decision_id command_id scope_digest policy_id policy_version consumed_at'.split(' '),
 approval_decisions:'id project_id request_id request_version scope_digest decision reason decided_by client_id control_generation decided_at command_id content_hash decision_json'.split(' '),
 approval_requests:'id project_id version candidate_command_id action_scope_json scope_digest details_json required_decider_ref status expires_at created_by created_at client_id command_id policy_ref content_hash request_json'.split(' '),
 commands:'id command_id scope_kind scope_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id payload_ref completed_at operation_id request_hash'.split(' '),
 authorization_receipts:'id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at'.split(' '),
 audit_events:'project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of'.split(' ')
};
type Table=keyof typeof columns;
const ownErrors=new WeakSet<AuthFailure>();
function bad(code='RESPONSIBLE_SESSION_INVENTORY_INTEGRITY_FAILED',status=503):never{const e=new AuthFailure(code,status);ownErrors.add(e);throw e;}
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


/** 책임 역할·예약 세션·binding의 내부 metadata 역사다. 현재 준비/실행/복원 권한을 발급하지 않는다. */
export async function collectResponsibleSessionInventory(access:AccessRepository,token:string,value:unknown,signal:AbortSignal):Promise<Row>{
 const request=readDocumentInventoryInput(value),started=performance.now();let authDeadline=Infinity,identity:AuthenticatedIdentity|undefined,metadataUsed=0;
 const check=()=>{if(signal.aborted)bad('RESPONSIBLE_SESSION_INVENTORY_CANCELLED',409);if(performance.now()-started>=request.limits.deadlineMs||performance.now()>=authDeadline)bad('RESPONSIBLE_SESSION_INVENTORY_DEADLINE',413);};
 async function query(db:PoolClient,sql:string,values:unknown[]=[]){
  check();const remaining=Math.floor(Math.min(request.limits.deadlineMs-(performance.now()-started),authDeadline-performance.now()));if(remaining<1)bad('RESPONSIBLE_SESSION_INVENTORY_DEADLINE',413);
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
  const out:Row[]=[],key=table==='audit_events'?'event_id':table==='project_roles'?'role_id':table==='agent_sessions'?'session_id':table==='role_bindings'?'binding_id':table==='assignment_versions'?'assignment_id':'id';let last:string|null=null,lastVersion=0;const composite=['role_bindings','assignment_versions'].includes(table);
  for(;;){
   check();const values:unknown[]=[request.projectId],conditions=[table==='authorization_receipts'?'t.scope_id=$1::uuid':'t.project_id=$1::uuid'],bind=(v:unknown)=>{values.push(v);return'$'+values.length;};
   if(table==='commands')conditions.push("t.scope_kind='PROJECT'",'t.scope_id=$1::uuid',"t.operation IN ('defineProjectRole','bindResponsibleSession','requestApproval','decideApproval')");
   if(table==='authorization_receipts')conditions.push("t.scope_kind='PROJECT'");
   if(!['project_roles','agent_sessions','role_bindings'].includes(table)&&(!selection||!selection.length||selection.length>200))bad();
   if(selection)conditions.push(table==='assignment_versions'?`(t.assignment_id::text||':'||t.version::text)=ANY(${bind(selection)}::text[])`:`t.${['audit_events','approval_consumptions'].includes(table)?'command_id':'id'}=ANY(${bind(selection)}::uuid[])`);
   if(last!==null)conditions.push(composite?`(t.${key},t.version)>(${bind(last)}::uuid,${bind(lastVersion)}::bigint)`:`t.${key}>${bind(last)}::uuid`);
   const remaining=request.limits.metadataBytes-metadataUsed;if(remaining<=0)bad('RESPONSIBLE_SESSION_INVENTORY_LIMIT',413);const cap=bind(remaining);
   const sql=`WITH inventory_row AS (SELECT ${columns[table].map(k=>'t.'+k).join(',')} FROM anvil.${table} t WHERE ${conditions.join(' AND ')} ORDER BY t.${key}${composite?',t.version':''} LIMIT 200)
    SELECT CASE WHEN octet_length(to_jsonb(inventory_row)::text)<=${cap}::bigint THEN to_jsonb(inventory_row) ELSE NULL END AS inventory_data,
    octet_length(to_jsonb(inventory_row)::text) AS row_bytes FROM inventory_row ORDER BY inventory_row.${key}${composite?',inventory_row.version':''}`;
   const result=(await query(db,sql,values)).result;if(!Array.isArray(result.rows)||result.rows.length>200)bad();
   for(const raw of result.rows){
    check();const envelope=object(raw,['inventory_data','row_bytes']),size=integer(envelope.row_bytes,1);if(size>remaining||metadataUsed>request.limits.metadataBytes-size)bad('RESPONSIBLE_SESSION_INVENTORY_LIMIT',413);
    const row=object(envelope.inventory_data,columns[table]),id=row[key],version=composite?integer(row.version,1):0;if(!uuidV1(id)||last!==null&&(id<last||id===last&&(!composite||version<=lastVersion))||(table==='authorization_receipts'?row.scope_kind!=='PROJECT'||row.scope_id!==request.projectId:row.project_id!==request.projectId)||selection&&!selection.includes(table==='assignment_versions'?row.assignment_id+':'+version:row[['audit_events','approval_consumptions'].includes(table)?'command_id':'id']))bad();
    last=id;lastVersion=version;metadataUsed+=size;out.push(structuredClone(row));
   }
   if(result.rows.length<200)return out;
  }
 }
 async function selectedRows(db:PoolClient,table:Table,ids:string[]){const selected=[...new Set(ids)].sort();if(selected.some(id=>table==='assignment_versions'?!/^[0-9a-f-]{36}:[1-9][0-9]*$/.test(id):!uuidV1(id)))bad();const out:Row[]=[];for(let batchStart=0;batchStart<selected.length;batchStart+=200)out.push(...await pageRows(db,table,selected.slice(batchStart,batchStart+200)));return out;}
 async function rrObservation(db:PoolClient){const rows=(await query(db,"SELECT current_setting('transaction_isolation') AS isolation,current_setting('transaction_read_only') AS read_only,pg_current_snapshot()::text AS snapshot,clock_timestamp() AS at")).result.rows;const state=rows.length===1?rows[0]:null;if(state?.isolation!=='repeatable read'||state.read_only!=='on'||typeof state.snapshot!=='string'||!/^\d+:\d+:[\d,]*$/.test(state.snapshot)||!(state.at instanceof Date)||!Number.isFinite(state.at.getTime()))bad();return{snapshot:state.snapshot,at:state.at.toISOString()};}
 const safe=(v:unknown)=>{if(inspectArtifact(Buffer.from(canonicalJson(v))).state==='SUSPECTED')bad('RESPONSIBLE_SESSION_INVENTORY_SENSITIVE_METADATA',503);};
 try{
  await boundary();let db:PoolClient|undefined,beginSent=false,begun=false,rollbackTried=false,releaseError:Error|undefined;
  try{
   db=await access.pool.connect();check();beginSent=true;await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;check();const start=await rrObservation(db);await owner(db,identity!);
   const roleRows=await pageRows(db,'project_roles'),sessionRows=await pageRows(db,'agent_sessions'),bindingRows=await pageRows(db,'role_bindings'),primary=[...roleRows,...bindingRows];
   const commandIds=primary.map(r=>r.command_id);if(new Set(commandIds).size!==commandIds.length)bad();
   const assignmentKeys=bindingRows.map(r=>{const ref=r.snapshot_json?.assignmentRef;if(!isVersionRef(ref))bad();return ref.id+':'+ref.version;}),assignmentRows=await selectedRows(db,'assignment_versions',assignmentKeys);
   const consumptionRows=await selectedRows(db,'approval_consumptions',commandIds),decisionRows=await selectedRows(db,'approval_decisions',consumptionRows.map(r=>r.decision_id)),requestRows=await selectedRows(db,'approval_requests',decisionRows.map(r=>r.request_id));
   const allCommandIds=[...commandIds,...requestRows.map(r=>r.command_id),...decisionRows.map(r=>r.command_id)];if(new Set(allCommandIds).size!==allCommandIds.length)bad();
   const commandRows=await selectedRows(db,'commands',allCommandIds),commands=new Map(commandRows.map(c=>[c.id,c]));if(commands.size!==allCommandIds.length)bad();
   const authIds=commandRows.map(c=>c.authorization_receipt_id);if(new Set(authIds).size!==authIds.length)bad();const authRows=await selectedRows(db,'authorization_receipts',authIds),authMap=new Map(authRows.map(a=>[a.id,a]));if(authMap.size!==authIds.length)bad();
   const auditRows=await selectedRows(db,'audit_events',allCommandIds),auditMap=new Map<string,Row>(),sequences=new Set<number>();for(const a of auditRows){const n=integer(a.server_sequence,1);if(!commands.has(a.command_id)||auditMap.has(a.command_id)||sequences.has(n))bad();a.server_sequence=n;auditMap.set(a.command_id,a);sequences.add(n);}if(auditMap.size!==commands.size)bad();
   const roles:Row[]=[],sessions:Row[]=[],bindings:Row[]=[],approvals:Row[]=[],externalDependencies:Row[]=[],externalKeys=new Set<string>(),usedRequests=new Set<string>(),usedCommands=new Set<string>();
   const roleMap=new Map<string,Row>(),sessionMap=new Map<string,Row>(),assignmentMap=new Map<string,Row>(),firstBindings=new Map<string,Row>(),lastBindings=new Map<string,Row>(),bindingRoles=new Map<string,string>();
   const usedConsumption=new Set<string>(),usedDecision=new Set<string>(),usedApprovalRequest=new Set<string>();
   function external(kind:string,ref:unknown){if(!isVersionRef(ref))bad();const item={kind,ref,verification:'NOT_PERFORMED'},key=canonicalJson(item);safe(item);if(!externalKeys.has(key)){externalKeys.add(key);externalDependencies.push(structuredClone(item));}}
   function bounded(s:unknown){safe(s);if(Buffer.byteLength(canonicalJson(s))>2097152)bad();}
   function refFor(row:Row,id:string,version=1){if(!uuidV1(id)||!digest(row.content_hash))bad();return{id,version,contentHash:row.content_hash};}
   function person(v:unknown,id:unknown){if(!uuidV1(id)||!same(object(v,['kind','userId']),{kind:'HUMAN',userId:id}))bad();}
   function push(to:Row[],v:Row){safe(v);to.push({...v,projectionHash:hash(v)});}
   const redacted={kind:'HUMAN',identity:'REDACTED'};
   function evidence(row:Row,ref:Row,payload:unknown,operation:string,target:Row|null,data:Row,reason:string,approval:Row|null=null){
    if(!uuidV1(row.created_by)||!uuidV1(row.client_id)||!uuidV1(row.command_id))bad();const c=commands.get(row.command_id),when=stamp(row.created_at),expected=target?.version??0;
    if(!c||c.project_id!==request.projectId||c.scope_kind!=='PROJECT'||c.scope_id!==request.projectId||c.operation!==operation||c.state!=='APPLIED'||c.actor_id!==row.created_by||c.client_id!==row.client_id||!uuidV1(c.command_id)||!uuidV1(c.operation_id)||!uuidV1(c.authorization_receipt_id)||!isVersionRef(c.policy_ref)||!digest(c.request_hash)||integer(c.expected_version)!==expected||usedCommands.has(c.id))bad();usedCommands.add(c.id);
    const generation=integer(c.control_generation,1),key=c.actor_id+':'+c.command_id;if(usedRequests.has(key))bad();usedRequests.add(key);
    const original={schemaVersion:1,projectId:request.projectId,commandId:c.command_id,clientId:c.client_id,controlGeneration:generation,operation,targetId:target?.id??null,expectedVersion:expected,baselineRefs:[],approvalRef:approval,payload};if(hash(original)!==c.request_hash)bad();
    if(approval===null&&(c.approval_consumption_id!==null||c.payload_ref!==null||consumptionRows.some(v=>v.command_id===c.id)))bad();
    const receipt=object(c.result_ref,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt']);
    if(receipt.commandId!==c.command_id||receipt.operationId!==c.operation_id||receipt.projectId!==request.projectId||receipt.status!=='APPLIED'||receipt.targetId!==ref.id||receipt.version!==ref.version||!same(receipt.evidenceRefs,[])||!same(receipt.warnings,[])||stamp(receipt.serverReceivedAt)!==when||stamp(c.completed_at)!==when||!same(receipt.data,{ref,...data}))bad();
    const ar=authMap.get(c.authorization_receipt_id),audit=auditMap.get(c.id),scopeDigest=hash({projectId:request.projectId,actorId:c.actor_id,clientId:c.client_id,controlGeneration:generation,requestHash:c.request_hash,policyRef:c.policy_ref,targetRef:ref});
    if(!ar||ar.command_id!==c.id||ar.scope_kind!=='PROJECT'||ar.scope_id!==request.projectId||!same(ar.subject_ref,{kind:'HUMAN',userId:c.actor_id,clientId:c.client_id})||!same(ar.policy_ref,c.policy_ref)||ar.scope_digest!==scopeDigest||ar.approval_decision_ref!==(approval?.decisionId??null))bad();stamp(ar.authorized_at);
    if(!audit||audit.command_id!==c.id||audit.project_id!==request.projectId||audit.operation_id!==c.operation_id||!same(audit.actor_ref,{kind:'HUMAN',userId:c.actor_id})||audit.client_ref!==c.client_id||!same(audit.target_ref,ref)||!same(audit.policy_ref,c.policy_ref)||!same(audit.approval_ref,approval)||audit.outcome!=='APPLIED'||audit.reason_code!==reason||audit.scope_digest!==scopeDigest||audit.source_kind!=='HUMAN_COMMAND'||audit.correction_of!==null)bad();stamp(audit.recorded_at);
    external('POLICY_VERSION',c.policy_ref);return{serverSequence:audit.server_sequence,authorizationReceiptRef:{id:ar.id,version:1,contentHash:scopeDigest},approvalMode:approval?'ONE_TIME_CONSUMED':'AUTO'};
   }
   function approvalFor(row:Row,payload:Row,target:Row|null):Row|null{
    const c=commands.get(row.command_id);if(!c)bad();const matches=consumptionRows.filter(v=>v.command_id===c.id);if(c.approval_consumption_id===null){if(matches.length||c.payload_ref!==null)bad();return null;}
    if(!uuidV1(c.approval_consumption_id)||matches.length!==1)bad();const ac=matches[0]!,d=decisionRows.find(v=>v.id===ac.decision_id),r=d&&requestRows.find(v=>v.id===d.request_id);
    if(ac.id!==c.approval_consumption_id||!d||!r||usedConsumption.has(ac.id)||usedDecision.has(d.id)||usedApprovalRequest.has(r.id))bad();usedConsumption.add(ac.id);usedDecision.add(d.id);usedApprovalRequest.add(r.id);
    const rq=object(r.request_json,['id','version','status','projectId','details','scopeDigest','requiredDecider','policyRef','requestedBy','controlGeneration','createdAt']);bounded(rq);
    const {id:rid,version:rv,status:rs,createdAt:rat,...requestBody}=rq,requestRef=refFor(r,r.id);
    if(rid!==r.id||rv!==1||rs!=='PENDING'||integer(r.version,1)!==3||r.status!=='CONSUMED'||rq.projectId!==request.projectId||hash(requestBody)!==requestRef.contentHash||stamp(rat)!==stamp(r.created_at)||!same(rq.requestedBy,{kind:'HUMAN',userId:r.created_by,clientId:r.client_id})||!same(rq.requiredDecider,{kind:'HUMAN',userId:r.created_by})||!same(rq.requiredDecider,r.required_decider_ref)||!same(rq.policyRef,r.policy_ref)||!same(rq.details,r.details_json)||rq.scopeDigest!==r.scope_digest||!same(rq.details.actionScope,r.action_scope_json)||hash(r.action_scope_json)!==r.scope_digest||stamp(r.expires_at)!==rq.details.expiresAt||rq.details.candidateCommandId!==r.candidate_command_id)bad();
    const details=readApprovalDetails(rq.details,{actorId:r.created_by,clientId:r.client_id,controlGeneration:integer(rq.controlGeneration,1),allowedOperations:['defineProjectRole','bindResponsibleSession'],now:new Date(0)}),scope=details.actionScope;
    if(r.created_by!==c.actor_id||r.client_id!==c.client_id||integer(rq.controlGeneration,1)!==integer(c.control_generation,1)||!same(r.policy_ref,c.policy_ref)||details.candidateCommandId!==c.command_id||scope.operation!==c.operation||!same(scope.targetRef,target)||scope.expectedVersion!==(target?.version??0)||scope.payloadHash!==hash(payload)||!same(c.payload_ref,{kind:'ONE_TIME_APPROVAL_SCOPE',payloadHash:scope.payloadHash,scopeDigest:r.scope_digest}))bad();
    const ds=object(d.decision_json,['id','requestId','requestVersion','requestRef','scopeDigest','decision','reason','decidedBy','controlGeneration','policyRef','decidedAt']);bounded(ds);const{id:did,decidedAt,...decisionBody}=ds,decisionRef=refFor(d,d.id);
    if(did!==d.id||hash(decisionBody)!==decisionRef.contentHash||d.decision!=='APPROVE'||ds.decision!=='APPROVE'||d.request_id!==r.id||integer(d.request_version,1)!==1||ds.requestId!==r.id||ds.requestVersion!==1||!same(ds.requestRef,requestRef)||d.scope_digest!==r.scope_digest||ds.scopeDigest!==r.scope_digest||ds.reason!==d.reason||!same(ds.decidedBy,{kind:'HUMAN',userId:d.decided_by,clientId:d.client_id})||d.decided_by!==c.actor_id||d.client_id!==c.client_id||integer(d.control_generation,1)!==integer(c.control_generation,1)||ds.controlGeneration!==integer(c.control_generation,1)||!same(ds.policyRef,c.policy_ref)||stamp(decidedAt)!==stamp(d.decided_at))bad();
    if(ac.scope_digest!==r.scope_digest||ac.policy_id!==c.policy_ref.id||integer(ac.policy_version,1)!==c.policy_ref.version||stamp(ac.consumed_at)<stamp(d.decided_at)||stamp(ac.consumed_at)>=stamp(r.expires_at))bad();
    const requestEvidence=evidence(r,requestRef,{details},'requestApproval',null,{status:'APPROVAL_REQUESTED',request:rq},'EXPLICIT_ONE_TIME_APPROVAL_REQUEST');
    const decisionInput=readApprovalDecision({requestId:r.id,expectedVersion:1,scopeDigest:r.scope_digest,decision:'APPROVE',reason:d.reason});
    const decisionEvidence=evidence({created_by:d.decided_by,client_id:d.client_id,command_id:d.command_id,created_at:d.decided_at},decisionRef,decisionInput,'decideApproval',requestRef,{status:'APPROVAL_DECIDED',decision:ds},'EXPLICIT_HUMAN_APPROVAL_DECISION');
    if(requestEvidence.serverSequence>=decisionEvidence.serverSequence||decisionEvidence.serverSequence>=auditMap.get(c.id)?.server_sequence)bad();
    const projectedRequest={...structuredClone(rq),requestedBy:redacted,requiredDecider:redacted,details:{...structuredClone(details),actionScope:{...structuredClone(scope),requestedSubjectRef:redacted}}},projectedDecision={...structuredClone(ds),decidedBy:redacted};
    push(approvals,{requestRef,decisionRef,request:projectedRequest,decision:projectedDecision,storedStatus:r.status,currentVersion:integer(r.version,1),consumption:{id:ac.id,scopeDigest:ac.scope_digest,policyRef:c.policy_ref,consumedAt:stamp(ac.consumed_at)},requestEvidence,decisionEvidence,currentPermissionVerification:'NOT_PERFORMED'});
    return{requestId:r.id,decisionId:d.id,scopeDigest:r.scope_digest};
   }
   for(const row of assignmentRows){
    const ref=refFor(row,row.assignment_id,integer(row.version,1)),s=object(row.version_json,['draftRef','definition','reviewRefs','reason','confirmedBy','confirmedAt','contentConfirmed','readinessIssues','ready','executionAuthorized','dispatchPerformed']);bounded(s);person(s.confirmedBy,row.created_by);
    if(hash(s)!==ref.contentHash||s.contentConfirmed!==true||s.ready!==false||s.executionAuthorized!==false||s.dispatchPerformed!==false||stamp(s.confirmedAt)!==stamp(row.created_at)||s.draftRef?.id!==ref.id||s.draftRef?.version!==ref.version)bad();
    readAssignmentConfirmation({draftRef:s.draftRef,reviewRefs:s.reviewRefs,reason:s.reason,acknowledged:true});const definition=readAssignmentDraftInput({baseRef:null,definition:s.definition,reason:s.reason}).input.definition;if(definition.parentAssignmentRef!==null||!Array.isArray(s.readinessIssues))bad();
    assignmentMap.set(canonicalJson(ref),s);external('ASSIGNMENT_VERSION',ref);
   }
   if(assignmentRows.length!==new Set(assignmentKeys).size)bad();
   let coordinator:Row|undefined;const stageKeys=new Set<string>();
   for(const row of roleRows){
    const ref=refFor(row,row.role_id,integer(row.version,1,1)),s=object(row.snapshot_json,['kind','stageRef','parentRoleRef','reason','definedBy','definedAt']);bounded(s);person(s.definedBy,row.created_by);if(hash(s)!==ref.contentHash||stamp(s.definedAt)!==stamp(row.created_at))bad();
    const input=readProjectRole({kind:s.kind,stageRef:s.stageRef,parentRoleRef:s.parentRoleRef,reason:s.reason}),approval=approvalFor(row,input,null),sourceEvidence=evidence(row,ref,input,'defineProjectRole',null,{status:'PROJECT_ROLE_DEFINED',snapshot:s},'EXPLICIT_PROJECT_ROLE',approval),entry={row,ref,s,sourceEvidence};
    if(input.kind==='COORDINATOR'){if(coordinator)bad();coordinator=entry;}else{const key=canonicalJson(input.stageRef);if(stageKeys.has(key))bad();stageKeys.add(key);external('METHODOLOGY_APPLICATION',input.stageRef!.applicationRef);}
    roleMap.set(canonicalJson(ref),entry);push(roles,{ref,snapshot:{...structuredClone(s),definedBy:redacted},sourceEvidence});
   }
   for(const e of roleMap.values())if(e.s.kind==='STAGE_OWNER'&&(!coordinator||!same(e.s.parentRoleRef,coordinator.ref)||coordinator.sourceEvidence.serverSequence>=e.sourceEvidence.serverSequence))bad();
   const sessionRoles=new Set<string>();for(const row of sessionRows){
    const ref=refFor(row,row.session_id,integer(row.version,1,1)),s=object(row.snapshot_json,['roleRef','connectionRef','state','externalSessionHandleRef','reservedBy','reservedAt']);bounded(s);person(s.reservedBy,row.created_by);if(hash(s)!==ref.contentHash||!isVersionRef(s.roleRef)||!isVersionRef(s.connectionRef)||!roleMap.has(canonicalJson(s.roleRef))||s.roleRef.id!==row.role_id||s.state!=='RESERVED'||s.externalSessionHandleRef!==null||stamp(s.reservedAt)!==stamp(row.created_at)||sessionRoles.has(row.role_id))bad();sessionRoles.add(row.role_id);sessionMap.set(canonicalJson(ref),{row,ref,s});external('CONNECTION_CANDIDATE',s.connectionRef);
   }
   for(const row of bindingRows){
    check();const ref=refFor(row,row.binding_id,integer(row.version,1)),s=object(row.snapshot_json,['assignmentRef','roleRef','connectionRef','existingSessionBindingRef','reason','sessionRef','generation','state','externalSessionHandleRef','connectionReadiness','executionAuthorized','dispatchPerformed','boundBy','boundAt']);bounded(s);person(s.boundBy,row.created_by);
    const input=readResponsibleSessionBinding({assignmentRef:s.assignmentRef,roleRef:s.roleRef,connectionRef:s.connectionRef,existingSessionBindingRef:s.existingSessionBindingRef,reason:s.reason});
    const role=roleMap.get(canonicalJson(input.roleRef)),session=sessionMap.get(canonicalJson(s.sessionRef)),assignment=assignmentMap.get(canonicalJson(input.assignmentRef));
    if(hash(s)!==ref.contentHash||s.generation!==ref.version||!role||!session||!assignment||row.role_id!==input.roleRef.id||row.session_id!==session.ref.id||row.assignment_id!==input.assignmentRef.id||integer(row.assignment_version,1)!==input.assignmentRef.version||!same(session.s.roleRef,input.roleRef)||!same(session.s.connectionRef,input.connectionRef)||s.state!=='RESERVED'||s.externalSessionHandleRef!==null||s.connectionReadiness!=='CANDIDATE_ONLY'||s.executionAuthorized!==false||s.dispatchPerformed!==false||stamp(s.boundAt)!==stamp(row.created_at))bad();
    if(role.s.kind==='STAGE_OWNER'&&(!same(assignment.definition.taskRef.applicationRef,role.s.stageRef.applicationRef)||assignment.definition.taskRef.nodeId!==role.s.stageRef.nodeId))bad();
    const previous=lastBindings.get(row.role_id);if(bindingRoles.has(ref.id)&&bindingRoles.get(ref.id)!==row.role_id)bad();bindingRoles.set(ref.id,row.role_id);
    if(previous?ref.id!==previous.ref.id||ref.version!==previous.ref.version+1||!same(input.existingSessionBindingRef,previous.ref)||!same(s.sessionRef,previous.s.sessionRef)||!same(input.connectionRef,previous.s.connectionRef):ref.version!==1||input.existingSessionBindingRef!==null)bad();
    const approval=approvalFor(row,input,input.existingSessionBindingRef),sourceEvidence=evidence(row,ref,input,'bindResponsibleSession',input.existingSessionBindingRef,{status:'RESPONSIBLE_SESSION_RESERVED',snapshot:s},'EXPLICIT_SESSION_RESERVATION_ONLY',approval);
    if(role.sourceEvidence.serverSequence>=sourceEvidence.serverSequence||previous&&previous.sourceEvidence.serverSequence>=sourceEvidence.serverSequence)bad();
    const entry={row,ref,s,sourceEvidence};if(!previous){if(session.row.command_id!==row.command_id||session.row.created_by!==row.created_by||session.row.client_id!==row.client_id||stamp(session.row.created_at)!==stamp(row.created_at))bad();firstBindings.set(row.role_id,entry);}else if(session.row.command_id===row.command_id)bad();lastBindings.set(row.role_id,entry);push(bindings,{ref,snapshot:{...structuredClone(s),boundBy:redacted},sourceEvidence});
   }
   for(const e of sessionMap.values()){const first=firstBindings.get(e.row.role_id);if(!first||!same(first.s.sessionRef,e.ref))bad();push(sessions,{ref:e.ref,snapshot:{...structuredClone(e.s),reservedBy:redacted},sourceEvidence:first.sourceEvidence});}
   if(usedCommands.size!==commands.size||usedConsumption.size!==consumptionRows.length||usedDecision.size!==decisionRows.length||usedApprovalRequest.size!==requestRows.length)bad();
   externalDependencies.sort((a,b)=>canonicalJson(a)<canonicalJson(b)?-1:canonicalJson(a)>canonicalJson(b)?1:0);approvals.sort((a,b)=>a.requestRef.id<b.requestRef.id?-1:a.requestRef.id>b.requestRef.id?1:0);
   const end=await rrObservation(db);if(end.snapshot!==start.snapshot)bad();const projection={kind:'RESPONSIBLE_SESSION_INVENTORY_V1',projectId:request.projectId,roles,sessions,bindings,approvals,externalDependencies};safe(projection);
   const result:Row={...projection,scope:'PROJECT_RESPONSIBLE_SESSION_HISTORY_ONLY',inventoryHash:hash(projection),observation:{snapshot:start.snapshot,startedAt:start.at,finishedAt:end.at,isolation:'repeatable read',readOnly:true,authBoundary:'START_AND_END_READ_COMMITTED'},usage:{metadataBytes:0,inputBytes:0,fileCount:0},currentConnectionVerification:'NOT_PERFORMED',currentPolicyVerification:'NOT_PERFORMED',assignmentEvidenceVerification:'NOT_PERFORMED',auditChainVerification:'NOT_PERFORMED',fullProjectCoverage:false,restorable:false,atomicSnapshotVerified:false,executionAuthorized:false,dispatchPerformed:false};
   check();rollbackTried=true;await db.query('ROLLBACK');begun=false;beginSent=false;const releasing=db;db=undefined;releasing.release();result.observation.finishedAt=await boundary();check();
   for(let n=0;n<17;n++){const bytes=Buffer.byteLength(canonicalJson(result));if(bytes>request.limits.metadataBytes)bad('RESPONSIBLE_SESSION_INVENTORY_LIMIT',413);if(bytes===result.usage.metadataBytes){check();return result;}result.usage.metadataBytes=bytes;}return bad();
  }catch(error){
   if(db){if(beginSent&&!begun)releaseError=new Error('RESPONSIBLE_SESSION_INVENTORY_BEGIN_UNKNOWN');if(begun){if(rollbackTried)releaseError=new Error('RESPONSIBLE_SESSION_INVENTORY_CLEANUP_UNKNOWN');else{rollbackTried=true;try{await db.query('ROLLBACK');begun=false;}catch{releaseError=new Error('RESPONSIBLE_SESSION_INVENTORY_CLEANUP_UNKNOWN');}}}}
   if(releaseError)bad('RESPONSIBLE_SESSION_INVENTORY_STORAGE_FAILED',503);throw error;
  }finally{if(db){try{db.release(releaseError);}catch{bad('RESPONSIBLE_SESSION_INVENTORY_STORAGE_FAILED',503);}}}
 }catch(error){if(error instanceof AuthFailure&&(ownErrors.has(error)||error.message==='AUTH_REQUIRED'&&error.statusCode===401||error.message==='NOT_FOUND'&&error.statusCode===404))throw new AuthFailure(error.message,error.statusCode);throw new AuthFailure('RESPONSIBLE_SESSION_INVENTORY_INTEGRITY_FAILED',503);}
}
