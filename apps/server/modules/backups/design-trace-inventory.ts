import type {PoolClient} from 'pg';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {planText} from '../traceability/work-plan-card.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {readDocumentInventoryInput} from './document-inventory-input.ts';

type Row=Record<string,any>;
const columns={
 design_items:'id project_id design_document_id document_version document_hash local_code title anchor item_hash item_json created_by client_id command_id created_at'.split(' '),
 screen_regions:'id project_id design_item_id screen_code source_document_id source_version source_hash artifact_id anchor region_hash region_json created_by client_id command_id created_at'.split(' '),
 trace_edges:'id project_id from_kind from_id from_version from_code to_kind to_id to_version to_code relation design_refs edge_json edge_hash reason created_by client_id command_id created_at'.split(' '),
 commands:'id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id'.split(' ')
};
type Table=keyof typeof columns;
const taskCode=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v);
const ownErrors=new WeakSet<AuthFailure>();
function bad(code='DESIGN_TRACE_INVENTORY_INTEGRITY_FAILED',status=503):never{const e=new AuthFailure(code,status);ownErrors.add(e);throw e;}
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
/** 원문 접근 없는 내부 설계·화면·추적 metadata 관측이다. archive/복원·명령 실행 권한을 발급하지 않는다. */
export async function collectDesignTraceInventory(access:AccessRepository,token:string,value:unknown,signal:AbortSignal):Promise<Row>{
 const request=readDocumentInventoryInput(value),started=performance.now();let authDeadline=Infinity,identity:AuthenticatedIdentity|undefined,metadataUsed=0;
 const check=()=>{if(signal.aborted)bad('DESIGN_TRACE_INVENTORY_CANCELLED',409);if(performance.now()-started>=request.limits.deadlineMs||performance.now()>=authDeadline)bad('DESIGN_TRACE_INVENTORY_DEADLINE',413);};
 async function query(db:PoolClient,sql:string,values:unknown[]=[]){
  check();const remaining=Math.floor(Math.min(request.limits.deadlineMs-(performance.now()-started),authDeadline-performance.now()));if(remaining<1)bad('DESIGN_TRACE_INVENTORY_DEADLINE',413);
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
  const out:Row[]=[];let last:string|null=null;
  for(;;){
   check();const values:unknown[]=[request.projectId],conditions=['t.project_id=$1::uuid'],bind=(v:unknown)=>{values.push(v);return'$'+values.length;};if(selection)conditions.push(`t.id=ANY(${bind(selection)}::uuid[])`);if(last)conditions.push(`t.id>${bind(last)}::uuid`);
   const remaining=request.limits.metadataBytes-metadataUsed;if(remaining<=0)bad('DESIGN_TRACE_INVENTORY_LIMIT',413);const cap=bind(remaining);
   const sql=`WITH inventory_row AS (SELECT ${columns[table].map(k=>'t.'+k).join(',')} FROM anvil.${table} t WHERE ${conditions.join(' AND ')} ORDER BY t.id LIMIT 200)
    SELECT CASE WHEN octet_length(to_jsonb(inventory_row)::text)<=${cap}::bigint THEN to_jsonb(inventory_row) ELSE NULL END AS inventory_data,
    octet_length(to_jsonb(inventory_row)::text) AS row_bytes FROM inventory_row ORDER BY inventory_row.id`;
   const result=(await query(db,sql,values)).result;if(!Array.isArray(result.rows)||result.rows.length>200)bad();
   for(const raw of result.rows){check();const envelope=object(raw,['inventory_data','row_bytes']),size=integer(envelope.row_bytes,1);if(size>remaining||metadataUsed>request.limits.metadataBytes-size)bad('DESIGN_TRACE_INVENTORY_LIMIT',413);const row=object(envelope.inventory_data,columns[table]);if(row.project_id!==request.projectId||!uuidV1(row.id)||last&&row.id<=last||selection&&!selection.includes(row.id))bad();last=row.id;metadataUsed+=size;out.push(structuredClone(row));}
   if(result.rows.length<200)return out;
  }
 }
 async function selectedCommands(db:PoolClient,ids:string[]){const selected=[...new Set(ids)].sort();if(selected.some(id=>!uuidV1(id)))bad();const out:Row[]=[];for(let batchStart=0;batchStart<selected.length;batchStart+=200){const batch=selected.slice(batchStart,batchStart+200),rows=await pageRows(db,'commands',batch);if(rows.length!==batch.length)bad();out.push(...rows);}return out;}
 async function rrObservation(db:PoolClient){const rows=(await query(db,"SELECT current_setting('transaction_isolation') AS isolation,current_setting('transaction_read_only') AS read_only,pg_current_snapshot()::text AS snapshot,clock_timestamp() AS at")).result.rows;const state=rows.length===1?rows[0]:null;if(state?.isolation!=='repeatable read'||state.read_only!=='on'||typeof state.snapshot!=='string'||!/^\d+:\d+:[\d,]*$/.test(state.snapshot)||!(state.at instanceof Date)||!Number.isFinite(state.at.getTime()))bad();return{snapshot:state.snapshot,at:state.at.toISOString()};}
 try{
  await boundary();let db:PoolClient|undefined,beginSent=false,begun=false,rollbackTried=false,releaseError:Error|undefined;
  try{
   db=await access.pool.connect();check();beginSent=true;await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;check();const start=await rrObservation(db);await owner(db,identity!);
   const itemRows=await pageRows(db,'design_items'),regionRows=await pageRows(db,'screen_regions'),edgeRows=await pageRows(db,'trace_edges');
   const commandRows=await selectedCommands(db,[...itemRows,...regionRows,...edgeRows].map(r=>r.command_id)),commands=new Map(commandRows.map(c=>[c.id,c]));
   const designItems:Row[]=[],screenRegions:Row[]=[],traceEdges:Row[]=[],issues:Row[]=[],externalDependencies:Row[]=[],items=new Map<string,Row>(),regions=new Map<string,Row>(),groups=new Map<string,Row>(),documentGroups=new Map<string,string>(),itemCodes=new Set<string>(),regionKeys=new Set<string>(),edgeKeys=new Set<string>(),usedEdgeCommands=new Set<string>(),externalKeys=new Set<string>();
   const safe=(v:unknown)=>{if(inspectArtifact(Buffer.from(canonicalJson(v))).state==='SUSPECTED')bad('DESIGN_TRACE_INVENTORY_SENSITIVE_METADATA',503);},anchor=(v:unknown)=>typeof v==='string'&&/^line:[1-9][0-9]{0,7}$/.test(v);
   function external(v:Row){safe(v);const k=canonicalJson(v);if(!externalKeys.has(k)){externalKeys.add(k);externalDependencies.push(structuredClone(v));}}
   function command(row:Row,operation:string,ref:Row,expected:number){
    const c=commands.get(row.command_id);if(!c||!uuidV1(row.created_by)||!uuidV1(row.client_id)||c.state!=='APPLIED'||c.operation!==operation||c.actor_id!==row.created_by||c.client_id!==row.client_id||integer(c.expected_version)!==expected||!isVersionRef(c.policy_ref)||!uuidV1(c.authorization_receipt_id))return bad();integer(c.control_generation,1);
    const result=object(c.result_ref,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt']);if(!uuidV1(result.operationId)||!uuidV1(result.commandId)||result.projectId!==request.projectId||result.status!=='APPLIED'||result.targetId!==ref.id||result.version!==ref.version||!same(result.data?.ref,ref)||!Array.isArray(result.evidenceRefs)||!Array.isArray(result.warnings)||stamp(result.serverReceivedAt)!==stamp(row.created_at))bad();return c;
   }
   for(const row of itemRows){
    check();const i=object(row.item_json,['id','documentRef','localCode','title','anchor','itemHash']);if(i.id!==row.id||!isVersionRef(i.documentRef)||!taskCode(i.localCode)||!planText(i.title,200)||!i.title.trim()||!anchor(i.anchor)||!digest(i.itemHash))bad();
    const body={documentRef:i.documentRef,localCode:i.localCode,title:i.title,anchor:i.anchor},ref={id:row.design_document_id,version:integer(row.document_version,1),contentHash:row.document_hash};if(!isVersionRef(ref)||!same(i.documentRef,ref)||i.localCode!==row.local_code||i.title!==row.title||i.anchor!==row.anchor||i.itemHash!==row.item_hash||hash(body)!==i.itemHash)bad();safe(i);
    const key=canonicalJson([ref.id,ref.version,i.localCode]);if(itemCodes.has(key))bad();itemCodes.add(key);
    const c=command(row,'indexDesignDocument',ref,ref.version),documentKey=canonicalJson([ref.id,ref.version]),knownCommand=documentGroups.get(documentKey);if(knownCommand&&knownCommand!==row.command_id)bad();documentGroups.set(documentKey,row.command_id);
    const g=groups.get(row.command_id);if(g){if(!same(g.ref,ref)||g.actorId!==row.created_by||g.clientId!==row.client_id||g.recordedAt!==stamp(row.created_at))bad();g.items.push(i);}else groups.set(row.command_id,{ref,actorId:row.created_by,clientId:row.client_id,recordedAt:stamp(row.created_at),items:[i],screens:[],command:c});
    items.set(row.id,{row,item:i,designRef:ref});const projection={...i,recordedAt:stamp(row.created_at)};designItems.push({...projection,projectionHash:hash(projection)});external({kind:'DOCUMENT_VERSION',formCode:'AF02',ref,verification:'NOT_PERFORMED'});
   }
   for(const row of regionRows){
    check();const s=object(row.region_json,['id','designItemId','screenCode','documentRef','artifactRef','anchor','regionHash']),item=items.get(row.design_item_id);if(!item||s.id!==row.id||s.designItemId!==row.design_item_id||!taskCode(s.screenCode)||!isVersionRef(s.documentRef)||!anchor(s.anchor)||!digest(s.regionHash))bad();
    const ar=object(s.artifactRef,['artifactId','bytes','contentHash','mediaType']);if(!uuidV1(ar.artifactId)||typeof ar.bytes!=='number'||integer(ar.bytes,0,2*1024*1024)!==ar.bytes||!digest(ar.contentHash)||!['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(ar.mediaType))bad();
    const body={designItemId:s.designItemId,screenCode:s.screenCode,documentRef:s.documentRef,artifactRef:s.artifactRef,anchor:s.anchor},ref={id:row.source_document_id,version:integer(row.source_version,1),contentHash:row.source_hash};if(!isVersionRef(ref)||!same(s.documentRef,ref)||s.screenCode!==row.screen_code||ar.artifactId!==row.artifact_id||s.anchor!==row.anchor||s.regionHash!==row.region_hash||hash(body)!==s.regionHash||row.command_id!==item.row.command_id)bad();safe(s);
    const unique=canonicalJson([s.designItemId,s.screenCode,s.anchor]);if(regionKeys.has(unique))bad();regionKeys.add(unique);command(row,'indexDesignDocument',item.designRef,item.designRef.version);
    const g=groups.get(row.command_id);if(!g||g.actorId!==row.created_by||g.clientId!==row.client_id||g.recordedAt!==stamp(row.created_at))bad();g.screens.push(s);regions.set(row.id,{row,region:s,designRef:item.designRef});
    const projection={...s,recordedAt:stamp(row.created_at)};screenRegions.push({...projection,projectionHash:hash(projection)});external({kind:'DOCUMENT_VERSION',formCode:'AF03',ref:s.documentRef,verification:'NOT_PERFORMED'});external({kind:'ARTIFACT',ref:ar,verification:'NOT_PERFORMED'});
   }
   function equalSets(a:unknown,b:Row[]){if(!Array.isArray(a)||a.length!==b.length)return false;const ids=new Set<string>();for(const v of a){if(!v||typeof v!=='object'||!uuidV1(v.id)||ids.has(v.id)||!b.some(row=>row.id===v.id&&same(row,v)))return false;ids.add(v.id);}return true;}
   for(const g of groups.values()){const data=object(g.command.result_ref.data,['ref','status','designItems','screenRegions']);if(data.status!=='DESIGN_INDEXED'||!same(data.ref,g.ref)||g.items.length<1||g.items.length>200||g.screens.length>200||!equalSets(data.designItems,g.items)||!equalSets(data.screenRegions,g.screens))bad();}
   function endpoint(value:unknown):{ref:Row;designRef:Row|null;internal:boolean}{
    const common=object(value,['kind','id','versionRef'],false);if(!uuidV1(common.id)||!isVersionRef(common.versionRef))return bad();
    if(common.kind==='PLAN_TASK'){const r=object(value,['kind','id','versionRef','localCode']);if(r.id!==r.versionRef.id||!taskCode(r.localCode))bad();external({kind:'PLAN_TASK',ref:r,verification:'NOT_PERFORMED'});return{ref:r,designRef:null,internal:false};}
    if(common.kind==='DOCUMENT_VERSION'){const r=object(value,['kind','id','versionRef']);if(r.id!==r.versionRef.id)bad();external({kind:'DOCUMENT_VERSION',ref:r.versionRef,verification:'NOT_PERFORMED'});return{ref:r,designRef:null,internal:false};}
    if(!['DESIGN_ITEM','SCREEN_REGION'].includes(common.kind))return bad();const r=object(value,['kind','id','versionRef','localCode','anchor']),found=common.kind==='DESIGN_ITEM'?items.get(r.id):regions.get(r.id);if(!found)return bad();const original=common.kind==='DESIGN_ITEM'?found.item:found.region;
    if(!same(r.versionRef,original.documentRef)||r.localCode!==(common.kind==='DESIGN_ITEM'?original.localCode:original.screenCode)||r.anchor!==original.anchor)bad();return{ref:r,designRef:found.designRef,internal:true};
   }
   for(const row of edgeRows){
    check();const e=object(row.edge_json,['id','from','to','relation','reason','designRefs','edgeHash','createdAt']);if(e.id!==row.id||!digest(e.edgeHash)||!planText(e.reason)||!e.reason.trim()||!Array.isArray(e.designRefs)||e.designRefs.length<1||e.designRefs.length>2)bad();
    const body={from:e.from,to:e.to,relation:e.relation,reason:e.reason,designRefs:e.designRefs};if(hash(body)!==e.edgeHash||e.edgeHash!==row.edge_hash||e.relation!==row.relation||e.reason!==row.reason||!same(e.designRefs,row.design_refs)||stamp(e.createdAt)!==stamp(row.created_at))bad();safe(e);
    const from=endpoint(e.from),to=endpoint(e.to),f=from.ref.kind,t=to.ref.kind;if(same(from.ref,to.ref))bad();
    if(!(e.relation==='IMPLEMENTS'&&f==='PLAN_TASK'&&['DESIGN_ITEM','SCREEN_REGION'].includes(t)||e.relation==='REFINES'&&(f==='SCREEN_REGION'&&t==='DESIGN_ITEM'||f==='DESIGN_ITEM'&&t==='DOCUMENT_VERSION'||f==='DOCUMENT_VERSION'&&t==='DOCUMENT_VERSION')||e.relation==='DEPENDS_ON'&&f===t&&['PLAN_TASK','DESIGN_ITEM'].includes(f)))bad();
    for(const [side,resolved]of[['from',from],['to',to]]as const){const r=resolved.ref;if(row[side+'_kind']!==r.kind||row[side+'_id']!==r.id||integer(row[side+'_version'],1)!==r.versionRef.version||row[side+'_code']!==(r.localCode??''))bad();}
    let prior:string|null=null;for(const r of e.designRefs){if(!isVersionRef(r))bad();const encoded=canonicalJson(r);if(prior!==null&&prior.localeCompare(encoded)>=0)bad();prior=encoded;external({kind:'DESIGN_DOCUMENT_VERSION',ref:r,verification:'NOT_PERFORMED'});}
    const known=[...new Map([from.designRef,to.designRef].filter((v):v is Row=>v!==null).map(r=>[canonicalJson(r),r])).values()];if(known.some(r=>!e.designRefs.some((d:Row)=>same(d,r))))bad();
    // 외부 PLAN_TASK/DOCUMENT_VERSION의 design 기여는 원문을 읽지 않았으므로 전체집합 재계산으로 확정하지 않는다.
    if(from.internal&&to.internal&&known.length!==e.designRefs.length)bad();
    const unique=canonicalJson([f,from.ref.id,from.ref.versionRef.version,from.ref.localCode??'',t,to.ref.id,to.ref.versionRef.version,to.ref.localCode??'',e.relation]);if(edgeKeys.has(unique)||usedEdgeCommands.has(row.command_id)||groups.has(row.command_id))bad();edgeKeys.add(unique);usedEdgeCommands.add(row.command_id);
    const ref={id:row.id,version:1,contentHash:e.edgeHash},c=command(row,'linkTrace',ref,0);if(!same(c.result_ref.data,{ref,status:'TRACE_LINKED',edge:e}))bad();traceEdges.push({...e,projectionHash:hash(e)});
   }
   externalDependencies.sort((a,b)=>canonicalJson(a)<canonicalJson(b)?-1:canonicalJson(a)>canonicalJson(b)?1:0);
   const end=await rrObservation(db);if(end.snapshot!==start.snapshot)bad();const projection={projectId:request.projectId,designItems,screenRegions,traceEdges,issues,externalDependencies};safe(projection);
   const result:Row={kind:'DESIGN_TRACE_INVENTORY_V1',scope:'DESIGN_TRACE_HISTORY_ONLY',...projection,observation:{snapshot:start.snapshot,startedAt:start.at,finishedAt:end.at,isolation:'repeatable read',readOnly:true,authBoundary:'START_AND_END_READ_COMMITTED'},contentHash:hash(projection),usage:{metadataBytes:0,inputBytes:0,fileCount:0},metadataComplete:issues.length===0&&externalDependencies.length===0,blobVerification:'NOT_PERFORMED',executionEvidence:'NOT_CONNECTED',fullProjectCoverage:false,restorable:false};
   check();rollbackTried=true;await db.query('ROLLBACK');begun=false;beginSent=false;const releasing=db;db=undefined;releasing.release();result.observation.finishedAt=await boundary();check();
   for(let n=0;n<17;n++){const bytes=Buffer.byteLength(canonicalJson(result));if(bytes>request.limits.metadataBytes)bad('DESIGN_TRACE_INVENTORY_LIMIT',413);if(bytes===result.usage.metadataBytes){check();return result;}result.usage.metadataBytes=bytes;}return bad();
  }catch(error){
   if(db){if(beginSent&&!begun)releaseError=new Error('DESIGN_TRACE_INVENTORY_BEGIN_UNKNOWN');if(begun){if(rollbackTried)releaseError=new Error('DESIGN_TRACE_INVENTORY_CLEANUP_UNKNOWN');else{rollbackTried=true;try{await db.query('ROLLBACK');begun=false;}catch{releaseError=new Error('DESIGN_TRACE_INVENTORY_CLEANUP_UNKNOWN');}}}}
   if(releaseError)bad('DESIGN_TRACE_INVENTORY_STORAGE_FAILED',503);throw error;
  }finally{if(db){try{db.release(releaseError);}catch{bad('DESIGN_TRACE_INVENTORY_STORAGE_FAILED',503);}}}
 }catch(error){if(error instanceof AuthFailure&&(ownErrors.has(error)||error.message==='AUTH_REQUIRED'&&error.statusCode===401||error.message==='NOT_FOUND'&&error.statusCode===404))throw new AuthFailure(error.message,error.statusCode);throw new AuthFailure('DESIGN_TRACE_INVENTORY_INTEGRITY_FAILED',503);}
}
