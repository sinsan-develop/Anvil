import {canonicalJson} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {executionTarget} from './execution-proof.ts';
import type {SyntheticChallengeScope as Scope} from './execution-challenges.ts';
import type {SyntheticAuthenticatedObservations} from './execution-authenticated-observations.ts';
import type {SyntheticAuthenticatedPermits} from './execution-authenticated-permits.ts';
import type {SyntheticAuthenticatedMaterials} from './execution-authenticated-materials.ts';
import type {SyntheticRecoveryStopInstructions} from './execution-recovery-stop-instructions.ts';

export interface SyntheticExecutionRoutePorts{
 readonly transport:'SYNTHETIC_ONLY';clock():string;
 credentials:{readonly transport:'SYNTHETIC_ONLY';current(input:{mode:'EXECUTION'|'RECOVERY';connectorId:string;executionId:string;credential:string}):Promise<unknown>};
 observations:Pick<SyntheticAuthenticatedObservations,'ingest'>&{readonly transport:'SYNTHETIC_ONLY'};
 permits:Pick<SyntheticAuthenticatedPermits,'consume'>&{readonly transport:'SYNTHETIC_ONLY'};
 materials:Pick<SyntheticAuthenticatedMaterials,'readWithDeadline'>&{readonly transport:'SYNTHETIC_ONLY'};
 stopInstructions:Pick<SyntheticRecoveryStopInstructions,'read'>&{readonly transport:'SYNTHETIC_ONLY'};
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const reject=():never=>{throw new AuthFailure('EXECUTION_REQUEST_REJECTED',412);};
/** 정규화된 요청의 P1 분기만 제공한다. HTTP 헤더 형식/리스너/실제 credential 발급은 만들지 않는다.
 * caller가 보낸 scope를 사용하지 않고 필수 합성 credential 제공자에서 현재 scope를 얻는다.
 * 실제 서비스에 자동 등록하지 않으며 기존 등록/자료읽기 credential은 이 경계에서 거절한다. */
export class SyntheticExecutionRequestRouter{
 readonly ports:SyntheticExecutionRoutePorts;
 constructor(ports:SyntheticExecutionRoutePorts){this.ports=ports;this.#ports();}
 #ports(){const p=this.ports;if(p?.transport!=='SYNTHETIC_ONLY'||typeof p.clock!=='function'||p.credentials?.transport!=='SYNTHETIC_ONLY'||typeof p.credentials.current!=='function'||p.observations?.transport!=='SYNTHETIC_ONLY'||typeof p.observations.ingest!=='function'||p.permits?.transport!=='SYNTHETIC_ONLY'||typeof p.permits.consume!=='function'||p.materials?.transport!=='SYNTHETIC_ONLY'||typeof p.materials.readWithDeadline!=='function'||p.stopInstructions?.transport!=='SYNTHETIC_ONLY'||typeof p.stopInstructions.read!=='function')reject();}
 async handle(raw:unknown){
  try{
   this.#ports();if(!recordV1(raw,['method','path','query','bodyRaw','cookie','credential','challengeRef','proof','signature'])||raw.cookie!==null||typeof raw.path!=='string'||raw.path.length>2048||typeof raw.credential!=='string'||raw.credential.length!==50||!refV1(raw.challengeRef)||raw.challengeRef.version!==1||typeof raw.signature!=='string'||raw.signature.length>128)return reject();
   const match=/^\/api\/v1\/connectors\/([^/]+)\/executions\/([^/]+)(\/recovery)?(\/.*)$/.exec(raw.path);if(!match||match[0]!==raw.path||!uuidV1(match[1])||!uuidV1(match[2]))return reject();
   const mode=match[3]?'RECOVERY':'EXECUTION',suffix=match[4]!,command=/^\/commands\/([^/]+)\/(permit|materials\/([^/]+))$/.exec(suffix);
   const kind=raw.method==='POST'&&suffix==='/observations'?'observations':mode==='RECOVERY'&&raw.method==='GET'&&suffix==='/stop-instruction'?'stop':mode==='EXECUTION'&&command&&command[0]===suffix&&uuidV1(command[1])&&(command[2]==='permit'&&raw.method==='POST'?'permit':uuidV1(command[3])&&raw.method==='GET'?'material':null);
   if(!kind||!(mode==='RECOVERY'?/^av3er1_[A-Za-z0-9_-]{43}$/:/^av3ex1_[A-Za-z0-9_-]{43}$/).test(raw.credential)||raw.method==='POST'&&(typeof raw.bodyRaw!=='string'||Buffer.byteLength(raw.bodyRaw)>(kind==='observations'?1048576:2097152)))return reject();
   const target=executionTarget(raw.method,raw.path,raw.query,raw.bodyRaw),proof=cloneV1(raw.proof),challengeRef=cloneV1(raw.challengeRef),credential=raw.credential;
   if(!recordV1(proof,['requestId','method','path','queryHash','bodyHash','grantRef','credentialGeneration','serverNonce'])||!same({method:proof.method,path:proof.path,queryHash:proof.queryHash,bodyHash:proof.bodyHash},target))return reject();
   const lookup={mode,connectorId:match[1],executionId:match[2],credential} as const;
   const current=async()=>{
    this.#ports();const c=cloneV1(await this.ports.credentials.current({...lookup})),now=this.ports.clock();this.#ports();
    if(!isoV1(now)||!recordV1(c,['transport','scope','checkedAt','expiresAt','executionAuthorized','dispatchPerformed'])||c.transport!=='SYNTHETIC_ONLY'||c.executionAuthorized!==false||c.dispatchPerformed!==false||!isoV1(c.checkedAt)||!isoV1(c.expiresAt)||Date.parse(c.checkedAt)>Date.parse(now)||Date.parse(now)-Date.parse(c.checkedAt)>30000||Date.parse(c.expiresAt)<=Date.parse(now))return reject();
    const s=c.scope;if(!recordV1(s,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||s.mode!==mode||!uuidV1(s.projectId)||s.connectorId!==match[1]||s.executionId!==match[2]||!positive(s.executionGeneration)||!positive(s.credentialGeneration)||!refV1(s.grantRef)||!same(s.grantRef,proof.grantRef)||s.credentialGeneration!==proof.credentialGeneration)return reject();return c as typeof c&{scope:Scope};
   };
   const before=await current(),scope=cloneV1(before.scope);let result:any,validUntil:unknown=null;
   if(kind==='observations')result=await this.ports.observations.ingest(scope,challengeRef,proof,raw.signature,raw.bodyRaw);
   else if(kind==='permit')result=await this.ports.permits.consume(scope,command![1],challengeRef,proof,raw.signature,raw.bodyRaw);
   else if(kind==='material'){const selected=await this.ports.materials.readWithDeadline(scope,command![1],command![3],challengeRef,proof,raw.signature);result=selected.result;validUntil=selected.validUntil;}
   else result=await this.ports.stopInstructions.read(scope,challengeRef,proof,raw.signature);
   if(kind==='permit')validUntil=result?.permit?.expiresAt;else if(kind==='stop')validUntil=result?.expiresAt;
   const after=await current(),now=this.ports.clock();this.#ports();if(!isoV1(now)||!same(before.scope,after.scope)||Date.parse(after.expiresAt)<Date.parse(before.expiresAt)||!result||typeof result!=='object'||result.transport!=='SYNTHETIC_ONLY'||result.executionAuthorized!==false||result.dispatchPerformed!==false||kind!=='observations'&&(!isoV1(validUntil)||Date.parse(validUntil)<=Date.parse(now)))return reject();
   return{transport:'SYNTHETIC_ONLY' as const,data:result,cacheControl:'no-store' as const,executionAuthorized:false as const,dispatchPerformed:false as const};
  }catch{return reject();}
 }
}
