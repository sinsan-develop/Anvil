import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
import {types} from 'node:util';

const sourceHead='4c44da5d432e561c672021eee14983562ac57b78';
const entryPin=Object.freeze({"path":"scripts/qa-fn03-tc01-dependency-linux-entry.ts","bytes":21426,"sha256":"59dbeab165bdd9ec333d084c5e03c86658634e6418198fe780a9e099ba8b9ea0"});
const sourcePins=Object.freeze([
 Object.freeze({"path":"contracts/canonical.ts","bytes":2986,"sha256":"5be93c5b92a3bda99baa9bc561e6b535c9c1ab80196601e561903a0b6f74e143"}),
 Object.freeze({"path":"contracts/runtime/validation-v1.ts","bytes":1523,"sha256":"bdfbe4a380c38f5cf3fb885ac167d9bf2c869b30faac540ceeab20bb16bee5d6"}),
 Object.freeze({"path":"scripts/qa-fn03-tc01-dependency-authorized-entry.ts","bytes":15596,"sha256":"691f540d32da8a0c98c993ecc09c3a63c0788cdcff4d64a21b3b71b6dd9cff34"}),
 Object.freeze({"path":"scripts/qa-fn03-tc01-dependency-carrier-entry.ts","bytes":7948,"sha256":"97d272bc776cd54992ae8da246e840d609f53806406fd540e15feb811557e615"}),
 Object.freeze({"path":"scripts/qa-fn03-tc01-dependency-carrier-wire.ts","bytes":8660,"sha256":"0fd5115f692ffbd7b3bac2cff100fdaef892d484d27b488e0c04edfa0240e4b9"}),
 Object.freeze({"path":"scripts/qa-fn03-tc01-dependency-evidence.ts","bytes":9019,"sha256":"9d04f02138f92e7ed0d658b1d9c025989988642b053dcc909f66881567843268"}),
 Object.freeze({"path":"scripts/qa-fn03-tc01-dependency-intake.ts","bytes":6600,"sha256":"be189d368418e5963a958fe2a4dbaf4038f0a992a88031cb183840dd40733f25"}),
 Object.freeze({"path":"scripts/qa-fn03-tc01-dependency-native-ports.ts","bytes":18252,"sha256":"485f8fc220a8b956a8bfce0a413af1dc0cfb624dc900ab8e2c942c1c81519117"}),
 Object.freeze({"path":"scripts/qa-fn03-tc01-dependency-preparation.ts","bytes":12133,"sha256":"dbedab6fe7467464b413844639e67b19259fef75131ad416c50e6bf087f6a602"}),
 Object.freeze({"path":"scripts/qa-fn03-tc01-pinned-load.ts","bytes":12568,"sha256":"cc8a6bf00683a6d18ac28f552d5f07182d2632f6d48115f40572ab8a9c9d6b4b"}),
 Object.freeze({"path":"scripts/qa-ix01-current-journey.ts","bytes":64438,"sha256":"a3de404e3397741ceca76e61b766bb3cb240af83d765bf8a978dc4d9cff8a63b"}),
 Object.freeze({"path":"tests/integration/IX01/current-schema-baseline.ts","bytes":9378,"sha256":"6c574464a72cc64fb9f44476d1da6252a69fef2bce2157e95725a864b32d4f9c"}),
 Object.freeze({"path":"tests/integration/IX01/current-schema-installation.ts","bytes":3402,"sha256":"0dbd658f8b9d2b484b731b04342db33d2dec216ca9ed9ac0810c9c32323f3cc1"})
]);

