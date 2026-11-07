import {ApiError} from '../../api/client.ts';
import {validateStoredLimitPolicy,type LimitPolicyRecord} from '../connections/limit-policy-api.ts';
import type {MethodBuffer} from './common-api.ts';
type Update=(change:(previous:MethodBuffer)=>MethodBuffer)=>void;
const locked=(b:MethodBuffer)=>!!(b.pending||b.preparationId||b.review?.pending||b.application?.pending||b.application?.preparationId);
function check(b:MethodBuffer,owner:string){if(locked(b)||b.ownerUserId!==owner||!b.graph.nodes.some(n=>n.nodeId===b.nodeId))throw new ApiError('NODE_BUDGET_INPUT_CHANGED');}
/** 보관 참조만 초안에 선택한다. 현재성·정책 적용·실행 허가를 만들지 않는다. */
export async function selectNodeBudget(original:MethodBuffer,projectId:string,owner:string,policy:LimitPolicyRecord,active:()=>boolean,update:Update){
 check(original,owner);const value=await validateStoredLimitPolicy(policy,projectId,policy.ref);if(value.snapshot.state!=='APPLIED')throw new ApiError('NODE_BUDGET_POLICY_NOT_APPLIED');if(!active())return;
 update(current=>current!==original||locked(current)?current:{...current,dirty:true,validation:null,graph:{...current.graph,nodes:current.graph.nodes.map(n=>n.nodeId===original.nodeId?{...n,limitPolicyRef:structuredClone(value.ref)}:n)}});
}
export function clearNodeBudget(original:MethodBuffer,owner:string,update:Update){check(original,owner);update(current=>current!==original||locked(current)?current:{...current,dirty:true,validation:null,graph:{...current.graph,nodes:current.graph.nodes.map(n=>n.nodeId===original.nodeId?{...n,limitPolicyRef:null}:n)}});}
