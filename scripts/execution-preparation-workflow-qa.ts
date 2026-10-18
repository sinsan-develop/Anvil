import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { lstat, realpath, mkdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { AccessRepository } from '../apps/server/modules/access/repository.ts';
import { hashPassword } from '../apps/server/modules/access/service.ts';
import { buildApp } from '../apps/server/app.ts';
import { canonicalJson, contentHash } from '../contracts/canonical.ts';
import { ApiClient } from '../apps/web/src/api/client.ts';
import { newDocument, prepareDocumentSave, continueDocumentSave } from '../apps/web/src/features/design-trace/editor-api.ts';
import { readDocument } from '../apps/web/src/features/design-trace/api.ts';
import { newDocumentReview, prepareDocumentReview, sendDocumentReview } from '../apps/web/src/features/design-trace/review-api.ts';
import { newDocumentConfirmation, prepareDocumentConfirmation, sendDocumentConfirmation } from '../apps/web/src/features/design-trace/confirmation-api.ts';
import { readWorkPlan } from '../apps/web/src/features/design-trace/work-plan-api.ts';
import { readWorkPlanDecision, newWorkPlanDecision, prepareWorkPlanDecision, sendWorkPlanDecision } from '../apps/web/src/features/design-trace/work-plan-decision-api.ts';
import { newAssignmentDraft, prepareAssignmentWrite, sendAssignmentDraft } from '../apps/web/src/features/workspace/assignment-api.ts';
import { newAssignmentDecision, prepareAssignmentDecision, sendAssignmentDecision, readConfirmedAssignment } from '../apps/web/src/features/workspace/assignment-confirmation-api.ts';
import type { AssignmentContentReview } from '../apps/server/modules/assignments/assignment-confirmation-input.ts';
import { buildOfficialForms, type FormDefinition } from '../apps/server/modules/documents/forms.ts';
import { seedOfficialForms } from '../apps/server/modules/documents/catalog-seed.ts';
import { buildBuiltinMethodologies } from '../apps/server/modules/methodologies/builtins.ts';
import { seedBuiltinMethodologies } from '../apps/server/modules/methodologies/catalog-seed.ts';
import { contextSlotCodes } from '../apps/server/modules/context/context-input.ts';
import { executionPreparationQa as qa, executionPreparationQaDatabase, executionPreparationQaInsert, executionPreparationQaRemaining, cleanExecutionPreparationQaRoot, assertExecutionPreparationQaBinding, buildExecutionPreparationQaSchema } from './execution-preparation-qa.ts';
import { sourceReadQaError } from './source-read-qa-guard.ts';

/** 새 runner가 검증한 내부 PG 주소/메모리 비밀만 받는다. 공식 config·외부 Agent·listener는 사용하지 않는다. */
export async function executionPreparationWorkflow(host:string,passwords:{app:string;migrator:string},deadline:number,manifest:{id:string;checksum:string}[]) {
  assert.equal(process.platform,'linux');assert.equal(process.getuid?.(),1000);assert.equal(await realpath(process.cwd()),qa.cwd);
  assert(/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host));
  const fresh=()=>{executionPreparationQaRemaining(deadline);};
  const config={host,port:5432,database:qa.database,connectionTimeoutMillis:5000,query_timeout:10000,application_name:qa.runId};
  const pool=executionPreparationQaDatabase(new Pool({...config,user:'anvil_v3_app',password:passwords.app}),fresh),admin=executionPreparationQaDatabase(new Pool({...config,user:'anvil_v3_migrator',password:passwords.migrator}),fresh);
  const access=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)});
  const app=buildApp({},undefined,{repository:access,origin:'https://localhost:3830',artifactRoot:qa.artifactRoot});
  const user=randomUUID(),project=randomUUID(),application=randomUUID(),cases:string[]=[];
  let phase='IDENTITY',rootCreated=false,lastResponseCode:string|null=null;
  try {
    fresh();
    phase='IDENTITY_ADMIN_CONNECTION';const identity=(await admin.query('SELECT current_database() db,current_user role,host(inet_server_addr()) address')).rows[0];
    phase='IDENTITY_ADMIN_FACTS';
    assert.equal(identity.db,qa.database);assert.equal(identity.role,'anvil_v3_migrator');assert.equal(identity.address,host);
    phase='IDENTITY_APP_CONNECTION';const role=(await pool.query('SELECT current_user role,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    phase='IDENTITY_APP_FACTS';
    assert.equal(role.role,'anvil_v3_app');assert.equal(role.rolsuper,false);assert.equal(role.rolbypassrls,false);
    phase='IDENTITY_MANIFEST';const actual=(await admin.query('SELECT id,checksum FROM anvil.schema_migrations ORDER BY id')).rows;
    assert.deepEqual(actual,[...manifest].sort((a,b)=>a.id.localeCompare(b.id)));
    await assert.rejects(lstat(qa.artifactRoot),(e:any)=>e.code==='ENOENT');fresh();await mkdir(qa.artifactRoot,{mode:0o700});rootCreated=true;
    assert.equal(await realpath(qa.artifactRoot),qa.artifactRoot);cases.push('EXACT_ISOLATED_DATABASE_51');
    phase='CATALOG';
    const catalog=buildOfficialForms(await readFile(new URL('../docs/design/공식산출물_양식정의.md',import.meta.url)),await readFile(new URL('../docs/design/문서작성_공통기준.md',import.meta.url)));
    const methods=buildBuiltinMethodologies(await readFile(new URL('../docs/design/기본방법론_상세검토안.md',import.meta.url)),catalog.forms);
    const catalogClient=await admin.connect();
    try{fresh();await catalogClient.query('BEGIN');await seedOfficialForms(catalogClient,catalog);await seedBuiltinMethodologies(catalogClient,methods,catalog.forms);fresh();await catalogClient.query('COMMIT');}catch(e){await catalogClient.query('ROLLBACK');throw e;}finally{catalogClient.release();}
    const source=(await admin.query("SELECT * FROM anvil.methodology_versions WHERE definition_id='a6f20000-0000-4000-8000-000000000001' AND version=2")).rows[0];assert(source);
    const snapshot={name:source.name,purpose:source.purpose,graph:source.graph_json,sourceRef:{id:source.definition_id,version:2,contentHash:source.content_hash}};
    const stage=snapshot.graph.nodes.find((node:any)=>node.role==='STAGE_OWNER');assert(stage);
    const applicationRef={id:application,version:1,contentHash:contentHash(canonicalJson(snapshot))},password=randomBytes(32).toString('base64url'),phc=await hashPassword(password),seed=await admin.connect();
    phase='SYNTHETIC_SEED';
    try{fresh();await seed.query('BEGIN');
      await seed.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'C1 격리 합성 사용자','ACTIVE')",[user,'qa-c1-'+user]);
      await seed.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)',[user,phc]);
      await seed.query("INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,'C1 격리','사용자 소유 통제','예약과 준비 저장')",[project]);
      await seed.query("INSERT INTO anvil.project_members(project_id,user_id,participation) VALUES($1,$2,'OWNER')",[project,user]);
      await seed.query('INSERT INTO anvil.project_methodologies(id,project_id,application_version,source_definition_id,source_version,source_hash,snapshot_json,snapshot_hash,created_by) VALUES($1,$2,1,$3,2,$4,$5,$6,$7)',[application,project,source.definition_id,source.content_hash,JSON.stringify(snapshot),applicationRef.contentHash,user]);
      fresh();await seed.query('COMMIT');
    }catch(e){await seed.query('ROLLBACK');throw e;}finally{seed.release();}
    phase='LOGIN';let login=await access.login('qa-c1-'+user,password,'C1 isolated','c1-prep-01');
    await admin.query('INSERT INTO anvil.project_control(project_id,actor_id,client_id,generation) VALUES($1,$2,$3,1)',[project,user,login.clientId]);
    login=await access.reauthenticate(login.token,login.csrfToken,password,'c1-prep-01');
    const session={user:{id:user},clientId:login.clientId,csrfToken:login.csrfToken},headers={host:'localhost:3830',origin:'https://localhost:3830',cookie:'__Host-anvil.sid='+login.token,'x-anvil-csrf':login.csrfToken};
    const envelope={schemaVersion:1,projectId:project,clientId:login.clientId,controlGeneration:1,targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null};
    const send=async(command:any)=>{fresh();const response=await app.inject({method:'POST',url:'/api/v1/projects/'+project+'/commands',headers,payload:command});lastResponseCode=response.statusCode>=400?response.json().code:null;return response;};
    const command=(operation:string,payload:any,extra:any={})=>({...envelope,commandId:randomUUID(),operation,payload,...extra});
    const save=async(operation:string,payload:any,extra:any={})=>{const response=await send(command(operation,payload,extra));assert.equal(response.statusCode,200);return response.json().data;};
    const client=new ApiClient(async(url,init)=>{fresh();assert(String(url).startsWith('/api/v1/'));const body=init?.body;
      const payload=body instanceof Blob?Buffer.from(await body.arrayBuffer()):body instanceof Uint8Array?Buffer.from(body):body==null?undefined:typeof body==='string'?body:(()=>{throw Error('C1_WORKFLOW_BODY_INVALID');})();
      fresh();const r=await app.inject({method:(init?.method??'GET')as any,url:String(url),headers:{...headers,...init?.headers as Record<string,string>},payload});lastResponseCode=r.statusCode>=400?r.json().code:null;return new Response(r.body,{status:r.statusCode,headers:{'content-type':String(r.headers['content-type']??'')}});});
    phase='POLICY';
    const coordinatorInput={kind:'COORDINATOR',stageRef:null,parentRoleRef:null,reason:'격리 역할'};
    assert.equal((await send(command('defineProjectRole',coordinatorInput))).statusCode,403);cases.push('EXPLICIT_POLICY_REQUIRED');
    const operations=['uploadArtifact','saveDocumentDraft','recordContentReview','confirmDocument','indexDesignDocument','saveWorkPlanDraft','confirmWorkPlan','prepareAssignment','reviewAssignmentContent','confirmAssignment','defineProjectRole','bindResponsibleSession','prepareExecution','buildTaskContext','registerConnection','saveEnvironment'];
    const policy=await save('savePermissionPolicy',{rules:[{ruleId:'C1_QA_ONLY',subjectRef:{kind:'HUMAN',userId:user},targetScopes:[{kind:'PROJECT',projectId:project}],operations,disposition:'AUTO',limitPolicyRef:null,expiresAt:new Date(deadline).toISOString()}],reason:'일회 격리 합성 정책',reviewRefs:[]});
    async function confirmedDocument(formId:string,title:string,lead:string) {
      fresh();const r=await app.inject({method:'GET',url:'/api/v1/forms/'+formId+'/versions/1',headers});assert.equal(r.statusCode,200);
      const form=r.json(),draft=newDocument(project,form,user,1),text=[lead];
      for(const item of(form.definition as FormDefinition).items){draft.content.sections.push({itemId:item.itemId,anchor:'line:'+(text.length+1)});text.push('## '+item.title);if(item.valueType==='TEXT')text.push('격리 합성 내용과 검수 조건이다.');else text.push('| '+item.fields.map(f=>f.fieldId).join(' | ')+' |','| '+item.fields.map(()=>'---').join(' | ')+' |','| '+item.fields.map((_,n)=>'합성'+n).join(' | ')+' |');}
      Object.assign(draft,{title,body:text.join('\n'),reason:'C1 합성 선행',dirty:true});const ref=await continueDocumentSave(client,await prepareDocumentSave(draft,session),session,()=>{},()=>true),view=await readDocument(client,project,ref.id,ref.version);assert.equal(view.document.validation.validForConfirmation,true);
      const review=newDocumentReview(project,view.document,user,1);review.items=review.items.map(i=>({...i,outcome:'ACCEPTED',reason:'합성 검수'}));review.outcome='ACCEPTED';review.reason='사용자 인수 아님';review.pending=prepareDocumentReview(review,session);await sendDocumentReview(client,review,session,()=>true);
      const confirm=newDocumentConfirmation(project,(await readDocument(client,project,ref.id,ref.version)).document,user,1);confirm.acknowledged=true;confirm.pending=prepareDocumentConfirmation(confirm,session);await sendDocumentConfirmation(client,confirm,session,()=>true);return ref;
    }
    phase='DOCUMENTS';const designTitle='C1 책임 준비',taskTitle='C1 예약 준비';
    const designRef=await confirmedDocument('a6f30000-0000-4000-8000-000000000002','합성 설계','# D11 '+designTitle);
    const planDoc=await confirmedDocument('a6f30000-0000-4000-8000-000000000004','합성 계획','# FN01 '+taskTitle);
    const index=await save('indexDesignDocument',{documentRef:designRef,items:[{localCode:'D11',title:designTitle,anchor:'line:1'}],screens:[],reason:'합성 설계 연결'},{targetId:designRef.id,expectedVersion:1});
    const task={taskCode:'FN01',type:'FUNCTION',title:taskTitle,purpose:'사용자 소유 통제',designRefs:[{kind:'DESIGN_ITEM',id:index.designItems[0].id,versionRef:designRef,localCode:'D11',anchor:'line:1'}],screenRefs:[],ownerRole:'단계책임자',inputs:['확정 설계'],outputs:['준비 기록'],included:['예약 준비'],excluded:['Agent 실행'],allowedFileRefs:['src/a.ts'],startPrerequisites:[],acceptancePrerequisites:[],steps:['내용 검토'],testCases:['NORMAL','IMPORTANT_FAILURE','DIRECT_IMPACT'].map((kind,n)=>({id:'T'+n,kind,steps:['확인'],expected:'실행 아님',environment:'WSL'})),acceptanceCriteria:['원문 보존'],evidenceRequirements:['불변 ref'],rollback:'해당 격리 정리',recoveryNotes:'현재 사실 기록'};
    phase='PLAN';const savedPlan=await save('saveWorkPlanDraft',{documentRef:planDoc,designRef,screenReviewRefs:[],tasks:[task],reason:'합성 준비'});
    assert.deepEqual(savedPlan.workPlan.issues,[]);const plan=await readWorkPlan(client,project,savedPlan.ref);
    const pr=newWorkPlanDecision(project,await readWorkPlanDecision(client,project,plan),session,1,'REVIEW');pr.items=pr.items.map(i=>({...i,outcome:'ACCEPTED',reason:'합성 검수'}));pr.outcome='ACCEPTED';pr.reason='사용자 인수 아님';pr.pending=prepareWorkPlanDecision(pr,session);await sendWorkPlanDecision(client,pr,session,()=>true);
    const pc=newWorkPlanDecision(project,await readWorkPlanDecision(client,project,plan),session,1,'CONFIRM');pc.acknowledged=true;pc.pending=prepareWorkPlanDecision(pc,session);await sendWorkPlanDecision(client,pc,session,()=>true);
    phase='ASSIGNMENT';const buffer=newAssignmentDraft(project,session,1,plan,'FN01',applicationRef,stage.nodeId);
    buffer.input.reason='합성 임무';buffer.input.definition.integrationResponsibility='책임자 통합';buffer.input.definition.requiredCapabilities=['FILE_WRITE'];
    const reference=()=>({id:randomUUID(),version:1,contentHash:'a'.repeat(64)});
    buffer.input.definition.allowedScopes=[{sourceRootRef:reference(),mappingRef:null,observationRef:reference(),baselineRef:reference(),targets:[{relativePath:'src/a.ts',kind:'FILE',access:'WRITE',recursive:false}]}];
    const draft=await sendAssignmentDraft(client,prepareAssignmentWrite(buffer,session),designRef,session.csrfToken);
    const ar=newAssignmentDecision(draft,session,1,'REVIEW',[]),ari=ar.input as AssignmentContentReview;ari.items=ari.items.map(i=>({...i,outcome:'ACCEPTED',reason:'합성 내용 검수'}));ari.outcome='ACCEPTED';ari.reason='실행 아님';ar.acknowledged=true;
    const reviewed=await sendAssignmentDecision(client,prepareAssignmentDecision(ar,session),draft,session);
    const ac=newAssignmentDecision(draft,session,1,'CONFIRM',[reviewed.ref]);ac.input.reason='별도 합성 내용 확정';ac.acknowledged=true;
    const confirmed=await sendAssignmentDecision(client,prepareAssignmentDecision(ac,session),draft,session),assignmentHash=confirmed.ref.contentHash;
    phase='CANDIDATES';const candidate=async(kind:string)=>save(kind==='CONNECTION_CANDIDATE'?'registerConnection':'saveEnvironment',{kind,candidate:{label:'C1 합성 후보'},candidateRef:null,policyRef:policy.ref,expiresAt:new Date(deadline).toISOString(),reason:'실제 연결 아님'});
    const connection=await candidate('CONNECTION_CANDIDATE'),environment=await candidate('ENVIRONMENT_CANDIDATE');
    phase='ROLES';const coordinatorCommand=command('defineProjectRole',coordinatorInput),coordinator=await send(coordinatorCommand);assert.equal(coordinator.statusCode,200);
    assert.deepEqual((await send(coordinatorCommand)).json(),coordinator.json());assert.equal((await send({...coordinatorCommand,payload:{...coordinatorInput,reason:'다른 내용'}})).statusCode,409);cases.push('ROLE_EXACT_REPLAY');
    const roleData=await save('defineProjectRole',{kind:'STAGE_OWNER',stageRef:{applicationRef,nodeId:stage.nodeId},parentRoleRef:coordinator.json().data.ref,reason:'합성 단계책임'});
    phase='BIND';const bindingInput={assignmentRef:confirmed.ref,roleRef:roleData.ref,connectionRef:connection.ref,existingSessionBindingRef:null,reason:'합성 예약'};
    const binding=await save('bindResponsibleSession',bindingInput);
    assert.equal(binding.snapshot.state,'RESERVED');assert.equal(binding.snapshot.externalSessionHandleRef,null);assert.equal(binding.snapshot.executionAuthorized,false);
    const reused=await save('bindResponsibleSession',{...bindingInput,existingSessionBindingRef:binding.ref},{targetId:binding.ref.id,expectedVersion:1});
    assert.deepEqual(reused.snapshot.sessionRef,binding.snapshot.sessionRef);assert.equal(reused.ref.version,2);
    assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.agent_sessions')).rows[0].n,1);cases.push('RESERVED_COMMIT_SAME_SESSION_REUSE');
    phase='CONTEXT';const context=await save('buildTaskContext',{assignmentRef:confirmed.ref,budgetRef:null,slots:contextSlotCodes.map(code=>({code,sources:[],reason:'미제공은 누락 유지'})),limits:{maxPartBytes:4096,maxParts:200},reason:'실제 전달 아님'});
    phase='PREPARATION';const intent={projectId:project,assignmentRef:confirmed.ref,roleBindingRef:reused.ref,contextBundleRef:context.ref,connectionRef:connection.ref,environmentRef:environment.ref,capabilityRef:reference(),budgetPolicyRef:reference(),sourceScopes:structuredClone(buffer.input.definition.allowedScopes),mode:'WORK',reason:'합성 준비만 저장'};
    const preparationCommand=command('prepareExecution',intent),prepared=await send(preparationCommand);assert.equal(prepared.statusCode,200);const preparation=prepared.json().data;
    assert.equal(preparation.snapshot.authorizationState,'NOT_AUTHORIZED');assert.equal(preparation.snapshot.dispatchPerformed,false);assert(preparation.snapshot.missingConditions.includes('HOST_OS_FENCE_UNVERIFIED'));
    for(const [path,ref,expected]of[['role-bindings',reused.ref,reused.snapshot],['execution-preparations',preparation.ref,preparation.snapshot]]as const){fresh();const r=await app.inject({method:'GET',url:'/api/v1/projects/'+project+'/'+path+'/'+ref.id+'/versions/'+ref.version,headers});assert.equal(r.statusCode,200);assert.deepEqual(r.json().snapshot,expected);}
    assert.deepEqual((await send(preparationCommand)).json(),prepared.json());assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.execution_preparations')).rows[0].n,1);
    assert.equal((await readConfirmedAssignment(client,project,confirmed.ref,draft)).ref.contentHash,assignmentHash);cases.push('ACTUAL_PREPARATION_SAVE_READ_NO_EXECUTION','EXACT_PREPARATION_REPLAY');
    const wrongScope=structuredClone(intent);wrongScope.sourceScopes[0]!.targets[0]!.access='READ' as any;
    assert.equal((await send(command('prepareExecution',wrongScope))).statusCode,403);cases.push('WRITE_NOT_IMPLICIT_READ');
    phase='DIRECT_DML';
    for(const table of ['project_roles','agent_sessions','role_bindings','execution_preparations']){
      const columns=(await admin.query("SELECT column_name,is_generated FROM information_schema.columns WHERE table_schema='anvil' AND table_name=$1 ORDER BY ordinal_position",[table])).rows;
      fresh();await assert.rejects(pool.query(executionPreparationQaInsert(table,columns)),(e:any)=>e.code==='42501');
      await assert.rejects(pool.query('UPDATE anvil.'+table+" SET content_hash=repeat('f',64)"),(e:any)=>e.code==='42501');
      await assert.rejects(pool.query('DELETE FROM anvil.'+table),(e:any)=>e.code==='42501');
    }cases.push('ALL_FOUR_TABLES_DIRECT_DML_DENIED');
    phase='ROLLBACK';
    // 이번 새 격리에서만 의도적으로 INSERT 후 실패시켜 명령/영수증/준비 원자성을 검증한다.
    await admin.query("CREATE FUNCTION anvil_qa.fail_preparation() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SYNTHETIC_QA_ROLLBACK';END;$$;CREATE TRIGGER qa_preparation_rollback AFTER INSERT ON anvil.execution_preparations FOR EACH ROW EXECUTE FUNCTION anvil_qa.fail_preparation()");
    const failed=command('prepareExecution',{...intent,reason:'합성 rollback'});assert.equal((await send(failed)).statusCode,500);
    assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.commands WHERE command_id=$1',[failed.commandId])).rows[0].n,0);
    assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.execution_preparations')).rows[0].n,1);
    await admin.query('DROP TRIGGER qa_preparation_rollback ON anvil.execution_preparations;DROP FUNCTION anvil_qa.fail_preparation()');cases.push('FAILED_INSERT_ROLLS_BACK_COMMAND_AND_PREPARATION');
    phase='STALE_CONTROL';await admin.query('UPDATE anvil.project_control SET generation=2 WHERE project_id=$1',[project]);assert.equal((await send(command('prepareExecution',intent))).statusCode,409);cases.push('STALE_CONTROL_DENIED');phase='DONE';
    return {phase,cases,actualDatabaseVerified:true,browserVerified:false,agentCalls:0};
  }catch(error){const safe=sourceReadQaError(error);console.log('C1_WORKFLOW_FAILURE '+JSON.stringify({phase,cases,lastResponseCode:typeof lastResponseCode==='string'&&/^[A-Z0-9_]{1,80}$/.test(lastResponseCode)?lastResponseCode:null,...safe,expected:typeof(error as any)?.expected==='number'?(error as any).expected:null,actual:typeof(error as any)?.actual==='number'?(error as any).actual:null}));throw Error('C1_WORKFLOW_FAILED');}
  finally{const closed=await Promise.allSettled([app.close(),pool.end(),admin.end(),rootCreated?cleanExecutionPreparationQaRoot():Promise.resolve(0)]);console.log('C1_WORKFLOW_CLEANUP '+JSON.stringify({closeFailures:closed.slice(0,3).filter(r=>r.status==='rejected').length,artifactFiles:closed[3]?.status==='fulfilled'?closed[3].value:null,artifactCleanup:closed[3]?.status==='fulfilled'}));if(closed.some(r=>r.status==='rejected'))throw Error('C1_WORKFLOW_CLEANUP_FAILED');}
}

