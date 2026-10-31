import type {PoolClient} from 'pg';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {readAssignmentDraftInput} from '../assignments/assignment-input.ts';
import {readAssignmentContentReview,readAssignmentConfirmation} from '../assignments/assignment-confirmation-input.ts';
import {inspectSourceScopeContainment} from '../assignments/source-scope-containment.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {readDocumentInventoryInput} from './document-inventory-input.ts';
type Row=Record<string,any>;
const columns={
 assignment_drafts:'project_id id head_version created_by client_id created_at updated_at'.split(' '),
 assignment_draft_versions:'project_id draft_id version content_hash version_json created_by client_id command_id created_at'.split(' '),
 assignment_content_reviews:'project_id review_id draft_id draft_version draft_hash content_hash review_json created_by client_id command_id created_at'.split(' '),
 assignment_versions:'project_id assignment_id version content_hash version_json created_by client_id command_id confirmation_id created_at'.split(' '),
 commands:'id command_id scope_kind scope_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id payload_ref completed_at operation_id request_hash'.split(' '),
 authorization_receipts:'id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at'.split(' '),
 audit_events:'project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of'.split(' ')
};
type Table=keyof typeof columns;
const ownErrors=new WeakSet<AuthFailure>();
function bad(code='ASSIGNMENT_INVENTORY_INTEGRITY_FAILED',status=503):never{const e=new AuthFailure(code,status);ownErrors.add(e);throw e;}
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


