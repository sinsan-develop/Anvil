import {randomUUID} from 'node:crypto';
import {AccessRepository,AuthFailure} from '../access/repository.ts';
import {authorizeMaterial,currentProjectController,projectReplay,type ProjectCommand} from '../access/project-command.ts';
import {copyControlData} from '../control-handoff/control-grant.ts';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {recordV1,uuidV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {createSourceContentManagementOriginStore} from './source-content-policy-management-origin-store.ts';

const authenticate=AccessRepository.prototype.authenticated;
const recheck=AccessRepository.prototype.authenticateInTransaction;
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const unavailable=()=>new AuthFailure('SOURCE_CONTENT_MANAGEMENT_NOT_CONNECTED',412);
function genuine(access:AccessRepository){
 return Object.getPrototypeOf(access)===AccessRepository.prototype&&!Object.hasOwn(access,'authenticated')&&!Object.hasOwn(access,'authenticateInTransaction')
  &&Object.getOwnPropertyDescriptor(AccessRepository.prototype,'authenticated')?.value===authenticate
  &&Object.getOwnPropertyDescriptor(AccessRepository.prototype,'authenticateInTransaction')?.value===recheck;
}
const safeFailures=new Set(['AUTH_REQUIRED','CSRF_INVALID','NOT_FOUND','PROJECT_ARCHIVED','PROJECT_WRITE_DENIED','PROJECT_CONTROL_REQUIRED','CONTROL_GENERATION_CONFLICT','PERMISSION_POLICY_UNCONFIGURED','PROJECT_OPERATION_DENIED','POLICY_INTEGRITY_FAILED','REAUTHENTICATION_REQUIRED','IDEMPOTENCY_CONFLICT','SOURCE_CONTENT_MANAGEMENT_INPUT_INVALID','SOURCE_CONTENT_MANAGEMENT_NOT_CONNECTED']);

/** 원 Access 거래에서만 두 목적 RPC를 소비한다. 보호 bundle은 기존 inspector 밖으로 반환하지 않는다. */
export class ProjectSourceContentPolicyManagement {
 #access:AccessRepository;
 constructor(access:AccessRepository){this.#access=access;}
 command(token:string,csrf:string,request:ProjectCommand){return this.#run(token,csrf,request,false);}
 /** 내부 소비 전용. HTTP read/목록/원문 endpoint를 만들지 않는다. */
 read(token:string,csrf:string,request:ProjectCommand){return this.#run(token,csrf,request,true);}
 async #run(token:string,csrf:string,raw:ProjectCommand,read:boolean):Promise<unknown>{
  let invoked=false,callbackCompleted=false,publishUntil=Infinity;
  try{
   if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))throw new AuthFailure('AUTH_REQUIRED');
   if(typeof csrf!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(csrf))throw new AuthFailure('CSRF_INVALID',403);
   const access=this.#access,pool=access.pool,connect=pool.connect;if(!genuine(access))throw unavailable();
   const request=copyControlData(raw,1048576),purpose=read?'readSourceContentPolicyManagementOrigin':'defineSourceContentPolicy';
   if(!recordV1(request,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||request.schemaVersion!==1||request.operation!==purpose||![request.projectId,request.clientId,request.commandId].every(uuidV1)||!Number.isSafeInteger(request.controlGeneration)||request.controlGeneration<1||request.targetId!==null||request.expectedVersion!==0||!same(request.baselineRefs,[])||request.approvalRef!==null||!recordV1(request.payload,read?['originRef','policyEventRef','managementCommandId']:['definition','previousPolicyRef','reason']))throw new AuthFailure('SOURCE_CONTENT_MANAGEMENT_INPUT_INVALID',422);
   const outcome=await authenticate.call(access,token,csrf,async(db,actor)=>{
    const query=db.query;let alive=true,xid:string|undefined,policyRef:unknown,until=Infinity,lastDbTime=-1;
    const owned=()=>{if(!alive||access.pool!==pool||pool.connect!==connect||db.query!==query||!genuine(access))throw unavailable();};
    const current=async()=>{
     owned();const identity=await recheck.call(access,db,token,csrf);owned();
     if(identity.actorId!==actor.actorId||identity.clientId!==actor.clientId||identity.credentialGeneration!==actor.credentialGeneration||!same(identity.authSession,actor.authSession))throw new AuthFailure('AUTH_REQUIRED');
     await currentProjectController(db,identity,request);owned();
     const policy=await authorizeMaterial(db,identity,request);owned();
     const result=await Reflect.apply(query,db,['SELECT clock_timestamp() AS at, pg_current_xact_id_if_assigned()::text AS transaction_id']);owned();
     const row=result.rows[0],session=identity.authSession;
     if(result.rows.length!==1||!(row?.at instanceof Date)||!Number.isSafeInteger(row.at.getTime())||typeof row.transaction_id!=='string'||!/^[1-9][0-9]{0,19}$/.test(row.transaction_id)||BigInt(row.transaction_id)>18446744073709551615n||!session||!uuidV1(session.id)||!isoV1(session.idleExpiresAt)||!isoV1(session.absoluteExpiresAt))throw unavailable();
     if(!identity.reauthUntil||!Number.isFinite(identity.reauthUntil.getTime())||identity.reauthUntil.getTime()<=row.at.getTime())throw new AuthFailure('REAUTHENTICATION_REQUIRED',412);
     if(xid!==undefined&&row.transaction_id!==xid||policyRef!==undefined&&!same(policyRef,policy.ref))throw unavailable();
     xid=row.transaction_id;policyRef=policy.ref;
     const deadline=Math.min(policy.validUntil,identity.reauthUntil.getTime(),Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt));
     if(!Number.isFinite(deadline)||deadline<until&&until!==Infinity||row.at.getTime()<lastDbTime||row.at.getTime()>=deadline)throw new AuthFailure('PROJECT_OPERATION_DENIED',403);
     until=Math.min(until,deadline);publishUntil=until;lastDbTime=row.at.getTime();
     return Object.freeze({operation:purpose,projectId:request.projectId,actorId:identity.actorId,clientId:identity.clientId,authSessionId:session.id,credentialGeneration:identity.credentialGeneration,controlGeneration:request.controlGeneration,permissionPolicyRef:policy.ref,transactionId:xid,authorizedUntil:new Date(until).toISOString()});
    };
    try{
     const context=await current();
     const previous=read?undefined:await projectReplay(db,actor,request);owned();
     const store=createSourceContentManagementOriginStore({now:Date.now,assertCurrent:async(scope)=>{const checked=await current();if(!same(checked,scope.context))throw unavailable();},invoke:async(call)=>{
      owned();invoked=true;
      // 이름/SQL/인자는 고정 두 분기이며 입력에서 일반 query/persist를 선택하지 않는다.
      const sql=call.name==='fn03_source_content_management_commit'
       ?'SELECT anvil.fn03_source_content_management_commit($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::jsonb,$6::jsonb,$7::jsonb,$8::text,$9::timestamptz) AS bundle'
       :'SELECT anvil.fn03_source_content_management_read($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::bigint,$6::jsonb,$7::jsonb,$8::text) AS bundle';
      const response=await Reflect.apply(query,db,[sql,[...call.args]]);owned();
      if(response.rows.length!==1||!recordV1(response.rows[0],['bundle']))throw unavailable();return response.rows[0].bundle;
     }});
     const result=read?await store.read(request.payload,context):previous!==undefined?await store.replay(request,context):await store.commit(request,context,{
      serverCommandId:randomUUID(),operationId:randomUUID(),authorizationReceiptId:randomUUID(),auditEventId:randomUUID(),policyEventId:randomUUID(),originId:randomUUID(),
     });
     if(!read&&(!('result'in result)||previous!==undefined&&!same(result.result,previous)))throw unavailable();
     owned();callbackCompleted=true;return read?result:('result'in result?result.result:undefined);
    }finally{alive=false;}
   });
   if(!genuine(access)||access.pool!==pool||pool.connect!==connect||Date.now()>=publishUntil)throw unavailable();
   return outcome;
  }catch(error){
   if(invoked||callbackCompleted)throw new AuthFailure('SOURCE_CONTENT_MANAGEMENT_OUTCOME_UNKNOWN',503);
   if(error instanceof AuthFailure&&safeFailures.has(error.message))throw error;
   throw new AuthFailure('SOURCE_CONTENT_MANAGEMENT_CURRENT_REQUIRED',403);
  }
 }
}
