import {ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import {isKnownDocumentRejection} from '../design-trace/mutation-result.ts';
import type {KnowledgeBuffer} from './api.ts';
import type {KnowledgeCorrectionBuffer} from './correction-api.ts';
type Draft=KnowledgeBuffer|KnowledgeCorrectionBuffer;
export function canReopenRejectedKnowledgeDraft(buffer:Draft,projectId:string,session:DocumentSession):boolean{
 const p=buffer.pending,u=p?.upload;
 return buffer.projectId===projectId&&buffer.ownerUserId===session.user.id&&buffer.ownerClientId===session.clientId
  &&!!u&&u.projectId===projectId&&u.clientId===session.clientId&&u.controlGeneration===buffer.controlGeneration
  &&!buffer.uncertain&&!('resultRef'in buffer&&buffer.resultRef)&&!('savedRef'in buffer&&buffer.savedRef)
  &&isKnownDocumentRejection(buffer.failure)&&buffer.failure?.code!=='ARTIFACT_QUARANTINED'&&!buffer.failure?.quarantinedArtifactId;
}
/** 사용자가 확인한 첫 확실 거절만 편집으로 되돌린다. 기준/세대 갱신·자동 저장/재실행은 하지 않는다. */
export function reopenRejectedKnowledgeDraft<T extends Draft>(buffer:T,projectId:string,session:DocumentSession):T{
 if(!canReopenRejectedKnowledgeDraft(buffer,projectId,session))throw new ApiError('KNOWLEDGE_DRAFT_REOPEN_BLOCKED');
 return {...buffer,pending:null,failure:null,dirty:true};
}
