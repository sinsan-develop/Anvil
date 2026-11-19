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
type SourcePin=Readonly<{path:string;bytes:number;sha256:string}>;
type BundleProfile={sources:readonly SourcePin[];entry:string;edges:Readonly<Record<string,Readonly<Record<string,string>>>>;builtins:readonly string[];order:readonly string[];exports:readonly string[];sha256:string;generated?:Readonly<{path:string;text:string}>};
async function buildPinnedBundle(readSource:(path:string)=>unknown,profile:BundleProfile){
 let build:RolldownBuild|undefined;
 try{
  if(typeof readSource!=='function'||types.isProxy(readSource))return reject();
  if(VERSION!==compilerVersion)throw new Error('COMPILER_MISMATCH');
  const sources=profile.sources.map(pin=>{
   const bytes=sourceCopy(readSource(pin.path),pin.bytes);
   if(hash(bytes)!==pin.sha256)return reject();
   const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
   if(text.includes('\r')||!Buffer.from(text,'utf8').equals(Buffer.from(bytes)))return reject();
   return {pin,text};
  });
  const entry=profile.entry;
  if(profile.generated){const text=profile.generated.text,bytes=Buffer.from(text);sources.push({pin:{path:profile.generated.path,bytes:bytes.length,sha256:hash(bytes)},text});}
  const loaded=new Set<string>(),map=new Map(sources.map(v=>[virtual(v.pin.path),v]));
  build=await rolldown({input:virtual(entry),cwd:'/',platform:'neutral',tsconfig:false,treeshake:false,
   onLog(){reject();},plugins:[{name:'ix01-exact-memory-sources',
    resolveId(id,importer){
     if(importer===undefined){if(id!==virtual(entry))return reject();return id;}
     const source=map.get(importer);if(!source)return reject();
     const edge=profile.edges[source.pin.path]!;
     if(!Object.hasOwn(edge,id))return reject();const target=edge[id]!;
     return profile.builtins.includes(target)?{id:target,external:true}:virtual(target);
    },
    load(id){const source=map.get(id);if(!source||loaded.has(id))return reject();loaded.add(id);return {code:source.text,moduleType:'ts',map:null};},
   }],
  });
  const output=await build.generate({format:'cjs',exports:'named',sourcemap:false,minify:false,comments:false,strictExecutionOrder:true});
  const chunk=output.output[0];
  if(output.output.length!==1||!chunk||chunk.type!=='chunk'||!chunk.isEntry||chunk.facadeModuleId!==virtual(entry)||chunk.dynamicImports.length||chunk.map||JSON.stringify([...chunk.exports].sort())!==JSON.stringify([...profile.exports].sort()))return reject();
  if(loaded.size!==sources.length||[...map.keys()].some(id=>!loaded.has(id)))return reject();
  const imports=[...new Set(chunk.imports)].sort();
  if(JSON.stringify(imports)!==JSON.stringify([...profile.builtins].sort()))return reject();
  const moduleIds=Object.keys(chunk.modules);
  // strictExecutionOrder가 만드는 단일 compiler helper는 원 소스가 아니다.
  // 다른 생성 모듈/순서와 변경된 완성 출력은 모두 거절한다.
  if(JSON.stringify(moduleIds)!==JSON.stringify([generatedRuntime,...profile.order.map(virtual)]))return reject();
  const text=chunk.code;
  const bytes=new Uint8Array(Buffer.from(text,'utf8'));
  if(bytes.byteLength>262_144||hash(bytes)!==profile.sha256)return reject();
  return Object.freeze({sourceHead,compiler:'rolldown',compilerVersion:VERSION,sources:profile.sources,entry,
   moduleOrder:profile.order,generatedModules:Object.freeze(profile.generated?[generatedRuntime,virtual(entry)]:[generatedRuntime]),builtins:Object.freeze(imports),bytes,byteLength:bytes.byteLength,sha256:hash(bytes)});
 }catch{return reject();}
 finally{if(build)try{await build.close();}catch{reject();}}
}

export function buildSubnetObservationBundle(readSource:(path:string)=>unknown){return buildPinnedBundle(readSource,{sources:SUBNET_OBSERVATION_SOURCES,entry:SUBNET_OBSERVATION_SOURCES[0]!.path,edges:dependencies,builtins,order:moduleOrder,exports:['observeSubnetOnHost'],sha256:outputSha256});}

