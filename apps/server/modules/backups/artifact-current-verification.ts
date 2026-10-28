import type {PoolClient} from 'pg';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {verifyArtifactBytes,type ArtifactByteReader,type ArtifactByteVerification} from './artifact-byte-verification.ts';

import {collectDocumentInventory} from './document-inventory.ts';
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
function currentScope(access:AccessRepository,token:string,input:{projectId:string;deadlineMs:number},signal:AbortSignal){
 const started=performance.now();let authDeadline=Infinity,identity:AuthenticatedIdentity|undefined;
 const known=new WeakSet<AuthFailure>();
 const stop=(code:string,status:number):never=>{const e=fail(code,status);known.add(e);throw e;};
 const check=()=>{if(signal.aborted)stop('ARTIFACT_CURRENT_CANCELLED',409);if(performance.now()-started>=input.deadlineMs||performance.now()>=authDeadline)stop('ARTIFACT_CURRENT_DEADLINE',413);};
 const remaining=()=>{check();const n=Math.floor(Math.min(input.deadlineMs-(performance.now()-started),authDeadline-performance.now()));if(n<1)stop('ARTIFACT_CURRENT_DEADLINE',413);return Math.min(Number.MAX_SAFE_INTEGER,n);};
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
  const codes:Record<string,number>={AUTH_REQUIRED:401,NOT_FOUND:404,DOCUMENT_INVENTORY_CANCELLED:409,DOCUMENT_INVENTORY_DEADLINE:413,DOCUMENT_INVENTORY_LIMIT:413,DOCUMENT_INVENTORY_INTEGRITY_FAILED:503,DOCUMENT_INVENTORY_STORAGE_FAILED:503,DOCUMENT_INVENTORY_SOURCE_CHANGED:503,DOCUMENT_INVENTORY_SENSITIVE_METADATA:503};
  if(error instanceof AuthFailure&&codes[error.message]===error.statusCode){
   if(guardFailure&&error.message!=='DOCUMENT_INVENTORY_STORAGE_FAILED')throw guardFailure;
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
