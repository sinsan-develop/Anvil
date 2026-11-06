import {isNodeDecisionReceiptIds,type NodeDecisionReceiptIds} from '../access/project-command.ts';
import {types} from 'node:util';
import {sourceEventQuotaPart} from '../documents/document-source-observation.ts';
import type {CreationPlan} from './draft-artifacts.ts';
import type {PoolClient} from 'pg';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {authorizeMaterial,currentGeneralProjectController,projectMember,projectReplay,isRegisteredPreparationReceiptIds,isRegisteredPreparationApprovalReceiptIds,type RegisteredPreparationReceiptIds,type ProjectCommand} from '../access/project-command.ts';
import type {ProjectDocuments} from '../documents/project-documents.ts';
import type {ArtifactStore,ProjectNamespaceProof} from '../../storage/artifact-store.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {compileExecutionPreparationOptions,readExecutionPreparationInput} from '../executions/preparation-input.ts';
import {ProjectConnectionDefinitions} from '../connections/project-connection-definitions.ts';
import {ProjectEnvironments} from '../connections/project-environments.ts';
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
interface RegisteredPreparationQuotaState {db:PoolClient;query:PoolClient['query'];actor:AuthenticatedIdentity;actorId:string;clientId:string;sessionId:string;credentialGeneration:number;request:ProjectCommand;ref:RuntimeRefV1;snapshot:unknown;transactionId:string;reservationId:string;planHash:string;reservedBytes:bigint;receiptIds:RegisteredPreparationReceiptIds;resultHash:string;until:number;phase:'RESERVED'|'SETTLING'|'CLOSED'}
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
 readonly #registeredPreparations=new WeakMap<object,RegisteredPreparationQuotaState>();
 readonly #registeredApprovals=new WeakMap<object,RegisteredPreparationQuotaState&{purpose:'REQUEST'|'DECISION'}>();
 readonly #registeredApprovalSources=new WeakMap<object,{db:PoolClient;query:PoolClient['query'];actor:AuthenticatedIdentity;actorId:string;clientId:string;sessionId:string;credentialGeneration:number;transactionId:string;until:number;inputHash:string;requestRef:RuntimeRefV1|null;phase:'OBSERVED'|'CONSUMED'}>();
 readonly #published=new WeakSet<object>();
 readonly #sourceWrites=new WeakMap<object,{phase:'ENTERED'|'PUBLISHED'|'UNKNOWN';ref:SourceDiffRef;projectionHash:string}>();
 readonly #prepared=new WeakMap<object,PreparedState>();readonly #reserved=new WeakMap<object,BundleState>();readonly #started=new WeakMap<object,BundleState>();
 readonly #nodeDecisions=new WeakMap<object,{db:PoolClient;query:PoolClient['query'];actor:AuthenticatedIdentity;identity:string;request:ProjectCommand;ids:NodeDecisionReceiptIds;tx:string;hash:string;reserved:bigint;until:number;resultHash:string;phase:'RESERVED'|'CLOSED'}>();
 async reserveNodeDecision(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,ref:RuntimeRefV1,snapshot:unknown,basis:unknown,headProjections:unknown,policyRef:RuntimeRefV1,ids:NodeDecisionReceiptIds,result:unknown,until:number):Promise<object>{
  return this.#durable(async()=>{
   if(!isNodeDecisionReceiptIds(ids,db,actor,request)||!['recordNodeDecision','revokeNodeDecision'].includes(request.operation)||hash(snapshot)!==ref.contentHash||!Number.isFinite(until))fail();
   const query=db.query,identity=canonicalJson({id:actor.actorId,client:actor.clientId,generation:actor.credentialGeneration,session:actor.authSession}),tx=await this.#registeredTx(db,query,ids.transactionId,until);
   const pairs={snapshot:canonicalJson(snapshot),basis:canonicalJson(basis),result:canonicalJson(result)};
   const rows=(await Reflect.apply(query,db,['SELECT * FROM anvil.fn10_node_decision_reserve($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14)',[actor.authSession!.id,actor.actorId,actor.clientId,request.projectId,canonicalJson(request),canonicalJson(ref),canonicalJson(snapshot),canonicalJson(basis),canonicalJson(headProjections),canonicalJson(policyRef),canonicalJson(ids),canonicalJson(pairs),tx,new Date(until).toISOString()]])).rows;
   await this.#registeredTx(db,query,tx,until);if(canonicalJson({id:actor.actorId,client:actor.clientId,generation:actor.credentialGeneration,session:actor.authSession})!==identity||!isNodeDecisionReceiptIds(ids,db,actor,request))unknown();
   const r=rows.length===1?rows[0]:null;if(!r||r.reservation_id!==ids.serverCommandId||r.transaction_id!==tx||r.record_hash!==ref.contentHash||!hashV1(r.plan_hash)||!isoV1(r.authorized_until)||Date.parse(r.authorized_until)>until)unknown();
   const reserved=quotaBytes(r.reserved_bytes);if(reserved>PROJECT_STORAGE_CAP)unknown();const end=Math.min(until,Date.parse(r.authorized_until));await this.#registeredTx(db,query,tx,end);const lease=Object.freeze({});this.#nodeDecisions.set(lease,{db,query,actor,identity,request:cloneV1(request),ids,tx,hash:r.plan_hash,reserved,until:end,resultHash:hash(result),phase:'RESERVED'});return lease;
  });
 }
 async settleNodeDecision(db:PoolClient,actor:AuthenticatedIdentity,lease:object,receipt:{id:string;result:unknown;authorizationReceiptRef:RuntimeRefV1}):Promise<void>{
  const s=this.#nodeDecisions.get(lease);if(!s||s.phase!=='RESERVED'||s.db!==db||s.actor!==actor||s.query!==db.query)unknown();s.phase='CLOSED';
  await this.#durable(async()=>{if(s.identity!==canonicalJson({id:actor.actorId,client:actor.clientId,generation:actor.credentialGeneration,session:actor.authSession})||receipt.id!==s.ids.serverCommandId||receipt.authorizationReceiptRef.id!==s.ids.authorizationReceiptId||hash(receipt.result)!==s.resultHash)unknown();await this.#registeredTx(db,s.query,s.tx,s.until);
   const rows=(await Reflect.apply(s.query,db,['SELECT * FROM anvil.fn10_node_decision_settle($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)',[actor.authSession!.id,actor.actorId,actor.clientId,s.request.projectId,s.request.commandId,s.ids.serverCommandId,s.hash,canonicalJson(receipt.result),s.tx]])).rows;
   await this.#registeredTx(db,s.query,s.tx,s.until);if(s.identity!==canonicalJson({id:actor.actorId,client:actor.clientId,generation:actor.credentialGeneration,session:actor.authSession}))unknown();const r=rows.length===1?rows[0]:null;if(!r||r.status!=='SETTLED'||r.reservation_id!==s.ids.serverCommandId||r.transaction_id!==s.tx||quotaBytes(r.settled_bytes)>s.reserved)unknown();
  },()=>true);
 }
 constructor(access:AccessRepository,store?:ArtifactStore,documents?:ProjectDocuments){this.#access=access;this.#store=store;this.#documents=documents;}
 async #registeredTx(db:PoolClient,query:PoolClient['query'],expected?:string,until=Infinity):Promise<string>{
  if(db.query!==query)unknown();
  const rows=(await Reflect.apply(query,db,['SELECT txid_current()::text AS transaction_id,clock_timestamp() AS observed_at'])).rows;
  const transactionId=rows.length===1?rows[0]?.transaction_id:undefined;
  if(db.query!==query||typeof transactionId!=='string'||!/^[1-9][0-9]{0,18}$/.test(transactionId)||expected!==undefined&&transactionId!==expected)unknown();
  const observed=rows[0]?.observed_at;
  if(!(observed instanceof Date)||!Number.isFinite(observed.getTime())||!(until>observed.getTime()))unknown();
  return transactionId;
 }
 /** 원 준비 callback 전용. caller의 reserved 선언이나 공개 prepare/reserve wire를 소비하지 않는다. */
 async reserveRegisteredPreparation(db:PoolClient,actor:AuthenticatedIdentity,rawRequest:ProjectCommand,rawRef:RuntimeRefV1,rawSnapshot:unknown,policyRef:RuntimeRefV1,receiptIds:RegisteredPreparationReceiptIds):Promise<object>{
  return this.#durable(async()=>{
  if(!isRegisteredPreparationReceiptIds(receiptIds))fail();
  const request=cloneV1(rawRequest),ref=cloneV1(rawRef),snapshot=cloneV1(rawSnapshot) as Record<string,any>,input=readExecutionPreparationInput(request.payload),session=actor.authSession;
  if(!('connectionKind' in input)||request.operation!=='prepareExecution'||request.projectId!==input.projectId||request.clientId!==actor.clientId||!uuidV1(session?.id)||!recordV1(ref,['id','version','contentHash'])||!uuidV1(ref.id)||ref.version!==1||!hashV1(ref.contentHash)||hash(snapshot)!==ref.contentHash||!recordV1(snapshot,['intent','basisRefs','latestInstructionRefs','checkedAt','missingConditions','authorizationState','preparedBy','executionAuthorized','dispatchPerformed','options'])||hash(snapshot.intent)!==hash(input)||snapshot.authorizationState!=='NOT_AUTHORIZED'||snapshot.executionAuthorized!==false||snapshot.dispatchPerformed!==false)fail();
  const actorId=actor.actorId,clientId=actor.clientId,sessionId=session.id,credentialGeneration=actor.credentialGeneration;
  const originalParent=Math.min(Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt));
  const checkIdentity=()=>{if(actor.actorId!==actorId||actor.clientId!==clientId||actor.authSession?.id!==sessionId||actor.credentialGeneration!==credentialGeneration)unknown();};
  const query=db.query,transactionId=await this.#registeredTx(db,query,undefined,originalParent);checkIdentity();
  const expectedResult={operationId:receiptIds.operationId,commandId:request.commandId,projectId:request.projectId,status:'APPLIED',targetId:ref.id,version:1,data:{ref,status:'EXECUTION_PREPARED',snapshot},evidenceRefs:[],warnings:[],serverReceivedAt:snapshot.checkedAt};
  const canonicalPairs={preparationSnapshot:canonicalJson(snapshot),resultRef:canonicalJson(expectedResult)};
  const result=await Reflect.apply(query,db,['SELECT * FROM anvil.fn09_registered_prepare_reserve($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11)',[session.id,actor.actorId,actor.clientId,request.projectId,canonicalJson(request),canonicalJson(ref),canonicalJson(snapshot),canonicalJson(policyRef),canonicalJson(receiptIds),canonicalJson(canonicalPairs),transactionId]]);
  const row=result.rows.length===1?result.rows[0]:undefined;
  if(!row||!uuidV1(row.reservation_id)||row.reservation_id!==receiptIds.serverCommandId||row.transaction_id!==transactionId||row.preparation_hash!==ref.contentHash||!hashV1(row.plan_hash)||!isoV1(row.authorized_until))unknown();
  const reservedBytes=quotaBytes(row.reserved_bytes),until=Date.parse(row.authorized_until);
  if(reservedBytes>PROJECT_STORAGE_CAP)unknown();
  const parentUntil=Math.min(until,originalParent);
  await this.#registeredTx(db,query,transactionId,parentUntil);checkIdentity();
  const lease=Object.freeze({});
  this.#registeredPreparations.set(lease,{db,query,actor,actorId,clientId,sessionId,credentialGeneration,request,ref,snapshot,transactionId,reservationId:row.reservation_id,planHash:row.plan_hash,reservedBytes,receiptIds,resultHash:hash(expectedResult),until:parentUntil,phase:'RESERVED'});
  return lease;
  });
 }
 async settleRegisteredPreparation(db:PoolClient,actor:AuthenticatedIdentity,lease:object,rawReceipt:{id:string;result:any;authorizationReceiptRef:RuntimeRefV1}):Promise<void>{
  const state=this.#registeredPreparations.get(lease);
  if(!state||state.phase!=='RESERVED'||state.db!==db||state.actor!==actor||state.actorId!==actor.actorId||state.clientId!==actor.clientId||state.sessionId!==actor.authSession?.id||state.credentialGeneration!==actor.credentialGeneration||db.query!==state.query)unknown();
  state.phase='SETTLING';
  try{
   const receipt=cloneV1(rawReceipt),session=actor.authSession;
   if(!uuidV1(session?.id)||receipt.id!==state.receiptIds.serverCommandId||receipt.authorizationReceiptRef?.id!==state.receiptIds.authorizationReceiptId||hash(receipt.result)!==state.resultHash||receipt.result?.projectId!==state.request.projectId||receipt.result?.commandId!==state.request.commandId||receipt.result?.status!=='APPLIED'||receipt.result?.data?.status!=='EXECUTION_PREPARED'||hash(receipt.result.data.ref)!==hash(state.ref)||hash(receipt.result.data.snapshot)!==hash(state.snapshot))unknown();
   await this.#registeredTx(db,state.query,state.transactionId,state.until);
   if(state.actorId!==actor.actorId||state.clientId!==actor.clientId||state.sessionId!==actor.authSession?.id||state.credentialGeneration!==actor.credentialGeneration)unknown();
   const result=await Reflect.apply(state.query,db,['SELECT * FROM anvil.fn09_registered_prepare_settle($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)',[session.id,actor.actorId,actor.clientId,state.request.projectId,state.request.commandId,state.reservationId,state.planHash,receipt.id,canonicalJson(receipt.result),state.transactionId]]);
   await this.#registeredTx(db,state.query,state.transactionId,state.until);
   if(state.actorId!==actor.actorId||state.clientId!==actor.clientId||state.sessionId!==actor.authSession?.id||state.credentialGeneration!==actor.credentialGeneration)unknown();
   const row=result.rows.length===1?result.rows[0]:undefined;
   if(!row||row.status!=='SETTLED'||row.reservation_id!==state.reservationId||row.transaction_id!==state.transactionId||quotaBytes(row.settled_bytes)>state.reservedBytes)unknown();
  }catch{return unknown();}finally{state.phase='CLOSED';}
 }
 async prepareRegisteredPreparationApprovalSource(db:PoolClient,actor:AuthenticatedIdentity,rawInput:unknown,requestRef:RuntimeRefV1|null=null):Promise<object>{
  return this.#durable(async()=>{
   const input=readExecutionPreparationInput(rawInput),session=actor.authSession,actorId=actor.actorId,clientId=actor.clientId,sessionId=session?.id,credentialGeneration=actor.credentialGeneration,query=db.query;
   if(!('connectionKind'in input)||!uuidV1(sessionId)||requestRef!==null&&(!uuidV1(requestRef.id)||!Number.isSafeInteger(requestRef.version)||requestRef.version<1||!hashV1(requestRef.contentHash)))fail();
   const until=Math.min(Date.parse(session!.idleExpiresAt),Date.parse(session!.absoluteExpiresAt));if(!Number.isFinite(until))fail();
   const identity=()=>{if(db.query!==query||actor.actorId!==actorId||actor.clientId!==clientId||actor.authSession?.id!==sessionId||actor.credentialGeneration!==credentialGeneration)unknown();};
   const transactionId=await this.#registeredTx(db,query,undefined,until);identity();let live=true;
   const check=async()=>{if(!live)unknown();identity();await this.#registeredTx(db,query,transactionId,until);identity();if(!live)unknown();};
   const borrowed={query:async(sql:string,values?:unknown[])=>{await check();const result=await Reflect.apply(query,db,[sql,values]);await check();return result;}} as unknown as PoolClient;
   try{
    const definitions=new ProjectConnectionDefinitions(this.#access),environments=new ProjectEnvironments(this.#access);
    const definition=await ProjectConnectionDefinitions.prototype.read.call(definitions,borrowed,actor,input.projectId,input.connectionRef.id,input.connectionRef.version);await check();
    if(hash(definition.ref)!==hash(input.connectionRef)||definition.currentStatus.configurationCurrent!==true||hash(definition.definition.environmentRef)!==hash(input.environmentRef))fail('SOURCE_VERIFIER_NOT_CONNECTED',412);
    const environment=await ProjectEnvironments.prototype.read.call(environments,borrowed,actor,input.projectId,input.environmentRef.id,input.environmentRef.version);await check();
    if(hash(environment.ref)!==hash(input.environmentRef)||environment.current.configurationCurrentness!=='MATCHED')fail('SOURCE_VERIFIER_NOT_CONNECTED',412);
    compileExecutionPreparationOptions(definition.definition);await check();const proof=Object.freeze({});
    this.#registeredApprovalSources.set(proof,{db,query,actor,actorId,clientId,sessionId:sessionId!,credentialGeneration,transactionId,until,inputHash:hash(input),requestRef:requestRef===null?null:freeze(cloneV1(requestRef)),phase:'OBSERVED'});return proof;
   }finally{live=false;}
  });
 }
 async reserveRegisteredPreparationApprovalRequest(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,ref:RuntimeRefV1,snapshot:unknown,policyRef:RuntimeRefV1,ids:RegisteredPreparationReceiptIds,source:object):Promise<object>{return this.#reserveRegisteredApproval('REQUEST',db,actor,request,ref,snapshot,policyRef,ids,source);}
 async reserveRegisteredPreparationApprovalDecision(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,ref:RuntimeRefV1,snapshot:unknown,policyRef:RuntimeRefV1,ids:RegisteredPreparationReceiptIds,requestExpiresAt:string,source:object):Promise<object>{return this.#reserveRegisteredApproval('DECISION',db,actor,request,ref,snapshot,policyRef,ids,source,requestExpiresAt);}
 async #reserveRegisteredApproval(purpose:'REQUEST'|'DECISION',db:PoolClient,actor:AuthenticatedIdentity,rawRequest:ProjectCommand,rawRef:RuntimeRefV1,rawSnapshot:unknown,policyRef:RuntimeRefV1,receiptIds:RegisteredPreparationReceiptIds,source:object,requestExpiresAt?:string):Promise<object>{
  return this.#durable(async()=>{
   if(!isRegisteredPreparationApprovalReceiptIds(receiptIds,purpose))fail();
   const observed=this.#registeredApprovalSources.get(source);if(!observed||observed.phase!=='OBSERVED'||observed.db!==db||observed.actor!==actor||observed.query!==db.query||observed.actorId!==actor.actorId||observed.clientId!==actor.clientId||observed.sessionId!==actor.authSession?.id||observed.credentialGeneration!==actor.credentialGeneration)unknown();
   const request=cloneV1(rawRequest),ref=cloneV1(rawRef),snapshot=cloneV1(rawSnapshot) as Record<string,any>,session=actor.authSession;
   const isRequest=purpose==='REQUEST',keys=isRequest?['id','version','status','projectId','details','scopeDigest','requiredDecider','policyRef','requestedBy','controlGeneration','createdAt']:['id','requestId','requestVersion','requestRef','scopeDigest','decision','reason','decidedBy','controlGeneration','policyRef','decidedAt'];
   if(request.operation!==(isRequest?'requestApproval':'decideApproval')||request.clientId!==actor.clientId||!uuidV1(session?.id)||!recordV1(ref,['id','version','contentHash'])||!uuidV1(ref.id)||ref.version!==1||!hashV1(ref.contentHash)||!recordV1(snapshot,keys)||snapshot.id!==ref.id||hash(snapshot.policyRef)!==hash(policyRef))fail();
   const body=Object.fromEntries(Object.entries(snapshot).filter(([key])=>!(isRequest?['id','version','status','createdAt']:['id','decidedAt']).includes(key)));
   if(hash(body)!==ref.contentHash)fail();
   if(isRequest){
    const input=readExecutionPreparationInput(request.payload.candidatePayload);
    if(!('connectionKind'in input)||snapshot.projectId!==request.projectId||snapshot.version!==1||snapshot.status!=='PENDING'||snapshot.requestedBy?.userId!==actor.actorId||snapshot.requestedBy?.clientId!==actor.clientId||hash(snapshot.details)!==hash(request.payload.details)||snapshot.scopeDigest!==hash(snapshot.details.actionScope))fail();
   }else if(snapshot.decidedBy?.userId!==actor.actorId||snapshot.decidedBy?.clientId!==actor.clientId||snapshot.requestId!==request.targetId||snapshot.requestVersion!==1||snapshot.requestVersion!==request.expectedVersion||!isoV1(requestExpiresAt))fail();
   if(isRequest?(observed.requestRef!==null||observed.inputHash!==hash(request.payload.candidatePayload)):(observed.requestRef===null||hash(observed.requestRef)!==hash(snapshot.requestRef)))unknown();
   const sourceEnd=Date.parse(isRequest?snapshot.details.expiresAt:requestExpiresAt!),originalParent=Math.min(observed.until,sourceEnd,Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt));
   if(!Number.isFinite(originalParent))fail();
   const actorId=actor.actorId,clientId=actor.clientId,sessionId=session.id,credentialGeneration=actor.credentialGeneration,query=db.query;
   const identity=()=>{if(actor.actorId!==actorId||actor.clientId!==clientId||actor.authSession?.id!==sessionId||actor.credentialGeneration!==credentialGeneration)unknown();};
   observed.phase='CONSUMED';const transactionId=await this.#registeredTx(db,query,observed.transactionId,originalParent);identity();
   const expectedResult={operationId:receiptIds.operationId,commandId:request.commandId,projectId:request.projectId,status:'APPLIED',targetId:ref.id,version:1,data:{ref,status:isRequest?'APPROVAL_REQUESTED':'APPROVAL_DECIDED',[isRequest?'request':'decision']:snapshot},evidenceRefs:[],warnings:[],serverReceivedAt:isRequest?snapshot.createdAt:snapshot.decidedAt};
   const sql=isRequest?'SELECT * FROM anvil.fn09_registered_approval_request_reserve($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10)':'SELECT * FROM anvil.fn09_registered_approval_decision_reserve($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10)';
   const rows=(await Reflect.apply(query,db,[sql,[sessionId,actorId,clientId,request.projectId,canonicalJson(request),canonicalJson(ref),canonicalJson(snapshot),canonicalJson(policyRef),canonicalJson(receiptIds),transactionId]])).rows,row=rows.length===1?rows[0]:undefined;
   if(!row||row.reservation_id!==receiptIds.serverCommandId||row.transaction_id!==transactionId||row.record_hash!==ref.contentHash||!hashV1(row.plan_hash)||!isoV1(row.authorized_until))unknown();
   const reservedBytes=quotaBytes(row.reserved_bytes),until=Math.min(originalParent,Date.parse(row.authorized_until));if(reservedBytes>PROJECT_STORAGE_CAP)unknown();
   await this.#registeredTx(db,query,transactionId,until);identity();const lease=Object.freeze({});
   this.#registeredApprovals.set(lease,{purpose,db,query,actor,actorId,clientId,sessionId,credentialGeneration,request,ref,snapshot,transactionId,reservationId:row.reservation_id,planHash:row.plan_hash,reservedBytes,receiptIds,resultHash:hash(expectedResult),until,phase:'RESERVED'});return lease;
  });
 }
 async settleRegisteredPreparationApproval(db:PoolClient,actor:AuthenticatedIdentity,lease:object,rawReceipt:{id:string;result:any;authorizationReceiptRef:RuntimeRefV1}):Promise<void>{
  const state=this.#registeredApprovals.get(lease);
  if(!state||state.phase!=='RESERVED'||state.db!==db||state.query!==db.query||state.actor!==actor||state.actorId!==actor.actorId||state.clientId!==actor.clientId||state.sessionId!==actor.authSession?.id||state.credentialGeneration!==actor.credentialGeneration)unknown();state.phase='SETTLING';
  try{
   const receipt=cloneV1(rawReceipt),check=()=>{if(state.actorId!==actor.actorId||state.clientId!==actor.clientId||state.sessionId!==actor.authSession?.id||state.credentialGeneration!==actor.credentialGeneration)unknown();};
   if(receipt.id!==state.receiptIds.serverCommandId||receipt.authorizationReceiptRef?.id!==state.receiptIds.authorizationReceiptId||hash(receipt.result)!==state.resultHash)unknown();
   await this.#registeredTx(db,state.query,state.transactionId,state.until);check();
   const sql=state.purpose==='REQUEST'?'SELECT * FROM anvil.fn09_registered_approval_request_settle($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)':'SELECT * FROM anvil.fn09_registered_approval_decision_settle($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)';
   const rows=(await Reflect.apply(state.query,db,[sql,[state.sessionId,state.actorId,state.clientId,state.request.projectId,state.request.commandId,state.reservationId,state.planHash,receipt.id,canonicalJson(receipt.result),state.transactionId]])).rows;
   await this.#registeredTx(db,state.query,state.transactionId,state.until);check();const row=rows.length===1?rows[0]:undefined;
   if(!row||row.status!=='SETTLED'||row.reservation_id!==state.reservationId||row.transaction_id!==state.transactionId||quotaBytes(row.settled_bytes)>state.reservedBytes)unknown();
  }catch{return unknown();}finally{state.phase='CLOSED';}
 }
 async #current(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,state?:PreparedState){
  if(!['uploadArtifact','proposeDocumentChange','saveCheckpoint','linkDocumentSource','proposeDocumentSourceChange'].includes(request.operation)||!uuidV1(request.projectId)||!uuidV1(request.commandId)||request.clientId!==actor.clientId)fail();
  if(state&&(state.p.actorId!==actor.actorId||state.p.request.clientId!==actor.clientId||hash(request)!==state.p.commandHash))fail('IDEMPOTENCY_CONFLICT',409);
  await currentGeneralProjectController(db,actor,request);const member=await projectMember(db,actor,request.projectId);const policy=await authorizeMaterial(db,actor,request,false,this.#documents);
  const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at,s=actor.authSession;
  if(!(at instanceof Date)||!Number.isFinite(at.getTime())||!s||!uuidV1(s.id)||!isoV1(s.idleExpiresAt)||!isoV1(s.absoluteExpiresAt)||!Number.isFinite(policy.validUntil))fail('PROJECT_STORAGE_CURRENT_REQUIRED',412);
  const deadline=Math.min(policy.validUntil,Date.parse(s.idleExpiresAt),Date.parse(s.absoluteExpiresAt),state?.deadline??Infinity);
  if(deadline<=at.getTime())fail('PROJECT_STORAGE_CURRENT_REQUIRED',412);
  if(state&&hash(policy.ref)!==hash(state.p.policyRef))fail('IDEMPOTENCY_CONFLICT',409);
  return {policyRef:policy.ref,deadline,sessionId:s.id,atMs:at.getTime(),accountPurpose:member.participation==='HANDOFF_ELIGIBLE'?'FN15_ORDINARY' as const:'OWNER' as const};
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
   const account=(await db.query(c.accountPurpose==='FN15_ORDINARY'?'SELECT * FROM anvil.fn15_ordinary_quota_account($1,$2,$3,$4,$5::jsonb)':'SELECT * FROM anvil.quota_account($1,$2,$3,$4)',[c.sessionId,actor.actorId,actor.clientId,prepared.request.projectId,...(c.accountPurpose==='FN15_ORDINARY'?[JSON.stringify(prepared.request)]:[])])).rows[0];
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