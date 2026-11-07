import type {PoolClient} from 'pg';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {readConversationInput} from '../knowledge/conversation-input.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {readDocumentInventoryInput} from './document-inventory-input.ts';

type Row=Record<string,any>;
const columns={
 conversations:'id project_id target_role_ref head_sequence created_by last_client_id last_command_id created_at updated_at'.split(' '),
 conversation_messages:'project_id conversation_id sequence id author_ref kind body_artifact_id source_refs reply_to supersedes_instruction_id effective_scope message_json content_hash redaction_state client_id command_id recorded_at'.split(' '),
 artifacts:'id project_id bytes content_hash media_type state inspection_json'.split(' ')
};
type Table=keyof typeof columns;
const ownErrors=new WeakSet<AuthFailure>();
function bad(code='CONVERSATION_INVENTORY_INTEGRITY_FAILED',status=503):never{const e=new AuthFailure(code,status);ownErrors.add(e);throw e;}
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

/** 원문 접근 없는 내부 대화 metadata 관측이다. archive/복원·명령 실행 권한을 발급하지 않는다. */
export async function collectConversationInventory(access:AccessRepository,token:string,value:unknown,signal:AbortSignal):Promise<Row>{
 const request=readDocumentInventoryInput(value),started=performance.now();let authDeadline=Infinity,identity:AuthenticatedIdentity|undefined,metadataUsed=0;
 const check=()=>{if(signal.aborted)bad('CONVERSATION_INVENTORY_CANCELLED',409);if(performance.now()-started>=request.limits.deadlineMs||performance.now()>=authDeadline)bad('CONVERSATION_INVENTORY_DEADLINE',413);};
 async function query(db:PoolClient,sql:string,values:unknown[]=[]){
  check();const remaining=Math.floor(Math.min(request.limits.deadlineMs-(performance.now()-started),authDeadline-performance.now()));if(remaining<1)bad('CONVERSATION_INVENTORY_DEADLINE',413);
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
  const out:Row[]=[],keys=table==='conversation_messages'?['conversation_id','sequence']:['id'];let last:(string|number)[]|null=null;
  for(;;){
   check();const values:unknown[]=[request.projectId],conditions=['t.project_id=$1::uuid'],bind=(v:unknown)=>{values.push(v);return'$'+values.length;};
   if(selection)conditions.push(`t.id=ANY(${bind(selection)}::uuid[])`);
   if(last)conditions.push(`(${keys.map(k=>'t.'+k).join(',')})>(${last.map((v,i)=>bind(v)+(keys[i]==='sequence'?'::bigint':'::uuid')).join(',')})`);
   const remaining=request.limits.metadataBytes-metadataUsed;if(remaining<=0)bad('CONVERSATION_INVENTORY_LIMIT',413);const cap=bind(remaining);
   const sql=`WITH inventory_row AS (SELECT ${columns[table].map(k=>'t.'+k).join(',')} FROM anvil.${table} t WHERE ${conditions.join(' AND ')} ORDER BY ${keys.map(k=>'t.'+k).join(',')} LIMIT 200)
    SELECT CASE WHEN octet_length(to_jsonb(inventory_row)::text)<=${cap}::bigint THEN to_jsonb(inventory_row) ELSE NULL END AS inventory_data,
    octet_length(to_jsonb(inventory_row)::text) AS row_bytes FROM inventory_row ORDER BY ${keys.map(k=>'inventory_row.'+k).join(',')}`;
   const result=(await query(db,sql,values)).result;if(!Array.isArray(result.rows)||result.rows.length>200)bad();
   for(const raw of result.rows){
    check();const envelope=object(raw,['inventory_data','row_bytes']),size=integer(envelope.row_bytes,1);if(size>remaining||metadataUsed>request.limits.metadataBytes-size)bad('CONVERSATION_INVENTORY_LIMIT',413);
    const row=object(envelope.inventory_data,columns[table]);if(row.project_id!==request.projectId)bad();const tuple=keys.map(k=>k==='sequence'?integer(row[k],1):row[k]);if(tuple.some((v,i)=>keys[i]!=='sequence'&&!uuidV1(v))||last&&compare(tuple,last)<=0)bad();
    if(selection&&!selection.includes(row.id))bad();last=tuple;metadataUsed+=size;out.push(structuredClone(row));
   }
   if(result.rows.length<200)return out;
  }
 }
 async function rrObservation(db:PoolClient){const rows=(await query(db,"SELECT current_setting('transaction_isolation') AS isolation,current_setting('transaction_read_only') AS read_only,pg_current_snapshot()::text AS snapshot,clock_timestamp() AS at")).result.rows;const state=rows.length===1?rows[0]:null;if(state?.isolation!=='repeatable read'||state.read_only!=='on'||typeof state.snapshot!=='string'||!/^\d+:\d+:[\d,]*$/.test(state.snapshot)||!(state.at instanceof Date)||!Number.isFinite(state.at.getTime()))bad();return{snapshot:state.snapshot,at:state.at.toISOString()};}
 try{
  await boundary();let db:PoolClient|undefined,beginSent=false,begun=false,rollbackTried=false,releaseError:Error|undefined;
  try{
   db=await access.pool.connect();check();beginSent=true;await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;check();const start=await rrObservation(db);await owner(db,identity!);
   const heads=await pageRows(db,'conversations'),storedMessages=await pageRows(db,'conversation_messages');
   const conversationMap=new Map<string,Row>(),messageMap=new Map<string,Row>(),lastMessages=new Map<string,Row>(),artRefs=new Map<string,Row>(),commands=new Set<string>();
   const conversations:Row[]=[],messages:Row[]=[],artifacts:Row[]=[],issues:Row[]=[],externalDependencies:Row[]=[];let inputBytes=0;
   for(const h of heads){check();if(!uuidV1(h.id)||h.target_role_ref!==null||!uuidV1(h.created_by)||!uuidV1(h.last_client_id)||!uuidV1(h.last_command_id))bad();const head=integer(h.head_sequence,1);conversationMap.set(h.id,{...h,head_sequence:head});conversations.push({id:h.id,headSequence:head,targetRoleRef:null,createdAt:stamp(h.created_at),updatedAt:stamp(h.updated_at)});}
   for(const row of storedMessages){
    check();const head=conversationMap.get(row.conversation_id),seq=integer(row.sequence,1);if(!head||!uuidV1(row.id)||messageMap.has(row.id)||!uuidV1(row.client_id)||!uuidV1(row.command_id)||commands.has(row.command_id)||!digest(row.content_hash)||!['NOT_REDACTED','QUARANTINED'].includes(row.redaction_state))bad();
    const previous=lastMessages.get(row.conversation_id);if(seq!==(previous?previous.sequence+1:1)||seq>head.head_sequence)bad();
    const snapshot=object(row.message_json,['conversationId','targetRoleRef','message','sourceRefs','serverSequence','authorRef']),author=object(snapshot.authorRef,['kind','userId']);
    const parsed=readConversationInput({conversationId:snapshot.conversationId,targetRoleRef:snapshot.targetRoleRef,message:snapshot.message,sourceRefs:snapshot.sourceRefs},request.projectId);
    if(snapshot.conversationId!==row.conversation_id||snapshot.serverSequence!==seq||author.kind!=='HUMAN'||!uuidV1(author.userId)||!same(snapshot.authorRef,row.author_ref)||seq===1&&author.userId!==head.created_by||hash(snapshot)!==row.content_hash||parsed.message.kind!==row.kind||parsed.message.bodyRef.artifactId!==row.body_artifact_id||!same(parsed.sourceRefs,row.source_refs)||!same(parsed.message.effectiveScope,row.effective_scope)||parsed.message.replyTo?.id!==(row.reply_to??undefined)||parsed.message.supersedesInstructionRef?.id!==(row.supersedes_instruction_id??undefined))bad();
    for(const [kind,ref]of[['REPLY',parsed.message.replyTo],['SUPERSEDES',parsed.message.supersedesInstructionRef]]as const){if(ref){const target=messageMap.get(ref.id);if(!target||target.conversation_id!==row.conversation_id||target.sequence>=seq||target.content_hash!==ref.contentHash||kind==='SUPERSEDES'&&(target.kind!=='USER_INSTRUCTION'||parsed.message.kind!=='USER_INSTRUCTION'))bad();}}
    const ref=parsed.message.bodyRef,existing=artRefs.get(ref.artifactId);if(existing&&!same(existing,ref))bad();if(!existing){if(artRefs.size>=request.limits.fileCount||inputBytes>Number.MAX_SAFE_INTEGER-ref.bytes||inputBytes>request.limits.inputBytes-ref.bytes)bad('CONVERSATION_INVENTORY_LIMIT',413);inputBytes+=ref.bytes;artRefs.set(ref.artifactId,ref);}
    const projection={sourceRef:{kind:'CONVERSATION',id:row.id,contentHash:row.content_hash},conversationId:row.conversation_id,serverSequence:seq,author:{kind:'HUMAN'},message:parsed.message,redactionState:row.redaction_state,recordedAt:stamp(row.recorded_at)};
    if(inspectArtifact(Buffer.from(canonicalJson(snapshot))).state==='SUSPECTED')bad('CONVERSATION_INVENTORY_SENSITIVE_METADATA',503);
    messages.push({...projection,projectionHash:hash(projection)});if(row.redaction_state==='QUARANTINED')issues.push({code:'MESSAGE_QUARANTINED',ref:projection.sourceRef});
    commands.add(row.command_id);messageMap.set(row.id,{...row,sequence:seq});lastMessages.set(row.conversation_id,{...row,sequence:seq});
   }
   for(const head of conversationMap.values()){const last=lastMessages.get(head.id);if(!last||last.sequence!==head.head_sequence||last.client_id!==head.last_client_id||last.command_id!==head.last_command_id)bad();}
   const selected=[...artRefs.keys()].sort();for(let batchStart=0;batchStart<selected.length;batchStart+=200){const ids=selected.slice(batchStart,batchStart+200),rows=await pageRows(db,'artifacts',ids);if(rows.length!==ids.length)bad();
    for(const row of rows){check();const ref=artRefs.get(row.id)!;if(integer(row.bytes,0,20*1024*1024)!==ref.bytes||row.content_hash!==ref.contentHash||row.media_type!==ref.mediaType||!['STAGING','READY','QUARANTINED','FAILED'].includes(row.state))bad();const inspected=inspection(row.inspection_json);artifacts.push({...ref,state:row.state,inspectionStatus:inspected,blobVerification:'NOT_PERFORMED'});if(row.state!=='READY')issues.push({code:'ARTIFACT_NOT_READY',ref});if(inspected!=='NO_KNOWN_MARKER')issues.push({code:'ARTIFACT_INSPECTION_UNKNOWN',ref});}
   }
   for(const command of [...commands].sort())externalDependencies.push({kind:'COMMAND',id:command,verification:'NOT_PERFORMED'});
   const end=await rrObservation(db);if(end.snapshot!==start.snapshot)bad();
   const projection={projectId:request.projectId,conversations,messages,artifacts,issues,externalDependencies};
   const result:Row={kind:'CONVERSATION_INVENTORY_V1',scope:'CONVERSATION_HISTORY_ONLY',...projection,observation:{snapshot:start.snapshot,startedAt:start.at,finishedAt:end.at,isolation:'repeatable read',readOnly:true,authBoundary:'START_AND_END_READ_COMMITTED'},contentHash:hash(projection),usage:{metadataBytes:0,inputBytes,fileCount:artRefs.size},metadataComplete:issues.length===0&&externalDependencies.length===0,blobVerification:'NOT_PERFORMED',fullProjectCoverage:false,restorable:false};
   check();rollbackTried=true;await db.query('ROLLBACK');begun=false;beginSent=false;const releasing=db;db=undefined;releasing.release();
   result.observation.finishedAt=await boundary();check();
   for(let n=0;n<17;n++){const bytes=Buffer.byteLength(canonicalJson(result));if(bytes>request.limits.metadataBytes)bad('CONVERSATION_INVENTORY_LIMIT',413);if(bytes===result.usage.metadataBytes){check();return result;}result.usage.metadataBytes=bytes;}return bad();
  }catch(error){
   if(db){if(beginSent&&!begun)releaseError=new Error('CONVERSATION_INVENTORY_BEGIN_UNKNOWN');if(begun){if(rollbackTried)releaseError=new Error('CONVERSATION_INVENTORY_CLEANUP_UNKNOWN');else{rollbackTried=true;try{await db.query('ROLLBACK');begun=false;}catch{releaseError=new Error('CONVERSATION_INVENTORY_CLEANUP_UNKNOWN');}}}}
   if(releaseError)bad('CONVERSATION_INVENTORY_STORAGE_FAILED',503);throw error;
  }finally{if(db){try{db.release(releaseError);}catch{bad('CONVERSATION_INVENTORY_STORAGE_FAILED',503);}}}
 }catch(error){if(error instanceof AuthFailure&&(ownErrors.has(error)||error.message==='AUTH_REQUIRED'&&error.statusCode===401||error.message==='NOT_FOUND'&&error.statusCode===404))throw new AuthFailure(error.message,error.statusCode);throw new AuthFailure('CONVERSATION_INVENTORY_INTEGRITY_FAILED',503);}
}
