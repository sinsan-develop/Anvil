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
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

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
  const rules=(disposition:string)=>[
   {ruleId:'TRUST',subjectRef:{kind:'HUMAN',userId:users[0]},operations:['registerConnector','confirmConnectorRegistration','revokeConnector'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition,limitPolicyRef:null,expiresAt:new Date(Date.now()+3600000).toISOString()},
   {ruleId:'DECISIONS',subjectRef:{kind:'HUMAN',userId:users[0]},operations:['requestApproval','decideApproval'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:new Date(Date.now()+3600000).toISOString()}
  ];
  let policy:any=await policies.command(own.token,own.csrfToken,envelope('savePermissionPolicy',{rules:rules('AUTO'),reason:'실행 권한 없는 QA 등록',reviewRefs:[]}));
  const headers=(session=own)=>({host:'localhost:3830',origin:'https://localhost:3830',cookie:'__Host-anvil.sid='+session.token,'x-anvil-csrf':session.csrfToken});
  const human=(c:any,session=own)=>app.inject({method:'POST',url:'/api/v1/projects/'+pid+'/commands',headers:{...headers(session),'idempotency-key':c.commandId},payload:c});
  const post=(url:string,payload:Record<string,unknown>)=>app.inject({method:'POST',url,headers:{host:'localhost:3830',origin:'https://localhost:3830'},payload});
  const host=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=host.publicKey.export({type:'spki',format:'der'}).toString('base64url'),fingerprint=publicKeyFingerprint(spki);
  const signature=(payload:any)=>sign('sha256',proofBytes(payload),{key:host.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  const registerRequest=(lifetime=600000)=>envelope('registerConnector',{kind:'HOST_TRUST_REGISTRATION',hostLabel:'합성 host 경계 QA',expectedHostFingerprint:fingerprint,policyRef:policy.data.ref,expiresAt:new Date(Date.now()+lifetime).toISOString(),reason:'등록 신뢰의 거절 경계 확인'});
  const enrolledFor=async(created:any)=>{const response=await post('/api/v1/connectors/enroll',{registrationId:created.registrationRef.id,oneTimeCode:created.oneTimeCode,observedHostFingerprint:fingerprint,clientNonce:randomBytes(32).toString('base64url'),connectorVersion:'synthetic-qa-1',publicKeySpki:spki});assert.equal(response.statusCode,200);return response.json().challenge;};
  const approvedHuman=async(command:any,targetRef:any)=>{
   const details={reason:'합성 후보만 별도 HUMAN 결정',risks:{data:'합성 소유 자료만',security:'등록상태 권한만',cost:'외부 호출0',interruption:'서비스 중단0',unverified:'Agent/OS 실행 미검증'},rollback:{method:'정확 등록 회수·QA 정리',limitations:'유실 secret 재발급 없음',evidenceRefs:[]},expiresAt:new Date(Date.now()+120000).toISOString(),actionScope:{operation:command.operation,targetRef,expectedVersion:command.expectedVersion,payloadHash:contentHash(canonicalJson(command.payload)),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:users[0],clientId:own.clientId},controlGeneration:1},candidateCommandId:command.commandId};
   const requested=await human(envelope('requestApproval',{details}));assert.equal(requested.statusCode,200);const request=requested.json().data.request;
   const decided=await human(envelope('decideApproval',{requestId:request.id,expectedVersion:1,scopeDigest:request.scopeDigest,decision:'APPROVE',reason:'대상/버전/범위를 합성 사용자로 확인'},request.id,1));assert.equal(decided.statusCode,200);
   return{...command,approvalRef:{requestId:request.id,decisionId:decided.json().data.decision.id,scopeDigest:request.scopeDigest}};
  };
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
  // 다섯 실패는 rollback되지 않으며 여섯 번째 올바른 서명도 잠긴 등록을 살리지 못한다.
  const cappedResponse=await human(registerRequest());assert.equal(cappedResponse.statusCode,200);const capped=cappedResponse.json().data,cappedChallenge=await enrolledFor(capped),cappedUrl='/api/v1/connectors/registrations/'+capped.registrationRef.id+'/proof';
  const badSignature=sign('sha256',proofBytes(cappedChallenge.payload),{key:wrong.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  for(let attempt=1;attempt<=5;attempt++){assert.equal((await post(cappedUrl,{challengeId:cappedChallenge.id,payload:cappedChallenge.payload,signature:badSignature})).statusCode,412);assert.equal((await admin.query('SELECT failed_attempts FROM anvil.connector_registrations WHERE id=$1',[capped.registrationRef.id])).rows[0].failed_attempts,attempt);}
  const sixth=await post(cappedUrl,{challengeId:cappedChallenge.id,payload:cappedChallenge.payload,signature:signature(cappedChallenge.payload)});assert.equal(sixth.statusCode,412);assert.equal(sixth.json().code,'CONNECTOR_PROOF_ATTEMPT_LIMIT');assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.connector_credentials WHERE registration_id=$1',[capped.registrationRef.id])).rows[0].n,0);
  assert.equal((await human(envelope('revokeConnector',{connectorRef:capped.connectorRef,reason:'시도 한도 QA 회수'},capped.connectorRef.id,1))).statusCode,200);
  // 짧게 선언한 등록기한의 실제 경과는 새 코드/새 등록/기한 연장으로 복구하지 않는다.
  const expiringRequest=registerRequest(1500),expiringResponse=await human(expiringRequest);assert.equal(expiringResponse.statusCode,200);const expiring=expiringResponse.json().data;
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,Date.parse(String(expiringRequest.payload.expiresAt))-Date.now())+25));
  const expired=await post('/api/v1/connectors/enroll',{registrationId:expiring.registrationRef.id,oneTimeCode:expiring.oneTimeCode,observedHostFingerprint:fingerprint,clientNonce:randomBytes(32).toString('base64url'),connectorVersion:'synthetic-qa-1',publicKeySpki:spki});assert.equal(expired.statusCode,412);assert.equal(expired.json().code,'CONNECTOR_REGISTRATION_NOT_PENDING');
  assert.equal((await human(envelope('revokeConnector',{connectorRef:expiring.connectorRef,reason:'만료 QA 정확 회수'},expiring.connectorRef.id,1))).statusCode,200);
  // 나의 현재 세션·다른 프로젝트/기기는 같은 등록 HUMAN 명령을 수행할 수 없다.
  assert.equal((await human({...registerRequest(),projectId:projects[1]})).statusCode,400);
  assert.equal((await app.inject({method:'POST',url:'/api/v1/projects/'+projects[1]+'/commands',headers:headers(),payload:{...registerRequest(),projectId:projects[1]}})).statusCode,404);
  assert.equal((await human({...registerRequest(),clientId:other.clientId},other)).statusCode,404);
  await admin.query('UPDATE anvil.project_control SET generation=2 WHERE project_id=$1',[pid]);assert.equal((await human(registerRequest())).statusCode,409);await admin.query('UPDATE anvil.project_control SET generation=1 WHERE project_id=$1',[pid]);
  // 기존 일회 승인 계약에서 새로운 HUMAN3연산도 각각 독립 요청/결정/소비한다.
  policy=await policies.command(own.token,own.csrfToken,envelope('savePermissionPolicy',{rules:rules('REQUIRE_APPROVAL'),reason:'신뢰3연산 별도 승인 QA',reviewRefs:[]},policy.data.ref.id,policy.data.ref.version));
  const needed=registerRequest();assert.equal((await human(needed)).statusCode,412);const allowed=await approvedHuman(needed,null),approvedResponse=await human(allowed);assert.equal(approvedResponse.statusCode,200);const ac=approvedResponse.json().data,ach=await enrolledFor(ac),apUrl='/api/v1/connectors/registrations/'+ac.registrationRef.id;
  const apResponse=await post(apUrl+'/proof',{challengeId:ach.id,payload:ach.payload,signature:signature(ach.payload)});assert.equal(apResponse.statusCode,200);const ap=apResponse.json();
  const needConfirm=envelope('confirmConnectorRegistration',{registrationId:ac.registrationRef.id,observedHostFingerprint:fingerprint,scopeDigest:ap.scopeDigest,decision:'APPROVE',reason:'정확 지문과 범위 비교'},ac.registrationRef.id,ap.registrationRef.version);assert.equal((await human(needConfirm)).statusCode,412);
  const allowedConfirm=await approvedHuman(needConfirm,ap.registrationRef);assert.equal((await human(allowedConfirm)).statusCode,200);
  const freshPayload={...ach.payload,clientNonce:randomBytes(32).toString('base64url'),expiresAt:needed.payload.expiresAt},freshResponse=await post(apUrl+'/exchange',{kind:'CHALLENGE',payload:freshPayload,signature:signature(freshPayload)});assert.equal(freshResponse.statusCode,200);const ach2=freshResponse.json().challenge;
  const issuedApproved=await post(apUrl+'/exchange',{kind:'ISSUE',challengeId:ach2.id,payload:ach2.payload,signature:signature(ach2.payload)});assert.equal(issuedApproved.statusCode,200);const approvedCredential=issuedApproved.json().credential;
  assert.equal((await app.inject({method:'GET',url:'/api/v1/connectors/'+ac.connectorRef.id+'/registration-status',headers:{host:'localhost:3830',authorization:'Bearer '+approvedCredential}})).statusCode,200);
  const needRevoke=envelope('revokeConnector',{connectorRef:ac.connectorRef,reason:'별도 승인 회수 QA'},ac.connectorRef.id,1);assert.equal((await human(needRevoke)).statusCode,412);const allowedRevoke=await approvedHuman(needRevoke,ac.connectorRef);assert.equal((await human(allowedRevoke)).statusCode,200);
  assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.approval_consumptions WHERE project_id=$1',[pid])).rows[0].n,3);assert.equal((await human({...allowed,commandId:randomUUID()})).statusCode,409);
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
