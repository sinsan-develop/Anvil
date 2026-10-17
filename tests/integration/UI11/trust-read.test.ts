import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {randomUUID,randomBytes,generateKeyPairSync,sign} from 'node:crypto';
import {Pool} from 'pg';
import {validateDevelopmentDbConfig} from '../../../apps/server/storage/development-config.ts';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {hashPassword} from '../../../apps/server/modules/access/service.ts';
import {ProjectPolicyRepository} from '../../../apps/server/modules/access/project-command.ts';
import {proofBytes,publicKeyFingerprint} from '../../../apps/server/modules/connections/registration-proof.ts';
import {buildApp} from '../../../apps/server/app.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {listHumanRegistrations,readHumanRegistration,newTrustBuffer,prepareTrustRegistration,freezeTrustCommand,prepareTrustAction,sendTrustCommand,prepareTrustApproval,bindTrustApproval,trustAccess} from '../../../apps/web/src/features/connections/trust-api.ts';
import {sendApprovalCommand,readApproval,prepareApprovalDecision} from '../../../apps/web/src/features/decisions/api.ts';

// HUMAN GET이 옛 receipt를 반환하거나 다른 주체/Secret을 노출하면 실패한다.
test('HUMAN 신뢰 조회는 현재 ref·지문·격리·기한·cursor·GET 무부작용에 결박된다',async()=>{
 if(!process.env.ANVIL_DB_CONFIG||!process.env.ANVIL_MIGRATOR_CONFIG)throw Error('ACTUAL_PROTECTED_DB_REQUIRED_NOT_SKIP');
 const pool=new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG,'utf8')),'app'));
 const admin=new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_MIGRATOR_CONFIG,'utf8')),'migrator'));
 const uid=randomUUID(),pid=randomUUID(),ownedUsers:string[]=[];let userCreated=false,projectCreated=false;
 const access=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)}),policies=new ProjectPolicyRepository(access),app=buildApp({},undefined,{repository:access,origin:'https://localhost:3830'});
 try{
  const password=randomBytes(32).toString('base64url'),phc=await hashPassword(password);
  await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'challenge 숫자 계약 QA','ACTIVE')",[uid,'qa-connector-trust-'+uid]);userCreated=true;ownedUsers.push(uid);
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
  const path='/api/v1/projects/'+pid+'/connector-registrations',headers={host:'localhost:3830',cookie:'__Host-anvil.sid='+own.token};
  const get=(suffix='',extra:Record<string,string>={})=>app.inject({method:'GET',url:path+suffix,headers:{...headers,...extra}});
  let dropOperation:string|null=null;const sentBodies:string[]=[];
  const client=new ApiClient(async(url,init)=>{assert.equal(init?.credentials,'same-origin');assert.equal(new Headers(init?.headers).has('authorization'),false);const method=init?.method==='POST'?'POST':'GET',body=method==='POST'?JSON.parse(init!.body as string):null;const response=await app.inject({method,url:String(url),headers:{...headers,origin:'https://localhost:3830',...(method==='POST'?{'content-type':'application/json','x-anvil-csrf':own.csrfToken,'idempotency-key':body.commandId}:{})},...(body?{payload:body}:{})});if(body){sentBodies.push(init!.body as string);if(dropOperation===body.operation&&response.statusCode===200){dropOperation=null;throw Error('QA_RESPONSE_DROP_AFTER_COMMIT');}}return new Response(response.body,{status:response.statusCode,headers:{'content-type':String(response.headers['content-type'])}});});
  const footprint=async()=>{const result:Record<string,number>={};for(const table of ['commands','audit_events','connector_registration_challenges','connector_credentials'])result[table]=(await admin.query('SELECT count(*)::int n FROM anvil.'+table+' WHERE project_id=$1',[pid])).rows[0].n;return result;};
  const before=await footprint(),first=await get('/'+rid);assert.equal(first.statusCode,200);assert.equal(first.headers['cache-control'],'no-store');const initial=first.json();assert.equal(initial.state,'CREATED');assert.equal(initial.registrationRef.version,1);assert.equal(initial.basis.current,true);assert.equal(initial.confirmation.allowed,false);assert.equal(initial.expectedHostFingerprint,fingerprint);assert.deepEqual(initial.grants,[]);
  const safeKeys=(v:any)=>{for(const[k,x]of Object.entries(v)){assert.equal(/^(oneTimeCode|code_digest|token|credentialId|token_digest|privateKey|publicKeySpki|proof_signature|serverNonce|clientNonce|challenge|session_id)$/.test(k),false,'forbidden field '+k);if(x&&typeof x==='object')safeKeys(x);}};
  safeKeys(initial);assert.equal(JSON.stringify(initial).includes(created.oneTimeCode),false);assert.deepEqual(await footprint(),before);
  assert.equal((await readHumanRegistration(client,pid,rid)).state,'CREATED');assert.equal((await listHumanRegistrations(client,pid)).items[0]!.registrationRef.id,rid);assert.deepEqual(await footprint(),before);
  for(const q of ['?limit=201','?limit=1&limit=2','?cursor=','?cursor=bad','?state=CREATED'])assert.equal((await get(q)).statusCode,400);
  assert.equal((await app.inject({method:'GET',url:path+'/'+rid,headers:{host:'localhost:3830'}})).statusCode,401);
  assert.equal((await get('/'+randomUUID())).statusCode,404);assert.equal((await get('/'+rid+'?unexpected=1')).statusCode,400);
  const other=await access.login('qa-connector-trust-'+uid,password,'다른 client','qa-other-'+uid);
  assert.equal((await get('/'+rid,{cookie:'__Host-anvil.sid='+other.token})).statusCode,404);
  const secondResponse=await human(envelope('registerConnector',{kind:'HOST_TRUST_REGISTRATION',hostLabel:'페이지 다음 QA',expectedHostFingerprint:fingerprint,policyRef:policy.data.ref,expiresAt:deadline,reason:'cursor 대조'}));assert.equal(secondResponse.statusCode,200);
  const page=await get('?limit=1');assert.equal(page.statusCode,200);assert.equal(page.json().items.length,1);assert.equal(page.json().hasMore,true);const cursor=page.json().nextCursor;
  assert.equal((await get('?limit=1&cursor='+encodeURIComponent(cursor))).json().items.length,1);
  assert.equal((await get('?limit=2&cursor='+encodeURIComponent(cursor))).statusCode,400);
  assert.equal((await get('?limit=1&cursor='+encodeURIComponent(cursor+'x'))).statusCode,400);
  const expiredPayload=JSON.parse(Buffer.from(cursor.split('.')[0],'base64url').toString('utf8'));expiredPayload.expiresAt=Date.now()-1;const expiredText=Buffer.from(JSON.stringify(expiredPayload)).toString('base64url'),expiredCursor=expiredText+'.'+access.signProjectCursor('HOST_TRUST_REGISTRATIONS:'+expiredText);assert.equal((await get('?limit=1&cursor='+encodeURIComponent(expiredCursor))).statusCode,400);
  const outsiderId=randomUUID();await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'격리 HUMAN QA','ACTIVE')",[outsiderId,'qa-connector-trust-'+outsiderId]);ownedUsers.push(outsiderId);await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)',[outsiderId,phc]);const outsider=await access.login('qa-connector-trust-'+outsiderId,password,'타인 QA','qa-connector-trust-'+outsiderId);assert.equal((await get('/'+rid,{cookie:'__Host-anvil.sid='+outsider.token})).statusCode,404);
  const otherPid=randomUUID();await admin.query("INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,'교차 조회 거절 QA','조회0','보존')",[otherPid]);try{assert.equal((await app.inject({method:'GET',url:'/api/v1/projects/'+otherPid+'/connector-registrations/'+rid,headers})).statusCode,404);}finally{await admin.query('DELETE FROM anvil.projects WHERE id=$1',[otherPid]);}
  const enrolled=await post('/api/v1/connectors/enroll',{registrationId:rid,oneTimeCode:created.oneTimeCode,observedHostFingerprint:fingerprint,clientNonce:randomBytes(32).toString('base64url'),connectorVersion:'synthetic-qa-1',publicKeySpki:spki});assert.equal(enrolled.statusCode,200);const ch=enrolled.json().challenge;
  const signature=(value:any)=>sign('sha256',proofBytes(value),{key:host.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url'),prefix='/api/v1/connectors/registrations/'+rid;
  const proved=await post(prefix+'/proof',{challengeId:ch.id,payload:ch.payload,signature:signature(ch.payload)});assert.equal(proved.statusCode,200);const proof=proved.json();
  const proofRead=await get('/'+rid);assert.equal(proofRead.statusCode,200);assert.equal(proofRead.json().state,'PROVED_WAITING_CONFIRMATION');assert.equal(proofRead.json().registrationRef.version,proof.registrationRef.version);assert.equal(proofRead.json().observedHostFingerprint,fingerprint);assert.equal(proofRead.json().confirmation.allowed,true);safeKeys(proofRead.json());assert.equal((await readHumanRegistration(client,pid,rid)).confirmation.allowed,true);
  assert.equal((await human(envelope('confirmConnectorRegistration',{registrationId:rid,observedHostFingerprint:fingerprint,scopeDigest:proof.scopeDigest,decision:'APPROVE',reason:'정확 숫자1 정상 경로'},rid,proof.registrationRef.version))).statusCode,200);
  const preflight={...ch.payload,clientNonce:randomBytes(32).toString('base64url'),expiresAt:deadline},exchange=await post(prefix+'/exchange',{kind:'CHALLENGE',payload:preflight,signature:signature(preflight)});assert.equal(exchange.statusCode,200);const fresh=exchange.json().challenge;
  const issue={kind:'ISSUE',challengeId:fresh.id,payload:fresh.payload,signature:signature(fresh.payload)},issued=await post(prefix+'/exchange',issue);assert.equal(issued.statusCode,200);assert.deepEqual(issued.json().grants,[]);
  assert.equal((await post(prefix+'/exchange',issue)).statusCode,409);const status=await app.inject({method:'GET',url:'/api/v1/connectors/'+created.connectorRef.id+'/registration-status',headers:{host:'localhost:3830',authorization:'Bearer '+issued.json().credential}});assert.equal(status.statusCode,200);assert.equal(status.json().executionAuthorized,false);
  const issuedRead=await get('/'+rid);assert.equal(issuedRead.statusCode,200);assert.equal(issuedRead.json().state,'ISSUED');assert.equal(issuedRead.json().credential.issued,true);safeKeys(issuedRead.json());assert.equal(JSON.stringify(issuedRead.json()).includes(issued.json().credential),false);assert.equal((await readHumanRegistration(client,pid,rid)).credential.status,'ACTIVE_STATUS_ONLY');
  assert.equal((await human(envelope('revokeConnector',{connectorRef:created.connectorRef,reason:'숫자 계약 QA 회수'},created.connectorRef.id,1))).statusCode,200);
  assert.equal((await get('/'+rid)).json().state,'REVOKED');assert.equal((await get('/'+rid)).json().confirmation.allowed,false);
  await admin.query('UPDATE anvil.project_control SET generation=2 WHERE project_id=$1',[pid]);const stale=await get('/'+rid);assert.equal(stale.statusCode,200);assert.equal(stale.json().basis.current,false);await admin.query('UPDATE anvil.project_control SET generation=1 WHERE project_id=$1',[pid]);
  await admin.query('UPDATE anvil.project_control SET revoked_at=clock_timestamp() WHERE project_id=$1',[pid]);assert.equal((await get('/'+rid)).statusCode,403);await admin.query('UPDATE anvil.project_control SET revoked_at=NULL WHERE project_id=$1',[pid]);
  const oldScope=(await admin.query('SELECT scope_json FROM anvil.connector_registrations WHERE id=$1',[rid])).rows[0].scope_json;
  await admin.query("UPDATE anvil.connector_registrations SET scope_json=jsonb_set(scope_json,'{hostLabel}','\"tampered\"'::jsonb) WHERE id=$1",[rid]);assert.equal((await get('/'+rid)).statusCode,503);await admin.query('UPDATE anvil.connector_registrations SET scope_json=$2 WHERE id=$1',[rid,JSON.stringify(oldScope)]);
  const missingConfirmRules=[{ruleId:'TRUST',subjectRef:{kind:'HUMAN',userId:uid},operations:['registerConnector','revokeConnector'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:new Date(Date.now()+600000).toISOString()}];
  const limited:any=await policies.command(own.token,own.csrfToken,envelope('savePermissionPolicy',{rules:missingConfirmRules,reason:'확인 허가가 없는 조회 QA',reviewRefs:[]},policy.data.ref.id,policy.data.ref.version));
  assert.equal((await get('/'+rid)).json().basis.current,false);assert.equal((await get('?limit=1&cursor='+encodeURIComponent(cursor))).statusCode,400);
  const limitedMade=await human(envelope('registerConnector',{kind:'HOST_TRUST_REGISTRATION',hostLabel:'확인 권한 없는 host',expectedHostFingerprint:fingerprint,policyRef:limited.data.ref,expiresAt:new Date(Date.now()+90000).toISOString(),reason:'읽기를 확인허가로 승격하지 않음'}));assert.equal(limitedMade.statusCode,200);const ld=limitedMade.json().data;
  const le=await post('/api/v1/connectors/enroll',{registrationId:ld.registrationRef.id,oneTimeCode:ld.oneTimeCode,observedHostFingerprint:fingerprint,clientNonce:randomBytes(32).toString('base64url'),connectorVersion:'synthetic-qa-1',publicKeySpki:spki});assert.equal(le.statusCode,200);const lc=le.json().challenge;assert.equal((await post('/api/v1/connectors/registrations/'+ld.registrationRef.id+'/proof',{challengeId:lc.id,payload:lc.payload,signature:signature(lc.payload)})).statusCode,200);
  const limitedRead=await get('/'+ld.registrationRef.id);assert.equal(limitedRead.statusCode,200);assert.equal(limitedRead.json().basis.current,true);assert.equal(limitedRead.json().confirmation.allowed,false,'조회만 허용된 proof를 확인 가능으로 승격하지 않는다');
  const denyRules=[{...missingConfirmRules[0]!,disposition:'DENY'}],denied:any=await policies.command(own.token,own.csrfToken,envelope('savePermissionPolicy',{rules:denyRules,reason:'현재 TRUST 거절',reviewRefs:[]},limited.data.ref.id,limited.data.ref.version));assert.equal((await get()).statusCode,403);assert.equal((await get('/'+rid)).statusCode,403);
  const expiresAt=new Date(Date.now()+1100).toISOString(),shortRules=[{...missingConfirmRules[0]!,expiresAt}],short:any=await policies.command(own.token,own.csrfToken,envelope('savePermissionPolicy',{rules:shortRules,reason:'짧은 실제 조회 허가',reviewRefs:[]},denied.data.ref.id,denied.data.ref.version));assert.ok(short.data.ref);assert.equal((await get()).statusCode,200);await new Promise(resolve=>setTimeout(resolve,Math.max(0,Date.parse(expiresAt)-Date.now())+25));assert.equal((await get()).statusCode,403);
  // UI11과 UI08의 실제 같은 Web 함수로 세 HUMAN 연산의 각각 별도 승인/소비를 연결한다.
  const session={user:{id:uid},clientId:own.clientId,csrfToken:own.csrfToken},longDeadline=new Date(Date.now()+600000).toISOString();
  const approvalRules=[{...missingConfirmRules[0]!,operations:['registerConnector','confirmConnectorRegistration','revokeConnector'],disposition:'REQUIRE_APPROVAL',expiresAt:longDeadline},{...missingConfirmRules[0]!,ruleId:'DECISIONS',operations:['requestApproval','decideApproval'],disposition:'AUTO',expiresAt:longDeadline}];
  const full:any=await policies.command(own.token,own.csrfToken,envelope('savePermissionPolicy',{rules:approvalRules,reason:'실제 Web 신뢰3연산 각각 승인',reviewRefs:[]},short.data.ref.id,short.data.ref.version));
  const approve=async(b:ReturnType<typeof newTrustBuffer>)=>{
   const request=await prepareTrustApproval(b,session,{reason:'고정 신뢰 명령만',risks:{data:'합성 자료만',security:'등록상태 조회만',cost:'외부 비용0',interruption:'서비스 중단0',unverified:'실PC/Agent 미검증'},rollback:{method:'등록 명시회수·UUID 정리',limitations:'코드/credential 재조회 불가',evidenceRefs:[]},expiresAt:b.actionExpiresAt!});
   const saved=await sendApprovalCommand(client,request,session),view=await readApproval(client,pid,saved.targetId),decision=await prepareApprovalDecision(pid,view,'APPROVE','범위/기한을 명시 확인',session,1);await sendApprovalCommand(client,decision,session);return bindTrustApproval(client,b,session,view.request.id);
  };
  const a=await trustAccess(client,pid,session,'registerConnector');assert.equal(a.approvalRequired,true);
  let work=newTrustBuffer(pid,session,a.generation);work.draft={hostLabel:'같은 Web 신뢰 QA',expectedHostFingerprint:fingerprint,expiresAt:new Date(Date.now()+90000).toISOString(),reason:'화면 함수의 별도 승인'};const registerCommand=await prepareTrustRegistration(work,session,full.data.ref);await freezeTrustCommand(work,session,registerCommand,null,full.data.ref,work.draft.expiresAt);
  await assert.rejects(sendTrustCommand(client,work,session),{code:'APPROVAL_REQUIRED',status:412});work=await approve(work);
  const registered=await sendTrustCommand(client,work,session);assert.equal(typeof registered.oneTimeCode,'string');assert.equal('oneTimeCode'in work,false);const webRid=registered.receipt.registrationRef.id;
  const webEnrolled=await post('/api/v1/connectors/enroll',{registrationId:webRid,oneTimeCode:registered.oneTimeCode,observedHostFingerprint:fingerprint,clientNonce:randomBytes(32).toString('base64url'),connectorVersion:'synthetic-qa-1',publicKeySpki:spki});assert.equal(webEnrolled.statusCode,200);const webChallenge=webEnrolled.json().challenge;assert.equal((await post('/api/v1/connectors/registrations/'+webRid+'/proof',{challengeId:webChallenge.id,payload:webChallenge.payload,signature:signature(webChallenge.payload)})).statusCode,200);
  const displayed=await readHumanRegistration(client,pid,webRid),staleDisplay={...displayed,registrationRef:{...displayed.registrationRef,version:99}},staleWork=newTrustBuffer(pid,session,1);await assert.rejects(prepareTrustAction(client,staleWork,session,webRid,'confirmConnectorRegistration','APPROVE','옛 화면 거절',staleDisplay),{code:'CONNECTOR_VERSION_CONFLICT',status:409});assert.equal(staleWork.pending,null);
  let confirmation=newTrustBuffer(pid,session,1);await prepareTrustAction(client,confirmation,session,webRid,'confirmConnectorRegistration','APPROVE','서버 현재 지문/범위 확인',displayed);confirmation=await approve(confirmation);assert.equal((await sendTrustCommand(client,confirmation,session)).receipt.status,'CONFIRMED');
  let revocation=newTrustBuffer(pid,session,1);await prepareTrustAction(client,revocation,session,webRid,'revokeConnector','REJECT','별도 현재 회수');revocation=await approve(revocation);dropOperation='revokeConnector';const beforeReplay=sentBodies.length;
  await assert.rejects(sendTrustCommand(client,revocation,session),{code:'CONNECTION_LOST'});revocation.uncertain=true;assert.equal((await sendTrustCommand(client,revocation,session)).receipt.status,'REVOKED');assert.equal(sentBodies[beforeReplay],sentBodies[beforeReplay+1]);assert.equal((await readHumanRegistration(client,pid,webRid)).state,'REVOKED');
  assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.approval_consumptions WHERE project_id=$1',[pid])).rows[0].n,3);
  assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.delivery_outbox WHERE project_id=$1',[pid])).rows[0].n,0);

 }finally{
  await app.close();const db=await admin.connect();try{
   await db.query('BEGIN');await db.query('SET CONSTRAINTS ALL DEFERRED');
   if(projectCreated){
    await db.query('UPDATE anvil.authorization_receipts SET approval_decision_ref=NULL WHERE scope_id=$1',[pid]);await db.query('UPDATE anvil.commands SET authorization_receipt_id=NULL,approval_consumption_id=NULL WHERE project_id=$1',[pid]);
    for(const table of ['connector_credentials','connector_registration_challenges','connector_registrations','connectors','audit_events','approval_consumptions','approval_decisions','approval_requests'])await db.query('DELETE FROM anvil.'+table+' WHERE project_id=$1',[pid]);
    await db.query('UPDATE anvil.permission_policies SET head_version=head_version+1 WHERE project_id=$1',[pid]);for(const table of ['permission_policy_versions','permission_policies'])await db.query('DELETE FROM anvil.'+table+' WHERE project_id=$1',[pid]);
    await db.query('DELETE FROM anvil.authorization_receipts WHERE scope_id=$1',[pid]);for(const table of ['commands','project_control','project_members'])await db.query('DELETE FROM anvil.'+table+' WHERE project_id=$1',[pid]);await db.query('DELETE FROM anvil.projects WHERE id=$1',[pid]);
   }
   if(userCreated){await db.query('DELETE FROM anvil.auth_audit_events WHERE subject_ref=ANY($1::uuid[])',[ownedUsers]);for(const table of ['auth_sessions','clients','password_credentials'])await db.query('DELETE FROM anvil.'+table+' WHERE user_id=ANY($1::uuid[])',[ownedUsers]);await db.query('DELETE FROM anvil.users WHERE id=ANY($1::uuid[])',[ownedUsers]);}
   await db.query('COMMIT');
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();await pool.end();await admin.end();}
 }
});
