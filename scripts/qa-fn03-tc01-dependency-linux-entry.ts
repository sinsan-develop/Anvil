import {types} from 'node:util';
import {canonicalJson,contentHash,parseWireJson} from '../contracts/canonical.ts';
import {createTc01PinnedLoad} from './qa-fn03-tc01-pinned-load.ts';
import type {Tc01DependencyAuthorizationSupervisor,Tc01DependencyAuthorizationSystem} from './qa-fn03-tc01-dependency-authorized-entry.ts';

const sourceHead='4c44da5d432e561c672021eee14983562ac57b78',entryPath='scripts/qa-fn03-tc01-dependency-authorized-entry.ts';
// 4c44da5d Git LF AST: 12 runtime sources, no bare packages. Loader plus its two shared pre-hook dependencies: 13 unique rows.
const rows=Object.freeze([
 {
  "path": "contracts/canonical.ts",
  "bytes": 2986,
  "sha256": "5be93c5b92a3bda99baa9bc561e6b535c9c1ab80196601e561903a0b6f74e143",
  "format": "module-typescript"
 },
 {
  "path": "contracts/runtime/validation-v1.ts",
  "bytes": 1523,
  "sha256": "bdfbe4a380c38f5cf3fb885ac167d9bf2c869b30faac540ceeab20bb16bee5d6",
  "format": "module-typescript"
 },
 {
  "path": "scripts/qa-fn03-tc01-dependency-authorized-entry.ts",
  "bytes": 15596,
  "sha256": "691f540d32da8a0c98c993ecc09c3a63c0788cdcff4d64a21b3b71b6dd9cff34",
  "format": "module-typescript"
 },
 {
  "path": "scripts/qa-fn03-tc01-dependency-carrier-entry.ts",
  "bytes": 7948,
  "sha256": "97d272bc776cd54992ae8da246e840d609f53806406fd540e15feb811557e615",
  "format": "module-typescript"
 },
 {
  "path": "scripts/qa-fn03-tc01-dependency-carrier-wire.ts",
  "bytes": 8660,
  "sha256": "0fd5115f692ffbd7b3bac2cff100fdaef892d484d27b488e0c04edfa0240e4b9",
  "format": "module-typescript"
 },
 {
  "path": "scripts/qa-fn03-tc01-dependency-evidence.ts",
  "bytes": 9019,
  "sha256": "9d04f02138f92e7ed0d658b1d9c025989988642b053dcc909f66881567843268",
  "format": "module-typescript"
 },
 {
  "path": "scripts/qa-fn03-tc01-dependency-intake.ts",
  "bytes": 6600,
  "sha256": "be189d368418e5963a958fe2a4dbaf4038f0a992a88031cb183840dd40733f25",
  "format": "module-typescript"
 },
 {
  "path": "scripts/qa-fn03-tc01-dependency-native-ports.ts",
  "bytes": 18252,
  "sha256": "485f8fc220a8b956a8bfce0a413af1dc0cfb624dc900ab8e2c942c1c81519117",
  "format": "module-typescript"
 },
 {
  "path": "scripts/qa-fn03-tc01-dependency-preparation.ts",
  "bytes": 12133,
  "sha256": "dbedab6fe7467464b413844639e67b19259fef75131ad416c50e6bf087f6a602",
  "format": "module-typescript"
 },
 {
  "path": "scripts/qa-fn03-tc01-pinned-load.ts",
  "bytes": 12568,
  "sha256": "cc8a6bf00683a6d18ac28f552d5f07182d2632f6d48115f40572ab8a9c9d6b4b",
  "format": "module-typescript"
 },
 {
  "path": "scripts/qa-ix01-current-journey.ts",
  "bytes": 64438,
  "sha256": "a3de404e3397741ceca76e61b766bb3cb240af83d765bf8a978dc4d9cff8a63b",
  "format": "module-typescript"
 },
 {
  "path": "tests/integration/IX01/current-schema-baseline.ts",
  "bytes": 9378,
  "sha256": "6c574464a72cc64fb9f44476d1da6252a69fef2bce2157e95725a864b32d4f9c",
  "format": "module-typescript"
 },
 {
  "path": "tests/integration/IX01/current-schema-installation.ts",
  "bytes": 3402,
  "sha256": "0dbd658f8b9d2b484b731b04342db33d2dec216ca9ed9ac0810c9c32323f3cc1",
  "format": "module-typescript"
 }
].map(row=>Object.freeze(row)));
const runtimePaths=new Set(["contracts/canonical.ts","contracts/runtime/validation-v1.ts","scripts/qa-fn03-tc01-dependency-authorized-entry.ts","scripts/qa-fn03-tc01-dependency-carrier-entry.ts","scripts/qa-fn03-tc01-dependency-carrier-wire.ts","scripts/qa-fn03-tc01-dependency-evidence.ts","scripts/qa-fn03-tc01-dependency-intake.ts","scripts/qa-fn03-tc01-dependency-native-ports.ts","scripts/qa-fn03-tc01-dependency-preparation.ts","scripts/qa-ix01-current-journey.ts","tests/integration/IX01/current-schema-baseline.ts","tests/integration/IX01/current-schema-installation.ts"]);
const imports=Object.freeze([
 {
  "parent": "contracts/canonical.ts",
  "specifier": "node:crypto",
  "target": "node:crypto"
 },
 {
  "parent": "contracts/runtime/validation-v1.ts",
  "specifier": "../canonical.ts",
  "target": "contracts/canonical.ts"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-authorized-entry.ts",
  "specifier": "../contracts/canonical.ts",
  "target": "contracts/canonical.ts"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-authorized-entry.ts",
  "specifier": "./qa-fn03-tc01-dependency-carrier-entry.ts",
  "target": "scripts/qa-fn03-tc01-dependency-carrier-entry.ts"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-authorized-entry.ts",
  "specifier": "./qa-fn03-tc01-dependency-carrier-wire.ts",
  "target": "scripts/qa-fn03-tc01-dependency-carrier-wire.ts"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-authorized-entry.ts",
  "specifier": "./qa-fn03-tc01-dependency-native-ports.ts",
  "target": "scripts/qa-fn03-tc01-dependency-native-ports.ts"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-authorized-entry.ts",
  "specifier": "./qa-ix01-current-journey.ts",
  "target": "scripts/qa-ix01-current-journey.ts"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-authorized-entry.ts",
  "specifier": "node:path",
  "target": "node:path"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-authorized-entry.ts",
  "specifier": "node:util",
  "target": "node:util"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-carrier-entry.ts",
  "specifier": "../contracts/canonical.ts",
  "target": "contracts/canonical.ts"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-carrier-entry.ts",
  "specifier": "./qa-fn03-tc01-dependency-carrier-wire.ts",
  "target": "scripts/qa-fn03-tc01-dependency-carrier-wire.ts"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-carrier-entry.ts",
  "specifier": "./qa-fn03-tc01-dependency-intake.ts",
  "target": "scripts/qa-fn03-tc01-dependency-intake.ts"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-carrier-entry.ts",
  "specifier": "node:util",
  "target": "node:util"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-carrier-wire.ts",
  "specifier": "../contracts/canonical.ts",
  "target": "contracts/canonical.ts"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-carrier-wire.ts",
  "specifier": "../contracts/runtime/validation-v1.ts",
  "target": "contracts/runtime/validation-v1.ts"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-carrier-wire.ts",
  "specifier": "node:path",
  "target": "node:path"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-carrier-wire.ts",
  "specifier": "node:util",
  "target": "node:util"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-evidence.ts",
  "specifier": "../contracts/canonical.ts",
  "target": "contracts/canonical.ts"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-evidence.ts",
  "specifier": "../contracts/runtime/validation-v1.ts",
  "target": "contracts/runtime/validation-v1.ts"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-evidence.ts",
  "specifier": "node:crypto",
  "target": "node:crypto"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-evidence.ts",
  "specifier": "node:path",
  "target": "node:path"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-evidence.ts",
  "specifier": "node:util",
  "target": "node:util"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-intake.ts",
  "specifier": "../contracts/runtime/validation-v1.ts",
  "target": "contracts/runtime/validation-v1.ts"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-intake.ts",
  "specifier": "./qa-fn03-tc01-dependency-evidence.ts",
  "target": "scripts/qa-fn03-tc01-dependency-evidence.ts"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-intake.ts",
  "specifier": "./qa-fn03-tc01-dependency-preparation.ts",
  "target": "scripts/qa-fn03-tc01-dependency-preparation.ts"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-intake.ts",
  "specifier": "node:crypto",
  "target": "node:crypto"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-intake.ts",
  "specifier": "node:util",
  "target": "node:util"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-native-ports.ts",
  "specifier": "../contracts/canonical.ts",
  "target": "contracts/canonical.ts"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-native-ports.ts",
  "specifier": "./qa-ix01-current-journey.ts",
  "target": "scripts/qa-ix01-current-journey.ts"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-native-ports.ts",
  "specifier": "node:child_process",
  "target": "node:child_process"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-native-ports.ts",
  "specifier": "node:events",
  "target": "node:events"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-native-ports.ts",
  "specifier": "node:fs",
  "target": "node:fs"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-native-ports.ts",
  "specifier": "node:path",
  "target": "node:path"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-native-ports.ts",
  "specifier": "node:util",
  "target": "node:util"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-preparation.ts",
  "specifier": "../contracts/canonical.ts",
  "target": "contracts/canonical.ts"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-preparation.ts",
  "specifier": "./qa-ix01-current-journey.ts",
  "target": "scripts/qa-ix01-current-journey.ts"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-preparation.ts",
  "specifier": "node:crypto",
  "target": "node:crypto"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-preparation.ts",
  "specifier": "node:events",
  "target": "node:events"
 },
 {
  "parent": "scripts/qa-fn03-tc01-dependency-preparation.ts",
  "specifier": "node:util",
  "target": "node:util"
 },
 {
  "parent": "scripts/qa-ix01-current-journey.ts",
  "specifier": "../contracts/canonical.ts",
  "target": "contracts/canonical.ts"
 },
 {
  "parent": "scripts/qa-ix01-current-journey.ts",
  "specifier": "../tests/integration/IX01/current-schema-baseline.ts",
  "target": "tests/integration/IX01/current-schema-baseline.ts"
 },
 {
  "parent": "scripts/qa-ix01-current-journey.ts",
  "specifier": "../tests/integration/IX01/current-schema-installation.ts",
  "target": "tests/integration/IX01/current-schema-installation.ts"
 },
 {
  "parent": "scripts/qa-ix01-current-journey.ts",
  "specifier": "node:child_process",
  "target": "node:child_process"
 },
 {
  "parent": "scripts/qa-ix01-current-journey.ts",
  "specifier": "node:crypto",
  "target": "node:crypto"
 },
 {
  "parent": "scripts/qa-ix01-current-journey.ts",
  "specifier": "node:fs",
  "target": "node:fs"
 },
 {
  "parent": "scripts/qa-ix01-current-journey.ts",
  "specifier": "node:perf_hooks",
  "target": "node:perf_hooks"
 },
 {
  "parent": "scripts/qa-ix01-current-journey.ts",
  "specifier": "node:url",
  "target": "node:url"
 },
 {
  "parent": "scripts/qa-ix01-current-journey.ts",
  "specifier": "node:util",
  "target": "node:util"
 },
 {
  "parent": "tests/integration/IX01/current-schema-baseline.ts",
  "specifier": "node:crypto",
  "target": "node:crypto"
 },
 {
  "parent": "tests/integration/IX01/current-schema-baseline.ts",
  "specifier": "node:util",
  "target": "node:util"
 },
 {
  "parent": "tests/integration/IX01/current-schema-installation.ts",
  "specifier": "./current-schema-baseline.ts",
  "target": "tests/integration/IX01/current-schema-baseline.ts"
 }
].map(edge=>Object.freeze(edge)));
const builtins=Object.freeze(["node:child_process","node:crypto","node:events","node:fs","node:path","node:perf_hooks","node:url","node:util"]);
const prehookPaths=Object.freeze(['contracts/canonical.ts','contracts/runtime/validation-v1.ts','scripts/qa-fn03-tc01-pinned-load.ts']);
const node=Object.freeze({path:'/opt/node-v24.22.1-linux-x64/bin/node',sha256:'e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb'});

