import {ApiClient,ApiError} from '../../api/client.ts';
import {readWorkspaceProject} from '../workspace/api.ts';
export async function readProjectAccessSummary(client:ApiClient,projectId:string,active:()=>boolean){
 const check=()=>{if(!active())throw new ApiError('PROJECT_ACCESS_READ_PAUSED');};check();
 const value=await readWorkspaceProject(client,projectId);check();
 // 수신 시각은 브라우저 시계다. 프로젝트 updatedAt을 제어 변경 시각으로 쓰지 않는다.
 return {projectId:value.id,projectVersion:value.version,participation:value.participation,controlState:structuredClone(value.controlState),readinessIssues:structuredClone(value.readinessIssues),receivedAt:new Date().toISOString(),source:'PROJECT_DETAIL_RESPONSE' as const,executionAuthorized:false as const,controlAcquired:false as const};
}
export type ProjectAccessSummaryView=Awaited<ReturnType<typeof readProjectAccessSummary>>;
