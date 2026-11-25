import {spawn,type ChildProcess} from 'node:child_process';
import {closeSync,constants,fstatSync,lstatSync,openSync,readlinkSync,readSync,statSync,type Stats} from 'node:fs';
import {types} from 'node:util';
import {hashV1,recordV1,uuidV1} from '../contracts/runtime/validation-v1.ts';
import {
 bind0076NegativeLinuxFdProofSystemSupplier,
 create0076NegativeLinuxFdProofSystem,
 current0076NegativeLinuxFdProofSystemContract,
 type NegativeLinuxFdProofNodePorts,
 type NegativeLinuxFdProofNodeStat,
} from './qa-ix01-0076-negative-linux-fd-proof-system.ts';
import {
 current0076NegativeLinuxFdProofContract,
 run0076NegativeLinuxFdProof,
 type NegativeLinuxFdProofAuthorityPorts,
 type NegativeLinuxFdProofPlan,
 type NegativeLinuxFdProofResult,
} from './qa-ix01-0076-negative-linux-fd-proof.ts';
import {consume0076NegativeLinuxFdProofExecutionEvidence} from './qa-ix01-0076-negative-linux-fd-proof-launcher.ts';

const candidatePurpose='IX01_0076_NEGATIVE_LINUX_FD_PROOF_SOURCE_CANDIDATE' as const;
export const current0076NegativeLinuxFdProofEntryContract=Object.freeze({candidatePurpose,executable:'/usr/bin/sleep' as const,maxDurationMs:10000,
 protectedEvidenceValidatorConnected:true as const,validatedExecutionLauncherConnected:true as const,protectedEvidenceConnected:true as const,nativeProviderDefault:false as const,
 fixedSourceBytesVerifiedByExternalExecutor:true as const,loadedModuleBytesReverifiedInsideNode:false as const,runtimeVerified:false as const,executionAuthorized:false as const});

export interface NegativeLinuxFdProofEntryCandidate{readonly schemaVersion:1;readonly purpose:typeof candidatePurpose;readonly attemptId:string;readonly sourceHead:string;readonly planHash:string;readonly sourceHash:string;readonly graphHash:string;readonly issuedAt:number;readonly expiresAt:number}
export interface NegativeLinuxFdProofEntryAuthority{readonly recipient:object;readonly candidate:Readonly<NegativeLinuxFdProofEntryCandidate>;now():number;monotonic():number;assertCurrent(this:object,candidate:Readonly<NegativeLinuxFdProofEntryCandidate>):void}
export interface NegativeLinuxFdProofEntryUnavailable{readonly status:'PROTECTED_START_EVIDENCE_UNAVAILABLE'|'UNKNOWN';readonly nativeProviderSelected:false;readonly effectsStarted:false;readonly runtimeVerified:false;readonly executionAuthorized:false}

interface AuthorityBinding{readonly raw:NegativeLinuxFdProofEntryAuthority;readonly recipient:object;readonly candidate:Readonly<NegativeLinuxFdProofEntryCandidate>;readonly descriptors:ReturnType<typeof Object.getOwnPropertyDescriptors>;lastWall:number;lastMono:number;wallEnd:number;monoEnd:number}
const invalid=():never=>{throw Error('IX01_0076_NEGATIVE_LINUX_FD_PROOF_ENTRY_INVALID');};
function defined<T>(value:T|undefined):T{if(value===undefined)return invalid();return value;}
function exact(raw:unknown,keys:readonly string[]){if(!raw||typeof raw!=='object'||types.isProxy(raw)||![Object.prototype,null].includes(Object.getPrototypeOf(raw)))return false;const descriptors=Object.getOwnPropertyDescriptors(raw);return Reflect.ownKeys(descriptors).length===keys.length&&keys.every(key=>!!descriptors[key]?.enumerable&&Object.hasOwn(descriptors[key]!,'value'));}
function candidateShape(raw:unknown):raw is Readonly<NegativeLinuxFdProofEntryCandidate>{return exact(raw,['schemaVersion','purpose','attemptId','sourceHead','planHash','sourceHash','graphHash','issuedAt','expiresAt'])&&Object.isFrozen(raw)
 &&recordV1(raw,['schemaVersion','purpose','attemptId','sourceHead','planHash','sourceHash','graphHash','issuedAt','expiresAt'])&&raw.schemaVersion===1&&raw.purpose===candidatePurpose&&uuidV1(raw.attemptId)
 &&/^[a-f0-9]{40}$/.test(raw.sourceHead)&&[raw.planHash,raw.sourceHash,raw.graphHash].every(hashV1)&&Number.isSafeInteger(raw.issuedAt)&&Number.isSafeInteger(raw.expiresAt)
 &&raw.issuedAt<raw.expiresAt&&raw.expiresAt-raw.issuedAt<=10000;}
