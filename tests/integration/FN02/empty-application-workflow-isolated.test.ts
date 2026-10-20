import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,realpath} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {hashPassword} from '../../../apps/server/modules/access/service.ts';
import {currentProjectController,authorizeMaterial,persistProjectReceipt,type ProjectCommand} from '../../../apps/server/modules/access/project-command.ts';
import {buildApp} from '../../../apps/server/app.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {buildOfficialForms} from '../../../apps/server/modules/documents/forms.ts';
import {seedOfficialForms} from '../../../apps/server/modules/documents/catalog-seed.ts';
import {buildBuiltinMethodologies} from '../../../apps/server/modules/methodologies/builtins.ts';
import {methodContentReviewCriteria} from '../../../apps/server/modules/methodologies/content-review.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {readMethodApplicationRef} from '../../../apps/web/src/features/methodology-editor/project-api.ts';
import {fenceResultQaPool} from '../FN12/result-qa-fence.ts';

// 새 빈 QA DB에서 실제 인증/API/저장/COMMIT을 검수할 준비 코드다. 정식 DB/config fallback은 없다.
test('확정 방법론의 빈 프로젝트 명시 적용·replay·불변 이력·orphan COMMIT을 실제 격리에서 검수한다',{timeout:90000},async t=>{
 const until=Date.parse(process.env.ANVIL_FN02_QA_UNTIL??''),sha=process.env.ANVIL_FN02_QA_SHA??'',host=process.env.ANVIL_FN02_QA_HOST??'',password=process.env.ANVIL_FN02_QA_APP??'',migratorPassword=process.env.ANVIL_FN02_QA_MIGRATOR??'';
 if(process.platform!=='linux'||process.getuid?.()!==1000||await realpath(process.cwd())!=='/home/daon/deploy/anvil-v3-fn02-empty-application-qa-01'
  ||!/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)||!/^[0-9a-f]{64}$/.test(password)||!/^[0-9a-f]{64}$/.test(migratorPassword)
  ||!Number.isFinite(until)||until<=Date.now()||until>Date.now()+600000||!/^[0-9a-f]{40}$/.test(sha)
  ||execFileSync('/usr/bin/git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==sha||process.env.ANVIL_DB_CONFIG||process.env.ANVIL_MIGRATOR_CONFIG)throw Error('FN02_EXACT_WORKFLOW_QA_REQUIRED');
 const fresh=()=>assert(!t.signal.aborted&&Date.now()<until,'FN02_QA_EXPIRED');
 const config={host,port:5432,database:'anvil_v3_fn02_empty_application_qa_01',connectionTimeoutMillis:3000,statement_timeout:5000};
 const pool=fenceResultQaPool(new Pool({...config,user:'anvil_v3_app',password,max:3}),fresh),admin=fenceResultQaPool(new Pool({...config,user:'anvil_v3_migrator',password:migratorPassword,max:2}),fresh);
 const access=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)}),app=buildApp({},undefined,{repository:access,origin:'https://localhost:3830'});
 const pid=randomUUID(),uid=randomUUID(),otherUid=randomUUID(),markers:string[]=[];let phase='SCHEMA',who:any;
 try{
  const identity=(await pool.query('SELECT current_database() db,current_user role,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
  assert.deepEqual(identity,{db:config.database,role:'anvil_v3_app',rolsuper:false,rolbypassrls:false});
  const expected=JSON.parse(await readFile(new URL('../../../docs/04_test_reports/AV3/FN02/EMPTY_APPLICATION_QA_MANIFEST.json',import.meta.url),'utf8'));
  const actual=(await admin.query('SELECT id,checksum FROM anvil.schema_migrations')).rows;assert.equal(actual.length,53);
  assert.equal(new Set(actual.map(r=>r.id)).size,53);assert.ok(actual.every(r=>expected.rows.find((m:any)=>m.id===r.id)?.checksum===r.checksum));
  assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.users')).rows[0].n,0);
  const forms=buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md',import.meta.url)),await readFile(new URL('../../../docs/design/문서작성_공통기준.md',import.meta.url)));
  const graph=buildBuiltinMethodologies(await readFile(new URL('../../../docs/design/기본방법론_상세검토안.md',import.meta.url)),forms.forms)[0]!.graph;
  const seed=await admin.connect();try{await seed.query('BEGIN');await seedOfficialForms(seed,forms);await seed.query('COMMIT');}catch(e){await seed.query('ROLLBACK');throw e;}finally{seed.release();}
  phase='SYNTHETIC_AUTH';const loginPassword=randomBytes(32).toString('base64url'),phc=await hashPassword(loginPassword);
  for(const id of [uid,otherUid]){await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'FN02 격리 합성 사용자','ACTIVE')",[id,'qa-fn02-'+id]);await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)',[id,phc]);}
  who=await access.login('qa-fn02-'+uid,loginPassword,'FN02 격리','fn02-qa-own');
  const sibling=await access.login('qa-fn02-'+uid,loginPassword,'다른 기기','fn02-qa-sibling'),other=await access.login('qa-fn02-'+otherUid,loginPassword,'다른 사용자','fn02-qa-other');
  await admin.query("INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,'FN02 격리','절차 적용 실제 저장','과거 이력 보존')",[pid]);
  await admin.query("INSERT INTO anvil.project_members(project_id,user_id,participation) VALUES($1,$2,'OWNER')",[pid,uid]);await admin.query('INSERT INTO anvil.project_control(project_id,actor_id,client_id,generation) VALUES($1,$2,$3,1)',[pid,uid,who.clientId]);
  const command=(operation:string,payload:Record<string,unknown>,targetId:string|null=null,expectedVersion=0):ProjectCommand=>({schemaVersion:1,projectId:pid,commandId:randomUUID(),clientId:who.clientId,controlGeneration:1,operation,targetId,expectedVersion,baselineRefs:[],approvalRef:null,payload});
  const headers=(actor=who)=>({host:'localhost:3830',origin:'https://localhost:3830',cookie:'__Host-anvil.sid='+actor.token,'x-anvil-csrf':actor.csrfToken});
  const send=(request:ProjectCommand,actor=who)=>{fresh();return app.inject({method:'POST',url:'/api/v1/projects/'+pid+'/commands',headers:headers(actor),payload:request});};
  const getApplication=()=>app.inject({method:'GET',url:'/api/v1/projects/'+pid+'/methodology-application',headers:headers()});
  const success=async(request:ProjectCommand)=>{const response=await send(request);assert.equal(response.statusCode,200,response.body);return response.json();};
  const operations=['saveMethodologyDraft','recordContentReview','confirmMethodology','applyMethodology'];
  const noPolicy=await send(command('saveMethodologyDraft',{name:'절차',purpose:'원문',scope:'PROJECT',graph,reason:'정책 전 거절'}));assert.equal(noPolicy.statusCode,412);markers.push('NO_POLICY_DENIED');
  who=await access.reauthenticate(who.token,who.csrfToken,loginPassword,'fn02-qa-own');
  const rule={ruleId:'FN02_ONLY',subjectRef:{kind:'HUMAN',userId:uid},operations,targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:new Date(Date.now()+1200000).toISOString()};
  const policy=await success(command('savePermissionPolicy',{rules:[rule],reason:'격리 합성 사용자 정책',reviewRefs:[]}));
  const save=await success(command('saveMethodologyDraft',{name:'절차 v1',purpose:'적용 이력 보존',scope:'PROJECT',graph,reason:'새 빈 프로젝트 절차'})),method=save.data.ref;
  const apply1=command('applyMethodology',{methodologyRef:method,expectedApplicationVersion:0,reason:'확정된 첫 절차 명시 적용'},pid,0);
  const unconfirmed=await send(apply1);assert.equal(unconfirmed.statusCode,422);assert.equal(unconfirmed.json().code,'CONTENT_REVIEW_REQUIRED');
  const reviewItems=methodContentReviewCriteria.items.map(item=>({criterionId:item.criterionId,outcome:'ACCEPTED',evidenceRefs:[],reason:'합성 원문 대조'}));
  const confirm=async(ref:any)=>{const reviewed=await success(command('recordContentReview',{targetKind:'METHODOLOGY',targetRef:ref,criteriaVersion:1,items:reviewItems,outcome:'ACCEPTED',reason:'합성 내용 검수'},ref.id,ref.version));return success(command('confirmMethodology',{versionRef:ref,reviewRefs:[reviewed.data.reviewRef]},ref.id,ref.version));};
  await confirm(method);assert.equal((await getApplication()).json().applicationRef,null);markers.push('CONFIRM_NOT_APPLY_UNCONFIRMED_DENIED');
  assert.equal((await send({...apply1,clientId:sibling.clientId},sibling)).statusCode,403);assert.equal((await send({...apply1,clientId:other.clientId},other)).statusCode,404);
  phase='APPLY_COMMIT';const applied=await success(apply1);assert.equal(applied.data.status,'METHODOLOGY_APPLIED');assert.equal(applied.data.ref.version,1);assert.equal(applied.data.previousApplicationRef,null);assert.equal(applied.data.reason,apply1.payload.reason);
  assert.deepEqual(await success(apply1),applied);assert.equal((await send({...apply1,payload:{...apply1.payload,reason:'다른 내용'}})).statusCode,409);
  const first=(await getApplication()).json();assert.deepEqual(first.applicationRef,applied.data.ref);assert.deepEqual(first.snapshot.sourceRef,method);assert.equal(contentHash(canonicalJson(first.snapshot)),applied.data.ref.contentHash);
  const web=new ApiClient(async(url,init)=>{assert(!init?.method||init.method==='GET');const response=await app.inject({method:'GET',url:String(url),headers:headers()});return new Response(response.body,{status:response.statusCode,headers:{'content-type':'application/json'}});});
  assert.deepEqual(await readMethodApplicationRef(web,pid),applied.data.ref);markers.push('EXACT_APPLY_COMMIT_REPLAY_WEB_READ');
  const already=await send(command('applyMethodology',{methodologyRef:method,expectedApplicationVersion:1,reason:'동일 원문 중복 거절'},pid,1));assert.equal(already.statusCode,409);assert.equal(already.json().code,'METHODOLOGY_ALREADY_APPLIED');
  phase='NEXT_VERSION';const nextGraph=structuredClone(graph);nextGraph.nodes[0]!.position.x+=1;
  const revised=await success(command('saveMethodologyDraft',{name:'절차 v2',purpose:'변경 이력 보존',scope:'PROJECT',graph:nextGraph,reason:'새 위치 버전'},method.id,method.version)),nextMethod=revised.data.ref;
  const stale=await send(command('applyMethodology',{methodologyRef:method,expectedApplicationVersion:1,reason:'옛 source head 거절'},pid,1));assert.equal(stale.statusCode,409);await confirm(nextMethod);
  phase='ORPHAN_COMMIT';const orphan=command('applyMethodology',{methodologyRef:nextMethod,expectedApplicationVersion:1,reason:'행 없는 영수증 COMMIT 거절'},pid,1),snapshot={name:'절차 v2',purpose:'변경 이력 보존',graph:nextGraph,sourceRef:nextMethod},orphanRef={id:randomUUID(),version:2,contentHash:contentHash(canonicalJson(snapshot))};
  await assert.rejects(access.authenticated(who.token,who.csrfToken,async(db,actor)=>{await currentProjectController(db,actor,orphan);const material=await authorizeMaterial(db,actor,orphan);await persistProjectReceipt(db,actor,orphan,orphanRef,{status:'METHODOLOGY_APPLIED',snapshot,reason:orphan.payload.reason,previousApplicationRef:applied.data.ref},material.ref,'EXPLICIT_EMPTY_PROJECT_METHODOLOGY_APPLICATION');}),(e:any)=>e.code==='42501');
  assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.commands WHERE project_id=$1 AND command_id=$2',[pid,orphan.commandId])).rows[0].n,0);markers.push('RECEIPT_ONLY_DEFERRED_COMMIT_ROLLBACK');
  phase='SAME_GENERATION_RACE';const nextApply=command('applyMethodology',{methodologyRef:nextMethod,expectedApplicationVersion:1,reason:'다음 절차의 별도 적용'},pid,1);
  const raced=await Promise.all([send(nextApply),send({...nextApply,commandId:randomUUID()})]);assert.deepEqual(raced.map(r=>r.statusCode).toSorted(),[200,409]);
  const second=raced.find(r=>r.statusCode===200)!.json();assert.equal(second.data.ref.version,2);assert.deepEqual(second.data.previousApplicationRef,applied.data.ref);
  const rows=(await admin.query('SELECT id,application_version,snapshot_json,snapshot_hash FROM anvil.project_methodologies WHERE project_id=$1 ORDER BY application_version',[pid])).rows;assert.equal(rows.length,2);assert.deepEqual(rows[0].snapshot_json,first.snapshot);assert.equal(rows[0].snapshot_hash,first.applicationRef.contentHash);assert.deepEqual((await getApplication()).json().applicationRef,second.data.ref);markers.push('SAME_GENERATION_API_SINGLE_APPEND_OLD_SNAPSHOT_UNCHANGED');
  phase='APP_DML';await assert.rejects(pool.query('UPDATE anvil.project_methodologies SET snapshot_hash=snapshot_hash WHERE project_id=$1',[pid]),(e:any)=>e.code==='42501');
  await assert.rejects(pool.query("UPDATE anvil.commands SET result_ref=result_ref WHERE project_id=$1 AND operation='applyMethodology'",[pid]),(e:any)=>e.code==='42501');
  const direct=await pool.connect();try{await direct.query('BEGIN');await direct.query("SELECT set_config('anvil.actor_id',$1,true),set_config('anvil.client_id',$2,true),set_config('anvil.command_id',$3,true)",[uid,who.clientId,randomUUID()]);await assert.rejects(direct.query('INSERT INTO anvil.project_methodologies(id,project_id,application_version,source_definition_id,source_version,source_hash,snapshot_json,snapshot_hash,created_by) SELECT $2,project_id,3,source_definition_id,source_version,source_hash,snapshot_json,snapshot_hash,created_by FROM anvil.project_methodologies WHERE project_id=$1 AND application_version=2',[pid,randomUUID()]),(e:any)=>e.code==='42501');}finally{await direct.query('ROLLBACK');direct.release();}markers.push('ROW_ONLY_AND_POSTCOMMIT_MUTATION_DENIED');
  phase='CURRENT_AUTHORIZATION';await success(command('savePermissionPolicy',{rules:[{...rule,disposition:'DENY'}],reason:'합성 사용자 적용 회수',reviewRefs:[]},policy.data.ref.id,policy.data.ref.version));
  assert.equal((await send(apply1)).statusCode,403,'같은 command replay도 현재 정책을 우회하지 않는다');
  await admin.query('UPDATE anvil.project_control SET generation=2 WHERE project_id=$1',[pid]);assert.equal((await send(apply1)).statusCode,409);markers.push('CURRENT_DENY_AND_OLD_GENERATION_REPLAY_REJECTED');
  assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.project_methodologies WHERE project_id=$1',[pid])).rows[0].n,2);
  for(const table of ['assignment_drafts','execution_preparations','agent_sessions','executions','execution_grants','writer_claims','execution_commands','delivery_outbox'])assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.'+table)).rows[0].n,0);
  console.log('FN02_APPLICATION_WORKFLOW '+JSON.stringify({status:'PASS',markers,applications:2,actualAgentCalls:0,formalDbChanges:0}));
 }catch(error){const code=(error as any)?.code;console.log('FN02_APPLICATION_WORKFLOW_FAILURE '+JSON.stringify({phase,code:typeof code==='string'&&/^[A-Z0-9_]{1,80}$/.test(code)?code:null}));throw error;}
 finally{await app.close();await pool.end();await admin.end();}
});
