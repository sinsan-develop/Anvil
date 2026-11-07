import {constants,type Stats} from 'node:fs';
import {lstat,realpath,readdir,open,unlink,type FileHandle} from 'node:fs/promises';
import {isAbsolute,resolve,parse,dirname,join} from 'node:path';
import {canonicalJson,parseWireJson} from '../../../contracts/canonical.ts';
import {validateProviderSessionClaim,verifyProviderHandleBinding} from '../../../contracts/runtime/provider-session-claim-v1.ts';
import {hashV1,recordV1} from '../../../contracts/runtime/validation-v1.ts';
import type {SyntheticProviderCaptureResultStore} from './provider-capture-results.ts';

type Transaction=Parameters<Parameters<SyntheticProviderCaptureResultStore['exclusive']>[0]>[0];
type Row=Parameters<Transaction['appendAndSync']>[0];
type Identity={dev:number;ino:number};
type Directory={path:string;identity:Identity};
type FileState={path:string;stat:Stats};
const maxRows=512,maxBytes=2*1024*1024,lockName='provider-capture-results.lock';
const sameId=(a:Identity,b:Identity)=>a.dev===b.dev&&a.ino===b.ino;
const samePath=(a:string,b:string)=>process.platform==='win32'?a.toUpperCase()===b.toUpperCase():a===b;
const fileName=(n:number)=>String(n).padStart(6,'0')+'.json';
const fail=():never=>{throw Error('PROVIDER_CAPTURE_RESULTS_STORAGE_UNAVAILABLE');};
const sameFile=(a:Stats,b:Stats)=>a.isFile()&&b.isFile()&&!a.isSymbolicLink()&&!b.isSymbolicLink()&&a.nlink===1&&b.nlink===1&&sameId(a,b)&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
function row(raw:unknown):Row{
 if(!recordV1(raw,['claim','claimRef','ciphertextHash','parent'])||!hashV1(raw.ciphertextHash))return fail();
 const checked=validateProviderSessionClaim(raw.claim,raw.parent===null?undefined:raw.parent);
 if(canonicalJson(checked.ref)!==canonicalJson(raw.claimRef))return fail();
 verifyProviderHandleBinding(checked.claim,raw.ciphertextHash,raw.parent===null?undefined:raw.parent);
 return{claim:checked.claim,claimRef:checked.ref,ciphertextHash:raw.ciphertextHash,parent:raw.parent===null?null:validateProviderSessionClaim(raw.parent).claim};
}
function bounded(entries:Row[]):void{
 if(entries.length>maxRows||Buffer.byteLength(canonicalJson({complete:true,entries}))>maxBytes)fail();
}

/** 호출자가 소유 확인한 전용 root를 명시 주입한다. 기본 등록/자동 root 생성/ACL 변경은 없다.
 * 저장 대상은 기존 결과 포트의 claim/claimRef/ciphertextHash/parent뿐이다. 부모 원장 관계,
 * 중복/충돌과 현재 기한의 최종 검사는 기존 SyntheticProviderCaptureResults가 수행한다.
 * 상위/root nonlink·실경로·정체성과 파일 정체성, 정규 UTF8 JSON·배타 lock·file.sync를 검사한다.
 * 소유자/실제 OS 권위·보호/악성 동일 사용자 내성·directory fsync/전원손실 내구성의 증거는 아니다.
 * 손상·부분 쓰기·취소·상태 불명/남은 lock은 보존한다. 성공 sync 후 callback 실패는 행을
 * 지우지 않고 소유가 확인된 lock만 회수한다. 복구/데이터 삭제/재시도 기능은 제공하지 않는다. */
