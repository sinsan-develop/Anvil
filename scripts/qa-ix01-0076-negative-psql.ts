import {types} from 'node:util';
import {canonicalJson,contentHash} from '../contracts/canonical.ts';
import {hashV1,recordV1,uuidV1} from '../contracts/runtime/validation-v1.ts';
import {current0076NegativeContract,type NegativeOwnedTarget} from './qa-ix01-0076-atomicity-negative.ts';
import {current0076NegativeReceiverContract,type NegativeReceiverPorts} from './qa-ix01-0076-atomicity-negative-receiver.ts';

export interface NegativePsqlOwnerPorts{
 readonly recipient:object;
 readonly deadline:Readonly<{wallExpiresAt:number;monotonicExpiresAt:number}>;
 now(this:object):number;
 monotonic(this:object):number;
 assertCurrent(this:object,target:Readonly<NegativeOwnedTarget>):void;
}
export interface NegativePsqlInvocation{
 readonly executable:'/usr/bin/docker';readonly argv:readonly string[];readonly env:Readonly<Record<string,string>>;
 readonly cwd:'/';readonly stdin:Uint8Array;readonly timeoutMs:number;readonly outputLimitBytes:16384;
}
export interface NegativePsqlProcessResult{
 readonly status:number|null;readonly signal:string|null;readonly code:string|null;readonly closed:boolean;
 readonly stdout:Uint8Array;readonly stderr:Uint8Array;
}
export interface NegativePsqlProcessPorts{
 readonly recipient:object;
 schedule(this:object,callback:()=>void,timeoutMs:number):()=>void;
 run(this:object,invocation:Readonly<NegativePsqlInvocation>,signal:AbortSignal):Promise<Readonly<NegativePsqlProcessResult>>;
}
export type NegativePsqlTargetCapability=object;

