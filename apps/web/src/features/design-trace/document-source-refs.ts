import {ApiClient,ApiError} from '../../api/client.ts';
import {readDocument} from './api.ts';
import {readStoredImport,type ImportSummary} from './materials-api.ts';
import {readConversationMessage} from '../knowledge/conversation-api.ts';
export type DocumentSourceRef={kind:'DOCUMENT_VERSION';id:string;version:number;contentHash:string}|{kind:'ARTIFACT'|'CONVERSATION'|'USER_INSTRUCTION';id:string;contentHash:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,hash=/^[0-9a-f]{64}$/;
export function readDocumentSourceRefs(raw:unknown):DocumentSourceRef[]{
 if(!Array.isArray(raw)||raw.length>200)throw new ApiError('DOCUMENT_SOURCE_INVALID');
 const descriptors=Object.getOwnPropertyDescriptors(raw);
 if(Object.getOwnPropertySymbols(raw).length||Object.keys(descriptors).length!==raw.length+1)throw new ApiError('DOCUMENT_SOURCE_INVALID');
 const seen=new Set<string>(),result:DocumentSourceRef[]=[];
 for(let i=0;i<raw.length;i++){
  const d=descriptors[String(i)];if(!d||!('value'in d)||!d.enumerable)throw new ApiError('DOCUMENT_SOURCE_INVALID');
  const v=d.value;if(!v||typeof v!=='object'||Array.isArray(v)||Object.getOwnPropertySymbols(v).length)throw new ApiError('DOCUMENT_SOURCE_INVALID');
  const fields=Object.getOwnPropertyDescriptors(v),keys=Object.keys(fields).sort().join(',');
  if(Object.values(fields).some(p=>!('value'in p)||!p.enumerable))throw new ApiError('DOCUMENT_SOURCE_INVALID');
  const kind=fields.kind?.value,id=fields.id?.value,contentHash=fields.contentHash?.value,version=fields.version?.value;
  if(typeof id!=='string'||!uuid.test(id)||typeof contentHash!=='string'||!hash.test(contentHash)||
   (kind==='DOCUMENT_VERSION'?keys!=='contentHash,id,kind,version'||!Number.isSafeInteger(version)||version<1:keys!=='contentHash,id,kind'||!['ARTIFACT','CONVERSATION','USER_INSTRUCTION'].includes(kind)))throw new ApiError('DOCUMENT_SOURCE_INVALID');
  const ref:DocumentSourceRef=kind==='DOCUMENT_VERSION'?{contentHash,id,kind,version}:{contentHash,id,kind};
  const key=JSON.stringify(ref);if(seen.has(key))throw new ApiError('DOCUMENT_SOURCE_DUPLICATED');seen.add(key);result.push(ref);
 }
 return result;
}
export const documentSourceKey=(ref:DocumentSourceRef)=>JSON.stringify(readDocumentSourceRefs([ref])[0]);
export const documentSourcesKey=(refs:unknown)=>JSON.stringify(readDocumentSourceRefs(refs));
export interface DocumentSourcePreview{ref:DocumentSourceRef;name:string;body:string}
const check=(active:()=>boolean)=>{if(!active())throw new ApiError('DOCUMENT_SOURCE_READ_PAUSED');};
/** 기존 보호 GET만 소비한다. SourceRef를 권한·실행 proof로 사용하지 않는다. */
export async function readDocumentSource(client:ApiClient,pid:string,raw:DocumentSourceRef,location:{conversationId?:string;import?:ImportSummary}={},active:()=>boolean=()=>true):Promise<DocumentSourcePreview>{
 const ref=readDocumentSourceRefs([raw])[0]!;check(active);
 if(!uuid.test(pid))throw new ApiError('CLIENT_PATH_INVALID');
 if(ref.kind==='DOCUMENT_VERSION'){
  const view=await readDocument(client,pid,ref.id,ref.version,{expectedContentHash:ref.contentHash,active});check(active);
  return {ref,name:view.document.title,body:view.body};
 }
 if(ref.kind==='ARTIFACT'){
  const source=location.import;
  if(!source||source.status!=='READY'||source.originalRef.artifactId!==ref.id||source.originalRef.contentHash!==ref.contentHash||source.originalRef.bytes>2*1024*1024||!['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(source.originalRef.mediaType))throw new ApiError('DOCUMENT_SOURCE_LOCATION_REQUIRED');
  const view=await readStoredImport(client,pid,source.id,{expectedOriginalRef:{...source.originalRef},active});check(active);
  if(view.candidate.status!=='READY'||view.body===null)throw new ApiError('DOCUMENT_SOURCE_INVALID');
  return {ref,name:'보관 텍스트 '+view.candidate.id,body:view.body};
 }
 if(!location.conversationId||!uuid.test(location.conversationId))throw new ApiError('DOCUMENT_SOURCE_LOCATION_REQUIRED');
 const view=await readConversationMessage(client,pid,location.conversationId,{kind:'CONVERSATION',id:ref.id,contentHash:ref.contentHash});check(active);
 if(ref.kind==='USER_INSTRUCTION'&&view.message.kind!=='USER_INSTRUCTION')throw new ApiError('DOCUMENT_SOURCE_KIND_MISMATCH');
 return {ref,name:(ref.kind==='USER_INSTRUCTION'?'사용자 지시':'대화 발언')+' #'+view.serverSequence,body:view.body};
}
