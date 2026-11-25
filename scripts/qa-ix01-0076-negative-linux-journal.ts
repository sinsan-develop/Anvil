import {constants} from 'node:fs';
import {types} from 'node:util';
import {canonicalJson,parseWireJson} from '../contracts/canonical.ts';
import {hashV1,recordV1,uuidV1} from '../contracts/runtime/validation-v1.ts';
import {current0076NegativeClaimContract,type NegativeClaimJournalPorts} from './qa-ix01-0076-negative-claim.ts';
import {current0076NegativeLinuxApprovalContract,type NegativeLinuxApprovalProjection} from './qa-ix01-0076-negative-linux-approval.ts';

const receiptParent='/home/daon/.local/share/anvil-v3-qa-receipts';
const invalid=():never=>{throw Error('IX01_0076_NEGATIVE_LINUX_JOURNAL_INVALID');};
const retainedUnknownHandles=new Set<object>();

export interface NegativeLinuxJournalStat{
 readonly kind:'FILE'|'DIRECTORY';readonly dev:number;readonly ino:number;readonly uid:number;readonly mode:number;
 readonly nlink:number;readonly size:number;readonly mtimeMs:number;readonly ctimeMs:number;
}
export interface NegativeLinuxJournalAuthority{
 readonly recipient:object;readonly approval:Readonly<NegativeLinuxApprovalProjection>;readonly receiptRoot:string;readonly uid:1000;
 assertCurrent(this:object,approval:Readonly<NegativeLinuxApprovalProjection>):void;
}
export interface NegativeLinuxJournalSystem{
 readonly recipient:object;
 lstat(this:object,path:string):Readonly<NegativeLinuxJournalStat>;
 realpath(this:object,path:string):string;
 open(this:object,path:string,flags:number,mode?:number):object;
 fstat(this:object,handle:object):Readonly<NegativeLinuxJournalStat>;
 write(this:object,handle:object,bytes:Uint8Array,offset:number):number;
 read(this:object,handle:object,buffer:Uint8Array,offset:number,length:number):number;
 sync(this:object,handle:object):void;
 close(this:object,handle:object):void;
 schedule(this:object,callback:()=>void,timeoutMs:number):object;
 cancel(this:object,token:object):void;
}

type Stat=Readonly<NegativeLinuxJournalStat>;
type Pin=Readonly<{path:string;dev:number;ino:number;uid:number;mode:number}>;
type RecordState='CREATED'|'WRITTEN'|'SYNCED'|'CLOSED'|'DIRECTORY_SYNCED'|'READBACK'|'UNKNOWN';
interface OwnedRecord{inner:object;token:object;state:RecordState;closeStarted:boolean;created:Stat;expected?:Uint8Array;}

