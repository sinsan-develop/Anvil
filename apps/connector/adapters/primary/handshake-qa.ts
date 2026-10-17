import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {parseWireJson} from '../../../../contracts/canonical.ts';
import {Codex0161Codec} from './codec.ts';

export interface HandshakeRunBinding {policy:string;runId:string;sourceSha:string;hostSourceHash:string;issuedAt:string;expiresAt:string}
const compilePolicy='AV3-PMO-FN06-COMPILE-RECEIPT-01';
const fixedHostHash='39111ada9ff079143507db5c2986e1f42d3f0679519ba524a82775dddc26cbac';
const fixedCompilerHash='46809206887326d2d24db1eff1f3064de972c3451abe766b49111450a5e08e00';
const compileSource='apps/connector/native/CodexHandshakeHost.cs';
/** 자체 실행 권한 발급이 아닌 새 compile-only 후보/창의 순수 대조. */
export function checkCompileOnlyRunBinding(value:unknown,currentSha:string,hostHash:string,compilerHash:string,nowMs:number):boolean{
 try{
  if(!value||typeof value!=='object'||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype||Object.getOwnPropertySymbols(value).length)return false;
  const keys=['policy','runId','sourceSha','hostSourceHash','compilerHash','issuedAt','expiresAt'],d=Object.getOwnPropertyDescriptors(value);
  if(Object.keys(d).length!==keys.length||keys.some(k=>!d[k]||!('value'in d[k]!)||typeof d[k]!.value!=='string'||d[k]!.value.length>128))return false;
  if(d.policy!.value!==compilePolicy||d.runId!.value==='56d83f93-1f39-4cac-874f-22df04596dae'||d.compilerHash!.value!==fixedCompilerHash||compilerHash!==fixedCompilerHash||hostHash!==fixedHostHash)return false;
  const original={policy:'AV3-PMO-FN06-HANDSHAKE-OWNERSHIP-01',runId:d.runId!.value,sourceSha:d.sourceSha!.value,hostSourceHash:d.hostSourceHash!.value,issuedAt:d.issuedAt!.value,expiresAt:d.expiresAt!.value};
  return checkHandshakeRunBinding(original,currentSha,hostHash,nowMs);
 }catch{return false;}
}
/** 예외는 인증된 증거가 아니다. own data만 유한 정규화하고 원문/메시지/stack은 반환하지 않는다. */
export function compileFailureReceipt(error:unknown,elapsedMs:number,sourceAbsolute?:string){
 const own=(key:string):unknown=>{try{if(!error||typeof error!=='object'||types.isProxy(error))return undefined;const d=Object.getOwnPropertyDescriptor(error,key);return d&&'value'in d?d.value:undefined;}catch{return undefined;}};
 const numeric=(v:unknown,min:number,max=2147483647)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max?v:'UNKNOWN' as const;
 const status=numeric(own('status'),-2147483648,4294967295),pid=numeric(own('pid'),1),rawSignal=own('signal'),rawCode=own('code');
 const signal=rawSignal===null?null:typeof rawSignal==='string'&&['SIGTERM','SIGKILL','SIGINT','SIGABRT','SIGSEGV','SIGBREAK'].includes(rawSignal)?rawSignal:'UNKNOWN';
 const code=typeof rawCode==='string'&&['ETIMEDOUT','EACCES','EPERM','ENOENT','ENOEXEC','E2BIG','ENOMEM','ENOBUFS','ERR_CHILD_PROCESS_STDIO_MAXBUFFER'].includes(rawCode)?rawCode:'UNKNOWN';
 const diagnostics:{code:string;severity:'error'|'warning';source:string;line:number;column:number}[]=[];
 function stream(value:unknown){
  try{
   if(!value||typeof value!=='object'||types.isProxy(value)||!ArrayBuffer.isView(value)||Object.getPrototypeOf(value)!==Buffer.prototype)return {bytes:'UNKNOWN' as const,sha256:'UNKNOWN',hashedBytes:0,truncated:'UNKNOWN' as const};
   const getLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength')!.get!;
   const bytes=getLength.call(value) as number,hashedBytes=Math.min(bytes,131072);
   const typed=Object.getPrototypeOf(Uint8Array.prototype);
   const buffer=Object.getOwnPropertyDescriptor(typed,'buffer')!.get!.call(value) as ArrayBuffer;
   if(types.isSharedArrayBuffer(buffer))throw Error('SHARED_BUFFER');
   const offset=Object.getOwnPropertyDescriptor(typed,'byteOffset')!.get!.call(value) as number;
   // No species/constructor/subarray or caller getter; cap the copy before decoding.
   const prefix=new Uint8Array(hashedBytes);prefix.set(new Uint8Array(buffer,offset,hashedBytes));
   const sha256=createHash('sha256').update(prefix).digest('hex');
   let text='';try{text=new TextDecoder('utf-8',{fatal:true}).decode(prefix);}catch{/* byte facts remain known, diagnostics unavailable */}
   for(const row of text.split(/\r?\n/)){
    if(diagnostics.length>=32)break;
    const m=/^(.+)\(([0-9]{1,7}),([0-9]{1,7})\): (error|warning) (CS[0-9]{4}):/.exec(row);
    if(!m)continue;
    const path=m[1]!.replaceAll('\\','/');
    if(path!==compileSource&&(typeof sourceAbsolute!=='string'||path!==sourceAbsolute.replaceAll('\\','/')))continue;
    const line=Number(m[2]),column=Number(m[3]);if(line<1||column<1)continue;
    diagnostics.push({code:m[5]!,severity:m[4] as 'error'|'warning',source:compileSource,line,column});
   }
   prefix.fill(0);return {bytes,sha256,hashedBytes,truncated:bytes>hashedBytes};
  }catch{return {bytes:'UNKNOWN' as const,sha256:'UNKNOWN',hashedBytes:0,truncated:'UNKNOWN' as const};}
 }
 const stdout=stream(own('stdout')),stderr=stream(own('stderr'));
 return {classification:code==='ETIMEDOUT'?'TIMEOUT':status!=='UNKNOWN'&&status!==0?'NONZERO':['EACCES','EPERM','ENOENT','ENOEXEC','E2BIG','ENOMEM'].includes(code)?'SPAWN_ERROR':'UNKNOWN',status,signal,code,pid,elapsedMs:numeric(elapsedMs,0),stdout,stderr,diagnostics};
}
/** compile 콜백만 소비하는 단일 시도. native 실행 함수를 받지 않으며 성공 후에도 종료한다. */
export class CompileOnlyAttempt{
 #used=false;
 run(authorized:boolean,compile:()=>Uint8Array,clock:()=>number,sourceAbsolute?:string){
  if(this.#used)throw Error('QA_COMPILE_ONLY_ALREADY_USED');this.#used=true;
  if(!authorized)throw Error('QA_COMPILE_ONLY_NOT_AUTHORIZED');
  const start=clock();
  try{const stdout=compile();return {outcome:'COMPILED_NOT_EXECUTED' as const,nativeStarted:false as const,receipt:compileFailureReceipt({status:0,stdout},Math.floor(clock()-start),sourceAbsolute)};}
  catch(error){return {outcome:'COMPILE_FAILED' as const,nativeStarted:false as const,receipt:compileFailureReceipt(error,Math.floor(clock()-start),sourceAbsolute)};}
 }
}
export class HandshakeHostFrames{
 readonly #buffer=new Uint8Array(8193);#length=0;#total=0;#frames=0;#unusable=false;
 #invalid():never{this.#unusable=true;this.#buffer.fill(0);this.#length=0;throw Error('QA_HOST_FRAME_INVALID');}
 push(chunk:Uint8Array):unknown[]{
  if(this.#unusable||!(chunk instanceof Uint8Array)||chunk.byteLength>524288-this.#total)return this.#invalid();
  this.#total+=chunk.byteLength;const out:unknown[]=[];
  for(const b of chunk){
   if(b===10){
    const length=this.#length-(this.#buffer[this.#length-1]===13?1:0);
    if(length>8192||++this.#frames>256)return this.#invalid();
    try{out.push(parseWireJson(new TextDecoder('utf-8',{fatal:true}).decode(this.#buffer.subarray(0,length))));}catch{return this.#invalid();}
    this.#buffer.fill(0,0,this.#length);this.#length=0;
   }else{if(this.#length===this.#buffer.length)return this.#invalid();this.#buffer[this.#length++]=b;}
  }
  return out;
 }
 finish():void{if(this.#unusable||this.#length)return this.#invalid();this.#unusable=true;}
}
/** 로컬 한시 harness 입력 대조일 뿐 사용자/PMO 권한의 암호학적 증명이 아니다. */
export function checkHandshakeRunBinding(value:unknown,currentSha:string,hostHash:string,nowMs:number):value is HandshakeRunBinding{
 try{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype||Object.getOwnPropertySymbols(value).length)return false;
  const d=Object.getOwnPropertyDescriptors(value),keys=['policy','runId','sourceSha','hostSourceHash','issuedAt','expiresAt'];
  if(Object.keys(d).length!==keys.length||keys.some(k=>!d[k]||!('value'in d[k]!)||typeof d[k]!.value!=='string'||d[k]!.value.length>128))return false;
  const v=value as HandshakeRunBinding;
  if(v.policy!=='AV3-PMO-FN06-HANDSHAKE-OWNERSHIP-01'||!/^[-0-9a-f]{36}$/.test(v.runId)||!/^\w{8}-\w{4}-4\w{3}-[89ab]\w{3}-\w{12}$/.test(v.runId))return false;
  if(!/^[a-f0-9]{40}$/.test(v.sourceSha)||! /^[a-f0-9]{64}$/.test(v.hostSourceHash)||v.sourceSha!==currentSha||v.hostSourceHash!==hostHash)return false;
  const from=Date.parse(v.issuedAt),to=Date.parse(v.expiresAt);
  return Number.isSafeInteger(nowMs)&&Number.isFinite(from)&&Number.isFinite(to)&&new Date(from).toISOString()===v.issuedAt&&new Date(to).toISOString()===v.expiresAt&&from<=nowMs&&to>from&&to-from<=1800000&&to-nowMs>=20000;
 }catch{return false;}
}

const home='D:\\tmp\\anvil-v3-fn06-handshake-0161-qa\\home';
type Phase='NEW'|'WAIT_RESULT'|'WAIT_EXIT'|'PROTOCOL_COMPLETE'|'UNKNOWN';
type Failure='CLOCK_INVALID'|'ALREADY_STARTED'|'NOT_STARTED'|'HANDSHAKE_TIMEOUT'|'EXIT_TIMEOUT'|'STDOUT_LIMIT'|'STDERR_LIMIT'|'FRAME_INVALID'|'RESULT_INVALID'|'UNEXPECTED_OUTPUT'|'INITIALIZE_NOT_COMPLETE'|'PROCESS_EXIT_INVALID';
// 메모리 요구뿐이다. 실제 write/종료나 PMO의 실행 허가를 제공하지 않는다.
export type HandshakeQaAction={readonly kind:'WRITE_STDIN';readonly wire:Uint8Array}|{readonly kind:'CLOSE_STDIN'}|{readonly kind:'STOP_EXACT_PROCESS'};
export interface HandshakeQaReport {
 readonly phase:Phase;readonly code:Failure|undefined;readonly stdinMessages:number;
 // 초과/UNKNOWN 이후의 전체 OS 출력량이 아닌, 예산 안에서 수용한 입력의 바이트·digest다.
 readonly stdoutAcceptedBytes:number;readonly stderrAcceptedBytes:number;readonly stdoutDigest:string;readonly stderrDigest:string;
 readonly exitObservationExpired:boolean;readonly actualExecutionVerified:false;readonly executionAuthorized:false;
 readonly workAccepted:false;readonly ownership:'UNVERIFIED';
}

/** 고정 QA의 순수 프로토콜 gate. OS helper/transport/권한/실측 증거에 미연결. */
export class CodexHandshakeQa {
 readonly #codec=new Codex0161Codec({maxFrameBytes:65536,maxPending:1});
 readonly #frame=new Uint8Array(65538);
 readonly #stdoutHash=createHash('sha256');readonly #stderrHash=createHash('sha256');
 #phase:Phase='NEW';#code:Failure|undefined;#lastMs=0;#length=0;#stdinMessages=0;#stdoutBytes=0;#stderrBytes=0;
 #stdinClosed=false;#stopRequested=false;#stdoutEof=false;#stderrEof=false;#exitObserved=false;#exitZero=false;#exitObservationExpired=false;

 #close():HandshakeQaAction[]{if(this.#stdinClosed||this.#stdinMessages===0)return [];this.#stdinClosed=true;return [{kind:'CLOSE_STDIN'}];}
 #fail(code:Failure):HandshakeQaAction[]{
  this.#phase='UNKNOWN';this.#code??=code;this.#frame.fill(0);this.#length=0;return this.#close();
 }
 #advance(atMs:number):HandshakeQaAction[]{
  if(!Number.isSafeInteger(atMs)||atMs<0||atMs<this.#lastMs)return this.#fail('CLOCK_INVALID');
  this.#lastMs=atMs;
  if(this.#phase==='PROTOCOL_COMPLETE'||this.#phase==='NEW')return [];
  let actions:HandshakeQaAction[]=[];
  if(atMs>=15000&&this.#phase==='WAIT_RESULT')actions=this.#fail('HANDSHAKE_TIMEOUT');
  if(atMs>=18000&&this.#phase==='WAIT_EXIT')actions.push(...this.#fail('EXIT_TIMEOUT'));
  if(atMs>=18000&&!this.#exitObserved){
   actions.push(...this.#fail('EXIT_TIMEOUT'));
   if(!this.#stopRequested){this.#stopRequested=true;actions.push({kind:'STOP_EXACT_PROCESS'});}
  }
  if(atMs>=20000&&!this.#exitObserved)this.#exitObservationExpired=true;
  return actions;
 }
 start(atMs:number):HandshakeQaAction[]{
  if(this.#phase!=='NEW')return this.#fail('ALREADY_STARTED');
  if(atMs!==0)return this.#fail('CLOCK_INVALID');
  const out=this.#codec.encodeRequest('initialize','anvil-fn06-init-01',{
   capabilities:{experimentalApi:false,explicitGatewayOauth:true,requestAttestation:false},
   clientInfo:{name:'anvil-fn06-handshake-qa',version:'0.1.0'},
  });
  if(out.kind!=='ENCODED')return this.#fail('FRAME_INVALID');
  this.#phase='WAIT_RESULT';this.#stdinMessages=1;return [{kind:'WRITE_STDIN',wire:out.wire}];
 }
 stdout(chunk:Uint8Array,atMs:number):HandshakeQaAction[]{
  const actions=this.#advance(atMs);if(this.#phase==='UNKNOWN'||this.#phase==='PROTOCOL_COMPLETE')return actions;
  if(this.#phase==='NEW')return this.#fail('NOT_STARTED');
  if(!(chunk instanceof Uint8Array))return this.#fail('FRAME_INVALID');
  if(chunk.byteLength>131072-this.#stdoutBytes)return this.#fail('STDOUT_LIMIT');
  this.#stdoutBytes+=chunk.byteLength;this.#stdoutHash.update(chunk);
  if(!chunk.byteLength)return [];
  if(this.#phase!=='WAIT_RESULT'||this.#stdoutEof)return this.#fail('UNEXPECTED_OUTPUT');
  // 부가 완전/부분 프레임이 같은 chunk에 오면 initialized를 내보내기 전에 거절한다.
  for(let n=0;n<chunk.length;n++){
   if(this.#length===this.#frame.length)return this.#fail('FRAME_INVALID');
   const byte=chunk[n]!;this.#frame[this.#length++]=byte;
   if(byte!==10)continue;
   if(n!==chunk.length-1)return this.#fail('UNEXPECTED_OUTPUT');
   try{
    const facts=this.#codec.push(this.#frame.subarray(0,this.#length));
    if(facts.length!==1||facts[0]?.kind!=='RPC_RESPONSE'||facts[0].method!=='initialize')return this.#fail('RESULT_INVALID');
    const text=new TextDecoder('utf-8',{fatal:true}).decode(this.#frame.subarray(0,this.#length));
    const value=parseWireJson(text) as {result:{codexHome:string;platformFamily:string;platformOs:string}};
    if(value.result.codexHome!==home||value.result.platformFamily!=='windows'||value.result.platformOs!=='windows')return this.#fail('RESULT_INVALID');
    const out=this.#codec.encodeInitialized();if(out.kind!=='ENCODED')return this.#fail('FRAME_INVALID');
    this.#frame.fill(0);this.#length=0;this.#stdinMessages=2;this.#phase='WAIT_EXIT';
    return [{kind:'WRITE_STDIN',wire:out.wire},...this.#close()];
   }catch{return this.#fail('RESULT_INVALID');}
  }
  return [];
 }
 stderr(chunk:Uint8Array,atMs:number):HandshakeQaAction[]{
  const actions=this.#advance(atMs);if(this.#phase==='UNKNOWN'||this.#phase==='PROTOCOL_COMPLETE')return actions;
  if(this.#phase==='NEW')return this.#fail('NOT_STARTED');
  if(!(chunk instanceof Uint8Array))return this.#fail('FRAME_INVALID');
  if(this.#stderrEof&&chunk.byteLength)return this.#fail('UNEXPECTED_OUTPUT');
  if(chunk.byteLength>32768-this.#stderrBytes)return this.#fail('STDERR_LIMIT');
  this.#stderrBytes+=chunk.byteLength;this.#stderrHash.update(chunk);return [];
 }
 stdoutEnded(atMs:number):HandshakeQaAction[]{
  const actions=this.#advance(atMs);if(this.#phase==='UNKNOWN'||this.#phase==='PROTOCOL_COMPLETE')return actions;
  if(this.#phase!=='WAIT_EXIT')return this.#fail('INITIALIZE_NOT_COMPLETE');
  if(this.#stdoutEof)return this.#fail('UNEXPECTED_OUTPUT');
  if(this.#codec.finish().at(-1)?.kind!=='STREAM_CLOSED')return this.#fail('FRAME_INVALID');
  this.#stdoutEof=true;this.#complete();return [];
 }
 stderrEnded(atMs:number):HandshakeQaAction[]{
  const actions=this.#advance(atMs);if(this.#phase==='UNKNOWN'||this.#phase==='PROTOCOL_COMPLETE')return actions;
  if(this.#phase==='NEW')return this.#fail('NOT_STARTED');
  if(this.#stderrEof)return this.#fail('UNEXPECTED_OUTPUT');
  this.#stderrEof=true;this.#complete();return [];
 }
 #complete():void{if(this.#phase==='WAIT_EXIT'&&this.#stdoutEof&&this.#stderrEof&&this.#exitZero)this.#phase='PROTOCOL_COMPLETE';}
 processExited(exitCode:number,atMs:number):HandshakeQaAction[]{
  if(Number.isSafeInteger(exitCode))this.#exitObserved=true;
  const actions=this.#advance(atMs);
  if(this.#phase==='PROTOCOL_COMPLETE')return actions;
  if(!Number.isSafeInteger(exitCode)||exitCode!==0){if(this.#phase!=='UNKNOWN')actions.push(...this.#fail('PROCESS_EXIT_INVALID'));return actions;}
  this.#exitZero=true;
  if(this.#phase==='UNKNOWN')return actions;
  if(this.#phase!=='WAIT_EXIT')return this.#fail('INITIALIZE_NOT_COMPLETE');
  this.#complete();return actions;
 }
 tick(atMs:number):HandshakeQaAction[]{return this.#advance(atMs);}
 report():HandshakeQaReport{
  return {phase:this.#phase,code:this.#code,stdinMessages:this.#stdinMessages,stdoutAcceptedBytes:this.#stdoutBytes,stderrAcceptedBytes:this.#stderrBytes,
   stdoutDigest:this.#stdoutHash.copy().digest('hex'),stderrDigest:this.#stderrHash.copy().digest('hex'),exitObservationExpired:this.#exitObservationExpired,
   actualExecutionVerified:false,executionAuthorized:false,workAccepted:false,ownership:'UNVERIFIED'};
 }
}
