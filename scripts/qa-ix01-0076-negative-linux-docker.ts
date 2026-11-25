import {types} from 'node:util';
import {parseWireJson} from '../contracts/canonical.ts';
import {recordV1,uuidV1} from '../contracts/runtime/validation-v1.ts';
import {
 currentCreatedUnallocatedNone,
 currentNetworkProbeContract,
 currentProfile,
 verifyContainerObservation,
} from './qa-ix01-current-journey.ts';
import {verify0076NegativeLinuxContainerSource} from './qa-ix01-0076-negative-linux-container.ts';
import type {NegativeOwnedTarget} from './qa-ix01-0076-atomicity-negative.ts';

const bindingPurpose='IX01_0076_NEGATIVE_LINUX_DOCKER_BINDING' as const;
const dockerPath='/usr/bin/docker',socket='unix:///var/run/docker.sock',owner='IX01_0076_NEGATIVE';
const maximumToolBytes=160*1024*1024,maximumOutputBytes=65_536;
const attempted=new Set<string>(),maximumAttempts=128;

export interface NegativeLinuxDockerBinding{
 readonly schemaVersion:1;readonly purpose:typeof bindingPurpose;readonly attemptId:string;readonly sourceHead:string;readonly planHash:string;
 readonly approvalHash:string;readonly approvalId:string;readonly graphHash:string;readonly issuedAt:number;readonly expiresAt:number;
 readonly namespace:Readonly<{container:string;database:string;receipt:string;network:'none'}>;
}
export interface NegativeLinuxDockerAuthority{
 readonly recipient:object;readonly binding:Readonly<NegativeLinuxDockerBinding>;
 assertClaimed(this:object,binding:Readonly<NegativeLinuxDockerBinding>):unknown;
 assertCurrent(this:object,binding:Readonly<NegativeLinuxDockerBinding>):unknown;
 wall(this:object):number;monotonic(this:object):number;
}
export interface NegativeLinuxDockerToolPin{
 readonly path:string;readonly realpath:string;readonly kind:'FILE';readonly dev:number;readonly ino:number;readonly uid:number;readonly mode:number;
 readonly nlink:number;readonly size:number;readonly mtimeMs:number;readonly ctimeMs:number;readonly sha256:string;readonly custody:object;
}
export interface NegativeLinuxDockerInvocation{
 readonly file:'/usr/bin/docker';readonly argv:readonly string[];readonly cwd:'/';readonly env:Readonly<Record<string,string>>;
 readonly input:string|null;readonly timeoutMs:number;readonly stdoutLimit:number;readonly stderrLimit:number;
}
export interface NegativeLinuxDockerCommandResult{readonly status:number|null;readonly signal:string|null;readonly closed:boolean;readonly stdout:string;readonly stderr:string}
export interface NegativeLinuxDockerSystem{
 readonly recipient:object;
 pin(this:object,path:string):Promise<Readonly<NegativeLinuxDockerToolPin>>;
 current(this:object,pin:Readonly<NegativeLinuxDockerToolPin>):unknown;
 run(this:object,pin:Readonly<NegativeLinuxDockerToolPin>,invocation:Readonly<NegativeLinuxDockerInvocation>):Promise<Readonly<NegativeLinuxDockerCommandResult>>;
 wait(this:object,timeoutMs:number):Promise<void>;
 release(this:object,pin:Readonly<NegativeLinuxDockerToolPin>):Promise<'CLOSED'|'UNKNOWN'>;
}
export interface NegativeLinuxDockerLegacy{
 /** 보호 approval graph가 고정한 원 R9 source에서만 공급한다. 임의 callable은 실행 권위가 아니다. */
 daemonInfoArgs():readonly string[];finalServerArgs(containerId:string):readonly string[];parseFinalServer(raw:string):boolean;
 bootstrapSql(database:string):string;roleMetadataSql():string;verifyPristineRoles(raw:string):unknown;verifyInstallerRoles(raw:string):unknown;
}
export type NegativeLinuxDockerPrepareResult=
 |Readonly<{status:'PREPARED';target:Readonly<NegativeOwnedTarget>;toolCloseConfirmed:true}>
 |Readonly<{status:'UNKNOWN';containerId:string|null;resourceMayExist:boolean;toolCloseConfirmed:boolean}>;

