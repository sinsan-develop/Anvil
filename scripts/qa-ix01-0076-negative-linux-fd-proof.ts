import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {recordV1,uuidV1} from '../contracts/runtime/validation-v1.ts';

const purpose='IX01_0076_NEGATIVE_LINUX_SAME_FD_PROOF' as const;
const executable='/usr/bin/sleep';
const invocation=Object.freeze({file:'/proc/self/fd/3',argv0:'anvil-ix01-0076-fd-proof',argv:Object.freeze(['10']),inheritedFd:3 as const,shell:false as const,
 env:Object.freeze({LANG:'C',LC_ALL:'C',PATH:'/usr/bin:/bin'})});
export const current0076NegativeLinuxFdProofContract=Object.freeze({purpose,executable,invocation,maxBytes:67108864,maxDurationMs:10000,
 evidence:'SOURCE_CANDIDATE_ONLY' as const,runtimeVerified:false as const,executionAuthorized:false as const});

export interface NegativeLinuxFdProofPlan{readonly schemaVersion:1;readonly purpose:typeof purpose;readonly attemptId:string;readonly issuedAt:number;readonly expiresAt:number}
export interface NegativeLinuxFdProofAuthorityPorts{readonly recipient:object;now():number;monotonic():number;assertCurrent(this:object,plan:Readonly<NegativeLinuxFdProofPlan>):void}
export interface NegativeLinuxFdProofStat{readonly path:string;readonly realpath:string;readonly kind:'FILE';readonly dev:number;readonly ino:number;readonly uid:number;readonly gid:number;readonly mode:number;readonly nlink:number;readonly size:number;readonly mtimeMs:number;readonly ctimeMs:number}
export interface NegativeLinuxFdProofInvocation{readonly file:'/proc/self/fd/3';readonly argv0:'anvil-ix01-0076-fd-proof';readonly argv:readonly ['10'];readonly inheritedFd:3;readonly shell:false;readonly env:Readonly<{LANG:'C';LC_ALL:'C';PATH:'/usr/bin:/bin'}>}
export interface NegativeLinuxFdProofSystem{
 readonly recipient:object;openReadOnly(this:object,path:string):object;stat(this:object,handle:object):Readonly<NegativeLinuxFdProofStat>;
 read(this:object,handle:object,offset:number,length:number):Uint8Array;spawnFromInheritedFd(this:object,handle:object,invocation:Readonly<NegativeLinuxFdProofInvocation>):object;
 inspectChild(this:object,child:object):Readonly<{pid:number;exeDev:number;exeIno:number}>;terminate(this:object,child:object):'TERMINATION_REQUESTED';
 wait(this:object,child:object):Promise<Readonly<{status:null;signal:'SIGTERM';closed:true}>>;setTimer(this:object,callback:()=>void,ms:number):object;
 clearTimer(this:object,timer:object):void;close(this:object,handle:object):'CLOSED'|'UNKNOWN';
}
export interface NegativeLinuxFdProofTerminal{readonly schemaVersion:1;readonly purpose:'IX01_0076_NEGATIVE_LINUX_SAME_FD_TERMINAL_V1';readonly attemptId:string;readonly issuedAt:number;readonly expiresAt:number;
 readonly child:Readonly<{readonly exitCode:null;readonly signal:'SIGTERM';readonly closeConfirmed:true}>;readonly sourceFd:Readonly<{readonly closeConfirmed:true}>}
export interface NegativeLinuxFdProofResult{readonly status:'SYNTHETIC_SAME_FD_MECHANISM_VERIFIED_NOT_0076_AUTHORIZED'|'UNKNOWN';readonly evidence:'SOURCE_CANDIDATE_ONLY';readonly runtimeVerified:false;readonly executionAuthorized:false;readonly path?:string;readonly dev?:number;readonly ino?:number;readonly sha256?:string;readonly terminal?:Readonly<NegativeLinuxFdProofTerminal>}

