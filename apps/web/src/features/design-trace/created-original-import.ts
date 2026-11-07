import { ApiClient, ApiError } from '../../api/client.ts';
import { readProjectDraft } from '../project-create/api.ts';
import { readDraftArtifactBytes } from '../project-create/draft-artifact-api.ts';
import type { DraftArtifactRef } from '../../../../../contracts/draft-artifacts.ts';
import type { CreatedOriginalSelection } from '../../shell/routes.ts';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function sameOriginalRef(a:DraftArtifactRef,b:DraftArtifactRef):boolean{return!!a&&!!b&&a.artifactId===b.artifactId&&a.bytes===b.bytes&&a.contentHash===b.contentHash&&a.mediaType===b.mediaType;}
/** URL/보존 버퍼는 조회 hint다. 현재 초안 소유·프로젝트 귀속과 보호 원문을 다시 확인한다. */
export async function readCreatedOriginal(client:ApiClient,projectId:string,hint:CreatedOriginalSelection,active:()=>boolean,expected?:DraftArtifactRef):Promise<{ref:DraftArtifactRef;bytes:Uint8Array<ArrayBuffer>}>{
 const check=()=>{if(!active())throw new ApiError('IMPORT_SOURCE_READ_PAUSED');};check();
 if(!uuid.test(projectId)||!hint||Object.keys(hint).sort().join(',')!=='artifactId,draftId'||!uuid.test(hint.draftId)||!uuid.test(hint.artifactId))throw new ApiError('CLIENT_PATH_INVALID');
 const value=await readProjectDraft(client,hint.draftId);check();
 const records=value.storedArtifacts?.filter(r=>r.ref.artifactId===hint.artifactId)??[],selected=value.input.artifactRefs.filter(r=>r.artifactId===hint.artifactId),record=records[0];
 if(value.consumedProjectId!==projectId||value.editable!==false||records.length!==1||selected.length!==1||!record||record.projectId!==projectId||record.state!=='FINALIZED'||record.artifactState!=='READY'||!sameOriginalRef(record.ref,selected[0]!)||expected&&!sameOriginalRef(record.ref,expected))throw new ApiError('IMPORT_SOURCE_CHANGED');
 const ref=structuredClone(record.ref),bytes=await readDraftArtifactBytes(client,hint.draftId,ref,projectId);check();
 return{ref,bytes};
}
