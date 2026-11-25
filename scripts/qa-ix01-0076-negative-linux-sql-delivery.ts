import {types} from 'node:util';
import {canonicalJson,contentHash} from '../contracts/canonical.ts';
import {current0076NegativeContract,type NegativeFailureParserCapability,type NegativeOwnedTarget} from './qa-ix01-0076-atomicity-negative.ts';
import {
 create0076NegativeLinuxNativeDockerSqlPorts,type NegativeLinuxNativeDockerProtectedPriorCapability,type NegativeLinuxNativeDockerSqlPorts,type NegativeLinuxNativeDockerTransferredOwner,
} from './qa-ix01-0076-negative-linux-native-docker.ts';
import type {NegativeLinuxSchemaCommandPorts,NegativeLinuxSchemaCommandRequest} from './qa-ix01-0076-negative-linux-schema-stage.ts';
import type {NegativePsqlInvocation,NegativePsqlOwnerPorts,NegativePsqlProcessPorts} from './qa-ix01-0076-negative-psql.ts';
import {verifyCurrentSchemaExecutionDelivery,type CurrentSchemaExecutionBaseline} from '../tests/integration/IX01/current-schema-installation.ts';

const providerPath='db/migrations/0037_provider_session_claims.sql.pending';
const providerHash='eb4cc66e8d682f08225823e39bae5ad40f7af62b529d3774291e855f34536097';
const role='anvil_v3_migrator' as const,maximumOutput=1_048_576;
export const current0076NegativeLinuxSqlDeliveryContract=Object.freeze({evidence:'SOURCE_STAGE_ONLY' as const,runtimeVerified:false as const,sameFdExecutionVerified:false as const});

export interface NegativeLinuxSqlDelivery{
 readonly target:Readonly<NegativeOwnedTarget>;readonly commands:Readonly<NegativeLinuxSchemaCommandPorts>;
 readonly psqlOwner:Readonly<NegativePsqlOwnerPorts>;readonly psqlProcess:Readonly<NegativePsqlProcessPorts>;
 close():Promise<'CLOSED'|'UNKNOWN'>;
}

const invalid=():never=>{throw Error('IX01_0076_NEGATIVE_LINUX_SQL_DELIVERY_INVALID');};
const exact=(value:unknown,keys:readonly string[])=>{
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 const descriptors=Object.getOwnPropertyDescriptors(value);return Reflect.ownKeys(descriptors).length===keys.length&&keys.every(key=>!!descriptors[key]?.enumerable&&Object.hasOwn(descriptors[key]!,'value'));
};
const unknown=()=>Object.freeze({kind:'UNKNOWN'} as const);
function fixedPsql(target:Readonly<NegativeOwnedTarget>,atomic=false){
 return Object.freeze(['--config',target.namespace.receipt+'/docker-config','--host','unix:///var/run/docker.sock','exec','-i','--user','999:999',target.containerId,
  'psql','--no-psqlrc','--no-password','--quiet','--no-align','--tuples-only','--host=/var/run/postgresql','--username='+role,'--dbname='+target.namespace.database,
  '--set=ON_ERROR_STOP=on','--set=VERBOSITY=verbose','--set=SHOW_CONTEXT=never','--set=ECHO=none',...(atomic?['--single-transaction']:[]),'--file=-']);
}
function sameBytes(found:Uint8Array,expected:string){return contentHash(found)===contentHash(expected)&&Buffer.byteLength(expected)===found.byteLength;}

/**
 * prepare가 이전한 동일 native FileState만 schema-stage와 0076 receiver에 공유한다.
 * 실제 read-only native system의 same-FD spawn은 계속 닫혀 있으므로 이 조립 자체는 실행 승인이나 OS 검증이 아니다.
 */
