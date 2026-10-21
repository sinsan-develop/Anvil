import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentBuffer,DocumentSession} from './editor-api.ts';
import {attachDocumentOriginal} from './document-attachments.ts';
import {readPngArtifact,type StoredDocumentPng} from './stored-document-image.ts';
import {matchesDocumentImportTarget} from './import-api.ts';
import type {ImportCandidate} from '../../../../server/modules/documents/project-imports.ts';
type Artifact=ImportCandidate['originalRef'];
export interface ImportedPngSelection{projectId:string;commandId:string;candidateId:string;artifact:Artifact;image:StoredDocumentPng}
const equal=(a:Artifact,b:Artifact)=>!!a&&!!b&&a.artifactId===b.artifactId&&a.bytes===b.bytes&&a.contentHash===b.contentHash&&a.mediaType===b.mediaType;
function current(b:DocumentBuffer,s:DocumentSession){
 const state=b.importState,c=state?.candidate,u=state?.upload,r=state?.record;
 if(!state||!c||!u||!r||b.ownerUserId!==s.user.id||state.ownerUserId!==s.user.id||u.clientId!==s.clientId||u.projectId!==b.projectId||u.controlGeneration!==b.controlGeneration||!matchesDocumentImportTarget(b,state)||b.pending||b.importCandidateRef||b.importPreparationId||b.proposalState||b.workPlanState||b.designIndexState||state.uncertain||state.failure||c.status!=='UNSUPPORTED'||c.parserVersion!==null||c.extractedContentRef!==null||c.losses.length||c.originalRef.mediaType!=='image/png'||c.originalRef.bytes<57||c.originalRef.bytes>2097152||u.operation!=='uploadArtifact'||u.payload.mediaType!=='image/png'||u.payload.bytes!==c.originalRef.bytes||u.payload.contentHash!==c.originalRef.contentHash||r.operation!=='importDocument'||r.commandId!==state.recordCommandId||!equal(r.payload.fileRef as Artifact,c.originalRef)||!c.intendedFormRef||c.intendedFormRef.id!==b.formRef.id||c.intendedFormRef.version!==b.formRef.version||c.intendedFormRef.contentHash!==b.formRef.contentHash)throw new ApiError('IMPORT_SELECTION_REQUIRED');
 return{state,c};
}
/** UNSUPPORTED는 본문 추출 상태 그대로다. 보호 원문을 별도 첨부로만 확인한다. */
export async function readImportedPng(client:ApiClient,b:DocumentBuffer,s:DocumentSession,active:()=>boolean):Promise<ImportedPngSelection>{
 if(!active())throw new ApiError('DOCUMENT_ATTACHMENT_READ_PAUSED');const{state,c}=current(b,s),pinned=structuredClone(c);
 const candidate=await client.get<ImportCandidate>(`/api/v1/projects/${b.projectId}/imports/${pinned.id}`);
 if(!active())throw new ApiError('DOCUMENT_ATTACHMENT_READ_PAUSED');
 if(!candidate||candidate.id!==pinned.id||candidate.status!=='UNSUPPORTED'||candidate.parserVersion!==null||candidate.extractedContentRef!==null||!Array.isArray(candidate.losses)||candidate.losses.length||!equal(candidate.originalRef,pinned.originalRef)||!candidate.intendedFormRef||candidate.intendedFormRef.id!==b.formRef.id||candidate.intendedFormRef.version!==b.formRef.version||candidate.intendedFormRef.contentHash!==b.formRef.contentHash)throw new ApiError('IMPORT_INTEGRITY_FAILED');
 const image=await readPngArtifact(client,b.projectId,pinned.originalRef,active);
 return{projectId:b.projectId,commandId:state.upload.commandId,candidateId:pinned.id,artifact:structuredClone(pinned.originalRef),image};
}
/** 명시 선택만 편집 입력에 반영한다. unsupported 후보를 READY/본문/선택이력으로 바꾸지 않는다. */
export function selectImportedPng(b:DocumentBuffer,s:DocumentSession,choice:ImportedPngSelection):DocumentBuffer{
 const{state,c}=current(b,s);
 if(choice.projectId!==b.projectId||choice.commandId!==state.upload.commandId||choice.candidateId!==c.id||!equal(choice.artifact,c.originalRef))throw new ApiError('IMPORT_SELECTION_REQUIRED');
 return attachDocumentOriginal({...b,importState:null},s,{projectId:b.projectId,artifact:choice.artifact});
}
