import {constants} from 'node:fs';
import {lstat,realpath,open,readdir,mkdir,unlink,type FileHandle} from 'node:fs/promises';
import {isAbsolute,resolve,parse,join} from 'node:path';
import {canonicalJson,parseWireJson} from '../../../contracts/canonical.ts';
import {cloneV1,recordV1,uuidV1,hashV1} from '../../../contracts/runtime/validation-v1.ts';
import type {ClientJournalScope,ClientEntry,SyntheticClientStore,SyntheticClientTransaction} from './execution-ledger.ts';
type Scope=Omit<ClientJournalScope,'requestKey'>;
type Identity={dev:number;ino:number};
const same=(a:Identity,b:Identity)=>a.dev===b.dev&&a.ino===b.ino;
const samePath=(a:string,b:string)=>process.platform==='win32'?a.toUpperCase()===b.toUpperCase():a===b;
const fail=(code:string):never=>{throw Error(code);};
const validScope=(v:unknown):v is Scope=>recordV1(v,['projectId','executionId','executionGeneration'])&&uuidV1(v.projectId)&&uuidV1(v.executionId)&&Number.isSafeInteger(v.executionGeneration)&&v.executionGeneration>0;
const maxJournalBytes=2*1024*1024;

/** 호출자가 소유 확인한 기존 전용 root만 사용한다. root/ACL/키를 생성하지 않는다.
 * file.sync 뒤 기록만 인정하며 불명 기록/lock을 자동 삭제·복구하지 않는다.
 * directory fsync·전원손실·동일 OS 사용자의 악의적 변조 내성은 보장하지 않는다. */
