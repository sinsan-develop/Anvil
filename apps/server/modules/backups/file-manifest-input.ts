import path from 'node:path';

/** 내부 전용 DTO. 공개 반출 형식·읽기 권한·비밀 자동 탐지 계약이 아니다. */
export interface FileSelection {
  path: string;
  versionRef: string;
  required: boolean;
  ignored: boolean;
  decision: 'include' | 'exclude';
  reason: string;
  classification: 'ordinary' | 'secret' | 'credential';
}
export interface FileManifestInput {
  root: string;
  selections: readonly FileSelection[];
  limits: {maxFiles:number; maxFileBytes:number; maxTotalBytes:number; maxDurationMs:number};
  signal?: AbortSignal;
}
export type IssueCode = 'INVALID_INPUT' | 'ROOT_UNSAFE' | 'PATH_UNSAFE' | 'FILE_MISSING' | 'NOT_REGULAR_FILE' | 'FILE_CHANGED' | 'FILE_LIMIT' | 'TOTAL_LIMIT' | 'TIME_LIMIT' | 'CANCELLED' | 'READ_FAILED' | 'REQUIRED_EXCLUDED' | 'MANIFEST_INVALID' | 'BASELINE_MISMATCH' | 'CONTENT_MISMATCH';
export interface ManifestIssue {code:IssueCode; path?:string}
export interface ManifestEntry extends FileSelection {
  status:'included'|'excluded'|'failed';
  bytes:number|null;
  sha256:string|null;
  reasonCode:'SELECTED'|'MANUAL_EXCLUDED'|'SENSITIVE_EXCLUDED'|IssueCode;
}
export interface FileManifest {
  complete:boolean;
  entries:ManifestEntry[];
  issues:ManifestIssue[];
  manifestHash:string;
}
export interface VerificationBaseline {
  selections:readonly FileSelection[];
  expectedManifestHash:string;
}
const record = (value:unknown):value is Record<string,unknown> => !!value && typeof value==='object' && !Array.isArray(value);
const text = (value:unknown):value is string => typeof value==='string' && value.trim().length>0 && value.length<=4096 && !/[\x00-\x1f\x7f]/.test(value);
export function validRelativePath(value:unknown):value is string {
  if (!text(value) || value!==value.normalize('NFC') || value.includes('\\') || value.includes(':') || path.posix.isAbsolute(value)) return false;
  return value.split('/').every(part=>part!=='.' && part!=='..' && part.length>0 && !/[. ]$/.test(part) && !/[<>"|?*]/.test(part) && !/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part));
}
export function normalizeInput(value:unknown):FileManifestInput|null {
  if (!record(value) || typeof value.root!=='string' || !path.isAbsolute(value.root) || /[\x00-\x1f]/.test(value.root) || !Array.isArray(value.selections) || !record(value.limits)) return null;
  const limits=value.limits;
  for(const key of ['maxFiles','maxFileBytes','maxTotalBytes','maxDurationMs']) if (!Number.isSafeInteger(limits[key]) || (limits[key] as number)<=0) return null;
  if(value.selections.length===0 || value.selections.length>(limits.maxFiles as number)) return null;
  const seen=new Set<string>();
  const selections:FileSelection[]=[];
  for(const item of value.selections) {
    if(!record(item) || !validRelativePath(item.path) || !text(item.versionRef) || !text(item.reason) || typeof item.required!=='boolean' || typeof item.ignored!=='boolean' || !['include','exclude'].includes(item.decision as string) || !['ordinary','secret','credential'].includes(item.classification as string)) return null;
    const key=item.path.toLowerCase();
    if(seen.has(key)) return null;
    seen.add(key);
    selections.push({path:item.path,versionRef:item.versionRef,required:item.required,ignored:item.ignored,decision:item.decision as FileSelection['decision'],reason:item.reason,classification:item.classification as FileSelection['classification']});
  }
  if(value.signal!==undefined && !(value.signal instanceof AbortSignal)) return null;
  selections.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  return {root:path.resolve(value.root),selections,limits:{maxFiles:limits.maxFiles as number,maxFileBytes:limits.maxFileBytes as number,maxTotalBytes:limits.maxTotalBytes as number,maxDurationMs:limits.maxDurationMs as number},signal:value.signal as AbortSignal|undefined};
}