function exact(value:unknown,keys:readonly string[]){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 const d=Object.getOwnPropertyDescriptors(value);return Reflect.ownKeys(d).length===keys.length&&keys.every(key=>!!d[key]?.enumerable&&Object.hasOwn(d[key]!,'value'));
}
function safeInteger(value:unknown){return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;}
function statShape(raw:Readonly<NegativeLinuxJournalStat>):Stat{
 if(!raw||typeof raw!=='object'||types.isProxy(raw)||!Object.isFrozen(raw)||!['FILE','DIRECTORY'].includes(raw.kind)
  ||![raw.dev,raw.ino,raw.uid,raw.mode,raw.nlink,raw.size].every(safeInteger)||![raw.mtimeMs,raw.ctimeMs].every(value=>typeof value==='number'&&Number.isFinite(value)))invalid();
 return raw;
}
function sameIdentity(left:Stat,right:Stat){return left.kind===right.kind&&left.dev===right.dev&&left.ino===right.ino&&left.uid===right.uid&&left.mode===right.mode&&left.nlink===right.nlink;}
function parentPaths(path:string){let cursor='';const rows:string[]=[];for(const segment of path.split('/').filter(Boolean)){cursor+='/'+segment;rows.push(cursor);}return rows;}
function errno(raw:unknown){
 if(!raw||typeof raw!=='object'||types.isProxy(raw))return undefined;const descriptor=Object.getOwnPropertyDescriptor(raw,'code');
 return descriptor&&Object.hasOwn(descriptor,'value')&&typeof descriptor.value==='string'?descriptor.value:undefined;
}
function approvalShape(raw:Readonly<NegativeLinuxApprovalProjection>){
 if(!exact(raw,['schemaVersion','purpose','attemptId','sourceHead','planHash','approvalHash','graphHash','dependencyHashes','evidence','runtimeVerified','executionAuthorized'])||!Object.isFrozen(raw)
  ||raw.schemaVersion!==1||raw.purpose!==current0076NegativeLinuxApprovalContract.verifiedPurpose||!uuidV1(raw.attemptId)||!/^[a-f0-9]{40}$/.test(raw.sourceHead)
  ||![raw.planHash,raw.approvalHash,raw.graphHash].every(hashV1)||raw.evidence!=='PROTECTED_READ_SOURCE_ONLY'||raw.runtimeVerified!==false||raw.executionAuthorized!==false
  ||types.isProxy(raw.dependencyHashes)||!Array.isArray(raw.dependencyHashes)||!Object.isFrozen(raw.dependencyHashes)||raw.dependencyHashes.length!==current0076NegativeLinuxApprovalContract.dependencyPaths.length)invalid();
 for(let index=0;index<raw.dependencyHashes.length;index++){
  const row=raw.dependencyHashes[index];if(!row||!exact(row,['path','bytes','sha256'])||!Object.isFrozen(row)||row.path!==current0076NegativeLinuxApprovalContract.dependencyPaths[index]
   ||!safeInteger(row.bytes)||row.bytes<1||!hashV1(row.sha256))invalid();
 }
 return raw;
}
function authorityShape(raw:Readonly<NegativeLinuxJournalAuthority>){
 if(!exact(raw,['recipient','approval','receiptRoot','uid','assertCurrent'])||!Object.isFrozen(raw))invalid();const d=Object.getOwnPropertyDescriptors(raw),recipient=d.recipient!.value as object;
 if(!recipient||typeof recipient!=='object'||types.isProxy(recipient)||!Object.isFrozen(recipient)||typeof d.assertCurrent!.value!=='function'||d.uid!.value!==1000)invalid();
 const approval=approvalShape(d.approval!.value as NegativeLinuxApprovalProjection),receiptRoot=receiptParent+'/ix01-0076-negative-'+approval.attemptId;
 if(d.receiptRoot!.value!==receiptRoot)invalid();return{recipient,approval,receiptRoot,current:d.assertCurrent!.value as NegativeLinuxJournalAuthority['assertCurrent']};
}
function systemShape(raw:NegativeLinuxJournalSystem){
 const keys=['recipient','lstat','realpath','open','fstat','write','read','sync','close','schedule','cancel'] as const;if(!exact(raw,keys)||!Object.isFrozen(raw))invalid();
 const d=Object.getOwnPropertyDescriptors(raw),recipient=d.recipient!.value as object;if(!recipient||typeof recipient!=='object'||types.isProxy(recipient)||!Object.isFrozen(recipient))invalid();
 for(const key of keys.slice(1))if(typeof d[key]!.value!=='function')invalid();
 return{keys,recipient,lstat:d.lstat!.value as NegativeLinuxJournalSystem['lstat'],realpath:d.realpath!.value as NegativeLinuxJournalSystem['realpath'],open:d.open!.value as NegativeLinuxJournalSystem['open'],
  fstat:d.fstat!.value as NegativeLinuxJournalSystem['fstat'],write:d.write!.value as NegativeLinuxJournalSystem['write'],read:d.read!.value as NegativeLinuxJournalSystem['read'],
  sync:d.sync!.value as NegativeLinuxJournalSystem['sync'],close:d.close!.value as NegativeLinuxJournalSystem['close'],schedule:d.schedule!.value as NegativeLinuxJournalSystem['schedule'],cancel:d.cancel!.value as NegativeLinuxJournalSystem['cancel']};
}

