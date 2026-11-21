import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {isAbsolute,resolve} from 'node:path';
import type {Pool} from 'pg';
import type {VersionRef} from '../contracts/generated-types.ts';
import {canonicalJson} from '../contracts/canonical.ts';
import {recordV1,uuidV1,refV1,isoV1} from '../contracts/runtime/validation-v1.ts';
import {copyControlData} from '../apps/server/modules/control-handoff/control-grant.ts';
import {AccessRepository} from '../apps/server/modules/access/repository.ts';
import {selectDraftMethodology} from '../apps/server/modules/projects/draft-methodology.ts';
import {createManagementOriginTransactionFence} from '../tests/integration/FN03/source-content-management-origin-transaction-fence.ts';
import type {ManagementOriginRunnerInput} from './qa-fn03-source-content-management-origin.ts';

export interface ManagementOriginAuthFixtureInput {
 artifactRoot:string;access:{installationId:string;key:Uint8Array};
 origin:string;actorId:string;loginName:string;password:string;credentialGeneration:number;
 methodologyRef:VersionRef;ids:unknown;policyExpiresAt:string;managementPayload:unknown;
}
export interface ManagementOriginAuthFixturePorts {
 pool:Pool;assertCurrent():void;now():number;
 /** 132 설치/role 검산을 끝낸 동일 신규 DB의 준비에만 쓴다. IX01의 기존 catalog seed와
  * 전용 합성 사용자/credential 준비를 담당하는 원 감독 포트다. 임의 값/boolean은 권위가 아니다.
  * 이 포트는 실제 정착/기한/실패 종결을 수거해야 하며 app 권한·정책·세션을 우회 발급하지 않는다.
  * password는 이 private 메모리 호출에서만 소비하며 로그/반환/지속 기록하지 않는다. */
 prepareCatalogAndUser(pool:Pool,input:Readonly<{actorId:string;loginName:string;password:string;methodologyRef:VersionRef}>):Promise<void>;
}
const fail=():never=>{throw Error('FN03_MANAGEMENT_AUTH_FIXTURE_UNKNOWN');};
function check(v:unknown):asserts v{if(!v)fail();}
const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const ids=['draftCommandId','createCommandId','policyCommandId','ruleId','managementCommandId','deniedCommandId','readCommandId'];

/** runner.prepareFixtureInput에 연결하는 내부 일회 공급자. Pool/서버/root/권한·키·토큰을 직접 발급하지 않는다.
 * 실제 Access의 정상 login/reauth가 세션을 만들고 원 session 행과 catalog를 재검산한다.
 * 출력 OWNER는 앞으로 createProject가 생성할 project 소유자의 fixture 구분이다. 기존 프로젝트 역할의 증거가 아니다.
 * 외부 원 감독이 run 후 dispose해야 반환 seed 바이트도 소거된다. JS 문자열과 Access 내부 사본은 GC 대상이다. */
