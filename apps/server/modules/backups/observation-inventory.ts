import type {PoolClient} from 'pg';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {readServerExecutionFactV1} from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import {readSyntheticQueuedCommandRecord} from '../executions/execution-command-record.ts';
import {readSyntheticInstructionQueueRecord} from '../executions/execution-instruction-queue.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {readDocumentInventoryInput} from './document-inventory-input.ts';
import {readSyntheticStopCommandRecord} from '../executions/execution-stop.ts';
type Row=Record<string,any>;
const columns={
 execution_observations:'project_id execution_id generation id version event_sequence grant_id grant_version content_hash snapshot_json event_id'.split(' '),
 execution_acknowledgements:'project_id execution_id generation id version grant_id grant_version content_hash snapshot_json'.split(' '),
 execution_observation_results:'project_id execution_id generation proof_result_id proof_result_version ack_id ack_version content_hash snapshot_json'.split(' '),
 execution_receipts:'project_id id version grant_id grant_version challenge_id challenge_version content_hash snapshot_json'.split(' '),
 execution_grants:'project_id id version execution_id generation content_hash snapshot_json'.split(' '),
 execution_commands:'project_id id version execution_id generation grant_id grant_version content_hash envelope_hash snapshot_json authorization_ref created_command_id created_at'.split(' '),
};
type Table=keyof typeof columns;
const ownErrors=new WeakSet<AuthFailure>();
function bad(code='OBSERVATION_INVENTORY_INTEGRITY_FAILED',status=503):never{const e=new AuthFailure(code,status);ownErrors.add(e);throw e;}
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