/** 실제 Linux entry가 검증된 approval와 private syscall 대역을 함께 공급할 때만 claim journal 포트를 만든다. 기본 native writer나 CLI는 제공하지 않는다. */
export function create0076NegativeLinuxJournal(rawAuthority:Readonly<NegativeLinuxJournalAuthority>,rawSystem:NegativeLinuxJournalSystem):Readonly<NegativeClaimJournalPorts>{
 const authority=authorityShape(rawAuthority),system=systemShape(rawSystem),receiptPath=authority.receiptRoot+'/claim-v1.json';
 const unchanged=()=>rawAuthority.recipient===authority.recipient&&rawAuthority.approval===authority.approval&&rawAuthority.receiptRoot===authority.receiptRoot&&rawAuthority.uid===1000&&rawAuthority.assertCurrent===authority.current
  &&system.keys.every(key=>rawSystem[key]===system[key]);
 const current=()=>{if(!unchanged()||authority.current.call(authority.recipient,authority.approval)!==undefined)invalid();};
 const stat=(path:string)=>statShape(system.lstat.call(system.recipient,path));
 const real=(path:string)=>{if(system.realpath.call(system.recipient,path)!==path)invalid();};
 const pins=new Map<string,Pin>();
 const pinRoot=()=>{for(const path of parentPaths(authority.receiptRoot)){const value=stat(path);
  if(value.kind!=='DIRECTORY'||![0,1000].includes(value.uid)||(value.mode&0o022)!==0||path===authority.receiptRoot&&(value.uid!==1000||(value.mode&0o777)!==0o700))invalid();
  pins.set(path,Object.freeze({path,dev:value.dev,ino:value.ino,uid:value.uid,mode:value.mode}));}real(authority.receiptRoot);};
 const checkPins=()=>{for(const pin of pins.values()){const value=stat(pin.path);if(value.kind!=='DIRECTORY'||value.dev!==pin.dev||value.ino!==pin.ino||value.uid!==pin.uid||value.mode!==pin.mode)invalid();}};
 const records=new WeakMap<object,OwnedRecord>();let active:OwnedRecord|undefined,started=false;
 const closeInner=(record:OwnedRecord)=>{
  if(record.closeStarted)return false;record.closeStarted=true;
  try{system.close.call(system.recipient,record.inner);retainedUnknownHandles.delete(record.inner);return true;}
  catch{record.state='UNKNOWN';retainedUnknownHandles.add(record.inner);return false;}
 };
 const receiptBytes=(raw:Uint8Array)=>{
  if(types.isProxy(raw)||!types.isUint8Array(raw)||types.isSharedArrayBuffer(raw.buffer)||raw.byteLength<1||raw.byteLength>16384)invalid();
  const bytes=new Uint8Array(raw);let text='',value:unknown;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);value=parseWireJson(text);}catch{bytes.fill(0);invalid();}
  if(!recordV1(value,['schemaVersion','purpose','attemptId','approvalId','sourceHead','planHash','approvalHash','graphHash','receiptPath','claimedAt','evidence','runtimeVerified','executionAuthorized'])
   ||value.schemaVersion!==1||value.purpose!==current0076NegativeClaimContract.receiptPurpose||value.attemptId!==authority.approval.attemptId||!uuidV1(value.approvalId)
   ||value.sourceHead!==authority.approval.sourceHead||value.planHash!==authority.approval.planHash||value.approvalHash!==authority.approval.approvalHash||value.graphHash!==authority.approval.graphHash
   ||value.receiptPath!==receiptPath||!safeInteger(value.claimedAt)||value.evidence!=='SOURCE_STAGE_ONLY'||value.runtimeVerified!==false||value.executionAuthorized!==false
   ||canonicalJson(value)!==text){bytes.fill(0);invalid();}return bytes;
 };
 const recipient=Object.freeze(Object.create(null));
 const schedule:NegativeClaimJournalPorts['schedule']=function(this:object,callback,timeoutMs){
  if(typeof callback!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||this!==recipient)invalid();current();
  const token=system.schedule.call(system.recipient,callback,timeoutMs);if(!token||typeof token!=='object'||types.isProxy(token))invalid();let cancelled=false;
  return()=>{if(cancelled)return;cancelled=true;system.cancel.call(system.recipient,token);};
 };
 const createExclusive:NegativeClaimJournalPorts['createExclusive']=async function(path){
  if(this!==recipient||started||path!==receiptPath)return Object.freeze({kind:'UNKNOWN' as const});started=true;
  let inner:object|undefined;
  try{current();pinRoot();checkPins();const opened=system.open.call(system.recipient,path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
   if(!opened||typeof opened!=='object'||types.isProxy(opened))invalid();inner=opened;retainedUnknownHandles.add(inner);
   const created=statShape(system.fstat.call(system.recipient,inner)),found=stat(path);real(path);checkPins();current();
   if(created.kind!=='FILE'||created.uid!==1000||(created.mode&0o777)!==0o600||created.nlink!==1||created.size!==0||!sameIdentity(created,found)){
    const token=Object.freeze(Object.create(null)),record={inner,token,state:'UNKNOWN' as const,closeStarted:false,created};records.set(token,record);active=record;return Object.freeze({kind:'CREATED' as const,handle:token});
   }
   const token=Object.freeze(Object.create(null)),record:OwnedRecord={inner,token,state:'CREATED',closeStarted:false,created};records.set(token,record);active=record;
   return Object.freeze({kind:'CREATED' as const,handle:token});
  }catch(error){
   if(inner){try{system.close.call(system.recipient,inner);retainedUnknownHandles.delete(inner);}catch{retainedUnknownHandles.add(inner);}return Object.freeze({kind:'UNKNOWN' as const});}
   if(errno(error)==='EEXIST')return Object.freeze({kind:'EXISTS' as const});return Object.freeze({kind:'UNKNOWN' as const});
  }
 };
 const write:NegativeClaimJournalPorts['write']=async function(token,raw){
  if(this!==recipient)return'UNKNOWN';const record=records.get(token);if(!record||record!==active||record.state!=='CREATED')return'UNKNOWN';let bytes:Uint8Array|undefined;
  try{current();checkPins();bytes=receiptBytes(raw);let offset=0;while(offset<bytes.byteLength){current();const count=system.write.call(system.recipient,record.inner,bytes.subarray(offset),offset);if(!Number.isSafeInteger(count)||count<1||count>bytes.byteLength-offset)invalid();offset+=count;}
   const after=statShape(system.fstat.call(system.recipient,record.inner)),found=stat(receiptPath);real(receiptPath);checkPins();current();
   if(!sameIdentity(record.created,after)||!sameIdentity(record.created,found)||after.size!==bytes.byteLength||found.size!==bytes.byteLength)invalid();record.expected=new Uint8Array(bytes);record.state='WRITTEN';return'WRITTEN';
  }catch{record.state='UNKNOWN';return'UNKNOWN';}finally{bytes?.fill(0);}
 };
 const syncFile:NegativeClaimJournalPorts['syncFile']=async function(token){
  if(this!==recipient)return'UNKNOWN';const record=records.get(token);if(!record||record!==active||record.state!=='WRITTEN')return'UNKNOWN';
  try{current();checkPins();system.sync.call(system.recipient,record.inner);current();checkPins();record.state='SYNCED';return'SYNCED';}catch{record.state='UNKNOWN';return'UNKNOWN';}
 };
 const close:NegativeClaimJournalPorts['close']=async function(token){
  if(this!==recipient)return'UNKNOWN';const record=records.get(token);if(!record||record!==active||!['CREATED','WRITTEN','SYNCED','UNKNOWN'].includes(record.state))return'UNKNOWN';
  const prior=record.state;if(!closeInner(record))return'UNKNOWN';record.state=prior==='SYNCED'?'CLOSED':'UNKNOWN';return prior==='SYNCED'?'CLOSED':'UNKNOWN';
 };
 const syncDirectory:NegativeClaimJournalPorts['syncDirectory']=async function(path){
  if(this!==recipient||path!==authority.receiptRoot||!active||active.state!=='CLOSED')return'UNKNOWN';let inner:object|undefined,closeStarted=false;
  try{current();checkPins();inner=system.open.call(system.recipient,path,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);retainedUnknownHandles.add(inner);
   const found=statShape(system.fstat.call(system.recipient,inner)),pin=pins.get(path)!;if(found.kind!=='DIRECTORY'||found.dev!==pin.dev||found.ino!==pin.ino||found.uid!==pin.uid||found.mode!==pin.mode)invalid();
   system.sync.call(system.recipient,inner);current();checkPins();closeStarted=true;system.close.call(system.recipient,inner);retainedUnknownHandles.delete(inner);active.state='DIRECTORY_SYNCED';return'SYNCED';
  }catch{active.state='UNKNOWN';return'UNKNOWN';}finally{if(inner&&!closeStarted)try{closeStarted=true;system.close.call(system.recipient,inner);retainedUnknownHandles.delete(inner);}catch{retainedUnknownHandles.add(inner);}}
 };
 const readback:NegativeClaimJournalPorts['readback']=async function(path){
  if(this!==recipient||path!==receiptPath)invalid();const record=active;if(record===undefined)throw Error('IX01_0076_NEGATIVE_LINUX_JOURNAL_INVALID');if(record.state!=='DIRECTORY_SYNCED')invalid();const expected=record.expected;if(expected===undefined)throw Error('IX01_0076_NEGATIVE_LINUX_JOURNAL_INVALID');let inner:object|undefined,closeStarted=false,buffer:Uint8Array|undefined;
  try{current();checkPins();inner=system.open.call(system.recipient,path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);retainedUnknownHandles.add(inner);
   const before=statShape(system.fstat.call(system.recipient,inner));if(!sameIdentity(record.created,before)||before.size!==expected.byteLength)invalid();buffer=new Uint8Array(before.size+1);let total=0;
   while(total<buffer.byteLength){current();const count=system.read.call(system.recipient,inner,buffer,total,buffer.byteLength-total);if(!Number.isSafeInteger(count)||count<0||count>buffer.byteLength-total)invalid();if(count===0)break;total+=count;}
   const after=statShape(system.fstat.call(system.recipient,inner)),found=stat(path);real(path);checkPins();current();if(total!==before.size||!sameIdentity(before,after)||!sameIdentity(before,found)||after.size!==before.size||found.size!==before.size||!Buffer.from(buffer.subarray(0,total)).equals(Buffer.from(expected)))invalid();
   closeStarted=true;system.close.call(system.recipient,inner);retainedUnknownHandles.delete(inner);record.state='READBACK';return new Uint8Array(buffer.subarray(0,total));
  }catch(error){record.state='UNKNOWN';throw error;}finally{buffer?.fill(0);if(inner&&!closeStarted)try{closeStarted=true;system.close.call(system.recipient,inner);retainedUnknownHandles.delete(inner);}catch{retainedUnknownHandles.add(inner);}}
 };
 return Object.freeze({recipient,schedule,createExclusive,write,syncFile,close,syncDirectory,readback});
}
