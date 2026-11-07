import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import type {BigIntStats} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {normalizeInput,validRelativePath} from './file-manifest-input.ts';
import type {FileManifest,FileManifestInput,ManifestEntry} from './file-manifest-input.ts';
import {verifyFileManifest} from './file-manifest.ts';
import type {FileBundleInput,FileBundleResult,BundleIssueCode,CleanupEntry} from './file-bundle-input.ts';

class BundleFailure extends Error {
  code:BundleIssueCode;
  constructor(code:BundleIssueCode){super(code);this.code=code;}
}
const reject=(code:BundleIssueCode):never=>{throw new BundleFailure(code);};
const sameIdentity=(a:BigIntStats,b:BigIntStats)=>a.dev===b.dev && a.ino===b.ino && a.mode===b.mode;
const sameFile=(a:BigIntStats,b:BigIntStats)=>sameIdentity(a,b) && a.nlink===b.nlink && a.size===b.size && a.mtimeNs===b.mtimeNs && a.ctimeNs===b.ctimeNs;
const equalPath=(a:string,b:string)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
const contained=(root:string,target:string)=>{const r=path.relative(root,target);return r!=='' && r!=='..' && !r.startsWith('..'+path.sep) && !path.isAbsolute(r);};
type Handle=Awaited<ReturnType<typeof fs.open>>;
type Owned={target:string;stat:BigIntStats|null;directory:boolean};

