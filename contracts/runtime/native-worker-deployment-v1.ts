import {canonicalJson} from '../canonical.ts';
import {nativeHash,nativeSame} from './native-preparation-authority-v1.ts';
import {readNativeWorkerDescriptor,workerDataSnapshot,type NativeWorkerDescriptor} from './native-worker-provenance-v1.ts';
import {recordV1,refV1,isoV1,hashV1,type RuntimeRefV1} from './validation-v1.ts';

export const WORKER_METADATA_LIMIT=64*1024;
const invalid=():never=>{throw Error('WORKER_DEPLOYMENT_INPUT_INVALID');};
export interface WorkerDeploymentBundle{descriptor:NativeWorkerDescriptor;packageRecord:{ref:RuntimeRefV1;snapshot:Record<string,any>};buildReceipt:{ref:RuntimeRefV1;snapshot:Record<string,any>};}
export interface WorkerDeploymentHead{ref:RuntimeRefV1;snapshot:{schemaVersion:1;purpose:'NATIVE_WORKER_DEPLOYMENT_HEAD';nativeFactoryRef:RuntimeRefV1;descriptorRef:RuntimeRefV1;sequence:1|2;previousHeadRef:RuntimeRefV1|null;state:'ACTIVE'|'REVOKED';updatedAt:string;expiresAt:string};}
function sealed(v:any,keys:string[]):{ref:RuntimeRefV1;snapshot:Record<string,any>}{if(!recordV1(v,['ref','snapshot'])||!refV1(v.ref)||!recordV1(v.snapshot,keys)||v.ref.contentHash!==nativeHash(v.snapshot))return invalid();return {ref:v.ref,snapshot:v.snapshot};}
function interval(v:any){if(!isoV1(v.issuedAt)||!isoV1(v.expiresAt)||Date.parse(v.expiresAt)<=Date.parse(v.issuedAt))return invalid();}
/** JSON 검산은 원 compiler/배포 권위 발급이 아니다. 공개 exact3에는 원 compile/path 자료가 없다. */
export function readWorkerDeploymentBundle(input:unknown):WorkerDeploymentBundle{
 const v=workerDataSnapshot(input);if(!recordV1(v,['descriptor','packageRecord','buildReceipt'])||Buffer.byteLength(canonicalJson(v))>WORKER_METADATA_LIMIT)return invalid();
 const d=readNativeWorkerDescriptor(v.descriptor),p=sealed(v.packageRecord,['schemaVersion','purpose','parentExeHash','parentAsarHash','parentHeaderHash','issuedAt','expiresAt']),b=sealed(v.buildReceipt,['schemaVersion','purpose','nativeFactoryRef','packageRef','compileInputHash','sourceHash','workerHash','issuedAt','expiresAt']);
 if(p.snapshot.schemaVersion!==1||p.snapshot.purpose!=='NATIVE_FACTORY_PACKAGE_BASIS'||b.snapshot.schemaVersion!==1||b.snapshot.purpose!=='NATIVE_WORKER_BUILD_RECEIPT'||![p.snapshot.parentExeHash,p.snapshot.parentAsarHash,p.snapshot.parentHeaderHash,b.snapshot.compileInputHash,b.snapshot.sourceHash,b.snapshot.workerHash].every(x=>hashV1(x)&&x!=='0'.repeat(64))||!refV1(b.snapshot.nativeFactoryRef)||!refV1(b.snapshot.packageRef))return invalid();
 interval(p.snapshot);interval(b.snapshot);
 if(!nativeSame(d.snapshot.packageRef,p.ref)||!nativeSame(d.snapshot.buildReceiptRef,b.ref)||!nativeSame(b.snapshot.packageRef,p.ref)||!nativeSame(d.snapshot.nativeFactoryRef,b.snapshot.nativeFactoryRef)||d.snapshot.workerHash!==b.snapshot.workerHash||Date.parse(d.snapshot.issuedAt)<Math.max(Date.parse(p.snapshot.issuedAt),Date.parse(b.snapshot.issuedAt))||Date.parse(d.snapshot.expiresAt)>Math.min(Date.parse(p.snapshot.expiresAt),Date.parse(b.snapshot.expiresAt)))return invalid();
 return {descriptor:d,packageRecord:p,buildReceipt:b};
}
export function readWorkerDeploymentHead(input:unknown,bundle:WorkerDeploymentBundle):WorkerDeploymentHead{
 const h=sealed(workerDataSnapshot(input),['schemaVersion','purpose','nativeFactoryRef','descriptorRef','sequence','previousHeadRef','state','updatedAt','expiresAt']),s=h.snapshot,d=bundle.descriptor;
 if(s.schemaVersion!==1||s.purpose!=='NATIVE_WORKER_DEPLOYMENT_HEAD'||!nativeSame(s.nativeFactoryRef,d.snapshot.nativeFactoryRef)||!nativeSame(s.descriptorRef,d.ref)||!isoV1(s.updatedAt)||!isoV1(s.expiresAt)||Date.parse(s.updatedAt)<Date.parse(d.snapshot.issuedAt)||Date.parse(s.expiresAt)>Date.parse(d.snapshot.expiresAt)||Date.parse(s.expiresAt)<=Date.parse(d.snapshot.issuedAt)||h.ref.version!==s.sequence)return invalid();
 if(s.sequence===1){if(s.state!=='ACTIVE'||s.previousHeadRef!==null||Date.parse(s.updatedAt)>=Date.parse(s.expiresAt))return invalid();}
 else if(s.sequence===2){if(s.state!=='REVOKED'||!refV1(s.previousHeadRef)||s.previousHeadRef.id!==h.ref.id||s.previousHeadRef.version!==1)return invalid();}
 else return invalid();return h as WorkerDeploymentHead;
}
export const workerNonce=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v)&&Buffer.from(v,'base64url').length===32&&Buffer.from(v,'base64url').toString('base64url')===v;
export function readWorkerDeploymentRead(input:unknown,factory:RuntimeRefV1,nonce:string,now:number){
 const v=workerDataSnapshot(input);if(!recordV1(v,['schemaVersion','purpose','nonce','bundle','head','observedAt'])||v.schemaVersion!==1||v.purpose!=='NATIVE_WORKER_DEPLOYMENT_READ'||!workerNonce(nonce)||v.nonce!==nonce||!refV1(factory)||!isoV1(v.observedAt)||!Number.isSafeInteger(now)||Date.parse(v.observedAt)>now||now-Date.parse(v.observedAt)>1000||Buffer.byteLength(canonicalJson(v))>WORKER_METADATA_LIMIT)return invalid();
 const b=readWorkerDeploymentBundle(v.bundle),h=readWorkerDeploymentHead(v.head,b);
 if(!nativeSame(b.descriptor.snapshot.nativeFactoryRef,factory))return invalid();
 if(h.snapshot.state!=='ACTIVE'||now>=Date.parse(h.snapshot.expiresAt)||now<Date.parse(h.snapshot.updatedAt))throw Error('WORKER_DEPLOYMENT_NOT_CURRENT');
 return {...v,bundle:b,head:h};
}