const prehookPaths=Object.freeze(['contracts/canonical.ts','contracts/runtime/validation-v1.ts','scripts/qa-fn03-tc01-pinned-load.ts']);
const initialPins=Object.freeze([...sourcePins.filter(r=>prehookPaths.includes(r.path)),entryPin]);
const edges=Object.freeze([
 ['scripts/qa-fn03-tc01-dependency-linux-entry.ts','node:util','node:util'],
 ['scripts/qa-fn03-tc01-dependency-linux-entry.ts','../contracts/canonical.ts','contracts/canonical.ts'],
 ['scripts/qa-fn03-tc01-dependency-linux-entry.ts','./qa-fn03-tc01-pinned-load.ts','scripts/qa-fn03-tc01-pinned-load.ts'],
 ['scripts/qa-fn03-tc01-pinned-load.ts','node:util','node:util'],
 ['scripts/qa-fn03-tc01-pinned-load.ts','node:crypto','node:crypto'],
 ['scripts/qa-fn03-tc01-pinned-load.ts','node:module','node:module'],
 ['scripts/qa-fn03-tc01-pinned-load.ts','node:path','node:path'],
 ['scripts/qa-fn03-tc01-pinned-load.ts','../contracts/canonical.ts','contracts/canonical.ts'],
 ['scripts/qa-fn03-tc01-pinned-load.ts','../contracts/runtime/validation-v1.ts','contracts/runtime/validation-v1.ts'],
 ['contracts/runtime/validation-v1.ts','../canonical.ts','contracts/canonical.ts'],
 ['contracts/canonical.ts','node:crypto','node:crypto'],
].map(edge=>Object.freeze(edge)));
const node=Object.freeze({path:'/opt/node-v24.22.1-linux-x64/bin/node',sha256:'e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb'});
const startupKeys=['now','monotonic','assertStart','verifyBootstrap'];
const supervisorKeys=['now','monotonic','assertCurrent','verifySource','retainChild'];
const systemKeys=['context','lstat','fstat','realpath','mkdir','open','read','sync','close','readdir','spawn','umask','setTimeout','clearTimeout','write'];
/** @param {Uint8Array} bytes */
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=()=>{throw Error('TC01_DEPENDENCY_BOOTSTRAP_UNKNOWN');};
/** @param {unknown} ok */
function check(ok){if(!ok)fail();}
/** @param {any} v @param {readonly string[]} keys @returns {Record<string,any>} */
function record(v,keys){
 check(v!==null&&typeof v==='object'&&!types.isProxy(v)&&!Array.isArray(v));const d=Object.getOwnPropertyDescriptors(v);check(Reflect.ownKeys(d).length===keys.length);
 const out=Object.create(null);for(const k of keys){const x=d[k];check(x&&'value'in x);out[k]=x.value;}return out;
}
/** @param {any} v @param {number} n @returns {any[]} */
function array(v,n){check(Array.isArray(v)&&!types.isProxy(v));const d=Object.getOwnPropertyDescriptors(v);check(d.length?.value===n&&Reflect.ownKeys(d).length===n+1);return Array.from({length:n},(_,i)=>{const x=d[String(i)];check(x&&'value'in x);return x.value;});}
const typed=Object.getPrototypeOf(Uint8Array.prototype);
const byteLength=/** @type {()=>number} */(Object.getOwnPropertyDescriptor(typed,'byteLength')?.get),backing=/** @type {()=>ArrayBuffer} */(Object.getOwnPropertyDescriptor(typed,'buffer')?.get);
/** @param {any} v @param {number} limit @param {Buffer[]} buffers */
function own(v,limit,buffers){check(!types.isProxy(v)&&types.isUint8Array(v)&&types.isArrayBuffer(backing.call(v)));const n=byteLength.call(v);check(n>0&&n<=limit);const b=Buffer.alloc(n);buffers.push(b);Uint8Array.prototype.set.call(b,v);return b;}
/** @param {any} v @returns {any} */
function snapshot(v){let nodes=0,size=0;const active=new Set();
 /** @param {any} x @param {number} depth @returns {any} */
 function read(x,depth){check(++nodes<=128&&depth<=8);if(x===null||typeof x==='boolean')return x;if(typeof x==='number'){check(Number.isSafeInteger(x));return x;}if(typeof x==='string'){size+=Buffer.byteLength(x);check(size<=65536&&x.isWellFormed());return x;}check(x&&typeof x==='object'&&!types.isProxy(x)&&!Array.isArray(x)&&!active.has(x));active.add(x);try{const d=Object.getOwnPropertyDescriptors(x),out=Object.create(null);for(const key of Reflect.ownKeys(d)){if(typeof key!=='string')return fail();const p=d[key];check(p&&'value'in p&&p.enumerable);out[key]=read(p.value,depth+1);}return Object.freeze(out);}finally{active.delete(x);}}return read(v,0);}
const unknown=()=>Object.freeze({status:'UNKNOWN',code:'DEPENDENCY_BOOTSTRAP_UNKNOWN',authority:'NOT_ISSUED'});
// 같은 canonical module instance만의 단회 hook 소유권. 외부 고정 실행이 단일 URL/새 process/cache를 보장해야 한다.
/** @type {object|undefined} */ let hookOwner;

