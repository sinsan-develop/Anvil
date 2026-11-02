import {types} from 'node:util';
import {sourceEventQuotaPart} from '../documents/document-source-observation.ts';
import type {CreationPlan} from './draft-artifacts.ts';
import type {PoolClient} from 'pg';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {authorizeMaterial,currentProjectController,projectReplay,type ProjectCommand} from '../access/project-command.ts';
import type {ProjectDocuments} from '../documents/project-documents.ts';
import type {ArtifactStore,ProjectNamespaceProof} from '../../storage/artifact-store.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,recordV1,arrayV1,hashV1,isoV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
export const PROJECT_STORAGE_CAP=10737418240n;
function fail(code='PROJECT_STORAGE_QUOTA_INPUT_INVALID',status=422):never{throw new AuthFailure(code,status);}
function unknown():never{return fail('PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN',503);}
const hash=(v:unknown)=>contentHash(canonicalJson(v));
function freeze<T>(v:T):T{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
export function quotaBytes(v:unknown):bigint{
 if(typeof v==='bigint'){if(v<0n||v>9223372036854775807n)fail();return v;}
 if(typeof v==='number'){if(!Number.isSafeInteger(v)||v<0)fail();return BigInt(v);}
 if(typeof v!=='string'||!/^(0|[1-9][0-9]{0,18})$/.test(v))return fail();const n=BigInt(v);if(n>9223372036854775807n)fail();return n;
}
export interface QuotaPart{readonly key:string;readonly kind:'ARTIFACT'|'CHECKPOINT'|'SOURCE_LINK_EVENT';readonly id:string;readonly bytes:string;readonly contentHash:string;readonly reservedBytes:string;readonly settledBytes:string}
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
 else if(p.kind==='SOURCE_LINK_EVENT'){sourcePart(operation,p);}
 else if(p.kind==='CHECKPOINT'){if(operation!=='saveCheckpoint'||b>2097152n||r!==b||s!==b)fail();}else fail();
 }return freeze(value);
}
const SOURCE_RECORD_LIMIT=65536n,SOURCE_FUTURE_RECORDS=10n;
const SOURCE_METADATA_RESERVATION=SOURCE_RECORD_LIMIT*SOURCE_FUTURE_RECORDS;
function sourcePart(operation:string,part:QuotaPart){
 const b=quotaBytes(part.bytes),r=quotaBytes(part.reservedBytes),settled=quotaBytes(part.settledBytes),diff=r-b,metadata=2n*b-r;
 if(part.kind!=='SOURCE_LINK_EVENT'||!uuidV1(part.id)||!hashV1(part.contentHash)||!['linkDocumentSource','proposeDocumentSourceChange'].includes(operation)||part.key!==(operation==='linkDocumentSource'?'source_link':'source_choice')||diff<0n||diff>20971520n||operation==='linkDocumentSource'&&diff!==0n||metadata<SOURCE_METADATA_RESERVATION||r>10737418240n||settled!==0n)fail();
 return{diff,reserved:r,metadata};
}
/** 각 record를 독립 snapshot으로 읽는다. Proxy/getter를 실행하거나 합계 한도로 대신하지 않는다. */
function sourceRecord(value:unknown,limit=SOURCE_RECORD_LIMIT):unknown{
 const copy=(v:unknown,depth:number):unknown=>{
  if(depth>64)fail();if(v===null||typeof v==='boolean'||typeof v==='number')return v;
  if(typeof v==='string'){if(!v.isWellFormed()||BigInt(Buffer.byteLength(v))>limit)fail();return v;}
  if(!v||typeof v!=='object'||types.isProxy(v)||Object.getOwnPropertySymbols(v).length)fail();
  const d=Object.getOwnPropertyDescriptors(v);
  if(Array.isArray(v)){
   const length=d.length?.value;if(!Number.isSafeInteger(length)||length<0||length>65536||Object.keys(d).length!==length+1)fail();
   return Array.from({length},(_,i)=>{const p=d[String(i)];if(!p||!p.enumerable||!('value'in p))fail();return copy(p.value,depth+1);});
  }
  if(![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail();
  return Object.fromEntries(Object.entries(d).map(([k,p])=>{if(!p.enumerable||!('value'in p))fail();return[k,copy(p.value,depth+1)];}));
 };
 const result=copy(value,0);if(result===null||typeof result!=='object'||Array.isArray(result)||BigInt(Buffer.byteLength(canonicalJson(result)))>limit)fail();return result;
}
interface SourceDiffRef{readonly artifactId:string;readonly bytes:number;readonly contentHash:string;readonly mediaType:string}
function sourceProjection(projection:unknown):Record<string,unknown>{
 if(!projection||typeof projection!=='object'||types.isProxy(projection)||!recordV1(projection,['link','record','candidate','proposal']))fail();
 const d=Object.getOwnPropertyDescriptors(projection);
 return Object.fromEntries(['link','record','candidate','proposal'].map(key=>{const row=d[key]!.value;return[key,row===null?null:sourceRecord(row,key==='record'?SOURCE_RECORD_LIMIT:10737418240n)];}));
}
function sourcePlannedDiff(projection:Record<string,unknown>):SourceDiffRef{
 const material=projection.proposal;
 if(!recordV1(material,['proposal','content','reason'])||!recordV1(material.proposal,['id','baseRef','proposedContentRef','diffRef','status']))fail();
 const ref=material.proposal.diffRef;
 if(!recordV1(ref,['artifactId','bytes','contentHash','mediaType'])||!uuidV1(ref.artifactId)||!Number.isSafeInteger(ref.bytes)||ref.bytes<0||ref.bytes>20971520||!hashV1(ref.contentHash)||ref.mediaType!=='application/json;charset=utf-8')fail();
 return Object.freeze({artifactId:ref.artifactId,bytes:ref.bytes,contentHash:ref.contentHash,mediaType:ref.mediaType});
}
/** 실제 SOURCE_LINK_EVENT consumer의 계산. actualRows 부재는 예약검사이며 정산 증거가 아니다. */
export function sourceEventQuotaAccounting(operation:string,part:QuotaPart,projection:unknown,diffBytes:number,actualRows?:readonly unknown[]){
 const budget=sourcePart(operation,part);
 if(!Number.isSafeInteger(diffBytes)||diffBytes<0||BigInt(diffBytes)!==budget.diff)fail();
 // exact4 계획과 신규 SourceEvent64KiB·가변 M 예약을 게시/정산에서 함께 검산한다.
 const snapshot=sourceProjection(projection);
 const expected=sourceEventQuotaPart(operation as 'linkDocumentSource'|'proposeDocumentSourceChange',part.id,snapshot,diffBytes);
 if(canonicalJson(expected)!==canonicalJson(part))fail();
 if(actualRows===undefined)return{recordCount:null,metadataBytes:null,diffBytes:String(diffBytes),actualBytes:null,reservedBytes:part.reservedBytes};
 if(types.isProxy(actualRows)||Object.getPrototypeOf(actualRows)!==Array.prototype||!arrayV1(actualRows,Number(SOURCE_FUTURE_RECORDS))||!actualRows.length)fail();
 // kind는 공개 입력이 아니다. 실제 SQL collector의 고정 table 분기에서만 생산한다.
 const required:Record<string,string[]>={SOURCE_EVENT:['snapshot_json'],COMMAND:['result_ref'],AUTHORIZATION_RECEIPT:['subject_ref','scope_digest'],AUDIT:['actor_ref','target_ref'],IMPORT:['candidate_json'],PROPOSAL:['proposal_json','content_json','reason'],RESERVATION:['plan_json','phase'],LINK_HEAD:['current_event_id','link_version'],LINK_EVENT:['snapshot_json','link_version'],STREAM_HEAD:['stream_id','head_version'],APPROVAL_CONSUMPTION:['decision_id','command_id'],ARTIFACT:['content_hash','bytes','storage_key']};
 const snapshots=actualRows.map(value=>{if(!value||typeof value!=='object'||types.isProxy(value)||!recordV1(value,['kind','row']))fail();const d=Object.getOwnPropertyDescriptors(value),kind=d.kind!.value,row=d.row!.value;
  if(typeof kind!=='string'||!Object.hasOwn(required,kind))fail();const copied=sourceRecord(row,kind==='SOURCE_EVENT'?SOURCE_RECORD_LIMIT:budget.metadata);
  if(!copied||typeof copied!=='object'||!required[kind]!.every(k=>Object.hasOwn(copied,k))||kind!=='SOURCE_EVENT'&&kind!=='LINK_EVENT'&&Object.hasOwn(copied,'snapshot_json'))fail();return copied;
 }),metadata=snapshots.reduce<bigint>((n,row)=>n+BigInt(Buffer.byteLength(canonicalJson(row))),0n),actual=metadata+budget.diff;
 if(metadata>budget.metadata||actual>budget.reserved)fail();
 return{recordCount:snapshots.length,metadataBytes:String(metadata),diffBytes:String(diffBytes),actualBytes:String(actual),reservedBytes:part.reservedBytes};
}
/** 내부 bundle은 호출 제한 데이터다. 매 단계 실제 인증·현재 정책·원장 검산을 대체하지 않는다. */
export class ProjectStorageQuota{
 readonly #access:AccessRepository;readonly #documents?:ProjectDocuments;readonly #store?:ArtifactStore;
 readonly #published=new WeakSet<object>();
 readonly #sourceWrites=new WeakMap<object,{phase:'ENTERED'|'PUBLISHED'|'UNKNOWN';ref:SourceDiffRef;projectionHash:string}>();
 readonly #prepared=new WeakMap<object,PreparedState>();readonly #reserved=new WeakMap<object,BundleState>();readonly #started=new WeakMap<object,BundleState>();
 constructor(access:AccessRepository,store?:ArtifactStore,documents?:ProjectDocuments){this.#access=access;this.#store=store;this.#documents=documents;}
 async #current(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,state?:PreparedState){
  if(!['uploadArtifact','proposeDocumentChange','saveCheckpoint','linkDocumentSource','proposeDocumentSourceChange'].includes(request.operation)||!uuidV1(request.projectId)||!uuidV1(request.commandId)||request.clientId!==actor.clientId)fail();
  if(state&&(state.p.actorId!==actor.actorId||state.p.request.clientId!==actor.clientId||hash(request)!==state.p.commandHash))fail('IDEMPOTENCY_CONFLICT',409);
  await currentProjectController(db,actor,request);const policy=await authorizeMaterial(db,actor,request,false,this.#documents);
  const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at,s=actor.authSession;
  if(!(at instanceof Date)||!Number.isFinite(at.getTime())||!s||!uuidV1(s.id)||!isoV1(s.idleExpiresAt)||!isoV1(s.absoluteExpiresAt)||!Number.isFinite(policy.validUntil))fail('PROJECT_STORAGE_CURRENT_REQUIRED',412);
  const deadline=Math.min(policy.validUntil,Date.parse(s.idleExpiresAt),Date.parse(s.absoluteExpiresAt),state?.deadline??Infinity);
  if(deadline<=at.getTime())fail('PROJECT_STORAGE_CURRENT_REQUIRED',412);
  if(state&&hash(policy.ref)!==hash(state.p.policyRef))fail('IDEMPOTENCY_CONFLICT',409);
  return {policyRef:policy.ref,deadline,sessionId:s.id,atMs:at.getTime()};
 }
 async prepare(token:string,csrf:string,raw:ProjectCommand,derivePlan:(db:PoolClient,actor:AuthenticatedIdentity,request:Readonly<ProjectCommand>,existingParts?:readonly QuotaPart[])=>Promise<readonly QuotaPart[]>):Promise<PreparedQuotaCommand>{
  const request=freeze(cloneV1(raw));
  const result=await this.#durable(()=>this.#access.authenticated(token,csrf,async(db,actor)=>{
   const current=await this.#current(db,actor,request),replay=await projectReplay(db,actor,request);
   let existing:PreparedQuotaCommand|undefined;
   const value=(await db.query('SELECT anvil.quota_existing($1,$2,$3,$4,$5::jsonb) AS value',[current.sessionId,actor.actorId,actor.clientId,request.projectId,JSON.stringify(request)])).rows[0]?.value;
   if(replay!==undefined){if(value!==null&&value!==undefined&&canonicalJson(value)!==canonicalJson({replay:true}))unknown();}
   else{
    if(value!==null&&value!==undefined){
     const v=cloneV1(value) as PreparedQuotaCommand;const {planHash,...body}=v;
     if(v.replay!==false||v.actorId!==actor.actorId||v.commandHash!==hash(request)||hash(v.request)!==hash(request)||!isoV1(v.authorizedUntil)||hash(v.policyRef)!==hash(current.policyRef)||hash(body)!==planHash)fail('IDEMPOTENCY_CONFLICT',409);
     parts(v.parts,request.operation);existing=freeze(v);
    }
   }
   const derived=replay===undefined?parts(await derivePlan(db,actor,request,existing?.parts),request.operation):freeze([] as QuotaPart[]);
   if(existing&&hash(derived)!==hash(existing.parts))fail('IDEMPOTENCY_CONFLICT',409);
   if(replay===undefined&&request.operation==='uploadArtifact'){
    const x=derived[0]!,p=request.payload;
    if(!Number.isSafeInteger(p.bytes)||Number(p.bytes)<0||Number(p.bytes)>20971520||x.bytes!==String(p.bytes)||x.contentHash!==p.contentHash)fail();
   }
   const final=await this.#current(db,actor,request),deadline=Math.min(current.deadline,final.deadline,existing?Date.parse(existing.authorizedUntil):Infinity);
   if(hash(current.policyRef)!==hash(final.policyRef))fail('IDEMPOTENCY_CONFLICT',409);
   if(deadline<=final.atMs)fail('PROJECT_STORAGE_CURRENT_REQUIRED',412);
   const plan={request,actorId:actor.actorId,parts:derived,commandHash:hash(request),policyRef:current.policyRef,authorizedUntil:existing?.authorizedUntil??new Date(deadline).toISOString(),replay:replay!==undefined};
   return {p:existing??freeze({...plan,planHash:hash(plan)}),deadline};
  }));this.#prepared.set(result.p,result);return result.p;
 }
 /** 호출자 소유 보호 Tx 안에서 현재 권한과 과거 원정산 대응을 다시 검산한다. */
 async adoptCreation(db:PoolClient,actor:AuthenticatedIdentity,creation:CreationPlan,receipt:{readonly serverCommandId:string},proof:ProjectNamespaceProof):Promise<void>{
  try{
   if(!this.#store||creation.state!=='COPIES_VERIFIED'||!uuidV1(receipt.serverCommandId)||!actor.authSession||!uuidV1(actor.authSession.id))unknown();
   const manifest=this.#store.projectNamespaceFacts(proof,creation.target_project_id,creation.id,creation.refs_json),session=actor.authSession;
   const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;
   if(!(at instanceof Date)||!Number.isFinite(at.getTime())||!isoV1(session.idleExpiresAt)||!isoV1(session.absoluteExpiresAt)||Math.min(Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt))<=at.getTime())unknown();
   const value=(await db.query('SELECT anvil.quota_adopt_creation($1,$2,$3,$4,$5::jsonb) AS value',[session.id,actor.actorId,actor.clientId,creation.target_project_id,JSON.stringify({creationId:creation.id,requestHash:creation.request_hash,serverCommandId:receipt.serverCommandId,manifest,manifestHash:hash(manifest)})])).rows[0]?.value;
   if(value!==true)unknown();
  }catch{return unknown();}
 }
 async protectedReplay(db:PoolClient,actor:AuthenticatedIdentity,raw:ProjectCommand):Promise<any>{
  const request=cloneV1(raw),current=await this.#current(db,actor,request),previous=await projectReplay(db,actor,request);
  if(previous===undefined)unknown();
  const value=(await db.query('SELECT anvil.quota_existing($1,$2,$3,$4,$5::jsonb) AS value',[current.sessionId,actor.actorId,actor.clientId,request.projectId,JSON.stringify(request)])).rows[0]?.value;
  if(value!==null&&value!==undefined&&canonicalJson(value)!==canonicalJson({replay:true}))unknown();
  await this.#current(db,actor,request);return cloneV1(previous);
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
 /** 실제 원문 writer의 결과만 private 게시 확인으로 결박한다. 호출자가 성공 bool을 공급하지 않는다. */
 async publishArtifact(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,bundle:StartedQuotaBundle,rawBytes:Buffer):Promise<string>{
  const bytes=Buffer.from(rawBytes),state=this.#started.get(bundle),part=state?.p.parts[0];
  try{
   if(!state||!part||part.kind!=='ARTIFACT'||!this.#store||String(bytes.length)!==part.bytes||contentHash(bytes)!==part.contentHash)unknown();
   await this.requireStarted(db,actor,request,bundle,[part]);
   const key=await this.#store.put(request.projectId,part.id,bytes);
   if(key!==`blobs/${request.projectId}/${part.id}`)unknown();
   await this.#store.verifyPublished(request.projectId,part.id,{bytes:bytes.length,contentHash:part.contentHash});
   await this.requireStarted(db,actor,request,bundle,[part]);this.#published.add(bundle);return key;
  }catch{return unknown();}
 }
 /** 원 source 부모 계획의 metadata+diff를 하나의 원장 part로 결박한다. 기존 ARTIFACT writer의 경계는 바꾸지 않는다. */
 async publishSourceDiff(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,bundle:StartedQuotaBundle,projection:unknown,ref:{artifactId:string;bytes:number;contentHash:string},rawBytes:Buffer):Promise<string>{
  const bytes=Buffer.from(rawBytes),state=this.#started.get(bundle),part=state?.p.parts[0];
  let entered:{phase:'ENTERED'|'PUBLISHED'|'UNKNOWN';ref:SourceDiffRef;projectionHash:string}|undefined;
  try{
   if(!state||!part||part.kind!=='SOURCE_LINK_EVENT'||request.operation!=='proposeDocumentSourceChange'||!this.#store||this.#sourceWrites.has(bundle))unknown();
   const snapshot=sourceProjection(projection),expected=sourcePlannedDiff(snapshot),provided=sourceRecord(ref);
   sourceEventQuotaAccounting(request.operation,part,snapshot,bytes.length);
   if(!recordV1(provided,['artifactId','bytes','contentHash',...(Object.hasOwn(provided as object,'mediaType')?['mediaType']:[])])||provided.artifactId!==expected.artifactId||provided.bytes!==expected.bytes||provided.contentHash!==expected.contentHash||Object.hasOwn(provided,'mediaType')&&provided.mediaType!==expected.mediaType||part.id!==expected.artifactId||bytes.length!==expected.bytes||contentHash(bytes)!==expected.contentHash)unknown();
   const store=this.#store,put=store.put,verify=store.verifyPublished;
   const stable=()=>{if(this.#store!==store||store.put!==put||store.verifyPublished!==verify||bytes.length!==expected.bytes||contentHash(bytes)!==expected.contentHash)unknown();sourceEventQuotaAccounting(request.operation,part,snapshot,bytes.length);};
   entered={phase:'ENTERED',ref:expected,projectionHash:part.contentHash};this.#sourceWrites.set(bundle,entered);
   await this.requireStarted(db,actor,request,bundle,[part]);stable();
   const key=await put.call(store,request.projectId,expected.artifactId,bytes);stable();
   if(key!==`blobs/${request.projectId}/${expected.artifactId}`)unknown();
   await verify.call(store,request.projectId,expected.artifactId,Object.freeze({bytes:expected.bytes,contentHash:expected.contentHash}));stable();
   await this.requireStarted(db,actor,request,bundle,[part]);stable();entered.phase='PUBLISHED';this.#published.add(bundle);return key;
  }catch{if(entered)entered.phase='UNKNOWN';return unknown();}
 }
 async settleArtifact(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,bundle:StartedQuotaBundle,facts:QuotaReceiptFacts):Promise<void>{
  if(!this.#published.has(bundle))unknown();await this.settle(db,actor,request,bundle,facts);
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
  let sourceAccounting:ReturnType<typeof sourceEventQuotaAccounting>|undefined;
  if(request.operation==='linkDocumentSource'||request.operation==='proposeDocumentSourceChange'){
   const part=state.p.parts[0]!;const budget=sourcePart(request.operation,part);
   if(budget.diff>0n&&!this.#published.has(bundle))unknown();
   // 실제 collector 미등록/누락은 UNKNOWN이다. 호출자 projection이나 성공 bool로 대체하지 않는다.
   const rows=(await db.query('SELECT projection,record_projections,diff_bytes FROM anvil.document_source_quota_projection($1,$2)',[request.projectId,facts.serverCommandId])).rows;
   if(rows.length!==1||!recordV1(rows[0],['projection','record_projections','diff_bytes'])||quotaBytes(rows[0].diff_bytes)!==budget.diff)unknown();
   const row=rows[0],projection=sourceProjection(row.projection);
   if(projection.proposal!==null){const published=this.#sourceWrites.get(bundle),planned=sourcePlannedDiff(projection);if(!published||published.phase!=='PUBLISHED'||published.projectionHash!==part.contentHash||canonicalJson(published.ref)!==canonicalJson(planned)||part.id!==planned.artifactId)unknown();}else if(budget.diff>0n)unknown();
   sourceAccounting=sourceEventQuotaAccounting(request.operation,part,projection,Number(budget.diff),row.record_projections);
   if(sourceAccounting.actualBytes===null)unknown();
  }
  const v=(await db.query('SELECT anvil.quota_settle($1,$2,$3,$4,$5::jsonb) AS value',[c.sessionId,actor.actorId,actor.clientId,request.projectId,JSON.stringify({ids:bundle.ids,fences:bundle.fences,request,planHash:state.p.planHash,facts,...(sourceAccounting?{sourceAccounting}:{})})])).rows[0]?.value;if(v!==true)unknown();await this.#current(db,actor,request,state);
 }
}