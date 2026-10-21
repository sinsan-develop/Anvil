import {ApiError} from '../../api/client.ts';
import type {MethodBuffer} from './common-api.ts';
import {readMethodDraftFile} from './method-draft-import.ts';

/** 기존 가져오기 payload만 복사한다. 프로젝트 백업·권한/명령·확정 복원이 아니다. */
export function exportMethodDraftFile(buffer:MethodBuffer,userId:string,scope:'USER_COMMON'|'PROJECT'):string{
 if(!userId||buffer.ownerUserId!==userId||buffer.pending||buffer.preparationId||buffer.review||buffer.application)throw new ApiError('METHOD_DRAFT_EXPORT_LOCKED');
 const raw=JSON.stringify({name:buffer.name,purpose:buffer.purpose,scope,graph:buffer.graph,reason:buffer.reason});
 return JSON.stringify(readMethodDraftFile(raw,scope));
}
