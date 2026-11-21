import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,recordV1,refV1,uuidV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {authorizeMaterial,currentProjectController,persistProjectReceipt,projectReplay,type ProjectCommand} from '../access/project-command.ts';

const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=(code='NORMAL_UNDERSTANDING_REQUEST_INVALID',status=412):never=>{throw new AuthFailure(code,status);};
const originalAuthenticated=AccessRepository.prototype.authenticated,originalAuthenticate=AccessRepository.prototype.authenticateInTransaction;
function actorIdentity(a:AuthenticatedIdentity){if(!(a.reauthUntil instanceof Date)||!Number.isFinite(a.reauthUntil.getTime()))return fail('REAUTHENTICATION_REQUIRED',412);return hash({actorId:a.actorId,clientId:a.clientId,serverOwner:a.serverOwner,credentialGeneration:a.credentialGeneration,authSession:a.authSession,reauthUntil:a.reauthUntil.toISOString()});}
const contextKeys=['projectId','executionId','executionGeneration','grantRef','registrationRef','connectorId','credentialGeneration','startCommandId','startCommandRef','assignmentRef','preparationRef','contextBundleRef','sessionBindingRef'];
function input(raw:unknown):ProjectCommand{
 const q=cloneV1(raw);
 if(!recordV1(q,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])
  ||q.schemaVersion!==1||!uuidV1(q.projectId)||!uuidV1(q.commandId)||!uuidV1(q.clientId)||!uuidV1(q.targetId)
  ||!Number.isSafeInteger(q.controlGeneration)||q.controlGeneration<1||!Number.isSafeInteger(q.expectedVersion)||q.expectedVersion<1
  ||q.operation!=='readNormalUnderstandingResponse'||q.approvalRef!==null||!Array.isArray(q.baselineRefs)||q.baselineRefs.length
  ||!recordV1(q.payload,['assignmentRef','preparationRef'])||!refV1(q.payload.assignmentRef)||!refV1(q.payload.preparationRef)
  ||Buffer.byteLength(canonicalJson(q))>8192)fail('INPUT_INVALID',422);
 return q as ProjectCommand;
}
function basis(value:unknown,q:ProjectCommand,at:number){
 const b=cloneV1(value);
 if(!recordV1(b,['context','observedAt','expiresAt'])||!recordV1(b.context,contextKeys)||!isoV1(b.observedAt)||!isoV1(b.expiresAt)
  ||Date.parse(b.observedAt)>at||Date.parse(b.expiresAt)<=at)return fail();
 const c=b.context;
 if(c.projectId!==q.projectId||c.executionId!==q.targetId||c.executionGeneration!==q.expectedVersion||!uuidV1(c.connectorId)||!uuidV1(c.startCommandId)
  ||!Number.isSafeInteger(c.credentialGeneration)||c.credentialGeneration<1||!same(c.assignmentRef,q.payload.assignmentRef)||!same(c.preparationRef,q.payload.preparationRef)
  ||['grantRef','registrationRef','startCommandRef','assignmentRef','preparationRef','contextBundleRef','sessionBindingRef'].some(k=>!refV1(c[k])))fail();
 return b;
}
/** 실제 HUMAN 인증 transaction 안의 메타 탐색 요청만 저장한다.
 * FIRST/slot/init/tail은 미공급이다. 이 결과는 S2 선택 ticket이나 connector challenge가 아니다. */
