import {ApiClient,ApiError} from '../../api/client.ts';
import {readDesignChange} from './api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';

export interface ChangeArtifactSelection {projectId:string;userId:string;clientId:string;changeRef:PlanRef;source:{kind:'ARTIFACT';id:string;contentHash:string}}
const uuid=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const hash=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
/** 기존 파일 GET의 권한/격리 검사를 유지하며, 출처 귀속·바이트를 확인한 텍스트만 반환한다. */
export async function readStoredChangeArtifactSource(client:ApiClient,selection:ChangeArtifactSelection,active:()=>boolean){
  const r=selection?.changeRef,s=selection?.source;
  if(!selection||![selection.projectId,selection.userId,selection.clientId].every(uuid)||!r||!uuid(r.id)||r.version!==1||!hash(r.contentHash)||!s||Object.keys(s).sort().join(',')!=='contentHash,id,kind'||s.kind!=='ARTIFACT'||!uuid(s.id)||!hash(s.contentHash))throw new ApiError('DESIGN_CHANGE_SOURCE_INVALID');
  const chosen=structuredClone(selection),check=()=>{if(!active())throw new ApiError('DESIGN_CHANGE_SOURCE_PAUSED');};check();
  const page=await readDesignChange(client,chosen.projectId,chosen.changeRef.id,null);check();
  if(page.change.ref.contentHash!==chosen.changeRef.contentHash||page.change.ref.version!==chosen.changeRef.version||page.change.sourceRefs.filter(value=>value.kind==='ARTIFACT'&&value.id===chosen.source.id&&value.contentHash===chosen.source.contentHash).length!==1)throw new ApiError('DESIGN_CHANGE_SOURCE_CHANGED');
  let response:Response;
  try{response=await client.transport.call(globalThis,`/api/v1/projects/${chosen.projectId}/files/${chosen.source.id}`,{method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/octet-stream'}});}catch{throw new ApiError('CONNECTION_LOST');}
  try{check();if(!response.ok)throw new ApiError('ARTIFACT_READ_FAILED',response.status);if(!/^application\/octet-stream\b/i.test(response.headers.get('content-type')??'')||!response.body)throw new ApiError('RESPONSE_INVALID');}catch(cause){await response.body?.cancel().catch(()=>{});throw cause;}
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){check();const item=await reader.read();check();if(item.done)break;size+=item.value.byteLength;if(size>2*1024*1024)throw new ApiError('DESIGN_CHANGE_SOURCE_TEXT_LIMIT');chunks.push(item.value);}}
  catch(cause){await reader.cancel().catch(()=>{});throw cause instanceof ApiError?cause:new ApiError('CONNECTION_LOST');}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');check();if(digest!==chosen.source.contentHash)throw new ApiError('ARTIFACT_INTEGRITY_FAILED');
  let body:string;try{body=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{throw new ApiError('DESIGN_CHANGE_SOURCE_TEXT_UNSUPPORTED');}
  if(body.includes('\u0000'))throw new ApiError('DESIGN_CHANGE_SOURCE_TEXT_UNSUPPORTED');check();return{body,bytes:size,source:chosen.source};
}
