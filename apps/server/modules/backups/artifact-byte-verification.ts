import {createHash} from 'node:crypto';
import {AuthFailure} from '../access/repository.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';

export interface ArtifactByteRef{readonly projectId:string;readonly artifactId:string;readonly bytes:number;readonly contentHash:string}
export interface ArtifactByteHandle{
 read(maxBytes:number,signal?:AbortSignal):Promise<Uint8Array>;
 close():Promise<void>;
}
/** 신뢰한 내부 포트. 실제 OS 보호·현재 권한·무기한 IO 중단을 제공한다고 가정하지 않는다. */
export interface ArtifactByteReader{open(ref:Readonly<ArtifactByteRef>,signal?:AbortSignal):Promise<ArtifactByteHandle>}
export interface ArtifactByteVerification{
 kind:'ARTIFACT_BYTE_VERIFICATION_V1';coverage:'SUPPLIED_ARTIFACT_BYTES_ONLY';
 ref:Readonly<ArtifactByteRef>;checkedBytes:number;contentHash:string;byteIntegrity:'MATCH';
 markerCheck:ReturnType<typeof inspectArtifact>;authorityVerified:false;sourceStabilityVerified:false;restorable:false;
}
interface Input extends ArtifactByteRef{readonly maxBytes:number;readonly deadlineMs:number}
const keys=['projectId','artifactId','bytes','contentHash','maxBytes','deadlineMs'];
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const safe=(v:unknown,min:number):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min;
function readInput(value:unknown):Readonly<Input>{
 try{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error();
  const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)throw Error();
  const descriptors=Object.getOwnPropertyDescriptors(value),names=Reflect.ownKeys(descriptors);
  if(names.length!==keys.length||names.some(k=>typeof k!=='string'||!keys.includes(k)))throw Error();
  const snapshot:Record<string,unknown>={};
  for(const key of keys){const d=descriptors[key];if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw Error();snapshot[key]=d.value;}
  if(!uuid(snapshot.projectId)||!uuid(snapshot.artifactId)||!safe(snapshot.bytes,0)||snapshot.bytes>20*1024*1024||typeof snapshot.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(snapshot.contentHash)||!safe(snapshot.maxBytes,1)||snapshot.bytes>snapshot.maxBytes||!safe(snapshot.deadlineMs,1))throw Error();
  return Object.freeze({projectId:snapshot.projectId,artifactId:snapshot.artifactId,bytes:snapshot.bytes,contentHash:snapshot.contentHash,maxBytes:snapshot.maxBytes,deadlineMs:snapshot.deadlineMs});
 }catch{throw new AuthFailure('INPUT_INVALID',400);}
}

/** 바이트 검사만 수행한다. 인증·DB 현재성·파일 안정성·백업/복원 권한을 발급하지 않는다. */
export async function verifyArtifactBytes(value:unknown,reader:ArtifactByteReader,signal?:AbortSignal):Promise<ArtifactByteVerification>{
 const started=performance.now(),input=readInput(value);
 const ref=Object.freeze({projectId:input.projectId,artifactId:input.artifactId,bytes:input.bytes,contentHash:input.contentHash});
 const known=new WeakSet<AuthFailure>();
 const fail=(code:string,status:number):never=>{const error=new AuthFailure(code,status);known.add(error);throw error;};
 const check=()=>{if(signal?.aborted)fail('ARTIFACT_BYTES_CANCELLED',409);if(performance.now()-started>=input.deadlineMs)fail('ARTIFACT_BYTES_TIMEOUT',408);};
 let handle:ArtifactByteHandle|undefined,owned:Buffer|undefined,result:ArtifactByteVerification|undefined,error:AuthFailure|undefined;
 try{
  check();
  // 포트가 참조를 보관하거나 변경하려 해도 결과/입력 기준 객체를 소유하지 않는다.
  try{handle=await reader.open(Object.freeze({...ref}),signal);}catch{fail('ARTIFACT_BYTES_IO_FAILED',503);}
  check();
  if(!handle||typeof handle.read!=='function'||typeof handle.close!=='function')fail('ARTIFACT_BYTES_IO_FAILED',503);
  owned=Buffer.alloc(input.bytes);let offset=0;
  for(;;){
   check();const requested=Math.min(65536,input.bytes-offset+1);let chunk:Uint8Array;
   try{chunk=await handle!.read(requested,signal);}catch{fail('ARTIFACT_BYTES_IO_FAILED',503);}
   check();
   if(!(chunk! instanceof Uint8Array)||chunk!.byteLength>requested||chunk!.byteLength>input.bytes-offset)fail('ARTIFACT_BYTES_INTEGRITY_FAILED',503);
   if(chunk!.byteLength===0){if(offset!==input.bytes)fail('ARTIFACT_BYTES_INTEGRITY_FAILED',503);break;}
   // 포트 소유 chunk는 변경하지 않고 선언 크기 이하의 자체 버퍼에만 복사한다.
   owned.set(chunk!,offset);offset+=chunk!.byteLength;
  }
  check();const contentHash=createHash('sha256').update(owned).digest('hex');
  if(contentHash!==input.contentHash)fail('ARTIFACT_BYTES_INTEGRITY_FAILED',503);
  const markerCheck=inspectArtifact(owned);if(markerCheck.state==='SUSPECTED')fail('ARTIFACT_BYTES_SENSITIVE',412);check();
  result={kind:'ARTIFACT_BYTE_VERIFICATION_V1',coverage:'SUPPLIED_ARTIFACT_BYTES_ONLY',ref,checkedBytes:offset,contentHash,byteIntegrity:'MATCH',markerCheck,authorityVerified:false,sourceStabilityVerified:false,restorable:false};
 }catch(caught){error=caught instanceof AuthFailure&&known.has(caught)?caught:new AuthFailure('ARTIFACT_BYTES_IO_FAILED',503);}
 finally{
  // 진행 중 open/read를 Promise.race로 버리지 않는다. 얻은 정확 handle만 단발 회수한다.
  if(handle)try{await handle.close();}catch{error=new AuthFailure('ARTIFACT_BYTES_CLEANUP_FAILED',503);}
  owned?.fill(0);owned=undefined;
 }
 if(error)throw error;
 check();return result!;
}
