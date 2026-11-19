import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {rolldown,VERSION,type RolldownBuild} from 'rolldown';

const sourceHead='5c7e889ffabe3e4d0e13800d8999e2cda1f0407c';
const compilerVersion='1.2.14';
export const SUBNET_OBSERVATION_SOURCES=Object.freeze([
 {path:'scripts/qa-ix01-subnet-observation-host.ts',bytes:13836,sha256:'6c5edf5eb8bc2612a184c12a58ff8eca363d1a094febfb085d9f75b7a14e5ae5'},
 {path:'scripts/qa-ix01-subnet-observation-payload.ts',bytes:7230,sha256:'6af0a95bd7b1eab602469eaf8fc9f3c193c224b099d37c6e3b8829645297df72'},
 {path:'scripts/qa-ix01-subnet-projection.ts',bytes:7376,sha256:'c43216df091683d7f5a4355570552121efdc23bff7d0953f29f2efb4d04b533e'},
 {path:'scripts/qa-ix01-subnet-candidate.ts',bytes:7314,sha256:'1ce97ab13fa4734f3306262fe4fc5f4af514a1329d11d822f1a7cb83f1280110'},
 {path:'contracts/canonical.ts',bytes:2986,sha256:'5be93c5b92a3bda99baa9bc561e6b535c9c1ab80196601e561903a0b6f74e143'},
].map(v=>Object.freeze(v)));
const builtins=Object.freeze(['node:child_process','node:crypto','node:fs','node:os','node:perf_hooks','node:util','node:net']);
const dependencies:Readonly<Record<string,Readonly<Record<string,string>>>>=Object.freeze({
 'scripts/qa-ix01-subnet-observation-host.ts':Object.freeze({
  'node:child_process':'node:child_process','node:crypto':'node:crypto','node:fs':'node:fs','node:os':'node:os','node:perf_hooks':'node:perf_hooks','node:util':'node:util',
  './qa-ix01-subnet-observation-payload.ts':'scripts/qa-ix01-subnet-observation-payload.ts',
 }),
 'scripts/qa-ix01-subnet-observation-payload.ts':Object.freeze({
  'node:util':'node:util','../contracts/canonical.ts':'contracts/canonical.ts','./qa-ix01-subnet-projection.ts':'scripts/qa-ix01-subnet-projection.ts',
 }),
 'scripts/qa-ix01-subnet-projection.ts':Object.freeze({
  'node:net':'node:net','node:util':'node:util','../contracts/canonical.ts':'contracts/canonical.ts','./qa-ix01-subnet-candidate.ts':'scripts/qa-ix01-subnet-candidate.ts',
 }),
 'scripts/qa-ix01-subnet-candidate.ts':Object.freeze({'node:util':'node:util'}),
 'contracts/canonical.ts':Object.freeze({'node:crypto':'node:crypto'}),
});
const typedArrayPrototype=Object.getPrototypeOf(Uint8Array.prototype);
const byteLength=Object.getOwnPropertyDescriptor(typedArrayPrototype,'byteLength')!.get!;
const backing=Object.getOwnPropertyDescriptor(typedArrayPrototype,'buffer')!.get!;
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
function reject():never{throw new Error('SUBNET_BUNDLE_SOURCE_INVALID');}
function sourceCopy(value:unknown,length:number):Uint8Array<ArrayBuffer>{
 if(types.isProxy(value)||!types.isUint8Array(value)||byteLength.call(value)!==length||types.isSharedArrayBuffer(backing.call(value)))return reject();
 const copy=new Uint8Array(length);Uint8Array.prototype.set.call(copy,value);return copy;
}
const virtual=(path:string)=>'\0ix01/'+path;
const generatedRuntime='\0rolldown/runtime.js';
const outputSha256='7374964b28227c507d9488a73b674074817e9a9b46712b68916f051f32a379e8';
const moduleOrder=Object.freeze(['contracts/canonical.ts','scripts/qa-ix01-subnet-candidate.ts','scripts/qa-ix01-subnet-projection.ts','scripts/qa-ix01-subnet-observation-payload.ts','scripts/qa-ix01-subnet-observation-host.ts']);

