import type {PoolClient} from 'pg';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {readBaselineActivationRecord} from '../traceability/baseline-activation-record.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {readDocumentInventoryInput} from './document-inventory-input.ts';
type Row=Record<string,any>;
const columns={
 baseline_activations:'project_id id generation content_hash snapshot_json previous_activation_id command_id approval_consumption_id created_by client_id created_at'.split(' '),
 baseline_activation_current:'project_id activation_id activation_ref'.split(' '),
 baseline_activation_rechecks:'project_id activation_id plan_id plan_version plan_hash task_code impact_ref'.split(' '),
 commands:'id command_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id'.split(' ')
};
type Table=keyof typeof columns;
const taskCode=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v);
const ownErrors=new WeakSet<AuthFailure>();
function bad(code='BASELINE_INVENTORY_INTEGRITY_FAILED',status=503):never{const e=new AuthFailure(code,status);ownErrors.add(e);throw e;}
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
/** 원문 접근 없는 내부 활성 기준 역사 metadata 관측이다. archive/복원·명령 실행 권한을 발급하지 않는다. */
export async function collectBaselineInventory(access:AccessRepository,token:string,value:unknown,signal:AbortSignal):Promise<Row>{
 const request=readDocumentInventoryInput(value),started=performance.now();let authDeadline=Infinity,identity:AuthenticatedIdentity|undefined,metadataUsed=0;
 const check=()=>{if(signal.aborted)bad('BASELINE_INVENTORY_CANCELLED',409);if(performance.now()-started>=request.limits.deadlineMs||performance.now()>=authDeadline)bad('BASELINE_INVENTORY_DEADLINE',413);};
 async function query(db:PoolClient,sql:string,values:unknown[]=[]){
  check();const remaining=Math.floor(Math.min(request.limits.deadlineMs-(performance.now()-started),authDeadline-performance.now()));if(remaining<1)bad('BASELINE_INVENTORY_DEADLINE',413);
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
  const out:Row[]=[],keys=table==='baseline_activations'?['generation','id']:table==='baseline_activation_current'?['project_id']:table==='baseline_activation_rechecks'?['activation_id','plan_id','plan_version','task_code']:['id'];let last:(string|number)[]|null=null;
  const numeric=(k:string)=>k==='generation'||k==='plan_version',sqlKey=(k:string,prefix='t')=>prefix+'.'+k+(k==='task_code'?' COLLATE "C"':'');
  for(;;){
   check();const values:unknown[]=[request.projectId],conditions=['t.project_id=$1::uuid'],bind=(v:unknown)=>{values.push(v);return'$'+values.length;};if(selection)conditions.push(`t.id=ANY(${bind(selection)}::uuid[])`);
   if(last)conditions.push(`(${keys.map(k=>sqlKey(k)).join(',')})>(${last.map((v,i)=>bind(v)+(numeric(keys[i]!)?'::bigint':keys[i]==='task_code'?'::text COLLATE "C"':'::uuid')).join(',')})`);
   const remaining=request.limits.metadataBytes-metadataUsed;if(remaining<=0)bad('BASELINE_INVENTORY_LIMIT',413);const cap=bind(remaining);
   const sql=`WITH inventory_row AS (SELECT ${columns[table].map(k=>'t.'+k).join(',')} FROM anvil.${table} t WHERE ${conditions.join(' AND ')} ORDER BY ${keys.map(k=>sqlKey(k)).join(',')} LIMIT 200)
    SELECT CASE WHEN octet_length(to_jsonb(inventory_row)::text)<=${cap}::bigint THEN to_jsonb(inventory_row) ELSE NULL END AS inventory_data,
    octet_length(to_jsonb(inventory_row)::text) AS row_bytes FROM inventory_row ORDER BY ${keys.map(k=>sqlKey(k,'inventory_row')).join(',')}`;
   const result=(await query(db,sql,values)).result;if(!Array.isArray(result.rows)||result.rows.length>200)bad();
   for(const raw of result.rows){check();const envelope=object(raw,['inventory_data','row_bytes']),size=integer(envelope.row_bytes,1);if(size>remaining||metadataUsed>request.limits.metadataBytes-size)bad('BASELINE_INVENTORY_LIMIT',413);const row=object(envelope.inventory_data,columns[table]);
    const tuple=keys.map(k=>{if(numeric(k))return integer(row[k],1);if(k==='task_code'){if(!taskCode(row[k]))bad();return row[k];}if(!uuidV1(row[k]))bad();return row[k];});
    if(row.project_id!==request.projectId||last&&compare(tuple,last)<=0||selection&&!selection.includes(row.id))bad();last=tuple;metadataUsed+=size;out.push(structuredClone(row));
   }
   if(result.rows.length<200)return out;
  }
 }
 async function selectedCommands(db:PoolClient,ids:string[]){const selected=[...new Set(ids)].sort();if(selected.some(id=>!uuidV1(id)))bad();const out:Row[]=[];for(let batchStart=0;batchStart<selected.length;batchStart+=200){const batch=selected.slice(batchStart,batchStart+200),rows=await pageRows(db,'commands',batch);if(rows.length!==batch.length)bad();out.push(...rows);}return out;}
 async function rrObservation(db:PoolClient){const rows=(await query(db,"SELECT current_setting('transaction_isolation') AS isolation,current_setting('transaction_read_only') AS read_only,pg_current_snapshot()::text AS snapshot,clock_timestamp() AS at")).result.rows;const state=rows.length===1?rows[0]:null;if(state?.isolation!=='repeatable read'||state.read_only!=='on'||typeof state.snapshot!=='string'||!/^\d+:\d+:[\d,]*$/.test(state.snapshot)||!(state.at instanceof Date)||!Number.isFinite(state.at.getTime()))bad();return{snapshot:state.snapshot,at:state.at.toISOString()};}
 try{
  await boundary();let db:PoolClient|undefined,beginSent=false,begun=false,rollbackTried=false,releaseError:Error|undefined;
  try{
   db=await access.pool.connect();check();beginSent=true;await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;check();const start=await rrObservation(db);await owner(db,identity!);
   const rows=await pageRows(db,'baseline_activations'),pointers=await pageRows(db,'baseline_activation_current'),checks=await pageRows(db,'baseline_activation_rechecks');if(pointers.length>1)bad();
   const commandRows=await selectedCommands(db,rows.map(r=>r.command_id)),commands=new Map(commandRows.map(c=>[c.id,c]));
   const activations:Row[]=[],rechecks:Row[]=[],issues:Row[]=[],externalDependencies:Row[]=[],records=new Map<string,Row>(),serverIds=new Set<string>(),requestIds=new Set<string>(),consumptionIds=new Set<string>(),externalKeys=new Set<string>();
   const safe=(v:unknown)=>{if(inspectArtifact(Buffer.from(canonicalJson(v))).state==='SUSPECTED')bad('BASELINE_INVENTORY_SENSITIVE_METADATA',503);};
   function external(v:Row){safe(v);const key=canonicalJson(v);if(!externalKeys.has(key)){externalKeys.add(key);externalDependencies.push(structuredClone(v));}}
   let previous:Row|null=null;
   for(const row of rows){
    check();const generation=integer(row.generation,1),record=readBaselineActivationRecord({ref:{id:row.id,version:generation,contentHash:row.content_hash},snapshot:row.snapshot_json}),s=record.snapshot;
    if(s.projectId!==request.projectId||generation!==(previous?previous.ref.version+1:1)||records.has(row.id)||!same(s.previousActivationRef,previous?.ref??null)||row.previous_activation_id!==(previous?.ref.id??null)||s.approvalConsumptionId!==row.approval_consumption_id||s.recordedBy.userId!==row.created_by||s.recordedBy.clientId!==row.client_id||stamp(row.created_at)!==s.activatedAt||!uuidV1(row.command_id)||serverIds.has(row.command_id)||requestIds.has(s.commandId)||consumptionIds.has(s.approvalConsumptionId))bad();
    const c=commands.get(row.command_id);if(!c||c.command_id!==s.commandId||c.state!=='APPLIED'||c.operation!=='activateDesignChange'||c.actor_id!==s.recordedBy.userId||c.client_id!==s.recordedBy.clientId||integer(c.control_generation,1)!==s.controlGeneration||integer(c.expected_version)!==s.changeRef.version||!same(c.policy_ref,s.policyRef)||c.approval_consumption_id!==s.approvalConsumptionId||!uuidV1(c.authorization_receipt_id))bad();
    const result=object(c.result_ref,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt']);
    if(!uuidV1(result.operationId)||result.commandId!==s.commandId||result.projectId!==request.projectId||result.status!=='APPLIED'||result.targetId!==record.ref.id||result.version!==record.ref.version||!same(result.data,{ref:record.ref,status:'DESIGN_BASELINE_ACTIVATED',snapshot:s,executionAuthorized:false,dispatchPerformed:false})||!Array.isArray(result.evidenceRefs)||!Array.isArray(result.warnings)||stamp(result.serverReceivedAt)!==s.activatedAt)bad();
    safe(record);serverIds.add(row.command_id);requestIds.add(s.commandId);consumptionIds.add(s.approvalConsumptionId);records.set(row.id,record);previous=record;
    const projection={...s,recordedBy:{kind:'HUMAN'}};activations.push({ref:record.ref,snapshot:projection,projectionHash:hash(projection)});
    external({kind:'DESIGN_CHANGE',ref:s.changeRef,verification:'NOT_PERFORMED'});external({kind:'DESIGN_IMPACT',ref:s.impactRef,verification:'NOT_PERFORMED'});external({kind:'DOCUMENT_VERSION',formCode:'AF02',ref:s.approvedDesignRef,verification:'NOT_PERFORMED'});external({kind:'WORK_PLAN_VERSION',ref:s.confirmedPlanRef,verification:'NOT_PERFORMED'});
    external({kind:'APPROVAL',ref:s.approvalRef,verification:'NOT_PERFORMED'});external({kind:'APPROVAL_CONSUMPTION',id:s.approvalConsumptionId,verification:'NOT_PERFORMED'});external({kind:'PERMISSION_POLICY',ref:s.policyRef,verification:'NOT_PERFORMED'});external({kind:'AUTHORIZATION_RECEIPT',id:c.authorization_receipt_id,verification:'NOT_PERFORMED'});external({kind:'ACTIVATION_CANDIDATE_PAYLOAD',contentHash:s.candidatePayloadHash,verification:'NOT_PERFORMED'});
   }
   if(commands.size!==rows.length)bad();let current:unknown=null;
   if(!previous){if(pointers.length||checks.length)bad();}else{const pointer=pointers[0];if(!pointer||pointer.activation_id!==previous.ref.id||!same(pointer.activation_ref,previous.ref))bad();current=previous.ref;}
   const checkKeys=new Set<string>();
   for(const row of checks){check();const record=records.get(row.activation_id),planRef={id:row.plan_id,version:integer(row.plan_version,1),contentHash:row.plan_hash},key=canonicalJson([row.activation_id,row.plan_id,planRef.version,row.task_code]);if(!record||!isVersionRef(planRef)||!taskCode(row.task_code)||checkKeys.has(key)||!same(row.impact_ref,record.snapshot.impactRef))bad();checkKeys.add(key);const projection={activationRef:record.ref,planRef,taskCode:row.task_code,impactRef:row.impact_ref};safe(projection);rechecks.push(projection);external({kind:'WORK_PLAN_VERSION',ref:planRef,verification:'NOT_PERFORMED'});}
   externalDependencies.sort((a,b)=>canonicalJson(a)<canonicalJson(b)?-1:canonicalJson(a)>canonicalJson(b)?1:0);
   const end=await rrObservation(db);if(end.snapshot!==start.snapshot)bad();const projection={projectId:request.projectId,activations,current,rechecks,issues,externalDependencies};safe(projection);
   const result:Row={kind:'BASELINE_INVENTORY_V1',scope:'BASELINE_HISTORY_ONLY',...projection,observation:{snapshot:start.snapshot,startedAt:start.at,finishedAt:end.at,isolation:'repeatable read',readOnly:true,authBoundary:'START_AND_END_READ_COMMITTED'},contentHash:hash(projection),usage:{metadataBytes:0,inputBytes:0,fileCount:0},metadataComplete:externalDependencies.length===0,approvalBindingVerification:'NOT_PERFORMED',recheckCoverageVerification:'NOT_PERFORMED',blobVerification:'NOT_PERFORMED',executionEvidence:'NOT_CONNECTED',fullProjectCoverage:false,restorable:false,executionAuthorized:false,dispatchPerformed:false};
   check();rollbackTried=true;await db.query('ROLLBACK');begun=false;beginSent=false;const releasing=db;db=undefined;releasing.release();result.observation.finishedAt=await boundary();check();
   for(let n=0;n<17;n++){const bytes=Buffer.byteLength(canonicalJson(result));if(bytes>request.limits.metadataBytes)bad('BASELINE_INVENTORY_LIMIT',413);if(bytes===result.usage.metadataBytes){check();return result;}result.usage.metadataBytes=bytes;}return bad();
  }catch(error){
   if(db){if(beginSent&&!begun)releaseError=new Error('BASELINE_INVENTORY_BEGIN_UNKNOWN');if(begun){if(rollbackTried)releaseError=new Error('BASELINE_INVENTORY_CLEANUP_UNKNOWN');else{rollbackTried=true;try{await db.query('ROLLBACK');begun=false;}catch{releaseError=new Error('BASELINE_INVENTORY_CLEANUP_UNKNOWN');}}}}
   if(releaseError)bad('BASELINE_INVENTORY_STORAGE_FAILED',503);throw error;
  }finally{if(db){try{db.release(releaseError);}catch{bad('BASELINE_INVENTORY_STORAGE_FAILED',503);}}}
 }catch(error){if(error instanceof AuthFailure&&(ownErrors.has(error)||error.message==='AUTH_REQUIRED'&&error.statusCode===401||error.message==='NOT_FOUND'&&error.statusCode===404))throw new AuthFailure(error.message,error.statusCode);throw new AuthFailure('BASELINE_INVENTORY_INTEGRITY_FAILED',503);}
}
