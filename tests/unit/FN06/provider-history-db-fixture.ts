import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {BoundPgProviderClaimHistoryStore} from '../../../apps/server/modules/executions/provider-session-claim-history-store.ts';
import {providerProtectedHandleRef} from '../../../contracts/runtime/provider-session-claim-v1.ts';
export const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',sid='33333333-3333-4333-8333-333333333333',clientId='44444444-4444-4444-8444-444444444444',agentId='55555555-5555-4555-8555-555555555555';
export const at='2026-10-22T05:00:00.000Z',end='2026-10-22T05:10:00.000Z',ref={id:pid,version:1,contentHash:'a'.repeat(64)};
export function fixture(){
 const actor:any={actorId:uid,clientId,credentialGeneration:2,serverOwner:false,reauthUntil:null,authSession:{id:sid,idleExpiresAt:end,absoluteExpiresAt:'2026-10-22T06:00:00.000Z'}};
 const user:any={id:sid,user_id:uid,client_id:clientId,credential_generation:'2',current_generation:'2',user_status:'ACTIVE',revoked_at:null,user_revoked_at:null,client_revoked_at:null,idle_expires_at:new Date(end),absolute_expires_at:new Date('2026-10-22T06:00:00.000Z')};
 const snapshot={roleRef:ref,connectionRef:ref,state:'RESERVED',externalSessionHandleRef:null,reservedBy:{kind:'HUMAN',userId:uid},reservedAt:at};
 const sessionRef={id:agentId,version:1,contentHash:contentHash(canonicalJson(snapshot))};
 const session:any={project_id:pid,session_id:agentId,version:'1',content_hash:sessionRef.contentHash,snapshot_json:snapshot,created_by:uid,client_id:clientId,command_id:pid,operation:'bindResponsibleSession',state:'APPLIED',command_actor:uid,command_client:clientId,result_ref:{projectId:pid,status:'APPLIED',data:{status:'RESPONSIBLE_SESSION_RESERVED',snapshot:{sessionRef}}}};
 const member:any={id:pid,archived_at:null,participation:'OWNER'},calls:any[]=[];let now=at,read=false,fault='',claimRows:any[]=[];
 const db:any={query:async(sql:string,params:any[])=>{
  calls.push({sql,params});if(sql==='SELECT clock_timestamp() AS at')return{rows:[{at:new Date(now)}]};
  if(sql.includes('FROM anvil.auth_sessions'))return{rows:[user]};
  if(sql.includes('FROM anvil.projects')){if(read&&fault==='revoke')return{rows:[]};return{rows:[member]};}
  if(sql.includes('FROM anvil.agent_sessions'))return{rows:[session]};
  if(sql.includes('FROM anvil.provider_session_claims')){read=true;if(fault==='expire')now=end;return{rows:claimRows};}
  throw Error('UNEXPECTED_SQL');
 }};
 const q={projectId:pid,agentSessionId:agentId,executionId:pid,generation:1,commandId:pid,kind:'THREAD',requestIdDigest:'b'.repeat(64),claimHash:'c'.repeat(64)};
 const make=()=>new BoundPgProviderClaimHistoryStore(db,actor);
 function provideClaim(){
  const binding:any={schemaVersion:1,claimId:uid,kind:'THREAD',projectId:pid,assignmentRef:ref,agentSessionRef:sessionRef,responsibleBindingRef:ref,connectionRef:ref,environmentRef:ref,executorRegistrationRef:ref,execution:{id:pid,generation:1},commandId:pid,envelopeHash:'f'.repeat(64),authorizationReceiptRef:ref,permitRef:ref,localAttemptRef:ref,provider:{product:'CODEX_APP_SERVER',version:'0.161.0'},parentThreadClaimRef:null,source:{method:'thread/start',requestIdDigest:q.requestIdDigest,responseRef:ref,responsePayloadDigest:'e'.repeat(64)},capturedAt:at,usableBefore:end};
  const claim={...binding,protectedHandleRef:providerProtectedHandleRef(binding,'f'.repeat(64))},claimRef={id:claim.claimId,version:1,contentHash:contentHash(canonicalJson(claim))};q.claimHash=claimRef.contentHash;
  const receipt={claimRef,recordedAt:at,state:'PROVIDER_CLAIM_RECORDED',sourceVerification:'PROVIDER_CLAIM_ONLY',nonceConsumed:true,credentialIssued:false,executionAuthorized:false,dispatchPerformed:false,workAccepted:false};
  const scope={mode:'EXECUTION',projectId:pid,connectorId:uid,executionId:pid,executionGeneration:1,grantRef:ref,credentialGeneration:1},eventKey=contentHash(canonicalJson([pid,pid,1,pid,'THREAD',q.requestIdDigest]));
  const entry={scope,eventKey,claim,receipt};claimRows=[{project_id:pid,claim_id:claim.claimId,version:'1',execution_id:pid,generation:'1',command_id:pid,agent_session_id:agentId,agent_session_version:'1',grant_id:ref.id,grant_version:'1',permit_id:ref.id,permit_version:'1',kind:'THREAD',request_id_digest:q.requestIdDigest,event_key:eventKey,content_hash:claimRef.contentHash,snapshot_json:entry,recorded_at:new Date(at)}];return receipt;
 }
 return{actor,user,member,session,sessionRef,db,calls,q,make,provideClaim,fault:(v:string)=>fault=v};
}
