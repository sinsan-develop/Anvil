import {constants} from 'node:fs';
import {open,lstat,realpath,opendir,unlink,type FileHandle} from 'node:fs/promises';
import {isAbsolute,resolve,parse,join} from 'node:path';
import {canonicalJson,contentHash,parseWireJson} from '../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type AdapterContextV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1,readDispatchReceiptV1,type DispatchReceiptV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import type {RuntimeRefV1} from '../../../contracts/runtime/validation-v1.ts';

export interface InboxLimits{maxBytes:number;maxEntries:number}
type Identity={dev:number;ino:number};
const same=(a:Identity,b:Identity)=>a.dev===b.dev&&a.ino===b.ino;
const samePath=(a:string,b:string)=>process.platform==='win32'?a.toUpperCase()===b.toUpperCase():a===b;
const absent=(e:unknown)=>!!e&&typeof e==='object'&&'code'in e&&e.code==='ENOENT';
const exists=(e:unknown)=>!!e&&typeof e==='object'&&'code'in e&&e.code==='EEXIST';
const recordLimit=4096;

/**
 * 비권위 수신함: 검증한 key/hash/시각만 저장한다. Agent·소스·서버/credential·OS helper를 호출하지 않는다.
 * root는 호출자가 별도 승인/소유 확인한 기존 디렉터리여야 한다. 여기서 ACL/키·root를 만들지 않는다.
 * file.sync 증거는 directory metadata/전원손실·악의적 같은 OS 사용자·OS 보호/실행 허가 증명이 아니다.
 */
