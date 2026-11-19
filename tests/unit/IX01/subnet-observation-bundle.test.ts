import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {Script,createContext} from 'node:vm';
import {readFileSync} from 'node:fs';

const head='5c7e889ffabe3e4d0e13800d8999e2cda1f0407c';
const expected=[
 ['scripts/qa-ix01-subnet-observation-host.ts',13836,'6c5edf5eb8bc2612a184c12a58ff8eca363d1a094febfb085d9f75b7a14e5ae5'],
 ['scripts/qa-ix01-subnet-observation-payload.ts',7230,'6af0a95bd7b1eab602469eaf8fc9f3c193c224b099d37c6e3b8829645297df72'],
 ['scripts/qa-ix01-subnet-projection.ts',7376,'c43216df091683d7f5a4355570552121efdc23bff7d0953f29f2efb4d04b533e'],
 ['scripts/qa-ix01-subnet-candidate.ts',7314,'1ce97ab13fa4734f3306262fe4fc5f4af514a1329d11d822f1a7cb83f1280110'],
 ['contracts/canonical.ts',2986,'5be93c5b92a3bda99baa9bc561e6b535c9c1ab80196601e561903a0b6f74e143'],
]as const;
// 기존 정확 Git 원바이트만 읽는다. 원 호스트/도구/실자료와 실제 관측은 호출하지 않는다.
let originals:Map<string,Buffer>|undefined;
function source(){return originals??=new Map(expected.map(([path])=>[path,execFileSync('git',['cat-file','blob',head+':'+path],{cwd:new URL('../../../',import.meta.url),maxBuffer:100_000})]));}
const hash=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');