const invalid=():never=>{throw Error('IX01_0076_NEGATIVE_LINUX_DOCKER_INVALID');};
const unknown=():never=>{throw Error('IX01_0076_NEGATIVE_LINUX_DOCKER_UNKNOWN');};
const exact=(value:unknown,keys:readonly string[]):value is Record<string,unknown>=>{
 if(!value||typeof value!=='object'||Array.isArray(value)||types.isProxy(value))return false;
 const descriptors=Object.getOwnPropertyDescriptors(value),found=Reflect.ownKeys(descriptors);
 return found.length===keys.length&&found.every(key=>typeof key==='string'&&keys.includes(key))
  &&keys.every(key=>Object.hasOwn(descriptors,key)&&Object.hasOwn(descriptors[key]!,'value'));
};
const hash=(value:unknown,size:number):value is string=>typeof value==='string'&&value.length===size&&/^[a-f0-9]+$/.test(value);
const plain=(value:unknown):Record<string,any>=>{if(typeof value!=='string')return unknown();if(Buffer.byteLength(value)>maximumOutputBytes)return unknown();try{const parsed=parseWireJson(value);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||types.isProxy(parsed))return unknown();return parsed as Record<string,any>;}catch{return unknown();}};

function fixedBinding(raw:Readonly<NegativeLinuxDockerBinding>){
 if(!exact(raw,['schemaVersion','purpose','attemptId','sourceHead','planHash','approvalHash','approvalId','graphHash','issuedAt','expiresAt','namespace'])||!Object.isFrozen(raw)
  ||raw.schemaVersion!==1||raw.purpose!==bindingPurpose||!uuidV1(raw.attemptId)||!uuidV1(raw.approvalId)||![raw.sourceHead,raw.planHash,raw.approvalHash,raw.graphHash].every((value,index)=>hash(value,index?64:40))
  ||!Number.isSafeInteger(raw.issuedAt)||!Number.isSafeInteger(raw.expiresAt)||raw.issuedAt>=raw.expiresAt||raw.expiresAt-raw.issuedAt>1_800_000
  ||!recordV1(raw.namespace,['container','database','receipt','network'])||!Object.isFrozen(raw.namespace))invalid();
 const compact=raw.attemptId.replaceAll('-','');
 if(raw.namespace.container!=='anvil-ix01-0076-negative-'+compact||raw.namespace.database!=='ix01_0076_negative_'+compact
  ||raw.namespace.receipt!=='/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+raw.attemptId||raw.namespace.network!=='none')invalid();
 return compact;
}

function psql(containerId:string,database:string,input:string){
 return{args:['exec','-i','--user','999:999',containerId,'psql','--no-psqlrc','--no-password','--quiet','--no-align','--tuples-only','--host=/var/run/postgresql',
  '--username=anvil_v3_bootstrap','--dbname='+database,'--set=ON_ERROR_STOP=on','--set=VERBOSITY=verbose','--set=SHOW_CONTEXT=never','--set=ECHO=none','--file=-'],input};
}

export async function prepare0076NegativeLinuxDocker(
 rawBinding:Readonly<NegativeLinuxDockerBinding>,rawAuthority:Readonly<NegativeLinuxDockerAuthority>,rawLegacy:Readonly<NegativeLinuxDockerLegacy>,rawSystem:Readonly<NegativeLinuxDockerSystem>,
):Promise<Readonly<NegativeLinuxDockerPrepareResult>>{
 const compact=fixedBinding(rawBinding);
 const authorityKeys=['recipient','binding','assertClaimed','assertCurrent','wall','monotonic'] as const,legacyKeys=['daemonInfoArgs','finalServerArgs','parseFinalServer','bootstrapSql','roleMetadataSql','verifyPristineRoles','verifyInstallerRoles'] as const,
  systemKeys=['recipient','pin','current','run','wait','release'] as const;
 if(!exact(rawAuthority,authorityKeys)||!Object.isFrozen(rawAuthority)||rawAuthority.binding!==rawBinding||!rawAuthority.recipient||typeof rawAuthority.recipient!=='object'
  ||typeof rawAuthority.assertClaimed!=='function'||typeof rawAuthority.assertCurrent!=='function'||typeof rawAuthority.wall!=='function'||typeof rawAuthority.monotonic!=='function'
  ||!exact(rawLegacy,legacyKeys)||!Object.isFrozen(rawLegacy)||legacyKeys.some(key=>typeof rawLegacy[key]!=='function')
  ||!exact(rawSystem,systemKeys)||!Object.isFrozen(rawSystem)||!rawSystem.recipient||typeof rawSystem.recipient!=='object'
  ||typeof rawSystem.pin!=='function'||typeof rawSystem.current!=='function'||typeof rawSystem.run!=='function'||typeof rawSystem.wait!=='function'||typeof rawSystem.release!=='function')invalid();
 const authorityRecipient=rawAuthority.recipient,systemRecipient=rawSystem.recipient;
 if(rawAuthority.assertClaimed.call(authorityRecipient,rawBinding)!==undefined)invalid();
 if(attempted.has(rawBinding.attemptId)||attempted.size>=maximumAttempts)invalid();attempted.add(rawBinding.attemptId);
 const startWall=rawAuthority.wall.call(authorityRecipient),startMonotonic=rawAuthority.monotonic.call(authorityRecipient),duration=rawBinding.expiresAt-startWall;
 if(!Number.isSafeInteger(startWall)||!Number.isFinite(startMonotonic)||startMonotonic<0||startWall<rawBinding.issuedAt||startWall>=rawBinding.expiresAt)invalid();
 let lastWall=startWall,lastMonotonic=startMonotonic,pin:Readonly<NegativeLinuxDockerToolPin>|null=null,containerId:string|null=null,createStarted=false,
  prepared:Readonly<NegativeLinuxDockerPrepareResult>|null=null,closeConfirmed=false;
 const current=()=>{
  if(rawAuthority.assertCurrent.call(authorityRecipient,rawBinding)!==undefined)invalid();
  const wall=rawAuthority.wall.call(authorityRecipient),monotonic=rawAuthority.monotonic.call(authorityRecipient);
  if(!Number.isSafeInteger(wall)||!Number.isFinite(monotonic)||monotonic<lastMonotonic||wall<lastWall||wall>=rawBinding.expiresAt||monotonic-startMonotonic>=duration)invalid();
  lastWall=wall;lastMonotonic=monotonic;
 };
 const remaining=(cap=10_000)=>{current();const value=Math.floor(Math.min(cap,rawBinding.expiresAt-lastWall,duration-(lastMonotonic-startMonotonic)));if(value<1)unknown();return value;};
 try{
  current();pin=await rawSystem.pin.call(systemRecipient,dockerPath);current();
  if(!exact(pin,['path','realpath','kind','dev','ino','uid','mode','nlink','size','mtimeMs','ctimeMs','sha256','custody'])||!Object.isFrozen(pin)||pin.path!==dockerPath||pin.realpath!==dockerPath
   ||pin.kind!=='FILE'||pin.uid!==0||(pin.mode&0o777)!==0o755||pin.nlink!==1||!Number.isSafeInteger(pin.size)||pin.size<1||pin.size>maximumToolBytes
   ||![pin.dev,pin.ino].every(Number.isSafeInteger)||![pin.mtimeMs,pin.ctimeMs].every(Number.isFinite)||!hash(pin.sha256,64)||!pin.custody||typeof pin.custody!=='object')unknown();
  const tool=pin,base=Object.freeze(['--config',rawBinding.namespace.receipt+'/docker-config','--host',socket]),env=Object.freeze({PATH:'/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',HOME:rawBinding.namespace.receipt});
  const invoke=async(args:readonly string[],input:string|null=null,cap=10_000)=>{
   current();if(rawSystem.current.call(systemRecipient,tool)!==undefined)unknown();const invocation=Object.freeze({file:dockerPath,argv:Object.freeze([...base,...args]),cwd:'/' as const,env,input,
    timeoutMs:remaining(cap),stdoutLimit:maximumOutputBytes,stderrLimit:maximumOutputBytes}) satisfies NegativeLinuxDockerInvocation;
   const result=await rawSystem.run.call(systemRecipient,tool,invocation);current();if(rawSystem.current.call(systemRecipient,tool)!==undefined)unknown();
   if(!exact(result,['status','signal','closed','stdout','stderr'])||result.status!==0||result.signal!==null||result.closed!==true||typeof result.stdout!=='string'||result.stderr!==''
    ||Buffer.byteLength(result.stdout)>maximumOutputBytes)unknown();return result.stdout;
  };
  const daemonRaw=await invoke(rawLegacy.daemonInfoArgs()),daemon=plain(daemonRaw);
  if(!exact(daemon,['ID','Name'])||daemon.ID!==currentProfile.daemon||daemon.Name!=='SINSAN')unknown();
  const image=plain(await invoke(['image','inspect','--format','{"id":{{json .Id}},"volumes":{{json .Config.Volumes}}}',currentNetworkProbeContract.image]));
  if(!exact(image,['id','volumes'])||image.id!==currentNetworkProbeContract.image||!exact(image.volumes,['/var/lib/postgresql/data']))unknown();
  if((await invoke(['container','ls','-a','--filter','name=^/'+rawBinding.namespace.container+'$','--format','{{.ID}}'])).trim()!=='')unknown();
  const labels=['--label','anvil.owner='+owner,'--label','anvil.instance='+compact,'--label','anvil.plan='+rawBinding.planHash],tmpfs=currentNetworkProbeContract.tmpfs;
  createStarted=true;containerId=(await invoke(['create','--pull','never','--name',rawBinding.namespace.container,'--network','none','--user','999:999','--read-only','--cap-drop','ALL',
   '--security-opt','no-new-privileges','--log-driver','none','--pids-limit','64','--memory','512m','--cpus','1',...Object.entries(tmpfs).flatMap(([path,value])=>['--tmpfs',path+':'+value]),...labels,
   '--env','POSTGRES_USER=anvil_v3_bootstrap','--env','POSTGRES_DB='+rawBinding.namespace.database,'--env','POSTGRES_HOST_AUTH_METHOD=trust','--env','POSTGRES_INITDB_ARGS=--auth-local=trust --auth-host=reject',
   currentNetworkProbeContract.image,'postgres','-c','listen_addresses=','-c','log_statement=none','-c','log_min_error_statement=fatal'])).trim();
  if(!hash(containerId,64))unknown();
  const inspectArgs=['container','inspect','--format',currentNetworkProbeContract.containerFormat,containerId] as const,scope={containerId,containerName:rawBinding.namespace.container,image:currentNetworkProbeContract.image,
   labels:{'anvil.owner':owner,'anvil.instance':compact,'anvil.plan':rawBinding.planHash}};
  const created=plain(await invoke(inspectArgs));verifyContainerObservation(created,scope);if(created.running!==false||!currentCreatedUnallocatedNone(created))unknown();
  if((await invoke(['start',containerId])).trim()!==containerId)unknown();const runningRaw=await invoke(inspectArgs),running=plain(runningRaw);verifyContainerObservation(running,scope);
  if(running.running!==true||!exact(running.networks,['none']))unknown();const none=running.networks.none;
  if(!none||typeof none!=='object'||Array.isArray(none)||!hash(none.NetworkID,64)||none.IPAddress!=='')unknown();
  let ready=false;for(let count=0;count<40;count++){
   if(rawLegacy.parseFinalServer(await invoke(rawLegacy.finalServerArgs(containerId)))){await invoke(['exec','--user','999:999',containerId,'pg_isready','--host=/var/run/postgresql','--username=anvil_v3_bootstrap','--dbname='+rawBinding.namespace.database]);ready=true;break;}
   await rawSystem.wait.call(systemRecipient,250);current();
  }if(!ready)unknown();
  const role=async()=>invoke(psql(containerId!,rawBinding.namespace.database,rawLegacy.roleMetadataSql()).args,rawLegacy.roleMetadataSql());
  rawLegacy.verifyPristineRoles(await role());const bootstrap=rawLegacy.bootstrapSql(rawBinding.namespace.database);await invoke(psql(containerId,rawBinding.namespace.database,bootstrap).args,bootstrap,30_000);
  rawLegacy.verifyInstallerRoles(await role());
  const finalRunningRaw=await invoke(inspectArgs),finalRunning=plain(finalRunningRaw);verifyContainerObservation(finalRunning,scope);
  if(finalRunning.running!==true||!exact(finalRunning.networks,['none']))unknown();const finalNone=finalRunning.networks.none;
  if(!finalNone||typeof finalNone!=='object'||Array.isArray(finalNone)||!hash(finalNone.NetworkID,64)||finalNone.IPAddress!=='')unknown();
  const target=Object.freeze({schemaVersion:1,purpose:'IX01_0076_NEGATIVE_OWNED_TARGET',attemptId:rawBinding.attemptId,sourceHead:rawBinding.sourceHead,planHash:rawBinding.planHash,
   graphHash:rawBinding.graphHash,namespace:rawBinding.namespace,containerId}) satisfies NegativeOwnedTarget;
  const containerPin=Object.freeze({recipient:authorityRecipient,target,startedWall:startWall,startedMonotonic:startMonotonic,expiresAt:rawBinding.expiresAt,
   current(this:object,found:NegativeOwnedTarget){if(this!==authorityRecipient||found!==target)invalid();current();},wall(this:object){if(this!==authorityRecipient)invalid();return lastWall;},
   monotonic(this:object){if(this!==authorityRecipient)invalid();return lastMonotonic;},async inspect(this:object,found:NegativeOwnedTarget){if(this!==authorityRecipient||found!==target)invalid();return Object.freeze({daemonRaw,containerRaw:finalRunningRaw,closed:true});}});
  await verify0076NegativeLinuxContainerSource(target,containerPin);prepared=Object.freeze({status:'PREPARED',target,toolCloseConfirmed:true});
 }catch{/* raw 오류를 반환하지 않고 원 resource/tool 불명을 보존한다. */}
 finally{
  if(pin!==null)try{closeConfirmed=await rawSystem.release.call(systemRecipient,pin)==='CLOSED';}catch{closeConfirmed=false;}
 }
 if(prepared!==null&&closeConfirmed)return prepared;
 return Object.freeze({status:'UNKNOWN',containerId,resourceMayExist:createStarted,toolCloseConfirmed:closeConfirmed});
}
