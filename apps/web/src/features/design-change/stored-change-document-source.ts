import {ApiClient,ApiError} from '../../api/client.ts';
import {readDesignChange,type DesignChangePage} from './api.ts';
import {readDocument} from '../design-trace/api.ts';
import {documentDraftHash,type DocumentContent} from '../design-trace/editor-api.ts';
import type {StageNodeRef} from '../design-trace/stage-api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';

export type ChangeDocumentSource=Extract<DesignChangePage['change']['sourceRefs'][number],{kind:'DOCUMENT_VERSION'}>;
export interface ChangeDocumentSelection {projectId:string;userId:string;clientId:string;changeRef:PlanRef;source:ChangeDocumentSource}
const uuid=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const ref=(value:PlanRef)=>value&&uuid(value.id)&&Number.isSafeInteger(value.version)&&value.version>0&&typeof value.contentHash==='string'&&/^[0-9a-f]{64}$/.test(value.contentHash);
/** 기존 요청·문서 보호 조회만 소비한다. 실행·기준 적용·최신본 대체는 하지 않는다. */
export async function readStoredChangeDocumentSource(client:ApiClient,selection:ChangeDocumentSelection,active:()=>boolean){
  if(!selection||![selection.projectId,selection.userId,selection.clientId].every(uuid)||!ref(selection.changeRef)||selection.changeRef.version!==1||selection.source?.kind!=='DOCUMENT_VERSION'||!ref(selection.source))throw new ApiError('DESIGN_CHANGE_SOURCE_INVALID');
  const chosen=structuredClone(selection),check=()=>{if(!active())throw new ApiError('DESIGN_CHANGE_SOURCE_PAUSED');};check();
  const page=await readDesignChange(client,chosen.projectId,chosen.changeRef.id,null);check();
  if(page.change.ref.contentHash!==chosen.changeRef.contentHash||page.change.ref.version!==chosen.changeRef.version)throw new ApiError('DESIGN_CHANGE_SOURCE_CHANGED');
  const source=chosen.source;
  if(page.change.sourceRefs.filter(value=>value.kind==='DOCUMENT_VERSION'&&value.id===source.id&&value.version===source.version&&value.contentHash===source.contentHash).length!==1)throw new ApiError('DESIGN_CHANGE_SOURCE_CHANGED');
  const value=await readDocument(client,chosen.projectId,source.id,source.version);check();
  const document=value.document;
  // 현 문서 저장 hash 계약은 sourceRefs=[]만 지원한다. 다른 값을 비워서 검증하지 않는다.
  if(document.content.sourceRefs.length!==0)throw new ApiError('DESIGN_CHANGE_SOURCE_CHANGED');
  if(document.contentHash!==source.contentHash||await documentDraftHash(document.title,document.formRef,document.content as DocumentContent,(document.stageNodeRef as StageNodeRef|null)??null)!==source.contentHash)throw new ApiError('DESIGN_CHANGE_SOURCE_CHANGED');
  check();return value;
}
