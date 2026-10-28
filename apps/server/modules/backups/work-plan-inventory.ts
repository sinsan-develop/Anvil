import type {PoolClient} from 'pg';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {analyzeWorkPlanCards,planText} from '../traceability/work-plan-card.ts';
import {readWorkPlanReviewInput,workPlanReviewCriteria} from '../traceability/work-plan-reviews.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {readDocumentInventoryInput} from './document-inventory-input.ts';

type Row=Record<string,any>;
const columns={
 work_plans:'id project_id head_version confirmed_version created_by created_at updated_at'.split(' '),
 work_plan_versions:'project_id plan_id version document_id document_version document_hash design_id design_version design_hash screen_review_refs content_hash version_json created_by client_id command_id created_at'.split(' '),
 plan_tasks:'project_id plan_id plan_version task_code task_type card_json card_hash owner_role'.split(' '),
 plan_dependencies:'project_id plan_id plan_version task_code dependency_task_code phase'.split(' '),
 work_plan_confirmations:'id project_id plan_id version target_hash review_refs validation_json confirmed_by client_id command_id created_at'.split(' '),
 content_reviews:'id scope_kind scope_id project_id target_kind target_id target_version target_hash criteria_version criteria_snapshot_json items_json outcome reviewer_user_id client_id reviewer_subject_ref source_kind reason command_id created_at'.split(' '),
 commands:'id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id'.split(' '),
 audit_events:'event_id project_id command_id server_sequence'.split(' ')
};
type Table=keyof typeof columns;
const taskCode=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v);
const ownErrors=new WeakSet<AuthFailure>();
function bad(code='WORK_PLAN_INVENTORY_INTEGRITY_FAILED',status=503):never{const e=new AuthFailure(code,status);ownErrors.add(e);throw e;}
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
/** 원문 접근 없는 내부 작업계획 metadata 관측이다. archive/복원·명령 실행 권한을 발급하지 않는다. */
export async function collectWorkPlanInventory(access:AccessRepository,token:string,value:unknown,signal:AbortSignal):Promise<Row>{
 const request=readDocumentInventoryInput(value),started=performance.now();let authDeadline=Infinity,identity:AuthenticatedIdentity|undefined,metadataUsed=0;
 const check=()=>{if(signal.aborted)bad('WORK_PLAN_INVENTORY_CANCELLED',409);if(performance.now()-started>=request.limits.deadlineMs||performance.now()>=authDeadline)bad('WORK_PLAN_INVENTORY_DEADLINE',413);};
 async function query(db:PoolClient,sql:string,values:unknown[]=[]){
  check();const remaining=Math.floor(Math.min(request.limits.deadlineMs-(performance.now()-started),authDeadline-performance.now()));if(remaining<1)bad('WORK_PLAN_INVENTORY_DEADLINE',413);
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
  const out:Row[]=[],keys=table==='work_plan_versions'?['plan_id','version']:table==='plan_tasks'?['plan_id','plan_version','task_code']:table==='plan_dependencies'?['plan_id','plan_version','task_code','dependency_task_code','phase']:table==='audit_events'?['server_sequence']:['id'];let last:(string|number)[]|null=null;
  const numeric=(k:string)=>['version','plan_version','server_sequence'].includes(k),text=(k:string)=>['task_code','dependency_task_code','phase'].includes(k),column=(prefix:string,k:string)=>prefix+'.'+k+(text(k)?' COLLATE "C"':'');
  for(;;){
   check();const values:unknown[]=[request.projectId],conditions=['t.project_id=$1::uuid'],bind=(v:unknown)=>{values.push(v);return'$'+values.length;};
   if(table==='content_reviews')conditions.push("t.scope_kind='PROJECT'","t.scope_id=$1::uuid","t.target_kind='WORK_PLAN'");
   if(selection)conditions.push(`t.${table==='audit_events'?'command_id':'id'}=ANY(${bind(selection)}::uuid[])`);
   if(last)conditions.push(`(${keys.map(k=>column('t',k)).join(',')})>(${last.map((v,i)=>bind(v)+(numeric(keys[i]!)?'::bigint':text(keys[i]!)?'::text COLLATE "C"':'::uuid')).join(',')})`);
   const remaining=request.limits.metadataBytes-metadataUsed;if(remaining<=0)bad('WORK_PLAN_INVENTORY_LIMIT',413);const cap=bind(remaining);
   const sql=`WITH inventory_row AS (SELECT ${columns[table].map(k=>'t.'+k).join(',')} FROM anvil.${table} t WHERE ${conditions.join(' AND ')} ORDER BY ${keys.map(k=>column('t',k)).join(',')} LIMIT 200)
    SELECT CASE WHEN octet_length(to_jsonb(inventory_row)::text)<=${cap}::bigint THEN to_jsonb(inventory_row) ELSE NULL END AS inventory_data,
    octet_length(to_jsonb(inventory_row)::text) AS row_bytes FROM inventory_row ORDER BY ${keys.map(k=>column('inventory_row',k)).join(',')}`;
   const result=(await query(db,sql,values)).result;if(!Array.isArray(result.rows)||result.rows.length>200)bad();
   for(const raw of result.rows){
    check();const envelope=object(raw,['inventory_data','row_bytes']),size=integer(envelope.row_bytes,1);if(size>remaining||metadataUsed>request.limits.metadataBytes-size)bad('WORK_PLAN_INVENTORY_LIMIT',413);
    const row=object(envelope.inventory_data,columns[table]);if(row.project_id!==request.projectId)bad();const tuple=keys.map(k=>numeric(k)?integer(row[k],1):row[k]);
    if(tuple.some((v,i)=>numeric(keys[i]!)?false:text(keys[i]!)?typeof v!=='string'||(keys[i]==='phase'?!['START','ACCEPTANCE'].includes(v):!taskCode(v)):!uuidV1(v))||last&&compare(tuple,last)<=0)bad();
    if(selection&&!selection.includes(row[table==='audit_events'?'command_id':'id']))bad();last=tuple;metadataUsed+=size;out.push(structuredClone(row));
   }
   if(result.rows.length<200)return out;
  }
 }
 async function selectedRows(db:PoolClient,table:'commands'|'audit_events',ids:string[]){const selected=[...new Set(ids)].sort();if(selected.some(id=>!uuidV1(id)))bad();const out:Row[]=[];for(let batchStart=0;batchStart<selected.length;batchStart+=200){const batch=selected.slice(batchStart,batchStart+200),rows=await pageRows(db,table,batch);if(rows.length!==batch.length)bad();out.push(...rows);}return out;}
 async function rrObservation(db:PoolClient){const rows=(await query(db,"SELECT current_setting('transaction_isolation') AS isolation,current_setting('transaction_read_only') AS read_only,pg_current_snapshot()::text AS snapshot,clock_timestamp() AS at")).result.rows;const state=rows.length===1?rows[0]:null;if(state?.isolation!=='repeatable read'||state.read_only!=='on'||typeof state.snapshot!=='string'||!/^\d+:\d+:[\d,]*$/.test(state.snapshot)||!(state.at instanceof Date)||!Number.isFinite(state.at.getTime()))bad();return{snapshot:state.snapshot,at:state.at.toISOString()};}
 try{
  await boundary();let db:PoolClient|undefined,beginSent=false,begun=false,rollbackTried=false,releaseError:Error|undefined;
  try{
   db=await access.pool.connect();check();beginSent=true;await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;check();const start=await rrObservation(db);await owner(db,identity!);
   const headRows=await pageRows(db,'work_plans'),versionRows=await pageRows(db,'work_plan_versions'),taskRows=await pageRows(db,'plan_tasks'),dependencyRows=await pageRows(db,'plan_dependencies'),confirmationRows=await pageRows(db,'work_plan_confirmations'),reviewRows=await pageRows(db,'content_reviews');
   const commandIds=[...versionRows,...confirmationRows,...reviewRows].map(r=>r.command_id);if(new Set(commandIds).size!==commandIds.length)bad();
   const commandRows=await selectedRows(db,'commands',commandIds),commands=new Map(commandRows.map(c=>[c.id,c]));
   if(commands.size!==commandIds.length)bad();
   function command(row:Row,operation:string,ref:Row,expected:number,actorId:string,at:unknown){
    const c=commands.get(row.command_id);if(!c||c.state!=='APPLIED'||c.operation!==operation||c.actor_id!==actorId||c.client_id!==row.client_id||!uuidV1(actorId)||!uuidV1(row.client_id)||integer(c.expected_version)!==expected||!isVersionRef(c.policy_ref)||!uuidV1(c.authorization_receipt_id))return bad();integer(c.control_generation,1);
    const result=object(c.result_ref,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt']);
    if(!uuidV1(result.operationId)||!uuidV1(result.commandId)||result.projectId!==request.projectId||result.status!=='APPLIED'||result.targetId!==ref.id||result.version!==ref.version||!same(result.data?.ref,ref)||!Array.isArray(result.evidenceRefs)||!Array.isArray(result.warnings)||stamp(result.serverReceivedAt)!==stamp(at))bad();return c;
   }
   const plans:Row[]=[],versions:Row[]=[],tasks:Row[]=[],dependencies:Row[]=[],reviews:Row[]=[],confirmations:Row[]=[],issues:Row[]=[],externalDependencies:Row[]=[];
   const heads=new Map<string,Row>(),versionMap=new Map<string,Row>(),externalKeys=new Set<string>(),taskMap=new Map<string,Row[]>(),dependencyMap=new Map<string,Row[]>(),reviewMap=new Map<string,Row>(),confirmationMap=new Map<string,Row>();
   const key=(id:string,v:number)=>id+':'+v,safe=(v:unknown)=>{if(inspectArtifact(Buffer.from(canonicalJson(v))).state==='SUSPECTED')bad('WORK_PLAN_INVENTORY_SENSITIVE_METADATA',503);};
   function external(v:Row){safe(v);const k=canonicalJson(v);if(!externalKeys.has(k)){externalKeys.add(k);externalDependencies.push(structuredClone(v));}}
   const sourceIssues=new Set(['PLAN_DOCUMENT_NOT_CONFIRMED','DESIGN_NOT_CONFIRMED','SCREEN_REVIEW_MISSING','PLAN_SOURCE_TASK_MISSING']);
   for(const h of headRows){if(!uuidV1(h.created_by))bad();h.head_version=integer(h.head_version,1);h.confirmed_version=h.confirmed_version===null?null:integer(h.confirmed_version,1,h.head_version);heads.set(h.id,h);plans.push({id:h.id,headVersion:h.head_version,confirmedVersion:h.confirmed_version,createdAt:stamp(h.created_at),updatedAt:stamp(h.updated_at)});}
   for(const row of versionRows){
    check();const h=heads.get(row.plan_id),v=integer(row.version,1),prior=versionMap.get(key(row.plan_id,v-1));if(!h||v>h.head_version||v>1&&!prior||!uuidV1(row.created_by)||!uuidV1(row.client_id)||!digest(row.content_hash))bad();
    const value=object(row.version_json,['ref','status','documentRef','designRef','screenReviewRefs','tasks','dependencies','reason','issues','relationalProjection']),{ref,status,...snapshot}=value;
    if(!isVersionRef(ref)||ref.id!==row.plan_id||ref.version!==v||ref.contentHash!==row.content_hash||status!=='DRAFT'||hash(snapshot)!==row.content_hash||!isVersionRef(snapshot.documentRef)||!isVersionRef(snapshot.designRef)||!planText(snapshot.reason)||!snapshot.reason.trim())bad();safe(snapshot);
    if(!same(snapshot.documentRef,{id:row.document_id,version:integer(row.document_version,1),contentHash:row.document_hash})||!same(snapshot.designRef,{id:row.design_id,version:integer(row.design_version,1),contentHash:row.design_hash})||!same(snapshot.screenReviewRefs,row.screen_review_refs))bad();
    const analysis=analyzeWorkPlanCards(snapshot.tasks);if(!same(snapshot.tasks,analysis.tasks)||!same(snapshot.dependencies,analysis.dependencies)||!Array.isArray(snapshot.issues))bad();
    const storedIssues:Row[]=[];for(const item of snapshot.issues){const i=object(item,['code','location','message']);if(![i.code,i.location,i.message].every(v=>planText(v)&&v.length>0))bad();storedIssues.push(i);}
    if(!same(storedIssues.filter(i=>!sourceIssues.has(i.code)),analysis.issues))bad();
    const ambiguous=analysis.issues.some(i=>['DUPLICATE_TASK_CODE','DEPENDENCY_CYCLE','DEPENDENCY_TASK_NOT_FOUND','SELF_DEPENDENCY','DUPLICATE_DEPENDENCY','DEPENDENCY_INPUT_INVALID'].includes(i.code));if(snapshot.relationalProjection!==(ambiguous?'ISSUES_ONLY':'STORED'))bad();
    if(!Array.isArray(snapshot.screenReviewRefs)||snapshot.screenReviewRefs.length>200)bad();const screens=new Map<string,unknown>();for(const task of analysis.tasks)for(const s of task.screenRefs)screens.set(key(s.versionRef.id,s.versionRef.version),s.versionRef);
    for(const review of snapshot.screenReviewRefs){const r=object(review,['id','targetRef','criteriaVersion','outcome']);if(!uuidV1(r.id)||!isVersionRef(r.targetRef)||r.criteriaVersion!==1||r.outcome!=='ACCEPTED'||!same(screens.get(key(r.targetRef.id,r.targetRef.version))??null,r.targetRef))bad();external({kind:'SCREEN_REVIEW',ref:r,verification:'NOT_PERFORMED'});}
    const c=command(row,'saveWorkPlanDraft',ref,v-1,row.created_by,row.created_at);if(!same(c.result_ref.data,{ref,status:'WORK_PLAN_DRAFT_SAVED',workPlan:value}))bad();
    if(v===1&&(row.created_by!==h.created_by||stamp(row.created_at)!==stamp(h.created_at)))bad();
    external({kind:'DOCUMENT_VERSION',formCode:'AF04',ref:snapshot.documentRef,verification:'NOT_PERFORMED'});external({kind:'DOCUMENT_VERSION',formCode:'AF02',ref:snapshot.designRef,verification:'NOT_PERFORMED'});
    for(const task of analysis.tasks)for(const r of[...task.designRefs,...task.screenRefs])external({kind:r.kind,ref:r,verification:'NOT_PERFORMED'});
    const projection={ref,status:'DRAFT',snapshot,recordedAt:stamp(row.created_at)};versions.push({...projection,projectionHash:hash(projection)});for(const i of storedIssues)issues.push({planRef:ref,...i});versionMap.set(key(row.plan_id,v),{ref,row,snapshot,analysis});
   }
   for(const h of heads.values())if(!versionMap.has(key(h.id,h.head_version)))bad();
   for(const row of taskRows){const v=versionMap.get(key(row.plan_id,integer(row.plan_version,1)));if(!v||v.snapshot.relationalProjection!=='STORED'||!taskCode(row.task_code)||!digest(row.card_hash))bad();const task=v.analysis.tasks.find((t:Row)=>t.taskCode===row.task_code);if(!task||!same(row.card_json,task)||hash(task)!==row.card_hash||task.type!==row.task_type||task.ownerRole!==row.owner_role)bad();const k=key(row.plan_id,v.ref.version);if(!taskMap.has(k))taskMap.set(k,[]);taskMap.get(k)!.push(row);tasks.push({planRef:v.ref,taskCode:row.task_code,type:row.task_type,card:row.card_json,cardHash:row.card_hash,ownerRole:row.owner_role});}
   for(const row of dependencyRows){const v=versionMap.get(key(row.plan_id,integer(row.plan_version,1)));if(!v||v.snapshot.relationalProjection!=='STORED'||!taskCode(row.task_code)||!taskCode(row.dependency_task_code)||!['START','ACCEPTANCE'].includes(row.phase))bad();const d={taskCode:row.task_code,dependencyTaskCode:row.dependency_task_code,phase:row.phase};if(!v.analysis.dependencies.some((x:Row)=>same(x,d)))bad();const k=key(row.plan_id,v.ref.version);if(!dependencyMap.has(k))dependencyMap.set(k,[]);dependencyMap.get(k)!.push(row);dependencies.push({planRef:v.ref,...d});}
   for(const[k,v]of versionMap){if(v.snapshot.relationalProjection==='STORED'&&((taskMap.get(k)?.length??0)!==v.analysis.tasks.length||(dependencyMap.get(k)?.length??0)!==v.analysis.dependencies.length))bad();}
   const audits=await selectedRows(db,'audit_events',reviewRows.map(r=>r.command_id)),auditMap=new Map<string,Row>(),auditIds=new Set<string>(),auditSequences=new Set<number>();
   for(const a of audits){const seq=integer(a.server_sequence,1);if(!uuidV1(a.event_id)||auditIds.has(a.event_id)||auditSequences.has(seq)||auditMap.has(a.command_id))bad();auditIds.add(a.event_id);auditSequences.add(seq);auditMap.set(a.command_id,{...a,server_sequence:seq});}
   for(const row of reviewRows){
    check();const v=versionMap.get(key(row.target_id,integer(row.target_version,1))),audit=auditMap.get(row.command_id);if(!v||!audit||row.scope_kind!=='PROJECT'||row.scope_id!==request.projectId||row.target_kind!=='WORK_PLAN'||row.target_hash!==v.ref.contentHash||row.source_kind!=='HUMAN_REVIEW'||!uuidV1(row.reviewer_user_id))bad();
    const p=readWorkPlanReviewInput({targetKind:'WORK_PLAN',targetRef:v.ref,criteriaVersion:integer(row.criteria_version,1),items:row.items_json,outcome:row.outcome,reason:row.reason},v.ref),ref={id:row.id,targetRef:v.ref,criteriaVersion:1,outcome:p.outcome},reviewer={kind:'HUMAN',userId:row.reviewer_user_id,sameAsTargetRecorder:row.reviewer_user_id===v.row.created_by},snapshot={ref,criteria:workPlanReviewCriteria,items:p.items,reviewer,sourceKind:'HUMAN_REVIEW',reason:p.reason,reviewedAt:stamp(row.created_at)},c=command(row,'recordContentReview',v.ref,v.ref.version,row.reviewer_user_id,row.created_at);
    if(!same(row.criteria_snapshot_json,workPlanReviewCriteria)||!same(row.reviewer_subject_ref,reviewer)||!same(c.result_ref.data,{ref:v.ref,status:'REVIEW_RECORDED',reviewRef:ref,review:snapshot}))bad();safe(snapshot);reviewMap.set(row.id,{ref,row});reviews.push({...snapshot,reviewer:{kind:'HUMAN',sameAsTargetRecorder:reviewer.sameAsTargetRecorder},serverSequence:audit.server_sequence});
   }
   for(const row of confirmationRows){
    check();const k=key(row.plan_id,integer(row.version,1)),v=versionMap.get(k);if(!v||confirmationMap.has(k)||row.target_hash!==v.ref.contentHash||!uuidV1(row.confirmed_by)||v.snapshot.relationalProjection!=='STORED'||!v.analysis.tasks.length||!Array.isArray(row.review_refs)||row.review_refs.length<1||row.review_refs.length>200)bad();
    const seen=new Set<string>();for(const raw of row.review_refs){const ref=object(raw,['id','targetRef','criteriaVersion','outcome']),review=reviewMap.get(ref.id);if(!review||seen.has(ref.id)||!same(ref,review.ref)||ref.outcome!=='ACCEPTED'||ref.criteriaVersion!==1||!same(ref.targetRef,v.ref))bad();seen.add(ref.id);}
    const validation={validForConfirmation:true,issues:[],sourceRefs:[v.snapshot.documentRef,v.snapshot.designRef],screenReviewRefs:v.snapshot.screenReviewRefs};if(!same(validation,row.validation_json))bad();
    const c=command(row,'confirmWorkPlan',v.ref,v.ref.version,row.confirmed_by,row.created_at);if(!same(c.result_ref.data,{ref:v.ref,status:'CONFIRMED',confirmationId:row.id,reviewRefs:row.review_refs,validation,activatedAsBaseline:false}))bad();
    confirmationMap.set(k,row);confirmations.push({id:row.id,planRef:v.ref,reviewRefs:row.review_refs,validation,confirmedBy:{kind:'HUMAN'},confirmedAt:stamp(row.created_at)});
   }
   for(const h of heads.values()){const known=confirmationRows.filter(c=>c.plan_id===h.id).sort((a,b)=>integer(a.version,1)-integer(b.version,1));if(h.confirmed_version!==(known.length?integer(known.at(-1)!.version,1):null))bad();}
   externalDependencies.sort((a,b)=>canonicalJson(a)<canonicalJson(b)?-1:canonicalJson(a)>canonicalJson(b)?1:0);
   const end=await rrObservation(db);if(end.snapshot!==start.snapshot)bad();const projection={projectId:request.projectId,plans,versions,tasks,dependencies,reviews,confirmations,issues,externalDependencies};safe(projection);
   const result:Row={kind:'WORK_PLAN_INVENTORY_V1',scope:'WORK_PLAN_HISTORY_ONLY',...projection,observation:{snapshot:start.snapshot,startedAt:start.at,finishedAt:end.at,isolation:'repeatable read',readOnly:true,authBoundary:'START_AND_END_READ_COMMITTED'},contentHash:hash(projection),usage:{metadataBytes:0,inputBytes:0,fileCount:0},metadataComplete:issues.length===0&&externalDependencies.length===0,blobVerification:'NOT_PERFORMED',executionEvidence:'NOT_CONNECTED',fullProjectCoverage:false,restorable:false};
   check();rollbackTried=true;await db.query('ROLLBACK');begun=false;beginSent=false;const releasing=db;db=undefined;releasing.release();result.observation.finishedAt=await boundary();check();
   for(let n=0;n<17;n++){const bytes=Buffer.byteLength(canonicalJson(result));if(bytes>request.limits.metadataBytes)bad('WORK_PLAN_INVENTORY_LIMIT',413);if(bytes===result.usage.metadataBytes){check();return result;}result.usage.metadataBytes=bytes;}return bad();
  }catch(error){
   if(db){if(beginSent&&!begun)releaseError=new Error('WORK_PLAN_INVENTORY_BEGIN_UNKNOWN');if(begun){if(rollbackTried)releaseError=new Error('WORK_PLAN_INVENTORY_CLEANUP_UNKNOWN');else{rollbackTried=true;try{await db.query('ROLLBACK');begun=false;}catch{releaseError=new Error('WORK_PLAN_INVENTORY_CLEANUP_UNKNOWN');}}}}
   if(releaseError)bad('WORK_PLAN_INVENTORY_STORAGE_FAILED',503);throw error;
  }finally{if(db){try{db.release(releaseError);}catch{bad('WORK_PLAN_INVENTORY_STORAGE_FAILED',503);}}}
 }catch(error){if(error instanceof AuthFailure&&(ownErrors.has(error)||error.message==='AUTH_REQUIRED'&&error.statusCode===401||error.message==='NOT_FOUND'&&error.statusCode===404))throw new AuthFailure(error.message,error.statusCode);throw new AuthFailure('WORK_PLAN_INVENTORY_INTEGRITY_FAILED',503);}
}
