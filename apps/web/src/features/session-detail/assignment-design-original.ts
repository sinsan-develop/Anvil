import {ApiClient,ApiError} from '../../api/client.ts';
import {validRef} from '../connections/api.ts';
import {readDocument} from '../design-trace/api.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {SessionDetail} from './api.ts';
/** 보호 조회된 확정본·원초안에 결박된 설계만 읽으며 현재 효력·실행 허가는 판정하지 않는다. */
export async function readAssignmentDesignOriginal(client:ApiClient,detail:Pick<SessionDetail,'projectId'|'draft'|'confirmed'>,active:()=>boolean=()=>true){
 const {projectId,draft,confirmed}=structuredClone(detail),fail=():never=>{throw new ApiError('ASSIGNMENT_DESIGN_ORIGINAL_UNVERIFIED',412);};
 if(!draft||!confirmed||draft.projectId!==projectId||confirmed.projectId!==projectId||!validRef(draft.ref)||!validRef(confirmed.ref)||confirmed.ref.id!==draft.ref.id||confirmed.ref.version!==draft.ref.version||confirmed.snapshot?.contentConfirmed!==true||ordered(confirmed.snapshot.draftRef)!==ordered(draft.ref)||ordered(confirmed.snapshot.definition)!==ordered(draft.snapshot?.definition))fail();
 const basis=draft.snapshot?.basis,definition=confirmed!.snapshot.definition,ref=basis?.designRef;
 if(!validRef(ref)||!Array.isArray(definition?.baselineRefs)||definition.baselineRefs.filter(item=>ordered(item)===ordered(ref)).length!==1||ordered(definition.taskRef?.planRef)!==ordered(basis.planRef)||ordered(definition.taskRef?.applicationRef)!==ordered(basis.applicationRef)||definition.taskRef?.taskCode!==basis.taskCode||definition.taskRef?.nodeId!==basis.nodeId)fail();
 return readDocument(client,projectId,ref.id,ref.version,{expectedContentHash:ref.contentHash,active});
}
