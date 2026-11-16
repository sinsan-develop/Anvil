import {isProfileJournal} from './normal-owned-spool-profile.ts';
import {constants,unlinkSync} from 'node:fs';
import {isAsyncFunction,isPromise,isProxy} from 'node:util/types';
import * as disk from 'node:fs/promises';
import {resolve,isAbsolute,parse,join} from 'node:path';
import {canonicalJson,parseWireJson} from '../../../contracts/canonical.ts';
import {cloneV1,recordV1,uuidV1} from '../../../contracts/runtime/validation-v1.ts';
import type {NormalStartStore,NormalStartEntry} from './normal-start-intake.ts';
import type {NormalStopStore} from './normal-stop-coordinator.ts';
import type {NormalInstructionStore} from './normal-instruction-intake.ts';
import type {ReceiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
export type NormalLocalScope={projectId:string;executionId:string;executionGeneration:number};
export interface NormalJournalTransaction{requireStartReadyClose?(key:ReceiptKeyV1):void;requireLiveInputClose?(key:ReceiptKeyV1,finalCheck:()=>void):void;read():Promise<unknown[]>;appendAndSync(value:unknown):Promise<void>}
export interface NormalJournalStore{readonly transport:'NORMAL_PROTECTED';exclusive<T>(channel:string,body:(tx:NormalJournalTransaction)=>Promise<T>):Promise<T>}
/** 실제 FS는 명시한 기존 전용 root만 쓴다. 시험 포트는 RAM fakeFS이며 권한의 증거가 아니다. */
export type NormalFilePorts=Pick<typeof disk,'lstat'|'realpath'|'open'|'readdir'|'unlink'>&{unlinkSync?:(path:string)=>void};
export interface ProfileJournalAccess {
 transaction<T>(channel:string, run:(path:string, ports:NormalFilePorts)=>Promise<T>):Promise<T>;
}
const managedRoot = Symbol('owner allocation');
export function isOwnedSpoolPath(path:string){
 return /(?:^|\/)anvil\/trust\/v1\/owned-spool-profile\.v1(?:\/|$)/i.test(resolve(path).replaceAll('\\','/'));
}
const fail:()=>never=()=>{throw Error('NORMAL_LOCAL_STORAGE_UNAVAILABLE');};
const same=(a:any,b:any)=>a.dev===b.dev&&a.ino===b.ino;
const pathSame=(a:string,b:string)=>process.platform==='win32'?a.toUpperCase()===b.toUpperCase():a===b;
const channelOK=(s:string)=>/^(observations|acks|attempt-[0-9a-f-]{36}|intake-[0-9a-f-]{36})$/.test(s);
const perFile=3*1024*1024,totalLimit=64*1024*1024;
/** append→file.sync→재열기 검산. 불명/부분파일/남은 lock은 자동 제거하지 않는다.
 * directory fsync/전원손실 내성과 다른 동일 OS 사용자의 악의적 변경은 별도 검증 범위다. */
export class NormalStartFileStore implements NormalJournalStore{
 readonly transport='NORMAL_PROTECTED' as const;
 #root:string;#access?:ProfileJournalAccess;#scope:NormalLocalScope;#fs:NormalFilePorts;#syncRelease?:NormalFilePorts['unlinkSync'];
 constructor(root:string|ProfileJournalAccess,scope:NormalLocalScope,ports:NormalFilePorts=disk,proof?:typeof managedRoot){
  if((typeof root==='string'?(!isAbsolute(root)||root.includes('\0')||pathSame(resolve(root),parse(resolve(root)).root)||(isOwnedSpoolPath(root)&&proof!==managedRoot)):(!root||!isProfileJournal(root)))||
   !recordV1(scope,['projectId','executionId','executionGeneration'])||!uuidV1(scope.projectId)||!uuidV1(scope.executionId)||
   !Number.isSafeInteger(scope.executionGeneration)||scope.executionGeneration<1)fail();
  this.#root=typeof root==='string'?resolve(root):'';if(typeof root!=='string')this.#access=root;this.#scope=cloneV1(scope);this.#fs=ports;
  const sync=ports===disk?unlinkSync:!isProxy(ports)?Object.getOwnPropertyDescriptor(ports,'unlinkSync')?.value:undefined;
  if(typeof sync==='function'&&!isProxy(sync)&&!isAsyncFunction(sync))this.#syncRelease=sync;
 }
 intake():NormalStartStore{
  return{transport:'NORMAL_PROTECTED',exclusive:async<T>(key:ReceiptKeyV1,body:Parameters<NormalStartStore['exclusive']>[1]):Promise<T>=>{
   if(!recordV1(key,['projectId','executionId','executionGeneration','commandId'])||!uuidV1(key.commandId)||
    !Object.entries(this.#scope).every(([k,v])=>(key as any)[k]===v))fail();
   return this.exclusive('intake-'+key.commandId,async tx=>{
    let saved:any[]=[];
    const read=async()=>{saved=await tx.read();return{complete:true,events:saved.map(x=>cloneV1(x.entry)) as NormalStartEntry[]};};
    return body({read,readPart:async(ref)=>{
     const rows=await tx.read(),r:any=rows.find((x:any)=>canonicalJson(x.entry.ref)===canonicalJson(ref));
     if(!r||typeof r.bytes!=='string')return fail();
     const b=Buffer.from(r.bytes,'base64url');if(b.toString('base64url')!==r.bytes||b.length>2*1024*1024)fail();return new Uint8Array(b);
    },appendAndSync:async(entry,bytes)=>{
     if(bytes!==null&&(!(bytes instanceof Uint8Array)||bytes.length>2*1024*1024))fail();
     await tx.appendAndSync({entry:cloneV1(entry),bytes:bytes===null?null:Buffer.from(bytes).toString('base64url')});
    }}) as Promise<T>;
   });
  }};
 }
 /** SEND 전용 포트: START 행형상을 재사용하지 않고 원 root scope를 검산한다. */
 instructionIntake():NormalInstructionStore{
  return{transport:'NORMAL_PROTECTED',exclusive:async<T>(key:ReceiptKeyV1,body:Parameters<NormalInstructionStore['exclusive']>[1]):Promise<T>=>{
   if(!recordV1(key,['projectId','executionId','executionGeneration','commandId'])||!uuidV1(key.commandId)||
    !Object.entries(this.#scope).every(([k,v])=>(key as any)[k]===v))fail();
   return this.#run('intake-'+key.commandId,body,true) as Promise<T>;
  }};
 }
 /** STOP 역사 전용 strict-close 포트. 기존 START exclusive 의미는 바꾸지 않는다. */
 stopAttempts():NormalStopStore{
  return{transport:'NORMAL_PROTECTED',exclusive:async<T>(key:ReceiptKeyV1,body:Parameters<NormalStopStore['exclusive']>[1]):Promise<T>=>{
   if(!recordV1(key,['projectId','executionId','executionGeneration','commandId'])||!uuidV1(key.commandId)||
    !Object.entries(this.#scope).every(([k,v])=>(key as any)[k]===v))fail();
   return this.#run('attempt-'+key.commandId,body,true) as Promise<T>;
  }};
 }
 instructionAttempts():NormalInstructionStore{
  return{transport:'NORMAL_PROTECTED',exclusive:async<T>(key:ReceiptKeyV1,body:Parameters<NormalInstructionStore['exclusive']>[1]):Promise<T>=>{
   if(!recordV1(key,['projectId','executionId','executionGeneration','commandId'])||!uuidV1(key.commandId)||
    !Object.entries(this.#scope).every(([k,v])=>(key as any)[k]===v))fail();
   return this.#run('attempt-'+key.commandId,body,true) as Promise<T>;
  }};
 }
 async exclusive<T>(channel:string,body:(tx:NormalJournalTransaction)=>Promise<T>):Promise<T>{return this.#run(channel,body,false);}
 async #run<T>(channel:string,body:(tx:NormalJournalTransaction)=>Promise<T>,strictClose:boolean):Promise<T>{
  if(typeof channel!=='string'||!channelOK(channel))fail();
  if(this.#access)return this.#access.transaction(channel,(path,ports)=>new NormalStartFileStore(path,this.#scope,ports,managedRoot).#run(channel,body,true));
  const fs=this.#fs,root=this.#root,lockPath=join(root,channel+'.lock');
  const syncRelease=this.#syncRelease;let liveCheck:(()=>void)|undefined;
  const sameRelease=()=>syncRelease&&(fs===disk||!isProxy(fs)&&Object.getOwnPropertyDescriptor(fs,'unlinkSync')?.value===syncRelease);let identity:any,lock:any,lockId:any,closed=false,operating=false,uncertain=false,poisoned=false,wrote=false;
  const check=async()=>{const st=await fs.lstat(root);if(!st.isDirectory()||st.isSymbolicLink()||!same(st,identity)||!pathSame(await fs.realpath(root),root))fail();};
  try{
   identity=await fs.lstat(root);await check();
   try{lock=await fs.open(lockPath,'wx',0o600);lockId=await lock.stat();}catch(e:any){if(e.code==='EEXIST')throw Error('NORMAL_LOCAL_BUSY');throw e;}
   let loaded=false,count=0,total=0;
   const serial=async<R>(fn:()=>Promise<R>)=>{if(closed||operating||poisoned)fail();operating=true;try{return await fn();}catch(e){poisoned=true;uncertain=true;throw e;}finally{operating=false;}};
   const tx:NormalJournalTransaction={
    requireStartReadyClose:key=>{
     if(closed||poisoned||!recordV1(key,['projectId','executionId','executionGeneration','commandId'])||!uuidV1(key.commandId)||
      channel!=='attempt-'+key.commandId||!Object.entries(this.#scope).every(([k,v])=>(key as any)[k]===v))fail();
     strictClose=true;
    },
    requireLiveInputClose:(key,verify)=>{
     if(liveCheck||closed||poisoned||!strictClose||!recordV1(key,['projectId','executionId','executionGeneration','commandId'])||!uuidV1(key.commandId)||channel!=='attempt-'+key.commandId||
      !Object.entries(this.#scope).every(([k,v])=>(key as any)[k]===v)||typeof verify!=='function'||isProxy(verify)||!sameRelease())fail();
     liveCheck=verify;
    },
    read:()=>serial(async()=>{
     await check();const all=await fs.readdir(root);
     // 같은 root의 다른 채널은 건드리지 않지만 정체불명의 파일은 거절한다.
     if(all.some(n=>!/^((observations|acks|attempt-[0-9a-f-]{36}|intake-[0-9a-f-]{36})\.(lock|[0-9]{6}\.json))$/.test(n)))fail();
     const names=all.filter(n=>n.startsWith(channel+'.')&&n!==channel+'.lock').sort();if(names.length>10000)fail();
     const rows:unknown[]=[];total=0;
     for(let i=0;i<names.length;i++){
      if(names[i]!==channel+'.'+String(i+1).padStart(6,'0')+'.json')fail();
      const path=join(root,names[i]!),st=await fs.lstat(path);if(!st.isFile()||st.isSymbolicLink()||st.size>perFile||st.size+total>totalLimit)fail();
      const f=await fs.open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
      try{if(!same(st,await f.stat()))fail();const buf=Buffer.alloc(st.size+1);const {bytesRead}=await f.read(buf,0,buf.length,0);
       if(bytesRead!==st.size)fail();const text=new TextDecoder('utf-8',{fatal:true}).decode(buf.subarray(0,bytesRead)),obj=parseWireJson(text);
       if(canonicalJson(obj)+'\n'!==text)fail();await check();const after=await fs.lstat(path);if(!after.isFile()||after.isSymbolicLink()||!same(st,after)||after.size!==st.size)fail();rows.push(obj);total+=st.size;
      }finally{await f.close();}
     }
     loaded=true;count=rows.length;return rows;
    }),
    appendAndSync:value=>serial(async()=>{
     if(!loaded||count>=10000)fail();
     const attempt=channel.startsWith('attempt-');
     if(attempt&&value&&typeof value==='object'){
      if(isProxy(value)||isProxy(Object.getOwnPropertyDescriptor(value,'snapshot')?.value))fail();
     }
     const encoded=canonicalJson(value),bytes=Buffer.from(encoded+'\n');if(bytes.length>perFile||total+bytes.length>totalLimit)fail();
     if(attempt){
      const live=JSON.parse(encoded)?.snapshot?.state==='LIVE_SEND_INPUT_YIELDED';
      if((live&&!liveCheck)||(liveCheck&&(!live||count!==3)))fail();
     }
     await check();const path=join(root,channel+'.'+String(count+1).padStart(6,'0')+'.json');uncertain=true;wrote=true;const f=await fs.open(path,'wx',0o600);
     try{const id=await f.stat();await f.writeFile(bytes);await f.sync();await check();const st=await fs.lstat(path);
      if(!st.isFile()||st.isSymbolicLink()||!same(id,st)||st.size!==bytes.length)fail();
     }finally{await f.close();}
     count++;total+=bytes.length;uncertain=false;
    })
   };
   const out=await body(tx);if(operating||poisoned)fail();return out;
  }catch(error){if(wrote)uncertain=true;throw error;}finally{
   closed=true;if(operating)uncertain=true;
   if(lock){try{await lock.close();}catch{uncertain=true;}
    if(!uncertain&&!poisoned){await check();const st=await fs.lstat(lockPath);if(!st.isFile()||st.isSymbolicLink()||!same(st,lockId))fail();
     if(liveCheck){
      if(!syncRelease||!sameRelease())fail();
      liveCheck();
      const released:unknown=Reflect.apply(syncRelease,fs,[lockPath]);
      if(released!==undefined){
       if(!isProxy(released)&&isPromise(released)&&Object.getPrototypeOf(released)===Promise.prototype&&!Object.hasOwn(released,'constructor')){
        Reflect.apply(Promise.prototype.then,released,[undefined,()=>undefined]);
       }
       fail();
      }
     }else await fs.unlink(lockPath);}
   }
   if(strictClose&&uncertain)fail();
  }
 }
}
