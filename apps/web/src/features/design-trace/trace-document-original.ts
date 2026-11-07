import {ApiClient,ApiError} from '../../api/client.ts';import {readDocument} from './api.ts';import type {TraceRef} from './trace-api.ts';
const uuidV1=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
function recordV1(v:unknown,keys:string[]):v is Record<string,any>{if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Object.getOwnPropertySymbols(v).length)return false;const entries=Object.getOwnPropertyDescriptors(v);return Object.keys(entries).sort().join(',')===[...keys].sort().join(',')&&Object.values(entries).every(p=>p.enumerable&&'value'in p);}
const refV1=(v:unknown)=>recordV1(v,['id','version','contentHash'])&&uuidV1(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&typeof v.contentHash==='string'&&/^[0-9a-f]{64}$/.test(v.contentHash);
export function traceDocumentReference(target:TraceRef){
 if(!recordV1(target,['kind','id','versionRef'])||target.kind!=='DOCUMENT_VERSION'||!refV1(target.versionRef)||target.id!==target.versionRef.id)throw new ApiError('TRACE_DOCUMENT_REFERENCE_INVALID');return structuredClone(target.versionRef);
}
export async function readTraceDocumentOriginal(client:ApiClient,projectId:string,target:TraceRef,active:()=>boolean){
 if(!uuidV1(projectId))throw new ApiError('TRACE_DOCUMENT_REFERENCE_INVALID');const ref=traceDocumentReference(target),check=()=>{if(!active())throw new ApiError('TRACE_DOCUMENT_READ_PAUSED');};check();const value=await readDocument(client,projectId,ref.id,ref.version,{expectedContentHash:ref.contentHash,active});check();return value;
}
