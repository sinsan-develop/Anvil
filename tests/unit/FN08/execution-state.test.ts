import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes,randomUUID } from 'node:crypto';
import { AccessRepository,AuthFailure } from '../../../apps/server/modules/access/repository.ts';
import { buildApp } from '../../../apps/server/app.ts';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import { prepareResponsibleSessionInput } from '../../../apps/web/src/features/workspace/responsible-session-api.ts';
import { canonicalJson,contentHash } from '../../../contracts/canonical.ts';
import { readExecutionPreparationIntentV1 } from '../../../contracts/runtime/execution-intent-v1.ts';
import { compileExecutionPreparationOptions } from '../../../apps/server/modules/executions/preparation-input.ts';
import { seed } from '../UI04/registered-preparation-options-fixture.ts';
const module:any=await import('../../../apps/server/modules/executions/project-execution-state.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const pid='11111111-1111-4111-8111-111111111111',ref={id:pid,version:1,contentHash:'a'.repeat(64)},actor:any={actorId:pid,clientId:pid};
function fixture(count=21) {
  let member=true,reads:string[]=[];
  const assignment={projectId:pid,ref,snapshot:{definition:{taskRef:{applicationRef:ref,nodeId:'개발'}},contentConfirmed:true,executionAuthorized:false,dispatchPerformed:false}};
  const db:any={query:async(sql:string,args:any[])=>{
    if(sql.startsWith('SELECT p.id,p.archived_at')){reads.push('MEMBER');return{rows:member?[{id:pid,participation:'OWNER'}]:[]};}
    if(sql.includes('FROM anvil.project_roles')){assert.equal(args[0],pid);assert.deepEqual(JSON.parse(args[1]),{applicationRef:ref,nodeId:'개발'});return{rows:[{role_id:pid,version:1}]};}
    if(sql.includes('FROM anvil.role_bindings'))return{rows:[{binding_id:pid,version:2}]};
    if(sql.includes('FROM anvil.execution_preparations'))return{rows:Array.from({length:count},(_,n)=>({id:preparationId(n),version:1}))};
    throw Error('UNEXPECTED_QUERY');
  }};
  const dependencies:any={assignments:{read:async()=>{reads.push('ASSIGNMENT');return assignment;}},sessions:{readRole:async()=>{reads.push('ROLE');return{projectId:pid,ref,snapshot:{kind:'STAGE_OWNER'}};},readBinding:async()=>{reads.push('BINDING');return{projectId:pid,ref:{...ref,version:2},snapshot:{state:'RESERVED'}};}},preparations:{read:async()=>{reads.push('PREPARATION');return{projectId:pid,ref,snapshot:{authorizationState:'NOT_AUTHORIZED'}};}}};
  return{db,dependencies,reads,deny:()=>{member=false;}};
}
const maxBytes=2*1024*1024;
const bytes=(v:unknown)=>Buffer.byteLength(canonicalJson(v),'utf8');
const preparationId=(n:number)=>`22222222-2222-4222-8222-${String(n).padStart(12,'0')}`;
function withPreparations(count:number,padding:(n:number)=>string){
  const f=fixture(count),rows=Array.from({length:count},(_,n)=>({projectId:pid,ref:{...ref,id:preparationId(n)},snapshot:{authorizationState:'NOT_AUTHORIZED',reason:padding(n)}}));
  f.dependencies.preparations.read=async(_db:any,_actor:any,_project:string,id:string)=>{f.reads.push(id);return rows.find(row=>row.ref.id===id);};
  return {...f,rows,read:()=>module.readExecutionPreparationState(f.db,actor,pid,pid,1,f.dependencies)};
}
test('2MiB 정합 원문 경계에서는 최신 연속 접두부와 기존 hasMore만 반환한다',async()=>{
  const empty=await withPreparations(0,()=> '').read();
  const skeleton=withPreparations(2,()=> '');
  const missing={...empty,preparations:[skeleton.rows[0]],hasMorePreparations:true};
  const padding='가'.repeat(100)+'"\\';
  const budget=maxBytes-bytes(missing)-bytes(padding)+bytes('');
  const exact=withPreparations(2,n=>n===0?padding+'a'.repeat(budget):'이전');
  const value=await exact.read();
  assert.deepEqual(value,{...missing,preparations:[exact.rows[0]]});
  assert.equal(bytes(value),maxBytes);
  assert.deepEqual(exact.reads.slice(-2),exact.rows.map(row=>row.ref.id));
  const firstDoesNotFit=withPreparations(3,n=>n===0?padding+'a'.repeat(budget+1):'더 작은 이전 기록');
  assert.deepEqual(await firstDoesNotFit.read(),{...empty,hasMorePreparations:true});
  assert.deepEqual(firstDoesNotFit.reads.slice(-3),firstDoesNotFit.rows.map(row=>row.ref.id));

  const one=withPreparations(1,()=>padding+'a'.repeat(budget-1));
  assert.deepEqual(await one.read(),{...empty,preparations:one.rows});
  assert.equal(bytes({...empty,preparations:one.rows}),maxBytes);
  const small=withPreparations(2,()=> '정상 소량');
  assert.deepEqual(await small.read(),{...empty,preparations:small.rows});
  const fullBudget=maxBytes-bytes({...empty,preparations:small.rows});
  const full=withPreparations(2,n=>'정상 소량'+(n===1?'a'.repeat(fullBudget):''));
  assert.deepEqual(await full.read(),{...empty,preparations:full.rows});
  assert.equal(bytes({...empty,preparations:full.rows}),maxBytes);
});
for(const corrupt of [1,19])test('생략될 준비 원문 무결성 오류도 전파한다 · '+corrupt,async()=>{
  const f=withPreparations(21,n=>n===0?'a'.repeat(maxBytes):'');
  const read=f.dependencies.preparations.read;
  f.dependencies.preparations.read=async(...args:any[])=>{const value=await read(...args);if(value.ref.id===preparationId(corrupt))throw new AuthFailure('EXECUTION_PREPARATION_INTEGRITY_FAILED',503);return value;};
  await assert.rejects(f.read(),{message:'EXECUTION_PREPARATION_INTEGRITY_FAILED',statusCode:503});
  assert.equal(f.reads.at(-1),preparationId(corrupt));
});
for(const reader of ['readRole','readBinding'])test('역할·예약 결박 자체가 상한을 넘으면 기존 503을 유지한다 · '+reader,async()=>{
  const f=withPreparations(1,()=> '');
  const read=f.dependencies.sessions[reader];
  f.dependencies.sessions[reader]=async()=>{const value=await read();return {...value,snapshot:{...value.snapshot,reason:'a'.repeat(maxBytes)}};};
  await assert.rejects(f.read(),{message:'EXECUTION_STATE_TOO_LARGE',statusCode:503});
});
test('보호 보관본 합계가 넘쳐도 UI04는 같은 임무의 등록 역할·결박으로 준비를 연다',async()=>{
  const f=seed(true),projectId=f.confirmed.projectId,assignmentRef=f.confirmed.ref;
  const scope={...f.scope,targets:Array.from({length:200},(_,i)=>({...f.scope.targets[0],relativePath:Array(4).fill('a'.repeat(249)).join('/')+`/${i}.ts`}))};
  f.confirmed.snapshot.definition.allowedScopes=[scope];
  assignmentRef.contentHash=contentHash(canonicalJson(f.confirmed.snapshot));
  f.binding.snapshot.assignmentRef=assignmentRef;
  f.binding.ref.contentHash=contentHash(canonicalJson(f.binding.snapshot));
  f.state.assignmentRef=assignmentRef;f.state.bindings=[f.binding];
  const input=readExecutionPreparationIntentV1({projectId,assignmentRef,roleBindingRef:f.binding.ref,contextBundleRef:f.context.ref,
    connectionRef:f.connection.ref,environmentRef:f.environment.ref,capabilityRef:f.report.ref,budgetPolicyRef:f.budget.ref,
    sourceScopes:[scope],mode:'CONTEXT_REVIEW',reason:'정상 보관 범위',connectionKind:'REGISTERED_DEFINITION',optionsFormat:'CLAUDE_QUERY_DATA_V1'});
  const options=compileExecutionPreparationOptions(f.connection.definition);
  const preparations=Array.from({length:12},(_,i)=>{
    const snapshot={intent:input,basisRefs:[assignmentRef],latestInstructionRefs:[],checkedAt:new Date(Date.parse(f.at)-i).toISOString(),
      missingConditions:['RESPONSIBLE_SESSION_RESERVED','CONNECTION_DEFINITION_ONLY','ENVIRONMENT_DEFINITION_ONLY','CAPABILITY_UNVERIFIED','BUDGET_POLICY_UNVERIFIED','SOURCE_AUTHORIZATION_UNVERIFIED','HOST_OS_FENCE_UNVERIFIED'],
      authorizationState:'NOT_AUTHORIZED',preparedBy:{kind:'HUMAN',userId:f.session.user.id},executionAuthorized:false,dispatchPerformed:false,options};
    assert(bytes(snapshot)<maxBytes);
    return{projectId,ref:{id:preparationId(i),version:1,contentHash:contentHash(canonicalJson(snapshot))},snapshot,currentness:'NOT_RECHECKED'};
  });
  const whole={...f.state,preparations};assert(bytes(whole)>maxBytes);
  const db={query:async(sql:string,args:unknown[])=>{
    if(sql.startsWith('SELECT p.id,p.archived_at'))return{rows:[{id:projectId,participation:'OWNER'}]};
    assert.equal(args[0],projectId);
    if(sql.includes('FROM anvil.project_roles'))return{rows:f.state.roles.map(role=>({role_id:role.ref.id,version:role.ref.version}))};
    if(sql.includes('FROM anvil.role_bindings'))return{rows:[{binding_id:f.binding.ref.id,version:f.binding.ref.version}]};
    if(sql.includes('FROM anvil.execution_preparations')){assert.deepEqual(args,[projectId,assignmentRef.id,assignmentRef.version]);return{rows:preparations.map(row=>row.ref)};}
    throw Error('UNEXPECTED_QUERY');
  }};
  const reads:string[]=[],dependencies={assignments:{read:async()=>f.confirmed},sessions:{
    readRole:async(_db:unknown,_actor:unknown,_project:string,id:string)=>f.state.roles.find(row=>row.ref.id===id),
    readBinding:async()=>f.binding},preparations:{read:async(_db:unknown,_actor:unknown,_project:string,id:string)=>{
      reads.push(id);return preparations.find(row=>row.ref.id===id);
    }}};
  const expected=preparations.reduce((n,_item,i)=>bytes({...whole,preparations:preparations.slice(0,i+1),hasMorePreparations:true})<=maxBytes?i+1:n,0);
  assert(expected>0&&expected<preparations.length);
  const paths:string[]=[],client=new ApiClient(async(url,init)=>{
    const path=String(url);paths.push(path);assert.equal(init?.method??'GET','GET');
    if(path===`/api/v1/projects/${projectId}`)return Response.json({id:projectId,participation:'OWNER',controlState:{actorId:f.session.user.id,clientId:f.session.clientId,generation:2,status:'HELD'}});
    assert.equal(path,`/api/v1/projects/${projectId}/assignments/${assignmentRef.id}/versions/${assignmentRef.version}/execution-preparation-state`);
    try{return Response.json(await module.readExecutionPreparationState(db,{actorId:f.session.user.id,clientId:f.session.clientId},projectId,assignmentRef.id,assignmentRef.version,dependencies));}
    catch(error){if(error instanceof AuthFailure)return Response.json({code:error.message},{status:error.statusCode});throw error;}
  });
  const opened=await prepareResponsibleSessionInput(client,f.confirmed as any,f.session,null,()=>{},()=>true);
  assert.equal(paths.length,2);assert.deepEqual(reads,preparations.map(row=>row.ref.id));
  assert.deepEqual(opened?.state,{...whole,preparations:preparations.slice(0,expected),hasMorePreparations:true});
  assert.equal(opened?.buffer.controlGeneration,2);assert.deepEqual(opened?.buffer.connectionRef,f.connection.ref);
  assert.equal(opened?.buffer.connectionKind,'REGISTERED_DEFINITION');assert.equal(opened?.buffer.pending,null);
});
test('확정 임무의 현재 단계 역할/최신 결박·준비20건을 무권한승격 없이 조회한다',async()=>{
  assert.equal(typeof module.readExecutionPreparationState,'function');const f=fixture();
  const result=await module.readExecutionPreparationState(f.db,actor,pid,pid,1,f.dependencies);
  assert.deepEqual(result.assignmentRef,ref);assert.equal(result.roles.length,1);assert.equal(result.bindings[0].ref.version,2);assert.equal(result.preparations.length,20);assert.equal(result.hasMorePreparations,true);
  assert.equal(result.executionAuthorized,false);assert.equal(result.dispatchPerformed,false);assert.equal(result.currentness,'NOT_RECHECKED');
  assert.deepEqual(f.reads.slice(0,2),['MEMBER','ASSIGNMENT']);assert.equal(f.reads.filter(x=>x==='PREPARATION').length,20);
});
test('비참여자는 목록/원문 resolver를 호출하지 않으며 잘못된 exact 입력은 거절한다',async()=>{
  assert.equal(typeof module.readExecutionPreparationState,'function');const f=fixture();f.deny();
  await assert.rejects(module.readExecutionPreparationState(f.db,actor,pid,pid,1,f.dependencies));assert.deepEqual(f.reads,['MEMBER']);
  await assert.rejects(module.readExecutionPreparationState(f.db,actor,pid,'bad',1,f.dependencies));await assert.rejects(module.readExecutionPreparationState(f.db,actor,pid,pid,0,f.dependencies));
});
test('역할/결박 원문의 무결성 오류를 빈 정상 목록으로 바꾸지 않는다',async()=>{
  assert.equal(typeof module.readExecutionPreparationState,'function');const f=fixture();f.dependencies.sessions.readBinding=async()=>{throw Error('RESPONSIBLE_SESSION_INTEGRITY_FAILED');};
  await assert.rejects(module.readExecutionPreparationState(f.db,actor,pid,pid,1,f.dependencies),/INTEGRITY_FAILED/);assert(!f.reads.includes('PREPARATION'));
});
test('새 화면 조회 경로도 로그인 없이 DB나 원문을 조회하지 않는다',async()=>{
  let queries=0;const pool:any={query:async()=>{queries++;throw Error('UNEXPECTED_DATABASE_ACCESS');},connect:async()=>{queries++;throw Error('UNEXPECTED_DATABASE_ACCESS');}};
  const repository=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)}),app=buildApp({},undefined,{repository,origin:'https://localhost:3830'});
  try{const r=await app.inject({method:'GET',url:'/api/v1/projects/'+pid+'/assignments/'+pid+'/versions/1/execution-preparation-state',headers:{host:'localhost:3830'}});assert.equal(r.statusCode,401);assert.equal(queries,0);}finally{await app.close();}
});