test('subnet bundle: 고정 5개 Git LF 원바이트로 결정적인 독립 CJS와 지문을 만든다',async()=>{
 const {buildSubnetObservationBundle,SUBNET_OBSERVATION_SOURCES}=await import('../../../scripts/qa-ix01-subnet-observation-bundle.ts');
 assert.deepEqual(SUBNET_OBSERVATION_SOURCES.map(v=>[v.path,v.bytes,v.sha256]),expected);
 const calls:string[]=[],read=(path:string)=>{calls.push(path);return source().get(path)!;};
 const a=await buildSubnetObservationBundle(read),b=await buildSubnetObservationBundle(read);
 assert.deepEqual(calls,[...expected.map(v=>v[0]),...expected.map(v=>v[0])]);
 assert.deepEqual(a.moduleOrder,['contracts/canonical.ts','scripts/qa-ix01-subnet-candidate.ts','scripts/qa-ix01-subnet-projection.ts','scripts/qa-ix01-subnet-observation-payload.ts','scripts/qa-ix01-subnet-observation-host.ts']);
 assert.deepEqual(a.generatedModules,['\0rolldown/runtime.js']);
 assert.deepEqual(a.builtins,['node:child_process','node:crypto','node:fs','node:net','node:os','node:perf_hooks','node:util']);
 assert.equal(a.byteLength,35390);assert.equal(a.sha256,'7374964b28227c507d9488a73b674074817e9a9b46712b68916f051f32a379e8');
 assert.equal(a.sourceHead,head);assert.equal(a.compiler,'rolldown');assert.equal(a.compilerVersion,'1.2.14');
 assert.equal(a.byteLength,a.bytes.byteLength);assert.equal(a.sha256,hash(a.bytes));assert.deepEqual(a.bytes,b.bytes);
 assert.notEqual(a.bytes,b.bytes);assert(a.byteLength>0&&a.byteLength<=262_144);
 const text=new TextDecoder('utf-8',{fatal:true}).decode(a.bytes);
 assert(!text.includes(process.cwd()));assert(!/(?:^|[\s"'])[A-Za-z]:[\\/]/.test(text));assert(!text.includes('sourceMappingURL'));assert(!text.includes('\r'));
 assert(text.includes('/opt/node-v24.22.1-linux-x64/bin/node'),'원 고정 도구 경로는 변경하지 않는다');
 assert.doesNotThrow(()=>new Script(text,{filename:'subnet-observation.cjs'}));
});

test('subnet bundle: 모듈 로드만으로 native host·process·파일·관측 호출을 하지 않는다',async()=>{
 const {buildSubnetObservationBundle}=await import('../../../scripts/qa-ix01-subnet-observation-bundle.ts');
 const result=await buildSubnetObservationBundle(path=>source().get(path)!);
 const require=createRequire(import.meta.url),loaded:string[]=[];let effects=0;
 const blocked=()=>{effects++;throw new Error('NATIVE_EFFECT_FORBIDDEN');};
 const module={exports:{} as Record<string,unknown>};
 const context=createContext({module,exports:module.exports,require:(name:string)=>{
  loaded.push(name);assert(name.startsWith('node:'));
  if(name==='node:child_process')return {spawnSync:blocked};
  if(name==='node:fs')return {constants:{},lstatSync:blocked,realpathSync:blocked,openSync:blocked,fstatSync:blocked,readSync:blocked,closeSync:blocked};
  if(name==='node:os')return {hostname:blocked};
  return require(name);
 }});
 new Script(new TextDecoder().decode(result.bytes)).runInContext(context,{timeout:1000});
 assert.deepEqual(Object.keys(module.exports),['observeSubnetOnHost']);assert.equal(typeof module.exports.observeSubnetOnHost,'function');assert.equal(effects,0);
 assert.deepEqual([...new Set(loaded)].sort(),['node:child_process','node:crypto','node:fs','node:net','node:os','node:perf_hooks','node:util']);
});

test('subnet bundle: 누락·원 지문/길이·UTF8 변경·읽기 예외를 고정 오류로 거절한다',async()=>{
 const {buildSubnetObservationBundle}=await import('../../../scripts/qa-ix01-subnet-observation-bundle.ts');
 for(const [path]of expected){for(const fault of ['missing','changed','short','utf8','throw']as const){
  const calls:string[]=[];
  await assert.rejects(()=>buildSubnetObservationBundle(p=>{calls.push(p);if(p!==path)return source().get(p)!;
   if(fault==='throw')throw new Error('PRIVATE_PATH_AND_CONTENT');
   if(fault==='missing')return undefined;
   const b=Buffer.from(source().get(p)!);if(fault==='short')return b.subarray(1);b[0]=fault==='utf8'?255:b[0]!^1;return b;
  }),{name:'Error',message:'SUBNET_BUNDLE_SOURCE_INVALID'});
  assert.deepEqual(calls,expected.slice(0,expected.findIndex(v=>v[0]===path)+1).map(v=>v[0]));
 }}
});

test('subnet bundle: proxy/비동기/shared 입력을 실행하지 않고 원 바이트 복사로 위조 접근자를 피한다',async()=>{
 const {buildSubnetObservationBundle}=await import('../../../scripts/qa-ix01-subnet-observation-bundle.ts');
 let traps=0;
 const proxy=new Proxy(new Uint8Array(1),{get(){traps++;throw Error('PRIVATE');}});
 const promise=Promise.resolve(new Uint8Array());Object.defineProperty(promise,'then',{get(){traps++;throw Error('PRIVATE');}});
 for(const value of [proxy,promise,new Uint8Array(new SharedArrayBuffer(1))])await assert.rejects(()=>buildSubnetObservationBundle(()=>value),{message:'SUBNET_BUNDLE_SOURCE_INVALID'});
 const b=await buildSubnetObservationBundle(path=>{const v=new Uint8Array(source().get(path)!);for(const key of ['length','byteLength','buffer','byteOffset'])Object.defineProperty(v,key,{get(){traps++;throw Error('PRIVATE');}});return v;});
 assert.equal(b.sha256,hash(b.bytes));assert.equal(traps,0);
});
test('subnet async bundle: 별도 exact closure·지문이며 메모리 평가가 원 도구를 호출하지 않는다',async()=>{
 const m=await import('../../../scripts/qa-ix01-subnet-observation-bundle.ts');assert.equal(typeof m.buildSubnetObservationAsyncBundle,'function');
 const calls:string[]=[],read=(path:string)=>{calls.push(path);return readFileSync(new URL('../../../'+path,import.meta.url));};
 const a=await m.buildSubnetObservationAsyncBundle(read),b=await m.buildSubnetObservationAsyncBundle(read);
 assert.equal(a.sourceHead,null);assert.equal(a.baselineHead,'95ea7c4d98b9db87b35a449232193e6d16b032a5');
 assert.deepEqual(calls,[...a.sources.map(v=>v.path),...a.sources.map(v=>v.path)]);assert.equal(a.sources.length,8);
 assert.deepEqual(a.moduleOrder,['scripts/qa-ix01-subnet-observation-steps.ts','contracts/canonical.ts','scripts/qa-ix01-subnet-candidate.ts','scripts/qa-ix01-subnet-projection.ts','scripts/qa-ix01-subnet-observation-payload.ts','scripts/qa-ix01-subnet-observation-host.ts','scripts/qa-ix01-subnet-observation-remote.ts','scripts/qa-ix01-subnet-observation-supervisor.ts','generated/subnet-observation-async-entry.ts']);
 assert.equal(a.byteLength,54294);assert.equal(a.sha256,'03221a628f348cc4c94dc40c75933c36e94eb2b0a94a6e09e1d53fc3d0debb1b');
 assert.equal(a.sha256,hash(a.bytes));assert.deepEqual(a.bytes,b.bytes);assert.notEqual(a.sha256,'7374964b28227c507d9488a73b674074817e9a9b46712b68916f051f32a379e8');
 const require=createRequire(import.meta.url),module={exports:{} as Record<string,unknown>};let effects=0;
 const blocked=()=>{effects++;throw Error('FORBIDDEN');};
 const context=createContext({module,exports:module.exports,require:(name:string)=>{
  assert(a.builtins.includes(name));if(name==='node:child_process')return {spawnSync:blocked};
  if(name==='node:fs')return {constants:{},lstatSync:blocked,realpathSync:blocked,openSync:blocked,fstatSync:blocked,readSync:blocked,closeSync:blocked};
  if(name==='node:os')return {hostname:blocked};return require(name);
 }});
 const text=new TextDecoder().decode(a.bytes);assert(!text.includes(process.cwd()));assert(!/(?:^|[\s"'])[A-Za-z]:[\\/]/.test(text));
 new Script(text).runInContext(context,{timeout:1000});assert.deepEqual(Object.keys(module.exports).sort(),['collectSubnetRemoteCompletion','observeSubnetRemote']);assert.equal(effects,0);
 await assert.rejects(()=>m.buildSubnetObservationAsyncBundle(path=>{const bytes=read(path);if(path.endsWith('remote.ts'))bytes[0]=bytes[0]!^1;return bytes;}),{message:'SUBNET_BUNDLE_SOURCE_INVALID'});
});
