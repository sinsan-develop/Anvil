import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import test from 'node:test';
import {currentProfile,openCurrentChild} from '../../../scripts/qa-ix01-current-journey.ts';
import {verifyCurrentSchemaLedger} from './current-schema-baseline.ts';
import {registerJourneyClose,type JourneyOwnedResource} from './journey-context-lifecycle.ts';
import {fenceResultQaPool} from '../FN12/result-qa-fence.ts';

const origin='https://localhost:3830';
test('IX01 TC01 현재 격리 저장 여정',{
 skip:process.env.ANVIL_IX01_CURRENT_CHILD!=='AUTHORIZED_PARENT'?'현재 격리 실행 별도 승인 없음 · NOT_RUN':false,timeout:80_000,
},async t=>{
 const owned:JourneyOwnedResource[]=[];
 async function closeOwned(){
  let failed=false;
  for(const resource of [...owned].reverse())try{await resource.close();}catch{failed=true;}
  if(failed)throw Error('IX01_CURRENT_CHILD_CLOSE');
 }
 let code='HANDOFF',passed=false;
 try{
  const child=openCurrentChild(),{handoff}=child;
  const fresh=()=>{if(t.signal.aborted)throw Error('IX01_CURRENT_CHILD_DEADLINE');child.fresh();};
  const bound=async <T>(work:()=>Promise<T>)=>{fresh();const result=await work();fresh();return result;};
  const {Pool}=await bound(()=>import('pg'));
  const config={host:handoff.host,port:5432,database:currentProfile.database,ssl:false,connectionTimeoutMillis:3000,statement_timeout:5000,query_timeout:6000};
  const appRole='anvil_v3_app',migratorRole='anvil_v3_migrator';
  function ownedPool(user:string,password:string){
   fresh();const raw=new Pool({...config,user,password,max:2});
   registerJourneyClose(owned,user,()=>raw.end());
   return fenceResultQaPool(raw,fresh);
  }
  code='DATABASE';
  const admin=ownedPool(migratorRole,child.migratorPassword),pool=ownedPool(appRole,child.appPassword);
  const identitySql='SELECT current_database() db, current_user role, session_user session_role, host(inet_server_addr()) address, inet_server_port() port, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolreplication FROM pg_catalog.pg_roles WHERE rolname=current_user';
  for(const [connection,role] of [[admin,migratorRole],[pool,appRole]] as const){
   assert.deepEqual((await bound(()=>connection.query(identitySql))).rows,[{db:currentProfile.database,role,session_role:role,address:handoff.host,port:5432,rolsuper:false,rolbypassrls:false,rolcreaterole:false,rolcreatedb:false,rolreplication:false}]);
  }
  code='LEDGER';
  verifyCurrentSchemaLedger(child.historical,(await bound(()=>admin.query('SELECT id,checksum FROM anvil.schema_migrations'))).rows);
  assert.deepEqual((await bound(()=>admin.query('SELECT count(*)::int n FROM anvil.users'))).rows,[{n:0}]);
  code='CATALOG';
  const {buildOfficialForms}=await bound(()=>import('../../../apps/server/modules/documents/forms.ts'));
  const {seedOfficialForms}=await bound(()=>import('../../../apps/server/modules/documents/catalog-seed.ts'));
  const {buildBuiltinMethodologies}=await bound(()=>import('../../../apps/server/modules/methodologies/builtins.ts'));
  const {seedBuiltinMethodologies}=await bound(()=>import('../../../apps/server/modules/methodologies/catalog-seed.ts'));
  const forms=buildOfficialForms(child.sourceBytes(currentProfile.forms),child.sourceBytes(currentProfile.standard));
  const methods=buildBuiltinMethodologies(child.sourceBytes(currentProfile.methods),forms.forms);
  const seed=await admin.connect();
  try{
   await bound(()=>seed.query('BEGIN'));
   await bound(()=>seedOfficialForms(seed,forms));
   await bound(()=>seedBuiltinMethodologies(seed,methods,forms.forms));
   assert.equal((await bound(()=>seed.query('COMMIT'))).command,'COMMIT');
  }finally{seed.release(true);}
  code='LOGIN';
  const {AccessRepository}=await bound(()=>import('../../../apps/server/modules/access/repository.ts'));
  const {hashPassword}=await bound(()=>import('../../../apps/server/modules/access/service.ts'));
  const id=randomUUID(),login='ix01-'+id,password=randomBytes(32).toString('base64url');
  const phc=await bound(()=>hashPassword(password));
  const credentials=await pool.connect();
  try{
   await bound(()=>credentials.query('BEGIN'));
   await bound(()=>credentials.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'IX01 격리 사용자','ACTIVE')",[id,login]));
   await bound(()=>credentials.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)',[id,phc]));
   assert.equal((await bound(()=>credentials.query('COMMIT'))).command,'COMMIT');
  }finally{credentials.release(true);}
  const access=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)});
  const loginResult=await bound(()=>access.login(login,password,'IX01 현재 격리','ix01-current-tc01'));
  const session=await bound(()=>access.reauthenticate(loginResult.token,loginResult.csrfToken,password,'ix01-current-tc01'));
  const identity=await bound(()=>access.authenticated(session.token,session.csrfToken,async(_db,actor)=>actor));
  assert.equal(identity.actorId,id);assert.equal(identity.clientId,session.clientId);assert.equal(identity.credentialGeneration,1);assert.ok(identity.reauthUntil);
  code='TC01';
  const {buildApp}=await bound(()=>import('../../../apps/server/app.ts'));
  const {runMethodologyCopyApplicationScenario}=await bound(()=>import('./methodology-copy-application-scenario.ts'));
  fresh();const app=buildApp({},undefined,{repository:access,origin,artifactRoot:currentProfile.artifact});
  registerJourneyClose(owned,'APP',()=>app.close());
  await bound(()=>runMethodologyCopyApplicationScenario({app,session,origin,assertCurrent:fresh}));
  code='CLOSE';
  await closeOwned();fresh();
  code='RESULT';
  child.finish();passed=true;
 }catch{throw Error('IX01_CURRENT_CHILD_'+code);}
 finally{if(!passed)try{await closeOwned();}catch{/* 결과는 미확정이며 부모는 자원을 보존한다. */}}
});
