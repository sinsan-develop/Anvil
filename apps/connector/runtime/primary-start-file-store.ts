import {constants} from 'node:fs';
import {lstat,realpath,open,readdir,unlink,type FileHandle} from 'node:fs/promises';
import {resolve,isAbsolute,parse,join} from 'node:path';
import {canonicalJson,parseWireJson} from '../../../contracts/canonical.ts';
import {cloneV1,recordV1,uuidV1} from '../../../contracts/runtime/validation-v1.ts';
import type {SyntheticPrimaryStartStore} from '../adapters/primary/start-transport.ts';
type Scope=Parameters<SyntheticPrimaryStartStore['exclusive']>[0];
type Transaction=Parameters<SyntheticPrimaryStartStore['exclusive']>[1] extends (tx:infer T)=>unknown?T:never;
type Entry=Parameters<Transaction['appendAndSync']>[0];
type Identity={dev:number;ino:number};
const same=(a:Identity,b:Identity)=>a.dev===b.dev&&a.ino===b.ino;
const samePath=(a:string,b:string)=>process.platform==='win32'?a.toUpperCase()===b.toUpperCase():a===b;
const fail=(code:string):never=>{throw Error(code);};
const validScope=(v:unknown):v is Scope=>recordV1(v,['projectId','executionId','executionGeneration'])&&uuidV1(v.projectId)&&uuidV1(v.executionId)&&Number.isSafeInteger(v.executionGeneration)&&v.executionGeneration>0;

/** 호출자가 소유 확인한 전용 root만 사용하며 root/ACL/키는 생성하지 않는다.
 * primary 시작 어댑터 전용 최대2행/64KiB이며 원수신기·SEND/STOP의 원장 root와 혼용하지 않는다.
 * metadata 문법/순서만 확인하며 정확 grant/permit/내용은 시작 어댑터가 다시 검사한다.
 * file.sync는 수행하지만 directory fsync/전원손실·동일 OS 사용자의 악의적 변조 내성은 보장하지 않는다.
 * 부분 파일/남은 lock은 자동 삭제하지 않고 대조·별도 복구 판단까지 UNKNOWN을 보존한다. */