export interface Tc01DependencyLinuxBootstrap {
 now():number;monotonic():number;
 /** 외부 감독이 최초 bootstrap 자체, 실제 Node 및 이미 적재한 prehook 3파일의 원 bytes,
  * 동일 승인/HEAD/closure와 현재성을 독립 검산한다. void나 입력 byte가 그 권위를 발급하지 않는다. */
 verifyBootstrap(request:Readonly<Record<string,unknown>>):void;
 /** 검산된 같은 HEAD의 exact 13행과 실제 적재에 사용한 prehook 원 3행만 공급한다.
  * 반환 exact {files,loadedPrehookFiles}; 각각 정렬된 {path,bytes:Uint8Array} 배열. */
 takeSourceFiles(request:Readonly<Record<string,unknown>>):unknown;
}
export interface Tc01DependencyLinuxInput {
 wire:Uint8Array;expected:unknown;
 supervisor:Tc01DependencyAuthorizationSupervisor;system:Tc01DependencyAuthorizationSystem;
}
const fail=():never=>{throw Error('TC01_DEPENDENCY_LINUX_ENTRY_UNKNOWN');};
function check(v:unknown):asserts v{if(!v)fail();}
function record(v:unknown,keys:readonly string[]):Record<string,any>{
 check(v!==null&&typeof v==='object'&&!types.isProxy(v)&&!Array.isArray(v));
 const d=Object.getOwnPropertyDescriptors(v);check(Reflect.ownKeys(d).length===keys.length);
 const out:Record<string,any>=Object.create(null);for(const k of keys){const x=d[k];check(x&&'value'in x);out[k]=x.value;}return out;
}
function array(v:unknown,n:number):unknown[]{
 check(Array.isArray(v)&&!types.isProxy(v));const d=Object.getOwnPropertyDescriptors(v) as unknown as Record<string,PropertyDescriptor>;
 check(d.length?.value===n&&Reflect.ownKeys(d).length===n+1);return Array.from({length:n},(_,i)=>{const x=d[String(i)];check(x&&'value'in x);return x.value;});
}
const typed=Object.getPrototypeOf(Uint8Array.prototype),lengthOf=Object.getOwnPropertyDescriptor(typed,'byteLength')!.get!,bufferOf=Object.getOwnPropertyDescriptor(typed,'buffer')!.get!;
function copy(v:unknown,max:number,owned:Buffer[]):Buffer{
 check(!types.isProxy(v)&&types.isUint8Array(v)&&types.isArrayBuffer(bufferOf.call(v)));const n=lengthOf.call(v);check(n>0&&n<=max);
 const b=Buffer.alloc(n);owned.push(b);Uint8Array.prototype.set.call(b,v);return b;
}
const planKeys=['schemaVersion','purpose','profile','attemptId','sourceHead','issuedAt','expiresAt','sourceRoot','preparationRoot','receiptRoot','packageLockSha256','source','recipe','commandSha256'];
const supervisorKeys=['now','monotonic','assertCurrent','verifySource','retainChild'];
const systemKeys=['context','lstat','fstat','realpath','mkdir','open','read','sync','close','readdir','spawn','umask','setTimeout','clearTimeout','write'];
const bootstrapKeys=['now','monotonic','verifyBootstrap','takeSourceFiles'];
const unknown=()=>Object.freeze({status:'UNKNOWN' as const,code:'DEPENDENCY_LINUX_ENTRY_UNKNOWN' as const,authority:'NOT_ISSUED' as const});
// 같은 canonical module instance에서만 배타. 전체 프로세스의 단일 적재 URL/다른 hook 부재는 외부 감독 전제.
let hookOwner:object|undefined;
/** 고정 설치 모듈을 원 소유 bytes로만 적재한다. import/factory 효과0, 기본 OS/CLI 없음.
 * 이 모듈과 pre-hook 3파일을 disk import한 뒤 같은 hash를 읽는 사후 검산은 최초 신뢰를 대체하지 않는다.
 * 외부 감독이 최초 적재 신원·module cache·원 파일 공급·원 process 종결을 먼저 보유해야 한다.
 * 고정 graph는 current-journey의 main/actualPorts/R9를 호출하지 않으며 data/추가 import를 허용하지 않는다.
 */
