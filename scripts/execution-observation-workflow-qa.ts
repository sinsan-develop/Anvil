/** 새 빈 C3 전용 PG만 사용한다. 실제 credential·Agent·HTTP·기존 개발 DB를 변경하지 않는다. */
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import pg from 'pg';
import { canonicalJson, contentHash } from '../contracts/canonical.ts';
import { AccessRepository } from '../apps/server/modules/access/repository.ts';
import { hashPassword } from '../apps/server/modules/access/service.ts';
import { ProjectPolicyRepository } from '../apps/server/modules/access/project-command.ts';
import { ProjectLimitPolicies } from '../apps/server/modules/executions/runtime-policy.ts';
import { ProjectInitialExecutionQueue, type SyntheticQueueResolver } from '../apps/server/modules/executions/execution-commands.ts';
import { SyntheticPgChallengeStore } from '../apps/server/modules/executions/execution-challenge-store.ts';
import { SyntheticExecutionChallenges } from '../apps/server/modules/executions/execution-challenges.ts';
import { executionChallengeRequestBytes, executionProofBytes } from '../apps/server/modules/executions/execution-proof.ts';
import { publicKeyFingerprint } from '../apps/server/modules/connections/registration-proof.ts';

import {SyntheticPgObservationStore} from '../apps/server/modules/executions/execution-observation-store.ts';
import {SyntheticExecutionObservations} from '../apps/server/modules/executions/execution-observations.ts';

