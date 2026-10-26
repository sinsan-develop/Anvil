import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import type { BigIntStats } from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {normalizeInput} from './file-manifest-input.ts';
import type {FileManifestInput,FileManifest,ManifestEntry,ManifestIssue,IssueCode,VerificationBaseline} from './file-manifest-input.ts';

// 내부 지문일 뿐 진위·현재 권한·프로젝트 전체 복원 가능성의 인증이 아니다.
function canonical(value:unknown):string {
  if(value===null || typeof value==='string' || typeof value==='boolean') return JSON.stringify(value);
  if(typeof value==='number' && Number.isFinite(value)) return JSON.stringify(value);
  if(Array.isArray(value)) return '['+Array.from(value,item=>canonical(item)).join(',')+']';
  if(value && typeof value==='object') return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical((value as Record<string,unknown>)[key])).join(',')+'}';
  throw new Error('INVALID_VALUE');
}
const digest=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
function finish(entries:ManifestEntry[],issues:ManifestIssue[]):FileManifest {
  const result={complete:issues.length===0,entries,issues};
  return {...result,manifestHash:digest(result)};
}
class ReadIssue extends Error { readonly issue:IssueCode; constructor(issue:IssueCode){super(issue);this.issue=issue;} }
const reject=(code:IssueCode):never=>{throw new ReadIssue(code);};
function same(a:BigIntStats,b:BigIntStats):boolean {
  return a.dev===b.dev && a.ino===b.ino && a.mode===b.mode && a.size===b.size && a.mtimeNs===b.mtimeNs && a.ctimeNs===b.ctimeNs && a.nlink===b.nlink;
}
const inside=(root:string,target:string)=>{const relative=path.relative(root,target);return relative!=='' && relative!=='..' && !relative.startsWith('..'+path.sep) && !path.isAbsolute(relative);};
async function safeDirectoryChain(target:string):Promise<void> {
  const parsed=path.parse(target);
  let current=parsed.root;
  for(const segment of ['',...target.slice(parsed.root.length).split(path.sep).filter(Boolean)]) {
    if(segment) current=path.join(current,segment);
    const stat=await fs.lstat(current);
    if(stat.isSymbolicLink() || !stat.isDirectory() || path.resolve(await fs.realpath(current)).toLowerCase()!==path.resolve(current).toLowerCase()) reject('PATH_UNSAFE');
  }
}
async function checkedFile(root:string,relative:string):Promise<{target:string;stat:BigIntStats}> {
  const target=path.resolve(root,...relative.split('/'));
  if(!inside(root,target)) reject('PATH_UNSAFE');
  await safeDirectoryChain(path.dirname(target));
  const stat=await fs.lstat(target,{bigint:true});
  if(stat.isSymbolicLink()) reject('PATH_UNSAFE');
  if(!stat.isFile()) reject('NOT_REGULAR_FILE');
  const real=await fs.realpath(target);
  if(!inside(root,real) || path.resolve(real).toLowerCase()!==target.toLowerCase()) reject('PATH_UNSAFE');
  return {target,stat};
}
function errorCode(error:unknown):IssueCode {
  if(error instanceof ReadIssue) return error.issue;
  if((error as NodeJS.ErrnoException)?.code==='ENOENT') return 'FILE_MISSING';
  if((error as NodeJS.ErrnoException)?.code==='ELOOP') return 'PATH_UNSAFE';
  return 'READ_FAILED';
}
/** 실제 파일만 읽으며 쓰기·탐색·archive 생성·DB snapshot 연결을 하지 않는다.
 * 경로/handle 전후 검사는 OS 타 프로세스 경쟁, hardlink 출처, 특수 FS의 안전 보장이 아니다.
 * 읽기 허가와 OS 보호는 호출자의 책임이다. Node가 노출하지 않는 reparse 종류도 미보장이다.
 */
