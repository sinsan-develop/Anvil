import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {authorizeMaterial,currentProjectController,projectMember,projectReplay,persistProjectReceipt,reserveNodeDecisionReceiptIds,type ProjectCommand} from '../access/project-command.ts';
import {ProjectDocuments} from '../documents/project-documents.ts';
import {ProjectStorageQuota} from '../projects/project-storage-quota.ts';
import type {ProjectListCodec} from '../projects/service.ts';
import {NodeDecisionSources,type NodeDecisionSelection} from './node-decision-sources.ts';
import {NodeDecisionStore,nodeDecisionFlags,type DecisionRow} from './node-decision-store.ts';
import {readNodeDecisionCommand} from './node-decision-input.ts';
import {copyControlData} from '../control-handoff/control-grant.ts';
const H=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const unknown=():never=>{throw new AuthFailure('NODE_DECISION_OUTCOME_UNKNOWN',503);};
type Call={signal?:AbortSignal;expiresAt?:number};
function identity(a:AuthenticatedIdentity){return canonicalJson({actorId:a.actorId,clientId:a.clientId,generation:a.credentialGeneration,sessionId:a.authSession?.id});}
/** 저장·후행 보호 조회는 실제 인증 트랜잭션의 확정 반환을 사이에 둔다. */
export class ProjectNodeDecisions{
 readonly #access:AccessRepository;readonly #documents:ProjectDocuments;readonly #sources:NodeDecisionSources;readonly #store=new NodeDecisionStore();readonly #quota:ProjectStorageQuota;
 constructor(access:AccessRepository,documents:ProjectDocuments){this.#access=access;this.#documents=documents;this.#sources=new NodeDecisionSources(documents);this.#quota=new ProjectStorageQuota(access);}
 async #run<T>(call:Call,work:(check:()=>void,shrink:(n:number)=>void)=>Promise<T>):Promise<T>{
  const signal=call.signal,end=call.expiresAt??Date.now()+30000;if(!Number.isSafeInteger(end)||signal!==undefined&&!(signal instanceof AbortSignal))throw new AuthFailure('INPUT_INVALID',422);
  let until=end,last=Date.now(),closed=false,timer:ReturnType<typeof setTimeout>|undefined,remove:()=>void=()=>{};
  let reject!:()=>void;const cancelled=new Promise<never>((_,no)=>{reject=()=>no(new AuthFailure('NODE_DECISION_OUTCOME_UNKNOWN',503));});cancelled.catch(()=>{});
  const check=()=>{const now=Date.now();if(closed||signal?.aborted||!Number.isSafeInteger(now)||now<last||now>=until)unknown();last=now;};
  const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{closed=true;reject();},Math.max(0,until-Date.now()));};
  const shrink=(value:number)=>{if(!Number.isFinite(value))unknown();until=Math.min(until,value);check();arm();};
  try{if(signal){const abort=()=>{closed=true;reject();};EventTarget.prototype.addEventListener.call(signal,'abort',abort,{once:true});remove=()=>EventTarget.prototype.removeEventListener.call(signal,'abort',abort);}check();arm();const result=await Promise.race([work(check,shrink),cancelled]);check();return result;}
  finally{closed=true;clearTimeout(timer);remove();}
 }
 async #guard(db:PoolClient,actor:AuthenticatedIdentity,query:PoolClient['query'],fixedIdentity:string,check:()=>void,shrink:(n:number)=>void,transaction:{value?:string}){
  check();if(db.query!==query||identity(actor)!==fixedIdentity)unknown();const row=(await db.query('SELECT clock_timestamp() AS at,txid_current()::text AS transaction_id')).rows[0];check();if(db.query!==query||identity(actor)!==fixedIdentity||!(row?.at instanceof Date)||!Number.isFinite(row.at.getTime())||!actor.authSession||!uuidV1(actor.authSession.id))unknown();
  if(typeof row.transaction_id!=='string'||!/^[1-9][0-9]{0,18}$/.test(row.transaction_id)||transaction.value!==undefined&&transaction.value!==row.transaction_id)unknown();transaction.value=row.transaction_id;
  const session=actor.authSession!;shrink(Math.min(Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt)));if(row.at.getTime()>=Math.min(Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt)))unknown();
 }
 async #readPolicy(db:PoolClient,actor:AuthenticatedIdentity,pid:string,check:()=>Promise<void>){
  const member=await projectMember(db,actor,pid,true);await check();if(member.participation!=='OWNER')throw new AuthFailure('PROJECT_READ_DENIED',403);
  const request={schemaVersion:1 as const,projectId:pid,commandId:pid,clientId:actor.clientId,controlGeneration:1,operation:'readNodeDecisions',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{}};
  const policy=await authorizeMaterial(db,actor,request,false,this.#documents);await check();return policy;
 }
 async #protected(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string,version:number,check:()=>Promise<void>,shrink:(n:number)=>void){
  shrink((await this.#readPolicy(db,actor,pid,check)).validUntil);const value=await this.#store.view(db,pid,id,version);await check();
  const b=value.basisSnapshot,s=value.snapshot;await this.#sources.read(db,actor,pid,s.nodeRef.nodeId,{applicationRef:b.applicationRef,designRef:b.designRef,planRef:b.planRef},s.sourceDocumentRefs,false,check);await check();shrink((await this.#readPolicy(db,actor,pid,check)).validUntil);return value;
 }
 async command(token:string,csrf:string,raw:ProjectCommand,call:Call={}){
  const request=copyControlData(raw,2097152) as ProjectCommand;
  if(!['recordNodeDecision','revokeNodeDecision'].includes(request.operation)||!uuidV1(request.projectId)||!uuidV1(request.commandId))throw new AuthFailure('INPUT_INVALID',422);
  const fixedCall={signal:call.signal,expiresAt:call.expiresAt??Date.now()+30000};
  return this.#run(fixedCall,async(check,shrink)=>{
   let originalIdentity='',fixedResult:unknown;
   const result=await this.#access.authenticated(token,csrf,async(db,actor)=>{
    const query=db.query,transaction:{value?:string}={};originalIdentity=identity(actor);const guard=()=>this.#guard(db,actor,query,originalIdentity,check,shrink,transaction);await guard();
    // 원 이력은 새 controller/head CAS를 소급하지 않고 현재 읽기 보호로만 반환한다.
    shrink((await this.#readPolicy(db,actor,request.projectId,guard)).validUntil);const previous=await projectReplay(db,actor,request);await guard();
    if(previous!==undefined){const ref=previous?.data?.ref;if(!refV1(ref))unknown();const view=await this.#protected(db,actor,request.projectId,ref.id,ref.version,guard,shrink);if(!same(view.snapshot,previous.data.snapshot)||!same(view.ref,ref))unknown();fixedResult=cloneV1(previous);return fixedResult;}
    await currentProjectController(db,actor,request);await guard();const policy=await authorizeMaterial(db,actor,request,false,this.#documents);shrink(policy.validUntil);await guard();
    let selection=request.payload.basisSelection as NodeDecisionSelection,sourceRefs=request.payload.sourceDocumentRefs as VersionRef[],nodeId:string,previousRef:VersionRef|null=null;
    if(request.operation==='revokeNodeDecision'){
     const ref=request.payload.decisionRef;if(!refV1(ref))throw new AuthFailure('INPUT_INVALID',422);const old=await this.#store.read(db,request.projectId,ref.id,ref.version);await guard();if(!same(old.ref,ref)||old.snapshot.status!=='ACTIVE')throw new AuthFailure('VERSION_CONFLICT',409);nodeId=old.snapshot.nodeRef.nodeId;sourceRefs=old.snapshot.sourceDocumentRefs;
    }else nodeId=(request.payload.nodeRef as any)?.nodeId;
    const source=await this.#sources.read(db,actor,request.projectId,nodeId,selection,sourceRefs,true,guard);await guard();const command=readNodeDecisionCommand(request,source.declaration) as ProjectCommand;
    const head=await this.#store.head(db,command.projectId,selection.applicationRef,nodeId);await guard();
    const expected=command.operation==='recordNodeDecision'?command.payload.decisionBaseRef:command.payload.decisionRef;
    previousRef=head?{id:head.stream_id,version:Number(head.head_version),contentHash:head.head_hash}:null;if(!same(expected,previousRef))throw new AuthFailure('VERSION_CONFLICT',409);
    const streamId=previousRef?.id??randomUUID(),version=(previousRef?.version??0)+1;if(!Number.isSafeInteger(version))throw new AuthFailure('VERSION_CONFLICT',409);
    const old=previousRef?await this.#store.read(db,command.projectId,streamId,previousRef.version):null;await guard();
    const at=(await db.query('SELECT transaction_timestamp() AS at')).rows[0]?.at;await guard();if(!(at instanceof Date)||!Number.isFinite(at.getTime()))unknown();const recordedAt=at.toISOString();
    const author={kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId,credentialGeneration:actor.credentialGeneration,controlGeneration:command.controlGeneration};
    const basisSnapshot={schemaVersion:1,purpose:'HUMAN_NODE_DECISION_BASIS',id:randomUUID(),version:1,projectId:command.projectId,...selection,planDocumentRef:source.planDocumentRef,actor:author,commandId:command.commandId,recordedAt};
    const basisRef={id:basisSnapshot.id,version:1,contentHash:H(basisSnapshot)};
    const snapshot={schemaVersion:1,purpose:'HUMAN_NODE_DECISION',projectId:command.projectId,nodeRef:{applicationRef:selection.applicationRef,nodeId},declarationHash:source.declaration.declarationHash,basisRef,decisionType:'ENUM_STRING_V1',value:command.operation==='revokeNodeDecision'?old!.snapshot.value:command.payload.value,reason:command.payload.reason,sourceDocumentRefs:sourceRefs,previousRef,status:command.operation==='revokeNodeDecision'?'REVOKED':'ACTIVE',actor:author,commandId:command.commandId,recordedAt};
    const ref={id:streamId,version,contentHash:H(snapshot)},ids=await reserveNodeDecisionReceiptIds(db,actor,command);await guard();
    const before=head?{project_id:head.project_id,stream_id:head.stream_id,application_ref:head.application_ref,node_id:head.node_id,head_version:Number(head.head_version),head_hash:head.head_hash,created_at:new Date(head.created_at).toISOString(),updated_at:new Date(head.updated_at).toISOString()}:null;
    const after={project_id:command.projectId,stream_id:streamId,application_ref:selection.applicationRef,node_id:nodeId,head_version:version,head_hash:ref.contentHash,created_at:before?.created_at??recordedAt,updated_at:recordedAt};
    const data={snapshot,basisRef,basisSnapshot,...nodeDecisionFlags},expectedResult={operationId:ids.operationId,commandId:command.commandId,projectId:command.projectId,status:'APPLIED',targetId:streamId,version,data:{ref,...data},evidenceRefs:[],warnings:[],serverReceivedAt:recordedAt};
    const lease=await this.#quota.reserveNodeDecision(db,actor,command,ref,snapshot,basisSnapshot,{before,after},policy.ref,ids,expectedResult,Math.min(policy.validUntil,Date.parse(actor.authSession!.idleExpiresAt),Date.parse(actor.authSession!.absoluteExpiresAt),fixedCall.expiresAt));await guard();
    await currentProjectController(db,actor,command);const current=await authorizeMaterial(db,actor,command,false,this.#documents);await guard();if(!same(current.ref,policy.ref))unknown();shrink(current.validUntil);
    const receipt=await persistProjectReceipt(db,actor,command,ref,data,policy.ref,'EXPLICIT_HUMAN_NODE_DECISION',ids);await guard();if(!same(receipt.result,expectedResult))unknown();
    const row:DecisionRow={project_id:command.projectId,stream_id:streamId,version,content_hash:ref.contentHash,snapshot_json:snapshot,basis_json:basisSnapshot,basis_hash:basisRef.contentHash,server_command_id:receipt.id,recorded_at:at};await this.#store.insert(db,row,previousRef);await guard();await this.#quota.settleNodeDecision(db,actor,lease,receipt);await guard();fixedResult=cloneV1(receipt.result);return fixedResult;
   });check();if(!same(result,fixedResult))unknown();
   // AccessRepository의 COMMIT tag 및 release가 확정 반환된 뒤 새 인증 Tx를 시작한다.
   const returned=await this.#access.authenticated(token,null,async(db,actor)=>{const q=db.query,transaction:{value?:string}={};if(identity(actor)!==originalIdentity)unknown();const guard=()=>this.#guard(db,actor,q,originalIdentity,check,shrink,transaction);await guard();const r=result as any,ref=r?.data?.ref;if(!refV1(ref))unknown();const view=await this.#protected(db,actor,request.projectId,ref.id,ref.version,guard,shrink);if(!same(view.snapshot,r.data.snapshot)||!same(view.basisSnapshot,r.data.basisSnapshot))unknown();await guard();return cloneV1(result);});check();return returned;
  });
 }
 async read(token:string,pid:string,id:string,version:number,call:Call={}){if(!uuidV1(pid)||!uuidV1(id)||!Number.isSafeInteger(version)||version<1)throw new AuthFailure('INPUT_INVALID',422);return this.#run(call,async(check,shrink)=>this.#access.authenticated(token,null,async(db,actor)=>{const query=db.query,owner=identity(actor),transaction:{value?:string}={},guard=()=>this.#guard(db,actor,query,owner,check,shrink,transaction);await guard();return this.#protected(db,actor,pid,id,version,guard,shrink);}));}
 async list(token:string,pid:string,input:Record<string,unknown>,codec:ProjectListCodec,call:Call={}){
  const raw=Object.freeze(copyControlData(input,8192)) as Record<string,unknown>;
  const keys=['applicationId','applicationVersion','applicationHash','nodeId','cursor','limit'];if(Object.keys(raw).some(k=>!keys.includes(k))||typeof raw.applicationVersion!=='string'||! /^[1-9][0-9]*$/.test(raw.applicationVersion)||typeof raw.nodeId!=='string'||!raw.nodeId.trim()||raw.nodeId.length>200||raw.cursor!==undefined&&typeof raw.cursor!=='string')throw new AuthFailure('INPUT_INVALID',422);
  const ref={id:raw.applicationId,version:Number(raw.applicationVersion),contentHash:raw.applicationHash};if(!refV1(ref))throw new AuthFailure('INPUT_INVALID',422);const limit=raw.limit===undefined?50:typeof raw.limit==='string'&&/^[1-9][0-9]?$/.test(raw.limit)?Number(raw.limit):0;if(limit<1||limit>50)throw new AuthFailure('INPUT_INVALID',422);
  return this.#run(call,async(check,shrink)=>this.#access.authenticated(token,null,async(db,actor)=>{
   const query=db.query,owner=identity(actor),transaction:{value?:string}={},guard=()=>this.#guard(db,actor,query,owner,check,shrink,transaction);await guard();const policy=await this.#readPolicy(db,actor,pid,guard);shrink(policy.validUntil);
   const filter={query:H({projectId:pid,applicationRef:ref,nodeId:raw.nodeId,client:actor.clientId,generation:actor.credentialGeneration,session:actor.authSession!.id}),archived:false,limit};const position=raw.cursor?codec.read(raw.cursor as string,actor.actorId,filter):null;
   const rows=(await db.query('SELECT stream_id,version,recorded_at,server_command_id FROM anvil.node_decision_versions WHERE project_id=$1 AND snapshot_json->\'nodeRef\'=$2::jsonb AND ($3::timestamptz IS NULL OR (recorded_at,server_command_id)>($3::timestamptz,$4::uuid)) ORDER BY recorded_at,server_command_id LIMIT $5',[pid,canonicalJson({applicationRef:ref,nodeId:raw.nodeId}),position?.at??null,position?.id??null,limit+1])).rows;await guard();
   const items:Awaited<ReturnType<NodeDecisionStore['view']>>[]=[],accepted:typeof rows=[];
   const pageFor=(values:typeof items,last:typeof rows[number]|undefined,count:number)=>({projectId:pid,selection:{applicationRef:ref,nodeId:raw.nodeId},items:values,nextCursor:rows.length>count&&last?codec.create(actor.actorId,filter,{at:new Date(last.recorded_at).toISOString(),id:last.server_command_id}):null});
   for(const row of rows.slice(0,limit)){const item=await this.#protected(db,actor,pid,row.stream_id,Number(row.version),guard,shrink),candidate=pageFor([...items,item],row,accepted.length+1);if(Buffer.byteLength(canonicalJson(candidate))>2097152){if(!items.length)throw new AuthFailure('NODE_DECISION_RESPONSE_LIMIT',412);break;}items.push(item);accepted.push(row);}
   const page=pageFor(items,accepted.at(-1),accepted.length);if(Buffer.byteLength(canonicalJson(page))>2097152)throw new AuthFailure('NODE_DECISION_RESPONSE_LIMIT',412);await guard();shrink((await this.#readPolicy(db,actor,pid,guard)).validUntil);return page;
  }));
 }
}