const mode=process.argv[2];assert(['RED','GREEN'].includes(mode!));
const label=mode!.toLowerCase(),database='anvil_v3_c3_observations_'+label+'_qa_01';
assert.equal(await realpath(process.cwd()),'/home/daon/deploy/anvil-v3-c3-observations-'+label.replaceAll('_','-')+'-qa-01');assert.equal(process.getuid?.(),1000);
assert.equal(process.env.ANVIL_C3_QA_DATABASE,database);const host=process.env.ANVIL_C3_QA_HOST;assert(host&&/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host));
const config={host,port:5432,database,connectionTimeoutMillis:3000,statement_timeout:10000};
const admin=new pg.Pool({...config,user:'postgres',max:1}),pool=new pg.Pool({...config,user:'anvil_v3_app',max:4});let phase='EMPTY';
try{
 assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.users')).rows[0].n,0);
 const role=(await pool.query('SELECT current_user role,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];assert.equal(role.role,'anvil_v3_app');assert.equal(role.rolsuper,false);assert.equal(role.rolbypassrls,false);
 const user=randomUUID(),password=randomBytes(24).toString('base64url'),key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=key.publicKey.export({format:'der',type:'spki'}).toString('base64url'),fp=publicKeyFingerprint(spki);
 await admin.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'C3 격리 합성 사용자','ACTIVE')",[user,'qa-c3-'+user]);
 await admin.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)',[user,await hashPassword(password)]);
 const access=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)});let login=await access.login('qa-c3-'+user,password,'C3 isolated','c3-challenge');login=await access.reauthenticate(login.token,login.csrfToken,password,'c3-challenge');
 async function setup(){
  const pid=randomUUID(),eid=randomUUID(),connectorId=randomUUID(),ref={id:randomUUID(),version:1,contentHash:'a'.repeat(64)},deadline=new Date(Date.now()+1200000).toISOString();
  await admin.query("INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,'C3 합성','nonce 원자 소비','실제 실행 아님')",[pid]);
  await admin.query("INSERT INTO anvil.project_members(project_id,user_id,participation) VALUES($1,$2,'OWNER')",[pid,user]);await admin.query('INSERT INTO anvil.project_control(project_id,actor_id,client_id,generation) VALUES($1,$2,$3,1)',[pid,user,login.clientId]);
  const command=(operation:string,payload:any,version=0,targetId:string|null=null)=>({schemaVersion:1 as const,projectId:pid,commandId:randomUUID(),clientId:login.clientId,controlGeneration:1,operation,targetId,expectedVersion:version,baselineRefs:[],approvalRef:null,payload});
  const policies=new ProjectPolicyRepository(access),limits=new ProjectLimitPolicies(),docRule={ruleId:'DOC',subjectRef:{kind:'HUMAN',userId:user},operations:['applyLimitPolicy'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:deadline};
  const initial:any=await policies.command(login.token,login.csrfToken,command('savePermissionPolicy',{rules:[docRule],reason:'격리 한도',reviewRefs:[]}));
  const limit=command('applyLimitPolicy',{scope:{kind:'PROJECT',projectId:pid},limits:{maxAttempts:3,maxElapsedMs:7200000,maxCalls:50,maxConcurrentAssignments:1,maxSpoolBytes:1024,maxOfflineMs:0},policyBaseVersion:0,reason:'C3 합성'});
  const budget:any=await policies.command(login.token,login.csrfToken,limit,(db,actor,policy)=>limits.apply(db,actor,limit,policy));
  const scopes=[{sourceRootRef:ref,mappingRef:null,observationRef:ref,baselineRef:ref,targets:[{relativePath:'src/synthetic.ts',kind:'FILE',access:'READ',recursive:false}]}];
  const runtime={ruleId:'C3',subjectRef:{kind:'HUMAN',userId:user},operations:['authorizeExecution','queueExecutionCommand'],targetScopes:[{kind:'EXECUTION',projectId:pid,executionId:eid,executionGeneration:1,sourceScopes:scopes}],disposition:'AUTO',limitPolicyRef:budget.data.ref,expiresAt:deadline};
  const policy:any=await policies.command(login.token,login.csrfToken,command('savePermissionPolicy',{rules:[docRule,runtime],reason:'합성 challenge 선행',reviewRefs:[]},1,initial.data.ref.id));
  const intent:any={projectId:pid,assignmentRef:ref,roleBindingRef:ref,contextBundleRef:ref,connectionRef:ref,environmentRef:ref,capabilityRef:ref,budgetPolicyRef:budget.data.ref,sourceScopes:scopes,mode:'CONTEXT_REVIEW',reason:'P1 합성 source/OS 근거'};
  const provider:SyntheticQueueResolver={transport:'SYNTHETIC_ONLY',basis:async(_db,_actor,request)=>({intent,claim:{projectId:pid,executionId:eid,executionGeneration:1,commandId:request.commandId,assignmentRef:ref,stageRef:{applicationRef:ref,nodeId:'C3'},policyRef:budget.data.ref,operation:'START_SESSION',demand:{attempts:1,calls:1,spoolBytes:32,cost:null,costStatus:'VERIFIED_NO_CHARGE'}}}),current:async(db,actor,_request,basis,reservation)=>{
   const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0].at.toISOString();
   const checks:any=Object.fromEntries(['subject','session','registration','permissionPolicy','basis','context','capability','source','osFence','budget','storage','understanding'].map(name=>[name,{state:name==='understanding'?'NOT_REQUIRED':'VERIFIED_CURRENT',evidenceRefs:name==='understanding'?[]:name==='budget'?[reservation.record.ref]:name==='permissionPolicy'?[policy.data.ref]:[ref]}]));
   return{schemaVersion:1,purpose:'SERVER_EXECUTION_CURRENTNESS',transport:'SYNTHETIC_ONLY',projectId:pid,executionId:eid,executionGeneration:1,subject:{userId:user,clientId:login.clientId,humanSessionId:actor.authSession!.id,controlGeneration:1,credentialGeneration:1},agentSession:{sessionRef:ref,roleBindingRef:ref,credentialGeneration:1},registration:{ref,connectorId,generation:1,hostPublicKeyFingerprint:fp},intent:basis.intent,preparationRef:ref,permissionPolicyRef:policy.data.ref,budgetReservationRef:reservation.record.ref,basisRefs:[ref],latestInstructionRefs:[],understandingReviewRef:null,checks,writerState:'NONE',expires:{humanSession:deadline,permissionPolicy:deadline,registration:deadline,budget:deadline,automaticScope:deadline},checkedAt:at,executionAuthorized:false,dispatchPerformed:false};
  }};
  const queued:any=await new ProjectInitialExecutionQueue(access,provider).command(login.token,login.csrfToken,command('queueExecutionCommand',{preparationRef:ref,executionId:eid,executionGeneration:1,permissionPolicyRef:policy.data.ref,budgetPolicyRef:budget.data.ref,operation:'START_SESSION',payload:{contextBundleRef:ref,optionsRef:ref}}));
  const scope={mode:'EXECUTION' as const,projectId:pid,connectorId,executionId:eid,executionGeneration:1,grantRef:queued.data.snapshot.grantRef,credentialGeneration:1};
  const keys={transport:'SYNTHETIC_ONLY' as const,key:async()=>spki},store=new SyntheticPgChallengeStore(pool,keys),service=new SyntheticExecutionChallenges(store),base='/api/v1/connectors/'+connectorId+'/executions/'+eid;
  const request=(purpose='EXECUTION_REQUEST')=>({requestId:randomUUID(),purpose,grantRef:scope.grantRef,credentialGeneration:1,target:{method:'POST',path:base+(purpose==='CREDENTIAL_EXCHANGE'?'/credential-exchange':'/observations'),queryHash:'c'.repeat(64),bodyHash:'d'.repeat(64)},clientNonce:randomBytes(32).toString('base64url'),issuedAt:new Date().toISOString()});
  const issue=(p=request(),s=service)=>s.issue(scope,p,sign('sha256',executionChallengeRequestBytes('EXECUTION',p),{key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url'));
  const consume=(issued:any,p:any,s=service)=>{const c=issued.challenge,exchange=p.purpose==='CREDENTIAL_EXCHANGE',value=exchange?{requestId:p.requestId,grantRef:scope.grantRef,credentialGeneration:1,scopeDigest:c.scopeDigest,serverNonce:c.serverNonce,clientNonce:p.clientNonce,expiresAt:c.expiresAt}:{requestId:p.requestId,...p.target,grantRef:scope.grantRef,credentialGeneration:1,serverNonce:c.serverNonce};const kind=exchange?'EXECUTION_CREDENTIAL_EXCHANGE':'EXECUTION_REQUEST_PROOF';return s.consume(scope,issued.ref,value,sign('sha256',executionProofBytes(kind,value),{key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url'));};
  return{pid,scope,keys,service,request,issue,consume};
 }

 const counts=async(pid:string)=>{const out:number[]=[];for(const table of ['execution_observations','execution_acknowledgements'])out.push((await admin.query('SELECT count(*)::int n FROM anvil.'+table+' WHERE project_id=$1',[pid])).rows[0].n);return out;};
 const event=(sequence:number)=>({projectId:'',executionId:'',executionGeneration:1,sequence,eventId:randomUUID(),type:'UNKNOWN',commandId:randomUUID(),envelopeHash:'b'.repeat(64),localRecordRef:{id:randomUUID(),version:1,contentHash:'c'.repeat(64)},processRef:null,occurredAt:new Date().toISOString(),reasonCode:'PROVIDER_RESPONSE_LOST'});
 const prepare=async()=>{const f=await setup();await f.issue(f.request());const makeEvent=(n:number)=>({...event(n),projectId:f.pid,executionId:f.scope.executionId});return{...f,makeEvent,observations:new SyntheticExecutionObservations(new SyntheticPgObservationStore(pool,f.keys))};};
 const batch=(events:any[])=>({events,batchHash:contentHash(canonicalJson(events))});
 phase='OBSERVATIONS_FIRST';const f=await prepare(),one=f.makeEvent(1),three=f.makeEvent(3);
 if(mode==='RED'){await assert.rejects(admin.query('SELECT 1 FROM anvil.execution_observations'),(e:any)=>e.code==='42P01');await assert.rejects(f.observations.ingest(f.scope,batch([one,three])),(e:any)=>e.message==='OBSERVATION_STORAGE_UNAVAILABLE');console.log('C3_OBSERVATIONS_RED_MISSING_RELATION_42P01_STORAGE_REJECTED');}
 else{
  const first=await f.observations.ingest(f.scope,batch([one,three]));assert.equal(first.snapshot.highestContiguous,1);assert.deepEqual(first.snapshot.gaps,[{from:2,to:2}]);
  const second=await f.observations.ingest(f.scope,batch([f.makeEvent(2)]));assert.equal(second.snapshot.highestContiguous,3);assert.deepEqual(second.snapshot.gaps,[]);assert.deepEqual(await counts(f.pid),[3,2]);
  assert.deepEqual(await f.observations.ingest(f.scope,batch([one,three])),second);assert.deepEqual(await counts(f.pid),[3,2]);
  const four=f.makeEvent(4),concurrent=await Promise.all([f.observations.ingest(f.scope,batch([four])),f.observations.ingest(f.scope,batch([four]))]);assert.deepEqual(concurrent[0],concurrent[1]);assert.deepEqual(await counts(f.pid),[4,3]);
  console.log('C3_OBSERVATIONS_ACTUAL_GAP_CONTIGUOUS_ACK_REPLAY_CONCURRENT_ONCE');
  phase='FAILED_OBSERVATION_ACK';
  for(const fault of ['FAIL_ACK','OMIT_ACK','ALTER_ACK_REHASH','OMIT_EVENT','CONTROL_AFTER_ACK']){
   const fresh=await prepare();
   const intercepted:any={connect:async()=>{const db=await pool.connect();return{release:()=>db.release(),query:async(sql:string,params?:any[])=>{
    const args=params&&structuredClone(params);
    if(sql.startsWith('INSERT INTO anvil.execution_observations')&&fault==='OMIT_EVENT')return{rows:[],rowCount:0};
    if(sql.startsWith('INSERT INTO anvil.execution_acknowledgements')){
     if(fault==='FAIL_ACK')throw Error('QA_ACK_FAILURE');if(fault==='OMIT_ACK')return{rows:[],rowCount:0};
     if(fault==='ALTER_ACK_REHASH'&&args){const s=JSON.parse(args[8]);s.highestContiguous=9999;args[7]=contentHash(canonicalJson(s));args[8]=JSON.stringify(s);}
     const result=await db.query(sql,args);if(fault==='CONTROL_AFTER_ACK')await db.query('UPDATE anvil.project_control SET revoked_at=clock_timestamp() WHERE project_id=$1',[fresh.pid]);return result;
    }return db.query(sql,args);
   }};}};
   await assert.rejects(new SyntheticExecutionObservations(new SyntheticPgObservationStore(intercepted,fresh.keys)).ingest(fresh.scope,batch([fresh.makeEvent(1)])));
   assert.deepEqual(await counts(fresh.pid),[0,0]);
  }
  console.log('C3_OBSERVATIONS_FIVE_ACTUAL_FAILURES_ROLLBACK_NO_ORPHAN');
  phase='APP_GUARDS';for(const table of ['execution_observations','execution_acknowledgements']){
   await assert.rejects(pool.query('INSERT INTO anvil.'+table+' DEFAULT VALUES'),(e:any)=>e.code==='42501');
   for(const sql of ['UPDATE anvil.'+table+' SET project_id=project_id WHERE false','DELETE FROM anvil.'+table+' WHERE false'])await assert.rejects(pool.query(sql),(e:any)=>e.code==='42501');
  }
  assert.equal((await admin.query("SELECT count(*)::int n FROM anvil.execution_acknowledgements WHERE snapshot_json->'writerReleaseVerified'<>'false'::jsonb OR snapshot_json->'executionAuthorized'<>'false'::jsonb OR snapshot_json->'dispatchPerformed'<>'false'::jsonb")).rows[0].n,0);
  console.log('C3_OBSERVATIONS_APP_SIX_MUTATIONS_DENIED_AUTHORITY_FALSE');
 }
 console.log('C3_OBSERVATIONS_WORKFLOW_'+mode+'_LIMITED_VERIFIED');
}catch(e:any){console.error('C3_OBSERVATIONS_QA_FAILURE phase='+phase+' code='+(e.code??e.constructor?.name)+' message='+String(e.message).replace(/[^A-Za-z0-9_ .:-]/g,'').slice(0,180));process.exitCode=1;}
finally{await pool.end();await admin.end();}
