import type {PoolClient} from 'pg';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember,projectReplay,authorizeMaterial,persistProjectReceipt,reserveExecutionStartOriginReceiptIds} from '../access/project-command.ts';
import {ProjectAssignmentConfirmations} from '../assignments/project-assignment-confirmations.ts';
import type {ProjectListCodec} from '../projects/service.ts';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {ProjectStorageQuota} from '../projects/project-storage-quota.ts';
import {ExecutionStartOriginSources,type OriginLifetimeObservation} from './execution-start-origin-sources.ts';
import {ExecutionStartOriginStore,buildExecutionStartOrigin,executionStartOriginResult} from './execution-start-origin-store.ts';
import {copyStartOrigin,originActor,originHash,originSame,originFailure,readExecutionStartOriginCommand} from './execution-start-origin-input.ts';
import {refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
type Call={signal?:AbortSignal;expiresAt?:number};
const unknown=():never=>originFailure('EXECUTION_START_ORIGIN_OUTCOME_UNKNOWN',503);
const originalServiceMethods=[
 [AccessRepository.prototype,['authenticated']], [ExecutionStartOriginSources.prototype,['load']],
 [ExecutionStartOriginStore.prototype,['read','insert','findStage','list']],
 [ProjectAssignmentConfirmations.prototype,['read']],
 [ProjectStorageQuota.prototype,['reserveExecutionStartOrigin','settleExecutionStartOrigin']],
] as const;
const serviceMethods=originalServiceMethods.flatMap(([prototype,names])=>names.map(name=>({prototype,name,fn:Object.getOwnPropertyDescriptor(prototype,name)?.value})));
/** 원 자료의 소유권을 발급하지 않고 보호된 저장·조회의 수명만 관리한다. */
export class ProjectExecutionStartOrigins{
 readonly #access:AccessRepository;readonly #sources:ExecutionStartOriginSources;readonly #quota:ProjectStorageQuota;readonly #store=new ExecutionStartOriginStore();readonly #pending=new Map<string,object>();readonly #assignments:ProjectAssignmentConfirmations;
 constructor(access:AccessRepository,ports:ConstructorParameters<typeof ExecutionStartOriginSources>[0]){this.#access=access;this.#sources=new ExecutionStartOriginSources(ports);this.#quota=new ProjectStorageQuota(access);this.#assignments=ports.preparations.assignments as ProjectAssignmentConfirmations;}
 async #run<T>(token:string,pid:string,call:Call,work:(check:()=>void,shrink:(n:number)=>void,end:number)=>Promise<T>):Promise<T>{
  const get=(key:string)=>{const d=Object.getOwnPropertyDescriptor(call,key);if(d&&!('value'in d))originFailure('INPUT_INVALID',422);return d?.value;};
  const signal=get('signal'),wall=Date.now(),mark=performance.now(),callEnd=get('expiresAt')??wall+30000;
  if(!Number.isSafeInteger(callEnd)||!Number.isFinite(mark)||signal!==undefined&&!(signal instanceof AbortSignal))originFailure('INPUT_INVALID',422);const end=mark+(callEnd-wall);
  const key=originHash({token,pid});if(this.#pending.has(key))originFailure('EXECUTION_START_ORIGIN_BUSY',409);const owner=Object.freeze({});this.#pending.set(key,owner);
  let until=end,last=wall,lastMark=mark,closed=false,timer:ReturnType<typeof setTimeout>|undefined,remove=()=>{},reject!:()=>void,started=false;
  const cancelled=new Promise<never>((_,no)=>{reject=()=>no(new AuthFailure('EXECUTION_START_ORIGIN_OUTCOME_UNKNOWN',503));});cancelled.catch(()=>{});
  const check=()=>{const at=Date.now(),currentMark=performance.now();if(closed||signal?.aborted||!Number.isSafeInteger(at)||at<last||!Number.isFinite(currentMark)||currentMark<lastMark||currentMark>=until)unknown();last=at;lastMark=currentMark;for(const p of serviceMethods){const d=Object.getOwnPropertyDescriptor(p.prototype,p.name);if(!d||!('value'in d)||d.value!==p.fn)originFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);}if(Object.getPrototypeOf(this.#access)!==AccessRepository.prototype||Object.hasOwn(this.#sources,'load')||Object.hasOwn(this.#access,'authenticated'))originFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);};
  const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{closed=true;reject();},Math.max(0,until-performance.now()));};
  const shrink=(n:number)=>{if(!Number.isFinite(n))unknown();until=Math.min(until,n);check();arm();};
  try{if(signal){const abort=()=>{closed=true;reject();};EventTarget.prototype.addEventListener.call(signal,'abort',abort,{once:true});remove=()=>EventTarget.prototype.removeEventListener.call(signal,'abort',abort);}check();arm();started=true;
   const pending=Promise.resolve().then(()=>work(check,shrink,end));void pending.finally(()=>{if(this.#pending.get(key)===owner)this.#pending.delete(key);}).catch(()=>{});
   const result=await Promise.race([pending,cancelled]);check();return result;
  }finally{closed=true;clearTimeout(timer);remove();if(!started&&this.#pending.get(key)===owner)this.#pending.delete(key);}
 }
 #guard(db:PoolClient,actor:AuthenticatedIdentity,check:()=>void,shrink:(n:number)=>void){
  const query=db.query,identity=originActor(actor);let tx='';
  return async(observation?:OriginLifetimeObservation)=>{check();if(observation){if(!Number.isFinite(observation.startedAt)||!Number.isFinite(observation.observedAt)||!Number.isFinite(observation.until)||observation.startedAt>performance.now())unknown();shrink(observation.startedAt+observation.until-observation.observedAt);}if(db.query!==query||originActor(actor)!==identity)unknown();const mark=performance.now(),rows=(await db.query('SELECT clock_timestamp() AS at,txid_current()::text AS transaction_id')).rows;check();const row=rows.length===1?rows[0]:null;
   if(db.query!==query||originActor(actor)!==identity||!actor.authSession||!uuidV1(actor.authSession.id)||typeof row?.transaction_id!=='string'||!/^[1-9][0-9]{0,18}$/.test(row.transaction_id)||tx&&tx!==row.transaction_id||!(row?.at instanceof Date)||!Number.isFinite(row.at.getTime()))unknown();tx=row.transaction_id;const until=Math.min(Date.parse(actor.authSession!.idleExpiresAt),Date.parse(actor.authSession!.absoluteExpiresAt));if(row.at.getTime()>=until)unknown();shrink(mark+until-row.at.getTime());
  };
 }
 async #protected(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string,version:number,guard:()=>Promise<void>,shrink:(n:number)=>void){
  await this.#readPolicy(db,actor,pid,guard,shrink);const value=await this.#store.read(db,pid,id,version);await guard();const source=await this.#sources.load(db,actor,value.request,'HISTORY',guard);shrink(source.lifetime.startedAt+source.validUntil-source.lifetime.observedAt);
  const s=value.value.snapshot;if(!originSame(source.preparation.ref,s.preparationRef)||!originSame(source.assignment.ref,s.assignmentRef)||!originSame(source.binding.ref,s.roleBindingRef)||!originSame(source.binding.snapshot.sessionRef,s.sessionBindingRef)||!originSame(source.stage.ref,s.stageRequestRef)||!originSame(source.preparation.snapshot.intent.contextBundleRef,s.contextBundleRef)||!originSame(source.preparation.snapshot.options.contentHash,s.options.contentHash))unknown();await guard();return value;
 }
 async #readPolicy(db:PoolClient,actor:AuthenticatedIdentity,pid:string,guard:()=>Promise<void>,shrink:(n:number)=>void){
  const member=await projectMember(db,actor,pid,true);await guard();if(member.participation!=='OWNER')originFailure('PROJECT_READ_DENIED',403);
  const mark=performance.now(),row=(await db.query('SELECT clock_timestamp() AS at')).rows[0];if(!(row?.at instanceof Date)||!Number.isFinite(row.at.getTime()))unknown();
  const policy=await authorizeMaterial(db,actor,{schemaVersion:1,projectId:pid,commandId:pid,clientId:actor.clientId,controlGeneration:1,operation:'readExecutionStartOrigins',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{}},true);if(policy.approvalRequired)originFailure('PROJECT_OPERATION_DENIED',403);shrink(mark+policy.validUntil-row.at.getTime());await guard();return policy;
 }
 async command(token:string,csrf:string,raw:unknown,call:Call={}){
  const request=readExecutionStartOriginCommand(raw);
  return this.#run(token,request.projectId,call,async(check,shrink,end)=>{
   let owner='',fixed:unknown;
   const result=await this.#access.authenticated(token,csrf,async(db,actor)=>{owner=originActor(actor);const guard=this.#guard(db,actor,check,shrink);await guard();await projectMember(db,actor,request.projectId,true);await guard();
    const previous=await projectReplay(db,actor,request);await guard();if(previous!==undefined){const ref=previous?.data?.ref;if(!refV1(ref))unknown();const stored=await this.#protected(db,actor,request.projectId,ref.id,ref.version,guard,shrink);if(!originSame(stored.result,previous))unknown();fixed=copyStartOrigin(previous);return fixed;}
    const source=await this.#sources.load(db,actor,request,'FRESH',guard);shrink(source.lifetime.startedAt+source.validUntil-source.lifetime.observedAt);if(!refV1(request.payload.stageRequestRef))unknown();const exists=await this.#store.findStage(db,request.projectId,(request.payload.stageRequestRef as {id:string}).id);await guard();if(exists)originFailure('EXECUTION_START_ORIGIN_ALREADY_RECORDED',409);
    const ids=await reserveExecutionStartOriginReceiptIds(db,actor,request);await guard();const at=(await db.query('SELECT transaction_timestamp() AS at')).rows[0]?.at;await guard();if(!(at instanceof Date)||!Number.isFinite(at.getTime()))unknown();
    const value=buildExecutionStartOrigin(request,source,actor,at.toISOString()),data=executionStartOriginResult(value),expected={operationId:ids.operationId,commandId:request.commandId,projectId:request.projectId,status:'APPLIED',targetId:value.ref.id,version:1,data,evidenceRefs:[],warnings:[],serverReceivedAt:at.toISOString()};
    const lease=await this.#quota.reserveExecutionStartOrigin(db,actor,request,value,source.policyRef,ids,expected,Math.min(source.validUntil,source.lifetime.observedAt+end-source.lifetime.startedAt));await guard();
    const current=await this.#sources.load(db,actor,request,'FRESH',guard);shrink(current.lifetime.startedAt+current.validUntil-current.lifetime.observedAt);if(!originSame(current.policyRef,source.policyRef)||!originSame(current.preparation.ref,source.preparation.ref)||!originSame(current.stage.ref,source.stage.ref))unknown();
    const receipt=await persistProjectReceipt(db,actor,request,value.ref,data,source.policyRef,'EXPLICIT_EXECUTION_START_ORIGIN',ids);await guard();if(!originSame(receipt.result,expected))unknown();await this.#store.insert(db,value,receipt.id);await guard();await this.#quota.settleExecutionStartOrigin(db,actor,lease,receipt);await guard();fixed=copyStartOrigin(receipt.result);return fixed;
   });check();if(!originSame(fixed,result))unknown();
   return this.#access.authenticated(token,null,async(db,actor)=>{if(originActor(actor)!==owner)unknown();const guard=this.#guard(db,actor,check,shrink);await guard();const original=result as any,ref=original?.data?.ref;if(!refV1(ref))unknown();const stored=await this.#protected(db,actor,request.projectId,ref.id,ref.version,guard,shrink);if(!originSame(stored.result,result))unknown();await guard();return copyStartOrigin(result);});
  });
 }
 async read(token:string,pid:string,id:string,version:number,call:Call={}){if(!uuidV1(pid)||!uuidV1(id)||version!==1)originFailure('INPUT_INVALID',422);return this.#run(token,pid,call,async(check,shrink)=>this.#access.authenticated(token,null,async(db,actor)=>{const guard=this.#guard(db,actor,check,shrink);await guard();const stored=await this.#protected(db,actor,pid,id,version,guard,shrink);return copyStartOrigin({projectId:pid,...executionStartOriginResult(stored.value),historyVerification:'STORED_ORIGIN_VERIFIED',currentness:'NOT_RECHECKED'});}));}
 async list(token:string,pid:string,id:string,version:number,raw:unknown,codec:ProjectListCodec,call:Call={}){
  const input=copyStartOrigin(raw);if(!uuidV1(pid)||!uuidV1(id)||!Number.isSafeInteger(version)||version<1||!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>k!=='cursor')||input.cursor!==undefined&&(typeof input.cursor!=='string'||!input.cursor.length||input.cursor.length>4096))originFailure('INPUT_INVALID',400);
  return this.#run(token,pid,call,async(check,shrink)=>this.#access.authenticated(token,null,async(db,actor)=>{const guard=this.#guard(db,actor,check,shrink);await guard();const policy=await this.#readPolicy(db,actor,pid,guard,shrink);if(Object.hasOwn(this.#assignments,'read')||Object.getPrototypeOf(this.#assignments)!==ProjectAssignmentConfirmations.prototype)originFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);
   const assignment=await this.#assignments.read(db,actor,pid,id,version);await guard();if(assignment.snapshot.contentConfirmed!==true)originFailure('NOT_FOUND',404);
   const filter={query:originHash({purpose:'EXECUTION_START_ORIGIN_HISTORY_V1',projectId:pid,assignmentRef:assignment.ref,actorId:actor.actorId,clientId:actor.clientId,credentialGeneration:actor.credentialGeneration,humanSessionId:actor.authSession!.id,pageSize:20,order:'recorded_at DESC,origin_id DESC'}),archived:false,limit:20};let position:{at:string;id:string}|null=null;try{if(input.cursor)position=codec.read(input.cursor,actor.actorId,filter);}catch{originFailure('CURSOR_INVALID',400);}
   const rows=await this.#store.list(db,pid,assignment.ref,position);await guard();const items:any[]=[],accepted:typeof rows=[];
   const page=(values:typeof items,last:typeof rows[number]|undefined,count:number)=>({projectId:pid,assignmentRef:assignment.ref,items:values,nextCursor:rows.length>count&&last?codec.create(actor.actorId,filter,{at:last.cursor_at,id:last.origin_id}):null,currentness:'NOT_RECHECKED',credentialIssued:false,executionAuthorized:false,dispatchPerformed:false,writerReservationPerformed:false});
   for(const row of rows.slice(0,20)){const stored=await this.#protected(db,actor,pid,row.origin_id,Number(row.version),guard,shrink),s=stored.value.snapshot;if(!originSame(s.assignmentRef,assignment.ref))unknown();const item={ref:stored.value.ref,stageRequestRef:s.stageRequestRef,recordedAt:s.recordedAt},candidate=page([...items,item],row,accepted.length+1);if(Buffer.byteLength(canonicalJson(candidate))>2097152){if(!items.length)originFailure('PAGE_TOO_LARGE',503);break;}items.push(item);accepted.push(row);}
   const result=page(items,accepted.at(-1),accepted.length);if(Buffer.byteLength(canonicalJson(result))>2097152)originFailure('PAGE_TOO_LARGE',503);const current=await this.#readPolicy(db,actor,pid,guard,shrink);if(!originSame(current.ref,policy.ref))unknown();await guard();return copyStartOrigin(result);
  }));
 }
}
