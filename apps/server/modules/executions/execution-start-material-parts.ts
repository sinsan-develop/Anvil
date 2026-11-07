import type {PoolClient} from 'pg';
import {contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import type {AuthenticatedIdentity} from '../access/repository.ts';
import {assertKnowledgeTextSafe} from '../knowledge/knowledge-entry.ts';
import {materialReject as reject,readMaterialScope,type MaterialScope} from './execution-material-registration-input.ts';
import {startMaterialSame as same,type PreparedStartMaterial} from './execution-start-material-registration-input.ts';
import {assertStartFact,type StartRegisteredParts} from './execution-start-material-basis.ts';
import type {SyntheticPgStartMaterialRegistration,StartRegistration} from './execution-start-material-registration-store.ts';
/** START 원 두 그룹만 읽는 합성 포트다. 기존 SEND parser/receiver를 확장하지 않는다. */
export class SyntheticStartMaterialParts implements StartRegisteredParts{
 readonly transport='SYNTHETIC_ONLY' as const;readonly repository:SyntheticPgStartMaterialRegistration;
 constructor(repository:SyntheticPgStartMaterialRegistration){this.repository=repository;if(repository?.transport!=='SYNTHETIC_ONLY'||['inspect','findByCommand','findByRef','clock'].some(k=>typeof(repository as any)[k]!=='function'))return reject();this.repository=repository;}
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
