import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {currentProjectController,authorizeMaterial,projectReplay,persistProjectReceipt,type ProjectCommand} from '../access/project-command.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {exact} from './knowledge-entry.ts';
import {readKnowledgeShareRequestInput,type KnowledgeShareRequestInput} from './knowledge-share-request-input.ts';
import {lockShareProjects,shareProjectAccess,currentShareTargets,checkShareKnowledge,type KnowledgeShareTargetSnapshot} from './knowledge-share-targets.ts';
import type {ProjectKnowledge} from './knowledge.ts';
import {ProjectListCodec} from '../projects/service.ts';
export interface KnowledgeShareSnapshot {projectId:string;createdBy:string;clientId:string;controlGeneration:number;versionRefs:VersionRef[];explicitTargets:KnowledgeShareTargetSnapshot[];purpose:string;policyRef:VersionRef;recordedAt:string}
const effects={transferPerformed:false as const,sharedEventCreated:false as const,approvalConsumed:false as const,executionAuthorized:false as const};
function unavailable(ref:VersionRef){return{requestRef:ref,state:'RECORDED_ONLY' as const,currentCheck:'UNAVAILABLE' as const,reasonCode:'SOURCE_OR_TARGET_UNAVAILABLE' as const,...effects};}
function eligible(ref:VersionRef,snapshot:KnowledgeShareSnapshot){return{requestRef:ref,state:'RECORDED_ONLY' as const,recordedAt:snapshot.recordedAt,currentCheck:'METADATA_ELIGIBLE' as const,snapshot,...effects};}
function iso(value:unknown):value is string{return typeof value==='string'&&new Date(value).toISOString()===value;}
function integrity(row:any,pid:string,actor:AuthenticatedIdentity){
 try{
  const s=row.snapshot_json,c=row.command,ar=row.authorization_receipt,audit=row.audit;
  if(!exact(s,['projectId','createdBy','clientId','controlGeneration','versionRefs','explicitTargets','purpose','policyRef','recordedAt'])||s.projectId!==pid||s.createdBy!==actor.actorId||s.createdBy!==row.created_by||s.clientId!==row.client_id||s.controlGeneration!==Number(row.control_generation)||!isVersionRef(s.policyRef)||canonicalJson(s.policyRef)!==canonicalJson(row.policy_ref)||!iso(s.recordedAt)||!Array.isArray(s.explicitTargets))throw Error();
  const snapshots=s.explicitTargets as unknown as KnowledgeShareTargetSnapshot[];
  if(snapshots.some(t=>!exact(t,['kind','projectId','version'])||!Number.isSafeInteger(t.version)||t.version<1))throw Error();
  const input=readKnowledgeShareRequestInput({versionRefs:s.versionRefs,explicitTargets:snapshots.map(({kind,projectId})=>({kind,projectId})),purpose:s.purpose},pid);
  if(row.version!==1&&Number(row.version)!==1||row.state!=='RECORDED_ONLY'||contentHash(canonicalJson(s))!==row.content_hash||new Date(row.created_at).toISOString()!==s.recordedAt)throw Error();
  const ref={id:row.id,version:1,contentHash:row.content_hash};if(!isVersionRef(ref))throw Error();
  if(!exact(row.request_json,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||row.request_json.schemaVersion!==1||row.request_json.projectId!==pid||row.request_json.clientId!==s.clientId||row.request_json.controlGeneration!==s.controlGeneration||row.request_json.operation!=='requestKnowledgeShare'||row.request_json.targetId!==null||row.request_json.expectedVersion!==0||canonicalJson(row.request_json.baselineRefs)!=='[]'||row.request_json.approvalRef!==null||canonicalJson(row.request_json.payload)!==canonicalJson(input))throw Error();
  const requestHash=contentHash(canonicalJson(row.request_json));
  if(!c||c.id!==row.command_id||c.project_id!==pid||c.scope_kind!=='PROJECT'||c.scope_id!==pid||c.state!=='APPLIED'||c.operation!=='requestKnowledgeShare'||c.actor_id!==s.createdBy||c.client_id!==s.clientId||Number(c.control_generation)!==s.controlGeneration||Number(c.expected_version)!==0||c.command_id!==row.request_json.commandId||c.request_hash!==requestHash||c.approval_consumption_id!==null||c.payload_ref!==null||canonicalJson(c.policy_ref)!==canonicalJson(s.policyRef))throw Error();
  const expected=eligible(ref,s as unknown as KnowledgeShareSnapshot),result=c.result_ref;
  if(result?.status!=='APPLIED'||result.projectId!==pid||result.commandId!==c.command_id||result.targetId!==row.id||result.version!==1||canonicalJson(result.data)!==canonicalJson({ref,request:expected})||result.serverReceivedAt!==s.recordedAt)throw Error();
  const digest=contentHash(canonicalJson({projectId:pid,actorId:s.createdBy,clientId:s.clientId,controlGeneration:s.controlGeneration,requestHash,policyRef:s.policyRef,targetRef:ref}));
  if(!ar||ar.id!==c.authorization_receipt_id||ar.command_id!==c.id||ar.scope_kind!=='PROJECT'||ar.scope_id!==pid||ar.approval_decision_ref!==null||ar.scope_digest!==digest||canonicalJson(ar.policy_ref)!==canonicalJson(s.policyRef)||canonicalJson(ar.subject_ref)!==canonicalJson({kind:'HUMAN',userId:s.createdBy,clientId:s.clientId}))throw Error();
  if(!audit||audit.command_id!==c.id||audit.project_id!==pid||audit.outcome!=='APPLIED'||audit.reason_code!=='EXPLICIT_KNOWLEDGE_SHARE_METADATA_REQUEST'||audit.scope_digest!==digest||canonicalJson(audit.target_ref)!==canonicalJson(ref)||canonicalJson(audit.actor_ref)!==canonicalJson({kind:'HUMAN',userId:s.createdBy})||audit.client_ref!==s.clientId||canonicalJson(audit.policy_ref)!==canonicalJson(s.policyRef)||audit.approval_ref!==null)throw Error();
  return{ref,snapshot:s as unknown as KnowledgeShareSnapshot};
 }catch{throw new AuthFailure('KNOWLEDGE_SHARE_INTEGRITY_FAILED',503);}
}
export class ProjectKnowledgeShareRequests {
 #access:AccessRepository;#knowledge:ProjectKnowledge;
 constructor(access:AccessRepository,knowledge:ProjectKnowledge){this.#access=access;this.#knowledge=knowledge;}
 async #source(db:PoolClient,actor:AuthenticatedIdentity,pid:string){const p=await shareProjectAccess(db,actor,pid);if(!p||p.archived_at)throw new AuthFailure('NOT_FOUND',404);}
 async #session(db:PoolClient,actor:AuthenticatedIdentity,policy?:Awaited<ReturnType<typeof authorizeMaterial>>&{projectId:string}){
  const before=performance.now(),at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;
  const session=actor.authSession,until=session?Math.min(Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt)):NaN;
  if(!(at instanceof Date)||!Number.isFinite(at.getTime())||!Number.isFinite(until)||until<=at.getTime())throw new AuthFailure('AUTH_REQUIRED',401);
  let validUntil=until;
  if(policy){const rules=policy.rules.filter(r=>r.subjectRef.kind==='HUMAN'&&r.subjectRef.userId===actor.actorId&&r.operations.includes('requestKnowledgeShare')&&r.targetScopes.some(t=>t.kind==='PROJECT'&&t.projectId===policy.projectId)&&Date.parse(r.expiresAt)>at.getTime());if(!rules.length||rules.some(r=>r.disposition==='DENY'))throw new AuthFailure('PROJECT_OPERATION_DENIED',403);if(rules.some(r=>r.disposition==='REQUIRE_APPROVAL'))throw new AuthFailure('KNOWLEDGE_SHARE_APPROVAL_NOT_CONNECTED',412);validUntil=Math.min(validUntil,policy.validUntil,...rules.map(r=>Date.parse(r.expiresAt)));if(!Number.isFinite(validUntil)||validUntil<=at.getTime())throw new AuthFailure('PROJECT_OPERATION_DENIED',403);}
  return{at,deadline:before+validUntil-at.getTime()};
 }
 async #projected(db:PoolClient,actor:AuthenticatedIdentity,pid:string,row:any){
  const {ref,snapshot}=integrity(row,pid,actor);
  const targets=snapshot.explicitTargets.map(({kind,projectId})=>({kind,projectId}));
  await lockShareProjects(db,actor,pid,targets);await this.#source(db,actor,pid);
  let view:ReturnType<typeof eligible>|ReturnType<typeof unavailable>;
  try{await currentShareTargets(db,actor,targets,snapshot.explicitTargets);await checkShareKnowledge(db,actor,this.#knowledge,pid,snapshot.versionRefs,true);await currentShareTargets(db,actor,targets,snapshot.explicitTargets);view=eligible(ref,snapshot);}catch{view=unavailable(ref);}
  await this.#source(db,actor,pid);return view;
 }
 async #row(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string){
  return(await db.query(`SELECT r.*,to_jsonb(c) AS command,to_jsonb(ar) AS authorization_receipt,to_jsonb(e) AS audit FROM anvil.knowledge_share_requests r JOIN anvil.commands c ON c.project_id=r.project_id AND c.id=r.command_id JOIN anvil.authorization_receipts ar ON ar.command_id=c.id AND ar.id=c.authorization_receipt_id JOIN anvil.audit_events e ON e.command_id=c.id AND e.project_id=r.project_id AND e.outcome='APPLIED' WHERE r.project_id=$1 AND r.created_by=$2 AND r.id=$3`,[pid,actor.actorId,id])).rows;
 }
 async command(token:string,csrf:string,c:ProjectCommand){
  const input=readKnowledgeShareRequestInput(c.payload,c.projectId);
  if(c.operation!=='requestKnowledgeShare'||c.targetId!==null||c.expectedVersion!==0||!Array.isArray(c.baselineRefs)||c.baselineRefs.length)throw new AuthFailure('KNOWLEDGE_SHARE_INPUT_INVALID',422);
  let deadline=Infinity;
  const result=await this.#access.authenticated(token,csrf,async(db,actor)=>{
   // 인증된 identity의 transaction-local RLS 문맥이다. 요청 입력을 권위로 사용하지 않는다.
   await db.query("SELECT set_config('anvil.actor_id',$1,true),set_config('anvil.client_id',$2,true)",[actor.actorId,actor.clientId]);
   await lockShareProjects(db,actor,c.projectId,input.explicitTargets);
   await currentProjectController(db,actor,c);
   const policy=await authorizeMaterial(db,actor,c),boundPolicy={...policy,projectId:c.projectId};
   deadline=Math.min(deadline,(await this.#session(db,actor,boundPolicy)).deadline);
   const previous=await projectReplay(db,actor,c);
   if(previous!==undefined){const id=(previous as any)?.data?.ref?.id;if(typeof id!=='string')throw new AuthFailure('KNOWLEDGE_SHARE_INTEGRITY_FAILED',503);const rows=await this.#row(db,actor,c.projectId,id);if(rows.length!==1)throw new AuthFailure('KNOWLEDGE_SHARE_INTEGRITY_FAILED',503);const view=await this.#projected(db,actor,c.projectId,rows[0]);deadline=Math.min(deadline,(await this.#session(db,actor,boundPolicy)).deadline);return{...(previous as object),data:{ref:view.requestRef,request:view}};}
   await this.#source(db,actor,c.projectId);
   await currentShareTargets(db,actor,input.explicitTargets);
   await checkShareKnowledge(db,actor,this.#knowledge,c.projectId,input.versionRefs,true);
   // 잠금 후 모든 현재 권한·원문과 최종 DB시각을 다시 대조한다.
   await currentProjectController(db,actor,c);
   const current=await authorizeMaterial(db,actor,c);if(canonicalJson(current.ref)!==canonicalJson(policy.ref))throw new AuthFailure('KNOWLEDGE_SHARE_SOURCE_UNAVAILABLE',412);
   const targets=await currentShareTargets(db,actor,input.explicitTargets);
   await checkShareKnowledge(db,actor,this.#knowledge,c.projectId,input.versionRefs);
   const checked=await this.#session(db,actor,{...current,projectId:c.projectId});deadline=Math.min(deadline,checked.deadline);
   const recordedAt=(await db.query('SELECT transaction_timestamp() AS at')).rows[0]?.at;if(!(recordedAt instanceof Date))throw new AuthFailure('KNOWLEDGE_SHARE_INTEGRITY_FAILED',503);
   const snapshot:KnowledgeShareSnapshot={projectId:c.projectId,createdBy:actor.actorId,clientId:actor.clientId,controlGeneration:c.controlGeneration,versionRefs:input.versionRefs,explicitTargets:targets,purpose:input.purpose,policyRef:policy.ref,recordedAt:recordedAt.toISOString()},ref={id:randomUUID(),version:1,contentHash:contentHash(canonicalJson(snapshot))},view=eligible(ref,snapshot);
   const receipt=await persistProjectReceipt(db,actor,c,ref,{request:view},policy.ref,'EXPLICIT_KNOWLEDGE_SHARE_METADATA_REQUEST');
   await db.query('INSERT INTO anvil.knowledge_share_requests(project_id,id,version,state,content_hash,snapshot_json,request_json,created_by,client_id,control_generation,policy_ref,command_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[c.projectId,ref.id,1,'RECORDED_ONLY',ref.contentHash,JSON.stringify(snapshot),JSON.stringify(c),actor.actorId,actor.clientId,c.controlGeneration,JSON.stringify(policy.ref),receipt.id,recordedAt]);
   deadline=Math.min(deadline,(await this.#session(db,actor,{...current,projectId:c.projectId})).deadline);if(performance.now()>=deadline)throw new AuthFailure('AUTH_REQUIRED',401);
   return receipt.result;
  });
  if(performance.now()>=deadline)throw new AuthFailure('KNOWLEDGE_SHARE_RESULT_UNCERTAIN',503);return result;
 }
 async #protected<T>(token:string,pid:string,operation:(db:PoolClient,actor:AuthenticatedIdentity)=>Promise<T>){
  let deadline=Infinity;
  const value=await this.#access.authenticated(token,null,async(db,actor)=>{await db.query("SELECT set_config('anvil.actor_id',$1,true),set_config('anvil.client_id',$2,true)",[actor.actorId,actor.clientId]);await this.#source(db,actor,pid);deadline=Math.min(deadline,(await this.#session(db,actor)).deadline);const value=await operation(db,actor);deadline=Math.min(deadline,(await this.#session(db,actor)).deadline);return value;});
  if(performance.now()>=deadline)throw new AuthFailure('AUTH_REQUIRED',401);return value;
 }
 readProtected(token:string,pid:string,id:string,version:number,hash:string){return this.#protected(token,pid,(db,actor)=>this.read(db,actor,pid,id,version,hash));}
 listProtected(token:string,pid:string,raw:Record<string,unknown>){return this.#protected(token,pid,(db,actor)=>this.list(db,actor,pid,raw));}
 async read(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string,version:number,hash:string){
  await this.#source(db,actor,pid);await this.#session(db,actor);
  if(version!==1||!/^[a-f0-9]{64}$/.test(hash))throw new AuthFailure('NOT_FOUND',404);
  const rows=await this.#row(db,actor,pid,id);if(rows.length!==1)throw new AuthFailure('NOT_FOUND',404);const stored=integrity(rows[0],pid,actor);if(stored.ref.contentHash!==hash)throw new AuthFailure('NOT_FOUND',404);
  const view=await this.#projected(db,actor,pid,rows[0]);await this.#session(db,actor);return view;
 }
 async list(db:PoolClient,actor:AuthenticatedIdentity,pid:string,raw:Record<string,unknown>){
  await this.#source(db,actor,pid);await this.#session(db,actor);
  if(Object.keys(raw).some(k=>!['limit','cursor'].includes(k))||raw.limit!==undefined&&(typeof raw.limit!=='string'||!/^[1-9][0-9]{0,2}$/.test(raw.limit))||raw.cursor!==undefined&&(typeof raw.cursor!=='string'||!raw.cursor||raw.cursor.length>4096))throw new AuthFailure('CURSOR_OR_FILTER_INVALID',400);
  const limit=raw.limit===undefined?20:Number(raw.limit);if(limit>200)throw new AuthFailure('CURSOR_OR_FILTER_INVALID',400);
  const filter={query:'KNOWLEDGE_SHARE_REQUESTS:'+pid,archived:false,limit},codec=new ProjectListCodec(v=>this.#access.signProjectCursor('KNOWLEDGE_SHARE_REQUESTS:'+pid+':'+v));let position:{at:string;id:string}|undefined;
  try{if(raw.cursor)position=codec.read(String(raw.cursor),actor.actorId,filter);}catch{throw new AuthFailure('CURSOR_OR_FILTER_INVALID',400);}
  const rows=(await db.query(`SELECT r.*,to_jsonb(c) AS command,to_jsonb(ar) AS authorization_receipt,to_jsonb(e) AS audit,to_char(r.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') cursor_at FROM anvil.knowledge_share_requests r JOIN anvil.commands c ON c.project_id=r.project_id AND c.id=r.command_id JOIN anvil.authorization_receipts ar ON ar.command_id=c.id AND ar.id=c.authorization_receipt_id JOIN anvil.audit_events e ON e.command_id=c.id AND e.project_id=r.project_id AND e.outcome='APPLIED' WHERE r.project_id=$1 AND r.created_by=$2 AND ($3::timestamptz IS NULL OR (r.created_at,r.id)<($3::timestamptz,$4::uuid)) ORDER BY r.created_at DESC,r.id DESC LIMIT $5`,[pid,actor.actorId,position?.at??null,position?.id??null,limit+1])).rows;
  const selected=rows.slice(0,limit),items=[];for(const row of selected)items.push(await this.#projected(db,actor,pid,row));
  await this.#session(db,actor);const more=rows.length>limit,last=selected.at(-1);
  return{items,hasMore:more,nextCursor:more&&last?codec.create(actor.actorId,filter,{at:last.cursor_at,id:last.id}):null,observedAt:new Date().toISOString()};
 }
}