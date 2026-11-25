import {closeSync,fstatSync,fsyncSync,lstatSync,openSync,readSync,realpathSync,writeSync,type Stats} from 'node:fs';
import {types} from 'node:util';
import {canonicalJson,contentHash,parseWireJson} from '../contracts/canonical.ts';
import {recordV1,uuidV1} from '../contracts/runtime/validation-v1.ts';
import {
 current0076NegativeContract as stageContract,run0076AtomicityNegativeStage,
 type NegativeStageInput,type NegativeStagePorts,type NegativeStageResult,
} from './qa-ix01-0076-atomicity-negative.ts';
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

const invalid=():never=>{throw Error('IX01_0076_NEGATIVE_LINUX_ENTRY_INVALID');};
const stageKeys=['now','monotonic','assertCurrent','claim','prepare','install','appendLedger','sentinel','catalog'] as const;
const retainedNativeJournalHandles=new Map<object,Readonly<{recipient:object;fd:number}>>();

export type NegativeLinuxEntrySystems=
 | Readonly<{mode:'SYNTHETIC_SOURCE_ONLY';reader:NegativeLinuxProtectedReaderSystem;journal:NegativeLinuxJournalSystem;stage:NegativeStagePorts}>
 | Readonly<{mode:'PROTECTED_NATIVE';stage:NegativeStagePorts}>;

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
 if(raw.mode==='PROTECTED_NATIVE'){
  if(!exact(raw,['mode','stage']))invalid();return{mode:raw.mode,stage:stageShape(raw.stage)} as const;
 }
 return invalid();
}
function stat(raw:Stats){
 const kind=raw.isFile()?'FILE':raw.isDirectory()?'DIRECTORY':invalid();
 return Object.freeze({kind,dev:raw.dev,ino:raw.ino,uid:raw.uid,mode:raw.mode,nlink:raw.nlink,size:raw.size,mtimeMs:raw.mtimeMs,ctimeMs:raw.ctimeMs});
}
/** 보호 approval 소비 뒤에만 생성되는 private POSIX 공급자다. 생성 자체는 I/O를 수행하지 않는다. */
function nativeJournalSystem():NegativeLinuxJournalSystem{
 const recipient=Object.freeze(Object.create(null)),timers=new WeakMap<object,ReturnType<typeof setTimeout>>();
 const descriptor=(handle:object)=>{const found=retainedNativeJournalHandles.get(handle);if(!found||found.recipient!==recipient)return invalid();return found.fd;};
 return Object.freeze({recipient,
  lstat(this:object,path:string){if(this!==recipient)invalid();return stat(lstatSync(path));},
  realpath(this:object,path:string){if(this!==recipient)invalid();return realpathSync.native(path);},
  open(this:object,path:string,flags:number,mode?:number){if(this!==recipient)invalid();const fd=openSync(path,flags,mode),handle=Object.freeze(Object.create(null));retainedNativeJournalHandles.set(handle,Object.freeze({recipient,fd}));return handle;},
  fstat(this:object,handle:object){if(this!==recipient)invalid();return stat(fstatSync(descriptor(handle)));},
  write(this:object,handle:object,bytes:Uint8Array,offset:number){if(this!==recipient)invalid();return writeSync(descriptor(handle),bytes,0,bytes.byteLength,offset);},
  read(this:object,handle:object,buffer:Uint8Array,offset:number,length:number){if(this!==recipient)invalid();return readSync(descriptor(handle),buffer,offset,length,null);},
  sync(this:object,handle:object){if(this!==recipient)invalid();fsyncSync(descriptor(handle));},
  close(this:object,handle:object){if(this!==recipient)invalid();const fd=descriptor(handle);closeSync(fd);retainedNativeJournalHandles.delete(handle);},
  schedule(this:object,callback:()=>void,timeoutMs:number){if(this!==recipient)invalid();const token=Object.freeze(Object.create(null)),timer=setTimeout(callback,timeoutMs);timers.set(token,timer);return token;},
  cancel(this:object,token:object){if(this!==recipient)invalid();const timer=timers.get(token)??invalid();clearTimeout(timer);timers.delete(token);},
 });
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

/**
 * 보호 reader가 원 approval를 검증한 뒤에만 private POSIX journal 공급자를 만든다. PROTECTED_NATIVE는 Linux/euid 1000만
 * 최소 검산하며, 이후 exact launcher가 제공해야 할 원 host/source 권위 증거를 대신하지 않는다. child, CLI, Docker/PG 실행은 연결하지 않는다.
 */
export async function run0076NegativeLinuxEntry(
 rawSelection:Readonly<NegativeLinuxApprovalSelection>,rawAuthority:Readonly<NegativeLinuxProtectedReaderAuthority>,rawSystems:Readonly<NegativeLinuxEntrySystems>,
):Promise<Readonly<NegativeStageResult>>{
 const authority=authorityShape(rawAuthority),systems=systemsShape(rawSystems);
 if(rawSelection!==authority.selection)invalid();
 const unchanged=()=>authority.keys.every(key=>rawAuthority[key]===({recipient:authority.recipient,selection:authority.selection,sourceRoot:authority.sourceRoot,receiptRoot:authority.receiptRoot,uid:1000,now:authority.now,monotonic:authority.monotonic,assertCurrent:authority.current} as const)[key])
  &&rawSystems.mode===systems.mode&&stageKeys.every(key=>rawSystems.stage[key]===systems.stage[key])
  &&(systems.mode==='PROTECTED_NATIVE'||rawSystems.mode==='SYNTHETIC_SOURCE_ONLY'&&rawSystems.reader===systems.reader&&rawSystems.journal===systems.journal);
 const current=()=>{if(!unchanged()||authority.current.call(authority.recipient,authority.selection)!==undefined)invalid();};
 if(systems.mode==='PROTECTED_NATIVE')requireNativeHostBoundary();
 const reader=systems.mode==='SYNTHETIC_SOURCE_ONLY'?create0076NegativeLinuxProtectedReader(rawAuthority,systems.reader):create0076NegativeLinuxProtectedReader(rawAuthority);
 const projection=await verify0076NegativeLinuxApproval(rawSelection,reader);
 return use0076NegativeLinuxProtectedStageInput(projection,async(input,fresh)=>{
  const entryCurrent=()=>{fresh();current();};entryCurrent();const binding=protectedBinding(input,projection),receiptPath=binding.namespace.receipt+'/claim-v1.json';
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
  const rawStage=rawSystems.stage,fixedStage=systems.stage,journalSystem=systems.mode==='SYNTHETIC_SOURCE_ONLY'?systems.journal:nativeJournalSystem();
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
  return run0076AtomicityNegativeStage(input,claimed);
 });
}