function authorityShape(raw:NegativeLinuxFdProofEntryAuthority):AuthorityBinding{const keys=['recipient','candidate','now','monotonic','assertCurrent'] as const;if(!exact(raw,keys)||!Object.isFrozen(raw))invalid();const descriptors=Object.getOwnPropertyDescriptors(raw),recipient=descriptors.recipient?.value,candidate=descriptors.candidate?.value;
 if(!recipient||typeof recipient!=='object'||types.isProxy(recipient)||!Object.isFrozen(recipient)||!candidateShape(candidate)||typeof descriptors.now?.value!=='function'||typeof descriptors.monotonic?.value!=='function'||typeof descriptors.assertCurrent?.value!=='function')invalid();
 return {raw,recipient:defined(recipient),candidate:defined(candidate),descriptors,lastWall:-1,lastMono:-1,wallEnd:-1,monoEnd:-1};}
function current(binding:AuthorityBinding){const keys=['recipient','candidate','now','monotonic','assertCurrent'] as const;if(keys.some(key=>binding.raw[key]!==binding.descriptors[key]!.value))invalid();const wall=(binding.descriptors.now!.value as NegativeLinuxFdProofEntryAuthority['now']).call(binding.raw),mono=(binding.descriptors.monotonic!.value as NegativeLinuxFdProofEntryAuthority['monotonic']).call(binding.raw);
 if(!Number.isSafeInteger(wall)||!Number.isFinite(mono)||mono<0||wall<binding.candidate.issuedAt||wall<binding.lastWall||mono<binding.lastMono)invalid();if(binding.lastWall<0){binding.wallEnd=Math.min(binding.candidate.expiresAt,wall+10000);binding.monoEnd=mono+(binding.wallEnd-wall);}
 if(wall>=binding.wallEnd||mono>=binding.monoEnd)invalid();binding.lastWall=wall;binding.lastMono=mono;if((binding.descriptors.assertCurrent!.value as NegativeLinuxFdProofEntryAuthority['assertCurrent']).call(binding.recipient,binding.candidate)!==undefined)invalid();}
function unavailable(status:NegativeLinuxFdProofEntryUnavailable['status']):Readonly<NegativeLinuxFdProofEntryUnavailable>{return Object.freeze({status,nativeProviderSelected:false,effectsStarted:false,runtimeVerified:false,executionAuthorized:false});}
function normalized(value:Stats):Readonly<NegativeLinuxFdProofNodeStat>{return Object.freeze({kind:value.isFile()?'FILE' as const:'OTHER' as const,dev:value.dev,ino:value.ino,uid:value.uid,gid:value.gid,mode:value.mode,nlink:value.nlink,size:value.size,mtimeMs:value.mtimeMs,ctimeMs:value.ctimeMs});}

const nativeRecipient=Object.freeze({});
const nativePorts=Object.freeze<NegativeLinuxFdProofNodePorts>({
 recipient:nativeRecipient,
 lstat(this:object,path:string){if(this!==nativeRecipient||path!=='/usr/bin/sleep')invalid();return normalized(lstatSync(path));},
 open(this:object,path:string,flags:number){if(this!==nativeRecipient||path!=='/usr/bin/sleep'||flags!==(constants.O_RDONLY|constants.O_NONBLOCK|constants.O_NOFOLLOW))invalid();return openSync(path,flags);},
 fstat(this:object,fd:number){if(this!==nativeRecipient||!Number.isSafeInteger(fd)||fd<0)invalid();return normalized(fstatSync(fd));},
 readlink(this:object,path:string){if(this!==nativeRecipient||!/^\/proc\/self\/fd\/[0-9]+$/.test(path))invalid();return readlinkSync(path,'utf8');},
 read(this:object,fd:number,offset:number,length:number){if(this!==nativeRecipient||![fd,offset,length].every(Number.isSafeInteger)||fd<0||offset<0||length<1||length>1048576)invalid();const buffer=Buffer.allocUnsafe(length),found=readSync(fd,buffer,0,length,offset);return Uint8Array.from(buffer.subarray(0,found));},
 spawn(this:object,file:string,args:readonly string[],options:Readonly<Record<string,unknown>>){if(this!==nativeRecipient||file!=='/proc/self/fd/3'||args.length!==1||args[0]!=='10'||options.argv0!=='anvil-ix01-0076-fd-proof'||options.shell!==false||options.detached!==false)invalid();
  const stdioRaw=options.stdio,env=options.env;if(!Array.isArray(stdioRaw))invalid();const stdio=stdioRaw as unknown[];if(stdio.length!==4||stdio[0]!=='ignore'||stdio[1]!=='ignore'||stdio[2]!=='ignore'||!Number.isSafeInteger(stdio[3])||!exact(env,['LANG','LC_ALL','PATH'])||(env as Record<string,string>).LANG!=='C'||(env as Record<string,string>).LC_ALL!=='C'||(env as Record<string,string>).PATH!=='/usr/bin:/bin')invalid();
  return spawn(file,['10'],{argv0:'anvil-ix01-0076-fd-proof',stdio:['ignore','ignore','ignore',stdio[3] as number],env:{LANG:'C',LC_ALL:'C',PATH:'/usr/bin:/bin'},shell:false,detached:false,windowsHide:true});},
 childPid(this:object,child:object){if(this!==nativeRecipient)invalid();return (child as ChildProcess).pid??-1;},
 statPath(this:object,path:string){if(this!==nativeRecipient||!/^\/proc\/[1-9][0-9]*\/exe$/.test(path))invalid();return normalized(statSync(path));},
 on(this:object,child:object,event:'error'|'exit'|'close',listener:(...values:unknown[])=>void){if(this!==nativeRecipient)(invalid());(child as ChildProcess).on(event,listener as never);},
 off(this:object,child:object,event:'error'|'exit'|'close',listener:(...values:unknown[])=>void){if(this!==nativeRecipient)(invalid());(child as ChildProcess).off(event,listener as never);},
 kill(this:object,child:object,signal:'SIGTERM'){if(this!==nativeRecipient||signal!=='SIGTERM')invalid();return (child as ChildProcess).kill(signal);},
 setTimer(this:object,callback:()=>void,ms:number){if(this!==nativeRecipient||!Number.isSafeInteger(ms)||ms<1)invalid();return setTimeout(callback,ms);},
 clearTimer(this:object,timer:object){if(this!==nativeRecipient)invalid();clearTimeout(timer as ReturnType<typeof setTimeout>);},
 close(this:object,fd:number){if(this!==nativeRecipient||!Number.isSafeInteger(fd)||fd<0)invalid();closeSync(fd);},
});

