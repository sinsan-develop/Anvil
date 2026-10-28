import type {PoolClient} from 'pg';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {planText} from '../traceability/work-plan-card.ts';
import {readDesignChangeSources} from '../traceability/design-change-sources.ts';
import {readImpactReview} from '../traceability/impact-review.ts';
import {isImpactTargetRef} from '../traceability/design-impact.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {readDocumentInventoryInput} from './document-inventory-input.ts';

type Row=Record<string,any>;
const columns={
 design_changes:'id project_id version before_id before_version before_hash proposal_id content_hash change_json created_by client_id command_id created_at'.split(' '),
 design_change_impacts:'id project_id version change_id change_hash source_kind content_hash impact_json created_by client_id command_id created_at base_version base_hash'.split(' '),
 commands:'id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id'.split(' ')
};
type Table=keyof typeof columns;
const taskCode=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v);
const ownErrors=new WeakSet<AuthFailure>();
function bad(code='DESIGN_CHANGE_INVENTORY_INTEGRITY_FAILED',status=503):never{const e=new AuthFailure(code,status);ownErrors.add(e);throw e;}
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
/** 원문 접근 없는 내부 설계변경·영향검토 metadata 관측이다. archive/복원·명령 실행 권한을 발급하지 않는다. */
export async function collectDesignChangeInventory(access:AccessRepository,token:string,value:unknown,signal:AbortSignal):Promise<Row>{
 const request=readDocumentInventoryInput(value),started=performance.now();let authDeadline=Infinity,identity:AuthenticatedIdentity|undefined,metadataUsed=0;
 const check=()=>{if(signal.aborted)bad('DESIGN_CHANGE_INVENTORY_CANCELLED',409);if(performance.now()-started>=request.limits.deadlineMs||performance.now()>=authDeadline)bad('DESIGN_CHANGE_INVENTORY_DEADLINE',413);};
 async function query(db:PoolClient,sql:string,values:unknown[]=[]){
  check();const remaining=Math.floor(Math.min(request.limits.deadlineMs-(performance.now()-started),authDeadline-performance.now()));if(remaining<1)bad('DESIGN_CHANGE_INVENTORY_DEADLINE',413);
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
  const out:Row[]=[],keys=table==='design_change_impacts'?['id','version']:['id'];let last:(string|number)[]|null=null;
  for(;;){
   check();const values:unknown[]=[request.projectId],conditions=['t.project_id=$1::uuid'],bind=(v:unknown)=>{values.push(v);return'$'+values.length;};if(selection)conditions.push(`t.id=ANY(${bind(selection)}::uuid[])`);
   if(last)conditions.push(`(${keys.map(k=>'t.'+k).join(',')})>(${last.map((v,i)=>bind(v)+(keys[i]==='version'?'::bigint':'::uuid')).join(',')})`);
   const remaining=request.limits.metadataBytes-metadataUsed;if(remaining<=0)bad('DESIGN_CHANGE_INVENTORY_LIMIT',413);const cap=bind(remaining);
   const sql=`WITH inventory_row AS (SELECT ${columns[table].map(k=>'t.'+k).join(',')} FROM anvil.${table} t WHERE ${conditions.join(' AND ')} ORDER BY ${keys.map(k=>'t.'+k).join(',')} LIMIT 200)
    SELECT CASE WHEN octet_length(to_jsonb(inventory_row)::text)<=${cap}::bigint THEN to_jsonb(inventory_row) ELSE NULL END AS inventory_data,
    octet_length(to_jsonb(inventory_row)::text) AS row_bytes FROM inventory_row ORDER BY ${keys.map(k=>'inventory_row.'+k).join(',')}`;
   const result=(await query(db,sql,values)).result;if(!Array.isArray(result.rows)||result.rows.length>200)bad();
   for(const raw of result.rows){check();const envelope=object(raw,['inventory_data','row_bytes']),size=integer(envelope.row_bytes,1);if(size>remaining||metadataUsed>request.limits.metadataBytes-size)bad('DESIGN_CHANGE_INVENTORY_LIMIT',413);const row=object(envelope.inventory_data,columns[table]);const tuple=keys.map(k=>k==='version'?integer(row[k],1):row[k]);if(row.project_id!==request.projectId||!uuidV1(row.id)||last&&compare(tuple,last)<=0||selection&&!selection.includes(row.id))bad();last=tuple;metadataUsed+=size;out.push(structuredClone(row));}
   if(result.rows.length<200)return out;
  }
 }
 async function selectedCommands(db:PoolClient,ids:string[]){const selected=[...new Set(ids)].sort();if(selected.some(id=>!uuidV1(id)))bad();const out:Row[]=[];for(let batchStart=0;batchStart<selected.length;batchStart+=200){const batch=selected.slice(batchStart,batchStart+200),rows=await pageRows(db,'commands',batch);if(rows.length!==batch.length)bad();out.push(...rows);}return out;}
 async function rrObservation(db:PoolClient){const rows=(await query(db,"SELECT current_setting('transaction_isolation') AS isolation,current_setting('transaction_read_only') AS read_only,pg_current_snapshot()::text AS snapshot,clock_timestamp() AS at")).result.rows;const state=rows.length===1?rows[0]:null;if(state?.isolation!=='repeatable read'||state.read_only!=='on'||typeof state.snapshot!=='string'||!/^\d+:\d+:[\d,]*$/.test(state.snapshot)||!(state.at instanceof Date)||!Number.isFinite(state.at.getTime()))bad();return{snapshot:state.snapshot,at:state.at.toISOString()};}
 try{
  await boundary();let db:PoolClient|undefined,beginSent=false,begun=false,rollbackTried=false,releaseError:Error|undefined;
  try{
   db=await access.pool.connect();check();beginSent=true;await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;check();const start=await rrObservation(db);await owner(db,identity!);
   const changeRows=await pageRows(db,'design_changes'),impactRows=await pageRows(db,'design_change_impacts'),commandRows=await selectedCommands(db,[...changeRows,...impactRows].map(r=>r.command_id)),commands=new Map(commandRows.map(c=>[c.id,c]));
   const changes:Row[]=[],impacts:Row[]=[],issues:Row[]=[],externalDependencies:Row[]=[],changeMap=new Map<string,Row>(),impactMap=new Map<string,Row>(),lineageByChange=new Map<string,string>(),latestByImpact=new Map<string,Row>(),proposalIds=new Set<string>(),requestCommands=new Set<string>(),reviewCommands=new Set<string>(),externalKeys=new Set<string>();
   const safe=(v:unknown)=>{if(inspectArtifact(Buffer.from(canonicalJson(v))).state==='SUSPECTED')bad('DESIGN_CHANGE_INVENTORY_SENSITIVE_METADATA',503);};
   function external(v:Row){safe(v);const k=canonicalJson(v);if(!externalKeys.has(k)){externalKeys.add(k);externalDependencies.push(structuredClone(v));}}
   function command(row:Row,operation:string,ref:Row,expected:number){
    const c=commands.get(row.command_id);if(!c||!uuidV1(row.created_by)||!uuidV1(row.client_id)||c.state!=='APPLIED'||c.operation!==operation||c.actor_id!==row.created_by||c.client_id!==row.client_id||integer(c.expected_version)!==expected||!isVersionRef(c.policy_ref)||!uuidV1(c.authorization_receipt_id))return bad();integer(c.control_generation,1);
    const result=object(c.result_ref,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt']);if(!uuidV1(result.operationId)||!uuidV1(result.commandId)||result.projectId!==request.projectId||result.status!=='APPLIED'||result.targetId!==ref.id||result.version!==ref.version||!same(result.data?.ref,ref)||!Array.isArray(result.evidenceRefs)||!Array.isArray(result.warnings)||stamp(result.serverReceivedAt)!==stamp(row.created_at))bad();return c;
   }
   for(const row of changeRows){
    check();const change=object(row.change_json,['ref','status','beforeRef','afterProposalRef','reason','sourceRefs','requestedBy','createdAt']),{ref,status,requestedBy,createdAt,...snapshot}=change,actor=object(requestedBy,['kind','userId']);
    if(!isVersionRef(ref)||ref.id!==row.id||ref.version!==1||integer(row.version,1)!==1||ref.contentHash!==row.content_hash||hash(snapshot)!==row.content_hash||status!=='PROPOSED'||!isVersionRef(snapshot.beforeRef)||!uuidV1(snapshot.afterProposalRef)||!planText(snapshot.reason)||!snapshot.reason.trim()||actor.kind!=='HUMAN'||actor.userId!==row.created_by||stamp(createdAt)!==stamp(row.created_at))bad();
    if(!same(snapshot.beforeRef,{id:row.before_id,version:integer(row.before_version,1),contentHash:row.before_hash})||snapshot.afterProposalRef!==row.proposal_id||proposalIds.has(row.proposal_id)||requestCommands.has(row.command_id))bad();readDesignChangeSources(snapshot.sourceRefs);safe(change);
    const c=command(row,'proposeDesignChange',ref,0),data=object(c.result_ref.data,['ref','status','change','impact','activatedAsBaseline']);if(data.status!=='DESIGN_CHANGE_PROPOSED'||data.activatedAsBaseline!==false||!same(data.change,change))bad();
    proposalIds.add(row.proposal_id);requestCommands.add(row.command_id);changeMap.set(row.id,{row,change,command:c});const projection={...change,requestedBy:{kind:'HUMAN'}};changes.push({...projection,projectionHash:hash(projection)});
    external({kind:'DOCUMENT_VERSION',formCode:'AF02',ref:snapshot.beforeRef,verification:'NOT_PERFORMED'});external({kind:'DOCUMENT_PROPOSAL',id:snapshot.afterProposalRef,verification:'NOT_PERFORMED'});for(const r of snapshot.sourceRefs)external({...r,verification:'NOT_PERFORMED'});
   }
   function inputSnapshot(value:unknown){const v=object(value,['planRefs','indexedDesign']);if(!Array.isArray(v.planRefs)||v.planRefs.length>8||typeof v.indexedDesign!=='boolean')return bad();const seen=new Set<string>();for(const r of v.planRefs){if(!isVersionRef(r)||seen.has(r.id))bad();seen.add(r.id);}return v;}
   function initial(snapshot:Row){
    if(!Array.isArray(snapshot.items)||snapshot.items.length>2000||!Array.isArray(snapshot.coverageGaps))bad();const targets=new Set<string>(),identities=new Set<string>();
    for(const raw of snapshot.items){const i=object(raw,['targetRef','state','reason','evidenceRefs']);if(!isImpactTargetRef(i.targetRef)||!['DESIGN_ITEM','SCREEN_REGION','PLAN_TASK'].includes(i.targetRef.kind)||!['AFFECTED','UNKNOWN'].includes(i.state)||!planText(i.reason)||!i.reason.trim()||!Array.isArray(i.evidenceRefs)||i.evidenceRefs.length!==0)bad();const target=canonicalJson(i.targetRef),identity=canonicalJson({kind:i.targetRef.kind,id:i.targetRef.id,version:i.targetRef.versionRef.version,localCode:i.targetRef.localCode??null});if(targets.has(target)||identities.has(identity))bad();targets.add(target);identities.add(identity);if(i.targetRef.kind==='PLAN_TASK'&&!snapshot.inputs.planRefs.some((r:Row)=>same(r,i.targetRef.versionRef)))bad();}
    const allowed=new Set(['EXECUTION_SOURCE_NOT_CONNECTED','TEST_EVIDENCE_SOURCE_NOT_CONNECTED','IMPACT_SCOPE_TRUNCATED','IMPACT_TARGETS_MISSING','DEPENDENCY_SOURCE_MISSING','TARGET_IMPACT_UNCONFIRMED','PLAN_RELATIONS_NOT_READY','DESIGN_INDEX_NOT_READY']);
    for(const raw of snapshot.coverageGaps){if(!raw||typeof raw!=='object'||Array.isArray(raw))bad();const g=object(raw,Object.hasOwn(raw,'targetRef')?['code','targetRef']:['code']);if(!allowed.has(g.code)||Object.hasOwn(g,'targetRef')&&(!isImpactTargetRef(g.targetRef)||!targets.has(canonicalJson(g.targetRef))))bad();}
    for(const code of['EXECUTION_SOURCE_NOT_CONNECTED','TEST_EVIDENCE_SOURCE_NOT_CONNECTED'])if(!snapshot.coverageGaps.some((g:Row)=>same(g,{code})))bad();
    if(!snapshot.items.length&&!snapshot.coverageGaps.some((g:Row)=>same(g,{code:'IMPACT_TARGETS_MISSING'})))bad();if(!snapshot.inputs.indexedDesign&&!snapshot.coverageGaps.some((g:Row)=>same(g,{code:'DESIGN_INDEX_NOT_READY'})))bad();
   }
   for(const row of impactRows){
    check();const version=integer(row.version,1),change=changeMap.get(row.change_id);if(!change||row.change_hash!==change.change.ref.contentHash||!['MECHANICAL_TRACE','HUMAN_REVIEW'].includes(row.source_kind))bad();
    const keys=row.source_kind==='MECHANICAL_TRACE'?['ref','changeRef','sourceKind','beforeRef','items','coverageGaps','requiresReview','inputs','observedAt']:['ref','changeRef','baseImpactRef','sourceKind','beforeRef','items','coverageGaps','reason','requiresReview','inputs','reviewer','observedAt'];
    const impact=object(row.impact_json,keys),{ref,observedAt,...snapshot}=impact;if(!isVersionRef(ref)||ref.id!==row.id||ref.version!==version||ref.contentHash!==row.content_hash||hash(snapshot)!==row.content_hash||!same(snapshot.changeRef,change.change.ref)||snapshot.sourceKind!==row.source_kind||!same(snapshot.beforeRef,change.change.beforeRef)||snapshot.requiresReview!==true||stamp(observedAt)!==stamp(row.created_at))bad();snapshot.inputs=inputSnapshot(snapshot.inputs);safe(impact);
    const prior=latestByImpact.get(row.id),lineage=lineageByChange.get(row.change_id);if(lineage&&lineage!==row.id||version!==(prior?prior.ref.version+1:1))bad();
    if(row.source_kind==='MECHANICAL_TRACE'){
     if(version!==1||row.base_version!==null||row.base_hash!==null||prior||lineage||row.command_id!==change.row.command_id||row.created_by!==change.row.created_by||row.client_id!==change.row.client_id||stamp(row.created_at)!==stamp(change.row.created_at))bad();initial(snapshot);
     const c=command(row,'proposeDesignChange',change.change.ref,0);if(!same(c.result_ref.data.impact,impact))bad();lineageByChange.set(row.change_id,row.id);
    }else{
     if(version<2||!prior||integer(row.base_version,1)!==version-1||row.base_hash!==prior.ref.contentHash||!same(snapshot.baseImpactRef,prior.ref)||!same(snapshot.inputs,prior.snapshot.inputs)||requestCommands.has(row.command_id)||reviewCommands.has(row.command_id))bad();
     const reviewer=object(snapshot.reviewer,['kind','userId']);if(reviewer.kind!=='HUMAN'||reviewer.userId!==row.created_by)bad();readImpactReview({items:snapshot.items,coverageGaps:snapshot.coverageGaps,reason:snapshot.reason},prior.snapshot as {items:{targetRef:unknown}[];coverageGaps:unknown[]});
     const c=command(row,'reviewChangeImpact',ref,version-1);if(!same(c.result_ref.data,{ref,status:'DESIGN_IMPACT_REVIEWED',impact,activatedAsBaseline:false}))bad();reviewCommands.add(row.command_id);
    }
    const projection=row.source_kind==='HUMAN_REVIEW'?{...impact,reviewer:{kind:'HUMAN'}}:impact;impacts.push({...projection,projectionHash:hash(projection)});const entry={ref,snapshot,row};latestByImpact.set(row.id,entry);impactMap.set(row.id+':'+version,entry);
    for(const r of snapshot.inputs.planRefs)external({kind:'WORK_PLAN_VERSION',ref:r,verification:'NOT_PERFORMED'});for(const item of snapshot.items){external({kind:'IMPACT_TARGET',ref:item.targetRef,verification:'NOT_PERFORMED'});for(const r of item.evidenceRefs)external({kind:'IMPACT_EVIDENCE',ref:r,verification:'NOT_PERFORMED'});}for(const gap of snapshot.coverageGaps){issues.push({impactRef:ref,...gap});if(gap.targetRef)external({kind:'IMPACT_TARGET',ref:gap.targetRef,verification:'NOT_PERFORMED'});}
   }
   for(const row of changeRows)if(!lineageByChange.has(row.id))bad();if(commands.size!==requestCommands.size+reviewCommands.size)bad();
   externalDependencies.sort((a,b)=>canonicalJson(a)<canonicalJson(b)?-1:canonicalJson(a)>canonicalJson(b)?1:0);
   const end=await rrObservation(db);if(end.snapshot!==start.snapshot)bad();const projection={projectId:request.projectId,changes,impacts,issues,externalDependencies};safe(projection);
   const result:Row={kind:'DESIGN_CHANGE_INVENTORY_V1',scope:'DESIGN_CHANGE_HISTORY_ONLY',...projection,observation:{snapshot:start.snapshot,startedAt:start.at,finishedAt:end.at,isolation:'repeatable read',readOnly:true,authBoundary:'START_AND_END_READ_COMMITTED'},contentHash:hash(projection),usage:{metadataBytes:0,inputBytes:0,fileCount:0},metadataComplete:issues.length===0&&externalDependencies.length===0,blobVerification:'NOT_PERFORMED',executionEvidence:'NOT_CONNECTED',fullProjectCoverage:false,restorable:false};
   check();rollbackTried=true;await db.query('ROLLBACK');begun=false;beginSent=false;const releasing=db;db=undefined;releasing.release();result.observation.finishedAt=await boundary();check();
   for(let n=0;n<17;n++){const bytes=Buffer.byteLength(canonicalJson(result));if(bytes>request.limits.metadataBytes)bad('DESIGN_CHANGE_INVENTORY_LIMIT',413);if(bytes===result.usage.metadataBytes){check();return result;}result.usage.metadataBytes=bytes;}return bad();
  }catch(error){
   if(db){if(beginSent&&!begun)releaseError=new Error('DESIGN_CHANGE_INVENTORY_BEGIN_UNKNOWN');if(begun){if(rollbackTried)releaseError=new Error('DESIGN_CHANGE_INVENTORY_CLEANUP_UNKNOWN');else{rollbackTried=true;try{await db.query('ROLLBACK');begun=false;}catch{releaseError=new Error('DESIGN_CHANGE_INVENTORY_CLEANUP_UNKNOWN');}}}}
   if(releaseError)bad('DESIGN_CHANGE_INVENTORY_STORAGE_FAILED',503);throw error;
  }finally{if(db){try{db.release(releaseError);}catch{bad('DESIGN_CHANGE_INVENTORY_STORAGE_FAILED',503);}}}
 }catch(error){if(error instanceof AuthFailure&&(ownErrors.has(error)||error.message==='AUTH_REQUIRED'&&error.statusCode===401||error.message==='NOT_FOUND'&&error.statusCode===404))throw new AuthFailure(error.message,error.statusCode);throw new AuthFailure('DESIGN_CHANGE_INVENTORY_INTEGRITY_FAILED',503);}
}
