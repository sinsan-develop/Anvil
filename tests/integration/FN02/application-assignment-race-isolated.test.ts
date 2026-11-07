import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,realpath,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {Pool,type PoolClient} from 'pg';
import {AccessRepository,AuthFailure} from '../../../apps/server/modules/access/repository.ts';
import {hashPassword} from '../../../apps/server/modules/access/service.ts';
import {currentProjectController,authorizeMaterial,projectReplay,type ProjectCommand} from '../../../apps/server/modules/access/project-command.ts';
import {buildApp} from '../../../apps/server/app.ts';
import {ProjectDocuments} from '../../../apps/server/modules/documents/project-documents.ts';
import {ProjectWorkPlans} from '../../../apps/server/modules/traceability/work-plans.ts';
import {ProjectAssignmentDrafts} from '../../../apps/server/modules/assignments/project-assignment-drafts.ts';
import {ProjectMethodologies} from '../../../apps/server/modules/methodologies/project-methodologies.ts';
import {buildOfficialForms,type FormDefinition} from '../../../apps/server/modules/documents/forms.ts';
import {seedOfficialForms} from '../../../apps/server/modules/documents/catalog-seed.ts';
import {buildBuiltinMethodologies} from '../../../apps/server/modules/methodologies/builtins.ts';
import {seedBuiltinMethodologies} from '../../../apps/server/modules/methodologies/catalog-seed.ts';
import {methodContentReviewCriteria} from '../../../apps/server/modules/methodologies/content-review.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {newDocument,prepareDocumentSave,continueDocumentSave} from '../../../apps/web/src/features/design-trace/editor-api.ts';
import {readDocument} from '../../../apps/web/src/features/design-trace/api.ts';
import {newDocumentReview,prepareDocumentReview,sendDocumentReview} from '../../../apps/web/src/features/design-trace/review-api.ts';
import {newDocumentConfirmation,prepareDocumentConfirmation,sendDocumentConfirmation} from '../../../apps/web/src/features/design-trace/confirmation-api.ts';
import {readWorkPlan} from '../../../apps/web/src/features/design-trace/work-plan-api.ts';
import {readWorkPlanDecision,newWorkPlanDecision,prepareWorkPlanDecision,sendWorkPlanDecision} from '../../../apps/web/src/features/design-trace/work-plan-decision-api.ts';
import {newAssignmentDraft,prepareAssignmentWrite,readAssignmentDraft} from '../../../apps/web/src/features/workspace/assignment-api.ts';
import {assertFn02QaManifest} from '../../../scripts/fn02-empty-application-manifest.ts';
import {fenceResultQaPool} from '../FN12/result-qa-fence.ts';

