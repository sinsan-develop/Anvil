import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstat,readFile,realpath} from 'node:fs/promises';
import {dirname,isAbsolute,parse,resolve} from 'node:path';
import {parseWireJson} from '../../../contracts/canonical.ts';

export interface ProtectedHostOptions {executablePath:string;protectedRoot:string;expectedExecutableHash:string}
export async function invokeProtectedHost(options:ProtectedHostOptions,request:Record<string,unknown>):Promise<Record<string,unknown>> {
 if(process.platform!=='win32')throw Error('WINDOWS_PROTECTED_STORE_REQUIRED');
 const {executablePath,protectedRoot,expectedExecutableHash}=options;
 if(!/^[0-9a-f]{64}$/.test(expectedExecutableHash))throw Error('PROTECTED_HELPER_IDENTITY_INVALID');
 for(const [path,directory] of [[executablePath,false],[protectedRoot,true]] as const){
  if(!isAbsolute(path)||resolve(path)!==path)throw Error('PROTECTED_HELPER_IDENTITY_INVALID');
  let current=path;
  while(true){const stat=await lstat(current);if(stat.isSymbolicLink())throw Error('PROTECTED_HELPER_IDENTITY_INVALID');if(current===path&&(directory?!stat.isDirectory():!stat.isFile()))throw Error('PROTECTED_HELPER_IDENTITY_INVALID');if(current===parse(current).root)break;current=dirname(current);}
  if((await realpath(path)).toLowerCase()!==path.toLowerCase())throw Error('PROTECTED_HELPER_IDENTITY_INVALID');
 }
 if(createHash('sha256').update(await readFile(executablePath)).digest('hex')!==expectedExecutableHash)throw Error('PROTECTED_HELPER_IDENTITY_INVALID');
 const input=Buffer.from(JSON.stringify(request),'utf8');if(input.length>65536)throw Error('PROTECTED_STORE_FAILED');
 try{return await new Promise((accept,reject)=>{
  const child=spawn(executablePath,[protectedRoot],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']}),chunks:Buffer[]=[];let bytes=0,settled=false;
  const finish=(error?:Error,value?:Record<string,unknown>)=>{if(settled)return;settled=true;clearTimeout(timer);if(error)reject(error);else accept(value!);};
  const timer=setTimeout(()=>{child.kill();finish(Error('PROTECTED_STORE_FAILED'));},10000);
  child.on('error',()=>finish(Error('PROTECTED_STORE_FAILED')));child.stdin.on('error',()=>finish(Error('PROTECTED_STORE_FAILED')));
  child.stderr.resume();child.stdout.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>16384){child.kill();finish(Error('PROTECTED_STORE_FAILED'));}else chunks.push(chunk);});
  child.on('close',code=>{try{const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(code!==0||value.ok!==true||!value.data||typeof value.data!=='object'||Array.isArray(value.data)||Object.keys(value).sort().join(',')!=='data,ok')throw Error();finish(undefined,value.data);}catch{finish(Error('PROTECTED_STORE_FAILED'));}});
  child.stdin.end(input);
 });}finally{input.fill(0);}
}

