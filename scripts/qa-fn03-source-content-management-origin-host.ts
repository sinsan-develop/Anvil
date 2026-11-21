import {managementOriginProfile,managementOriginTc01Profile,type ManagementOriginProfile} from './qa-fn03-source-content-management-origin-profiles.ts';
import {types} from 'node:util';
import {isAbsolute,resolve} from 'node:path';
import type {Pool,PoolClient} from 'pg';
import {contentHash,parseWireJson} from '../contracts/canonical.ts';
import {recordV1,uuidV1} from '../contracts/runtime/validation-v1.ts';
import {copyControlData} from '../apps/server/modules/control-handoff/control-grant.ts';
import {readManagementOriginSchemaManifest} from '../tests/integration/FN03/source-content-management-origin-schema.ts';
import {createManagementOriginRunner,createManagementOriginTc01Runner,type ManagementOriginTc01RunnerResult,type ManagementOriginRunnerObserver} from './qa-fn03-source-content-management-origin.ts';
import {createManagementOriginAuthFixture,type ManagementOriginAuthFixtureInput,type ManagementOriginAuthFixturePorts} from './qa-fn03-source-content-management-origin-auth-fixture.ts';
import {runCurrentStartSteps,runCurrentNetworkSteps,readCurrentAttachedHost,runCurrentDdlInstall,currentRevokeSql,verifyCurrentRoleMetadata,currentNetworkProbeContract} from './qa-ix01-current-journey.ts';

