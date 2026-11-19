import {spawn} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {Writable} from 'node:stream';
import {createHash} from 'node:crypto';
import {openSync,writeSync,fsyncSync,closeSync,fstatSync,lstatSync,realpathSync} from 'node:fs';
import {win32} from 'node:path';
import {performance} from 'node:perf_hooks';
import {types} from 'node:util';
import {canonicalJson} from '../contracts/canonical.ts';
import {createSubnetObservationLocalHost,prepareSubnetObservationLocal} from './qa-ix01-subnet-observation-local-host.ts';
import type {SubnetCollectionClock} from './qa-ix01-subnet-observation-supervisor.ts';

const unknown=Object.freeze({status:'UNKNOWN',code:'WINDOWS_OBSERVATION_UNCONFIRMED'} as const);
const hash=(v:unknown)=>createHash('sha256').update(canonicalJson(v)).digest('hex');
const file=String.raw`C:\Windows\System32\OpenSSH\ssh.exe`;
const nativeOptions=Object.freeze({cwd:String.raw`C:\Windows\System32`,env:Object.freeze({}),shell:false,windowsHide:true,stdio:Object.freeze(['pipe','pipe','ignore'] as const)});
const on=EventEmitter.prototype.on,off=EventEmitter.prototype.removeListener;
function fail():never{throw null;}
function fields(v:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!v||typeof v!=='object'||types.isProxy(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).length!==keys.length)return fail();
 const out:Record<string,unknown>=Object.create(null);for(const k of keys){const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)return fail();out[k]=d.value;}return out;
}
function rootPath(v:unknown):string{
 if(typeof v!=='string'||v.length>200||!/^([A-Z]):\\[^<>:"/|?*\x00-\x1f]+$/.test(v)||win32.normalize(v)!==v||v.endsWith('\\'))return fail();
 for(const p of v.slice(3).split('\\'))if(!p||p==='.'||p==='..'||/[. ]$/.test(p)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))return fail();return v;
}
function emitter(v:unknown):v is EventEmitter{return !!v&&typeof v==='object'&&!types.isProxy(v)&&v instanceof EventEmitter;}
const ap=Object.getPrototypeOf(Uint8Array.prototype),length=Object.getOwnPropertyDescriptor(ap,'byteLength')!.get!,backing=Object.getOwnPropertyDescriptor(ap,'buffer')!.get!;
function ownBytes(v:unknown,max:number){if(types.isProxy(v)||!types.isUint8Array(v)||types.isSharedArrayBuffer(backing.call(v)))return fail();const n=length.call(v);if(n>max)return fail();const b=new Uint8Array(n);Uint8Array.prototype.set.call(b,v);return b;}

export interface SubnetWindowsPorts{
 clock:SubnetCollectionClock;
 platform():unknown;
 review(binding:unknown):unknown;
 openExclusive(path:string):unknown;
 write(original:object,bytes:Uint8Array,offset:number):unknown;
 flush(original:object):unknown;
 close(original:object):unknown;
 confirmClosed(original:object,bytes:number):unknown;
 spawn(file:string,args:readonly string[],options:typeof nativeOptions):unknown;
 end(original:object,bytes:Uint8Array):void;
}
/** 후속 운영 verifier의 정확 경계. 이 함수는 구현하지 않으며 기본 VERIFIED는 없다.
 * 같은 OS/승인 감독이 상위 plan/approval·시도/기한·원장 부모의 현재 사용자 소유/접근·reparse/경로와
 * Windows SSH 원바이트, 실제 설정/Include/Match 발동, 기존 host trust 및 고정 launch options를
 * 효과 없이 검산해야 한다. 요청의 hash/문자열 자체는 해당 사실의 증명이 아니다. */
export type SubnetWindowsReview=(binding:unknown)=>unknown;

function nativePorts(review:SubnetWindowsReview):SubnetWindowsPorts{
 type FileState={fd:number;path:string;root:string;dev:bigint;ino:bigint;closed:boolean;flushed:boolean;size:number};
 const files=new WeakMap<object,FileState>();
 const original=(o:object)=>{const s=files.get(o);if(!s)return fail();return s;};
 const parent=(path:string)=>{const root=win32.dirname(path),s=lstatSync(root,{bigint:true});if(!s.isDirectory()||s.isSymbolicLink()||realpathSync(root)!==root)return fail();return root;};
 const sameFile=(s:FileState)=>{const f=lstatSync(s.path,{bigint:true});if(!f.isFile()||f.isSymbolicLink()||f.nlink!==1n||f.dev!==s.dev||f.ino!==s.ino||f.size!==BigInt(s.size)||realpathSync(s.path)!==s.path||parent(s.path)!==s.root)return fail();};
 return {
  clock:{now:()=>Date.now(),monotonic:()=>performance.now(),setTimeout:(f,ms)=>setTimeout(f,ms),clearTimeout:h=>clearTimeout(h as ReturnType<typeof setTimeout>)},
  platform:()=>process.platform,review,
  openExclusive(path){
   const root=parent(path),fd=openSync(path,'wx',0o600);let accepted=false;
   try{const st=fstatSync(fd,{bigint:true});if(!st.isFile()||st.nlink!==1n||st.size!==0n)return fail();const token=Object.freeze({});files.set(token,{fd,path,root,dev:st.dev,ino:st.ino,closed:false,flushed:false,size:0});accepted=true;return token;}
   finally{if(!accepted)closeSync(fd);}
  },
  write(token,bytes,offset){const s=original(token);if(s.closed||s.flushed||offset!==s.size)return fail();const n=writeSync(s.fd,bytes,offset,bytes.length-offset,null);s.size+=n;return n;},
  flush(token){const s=original(token);if(s.closed||s.flushed)return fail();const f=fstatSync(s.fd,{bigint:true});if(!f.isFile()||f.nlink!==1n||f.dev!==s.dev||f.ino!==s.ino||f.size!==BigInt(s.size))return fail();sameFile(s);fsyncSync(s.fd);s.flushed=true;return true;},
  close(token){const s=original(token);if(s.closed)return fail();s.closed=true;closeSync(s.fd);return true;},
  confirmClosed(token,bytes){const s=original(token);if(!s.closed||!s.flushed||s.size!==bytes)return fail();sameFile(s);files.delete(token);return true;},
  spawn:(f,a,o)=>spawn(f,[...a],{cwd:o.cwd,env:{...o.env},shell:false,windowsHide:true,stdio:['pipe','pipe','ignore']}),
  end(child,bytes){const stdin=Object.getOwnPropertyDescriptor(child,'stdin')?.value;if(!stdin||types.isProxy(stdin)||!(stdin instanceof Writable))return fail();Reflect.apply(Writable.prototype.end,stdin,[Buffer.from(bytes)]);},
 };
}

/** source-only 호출 후보다. import/factory 생성은 OS 조회·원장 생성·spawn을 하지 않는다.
 * 빈 Windows env/System32 cwd는 아직 OpenSSH alias/agent 인증 호환이 검증되지 않은 후보다.
 * WSL Node의 이미 고정된 빈 env와 혼동하지 않는다. 실제 verifier/고정 실행안 없이 운용할 수 없다.
 * 기록은 신규 wx만 사용하며 재개/기존 영수증 읽기·삭제·권한 변경·kill/재시도 경로가 없다.
 * timeout 뒤 원 SSH가 미종결이면 보존한다. 로컬 close는 원격 종료 증거를 대신하지 않는다. */
export function createSubnetWindowsSupervisor(review:SubnetWindowsReview,ports?:SubnetWindowsPorts){
 const supplied=ports??nativePorts(review);let spent=false;
 return Object.freeze({async run(metadataBundle:unknown,observationBundle:unknown,input:unknown,request:unknown){
  if(spent)return unknown;spent=true;
  let owned:Uint8Array|undefined;
  try{
   if(typeof review!=='function'||types.isProxy(review))return unknown;
   const p=fields(supplied,['clock','platform','review','openExclusive','write','flush','close','confirmClosed','spawn','end']),c=fields(p.clock,['now','monotonic','setTimeout','clearTimeout']);
   for(const f of [...Object.values(c),...Object.entries(p).filter(([k])=>k!=='clock').map(([,v])=>v)])if(typeof f!=='function'||types.isProxy(f))return unknown;
   if(p.review!==review)return unknown;
   const invoke=(k:string,a:unknown[])=>Reflect.apply(p[k] as Function,supplied,a),time=(k:string,a:unknown[]=[])=>Reflect.apply(c[k] as Function,p.clock,a);
   if(invoke('platform',[])!=='win32')return unknown;
   const r=fields(request,['sourceHead','identity','planHash','ledgerRoot']),root=rootPath(r.ledgerRoot);
   if(typeof r.planHash!=='string'||!/^[a-f0-9]{64}$/.test(r.planHash))return unknown;
   const prepared=prepareSubnetObservationLocal(metadataBundle,observationBundle,input,r.sourceHead,r.identity);owned=prepared.bundle;
   const q=prepared.meta.input;
   const approval=Object.freeze({schemaVersion:1,purpose:'IX01_WINDOWS_TWO_PHASE',planHash:r.planHash,approvalHash:q.proof.approvalHash,attemptId:q.proof.attemptId,...prepared.window,
    sourceHead:prepared.binding.sourceHead,bindingHash:prepared.bindingHash,ledgerRoot:root,launch:nativeOptions,carrier:prepared.binding.carrier});
   const reviewHash=hash(approval),firstMono=time('monotonic');let lastMono=firstMono,lastWall=prepared.window.issuedAt;
   if(typeof firstMono!=='number'||!Number.isFinite(firstMono)||firstMono<0)return unknown;
   const fresh=()=>{const wall=time('now'),mono=time('monotonic');if(typeof wall!=='number'||!Number.isSafeInteger(wall)||wall<lastWall||wall>=prepared.window.expiresAt||typeof mono!=='number'||!Number.isFinite(mono)||mono<(lastMono as number)||mono-firstMono>=60000)return fail();lastWall=wall;lastMono=mono;return wall;};
   const current=()=>{fresh();if(invoke('platform',[])!=='win32')return fail();const v=fields(invoke('review',[approval]),['status','reviewHash']);fresh();if(v.status!=='CURRENT'||v.reviewHash!==reviewHash)return fail();};
   const usedTokens=new WeakSet<object>();let stopped=false;
   const persist=(phase:'PREFLIGHT'|'OBSERVATION',binding:unknown)=>{
    if(stopped)return fail();current();
    const path=win32.join(root,q.proof.attemptId+(phase==='PREFLIGHT'?'.plan.json':'.observation.json'));
    const record=Object.freeze({schemaVersion:1,purpose:'IX01_WINDOWS_EXCLUSIVE_CONSUMPTION',phase,planHash:r.planHash,reviewHash,approvalHash:q.proof.approvalHash,attemptId:q.proof.attemptId,...prepared.window,binding});
    const bytes=new Uint8Array(Buffer.from(canonicalJson(record)+'\n'));if(bytes.length>4096)return fail();
    let token:object|undefined,closeAttempted=false;
    try{
     fresh();const opened=invoke('openExclusive',[path]);if(!opened||typeof opened!=='object'||types.isProxy(opened)||usedTokens.has(opened))return fail();token=opened as object;usedTokens.add(token);fresh();
     // 유한 전체 write. 부분 write는 다음 오프셋으로만 진행하며 0/초과/기한 오류는 정착 실패다.
     let offset=0;for(let calls=0;offset<bytes.length&&calls<4096;calls++){fresh();const n=invoke('write',[token,bytes,offset]);fresh();if(typeof n!=='number'||!Number.isSafeInteger(n)||n<=0||n>bytes.length-offset)return fail();offset+=n;}
     if(offset!==bytes.length||invoke('flush',[token])!==true)return fail();fresh();closeAttempted=true;if(invoke('close',[token])!==true)return fail();fresh();
     if(invoke('confirmClosed',[token,bytes.length])!==true)return fail();current();
     return Object.freeze({schemaVersion:1,purpose:phase==='PREFLIGHT'?'IX01_SUBNET_TWO_PHASE_CONSUMED':'IX01_SUBNET_OBSERVATION_CONSUMED',receiptId:q.proof.attemptId,bindingHash:hash(binding),status:'CONSUMED'});
    }catch{stopped=true;return fail();}
    finally{bytes.fill(0);if(token&&!closeAttempted){closeAttempted=true;try{invoke('close',[token]);}catch{/* 같은 원 handle의 close 1회만. 정착/재시도 승격 없음. */}}}
   };
   current();const planReceipt=persist('PREFLIGHT',prepared.binding);let planChecked=false,observationChecked=false,observationReceipt:ReturnType<typeof persist>|undefined;
   const children=new WeakMap<object,{sent:boolean;closed:boolean;failed:boolean;input:EventEmitter;output:EventEmitter}>();let starts=0;
   const clock:SubnetCollectionClock={now:fresh,monotonic:()=>{fresh();return lastMono as number;},setTimeout:(fn,ms)=>{fresh();return time('setTimeout',[fn,Math.min(ms,prepared.window.expiresAt-lastWall)]);},clearTimeout:h=>{time('clearTimeout',[h]);}};
   const carrierIdentity=Object.freeze({imageSha256:prepared.binding.carrier.imageSha256,configurationSha256:prepared.binding.carrier.configurationSha256,knownHostsSha256:prepared.binding.carrier.knownHostsSha256});
   const local=createSubnetObservationLocalHost({clock,
    verifyPlanConsumed(receipt,binding){fresh();if(planChecked||receipt!==planReceipt&&hash(receipt)!==hash(planReceipt)||hash(binding)!==prepared.bindingHash)return fail();planChecked=true;return {status:'VERIFIED_CONSUMED',receiptId:planReceipt.receiptId,bindingHash:planReceipt.bindingHash};},
    observationReceipt(binding){fresh();if(!planChecked||starts!==1||observationReceipt)return fail();observationReceipt=persist('OBSERVATION',binding);return observationReceipt;},
    verifyConsumed(receipt,binding){fresh();if(!observationReceipt||observationChecked||hash(receipt)!==hash(observationReceipt)||hash(binding)!==observationReceipt.bindingHash)return fail();observationChecked=true;return {status:'VERIFIED_CONSUMED',receiptId:observationReceipt.receiptId,bindingHash:observationReceipt.bindingHash};},
    verifyCarrier(i){current();if(hash(i)!==prepared.identityHash)return fail();return {status:'VERIFIED',identityHash:prepared.identityHash,configuration:'NO_ADDITIONAL_EFFECTS',hostTrust:'EXACT_ALIAS'};},
    start(f,args,options){
     current();if(stopped||starts>=2||!planChecked||starts===1&&!observationChecked||f!==file||hash({client:f,args,options})!==prepared.binding.commandHash)return fail();starts++;
     const child=invoke('spawn',[file,args,nativeOptions]);if(!emitter(child)||children.has(child))return fail();
     const stdin=Object.getOwnPropertyDescriptor(child,'stdin')?.value,stdout=Object.getOwnPropertyDescriptor(child,'stdout')?.value;
     if(!emitter(stdin)||!emitter(stdout)||stdin===stdout||stdin===child||stdout===child)return fail();
     const state={sent:false,closed:false,failed:false,input:stdin,output:stdout};children.set(child,state);
     const failed=()=>{state.failed=true;stopped=true;};
     on.call(child,'error',failed);on.call(stdin,'error',failed);on.call(stdout,'error',failed);
     const closed=()=>{state.closed=true;off.call(child,'error',failed);off.call(stdin,'error',failed);off.call(stdout,'error',failed);off.call(child,'close',closed);};on.call(child,'close',closed);
     return child;
    },
    sendEnd(child,bytes){fresh();if(!child||typeof child!=='object')return fail();const s=children.get(child);if(!s||s.sent||s.closed||s.failed||stopped)return fail();s.sent=true;
     const copy=ownBytes(bytes,98304);invoke('end',[child,copy]);},
   });
   const result=await local.run(metadataBundle,prepared.bundle,q,{sourceHead:prepared.binding.sourceHead,identity:carrierIdentity,receipt:planReceipt});fresh();return stopped?unknown:result;
  }catch{return unknown;}finally{owned?.fill(0);}
 }});
}
