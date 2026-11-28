import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../access/repository.ts';
import {currentPolicy,currentProjectController,persistProjectReceipt,projectMember,projectReplay,type ProjectCommand} from '../access/project-command.ts';
import {preparationHash,readPreparationGet,type PreparationGet} from './preparation-record-input.ts';
import type {PreparationRecordStore} from './preparation-record-store.ts';

export const createTransferManifest='createTransferManifest';
export const readTransferManifest='readTransferManifest';
const reason='EXPLICIT_TRANSFER_MANIFEST';
const unverifiedGaps=['COMPLETED_UNVERIFIED','UNFINISHED_UNVERIFIED','CURRENT_POSITION_UNVERIFIED','DECISIONS_WITH_REASONS_UNVERIFIED'] as const;
function same(a:unknown,b:unknown){try{return canonicalJson(a)===canonicalJson(b);}catch{return false;}}
const reject=(code:string,status:number):never=>{throw new AuthFailure(code,status);};
const integrity=()=>reject('TRANSFER_MANIFEST_INTEGRITY_FAILED',503);
const ref=(v:unknown):v is RuntimeRefV1=>refV1(v)&&v.version===1;
const clockText=(v:unknown)=>{
 if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v))v=new Date(v);
 if(v instanceof Date&&Number.isFinite(v.getTime()))return v.toISOString();
 return integrity();
};
async function settle<T>(work:()=>Promise<T>):Promise<T>{
 try{return await work();}
 catch(error){
  if(error instanceof AuthFailure)throw error;
  if(error instanceof Error&&'code' in error&&['40P01','40001'].includes(String(error.code)))return reject('CONCURRENT_CHANGE',409);
  return reject('TRANSFER_MANIFEST_STORAGE_UNAVAILABLE',503);
 }
}

function commandInput(raw:unknown):ProjectCommand{
 if(!recordV1(raw,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])
  ||raw.schemaVersion!==1||!uuidV1(raw.projectId)||!uuidV1(raw.commandId)||!uuidV1(raw.clientId)
  ||!Number.isSafeInteger(raw.controlGeneration)||raw.controlGeneration<1||raw.operation!==createTransferManifest||raw.targetId!==null
  ||raw.expectedVersion!==0||!arrayV1(raw.baselineRefs,0)||raw.approvalRef!==null
  ||!recordV1(raw.payload,['preparationRef'])||!ref(raw.payload.preparationRef))return reject('INPUT_INVALID',422);
 return cloneV1(raw) as ProjectCommand;
}

/** 원문 선택과 미확인 공백만 고정한다. 선택 근거는 기존 보호 reader에서 따로 연다. */
function snapshotOf(parent:PreparationGet,id:string,at:string){
 const s=parent.record;
 return {schemaVersion:1,id,projectId:s.projectId,version:1,kind:'TRANSFER_MANIFEST',preparationRef:parent.ref,
  assignmentRef:s.assignmentRef,contextRef:s.contextRef,roleRef:s.roleRef,oldBindingRef:s.oldBindingRef,targetRef:s.targetConnectionRef,
  baselineRefs:s.baselineRefs,budgetRef:s.budgetRef,sourceRefs:s.sourceRefs,requiredContext:s.requiredContext,gaps:[...s.gaps,...unverifiedGaps],
  completed:[],unfinished:[],currentPosition:null,decisionsWithReasons:[],sourceDiffs:[],
  recoveryState:'UNVERIFIED',capabilities:'UNVERIFIED',understandingState:'NOT_REVIEWED',
  intentExpiresAt:s.intentExpiresAt,observedAt:at,manifestStored:true,bindingFrozen:false,ready:false,
  transferConfirmed:false,resumeAuthorized:false,executionAuthorized:false,dispatchPerformed:false} as const;
}

