import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {randomUUID,randomBytes,generateKeyPairSync,sign} from 'node:crypto';
import {Pool} from 'pg';
import {validateDevelopmentDbConfig} from '../../../apps/server/storage/development-config.ts';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {hashPassword} from '../../../apps/server/modules/access/service.ts';
import {ProjectPolicyRepository} from '../../../apps/server/modules/access/project-command.ts';
import {registrationRef} from '../../../apps/server/modules/connections/project-registrations.ts';
import {proofBytes,publicKeyFingerprint} from '../../../apps/server/modules/connections/registration-proof.ts';
import {buildApp} from '../../../apps/server/app.ts';

// DB guard가 ->> 비교로 되돌아가면 null/문자열1/필드 대체 INSERT가 허용되어 실패한다.
test('실제 app DB challenge는 정확 숫자1만 허용하고 정상 등록·일회 발급을 유지한다',async()=>{
 if(!process.env.ANVIL_DB_CONFIG||!process.env.ANVIL_MIGRATOR_CONFIG)throw Error('ACTUAL_PROTECTED_DB_REQUIRED_NOT_SKIP');
 const pool=new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG,'utf8')),'app'));
 const admin=new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_MIGRATOR_CONFIG,'utf8')),'migrator'));
 const uid=randomUUID(),pid=randomUUID();let userCreated=false,projectCreated=false;
 const access=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)}),policies=new ProjectPolicyRepository(access),app=buildApp({},undefined,{repository:access,origin:'https://localhost:3830'});
 try{
  const password=randomBytes(32).toString('base64url'),phc=await hashPassword(password);
  await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'challenge 숫자 계약 QA','ACTIVE')",[uid,'qa-connector-trust-'+uid]);userCreated=true;
  await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)',[uid,phc]);
  let own=await access.login('qa-connector-trust-'+uid,password,'challenge QA','qa-connector-trust-'+uid);own=await access.reauthenticate(own.token,own.csrfToken,password,'qa-connector-trust-'+uid);
  await admin.query("INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,'challenge 계약 QA','숫자1만 허용','상태 조회만')",[pid]);projectCreated=true;
  await admin.query("INSERT INTO anvil.project_members(project_id,user_id,participation) VALUES($1,$2,'OWNER')",[pid,uid]);await admin.query('INSERT INTO anvil.project_control(project_id,actor_id,client_id,generation) VALUES($1,$2,$3,1)',[pid,uid,own.clientId]);
  const envelope=(operation:string,payload:Record<string,unknown>,targetId:string|null=null,expectedVersion=0)=>({schemaVersion:1 as const,projectId:pid,commandId:randomUUID(),clientId:own.clientId,controlGeneration:1,operation,targetId,expectedVersion,baselineRefs:[],approvalRef:null,payload});
  const policy:any=await policies.command(own.token,own.csrfToken,envelope('savePermissionPolicy',{rules:[{ruleId:'TRUST',subjectRef:{kind:'HUMAN',userId:uid},operations:['registerConnector','confirmConnectorRegistration','revokeConnector'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:new Date(Date.now()+3600000).toISOString()}],reason:'DB 숫자 계약 합성 QA',reviewRefs:[]}));
  const human=(c:any)=>app.inject({method:'POST',url:'/api/v1/projects/'+pid+'/commands',headers:{host:'localhost:3830',origin:'https://localhost:3830',cookie:'__Host-anvil.sid='+own.token,'x-anvil-csrf':own.csrfToken,'idempotency-key':c.commandId},payload:c});
  const post=(url:string,payload:Record<string,unknown>)=>app.inject({method:'POST',url,headers:{host:'localhost:3830',origin:'https://localhost:3830'},payload});
  const host=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=host.publicKey.export({type:'spki',format:'der'}).toString('base64url'),fingerprint=publicKeyFingerprint(spki),deadline=new Date(Date.now()+600000).toISOString();
  const made=await human(envelope('registerConnector',{kind:'HOST_TRUST_REGISTRATION',hostLabel:'숫자 계약 QA',expectedHostFingerprint:fingerprint,policyRef:policy.data.ref,expiresAt:deadline,reason:'guard만 직접 검수'}));assert.equal(made.statusCode,200);const created=made.json().data,rid=created.registrationRef.id;
  const payload={protocolVersion:1,installationId:access.installationId,registrationId:rid,scopeDigest:created.scopeDigest,publicKeyFingerprint:fingerprint,serverNonce:randomBytes(32).toString('base64url'),clientNonce:randomBytes(32).toString('base64url'),expiresAt:new Date(Date.now()+90000).toISOString()};
  const {protocolVersion:omitted,...withoutVersion}=payload;
  const cases=[{name:'JSON null',payload:{...payload,protocolVersion:null}},{name:'문자열1',payload:{...payload,protocolVersion:'1'}},{name:'다른 숫자',payload:{...payload,protocolVersion:2}},{name:'불리언',payload:{...payload,protocolVersion:true}},{name:'누락7필드',payload:withoutVersion},{name:'누락+대체8필드',payload:{...withoutVersion,unexpected:1}}];
  for(const c of cases)assert.throws(()=>proofBytes(c.payload),{message:'HOST_PROOF_INVALID'},c.name+'는 공개 입력에서도 거절');
  const db=await pool.connect(),rejected:string[]=[],accepted:string[]=[];
  try{
   await db.query('BEGIN');assert.equal((await db.query('SELECT current_user AS name')).rows[0].name,'anvil_v3_app');
   const r=(await db.query('SELECT * FROM anvil.connector_registrations WHERE id=$1',[rid])).rows[0],eventId=randomUUID();
   await db.query("INSERT INTO anvil.audit_events(project_id,server_sequence,event_id,actor_ref,client_ref,target_ref,policy_ref,outcome,reason_code,scope_digest,source_kind) SELECT $1,COALESCE(MAX(server_sequence),0)+1,$2,$3,$4,$5,$6,'APPLIED','ENROLLED',$7,'CONNECTOR_PROTOCOL' FROM anvil.audit_events WHERE project_id=$1",[pid,eventId,JSON.stringify({kind:'CONNECTOR',connectorId:r.connector_id,registrationId:rid}),r.client_id,JSON.stringify(registrationRef({...r,version:2,state:'CHALLENGED'})),JSON.stringify(r.policy_ref),r.scope_digest]);
   await db.query("SELECT set_config('anvil.connector_registration_id',$1,true),set_config('anvil.connector_event_id',$2,true)",[rid,eventId]);
   assert.equal((await db.query("SELECT anvil.connector_protocol_event($1,'ENROLLED') AS ok",[rid])).rows[0].ok,true);
   const insert=(value:unknown)=>db.query("INSERT INTO anvil.connector_registration_challenges(id,project_id,registration_id,purpose,payload_json,expires_at) VALUES($1,$2,$3,'HOST_PROOF',$4,$5)",[randomUUID(),pid,rid,JSON.stringify(value),payload.expiresAt]);
   await db.query('SAVEPOINT payload_case');await insert(payload);assert.equal((await db.query('SELECT count(*)::int n FROM anvil.connector_registration_challenges WHERE registration_id=$1',[rid])).rows[0].n,1);await db.query('ROLLBACK TO SAVEPOINT payload_case');
   for(const c of cases){
    await db.query('SAVEPOINT payload_case');let failure:any;
    try{await insert(c.payload);}catch(error){failure=error;}finally{await db.query('ROLLBACK TO SAVEPOINT payload_case');}
    if(failure){assert.equal(failure.code,'42501');assert.equal(failure.message,'CONNECTOR_EXACT_CHALLENGE_REQUIRED');rejected.push(c.name);}else accepted.push(c.name);
   }
   assert.deepEqual(accepted,[],'잘못된 protocolVersion이 DB INSERT를 통과하면 안 된다');assert.equal(rejected.length,6);
  }finally{await db.query('ROLLBACK');db.release();}
  assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.connector_registration_challenges WHERE registration_id=$1',[rid])).rows[0].n,0);
  const enrolled=await post('/api/v1/connectors/enroll',{registrationId:rid,oneTimeCode:created.oneTimeCode,observedHostFingerprint:fingerprint,clientNonce:randomBytes(32).toString('base64url'),connectorVersion:'synthetic-qa-1',publicKeySpki:spki});assert.equal(enrolled.statusCode,200);const ch=enrolled.json().challenge;
  const signature=(value:any)=>sign('sha256',proofBytes(value),{key:host.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url'),prefix='/api/v1/connectors/registrations/'+rid;
  const proved=await post(prefix+'/proof',{challengeId:ch.id,payload:ch.payload,signature:signature(ch.payload)});assert.equal(proved.statusCode,200);const proof=proved.json();
  assert.equal((await human(envelope('confirmConnectorRegistration',{registrationId:rid,observedHostFingerprint:fingerprint,scopeDigest:proof.scopeDigest,decision:'APPROVE',reason:'정확 숫자1 정상 경로'},rid,proof.registrationRef.version))).statusCode,200);
  const preflight={...ch.payload,clientNonce:randomBytes(32).toString('base64url'),expiresAt:deadline},exchange=await post(prefix+'/exchange',{kind:'CHALLENGE',payload:preflight,signature:signature(preflight)});assert.equal(exchange.statusCode,200);const fresh=exchange.json().challenge;
  const issue={kind:'ISSUE',challengeId:fresh.id,payload:fresh.payload,signature:signature(fresh.payload)},issued=await post(prefix+'/exchange',issue);assert.equal(issued.statusCode,200);assert.deepEqual(issued.json().grants,[]);
  assert.equal((await post(prefix+'/exchange',issue)).statusCode,409);const status=await app.inject({method:'GET',url:'/api/v1/connectors/'+created.connectorRef.id+'/registration-status',headers:{host:'localhost:3830',authorization:'Bearer '+issued.json().credential}});assert.equal(status.statusCode,200);assert.equal(status.json().executionAuthorized,false);
  assert.equal((await human(envelope('revokeConnector',{connectorRef:created.connectorRef,reason:'숫자 계약 QA 회수'},created.connectorRef.id,1))).statusCode,200);
 }finally{
  await app.close();const db=await admin.connect();try{
   await db.query('BEGIN');await db.query('SET CONSTRAINTS ALL DEFERRED');
   if(projectCreated){
    await db.query('UPDATE anvil.authorization_receipts SET approval_decision_ref=NULL WHERE scope_id=$1',[pid]);await db.query('UPDATE anvil.commands SET authorization_receipt_id=NULL,approval_consumption_id=NULL WHERE project_id=$1',[pid]);
    for(const table of ['connector_credentials','connector_registration_challenges','connector_registrations','connectors','audit_events','approval_consumptions','approval_decisions','approval_requests'])await db.query('DELETE FROM anvil.'+table+' WHERE project_id=$1',[pid]);
    await db.query('UPDATE anvil.permission_policies SET head_version=head_version+1 WHERE project_id=$1',[pid]);for(const table of ['permission_policy_versions','permission_policies'])await db.query('DELETE FROM anvil.'+table+' WHERE project_id=$1',[pid]);
    await db.query('DELETE FROM anvil.authorization_receipts WHERE scope_id=$1',[pid]);for(const table of ['commands','project_control','project_members'])await db.query('DELETE FROM anvil.'+table+' WHERE project_id=$1',[pid]);await db.query('DELETE FROM anvil.projects WHERE id=$1',[pid]);
   }
   if(userCreated){await db.query('DELETE FROM anvil.auth_audit_events WHERE subject_ref=$1',[uid]);for(const table of ['auth_sessions','clients','password_credentials'])await db.query('DELETE FROM anvil.'+table+' WHERE user_id=$1',[uid]);await db.query('DELETE FROM anvil.users WHERE id=$1',[uid]);}
   await db.query('COMMIT');
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();await pool.end();await admin.end();}
 }
});
