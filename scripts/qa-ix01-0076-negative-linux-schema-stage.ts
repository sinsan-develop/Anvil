import {types} from 'node:util';
import {canonicalJson,contentHash} from '../contracts/canonical.ts';
import {hashV1,recordV1,uuidV1} from '../contracts/runtime/validation-v1.ts';
import {
 current0076NegativeContract,type NegativeCommandObservation,type NegativeOwnedTarget,type NegativeStagePorts,
} from './qa-ix01-0076-atomicity-negative.ts';
import {verifyCurrentSchemaExecutionDelivery,type CurrentSchemaExecutionBaseline} from '../tests/integration/IX01/current-schema-installation.ts';
import type {SchemaMigrationBaseline} from '../tests/integration/IX01/current-schema-baseline.ts';

const purpose='IX01_0076_NEGATIVE_LINUX_SCHEMA_COMMAND' as const;
const role='anvil_v3_migrator' as const;
export const current0076NegativeLinuxSchemaStageContract=Object.freeze({purpose,role,evidence:'SOURCE_STAGE_ONLY' as const,runtimeVerified:false as const,executionAuthorized:false as const});

interface Namespace{readonly container:string;readonly database:string;readonly receipt:string;readonly network:'none'}
interface Binding{readonly purpose:typeof current0076NegativeContract.purpose;readonly attemptId:string;readonly sourceHead:string;readonly planHash:string;readonly approvalHash:string;
 readonly approvalId:string;readonly graphHash:string;readonly issuedAt:number;readonly expiresAt:number;readonly namespace:Readonly<Namespace>}
export interface NegativeLinuxSchemaOwnerPorts{
 readonly recipient:object;
 now(this:object):number;monotonic(this:object):number;
 assertCurrent(this:object,binding:Readonly<Binding>,target:Readonly<NegativeOwnedTarget>|null):void;
 claim(this:object,binding:Readonly<Binding>):Promise<'CLAIMED'|'DUPLICATE'|'UNKNOWN'>;
 prepare(this:object,binding:Readonly<Binding>):Promise<NegativeOwnedTarget>;
}
type Operation='INSTALL_PRIOR'|'APPEND_LEDGER'|'CREATE_SENTINEL'|'READ_CATALOG';
export interface NegativeLinuxSchemaCommandRequest{
 readonly schemaVersion:1;readonly purpose:typeof purpose;readonly operation:Operation;readonly targetHash:string;readonly database:string;readonly role:typeof role;
 readonly timeoutMs:number;readonly stdin:Uint8Array;readonly row:Readonly<CurrentSchemaExecutionBaseline|SchemaMigrationBaseline>|null;
}
type CommandResult=
 |Readonly<{kind:'SETTLED';status:0;signal:null}>
 |Readonly<{kind:'ROWS';status:0;signal:null;raw:string}>
 |Readonly<{kind:'UNKNOWN'}>;
export interface NegativeLinuxSchemaCommandPorts{
 readonly recipient:object;
 execute(this:object,request:Readonly<NegativeLinuxSchemaCommandRequest>):Promise<CommandResult>;
}

