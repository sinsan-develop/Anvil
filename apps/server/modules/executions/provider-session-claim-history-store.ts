import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import type {SyntheticProviderClaimHistoryStore} from './provider-session-claim-history.ts';
import {SyntheticPgProviderClaimJournal} from './provider-session-claim-journal.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
function reject():never{throw new AuthFailure('PROVIDER_SESSION_HISTORY_REJECTED',403);}
const date=(v:unknown):v is Date=>v instanceof Date&&Number.isFinite(v.getTime());
/** Bind only inside AccessRepository.authenticated's existing transaction.
 * This is an OWNER-only partial resolver, not a replacement for the approved RESPONSIBLE path.
 * No pool, BEGIN/COMMIT, login renewal, policy grant, endpoint registration or execution credential. */
export class BoundPgProviderClaimHistoryStore implements SyntheticProviderClaimHistoryStore {
 readonly transport='SYNTHETIC_ONLY' as const;
 readonly db:PoolClient;
 #responseDeadline:string|null=null;
 readonly #identity:{actorId:string;clientId:string;credentialGeneration:number;authSession:{id:string;idleExpiresAt:string;absoluteExpiresAt:string}};
 constructor(db:PoolClient,actor:AuthenticatedIdentity){
  if(typeof db?.query!=='function'||!uuidV1(actor?.actorId)||!uuidV1(actor.clientId)||!positive(actor.credentialGeneration)||!actor.authSession||!uuidV1(actor.authSession.id)||!isoV1(actor.authSession.idleExpiresAt)||!isoV1(actor.authSession.absoluteExpiresAt))reject();
  this.db=db;this.#identity=cloneV1({actorId:actor.actorId,clientId:actor.clientId,credentialGeneration:actor.credentialGeneration,authSession:actor.authSession});
 }
 async #clock(){const rows=(await this.db.query('SELECT clock_timestamp() AS at')).rows;if(rows.length!==1||!date(rows[0]?.at))return reject();return rows[0].at.toISOString();}
 /** Historical response expiry only, never a dispatch capability. Available only after a successful final access recheck. */
 responseValidUntil(){if(this.#responseDeadline===null)return reject();return this.#responseDeadline;}
 async #current(scope:{projectId:string;agentSessionId:string}){
  const a=this.#identity;
  // Same order as authentication and revocation: user/session/client first, then project/member.
  const rows=(await this.db.query('SELECT s.*,u.status AS user_status,u.revoked_at AS user_revoked_at,u.credential_generation AS current_generation,cl.revoked_at AS client_revoked_at FROM anvil.auth_sessions s JOIN anvil.users u ON u.id=s.user_id JOIN anvil.clients cl ON cl.user_id=s.user_id AND cl.id=s.client_id WHERE s.id=$1::uuid AND s.user_id=$2::uuid AND s.client_id=$3::uuid FOR UPDATE OF u,s,cl',[a.authSession.id,a.actorId,a.clientId])).rows;
  if(rows.length!==1)return reject();const s=rows[0];
  if(s.id!==a.authSession.id||s.user_id!==a.actorId||s.client_id!==a.clientId||s.user_status!=='ACTIVE'||s.revoked_at||s.user_revoked_at||s.client_revoked_at||Number(s.current_generation)!==a.credentialGeneration||Number(s.credential_generation)!==a.credentialGeneration||!date(s.idle_expires_at)||!date(s.absolute_expires_at))return reject();
  const deadline=Math.min(s.idle_expires_at.getTime(),s.absolute_expires_at.getTime(),Date.parse(a.authSession.idleExpiresAt),Date.parse(a.authSession.absoluteExpiresAt));
  if(deadline<=Date.parse(await this.#clock()))return reject();
  const member=await projectMember(this.db,a as AuthenticatedIdentity,scope.projectId,true);
  if(member.id!==scope.projectId||member.participation!=='OWNER')return reject();
  // 예약 원장은 불변·UPDATE 금지다. 현재 인증/구성원 잠금과 변경 가능한 command의 SHARE 잠금은 유지한다.
  const records=(await this.db.query('SELECT s.*,c.operation,c.state,c.actor_id AS command_actor,c.client_id AS command_client,c.result_ref FROM anvil.agent_sessions s JOIN anvil.commands c ON c.project_id=s.project_id AND c.id=s.command_id WHERE s.project_id=$1::uuid AND s.session_id=$2::uuid LIMIT 2 FOR SHARE OF c',[scope.projectId,scope.agentSessionId])).rows;
  if(records.length!==1)return reject();const r=records[0],v=cloneV1(r.snapshot_json),reference={id:r.session_id,version:Number(r.version),contentHash:r.content_hash};
  if(r.project_id!==scope.projectId||reference.id!==scope.agentSessionId||!refV1(reference)||reference.version!==1||contentHash(canonicalJson(v))!==reference.contentHash
   ||!recordV1(v,['roleRef','connectionRef','state','externalSessionHandleRef','reservedBy','reservedAt'])||!refV1(v.roleRef)||!refV1(v.connectionRef)||v.state!=='RESERVED'||v.externalSessionHandleRef!==null||!isoV1(v.reservedAt)||!uuidV1(r.created_by)||!uuidV1(r.client_id)||!uuidV1(r.command_id)
   ||!same(v.reservedBy,{kind:'HUMAN',userId:r.created_by})||r.operation!=='bindResponsibleSession'||r.state!=='APPLIED'||r.command_actor!==r.created_by||r.command_client!==r.client_id
   ||r.result_ref?.projectId!==scope.projectId||r.result_ref?.status!=='APPLIED'||r.result_ref?.data?.status!=='RESPONSIBLE_SESSION_RESERVED'||!same(r.result_ref?.data?.snapshot?.sessionRef,reference))return reject();
  const now=await this.#clock();if(Date.parse(now)>=deadline||Date.parse(v.reservedAt)>Date.parse(now))return reject();
  return{transport:'SYNTHETIC_ONLY' as const,subject:{kind:'HUMAN' as const,userId:a.actorId,clientId:a.clientId,sessionId:a.authSession.id,credentialGeneration:a.credentialGeneration},projectId:scope.projectId,agentSessionRef:reference,participation:'OWNER' as const,readPermission:'VERIFIED_CURRENT' as const,responsibleBindingRef:null,checkedAt:now,expiresAt:new Date(deadline).toISOString()};
 }
 async transaction<T>(raw:{projectId:string;agentSessionId:string},body:Parameters<SyntheticProviderClaimHistoryStore['transaction']>[1]):Promise<T>{
  let result:unknown,conflict=false;this.#responseDeadline=null;
  try{
   if(!recordV1(raw,['projectId','agentSessionId'])||!uuidV1(raw.projectId)||!uuidV1(raw.agentSessionId)||typeof body!=='function')return reject();
   const scope=cloneV1(raw),first=await this.#current(scope),journal=new SyntheticPgProviderClaimJournal();
   try{result=await body({clock:()=>this.#clock(),current:()=>this.#current(scope),read:query=>{if(query.projectId!==scope.projectId||query.agentSessionId!==scope.agentSessionId)return reject();return journal.read(this.db,query);}});}
   catch(error){if(error instanceof AuthFailure&&error.message==='PROVIDER_SESSION_CLAIM_CONFLICT'&&error.statusCode===409)conflict=true;else throw error;}
   const last=await this.#current(scope),{checkedAt:_,...before}=first,{checkedAt:__,...after}=last;
   if(!same(before,after)||Date.parse(last.checkedAt)>=Math.min(Date.parse(first.expiresAt),Date.parse(first.checkedAt)+30000))return reject();
   this.#responseDeadline=new Date(Math.min(Date.parse(first.expiresAt),Date.parse(first.checkedAt)+30000,Date.parse(last.expiresAt),Date.parse(last.checkedAt)+30000)).toISOString();
  }catch{return reject();}
  if(conflict)throw new AuthFailure('PROVIDER_SESSION_CLAIM_CONFLICT',409);
  return result as T;
 }
}
