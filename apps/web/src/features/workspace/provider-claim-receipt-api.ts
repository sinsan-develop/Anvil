import {ApiClient,ApiError} from '../../api/client.ts';

export interface ProviderClaimHistoryQuery {projectId:string;agentSessionId:string;executionId:string;generation:number;commandId:string;kind:'THREAD'|'TURN';requestIdDigest:string;claimHash:string}
export interface ProviderClaimHistoricalReceipt {
 claimRef:{id:string;version:1;contentHash:string};recordedAt:string;state:'PROVIDER_CLAIM_RECORDED';sourceVerification:'PROVIDER_CLAIM_ONLY';nonceConsumed:true;
 credentialIssued:false;executionAuthorized:false;dispatchPerformed:false;workAccepted:false;
}
export interface ProviderClaimHistory {found:boolean;receipt:ProviderClaimHistoricalReceipt|null;observedAt:string;historyOnly:true;executionAuthorized:false;dispatchPerformed:false}
export interface ProviderClaimPageHistory {projectId:string;agentSessionId:string;agentSessionRef:{id:string;version:number;contentHash:string};items:Array<{query:ProviderClaimHistoryQuery;receipt:ProviderClaimHistoricalReceipt}>;hasMore:boolean;nextCursor:string|null;observedAt:string;historyOnly:true;availability:'UNVERIFIED';executionAuthorized:false;dispatchPerformed:false}
const exact=(v:any,keys:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const uuid=(v:any)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const hash=(v:any)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const utc=(v:any)=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const invalid=():never=>{throw new ApiError('PROVIDER_CLAIM_HISTORY_INVALID');};
/** Exact historical receipt only. Does not renew an execution credential, verify current availability or authorize a new SEND. */
export async function readProviderClaimReceiptHistory(client:ApiClient,input:ProviderClaimHistoryQuery,active:()=>boolean,selectedReceipt?:ProviderClaimHistoricalReceipt):Promise<ProviderClaimHistory|null>{
 if(!exact(input,['projectId','agentSessionId','executionId','generation','commandId','kind','requestIdDigest','claimHash'])||![input.projectId,input.agentSessionId,input.executionId,input.commandId].every(uuid)
  ||!Number.isSafeInteger(input.generation)||input.generation<1||!['THREAD','TURN'].includes(input.kind)||!hash(input.requestIdDigest)||!hash(input.claimHash))return invalid();
 const q=structuredClone(input),selected=selectedReceipt===undefined?undefined:structuredClone(selectedReceipt);
 if(selected!==undefined&&(!exact(selected,['claimRef','recordedAt','state','sourceVerification','nonceConsumed','credentialIssued','executionAuthorized','dispatchPerformed','workAccepted'])||!exact(selected.claimRef,['id','version','contentHash'])||!uuid(selected.claimRef.id)||selected.claimRef.version!==1||selected.claimRef.contentHash!==q.claimHash||!utc(selected.recordedAt)||selected.state!=='PROVIDER_CLAIM_RECORDED'||selected.sourceVerification!=='PROVIDER_CLAIM_ONLY'||selected.nonceConsumed!==true||selected.credentialIssued!==false||selected.executionAuthorized!==false||selected.dispatchPerformed!==false||selected.workAccepted!==false))return invalid();
 if(!active())return null;
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
 if(selected&&(Date.parse(v.observedAt)<Date.parse(selected.recordedAt)||v.found&&(v.receipt!.claimRef.id!==selected.claimRef.id||v.receipt!.claimRef.version!==selected.claimRef.version||v.receipt!.claimRef.contentHash!==selected.claimRef.contentHash||v.receipt!.recordedAt!==selected.recordedAt)))return invalid();
 return active()?structuredClone(v):null;
}
/** Current authenticated HUMAN history only. No automatic polling, SEND/STOP, write or provider-handle input. */
export async function readProviderClaimPageHistory(client:ApiClient,projectId:string,sessionRef:ProviderClaimPageHistory['agentSessionRef'],cursor:string|null,active:()=>boolean):Promise<ProviderClaimPageHistory|null>{
 if(!uuid(projectId)||!exact(sessionRef,['id','version','contentHash'])||!uuid(sessionRef.id)||!Number.isSafeInteger(sessionRef.version)||sessionRef.version<1||!hash(sessionRef.contentHash)||cursor!==null&&(typeof cursor!=='string'||cursor.length>4096||!/^([A-Za-z0-9_-]+)\.([a-f0-9]{64})$/.test(cursor)))return invalid();
 const selected=structuredClone(sessionRef);if(!active())return null;
 const path=`/api/v1/projects/${projectId}/agent-sessions/${selected.id}/provider-session-claims?`+new URLSearchParams({limit:'20',...(cursor===null?{}:{cursor})}),v=await client.get<ProviderClaimPageHistory>(path);if(!active())return null;
 if(!exact(v,['projectId','agentSessionId','agentSessionRef','items','hasMore','nextCursor','observedAt','historyOnly','availability','executionAuthorized','dispatchPerformed'])||v.projectId!==projectId||v.agentSessionId!==selected.id||!exact(v.agentSessionRef,['id','version','contentHash'])
  ||v.agentSessionRef.id!==selected.id||v.agentSessionRef.version!==selected.version||v.agentSessionRef.contentHash!==selected.contentHash||!Array.isArray(v.items)||v.items.length>20||typeof v.hasMore!=='boolean'||!utc(v.observedAt)||v.historyOnly!==true||v.availability!=='UNVERIFIED'||v.executionAuthorized!==false||v.dispatchPerformed!==false
  ||(v.hasMore?(v.items.length!==20||typeof v.nextCursor!=='string'||v.nextCursor.length>4096||!/^([A-Za-z0-9_-]+)\.([a-f0-9]{64})$/.test(v.nextCursor)):v.nextCursor!==null))return invalid();
 const ids=new Set<string>(),events=new Set<string>();let previous:ProviderClaimHistoricalReceipt|null=null;
 for(const item of v.items){
  if(!exact(item,['query','receipt']))return invalid();const q=item.query,r=item.receipt;
  if(!exact(q,['projectId','agentSessionId','executionId','generation','commandId','kind','requestIdDigest','claimHash'])||q.projectId!==projectId||q.agentSessionId!==selected.id||![q.executionId,q.commandId].every(uuid)||!Number.isSafeInteger(q.generation)||q.generation<1||!['THREAD','TURN'].includes(q.kind)||!hash(q.requestIdDigest)||!hash(q.claimHash)
   ||!exact(r,['claimRef','recordedAt','state','sourceVerification','nonceConsumed','credentialIssued','executionAuthorized','dispatchPerformed','workAccepted'])||!exact(r.claimRef,['id','version','contentHash'])||!uuid(r.claimRef.id)||r.claimRef.version!==1||r.claimRef.contentHash!==q.claimHash||!utc(r.recordedAt)||Date.parse(r.recordedAt)>Date.parse(v.observedAt)
   ||r.state!=='PROVIDER_CLAIM_RECORDED'||r.sourceVerification!=='PROVIDER_CLAIM_ONLY'||r.nonceConsumed!==true||r.credentialIssued!==false||r.executionAuthorized!==false||r.dispatchPerformed!==false||r.workAccepted!==false||ids.has(r.claimRef.id))return invalid();
  const event=JSON.stringify([q.executionId,q.generation,q.commandId,q.kind,q.requestIdDigest]);if(events.has(event)||previous&&(r.recordedAt>previous.recordedAt||r.recordedAt===previous.recordedAt&&r.claimRef.id>=previous.claimRef.id))return invalid();ids.add(r.claimRef.id);events.add(event);previous=r;
 }
 return structuredClone(v);
}
