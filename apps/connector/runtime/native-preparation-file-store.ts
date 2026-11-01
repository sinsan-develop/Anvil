import {constants} from 'node:fs';
import {lstat,realpath,readdir,mkdir,unlink,open} from 'node:fs/promises';
import {isAbsolute,resolve,parse,join} from 'node:path';
import {canonicalJson,parseWireJson,contentHash} from '../../../contracts/canonical.ts';
import {refV1} from '../../../contracts/runtime/validation-v1.ts';
import {readNativeLocalRecords,type NativeLocalRecord} from './native-preparation-local-attempt.ts';
import type {RuntimeRefV1} from '../../../contracts/runtime/validation-v1.ts';
import type {NativeLocalJournal,NativeLocalTransaction} from './native-preparation-local-attempt.ts';
export interface NativeJournalStat{dev:number;ino:number;nlink:number;size:number;mtimeMs:number;ctimeMs:number;isFile():boolean;isDirectory():boolean;isSymbolicLink():boolean}
export interface NativeJournalHandle{stat():Promise<NativeJournalStat>;read(buffer:Buffer,offset:number,length:number,position:number):Promise<{bytesRead:number}>;write(buffer:Buffer,offset:number,length:number,position:number):Promise<{bytesWritten:number}>;sync():Promise<void>;close():Promise<void>}
export interface NativeJournalFs{lstat(path:string):Promise<NativeJournalStat>;realpath(path:string):Promise<string>;readdir(path:string):Promise<string[]>;mkdir(path:string):Promise<unknown>;unlink(path:string):Promise<void>;open(path:string,flags:string|number):Promise<NativeJournalHandle>}
export interface NativeJournalLimits{maxBytes:number;maxAuthorities:number;maxRecordBytes:number}
/** 명시 소유 root의 source adapter. ACL·directory fsync·전원손실·동일 사용자의 악의적 변조 내성은 보장하지 않는다.
 * 기본 등록/constructor IO/원행 삭제/불명 lock 탈취는 없다. */
