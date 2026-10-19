import {ApiClient,ApiError} from '../../api/client.ts';
import {readCandidate,validRef,type CandidateView} from './api.ts';
/** 현재 고정 조회에서 읽은 부모 fullref만 소비한다. 발견·현재 head·허가 조회가 아니다. */
export async function readPreviousCandidate(client:ApiClient,projectId:string,current:CandidateView,active:()=>boolean):Promise<CandidateView|null>{
 const source=structuredClone(current),parent=source?.candidate?.input?.candidateRef;
 if(!validRef(source?.ref)||!['CONNECTION_CANDIDATE','ENVIRONMENT_CANDIDATE'].includes(source?.candidate?.kind)||source.candidate.input.kind!==source.candidate.kind)throw new ApiError('CANDIDATE_HISTORY_REFERENCE_INVALID');
 if(source.ref.version===1&&parent===null)return null;
 if(!validRef(parent)||parent.id!==source.ref.id||parent.version+1!==source.ref.version)throw new ApiError('CANDIDATE_HISTORY_REFERENCE_INVALID');
 if(!active())return null;
 const value=await readCandidate(client,projectId,parent);if(!active())return null;
 if(value.candidate.kind!==source.candidate.kind)throw new ApiError('CANDIDATE_HISTORY_KIND_MISMATCH');
 return value;
}
