import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {randomUUID,randomBytes,generateKeyPairSync,sign,createHash} from 'node:crypto';
import {Pool} from 'pg';
import {validateDevelopmentDbConfig} from '../../../apps/server/storage/development-config.ts';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {hashPassword} from '../../../apps/server/modules/access/service.ts';
import {ProjectPolicyRepository} from '../../../apps/server/modules/access/project-command.ts';
import {buildApp} from '../../../apps/server/app.ts';
import {proofBytes,publicKeyFingerprint} from '../../../apps/server/modules/connections/registration-proof.ts';

// 완료된 지문 문자열만 믿거나 HUMAN 확인을 생략하고 token을 재발급하면 이 실제 PG/HTTP 시험이 실패한다.
test('trust-only 실제 등록은 host 서명/HUMAN exact 확인/새 nonce·일회 발급·현재 정책·회수에 결박된다',async()=>{
 if(!process.env.ANVIL_DB_CONFIG||!process.env.ANVIL_MIGRATOR_CONFIG)throw Error('ACTUAL_PROTECTED_DB_REQUIRED_NOT_SKIP');
 const pool=new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG,'utf8')),'app'));
 const admin=new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_MIGRATOR_CONFIG,'utf8')),'migrator'));
 const users=[randomUUID(),randomUUID()],projects=[randomUUID(),randomUUID()],ownedUsers:string[]=[],ownedProjects:string[]=[];
 const access=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)}),policies=new ProjectPolicyRepository(access),app=buildApp({},undefined,{repository:access,origin:'https://localhost:3830'});
 try{
  const password=randomBytes(32).toString('base64url'),phc=await hashPassword(password);
  for(const id of users){await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'신뢰 등록 합성 QA','ACTIVE')",[id,'qa-connector-trust-'+id]);ownedUsers.push(id);await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)',[id,phc]);}
  let own=await access.login('qa-connector-trust-'+users[0],password,'등록 QA','qa-connector-trust-'+users[0]);const other=await access.login('qa-connector-trust-'+users[1],password,'격리 QA','qa-connector-trust-'+users[1]);
  own=await access.reauthenticate(own.token,own.csrfToken,password,'qa-connector-trust-'+users[0]);
  for(const [i,id]of projects.entries()){await admin.query("INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,'상태조회전용 신뢰 QA','신뢰와 실행 분리','비밀 없는 등록 상태')",[id]);ownedProjects.push(id);await admin.query("INSERT INTO anvil.project_members(project_id,user_id,participation) VALUES($1,$2,'OWNER')",[id,users[i]]);await admin.query('INSERT INTO anvil.project_control(project_id,actor_id,client_id,generation) VALUES($1,$2,$3,1)',[id,users[i],i?other.clientId:own.clientId]);}
  const pid=projects[0]!,envelope=(operation:string,payload:Record<string,unknown>,targetId:string|null=null,expectedVersion=0)=>({schemaVersion:1 as const,projectId:pid,commandId:randomUUID(),clientId:own.clientId,controlGeneration:1,operation,targetId,expectedVersion,baselineRefs:[],approvalRef:null,payload});
  const rules=(disposition:string)=>[{ruleId:'TRUST',subjectRef:{kind:'HUMAN',userId:users[0]},operations:['registerConnector','confirmConnectorRegistration','revokeConnector'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition,limitPolicyRef:null,expiresAt:new Date(Date.now()+3600000).toISOString()}];
  let policy:any=await policies.command(own.token,own.csrfToken,envelope('savePermissionPolicy',{rules:rules('AUTO'),reason:'실행 권한 없는 QA 등록',reviewRefs:[]}));
  const headers=(session=own)=>({host:'localhost:3830',origin:'https://localhost:3830',cookie:'__Host-anvil.sid='+session.token,'x-anvil-csrf':session.csrfToken});
  const human=(c:any,session=own)=>app.inject({method:'POST',url:'/api/v1/projects/'+pid+'/commands',headers:{...headers(session),'idempotency-key':c.commandId},payload:c});
  const post=(url:string,payload:Record<string,unknown>)=>app.inject({method:'POST',url,headers:{host:'localhost:3830',origin:'https://localhost:3830'},payload});
  const host=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=host.publicKey.export({type:'spki',format:'der'}).toString('base64url'),fingerprint=publicKeyFingerprint(spki);
  const signature=(payload:any)=>sign('sha256',proofBytes(payload),{key:host.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  const register=envelope('registerConnector',{kind:'HOST_TRUST_REGISTRATION',hostLabel:'합성 Windows host',expectedHostFingerprint:fingerprint,policyRef:policy.data.ref,expiresAt:new Date(Date.now()+600000).toISOString(),reason:'실행 grant 없이 신뢰만 확인'});
  const made=await human(register);assert.equal(made.statusCode,200);const created=made.json().data,registrationId=created.registrationRef.id,connectorId=created.connectorRef.id,code=created.oneTimeCode;
  assert.equal(created.executionAuthorized,false);assert.deepEqual(created.grants,[]);assert.equal(typeof code,'string');
  const replay=await human(register);assert.equal(replay.statusCode,200);assert.equal(replay.json().data.oneTimeCode,null);assert.equal(replay.json().data.secretDisposition,'ALREADY_ISSUED_RECONCILE');
  const enroll={registrationId,oneTimeCode:code,observedHostFingerprint:fingerprint,clientNonce:randomBytes(32).toString('base64url'),connectorVersion:'synthetic-qa-1',publicKeySpki:spki};
  const enrolled=await post('/api/v1/connectors/enroll',enroll);assert.equal(enrolled.statusCode,200);const challenge=enrolled.json().challenge;
  assert.equal(challenge.payload.installationId,access.installationId);assert.equal(Buffer.from(challenge.payload.serverNonce,'base64url').length,32);assert.equal(Buffer.from(challenge.payload.clientNonce,'base64url').length,32);
  const duplicate=await post('/api/v1/connectors/enroll',enroll);assert.equal(duplicate.statusCode,200);assert.deepEqual(duplicate.json().challenge,challenge);
  const wrong=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),wrongSpki=wrong.publicKey.export({type:'spki',format:'der'}).toString('base64url');
  const fake=await post('/api/v1/connectors/enroll',{...enroll,publicKeySpki:wrongSpki});assert.ok([403,409,412].includes(fake.statusCode));
  const proofUrl='/api/v1/connectors/registrations/'+registrationId+'/proof',proof={challengeId:challenge.id,payload:challenge.payload,signature:signature(challenge.payload)};
  const bad=await post(proofUrl,{...proof,payload:{...proof.payload,scopeDigest:'f'.repeat(64)}});assert.equal(bad.statusCode,412);
  const proved=await post(proofUrl,proof);assert.equal(proved.statusCode,200);const p=proved.json();assert.equal(p.status,'PROVED_WAITING_CONFIRMATION');
  const exchangeUrl='/api/v1/connectors/registrations/'+registrationId+'/exchange',freshClientNonce=randomBytes(32).toString('base64url');
  const preflight={...challenge.payload,clientNonce:freshClientNonce,expiresAt:register.payload.expiresAt};
  const exchangeRequest={kind:'CHALLENGE',payload:preflight,signature:signature(preflight)};
  assert.equal((await post(exchangeUrl,exchangeRequest)).statusCode,412,'HUMAN 확인 전 발급 경로 차단');
  const confirm=envelope('confirmConnectorRegistration',{registrationId,observedHostFingerprint:fingerprint,scopeDigest:p.scopeDigest,decision:'APPROVE',reason:'정확 공개키/범위/버전 확인'},registrationId,p.registrationRef.version);
  const mismatch=await human({...confirm,commandId:randomUUID(),payload:{...confirm.payload,scopeDigest:'0'.repeat(64)}});assert.equal(mismatch.statusCode,409);
  const confirmed=await human(confirm);assert.equal(confirmed.statusCode,200);
  const fresh=await post(exchangeUrl,exchangeRequest);assert.equal(fresh.statusCode,200);const exchangeChallenge=fresh.json().challenge;assert.notEqual(exchangeChallenge.payload.serverNonce,challenge.payload.serverNonce);assert.notEqual(exchangeChallenge.payload.clientNonce,challenge.payload.clientNonce);
  const issue={kind:'ISSUE',challengeId:exchangeChallenge.id,payload:exchangeChallenge.payload,signature:signature(exchangeChallenge.payload)};
  const concurrent=await Promise.all([post(exchangeUrl,issue),post(exchangeUrl,issue)]);assert.deepEqual(concurrent.map(x=>x.statusCode).sort(),[200,409]);
  const issued=concurrent.find(x=>x.statusCode===200)!.json(),token=issued.credential;
  assert.equal(issued.scope,'REGISTRATION_STATUS_ONLY');assert.deepEqual(issued.grants,[]);assert.equal(issued.executionAuthorized,false);assert.ok(/^av3ct1_[A-Za-z0-9_-]{43}$/.test(token));assert.ok(Date.parse(issued.expiresAt)<=Date.now()+900000);
  assert.equal(concurrent.find(x=>x.statusCode===409)!.json().code,'ALREADY_ISSUED_RECONCILE');
  const statusHeaders={host:'localhost:3830',authorization:'Bearer '+token};
  const statusUrl='/api/v1/connectors/'+connectorId+'/registration-status';
  const status=await app.inject({method:'GET',url:statusUrl,headers:statusHeaders});assert.equal(status.statusCode,200);assert.equal(status.json().scope,'REGISTRATION_STATUS_ONLY');assert.equal(status.body.includes(token),false);
  assert.equal((await app.inject({method:'GET',url:'/api/v1/connectors/'+randomUUID()+'/registration-status',headers:statusHeaders})).statusCode,404);
  for(const url of ['/api/v1/projects','/api/v1/connectors/'+connectorId+'/commands'])assert.equal((await app.inject({method:'GET',url,headers:{...headers(),...statusHeaders}})).statusCode,403);
  const rows=(await admin.query('SELECT token_digest FROM anvil.connector_credentials WHERE connector_id=$1',[connectorId])).rows;assert.equal(rows.length,1);assert.equal(rows[0].token_digest,createHash('sha256').update(token).digest('hex'));
  const stored=(await admin.query('SELECT result_ref FROM anvil.commands WHERE project_id=$1',[pid])).rows;assert.equal(JSON.stringify(stored).includes(code),false);assert.equal(JSON.stringify(stored).includes(token),false);
  await assert.rejects(pool.query("UPDATE anvil.connectors SET status='TRUSTED' WHERE id=$1",[connectorId]),(e:any)=>e.code==='42501');
  const revoked=await human(envelope('revokeConnector',{connectorRef:created.connectorRef,reason:'합성 시험 회수'},connectorId,created.connectorRef.version));assert.equal(revoked.statusCode,200);
  assert.equal((await app.inject({method:'GET',url:statusUrl,headers:statusHeaders})).statusCode,401);
  assert.equal((await post(exchangeUrl,issue)).statusCode,412);
  assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.delivery_outbox WHERE project_id=ANY($1::uuid[])',[projects])).rows[0].n,0);
  policy=await policies.command(own.token,own.csrfToken,envelope('savePermissionPolicy',{rules:rules('DENY'),reason:'합성 권한 회수',reviewRefs:[]},policy.data.ref.id,policy.data.ref.version));
  assert.equal((await human({...register,commandId:randomUUID()})).statusCode,403);
 }finally{
  await app.close();const db=await admin.connect();try{
   await db.query('BEGIN');await db.query('SET CONSTRAINTS ALL DEFERRED');
   await db.query('UPDATE anvil.authorization_receipts SET approval_decision_ref=NULL WHERE scope_id=ANY($1::uuid[])',[ownedProjects]);await db.query('UPDATE anvil.commands SET authorization_receipt_id=NULL,approval_consumption_id=NULL WHERE project_id=ANY($1::uuid[])',[ownedProjects]);
   for(const table of ['connector_credentials','connector_registration_challenges','connector_registrations','connectors','audit_events','approval_consumptions','approval_decisions','approval_requests'])if((await db.query('SELECT to_regclass($1) present',['anvil.'+table])).rows[0].present)await db.query('DELETE FROM anvil.'+table+' WHERE project_id=ANY($1::uuid[])',[ownedProjects]);
   await db.query('UPDATE anvil.permission_policies SET head_version=head_version+1 WHERE project_id=ANY($1::uuid[])',[ownedProjects]);for(const table of ['permission_policy_versions','permission_policies'])await db.query('DELETE FROM anvil.'+table+' WHERE project_id=ANY($1::uuid[])',[ownedProjects]);
   await db.query('DELETE FROM anvil.authorization_receipts WHERE scope_id=ANY($1::uuid[])',[ownedProjects]);for(const table of ['commands','project_control','project_members'])await db.query('DELETE FROM anvil.'+table+' WHERE project_id=ANY($1::uuid[])',[ownedProjects]);await db.query('DELETE FROM anvil.projects WHERE id=ANY($1::uuid[])',[ownedProjects]);
   await db.query('DELETE FROM anvil.auth_audit_events WHERE subject_ref=ANY($1::uuid[])',[ownedUsers]);for(const table of ['auth_sessions','clients','password_credentials'])await db.query('DELETE FROM anvil.'+table+' WHERE user_id=ANY($1::uuid[])',[ownedUsers]);await db.query('DELETE FROM anvil.users WHERE id=ANY($1::uuid[])',[ownedUsers]);await db.query('COMMIT');
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();await pool.end();await admin.end();}
 }
});
