import {createHash} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import type {SyntheticChallengeScope as Scope} from './execution-challenges.ts';
export interface SyntheticCredentialCurrentStore{
 readonly transport:'SYNTHETIC_ONLY';
 /** digest로 선택한 동일 credential/grant를 한 transaction에서 잠근다. 실제 발급/SQL/키 제공자가 아니다.
  * current는 비밀 없는 credential 기록·정확 scope/등록·현재 상태·유한 확인 기한을 제공한다. */
 transaction<T>(tokenDigest:string,body:(tx:{current():Promise<unknown>;clock():Promise<string>})=>Promise<T>):Promise<T>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const reject=():never=>{throw new AuthFailure('EXECUTION_CREDENTIAL_NOT_CURRENT',412);};
function scopeOf(v:unknown):Scope{
 if(!recordV1(v,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||!['EXECUTION','RECOVERY'].includes(v.mode)||![v.projectId,v.connectorId,v.executionId].every(uuidV1)||!positive(v.executionGeneration)||!positive(v.credentialGeneration)||!refV1(v.grantRef))return reject();return cloneV1(v) as unknown as Scope;
}
/** 기존 정규화 router의 credentials.current용 합성 소비부. token을 생성·반환·파일/DB 저장하지 않는다.
 * CURRENT는 주입 제공자의 합성 관측이며 실제 발급/인증권위·OS·Agent 준비를 증명하지 않는다. */
export class SyntheticExecutionCredentialCurrent{
 readonly transport='SYNTHETIC_ONLY' as const;readonly store:SyntheticCredentialCurrentStore;
 constructor(store:SyntheticCredentialCurrentStore){this.store=store;this.#port();}
 #port(){if(this.store?.transport!=='SYNTHETIC_ONLY'||typeof this.store.transaction!=='function')reject();}
 async current(raw:unknown){
  try{
   this.#port();if(!recordV1(raw,['mode','connectorId','executionId','credential'])||!['EXECUTION','RECOVERY'].includes(raw.mode)||!uuidV1(raw.connectorId)||!uuidV1(raw.executionId)||typeof raw.credential!=='string'||!(raw.mode==='RECOVERY'?/^av3er1_[A-Za-z0-9_-]{43}$/:/^av3ex1_[A-Za-z0-9_-]{43}$/).test(raw.credential))return reject();
   const input=cloneV1(raw),digest=createHash('sha256').update(input.credential).digest('hex');
   return await this.store.transaction(digest,async tx=>{
    const read=async()=>{
     this.#port();const value=cloneV1(await tx.current()),now=await tx.clock();this.#port();
     if(!isoV1(now)||!recordV1(value,['transport','credential','credentialState','grantState','scope','registrationRef','publicKeyFingerprint','checkedAt','expiresAt'])||value.transport!=='SYNTHETIC_ONLY'||value.credentialState!=='VERIFIED_CURRENT'||value.grantState!=='ACTIVE'||!isoV1(value.checkedAt)||!isoV1(value.expiresAt)||Date.parse(value.checkedAt)>Date.parse(now)||Date.parse(now)-Date.parse(value.checkedAt)>30000||Date.parse(value.expiresAt)<=Date.parse(now)||!refV1(value.registrationRef)||!hashV1(value.publicKeyFingerprint))return reject();
     const c=value.credential;if(!recordV1(c,['ref','snapshot'])||!refV1(c.ref)||c.ref.version!==1||c.ref.contentHash!==hash(c.snapshot)||!recordV1(c.snapshot,['transport','state','purpose','scope','tokenDigest','registrationRef','publicKeyFingerprint','issuedAt','expiresAt','credentialIssued','executionAuthorized','dispatchPerformed']))return reject();
     const s=c.snapshot,scope=scopeOf(s.scope),start=Date.parse(s.issuedAt),end=Date.parse(s.expiresAt),limit=scope.mode==='RECOVERY'?300000:900000;
     if(s.transport!=='SYNTHETIC_ONLY'||s.state!=='SYNTHETIC_BOUND_NO_AUTHORITY'||s.purpose!==(scope.mode==='RECOVERY'?'EXECUTION_RECOVERY_ONLY':'EXECUTION_DISPATCH_ONLY')||s.tokenDigest!==digest||s.credentialIssued!==false||s.executionAuthorized!==false||s.dispatchPerformed!==false||!isoV1(s.issuedAt)||!isoV1(s.expiresAt)||start>Date.parse(now)||end<=Date.parse(now)||end<=start||end-start>limit||scope.mode!==input.mode||scope.connectorId!==input.connectorId||scope.executionId!==input.executionId||!same(value.scope,scope)||!same(s.registrationRef,value.registrationRef)||s.publicKeyFingerprint!==value.publicKeyFingerprint)return reject();
     return{scope,ref:c.ref,registrationRef:value.registrationRef,publicKeyFingerprint:value.publicKeyFingerprint,deadline:Math.min(end,Date.parse(value.expiresAt)),checkedAt:value.checkedAt,now};
    };
    const before=await read(),after=await read(),now=await tx.clock();this.#port();
    if(!isoV1(now)||!same(before.scope,after.scope)||!same(before.ref,after.ref)||!same(before.registrationRef,after.registrationRef)||before.publicKeyFingerprint!==after.publicKeyFingerprint||after.deadline<before.deadline||Date.parse(now)>=before.deadline||Date.parse(now)-Date.parse(after.checkedAt)>30000||Date.parse(now)<Date.parse(after.now))return reject();
    return{transport:'SYNTHETIC_ONLY' as const,scope:cloneV1(after.scope),checkedAt:after.checkedAt,expiresAt:new Date(before.deadline).toISOString(),executionAuthorized:false as const,dispatchPerformed:false as const};
   });
  }catch{return reject();}
 }
}
