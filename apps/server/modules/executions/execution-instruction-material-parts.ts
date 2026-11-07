import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {assertKnowledgeTextSafe} from '../knowledge/knowledge-entry.ts';
import type {SyntheticChallengeScope as Scope} from './execution-challenges.ts';
import type {SyntheticRegisteredInstructionParts} from './execution-instruction-material-basis.ts';
import type {SyntheticInstructionPartReader} from './execution-instruction-material-store.ts';
import {readSyntheticInstructionQueueRecord,type SyntheticInstructionQueueRecord} from './execution-instruction-queue.ts';

interface SourceBinding {sourceRef:Ref;bodyRef:Ref;partsRef:Ref;originRef:Ref;contentHash:string;sourceBytes:number;mediaType:'text/plain'|'application/json'}
interface Part {materialId:string;partIndex:number;byteOffset:number;utf8Bytes:number;contentHash:string}
interface MaterialSnapshot {projectId:string;executionId:string;executionGeneration:number;commandId:string;envelopeHash:string;payloadRef:Ref;sourceRef:Ref;partIndex:number;partCount:number;byteOffset:number;sourceBytes:number;utf8Bytes:number;contentHash:string;mediaType:'text/plain'|'application/json'}
/** 내부 합성 조회 결과다. 지속 등록 schema나 새 등록/원문 권한을 정의하지 않는다. */
export interface SyntheticInstructionMaterialRegistration {
 scope:Scope;command:SyntheticInstructionQueueRecord;material:{ref:Ref;snapshot:MaterialSnapshot};manifestRef:Ref;source:SourceBinding;parts:Part[];registeredAt:string;expiresAt:string;
}
export interface SyntheticInstructionMaterialRepository {
 readonly transport:'SYNTHETIC_ONLY';
 /** caller tx의 현재 시각과 정확 등록만 읽는다. 새 등록/명령/권한·별도 tx는 만들지 않는다. */
 clock(db:PoolClient):Promise<string>;
 findByCommand(db:PoolClient,scope:Scope,commandId:string,materialId:string):Promise<unknown>;
 findByRef(db:PoolClient,scope:Scope,materialRef:Ref):Promise<unknown>;
}
interface SourceSelection {
 commandRef:Ref;manifestRef:Ref;source:SourceBinding;
 basis:{subject:SyntheticInstructionQueueRecord['snapshot']['currentBinding']['grantSubject'];permissionPolicyRef:Ref;basisRefs:Ref[];latestInstructionRefs:SyntheticInstructionQueueRecord['snapshot']['currentBinding']['fact']['latestInstructionRefs'];instructionRef:Ref};
}
export interface SyntheticInstructionMaterialSource {
 readonly transport:'SYNTHETIC_ONLY';
 /** 같은 scope의 source·origin·접근/격리/정정/제외 및 basis를 매번 재조회한다.
  * 응답은 SourceSelection + scope/access/quarantined/superseded/excluded/checkedAt/expiresAt다. */
 current(db:PoolClient,scope:Scope,selection:SourceSelection):Promise<unknown>;
 /** 등록된 exact bodyRef에 결박한 합성 bytes만 읽는다. 실제 원문/파일 reader를 주입하지 않는다. */
 readBody(db:PoolClient,scope:Scope,selection:SourceSelection):Promise<Uint8Array>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0,limit=2097152;
const reject=():never=>{throw new AuthFailure('INSTRUCTION_MATERIAL_PARTS_REJECTED',412);};
const sourceKeys=['sourceRef','bodyRef','partsRef','originRef','contentHash','sourceBytes','mediaType'];
const materialKeys=['projectId','executionId','executionGeneration','commandId','envelopeHash','payloadRef','sourceRef','partIndex','partCount','byteOffset','sourceBytes','utf8Bytes','contentHash','mediaType'];
function readScope(raw:unknown):Scope {
 if(!recordV1(raw,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||raw.mode!=='EXECUTION'||![raw.projectId,raw.connectorId,raw.executionId].every(uuidV1)||!positive(raw.executionGeneration)||!positive(raw.credentialGeneration)||!refV1(raw.grantRef))return reject();
 return cloneV1(raw) as Scope;
}
function registration(raw:unknown,scope:Scope,now:number):SyntheticInstructionMaterialRegistration {
 if(!recordV1(raw,['scope','command','material','manifestRef','source','parts','registeredAt','expiresAt'])||!same(raw.scope,scope)||!refV1(raw.manifestRef)||!isoV1(raw.registeredAt)||!isoV1(raw.expiresAt)||Date.parse(raw.registeredAt)>now||Date.parse(raw.expiresAt)<=now||Buffer.byteLength(canonicalJson(raw))>limit)return reject();
 const command=readSyntheticInstructionQueueRecord(raw.command,{projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration}),b=command.snapshot.currentBinding,e=command.snapshot.envelope,s=raw.source,m=raw.material;
 if(e.operation!=='SEND_INSTRUCTION'||Math.min(Date.parse(command.snapshot.expiresAt),Date.parse(b.grantExpiresAt),...Object.values(b.fact.expires).map(Date.parse))<=now||!same(b.grantRef,scope.grantRef)||b.fact.registration.connectorId!==scope.connectorId||b.grantSubject.credentialGeneration!==scope.credentialGeneration||!same(raw.manifestRef,b.materialManifestRef)||!recordV1(s,sourceKeys)||![s.sourceRef,s.bodyRef,s.partsRef,s.originRef].every(refV1)||!same(s.partsRef,b.partsRef)||!hashV1(s.contentHash)||!positive(s.sourceBytes)||s.sourceBytes>limit||!['text/plain','application/json'].includes(s.mediaType)||!recordV1(m,['ref','snapshot'])||!refV1(m.ref)||m.ref.version!==1||!recordV1(m.snapshot,materialKeys)||m.ref.contentHash!==hash(m.snapshot))return reject();
 const d=m.snapshot;
 // 등록 source/부분과 기존 wire descriptor의 결박만 확인한다. 소비자의 proof/정책 검사는 그대로 남는다.
 if(d.projectId!==scope.projectId||d.executionId!==scope.executionId||d.executionGeneration!==scope.executionGeneration||d.commandId!==e.commandId||d.envelopeHash!==e.envelopeHash||!refV1(d.payloadRef)||!same(d.payloadRef,b.instructionRef)&&!same(d.payloadRef,b.partsRef)||same(d.payloadRef,b.sessionBindingRef)||!same(d.sourceRef,s.sourceRef)||d.sourceBytes!==s.sourceBytes||d.mediaType!==s.mediaType||!arrayV1(raw.parts,200)||raw.parts.length<1||d.partCount!==raw.parts.length)return reject();
 const ids=new Set<string>();let offset=0;
 for(const [i,p] of raw.parts.entries()){
  if(!recordV1(p,['materialId','partIndex','byteOffset','utf8Bytes','contentHash'])||!uuidV1(p.materialId)||ids.has(p.materialId)||p.partIndex!==i+1||p.byteOffset!==offset||!positive(p.utf8Bytes)||p.utf8Bytes>limit||!hashV1(p.contentHash))return reject();
  ids.add(p.materialId);offset+=p.utf8Bytes;if(offset>s.sourceBytes)return reject();
 }
 const part=raw.parts.find(p=>p.materialId===m.ref.id);
 if(offset!==s.sourceBytes||!part||d.partIndex!==part.partIndex||d.byteOffset!==part.byteOffset||d.utf8Bytes!==part.utf8Bytes||d.contentHash!==part.contentHash)return reject();
 return cloneV1({...raw,command}) as SyntheticInstructionMaterialRegistration;
}
function selection(r:SyntheticInstructionMaterialRegistration):SourceSelection {
 const b=r.command.snapshot.currentBinding,f=b.fact;
 return cloneV1({commandRef:r.command.ref,manifestRef:r.manifestRef,source:r.source,basis:{subject:b.grantSubject,permissionPolicyRef:f.permissionPolicyRef,basisRefs:f.basisRefs,latestInstructionRefs:f.latestInstructionRefs,instructionRef:b.instructionRef}});
}
function readSource(raw:unknown,r:SyntheticInstructionMaterialRegistration,scope:Scope,now:number){
 if(!recordV1(raw,['scope','commandRef','manifestRef','source','basis','access','quarantined','superseded','excluded','checkedAt','expiresAt'])||!same(raw.scope,scope)||!same({commandRef:raw.commandRef,manifestRef:raw.manifestRef,source:raw.source,basis:raw.basis},selection(r))||raw.access!=='READ'||raw.quarantined!==false||raw.superseded!==false||raw.excluded!==false||!isoV1(raw.checkedAt)||!isoV1(raw.expiresAt)||Date.parse(raw.checkedAt)>now||now-Date.parse(raw.checkedAt)>30000||Date.parse(raw.expiresAt)<=now)return reject();
 return cloneV1(raw);
}
/** 명시 합성 repository/source를 기존 두 소비 interface에 연결한다. transport 표시는 테스트
 * 제약이며 실제 DB·등록·접근 권위가 아니다. 기본 app/SQL/파일/Agent 연결은 제공하지 않는다.
 * 인증/proof/정책·basis/store의 전후 검사는 기존 소비자가 계속 소유한다. */
export class SyntheticInstructionMaterialParts implements SyntheticRegisteredInstructionParts,SyntheticInstructionPartReader {
 readonly transport='SYNTHETIC_ONLY' as const;
 readonly repository:SyntheticInstructionMaterialRepository;readonly source:SyntheticInstructionMaterialSource;
 constructor(repository:SyntheticInstructionMaterialRepository,source:SyntheticInstructionMaterialSource){this.repository=repository;this.source=source;this.#ports();}
 #ports(){if(this.repository?.transport!=='SYNTHETIC_ONLY'||typeof this.repository.clock!=='function'||typeof this.repository.findByCommand!=='function'||typeof this.repository.findByRef!=='function'||this.source?.transport!=='SYNTHETIC_ONLY'||typeof this.source.current!=='function'||typeof this.source.readBody!=='function')reject();}
 async #clock(db:PoolClient){this.#ports();const raw=await this.repository.clock(db);this.#ports();if(!isoV1(raw))return reject();return Date.parse(raw);}
 async #resolve(db:PoolClient,rawScope:Scope,lookup:(scope:Scope)=>Promise<unknown>,check:(r:SyntheticInstructionMaterialRegistration,now:number)=>void,read:boolean){
  this.#ports();const scope=readScope(rawScope);
  const registered=async()=>{const arg=cloneV1(scope),raw=await lookup(arg);this.#ports();if(!same(arg,scope))return reject();const now=await this.#clock(db),r=registration(raw,scope,now);check(r,now);return{r,now};};
  const source=async(r:SyntheticInstructionMaterialRegistration)=>{const arg=cloneV1(scope),sel=selection(r),saved=cloneV1(sel),raw=await this.source.current(db,arg,sel);this.#ports();if(!same(arg,scope)||!same(sel,saved))return reject();return readSource(raw,r,scope,await this.#clock(db));};
  const deadline=(r:SyntheticInstructionMaterialRegistration,s:ReturnType<typeof readSource>)=>Math.min(Date.parse(r.expiresAt),Date.parse(s.expiresAt),Date.parse(s.checkedAt)+30000,Date.parse(r.command.snapshot.expiresAt),Date.parse(r.command.snapshot.currentBinding.grantExpiresAt),...Object.values(r.command.snapshot.currentBinding.fact.expires).map(Date.parse));
  const first=await registered(),before=await source(first.r);let bytes:Uint8Array|undefined;
  if(read){
   if(deadline(first.r,before)<=await this.#clock(db))return reject();
   const arg=cloneV1(scope),sel=selection(first.r),saved=cloneV1(sel),raw=await this.source.readBody(db,arg,sel);this.#ports();
   if(!same(arg,scope)||!same(sel,saved)||!(raw instanceof Uint8Array)||raw.byteLength!==first.r.source.sourceBytes)return reject();
   const body=Buffer.from(raw);if(contentHash(body)!==first.r.source.contentHash)return reject();
   for(const p of first.r.parts){const part=body.subarray(p.byteOffset,p.byteOffset+p.utf8Bytes);if(contentHash(part)!==p.contentHash)return reject();assertKnowledgeTextSafe(new TextDecoder('utf-8',{fatal:true}).decode(part));}
   const d=first.r.material.snapshot;bytes=new Uint8Array(body.subarray(d.byteOffset,d.byteOffset+d.utf8Bytes));
  }
  const last=await registered(),after=await source(last.r),now=await this.#clock(db);
  const{checkedAt:_,...stableBefore}=before,{checkedAt:__,...stableAfter}=after;
  if(!same(first.r,last.r)||!same(stableBefore,stableAfter)||Math.min(deadline(first.r,before),deadline(last.r,after))<=now)return reject();check(last.r,now);this.#ports();
  return{material:cloneV1(last.r.material),bytes};
 }
 async current(db:PoolClient,actor:AuthenticatedIdentity,scope:Scope,command:SyntheticInstructionQueueRecord,materialId:string){
  try{
   if(!uuidV1(materialId))return reject();const saved=cloneV1(command),subject=cloneV1(actor);
   const result=await this.#resolve(db,scope,s=>this.repository.findByCommand(db,s,saved.snapshot.envelope.commandId,materialId),(r,now)=>{
    const b=r.command.snapshot.currentBinding,a=subject.authSession;
    if(!same(r.command,saved)||r.material.ref.id!==materialId||!a||!isoV1(a.idleExpiresAt)||!isoV1(a.absoluteExpiresAt)||Math.min(Date.parse(a.idleExpiresAt),Date.parse(a.absoluteExpiresAt))<=now||b.grantSubject.userId!==subject.actorId||b.grantSubject.clientId!==subject.clientId||b.grantSubject.humanSessionId!==a.id||b.grantSubject.credentialGeneration!==subject.credentialGeneration)return reject();
   },false);
   return{material:result.material,sourceState:'AVAILABLE' as const};
  }catch{return reject();}
 }
 async readPart(db:PoolClient,scope:Scope,ref:Ref):Promise<Uint8Array>{
  try{
   if(!refV1(ref)||ref.version!==1)return reject();const saved=cloneV1(ref),result=await this.#resolve(db,scope,s=>this.repository.findByRef(db,s,cloneV1(saved)),r=>{if(!same(r.material.ref,saved))reject();},true);
   if(!result.bytes)return reject();return new Uint8Array(result.bytes);
  }catch{return reject();}
 }
}
