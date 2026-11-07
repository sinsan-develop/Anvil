import type {PoolClient} from 'pg';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {prepareResultReview} from '../results/result-review-input.ts';
import {readSourceScopesV1} from '../../../../contracts/runtime/source-scope-v1.ts';
import {readSubmittedResultRecord} from '../results/result-submission-store.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {readDocumentInventoryInput} from './document-inventory-input.ts';
type Row=Record<string,any>;
const columns={
 result_criteria_versions:'project_id criteria_id version assignment_ref assignment_id assignment_version content_hash criteria_json input_json created_by client_id command_id created_at'.split(' '),
 result_reviews:'project_id id result_id criteria_id criteria_version content_hash snapshot_json created_by client_id command_id created_at'.split(' '),
 result_rework_drafts:'project_id id result_id review_id binding_id binding_version content_hash snapshot_json created_by client_id command_id created_at'.split(' '),
 result_submissions:'project_id id content_hash snapshot_json submitted_by submitted_at'.split(' '),
 commands:'id command_id scope_kind scope_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id payload_ref completed_at operation_id request_hash'.split(' '),
 authorization_receipts:'id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at'.split(' '),
 audit_events:'project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of'.split(' ')
};
type Table=keyof typeof columns;
const ownErrors=new WeakSet<AuthFailure>();
function bad(code='RESULT_REVIEW_HISTORY_INVENTORY_INTEGRITY_FAILED',status=503):never{const e=new AuthFailure(code,status);ownErrors.add(e);throw e;}
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