/** 순차·유한 패스만 수행하며 권한·비밀 탐지·OS 격리·전원 장애 영속성을 보증하지 않는다. */
export async function createFileBundle(raw:FileBundleInput):Promise<FileBundleResult> {
  const started=performance.now();
  let input:FileManifestInput|null=null;
  let manifest:FileManifest|null=null;
  let parent='',destination='',name='';
  let baseline:FileBundleInput['baseline'];
  const owned:Owned[]=[];
  let parentIdentity:BigIntStats|undefined;
  let currentPath:string|undefined;
  const budget=()=>{
    if(input?.signal?.aborted) reject('CANCELLED');
    if(input && performance.now()-started>=input!.limits.maxDurationMs) reject('TIME_LIMIT');
  };
  const remainingInput=(root:string):FileManifestInput=>{
    budget();
    const remaining=input!.limits.maxDurationMs-(performance.now()-started);
    if(remaining<1) reject('TIME_LIMIT');
    return {...input!,root,limits:{...input!.limits,maxDurationMs:Math.floor(remaining)}};
  };
  async function chain(target:string,checkBudget=true):Promise<void> {
    let current=path.parse(target).root;
    for(const part of ['',...target.slice(current.length).split(path.sep).filter(Boolean)]) {
      if(part) current=path.join(current,part);
      if(checkBudget) budget();
      const s=await fs.lstat(current,{bigint:true});
      if(s.isSymbolicLink() || !s.isDirectory() || !equalPath(await fs.realpath(current),current)) reject('PATH_UNSAFE');
      if(checkBudget) budget();
    }
  }
  async function parentSafe(checkBudget=true):Promise<void> {
    await chain(parent,checkBudget);
    const s=await fs.lstat(parent,{bigint:true});
    if(parentIdentity && !sameIdentity(parentIdentity,s)) reject('DESTINATION_UNSAFE');
  }
  async function ownedAncestors(target:string,checkBudget=true):Promise<void> {
    await parentSafe(checkBudget);
    for(const item of owned) {
      if(!item.directory || (item.target!==target && !contained(item.target,target))) continue;
      const s=await fs.lstat(item.target,{bigint:true});
      if(!item.stat || s.isSymbolicLink() || !s.isDirectory() || !sameIdentity(item.stat,s)) reject('DESTINATION_UNSAFE');
    }
    if(checkBudget) budget();
  }
  async function createDirectory(target:string):Promise<void> {
    await ownedAncestors(path.dirname(target));budget();
    await fs.mkdir(target); // 비재귀 생성으로 기존 빈 목적지도 거절한다.
    const item:Owned={target,stat:null,directory:true};owned.push(item);
    item.stat=await fs.lstat(target,{bigint:true});
    if(item.stat.isSymbolicLink() || !item.stat.isDirectory()) reject('DESTINATION_UNSAFE');
    budget();
  }
  async function sourceFile(entry:ManifestEntry):Promise<{target:string;stat:BigIntStats}> {
    const target=path.resolve(input!.root,...entry.path.split('/'));
    if(!contained(input!.root,target)) reject('PATH_UNSAFE');
    await chain(path.dirname(target));
    const stat=await fs.lstat(target,{bigint:true});budget();
    if(stat.isSymbolicLink() || !stat.isFile() || !equalPath(await fs.realpath(target),target)) reject('PATH_UNSAFE');
    budget();return {target,stat};
  }
  async function closeHandles(handles:(Handle|undefined)[]):Promise<void> {
    let failed=false;
    for(const handle of handles) if(handle) try {await handle.close();} catch {failed=true;}
    if(failed) reject('CLOSE_FAILED');
  }
  async function writeNew(target:string,write:(handle:Handle)=>Promise<void>):Promise<void> {
    await ownedAncestors(path.dirname(target));budget();
    let handle:Handle|undefined, failure:unknown;
    let item:Owned|undefined;
    try {
      handle=await fs.open(target,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|(constants.O_NOFOLLOW??0),0o600);
      item={target,stat:null,directory:false};owned.push(item);
      item.stat=await handle.stat({bigint:true});budget();
      if(!item.stat.isFile()) reject('DESTINATION_UNSAFE');
      await write(handle);
    } catch(e) {failure=e;} finally {
      if(handle && item) try {item.stat=await handle.stat({bigint:true});} catch {item.stat=null;failure??=new BundleFailure('WRITE_FAILED');}
      try {await closeHandles([handle]);} catch(e) {failure=e;}
    }
    if(failure) throw failure;
    await ownedAncestors(path.dirname(target));budget();
    const current=await fs.lstat(target,{bigint:true});budget();
    if(!item?.stat || current.isSymbolicLink() || !sameFile(item.stat,current)) reject('DESTINATION_UNSAFE');
  }
  async function writeBuffer(handle:Handle,data:Buffer):Promise<void> {
    let offset=0;
    while(offset<data.length) {
      budget();const {bytesWritten}=await handle.write(data,offset,data.length-offset,null);budget();
      if(bytesWritten<=0 || bytesWritten>data.length-offset) reject('WRITE_FAILED');
      offset+=bytesWritten;
    }
  }
  async function verify(root:string):Promise<void> {
    const result=await verifyFileManifest(remainingInput(root),manifest,baseline);
    budget();
    if(!result.valid) reject(result.issues.find(i=>i.code==='CANCELLED'||i.code==='TIME_LIMIT')?.code ?? 'CONTENT_MISMATCH');
  }
  async function cleanup():Promise<CleanupEntry[]> {
    const entries:CleanupEntry[]=[];
    for(const item of [...owned].reverse()) {
      const relative=path.relative(destination,item.target).replaceAll('\\','/')||'.';
      try {
        // 기한이 지나도 소유 범위 회수는 시도하며 unknown은 보존한다.
        await ownedAncestors(path.dirname(item.target),false);
        const s=await fs.lstat(item.target,{bigint:true});
        if(!item.stat || s.isSymbolicLink() || (item.directory?!s.isDirectory()||!sameIdentity(item.stat,s):!s.isFile()||!sameFile(item.stat,s))) {
          entries.push({path:relative,state:'preserved',reason:'UNKNOWN_OR_CHANGED'});continue;
        }
        if(item.directory) await fs.rmdir(item.target); else await fs.unlink(item.target);
        entries.push({path:relative,state:'removed'});
      } catch(e) {
        if((e as NodeJS.ErrnoException)?.code==='ENOENT') entries.push({path:relative,state:'preserved',reason:'IDENTITY_UNCONFIRMED'});
        else entries.push({path:relative,state:'preserved',reason:'CLEANUP_FAILED'});
      }
    }
    return entries;
  }
  try {
    // 전체 입력과 원래 독립 기준을 최초 await 전에 고정하고 같은 Signal의 후속 취소는 관측한다.
    input=normalizeInput(raw?.source);
    if(!input || typeof raw.destinationParent!=='string' || !path.isAbsolute(raw.destinationParent) || /[\x00-\x1f]/.test(raw.destinationParent) || typeof raw.destinationName!=='string' || !validRelativePath(raw.destinationName) || raw.destinationName.includes('/')) reject('INVALID_INPUT');
    parent=path.resolve(raw.destinationParent);name=raw.destinationName;destination=path.join(parent,name);
    manifest=JSON.parse(JSON.stringify(raw.manifest)) as FileManifest;
    baseline=JSON.parse(JSON.stringify(raw.baseline)) as FileBundleInput['baseline'];
    if(equalPath(input!.root,destination) || contained(input!.root,destination) || contained(destination,input!.root)) reject('DESTINATION_UNSAFE');
    budget();await chain(input!.root);await chain(parent);budget();
    parentIdentity=await fs.lstat(parent,{bigint:true});budget();
    await verify(input!.root); // 독립 선택/version/hash를 기존 읽기 엔진으로 검사한 뒤 생성한다.
    try {await fs.lstat(destination);reject('DESTINATION_EXISTS');} catch(e) {if((e as NodeJS.ErrnoException)?.code!=='ENOENT') throw e;}
    await createDirectory(destination);
    const payload=path.join(destination,'payload');await createDirectory(payload);
    const directories=new Set<string>([payload]);
    let total=0;
    for(const entry of manifest!.entries) {
      if(entry.status!=='included') continue;
      currentPath=entry.path;budget();
      const target=path.resolve(payload,...entry.path.split('/'));
      if(!contained(payload,target)) reject('PATH_UNSAFE');
      let dir=payload;
      for(const component of entry.path.split('/').slice(0,-1)) {
        dir=path.join(dir,component);
        if(!directories.has(dir)) {await createDirectory(dir);directories.add(dir);}
      }
      const initial=await sourceFile(entry);
      if(initial.stat.size>BigInt(input!.limits.maxFileBytes)) reject('FILE_LIMIT');
      if(initial.stat.size>BigInt(input!.limits.maxTotalBytes-total)) reject('TOTAL_LIMIT');
      let sourceHandle:Handle|undefined;
      let sourceError:unknown;
      try {
        sourceHandle=await fs.open(initial.target,constants.O_RDONLY|(constants.O_NOFOLLOW??0));budget();
        const before=await sourceHandle.stat({bigint:true});budget();
        if(!before.isFile() || !sameFile(initial.stat,before)) reject('FILE_CHANGED');
        const hash=createHash('sha256');let bytes=0;
        await writeNew(target,async output=>{
          const chunk=Buffer.alloc(Math.min(65536,input!.limits.maxFileBytes));
          for(;;) {
            budget();const {bytesRead}=await sourceHandle!.read(chunk,0,chunk.length,null);budget();
            if(bytesRead===0) break;
            bytes+=bytesRead;total+=bytesRead;
            if(bytes>input!.limits.maxFileBytes) reject('FILE_LIMIT');
            if(total>input!.limits.maxTotalBytes) reject('TOTAL_LIMIT');
            const data=chunk.subarray(0,bytesRead);hash.update(data);await writeBuffer(output,data);
          }
          const after=await sourceHandle!.stat({bigint:true});
          const final=await sourceFile(entry);budget();
          if(!sameFile(before,after) || !sameFile(after,final.stat) || BigInt(bytes)!==before.size) reject('FILE_CHANGED');
          if(bytes!==entry.bytes || hash.digest('hex')!==entry.sha256) reject('CONTENT_MISMATCH');
        });
      } catch(e) {sourceError=e;} finally {try {await closeHandles([sourceHandle]);} catch(e) {sourceError=e;}}
      if(sourceError) throw sourceError;
      budget();
    }
    currentPath=undefined;
    const metadata=Buffer.from(JSON.stringify(manifest),'utf8');
    await writeNew(path.join(destination,'manifest.json'),handle=>writeBuffer(handle,metadata));
    await ownedAncestors(payload);await verify(payload);
    // metadata도 재읽고 최종 close·기한·취소 검사 뒤에만 성공을 반환한다.
    let metadataHandle:Handle|undefined;let metadataError:unknown;
    try {
      const target=path.join(destination,'manifest.json');await ownedAncestors(target);
      metadataHandle=await fs.open(target,constants.O_RDONLY|(constants.O_NOFOLLOW??0));budget();
      const before=await metadataHandle.stat({bigint:true});
      const original=owned.find(item=>item.target===target)!;
      if(!original.stat || !sameFile(original.stat,before)) reject('VERIFY_FAILED');
      // 기록한 길이와 여분 1byte·stat로 metadata 증가를 검출한다.
      const actual=Buffer.alloc(metadata.length);let offset=0;
      while(offset<actual.length) {budget();const r=await metadataHandle.read(actual,offset,actual.length-offset,null);budget();if(!r.bytesRead) reject('VERIFY_FAILED');offset+=r.bytesRead;}
      const extra=await metadataHandle.read(Buffer.alloc(1),0,1,null);budget();
      const after=await metadataHandle.stat({bigint:true});
      const final=await fs.lstat(target,{bigint:true});budget();
      if(extra.bytesRead || !actual.equals(metadata) || !sameFile(before,after) || !sameFile(after,final)) reject('VERIFY_FAILED');
    } catch(e) {metadataError=e;} finally {try {await closeHandles([metadataHandle]);} catch(e) {metadataError=e;}}
    if(metadataError) throw metadataError;
    await ownedAncestors(payload);budget();
    // 알려진 소유 항목만 존재하고 재읽기 이후 identity가 그대로인지 최종 대조한다.
    for(const item of owned) {
      await ownedAncestors(path.dirname(item.target));budget();
      const current=await fs.lstat(item.target,{bigint:true});budget();
      if(!item.stat || current.isSymbolicLink() || (item.directory?!current.isDirectory()||!sameIdentity(item.stat,current):!current.isFile()||!sameFile(item.stat,current))) reject('VERIFY_FAILED');
      if(item.directory) {
        const expected=new Set(owned.filter(child=>path.dirname(child.target)===item.target).map(child=>path.basename(child.target)));
        let directory:Awaited<ReturnType<typeof fs.opendir>>|undefined;
        let failure:unknown;
        try {
          directory=await fs.opendir(item.target);budget();
          // expected + 1까지만 읽어 unknown을 검출하므로 외부의 대량 생성도 무한 열거하지 않는다.
          const count=expected.size;
          for(let index=0;index<=count;index++) {
            budget();const entry=await directory.read();budget();
            if(!entry) {if(expected.size) reject('VERIFY_FAILED');break;}
            if(!expected.delete(entry.name)) reject('VERIFY_FAILED');
          }
        } catch(e) {failure=e;} finally {if(directory) try {await directory.close();} catch {failure=new BundleFailure('CLOSE_FAILED');}}
        if(failure) throw failure;
        budget();
      }
    }
    const result:FileBundleResult={complete:true,state:'complete',manifest,issues:[],cleanup:[]};
    budget();return result;
  } catch(e) {
    const code=e instanceof BundleFailure?e.code:(e as NodeJS.ErrnoException)?.code==='EEXIST'?'DESTINATION_EXISTS':(e as NodeJS.ErrnoException)?.code==='ENOENT'?'FILE_MISSING':input?'WRITE_FAILED':'INVALID_INPUT';
    const cleaned=await cleanup();
    return {complete:false,state:cleaned.some(item=>item.state==='preserved')?'partial':'failed',manifest,issues:[{code,...(currentPath?{path:currentPath}:{})}],cleanup:cleaned};
  }
}
