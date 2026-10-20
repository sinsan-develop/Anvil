import {ApiClient,ApiError} from '../../api/client.ts';
import {readCandidate,validRef,type Ref} from '../connections/api.ts';
/** 확정 임무에 고정된 원문만 조회한다. 만료 이력은 읽되 선택/허가/실행하지 않는다. */
export async function readAssignmentEnvironmentOriginal(client:ApiClient,projectId:string,assignmentRef:Ref,environmentRef:Ref,active:()=>boolean=()=>true){
 if(!validRef(assignmentRef)||!validRef(environmentRef))throw new ApiError('CLIENT_PATH_INVALID');
 const selected=structuredClone(environmentRef);
 if(!active())return null;
 const value=await readCandidate(client,projectId,selected);
 if(!active())return null;
 if(value.candidate.kind!=='ENVIRONMENT_CANDIDATE')throw new ApiError('ASSIGNMENT_ENVIRONMENT_KIND_INVALID',412);
 return value;
}