export type ObservationInventory=Record<string,any>;
/** 공급자 관측의 불변 역사만 수집한다. 실행 성공·현재 허가·서명 검증이 아니다. */
export async function collectObservationInventory(access:AccessRepository,token:string,value:unknown,signal:AbortSignal):Promise<ObservationInventory>{
 const request=readDocumentInventoryInput(value),started=performance.now();let authDeadline=Infinity,identity:AuthenticatedIdentity|undefined,metadataUsed=0;
 const check=()=>{if(signal.aborted)bad('OBSERVATION_INVENTORY_CANCELLED',409);if(performance.now()-started>=request.limits.deadlineMs||performance.now()>=authDeadline)bad('OBSERVATION_INVENTORY_DEADLINE',413);};
 async function query(db:PoolClient,sql:string,values:unknown[]=[]){
  check();const remaining=Math.floor(Math.min(request.limits.deadlineMs-(performance.now()-started),authDeadline-performance.now()));if(remaining<1)bad('OBSERVATION_INVENTORY_DEADLINE',413);
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

 const primary=(table:Table)=>['execution_observations','execution_acknowledgements','execution_observation_results'].includes(table);
 const selectionKey=(table:Table,r:Row)=>table==='execution_commands'?[r.execution_id,integer(r.generation,1),r.snapshot_json?.envelope?.commandId,r.envelope_hash].join(':'):[r.id,integer(r.version,1)].join(':');
 async function pageRows(db:PoolClient,table:Table,selection?:string[]){
  const out:Row[]=[],keys=table==='execution_observations'?['execution_id','generation','event_sequence']:table==='execution_acknowledgements'?['execution_id','generation','version']:table==='execution_observation_results'?['execution_id','generation','proof_result_id','proof_result_version']:['id','version'];let last:unknown[]|null=null;
  const numeric=(k:string)=>['version','generation','event_sequence','proof_result_version'].includes(k),compare=(a:unknown[],b:unknown[])=>{for(let n=0;n<a.length;n++){const x=a[n]as string|number,y=b[n]as string|number;if(x<y)return-1;if(x>y)return 1;}return 0;};
  for(;;){check();const values:unknown[]=[request.projectId],conditions=['t.project_id=$1::uuid'],bind=(v:unknown)=>{values.push(v);return'$'+values.length;};
   if(!primary(table)&&(!selection||!selection.length||selection.length>200))bad();
   if(selection){const expression=table==='execution_commands'?"(t.execution_id::text||':'||t.generation::text||':'||(t.snapshot_json->'envelope'->>'commandId')||':'||t.envelope_hash)":"(t.id::text||':'||t.version::text)";conditions.push(`${expression}=ANY(${bind(selection)}::text[])`);}
   if(last)conditions.push(`(${keys.map(k=>'t.'+k).join(',')})>(${keys.map((k,i)=>bind(last![i])+(numeric(k)?'::bigint':'::uuid')).join(',')})`);
   const remaining=request.limits.metadataBytes-metadataUsed;if(remaining<=0)bad('OBSERVATION_INVENTORY_LIMIT',413);const cap=bind(remaining),sql=`WITH inventory_row AS (SELECT ${columns[table].map(k=>'t.'+k).join(',')} FROM anvil.${table} t WHERE ${conditions.join(' AND ')} ORDER BY ${keys.map(k=>'t.'+k).join(',')} LIMIT 200)
    SELECT CASE WHEN octet_length(to_jsonb(inventory_row)::text)<=${cap}::bigint THEN to_jsonb(inventory_row) ELSE NULL END AS inventory_data,octet_length(to_jsonb(inventory_row)::text) AS row_bytes FROM inventory_row ORDER BY ${keys.map(k=>'inventory_row.'+k).join(',')}`;
   const result=(await query(db,sql,values)).result;if(!Array.isArray(result.rows)||result.rows.length>200)bad();
   for(const raw of result.rows){check();const e=object(raw,['inventory_data','row_bytes']),size=integer(e.row_bytes,1);if(size>remaining||metadataUsed>request.limits.metadataBytes-size)bad('OBSERVATION_INVENTORY_LIMIT',413);const row=object(e.inventory_data,columns[table]),key=keys.map(k=>numeric(k)?integer(row[k],1):row[k]);
    if(keys.some((k,i)=>!numeric(k)&&!uuidV1(key[i]))||last&&compare(key,last)<=0||row.project_id!==request.projectId||selection&&!selection.includes(selectionKey(table,row)))bad();last=key;metadataUsed+=size;out.push(structuredClone(row));
   }if(result.rows.length<200)return out;
  }
 }
 async function selectedRows(db:PoolClient,table:Table,keys:string[]){const selected=[...new Set(keys)].sort(),out:Row[]=[];for(let batchStart=0;batchStart<selected.length;batchStart+=200)out.push(...await pageRows(db,table,selected.slice(batchStart,batchStart+200)));if(out.length!==selected.length||new Set(out.map(r=>selectionKey(table,r))).size!==selected.length)bad();return out;}
 async function rrObservation(db:PoolClient){const rows=(await query(db,"SELECT current_setting('transaction_isolation') AS isolation,current_setting('transaction_read_only') AS read_only,pg_current_snapshot()::text AS snapshot,clock_timestamp() AS at")).result.rows;const state=rows.length===1?rows[0]:null;if(state?.isolation!=='repeatable read'||state.read_only!=='on'||typeof state.snapshot!=='string'||!/^\d+:\d+:[\d,]*$/.test(state.snapshot)||!(state.at instanceof Date)||!Number.isFinite(state.at.getTime()))bad();return{snapshot:state.snapshot,at:state.at.toISOString()};}
 const safe=(v:unknown)=>{if(inspectArtifact(Buffer.from(canonicalJson(v))).state==='SUSPECTED')bad('OBSERVATION_INVENTORY_SENSITIVE_METADATA',503);};
 try{
  await boundary();let db:PoolClient|undefined,beginSent=false,begun=false,rollbackTried=false,releaseError:Error|undefined;
  try{
   db=await access.pool.connect();check();beginSent=true;await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');begun=true;check();const start=await rrObservation(db);await owner(db,identity!);
   const eventRows=await pageRows(db,'execution_observations'),ackRows=await pageRows(db,'execution_acknowledgements'),resultRows=await pageRows(db,'execution_observation_results');
   const pair=(id:unknown,version:unknown)=>{if(!uuidV1(id))bad();return id+':'+integer(version,1);};
   const receiptRows=await selectedRows(db,'execution_receipts',resultRows.map(r=>pair(r.proof_result_id,r.proof_result_version)));
   const grantRows=await selectedRows(db,'execution_grants',[...eventRows,...ackRows,...receiptRows].map(r=>pair(r.grant_id,r.grant_version)));
   const commandKeys=eventRows.map(r=>{const e=r.snapshot_json?.event;if(!uuidV1(e?.commandId)||!digest(e?.envelopeHash))bad();return[r.execution_id,integer(r.generation,1),e.commandId,e.envelopeHash].join(':');});
   const commandRows=await selectedRows(db,'execution_commands',commandKeys);
   const observations:Row[]=[],acknowledgements:Row[]=[],observationResults:Row[]=[],proofResults:Row[]=[],externalDependencies:Row[]=[],externalKeys=new Set<string>();
   const scopeOf=(r:Row)=>{if(!uuidV1(r.execution_id))bad();return{projectId:request.projectId,executionId:r.execution_id,executionGeneration:integer(r.generation,1)};};
   const scopeKey=(r:Row)=>r.execution_id+':'+integer(r.generation,1);
   function refFor(r:Row,max=1){if(!uuidV1(r.id)||!digest(r.content_hash))bad();return{id:r.id,version:integer(r.version,1,max),contentHash:r.content_hash};}
   function external(kind:string,ref:unknown){if(!isVersionRef(ref))bad();const v={kind,ref,verification:'NOT_PERFORMED'},key=canonicalJson(v);safe(v);if(!externalKeys.has(key)){externalKeys.add(key);externalDependencies.push(structuredClone(v));}}
   function push(to:Row[],v:Row){safe(v);to.push({...structuredClone(v),projectionHash:hash(v)});}
   const grants=new Map<string,{row:Row;ref:Row}>();
   for(const row of grantRows){check();const ref=refFor(row),s=object(row.snapshot_json,['kind','state','transport','binding','allowedOperations','expiresAt','scopeDigest','factHash','plannedAt','executionAuthorized','dispatchPerformed']);
    if(Buffer.byteLength(canonicalJson(s))>2097152||hash(s)!==ref.contentHash||s.kind!=='EXECUTION'||s.state!=='SYNTHETIC_PLAN'||s.transport!=='SYNTHETIC_ONLY'||s.executionAuthorized!==false||s.dispatchPerformed!==false||!same(s.allowedOperations,['START_SESSION','SEND_INSTRUCTION','REQUEST_STOP'])||!digest(s.scopeDigest)||!digest(s.factHash))bad();
    const fact=readServerExecutionFactV1(s.binding);stamp(s.plannedAt);stamp(s.expiresAt);if(fact.projectId!==request.projectId||fact.executionId!==row.execution_id||fact.executionGeneration!==integer(row.generation,1)||hash(fact)!==s.factHash||hash({binding:s.binding,allowedOperations:s.allowedOperations,expiresAt:s.expiresAt})!==s.scopeDigest)bad();grants.set(pair(row.id,row.version),{row,ref});
   }
   function grantFor(row:Row,ref?:unknown){const g=grants.get(pair(row.grant_id,row.grant_version));if(!g||g.row.execution_id!==row.execution_id||integer(g.row.generation,1)!==integer(row.generation,1)||ref!==undefined&&!same(g.ref,ref))bad();return g!;}
   const commands=new Map<string,Row>();
   for(const row of commandRows){check();const ref=refFor(row),scope=scopeOf(row),record={ref,snapshot:row.snapshot_json},state=row.snapshot_json?.state;let read:Row;
    if(state==='SYNTHETIC_QUEUED')read=readSyntheticQueuedCommandRecord(record,scope)as unknown as Row;else if(state==='SYNTHETIC_INSTRUCTION_QUEUED')read=readSyntheticInstructionQueueRecord(record,scope)as unknown as Row;else if(state==='STOP_REQUEST_STORED')read=readSyntheticStopCommandRecord(record,scope)as unknown as Row;else return bad();
    const s=read.snapshot,g=s.grantRef??s.currentBinding?.grantRef;if(!isVersionRef(g)||row.grant_id!==g.id||integer(row.grant_version,1)!==g.version||row.envelope_hash!==s.envelope.envelopeHash||!same(row.authorization_ref,s.envelope.context.authorizationReceiptRef)||!uuidV1(row.created_command_id))bad();stamp(row.created_at);commands.set(selectionKey('execution_commands',row),ref);external('EXECUTION_COMMAND',ref);
   }
   const groups=new Map<string,{scope:Row;events:Row[];ids:Set<string>;refs:Set<string>;bytes:number;acks:Row[]}>();
   const types=['RECEIVED','PREPARED','START_ATTEMPTED','PERMIT_RECORDED','PROVIDER_RESPONSE_RECEIVED','STARTED','REJECTED','UNKNOWN','STOP_REQUESTED','STOPPED','STOP_UNCONFIRMED','HEARTBEAT'],reasons=['NONE','UNVERIFIED_PROVIDER_CLAIM','PROVIDER_RESPONSE_LOST','RECORD_UNCERTAIN','STOP_UNCONFIRMED','REJECTED_BY_PROVIDER'];
   for(const row of eventRows){check();const ref=refFor(row),scope=scopeOf(row),s=object(row.snapshot_json,['event','grantRef','credentialGeneration','mode','receivedAt','transport','verification']),e=object(s.event,['projectId','executionId','executionGeneration','sequence','eventId','type','commandId','envelopeHash','localRecordRef','processRef','occurredAt','reasonCode']);
    if(hash(s)!==ref.contentHash||s.mode!=='EXECUTION'||s.credentialGeneration!==1||s.transport!=='SYNTHETIC_ONLY'||s.verification!=='PROVIDER_CLAIM_ONLY'||!same({projectId:e.projectId,executionId:e.executionId,executionGeneration:e.executionGeneration},scope)||e.sequence!==integer(row.event_sequence,1,10000)||!uuidV1(e.eventId)||e.eventId!==row.event_id||!types.includes(e.type)||!reasons.includes(e.reasonCode)||!isVersionRef(e.localRecordRef)||e.processRef!==null&&!isVersionRef(e.processRef)||Buffer.byteLength(canonicalJson(e))>65536)bad();stamp(e.occurredAt);stamp(s.receivedAt);grantFor(row,s.grantRef);
    const key=scopeKey(row),group=groups.get(key)??{scope,events:[] as Row[],ids:new Set<string>(),refs:new Set<string>(),bytes:0,acks:[] as Row[]};if(group.ids.has(e.eventId)||group.refs.has(ref.id)||group.events.some(v=>v.sequence===e.sequence))bad();group.ids.add(e.eventId);group.refs.add(ref.id);group.bytes+=Buffer.byteLength(canonicalJson(s));group.events.push(e);if(group.events.length>10000||group.bytes>16777216)bad();groups.set(key,group);
    const commandRef=commands.get([row.execution_id,integer(row.generation,1),e.commandId,e.envelopeHash].join(':'));if(!commandRef)bad();const{commandId:_,...metadata}=e;
    push(observations,{ref,event:{...metadata,commandRef},grantRef:s.grantRef,credentialGeneration:1,mode:s.mode,receivedAt:s.receivedAt,transport:s.transport,verification:s.verification});external('EXECUTION_GRANT',s.grantRef);external('LOCAL_RECORD',e.localRecordRef);if(e.processRef)external('PROCESS_REFERENCE',e.processRef);
   }
   const acks=new Map<string,{row:Row;ref:Row}>();
   for(const row of ackRows){check();const ref=refFor(row,10000),scope=scopeOf(row),s=object(row.snapshot_json,['execution','highestContiguous','maxSequence','contiguousDigest','gaps','storedCount','writerReleaseVerified','executionAuthorized','dispatchPerformed','recordedAt']),group=groups.get(scopeKey(row));
    if(!group||hash(s)!==ref.contentHash||!same(s.execution,scope)||s.writerReleaseVerified!==false||s.executionAuthorized!==false||s.dispatchPerformed!==false||!digest(s.contiguousDigest)||!Array.isArray(s.gaps)||s.gaps.length>10000)bad();grantFor(row);const hi=integer(s.highestContiguous,0,10000),max=integer(s.maxSequence,1,10000),count=integer(s.storedCount,1,10000);if(hi>max||count>max)bad();let last=hi,missing=0;
    for(const raw of s.gaps){const gap=object(raw,['from','to']),from=integer(gap.from,1,max),to=integer(gap.to,from,max);if(from<=last||from<=hi)bad();missing+=to-from+1;last=to;}if(missing+count!==max||hi!==(s.gaps.length?s.gaps[0].from-1:max))bad();
    const time=stamp(s.recordedAt),prior=group!.acks.at(-1);if(ref.version!==group!.acks.length+1||prior&&(ref.id!==prior.ref.id||count<=prior.snapshot.storedCount||Date.parse(time)<Date.parse(stamp(prior.snapshot.recordedAt))))bad();group!.acks.push({ref,snapshot:s});acks.set(scopeKey(row)+':'+pair(ref.id,ref.version),{row,ref});push(acknowledgements,{ref,snapshot:s,grantRef:grants.get(pair(row.grant_id,row.grant_version))!.ref});
   }
   for(const group of groups.values()){check();const latest=group.acks.at(-1);if(!latest)bad();const sorted=[...group.events].sort((a,b)=>a.sequence-b.sequence);let highest=0,d=hash([]),expected=1;const gaps:Row[]=[];for(const e of sorted){if(e.sequence>expected)gaps.push({from:expected,to:e.sequence-1});expected=e.sequence+1;if(e.sequence===highest+1){highest++;d=hash({previous:d,eventHash:hash(e)});}}const summary={execution:group.scope,highestContiguous:highest,maxSequence:sorted.at(-1)!.sequence,contiguousDigest:d,gaps,storedCount:sorted.length,writerReleaseVerified:false,executionAuthorized:false,dispatchPerformed:false},{recordedAt:_,...original}=latest!.snapshot;if(!same(summary,original))bad();}
   const receipts=new Map<string,{row:Row;ref:Row;grant:Row}>(),challenges=new Set<string>();
   for(const row of receiptRows){check();const ref=refFor(row),s=object(row.snapshot_json,['kind','challengeRef','requestId','proofHash','recordedAt','credentialIssued','executionAuthorized','dispatchPerformed']);if(hash(s)!==ref.contentHash||s.kind!=='SYNTHETIC_PROOF_RESULT'||!isVersionRef(s.challengeRef)||s.challengeRef.version!==1||row.challenge_id!==s.challengeRef.id||integer(row.challenge_version,1,1)!==1||!uuidV1(s.requestId)||!digest(s.proofHash)||s.credentialIssued!==false||s.executionAuthorized!==false||s.dispatchPerformed!==false)bad();stamp(s.recordedAt);
    const grant=grants.get(pair(row.grant_id,row.grant_version));if(!grant)bad();const key=pair(row.grant_id,row.grant_version)+':'+row.challenge_id;if(challenges.has(key))bad();challenges.add(key);receipts.set(pair(row.id,row.version),{row,ref,grant:grant!.row});push(proofResults,{ref,challengeRef:s.challengeRef,proofHash:s.proofHash,recordedAt:s.recordedAt,credentialIssued:false,executionAuthorized:false,dispatchPerformed:false});external('PROOF_CHALLENGE',s.challengeRef);
   }
   const usedProof=new Set<string>();
   for(const row of resultRows){check();const scope=scopeOf(row),s=object(row.snapshot_json,['transport','proofResultRef','ackRef','bodyHash','recordedAt','executionAuthorized','dispatchPerformed']);if(!digest(row.content_hash)||hash(s)!==row.content_hash||s.transport!=='SYNTHETIC_ONLY'||s.executionAuthorized!==false||s.dispatchPerformed!==false||!digest(s.bodyHash)||!isVersionRef(s.proofResultRef)||!isVersionRef(s.ackRef))bad();stamp(s.recordedAt);
    const pkey=pair(row.proof_result_id,row.proof_result_version),proof=receipts.get(pkey),ack=acks.get(scopeKey(row)+':'+pair(row.ack_id,row.ack_version));if(!proof||!ack||usedProof.has(pkey)||!same(proof.ref,s.proofResultRef)||!same(ack.ref,s.ackRef)||!same(scopeOf(proof.grant),scope)||!same(scopeOf(ack.row),scope))bad();usedProof.add(pkey);
    push(observationResults,{scope,source:{proofResultRef:proof!.ref,contentHash:row.content_hash},transport:s.transport,proofResultRef:s.proofResultRef,ackRef:s.ackRef,bodyHash:s.bodyHash,recordedAt:s.recordedAt,executionAuthorized:false,dispatchPerformed:false});
   }
   externalDependencies.sort((a,b)=>canonicalJson(a)<canonicalJson(b)?-1:canonicalJson(a)>canonicalJson(b)?1:0);
   const end=await rrObservation(db);if(end.snapshot!==start.snapshot)bad();const projection={kind:'OBSERVATION_INVENTORY_V1',projectId:request.projectId,observations,acknowledgements,observationResults,proofResults,externalDependencies};safe(projection);
   const result:Row={...projection,inventoryHash:hash(projection),observation:{snapshot:start.snapshot,startedAt:start.at,finishedAt:end.at,isolation:'repeatable read',readOnly:true,authBoundary:'START_AND_END_READ_COMMITTED'},usage:{metadataBytes:0,inputBytes:0,fileCount:0},verification:'PROVIDER_CLAIM_ONLY',proofSignatureVerification:'NOT_PERFORMED',challengeTargetBindingVerification:'NOT_PERFORMED',historicalAckEventSetVerification:'NOT_PERFORMED',executionCommandEvidenceVerification:'NOT_PERFORMED',currentAuthorityVerification:'NOT_PERFORMED',understandingHistory:'NOT_COLLECTED',startPermitHistory:'NOT_COLLECTED',instructionPermitHistory:'NOT_COLLECTED',otherProofReceipts:'NOT_COLLECTED',credentialHistory:'NOT_COLLECTED',challengeHistory:'NOT_COLLECTED',writerReleaseVerified:false,executionAuthorized:false,dispatchPerformed:false,credentialIssued:false,authorizationRestoration:false,atomicSnapshotVerified:false,fullProjectCoverage:false,restorable:false};
   check();rollbackTried=true;await db.query('ROLLBACK');begun=false;beginSent=false;const releasing=db;db=undefined;releasing.release();result.observation.finishedAt=await boundary();check();
   for(let n=0;n<17;n++){const bytes=Buffer.byteLength(canonicalJson(result));if(bytes>request.limits.metadataBytes)bad('OBSERVATION_INVENTORY_LIMIT',413);if(bytes===result.usage.metadataBytes){check();return result;}result.usage.metadataBytes=bytes;}return bad();
  }catch(error){
   if(db){if(beginSent&&!begun)releaseError=new Error('OBSERVATION_INVENTORY_BEGIN_UNKNOWN');if(begun){if(rollbackTried)releaseError=new Error('OBSERVATION_INVENTORY_CLEANUP_UNKNOWN');else{rollbackTried=true;try{await db.query('ROLLBACK');begun=false;}catch{releaseError=new Error('OBSERVATION_INVENTORY_CLEANUP_UNKNOWN');}}}}
   if(releaseError)bad('OBSERVATION_INVENTORY_STORAGE_FAILED',503);throw error;
  }finally{if(db){try{db.release(releaseError);}catch{bad('OBSERVATION_INVENTORY_STORAGE_FAILED',503);}}}
 }catch(error){if(error instanceof AuthFailure&&(ownErrors.has(error)||error.message==='AUTH_REQUIRED'&&error.statusCode===401||error.message==='NOT_FOUND'&&error.statusCode===404))throw new AuthFailure(error.message,error.statusCode);throw new AuthFailure('OBSERVATION_INVENTORY_INTEGRITY_FAILED',503);}
}