const usedAttempts=new Set<string>(),retainedHandles=new Set<object>(),retainedChildren=new Set<object>();
const invalid=():never=>{throw Error('IX01_0076_NEGATIVE_LINUX_FD_PROOF_INVALID');};
function exact(value:unknown,keys:readonly string[]){if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;const d=Object.getOwnPropertyDescriptors(value);return Reflect.ownKeys(d).length===keys.length&&keys.every(key=>!!d[key]?.enumerable&&Object.hasOwn(d[key]!,'value'));}
function planShape(raw:unknown):raw is Readonly<NegativeLinuxFdProofPlan>{return exact(raw,['schemaVersion','purpose','attemptId','issuedAt','expiresAt'])&&Object.isFrozen(raw)&&recordV1(raw,['schemaVersion','purpose','attemptId','issuedAt','expiresAt'])
 &&raw.schemaVersion===1&&raw.purpose===purpose&&uuidV1(raw.attemptId)&&Number.isSafeInteger(raw.issuedAt)&&Number.isSafeInteger(raw.expiresAt)&&raw.issuedAt<raw.expiresAt&&raw.expiresAt-raw.issuedAt<=10000;}
function portShape(raw:NegativeLinuxFdProofAuthorityPorts|NegativeLinuxFdProofSystem,keys:readonly string[]){if(!exact(raw,keys)||!Object.isFrozen(raw))invalid();const d=Object.getOwnPropertyDescriptors(raw),recipient=d.recipient?.value;if(!recipient||typeof recipient!=='object'||types.isProxy(recipient)||!Object.isFrozen(recipient))invalid();for(const key of keys.slice(1))if(typeof d[key]?.value!=='function')invalid();return d;}
function statShape(raw:unknown):raw is Readonly<NegativeLinuxFdProofStat>{if(!exact(raw,['path','realpath','kind','dev','ino','uid','gid','mode','nlink','size','mtimeMs','ctimeMs'])||!Object.isFrozen(raw))return false;const v=raw as NegativeLinuxFdProofStat;
 return v.path===executable&&v.realpath===executable&&v.kind==='FILE'&&[v.dev,v.ino,v.uid,v.gid,v.mode,v.nlink,v.size].every(Number.isSafeInteger)&&[v.mtimeMs,v.ctimeMs].every(Number.isFinite)
  &&v.dev>=0&&v.ino>0&&v.uid===0&&v.gid===0&&(v.mode&0o170000)===0o100000&&(v.mode&0o7777)===0o755&&v.nlink===1&&v.size>0&&v.size<=current0076NegativeLinuxFdProofContract.maxBytes;}
function sameStat(a:Readonly<NegativeLinuxFdProofStat>,b:Readonly<NegativeLinuxFdProofStat>){return(['path','realpath','kind','dev','ino','uid','gid','mode','nlink','size','mtimeMs','ctimeMs'] as const).every(key=>a[key]===b[key]);}

