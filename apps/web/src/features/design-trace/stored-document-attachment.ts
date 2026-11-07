import {ApiClient,ApiError} from '../../api/client.ts';
import {readDocument,type DocumentVersion} from './api.ts';
import {readPreservedDocumentText} from './proposal-api.ts';
type Ref={id:string;version:number;contentHash:string};
type Artifact=DocumentVersion['content']['attachments'][number];
export async function readStoredDocumentAttachment(client:ApiClient,projectId:string,documentRef:Ref,attachment:Artifact,active:()=>boolean=()=>true):Promise<string>{
 const check=()=>{if(!active())throw new ApiError('DOCUMENT_ATTACHMENT_READ_PAUSED');};check();
 const pinned=structuredClone(documentRef),selected=structuredClone(attachment);
 if(!selected||!Number.isSafeInteger(selected.bytes)||selected.bytes<0||selected.bytes>2097152||!['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(selected.mediaType))throw new ApiError('DOCUMENT_ATTACHMENT_UNSUPPORTED');
 const value=await readDocument(client,projectId,pinned.id,pinned.version,{expectedContentHash:pinned.contentHash,active});check();
 const matches=value.document.content.attachments.filter(a=>a.artifactId===selected.artifactId);
 if(matches.length!==1||matches[0]!.bytes!==selected.bytes||matches[0]!.contentHash!==selected.contentHash||matches[0]!.mediaType!==selected.mediaType)throw new ApiError('DOCUMENT_ATTACHMENT_REFERENCE_CHANGED');
 const body=await readPreservedDocumentText(client,projectId,selected);check();return body;
}
