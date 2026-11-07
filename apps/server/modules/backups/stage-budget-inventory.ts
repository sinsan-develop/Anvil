import type {PoolClient} from 'pg';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {readServerExecutionFactV1} from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import {readSyntheticQueuedCommandRecord} from '../executions/execution-command-record.ts';
import {readSyntheticInstructionQueueRecord} from '../executions/execution-instruction-queue.ts';
import {readSyntheticInstructionReservation} from '../executions/execution-instruction-store.ts';
import {readApprovalDetails,readApprovalDecision} from '../approvals/approval-input.ts';
import {readLimitPolicyInput,readRevokeLimitPolicyInput} from '../executions/runtime-policy.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {readDocumentInventoryInput} from './document-inventory-input.ts';
type Row=Record<string,any>;
const columns={
 stage_runs:'project_id id sequence input_json created_by client_id command_id created_at'.split(' '),
 queue_requests:'project_id request_id version sequence content_hash snapshot_json command_id'.split(' '),
 limit_policy_versions:'project_id policy_id version content_hash snapshot_json scope_json created_by client_id command_id created_at'.split(' '),
 usage_reservations:'project_id reservation_id version server_sequence command_id content_hash snapshot_json policy_id policy_version created_command_id'.split(' '),
 execution_commands:'project_id id version execution_id generation grant_id grant_version content_hash envelope_hash snapshot_json authorization_ref created_command_id created_at'.split(' '),
 execution_grants:'project_id id version execution_id generation content_hash snapshot_json'.split(' '),
 approval_consumptions:'id project_id decision_id command_id scope_digest policy_id policy_version consumed_at'.split(' '),
 approval_decisions:'id project_id request_id request_version scope_digest decision reason decided_by client_id control_generation decided_at command_id content_hash decision_json'.split(' '),
 approval_requests:'id project_id version candidate_command_id action_scope_json scope_digest details_json required_decider_ref status expires_at created_by created_at client_id command_id policy_ref content_hash request_json'.split(' '),
 commands:'id command_id scope_kind scope_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id payload_ref completed_at operation_id request_hash'.split(' '),
 authorization_receipts:'id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at'.split(' '),
 audit_events:'project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of'.split(' '),
};
type Table=keyof typeof columns;
const ownErrors=new WeakSet<AuthFailure>();
function bad(code='STAGE_BUDGET_INVENTORY_INTEGRITY_FAILED',status=503):never{const e=new AuthFailure(code,status);ownErrors.add(e);throw e;}
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


