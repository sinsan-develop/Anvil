import {types} from 'node:util';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,refV1,uuidV1,hashV1,isoV1,cloneV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {isRelativeSourceFileV1} from '../../../../contracts/runtime/source-scope-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import type {ProjectCommand} from '../access/project-command.ts';
import {isImportArtifact,type ImportArtifact} from './project-imports.ts';
export const SOURCE_EVENT_BYTES=65536,SOURCE_EVENT_ROWS=10000,SOURCE_EVENT_PROJECT_BYTES=67108864;
function fail(code='DOCUMENT_SOURCE_OBSERVATION_UNAVAILABLE',status=412):never{throw new AuthFailure(code,status);}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
export interface ObservationScope {projectId:string;documentRef:Ref;sourceRootId:string;relativePath:string;actorId:string;clientId:string;humanSessionId:string;controlGeneration:number}
export interface ObservationSnapshot {scope:ObservationScope;sourceRootRef:Ref;sourceSnapshotRef:Ref;blobHash:string;artifactRef:ImportArtifact|null;registrationRef:Ref;connectorRef:Ref;proofRef:Ref;observedAt:string;expiresAt:string}
export interface ObservationRecord {ref:Ref;snapshot:ObservationSnapshot}
/** 서버 소유 보호 공급자. 보고 JSON/OS UNVERIFIED를 이 포트로 변환하는 기본 adapter는 없다.
 * read/current는 원 권한·실제 관측 증거의 생산 책임을 가진다. hash는 해당 책임을 대체하지 않는다. */
