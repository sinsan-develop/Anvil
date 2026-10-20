import {ApiClient,ApiError} from '../../api/client.ts';
import {listApprovals} from '../decisions/api.ts';
export async function readProjectPendingApprovals(client:ApiClient,projectId:string,cursor:string|null,active:()=>boolean){
 const check=()=>{if(!active())throw new ApiError('PROJECT_DECISIONS_READ_PAUSED');};check();
 const page=await listApprovals(client,projectId,'PENDING',cursor);check();const observed=Date.parse(page.observedAt);
 if(new Set(page.items.map(i=>i.id)).size!==page.items.length||page.hasMore&&(!page.items.length||page.nextCursor===cursor)||page.items.some(i=>i.currentVersion!==1||i.storedStatus!=='PENDING'||i.effectiveState!=='PENDING'||typeof i.operation!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,99}$/.test(i.operation)||Date.parse(i.createdAt)>observed||Date.parse(i.expiresAt)<=observed))throw new ApiError('PROJECT_DECISIONS_RESPONSE_INVALID');
 return{projectId,items:page.items.map(i=>({id:i.id,operation:i.operation,expiresAt:i.expiresAt,createdAt:i.createdAt,integrity:i.integrity})),pageCount:page.items.length,countScope:'CURRENT_PAGE_ONLY' as const,totalCount:null,hasMore:page.hasMore,nextCursor:page.nextCursor,observedAt:page.observedAt,executionAuthorized:false as const,decisionPerformed:false as const};
}
export type ProjectPendingApprovalsView=Awaited<ReturnType<typeof readProjectPendingApprovals>>;
