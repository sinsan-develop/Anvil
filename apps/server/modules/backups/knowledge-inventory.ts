import type {PoolClient} from 'pg';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {readKnowledgeEntry,assertKnowledgeTextSafe,type KnowledgeEntry} from '../knowledge/knowledge-entry.ts';
import {knowledgeState,assertKnowledgeHistory,readConstitutionApplication} from '../knowledge/knowledge-state.ts';
import {readKnowledgeReviewInput,knowledgeReviewCriteria,acceptedKnowledgeReviews,type StoredKnowledgeReview} from '../knowledge/knowledge-reviews.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {readDocumentInventoryInput} from './document-inventory-input.ts';

type Row=Record<string,any>;
const columns={
 knowledge_entries:'id project_id kind head_version created_by client_id command_id created_at'.split(' '),
 knowledge_versions:'project_id entry_id version title content_artifact_id content_hash source_refs reason scope_json related_refs entry_json supersedes_version created_by client_id command_id created_at'.split(' '),
 knowledge_events:'id project_id entry_id version kind reason actor_ref approval_ref target_refs client_id command_id recorded_at base_ref change_sources review_refs'.split(' '),
 content_reviews:'id scope_kind scope_id project_id target_kind target_id target_version target_hash criteria_version criteria_snapshot_json items_json outcome reviewer_user_id client_id reviewer_subject_ref source_kind reason command_id created_at'.split(' '),
 constitution_applications:'project_id application_version content_hash entry_id version confirmation_id snapshot_json applied_by client_id command_id created_at'.split(' '),
 project_constitutions:'project_id application_version application_hash entry_id version'.split(' '),
 artifacts:'id project_id bytes content_hash media_type state inspection_json'.split(' '),
 commands:'id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id'.split(' '),
 audit_events:'event_id project_id command_id server_sequence'.split(' '),
 authorization_receipts:'id command_id policy_ref'.split(' ')
};
type Table=keyof typeof columns;
const ownErrors=new WeakSet<AuthFailure>();
function bad(code='KNOWLEDGE_INVENTORY_INTEGRITY_FAILED',status=503):never{const e=new AuthFailure(code,status);ownErrors.add(e);throw e;}
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
function inspection(value:unknown):'UNKNOWN'|'NO_KNOWN_MARKER'|'SUSPECTED'{
 if(value===null)return'UNKNOWN';try{const v=object(value,['policyVersion','method','complete','state','reasonCodes']);if(v.policyVersion!==1||v.method!=='KNOWN_PATTERNS_RAW_BYTES'||v.complete!==false||!Array.isArray(v.reasonCodes)||v.reasonCodes.some((r:unknown)=>!['PRIVATE_KEY_MARKER','BEARER_TOKEN_MARKER','SECRET_ASSIGNMENT_MARKER'].includes(String(r)))||new Set(v.reasonCodes).size!==v.reasonCodes.length)return'UNKNOWN';if(v.state==='NO_KNOWN_MARKER'&&v.reasonCodes.length===0)return'NO_KNOWN_MARKER';if(v.state==='SUSPECTED'&&v.reasonCodes.length>0)return'SUSPECTED';}catch{}return'UNKNOWN';
}

