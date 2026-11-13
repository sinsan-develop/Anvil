import {constants} from 'node:fs';
import * as disk from 'node:fs/promises';
import {resolve,isAbsolute,parse,join} from 'node:path';
import {canonicalJson,parseWireJson} from '../../../contracts/canonical.ts';
import {cloneV1,recordV1,uuidV1} from '../../../contracts/runtime/validation-v1.ts';
import type {NormalStartStore,NormalStartEntry} from './normal-start-intake.ts';
import type {ReceiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
export type NormalLocalScope={projectId:string;executionId:string;executionGeneration:number};
export interface NormalJournalTransaction{read():Promise<unknown[]>;appendAndSync(value:unknown):Promise<void>}
export interface NormalJournalStore{readonly transport:'NORMAL_PROTECTED';exclusive<T>(channel:string,body:(tx:NormalJournalTransaction)=>Promise<T>):Promise<T>}
/** 실제 FS는 명시한 기존 전용 root만 쓴다. 시험 포트는 RAM fakeFS이며 권한의 증거가 아니다. */
export type NormalFilePorts=Pick<typeof disk,'lstat'|'realpath'|'open'|'readdir'|'unlink'>;
const fail=():never=>{throw Error('NORMAL_LOCAL_STORAGE_UNAVAILABLE');};
const same=(a:any,b:any)=>a.dev===b.dev&&a.ino===b.ino;
const pathSame=(a:string,b:string)=>process.platform==='win32'?a.toUpperCase()===b.toUpperCase():a===b;
const channelOK=(s:string)=>/^(observations|acks|attempt-[0-9a-f-]{36}|intake-[0-9a-f-]{36})$/.test(s);
const perFile=3*1024*1024,totalLimit=64*1024*1024;
/** append→file.sync→재열기 검산. 불명/부분파일/남은 lock은 자동 제거하지 않는다.
 * directory fsync/전원손실 내성과 다른 동일 OS 사용자의 악의적 변경은 별도 검증 범위다. */
export class NormalStartFileStore implements NormalJournalStore{
 readonly transport='NORMAL_PROTECTED' as const;
 #root:string;#scope:NormalLocalScope;#fs:NormalFilePorts;
 constructor(root:string,scope:NormalLocalScope,ports:NormalFilePorts=disk){
  if(!isAbsolute(root)||root.includes('\0')||pathSame(resolve(root),parse(resolve(root)).root)||
   !recordV1(scope,['projectId','executionId','executionGeneration'])||!uuidV1(scope.projectId)||!uuidV1(scope.executionId)||
   !Number.isSafeInteger(scope.executionGeneration)||scope.executionGeneration<1)fail();
  this.#root=resolve(root);this.#scope=cloneV1(scope);this.#fs=ports;
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
 async exclusive<T>(channel:string,body:(tx:NormalJournalTransaction)=>Promise<T>):Promise<T>{
  if(typeof channel!=='string'||!channelOK(channel))fail();
  const fs=this.#fs,root=this.#root,lockPath=join(root,channel+'.lock');let identity:any,lock:any,lockId:any,closed=false,operating=false,uncertain=false,poisoned=false,wrote=false;
  const check=async()=>{const st=await fs.lstat(root);if(!st.isDirectory()||st.isSymbolicLink()||!same(st,identity)||!pathSame(await fs.realpath(root),root))fail();};
  try{
   identity=await fs.lstat(root);await check();
   try{lock=await fs.open(lockPath,'wx',0o600);lockId=await lock.stat();}catch(e:any){if(e.code==='EEXIST')throw Error('NORMAL_LOCAL_BUSY');throw e;}
   let loaded=false,count=0,total=0;
   const serial=async<R>(fn:()=>Promise<R>)=>{if(closed||operating||poisoned)fail();operating=true;try{return await fn();}catch(e){poisoned=true;uncertain=true;throw e;}finally{operating=false;}};
   const tx:NormalJournalTransaction={
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
     if(!loaded||count>=10000)fail();const bytes=Buffer.from(canonicalJson(value)+'\n');if(bytes.length>perFile||total+bytes.length>totalLimit)fail();
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
    if(!uncertain&&!poisoned){await check();const st=await fs.lstat(lockPath);if(!st.isFile()||st.isSymbolicLink()||!same(st,lockId))fail();await fs.unlink(lockPath);}
   }
  }
 }
}
