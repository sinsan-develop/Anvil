import {ApiClient,ApiError} from '../../api/client.ts';
import {readKnowledge,type KnowledgeView} from './api.ts';
export interface KnowledgeArtifactSource{kind:'ARTIFACT';id:string;contentHash:string}
export interface KnowledgeArtifactSelection{projectId:string;userId:string;clientId:string;knowledgeRef:KnowledgeView['ref'];source:KnowledgeArtifactSource}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,hash=/^[0-9a-f]{64}$/;
/** 파일의 존재/격리/현재 권한은 기존 GET이 검사한다. 보기는 지식 귀속·hash를 재확인하며 쓰지 않는다. */
export async function readKnowledgeArtifactSource(client:ApiClient,selection:KnowledgeArtifactSelection,active:()=>boolean){
 const r=selection?.knowledgeRef,s=selection?.source;
 if(!selection||![selection.projectId,selection.userId,selection.clientId].every(v=>typeof v==='string'&&uuid.test(v))||!r||!uuid.test(r.id)||!Number.isSafeInteger(r.version)||r.version<1||!hash.test(r.contentHash)||!s||Object.keys(s).sort().join(',')!=='contentHash,id,kind'||s.kind!=='ARTIFACT'||!uuid.test(s.id)||!hash.test(s.contentHash))throw new ApiError('KNOWLEDGE_SOURCE_INVALID');
 const selected=structuredClone(selection),check=()=>{if(!active())throw new ApiError('KNOWLEDGE_SOURCE_PAUSED');};check();
 const knowledge=await readKnowledge(client,selected.projectId,selected.knowledgeRef);check();
 if(knowledge.entry.sourceRefs.filter(v=>v.kind==='ARTIFACT'&&v.id===selected.source.id&&v.contentHash===selected.source.contentHash).length!==1)throw new ApiError('KNOWLEDGE_SOURCE_CHANGED');
 let response:Response;try{response=await client.transport.call(globalThis,`/api/v1/projects/${selected.projectId}/files/${selected.source.id}`,{method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/octet-stream'}});}catch{throw new ApiError('CONNECTION_LOST');}
 try{check();if(!response.ok)throw new ApiError('ARTIFACT_READ_FAILED',response.status);if(!/^application\/octet-stream\b/i.test(response.headers.get('content-type')??'')||!response.body)throw new ApiError('RESPONSE_INVALID');}catch(cause){await response.body?.cancel().catch(()=>{});throw cause;}
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){check();const item=await reader.read();check();if(item.done)break;size+=item.value.byteLength;if(size>2*1024*1024)throw new ApiError('KNOWLEDGE_SOURCE_TEXT_LIMIT');chunks.push(item.value);}}
 catch(cause){await reader.cancel().catch(()=>{});throw cause instanceof ApiError?cause:new ApiError('CONNECTION_LOST');}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');check();
 if(digest!==selected.source.contentHash)throw new ApiError('ARTIFACT_INTEGRITY_FAILED');
 let body:string;try{body=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{throw new ApiError('KNOWLEDGE_SOURCE_TEXT_UNSUPPORTED');}
 if(body.includes('\u0000'))throw new ApiError('KNOWLEDGE_SOURCE_TEXT_UNSUPPORTED');return{body,bytes:size,source:selected.source};
}