export class SyntheticProviderCaptureResultsFileStore implements SyntheticProviderCaptureResultStore{
 readonly transport='SYNTHETIC_ONLY' as const;
 #root:string;#directories:Directory[]|undefined;
 constructor(root:string){
  if(typeof root!=='string'||root.includes('\0')||!isAbsolute(root)||samePath(resolve(root),parse(resolve(root)).root))fail();
  this.#root=resolve(root);
 }
 async #checkDirectories():Promise<void>{
  if(!this.#directories){
   const paths:string[]=[];let path=this.#root;
   for(;;){paths.unshift(path);const parent=dirname(path);if(parent===path)break;path=parent;}
   const directories:Directory[]=[];
   for(const current of paths){const st=await lstat(current);if(!st.isDirectory()||st.isSymbolicLink()||!samePath(await realpath(current),current))fail();directories.push({path:current,identity:{dev:st.dev,ino:st.ino}});}
   // 동일 instance의 동시에 시작한 두 호출도 먼저 고정된 정체성을 덮어쓰지 않는다.
   if(!this.#directories)this.#directories=directories;
  }
  for(const directory of this.#directories){const st=await lstat(directory.path);if(!st.isDirectory()||st.isSymbolicLink()||!sameId(st,directory.identity)||!samePath(await realpath(directory.path),directory.path))fail();}
 }
 async exclusive<T>(body:(tx:Transaction)=>Promise<T>,signal:AbortSignal):Promise<T>{
  if(!(signal instanceof AbortSignal)||signal.aborted||typeof body!=='function')return fail();
  const lockPath=join(this.#root,lockName);
  let lock:FileHandle|undefined,lockIdentity:Identity|undefined,closed=false,poisoned=false,uncertain=false,operating=false;
  let pending:Promise<unknown>|undefined,listener:(()=>void)|undefined;
  const guard=async()=>{
   if(closed||signal.aborted)return fail();await this.#checkDirectories();if(closed||signal.aborted)return fail();
   if(lock){const st=await lstat(lockPath);if(!lockIdentity||!st.isFile()||st.isSymbolicLink()||st.nlink!==1||st.size!==0||!sameId(st,lockIdentity))fail();}
   if(closed||signal.aborted)return fail();
  };
  const operation=<V>(work:()=>Promise<V>):Promise<V>=>{
   if(closed)return Promise.reject(Error('PROVIDER_CAPTURE_RESULTS_STORAGE_UNAVAILABLE'));
   if(operating||poisoned){poisoned=true;uncertain=true;return Promise.reject(Error('PROVIDER_CAPTURE_RESULTS_STORAGE_UNAVAILABLE'));}
   operating=true;
   const promise=(async()=>{try{await guard();const value=await work();await guard();if(poisoned)return fail();return value;}catch{poisoned=true;uncertain=true;return fail();}finally{operating=false;}})();
   pending=promise;return promise;
  };
  try{
   await guard();lock=await open(lockPath,'wx',0o600);uncertain=true;
   const initialLock=await lock.stat();if(!initialLock.isFile()||initialLock.nlink!==1||initialLock.size!==0)fail();
   lockIdentity={dev:initialLock.dev,ino:initialLock.ino};await guard();uncertain=false;
   let entries:Row[]|undefined,files:FileState[]=[];
   const names=async()=>{const value=(await readdir(this.#root)).filter(name=>name!==lockName).sort();if(value.length>maxRows||value.some((name,i)=>name!==fileName(i+1)))fail();return value;};
   const unchanged=async()=>{
    const current=await names();if(current.length!==files.length)fail();
    for(let i=0;i<files.length;i++){const file=files[i]!;if(current[i]!==fileName(i+1)||!sameFile(file.stat,await lstat(file.path)))fail();}
    await guard();
   };
   const tx:Transaction={read:()=>operation(async()=>{
    const selected=await names(),loaded:Row[]=[],observed:FileState[]=[];let physicalBytes=0;
    for(const name of selected){
     const path=join(this.#root,name),before=await lstat(path);
     // 기존 ledger의 2MiB는 JSON envelope 상한이며 각 행 LF만 물리 크기에 추가된다.
     physicalBytes+=before.size;if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size<1||before.size>maxBytes+1||physicalBytes>maxBytes+maxRows)fail();
     const file=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
     try{
      if(!sameFile(before,await file.stat()))fail();const bytes=Buffer.alloc(before.size+1);let length=0;
      while(length<bytes.length){const result=await file.read(bytes,length,bytes.length-length,length);if(result.bytesRead===0)break;length+=result.bytesRead;}
      if(length!==before.size)fail();
      const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes.subarray(0,length)),value=parseWireJson(text);
      if(canonicalJson(value)+'\n'!==text)fail();loaded.push(row(value));
      await guard();if(!sameFile(before,await file.stat())||!sameFile(before,await lstat(path)))fail();
      observed.push({path,stat:before});
     }finally{await file.close();}
    }
    bounded(loaded);files=observed;await unchanged();entries=loaded;
    return{complete:true,entries:loaded.map(value=>row(value))};
   }),appendAndSync:(raw:Row)=>{
    // 호출 즉시 순수 검증·복제로 고정하고 await 뒤 호출자 mutation을 사용하지 않는다.
    let fixed:Row;try{fixed=row(raw);}catch{if(!closed){poisoned=true;uncertain=true;}return Promise.reject(Error('PROVIDER_CAPTURE_RESULTS_STORAGE_UNAVAILABLE'));}
    return operation(async()=>{
     if(!entries)return fail();bounded([...entries,fixed]);await unchanged();
     const bytes=Buffer.from(canonicalJson(fixed)+'\n'),path=join(this.#root,fileName(entries.length+1));let file:FileHandle|undefined;
     uncertain=true;
     try{
      file=await open(path,'wx',0o600);const initial=await file.stat();if(!initial.isFile()||initial.nlink!==1||initial.size!==0)fail();
      await guard();await file.writeFile(bytes);await file.sync();await guard();
      const after=await file.stat();if(!sameId(initial,after)||after.size!==bytes.length||!sameFile(after,await lstat(path)))fail();
      await file.close();file=undefined;await guard();
      if(poisoned)fail();entries.push(fixed);files.push({path,stat:after});await unchanged();uncertain=false;
     }finally{if(file)await file.close();}
    });
   }};
   const aborted=new Promise<never>((_,reject)=>{listener=()=>{uncertain=true;poisoned=true;reject(Error('PROVIDER_CAPTURE_RESULTS_STORAGE_UNAVAILABLE'));};signal.addEventListener('abort',listener,{once:true});});
   await guard();const value=await Promise.race([Promise.resolve().then(()=>{if(closed||signal.aborted)return fail();return body(tx);}),aborted]);
   if(operating||poisoned){uncertain=true;poisoned=true;return fail();}await guard();return value;
  }catch{if(signal.aborted)uncertain=true;return fail();}
  finally{
   closed=true;if(listener)signal.removeEventListener('abort',listener);
   if(operating){poisoned=true;uncertain=true;await pending?.catch(()=>{});}
   if(lock){
    try{await lock.close();}catch{uncertain=true;poisoned=true;}
    if(!uncertain&&!poisoned){
     try{await this.#checkDirectories();const st=await lstat(lockPath);if(!lockIdentity||!st.isFile()||st.isSymbolicLink()||st.nlink!==1||st.size!==0||!sameId(st,lockIdentity))fail();await unlink(lockPath);}catch{return fail();}
    }
   }
  }
 }
}
