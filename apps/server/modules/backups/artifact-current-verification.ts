import type {ProjectBaselines} from '../projects/project-baselines.ts';
import {composeProjectInventory,composeProjectInventoryForArtifactVerification} from './project-inventory-composition.ts';
import type {PoolClient} from 'pg';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {verifyArtifactBytes,type ArtifactByteReader,type ArtifactByteVerification} from './artifact-byte-verification.ts';

import {collectDocumentInventory} from './document-inventory.ts';
import {collectConversationInventory} from './conversation-inventory.ts';
import {collectKnowledgeInventory} from './knowledge-inventory.ts';
import {readConversationInput} from '../knowledge/conversation-input.ts';
import {readDocumentInventoryInput} from './document-inventory-input.ts';

interface Input{projectId:string;artifactId:string;bytes:number;contentHash:string;mediaType:string;maxBytes:number;deadlineMs:number}
interface RowSnapshot{id:string;project_id:string;draft_id:null;bytes:number;content_hash:string;media_type:string;storage_key:string;state:'READY';inspection_json:{policyVersion:1;method:'KNOWN_PATTERNS_RAW_BYTES';complete:false;state:'NO_KNOWN_MARKER';reasonCodes:readonly []}}
export interface CurrentArtifactVerification{
 kind:'ARTIFACT_CURRENT_VERIFICATION_V1';byteVerification:ArtifactByteVerification;
 observation:{projectId:string;artifactId:string;startedAt:string;finishedAt:string;authBoundary:'START_AND_END_READ_COMMITTED';sameSession:true;ownerConfirmed:true;artifactState:'READY';inspectionState:'NO_KNOWN_MARKER'};
 inventoryMembershipVerified:false;restorable:false;
}
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const validUuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const fail=(code:string,status:number)=>new AuthFailure(code,status);
function data(v:unknown,keys:string[],exact=true):Record<string,any>{
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error();const proto=Object.getPrototypeOf(v);if(proto!==Object.prototype&&proto!==null)throw Error();const descriptors=Object.getOwnPropertyDescriptors(v),names=Reflect.ownKeys(descriptors);
 if(exact&&(names.length!==keys.length||names.some(k=>typeof k!=='string'||!keys.includes(k))))throw Error();const snapshot:Record<string,any>={};
 for(const k of keys){const d=descriptors[k];if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw Error();snapshot[k]=d.value;}return snapshot;
}
function readInput(value:unknown):Readonly<Input>{
 try{const v=data(value,['projectId','artifactId','bytes','contentHash','mediaType','maxBytes','deadlineMs']);if(!validUuid(v.projectId)||!validUuid(v.artifactId)||!integer(v.bytes,0,20*1024*1024)||typeof v.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(v.contentHash)||!integer(v.maxBytes,1)||v.bytes>v.maxBytes||!integer(v.deadlineMs,1)||typeof v.mediaType!=='string'||v.mediaType.length<1||v.mediaType.length>200)throw Error();return Object.freeze(v as Input);}catch{throw fail('INPUT_INVALID',400);}
}
function actorSnapshot(value:AuthenticatedIdentity):AuthenticatedIdentity{
 const a=data(value,['actorId','clientId','credentialGeneration','authSession'],false),s=data(a.authSession,['id','idleExpiresAt','absoluteExpiresAt']);if(!validUuid(a.actorId)||!validUuid(a.clientId)||!integer(a.credentialGeneration,1)||!validUuid(s.id)||typeof s.idleExpiresAt!=='string'||typeof s.absoluteExpiresAt!=='string'||!Number.isFinite(Date.parse(s.idleExpiresAt))||!Number.isFinite(Date.parse(s.absoluteExpiresAt)))throw Error();
 return Object.freeze({actorId:a.actorId,clientId:a.clientId,serverOwner:false,credentialGeneration:a.credentialGeneration,reauthUntil:null,authSession:Object.freeze({id:s.id,idleExpiresAt:s.idleExpiresAt,absoluteExpiresAt:s.absoluteExpiresAt})});
}
const sameActor=(a:AuthenticatedIdentity,b:AuthenticatedIdentity)=>a.actorId===b.actorId&&a.clientId===b.clientId&&a.credentialGeneration===b.credentialGeneration&&a.authSession!.id===b.authSession!.id;

