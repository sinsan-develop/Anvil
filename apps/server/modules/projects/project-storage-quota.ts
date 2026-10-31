import type {PoolClient} from 'pg';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {authorizeMaterial,currentProjectController,projectReplay,type ProjectCommand} from '../access/project-command.ts';
import type {ProjectDocuments} from '../documents/project-documents.ts';
import type {ArtifactStore} from '../../storage/artifact-store.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,hashV1,isoV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
export const PROJECT_STORAGE_CAP=10737418240n;
function fail(code='PROJECT_STORAGE_QUOTA_INPUT_INVALID',status=422):never{throw new AuthFailure(code,status);}
const unknown=():never=>fail('PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN',503);
const hash=(v:unknown)=>contentHash(canonicalJson(v));
function freeze<T>(v:T):T{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
export function quotaBytes(v:unknown):bigint{
 if(typeof v==='bigint'){if(v<0n||v>9223372036854775807n)fail();return v;}
 if(typeof v==='number'){if(!Number.isSafeInteger(v)||v<0)fail();return BigInt(v);}
 if(typeof v!=='string'||!/^(0|[1-9][0-9]{0,18})$/.test(v))return fail();const n=BigInt(v);if(n>9223372036854775807n)fail();return n;
}
export interface QuotaPart{readonly key:string;readonly kind:'ARTIFACT'|'CHECKPOINT';readonly id:string;readonly bytes:string;readonly contentHash:string;readonly reservedBytes:string;readonly settledBytes:string}
export interface PreparedQuotaCommand{readonly request:Readonly<ProjectCommand>;readonly actorId:string;readonly parts:readonly QuotaPart[];readonly commandHash:string;readonly planHash:string;readonly policyRef:RuntimeRefV1;readonly authorizedUntil:string;readonly replay:boolean}
export interface QuotaReservationBundle{readonly request:Readonly<ProjectCommand>;readonly ids:readonly string[];readonly planHash:string}
export interface StartedQuotaBundle extends QuotaReservationBundle{readonly fences:readonly string[]}
export interface QuotaReceiptFacts{readonly serverCommandId:string;readonly authorizationReceiptId:string;readonly scopeDigest:string}
interface PreparedState{p:PreparedQuotaCommand;deadline:number}
interface BundleState extends PreparedState{rows:Record<string,any>[]}
function parts(raw:readonly QuotaPart[],operation:string):readonly QuotaPart[]{
 const value=cloneV1(raw);if(!Array.isArray(value)||value.length!==1)fail();const seen=new Set<string>();
 for(const p of value){if(!p||Object.keys(p).sort().join(',')!==['key','kind','id','bytes','contentHash','reservedBytes','settledBytes'].sort().join(',')||typeof p.key!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(p.key)||seen.has(p.key)||!uuidV1(p.id)||!hashV1(p.contentHash)||typeof p.bytes!=='string'||typeof p.reservedBytes!=='string'||typeof p.settledBytes!=='string')fail();seen.add(p.key);
 const b=quotaBytes(p.bytes),r=quotaBytes(p.reservedBytes),s=quotaBytes(p.settledBytes);
 if(p.kind==='ARTIFACT'){if(!['uploadArtifact','proposeDocumentChange'].includes(operation)||b>20971520n||r!==b*2n||s!==b)fail();}
 else if(p.kind==='CHECKPOINT'){if(operation!=='saveCheckpoint'||b>2097152n||r!==b||s!==b)fail();}else fail();
 }return freeze(value);
}
/** 내부 bundle은 호출 제한 데이터다. 매 단계 실제 인증·현재 정책·원장 검산을 대체하지 않는다. */
export class ProjectStorageQuota{
 readonly #access:AccessRepository;readonly #documents?:ProjectDocuments;readonly #store?:ArtifactStore;
 readonly #prepared=new WeakMap<object,PreparedState>();readonly #reserved=new WeakMap<object,BundleState>();readonly #started=new WeakMap<object,BundleState>();
 constructor(access:AccessRepository,store?:ArtifactStore,documents?:ProjectDocuments){this.#access=access;this.#store=store;this.#documents=documents;}
 async #current(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,state?:PreparedState){
  if(!['uploadArtifact','proposeDocumentChange','saveCheckpoint'].includes(request.operation)||!uuidV1(request.projectId)||!uuidV1(request.commandId)||request.clientId!==actor.clientId)fail();
  if(state&&(state.p.actorId!==actor.actorId||state.p.request.clientId!==actor.clientId||hash(request)!==state.p.commandHash))fail('IDEMPOTENCY_CONFLICT',409);
  await currentProjectController(db,actor,request);const policy=await authorizeMaterial(db,actor,request,false,this.#documents);
  const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at,s=actor.authSession;
  if(!(at instanceof Date)||!Number.isFinite(at.getTime())||!s||!uuidV1(s.id)||!isoV1(s.idleExpiresAt)||!isoV1(s.absoluteExpiresAt)||!Number.isFinite(policy.validUntil))fail('PROJECT_STORAGE_CURRENT_REQUIRED',412);
  const deadline=Math.min(policy.validUntil,Date.parse(s.idleExpiresAt),Date.parse(s.absoluteExpiresAt),state?.deadline??Infinity);
  if(deadline<=at.getTime())fail('PROJECT_STORAGE_CURRENT_REQUIRED',412);
  if(state&&hash(policy.ref)!==hash(state.p.policyRef))fail('IDEMPOTENCY_CONFLICT',409);
  return {policyRef:policy.ref,deadline,sessionId:s.id};
 }
 async prepare(token:string,csrf:string,raw:ProjectCommand,derivePlan:(db:PoolClient,actor:AuthenticatedIdentity,request:Readonly<ProjectCommand>)=>Promise<readonly QuotaPart[]>):Promise<PreparedQuotaCommand>{
  const request=freeze(cloneV1(raw));
  const result=await this.#access.authenticated(token,csrf,async(db,actor)=>{
   const current=await this.#current(db,actor,request),replay=await projectReplay(db,actor,request);
   const derived=replay===undefined?parts(await derivePlan(db,actor,request),request.operation):freeze([] as QuotaPart[]);
   if(replay===undefined&&request.operation==='uploadArtifact'){
    const x=derived[0]!,p=request.payload;
    if(!Number.isSafeInteger(p.bytes)||Number(p.bytes)<0||Number(p.bytes)>20971520||x.bytes!==String(p.bytes)||x.contentHash!==p.contentHash)fail();
   }
   const final=await this.#current(db,actor,request),deadline=Math.min(current.deadline,final.deadline);
   if(hash(current.policyRef)!==hash(final.policyRef))fail('IDEMPOTENCY_CONFLICT',409);
   const plan={request,actorId:actor.actorId,parts:derived,commandHash:hash(request),policyRef:current.policyRef,authorizedUntil:new Date(deadline).toISOString(),replay:replay!==undefined};
   return {p:freeze({...plan,planHash:hash(plan)}),deadline};
  });this.#prepared.set(result.p,result);return result.p;
 }
 async reserve(token:string,csrf:string,prepared:PreparedQuotaCommand):Promise<QuotaReservationBundle>{
  const state=this.#prepared.get(prepared);if(!state||prepared.replay)fail();
  let changed=false;const rows=await this.#durable(()=>this.#access.authenticated(token,csrf,async(db,actor)=>{
   const c=await this.#current(db,actor,prepared.request,state);
   const account=(await db.query('SELECT * FROM anvil.quota_account($1,$2,$3,$4)',[c.sessionId,actor.actorId,actor.clientId,prepared.request.projectId])).rows[0];
   if(!account||account.coverage_state!=='VERIFIED')fail('PROJECT_STORAGE_QUOTA_UNVERIFIED',412);
   const u=quotaBytes(account.used_bytes),r=quotaBytes(account.held_bytes);if(u+r>PROJECT_STORAGE_CAP)unknown();
   const value=(await db.query('SELECT anvil.quota_reserve($1,$2,$3,$4,$5::jsonb) AS value',[c.sessionId,actor.actorId,actor.clientId,prepared.request.projectId,JSON.stringify(prepared)])).rows[0]?.value;
   changed=true;await this.#current(db,actor,prepared.request,state);return this.#rows(value,prepared,'RESERVED');
  }),()=>changed);return this.#bundle({...state,rows},false);
 }
 async #durable<T>(body:()=>Promise<T>,changed:()=>boolean=()=>false):Promise<T>{try{return await body();}catch(e){if(changed())return unknown();if(e instanceof AuthFailure)throw e;const error=e as {message?:string;code?:string};if(error.code==='P0001'){if(error.message==='PROJECT_STORAGE_LIMIT_EXCEEDED')return fail(error.message,429);if(error.message==='PROJECT_STORAGE_QUOTA_UNVERIFIED')return fail(error.message,412);if(error.message==='IDEMPOTENCY_CONFLICT')return fail(error.message,409);}return unknown();}}
 #bundle(state:BundleState,started:boolean):QuotaReservationBundle|StartedQuotaBundle{
  const value=freeze({request:state.p.request,ids:state.rows.map(r=>r.id as string),planHash:state.p.planHash,...(started?{fences:state.rows.map(r=>r.start_fence as string)}:{})});
  (started?this.#started:this.#reserved).set(value,state);return value;
 }
 #rows(raw:unknown,p:PreparedQuotaCommand,phase:'RESERVED'|'IO_STARTED'){
  if(!Array.isArray(raw)||raw.length!==p.parts.length)return unknown();const rows=cloneV1(raw) as Record<string,any>[];
  for(const r of rows){const x=p.parts.find(x=>x.key===r.part_key);if(!x||!uuidV1(r.id)||r.project_id!==p.request.projectId||r.actor_id!==p.actorId||r.client_id!==p.request.clientId||r.external_command_id!==p.request.commandId||r.command_hash!==p.commandHash||r.plan_hash!==p.planHash||r.operation!==p.request.operation||r.part_kind!==x.kind||r.reserved_bytes!==x.reservedBytes||r.phase!==phase||typeof r.generation!=='string'||quotaBytes(r.generation)<1n||quotaBytes(r.generation)>BigInt(Number.MAX_SAFE_INTEGER)||typeof r.start_fence!=='string'||quotaBytes(r.start_fence)!==(phase==='RESERVED'?0n:1n))return unknown();}
  if(new Set(rows.map(r=>r.id)).size!==rows.length||new Set(rows.map(r=>r.part_key)).size!==rows.length)return unknown();return rows;
 }
 async start(token:string,csrf:string,bundle:QuotaReservationBundle):Promise<StartedQuotaBundle>{
  const state=this.#reserved.get(bundle);if(!state)fail();
  let changed=false;const rows=await this.#durable(()=>this.#access.authenticated(token,csrf,async(db,actor)=>{
   const c=await this.#current(db,actor,state.p.request,state),payload={ids:bundle.ids,request:state.p.request,planHash:state.p.planHash};
   const value=(await db.query('SELECT anvil.quota_start($1,$2,$3,$4,$5::jsonb) AS value',[c.sessionId,actor.actorId,actor.clientId,state.p.request.projectId,JSON.stringify(payload)])).rows[0]?.value;
   changed=true;await this.#current(db,actor,state.p.request,state);return this.#rows(value,state.p,'IO_STARTED');
  }),()=>changed);return this.#bundle({...state,rows},true) as StartedQuotaBundle;
 }
 async requireStarted(db:PoolClient,actor:AuthenticatedIdentity,raw:ProjectCommand,bundle:StartedQuotaBundle,actualParts:readonly QuotaPart[]):Promise<void>{
  const request=cloneV1(raw),state=this.#started.get(bundle);if(!state)fail();if(hash(parts(actualParts,request.operation))!==hash(state.p.parts))fail('IDEMPOTENCY_CONFLICT',409);
  const c=await this.#current(db,actor,request,state);
  const value=(await db.query('SELECT anvil.quota_require_started($1,$2,$3,$4,$5::jsonb) AS value',[c.sessionId,actor.actorId,actor.clientId,request.projectId,JSON.stringify({ids:bundle.ids,fences:bundle.fences,request,planHash:state.p.planHash})])).rows[0]?.value;if(value!==true)unknown();
 }
 async settle(db:PoolClient,actor:AuthenticatedIdentity,raw:ProjectCommand,bundle:StartedQuotaBundle,rawFacts:QuotaReceiptFacts):Promise<void>{
  // START 뒤에는 FS 도달 가능성이 있으므로 명확한 신규 거절로 낮추지 않는다.
  try{await this.#settle(db,actor,raw,bundle,rawFacts);}catch{return unknown();}
 }
 async #settle(db:PoolClient,actor:AuthenticatedIdentity,raw:ProjectCommand,bundle:StartedQuotaBundle,rawFacts:QuotaReceiptFacts):Promise<void>{
  const request=cloneV1(raw),facts=cloneV1(rawFacts),state=this.#started.get(bundle);if(!state||!uuidV1(facts.serverCommandId)||!uuidV1(facts.authorizationReceiptId)||!hashV1(facts.scopeDigest))fail();
  await this.requireStarted(db,actor,request,bundle,state.p.parts);const c=await this.#current(db,actor,request,state);
  if(request.operation==='saveCheckpoint'){
   const x=state.p.parts[0]!;
   const row=(await db.query('SELECT id,content_hash,snapshot_json,record_text FROM anvil.checkpoint_records WHERE project_id=$1 AND command_id=$2',[request.projectId,facts.serverCommandId])).rows[0];
   // 시각 없는 preparedHash를 원계획에 결박하고 최종 snapshot H와 C는 별도 검산한다.
   // 기존 checkpoint_complete의 전체 도메인/receipt/chain 검산은 SQL에서 별도로 유지한다.
   let valid=false;
   try{valid=!!row&&row.id===x.id&&row.snapshot_json?.preparedHash===x.contentHash&&hashV1(row.content_hash)&&hash(row.snapshot_json)===row.content_hash&&typeof row.record_text==='string'&&BigInt(Buffer.byteLength(canonicalJson(row.snapshot_json))+Buffer.byteLength(row.record_text))===quotaBytes(x.bytes);}catch{valid=false;}
   if(!valid)fail('PROJECT_STORAGE_QUOTA_INTEGRITY_FAILED',503);
  }
  const v=(await db.query('SELECT anvil.quota_settle($1,$2,$3,$4,$5::jsonb) AS value',[c.sessionId,actor.actorId,actor.clientId,request.projectId,JSON.stringify({ids:bundle.ids,fences:bundle.fences,request,planHash:state.p.planHash,facts})])).rows[0]?.value;if(v!==true)unknown();await this.#current(db,actor,request,state);
 }
}