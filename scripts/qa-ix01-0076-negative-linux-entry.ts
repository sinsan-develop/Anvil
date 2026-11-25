import {types} from 'node:util';
import {canonicalJson,contentHash,parseWireJson} from '../contracts/canonical.ts';
import {recordV1,uuidV1} from '../contracts/runtime/validation-v1.ts';
import {
 current0076NegativeContract as stageContract,run0076AtomicityNegativeStage,
 type NegativeStageInput,type NegativeStagePorts,type NegativeStageResult,
} from './qa-ix01-0076-atomicity-negative.ts';
import {create0076AtomicityNegativeReceiver,load0076NegativeReceiverGraph,type NegativeReceiverPorts} from './qa-ix01-0076-atomicity-negative-receiver.ts';
import {create0076NegativeClaim,current0076NegativeClaimContract,type NegativeClaimAuthorityPorts} from './qa-ix01-0076-negative-claim.ts';
import {
 use0076NegativeLinuxProtectedStageInput,verify0076NegativeLinuxApproval,
 type NegativeLinuxApprovalProjection,type NegativeLinuxApprovalSelection,
} from './qa-ix01-0076-negative-linux-approval.ts';
import {
 create0076NegativeLinuxProtectedReader,
 type NegativeLinuxProtectedReaderAuthority,type NegativeLinuxProtectedReaderSystem,
} from './qa-ix01-0076-negative-linux-protected-reader.ts';
import {create0076NegativeLinuxJournal,type NegativeLinuxJournalAuthority,type NegativeLinuxJournalSystem} from './qa-ix01-0076-negative-linux-journal.ts';
import {load0076NegativeLinuxR9} from './qa-ix01-0076-negative-linux-r9.ts';
import {prepare0076NegativeLinuxDockerWithToolHandoff,type NegativeLinuxDockerAuthority,type NegativeLinuxDockerBinding} from './qa-ix01-0076-negative-linux-docker.ts';
import {
 bind0076NegativeLinuxNativeDockerOwner,bind0076NegativeLinuxNativeDockerProtectedPrior,close0076NegativeLinuxNativeDockerTransferredOwner,create0076NegativeLinuxNativeDockerForTransfer,create0076NegativeLinuxReadOnlyDockerSystem,
 type NegativeLinuxNativeDockerOwnerPorts,type NegativeLinuxNativeDockerSystem,
} from './qa-ix01-0076-negative-linux-native-docker.ts';
import {create0076NegativeLinuxSchemaStage,type NegativeLinuxSchemaCommandPorts,type NegativeLinuxSchemaOwnerPorts} from './qa-ix01-0076-negative-linux-schema-stage.ts';
import {create0076NegativeLinuxSqlDelivery,type NegativeLinuxSqlDelivery} from './qa-ix01-0076-negative-linux-sql-delivery.ts';
import {bind0076NegativePsqlTarget,create0076NegativePsqlReceiver} from './qa-ix01-0076-negative-psql.ts';

const invalid=():never=>{throw Error('IX01_0076_NEGATIVE_LINUX_ENTRY_INVALID');};
const stageKeys=['now','monotonic','assertCurrent','claim','prepare','install','appendLedger','sentinel','catalog'] as const;

export type NegativeLinuxEntrySystems=
 | Readonly<{mode:'SYNTHETIC_SOURCE_ONLY';reader:NegativeLinuxProtectedReaderSystem;journal:NegativeLinuxJournalSystem;stage:NegativeStagePorts}>
 | Readonly<{mode:'SYNTHETIC_NATIVE_ASSEMBLY';reader:NegativeLinuxProtectedReaderSystem;journal:NegativeLinuxJournalSystem;native:NegativeLinuxNativeDockerSystem}>
 | Readonly<{mode:'PROTECTED_NATIVE'}>;

