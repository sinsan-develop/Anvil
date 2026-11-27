import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession,DocumentWrite} from '../design-trace/editor-api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import {readCandidatePermissionPolicy} from '../connections/candidate-policy-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import {readOrigin,originRef,type OriginView} from './execution-start-origin-api.ts';

type Command=Omit<DocumentWrite,'operation'>&{operation:'queueExecutionCommand'};
export type NormalStartPhase='PREPARED'|'SENDING'|'UNKNOWN'|'REJECTED'|'STORED';
export interface NormalStartSource{projectId:string;assignmentRef:PlanRef;assignmentDraftRef:PlanRef;originRef:PlanRef;reservationRef:PlanRef;executionId:string;executionGeneration:number;preparationRef:PlanRef;contextBundleRef:PlanRef;budgetPolicyRef:PlanRef;sourceScopesHash:string;expiresAt:string}
export interface NormalStartPacket{id:string;ownerUserId:string;ownerClientId:string;source:NormalStartSource;command:Command;body:string;requestHash:string}
export interface NormalStartReceipt{ref:PlanRef;status:'NORMAL_QUEUE_STORED';executionId:string;executionGeneration:number;grantRef:PlanRef;reservationRef:PlanRef;executorRegistrationRef:PlanRef;queuedAt:string;executionAuthorized:false;dispatchPerformed:false}
export interface NormalStartBuffer{packet:NormalStartPacket;phase:NormalStartPhase;receipt:NormalStartReceipt|null;failure:{code:string;status:number}|null}
export interface NormalStartStorage{buffers:Record<string,NormalStartBuffer|null>;current:()=>boolean;read:(key:string)=>NormalStartBuffer|null;compareAndSet:(key:string,expected:NormalStartBuffer|null,next:NormalStartBuffer)=>boolean}
const exact=(v:any,keys:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(','),same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const date=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
function fail(code='NORMAL_START_RESPONSE_INVALID',status=0):never{throw new ApiError(code,status);}
async function digest(value:unknown){const bytes=new TextEncoder().encode(ordered(value));if(bytes.length>2097152)fail();return[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
function freeze<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
const owners=new WeakMap<ApiClient,{transport:typeof fetch;user:string;client:string;csrf:string;epoch:string}>();
export function normalStartOwner(client:ApiClient,session:DocumentSession){
 if(!uuid(session.user.id)||!uuid(session.clientId)||!/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken))fail('AUTH_REQUIRED',401);
 let owner=owners.get(client);
 if(!owner||owner.transport!==client.transport||owner.user!==session.user.id||owner.client!==session.clientId||owner.csrf!==session.csrfToken){owner={transport:client.transport,user:session.user.id,client:session.clientId,csrf:session.csrfToken,epoch:crypto.randomUUID()};owners.set(client,owner);}return owner.epoch;
}
export const normalStartKey=(packet:NormalStartPacket)=>ordered([packet.ownerUserId,packet.ownerClientId,packet.source.projectId,packet.source.assignmentDraftRef,packet.source.assignmentRef,packet.source.originRef,packet.source.reservationRef,packet.source.executionId,packet.source.executionGeneration]);
type State={user:string;clientId:string;phase:NormalStartPhase;busy:boolean;listeners:Set<()=>void>};
const packets=new WeakMap<NormalStartPacket,State>();
export const normalStartStatus=(packet:NormalStartPacket)=>packets.get(packet)?.phase??null;
export function subscribeNormalStart(packet:NormalStartPacket,listener:()=>void){const state=packets.get(packet);state?.listeners.add(listener);return()=>{state?.listeners.delete(listener);};}
function phase(state:State,value:NormalStartPhase){state.phase=value;for(const listener of state.listeners)listener();}

/** 이번 호출의 wall/monotonic 30초와 owner/취소를 누적한다. 전송 뒤 취소는 실패 확정이 아니다. */
function operation(client:ApiClient,session:DocumentSession,active:()=>boolean,signal?:AbortSignal){
 const transport=client.transport,epoch=normalStartOwner(client,session),csrf=session.csrfToken,user=session.user.id,cid=session.clientId;
 const controller=new AbortController();let lastWall=Date.now(),lastMono=performance.now(),wallEnd=lastWall+30000,monoEnd=lastMono+30000,closed=false,timer:ReturnType<typeof setTimeout>|undefined;
 let stop!:(error:ApiError)=>void;const cancelled=new Promise<never>((_,reject)=>{stop=reject;});cancelled.catch(()=>{});
 const cancel=()=>{controller.abort();stop(new ApiError('NORMAL_START_PAUSED'));};
 const current=()=>{const wall=Date.now(),mono=performance.now();return !closed&&!signal?.aborted&&!controller.signal.aborted&&active()&&client.transport===transport&&session.csrfToken===csrf&&session.user.id===user&&session.clientId===cid&&normalStartOwner(client,session)===epoch&&wall>=lastWall&&mono>=lastMono&&wall<wallEnd&&mono<monoEnd;};
 const check=()=>{if(!current())fail('NORMAL_START_PAUSED');lastWall=Date.now();lastMono=performance.now();};
 const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{controller.abort();stop(new ApiError('NORMAL_START_TIMEOUT',503));},Math.max(0,Math.min(wallEnd-Date.now(),monoEnd-performance.now())));};
 const limit=(until:number)=>{wallEnd=Math.min(wallEnd,until);monoEnd=Math.min(monoEnd,performance.now()+until-Date.now());check();arm();};
 signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();arm();
 const wait=async<T>(task:Promise<T>)=>{const value=await Promise.race([task,cancelled]);check();return value;};
 const response=async(url:RequestInfo|URL,init?:RequestInit,beforeSend?:()=>void)=>{
  check();beforeSend?.();const result=await wait(transport.call(globalThis,url,{...init,signal:controller.signal}));check();
  const reader=result.body?.getReader();if(!reader)fail();let bytes=0;const chunks:Uint8Array[]=[];
  const abort=()=>{void reader.cancel().catch(()=>{});};controller.signal.addEventListener('abort',abort,{once:true});
  try{for(;;){check();const part=await wait(reader.read());check();if(part.done)break;bytes+=part.value.length;if(bytes>2097152)fail('NORMAL_START_RESPONSE_TOO_LARGE',413);chunks.push(part.value);}
   const body=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}check();let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(body);}catch{return fail();}check();return new Response(text,{status:result.status,headers:result.headers});
  }finally{controller.signal.removeEventListener('abort',abort);void reader.cancel().catch(()=>{});try{reader.releaseLock();}catch{}}
 };
 return{epoch,transport,current,check,limit,wait,response,client:new ApiClient(response),close:()=>{closed=true;clearTimeout(timer);controller.abort();signal?.removeEventListener('abort',cancel);}};
}
async function control(client:ApiClient,pid:string,session:DocumentSession){
 const value=await client.get<any>(`/api/v1/projects/${pid}`),state=value?.controlState;
 if(value?.id!==pid||!state||!Number.isSafeInteger(state.generation)||state.generation<1)fail();
 if(value.participation!=='OWNER'||state.status!=='HELD'||state.actorId!==session.user.id||state.clientId!==session.clientId)fail('PROJECT_CONTROL_REQUIRED',403);
 return state.generation as number;
}
async function access(op:ReturnType<typeof operation>,session:DocumentSession,origin:OriginView){
 const s=origin.snapshot;op.limit(Math.min(Date.parse(s.expiresAt),Date.parse(origin.reservation.snapshot.expiresAt)));
 if(s.subject.userId!==session.user.id||s.subject.clientId!==session.clientId)fail('NORMAL_START_SOURCE_MISMATCH',409);
 const generation=await control(op.client,origin.projectId,session);op.check();if(generation!==s.subject.controlGeneration)fail('PROJECT_CONTROL_REQUIRED',403);
 const policy=await readCandidatePermissionPolicy(op.client,origin.projectId);op.check();if(!policy)fail('PERMISSION_POLICY_UNCONFIGURED',412);
 return{generation,policyRef:policy.ref};
}
export async function prepareNormalStart(client:ApiClient,session:DocumentSession,assignment:ConfirmedAssignmentView,selected:OriginView,active:()=>boolean,signal?:AbortSignal):Promise<NormalStartPacket|null>{
 const chosen=structuredClone(selected),a=structuredClone(assignment),op=operation(client,session,active,signal);
 try{
  op.check();if(chosen.projectId!==a.projectId||!same(chosen.snapshot.assignmentRef,a.ref)||!originRef(a.snapshot.draftRef)||await op.wait(digest(a.snapshot))!==a.ref.contentHash)fail('NORMAL_START_SOURCE_MISMATCH',409);
  const original=await readOrigin(op.client,a.projectId,chosen.ref,a.ref,op.current);op.check();if(!original||!same(original,chosen))fail('NORMAL_START_SOURCE_MISMATCH',409);
  const {generation,policyRef}=await access(op,session,original),s=original.snapshot;
  const command:Command={schemaVersion:1,projectId:a.projectId,commandId:crypto.randomUUID(),clientId:session.clientId,controlGeneration:generation,operation:'queueExecutionCommand',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{operation:'START_SESSION',executionId:s.execution.executionId,executionGeneration:s.execution.executionGeneration,preparationRef:s.preparationRef,permissionPolicyRef:policyRef,budgetPolicyRef:s.budgetPolicyRef,payload:{contextBundleRef:s.contextBundleRef,optionsRef:s.preparationRef},originParent:{originRef:original.ref,reservationRef:original.reservation.ref}}};
  const source:NormalStartSource={projectId:a.projectId,assignmentRef:a.ref,assignmentDraftRef:a.snapshot.draftRef,originRef:original.ref,reservationRef:original.reservation.ref,executionId:s.execution.executionId,executionGeneration:s.execution.executionGeneration,preparationRef:s.preparationRef,contextBundleRef:s.contextBundleRef,budgetPolicyRef:s.budgetPolicyRef,sourceScopesHash:await op.wait(digest(s.sourceScopes)),expiresAt:s.expiresAt};
  const packet=freeze({id:crypto.randomUUID(),ownerUserId:session.user.id,ownerClientId:session.clientId,source,command,body:JSON.stringify(command),requestHash:await op.wait(digest(command))});op.check();
  packets.set(packet,{user:session.user.id,clientId:session.clientId,phase:'PREPARED',busy:false,listeners:new Set()});return packet;
 }catch(error){if(!active()||signal?.aborted||client.transport!==op.transport)return null;throw error;}finally{op.close();}
}
async function receipt(value:any,packet:NormalStartPacket):Promise<NormalStartReceipt>{
 const c=packet.command,s=packet.source,d=value?.data,q=d?.snapshot;
 if(!exact(value,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt'])||!uuid(value.operationId)||value.commandId!==c.commandId||value.projectId!==c.projectId||value.status!=='APPLIED'||value.version!==1||!date(value.serverReceivedAt)||!same(value.evidenceRefs,[])||!same(value.warnings,[])||!exact(d,['ref','status','snapshot','executionAuthorized','dispatchPerformed'])||!originRef(d.ref)||d.ref.version!==1||value.targetId!==d.ref.id||d.status!=='NORMAL_QUEUE_STORED'||d.executionAuthorized!==false||d.dispatchPerformed!==false)fail();
 if(!exact(q,['transport','state','executionId','executionGeneration','grantRef','reservationRef','executorRegistrationRef','operation','payload','humanSessionId','sourceScopes','budgetPolicyRef','queuedAt','executionAuthorized','dispatchPerformed'])||q.transport!=='NORMAL_PROTECTED'||q.state!=='QUEUED'||q.executionId!==s.executionId||q.executionGeneration!==s.executionGeneration||q.operation!=='START_SESSION'||!same(q.payload,c.payload.payload)||!same(q.budgetPolicyRef,s.budgetPolicyRef)||![q.grantRef,q.reservationRef,q.executorRegistrationRef].every(originRef)||q.grantRef.version!==1||q.reservationRef.version!==1||!uuid(q.humanSessionId)||!date(q.queuedAt)||q.executionAuthorized!==false||q.dispatchPerformed!==false||await digest(q)!==d.ref.contentHash||await digest(q.sourceScopes)!==s.sourceScopesHash)fail();
 return freeze({ref:d.ref,status:'NORMAL_QUEUE_STORED',executionId:q.executionId,executionGeneration:q.executionGeneration,grantRef:q.grantRef,reservationRef:q.reservationRef,executorRegistrationRef:q.executorRegistrationRef,queuedAt:q.queuedAt,executionAuthorized:false,dispatchPerformed:false});
}
export async function sendNormalStart(client:ApiClient,session:DocumentSession,packet:NormalStartPacket,active:()=>boolean,hooks:{beforeDispatch:()=>boolean;notSent:()=>void;stored:(receipt:NormalStartReceipt)=>boolean;unknown:(failure:{code:string;status:number})=>void},signal?:AbortSignal):Promise<NormalStartReceipt|null>{
 const state=packets.get(packet);if(!state||state.user!==session.user.id||state.clientId!==session.clientId||state.busy||!['PREPARED','UNKNOWN','REJECTED'].includes(state.phase))fail('NORMAL_START_PACKET_UNAVAILABLE',409);
 const op=operation(client,session,active,signal),originalPhase=state.phase;let dispatched=false;state.busy=true;
 try{
  op.check();if(packet.body!==JSON.stringify(packet.command)||await op.wait(digest(packet.command))!==packet.requestHash)fail('NORMAL_START_PACKET_UNAVAILABLE',409);
  if(originalPhase==='PREPARED'){
   const original=await readOrigin(op.client,packet.source.projectId,packet.source.originRef,packet.source.assignmentRef,op.current);op.check();if(!original||!same(original.reservation.ref,packet.source.reservationRef))fail();
   const current=await access(op,session,original);op.check();if(current.generation!==packet.command.controlGeneration||!same(current.policyRef,packet.command.payload.permissionPolicyRef))fail('RUNTIME_POLICY_NOT_CURRENT',409);
  }else{const generation=await control(op.client,packet.source.projectId,session);op.check();if(generation!==packet.command.controlGeneration)fail('PROJECT_CONTROL_REQUIRED',403);}
  op.check();if(state.phase!==originalPhase||!hooks.beforeDispatch())return null;op.check();
  const response=await op.response(`/api/v1/projects/${packet.source.projectId}/commands`,{method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json','X-Anvil-CSRF':session.csrfToken,'Idempotency-Key':packet.command.commandId},body:packet.body},()=>{dispatched=true;phase(state,'SENDING');});op.check();
  let value:any;try{if(!/^application\/json\b/i.test(response.headers.get('content-type')??''))throw Error();value=await op.wait(response.json());}catch{return fail();}
  if(!response.ok){if(originalPhase==='PREPARED'&&response.status>=400&&response.status<500)phase(state,'REJECTED');throw new ApiError(typeof value?.code==='string'&&/^[A-Z_]{1,80}$/.test(value.code)?value.code:'REQUEST_FAILED',response.status);}
  const saved=await op.wait(receipt(value,packet));op.check();if(!hooks.stored(saved))fail('NORMAL_START_PAUSED');phase(state,'STORED');return saved;
 }catch(cause){const error=cause instanceof ApiError?cause:new ApiError('CONNECTION_LOST');if(dispatched){if(state.phase!=='REJECTED')phase(state,'UNKNOWN');hooks.unknown({code:error.code,status:error.status});}if(!active()||signal?.aborted)return null;throw error;
 }finally{if(!dispatched)hooks.notSent();state.busy=false;op.close();for(const listener of state.listeners)listener();}
}
