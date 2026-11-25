import {spawn} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {Writable} from 'node:stream';
import {createHash} from 'node:crypto';
import {openSync,writeSync,fsyncSync,closeSync,fstatSync,lstatSync,realpathSync} from 'node:fs';
import {win32} from 'node:path';
import {performance} from 'node:perf_hooks';
import {types} from 'node:util';
import {canonicalJson,parseWireJson} from '../contracts/canonical.ts';
import {createSubnetObservationLocalHost,prepareSubnetObservationLocal} from './qa-ix01-subnet-observation-local-host.ts';
import type {SubnetCollectionClock} from './qa-ix01-subnet-observation-supervisor.ts';
import {current0076NegativeLinuxFdProofCollectionContract,current0076NegativeLinuxFdProofLauncherContract} from './qa-ix01-0076-negative-linux-fd-proof-launcher.ts';
import {parse0076NegativeLinuxFdProofProtectedEvidence,type NegativeLinuxFdProofProtectedEvidence} from './qa-ix01-0076-negative-linux-fd-proof-issuer.ts';

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

const benignPurpose='IX01_0076_BENIGN_FD_PROOF_WINDOWS_SEND' as const,benignLedgerRoot=String.raw`D:\Project\Anvil\.av3-data`;
const benignSshPrefix=Object.freeze(['-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ClearAllForwardings=yes',
 '-o','UpdateHostKeys=no','-o','AddKeysToAgent=no','-o','VerifyHostKeyDNS=no','-o','ForwardAgent=no','-o','ForwardX11=no','-o','ForwardX11Trusted=no','-o','Tunnel=no',
 '-o','ProxyCommand=none','-o','ProxyJump=none','-o','PermitLocalCommand=no','-o','LocalCommand=none','-o','ControlMaster=no','-o','ControlPath=none','-o','ControlPersist=no','-o','RequestTTY=no','-o','RemoteCommand=none',
 '-o','ConnectionAttempts=1','-o','ConnectTimeout=8','-o','ServerAliveInterval=3','-o','ServerAliveCountMax=2','-o','LogLevel=ERROR','WSL-server']);
const benignUnknown=Object.freeze({status:'UNKNOWN',code:'WINDOWS_BENIGN_FD_PROOF_UNCONFIRMED'} as const),hex64=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
type BenignCandidate=Readonly<{status:'IX01_0076_BENIGN_SAME_FD_OBSERVATION_CANDIDATE_NOT_RUNTIME_PASS';attemptId:string;approvalRef:Readonly<{id:string;version:number;contentHash:string}>;intentDigest:string;observation:Readonly<{path:'/usr/bin/sleep';dev:number;ino:number;sha256:string}>;runtimeVerified:false;executionAuthorized:false;pgAuthorized:false}>;
type BenignCollection=Readonly<{schemaVersion:1;purpose:typeof current0076NegativeLinuxFdProofCollectionContract.purpose;evidence:'SOURCE_COLLECTION_CANDIDATE_ONLY';status:'IX01_0076_BENIGN_SAME_FD_COLLECTION_CANDIDATE_NOT_RUNTIME_PASS';path:string;attemptId:string;
 approvalRef:Readonly<{id:string;version:number;contentHash:string}>;sourceHead:string;approvalHash:string;planHash:string;sourceHash:string;graphHash:string;issuedAt:number;expiresAt:number;intent:Readonly<{path:string;raw:string;sha256:string}>;
 observation:Readonly<{path:'/usr/bin/sleep';dev:number;ino:number;sha256:string}>;terminal:Readonly<{schemaVersion:1;purpose:'IX01_0076_NEGATIVE_LINUX_SAME_FD_TERMINAL_V1';attemptId:string;issuedAt:number;expiresAt:number;child:Readonly<{exitCode:null;signal:'SIGTERM';closeConfirmed:true}>;sourceFd:Readonly<{closeConfirmed:true}>}>;
 collectionSource:'PRIVATE_LAUNCH_CLOSURE';comparisonOnly:true;nativeEnableEligible:false;durableStored:false;runtimeVerified:false;executionAuthorized:false;pgAuthorized:false}>;
