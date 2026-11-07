import {ApiClient,ApiError} from '../../api/client.ts';
import {validRef} from '../connections/api.ts';
import {readWorkPlan} from '../design-trace/work-plan-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {SessionDetail} from './api.ts';
type Context=Pick<SessionDetail,'projectId'|'draft'|'confirmed'>;
const fail=():never=>{throw new ApiError('ASSIGNMENT_PLAN_ORIGINAL_UNVERIFIED',412);};
/** 보호 조회로 검증된 확정본·원초안 쌍의 고정 업무만 따라간다. 현재 실행/착수·개정은 판정하지 않는다. */
export async function readAssignmentPlanOriginal(client:ApiClient,detail:Context,active:()=>boolean=()=>true){
 const selected=structuredClone(detail),draft=selected.draft,confirmed=selected.confirmed;
 if(!draft||!confirmed||draft.projectId!==selected.projectId||confirmed.projectId!==selected.projectId||!validRef(draft.ref)||!validRef(confirmed.ref)||confirmed.ref.id!==draft.ref.id||confirmed.ref.version!==draft.ref.version||confirmed.snapshot?.contentConfirmed!==true||!draft.snapshot?.basis||!confirmed.snapshot.definition||ordered(confirmed.snapshot.draftRef)!==ordered(draft.ref)||ordered(confirmed.snapshot.definition)!==ordered(draft.snapshot.definition))fail();
 const definition=confirmed!.snapshot.definition,basis=draft.snapshot.basis,target=definition.taskRef;
 if(!target||!validRef(target.planRef)||!validRef(basis.designRef)||ordered(target.planRef)!==ordered(basis.planRef)||ordered(target.applicationRef)!==ordered(basis.applicationRef)||target.taskCode!==basis.taskCode||target.nodeId!==basis.nodeId||!/^[a-f0-9]{64}$/.test(basis.taskCardHash))fail();
 if(!active())return null;
 const plan=await readWorkPlan(client,selected.projectId,target.planRef);if(!active())return null;
 const cards=plan.tasks.filter(task=>task.taskCode===target.taskCode);
 if(plan.relationalProjection!=='STORED'||ordered(plan.designRef)!==ordered(basis.designRef)||cards.length!==1)fail();
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ordered(cards[0]))))].map(n=>n.toString(16).padStart(2,'0')).join('');
 if(!active())return null;if(digest!==basis.taskCardHash)fail();
 return plan;
}