export async function receiveUnverifiedEnvelope(root:string,limits:InboxLimits,input:unknown,expected:{context:AdapterContextV1;executorRegistrationRef:RuntimeRefV1},nowMs:number):Promise<DispatchReceiptV1>{
 const e=readDispatchEnvelopeV1(input,nowMs),key=receiptKeyV1(e),at=new Date(nowMs).toISOString();
 const result=(state:DispatchReceiptV1['state'],reasonCode:DispatchReceiptV1['reasonCode'],duplicate=false,recordedAt=at):DispatchReceiptV1=>({schemaVersion:1,key,envelopeHash:e.envelopeHash,state,reasonCode,duplicate,recordedAt,executionAuthorized:false,dispatchPerformed:false});
 try{if(canonicalJson(expected)!==canonicalJson({context:e.context,executorRegistrationRef:e.executorRegistrationRef}))return result('REJECTED','CONTEXT_MISMATCH');}catch{return result('REJECTED','CONTEXT_MISMATCH');}
 if(!limits||!Number.isSafeInteger(limits.maxBytes)||limits.maxBytes<1||limits.maxBytes>1024**3||!Number.isSafeInteger(limits.maxEntries)||limits.maxEntries<1||limits.maxEntries>1024)throw Error('INBOX_LIMITS_INVALID');
 if(typeof root!=='string'||!isAbsolute(root)||root.includes('\0')||samePath(resolve(root),parse(resolve(root)).root))return result('UNKNOWN','STORAGE_UNAVAILABLE');
 const directory=resolve(root),lockPath=join(directory,'receive.lock'),path=join(directory,contentHash(canonicalJson(key))+'.json');
 let rootIdentity:Identity,lock:FileHandle|undefined,lockIdentity:Identity|undefined,recordAttempted=false,durableCompleted=false,response:DispatchReceiptV1=result('UNKNOWN','STORAGE_UNAVAILABLE');
 const checkRoot=async()=>{const st=await lstat(directory);if(!st.isDirectory()||st.isSymbolicLink()||!same(st,rootIdentity)||!samePath(await realpath(directory),directory))throw Error('STORAGE_UNAVAILABLE');};
 try{
  const st=await lstat(directory);if(!st.isDirectory()||st.isSymbolicLink()||!samePath(await realpath(directory),directory))return response;rootIdentity={dev:st.dev,ino:st.ino};
  // 별도 인스턴스도 exclusive 파일로 직렬화. 남은 lock은 UNKNOWN이며 자동 stale 해제하지 않는다.
  try{lock=await open(lockPath,'wx',0o600);lockIdentity=await lock.stat();}catch(cause){return result('UNKNOWN',exists(cause)?'INBOX_BUSY':'STORAGE_UNAVAILABLE');}
  await checkRoot();
  response=await locked();
 }catch{response=result('UNKNOWN','STORAGE_UNAVAILABLE');}
 finally{
  if(lock&&(!recordAttempted||durableCompleted)){
   try{await lock.close();await checkRoot();const st=await lstat(lockPath);if(st.isSymbolicLink()||!st.isFile()||!lockIdentity||!same(st,lockIdentity))throw Error('LOCK_IDENTITY_CHANGED');await unlink(lockPath);}catch{response=result('UNKNOWN','STORAGE_UNAVAILABLE');}
  }else if(lock){await lock.close().catch(()=>{});} // 불명 쓰기의 lock은 복구 대조 전 보존한다.
 }
 return response;

 async function locked():Promise<DispatchReceiptV1>{
  try{
   const before=await lstat(path);if(before.isSymbolicLink()||!before.isFile()||before.size>recordLimit)return result('UNKNOWN','RECORD_UNREADABLE');
   const f=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));let text:string;
   try{if(!same(before,await f.stat()))return result('UNKNOWN','RECORD_UNREADABLE');const bytes=Buffer.alloc(recordLimit+1),read=await f.read(bytes,0,bytes.length,0);if(read.bytesRead>recordLimit)return result('UNKNOWN','RECORD_UNREADABLE');text=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,read.bytesRead));await checkRoot();if(!same(before,await lstat(path)))return result('UNKNOWN','RECORD_UNREADABLE');}finally{await f.close();}
   const value=parseWireJson(text) as DispatchReceiptV1;
   const stored=readDispatchReceiptV1(value,{...e,envelopeHash:value.envelopeHash});
   if(stored.state!=='RECORDED'||stored.duplicate||text!==canonicalJson(stored)+'\n')return result('UNKNOWN','RECORD_UNREADABLE');
   if(stored.envelopeHash!==e.envelopeHash)return result('REJECTED','RECORD_CONFLICT');
   return result('RECORDED','UNVERIFIED_INBOX_ONLY',true,stored.recordedAt);
  }catch(cause){if(!absent(cause))return result('UNKNOWN','RECORD_UNREADABLE');}
  // lock 아래 유한 scan. 다른 key의 동시 기록도 quota 확인/생성 사이에 끼어들지 않는다.
  const stream=await opendir(directory);let count=0,size=0;
  try{for await(const entry of stream){if(entry.name==='receive.lock')continue;if(!/^[0-9a-f]{64}\.json$/.test(entry.name)||!entry.isFile()||entry.isSymbolicLink())return result('UNKNOWN','STORAGE_UNAVAILABLE');if(++count>limits.maxEntries)return result('REJECTED','LIMIT_REACHED');const st=await lstat(join(directory,entry.name));if(!st.isFile()||st.isSymbolicLink()||st.size>recordLimit)return result('UNKNOWN','RECORD_UNREADABLE');size+=st.size;if(size>limits.maxBytes)return result('REJECTED','LIMIT_REACHED');}}
  finally{await stream.close().catch(()=>{});}
  const receipt=result('RECORDED','UNVERIFIED_INBOX_ONLY'),bytes=Buffer.from(canonicalJson(receipt)+'\n');
  if(count>=limits.maxEntries||size+bytes.length>limits.maxBytes)return result('REJECTED','LIMIT_REACHED');
  await checkRoot();let f:FileHandle|undefined;
  try{recordAttempted=true;f=await open(path,'wx',0o600);const identity=await f.stat();await f.writeFile(bytes);await f.sync();await checkRoot();const after=await lstat(path);if(!after.isFile()||after.isSymbolicLink()||!same(identity,after)||after.size!==bytes.length)throw Error('RECORD_IDENTITY_CHANGED');await f.close();f=undefined;durableCompleted=true;return receipt;}
  catch{return result('UNKNOWN','STORAGE_UNAVAILABLE');}
  finally{if(f)await f.close().catch(()=>{});} // 기록 실패의 부분 파일은 삭제/재작성하지 않는다.
 }
}