// 단일/목록 검증에서 최초 신원과 전체 기한을 공유한다. 공개 권한 증명이 아니다.
function currentScope(access:AccessRepository,token:string,input:{projectId:string;deadlineMs:number},signal:AbortSignal,resource?:Readonly<{check:()=>void;remaining:()=>number}>){
 const started=performance.now();let authDeadline=Infinity,identity:AuthenticatedIdentity|undefined;
 const known=new WeakSet<AuthFailure>();
 const stop=(code:string,status:number):never=>{const e=fail(code,status);known.add(e);throw e;};
 const check=()=>{if(resource)try{resource.check();}catch(e){if(e instanceof AuthFailure&&e.statusCode===409)stop('ARTIFACT_CURRENT_CANCELLED',409);if(e instanceof AuthFailure&&e.statusCode===413)stop('ARTIFACT_CURRENT_DEADLINE',413);stop('ARTIFACT_CURRENT_FAILED',503);}if(signal.aborted)stop('ARTIFACT_CURRENT_CANCELLED',409);if(performance.now()-started>=input.deadlineMs||performance.now()>=authDeadline)stop('ARTIFACT_CURRENT_DEADLINE',413);};
 const remaining=()=>{check();const n=Math.floor(Math.min(input.deadlineMs-(performance.now()-started),authDeadline-performance.now(),resource?resource.remaining():Infinity));if(n<1)stop('ARTIFACT_CURRENT_DEADLINE',413);return Math.min(Number.MAX_SAFE_INTEGER,n);};
 async function query(db:PoolClient,sql:string,values:unknown[]=[]){
  const ms=Math.min(2147483647,remaining());let result:any,before:number;
  try{await db.query("SELECT set_config('statement_timeout',$1,true)",[String(ms)]);}catch{stop('ARTIFACT_CURRENT_FAILED',503);}check();before=performance.now();
  try{result=await db.query(sql,values);}catch{stop('ARTIFACT_CURRENT_FAILED',503);}check();return{result,before};
 }
 function inspection(value:unknown):RowSnapshot['inspection_json']{
  // inventory에서는 null도 UNKNOWN이다. 일반 다운로드의 null 허용 계약은 바꾸지 않는다.
  try{const v=data(value,['policyVersion','method','complete','state','reasonCodes']);if(v.policyVersion!==1||v.method!=='KNOWN_PATTERNS_RAW_BYTES'||v.complete!==false||v.state!=='NO_KNOWN_MARKER'||!Array.isArray(v.reasonCodes)||v.reasonCodes.length!==0)throw Error();return Object.freeze({policyVersion:1,method:'KNOWN_PATTERNS_RAW_BYTES',complete:false,state:'NO_KNOWN_MARKER',reasonCodes:Object.freeze([])}) as RowSnapshot['inspection_json'];}catch{return stop('ARTIFACT_CURRENT_BLOCKED',412);}
 }
 function stored(value:unknown,input:Readonly<Input>):Readonly<RowSnapshot>{
  let row:Record<string,any>;try{row=data(value,['id','project_id','draft_id','bytes','content_hash','media_type','storage_key','state','inspection_json']);const bytes=typeof row.bytes==='string'&&/^(0|[1-9][0-9]*)$/.test(row.bytes)?Number(row.bytes):row.bytes;
   if(row.id!==input.artifactId||row.project_id!==input.projectId||row.draft_id!==null||!integer(bytes,0,20*1024*1024)||bytes!==input.bytes||row.content_hash!==input.contentHash||row.media_type!==input.mediaType||row.storage_key!==`blobs/${input.projectId}/${input.artifactId}`)throw Error();row.bytes=bytes;
  }catch{stop('ARTIFACT_CURRENT_INTEGRITY_FAILED',503);}
  if(row!.state!=='READY')stop('ARTIFACT_CURRENT_BLOCKED',412);const inspected=inspection(row!.inspection_json);
  return Object.freeze({id:row!.id,project_id:row!.project_id,draft_id:null,bytes:row!.bytes,content_hash:row!.content_hash,media_type:row!.media_type,storage_key:row!.storage_key,state:'READY',inspection_json:inspected});
 }
 async function boundary(wanted:readonly Readonly<Input>[]):Promise<{rows:Readonly<RowSnapshot>[];observedAt:string}>{
  check();let snapshot:{rows:Readonly<RowSnapshot>[];observedAt:string};
  try{snapshot=await access.authenticated(token,null,async(db,actor)=>{
   check();let a:AuthenticatedIdentity;try{a=actorSnapshot(actor);}catch{stop('AUTH_REQUIRED',401);}if(identity&&!sameActor(identity,a!))stop('AUTH_REQUIRED',401);
   const isolation=(await query(db,"SELECT current_setting('transaction_isolation') AS isolation")).result.rows;if(!Array.isArray(isolation)||isolation.length!==1||isolation[0]?.isolation!=='read committed')stop('ARTIFACT_CURRENT_FAILED',503);
   const scoped={query:async(sql:string,values:unknown[]) => (await query(db,sql,values)).result}as unknown as PoolClient;
   const p=await projectMember(scoped,a!,input.projectId,false);if(p.id!==input.projectId||p.archived_at!==null||p.participation!=='OWNER')stop('NOT_FOUND',404);
   const clock=await query(db,'SELECT clock_timestamp() AS at'),rows=clock.result.rows;const at=Array.isArray(rows)&&rows.length===1?rows[0]?.at:undefined;
   if(!(at instanceof Date)||!Number.isFinite(at.getTime()))stop('ARTIFACT_CURRENT_FAILED',503);
   let deadline:number;try{deadline=notificationSessionDeadline(a!,at,clock.before);}catch{stop('AUTH_REQUIRED',401);}authDeadline=Math.min(authDeadline,deadline!);check();
   if(!identity)identity=a!;
   const collected:Readonly<RowSnapshot>[]=[];
   for(const ref of wanted){
    if(ref.projectId!==input.projectId)stop('ARTIFACT_CURRENT_INTEGRITY_FAILED',503);
    const result=(await query(db,'SELECT id,project_id,draft_id,bytes,content_hash,media_type,storage_key,state,inspection_json FROM anvil.artifacts WHERE project_id=$1 AND id=$2',[input.projectId,ref.artifactId])).result;
    if(!Array.isArray(result.rows))stop('ARTIFACT_CURRENT_INTEGRITY_FAILED',503);if(result.rows.length===0)stop('NOT_FOUND',404);if(result.rows.length!==1)stop('ARTIFACT_CURRENT_INTEGRITY_FAILED',503);
    collected.push(stored(result.rows[0],ref));
   }
   check();return{rows:collected,observedAt:at.toISOString()};
  });}catch(e){if(e instanceof AuthFailure&&known.has(e))throw e;if(e instanceof AuthFailure&&(e.message==='AUTH_REQUIRED'&&e.statusCode===401||e.message==='NOT_FOUND'&&e.statusCode===404))stop(e.message,e.statusCode);stop('ARTIFACT_CURRENT_FAILED',503);}
  // callback뿐 아니라 AccessRepository의 외부 COMMIT/연결 반환이 끝난 뒤에도 검사한다.
  check();return snapshot!;
 }
 async function verify(input:Readonly<Input>,reader:ArtifactByteReader):Promise<CurrentArtifactVerification>{
 try{
  check();const start=await boundary([input]);check();let bytes:ArtifactByteVerification;
  try{bytes=await verifyArtifactBytes({projectId:input.projectId,artifactId:input.artifactId,bytes:input.bytes,contentHash:input.contentHash,maxBytes:input.maxBytes,deadlineMs:remaining()},reader,signal);}catch(e){
   // 기존 검증기는 close까지 마친 후 고정 오류를 반환한다. 원 reader 오류는 보존하지 않는다.
   if(e instanceof AuthFailure&&e.message==='ARTIFACT_BYTES_CLEANUP_FAILED'&&e.statusCode===503)stop('ARTIFACT_CURRENT_FAILED',503);
   check();if(e instanceof AuthFailure&&e.message==='ARTIFACT_BYTES_SENSITIVE'&&e.statusCode===412)stop('ARTIFACT_CURRENT_BLOCKED',412);
   if(e instanceof AuthFailure&&e.message==='ARTIFACT_BYTES_CANCELLED'&&e.statusCode===409)stop('ARTIFACT_CURRENT_CANCELLED',409);
   if(e instanceof AuthFailure&&e.message==='ARTIFACT_BYTES_TIMEOUT'&&e.statusCode===408)stop('ARTIFACT_CURRENT_DEADLINE',413);
   stop('ARTIFACT_CURRENT_FAILED',503);
  }
  check();if(canonicalJson(bytes!.markerCheck)!==canonicalJson(start.rows[0]!.inspection_json))stop('ARTIFACT_CURRENT_INTEGRITY_FAILED',503);
  const end=await boundary([input]);check();if(canonicalJson(start.rows[0])!==canonicalJson(end.rows[0]))stop('ARTIFACT_CURRENT_INTEGRITY_FAILED',503);
  return{kind:'ARTIFACT_CURRENT_VERIFICATION_V1',byteVerification:bytes!,observation:{projectId:input.projectId,artifactId:input.artifactId,startedAt:start.observedAt,finishedAt:end.observedAt,authBoundary:'START_AND_END_READ_COMMITTED',sameSession:true,ownerConfirmed:true,artifactState:'READY',inspectionState:'NO_KNOWN_MARKER'},inventoryMembershipVerified:false,restorable:false};
 }catch(e){if(e instanceof AuthFailure&&known.has(e))throw e;throw fail('ARTIFACT_CURRENT_FAILED',503);}
}
 let guardFailure:AuthFailure|undefined;
 const guardedAccess={pool:access.pool,authenticated:async<T>(given:string,csrf:string|null,operation:(db:PoolClient,actor:AuthenticatedIdentity)=>Promise<T>):Promise<T>=>{
  const result=await access.authenticated(given,csrf,async(db,actor)=>{
   try{
    check();if(given!==token||csrf!==null)stop('AUTH_REQUIRED',401);let current:AuthenticatedIdentity;
    try{current=actorSnapshot(actor);}catch{stop('AUTH_REQUIRED',401);}if(!identity||!sameActor(identity,current!))stop('AUTH_REQUIRED',401);
    // 신원 대조 후 수집기가 이미 읽는 DB 시각을 관측한다. 별도 clock query나 기한 재시작은 없다.
    let observedClock=false;
    const observed={query:async(sql:string,values:unknown[]=[])=>{
     check();const before=performance.now(),result=await db.query(sql,values);
     if(sql==='SELECT clock_timestamp() AS at'){
      const at=Array.isArray(result.rows)&&result.rows.length===1?result.rows[0]?.at:undefined;
      if(!(at instanceof Date)||!Number.isFinite(at.getTime()))stop('ARTIFACT_CURRENT_FAILED',503);
      let deadline:number;try{deadline=notificationSessionDeadline(current!,at,before);}catch{stop('AUTH_REQUIRED',401);}
      authDeadline=Math.min(authDeadline,deadline!);observedClock=true;
     }
     check();return result;
    }}as unknown as PoolClient;
    const outcome=await operation(observed,current!);if(!observedClock)stop('ARTIFACT_CURRENT_FAILED',503);check();return outcome;
   }catch(error){if(error instanceof AuthFailure&&known.has(error))guardFailure=error;throw error;}
  });check();return result;
 }}as unknown as AccessRepository;
 function normalize(error:unknown):never{
  if(error instanceof AuthFailure&&known.has(error))throw error;
  // 수집기에서 발급한 닫힌 오류만 새 객체로 전달한다. 원 DB/IO 객체·cause는 반환하지 않는다.
  const codes:Record<string,number>={AUTH_REQUIRED:401,NOT_FOUND:404,DOCUMENT_INVENTORY_CANCELLED:409,DOCUMENT_INVENTORY_DEADLINE:413,DOCUMENT_INVENTORY_LIMIT:413,DOCUMENT_INVENTORY_INTEGRITY_FAILED:503,DOCUMENT_INVENTORY_STORAGE_FAILED:503,DOCUMENT_INVENTORY_SOURCE_CHANGED:503,DOCUMENT_INVENTORY_SENSITIVE_METADATA:503,CONVERSATION_INVENTORY_CANCELLED:409,CONVERSATION_INVENTORY_DEADLINE:413,CONVERSATION_INVENTORY_LIMIT:413,CONVERSATION_INVENTORY_INTEGRITY_FAILED:503,CONVERSATION_INVENTORY_STORAGE_FAILED:503,CONVERSATION_INVENTORY_SENSITIVE_METADATA:503,KNOWLEDGE_INVENTORY_CANCELLED:409,KNOWLEDGE_INVENTORY_DEADLINE:413,KNOWLEDGE_INVENTORY_LIMIT:413,KNOWLEDGE_INVENTORY_INTEGRITY_FAILED:503,KNOWLEDGE_INVENTORY_STORAGE_FAILED:503,KNOWLEDGE_INVENTORY_SENSITIVE_METADATA:503};
  if(error instanceof AuthFailure&&codes[error.message]===error.statusCode){
   if(guardFailure&&!['DOCUMENT_INVENTORY_STORAGE_FAILED','CONVERSATION_INVENTORY_STORAGE_FAILED','KNOWLEDGE_INVENTORY_STORAGE_FAILED'].includes(error.message))throw guardFailure;
   throw fail(error.message,error.statusCode);
  }
  return stop('ARTIFACT_CURRENT_FAILED',503);
 }
 return{check,remaining,boundary,verify,stop,normalize,guardedAccess};
}

/** 단일 원문의 양끝 관측이다. 지속 권한·inventory 포함관계·파일 안정성·백업 완료를 발급하지 않는다. */
export async function verifyCurrentArtifact(access:AccessRepository,token:string,value:unknown,reader:ArtifactByteReader,signal:AbortSignal):Promise<CurrentArtifactVerification>{
 const input=readInput(value);return currentScope(access,token,input,signal).verify(input,reader);
}

