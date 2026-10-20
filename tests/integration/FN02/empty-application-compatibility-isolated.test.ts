import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,realpath} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {hashPassword} from '../../../apps/server/modules/access/service.ts';
import {buildApp} from '../../../apps/server/app.ts';
import {buildOfficialForms} from '../../../apps/server/modules/documents/forms.ts';
import {seedOfficialForms} from '../../../apps/server/modules/documents/catalog-seed.ts';
import {buildBuiltinMethodologies} from '../../../apps/server/modules/methodologies/builtins.ts';
import {seedBuiltinMethodologies} from '../../../apps/server/modules/methodologies/catalog-seed.ts';
import {assertFn02QaManifest} from '../../../scripts/fn02-empty-application-manifest.ts';
import {fenceResultQaPool} from '../FN12/result-qa-fence.ts';

// 새 QA DB에서 기존 초기생성의 실행 호환성과 직접 INSERT의 선행 잠금만 검수한다.
// 성공한 임무/grant의 의미 있는 동시 INSERT와 적용의 양방향 경합 전체 시험은 아니다.
test('새 적용 guard 아래 초기 생성·다른 프로젝트 생성과 7원장 직접 INSERT 잠금 경계를 보존한다',{timeout:90000},async t=>{
 const until=Date.parse(process.env.ANVIL_FN02_QA_UNTIL??''),sha=process.env.ANVIL_FN02_QA_SHA??'',host=process.env.ANVIL_FN02_QA_HOST??'',password=process.env.ANVIL_FN02_QA_APP??'',migratorPassword=process.env.ANVIL_FN02_QA_MIGRATOR??'';
 if(process.platform!=='linux'||process.getuid?.()!==1000||await realpath(process.cwd())!=='/home/daon/deploy/anvil-v3-fn02-empty-application-qa-01'
  ||!/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)||!/^[0-9a-f]{64}$/.test(password)||!/^[0-9a-f]{64}$/.test(migratorPassword)
  ||!Number.isFinite(until)||until<=Date.now()||until>Date.now()+600000||!/^[0-9a-f]{40}$/.test(sha)||execFileSync('/usr/bin/git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==sha||process.env.ANVIL_DB_CONFIG||process.env.ANVIL_MIGRATOR_CONFIG)throw Error('FN02_EXACT_COMPATIBILITY_QA_REQUIRED');
 const fresh=()=>assert(!t.signal.aborted&&Date.now()<until,'FN02_QA_EXPIRED');
 const config={host,port:5432,database:'anvil_v3_fn02_empty_application_qa_01',connectionTimeoutMillis:3000,statement_timeout:5000};
 const pool=fenceResultQaPool(new Pool({...config,user:'anvil_v3_app',password,max:4}),fresh),admin=fenceResultQaPool(new Pool({...config,user:'anvil_v3_migrator',password:migratorPassword,max:2}),fresh);
 const access=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)}),app=buildApp({},undefined,{repository:access,origin:'https://localhost:3830'}),uid=randomUUID(),markers:string[]=[];
 let phase='SCHEMA';const projectIds:string[]=[];
 try{
  assert.deepEqual((await pool.query('SELECT current_database() db,current_user role,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0],{db:config.database,role:'anvil_v3_app',rolsuper:false,rolbypassrls:false});
  const expected=JSON.parse(await readFile(new URL('../../../docs/04_test_reports/AV3/FN02/EMPTY_APPLICATION_QA_MANIFEST.json',import.meta.url),'utf8'));
  assertFn02QaManifest((await admin.query('SELECT id,checksum FROM anvil.schema_migrations')).rows,expected.rows);
  assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.users')).rows[0].n,0);
  const forms=buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md',import.meta.url)),await readFile(new URL('../../../docs/design/문서작성_공통기준.md',import.meta.url)));
  const methods=buildBuiltinMethodologies(await readFile(new URL('../../../docs/design/기본방법론_상세검토안.md',import.meta.url)),forms.forms);
  const seed=await admin.connect();try{await seed.query('BEGIN');await seedOfficialForms(seed,forms);await seedBuiltinMethodologies(seed,methods,forms.forms);await seed.query('COMMIT');}catch(e){await seed.query('ROLLBACK');throw e;}finally{seed.release();}
  phase='AUTH';const loginPassword=randomBytes(32).toString('base64url'),phc=await hashPassword(loginPassword);
  await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'초기 생성 격리 QA','ACTIVE')",[uid,'qa-fn02-compat-'+uid]);
  await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)',[uid,phc]);
  const who=await access.login('qa-fn02-compat-'+uid,loginPassword,'초기 생성 격리','fn02-compat'),headers={host:'localhost:3830',origin:'https://localhost:3830',cookie:'__Host-anvil.sid='+who.token,'x-anvil-csrf':who.csrfToken};
  const source=methods[0]!,sourceRef={id:source.id,version:source.version,contentHash:source.contentHash};
  const sourceRead=await app.inject({method:'GET',url:'/api/v1/methodologies/'+source.id+'/versions/'+source.version,headers});assert.equal(sourceRead.statusCode,200);assert.deepEqual(sourceRead.json().ref,sourceRef);
  async function draft(name:string){fresh();const r=await app.inject({method:'POST',url:'/api/v1/project-drafts',headers,payload:{schemaVersion:1,commandId:randomUUID(),clientId:who.clientId,targetId:null,expectedVersion:0,name,purpose:'초기 생성 호환 검수',desiredOutcome:'고정 원문 저장',sourceMode:'EMPTY',methodologySelection:{kind:'CONFIRMED_REFERENCE',versionRef:sourceRef},artifactRefs:[]}});assert.equal(r.statusCode,201,r.body);return r.json();}
  const create=(body:unknown)=>app.inject({method:'POST',url:'/api/v1/projects',headers,payload:body as any});
  phase='INITIAL_CREATE';const firstDraft=await draft('첫 초기 생성'),body={schemaVersion:1,commandId:randomUUID(),clientId:who.clientId,draftId:firstDraft.draftId,draftVersion:1};
  const results=await Promise.all([create(body),create(body)]);for(const r of results)assert.equal(r.statusCode,201,r.body);assert.deepEqual(results[0]!.json(),results[1]!.json());
  const first=results[0]!.json();projectIds.push(first.id);assert.equal(first.currentMethodologyRef.version,1);assert.equal(first.controlState.generation,1);assert.equal(first.controlState.clientId,who.clientId);
  const snapshot=(await pool.query('SELECT application_command_id,snapshot_json,snapshot_hash FROM anvil.project_methodologies WHERE project_id=$1',[first.id])).rows;assert.equal(snapshot.length,1);assert.equal(snapshot[0].application_command_id,null);assert.deepEqual(snapshot[0].snapshot_json.graph,source.graph);assert.deepEqual(snapshot[0].snapshot_json.sourceRef,sourceRef);markers.push('INITIAL_CREATE_REPLAY_SNAPSHOT_PRESERVED');
  phase='DIRECT_INSERT_LOCK';const locked=await pool.connect(),contender=await pool.connect();
  try{
   await locked.query('BEGIN');assert.equal((await locked.query('SELECT id FROM anvil.projects WHERE id=$1 FOR UPDATE',[first.id])).rowCount,1);
   for(const table of ['assignment_drafts','execution_preparations','agent_sessions','executions','execution_grants','writer_claims','execution_commands']){
    phase='DIRECT_INSERT_'+table.toUpperCase();
    await contender.query('BEGIN');try{await contender.query("SET LOCAL lock_timeout='150ms'");await assert.rejects(contender.query('INSERT INTO anvil.'+table+'(project_id) VALUES($1)',[first.id]),(e:any)=>e.code==='55P03',table+'는 기존 guard/필수열 거절 전에 같은 project 잠금을 기다려야 한다');}finally{await contender.query('ROLLBACK');}
   }
   markers.push('SEVEN_DIRECT_INSERTS_WAIT_BEFORE_OLD_GUARDS');
   phase='OTHER_PROJECT_CREATE';const secondDraft=await draft('다른 프로젝트 초기 생성'),secondResponse=await create({...body,commandId:randomUUID(),draftId:secondDraft.draftId});assert.equal(secondResponse.statusCode,201,secondResponse.body);const second=secondResponse.json();projectIds.push(second.id);assert.notEqual(second.id,first.id);assert.equal(second.currentMethodologyRef.version,1);markers.push('OTHER_PROJECT_INITIAL_CREATE_WHILE_FIRST_LOCKED');
  }finally{await locked.query('ROLLBACK');locked.release();contender.release();}
  phase='NONDEFAULT_ISOLATION';for(const isolation of ['REPEATABLE READ','SERIALIZABLE']){const db=await pool.connect();try{await db.query('BEGIN ISOLATION LEVEL '+isolation);await assert.rejects(db.query('SELECT anvil.fn02_lock_project($1)',[first.id]),(e:any)=>e.code==='40001');}finally{await db.query('ROLLBACK');db.release();}}
  markers.push('NON_READ_COMMITTED_EXPLICITLY_REJECTED');
  phase='READBACK';const reloaded=await app.inject({method:'GET',url:'/api/v1/projects/'+first.id,headers});assert.equal(reloaded.statusCode,200);assert.deepEqual(reloaded.json().currentMethodologyRef,first.currentMethodologyRef);
  assert.deepEqual((await pool.query('SELECT application_command_id,snapshot_json,snapshot_hash FROM anvil.project_methodologies WHERE project_id=$1',[first.id])).rows,snapshot);
  assert.equal((await pool.query("SELECT count(*)::int n FROM anvil.commands WHERE operation='applyMethodology'")).rows[0].n,0);
  for(const table of ['assignment_drafts','execution_preparations','agent_sessions','executions','execution_grants','writer_claims','execution_commands','delivery_outbox'])assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.'+table)).rows[0].n,0);
  const actualProjectIds=(await admin.query('SELECT id FROM anvil.projects')).rows.map(row=>row.id).toSorted();assert.deepEqual(actualProjectIds,projectIds.toSorted());
  console.log('FN02_APPLICATION_COMPATIBILITY '+JSON.stringify({status:'PASS',markers,initialProjects:actualProjectIds.length,actualAgentCalls:0,formalDbChanges:0}));
 }catch(error){const code=(error as any)?.code;console.log('FN02_APPLICATION_COMPATIBILITY_FAILURE '+JSON.stringify({phase,code:typeof code==='string'&&/^[A-Z0-9_]{1,80}$/.test(code)?code:null}));throw error;}
 finally{await app.close();await pool.end();await admin.end();}
});
