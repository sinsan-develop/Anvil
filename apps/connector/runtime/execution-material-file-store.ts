import {constants} from 'node:fs';
import {lstat,realpath,open,readdir,unlink,type FileHandle} from 'node:fs/promises';
import {isAbsolute,resolve,parse,join} from 'node:path';
import {canonicalJson,contentHash,parseWireJson} from '../../../contracts/canonical.ts';
import {recordV1,refV1,uuidV1,hashV1,isoV1,cloneV1,type RuntimeRefV1} from '../../../contracts/runtime/validation-v1.ts';
import type {ReceiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import type {SyntheticMaterialInbox,SyntheticMaterialInboxTransaction} from './execution-material-receiver.ts';
type Entry=Parameters<SyntheticMaterialInboxTransaction['appendAndSync']>[0];
type Identity={dev:number;ino:number};
const same=(a:Identity,b:Identity)=>a.dev===b.dev&&a.ino===b.ino;
const samePath=(a:string,b:string)=>process.platform==='win32'?a.toUpperCase()===b.toUpperCase():a===b;
const equal=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const fail=(code:string):never=>{throw Error(code);};
const validScope=(s:unknown):s is ReceiptKeyV1=>recordV1(s,['projectId','executionId','executionGeneration','commandId'])&&uuidV1(s.projectId)&&uuidV1(s.executionId)&&uuidV1(s.commandId)&&Number.isSafeInteger(s.executionGeneration)&&s.executionGeneration>0;

/** 기존 caller-owned 전용 root만 사용한다. bytes 파일 sync 뒤 metadata를 sync한다.
 * 고아 파일/불명 sync·lock은 자동 삭제/복구하지 않는다. root/ACL/키 생성0.
 * directory fsync·전원손실·악의적 동일 OS 사용자 변조 내성은 보장하지 않는다. */
export class SyntheticFileMaterialInbox implements SyntheticMaterialInbox{
 readonly transport='SYNTHETIC_ONLY' as const;
 #root:string;#scope:ReceiptKeyV1;#maxBytes:number;#maxParts:number;
 constructor(root:string,scope:ReceiptKeyV1,limits:{maxBytes:number;maxParts:number}){
  if(typeof root!=='string'||root.includes('\0')||!isAbsolute(root)||samePath(resolve(root),parse(resolve(root)).root)||!validScope(scope)||!limits||!Number.isSafeInteger(limits.maxBytes)||limits.maxBytes<1||limits.maxBytes>1024*1024*1024||!Number.isSafeInteger(limits.maxParts)||limits.maxParts<1||limits.maxParts>200)fail('MATERIAL_STORAGE_CONFIG_INVALID');this.#root=resolve(root);this.#scope=cloneV1(scope);this.#maxBytes=limits.maxBytes;this.#maxParts=limits.maxParts;
 }
 async exclusive<T>(scope:ReceiptKeyV1,body:(tx:SyntheticMaterialInboxTransaction)=>Promise<T>):Promise<T>{
  if(!validScope(scope)||!equal(scope,this.#scope))fail('MATERIAL_SCOPE_MISMATCH');
  const root=this.#root,lockPath=join(root,'material.lock');let identity:Identity,lock:FileHandle|undefined,lockId:Identity|undefined,operating=false,poisoned=false,uncertain=false;
  const check=async()=>{const st=await lstat(root);if(!st.isDirectory()||st.isSymbolicLink()||!same(st,identity)||!samePath(await realpath(root),root))fail('MATERIAL_STORAGE_UNAVAILABLE');if(lockId){const s=await lstat(lockPath);if(!s.isFile()||s.isSymbolicLink()||!same(s,lockId))fail('MATERIAL_STORAGE_UNAVAILABLE');}};
  try{
   try{const s=await lstat(root);identity=s;await check();}catch{return fail('MATERIAL_STORAGE_UNAVAILABLE');}
   try{lock=await open(lockPath,'wx',0o600);uncertain=true;lockId=await lock.stat();uncertain=false;}catch(e:any){return fail(e.code==='EEXIST'?'MATERIAL_INBOX_BUSY':'MATERIAL_STORAGE_UNAVAILABLE');}
   let loaded=false,count=0,total=0,metadataBytes=0;const files=new Map<string,{path:string;size:number}>();
   const enter=()=>{if(operating||poisoned){poisoned=true;uncertain=true;fail('MATERIAL_STORAGE_UNAVAILABLE');}operating=true;};
   const readBounded=async(path:string,max:number)=>{await check();if(poisoned)fail('MATERIAL_STORAGE_UNAVAILABLE');const before=await lstat(path);if(!before.isFile()||before.isSymbolicLink()||before.size<1||before.size>max)fail('MATERIAL_STORAGE_UNAVAILABLE');const f=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));try{if(!same(before,await f.stat()))fail('MATERIAL_STORAGE_UNAVAILABLE');const bytes=Buffer.alloc(before.size+1),r=await f.read(bytes,0,bytes.length,0);if(r.bytesRead!==before.size)fail('MATERIAL_STORAGE_UNAVAILABLE');await check();const after=await lstat(path);if(poisoned||!after.isFile()||after.isSymbolicLink()||!same(before,after)||after.size!==before.size)fail('MATERIAL_STORAGE_UNAVAILABLE');return bytes.subarray(0,r.bytesRead);}finally{await f.close();}};
   const validate=(entry:Entry,index:number,previous:RuntimeRefV1|null)=>{const s=entry?.snapshot;if(!recordV1(entry,['ref','snapshot'])||!refV1(entry.ref)||entry.ref.version!==1||entry.ref.contentHash!==hash(s)||!recordV1(s,['sequence','scope','envelopeHash','manifestHash','materialRef','recordedAt','previousRef'])||s.sequence!==index||!equal(s.scope,this.#scope)||!hashV1(s.envelopeHash)||!hashV1(s.manifestHash)||!refV1(s.materialRef)||!isoV1(s.recordedAt)||!equal(s.previousRef,previous))fail('MATERIAL_STORAGE_UNAVAILABLE');};
   const tx:SyntheticMaterialInboxTransaction={read:async()=>{
    enter();try{await check();const names=(await readdir(root)).filter(n=>n!=='material.lock').sort();if(names.length%2||names.length>this.#maxParts*2)fail('MATERIAL_STORAGE_UNAVAILABLE');const events:Entry[]=[],ids=new Set<string>();files.clear();total=0;metadataBytes=0;
     for(let i=0;i<names.length/2;i++){const base=String(i+1).padStart(6,'0');if(names[i*2]!==base+'.bin'||names[i*2+1]!==base+'.json')fail('MATERIAL_STORAGE_UNAVAILABLE');const bin=join(root,base+'.bin'),st=await lstat(bin);if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>2*1024*1024)fail('MATERIAL_STORAGE_UNAVAILABLE');const encoded=await readBounded(join(root,base+'.json'),65536),text=new TextDecoder('utf-8',{fatal:true}).decode(encoded),entry=parseWireJson(text) as Entry;if(canonicalJson(entry)+'\n'!==text)fail('MATERIAL_STORAGE_UNAVAILABLE');validate(entry,i+1,events.at(-1)?.ref??null);if(ids.has(entry.ref.id))fail('MATERIAL_STORAGE_UNAVAILABLE');ids.add(entry.ref.id);metadataBytes+=encoded.length;total+=encoded.length+st.size;if(total>this.#maxBytes||metadataBytes>2*1024*1024)fail('MATERIAL_STORAGE_UNAVAILABLE');files.set(canonicalJson(entry.ref),{path:bin,size:st.size});events.push(entry);}
     if(poisoned)fail('MATERIAL_STORAGE_UNAVAILABLE');count=events.length;loaded=true;return{complete:true,events};
    }catch{poisoned=true;uncertain=true;return fail('MATERIAL_STORAGE_UNAVAILABLE');}finally{operating=false;}
   },readPart:async(ref:RuntimeRefV1)=>{
    enter();try{if(!loaded||!refV1(ref))fail('MATERIAL_STORAGE_UNAVAILABLE');const f=files.get(canonicalJson(ref));if(!f)fail('MATERIAL_STORAGE_UNAVAILABLE');const bytes=await readBounded(f!.path,2*1024*1024);if(bytes.length!==f!.size)fail('MATERIAL_STORAGE_UNAVAILABLE');return new Uint8Array(bytes);}catch{poisoned=true;uncertain=true;return fail('MATERIAL_STORAGE_UNAVAILABLE');}finally{operating=false;}
   },appendAndSync:async(entry:Entry,raw:Uint8Array)=>{
    enter();let writing=false,f:FileHandle|undefined;
    try{if(!loaded||count>=this.#maxParts||!(raw instanceof Uint8Array)||raw.byteLength<1||raw.byteLength>2*1024*1024)fail('MATERIAL_STORAGE_UNAVAILABLE');const events=files.size?await Promise.resolve([...files.keys()].map(k=>JSON.parse(k) as RuntimeRefV1)):[],previous=events.at(-1)??null;validate(entry,count+1,previous);if(events.some(r=>r.id===entry.ref.id))fail('MATERIAL_STORAGE_UNAVAILABLE');const metadata=Buffer.from(canonicalJson(entry)+'\n'),bytes=Buffer.from(raw);if(metadata.length>65536||metadataBytes+metadata.length>2*1024*1024||total+metadata.length+bytes.length>this.#maxBytes)fail('MATERIAL_STORAGE_QUOTA');await check();if(poisoned)fail('MATERIAL_STORAGE_UNAVAILABLE');writing=true;uncertain=true;
     const base=String(count+1).padStart(6,'0'),bin=join(root,base+'.bin');for(const [path,data]of [[bin,bytes],[join(root,base+'.json'),metadata]] as const){await check();if(poisoned)fail('MATERIAL_STORAGE_UNAVAILABLE');f=await open(path,'wx',0o600);const before=await f.stat();await f.writeFile(data);await f.sync();await check();const after=await lstat(path);if(poisoned||!after.isFile()||after.isSymbolicLink()||!same(before,after)||after.size!==data.length)fail('MATERIAL_STORAGE_UNAVAILABLE');await f.close();f=undefined;}
     files.set(canonicalJson(entry.ref),{path:bin,size:bytes.length});count++;total+=bytes.length+metadata.length;metadataBytes+=metadata.length;uncertain=false;
    }catch{if(writing){poisoned=true;uncertain=true;}return fail(writing||poisoned?'MATERIAL_STORAGE_UNAVAILABLE':'MATERIAL_STORAGE_QUOTA');}finally{if(f)await f.close().catch(()=>{poisoned=true;uncertain=true;});operating=false;}
   }};
   const result=await body(tx);if(poisoned||operating){poisoned=true;uncertain=true;fail('MATERIAL_STORAGE_UNAVAILABLE');}return result;
  }finally{
   if(operating){poisoned=true;uncertain=true;}if(lock){await lock.close().catch(()=>{poisoned=true;uncertain=true;});if(poisoned)fail('MATERIAL_STORAGE_UNAVAILABLE');if(!uncertain){try{await check();if(!lockId)fail('MATERIAL_STORAGE_UNAVAILABLE');await unlink(lockPath);}catch{return fail('MATERIAL_STORAGE_UNAVAILABLE');}}}
  }
 }
}
