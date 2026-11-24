import {types} from 'node:util';
import {canonicalJson,contentHash,parseWireJson} from '../contracts/canonical.ts';
import {arrayV1,hashV1,recordV1,uuidV1} from '../contracts/runtime/validation-v1.ts';
import {verifyCurrentSchemaExecutionDelivery,type CurrentSchemaExecutionBaseline} from '../tests/integration/IX01/current-schema-installation.ts';
import {
 current0076NegativeContract as stageContract,observe0076DdlFailure,
 type NegativeCommandObservation,type NegativeFailureParserCapability,type NegativeOwnedTarget,type NegativeStagePorts,
} from './qa-ix01-0076-atomicity-negative.ts';

const purpose='IX01_0076_ATOMICITY_NEGATIVE_RECEIVER' as const;
const requestPurpose='IX01_0076_ATOMICITY_NEGATIVE_RECEIVER_REQUEST' as const;
const receiverPath='scripts/qa-ix01-0076-atomicity-negative-receiver.ts';
export const current0076NegativeReceiverContract=Object.freeze({purpose,requestPurpose,receiverPath,evidence:'SOURCE_STAGE_ONLY' as const,runtimeVerified:false as const,executionAuthorized:false as const});

interface NegativeReceiverRequest{
 readonly schemaVersion:1;readonly purpose:typeof requestPurpose;readonly attemptId:string;readonly targetHash:string;readonly graphHash:string;
 readonly receiverPath:typeof receiverPath;readonly receiverSourceHash:string;readonly sourceSqlHash:string;readonly executionSqlHash:string;
 readonly expectedSqlState:'42723';readonly statementEndLine:2343;readonly timeoutMs:number;readonly sql:Uint8Array;
}
type NegativeReceiverOutcome=
 | Readonly<{kind:'DDL_FAILURE';error:unknown}>
 | Readonly<{kind:'SETTLED'}>
 | Readonly<{kind:'UNKNOWN'}>;
export interface NegativeReceiverPorts{
 readonly recipient:object;schedule(callback:()=>void,timeoutMs:number):()=>void;
 execute(this:object,request:Readonly<NegativeReceiverRequest>,signal:AbortSignal):Promise<NegativeReceiverOutcome>;
}
export type NegativeReceiverGraphCapability=object;
const graphCapabilities=new WeakMap<object,{graphHash:string;sourceHead:string;receiverSourceHash:string}>();
const invalid=():never=>{throw Error('IX01_0076_NEGATIVE_RECEIVER_INVALID');};
function exact(value:unknown,keys:readonly string[]){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 const descriptors=Object.getOwnPropertyDescriptors(value);return Reflect.ownKeys(descriptors).length===keys.length&&keys.every(key=>!!descriptors[key]?.enumerable&&Object.hasOwn(descriptors[key]!,'value'));
}
function methods(raw:NegativeReceiverPorts):NegativeReceiverPorts{
 const keys=['recipient','schedule','execute'];if(!exact(raw,keys))invalid();const d=Object.getOwnPropertyDescriptors(raw),recipient=d.recipient!.value as object;
 if(!recipient||typeof recipient!=='object'||types.isProxy(recipient)||!Object.isFrozen(recipient))invalid();
 for(const key of keys.slice(1))if(typeof d[key]!.value!=='function')invalid();
 return Object.freeze({recipient,schedule:d.schedule!.value as NegativeReceiverPorts['schedule'],execute:d.execute!.value as NegativeReceiverPorts['execute']}) as NegativeReceiverPorts;
}
function stageMethods(raw:NegativeStagePorts):NegativeStagePorts{
 const keys=['now','monotonic','assertCurrent','claim','prepare','install','appendLedger','sentinel','catalog'];if(!exact(raw,keys))invalid();const d=Object.getOwnPropertyDescriptors(raw);
 for(const key of keys)if(typeof d[key]!.value!=='function')invalid();
 return Object.freeze(Object.fromEntries(keys.map(key=>[key,d[key]!.value]))) as unknown as NegativeStagePorts;
}
function ownedBytes(raw:Uint8Array,max:number){
 if(!types.isUint8Array(raw)||types.isProxy(raw)||types.isSharedArrayBuffer(Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'buffer')!.get!.call(raw)))invalid();
 const result=new Uint8Array(raw);if(result.byteLength<1||result.byteLength>max)invalid();return result;
}
function targetShape(raw:Readonly<NegativeOwnedTarget>,frozen:boolean){
 if(!exact(raw,['schemaVersion','purpose','attemptId','sourceHead','planHash','graphHash','namespace','containerId'])||(frozen&&(!Object.isFrozen(raw)||!Object.isFrozen(raw.namespace)))
  ||raw.schemaVersion!==1||raw.purpose!=='IX01_0076_NEGATIVE_OWNED_TARGET'||!uuidV1(raw.attemptId)||!/^[a-f0-9]{40}$/.test(raw.sourceHead)
  ||![raw.planHash,raw.graphHash,raw.containerId].every(hashV1)||!recordV1(raw.namespace,['container','database','receipt','network'])||raw.namespace.network!=='none')invalid();
 return raw;
}
function observation(target:Readonly<NegativeOwnedTarget>,kind:'SETTLED'|'UNKNOWN'):Readonly<NegativeCommandObservation>{
 return Object.freeze({scopeHash:contentHash(canonicalJson(target)),sqlHash:stageContract.executionSha256,kind,exitStatus:kind==='SETTLED'?0:null,signal:null,sqlState:null,statementEndLine:null});
}