type BenignCarrier<T>=Readonly<{run(rawStdin:unknown):Promise<T|typeof benignUnknown>}>;

function benignInput(raw:unknown){
 const bytes=ownBytes(raw,16384);if(!bytes.byteLength)return fail();let text:string,value:unknown;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);value=parseWireJson(text);}catch{return fail();}
 const evidence=parse0076NegativeLinuxFdProofProtectedEvidence(value);if(!evidence||canonicalJson(evidence)!==text)return fail();return{bytes,evidence};
}
function benignIntentDigest(evidence:Readonly<NegativeLinuxFdProofProtectedEvidence>,stdinSha256:string){return hash({schemaVersion:1,purpose:current0076NegativeLinuxFdProofLauncherContract.launcherPurpose,attemptId:evidence.attemptId,
 approvalRef:evidence.approvalRef,approvalHash:evidence.approvalHash,planHash:evidence.planHash,graphHash:evidence.graphHash,stdinHash:stdinSha256,issuedAt:evidence.issuedAt,expiresAt:evidence.expiresAt});}
function benignIntentRaw(evidence:Readonly<NegativeLinuxFdProofProtectedEvidence>,stdinSha256:string){return canonicalJson({schemaVersion:1,purpose:current0076NegativeLinuxFdProofLauncherContract.launcherPurpose,attemptId:evidence.attemptId,
 approvalRef:evidence.approvalRef,approvalHash:evidence.approvalHash,planHash:evidence.planHash,graphHash:evidence.graphHash,stdinHash:stdinSha256,issuedAt:evidence.issuedAt,expiresAt:evidence.expiresAt});}
