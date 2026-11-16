import {ApiClient,ApiError} from '../../api/client.ts';
import type {TraceRef} from './trace-api.ts';

const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
function exact(v:unknown,keys:string[]):v is Record<string,unknown>{
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Object.getOwnPropertySymbols(v).length)return false;
 const ds=Object.getOwnPropertyDescriptors(v);return Object.keys(ds).sort().join(',')===[...keys].sort().join(',')&&Object.values(ds).every(d=>d.enumerable&&'value'in d);
}
/** 이미 검산된 추적 항목의 등록 바이트만 읽는다. 실행/시험/파일 경로 귀속의 증거는 아니다. */
export async function readTraceArtifactOriginal(client:ApiClient,projectId:string,target:TraceRef,active:()=>boolean){
 if(!uuid(projectId)||!exact(target,['kind','id','versionRef'])||target.kind!=='ARTIFACT'||!uuid(target.id)||!exact(target.versionRef,['id','version','contentHash'])||target.id!==target.versionRef.id||target.versionRef.version!==1||typeof target.versionRef.contentHash!=='string'||!/^[0-9a-f]{64}$/.test(target.versionRef.contentHash))throw new ApiError('TRACE_ARTIFACT_REFERENCE_INVALID');
 const chosen=structuredClone(target),transport=client.transport,check=()=>{if(!active()||client.transport!==transport)throw new ApiError('TRACE_ARTIFACT_READ_PAUSED');};check();
 let response:Response;
 try{response=await transport.call(globalThis,`/api/v1/projects/${projectId}/files/${chosen.id}`,{method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/octet-stream'}});}catch{throw new ApiError('CONNECTION_LOST');}
 try{check();if(!response.ok)throw new ApiError('ARTIFACT_READ_FAILED',response.status);if(!/^application\/octet-stream\b/i.test(response.headers.get('content-type')??'')||!response.body)throw new ApiError('RESPONSE_INVALID');}catch(cause){await response.body?.cancel().catch(()=>{});throw cause;}
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){check();const item=await reader.read();check();if(item.done)break;size+=item.value.byteLength;if(size>2*1024*1024)throw new ApiError('TRACE_ARTIFACT_TEXT_LIMIT');chunks.push(item.value);}}
 catch(cause){await reader.cancel().catch(()=>{});throw cause instanceof ApiError?cause:new ApiError('CONNECTION_LOST');}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');check();if(digest!==chosen.versionRef.contentHash)throw new ApiError('ARTIFACT_INTEGRITY_FAILED');
 let body:string;try{body=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{throw new ApiError('TRACE_ARTIFACT_TEXT_UNSUPPORTED');}
 if(body.includes('\u0000'))throw new ApiError('TRACE_ARTIFACT_TEXT_UNSUPPORTED');check();return{body,bytes:size,ref:chosen.versionRef};
}