/** 단계 대기열·프로젝트 한도·지원 예약의 역사다. 현재 가용 예산/실행 권한이 아니다. */
export async function collectStageBudgetInventory(access:AccessRepository,token:string,value:unknown,signal:AbortSignal):Promise<Row>{
 const request=readDocumentInventoryInput(value),started=performance.now();let authDeadline=Infinity,identity:AuthenticatedIdentity|undefined,metadataUsed=0;
 const check=()=>{if(signal.aborted)bad('STAGE_BUDGET_INVENTORY_CANCELLED',409);if(performance.now()-started>=request.limits.deadlineMs||performance.now()>=authDeadline)bad('STAGE_BUDGET_INVENTORY_DEADLINE',413);};
 async function query(db:PoolClient,sql:string,values:unknown[]=[]){
  check();const remaining=Math.floor(Math.min(request.limits.deadlineMs-(performance.now()-started),authDeadline-performance.now()));if(remaining<1)bad('STAGE_BUDGET_INVENTORY_DEADLINE',413);
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
  const out:Row[]=[],keys=table==='stage_runs'?['sequence']:table==='usage_reservations'?['server_sequence']:table==='queue_requests'?['request_id','version']:table==='limit_policy_versions'?['policy_id','version']:['execution_grants','execution_commands'].includes(table)?['id','version']:[table==='audit_events'?'event_id':'id'];let last:unknown[]|null=null;
  const numeric=(k:string)=>k==='version'||k==='sequence'||k==='server_sequence',compare=(a:unknown[],b:unknown[])=>{for(let n=0;n<a.length;n++){const x=a[n]as string|number,y=b[n]as string|number;if(x<y)return-1;if(x>y)return 1;}return 0;};
  const primary=['stage_runs','queue_requests','limit_policy_versions','usage_reservations'].includes(table),by=['audit_events','approval_consumptions'].includes(table)?'command_id':table==='execution_commands'?'created_command_id':'id';
  for(;;){check();const values:unknown[]=[request.projectId],conditions=[table==='authorization_receipts'?'t.scope_id=$1::uuid':'t.project_id=$1::uuid'],bind=(v:unknown)=>{values.push(v);return'$'+values.length;};
   if(table==='commands')conditions.push("t.scope_kind='PROJECT'",'t.scope_id=$1::uuid',"t.operation IN ('startStage','cancelQueuedRequest','applyLimitPolicy','revokeLimitPolicy','queueExecutionCommand','requestApproval','decideApproval')");
   if(table==='authorization_receipts')conditions.push("t.scope_kind='PROJECT'");
   if(!primary&&(!selection||!selection.length||selection.length>200))bad();if(selection)conditions.push(`t.${by}=ANY(${bind(selection)}::uuid[])`);
   if(last)conditions.push(`(${keys.map(k=>'t.'+k).join(',')})>(${keys.map((k,i)=>bind(last![i])+(numeric(k)?'::bigint':'::uuid')).join(',')})`);
   const remaining=request.limits.metadataBytes-metadataUsed;if(remaining<=0)bad('STAGE_BUDGET_INVENTORY_LIMIT',413);const cap=bind(remaining),sql=`WITH inventory_row AS (SELECT ${columns[table].map(k=>'t.'+k).join(',')} FROM anvil.${table} t WHERE ${conditions.join(' AND ')} ORDER BY ${keys.map(k=>'t.'+k).join(',')} LIMIT 200)
    SELECT CASE WHEN octet_length(to_jsonb(inventory_row)::text)<=${cap}::bigint THEN to_jsonb(inventory_row) ELSE NULL END AS inventory_data,octet_length(to_jsonb(inventory_row)::text) AS row_bytes FROM inventory_row ORDER BY ${keys.map(k=>'inventory_row.'+k).join(',')}`;
   const result=(await query(db,sql,values)).result;if(!Array.isArray(result.rows)||result.rows.length>200)bad();
   for(const raw of result.rows){check();const e=object(raw,['inventory_data','row_bytes']),size=integer(e.row_bytes,1);if(size>remaining||metadataUsed>request.limits.metadataBytes-size)bad('STAGE_BUDGET_INVENTORY_LIMIT',413);const row=object(e.inventory_data,columns[table]),key=keys.map(k=>numeric(k)?integer(row[k],1):row[k]);
    if(keys.some((k,i)=>!numeric(k)&&!uuidV1(key[i]))||last&&compare(key,last)<=0||(table==='authorization_receipts'?row.scope_kind!=='PROJECT'||row.scope_id!==request.projectId:row.project_id!==request.projectId)||selection&&!selection.includes(row[by]))bad();last=key;metadataUsed+=size;out.push(structuredClone(row));
   }if(result.rows.length<200)return out;
  }
 }
 async function selectedRows(db:PoolClient,table:Table,ids:string[]){const selected=[...new Set(ids)].sort();if(selected.some(id=>!uuidV1(id)))bad();const out:Row[]=[];for(let batchStart=0;batchStart<selected.length;batchStart+=200)out.push(...await pageRows(db,table,selected.slice(batchStart,batchStart+200)));return out;}
 async function rrObservation(db:PoolClient){const rows=(await query(db,"SELECT current_setting('transaction_isolation') AS isolation,current_setting('transaction_read_only') AS read_only,pg_current_snapshot()::text AS snapshot,clock_timestamp() AS at")).result.rows;const state=rows.length===1?rows[0]:null;if(state?.isolation!=='repeatable read'||state.read_only!=='on'||typeof state.snapshot!=='string'||!/^\d+:\d+:[\d,]*$/.test(state.snapshot)||!(state.at instanceof Date)||!Number.isFinite(state.at.getTime()))bad();return{snapshot:state.snapshot,at:state.at.toISOString()};}
 const safe=(v:unknown)=>{if(inspectArtifact(Buffer.from(canonicalJson(v))).state==='SUSPECTED')bad('STAGE_BUDGET_INVENTORY_SENSITIVE_METADATA',503);};
 try{
  await boundary();let db:PoolClient|undefined,beginSent=false,begun=false,rollbackTried=false,releaseError:Error|undefined;
  try{
   db=await access.pool.connect();check();beginSent=true;await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;check();const start=await rrObservation(db);await owner(db,identity!);
   const stageRows=await pageRows(db,'stage_runs'),queueRows=await pageRows(db,'queue_requests'),policyRows=await pageRows(db,'limit_policy_versions'),usageRows=await pageRows(db,'usage_reservations');
   // 모델의 후속 전이와 실제 저장 생산자를 혼동하지 않는다. 미지원 행도 전체 조회 후 거절한다.
   for(const row of usageRows)if(integer(row.version,1)!==1||row.snapshot_json?.state!=='RESERVED')bad('STAGE_BUDGET_INVENTORY_UNSUPPORTED_HISTORY',503);
   const executionRows=await selectedRows(db,'execution_commands',usageRows.map(r=>r.created_command_id));
   const grantRefs=executionRows.filter(r=>r.snapshot_json?.state==='SYNTHETIC_QUEUED').map(r=>r.snapshot_json.grantRef);if(grantRefs.some(r=>!isVersionRef(r)))bad();
   const grantRows=await selectedRows(db,'execution_grants',grantRefs.map(r=>r.id));
   const primary=[...queueRows,...policyRows],primaryIds=primary.map(r=>r.command_id),executionIds=executionRows.map(r=>r.created_command_id);
   const commandIds=[...primaryIds,...executionIds];if(new Set(commandIds).size!==commandIds.length||new Set(usageRows.map(r=>r.created_command_id)).size!==usageRows.length||executionRows.length!==usageRows.length)bad();
   const consumptionRows=await selectedRows(db,'approval_consumptions',commandIds),decisionRows=await selectedRows(db,'approval_decisions',consumptionRows.map(r=>r.decision_id)),requestRows=await selectedRows(db,'approval_requests',decisionRows.map(r=>r.request_id));
   const allCommandIds=[...commandIds,...requestRows.map(r=>r.command_id),...decisionRows.map(r=>r.command_id)];if(new Set(allCommandIds).size!==allCommandIds.length)bad();
   const commandRows=await selectedRows(db,'commands',allCommandIds),commands=new Map(commandRows.map(c=>[c.id,c]));if(commands.size!==allCommandIds.length)bad();
   const authIds=commandRows.map(c=>c.authorization_receipt_id);if(new Set(authIds).size!==authIds.length)bad();const authRows=await selectedRows(db,'authorization_receipts',authIds),authMap=new Map(authRows.map(a=>[a.id,a]));if(authMap.size!==authIds.length)bad();
   const auditRows=await selectedRows(db,'audit_events',allCommandIds),auditMap=new Map<string,Row>(),sequences=new Set<number>();for(const a of auditRows){const n=integer(a.server_sequence,1);if(!commands.has(a.command_id)||auditMap.has(a.command_id)||sequences.has(n))bad();a.server_sequence=n;auditMap.set(a.command_id,a);sequences.add(n);}if(auditMap.size!==commands.size)bad();
   const stageRuns:Row[]=[],queueRequests:Row[]=[],limitPolicies:Row[]=[],usageReservations:Row[]=[],approvals:Row[]=[],externalDependencies:Row[]=[],externalKeys=new Set<string>(),usedRequests=new Set<string>(),usedCommands=new Set<string>();
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
    const details=readApprovalDetails(rq.details,{actorId:r.created_by,clientId:r.client_id,controlGeneration:integer(rq.controlGeneration,1),allowedOperations:['startStage','applyLimitPolicy','revokeLimitPolicy'],now:new Date(0)}),scope=details.actionScope;
    if(r.created_by!==c.actor_id||r.client_id!==c.client_id||integer(rq.controlGeneration,1)!==integer(c.control_generation,1)||!same(r.policy_ref,c.policy_ref)||details.candidateCommandId!==c.command_id||scope.operation!==c.operation||!same(scope.targetRef,target)||scope.expectedVersion!==(target?.version??0)||scope.payloadHash!==hash(payload)||!same(c.payload_ref,{kind:'ONE_TIME_APPROVAL_SCOPE',payloadHash:scope.payloadHash,scopeDigest:r.scope_digest}))bad();
    const ds=object(d.decision_json,['id','requestId','requestVersion','requestRef','scopeDigest','decision','reason','decidedBy','controlGeneration','policyRef','decidedAt']);bounded(ds);const{id:did,decidedAt,...decisionBody}=ds,decisionRef=refFor(d,d.id);
    if(did!==d.id||hash(decisionBody)!==decisionRef.contentHash||d.decision!=='APPROVE'||ds.decision!=='APPROVE'||d.request_id!==r.id||integer(d.request_version,1)!==1||ds.requestId!==r.id||ds.requestVersion!==1||!same(ds.requestRef,requestRef)||d.scope_digest!==r.scope_digest||ds.scopeDigest!==r.scope_digest||ds.reason!==d.reason||!same(ds.decidedBy,{kind:'HUMAN',userId:d.decided_by,clientId:d.client_id})||d.decided_by!==c.actor_id||d.client_id!==c.client_id||integer(d.control_generation,1)!==integer(c.control_generation,1)||ds.controlGeneration!==integer(c.control_generation,1)||!same(ds.policyRef,c.policy_ref)||stamp(decidedAt)!==stamp(d.decided_at))bad();
    if(ac.scope_digest!==r.scope_digest||ac.policy_id!==c.policy_ref.id||integer(ac.policy_version,1)!==c.policy_ref.version||(c.operation!=='startStage'&&(stamp(ac.consumed_at)<stamp(d.decided_at)||stamp(ac.consumed_at)>=stamp(r.expires_at))))bad();
    stamp(ac.consumed_at);
    const requestEvidence=evidence(r,requestRef,{details},'requestApproval',null,{status:'APPROVAL_REQUESTED',request:rq},'EXPLICIT_ONE_TIME_APPROVAL_REQUEST');
    const decisionInput=readApprovalDecision({requestId:r.id,expectedVersion:1,scopeDigest:r.scope_digest,decision:'APPROVE',reason:d.reason});
    const decisionEvidence=evidence({created_by:d.decided_by,client_id:d.client_id,command_id:d.command_id,created_at:d.decided_at},decisionRef,decisionInput,'decideApproval',requestRef,{status:'APPROVAL_DECIDED',decision:ds},'EXPLICIT_HUMAN_APPROVAL_DECISION');
    if(requestEvidence.serverSequence>=decisionEvidence.serverSequence||decisionEvidence.serverSequence>=auditMap.get(c.id)?.server_sequence)bad();
    const projectedRequest={...structuredClone(rq),requestedBy:redacted,requiredDecider:redacted,details:{...structuredClone(details),actionScope:{...structuredClone(scope),requestedSubjectRef:redacted}}},projectedDecision={...structuredClone(ds),decidedBy:redacted};
    push(approvals,{requestRef,decisionRef,request:projectedRequest,decision:projectedDecision,storedStatus:r.status,currentVersion:integer(r.version,1),consumption:{id:ac.id,scopeDigest:ac.scope_digest,policyRef:c.policy_ref,consumedAt:stamp(ac.consumed_at)},requestEvidence,decisionEvidence,currentPermissionVerification:'NOT_PERFORMED'});
    return{requestId:r.id,decisionId:d.id,scopeDigest:r.scope_digest};
   }
   const policyMap=new Map<string,Row>();let previousPolicy:Row|undefined;
   for(const row of policyRows){
    check();const ref=refFor(row,row.policy_id,integer(row.version,1)),s=object(row.snapshot_json,['limits','scope','reason','policyBaseVersion','state','previousRef','decidedBy','decidedAt','expiresAt','executionAuthorized','dispatchPerformed']);bounded(s);person(s.decidedBy,row.created_by);
    if(hash(s)!==ref.contentHash||!same(s.scope,row.scope_json)||s.scope.kind!=='PROJECT'||s.scope.projectId!==request.projectId||s.executionAuthorized!==false||s.dispatchPerformed!==false||s.policyBaseVersion!==ref.version-1||stamp(s.decidedAt)!==stamp(row.created_at)||!['APPLIED','REVOKED'].includes(s.state))bad();
    if(previousPolicy?(ref.id!==previousPolicy.ref.id||ref.version!==previousPolicy.ref.version+1||!same(s.previousRef,previousPolicy.ref)):(ref.version!==1||s.previousRef!==null||s.state!=='APPLIED'))bad();
    const applied=s.state==='APPLIED',payload=applied?{limits:s.limits,scope:s.scope,reason:s.reason,policyBaseVersion:s.policyBaseVersion}:{scope:s.scope,reason:s.reason,policyBaseVersion:s.policyBaseVersion};
    (applied?readLimitPolicyInput:readRevokeLimitPolicyInput)(payload);
    if(applied){if(Date.parse(stamp(s.expiresAt))!==Date.parse(stamp(s.decidedAt))+s.limits.maxElapsedMs)bad();}
    else if(!previousPolicy||previousPolicy.s.state!=='APPLIED'||!same(s.limits,previousPolicy.s.limits)||s.expiresAt!==previousPolicy.s.expiresAt)bad();
    const approval=approvalFor(row,payload,previousPolicy?.ref??null),ev=evidence(row,ref,payload,applied?'applyLimitPolicy':'revokeLimitPolicy',previousPolicy?.ref??null,{status:applied?'LIMIT_POLICY_APPLIED':'LIMIT_POLICY_REVOKED',snapshot:s},'EXPLICIT_LIMIT_POLICY_AUTHORING',approval);
    if(previousPolicy&&previousPolicy.ev.serverSequence>=ev.serverSequence)bad();previousPolicy={ref,s,ev};policyMap.set(canonicalJson(ref),previousPolicy);push(limitPolicies,{ref,snapshot:{...structuredClone(s),decidedBy:redacted},sourceEvidence:ev});
   }
   function text(v:unknown){if(typeof v!=='string'||!v.trim()||v.length>20000||!v.isWellFormed())bad();safe(v);}
   function node(v:unknown){const n=object(v,['applicationRef','nodeId']);if(!isVersionRef(n.applicationRef)||typeof n.nodeId!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(n.nodeId))bad();return n;}
   function stageInput(v:unknown){const s=object(v,['stageRef','methodologyApplicationRef','mode','startNodeRef','endBoundaryRef','baselineRefs','budgetRef','reason']);bounded(s);text(s.reason);
    if(!isVersionRef(s.methodologyApplicationRef)||!isVersionRef(s.budgetRef)||!['AUTO','CASE_BY_CASE'].includes(s.mode)||!Array.isArray(s.baselineRefs)||!s.baselineRefs.length||s.baselineRefs.length>200||!s.baselineRefs.every(isVersionRef)||new Set(s.baselineRefs.map(canonicalJson)).size!==s.baselineRefs.length)bad();
    for(const n of[s.stageRef,s.startNodeRef,s.endBoundaryRef])if(!same(node(n).applicationRef,s.methodologyApplicationRef))bad();if(!same(s.stageRef,s.startNodeRef)||s.mode==='CASE_BY_CASE'&&!same(s.startNodeRef,s.endBoundaryRef))bad();return s;
   }
   function human(v:unknown){const h=object(v,['kind','userId','clientId']);if(h.kind!=='HUMAN'||!uuidV1(h.userId)||!uuidV1(h.clientId))bad();return h;}
   const stages=new Map<string,Row>();let stageSequence=0;
   for(const row of stageRows){if(!uuidV1(row.id)||stages.has(row.id)||integer(row.sequence,1)!==++stageSequence||!uuidV1(row.command_id)||!uuidV1(row.created_by)||!uuidV1(row.client_id))bad();stageInput(row.input_json);stamp(row.created_at);stages.set(row.id,row);}
   const lastQueue=new Map<string,Row>();
   for(const row of queueRows){
    check();const ref=refFor(row,row.request_id,integer(row.version,1,2)),s=object(row.snapshot_json,['projectId','requestId','version','sequence','state','input','assignmentRef','readinessIssues','queuedAt','cancelledAt','cancelledBy','cancellationReason','requestedBy','previousRef','slotReserved','writerReservationPerformed','executionAuthorized','dispatchPerformed']);bounded(s);const run=stages.get(ref.id),prior=lastQueue.get(ref.id),input=stageInput(s.input),who=human(s.requestedBy);
    if(!run||s.projectId!==request.projectId||s.requestId!==ref.id||s.version!==ref.version||s.sequence!==integer(row.sequence,1)||s.sequence!==integer(run.sequence,1)||hash(s)!==ref.contentHash||!same(s.input,run.input_json)||who.userId!==run.created_by||who.clientId!==run.client_id||stamp(s.queuedAt)!==stamp(run.created_at)||s.assignmentRef!==null||!same(s.readinessIssues,['ASSIGNMENT_BINDING_UNVERIFIED','BASELINE_STATE_UNVERIFIED','EXECUTION_STATE_UNVERIFIED','DISPATCH_NOT_CONNECTED'])||['slotReserved','writerReservationPerformed','executionAuthorized','dispatchPerformed'].some(k=>s[k]!==false))bad();
    const budget=policyMap.get(canonicalJson(input.budgetRef));if(!budget||budget.s.state!=='APPLIED'||Date.parse(stamp(budget.s.expiresAt))<=Date.parse(stamp(s.queuedAt)))bad();
    let actor:Row,payload:Row,operation:string,reason:string,target:Row|null;
    if(!prior){if(ref.version!==1||s.state!=='WAITING'||s.previousRef!==null||s.cancelledAt!==null||s.cancelledBy!==null||s.cancellationReason!==null||row.command_id!==run.command_id)bad();actor=who;payload=input;operation='startStage';reason='EXPLICIT_STAGE_QUEUE_WAITING';target=null;}
    else{actor=human(s.cancelledBy);text(s.cancellationReason);if(ref.version!==2||prior.ref.version!==1||s.state!=='CANCELLED'||!same(s.previousRef,prior.ref)||Date.parse(stamp(s.cancelledAt))<Date.parse(stamp(s.queuedAt)))bad();
     const expected={...prior.s,version:2,state:'CANCELLED',cancelledAt:s.cancelledAt,cancelledBy:s.cancelledBy,cancellationReason:s.cancellationReason,previousRef:prior.ref};if(!same(expected,s))bad();payload={requestRef:prior.ref,reason:s.cancellationReason};operation='cancelQueuedRequest';reason='EXPLICIT_UNSTARTED_QUEUE_CANCELLATION';target=prior.ref;}
    const c=commands.get(row.command_id);if(!c)bad();const ownerRow={created_by:actor.userId,client_id:actor.clientId,command_id:row.command_id,created_at:c.completed_at};
    const approval=operation==='startStage'?approvalFor(ownerRow,payload,target):null,ev=evidence(ownerRow,ref,payload,operation,target,{queueState:s.state,snapshot:s},reason,approval);if(prior&&prior.ev.serverSequence>=ev.serverSequence)bad();
    lastQueue.set(ref.id,{ref,s,ev});push(queueRequests,{ref,snapshot:{...structuredClone(s),requestedBy:redacted,cancelledBy:s.cancelledBy===null?null:redacted},sourceEvidence:ev});
    if(ref.version===1)push(stageRuns,{id:run.id,sequence:s.sequence,queueRef:ref,input:structuredClone(input),inputHash:hash(input),createdAt:stamp(run.created_at),createdBy:redacted,sourceEvidence:ev});external('METHODOLOGY_APPLICATION',input.methodologyApplicationRef);for(const br of input.baselineRefs)external('BASELINE_VERSION',br);
   }
   if(lastQueue.size!==stages.size)bad();stageRuns.sort((a,b)=>a.sequence-b.sequence);
   const grants=new Map<string,Row>();for(const row of grantRows){const ref=refFor(row,row.id,integer(row.version,1,1));if(!grantRefs.some(r=>same(r,ref))||grants.has(canonicalJson(ref)))bad();const s=object(row.snapshot_json,['kind','state','transport','binding','allowedOperations','expiresAt','scopeDigest','factHash','plannedAt','executionAuthorized','dispatchPerformed']);bounded(s);const f=readServerExecutionFactV1(s.binding);
    if(hash(s)!==ref.contentHash||s.kind!=='EXECUTION'||s.state!=='SYNTHETIC_PLAN'||s.transport!=='SYNTHETIC_ONLY'||hash(f)!==s.factHash||s.scopeDigest!==hash({binding:f,allowedOperations:s.allowedOperations,expiresAt:s.expiresAt})||!same(s.allowedOperations,['START_SESSION','SEND_INSTRUCTION','REQUEST_STOP'])||s.executionAuthorized!==false||s.dispatchPerformed!==false||f.projectId!==request.projectId||f.executionId!==row.execution_id||f.executionGeneration!==integer(row.generation,1))bad();stamp(s.expiresAt);stamp(s.plannedAt);grants.set(canonicalJson(ref),{ref,s,f});}
   if(grants.size!==new Set(grantRefs.map(canonicalJson)).size)bad();
   const executions=new Map(executionRows.map(r=>[r.created_command_id,r])),usedUsage=new Set<string>();let usageSequence=0;
   for(const row of usageRows){
    check();const ref=refFor(row,row.reservation_id,integer(row.version,1,1)),s=object(row.snapshot_json,['sequence','claim','state','usage','previousRef','checkedAt','evidenceRef','executionAuthorized','dispatchPerformed']),claim=object(s.claim,['projectId','executionId','executionGeneration','commandId','assignmentRef','stageRef','policyRef','operation','demand']),demand=object(claim.demand,['attempts','calls','spoolBytes','cost','costStatus']);bounded(s);const sequence=integer(row.server_sequence,1);
    if(hash(s)!==ref.contentHash||sequence!==++usageSequence||s.sequence!==sequence||s.state!=='RESERVED'||s.usage!==null||s.previousRef!==null||s.evidenceRef!==null||s.executionAuthorized!==false||s.dispatchPerformed!==false||claim.projectId!==request.projectId||!uuidV1(claim.executionId)||!uuidV1(claim.commandId)||row.command_id!==claim.commandId||usedUsage.has(claim.commandId)||!isVersionRef(claim.assignmentRef)||!isVersionRef(claim.policyRef)||row.policy_id!==claim.policyRef.id||integer(row.policy_version,1)!==claim.policyRef.version||!['START_SESSION','SEND_INSTRUCTION'].includes(claim.operation))bad();usedUsage.add(claim.commandId);integer(claim.executionGeneration,1);
    object(claim.stageRef,['applicationRef','nodeId']);if(!isVersionRef(claim.stageRef.applicationRef)||typeof claim.stageRef.nodeId!=='string'||!claim.stageRef.nodeId.trim()||integer(demand.attempts)!==(claim.operation==='START_SESSION'?1:0))bad();integer(demand.calls,1);integer(demand.spoolBytes);
    if(demand.costStatus==='VERIFIED_NO_CHARGE'){if(demand.cost!==null)bad();}else{const cost=object(demand.cost,['amount','currency']);if(demand.costStatus!=='FINITE_CAP'||typeof cost.amount!=='number'||!Number.isFinite(cost.amount)||cost.amount<0||cost.amount>Number.MAX_SAFE_INTEGER||typeof cost.currency!=='string'||!/^[A-Z]{3}$/.test(cost.currency))bad();}
    const budget=policyMap.get(canonicalJson(claim.policyRef)),checkedAt=stamp(s.checkedAt);if(!budget||budget.s.state!=='APPLIED'||Date.parse(checkedAt)<Date.parse(stamp(budget.s.decidedAt))||Date.parse(checkedAt)>=Date.parse(stamp(budget.s.expiresAt)))bad();
    const er=executions.get(row.created_command_id),c=commands.get(row.created_command_id);if(!er||!c||c.command_id!==row.command_id||er.execution_id!==claim.executionId||integer(er.generation,1)!==claim.executionGeneration)bad();
    const commandRef=refFor(er,er.id,integer(er.version,1,1)),scope={projectId:request.projectId,executionId:claim.executionId,executionGeneration:claim.executionGeneration};let record:Row,intent:Row,payload:Row,target:Row|null,status:string,reason:string,fact:Row;
    if(claim.operation==='START_SESSION'){
     record=readSyntheticQueuedCommandRecord({ref:commandRef,snapshot:er.snapshot_json},scope) as unknown as Row;const q=record.snapshot,g=grants.get(canonicalJson(q.grantRef));if(!g)bad();fact=g.f;const{envelope:_,...i}=q;intent=i;
     payload={preparationRef:fact.preparationRef,executionId:scope.executionId,executionGeneration:scope.executionGeneration,permissionPolicyRef:fact.permissionPolicyRef,budgetPolicyRef:q.budgetPolicyRef,operation:'START_SESSION',payload:q.payload};target=null;status='SYNTHETIC_QUEUE_STORED';reason='EXPLICIT_SYNTHETIC_QUEUE_ONLY';
     if(!same(q.budgetPolicyRef,claim.policyRef)||!same(fact.budgetReservationRef,ref)||!same(fact.intent.budgetPolicyRef,claim.policyRef)||q.humanSessionId!==fact.subject.humanSessionId||!same(q.executorRegistrationRef,fact.registration.ref)||!same(q.payload.contextBundleRef,fact.intent.contextBundleRef)||!same(q.sourceScopes,fact.intent.sourceScopes)||q.queuedAt!==g.s.plannedAt)bad();
    }else{
     record=readSyntheticInstructionQueueRecord({ref:commandRef,snapshot:er.snapshot_json},scope) as unknown as Row;readSyntheticInstructionReservation({ref,snapshot:s} as any,record as any);const q=record.snapshot,{request:_,envelope:__,...i}=q;intent=i;fact=q.currentBinding.fact;payload=q.request.payload;target={id:scope.executionId,version:scope.executionGeneration};status='SYNTHETIC_INSTRUCTION_QUEUE_STORED';reason='EXPLICIT_SYNTHETIC_INSTRUCTION_ONLY';
     if(!same(fact.intent.budgetPolicyRef,claim.policyRef)||q.request.commandId!==c.command_id||q.request.clientId!==c.client_id||q.request.controlGeneration!==integer(c.control_generation,1)||q.request.operation!=='queueExecutionCommand'||q.request.targetId!==target.id||q.request.expectedVersion!==target.version||q.request.approvalRef!==null||!same(q.request.baselineRefs,[]))bad();
    }
    const q=record.snapshot,grantRef=q.grantRef??q.currentBinding.grantRef;if(er.grant_id!==grantRef.id||integer(er.grant_version,1)!==grantRef.version||!same(q.reservationRef,ref)||!same(claim.assignmentRef,fact.intent.assignmentRef)||!same(c.policy_ref,fact.permissionPolicyRef)||c.actor_id!==fact.subject.userId||c.client_id!==fact.subject.clientId||integer(c.control_generation,1)!==fact.subject.controlGeneration||q.envelope.commandId!==c.command_id||er.envelope_hash!==q.envelope.envelopeHash)bad();
    const ev=evidence({created_by:c.actor_id,client_id:c.client_id,command_id:c.id,created_at:er.created_at},commandRef,payload,'queueExecutionCommand',target,{status,snapshot:intent,executionAuthorized:false,dispatchPerformed:false},reason);
    if(!same(er.authorization_ref,ev.authorizationReceiptRef)||!same(q.envelope.context.authorizationReceiptRef,ev.authorizationReceiptRef))bad();
    const{commandId:_,...publicClaim}=claim;push(usageReservations,{ref,snapshot:{...structuredClone(s),claim:structuredClone(publicClaim)},sourceEvidence:ev,executionCommandRef:commandRef});external('ASSIGNMENT_VERSION',claim.assignmentRef);external('METHODOLOGY_APPLICATION',claim.stageRef.applicationRef);external('EXECUTION_COMMAND',commandRef);
   }
   if(usedCommands.size!==commands.size||usedConsumption.size!==consumptionRows.length||usedDecision.size!==decisionRows.length||usedApprovalRequest.size!==requestRows.length)bad();
   externalDependencies.sort((a,b)=>canonicalJson(a)<canonicalJson(b)?-1:canonicalJson(a)>canonicalJson(b)?1:0);approvals.sort((a,b)=>a.requestRef.id<b.requestRef.id?-1:a.requestRef.id>b.requestRef.id?1:0);
   const end=await rrObservation(db);if(end.snapshot!==start.snapshot)bad();const projection={kind:'STAGE_BUDGET_INVENTORY_V1',projectId:request.projectId,stageRuns,queueRequests,limitPolicies,usageReservations,approvals,externalDependencies};safe(projection);
   const result:Row={...projection,inventoryHash:hash(projection),observation:{snapshot:start.snapshot,startedAt:start.at,finishedAt:end.at,isolation:'repeatable read',readOnly:true,authBoundary:'START_AND_END_READ_COMMITTED'},usage:{metadataBytes:0,inputBytes:0,fileCount:0},currentPolicyVerification:'NOT_PERFORMED',currentBudgetAvailability:'NOT_PERFORMED',providerChargesVerification:'NOT_PERFORMED',executionGraphVerification:'NOT_PERFORMED',auditChainVerification:'NOT_PERFORMED',usageTransitionPersistence:'NOT_IMPLEMENTED',authorizationRestoration:false,executionAuthorized:false,dispatchPerformed:false,slotReserved:false,writerReservationPerformed:false,fullProjectCoverage:false,restorable:false,atomicSnapshotVerified:false};
   check();rollbackTried=true;await db.query('ROLLBACK');begun=false;beginSent=false;const releasing=db;db=undefined;releasing.release();result.observation.finishedAt=await boundary();check();
   for(let n=0;n<17;n++){const bytes=Buffer.byteLength(canonicalJson(result));if(bytes>request.limits.metadataBytes)bad('STAGE_BUDGET_INVENTORY_LIMIT',413);if(bytes===result.usage.metadataBytes){check();return result;}result.usage.metadataBytes=bytes;}return bad();
  }catch(error){
   if(db){if(beginSent&&!begun)releaseError=new Error('STAGE_BUDGET_INVENTORY_BEGIN_UNKNOWN');if(begun){if(rollbackTried)releaseError=new Error('STAGE_BUDGET_INVENTORY_CLEANUP_UNKNOWN');else{rollbackTried=true;try{await db.query('ROLLBACK');begun=false;}catch{releaseError=new Error('STAGE_BUDGET_INVENTORY_CLEANUP_UNKNOWN');}}}}
   if(releaseError)bad('STAGE_BUDGET_INVENTORY_STORAGE_FAILED',503);throw error;
  }finally{if(db){try{db.release(releaseError);}catch{bad('STAGE_BUDGET_INVENTORY_STORAGE_FAILED',503);}}}
 }catch(error){if(error instanceof AuthFailure&&(ownErrors.has(error)||error.message==='AUTH_REQUIRED'&&error.statusCode===401||error.message==='NOT_FOUND'&&error.statusCode===404))throw new AuthFailure(error.message,error.statusCode);throw new AuthFailure('STAGE_BUDGET_INVENTORY_INTEGRITY_FAILED',503);}
}
