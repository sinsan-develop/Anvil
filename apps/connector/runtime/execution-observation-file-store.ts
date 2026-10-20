import {constants} from 'node:fs';
import {lstat,realpath,open,readdir,unlink,type FileHandle} from 'node:fs/promises';
import {isAbsolute,resolve,parse,join} from 'node:path';
import {canonicalJson,parseWireJson} from '../../../contracts/canonical.ts';
import {cloneV1,recordV1,uuidV1} from '../../../contracts/runtime/validation-v1.ts';
import type {SyntheticObservationSpoolStore} from './execution-observation-spool.ts';
type Scope=Parameters<SyntheticObservationSpoolStore['exclusive']>[0];
type Transaction=Parameters<SyntheticObservationSpoolStore['exclusive']>[1] extends (tx:infer T)=>unknown?T:never;
type Entry=Parameters<Transaction['appendAndSync']>[0];
type Identity={dev:number;ino:number};
const same=(a:Identity,b:Identity)=>a.dev===b.dev&&a.ino===b.ino;
const samePath=(a:string,b:string)=>process.platform==='win32'?a.toUpperCase()===b.toUpperCase():a===b;
const fail=(code:string):never=>{throw Error(code);};
const validScope=(v:unknown):v is Scope=>recordV1(v,['projectId','executionId','executionGeneration'])&&uuidV1(v.projectId)&&uuidV1(v.executionId)&&Number.isSafeInteger(v.executionGeneration)&&v.executionGeneration>0;

/** 실행별 기존 전용 root만 사용한다. root/ACL/키 생성·자동 불명 정리는 없다.
 * file.sync/재열기만 제공하며 directory fsync·전원손실·동일사용자 악의적 변조 내성은 보장하지 않는다.
 * metadata 문법/용량·순서만 저장부에서 확인하고 의미/hash/관측 주장은 상위 spool이 다시 대조하며 서버 ACK 감사/실권한을 만들지 않는다. */