export function createManagementOriginAuthFixture(ports:ManagementOriginAuthFixturePorts,input:ManagementOriginAuthFixtureInput){
 const {pool,assertCurrent,now,prepareCatalogAndUser}=ports;
 let spent=false,disposed=false,outputKey:Buffer|undefined;
 let fence:ReturnType<typeof createManagementOriginTransactionFence<Pool>>|undefined;
 return Object.freeze({settlements:()=>fence?.settlements()??Object.freeze([]),releases:()=>fence?.releases()??Object.freeze([]),
  dispose(){disposed=true;outputKey?.fill(0);},
  async prepareFixtureInput(originalPool:Pool):Promise<ManagementOriginRunnerInput>{
   let key:Buffer|undefined,last=-1,until=Infinity;
   if(spent||disposed)fail();spent=true;
   const current=()=>{check(!disposed&&originalPool===pool&&ports.pool===pool&&ports.assertCurrent===assertCurrent&&ports.now===now&&ports.prepareCatalogAndUser===prepareCatalogAndUser&&assertCurrent.call(ports)===undefined);const at=now.call(ports);check(Number.isSafeInteger(at)&&at>=0&&at>=last&&at<until);last=at;};
   try{
    current();check(recordV1(input,['artifactRoot','access','origin','actorId','loginName','password','credentialGeneration','methodologyRef','ids','policyExpiresAt','managementPayload']));
    const raw=input.access;check(!types.isProxy(raw)&&recordV1(raw,['installationId','key'])&&uuidV1(raw.installationId)&&types.isUint8Array(raw.key)&&!types.isProxy(raw.key));
    const typed=Object.getPrototypeOf(Uint8Array.prototype),get=(name:string)=>Reflect.apply(Object.getOwnPropertyDescriptor(typed,name)!.get!,raw.key,[]),backing=get('buffer');check(backing instanceof ArrayBuffer&&get('byteLength')===32);key=Buffer.from(new Uint8Array(backing,get('byteOffset'),32));const installationId=raw.installationId;
    const {access:_,...data}=input,v=copyControlData(data,2097152);
    check(typeof v.artifactRoot==='string'&&v.artifactRoot.length<=4096&&!v.artifactRoot.includes('\0')&&isAbsolute(v.artifactRoot)&&resolve(v.artifactRoot)===v.artifactRoot);
    check(typeof v.origin==='string');const origin=new URL(v.origin);check(origin.protocol==='https:'&&origin.origin===v.origin&&!origin.username&&!origin.password);
    check(uuidV1(v.actorId)&&v.credentialGeneration===1&&typeof v.loginName==='string'&&/^[a-z0-9][a-z0-9._@+-]{0,127}$/.test(v.loginName)&&typeof v.password==='string'&&v.password.isWellFormed()&&[...v.password].length>=15&&[...v.password].length<=128&&refV1(v.methodologyRef));
    check(recordV1(v.ids,ids)&&Object.values(v.ids).every(uuidV1)&&new Set(Object.values(v.ids)).size===ids.length&&isoV1(v.policyExpiresAt));until=Date.parse(v.policyExpiresAt);current();
    const prepared=await prepareCatalogAndUser.call(ports,pool,Object.freeze({actorId:v.actorId,loginName:v.loginName,password:v.password,methodologyRef:Object.freeze({...v.methodologyRef})}));current();check(prepared===undefined);
    fence=createManagementOriginTransactionFence(pool,current);const access=new AccessRepository(fence.pool,{installationId,key});
    const settled=async<T>(call:()=>Promise<T>)=>{current();const before=fence!.settlements();check(before.every(x=>x==='COMMIT'));const value=await call();current();check(same(fence!.settlements(),[...before,'COMMIT'])&&fence!.releases().every(x=>x==='RELEASED'));return value;};
    const shape=(s:Awaited<ReturnType<AccessRepository['login']>>)=>{
     check(recordV1(s,['user','clientId','token','csrfToken','expiresAt','absoluteExpiresAt','reauthUntil'])&&recordV1(s.user,['id','displayName','serverOwner'])&&s.user.id===v.actorId&&s.user.serverOwner===false&&uuidV1(s.clientId)&&/^[A-Za-z0-9_-]{43}$/.test(s.token)&&/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken)&&isoV1(s.expiresAt)&&isoV1(s.absoluteExpiresAt)&&s.expiresAt<=s.absoluteExpiresAt);
     until=Math.min(until,Date.parse(s.expiresAt),Date.parse(s.absoluteExpiresAt));current();
    };
    const authenticate=async(label:string,checkMethodology:boolean)=>{
     const first=await settled(()=>access.login(v.loginName,v.password,label,'fn03-management-origin'));shape(first);check(first.reauthUntil===null);
     const session=await settled(()=>access.reauthenticate(first.token,first.csrfToken,v.password,'fn03-management-origin'));shape(session);
     check(session.clientId===first.clientId&&session.token!==first.token&&session.csrfToken!==first.csrfToken&&isoV1(session.reauthUntil)&&session.reauthUntil<=session.absoluteExpiresAt);until=Math.min(until,Date.parse(session.reauthUntil));current();
     const actor=await settled(()=>access.authenticated(session.token,session.csrfToken,async(db,identity)=>{
      current();check(identity.actorId===v.actorId&&identity.clientId===session.clientId&&identity.credentialGeneration===v.credentialGeneration&&identity.serverOwner===false);
      if(checkMethodology){const selected=await selectDraftMethodology(db,identity.actorId,{kind:'CONFIRMED_REFERENCE',versionRef:v.methodologyRef});current();check(same(selected,{kind:'CONFIRMED_REFERENCE',versionRef:v.methodologyRef}));}
      return identity;
     }));
     check(actor.authSession&&uuidV1(actor.authSession.id)&&actor.reauthUntil instanceof Date&&actor.reauthUntil.toISOString()===session.reauthUntil&&actor.authSession.idleExpiresAt===session.expiresAt&&actor.authSession.absoluteExpiresAt===session.absoluteExpiresAt);
     return{userId:actor.actorId,clientId:actor.clientId,sessionId:actor.authSession.id,credentialGeneration:actor.credentialGeneration,participation:'OWNER',token:session.token,csrfToken:session.csrfToken,tokenDigest:digest(session.token),csrfDigest:digest(session.csrfToken),idleExpiresAt:actor.authSession.idleExpiresAt,absoluteExpiresAt:actor.authSession.absoluteExpiresAt,reauthUntil:session.reauthUntil};
    };
    const normal=await authenticate('FN03 격리 제어 client',true),denied=await authenticate('FN03 격리 비제어 client',false);
    check(normal.clientId!==denied.clientId&&normal.sessionId!==denied.sessionId&&normal.token!==denied.token);current();
    outputKey=Buffer.from(key);
    return Object.freeze({artifactRoot:v.artifactRoot,access:Object.freeze({installationId,key:outputKey}),provision:{origin:v.origin,normal,denied,methodologyRef:v.methodologyRef,ids:v.ids,policyExpiresAt:v.policyExpiresAt,managementPayload:v.managementPayload}});
   }catch{outputKey?.fill(0);return fail();}finally{key?.fill(0);}
  }});
}