export function createTc01DependencyLinuxEntry(bootstrap:Tc01DependencyLinuxBootstrap){
 let spent=false;
 return Object.freeze({async run(input:Tc01DependencyLinuxInput):Promise<string|ReturnType<typeof unknown>>{
  if(spent)return unknown();spent=true;const owned:Buffer[]=[];let loader:ReturnType<typeof createTc01PinnedLoad>|undefined,lease:object|undefined;
  let answer:string|ReturnType<typeof unknown>=unknown();
  try{
   const i=record(input,['wire','expected','supervisor','system']),e=record(i.expected,['plan','planHash','approvalHash','approvalId']),p=record(e.plan,planKeys),source=record(p.source,['entry','sha256','closureSha256']);
   check(Object.entries(p).every(([k,v])=>k==='source'||typeof v==='string'||typeof v==='number')&&Object.values(source).every(v=>typeof v==='string')&&['planHash','approvalHash','approvalId'].every(k=>typeof e[k]==='string'));
   p.source=Object.freeze(source);e.plan=Object.freeze(p);Object.freeze(e);
   check(p.sourceHead===sourceHead&&p.schemaVersion===1&&p.purpose==='TC01_DEPENDENCY_PREPARATION'&&p.profile==='TC01_DEPENDENCY_PREPARATION_ENTRY_V1'&&p.recipe==='TC01_DEPENDENCY_RECIPE_CANDIDATE_V1');
   check(typeof p.attemptId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(p.attemptId));
   check(source.entry==='scripts/qa-fn03-tc01-dependency-intake.ts'&&source.sha256===rows.find(r=>r.path===source.entry)!.sha256&&/^[a-f0-9]{64}$/.test(source.closureSha256));
   check(Number.isSafeInteger(p.issuedAt)&&p.issuedAt>=0&&Number.isSafeInteger(p.expiresAt)&&p.expiresAt>p.issuedAt&&p.expiresAt-p.issuedAt<=1800000);
   const root='/home/daon/anvil-fn03-tc01-'+p.attemptId+'-qa',base='/home/daon/.local/share/anvil-v3-qa-receipts/fn03-tc01-'+p.attemptId;
   check(p.sourceRoot===root&&p.preparationRoot===base+'-dependency-preparation'&&p.receiptRoot===base+'-dependency-consumption');
   const wire=copy(i.wire,16384,owned),b=record(bootstrap,bootstrapKeys),s=record(i.supervisor,supervisorKeys),io=record(i.system,systemKeys);
   check(bootstrapKeys.every(k=>typeof b[k]==='function')&&supervisorKeys.every(k=>typeof s[k]==='function')&&systemKeys.every(k=>typeof io[k]==='function'));
   let wall=-1,mono=-1,until=Infinity;
   const clock=()=>{const w=b.now.call(bootstrap),m=b.monotonic.call(bootstrap);check(Number.isSafeInteger(w)&&w>=p.issuedAt&&w>=wall&&w<p.expiresAt&&Number.isSafeInteger(m)&&m>=0&&m>=mono&&m<until);until=Math.min(until,m+p.expiresAt-w);wall=w;mono=m;};
   const identity=()=>{for(const [owner,keys,pin]of [[bootstrap,bootstrapKeys,b],[i.supervisor,supervisorKeys,s],[i.system,systemKeys,io]] as const){const v=record(owner,keys);check(keys.every(k=>v[k]===pin[k]));}};
   const request=Object.freeze({expected:e,node,bootstrapURL:import.meta.url,sourceHead,rows,prehook:Object.freeze(rows.filter(r=>prehookPaths.includes(r.path))),entry:entryPath,dependencies:Object.freeze([]),builtins,imports});
   const guard=()=>{identity();clock();check(b.verifyBootstrap.call(bootstrap,request)===undefined);identity();clock();loader?.assertHealthy();};
   guard();const supplied=record(b.takeSourceFiles.call(bootstrap,request),['files','loadedPrehookFiles']);
   // 소유 복사본부터 고정한다. 후속 callback에는 공개 pin만 전달하며 원 bytes는 전달하지 않는다.
   const files=array(supplied.files,rows.length).map((value,index)=>{const f=record(value,['path','bytes']),pin=rows[index]!;check(f.path===pin.path);const raw=copy(f.bytes,pin.bytes,owned);check(raw.length===pin.bytes&&contentHash(raw)===pin.sha256);return {path:pin.path,bytes:raw};});
   for(const [index,value]of array(supplied.loadedPrehookFiles,prehookPaths.length).entries()){const f=record(value,['path','bytes']),path=prehookPaths[index]!,pin=rows.find(r=>r.path===path)!;check(f.path===path);const raw=copy(f.bytes,pin.bytes,owned);check(raw.length===pin.bytes&&contentHash(raw)===pin.sha256);}
   guard();check(hookOwner===undefined);lease=Object.freeze({});hookOwner=lease;
   const manifest=Buffer.from(canonicalJson({schemaVersion:1,attemptId:p.attemptId,root,entry:entryPath,sources:rows.filter(r=>runtimePaths.has(r.path)),dependencies:[],builtins,imports}));owned.push(manifest);
   loader=createTc01PinnedLoad({attemptId:p.attemptId,manifestSha256:contentHash(manifest),manifestBytes:manifest,files:files.filter(f=>runtimePaths.has(f.path))});
   guard();loader.register();const loaded=await import(loader.entryURL);guard();
   check(Object.keys(loaded).length===1&&Object.keys(loaded)[0]==='createTc01DependencyAuthorizedEntry'&&typeof loaded.createTc01DependencyAuthorizedEntry==='function');
   const supervisor=Object.freeze({
    now:()=>s.now.call(i.supervisor),monotonic:()=>s.monotonic.call(i.supervisor),
    assertCurrent:(expected:Readonly<Record<string,unknown>>)=>{guard();check(canonicalJson(expected)===canonicalJson(e)&&s.assertCurrent.call(i.supervisor,expected)===undefined);guard();},
    verifySource:(r:Readonly<Record<string,unknown>>)=>{guard();check(s.verifySource.call(i.supervisor,r)===undefined);guard();},
    // 기한 상실 뒤에도 원 child 회수 책임은 외부 supervisor에 반환한다.
    retainChild:(child:unknown)=>s.retainChild.call(i.supervisor,child),
   });
   const system=Object.freeze(Object.fromEntries(systemKeys.map(k=>[k,(...args:unknown[])=>io[k].apply(i.system,args)])));
   const receiver=loaded.createTc01DependencyAuthorizedEntry(supervisor,system);check(record(receiver,['run'])&&typeof receiver.run==='function');guard();
   const result=await receiver.run(wire,e);guard();
   // 고정 원 receiver가 readTc01DependencyCarrierResult를 이미 사용한다. manifest 판독기를 중복 구현하지 않는다.
   check(typeof result==='string'&&Buffer.byteLength(result,'utf8')<=4210688);
   const r=record(parseWireJson(result),['schemaVersion','kind','binding','result']),candidate=record(r.result,['status','authority','manifestRaw','manifestSha256']);
   check(r.schemaVersion===1&&r.kind==='TC01_DEPENDENCY_RESULT_V1'&&candidate.status==='CANDIDATE_ONLY'&&candidate.authority==='NOT_ISSUED');
   guard();answer=result;
  }catch{answer=unknown();}finally{
   let revoked=false;try{loader?.revoke();revoked=true;}catch{answer=unknown();}finally{for(const raw of owned)Uint8Array.prototype.fill.call(raw,0);if(revoked&&lease&&hookOwner===lease)hookOwner=undefined;}
  }
  return answer;
 }});
}
