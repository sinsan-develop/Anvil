import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AccessRepository,AuthFailure} from '../access/repository.ts';
import {persistProjectReceipt,projectReplay,type ProjectCommand} from '../access/project-command.ts';
import {readOwnershipPreparationIntentBasis} from './ownership-human-basis.ts';
import {planOwnershipPreparationIntent} from './ownership-preparation-intent.ts';

const fail=():never=>{throw new AuthFailure('OWNERSHIP_PREPARATION_STAGE_UNAVAILABLE',412);};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
export interface SyntheticPreparationPrerequisites {transport:'SYNTHETIC_ONLY';current(db:PoolClient,intent:unknown):Promise<unknown>}
/** caller 소유 transaction의 합성 staging. 원 command/receipt/audit만 기록하며
 * 실제 준비 사건·process/writer·허가를 만들거나 COMMIT/연결 종료하지 않는다. */
export async function stageSyntheticOwnershipPreparationIntent(db:PoolClient,access:AccessRepository,token:string,csrf:string,intentValue:unknown,serverIds:unknown,port:SyntheticPreparationPrerequisites|null=null,signal?:AbortSignal){
 const current=port?.current,authenticate=access.authenticateInTransaction;
 const stable=()=>{if(!port||port.transport!=='SYNTHETIC_ONLY'||typeof current!=='function'||port.current!==current||access.authenticateInTransaction!==authenticate||signal?.aborted)return fail();};
 try{
  stable();const rawIntent=cloneV1(intentValue),ids=cloneV1(serverIds);
  const query=async(sql:string,args:any[]=[])=>{stable();const r=await db.query(sql,args);stable();return r;};
  const read=async()=>{stable();const v=await readOwnershipPreparationIntentBasis(db,access,token,csrf,rawIntent);stable();if(v.approvalRequired)return fail();return v;};
  const first=await read(),intent=first.intent,plan=planOwnershipPreparationIntent(intent,ids,Date.parse(first.checkedAt));
  const actor=await authenticate.call(access,db,token,csrf);stable();
  if(!actor.authSession||!same({userId:actor.actorId,clientId:actor.clientId,humanSessionId:actor.authSession.id,controlGeneration:intent.subject.controlGeneration,credentialGeneration:actor.credentialGeneration},first.subject))return fail();
  const request=plan.commandSnapshot as ProjectCommand;
  const readResult=(r:any)=>{
   if(!recordV1(r,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt'])||!uuidV1(r.operationId)||r.commandId!==request.commandId||r.projectId!==request.projectId||r.status!=='APPLIED'||r.targetId!==plan.intentRef.id||r.version!==1||!same(r.evidenceRefs,[])||!same(r.warnings,[])||!isoV1(r.serverReceivedAt)||!recordV1(r.data,['ref','status','intent','commandSnapshot'])||r.data.status!=='OWNERSHIP_PREPARATION_INTENT_RECORDED'||!same(r.data.ref,plan.intentRef)||!same(r.data.intent,plan.intent)||!same(r.data.commandSnapshot,request))return fail();return cloneV1(r);
  };
  const previous=await projectReplay(db,actor,request);stable();
  // 재조회는 과거 결과이며 재준비/새 사건 발행 근거가 아니다. 현재 actor/policy는 위에서 다시 대조했다.
  if(previous!==undefined){
   const result=readResult(previous),last=await read();
   for(const k of ['scope','subject','policyRef','registrationRef','publicKeySpki','approvalRequired','intentHash'] as const)if(!same(first[k],last[k]))return fail();
   if(Date.parse(last.checkedAt)<Date.parse(first.checkedAt))return fail();
   return{purpose:'SYNTHETIC_OWNERSHIP_PREPARATION_REPLAY_HISTORY_ONLY' as const,result,preparationAuthorized:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
  }
  if((await query("SELECT * FROM anvil.execution_ownership_events WHERE project_id=$1 AND kind='PREPARATION_GRANTED' ORDER BY project_sequence DESC LIMIT 1",[request.projectId])).rows.length)return fail();
  // 이 최초 슬롯 경로는 기존 준비/전임 writer의 회수를 가정하지 않는다.
  const getInputs=async(floor:number)=>{
   stable();const raw=cloneV1(await current!.call(port,db,cloneV1(intent)));stable();
   const now=(await query('SELECT clock_timestamp() AS at')).rows[0]?.at;
   if(!(now instanceof Date)||!Number.isFinite(now.getTime())||now.getTime()<floor||!recordV1(raw,['purpose','scope','intentHash','writer','candidate','checkedAt','expiresAt','executionAuthorized','dispatchPerformed'])||raw.purpose!=='SYNTHETIC_PREPARATION_PREREQUISITES'||!same(raw.scope,intent.scope)||raw.intentHash!==plan.intentRef.contentHash||raw.executionAuthorized!==false||raw.dispatchPerformed!==false||!isoV1(raw.checkedAt)||!isoV1(raw.expiresAt)||Date.parse(raw.checkedAt)>now.getTime()||now.getTime()-Date.parse(raw.checkedAt)>1000||Date.parse(raw.expiresAt)<Date.parse(intent.expiresAt)||now.getTime()>=Date.parse(raw.expiresAt))return fail();
   const w=raw.writer,c=raw.candidate,p=intent.details;
   if(!recordV1(w,['claim','generation','evidenceRef','predecessorRef','reclaimRef'])||w.claim!=='SYNTHETIC_NONE'||!positive(w.generation)||!refV1(w.evidenceRef)||w.predecessorRef!==null||w.reclaimRef!==null||!recordV1(c,['sourceRef','rootId','hostHash','workerHash','runId','processGeneration'])||!refV1(c.sourceRef)||!['rootId','hostHash','workerHash','runId','processGeneration'].every(k=>same(c[k],p[k])))return fail();
   return{value:raw,now:now.getTime()};
  };
  if(Date.parse(intent.expiresAt)>Date.parse(first.expiresAt))return fail();
  const observed=await getInputs(Date.parse(first.checkedAt));
  const stored=await persistProjectReceipt(db,actor,request,plan.intentRef,{status:'OWNERSHIP_PREPARATION_INTENT_RECORDED',intent:cloneV1(plan.intent),commandSnapshot:cloneV1(request)},first.policyRef,'EXPLICIT_OWNERSHIP_PREPARATION_INTENT');stable();
  const result=readResult(stored.result);
  const rows=(await query('SELECT project_id,server_sequence,event_id,actor_ref,client_ref,command_id,operation_id,target_ref,policy_ref,approval_ref,outcome,reason_code,scope_digest,recorded_at,source_kind,correction_of FROM anvil.audit_events WHERE project_id=$1 AND command_id=$2',[request.projectId,stored.id])).rows;
  if(rows.length!==1)return fail();const a=rows[0];
  if(a.project_id!==request.projectId||!positive(Number(a.server_sequence))||!uuidV1(a.event_id)||!same(a.actor_ref,{kind:'HUMAN',userId:actor.actorId})||a.client_ref!==actor.clientId||a.command_id!==stored.id||a.operation_id!==result.operationId||!same(a.target_ref,plan.intentRef)||!same(a.policy_ref,first.policyRef)||a.approval_ref!==null||a.outcome!=='APPLIED'||a.reason_code!=='EXPLICIT_OWNERSHIP_PREPARATION_INTENT'||a.scope_digest!==stored.authorizationReceiptRef.contentHash||!(a.recorded_at instanceof Date)||!Number.isFinite(a.recorded_at.getTime())||a.recorded_at.getTime()>Date.parse(intent.at)||Date.parse(result.serverReceivedAt)>Date.parse(intent.at)||a.source_kind!=='HUMAN_COMMAND'||a.correction_of!==null)return fail();
  const audit={projectId:a.project_id,serverSequence:Number(a.server_sequence),eventId:a.event_id,actorRef:a.actor_ref,clientRef:a.client_ref,commandId:a.command_id,operationId:a.operation_id,targetRef:a.target_ref,policyRef:a.policy_ref,approvalRef:a.approval_ref,outcome:a.outcome,reasonCode:a.reason_code,scopeDigest:a.scope_digest,recordedAt:a.recorded_at.toISOString(),sourceKind:a.source_kind,correctionOf:a.correction_of};
  const last=await read();
  for(const k of ['scope','subject','policyRef','registrationRef','publicKeySpki','approvalRequired','intentHash'] as const)if(!same(first[k],last[k]))return fail();
  const final=await getInputs(Math.max(observed.now,Date.parse(last.checkedAt)));
  if(!same(observed.value.writer,final.value.writer)||!same(observed.value.candidate,final.value.candidate)||Date.parse(intent.expiresAt)>Date.parse(last.expiresAt)||final.now>=Date.parse(intent.expiresAt))return fail();
  return{purpose:'SYNTHETIC_OWNERSHIP_PREPARATION_INTENT_STAGED_ONLY' as const,result,intentRef:cloneV1(plan.intentRef),commandRef:{id:stored.id,version:1,contentHash:plan.requestHash},authorizationReceiptRef:cloneV1(stored.authorizationReceiptRef),auditRef:{id:a.event_id,version:1,contentHash:hash(audit)},checkedAt:new Date(final.now).toISOString(),expiresAt:intent.expiresAt,missingEvidence:['VERIFIED_WRITER_NONE_OR_RECLAIM','CANDIDATE_PROVENANCE','ATOMIC_PREPARATION_EVENT_AND_SLOT_COMMIT'] as const,preparationAuthorized:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
 }catch{return fail();}
}
