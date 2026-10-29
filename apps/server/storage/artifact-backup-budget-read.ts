import {createHash} from 'node:crypto';
import {AuthFailure} from '../modules/access/repository.ts';

// 제한 객체는 인증/권한 proof가 아니다. 내부 상태는 caller가 초기화할 수 없다.
export interface ArtifactBackupReadBudget {readonly kind:'ARTIFACT_BACKUP_READ_BUDGET_V1'}
interface State {maxBytes:number;used:number;started:number;deadlineMs:number;signal:AbortSignal;busy:boolean;cleanupUnknown:boolean}
const states=new WeakMap<object,State>();
const integer=(v:unknown,min=0):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min;
const known=new WeakSet<AuthFailure>();
const fail=(code:string,status:number)=>{const e=new AuthFailure(code,status);known.add(e);return e;};
export interface ArtifactBackupOwnedHandle {
 stat():Promise<{isFile():boolean;nlink:number;size:number;uid:number;mode:number}>;
 read(buffer:Buffer,offset:number,length:number,position:number):Promise<{bytesRead:number;buffer:Buffer}>;
 close():Promise<void>;
}
function state(value:unknown):State {if(!value||typeof value!=='object'||!states.has(value))throw fail('ARTIFACT_BACKUP_INPUT_INVALID',400);return states.get(value)!;}
function check(s:State){if(s.cleanupUnknown)throw fail('ARTIFACT_BACKUP_CLEANUP_FAILED',503);if(s.signal?.aborted)throw fail('ARTIFACT_BACKUP_CANCELLED',409);if(performance.now()-s.started>=s.deadlineMs)throw fail('ARTIFACT_BACKUP_DEADLINE',413);}
export function createArtifactBackupReadBudget(value:{maxBytes:number;deadlineMs:number},signal:AbortSignal):ArtifactBackupReadBudget {
 if(!value||typeof value!=='object'||Object.keys(value).length!==2||!integer(value.maxBytes,1)||!integer(value.deadlineMs,1)||!(signal instanceof AbortSignal))throw fail('ARTIFACT_BACKUP_INPUT_INVALID',400);
 const started=performance.now();if(!Number.isFinite(started))throw fail('ARTIFACT_BACKUP_INPUT_INVALID',400);
 const budget=Object.freeze({kind:'ARTIFACT_BACKUP_READ_BUDGET_V1' as const});states.set(budget,{maxBytes:value.maxBytes,used:0,deadlineMs:value.deadlineMs,started,signal,busy:false,cleanupUnknown:false});return budget;
}
/** ArtifactStore 경로/open 이전 제한 검사. IO 권한을 발급하지 않는다. */
export function assertArtifactBackupReadBudget(value:unknown):asserts value is ArtifactBackupReadBudget {const s=state(value);check(s);if(s.busy)throw fail('ARTIFACT_BACKUP_BUSY',409);}
/** 호출자는 정확 handle 소유권을 양도한다. 실패해도 같은 handle을 다시 close하지 않는다. */
export async function readOwnedArtifactBackupBytes(handle:ArtifactBackupOwnedHandle,expected:{bytes:number;contentHash:string},budget:ArtifactBackupReadBudget):Promise<Buffer>{
 let s:State|undefined,locked=false,owned:Buffer|undefined,chunk:Buffer|undefined,error:unknown;
 try {
  s=state(budget);check(s);if(s.busy)throw fail('ARTIFACT_BACKUP_BUSY',409);s.busy=true;locked=true;
  if(!expected||!integer(expected.bytes)||expected.bytes>20*1024*1024||typeof expected.contentHash!=='string'||!/^([a-f0-9]{64})$/.test(expected.contentHash))throw fail('ARTIFACT_BACKUP_INPUT_INVALID',400);
  const stat=await handle.stat();check(s);
  if(!stat||typeof stat.isFile!=='function'||!stat.isFile()||stat.nlink!==1||!integer(stat.size)||stat.size>20*1024*1024||process.platform!=='win32'&&(stat.uid!==process.getuid!()||(stat.mode&0o077)!==0))throw fail('ARTIFACT_BACKUP_FILE_UNSAFE',503);
  owned=Buffer.alloc(expected.bytes);let offset=0;
  for(;;){
   check(s);const requested=Math.min(65536,expected.bytes-offset+1);chunk=Buffer.alloc(requested);
   const result=await handle.read(chunk,0,requested,offset);
   if(!result||result.buffer!==chunk||!integer(result.bytesRead)||result.bytesRead>requested)throw fail('ARTIFACT_BACKUP_INTEGRITY_FAILED',503);
   const n=result.bytesRead;
   // EOF probe 포함 실제 소비량. 실패하더라도 되돌리지 않는다.
   if(n>Number.MAX_SAFE_INTEGER-s.used){s.used=Number.MAX_SAFE_INTEGER;throw fail('ARTIFACT_BACKUP_LIMIT',413);}s.used+=n;
   if(s.used>s.maxBytes)throw fail('ARTIFACT_BACKUP_LIMIT',413);check(s);
   if(n>expected.bytes-offset)throw fail('ARTIFACT_BACKUP_INTEGRITY_FAILED',503);
   if(n===0){chunk.fill(0);chunk=undefined;if(offset!==expected.bytes)throw fail('ARTIFACT_BACKUP_INTEGRITY_FAILED',503);break;}
   owned.set(chunk.subarray(0,n),offset);offset+=n;chunk.fill(0);chunk=undefined;
  }
  check(s);if(owned.length!==stat.size||createHash('sha256').update(owned).digest('hex')!==expected.contentHash)throw fail('ARTIFACT_BACKUP_INTEGRITY_FAILED',503);check(s);
 }catch(caught){error=caught instanceof AuthFailure&&known.has(caught)?caught:fail('ARTIFACT_BACKUP_IO_FAILED',503);}
 finally {
  chunk?.fill(0);
  try{await handle.close();}catch{if(s)s.cleanupUnknown=true;error=fail('ARTIFACT_BACKUP_CLEANUP_FAILED',503);}
  if(locked&&s)s.busy=false;
 }
 if(s?.cleanupUnknown)error=fail('ARTIFACT_BACKUP_CLEANUP_FAILED',503);
 if(!error)try{check(s!);}catch(caught){error=caught;}
 if(error){owned?.fill(0);throw error;}
 return owned!;
}