/** 최초 ESM 적재부: 정적 import는 Node builtin 3개뿐이며 factory/import는 효과0이다.
 * startup은 exact {now,monotonic,assertStart,verifyBootstrap} 함수 포트다.
 * assertStart가 실제 최초 Node/이 .mjs 원바이트, 빈 env/고정 ESM argv, 선행 hook/캐시 부재,
 * 동일 원 승인/HEAD/시간창을 독립 검산한다. 반환 void는 이 근거의 발급이 아니다.
 * 초기 hook 회수는 이미 평가된 Node module cache를 제거하지 않는다. 원 process 수명/종결은 외부 감독 책임이다.
 * input exact {entryBytes,files,input}; files는 같은 감독의 4c44 원 13행,
 * input은 기존 Linux-entry의 {wire,expected,supervisor,system} 그대로다.
 * 원 CLI stdin/실제 OS 포트의 생산자는 미연결이며 이를 임의 JSON이나 live default로 복원하지 않는다.
 * @param {any} startup
 */
export function createTc01DependencyBootstrapStart(startup){
 let spent=false;
 return Object.freeze({
 /** @param {any} value */
 async run(value){
  if(spent)return unknown();spent=true;const buffers=/** @type {Buffer[]} */([]);let registration,lease,poisoned=false,initialRevoked=false,revokeAttempted=false;
  /** @type {string|ReturnType<typeof unknown>} */ let answer=unknown();
  try{
   const packet=record(value,['entryBytes','files','input']),input=record(packet.input,['wire','expected','supervisor','system']),expected=snapshot(input.expected),p=record(expected.plan,['schemaVersion','purpose','profile','attemptId','sourceHead','issuedAt','expiresAt','sourceRoot','preparationRoot','receiptRoot','packageLockSha256','source','recipe','commandSha256']);
   check(p.sourceHead===sourceHead&&p.purpose==='TC01_DEPENDENCY_PREPARATION'&&p.profile==='TC01_DEPENDENCY_PREPARATION_ENTRY_V1'&&typeof p.attemptId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(p.attemptId));
   check(Number.isSafeInteger(p.issuedAt)&&p.issuedAt>=0&&Number.isSafeInteger(p.expiresAt)&&p.expiresAt>p.issuedAt&&p.expiresAt-p.issuedAt<=1800000);
   const wire=own(input.wire,16384,buffers),entry=own(packet.entryBytes,entryPin.bytes,buffers);check(entry.length===entryPin.bytes&&hash(entry)===entryPin.sha256);
   const files=array(packet.files,sourcePins.length).map((row,index)=>{const r=record(row,['path','bytes']),pin=sourcePins[index];check(r.path===pin.path);const bytes=own(r.bytes,pin.bytes,buffers);check(bytes.length===pin.bytes&&hash(bytes)===pin.sha256);return Object.freeze({path:pin.path,bytes});});
   const prehook=Object.freeze(files.filter(r=>prehookPaths.includes(r.path))),s=record(startup,startupKeys),supervisor=record(input.supervisor,supervisorKeys),system=record(input.system,systemKeys);
   check(startupKeys.every(k=>typeof s[k]==='function')&&supervisorKeys.every(k=>typeof supervisor[k]==='function')&&systemKeys.every(k=>typeof system[k]==='function'));
   const request=Object.freeze({bootstrapURL:import.meta.url,node,sourceHead,expected,entry:entryPin,initialSources:initialPins,initialEdges:edges,execArgv:Object.freeze([]),environment:'EMPTY',invocation:'FIXED_ESM_FILE_STDIN_INPUT'});
   let wall=-1,mono=-1,until=Infinity;
   const identity=()=>{for(const [owner,keys,pin]of [[startup,startupKeys,s],[input.supervisor,supervisorKeys,supervisor],[input.system,systemKeys,system]]){const r=record(owner,keys);check(keys.every(/** @param {string} k */k=>r[k]===pin[k]));}};
   const clock=()=>{const w=s.now.call(startup),m=s.monotonic.call(startup);check(Number.isSafeInteger(w)&&w>=p.issuedAt&&w>=wall&&w<p.expiresAt&&Number.isSafeInteger(m)&&m>=0&&m>=mono&&m<until);until=Math.min(until,m+p.expiresAt-w);wall=w;mono=m;};
   const guard=()=>{check(!poisoned);identity();clock();check(s.assertStart.call(startup,request)===undefined);identity();clock();};
   guard();check(hookOwner===undefined);lease=Object.freeze({});hookOwner=lease;
   // 가상 URL은 이 초기 4개 소유 바이트만 지칭한다. 실제 checkout/디스크 탐색을 하지 않는다.
   const base='file:///__anvil_dependency_initial__/'+p.attemptId+'/',entryURL=base+entryPin.path;
   const initial=new Map(),permitted=new Set(),loaded=new Set();for(const row of prehook)initial.set(base+row.path,row.bytes);initial.set(entryURL,entry);let entered=false;
   const edgeMap=new Map(edges.map(([parent,specifier,target])=>[base+parent+'\n'+specifier,target.startsWith('node:')?target:base+target]));
   const pinMap=new Map(initialPins.map(r=>[base+r.path,r]));
   /** @template T @param {()=>T} work @returns {T} */
   const bounded=work=>{try{check(!poisoned&&!initialRevoked);return work();}catch{poisoned=true;throw Error('TC01_DEPENDENCY_BOOTSTRAP_UNKNOWN');}};
   /** @param {any} value */ const attrs=value=>{check(value&&typeof value==='object'&&!types.isProxy(value)&&Reflect.ownKeys(value).length===0);};
   registration=registerHooks({
    resolve(specifier,context,_next){return bounded(()=>{attrs(context.importAttributes);let url;if(!entered&&specifier===entryURL){entered=true;url=entryURL;}else{check(typeof context.parentURL==='string'&&initial.has(context.parentURL)&&permitted.has(context.parentURL));url=edgeMap.get(context.parentURL+'\n'+specifier);if(!url)return fail();}permitted.add(url);return{url,shortCircuit:true};});},
    load(url,context,next){return bounded(()=>{check(permitted.has(url));attrs(context.importAttributes);if(url.startsWith('node:'))return next(url,{...context,format:'builtin'});const raw=initial.get(url),pin=pinMap.get(url);check(raw&&pin&&raw.length===pin.bytes&&hash(raw)===pin.sha256);check(context.format===undefined||context.format===null||context.format==='module-typescript');loaded.add(url);return{format:'module-typescript',source:Buffer.from(raw),shortCircuit:true};});},
   });
   const namespace=await import(entryURL);guard();check(loaded.size===4&&initialPins.every(r=>loaded.has(base+r.path)));
   check(Object.keys(namespace).length===1&&Object.keys(namespace)[0]==='createTc01DependencyLinuxEntry'&&typeof namespace.createTc01DependencyLinuxEntry==='function');
   // 첫 hook 해제 확인 전에는 두 번째 loader를 등록하지 않는다. 해제 불명은 lease를 보존한다.
   revokeAttempted=true;registration.deregister();registration=undefined;initialRevoked=true;guard();
   const bootstrap=Object.freeze({now:()=>s.now.call(startup),monotonic:()=>s.monotonic.call(startup),
    verifyBootstrap:/** @param {unknown} r */r=>{guard();check(s.verifyBootstrap.call(startup,r)===undefined);guard();},
    takeSourceFiles:()=>{guard();return Object.freeze({files:Object.freeze(files),loadedPrehookFiles:prehook});},
   });
   const boundSupervisor=Object.freeze(Object.fromEntries(supervisorKeys.map(k=>[k,/** @param {any[]} args */(...args)=>supervisor[k].apply(input.supervisor,args)])));
   const boundSystem=Object.freeze(Object.fromEntries(systemKeys.map(k=>[k,/** @param {any[]} args */(...args)=>system[k].apply(input.system,args)])));
   const runner=namespace.createTc01DependencyLinuxEntry(bootstrap);check(record(runner,['run'])&&typeof runner.run==='function');guard();
   const result=await runner.run(Object.freeze({wire,expected,supervisor:boundSupervisor,system:boundSystem}));guard();
   // 정확 고정 Linux-entry는 이미 원 receiver의 CANDIDATE_ONLY wire만 반환한다.
   check(typeof result==='string'&&Buffer.byteLength(result)<=4210688);answer=result;
  }catch{answer=unknown();}finally{
   let released=initialRevoked;try{if(registration&&!revokeAttempted){revokeAttempted=true;registration.deregister();registration=undefined;released=true;}else if(!lease)released=true;}catch{answer=unknown();}
   finally{for(const raw of buffers)Uint8Array.prototype.fill.call(raw,0);if(released&&lease&&hookOwner===lease)hookOwner=undefined;}
  }
  return answer;
 }});
}