/** 원 graph의 receiver 항목과 호출자가 제공한 동일 source bytes를 묶을 뿐 실행·대상 권위를 발급하지 않는다. */
export function load0076NegativeReceiverGraph(graphRaw:string,source:Uint8Array):NegativeReceiverGraphCapability{
 if(typeof graphRaw!=='string'||!graphRaw.isWellFormed()||Buffer.byteLength(graphRaw)>2097152)invalid();const bytes=ownedBytes(source,1048576),sourceHash=contentHash(bytes);let graph:unknown;
 try{graph=parseWireJson(graphRaw);}catch{invalid();}if(canonicalJson(graph)!==graphRaw||!recordV1(graph,['schemaVersion','sourceHead','files'])||graph.schemaVersion!==1||!/^[a-f0-9]{40}$/.test(graph.sourceHead)||!arrayV1(graph.files,1000))invalid();
 const verifiedGraph=graph as {schemaVersion:1;sourceHead:string;files:unknown[]};
 let previous='',matched=0;const paths=new Set<string>();
 for(const rawRow of verifiedGraph.files){if(!recordV1(rawRow,['path','bytes','sha256']))invalid();const row=rawRow as {path:string;bytes:number;sha256:string};
  if(typeof row.path!=='string'||row.path<=previous||!Number.isSafeInteger(row.bytes)||row.bytes<0||row.bytes>16777216||!hashV1(row.sha256))invalid();previous=row.path;
  paths.add(row.path);if(row.path===receiverPath){if(row.bytes!==bytes.byteLength||row.sha256!==sourceHash)invalid();matched++;}}
 bytes.fill(0);if(matched!==1||![...stageContract.graphPaths,receiverPath].every(path=>paths.has(path)))invalid();const capability=Object.freeze(Object.create(null)) as object;
 graphCapabilities.set(capability,{graphHash:contentHash(graphRaw),sourceHead:verifiedGraph.sourceHead,receiverSourceHash:sourceHash});return capability;
}