export interface DocumentSourceObservationPort {
 read(db:PoolClient,actor:AuthenticatedIdentity,scope:Readonly<ObservationScope>,snapshotRef:Readonly<Ref>,signal:AbortSignal):Promise<unknown>;
 current(db:PoolClient,actor:AuthenticatedIdentity,record:Readonly<ObservationRecord>,signal:AbortSignal):Promise<unknown>;
}
function copy(value:unknown,depth=0):unknown{
 if(depth>12)fail('DOCUMENT_SOURCE_OBSERVATION_INVALID',503);
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number')return value;
 if(!value||typeof value!=='object'||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype||Object.getOwnPropertySymbols(value).length)fail('DOCUMENT_SOURCE_OBSERVATION_INVALID',503);
 const d=Object.getOwnPropertyDescriptors(value);if(Object.values(d).some(p=>!p.enumerable||!('value'in p)))fail('DOCUMENT_SOURCE_OBSERVATION_INVALID',503);
 return Object.fromEntries(Object.entries(d).map(([k,p])=>[k,copy(p.value,depth+1)]));
}
function data(value:unknown,keys:string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype)fail('DOCUMENT_SOURCE_OBSERVATION_INVALID',503);
 const descriptors=Object.getOwnPropertyDescriptors(value);
 if(Object.keys(descriptors).sort().join(',')!==[...keys].sort().join(',')||Object.values(descriptors).some(d=>!('value'in d)))fail('DOCUMENT_SOURCE_OBSERVATION_INVALID',503);
 return Object.fromEntries(keys.map(k=>[k,descriptors[k]!.value]));
}
function freeze<T>(v:T):T{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
/** 외부 포트 값은 descriptor snapshot 외의 원객체에서 재읽지 않는다. 원문 bytes는 포함하지 않는다. */
export function readDocumentObservation(raw:unknown,scope:ObservationScope,snapshotRef:Ref):ObservationRecord{
 const wrapper=data(copy(raw),['ref','snapshot']),s=data(wrapper.snapshot,['scope','sourceRootRef','sourceSnapshotRef','blobHash','artifactRef','registrationRef','connectorRef','proofRef','observedAt','expiresAt']);
 const observedScope=data(s.scope,['projectId','documentRef','sourceRootId','relativePath','actorId','clientId','humanSessionId','controlGeneration']);
 if(!recordV1(observedScope,Object.keys(scope))||!same(observedScope,scope)||!refV1(wrapper.ref)||!refV1(s.sourceRootRef)||s.sourceRootRef.id!==scope.sourceRootId||!refV1(s.sourceSnapshotRef)||!same(s.sourceSnapshotRef,snapshotRef)||!hashV1(s.blobHash)||!refV1(s.registrationRef)||!refV1(s.connectorRef)||!refV1(s.proofRef)||!isoV1(s.observedAt)||!isoV1(s.expiresAt)||Date.parse(s.observedAt)>=Date.parse(s.expiresAt))fail('DOCUMENT_SOURCE_OBSERVATION_INVALID',503);
 if(s.artifactRef!==null){const a=data(s.artifactRef,['artifactId','bytes','contentHash','mediaType']);if(!isImportArtifact(a)||a.contentHash!==s.blobHash)fail('DOCUMENT_SOURCE_OBSERVATION_INVALID',503);s.artifactRef=a;}
 s.scope=observedScope;
 if(contentHash(canonicalJson(s))!==wrapper.ref.contentHash)fail('DOCUMENT_SOURCE_OBSERVATION_INVALID',503);
 const snapshot:ObservationSnapshot={scope:cloneV1(scope),sourceRootRef:s.sourceRootRef,sourceSnapshotRef:s.sourceSnapshotRef,blobHash:s.blobHash,artifactRef:s.artifactRef as ImportArtifact|null,registrationRef:s.registrationRef,connectorRef:s.connectorRef,proofRef:s.proofRef,observedAt:s.observedAt,expiresAt:s.expiresAt};
 return freeze(cloneV1({ref:wrapper.ref,snapshot}));
}
export interface ObservationLease {readonly signal:AbortSignal;check():void;remaining():number;narrow(expiresAt:string):void;close():void}
export function observationLease(actor:AuthenticatedIdentity,policyUntil:number):ObservationLease{
 const started=performance.now(),wall=Date.now(),session=actor.authSession,controller=new AbortController();let active=true;
 if(!session||!isoV1(session.idleExpiresAt)||!isoV1(session.absoluteExpiresAt))fail();
 let end=Math.min(started+10000,started+Math.min(policyUntil,Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt))-wall),wallEnd=wall+end-started;
 const check=()=>{const mono=performance.now(),now=Math.max(Date.now(),wall+mono-started);end=Math.min(end,mono+wallEnd-now);if(!active||!Number.isFinite(end)||mono>=end||controller.signal.aborted)fail('DOCUMENT_SOURCE_OBSERVATION_EXPIRED',409);};
 return {signal:controller.signal,check,remaining:()=>{check();return Math.max(0,end-performance.now());},narrow:(expiresAt)=>{if(!isoV1(expiresAt))fail();wallEnd=Math.min(wallEnd,Date.parse(expiresAt));end=Math.min(end,started+wallEnd-wall);check();},close:()=>{active=false;controller.abort();}};
}
export class DocumentSourceObservations {
 readonly #source:DocumentSourceObservationPort|undefined;
 constructor(source?:DocumentSourceObservationPort){this.#source=source;}
 require(){if(!this.#source||types.isProxy(this.#source))fail();return this.#source;}
 async observe(db:PoolClient,actor:AuthenticatedIdentity,scope:ObservationScope,snapshotRef:Ref,lease:ObservationLease):Promise<ObservationRecord>{
  const source=this.require();
  if(!uuidV1(scope.projectId)||!refV1(scope.documentRef)||!uuidV1(scope.sourceRootId)||!isRelativeSourceFileV1(scope.relativePath)||!refV1(snapshotRef))fail('DOCUMENT_SOURCE_LINK_INPUT_INVALID',422);
  const method=<K extends 'read'|'current'>(name:K):DocumentSourceObservationPort[K]=>{const d=Object.getOwnPropertyDescriptor(source,name);if(!d||!('value'in d)||typeof d.value!=='function')fail();return d.value as DocumentSourceObservationPort[K];};
  const read=method('read'),current=method('current');
  const stable=()=>{lease.check();if(this.#source!==source||method('read')!==read||method('current')!==current)fail();};
  const wait=async<T>(work:Promise<T>)=>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new AuthFailure('DOCUMENT_SOURCE_OBSERVATION_EXPIRED',409)),lease.remaining());})]);}finally{if(timer)clearTimeout(timer);}};
  let active=true;const pending=new Set<Promise<unknown>>();
  const query=(...args:unknown[])=>{try{stable();if(!active)fail();const work=Promise.resolve(Reflect.apply(db.query,db,args));pending.add(work);void work.then(()=>pending.delete(work),()=>pending.delete(work));const result=work.then(value=>{stable();if(!active)fail();return value;});void result.catch(()=>{});return result;}catch(error){const rejected=Promise.reject(error);void rejected.catch(()=>{});return rejected;}};
  const owned=Object.freeze({query}) as unknown as PoolClient;
  try{stable();let raw:unknown;try{raw=await wait(read.call(source,owned,actor,freeze(cloneV1(scope)),freeze(cloneV1(snapshotRef)),lease.signal));}catch(e){if(e instanceof AuthFailure)throw e;return fail();}
  stable();const record=readDocumentObservation(raw,scope,snapshotRef);lease.narrow(record.snapshot.expiresAt);
  if(Date.parse(record.snapshot.expiresAt)<=Date.now())fail('DOCUMENT_SOURCE_OBSERVATION_EXPIRED',409);
  const now=await wait(current.call(source,owned,actor,record,lease.signal));stable();
  if(!same(readDocumentObservation(now,scope,snapshotRef),record)||Date.parse(record.snapshot.expiresAt)<=Date.now())fail('DOCUMENT_SOURCE_OBSERVATION_CHANGED',409);
  return record;
  }finally{active=false;while(pending.size)await Promise.allSettled([...pending]);}
 }
}
export interface SourceChoiceSnapshot {projectId:string;sourceLinkRef:Ref;observation:ObservationRecord;choice:'KEEP_SERVER'|'COLLECT_PROPOSAL'|null;reason:string;previousRef:Ref|null;proposalId:string|null;importId:string|null;recordedAt:string}
export function sourceChoiceRecord(id:string,version:number,snapshot:SourceChoiceSnapshot){
 if(!uuidV1(id)||!Number.isSafeInteger(version)||version<1||!isoV1(snapshot.recordedAt)||Buffer.byteLength(canonicalJson(snapshot))>SOURCE_EVENT_BYTES)fail('DOCUMENT_SOURCE_EVENT_LIMIT',429);
 return freeze(cloneV1({ref:{id,version,contentHash:contentHash(canonicalJson(snapshot))},snapshot}));
}

