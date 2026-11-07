import type {PoolClient} from 'pg';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {validateMethodologyGraph} from '../methodologies/service.ts';
import {readProjectMethodReview} from '../methodologies/project-input.ts';
import {methodContentReviewCriteria} from '../methodologies/content-review.ts';
import {readApplicationSnapshot} from '../methodologies/application-snapshot.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {readDocumentInventoryInput} from './document-inventory-input.ts';
type Row=Record<string,any>;
const columns={
 methodology_definitions:'id scope owner_user_id project_id system_code name purpose head_version created_at'.split(' '),
 methodology_versions:'definition_id version name purpose graph_json content_hash origin_ref_json reason created_by created_at'.split(' '),
 content_reviews:'id scope_kind scope_id owner_user_id project_id draft_id target_kind target_id target_version target_hash criteria_version criteria_snapshot_json items_json outcome reviewer_user_id client_id reviewer_subject_ref source_kind reason command_id created_at'.split(' '),
 methodology_reviews:'id definition_id version target_hash validation_json review_refs decision decided_by decided_at client_id command_id project_id'.split(' '),
 project_methodologies:'id project_id application_version source_definition_id source_version source_hash snapshot_json snapshot_hash created_by created_at'.split(' '),
 commands:'id command_id scope_kind project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id'.split(' '),
 audit_events:'event_id project_id command_id server_sequence'.split(' ')
};
type Table=keyof typeof columns;
const text=(v:unknown,max=20000):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=max&&v.isWellFormed();
const ownErrors=new WeakSet<AuthFailure>();
function bad(code='PROJECT_METHODOLOGY_INVENTORY_INTEGRITY_FAILED',status=503):never{const e=new AuthFailure(code,status);ownErrors.add(e);throw e;}
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
/** 원문 접근 없는 내부 프로젝트 방법론 역사 metadata 관측이다. archive/복원·명령 실행 권한을 발급하지 않는다. */
export async function collectProjectMethodologyInventory(access:AccessRepository,token:string,value:unknown,signal:AbortSignal):Promise<Row>{
 const request=readDocumentInventoryInput(value),started=performance.now();let authDeadline=Infinity,identity:AuthenticatedIdentity|undefined,metadataUsed=0;
 const check=()=>{if(signal.aborted)bad('PROJECT_METHODOLOGY_INVENTORY_CANCELLED',409);if(performance.now()-started>=request.limits.deadlineMs||performance.now()>=authDeadline)bad('PROJECT_METHODOLOGY_INVENTORY_DEADLINE',413);};
 async function query(db:PoolClient,sql:string,values:unknown[]=[]){
  check();const remaining=Math.floor(Math.min(request.limits.deadlineMs-(performance.now()-started),authDeadline-performance.now()));if(remaining<1)bad('PROJECT_METHODOLOGY_INVENTORY_DEADLINE',413);
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
 async function pageRows(db:PoolClient,table:Table,ids?:string[],refs?:Row[]){
  const out:Row[]=[],keys=table==='methodology_versions'?['definition_id','version']:table==='audit_events'?['event_id']:['id'];let last:(string|number)[]|null=null;
  for(;;){
   check();const values:unknown[]=[request.projectId],bind=(v:unknown)=>{values.push(v);return'$'+values.length;};
   let from=`anvil.${table} t`;const conditions:string[]=[];
   if(table==='methodology_versions'){from+=' JOIN anvil.methodology_definitions d ON d.id=t.definition_id';conditions.push("d.scope='PROJECT'",'d.project_id=$1::uuid');}
   else conditions.push('t.project_id=$1::uuid');
   if(table==='methodology_definitions')conditions.push("t.scope='PROJECT'");
   if(table==='content_reviews')conditions.push("t.scope_kind='PROJECT'","t.scope_id=$1::uuid","t.target_kind='METHODOLOGY'");
   if(table==='commands')conditions.push("t.scope_kind='PROJECT'");
   if(ids){if(ids.length>200)bad();conditions.push(`t.${table==='audit_events'?'command_id':'id'}=ANY(${bind(ids)}::uuid[])`);}
   if(refs){
    if(!refs.length||refs.length>200||refs.some(r=>!isVersionRef(r)))bad();const arg=bind(JSON.stringify(refs));
    if(table==='commands')conditions.push("t.operation IN ('copyMethodology','saveMethodologyDraft')",`EXISTS (SELECT 1 FROM jsonb_array_elements(${arg}::jsonb) wanted WHERE t.result_ref->'data'->'ref'=wanted)`);
    else if(table==='project_methodologies')conditions.push('t.application_version=1',`EXISTS (SELECT 1 FROM jsonb_array_elements(${arg}::jsonb) wanted WHERE t.source_definition_id::text=wanted->>'id' AND t.source_version=(wanted->>'version')::bigint AND t.source_hash=wanted->>'contentHash')`);
    else bad();
   }
   if((table==='commands'||table==='audit_events')&&!ids&&!refs||table==='project_methodologies'&&!refs)bad();
   if(last)conditions.push(`(${keys.map(k=>'t.'+k).join(',')})>(${last.map((v,i)=>bind(v)+(keys[i]==='version'?'::bigint':'::uuid')).join(',')})`);
   const remaining=request.limits.metadataBytes-metadataUsed;if(remaining<=0)bad('PROJECT_METHODOLOGY_INVENTORY_LIMIT',413);const cap=bind(remaining);
   const sql=`WITH inventory_row AS (SELECT ${columns[table].map(k=>'t.'+k).join(',')} FROM ${from} WHERE ${conditions.join(' AND ')} ORDER BY ${keys.map(k=>'t.'+k).join(',')} LIMIT 200)
    SELECT CASE WHEN octet_length(to_jsonb(inventory_row)::text)<=${cap}::bigint THEN to_jsonb(inventory_row) ELSE NULL END AS inventory_data,
    octet_length(to_jsonb(inventory_row)::text) AS row_bytes FROM inventory_row ORDER BY ${keys.map(k=>'inventory_row.'+k).join(',')}`;
   const result=(await query(db,sql,values)).result;if(!Array.isArray(result.rows)||result.rows.length>200)bad();
   for(const raw of result.rows){
    check();const e=object(raw,['inventory_data','row_bytes']),size=integer(e.row_bytes,1);if(size>remaining||metadataUsed>request.limits.metadataBytes-size)bad('PROJECT_METHODOLOGY_INVENTORY_LIMIT',413);
    const row=object(e.inventory_data,columns[table]);if(table!=='methodology_versions'&&row.project_id!==request.projectId)bad();const tuple=keys.map(k=>k==='version'?integer(row[k],1):row[k]);
    if(tuple.some((v,i)=>keys[i]==='version'?false:!uuidV1(v))||last&&compare(tuple,last)<=0)bad();
    if(ids&&!ids.includes(row[table==='audit_events'?'command_id':'id']))bad();
    if(refs){const r=table==='commands'?row.result_ref?.data?.ref:{id:row.source_definition_id,version:integer(row.source_version,1),contentHash:row.source_hash};if(!refs.some(x=>same(x,r)))bad();if(table==='commands'&&!['copyMethodology','saveMethodologyDraft'].includes(row.operation)||table==='project_methodologies'&&integer(row.application_version,1)!==1)bad();}
    last=tuple;metadataUsed+=size;out.push(structuredClone(row));
   }
   if(result.rows.length<200)return out;
  }
 }
 async function selectedRows(db:PoolClient,table:'commands'|'audit_events',ids:string[]){const selected=[...new Set(ids)].sort();if(selected.some(id=>!uuidV1(id)))bad();const out:Row[]=[];for(let batchStart=0;batchStart<selected.length;batchStart+=200)out.push(...await pageRows(db,table,selected.slice(batchStart,batchStart+200)));return out;}
 async function refRows(db:PoolClient,table:'commands'|'project_methodologies',refs:Row[]){const out:Row[]=[];for(let batchStart=0;batchStart<refs.length;batchStart+=200)out.push(...await pageRows(db,table,undefined,refs.slice(batchStart,batchStart+200)));return out;}
 async function rrObservation(db:PoolClient){const rows=(await query(db,"SELECT current_setting('transaction_isolation') AS isolation,current_setting('transaction_read_only') AS read_only,pg_current_snapshot()::text AS snapshot,clock_timestamp() AS at")).result.rows;const state=rows.length===1?rows[0]:null;if(state?.isolation!=='repeatable read'||state.read_only!=='on'||typeof state.snapshot!=='string'||!/^\d+:\d+:[\d,]*$/.test(state.snapshot)||!(state.at instanceof Date)||!Number.isFinite(state.at.getTime()))bad();return{snapshot:state.snapshot,at:state.at.toISOString()};}
 try{
  await boundary();let db:PoolClient|undefined,beginSent=false,begun=false,rollbackTried=false,releaseError:Error|undefined;
  try{
   db=await access.pool.connect();check();beginSent=true;await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;check();const start=await rrObservation(db);await owner(db,identity!);
   const definitionRows=await pageRows(db,'methodology_definitions'),versionRows=await pageRows(db,'methodology_versions'),reviewRows=await pageRows(db,'content_reviews'),confirmationRows=await pageRows(db,'methodology_reviews');
   const heads=new Map<string,Row>(),versionMap=new Map<string,Row>(),definitions:Row[]=[],versions:Row[]=[],reviews:Row[]=[],confirmations:Row[]=[],issues:Row[]=[],externalDependencies:Row[]=[],externalKeys=new Set<string>();
   const key=(id:string,v:number)=>id+':'+v,safe=(v:unknown)=>{if(inspectArtifact(Buffer.from(canonicalJson(v))).state==='SUSPECTED')bad('PROJECT_METHODOLOGY_INVENTORY_SENSITIVE_METADATA',503);};
   function external(v:Row){safe(v);const k=canonicalJson(v);if(!externalKeys.has(k)){externalKeys.add(k);externalDependencies.push(structuredClone(v));}}
   function ref(value:unknown){if(!isVersionRef(value))return bad();return object(value,['id','version','contentHash']);}
   function validation(value:unknown){const v=object(value,['issues','validForConfirmation','runtimeReadiness']);if(!Array.isArray(v.issues)||typeof v.validForConfirmation!=='boolean'||v.runtimeReadiness!=='PROJECT_BINDINGS_REQUIRED')bad();for(const raw of v.issues){const i=object(raw,['code','location','severity','message','relatedRefs']);if(!text(i.code)||!text(i.location)||!text(i.message)||!['ERROR','WARNING'].includes(i.severity)||!Array.isArray(i.relatedRefs)||i.relatedRefs.some((r:unknown)=>!isVersionRef(r)))bad();}if(v.validForConfirmation!==!v.issues.some((i:Row)=>i.severity==='ERROR'))bad();safe(v);return v;}
   for(const h of definitionRows){if(h.scope!=='PROJECT'||h.owner_user_id!==null||h.system_code!==null||!text(h.name,200)||!text(h.purpose))bad();h.head_version=integer(h.head_version,1);safe({name:h.name,purpose:h.purpose});heads.set(h.id,h);definitions.push({id:h.id,name:h.name,purpose:h.purpose,headVersion:h.head_version,createdAt:stamp(h.created_at)});}
   for(const row of versionRows){
    check();const h=heads.get(row.definition_id),v=integer(row.version,1),prior=versionMap.get(key(row.definition_id,v-1));if(!h||v>h.head_version||v>1&&!prior||!uuidV1(row.created_by)||!text(row.name,200)||!text(row.purpose)||!text(row.reason)||!digest(row.content_hash)||hash(row.graph_json)!==row.content_hash)bad();
    const versionRef={id:row.definition_id,version:v,contentHash:row.content_hash},snapshot={name:row.name,purpose:row.purpose,graph:row.graph_json,origin:row.origin_ref_json,reason:row.reason};safe(snapshot);
    const analysis=validateMethodologyGraph(row.graph_json,[]);if(analysis.issues.some(i=>i.code==='INPUT_INVALID'))bad();for(const i of analysis.issues)issues.push({methodologyRef:versionRef,...i});
    const o=object(row.origin_ref_json,['kind'],false);
    if(o.kind==='USER_AUTHORED'){object(row.origin_ref_json,['kind']);if(v!==1)bad();}
    else if(o.kind==='COPY'||o.kind==='REVISION'){const origin=object(row.origin_ref_json,['kind','parentRef']),parent=ref(origin.parentRef);if(o.kind==='REVISION'){if(v===1||!same(parent,prior!.ref))bad();}else{if(v!==1)bad();const internal=versionMap.get(key(parent.id,parent.version));if(internal&&!same(internal.ref,parent))bad();}}
    else if(o.kind==='DRAFT_CONFIRMED_SOURCE'){const origin=object(row.origin_ref_json,['kind','draftRef','confirmationId','sourceRefs']);if(v!==1||!uuidV1(origin.confirmationId)||!Array.isArray(origin.sourceRefs)||origin.sourceRefs.length>200)bad();const draft=ref(origin.draftRef);if(draft.contentHash!==versionRef.contentHash)bad();external({kind:'DRAFT_CONFIRMATION',draftRef:draft,confirmationId:origin.confirmationId,verification:'NOT_PERFORMED'});for(const source of origin.sourceRefs)external({kind:'SOURCE_VERSION',ref:ref(source),verification:'NOT_PERFORMED'});}
    else bad();
    for(const n of row.graph_json.nodes){for(const item of[...n.inputs,...n.outputs])external({kind:'FORM_VERSION',ref:ref(item.formRef),verification:'NOT_PERFORMED'});if(n.limitPolicyRef!==null)external({kind:'LIMIT_POLICY_VERSION',ref:ref(n.limitPolicyRef),verification:'NOT_PERFORMED'});}
    if(v===1&&(h.name!==row.name||h.purpose!==row.purpose||stamp(h.created_at)!==stamp(row.created_at)))bad();versionMap.set(key(row.definition_id,v),{ref:versionRef,row,snapshot});versions.push({ref:versionRef,snapshot,recordedAt:stamp(row.created_at),projectionHash:hash(snapshot)});
   }
   for(const h of heads.values())if(!versionMap.has(key(h.id,h.head_version)))bad();
   // 모든 내부 COPY 끝점은 전체 버전 수집 뒤 다시 확인한다. 외부 참조는 원문을 읽지 않는다.
   for(const v of versionMap.values()){const o=v.snapshot.origin;if(o.kind==='COPY'){if(heads.has(o.parentRef.id)){const p=versionMap.get(key(o.parentRef.id,o.parentRef.version));if(!p||!same(p.ref,o.parentRef))bad();}else external({kind:'METHODOLOGY_VERSION',ref:o.parentRef,verification:'NOT_PERFORMED'});}}
   const commandIds=[...reviewRows,...confirmationRows].map(r=>r.command_id);if(new Set(commandIds).size!==commandIds.length)bad();
   const commandRows=[...await selectedRows(db,'commands',commandIds),...await refRows(db,'commands',versions.map(v=>v.ref))],commands=new Map<string,Row>();
   for(const c of commandRows){const previous=commands.get(c.id);if(previous&&!same(previous,c))bad();commands.set(c.id,c);}
   const audits=await selectedRows(db,'audit_events',[...commands.keys()]),auditMap=new Map<string,number>(),sequences=new Set<number>();
   for(const a of audits){const n=integer(a.server_sequence,1);if(!commands.has(a.command_id)||auditMap.has(a.command_id)||sequences.has(n))bad();auditMap.set(a.command_id,n);sequences.add(n);}if(auditMap.size!==commands.size)bad();
   const used=new Set<string>(),requestIds=new Set<string>();
   function command(c:Row|undefined,operation:string,target:Row,expected:number,actorId:string,clientId:string|undefined,time:unknown){
    if(!c||used.has(c.id)||c.scope_kind!=='PROJECT'||c.project_id!==request.projectId||c.state!=='APPLIED'||c.operation!==operation||c.actor_id!==actorId||!uuidV1(actorId)||!uuidV1(c.client_id)||clientId!==undefined&&c.client_id!==clientId||!uuidV1(c.command_id)||requestIds.has(c.actor_id+':'+c.command_id)||integer(c.expected_version)!==expected||!isVersionRef(c.policy_ref)||!uuidV1(c.authorization_receipt_id)||!auditMap.has(c.id))return bad();integer(c.control_generation,1);
    const receipt=object(c.result_ref,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt']);if(!uuidV1(receipt.operationId)||receipt.commandId!==c.command_id||receipt.projectId!==request.projectId||receipt.status!=='APPLIED'||receipt.targetId!==target.id||receipt.version!==target.version||!same(receipt.data?.ref,target)||!Array.isArray(receipt.evidenceRefs)||!Array.isArray(receipt.warnings)||stamp(receipt.serverReceivedAt)!==stamp(time))bad();safe(receipt);used.add(c.id);requestIds.add(c.actor_id+':'+c.command_id);
    external({kind:'POLICY_VERSION',ref:c.policy_ref,verification:'NOT_PERFORMED'});external({kind:'AUTHORIZATION_RECEIPT',id:c.authorization_receipt_id,verification:'NOT_PERFORMED'});return c;
   }
   const initialRefs=versions.filter(v=>v.snapshot.origin.kind==='DRAFT_CONFIRMED_SOURCE').map(v=>v.ref),applications=await refRows(db,'project_methodologies',initialRefs),usedApplications=new Set<string>();
   for(const v of versionMap.values()){
    check();const candidates=[...commands.values()].filter(c=>['copyMethodology','saveMethodologyDraft'].includes(c.operation)&&same(c.result_ref?.data?.ref,v.ref));
    if(v.snapshot.origin.kind==='DRAFT_CONFIRMED_SOURCE'){
     if(candidates.length)bad();const matching=applications.filter(a=>a.source_definition_id===v.ref.id&&integer(a.source_version,1)===v.ref.version&&a.source_hash===v.ref.contentHash);if(matching.length!==1)bad();const a=matching[0]!,parsed=readApplicationSnapshot(request.projectId,[a]),s=parsed.snapshot;
     if(!s||a.created_by!==v.row.created_by||stamp(a.created_at)!==stamp(v.row.created_at)||s.name!==v.row.name||s.purpose!==v.row.purpose||!same(s.graph,v.row.graph_json)||!same(s.sourceRef,v.ref)||!same(s.draftConfirmationRef,{draftRef:v.snapshot.origin.draftRef,confirmationId:v.snapshot.origin.confirmationId}))bad();safe(s);usedApplications.add(a.id);
    }else{
     if(candidates.length!==1)bad();const operation=v.snapshot.origin.kind==='COPY'?'copyMethodology':'saveMethodologyDraft',c=command(candidates[0],operation,v.ref,v.ref.version-1,v.row.created_by,undefined,v.row.created_at),d=object(c.result_ref.data,['ref','status','validation','snapshot']);
     if(d.status!=='DRAFT'||!same(d.snapshot,v.snapshot))bad();validation(d.validation);
    }
   }
   if(usedApplications.size!==applications.length)bad();
   const reviewMap=new Map<string,Row>();
   for(const row of reviewRows){
    check();const v=versionMap.get(key(row.target_id,integer(row.target_version,1)));if(!v||row.target_hash!==v.ref.contentHash||row.scope_kind!=='PROJECT'||row.scope_id!==request.projectId||row.owner_user_id!==null||row.draft_id!==null||row.target_kind!=='METHODOLOGY'||row.source_kind!=='HUMAN_REVIEW'||!uuidV1(row.reviewer_user_id)||!uuidV1(row.client_id))bad();
    const body=readProjectMethodReview({targetKind:'METHODOLOGY',targetRef:v.ref,criteriaVersion:integer(row.criteria_version,1),items:row.items_json,outcome:row.outcome,reason:row.reason}),reviewRef={id:row.id,criteriaVersion:1,targetRef:v.ref,outcome:body.outcome},reviewer={kind:'HUMAN',userId:row.reviewer_user_id,sameAsTargetRecorder:row.reviewer_user_id===v.row.created_by};
    if(!same(row.criteria_snapshot_json,methodContentReviewCriteria)||!same(row.reviewer_subject_ref,reviewer))bad();const c=command(commands.get(row.command_id),'recordContentReview',v.ref,v.ref.version,row.reviewer_user_id,row.client_id,row.created_at);
    if(!same(c.result_ref.data,{ref:v.ref,status:'REVIEW_RECORDED',reviewRef,review:body}))bad();const projection={ref:reviewRef,criteria:methodContentReviewCriteria,items:body.items,reviewer:{kind:'HUMAN',sameAsTargetRecorder:reviewer.sameAsTargetRecorder},sourceKind:row.source_kind,reason:body.reason,reviewedAt:stamp(row.created_at),serverSequence:auditMap.get(c.id)!};safe(projection);reviews.push(projection);reviewMap.set(row.id,projection);
   }
   for(const row of confirmationRows){
    check();const v=versionMap.get(key(row.definition_id,integer(row.version,1)));if(!v||row.target_hash!==v.ref.contentHash||row.decision!=='CONFIRMED'||!uuidV1(row.decided_by)||!uuidV1(row.client_id)||!Array.isArray(row.review_refs)||!row.review_refs.length||row.review_refs.length>200)bad();
    const c=command(commands.get(row.command_id),'confirmMethodology',v.ref,v.ref.version,row.decided_by,row.client_id,row.decided_at),seq=auditMap.get(c.id)!,seen=new Set<string>();
    for(const raw of row.review_refs){const r=object(raw,['id','criteriaVersion','targetRef','outcome']),known=reviewMap.get(r.id);if(!known||seen.has(r.id)||!same(known.ref,r)||r.outcome!=='ACCEPTED'||!same(r.targetRef,v.ref)||known.serverSequence>=seq)bad();seen.add(r.id);}
    const prior=reviews.filter(r=>same(r.ref.targetRef,v.ref)&&r.serverSequence<seq).sort((a,b)=>b.serverSequence-a.serverSequence)[0];if(!prior||prior.ref.outcome!=='ACCEPTED'||!seen.has(prior.ref.id))bad();const recorded=validation(row.validation_json);if(!recorded.validForConfirmation||!same(c.result_ref.data,{ref:v.ref,status:'CONFIRMED',confirmationId:row.id,reviewRefs:row.review_refs,validation:recorded}))bad();
    confirmations.push({id:row.id,targetRef:v.ref,reviewRefs:row.review_refs,validation:recorded,confirmedAt:stamp(row.decided_at),serverSequence:seq});
   }
   if(used.size!==commands.size)bad();externalDependencies.sort((a,b)=>canonicalJson(a)<canonicalJson(b)?-1:canonicalJson(a)>canonicalJson(b)?1:0);
   const end=await rrObservation(db);if(end.snapshot!==start.snapshot)bad();const projection={projectId:request.projectId,definitions,versions,reviews,confirmations,issues,externalDependencies};safe(projection);
   const result:Row={kind:'PROJECT_METHODOLOGY_INVENTORY_V1',scope:'PROJECT_METHODOLOGY_HISTORY_ONLY',...projection,observation:{snapshot:start.snapshot,startedAt:start.at,finishedAt:end.at,isolation:'repeatable read',readOnly:true,authBoundary:'START_AND_END_READ_COMMITTED'},contentHash:hash(projection),usage:{metadataBytes:0,inputBytes:0,fileCount:0},metadataComplete:issues.length===0&&externalDependencies.length===0,blobVerification:'NOT_PERFORMED',authorizationBindingVerification:'NOT_PERFORMED',formAvailabilityVerification:'NOT_PERFORMED',executionEvidence:'NOT_CONNECTED',applicationHistory:'NOT_COLLECTED',fullProjectCoverage:false,restorable:false,executionAuthorized:false,dispatchPerformed:false};
   check();rollbackTried=true;await db.query('ROLLBACK');begun=false;beginSent=false;const releasing=db;db=undefined;releasing.release();result.observation.finishedAt=await boundary();check();
   for(let n=0;n<17;n++){const bytes=Buffer.byteLength(canonicalJson(result));if(bytes>request.limits.metadataBytes)bad('PROJECT_METHODOLOGY_INVENTORY_LIMIT',413);if(bytes===result.usage.metadataBytes){check();return result;}result.usage.metadataBytes=bytes;}return bad();
  }catch(error){
   if(db){if(beginSent&&!begun)releaseError=new Error('PROJECT_METHODOLOGY_INVENTORY_BEGIN_UNKNOWN');if(begun){if(rollbackTried)releaseError=new Error('PROJECT_METHODOLOGY_INVENTORY_CLEANUP_UNKNOWN');else{rollbackTried=true;try{await db.query('ROLLBACK');begun=false;}catch{releaseError=new Error('PROJECT_METHODOLOGY_INVENTORY_CLEANUP_UNKNOWN');}}}}
   if(releaseError)bad('PROJECT_METHODOLOGY_INVENTORY_STORAGE_FAILED',503);throw error;
  }finally{if(db){try{db.release(releaseError);}catch{bad('PROJECT_METHODOLOGY_INVENTORY_STORAGE_FAILED',503);}}}
 }catch(error){if(error instanceof AuthFailure&&(ownErrors.has(error)||error.message==='AUTH_REQUIRED'&&error.statusCode===401||error.message==='NOT_FOUND'&&error.statusCode===404))throw new AuthFailure(error.message,error.statusCode);throw new AuthFailure('PROJECT_METHODOLOGY_INVENTORY_INTEGRITY_FAILED',503);}
}