/** 기존 fake stage 포트를 감싼다. 0076 외 호출은 원 포트로 그대로 전달하며 기본 receiver/CLI를 만들지 않는다. */
export function create0076AtomicityNegativeReceiver(
 graphCapability:NegativeReceiverGraphCapability,parserCapability:NegativeFailureParserCapability,
 rawBase:NegativeStagePorts,rawReceiver:NegativeReceiverPorts,
):Readonly<NegativeStagePorts>{
 const foundGraph=graphCapabilities.get(graphCapability),base=stageMethods(rawBase),receiver=methods(rawReceiver);if(!foundGraph)invalid();const graph=foundGraph!;
 type StageBinding=Parameters<NegativeStagePorts['assertCurrent']>[0];
 let fixedBinding:Readonly<StageBinding>|undefined,prepared:Readonly<NegativeOwnedTarget>|undefined,preparedHash:string|undefined;
 let target:Readonly<NegativeOwnedTarget>|undefined,targetHash:string|undefined,used=false,lastWall=-1,lastMono=-1;
 const bind=(binding:Readonly<StageBinding>)=>{
  if(fixedBinding){if(binding!==fixedBinding)invalid();return;}
  if(!Object.isFrozen(binding)||!recordV1(binding,['purpose','attemptId','sourceHead','planHash','approvalHash','approvalId','graphHash','issuedAt','expiresAt','namespace'])
   ||binding.purpose!==stageContract.purpose||!uuidV1(binding.attemptId)||binding.sourceHead!==graph.sourceHead||binding.graphHash!==graph.graphHash
   ||![binding.planHash,binding.approvalHash].every(hashV1)||!uuidV1(binding.approvalId)||![binding.issuedAt,binding.expiresAt].every(Number.isSafeInteger)
   ||binding.expiresAt<=binding.issuedAt||!Object.isFrozen(binding.namespace)||!recordV1(binding.namespace,['container','database','receipt','network'])||binding.namespace.network!=='none')invalid();
  fixedBinding=binding;
 };
 const capture=(binding:Readonly<StageBinding>,actual:Readonly<NegativeOwnedTarget>)=>{
  bind(binding);if(!prepared||!preparedHash)invalid();const original=prepared!,originalHash=preparedHash!;const candidate=targetShape(actual,true);
  if(target){if(candidate!==target||contentHash(canonicalJson(candidate))!==targetHash)invalid();return;}
  if(candidate===original||candidate.namespace!==binding.namespace||contentHash(canonicalJson(original))!==originalHash
   ||candidate.attemptId!==original.attemptId||candidate.sourceHead!==original.sourceHead||candidate.planHash!==original.planHash||candidate.graphHash!==original.graphHash
   ||candidate.containerId!==original.containerId||canonicalJson(candidate.namespace)!==canonicalJson(original.namespace))invalid();
  target=candidate;targetHash=contentHash(canonicalJson(candidate));
 };
 const assertCurrent:NegativeStagePorts['assertCurrent']=(binding,actual)=>{
  base.assertCurrent.call(rawBase,binding,actual);bind(binding);if(actual)capture(binding,actual);
 };
 const readClock=()=>{
  if(!fixedBinding||!target||!targetHash)invalid();const binding=fixedBinding!,fixedTarget=target!,fixedTargetHash=targetHash!;let wall=Number.NaN,mono=Number.NaN;
  try{wall=base.now.call(rawBase);mono=base.monotonic.call(rawBase);}catch{invalid();}
  if(!Number.isSafeInteger(wall)||!Number.isFinite(mono)||mono<0||wall<binding.issuedAt||wall>=binding.expiresAt||wall<lastWall||mono<lastMono
   ||contentHash(canonicalJson(fixedTarget))!==fixedTargetHash)invalid();lastWall=wall;lastMono=mono;return{wall,mono};
 };
 const guardedCurrent=()=>{if(!fixedBinding||!target)invalid();assertCurrent(fixedBinding!,target!);return readClock();};
 const prepare:NegativeStagePorts['prepare']=async binding=>{
  bind(binding);if(prepared)invalid();const owner=await base.prepare.call(rawBase,binding);targetShape(owner,false);prepared=owner;preparedHash=contentHash(canonicalJson(owner));return owner;
 };
 const install:NegativeStagePorts['install']=async(owner,raw,row,timeoutMs)=>{
  if(row.id!==stageContract.sourceId)return base.install.call(rawBase,owner,raw,row,timeoutMs);
  const unknown=()=>observation(target??owner,'UNKNOWN');if(used)return unknown();used=true;
  if(!fixedBinding||!target||!targetHash||owner!==target||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)return unknown();
  let entry:{wall:number;mono:number};try{entry=guardedCurrent();}catch{return unknown();}
  const wallDeadline=Math.min(fixedBinding.expiresAt,entry.wall+timeoutMs),monoDeadline=entry.mono+timeoutMs;
  if(!Number.isSafeInteger(wallDeadline)||!Number.isFinite(monoDeadline))return unknown();
  const within=()=>{const sample=guardedCurrent();if(sample.wall>=wallDeadline||sample.mono>=monoDeadline)invalid();return sample;};
  let bytes:Uint8Array;
  try{verifyCurrentSchemaExecutionDelivery(raw,row as CurrentSchemaExecutionBaseline);bytes=ownedBytes(raw,stageContract.sourceBytes);
   if(row.sha256!==stageContract.executionSha256||row.sourceSha256!==stageContract.sourceSha256||row.sourceBytes!==stageContract.sourceBytes
    ||row.transformation!=='0076_MOVE_COMMIT_TO_END_V1'||bytes.byteLength!==stageContract.sourceBytes||contentHash(bytes)!==stageContract.executionSha256)return unknown();
  }catch{return unknown();}
  let beforeSchedule:{wall:number;mono:number};try{beforeSchedule=within();}catch{bytes!.fill(0);return unknown();}
  const remaining=Math.floor(Math.min(wallDeadline-beforeSchedule.wall,monoDeadline-beforeSchedule.mono));if(remaining<1){bytes!.fill(0);return unknown();}
  const controller=new AbortController();let cancel:(()=>void)|undefined,expired=false,cancelFailed=false,resolveTimeout!:(value:{timeout:true})=>void;
  const timeout=new Promise<{timeout:true}>(resolve=>{resolveTimeout=resolve;});
  try{
   cancel=receiver.schedule.call(receiver,()=>{expired=true;controller.abort();resolveTimeout({timeout:true});},remaining);
   if(typeof cancel!=='function'||expired)throw Error();within();if(controller.signal.aborted)throw Error();
  }catch{controller.abort();if(cancel)try{cancel();}catch{}bytes!.fill(0);return unknown();}
  const outbound=new Uint8Array(bytes!);bytes!.fill(0);
  const request=Object.freeze({schemaVersion:1 as const,purpose:requestPurpose,attemptId:fixedBinding.attemptId,targetHash,graphHash:fixedBinding.graphHash,
   receiverPath,receiverSourceHash:graph.receiverSourceHash,sourceSqlHash:stageContract.sourceSha256,executionSqlHash:stageContract.executionSha256,
   expectedSqlState:'42723' as const,statementEndLine:2343 as const,timeoutMs:remaining,sql:outbound});
  const work=Promise.resolve().then(async()=>{
   try{if(expired||controller.signal.aborted)return{error:true as const};within();if(expired||controller.signal.aborted)return{error:true as const};
    return{value:await receiver.execute.call(receiver.recipient,request,controller.signal)};
   }catch{return{error:true as const};}
  });
  let raced:{value:NegativeReceiverOutcome}|{error:true}|{timeout:true};
  try{raced=await Promise.race([work,timeout]);}finally{try{cancel();}catch{cancelFailed=true;controller.abort();}}
  const unchanged=contentHash(outbound)===stageContract.executionSha256;outbound.fill(0);
  if(expired||cancelFailed||'timeout'in raced||'error'in raced||!unchanged)return unknown();
  try{within();}catch{return unknown();}
  const outcome=raced.value;
  if(exact(outcome,['kind'])&&outcome.kind==='SETTLED')return observation(target,'SETTLED');
  if(exact(outcome,['kind'])&&outcome.kind==='UNKNOWN')return unknown();
  if(!exact(outcome,['kind','error'])||outcome.kind!=='DDL_FAILURE')return unknown();
  try{return observe0076DdlFailure(target,stageContract.executionSha256,Object.getOwnPropertyDescriptor(outcome,'error')!.value,parserCapability);}catch{return unknown();}
 };
 const claim:NegativeStagePorts['claim']=binding=>base.claim.call(rawBase,binding);
 const now:NegativeStagePorts['now']=()=>base.now.call(rawBase);
 const monotonic:NegativeStagePorts['monotonic']=()=>base.monotonic.call(rawBase);
 const appendLedger:NegativeStagePorts['appendLedger']=(owner,row,timeoutMs)=>base.appendLedger.call(rawBase,owner,row,timeoutMs);
 const sentinel:NegativeStagePorts['sentinel']=(owner,sql,timeoutMs)=>base.sentinel.call(rawBase,owner,sql,timeoutMs);
 const catalog:NegativeStagePorts['catalog']=(owner,sql,timeoutMs)=>base.catalog.call(rawBase,owner,sql,timeoutMs);
 return Object.freeze({
  now,monotonic,assertCurrent,
  claim,prepare,install,appendLedger,sentinel,catalog,
 });
}