// material 경로 직렬화/이력 거절의 상실을 실제 COMMIT·대기 SQL로 검출한다.
// 개별 fn02 trigger 하나의 독립적인 잠금 효과나 어느 p/m tuple인지까지 증명하지 않는다.
// 실제 로그인에서 얻은 동일 주체로 독립 app-role material transaction을 사용한다.
// 같은 HTTP 세션의 인증 행 잠금에 가려진 경합을 project 잠금 증거로 오인하지 않는다.
test('유효한 임무 초안 저장과 명시 방법론 적용의 material 직렬화·이력 차단',{timeout:90000},async t=>{
 const until=Date.parse(process.env.ANVIL_FN02_QA_UNTIL??''),sha=process.env.ANVIL_FN02_QA_SHA??'',host=process.env.ANVIL_FN02_QA_HOST??'',password=process.env.ANVIL_FN02_QA_APP??'',migratorPassword=process.env.ANVIL_FN02_QA_MIGRATOR??'';
 const root='/tmp/anvil-v3-fn02-empty-application-01/assignment-artifacts';
 if(process.platform!=='linux'||process.getuid?.()!==1000||await realpath(process.cwd())!=='/home/daon/deploy/anvil-v3-fn02-empty-application-qa-01'
  ||!/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)||!/^[0-9a-f]{64}$/.test(password)||!/^[0-9a-f]{64}$/.test(migratorPassword)
  ||!Number.isFinite(until)||until<=Date.now()||until>Date.now()+600000||!/^[0-9a-f]{40}$/.test(sha)||execFileSync('/usr/bin/git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==sha||process.env.ANVIL_DB_CONFIG||process.env.ANVIL_MIGRATOR_CONFIG)throw Error('FN02_EXACT_ASSIGNMENT_RACE_QA_REQUIRED');
 const fresh=()=>assert(!t.signal.aborted&&Date.now()<until,'FN02_QA_EXPIRED');
 const config={host,port:5432,database:'anvil_v3_fn02_empty_application_qa_01',connectionTimeoutMillis:3000,statement_timeout:5000};
 const pool=fenceResultQaPool(new Pool({...config,user:'anvil_v3_app',password,max:5}),fresh),admin=fenceResultQaPool(new Pool({...config,user:'anvil_v3_migrator',password:migratorPassword,max:2}),fresh);
 const access=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)}),app=buildApp({},undefined,{repository:access,origin:'https://localhost:3830',artifactRoot:root});
 const methodsService=new ProjectMethodologies(),assignments=new ProjectAssignmentDrafts(new ProjectWorkPlans(new ProjectDocuments(root)),methodsService),markers:string[]=[];let phase='SCHEMA';
 try{
  assert.deepEqual((await pool.query('SELECT current_database() db,current_user role,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0],{db:config.database,role:'anvil_v3_app',rolsuper:false,rolbypassrls:false});
  const expected=JSON.parse(await readFile(new URL('../../../docs/04_test_reports/AV3/FN02/EMPTY_APPLICATION_QA_MANIFEST.json',import.meta.url),'utf8'));assertFn02QaManifest((await admin.query('SELECT id,checksum FROM anvil.schema_migrations')).rows,expected.rows);
  assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.users')).rows[0].n,0);
  await mkdir(root,{mode:0o700});assert.equal(await realpath(root),root);
  const forms=buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md',import.meta.url)),await readFile(new URL('../../../docs/design/문서작성_공통기준.md',import.meta.url))),methods=buildBuiltinMethodologies(await readFile(new URL('../../../docs/design/기본방법론_상세검토안.md',import.meta.url)),forms.forms);
  const seed=await admin.connect();try{await seed.query('BEGIN');await seedOfficialForms(seed,forms);await seedBuiltinMethodologies(seed,methods,forms.forms);await seed.query('COMMIT');}catch(e){await seed.query('ROLLBACK');throw e;}finally{seed.release();}
  phase='AUTH';const uid=randomUUID(),loginPassword=randomBytes(32).toString('base64url');await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'임무 경합 격리 QA','ACTIVE')",[uid,'qa-fn02-race-'+uid]);await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)',[uid,await hashPassword(loginPassword)]);
  let who=await access.login('qa-fn02-race-'+uid,loginPassword,'임무 경합 격리','fn02-race');who=await access.reauthenticate(who.token,who.csrfToken,loginPassword,'fn02-race');
  const actor=await access.authenticated(who.token,who.csrfToken,async(_db,identity)=>identity),session={user:{id:uid},clientId:who.clientId,csrfToken:who.csrfToken},headers={host:'localhost:3830',origin:'https://localhost:3830',cookie:'__Host-anvil.sid='+who.token,'x-anvil-csrf':who.csrfToken};
  const source=methods[0]!,sourceRef={id:source.id,version:source.version,contentHash:source.contentHash};
  const send=(request:ProjectCommand)=>{fresh();return app.inject({method:'POST',url:'/api/v1/projects/'+request.projectId+'/commands',headers,payload:request});};
  const client=new ApiClient(async(url,init)=>{fresh();assert(String(url).startsWith('/api/v1/'));let payload:any=undefined;if(init?.body instanceof Blob)payload=Buffer.from(await init.body.arrayBuffer());else if(init?.body instanceof Uint8Array)payload=Buffer.from(init.body);else if(typeof init?.body==='string')payload=init.body;else assert(init?.body==null);fresh();const response=await app.inject({method:(init?.method??'GET') as any,url:String(url),headers:{...headers,...init?.headers as Record<string,string>},payload});return new Response(response.body,{status:response.statusCode,headers:{'content-type':String(response.headers['content-type']??'')}});});
  async function prepareProject(name:string){
   phase='PROJECT_'+name;const draft=await app.inject({method:'POST',url:'/api/v1/project-drafts',headers,payload:{schemaVersion:1,commandId:randomUUID(),clientId:who.clientId,targetId:null,expectedVersion:0,name,purpose:'유효 임무와 적용의 경합',desiredOutcome:'기존 근거 불변',sourceMode:'EMPTY',methodologySelection:{kind:'CONFIRMED_REFERENCE',versionRef:sourceRef},artifactRefs:[]}});assert.equal(draft.statusCode,201);
   const created=await app.inject({method:'POST',url:'/api/v1/projects',headers,payload:{schemaVersion:1,commandId:randomUUID(),clientId:who.clientId,draftId:draft.json().draftId,draftVersion:1}});assert.equal(created.statusCode,201);const project=created.json(),pid=project.id;
   const command=(operation:string,payload:Record<string,unknown>,targetId:string|null=null,expectedVersion=0):ProjectCommand=>({schemaVersion:1,projectId:pid,commandId:randomUUID(),clientId:who.clientId,controlGeneration:1,operation,targetId,expectedVersion,baselineRefs:[],approvalRef:null,payload});
   const success=async(request:ProjectCommand)=>{const response=await send(request);assert.equal(response.statusCode,200);return response.json();};
   const operations=['uploadArtifact','saveDocumentDraft','recordContentReview','confirmDocument','indexDesignDocument','saveWorkPlanDraft','confirmWorkPlan','prepareAssignment','saveMethodologyDraft','confirmMethodology','applyMethodology'];
   await success(command('savePermissionPolicy',{rules:[{ruleId:'FN02_RACE_ONLY',subjectRef:{kind:'HUMAN',userId:uid},targetScopes:[{kind:'PROJECT',projectId:pid}],operations,disposition:'AUTO',limitPolicyRef:null,expiresAt:new Date(until).toISOString()}],reason:'격리 합성 선행·임무·적용만',reviewRefs:[]}));
   const graph=structuredClone(source.graph);graph.nodes[0]!.position.x+=10;
   const method=(await success(command('saveMethodologyDraft',{name:'다음 절차',purpose:'근거 변경의 명시 경계',scope:'PROJECT',graph,reason:'격리 새 원문'}))).data.ref;
   const review=(await success(command('recordContentReview',{targetKind:'METHODOLOGY',targetRef:method,criteriaVersion:1,items:methodContentReviewCriteria.items.map(item=>({criterionId:item.criterionId,outcome:'ACCEPTED',evidenceRefs:[],reason:'합성 원문 대조'})),outcome:'ACCEPTED',reason:'사용자 인수 아닌 격리 검수'},method.id,method.version))).data.reviewRef;
   await success(command('confirmMethodology',{versionRef:method,reviewRefs:[review]},method.id,method.version));
   async function confirmedDocument(formId:string,title:string,lead:string){
    const formResponse=await app.inject({method:'GET',url:'/api/v1/forms/'+formId+'/versions/1',headers});assert.equal(formResponse.statusCode,200);const form=formResponse.json(),draft=newDocument(pid,form,uid,1),text=[lead];
    for(const item of(form.definition as FormDefinition).items){draft.content.sections.push({itemId:item.itemId,anchor:'line:'+(text.length+1)});text.push('## '+item.title);if(item.valueType==='TEXT')text.push('합성 범위·근거·검수 조건');else text.push('| '+item.fields.map(f=>f.fieldId).join(' | ')+' |','| '+item.fields.map(()=>'---').join(' | ')+' |','| '+item.fields.map((_,i)=>'합성값'+i).join(' | ')+' |');}
    Object.assign(draft,{title,body:text.join('\n'),reason:'유효 임무 경합의 선행 원문',dirty:true});const ref=await continueDocumentSave(client,await prepareDocumentSave(draft,session),session,()=>{},()=>true),view=await readDocument(client,pid,ref.id,ref.version);assert.equal(view.document.validation.validForConfirmation,true);
    const r=newDocumentReview(pid,view.document,uid,1);r.items=r.items.map(i=>({...i,outcome:'ACCEPTED',reason:'합성 검수'}));r.outcome='ACCEPTED';r.reason='실제 사용자 인수 아님';r.pending=prepareDocumentReview(r,session);await sendDocumentReview(client,r,session,()=>true);
    const c=newDocumentConfirmation(pid,(await readDocument(client,pid,ref.id,ref.version)).document,uid,1);c.acknowledged=true;c.pending=prepareDocumentConfirmation(c,session);await sendDocumentConfirmation(client,c,session,()=>true);return ref;
   }
   phase='BASIS_'+name;const design=await confirmedDocument('a6f30000-0000-4000-8000-000000000002','경합 설계','# D11 임무 근거'),planDoc=await confirmedDocument('a6f30000-0000-4000-8000-000000000004','경합 계획','# FN01 임무 저장');
   const index=await success(command('indexDesignDocument',{documentRef:design,items:[{localCode:'D11',title:'임무 근거',anchor:'line:1'}],screens:[],reason:'확정 설계 연결'},design.id,1));
   const task={taskCode:'FN01',type:'FUNCTION',title:'임무 저장',purpose:'사용자 소유 통제',designRefs:[{kind:'DESIGN_ITEM',id:index.data.designItems[0].id,versionRef:design,localCode:'D11',anchor:'line:1'}],screenRefs:[],ownerRole:'단계책임자',inputs:['확정 설계'],outputs:['임무 초안'],included:['내용 저장'],excluded:['실제 Agent'],allowedFileRefs:['src/a.ts'],startPrerequisites:[],acceptancePrerequisites:[],steps:['작성·저장·조회'],testCases:['NORMAL','IMPORTANT_FAILURE','DIRECT_IMPACT'].map((kind,n)=>({id:'T'+n,kind,steps:['확인'],expected:'근거 불변',environment:'WSL'})),acceptanceCriteria:['정확 원문'],evidenceRequirements:['불변 ref'],rollback:'격리 폐기',recoveryNotes:'사실 보존'};
   const saved=await success(command('saveWorkPlanDraft',{documentRef:planDoc,designRef:design,screenReviewRefs:[],tasks:[task],reason:'유효 임무 선행'}));assert.deepEqual(saved.data.workPlan.issues,[]);
   const plan=await readWorkPlan(client,pid,saved.data.ref),r=newWorkPlanDecision(pid,await readWorkPlanDecision(client,pid,plan),session,1,'REVIEW');r.items=r.items.map(i=>({...i,outcome:'ACCEPTED',reason:'합성 경계 대조'}));r.outcome='ACCEPTED';r.reason='실제 사용자 인수 아님';r.pending=prepareWorkPlanDecision(r,session);await sendWorkPlanDecision(client,r,session,()=>true);
   const c=newWorkPlanDecision(pid,await readWorkPlanDecision(client,pid,plan),session,1,'CONFIRM');c.acknowledged=true;c.pending=prepareWorkPlanDecision(c,session);await sendWorkPlanDecision(client,c,session,()=>true);assert.equal((await readWorkPlanDecision(client,pid,plan)).currentConfirmationValid,true);
   const assignment=newAssignmentDraft(pid,session,1,plan,'FN01',project.currentMethodologyRef,source.graph.nodes[0]!.nodeId);assignment.input.reason='유효한 격리 임무';assignment.input.definition.integrationResponsibility='Main이 검수·통합';
   const request=prepareAssignmentWrite(assignment,session) as ProjectCommand,apply=command('applyMethodology',{methodologyRef:method,expectedApplicationVersion:1,reason:'명시 새 적용'},pid,1);
   const original=(await admin.query('SELECT id,application_version,snapshot_json,snapshot_hash FROM anvil.project_methodologies WHERE project_id=$1 ORDER BY application_version',[pid])).rows;
   return{pid,request,apply,original,applicationRef:project.currentMethodologyRef,design,command};
  }
  const first=await prepareProject('ASSIGNMENT_FIRST'),second=await prepareProject('APPLICATION_FIRST');
  async function material(connection:PoolClient,request:ProjectCommand,active=fresh){
   const db=new Proxy(connection,{get(target,key){if(key==='query')return(...args:unknown[])=>{active();return Reflect.apply(target.query,target,args);};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
   active();await currentProjectController(db,actor,request);const policy=await authorizeMaterial(db,actor,request);assert.equal(await projectReplay(db,actor,request),undefined);return request.operation==='prepareAssignment'?assignments.save(db,actor,request,policy.ref):methodsService.apply(db,actor,request,policy.ref);
  }
  async function waitBlocked(waiter:number,blocker:number){
   const end=Date.now()+2000;
   while(Date.now()<end){fresh();const observed=(await pool.query('SELECT $2::int=ANY(pg_blocking_pids($1)) blocked,query FROM pg_stat_activity WHERE pid=$1',[waiter,blocker])).rows[0];
    if(observed?.blocked===true){assert.match(observed.query,/^SELECT p\.id,p\.archived_at,m\.participation FROM anvil\.projects p JOIN anvil\.project_members m[\s\S]+FOR UPDATE OF p,m$/);return;}
    await delay(10);
   }
   assert.fail('FN02_EXPECTED_MATERIAL_CONTROLLER_WAIT_NOT_OBSERVED');
  }
  async function race(leaderRequest:ProjectCommand,followerRequest:ProjectCommand,expectedFailure:string,expectedStatus:number):Promise<any>{
   const leader=await pool.connect();let follower:PoolClient|undefined,pending:Promise<any>|null=null,closing=false;
   const active=()=>{fresh();assert(!closing,'FN02_MATERIAL_FOLLOWER_CANCELLED');};
   try{
    follower=await pool.connect();
    await leader.query('BEGIN');await follower.query('BEGIN');const leaderPid=(await leader.query('SELECT pg_backend_pid() id')).rows[0].id,followerPid=(await follower.query('SELECT pg_backend_pid() id')).rows[0].id;
    const result=await material(leader,leaderRequest);pending=material(follower,followerRequest,active).then(value=>({value}),error=>({error}));await waitBlocked(followerPid,leaderPid);await leader.query('COMMIT');
    const denied=await pending;assert(denied.error instanceof AuthFailure);assert.equal(denied.error.message,expectedFailure);assert.equal(denied.error.statusCode,expectedStatus);await follower.query('ROLLBACK');return result;
   }finally{
    closing=true;const leaderRollback=await Promise.allSettled([leader.query('ROLLBACK')]);if(pending)await pending;
    const followerRollback=follower?await Promise.allSettled([follower.query('ROLLBACK')]):[];
    leader.release(leaderRollback[0]?.status==='rejected');follower?.release(followerRollback[0]?.status==='rejected');
    assert([...leaderRollback,...followerRollback].every(result=>result.status==='fulfilled'),'FN02_RACE_ROLLBACK_UNVERIFIED');
   }
  }
  phase='ASSIGNMENT_FIRST';const assignment=await race(first.request,first.apply,'EXECUTION_STATE_UNVERIFIED',412);assert.deepEqual((await readAssignmentDraft(client,first.pid,assignment.data.ref)).ref,assignment.data.ref);
  assert.deepEqual((await admin.query('SELECT id,application_version,snapshot_json,snapshot_hash FROM anvil.project_methodologies WHERE project_id=$1 ORDER BY application_version',[first.pid])).rows,first.original);
  const denied=await send({...first.apply,commandId:randomUUID()});assert.equal(denied.statusCode,412);assert.equal(denied.json().code,'EXECUTION_STATE_UNVERIFIED');assert.equal((await admin.query("SELECT count(*)::int n FROM anvil.commands WHERE project_id=$1 AND operation='applyMethodology'",[first.pid])).rows[0].n,0);markers.push('COMMITTED_VALID_ASSIGNMENT_BLOCKS_APPLICATION_NO_APPEND');
  phase='APPLICATION_FIRST';const applied=await race(second.apply,second.request,'METHODOLOGY_APPLICATION_CHANGED',409);assert.equal(applied.data.ref.version,2);
  assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.assignment_drafts WHERE project_id=$1',[second.pid])).rows[0].n,0);assert.equal((await admin.query("SELECT count(*)::int n FROM anvil.commands WHERE project_id=$1 AND operation='prepareAssignment'",[second.pid])).rows[0].n,0);
  const rows=(await admin.query('SELECT id,application_version,snapshot_json,snapshot_hash FROM anvil.project_methodologies WHERE project_id=$1 ORDER BY application_version',[second.pid])).rows;assert.equal(rows.length,2);assert.deepEqual(rows.slice(0,1),second.original);markers.push('COMMITTED_APPLICATION_REJECTS_STALE_ASSIGNMENT_NO_ORPHAN');
  phase='EXPLICIT_REBASE';const retry=structuredClone(second.request);retry.commandId=randomUUID();const definition=retry.payload.definition as any;definition.taskRef.applicationRef=applied.data.ref;definition.baselineRefs=definition.baselineRefs.map((ref:any)=>ref.id===second.applicationRef.id?applied.data.ref:ref);
  const recovered=await send(retry);assert.equal(recovered.statusCode,200);assert.deepEqual((await readAssignmentDraft(client,second.pid,recovered.json().data.ref)).ref,recovered.json().data.ref);assert.equal(recovered.json().data.snapshot.executionAuthorized,false);markers.push('EXPLICIT_FRESH_APPLICATION_REFERENCE_ASSIGNMENT_SAVES');
  for(const table of ['execution_preparations','agent_sessions','executions','execution_grants','writer_claims','execution_commands','delivery_outbox'])assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.'+table)).rows[0].n,0);
  assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.assignment_drafts')).rows[0].n,2);assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.assignment_draft_versions')).rows[0].n,2);
  console.log('FN02_APPLICATION_ASSIGNMENT_RACE '+JSON.stringify({status:'PASS',markers,blockingSite:'CURRENT_PROJECT_CONTROLLER_PROJECT_MEMBER_QUERY',individualFn02TriggerProven:false,transport:'AUTHENTICATED_IDENTITY_APP_ROLE_MATERIAL_TRANSACTIONS_AND_FASTIFY_INJECT',simultaneousHttp:false,validDrafts:2,actualAgentCalls:0,formalDbChanges:0}));
 }catch(error){const code=(error as any)?.code;console.log('FN02_APPLICATION_ASSIGNMENT_RACE_FAILURE '+JSON.stringify({phase,code:typeof code==='string'&&/^[A-Z0-9_]{1,80}$/.test(code)?code:null}));throw error;}
 finally{await app.close();await pool.end();await admin.end();}
});
