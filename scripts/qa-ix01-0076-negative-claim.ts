import {types} from 'node:util';
import {canonicalJson} from '../contracts/canonical.ts';
import {hashV1,recordV1,uuidV1} from '../contracts/runtime/validation-v1.ts';
import {current0076NegativeContract as stageContract,type NegativeOwnedTarget,type NegativeStagePorts} from './qa-ix01-0076-atomicity-negative.ts';

const authorityPurpose='IX01_0076_ATOMICITY_NEGATIVE_CLAIM_AUTHORITY' as const;
const receiptPurpose='IX01_0076_ATOMICITY_NEGATIVE_CLAIM_RECEIPT' as const;
export const current0076NegativeClaimContract=Object.freeze({
 authorityPurpose,receiptPurpose,evidence:'SOURCE_STAGE_ONLY' as const,runtimeVerified:false as const,executionAuthorized:false as const,
});

type StageBinding=Parameters<NegativeStagePorts['claim']>[0];
interface NegativeClaimBinding{
 readonly purpose:typeof stageContract.purpose;readonly attemptId:string;readonly sourceHead:string;readonly planHash:string;readonly approvalHash:string;
 readonly approvalId:string;readonly graphHash:string;readonly issuedAt:number;readonly expiresAt:number;
 readonly namespace:Readonly<{container:string;database:string;receipt:string;network:'none'}>;
}
export interface NegativeClaimAuthorityProjection{
 readonly schemaVersion:1;readonly purpose:typeof authorityPurpose;readonly decision:'ALLOW_ONE_ISOLATED_NEGATIVE_STAGE';readonly attemptId:string;
 readonly approvalId:string;readonly sourceHead:string;readonly planHash:string;readonly approvalHash:string;readonly graphHash:string;
 readonly issuedAt:number;readonly expiresAt:number;readonly receiptPath:string;
}
export interface NegativeClaimAuthorityPorts{
 readonly recipient:object;
 read(this:object,binding:Readonly<NegativeClaimBinding>):Promise<Readonly<NegativeClaimAuthorityProjection>>;
}
type CreateResult=Readonly<{kind:'CREATED';handle:object}>|Readonly<{kind:'EXISTS'}>|Readonly<{kind:'UNKNOWN'}>;
export interface NegativeClaimJournalPorts{
 readonly recipient:object;
 schedule(callback:()=>void,timeoutMs:number):()=>void;
 createExclusive(this:object,path:string):Promise<CreateResult>;
 write(this:object,handle:object,bytes:Uint8Array):Promise<'WRITTEN'|'UNKNOWN'>;
 syncFile(this:object,handle:object):Promise<'SYNCED'|'UNKNOWN'>;
 close(this:object,handle:object):Promise<'CLOSED'|'UNKNOWN'>;
 syncDirectory(this:object,path:string):Promise<'SYNCED'|'UNKNOWN'>;
 readback(this:object,path:string):Promise<Uint8Array>;
}

