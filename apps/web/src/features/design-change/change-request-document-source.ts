import {ApiClient,ApiError} from '../../api/client.ts';
import {readDocument} from '../design-trace/api.ts';
import {documentDraftHash,type DocumentContent,type DocumentSession} from '../design-trace/editor-api.ts';
import type {StageNodeRef} from '../design-trace/stage-api.ts';
import type {ChangeRequestBuffer,ChangeRequestSource} from './request-api.ts';
import {ordered} from '../knowledge/review-view.ts';
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b),uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
/** 요청 결박만 대조한다. 실제 권한·현재 제어 세대는 저장 시 서버가 다시 확인한다. */
export function changeRequestSourceBindingMatches(current:ChangeRequestBuffer|null,expected:ChangeRequestBuffer,session:DocumentSession):boolean{
 return !!current&&!current.pending&&!current.result&&!current.uncertain&&expected.ownerUserId===session.user.id&&expected.ownerClientId===session.clientId&&current.ownerUserId===session.user.id&&current.ownerClientId===session.clientId&&current.bindingId===expected.bindingId&&current.projectId===expected.projectId&&current.controlGeneration===expected.controlGeneration&&current.proposalId===expected.proposalId&&same(current.beforeRef,expected.beforeRef);
}
/** 기존 보호 GET만 사용한다. 중간 이탈은 후속 본문 읽기와 최종 채택을 막는다. */
export async function readChangeRequestDocumentSource(client:ApiClient,projectId:string,id:string,version:number,active:()=>boolean){
 const check=()=>{if(!active())throw new ApiError('DESIGN_CHANGE_SOURCE_PAUSED');};check();
 const value=await readDocument(client,projectId,id,version,{active});check();const d=value.document;
 if(d.content.sourceRefs.length!==0||await documentDraftHash(d.title,d.formRef,d.content as DocumentContent,(d.stageNodeRef as StageNodeRef|null)??null)!==d.contentHash)throw new ApiError('DOCUMENT_INTEGRITY_FAILED');
 check();return value;
}
export function attachChangeRequestDocumentSource(current:ChangeRequestBuffer|null,expected:ChangeRequestBuffer,session:DocumentSession,source:Extract<ChangeRequestSource,{kind:'DOCUMENT_VERSION'}>):ChangeRequestBuffer|null{
 if(!changeRequestSourceBindingMatches(current,expected,session)||!source||Object.keys(source).sort().join(',')!=='contentHash,id,kind,version'||source.kind!=='DOCUMENT_VERSION'||!uuid(source.id)||!Number.isSafeInteger(source.version)||source.version<1||!/^[0-9a-f]{64}$/.test(source.contentHash)||current!.sourceRefs.length>=200||current!.sourceRefs.some(r=>same(r,source)))return current;
 return {...current!,sourceRefs:[...current!.sourceRefs,structuredClone(source)],dirty:true,failure:null};
}