export async function createFileManifest(raw:FileManifestInput):Promise<FileManifest> {
  const input=normalizeInput(raw);
  if(!input) return finish([],[{code:'INVALID_INPUT'}]);
  const entries:ManifestEntry[]=[];
  const issues:ManifestIssue[]=[];
  const started=performance.now();
  const budget=()=>{
    if(input.signal?.aborted) reject('CANCELLED');
    if(performance.now()-started>=input.limits.maxDurationMs) reject('TIME_LIMIT');
  };
  let total=0;
  // root 자체는 민감 분류가 있더라도 호출자가 명시한 읽기 범위의 경계로 검증한다.
  try {budget();await safeDirectoryChain(input.root);budget();} catch(error) {
    const code=errorCode(error);
    return finish([], [{code:code==='CANCELLED'||code==='TIME_LIMIT'?code:'ROOT_UNSAFE'}]);
  }
  for(const selection of input.selections) {
    const entry:ManifestEntry={...selection,status:'failed',bytes:null,sha256:null,reasonCode:'READ_FAILED'};
    entries.push(entry);
    if(selection.classification!=='ordinary' || selection.decision==='exclude') {
      entry.status='excluded';
      entry.reasonCode=selection.classification!=='ordinary'?'SENSITIVE_EXCLUDED':'MANUAL_EXCLUDED';
      if(selection.required) issues.push({path:selection.path,code:'REQUIRED_EXCLUDED'});
      try {budget();} catch(error) {issues.push({path:selection.path,code:errorCode(error)});}
      continue;
    }
    let handle:Awaited<ReturnType<typeof fs.open>>|undefined;
    let failure:IssueCode|undefined;
    let bytes=0;
    let sha256:string|undefined;
    try {
      budget();
      const initial=await checkedFile(input.root,selection.path);
      budget();
      if(initial.stat.size>BigInt(input.limits.maxFileBytes)) reject('FILE_LIMIT');
      if(initial.stat.size>BigInt(input.limits.maxTotalBytes-total)) reject('TOTAL_LIMIT');
      handle=await fs.open(initial.target,constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      budget();
      const before=await handle.stat({bigint:true});
      if(!before.isFile() || !same(initial.stat,before)) reject('FILE_CHANGED');
      const hash=createHash('sha256');
      const chunk=Buffer.alloc(Math.min(65536,input.limits.maxFileBytes));
      for(;;) {
        budget();
        const read=await handle.read(chunk,0,chunk.length,null);
        budget();
        if(read.bytesRead===0) break;
        bytes+=read.bytesRead;
        total+=read.bytesRead;
        if(bytes>input.limits.maxFileBytes) reject('FILE_LIMIT');
        if(total>input.limits.maxTotalBytes) reject('TOTAL_LIMIT');
        hash.update(chunk.subarray(0,read.bytesRead));
      }
      const after=await handle.stat({bigint:true});
      const final=await checkedFile(input.root,selection.path);
      budget();
      if(!same(before,after) || !same(after,final.stat) || BigInt(bytes)!==before.size) reject('FILE_CHANGED');
      sha256=hash.digest('hex');
    } catch(error) {failure=errorCode(error);} finally {
      if(handle) try {await handle.close();} catch {failure='READ_FAILED';}
    }
    if(!failure) try {budget();} catch(error) {failure=errorCode(error);}
    if(failure) {
      entry.reasonCode=failure;
      issues.push({path:selection.path,code:failure});
    } else {entry.status='included';entry.bytes=bytes;entry.sha256=sha256!;entry.reasonCode='SELECTED';}
  }
  const result=finish(entries,issues);
  try {budget();} catch(error) {
    const code=errorCode(error);
    if(!issues.some(issue=>issue.code===code)) issues.push({code});
    return finish(entries,issues);
  }
  return result;
}
/** 별도 보존한 선택/version과 기대 지문이 필수다. 자체 hash 일치만으로 신뢰하지 않는다. */
export async function verifyFileManifest(input:FileManifestInput,manifest:unknown,baseline:VerificationBaseline):Promise<{valid:boolean;issues:ManifestIssue[]}> {
  try {
    const expectedManifestHash=baseline?.expectedManifestHash;
    const normalized=normalizeInput(input);
    const independent=normalizeInput({...input,selections:baseline?.selections});
    if(!normalized || !independent || !/^[a-f0-9]{64}$/.test(expectedManifestHash) || canonical(normalized.selections)!==canonical(independent.selections)) return {valid:false,issues:[{code:'BASELINE_MISMATCH'}]};
    if(!manifest || typeof manifest!=='object' || Array.isArray(manifest)) return {valid:false,issues:[{code:'MANIFEST_INVALID'}]};
    // 최초 검사와 실제 파일 비교는 같은 불변 복사본을 사용한다.
    const snapshot=JSON.parse(canonical(manifest)) as Record<string,unknown>;
    const {manifestHash,...payload}=snapshot;
    if(manifestHash!==expectedManifestHash || digest(payload)!==expectedManifestHash) return {valid:false,issues:[{code:'MANIFEST_INVALID'}]};
    const actual=await createFileManifest(normalized);
    if(!actual.complete || canonical(actual)!==canonical(snapshot)) return {valid:false,issues:[{code:'CONTENT_MISMATCH'},...actual.issues]};
    return {valid:true,issues:[]};
  } catch {return {valid:false,issues:[{code:'MANIFEST_INVALID'}]};}
}
