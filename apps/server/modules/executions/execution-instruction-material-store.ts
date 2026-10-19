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
    if(!selected)return reject();const db=selected;
    const current=async(commandId:string,materialId:string)=>{
     this.#ports();const before=await challenges.current(),context:any=before.context;
     if(!Object.keys(scope).every(k=>same(context[k],(scope as any)[k]))||!isoV1(context.grantExpiresAt))return reject();
     const grants=(await db.query('SELECT snapshot_json FROM anvil.execution_grants WHERE project_id=$1::uuid AND id=$2::uuid AND version=$3::bigint AND content_hash=$4::text LIMIT 2',[scope.projectId,scope.grantRef.id,scope.grantRef.version,scope.grantRef.contentHash])).rows;
     if(grants.length!==1)return reject();const fact=readServerExecutionFactV1(grants[0].snapshot_json?.binding),subject=fact.subject;
     const rows=(await db.query('SELECT id,user_id,client_id,credential_generation,idle_expires_at,absolute_expires_at FROM anvil.auth_sessions WHERE id=$1::uuid AND user_id=$2::uuid AND client_id=$3::uuid LIMIT 2',[subject.humanSessionId,subject.userId,subject.clientId])).rows;
     if(rows.length!==1)return reject();const s=rows[0];
     if(s.id!==subject.humanSessionId||s.user_id!==subject.userId||s.client_id!==subject.clientId||Number(s.credential_generation)!==subject.credentialGeneration||!(s.idle_expires_at instanceof Date)||!(s.absolute_expires_at instanceof Date)||!Number.isFinite(s.idle_expires_at.getTime())||!Number.isFinite(s.absolute_expires_at.getTime()))return reject();
     const actor:AuthenticatedIdentity={actorId:subject.userId,clientId:subject.clientId,credentialGeneration:subject.credentialGeneration,serverOwner:false,reauthUntil:null,authSession:{id:subject.humanSessionId,idleExpiresAt:s.idle_expires_at.toISOString(),absoluteExpiresAt:s.absolute_expires_at.toISOString()}};
     const basis=cloneV1(await this.basis.current(db,actor,cloneV1(scope),commandId,materialId)),after=await challenges.current(),end:any=after.context,now=await challenges.clock();this.#ports();
     if(!recordV1(basis,['fact','grantRef','grantExpiresAt','commandRef','commandSnapshot','authorizationReceiptRef','material','sourceState'])||!same(context,end)||!isoV1(now)||Date.parse(end.grantExpiresAt)<=Date.parse(now)||basis.fact.registration.hostPublicKeyFingerprint!==end.publicKeyFingerprint)return reject();
     basis.fact.expires.humanSession=new Date(Math.min(Date.parse(basis.fact.expires.humanSession),Date.parse(context.grantExpiresAt),Date.parse(end.grantExpiresAt))).toISOString();return basis;
    };
    const result=await body({challenges,materials:{clock:challenges.clock,current,readPart:async ref=>{this.#ports();if(!refV1(ref)||ref.version!==1)return reject();const bytes=await this.parts.readPart(db,cloneV1(scope),cloneV1(ref));this.#ports();if(!(bytes instanceof Uint8Array)||bytes.byteLength>2097152)return reject();return new Uint8Array(bytes);}},results:{bind:async(ref,binding)=>{this.#ports();if(!refV1(ref)||ref.version!==1)return reject();await this.results.bind(db,cloneV1(scope),cloneV1(ref),readBinding(scope,binding));this.#ports();},read:async ref=>{this.#ports();if(!refV1(ref)||ref.version!==1)return reject();const value=await this.results.read(db,cloneV1(scope),cloneV1(ref));this.#ports();return value===null?null:readBinding(scope,value);}}});this.#ports();return result;
   });
  }catch{return reject();}
 }
}
