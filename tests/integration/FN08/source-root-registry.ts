import {randomBytes,randomUUID} from 'node:crypto';import {Pool,type PoolConfig} from 'pg';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';import {hashPassword} from '../../../apps/server/modules/access/service.ts';import {buildApp} from '../../../apps/server/app.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
export async function runSourceRootRegistryQa(appConfig:PoolConfig,migratorConfig:PoolConfig){
 if(appConfig.host!=='127.0.0.1'||appConfig.port!==5547||appConfig.database!=='anvil_v3_a2r_registry_qa'||appConfig.user!=='anvil_v3_app'||migratorConfig.database!==appConfig.database||migratorConfig.port!==appConfig.port||migratorConfig.user!=='anvil_v3_migrator')throw Error('QA_TARGET_INVALID');
 const pool=new Pool(appConfig),admin=new Pool(migratorConfig),installationId=randomUUID(),key=randomBytes(32),access=new AccessRepository(pool,{installationId,key}),app=buildApp({},undefined,{repository:access,origin:'https://localhost:3830'}),users=[randomUUID(),randomUUID(),randomUUID()],projects=[randomUUID(),randomUUID()],cases:string[]=[];let faultApp:ReturnType<typeof buildApp>|null=null;
 const must=(v:unknown,code:string)=>{if(!v)throw Error(code);};
 let observedFailure='';app.addHook('onError',async(_request,_reply,e)=>{const v=e as any;observedFailure=/^[A-Z][A-Z0-9_]{0,63}$/.test(v.message??'')?v.message:/^[0-9A-Z]{5}$/.test(v.code??'')?'SQL_'+v.code:'INTERNAL_FAILURE';});
 try{
  const password=randomBytes(32).toString('base64url'),phc=await hashPassword(password);
  for(const id of users){await admin.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'소스 등록 격리 QA','ACTIVE')",[id,'qa-a2r-'+id]);await admin.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)',[id,phc]);}
  let own=await access.login('qa-a2r-'+users[0],password,'A2R owner','qa-a2r-'+users[0]);const viewer=await access.login('qa-a2r-'+users[1],password,'A2R viewer','qa-a2r-'+users[1]),other=await access.login('qa-a2r-'+users[2],password,'A2R other','qa-a2r-'+users[2]);
  for(const[i,pid]of projects.entries()){await admin.query("INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,'소스 원본 QA','위치 선언','이력 보존')",[pid]);await admin.query("INSERT INTO anvil.project_members(project_id,user_id,participation) VALUES($1,$2,'OWNER')",[pid,i?users[2]:users[0]]);await admin.query('INSERT INTO anvil.project_control(project_id,actor_id,client_id,generation) VALUES($1,$2,$3,1)',[pid,i?users[2]:users[0],i?other.clientId:own.clientId]);}
  const pid=projects[0]!;await admin.query("INSERT INTO anvil.project_members(project_id,user_id,participation) VALUES($1,$2,'VIEWER')",[pid,users[1]]);
  const headers=(s=own)=>({host:'localhost:3830',origin:'https://localhost:3830',cookie:'__Host-anvil.sid='+s.token,'x-anvil-csrf':s.csrfToken});
  const command=(operation:string,payload:Record<string,unknown>,base:any=null)=>({schemaVersion:1,projectId:pid,commandId:randomUUID(),clientId:own.clientId,controlGeneration:1,operation,targetId:base?.id??null,expectedVersion:base?.version??0,baselineRefs:[],approvalRef:null,payload});
  const send=(c:any,s=own,api=app)=>api.inject({method:'POST',url:`/api/v1/projects/${pid}/commands`,headers:{...headers(s),'idempotency-key':c.commandId},payload:c});
  const get=(suffix:string,s=own)=>app.inject({method:'GET',url:`/api/v1/projects/${pid}/source-roots${suffix}`,headers:headers(s)});
  const check=async(response:ReturnType<typeof send>|ReturnType<typeof get>,status:number,code:string)=>{const r=await response;must(r.statusCode===status,code+'_HTTP_'+r.statusCode+(observedFailure?'_'+observedFailure:''));return r.json();};
  const declaration={hostLabel:'소유 PC',displayName:'원 소스 😀',pathHint:'C:\\작업\\"원본"\\😀',reason:'선언 이유\r\n원본 보존',connectorId:null},payload={declaration,baseRef:null,reason:'최초 선언'};
  own=await access.reauthenticate(own.token,own.csrfToken,password,'qa-a2r-'+users[0]);
  const noPolicy=await check(send(command('saveSourceRoot',payload)),412,'NO_POLICY');must(noPolicy.code==='PERMISSION_POLICY_UNCONFIGURED','NO_POLICY_CODE');cases.push('unconfigured-policy-denied');
  const expiry=new Date(Date.now()+3600000).toISOString();let policyRef:any=null;
  async function policy(disposition:'AUTO'|'DENY'|'REQUIRE_APPROVAL'){
   const c=command('savePermissionPolicy',{rules:[{ruleId:'SOURCE_ROOT',subjectRef:{kind:'HUMAN',userId:users[0]},operations:['saveSourceRoot','reviseSourceRoot','revokeSourceRoot'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition,limitPolicyRef:null,expiresAt:expiry}],reason:'격리 소스 등록 QA 정책',reviewRefs:[]},policyRef);
   policyRef=(await check(send(c),200,'POLICY_WRITE')).data.ref;
  }
  await policy('AUTO');
  // SQL 경계만 변조한다. 현재 로그인/정책/명령/감사는 실제 경로를 그대로 통과한다.
  for(const mutation of ['EXTRA_KEY','NON_STRING_REASON'] as const){
   const malformedPool={connect:async()=>{const db=await pool.connect();return{query:async(q:any,...args:any[])=>{
    if(typeof q==='string'&&q.startsWith('INSERT INTO anvil.commands(')&&args[0]?.[4]==='saveSourceRoot'){
     const values=[...args[0]],receipt=JSON.parse(values[14]);
     if(mutation==='EXTRA_KEY')receipt.data.snapshot.executionAuthorized=true;else receipt.data.snapshot.reason=123;
     values[14]=JSON.stringify(receipt);return db.query(q,values);
    }return(db.query as any)(q,...args);
   },release:()=>db.release()};}} as unknown as Pool;
   const malformedApp=buildApp({},undefined,{repository:new AccessRepository(malformedPool,{installationId,key}),origin:'https://localhost:3830'}),attempt=command('saveSourceRoot',{...payload,reason:'123'});
   const rootsBefore=(await pool.query('SELECT count(*)::int n FROM anvil.source_roots WHERE project_id=$1',[pid])).rows[0].n;
   try{await check(send(attempt,own,malformedApp),503,'SQL_SNAPSHOT_'+mutation);}
   finally{await malformedApp.close();}
   must((await pool.query('SELECT count(*)::int n FROM anvil.source_roots WHERE project_id=$1',[pid])).rows[0].n===rootsBefore,'SQL_SNAPSHOT_ROLLBACK_ROOT');
   must((await pool.query('SELECT count(*)::int n FROM anvil.commands WHERE project_id=$1 AND command_id=$2',[pid,attempt.commandId])).rows[0].n===0,'SQL_SNAPSHOT_ROLLBACK_COMMAND');
  }cases.push('sql-exact-snapshot-and-reason-type-rollback');
  const first=command('saveSourceRoot',payload),saved=await check(send(first),200,'REGISTER'),ref=saved.data.ref;must(ref.version===1&&saved.data.snapshot.authority==='USER_DECLARED'&&saved.data.snapshot.readiness==='UNVERIFIED','REGISTER_UNVERIFIED');
  must(contentHash(canonicalJson(saved.data.snapshot))===ref.contentHash,'CANONICAL_RECEIPT_HASH');const sqlHash=(await admin.query('SELECT anvil.source_root_snapshot_hash($1::jsonb,$2,$3) value',[JSON.stringify(declaration),'DECLARED',payload.reason])).rows[0].value;must(sqlHash===ref.contentHash,'SQL_CANONICAL_HASH_UNICODE');cases.push('committed-register-unicode-hash');
  const v1=await check(get(`/${ref.id}/versions/1`),200,'READ_COMMITTED_V1');must(v1.snapshot.declaration.pathHint===declaration.pathHint&&v1.rawAllowed&&v1.executionAuthorized===false,'READ_UNVERIFIED');
  const replay=await Promise.all([send(first),send(first)]);must(replay.every(r=>r.statusCode===200&&canonicalJson(r.json())===canonicalJson(saved)),'DUPLICATE_RECEIPT');must((await pool.query('SELECT count(*)::int n FROM anvil.commands WHERE project_id=$1 AND command_id=$2',[pid,first.commandId])).rows[0].n===1,'DUPLICATE_COMMAND_ROWS');
  await check(send({...first,payload:{...payload,reason:'다른 본문'}}),409,'IDEMPOTENCY_CONFLICT');cases.push('same-command-exact-once-conflict');
  const revision=command('reviseSourceRoot',{declaration:{...declaration,displayName:'개정 소스'},baseRef:ref,reason:'표시명만 개정'},ref),v2=(await check(send(revision),200,'REVISE')).data.ref;must(v2.version===2,'REVISION_VERSION');
  await check(send({...revision,commandId:randomUUID()}),409,'STALE_HEAD');await check(send(command('reviseSourceRoot',{...revision.payload,baseRef:{...v2,contentHash:'f'.repeat(64)}},v2)),409,'BASE_HASH');must((await check(get(`/${ref.id}/versions/1`),200,'READ_HISTORY')).snapshot.declaration.displayName===declaration.displayName,'V1_IMMUTABLE');cases.push('cas-old-version-and-hash-history');
  const publicView=await check(get(`/${ref.id}/versions/1`,viewer),200,'VIEWER_READ');must(publicView.rawAllowed===false&&!Object.hasOwn(publicView,'snapshot')&&!Object.hasOwn(publicView,'protectedRef')&&!JSON.stringify(publicView).includes(declaration.pathHint),'VIEWER_NO_RAW');await check(send({...first,commandId:randomUUID(),clientId:viewer.clientId},viewer),403,'VIEWER_WRITE');await check(get(`/${ref.id}/versions/1`,other),404,'OTHER_PROJECT');cases.push('viewer-and-cross-project-isolation');
  await check(send(command('saveSourceRoot',{...payload,declaration:{...declaration,connectorId:randomUUID()}})),412,'UNKNOWN_CONNECTOR');await check(send(command('saveSourceRoot',{...payload,reason:'secret=synthetic-never-store'})),412,'SECRET_PATTERN');await check(send(command('saveSourceRoot',{...payload,executionAuthorized:true})),422,'EXTRA_AUTHORITY');cases.push('connector-secret-and-extra-authority-denied');
  const before=(await pool.query('SELECT count(*)::int n FROM anvil.source_roots WHERE project_id=$1',[pid])).rows[0].n;let inject=true;
  const faultPool={connect:async()=>{const db=await pool.connect();return{query:async(q:any,...args:any[])=>{if(inject&&typeof q==='string'&&q.startsWith('INSERT INTO anvil.source_root_versions')){inject=false;throw Error('QA_INJECTED_VERSION_WRITE_FAILURE');}return(db.query as any)(q,...args);},release:()=>db.release()};}} as unknown as Pool;
  faultApp=buildApp({},undefined,{repository:new AccessRepository(faultPool,{installationId,key}),origin:'https://localhost:3830'});const failing=command('saveSourceRoot',{...payload,reason:'중간 실패 롤백'});await check(send(failing,own,faultApp),503,'MID_TRANSACTION');
  must((await pool.query('SELECT count(*)::int n FROM anvil.source_roots WHERE project_id=$1',[pid])).rows[0].n===before,'ROLLBACK_ROOT');must((await pool.query('SELECT count(*)::int n FROM anvil.commands WHERE project_id=$1 AND command_id=$2',[pid,failing.commandId])).rows[0].n===0,'ROLLBACK_COMMAND');cases.push('real-transaction-rollback-after-root-insert');
  for(const sql of ['DELETE FROM anvil.source_root_versions WHERE project_id=$1','UPDATE anvil.source_root_versions SET reason=reason WHERE project_id=$1','DELETE FROM anvil.source_roots WHERE project_id=$1','UPDATE anvil.source_roots SET head_version=head_version+1 WHERE project_id=$1']){let denied=false;try{await pool.query(sql,[pid]);}catch(e){denied=(e as any).code==='42501';}must(denied,'DIRECT_DML_NOT_DENIED');}cases.push('immutable-version-and-head-guards');
  const revoke=command('revokeSourceRoot',{baseRef:v2,reason:'등록 철회'},v2),v3=(await check(send(revoke),200,'REVOKE')).data.ref;must(v3.version===3,'REVOKED_VERSION');const revoked=await check(get(`/${ref.id}/versions/3`),200,'READ_REVOKED');must(revoked.snapshot.status==='REVOKED'&&revoked.snapshot.declaration.displayName==='개정 소스','REVOKE_KEEP_DECLARATION');await check(send(command('reviseSourceRoot',{declaration,baseRef:v3,reason:'철회 뒤 숨은 활성화'},v3)),409,'REVOKED_REVISION');must((await check(get(`/${ref.id}/versions/1`),200,'READ_V1_AFTER_REVOKE')).snapshot.status==='DECLARED','REVOKE_KEEP_HISTORY');cases.push('explicit-revoke-with-history');
  await policy('REQUIRE_APPROVAL');await check(send(command('saveSourceRoot',payload)),412,'REQUIRE_APPROVAL');await policy('DENY');await check(send(first),403,'DENY_REPLAY');await policy('AUTO');
  await admin.query('UPDATE anvil.project_control SET generation=2 WHERE project_id=$1',[pid]);await check(send(first),409,'OLD_GENERATION');await admin.query("UPDATE anvil.auth_sessions SET idle_expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",[users[0]]);await check(get(''),401,'EXPIRED_SESSION');cases.push('policy-revocation-old-generation-expiry');
  const counts=(await admin.query('SELECT (SELECT count(*)::int FROM anvil.source_roots) roots,(SELECT count(*)::int FROM anvil.source_root_versions) versions,(SELECT count(*)::int FROM anvil.audit_events WHERE outcome=\'APPLIED\') audit,(SELECT count(*)::int FROM anvil.delivery_outbox) deliveries')).rows[0];must(counts.roots===1&&counts.versions===3&&counts.deliveries===0,'QA_FINAL_COUNTS');
  return{cases,counts,transport:'FASTIFY_INJECT_ACTUAL_PG_COMMIT',actualSocketHttp:'UNVERIFIED',servedBrowser:'UNVERIFIED',executionAuthorized:false};
 }finally{if(faultApp)await faultApp.close();await app.close();await pool.end();await admin.end();}
}
