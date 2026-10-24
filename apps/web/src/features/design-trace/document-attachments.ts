import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentBuffer,DocumentSession,DocumentContent} from './editor-api.ts';
import {readStoredImport,type ImportSummary} from './materials-api.ts';
import {readPngArtifact,type StoredDocumentPng} from './stored-document-image.ts';
type Artifact=DocumentContent['attachments'][number];
export interface DocumentAttachmentSelection{projectId:string;artifact:Artifact}
const equal=(a:Artifact,b:Artifact)=>a.artifactId===b.artifactId&&a.bytes===b.bytes&&a.contentHash===b.contentHash&&a.mediaType===b.mediaType;
const valid=(a:Artifact)=>!!a&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(a.artifactId)&&Number.isSafeInteger(a.bytes)&&a.bytes>=0&&a.bytes<=2097152&&/^[0-9a-f]{64}$/.test(a.contentHash)&&['text/plain;charset=utf-8','text/markdown;charset=utf-8','image/png'].includes(a.mediaType);
export async function readDocumentAttachment(client:ApiClient,projectId:string,source:ImportSummary,active:()=>boolean=()=>true):Promise<DocumentAttachmentSelection&{body:string}>{
 if(!active())throw new ApiError('DOCUMENT_ATTACHMENT_READ_PAUSED');
 if(source.status!=='READY'||!valid(source.originalRef))throw new ApiError('DOCUMENT_ATTACHMENT_UNSUPPORTED');
 const read=await readStoredImport(client,projectId,source.id,{expectedOriginalRef:structuredClone(source.originalRef),active});
 if(!active())throw new ApiError('DOCUMENT_ATTACHMENT_READ_PAUSED');
 if(read.candidate.status!=='READY'||read.body===null)throw new ApiError('DOCUMENT_ATTACHMENT_UNSUPPORTED');
 return{projectId,artifact:structuredClone(read.candidate.originalRef),body:read.body};
}
/** 본문 추출 미지원은 유지하며, 같은 프로젝트의 고정 PNG만 첨부 자료로 읽는다. */
export async function readDocumentPngAttachment(client:ApiClient,projectId:string,source:ImportSummary,active:()=>boolean=()=>true):Promise<DocumentAttachmentSelection&{image:StoredDocumentPng}>{
 if(!active())throw new ApiError('DOCUMENT_ATTACHMENT_READ_PAUSED');
 const pinned=structuredClone(source);
 if(pinned.status!=='UNSUPPORTED'||pinned.parserVersion!==null||pinned.extractedContentRef!==null||!valid(pinned.originalRef)||pinned.originalRef.mediaType!=='image/png'||pinned.originalRef.bytes<57)throw new ApiError('DOCUMENT_ATTACHMENT_UNSUPPORTED');
 const read=await readStoredImport(client,projectId,pinned.id,{expectedOriginalRef:pinned.originalRef,active});
 if(!active())throw new ApiError('DOCUMENT_ATTACHMENT_READ_PAUSED');
 if(read.candidate.status!=='UNSUPPORTED'||read.candidate.parserVersion!==null||read.candidate.extractedContentRef!==null||read.candidate.losses.length||read.body!==null)throw new ApiError('DOCUMENT_ATTACHMENT_UNSUPPORTED');
 const image=await readPngArtifact(client,projectId,pinned.originalRef,active);
 return{projectId,artifact:structuredClone(pinned.originalRef),image};
}
function editable(b:DocumentBuffer,s:DocumentSession){
 if(b.ownerUserId!==s.user.id||!Number.isSafeInteger(b.controlGeneration)||b.controlGeneration<1||b.pending||b.importState||b.importPreparationId||b.proposalState||b.workPlanState||b.designIndexState)throw new ApiError('DOCUMENT_ATTACHMENT_LOCKED');
}
/** 미저장 첨부 참조만 바꾼다. 권한·원문/파일·기준·본문과 실제 저장은 별개다. */
export function attachDocumentOriginal(b:DocumentBuffer,s:DocumentSession,selection:DocumentAttachmentSelection):DocumentBuffer{
 editable(b,s);
 if(selection.projectId!==b.projectId)throw new ApiError('DOCUMENT_ATTACHMENT_LOCKED');
 if(!valid(selection.artifact)||b.content.attachments.length>=200||b.content.attachments.some(a=>a.artifactId===selection.artifact.artifactId))throw new ApiError('DOCUMENT_ATTACHMENT_DUPLICATE_OR_INVALID');
 return{...b,content:{...b.content,attachments:[...b.content.attachments,structuredClone(selection.artifact)]},dirty:true,savedRef:null,failure:null};
}
export function removeDocumentAttachment(b:DocumentBuffer,s:DocumentSession,artifact:Artifact):DocumentBuffer{
 editable(b,s);
 if(b.importCandidateRef)throw new ApiError('DOCUMENT_IMPORT_ORIGINAL_PRESERVED');
 if(!b.content.attachments.some(a=>equal(a,artifact)))throw new ApiError('DOCUMENT_ATTACHMENT_SELECTION_CHANGED');
 return{...b,content:{...b.content,attachments:b.content.attachments.filter(a=>!equal(a,artifact))},dirty:true,savedRef:null,failure:null};
}
/** 고정 첨부 참조의 순서만 바꾼다. 보존 원본을 빼거나 파일을 다시 전송하지 않는다. */
export function moveDocumentAttachment(b:DocumentBuffer,s:DocumentSession,index:number,direction:-1|1):DocumentBuffer{
 editable(b,s);
 if(!Number.isSafeInteger(index)||index<0||index>=b.content.attachments.length||(direction!==-1&&direction!==1))throw new ApiError('DOCUMENT_ATTACHMENT_SELECTION_CHANGED');
 const target=index+direction;if(target<0||target>=b.content.attachments.length)return b;
 const attachments=b.content.attachments.slice();[attachments[index],attachments[target]]=[attachments[target]!,attachments[index]!];
 return{...b,content:{...b.content,attachments},dirty:true,savedRef:null,failure:null};
}
