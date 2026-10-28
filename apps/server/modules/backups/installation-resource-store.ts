import {ProjectApprovals} from '../approvals/project-approvals.ts';
import {readApprovalRef} from '../approvals/approval-input.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {readManageBackupResourcePayload,type ManageBackupResourcePayload} from '../../../../contracts/runtime/backup-installation-resources-v1.ts';
import {InstallationResourceCatalog,type InstallationResourceCatalogPort} from './installation-resource-catalog.ts';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember,currentProjectController,authorizeMaterial,projectReplay,persistProjectReceipt,type ProjectCommand} from '../access/project-command.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {cloneV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';

const fail=(code='RESOURCE_STATE_UNKNOWN',status=503):never=>{throw new AuthFailure(code,status);};
export interface InstallationLeaseScope{projectId:string;actorId:string;clientId:string;sessionId:string;controlGeneration:number}
interface LeaseTimerPorts{now?:()=>number;setTimer?:(run:()=>void,delay:number)=>unknown;clearTimer?:(id:any)=>void}
interface Ticket{scope:InstallationLeaseScope;sessionEpoch:number;actorEpoch:number;projectEpoch:number}
interface Lease{scope:InstallationLeaseScope;ref:RuntimeRefV1;generation:number;key:Buffer|null;until:number|null;timer:unknown;auditState:'RECORDED'|'UNKNOWN'}
const wipe=(key:unknown)=>{try{if(key instanceof Uint8Array)key.fill(0);}catch{/* best-effort; 사용 차단 상태를 되돌리지 않는다. */}};
function leaseScope(v:unknown):InstallationLeaseScope{if(!recordV1(v,['projectId','actorId','clientId','sessionId','controlGeneration'])||!uuidV1(v.projectId)||!uuidV1(v.actorId)||!uuidV1(v.clientId)||!uuidV1(v.sessionId)||!Number.isSafeInteger(v.controlGeneration)||v.controlGeneration<1)return fail('INPUT_INVALID',400);return cloneV1(v) as InstallationLeaseScope;}
/** 메모리 키만 소유한다. 영속 descriptor/intent/실패기록 저장소를 대체하지 않는다. */
export class InstallationKeyLeaseRegistry{
 readonly #now:()=>number;readonly #setTimer:(run:()=>void,delay:number)=>unknown;readonly #clearTimer:(id:any)=>void;
 #tickets=new WeakMap<object,Ticket>();#leases=new Map<string,Lease>();#sessions=new Map<string,number>();#actors=new Map<string,number>();#projects=new Map<string,number>();#disposed=false;
 constructor(ports:LeaseTimerPorts={}){this.#now=ports.now??Date.now;this.#setTimer=ports.setTimer??((run,delay)=>{const timer=setTimeout(run,delay);timer.unref();return timer;});this.#clearTimer=ports.clearTimer??clearTimeout;}
 #epoch(map:Map<string,number>,id:string){return map.get(id)??0;}
 #ref(v:unknown):RuntimeRefV1{if(!refV1(v))return fail('INPUT_INVALID',400);return cloneV1(v);}
 #id(scope:InstallationLeaseScope,ref:RuntimeRefV1){return scope.projectId+':'+ref.id;}
 #owner(a:InstallationLeaseScope,b:InstallationLeaseScope){return a.projectId===b.projectId&&a.actorId===b.actorId&&a.clientId===b.clientId&&a.sessionId===b.sessionId;}
 #sameRef(a:RuntimeRefV1,b:RuntimeRefV1){return a.id===b.id&&a.version===b.version&&a.contentHash===b.contentHash;}
 #next(v:number){if(!Number.isSafeInteger(v)||v<0||v>=Number.MAX_SAFE_INTEGER)return fail();return v+1;}
 #lock(lease:Lease){const owned=lease.key;lease.key=null;lease.until=null;lease.auditState='UNKNOWN';if(lease.timer!==null){try{this.#clearTimer(lease.timer);}catch{}lease.timer=null;}wipe(owned);lease.generation=this.#next(lease.generation);}
 #expire(){const now=this.#now();if(!Number.isFinite(now))return fail();for(const lease of this.#leases.values())if(lease.key&&lease.until!==null&&now>=lease.until)this.#lock(lease);return now;}
 begin(value:InstallationLeaseScope):object{if(this.#disposed)return fail();const scope=leaseScope(value),ticket=Object.freeze({});this.#tickets.set(ticket,{scope,sessionEpoch:this.#epoch(this.#sessions,scope.sessionId),actorEpoch:this.#epoch(this.#actors,scope.actorId),projectEpoch:this.#epoch(this.#projects,scope.projectId)});return ticket;}
 activate(token:object,input:{resourceRef:RuntimeRefV1;expectedGeneration:number;key:Buffer;deadline:number}){
  let adopted=false;
  try{
   const ticket=token&&typeof token==='object'?this.#tickets.get(token):undefined;if(token&&typeof token==='object')this.#tickets.delete(token);
   if(this.#disposed||!ticket)return fail();const scope=ticket.scope;
   if(ticket.sessionEpoch!==this.#epoch(this.#sessions,scope.sessionId)||ticket.actorEpoch!==this.#epoch(this.#actors,scope.actorId)||ticket.projectEpoch!==this.#epoch(this.#projects,scope.projectId))return fail();
   const ref=this.#ref(input.resourceRef),now=this.#expire(),id=this.#id(scope,ref),old=this.#leases.get(id);
   if(!Buffer.isBuffer(input.key)||input.key.length!==32||!Number.isSafeInteger(input.expectedGeneration)||input.expectedGeneration<0||!Number.isFinite(input.deadline)||input.deadline<=now)return fail('KEY_LOCKED',412);
   if(old?.key&&!this.#owner(old.scope,scope))return fail('NOT_FOUND',404);
   if(old?.key&&old.scope.controlGeneration!==scope.controlGeneration){this.invalidateProject(scope.projectId);return fail();}
   if((old?.generation??0)!==input.expectedGeneration)return fail('RESOURCE_VERSION_CONFLICT',409);
   if([...this.#leases.values()].some(v=>v.scope.projectId===scope.projectId&&v.key!==null))return fail('RESOURCE_LIMIT',429);
   const until=Math.min(input.deadline,now+300000),lease:Lease={scope:cloneV1(scope),ref,generation:this.#next(input.expectedGeneration),key:input.key,until,timer:null,auditState:'RECORDED'};
   this.#leases.set(id,lease);
   try{lease.timer=this.#setTimer(()=>{if(lease.key&&this.#leases.get(id)===lease)this.#lock(lease);},until-now);}catch{this.#lock(lease);return fail();}
   adopted=true;return this.#view(lease);
  }finally{if(!adopted)wipe(input?.key);}
 }
 #view(lease:Lease){return{resourceRef:cloneV1(lease.ref),leaseGeneration:lease.generation,state:lease.key?'UNLOCKED' as const:'LOCKED' as const,unlockedUntil:lease.until===null?null:new Date(lease.until).toISOString(),auditState:lease.auditState,observedAt:new Date(this.#now()).toISOString()};}
 // 호출 store의 현재 인증/OWNER 검사가 선행한다. 잠긴 상태 조회는 새 사용 허가가 아니다.
 status(value:InstallationLeaseScope,resourceRef:RuntimeRefV1){const scope=leaseScope(value),ref=this.#ref(resourceRef);this.#expire();const lease=this.#leases.get(this.#id(scope,ref));if(!lease)return{resourceRef:ref,leaseGeneration:0,state:'LOCKED' as const,unlockedUntil:null,auditState:'UNKNOWN' as const,observedAt:new Date(this.#now()).toISOString()};if((lease.key!==null&&!this.#owner(lease.scope,scope))||!this.#sameRef(lease.ref,ref))return fail('NOT_FOUND',404);if(lease.key&&lease.scope.controlGeneration!==scope.controlGeneration)this.invalidateProject(scope.projectId);return this.#view(lease);}
 async relock(value:InstallationLeaseScope,resourceRef:RuntimeRefV1,expectedGeneration:number,persist:()=>Promise<void>){const scope=leaseScope(value),ref=this.#ref(resourceRef),lease=this.#leases.get(this.#id(scope,ref));if(!lease||!this.#owner(lease.scope,scope)||!this.#sameRef(lease.ref,ref))return fail('NOT_FOUND',404);if(lease.generation!==expectedGeneration)return fail('RESOURCE_VERSION_CONFLICT',409);this.#lock(lease);const generation=lease.generation;try{await persist();if(lease.generation===generation&&!lease.key)lease.auditState='RECORDED';}catch{/* LOCKED는 기록 실패로 되돌아가지 않는다. */}return this.#view(lease);}
 #invalidate(map:Map<string,number>,id:string,match:(lease:Lease)=>boolean){map.set(id,this.#next(this.#epoch(map,id)));for(const lease of this.#leases.values())if(match(lease)&&lease.key)this.#lock(lease);}
 invalidateSession(id:string){this.#invalidate(this.#sessions,id,v=>v.scope.sessionId===id);}
 invalidateActor(id:string){this.#invalidate(this.#actors,id,v=>v.scope.actorId===id);}
 invalidateProject(id:string){this.#invalidate(this.#projects,id,v=>v.scope.projectId===id);}
 dispose(){if(this.#disposed)return;this.#disposed=true;for(const lease of this.#leases.values())if(lease.key)this.#lock(lease);this.#tickets=new WeakMap();}
}

interface FailureBucket{project_id:string;bucket_kind:'ACTOR_KEY'|'PROJECT';bucket_key:string;failures:number;window_started_at:Date;blocked_until:Date|null}
interface FailureAttempt{id:string;project_id:string;actor_id:string;client_id:string;session_id:string;key_id:string;created_at:Date;state:'RESERVED'|'RECORDED'|'FAILED'|'SUCCEEDED'|'UNKNOWN';outcome:'FAILED'|'SUCCEEDED'|null}
/** 최초 인증/예약이 끝난 뒤에만 opaque ticket으로 감소 전용 결과를 기록한다. */
export class InstallationResourceFailureLimiter{
 readonly #access:AccessRepository;#tickets=new WeakMap<object,FailureAttempt>();
 constructor(access:AccessRepository){this.#access=access;}
 #buckets(rows:FailureBucket[],pid:string,at:Date){const seen=new Set<string>();for(const row of rows){const id=row.bucket_kind+':'+row.bucket_key;if(row.project_id!==pid||!['ACTOR_KEY','PROJECT'].includes(row.bucket_kind)||typeof row.bucket_key!=='string'||seen.has(id)||!Number.isSafeInteger(row.failures)||row.failures<0||row.failures>5||!(row.window_started_at instanceof Date)||!Number.isFinite(row.window_started_at.getTime())||row.window_started_at>at||row.blocked_until!==null&&(!(row.blocked_until instanceof Date)||!Number.isFinite(row.blocked_until.getTime())||row.blocked_until<=row.window_started_at)||((row.failures===5)!==(row.blocked_until!==null)))return fail();seen.add(id);}return rows;}
 #attempt(row:any,pid:string):FailureAttempt{if(!row||row.project_id!==pid||!uuidV1(row.id)||!uuidV1(row.actor_id)||!uuidV1(row.client_id)||!uuidV1(row.session_id)||!uuidV1(row.key_id)||!(row.created_at instanceof Date)||!Number.isFinite(row.created_at.getTime())||!['RESERVED','RECORDED','FAILED','SUCCEEDED','UNKNOWN'].includes(row.state)||!['FAILED','SUCCEEDED',null].includes(row.outcome)||row.state==='RESERVED'&&row.outcome!==null||['RECORDED','FAILED','SUCCEEDED'].includes(row.state)&&row.outcome===null||['FAILED','SUCCEEDED'].includes(row.state)&&row.state!==row.outcome)return fail();return row;}
 #bound(row:FailureAttempt,ticket:FailureAttempt){for(const key of ['id','project_id','actor_id','client_id','session_id','key_id'] as const)if(row[key]!==ticket[key])return fail();if(row.created_at.getTime()!==ticket.created_at.getTime())return fail();}
 async #local(db:PoolClient,actorId:string,clientId:string){await db.query("SELECT set_config('anvil.actor_id',$1,true),set_config('anvil.client_id',$2,true)",[actorId,clientId]);}
 async #clock(db:PoolClient){const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))return fail();return at;}
 #wanted(actorId:string,pid:string,keyId:string){return[{kind:'ACTOR_KEY' as const,key:actorId+':'+keyId},{kind:'PROJECT' as const,key:pid}];}
 async admit(token:string,pid:string,keyId:string):Promise<object>{
  if(!uuidV1(pid)||!uuidV1(keyId))return fail('INPUT_INVALID',400);
  try{
   const reserved=await this.#access.authenticated(token,null,async(db,a)=>{
    await this.#local(db,a.actorId,a.clientId);const owner=await projectMember(db,a,pid,true);if(owner.archived_at||owner.participation!=='OWNER')return fail('NOT_FOUND',404);
    const rows=(await db.query('SELECT * FROM anvil.installation_key_failure_limits WHERE project_id=$1 FOR UPDATE',[pid])).rows as FailureBucket[];
    const attempts=(await db.query('SELECT * FROM anvil.installation_key_attempts WHERE project_id=$1 FOR UPDATE',[pid])).rows;
    const before=performance.now(),at=await this.#clock(db);notificationSessionDeadline(a,at,before);this.#buckets(rows,pid,at);
    for(const row of attempts){const old=this.#attempt(row,pid);if(['RESERVED','RECORDED','UNKNOWN'].includes(old.state))return fail();}
    for(const wanted of this.#wanted(a.actorId,pid,keyId)){const row=rows.find(v=>v.bucket_kind===wanted.kind&&v.bucket_key===wanted.key);if(row?.blocked_until&&row.blocked_until>at)return fail('RESOURCE_LIMIT',429);}
    if(!a.authSession||!uuidV1(a.authSession.id))return fail('AUTH_REQUIRED',401);
    const row:FailureAttempt={id:randomUUID(),project_id:pid,actor_id:a.actorId,client_id:a.clientId,session_id:a.authSession.id,key_id:keyId,created_at:at,state:'RESERVED',outcome:null};
    await db.query('INSERT INTO anvil.installation_key_attempts(id,project_id,actor_id,client_id,session_id,key_id,created_at,state,outcome) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[row.id,pid,a.actorId,a.clientId,row.session_id,keyId,at,row.state,null]);
    return row;
   });
   const ticket=Object.freeze({});this.#tickets.set(ticket,reserved);return ticket;
  }catch(e){if(e instanceof AuthFailure)throw e;return fail();}
 }
 async #transaction<T>(body:(db:PoolClient)=>Promise<T>):Promise<T>{const db=await this.#access.pool.connect();try{await db.query('BEGIN');const out=await body(db);await db.query('COMMIT');return out;}catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}}
 async #origin(db:PoolClient,original:FailureAttempt,wantedState:'RESERVED'|'RECORDED'){
  await this.#local(db,original.actor_id,original.client_id);
  const project=(await db.query('SELECT id FROM anvil.projects WHERE id=$1 FOR UPDATE',[original.project_id])).rows;if(project.length!==1||project[0].id!==original.project_id)return fail();
  const rows=(await db.query('SELECT * FROM anvil.installation_key_attempts WHERE project_id=$1 AND id=$2 FOR UPDATE',[original.project_id,original.id])).rows;if(rows.length!==1)return fail();
  const row=this.#attempt(rows[0],original.project_id);this.#bound(row,original);if(row.state!==wantedState)return fail();return row;
 }
 async #writeFailure(db:PoolClient,original:FailureAttempt){const pid=original.project_id,rows=(await db.query('SELECT * FROM anvil.installation_key_failure_limits WHERE project_id=$1 FOR UPDATE',[pid])).rows as FailureBucket[],at=await this.#clock(db);this.#buckets(rows,pid,at);if(at<original.created_at)return fail();
  for(const wanted of this.#wanted(original.actor_id,pid,original.key_id)){const row=rows.find(v=>v.bucket_kind===wanted.kind&&v.bucket_key===wanted.key),blockedNow=!!row?.blocked_until&&row.blocked_until>at,active=!!row&&at.getTime()-row.window_started_at.getTime()<900000&&row.blocked_until===null;
   const failures=blockedNow?5:(active?row!.failures:0)+1,start=active||blockedNow?row!.window_started_at:at,blocked=blockedNow?row!.blocked_until:failures>=5?new Date(at.getTime()+900000):null;
   await db.query('INSERT INTO anvil.installation_key_failure_limits(project_id,bucket_kind,bucket_key,failures,window_started_at,blocked_until) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(project_id,bucket_kind,bucket_key) DO UPDATE SET failures=EXCLUDED.failures,window_started_at=EXCLUDED.window_started_at,blocked_until=EXCLUDED.blocked_until',[pid,wanted.kind,wanted.key,failures,start,blocked]);
  }
 }
 async #mark(db:PoolClient,original:FailureAttempt,state:string,outcome:string,previous:string){const result=await db.query('UPDATE anvil.installation_key_attempts SET state=$3,outcome=$4 WHERE project_id=$1 AND id=$2 AND state=$5',[original.project_id,original.id,state,outcome,previous]);if(result.rowCount!==1)return fail();}
 async #complete(ticket:object,outcome:'FAILED'|'SUCCEEDED'):Promise<void>{
  const original=ticket&&typeof ticket==='object'?this.#tickets.get(ticket):undefined;if(ticket&&typeof ticket==='object')this.#tickets.delete(ticket);if(!original)return fail();
  try{
   await this.#transaction(async db=>{await this.#origin(db,original,'RESERVED');if(outcome==='FAILED')await this.#writeFailure(db,original);await this.#mark(db,original,'RECORDED',outcome,'RESERVED');});
   // 기록 COMMIT 확인 전에는 RESERVED/RECORDED 양쪽 모두 새 KDF를 차단한다.
   await this.#transaction(async db=>{const row=await this.#origin(db,original,'RECORDED');if(row.outcome!==outcome)return fail();await this.#mark(db,original,outcome,outcome,'RECORDED');});
  }catch{return fail();}
 }
 recordFailure(ticket:object){return this.#complete(ticket,'FAILED');}
 completeSuccess(ticket:object){return this.#complete(ticket,'SUCCEEDED');}
}

const installationHash=(value:unknown)=>contentHash(canonicalJson(value));
const installationSame=(one:unknown,two:unknown)=>canonicalJson(one)===canonicalJson(two);
interface InstallationStoreOptions{catalog?:InstallationResourceCatalogPort}
/** 원 명령/receipt와 intent의 영속 연결. 실제 Secret/파일 fulfill은 별도 단계다. */
export class InstallationResourceStore{
 readonly #access:AccessRepository;readonly #catalog:InstallationResourceCatalogPort;
 constructor(access:AccessRepository,options:InstallationStoreOptions={}){this.#access=access;this.#catalog=options.catalog??new InstallationResourceCatalog();}
 async #local(db:PoolClient,a:AuthenticatedIdentity){await db.query("SELECT set_config('anvil.actor_id',$1,true),set_config('anvil.client_id',$2,true)",[a.actorId,a.clientId]);}
 async #clock(db:PoolClient){const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))return fail();return at;}
 #stamp(value:unknown){if(!(value instanceof Date)||!Number.isFinite(value.getTime()))return fail();return value.toISOString();}
 #payload(c:ProjectCommand){let payload:ManageBackupResourcePayload;try{payload=readManageBackupResourcePayload(c.payload);}catch{return fail('INPUT_INVALID',422);}if(c.targetId!==(payload.resourceRef?.id??null)||c.expectedVersion!==payload.expectedResourceVersion||c.baselineRefs.length)return fail('INPUT_INVALID',422);return payload;}
 async #slot(payload:ManageBackupResourcePayload){const result=await this.#catalog.list('TARGET');if(result.state!=='CONFIGURED'||!Array.isArray(result.items))return fail('RESOURCE_UNVERIFIED',412);const rows=result.items.filter((v:any)=>v?.slotId===payload.slotId);if(rows.length!==1)return fail('RESOURCE_UNVERIFIED',412);const slot=rows[0];if(slot.purpose!=='BACKUP_TARGET'||slot.state!=='VERIFIED'||!refV1(slot.profileRef)||!Array.isArray(slot.reasonCodes)||slot.reasonCodes.length)return fail('RESOURCE_UNVERIFIED',412);}
 async #verify(db:PoolClient,a:AuthenticatedIdentity,c:ProjectCommand,ref:RuntimeRefV1,previous:any){
  const rows=(await db.query('SELECT * FROM anvil.installation_resource_intents WHERE project_id=$1 AND id=$2 FOR UPDATE',[c.projectId,ref.id])).rows;if(rows.length!==1)return fail();const row=rows[0],snapshot=row.snapshot_json;
  const createdAt=this.#stamp(row.created_at),expiresAt=this.#stamp(row.expires_at),expected={id:ref.id,version:1,projectId:c.projectId,payload:c.payload,actorId:a.actorId,clientId:a.clientId,sessionId:a.authSession?.id,controlGeneration:c.controlGeneration,policyRef:snapshot?.policyRef,approvalRef:c.approvalRef,clientCommandId:c.commandId,createdAt,expiresAt};
  if(!a.authSession||row.project_id!==c.projectId||row.actor_id!==a.actorId||row.client_id!==a.clientId||row.session_id!==a.authSession.id||!uuidV1(row.command_id)||row.content_hash!==ref.contentHash||!refV1(snapshot?.policyRef)||!installationSame(snapshot,expected)||installationHash(expected)!==ref.contentHash||Date.parse(expiresAt)<=Date.parse(createdAt)||Date.parse(expiresAt)-Date.parse(createdAt)>60000)return fail();
  const commands=(await db.query(`SELECT c.*,ar.scope_kind AS receipt_scope_kind,ar.scope_id AS receipt_scope_id,ar.subject_ref,ar.policy_ref AS receipt_policy_ref,ar.scope_digest,ar.approval_decision_ref,
   ae.event_id AS audit_event_id,ae.actor_ref AS audit_actor_ref,ae.client_ref AS audit_client_ref,ae.operation_id AS audit_operation_id,ae.target_ref AS audit_target_ref,ae.policy_ref AS audit_policy_ref,ae.approval_ref AS audit_approval_ref,ae.outcome AS audit_outcome,ae.scope_digest AS audit_scope_digest,ae.source_kind AS audit_source_kind,
   (SELECT count(*)::int FROM anvil.audit_events counted WHERE counted.project_id=c.project_id AND counted.command_id=c.id) AS audit_count,
   CASE WHEN rq.id IS NULL THEN NULL ELSE jsonb_build_object('requestId',rq.id,'decisionId',used.decision_id,'scopeDigest',used.scope_digest) END AS approval_ref
   FROM anvil.commands c JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id
   JOIN anvil.audit_events ae ON ae.project_id=c.project_id AND ae.command_id=c.id
   JOIN anvil.approval_consumptions used ON used.id=c.approval_consumption_id AND used.project_id=c.project_id AND used.command_id=c.id
   JOIN anvil.approval_decisions d ON d.project_id=c.project_id AND d.id=used.decision_id
   JOIN anvil.approval_requests rq ON rq.project_id=c.project_id AND rq.id=d.request_id AND rq.candidate_command_id=c.command_id
   WHERE c.project_id=$1 AND c.id=$2`,[c.projectId,row.command_id])).rows;if(commands.length!==1)return fail();const saved=commands[0],approval=readApprovalRef(c.approvalRef),digest=installationHash({projectId:c.projectId,actorId:a.actorId,clientId:a.clientId,controlGeneration:c.controlGeneration,requestHash:installationHash(c),policyRef:snapshot.policyRef,targetRef:ref});
  if(saved.id!==row.command_id||saved.project_id!==c.projectId||saved.scope_kind!=='PROJECT'||saved.scope_id!==c.projectId||saved.operation!=='manageBackupResource'||saved.state!=='APPLIED'||saved.actor_id!==a.actorId||saved.client_id!==a.clientId||saved.command_id!==c.commandId||saved.request_hash!==installationHash(c)||Number(saved.expected_version)!==c.expectedVersion||Number(saved.control_generation)!==c.controlGeneration||!installationSame(saved.policy_ref,snapshot.policyRef)||saved.authorization_receipt_id!==row.authorization_receipt_id||!uuidV1(saved.approval_consumption_id)||!installationSame(saved.approval_ref,approval)||!installationSame(saved.payload_ref,{kind:'ONE_TIME_APPROVAL_SCOPE',payloadHash:installationHash(c.payload),scopeDigest:approval.scopeDigest})||saved.receipt_scope_kind!=='PROJECT'||saved.receipt_scope_id!==c.projectId||!installationSame(saved.subject_ref,{kind:'HUMAN',userId:a.actorId,clientId:a.clientId})||!installationSame(saved.receipt_policy_ref,snapshot.policyRef)||saved.approval_decision_ref!==approval.decisionId||saved.scope_digest!==digest||row.scope_digest!==digest)return fail();
  if(saved.audit_count!==1||saved.audit_client_ref!==a.clientId||saved.audit_operation_id!==saved.operation_id||!installationSame(saved.audit_actor_ref,{kind:'HUMAN',userId:a.actorId})||!installationSame(saved.audit_target_ref,ref)||!installationSame(saved.audit_policy_ref,snapshot.policyRef)||!installationSame(saved.audit_approval_ref,approval)||saved.audit_outcome!=='APPLIED'||saved.audit_source_kind!=='HUMAN_COMMAND'||saved.audit_scope_digest!==digest)return fail();
  const result=saved.result_ref;if(!installationSame(result,previous)||result.status!=='APPLIED'||result.projectId!==c.projectId||result.commandId!==c.commandId||result.operationId!==saved.operation_id||result.targetId!==ref.id||result.version!==1||result.serverReceivedAt!==createdAt||result.data?.status!=='INTENT_READY'||!installationSame(result.data.ref,ref)||!installationSame(result.data.intentRef,ref)||!installationSame(result.evidenceRefs,[])||!installationSame(result.warnings,[])||this.#stamp(saved.completed_at)!==createdAt)return fail();
  return result;
 }
 async command(token:string,csrf:string,c:ProjectCommand){let returnDeadline=Infinity;
  try{const result=await this.#access.authenticated(token,csrf,async(db,a)=>{
   await this.#local(db,a);const created=(await db.query('SELECT transaction_timestamp() AS at')).rows[0]?.at,createdAt=this.#stamp(created);if(c.operation!=='manageBackupResource')return fail('PROJECT_OPERATION_DENIED',403);const payload=this.#payload(c);await currentProjectController(db,a,c);
   let policy=await authorizeMaterial(db,a,c,true),deadline=policy.validUntil,intentDeadline:number|undefined;const originalPolicy=policy.ref;
   const current=async()=>{await currentProjectController(db,a,c);policy=await authorizeMaterial(db,a,c,true);if(!installationSame(policy.ref,originalPolicy))return fail('RESOURCE_VERSION_CONFLICT',409);deadline=Math.min(deadline,policy.validUntil);const before=performance.now(),at=await this.#clock(db);returnDeadline=Math.min(returnDeadline,notificationSessionDeadline(a,at,before),before+deadline-at.getTime());if(intentDeadline!==undefined&&at.getTime()>=intentDeadline)return fail('RESOURCE_UNVERIFIED',412);if(at.getTime()>=deadline)return fail('PROJECT_OPERATION_DENIED',403);return at;};
   await current();if(c.approvalRef===null)return fail('APPROVAL_REQUIRED',412);
   if(payload.action!=='REGISTER_TARGET')return fail('RESOURCE_UNVERIFIED',412);
   const approvals=new ProjectApprovals(),approvalRef=readApprovalRef(c.approvalRef),view=await approvals.read(db,a,c.projectId,approvalRef.requestId),authorized=await approvals.authorize(db,a,c,originalPolicy);
   const previous=await projectReplay(db,a,c);
   if(previous!==undefined){const ref=(previous as any)?.data?.intentRef;if(!refV1(ref))return fail();const verified=await this.#verify(db,a,c,ref,previous);await current();return verified;}
   if(authorized.replay)return fail('APPROVAL_ALREADY_CONSUMED',409);
   if(!a.authSession)return fail('AUTH_REQUIRED',401);intentDeadline=Math.min(created.getTime()+60000,deadline,Date.parse(view.request.details.expiresAt),Date.parse(a.authSession.idleExpiresAt),Date.parse(a.authSession.absoluteExpiresAt));deadline=Math.min(deadline,intentDeadline);let now=await current();
   const pending=(await db.query("SELECT * FROM anvil.installation_resource_intents WHERE project_id=$1 AND (state='UNKNOWN' OR state='PROCESSING' OR (state='READY' AND expires_at>$2)) FOR UPDATE",[c.projectId,now])).rows;if(pending.length)return fail('RESOURCE_LIMIT',429);
   await this.#slot(payload);now=await current();if(!a.authSession)return fail('AUTH_REQUIRED',401);
   if(created.getTime()>now.getTime())return fail();
   const id=randomUUID(),expiresAt=new Date(intentDeadline).toISOString(),snapshot={id,version:1,projectId:c.projectId,payload,actorId:a.actorId,clientId:a.clientId,sessionId:a.authSession.id,controlGeneration:c.controlGeneration,policyRef:originalPolicy,approvalRef:c.approvalRef,clientCommandId:c.commandId,createdAt,expiresAt},ref={id,version:1,contentHash:installationHash(snapshot)};
   const receipt=await persistProjectReceipt(db,a,c,ref,{status:'INTENT_READY',intentRef:ref},originalPolicy,'INSTALLATION_RESOURCE_INTENT_READY');
   await current();
   await db.query('INSERT INTO anvil.installation_resource_intents(id,project_id,actor_id,client_id,session_id,command_id,authorization_receipt_id,scope_digest,state,snapshot_json,content_hash,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[id,c.projectId,a.actorId,a.clientId,a.authSession.id,receipt.id,receipt.authorizationReceiptRef.id,receipt.authorizationReceiptRef.contentHash,'READY',JSON.stringify(snapshot),ref.contentHash,created,new Date(expiresAt)]);
   const verified=await this.#verify(db,a,c,ref,receipt.result);await current();return verified;
  });if(performance.now()>=returnDeadline)return fail('AUTH_REQUIRED',401);return result;}
  catch(e){if(e instanceof AuthFailure)throw e;return fail();}
 }
}
