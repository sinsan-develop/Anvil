import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {isoV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {backupReferenceQuery,readBackupReferenceSnapshot,readBackupReferenceRevocation,type BackupReferenceSnapshot} from '../../../../contracts/runtime/backup-references-v1.ts';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {authorizeMaterial,currentProjectController,persistProjectReceipt,projectMember,projectReplay,type ProjectCommand} from '../access/project-command.ts';
import {ProjectApprovals} from '../approvals/project-approvals.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {ProjectListCodec} from '../projects/service.ts';
import {type BackupResourceProvider,UnconfiguredBackupResourceProvider} from './backup-resource-provider.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const bad=(code='BACKUP_REFERENCE_INTEGRITY_FAILED',status=503):never=>{throw new AuthFailure(code,status);};
function input<T>(f:()=>T,status=422):T{try{return f();}catch(e){if(e instanceof AuthFailure)throw e;return bad('INPUT_INVALID',status);}}
function stamp(v:unknown):string{if(!(v instanceof Date)||!Number.isFinite(v.getTime()))return bad();return v.toISOString();}
interface ReferenceView {ref:VersionRef;snapshot:BackupReferenceSnapshot;previousRef:VersionRef|null;createdAt:string;commandRecordId:string;clientCommandId:string;operationId:string;auditEventId:string;current:{eligible:boolean;reasonCodes:string[];observedAt:string}}
/** 보관 metadata만 저장한다. 실제 backup/key/provider 실행 capability를 발급하지 않는다. */
export class BackupReferenceStore {
 #access:AccessRepository;#provider:BackupResourceProvider;
 constructor(access:AccessRepository,provider:BackupResourceProvider=new UnconfiguredBackupResourceProvider()){this.#access=access;this.#provider=provider;}
 async #local(db:PoolClient,a:AuthenticatedIdentity){await db.query("SELECT set_config('anvil.actor_id',$1,true),set_config('anvil.client_id',$2,true)",[a.actorId,a.clientId]);}
 async #owner(db:PoolClient,a:AuthenticatedIdentity,pid:string){const p=await projectMember(db,a,pid,true);if(p.archived_at||p.participation!=='OWNER')bad('NOT_FOUND',404);}
 async #clock(db:PoolClient,a:AuthenticatedIdentity){const before=performance.now(),at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;notificationSessionDeadline(a,at,before);if(!(at instanceof Date))return bad();return at;}
 async #read<T>(token:string,pid:string,body:(db:PoolClient,a:AuthenticatedIdentity)=>Promise<T>){let deadline=Infinity;return this.#storage(async()=>{const value=await this.#access.authenticated(token,null,async(db,a)=>{await this.#local(db,a);await this.#owner(db,a,pid);const before=performance.now(),at=await this.#clock(db,a);deadline=Math.min(deadline,notificationSessionDeadline(a,at,before));const value=await body(db,a);await this.#owner(db,a,pid);const finalBefore=performance.now(),finalAt=await this.#clock(db,a);deadline=Math.min(deadline,notificationSessionDeadline(a,finalAt,finalBefore));return value;});if(performance.now()>=deadline)bad('AUTH_REQUIRED',401);return value;});}
 async #storage<T>(f:()=>Promise<T>){try{return await f();}catch(e){if(e instanceof AuthFailure)throw e;throw new AuthFailure('BACKUP_REFERENCE_STORAGE_FAILED',503);}}
 #query(q:Record<string,unknown>,resources=false){return input(()=>backupReferenceQuery(q,resources),400);}
 #codec(domain:string){return new ProjectListCodec(v=>this.#access.signProjectCursor('FN16_BACKUP_REFERENCES:'+domain+':'+v));}
 #filter(a:AuthenticatedIdentity,pid:string,domain:string,kind:string|undefined,limit:number){return {query:canonicalJson({domain,projectId:pid,actorId:a.actorId,clientId:a.clientId,kind:kind??null,order:'CREATED_AT_ID_DESC'}),archived:false,limit};}
 async resources(token:string,pid:string,q:Record<string,unknown>){const query=this.#query(q,true);return this.#read(token,pid,async(db,a)=>{const at=await this.#clock(db,a),filter=this.#filter(a,pid,'RESOURCE',query.kind,query.limit),codec=this.#codec('RESOURCE');let pos:{at:string;id:string}|null=null;if(query.cursor)try{pos=codec.read(query.cursor,a.actorId,filter,at);}catch{bad('CURSOR_INVALID',400);}const state=await(this.#provider.stateFor?.(query.kind!)??this.#provider.state),all=state==='UNCONFIGURED'?[]:[...await this.#provider.list(pid,query.kind!,{db,actor:a})];all.sort((x,y)=>y.verifiedAt.localeCompare(x.verifiedAt)||y.ref.id.localeCompare(x.ref.id));const rows=pos?all.filter(x=>x.verifiedAt<pos!.at||x.verifiedAt===pos!.at&&x.ref.id<pos!.id):all,items=rows.slice(0,query.limit),hasMore=rows.length>query.limit,last=items.at(-1);return{state,page:{items,nextCursor:hasMore&&last?codec.create(a.actorId,filter,{at:last.verifiedAt,id:last.ref.id},at):null,hasMore,observedAt:at.toISOString()}};});}
 async resource(token:string,pid:string,id:string,version:number,q:Record<string,unknown>){if(Object.keys(q).length)bad('INPUT_INVALID',400);return this.#read(token,pid,async(db,a)=>{if(!uuidV1(id)||!Number.isSafeInteger(version)||version<1)bad('INPUT_INVALID',400);const value=await this.#provider.read(pid,id,version,{db,actor:a});if(!value)bad('NOT_FOUND',404);return value;});}
 async #target(db:PoolClient,a:AuthenticatedIdentity,pid:string,snapshot:BackupReferenceSnapshot){const wanted=(snapshot.spec as {installationResourceRef:VersionRef}).installationResourceRef,value=await this.#provider.read(pid,wanted.id,wanted.version,{db,actor:a});if(!value||value.kind!=='TARGET'||!same(value.ref,wanted)||value.current?.eligible!==true)bad('BACKUP_RESOURCE_PROVIDER_NOT_CONNECTED',412);return value;}
 async #key(db:PoolClient,a:AuthenticatedIdentity,pid:string,snapshot:BackupReferenceSnapshot){const ref=(snapshot.spec as {installationResourceRef:VersionRef}).installationResourceRef;if(!this.#provider.keySelectable||await this.#provider.keySelectable(pid,ref,{db,actor:a})!==true)bad('KEY_PROTECTION_UNVERIFIED',412);}
 async #head(db:PoolClient,pid:string,id:string){return (await db.query('SELECT * FROM anvil.backup_references WHERE project_id=$1 AND id=$2 FOR UPDATE',[pid,id])).rows[0];}
 async #version(db:PoolClient,pid:string,id:string,version:number){const row=(await db.query('SELECT v.*,r.kind,r.head_version FROM anvil.backup_reference_versions v JOIN anvil.backup_references r ON r.project_id=v.project_id AND r.id=v.reference_id WHERE v.project_id=$1 AND v.reference_id=$2 AND v.version=$3',[pid,id,version])).rows[0];if(!row)bad('NOT_FOUND',404);return row;}
 async #receipt(db:PoolClient,pid:string,row:any,ref:VersionRef,status:string,payload:unknown,targetId:string|null,expectedVersion:number|null){
  const rows=(await db.query(`SELECT c.*,ar.scope_kind AS receipt_scope_kind,ar.scope_id AS receipt_scope_id,ar.subject_ref,ar.policy_ref AS receipt_policy_ref,ar.scope_digest,ar.approval_decision_ref,
   ae.event_id AS audit_event_id,ae.actor_ref AS audit_actor_ref,ae.client_ref AS audit_client_ref,ae.operation_id AS audit_operation_id,ae.target_ref AS audit_target_ref,ae.policy_ref AS audit_policy_ref,ae.approval_ref AS audit_approval_ref,ae.outcome AS audit_outcome,ae.source_kind AS audit_source_kind,ae.scope_digest AS audit_scope_digest,
   (SELECT count(*)::int FROM anvil.audit_events counted WHERE counted.project_id=c.project_id AND counted.command_id=c.id) AS audit_count,
   CASE WHEN rq.id IS NULL THEN NULL ELSE jsonb_build_object('requestId',rq.id,'decisionId',d.id,'scopeDigest',rq.scope_digest) END AS approval_ref
   FROM anvil.commands c JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id
   JOIN anvil.audit_events ae ON ae.project_id=c.project_id AND ae.command_id=c.id
   LEFT JOIN anvil.approval_consumptions used ON used.id=c.approval_consumption_id AND used.project_id=c.project_id AND used.command_id=c.id
   LEFT JOIN anvil.approval_decisions d ON d.project_id=c.project_id AND d.id=used.decision_id AND d.decision='APPROVE' AND d.decided_by=c.actor_id AND d.client_id=c.client_id AND d.control_generation=c.control_generation
   LEFT JOIN anvil.approval_requests rq ON rq.project_id=c.project_id AND rq.id=d.request_id AND rq.candidate_command_id=c.command_id AND rq.scope_digest=d.scope_digest AND rq.scope_digest=used.scope_digest AND rq.policy_ref=c.policy_ref AND used.policy_id::text=c.policy_ref->>'id' AND used.policy_version::text=c.policy_ref->>'version'
   WHERE c.project_id=$1 AND c.id=$2`,[pid,row.command_id])).rows;
  if(rows.length!==1)return bad();const c=rows[0],operation=status==='REFERENCE_STORED'?'saveBackupReference':'revokeBackupReference',expected=expectedVersion??Number(c.expected_version),approval=c.approval_ref??null;
  if(!Number.isSafeInteger(expected)||expected<0||!refV1(c.policy_ref)||!uuidV1(c.id)||!uuidV1(c.command_id)||!uuidV1(c.operation_id)||!uuidV1(c.audit_event_id)||c.actor_id!==row.actor_id||c.client_id!==row.client_id||c.state!=='APPLIED'||c.scope_kind!=='PROJECT'||c.scope_id!==pid||c.operation!==operation||Number(c.expected_version)!==expected||c.receipt_scope_kind!=='PROJECT'||c.receipt_scope_id!==pid||!same(c.subject_ref,{kind:'HUMAN',userId:c.actor_id,clientId:c.client_id})||!same(c.receipt_policy_ref,c.policy_ref))return bad();
  if(c.approval_consumption_id===null){if(approval!==null||c.approval_decision_ref!==null||c.payload_ref!==null)return bad();}
  else if(!approval||Object.keys(approval).sort().join(',')!=='decisionId,requestId,scopeDigest'||!uuidV1(approval.requestId)||!uuidV1(approval.decisionId)||!/^[a-f0-9]{64}$/.test(approval.scopeDigest)||c.approval_decision_ref!==approval.decisionId||!same(c.payload_ref,{kind:'ONE_TIME_APPROVAL_SCOPE',payloadHash:hash(payload),scopeDigest:approval.scopeDigest}))return bad();
  const original={schemaVersion:1,projectId:pid,commandId:c.command_id,clientId:c.client_id,controlGeneration:Number(c.control_generation),operation,targetId,expectedVersion:expected,baselineRefs:[],approvalRef:approval,payload};
  const digest=hash({projectId:pid,actorId:c.actor_id,clientId:c.client_id,controlGeneration:Number(c.control_generation),requestHash:c.request_hash,policyRef:c.policy_ref,targetRef:ref});
  if(c.request_hash!==hash(original)||c.scope_digest!==digest||c.audit_scope_digest!==digest||c.audit_count!==1||c.audit_client_ref!==c.client_id||c.audit_operation_id!==c.operation_id||!same(c.audit_actor_ref,{kind:'HUMAN',userId:c.actor_id})||!same(c.audit_policy_ref,c.policy_ref)||!same(c.audit_target_ref,ref)||!same(c.audit_approval_ref,approval)||c.audit_outcome!=='APPLIED'||c.audit_source_kind!=='HUMAN_COMMAND')return bad();
  const result=c.result_ref;if(result?.projectId!==pid||result.commandId!==c.command_id||result.operationId!==c.operation_id||result.status!=='APPLIED'||result.targetId!==ref.id||result.version!==ref.version||result.serverReceivedAt!==stamp(row.created_at)||stamp(c.completed_at)!==stamp(row.created_at)||result.data?.status!==status||!same(result.data.ref,ref)||!same(result.evidenceRefs,[])||!same(result.warnings,[]))return bad();
  return c;
 }
 async #view(db:PoolClient,a:AuthenticatedIdentity,pid:string,row:any):Promise<ReferenceView>{
  let snapshot:BackupReferenceSnapshot;try{snapshot=readBackupReferenceSnapshot(row.snapshot_json);}catch{return bad();}const version=Number(row.version),id=row.reference_id,previousRef=row.previous_version===null?null:{id,version:Number(row.previous_version),contentHash:row.previous_hash};
  if(!uuidV1(id)||!Number.isSafeInteger(version)||version<1||row.project_id!==pid||row.kind!==snapshot.kind||version===1&&previousRef!==null||version>1&&(!refV1(previousRef)||previousRef.version!==version-1))return bad();
  const ref={id,version,contentHash:hash({projectId:pid,id,version,snapshot,previousRef})};if(ref.contentHash!==row.content_hash)return bad();
  if(previousRef){const previous=await this.#version(db,pid,id,previousRef.version);if(previous.content_hash!==previousRef.contentHash)return bad();}
  const c=await this.#receipt(db,pid,row,ref,'REFERENCE_STORED',snapshot,version===1?null:id,version-1);if(!same(c.result_ref.data.previousRef,previousRef))return bad();
  const events=(await db.query('SELECT * FROM anvil.backup_reference_events WHERE project_id=$1 AND reference_id=$2 AND reference_version=$3',[pid,id,version])).rows;
  if(events.length>1)return bad();for(const event of events){if(event.reference_hash!==ref.contentHash)return bad();await this.#event(db,pid,event);}
  const at=await this.#clock(db,a);let eligible=false;let reasonCodes=events.length?['REFERENCE_REVOKED']:snapshot.kind==='VERIFICATION'?['VERIFICATION_NOT_CONNECTED']:['RESOURCE_PROVIDER_NOT_CONNECTED'];if(!events.length&&snapshot.kind==='TARGET'){try{await this.#target(db,a,pid,snapshot);eligible=true;reasonCodes=[];}catch(e){if(!(e instanceof AuthFailure)||e.statusCode!==412)throw e;}}
  if(!events.length&&snapshot.kind==='ENCRYPTION_KEY'){try{await this.#key(db,a,pid,snapshot);eligible=true;reasonCodes=[];}catch(e){if(!(e instanceof AuthFailure)||e.statusCode!==412)throw e;}}
  return {ref,snapshot,previousRef,createdAt:stamp(row.created_at),commandRecordId:c.id,clientCommandId:c.command_id,operationId:c.operation_id,auditEventId:c.audit_event_id,current:{eligible,reasonCodes,observedAt:at.toISOString()}};
 }
 async #event(db:PoolClient,pid:string,row:any){
  const s=row.snapshot_json,ref={id:row.id,version:1,contentHash:hash(s)};
  if(!s||Object.keys(s).sort().join(',')!==['eventId','version','eventKind','projectId','referenceRef','reason','actorId','clientId','clientCommandId','createdAt'].sort().join(',')||s.eventId!==row.id||s.version!==1||s.eventKind!=='REVOKED'||s.projectId!==pid||!refV1(s.referenceRef)||s.referenceRef.id!==row.reference_id||s.referenceRef.version!==Number(row.reference_version)||s.referenceRef.contentHash!==row.reference_hash||s.reason!==row.reason||s.actorId!==row.actor_id||s.clientId!==row.client_id||s.createdAt!==stamp(row.created_at)||row.content_hash!==ref.contentHash||Number(row.version)!==1||row.event_kind!=='REVOKED')return bad();
  const c=await this.#receipt(db,pid,row,ref,'REFERENCE_REVOKED',{referenceRef:s.referenceRef,reason:s.reason},row.reference_id,null);if(s.clientCommandId!==c.command_id||!same(c.result_ref.data.referenceRef,s.referenceRef))return bad();return {ref,c};
 }
 async read(token:string,pid:string,id:string,version:number,q:Record<string,unknown>={}){if(Object.keys(q).length||!uuidV1(id)||!Number.isSafeInteger(version)||version<1)bad('INPUT_INVALID',400);return this.#read(token,pid,async(db,a)=>this.#view(db,a,pid,await this.#version(db,pid,id,version)));}
 async list(token:string,pid:string,q:Record<string,unknown>){const query=this.#query(q);return this.#read(token,pid,async(db,a)=>{
  const at=await this.#clock(db,a),filter=this.#filter(a,pid,'REFERENCE',query.kind,query.limit),codec=this.#codec('REFERENCE');let pos:{at:string;id:string}|null=null;
  if(query.cursor)try{pos=codec.read(query.cursor,a.actorId,filter,at);}catch{bad('CURSOR_INVALID',400);}
  const rows=(await db.query('SELECT v.*,r.kind,r.head_version FROM anvil.backup_references r JOIN anvil.backup_reference_versions v ON v.project_id=r.project_id AND v.reference_id=r.id AND v.version=r.head_version WHERE r.project_id=$1 AND ($2::text IS NULL OR r.kind=$2) AND ($3::timestamptz IS NULL OR (v.created_at,r.id)<($3::timestamptz,$4::uuid)) ORDER BY v.created_at DESC,r.id DESC LIMIT $5',[pid,query.kind??null,pos?.at??null,pos?.id??null,query.limit+1])).rows;
  const items:ReferenceView[]=[];for(const row of rows.slice(0,query.limit))items.push(await this.#view(db,a,pid,row));const hasMore=rows.length>query.limit,last=items.at(-1);return {items,hasMore,nextCursor:hasMore&&last?codec.create(a.actorId,filter,{at:last.createdAt,id:last.ref.id},at):null,observedAt:(await this.#clock(db,a)).toISOString()};
 });}
 async command(token:string,csrf:string,c:ProjectCommand){let returnDeadline=Infinity;return this.#storage(async()=>{const result=await this.#access.authenticated(token,csrf,async(db,a)=>{
  await this.#local(db,a);await currentProjectController(db,a,c);if(c.baselineRefs.length)bad('REFERENCE_CONNECTION_PENDING',412);
  let policy=await authorizeMaterial(db,a,c,true),deadline=policy.validUntil;const originalPolicy=policy.ref;
  const current=async()=>{await currentProjectController(db,a,c);const before=performance.now(),at=await this.#clock(db,a),p=await authorizeMaterial(db,a,c,true);returnDeadline=Math.min(returnDeadline,notificationSessionDeadline(a,at,before),before+deadline-at.getTime(),before+p.validUntil-at.getTime());if(!same(p.ref,originalPolicy))bad('VERSION_CONFLICT',409);deadline=Math.min(deadline,p.validUntil);if(at.getTime()>=deadline)bad('PROJECT_OPERATION_DENIED',403);return at;};
  await current();let previous:unknown;try{previous=await projectReplay(db,a,c);}catch(e){if(e instanceof AuthFailure&&e.message==='IDEMPOTENCY_CONFLICT')bad('COMMAND_CONFLICT',409);throw e;}
  if(previous!==undefined){const result=previous as any,ref=result?.data?.ref;if(!refV1(ref))return bad();
   if(c.operation==='saveBackupReference'){const view=await this.#view(db,a,c.projectId,await this.#version(db,c.projectId,ref.id,ref.version));if(!same(view.snapshot,c.payload)||!same(view.ref,ref)||view.clientCommandId!==c.commandId)return bad();}
   else{const row=(await db.query('SELECT * FROM anvil.backup_reference_events WHERE project_id=$1 AND id=$2',[c.projectId,ref.id])).rows[0];if(!row)return bad();const event=await this.#event(db,c.projectId,row);if(!same(event.ref,ref)||!same(row.snapshot_json.referenceRef,c.payload.referenceRef)||row.reason!==c.payload.reason||event.c.command_id!==c.commandId)return bad();}
   await current();return previous;
  }
  if(!['saveBackupReference','revokeBackupReference'].includes(c.operation))bad('PROJECT_OPERATION_DENIED',403);
  const snapshot=c.operation==='saveBackupReference'?input(()=>readBackupReferenceSnapshot(c.payload)):null,revocation=c.operation==='revokeBackupReference'?input(()=>readBackupReferenceRevocation(c.payload)):null;
  if(c.operation==='saveBackupReference'&&c.targetId===null&&c.expectedVersion!==0||c.targetId!==null&&(!uuidV1(c.targetId)||c.expectedVersion<1))bad('VERSION_CONFLICT',409);
  const head=c.targetId===null?null:await this.#head(db,c.projectId,c.targetId);if(c.targetId!==null&&(!head||Number(head.head_version)!==c.expectedVersion))bad('VERSION_CONFLICT',409);
  let previousRef:VersionRef|null=null;if(head){const v=await this.#view(db,a,c.projectId,await this.#version(db,c.projectId,head.id,Number(head.head_version)));previousRef=v.ref;if(snapshot&&v.snapshot.kind!==snapshot.kind)bad('VERSION_CONFLICT',409);}
  if(snapshot?.kind==='TARGET')await this.#target(db,a,c.projectId,snapshot);if(snapshot?.kind==='ENCRYPTION_KEY')await this.#key(db,a,c.projectId,snapshot);if(snapshot?.kind==='VERIFICATION')bad('REFERENCE_UNAVAILABLE',412);
  let target:ReferenceView|null=null;
  if(revocation){if(!head||revocation.referenceRef.id!==head.id)bad('VERSION_CONFLICT',409);try{target=await this.#view(db,a,c.projectId,await this.#version(db,c.projectId,revocation.referenceRef.id,revocation.referenceRef.version));}catch(e){if(e instanceof AuthFailure&&e.statusCode===404)bad('VERSION_CONFLICT',409);throw e;}if(!same(target.ref,revocation.referenceRef))bad('VERSION_CONFLICT',409);if(target.current.reasonCodes.includes('REFERENCE_REVOKED'))bad('REFERENCE_ALREADY_REVOKED',409);}
  if(policy.approvalRequired&&c.approvalRef===null)bad('APPROVAL_REQUIRED',412);
  if(policy.approvalRequired)await new ProjectApprovals().authorize(db,a,c,policy.ref);else if(c.approvalRef!==null)bad('APPROVAL_NOT_REQUIRED',422);
  const now=await current(),createdAt=(await db.query('SELECT transaction_timestamp() AS at')).rows[0]?.at;if(!(createdAt instanceof Date)||createdAt.getTime()>now.getTime())return bad();
  if(snapshot){const id=head?.id??randomUUID(),version=c.expectedVersion+1;if(!Number.isSafeInteger(version))bad('VERSION_CONFLICT',409);const ref={id,version,contentHash:hash({projectId:c.projectId,id,version,snapshot,previousRef})};
   const receipt=await persistProjectReceipt(db,a,c,ref,{status:'REFERENCE_STORED',previousRef},policy.ref,'EXPLICIT_BACKUP_REFERENCE_STORED');
   if(!head)await db.query('INSERT INTO anvil.backup_references(project_id,id,kind,head_version,created_by,created_at) VALUES($1,$2,$3,$4,$5,$6)',[c.projectId,id,snapshot.kind,version,a.actorId,createdAt]);
   else{const updated=await db.query('UPDATE anvil.backup_references SET head_version=$3 WHERE project_id=$1 AND id=$2 AND head_version=$4',[c.projectId,id,version,c.expectedVersion]);if(updated.rowCount!==1)bad('VERSION_CONFLICT',409);}
   await db.query('INSERT INTO anvil.backup_reference_versions(project_id,reference_id,version,snapshot_json,content_hash,previous_version,previous_hash,actor_id,client_id,command_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[c.projectId,id,version,JSON.stringify(snapshot),ref.contentHash,previousRef?.version??null,previousRef?.contentHash??null,a.actorId,a.clientId,receipt.id,createdAt]);if(snapshot.kind==='TARGET')await this.#target(db,a,c.projectId,snapshot);if(snapshot.kind==='ENCRYPTION_KEY')await this.#key(db,a,c.projectId,snapshot);await current();return receipt.result;
  }
  if(!revocation||!target)return bad();const eventId=randomUUID(),event={eventId,version:1,eventKind:'REVOKED',projectId:c.projectId,referenceRef:target.ref,reason:revocation.reason,actorId:a.actorId,clientId:a.clientId,clientCommandId:c.commandId,createdAt:createdAt.toISOString()},ref={id:eventId,version:1,contentHash:hash(event)};
  const receipt=await persistProjectReceipt(db,a,c,ref,{status:'REFERENCE_REVOKED',referenceRef:target.ref},policy.ref,'EXPLICIT_BACKUP_REFERENCE_REVOKED');
  await db.query('INSERT INTO anvil.backup_reference_events(project_id,id,reference_id,reference_version,reference_hash,event_kind,reason,actor_id,client_id,command_id,created_at,version,snapshot_json,content_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[c.projectId,eventId,target.ref.id,target.ref.version,target.ref.contentHash,'REVOKED',revocation.reason,a.actorId,a.clientId,receipt.id,createdAt,1,JSON.stringify(event),ref.contentHash]);await current();return receipt.result;
 });if(performance.now()>=returnDeadline)bad('BACKUP_REFERENCE_RESULT_UNCERTAIN',503);return result;});}
}

/** 현재 본문 head fullref를 승인 target에 결박한다. payload의 과거 회수 ref와 혼동하지 않는다. */
export async function assertBackupReferenceApprovalTarget(db:PoolClient,a:AuthenticatedIdentity,pid:string,scope:{operation:string;targetRef:VersionRef|null;expectedVersion:number}){
 await db.query("SELECT set_config('anvil.actor_id',$1,true),set_config('anvil.client_id',$2,true)",[a.actorId,a.clientId]);
 const member=await projectMember(db,a,pid,true);if(member.archived_at||member.participation!=='OWNER')bad('NOT_FOUND',404);
 if(scope.targetRef===null){if(scope.operation!=='saveBackupReference'||scope.expectedVersion!==0)bad('APPROVAL_CANDIDATE_MISMATCH',409);return;}
 const h=(await db.query('SELECT * FROM anvil.backup_references WHERE project_id=$1 AND id=$2 FOR UPDATE',[pid,scope.targetRef.id])).rows[0];
 if(!h||Number(h.head_version)!==scope.expectedVersion||scope.targetRef.version!==scope.expectedVersion)bad('VERSION_CONFLICT',409);
 const v=(await db.query('SELECT v.*,r.kind,r.head_version FROM anvil.backup_reference_versions v JOIN anvil.backup_references r ON r.project_id=v.project_id AND r.id=v.reference_id WHERE v.project_id=$1 AND v.reference_id=$2 AND v.version=$3',[pid,scope.targetRef.id,scope.expectedVersion])).rows[0];
 if(!v||v.content_hash!==scope.targetRef.contentHash)bad('APPROVAL_CANDIDATE_MISMATCH',409);
 let snapshot:BackupReferenceSnapshot;try{snapshot=readBackupReferenceSnapshot(v.snapshot_json);}catch{return bad();}
 const previousRef=v.previous_version===null?null:{id:scope.targetRef.id,version:Number(v.previous_version),contentHash:v.previous_hash};
 if(hash({projectId:pid,id:scope.targetRef.id,version:Number(v.version),snapshot,previousRef})!==scope.targetRef.contentHash)bad('APPROVAL_CANDIDATE_MISMATCH',409);
}