/** live 문서 목록의 원문 관측만 연결한다. 전체 프로젝트 백업/복원·원자적 snapshot 보장은 없다. */
export async function verifyDocumentInventoryArtifacts(access:AccessRepository,token:string,value:unknown,reader:ArtifactByteReader,signal:AbortSignal){
 const request=readDocumentInventoryInput(value),scope=currentScope(access,token,{projectId:request.projectId,deadlineMs:request.limits.deadlineMs},signal);
 try{
  await scope.boundary([]);
  const inventory=await collectDocumentInventory(scope.guardedAccess,token,{projectId:request.projectId,limits:{...request.limits,deadlineMs:scope.remaining()}},signal);
  scope.check();await scope.boundary([]);
  // 수집 원본 hash를 계산한다. blobVerification이나 관측 본문을 수정하지 않는다.
  const inventoryHash=contentHash(canonicalJson(inventory));
  if(inventory.kind!=='DOCUMENT_INVENTORY_V1'||inventory.projectId!==request.projectId||!Array.isArray(inventory.artifactRefs)||!Array.isArray(inventory.issues)||!Array.isArray(inventory.externalDependencies))scope.stop('ARTIFACT_CURRENT_INTEGRITY_FAILED',503);
  type Ref={artifactId:string;bytes:number;contentHash:string;mediaType:string};
  type Item={ref:Ref;status:'VERIFIED';verification:CurrentArtifactVerification}|{ref:Ref;status:'NOT_VERIFIED';reasonCode:'ARTIFACT_NOT_READY'|'ARTIFACT_INSPECTION_UNKNOWN';sourceState:string;sourceInspectionStatus:string};
  const selected:Array<{ref:Ref;state:string;inspectionStatus:string}>=[];let previous='',inputBytes=0;
  for(const raw of inventory.artifactRefs){
   scope.check();let row:Record<string,any>;try{row=data(raw,['artifactId','bytes','contentHash','mediaType','state','inspectionStatus','blobVerification']);}catch{scope.stop('ARTIFACT_CURRENT_INTEGRITY_FAILED',503);}
   if(!validUuid(row!.artifactId)||row!.artifactId<=previous||!integer(row!.bytes,0,20*1024*1024)||typeof row!.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(row!.contentHash)||typeof row!.mediaType!=='string'||row!.mediaType.length<1||row!.mediaType.length>200||!['READY','QUARANTINED','STAGING','FAILED','UNKNOWN'].includes(row!.state)||!['NO_KNOWN_MARKER','SUSPECTED','UNKNOWN'].includes(row!.inspectionStatus)||row!.blobVerification!=='NOT_PERFORMED')scope.stop('ARTIFACT_CURRENT_INTEGRITY_FAILED',503);
   if(selected.length>=request.limits.fileCount||inputBytes>Number.MAX_SAFE_INTEGER-row!.bytes||inputBytes>request.limits.inputBytes-row!.bytes)scope.stop('DOCUMENT_INVENTORY_LIMIT',413);
   previous=row!.artifactId;inputBytes+=row!.bytes;selected.push({ref:Object.freeze({artifactId:row!.artifactId,bytes:row!.bytes,contentHash:row!.contentHash,mediaType:row!.mediaType}),state:row!.state,inspectionStatus:row!.inspectionStatus});
  }
  if(inventory.usage.fileCount!==selected.length||inventory.usage.inputBytes!==inputBytes)scope.stop('ARTIFACT_CURRENT_INTEGRITY_FAILED',503);
  const artifacts:Item[]=[],verified:Readonly<Input>[]=[];let verifiedBytes=0;
  for(const item of selected){
   scope.check();if(item.state!=='READY'||item.inspectionStatus!=='NO_KNOWN_MARKER'){
    artifacts.push({ref:item.ref,status:'NOT_VERIFIED',reasonCode:item.state!=='READY'?'ARTIFACT_NOT_READY':'ARTIFACT_INSPECTION_UNKNOWN',sourceState:item.state,sourceInspectionStatus:item.inspectionStatus});continue;
   }
   const wanted=readInput({projectId:request.projectId,...item.ref,maxBytes:request.limits.inputBytes,deadlineMs:scope.remaining()}),verification=await scope.verify(wanted,reader);
   verified.push(wanted);verifiedBytes+=wanted.bytes;artifacts.push({ref:item.ref,status:'VERIFIED',verification});
  }
  // 마지막 RC에서 앞서 확인한 파일도 모두 다시 대조한다. 파일 재읽기는 하지 않는다.
  await scope.boundary(verified);scope.check();
  const result={kind:'DOCUMENT_INVENTORY_ARTIFACT_VERIFICATION_V1' as const,projectId:request.projectId,
   inventory:{observation:{snapshot:inventory.observation.snapshot,startedAt:inventory.observation.startedAt,finishedAt:inventory.observation.finishedAt,isolation:inventory.observation.isolation,readOnly:inventory.observation.readOnly,authBoundary:inventory.observation.authBoundary},contentHash:inventoryHash,metadataComplete:inventory.metadataComplete,issueCount:inventory.issues.length,externalDependencyCount:inventory.externalDependencies.length},artifacts,
   usage:{fileCount:selected.length,inputBytes,verifiedCount:verified.length,unverifiedCount:selected.length-verified.length,verifiedBytes,metadataBytes:0},atomicSnapshotVerified:false,fullProjectCoverage:false,restorable:false};
  for(let i=0;i<17;i++){scope.check();const size=Buffer.byteLength(canonicalJson(result));if(size>request.limits.metadataBytes)scope.stop('DOCUMENT_INVENTORY_LIMIT',413);if(size===result.usage.metadataBytes){scope.check();return result;}result.usage.metadataBytes=size;}
  return scope.stop('ARTIFACT_CURRENT_INTEGRITY_FAILED',503);
 }catch(error){return scope.normalize(error);}
}


/** 대화 자료군의 live 목록·원문 양끝 관측이다. 전체 archive/원자적 snapshot 보장이 아니다. */
export async function verifyConversationInventoryArtifacts(access:AccessRepository,token:string,value:unknown,reader:ArtifactByteReader,signal:AbortSignal){
 return verifyHistoryInventoryArtifacts('CONVERSATION',access,token,value,reader,signal);
}
/** EXCLUDED/SUPERSEDED를 포함한 지식 역사를 검증한다. 현재 사용·실행 허가를 부여하지 않는다. */
export async function verifyKnowledgeInventoryArtifacts(access:AccessRepository,token:string,value:unknown,reader:ArtifactByteReader,signal:AbortSignal){
 return verifyHistoryInventoryArtifacts('KNOWLEDGE',access,token,value,reader,signal);
}

type HistoryRef={artifactId:string;bytes:number;contentHash:string;mediaType:string};
type HistoryMessage={id:string;conversationId:string;sequence:number;contentHash:string;bodyRef:Readonly<HistoryRef>;message:unknown;redactionState:'NOT_REDACTED'|'QUARANTINED'};
type HistoryItem={ref:Readonly<HistoryRef>;status:'VERIFIED';verification:CurrentArtifactVerification}|{ref:Readonly<HistoryRef>;status:'NOT_VERIFIED';reasonCode:'MESSAGE_QUARANTINED'|'ARTIFACT_NOT_READY'|'ARTIFACT_INSPECTION_UNKNOWN';sourceState:string;sourceInspectionStatus:string};

