import {canonicalJson} from '../../../contracts/canonical.ts';
import assert from 'node:assert/strict';
import test,{after,mock} from 'node:test';
import {criteriaFixture,criteriaHash as hash,criteriaId as id} from './result-criteria-fixture.ts';
import {resultFixture} from '../UI05/result-view-fixture.ts';
import {executionStartOriginFixture,installExecutionStartOriginMemoryFS,artifactCalls} from '../FN09/execution-start-origin-fixture.ts';
import type {Pool} from 'pg';
// 원 ArtifactStore를 import하기 전에 기존 RAM 전용 OS 포트를 설치한다. 다른 경로의 I/O는 fixture가 거절한다.
await installExecutionStartOriginMemoryFS();
after(()=>mock.restoreAll());
const {materialRules}=await import('../../../apps/server/modules/access/project-command.ts');
const {buildApp}=await import('../../../apps/server/app.ts');
const {AccessRepository,AuthFailure}=await import('../../../apps/server/modules/access/repository.ts');
const {ProjectResultSubmissions}=await import('../../../apps/server/modules/results/project-result-submissions.ts');
const {ProjectResultCriteria}=await import('../../../apps/server/modules/results/project-result-criteria.ts');
const {ProjectResultReviewSources}=await import('../../../apps/server/modules/results/project-result-review-sources.ts');
const {ProjectMethodologies}=await import('../../../apps/server/modules/methodologies/project-methodologies.ts');
const mod:any=await import('../../../apps/server/modules/results/project-result-reviews.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function fixture(){const f=criteriaFixture(),r=resultFixture();let at='2026-10-20T00:01:00.000Z';r.entry.snapshot.scope.projectId=f.assignment.projectId;r.entry.snapshot.scope.assignmentRef=f.assignment.ref;r.entry.snapshot.manifest.assignmentRef=f.assignment.ref;r.entry.snapshot.manifestHash=hash(r.entry.snapshot.manifest);r.entry.ref.contentHash=hash(r.entry.snapshot);const snapshot={assignmentRef:f.assignment.ref,baselineRefs:f.d.baselineRefs,items:[{criterionId:'flow',testId:'FLOW-01',kind:'BROWSER',environmentRef:f.d.environmentRef,required:true}]},criteria:any={projectId:f.assignment.projectId,ref:{id:id(9),version:1,contentHash:hash(snapshot)},snapshot,registryStored:true,reviewStored:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false};
 const actor:any={actorId:id(6),clientId:id(20),credentialGeneration:1,authSession:{id:id(21),idleExpiresAt:'2099-10-20T01:00:00.000Z',absoluteExpiresAt:'2099-10-20T02:00:00.000Z'}},input={resultRef:structuredClone(r.entry.ref),criteriaRef:structuredClone(criteria.ref),outcome:'REWORK',items:[{criterionId:'flow',outcome:'REWORK',evidenceRefs:[],reason:'실제 흐름 시험 미확인'}],reason:'누락 근거만 보완'},request:any={schemaVersion:1,projectId:f.assignment.projectId,commandId:id(22),clientId:actor.clientId,controlGeneration:1,operation:'evaluateResult',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:input};
 const rule={ruleId:'REVIEW_ONLY',subjectRef:{kind:'HUMAN',userId:actor.actorId},operations:['evaluateResult'],targetScopes:[{kind:'PROJECT',projectId:f.assignment.projectId}],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-10-20T01:00:00.000Z'},policy:any={id:id(23),head_version:1,rules_json:[rule],reason:'검수 기록만',review_refs:[],created_at:new Date(at),content_hash:hash({rules:[rule],reason:'검수 기록만',reviewRefs:[]})},policyRef={id:policy.id,version:1,contentHash:policy.content_hash},rows:any[]=[],commands=new Map<string,any>(),receipts=new Map<string,any>(),audits:any[]=[],calls:string[]=[];let member=true,controlled=true,head:any=policy,afterRead=()=>{};
 const db:any={query:async(sql:string,p:any[]=[])=>{calls.push(sql);if(sql.includes('JOIN anvil.project_members'))return{rows:member?[{id:request.projectId,participation:'OWNER',archived_at:null}]:[]};if(sql.includes('FROM anvil.project_control'))return{rows:controlled?[{actor_id:actor.actorId,client_id:actor.clientId,generation:1,revoked_at:null}]:[]};if(sql.includes('FROM anvil.permission_policies'))return{rows:head?[head]:[]};if(sql.includes('transaction_timestamp()')||sql.includes('clock_timestamp()'))return{rows:[{at:new Date(at)}]};
 if(sql.startsWith('SELECT operation,request_hash,result_ref FROM anvil.commands'))return{rows:[...commands.values()].filter(c=>c.project_id===p[0]&&c.actor_id===p[1]&&c.original_command_id===p[2]).map(c=>({operation:c.operation,request_hash:c.request_hash,result_ref:structuredClone(c.result_ref)}))};
 if(sql.startsWith('INSERT INTO anvil.commands')){commands.set(p[0],{project_id:p[1],operation:p[4],actor_id:p[2],client_id:p[3],original_command_id:p[5],request_hash:p[6],operation_id:p[7],state:'APPLIED',expected_version:p[10],control_generation:p[11],policy_ref:JSON.parse(p[12]),result_ref:JSON.parse(p[14]),authorization_receipt_id:p[8],approval_consumption_id:p[9],payload_ref:p[13],completed_at:new Date(at)});return{rows:[]};}
 if(sql.startsWith('INSERT INTO anvil.authorization_receipts')){receipts.set(p[0],{subject_ref:JSON.parse(p[3]),policy_ref:JSON.parse(p[4]),scope_digest:p[5],approval_decision_ref:p[6]});return{rows:[]};}
 if(sql.startsWith('INSERT INTO anvil.audit_events')){
  if(sql.includes("'SERVER_DENIAL'"))audits.push({project_id:p[0],command_id:null,outcome:'DENIED',source_kind:'SERVER_DENIAL',reason_code:p[5]});
  else audits.push({project_id:p[0],command_id:p[4],operation_id:p[5],target_ref:JSON.parse(p[6]),actor_ref:JSON.parse(p[2]),client_ref:p[3],policy_ref:JSON.parse(p[7]),approval_ref:p[8],outcome:'APPLIED',source_kind:'HUMAN_COMMAND',scope_digest:p[10],reason_code:p[9],correction_of:null,recorded_at:new Date(at)});
  return{rows:[]};
 }
 if(sql.startsWith('SELECT set_config'))return{rows:[]};
 if(sql.startsWith('INSERT INTO anvil.result_reviews')){rows.push({project_id:p[0],id:p[1],result_id:p[2],criteria_id:p[3],criteria_version:p[4],content_hash:p[5],snapshot_json:JSON.parse(p[6]),created_by:p[7],client_id:p[8],command_id:p[9],created_at:new Date(p[10])});return{rows:[],rowCount:1};}
 if(sql.startsWith('SELECT id,content_hash,to_char'))return{rows:rows.filter(r=>r.project_id===p[0]&&r.result_id===p[1]&&r.created_at<=new Date(p[2])&&(!p[3]||r.created_at<new Date(p[3])||r.created_at.getTime()===new Date(p[3]).getTime()&&r.id<p[4])).sort((a,b)=>b.created_at.getTime()-a.created_at.getTime()||b.id.localeCompare(a.id)).slice(0,21).map(r=>({id:r.id,content_hash:r.content_hash,cursor_at:r.created_at.toISOString()}))};
 if(sql.startsWith('SELECT id,content_hash FROM anvil.result_reviews')){assert(sql.includes('result_id=$2')&&sql.includes('LIMIT 21'));return{rows:rows.filter(r=>r.project_id===p[0]&&r.result_id===p[1]).sort((a,b)=>b.created_at.getTime()-a.created_at.getTime()||b.id.localeCompare(a.id)).slice(0,21).map(r=>({id:r.id,content_hash:r.content_hash}))};}
 if(sql.includes('FROM anvil.result_reviews v'))return{rows:rows.flatMap(r=>{
  const c=commands.get(r.command_id),ar=receipts.get(c?.authorization_receipt_id);
  if(!c||!ar||r.project_id!==p[0]||(p.length===2?r.id!==p[1]:c.actor_id!==p[1]||c.original_command_id!==p[2]))return [];
  const all=audits.filter(a=>a.command_id===r.command_id&&a.project_id===r.project_id),matched=all.filter(a=>(
   a.operation_id===c.operation_id&&a.outcome==='APPLIED'&&a.source_kind==='HUMAN_COMMAND'&&a.scope_digest===ar.scope_digest&&canonicalJson(a.target_ref)===canonicalJson(c.result_ref?.data?.ref??null)
   &&(!sql.includes('a.actor_ref=jsonb_build_object')||canonicalJson(a.actor_ref)===canonicalJson({kind:'HUMAN',userId:c.actor_id}))
   &&(!sql.includes('a.client_ref=c.client_id')||a.client_ref===c.client_id)
   &&(!sql.includes('a.policy_ref=c.policy_ref')||canonicalJson(a.policy_ref)===canonicalJson(c.policy_ref))
   &&(!sql.includes('a.approval_ref IS NULL')||a.approval_ref===null)
   &&(!sql.includes("a.reason_code='EXPLICIT_RESULT_REVIEW_NOT_ACCEPTANCE'")||a.reason_code==='EXPLICIT_RESULT_REVIEW_NOT_ACCEPTANCE')
   &&(!sql.includes('a.correction_of IS NULL')||a.correction_of===null)
   &&(!sql.includes('a.recorded_at=c.completed_at')||a.recorded_at.getTime()===c.completed_at.getTime())));
  return [{...structuredClone(r),...structuredClone(c),command_client_id:c.client_id,receipt_subject:ar.subject_ref,receipt_policy_ref:ar.policy_ref,scope_digest:ar.scope_digest,approval_decision_ref:ar.approval_decision_ref,audit_count:matched.length,...(sql.includes('AS audit_total')?{audit_total:all.length}:{})}];
 })};throw Error('UNEXPECTED_QUERY:'+sql);}};
 const results:any={read:async(_db:any,_actor:any,pid:string,key:string)=>{assert.equal(pid,request.projectId);assert.equal(key,r.entry.ref.id);afterRead();return structuredClone(r.entry);}},criterionReader:any={read:async()=>structuredClone(criteria)};return{actor,request,policy,policyRef,db,rows,calls,commands,audits,receipts,results,criterionReader,criteria,result:r.entry,clock:(v:string)=>at=v,member:(v:boolean)=>member=v,controlled:(v:boolean)=>controlled=v,policyHead:(v:any)=>head=v,afterRead:(fn:()=>void)=>afterRead=fn};
}
function service(f:ReturnType<typeof fixture>){assert.equal(typeof mod.ProjectResultReviews,'function','FN12 검수 판정 영속 제공자 미구현');return new mod.ProjectResultReviews(f.results,f.criterionReader);}

function reviewRoutes(t:import('node:test').TestContext,f:ReturnType<typeof fixture>){
 const origin='https://localhost:3830',csrf='C'.repeat(43),token='T'.repeat(43);
 const repository=new AccessRepository({connect:()=>assert.fail('실제 PG 금지')} as unknown as Pool,{installationId:id(81),key:Buffer.alloc(32,1)});
 Object.defineProperty(repository,'authenticated',{value:async(session:string,c:string|null,handle:Parameters<InstanceType<typeof AccessRepository>['authenticated']>[2])=>{
  if(session!==token)throw new AuthFailure('AUTH_REQUIRED',401);
  assert(c===null||c===csrf);return handle(f.db,f.actor);
 }});
 t.mock.method(ProjectResultSubmissions.prototype,'read',f.results.read);
 t.mock.method(ProjectResultCriteria.prototype,'read',f.criterionReader.read);
 const app=buildApp({},undefined,{repository,origin}),base=`/api/v1/projects/${f.request.projectId}`,headers={host:'localhost:3830',origin,cookie:`__Host-anvil.sid=${token}`};
 return{close:()=>app.close(),send:(payload=f.request)=>app.inject({method:'POST',url:base+'/commands',headers:{...headers,'x-anvil-csrf':csrf,'idempotency-key':payload.commandId},payload}),read:(key:string)=>app.inject({method:'GET',url:base+'/result-reviews/'+key,headers}),page:()=>app.inject({method:'GET',url:base+'/results/'+f.result.ref.id+'/review-pages',headers}),nextAction:(key:string)=>app.inject({method:'GET',url:base+'/result-reviews/'+key+'/next-action-basis',headers})};
}
test('IX02 QA A 실제 제출·기준·검수 HTTP와 UI05 재조회는 누락 시험/PASS 주장을 독립 증거로 승격하지 않는다',{timeout:30000},async()=>{
 const readers=[ProjectResultSubmissions.prototype.read,ProjectResultCriteria.prototype.read];
 // 원 임무는 기존 실제 RAM 생산·보호 reader를 사용한다. 제출/기준/검수 행은 아직 없다.
 const f=await executionStartOriginFixture(),assignment=await f.run(a=>f.assignments.read(f.db,a,f.pid,f.confirmed.data.ref.id,1));
 const {pgExecutionFixture}=await import('./result-execution-pg-fixture.ts');
 const {planSyntheticExecutionGrant}=await import('../../../apps/server/modules/executions/execution-grants.ts');
 const {readSyntheticResultExecutionReference}=await import('../../../apps/server/modules/results/result-execution-reference.ts');
 // 기존 결과 reader가 지원하는 SYNTHETIC_ONLY 역사만 배치한다. normal/OS/PREPARED 권위가 아니다.
 const base=pgExecutionFixture(),fact=structuredClone(base.f.grant.snapshot.binding);
 fact.projectId=f.pid;fact.intent.projectId=f.pid;fact.intent.assignmentRef=assignment.ref;
 Object.assign(fact.subject,{userId:f.uid,clientId:f.cid,humanSessionId:f.actor.authSession.id,controlGeneration:1,credentialGeneration:f.actor.credentialGeneration});
 const grant={ref:structuredClone(base.f.grant.ref),snapshot:planSyntheticExecutionGrant(fact,base.f.grant.snapshot.plannedAt).snapshot};grant.ref.contentHash=hash(grant.snapshot);
 const snapshot=structuredClone(base.f.command.snapshot);snapshot.grantRef=grant.ref;snapshot.humanSessionId=f.actor.authSession.id;
 Object.assign(snapshot.envelope.context,{projectId:f.pid,assignmentId:assignment.ref.id});
 const {envelope:_,...intent}=snapshot,commandRef={...base.f.command.ref,contentHash:hash(intent)},historical=structuredClone(base.row);
 const c=historical.command,ar=historical.receipt;
 Object.assign(c,{project_id:f.pid,scope_id:f.pid,actor_id:f.uid,client_id:f.cid,control_generation:1});
 Object.assign(ar,{scope_id:f.pid,subject_ref:{kind:'HUMAN',userId:f.uid,clientId:f.cid},scope_digest:hash({projectId:f.pid,actorId:f.uid,clientId:f.cid,controlGeneration:1,requestHash:c.request_hash,policyRef:c.policy_ref,targetRef:commandRef})});
 const authorizationRef={id:ar.id,version:1,contentHash:ar.scope_digest};snapshot.envelope.context.authorizationReceiptRef=authorizationRef;
 const {envelopeHash:__,...unsigned}=snapshot.envelope;snapshot.envelope.envelopeHash=hash(unsigned);
 Object.assign(historical.execution,{project_id:f.pid,created_by:f.uid,client_id:f.cid});
 Object.assign(historical.grant,{project_id:f.pid,content_hash:grant.ref.contentHash,snapshot_json:grant.snapshot,created_by:f.uid,client_id:f.cid});
 Object.assign(historical.queued,{project_id:f.pid,content_hash:commandRef.contentHash,snapshot_json:snapshot,envelope_hash:snapshot.envelope.envelopeHash,authorization_ref:authorizationRef});
 c.result_ref={status:'APPLIED',projectId:f.pid,targetId:commandRef.id,version:1,data:{ref:commandRef,status:'SYNTHETIC_QUEUE_STORED',snapshot:intent,executionAuthorized:false,dispatchPerformed:false}};
 const scope=readSyntheticResultExecutionReference({projectId:f.pid,assignmentRef:assignment.ref,executionId:historical.execution.id,executionGeneration:1},{command:{ref:commandRef,snapshot},grant}).scope;
 const submissions:any[]=[],criteria:any[]=[],reviews:any[]=[],denials:any[]=[],calls:{sql:string;args:any[]}[]=[],commits:string[][]=[];
 const raw=f.db.query;let saved:any,transaction=false,produced:string[]=[];
 const rows=(value:any[])=>({rows:structuredClone(value)});
 const joined=(row:any)=>{
  const command=f.commands.get(row.command_id),receipt=f.receipts.get(row.command_id),audit=f.audits.get(row.command_id);assert(command&&receipt&&audit);
  const matches=audit.operation_id===command.operation_id&&audit.outcome==='APPLIED'&&audit.source_kind==='HUMAN_COMMAND'&&audit.scope_digest===receipt.scope_digest&&hash(audit.target_ref)===hash(command.result_ref.data.ref)&&hash(audit.actor_ref)===hash({kind:'HUMAN',userId:command.actor_id})&&audit.client_ref===command.client_id&&hash(audit.policy_ref)===hash(command.policy_ref)&&audit.approval_ref===null&&audit.correction_of===null&&audit.recorded_at.getTime()===command.completed_at.getTime();
  return{...row,...command,id:row.id,command_id:row.command_id,original_command_id:command.command_id,command_client_id:command.client_id,receipt_subject:receipt.subject_ref,receipt_policy_ref:receipt.policy_ref,scope_digest:receipt.scope_digest,approval_decision_ref:receipt.approval_decision_ref,audit_total:1,audit_count:matches?1:0};
 };
 f.db.query=async(sql:string,args:any[]=[])=>{
  calls.push({sql,args:structuredClone(args)});
  if(sql==='BEGIN'){assert.equal(transaction,false);saved=structuredClone({submissions,criteria,reviews});transaction=true;produced=[];}
  if(sql==='ROLLBACK'){for(const[name,values]of Object.entries({submissions,criteria,reviews}))values.splice(0,values.length,...saved[name]);transaction=false;}
  if(sql.includes('AS execution,to_jsonb(q)')){assert.deepEqual(args,[f.pid,scope.executionRef.id,1]);return rows([historical]);}
  if(sql.startsWith('SELECT * FROM anvil.result_submissions'))return rows(submissions.filter(r=>r.project_id===args[0]&&r.id===args[1]));
  if(sql.startsWith('INSERT INTO anvil.result_submissions')){
   assert(transaction);assert.equal(submissions.length,0);submissions.push({project_id:args[0],id:args[1],execution_id:args[2],generation:args[3],assignment_ref:JSON.parse(args[4]),execution_ref:JSON.parse(args[5]),manifest_ref:JSON.parse(args[6]),manifest_hash:args[7],submission_state:args[8],submitted_by:args[9],client_id:args[10],command_id:args[11],content_hash:args[12],snapshot_json:JSON.parse(args[13]),submitted_at:new Date(args[14])});produced.push('submitResult');return{rows:[],rowCount:1};
  }
  if(sql.startsWith('INSERT INTO anvil.result_criteria_versions')){
   assert(transaction);assert.equal(criteria.length,0);criteria.push({project_id:args[0],criteria_id:args[1],version:args[2],assignment_ref:JSON.parse(args[3]),content_hash:args[4],criteria_json:JSON.parse(args[5]),input_json:JSON.parse(args[6]),created_by:args[7],client_id:args[8],command_id:args[9],created_at:new Date(args[10])});produced.push('saveResultCriteria');return{rows:[],rowCount:1};
  }
  if(sql.startsWith('INSERT INTO anvil.result_reviews')){
   assert(transaction);assert.equal(reviews.length,0);reviews.push({project_id:args[0],id:args[1],result_id:args[2],criteria_id:args[3],criteria_version:args[4],content_hash:args[5],snapshot_json:JSON.parse(args[6]),created_by:args[7],client_id:args[8],command_id:args[9],created_at:new Date(args[10])});produced.push('evaluateResult');return{rows:[],rowCount:1};
  }
  if(sql.includes('FROM anvil.result_criteria_versions v'))return rows(criteria.filter(r=>r.project_id===args[0]&&r.criteria_id===args[1]&&r.version===args[2]).map(joined));
  if(sql.includes('FROM anvil.result_reviews v'))return rows(reviews.filter(r=>r.project_id===args[0]&&r.id===args[1]).map(joined));
  if(sql.includes('FROM anvil.commands c')&&sql.includes('AS receipt')&&sql.includes('AS audit')){
   assert.equal(args[0],f.pid);assert.equal(args[2],args[1].length+1);
   return rows(args[1].flatMap((key:string)=>{const command=f.commands.get(key),receipt=f.receipts.get(key),audit=f.audits.get(key);return command&&receipt&&audit?[{...command,receipt,audit,authorized_at:receipt.authorized_at,recorded_at:audit.recorded_at}]:[];}));
  }
  if(sql.startsWith('INSERT INTO anvil.audit_events')&&sql.includes("'SERVER_DENIAL'")){assert(transaction);denials.push(structuredClone(args));return{rows:[],rowCount:1};}
  if(sql.startsWith('SELECT set_config')&&sql.includes('anvil.result_'))return rows([]);
  assert(!/^(?:INSERT INTO|UPDATE|DELETE FROM) anvil\.(?:executions|execution_grants|execution_commands|delivery_outbox|writer_claims|usage_reservations)\b/.test(sql),'결과 경로에서 실행 효과는 금지한다');
  const value=await raw(sql,args);
  if(sql.startsWith('INSERT INTO anvil.commands'))Object.assign(f.commands.get(args[0]),{draft_id:null,completed_at:new Date((await raw('SELECT transaction_timestamp() AS at',[])).rows[0].at)});
  if(sql.startsWith('INSERT INTO anvil.authorization_receipts'))f.receipts.get(args[2]).authorized_at=new Date((await raw('SELECT transaction_timestamp() AS at',[])).rows[0].at);
  if(sql.startsWith('INSERT INTO anvil.audit_events'))f.audits.get(args[4]).recorded_at=new Date((await raw('SELECT transaction_timestamp() AS at',[])).rows[0].at);
  if(sql==='COMMIT'){assert(transaction);commits.push([...produced]);transaction=false;}
  return value;
 };
 const app=buildApp({},undefined,{repository:f.access,origin:'https://anvil-synthetic.invalid',artifactRoot:f.root}),http:{method:string;path:string;operation?:string;status:number}[]=[];
 const {ApiClient}=await import('../../../apps/web/src/api/client.ts');
 const client=new ApiClient(async(url,options)=>{
  const path=String(url),method=options?.method??'GET';assert(path.startsWith(`/api/v1/projects/${f.pid}/`));assert(['GET','POST'].includes(method));assert.equal(options?.credentials,'same-origin');
  const headers=Object.fromEntries(new Headers(options?.headers).entries()),body=options?.body;
  const response=await app.inject({method:method as 'GET'|'POST',url:path,headers:{...headers,host:'anvil-synthetic.invalid',origin:'https://anvil-synthetic.invalid',cookie:`__Host-anvil.sid=${f.token}`},...(body===undefined?{}:{payload:String(body)})});
  http.push({method,path,status:response.statusCode,...(method==='POST'?{operation:JSON.parse(String(body)).operation}:{})});return new Response(response.body,{status:response.statusCode,headers:response.headers as Record<string,string>});
 });
 const session={user:{id:f.uid},clientId:f.cid,csrfToken:f.csrf},writesBefore=f.commands.size,artifactBefore={...artifactCalls};
 try{
  assert.deepEqual([submissions.length,criteria.length,reviews.length],[0,0,0]);
  const criteriaApi=await import('../../../apps/web/src/features/session-detail/result-criteria-api.ts'),submissionApi=await import('../../../apps/web/src/features/session-detail/result-submission-write-api.ts'),reviewApi=await import('../../../apps/web/src/features/session-detail/result-review-write-api.ts');
  const mapped=criteriaApi.criteriaRows(assignment).map((r,i)=>({...r,criterionId:'C'+i,testId:'QA-'+i,kind:'BROWSER'}));assert(mapped.length>=2);
  const manifest={assignmentRef:assignment.ref,executionRef:scope.executionRef,baselineRefs:assignment.snapshot.definition.baselineRefs,submissionState:'COMPLETED',changes:[],commandResults:[],testResults:[{criterionId:mapped[0]!.criterionId,testId:mapped[0]!.testId,baselineRefs:assignment.snapshot.definition.baselineRefs,expected:'직접 브라우저 시험과 출력',actual:'수행자가 PASS라고 보고했으나 출력 없음',status:'PASS',evidence:[]}],artifactRefs:[],unexecuted:[],risks:['독립 시험 출력 미제공'],rollback:'합성 원문 보존',checkpointRef:null};
  const buffer=await submissionApi.prepareResultSubmissionFile(new TextEncoder().encode(JSON.stringify({scope,manifest})),f.pid,assignment.ref,session,1);buffer.pending=await submissionApi.prepareResultSubmitCommand(buffer,session,true);
  const submitted=await submissionApi.sendResultSubmission(client,buffer,session,()=>true);assert.equal(submitted.sourceKind,'WORKER_CLAIM');
  const result=await client.get<any>(`/api/v1/projects/${f.pid}/results/${submitted.submissionId}`);assert.deepEqual(result.snapshot.manifest,manifest);assert.equal(result.snapshot.evidenceProvenanceVerified,false);assert.equal(result.snapshot.completionAccepted,false);
  const prepared=await criteriaApi.prepareCriteriaRegistration(assignment,mapped,'필수 직접 시험과 증거 조건',session,1),registered=await criteriaApi.saveCriteriaRegistration(client,prepared,session,()=>true);assert(registered);
  const {readReportedCoverage}=await import('../../../apps/web/src/features/session-detail/reported-coverage-api.ts');const coverage=await readReportedCoverage(client,result,registered,()=>true);assert(coverage);
  assert.equal(coverage.items[0]!.state,'REPORTED_ONLY');assert(coverage.items[0]!.reasons.includes('EVIDENCE_NOT_VERIFIED'));assert.equal(coverage.items[1]!.state,'NOT_REPORTED');assert(coverage.items.every(i=>i.verificationState==='NOT_VERIFIED'));assert.equal(coverage.evidenceProvenanceVerified,false);assert.equal(coverage.completionAccepted,false);
  const input={resultRef:result.ref,criteriaRef:registered.ref,outcome:'REWORK',items:registered.snapshot.items.map(i=>({criterionId:i.criterionId,outcome:'REWORK',evidenceRefs:[],reason:'독립 시험 출력/근거가 누락되어 보완 필요'})),reason:'PASS 주장은 독립 검증이 아니며 빠진 출력 보완 필요'};
  const pending=await reviewApi.prepareResultReviewWrite(result,registered,input,session,1),before={commands:f.commands.size,receipts:f.receipts.size,audits:f.audits.size};
  const denied={...structuredClone(pending.command),commandId:crypto.randomUUID(),payload:{...input,outcome:'ACCEPTED',items:input.items.map(i=>({...i,outcome:'ACCEPTED'}))}},negativeStart=calls.length;
  const rejection=await client.transport.call(globalThis,`/api/v1/projects/${f.pid}/commands`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Anvil-CSRF':f.csrf,'Idempotency-Key':denied.commandId},body:JSON.stringify(denied)});
  assert.equal(rejection.status,422);assert.equal((await rejection.json()).code,'RESULT_REVIEW_EVIDENCE_VERIFICATION_REQUIRED');assert.equal(reviews.length,0);assert.deepEqual({commands:f.commands.size,receipts:f.receipts.size,audits:f.audits.size},before);assert.equal(denials.length,1,'정상 SERVER_DENIAL 감사는 성공 저장과 구분한다');
  const guarded=calls.slice(negativeStart);
  assert(guarded.some(c=>c.sql.startsWith('SELECT * FROM anvil.result_submissions WHERE project_id=$1 AND id=$2')&&canonicalJson(c.args)===canonicalJson([f.pid,result.ref.id])),'ACCEPTED도 실제 원 제출을 정확 ID로 보호 재조회한다');
  assert(guarded.some(c=>c.sql.includes('FROM anvil.result_criteria_versions v')&&canonicalJson(c.args)===canonicalJson([f.pid,registered.ref.id,registered.ref.version])),'같은 요청의 실제 고정 기준을 정확 ID/버전으로 보호 재조회한다');
  assert.equal(guarded.filter(c=>c.sql.startsWith('INSERT INTO anvil.result_reviews(')).length,0,'보호 원본을 검산한 뒤 증거 없는 합격은 검수 INSERT 전에 거절한다');
  const savedReview=await reviewApi.saveResultReviewWrite(client,pending,session,()=>true);assert(savedReview);assert.deepEqual(savedReview.snapshot.input,input);assert.deepEqual(savedReview.snapshot.scope,scope);assert.equal(savedReview.snapshot.reviewedBy.userId,f.uid);
  for(const key of ['completionAccepted','formalFailureCounted','evidenceProvenanceVerified','executionAuthorized','dispatchPerformed']as const)assert.equal(savedReview[key],false);
  assert.deepEqual(commits.flat(),['submitResult','saveResultCriteria','evaluateResult']);assert.deepEqual([submissions.length,criteria.length,reviews.length],[1,1,1]);assert.equal(f.commands.size,writesBefore+3);
  assert.deepEqual(http.filter(v=>v.method==='POST').map(v=>[v.operation,v.status]),[['submitResult',200],['saveResultCriteria',200],['evaluateResult',422],['evaluateResult',200]]);
  assert.equal(http.at(-1)!.path,`/api/v1/projects/${f.pid}/result-reviews/${savedReview.ref.id}`);assert.equal(http.at(-1)!.method,'GET');
  // 이 음성 여정은 출력·evidence가 없으므로 보호 파일 판독을 시작하지 않는다. 원문 검증 성공의 증거가 아니다.
  assert.deepEqual({...artifactCalls},artifactBefore,'제출부터 검수 재조회까지 RAM 파일 open/read/close/write 추가 0');assert.deepEqual([ProjectResultSubmissions.prototype.read,ProjectResultCriteria.prototype.read],readers);assert.equal(transaction,false);
 }finally{await app.close();f.db.query=raw;}
});
test('HTTP 상세·페이지·동일 명령 재확인·다음 행동은 보관된 검수 응답 전체를 대조한다',async t=>{
 for(const [name,patch] of [
  ['operationId',{operationId:id(98)}],
  ['evidenceRefs',{evidenceRefs:[{id:id(98),version:1,contentHash:'e'.repeat(64)}]}],
  ['warnings',{warnings:['추가된 경고']}],
  ['additional key',{unexpected:true}],
 ] as const)await t.test(name,async sub=>{
  const f=fixture(),route=reviewRoutes(sub,f);
  const source=sub.mock.method(ProjectResultReviewSources.prototype,'read',async()=>assert.fail('손상된 검수의 후속 원자료 조회'));
  const application=sub.mock.method(ProjectMethodologies.prototype,'readApplication',async()=>assert.fail('손상된 검수의 후속 방법론 조회'));
  try{
   const first=await route.send();assert.equal(first.statusCode,200,first.body);
   const review=first.json().data.ref,before=f.calls.length;
   const read=await route.read(review.id),page=await route.page(),replay=await route.send();
   assert.deepEqual([read.statusCode,page.statusCode,replay.statusCode],[200,200,200]);
   assert.deepEqual(read.json().ref,review);assert.deepEqual(page.json().items.map((item:any)=>item.ref),[review]);
   assert.deepEqual(replay.json(),first.json());
   const command=f.commands.get(f.rows[0].command_id);command.result_ref={...command.result_ref,...patch};
   const damaged=[await route.read(review.id),await route.page(),await route.send(),await route.nextAction(review.id)];
   assert.deepEqual(damaged.map(response=>[response.statusCode,response.json().code]),
    Array.from({length:4},()=>[503,'RESULT_REVIEW_LEDGER_INVALID']));
   assert.equal(source.mock.callCount()+application.mock.callCount(),0);
   assert(!f.calls.slice(before).some(sql=>/^(INSERT|UPDATE|DELETE)/.test(sql)));
   assert.deepEqual([f.rows.length,f.commands.size,f.receipts.size,f.audits.length],[1,1,1,1]);
  }finally{await route.close();}
 });
});

test('보관 검수는 별도 현재 정책·제어 없이 다른 정상 VIEWER에게 당시 원 검수자를 보존한다',async()=>{
 const f=fixture(),s=service(f),saved=await s.save(f.db,f.actor,f.request,f.policyRef);
 const viewer={...f.actor,actorId:id(98),clientId:id(97)},before=f.calls.length,query=f.db.query;
 f.controlled(false);f.policyHead(null);
 f.db.query=async(sql:string,params:unknown[])=>{
  const result=await query(sql,params);
  if(sql.includes('JOIN anvil.project_members')){
   assert.deepEqual(params,[f.request.projectId,viewer.actorId]);
   for(const member of result.rows)member.participation='VIEWER';
  }
  return result;
 };
 const view=await s.read(f.db,viewer,f.request.projectId,saved.data.ref.id);
 assert.deepEqual(view.ref,saved.data.ref);assert.equal(view.snapshot.reviewedBy.userId,f.actor.actorId);
 assert(!f.calls.slice(before).some(sql=>sql.includes('project_control')||sql.includes('permission_policies')||/^(INSERT|UPDATE|DELETE)/.test(sql)));
 f.member(false);
 await assert.rejects(s.read(f.db,viewer,f.request.projectId,saved.data.ref.id),{message:'NOT_FOUND',statusCode:404});
});

test('HTTP 검수 재확인과 원문 조회는 정상 감사 옆에 추가된 다른 감사를 검출한다',async t=>{
 const f=fixture(),route=reviewRoutes(t,f);
 try{
  const first=await route.send();assert.equal(first.statusCode,200,first.body);
  const id=first.json().data.ref.id,before=f.calls.length;
  const reason='최신 정책도 같은 검수 허용';
  f.policyHead({...f.policy,head_version:2,reason,content_hash:hash({rules:f.policy.rules_json,reason,reviewRefs:[]})});
  const replay=await route.send();assert.equal(replay.statusCode,200,replay.body);assert.deepEqual(replay.json(),first.json());
  assert.equal((await route.read(id)).statusCode,200);
  f.audits.push({...f.audits[0],scope_digest:'e'.repeat(64)});
  const post=await route.send(),get=await route.read(id);
  assert.deepEqual([post.statusCode,get.statusCode],[503,503]);assert.equal(post.json().code,'RESULT_REVIEW_LEDGER_INVALID');assert.equal(get.json().code,post.json().code);
  assert(!f.calls.slice(before).some(sql=>/^(INSERT|UPDATE|DELETE)/.test(sql)));
 }finally{await route.close();}
});
test('HTTP 검수 원 감사가 한 건이어도 주체·정책·근거·원 시각 손상은 거절한다',async t=>{
 const f=fixture(),route=reviewRoutes(t,f);
 try{
  const first=await route.send();assert.equal(first.statusCode,200,first.body);
  const key=first.json().data.ref.id,original=f.audits[0],before=f.calls.length;
  for(const patch of [{actor_ref:{kind:'HUMAN',userId:id(93)}},{client_ref:id(93)},
   {policy_ref:{...f.policyRef,contentHash:'e'.repeat(64)}},{approval_ref:{id:id(93),version:1,contentHash:'e'.repeat(64)}},
   {reason_code:'DIFFERENT_REASON'},{correction_of:id(93)},{recorded_at:new Date(original.recorded_at.getTime()+1)}]){
   f.audits[0]={...original,...patch};
   const post=await route.send(),get=await route.read(key);
   assert.deepEqual([post.statusCode,get.statusCode],[503,503],JSON.stringify(patch));
   assert.equal(post.json().code,'RESULT_REVIEW_LEDGER_INVALID');assert.equal(get.json().code,post.json().code);
  }
  assert(!f.calls.slice(before).some(sql=>/^(INSERT|UPDATE|DELETE)/.test(sql)));
 }finally{await route.close();}
});
test('HTTP 검수 재확인은 원행·근거 누락과 다른 정상 검수의 응답을 받아들이지 않는다',async t=>{
 for(const mode of ['ROW_MISSING','RECEIPT_MISSING','SOURCE_MISSING','AUDIT_MISMATCH','APPROVAL_LINK','PAYLOAD_REF','OTHER_RESPONSE','RESPONSE_SHAPE'] as const)await t.test(mode,async s=>{
  const f=fixture(),route=reviewRoutes(s,f);
  try{
   const first=await route.send();assert.equal(first.statusCode,200,first.body);const ref=first.json().data.ref;
   if(mode==='ROW_MISSING')f.rows.length=0;
   if(mode==='RECEIPT_MISSING')f.receipts.clear();
   if(mode==='SOURCE_MISSING')f.afterRead(()=>{throw new AuthFailure('NOT_FOUND',404);});
   if(mode==='AUDIT_MISMATCH')f.audits[0].scope_digest='e'.repeat(64);
   if(mode==='APPROVAL_LINK')f.commands.get(f.rows[0].command_id).approval_consumption_id=id(93);
   if(mode==='PAYLOAD_REF')f.commands.get(f.rows[0].command_id).payload_ref={kind:'ONE_TIME_APPROVAL_SCOPE'};
   if(mode==='OTHER_RESPONSE'||mode==='RESPONSE_SHAPE'){
    let other:unknown;
    if(mode==='OTHER_RESPONSE'){
     const response=await route.send({...f.request,commandId:id(93)});assert.equal(response.statusCode,200,response.body);
     other=response.json();assert.equal((await route.read(response.json().data.ref.id)).statusCode,200);
    }
    const query=f.db.query;f.db.query=async(sql:string,params:unknown[])=>{
     const data=await query(sql,params);
     if(sql.startsWith('SELECT operation,request_hash,result_ref FROM anvil.commands'))data.rows[0].result_ref=other??{...data.rows[0].result_ref,evidenceRefs:[ref]};
     return data;
    };
   }
   const before=f.calls.length,replay=await route.send();assert.equal(replay.statusCode,503,replay.body);assert.equal(replay.json().code,'RESULT_REVIEW_LEDGER_INVALID');
   assert(!f.calls.slice(before).some(sql=>/^(INSERT|UPDATE|DELETE)/.test(sql)));
   if(mode==='ROW_MISSING'||mode==='SOURCE_MISSING')assert.equal((await route.read(ref.id)).statusCode,404);
  }finally{await route.close();}
 });
});
test('HTTP 검수 재확인은 입력 충돌과 조회 도중의 현재 접근·제어·정책·기한 거절을 보존한다',async t=>{
 for(const [mode,status,code] of [
  ['CONFLICT',409,'IDEMPOTENCY_CONFLICT'],['MEMBER',404,'NOT_FOUND'],['CONTROL',403,'PROJECT_CONTROL_REQUIRED'],
  ['POLICY',412,'PERMISSION_POLICY_UNCONFIGURED'],['SESSION',409,'RESULT_REVIEW_CURRENT_REQUIRED'],
 ] as const)await t.test(mode,async s=>{
  const f=fixture(),route=reviewRoutes(s,f);
  try{
   const first=await route.send();assert.equal(first.statusCode,200,first.body);
   const before=f.calls.length;
   if(mode!=='CONFLICT')f.afterRead(()=>{
    if(mode==='MEMBER'){f.member(false);throw new AuthFailure('NOT_FOUND',404);}
    else if(mode==='CONTROL')f.controlled(false);
    else if(mode==='POLICY')f.policyHead(null);
    else f.clock(f.actor.authSession.idleExpiresAt);
   });
   const replay=await route.send(mode==='CONFLICT'?{...f.request,payload:{...f.request.payload,reason:'동일 명령의 다른 내용'}}:f.request);
   assert.equal(replay.statusCode,status,replay.body);assert.equal(replay.json().code,code);
   assert(!f.calls.slice(before).some(sql=>/^(INSERT|UPDATE|DELETE)/.test(sql)&&!sql.includes("'SERVER_DENIAL'")));
  }finally{await route.close();}
 });
});
test('원제출별 검수 이력은 명시20metadata와 미선택으로 재조회하며 쓰기/옛판정 대체를 하지 않는다',async()=>{const f=fixture(),s=service(f);assert.equal(typeof s.list,'function','원제출별 보관 검수 목록 미구현');assert.deepEqual((await s.list(f.db,f.actor,f.request.projectId,f.result.ref.id)).items,[]);const refs=[];for(let n=0;n<22;n++)refs.push((await s.save(f.db,f.actor,{...structuredClone(f.request),commandId:crypto.randomUUID()},f.policyRef)).data.ref);const writes=f.calls.filter(c=>c.startsWith('INSERT')).length,v=await s.list(f.db,f.actor,f.request.projectId,f.result.ref.id);assert.equal(v.items.length,20);assert.equal(v.hasMore,true);assert.equal(v.selectionState,'NOT_SELECTED');assert.deepEqual(v.resultRef,f.result.ref);assert.deepEqual(v.items.map((i:any)=>i.ref),refs.sort((a,b)=>b.id.localeCompare(a.id)).slice(0,20));assert(v.items.every((i:any)=>i.outcome==='REWORK'&&i.reviewStored===true&&i.completionAccepted===false&&i.formalFailureCounted===false&&i.sameAsSubmitter===(f.actor.actorId===f.result.snapshot.submittedByRef.id)&&!('snapshot'in i)&&!('input'in i)));assert.equal(f.calls.filter(c=>c.startsWith('INSERT')).length,writes);f.member(false);await assert.rejects(s.list(f.db,f.actor,f.request.projectId,f.result.ref.id),(e:any)=>e.statusCode===404);});
test('검수 판정은 별도 명시 정책 연산이며 정책 부재를 자동 부여하지 않는다',()=>{const f=fixture();assert.equal(materialRules(f.policy.rules_json,f.request.projectId,f.actor.actorId)[0]!.operations[0],'evaluateResult');});
test('원제출/기준의 명시 보완 판정과 HUMAN 동일성·영수증/감사를 저장 조회한다',async()=>{const f=fixture(),s=service(f),saved=await s.save(f.db,f.actor,f.request,f.policyRef);assert.equal(saved.data.status,'RESULT_REVIEW_RECORDED');assert.equal(saved.data.reviewStored,true);assert.equal(saved.data.completionAccepted,false);assert.equal(f.rows.length,1);const value=await s.read(f.db,f.actor,f.request.projectId,saved.data.ref.id);assert.deepEqual(value.ref,saved.data.ref);assert.deepEqual(value.snapshot.input,f.request.payload);assert.equal(value.snapshot.sameAsSubmitter,f.actor.actorId===f.result.snapshot.submittedByRef.id);assert.equal(value.snapshot.evidenceProvenanceVerified,false);assert.equal(f.calls.filter(c=>c.startsWith('INSERT INTO anvil.audit_events')).length,1);assert.equal(f.calls.filter(c=>c.startsWith('INSERT INTO anvil.authorization_receipts')).length,1);});
test('현재 제어/정책·세션·고정 원문과 실제 증거 없는 합격은 저장 전에 거절한다',async()=>{for(const alter of [(f:any)=>f.member(false),(f:any)=>f.controlled(false),(f:any)=>f.policyHead(null),(f:any)=>f.request.payload.outcome='ACCEPTED',(f:any)=>f.request.payload.resultRef.contentHash='f'.repeat(64),(f:any)=>f.actor.authSession.idleExpiresAt='2020-01-01T00:00:00.000Z',(f:any)=>f.afterRead(()=>f.controlled(false)),(f:any)=>f.criteria.registryStored=false]){const f=fixture();alter(f);await assert.rejects(service(f).save(f.db,f.actor,f.request,f.policyRef));assert.equal(f.rows.length,0);}});
test('다른 멤버/손상된 불변 행·명령/감사는 검수 이력으로 노출하지 않는다',async()=>{for(const alter of [(f:any)=>f.member(false),(f:any)=>f.rows[0].snapshot_json.input.reason='손상',(f:any)=>f.commands.values().next().value.result_ref.commandId=id(88),(f:any)=>f.rows[0].criteria_version=2]){const f=fixture(),s=service(f),saved=await s.save(f.db,f.actor,f.request,f.policyRef);alter(f);await assert.rejects(s.read(f.db,f.actor,f.request.projectId,saved.data.ref.id));}});

const pageSign=(value:string)=>hash({purpose:'MEMORY_CURSOR',value});
test('보관 검수 페이지는 실제 저장22건을 고정20/나머지2로 읽고 원30분과 원문을 보존한다',async()=>{
 const f=fixture(),s=service(f);assert.equal(typeof s.page,'function','보관 검수 page 생산자 미구현');
 for(let n=0;n<22;n++)await s.save(f.db,f.actor,{...structuredClone(f.request),commandId:crypto.randomUUID()},f.policyRef);
 const first=await s.page(f.db,f.actor,f.request.projectId,f.result.ref.id,{},pageSign);assert.equal(first.items.length,20);assert.equal(first.hasMore,true);assert.equal(Object.keys(first).length,9);assert.equal(first.pageSize,20);assert(first.nextCursor);assert(!Buffer.from(first.nextCursor.split('.')[0],'base64url').toString().includes(f.actor.authSession.id));
 const second=await s.page(f.db,f.actor,f.request.projectId,f.result.ref.id,{cursor:first.nextCursor},pageSign);assert.equal(second.items.length,2);assert.equal(second.hasMore,false);assert.equal(second.nextCursor,null);assert.deepEqual(second.window,first.window);assert.equal(new Set([...first.items,...second.items].map((i:any)=>i.ref.id)).size,22);assert.equal((await s.list(f.db,f.actor,f.request.projectId,f.result.ref.id)).items.length,20);
 for(const change of [(a:any)=>a.actorId=id(89),(a:any)=>a.clientId=id(89),(a:any)=>a.authSession.id=id(89),(a:any)=>a.credentialGeneration++]){const actor=structuredClone(f.actor);change(actor);await assert.rejects(s.page(f.db,actor,f.request.projectId,f.result.ref.id,{cursor:first.nextCursor},pageSign),(e:any)=>e.statusCode===400);}
 for(const query of [{cursor:''},{cursor:'x'.repeat(4097)},{cursor:first.nextCursor+'x'},{limit:'20'}])await assert.rejects(s.page(f.db,f.actor,f.request.projectId,f.result.ref.id,query,pageSign),(e:any)=>e.statusCode===400);
 f.member(false);await assert.rejects(s.page(f.db,f.actor,f.request.projectId,f.result.ref.id,{},pageSign),(e:any)=>e.statusCode===404);
});

test('페이지 취소는 원query 정착과 다르고 늦은 정착/반환뒤 재진입에 새query0이다',async()=>{
 const f=fixture(),s=service(f),controller=new AbortController();let release!:(v:any)=>void,settled=false,calls=0;
 const db:any={query:async()=>{calls++;return new Promise(resolve=>release=resolve);}};
 const pending=s.page(db,f.actor,f.request.projectId,f.result.ref.id,{},pageSign,controller.signal);void pending.then(()=>settled=true,()=>settled=true);assert.equal(calls,1);controller.abort();await Promise.resolve();assert.equal(settled,false,'abort는 DB정착이 아니다');release({rows:[{at:new Date('2026-10-20T00:01:00.000Z')}]});await assert.rejects(pending,(e:any)=>e.statusCode===410);assert.equal(calls,1);
 const g=fixture(),original=g.results.read;let owned:any;g.results.read=async(db:any,...args:any[])=>{owned=db;return Reflect.apply(original,g.results,[db,...args]);};await service(g).page(g.db,g.actor,g.request.projectId,g.result.ref.id,{},pageSign);const count=g.calls.length;await assert.rejects(owned.query('SELECT late'));assert.equal(g.calls.length,count);
 const already=new AbortController();already.abort();await assert.rejects(service(g).page(g.db,g.actor,g.request.projectId,g.result.ref.id,{},pageSign,already.signal));assert.equal(g.calls.length,count);
});
test('페이지 원창만료·세션최소기한/새append·빈끝을 보존하며 현재 접근을 다시 검산한다',async()=>{
 const f=fixture(),s=service(f);for(let n=0;n<22;n++)await s.save(f.db,f.actor,{...structuredClone(f.request),commandId:crypto.randomUUID()},f.policyRef);
 const first=await s.page(f.db,f.actor,f.request.projectId,f.result.ref.id,{},pageSign);f.clock('2026-10-20T00:02:00.000Z');const saved=await s.save(f.db,f.actor,{...structuredClone(f.request),commandId:crypto.randomUUID()},f.policyRef);const second=await s.page(f.db,f.actor,f.request.projectId,f.result.ref.id,{cursor:first.nextCursor},pageSign);assert.equal(second.items.length,2);assert(!second.items.some((i:any)=>i.ref.id===saved.data.ref.id));assert.deepEqual(second.window,first.window);
 f.rows.length=0;assert.equal((await s.page(f.db,f.actor,f.request.projectId,f.result.ref.id,{cursor:first.nextCursor},pageSign)).items.length,0);f.clock('2026-10-20T00:31:00.000Z');await assert.rejects(s.page(f.db,f.actor,f.request.projectId,f.result.ref.id,{cursor:first.nextCursor},pageSign),(e:any)=>e.statusCode===410);
 const g=fixture(),actor=structuredClone(g.actor);actor.authSession.idleExpiresAt='2026-10-20T00:01:10.000Z';const short=await service(g).page(g.db,actor,g.request.projectId,g.result.ref.id,{},pageSign);assert.equal(short.window.expiresAt,actor.authSession.idleExpiresAt);g.afterRead(()=>g.member(false));await assert.rejects(service(g).page(g.db,g.actor,g.request.projectId,g.result.ref.id,{},pageSign),(e:any)=>e.statusCode===404);
});

test('원30초 후 늦게 정착한 페이지query는 반환되지 않고 후속 materialquery0이다',async()=>{
 const f=fixture(),s=service(f),raw=f.db.query;let mono=0,release!:(v:any)=>void,entered=false;const descriptor=Object.getOwnPropertyDescriptor(performance,'now');Object.defineProperty(performance,'now',{value:()=>mono,configurable:true});
 try{const db:any={query:async(sql:string,p:any[])=>{if(sql.startsWith('SELECT id,content_hash,to_char')){entered=true;return new Promise(resolve=>release=resolve);}return raw(sql,p);}};const pending=s.page(db,f.actor,f.request.projectId,f.result.ref.id,{},pageSign);for(let i=0;i<50&&!entered;i++)await Promise.resolve();assert(entered);const n=f.calls.length;mono=30001;release({rows:[]});await assert.rejects(pending,(e:any)=>e.statusCode===410);assert.equal(f.calls.length,n);}finally{if(descriptor)Object.defineProperty(performance,'now',descriptor);else Reflect.deleteProperty(performance,'now');}
});

test('서명된 root 첫위치 복귀는 원window/기한을 유지하고 position 이식·절단·부가분절을 거절한다',async()=>{const f=fixture(),s=service(f);for(let n=0;n<22;n++)await s.save(f.db,f.actor,{...structuredClone(f.request),commandId:crypto.randomUUID()},f.policyRef);const first=await s.page(f.db,f.actor,f.request.projectId,f.result.ref.id,{},pageSign);assert.equal(first.nextCursor.split('.').length,4,'root/position 두 서명 frame');const frame=first.nextCursor.split('.');assert.equal(JSON.parse(Buffer.from(frame[0],'base64url').toString()).purpose,'FN12_REVIEW_PAGES');assert.equal(JSON.parse(Buffer.from(frame[2],'base64url').toString()).purpose,'FN12_REVIEW_PAGES');const bad=JSON.parse(Buffer.from(frame[0],'base64url').toString());bad.purpose='FN12_REVIEW_PAGE_ROOT';const encoded=Buffer.from(canonicalJson(bad)).toString('base64url');await assert.rejects(s.page(f.db,f.actor,f.request.projectId,f.result.ref.id,{cursor:encoded+'.'+pageSign('root:'+encoded)},pageSign),(e:any)=>e.statusCode===400);const root=first.nextCursor.split('.').slice(0,2).join('.');f.clock('2026-10-20T00:02:00.000Z');const back=await s.page(f.db,f.actor,f.request.projectId,f.result.ref.id,{cursor:root},pageSign);assert.deepEqual(back.window,first.window);assert.deepEqual(back.items,first.items);const other=await s.page(f.db,f.actor,f.request.projectId,f.result.ref.id,{},pageSign),parts=first.nextCursor.split('.'),foreign=other.nextCursor.split('.');for(const cursor of [parts.slice(0,3).join('.'),first.nextCursor+'.x',foreign.slice(0,2).join('.')+'.'+parts.slice(2).join('.'),parts.slice(2).join('.')])await assert.rejects(s.page(f.db,f.actor,f.request.projectId,f.result.ref.id,{cursor},pageSign),(e:any)=>e.statusCode===400);f.clock(first.window.expiresAt);await assert.rejects(s.page(f.db,f.actor,f.request.projectId,f.result.ref.id,{cursor:root},pageSign),(e:any)=>e.statusCode===410);});
