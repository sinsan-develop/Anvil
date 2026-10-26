import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import type {BigIntStats} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {normalizeInput,validRelativePath} from './file-manifest-input.ts';
import type {FileManifestInput,FileManifest,VerificationBaseline} from './file-manifest-input.ts';
import {verifyFileManifest} from './file-manifest.ts';
import {createFileBundle} from './file-bundle.ts';
import type {CleanupEntry} from './file-bundle-input.ts';
import type {FileRestoreValidationInput,FileRestoreValidationResult,RestoreValidationIssue} from './file-restore-validation-input.ts';

type Code=RestoreValidationIssue['code'];
class ValidationFailure extends Error {
  issues:RestoreValidationIssue[];
  constructor(code:Code){super(code);this.issues=[{code}];}
}
const reject=(code:Code):never=>{throw new ValidationFailure(code);};
const identity=(a:BigIntStats,b:BigIntStats)=>a.dev===b.dev&&a.ino===b.ino&&a.mode===b.mode;
const same=(a:BigIntStats,b:BigIntStats)=>identity(a,b)&&a.nlink===b.nlink&&a.size===b.size&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs;
const equal=(a:string,b:string)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
const inside=(root:string,target:string)=>{const rel=path.relative(root,target);return rel!==''&&rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel);};
const errno=(e:unknown)=>(e as NodeJS.ErrnoException)?.code;
const failureOf=(e:unknown)=>e instanceof ValidationFailure?e:new ValidationFailure(errno(e)==='ENOENT'?'FILE_MISSING':'READ_FAILED');