// 두 진입점만 자료군을 고른다. 외부 inventory·수집기·SQL 선택 입력은 없다.
async function verifyHistoryInventoryArtifacts(kind:'CONVERSATION'|'KNOWLEDGE',access:AccessRepository,token:string,value:unknown,reader:ArtifactByteReader,signal:AbortSignal){
 const request=readDocumentInventoryInput(value),scope=currentScope(access,token,{projectId:request.projectId,deadlineMs:request.limits.deadlineMs},signal);
 const inventoryScope=kind==='CONVERSATION'?'CONVERSATION_HISTORY_ONLY':'KNOWLEDGE_CONSTITUTION_HISTORY_ONLY';
 const limit=():never=>scope.stop(kind+'_INVENTORY_LIMIT',413),invalid=():never=>scope.stop('ARTIFACT_CURRENT_INTEGRITY_FAILED',503);
 const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
 const positive=(v:unknown)=>{const n=typeof v==='string'&&/^[1-9][0-9]*$/.test(v)?Number(v):v;if(!integer(n,1))return invalid();return n;};
 try{
  await scope.boundary([]);
  const input={projectId:request.projectId,limits:{...request.limits,deadlineMs:scope.remaining()}};
  const inventory=kind==='CONVERSATION'?await collectConversationInventory(scope.guardedAccess,token,input,signal):await collectKnowledgeInventory(scope.guardedAccess,token,input,signal);
  scope.check();await scope.boundary([]);
  if(inventory.kind!==kind+'_INVENTORY_V1'||inventory.scope!==inventoryScope||inventory.projectId!==request.projectId||!Array.isArray(inventory.artifacts)||!Array.isArray(inventory.issues)||!Array.isArray(inventory.externalDependencies))invalid();
  const inventoryHash=contentHash(canonicalJson(inventory)),selected:Array<{ref:Readonly<HistoryRef>;state:string;inspectionStatus:string}>=[],byArtifact=new Map<string,Readonly<HistoryRef>>();let previous='',inputBytes=0;
  for(const raw of inventory.artifacts){
   scope.check();let row:Record<string,any>;try{row=data(raw,['artifactId','bytes','contentHash','mediaType','state','inspectionStatus','blobVerification']);}catch{invalid();}
   if(!validUuid(row!.artifactId)||row!.artifactId<=previous||!integer(row!.bytes,0,20*1024*1024)||typeof row!.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(row!.contentHash)||typeof row!.mediaType!=='string'||row!.mediaType.length<1||row!.mediaType.length>200||!row!.mediaType.isWellFormed()||!['READY','QUARANTINED','STAGING','FAILED'].includes(row!.state)||!['NO_KNOWN_MARKER','SUSPECTED','UNKNOWN'].includes(row!.inspectionStatus)||row!.blobVerification!=='NOT_PERFORMED')invalid();
   if(selected.length>=request.limits.fileCount||inputBytes>Number.MAX_SAFE_INTEGER-row!.bytes||inputBytes>request.limits.inputBytes-row!.bytes)limit();
   const ref=Object.freeze({artifactId:row!.artifactId,bytes:row!.bytes,contentHash:row!.contentHash,mediaType:row!.mediaType});previous=ref.artifactId;inputBytes+=ref.bytes;selected.push({ref,state:row!.state,inspectionStatus:row!.inspectionStatus});byArtifact.set(ref.artifactId,ref);
  }
  if(inventory.usage.fileCount!==selected.length||inventory.usage.inputBytes!==inputBytes||!integer(inventory.usage.metadataBytes,1,request.limits.metadataBytes))invalid();
  // 최초 수집 DTO의 크기에 이후 현재성 조회 payload를 누적한다. 결과 DTO 한도는 별도로 확인한다.
  let metadataBytes=inventory.usage.metadataBytes;
  const messageMap=new Map<string,HistoryMessage[]>(),quarantined=new Set<string>(),messageIds=new Set<string>();
  if(kind==='CONVERSATION'){
   if(!Array.isArray(inventory.messages))invalid();
   for(const raw of inventory.messages){
    scope.check();let m:Record<string,any>,ref:Record<string,any>;
    try{m=data(raw,['sourceRef','conversationId','serverSequence','author','message','redactionState','recordedAt','projectionHash']);ref=data(m.sourceRef,['kind','id','contentHash']);}catch{invalid();}
    if(ref!.kind!=='CONVERSATION'||!validUuid(ref!.id)||messageIds.has(ref!.id)||typeof ref!.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(ref!.contentHash)||!validUuid(m!.conversationId)||!integer(m!.serverSequence,1)||!same(m!.author,{kind:'HUMAN'})||!['NOT_REDACTED','QUARANTINED'].includes(m!.redactionState))invalid();
    const {projectionHash,...projection}=m!;if(projectionHash!==contentHash(canonicalJson(projection)))invalid();
    let parsed:ReturnType<typeof readConversationInput>;try{parsed=readConversationInput({conversationId:m!.conversationId,targetRoleRef:null,message:m!.message,sourceRefs:[]},request.projectId);}catch{invalid();}
    const bodyRef=byArtifact.get(parsed!.message.bodyRef.artifactId);if(!bodyRef||!same(bodyRef,parsed!.message.bodyRef))invalid();
    const item:HistoryMessage={id:ref!.id,conversationId:m!.conversationId,sequence:m!.serverSequence,contentHash:ref!.contentHash,bodyRef:bodyRef!,message:structuredClone(parsed!.message),redactionState:m!.redactionState};
    if(!messageMap.has(bodyRef!.artifactId))messageMap.set(bodyRef!.artifactId,[]);messageMap.get(bodyRef!.artifactId)!.push(item);messageIds.add(item.id);if(item.redactionState==='QUARANTINED')quarantined.add(bodyRef!.artifactId);
   }
   if(selected.some(item=>!messageMap.has(item.ref.artifactId)))invalid();
  }
  async function currentMessages(refs:readonly Readonly<HistoryRef>[]){
   if(kind!=='CONVERSATION'||!refs.length)return;
   const wanted=refs.flatMap(r=>messageMap.get(r.artifactId)??[]).sort((a,b)=>a.id.localeCompare(b.id));
   if(wanted.some(m=>m.redactionState!=='NOT_REDACTED')||new Set(wanted.map(m=>m.id)).size!==wanted.length)invalid();
   await scope.guardedAccess.authenticated(token,null,async(db,actor)=>{
    async function query(sql:string,values:unknown[]=[]){scope.check();await db.query("SELECT set_config('statement_timeout',$1,true)",[String(Math.min(2147483647,scope.remaining()))]);scope.check();const result=await db.query(sql,values);scope.check();return result;}
    const isolation=(await query("SELECT current_setting('transaction_isolation') AS isolation")).rows;if(!Array.isArray(isolation)||isolation.length!==1||isolation[0]?.isolation!=='read committed')invalid();
    const member=await projectMember({query}as unknown as PoolClient,actor,request.projectId,false);if(member.id!==request.projectId||member.archived_at!==null||member.participation!=='OWNER')scope.stop('NOT_FOUND',404);
    const clock=(await query('SELECT clock_timestamp() AS at')).rows;if(!Array.isArray(clock)||clock.length!==1||!(clock[0]?.at instanceof Date)||!Number.isFinite(clock[0].at.getTime()))invalid();
    for(let batchStart=0;batchStart<wanted.length;batchStart+=200){
     scope.check();const batch=wanted.slice(batchStart,batchStart+200),remaining=request.limits.metadataBytes-metadataBytes;if(remaining<=0)limit();
     const result=await query(`WITH inventory_row AS (SELECT project_id,conversation_id,id,sequence,content_hash,body_artifact_id,message_json,redaction_state FROM anvil.conversation_messages WHERE project_id=$1 AND id=ANY($2::uuid[]) ORDER BY id LIMIT 200)
      SELECT CASE WHEN octet_length(to_jsonb(inventory_row)::text)<=$3::bigint THEN to_jsonb(inventory_row) ELSE NULL END AS inventory_data,octet_length(to_jsonb(inventory_row)::text) AS row_bytes FROM inventory_row ORDER BY inventory_row.id`,[request.projectId,batch.map(m=>m.id),remaining]);
     if(!Array.isArray(result.rows)||result.rows.length!==batch.length||result.rows.length>200)invalid();const expected=new Map(batch.map(m=>[m.id,m])),seen=new Set<string>();
     for(const raw of result.rows){
      scope.check();let row:Record<string,any>,size:number;
      try{const envelope=data(raw,['inventory_data','row_bytes']);size=positive(envelope.row_bytes);if(size>remaining||metadataBytes>request.limits.metadataBytes-size)limit();row=data(envelope.inventory_data,['project_id','conversation_id','id','sequence','content_hash','body_artifact_id','message_json','redaction_state']);}catch(e){return scope.normalize(e);}
      const initial=expected.get(row!.id);if(!initial)return invalid();if(seen.has(row!.id)||row!.project_id!==request.projectId||row!.conversation_id!==initial.conversationId||positive(row!.sequence)!==initial.sequence||row!.content_hash!==initial.contentHash||row!.body_artifact_id!==initial.bodyRef.artifactId)invalid();
      if(!['NOT_REDACTED','QUARANTINED'].includes(row!.redaction_state))invalid();if(row!.redaction_state!=='NOT_REDACTED')scope.stop('ARTIFACT_CURRENT_BLOCKED',412);
      try{
       const snapshot=data(row!.message_json,['conversationId','targetRoleRef','message','sourceRefs','serverSequence','authorRef']),author=data(snapshot.authorRef,['kind','userId']);
       const parsed=readConversationInput({conversationId:snapshot.conversationId,targetRoleRef:snapshot.targetRoleRef,message:snapshot.message,sourceRefs:snapshot.sourceRefs},request.projectId);
       if(snapshot.conversationId!==initial.conversationId||snapshot.serverSequence!==initial.sequence||author.kind!=='HUMAN'||!validUuid(author.userId)||contentHash(canonicalJson(snapshot))!==initial.contentHash||!same(parsed.message,initial.message)||!same(parsed.message.bodyRef,initial.bodyRef))invalid();
      }catch{invalid();}
      metadataBytes+=size!;seen.add(row!.id);
     }
    }
    scope.check();
   });
   // 인증 transaction의 COMMIT과 연결 반환을 기다린 뒤 다시 검사한다.
   scope.check();
  }
  const artifacts:HistoryItem[]=[],verified:Readonly<Input>[]=[];let verifiedBytes=0;
  for(const item of selected){
   scope.check();const reasonCode=quarantined.has(item.ref.artifactId)?'MESSAGE_QUARANTINED':item.state!=='READY'?'ARTIFACT_NOT_READY':item.inspectionStatus!=='NO_KNOWN_MARKER'?'ARTIFACT_INSPECTION_UNKNOWN':null;
   if(reasonCode){artifacts.push({ref:item.ref,status:'NOT_VERIFIED',reasonCode,sourceState:item.state,sourceInspectionStatus:item.inspectionStatus});continue;}
   await currentMessages([item.ref]);
   const wanted=readInput({projectId:request.projectId,...item.ref,maxBytes:request.limits.inputBytes,deadlineMs:scope.remaining()}),verification=await scope.verify(wanted,reader);
   verified.push(wanted);verifiedBytes+=wanted.bytes;artifacts.push({ref:item.ref,status:'VERIFIED',verification});
  }
  await currentMessages(verified);await scope.boundary(verified);scope.check();
  const result={kind:kind+'_INVENTORY_ARTIFACT_VERIFICATION_V1',scope:inventoryScope,projectId:request.projectId,
   inventory:{observation:{snapshot:inventory.observation.snapshot,startedAt:inventory.observation.startedAt,finishedAt:inventory.observation.finishedAt,isolation:inventory.observation.isolation,readOnly:inventory.observation.readOnly,authBoundary:inventory.observation.authBoundary},contentHash:inventoryHash,metadataComplete:inventory.metadataComplete,issueCount:inventory.issues.length,externalDependencyCount:inventory.externalDependencies.length},artifacts,
   usage:{fileCount:selected.length,inputBytes,verifiedCount:verified.length,unverifiedCount:selected.length-verified.length,verifiedBytes,metadataBytes:0},atomicSnapshotVerified:false,fullProjectCoverage:false,restorable:false};
  for(let i=0;i<17;i++){scope.check();const size=Buffer.byteLength(canonicalJson(result));if(size>request.limits.metadataBytes)limit();if(size===result.usage.metadataBytes){scope.check();return result;}result.usage.metadataBytes=size;}return invalid();
 }catch(error){return scope.normalize(error);}
}