export class SyntheticPrimaryFileStartStore implements SyntheticPrimaryStartStore{
 readonly transport='SYNTHETIC_ONLY' as const;
 #root:string;#scope:Scope;
 constructor(root:string,scope:Scope){
  if(typeof root!=='string'||root.includes('\0')||!isAbsolute(root)||samePath(resolve(root),parse(resolve(root)).root)||!validScope(scope))fail('PRIMARY_START_STORAGE_CONFIG_INVALID');
  this.#root=resolve(root);this.#scope=cloneV1(scope);
 }
 async exclusive<T>(scope:Scope,body:(tx:Transaction)=>Promise<T>):Promise<T>{
  if(!validScope(scope)||canonicalJson(scope)!==canonicalJson(this.#scope))fail('PRIMARY_START_SCOPE_MISMATCH');
  const directory=this.#root,lockPath=join(directory,'primary-start.lock');let lock:FileHandle|undefined,lockId:Identity|undefined,identity:Identity,uncertain=false,poisoned=false,operating=false,closed=false;
  const check=async(allowClosed=false)=>{try{if(closed&&!allowClosed)fail('PRIMARY_START_STORAGE_UNAVAILABLE');const s=await lstat(directory);if(!s.isDirectory()||s.isSymbolicLink()||!same(s,identity)||!samePath(await realpath(directory),directory))fail('PRIMARY_START_STORAGE_UNAVAILABLE');if(closed&&!allowClosed)fail('PRIMARY_START_STORAGE_UNAVAILABLE');}catch{return fail('PRIMARY_START_STORAGE_UNAVAILABLE');}};
  try{
   try{const before=await lstat(directory);if(!before.isDirectory()||before.isSymbolicLink()||!samePath(await realpath(directory),directory))fail('PRIMARY_START_STORAGE_UNAVAILABLE');identity={dev:before.dev,ino:before.ino};}catch{return fail('PRIMARY_START_STORAGE_UNAVAILABLE');}
   try{lock=await open(lockPath,'wx',0o600);lockId=await lock.stat();}catch(e:any){if(e.code==='EEXIST')return fail('PRIMARY_START_INBOX_BUSY');return fail('PRIMARY_START_STORAGE_UNAVAILABLE');}
   await check();let loaded=false,count=0,total=0;
   const tx:Transaction={read:async()=>{
    if(closed)return fail('PRIMARY_START_STORAGE_UNAVAILABLE');if(poisoned||operating){poisoned=true;return fail('PRIMARY_START_STORAGE_UNAVAILABLE');}operating=true;
    try{
     await check();const names=(await readdir(directory)).filter(name=>name!=='primary-start.lock').sort();if(names.length>2)fail('PRIMARY_START_STORAGE_UNAVAILABLE');const events:Entry[]=[];total=0;
     for(let i=0;i<names.length;i++){
      const name=names[i]!;if(name!==(i+1).toString().padStart(6,'0')+'.json')fail('PRIMARY_START_STORAGE_UNAVAILABLE');const path=join(directory,name),st=await lstat(path);
      if(!st.isFile()||st.isSymbolicLink()||st.size>65536||total+st.size>65536)fail('PRIMARY_START_STORAGE_UNAVAILABLE');
      const f=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
      try{
       if(!same(st,await f.stat()))fail('PRIMARY_START_STORAGE_UNAVAILABLE');const bytes=Buffer.alloc(65537),read=await f.read(bytes,0,bytes.length,0);
       if(read.bytesRead!==st.size)fail('PRIMARY_START_STORAGE_UNAVAILABLE');const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,read.bytesRead)),entry=parseWireJson(text);
       if(canonicalJson(entry)+'\n'!==text)fail('PRIMARY_START_STORAGE_UNAVAILABLE');await check();const after=await lstat(path);if(!after.isFile()||after.isSymbolicLink()||!same(st,after)||after.size!==st.size)fail('PRIMARY_START_STORAGE_UNAVAILABLE');events.push(entry as Entry);total+=st.size;
      }finally{await f.close();}
     }
     if(closed||poisoned)return fail('PRIMARY_START_STORAGE_UNAVAILABLE');count=events.length;loaded=true;return{complete:true,events};
    }catch{uncertain=true;poisoned=true;return fail('PRIMARY_START_STORAGE_UNAVAILABLE');}finally{operating=false;}
   },appendAndSync:async(entry:Entry)=>{
    if(closed)return fail('PRIMARY_START_STORAGE_UNAVAILABLE');if(poisoned||operating){poisoned=true;return fail('PRIMARY_START_STORAGE_UNAVAILABLE');}operating=true;
    let f:FileHandle|undefined;
    try{
     if(!loaded||count>=2||entry.snapshot.sequence!==count+1)fail('PRIMARY_START_STORAGE_UNAVAILABLE');const bytes=Buffer.from(canonicalJson(entry)+'\n');if(bytes.length+total>65536)fail('PRIMARY_START_STORAGE_UNAVAILABLE');
     await check();const path=join(directory,(count+1).toString().padStart(6,'0')+'.json');uncertain=true;f=await open(path,'wx',0o600);const id=await f.stat();
     await f.writeFile(bytes);await f.sync();await check();const st=await lstat(path);if(!st.isFile()||st.isSymbolicLink()||!same(id,st)||st.size!==bytes.length)fail('PRIMARY_START_STORAGE_UNAVAILABLE');
     await f.close();f=undefined;if(poisoned)fail('PRIMARY_START_STORAGE_UNAVAILABLE');count++;total+=bytes.length;uncertain=false;
    }catch{uncertain=true;poisoned=true;return fail('PRIMARY_START_STORAGE_UNAVAILABLE');}finally{if(f)await f.close().catch(()=>{});operating=false;}
   }};
   const value=await body(tx);if(poisoned||operating){poisoned=true;fail('PRIMARY_START_STORAGE_UNAVAILABLE');}return value;
  }finally{
   closed=true;if(operating){poisoned=true;uncertain=true;}
   if(lock){
    await lock.close().catch(()=>{uncertain=true;poisoned=true;});
    if(poisoned)fail('PRIMARY_START_STORAGE_UNAVAILABLE');
    if(!uncertain){try{await check(true);const st=await lstat(lockPath);if(!st.isFile()||st.isSymbolicLink()||!lockId||!same(st,lockId))fail('PRIMARY_START_STORAGE_UNAVAILABLE');await unlink(lockPath);}catch{fail('PRIMARY_START_STORAGE_UNAVAILABLE');}}
   }
  }
 }
}