export interface ManagementOriginHostBinding {
 purpose?:string;profile?:string;
 attemptId:string;approvalId:string;planHash:string;approvalHash:string;sourceHead:string;
 issuedAt:number;expiresAt:number;artifactRoot:string;subnet:string;
}
export interface ManagementOriginTc01HostBinding extends ManagementOriginHostBinding {
 purpose:typeof managementOriginTc01Profile.purpose;profile:typeof managementOriginTc01Profile.profile;
}
export interface ManagementOriginHostScope extends ManagementOriginHostBinding {
 containerName:string;networkName:string;database:string;image:string;
 labels:Readonly<Record<string,string>>;containerId:string;networkId:string;host:string;
}
type Legacy=Parameters<typeof verifyCurrentRoleMetadata>[0]&Parameters<typeof currentRevokeSql>[0]&Parameters<typeof runCurrentDdlInstall>[1]&{
 buildPsqlArgs(id:string,db:string,user:string,path?:string,sha?:string):string[];
 roleMetadataSql():string;
};
type StartStep='IMAGE_COLLISION'|'CREATE_INSPECT'|'START_INSPECT'|'BOOTSTRAP_ROLES';
type NetworkStep='PRECHECK'|'CREATE_VERIFY'|'NONE_VERIFY'|'DISCONNECT'|'DETACHED_VERIFY'|'CONNECT';
export interface ManagementOriginHostPorts {
 now():number;monotonic():number;
 /** 정확 새 승인/소스/대역 비충돌/원 root/원 감독을 매번 대조한다. 문자열·boolean이 승인 증거는 아니다. */
 assertCurrent(scope:Readonly<ManagementOriginHostScope>):void;
 /** 같은 감독이 신규 배타 기록의 정착을 수거한다. 중복/불명은 throw, 재시도 없음. */
 claim(scope:Readonly<ManagementOriginHostScope>):Promise<void>;
 legacy:Legacy;
 start:{check(step:StartStep,scope:Readonly<ManagementOriginHostScope>,timeoutMs:number):void;
  create(scope:Readonly<ManagementOriginHostScope>,timeoutMs:number):string;
  start(scope:Readonly<ManagementOriginHostScope>,timeoutMs:number):string;
  readiness(scope:Readonly<ManagementOriginHostScope>,timeoutMs:number):Promise<void>};
 network:{step(step:NetworkStep,scope:Readonly<ManagementOriginHostScope>,timeoutMs:number):void;
  create(scope:Readonly<ManagementOriginHostScope>,timeoutMs:number):string;
  inspectNetwork(scope:Readonly<ManagementOriginHostScope>,timeoutMs:number):string;
  inspectContainer(scope:Readonly<ManagementOriginHostScope>,timeoutMs:number):string};
 /** 원 컨테이너/로컬 socket 소유를 전후 재검산하는 고정 Docker psql 어댑터. sync 종료/timeout/출력 상한은 공급자 책임. */
 psql(scope:Readonly<ManagementOriginHostScope>,argv:readonly string[],input:string|Uint8Array,timeoutMs:number):string;
 /** 132 설치 뒤 기존 SCRAM/HBA·원 password 설정 및 reload 검산만. membership 회수는 아래 고정 SQL이 담당한다. */
 secure(scope:Readonly<ManagementOriginHostScope>,timeoutMs:number):void;
 /** 연결 획득은 attached 검산 뒤 한 번. 같은 새 DB의 app Pool 및 별도 bootstrap autocommit observer만.
  * 실제 endpoint/DB/user·namespace proof와 seed 준비의 권위는 원 감독이 검산한다. */
 acquire(scope:Readonly<ManagementOriginHostScope>,timeoutMs:number):Promise<{
  appPool:Pool;observer:ManagementOriginRunnerObserver;input:ManagementOriginAuthFixtureInput;
  prepareCatalogAndUser:ManagementOriginAuthFixturePorts['prepareCatalogAndUser'];
  /** app/observer 원 연결의 close/end 수거. 자원 삭제가 아니며 실패에서도 이 원 handle만 회수한다. */
  close(timeoutMs:10000):Promise<void>;
 }>;
 /** 정상 완료·app와 Pool 종결 후에만 원 정확 자원 소유 재검산 및 정상 정리. 실패하면 후속 삭제/조회0. */
 cleanup(scope:Readonly<ManagementOriginHostScope>,timeoutMs:number):Promise<void>;
}
const reject=():never=>{throw Error('FN03_MANAGEMENT_HOST_UNKNOWN');};
function check(value:unknown):asserts value{if(!value)reject();}
const hex=(v:unknown,n:number)=>typeof v==='string'&&new RegExp(`^[a-f0-9]{${n}}$`).test(v);
const owner='anvil_v3_source_content_management_owner';
const ledgerSql="SELECT COALESCE(json_agg(json_build_object('id',id,'checksum',checksum) ORDER BY id),'[]'::json)::text FROM anvil.schema_migrations;";
function roleProjection(raw:string):string{
 check(typeof raw==='string'&&Buffer.byteLength(raw)<=16384);const v=parseWireJson(raw);
 check(recordV1(v,['sessionUser','currentUser','roles','memberships'])&&typeof v.sessionUser==='string'&&typeof v.currentUser==='string'&&Array.isArray(v.roles)&&v.roles.length<=21&&Array.isArray(v.memberships)&&v.memberships.length<=7);
 // SQL json_build_object의 공백만 제거한다. 원 키/배열 순서는 유지하고 모든 행의 의미는 기존 검산기에 남긴다.
 return JSON.stringify(v);
}
function priorRoles(raw:string):string{
 check(Buffer.byteLength(raw)<=16384);const v:unknown=parseWireJson(raw),flags=['superuser','inherit','createRole','createDb','replication','bypassRls','login'];
 check(recordV1(v,['sessionUser','currentUser','roles','memberships'])&&JSON.stringify(v)===raw&&Array.isArray(v.roles)&&v.roles.length<=21&&Array.isArray(v.memberships)&&v.memberships.length<=7);
 let count=0;const roles=v.roles.filter(r=>{check(recordV1(r,['name',...flags,'validUntil']));if(r.name!==owner)return true;check(++count===1&&r.validUntil===null&&flags.every(f=>r[f]===false));return false;});
 check(count===1);for(const m of v.memberships)check(recordV1(m,['role','member','grantor','adminOption'])&&![m.role,m.member,m.grantor].includes(owner));
 return JSON.stringify({...v,roles});
}
function sourceCopy(tsv:unknown,sql:unknown){
 const bytes=(v:unknown,size:number)=>{check(types.isUint8Array(v)&&!types.isProxy(v)&&v.buffer instanceof ArrayBuffer&&v.byteLength===size);return Buffer.from(v);};
 const historical=bytes(tsv,15807),rows=readManagementOriginSchemaManifest(historical);
 check(Array.isArray(sql)&&!types.isProxy(sql)&&sql.length===132);
 const files=rows.map((r,i)=>{const f=sql[i];check(recordV1(f,['id','path','bytes'])&&f.id===r.id&&f.path===r.path);const raw=bytes(f.bytes,r.bytes);check(contentHash(raw)===r.sha256);return{id:r.id,path:r.path,bytes:raw};});
 return{historical,rows,files};
}