// 새 source-only 후보. Main 확정 commit 결박 전이며 기존 Git blob 프로필과 혼합하지 않는다.
export const SUBNET_ASYNC_SOURCES=Object.freeze([
 Object.freeze({"path":"scripts/qa-ix01-subnet-observation-host.ts","bytes":14481,"sha256":"74a2ed2b0e6dd72714e8041b00bf43eed0fc85f511301b9f58539ca28cabb6df"}),
 Object.freeze({"path":"scripts/qa-ix01-subnet-observation-payload.ts","bytes":8168,"sha256":"d921b0c8c38e921dad1a75c44e5f7c04ffc27a73254dbac06c716d69bc15b107"}),
 Object.freeze({"path":"scripts/qa-ix01-subnet-projection.ts","bytes":8000,"sha256":"b74a85415fe484956ef204f565cdee3a13522ceee595419a5f038cffad35024c"}),
 Object.freeze({"path":"scripts/qa-ix01-subnet-candidate.ts","bytes":7314,"sha256":"1ce97ab13fa4734f3306262fe4fc5f4af514a1329d11d822f1a7cb83f1280110"}),
 Object.freeze({"path":"contracts/canonical.ts","bytes":2986,"sha256":"5be93c5b92a3bda99baa9bc561e6b535c9c1ab80196601e561903a0b6f74e143"}),
 Object.freeze({"path":"scripts/qa-ix01-subnet-observation-steps.ts","bytes":1061,"sha256":"3734ff512890b69977b383f50acc7b4eda0d328a76cef89fc4ea8c975a6a4f1f"}),
 Object.freeze({"path":"scripts/qa-ix01-subnet-observation-remote.ts","bytes":9974,"sha256":"6757a0eb635f431363559c44b3cf2099440d61399debd360f509145a9e90a092"}),
 Object.freeze({"path":"scripts/qa-ix01-subnet-observation-supervisor.ts","bytes":8235,"sha256":"aa5ac81b74d41b36685a94d2411bd541b9673ae0d350388bb4cdf33bce8b9bbe"}),
 ]);
const stepsPath='scripts/qa-ix01-subnet-observation-steps.ts',remotePath='scripts/qa-ix01-subnet-observation-remote.ts',supervisorPath='scripts/qa-ix01-subnet-observation-supervisor.ts';
const asyncEntry='generated/subnet-observation-async-entry.ts';
const asyncEntryText="export {observeSubnetRemote} from '../scripts/qa-ix01-subnet-observation-remote.ts';\nexport {collectSubnetRemoteCompletion} from '../scripts/qa-ix01-subnet-observation-supervisor.ts';\n";
const asyncEdges=Object.freeze({
 ...dependencies,
 'scripts/qa-ix01-subnet-observation-host.ts':Object.freeze({...dependencies['scripts/qa-ix01-subnet-observation-host.ts'],'./qa-ix01-subnet-observation-steps.ts':stepsPath}),
 'scripts/qa-ix01-subnet-observation-payload.ts':Object.freeze({...dependencies['scripts/qa-ix01-subnet-observation-payload.ts'],'./qa-ix01-subnet-observation-steps.ts':stepsPath}),
 'scripts/qa-ix01-subnet-projection.ts':Object.freeze({...dependencies['scripts/qa-ix01-subnet-projection.ts'],'./qa-ix01-subnet-observation-steps.ts':stepsPath}),
 [stepsPath]:Object.freeze({'node:util':'node:util'}),
 [remotePath]:Object.freeze({'node:events':'node:events','node:util':'node:util','./qa-ix01-subnet-observation-host.ts':'scripts/qa-ix01-subnet-observation-host.ts'}),
 [supervisorPath]:Object.freeze({'node:events':'node:events','node:util':'node:util','../contracts/canonical.ts':'contracts/canonical.ts','./qa-ix01-subnet-observation-remote.ts':remotePath}),
 [asyncEntry]:Object.freeze({'../scripts/qa-ix01-subnet-observation-remote.ts':remotePath,'../scripts/qa-ix01-subnet-observation-supervisor.ts':supervisorPath}),
});
const asyncOrder=Object.freeze([stepsPath,...moduleOrder,remotePath,supervisorPath,asyncEntry]);
const asyncOutputHash='03221a628f348cc4c94dc40c75933c36e94eb2b0a94a6e09e1d53fc3d0debb1b';
export async function buildSubnetObservationAsyncBundle(readSource:(path:string)=>unknown){
 const built=await buildPinnedBundle(readSource,{sources:SUBNET_ASYNC_SOURCES,entry:asyncEntry,edges:asyncEdges,builtins:Object.freeze([...builtins,'node:events']),order:asyncOrder,exports:['collectSubnetRemoteCompletion','observeSubnetRemote'],sha256:asyncOutputHash,generated:{path:asyncEntry,text:asyncEntryText}});
 return Object.freeze({...built,sourceHead:null,baselineHead:'95ea7c4d98b9db87b35a449232193e6d16b032a5',purpose:'SOURCE_ONLY_ASYNC_CANDIDATE'});
}

