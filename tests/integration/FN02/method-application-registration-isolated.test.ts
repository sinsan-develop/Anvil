import assert from 'node:assert/strict';
import test from 'node:test';
import {realpath} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {Pool,type PoolClient} from 'pg';
import {fn02MethodApplicationManifest,applyFn02MethodApplicationSchemaOnly} from '../../../scripts/fn02-method-application-migration.ts';
import {fenceResultQaPool} from '../FN12/result-qa-fence.ts';

// 신규 helper의 실제 DDL rollback/COMMIT·동일후보 직렬 재호출을 확인한다.
// 정식 CLI 대상/config를 위장하지 않는다. 실제 정식 CLI 실행 증거는 아니다.
test('명시0031 helper는 실제52선행에서 rollback·COMMIT과 advisory lock 재호출을 보존한다',{timeout:90000},async t=>{
 const until=Date.parse(process.env.ANVIL_FN02_QA_UNTIL??''),sha=process.env.ANVIL_FN02_QA_SHA??'',host=process.env.ANVIL_FN02_QA_HOST??'',password=process.env.ANVIL_FN02_QA_MIGRATOR??'';
 if(process.platform!=='linux'||process.getuid?.()!==1000||await realpath(process.cwd())!=='/home/daon/deploy/anvil-v3-fn02-empty-application-qa-01'
  ||!/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)||!/^[0-9a-f]{64}$/.test(password)||!Number.isFinite(until)||until<=Date.now()||until>Date.now()+600000
  ||!/^[0-9a-f]{40}$/.test(sha)||execFileSync('/usr/bin/git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==sha||process.env.ANVIL_DB_CONFIG||process.env.ANVIL_MIGRATOR_CONFIG)throw Error('FN02_EXACT_REGISTRATION_QA_REQUIRED');
 const fresh=()=>assert(!t.signal.aborted&&Date.now()<until,'FN02_QA_EXPIRED');
 const pool=fenceResultQaPool(new Pool({host,port:5432,database:'anvil_v3_fn02_empty_application_qa_01',user:'anvil_v3_migrator',password,max:3,connectionTimeoutMillis:3000,statement_timeout:5000}),fresh);
 const lock="SELECT pg_advisory_xact_lock(hashtext('anvil-v3-migrations'))",markers:string[]=[];let phase='PRECONDITION';
 try{
  assert.deepEqual((await pool.query('SELECT current_database() db,current_user role,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0],{db:'anvil_v3_fn02_empty_application_qa_01',role:'anvil_v3_migrator',rolsuper:false,rolbypassrls:false});
  const manifest=await fn02MethodApplicationManifest(),before=(await pool.query('SELECT id,checksum FROM anvil.schema_migrations')).rows;
  assert.equal(before.length,52);const sort=(rows:{id:string;checksum:string}[])=>rows.toSorted((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);assert.deepEqual(sort(before),sort([...manifest.expected].map(([id,checksum])=>({id,checksum}))));
  const guard="SELECT pg_get_functiondef('anvil.guard_initial_project_methodology()'::regprocedure) definition",oldGuard=(await pool.query(guard)).rows[0].definition;
  const column=async()=>Number((await pool.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='anvil' AND table_name='project_methodologies' AND column_name='application_command_id'")).rows[0].n);assert.equal(await column(),0);
  const emptyTables=['anvil.users','anvil.projects','anvil.methodology_definitions','anvil.methodology_versions','anvil_qa.fixtures'];for(const table of emptyTables)assert.equal((await pool.query('SELECT count(*)::int n FROM '+table)).rows[0].n,0);
  phase='ROLLBACK';const discarded=await pool.connect();try{await discarded.query('BEGIN');await discarded.query(lock);const result=await applyFn02MethodApplicationSchemaOnly(discarded);assert.equal(result.applied,true);assert.equal((await discarded.query('SELECT count(*)::int n FROM anvil.schema_migrations')).rows[0].n,53);await discarded.query('ROLLBACK');}finally{let failed=false;try{await discarded.query('ROLLBACK');}catch{failed=true;throw Error('FN02_DISCARDED_ROLLBACK_UNVERIFIED');}finally{discarded.release(failed);}}
  assert.deepEqual(sort((await pool.query('SELECT id,checksum FROM anvil.schema_migrations')).rows),sort(before));assert.equal(await column(),0);markers.push('EXPLICIT_HELPER_DDL_ROLLBACK_RESTORES_52');
  async function race(forceObservationFailure:boolean,counts:{leaderDdl:number;followerDdl:number;followerStarts:number;followerCommits:number}){
   const leader=await pool.connect();let follower:PoolClient|undefined,pending:Promise<any>|null=null,closing=false;
   const active=()=>{fresh();assert(!closing,'FN02_REGISTRATION_FOLLOWER_CANCELLED');};
   try{
    follower=await pool.connect();await leader.query('BEGIN');await follower.query('BEGIN');await leader.query(lock);
    const leaderPid=(await leader.query('SELECT pg_backend_pid() id')).rows[0].id,followerPid=(await follower.query('SELECT pg_backend_pid() id')).rows[0].id;
    const apply=async(db:typeof leader,first:boolean)=>applyFn02MethodApplicationSchemaOnly({query:async(sql:string,args?:unknown[])=>{active();if(sql===manifest.sql){if(first)counts.leaderDdl++;else counts.followerDdl++;}return db.query(sql,args);}} as any);
    const first=await apply(leader,true);assert.equal(first.applied,true);
    const followerClient=follower;pending=(async()=>{await followerClient.query(lock);active();counts.followerStarts++;const result=await apply(followerClient,false);active();await followerClient.query('COMMIT');counts.followerCommits++;return{value:result};})().catch(error=>({error}));
    const end=Date.now()+2000;let blocked=false;while(Date.now()<end){fresh();const row=(await pool.query('SELECT $2::int=ANY(pg_blocking_pids($1)) blocked,query FROM pg_stat_activity WHERE pid=$1',[followerPid,leaderPid])).rows[0];if(row?.blocked===true){assert.equal(row.query,lock);blocked=true;break;}await delay(10);}assert(blocked,'FN02_REGISTRATION_ADVISORY_WAIT_NOT_OBSERVED');
    if(forceObservationFailure)throw Error('FN02_SYNTHETIC_OBSERVATION_FAILURE');
    await leader.query('COMMIT');const second=await pending;assert.equal(second.error,undefined);assert.equal(second.value.applied,false);
   }finally{
    closing=true;
    // 먼저 종료 차단→leader 잠금 해제→후속 작업 수렴→follower rollback. 반대 순서면 TX 밖 DDL이 가능하다.
    const leaderRollback=await Promise.allSettled([leader.query('ROLLBACK')]);if(pending)await pending;
    const followerRollback=follower?await Promise.allSettled([follower.query('ROLLBACK')]):[];
    leader.release(leaderRollback[0]?.status==='rejected');follower?.release(followerRollback[0]?.status==='rejected');
    assert([...leaderRollback,...followerRollback].every(r=>r.status==='fulfilled'),'FN02_REGISTRATION_ROLLBACK_UNVERIFIED');
   }
  }
  phase='OBSERVATION_FAILURE_ABORT';const aborted={leaderDdl:0,followerDdl:0,followerStarts:0,followerCommits:0};await assert.rejects(race(true,aborted),{message:'FN02_SYNTHETIC_OBSERVATION_FAILURE'});assert.deepEqual(aborted,{leaderDdl:1,followerDdl:0,followerStarts:0,followerCommits:0});assert.equal(await column(),0);assert.deepEqual(sort((await pool.query('SELECT id,checksum FROM anvil.schema_migrations')).rows),sort(before));markers.push('ABORTED_OBSERVATION_FOLLOWER_DDL_COMMIT_ZERO');
  phase='CONCURRENT_APPLY';const committed={leaderDdl:0,followerDdl:0,followerStarts:0,followerCommits:0};await race(false,committed);assert.deepEqual(committed,{leaderDdl:1,followerDdl:0,followerStarts:1,followerCommits:1});
  markers.push('CONCURRENT_EXPLICIT_HELPER_COMMIT_SINGLE_DDL_REPLAY_NO_DDL');
  phase='READBACK';assert.equal(await column(),1);const after=(await pool.query('SELECT id,checksum FROM anvil.schema_migrations')).rows;assert.equal(after.length,53);assert.deepEqual(sort(after.filter(r=>r.id!=='0031_empty_project_methodology_application')),sort(before));assert.equal(after.find(r=>r.id==='0031_empty_project_methodology_application')?.checksum,'e9dee26a03ddd643f06ddc9dfbfe39dccfb91fc305fcc465e53a5d15fd2880c6');assert.equal((await pool.query(guard)).rows[0].definition,oldGuard);
  for(const table of emptyTables)assert.equal((await pool.query('SELECT count(*)::int n FROM '+table)).rows[0].n,0);markers.push('EXACT_53_OLD_GUARD_UNCHANGED_NO_SEED');
  console.log('FN02_APPLICATION_REGISTRATION '+JSON.stringify({status:'PASS',markers,formalCliExecuted:false,actualAgentCalls:0,formalDbChanges:0}));
 }catch(error){const code=(error as any)?.code;console.log('FN02_APPLICATION_REGISTRATION_FAILURE '+JSON.stringify({phase,code:typeof code==='string'&&/^[A-Z0-9_]{1,80}$/.test(code)?code:null}));throw error;}
 finally{await pool.end();}
});