function exact(value:unknown,keys:readonly string[]){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 const descriptors=Object.getOwnPropertyDescriptors(value);return Reflect.ownKeys(descriptors).length===keys.length&&keys.every(key=>!!descriptors[key]?.enumerable&&Object.hasOwn(descriptors[key]!,'value'));
}
function authorityShape(raw:Readonly<NegativeLinuxProtectedReaderAuthority>){
 const keys=['recipient','selection','sourceRoot','receiptRoot','uid','now','monotonic','assertCurrent'] as const;
 if(!exact(raw,keys)||!Object.isFrozen(raw))invalid();const d=Object.getOwnPropertyDescriptors(raw),recipient=d.recipient!.value as object,selection=d.selection!.value as NegativeLinuxApprovalSelection;
 if(!recipient||typeof recipient!=='object'||types.isProxy(recipient)||!Object.isFrozen(recipient)||!selection||typeof selection!=='object'||types.isProxy(selection)||!Object.isFrozen(selection)
  ||typeof d.sourceRoot!.value!=='string'||typeof d.receiptRoot!.value!=='string'||d.uid!.value!==1000||typeof d.now!.value!=='function'||typeof d.monotonic!.value!=='function'||typeof d.assertCurrent!.value!=='function')invalid();
 return{keys,recipient,selection,sourceRoot:d.sourceRoot!.value as string,receiptRoot:d.receiptRoot!.value as string,
  now:d.now!.value as NegativeLinuxProtectedReaderAuthority['now'],monotonic:d.monotonic!.value as NegativeLinuxProtectedReaderAuthority['monotonic'],current:d.assertCurrent!.value as NegativeLinuxProtectedReaderAuthority['assertCurrent']};
}
function stageShape(raw:NegativeStagePorts){
 if(!exact(raw,stageKeys)||!Object.isFrozen(raw))invalid();const d=Object.getOwnPropertyDescriptors(raw);for(const key of stageKeys)if(typeof d[key]!.value!=='function')invalid();
 return Object.fromEntries(stageKeys.map(key=>[key,d[key]!.value])) as unknown as NegativeStagePorts;
}
function systemsShape(raw:Readonly<NegativeLinuxEntrySystems>):NegativeLinuxEntrySystems{
 if(!raw||typeof raw!=='object'||types.isProxy(raw)||!Object.isFrozen(raw))invalid();
 if(raw.mode==='SYNTHETIC_SOURCE_ONLY'){
  if(!exact(raw,['mode','reader','journal','stage'])||!raw.reader||typeof raw.reader!=='object'||!raw.journal||typeof raw.journal!=='object')invalid();
  return{mode:raw.mode,reader:raw.reader,journal:raw.journal,stage:stageShape(raw.stage)} as const;
 }
 if(raw.mode==='SYNTHETIC_NATIVE_ASSEMBLY'){
  if(!exact(raw,['mode','reader','journal','native'])||!raw.reader||typeof raw.reader!=='object'||!raw.journal||typeof raw.journal!=='object'||!raw.native||typeof raw.native!=='object')invalid();
  return raw;
 }
 if(raw.mode==='PROTECTED_NATIVE'){
  if(!exact(raw,['mode']))invalid();return raw;
 }
 return invalid();
}
function requireNativeHostBoundary(){
 if(process.platform!=='linux'||typeof process.geteuid!=='function'||process.geteuid()!==1000)invalid();
}
function protectedBinding(raw:Readonly<NegativeStageInput>,projection:Readonly<NegativeLinuxApprovalProjection>){
 if(typeof raw.planRaw!=='string'||typeof raw.approvalRaw!=='string'||contentHash(raw.planRaw)!==projection.planHash||contentHash(raw.approvalRaw)!==projection.approvalHash)invalid();
 let plan:unknown,approval:unknown;try{plan=parseWireJson(raw.planRaw);approval=parseWireJson(raw.approvalRaw);}catch{invalid();}
 if(canonicalJson(plan)!==raw.planRaw||canonicalJson(approval)!==raw.approvalRaw
  ||!recordV1(plan,['schemaVersion','purpose','attemptId','sourceHead','graphHash','issuedAt','expiresAt','namespace','sourceManifestHash','sourceSha256','executionSha256','sentinelSqlHash','catalogSqlHash'])
  ||!recordV1(approval,['schemaVersion','purpose','decision','approvalId','attemptId','sourceHead','planHash','graphHash','issuedAt','expiresAt']))invalid();
 const p=plan as Record<string,any>,a=approval as Record<string,any>;
 if(p.schemaVersion!==1||p.purpose!==stageContract.purpose||p.attemptId!==projection.attemptId||p.sourceHead!==projection.sourceHead||p.graphHash!==projection.graphHash
  ||!Number.isSafeInteger(p.issuedAt)||!Number.isSafeInteger(p.expiresAt)||p.issuedAt>=p.expiresAt||p.expiresAt-p.issuedAt>1800000
  ||!recordV1(p.namespace,['container','database','receipt','network'])||p.namespace.network!=='none'||p.namespace.receipt!=='/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+p.attemptId
  ||a.schemaVersion!==1||a.purpose!==stageContract.purpose+'_APPROVAL'||a.decision!=='ALLOW_ONE_ISOLATED_NEGATIVE_STAGE'||!uuidV1(a.approvalId)
  ||a.attemptId!==p.attemptId||a.sourceHead!==p.sourceHead||a.planHash!==projection.planHash||a.graphHash!==p.graphHash||a.issuedAt!==p.issuedAt||a.expiresAt!==p.expiresAt)invalid();
 return Object.freeze({purpose:stageContract.purpose,attemptId:p.attemptId as string,sourceHead:p.sourceHead as string,planHash:projection.planHash,approvalHash:projection.approvalHash,
  approvalId:a.approvalId as string,graphHash:p.graphHash as string,issuedAt:p.issuedAt as number,expiresAt:p.expiresAt as number,namespace:Object.freeze({...p.namespace})});
}

