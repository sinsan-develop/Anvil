import {ApiClient,ApiError} from '../../api/client.ts';
import {readStoredImport,type ImportSummary} from '../design-trace/materials-api.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {ChangeRequestBuffer,ChangeRequestSource} from './request-api.ts';
import {ordered} from '../knowledge/review-view.ts';
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v),same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
/** 목록은 발견용이다. 같은 보관 원문을 다시 읽은 뒤 출처 선택만 준비한다. */
export async function readChangeImportSource(client:ApiClient,projectId:string,summary:ImportSummary,active:()=>boolean){
 if(!summary||!uuid(summary.id)||summary.status!=='READY'||summary.integrity!=='NOT_RECHECKED')throw new ApiError('CHANGE_IMPORT_SOURCE_NOT_READY');
 const chosen=structuredClone(summary),value=await readStoredImport(client,projectId,chosen.id,{expectedOriginalRef:chosen.originalRef,active});
 if(!active())throw new ApiError('IMPORT_SOURCE_READ_PAUSED');if(value.candidate.status!=='READY'||value.body===null)throw new ApiError('CHANGE_IMPORT_SOURCE_NOT_READY');
 return {body:value.body,source:{kind:'ARTIFACT' as const,id:value.candidate.originalRef.artifactId,contentHash:value.candidate.originalRef.contentHash}};
}
/** 원문 읽기 뒤에도 바뀐 기준/주체·pending을 덮지 않는다. 저장·권한 부여는 하지 않는다. */
export function attachChangeImportSource(current:ChangeRequestBuffer|null,expected:ChangeRequestBuffer,session:DocumentSession,source:Extract<ChangeRequestSource,{kind:'ARTIFACT'}>):ChangeRequestBuffer|null{
 if(expected.ownerUserId!==session.user.id||expected.ownerClientId!==session.clientId)return current;
 if(!current||current.pending||current.result||current.uncertain||current.bindingId!==expected.bindingId||current.projectId!==expected.projectId||current.ownerUserId!==session.user.id||current.ownerClientId!==session.clientId||current.controlGeneration!==expected.controlGeneration||current.proposalId!==expected.proposalId||!same(current.beforeRef,expected.beforeRef)||!source||Object.keys(source).sort().join(',')!=='contentHash,id,kind'||source.kind!=='ARTIFACT'||!uuid(source.id)||!/^[0-9a-f]{64}$/.test(source.contentHash)||current.sourceRefs.length>=200||current.sourceRefs.some(r=>same(r,source)))return current;
 return {...current,sourceRefs:[...current.sourceRefs,structuredClone(source)],dirty:true,failure:null};
}
