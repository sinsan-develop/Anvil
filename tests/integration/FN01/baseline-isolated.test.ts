// 미실행 후보. 실제 B 승인/실행 binding이 없으면 실패하고 SKIP/PASS로 바꾸지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, lstat, realpath, readdir, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import type { FileProof } from '../../../scripts/fn01-baseline-qa-guard.ts';
import { Pool } from 'pg';
import { assertActualQaAuthorized, assertActualBWorkflowTarget, assertMigrationManifest, fixedQa, sha256, boundedWait } from '../../../scripts/fn01-baseline-qa-guard.ts';
import { qaFixture as f, requiredCases } from '../../../scripts/qa-fn01-baseline-isolated.ts';
import { buildApp } from '../../../apps/server/app.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { hashPassword } from '../../../apps/server/modules/access/service.ts';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import * as web from '../../../apps/web/src/features/project-create/baseline-api.ts';
import { buildOfficialForms } from '../../../apps/server/modules/documents/forms.ts';
import { seedOfficialForms } from '../../../apps/server/modules/documents/catalog-seed.ts';
import { buildBuiltinMethodologies } from '../../../apps/server/modules/methodologies/builtins.ts';
import { seedBuiltinMethodologies } from '../../../apps/server/modules/methodologies/catalog-seed.ts';
import type { DocumentWrite } from '../../../apps/web/src/features/design-trace/editor-api.ts';

