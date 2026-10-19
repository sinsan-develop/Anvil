/** 새 빈 전용 PG의 C2 합성 저장 QA. 정식 DB·실제 Agent/OS/source 검증을 하지 않는다. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import pg from 'pg';
import { AccessRepository } from '../apps/server/modules/access/repository.ts';
import { hashPassword } from '../apps/server/modules/access/service.ts';
import { ProjectPolicyRepository } from '../apps/server/modules/access/project-command.ts';
import { ProjectLimitPolicies } from '../apps/server/modules/executions/runtime-policy.ts';
import { ProjectInitialExecutionQueue, type SyntheticQueueResolver } from '../apps/server/modules/executions/execution-commands.ts';
import type { ServerExecutionFactV1 } from '../contracts/runtime/server-execution-fact-v1.ts';

const mode=process.argv[2];
assert(['RED','GREEN'].includes(mode!));
const label=mode!.toLowerCase(),directory='/home/daon/deploy/anvil-v3-c2-queue-'+label+'-qa-01',database='anvil_v3_c2_queue_'+label+'_qa_01';
assert.equal(await realpath(process.cwd()),directory);
assert.equal(process.getuid?.(),1000);
assert.equal(process.env.ANVIL_C2_QA_DATABASE,database);
const host=process.env.ANVIL_C2_QA_HOST;
assert(host&&/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host));
const admin=new pg.Pool({host,port:5432,database,user:'postgres',max:1,connectionTimeoutMillis:3000,statement_timeout:10000});
const app=new pg.Pool({host,port:5432,database,user:'anvil_v3_app',max:3,connectionTimeoutMillis:3000,statement_timeout:10000});
const domain=['commands','authorization_receipts','execution_grants','execution_commands','executions','usage_reservations','writer_claims','delivery_outbox'];
const syntheticRef=()=>({id:randomUUID(),version:1,contentHash:'a'.repeat(64)});
let phase='EMPTY_DATABASE';
try {
 assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.users')).rows[0].n,0);
 const user=randomUUID(),password=randomBytes(24).toString('base64url');
 await admin.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'C2 격리 합성 사용자','ACTIVE')",[user,'qa-c2-'+user]);
 await admin.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)',[user,await hashPassword(password)]);
 const config={installationId:randomUUID(),key:randomBytes(32)},access=new AccessRepository(app,config);
 let login=await access.login('qa-c2-'+user,password,'C2 isolated','c2-queue');
 login=await access.reauthenticate(login.token,login.csrfToken,password,'c2-queue');
 async function setup(){
  const project=randomUUID(),execution=randomUUID(),ref=syntheticRef(),deadline=new Date(Date.now()+1200000).toISOString();
  await admin.query("INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,'C2 합성','단일 저장','실제 실행 아님')",[project]);
  await admin.query("INSERT INTO anvil.project_members(project_id,user_id,participation) VALUES($1,$2,'OWNER')",[project,user]);
  await admin.query('INSERT INTO anvil.project_control(project_id,actor_id,client_id,generation) VALUES($1,$2,$3,1)',[project,user,login.clientId]);
  const command=(operation:string,payload:any,expectedVersion=0)=>({schemaVersion:1 as const,projectId:project,commandId:randomUUID(),clientId:login.clientId,controlGeneration:1,operation,targetId:null,expectedVersion,baselineRefs:[],approvalRef:null,payload});
  const policyRepo=new ProjectPolicyRepository(access),limits=new ProjectLimitPolicies();
  const docRule={ruleId:'DOC',subjectRef:{kind:'HUMAN',userId:user},operations:['applyLimitPolicy'],targetScopes:[{kind:'PROJECT',projectId:project}],disposition:'AUTO',limitPolicyRef:null,expiresAt:deadline};
  const initialPolicy:any=await policyRepo.command(login.token,login.csrfToken,command('savePermissionPolicy',{rules:[docRule],reason:'격리 유한 한도',reviewRefs:[]}));
  const limitCommand=command('applyLimitPolicy',{scope:{kind:'PROJECT',projectId:project},limits:{maxAttempts:3,maxElapsedMs:7200000,maxCalls:50,maxConcurrentAssignments:1,maxSpoolBytes:1024,maxOfflineMs:0},policyBaseVersion:0,reason:'C2 합성 예약'});
  const budget:any=await policyRepo.command(login.token,login.csrfToken,limitCommand,(db,actor,policy)=>limits.apply(db,actor,limitCommand,policy));
  const scopes=[{sourceRootRef:ref,mappingRef:null,observationRef:ref,baselineRef:ref,targets:[{relativePath:'src/synthetic.ts',kind:'FILE',access:'READ',recursive:false}]}];
  const rules=[docRule,{ruleId:'RUNTIME',subjectRef:{kind:'HUMAN',userId:user},operations:['authorizeExecution','queueExecutionCommand'],targetScopes:[{kind:'EXECUTION',projectId:project,executionId:execution,executionGeneration:1,sourceScopes:scopes}],disposition:'AUTO',limitPolicyRef:budget.data.ref,expiresAt:deadline}];
  const saved:any=await policyRepo.command(login.token,login.csrfToken,{...command('savePermissionPolicy',{rules,reason:'C2 합성 실행 범위',reviewRefs:[]},1),targetId:initialPolicy.data.ref.id});
  const policyRef=saved.data.ref,intent={projectId:project,assignmentRef:ref,roleBindingRef:ref,contextBundleRef:ref,connectionRef:ref,environmentRef:ref,capabilityRef:ref,budgetPolicyRef:budget.data.ref,sourceScopes:scopes,mode:'CONTEXT_REVIEW',reason:'합성 현재성 제공자; 실제 OS/Agent 아님'};
  const provider:SyntheticQueueResolver={transport:'SYNTHETIC_ONLY',basis:async(_db,_actor,request)=>({intent:intent as any,claim:{projectId:project,executionId:execution,executionGeneration:1,commandId:request.commandId,assignmentRef:ref,stageRef:{applicationRef:ref,nodeId:'C2'},policyRef:budget.data.ref,operation:'START_SESSION',demand:{attempts:1,calls:1,spoolBytes:32,cost:null,costStatus:'VERIFIED_NO_CHARGE'}}}),current:async(db,actor,_request,basis,reservation)=>{
   const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0].at.toISOString();
   const checks:any=Object.fromEntries(['subject','session','registration','permissionPolicy','basis','context','capability','source','osFence','budget','storage','understanding'].map(name=>[name,{state:name==='understanding'?'NOT_REQUIRED':'VERIFIED_CURRENT',evidenceRefs:name==='understanding'?[]:name==='budget'?[reservation.record.ref]:name==='permissionPolicy'?[policyRef]:[ref]}]));
   return {schemaVersion:1,purpose:'SERVER_EXECUTION_CURRENTNESS',transport:'SYNTHETIC_ONLY',projectId:project,executionId:execution,executionGeneration:1,subject:{userId:user,clientId:login.clientId,humanSessionId:actor.authSession!.id,controlGeneration:1,credentialGeneration:1},agentSession:{sessionRef:ref,roleBindingRef:ref,credentialGeneration:1},registration:{ref,connectorId:ref.id,generation:1,hostPublicKeyFingerprint:'b'.repeat(64)},intent:basis.intent,preparationRef:ref,permissionPolicyRef:policyRef,budgetReservationRef:reservation.record.ref,basisRefs:[ref],latestInstructionRefs:[],understandingReviewRef:null,checks,writerState:'NONE',expires:{humanSession:deadline,permissionPolicy:deadline,registration:deadline,budget:deadline,automaticScope:deadline},checkedAt:at,executionAuthorized:false,dispatchPerformed:false} as ServerExecutionFactV1;
  }};
  const request=command('queueExecutionCommand',{preparationRef:ref,executionId:execution,executionGeneration:1,permissionPolicyRef:policyRef,budgetPolicyRef:budget.data.ref,operation:'START_SESSION',payload:{contextBundleRef:ref,optionsRef:ref}});
  return{project,request,provider,queue:new ProjectInitialExecutionQueue(access,provider)};
 }
 async function queueCounts(project:string){const counts:any={};for(const table of domain){const where=table==='authorization_receipts'?"scope_kind='PROJECT' AND scope_id=$1":'project_id=$1';const suffix=table==='commands'?" AND operation='queueExecutionCommand'":table==='authorization_receipts'?" AND command_id IN(SELECT id FROM anvil.commands WHERE operation='queueExecutionCommand')":'';counts[table]=(await admin.query('SELECT count(*)::int n FROM anvil.'+table+' WHERE '+where+suffix,[project])).rows[0].n;}return counts;}
 phase='INITIAL_QUEUE';const first=await setup();
 if(mode==='RED'){
  await assert.rejects(first.queue.command(login.token,login.csrfToken,first.request),(error:any)=>error.code==='42501');
  assert(Object.values(await queueCounts(first.project)).every(n=>n===0));
  console.log('C2_QUEUE_RED_APP_INSERT_DENIED_ROLLBACK_ZERO');
 }else{
  const result:any=await first.queue.command(login.token,login.csrfToken,first.request);
  assert.equal(result.data.status,'SYNTHETIC_QUEUE_STORED');assert.equal(result.data.executionAuthorized,false);assert.equal(result.data.dispatchPerformed,false);
  assert(Object.values(await queueCounts(first.project)).every(n=>n===1));
  assert.deepEqual(await first.queue.command(login.token,login.csrfToken,first.request),result);
  assert(Object.values(await queueCounts(first.project)).every(n=>n===1));
  await assert.rejects(first.queue.command(login.token,login.csrfToken,{...first.request,payload:{...first.request.payload,preparationRef:syntheticRef()}}),/IDEMPOTENCY_CONFLICT/);
  console.log('C2_QUEUE_ACTUAL_COMMIT_EXACT_REPLAY_NO_SECOND_RESERVATION');
  phase='ROLLBACK_GRAPH';
  for(const fault of ['FAIL_OUTBOX','OMIT_OUTBOX','ALTER_ENVELOPE','ALTER_RESERVATION','ALTER_WRITER','ALTER_SESSION']){
   const f=await setup();
   // 변경된 SQL을 실제 PG에 보내는 시험 port. 제품/제공자의 성공 값을 가짜 DB로 대체하지 않는다.
   const intercepted:any={connect:async()=>{const db=await app.connect();return{release:()=>db.release(),query:async(sql:string,params?:any[])=>{
    if(sql.startsWith('INSERT INTO anvil.delivery_outbox')){if(fault==='FAIL_OUTBOX')throw Error('QA_STORAGE_FAILURE');if(fault==='OMIT_OUTBOX')return{rows:[],rowCount:0};}
    const p=params&&structuredClone(params);
    if(p&&sql.startsWith('INSERT INTO anvil.execution_commands')&&fault==='ALTER_ENVELOPE'){const s=JSON.parse(p[9]);s.envelope.context.executionGeneration=2;p[9]=JSON.stringify(s);}
    if(p&&sql.startsWith('INSERT INTO anvil.usage_reservations')&&fault==='ALTER_RESERVATION'){const s=JSON.parse(p[6]);s.claim.demand.calls=51;p[6]=JSON.stringify(s);}
    if(p&&sql.startsWith('INSERT INTO anvil.writer_claims')&&fault==='ALTER_WRITER')p[6]=JSON.stringify([]);
    if(p&&sql.startsWith('INSERT INTO anvil.execution_grants')&&fault==='ALTER_SESSION'){const s=JSON.parse(p[6]);s.binding.subject.humanSessionId=randomUUID();p[6]=JSON.stringify(s);}
    return db.query(sql,p);
   }};}};
   const faulty=new ProjectInitialExecutionQueue(new AccessRepository(intercepted,config),f.provider);
   await assert.rejects(faulty.command(login.token,login.csrfToken,f.request),(error:any)=>fault==='FAIL_OUTBOX'?error.message==='QA_STORAGE_FAILURE':error.code==='42501');
   assert(Object.values(await queueCounts(f.project)).every(n=>n===0),fault);
  }
  console.log('C2_QUEUE_SIX_ACTUAL_FAILURES_ROLLBACK_ZERO');
  phase='DIRECT_MUTATION';
  for(const table of ['executions','execution_grants','execution_commands','writer_claims','usage_reservations']){
   await assert.rejects(app.query('INSERT INTO anvil.'+table+' DEFAULT VALUES'),(error:any)=>error.code==='42501');
   for(const op of ['UPDATE anvil.'+table+' SET project_id=project_id WHERE false','DELETE FROM anvil.'+table+' WHERE false'])await assert.rejects(app.query(op),(error:any)=>error.code==='42501');
  }
  assert.equal((await admin.query("SELECT count(*)::int n FROM anvil.delivery_outbox WHERE state<>'HELD_SYNTHETIC_ONLY'")).rows[0].n,0);
  console.log('C2_QUEUE_APP_DIRECT_MUTATIONS_DENIED_SYNTHETIC_HELD_ONLY');
 }
 console.log('C2_QUEUE_WORKFLOW_'+mode+'_LIMITED_VERIFIED');
}catch(error:any){console.error('C2_QUEUE_QA_FAILURE phase='+phase+' code='+(error.code??error.constructor?.name)+' message='+String(error.message).replace(/[^A-Za-z0-9_ .:-]/g,'').slice(0,180));process.exitCode=1;}
finally{await app.end();await admin.end();}