export function create0076NegativeLinuxSqlDelivery(owner:NegativeLinuxNativeDockerTransferredOwner,target:Readonly<NegativeOwnedTarget>,failureParser:NegativeFailureParserCapability,protectedPrior:NegativeLinuxNativeDockerProtectedPriorCapability):Readonly<NegativeLinuxSqlDelivery>{
 const native=create0076NegativeLinuxNativeDockerSqlPorts(owner,target,failureParser,protectedPrior),recipient=native.recipient,targetJson=canonicalJson(target),targetHash=contentHash(targetJson);let blocked=false,inFlight=false,closed=false;
 const current=()=>{if(blocked||closed)invalid();native.assertCurrent.call(recipient,target);};
 const execute=async(request:Readonly<NegativeLinuxSchemaCommandRequest>)=>{
  if(blocked||closed||inFlight)return unknown();inFlight=true;
  try{
   if(!exact(request,['schemaVersion','purpose','operation','targetHash','database','role','timeoutMs','stdin','row'])||!Object.isFrozen(request)||request.schemaVersion!==1
    ||request.purpose!=='IX01_0076_NEGATIVE_LINUX_SCHEMA_COMMAND'||request.targetHash!==targetHash||request.database!==target.namespace.database||request.role!==role
    ||!Number.isSafeInteger(request.timeoutMs)||request.timeoutMs<1||request.timeoutMs>30_000||types.isProxy(request.stdin)||!types.isUint8Array(request.stdin)||types.isSharedArrayBuffer(request.stdin.buffer))invalid();
   let atomic=false,rows=false;
   if(request.operation==='INSTALL_PRIOR'){
    const candidate=request.row;if(candidate===null)invalid();const row=candidate as Readonly<CurrentSchemaExecutionBaseline>;verifyCurrentSchemaExecutionDelivery(request.stdin,row);if(row.path===providerPath){if(row.sha256!==providerHash)invalid();atomic=true;}
   }else if(request.operation==='APPEND_LEDGER'){
    const candidate=request.row;if(candidate===null)invalid();const row=candidate as Readonly<CurrentSchemaExecutionBaseline>,sql="INSERT INTO anvil.schema_migrations(id,checksum) VALUES('"+row.id+"','"+row.sha256+"');";if(!sameBytes(request.stdin,sql))invalid();
   }else if(request.operation==='CREATE_SENTINEL'){
    if(request.row!==null||!sameBytes(request.stdin,current0076NegativeContract.sentinelSql))invalid();
   }else if(request.operation==='READ_CATALOG'){
    if(request.row!==null||!sameBytes(request.stdin,current0076NegativeContract.catalogSql))invalid();rows=true;
   }else invalid();
   current();const result=await native.run.call(recipient,Object.freeze({operation:request.operation,argv:fixedPsql(target,atomic),stdin:new Uint8Array(request.stdin),timeoutMs:request.timeoutMs,outputLimitBytes:rows?maximumOutput:16_384,row:request.row}),new AbortController().signal);current();
   if(!result.closed||result.status!==0||result.signal!==null||result.stderr.byteLength!==0)invalid();
   if(rows){const raw=new TextDecoder('utf-8',{fatal:true}).decode(result.stdout);return Object.freeze({kind:'ROWS' as const,status:0 as const,signal:null,raw});}
   if(result.stdout.byteLength!==0)invalid();return Object.freeze({kind:'SETTLED' as const,status:0 as const,signal:null});
  }catch{blocked=true;return unknown();}finally{inFlight=false;}
 };
 const commands=Object.freeze({recipient,execute}) satisfies NegativeLinuxSchemaCommandPorts;
 const psqlOwner=Object.freeze({recipient,deadline:native.deadline,now(this:object){if(this!==recipient)invalid();return native.now.call(recipient);},monotonic(this:object){if(this!==recipient)invalid();return native.monotonic.call(recipient);},assertCurrent(this:object,found:Readonly<NegativeOwnedTarget>){if(this!==recipient||canonicalJson(found)!==targetJson)invalid();current();}}) satisfies NegativePsqlOwnerPorts;
 const psqlProcess=Object.freeze({recipient,schedule(this:object,callback:()=>void,timeoutMs:number){if(this!==recipient)invalid();return native.schedule.call(recipient,callback,timeoutMs);},async run(this:object,invocation:Readonly<NegativePsqlInvocation>,signal:AbortSignal){
  if(this!==recipient||blocked||closed||inFlight)return Object.freeze({status:null,signal:null,code:'UNKNOWN',closed:false,stdout:new Uint8Array(),stderr:new Uint8Array()});inFlight=true;
  try{
   if(!exact(invocation,['executable','argv','env','cwd','stdin','timeoutMs','outputLimitBytes'])||!Object.isFrozen(invocation)||invocation.executable!=='/usr/bin/docker'||invocation.cwd!=='/'
    ||!Object.isFrozen(invocation.argv)||!Object.isFrozen(invocation.env)||contentHash(canonicalJson(invocation.argv))!==contentHash(canonicalJson(fixedPsql(target,false)))
    ||!exact(invocation.env,['PATH','LANG','LC_ALL','HOME'])||invocation.env.PATH!=='/usr/bin:/bin'||invocation.env.LANG!=='C.UTF-8'||invocation.env.LC_ALL!=='C.UTF-8'||invocation.env.HOME!==target.namespace.receipt
    ||invocation.outputLimitBytes!==16_384)invalid();
   current();const result=await native.run.call(recipient,Object.freeze({operation:'NEGATIVE_0076' as const,argv:fixedPsql(target,false),stdin:new Uint8Array(invocation.stdin),timeoutMs:invocation.timeoutMs,outputLimitBytes:16_384,row:null}),signal);
   if(!result.closed){blocked=true;return Object.freeze({status:null,signal:null,code:'UNKNOWN',closed:false,stdout:new Uint8Array(),stderr:new Uint8Array()});}
    if(result.signal!==null||result.status!==3)blocked=true;return Object.freeze({...result,code:null});
  }catch{blocked=true;return Object.freeze({status:null,signal:null,code:'UNKNOWN',closed:false,stdout:new Uint8Array(),stderr:new Uint8Array()});}finally{inFlight=false;}
 }}) satisfies NegativePsqlProcessPorts;
 const close=async()=>{if(closed)return await native.close.call(recipient);closed=true;return await native.close.call(recipient);};
 return Object.freeze({target,commands,psqlOwner,psqlProcess,close});
}
