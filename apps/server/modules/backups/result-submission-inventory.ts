import type {PoolClient} from 'pg';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {readSubmittedResultRecord} from '../results/result-submission-store.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {readDocumentInventoryInput} from './document-inventory-input.ts';
type Row=Record<string,any>;
const columns={
 result_submissions:'project_id id execution_id generation assignment_ref execution_ref manifest_ref manifest_hash submission_state submitted_by client_id command_id content_hash snapshot_json submitted_at'.split(' '),
 commands:'id command_id scope_kind scope_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id payload_ref completed_at operation_id request_hash'.split(' '),
 authorization_receipts:'id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at'.split(' '),
 audit_events:'project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of'.split(' ')
};
type Table=keyof typeof columns;
const ownErrors=new WeakSet<AuthFailure>();
function bad(code='RESULT_SUBMISSION_INVENTORY_INTEGRITY_FAILED',status=503):never{const e=new AuthFailure(code,status);ownErrors.add(e);throw e;}
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


/** 결과제출 주장의 내부 metadata 역사다. 실제 검수/실행/복원 권한을 발급하지 않는다. */
export async function collectResultSubmissionInventory(access:AccessRepository,token:string,value:unknown,signal:AbortSignal):Promise<Row>{
 const request=readDocumentInventoryInput(value),started=performance.now();let authDeadline=Infinity,identity:AuthenticatedIdentity|undefined,metadataUsed=0;
 const check=()=>{if(signal.aborted)bad('RESULT_SUBMISSION_INVENTORY_CANCELLED',409);if(performance.now()-started>=request.limits.deadlineMs||performance.now()>=authDeadline)bad('RESULT_SUBMISSION_INVENTORY_DEADLINE',413);};
 async function query(db:PoolClient,sql:string,values:unknown[]=[]){
  check();const remaining=Math.floor(Math.min(request.limits.deadlineMs-(performance.now()-started),authDeadline-performance.now()));if(remaining<1)bad('RESULT_SUBMISSION_INVENTORY_DEADLINE',413);
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
  const out:Row[]=[],key=table==='audit_events'?'event_id':'id';let last:string|null=null;
  for(;;){
   check();const values:unknown[]=[request.projectId],conditions=[table==='authorization_receipts'?'t.scope_id=$1::uuid':'t.project_id=$1::uuid'],bind=(v:unknown)=>{values.push(v);return'$'+values.length;};
   if(table==='commands')conditions.push("t.scope_kind='PROJECT'",'t.scope_id=$1::uuid',"t.operation='submitResult'");
   if(table==='authorization_receipts')conditions.push("t.scope_kind='PROJECT'");
   if(table!=='result_submissions'&&(!selection||!selection.length||selection.length>200))bad();
   if(selection)conditions.push(`t.${table==='audit_events'?'command_id':'id'}=ANY(${bind(selection)}::uuid[])`);
   if(last!==null)conditions.push(`t.${key}>${bind(last)}::uuid`);
   const remaining=request.limits.metadataBytes-metadataUsed;if(remaining<=0)bad('RESULT_SUBMISSION_INVENTORY_LIMIT',413);const cap=bind(remaining);
   const sql=`WITH inventory_row AS (SELECT ${columns[table].map(k=>'t.'+k).join(',')} FROM anvil.${table} t WHERE ${conditions.join(' AND ')} ORDER BY t.${key} LIMIT 200)
    SELECT CASE WHEN octet_length(to_jsonb(inventory_row)::text)<=${cap}::bigint THEN to_jsonb(inventory_row) ELSE NULL END AS inventory_data,
    octet_length(to_jsonb(inventory_row)::text) AS row_bytes FROM inventory_row ORDER BY inventory_row.${key}`;
   const result=(await query(db,sql,values)).result;if(!Array.isArray(result.rows)||result.rows.length>200)bad();
   for(const raw of result.rows){
    check();const envelope=object(raw,['inventory_data','row_bytes']),size=integer(envelope.row_bytes,1);if(size>remaining||metadataUsed>request.limits.metadataBytes-size)bad('RESULT_SUBMISSION_INVENTORY_LIMIT',413);
    const row=object(envelope.inventory_data,columns[table]),id=row[key];if(!uuidV1(id)||last!==null&&id<=last||(table==='authorization_receipts'?row.scope_kind!=='PROJECT'||row.scope_id!==request.projectId:row.project_id!==request.projectId)||selection&&!selection.includes(row[table==='audit_events'?'command_id':'id']))bad();
    last=id;metadataUsed+=size;out.push(structuredClone(row));
   }
   if(result.rows.length<200)return out;
  }
 }
 async function selectedRows(db:PoolClient,table:Exclude<Table,'result_submissions'>,ids:string[]){const selected=[...new Set(ids)].sort();if(selected.some(id=>!uuidV1(id)))bad();const out:Row[]=[];for(let batchStart=0;batchStart<selected.length;batchStart+=200)out.push(...await pageRows(db,table,selected.slice(batchStart,batchStart+200)));return out;}
 async function rrObservation(db:PoolClient){const rows=(await query(db,"SELECT current_setting('transaction_isolation') AS isolation,current_setting('transaction_read_only') AS read_only,pg_current_snapshot()::text AS snapshot,clock_timestamp() AS at")).result.rows;const state=rows.length===1?rows[0]:null;if(state?.isolation!=='repeatable read'||state.read_only!=='on'||typeof state.snapshot!=='string'||!/^\d+:\d+:[\d,]*$/.test(state.snapshot)||!(state.at instanceof Date)||!Number.isFinite(state.at.getTime()))bad();return{snapshot:state.snapshot,at:state.at.toISOString()};}
 const safe=(v:unknown)=>{if(inspectArtifact(Buffer.from(canonicalJson(v))).state==='SUSPECTED')bad('RESULT_SUBMISSION_INVENTORY_SENSITIVE_METADATA',503);};
 try{
  await boundary();let db:PoolClient|undefined,beginSent=false,begun=false,rollbackTried=false,releaseError:Error|undefined;
  try{
   db=await access.pool.connect();check();beginSent=true;await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;check();const start=await rrObservation(db);await owner(db,identity!);
   const rows=await pageRows(db,'result_submissions'),commandIds=rows.map(r=>r.command_id);if(new Set(commandIds).size!==commandIds.length)bad();
   const commandRows=await selectedRows(db,'commands',commandIds),commands=new Map(commandRows.map(c=>[c.id,c]));if(commands.size!==commandIds.length)bad();
   const authIds=commandRows.map(c=>c.authorization_receipt_id);if(new Set(authIds).size!==authIds.length)bad();const authRows=await selectedRows(db,'authorization_receipts',authIds),authMap=new Map(authRows.map(a=>[a.id,a]));if(authMap.size!==authIds.length)bad();
   const auditRows=await selectedRows(db,'audit_events',commandIds),auditMap=new Map<string,Row>(),auditSequences=new Set<number>();
   for(const a of auditRows){const seq=integer(a.server_sequence,1);if(!commands.has(a.command_id)||auditMap.has(a.command_id)||auditSequences.has(seq))bad();a.server_sequence=seq;auditMap.set(a.command_id,a);auditSequences.add(seq);}if(auditMap.size!==commands.size)bad();
   const submissions:Row[]=[],issues:Row[]=[],externalDependencies:Row[]=[],externalKeys=new Set<string>(),usedRequests=new Set<string>();
   function external(item:Row){safe(item);const key=canonicalJson(item);if(!externalKeys.has(key)){externalKeys.add(key);externalDependencies.push(structuredClone(item));}}
   function externalRef(kind:string,value:unknown){if(!isVersionRef(value))bad();external({kind,ref:value,verification:'NOT_PERFORMED'});}
   for(const row of rows){
    check();if(!uuidV1(row.execution_id)||!uuidV1(row.submitted_by)||!uuidV1(row.client_id)||!uuidV1(row.command_id)||!digest(row.content_hash)||!digest(row.manifest_hash))bad();
    const generation=integer(row.generation,1),raw=object(row.snapshot_json,['transport','scope','submittedByRef','authorizationReceiptRef','manifest','manifestHash','submittedAt','sourceKind','evidenceProvenanceVerified','completionAccepted','formalFailureCounted','executionAuthorized','dispatchPerformed']);safe(raw);
    const scope=object(raw.scope,['projectId','assignmentRef','executionRef']);if(scope.projectId!==request.projectId||!isVersionRef(scope.assignmentRef)||!isVersionRef(scope.executionRef))bad();
    // 순수 저장 parser만 소비한다. 현재 실행/assignment/검수 상태를 재조회하지 않는다.
    const entry=readSubmittedResultRecord({ref:{id:row.id,version:1,contentHash:row.content_hash},snapshot:raw},{projectId:request.projectId,assignmentRef:scope.assignmentRef,executionRef:scope.executionRef},row.id,start.at),snapshot=entry.snapshot,manifest=snapshot.manifest;
    const manifestRef={id:row.id,version:1,contentHash:row.manifest_hash};
    if(row.execution_id!==scope.executionRef.id||generation!==scope.executionRef.version||!same(row.assignment_ref,scope.assignmentRef)||!same(row.execution_ref,scope.executionRef)||!same(row.manifest_ref,manifestRef)||snapshot.manifestHash!==row.manifest_hash||hash(manifest)!==row.manifest_hash||row.submission_state!==manifest.submissionState||row.submitted_by!==snapshot.submittedByRef.id||stamp(row.submitted_at)!==snapshot.submittedAt)bad();
    const c=commands.get(row.command_id);if(!c||c.project_id!==request.projectId||c.scope_kind!=='PROJECT'||c.scope_id!==request.projectId||c.operation!=='submitResult'||c.state!=='APPLIED'||c.actor_id!==row.submitted_by||c.client_id!==row.client_id||!uuidV1(c.command_id)||!uuidV1(c.operation_id)||!uuidV1(c.authorization_receipt_id)||!isVersionRef(c.policy_ref)||!digest(c.request_hash)||integer(c.expected_version)!==0||c.approval_consumption_id!==null||c.payload_ref!==null)bad();
    const controlGeneration=integer(c.control_generation,1),requestKey=c.actor_id+':'+c.command_id;if(usedRequests.has(requestKey))bad();usedRequests.add(requestKey);
    const original={schemaVersion:1,projectId:request.projectId,commandId:c.command_id,clientId:c.client_id,controlGeneration,operation:'submitResult',targetId:row.id,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{scope:snapshot.scope,submissionId:row.id,manifest}};
    if(hash(original)!==c.request_hash)bad();
    const receipt=object(c.result_ref,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt']);
    if(receipt.commandId!==c.command_id||receipt.operationId!==c.operation_id||receipt.projectId!==request.projectId||receipt.status!=='APPLIED'||receipt.targetId!==row.id||receipt.version!==1||!Array.isArray(receipt.evidenceRefs)||receipt.evidenceRefs.length||!Array.isArray(receipt.warnings)||receipt.warnings.length||stamp(receipt.serverReceivedAt)!==snapshot.submittedAt||stamp(c.completed_at)!==snapshot.submittedAt)bad();
    const data=object(receipt.data,['ref','status','manifest','sourceKind','completionAccepted','executionAuthorized','dispatchPerformed']);
    if(!same(data.ref,manifestRef)||data.status!=='RESULT_SUBMITTED'||!same(data.manifest,manifest)||data.sourceKind!=='WORKER_CLAIM'||data.completionAccepted!==false||data.executionAuthorized!==false||data.dispatchPerformed!==false)bad();
    const ar=authMap.get(c.authorization_receipt_id),audit=auditMap.get(c.id),scopeDigest=hash({projectId:request.projectId,actorId:c.actor_id,clientId:c.client_id,controlGeneration,requestHash:c.request_hash,policyRef:c.policy_ref,targetRef:manifestRef});
    if(!ar||ar.command_id!==c.id||ar.scope_kind!=='PROJECT'||ar.scope_id!==request.projectId||!same(ar.subject_ref,{kind:'HUMAN',userId:c.actor_id,clientId:c.client_id})||!same(ar.policy_ref,c.policy_ref)||ar.scope_digest!==scopeDigest||ar.approval_decision_ref!==null||!same(snapshot.authorizationReceiptRef,{id:ar.id,version:1,contentHash:scopeDigest}))bad();stamp(ar.authorized_at);
    if(!audit||audit.command_id!==c.id||audit.project_id!==request.projectId||audit.operation_id!==c.operation_id||!same(audit.actor_ref,{kind:'HUMAN',userId:c.actor_id})||audit.client_ref!==c.client_id||!same(audit.target_ref,manifestRef)||!same(audit.policy_ref,c.policy_ref)||audit.approval_ref!==null||audit.outcome!=='APPLIED'||audit.reason_code!=='EXPLICIT_RESULT_CLAIM_ONLY'||audit.scope_digest!==scopeDigest||audit.source_kind!=='HUMAN_COMMAND'||audit.correction_of!==null)bad();stamp(audit.recorded_at);
    externalRef('ASSIGNMENT_VERSION',scope.assignmentRef);externalRef('EXECUTION_REFERENCE',scope.executionRef);externalRef('POLICY_VERSION',c.policy_ref);external({kind:'AUTHORIZATION_RECEIPT',id:ar.id,verification:'NOT_PERFORMED'});
    for(const ref of manifest.baselineRefs)externalRef('BASELINE_VERSION',ref);for(const ref of manifest.artifactRefs)externalRef('DECLARED_ARTIFACT_REFERENCE',ref);if(manifest.checkpointRef!==null)externalRef('CHECKPOINT_REFERENCE',manifest.checkpointRef);
    for(const change of manifest.changes)if(change.diffRef!==null)externalRef('DECLARED_DIFF_REFERENCE',change.diffRef);
    function evidenceRefs(evidence:Row[]){for(const e of evidence){externalRef('DECLARED_EVIDENCE_REFERENCE',e.ref);externalRef('ENVIRONMENT_REFERENCE',e.environmentRef);}}
    for(const command of manifest.commandResults){externalRef('COMMAND_PROFILE_REFERENCE',command.profileRef);externalRef('WORKING_DIRECTORY_REFERENCE',command.cwdRef);externalRef('HOST_REFERENCE',command.hostRef);externalRef('EXECUTION_REFERENCE',command.executionRef);if(command.outputRef!==null)externalRef('DECLARED_OUTPUT_REFERENCE',command.outputRef);evidenceRefs(command.evidence);}
    for(const test of manifest.testResults){for(const ref of test.baselineRefs)externalRef('BASELINE_VERSION',ref);evidenceRefs(test.evidence);}
    // 원 ref hash와 익명 projection hash를 분리한다. 제출자 계정/session 원증빙은 재구성하지 않는다.
    const projectedSnapshot={...structuredClone(snapshot),submittedByRef:{kind:'HUMAN'}};
    const projection={ref:entry.ref,manifestRef,snapshot:projectedSnapshot,sourceEvidence:{serverSequence:audit.server_sequence,authorizationReceiptRef:structuredClone(snapshot.authorizationReceiptRef)}};safe(projection);submissions.push({...projection,projectionHash:hash(projection)});
   }
   if(submissions.length)issues.push({code:'RESULT_CLAIM_EVIDENCE_NOT_PERFORMED'},{code:'SUBMITTER_IDENTITY_PREIMAGE_NOT_PERFORMED'});
   externalDependencies.sort((a,b)=>canonicalJson(a)<canonicalJson(b)?-1:canonicalJson(a)>canonicalJson(b)?1:0);
   const end=await rrObservation(db);if(end.snapshot!==start.snapshot)bad();const projection={projectId:request.projectId,submissions,issues,externalDependencies};safe(projection);
   const result:Row={kind:'RESULT_SUBMISSION_INVENTORY_V1',scope:'PROJECT_RESULT_SUBMISSION_HISTORY_ONLY',...projection,observation:{snapshot:start.snapshot,startedAt:start.at,finishedAt:end.at,isolation:'repeatable read',readOnly:true,authBoundary:'START_AND_END_READ_COMMITTED'},contentHash:hash(projection),usage:{metadataBytes:0,inputBytes:0,fileCount:0},metadataComplete:issues.length===0&&externalDependencies.length===0,sourceKind:'WORKER_CLAIM',executionReferenceVerification:'NOT_PERFORMED',evidenceProvenanceVerification:'NOT_PERFORMED',submitterIdentityVerification:'NOT_PERFORMED',policyVerification:'NOT_PERFORMED',auditChainVerification:'NOT_PERFORMED',blobVerification:'NOT_PERFORMED',resultReviews:'NOT_COLLECTED',resultCriteria:'NOT_COLLECTED',resultReworks:'NOT_COLLECTED',evidenceProvenanceVerified:false,completionAccepted:false,formalFailureCounted:false,executionEvidence:'NOT_CONNECTED',fullProjectCoverage:false,restorable:false,executionAuthorized:false,dispatchPerformed:false,atomicSnapshotVerified:false};
   check();rollbackTried=true;await db.query('ROLLBACK');begun=false;beginSent=false;const releasing=db;db=undefined;releasing.release();result.observation.finishedAt=await boundary();check();
   for(let n=0;n<17;n++){const bytes=Buffer.byteLength(canonicalJson(result));if(bytes>request.limits.metadataBytes)bad('RESULT_SUBMISSION_INVENTORY_LIMIT',413);if(bytes===result.usage.metadataBytes){check();return result;}result.usage.metadataBytes=bytes;}return bad();
  }catch(error){
   if(db){if(beginSent&&!begun)releaseError=new Error('RESULT_SUBMISSION_INVENTORY_BEGIN_UNKNOWN');if(begun){if(rollbackTried)releaseError=new Error('RESULT_SUBMISSION_INVENTORY_CLEANUP_UNKNOWN');else{rollbackTried=true;try{await db.query('ROLLBACK');begun=false;}catch{releaseError=new Error('RESULT_SUBMISSION_INVENTORY_CLEANUP_UNKNOWN');}}}}
   if(releaseError)bad('RESULT_SUBMISSION_INVENTORY_STORAGE_FAILED',503);throw error;
  }finally{if(db){try{db.release(releaseError);}catch{bad('RESULT_SUBMISSION_INVENTORY_STORAGE_FAILED',503);}}}
 }catch(error){if(error instanceof AuthFailure&&(ownErrors.has(error)||error.message==='AUTH_REQUIRED'&&error.statusCode===401||error.message==='NOT_FOUND'&&error.statusCode===404))throw new AuthFailure(error.message,error.statusCode);throw new AuthFailure('RESULT_SUBMISSION_INVENTORY_INTEGRITY_FAILED',503);}
}