// 잡을 결함: 실제 PG parse/COMMIT·SQL guard·Web transport·원문 저장의 연결 누락.
// 모든 HUMAN 판단은 합성 계약 fixture다. 실제 기능 내용/사용자 인수 판단이 아니다.
test('새 전용 PG49에서 기준선 불변 저장·검토/채택·권한·세대·COMMIT 경계', {timeout:180000}, async t => {
  assertActualQaAuthorized(); // Pool/파일/환경 조회보다 먼저. 고정 parent entry의 같은 B/최초창만 허용.
  const env=process.env,host=env.ANVIL_FN01_BASELINE_PG_HOST??'',nonce=env.ANVIL_FN01_BASELINE_NONCE??'',deadline=Date.parse(env.ANVIL_FN01_BASELINE_EXPIRES_AT??'');
  assertActualBWorkflowTarget(nonce,deadline); // env가 새 nonce/기한을 발급하거나 바꿀 수 없다.
  if(process.platform!=='linux'||process.getuid?.()!==1000||!/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)||host.split('.').some(v=>Number(v)>255)||!/^[0-9a-f]{32}$/.test(nonce)||!Number.isFinite(deadline)||deadline<=Date.now()||deadline>Date.now()+1200000||env.ANVIL_DB_CONFIG||env.ANVIL_MIGRATOR_CONFIG)throw Error('FN01_WORKFLOW_TARGET_INVALID');
  assert.equal(await realpath(process.cwd()),fixedQa.root+'/source');assert.equal(await realpath(process.execPath),fixedQa.node);
  const manifest:unknown=JSON.parse(await readFile('docs/work_packages/FN01_BASELINE_PG_MIGRATION_MANIFEST.json','utf8'));assertMigrationManifest(manifest);
  assert.equal(sha256(await readFile('package-lock.json')),fixedQa.lockHash);
  for(const row of manifest.ordered)assert.equal(sha256(await readFile('db/migrations/'+row.id+'.sql')),row.sha256);
  const artifactRoot=fixedQa.root+'/artifacts',st=await lstat(artifactRoot);assert(st.isDirectory()&&!st.isSymbolicLink()&&st.uid===1000&&(st.mode&0o777)===0o700);assert.equal(await realpath(artifactRoot),artifactRoot);
  assert.deepEqual(await readdir(artifactRoot),[]); // bootstrap의 빈 전용 root만 소비.
  const appPassword=env.ANVIL_FN01_BASELINE_APP_PASSWORD??'',migratorPassword=env.ANVIL_FN01_BASELINE_MIGRATOR_PASSWORD??'';
  if(!/^[0-9a-f]{64}$/.test(appPassword)||!/^[0-9a-f]{64}$/.test(migratorPassword))throw Error('FN01_WORKFLOW_AUTH_INPUT_INVALID');
  const common={host,port:5432,database:fixedQa.database,connectionTimeoutMillis:5000,query_timeout:10000,statement_timeout:10000,lock_timeout:1000,max:4,application_name:'anvil-v3-fn01-baseline-qa-01'};
  const pool=new Pool({...common,user:'anvil_v3_app',password:appPassword}),admin=new Pool({...common,user:'anvil_v3_migrator',password:migratorPassword});
  const access=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)}),origin='https://fn01.invalid:3830',app=buildApp({},undefined,{repository:access,origin,artifactRoot});
  let phase='TARGET',failure:string|null=null,closeFailures=0;const cases:string[]=[];
  const ownedFiles=new Map<string,FileProof>();
  // 성공 영수증에 결박된 업로드만 즉시 관측한다. 실패 후 스캔으로 임의 파일을 소유 채택하지 않는다.
  async function recordArtifact(ref:{artifactId:string;contentHash:string;bytes:number}):Promise<void> {
    assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(ref.artifactId));
    for(const path of [artifactRoot+'/staging',artifactRoot+'/staging/'+f.project,artifactRoot+'/blobs',artifactRoot+'/blobs/'+f.project,artifactRoot+'/blobs/'+f.project+'/'+ref.artifactId]){
      const s=await lstat(path);assert(!s.isSymbolicLink()&&s.uid===1000&&(s.mode&0o077)===0&&s.dev===st.dev);assert.equal(await realpath(path),path);
      let hash:string|null=null;
      if(s.isFile()){assert.equal(s.nlink,1);assert.equal(s.size,ref.bytes);const h=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const opened=await h.stat();assert.equal(opened.ino,s.ino);assert.equal(opened.dev,s.dev);hash=sha256(await h.readFile());assert.equal(hash,ref.contentHash);}finally{await h.close();}}else assert(s.isDirectory());
      const item:FileProof={path,kind:s.isFile()?'FILE':'DIRECTORY',uid:s.uid,mode:s.mode&0o777,dev:s.dev,ino:s.ino,links:s.nlink,hash};const old=ownedFiles.get(path);if(old)assert.deepEqual({...item,links:old.links},old);ownedFiles.set(path,item);
    }
  }
  const fresh=()=>{if(t.signal.aborted||Date.now()>=deadline-20000)throw Error('FN01_WORKFLOW_EXPIRED');};
  const sql=async(text:string,values:unknown[]=[])=>{fresh();return admin.query(text,values);};
  try {
    for(const [db,role] of [[pool,'anvil_v3_app'],[admin,'anvil_v3_migrator']] as const){fresh();const r=(await db.query('SELECT current_database() db,current_user role,host(inet_server_addr()) ip,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];assert.equal(r.db,fixedQa.database);assert.equal(r.role,role);assert.equal(r.ip,host);assert.equal(r.rolsuper,false);assert.equal(r.rolcreatedb,false);assert.equal(r.rolcreaterole,false);assert.equal(r.rolbypassrls,false);}
    const migrations=(await sql('SELECT id,checksum FROM anvil.schema_migrations ORDER BY id')).rows;
    assert.equal(migrations.length,49);for(const row of manifest.ordered)assert.equal(migrations.find(r=>r.id===row.id)?.checksum,row.sha256);
    assert.equal((await sql("SELECT to_regclass('anvil.context_bundles') r")).rows[0].r,null);cases.push('EXACT_49_SCHEMA');
    const legacy=(await sql('SELECT * FROM anvil.project_baselines WHERE id=$1',[f.legacy])).rows[0];
    assert.equal(legacy.project_id,f.project);assert.equal(Number(legacy.version),1);assert.equal(legacy.source_snapshot_ref,f.snapshot);assert.equal(legacy.content_hash,sha256('{"legacy":true}'));assert.deepEqual(legacy.content_json,{legacy:true});assert.equal(legacy.created_by,f.user);assert.equal(legacy.created_at.toISOString(),'2026-10-18T00:00:00.000Z');
    for(const name of ['baseline_kind','draft_id','draft_version','command_id','client_id','source_snapshot_version','source_snapshot_hash'])assert.equal(legacy[name],null);
    assert.equal((await sql('SELECT count(*)::int n FROM anvil.baseline_heads')).rows[0].n,0);
    phase='CATALOG';const catalog=buildOfficialForms(await readFile('docs/design/공식산출물_양식정의.md'),await readFile('docs/design/문서작성_공통기준.md')),methods=buildBuiltinMethodologies(await readFile('docs/design/기본방법론_상세검토안.md'),catalog.forms),seed=await admin.connect();
    const fenced=new Proxy(seed,{get(target,key){if(key==='query')return(...args:any[])=>{fresh();return Reflect.apply(target.query,target,args);};return Reflect.get(target,key,target);}});
    try{fresh();await fenced.query('BEGIN');await seedOfficialForms(fenced,catalog);await seedBuiltinMethodologies(fenced,methods,catalog.forms);fresh();await fenced.query('COMMIT');}catch(e){await seed.query('ROLLBACK');throw e;}finally{seed.release();}
    phase='SEED';const password=randomBytes(32).toString('base64url'),phc=await hashPassword(password);
    await sql("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,'qa-fn01-baseline-outsider','qa-fn01-baseline-outsider','격리 다른 사용자','ACTIVE')",[f.outsider]);
    await sql('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$3,1),($2,$3,1)',[f.user,f.outsider,phc]);
    await sql("INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,'다른 프로젝트','교차 경계','접근 차단')",[f.otherProject]);await sql("INSERT INTO anvil.project_members(project_id,user_id,participation) VALUES($1,$2,'OWNER')",[f.otherProject,f.outsider]);
    fresh();let login=await access.login('qa-fn01-baseline-owner',password,'기준선 합성 PC','fn01-baseline-owner-01');fresh();const outside=await access.login('qa-fn01-baseline-outsider',password,'격리 다른 PC','fn01-baseline-outsider-01');
    await sql('INSERT INTO anvil.project_control(project_id,actor_id,client_id,generation) VALUES($1,$2,$3,1)',[f.project,f.user,login.clientId]);fresh();login=await access.reauthenticate(login.token,login.csrfToken,password,'fn01-baseline-owner-01');
    let generation=1;
    const session=()=>({user:{id:f.user},clientId:login.clientId,csrfToken:login.csrfToken});
    const headers=()=>({host:'fn01.invalid:3830',origin,cookie:'__Host-anvil.sid='+login.token,'x-anvil-csrf':login.csrfToken});
    const client=new ApiClient(async(url,init)=>{fresh();const path=String(url);assert(path.startsWith('/api/v1/')&&!path.includes('/context'));const body=init?.body;const payload=body==null?undefined:body instanceof Uint8Array?Buffer.from(body):body instanceof Blob?Buffer.from(await body.arrayBuffer()):typeof body==='string'?body:(()=>{throw Error('FN01_BODY_INVALID');})();fresh();const response=await app.inject({method:(init?.method??'GET') as any,url:path,headers:{...headers(),...init?.headers as Record<string,string>},payload});return new Response(response.body,{status:response.statusCode,headers:{'content-type':String(response.headers['content-type']??'')}});});
    const command=(operation:string,payload:any,targetId:string|null=null,expectedVersion=0):DocumentWrite=>({schemaVersion:1,projectId:f.project,commandId:randomUUID(),clientId:login.clientId,controlGeneration:generation,operation:operation as DocumentWrite['operation'],targetId,expectedVersion,baselineRefs:[],approvalRef:null,payload});
    const send=async(c:DocumentWrite)=>{fresh();return app.inject({method:'POST',url:`/api/v1/projects/${f.project}/commands`,headers:headers(),payload:c});};
    const operations=['uploadArtifact','saveBaselineDraft','reviewBaselineContent','confirmBaseline'];let policyRef:{id:string;version:number}|null=null;
    async function policy(disposition:'AUTO'|'DENY',expiresAt=new Date(deadline).toISOString()) {const r=await send(command('savePermissionPolicy',{rules:[{ruleId:'FN01_SYNTHETIC',subjectRef:{kind:'HUMAN',userId:f.user},operations,targetScopes:[{kind:'PROJECT',projectId:f.project}],disposition,limitPolicyRef:null,expiresAt}],reason:'새 격리 기계경계 합성 허가만',reviewRefs:[]},policyRef?.id??null,policyRef?.version??0));assert.equal(r.statusCode,200);policyRef=r.json().data.ref;}
    const input: web.BaselineDraftInput={baseRef:null,source:{kind:'NONE_SELECTED',declarationRef:null,sourceRootRef:null,snapshotRef:null,grantRef:null,unverifiedReason:'원 소스 관측하지 않음'},items:[{itemId:'B1',title:'합성 저장 경계',designRef:null,featureState:'PARTIAL',evidenceRefs:[],limitations:'실제 기능 내용과 전체 범위 미검증',reason:'계약 검증용 fixture'}],coverageReason:'전체 기능 판단 아님',reason:'격리 합성 기준 기록'};
    let buffer=web.newBaselineBuffer(f.project,session(),generation,null);buffer.input=structuredClone(input);
    const noPolicy=await send(web.prepareBaselineCommand(buffer,session(),'saveBaselineDraft'));assert.equal(noPolicy.statusCode,412);assert.equal(noPolicy.json().code,'PERMISSION_POLICY_UNCONFIGURED');await policy('AUTO');cases.push('AUTH_POLICY_REQUIRED');
    phase='UPLOAD';buffer=await web.sendBaselineUpload(client,await web.prepareBaselineUpload(buffer,session(),'B1',new TextEncoder().encode('합성 실제 API 저장/재조회 증거, 사용자 인수 아님'),'text/plain;charset=utf-8'),session());
    const evidence=buffer.input.items[0]!.evidenceRefs[0]!;await recordArtifact(evidence);assert.equal(sha256(await web.readBaselineEvidence(client,f.project,evidence)),evidence.contentHash);
    phase='DRAFT';const save=web.prepareBaselineCommand(buffer,session(),'saveBaselineDraft');
    let firstReceipt:any=null,lost=true;const unreliable=new ApiClient(async(url,init)=>{const response=await client.transport.call(globalThis,url,init);if(lost){assert.equal(response.status,200);firstReceipt=await response.clone().json();lost=false;throw Error('SYNTHETIC_RESPONSE_LOSS');}return response;});
    await assert.rejects(web.sendBaselineCommand(unreliable,save,session()));assert(firstReceipt);assert.equal(firstReceipt.commandId,save.commandId);
    const originalReceiptSql="SELECT c.id command_row_id,c.result_ref,v.draft_id,v.version,v.content_hash,v.version_json,v.command_id FROM anvil.commands c JOIN anvil.baseline_draft_versions v ON v.command_id=c.id AND v.project_id=c.project_id WHERE c.project_id=$1 AND c.actor_id=$2 AND c.command_id=$3 AND c.operation='saveBaselineDraft'";
    // 재시도 전에 실제 COMMIT된 영수증/불변행을 독립 조회한다. 뒤늦은 저장으로 대체하지 않는다.
    const beforeRetry=(await sql(originalReceiptSql,[f.project,f.user,save.commandId])).rows;assert.equal(beforeRetry.length,1);const original=beforeRetry[0]!;
    assert.deepEqual(original.result_ref,firstReceipt);assert.equal(original.command_id,original.command_row_id);assert.equal(original.draft_id,firstReceipt.data.ref.id);assert.equal(Number(original.version),1);assert.equal(original.content_hash,firstReceipt.data.ref.contentHash);assert.deepEqual(original.version_json,firstReceipt.data.snapshot);
    const saved=await web.sendBaselineCommand(client,save,session());assert.deepEqual(saved.ref,firstReceipt.data.ref);assert.deepEqual(saved.snapshot,firstReceipt.data.snapshot);assert.deepEqual((await sql(originalReceiptSql,[f.project,f.user,save.commandId])).rows,beforeRetry);assert.equal((await sql('SELECT count(*)::int n FROM anvil.baseline_draft_versions')).rows[0].n,1);cases.push('RECEIPT_LOSS_RECONCILED');
    const first=await web.readBaselineDraft(client,f.project,saved.ref);assert.deepEqual(first.snapshot,saved.snapshot);buffer=web.restoreBaselineDraft({...buffer,pending:null},session(),first);cases.push('DRAFT_STORED_READ');
    const legacyView=await web.readAdoptedBaseline(client,f.project,{id:f.legacy,version:1,contentHash:legacy.content_hash});assert.equal(legacyView.status,'LEGACY_UNVERIFIED');assert.equal(legacyView.ref,null);assert.equal(legacyView.snapshot,null);assert.equal(legacyView.contentConfirmed,false);assert.equal(legacyView.currentCheck.state,'UNAVAILABLE');assert.equal((await web.readCurrentBaseline(client,f.project)).status,'UNCONFIRMED');cases.push('LEGACY_PRESERVED');
    async function review(b:web.BaselineBuffer,outcome:'ACCEPTED'|'REWORK'='ACCEPTED'){const v=web.beginBaselineReview(b,session());v.review!.items=v.review!.items.map(i=>({...i,outcome,reason:'합성 HUMAN 계약값, 실제 의미 판정 아님'}));v.review!.coverage={outcome,reason:'전수 확인을 주장하지 않는 합성 판단'};v.review!.outcome=outcome;v.review!.reason='격리 기계경계';return web.sendBaselineCommand(client,web.prepareBaselineCommand(v,session(),'reviewBaselineContent'),session());}
    async function adopt(b:web.BaselineBuffer){b.confirmation={acknowledged:true,reason:'합성 검토 후 별도 채택, 실행 허가 아님'};b.reviewDirty=false;const c=web.prepareBaselineAdoption(b,session(),await web.readBaselineDecision(client,f.project,b.saved!.ref));const r=await web.sendBaselineCommand(client,c,session());assert.deepEqual((await web.readCurrentBaseline(client,f.project)).ref,r.ref);for(const flag of ['sourceAuthorizationVerified','coverageVerified','executionAuthorized','dispatchPerformed'])assert.equal(r.snapshot[flag],false);return{result:r,command:c};}
    phase='FIRST_ADOPTION';await review(buffer);const adopted1=await adopt(buffer);assert.equal(adopted1.result.ref.version,2);cases.push('REVIEW_SEPARATE_ADOPTION');
    phase='NEW_CLIENT';const oldCommand=command('saveBaselineDraft',{...buffer.input,baseRef:saved.ref},saved.ref.id,saved.ref.version);fresh();login=await access.login('qa-fn01-baseline-owner',password,'교체 합성 PC','fn01-baseline-owner-02');fresh();login=await access.reauthenticate(login.token,login.csrfToken,password,'fn01-baseline-owner-02');generation=2;await sql('UPDATE anvil.project_control SET client_id=$2,generation=2 WHERE project_id=$1',[f.project,login.clientId]);
    const stale=await send(oldCommand);assert.equal(stale.statusCode,403);assert.equal(stale.json().code,'PROJECT_WRITE_DENIED');const staleGeneration=await send({...oldCommand,commandId:randomUUID(),clientId:login.clientId});assert.equal(staleGeneration.statusCode,409);assert.equal(staleGeneration.json().code,'CONTROL_GENERATION_CONFLICT');cases.push('OLD_GENERATION_DENIED');
    phase='SECOND_ADOPTION';buffer=web.newBaselineBuffer(f.project,session(),generation,null);buffer=web.restoreBaselineDraft(buffer,session(),await web.readBaselineDraft(client,f.project,saved.ref));buffer.input.baseRef=saved.ref;buffer.input.reason='새 기기에서 불변 개정';buffer.dirty=true;
    const second=await web.sendBaselineCommand(client,web.prepareBaselineCommand(buffer,session(),'saveBaselineDraft'),session());buffer=web.restoreBaselineDraft({...buffer,pending:null},session(),await web.readBaselineDraft(client,f.project,second.ref));await review(buffer);const adopted2=await adopt(buffer);assert.equal(adopted2.result.ref.version,3);assert.deepEqual(adopted2.result.snapshot.previousBaselineRef,adopted1.result.ref);assert.deepEqual((await web.readAdoptedBaseline(client,f.project,adopted1.result.ref)).snapshot,adopted1.result.snapshot);cases.push('SECOND_ADOPTION','CLIENT_TRANSITION');
    phase='CROSS_PROJECT';fresh();const hidden=await app.inject({method:'GET',url:`/api/v1/projects/${f.project}/baseline-current`,headers:{host:'fn01.invalid:3830',cookie:'__Host-anvil.sid='+outside.token}});assert.equal(hidden.statusCode,404);const cross=await send({...command('saveBaselineDraft',input),projectId:f.otherProject});assert.equal(cross.statusCode,404);cases.push('CROSS_PROJECT_DENIED');
    phase='DIRECT_DML';for(const q of ['INSERT INTO anvil.baseline_draft_versions SELECT * FROM anvil.baseline_draft_versions LIMIT 1','UPDATE anvil.baseline_drafts SET head_version=head_version','DELETE FROM anvil.baseline_content_reviews']){fresh();await assert.rejects(pool.query(q),(e:any)=>e.code==='42501');}cases.push('DIRECT_DML_DENIED');
    phase='DENY_REPLAY';await policy('DENY');const denied=await send(adopted2.command);assert.equal(denied.statusCode,403);assert.equal(denied.json().code,'PROJECT_OPERATION_DENIED');await policy('AUTO');cases.push('CURRENT_DENY_BEFORE_REPLAY');
    phase='REWORK';buffer.input.baseRef=second.ref;buffer.input.reason='동시 검토/채택 대상 새 초안';buffer.dirty=true;const third=await web.sendBaselineCommand(client,web.prepareBaselineCommand(buffer,session(),'saveBaselineDraft'),session());buffer=web.restoreBaselineDraft({...buffer,pending:null},session(),await web.readBaselineDraft(client,f.project,third.ref));const accepted=await review(buffer);await review(buffer,'REWORK');const blocked=await send(command('confirmBaseline',{draftRef:third.ref,reviewRefs:[accepted.ref],reason:'최신 REWORK 거절',acknowledged:true},third.ref.id,third.ref.version));assert.equal(blocked.statusCode,422);assert.equal(blocked.json().code,'BASELINE_REVIEW_REQUIRED');cases.push('REWORK_BLOCKS_ADOPTION');await review(buffer);
    buffer.confirmation={acknowledged:true,reason:'동시 CAS 기계경계'};buffer.reviewDirty=false;const concurrent=web.prepareBaselineAdoption(buffer,session(),await web.readBaselineDecision(client,f.project,third.ref));
    const reworkBuffer=web.beginBaselineReview(buffer,session());reworkBuffer.review!.items=reworkBuffer.review!.items.map(i=>({...i,outcome:'REWORK',reason:'동시 재검토 fixture'}));reworkBuffer.review!.coverage={outcome:'REWORK',reason:'동시 검토'};reworkBuffer.review!.outcome='REWORK';reworkBuffer.review!.reason='원문 재검토';const rework=web.prepareBaselineCommand(reworkBuffer,session(),'reviewBaselineContent');
    const [r,c]=await Promise.all([send(rework),send(concurrent)]);assert.equal(r.statusCode,200);assert.ok(c.statusCode===200||c.statusCode===422);
    if(c.statusCode===200){const sequences=(await sql('SELECT c.command_id,a.server_sequence FROM anvil.commands c JOIN anvil.audit_events a ON a.command_id=c.id WHERE c.command_id=ANY($1::uuid[]) AND a.outcome=\'APPLIED\'',[ [rework.commandId,concurrent.commandId] ])).rows;assert.equal(sequences.length,2);assert(BigInt(sequences.find(x=>x.command_id===concurrent.commandId).server_sequence)<BigInt(sequences.find(x=>x.command_id===rework.commandId).server_sequence));}else{assert.equal(c.json().code,'BASELINE_REVIEW_REQUIRED');assert.equal((await sql('SELECT count(*)::int n FROM anvil.project_baselines WHERE draft_id=$1 AND draft_version=$2',[third.ref.id,third.ref.version])).rows[0].n,0);}
    cases.push('CONCURRENT_CAS_AUDIT');
    phase='CORE_STATIC';const coreInput=structuredClone(input);coreInput.items[0]!.featureState='IMPLEMENTED_CORE_CHECKED';coreInput.items[0]!.evidenceRefs=[evidence];const core=await web.sendBaselineCommand(client,command('saveBaselineDraft',coreInput),session());const badReview={draftRef:core.ref,criteriaVersion:1,reviewerKind:'HUMAN',items:[{itemId:'B1',featureState:'IMPLEMENTED_CORE_CHECKED',outcome:'ACCEPTED',reason:'합성 음성',evidenceRefs:[evidence],coreEvidence:{basis:'STATIC',environment:'기계경계 fixture',checkedAt:new Date().toISOString(),normalFlow:[evidence],storageRead:[evidence],importantFailure:[evidence]}}],coverage:{outcome:'ACCEPTED',reason:'음성 fixture'},outcome:'ACCEPTED',reason:'STATIC을 실제 핵심 확인으로 승격 금지'};const bad=await send(command('reviewBaselineContent',badReview,core.ref.id,core.ref.version));assert.equal(bad.statusCode,422);assert.equal(bad.json().code,'BASELINE_REVIEW_INPUT_INVALID');cases.push('CORE_STATIC_REJECTED');
    phase='QUARANTINE';const suspect=new TextEncoder().encode('-----BEGIN PRIVATE KEY-----\nSYNTHETIC_NOT_A_KEY\n-----END PRIVATE KEY-----');let qb=web.newBaselineBuffer(f.project,session(),generation,null);qb.input=structuredClone(input);qb=await web.prepareBaselineUpload(qb,session(),'B1',suspect,'text/plain;charset=utf-8');
    fresh();const qr=await app.inject({method:'POST',url:`/api/v1/projects/${f.project}/files`,headers:{...headers(),'content-type':'application/octet-stream','x-anvil-command':JSON.stringify(qb.pending)},payload:Buffer.from(suspect)});
    assert.equal(qr.statusCode,201);assert.equal(qr.json().data.status,'ARTIFACT_QUARANTINED');const quarantined=qr.json().data.artifactRef;await recordArtifact(quarantined);const qi=structuredClone(input);qi.items[0]!.evidenceRefs=[quarantined];const reuse=await send(command('saveBaselineDraft',qi));assert.equal(reuse.statusCode,412);assert.equal(reuse.json().code,'ARTIFACT_QUARANTINED');await assert.rejects(web.readBaselineEvidence(client,f.project,quarantined));cases.push('QUARANTINE_BLOCKS_REUSE');
    assert.deepEqual((await sql('SELECT * FROM anvil.project_baselines WHERE id=$1',[f.legacy])).rows[0],legacy);assert(requiredCases.every(c=>cases.includes(c)));phase='DONE';
  } catch {failure='FN01_WORKFLOW_FAILED';throw Error('FN01_WORKFLOW_FAILED');}
  finally {
    // 각각 독립적으로 종료를 시도한다. timeout은 미종료이며 부모의 파괴 회수 허가가 아니다.
    await Promise.all([()=>app.close(),()=>pool.end(),()=>admin.end()].map(async close=>{try{await boundedWait(5000,()=>close());}catch{closeFailures++;}}));
    t.diagnostic('FN01_BASELINE_SAFE '+JSON.stringify({phase,cases,failure,closeFailures,files:[...ownedFiles.values()],sourceAuthorizationVerified:false,coverageVerified:false,executionAuthorized:false,dispatchPerformed:false,servedBrowserVerified:false}));
    if(closeFailures)throw Error('FN01_WORKFLOW_CLOSE_FAILED');
  }
});
