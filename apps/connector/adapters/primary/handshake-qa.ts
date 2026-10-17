import {createHash} from 'node:crypto';
import {parseWireJson} from '../../../../contracts/canonical.ts';
import {Codex0161Codec} from './codec.ts';

export interface HandshakeRunBinding {policy:string;runId:string;sourceSha:string;hostSourceHash:string;issuedAt:string;expiresAt:string}
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