async function nativeAssembly(
 input:Readonly<NegativeStageInput>,r9:Uint8Array,receiverSource:Uint8Array,binding:ReturnType<typeof protectedBinding>,nativeSystem:NegativeLinuxNativeDockerSystem,
 entryCurrent:()=>void,wall:()=>number,monotonic:()=>number,
){
 const loaded=await load0076NegativeLinuxR9(r9,input),prior=bind0076NegativeLinuxNativeDockerProtectedPrior(input.historicalTsv,input.sql),dockerBinding=Object.freeze({...binding,schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_LINUX_DOCKER_BINDING' as const}) satisfies Readonly<NegativeLinuxDockerBinding>;
 const materials=Object.freeze({roleSql:loaded.legacy.roleMetadataSql(),bootstrapSql:loaded.legacy.bootstrapSql(binding.namespace.database),finalServerRaw:'postgres\n' as const,
  priorSql:Object.freeze(input.sql.slice(0,106).map(row=>Object.freeze({id:row.id,path:row.path,bytes:row.bytes})))});
 const ownerRecipient=Object.freeze(Object.create(null)),owner=Object.freeze({recipient:ownerRecipient,binding:dockerBinding,materials,
  assertCurrent(this:object,found:Readonly<NegativeLinuxDockerBinding>){if(this!==ownerRecipient||found!==dockerBinding)invalid();entryCurrent();},
  wall(this:object){if(this!==ownerRecipient)invalid();entryCurrent();return wall();},monotonic(this:object){if(this!==ownerRecipient)invalid();entryCurrent();return monotonic();},
 }) satisfies NegativeLinuxNativeDockerOwnerPorts;
 let stageBinding:Parameters<NegativeLinuxSchemaOwnerPorts['claim']>[0]|undefined,durableClaimed=false;
 const acceptBinding=(found:Parameters<NegativeLinuxSchemaOwnerPorts['claim']>[0])=>{
  if(canonicalJson(found)!==canonicalJson(binding))invalid();
  if(stageBinding===undefined)stageBinding=found;else if(found!==stageBinding)invalid();
 };
 const native=create0076NegativeLinuxNativeDockerForTransfer(bind0076NegativeLinuxNativeDockerOwner(owner),nativeSystem),authorityRecipient=Object.freeze(Object.create(null)),authority=Object.freeze({recipient:authorityRecipient,binding:dockerBinding,
  assertClaimed(this:object,found:Readonly<NegativeLinuxDockerBinding>){if(this!==authorityRecipient||found!==dockerBinding||!durableClaimed)invalid();entryCurrent();},
  assertCurrent(this:object,found:Readonly<NegativeLinuxDockerBinding>){if(this!==authorityRecipient||found!==dockerBinding)invalid();entryCurrent();},
  wall(this:object){if(this!==authorityRecipient)invalid();entryCurrent();return wall();},monotonic(this:object){if(this!==authorityRecipient)invalid();entryCurrent();return monotonic();},
 }) satisfies NegativeLinuxDockerAuthority;
 const graph=load0076NegativeReceiverGraph(input.graphRaw,receiverSource),schemaRecipient=Object.freeze(Object.create(null));let delivery:Readonly<NegativeLinuxSqlDelivery>|undefined,receiver:Readonly<NegativeReceiverPorts>|undefined,originalTarget:string|undefined;
 let prepareAttempted=false,prepareUnknown=false,transferred:Readonly<{owner:object;target:Parameters<typeof close0076NegativeLinuxNativeDockerTransferredOwner>[1]}>|undefined;
 const commands=Object.freeze({recipient:schemaRecipient,async execute(this:object,request:Parameters<NegativeLinuxSchemaCommandPorts['execute']>[0]){if(this!==schemaRecipient||!delivery)invalid();const fixed=delivery!;return fixed.commands.execute.call(fixed.commands.recipient,request);}}) satisfies NegativeLinuxSchemaCommandPorts;
 const schemaOwner=Object.freeze({recipient:schemaRecipient,now(this:object){if(this!==schemaRecipient)invalid();entryCurrent();return wall();},monotonic(this:object){if(this!==schemaRecipient)invalid();entryCurrent();return monotonic();},
  assertCurrent(this:object,found:Parameters<NegativeLinuxSchemaOwnerPorts['assertCurrent']>[0],target:Parameters<NegativeLinuxSchemaOwnerPorts['assertCurrent']>[1]){if(this!==schemaRecipient)invalid();acceptBinding(found);entryCurrent();if(target!==null){if(!originalTarget||canonicalJson(target)!==originalTarget)invalid();if(!receiver&&delivery){const fixed=delivery!;receiver=create0076NegativePsqlReceiver(bind0076NegativePsqlTarget(target,fixed.psqlOwner),fixed.psqlProcess);}}},
  async claim(this:object,found:Parameters<NegativeLinuxSchemaOwnerPorts['claim']>[0]){if(this!==schemaRecipient||durableClaimed)invalid();acceptBinding(found);entryCurrent();durableClaimed=true;return'CLAIMED' as const;},
  async prepare(this:object,found:Parameters<NegativeLinuxSchemaOwnerPorts['prepare']>[0]){if(this!==schemaRecipient||!durableClaimed||delivery||prepareAttempted)invalid();acceptBinding(found);entryCurrent();prepareAttempted=true;prepareUnknown=true;
   const prepared=await prepare0076NegativeLinuxDockerWithToolHandoff(dockerBinding,authority,loaded.legacy,native.system,native.handoff);
   if(prepared.status==='PREPARED')transferred=Object.freeze({owner:prepared.toolOwner,target:prepared.target});else prepareUnknown=!prepared.toolCloseConfirmed;
   entryCurrent();if(prepared.status!=='PREPARED')return invalid();originalTarget=canonicalJson(prepared.target);delivery=create0076NegativeLinuxSqlDelivery(prepared.toolOwner,prepared.target,loaded.failureParser,prior);return prepared.target;},
 }) satisfies NegativeLinuxSchemaOwnerPorts;
 const base=create0076NegativeLinuxSchemaStage(schemaOwner,commands),receiverFacadeRecipient=Object.freeze(Object.create(null)),receiverFacade=Object.freeze({recipient:receiverFacadeRecipient,
  schedule(callback:()=>void,timeoutMs:number){if(!receiver)invalid();const fixed=receiver!;return fixed.schedule(callback,timeoutMs);},
  execute(this:object,request:Parameters<NegativeReceiverPorts['execute']>[0],signal:AbortSignal){if(this!==receiverFacadeRecipient||!receiver)invalid();const fixed=receiver!;return fixed.execute.call(fixed.recipient,request,signal);},
 }) satisfies NegativeReceiverPorts;
 return Object.freeze({stage:create0076AtomicityNegativeReceiver(graph,loaded.failureParser,base,receiverFacade),async close(){
  if(delivery)return delivery.close();if(transferred)return close0076NegativeLinuxNativeDockerTransferredOwner(transferred.owner,transferred.target);
  return prepareAttempted&&prepareUnknown?'UNKNOWN' as const:'CLOSED' as const;
 }});
}

/**
 * 보호 reader가 원 approval와 실제 local import closure를 검증한다. PROTECTED_NATIVE는 Linux/euid 1000과 read-only Docker
 * source 조립까지만 확인하고 claim/container/child 효과 전에 닫힌다. 실제 launcher·same-FD exec·정리 영수증은 아직 연결하지 않는다.
 */
export async function run0076NegativeLinuxEntry(
 rawSelection:Readonly<NegativeLinuxApprovalSelection>,rawAuthority:Readonly<NegativeLinuxProtectedReaderAuthority>,rawSystems:Readonly<NegativeLinuxEntrySystems>,
):Promise<Readonly<NegativeStageResult>>{
 const authority=authorityShape(rawAuthority),systems=systemsShape(rawSystems);
 if(rawSelection!==authority.selection)invalid();
 const unchanged=()=>{
  if(!authority.keys.every(key=>rawAuthority[key]===({recipient:authority.recipient,selection:authority.selection,sourceRoot:authority.sourceRoot,receiptRoot:authority.receiptRoot,uid:1000,now:authority.now,monotonic:authority.monotonic,assertCurrent:authority.current} as const)[key])||rawSystems.mode!==systems.mode)return false;
  if(systems.mode==='PROTECTED_NATIVE')return rawSystems.mode==='PROTECTED_NATIVE';
  if(systems.mode==='SYNTHETIC_SOURCE_ONLY')return rawSystems.mode==='SYNTHETIC_SOURCE_ONLY'&&rawSystems.reader===systems.reader&&rawSystems.journal===systems.journal&&stageKeys.every(key=>rawSystems.stage[key]===systems.stage[key]);
  return rawSystems.mode==='SYNTHETIC_NATIVE_ASSEMBLY'&&rawSystems.reader===systems.reader&&rawSystems.journal===systems.journal&&rawSystems.native===systems.native;
 };
 const current=()=>{if(!unchanged()||authority.current.call(authority.recipient,authority.selection)!==undefined)invalid();};
 if(systems.mode==='PROTECTED_NATIVE')requireNativeHostBoundary();
 const reader=systems.mode==='PROTECTED_NATIVE'?create0076NegativeLinuxProtectedReader(rawAuthority):create0076NegativeLinuxProtectedReader(rawAuthority,systems.reader);
 const projection=await verify0076NegativeLinuxApproval(rawSelection,reader);
 return use0076NegativeLinuxProtectedStageInput(projection,async(input,fresh,r9,receiverSource)=>{
  const entryCurrent=()=>{fresh();current();};entryCurrent();const binding=protectedBinding(input,projection),receiptPath=binding.namespace.receipt+'/claim-v1.json';
  if(systems.mode==='PROTECTED_NATIVE'){
   const blocked=await nativeAssembly(input,r9,receiverSource,binding,create0076NegativeLinuxReadOnlyDockerSystem(),entryCurrent,()=>authority.now.call(authority.recipient),()=>authority.monotonic.call(authority.recipient));
   entryCurrent();const result=await run0076AtomicityNegativeStage(input),closeStatus=await blocked.close();if(closeStatus!=='CLOSED')invalid();return result;
  }
  let authorityRead=false;const claimRecipient=Object.freeze(Object.create(null));
  const claimAuthorityDefinition:NegativeClaimAuthorityPorts={recipient:claimRecipient,async read(this:object,found){
   if(this!==claimRecipient||authorityRead||canonicalJson(found)!==canonicalJson(binding))invalid();authorityRead=true;entryCurrent();
   return Object.freeze({schemaVersion:1 as const,purpose:current0076NegativeClaimContract.authorityPurpose,decision:'ALLOW_ONE_ISOLATED_NEGATIVE_STAGE' as const,
    attemptId:binding.attemptId,approvalId:binding.approvalId,sourceHead:binding.sourceHead,planHash:binding.planHash,approvalHash:binding.approvalHash,
    graphHash:binding.graphHash,issuedAt:binding.issuedAt,expiresAt:binding.expiresAt,receiptPath});
  }};const claimAuthority=Object.freeze(claimAuthorityDefinition);
  const journalRecipient=Object.freeze(Object.create(null));
  const journalAuthority=Object.freeze({recipient:journalRecipient,approval:projection,receiptRoot:binding.namespace.receipt,uid:1000 as const,
   assertCurrent(this:object,found:Readonly<NegativeLinuxApprovalProjection>){if(this!==journalRecipient||found!==projection)invalid();entryCurrent();},
  }) satisfies NegativeLinuxJournalAuthority;
  const assembly=systems.mode==='SYNTHETIC_NATIVE_ASSEMBLY'?await nativeAssembly(input,r9,receiverSource,binding,systems.native,entryCurrent,()=>authority.now.call(authority.recipient),()=>authority.monotonic.call(authority.recipient)):undefined;
  const sourceOnly=systems.mode==='SYNTHETIC_SOURCE_ONLY';
  const rawStage=sourceOnly?(rawSystems as Extract<NegativeLinuxEntrySystems,{mode:'SYNTHETIC_SOURCE_ONLY'}>).stage:assembly!.stage;
  const fixedStage=sourceOnly?systems.stage:assembly!.stage,journalSystem=systems.journal;
  const stageCurrent=()=>{entryCurrent();if(stageKeys.some(key=>rawStage[key]!==fixedStage[key]))invalid();};
  const baseDefinition:NegativeStagePorts={
   now(){stageCurrent();return authority.now.call(authority.recipient);},monotonic(){stageCurrent();return authority.monotonic.call(authority.recipient);},
   assertCurrent(found,target){stageCurrent();return fixedStage.assertCurrent.call(rawStage,found,target);},
   claim(found){stageCurrent();return fixedStage.claim.call(rawStage,found);},prepare(found){stageCurrent();return fixedStage.prepare.call(rawStage,found);},
   install(target,bytes,row,timeoutMs){stageCurrent();return fixedStage.install.call(rawStage,target,bytes,row,timeoutMs);},
   appendLedger(target,row,timeoutMs){stageCurrent();return fixedStage.appendLedger.call(rawStage,target,row,timeoutMs);},
   sentinel(target,sql,timeoutMs){stageCurrent();return fixedStage.sentinel.call(rawStage,target,sql,timeoutMs);},
   catalog(target,sql,timeoutMs){stageCurrent();return fixedStage.catalog.call(rawStage,target,sql,timeoutMs);},
  };const base=Object.freeze(baseDefinition);
  const journal=create0076NegativeLinuxJournal(journalAuthority,journalSystem),claimed=create0076NegativeClaim(base,claimAuthority,journal);
  const connected=Object.freeze({...claimed,async claim(found:Parameters<NegativeStagePorts['claim']>[0]){
   const recorded=await claimed.claim(found);if(recorded!=='CLAIMED'||!assembly)return recorded;
   try{return await base.claim(found);}catch{return'UNKNOWN' as const;}
  }});
  const result=await run0076AtomicityNegativeStage(input,connected),closeStatus=assembly?await assembly.close():'CLOSED';if(closeStatus!=='CLOSED')invalid();return result;
 });
}