/** 승인된 FN08 OS 선행 QA만. 서버 실행 grant·Agent 실행 권한을 발급하지 않는다. */
export interface OwnershipQaSpec{runId:string;generation:number;expiresAt:string;profile:'SYNTHETIC_WORKER';mode:'COOPERATIVE'|'STUBBORN'|'ATTACH_DENIED'|'BREAKAWAY';executableHash:string}
export interface OwnedProcessRef{runId:string;generation:number;jobId:string;pid:number;startTicks:string;executableHash:string}
export const ownershipQaApproval=Object.freeze({runId:'8c10a7c8-bfa8-458c-a24b-1f0578119407',createdAt:'2026-10-17T04:25:00.000Z',expiresAt:'2026-10-17T04:55:00.000Z'});
export function validateOwnershipQaApproval(v:any,now=Date.now()):void{
 if(!v||Object.keys(v).sort().join(',')!=='createdAt,expiresAt,runId,sourceSha'||v.runId!==ownershipQaApproval.runId||v.createdAt!==ownershipQaApproval.createdAt||v.expiresAt!==ownershipQaApproval.expiresAt||typeof v.sourceSha!=='string'||!/^[0-9a-f]{40}$/.test(v.sourceSha)||!Number.isFinite(now)||now<Date.parse(ownershipQaApproval.createdAt)||Date.parse(ownershipQaApproval.expiresAt)-now<120000)throw Error('OWNERSHIP_APPROVAL_EXPIRED_OR_INVALID');
}
export function validateOwnershipOriginalRuntime(v:any):void{
 const expected=[{pid:19960,startedAt:'2026-10-17T04:02:09.6293870Z'},{pid:26052,startedAt:'2026-10-15T12:28:17.5262970Z'}];
 if(!v||!Array.isArray(v.processes)||v.processes.length!==2||expected.some(e=>v.processes.filter((p:any)=>p?.pid===e.pid&&p.startedAt===e.startedAt).length!==1)||!Array.isArray(v.listeners)||v.listeners.length!==1||v.listeners[0]?.port!==3830||v.listeners[0]?.pid!==19960||v.listeners[0]?.address!=='127.0.0.1')throw Error('OWNERSHIP_ORIGINAL_RUNTIME_UNVERIFIED');
}
export function ownershipPreparationCancelled(ref:OwnedProcessRef,facts:any):boolean{
 return !!facts&&facts.state==='PREPARATION_CANCELLED'&&facts.neverResumed===true&&facts.identityVerified===true&&facts.terminationObserved===true&&facts.active===0&&Array.isArray(facts.processes)&&facts.processes.length===0&&!!facts.processRef&&Object.keys(ref).every(k=>facts.processRef[k]===ref[k as keyof OwnedProcessRef]);
}
export class OwnershipQaSafetyState{
 #unknown=false;
 markUnknown(){this.#unknown=true;}
 get observationUnknown(){return this.#unknown;}
 require(operation:string){if(this.#unknown&&operation!=='CANCEL_PREPARED')throw Error('OWNERSHIP_OBSERVATION_UNKNOWN');}
}
// 한 프로세스의 이번 QA run은 UNKNOWN 이후 새 세대/host로 우회 재개하지 않는다.
const ownershipSafety=new OwnershipQaSafetyState();
export class OwnershipFrameDecoder{
 #buffer=Buffer.alloc(16384);#length=0;#failed=false;#ended=false;#delimiterCr=false;
 #invalid():never{this.#failed=true;this.#buffer.fill(0);this.#length=0;this.#delimiterCr=false;throw Error('OWNERSHIP_OBSERVATION_UNKNOWN');}
 push(chunk:Uint8Array):string[]{
  if(this.#failed||this.#ended)return this.#invalid();const lines:string[]=[];
  for(const byte of chunk){
   if(byte===10){try{const size=!this.#delimiterCr&&this.#length&&this.#buffer[this.#length-1]===13?this.#length-1:this.#length;lines.push(new TextDecoder('utf-8',{fatal:true}).decode(this.#buffer.subarray(0,size)));}catch{return this.#invalid();}this.#buffer.fill(0,0,this.#length);this.#length=0;this.#delimiterCr=false;}
   else{if(this.#delimiterCr)return this.#invalid();if(this.#length===16384){if(byte!==13)return this.#invalid();this.#delimiterCr=true;}else this.#buffer[this.#length++]=byte;}
  }
  return lines;
 }
 end():void{if(this.#failed||this.#length||this.#delimiterCr)return this.#invalid();this.#ended=true;}
}
export function encodeOwnershipFrame(value:Record<string,unknown>):Buffer{
 try{const bytes=Buffer.from(JSON.stringify(value),'utf8');if(bytes.length>16384)throw Error();return Buffer.concat([bytes,Buffer.from('\n')]);}catch{throw Error('OWNERSHIP_OBSERVATION_UNKNOWN');}
}
export function decodeOwnershipReply(line:string):any{
 try{const v:any=parseWireJson(line);if(!v||typeof v!=='object'||Array.isArray(v)||!Number.isSafeInteger(v.id)||v.id<0||typeof v.ok!=='boolean')throw Error();
  if(v.ok){if(!v.data||typeof v.data!=='object'||Array.isArray(v.data)||!['PREPARED','RUNNING','RECLAIMED','PREPARATION_CANCELLED'].includes(v.data.state))throw Error();}
  else if(typeof v.error!=='string')throw Error();return v;
 }catch{throw Error('OWNERSHIP_OBSERVATION_UNKNOWN');}
}
export function validateOwnershipQaSpec(v:any,now=Date.now()):OwnershipQaSpec{
 if(!v||Object.keys(v).sort().join(',')!=='executableHash,expiresAt,generation,mode,profile,runId'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v.runId)||!Number.isSafeInteger(v.generation)||v.generation<1||v.generation>20||v.profile!=='SYNTHETIC_WORKER'||!['COOPERATIVE','STUBBORN','ATTACH_DENIED','BREAKAWAY'].includes(v.mode)||!/^[0-9a-f]{64}$/.test(v.executableHash)||typeof v.expiresAt!=='string'||!Number.isFinite(Date.parse(v.expiresAt))||new Date(v.expiresAt).toISOString()!==v.expiresAt||Date.parse(v.expiresAt)<=now||Date.parse(v.expiresAt)-now>1800000)throw Error('OWNERSHIP_SPEC_INVALID');
 return structuredClone(v);
}
export function ownershipReclaimed(ref:OwnedProcessRef,facts:any):boolean{
 return !!facts&&facts.state==='RECLAIMED'&&facts.active===0&&Array.isArray(facts.processes)&&facts.processes.length===0&&!!facts.processRef&&Object.keys(ref).every(k=>facts.processRef[k]===ref[k as keyof OwnedProcessRef]);
}
export function ownershipFailureDiagnostic(v:any){
 if(!v||Object.keys(v).sort().join(',')!=='basename,hashMatches,imageHash,inJob,parentPid,pathMatches,pid,startTicks'||typeof v.basename!=='string'||!/^[A-Za-z0-9._-]{1,80}\.exe$/i.test(v.basename)||!/^[a-f0-9]{64}$/.test(v.imageHash)||!Number.isSafeInteger(v.pid)||v.pid<1||!Number.isSafeInteger(v.parentPid)||v.parentPid<0||!/^\d{17,20}$/.test(v.startTicks)||[v.inJob,v.pathMatches,v.hashMatches].some(x=>typeof x!=='boolean'))return null;
 return {kind:'OWNERSHIP_DIAGNOSTIC' as const,state:'UNKNOWN' as const,...structuredClone(v)};
}
export async function openOwnershipQaHost(options:{executablePath:string;expectedExecutableHash:string;root:string},spec:OwnershipQaSpec){
 ownershipSafety.require('PREPARE');
 validateOwnershipQaSpec(spec);const approved='D:\\tmp\\anvil-v3-fn08-ownership-qa-r2';
 if(spec.runId!==ownershipQaApproval.runId||spec.expiresAt!==ownershipQaApproval.expiresAt)throw Error('OWNERSHIP_APPROVAL_EXPIRED_OR_INVALID');
 if(process.platform!=='win32'||options.root!==approved||options.executablePath!==approved+'\\bin\\AnvilOwnershipHost.exe'||!/^[0-9a-f]{64}$/.test(options.expectedExecutableHash))throw Error('OWNERSHIP_HOST_INVALID');
 for(const p of [approved,approved+'\\bin',options.executablePath]){let current=p;while(true){const s=await lstat(current);if(s.isSymbolicLink())throw Error('OWNERSHIP_HOST_INVALID');if(current===parse(current).root)break;current=dirname(current);}if((await realpath(p)).toLowerCase()!==p.toLowerCase())throw Error('OWNERSHIP_HOST_INVALID');}
 if(createHash('sha256').update(await readFile(options.executablePath)).digest('hex')!==options.expectedExecutableHash)throw Error('OWNERSHIP_HOST_INVALID');
 validateOwnershipQaApproval(JSON.parse(await readFile(approved+'\\lease.json','utf8')));
 const child=spawn(options.executablePath,[approved],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']}),pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();let sequence=0,unknown=false,closing=false;
 const fail=()=>{unknown=true;ownershipSafety.markUnknown();for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('OWNERSHIP_OBSERVATION_UNKNOWN'));}pending.clear();};
 child.on('error',fail);child.on('close',()=>{if(!closing)fail();else unknown=true;});child.stdin.on('error',fail);child.stderr.resume();
 const decoder=new OwnershipFrameDecoder();child.stdout.on('data',(chunk:Buffer)=>{try{for(const line of decoder.push(chunk)){
  const v=decodeOwnershipReply(line);const p=pending.get(v.id);if(!p)throw Error();clearTimeout(p.timer);pending.delete(v.id);
  if(v.ok===true&&v.data&&typeof v.data==='object'&&!Array.isArray(v.data)&&['PREPARED','RUNNING','RECLAIMED','PREPARATION_CANCELLED'].includes(v.data.state))p.resolve(v.data);
  else{const error=Error(['OWNERSHIP_REF_MISMATCH','OWNERSHIP_ATTACH_DENIED','OWNERSHIP_SPEC_INVALID','OWNERSHIP_FORCE_DENIED','OWNERSHIP_ALREADY_STARTED','OWNERSHIP_OBSERVATION_UNKNOWN'].includes(v.error)?v.error:'OWNERSHIP_HOST_FAILED');if(['INPUT','VALIDATE_SPEC','CREATE_JOB','CREATE_SUSPENDED','ATTACH_JOB','PREPARED_FACTS','BOUND_OPERATION','QUERY_JOB','OPEN_MEMBER','VERIFY_MEMBER','VERIFY_IMAGE','VERIFY_TIME','RESUME','CANCEL_PREPARED'].includes(v.phase))Object.assign(error,{phase:v.phase,nativeError:Number.isInteger(v.nativeError)?v.nativeError:null,exceptionType:['InvalidOperationException','InvalidCastException','ArgumentException','IOException','Win32Exception','FormatException','NullReferenceException'].includes(v.exceptionType)?v.exceptionType:'OTHER',diagnostic:ownershipFailureDiagnostic(v.diagnostic)});if(error.message==='OWNERSHIP_OBSERVATION_UNKNOWN'||error.message==='OWNERSHIP_HOST_FAILED')fail();p.reject(error);}
 }}catch{fail();child.stdin.end();}});child.stdout.on('end',()=>{try{decoder.end();if(!closing||pending.size)fail();}catch{fail();}});
 const send=(operation:string,value:Record<string,unknown>)=>new Promise<any>((accept,reject)=>{let bytes:Buffer;const id=++sequence;try{ownershipSafety.require(operation);if(unknown&&operation!=='CANCEL_PREPARED')throw Error('OWNERSHIP_OBSERVATION_UNKNOWN');bytes=encodeOwnershipFrame({id,operation,...value});}catch(e){fail();reject(e);return;}const timer=setTimeout(()=>{pending.delete(id);fail();reject(Error('OWNERSHIP_OBSERVATION_UNKNOWN'));},7000);pending.set(id,{resolve:accept,reject,timer});child.stdin.write(bytes);});
 let ref:OwnedProcessRef,resumed=false;
 try{const prepared=await send('PREPARE',{spec});ref=prepared.processRef;if(!ref||ref.runId!==spec.runId||ref.generation!==spec.generation||ref.executableHash!==spec.executableHash||!Number.isSafeInteger(ref.pid)||ref.pid<1||!/^\d{17,20}$/.test(ref.startTicks)||!/^[-0-9a-f]{36}$/.test(ref.jobId)||prepared.state!=='PREPARED'||prepared.active!==1){fail();throw Error('OWNERSHIP_OBSERVATION_UNKNOWN');}}catch(e){closing=true;child.stdin.end();throw e;}
 return{helperPid:child.pid!,processRef:ref,preparedState:'PREPARED' as const,
  resume:async()=>{const value=await send('RESUME',{processRef:ref});resumed=true;return value;},observe:(expected:OwnedProcessRef=ref)=>send('OBSERVE',{processRef:expected}),
  stop:()=>send('STOP',{processRef:ref}),force:(expected:OwnedProcessRef=ref)=>send('FORCE',{processRef:expected,authorization:'SYNTHETIC_OWNED_JOB_ONLY'}),
  async close(){closing=true;try{if(!resumed&&child.exitCode===null){const value=await send('CANCEL_PREPARED',{processRef:ref});if(!ownershipPreparationCancelled(ref,value)){fail();throw Error('OWNERSHIP_OBSERVATION_UNKNOWN');}}}finally{child.stdin.end();}if(child.exitCode!==null){if(child.exitCode!==0)throw Error('OWNERSHIP_OBSERVATION_UNKNOWN');return;}await new Promise<void>((accept,reject)=>{const timer=setTimeout(()=>{fail();reject(Error('OWNERSHIP_OBSERVATION_UNKNOWN'));},7000);child.once('close',code=>{clearTimeout(timer);if(code!==0){fail();reject(Error('OWNERSHIP_OBSERVATION_UNKNOWN'));}else accept();});});},
  get observationUnknown(){return unknown||ownershipSafety.observationUnknown;}
 };
}