export class NativePreparationFileStore implements NativeLocalJournal{
 readonly transport='SOURCE_ONLY_MODEL' as const;
 #root:string;#limits:NativeJournalLimits;#fs:NativeJournalFs;#busy=false;
 constructor(root:string,limits:NativeJournalLimits,fs:NativeJournalFs=nodeFs){
  if(typeof root!=='string'||root.includes('\0')||!isAbsolute(root)||samePath(resolve(root),parse(resolve(root)).root)||!limits||!Number.isSafeInteger(limits.maxBytes)||limits.maxBytes<1||!Number.isSafeInteger(limits.maxAuthorities)||limits.maxAuthorities<1||limits.maxAuthorities>10000||!Number.isSafeInteger(limits.maxRecordBytes)||limits.maxRecordBytes<1||limits.maxRecordBytes>2097152)throw Error('NATIVE_LOCAL_CONFIG_INVALID');
  this.#root=resolve(root);this.#limits={...limits};const methods:Record<string,Function>={};for(const key of['lstat','realpath','readdir','mkdir','unlink','open']){const d=Object.getOwnPropertyDescriptor(fs,key);if(!d||!('value'in d)||typeof d.value!=='function')throw Error('NATIVE_LOCAL_CONFIG_INVALID');methods[key]=(...args:unknown[])=>Reflect.apply(d.value,fs,args);}this.#fs=Object.freeze(methods) as unknown as NativeJournalFs;
 }
 readonly exclusive=async<T>(authorityValue:RuntimeRefV1,body:(tx:NativeLocalTransaction)=>Promise<T>):Promise<T>=>{
  if(this.#busy||!refV1(authorityValue)||authorityValue.version!==1||typeof body!=='function')throw Error('NATIVE_LOCAL_UNAVAILABLE');
  this.#busy=true;const authorityRef=structuredClone(authorityValue),root=this.#root,fs=this.#fs,limits=this.#limits,key=hash(authorityRef),directory=join(root,key),lockPath=join(root,'native-journal.lock');
  let alive=true,operating=false,uncertain=false,poisoned=false,rootId:NativeJournalStat|undefined,lockId:NativeJournalStat|undefined,lock:NativeJournalHandle|undefined,loaded:NativeLocalRecord[]|null=null;
  const pending=new Set<Promise<unknown>>();
  const fail=():never=>{throw Error('NATIVE_LOCAL_OUTCOME_UNKNOWN');};
  const gate=()=>{if(!alive||poisoned)fail();};
  const close=async(handle:NativeJournalHandle)=>{try{await handle.close();}catch{poisoned=true;uncertain=true;fail();}};
  const directoryCheck=async(path:string,id?:NativeJournalStat)=>{gate();const s=await fs.lstat(path);gate();if(!s.isDirectory()||s.isSymbolicLink()||id&&!sameId(s,id)||!samePath(await fs.realpath(path),path))fail();gate();return s;};
  const check=async()=>{await directoryCheck(root,rootId);gate();if(lockId){const s=await fs.lstat(lockPath);gate();if(!regular(s)||!sameId(s,lockId))fail();}};
  const readFile=async(path:string,dir:string,dirId:NativeJournalStat)=>{
   await check();await directoryCheck(dir,dirId);gate();const before=await fs.lstat(path);gate();if(!regular(before)||before.size<1||before.size>limits.maxRecordBytes)fail();let handle:NativeJournalHandle|undefined;
   try{gate();handle=await fs.open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));gate();const opened=await handle.stat();gate();if(!sameFile(before,opened))fail();const bytes=Buffer.alloc(before.size+1);let offset=0;while(offset<bytes.length){gate();const r=await handle.read(bytes,offset,bytes.length-offset,offset);gate();if(!Number.isSafeInteger(r.bytesRead)||r.bytesRead<0||r.bytesRead>bytes.length-offset)fail();if(!r.bytesRead)break;offset+=r.bytesRead;}if(offset!==before.size)fail();const raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,offset)),value=parseWireJson(raw);if(canonicalJson(value)+'\n'!==raw)fail();const after=await fs.lstat(path);gate();if(!sameFile(before,after)||!sameFile(before,await handle.stat()))fail();await directoryCheck(dir,dirId);await check();return{value,bytes:offset};
   }finally{if(handle)await close(handle);}
  };
  const scan=async()=>{
   await check();const names=await fs.readdir(root);gate();if(names.length>limits.maxAuthorities+1||!names.includes('native-journal.lock')||new Set(names).size!==names.length)fail();let total=0;let selected:NativeLocalRecord[]=[];let selectedId:NativeJournalStat|undefined;const ids=new Set<string>();
   for(const name of names.filter(n=>n!=='native-journal.lock').sort()){
    if(!/^[a-f0-9]{64}$/.test(name))fail();const dir=join(root,name),dirId=await directoryCheck(dir),files=(await fs.readdir(dir)).sort();gate();if(files.length<1||files.length>2||files.some((f,n)=>f!==String(n+1).padStart(6,'0')+'.json'))fail();const records:NativeLocalRecord[]=[];
    for(const file of files){const row=await readFile(join(dir,file),dir,dirId);total+=row.bytes;if(total>limits.maxBytes)fail();records.push(row.value as NativeLocalRecord);}
    const first=records[0]?.snapshot?.authorityRef;if(!refV1(first)||first.version!==1||hash(first)!==name||ids.has(first.id))fail();ids.add(first.id);const checked=readNativeLocalRecords({complete:true,records},first);if(first.id===authorityRef.id&&canonicalJson(first)!==canonicalJson(authorityRef))fail();if(name===key){selected=checked;selectedId=dirId;}
   }
   await check();return{records:selected,dirId:selectedId,total,authorities:names.length-1};
  };
  const operation=<R>(fn:()=>Promise<R>):Promise<R>=>{
   if(!alive||operating||poisoned){poisoned=true;uncertain=true;return Promise.reject(Error('NATIVE_LOCAL_OUTCOME_UNKNOWN'));}operating=true;
   const work=fn().catch(()=>{poisoned=true;uncertain=true;return fail();}).finally(()=>{operating=false;});pending.add(work);void work.then(()=>{pending.delete(work);},()=>{pending.delete(work);});return work;
  };
  const tx:NativeLocalTransaction={read:()=>operation(async()=>{const state=await scan();loaded=state.records;return{complete:true,records:structuredClone(loaded)};}),appendAndSync:(value)=>operation(async()=>{
   const prior=loaded;if(prior===null||prior.length>=2)return fail();const next=structuredClone(value),expected=readNativeLocalRecords({complete:true,records:[...prior,next]},authorityRef),bytes=Buffer.from(canonicalJson(next)+'\n');if(bytes.length>limits.maxRecordBytes)fail();const state=await scan();if(canonicalJson(state.records)!==canonicalJson(prior)||state.total+bytes.length>limits.maxBytes||!state.dirId&&state.authorities>=limits.maxAuthorities)fail();let dirId=state.dirId,handle:NativeJournalHandle|undefined,closeAttempted=false;
   try{
    await check();gate();uncertain=true;if(!dirId){await fs.mkdir(directory);gate();dirId=await directoryCheck(directory);}
    await directoryCheck(directory,dirId);await check();gate();const path=join(directory,String(prior.length+1).padStart(6,'0')+'.json');handle=await fs.open(path,'wx+');gate();const created=await handle.stat();gate();if(!regular(created)||created.size!==0)fail();let offset=0;
    while(offset<bytes.length){await directoryCheck(directory,dirId);await check();gate();const r=await handle.write(bytes,offset,bytes.length-offset,offset);gate();if(!Number.isSafeInteger(r.bytesWritten)||r.bytesWritten<1||r.bytesWritten>bytes.length-offset)fail();offset+=r.bytesWritten;}
    await check();gate();await handle.sync();gate();const after=await handle.stat();gate();if(!regular(after)||!sameId(created,after)||after.size!==bytes.length)fail();const named=await fs.lstat(path);gate();if(!sameFile(after,named))fail();closeAttempted=true;await close(handle);handle=undefined;const readback=await scan();if(canonicalJson(readback.records)!==canonicalJson(expected))fail();loaded=readback.records;uncertain=false;
   }finally{if(handle&&!closeAttempted)await close(handle);}
  })};
  try{
   rootId=await directoryCheck(root);gate();lock=await fs.open(lockPath,'wx');gate();lockId=await lock.stat();gate();if(!regular(lockId)||lockId.size!==0)fail();await check();return await body(tx);
  }catch{throw Error('NATIVE_LOCAL_OUTCOME_UNKNOWN');}
  finally{
   alive=false;if(pending.size){poisoned=true;uncertain=true;while(pending.size)await Promise.allSettled([...pending]);}
   // 시작한 FS 작업이 정착하기 전에 handle/lock을 닫거나 다음 호출에 넘기지 않는다.
   try{if(lock){if(!uncertain&&!poisoned){const r=await fs.lstat(root),l=await fs.lstat(lockPath);if(!r.isDirectory()||r.isSymbolicLink()||!rootId||!sameId(r,rootId)||!samePath(await fs.realpath(root),root)||!regular(l)||!lockId||!sameId(l,lockId)){uncertain=true;poisoned=true;}}
    await close(lock);lock=undefined;if(!uncertain&&!poisoned){const l=await fs.lstat(lockPath);if(!regular(l)||!lockId||!sameId(l,lockId))fail();await fs.unlink(lockPath);}}
   }catch{poisoned=true;uncertain=true;throw Error('NATIVE_LOCAL_OUTCOME_UNKNOWN');}finally{this.#busy=false;}
   if(poisoned||uncertain)throw Error('NATIVE_LOCAL_OUTCOME_UNKNOWN');
  }
 };
}

const nodeFs:NativeJournalFs={lstat,realpath,readdir,mkdir:async path=>{await mkdir(path,{mode:0o700});},unlink,open:async(path,flags)=>open(path,flags,0o600)};
const samePath=(a:string,b:string)=>process.platform==='win32'?a.toUpperCase()===b.toUpperCase():a===b;
const sameId=(a:NativeJournalStat,b:NativeJournalStat)=>a.dev===b.dev&&a.ino===b.ino;
const regular=(s:NativeJournalStat)=>s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&Number.isSafeInteger(s.size)&&s.size>=0;
const sameFile=(a:NativeJournalStat,b:NativeJournalStat)=>regular(a)&&regular(b)&&sameId(a,b)&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
const hash=(v:unknown)=>contentHash(canonicalJson(v));