/** 같은 인증 거래에서 기존 제출/출처 검산과 새 인계본 정착을 묶는다. */
export class ProjectTransferManifests{
 readonly #access:Pick<AccessRepository,'authenticated'>;
 readonly #preparations:Pick<PreparationRecordStore,'read'>;
 constructor(access:Pick<AccessRepository,'authenticated'>,preparations:PreparationRecordStore){
  this.#access=access;
  this.#preparations=preparations;
 }

 async #current(db:PoolClient,actor:AuthenticatedIdentity,pid:string,command?:ProjectCommand){
  const session=actor.authSession;
  const now=clockText((await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at);
  if(!session||!uuidV1(session.id)||!uuidV1(actor.actorId)||!uuidV1(actor.clientId)||!Number.isSafeInteger(actor.credentialGeneration)
   ||actor.credentialGeneration<1||!isoV1(session.idleExpiresAt)||!isoV1(session.absoluteExpiresAt)
   ||Math.min(Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt))<=Date.parse(now))return reject('AUTH_REQUIRED',401);
  const member=await projectMember(db,actor,pid,true);
  if(member.participation!=='OWNER'||member.archived_at)return reject('NOT_FOUND',404);
  if(command){if(command.clientId!==actor.clientId)return reject('PROJECT_CONTROL_REQUIRED',403);await currentProjectController(db,actor,command);}
  const policy=await currentPolicy(db,pid);
  if(!policy)return reject('PERMISSION_POLICY_UNCONFIGURED',412);
  let until=Infinity;
  for(const operation of command?[createTransferManifest,readTransferManifest]:[readTransferManifest]){
   const rules=policy.rules.filter(r=>r?.subjectRef?.kind==='HUMAN'&&r.subjectRef.userId===actor.actorId
    &&Array.isArray(r.operations)&&r.operations.includes(operation)&&Array.isArray(r.targetScopes)
    &&r.targetScopes.some(s=>s.kind==='PROJECT'&&s.projectId===pid)&&isoV1(r.expiresAt)&&Date.parse(r.expiresAt)>Date.parse(now));
   if(!rules.length||rules.some(r=>r.disposition==='DENY'))return reject('PROJECT_OPERATION_DENIED',403);
   if(rules.some(r=>r.disposition==='REQUIRE_APPROVAL'))return reject('TRANSFER_MANIFEST_APPROVAL_NOT_CONNECTED',412);
   if(rules.some(r=>r.disposition!=='AUTO'||r.limitPolicyRef!==null||r.targetScopes.length!==1||!recordV1(r.targetScopes[0],['kind','projectId'])))return integrity();
   until=Math.min(until,...rules.map(rule=>Date.parse(rule.expiresAt)));
  }
  const checked=clockText((await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at);
  if(checked<now)return integrity();
  if(Math.min(Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt))<=Date.parse(checked))return reject('AUTH_REQUIRED',401);
  if(until<=Date.parse(checked))return reject('PROJECT_OPERATION_DENIED',403);
  return {policyRef:policy.ref,now:checked};
 }

 async #parent(db:PoolClient,actor:AuthenticatedIdentity,pid:string,exact:RuntimeRefV1){
  const parent=readPreparationGet(await this.#preparations.read(db,actor,pid,exact.id,exact.version));
  if(parent.projectId!==pid||!same(parent.ref,exact))return reject('NOT_FOUND',404);
  return parent;
 }

 async #stored(db:PoolClient,actor:AuthenticatedIdentity,pid:string,exact:RuntimeRefV1){
  const rows=(await db.query(`/*FN14_MANIFEST_READ*/
   SELECT m.*,to_jsonb(c) AS command_row,
     (SELECT jsonb_agg(to_jsonb(r)) FROM anvil.authorization_receipts r WHERE r.command_id=c.id) AS receipt_rows,
     (SELECT jsonb_agg(to_jsonb(a)) FROM anvil.audit_events a WHERE a.project_id=m.project_id AND a.command_id=c.id) AS audit_rows
   FROM anvil.transfer_manifests m LEFT JOIN anvil.commands c ON c.project_id=m.project_id AND c.id=m.command_id
   WHERE m.project_id=$1 AND m.id=$2 AND m.version=$3 AND m.content_hash=$4 AND m.creator_user_id=$5`,
   [pid,exact.id,exact.version,exact.contentHash,actor.actorId])).rows;
  if(!rows.length)return reject('NOT_FOUND',404);
  if(rows.length!==1)return integrity();
  const row=rows[0],c=row.command_row;
  const parentRef={id:row.preparation_id,version:Number(row.preparation_version),contentHash:row.preparation_hash};
  if(row.project_id!==pid||row.id!==exact.id||Number(row.version)!==1||row.content_hash!==exact.contentHash||row.creator_user_id!==actor.actorId
   ||!ref(parentRef)||!c||!uuidV1(c.id)||!uuidV1(c.command_id)||!uuidV1(c.operation_id)||!uuidV1(c.client_id)
   ||c.project_id!==pid||c.scope_kind!=='PROJECT'||c.scope_id!==pid||c.id!==row.command_id||c.actor_id!==actor.actorId||c.client_id!==row.creator_client_id
   ||c.operation!==createTransferManifest||c.state!=='APPLIED'||Number(c.expected_version)!==0||!Number.isSafeInteger(Number(c.control_generation))||Number(c.control_generation)<1
   ||c.approval_consumption_id!==null||c.payload_ref!==null||!refV1(c.policy_ref)||!Array.isArray(row.receipt_rows)||row.receipt_rows.length!==1
   ||!Array.isArray(row.audit_rows)||row.audit_rows.length!==1)return integrity();
  const parent=await this.#parent(db,actor,pid,parentRef),createdAt=clockText(row.created_at),snapshot=snapshotOf(parent,exact.id,createdAt);
  if(createdAt<parent.record.observedAt||createdAt>=parent.record.intentExpiresAt||!same(snapshot,row.snapshot_json)||preparationHash(snapshot)!==exact.contentHash)return integrity();
  const command=commandInput({schemaVersion:1,projectId:pid,commandId:c.command_id,clientId:c.client_id,controlGeneration:Number(c.control_generation),
   operation:createTransferManifest,targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{preparationRef:parentRef}});
  const requestHash=preparationHash(command),digest=preparationHash({projectId:pid,actorId:c.actor_id,clientId:c.client_id,
   controlGeneration:command.controlGeneration,requestHash,policyRef:c.policy_ref,targetRef:exact});
  const [receipt]=row.receipt_rows,[audit]=row.audit_rows;
  if(!receipt||!audit||c.request_hash!==requestHash||!uuidV1(receipt.id)||receipt.id!==c.authorization_receipt_id||receipt.command_id!==c.id
   ||receipt.scope_kind!=='PROJECT'||receipt.scope_id!==pid||!same(receipt.subject_ref,{kind:'HUMAN',userId:c.actor_id,clientId:c.client_id})
   ||!same(receipt.policy_ref,c.policy_ref)||receipt.scope_digest!==digest||receipt.approval_decision_ref!==null
   ||audit.project_id!==pid||audit.command_id!==c.id||audit.operation_id!==c.operation_id||!uuidV1(audit.event_id)
   ||!same(audit.actor_ref,{kind:'HUMAN',userId:c.actor_id})||audit.client_ref!==c.client_id||!same(audit.target_ref,exact)
   ||!same(audit.policy_ref,c.policy_ref)||audit.approval_ref!==null||audit.scope_digest!==digest||audit.outcome!=='APPLIED'
   ||audit.reason_code!==reason||audit.source_kind!=='HUMAN_COMMAND'||!Number.isSafeInteger(Number(audit.server_sequence))||Number(audit.server_sequence)<1
   ||[c.received_at,c.completed_at,receipt.authorized_at,audit.recorded_at].some(v=>clockText(v)!==createdAt))return integrity();
  const result={operationId:c.operation_id,commandId:c.command_id,projectId:pid,status:'APPLIED',targetId:exact.id,version:1,
   data:{ref:exact,manifest:snapshot,manifestStored:true},evidenceRefs:[],warnings:[],serverReceivedAt:createdAt};
  if(!same(result,c.result_ref))return integrity();
  return {result,snapshot,command};
 }

 async command(token:string,csrf:string,raw:unknown){
  const command=commandInput(raw),pid=command.projectId,preparationRef=command.payload.preparationRef as RuntimeRefV1;
  return settle(()=>this.#access.authenticated(token,csrf,async(db,actor)=>{
   const allowed=await this.#current(db,actor,pid,command);
   const previous=await projectReplay(db,actor,command);
   if(previous!==undefined){
    const exact=previous?.data?.ref;if(!ref(exact))return integrity();
    const stored=await this.#stored(db,actor,pid,exact);
    if(!same(stored.command,command)||!same(stored.result,previous))return integrity();
    await this.#current(db,actor,pid,command);
    return stored.result;
   }
   const parent=await this.#parent(db,actor,pid,preparationRef);
   const prior=(await db.query('SELECT id FROM anvil.transfer_manifests WHERE project_id=$1 AND preparation_id=$2 AND preparation_version=1',
    [pid,preparationRef.id])).rows;
   if(prior.length)return reject('VERSION_CONFLICT',409);
   const at=clockText((await db.query('SELECT transaction_timestamp() AS at')).rows[0]?.at);
   const current=await this.#current(db,actor,pid,command);
   if(!same(allowed.policyRef,current.policyRef))return reject('CONCURRENT_CHANGE',409);
   if(parent.record.intentExpiresAt<=current.now)return reject('INTENT_EXPIRED',410);
   if(at<parent.record.observedAt||at>current.now)return integrity();
   const snapshot=snapshotOf(parent,randomUUID(),at),exact={id:snapshot.id,version:1,contentHash:preparationHash(snapshot)};
   const receipt=await persistProjectReceipt(db,actor,command,exact,{manifest:snapshot,manifestStored:true},current.policyRef,reason);
   await db.query(`INSERT INTO anvil.transfer_manifests(id,project_id,creator_user_id,creator_client_id,version,preparation_id,preparation_version,
    preparation_hash,command_id,snapshot_json,content_hash,created_at) VALUES($1,$2,$3,$4,1,$5,1,$6,$7,$8,$9,$10)`,
   [exact.id,pid,actor.actorId,actor.clientId,preparationRef.id,preparationRef.contentHash,receipt.id,JSON.stringify(snapshot),exact.contentHash,at]);
   const stored=await this.#stored(db,actor,pid,exact);
   if(!same(stored.result,receipt.result)||!same(stored.command,command))return integrity();
   const end=await this.#current(db,actor,pid,command);
   if(!same(current.policyRef,end.policyRef))return reject('CONCURRENT_CHANGE',409);
   if(parent.record.intentExpiresAt<=end.now)return reject('INTENT_EXPIRED',410);
   return stored.result;
  }));
 }

 async read(token:string,pid:string,id:string,version:string,contentHash:unknown){
  if(!uuidV1(pid)||!uuidV1(id)||version!=='1'||!hashV1(contentHash))return reject('INPUT_INVALID',400);
  const exact={id,version:1,contentHash};
  return settle(()=>this.#access.authenticated(token,null,async(db,actor)=>{
   await this.#current(db,actor,pid);
   const stored=await this.#stored(db,actor,pid,exact);
   const current=await this.#current(db,actor,pid);
   return {projectId:pid,ref:exact,manifest:{...stored.snapshot,contentHash},observedAt:current.now,
    currentStatus:{intentExpired:stored.snapshot.intentExpiresAt<=current.now,usableForTransfer:false,sourceCurrentness:'NOT_REVALIDATED'}};
  }));
 }
}
