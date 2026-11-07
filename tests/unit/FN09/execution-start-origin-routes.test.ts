import test from 'node:test';
import assert from 'node:assert/strict';
import {artifactCalls,executionStartOriginFixture,installExecutionStartOriginMemoryFS} from './execution-start-origin-fixture.ts';
await installExecutionStartOriginMemoryFS();
const {materialRules}=await import('../../../apps/server/modules/access/project-command.ts');
const id=(n:number)=>`b2090000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const rules=(operations:string[])=>[{ruleId:'origin',subjectRef:{kind:'HUMAN',userId:id(1)},operations,targetScopes:[{kind:'PROJECT',projectId:id(2)}],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}];
test('원 준비 정책은 기존 HUMAN 프로젝트 범위로 보존한다',()=>{const value=rules(['prepareExecution']);assert.deepEqual(materialRules(value,id(2),id(1)),value);});
test('START 원자료의 명시 저장·조회 정책2개는 실제 materialRules를 통과한다',()=>{const value=rules(['registerExecutionStartOrigin','readExecutionStartOrigins']);assert.deepEqual(materialRules(value,id(2),id(1)),value);});
test('START 원자료 정책은 실제 실행 권한을 프로젝트 범위로 열지 않는다',()=>{assert.throws(()=>materialRules(rules(['registerExecutionStartOrigin','authorizeExecution']),id(2),id(1)),/POLICY_SCOPE_NOT_READY/);});

test('실제 App의 원 command와 GET2는 S/Q 저장·새 auth 보호·역사 발견으로 연결된다',async()=>{const f=await executionStartOriginFixture(),{buildApp}=await import('../../../apps/server/app.ts'),app=buildApp({},undefined,{repository:f.access,origin:'https://anvil-synthetic.invalid',artifactRoot:f.root}),headers={host:'anvil-synthetic.invalid',origin:'https://anvil-synthetic.invalid',cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf};try{const saved=await app.inject({method:'POST',url:`/api/v1/projects/${f.pid}/commands`,headers,payload:f.originCommand()});assert.equal(saved.statusCode,200,saved.body);const value=saved.json(),exact=`/api/v1/projects/${f.pid}/execution-start-origins/${value.data.ref.id}/versions/1`,page=`/api/v1/projects/${f.pid}/assignments/${f.confirmed.data.ref.id}/versions/1/execution-start-origins`;assert.equal(value.data.credentialIssued,false);const view=await app.inject({method:'GET',url:exact,headers});assert.equal(view.statusCode,200,view.body);assert.equal(view.headers['cache-control'],'no-store');assert.deepEqual(view.json().snapshot,value.data.snapshot);const history=await app.inject({method:'GET',url:page,headers});assert.equal(history.statusCode,200,history.body);assert.deepEqual(history.json().items[0].ref,value.data.ref);assert.equal(Object.hasOwn(history.json().items[0],'snapshot'),false);const before=f.state.effects.length;for(const url of [exact+'?extra=1',page+'?limit=1',page+'?cursor=']){const r=await app.inject({method:'GET',url,headers});assert.equal(r.statusCode,400,r.body);}const anonymous=await app.inject({method:'GET',url:exact,headers:{host:headers.host}});assert.equal(anonymous.statusCode,401);const bearer=await app.inject({method:'GET',url:exact,headers:{...headers,authorization:'Bearer synthetic'}});assert.equal(bearer.statusCode,403);const noCSRF=await app.inject({method:'POST',url:`/api/v1/projects/${f.pid}/commands`,headers:{host:headers.host,origin:headers.origin,cookie:headers.cookie},payload:f.originCommand()});assert.equal(noCSRF.statusCode,403);assert.equal(f.state.effects.length,before);}finally{await app.close();}assert.equal(f.active(),false);assert.deepEqual(f.state.unsupported,[]);});

test('실제 App의 첫20건 cursor로 두번째 보호 이력 페이지를 조회한다',async()=>{const f=await executionStartOriginFixture(),{buildApp}=await import('../../../apps/server/app.ts'),app=buildApp({},undefined,{repository:f.access,origin:'https://anvil-synthetic.invalid',artifactRoot:f.root}),headers={host:'anvil-synthetic.invalid',origin:'https://anvil-synthetic.invalid',cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf};try{for(let n=0;n<21;n++){const request=f.originCommand();if(n){const start={...f.originCommand(),operation:'startStage',payload:f.stage.data.snapshot.input},stage:any=await f.run(actor=>f.queue.start(f.db,actor,start,f.policyRef));request.payload.stageRequestRef=stage.data.ref;}const result=await app.inject({method:'POST',url:`/api/v1/projects/${f.pid}/commands`,headers,payload:request});assert.equal(result.statusCode,200,result.body);}const url=`/api/v1/projects/${f.pid}/assignments/${f.confirmed.data.ref.id}/versions/1/execution-start-origins`,first=await app.inject({method:'GET',url,headers});assert.equal(first.statusCode,200,first.body);const page=first.json();assert.equal(page.items.length,20);assert.equal(typeof page.nextCursor,'string');const next=await app.inject({method:'GET',url:url+'?cursor='+encodeURIComponent(page.nextCursor),headers});assert.equal(next.statusCode,200,next.body);assert.equal(next.json().items.length,1);assert.equal(next.json().nextCursor,null);assert(!page.items.some((v:any)=>v.ref.id===next.json().items[0].ref.id));}finally{await app.close();}assert.equal(f.active(),false);assert.deepEqual(f.state.unsupported,[]);});

const reuseRuleOperations=['authorizeExecution','queueExecutionCommand','reuseExecutionStartOrigin'] as const;
function originRuntimeRules(f:Awaited<ReturnType<typeof executionStartOriginFixture>>,origin:{
 execution:{executionId:string;executionGeneration:number};sourceScopes:unknown;budgetPolicyRef:unknown;
},blocked?:{operation:string;disposition:'MISSING'|'DENY'|'DENY_ALIAS'|'REQUIRE_APPROVAL'}){
 const scope={kind:'EXECUTION',projectId:f.pid,...origin.execution,sourceScopes:origin.sourceScopes};
 const applicable=reuseRuleOperations.filter(op=>blocked?.operation!==op||blocked.disposition!=='MISSING');
 const rules=applicable.map(operation=>({ruleId:String(operation),subjectRef:{kind:'HUMAN',userId:f.actor.actorId},operations:[operation],
  targetScopes:[scope],disposition:'AUTO',limitPolicyRef:origin.budgetPolicyRef,expiresAt:f.actor.authSession.idleExpiresAt}));
 if(blocked&&blocked.disposition!=='MISSING'){
  const base=rules.find(rule=>rule.operations[0]===blocked.operation);assert(base);
  const denyAlias=blocked.disposition==='DENY_ALIAS',negativeScope=structuredClone(scope);
  if(denyAlias){
   const scopes=negativeScope.sourceScopes;
   assert(Array.isArray(scopes)&&scopes.length===1&&scopes[0].targets.length===1);
   scopes[0].sourceRootRef.version++;
   scopes[0].targets[0].relativePath=scopes[0].targets[0].relativePath.toUpperCase();
  }
  rules.push({...base,ruleId:base.ruleId+'_negative',targetScopes:[negativeScope],disposition:denyAlias?'DENY':blocked.disposition});
 }
 return materialRules(rules,f.pid,f.actor.actorId);
}
const approvalHash=async()=>{const {canonicalJson,contentHash}=await import('../../../contracts/canonical.ts');return (value:unknown)=>contentHash(canonicalJson(value));};

async function reuseApprovalInput(actorId:string,clientId:string,now:Date){
 const hash=await approvalHash();
 const ref=(n:number)=>({id:id(n),version:1,contentHash:hash(n)});
 const candidatePayload={preparationRef:ref(21),executionId:id(22),executionGeneration:1,permissionPolicyRef:ref(23),budgetPolicyRef:ref(24),operation:'START_SESSION',payload:{contextBundleRef:ref(25),optionsRef:ref(21)},originReuse:{originRef:ref(26),reservationRef:ref(27)}};
 const details={reason:'원자료 재사용',risks:{data:'원본 유지',security:'보호',cost:'합성',interruption:'중단',unverified:'미검증'},rollback:{method:'동일 거래',limitations:'미확인 결과 보존',evidenceRefs:[]},expiresAt:new Date(now.valueOf()+20_000).toISOString(),actionScope:{operation:'queueExecutionCommand',targetRef:null,expectedVersion:0,payloadHash:hash(candidatePayload),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:actorId,clientId},controlGeneration:1},candidateCommandId:id(28)};
 return {details,candidatePayload};
}

test('실제 App의 미구성 원자료 재사용 승인 요청과 결정은 쓰기 전에 차단한다',async()=>{
 const f=await executionStartOriginFixture(),{buildApp}=await import('../../../apps/server/app.ts');
 const app=buildApp({},undefined,{repository:f.access,origin:'https://anvil-synthetic.invalid',artifactRoot:f.root});
 const headers={host:'anvil-synthetic.invalid',origin:'https://anvil-synthetic.invalid',cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf};
 const now=new Date(),hash=await approvalHash(),{actorId,clientId}=f.actor;
 const input=await reuseApprovalInput(actorId,clientId,now),scope=input.details.actionScope,requestId=id(29),scopeDigest=hash(scope);
 // 결정 진입을 검증하기 위해 검산 가능한 과거 요청 행만 메모리에서 제공한다.
 const snapshot={projectId:f.pid,details:input.details,scopeDigest,requiredDecider:{kind:'HUMAN',userId:actorId},policyRef:f.policyRef,requestedBy:{kind:'HUMAN',userId:actorId,clientId},controlGeneration:1};
 const ref={id:requestId,version:1,contentHash:hash(snapshot)};
 const request={id:requestId,version:1,status:'PENDING',...snapshot,createdAt:now.toISOString()};
 const row={request_json:request,created_at:now,created_by:actorId,client_id:clientId,actor_id:actorId,command_client:clientId,content_hash:ref.contentHash,operation:'requestApproval',result_ref:{status:'APPLIED',data:{ref,status:'APPROVAL_REQUESTED',request}},policy_ref:f.policyRef,details_json:input.details,candidate_command_id:input.details.candidateCommandId,action_scope_json:scope,scope_digest:scopeDigest,required_decider_ref:snapshot.requiredDecider,expires_at:new Date(input.details.expiresAt)};
 let decisionReads=0;
 const denialReasons:unknown[]=[];
 const query=f.db.query.bind(f.db);
 f.db.query=(async(sql:string,args:unknown[])=>{
  if(sql==='SELECT r.*,c.operation,c.actor_id,c.client_id command_client,c.result_ref FROM anvil.approval_requests r JOIN anvil.commands c ON c.id=r.command_id AND c.project_id=r.project_id WHERE r.project_id=$1 AND r.id=$2'){
   assert.deepEqual(args,[f.pid,requestId]);decisionReads++;return {rows:[row],rowCount:1};
  }
  if(sql.startsWith('INSERT INTO anvil.audit_events')&&sql.includes("'SERVER_DENIAL'")){
   assert.equal(args[0],f.pid);denialReasons.push(args[5]);return {rows:[],rowCount:1};
  }
  return query(sql,args);
 }) as typeof f.db.query;
 const commands=f.commands.size,receipts=f.receipts.size;
 try{
  const url='/api/v1/projects/'+f.pid+'/commands';
  const results=[];
  for(const command of [
   {...f.originCommand(),operation:'requestApproval',payload:input},
   {...f.originCommand(),operation:'decideApproval',targetId:requestId,expectedVersion:1,payload:{requestId,expectedVersion:1,scopeDigest,decision:'APPROVE',reason:'명시 결정'}},
  ]){
   const result=await app.inject({method:'POST',url,headers,payload:command});
   results.push([result.statusCode,result.json().code]);
  }
  assert.equal(decisionReads,1);
  assert.equal(f.commands.size,commands);
  assert.equal(f.receipts.size,receipts);
  assert.deepEqual(f.state.unsupported,[]);
  assert(!f.trace.some(sql=>/^(INSERT INTO|UPDATE) anvil\.(approval_requests|approval_decisions|approval_consumptions|execution_commands|execution_materials)\b/i.test(sql)));
  assert.deepEqual(results,Array.from({length:2},()=>[412,'ORIGIN_REUSE_APPROVAL_NOT_CONNECTED']));
  assert.deepEqual(denialReasons,['ORIGIN_REUSE_APPROVAL_NOT_CONNECTED','ORIGIN_REUSE_APPROVAL_NOT_CONNECTED']);
 }finally{await app.close();}
 assert.equal(f.active(),false);
});

test('원자료 재사용 승인 입력은 별도 정확 형상과 원 START 해시만 수락한다',async()=>{
 const inputModule=await import('../../../apps/server/modules/approvals/approval-input.ts');
 const now=new Date(),context={actorId:id(1),clientId:id(2),controlGeneration:1,now},requestCommandId=id(3);
 const input=await reuseApprovalInput(context.actorId,context.clientId,now),hash=await approvalHash();
 const read=(value:unknown)=>inputModule.readOriginReuseApprovalRequest(value,context,requestCommandId);
 const accepted=read(input);
 assert.deepEqual(accepted,input);
 assert.notEqual(accepted.candidatePayload,input.candidatePayload);
 assert.throws(()=>inputModule.readApprovalDetails(input.details,{...context,allowedOperations:['prepareExecution']}),/APPROVAL_INPUT_INVALID/);
 for(const alter of [
  (v:typeof input)=>Object.assign(v,{extra:false}),
  (v:typeof input)=>Reflect.deleteProperty(v.candidatePayload,'originReuse'),
  (v:typeof input)=>Object.assign(v.candidatePayload,{extra:false}),
  (v:typeof input)=>Object.assign(v.candidatePayload.originReuse,{extra:false}),
  (v:typeof input)=>Reflect.deleteProperty(v.candidatePayload.originReuse,'reservationRef'),
  (v:typeof input)=>Object.assign(v.candidatePayload.originReuse.originRef,{extra:false}),
  (v:typeof input)=>Object.assign(v.candidatePayload,{executionGeneration:0}),
  (v:typeof input)=>Object.assign(v.candidatePayload,{operation:'SEND_INSTRUCTION'}),
  (v:typeof input)=>Object.assign(v.candidatePayload.payload,{extra:false}),
  (v:typeof input)=>Object.assign(v.details.actionScope,{targetRef:v.candidatePayload.preparationRef,expectedVersion:1}),
  (v:typeof input)=>Object.assign(v.candidatePayload.originReuse.originRef,{version:2}),
 ]){
  const invalid=structuredClone(input);alter(invalid);invalid.details.actionScope.payloadHash=hash(invalid.candidatePayload);
  assert.throws(()=>read(invalid),/APPROVAL_INPUT_INVALID/);
 }
 const unconnectedScope=structuredClone(input);
 Object.assign(unconnectedScope.details.actionScope,{sourceScopes:[input.candidatePayload.preparationRef]});
 assert.throws(()=>read(unconnectedScope),/APPROVAL_REFERENCE_NOT_CONNECTED/);
 const foreignHash=structuredClone(input);foreignHash.candidatePayload.permissionPolicyRef.contentHash=hash(99);
 assert.throws(()=>read(foreignHash),/APPROVAL_CANDIDATE_MISMATCH/);
 assert.throws(()=>inputModule.readOriginReuseApprovalRequest(input,context,input.details.candidateCommandId),/APPROVAL_SELF_CANDIDATE_INVALID/);
 let getter=0;
 const accessor=structuredClone(input);Object.defineProperty(accessor.candidatePayload.originReuse,'originRef',{enumerable:true,get(){getter++;return input.candidatePayload.originReuse.originRef;}});
 assert.throws(()=>read(accessor),/APPROVAL_INPUT_INVALID/);
 assert.equal(getter,0);
});

test('합성 포트는 실제 원 큐의 승인 조립체만 인정하고 App 쓰기는 계속 차단한다',async()=>{
 const f=await executionStartOriginFixture(),{buildApp}=await import('../../../apps/server/app.ts');
 const {ProjectInitialExecutionQueue}=await import('../../../apps/server/modules/executions/execution-commands.ts');
 const {createOriginReuseApprovalCapability}=await import('../../../apps/server/modules/executions/execution-start-origin-reuse.ts');
 const {originReuseApprovalCapability}=await import('../../../apps/server/modules/executions/project-runtime-commands.ts');
 const config={repository:f.access,origin:'https://anvil-synthetic.invalid',artifactRoot:f.root};
 const headers={host:'anvil-synthetic.invalid',origin:config.origin,cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf};
 const url='/api/v1/projects/'+f.pid+'/commands';
 const input=await reuseApprovalInput(f.actor.actorId,f.actor.clientId,new Date());
 let forbiddenCalls=0;
 const forbidden=async()=>{forbiddenCalls++;throw Error('UNEXPECTED_SYNTHETIC_OPERATION');};
 const resolver={transport:'SYNTHETIC_ONLY' as const,basis:forbidden,current:forbidden};
 const queue=new ProjectInitialExecutionQueue(f.access,resolver),otherQueue=new ProjectInitialExecutionQueue(f.access,resolver);
 const genuine=createOriginReuseApprovalCapability(f.access,queue);
 const ports={transport:'SYNTHETIC_ONLY' as const,queue,stop:{command:forbidden},recovery:{command:forbidden},understanding:{command:forbidden}};
 assert.throws(()=>createOriginReuseApprovalCapability(f.access,Object.create(ProjectInitialExecutionQueue.prototype)),/ORIGIN_REUSE_REGISTRATION_UNAVAILABLE/);
 const otherAccess=(await executionStartOriginFixture()).access;
 assert.throws(()=>createOriginReuseApprovalCapability(otherAccess,queue),/ORIGIN_REUSE_REGISTRATION_UNAVAILABLE/);
 assert.equal(originReuseApprovalCapability({...ports,originReuseApproval:genuine},otherAccess),undefined);
 let getterReads=0;
 const accessor={...ports,get originReuseApproval(){getterReads++;return genuine;}};
 assert.equal(originReuseApprovalCapability(accessor,f.access),undefined);
 assert.equal(getterReads,0);
 const unmarked={...ports,originReuseApproval:genuine};
 Reflect.deleteProperty(unmarked,'transport');
 assert.equal(originReuseApprovalCapability(unmarked,f.access),undefined);
 const proxy=new Proxy({...ports,originReuseApproval:genuine},{getOwnPropertyDescriptor(){throw Error('PORT_PROXY_TRAP');}});
 assert.equal(originReuseApprovalCapability(proxy,f.access),undefined);
 Object.defineProperty(queue,'command',{value:forbidden,configurable:true});
 try{assert.equal(originReuseApprovalCapability({...ports,originReuseApproval:genuine},f.access),undefined);}
 finally{Reflect.deleteProperty(queue,'command');}
 const denial:string[]=[];
 const query=f.db.query.bind(f.db);
 f.db.query=(async(sql:string,args:unknown[])=>{
  if(sql.startsWith('INSERT INTO anvil.audit_events')&&sql.includes("'SERVER_DENIAL'")){
   denial.push('DENIED');return {rows:[],rowCount:1};
  }
  return query(sql,args);
 }) as typeof f.db.query;
 const commandCount=f.commands.size,receiptCount=f.receipts.size;
 for(const [variant,synthetic] of [
  ['DEFAULT',undefined],
  ['NO_CAP',ports],
  ['FORGED',{...ports,originReuseApproval:Object.freeze(Object.create(null)) as typeof genuine}],
  ['WRONG_QUEUE',{...ports,queue:otherQueue,originReuseApproval:genuine}],
  ['GENUINE',{...ports,originReuseApproval:genuine}],
 ] as const){
  assert.equal(originReuseApprovalCapability(synthetic,f.access),variant==='GENUINE'?genuine:undefined,variant);
  const app=buildApp({},undefined,config,synthetic),start=f.trace.length;
  try{
   const command={...f.originCommand(),operation:'requestApproval',payload:input};
   const result=await app.inject({method:'POST',url,headers,payload:command});
   assert.equal(result.statusCode,412,variant+' '+result.body);
   assert.equal(result.json().code,'ORIGIN_REUSE_APPROVAL_NOT_CONNECTED');
   const trace=f.trace.slice(start);
   assert(!trace.some(sql=>sql.startsWith('SELECT pg_current_xact_id_if_assigned()::text AS transaction_id, clock_timestamp() AS at')||sql.startsWith('SELECT anvil.environment_configuration_history_proof')));
   assert(!trace.some(sql=>/^(INSERT INTO|UPDATE) anvil\.(approval_requests|approval_decisions|approval_consumptions|execution_commands|execution_materials)\b/i.test(sql)));
  }finally{await app.close();}
 }
 assert.equal(f.commands.size,commandCount);
 assert.equal(f.receipts.size,receiptCount);
 assert.equal(forbiddenCalls,0);
 assert.equal(denial.length,5);
 assert.deepEqual(f.state.unsupported,[]);
 assert.equal(f.active(),false);
});

test('실제 App은 정합 조립에서만 동일 인증 거래의 보호 관측에 들어가며 replay와 저장을 닫는다',async()=>{
 const f=await executionStartOriginFixture(),{buildApp}=await import('../../../apps/server/app.ts');
 const {ProjectInitialExecutionQueue}=await import('../../../apps/server/modules/executions/execution-commands.ts');
 const {createOriginReuseApprovalCapability}=await import('../../../apps/server/modules/executions/execution-start-origin-reuse.ts');
 const config={repository:f.access,origin:'https://anvil-synthetic.invalid',artifactRoot:f.root};
 const headers={host:'anvil-synthetic.invalid',origin:config.origin,cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf};
 const url='/api/v1/projects/'+f.pid+'/commands',seed=buildApp({},undefined,config);
 const saved=await seed.inject({method:'POST',url,headers,payload:f.originCommand()});
 await seed.close();
 assert.equal(saved.statusCode,200,saved.body);
 const {ref,snapshot,reservation}=saved.json().data;
 assert.deepEqual(snapshot.stageRequestRef,f.stage.data.ref);
 f.modes.policyVersion=2;
 f.modes.runtimeRules=originRuntimeRules(f,snapshot);
 const p2=f.policy(),hash=await approvalHash();
 const input=await reuseApprovalInput(f.actor.actorId,f.actor.clientId,new Date());
 Object.assign(input.candidatePayload,{
  preparationRef:snapshot.preparationRef,executionId:snapshot.execution.executionId,executionGeneration:snapshot.execution.executionGeneration,
  budgetPolicyRef:snapshot.budgetPolicyRef,permissionPolicyRef:{id:p2.id,version:p2.head_version,contentHash:p2.content_hash},
  payload:{contextBundleRef:snapshot.contextBundleRef,optionsRef:snapshot.preparationRef},originReuse:{originRef:ref,reservationRef:reservation.ref},
 });
 input.details.actionScope.payloadHash=hash(input.candidatePayload);
 let forbiddenCalls=0;
 const forbidden=async()=>{forbiddenCalls++;throw Error('UNEXPECTED_SYNTHETIC_OPERATION');};
 const resolver={transport:'SYNTHETIC_ONLY' as const,basis:forbidden,current:forbidden};
 const queue=new ProjectInitialExecutionQueue(f.access,resolver),other=new ProjectInitialExecutionQueue(f.access,resolver);
 const cap=createOriginReuseApprovalCapability(f.access,queue,f.sessions),bad=Object.freeze(Object.create(null)) as typeof cap;
 const {ProjectApprovals}=await import('../../../apps/server/modules/approvals/project-approvals.ts');
 const approvalsPrototype=ProjectApprovals.prototype,originalConsumption=approvalsPrototype.readResponsibleSessionConsumption;
 const ports={transport:'SYNTHETIC_ONLY' as const,queue,stop:{command:forbidden},recovery:{command:forbidden},understanding:{command:forbidden}};
 const query=f.db.query.bind(f.db);
 let replay:{id:string;requestHash:string}|undefined,replayReads=0,denials=0,switchDuringReplay=false,switched=false;
 let swapApprovalAtBinding=false,approvalLookups=0,approvalSwaps=0,substituteCalls=0;
 const unavailableApprovalId=id(70),consumptionId=id(71);
 f.db.query=(async(sql:string,args:unknown[])=>{
  if(sql.startsWith('INSERT INTO anvil.audit_events')&&sql.includes("'SERVER_DENIAL'")){
   assert.equal(args[0],f.pid);denials++;return {rows:[],rowCount:1};
  }
  if(replay&&sql.startsWith('SELECT operation,request_hash,result_ref FROM anvil.commands WHERE scope_kind=')&&args[2]===replay.id){
   assert.deepEqual(args,[f.pid,f.actor.actorId,replay.id]);replayReads++;
   return {rows:[{operation:'requestApproval',request_hash:replay.requestHash,result_ref:{status:'APPLIED',data:{protectedMarker:'OLD_UNVERIFIED'}}}],rowCount:1};
  }
  if(swapApprovalAtBinding&&sql.startsWith('SELECT r.*,c.operation,c.actor_id,c.client_id command_client,c.result_ref FROM anvil.approval_requests')){
   assert.deepEqual(args,[f.pid,unavailableApprovalId]);approvalLookups++;
   return {rows:[],rowCount:0};
  }
  const response=await query(sql,args);
  if(sql.startsWith('SELECT s.*,u.id AS uid'))return {...response,rows:response.rows.map((row:Record<string,unknown>)=>({...row,reauth_until:new Date(f.actor.authSession.absoluteExpiresAt)}))};
  if(swapApprovalAtBinding&&sql.includes('FROM anvil.role_bindings b')&&sql.endsWith('AND b.version=$3')){
   const row=response.rows[0];
   assert(row&&response.rows.length===1);
   // 원 승인 없는 음성 행이다. 원 reader는 빈 승인 조회로 반드시 거절한다.
   const link={id:consumptionId,get requestId(){
    // 인수 평가 때 복원해, 직전 동적 메서드 조회만 교체를 보게 한다.
    approvalsPrototype.readResponsibleSessionConsumption=originalConsumption;
    return unavailableApprovalId;
   }},approvalRows=[link];
   let reads=0;
   Object.defineProperty(approvalRows,'0',{get(){
    if(++reads===2){
     approvalSwaps++;
     approvalsPrototype.readResponsibleSessionConsumption=async()=>{
      substituteCalls++;
      approvalsPrototype.readResponsibleSessionConsumption=originalConsumption;
      throw Error('UNEXPECTED_APPROVAL_READER');
     };
     queueMicrotask(()=>{approvalsPrototype.readResponsibleSessionConsumption=originalConsumption;});
    }
    return link;
   }});
   return {...response,rows:[{...row,approval_consumption_id:consumptionId,approval_rows:approvalRows}]};
  }
  if(switchDuringReplay&&sql.startsWith('SELECT operation,request_hash,result_ref FROM anvil.commands WHERE scope_kind='))switched=true;
  if(switched&&sql.includes('pg_current_xact_id_if_assigned()')){
   const row=response.rows[0];
   assert(row&&typeof row.transaction_id==='string');
   return {...response,rows:[{...row,transaction_id:String(BigInt(row.transaction_id)+1n)}]};
  }
  return response;
 }) as typeof f.db.query;
 const commands=f.commands.size,receipts=f.receipts.size,effects=f.state.effects.length;
 let waitingTrace:string[]|undefined;
 for(const [variant,synthetic] of [
  ['DEFAULT',undefined],['NO_CAP',ports],['FORGED',{...ports,originReuseApproval:bad}],['OTHER',{...ports,queue:other,originReuseApproval:cap}],
  ['GENUINE',{...ports,originReuseApproval:cap}],['REPLAY',{...ports,originReuseApproval:cap}],['MALFORMED',{...ports,originReuseApproval:cap}],
  ['XID_SWITCH',{...ports,originReuseApproval:cap}],['APPROVAL_READER_SWAP',{...ports,originReuseApproval:cap}],
  ['APPROVAL_READER_TRANSIENT',{...ports,originReuseApproval:cap}],
 ] as const){
  const app=buildApp({},undefined,config,synthetic),start=f.trace.length;
  try{
   const payload=structuredClone(input);
   if(variant==='MALFORMED')payload.details.actionScope.operation='prepareExecution';
   const request={...f.originCommand(),operation:'requestApproval',payload};
   if(variant==='REPLAY')replay={id:request.commandId,requestHash:hash(request)};
   switchDuringReplay=variant==='XID_SWITCH';
   swapApprovalAtBinding=variant==='APPROVAL_READER_TRANSIENT';
   if(variant==='APPROVAL_READER_SWAP')approvalsPrototype.readResponsibleSessionConsumption=forbidden;
   const result=await app.inject({method:'POST',url,headers,payload:request});
   assert.equal(result.statusCode,variant==='MALFORMED'?422:412,variant+' '+result.body);
   assert.equal(result.json().code,variant==='MALFORMED'?'APPROVAL_INPUT_INVALID':'ORIGIN_REUSE_APPROVAL_NOT_CONNECTED');
   assert(!result.body.includes('OLD_UNVERIFIED'));
   const trace=f.trace.slice(start);
   const observation=trace.findIndex(sql=>sql.startsWith('SELECT pg_current_xact_id_if_assigned()::text AS transaction_id, clock_timestamp() AS at'));
   const history=trace.findIndex(sql=>sql.startsWith('SELECT anvil.environment_configuration_history_proof'));
   if(variant==='GENUINE'){
    waitingTrace=trace;
    const begin=trace.indexOf('BEGIN'),rollback=trace.indexOf('ROLLBACK');
    const pinned=trace.findIndex(sql=>sql.includes('AS auth_observed_at'));
    const controller=trace.findIndex(sql=>sql.startsWith('SELECT * FROM anvil.project_control'));
    assert(begin>=0&&pinned>begin&&controller>pinned&&observation>controller&&history>observation&&rollback>history,trace.join('\n'));
    assert.equal(trace.slice(begin,rollback).filter(sql=>sql==='BEGIN').length,1);
    assert.equal(trace.slice(begin,rollback).filter(sql=>sql.includes('WHERE token_digest=$1 FOR UPDATE OF u,s,c')).length,1);
   }else if(variant==='XID_SWITCH'){
    assert.equal(switched,true);
    assert(observation>=0,'변경한 xid는 첫 보호 관측 시계에서 대조한다');
    assert.equal(history,-1,'같은 query라도 replay 뒤 바뀐 xid에서는 환경 이력을 읽으면 안 된다');
    assert(!trace.some(sql=>sql.includes('FROM anvil.execution_start_origins o')),'xid 변경 뒤 원자료 조회 금지');
    assert(trace.indexOf('ROLLBACK')>observation);
   }else if(variant==='APPROVAL_READER_TRANSIENT'){
    assert.equal(approvalSwaps,1);
    assert.equal(substituteCalls,0,'원 결박 판독 중 잠시 교체된 승인 reader를 호출하면 안 된다');
    assert.equal(approvalLookups,1,'원 승인 reader가 없는 이력을 직접 읽고 거절한다');
    assert.equal(history,-1);
    assert(trace.indexOf('ROLLBACK')>observation);
   }else{assert.equal(observation,-1,variant);assert.equal(history,-1,variant);}
   assert(!trace.some(sql=>/^(INSERT INTO|UPDATE) anvil\.(approval_requests|approval_decisions|approval_consumptions|execution_commands|execution_materials)\b/i.test(sql)));
  }finally{
   approvalsPrototype.readResponsibleSessionConsumption=originalConsumption;
   replay=undefined;switchDuringReplay=false;switched=false;swapApprovalAtBinding=false;await app.close();
  }
 }
 assert.equal(replayReads,1);
 assert.equal(denials,10);
 assert.equal(forbiddenCalls,0);
 assert.equal(f.commands.size,commands);
 assert.equal(f.receipts.size,receipts);
 assert.equal(f.state.effects.length,effects);

 const isEnvironment=(sql:string)=>sql.startsWith('SELECT anvil.environment_configuration_context')||sql.includes('FROM anvil.environment_configuration_versions v');
 const isRole=(sql:string)=>sql.includes('FROM anvil.role_bindings b')&&sql.endsWith('AND b.version=$3');
 const isSession=(sql:string)=>sql.includes('FROM anvil.agent_sessions s')&&sql.endsWith('AND s.version=$3');
 const isRoleHead=(sql:string)=>sql==='SELECT binding_id,version,content_hash FROM anvil.role_bindings WHERE project_id=$1 AND role_id=$2 ORDER BY version DESC LIMIT 1';
 const oldBinding=f.binding.data.ref,oldSession=f.binding.data.snapshot.sessionRef;
 const replacing=buildApp({},undefined,config,{...ports,originReuseApproval:cap});
 try{
  const binding=f.binding.data.snapshot;
  const replacement={...f.originCommand(),operation:'bindResponsibleSession',targetId:oldBinding.id,expectedVersion:oldBinding.version,payload:{
   connectionKind:binding.connectionKind,assignmentRef:binding.assignmentRef,roleRef:binding.roleRef,connectionRef:binding.connectionRef,
   existingSessionBindingRef:oldBinding,reason:'같은 논리 세션의 현재 결박 교체',
  }};
  const applied=await replacing.inject({method:'POST',url,headers,payload:replacement});
  assert.equal(applied.statusCode,200,applied.body);
  const next=applied.json().data;
  assert.equal(next.ref.id,oldBinding.id);
  assert.equal(next.ref.version,oldBinding.version+1);
  assert.deepEqual(next.snapshot.sessionRef,oldSession);
  assert.equal(f.tables.sessions!.length,1);
  const beforeProbe={commands:f.commands.size,receipts:f.receipts.size,effects:f.state.effects.length};
  const start=f.trace.length;
  const result=await replacing.inject({method:'POST',url,headers,payload:{...f.originCommand(),operation:'requestApproval',payload:input}});
  assert.equal(result.statusCode,412,result.body);
  assert.equal(result.json().code,'ORIGIN_REUSE_APPROVAL_NOT_CONNECTED');
  const trace=f.trace.slice(start);
  assert(!trace.some(isEnvironment),'결박 head가 교체된 원 S/Q는 환경을 읽으면 안 된다');
  const roleAt=trace.findIndex(isRole),sessionAt=trace.findIndex(isSession),roleHeadAt=trace.findIndex(isRoleHead);
  assert(roleAt>=0&&sessionAt>roleAt&&roleHeadAt>sessionAt&&trace.indexOf('ROLLBACK')>roleHeadAt);
  assert.deepEqual({commands:f.commands.size,receipts:f.receipts.size,effects:f.state.effects.length},beforeProbe);
 }finally{await replacing.close();}

 const stageRequestRef=f.stage.data.ref;
 const cancellation={...f.originCommand(),operation:'cancelQueuedRequest',targetId:stageRequestRef.id,expectedVersion:stageRequestRef.version,payload:{requestRef:stageRequestRef,reason:'원 대기 단계 취소'}};
 const currentPolicy=input.candidatePayload.permissionPolicyRef;
 const cancelled:any=await f.run(actor=>f.queue.cancel(f.db,actor,cancellation,currentPolicy));
 assert.equal(cancelled.data.queueState,'CANCELLED');
 assert.deepEqual(cancelled.data.snapshot.previousRef,stageRequestRef);
 const postCancel={commands:f.commands.size,receipts:f.receipts.size,effects:f.state.effects.length};
 const app=buildApp({},undefined,config,{...ports,originReuseApproval:cap}),start=f.trace.length;
 try{
  const request={...f.originCommand(),operation:'requestApproval',payload:input};
  const result=await app.inject({method:'POST',url,headers,payload:request});
  assert.equal(result.statusCode,412,result.body);
  assert.equal(result.json().code,'ORIGIN_REUSE_APPROVAL_NOT_CONNECTED');
 }finally{await app.close();}
 const cancelledTrace=f.trace.slice(start);
 const isHead=(sql:string)=>sql.includes('FROM anvil.queue_requests q')&&sql.endsWith('ORDER BY q.version DESC LIMIT 1');
 const isOriginal=(sql:string)=>sql.includes('FROM anvil.queue_requests q')&&sql.endsWith('AND q.version=$3');
 assert(!cancelledTrace.some(isEnvironment),'취소된 단계의 원 S/Q는 환경 조회까지 도달하면 안 된다');
 assert(cancelledTrace.findIndex(isOriginal)>=0&&cancelledTrace.findIndex(isHead)>cancelledTrace.findIndex(isOriginal));
 assert(cancelledTrace.indexOf('ROLLBACK')>cancelledTrace.findIndex(isHead));
 assert(waitingTrace);
 const originalAt=waitingTrace.findIndex(isOriginal),headAt=waitingTrace.findIndex(isHead),environmentAt=waitingTrace.findIndex(isEnvironment);
 assert(originalAt>=0&&headAt>originalAt&&environmentAt>headAt,'정상 WAITING은 원 행과 현재 head를 환경 조회 전에 읽는다');
 const roleAt=waitingTrace.findIndex(isRole),sessionAt=waitingTrace.findIndex(isSession),roleHeadAt=waitingTrace.findIndex(isRoleHead);
 assert(roleAt>headAt&&sessionAt>roleAt&&roleHeadAt>sessionAt&&environmentAt>roleHeadAt,'원 결박·논리 세션·현재 결박을 환경 조회 전에 읽는다');
 const assignmentAt=waitingTrace.findIndex(sql=>sql.includes('FROM anvil.assignment_versions v'));
 const draftAt=waitingTrace.findIndex(sql=>sql.includes('FROM anvil.assignment_draft_versions v'));
 const draftHeadAt=waitingTrace.indexOf('SELECT head_version FROM anvil.assignment_drafts WHERE project_id=$1 AND id=$2 FOR UPDATE');
 assert(assignmentAt>roleHeadAt&&draftAt>assignmentAt&&draftHeadAt>draftAt&&environmentAt>draftHeadAt,'원 확정과 원 초안을 검산한 뒤 같은 프로젝트 초안 head를 잠근다');
 assert(!cancelledTrace.some(isRole),'취소 단계는 담당 결박도 읽지 않는다');
 assert.deepEqual({commands:f.commands.size,receipts:f.receipts.size,effects:f.state.effects.length},postCancel);
 assert.equal(denials,12);
 assert.equal(forbiddenCalls,0);
 assert.deepEqual(f.state.unsupported,[]);
 assert.equal(f.active(),false);
});

test('담당 세션 조립에서 프로토타입 모방을 보호 조회 전에 거절한다',async()=>{
 const f=await executionStartOriginFixture();
 const {ResponsibleSessions}=await import('../../../apps/server/modules/assignments/responsible-sessions.ts');
 const {ProjectInitialExecutionQueue}=await import('../../../apps/server/modules/executions/execution-commands.ts');
 const {createOriginReuseApprovalCapability}=await import('../../../apps/server/modules/executions/execution-start-origin-reuse.ts');
 const forbidden=async()=>{throw Error('UNEXPECTED_SYNTHETIC_OPERATION');};
 const queue=new ProjectInitialExecutionQueue(f.access,{transport:'SYNTHETIC_ONLY',basis:forbidden,current:forbidden});
 const before=f.trace.length,spoof=Object.create(ResponsibleSessions.prototype);
 let traps=0;
 const proxy=new Proxy(f.sessions,{getPrototypeOf(){traps++;throw Error('UNEXPECTED_PROXY_TRAP');}});
 assert.equal(ResponsibleSessions.isRealInstance(f.sessions),true);
 for(const invalid of [null,0,'',spoof,proxy])assert.equal(ResponsibleSessions.isRealInstance(invalid),false);
 assert.throws(()=>createOriginReuseApprovalCapability(f.access,queue,spoof),/ORIGIN_REUSE_REGISTRATION_UNAVAILABLE/);
 assert.throws(()=>createOriginReuseApprovalCapability(f.access,queue,proxy),/ORIGIN_REUSE_REGISTRATION_UNAVAILABLE/);
 const drafts=Object.getOwnPropertyDescriptor(f.sessions,'drafts');
 assert(drafts&&'value'in drafts);
 const draftProxy=new Proxy(f.drafts,{getPrototypeOf(){traps++;throw Error('UNEXPECTED_DRAFT_PROXY_TRAP');}});
 try{
  Object.defineProperty(f.sessions,'drafts',{configurable:true,get(){traps++;throw Error('UNEXPECTED_DRAFT_GETTER');}});
  assert.throws(()=>createOriginReuseApprovalCapability(f.access,queue,f.sessions),/ORIGIN_REUSE_REGISTRATION_UNAVAILABLE/);
  Object.defineProperty(f.sessions,'drafts',{...drafts,value:draftProxy});
  assert.throws(()=>createOriginReuseApprovalCapability(f.access,queue,f.sessions),/ORIGIN_REUSE_REGISTRATION_UNAVAILABLE/);
 }finally{Object.defineProperty(f.sessions,'drafts',drafts);}
 assert.equal(traps,0);
 assert.equal(f.trace.length,before);
});

test('실제 원 초안 v2 저장 뒤 같은 S/Q는 환경 조회 전에 거절한다',async()=>{
 const f=await executionStartOriginFixture(),{buildApp}=await import('../../../apps/server/app.ts');
 const {ProjectInitialExecutionQueue}=await import('../../../apps/server/modules/executions/execution-commands.ts');
 const {createOriginReuseApprovalCapability}=await import('../../../apps/server/modules/executions/execution-start-origin-reuse.ts');
 const forbidden=async()=>{throw Error('UNEXPECTED_SYNTHETIC_OPERATION');};
 const queue=new ProjectInitialExecutionQueue(f.access,{transport:'SYNTHETIC_ONLY',basis:forbidden,current:forbidden});
 const ports={transport:'SYNTHETIC_ONLY' as const,queue,originReuseApproval:createOriginReuseApprovalCapability(f.access,queue,f.sessions),stop:{command:forbidden},recovery:{command:forbidden},understanding:{command:forbidden}};
 const config={repository:f.access,origin:'https://anvil-synthetic.invalid',artifactRoot:f.root};
 const app=buildApp({},undefined,config,ports);
 const headers={host:'anvil-synthetic.invalid',origin:config.origin,cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf};
 const url='/api/v1/projects/'+f.pid+'/commands';
 const originalDraft=f.confirmed.data.snapshot.draftRef;
 let draftUpdates=0,denials=0;
 const originalQuery=f.db.query.bind(f.db);
 f.db.query=(async(sql:string,args:unknown[])=>{
  if(sql==='UPDATE anvil.assignment_drafts SET head_version=$3,updated_at=now() WHERE project_id=$1 AND id=$2'){
   assert.deepEqual(args,[f.pid,originalDraft.id,2]);
   const rows=f.tables.drafts!.filter(row=>row.project_id===args[0]&&row.id===args[1]);
   assert.equal(rows.length,1);assert.equal(rows[0].head_version,1);
   f.trace.push(sql);draftUpdates++;
   rows[0].head_version=args[2];rows[0].updated_at=new Date();
   return {rows:[],rowCount:1};
  }
  if(sql.startsWith('INSERT INTO anvil.audit_events')&&sql.includes("'SERVER_DENIAL'")){
   denials++;return {rows:[],rowCount:1};
  }
  const result=await originalQuery(sql,args);
  if(sql.startsWith('SELECT s.*,u.id AS uid'))return {...result,rows:result.rows.map((row:Record<string,unknown>)=>({...row,reauth_until:new Date(f.actor.authSession.absoluteExpiresAt)}))};
  return result;
 }) as typeof f.db.query;
 try{
  const origin=await app.inject({method:'POST',url,headers,payload:f.originCommand()});
  assert.equal(origin.statusCode,200,origin.body);
  const {ref,snapshot,reservation}=origin.json().data;
  assert.deepEqual(snapshot.assignmentRef,f.confirmed.data.ref);
  f.modes.policyVersion=2;
  const currentPolicy=f.policy(),hash=await approvalHash();
  const input=await reuseApprovalInput(f.actor.actorId,f.actor.clientId,new Date());
  Object.assign(input.candidatePayload,{
   preparationRef:snapshot.preparationRef,executionId:snapshot.execution.executionId,executionGeneration:snapshot.execution.executionGeneration,
   budgetPolicyRef:snapshot.budgetPolicyRef,permissionPolicyRef:{id:currentPolicy.id,version:currentPolicy.head_version,contentHash:currentPolicy.content_hash},
   payload:{contextBundleRef:snapshot.contextBundleRef,optionsRef:snapshot.preparationRef},originReuse:{originRef:ref,reservationRef:reservation.ref},
  });
  input.details.actionScope.payloadHash=hash(input.candidatePayload);
  const revised=await app.inject({method:'POST',url,headers,payload:{...f.originCommand(),operation:'prepareAssignment',targetId:originalDraft.id,expectedVersion:1,payload:{
   baseRef:originalDraft,definition:f.confirmed.data.snapshot.definition,reason:'원 임무 초안 개정',
  }}});
  assert.equal(revised.statusCode,200,revised.body);
  assert.equal(revised.json().data.ref.version,2);
  assert.deepEqual(revised.json().data.snapshot.previousRef,originalDraft);
  assert.equal(draftUpdates,1);
  const effects={commands:f.commands.size,receipts:f.receipts.size,writes:f.state.effects.length},start=f.trace.length;
  const probe=await app.inject({method:'POST',url,headers,payload:{...f.originCommand(),operation:'requestApproval',payload:input}});
  assert.equal(probe.statusCode,412,probe.body);
  assert.equal(probe.json().code,'ORIGIN_REUSE_APPROVAL_NOT_CONNECTED');
  const trace=f.trace.slice(start);
  assert(!trace.some(sql=>sql.startsWith('SELECT anvil.environment_configuration_context')),'원 초안이 교체된 S/Q는 환경을 조회하면 안 된다');
  const confirmed=trace.findIndex(sql=>sql.includes('FROM anvil.assignment_versions v'));
  const draft=trace.findIndex(sql=>sql.includes('FROM anvil.assignment_draft_versions v'));
  const head=trace.indexOf('SELECT head_version FROM anvil.assignment_drafts WHERE project_id=$1 AND id=$2 FOR UPDATE');
  assert(confirmed>=0&&draft>confirmed&&head>draft&&trace.indexOf('ROLLBACK')>head);
  assert.deepEqual({commands:f.commands.size,receipts:f.receipts.size,writes:f.state.effects.length},effects);
  assert.equal(denials,1);
  assert.deepEqual(f.state.unsupported,[]);
 }finally{await app.close();}
 assert.equal(f.active(),false);
});

test('연결기 환경 원자료는 P2의 원 등록과 최종 시계를 관측한 뒤에도 쓰기를 열지 않는다',async()=>{
 const f=await executionStartOriginFixture({connectorEnvironment:true,richContext:true,environmentDependencies:true,constitutionContext:true,approvedContext:true,snapshotRoot:true});
 const rich=f.richSources;
 assert(rich?.constitution);
 const constitution=rich.constitution;
 const {join}=await import('node:path');
 const {ProjectDocuments}=await import('../../../apps/server/modules/documents/project-documents.ts');
 const protectedDocuments=new ProjectDocuments(f.root,undefined,'FN09_PLAN_PROOF');
 const artifactPath=join(f.root,'blobs',f.pid,f.planDoc.bodyRef.artifactId),originalBytes=f.files.get(artifactPath);
 assert(originalBytes&&originalBytes.length>0);
 const tampered=Buffer.from(originalBytes);tampered[0]=tampered[0]!^1;
 const {buildApp}=await import('../../../apps/server/app.ts');
 const {ProjectInitialExecutionQueue}=await import('../../../apps/server/modules/executions/execution-commands.ts');
 const {createOriginReuseApprovalCapability}=await import('../../../apps/server/modules/executions/execution-start-origin-reuse.ts');
 const config={repository:f.access,origin:'https://anvil-synthetic.invalid',artifactRoot:f.root};
 const headers={host:'anvil-synthetic.invalid',origin:config.origin,cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf};
 const url='/api/v1/projects/'+f.pid+'/commands';
 const forbidden=async()=>{throw Error('UNEXPECTED_SYNTHETIC_OPERATION');};
 const queue=new ProjectInitialExecutionQueue(f.access,{transport:'SYNTHETIC_ONLY',basis:forbidden,current:forbidden});
 const spoof=Object.create(ProjectDocuments.prototype) as typeof protectedDocuments;
 let getterCalls=0;
 Object.defineProperty(spoof,'version',{get(){getterCalls++;throw Error('SPOOF_GETTER_CALLED');}});
 assert.throws(()=>createOriginReuseApprovalCapability(f.access,queue,f.sessions,spoof),/ORIGIN_REUSE_REGISTRATION_UNAVAILABLE/);
 assert.throws(()=>Object.defineProperty(protectedDocuments,'version',{get(){getterCalls++;throw Error('PROTECTED_GETTER_CALLED');}}),TypeError);
 assert.throws(()=>Object.defineProperty(protectedDocuments,'originalText',{value:forbidden}),TypeError);
 assert.equal(getterCalls,0);
 const originReuseApproval=createOriginReuseApprovalCapability(f.access,queue,f.sessions,protectedDocuments);
 const app=buildApp({},undefined,config,{transport:'SYNTHETIC_ONLY',queue,originReuseApproval,stop:{command:forbidden},recovery:{command:forbidden},understanding:{command:forbidden}});
 const query=f.db.query.bind(f.db);
 let denialAudits=0,variant='',switchXid=false,contextDocumentStart=-1;
 const {ProjectApprovals}=await import('../../../apps/server/modules/approvals/project-approvals.ts');
 const approvalReader=ProjectApprovals.prototype.readLimitPolicyConsumption,missingRequestId=id(72),consumptionId=id(73);
 let transientSwaps=0,substituteCalls=0,approvalLookups=0;
 let sawLimitHead=false,runtimeClockReads=0,clockRegressions=0;
 const dependencyQueries:{at:number;kind:unknown;id:unknown;version:unknown}[]=[];
 const constitutionQueries:{at:number;kind:'APPLICATION'|'KNOWLEDGE'|'METADATA';value:unknown}[]=[];
 let observedPolicy:(Omit<ReturnType<typeof f.policy>,'rules_json'>&{rules_json:ReturnType<typeof materialRules>})|undefined,shorterSession:Date|undefined;
 f.db.query=(async(sql:string,args:unknown[])=>{
  if(sql.startsWith('INSERT INTO anvil.audit_events')&&sql.includes("'SERVER_DENIAL'")){
   assert.equal(args[0],f.pid);denialAudits++;return {rows:[],rowCount:1};
  }
  if(variant==='LIMIT_READER_TRANSIENT'&&sql.startsWith('SELECT r.*,c.operation,c.actor_id,c.client_id command_client,c.result_ref FROM anvil.approval_requests')){
   assert.deepEqual(args,[f.pid,missingRequestId]);approvalLookups++;return {rows:[],rowCount:0};
  }
  if(sql.startsWith('SELECT v.*,h.head_version,c.operation original_operation'))dependencyQueries.push({at:f.trace.length,kind:args[1],id:args[2],version:args[3]});
  if(sql.includes('FROM anvil.constitution_applications a JOIN anvil.commands'))constitutionQueries.push({at:f.trace.length,kind:'APPLICATION',value:args[1]});
  if(sql.startsWith('SELECT v.*,k.kind,k.head_version FROM anvil.knowledge_versions'))constitutionQueries.push({at:f.trace.length,kind:'KNOWLEDGE',value:args[1]});
  if(sql.startsWith('SELECT v.content_hash,k.kind,k.head_version FROM anvil.knowledge_versions'))constitutionQueries.push({at:f.trace.length,kind:'METADATA',value:args[1]});
  const result=await query(sql,args);
  if(variant==='MISSING_CONTEXT_CONSUMPTION'&&sql.startsWith('SELECT ac.*,c.command_id candidate_command_id')){
   assert.equal(result.rows.length,1,'저장된 원 소비 행만 누락시킨다');
   return {...result,rows:[],rowCount:0};
  }
  if(variant==='MISSING_SNAPSHOT_AUDIT'&&sql.startsWith('SELECT EXISTS(SELECT 1 FROM anvil.audit_events')&&sql.includes("reason_code='SOURCE_READ_REPORT_STORED'")){
   assert.deepEqual(result.rows,[{ok:true}],'정상 결박에서만 저장 보고 감사를 누락시킨다');
   return {...result,rows:[{ok:false}]};
  }
  if(shorterSession&&sql.startsWith('SELECT s.*,u.id AS uid'))return {...result,rows:result.rows.map((row:Record<string,unknown>)=>({...row,reauth_until:shorterSession}))};
  if(observedPolicy&&sql.includes('FROM anvil.permission_policies p JOIN anvil.permission_policy_versions v'))return {...result,rows:[observedPolicy]};
  if(variant==='RUNTIME_CLOCK_BACKWARD'){
   if(sql.includes('FROM anvil.limit_policy_versions v'))sawLimitHead=true;
   if(sawLimitHead&&sql==='SELECT clock_timestamp() AS at'&&++runtimeClockReads===2){
    assert.equal(result.rows.length,1);const row=result.rows[0];assert(row.at instanceof Date);
    clockRegressions++;
    return {...result,rows:[{...row,at:new Date(row.at.getTime()-1)}]};
   }
  }
  if(variant==='LIMIT_READER_TRANSIENT'&&sql.includes('FROM anvil.limit_policy_versions v')){
   const row=result.rows[0];assert(row&&result.rows.length===1);
   let reads=0;
   const link={id:consumptionId,get requestId(){
    ProjectApprovals.prototype.readLimitPolicyConsumption=approvalReader;
    return missingRequestId;
   }},approvalRows=[link];
   Object.defineProperty(approvalRows,'0',{get(){
    if(++reads===2){
     transientSwaps++;
     ProjectApprovals.prototype.readLimitPolicyConsumption=async()=>{substituteCalls++;throw Error('LIMIT_READER_SUBSTITUTE_CALLED');};
     queueMicrotask(()=>{ProjectApprovals.prototype.readLimitPolicyConsumption=approvalReader;});
    }
    return link;
   }});
   return {...result,rows:[{...row,approval_consumption_id:consumptionId,approval_rows:approvalRows}]};
  }
  if(sql.startsWith('SELECT content_hash FROM anvil.document_versions')&&variant){
   assert.deepEqual(args,[f.pid,f.design.ref.id,f.design.ref.version]);assert.equal(result.rows.length,1);
   contextDocumentStart=artifactCalls.read;
   if(variant==='CHANGED_CONTEXT_DOCUMENT')return {...result,rows:[{content_hash:'f'.repeat(64)}]};
  }
  if(variant==='STALE_PLAN'&&sql.startsWith('SELECT w.head_version,w.confirmed_version,v.created_by')){
   assert.deepEqual(args,[f.pid,f.plan.ref.id,1]);assert.equal(result.rows.length,1);
   return {...result,rows:[{...result.rows[0],head_version:2}]};
  }
  if(variant==='STALE_METHOD'&&sql.includes('FROM anvil.project_methodologies')&&sql.includes('ORDER BY application_version DESC LIMIT 1')){
   assert.deepEqual(args,[f.pid]);assert.equal(result.rows.length,1);
   return {...result,rows:[{...result.rows[0],application_version:2}]};
  }
  if(variant==='XID_AFTER_PLAN'&&sql.startsWith('SELECT * FROM anvil.artifacts')&&args[0]===f.planDoc.bodyRef.artifactId)switchXid=true;
  if(switchXid&&sql.startsWith('SELECT pg_current_xact_id_if_assigned()::text AS transaction_id, clock_timestamp() AS at')){
   assert.equal(result.rows.length,1);
   return {...result,rows:[{...result.rows[0],transaction_id:String(BigInt(result.rows[0].transaction_id)+1n)}]};
  }
  return result;
 }) as typeof f.db.query;
 try{
  const saved=await app.inject({method:'POST',url,headers,payload:f.originCommand()});
  assert.equal(saved.statusCode,200,saved.body);
  const {ref,snapshot,reservation}=saved.json().data,registration=f.registration;
  assert(registration);
  const manifest=f.tables.contexts!.find(row=>row.id===snapshot.contextBundleRef.id)?.manifest_json;
  assert(manifest);
  const bundle=f.tables.contexts!.find(row=>row.id===snapshot.contextBundleRef.id);
  const [request]=f.tables.approvalRequests!,[decision]=f.tables.approvalDecisions!,[consumption]=f.tables.approvalConsumptions!,[notification]=f.tables.notifications!;
  assert(bundle&&request&&decision&&consumption&&notification);
  const contextCommand=f.commands.get(bundle.command_id);
  assert(contextCommand);
  assert.equal(request.status,'CONSUMED');assert.equal(request.version,3);
  assert.equal(request.action_scope_json.payloadHash,(await approvalHash())(bundle.request_payload));
  assert.equal(request.candidate_command_id,contextCommand.command_id);
  assert.deepEqual(request.policy_ref,f.policyRef);
  assert.equal(decision.request_id,request.id);assert.equal(decision.decision,'APPROVE');
  assert.equal(consumption.decision_id,decision.id);assert.equal(consumption.command_id,bundle.command_id);
  assert.equal(contextCommand.approval_consumption_id,consumption.id);
  assert.equal(f.receipts.get(bundle.command_id)?.approval_decision_ref,decision.id);
  assert.deepEqual(f.audits.get(bundle.command_id)?.approval_ref,{requestId:request.id,decisionId:decision.id,scopeDigest:request.scope_digest});
  assert.equal(notification.approval_request_id,request.id);assert.equal(notification.source_command_id,request.command_id);
  assert.deepEqual(manifest.latestInstructionRefs,[rich.messageRef]);
  assert.deepEqual(manifest.constitutionRef,constitution.current.ref);
  const originalConstitution=constitution.current.application.versionRef;
  const rulesItem=manifest.items.find((item:{category:string})=>item.category==='RULES_SCOPE');
  assert.equal(rulesItem?.includedState,'INCLUDED');
  assert.equal(rulesItem?.sourceRef.id,originalConstitution.id);
  assert.equal(rulesItem?.sourceRef.contentHash,originalConstitution.contentHash);
  assert(manifest.items.some((item:{category:string;sourceRef:unknown;includedState:string})=>item.category==='PURPOSE_REASON'&&item.includedState==='INCLUDED'&&JSON.stringify(item.sourceRef)===JSON.stringify(manifest.purposeRef)));
  assert.equal(manifest.purposeRef.id,rich.knowledgeRef.id);
  assert.equal(manifest.purposeRef.contentHash,rich.knowledgeRef.contentHash);
  const env=f.metadata.get('ENVIRONMENT_VERSION:'+snapshot.environmentRef.id);
  assert.deepEqual(env?.snapshot_json.executionHostRef.kind,'CONNECTOR_STATUS');
  assert.equal(env?.evidence_json.length,1);
  assert.deepEqual(env?.evidence_json[0].scopeProjection.policyRef,f.policyRef);
  assert.equal(env?.evidence_json[0].registrationState,'ISSUED');
  f.modes.policyVersion=2;
  f.modes.runtimeRules=originRuntimeRules(f,snapshot);
  const p2=f.policy(),policyRef={id:p2.id,version:p2.head_version,contentHash:p2.content_hash};
  const {ProjectEnvironmentResources}=await import('../../../apps/server/modules/connections/project-environment-resources.ts');
  const {ProjectSourceRoots}=await import('../../../apps/server/modules/connections/project-source-roots.ts');
  const {SourceReadRecords}=await import('../../../apps/server/modules/connections/source-read-records.ts');
  const graph=await f.run(async actor=>{
   const original=await f.environments.history(f.db,actor,f.pid,snapshot.environmentRef.id,snapshot.environmentRef.version);
   return f.environments.readOriginReuseReferences(f.db,actor,f.pid,original.snapshot,original.evidence,policyRef,Object.freeze({
    readMetadata:ProjectEnvironmentResources.prototype.readOriginReuseMetadata,readRoot:ProjectSourceRoots.prototype.read,
    readSnapshot:SourceReadRecords.prototype.readSnapshot,loadSnapshotGrant:SourceReadRecords.prototype.load,
   }));
  });
  const storedEnv=env?.snapshot_json;
  assert(storedEnv&&storedEnv.sourceRoots.length===1&&storedEnv.commandProfileRefs.length===1);
  assert.equal(storedEnv.secretRefs.length,1);
  assert.equal(storedEnv.targetHostRefs.length,1);
  const targetHost=storedEnv.targetHostRefs[0],secret=storedEnv.secretRefs[0];
  assert.equal(targetHost.kind,'HOST_DECLARATION');
  assert.equal(secret.kind,'SECRET_REFERENCE_METADATA');
  const hostDefinition=f.metadata.get('ENVIRONMENT_HOST_DECLARATION:'+targetHost.ref.id)?.snapshot_json.definition;
  const secretDefinition=f.metadata.get('SECRET_REFERENCE_METADATA:'+secret.ref.id)?.snapshot_json.definition;
  assert.equal(hostDefinition?.hostKind,'MACHINE');
  assert.equal(secretDefinition?.providerKind,'EXECUTOR_MANAGED');
  assert.deepEqual(secretDefinition?.hostRef,targetHost);
  const sourceRoot=storedEnv.sourceRoots[0],path=sourceRoot.registeredPathRef;
  assert.equal(path.kind,'SOURCE_SNAPSHOT_ROOT_PATH');
  assert.deepEqual(path.hostRef,storedEnv.executionHostRef);
  const root=f.metadata.get('ROOT:'+sourceRoot.sourceRootId);
  assert(root);
  const rootRef={id:root.id,version:root.version,contentHash:root.content_hash};
  assert.deepEqual(graph.dependencies,[
   {kind:'COMMAND_PROFILE_METADATA',ref:storedEnv.commandProfileRefs[0].ref},
   {kind:'ENVIRONMENT_HOST_DECLARATION',ref:targetHost.ref},
   {kind:'SECRET_REFERENCE_METADATA',ref:secret.ref},
   {kind:'SOURCE_ROOT_DECLARATION',ref:rootRef},
  ]);
  assert.deepEqual(graph.registrations.map((item:{host:unknown})=>item.host),[storedEnv.executionHostRef]);
  const sourceObservation=await f.run(actor=>new SourceReadRecords(f.access.installationId).readSnapshot(f.db,actor,f.pid,path.snapshotRef.id));
  assert.deepEqual(sourceObservation.snapshotRef,path.snapshotRef);
  assert.deepEqual(sourceObservation.sourceRootRef,rootRef);
  assert.deepEqual(sourceObservation.connectorRef,storedEnv.executionHostRef.connectorRef);
  assert.equal(sourceObservation.observedSummary.rootState,'OBSERVED');
  assert.equal(sourceObservation.evidenceClass,'CONNECTOR_REPORTED');assert.equal(sourceObservation.osVerification,'UNVERIFIED');
  assert.equal(sourceObservation.executionAuthorized,false);assert.equal(sourceObservation.agentDispatchPerformed,false);assert.equal(sourceObservation.baselineConfirmed,false);
  const hash=await approvalHash(),input=await reuseApprovalInput(f.actor.actorId,f.actor.clientId,new Date());
  Object.assign(input.candidatePayload,{
   preparationRef:snapshot.preparationRef,executionId:snapshot.execution.executionId,executionGeneration:snapshot.execution.executionGeneration,
   budgetPolicyRef:snapshot.budgetPolicyRef,permissionPolicyRef:policyRef,
   payload:{contextBundleRef:snapshot.contextBundleRef,optionsRef:snapshot.preparationRef},originReuse:{originRef:ref,reservationRef:reservation.ref},
  });
  input.details.actionScope.payloadHash=hash(input.candidatePayload);
  const original=structuredClone(f.tables.origins),originalConsumption=structuredClone(f.tables.approvalConsumptions);
  assert.equal(originalConsumption?.length,1);
  const wrongRef=(value:{id:string;version:number;contentHash:string})=>({...value,contentHash:hash('다른 전체 참조')});
  const mismatches=new Map<string,(candidate:typeof input.candidatePayload)=>void>([
   ['WRONG_EXECUTION_ID',candidate=>{candidate.executionId=id(74);}],
   ['WRONG_EXECUTION_GENERATION',candidate=>{candidate.executionGeneration++;}],
   ['WRONG_PREPARATION_REF',candidate=>{candidate.preparationRef=wrongRef(candidate.preparationRef);}],
   ['WRONG_CONTEXT_REF',candidate=>{candidate.payload.contextBundleRef=wrongRef(candidate.payload.contextBundleRef);}],
   ['WRONG_OPTIONS_REF',candidate=>{candidate.payload.optionsRef=wrongRef(candidate.payload.optionsRef);}],
   ['WRONG_BUDGET_REF',candidate=>{candidate.budgetPolicyRef=wrongRef(candidate.budgetPolicyRef);}],
   ['WRONG_P2_REF',candidate=>{candidate.permissionPolicyRef=wrongRef(candidate.permissionPolicyRef);}],
  ]);
  const ruleRejections=new Map<string,{operation:string;disposition:'MISSING'|'DENY'|'DENY_ALIAS'|'REQUIRE_APPROVAL'}>(reuseRuleOperations.flatMap(operation=>(
   ['MISSING','DENY','REQUIRE_APPROVAL'] as const
  ).map(disposition=>[operation+'_'+disposition,{operation,disposition}] as const)));
  ruleRejections.set('REUSE_DENY_ALIAS',{operation:'reuseExecutionStartOrigin',disposition:'DENY_ALIAS'} as const);
  for(const next of ['CURRENT','REQUEST_AFTER_SESSION','REQUEST_AFTER_APPROVAL_POLICY','REQUEST_AFTER_REGISTRATION','SECRET_METADATA_DENIED','MISSING_SNAPSHOT_AUDIT',...ruleRejections.keys(),'RUNTIME_CLOCK_BACKWARD','CHANGED_CONTEXT_DOCUMENT','TAMPERED_PREPARATION_OPTIONS',...mismatches.keys(),'TAMPERED_AF04','STALE_PLAN','STALE_METHOD','XID_AFTER_PLAN','CHANGED_DEFINITION','LIMIT_READER_TRANSIENT','REVOKED_REGISTRATION','SUPERSEDED_INSTRUCTION','REPLACED_CONSTITUTION','MISSING_CONTEXT_CONSUMPTION','REVOKED_LIMIT']){
   variant=next;switchXid=false;contextDocumentStart=-1;sawLimitHead=false;runtimeClockReads=0;
   const ruleRejection=ruleRejections.get(variant);
   f.modes.runtimeRules=originRuntimeRules(f,snapshot,ruleRejection);
   if(variant==='SUPERSEDED_INSTRUCTION'){
    registration.row.revoked_at=null;registration.connector.host_revoked_at=null;
    const revised:{data:{serverSequence:number;message:{message:{supersedesInstructionRef:unknown}}}}=await rich.supersede(policyRef);
    assert.equal(revised.data.serverSequence,2);
    assert.deepEqual(revised.data.message.message.supersedesInstructionRef,rich.messageRef);
   }
   if(variant==='REPLACED_CONSTITUTION'){
    const applied=await constitution.replace(policyRef);
    assert.equal(applied.ref.version,2);
    assert.deepEqual(applied.application.previousApplicationRef,constitution.current.ref);
    assert.notDeepEqual(applied.application.versionRef,originalConstitution);
   }
   if(variant==='REVOKED_LIMIT'){
    registration.row.revoked_at=null;registration.connector.host_revoked_at=null;
    const limitRef=snapshot.budgetPolicyRef;
    const revocation=await f.run(actor=>f.limits.revoke(f.db,actor,{...f.originCommand(),operation:'revokeLimitPolicy',targetId:limitRef.id,expectedVersion:limitRef.version,
     payload:{scope:{kind:'PROJECT',projectId:f.pid},reason:'원 한도 회수',policyBaseVersion:limitRef.version}},policyRef));
    assert.equal(revocation.data.status,'LIMIT_POLICY_REVOKED');
    assert.deepEqual(revocation.data.snapshot.previousRef,limitRef);
   }
   const commands=f.commands.size,receipts=f.receipts.size,audits=f.audits.size,effects=f.state.effects.length;
   f.modes.sourceHead=variant==='CHANGED_DEFINITION'?2:1;
   if(variant==='REVOKED_REGISTRATION'){registration.row.revoked_at=new Date();registration.connector.host_revoked_at=registration.row.revoked_at;}
   const start=f.trace.length,artifactStart={...artifactCalls};
   if(variant==='TAMPERED_AF04')f.files.set(artifactPath,tampered);
   const prepared=f.tables.preparations!.find(row=>row.id===snapshot.preparationRef.id);
   assert(prepared);
   const originalOptionsBody=prepared.snapshot_json.options.body;
   if(variant==='TAMPERED_PREPARATION_OPTIONS'){
    const changed=originalOptionsBody.replace('"auto"','"axto"');
    assert.notEqual(changed,originalOptionsBody);
    assert.equal(Buffer.byteLength(changed),Buffer.byteLength(originalOptionsBody));
    prepared.snapshot_json.options.body=changed;
   }
   const packet=structuredClone(input);
   shorterSession=undefined;observedPolicy=undefined;
   if(variant.startsWith('REQUEST_AFTER_')){
    const bound=new Date(Date.now()+5_000);
    packet.details.expiresAt=new Date(bound.getTime()+5_000).toISOString();
    if(variant==='REQUEST_AFTER_SESSION')shorterSession=bound;
    else{
     const current=f.policy(),operation=variant==='REQUEST_AFTER_APPROVAL_POLICY'?'requestApproval':'registerConnector';
     const rules=materialRules(current.rules_json.map(rule=>rule.operations.includes(operation)?{...rule,expiresAt:bound.toISOString()}:rule),f.pid,f.actor.actorId);
     const contentHash=hash({rules,reason:current.reason,reviewRefs:current.review_refs});
     observedPolicy={...current,rules_json:rules,content_hash:contentHash};
     packet.candidatePayload.permissionPolicyRef={id:current.id,version:current.head_version,contentHash};
     packet.details.actionScope.payloadHash=hash(packet.candidatePayload);
    }
   }
   if(variant==='SECRET_METADATA_DENIED'){
    const current=f.policy(),rules=materialRules(current.rules_json.map(rule=>rule.operations.includes('readSecretReferenceMetadata')?{...rule,disposition:'DENY'}:rule),f.pid,f.actor.actorId);
    const contentHash=hash({rules,reason:current.reason,reviewRefs:current.review_refs});
    observedPolicy={...current,rules_json:rules,content_hash:contentHash};
    packet.candidatePayload.permissionPolicyRef={id:current.id,version:current.head_version,contentHash};
    packet.details.actionScope.payloadHash=hash(packet.candidatePayload);
   }
   const mismatch=mismatches.get(variant);
   if(ruleRejection){
    const current=f.policy();
    packet.candidatePayload.permissionPolicyRef={id:current.id,version:current.head_version,contentHash:current.content_hash};
    packet.details.actionScope.payloadHash=hash(packet.candidatePayload);
   }
   if(mismatch){
    mismatch(packet.candidatePayload);
    packet.details.actionScope.payloadHash=hash(packet.candidatePayload);
   }
   const result=await app.inject({method:'POST',url,headers,payload:{...f.originCommand(),operation:'requestApproval',payload:packet}}).finally(()=>{
    f.files.set(artifactPath,originalBytes);
    if(variant==='TAMPERED_PREPARATION_OPTIONS')f.tables.preparations!.find(row=>row.id===snapshot.preparationRef.id)!.snapshot_json.options.body=originalOptionsBody;
   });
   assert.equal(result.statusCode,412,result.body);
   assert.equal(result.json().code,variant==='CURRENT'?'PROJECT_STORAGE_QUOTA_UNVERIFIED':'ORIGIN_REUSE_APPROVAL_NOT_CONNECTED');
   assert(!Object.hasOwn(result.json(),'dependencies'));
   assert(!result.body.includes(storedEnv.commandProfileRefs[0].ref.contentHash));
   assert(!result.body.includes(registration.connector.public_key_spki));
   assert(!result.body.includes(secret.ref.contentHash));
   assert(!result.body.includes(secretDefinition.logicalName));
   assert(!result.body.includes(path.snapshotRef.contentHash));
   assert(!result.body.includes('Synthetic A3'));
   const trace=f.trace.slice(start),begin=trace.indexOf('BEGIN'),rollback=trace.indexOf('ROLLBACK');
   const limitAt=trace.findIndex(sql=>sql.includes('FROM anvil.limit_policy_versions v')&&sql.includes('ORDER BY v.version DESC LIMIT 1'));
   const definitionAt=trace.findIndex(sql=>sql.includes('FROM anvil.connection_definition_versions v'));
   const preparationAt=trace.findIndex(sql=>sql.includes('FROM anvil.execution_preparations p JOIN anvil.commands c'));
   const contextAt=trace.findIndex(sql=>sql.includes('FROM anvil.context_bundles b JOIN anvil.commands c'));
   const itemsAt=trace.findIndex(sql=>sql.includes('FROM anvil.context_items'));
   const contextRequestAt=trace.findIndex((sql,index)=>index>contextAt&&sql.includes('FROM anvil.approval_requests r JOIN anvil.commands'));
   const contextDecisionAt=trace.findIndex((sql,index)=>index>contextRequestAt&&sql.includes('FROM anvil.approval_decisions d JOIN anvil.commands'));
   const contextConsumptionAt=trace.findIndex((sql,index)=>index>contextDecisionAt&&sql.startsWith('SELECT ac.*,c.command_id candidate_command_id'));
   const contextDocumentAt=trace.findIndex(sql=>sql.startsWith('SELECT content_hash FROM anvil.document_versions'));
   const knowledgeAt=trace.findIndex(sql=>sql.startsWith('SELECT v.*,k.kind,k.head_version FROM anvil.knowledge_versions'));
   const instructionMetadataAt=trace.findIndex(sql=>sql.startsWith('SELECT m.content_hash,m.kind,m.conversation_id,EXISTS'));
   const instructionAt=trace.findIndex(sql=>sql.startsWith('SELECT * FROM anvil.conversation_messages'));
   const environmentAt=trace.findIndex(sql=>sql.includes('FROM anvil.environment_configuration_versions v'));
   const dependencies=dependencyQueries.filter(hit=>hit.at>=start);
   const hostAt=dependencies.findIndex(hit=>hit.kind==='ENVIRONMENT_HOST_DECLARATION'&&hit.id===targetHost.ref.id&&hit.version===targetHost.ref.version);
   const secretAt=dependencies.findIndex(hit=>hit.kind==='SECRET_REFERENCE_METADATA'&&hit.id===secret.ref.id&&hit.version===secret.ref.version);
   const snapshotAt=trace.findIndex((sql,i)=>i>environmentAt&&sql.startsWith('SELECT * FROM anvil.source_snapshots'));
   const grantAt=trace.findIndex((sql,i)=>i>snapshotAt&&sql.includes('FROM anvil.source_read_grants g'));
   const credentialAt=trace.findIndex((sql,i)=>i>grantAt&&sql.includes('FROM anvil.source_read_credentials'));
   const snapshotAuditAt=trace.findIndex((sql,i)=>i>credentialAt&&sql.includes("reason_code='SOURCE_READ_REPORT_STORED'"));
   const secondGrantAt=trace.findIndex((sql,i)=>i>snapshotAuditAt&&sql.includes('FROM anvil.source_read_grants g'));
   const rootAt=trace.findIndex((sql,i)=>i>snapshotAuditAt&&sql.startsWith('SELECT v.*,r.head_version,c.result_ref'));
   const lockedRegistration=trace.findIndex(sql=>sql.includes('JOIN anvil.connectors h')&&sql.endsWith('FOR SHARE OF r,h'));
   const originalRegistration=trace.findIndex((sql,i)=>i>lockedRegistration&&sql.includes('FROM anvil.connector_registrations r JOIN anvil.commands c'));
   const planAt=trace.findIndex(sql=>sql.includes('FROM anvil.work_plan_versions WHERE'));
   const confirmationAt=trace.findIndex(sql=>sql.includes('FROM anvil.work_plan_confirmations f'));
   const methodologyAt=trace.findIndex(sql=>sql.includes('FROM anvil.project_methodologies')&&sql.includes('ORDER BY application_version DESC LIMIT 1'));
   if(variant==='REQUEST_AFTER_SESSION'||variant==='REQUEST_AFTER_APPROVAL_POLICY'){
    assert(begin>=0&&rollback>begin);
    assert.equal(trace.some(sql=>sql.includes('FROM anvil.execution_start_origins o')),false,variant+' 원자료 조회 전에 거절한다');
    assert.deepEqual(artifactCalls,artifactStart);
   }else if(mismatch){
    assert.equal(trace.some(sql=>sql.includes('FROM anvil.execution_start_origins o')),variant!=='WRONG_P2_REF',variant);
    assert(begin>=0&&rollback>begin);
    assert(!trace.some(sql=>sql.includes('FROM anvil.queue_requests q')),variant+' 대기 단계 조회 금지');
    assert.equal(planAt,-1);assert.equal(limitAt,-1);assert.equal(environmentAt,-1);assert.equal(lockedRegistration,-1);
    assert.deepEqual(artifactCalls,artifactStart);
   }else{
    assert(begin>=0&&planAt>begin&&rollback>planAt,variant+' 계획 보호 조회 누락');
    if(variant==='XID_AFTER_PLAN'){assert(switchXid);assert.equal(artifactCalls.read,artifactStart.read);}
    else assert(artifactCalls.read>artifactStart.read,variant+' 원 파일 읽기 누락');
    assert.equal(artifactCalls.open-artifactStart.open,artifactCalls.close-artifactStart.close);
    assert.equal(artifactCalls.write,artifactStart.write);
    assert.equal(trace.slice(begin,rollback).filter(sql=>sql==='BEGIN').length,1);
    if(['TAMPERED_AF04','STALE_PLAN','STALE_METHOD','XID_AFTER_PLAN'].includes(variant)){
     if(variant==='TAMPERED_AF04')assert.equal(tampered.length,originalBytes.length);
     assert.equal(confirmationAt>=0,variant==='STALE_PLAN'||variant==='STALE_METHOD');
     assert.equal(methodologyAt>=0,variant==='STALE_METHOD');
     assert.equal(limitAt,-1);assert.equal(definitionAt,-1);assert.equal(environmentAt,-1);assert.equal(lockedRegistration,-1);
    }else if(ruleRejection||['REVOKED_LIMIT','LIMIT_READER_TRANSIENT','RUNTIME_CLOCK_BACKWARD'].includes(variant)){
     assert(limitAt>methodologyAt&&rollback>limitAt,'실제 최신 한도를 읽은 뒤 종료한다');
     if(variant==='LIMIT_READER_TRANSIENT'){assert.equal(transientSwaps,1);assert.equal(substituteCalls,0);assert.equal(approvalLookups,1);}
     if(variant==='RUNTIME_CLOCK_BACKWARD')assert.equal(clockRegressions,1);
     assert.equal(definitionAt,-1,variant);assert.equal(environmentAt,-1,variant);assert.equal(lockedRegistration,-1,variant);
    }else{
     assert(confirmationAt>planAt&&methodologyAt>confirmationAt&&limitAt>methodologyAt&&definitionAt>limitAt&&rollback>definitionAt,variant+' 계획·방법론·한도·정의의 순서가 달라짐');
     if(variant==='CHANGED_DEFINITION'){
      assert.equal(environmentAt,-1,'정의 head가 바뀌면 환경 관측 전에 거절한다');
      assert.equal(lockedRegistration,-1);
     }else if(variant==='TAMPERED_PREPARATION_OPTIONS'){
      assert(preparationAt>definitionAt&&rollback>preparationAt,'변조된 준비 원행을 읽은 뒤 종료한다');
      assert.equal(contextAt,-1);assert.equal(environmentAt,-1);assert.equal(lockedRegistration,-1);
     }else if(variant==='MISSING_CONTEXT_CONSUMPTION'){
      assert(contextAt>preparationAt&&contextRequestAt>contextAt&&contextDecisionAt>contextRequestAt&&contextConsumptionAt>contextDecisionAt&&rollback>contextConsumptionAt,variant);
      assert.equal(itemsAt,-1);assert.equal(environmentAt,-1);assert.equal(lockedRegistration,-1);
     }else{
      assert(preparationAt>definitionAt,variant+' 원 준비 조회 누락');
      assert(contextRequestAt>contextAt&&contextDecisionAt>contextRequestAt&&contextConsumptionAt>contextDecisionAt&&itemsAt>contextConsumptionAt,variant+' 원 P1 승인 소비 읽기 누락');
      assert(contextAt>preparationAt&&itemsAt>contextAt,variant+' Context 원본 조회 누락');
      const constitutionReads=constitutionQueries.filter(hit=>hit.at>=start);
      const applicationAt=constitutionReads.findIndex(hit=>hit.kind==='APPLICATION'&&hit.value===(variant==='REPLACED_CONSTITUTION'?2:1));
      const rulesMetadataAt=constitutionReads.findIndex(hit=>hit.kind==='METADATA'&&hit.value===originalConstitution.id);
      const rulesKnowledgeAt=constitutionReads.findIndex(hit=>hit.kind==='KNOWLEDGE'&&hit.value===originalConstitution.id);
      assert(applicationAt>=0&&constitutionReads[applicationAt]!.at>start+itemsAt&&rulesMetadataAt>applicationAt,variant+' 적용 헌법과 선택 원본 대조 누락');
      if(variant==='REPLACED_CONSTITUTION'){
       assert.equal(rulesKnowledgeAt,-1,'현재 적용본 교체 뒤 선택된 옛 헌법 원문을 읽지 않는다');
       assert.equal(instructionMetadataAt,-1);assert.equal(contextDocumentAt,-1);
       assert.equal(environmentAt,-1);assert.equal(lockedRegistration,-1);
      }else{
       assert(rulesKnowledgeAt>rulesMetadataAt&&constitutionReads[rulesKnowledgeAt]!.at<start+instructionMetadataAt,variant+' 실제 헌법 지식 조회 누락');
       assert(contextDocumentAt>itemsAt&&rollback>contextDocumentAt,variant+' 문서 Context 검산 누락');
       assert(knowledgeAt>itemsAt&&instructionMetadataAt>knowledgeAt,variant+' 확정 지식·사용자 지시 관측 누락');
       if(variant==='SUPERSEDED_INSTRUCTION'){
        assert.equal(instructionAt,-1,'대체된 원 지시 본문을 읽지 않는다');
        assert.equal(environmentAt,-1);assert.equal(lockedRegistration,-1);
       }else if(variant==='CHANGED_CONTEXT_DOCUMENT'){
        assert(instructionAt>instructionMetadataAt&&contextDocumentAt>instructionAt,variant);
        assert.equal(artifactCalls.read,contextDocumentStart);
        assert.equal(environmentAt,-1);assert.equal(lockedRegistration,-1);
       }else{
        assert(instructionAt>instructionMetadataAt&&contextDocumentAt>instructionAt,variant+' 실제 지시 보호 조회 누락');
        assert(contextDocumentStart>=0&&artifactCalls.read>contextDocumentStart,'문서 메타데이터 확인 뒤 실제 원문을 읽는다');
        assert(environmentAt>contextDocumentAt&&hostAt>=0&&dependencies[hostAt]!.at>start+environmentAt,variant+' 원 호스트 선언 관측 누락');
        assert(snapshotAt>environmentAt&&grantAt>snapshotAt&&credentialAt>grantAt&&snapshotAuditAt>credentialAt,variant+' 원 snapshot 저장 관계 검산 누락');
        if(variant==='MISSING_SNAPSHOT_AUDIT'){
         assert.equal(secondGrantAt,-1);assert.equal(rootAt,-1);assert.equal(lockedRegistration,-1);
        }else{
         assert(secondGrantAt>snapshotAuditAt&&rootAt>secondGrantAt,variant+' 보고 감사 이후 원 grant와 선언 재대조 누락');
        }
        if(variant==='SECRET_METADATA_DENIED'||variant==='MISSING_SNAPSHOT_AUDIT'){
         assert.equal(secretAt,-1,variant+' 차단 뒤에는 Secret 메타데이터 원행을 읽지 않는다');
         assert.equal(lockedRegistration,-1);
        }else{
         assert(secretAt>hostAt&&dependencies[secretAt]!.at<start+lockedRegistration,variant+' 등록 전 Secret 메타데이터 관측 누락');
         assert(environmentAt>contextDocumentAt&&lockedRegistration>environmentAt&&rollback>lockedRegistration,trace.join('\n'));
         if(variant==='REVOKED_REGISTRATION'||variant==='REQUEST_AFTER_REGISTRATION')assert.equal(originalRegistration,-1,variant+' 등록 이력 후행 검산에 도달하지 않는다');
         else{
          assert(originalRegistration>lockedRegistration&&originalRegistration<rollback,trace.join('\n'));
          const afterProof=trace.findIndex((sql,i)=>i>originalRegistration&&sql.startsWith('SELECT * FROM anvil.audit_events')&&sql.includes('EXPLICIT_STATUS_ONLY_HOST_REGISTRATION'));
          assert(afterProof>originalRegistration&&afterProof<rollback);
          // 감사 조회의 후행 시계, 검산 단계의 후행 시계, 전체 관측의 최종 시계다.
          assert.equal(trace.slice(afterProof+1,rollback).filter(sql=>sql.startsWith('SELECT pg_current_xact_id_if_assigned()::text AS transaction_id, clock_timestamp() AS at')).length,3);
         }
        }
       }
      }
     }
    }
   }
   assert(!trace.slice(begin,rollback).some(sql=>/^(INSERT|UPDATE|DELETE) /.test(sql)),trace.join('\n'));
   assert.equal(f.commands.size,commands);assert.equal(f.receipts.size,receipts);assert.equal(f.audits.size,audits);assert.equal(f.state.effects.length,effects);
  }
  assert.deepEqual(f.tables.origins,original);
  assert.deepEqual(f.tables.approvalConsumptions,originalConsumption);
  assert.equal(f.tables.notifications!.length,1);
  assert.equal(denialAudits,27+ruleRejections.size);
  assert.deepEqual(f.state.unsupported,[]);
 }finally{ProjectApprovals.prototype.readLimitPolicyConsumption=approvalReader;await app.close();}
 assert.equal(f.active(),false);
});

test('Context 승인 이력의 교차 환경 후보 표식은 환경 reader 전에 거절한다',async()=>{
 const {ProjectApprovals}=await import('../../../apps/server/modules/approvals/project-approvals.ts');
 const pid=id(80),actorId=id(81),clientId=id(82),requestId=id(83),at=new Date();
 const hash=await approvalHash(),input=await reuseApprovalInput(actorId,clientId,at);
 const actionScope={...input.details.actionScope,operation:'buildTaskContext'},details={...input.details,actionScope};
 const requestedBy={kind:'HUMAN',userId:actorId,clientId},requiredDecider={kind:'HUMAN',userId:actorId};
 const policyRef={id:id(84),version:1,contentHash:hash('합성 정책')},scopeDigest=hash(actionScope);
 const snapshot={projectId:pid,details,scopeDigest,requestedBy,requiredDecider,policyRef,controlGeneration:1,candidateKind:'ENVIRONMENT_DEFINITION'};
 const ref={id:requestId,version:1,contentHash:hash(snapshot)};
 const request={id:requestId,version:1,status:'PENDING',createdAt:at.toISOString(),...snapshot};
 const row={request_json:request,created_at:at,created_by:actorId,client_id:clientId,actor_id:actorId,command_client:clientId,
  content_hash:ref.contentHash,operation:'requestApproval',result_ref:{status:'APPLIED',data:{ref,status:'APPROVAL_REQUESTED',request}},
  policy_ref:policyRef,details_json:details,candidate_command_id:details.candidateCommandId,action_scope_json:actionScope,
  scope_digest:scopeDigest,required_decider_ref:requiredDecider,expires_at:new Date(details.expiresAt)};
 let reads=0;
 const db={query:async(sql:string,args:unknown[])=>{
  reads++;
  if(sql.startsWith('SELECT p.id,p.archived_at,m.participation')){
   assert.deepEqual(args,[pid,actorId]);return {rows:[{id:pid,archived_at:null,participation:'OWNER'}]};
  }
  if(sql.includes('FROM anvil.approval_requests r JOIN anvil.commands c')){
   assert.deepEqual(args,[pid,requestId]);return {rows:[row]};
  }
  throw Error('UNEXPECTED_CANDIDATE_READ');
 }};
 const actor={actorId,clientId,serverOwner:false,credentialGeneration:1,reauthUntil:null};
 await assert.rejects(new ProjectApprovals().readContextConsumption(db as unknown as import('pg').PoolClient,actor,pid,requestId),/APPROVAL_INTEGRITY_FAILED/);
 assert.equal(reads,2);
});

test('원자료 재사용 정책 전용 연산은 정확한 EXECUTION 범위만 허용한다',async()=>{
 const {documentOperations,runtimeOperations}=await import('../../../apps/server/modules/access/project-command.ts');
 const projectId=id(2),actorId=id(1),operation='reuseExecutionStartOrigin';
 const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
 const project={kind:'PROJECT',projectId};
 const scope={kind:'EXECUTION',projectId,executionId:id(3),executionGeneration:1,sourceScopes:[{
  sourceRootRef:ref(4),mappingRef:null,observationRef:ref(5),baselineRef:ref(6),
  targets:[{relativePath:'src/a.ts',kind:'FILE',access:'READ',recursive:false}],
 }]};
 const base=rules([operation])[0]!,rule={...base,targetScopes:[scope],limitPolicyRef:ref(7)};
 assert.throws(()=>materialRules([{...base,targetScopes:[project]}],projectId,actorId),/POLICY_SCOPE_NOT_READY/);
 assert.throws(()=>materialRules([{...rule,targetScopes:[scope,project]}],projectId,actorId),/POLICY_INPUT_INVALID/);
 for(const invalid of [
  {...scope,projectId:id(8)},{...scope,executionId:'not-a-uuid'},{...scope,executionGeneration:0},
  {...scope,executionGeneration:Number.MAX_SAFE_INTEGER+1},{...scope,sourceScopes:[]},
  {...scope,sourceScopes:[{...scope.sourceScopes[0],observationRef:null}]},{...scope,extra:false},
 ])assert.throws(()=>materialRules([{...rule,targetScopes:[invalid]}],projectId,actorId),/POLICY_INPUT_INVALID/);
 for(const limitPolicyRef of [null,{...ref(7),contentHash:'불일치'}])
  assert.throws(()=>materialRules([{...rule,limitPolicyRef}],projectId,actorId),/POLICY_SCOPE_NOT_READY/);
 assert.throws(()=>materialRules([{...rule,operations:[operation,'prepareExecution']}],projectId,actorId),/POLICY_SCOPE_NOT_READY/);
 assert.deepEqual(runtimeOperations,['authorizeExecution','queueExecutionCommand','revokeExecutionGrant','requestExecutionStop','authorizeExecutionRecovery']);
 assert(!(documentOperations as readonly string[]).includes(operation));
 const runtime={...rule,operations:['authorizeExecution','queueExecutionCommand']};
 assert.deepEqual(materialRules([runtime],projectId,actorId),[runtime]);
 assert.deepEqual(materialRules([rule],projectId,actorId),[rule]);
 const mixed={...rule,operations:[operation,...runtime.operations]};
 assert.deepEqual(materialRules([mixed],projectId,actorId),[mixed]);
});

test('원 보호관측 뒤 재사용 요청 PENDING을 같은 거래에 계상하고 원 ID로만 보호 재조회한다',async t=>{
 const f=await executionStartOriginFixture({connectorEnvironment:true,richContext:true,environmentDependencies:true,constitutionContext:true,approvedContext:true,snapshotRoot:true,originRequestStorage:true});
 const {buildApp}=await import('../../../apps/server/app.ts');
 const {ProjectDocuments}=await import('../../../apps/server/modules/documents/project-documents.ts');
 const {ProjectInitialExecutionQueue}=await import('../../../apps/server/modules/executions/execution-commands.ts');
 const {createOriginReuseApprovalCapability}=await import('../../../apps/server/modules/executions/execution-start-origin-reuse.ts');
 const config={repository:f.access,origin:'https://anvil-synthetic.invalid',artifactRoot:f.root};
 const headers={host:'anvil-synthetic.invalid',origin:config.origin,cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf};
 const forbidden=async()=>{throw Error('UNEXPECTED_EXECUTION');};
 const queue=new ProjectInitialExecutionQueue(f.access,{transport:'SYNTHETIC_ONLY',basis:forbidden,current:forbidden});
 const cap=createOriginReuseApprovalCapability(f.access,queue,f.sessions,new ProjectDocuments(f.root,undefined,'FN09_PLAN_PROOF'));
 const app=buildApp({},undefined,config,{transport:'SYNTHETIC_ONLY',queue,originReuseApproval:cap,stop:{command:forbidden},recovery:{command:forbidden},understanding:{command:forbidden}});
 try{
  const url='/api/v1/projects/'+f.pid+'/commands';
  const origin=await app.inject({method:'POST',url,headers,payload:f.originCommand()});assert.equal(origin.statusCode,200,origin.body);
  const {ref,snapshot,reservation}=origin.json().data;
  f.modes.policyVersion=2;f.modes.runtimeRules=originRuntimeRules(f,snapshot);
  const p2=f.policy(),policyRef={id:p2.id,version:p2.head_version,contentHash:p2.content_hash};
  const input=await reuseApprovalInput(f.actor.actorId,f.actor.clientId,new Date());
  Object.assign(input.candidatePayload,{preparationRef:snapshot.preparationRef,executionId:snapshot.execution.executionId,executionGeneration:1,
   permissionPolicyRef:policyRef,budgetPolicyRef:snapshot.budgetPolicyRef,payload:{contextBundleRef:snapshot.contextBundleRef,optionsRef:snapshot.preparationRef},originReuse:{originRef:ref,reservationRef:reservation.ref}});
  input.details.actionScope.payloadHash=(await approvalHash())(input.candidatePayload);
  const command={...f.originCommand(),operation:'requestApproval',payload:input};
  const notifications=f.tables.notifications!.length,decisions=f.tables.approvalDecisions!.length,consumptions=f.tables.approvalConsumptions!.length;
  const rawQuery=f.db.query;let queryFailure='';
  f.db.query=(async(sql:string,args:unknown[])=>{try{return await rawQuery.call(f.db,sql,args);}catch(error){queryFailure=(error as Error).message+' '+sql;throw error;}}) as typeof f.db.query;
  const response=await app.inject({method:'POST',url,headers,payload:command});assert.equal(response.statusCode,200,response.body+' '+JSON.stringify(f.state.unsupported)+' '+queryFailure);
  const value=response.json();assert.equal(value.status,'APPLIED');assert.equal(value.data.request.status,'PENDING');
  assert.deepEqual(value.data.request.originReuseEvidence.candidatePayload,input.candidatePayload);
  assert.equal(f.tables.notifications!.length,notifications+1);assert.equal(f.tables.approvalDecisions!.length,decisions);assert.equal(f.tables.approvalConsumptions!.length,consumptions);
  const fetched=await app.inject({method:'GET',url:`/api/v1/projects/${f.pid}/approvals/${value.data.ref.id}`,headers});assert.equal(fetched.statusCode,200,fetched.body);
  assert.deepEqual(fetched.json().requestRef,value.data.ref);assert.equal(fetched.json().storedStatus,'PENDING');assert.equal(fetched.json().executionAuthorized,false);
  const replay=await app.inject({method:'POST',url,headers,payload:command});assert.equal(replay.statusCode,200,replay.body);assert.deepEqual(replay.json(),value);
  assert.equal(f.tables.notifications!.length,notifications+1);assert.equal(f.modes.requestReserveCalls,1);assert.equal(f.modes.requestSettleCalls,1);
  const duplicate=await app.inject({method:'POST',url,headers,payload:{...command,commandId:id(909)}});assert.equal(duplicate.statusCode,409,duplicate.body);
  assert.equal(f.tables.notifications!.length,notifications+1);assert.deepEqual(f.state.unsupported,[]);
  await t.test('실제 새 PENDING 알림은 기존 목록과 상세에서 봉인된 목적만 소비한다',async()=>{
   const list=await app.inject({method:'GET',url:`/api/v1/projects/${f.pid}/notifications`,headers});assert.equal(list.statusCode,200,list.body);
   const notification=f.tables.notifications!.find(n=>n.approval_request_id===value.data.ref.id);assert(notification);
   assert(list.json().items.some((n:any)=>n.id===notification.id));
   const detail=await app.inject({method:'GET',url:`/api/v1/projects/${f.pid}/notifications/${notification.id}`,headers});assert.equal(detail.statusCode,200,detail.body);
   assert.equal(detail.json().authenticatedTarget.approvalRequestId,value.data.ref.id);assert(!detail.body.includes('candidatePayload'));
  });
  await t.test('저장 요청 읽기의 현재 REQUIRE_APPROVAL은 원문과 영수증을 반환하지 않는다',async()=>{
   f.modes.originReadDisposition='REQUIRE_APPROVAL';f.modes.policyVersion=3;
   try{const denied=await app.inject({method:'GET',url:`/api/v1/projects/${f.pid}/approvals/${value.data.ref.id}`,headers});assert.equal(denied.statusCode,412,denied.body);assert(!denied.body.includes('originReuseEvidence'));}
   finally{f.modes.originReadDisposition='AUTO';f.modes.policyVersion=2;}
  });
  await t.test('현재 원자료 읽기 DENY와 실제 저장 감사 변조는 보호 원문을 숨긴다',async()=>{
   const readUrl=`/api/v1/projects/${f.pid}/approvals/${value.data.ref.id}`;
   f.modes.originReadDisposition='DENY';f.modes.policyVersion=3;
   try{const denied=await app.inject({method:'GET',url:readUrl,headers});assert.equal(denied.statusCode,403);assert(!denied.body.includes('originReuseEvidence'));}
   finally{f.modes.originReadDisposition='AUTO';f.modes.policyVersion=2;}
   const row=f.tables.approvalRequests!.find(r=>r.id===value.data.ref.id),audit=row&&f.audits.get(row.command_id);assert(audit);
   const before=structuredClone(audit);audit.actor_ref={kind:'HUMAN',userId:id(950)};
   try{const corrupt=await app.inject({method:'GET',url:readUrl,headers});assert.equal(corrupt.statusCode,503);assert(!corrupt.body.includes('originReuseEvidence'));}
   finally{Object.assign(audit,before);}
  });
  for(const [mode,status]of[['UNVERIFIED',412],['CAP',429],['MISSING_NOTIFICATION',503],['SETTLE_LOST',503],['XID_AFTER_RESERVE',503],['OVERSIZED_SETTLE',503]] as const)await t.test('요청 저장 실패 '+mode+'는 C/A/U/요청/알림/R을 원자적으로 되돌린다',async()=>{
   const pending={...structuredClone(command),commandId:id(920+['UNVERIFIED','CAP','MISSING_NOTIFICATION','SETTLE_LOST','XID_AFTER_RESERVE','OVERSIZED_SETTLE'].indexOf(mode))};
   // 요청과 실행 후보의 ID는 서로 달라야 하며 후보 중복도 만들지 않는다.
   pending.payload.details.candidateCommandId=id(930+['UNVERIFIED','CAP','MISSING_NOTIFICATION','SETTLE_LOST','XID_AFTER_RESERVE','OVERSIZED_SETTLE'].indexOf(mode));
   const counts={commands:f.commands.size,receipts:f.receipts.size,audits:f.audits.size,requests:f.tables.approvalRequests!.length,notifications:f.tables.notifications!.length,reservations:f.tables.reservations!.length,used:f.modes.requestUsed,held:f.modes.requestHeld};
   f.modes.requestFault=mode;f.modes.requestQuota=mode==='UNVERIFIED'?'UNVERIFIED':'VERIFIED';if(mode==='CAP')f.modes.requestOther=10737418240;if(mode==='SETTLE_LOST')f.modes.settle='LOST';
   try{const rejected=await app.inject({method:'POST',url,headers,payload:pending});assert.equal(rejected.statusCode,status,mode+':'+rejected.statusCode);assert(!rejected.body.includes('originReuseEvidence'));}
   finally{f.modes.requestFault='NORMAL';f.modes.requestQuota='VERIFIED';f.modes.requestOther=0;f.modes.settle='NORMAL';}
   assert.deepEqual({commands:f.commands.size,receipts:f.receipts.size,audits:f.audits.size,requests:f.tables.approvalRequests!.length,notifications:f.tables.notifications!.length,reservations:f.tables.reservations!.length,used:f.modes.requestUsed,held:f.modes.requestHeld},counts);
  });
  await t.test('COMMIT 불명은 원 packet을 보존하고 자동 재예약·재발행·후행 조회를 하지 않는다',async()=>{
   const pending={...structuredClone(command),commandId:id(970)};pending.payload.details.candidateCommandId=id(971);
   const original=structuredClone(pending),before=f.modes.requestReserveCalls;f.modes.commit='LOST';const start=f.trace.length;
   let uncertain;
   try{uncertain=await app.inject({method:'POST',url,headers,payload:pending});}finally{f.modes.commit='NORMAL';}
   assert.equal(uncertain.statusCode,503);assert.deepEqual(pending,original);assert.equal(f.modes.requestReserveCalls,before+1);
   const trace=f.trace.slice(start),commit=trace.indexOf('COMMIT');assert(commit>=0);assert(!trace.slice(commit+1).some(sql=>sql.startsWith('SELECT')||sql.startsWith('INSERT')||sql.startsWith('BEGIN')));
   assert.equal(uncertain.json().retryDisposition,'reconcile-first');
  });
 }finally{await app.close();}
 assert.equal(f.active(),false);
});