const invalid=():never=>{throw Error('IX01_0076_NEGATIVE_LINUX_SCHEMA_STAGE_INVALID');};
const exact=(value:unknown,keys:readonly string[])=>{
 if(!value||typeof value!=='object'||Array.isArray(value)||types.isProxy(value))return false;
 const descriptors=Object.getOwnPropertyDescriptors(value);return Reflect.ownKeys(descriptors).length===keys.length
  &&keys.every(key=>!!descriptors[key]?.enumerable&&Object.hasOwn(descriptors[key]!,'value'));
};
function fixedNamespace(raw:unknown):raw is Readonly<Namespace>{
 return recordV1(raw,['container','database','receipt','network'])&&raw.network==='none'&&typeof raw.container==='string'&&typeof raw.database==='string'&&typeof raw.receipt==='string';
}
function fixedTarget(raw:Readonly<NegativeOwnedTarget>){
 if(!exact(raw,['schemaVersion','purpose','attemptId','sourceHead','planHash','graphHash','namespace','containerId'])||!Object.isFrozen(raw)||!Object.isFrozen(raw.namespace)
  ||raw.schemaVersion!==1||raw.purpose!=='IX01_0076_NEGATIVE_OWNED_TARGET'||!uuidV1(raw.attemptId)||!/^[a-f0-9]{40}$/.test(raw.sourceHead)
  ||![raw.planHash,raw.graphHash,raw.containerId].every(hashV1)||!fixedNamespace(raw.namespace))invalid();
 const compact=raw.attemptId.replaceAll('-','');
 if(raw.namespace.container!=='anvil-ix01-0076-negative-'+compact||raw.namespace.database!=='ix01_0076_negative_'+compact
  ||raw.namespace.receipt!=='/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+raw.attemptId)invalid();
 return raw;
}
function fixedOwner(raw:NegativeLinuxSchemaOwnerPorts){
 const keys=['recipient','now','monotonic','assertCurrent','claim','prepare'];
 if(!exact(raw,keys)||!Object.isFrozen(raw)||!raw.recipient||typeof raw.recipient!=='object'||types.isProxy(raw.recipient)||keys.slice(1).some(key=>typeof (raw as any)[key]!=='function'))invalid();
 return raw;
}
function fixedCommands(raw:NegativeLinuxSchemaCommandPorts){
 if(!exact(raw,['recipient','execute'])||!Object.isFrozen(raw)||!raw.recipient||typeof raw.recipient!=='object'||types.isProxy(raw.recipient)||typeof raw.execute!=='function')invalid();return raw;
}
function migrationRow(raw:Readonly<CurrentSchemaExecutionBaseline|SchemaMigrationBaseline>){
 if(!exact(raw,['id','path','sha256','bytes'])||!Object.isFrozen(raw)||typeof raw.id!=='string'||!/^[0-9]{4}_[a-z0-9_]{1,100}$/.test(raw.id)||typeof raw.path!=='string'
  ||!/^db\/migrations\/[0-9]{4}_[a-z0-9_]+\.sql(?:\.pending)?$/.test(raw.path)||!hashV1(raw.sha256)||!Number.isSafeInteger(raw.bytes)||raw.bytes<1)invalid();
 return raw as Readonly<SchemaMigrationBaseline>;
}
function commandResult(raw:unknown,rows:boolean):CommandResult{
 if(!raw||typeof raw!=='object'||types.isProxy(raw)||!Object.isFrozen(raw))invalid();
 if(exact(raw,['kind'])&&(raw as any).kind==='UNKNOWN')return raw as Readonly<{kind:'UNKNOWN'}>;
 if(rows){
  if(!exact(raw,['kind','status','signal','raw'])||(raw as any).kind!=='ROWS'||(raw as any).status!==0||(raw as any).signal!==null||typeof (raw as any).raw!=='string'||Buffer.byteLength((raw as any).raw)>1_048_576)invalid();
 }else if(!exact(raw,['kind','status','signal'])||(raw as any).kind!=='SETTLED'||(raw as any).status!==0||(raw as any).signal!==null)invalid();
 return raw as Readonly<CommandResult>;
}
const observation=(target:Readonly<NegativeOwnedTarget>,sqlHash:string,kind:'SETTLED'|'UNKNOWN'):Readonly<NegativeCommandObservation>=>Object.freeze({
 scopeHash:contentHash(canonicalJson(target)),sqlHash,kind,exitStatus:kind==='SETTLED'?0:null,signal:null,sqlState:null,statementEndLine:null,
});

/**
 * prior 106 SQL/ledger와 고정 sentinel/catalog만 command port로 좁힌다. 0076 SQL은 기존 receiver가 소유하며,
 * 이 adapter 자체는 ToolOwner·process·실행 승인을 발급하지 않는다.
 */
export function create0076NegativeLinuxSchemaStage(rawOwner:NegativeLinuxSchemaOwnerPorts,rawCommands:NegativeLinuxSchemaCommandPorts):Readonly<NegativeStagePorts>{
 const owner=fixedOwner(rawOwner),commands=fixedCommands(rawCommands),ownerRecipient=owner.recipient,commandRecipient=commands.recipient;
 const original={now:owner.now,monotonic:owner.monotonic,assertCurrent:owner.assertCurrent,claim:owner.claim,prepare:owner.prepare,execute:commands.execute};
 let binding:Readonly<Binding>|null=null,target:Readonly<NegativeOwnedTarget>|null=null,lastWall=-1,lastMono=-1,blocked=false,inFlight=false,installed=0,ledgered=0,catalogReads=0,sentinelCreated=false;
 let claimState:'FRESH'|'PENDING'|'CLAIMED'|'BLOCKED'='FRESH',prepareState:'FRESH'|'PENDING'|'PREPARED'|'BLOCKED'='FRESH';
 let pendingLedger:Readonly<SchemaMigrationBaseline>|null=null;
 const unchanged=()=>rawOwner.recipient===ownerRecipient&&rawOwner.now===original.now&&rawOwner.monotonic===original.monotonic&&rawOwner.assertCurrent===original.assertCurrent
  &&rawOwner.claim===original.claim&&rawOwner.prepare===original.prepare&&rawCommands.recipient===commandRecipient&&rawCommands.execute===original.execute;
 const localCurrent=(found:Readonly<NegativeOwnedTarget>|null=target)=>{
  if(!unchanged()||binding===null)invalid();const fixedBinding=binding as Readonly<Binding>,wall=original.now.call(ownerRecipient),mono=original.monotonic.call(ownerRecipient);
  if(!Number.isSafeInteger(wall)||!Number.isFinite(mono)||mono<0||wall<lastWall||mono<lastMono||wall>=fixedBinding.expiresAt||original.assertCurrent.call(ownerRecipient,fixedBinding,found)!==undefined)invalid();
  lastWall=wall;lastMono=mono;
 };
 const now=()=>original.now.call(ownerRecipient),monotonic=()=>original.monotonic.call(ownerRecipient);
 const assertCurrent:NegativeStagePorts['assertCurrent']=(foundBinding,foundTarget)=>{
  if(binding===null){binding=foundBinding;lastWall=original.now.call(ownerRecipient);lastMono=original.monotonic.call(ownerRecipient);}
  else if(binding!==foundBinding)invalid();
  if(foundTarget!==null){fixedTarget(foundTarget);if(target===null)target=foundTarget;else if(target!==foundTarget)invalid();}
  localCurrent(foundTarget);
 };
 const claim:NegativeStagePorts['claim']=async found=>{
  if(found!==binding||blocked||claimState!=='FRESH'){blocked=true;claimState='BLOCKED';return'UNKNOWN';}claimState='PENDING';
  try{localCurrent(null);const result=await original.claim.call(ownerRecipient,found);if(blocked)invalid();localCurrent(null);if(result!=='CLAIMED')invalid();claimState='CLAIMED';return result;}
  catch{blocked=true;claimState='BLOCKED';return'UNKNOWN';}
 };
 const prepare:NegativeStagePorts['prepare']=async found=>{
  if(found!==binding||blocked||claimState!=='CLAIMED'||prepareState!=='FRESH'){blocked=true;prepareState='BLOCKED';invalid();}prepareState='PENDING';
  try{localCurrent(null);const result=await original.prepare.call(ownerRecipient,found);if(blocked)invalid();localCurrent(null);prepareState='PREPARED';return result;}
  catch{blocked=true;prepareState='BLOCKED';return invalid();}
 };
 const execute=async(operation:Operation,stdin:Uint8Array,row:Readonly<CurrentSchemaExecutionBaseline|SchemaMigrationBaseline>|null,timeoutMs:number,rows=false)=>{
  if(blocked||inFlight||prepareState!=='PREPARED'||target===null){blocked=true;return Object.freeze({kind:'UNKNOWN'} as const);}inFlight=true;try{
   if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30_000)invalid();localCurrent();const owned=new Uint8Array(stdin),request=Object.freeze({schemaVersion:1 as const,purpose,operation,targetHash:contentHash(canonicalJson(target)),
    database:target.namespace.database,role,timeoutMs,stdin:owned,row});
   const stdinHash=contentHash(owned),result=commandResult(await original.execute.call(commandRecipient,request),rows);if(blocked)invalid();localCurrent();if(contentHash(owned)!==stdinHash)invalid();if(result.kind==='UNKNOWN')blocked=true;return result;
  }catch{blocked=true;return Object.freeze({kind:'UNKNOWN'} as const);}finally{inFlight=false;}
 };
 const install:NegativeStagePorts['install']=async(found,raw,row,timeoutMs)=>{
  if(found!==target||row.id===current0076NegativeContract.sourceId||pendingLedger!==null||installed>=106){blocked=true;return observation(found,row.sha256,'UNKNOWN');}
  let fixed:Readonly<SchemaMigrationBaseline>;try{fixed=migrationRow(row);verifyCurrentSchemaExecutionDelivery(raw,row);}catch{blocked=true;return observation(found,row.sha256,'UNKNOWN');}
  const result=await execute('INSTALL_PRIOR',raw,fixed,timeoutMs);if(result.kind==='SETTLED'){installed++;pendingLedger=fixed;}
  return observation(found,row.sha256,result.kind==='SETTLED'?'SETTLED':'UNKNOWN');
 };
 const appendLedger:NegativeStagePorts['appendLedger']=async(found,row,timeoutMs)=>{
  let fixed:Readonly<SchemaMigrationBaseline>;try{fixed=migrationRow(row);}catch{blocked=true;return observation(found,row.sha256,'UNKNOWN');}
  if(found!==target||pendingLedger===null||canonicalJson(fixed)!==canonicalJson(pendingLedger)){blocked=true;return observation(found,row.sha256,'UNKNOWN');}
  const sql="INSERT INTO anvil.schema_migrations(id,checksum) VALUES('"+fixed.id+"','"+fixed.sha256+"');",result=await execute('APPEND_LEDGER',new TextEncoder().encode(sql),fixed,timeoutMs);
  if(result.kind==='SETTLED'){ledgered++;pendingLedger=null;}
  return observation(found,contentHash(sql),result.kind==='SETTLED'?'SETTLED':'UNKNOWN');
 };
 const sentinel:NegativeStagePorts['sentinel']=async(found,sql,timeoutMs)=>{
  if(found!==target||sql!==current0076NegativeContract.sentinelSql||installed!==106||ledgered!==106||pendingLedger!==null||sentinelCreated||catalogReads!==1){blocked=true;return observation(found,contentHash(sql),'UNKNOWN');}
  const result=await execute('CREATE_SENTINEL',new TextEncoder().encode(sql),null,timeoutMs);if(result.kind==='SETTLED')sentinelCreated=true;
  return observation(found,contentHash(sql),result.kind==='SETTLED'?'SETTLED':'UNKNOWN');
 };
 const catalog:NegativeStagePorts['catalog']=async(found,sql,timeoutMs)=>{
  if(found!==target||sql!==current0076NegativeContract.catalogSql||installed!==106||ledgered!==106||pendingLedger!==null||catalogReads>=3
   ||catalogReads===0&&sentinelCreated||catalogReads>0&&!sentinelCreated)invalid();
  const result=await execute('READ_CATALOG',new TextEncoder().encode(sql),null,timeoutMs,true);
  if(result.kind!=='ROWS'||!('raw' in result))invalid();const rows=result as Extract<CommandResult,{kind:'ROWS'}>;
  catalogReads++;
  return{scopeHash:contentHash(canonicalJson(found)),sqlHash:contentHash(sql),exitStatus:0,signal:null,raw:rows.raw};
 };
 return Object.freeze({now,monotonic,assertCurrent,claim,prepare,install,appendLedger,sentinel,catalog});
}