/** 원문 접근 없는 내부 지식·헌법 metadata 관측이다. archive/복원·명령 실행 권한을 발급하지 않는다. */
export async function collectKnowledgeInventory(access:AccessRepository,token:string,value:unknown,signal:AbortSignal):Promise<Row>{
 const request=readDocumentInventoryInput(value),started=performance.now();let authDeadline=Infinity,identity:AuthenticatedIdentity|undefined,metadataUsed=0;
 const check=()=>{if(signal.aborted)bad('KNOWLEDGE_INVENTORY_CANCELLED',409);if(performance.now()-started>=request.limits.deadlineMs||performance.now()>=authDeadline)bad('KNOWLEDGE_INVENTORY_DEADLINE',413);};
 async function query(db:PoolClient,sql:string,values:unknown[]=[]){
  check();const remaining=Math.floor(Math.min(request.limits.deadlineMs-(performance.now()-started),authDeadline-performance.now()));if(remaining<1)bad('KNOWLEDGE_INVENTORY_DEADLINE',413);
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
  const out:Row[]=[],keys=table==='knowledge_versions'?['entry_id','version']:table==='constitution_applications'?['application_version']:table==='project_constitutions'?['project_id']:table==='audit_events'?['server_sequence']:['id'];
  const numeric=(k:string)=>['version','application_version','server_sequence'].includes(k);let last:(string|number)[]|null=null;
  for(;;){
   check();const values:unknown[]=[request.projectId],conditions=[table==='authorization_receipts'?'c.project_id=$1::uuid':'t.project_id=$1::uuid'],bind=(v:unknown)=>{values.push(v);return'$'+values.length;};
   if(table==='content_reviews')conditions.push("t.scope_kind='PROJECT'","t.scope_id=$1::uuid","t.target_kind='KNOWLEDGE'");
   if(selection)conditions.push(`t.${table==='audit_events'?'command_id':'id'}=ANY(${bind(selection)}::uuid[])`);
   if(last)conditions.push(`(${keys.map(k=>'t.'+k).join(',')})>(${last.map((v,i)=>bind(v)+(numeric(keys[i]!)?'::bigint':'::uuid')).join(',')})`);
   const remaining=request.limits.metadataBytes-metadataUsed;if(remaining<=0)bad('KNOWLEDGE_INVENTORY_LIMIT',413);const cap=bind(remaining);
   const join=table==='authorization_receipts'?' JOIN anvil.commands c ON c.id=t.command_id':'';
   const sql=`WITH inventory_row AS (SELECT ${columns[table].map(k=>'t.'+k).join(',')} FROM anvil.${table} t${join} WHERE ${conditions.join(' AND ')} ORDER BY ${keys.map(k=>'t.'+k).join(',')} LIMIT 200)
    SELECT CASE WHEN octet_length(to_jsonb(inventory_row)::text)<=${cap}::bigint THEN to_jsonb(inventory_row) ELSE NULL END AS inventory_data,
    octet_length(to_jsonb(inventory_row)::text) AS row_bytes FROM inventory_row ORDER BY ${keys.map(k=>'inventory_row.'+k).join(',')}`;
   const result=(await query(db,sql,values)).result;if(!Array.isArray(result.rows)||result.rows.length>200)bad();
   for(const raw of result.rows){
    check();const envelope=object(raw,['inventory_data','row_bytes']),size=integer(envelope.row_bytes,1);if(size>remaining||metadataUsed>request.limits.metadataBytes-size)bad('KNOWLEDGE_INVENTORY_LIMIT',413);
    const row=object(envelope.inventory_data,columns[table]);if(table!=='authorization_receipts'&&row.project_id!==request.projectId)bad();const tuple=keys.map(k=>numeric(k)?integer(row[k],1):row[k]);
    if(tuple.some((v,i)=>!numeric(keys[i]!)&&!uuidV1(v))||last&&compare(tuple,last)<=0)bad();
    if(selection&&!selection.includes(row[table==='audit_events'?'command_id':'id']))bad();last=tuple;metadataUsed+=size;out.push(structuredClone(row));
   }
   if(result.rows.length<200)return out;
  }
 }
 async function selectedRows(db:PoolClient,table:Table,ids:string[],onePerId=true){
  const selected=[...new Set(ids)].sort();if(selected.some(id=>!uuidV1(id)))bad();const out:Row[]=[];
  for(let start=0;start<selected.length;start+=200){const batch=selected.slice(start,start+200),rows=await pageRows(db,table,batch);if(onePerId&&rows.length!==batch.length)bad();out.push(...rows);}return out;
 }
 async function rrObservation(db:PoolClient){const rows=(await query(db,"SELECT current_setting('transaction_isolation') AS isolation,current_setting('transaction_read_only') AS read_only,pg_current_snapshot()::text AS snapshot,clock_timestamp() AS at")).result.rows;const state=rows.length===1?rows[0]:null;if(state?.isolation!=='repeatable read'||state.read_only!=='on'||typeof state.snapshot!=='string'||!/^\d+:\d+:[\d,]*$/.test(state.snapshot)||!(state.at instanceof Date)||!Number.isFinite(state.at.getTime()))bad();return{snapshot:state.snapshot,at:state.at.toISOString()};}
 try{
  await boundary();let db:PoolClient|undefined,beginSent=false,begun=false,rollbackTried=false,releaseError:Error|undefined;
  try{
   db=await access.pool.connect();check();beginSent=true;await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;check();const start=await rrObservation(db);await owner(db,identity!);
   const headRows=await pageRows(db,'knowledge_entries'),versionRows=await pageRows(db,'knowledge_versions'),eventRows=await pageRows(db,'knowledge_events'),reviewRows=await pageRows(db,'content_reviews'),applicationRows=await pageRows(db,'constitution_applications'),pointerRows=await pageRows(db,'project_constitutions');
   if(pointerRows.length>1)bad();
   const requiredCommandIds=[...headRows,...versionRows,...eventRows,...reviewRows,...applicationRows].map(r=>r.command_id),commandRows=await selectedRows(db,'commands',requiredCommandIds),commands=new Map<string,Row>();
   for(const c of commandRows){if(commands.has(c.id)||c.state!=='APPLIED'||!uuidV1(c.actor_id)||!uuidV1(c.client_id)||!uuidV1(c.authorization_receipt_id)||!isVersionRef(c.policy_ref))bad();c.expected_version=integer(c.expected_version);c.control_generation=integer(c.control_generation,1);commands.set(c.id,c);}
   function command(row:Row,operation:string,ref:Row,expected:number,user:string,at:unknown){
    const c=commands.get(row.command_id);if(!c||c.operation!==operation||c.expected_version!==expected||c.actor_id!==user||c.client_id!==row.client_id)bad();
    const result=object(c.result_ref,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt']);
    if(!uuidV1(result.operationId)||!uuidV1(result.commandId)||result.projectId!==request.projectId||result.status!=='APPLIED'||result.targetId!==ref.id||result.version!==ref.version||!same(result.data?.ref,ref)||!Array.isArray(result.evidenceRefs)||!Array.isArray(result.warnings)||stamp(result.serverReceivedAt)!==stamp(at))bad();
    return c;
   }
   const entries:Row[]=[],versions:Row[]=[],events:Row[]=[],reviews:Row[]=[],constitutionApplications:Row[]=[],artifacts:Row[]=[],issues:Row[]=[],externalDependencies:Row[]=[];
   const heads=new Map<string,Row>(),versionMap=new Map<string,Row>(),eventMap=new Map<string,Row>(),reviewsByVersion=new Map<string,StoredKnowledgeReview[]>(),artRefs=new Map<string,Row>(),sourceHashes=new Map<string,string>(),externalKeys=new Set<string>();let inputBytes=0;
   const key=(id:string,version:number)=>id+':'+version;
   const safe=(v:unknown)=>{if(inspectArtifact(Buffer.from(canonicalJson(v))).state==='SUSPECTED')bad('KNOWLEDGE_INVENTORY_SENSITIVE_METADATA',503);};
   function external(value:Row){const text=canonicalJson(value);if(!externalKeys.has(text)){externalKeys.add(text);externalDependencies.push(structuredClone(value));}}
   function addRef(ref:Row){const old=artRefs.get(ref.artifactId);if(old&&!same(old,ref))bad();if(!old){if(artRefs.size>=request.limits.fileCount||inputBytes>Number.MAX_SAFE_INTEGER-ref.bytes||inputBytes>request.limits.inputBytes-ref.bytes)bad('KNOWLEDGE_INVENTORY_LIMIT',413);inputBytes+=ref.bytes;artRefs.set(ref.artifactId,structuredClone(ref));}}
   function sources(refs:KnowledgeEntry['sourceRefs']){for(const r of refs){if(r.kind==='ARTIFACT'){const old=sourceHashes.get(r.id);if(old&&old!==r.contentHash)bad();sourceHashes.set(r.id,r.contentHash);}else external({...r,verification:'NOT_PERFORMED'});}}
   for(const h of headRows){if(!uuidV1(h.created_by)||!uuidV1(h.client_id)||!uuidV1(h.command_id))bad();h.head_version=integer(h.head_version,1);heads.set(h.id,h);entries.push({id:h.id,kind:h.kind,headVersion:h.head_version,createdAt:stamp(h.created_at)});}
   for(const row of versionRows){
    check();const head=heads.get(row.entry_id),version=integer(row.version,1),prior=versionMap.get(key(row.entry_id,version-1));if(!head||version>head.head_version||version>1&&!prior||!uuidV1(row.created_by)||!uuidV1(row.client_id)||!digest(row.content_hash))bad();
    const entry=readKnowledgeEntry(row.entry_json,request.projectId);safe(entry);
    if(entry.kind!==head.kind||hash(entry)!==row.content_hash||entry.title!==row.title||entry.reason!==row.reason||entry.contentRef.artifactId!==row.content_artifact_id||!same(entry.sourceRefs,row.source_refs)||!same(entry.scope,row.scope_json)||!same(entry.relatedRefs,row.related_refs)||version===1&&row.supersedes_version!==null||version>1&&integer(row.supersedes_version,1)!==version-1)bad();
    const ref={id:row.entry_id,version,contentHash:row.content_hash};command(row,version===1?'saveKnowledge':'correctKnowledge',ref,version-1,row.created_by,row.created_at);
    if(version===1&&(row.created_by!==head.created_by||row.client_id!==head.client_id||row.command_id!==head.command_id||stamp(row.created_at)!==stamp(head.created_at)))bad();
    addRef(entry.contentRef);sources(entry.sourceRefs);for(const r of entry.scope.stageRefs)external({kind:'METHODOLOGY_STAGE',...r,verification:'NOT_PERFORMED'});for(const r of entry.scope.taskRefs)external({kind:'WORK_PLAN_TASK',...r,verification:'NOT_PERFORMED'});
    versionMap.set(key(row.entry_id,version),{row,entry,ref,events:[],supersedesRef:prior?.ref??null});
   }
   for(const h of heads.values())if(!versionMap.has(key(h.id,h.head_version)))bad();
   const usedEventCommands=new Set<string>();
   for(const row of eventRows){
    check();const v=versionMap.get(key(row.entry_id,integer(row.version,1)));if(!v||!uuidV1(row.id)||eventMap.has(row.id)||usedEventCommands.has(row.command_id)||row.approval_ref!==null||row.target_refs!==null)bad();
    const operation=({PROPOSED:'saveKnowledge',CORRECTED:'correctKnowledge',CONFIRMED:'confirmKnowledge',EXCLUDED:'excludeKnowledge'}as Record<string,string>)[row.kind];if(!operation)bad();const actor=object(row.actor_ref,['kind','userId']);if(actor.kind!=='HUMAN'||!uuidV1(actor.userId))bad();
    const c=command(row,operation,v.ref,['PROPOSED','CORRECTED'].includes(row.kind)?v.ref.version-1:v.ref.version,actor.userId,row.recorded_at);
    assertKnowledgeTextSafe(row.reason);safe(row.reason);v.events.push({...row,command_result:c.result_ref,command_operation:c.operation,command_actor_id:c.actor_id});eventMap.set(row.id,row);usedEventCommands.add(row.command_id);
   }
   for(const v of versionMap.values()){
    v.events.sort((a:Row,b:Row)=>{const order=(kind:string)=>kind==='PROPOSED'||kind==='CORRECTED'?0:kind==='CONFIRMED'?1:2;return order(a.kind)-order(b.kind)||stamp(a.recorded_at).localeCompare(stamp(b.recorded_at))||a.id.localeCompare(b.id);});
    const state=knowledgeState(v.ref.version,heads.get(v.ref.id)!.head_version,v.events.map((e:Row)=>e.kind));assertKnowledgeHistory(v.events,v.ref,v.entry);
    const first=v.events[0];if(first.command_id!==v.row.command_id||!same(first.actor_ref,{kind:'HUMAN',userId:v.row.created_by})||first.client_id!==v.row.client_id||stamp(first.recorded_at)!==stamp(v.row.created_at)||!same(first.base_ref,v.supersedesRef))bad();
    if(v.ref.version>1){const changeSources=readKnowledgeEntry({...v.entry,sourceRefs:first.change_sources},request.projectId).sourceRefs;sources(changeSources);if(!same(first.command_result.data.supersedesRef,v.supersedesRef))bad();}
    const projection={ref:v.ref,entry:v.entry,state,supersedesRef:v.supersedesRef,recordedAt:stamp(v.row.created_at)};versions.push({...projection,projectionHash:hash(projection)});
    for(const e of v.events)events.push({id:e.id,versionRef:v.ref,kind:e.kind,reason:e.reason,actorRef:{kind:'HUMAN'},baseRef:e.base_ref,sourceRefs:e.change_sources,reviewRefs:e.review_refs,recordedAt:stamp(e.recorded_at)});
   }
   const audits=await selectedRows(db,'audit_events',reviewRows.map(r=>r.command_id),false),auditByCommand=new Map<string,Row>(),auditIds=new Set<string>(),auditSequences=new Set<number>();
   for(const a of audits){const n=integer(a.server_sequence,1);if(!uuidV1(a.event_id)||auditIds.has(a.event_id)||auditSequences.has(n)||auditByCommand.has(a.command_id))bad();auditIds.add(a.event_id);auditSequences.add(n);auditByCommand.set(a.command_id,{...a,server_sequence:n});}
   const reviewIds=new Set<string>(),reviewCommands=new Set<string>();
   for(const row of reviewRows){
    check();const v=versionMap.get(key(row.target_id,integer(row.target_version,1))),audit=auditByCommand.get(row.command_id);if(!v||!audit||reviewIds.has(row.id)||reviewCommands.has(row.command_id)||row.scope_kind!=='PROJECT'||row.scope_id!==request.projectId||row.target_kind!=='KNOWLEDGE'||row.target_hash!==v.ref.contentHash||row.source_kind!=='HUMAN_REVIEW'||!uuidV1(row.reviewer_user_id))bad();
    const p=readKnowledgeReviewInput({targetKind:'KNOWLEDGE',targetRef:v.ref,criteriaVersion:integer(row.criteria_version,1),items:row.items_json,outcome:row.outcome,reason:row.reason},v.ref),ref={id:row.id,targetRef:v.ref,criteriaVersion:1 as const,outcome:p.outcome},criteria=knowledgeReviewCriteria(v.entry.kind),reviewer={kind:'HUMAN' as const,userId:row.reviewer_user_id,sameAsTargetRecorder:row.reviewer_user_id===v.row.created_by};
    const snapshot={ref,criteria,items:p.items,reviewer,sourceKind:'HUMAN_REVIEW' as const,reason:p.reason,reviewedAt:stamp(row.created_at)},c=command(row,'recordContentReview',v.ref,v.ref.version,row.reviewer_user_id,row.created_at);
    if(!same(row.criteria_snapshot_json,criteria)||!same(row.reviewer_subject_ref,reviewer)||c.result_ref.data.status!=='REVIEW_RECORDED'||!same(c.result_ref.data.reviewRef,ref)||!same(c.result_ref.data.review,snapshot))bad();safe(snapshot);
    const record:StoredKnowledgeReview={...snapshot,serverSequence:audit.server_sequence},k=key(v.ref.id,v.ref.version);if(!reviewsByVersion.has(k))reviewsByVersion.set(k,[]);reviewsByVersion.get(k)!.push(record);
    reviews.push({...snapshot,reviewer:{kind:'HUMAN',sameAsTargetRecorder:reviewer.sameAsTargetRecorder},serverSequence:audit.server_sequence});reviewIds.add(row.id);reviewCommands.add(row.command_id);
   }
   for(const v of versionMap.values()){const confirmed=v.events.find((e:Row)=>e.kind==='CONFIRMED');if(confirmed){acceptedKnowledgeReviews(v.ref,confirmed.review_refs,reviewsByVersion.get(key(v.ref.id,v.ref.version))??[],false);if(confirmed.command_result.data.confirmationId!==confirmed.id)bad();v.confirmation=confirmed;}}
   const receipts=await selectedRows(db,'authorization_receipts',applicationRows.map(r=>commands.get(r.command_id)?.authorization_receipt_id)),receiptMap=new Map(receipts.map(r=>[r.id,r]));let previous:Row|null=null;
   for(const row of applicationRows){
    check();const n=integer(row.application_version,1);if(n!==(previous?previous.ref.version+1:1)||!digest(row.content_hash))bad();
    const snapshot=object(row.snapshot_json,['projectId','versionRef','confirmationId','reason','acknowledged','reviewRef','previousApplicationRef','appliedBy','controlGeneration']),parsed=readConstitutionApplication({versionRef:snapshot.versionRef,confirmationId:snapshot.confirmationId,reason:snapshot.reason,acknowledged:snapshot.acknowledged}),appliedBy=object(snapshot.appliedBy,['kind','userId','clientId']);
    const v=versionMap.get(key(row.entry_id,integer(row.version,1)));const ref:Row={id:request.projectId,version:n,contentHash:row.content_hash};
    if(!v||v.entry.kind!=='CONSTITUTION'||!v.confirmation||snapshot.projectId!==request.projectId||!same(parsed.versionRef,v.ref)||parsed.confirmationId!==row.confirmation_id||row.confirmation_id!==v.confirmation.id||hash(snapshot)!==ref.contentHash||!same(snapshot.previousApplicationRef,previous?.ref??null)||appliedBy.kind!=='HUMAN'||appliedBy.userId!==row.applied_by||appliedBy.clientId!==row.client_id||!uuidV1(row.applied_by))bad();
    acceptedKnowledgeReviews(v.ref,[snapshot.reviewRef],reviewsByVersion.get(key(v.ref.id,v.ref.version))??[],false);if(!v.confirmation.review_refs.some((r:unknown)=>same(r,snapshot.reviewRef)))bad();
    const c=command(row,'applyConstitution',ref,n-1,row.applied_by,row.created_at),receipt=receiptMap.get(c.authorization_receipt_id);
    if(!receipt||receipt.command_id!==c.id||!same(receipt.policy_ref,c.policy_ref)||snapshot.controlGeneration!==c.control_generation||c.result_ref.data.status!=='CONSTITUTION_APPLIED'||!same(c.result_ref.data.application,snapshot))bad();safe(snapshot);
    const projection:Row={ref,application:{...snapshot,appliedBy:{kind:'HUMAN'}},appliedAt:stamp(row.created_at)};const projected:Row={...projection,projectionHash:hash(projection)};previous=projected;constitutionApplications.push(projected);
   }
   let currentConstitution:Row|null=null;const pointer=pointerRows[0];if(Boolean(pointer)!==Boolean(previous))bad();if(pointer){if(!previous||integer(pointer.application_version,1)!==previous.ref.version||pointer.application_hash!==previous.ref.contentHash||pointer.entry_id!==previous.application.versionRef.id||integer(pointer.version,1)!==previous.application.versionRef.version)bad();currentConstitution={ref:previous.ref,versionRef:previous.application.versionRef};}
   const artifactIds=[...new Set([...artRefs.keys(),...sourceHashes.keys()])].sort(),artifactRows=await selectedRows(db,'artifacts',artifactIds);
   for(const row of artifactRows){check();const bytes=integer(row.bytes,0,20*1024*1024);if(!digest(row.content_hash)||typeof row.media_type!=='string'||!row.media_type.length||row.media_type.length>200||!row.media_type.isWellFormed()||!['STAGING','READY','QUARANTINED','FAILED'].includes(row.state))bad();
    const ref={artifactId:row.id,bytes,contentHash:row.content_hash,mediaType:row.media_type},known=artRefs.get(row.id);if(known&&!same(known,ref)||sourceHashes.has(row.id)&&sourceHashes.get(row.id)!==row.content_hash)bad();safe(ref);addRef(ref);const inspected=inspection(row.inspection_json);artifacts.push({...ref,state:row.state,inspectionStatus:inspected,blobVerification:'NOT_PERFORMED'});if(row.state!=='READY')issues.push({code:'ARTIFACT_NOT_READY',ref});if(inspected!=='NO_KNOWN_MARKER')issues.push({code:'ARTIFACT_INSPECTION_UNKNOWN',ref});}
   const end=await rrObservation(db);if(end.snapshot!==start.snapshot)bad();
   const projection={projectId:request.projectId,entries,versions,events,reviews,constitutionApplications,currentConstitution,artifacts,issues,externalDependencies};
   const result:Row={kind:'KNOWLEDGE_INVENTORY_V1',scope:'KNOWLEDGE_CONSTITUTION_HISTORY_ONLY',...projection,observation:{snapshot:start.snapshot,startedAt:start.at,finishedAt:end.at,isolation:'repeatable read',readOnly:true,authBoundary:'START_AND_END_READ_COMMITTED'},contentHash:hash(projection),usage:{metadataBytes:0,inputBytes,fileCount:artRefs.size},metadataComplete:issues.length===0&&externalDependencies.length===0,blobVerification:'NOT_PERFORMED',fullProjectCoverage:false,restorable:false,agentDelivery:'NOT_CONNECTED'};
   check();rollbackTried=true;await db.query('ROLLBACK');begun=false;beginSent=false;const releasing=db;db=undefined;releasing.release();
   result.observation.finishedAt=await boundary();check();
   for(let n=0;n<17;n++){const bytes=Buffer.byteLength(canonicalJson(result));if(bytes>request.limits.metadataBytes)bad('KNOWLEDGE_INVENTORY_LIMIT',413);if(bytes===result.usage.metadataBytes){check();return result;}result.usage.metadataBytes=bytes;}return bad();
  }catch(error){
   if(db){if(beginSent&&!begun)releaseError=new Error('KNOWLEDGE_INVENTORY_BEGIN_UNKNOWN');if(begun){if(rollbackTried)releaseError=new Error('KNOWLEDGE_INVENTORY_CLEANUP_UNKNOWN');else{rollbackTried=true;try{await db.query('ROLLBACK');begun=false;}catch{releaseError=new Error('KNOWLEDGE_INVENTORY_CLEANUP_UNKNOWN');}}}}
   if(releaseError)bad('KNOWLEDGE_INVENTORY_STORAGE_FAILED',503);throw error;
  }finally{if(db){try{db.release(releaseError);}catch{bad('KNOWLEDGE_INVENTORY_STORAGE_FAILED',503);}}}
 }catch(error){if(error instanceof AuthFailure&&(ownErrors.has(error)||error.message==='AUTH_REQUIRED'&&error.statusCode===401||error.message==='NOT_FOUND'&&error.statusCode===404))throw new AuthFailure(error.message,error.statusCode);throw new AuthFailure('KNOWLEDGE_INVENTORY_INTEGRITY_FAILED',503);}
}