async function assemble(binding:AuthorityBinding,ports:NegativeLinuxFdProofNodePorts):Promise<Readonly<NegativeLinuxFdProofResult>>{current(binding);const plan=Object.freeze<NegativeLinuxFdProofPlan>({schemaVersion:1,purpose:current0076NegativeLinuxFdProofContract.purpose,attemptId:binding.candidate.attemptId,issuedAt:binding.candidate.issuedAt,expiresAt:binding.candidate.expiresAt});
 const authorityRecipient=Object.freeze({}),supplierRecipient=Object.freeze({});
 const authority=Object.freeze<NegativeLinuxFdProofAuthorityPorts>({recipient:authorityRecipient,now:()=>{current(binding);return binding.lastWall;},monotonic:()=>{current(binding);return binding.lastMono;},assertCurrent(this:object,found){if(this!==authorityRecipient||found!==plan)invalid();current(binding);}});
 const supplier=Object.freeze({recipient:supplierRecipient,attemptId:binding.candidate.attemptId,assertCurrent(this:object,contract:typeof current0076NegativeLinuxFdProofSystemContract){if(this!==supplierRecipient||contract.attemptId!==binding.candidate.attemptId||contract.executable!=='/usr/bin/sleep')invalid();current(binding);}});
 const system=create0076NegativeLinuxFdProofSystem(bind0076NegativeLinuxFdProofSystemSupplier(supplier),ports);return run0076NegativeLinuxFdProof(plan,authority,system);}

/** purpose 전용 protected issuer의 native token만 private provider를 선택한다. token 부재·RAM token·중복은 효과 전에 닫힌다. */
export async function run0076NegativeLinuxFdProofEntry(rawAuthority:NegativeLinuxFdProofEntryAuthority,rawEvidence?:unknown):Promise<Readonly<NegativeLinuxFdProofEntryUnavailable|NegativeLinuxFdProofResult>>{let binding:AuthorityBinding;try{binding=authorityShape(rawAuthority);current(binding);}catch{return unavailable('UNKNOWN');}
 if(!consume0076NegativeLinuxFdProofExecutionEvidence(rawEvidence,rawAuthority))return unavailable('PROTECTED_START_EVIDENCE_UNAVAILABLE');try{current(binding);return await assemble(binding,nativePorts);}catch{return Object.freeze({status:'UNKNOWN',evidence:'SOURCE_CANDIDATE_ONLY',runtimeVerified:false,executionAuthorized:false});}}

/** RAM 조립 검증 전용이다. 주입 포트를 실제 Linux 권위나 보호 evidence로 승격하지 않는다. */
export async function assemble0076NegativeLinuxFdProofEntryForRam(rawAuthority:NegativeLinuxFdProofEntryAuthority,ports:NegativeLinuxFdProofNodePorts):Promise<Readonly<NegativeLinuxFdProofResult>>{try{return await assemble(authorityShape(rawAuthority),ports);}catch{return Object.freeze({status:'UNKNOWN',evidence:'SOURCE_CANDIDATE_ONLY',runtimeVerified:false,executionAuthorized:false});}}