/** 결과 검수 기준·검토·재작업의 내부 metadata 역사다. 실제 검수/실행/복원 권한을 발급하지 않는다. */
export async function collectResultReviewHistoryInventory(access:AccessRepository,token:string,value:unknown,signal:AbortSignal):Promise<Row>{
 const request=readDocumentInventoryInput(value),started=performance.now();let authDeadline=Infinity,identity:AuthenticatedIdentity|undefined,metadataUsed=0;
 const check=()=>{if(signal.aborted)bad('RESULT_REVIEW_HISTORY_INVENTORY_CANCELLED',409);if(performance.now()-started>=request.limits.deadlineMs||performance.now()>=authDeadline)bad('RESULT_REVIEW_HISTORY_INVENTORY_DEADLINE',413);};
 async function query(db:PoolClient,sql:string,values:unknown[]=[]){
  check();const remaining=Math.floor(Math.min(request.limits.deadlineMs-(performance.now()-started),authDeadline-performance.now()));if(remaining<1)bad('RESULT_REVIEW_HISTORY_INVENTORY_DEADLINE',413);
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
  const out:Row[]=[],key=table==='audit_events'?'event_id':table==='result_criteria_versions'?'criteria_id':'id';let last:string|null=null,lastVersion=0;const composite=table==='result_criteria_versions';
  for(;;){
   check();const values:unknown[]=[request.projectId],conditions=[table==='authorization_receipts'?'t.scope_id=$1::uuid':'t.project_id=$1::uuid'],bind=(v:unknown)=>{values.push(v);return'$'+values.length;};
   if(table==='commands')conditions.push("t.scope_kind='PROJECT'",'t.scope_id=$1::uuid',"t.operation IN ('saveResultCriteria','evaluateResult','requestRework')");
   if(table==='authorization_receipts')conditions.push("t.scope_kind='PROJECT'");
   if(!['result_criteria_versions','result_reviews','result_rework_drafts'].includes(table)&&(!selection||!selection.length||selection.length>200))bad();
   if(selection)conditions.push(`t.${table==='audit_events'?'command_id':'id'}=ANY(${bind(selection)}::uuid[])`);
   if(last!==null)conditions.push(composite?`(t.criteria_id,t.version)>(${bind(last)}::uuid,${bind(lastVersion)}::bigint)`:`t.${key}>${bind(last)}::uuid`);
   const remaining=request.limits.metadataBytes-metadataUsed;if(remaining<=0)bad('RESULT_REVIEW_HISTORY_INVENTORY_LIMIT',413);const cap=bind(remaining);
   const sql=`WITH inventory_row AS (SELECT ${columns[table].map(k=>'t.'+k).join(',')} FROM anvil.${table} t WHERE ${conditions.join(' AND ')} ORDER BY t.${key}${composite?',t.version':''} LIMIT 200)
    SELECT CASE WHEN octet_length(to_jsonb(inventory_row)::text)<=${cap}::bigint THEN to_jsonb(inventory_row) ELSE NULL END AS inventory_data,
    octet_length(to_jsonb(inventory_row)::text) AS row_bytes FROM inventory_row ORDER BY inventory_row.${key}${composite?',inventory_row.version':''}`;
   const result=(await query(db,sql,values)).result;if(!Array.isArray(result.rows)||result.rows.length>200)bad();
   for(const raw of result.rows){
    check();const envelope=object(raw,['inventory_data','row_bytes']),size=integer(envelope.row_bytes,1);if(size>remaining||metadataUsed>request.limits.metadataBytes-size)bad('RESULT_REVIEW_HISTORY_INVENTORY_LIMIT',413);
    const row=object(envelope.inventory_data,columns[table]),id=row[key],version=composite?integer(row.version,1):0;if(!uuidV1(id)||last!==null&&(id<last||id===last&&(!composite||version<=lastVersion))||(table==='authorization_receipts'?row.scope_kind!=='PROJECT'||row.scope_id!==request.projectId:row.project_id!==request.projectId)||selection&&!selection.includes(row[table==='audit_events'?'command_id':'id']))bad();
    last=id;lastVersion=version;metadataUsed+=size;out.push(structuredClone(row));
   }
   if(result.rows.length<200)return out;
  }
 }
 async function selectedRows(db:PoolClient,table:Table,ids:string[]){const selected=[...new Set(ids)].sort();if(selected.some(id=>!uuidV1(id)))bad();const out:Row[]=[];for(let batchStart=0;batchStart<selected.length;batchStart+=200)out.push(...await pageRows(db,table,selected.slice(batchStart,batchStart+200)));return out;}
 async function rrObservation(db:PoolClient){const rows=(await query(db,"SELECT current_setting('transaction_isolation') AS isolation,current_setting('transaction_read_only') AS read_only,pg_current_snapshot()::text AS snapshot,clock_timestamp() AS at")).result.rows;const state=rows.length===1?rows[0]:null;if(state?.isolation!=='repeatable read'||state.read_only!=='on'||typeof state.snapshot!=='string'||!/^\d+:\d+:[\d,]*$/.test(state.snapshot)||!(state.at instanceof Date)||!Number.isFinite(state.at.getTime()))bad();return{snapshot:state.snapshot,at:state.at.toISOString()};}
 const safe=(v:unknown)=>{if(inspectArtifact(Buffer.from(canonicalJson(v))).state==='SUSPECTED')bad('RESULT_REVIEW_HISTORY_INVENTORY_SENSITIVE_METADATA',503);};
 try{
  await boundary();let db:PoolClient|undefined,beginSent=false,begun=false,rollbackTried=false,releaseError:Error|undefined;
  try{
   db=await access.pool.connect();check();beginSent=true;await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;check();const start=await rrObservation(db);await owner(db,identity!);
   const criteriaRows=await pageRows(db,'result_criteria_versions'),reviewRows=await pageRows(db,'result_reviews'),reworkRows=await pageRows(db,'result_rework_drafts'),rows=[...criteriaRows,...reviewRows,...reworkRows];
   const commandIds=rows.map(r=>r.command_id);if(new Set(commandIds).size!==commandIds.length)bad();
   const commandRows=await selectedRows(db,'commands',commandIds),commands=new Map(commandRows.map(c=>[c.id,c]));if(commands.size!==commandIds.length)bad();
   const authIds=commandRows.map(c=>c.authorization_receipt_id);if(new Set(authIds).size!==authIds.length)bad();const authRows=await selectedRows(db,'authorization_receipts',authIds),authMap=new Map(authRows.map(a=>[a.id,a]));if(authMap.size!==authIds.length)bad();
   const auditRows=await selectedRows(db,'audit_events',commandIds),auditMap=new Map<string,Row>(),auditSequences=new Set<number>();for(const a of auditRows){const seq=integer(a.server_sequence,1);if(!commands.has(a.command_id)||auditMap.has(a.command_id)||auditSequences.has(seq))bad();a.server_sequence=seq;auditMap.set(a.command_id,a);auditSequences.add(seq);}if(auditMap.size!==commands.size)bad();
   const resultIds=[...new Set([...reviewRows,...reworkRows].map(r=>r.result_id))],resultRows=await selectedRows(db,'result_submissions',resultIds),results=new Map<string,Row>();if(resultRows.length!==resultIds.length)bad();
   for(const row of resultRows){check();if(!digest(row.content_hash)||!uuidV1(row.submitted_by)||results.has(row.id))bad();safe(row.snapshot_json);const s=object(row.snapshot_json,['scope','submittedByRef','submittedAt'],false),scope=object(s.scope,['projectId','assignmentRef','executionRef']);if(scope.projectId!==request.projectId||!isVersionRef(scope.assignmentRef)||!isVersionRef(scope.executionRef))bad();const entry=readSubmittedResultRecord({ref:{id:row.id,version:1,contentHash:row.content_hash},snapshot:row.snapshot_json},scope as any,row.id,start.at);if(row.submitted_by!==entry.snapshot.submittedByRef.id||stamp(row.submitted_at)!==entry.snapshot.submittedAt)bad();results.set(row.id,{...entry,at:stamp(row.submitted_at)});}
   const criteria:Row[]=[],reviews:Row[]=[],reworks:Row[]=[],issues:Row[]=[],externalDependencies:Row[]=[],externalKeys=new Set<string>(),usedRequests=new Set<string>(),criteriaMap=new Map<string,Row>(),reviewMap=new Map<string,Row>(),heads=new Map<string,Row>();
   function external(item:Row){safe(item);const key=canonicalJson(item);if(!externalKeys.has(key)){externalKeys.add(key);externalDependencies.push(structuredClone(item));}}
   function externalRef(kind:string,value:unknown){if(!isVersionRef(value))bad();external({kind,ref:value,verification:'NOT_PERFORMED'});}
   function array(value:any,max:number,min=0):any[]{if(!Array.isArray(value)||value.length<min||value.length>max)bad();return value;}
   const code=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(v);
   function text(v:unknown){if(typeof v!=='string'||!v.isWellFormed()||!v.trim()||v.length>20000)bad();safe(v);}
   function bounded(v:unknown){safe(v);if(Buffer.byteLength(canonicalJson(v))>2097152)bad();}
   function refFor(row:Row,id:string,version=1){if(!uuidV1(id)||!digest(row.content_hash))bad();return{id,version,contentHash:row.content_hash};}
   function projectScope(v:unknown){const s=object(v,['projectId','assignmentRef','executionRef']);if(s.projectId!==request.projectId||!isVersionRef(s.assignmentRef)||!isVersionRef(s.executionRef))bad();return s;}
   function scopeExternal(s:Row){externalRef('ASSIGNMENT_VERSION',s.assignmentRef);externalRef('EXECUTION_REFERENCE',s.executionRef);}
   function person(v:unknown,row:Row){if(!same(object(v,['kind','userId','clientId']),{kind:'HUMAN',userId:row.created_by,clientId:row.client_id}))bad();}
   function falseFlags(s:Row,keys:string[]){if(keys.some(k=>s[k]!==false))bad();}
   function evidence(row:Row,ref:Row,input:unknown,operation:string,data:Row,reason:string){
    if(!uuidV1(row.created_by)||!uuidV1(row.client_id)||!uuidV1(row.command_id))bad();const at=stamp(row.created_at),expectedVersion=operation==='saveResultCriteria'?ref.version-1:0,c=commands.get(row.command_id);
    if(!c||c.project_id!==request.projectId||c.scope_kind!=='PROJECT'||c.scope_id!==request.projectId||c.operation!==operation||c.state!=='APPLIED'||c.actor_id!==row.created_by||c.client_id!==row.client_id||!uuidV1(c.command_id)||!uuidV1(c.operation_id)||!uuidV1(c.authorization_receipt_id)||!isVersionRef(c.policy_ref)||!digest(c.request_hash)||integer(c.expected_version)!==expectedVersion||c.approval_consumption_id!==null||c.payload_ref!==null)bad();
    const controlGeneration=integer(c.control_generation,1),requestKey=c.actor_id+':'+c.command_id;if(usedRequests.has(requestKey))bad();usedRequests.add(requestKey);
    const original={schemaVersion:1,projectId:request.projectId,commandId:c.command_id,clientId:c.client_id,controlGeneration,operation,targetId:operation==='saveResultCriteria'&&ref.version>1?ref.id:null,expectedVersion,baselineRefs:[],approvalRef:null,payload:input};if(hash(original)!==c.request_hash)bad();
    const receipt=object(c.result_ref,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt']);if(receipt.commandId!==c.command_id||receipt.operationId!==c.operation_id||receipt.projectId!==request.projectId||receipt.status!=='APPLIED'||receipt.targetId!==ref.id||receipt.version!==ref.version||array(receipt.evidenceRefs,0).length||array(receipt.warnings,0).length||stamp(receipt.serverReceivedAt)!==at||stamp(c.completed_at)!==at||!same(receipt.data,{ref,...data}))bad();
    const ar=authMap.get(c.authorization_receipt_id),audit=auditMap.get(c.id),scopeDigest=hash({projectId:request.projectId,actorId:c.actor_id,clientId:c.client_id,controlGeneration,requestHash:c.request_hash,policyRef:c.policy_ref,targetRef:ref});
    if(!ar||ar.command_id!==c.id||ar.scope_kind!=='PROJECT'||ar.scope_id!==request.projectId||!same(ar.subject_ref,{kind:'HUMAN',userId:c.actor_id,clientId:c.client_id})||!same(ar.policy_ref,c.policy_ref)||ar.scope_digest!==scopeDigest||ar.approval_decision_ref!==null)bad();stamp(ar.authorized_at);
    if(!audit||audit.command_id!==c.id||audit.project_id!==request.projectId||audit.operation_id!==c.operation_id||!same(audit.actor_ref,{kind:'HUMAN',userId:c.actor_id})||audit.client_ref!==c.client_id||!same(audit.target_ref,ref)||!same(audit.policy_ref,c.policy_ref)||audit.approval_ref!==null||audit.outcome!=='APPLIED'||audit.reason_code!==reason||audit.scope_digest!==scopeDigest||audit.source_kind!=='HUMAN_COMMAND'||audit.correction_of!==null)bad();stamp(audit.recorded_at);
    externalRef('POLICY_VERSION',c.policy_ref);external({kind:'AUTHORIZATION_RECEIPT',id:ar.id,verification:'NOT_PERFORMED'});return{serverSequence:audit.server_sequence,authorizationReceiptRef:{id:ar.id,version:1,contentHash:scopeDigest}};
   }
   function push(destination:Row[],value:Row){safe(value);destination.push({...value,projectionHash:hash(value)});}
   for(const row of criteriaRows){
    check();const version=integer(row.version,1),ref=refFor(row,row.criteria_id,version),s=object(row.criteria_json,['assignmentRef','baselineRefs','items']),i=object(row.input_json,['assignmentRef','baseRef','items','reason']);bounded({snapshot:s,input:i});
    if(hash(s)!==ref.contentHash||!isVersionRef(s.assignmentRef)||!same(row.assignment_ref,s.assignmentRef)||!same(i.assignmentRef,s.assignmentRef)||row.assignment_id!==s.assignmentRef.id||integer(row.assignment_version,1)!==s.assignmentRef.version)bad();text(i.reason);
    const previous=heads.get(ref.id);if(!previous?(version!==1||i.baseRef!==null):(version!==previous.ref.version+1||!same(i.baseRef,previous.ref)))bad();
    const bases=array(s.baselineRefs,200,1);if(bases.some(v=>!isVersionRef(v))||new Set(bases.map(canonicalJson)).size!==bases.length)bad();const si=array(s.items,100,1),ii=array(i.items,100,1),ids=new Set<string>();if(si.length!==ii.length)bad();const sourceBindings:Row[]=[];
    for(let n=0;n<si.length;n++){const item=object(si[n],['criterionId','testId','kind','environmentRef','required']),inputItem=object(ii[n],['criterionId','testId','kind','environmentRef','sources']);if(!code(item.criterionId)||ids.has(item.criterionId)||!code(item.testId)||!['BUILD','TYPECHECK','UNIT','INTEGRATION','BROWSER','AGENT','DEPLOYMENT','SECURITY'].includes(item.kind)||!isVersionRef(item.environmentRef)||item.required!==true)bad();ids.add(item.criterionId);if(!same({criterionId:inputItem.criterionId,testId:inputItem.testId,kind:inputItem.kind,environmentRef:inputItem.environmentRef,required:true},item))bad();const seen=new Set<string>();for(const value of array(inputItem.sources,20,1)){const source=object(value,['field','index','contentHash']);if(!['acceptanceCriteria','verificationRequirements'].includes(source.field)||!Number.isSafeInteger(source.index)||source.index<0||!digest(source.contentHash))bad();const key=source.field+':'+source.index;if(seen.has(key))bad();seen.add(key);}sourceBindings.push({criterionId:item.criterionId,sources:structuredClone(inputItem.sources)});externalRef('ENVIRONMENT_REFERENCE',item.environmentRef);}
    const sourceEvidence=evidence(row,ref,i,'saveResultCriteria',{status:'RESULT_CRITERIA_STORED',snapshot:s,sourceBindings,registryStored:true,reviewStored:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false},'EXPLICIT_RESULT_CRITERIA_REGISTRATION_ONLY');const at=stamp(row.created_at),value={ref,snapshot:s,input:i,sourceBindings,createdBy:{kind:'HUMAN'},registeredAt:at,sourceEvidence};push(criteria,value);criteriaMap.set(canonicalJson(ref),{...value,at});heads.set(ref.id,value);externalRef('ASSIGNMENT_VERSION',s.assignmentRef);for(const r of bases)externalRef('BASELINE_VERSION',r);
   }
   for(const row of reviewRows){
    check();const ref=refFor(row,row.id),s=object(row.snapshot_json,['scope','input','reviewedBy','sameAsSubmitter','reviewedAt','evidenceProvenanceVerified','completionAccepted','formalFailureCounted','executionAuthorized','dispatchPerformed']);bounded(s);if(hash(s)!==ref.contentHash)bad();const i=object(s.input,['resultRef','criteriaRef','outcome','items','reason']),scope=projectScope(s.scope);if(!isVersionRef(i.resultRef)||!isVersionRef(i.criteriaRef)||i.resultRef.id!==row.result_id||i.criteriaRef.id!==row.criteria_id||i.criteriaRef.version!==integer(row.criteria_version,1))bad();
    const result=results.get(row.result_id),c=criteriaMap.get(canonicalJson(i.criteriaRef)),at=stamp(row.created_at);if(!result||!same(result.ref,i.resultRef)||!c||stamp(s.reviewedAt)!==at||Date.parse(result.at)>Date.parse(at)||Date.parse(c.at)>Date.parse(at))bad();
    const prepared=prepareResultReview({ref:result.ref,snapshot:result.snapshot},{ref:c.ref,snapshot:c.snapshot},i,at);if(!same(prepared.scope,scope)||!same(prepared.input,i)||s.sameAsSubmitter!==(row.created_by===result.snapshot.submittedByRef.id))bad();person(s.reviewedBy,row);falseFlags(s,['evidenceProvenanceVerified','completionAccepted','formalFailureCounted','executionAuthorized','dispatchPerformed']);
    const sourceEvidence=evidence(row,ref,i,'evaluateResult',{status:'RESULT_REVIEW_RECORDED',snapshot:s,reviewStored:true,completionAccepted:false,formalFailureCounted:false,evidenceProvenanceVerified:false,executionAuthorized:false,dispatchPerformed:false},'EXPLICIT_RESULT_REVIEW_NOT_ACCEPTANCE');push(reviews,{ref,snapshot:{...structuredClone(s),reviewedBy:{kind:'HUMAN'}},sourceEvidence});if(reviewMap.has(ref.id))bad();reviewMap.set(ref.id,{ref,snapshot:s,at});scopeExternal(scope);
   }
   for(const row of reworkRows){
    check();const ref=refFor(row,row.id),s=object(row.snapshot_json,['scope','input','criteriaRef','roleRef','stageSessionRef','remainingMissingItems','preservedItems','requestedBy','requestedAt','scopeVerification','completionAccepted','formalFailureCounted','executionAuthorized','dispatchPerformed']);bounded(s);if(hash(s)!==ref.contentHash)bad();const i=object(s.input,['resultRef','reviewRef','responsibleBindingRef','missingItems','sourceScopes','reason']),scope=projectScope(s.scope);text(i.reason);
    if(!isVersionRef(i.resultRef)||!isVersionRef(i.reviewRef)||!isVersionRef(i.responsibleBindingRef)||!isVersionRef(s.criteriaRef)||!isVersionRef(s.roleRef)||!isVersionRef(s.stageSessionRef)||i.resultRef.id!==row.result_id||i.reviewRef.id!==row.review_id||i.responsibleBindingRef.id!==row.binding_id||i.responsibleBindingRef.version!==integer(row.binding_version,1))bad();
    const result=results.get(row.result_id),review=reviewMap.get(row.review_id),at=stamp(row.created_at);if(!result||!same(result.ref,i.resultRef)||!review||!same(review.ref,i.reviewRef)||!same(review.snapshot.input.resultRef,i.resultRef)||!same(review.snapshot.input.criteriaRef,s.criteriaRef)||!same(scope,review.snapshot.scope)||!same(scope,result.snapshot.scope)||stamp(s.requestedAt)!==at||Date.parse(result.at)>Date.parse(at)||Date.parse(review.at)>Date.parse(at))bad();
    const missing=array(i.missingItems,100,1),all=review.snapshot.input.items.filter((x:Row)=>['REWORK','BLOCKED'].includes(x.outcome)).map((x:Row)=>x.criterionId);if(missing.some(x=>!code(x)||!all.includes(x))||new Set(missing).size!==missing.length||!same(s.remainingMissingItems,all.filter((x:string)=>!missing.includes(x)))||!same(s.preservedItems,[])||s.scopeVerification!=='ASSIGNMENT_SUBSET_ONLY_NOT_OS_VERIFIED')bad();
    const sourceScopes=readSourceScopesV1(i.sourceScopes);person(s.requestedBy,row);falseFlags(s,['completionAccepted','formalFailureCounted','executionAuthorized','dispatchPerformed']);
    const sourceEvidence=evidence(row,ref,i,'requestRework',{status:'RESULT_REWORK_DRAFT_STORED',snapshot:s,reworkStored:true,currentBindingVerified:false,currentAuthorityVerified:false,completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false},'EXPLICIT_REWORK_DRAFT_NOT_ASSIGNMENT');push(reworks,{ref,snapshot:{...structuredClone(s),requestedBy:{kind:'HUMAN'}},sourceEvidence});scopeExternal(scope);externalRef('ROLE_REFERENCE',s.roleRef);externalRef('STAGE_SESSION_REFERENCE',s.stageSessionRef);externalRef('RESPONSIBLE_BINDING_REFERENCE',i.responsibleBindingRef);for(const source of sourceScopes){externalRef('SOURCE_ROOT_REFERENCE',source.sourceRootRef);if(source.mappingRef!==null)externalRef('SOURCE_MAPPING_REFERENCE',source.mappingRef);externalRef('SOURCE_OBSERVATION_REFERENCE',source.observationRef);externalRef('BASELINE_VERSION',source.baselineRef);}
   }
   for(const result of results.values())external({kind:'RESULT_SUBMISSION_REFERENCE',ref:result.ref,snapshotHashVerified:true,submissionCommandEvidenceVerification:'NOT_PERFORMED'});
   if(rows.length)issues.push({code:'ASSIGNMENT_AND_SOURCE_SCOPE_NOT_RECHECKED'},{code:'EVIDENCE_AND_CURRENT_AUTHORITY_NOT_VERIFIED'});
   externalDependencies.sort((a,b)=>canonicalJson(a)<canonicalJson(b)?-1:canonicalJson(a)>canonicalJson(b)?1:0);
   const end=await rrObservation(db);if(end.snapshot!==start.snapshot)bad();const projection={projectId:request.projectId,criteria,reviews,reworks,issues,externalDependencies};safe(projection);
   const result:Row={kind:'RESULT_REVIEW_HISTORY_INVENTORY_V1',scope:'PROJECT_RESULT_REVIEW_HISTORY_ONLY',...projection,observation:{snapshot:start.snapshot,startedAt:start.at,finishedAt:end.at,isolation:'repeatable read',readOnly:true,authBoundary:'START_AND_END_READ_COMMITTED'},contentHash:hash(projection),usage:{metadataBytes:0,inputBytes:0,fileCount:0},metadataComplete:issues.length===0&&externalDependencies.length===0,assignmentSourceVerification:'NOT_PERFORMED',scopeVerificationRecheck:'NOT_PERFORMED',bindingVerification:'NOT_PERFORMED',executionReferenceVerification:'NOT_PERFORMED',submissionCommandEvidenceVerification:'NOT_PERFORMED',evidenceProvenanceVerification:'NOT_PERFORMED',policyVerification:'NOT_PERFORMED',auditChainVerification:'NOT_PERFORMED',blobVerification:'NOT_PERFORMED',reviewCancellationHistory:'NOT_SUPPORTED_BY_CURRENT_SCHEMA',resultSubmissions:'REFERENCE_SNAPSHOTS_ONLY',evidenceProvenanceVerified:false,completionAccepted:false,formalFailureCounted:false,executionEvidence:'NOT_CONNECTED',fullProjectCoverage:false,restorable:false,executionAuthorized:false,dispatchPerformed:false,atomicSnapshotVerified:false};
   check();rollbackTried=true;await db.query('ROLLBACK');begun=false;beginSent=false;const releasing=db;db=undefined;releasing.release();result.observation.finishedAt=await boundary();check();
   for(let n=0;n<17;n++){const bytes=Buffer.byteLength(canonicalJson(result));if(bytes>request.limits.metadataBytes)bad('RESULT_REVIEW_HISTORY_INVENTORY_LIMIT',413);if(bytes===result.usage.metadataBytes){check();return result;}result.usage.metadataBytes=bytes;}return bad();
  }catch(error){
   if(db){if(beginSent&&!begun)releaseError=new Error('RESULT_REVIEW_HISTORY_INVENTORY_BEGIN_UNKNOWN');if(begun){if(rollbackTried)releaseError=new Error('RESULT_REVIEW_HISTORY_INVENTORY_CLEANUP_UNKNOWN');else{rollbackTried=true;try{await db.query('ROLLBACK');begun=false;}catch{releaseError=new Error('RESULT_REVIEW_HISTORY_INVENTORY_CLEANUP_UNKNOWN');}}}}
   if(releaseError)bad('RESULT_REVIEW_HISTORY_INVENTORY_STORAGE_FAILED',503);throw error;
  }finally{if(db){try{db.release(releaseError);}catch{bad('RESULT_REVIEW_HISTORY_INVENTORY_STORAGE_FAILED',503);}}}
 }catch(error){if(error instanceof AuthFailure&&(ownErrors.has(error)||error.message==='AUTH_REQUIRED'&&error.statusCode===401||error.message==='NOT_FOUND'&&error.statusCode===404))throw new AuthFailure(error.message,error.statusCode);throw new AuthFailure('RESULT_REVIEW_HISTORY_INVENTORY_INTEGRITY_FAILED',503);}
}
