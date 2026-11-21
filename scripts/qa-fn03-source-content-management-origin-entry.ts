import {types} from 'node:util';
import {basename,isAbsolute,resolve} from 'node:path';
import {canonicalJson,contentHash,parseWireJson} from '../contracts/canonical.ts';
import {recordV1,uuidV1,hashV1} from '../contracts/runtime/validation-v1.ts';
import {copyControlData} from '../apps/server/modules/control-handoff/control-grant.ts';
import {readManagementOriginSchemaManifest} from '../tests/integration/FN03/source-content-management-origin-schema.ts';
import {currentProfile} from './qa-ix01-current-journey.ts';
import {createManagementOriginHost,type ManagementOriginHostBinding} from './qa-fn03-source-content-management-origin-host.ts';
import {createManagementOriginIsolatedPorts,type ManagementOriginIsolatedInput,type ManagementOriginIsolatedProviders} from './qa-fn03-source-content-management-origin-isolated-ports.ts';

const purpose='FN03_MANAGEMENT_ORIGIN_ISOLATED';
const profile='FN03_MANAGEMENT_ORIGIN_ENTRY_V1';
export const managementOriginEntryContract=Object.freeze({
 purpose,profile,entry:'scripts/qa-fn03-source-content-management-origin-entry.ts',
 runtimeEvidence:Object.freeze(['LOADED_SOURCE_CLOSURE','LOCKED_INSTALLED_DEPENDENCY_CLOSURE']),
 sequence:Object.freeze(['PACKET_AND_132_BYTES','CURRENT_RUNTIME','EXCLUSIVE_INTENT','NEW_PG','INSTALL_132','ROLE_AND_SCRAM','NEW_INTERNAL_28','SAME_DATABASE_POOLS','AUTH_AND_PUBLIC_PROVISION','MANAGEMENT_JOURNEY','ORIGINAL_APP_AND_POOLS_CLOSE','SUCCESS_ONLY_EXACT_CLEANUP']),
 limits:Object.freeze({approvalMs:1800000,pgMs:600000,journeyMs:90000,poolCloseMs:10000}),
});
export interface ManagementOriginEntryRuntime {
 sourceHead:string;entry:typeof managementOriginEntryContract.entry;nodeSha256:string;
 sourceClosureSha256:string;packageLockSha256:string;installedDependenciesSha256:string;
}
export interface ManagementOriginEntryPorts extends ManagementOriginIsolatedProviders {
 /** 원 launcher가 import 전에 검산한 실제 적재 source closure와 lock/설치 closure의
  * 같은 감독·동일 plan·현재 pin을 확인한다. hash 문자열/합성 성공은 운용 증거가 아니다.
  * 이 함수는 신뢰/설치/승인을 발급하지 않고 새 명령·재조회 없이 원 증거만 검산한다. */
 assertPreparedRuntime(binding:Readonly<ManagementOriginHostBinding>,runtime:Readonly<ManagementOriginEntryRuntime>):void;
}
export interface ManagementOriginEntryInput {
 packet:{planRaw:string;planHash:string;approvalRaw:string;approvalHash:string};
 isolated:ManagementOriginIsolatedInput;
 sql:readonly {id:string;path:string;bytes:Uint8Array}[];
}
const fail=():never=>{throw Error('FN03_MANAGEMENT_ENTRY_UNKNOWN');};
function check(value:unknown):asserts value{if(!value)fail();}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function bytes(value:unknown,max:number){
 check(types.isUint8Array(value)&&!types.isProxy(value)&&value.buffer instanceof ArrayBuffer&&value.byteLength>0&&value.byteLength<=max);
 return Buffer.from(value);
}
function wire(raw:unknown,hash:unknown){
 check(typeof raw==='string'&&raw.isWellFormed()&&Buffer.byteLength(raw)<=16384&&hashV1(hash)&&contentHash(Buffer.from(raw))===hash);
 return parseWireJson(raw);
}
function prepare(input:unknown){
 check(recordV1(input,['packet','isolated','sql'])&&recordV1(input.packet,['planRaw','planHash','approvalRaw','approvalHash']));
 const packet=input.packet,plan=wire(packet.planRaw,packet.planHash),approval=wire(packet.approvalRaw,packet.approvalHash);
 check(recordV1(plan,['schemaVersion','purpose','profile','attemptId','sourceHead','issuedAt','expiresAt','artifactRoot','receiptRoot','subnet','runtime'])&&plan.schemaVersion===1&&plan.purpose===purpose&&plan.profile===profile&&uuidV1(plan.attemptId)&&typeof plan.sourceHead==='string'&&/^[a-f0-9]{40}$/.test(plan.sourceHead));
 check(Number.isSafeInteger(plan.issuedAt)&&Number.isSafeInteger(plan.expiresAt)&&plan.issuedAt>=0&&plan.expiresAt>plan.issuedAt&&plan.expiresAt-plan.issuedAt<=1800000);
 check(typeof plan.artifactRoot==='string'&&isAbsolute(plan.artifactRoot)&&resolve(plan.artifactRoot)===plan.artifactRoot&&basename(plan.artifactRoot)==='anvil-v3-fn03-management-'+plan.attemptId);
 check(plan.receiptRoot==='/home/daon/.local/share/anvil-v3-qa-receipts/fn03-management-'+plan.attemptId);
 const subnet=typeof plan.subnet==='string'&&/^172\.(1[6-9]|2\d|3[01])\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\/28$/.exec(plan.subnet);
 check(subnet&&Number(subnet[2])<=254&&Number(subnet[3])<=240&&Number(subnet[3])%16===0);
 check(recordV1(plan.runtime,['sourceHead','entry','nodeSha256','sourceClosureSha256','packageLockSha256','installedDependenciesSha256'])&&plan.runtime.sourceHead===plan.sourceHead&&plan.runtime.entry===managementOriginEntryContract.entry&&plan.runtime.nodeSha256===currentProfile.nodeHash&&['sourceClosureSha256','packageLockSha256','installedDependenciesSha256'].every(k=>hashV1(plan.runtime[k])));
 check(recordV1(approval,['schemaVersion','purpose','profile','decision','approvalId','attemptId','planHash','sourceHead','issuedAt','expiresAt'])&&approval.schemaVersion===1&&approval.purpose===purpose+'_RUN_APPROVAL'&&approval.profile===profile&&approval.decision==='ALLOW_ONE_RUN'&&uuidV1(approval.approvalId)&&approval.attemptId===plan.attemptId&&approval.planHash===packet.planHash&&approval.sourceHead===plan.sourceHead&&approval.issuedAt===plan.issuedAt&&approval.expiresAt===plan.expiresAt);
 const binding=Object.freeze({attemptId:plan.attemptId,approvalId:approval.approvalId,planHash:packet.planHash,approvalHash:packet.approvalHash,sourceHead:plan.sourceHead,issuedAt:plan.issuedAt,expiresAt:plan.expiresAt,artifactRoot:plan.artifactRoot,subnet:plan.subnet}) as Readonly<ManagementOriginHostBinding>;
 const raw=input.isolated;check(recordV1(raw,['binding','receiptRoot','historicalTsv','legacyBytes','sources','passwords','fixture'])&&same(raw.binding,binding)&&raw.receiptRoot===plan.receiptRoot&&recordV1(raw.sources,['forms','standard','methods']));
 const historicalTsv=bytes(raw.historicalTsv,15807),rows=readManagementOriginSchemaManifest(historicalTsv);
 check(Array.isArray(input.sql)&&!types.isProxy(input.sql)&&input.sql.length===132);
 const sql=rows.map((row,i)=>{const f=input.sql[i];check(recordV1(f,['id','path','bytes'])&&f.id===row.id&&f.path===row.path);const b=bytes(f.bytes,row.bytes);check(b.byteLength===row.bytes&&contentHash(b)===row.sha256);return{id:row.id,path:row.path,bytes:b};});
 check(recordV1(raw.fixture,['artifactRoot','access','origin','actorId','loginName','password','credentialGeneration','methodologyRef','ids','policyExpiresAt','managementPayload'])&&recordV1(raw.fixture.access,['installationId','key']));
 const {access,...data}=raw.fixture,key=bytes(access.key,32);check(key.byteLength===32);
 const isolated={binding,receiptRoot:plan.receiptRoot,historicalTsv,legacyBytes:bytes(raw.legacyBytes,4*1024*1024),sources:{forms:bytes(raw.sources.forms,2097152),standard:bytes(raw.sources.standard,2097152),methods:bytes(raw.sources.methods,2097152)},passwords:copyControlData(raw.passwords,1024),fixture:{...copyControlData(data,2097152),access:{installationId:access.installationId,key}}} as unknown as ManagementOriginIsolatedInput;
 return{binding,runtime:Object.freeze({...plan.runtime}) as Readonly<ManagementOriginEntryRuntime>,isolated,sql};
}