/** 실제 조합에 포함된 원문의 현재 상태와 바이트만 확인한다. 전체 백업/복원은 아니다. */
export async function verifyProjectInventoryArtifacts(access:AccessRepository,token:string,value:unknown,reader:ArtifactByteReader,signal:AbortSignal,baselineContext?:{baselines:ProjectBaselines;csrf:string}){
 if(baselineContext!==undefined)return verifyFeatureProjectInventoryArtifacts(access,token,value,reader,signal,baselineContext);
 const request=readDocumentInventoryInput(value);let metadataBytes=0,inComposition=false;
 let scope:ReturnType<typeof currentScope>;
 const limit=():never=>scope.stop('PROJECT_ARTIFACT_INVENTORY_LIMIT',413),invalid=():never=>scope.stop('ARTIFACT_CURRENT_INTEGRITY_FAILED',503);
 const remainingMetadata=()=>{scope.check();const n=request.limits.metadataBytes-metadataBytes;if(n<1)limit();return n;};
 const charge=(n:number)=>{if(!integer(n,0)||n>request.limits.metadataBytes-metadataBytes)limit();metadataBytes+=n;};
 const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
 const artifactSql='SELECT id,project_id,draft_id,bytes,content_hash,media_type,storage_key,state,inspection_json FROM anvil.artifacts WHERE project_id=$1 AND id=$2';
 // 이 진입점의 RC만 감싼다. 기존 helper의 SQL/반환형과 다른 호출자는 바꾸지 않는다.
 const metered={pool:access.pool,authenticated:async<T>(given:string,csrf:string|null,operation:(db:PoolClient,a:AuthenticatedIdentity)=>Promise<T>):Promise<T>=>access.authenticated(given,csrf,async(db,a)=>{
  const proxy={query:async(sql:string,values:unknown[]=[])=>{
   if(!inComposition&&sql===artifactSql){const cap=remainingMetadata(),r=await db.query(`WITH inventory_row AS (${artifactSql} LIMIT 1) SELECT CASE WHEN octet_length(to_jsonb(inventory_row)::text)<=$3::bigint THEN to_jsonb(inventory_row) ELSE NULL END AS inventory_data,octet_length(to_jsonb(inventory_row)::text) AS row_bytes FROM inventory_row`,[...values,cap]);
    if(!Array.isArray(r.rows)||r.rows.length>1)invalid();const rows:Record<string,any>[]=[];for(const raw of r.rows){const e=data(raw,['inventory_data','row_bytes']);const n=typeof e.row_bytes==='string'&&/^[0-9]+$/.test(e.row_bytes)?Number(e.row_bytes):e.row_bytes;charge(n);if(!e.inventory_data)limit();rows.push(e.inventory_data);}return{...r,rows};
   }
   const r=await db.query(sql,values);if(!inComposition&&!sql.includes('set_config')){if(!Array.isArray(r.rows))invalid();charge(Buffer.byteLength(JSON.stringify(r.rows)));}return r;
  }}as unknown as PoolClient;return operation(proxy,a);
 })}as unknown as AccessRepository;
 scope=currentScope(metered,token,{projectId:request.projectId,deadlineMs:request.limits.deadlineMs},signal);
 try{
  await scope.boundary([]);let composition:Record<string,any>;
  try{inComposition=true;composition=await composeProjectInventory(scope.guardedAccess,token,{projectId:request.projectId,limits:{...request.limits,metadataBytes:remainingMetadata(),deadlineMs:scope.remaining()}},signal);}
  catch(error){const codes:Record<string,number>={PROJECT_INVENTORY_CANCELLED:409,PROJECT_INVENTORY_DEADLINE:413,PROJECT_INVENTORY_LIMIT:413,PROJECT_INVENTORY_REFERENCE_CONFLICT:503,PROJECT_INVENTORY_FAILED:503,INPUT_INVALID:400,AUTH_REQUIRED:401,NOT_FOUND:404};if(error instanceof AuthFailure&&codes[error.message]===error.statusCode)scope.stop(error.message,error.statusCode);scope.stop('PROJECT_INVENTORY_FAILED',503);}
  finally{inComposition=false;}
  charge(composition!.usage.metadataBytes);scope.check();await scope.boundary([]);
  const refs=new Map<string,Readonly<HistoryRef>>(),sources=new Map<string,string[]>(),messageRefs=new Map<string,{id:string;conversationId:string;contentHash:string}>(),blocked=new Map<string,Set<string>>(),initialQuarantine=new Set<string>();let inputBytes=0;
  if(composition!.kind!=='PROJECT_INVENTORY_COMPOSITION_V1'||composition!.projectId!==request.projectId||!Array.isArray(composition!.references)||!Array.isArray(composition!.components)||!Array.isArray(composition!.issues)||!Array.isArray(composition!.notCollected))invalid();
  for(const entry of composition!.references){scope.check();if(entry.projectId!==request.projectId)invalid();if(entry.namespace==='ARTIFACT'){
    const r=data(entry.ref,['artifactId','bytes','contentHash','mediaType']);if(!validUuid(r.artifactId)||!integer(r.bytes,0,20*1024*1024)||typeof r.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(r.contentHash)||typeof r.mediaType!=='string'||r.mediaType.length<1||r.mediaType.length>200||refs.has(r.artifactId)||!Array.isArray(entry.sources))invalid();
    if(refs.size>=request.limits.fileCount||inputBytes>request.limits.inputBytes-r.bytes)limit();inputBytes+=r.bytes;refs.set(r.artifactId,Object.freeze(r as HistoryRef));sources.set(r.artifactId,[...entry.sources]);
   }else if(entry.namespace==='CONVERSATION_MESSAGE'){
    const r=data(entry.ref,['id','contentHash']),sc=data(entry.scope,['conversationId']);if(!validUuid(r.id)||!validUuid(sc.conversationId)||typeof r.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(r.contentHash)||messageRefs.has(r.id))invalid();messageRefs.set(r.id,{id:r.id,conversationId:sc.conversationId,contentHash:r.contentHash});
   }}
  if(composition!.usage.fileCount!==refs.size||composition!.usage.inputBytes!==inputBytes)invalid();
  const block=(id:string,reason:string)=>{const reasons=blocked.get(id)??new Set<string>();reasons.add(reason);blocked.set(id,reasons);};
  for(const item of composition!.issues){const issue=item.issue;if(!issue||typeof issue.code!=='string')invalid();if(['ARTIFACT_NOT_READY','ARTIFACT_INSPECTION_UNKNOWN'].includes(issue.code)){const r=refs.get(issue.ref?.artifactId);if(!r||!same(r,issue.ref))invalid();block(r!.artifactId,issue.code);}else if(item.source==='Conversation'&&issue.code==='MESSAGE_QUARANTINED'){const m=messageRefs.get(issue.ref?.id);if(!m||issue.ref.kind!=='CONVERSATION'||m.contentHash!==issue.ref.contentHash)invalid();initialQuarantine.add(m!.id);}}
  const bindings=new Map<string,{messageId:string;conversationId:string;sequence:number;bodyRef:Readonly<HistoryRef>}>();
  async function currentMessages(wanted:readonly Readonly<HistoryRef>[]|null,initial=false){
   const ids=wanted===null?[...messageRefs.keys()]:[...bindings.values()].filter(m=>wanted.some(r=>r.artifactId===m.bodyRef.artifactId)).map(m=>m.messageId);if(!ids.length)return;ids.sort();
   await scope.guardedAccess.authenticated(token,null,async(db,actor)=>{
    async function query(sql:string,values:unknown[]=[]){scope.check();await db.query("SELECT set_config('statement_timeout',$1,true)",[String(Math.min(2147483647,scope.remaining()))]);scope.check();const r=await db.query(sql,values);scope.check();return r;}
    const iso=(await query("SELECT current_setting('transaction_isolation') AS isolation")).rows;if(iso.length!==1||iso[0]?.isolation!=='read committed')invalid();const member=await projectMember({query}as unknown as PoolClient,actor,request.projectId,false);if(member.id!==request.projectId||member.archived_at!==null||member.participation!=='OWNER')scope.stop('NOT_FOUND',404);
    const clock=(await query('SELECT clock_timestamp() AS at')).rows;if(clock.length!==1||!(clock[0]?.at instanceof Date)||!Number.isFinite(clock[0].at.getTime()))invalid();
    for(let i=0;i<ids.length;i+=200){const batch=ids.slice(i,i+200),cap=remainingMetadata(),result=await query(`WITH inventory_row AS (SELECT project_id,conversation_id,id,sequence,content_hash,body_artifact_id,message_json,redaction_state FROM anvil.conversation_messages WHERE project_id=$1 AND id=ANY($2::uuid[]) ORDER BY id LIMIT 200) SELECT CASE WHEN octet_length(to_jsonb(inventory_row)::text)<=$3::bigint THEN to_jsonb(inventory_row) ELSE NULL END AS inventory_data,octet_length(to_jsonb(inventory_row)::text) AS row_bytes FROM inventory_row ORDER BY inventory_row.id`,[request.projectId,batch,cap]);
     if(!Array.isArray(result.rows)||result.rows.length!==batch.length||result.rows.length>200)invalid();const seen=new Set<string>();for(const raw of result.rows){const envelope=data(raw,['inventory_data','row_bytes']),n=typeof envelope.row_bytes==='string'&&/^[0-9]+$/.test(envelope.row_bytes)?Number(envelope.row_bytes):envelope.row_bytes;if(!integer(n,1)||n>cap||!envelope.inventory_data)limit();const row=data(envelope.inventory_data,['project_id','conversation_id','id','sequence','content_hash','body_artifact_id','message_json','redaction_state']),expected=messageRefs.get(row.id);if(!expected||!batch.includes(row.id)||seen.has(row.id)||row.project_id!==request.projectId||row.conversation_id!==expected.conversationId||row.content_hash!==expected.contentHash)invalid();
      const sequence=typeof row.sequence==='string'&&/^[1-9][0-9]*$/.test(row.sequence)?Number(row.sequence):row.sequence;if(!integer(sequence,1))invalid();
      const snap=data(row.message_json,['conversationId','targetRoleRef','message','sourceRefs','serverSequence','authorRef']),author=data(snap.authorRef,['kind','userId']);const parsed=readConversationInput({conversationId:snap.conversationId,targetRoleRef:snap.targetRoleRef,message:snap.message,sourceRefs:snap.sourceRefs},request.projectId);if(snap.conversationId!==expected!.conversationId||snap.serverSequence!==sequence||author.kind!=='HUMAN'||!validUuid(author.userId)||contentHash(canonicalJson(snap))!==expected!.contentHash)invalid();
      const body=refs.get(parsed.message.bodyRef.artifactId);if(!body||row.body_artifact_id!==body.artifactId||!same(body,parsed.message.bodyRef))invalid();if(!['NOT_REDACTED','QUARANTINED'].includes(row.redaction_state))invalid();if(row.redaction_state==='QUARANTINED'&&!initialQuarantine.has(row.id))scope.stop('ARTIFACT_CURRENT_BLOCKED',412);
      if(initial){bindings.set(row.id,{messageId:row.id,conversationId:expected!.conversationId,sequence,bodyRef:body!});if(initialQuarantine.has(row.id))block(body!.artifactId,'MESSAGE_QUARANTINED');}else{const old=bindings.get(row.id);if(!old||old.sequence!==sequence||!same(old.bodyRef,body))invalid();}seen.add(row.id);
     }
    }
   });scope.check();
  }
  await currentMessages(null,true);
  const artifacts:Array<Record<string,any>>=[],verified:Readonly<Input>[]=[];let verifiedBytes=0;
  for(const r of refs.values()){scope.check();const reasonCodes=blocked.get(r.artifactId);if(reasonCodes){artifacts.push({ref:r,sources:sources.get(r.artifactId),status:'NOT_VERIFIED',reasonCodes:[...reasonCodes].sort(),sourceState:null,sourceInspectionStatus:null});continue;}
   await currentMessages([r]);const wanted=readInput({projectId:request.projectId,...r,maxBytes:request.limits.inputBytes,deadlineMs:scope.remaining()}),verification=await scope.verify(wanted,reader);charge(Buffer.byteLength(canonicalJson(verification)));verified.push(wanted);verifiedBytes+=wanted.bytes;artifacts.push({ref:r,sources:sources.get(r.artifactId),status:'VERIFIED',verification});
  }
  await currentMessages(verified);await scope.boundary(verified);scope.check();
  const result={kind:'PROJECT_INVENTORY_ARTIFACT_VERIFICATION_V1',projectId:request.projectId,composition:{compositionHash:composition!.compositionHash,observation:composition!.observation,components:composition!.components,issues:composition!.issues,notCollected:composition!.notCollected,dependencies:composition!.dependencies,limits:request.limits},artifacts,usage:{fileCount:refs.size,inputBytes,verifiedCount:verified.length,unverifiedCount:refs.size-verified.length,verifiedBytes,metadataBytes:0},atomicSnapshotVerified:false,fullProjectCoverage:false,restorable:false,authorizationRestoration:false,executionAuthorized:false,dispatchPerformed:false};
  for(let i=0;i<17;i++){scope.check();const size=metadataBytes+Buffer.byteLength(canonicalJson(result));if(size>request.limits.metadataBytes)limit();if(result.usage.metadataBytes===size)return result;result.usage.metadataBytes=size;}return invalid();
 }catch(error){return scope.normalize(error);}
}