export class NormalUnderstandingReadRequests{
 readonly #access:AccessRepository;
 constructor(access:AccessRepository){this.#access=access;}
 async command(token:string,csrf:string,raw:unknown){
  const q=input(raw),wall=Date.now(),mono=performance.now();let lastWall=wall,lastMono=mono,end=wall+30000,monoEnd=mono+30000;
  const check=()=>{const at=Date.now(),mark=performance.now();if(at<lastWall||mark<lastMono||at>=end||mark>=monoEnd
   ||Object.getPrototypeOf(this.#access)!==AccessRepository.prototype||Object.hasOwn(this.#access,'authenticated')||Object.hasOwn(this.#access,'authenticateInTransaction')
   ||AccessRepository.prototype.authenticated!==originalAuthenticated||AccessRepository.prototype.authenticateInTransaction!==originalAuthenticate)fail('NORMAL_UNDERSTANDING_REQUEST_OUTCOME_UNKNOWN',503);lastWall=at;lastMono=mark;};
  check();
  try{
   const result=await this.#access.authenticated(token,csrf,async(db,actor)=>{
    const query=db.query,identity=actorIdentity(actor);let tx='',dbAt=-Infinity;
    const clock=async()=>{check();if(query!==db.query||actorIdentity(actor)!==identity)fail();const rows=(await db.query('SELECT clock_timestamp() AS at,txid_current()::text AS transaction_id')).rows;check();
     const r=rows.length===1?rows[0]:null;if(query!==db.query||actorIdentity(actor)!==identity||!(r?.at instanceof Date)||!Number.isFinite(r.at.getTime())||r.at.getTime()<dbAt
      ||typeof r.transaction_id!=='string'||!/^[1-9][0-9]{0,18}$/.test(r.transaction_id)||tx&&tx!==r.transaction_id)fail();tx=r.transaction_id;dbAt=r.at.getTime();if(actor.reauthUntil!.getTime()<=dbAt)fail('REAUTHENTICATION_REQUIRED',412);return dbAt;};
    const until=(deadline:number,at:number)=>{if(!Number.isFinite(deadline)||deadline<=at)fail();const remain=deadline-at;end=Math.min(end,Date.now()+remain);monoEnd=Math.min(monoEnd,performance.now()+remain);check();};
    await clock();await currentProjectController(db,actor,q);await clock();
    const policy=await authorizeMaterial(db,actor,q,true);if(policy.approvalRequired)fail('PROJECT_OPERATION_DENIED',403);
    const s=actor.authSession;if(!s||!uuidV1(s.id)||!isoV1(s.idleExpiresAt)||!isoV1(s.absoluteExpiresAt))return fail();
    const inspect=async()=>{
     const at=await clock();await currentProjectController(db,actor,q);const current=await authorizeMaterial(db,actor,q,true);await clock();
     if(current.approvalRequired||!same(current.ref,policy.ref))fail('PROJECT_OPERATION_DENIED',403);
     until(Math.min(policy.validUntil,current.validUntil,Date.parse(s.idleExpiresAt),Date.parse(s.absoluteExpiresAt),actor.reauthUntil!.getTime()),dbAt);
     const rows=(await db.query('SELECT anvil.fn09_normal_understanding_request_basis($1,$2,$3,$4,$5,$6) AS basis',[s.id,actor.actorId,actor.clientId,JSON.stringify(q),JSON.stringify(policy.ref),tx])).rows;
     const b=basis(rows.length===1?rows[0]?.basis:null,q,await clock());if(Date.parse(b.observedAt)<at)fail();until(Date.parse(b.expiresAt),dbAt);return b;
    };
    const first=await inspect(),prior=await projectReplay(db,actor,q);await clock();
    let response:unknown;
    if(prior!==undefined){
     const rows=(await db.query('SELECT * FROM anvil.fn09_normal_understanding_request_replay($1,$2,$3,$4,$5,$6)',
      [s.id,actor.actorId,actor.clientId,JSON.stringify(q),JSON.stringify(policy.ref),tx])).rows;
     await clock();const r=rows.length===1?rows[0]:null,snapshot=r?.snapshot_json;
     if(!r||r.complete!==true||hash(snapshot)!==r.content_hash||!same(snapshot.request,q)||!same(snapshot.context,first.context)
      ||snapshot.sourceScope!==null||snapshot.state!=='PENDING_SOURCE'||!same(r.result_ref,prior)||prior.data?.requestRef?.id!==r.id||prior.data?.requestRef?.contentHash!==r.content_hash)fail('NORMAL_UNDERSTANDING_REQUEST_REPLAY_INVALID',409);
     response=prior;
    }else{
     const now=await clock(),expiresAt=new Date(Math.min(now+30000,Date.parse(first.expiresAt),policy.validUntil,Date.parse(s.idleExpiresAt),Date.parse(s.absoluteExpiresAt),actor.reauthUntil!.getTime())).toISOString();
     const snapshot={schemaVersion:1,purpose:'NORMAL_UNDERSTANDING_METADATA_DISCOVERY',request:q,context:first.context,
      requestedBy:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId,sessionId:s.id,credentialGeneration:actor.credentialGeneration,controlGeneration:q.controlGeneration},
      policyRef:policy.ref,state:'PENDING_SOURCE',sourceScope:null,createdAt:new Date(now).toISOString(),expiresAt};
     const ref={id:randomUUID(),version:1,contentHash:hash(snapshot)},data={status:'NORMAL_UNDERSTANDING_METADATA_REQUESTED',requestRef:ref,state:'PENDING_SOURCE',sourceAvailable:false,selectionAvailable:false,expiresAt};
     const receipt=await persistProjectReceipt(db,actor,q,ref,data,policy.ref,'EXPLICIT_NORMAL_UNDERSTANDING_METADATA_REQUEST');await clock();
     const stored=(await db.query('SELECT anvil.fn09_normal_understanding_request_insert($1,$2,$3,$4,$5,$6,$7,$8,$9) AS stored',
      [s.id,actor.actorId,actor.clientId,JSON.stringify(q),JSON.stringify(policy.ref),tx,JSON.stringify(ref),JSON.stringify(snapshot),receipt.id])).rows;
     await clock();if(stored.length!==1||!same(stored[0]?.stored,ref))fail();response=receipt.result;
    }
    const currentActor=await this.#access.authenticateInTransaction(db,token,csrf);if(actorIdentity(currentActor)!==identity)fail();
    const last=await inspect();if(!same(last.context,first.context))fail();await clock();return response;
   });check();return result;
  }catch(error){if(error instanceof AuthFailure)throw error;throw new AuthFailure('NORMAL_UNDERSTANDING_REQUEST_OUTCOME_UNKNOWN',503);}
 }
}
