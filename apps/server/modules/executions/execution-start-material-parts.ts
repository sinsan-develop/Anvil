import {visitConcreteStartRead} from './execution-instruction-material-store.ts';
import type {PoolClient} from 'pg';
import {contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import type {AuthenticatedIdentity} from '../access/repository.ts';
import {assertKnowledgeTextSafe} from '../knowledge/knowledge-entry.ts';
import {materialReject as reject,readMaterialScope,type MaterialScope} from './execution-material-registration-input.ts';
import {startMaterialSame as same,type PreparedStartMaterial} from './execution-start-material-registration-input.ts';
import {assertStartFact,type StartRegisteredParts} from './execution-start-material-basis.ts';
import type {SyntheticPgStartMaterialRegistration,StartRegistration} from './execution-start-material-registration-store.ts';
const partOwners=new WeakMap<object,{repository:SyntheticPgStartMaterialRegistration;source:object;repositoryPrototype:object;sourcePrototype:object|null;pins:{owner:object;key:string;value:unknown}[]}>();
const observationCleanup=new WeakMap<object,()=>void>();
/** 폐기만 가능한 내부 작업이며 새 관측/권위를 만들지 않는다. */
export function discardConcreteStartObservation(ticket:object){observationCleanup.get(ticket)?.();observationCleanup.delete(ticket);}
let partVisitor:(context:any,phase:string,argument?:unknown)=>Promise<any>;
const ownFunction=(owner:object,key:string)=>{const d=Object.getOwnPropertyDescriptor(owner,key);return d&&'value'in d&&typeof d.value==='function'?d.value:undefined;};
export function concreteStartPartsConstructed(value:unknown){return !!value&&typeof value==='object'&&partOwners.has(value);}
export function concreteStartPartsMatch(value:unknown){
 if(!value||typeof value!=='object')return false;const owner=partOwners.get(value);return !!owner&&Object.getPrototypeOf(value)===SyntheticStartMaterialParts.prototype&&Object.getOwnPropertyDescriptor(value,'repository')?.value===owner.repository&&Object.getOwnPropertyDescriptor(owner.repository,'source')?.value===owner.source&&Object.getPrototypeOf(owner.repository)===owner.repositoryPrototype&&Object.getPrototypeOf(owner.source)===owner.sourcePrototype&&!Object.hasOwn(value,'current')&&!Object.hasOwn(value,'readPart')&&ownFunction(SyntheticStartMaterialParts.prototype,'current')===partsCurrentOriginal&&ownFunction(SyntheticStartMaterialParts.prototype,'readPart')===partsReadOriginal&&owner.pins.every(p=>ownFunction(p.owner,p.key)===p.value&&(p.owner!==owner.repositoryPrototype||!Object.hasOwn(owner.repository,p.key))&&(p.owner!==owner.sourcePrototype||!Object.hasOwn(owner.source,p.key)));
}
export function concreteStartPartsVisitor(value:unknown,visitor:unknown){return concreteStartPartsMatch(value)&&visitor===partVisitor;}
/** 내부 opaque ticket만 받으며 db/actor/source를 조립하는 공개 입력은 없다. */
export function observeConcreteStartParts(ticket:object,phase:string,argument?:unknown){return visitConcreteStartRead(ticket,partVisitor,phase,argument);}
/** START 원 두 그룹만 읽는 합성 포트다. 기존 SEND parser/receiver를 확장하지 않는다. */
export class SyntheticStartMaterialParts implements StartRegisteredParts{
 readonly transport='SYNTHETIC_ONLY' as const;readonly repository:SyntheticPgStartMaterialRegistration;
 readonly #observations=new WeakMap<object,any>();
 static{partVisitor=async(context,phase,argument)=>{const parts=context.parts as SyntheticStartMaterialParts;return parts.#observe(context,phase,argument);};}
 constructor(repository:SyntheticPgStartMaterialRegistration){this.repository=repository;if(repository?.transport!=='SYNTHETIC_ONLY'||['inspect','findByCommand','findByRef','clock'].some(k=>typeof(repository as any)[k]!=='function'))return reject();this.repository=repository;
  const pins:{owner:object;key:string;value:unknown}[]=[];
  for(const [owner,keys]of [[Object.getPrototypeOf(repository),['inspect','findByCommand','clock']]] as const)for(const key of keys){const value=ownFunction(owner,key);if(!value)return; pins.push({owner,key,value});}
  for(const key of ['describe','inspect','readBody']){const source=repository.source,owner=ownFunction(source,key)?source:Object.getPrototypeOf(source),value=ownFunction(owner,key);if(!value)return;pins.push({owner,key,value});}
  if(Object.getOwnPropertyNames(repository).some(k=>['inspect','findByCommand','clock'].includes(k)))return;
  for(const key of ['current','readPart'])pins.push({owner:SyntheticStartMaterialParts.prototype,key,value:ownFunction(SyntheticStartMaterialParts.prototype,key)});
  partOwners.set(this,{repository,source:repository.source,repositoryPrototype:Object.getPrototypeOf(repository),sourcePrototype:Object.getPrototypeOf(repository.source),pins});
 }
 async #observe(context:any,phase:string,argument?:unknown){
  const {ticket,db,scope,actor,commandId,materialId}=context,owner=partOwners.get(this);if(!owner||!concreteStartPartsMatch(this))return reject();
  const call=async(key:string,...args:any[])=>{context.assertOpen();const pin=owner.pins.find(p=>p.key===key&&p.owner!==SyntheticStartMaterialParts.prototype);if(!pin)return reject();const out=await Reflect.apply(pin.value as Function,key==='readBody'?owner.source:owner.repository,args);context.assertOpen();return out;};
  const observe=async(r:StartRegistration)=>{const first=await call('inspect',db,scope,{descriptor:r.descriptor,manifestRef:r.manifestRef},r.fact,r.grantExpiresAt);context.assertOpen();const now=await call('clock',db),a=actor.authSession;context.assertOpen();
   const f=assertStartFact(first.fact,scope,r.command,now);if(!a||actor.actorId!==f.subject.userId||actor.clientId!==f.subject.clientId||a.id!==f.subject.humanSessionId||actor.credentialGeneration!==scope.credentialGeneration||!isoV1(a.idleExpiresAt)||!isoV1(a.absoluteExpiresAt))return reject();
   const until=Math.min(Date.parse(first.validUntil),Date.parse(a.idleExpiresAt),Date.parse(a.absoluteExpiresAt));if(!isoV1(now)||until<=Date.parse(now))return reject();
   f.expires.humanSession=new Date(Math.min(Date.parse(f.expires.humanSession),until)).toISOString();return {first,raw:{record:cloneV1(r.command),fact:f,grantExpiresAt:r.grantExpiresAt,material:cloneV1(r.material),validUntil:new Date(until).toISOString()}};
  };
  if(phase==='BEFORE'){if(this.#observations.has(ticket))return reject();const r=await call('findByCommand',db,scope,commandId,materialId) as StartRegistration|null;context.assertOpen();if(!r||!same(r.scope,scope))return reject();const initial=cloneV1(r),out=await observe(initial);context.assertOpen();this.#observations.set(ticket,{registration:initial,first:out.first,body:false});observationCleanup.set(ticket,()=>this.#observations.delete(ticket));return out.raw;}
  const saved=this.#observations.get(ticket);if(!saved)return reject();const r=saved.registration as StartRegistration;
  if(phase==='BODY'){
   if(saved.body||!same(argument,r.material.ref))return reject();saved.body=true;
   const g=r.descriptor.groups[r.groupIndex]!,selection=cloneV1({commandRef:r.command.ref,manifestRef:r.manifestRef,group:g}),arg=cloneV1(scope),fixed=cloneV1(selection),raw=await call('readBody',db,arg,selection);context.assertOpen();
   if(!same(arg,scope)||!same(selection,fixed)||!(raw instanceof Uint8Array)||raw.byteLength!==g.source.sourceBytes)return reject();const body=new Uint8Array(raw);
   try{if(contentHash(body)!==g.source.contentHash)return reject();const text=new TextDecoder('utf-8',{fatal:true}).decode(body);assertKnowledgeTextSafe(text);if(g.kind==='START_OPTIONS'&&text!==saved.first.options.body)return reject();for(const part of g.parts){const slice=body.subarray(part.byteOffset,part.byteOffset+part.utf8Bytes);if(contentHash(slice)!==part.contentHash)return reject();assertKnowledgeTextSafe(new TextDecoder('utf-8',{fatal:true}).decode(slice));}const m=r.material.snapshot;return new Uint8Array(body.subarray(m.byteOffset,m.byteOffset+m.utf8Bytes));}finally{body.fill(0);}
  }
  if(phase!=='AFTER'||!saved.body)return reject();this.#observations.delete(ticket);const last=await call('findByCommand',db,scope,commandId,materialId);context.assertOpen();if(!same(last,r))return reject();const out=await observe(last);context.assertOpen();return out.raw;
 }

 async #resolve(db:PoolClient,scope:MaterialScope,lookup:()=>Promise<StartRegistration|null>,read:boolean){
  const s=readMaterialScope(scope),r=await lookup();if(!r||!same(r.scope,s))return reject();
  const p:PreparedStartMaterial={descriptor:r.descriptor,manifestRef:r.manifestRef},first=await this.repository.inspect(db,s,p,r.fact,r.grantExpiresAt),g=r.descriptor.groups[r.groupIndex]!,selection=cloneV1({commandRef:r.command.ref,manifestRef:r.manifestRef,group:g});
  let bytes:Uint8Array|undefined;
  if(read){
   const arg=cloneV1(s),saved=cloneV1(selection),raw=await this.repository.source.readBody(db,arg,selection);
   if(!same(arg,s)||!same(selection,saved)||!(raw instanceof Uint8Array)||raw.byteLength!==g.source.sourceBytes)return reject('MATERIAL_REGISTRATION_BINDING_CONFLICT');
   const body=new Uint8Array(raw);
   try{
    if(contentHash(body)!==g.source.contentHash)return reject('MATERIAL_REGISTRATION_BINDING_CONFLICT');
    const text=new TextDecoder('utf-8',{fatal:true}).decode(body);assertKnowledgeTextSafe(text);
    if(g.kind==='START_OPTIONS'&&text!==first.options.body)return reject('MATERIAL_REGISTRATION_BINDING_CONFLICT');
    for(const part of g.parts){const slice=body.subarray(part.byteOffset,part.byteOffset+part.utf8Bytes);if(contentHash(slice)!==part.contentHash)return reject('MATERIAL_REGISTRATION_BINDING_CONFLICT');assertKnowledgeTextSafe(new TextDecoder('utf-8',{fatal:true}).decode(slice));}
    const m=r.material.snapshot;bytes=new Uint8Array(body.subarray(m.byteOffset,m.byteOffset+m.utf8Bytes));
   }finally{body.fill(0);}
  }
  const last=await lookup();if(!last||!same(last,r))return reject('MATERIAL_REGISTRATION_BINDING_CONFLICT');
  const end=await this.repository.inspect(db,s,p,last.fact,last.grantExpiresAt),now=await this.repository.clock(db),deadline=Math.min(Date.parse(first.validUntil),Date.parse(end.validUntil));
  const {checkedAt:_,expires:__,writerState:___,...a}=first.fact,{checkedAt:____,expires:_____,writerState:______,...b}=end.fact;
  if(!same(a,b)||!isoV1(now)||deadline<=Date.parse(now))return reject('MATERIAL_REGISTRATION_CURRENT_REQUIRED');
  const fact=assertStartFact(end.fact,s,r.command,now);fact.expires.humanSession=new Date(Math.min(Date.parse(fact.expires.humanSession),deadline)).toISOString();
  return{r,fact,validUntil:new Date(deadline).toISOString(),bytes};
 }
 async current(db:PoolClient,actor:AuthenticatedIdentity,scope:MaterialScope,commandId:string,materialId:string){
  if(!uuidV1(commandId)||!uuidV1(materialId))return reject();const s=readMaterialScope(scope),out=await this.#resolve(db,s,()=>this.repository.findByCommand(db,s,commandId,materialId),false),a=actor.authSession,f=out.fact,now=Date.parse(await this.repository.clock(db));
  if(!a||actor.actorId!==f.subject.userId||actor.clientId!==f.subject.clientId||a.id!==f.subject.humanSessionId||actor.credentialGeneration!==s.credentialGeneration||!isoV1(a.idleExpiresAt)||!isoV1(a.absoluteExpiresAt)||Math.min(Date.parse(out.validUntil),Date.parse(a.idleExpiresAt),Date.parse(a.absoluteExpiresAt))<=now)return reject();
  return{record:cloneV1(out.r.command),fact:out.fact,grantExpiresAt:out.r.grantExpiresAt,material:cloneV1(out.r.material),validUntil:new Date(Math.min(Date.parse(out.validUntil),Date.parse(a.idleExpiresAt),Date.parse(a.absoluteExpiresAt))).toISOString()};
 }
 async readPart(db:PoolClient,scope:MaterialScope,ref:Ref):Promise<Uint8Array>{
  if(!refV1(ref)||ref.version!==1)return reject();const s=readMaterialScope(scope),out=await this.#resolve(db,s,()=>this.repository.findByRef(db,s,ref),true);if(!out.bytes||!same(out.r.material.ref,ref))return reject();return out.bytes;
 }
}

const partsCurrentOriginal=Object.getOwnPropertyDescriptor(SyntheticStartMaterialParts.prototype,'current')!.value,partsReadOriginal=Object.getOwnPropertyDescriptor(SyntheticStartMaterialParts.prototype,'readPart')!.value;