/** 신규 SourceLinkEvent만 64KiB다. 기존 공통 domain 행의 유효 입력 한도는 줄이지 않는다.
 * M은 normalized 계획 S의 최대4회 payload 복제+고정 10행 envelope 선예약이다.
 * 실제 SQL collector의 table별 행/slot 대조 없이 이 계산만으로 정산하지 않는다. */
export function sourceEventQuotaPart(operation:'linkDocumentSource'|'proposeDocumentSourceChange',id:string,projection:unknown,diffBytes=0){
 if(!projection||typeof projection!=='object'||types.isProxy(projection)||!recordV1(projection,['link','record','candidate','proposal'])||!uuidV1(id)||!Number.isSafeInteger(diffBytes)||diffBytes<0||diffBytes>20971520||operation==='linkDocumentSource'&&diffBytes!==0)fail('DOCUMENT_SOURCE_EVENT_LIMIT',429);
 if(projection.record===null||Buffer.byteLength(canonicalJson(projection.record))>SOURCE_EVENT_BYTES)fail('DOCUMENT_SOURCE_EVENT_LIMIT',429);
 const plannedBytes=Buffer.byteLength(canonicalJson(projection)),metadataReservation=4*plannedBytes+10*SOURCE_EVENT_BYTES;
 if(!Number.isSafeInteger(metadataReservation)||metadataReservation+diffBytes*2>10737418240)fail('DOCUMENT_SOURCE_EVENT_LIMIT',429);
 return{key:operation==='linkDocumentSource'?'source_link':'source_choice',kind:'SOURCE_LINK_EVENT' as const,id,bytes:String(metadataReservation+diffBytes),contentHash:contentHash(canonicalJson(projection)),reservedBytes:String(metadataReservation+diffBytes*2),settledBytes:'0'};
}