function benignCandidate(raw:unknown,evidence:Readonly<NegativeLinuxFdProofProtectedEvidence>,stdinSha256:string):BenignCandidate{
 const value=fields(raw,['status','attemptId','approvalRef','intentDigest','observation','runtimeVerified','executionAuthorized','pgAuthorized']),ref=fields(value.approvalRef,['id','version','contentHash']),observation=fields(value.observation,['path','dev','ino','sha256']);
 if(value.status!=='IX01_0076_BENIGN_SAME_FD_OBSERVATION_CANDIDATE_NOT_RUNTIME_PASS'||value.attemptId!==evidence.attemptId||ref.id!==evidence.approvalRef.id||ref.version!==evidence.approvalRef.version||ref.contentHash!==evidence.approvalRef.contentHash
  ||value.intentDigest!==benignIntentDigest(evidence,stdinSha256)||value.runtimeVerified!==false||value.executionAuthorized!==false||value.pgAuthorized!==false||observation.path!=='/usr/bin/sleep'
  ||typeof observation.dev!=='number'||!Number.isSafeInteger(observation.dev)||observation.dev<0||typeof observation.ino!=='number'||!Number.isSafeInteger(observation.ino)||observation.ino<0||!hex64(observation.sha256))return fail();
 return Object.freeze({status:value.status,attemptId:value.attemptId as string,approvalRef:Object.freeze({id:ref.id as string,version:ref.version as number,contentHash:ref.contentHash as string}),intentDigest:value.intentDigest as string,
  observation:Object.freeze({path:'/usr/bin/sleep',dev:observation.dev,ino:observation.ino,sha256:observation.sha256}),runtimeVerified:false,executionAuthorized:false,pgAuthorized:false});
}
function benignCollection(raw:unknown,evidence:Readonly<NegativeLinuxFdProofProtectedEvidence>,stdinSha256:string):BenignCollection{
 const value=fields(raw,['schemaVersion','purpose','evidence','status','path','attemptId','approvalRef','sourceHead','approvalHash','planHash','sourceHash','graphHash','issuedAt','expiresAt','intent','observation','terminal','collectionSource','comparisonOnly','nativeEnableEligible','durableStored','runtimeVerified','executionAuthorized','pgAuthorized']);
 const ref=fields(value.approvalRef,['id','version','contentHash']),intent=fields(value.intent,['path','raw','sha256']),observation=fields(value.observation,['path','dev','ino','sha256']),terminal=fields(value.terminal,['schemaVersion','purpose','attemptId','issuedAt','expiresAt','child','sourceFd']),child=fields(terminal.child,['exitCode','signal','closeConfirmed']),sourceFd=fields(terminal.sourceFd,['closeConfirmed']);
 const intentRaw=benignIntentRaw(evidence,stdinSha256),prefix='/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-fd-proof-'+evidence.attemptId;
 if(value.schemaVersion!==1||value.purpose!==current0076NegativeLinuxFdProofCollectionContract.purpose||value.evidence!=='SOURCE_COLLECTION_CANDIDATE_ONLY'||value.status!=='IX01_0076_BENIGN_SAME_FD_COLLECTION_CANDIDATE_NOT_RUNTIME_PASS'||value.path!==prefix+'-collection-v1.json'||value.attemptId!==evidence.attemptId
  ||ref.id!==evidence.approvalRef.id||ref.version!==evidence.approvalRef.version||ref.contentHash!==evidence.approvalRef.contentHash||value.sourceHead!==evidence.sourceHead||value.approvalHash!==evidence.approvalHash||value.planHash!==evidence.planHash||value.sourceHash!==evidence.sourceHash||value.graphHash!==evidence.graphHash||value.issuedAt!==evidence.issuedAt||value.expiresAt!==evidence.expiresAt
  ||intent.path!==prefix+'-intent-v1.json'||intent.raw!==intentRaw||intent.sha256!==createHash('sha256').update(intentRaw).digest('hex')||observation.path!=='/usr/bin/sleep'||typeof observation.dev!=='number'||!Number.isSafeInteger(observation.dev)||observation.dev<0||typeof observation.ino!=='number'||!Number.isSafeInteger(observation.ino)||observation.ino<1||!hex64(observation.sha256)
  ||terminal.schemaVersion!==1||terminal.purpose!=='IX01_0076_NEGATIVE_LINUX_SAME_FD_TERMINAL_V1'||terminal.attemptId!==evidence.attemptId||terminal.issuedAt!==evidence.issuedAt||terminal.expiresAt!==evidence.expiresAt||child.exitCode!==null||child.signal!=='SIGTERM'||child.closeConfirmed!==true||sourceFd.closeConfirmed!==true
  ||value.collectionSource!=='PRIVATE_LAUNCH_CLOSURE'||value.comparisonOnly!==true||value.nativeEnableEligible!==false||value.durableStored!==false||value.runtimeVerified!==false||value.executionAuthorized!==false||value.pgAuthorized!==false)return fail();
 return Object.freeze({schemaVersion:1,purpose:current0076NegativeLinuxFdProofCollectionContract.purpose,evidence:'SOURCE_COLLECTION_CANDIDATE_ONLY',status:'IX01_0076_BENIGN_SAME_FD_COLLECTION_CANDIDATE_NOT_RUNTIME_PASS',path:value.path as string,attemptId:evidence.attemptId,
  approvalRef:Object.freeze({...evidence.approvalRef}),sourceHead:evidence.sourceHead,approvalHash:evidence.approvalHash,planHash:evidence.planHash,sourceHash:evidence.sourceHash,graphHash:evidence.graphHash,issuedAt:evidence.issuedAt,expiresAt:evidence.expiresAt,
  intent:Object.freeze({path:intent.path as string,raw:intentRaw,sha256:intent.sha256 as string}),observation:Object.freeze({path:'/usr/bin/sleep',dev:observation.dev,ino:observation.ino,sha256:observation.sha256}),
  terminal:Object.freeze({schemaVersion:1,purpose:'IX01_0076_NEGATIVE_LINUX_SAME_FD_TERMINAL_V1',attemptId:evidence.attemptId,issuedAt:evidence.issuedAt,expiresAt:evidence.expiresAt,child:Object.freeze({exitCode:null,signal:'SIGTERM',closeConfirmed:true}),sourceFd:Object.freeze({closeConfirmed:true})}),
  collectionSource:'PRIVATE_LAUNCH_CLOSURE',comparisonOnly:true,nativeEnableEligible:false,durableStored:false,runtimeVerified:false,executionAuthorized:false,pgAuthorized:false});
}