if(process.argv[2]==='--workflow') {
  try{
    const git=(args:string[])=>execFileSync('/usr/bin/git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000}).trim(),schema=await buildExecutionPreparationQaSchema();
    const deadline=assertExecutionPreparationQaBinding({platform:process.platform,uid:process.getuid?.()??-1,cwd:await realpath(process.cwd()),module:qa.cwd+'/scripts/qa-execution-preparation.ts',head:git(['rev-parse','HEAD']),commit:process.env.ANVIL_C1_QA_SHA??'',dirty:git(['status','--porcelain']),remote:git(['remote','get-url','origin']),sqlHash:process.env.ANVIL_C1_QA_SQL_HASH??'',actualSqlHash:schema.sqlHash,expiresAt:process.env.ANVIL_C1_QA_EXPIRES_AT??'',env:process.env});
    assert.equal(await realpath(new URL(import.meta.url)),qa.cwd+'/scripts/execution-preparation-workflow-qa.ts');
    const app=process.env.ANVIL_C1_QA_APP_PASSWORD??'',migrator=process.env.ANVIL_C1_QA_MIGRATOR_PASSWORD??'';assert(/^[0-9a-f]{64}$/.test(app)&&/^[0-9a-f]{64}$/.test(migrator));
    console.log('C1_WORKFLOW_RESULT '+JSON.stringify(await executionPreparationWorkflow(process.env.ANVIL_C1_QA_HOST??'',{app,migrator},deadline,schema.manifest)));
  }catch{console.log('C1_WORKFLOW_EXIT_FAILED');process.exitCode=1;}
}