export class SyntheticFileClientStore implements SyntheticClientStore{
 readonly transport='SYNTHETIC_ONLY' as const;
 #root:string;#scope:Scope;#maxBytes:number;#maxRequests:number;
 constructor(root:string,scope:Scope,limits:{maxBytes:number;maxRequests:number}){
  if(typeof root!=='string'||root.includes('\0')||!isAbsolute(root)||samePath(resolve(root),parse(resolve(root)).root)||!validScope(scope)||!limits||!Number.isSafeInteger(limits.maxBytes)||limits.maxBytes<1||limits.maxBytes>1024*1024*1024||!Number.isSafeInteger(limits.maxRequests)||limits.maxRequests<1||limits.maxRequests>10000)fail('CLIENT_STORAGE_CONFIG_INVALID');
  this.#root=resolve(root);this.#scope=cloneV1(scope);this.#maxBytes=limits.maxBytes;this.#maxRequests=limits.maxRequests;
 }
 async exclusive<T>(scope:ClientJournalScope,body:(tx:SyntheticClientTransaction)=>Promise<T>):Promise<T>{
  if(!recordV1(scope,['projectId','executionId','executionGeneration','requestKey'])||!hashV1(scope.requestKey)||canonicalJson({projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration})!==canonicalJson(this.#scope))return fail('CLIENT_SCOPE_MISMATCH');
  const root=this.#root,directory=join(root,scope.requestKey),lockPath=join(root,'client.lock');let identity:Identity,childId:Identity|undefined,lock:FileHandle|undefined,lockId:Identity|undefined,poisoned=false,uncertain=false,operating=false;
  const checkDirectory=async(path:string,id:Identity)=>{const s=await lstat(path);if(!s.isDirectory()||s.isSymbolicLink()||!same(s,id)||!samePath(await realpath(path),path))fail('CLIENT_STORAGE_UNAVAILABLE');};
  const check=async()=>{await checkDirectory(root,identity);if(lockId){const s=await lstat(lockPath);if(!s.isFile()||s.isSymbolicLink()||!same(s,lockId))fail('CLIENT_STORAGE_UNAVAILABLE');}if(childId)await checkDirectory(directory,childId);};
  try{
   try{const s=await lstat(root);identity={dev:s.dev,ino:s.ino};await checkDirectory(root,identity);}catch{return fail('CLIENT_STORAGE_UNAVAILABLE');}
   try{lock=await open(lockPath,'wx',0o600);lockId=await lock.stat();}catch(e:any){return fail(e.code==='EEXIST'?'CLIENT_JOURNAL_BUSY':'CLIENT_STORAGE_UNAVAILABLE');}
   await check();let loaded=false,count=0,total=0,journalBytes=0,requests=0;
   const tx:SyntheticClientTransaction={read:async()=>{
    if(poisoned||operating){poisoned=true;uncertain=true;return fail('CLIENT_STORAGE_UNAVAILABLE');}operating=true;
    try{
     await check();const names=(await readdir(root)).filter(n=>n!=='client.lock').sort();if(names.length>this.#maxRequests)fail('CLIENT_STORAGE_UNAVAILABLE');requests=names.length;total=0;journalBytes=0;const events:ClientEntry[]=[];
     for(const name of names){
      if(!/^[0-9a-f]{64}$/.test(name))fail('CLIENT_STORAGE_UNAVAILABLE');const dir=join(root,name),d=await lstat(dir);await checkDirectory(dir,d);if(name===scope.requestKey)childId=d;
      const files=(await readdir(dir)).sort();if(files.length>6)fail('CLIENT_STORAGE_UNAVAILABLE');let bytesInRequest=0;
      for(let i=0;i<files.length;i++){
       if(files[i]!==String(i+1).padStart(6,'0')+'.json')fail('CLIENT_STORAGE_UNAVAILABLE');const path=join(dir,files[i]!),st=await lstat(path);
       if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>maxJournalBytes||bytesInRequest+st.size>maxJournalBytes||total+st.size>this.#maxBytes)fail('CLIENT_STORAGE_UNAVAILABLE');
       const f=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));try{
        if(!same(st,await f.stat()))fail('CLIENT_STORAGE_UNAVAILABLE');const bytes=Buffer.alloc(st.size+1),r=await f.read(bytes,0,bytes.length,0);if(r.bytesRead!==st.size)fail('CLIENT_STORAGE_UNAVAILABLE');const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,r.bytesRead)),entry=parseWireJson(text);if(canonicalJson(entry)+'\n'!==text)fail('CLIENT_STORAGE_UNAVAILABLE');
        await checkDirectory(dir,d);await check();const after=await lstat(path);if(!after.isFile()||after.isSymbolicLink()||!same(st,after)||st.size!==after.size)fail('CLIENT_STORAGE_UNAVAILABLE');if(name===scope.requestKey)events.push(entry as ClientEntry);
       }finally{await f.close();}bytesInRequest+=st.size;total+=st.size;
      }if(name===scope.requestKey)journalBytes=bytesInRequest;
     }count=events.length;loaded=true;return{complete:true,events};
    }catch{poisoned=true;uncertain=true;return fail('CLIENT_STORAGE_UNAVAILABLE');}finally{operating=false;}
   },appendAndSync:async(entry:ClientEntry)=>{
    if(poisoned||operating){poisoned=true;uncertain=true;return fail('CLIENT_STORAGE_UNAVAILABLE');}operating=true;let f:FileHandle|undefined,writing=false;
    try{
     if(!loaded||count>=6||entry?.snapshot?.sequence!==count+1||entry.snapshot.requestKey!==scope.requestKey)fail('CLIENT_STORAGE_UNAVAILABLE');const bytes=Buffer.from(canonicalJson(entry)+'\n');
     if(journalBytes+bytes.length>maxJournalBytes||total+bytes.length>this.#maxBytes||!childId&&requests>=this.#maxRequests)fail('CLIENT_STORAGE_QUOTA');
     await check();if(poisoned)fail('CLIENT_STORAGE_UNAVAILABLE');writing=true;uncertain=true;if(!childId){await mkdir(directory,{mode:0o700});childId=await lstat(directory);requests++;await check();}
     const path=join(directory,String(count+1).padStart(6,'0')+'.json');f=await open(path,'wx',0o600);const before=await f.stat();await f.writeFile(bytes);await f.sync();await check();const after=await lstat(path);if(!after.isFile()||after.isSymbolicLink()||!same(before,after)||after.size!==bytes.length)fail('CLIENT_STORAGE_UNAVAILABLE');
     await f.close();f=undefined;if(poisoned)fail('CLIENT_STORAGE_UNAVAILABLE');count++;journalBytes+=bytes.length;total+=bytes.length;uncertain=false;
    }catch{if(writing){poisoned=true;uncertain=true;}return fail(writing?'CLIENT_STORAGE_UNAVAILABLE':'CLIENT_STORAGE_QUOTA');}finally{if(f)await f.close().catch(()=>{poisoned=true;uncertain=true;});operating=false;}
   }};
   const value=await body(tx);if(poisoned||operating){poisoned=true;uncertain=true;fail('CLIENT_STORAGE_UNAVAILABLE');}return value;
  }finally{
   if(operating){poisoned=true;uncertain=true;}
   if(lock){await lock.close().catch(()=>{poisoned=true;uncertain=true;});if(poisoned)fail('CLIENT_STORAGE_UNAVAILABLE');if(!uncertain){try{await check();await unlink(lockPath);}catch{return fail('CLIENT_STORAGE_UNAVAILABLE');}}}
  }
 }
}