async function verifyFeatureProjectInventoryArtifacts(access:AccessRepository,token:string,value:unknown,reader:ArtifactByteReader,signal:AbortSignal,baselineContext:{baselines:ProjectBaselines;csrf:string}){
 const request=readDocumentInventoryInput(value),started=performance.now(),requestDeadline=started+request.limits.deadlineMs;
 let capturedContext:{baselines:ProjectBaselines;csrf:string};try{capturedContext=Object.freeze(data(baselineContext,['baselines','csrf']) as {baselines:ProjectBaselines;csrf:string});}catch{throw new AuthFailure('INPUT_INVALID',400);}const rootRemaining=Math.floor(requestDeadline-performance.now());if(rootRemaining<1)throw new AuthFailure('ARTIFACT_CURRENT_DEADLINE',413);
 const envelope=await composeProjectInventoryForArtifactVerification(access,token,{projectId:request.projectId,limits:{...request.limits,deadlineMs:rootRemaining}},signal,capturedContext),constraints=envelope.readConstraints;
 let effectiveDeadline=Math.min(requestDeadline,constraints.deadlineMonotonicMs),metadataBytes=0,inComposition=false,cleanupUnknown=false;
 const owned=new WeakSet<AuthFailure>(),fail=(code='ARTIFACT_CURRENT_FAILED',status=503):never=>{const e=new AuthFailure(code,status);owned.add(e);throw e;};
 const check=()=>{if(cleanupUnknown)fail();if(signal.aborted)fail('ARTIFACT_CURRENT_CANCELLED',409);if(performance.now()>=effectiveDeadline)fail('ARTIFACT_CURRENT_DEADLINE',413);};
 const remaining=()=>Math.floor(Math.min(2147483647,effectiveDeadline-performance.now()));
 check();if(constraints.projectId!==request.projectId)fail('ARTIFACT_CURRENT_INTEGRITY_FAILED');
 const selectedAccess={pool:access.pool,authenticated:async<T>(given:string,csrf:string|null,operation:(db:PoolClient,a:AuthenticatedIdentity)=>Promise<T>):Promise<T>=>{
  check();if(given!==token||csrf!==null)fail('AUTH_REQUIRED',401);let db:PoolClient|undefined,released=false,began=false,unknown=false;
  const discard=()=>{if(!db||released)return;released=true;try{db.release(new Error('FEATURE_ARTIFACT_CONTEXT_UNKNOWN'));}catch{unknown=true;}};
  async function tracked<V>(pending:Promise<V>,cleanup=false):Promise<V>{return new Promise((resolve,reject)=>{let done=false;const clean=()=>{clearTimeout(timer);if(!cleanup)signal.removeEventListener('abort',stopPending);},stopPending=()=>{if(done)return;done=true;unknown=true;cleanupUnknown=true;clean();discard();try{fail();}catch(e){reject(e);}},timer=setTimeout(stopPending,Math.max(1,remaining()));if(!cleanup)signal.addEventListener('abort',stopPending,{once:true});pending.then(v=>{if(done)return;done=true;clean();resolve(v);},e=>{if(done)return;done=true;clean();reject(e);});if(remaining()<1||!cleanup&&signal.aborted)stopPending();});}
  async function acquire(){const pending=access.pool.connect();return new Promise<PoolClient>((resolve,reject)=>{let done=false;const clean=()=>{clearTimeout(timer);signal.removeEventListener('abort',stopPending);},stopPending=()=>{if(done)return;done=true;unknown=true;cleanupUnknown=true;clean();try{fail();}catch(e){reject(e);}},timer=setTimeout(stopPending,Math.max(1,remaining()));signal.addEventListener('abort',stopPending,{once:true});pending.then(client=>{if(done){try{client.release(new Error('FEATURE_ARTIFACT_CONTEXT_LATE'));}catch{}return;}done=true;clean();resolve(client);},()=>{if(done)return;done=true;clean();try{fail();}catch(e){reject(e);}});if(signal.aborted||remaining()<1)stopPending();});}
  async function q(sql:string,values:unknown[]=[]):Promise<any>{check();const timeout=Math.max(1,remaining());for(const name of ['statement_timeout','lock_timeout','idle_in_transaction_session_timeout']){await tracked(db!.query(`SELECT set_config('${name}',$1,true)`,[String(timeout)]));check();}const settings=(await tracked(db!.query("SELECT current_setting('statement_timeout') AS fn16_statement_timeout,current_setting('lock_timeout') AS fn16_lock_timeout,current_setting('idle_in_transaction_session_timeout') AS fn16_idle_timeout"))).rows[0],milliseconds=(v:unknown)=>{if(typeof v!=='string')return NaN;const m=/^([0-9]+)(ms|s|min|h|d)?$/.exec(v);return m?Number(m[1])*(m[2]==='s'?1000:m[2]==='min'?60000:m[2]==='h'?3600000:m[2]==='d'?86400000:1):NaN;};for(const k of ['fn16_statement_timeout','fn16_lock_timeout','fn16_idle_timeout'])if(!integer(milliseconds(settings?.[k]),1,timeout))fail();check();const result=await tracked(db!.query(sql,values));check();return result;}
  try{db=await acquire();check();began=true;await tracked(db.query('BEGIN ISOLATION LEVEL READ COMMITTED'));const port={query:q}as unknown as PoolClient,a=actorSnapshot(await access.authenticateInTransaction(port,token,capturedContext.csrf)),e=constraints.expectedIdentity;if(a.actorId!==e.actorId||a.clientId!==e.clientId||a.credentialGeneration!==e.credentialGeneration||a.authSession!.id!==e.sessionId)fail('AUTH_REQUIRED',401);
   const observe=async()=>{const iso=(await q("SELECT current_setting('transaction_isolation') AS isolation")).rows;if(iso.length!==1||iso[0]?.isolation!=='read committed')fail();const member=await projectMember(port,a,request.projectId,false);if(member.id!==request.projectId||member.archived_at!==null||member.participation!=='OWNER')fail('NOT_FOUND',404);const before=performance.now(),rows=(await q('SELECT clock_timestamp() AS at')).rows,at=rows.length===1?rows[0]?.at:null;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))fail();effectiveDeadline=Math.min(effectiveDeadline,notificationSessionDeadline(a,at,before));check();};
   await observe();const result=await operation(port,a);check();await observe();await tracked(db.query('COMMIT'));began=false;released=true;try{db.release();}catch{cleanupUnknown=true;fail();}check();return result;
  }catch(error){if(db&&!released){if(began)try{await tracked(db.query('ROLLBACK'),true);}catch{unknown=true;cleanupUnknown=true;}if(unknown)discard();else{released=true;try{db.release();}catch{unknown=true;cleanupUnknown=true;}}}if(unknown||cleanupUnknown)fail();if(error instanceof AuthFailure&&(owned.has(error)||error.message==='AUTH_REQUIRED'||error.message==='NOT_FOUND'))throw error;if(error instanceof AuthFailure&&error.message==='CSRF_INVALID')fail('AUTH_REQUIRED',401);return fail();}
 }}as unknown as AccessRepository;
 let scope:ReturnType<typeof currentScope>;
 const limit=():never=>scope.stop('PROJECT_ARTIFACT_INVENTORY_LIMIT',413),invalid=():never=>scope.stop('ARTIFACT_CURRENT_INTEGRITY_FAILED',503);
 const remainingMetadata=()=>{scope.check();const n=request.limits.metadataBytes-metadataBytes;if(n<1)limit();return n;};
 const charge=(n:number)=>{if(!integer(n,0)||n>request.limits.metadataBytes-metadataBytes)limit();metadataBytes+=n;};
 const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
 const artifactSql='SELECT id,project_id,draft_id,bytes,content_hash,media_type,storage_key,state,inspection_json FROM anvil.artifacts WHERE project_id=$1 AND id=$2';
 // 이 진입점의 RC만 감싼다. 기존 helper의 SQL/반환형과 다른 호출자는 바꾸지 않는다.
 const metered={pool:access.pool,authenticated:async<T>(given:string,csrf:string|null,operation:(db:PoolClient,a:AuthenticatedIdentity)=>Promise<T>):Promise<T>=>selectedAccess.authenticated(given,csrf,async(db,a)=>{
  const proxy={query:async(sql:string,values:unknown[]=[])=>{
   if(!inComposition&&sql===artifactSql){const cap=remainingMetadata(),r=await db.query(`WITH inventory_row AS (${artifactSql} LIMIT 1) SELECT CASE WHEN octet_length(to_jsonb(inventory_row)::text)<=$3::bigint THEN to_jsonb(inventory_row) ELSE NULL END AS inventory_data,octet_length(to_jsonb(inventory_row)::text) AS row_bytes FROM inventory_row`,[...values,cap]);
    if(!Array.isArray(r.rows)||r.rows.length>1)invalid();const rows:Record<string,any>[]=[];for(const raw of r.rows){const e=data(raw,['inventory_data','row_bytes']);const n=typeof e.row_bytes==='string'&&/^[0-9]+$/.test(e.row_bytes)?Number(e.row_bytes):e.row_bytes;charge(n);if(!e.inventory_data)limit();rows.push(e.inventory_data);}return{...r,rows};
   }
   const r=await db.query(sql,values);if(!inComposition&&!sql.includes('set_config')){if(!Array.isArray(r.rows))invalid();charge(Buffer.byteLength(JSON.stringify(r.rows)));}return r;
  }}as unknown as PoolClient;return operation(proxy,a);
 })}as unknown as AccessRepository;
 scope=currentScope(metered,token,{projectId:request.projectId,deadlineMs:Math.max(1,remaining())},signal,Object.freeze({check,remaining}));
 try{
  await scope.boundary([]);const composition:Record<string,any>=envelope.composition;
  const {compositionHash,usage,observation,...semantic}=composition;if(contentHash(canonicalJson(semantic))!==compositionHash)invalid();charge(composition!.usage.metadataBytes);scope.check();await scope.boundary([]);
  const refs=new Map<string,Readonly<HistoryRef>>(),sources=new Map<string,string[]>(),messageRefs=new Map<string,{id:string;conversationId:string;contentHash:string}>(),blocked=new Map<string,Set<string>>(),initialQuarantine=new Set<string>();let inputBytes=0;
  if(composition!.kind!=='PROJECT_INVENTORY_COMPOSITION_V1'||composition!.projectId!==request.projectId||!Array.isArray(composition!.references)||!Array.isArray(composition!.components)||!Array.isArray(composition!.issues)||!Array.isArray(composition!.notCollected))invalid();
  for(const entry of composition!.references){scope.check();if(entry.projectId!==request.projectId)invalid();if(entry.namespace==='ARTIFACT'){
    const r=data(entry.ref,['artifactId','bytes','contentHash','mediaType']);if(!validUuid(r.artifactId)||!integer(r.bytes,0,20*1024*1024)||typeof r.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(r.contentHash)||typeof r.mediaType!=='string'||r.mediaType.length<1||r.mediaType.length>200||refs.has(r.artifactId)||!Array.isArray(entry.sources))invalid();
    if(refs.size>=request.limits.fileCount||inputBytes>request.limits.inputBytes-r.bytes)limit();inputBytes+=r.bytes;refs.set(r.artifactId,Object.freeze(r as HistoryRef));sources.set(r.artifactId,[...entry.sources]);
   }else if(entry.namespace==='CONVERSATION_MESSAGE'){
    const r=data(entry.ref,['id','contentHash']),sc=data(entry.scope,['conversationId']);if(!validUuid(r.id)||!validUuid(sc.conversationId)||typeof r.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(r.contentHash)||messageRefs.has(r.id))invalid();messageRefs.set(r.id,{id:r.id,conversationId:sc.conversationId,contentHash:r.contentHash});
   }}
  if(composition!.usage.fileCount!==refs.size||composition!.usage.inputBytes!==inputBytes)invalid();
  const accounting=composition!.resourceAccounting,B=accounting?.baselineReadBytes,D=inputBytes;if(!integer(B)||!integer(accounting?.inputBudgetCharge)||accounting.inputBudgetCharge!==D+B||D+B>request.limits.inputBytes||composition!.usage.baselineReadBytes!==B||composition!.usage.inputBudgetCharge!==D+B||!integer(accounting.fileCountUpperBound,refs.size,request.limits.fileCount)||composition!.usage.fileCountUpperBound!==accounting.fileCountUpperBound)invalid();
  const block=(id:string,reason:string)=>{const reasons=blocked.get(id)??new Set<string>();reasons.add(reason);blocked.set(id,reasons);};
  for(const item of composition!.issues){const issue=item.issue;if(!issue||typeof issue.code!=='string')invalid();if(['ARTIFACT_NOT_READY','ARTIFACT_INSPECTION_UNKNOWN'].includes(issue.code)){const r=refs.get(issue.ref?.artifactId);if(!r||!same(r,issue.ref))invalid();block(r!.artifactId,issue.code);}else if(item.source==='Conversation'&&issue.code==='MESSAGE_QUARANTINED'){const m=messageRefs.get(issue.ref?.id);if(!m||issue.ref.kind!=='CONVERSATION'||m.contentHash!==issue.ref.contentHash)invalid();initialQuarantine.add(m!.id);}}
  const bindings=new Map<string,{messageId:string;conversationId:string;sequence:number;bodyRef:Readonly<HistoryRef>}>();
  async function currentMessages(wanted:readonly Readonly<HistoryRef>[]|null,initial=false){
   const ids=wanted===null?[...messageRefs.keys()]:[...bindings.values()].filter(m=>wanted.some(r=>r.artifactId===m.bodyRef.artifactId)).map(m=>m.messageId);if(!ids.length)return;ids.sort();
   await scope.guardedAccess.authenticated(token,null,async(db,actor)=>{
    async function query(sql:string,values:unknown[]=[]){scope.check();await db.query("SELECT set_config('statement_timeout',$1,true)",[String(Math.min(2147483647,scope.remaining()))]);scope.check();const r=await db.query(sql,values);scope.check();return r;}
    const iso=(await query("SELECT current_setting('transaction_isolation') AS isolation")).rows;if(iso.length!==1||iso[0]?.isolation!=='read committed')invalid();const member=await projectMember({query}as unknown as PoolClient,actor,request.projectId,false);if(member.id!==request.projectId||member.archived_at!==null||member.participation!=='OWNER')scope.stop('NOT_FOUND',404);
    const clock=(await query('SELECT clock_timestamp() AS at')).rows;if(clock.length!==1||!(clock[0]?.at instanceof Date)||!Number.isFinite(clock[0].at.getTime()))invalid();
    for(let i=0;i<ids.length;i+=200){const batch=ids.slice(i,i+200),cap=remainingMetadata(),result=await query(`WITH inventory_row AS (SELECT project_id,conversation_id,id,sequence,content_hash,body_artifact_id,message_json,redaction_state FROM anvil.conversation_messages WHERE project_id=$1 AND id=ANY($2::uuid[]) ORDER BY id LIMIT 200) SELECT CASE WHEN octet_length(to_jsonb(inventory_row)::text)<=$3::bigint THEN to_jsonb(inventory_row) ELSE NULL END AS inventory_data,octet_length(to_jsonb(inventory_row)::text) AS row_bytes FROM inventory_row ORDER BY inventory_row.id`,[request.projectId,batch,cap]);
     if(!Array.isArray(result.rows)||result.rows.length!==batch.length||result.rows.length>200)invalid();const seen=new Set<string>();for(const raw of result.rows){const envelope=data(raw,['inventory_data','row_bytes']),n=typeof envelope.row_bytes==='string'&&/^[0-9]+$/.test(envelope.row_bytes)?Number(envelope.row_bytes):envelope.row_bytes;if(!integer(n,1)||n>cap||!envelope.inventory_data)limit();const row=data(envelope.inventory_data,['project_id','conversation_id','id','sequence','content_hash','body_artifact_id','message_json','redaction_state']),expected=messageRefs.get(row.id);if(!expected||!batch.includes(row.id)||seen.has(row.id)||row.project_id!==request.projectId||row.conversation_id!==expected.conversationId||row.content_hash!==expected.contentHash)invalid();
      const sequence=typeof row.sequence==='string'&&/^[1-9][0-9]*$/.test(row.sequence)?Number(row.sequence):row.sequence;if(!integer(sequence,1))invalid();
      const snap=data(row.message_json,['conversationId','targetRoleRef','message','sourceRefs','serverSequence','authorRef']),author=data(snap.authorRef,['kind','userId']);const parsed=readConversationInput({conversationId:snap.conversationId,targetRoleRef:snap.targetRoleRef,message:snap.message,sourceRefs:snap.sourceRefs},request.projectId);if(snap.conversationId!==expected!.conversationId||snap.serverSequence!==sequence||author.kind!=='HUMAN'||!validUuid(author.userId)||contentHash(canonicalJson(snap))!==expected!.contentHash)invalid();
      const body=refs.get(parsed.message.bodyRef.artifactId);if(!body||row.body_artifact_id!==body.artifactId||!same(body,parsed.message.bodyRef))invalid();if(!['NOT_REDACTED','QUARANTINED'].includes(row.redaction_state))invalid();if(row.redaction_state==='QUARANTINED'&&!initialQuarantine.has(row.id))scope.stop('ARTIFACT_CURRENT_BLOCKED',412);
      if(initial){bindings.set(row.id,{messageId:row.id,conversationId:expected!.conversationId,sequence,bodyRef:body!});if(initialQuarantine.has(row.id))block(body!.artifactId,'MESSAGE_QUARANTINED');}else{const old=bindings.get(row.id);if(!old||old.sequence!==sequence||!same(old.bodyRef,body))invalid();}seen.add(row.id);
     }
    }
   });scope.check();
  }
  await currentMessages(null,true);
  const artifacts:Array<Record<string,any>>=[],verified:Readonly<Input>[]=[];let verifiedBytes=0;
  for(const r of refs.values()){scope.check();const reasonCodes=blocked.get(r.artifactId);if(reasonCodes){artifacts.push({ref:r,sources:sources.get(r.artifactId),status:'NOT_VERIFIED',reasonCodes:[...reasonCodes].sort(),sourceState:null,sourceInspectionStatus:null});continue;}
   check();if(verifiedBytes+r.bytes>request.limits.inputBytes-B)limit();await currentMessages([r]);const wanted=readInput({projectId:request.projectId,...r,maxBytes:request.limits.inputBytes-B,deadlineMs:Math.min(scope.remaining(),Math.max(1,remaining()))}),verification=await scope.verify(wanted,reader);charge(Buffer.byteLength(canonicalJson(verification)));verified.push(wanted);verifiedBytes+=wanted.bytes;artifacts.push({ref:r,sources:sources.get(r.artifactId),status:'VERIFIED',verification});
  }
  await currentMessages(verified);await scope.boundary(verified);scope.check();check();if(verifiedBytes>D||B+verifiedBytes>request.limits.inputBytes)limit();
  const result={kind:'PROJECT_INVENTORY_ARTIFACT_VERIFICATION_V1',projectId:request.projectId,composition:{compositionHash:composition!.compositionHash,observation:composition!.observation,components:composition!.components,issues:composition!.issues,notCollected:composition!.notCollected,dependencies:composition!.dependencies,limits:request.limits,resourceAccounting:composition!.resourceAccounting},phaseAccounting:{declaredInputBytes:D,baselineReadBytes:B,verifiedUniqueBytes:verifiedBytes,totalReadBytes:B+verifiedBytes,fileCountUpperBound:accounting.fileCountUpperBound,meaning:'ROOT_BASELINE_REPEATED_PLUS_FOLLOWUP_UNIQUE_READS_SERIAL'},artifacts,usage:{fileCount:refs.size,inputBytes,verifiedCount:verified.length,unverifiedCount:refs.size-verified.length,verifiedBytes,metadataBytes:0},atomicSnapshotVerified:false,fullProjectCoverage:false,restorable:false,authorizationRestoration:false,executionAuthorized:false,dispatchPerformed:false};
  for(let i=0;i<17;i++){scope.check();const size=metadataBytes+Buffer.byteLength(canonicalJson(result));if(size>request.limits.metadataBytes)limit();check();if(result.usage.metadataBytes===size){scope.check();check();return result;}result.usage.metadataBytes=size;}return invalid();
 }catch(error){if(cleanupUnknown)fail();if(error instanceof AuthFailure&&owned.has(error))throw error;return scope.normalize(error);}
}