/** FN03 하나의 명시 호출만 조립한다. import/factory 효과0, CLI/설치/기본 native provider 없음.
 * 실제 실행은 고정 runtime을 import 전에 검산한 외부 launcher와 원 배타 기록 공급자가 필요하다.
 * assertPreparedRuntime/assertCurrent/consume의 실제 구현은 이 소스가 발급하지 않는다.
 * 내부 spent는 프로세스 간 단회 보증이 아니며 consume의 exclusive+flush+close가 그 책임이다.
 * 승인 packet은 보호된 원 전달/소스 핀 아래의 입력이며 자체 서명/실행 승인으로 승격하지 않는다.
 */
export function createManagementOriginEntry(ports:ManagementOriginEntryPorts){
 let spent=false;
 return Object.freeze({async run(input:unknown){
  const stopped=(reason:string)=>Object.freeze({status:'STOPPED' as const,stage:'ENTRY',reason,authority:'NOT_ISSUED' as const,appClosed:false,poolClosed:false,resources:'PRESERVED_OR_UNCONFIRMED' as const});
  if(spent)return stopped('ATTEMPT_CONSUMED');spent=true;
  let prepared:ReturnType<typeof prepare>|undefined;
  try{
   prepared=prepare(input);const p=prepared;
   const keys=['now','monotonic','assertCurrent','consume','command','wait','openPool','closePool','prepareArtifactRoot','assertPreparedRuntime'] as const;
   const functions=keys.map(k=>{const f=ports[k];check(typeof f==='function');return f;});
   const now=ports.now,monotonic=ports.monotonic,assertCurrent=ports.assertCurrent,assertRuntime=ports.assertPreparedRuntime;
   const {consume,command,wait,openPool,closePool,prepareArtifactRoot}=ports;
   let wall=-1,mono=-1,until=Infinity;
   const clock=()=>{
    check(keys.every((k,i)=>ports[k]===functions[i]));const t=now.call(ports),m=monotonic.call(ports);
    check(Number.isSafeInteger(t)&&Number.isSafeInteger(m)&&t>=wall&&m>=mono&&m>=0&&t>=p.binding.issuedAt&&t<p.binding.expiresAt&&m<until);
    if(until===Infinity){until=m+p.binding.expiresAt-t;check(Number.isSafeInteger(until));}wall=t;mono=m;
   };
   const current=()=>{clock();check(assertCurrent.call(ports,p.binding)===undefined&&assertRuntime.call(ports,p.binding,p.runtime)===undefined);clock();};
   current();
   const bound:ManagementOriginIsolatedProviders={now:()=>now.call(ports),monotonic:()=>monotonic.call(ports),assertCurrent:()=>current(),
    consume:async b=>{current();check(same(b,p.binding));check(await consume.call(ports,b)===undefined);current();},
    command:call=>{current();return command.call(ports,call);},wait:ms=>{current();return wait.call(ports,ms);},
    openPool:request=>{current();return openPool.call(ports,request);},
    // 실패 뒤에도 원 Pool 회수는 필요하다. 현재성 재검산으로 원 handle을 잃지 않는다.
    closePool:(pool,ms)=>closePool.call(ports,pool,ms),prepareArtifactRoot:async b=>{current();check(await prepareArtifactRoot.call(ports,b)===undefined);current();},
   };
   const isolated=await createManagementOriginIsolatedPorts(p.isolated,bound);current();
   return await createManagementOriginHost(isolated).run(p.binding,p.isolated.historicalTsv,p.sql);
  }catch{return stopped('INPUT_OR_RUNTIME_UNKNOWN');}
  finally{prepared?.isolated.fixture.access.key.fill(0);}
 }});
}