const invalid=():never=>{throw Error('IX01_0076_NEGATIVE_CLAIM_INVALID');};
function exact(value:unknown,keys:readonly string[]){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 const descriptors=Object.getOwnPropertyDescriptors(value);return Reflect.ownKeys(descriptors).length===keys.length&&keys.every(key=>!!descriptors[key]?.enumerable&&Object.hasOwn(descriptors[key]!,'value'));
}
function stageMethods(raw:NegativeStagePorts){
 const keys=['now','monotonic','assertCurrent','claim','prepare','install','appendLedger','sentinel','catalog'] as const;
 if(!exact(raw,keys))invalid();const descriptors=Object.getOwnPropertyDescriptors(raw);
 for(const key of keys)if(typeof descriptors[key]!.value!=='function')invalid();
 return{keys,now:descriptors.now!.value as NegativeStagePorts['now'],monotonic:descriptors.monotonic!.value as NegativeStagePorts['monotonic'],
  assertCurrent:descriptors.assertCurrent!.value as NegativeStagePorts['assertCurrent'],prepare:descriptors.prepare!.value as NegativeStagePorts['prepare'],
  install:descriptors.install!.value as NegativeStagePorts['install'],appendLedger:descriptors.appendLedger!.value as NegativeStagePorts['appendLedger'],
  sentinel:descriptors.sentinel!.value as NegativeStagePorts['sentinel'],catalog:descriptors.catalog!.value as NegativeStagePorts['catalog']};
}
function authorityMethods(raw:NegativeClaimAuthorityPorts){
 const keys=['recipient','read'] as const;if(!exact(raw,keys))invalid();const descriptors=Object.getOwnPropertyDescriptors(raw),recipient=descriptors.recipient!.value as object;
 if(!recipient||typeof recipient!=='object'||types.isProxy(recipient)||!Object.isFrozen(recipient)||typeof descriptors.read!.value!=='function')invalid();
 return{keys,recipient,read:descriptors.read!.value as NegativeClaimAuthorityPorts['read']};
}
function journalMethods(raw:NegativeClaimJournalPorts){
 const keys=['recipient','schedule','createExclusive','write','syncFile','close','syncDirectory','readback'] as const;if(!exact(raw,keys))invalid();
 const descriptors=Object.getOwnPropertyDescriptors(raw),recipient=descriptors.recipient!.value as object;
 if(!recipient||typeof recipient!=='object'||types.isProxy(recipient)||!Object.isFrozen(recipient))invalid();
 for(const key of keys.slice(1))if(typeof descriptors[key]!.value!=='function')invalid();
 return{keys,recipient,schedule:descriptors.schedule!.value as NegativeClaimJournalPorts['schedule'],createExclusive:descriptors.createExclusive!.value as NegativeClaimJournalPorts['createExclusive'],write:descriptors.write!.value as NegativeClaimJournalPorts['write'],
  syncFile:descriptors.syncFile!.value as NegativeClaimJournalPorts['syncFile'],close:descriptors.close!.value as NegativeClaimJournalPorts['close'],
  syncDirectory:descriptors.syncDirectory!.value as NegativeClaimJournalPorts['syncDirectory'],readback:descriptors.readback!.value as NegativeClaimJournalPorts['readback']};
}
function receiptRoot(attemptId:string){return'/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+attemptId;}
function bindingShape(raw:Readonly<StageBinding>):raw is Readonly<StageBinding&NegativeClaimBinding>{
 if(!exact(raw,['purpose','attemptId','sourceHead','planHash','approvalHash','approvalId','graphHash','issuedAt','expiresAt','namespace'])||!Object.isFrozen(raw)||!Object.isFrozen(raw.namespace))return false;
 if(raw.purpose!==stageContract.purpose||!uuidV1(raw.attemptId)||!uuidV1(raw.approvalId)||!/^[a-f0-9]{40}$/.test(raw.sourceHead)
  ||![raw.planHash,raw.approvalHash,raw.graphHash].every(hashV1)||![raw.issuedAt,raw.expiresAt].every(Number.isSafeInteger)
  ||raw.issuedAt>=raw.expiresAt||raw.expiresAt-raw.issuedAt>1800000||!recordV1(raw.namespace,['container','database','receipt','network']))return false;
 const compact=raw.attemptId.replaceAll('-','');return raw.namespace.container==='anvil-ix01-0076-negative-'+compact
  &&raw.namespace.database==='ix01_0076_negative_'+compact&&raw.namespace.receipt===receiptRoot(raw.attemptId)&&raw.namespace.network==='none';
}
function sameAuthority(raw:unknown,binding:Readonly<StageBinding&NegativeClaimBinding>,receiptPath:string):raw is Readonly<NegativeClaimAuthorityProjection>{
 if(!exact(raw,['schemaVersion','purpose','decision','attemptId','approvalId','sourceHead','planHash','approvalHash','graphHash','issuedAt','expiresAt','receiptPath'])||!Object.isFrozen(raw))return false;
 const found=raw as NegativeClaimAuthorityProjection;
 return found.schemaVersion===1&&found.purpose===authorityPurpose&&found.decision==='ALLOW_ONE_ISOLATED_NEGATIVE_STAGE'
  &&found.attemptId===binding.attemptId&&found.approvalId===binding.approvalId&&found.sourceHead===binding.sourceHead&&found.planHash===binding.planHash
  &&found.approvalHash===binding.approvalHash&&found.graphHash===binding.graphHash&&found.issuedAt===binding.issuedAt&&found.expiresAt===binding.expiresAt&&found.receiptPath===receiptPath;
}
function ownedBytes(raw:unknown,max:number){
 if(!types.isUint8Array(raw)||types.isProxy(raw))invalid();const bytes=raw as Uint8Array;
 if(types.isSharedArrayBuffer(bytes.buffer)||bytes.byteLength<1||bytes.byteLength>max)invalid();return new Uint8Array(bytes);
}
function ownedTargetShape(raw:unknown,frozen:boolean):raw is Readonly<NegativeOwnedTarget>{
 if(!exact(raw,['schemaVersion','purpose','attemptId','sourceHead','planHash','graphHash','namespace','containerId']))return false;
 const found=raw as NegativeOwnedTarget;
 return(!frozen||Object.isFrozen(found))&&found.schemaVersion===1&&found.purpose==='IX01_0076_NEGATIVE_OWNED_TARGET'
  &&recordV1(found.namespace,['container','database','receipt','network'])&&(!frozen||Object.isFrozen(found.namespace));
}

/** 외부 권위 reader와 보호 journal을 소비할 뿐 승인·실행 권위나 실제 Linux 내구성 증거를 발급하지 않는다. */
export function create0076NegativeClaim(
 rawBase:NegativeStagePorts,rawAuthority:NegativeClaimAuthorityPorts,rawJournal:NegativeClaimJournalPorts,
):Readonly<NegativeStagePorts>{
 const base=stageMethods(rawBase),authority=authorityMethods(rawAuthority),journal=journalMethods(rawJournal);
 let used=false,claimed=false,prepareStarted=false,prepared=false,fixed:Readonly<StageBinding&NegativeClaimBinding>|undefined;
 let preparedOwner:Readonly<NegativeOwnedTarget>|undefined,ownedTarget:Readonly<NegativeOwnedTarget>|undefined,lastWall=-1,lastMono=-1,wallEnd=-1,monoEnd=-1;
 const retained=new Set<object>(),closing=new WeakMap<object,Promise<boolean>>();
 const unchanged=()=>rawBase.now===base.now&&rawBase.monotonic===base.monotonic&&rawBase.assertCurrent===base.assertCurrent
  &&rawBase.prepare===base.prepare&&rawBase.install===base.install&&rawBase.appendLedger===base.appendLedger&&rawBase.sentinel===base.sentinel&&rawBase.catalog===base.catalog
  &&authority.keys.every(key=>rawAuthority[key]===authority[key])&&journal.keys.every(key=>rawJournal[key]===journal[key]);
 const current=(target:Readonly<NegativeOwnedTarget>|null=null)=>{
  const binding=fixed??invalid();if(!unchanged())invalid();const wall=base.now.call(rawBase),mono=base.monotonic.call(rawBase);
  if(!Number.isSafeInteger(wall)||!Number.isFinite(mono)||mono<0||wall<binding.issuedAt||wall<lastWall||mono<lastMono)invalid();
  if(lastWall<0){wallEnd=Math.min(binding.expiresAt,wall+600000);monoEnd=mono+(wallEnd-wall);}
  if(!Number.isSafeInteger(wallEnd)||!Number.isFinite(monoEnd)||wall>=wallEnd||mono>=monoEnd)invalid();
  lastWall=wall;lastMono=mono;if(base.assertCurrent.call(rawBase,binding,target)!==undefined)invalid();return wall;
 };
 const startClose=(handle:object)=>{
  retained.add(handle);const prior=closing.get(handle);if(prior)return prior;
  const pending=Promise.resolve().then(()=>journal.close.call(journal.recipient,handle)).then(result=>{
   const closed=result==='CLOSED';if(closed)retained.delete(handle);return closed;
  },()=>false);
  closing.set(handle,pending);return pending;
 };
 type BoundedFailure='CALLER'|'LATE'|'DONE';
 const bounded=async<T>(work:()=>Promise<T>,late?:(result:Readonly<{value?:T}>)=>void):Promise<Readonly<{ok:true;value:T}>|Readonly<{ok:false;cleanup:BoundedFailure}>>=>{
  let remaining:number;
  try{const wall=current();remaining=Math.floor(Math.min(wallEnd-wall,monoEnd-lastMono));if(remaining<1)invalid();}catch{return{ok:false,cleanup:'CALLER'};}
  let expired=false,resolveTimeout!:(value:Readonly<{timeout:true}>)=>void,cancel:(()=>void)|undefined;
  const timeout=new Promise<Readonly<{timeout:true}>>(resolve=>{resolveTimeout=resolve;});
  try{
   cancel=journal.schedule.call(journal.recipient,()=>{expired=true;resolveTimeout(Object.freeze({timeout:true}));},remaining);
   if(typeof cancel!=='function'||expired)invalid();current();if(expired)invalid();
  }catch{if(cancel)try{cancel();}catch{}return{ok:false,cleanup:'CALLER'};}
  const operation=Promise.resolve().then(async()=>{
   try{
    if(expired)throw Error('IX01_0076_NEGATIVE_CLAIM_EXPIRED');current();if(expired)throw Error('IX01_0076_NEGATIVE_CLAIM_EXPIRED');
    return{value:await work()} as const;
   }catch{return{error:true} as const;}
  });
  const raced=await Promise.race([operation,timeout]);let cancelFailed=false;
  try{cancel();}catch{cancelFailed=true;}
  if('timeout'in raced){
   if(late)void operation.then(result=>{late('value'in result?{value:result.value}:{});}).catch(()=>{});
   return{ok:false,cleanup:'LATE'};
  }
  if('error'in raced)return{ok:false,cleanup:'CALLER'};
  if(cancelFailed){if(late)late({value:raced.value});return{ok:false,cleanup:late?'LATE':'DONE'};}
  try{current();}catch{if(late)late({value:raced.value});return{ok:false,cleanup:late?'LATE':'DONE'};}
  return{ok:true,value:raced.value};
 };
 const createdHandle=(raw:unknown)=>{
  if(!raw||typeof raw!=='object'||types.isProxy(raw))return undefined;const descriptor=Object.getOwnPropertyDescriptor(raw,'handle');
  if(!descriptor||!Object.hasOwn(descriptor,'value'))return undefined;const handle=descriptor.value;
  return handle&&typeof handle==='object'&&!types.isProxy(handle)&&Object.isFrozen(handle)?handle as object:undefined;
 };
 const claim:NegativeStagePorts['claim']=async rawBinding=>{
  if(used||!bindingShape(rawBinding))return'UNKNOWN';used=true;fixed=rawBinding;
  const receiptPath=fixed.namespace.receipt+'/claim-v1.json';let claimedAt:number;
  const authorityResult=await bounded(()=>authority.read.call(authority.recipient,fixed!));
  if(!authorityResult.ok||!sameAuthority(authorityResult.value,fixed,receiptPath))return'UNKNOWN';
  try{claimedAt=current();}catch{return'UNKNOWN';}
  const receipt=Object.freeze({schemaVersion:1,purpose:receiptPurpose,attemptId:fixed.attemptId,approvalId:fixed.approvalId,sourceHead:fixed.sourceHead,
   planHash:fixed.planHash,approvalHash:fixed.approvalHash,graphHash:fixed.graphHash,receiptPath,claimedAt,evidence:'SOURCE_STAGE_ONLY' as const,runtimeVerified:false as const,executionAuthorized:false as const});
  const expected=new Uint8Array(Buffer.from(canonicalJson(receipt),'utf8'));
  const createResult=await bounded(()=>journal.createExclusive.call(journal.recipient,receiptPath),result=>{const handle=createdHandle(result.value);if(handle)void startClose(handle);});
  if(!createResult.ok){expected.fill(0);return'UNKNOWN';}const created=createResult.value;
  if(exact(created,['kind'])&&created.kind==='EXISTS'){expected.fill(0);return'UNKNOWN';}
  const handle=createdHandle(created);if(!exact(created,['kind','handle'])||created.kind!=='CREATED'||!handle){if(handle)void startClose(handle);expected.fill(0);return'UNKNOWN';}
  const outbound=new Uint8Array(expected);
  const writeResult=await bounded(()=>journal.write.call(journal.recipient,handle,outbound),()=>{void startClose(handle);});
  if(!writeResult.ok){if(writeResult.cleanup==='CALLER')void startClose(handle);expected.fill(0);return'UNKNOWN';}
  outbound.fill(0);if(writeResult.value!=='WRITTEN'){void startClose(handle);expected.fill(0);return'UNKNOWN';}
  const syncResult=await bounded(()=>journal.syncFile.call(journal.recipient,handle),()=>{void startClose(handle);});
  if(!syncResult.ok){if(syncResult.cleanup==='CALLER')void startClose(handle);expected.fill(0);return'UNKNOWN';}
  if(syncResult.value!=='SYNCED'){void startClose(handle);expected.fill(0);return'UNKNOWN';}
  const closeResult=await bounded(()=>startClose(handle));
  if(!closeResult.ok){if(closeResult.cleanup==='CALLER')void startClose(handle);expected.fill(0);return'UNKNOWN';}
  if(!closeResult.value){expected.fill(0);return'UNKNOWN';}
  const directoryResult=await bounded(()=>journal.syncDirectory.call(journal.recipient,fixed!.namespace.receipt));
  if(!directoryResult.ok||directoryResult.value!=='SYNCED'){expected.fill(0);return'UNKNOWN';}
  const readResult=await bounded(()=>journal.readback.call(journal.recipient,receiptPath));
  if(!readResult.ok){expected.fill(0);return'UNKNOWN';}
  try{
   const found=ownedBytes(readResult.value,16384),equal=Buffer.from(found).equals(Buffer.from(expected));found.fill(0);expected.fill(0);
   if(!equal)return'UNKNOWN';claimed=true;return'CLAIMED';
  }catch{expected.fill(0);return'UNKNOWN';}
 };
 const now:NegativeStagePorts['now']=()=>base.now.call(rawBase);
 const monotonic:NegativeStagePorts['monotonic']=()=>base.monotonic.call(rawBase);
 const assertCurrent:NegativeStagePorts['assertCurrent']=(binding,target)=>{
  const result=base.assertCurrent.call(rawBase,binding,target);if(result!==undefined)invalid();
  if(!fixed)return;if(binding!==fixed)invalid();if(target===null)return;
  if(!claimed||!prepared||!preparedOwner||!ownedTargetShape(target,true)||target===preparedOwner||target.namespace!==fixed.namespace
   ||canonicalJson(target)!==canonicalJson(preparedOwner))invalid();
  if(ownedTarget&&target!==ownedTarget)invalid();ownedTarget=target;
 };
 const prepare:NegativeStagePorts['prepare']=async binding=>{
  if(!claimed||prepareStarted||binding!==fixed)invalid();prepareStarted=true;current();const value=await base.prepare.call(rawBase,binding);current();
  if(!ownedTargetShape(value,false)||canonicalJson(value.namespace)!==canonicalJson(binding.namespace))invalid();preparedOwner=value;prepared=true;return value;
 };
 const requireTarget=(target:Readonly<NegativeOwnedTarget>)=>{if(!claimed||!prepared||!ownedTarget||target!==ownedTarget)invalid();current(target);};
 const install:NegativeStagePorts['install']=async(target,raw,row,timeoutMs)=>{requireTarget(target);const value=await base.install.call(rawBase,target,raw,row,timeoutMs);current(target);return value;};
 const appendLedger:NegativeStagePorts['appendLedger']=async(target,row,timeoutMs)=>{requireTarget(target);const value=await base.appendLedger.call(rawBase,target,row,timeoutMs);current(target);return value;};
 const sentinel:NegativeStagePorts['sentinel']=async(target,sql,timeoutMs)=>{requireTarget(target);const value=await base.sentinel.call(rawBase,target,sql,timeoutMs);current(target);return value;};
 const catalog:NegativeStagePorts['catalog']=async(target,sql,timeoutMs)=>{requireTarget(target);const value=await base.catalog.call(rawBase,target,sql,timeoutMs);current(target);return value;};
 return Object.freeze({now,monotonic,assertCurrent,claim,prepare,install,appendLedger,sentinel,catalog});
}
