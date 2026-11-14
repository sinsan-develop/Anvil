import {types} from 'node:util';
import {performance} from 'node:perf_hooks';
import {deriveNativeWorkerBasis,readNativeWorkerDescriptor,workerDataSnapshot} from '../../../../contracts/runtime/native-worker-provenance-v1.ts';
import {nativeSame} from '../../../../contracts/runtime/native-preparation-authority-v1.ts';
import {isoV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import type {NativeOwnershipBasisSource} from './native-preparation-ownership-return-store.ts';
import {NativeWorkerDeploymentStore} from './native-worker-deployment-store.ts';
import {readWorkerDeploymentRead,type WorkerDeploymentBundle} from '../../../../contracts/runtime/native-worker-deployment-v1.ts';
import {randomBytes} from 'node:crypto';

const fail=():never=>{throw Error('NATIVE_WORKER_SOURCE_UNAVAILABLE');};
/** 빌드 모듈을 runtime에 import하지 않는다. 신뢰된 내부 조립자가 원 opaque token 판독기를 전달한다.
 * 일반 JSON reader를 자동 등록하지 않으며 실제 배포 공급자 구현은 별도다. */
export interface NativeWorkerProductReader{readOriginal(token:unknown):{descriptor:unknown};}
/** 보호 배포/current의 내부 경계. 기본 구현/자동 등록은 없으며 RAM 대역은 실제 설치 증명이 아니다.
 * product는 원 build 토큰. 같은 factory의 원 descriptor 변경·회수·불명은 공급자가 거절해야 한다.
 * raw DB·HTTP process 후보·절대 경로는 제공하지 않는다. */
export interface NativeWorkerDeploymentSource{
 readCurrent(input:{nativeFactoryRef:RuntimeRefV1;descriptorRef:RuntimeRefV1;checkedAt:string;signal:AbortSignal}):Promise<{product:object;checkedAt:string;expiresAt:string}>;
}
/** SOURCE_ONLY_MODEL build를 실제 배포 권위로 승격하지 않는다. current 공급자 없이는 반환도 없다. */
export function createNativeWorkerOwnershipBasisSource(token:unknown,deployment:NativeWorkerDeploymentSource|null=null,reader:NativeWorkerProductReader|null=null){
 const originalReader=()=>{if(!reader||types.isProxy(reader))return fail();const d=Object.getOwnPropertyDescriptor(reader,'readOriginal');if(!d||!('value'in d)||typeof d.value!=='function')return fail();return d.value as NativeWorkerProductReader['readOriginal'];};
 const readProduct=originalReader(),product=()=>{if(originalReader()!==readProduct)return fail();const p=readProduct.call(reader,token);if(originalReader()!==readProduct)return fail();return workerDataSnapshot(p);};
 const descriptor=readNativeWorkerDescriptor(product().descriptor);
 const own=()=>{if(!deployment||types.isProxy(deployment))return fail();const p=Object.getOwnPropertyDescriptor(deployment,'readCurrent');if(!p||!('value'in p)||typeof p.value!=='function')return fail();return p.value as NativeWorkerDeploymentSource['readCurrent'];};
 const read=deployment?own():null;
 return Object.freeze({current:async(input:Parameters<NativeOwnershipBasisSource['current']>[0])=>{
  if(!read||!deployment||own()!==read||input.signal.aborted)return fail();
  // 원 거래가 검산한 CONSUME_COMMITTED eventRef/receipt 부모를 받는다. 이 순수 ref만으로 event 원문을 resolve하지 않는다.
  const authority=workerDataSnapshot(input.authority),receipt=workerDataSnapshot(input.consumeReceipt),record=workerDataSnapshot(input.consumeRecordRef),checkedAt=input.checkedAt,signal=input.signal;
  if(!isoV1(checkedAt))return fail();const now=Date.parse(checkedAt),start=performance.now();
  const derived=deriveNativeWorkerBasis(authority,receipt,record,descriptor,now);let end=Math.min(now+1000,Date.parse(derived.basis.expiresAt)),active=true,lastChecked=now;
  const check=()=>{const elapsed=performance.now()-start;if(!active||signal.aborted||own()!==read||originalReader()!==readProduct||!Number.isFinite(elapsed)||elapsed<0||now+elapsed>=end)return fail();};
  const capture=async()=>{
   check();const result=await read.call(deployment,{nativeFactoryRef:workerDataSnapshot(descriptor.snapshot.nativeFactoryRef),descriptorRef:workerDataSnapshot(descriptor.ref),checkedAt,signal});check();
   if(!result||types.isProxy(result)||![Object.prototype,null].includes(Object.getPrototypeOf(result)))return fail();const ds=Object.getOwnPropertyDescriptors(result);
   if(Reflect.ownKeys(ds).length!==3||!['product','checkedAt','expiresAt'].every(k=>ds[k]&&'value'in ds[k]!&&ds[k]!.enumerable))return fail();
   const observedProduct=ds.product!.value,at=ds.checkedAt!.value,until=ds.expiresAt!.value;
   if(observedProduct!==token||!isoV1(at)||!isoV1(until)||Date.parse(at)<lastChecked||Date.parse(at)>now+performance.now()-start||Date.parse(until)<=Date.parse(at)||!nativeSame(readNativeWorkerDescriptor(product().descriptor),descriptor))return fail();
   lastChecked=Date.parse(at);end=Math.min(end,Date.parse(until));check();return Date.parse(until);
  };
  let timer:ReturnType<typeof setTimeout>|undefined;
  let abort:()=>void=()=>{};
  const stopped=new Promise<never>((_,reject)=>{abort=()=>{active=false;reject(Error('NATIVE_WORKER_SOURCE_UNAVAILABLE'));};signal.addEventListener('abort',abort,{once:true});timer=setTimeout(abort,Math.max(1,end-now));if(signal.aborted)abort();});
  const work=(async()=>{const before=await capture(),after=await capture();check();return {...derived.basis,expiresAt:new Date(Math.min(Date.parse(derived.basis.expiresAt),before,after)).toISOString()};})();
  try{return await Promise.race([work,stopped]);}catch{return fail();}finally{active=false;if(timer)clearTimeout(timer);signal.removeEventListener('abort',abort);void work.catch(()=>{});}
 }} satisfies NativeOwnershipBasisSource);
}

const deploymentRead=NativeWorkerDeploymentStore.prototype.read;
/** 명시 서버 내부 조립. 보호 목적 store의 원 응답만 원객체로 보유하며 HTTP JSON이나 build reader를 등록하지 않는다.
 * 기존 source-only preparation 거래가 검산한 원 consume 부모를 소비한다. 실제 설치/실행 권위를 발행하지 않는다. */
export function createNativeWorkerDeploymentOwnershipBasisSource(store:NativeWorkerDeploymentStore):NativeOwnershipBasisSource{
 const stable=()=>{if(types.isProxy(store)||Object.getPrototypeOf(store)!==NativeWorkerDeploymentStore.prototype||!(store instanceof NativeWorkerDeploymentStore)||Object.hasOwn(store,'read')||NativeWorkerDeploymentStore.prototype.read!==deploymentRead)return fail();};
 stable();
 // 같은 factory의 descriptor는 이 조립 수명에서도 불변. 공개 JSON clone을 token으로 받는 진입점이 없다.
 const originals=new Map<string,{bundle:WorkerDeploymentBundle;head:unknown}>();
 return Object.freeze({current:async(input:Parameters<NativeOwnershipBasisSource['current']>[0])=>{
  stable();const authority=workerDataSnapshot(input.authority),receipt=workerDataSnapshot(input.consumeReceipt),record=workerDataSnapshot(input.consumeRecordRef),signal=input.signal;
  if(!(signal instanceof AbortSignal)||signal.aborted||!isoV1(input.checkedAt))return fail();
  const wall=Date.now(),mono=performance.now();let active=true,lastWall=wall,end=Math.min(wall+1000,Date.parse(input.checkedAt)+1000),lastObserved=Date.parse(input.checkedAt);
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,abort=()=>{};
  const check=()=>{stable();const now=Date.now(),elapsed=performance.now()-mono;if(!active||signal.aborted||controller.signal.aborted||!Number.isFinite(elapsed)||elapsed<0||now<lastWall||now>=end||wall+elapsed>=end)return fail();lastWall=now;};
  const stopped=new Promise<never>((_,reject)=>{abort=()=>{active=false;controller.abort();reject(Error('NATIVE_WORKER_SOURCE_UNAVAILABLE'));};signal.addEventListener('abort',abort,{once:true});timer=setTimeout(abort,Math.max(1,end-wall));if(signal.aborted)abort();});
  const work=(async()=>{
   const read=async()=>{check();const started=Date.now(),nonce=randomBytes(32).toString('base64url');const value=await deploymentRead.call(store,workerDataSnapshot(authority.scope?.nativeFactoryRef),nonce,controller.signal);check();const checked=readWorkerDeploymentRead(value,authority.scope.nativeFactoryRef,nonce,Date.now()),at=Date.parse(value.observedAt);if(at<started||at<lastObserved||at>Date.now())return fail();lastObserved=at;end=Math.min(end,Date.parse(checked.head.snapshot.expiresAt),Date.parse(checked.bundle.descriptor.snapshot.expiresAt));check();return checked;};
   const first=await read(),factory=first.bundle.descriptor.snapshot.nativeFactoryRef,key=factory.id+':'+factory.version;
   let original=originals.get(key);if(original){if(!nativeSame(original.bundle,first.bundle)||!nativeSame(original.head,first.head))return fail();}else{original={bundle:workerDataSnapshot(first.bundle),head:workerDataSnapshot(first.head)};originals.set(key,original);}
   // 같은 순수 파생기를 사용하며 임의 processRef는 입력으로 받지 않는다.
   const before=deriveNativeWorkerBasis(authority,receipt,record,original.bundle.descriptor,lastObserved);
   end=Math.min(end,Date.parse(before.basis.expiresAt));check();
   const after=await read();if(!nativeSame(original.bundle,after.bundle)||!nativeSame(original.head,after.head))return fail();
   const result=deriveNativeWorkerBasis(authority,receipt,record,original.bundle.descriptor,lastObserved);check();
   return {...result.basis,expiresAt:new Date(Math.min(end,Date.parse(result.basis.expiresAt))).toISOString()};
  })();
  try{return await Promise.race([work,stopped]);}catch{return fail();}finally{active=false;controller.abort();if(timer)clearTimeout(timer);signal.removeEventListener('abort',abort);void work.catch(()=>{});}
 }});
}