export class SyntheticFileObservationSpoolStore implements SyntheticObservationSpoolStore{
 readonly transport='SYNTHETIC_ONLY' as const;
 #root:string;#scope:Scope;#maxBytes:number;#maxEntries:number;
 constructor(root:string,scope:Scope,limits:{maxBytes:number;maxEntries:number}){
  if(typeof root!=='string'||root.includes('\0')||!isAbsolute(root)||samePath(resolve(root),parse(resolve(root)).root)||!validScope(scope)||!limits||!Number.isSafeInteger(limits.maxBytes)||limits.maxBytes<1||limits.maxBytes>16*1024*1024||!Number.isSafeInteger(limits.maxEntries)||limits.maxEntries<1||limits.maxEntries>10000)fail('OBSERVATION_SPOOL_STORAGE_CONFIG_INVALID');
  this.#root=resolve(root);this.#scope=cloneV1(scope);this.#maxBytes=limits.maxBytes;this.#maxEntries=limits.maxEntries;
 }
 async exclusive<T>(scope:Scope,body:(tx:Transaction)=>Promise<T>):Promise<T>{
  if(!validScope(scope)||canonicalJson(scope)!==canonicalJson(this.#scope))return fail('OBSERVATION_SPOOL_SCOPE_MISMATCH');
  const directory=this.#root,lockPath=join(directory,'observation.lock');let identity:Identity,lockId:Identity|undefined,lock:FileHandle|undefined,poisoned=false,operating=false,closed=false;
  const active=()=>{if(closed||poisoned||operating){poisoned=true;fail('OBSERVATION_SPOOL_STORAGE_UNAVAILABLE');}};
  const check=async()=>{
   const s=await lstat(directory);if(!s.isDirectory()||s.isSymbolicLink()||!same(s,identity)||!samePath(await realpath(directory),directory))fail('OBSERVATION_SPOOL_STORAGE_UNAVAILABLE');
   if(lockId){const l=await lstat(lockPath);if(!l.isFile()||l.isSymbolicLink()||!same(l,lockId))fail('OBSERVATION_SPOOL_STORAGE_UNAVAILABLE');}
  };
  try{
   try{const s=await lstat(directory);identity={dev:s.dev,ino:s.ino};await check();}catch{return fail('OBSERVATION_SPOOL_STORAGE_UNAVAILABLE');}
   try{lock=await open(lockPath,'wx',0o600);lockId=await lock.stat();}catch(e:any){if(lock)poisoned=true;return fail(e.code==='EEXIST'?'OBSERVATION_SPOOL_JOURNAL_BUSY':'OBSERVATION_SPOOL_STORAGE_UNAVAILABLE');}
   try{await check();}catch{poisoned=true;return fail('OBSERVATION_SPOOL_STORAGE_UNAVAILABLE');}
   let loaded=false,count=0,total=0;
   const tx:Transaction={read:async()=>{
    active();operating=true;
    try{
     await check();const names=(await readdir(directory)).filter(n=>n!=='observation.lock').sort();if(names.length>this.#maxEntries)fail('OBSERVATION_SPOOL_STORAGE_UNAVAILABLE');const events:Entry[]=[];let bytesRead=0;
     for(let i=0;i<names.length;i++){
      if(names[i]!==String(i+1).padStart(6,'0')+'.json')fail('OBSERVATION_SPOOL_STORAGE_UNAVAILABLE');const path=join(directory,names[i]!),st=await lstat(path);
      if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>65536||st.size>this.#maxBytes||bytesRead+st.size>this.#maxBytes)fail('OBSERVATION_SPOOL_STORAGE_UNAVAILABLE');
      const f=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
      try{
       if(!same(st,await f.stat()))fail('OBSERVATION_SPOOL_STORAGE_UNAVAILABLE');const bytes=Buffer.alloc(st.size+1),read=await f.read(bytes,0,bytes.length,0);if(read.bytesRead!==st.size)fail('OBSERVATION_SPOOL_STORAGE_UNAVAILABLE');const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,read.bytesRead)),entry=parseWireJson(text);if(canonicalJson(entry)+'\n'!==text)fail('OBSERVATION_SPOOL_STORAGE_UNAVAILABLE');
       await check();const after=await lstat(path);if(!after.isFile()||after.isSymbolicLink()||!same(st,after)||after.size!==st.size||closed||poisoned)fail('OBSERVATION_SPOOL_STORAGE_UNAVAILABLE');events.push(entry as Entry);bytesRead+=st.size;
      }finally{await f.close();}
     }
     if(closed||poisoned)fail('OBSERVATION_SPOOL_STORAGE_UNAVAILABLE');count=events.length;total=bytesRead;loaded=true;return{complete:true,events};
    }catch{poisoned=true;return fail('OBSERVATION_SPOOL_STORAGE_UNAVAILABLE');}finally{operating=false;}
   },appendAndSync:async(raw:Entry)=>{
    active();let bytes:Buffer;
    try{const entry=cloneV1(raw);if(!loaded||count>=this.#maxEntries||entry?.snapshot?.event?.sequence!==count+1||canonicalJson({projectId:entry.snapshot.event.projectId,executionId:entry.snapshot.event.executionId,executionGeneration:entry.snapshot.event.executionGeneration})!==canonicalJson(this.#scope))return fail('OBSERVATION_SPOOL_STORAGE_SEQUENCE_INVALID');bytes=Buffer.from(canonicalJson(entry)+'\n');if(bytes.length>65536||bytes.length+total>this.#maxBytes)return fail('OBSERVATION_SPOOL_STORAGE_QUOTA');}catch(e){if(e instanceof Error&&['OBSERVATION_SPOOL_STORAGE_QUOTA','OBSERVATION_SPOOL_STORAGE_SEQUENCE_INVALID'].includes(e.message))throw e;return fail('OBSERVATION_SPOOL_STORAGE_ENTRY_INVALID');}
    operating=true;let f:FileHandle|undefined;
    try{
     await check();if(closed||poisoned)fail('OBSERVATION_SPOOL_STORAGE_UNAVAILABLE');const path=join(directory,String(count+1).padStart(6,'0')+'.json');f=await open(path,'wx',0o600);const id=await f.stat();await f.writeFile(bytes);await f.sync();await check();const st=await lstat(path);
     if(!st.isFile()||st.isSymbolicLink()||!same(st,id)||st.size!==bytes.length||closed||poisoned)fail('OBSERVATION_SPOOL_STORAGE_UNAVAILABLE');await f.close();f=undefined;if(closed||poisoned)fail('OBSERVATION_SPOOL_STORAGE_UNAVAILABLE');count++;total+=bytes.length;
    }catch{poisoned=true;return fail('OBSERVATION_SPOOL_STORAGE_UNAVAILABLE');}finally{if(f)await f.close().catch(()=>{poisoned=true;});operating=false;}
   }};
   const value=await body(tx);if(poisoned||operating){poisoned=true;return fail('OBSERVATION_SPOOL_STORAGE_UNAVAILABLE');}return value;
  }finally{
   closed=true;if(operating)poisoned=true;
   if(lock){await lock.close().catch(()=>{poisoned=true;});if(poisoned||!lockId)fail('OBSERVATION_SPOOL_STORAGE_UNAVAILABLE');try{await check();await unlink(lockPath);}catch{return fail('OBSERVATION_SPOOL_STORAGE_UNAVAILABLE');}}
  }
 }
}
