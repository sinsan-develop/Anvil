import {types} from 'node:util';
import {recordV1,refV1,uuidV1,hashV1,isoV1,type RuntimeRefV1} from './validation-v1.ts';
import {nativeHash,nativeSame,readNativeConsumeReceipt} from './native-preparation-authority-v1.ts';
import {readNativeReturnAuthority} from './native-preparation-ownership-return-v1.ts';

const fail=():never=>{throw Error('NATIVE_WORKER_PROVENANCE_INVALID');};
/** 단일 data snapshot. Proxy/accessor를 호출하지 않으며 권위를 발행하지 않는다. */
export function workerDataSnapshot(value:unknown,depth=0):any{
 if(depth>16)return fail();
 if(value===null||typeof value==='string'||typeof value==='boolean')return value;
 if(typeof value==='number'){if(!Number.isSafeInteger(value))return fail();return value;}
 if(!value||typeof value!=='object'||types.isProxy(value))return fail();
 const proto=Object.getPrototypeOf(value),array=Array.isArray(value);
 if(array?proto!==Array.prototype:proto!==Object.prototype&&proto!==null)return fail();
 const ds=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(ds);
 if(keys.length>128||keys.some(k=>typeof k!=='string'||!('value'in ds[k]!)||!ds[k]!.enumerable&&k!=='length'))return fail();
 if(array){const n=ds.length?.value;if(!Number.isSafeInteger(n)||n<0||n>127||keys.length!==n+1)return fail();const out=[];for(let i=0;i<n;i++){if(!ds[String(i)])return fail();out.push(workerDataSnapshot(ds[String(i)]!.value,depth+1));}return out;}
 const out:Record<string,unknown>={};for(const k of keys as string[])Object.defineProperty(out,k,{value:workerDataSnapshot(ds[k]!.value,depth+1),enumerable:true,writable:true,configurable:true});return out;
}
export interface NativeWorkerDescriptor{
 ref:RuntimeRefV1;snapshot:{schemaVersion:1;purpose:'NATIVE_PREPARATION_WORKER_DESCRIPTOR';nativeFactoryRef:RuntimeRefV1;packageRef:RuntimeRefV1;buildReceiptRef:RuntimeRefV1;rootId:string;relativePath:'OwnershipEvidenceWorker.exe';workerHash:string;issuedAt:string;expiresAt:string};
}
/** 순수 형상/내용 검산. 일반 JSON을 보호 원 객체로 발급하지 않는다. */
export function readNativeWorkerDescriptor(value:unknown):NativeWorkerDescriptor{
 const d=workerDataSnapshot(value);
 if(!recordV1(d,['ref','snapshot'])||!refV1(d.ref)||!recordV1(d.snapshot,['schemaVersion','purpose','nativeFactoryRef','packageRef','buildReceiptRef','rootId','relativePath','workerHash','issuedAt','expiresAt']))return fail();
 const s=d.snapshot;
 if(s.schemaVersion!==1||s.purpose!=='NATIVE_PREPARATION_WORKER_DESCRIPTOR'||![s.nativeFactoryRef,s.packageRef,s.buildReceiptRef].every(refV1)||!uuidV1(s.rootId)||s.relativePath!=='OwnershipEvidenceWorker.exe'||!hashV1(s.workerHash)||s.workerHash==='0'.repeat(64)||!isoV1(s.issuedAt)||!isoV1(s.expiresAt)||Date.parse(s.expiresAt)<=Date.parse(s.issuedAt)||d.ref.id!==s.nativeFactoryRef.id||d.ref.version!==s.nativeFactoryRef.version||d.ref.contentHash!==nativeHash(s))return fail();
 return d as NativeWorkerDescriptor;
}
export function deriveNativeWorkerBasis(authority:unknown,consumeReceipt:unknown,consumeRecordRef:unknown,descriptor:unknown,now:number){
 const a=readNativeReturnAuthority(workerDataSnapshot(authority)),r=readNativeConsumeReceipt(workerDataSnapshot(consumeReceipt)),record=workerDataSnapshot(consumeRecordRef),d=readNativeWorkerDescriptor(descriptor);
 const ar={id:a.authorityId,version:1,contentHash:nativeHash(a)};
 if(!refV1(record)||record.version!==1||!Number.isSafeInteger(now)||!nativeSame(r.snapshot.authorityRef,ar)||!nativeSame(r.snapshot.preparationRef,a.scope.preparationRef)||!nativeSame(r.snapshot.writerHeadRef,a.scope.writerHeadRef)||!nativeSame(d.snapshot.nativeFactoryRef,a.scope.nativeFactoryRef))return fail();
 const start=Math.max(Date.parse(a.issuedAt),Date.parse(r.snapshot.at),Date.parse(d.snapshot.issuedAt));
 const end=Math.min(Date.parse(a.expiresAt),Date.parse(r.snapshot.expiresAt),Date.parse(d.snapshot.expiresAt));
 if(now<start||now>=end||Date.parse(r.snapshot.at)<Date.parse(a.issuedAt)||Date.parse(r.snapshot.expiresAt)>Date.parse(a.expiresAt))return fail();
 const snapshot={schemaVersion:1,purpose:'NATIVE_PREPARATION_OBSERVER_BASIS',authorityRef:ar,consumeReceiptRef:r.ref,consumeRecordRef:record,nativeFactoryRef:a.scope.nativeFactoryRef,registrationRef:a.scope.registrationRef,sourceScopeHash:a.scope.sourceScopeHash,workerDescriptorRef:d.ref,runId:r.ref.id,processGeneration:1};
 const observer={ref:{id:record.id,version:1,contentHash:nativeHash(snapshot)},snapshot};
 return {observer,basis:{authorityRef:ar,consumeReceiptRef:r.ref,nativeFactoryRef:a.scope.nativeFactoryRef,registrationRef:a.scope.registrationRef,sourceScopeHash:a.scope.sourceScopeHash,observerRef:observer.ref,runId:r.ref.id,processGeneration:1,workerHash:d.snapshot.workerHash,checkedAt:new Date(now).toISOString(),expiresAt:new Date(end).toISOString()}};
}