/** 실행 진입/연결 생성/환경/파일/권한 발급 없음. 외부 감독의 고정 effect 포트만 소비한다.
 * factory spent는 프로세스 간 단회 증거가 아니다. 실제 명령/타이머·배타 기록·동일 DB 신원은 아직 외부 실행안 책임이다.
 * 기존 IX01 A14 프로필/child/130 설치를 호출하지 않는다. runner 한 곳에서 132 전체 바이트를 설치한다. */
export function createManagementOriginHost(ports:ManagementOriginHostPorts){return createHost(ports,managementOriginProfile);}
export function createManagementOriginTc01Host(ports:ManagementOriginHostPorts){return createHost(ports,managementOriginTc01Profile);}
function createHost(ports:ManagementOriginHostPorts,selected:ManagementOriginProfile){
 const {now,monotonic,assertCurrent,claim,legacy,start,network,psql,secure,acquire,cleanup}=ports;
 const identities=()=>[ports.now,ports.monotonic,ports.assertCurrent,ports.claim,legacy.buildPsqlArgs,legacy.roleMetadataSql,legacy.verifyRoleMetadata,legacy.revokeSql,legacy.parsePsqlFailure,legacy.DdlFailure,start.check,start.create,start.start,start.readiness,network.step,network.create,network.inspectNetwork,network.inspectContainer,ports.psql,ports.secure,ports.acquire,ports.cleanup];
 const functions=identities();
 let spent=false;
 return Object.freeze({async run(binding:unknown,tsv:unknown,sql:unknown){
  let stage='INPUT',scope:Readonly<ManagementOriginHostScope>|undefined,pgUntil=Infinity,journeyUntil=Infinity,outerMonoUntil=Infinity,pgMonoUntil=Infinity,journeyMonoUntil=Infinity,lastWall=-1,lastMono=-1;
  let resources:Awaited<ReturnType<ManagementOriginHostPorts['acquire']>>|undefined,auth:ReturnType<typeof createManagementOriginAuthFixture>|undefined;
  let acquired:Readonly<{pool:Pool;connect:()=>Promise<PoolClient>;observer:ManagementOriginRunnerObserver;query:ManagementOriginRunnerObserver['query'];prepare:ManagementOriginAuthFixturePorts['prepareCatalogAndUser'];close:(timeoutMs:10000)=>Promise<void>}>|undefined;
  let poolClosed=false,appClosed=false,cleaned=false,checked=false;
  let journeys:ManagementOriginTc01RunnerResult['journeys']=Object.freeze({fn03:'NOT_CHECKED',tc01:'NOT_STARTED',tc01Stage:null});
  const outcome=(reason:string)=>Object.freeze({status:checked&&cleaned?'CHECKED' as const:'STOPPED' as const,stage,reason,authority:'NOT_ISSUED' as const,appClosed,poolClosed,resources:cleaned?'REMOVED' as const:'PRESERVED_OR_UNCONFIRMED' as const,...(selected.integrated?{journeys}:{})});
  if(spent)return outcome('ATTEMPT_CONSUMED');spent=true;
  const current=()=>{
   check(scope&&ports.now===now&&ports.monotonic===monotonic&&ports.assertCurrent===assertCurrent&&ports.claim===claim&&ports.legacy===legacy&&ports.start===start&&ports.network===network&&ports.psql===psql&&ports.secure===secure&&ports.acquire===acquire&&ports.cleanup===cleanup);
   const observed=identities();check(functions.every((f,i)=>typeof f==='function'&&f===observed[i]));
   if(acquired)check(resources&&resources.appPool===acquired.pool&&acquired.pool.connect===acquired.connect&&resources.observer===acquired.observer&&acquired.observer.query===acquired.query&&resources.prepareCatalogAndUser===acquired.prepare&&resources.close===acquired.close);
   const wall=now.call(ports),mono=monotonic.call(ports);check(Number.isSafeInteger(wall)&&wall>=lastWall&&Number.isSafeInteger(mono)&&mono>=0&&mono>=lastMono&&wall>=scope.issuedAt&&wall<Math.min(scope.expiresAt,pgUntil,journeyUntil)&&mono<Math.min(outerMonoUntil,pgMonoUntil,journeyMonoUntil));
   lastWall=wall;lastMono=mono;check(assertCurrent.call(ports,scope)===undefined);return wall;
  };
  const timeout=(limit=10000)=>{current();const remaining=Math.min(limit,Math.min(scope!.expiresAt,pgUntil,journeyUntil)-lastWall,Math.min(outerMonoUntil,pgMonoUntil,journeyMonoUntil)-lastMono);check(Number.isSafeInteger(remaining)&&remaining>0);return remaining;};
  const sync=<T>(work:()=>T)=>{current();const result=work();current();return result;};
  const nothing=(work:()=>unknown)=>check(sync(work)===undefined);
  const query=(user:string,input:string|Uint8Array,path?:string,sha?:string)=>{
   const raw=sync(()=>psql.call(ports,scope!,Object.freeze(legacy.buildPsqlArgs(scope!.containerId,scope!.database,user,path,sha)),input,timeout(path?30000:10000)));
   check(typeof raw==='string'&&raw.isWellFormed()&&Buffer.byteLength(raw)<=1048576);return raw;
  };
  try{
   const b=copyControlData(binding,8192);check(recordV1(b,['attemptId','approvalId','planHash','approvalHash','sourceHead','issuedAt','expiresAt','artifactRoot','subnet',...(selected.integrated?['purpose','profile']:[])])&&uuidV1(b.attemptId)&&uuidV1(b.approvalId)&&hex(b.planHash,64)&&hex(b.approvalHash,64)&&hex(b.sourceHead,40));
   check(Number.isSafeInteger(b.issuedAt)&&Number.isSafeInteger(b.expiresAt)&&typeof b.issuedAt==='number'&&typeof b.expiresAt==='number'&&b.issuedAt>=0&&b.expiresAt>b.issuedAt&&b.expiresAt-b.issuedAt<=1800000);
   check(typeof b.artifactRoot==='string'&&(selected.integrated?b.artifactRoot==='/tmp/'+selected.artifactPrefix+b.attemptId:isAbsolute(b.artifactRoot)&&resolve(b.artifactRoot)===b.artifactRoot&&!b.artifactRoot.includes('\0')));
   const m=typeof b.subnet==='string'&&/^172\.(1[6-9]|2\d|3[01])\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\/28$/.exec(b.subnet);check(m&&Number(m[2])<=254&&Number(m[3])<=240&&Number(m[3])%16===0);
   if(selected.integrated)check(b.purpose===selected.purpose&&b.profile===selected.profile);
   const tag=b.attemptId.replaceAll('-',''),prefix=selected.resourcePrefix+tag;
   scope=Object.freeze({...b as unknown as ManagementOriginHostBinding,containerName:prefix,networkName:prefix+'_net',database:prefix,image:currentNetworkProbeContract.image,labels:Object.freeze({'anvil.owner':selected.owner,'anvil.instance':tag,'anvil.plan':b.planHash as string}),containerId:'',networkId:'',host:''});
   current();outerMonoUntil=lastMono+scope.expiresAt-lastWall;check(Number.isSafeInteger(outerMonoUntil));const source=sourceCopy(tsv,sql);current();
   stage='CLAIM';check(await claim.call(ports,scope)===undefined);current();
   stage='START';await runCurrentStartSteps({
    IMAGE_COLLISION:()=>nothing(()=>start.check('IMAGE_COLLISION',scope!,timeout())),
    CREATE:()=>{pgUntil=Math.min(scope!.expiresAt,current()+600000);pgMonoUntil=lastMono+600000;const id=sync(()=>start.create(scope!,timeout()));check(hex(id,64));scope=Object.freeze({...scope!,containerId:id});},
    CREATE_INSPECT:()=>nothing(()=>start.check('CREATE_INSPECT',scope!,timeout())),
    START:()=>check(sync(()=>start.start(scope!,timeout()))===scope!.containerId),
    START_INSPECT:()=>nothing(()=>start.check('START_INSPECT',scope!,timeout())),
    READINESS:async()=>{current();check(await start.readiness(scope!,timeout())===undefined);current();},
    BOOTSTRAP_ROLES:()=>nothing(()=>start.check('BOOTSTRAP_ROLES',scope!,timeout())),
   });current();
   // 실제 원 Pool 획득 전에는 연결0. Access가 보는 고정 객체/메서드는 같은 수명 동안 유지된다.
   const pool=Object.freeze({async connect(){current();check(acquired);return acquired.connect.call(acquired.pool);}}) as unknown as Pool;
   const observer:ManagementOriginRunnerObserver={async query(text,args){current();check(acquired);const r=await acquired.query.call(acquired.observer,text,args);current();return r;}};
   const installed:string[]=[],paths=source.rows.map(r=>r.path);let systemHash='';
   const roles=(raw:string,phase:'SETTLED'|'REVOKED')=>{const r=verifyCurrentRoleMetadata(legacy,raw,phase,installed,installed,paths);check(hex(r.systemHash,64)&&(!systemHash||systemHash===r.systemHash));systemHash=r.systemHash;return r;};
   stage='INSTALL';
   const runner=(selected.integrated?createManagementOriginTc01Runner:createManagementOriginRunner)({pool,observer,now:()=>current(),assertCurrent:()=>{current();},
    installation:{assertCurrent:()=>{current();},async install(raw,row){return runCurrentDdlInstall(()=>{query('anvil_v3_migrator',raw,row.path,row.sha256);installed.push(row.path);},legacy);},
     async appendLedger(row){check(/^[a-z0-9_]+$/.test(row.id)&&hex(row.sha256,64));query('anvil_v3_migrator',"INSERT INTO anvil.schema_migrations(id,checksum) VALUES('"+row.id+"','"+row.sha256+"');");return'SETTLED';},
     async readLedger(){return parseWireJson(query('anvil_v3_migrator',ledgerSql));}},
    async readRoleMetadata(){stage='ROLES';return roleProjection(query('anvil_v3_bootstrap',legacy.roleMetadataSql()));},
    verifyExistingRoles(raw){
     const before=roles(raw,'SETTLED');stage='SECURE';nothing(()=>secure.call(ports,scope!,timeout()));
     query('anvil_v3_bootstrap',currentRevokeSql(legacy,before.memberships.map(r=>r.role),paths));
     roles(priorRoles(roleProjection(query('anvil_v3_bootstrap',legacy.roleMetadataSql()))),'REVOKED');
     stage='NETWORK';runCurrentNetworkSteps({
      PRECHECK:()=>nothing(()=>network.step('PRECHECK',scope!,timeout())),
      CREATE:()=>{const id=sync(()=>network.create(scope!,timeout()));check(hex(id,64)&&id!==scope!.containerId);scope=Object.freeze({...scope!,networkId:id});},
      CREATE_VERIFY:()=>nothing(()=>network.step('CREATE_VERIFY',scope!,timeout())),
      NONE_VERIFY:()=>nothing(()=>network.step('NONE_VERIFY',scope!,timeout())),
      DISCONNECT:()=>nothing(()=>network.step('DISCONNECT',scope!,timeout())),
      DETACHED_VERIFY:()=>nothing(()=>network.step('DETACHED_VERIFY',scope!,timeout())),
      CONNECT:()=>nothing(()=>network.step('CONNECT',scope!,timeout())),
      ATTACHED_VERIFY:()=>{const host=readCurrentAttachedHost(scope!,{network:()=>sync(()=>network.inspectNetwork(scope!,timeout())),container:()=>sync(()=>network.inspectContainer(scope!,timeout()))});scope=Object.freeze({...scope!,host});},
     });
    },
    async prepareFixtureInput(original){
     stage='ACQUIRE';current();check(original===pool&&scope!.host);journeyUntil=Math.min(pgUntil,current()+90000);journeyMonoUntil=lastMono+90000;
     resources=await acquire.call(ports,scope!,timeout());
     check(resources&&resources.appPool!==pool&&resources.observer!==resources.appPool&&typeof resources.close==='function'&&typeof resources.appPool?.connect==='function'&&typeof resources.observer?.query==='function');
     acquired=Object.freeze({pool:resources.appPool,connect:resources.appPool.connect,observer:resources.observer,query:resources.observer.query,prepare:resources.prepareCatalogAndUser,close:resources.close});current();
     check(resources.input.artifactRoot===scope!.artifactRoot);
     auth=createManagementOriginAuthFixture({pool,assertCurrent:()=>{current();},now:()=>current(),prepareCatalogAndUser:async(original,input)=>{current();check(original===pool);check(await acquired!.prepare.call(resources,acquired!.pool,input)===undefined);current();}},resources.input);
     stage='AUTH';const input=await auth.prepareFixtureInput(pool);current();stage='JOURNEY';return input;
    },
   });
   const result=await runner.run(source.historical,source.files);appClosed=result.appClosed;
   if(selected.integrated){check('journeys' in result);journeys=(result as ManagementOriginTc01RunnerResult).journeys;if(result.stage==='TC01')stage='TC01';}
   current();
   if(selected.integrated)check(journeys.fn03==='CHECKED'&&journeys.tc01==='CHECKED');
   check(result.status==='CHECKED'&&result.appClosed&&result.settlements.length>0&&!result.settlements.includes('UNKNOWN')&&result.releases.every(x=>x==='RELEASED'));checked=true;
  }catch{checked=false;}finally{
   auth?.dispose();
   // 원 handle 종결 전용 추가 10초. 효과 기한을 연장하지 않으며 공급자는 실제 timeout/종결을 수거해야 한다.
   if(acquired){
    // 실패한 소유/기한 guard를 새 작업에 사용하지 않는다. 원 close만 한 번 수거하고 늦은 성공도 UNKNOWN이다.
    let closeWall=NaN,closeMono=NaN;try{closeWall=now.call(ports);closeMono=monotonic.call(ports);}catch{/* 원 handle 회수는 계속 */}
    try{check(await acquired.close.call(resources,10000)===undefined);const wall=now.call(ports),mono=monotonic.call(ports);
     check([closeWall,closeMono,wall,mono].every(Number.isSafeInteger)&&wall>=closeWall&&mono>=closeMono&&wall-closeWall<=10000&&mono-closeMono<=10000);poolClosed=true;
    }catch{checked=false;}
   }
  }
  if(!checked)return outcome('BOUNDARY_OR_OUTCOME_UNKNOWN');
  try{stage='CLEANUP';current();check(poolClosed);check(await cleanup.call(ports,scope!,timeout())===undefined);current();cleaned=true;stage='DONE';return outcome('JOURNEY_CHECKED');}
  catch{checked=false;return outcome('CLEANUP_UNKNOWN');}
 }});
}