/** 임무 초안·검토·확정의 내부 metadata 역사다. 현재 준비/실행/복원 권한을 발급하지 않는다. */
export async function collectAssignmentInventory(access:AccessRepository,token:string,value:unknown,signal:AbortSignal):Promise<Row>{
 const request=readDocumentInventoryInput(value),started=performance.now();let authDeadline=Infinity,identity:AuthenticatedIdentity|undefined,metadataUsed=0;
 const check=()=>{if(signal.aborted)bad('ASSIGNMENT_INVENTORY_CANCELLED',409);if(performance.now()-started>=request.limits.deadlineMs||performance.now()>=authDeadline)bad('ASSIGNMENT_INVENTORY_DEADLINE',413);};
 async function query(db:PoolClient,sql:string,values:unknown[]=[]){
  check();const remaining=Math.floor(Math.min(request.limits.deadlineMs-(performance.now()-started),authDeadline-performance.now()));if(remaining<1)bad('ASSIGNMENT_INVENTORY_DEADLINE',413);
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
  const out:Row[]=[],key=table==='audit_events'?'event_id':table==='assignment_draft_versions'?'draft_id':table==='assignment_versions'?'assignment_id':table==='assignment_content_reviews'?'review_id':'id';let last:string|null=null,lastVersion=0;const composite=['assignment_draft_versions','assignment_versions'].includes(table);
  for(;;){
   check();const values:unknown[]=[request.projectId],conditions=[table==='authorization_receipts'?'t.scope_id=$1::uuid':'t.project_id=$1::uuid'],bind=(v:unknown)=>{values.push(v);return'$'+values.length;};
   if(table==='commands')conditions.push("t.scope_kind='PROJECT'",'t.scope_id=$1::uuid',"t.operation IN ('prepareAssignment','reviewAssignmentContent','confirmAssignment')");
   if(table==='authorization_receipts')conditions.push("t.scope_kind='PROJECT'");
   if(!['assignment_drafts','assignment_draft_versions','assignment_content_reviews','assignment_versions'].includes(table)&&(!selection||!selection.length||selection.length>200))bad();
   if(selection)conditions.push(`t.${table==='audit_events'?'command_id':'id'}=ANY(${bind(selection)}::uuid[])`);
   if(last!==null)conditions.push(composite?`(t.${key},t.version)>(${bind(last)}::uuid,${bind(lastVersion)}::bigint)`:`t.${key}>${bind(last)}::uuid`);
   const remaining=request.limits.metadataBytes-metadataUsed;if(remaining<=0)bad('ASSIGNMENT_INVENTORY_LIMIT',413);const cap=bind(remaining);
   const sql=`WITH inventory_row AS (SELECT ${columns[table].map(k=>'t.'+k).join(',')} FROM anvil.${table} t WHERE ${conditions.join(' AND ')} ORDER BY t.${key}${composite?',t.version':''} LIMIT 200)
    SELECT CASE WHEN octet_length(to_jsonb(inventory_row)::text)<=${cap}::bigint THEN to_jsonb(inventory_row) ELSE NULL END AS inventory_data,
    octet_length(to_jsonb(inventory_row)::text) AS row_bytes FROM inventory_row ORDER BY inventory_row.${key}${composite?',inventory_row.version':''}`;
   const result=(await query(db,sql,values)).result;if(!Array.isArray(result.rows)||result.rows.length>200)bad();
   for(const raw of result.rows){
    check();const envelope=object(raw,['inventory_data','row_bytes']),size=integer(envelope.row_bytes,1);if(size>remaining||metadataUsed>request.limits.metadataBytes-size)bad('ASSIGNMENT_INVENTORY_LIMIT',413);
    const row=object(envelope.inventory_data,columns[table]),id=row[key],version=composite?integer(row.version,1):0;if(!uuidV1(id)||last!==null&&(id<last||id===last&&(!composite||version<=lastVersion))||(table==='authorization_receipts'?row.scope_kind!=='PROJECT'||row.scope_id!==request.projectId:row.project_id!==request.projectId)||selection&&!selection.includes(row[table==='audit_events'?'command_id':'id']))bad();
    last=id;lastVersion=version;metadataUsed+=size;out.push(structuredClone(row));
   }
   if(result.rows.length<200)return out;
  }
 }
 async function selectedRows(db:PoolClient,table:Table,ids:string[]){const selected=[...new Set(ids)].sort();if(selected.some(id=>!uuidV1(id)))bad();const out:Row[]=[];for(let batchStart=0;batchStart<selected.length;batchStart+=200)out.push(...await pageRows(db,table,selected.slice(batchStart,batchStart+200)));return out;}
 async function rrObservation(db:PoolClient){const rows=(await query(db,"SELECT current_setting('transaction_isolation') AS isolation,current_setting('transaction_read_only') AS read_only,pg_current_snapshot()::text AS snapshot,clock_timestamp() AS at")).result.rows;const state=rows.length===1?rows[0]:null;if(state?.isolation!=='repeatable read'||state.read_only!=='on'||typeof state.snapshot!=='string'||!/^\d+:\d+:[\d,]*$/.test(state.snapshot)||!(state.at instanceof Date)||!Number.isFinite(state.at.getTime()))bad();return{snapshot:state.snapshot,at:state.at.toISOString()};}
 const safe=(v:unknown)=>{if(inspectArtifact(Buffer.from(canonicalJson(v))).state==='SUSPECTED')bad('ASSIGNMENT_INVENTORY_SENSITIVE_METADATA',503);};
 try{
  await boundary();let db:PoolClient|undefined,beginSent=false,begun=false,rollbackTried=false,releaseError:Error|undefined;
  try{
   db=await access.pool.connect();check();beginSent=true;await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;check();const start=await rrObservation(db);await owner(db,identity!);
   const headRows=await pageRows(db,'assignment_drafts'),draftRows=await pageRows(db,'assignment_draft_versions'),reviewRows=await pageRows(db,'assignment_content_reviews'),confirmationRows=await pageRows(db,'assignment_versions'),rows=[...draftRows,...reviewRows,...confirmationRows];
   const commandIds=rows.map(r=>r.command_id);if(new Set(commandIds).size!==commandIds.length)bad();
   const commandRows=await selectedRows(db,'commands',commandIds),commands=new Map(commandRows.map(c=>[c.id,c]));if(commands.size!==commandIds.length)bad();
   const authIds=commandRows.map(c=>c.authorization_receipt_id);if(new Set(authIds).size!==authIds.length)bad();const authRows=await selectedRows(db,'authorization_receipts',authIds),authMap=new Map(authRows.map(a=>[a.id,a]));if(authMap.size!==authIds.length)bad();
   const auditRows=await selectedRows(db,'audit_events',commandIds),auditMap=new Map<string,Row>(),auditSequences=new Set<number>();for(const a of auditRows){const seq=integer(a.server_sequence,1);if(!commands.has(a.command_id)||auditMap.has(a.command_id)||auditSequences.has(seq))bad();a.server_sequence=seq;auditMap.set(a.command_id,a);auditSequences.add(seq);}if(auditMap.size!==commands.size)bad();
   const drafts:Row[]=[],draftVersions:Row[]=[],reviews:Row[]=[],confirmations:Row[]=[],issues:Row[]=[],externalDependencies:Row[]=[],externalKeys=new Set<string>(),usedRequests=new Set<string>();
   const draftMap=new Map<string,Row>(),reviewMap=new Map<string,Row>(),confirmationMap=new Map<string,Row>(),firstDraft=new Map<string,Row>(),lastDraft=new Map<string,Row>(),confirmationIds=new Set<string>();
   function external(item:Row){safe(item);const key=canonicalJson(item);if(!externalKeys.has(key)){externalKeys.add(key);externalDependencies.push(structuredClone(item));}}
   function externalRef(kind:string,value:unknown){if(!isVersionRef(value))bad();external({kind,ref:value,verification:'NOT_PERFORMED'});}
   function array(value:any,max:number,min=0):any[]{if(!Array.isArray(value)||value.length<min||value.length>max)bad();return value;}
   function bounded(v:unknown){safe(v);if(Buffer.byteLength(canonicalJson(v))>2097152)bad();}
   function refFor(row:Row,id:string,version=1){if(!uuidV1(id)||!digest(row.content_hash))bad();return{id,version,contentHash:row.content_hash};}
   function person(value:unknown,row:Row){if(!same(object(value,['kind','userId']),{kind:'HUMAN',userId:row.created_by}))bad();}
   function falseFlags(s:Row){if(s.ready!==false||s.executionAuthorized!==false||s.dispatchPerformed!==false)bad();}
   function definitionDependencies(definition:Row,basis:Row){externalRef('WORK_PLAN_VERSION',basis.planRef);externalRef('METHODOLOGY_APPLICATION',basis.applicationRef);externalRef('DESIGN_VERSION',basis.designRef);for(const field of ['environmentRef','budgetRef','recordingPolicyRef'])if(definition[field]!==null)externalRef(field,definition[field]);for(const scope of definition.allowedScopes){externalRef('SOURCE_ROOT_REFERENCE',scope.sourceRootRef);if(scope.mappingRef!==null)externalRef('SOURCE_MAPPING_REFERENCE',scope.mappingRef);externalRef('SOURCE_OBSERVATION_REFERENCE',scope.observationRef);externalRef('BASELINE_VERSION',scope.baselineRef);}}
   function evidence(row:Row,ref:Row,input:unknown,operation:string,data:Row,reason:string){
    if(!uuidV1(row.created_by)||!uuidV1(row.client_id)||!uuidV1(row.command_id))bad();const at=stamp(row.created_at),originalInput=input as Row,expectedVersion=operation==='prepareAssignment'?ref.version-1:originalInput.draftRef.version,c=commands.get(row.command_id);
    if(!c||c.project_id!==request.projectId||c.scope_kind!=='PROJECT'||c.scope_id!==request.projectId||c.operation!==operation||c.state!=='APPLIED'||c.actor_id!==row.created_by||c.client_id!==row.client_id||!uuidV1(c.command_id)||!uuidV1(c.operation_id)||!uuidV1(c.authorization_receipt_id)||!isVersionRef(c.policy_ref)||!digest(c.request_hash)||integer(c.expected_version)!==expectedVersion||c.approval_consumption_id!==null||c.payload_ref!==null)bad();
    const controlGeneration=integer(c.control_generation,1),requestKey=c.actor_id+':'+c.command_id;if(usedRequests.has(requestKey))bad();usedRequests.add(requestKey);
    const original={schemaVersion:1,projectId:request.projectId,commandId:c.command_id,clientId:c.client_id,controlGeneration,operation,targetId:operation==='prepareAssignment'?(ref.version>1?ref.id:null):originalInput.draftRef.id,expectedVersion,baselineRefs:[],approvalRef:null,payload:input};if(hash(original)!==c.request_hash)bad();
    const receipt=object(c.result_ref,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt']);if(receipt.commandId!==c.command_id||receipt.operationId!==c.operation_id||receipt.projectId!==request.projectId||receipt.status!=='APPLIED'||receipt.targetId!==ref.id||receipt.version!==ref.version||array(receipt.evidenceRefs,0).length||array(receipt.warnings,0).length||stamp(receipt.serverReceivedAt)!==at||stamp(c.completed_at)!==at||!same(receipt.data,{ref,...data}))bad();
    const ar=authMap.get(c.authorization_receipt_id),audit=auditMap.get(c.id),scopeDigest=hash({projectId:request.projectId,actorId:c.actor_id,clientId:c.client_id,controlGeneration,requestHash:c.request_hash,policyRef:c.policy_ref,targetRef:ref});
    if(!ar||ar.command_id!==c.id||ar.scope_kind!=='PROJECT'||ar.scope_id!==request.projectId||!same(ar.subject_ref,{kind:'HUMAN',userId:c.actor_id,clientId:c.client_id})||!same(ar.policy_ref,c.policy_ref)||ar.scope_digest!==scopeDigest||ar.approval_decision_ref!==null)bad();stamp(ar.authorized_at);
    if(!audit||audit.command_id!==c.id||audit.project_id!==request.projectId||audit.operation_id!==c.operation_id||!same(audit.actor_ref,{kind:'HUMAN',userId:c.actor_id})||audit.client_ref!==c.client_id||!same(audit.target_ref,ref)||!same(audit.policy_ref,c.policy_ref)||audit.approval_ref!==null||audit.outcome!=='APPLIED'||audit.reason_code!==reason||audit.scope_digest!==scopeDigest||audit.source_kind!=='HUMAN_COMMAND'||audit.correction_of!==null)bad();stamp(audit.recorded_at);
    externalRef('POLICY_VERSION',c.policy_ref);external({kind:'AUTHORIZATION_RECEIPT',id:ar.id,verification:'NOT_PERFORMED'});return{serverSequence:audit.server_sequence,authorizationReceiptRef:{id:ar.id,version:1,contentHash:scopeDigest}};
   }
   function push(destination:Row[],value:Row){safe(value);destination.push({...value,projectionHash:hash(value)});}
   for(const row of draftRows){
    check();const version=integer(row.version,1),ref=refFor(row,row.draft_id,version),s=object(row.version_json,['definition','reason','previousRef','basis','readinessIssues','status','ready','executionAuthorized','dispatchPerformed']);safe(s);if(hash(s)!==ref.contentHash||s.status!=='DRAFT')bad();falseFlags(s);
    const input={baseRef:s.previousRef,definition:s.definition,reason:s.reason},analysis=readAssignmentDraftInput(input),definition=analysis.input.definition,basis=object(s.basis,['planRef','applicationRef','designRef','taskCode','nodeId','taskCardHash']);
    if(!same(basis.planRef,definition.taskRef.planRef)||!same(basis.applicationRef,definition.taskRef.applicationRef)||basis.taskCode!==definition.taskRef.taskCode||basis.nodeId!==definition.taskRef.nodeId||!isVersionRef(basis.designRef)||!digest(basis.taskCardHash)||definition.baselineRefs.some(r=>![basis.planRef,basis.applicationRef,basis.designRef].some(b=>same(r,b))))bad();
    const expectedIssues=[...analysis.readinessIssues];if(!definition.baselineRefs.some(r=>same(r,basis.designRef)))expectedIssues.push({code:'BASELINE_REFERENCE_MISSING',location:'baselineRefs'});if(!same(s.readinessIssues,expectedIssues))bad();
    const previous=lastDraft.get(ref.id);if(!previous?(version!==1||s.previousRef!==null):(version!==previous.ref.version+1||!same(s.previousRef,previous.ref)||!same(definition.parentAssignmentRef,previous.snapshot.definition.parentAssignmentRef)))bad();
    const sourceEvidence=evidence(row,ref,input,'prepareAssignment',{status:'ASSIGNMENT_DRAFT_STORED',snapshot:s},'EXPLICIT_ASSIGNMENT_DRAFT_ONLY');if(previous&&previous.sourceEvidence.serverSequence>=sourceEvidence.serverSequence)bad();
    const entry={ref,snapshot:s,sourceEvidence,at:stamp(row.created_at),actor:row.created_by,client:row.client_id};if(draftMap.has(canonicalJson(ref)))bad();draftMap.set(canonicalJson(ref),entry);if(!previous)firstDraft.set(ref.id,entry);lastDraft.set(ref.id,entry);
    push(draftVersions,{ref,snapshot:s,createdBy:{kind:'HUMAN'},registeredAt:entry.at,sourceEvidence});definitionDependencies(definition,basis);
   }
   if(headRows.length!==lastDraft.size)bad();for(const row of headRows){const first=firstDraft.get(row.id),last=lastDraft.get(row.id);if(!first||!last||integer(row.head_version,1)!==last.ref.version||row.created_by!==first.actor||row.client_id!==first.client||stamp(row.created_at)!==first.at||stamp(row.updated_at)!==last.at)bad();drafts.push({id:row.id,headVersion:last.ref.version,createdAt:first.at,updatedAt:last.at,createdBy:{kind:'HUMAN'}});}
   for(const row of reviewRows){
    check();const ref=refFor(row,row.review_id),s=object(row.review_json,['draftRef','criteriaVersion','items','outcome','reason','reviewedBy','reviewedAt','independence']);bounded(s);if(hash(s)!==ref.contentHash)bad();
    const input=readAssignmentContentReview({draftRef:s.draftRef,criteriaVersion:s.criteriaVersion,items:s.items,outcome:s.outcome,reason:s.reason}),draft=draftMap.get(canonicalJson(input.draftRef));
    if(!draft||row.draft_id!==input.draftRef.id||integer(row.draft_version,1)!==input.draftRef.version||row.draft_hash!==input.draftRef.contentHash||s.independence!=='NOT_CLAIMED'||stamp(s.reviewedAt)!==stamp(row.created_at))bad();person(s.reviewedBy,row);
    const sourceEvidence=evidence(row,ref,input,'reviewAssignmentContent',{status:'ASSIGNMENT_CONTENT_REVIEWED',snapshot:s},'EXPLICIT_ASSIGNMENT_CONTENT_REVIEW');if(draft.sourceEvidence.serverSequence>=sourceEvidence.serverSequence)bad();
    const entry={ref,snapshot:s,sourceEvidence};reviewMap.set(canonicalJson(ref),entry);push(reviews,{ref,snapshot:{...structuredClone(s),reviewedBy:{kind:'HUMAN'}},sameAuthor:row.created_by===draft.actor,sourceEvidence});
   }
   for(const row of confirmationRows){
    check();const version=integer(row.version,1),ref=refFor(row,row.assignment_id,version),s=object(row.version_json,['draftRef','definition','reviewRefs','reason','confirmedBy','confirmedAt','contentConfirmed','readinessIssues','ready','executionAuthorized','dispatchPerformed']);bounded(s);if(hash(s)!==ref.contentHash)bad();falseFlags(s);person(s.confirmedBy,row);
    const input=readAssignmentConfirmation({draftRef:s.draftRef,reviewRefs:s.reviewRefs,reason:s.reason,acknowledged:true}),draft=draftMap.get(canonicalJson(input.draftRef));
    if(!draft||input.draftRef.id!==ref.id||input.draftRef.version!==version||!same(s.definition,draft.snapshot.definition)||!same(s.readinessIssues,draft.snapshot.readinessIssues)||s.contentConfirmed!==true||stamp(s.confirmedAt)!==stamp(row.created_at)||!uuidV1(row.confirmation_id)||confirmationIds.has(row.confirmation_id))bad();confirmationIds.add(row.confirmation_id);
    if(draft.snapshot.readinessIssues.some((issue:Row)=>['REQUIRED_TEXT_MISSING','REQUIRED_LIST_MISSING','SOURCE_SCOPE_MISSING','BASELINE_REFERENCE_MISSING'].includes(issue.code)))bad();
    const sourceEvidence=evidence(row,ref,input,'confirmAssignment',{status:'ASSIGNMENT_CONTENT_CONFIRMED',confirmationId:row.confirmation_id,snapshot:s},'EXPLICIT_ASSIGNMENT_CONTENT_ONLY');
    for(const selected of input.reviewRefs){const review=reviewMap.get(canonicalJson(selected));if(!review||!same(review.snapshot.draftRef,input.draftRef)||review.snapshot.outcome!=='ACCEPTED'||review.sourceEvidence.serverSequence>=sourceEvidence.serverSequence)bad();}
    const preceding=[...reviewMap.values()].filter(r=>same(r.snapshot.draftRef,input.draftRef)&&r.sourceEvidence.serverSequence<sourceEvidence.serverSequence).sort((a,b)=>b.sourceEvidence.serverSequence-a.sourceEvidence.serverSequence),latest=preceding[0];if(!latest||latest.snapshot.outcome!=='ACCEPTED'||!input.reviewRefs.some(r=>same(r,latest.ref)))bad();
    const entry={ref,snapshot:s,sourceEvidence};confirmationMap.set(canonicalJson(ref),entry);push(confirmations,{ref,confirmationId:row.confirmation_id,snapshot:{...structuredClone(s),confirmedBy:{kind:'HUMAN'}},sourceEvidence});
   }
   // 역사 exact 부모 원문으로만 부분집합을 검사한다. 현재 head/OS/권한은 재조회하지 않는다.
   for(const child of draftMap.values()){
    const d=child.snapshot.definition,parentRef=d.parentAssignmentRef;if(parentRef===null)continue;const parent=confirmationMap.get(canonicalJson(parentRef));if(!parent||parent.ref.id===child.ref.id||parent.snapshot.definition.parentAssignmentRef!==null||parent.sourceEvidence.serverSequence>=child.sourceEvidence.serverSequence)bad();const p=parent.snapshot.definition;
    if(!same(d.taskRef.planRef,p.taskRef.planRef)||!same(d.taskRef.applicationRef,p.taskRef.applicationRef)||d.taskRef.nodeId!==p.taskRef.nodeId||['environmentRef','budgetRef','recordingPolicyRef'].some(k=>!same(d[k],p[k]))||d.baselineRefs.some((r:Row)=>!p.baselineRefs.some((b:Row)=>same(r,b)))||d.requiredCapabilities.some((v:string)=>!p.requiredCapabilities.includes(v))||d.allowedScopes.length>0&&!inspectSourceScopeContainment(p.allowedScopes,d.allowedScopes).scopeContained)bad();
   }
   if(rows.length)issues.push({code:'EXTERNAL_BASELINE_AND_CURRENT_AUTHORITY_NOT_VERIFIED'});
   externalDependencies.sort((a,b)=>canonicalJson(a)<canonicalJson(b)?-1:canonicalJson(a)>canonicalJson(b)?1:0);
   const end=await rrObservation(db);if(end.snapshot!==start.snapshot)bad();const projection={projectId:request.projectId,drafts,draftVersions,reviews,confirmations,issues,externalDependencies};safe(projection);
   const result:Row={kind:'ASSIGNMENT_INVENTORY_V1',scope:'PROJECT_ASSIGNMENT_HISTORY_ONLY',...projection,observation:{snapshot:start.snapshot,startedAt:start.at,finishedAt:end.at,isolation:'repeatable read',readOnly:true,authBoundary:'START_AND_END_READ_COMMITTED'},contentHash:hash(projection),usage:{metadataBytes:0,inputBytes:0,fileCount:0},metadataComplete:issues.length===0&&externalDependencies.length===0,taskCardVerification:'NOT_PERFORMED',externalBaselineVerification:'NOT_PERFORMED',currentApplicationVerification:'NOT_PERFORMED',parentCurrentnessVerification:'NOT_PERFORMED',sourceOsVerification:'NOT_PERFORMED',sourceScopeContainment:'EXACT_STORED_PARENT_SUBSET_ONLY',policyVerification:'NOT_PERFORMED',auditChainVerification:'NOT_PERFORMED',blobVerification:'NOT_PERFORMED',executionEvidence:'NOT_CONNECTED',fullProjectCoverage:false,restorable:false,ready:false,executionAuthorized:false,dispatchPerformed:false,atomicSnapshotVerified:false};
   check();rollbackTried=true;await db.query('ROLLBACK');begun=false;beginSent=false;const releasing=db;db=undefined;releasing.release();result.observation.finishedAt=await boundary();check();
   for(let n=0;n<17;n++){const bytes=Buffer.byteLength(canonicalJson(result));if(bytes>request.limits.metadataBytes)bad('ASSIGNMENT_INVENTORY_LIMIT',413);if(bytes===result.usage.metadataBytes){check();return result;}result.usage.metadataBytes=bytes;}return bad();
  }catch(error){
   if(db){if(beginSent&&!begun)releaseError=new Error('ASSIGNMENT_INVENTORY_BEGIN_UNKNOWN');if(begun){if(rollbackTried)releaseError=new Error('ASSIGNMENT_INVENTORY_CLEANUP_UNKNOWN');else{rollbackTried=true;try{await db.query('ROLLBACK');begun=false;}catch{releaseError=new Error('ASSIGNMENT_INVENTORY_CLEANUP_UNKNOWN');}}}}
   if(releaseError)bad('ASSIGNMENT_INVENTORY_STORAGE_FAILED',503);throw error;
  }finally{if(db){try{db.release(releaseError);}catch{bad('ASSIGNMENT_INVENTORY_STORAGE_FAILED',503);}}}
 }catch(error){if(error instanceof AuthFailure&&(ownErrors.has(error)||error.message==='AUTH_REQUIRED'&&error.statusCode===401||error.message==='NOT_FOUND'&&error.statusCode===404))throw new AuthFailure(error.message,error.statusCode);throw new AuthFailure('ASSIGNMENT_INVENTORY_INTEGRITY_FAILED',503);}
}