/** 원본 적용·실행 재개 없이, 보관된 파일만 새 검증 위치로 복사한다. */
export async function validateFileRestore(raw:FileRestoreValidationInput):Promise<FileRestoreValidationResult> {
  const started=performance.now();
  let source:FileManifestInput|null=null;
  let baseline:VerificationBaseline;
  let bundle='',payload='',parent='',destination='',name='',maxMetadataBytes=0;
  let manifest:FileManifest|null=null;
  let copied=false;
  let cleanup:CleanupEntry[]=[];
  const anchors=new Map<string,BigIntStats>();
  const originalInventory=new Map<string,BigIntStats>();
  const restoredInventory=new Map<string,BigIntStats>();
  const expected=new Map<string,'file'|'directory'>([['','directory'],['manifest.json','file'],['payload','directory']]);
  const budget=()=>{
    if(source?.signal?.aborted) reject('CANCELLED');
    if(source&&performance.now()-started>=source.limits.maxDurationMs) reject('TIME_LIMIT');
  };
  const remaining=(root:string):FileManifestInput=>{
    budget();const ms=source!.limits.maxDurationMs-(performance.now()-started);
    if(ms<1) reject('TIME_LIMIT');
    return {...source!,root,limits:{...source!.limits,maxDurationMs:Math.floor(ms)}};
  };
  async function chain(target:string):Promise<void> {
    let current=path.parse(target).root;
    for(const part of ['',...target.slice(current.length).split(path.sep).filter(Boolean)]) {
      if(part) current=path.join(current,part);
      budget();const stat=await fs.lstat(current,{bigint:true});budget();
      if(stat.isSymbolicLink()||!stat.isDirectory()||!equal(await fs.realpath(current),current)) reject('PATH_UNSAFE');
      const prior=anchors.get(current);
      if(prior&&!identity(prior,stat)) reject('FILE_CHANGED');
      anchors.set(current,stat);budget();
    }
  }
  async function readMetadata(root=bundle):Promise<{bytes:Buffer;stat:BigIntStats;hash:string}> {
    await chain(root);
    const target=path.join(root,'manifest.json');
    budget();const initial=await fs.lstat(target,{bigint:true});budget();
    if(initial.isSymbolicLink()||!initial.isFile()||!equal(await fs.realpath(target),target)) reject('NOT_REGULAR_FILE');
    if(initial.size>BigInt(maxMetadataBytes)) reject('METADATA_LIMIT');
    let handle:Awaited<ReturnType<typeof fs.open>>|undefined;
    let failure:unknown;
    let result:{bytes:Buffer;stat:BigIntStats;hash:string}|undefined;
    try {
      budget();handle=await fs.open(target,constants.O_RDONLY|(constants.O_NOFOLLOW??0));budget();
      const before=await handle.stat({bigint:true});budget();
      if(!before.isFile()||!same(initial,before)) reject('FILE_CHANGED');
      const chunks:Buffer[]=[];let count=0;const hash=createHash('sha256');
      const chunk=Buffer.alloc(Math.min(65536,maxMetadataBytes));
      for(;;) {
        budget();const {bytesRead}=await handle.read(chunk,0,Math.min(chunk.length,maxMetadataBytes-count+1),null);budget();
        if(!bytesRead) break;
        count+=bytesRead;if(count>maxMetadataBytes) reject('METADATA_LIMIT');
        const data=Buffer.from(chunk.subarray(0,bytesRead));chunks.push(data);hash.update(data);
      }
      const after=await handle.stat({bigint:true});budget();await chain(root);
      const final=await fs.lstat(target,{bigint:true});budget();
      if(final.isSymbolicLink()||!same(before,after)||!same(after,final)||BigInt(count)!==before.size) reject('FILE_CHANGED');
      result={bytes:Buffer.concat(chunks,count),stat:final,hash:hash.digest('hex')};
    } catch(e) {failure=failureOf(e);} finally {
      if(handle) try {await handle.close();} catch {
        if(failure instanceof ValidationFailure) failure.issues.push({code:'CLOSE_FAILED'});
        else failure=new ValidationFailure('CLOSE_FAILED');
      }
    }
    if(failure) throw failure;
    budget();return result!;
  }
  async function inventory(root:string,snapshots:Map<string,BigIntStats>):Promise<void> {
    await chain(root);
    // 고정 허용 prefix만 열고 unknown 디렉터리·링크 내용은 읽지 않는다.
    for(const [relative,kind] of expected) {
      budget();const target=path.join(root,...relative.split('/').filter(Boolean));
      const before=await fs.lstat(target,{bigint:true});budget();
      if(before.isSymbolicLink()||(kind==='file'?!before.isFile():!before.isDirectory())||!equal(await fs.realpath(target),target)) reject('INVENTORY_MISMATCH');
      const known=snapshots.get(relative);
      if(known&&(kind==='file'?!same(known,before):!identity(known,before))) reject('FILE_CHANGED');
      snapshots.set(relative,before);
      if(kind!=='directory') continue;
      const children=new Set([...expected.keys()].filter(key=>key!==''&&path.posix.dirname(key)===(relative||'.')).map(key=>path.posix.basename(key)));
      let directory:Awaited<ReturnType<typeof fs.opendir>>|undefined;let failure:unknown;
      try {
        directory=await fs.opendir(target);budget();const count=children.size;
        for(let index=0;index<=count;index++) {
          budget();const child=await directory.read();budget();
          if(!child) {if(children.size) reject('INVENTORY_MISMATCH');break;}
          if(!children.delete(child.name)) reject('INVENTORY_MISMATCH');
        }
      } catch(e) {failure=failureOf(e);} finally {
        if(directory) try {await directory.close();} catch {
          if(failure instanceof ValidationFailure) failure.issues.push({code:'CLOSE_FAILED'});
          else failure=new ValidationFailure('CLOSE_FAILED');
        }
      }
      if(failure) throw failure;
      budget();const after=await fs.lstat(target,{bigint:true});budget();
      if(after.isSymbolicLink()||!identity(before,after)) reject('FILE_CHANGED');
    }
    await chain(root);budget();
  }
  async function verify(root:string,candidate:unknown=manifest):Promise<void> {
    const result=await verifyFileManifest(remaining(root),candidate,baseline);
    budget();
    if(!result.valid) {const failure=new ValidationFailure('CONTENT_MISMATCH');failure.issues=result.issues;throw failure;}
  }
  try {
    // 독립 기준·목적지·한도는 첫 await 전에 복사, 원 Signal 객체는 그대로 관측한다.
    if(!raw||typeof raw.bundleRoot!=='string'||!path.isAbsolute(raw.bundleRoot)||/[\x00-\x1f]/.test(raw.bundleRoot)) reject('INVALID_INPUT');
    bundle=path.resolve(raw.bundleRoot);payload=path.join(bundle,'payload');
    source=normalizeInput({root:payload,selections:raw.baseline?.selections,limits:raw.limits,signal:raw.signal});
    if(!source||typeof raw.baseline?.expectedManifestHash!=='string'||!/^[a-f0-9]{64}$/.test(raw.baseline.expectedManifestHash)) reject('BASELINE_MISMATCH');
    baseline={selections:source!.selections.map(item=>({...item})),expectedManifestHash:raw.baseline.expectedManifestHash};
    if(!Number.isSafeInteger(raw.maxMetadataBytes)||raw.maxMetadataBytes<=0||typeof raw.validationParent!=='string'||!path.isAbsolute(raw.validationParent)||/[\x00-\x1f]/.test(raw.validationParent)||!validRelativePath(raw.validationName)||raw.validationName.includes('/')) reject('INVALID_INPUT');
    maxMetadataBytes=raw.maxMetadataBytes;parent=path.resolve(raw.validationParent);name=raw.validationName;destination=path.join(parent,name);
    if(equal(bundle,destination)||inside(bundle,destination)||inside(destination,bundle)) reject('DESTINATION_UNSAFE');
    for(const entry of source!.selections) {
      if(entry.classification!=='ordinary'||entry.decision!=='include') continue;
      let prefix='payload';const parts=entry.path.split('/');
      for(let index=0;index<parts.length;index++) {
        prefix+='/'+parts[index];const kind=index===parts.length-1?'file':'directory';
        if(expected.has(prefix)&&expected.get(prefix)!==kind) reject('BASELINE_MISMATCH');
        expected.set(prefix,kind);
      }
    }
    for(const entry of source!.selections) {
      if((entry.classification!=='ordinary'||entry.decision!=='include')&&[...expected.keys()].some(key=>key.toLowerCase()===('payload/'+entry.path).toLowerCase())) reject('BASELINE_MISMATCH');
    }
    budget();await chain(bundle);await chain(parent);budget();
    try {await fs.lstat(destination);reject('DESTINATION_EXISTS');} catch(e) {if(errno(e)!=='ENOENT') throw e;}
    budget();
    // 예상 밖/제외 payload는 metadata 파싱이나 payload 내용 읽기보다 먼저 거절한다.
    await inventory(bundle,originalInventory);
    const metadata=await readMetadata();
    try {manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(metadata.bytes)) as FileManifest;} catch {reject('METADATA_INVALID');}
    await verify(payload);
    const result=await createFileBundle({source:remaining(payload),manifest:manifest!,baseline,destinationParent:parent,destinationName:name});
    cleanup=result.cleanup;
    if(!result.complete) {
      const issues:RestoreValidationIssue[]=[...result.issues];
      try {budget();} catch(e) {if(e instanceof ValidationFailure) for(const issue of e.issues) if(!issues.some(item=>item.code===issue.code)) issues.push(issue);}
      return {complete:false,state:result.state,manifest,issues,cleanup};
    }
    copied=true;budget();
    const checkMetadata=async()=>{
      const current=await readMetadata();budget();
      if(!same(metadata.stat,current.stat)||current.hash!==metadata.hash||!current.bytes.equals(metadata.bytes)) reject('FILE_CHANGED');
    };
    await checkMetadata();await inventory(bundle,originalInventory);await verify(payload);
    // 목적지 metadata도 bounded 재읽기하여 고정 원문·독립 기준과 대조한다.
    const restoredMetadata=await readMetadata(destination);
    if(!restoredMetadata.bytes.equals(Buffer.from(JSON.stringify(manifest),'utf8'))) reject('MANIFEST_INVALID');
    restoredInventory.set('manifest.json',restoredMetadata.stat);
    await inventory(destination,restoredInventory);
    await verify(path.join(destination,'payload'),JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(restoredMetadata.bytes)));
    // 재읽기 후에도 정상 filesystem의 변경·unknown 추가·늦은 close/취소를 거절한다.
    await checkMetadata();await inventory(bundle,originalInventory);await inventory(destination,restoredInventory);
    budget();return {complete:true,state:'complete',manifest,issues:[],cleanup:[]};
  } catch(e) {
    const issues=e instanceof ValidationFailure?e.issues:[{code:errno(e)==='ENOENT'?'FILE_MISSING':'READ_FAILED'} as RestoreValidationIssue];
    // builder는 성공 후 소유 identity를 공개하지 않는다. 추정 삭제 대신 보존 사실을 반환한다.
    if(copied) cleanup=[...cleanup,{path:'.',state:'preserved',reason:'IDENTITY_UNCONFIRMED'}];
    return {complete:false,state:copied||cleanup.some(item=>item.state==='preserved')?'partial':'failed',manifest,issues,cleanup};
  }
}