// native 후보는 과거 async 03221a62 프로필을 교체하지 않는다.
const nativePath='scripts/qa-ix01-subnet-observation-native.ts';
export const SUBNET_NATIVE_SOURCES=Object.freeze(SUBNET_ASYNC_SOURCES.map<SourcePin>(v=>v.path==='scripts/qa-ix01-subnet-observation-host.ts'?Object.freeze({"path":"scripts/qa-ix01-subnet-observation-host.ts","bytes":14607,"sha256":"6777d2a382a539fc4b6c831d85a0ee2d5c12b2159d9667c221302f8097f3b173"}):v).concat([Object.freeze({"path":"scripts/qa-ix01-subnet-observation-native.ts","bytes":5479,"sha256":"1ea96be81159d1cb31fa6919dfeaa0b045b22246d1c1e877f34e566b2f9f94df"})]));
const nativeEntry='generated/subnet-observation-native-entry.ts';
const nativeEntryText="export {observeSubnetNative} from '../scripts/qa-ix01-subnet-observation-native.ts';\nexport {collectSubnetRemoteCompletion} from '../scripts/qa-ix01-subnet-observation-supervisor.ts';\n";
const nativeEdges=Object.freeze({...asyncEdges,
 [nativePath]:Object.freeze({'node:child_process':'node:child_process','node:events':'node:events','node:util':'node:util','./qa-ix01-subnet-observation-host.ts':'scripts/qa-ix01-subnet-observation-host.ts','./qa-ix01-subnet-observation-remote.ts':remotePath}),
 [nativeEntry]:Object.freeze({'../scripts/qa-ix01-subnet-observation-native.ts':nativePath,'../scripts/qa-ix01-subnet-observation-supervisor.ts':supervisorPath}),
});
const nativeOrder=Object.freeze([stepsPath,...moduleOrder,remotePath,nativePath,supervisorPath,nativeEntry]);
const nativeOutputHash='da375f17e1ccfbc4a1bd85af108ee82c0a8398a061dced888427725223bb6d8d';
export async function buildSubnetObservationNativeBundle(readSource:(path:string)=>unknown){
 const built=await buildPinnedBundle(readSource,{sources:SUBNET_NATIVE_SOURCES,entry:nativeEntry,edges:nativeEdges,builtins:Object.freeze([...builtins,'node:events']),order:nativeOrder,exports:['collectSubnetRemoteCompletion','observeSubnetNative'],sha256:nativeOutputHash,generated:{path:nativeEntry,text:nativeEntryText}});
 return Object.freeze({...built,sourceHead:null,baselineHead:'80f4c8506989e998c727b5a84dc8e6f7c86f0baf',purpose:'SOURCE_ONLY_NATIVE_CANDIDATE'});
}

// 메타 측정 후보는 기존 세 번들 원바이트/지문을 변경하지 않는다.
const preflightPath='scripts/qa-ix01-subnet-observation-preflight.ts';
export const SUBNET_PREFLIGHT_SOURCES=Object.freeze(SUBNET_NATIVE_SOURCES.filter(v=>v.path!==nativePath&&v.path!==supervisorPath).concat([
 Object.freeze({path:preflightPath,bytes:6994,sha256:'e1228af0d86c599de9dd8439c809667b68f6bed842df304d12178746e525a8f4'}),
]));
const preflightEdges=Object.freeze({...asyncEdges,[preflightPath]:Object.freeze({'node:util':'node:util','./qa-ix01-subnet-observation-host.ts':'scripts/qa-ix01-subnet-observation-host.ts','./qa-ix01-subnet-observation-remote.ts':remotePath})});
export const SUBNET_PREFLIGHT_BUNDLE_HASH='e79a0b34931921e6bfba34edd866b32a45f38b29d73e6eb0bb9b2d1fc6f49ba8';
export async function buildSubnetPreflightBundle(readSource:(path:string)=>unknown){
 const built=await buildPinnedBundle(readSource,{sources:SUBNET_PREFLIGHT_SOURCES,entry:preflightPath,edges:preflightEdges,builtins:Object.freeze([...builtins,'node:events']),order:Object.freeze([stepsPath,...moduleOrder,remotePath,preflightPath]),exports:['inspectSubnetIpPreflight'],sha256:SUBNET_PREFLIGHT_BUNDLE_HASH});
 return Object.freeze({...built,sourceHead:null,baselineHead:'3ee214fcbc8b0beacb346ab085ce1e0b80a9ed4d',purpose:'SOURCE_ONLY_PREFLIGHT_CANDIDATE'});
}
