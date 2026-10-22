import {ApiClient,ApiError} from '../../api/client.ts';

export interface ProviderClaimHistoryQuery {projectId:string;agentSessionId:string;executionId:string;generation:number;commandId:string;kind:'THREAD';requestIdDigest:string;claimHash:string}
export interface ProviderClaimHistoricalReceipt {
 claimRef:{id:string;version:1;contentHash:string};recordedAt:string;state:'PROVIDER_CLAIM_RECORDED';sourceVerification:'PROVIDER_CLAIM_ONLY';nonceConsumed:true;
 credentialIssued:false;executionAuthorized:false;dispatchPerformed:false;workAccepted:false;
}
export interface ProviderClaimHistory {found:boolean;receipt:ProviderClaimHistoricalReceipt|null;observedAt:string;historyOnly:true;executionAuthorized:false;dispatchPerformed:false}
const exact=(v:any,keys:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const uuid=(v:any)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const hash=(v:any)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const utc=(v:any)=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const invalid=():never=>{throw new ApiError('PROVIDER_CLAIM_HISTORY_INVALID');};
/** Exact historical receipt only. Does not renew an execution credential, verify current availability or authorize a new SEND. */
export async function readProviderClaimReceiptHistory(client:ApiClient,input:ProviderClaimHistoryQuery,active:()=>boolean):Promise<ProviderClaimHistory|null>{
 if(!exact(input,['projectId','agentSessionId','executionId','generation','commandId','kind','requestIdDigest','claimHash'])||![input.projectId,input.agentSessionId,input.executionId,input.commandId].every(uuid)
  ||!Number.isSafeInteger(input.generation)||input.generation<1||input.kind!=='THREAD'||!hash(input.requestIdDigest)||!hash(input.claimHash))return invalid();
 const q=structuredClone(input);if(!active())return null;
 const path='/api/v1/projects/'+q.projectId+'/agent-sessions/'+q.agentSessionId+'/provider-session-claim-receipt?'+new URLSearchParams({executionId:q.executionId,generation:String(q.generation),commandId:q.commandId,kind:q.kind,requestIdDigest:q.requestIdDigest,claimHash:q.claimHash});
 const v=await client.get<ProviderClaimHistory>(path);if(!active())return null;
 if(!exact(v,['found','receipt','observedAt','historyOnly','executionAuthorized','dispatchPerformed'])||typeof v.found!=='boolean'||!utc(v.observedAt)||v.historyOnly!==true||v.executionAuthorized!==false||v.dispatchPerformed!==false)return invalid();
 if(!v.found){if(v.receipt!==null)return invalid();}
 else{
  const r=v.receipt;
  if(!exact(r,['claimRef','recordedAt','state','sourceVerification','nonceConsumed','credentialIssued','executionAuthorized','dispatchPerformed','workAccepted'])||!r
   ||!exact(r.claimRef,['id','version','contentHash'])||!uuid(r.claimRef.id)||r.claimRef.version!==1||r.claimRef.contentHash!==q.claimHash
   ||!utc(r.recordedAt)||Date.parse(r.recordedAt)>Date.parse(v.observedAt)||r.state!=='PROVIDER_CLAIM_RECORDED'||r.sourceVerification!=='PROVIDER_CLAIM_ONLY'||r.nonceConsumed!==true
   ||r.credentialIssued!==false||r.executionAuthorized!==false||r.dispatchPerformed!==false||r.workAccepted!==false)return invalid();
 }
 return structuredClone(v);
}