/** 고정 benign executable의 same-FD exec 기계 가능성만 관측한다. 0076 실행·승인·성공 receipt를 발급하지 않는다. */
export async function run0076NegativeLinuxFdProof(rawPlan:Readonly<NegativeLinuxFdProofPlan>,rawAuthority:NegativeLinuxFdProofAuthorityPorts,rawSystem:NegativeLinuxFdProofSystem):Promise<Readonly<NegativeLinuxFdProofResult>>{
 const result=(status:NegativeLinuxFdProofResult['status'],stat?:Readonly<NegativeLinuxFdProofStat>,sha256?:string,terminal?:Readonly<NegativeLinuxFdProofTerminal>):Readonly<NegativeLinuxFdProofResult>=>Object.freeze({status,evidence:'SOURCE_CANDIDATE_ONLY',runtimeVerified:false,executionAuthorized:false,...(status.startsWith('SYNTHETIC_')&&stat&&sha256&&terminal?{path:stat.path,dev:stat.dev,ino:stat.ino,sha256,terminal}:{})});
 if(!planShape(rawPlan)||usedAttempts.has(rawPlan.attemptId))return result('UNKNOWN');usedAttempts.add(rawPlan.attemptId);
 const authorityKeys=['recipient','now','monotonic','assertCurrent'] as const,systemKeys=['recipient','openReadOnly','stat','read','spawnFromInheritedFd','inspectChild','terminate','wait','setTimer','clearTimer','close'] as const;
 let ad:ReturnType<typeof Object.getOwnPropertyDescriptors>,sd:ReturnType<typeof Object.getOwnPropertyDescriptors>;try{ad=portShape(rawAuthority,authorityKeys);sd=portShape(rawSystem,systemKeys);}catch{return result('UNKNOWN');}
 const authorityRecipient=ad.recipient!.value as object,systemRecipient=sd.recipient!.value as object,now=ad.now!.value as NegativeLinuxFdProofAuthorityPorts['now'],monotonic=ad.monotonic!.value as NegativeLinuxFdProofAuthorityPorts['monotonic'],assertCurrent=ad.assertCurrent!.value as NegativeLinuxFdProofAuthorityPorts['assertCurrent'];
 let lastWall=-1,lastMono=-1,wallEnd=-1,monoEnd=-1,handle:object|undefined,child:object|undefined,childClosed=false;
 const unchanged=()=>authorityKeys.every(key=>rawAuthority[key]===ad[key]!.value)&&systemKeys.every(key=>rawSystem[key]===sd[key]!.value);
 const current=()=>{if(!unchanged())invalid();const wall=now.call(rawAuthority),mono=monotonic.call(rawAuthority);if(!Number.isSafeInteger(wall)||!Number.isFinite(mono)||mono<0||wall<rawPlan.issuedAt||wall<lastWall||mono<lastMono)invalid();if(lastWall<0){wallEnd=Math.min(rawPlan.expiresAt,wall+10000);monoEnd=mono+(wallEnd-wall);}if(wall>=wallEnd||mono>=monoEnd)invalid();lastWall=wall;lastMono=mono;if(assertCurrent.call(authorityRecipient,rawPlan)!==undefined)invalid();return Math.floor(Math.min(wallEnd-wall,monoEnd-mono));};
 try{
  current();handle=(sd.openReadOnly!.value as NegativeLinuxFdProofSystem['openReadOnly']).call(systemRecipient,executable);if(!handle||typeof handle!=='object'||types.isProxy(handle)||!Object.isFrozen(handle))invalid();retainedHandles.add(handle);
  current();const first=(sd.stat!.value as NegativeLinuxFdProofSystem['stat']).call(systemRecipient,handle);if(!statShape(first))invalid();const hash=createHash('sha256');let offset=0;
  while(offset<first.size){current();const requested=Math.min(1048576,first.size-offset),raw=(sd.read!.value as NegativeLinuxFdProofSystem['read']).call(systemRecipient,handle,offset,requested);if(!types.isUint8Array(raw)||types.isProxy(raw)||types.isSharedArrayBuffer(raw.buffer)||raw.byteLength<1||raw.byteLength>requested)invalid();hash.update(raw);offset+=raw.byteLength;}
  if(offset!==first.size)invalid();current();const before=(sd.stat!.value as NegativeLinuxFdProofSystem['stat']).call(systemRecipient,handle);if(!statShape(before)||!sameStat(first,before))invalid();
  const fixed=Object.freeze({file:invocation.file,argv0:invocation.argv0,argv:Object.freeze(['10'] as const),inheritedFd:3 as const,shell:false as const,env:Object.freeze({...invocation.env})});
  current();child=(sd.spawnFromInheritedFd!.value as NegativeLinuxFdProofSystem['spawnFromInheritedFd']).call(systemRecipient,handle,fixed);if(!child||typeof child!=='object'||types.isProxy(child)||!Object.isFrozen(child))invalid();retainedChildren.add(child);
  current();const observed=(sd.inspectChild!.value as NegativeLinuxFdProofSystem['inspectChild']).call(systemRecipient,child);if(!exact(observed,['pid','exeDev','exeIno'])||!Object.isFrozen(observed)||![observed.pid,observed.exeDev,observed.exeIno].every(Number.isSafeInteger)||observed.pid<1)invalid();
  const identity=observed.exeDev===first.dev&&observed.exeIno===first.ino;current();if((sd.terminate!.value as NegativeLinuxFdProofSystem['terminate']).call(systemRecipient,child)!=='TERMINATION_REQUESTED')invalid();const remaining=current();
  let expired=false,timer:object|undefined,cleared=false,resolveTimeout!:(value:Readonly<{timeout:true}>)=>void;const timeout=new Promise<Readonly<{timeout:true}>>(resolve=>{resolveTimeout=resolve;});
  try{timer=(sd.setTimer!.value as NegativeLinuxFdProofSystem['setTimer']).call(systemRecipient,()=>{expired=true;resolveTimeout(Object.freeze({timeout:true}));},remaining);}catch{return result('UNKNOWN');}
  const clear=()=>{if(cleared||!timer)return;cleared=true;(sd.clearTimer!.value as NegativeLinuxFdProofSystem['clearTimer']).call(systemRecipient,timer);};
  if(!timer||typeof timer!=='object'||types.isProxy(timer)||expired){try{clear();}catch{}return result('UNKNOWN');}try{current();}catch{try{clear();}catch{}return result('UNKNOWN');}
  const fixedChild=child as object;let waited:Readonly<{status:null;signal:'SIGTERM';closed:true}>|Readonly<{timeout:true}>;
  try{waited=await Promise.race([(sd.wait!.value as NegativeLinuxFdProofSystem['wait']).call(systemRecipient,fixedChild),timeout]);}catch{try{clear();}catch{}return result('UNKNOWN');}try{clear();}catch{return result('UNKNOWN');}
  if('timeout'in waited||!exact(waited,['status','signal','closed'])||waited.status!==null||waited.signal!=='SIGTERM'||waited.closed!==true)return result('UNKNOWN');childClosed=true;retainedChildren.delete(child);current();const after=(sd.stat!.value as NegativeLinuxFdProofSystem['stat']).call(systemRecipient,handle);if(!statShape(after)||!sameStat(first,after)||!identity)return closeKnown(false,first,hash.digest('hex'));
  return closeKnown(true,first,hash.digest('hex'));
 }catch{return result('UNKNOWN');}
 function closeKnown(success:boolean,stat:Readonly<NegativeLinuxFdProofStat>,sha256:string){if(!handle||child&&!childClosed)return result('UNKNOWN');let closed:'CLOSED'|'UNKNOWN';try{current();closed=(sd.close!.value as NegativeLinuxFdProofSystem['close']).call(systemRecipient,handle);}catch{return result('UNKNOWN');}if(closed!=='CLOSED')return result('UNKNOWN');const closedHandle=handle;retainedHandles.delete(closedHandle);handle=undefined;try{current();}catch{return result('UNKNOWN');}
  if(!success)return result('UNKNOWN');const terminal=Object.freeze<NegativeLinuxFdProofTerminal>({schemaVersion:1,purpose:'IX01_0076_NEGATIVE_LINUX_SAME_FD_TERMINAL_V1',attemptId:rawPlan.attemptId,issuedAt:rawPlan.issuedAt,expiresAt:rawPlan.expiresAt,
   child:Object.freeze({exitCode:null,signal:'SIGTERM',closeConfirmed:true}),sourceFd:Object.freeze({closeConfirmed:true})});return result('SYNTHETIC_SAME_FD_MECHANISM_VERIFIED_NOT_0076_AUTHORIZED',stat,sha256,terminal);}
}