interface TargetBinding{
 readonly target:Readonly<NegativeOwnedTarget>;readonly targetHash:string;readonly owner:NegativePsqlOwnerPorts;
 readonly current:NegativePsqlOwnerPorts['assertCurrent'];readonly now:NegativePsqlOwnerPorts['now'];readonly monotonic:NegativePsqlOwnerPorts['monotonic'];
 readonly deadline:NegativePsqlOwnerPorts['deadline'];lastWall:number;lastMonotonic:number;receiverCreated:boolean;
}
const targetCapabilities=new WeakMap<object,TargetBinding>(),issuedAttempts=new Set<string>(),maximumIssuedTargets=256;
const invalid=():never=>{throw Error('IX01_0076_NEGATIVE_PSQL_INVALID');};
function exact(value:unknown,keys:readonly string[]){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 const descriptors=Object.getOwnPropertyDescriptors(value);return Reflect.ownKeys(descriptors).length===keys.length&&keys.every(key=>!!descriptors[key]?.enumerable&&Object.hasOwn(descriptors[key]!,'value'));
}
function targetShape(raw:Readonly<NegativeOwnedTarget>){
 if(!exact(raw,['schemaVersion','purpose','attemptId','sourceHead','planHash','graphHash','namespace','containerId'])||!Object.isFrozen(raw)||!Object.isFrozen(raw.namespace)
  ||raw.schemaVersion!==1||raw.purpose!=='IX01_0076_NEGATIVE_OWNED_TARGET'||!uuidV1(raw.attemptId)||!/^[a-f0-9]{40}$/.test(raw.sourceHead)
  ||![raw.planHash,raw.graphHash,raw.containerId].every(hashV1)||!recordV1(raw.namespace,['container','database','receipt','network'])||raw.namespace.network!=='none')invalid();
 const compact=raw.attemptId.replaceAll('-','');
 if(raw.namespace.container!=='anvil-ix01-0076-negative-'+compact||raw.namespace.database!=='ix01_0076_negative_'+compact
  ||raw.namespace.receipt!=='/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+raw.attemptId)invalid();
 return raw;
}
function ownerPorts(raw:NegativePsqlOwnerPorts){
 if(!exact(raw,['recipient','deadline','now','monotonic','assertCurrent'])||!Object.isFrozen(raw))invalid();const descriptors=Object.getOwnPropertyDescriptors(raw),recipient=descriptors.recipient!.value as object;
 const deadline=descriptors.deadline!.value as NegativePsqlOwnerPorts['deadline'];
 if(!recipient||typeof recipient!=='object'||types.isProxy(recipient)||!Object.isFrozen(recipient)||!exact(deadline,['wallExpiresAt','monotonicExpiresAt'])||!Object.isFrozen(deadline)
  ||!Number.isSafeInteger(deadline.wallExpiresAt)||deadline.wallExpiresAt<=0||!Number.isFinite(deadline.monotonicExpiresAt)||deadline.monotonicExpiresAt<0
  ||typeof descriptors.now!.value!=='function'||typeof descriptors.monotonic!.value!=='function'||typeof descriptors.assertCurrent!.value!=='function')invalid();
 return{recipient,deadline,now:descriptors.now!.value as NegativePsqlOwnerPorts['now'],monotonic:descriptors.monotonic!.value as NegativePsqlOwnerPorts['monotonic'],current:descriptors.assertCurrent!.value as NegativePsqlOwnerPorts['assertCurrent']};
}
function processPorts(raw:NegativePsqlProcessPorts){
 if(!exact(raw,['recipient','schedule','run'])||!Object.isFrozen(raw))invalid();const descriptors=Object.getOwnPropertyDescriptors(raw),recipient=descriptors.recipient!.value as object;
 if(!recipient||typeof recipient!=='object'||types.isProxy(recipient)||!Object.isFrozen(recipient)||typeof descriptors.schedule!.value!=='function'||typeof descriptors.run!.value!=='function')invalid();
 return{recipient,schedule:descriptors.schedule!.value as NegativePsqlProcessPorts['schedule'],run:descriptors.run!.value as NegativePsqlProcessPorts['run']};
}
function ownedBytes(raw:unknown,max:number){
 if(!types.isUint8Array(raw)||types.isProxy(raw))invalid();const bytes=raw as Uint8Array;
 if(types.isSharedArrayBuffer(bytes.buffer)||bytes.byteLength>max)invalid();return new Uint8Array(bytes);
}

/** 원 owner current를 보유하는 비직렬 capability일 뿐 대상·실행 권위를 새로 발급하지 않는다. */
export function bind0076NegativePsqlTarget(rawTarget:Readonly<NegativeOwnedTarget>,rawOwner:NegativePsqlOwnerPorts):NegativePsqlTargetCapability{
 const target=targetShape(rawTarget),owner=ownerPorts(rawOwner),targetHash=contentHash(canonicalJson(target));
 if(issuedAttempts.size>=maximumIssuedTargets||issuedAttempts.has(target.attemptId))invalid();
 const wall=owner.now.call(owner.recipient),monotonic=owner.monotonic.call(owner.recipient);
 if(!Number.isSafeInteger(wall)||wall<0||!Number.isFinite(monotonic)||monotonic<0||wall>=owner.deadline.wallExpiresAt||monotonic>=owner.deadline.monotonicExpiresAt
  ||owner.current.call(owner.recipient,target)!==undefined)invalid();
 const capability=Object.freeze(Object.create(null)) as object;
 issuedAttempts.add(target.attemptId);targetCapabilities.set(capability,{target,targetHash,owner:rawOwner,current:owner.current,now:owner.now,monotonic:owner.monotonic,deadline:owner.deadline,lastWall:wall,lastMonotonic:monotonic,receiverCreated:false});return capability;
}

/** 고정 Docker/psql stdin 호출 형상만 공급한다. 실제 process driver·승인·CLI는 등록하지 않는다. */
export function create0076NegativePsqlReceiver(capability:NegativePsqlTargetCapability,rawProcess:NegativePsqlProcessPorts):Readonly<NegativeReceiverPorts>{
 const found=targetCapabilities.get(capability),process=processPorts(rawProcess);if(!found)throw Error('IX01_0076_NEGATIVE_PSQL_INVALID');if(found.receiverCreated)invalid();found.receiverCreated=true;
 const bound=found,{target,targetHash,owner,current}=bound;
 let used=false;
 const unchanged=()=>bound.owner.recipient===Object.getOwnPropertyDescriptor(bound.owner,'recipient')?.value
  &&bound.owner.deadline===bound.deadline&&bound.owner.now===bound.now&&bound.owner.monotonic===bound.monotonic&&bound.owner.assertCurrent===current
  &&rawProcess.recipient===process.recipient&&rawProcess.schedule===process.schedule&&rawProcess.run===process.run
  &&contentHash(canonicalJson(target))===targetHash;
 const checkCurrent=()=>{
  if(!unchanged())invalid();const wall=bound.now.call(bound.owner.recipient),monotonic=bound.monotonic.call(bound.owner.recipient);
  if(!Number.isSafeInteger(wall)||wall<0||!Number.isFinite(monotonic)||monotonic<0||wall<bound.lastWall||monotonic<bound.lastMonotonic
   ||wall>=bound.deadline.wallExpiresAt||monotonic>=bound.deadline.monotonicExpiresAt||current.call(bound.owner.recipient,target)!==undefined)invalid();
  bound.lastWall=wall;bound.lastMonotonic=monotonic;const remaining=Math.floor(Math.min(bound.deadline.wallExpiresAt-wall,bound.deadline.monotonicExpiresAt-monotonic));
  if(remaining<1)invalid();return remaining;
 };
 checkCurrent();
 const schedule:NegativeReceiverPorts['schedule']=(callback,timeoutMs)=>{
  if(typeof callback!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000||!unchanged())invalid();
  const remaining=checkCurrent(),wrapped=()=>{try{checkCurrent();}catch{}callback();};
  const cancel=process.schedule.call(process.recipient,wrapped,Math.min(timeoutMs,remaining));if(typeof cancel!=='function')invalid();
  try{checkCurrent();}catch{try{cancel();}catch{}invalid();}return cancel;
 };
 const execute:NegativeReceiverPorts['execute']=async(raw,signal)=>{
  if(used)return Object.freeze({kind:'UNKNOWN'});used=true;
  if(!(signal instanceof AbortSignal)||signal.aborted||!exact(raw,['schemaVersion','purpose','attemptId','targetHash','graphHash','receiverPath','receiverSourceHash','sourceSqlHash','executionSqlHash','expectedSqlState','statementEndLine','timeoutMs','sql'])||!Object.isFrozen(raw)
   ||raw.schemaVersion!==1||raw.purpose!==current0076NegativeReceiverContract.requestPurpose||raw.attemptId!==target.attemptId||raw.targetHash!==targetHash
   ||raw.graphHash!==target.graphHash||raw.receiverPath!==current0076NegativeReceiverContract.receiverPath||!hashV1(raw.receiverSourceHash)
   ||raw.sourceSqlHash!==current0076NegativeContract.sourceSha256||raw.executionSqlHash!==current0076NegativeContract.executionSha256
   ||raw.expectedSqlState!=='42723'||raw.statementEndLine!==2343||!Number.isSafeInteger(raw.timeoutMs)||raw.timeoutMs<1||raw.timeoutMs>30000)return Object.freeze({kind:'UNKNOWN'});
  let stdin:Uint8Array,remaining:number;
  try{checkCurrent();stdin=ownedBytes(raw.sql,current0076NegativeContract.sourceBytes);if(stdin.byteLength!==current0076NegativeContract.sourceBytes||contentHash(stdin)!==current0076NegativeContract.executionSha256)return Object.freeze({kind:'UNKNOWN'});remaining=checkCurrent();}
  catch{return Object.freeze({kind:'UNKNOWN'});}
  const argv=Object.freeze(['--config',target.namespace.receipt+'/docker-config','--host','unix:///var/run/docker.sock','exec','-i','--user','999:999',target.containerId,'psql','--no-psqlrc','--no-password','--quiet','--no-align','--tuples-only','--host=/var/run/postgresql','--username=anvil_v3_migrator','--dbname='+target.namespace.database,'--set=ON_ERROR_STOP=on','--set=VERBOSITY=verbose','--set=SHOW_CONTEXT=never','--set=ECHO=none','--file=-']);
  const env=Object.freeze({PATH:'/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',HOME:target.namespace.receipt});
  const invocation=Object.freeze({executable:'/usr/bin/docker' as const,argv,env,cwd:'/' as const,stdin,timeoutMs:Math.min(raw.timeoutMs,remaining),outputLimitBytes:16384 as const});let result:Readonly<NegativePsqlProcessResult>;
  try{result=await process.run.call(process.recipient,invocation,signal);checkCurrent();if(signal.aborted||contentHash(stdin)!==current0076NegativeContract.executionSha256)invalid();}
  catch{stdin.fill(0);return Object.freeze({kind:'UNKNOWN'});}
  stdin.fill(0);
  if(!exact(result,['status','signal','code','closed','stdout','stderr'])||!Object.isFrozen(result)||result.status!==3||result.signal!==null||result.code!==null||result.closed!==true)return Object.freeze({kind:'UNKNOWN'});
  let stdout:Uint8Array,stderr:Uint8Array,text:string;
  try{stdout=ownedBytes(result.stdout,16384);stderr=ownedBytes(result.stderr,16384);if(stdout.byteLength||stderr.byteLength<1||stdout.byteLength+stderr.byteLength>16384)invalid();text=new TextDecoder('utf-8',{fatal:true}).decode(stderr);if(!text.isWellFormed())invalid();}
  catch{return Object.freeze({kind:'UNKNOWN'});}
  stdout.fill(0);stderr.fill(0);
  return Object.freeze({kind:'DDL_FAILURE' as const,error:Object.freeze({status:3,signal:null,stderr:text})});
 };
 return Object.freeze({recipient:process.recipient,schedule,execute});
}
