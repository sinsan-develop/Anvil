import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../access/repository.ts';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {verifiedBundle,currentAccess} from './control-request-read.ts';
import type {ControlRequestSnapshot} from './control-request-snapshot.ts';
import {createControlHandoffEvidenceSource,HandoffBudget,type HandoffClock,type ControlHandoffEvidenceSource,type HandoffEvidenceScope} from './control-handoff-evidence-source.ts';
import {issueProtectedHandoffSummary,readProtectedHandoffSummary,type ProtectedHandoffSummary} from './control-handoff-protected-summary.ts';
import {copyControlData,controlHash,sameControl,createControlAcceptanceChain,verifyControlAcceptanceChain,readCurrentControlGrant,readControlAcceptanceHistory,type ControlAcceptCommand,type ControlBasis} from './control-grant.ts';
import {planControlStorage,settleControlStorage,type ControlStorageRow,controlStorageTables} from './control-handoff-storage.ts';
export const controlAcceptanceMigration='0073_control_handoff_acceptance';
// 0073 완성 후 그 실제 bytes checksum으로 고정한다. 미작성 상태는 실제 연결 불가다.
export const controlAcceptanceChecksum='UNWRITTEN_SOURCE';
export class ControlAcceptanceFailure extends AuthFailure{readonly code:string;readonly commandId:string|null;constructor(code:string,status=503,commandId:string|null=null){super(code,status);this.code=code;this.commandId=commandId;}}
const fail=(code='CONTROL_ACCEPTANCE_INVALID',status=503,id:string|null=null):never=>{throw new ControlAcceptanceFailure(code,status,id);};
export type ControlPrepareCommand={schemaVersion:1;operation:'prepareControlHandoff';commandId:string;projectId:string;clientId:string;payload:{requestRef:RuntimeRefV1}};
type Command=ControlPrepareCommand|ControlAcceptCommand;
export function readControlAcceptanceCommand(value:unknown,operation:'acceptControl'|'prepareControlHandoff'):Command{
 const v=copyControlData(value,2*1024*1024);if(!recordV1(v,['schemaVersion','operation','commandId','projectId','clientId','payload'])||v.schemaVersion!==1||v.operation!==operation||!uuidV1(v.commandId)||!uuidV1(v.projectId)||!uuidV1(v.clientId)||!recordV1(v.payload,operation==='acceptControl'?['requestRef','summaryVersion','reason']:['requestRef'])||!refV1(v.payload.requestRef)||v.payload.requestRef.version!==1)return fail('CONTROL_ACCEPTANCE_INPUT_INVALID',400);
 if(operation==='acceptControl'&&(!Number.isSafeInteger(v.payload.summaryVersion)||v.payload.summaryVersion<1||typeof v.payload.reason!=='string'||!v.payload.reason.trim()||v.payload.reason.length>20000||inspectArtifact(Buffer.from(canonicalJson(v.payload))).state==='SUSPECTED'))return fail('CONTROL_ACCEPTANCE_INPUT_INVALID',400);
 return v as unknown as Command;
}
interface Options{pool:Pick<Pool,'connect'>;access:Pick<AccessRepository,'authenticateInTransaction'>;evidence?:ControlHandoffEvidenceSource;clock?:HandoffClock;allocate?:()=>string}
interface Context{db:PoolClient;actor:AuthenticatedIdentity;lease:HandoffBudget;observe:()=>Promise<ReturnType<typeof currentAccess>>;markWrite:()=>void}
const sameIdentity=(a:AuthenticatedIdentity,b:AuthenticatedIdentity)=>a.actorId===b.actorId&&a.clientId===b.clientId&&a.credentialGeneration===b.credentialGeneration&&a.authSession?.id===b.authSession?.id;
export class ControlAcceptanceService{
 readonly #options:Options;readonly #evidence:ControlHandoffEvidenceSource;readonly #authenticate:AccessRepository['authenticateInTransaction'];
 constructor(options:Options){this.#options={...options};this.#authenticate=options.access.authenticateInTransaction;this.#evidence=options.evidence??createControlHandoffEvidenceSource();}
 forSession(token:string,csrf:string,projectId:string){
  if(!uuidV1(projectId))fail('CONTROL_ACCEPTANCE_INPUT_INVALID',400);
  return Object.freeze({prepare:(value:unknown)=>this.#prepare(token,csrf,projectId,value),accept:(value:unknown)=>this.#accept(token,csrf,projectId,value),readHead:(requestRef:RuntimeRefV1)=>this.#readHead(token,csrf,projectId,requestRef),readSummary:(requestRef:RuntimeRefV1,summaryRef:RuntimeRefV1)=>this.#readSummary(token,csrf,projectId,requestRef,summaryRef),readResult:(commandId:string,commandHash:string)=>this.#readResult(token,csrf,projectId,commandId,commandHash)});
 }
 async #run<T>(token:string,csrf:string,pid:string,id:string|null,work:(ctx:Context)=>Promise<T>):Promise<T>{
  const lease=new HandoffBudget(30000,this.#options.clock);let raw:PoolClient|undefined,started=false,commitStarted=false,committed=false,writes=false,discard=false;
  const owned=(async()=>{try{
   await lease.own(()=>this.#options.pool.connect().then(client=>{raw=client;return client;}));lease.check();if(!raw)fail();const underlying=raw!,facade={query:(...args:unknown[])=>lease.own(()=>Reflect.apply(underlying.query,underlying,args))}as unknown as PoolClient;
   await facade.query('BEGIN');started=true;
   const schema=(await facade.query('SELECT id,checksum FROM anvil.schema_migrations WHERE id=$1',[controlAcceptanceMigration])).rows;
   if(schema.length!==1||schema[0].id!==controlAcceptanceMigration||schema[0].checksum!==controlAcceptanceChecksum)fail('CONTROL_ACCEPTANCE_NOT_CONNECTED');
   const authenticate=async()=>{if(this.#options.access.authenticateInTransaction!==this.#authenticate)fail();const actor=await this.#authenticate.call(this.#options.access,facade,token,csrf);lease.check();if(!actor.authSession)return fail('AUTH_REQUIRED',401);lease.narrow(actor.authSession.idleExpiresAt);lease.narrow(actor.authSession.absoluteExpiresAt);return actor;};
   const actor=await authenticate();
   const observe=async()=>{
    const fresh=await authenticate();if(!sameIdentity(actor,fresh))fail('AUTH_REQUIRED',401);
    const p=(await facade.query('SELECT id,archived_at FROM anvil.projects WHERE id=$1 FOR UPDATE',[pid])).rows,m=(await facade.query('SELECT project_id,user_id,participation,revoked_at FROM anvil.project_members WHERE project_id=$1 AND user_id=$2 FOR UPDATE',[pid,actor.actorId])).rows,c=(await facade.query('SELECT project_id,actor_id,client_id,generation,version,revoked_at FROM anvil.project_control WHERE project_id=$1 FOR UPDATE',[pid])).rows,at=(await facade.query('SELECT clock_timestamp() AS at')).rows[0]?.at;
    if(!(at instanceof Date)||!Number.isFinite(at.getTime())||p.length!==1||m.length!==1||c.length>1)fail('CONTROL_ACCEPTANCE_ACCESS_DENIED',403);const now=at.toISOString();lease.observe(now);
    return currentAccess({project:{id:p[0].id,archivedAt:p[0].archived_at===null?null:p[0].archived_at.toISOString()},access:{projectId:pid,now,identity:{actorId:actor.actorId,clientId:actor.clientId,credentialGeneration:actor.credentialGeneration,currentCredentialGeneration:fresh.credentialGeneration,sessionRevokedAt:null,idleExpiresAt:fresh.authSession!.idleExpiresAt,absoluteExpiresAt:fresh.authSession!.absoluteExpiresAt,userActive:true,userRevokedAt:null,clientUserId:actor.actorId,clientRevokedAt:null,reauthUntil:fresh.reauthUntil?.toISOString()??null},member:{projectId:m[0].project_id,userId:m[0].user_id,participation:m[0].participation,revokedAt:m[0].revoked_at===null?null:m[0].revoked_at.toISOString()},control:c.length?{projectId:pid,actorId:c[0].actor_id,clientId:c[0].client_id,generation:Number(c[0].generation),version:Number(c[0].version),revokedAt:c[0].revoked_at===null?null:c[0].revoked_at.toISOString()}:null}},pid);
   };
   await observe();const result=await work({db:facade,actor,lease,observe,markWrite:()=>{writes=true;}});await observe();lease.check();commitStarted=true;await facade.query('COMMIT');committed=true;return result;
  }catch(error){
   await lease.close();let rollbackConfirmed=!started;if(raw&&started&&!committed){try{await raw.query('ROLLBACK');rollbackConfirmed=true;}catch{rollbackConfirmed=false;}}
   discard=commitStarted&&!committed||!rollbackConfirmed;if(commitStarted||writes&&!rollbackConfirmed)fail('CONTROL_ACCEPTANCE_OUTCOME_UNKNOWN',503,id);
   if(error instanceof AuthFailure)throw error;return fail('CONTROL_ACCEPTANCE_STORAGE_FAILED',503,id);
  }finally{await lease.close();raw?.release(discard?new Error('FN15_TRANSACTION_UNSETTLED'):undefined);}})();
  try{return await lease.boundary(owned,true);}catch(error){if(error instanceof AuthFailure&&error.message==='HANDOFF_TIME_LIMIT')return fail(writes||commitStarted?'CONTROL_ACCEPTANCE_OUTCOME_UNKNOWN':'CONTROL_ACCEPTANCE_TIME_LIMIT',503,id);throw error;}
 }
 async #command(ctx:Context,command:Command){
  if(command.clientId!==ctx.actor.clientId)fail('CONTROL_ACCEPTANCE_ACCESS_DENIED',403,command.commandId);
  await ctx.db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[command.projectId+':'+command.commandId]);
  const rows=(await ctx.db.query('SELECT * FROM anvil.control_handoff_acceptance_commands WHERE project_id=$1 AND command_id=$2 FOR UPDATE',[command.projectId,command.commandId])).rows;
  if(rows.length>1)fail();if(!rows.length)return null;const r=rows[0];if(r.actor_id!==ctx.actor.actorId||r.client_id!==ctx.actor.clientId||r.command_hash!==controlHash(command)||!sameControl(r.command_json,command)||r.result_hash!==controlHash(r.result_json))fail('CONTROL_ACCEPTANCE_COMMAND_CONFLICT',409,command.commandId);return r.result_json as unknown;
 }
 async #request(ctx:Context,pid:string,ref:RuntimeRefV1){
  const rows=(await ctx.db.query('SELECT anvil.fn15_handoff_request_bundle($1,$2,$3,$4,$5::jsonb) AS bundle',[ctx.actor.authSession!.id,ctx.actor.actorId,ctx.actor.clientId,pid,canonicalJson(ref)])).rows;if(rows.length!==1)fail('CONTROL_ACCEPTANCE_NOT_FOUND',404);return verifiedBundle(rows[0].bundle,ref,pid);
 }
 #target(ctx:Context,request:ControlRequestSnapshot){if(request.targetActorRef.userId!==ctx.actor.actorId||request.targetClientRef.userId!==ctx.actor.actorId||request.targetClientRef.clientId!==ctx.actor.clientId)fail('CONTROL_ACCEPTANCE_ACCESS_DENIED',403);}
 async #controller(ctx:Context,request:ControlRequestSnapshot,historical=false){const at=await ctx.observe();if(!at.basis||!historical&&!sameControl(at.basis,request.baseControl)||at.basis.actorId!==ctx.actor.actorId||at.basis.clientId!==ctx.actor.clientId)return fail('CONTROL_ACCEPTANCE_ACCESS_DENIED',403);if(at.member.participation==='HANDOFF_ELIGIBLE')await readCurrentControlGrant(ctx.db,request.projectId,{...at.basis,revoked_at:null});return at;}
 #fresh(ctx:Context,request:ControlRequestSnapshot){ctx.lease.narrow(request.expiresAt);if(!ctx.actor.reauthUntil)return fail('CONTROL_ACCEPTANCE_ACCESS_DENIED',403);ctx.lease.narrow(ctx.actor.reauthUntil.toISOString());}
 #scope(ctx:Context,request:ControlRequestSnapshot,requestRef:RuntimeRefV1):HandoffEvidenceScope{return{projectId:request.projectId,requestRef,baseControl:request.baseControl,sessionId:ctx.actor.authSession!.id,actorId:ctx.actor.actorId,clientId:ctx.actor.clientId};}
 #ids(){const allocate=this.#options.allocate??randomUUID;return{acceptance:allocate(),revocation:allocate(),grant:allocate(),receipt:allocate(),audit:allocate()};}
 async #persist(ctx:Context,command:Command,rows:ControlStorageRow[]){
  const plan=planControlStorage({id:command.commandId,version:1,contentHash:controlHash(command)},rows,{projectId:command.projectId,createdAt:new Date(ctx.lease.at()).toISOString(),command,subject:{actorId:ctx.actor.actorId,clientId:ctx.actor.clientId,sessionId:ctx.actor.authSession!.id,credentialGeneration:ctx.actor.credentialGeneration}});ctx.markWrite();
  const reserved=(await ctx.db.query('SELECT * FROM anvil.fn15_control_storage_reserve($1,$2,$3,$4,$5,$6,$7::jsonb)',[ctx.actor.authSession!.id,ctx.actor.actorId,ctx.actor.clientId,command.projectId,plan.planHash,plan.reservedBytes,canonicalJson(plan)])).rows;
  if(reserved.length!==1||reserved[0].plan_hash!==plan.planHash||Number(reserved[0].reserved_bytes)!==plan.reservedBytes)fail();
  for(const row of rows){if(!controlStorageTables.includes(row.table)||!row.projection||typeof row.projection!=='object')fail();const projection=row.projection as Record<string,unknown>,columns=Object.keys(projection);if(columns.some(c=>!/^[a-z_]+$/.test(c)))fail();const values=columns.map(c=>c.endsWith('_json')||c.endsWith('_ref')?canonicalJson(projection[c]):projection[c]);const result=await ctx.db.query(`INSERT INTO anvil.${row.table}(${columns.join(',')}) VALUES(${columns.map((c,i)=>'$'+(i+1)+(c.endsWith('_json')||c.endsWith('_ref')?'::jsonb':'')).join(',')})`,values);if(result.rowCount!==1)fail();}
  const actual=(await ctx.db.query('SELECT anvil.fn15_control_storage_actual($1,$2) AS rows_json',[command.projectId,command.commandId])).rows;if(actual.length!==1||!Array.isArray(actual[0].rows_json))fail();const amount=settleControlStorage(plan,copyControlData(actual[0].rows_json));
  const settled=(await ctx.db.query('SELECT * FROM anvil.fn15_control_storage_settle($1,$2,$3)',[command.projectId,command.commandId,amount])).rows;if(settled.length!==1||Number(settled[0].settled_bytes)!==amount)fail();
 }
 #commandRow(ctx:Context,command:Command,result:unknown,at:string){return{project_id:command.projectId,command_id:command.commandId,operation:command.operation,actor_id:ctx.actor.actorId,client_id:ctx.actor.clientId,session_id:ctx.actor.authSession!.id,credential_generation:ctx.actor.credentialGeneration,reauth_until:ctx.actor.reauthUntil?.toISOString()??null,command_hash:controlHash(command),command_json:command,result_hash:controlHash(result),result_json:result,created_at:at};}
 async #prepare(token:string,csrf:string,pid:string,value:unknown):Promise<ProtectedHandoffSummary>{
  const command=readControlAcceptanceCommand(value,'prepareControlHandoff')as ControlPrepareCommand;if(command.projectId!==pid)fail('CONTROL_ACCEPTANCE_INPUT_INVALID',400);
  return this.#run(token,csrf,pid,command.commandId,async ctx=>{
   const prior=await this.#command(ctx,command),request=await this.#request(ctx,pid,command.payload.requestRef);await this.#controller(ctx,request.snapshot);if(prior)return readProtectedHandoffSummary(prior);
   this.#fresh(ctx,request.snapshot);const scope=this.#scope(ctx,request.snapshot,request.requestRef),evidence=await this.#evidence.collect(ctx.db,scope,ctx.lease);await this.#controller(ctx,request.snapshot);
   const latest=(await ctx.db.query('SELECT version FROM anvil.control_handoff_protected_summaries WHERE project_id=$1 AND request_id=$2 ORDER BY version DESC LIMIT 1 FOR UPDATE',[pid,request.requestRef.id])).rows,version=latest.length?Number(latest[0].version)+1:1,at=new Date(ctx.lease.at()).toISOString();
   const summary=issueProtectedHandoffSummary({scope,request:request.snapshot,version,observedAt:at,evidence},ctx.db,ctx.lease),ids=this.#ids(),commandRef={id:command.commandId,version:1,contentHash:controlHash(command)};
   const receipt={schemaVersion:1,purpose:'CONTROL_PROTECTED_SUMMARY_RECEIPT',id:ids.receipt,projectId:pid,commandRef,summaryRef:summary.ref,recordedAt:at},receiptRef={id:ids.receipt,version:1,contentHash:controlHash(receipt)},audit={schemaVersion:1,purpose:'CONTROL_PROTECTED_SUMMARY_AUDIT',id:ids.audit,projectId:pid,commandRef,receiptRef,recordedAt:at};
   await this.#persist(ctx,command,[{table:'control_handoff_protected_summaries',id:summary.ref.id,projection:{project_id:pid,request_id:summary.ref.id,version,content_hash:summary.ref.contentHash,body_json:summary.snapshot,source_command_id:command.commandId,observed_at:at,valid_until:summary.snapshot.validUntil}},{table:'control_handoff_acceptance_commands',id:command.commandId,projection:this.#commandRow(ctx,command,summary,at)},{table:'control_handoff_acceptance_receipts',id:ids.receipt,projection:{project_id:pid,id:ids.receipt,command_id:command.commandId,content_hash:receiptRef.contentHash,body_json:receipt}},{table:'control_handoff_acceptance_audits',id:ids.audit,projection:{project_id:pid,id:ids.audit,command_id:command.commandId,content_hash:controlHash(audit),body_json:audit}}]);await this.#controller(ctx,request.snapshot);return summary;
  });
 }
 async #accept(token:string,csrf:string,pid:string,value:unknown){
  const command=readControlAcceptanceCommand(value,'acceptControl')as ControlAcceptCommand;if(command.projectId!==pid)fail('CONTROL_ACCEPTANCE_INPUT_INVALID',400);
  return this.#run(token,csrf,pid,command.commandId,async ctx=>{
   const prior=await this.#command(ctx,command),request=await this.#request(ctx,pid,command.payload.requestRef);this.#target(ctx,request.snapshot);
   if(prior){const chain=await readControlAcceptanceHistory(ctx.db,pid,command.commandId);if(!sameControl(chain.command,command)||!sameControl(chain.result,prior))fail();return chain.result;}
   this.#fresh(ctx,request.snapshot);const before=await ctx.observe();if(!sameControl(before.basis,request.snapshot.baseControl))fail('CONTROL_ACCEPTANCE_COMMAND_CONFLICT',409,command.commandId);
   const stored=await this.#summary(ctx,pid,request.requestRef,{id:request.requestRef.id,version:command.payload.summaryVersion,contentHash:''},false);ctx.lease.narrow(stored.snapshot.validUntil);if(stored.snapshot.transferState!=='READY')fail('CONTROL_HANDOFF_NOT_READY',412,command.commandId);
   const scope=this.#scope(ctx,request.snapshot,request.requestRef),evidence=await this.#evidence.collect(ctx.db,scope,ctx.lease);if(evidence.transferState!=='READY'||handoffWatermark(stored.snapshot.collections)!==handoffWatermark(evidence.collections))fail('CONTROL_HANDOFF_NOT_READY',412,command.commandId);
   const fresh=await ctx.observe();if(!sameControl(fresh.basis,request.snapshot.baseControl))fail('CONTROL_ACCEPTANCE_COMMAND_CONFLICT',409,command.commandId);
   const at=new Date(ctx.lease.at()).toISOString(),chain=createControlAcceptanceChain({projectId:pid,command,requestRef:request.requestRef,summaryRef:stored.ref,before:request.snapshot.baseControl,targetActorId:ctx.actor.actorId,recordedAt:at,ids:this.#ids()}),a=chain.acceptance.snapshot;
   const event=(w:typeof chain.grant|typeof chain.revocation):ControlStorageRow=>({table:'control_grant_events',id:w.ref.id,projection:{project_id:pid,id:w.ref.id,kind:w.snapshot.kind,acceptance_id:chain.acceptance.ref.id,acceptance_hash:chain.acceptance.ref.contentHash,basis_generation:w.snapshot.basis.generation,content_hash:w.ref.contentHash,snapshot_json:w.snapshot}});
   const rows:ControlStorageRow[]=[{table:'control_handoffs',id:chain.acceptance.ref.id,projection:{project_id:pid,id:chain.acceptance.ref.id,command_id:command.commandId,request_id:request.requestRef.id,request_hash:request.requestRef.contentHash,summary_version:stored.ref.version,summary_hash:stored.ref.contentHash,previous_generation:a.previousControl.generation,next_generation:a.nextControl.generation,content_hash:chain.acceptance.ref.contentHash,snapshot_json:a,bundle_json:chain,accepted_at:at}},event(chain.revocation),event(chain.grant),{table:'control_handoff_acceptance_commands',id:command.commandId,projection:this.#commandRow(ctx,command,chain.result,at)},{table:'control_handoff_acceptance_receipts',id:chain.receipt.ref.id,projection:{project_id:pid,id:chain.receipt.ref.id,command_id:command.commandId,content_hash:chain.receipt.ref.contentHash,body_json:chain.receipt.snapshot}},{table:'control_handoff_acceptance_audits',id:chain.audit.ref.id,projection:{project_id:pid,id:chain.audit.ref.id,command_id:command.commandId,content_hash:chain.audit.ref.contentHash,body_json:chain.audit.snapshot}}];
   await this.#persist(ctx,command,rows);ctx.markWrite();const next=a.nextControl,b=a.previousControl,result=await ctx.db.query('UPDATE anvil.project_control SET actor_id=$2,client_id=$3,generation=$4,version=$5,issued_at=$6,revoked_at=NULL WHERE project_id=$1 AND actor_id=$7 AND client_id=$8 AND generation=$9 AND version=$10 AND revoked_at IS NULL',[pid,next.actorId,next.clientId,next.generation,next.version,at,b.actorId,b.clientId,b.generation,b.version]);if(result.rowCount!==1)fail('CONTROL_ACCEPTANCE_COMMAND_CONFLICT',409,command.commandId);
   const after=await ctx.observe();if(!sameControl(after.basis,next))fail();await readCurrentControlGrant(ctx.db,pid,{...next,revoked_at:null});return chain.result;
  });
 }
 async #summary(ctx:Context,pid:string,requestRef:RuntimeRefV1,summaryRef:RuntimeRefV1,exact=true){
  const rows=(await ctx.db.query(exact?'SELECT version,content_hash,body_json FROM anvil.control_handoff_protected_summaries WHERE project_id=$1 AND request_id=$2 AND version=$3 AND content_hash=$4':'SELECT version,content_hash,body_json FROM anvil.control_handoff_protected_summaries WHERE project_id=$1 AND request_id=$2 ORDER BY version DESC LIMIT 1 FOR UPDATE',exact?[pid,requestRef.id,summaryRef.version,summaryRef.contentHash]:[pid,requestRef.id])).rows;
  if(rows.length!==1)fail('CONTROL_ACCEPTANCE_NOT_FOUND',404);if(Number(rows[0].version)!==summaryRef.version)fail('CONTROL_ACCEPTANCE_COMMAND_CONFLICT',409);
  const value=readProtectedHandoffSummary({ref:{id:requestRef.id,version:Number(rows[0].version),contentHash:rows[0].content_hash},snapshot:rows[0].body_json});if(!sameControl(value.snapshot.requestRef,requestRef))fail();return value;
 }
 async #readSummary(token:string,csrf:string,pid:string,requestRef:RuntimeRefV1,summaryRef:RuntimeRefV1){return this.#run(token,csrf,pid,null,async ctx=>{const request=await this.#request(ctx,pid,requestRef);if(request.snapshot.targetActorRef.userId!==ctx.actor.actorId||request.snapshot.targetClientRef.clientId!==ctx.actor.clientId)await this.#controller(ctx,request.snapshot,true);return this.#summary(ctx,pid,requestRef,summaryRef);});}
 async #readHead(token:string,csrf:string,pid:string,requestRef:RuntimeRefV1){
  if(!refV1(requestRef)||requestRef.version!==1)fail('CONTROL_ACCEPTANCE_INPUT_INVALID',400);
  return this.#run(token,csrf,pid,null,async ctx=>{
   const request=await this.#request(ctx,pid,requestRef);if(request.snapshot.targetActorRef.userId!==ctx.actor.actorId||request.snapshot.targetClientRef.clientId!==ctx.actor.clientId)await this.#controller(ctx,request.snapshot,true);else this.#target(ctx,request.snapshot);
   const current=await ctx.observe(),result=(state:'NONE'|'UNKNOWN'|'AVAILABLE',summaryRef:RuntimeRefV1|null,observedAt:string)=>({schemaVersion:2 as const,purpose:'CONTROL_HANDOFF_PROTECTED_HEAD' as const,projectId:pid,requestRef,observedAt,head:{state,summaryRef},executionAuthorized:false as const,dispatchPerformed:false as const,controlTransferred:false as const});
   if(!sameControl(current.basis,request.snapshot.baseControl)||Date.parse(request.snapshot.expiresAt)<=ctx.lease.at())return result('UNKNOWN',null,new Date(ctx.lease.at()).toISOString());
   ctx.lease.narrow(request.snapshot.expiresAt);
   const rows=(await ctx.db.query('SELECT * FROM anvil.control_handoff_protected_summaries WHERE project_id=$1 AND request_id=$2 ORDER BY version DESC LIMIT 1',[pid,requestRef.id])).rows;
   if(rows.length>1)fail();const stored=rows.length?readProtectedHandoffSummary({ref:{id:requestRef.id,version:Number(rows[0].version),contentHash:rows[0].content_hash},snapshot:rows[0].body_json}):null;
   if(stored&&(!sameControl(stored.snapshot.requestRef,requestRef)||stored.snapshot.projectId!==pid))fail();
   const after=await ctx.observe();if(!sameControl(after.basis,request.snapshot.baseControl))return result('UNKNOWN',null,new Date(ctx.lease.at()).toISOString());
   return result(stored?'AVAILABLE':'NONE',stored?.ref??null,new Date(ctx.lease.at()).toISOString());
  });
 }
 async #readResult(token:string,csrf:string,pid:string,commandId:string,commandHash:string){if(!uuidV1(commandId)||!/^[0-9a-f]{64}$/.test(commandHash))fail('CONTROL_ACCEPTANCE_INPUT_INVALID',400);return this.#run(token,csrf,pid,commandId,async ctx=>{const rows=(await ctx.db.query('SELECT * FROM anvil.control_handoff_acceptance_commands WHERE project_id=$1 AND command_id=$2',[pid,commandId])).rows;if(rows.length!==1||rows[0].actor_id!==ctx.actor.actorId||rows[0].client_id!==ctx.actor.clientId||rows[0].command_hash!==commandHash||rows[0].result_hash!==controlHash(rows[0].result_json))fail('CONTROL_ACCEPTANCE_NOT_FOUND',404);const chain=await readControlAcceptanceHistory(ctx.db,pid,commandId);if(!sameControl(chain.command,rows[0].command_json)||!sameControl(chain.result,rows[0].result_json)||controlHash(chain.command)!==commandHash)fail();return chain.result;});}
}
function handoffWatermark(collections:ProtectedHandoffSummary['snapshot']['collections']){return controlHash(Object.entries(collections).map(([key,c])=>({key,scopeHash:c.coverage.scopeHash,watermarkHash:c.coverage.watermarkHash,refs:c.items.map(i=>i.ref)})));}