/** checkout/파일 쓰기/프로세스/네트워크 없는 빌드 단위다.
 * reader는 고정 상대 경로의 Git LF 원바이트만 공급한다. 실패 원문을 반환하지 않는다.
 * 출력에는 observeSubnetOnHost export만 있으며 호출·승인·SSH·외부 감독을 추가하지 않는다.
 * 원 5소스의 고정 Linux 도구 경로는 보존한다. 빌드 cwd나 파일 절대 경로는 사용하지 않는다.
 * compilerVersion은 실제 로드된 Rolldown(TS 변환 포함)의 버전 검산이다. 도구 파일 신원을
 * 증명하지 않으며, 설치된 TypeScript의 미제공 transpileModule을 대체한다고 위장하지 않는다.
 */
export async function buildSubnetObservationBundle(readSource:(path:string)=>unknown){
 let build:RolldownBuild|undefined;
 try{
  if(typeof readSource!=='function'||types.isProxy(readSource))return reject();
  if(VERSION!==compilerVersion)throw new Error('COMPILER_MISMATCH');
  const sources=SUBNET_OBSERVATION_SOURCES.map(pin=>{
   const bytes=sourceCopy(readSource(pin.path),pin.bytes);
   if(hash(bytes)!==pin.sha256)return reject();
   const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
   if(text.includes('\r')||!Buffer.from(text,'utf8').equals(Buffer.from(bytes)))return reject();
   return {pin,text};
  });
  const entry=SUBNET_OBSERVATION_SOURCES[0]!.path;
  const loaded=new Set<string>(),map=new Map(sources.map(v=>[virtual(v.pin.path),v]));
  build=await rolldown({input:virtual(entry),cwd:'/',platform:'neutral',tsconfig:false,treeshake:false,
   onLog(){reject();},plugins:[{name:'ix01-exact-memory-sources',
    resolveId(id,importer){
     if(importer===undefined){if(id!==virtual(entry))return reject();return id;}
     const source=map.get(importer);if(!source)return reject();
     const edge=dependencies[source.pin.path]!;
     if(!Object.hasOwn(edge,id))return reject();const target=edge[id]!;
     return builtins.includes(target)?{id:target,external:true}:virtual(target);
    },
    load(id){const source=map.get(id);if(!source||loaded.has(id))return reject();loaded.add(id);return {code:source.text,moduleType:'ts',map:null};},
   }],
  });
  const output=await build.generate({format:'cjs',exports:'named',sourcemap:false,minify:false,comments:false,strictExecutionOrder:true});
  const chunk=output.output[0];
  if(output.output.length!==1||!chunk||chunk.type!=='chunk'||!chunk.isEntry||chunk.facadeModuleId!==virtual(entry)||chunk.dynamicImports.length||chunk.map||chunk.exports.length!==1||chunk.exports[0]!=='observeSubnetOnHost')return reject();
  if(loaded.size!==sources.length||[...map.keys()].some(id=>!loaded.has(id)))return reject();
  const imports=[...new Set(chunk.imports)].sort();
  if(JSON.stringify(imports)!==JSON.stringify([...builtins].sort()))return reject();
  const moduleIds=Object.keys(chunk.modules);
  // strictExecutionOrder가 만드는 단일 compiler helper는 원 소스가 아니다.
  // 다른 생성 모듈/순서와 변경된 완성 출력은 모두 거절한다.
  if(JSON.stringify(moduleIds)!==JSON.stringify([generatedRuntime,...moduleOrder.map(virtual)]))return reject();
  const text=chunk.code;
  const bytes=new Uint8Array(Buffer.from(text,'utf8'));
  if(bytes.byteLength>262_144||hash(bytes)!==outputSha256)return reject();
  return Object.freeze({sourceHead,compiler:'rolldown',compilerVersion:VERSION,sources:SUBNET_OBSERVATION_SOURCES,entry,
   moduleOrder,generatedModules:Object.freeze([generatedRuntime]),builtins:Object.freeze(imports),bytes,byteLength:bytes.byteLength,sha256:hash(bytes)});
 }catch{return reject();}
 finally{if(build)try{await build.close();}catch{reject();}}
}