/** 기존 IX01 actual Windows transport의 private native port만 재사용하는 benign 전용 단회 carrier다.
 * 승인·stored stdin·배치 검산은 외부 review 소유이며 이 factory는 승인이나 generic command capability를 발급하지 않는다. */
function create0076BenignFdProofWindowsCarrierMode(review:SubnetWindowsReview,ports:SubnetWindowsPorts|undefined,mode:'--run'):BenignCarrier<BenignCandidate>;
function create0076BenignFdProofWindowsCarrierMode(review:SubnetWindowsReview,ports:SubnetWindowsPorts|undefined,mode:'--collect'):BenignCarrier<BenignCollection>;
function create0076BenignFdProofWindowsCarrierMode(review:SubnetWindowsReview,ports:SubnetWindowsPorts|undefined,mode:'--run'|'--collect'):BenignCarrier<BenignCandidate|BenignCollection>{
 const supplied=ports??nativePorts(review);let spent=false;
 return Object.freeze({async run(rawStdin:unknown):Promise<BenignCandidate|BenignCollection|typeof benignUnknown>{
  if(spent)return benignUnknown;spent=true;let owned:Uint8Array|undefined,recordBytes:Uint8Array|undefined;
  try{
   if(typeof review!=='function'||types.isProxy(review))return benignUnknown;const p=fields(supplied,['clock','platform','review','openExclusive','write','flush','close','confirmClosed','spawn','end']),clock=fields(p.clock,['now','monotonic','setTimeout','clearTimeout']);
   if(p.review!==review||[...Object.values(clock),...Object.entries(p).filter(([key])=>key!=='clock').map(([,value])=>value)].some(value=>typeof value!=='function'||types.isProxy(value)))return benignUnknown;
   const invoke=(key:string,args:unknown[])=>Reflect.apply(p[key] as Function,supplied,args),time=(key:string,args:unknown[]=[])=>Reflect.apply(clock[key] as Function,p.clock,args);
   if(invoke('platform',[])!=='win32')return benignUnknown;const parsed=benignInput(rawStdin);owned=parsed.bytes;const evidence=parsed.evidence,stdinSha256=createHash('sha256').update(owned).digest('hex'),compact=evidence.attemptId.replaceAll('-','');
   const sourceRoot='/home/daon/anvil-ix01-0076-negative-'+compact+'-qa',launcher=sourceRoot+'/scripts/qa-ix01-0076-negative-linux-fd-proof-launcher.ts';
   const remote="cd '"+sourceRoot+"' && exec /usr/bin/env -i "+current0076NegativeLinuxFdProofLauncherContract.nodePath+" '"+launcher+"' "+mode+' '+evidence.attemptId+' '+evidence.planHash+' '+evidence.approvalHash+' '+stdinSha256;
   const args=Object.freeze([...benignSshPrefix,remote]),binding=Object.freeze({schemaVersion:1,purpose:benignPurpose,attemptId:evidence.attemptId,approvalRef:Object.freeze({...evidence.approvalRef}),sourceHead:evidence.sourceHead,planHash:evidence.planHash,approvalHash:evidence.approvalHash,
    sourceHash:evidence.sourceHash,graphHash:evidence.graphHash,issuedAt:evidence.issuedAt,expiresAt:evidence.expiresAt,stdinSha256,sourceRoot,launcher,command:Object.freeze({file,args,options:nativeOptions})});
   const bindingHash=hash(binding),startedWall=time('now'),startedMono=time('monotonic'),endWall=Math.min(evidence.expiresAt,startedWall+current0076NegativeLinuxFdProofLauncherContract.maxDurationMs),endMono=startedMono+endWall-startedWall;
   if(!Number.isSafeInteger(startedWall)||startedWall<evidence.issuedAt||startedWall>=endWall||typeof startedMono!=='number'||!Number.isFinite(startedMono)||startedMono<0)return benignUnknown;
   let lastWall=startedWall,lastMono=startedMono,stopped=false;const current=()=>{const next=fields(supplied,['clock','platform','review','openExclusive','write','flush','close','confirmClosed','spawn','end']),nextClock=fields(next.clock,['now','monotonic','setTimeout','clearTimeout']);
    if(Object.keys(p).some(key=>next[key]!==p[key])||Object.keys(clock).some(key=>nextClock[key]!==clock[key])||invoke('platform',[])!=='win32')return fail();const wall=time('now'),mono=time('monotonic');
    if(!Number.isSafeInteger(wall)||wall<lastWall||wall>=endWall||typeof mono!=='number'||!Number.isFinite(mono)||mono<lastMono||mono>=endMono)return fail();lastWall=wall;lastMono=mono;
    const reviewed=fields(invoke('review',[binding]),['status','reviewHash']);if(reviewed.status!=='CURRENT'||reviewed.reviewHash!==bindingHash)return fail();};
   current();recordBytes=new TextEncoder().encode(canonicalJson({schemaVersion:1,purpose:'IX01_0076_BENIGN_FD_PROOF_WINDOWS_TRANSPORT',attemptId:evidence.attemptId,approvalRef:evidence.approvalRef,bindingHash,stdinSha256,issuedAt:evidence.issuedAt,expiresAt:evidence.expiresAt})+'\n');if(recordBytes.byteLength>4096)return benignUnknown;
   const recordPath=benignLedgerRoot+'\\ix01-0076-fd-proof-'+evidence.attemptId+'-transport.json';let token:object|undefined,closeAttempted=false;
   try{current();const opened=invoke('openExclusive',[recordPath]);if(!opened||typeof opened!=='object'||types.isProxy(opened))return benignUnknown;token=opened as object;current();let offset=0;
    for(let calls=0;offset<recordBytes.byteLength&&calls<4096;calls++){current();const count=invoke('write',[token,recordBytes,offset]);if(typeof count!=='number'||!Number.isSafeInteger(count)||count<=0||count>recordBytes.byteLength-offset)return benignUnknown;offset+=count;current();}
    if(offset!==recordBytes.byteLength||invoke('flush',[token])!==true)return benignUnknown;current();closeAttempted=true;if(invoke('close',[token])!==true)return benignUnknown;current();if(invoke('confirmClosed',[token,recordBytes.byteLength])!==true)return benignUnknown;current();
   }finally{if(token&&!closeAttempted){closeAttempted=true;try{invoke('close',[token]);}catch{stopped=true;}}recordBytes.fill(0);}
   if(stopped)return benignUnknown;current();
   return await new Promise<BenignCandidate|BenignCollection|typeof benignUnknown>(resolve=>{let settled=false,ready=false,setup=true,fired=false,inputFinished=false,outputEnded=false,exited=false,closed=false,exitCode:unknown,exitSignal:unknown,closeCode:unknown,closeSignal:unknown,total=0,child:EventEmitter|undefined,stdin:EventEmitter|undefined,stdout:EventEmitter|undefined;const chunks:Buffer[]=[],listeners:[EventEmitter,string,(...args:any[])=>void][]=[];let timer:unknown;
    const clearTimer=()=>{if(timer!==undefined){try{Reflect.apply(clock.clearTimeout as Function,p.clock,[timer]);}catch{}timer=undefined;}};
    const detachAll=()=>{clearTimer();for(const [target,event,fn]of listeners)target.removeListener(event,fn);};
    const retainUntilClose=()=>{clearTimer();for(const [target,event,fn]of listeners)if(event!=='error'&&!(child&&target===child&&event==='close'))target.removeListener(event,fn);};
    const finish=(value:BenignCandidate|BenignCollection|typeof benignUnknown)=>{if(settled)return;settled=true;if(value===benignUnknown&&child&&!closed)retainUntilClose();else detachAll();for(const chunk of chunks)chunk.fill(0);resolve(value);};
    const parse=()=>{if(settled||setup||!ready||!inputFinished||!outputEnded||!exited||!closed)return;if(exitCode!==0||exitSignal!==null||closeCode!==0||closeSignal!==null)return finish(benignUnknown);
     try{current();const bytes=Buffer.concat(chunks,total),text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);bytes.fill(0);if(!text.endsWith('\n')||text.indexOf('\n')!==text.length-1)return finish(benignUnknown);const body=text.slice(0,-1),raw=parseWireJson(body);if(mode==='--collect'&&canonicalJson(raw)!==body)return finish(benignUnknown);const candidate=mode==='--collect'?benignCollection(raw,evidence,stdinSha256):benignCandidate(raw,evidence,stdinSha256);current();finish(candidate);}catch{finish(benignUnknown);}};
    const error=()=>finish(benignUnknown),inputFinish=()=>{if(inputFinished)return finish(benignUnknown);inputFinished=true;parse();},data=(value:unknown)=>{try{if(outputEnded||types.isProxy(value)||!types.isUint8Array(value))return finish(benignUnknown);const copy=Buffer.from(value as Uint8Array);if(total+copy.byteLength>16384){copy.fill(0);return finish(benignUnknown);}chunks.push(copy);total+=copy.byteLength;}catch{finish(benignUnknown);}},outputEnd=()=>{if(outputEnded)return finish(benignUnknown);outputEnded=true;parse();},exit=(code:unknown,signal:unknown)=>{if(exited)return finish(benignUnknown);exited=true;exitCode=code;exitSignal=signal;parse();},close=(code:unknown,signal:unknown)=>{if(closed)return finish(benignUnknown);closed=true;closeCode=code;closeSignal=signal;if(settled)return detachAll();parse();};
    try{
     current();const remaining=Math.floor(Math.min(endWall-lastWall,endMono-lastMono));if(remaining<=0)return finish(benignUnknown);timer=Reflect.apply(clock.setTimeout as Function,p.clock,[()=>{fired=true;finish(benignUnknown);},remaining]);if(timer===undefined||timer===null||fired||settled){clearTimer();return finish(benignUnknown);}current();
     const rawChild=invoke('spawn',[file,args,nativeOptions]);if(!emitter(rawChild))return finish(benignUnknown);child=rawChild;const rawStdin=Object.getOwnPropertyDescriptor(child,'stdin')?.value,rawStdout=Object.getOwnPropertyDescriptor(child,'stdout')?.value;
     listeners.push([child,'error',error],[child,'close',close]);if(emitter(rawStdin))listeners.push([rawStdin,'error',error]);if(emitter(rawStdout))listeners.push([rawStdout,'error',error]);
     for(const [target,event,fn]of listeners)target.on(event,fn);
     if(!emitter(rawStdin)||!emitter(rawStdout)||rawStdin===rawStdout||rawStdin===child||rawStdout===child)return finish(benignUnknown);stdin=rawStdin;stdout=rawStdout;
     listeners.push([stdin,'finish',inputFinish],[stdout,'data',data],[stdout,'end',outputEnd],[child,'exit',exit]);for(const [target,event,fn]of listeners.slice(4))target.on(event,fn);
     current();ready=true;invoke('end',[child,owned!]);current();
    }catch{finish(benignUnknown);}finally{setup=false;parse();}
   });
  }catch{return benignUnknown;}finally{owned?.fill(0);recordBytes?.fill(0);}
 }});
}
/** 기존 8필드 관측 stdout을 유지하는 기본 benign transport다. */
export function create0076BenignFdProofWindowsCarrier(review:SubnetWindowsReview,ports?:SubnetWindowsPorts){return create0076BenignFdProofWindowsCarrierMode(review,ports,'--run');}
/** 외부 실행담당자가 명시 선택할 때만 collection v1 stdout을 검산하는 닫힌 transport다. */
export function create0076BenignFdProofCollectionWindowsCarrier(review:SubnetWindowsReview,ports?:SubnetWindowsPorts){return create0076BenignFdProofWindowsCarrierMode(review,ports,'--collect');}
