import {concreteStartPartsConstructed,concreteStartPartsMatch,concreteStartPartsVisitor,observeConcreteStartParts,discardConcreteStartObservation} from './execution-start-material-parts.ts';
import {concreteStartBasisConstructed,concreteStartBasisMatch,concreteStartBasisVisitor,projectConcreteStartBasis} from './execution-start-material-basis.ts';
import type {Pool,PoolClient} from 'pg';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {readServerExecutionFactV1} from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import {cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {SyntheticPgChallengeStore,type SyntheticHostKeys} from './execution-challenge-store.ts';
import type {SyntheticChallengeScope as Scope} from './execution-challenges.ts';
import type {SyntheticAuthenticatedMaterialStore} from './execution-authenticated-materials.ts';
import type {SyntheticPgInstructionMaterialBasis} from './execution-instruction-material-basis.ts';
import {executionTarget} from './execution-proof.ts';
import {assertNoStoredExecutionStop} from './execution-stop-fence.ts';
import {readMaterialCredentialBasis} from './execution-material-credential-basis.ts';

type ConcreteRead={before():Promise<unknown>;body(ref:RuntimeRefV1):Promise<Uint8Array>;after():Promise<unknown>;close():void};
const concreteTransactions=new WeakMap<object,{scope:Scope;open:(commandId:string,materialId:string)=>ConcreteRead;pins:Record<string,unknown>}>();
const concreteTickets=new WeakMap<object,{context:any;guard:()=>Promise<void>}>();
/** 원 transaction이 자체 등록한 객체만 조회한다. caller 등록/주입 포트가 아니다. */
export function concreteStartReadFor(tx:object,scope:Scope,commandId:string,materialId:string):ConcreteRead|null{const owner=concreteTransactions.get(tx);if(!owner)return null;if(!Object.entries(owner.pins).every(([key,value])=>Object.getOwnPropertyDescriptor(tx,key)?.value===value)||!same(owner.scope,scope))return reject();return owner.open(commandId,materialId);}
/** 비공개 원 operation 함수만 raw 문맥을 받을 수 있다. 호출자 callback은 거절한다. */
export async function visitConcreteStartRead(ticket:object,visitor:unknown,phase:string,argument?:unknown){
 const owner=concreteTickets.get(ticket);if(!owner||!concreteStartPartsVisitor(owner.context.parts,visitor)&&!concreteStartBasisVisitor(owner.context.basis,owner.context.parts,visitor))return reject();
 const active=()=>{if(concreteTickets.get(ticket)!==owner)return reject();owner.context.assertOpen();};active();await owner.guard();active();const result=await (visitor as Function)(owner.context,phase,argument);active();await owner.guard();active();return result;
}
type Joint=Parameters<Parameters<SyntheticAuthenticatedMaterialStore['transaction']>[1]>[0];
type Binding=Parameters<Joint['results']['bind']>[1];
export interface SyntheticInstructionPartReader{
 readonly transport:'SYNTHETIC_ONLY';
 /** 임의 경로가 아닌 검증된 등록 ref의 bytes만 같은 db/주체 경계에서 읽는다. */
 readPart(db:PoolClient,scope:Scope,ref:RuntimeRefV1):Promise<Uint8Array>;
}
export interface SyntheticInstructionMaterialResults{
 readonly transport:'SYNTHETIC_ONLY';
 /** proof의 원 binding을 같은 caller tx에서 불변·유일하게 저장한다. 별도 COMMIT은 금지다.
  * 구현/물리 저장은 필수 제공자의 책임이며 이 adapter는 DB 기본값을 만들지 않는다. */
 bind(db:PoolClient,scope:Scope,proofResultRef:RuntimeRefV1,binding:Binding):Promise<void>;
 read(db:PoolClient,scope:Scope,proofResultRef:RuntimeRefV1):Promise<Binding|null>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const reject=():never=>{throw new AuthFailure('INSTRUCTION_MATERIAL_STORE_UNAVAILABLE',503);};
function readBinding(scope:Scope,raw:unknown):Binding{
 if(!recordV1(raw,['target','materialRef','contentHash'])||!refV1(raw.materialRef)||raw.materialRef.version!==1||!hashV1(raw.contentHash)||!recordV1(raw.target,['method','path','queryHash','bodyHash']))return reject();
 const prefix='/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/commands/',path=raw.target.path;
 if(typeof path!=='string'||!path.startsWith(prefix))return reject();const split=path.slice(prefix.length).split('/');
 if(split.length!==3||!uuidV1(split[0])||split[1]!=='materials'||split[2]!==raw.materialRef.id||!same(raw.target,executionTarget('GET',path,[],null)))return reject();
 return cloneV1(raw) as Binding;
}
/** 후속 등록 자료 조회·현재 actor/basis·서명 nonce와 원결과를 단일 challenge tx로 결합한다.
 * 등록 자료/bytes/결과 저장 제공자는 모두 필수 합성 port다. 실제 원문 접근·물리 journal,
 * HTTP 등록·credential/키 발급·OS/Agent 기본값은 제공하지 않는다. */
export class SyntheticPgInstructionMaterialStore implements SyntheticAuthenticatedMaterialStore{
 readonly transport='SYNTHETIC_ONLY' as const;readonly pool:Pick<Pool,'connect'>;readonly keys:SyntheticHostKeys;
 readonly basis:Pick<SyntheticPgInstructionMaterialBasis,'transport'|'current'>;readonly parts:SyntheticInstructionPartReader;readonly results:SyntheticInstructionMaterialResults;
 constructor(pool:Pick<Pool,'connect'>,keys:SyntheticHostKeys,basis:Pick<SyntheticPgInstructionMaterialBasis,'transport'|'current'>,parts:SyntheticInstructionPartReader,results:SyntheticInstructionMaterialResults){this.pool=pool;this.keys=keys;this.basis=basis;this.parts=parts;this.results=results;this.#ports();}
 #ports(){if(typeof this.pool?.connect!=='function'||this.keys?.transport!=='SYNTHETIC_ONLY'||typeof this.keys.key!=='function'||this.basis?.transport!=='SYNTHETIC_ONLY'||typeof this.basis.current!=='function'||this.parts?.transport!=='SYNTHETIC_ONLY'||typeof this.parts.readPart!=='function'||this.results?.transport!=='SYNTHETIC_ONLY'||typeof this.results.bind!=='function'||typeof this.results.read!=='function')reject();}
 async transaction<T>(rawScope:Scope,body:(tx:Joint)=>Promise<T>):Promise<T>{
  try{
   this.#ports();const scope=cloneV1(rawScope);let selected:PoolClient|undefined;
   const pool={connect:async()=>{this.#ports();selected=await this.pool.connect();return selected;}};
   return await new SyntheticPgChallengeStore(pool,this.keys).transaction(cloneV1(scope),async challenges=>{
    if(!selected||typeof challenges.currentReadOnly!=='function')return reject();const db=selected,query=db.query,readOnly=challenges.currentReadOnly;
    const txid=async()=>{if(db.query!==query)return reject();const rows=(await db.query('SELECT txid_current()::text AS transaction_id')).rows;if(db.query!==query||rows.length!==1||typeof rows[0]?.transaction_id!=='string'||!/^[1-9][0-9]*$/.test(rows[0].transaction_id))return reject();return rows[0].transaction_id as string;},originalTx=await txid();
    let fixed:Awaited<ReturnType<typeof readMaterialCredentialBasis>>|undefined,concretePin:(()=>void)|undefined;
    const checked=async()=>{
     concretePin?.();this.#ports();if(await txid()!==originalTx)return reject();const raw=cloneV1(await readOnly.call(challenges)),context:any=raw.context;
     if(!Object.keys(scope).every(k=>same(context?.[k],(scope as any)[k]))||!isoV1(context?.grantExpiresAt))return reject();
     const mapped=await readMaterialCredentialBasis(db,cloneV1(scope),'EXECUTION'),now=await challenges.clock();concretePin?.();this.#ports();
     if(await txid()!==originalTx||fixed&&!same(fixed,mapped)||!isoV1(now)||Date.parse(context.grantExpiresAt)<=Date.parse(now)||mapped.fact.registration.hostPublicKeyFingerprint!==context.publicKeyFingerprint)return reject();
     concretePin?.();return{raw,mapped};
    };
    const first=await checked();fixed=first.mapped;
    const current=async(commandId:string,materialId:string,ticket?:object,phase?:string)=>{
     this.#ports();const before=(await checked()).raw,context:any=before.context;
     if(!Object.keys(scope).every(k=>same(context[k],(scope as any)[k]))||!isoV1(context.grantExpiresAt))return reject();
     await assertNoStoredExecutionStop(db,{projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration});
     const grants=(await db.query('SELECT snapshot_json FROM anvil.execution_grants WHERE project_id=$1::uuid AND id=$2::uuid AND version=$3::bigint AND content_hash=$4::text LIMIT 2',[scope.projectId,scope.grantRef.id,scope.grantRef.version,scope.grantRef.contentHash])).rows;
     if(grants.length!==1)return reject();const fact=readServerExecutionFactV1(grants[0].snapshot_json?.binding),subject=fact.subject;
     const rows=(await db.query('SELECT id,user_id,client_id,credential_generation,idle_expires_at,absolute_expires_at FROM anvil.auth_sessions WHERE id=$1::uuid AND user_id=$2::uuid AND client_id=$3::uuid LIMIT 2',[subject.humanSessionId,subject.userId,subject.clientId])).rows;
     if(rows.length!==1)return reject();const s=rows[0];
     if(s.id!==subject.humanSessionId||s.user_id!==subject.userId||s.client_id!==subject.clientId||Number(s.credential_generation)!==subject.credentialGeneration||!(s.idle_expires_at instanceof Date)||!(s.absolute_expires_at instanceof Date)||!Number.isFinite(s.idle_expires_at.getTime())||!Number.isFinite(s.absolute_expires_at.getTime()))return reject();
     const actor:AuthenticatedIdentity={actorId:subject.userId,clientId:subject.clientId,credentialGeneration:subject.credentialGeneration,serverOwner:false,reauthUntil:null,authSession:{id:subject.humanSessionId,idleExpiresAt:s.idle_expires_at.toISOString(),absoluteExpiresAt:s.absolute_expires_at.toISOString()}};
     const observation=ticket?concreteTickets.get(ticket)?.context:null;if(ticket&&(!observation||observation.actor&&!same(observation.actor,actor)))return reject();if(observation)observation.actor=cloneV1(actor);
     const rawBasis=ticket?await projectConcreteStartBasis(ticket,await observeConcreteStartParts(ticket,phase!)):await this.basis.current(db,actor,cloneV1(fixed!.materialScope),commandId,materialId);
     const basis=cloneV1(rawBasis),after=(await checked()).raw,end:any=after.context,now=await challenges.clock();this.#ports();
     if(!recordV1(basis,['fact','grantRef','grantExpiresAt','commandRef','commandSnapshot','authorizationReceiptRef','material','sourceState'])||!same(context,end)||!isoV1(now)||Date.parse(end.grantExpiresAt)<=Date.parse(now)||basis.fact.registration.hostPublicKeyFingerprint!==end.publicKeyFingerprint)return reject();
     basis.fact.expires.humanSession=new Date(Math.min(Date.parse(basis.fact.expires.humanSession),Date.parse(context.grantExpiresAt),Date.parse(end.grantExpiresAt))).toISOString();return basis;
    };
    const readCurrent=async()=>(await checked()).raw;
    const materials:Joint['materials']={clock:challenges.clock,current:(commandId,materialId)=>current(commandId,materialId),readPart:async ref=>{
     this.#ports();if(!refV1(ref)||ref.version!==1)return reject();await checked();
     const bytes=await this.parts.readPart(db,cloneV1(fixed!.materialScope),cloneV1(ref));await checked();
     if(!(bytes instanceof Uint8Array)||bytes.byteLength>2097152)return reject();return new Uint8Array(bytes);
    }};
    let live=true;const tickets=new Set<object>(),pair={basis:this.basis,parts:this.parts,repository:Object.getOwnPropertyDescriptor(this.parts,'repository')?.value};
    const assertPins=()=>{const registered=concreteTransactions.get(materials);if(!registered||!live||Object.getOwnPropertyDescriptor(this,'basis')?.value!==pair.basis||Object.getOwnPropertyDescriptor(this,'parts')?.value!==pair.parts||Object.getOwnPropertyDescriptor(pair.parts,'repository')?.value!==pair.repository||!concreteStartBasisMatch(pair.basis,pair.parts)||!concreteStartPartsMatch(pair.parts)||!Object.entries(registered.pins).every(([key,value])=>Object.getOwnPropertyDescriptor(materials,key)?.value===value))return reject();};
    if((concreteStartPartsConstructed(pair.parts)||concreteStartBasisConstructed(pair.basis))&&!concreteStartBasisMatch(pair.basis,pair.parts))return reject();
    if(concreteStartBasisMatch(pair.basis,pair.parts))concreteTransactions.set(materials,{scope:cloneV1(scope),pins:{clock:materials.clock,current:materials.current,readPart:materials.readPart},open:(commandId,materialId)=>{
     if(!live||!uuidV1(commandId)||!uuidV1(materialId))return reject();const ticket={},context:any={ticket,db,scope:cloneV1(fixed!.materialScope),parts:pair.parts,basis:pair.basis,actor:null,commandId,materialId};let phase='NEW';tickets.add(ticket);
     context.assertOpen=()=>{if(!live||phase!=='BUSY'||concreteTickets.get(ticket)?.context!==context)return reject();};
     const guard=async()=>{context.assertOpen();assertPins();await checked();context.assertOpen();if(await txid()!==originalTx||!live)return reject();context.assertOpen();assertPins();};
     concreteTickets.set(ticket,{context,guard});const close=()=>{phase='CLOSED';discardConcreteStartObservation(ticket);concreteTickets.delete(ticket);tickets.delete(ticket);};
     const step=async<T>(expected:string,next:string,work:()=>Promise<T>)=>{if(phase!==expected){close();return reject();}phase='BUSY';try{await guard();context.assertOpen();const out=await work();context.assertOpen();await guard();context.assertOpen();phase=next;return out;}catch(error){close();throw error;}};
     return{before:()=>step('NEW','BEFORE',()=>current(commandId,materialId,ticket,'BEFORE')),body:ref=>step('BEFORE','BODY',()=>observeConcreteStartParts(ticket,'BODY',cloneV1(ref))),after:async()=>{try{return await step('BODY','DONE',()=>current(commandId,materialId,ticket,'AFTER'));}finally{close();}},close};
    }});
    if(concreteTransactions.has(materials))concretePin=assertPins;
    try{const result=await body({challenges:{...challenges,current:readCurrent,currentReadOnly:readCurrent},materials,results:{bind:async(ref,binding)=>{
     this.#ports();if(!refV1(ref)||ref.version!==1)return reject();await checked();
     await this.results.bind(db,cloneV1(fixed!.materialScope),cloneV1(ref),readBinding(scope,binding));await checked();
    },read:async ref=>{
     this.#ports();if(!refV1(ref)||ref.version!==1)return reject();await checked();
     const value=await this.results.read(db,cloneV1(fixed!.materialScope),cloneV1(ref));await checked();
     return value===null?null:readBinding(scope,value);
    }}});concretePin?.();await checked();concretePin?.();this.#ports();return result;}finally{live=false;concreteTransactions.delete(materials);for(const ticket of tickets){discardConcreteStartObservation(ticket);concreteTickets.delete(ticket);}tickets.clear();}
   });
  }catch{return reject();}
 }
}
