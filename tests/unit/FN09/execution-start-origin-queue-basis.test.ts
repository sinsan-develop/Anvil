import assert from 'node:assert/strict';
import test from 'node:test';
import {executionStartOriginFixture,installExecutionStartOriginMemoryFS} from './execution-start-origin-fixture.ts';

await installExecutionStartOriginMemoryFS();

async function fixture(){
  const f=await executionStartOriginFixture();
  const {ProjectExecutionStartOrigins}=await import('../../../apps/server/modules/executions/project-execution-start-origins.ts');
  const ports={queue:f.queue,preparations:f.preparations,applications:f.methods,budgets:f.limits};
  const original=await new ProjectExecutionStartOrigins(f.access,ports).command(f.token,f.csrf,f.originCommand());
  const s=original.data.snapshot;
  const selection={originRef:original.data.ref,reservationRef:original.data.reservation.ref};
  const request={...f.originCommand(),operation:'queueExecutionCommand',payload:{
    preparationRef:s.preparationRef,executionId:s.execution.executionId,executionGeneration:1,
    permissionPolicyRef:s.observedPolicyRef,budgetPolicyRef:s.budgetPolicyRef,operation:'START_SESSION',
    payload:{contextBundleRef:s.contextBundleRef,optionsRef:s.preparationRef},
  }};
  const demand={attempts:1,calls:1,spoolBytes:32,cost:null,costStatus:'VERIFIED_NO_CHARGE'};
  return {f,ports,s,selection,request,demand};
}

const path='../../../apps/server/modules/executions/execution-start-origin-queue-basis.ts';
const module=await import(path).catch((e:NodeJS.ErrnoException)=>{
  if(e.code==='ERR_MODULE_NOT_FOUND'&&e.message.includes('execution-start-origin-queue-basis.ts'))return {};
  throw e;
});

test('실제 저장 원자료와 보호 reader에서 합성 START basis만 생산한다',async()=>{
  const {f,ports,s,selection,request,demand}=await fixture();
  const {readOriginStartQueueBasis}=module;
  assert.equal(typeof readOriginStartQueueBasis,'function','원자료 기반 basis 생산자가 필요합니다');
  const before=f.commands.size;
  const reservations=f.tables.reservations!.length;
  const basis=await f.run(actor=>readOriginStartQueueBasis(f.db,actor,request,selection,demand,ports,{expiresAt:Date.now()+5000}));
  assert.deepEqual(Object.keys(basis).sort(),['claim','intent']);
  assert.deepEqual(basis.intent,{
    projectId:f.pid,assignmentRef:f.confirmed.data.ref,roleBindingRef:f.binding.data.ref,
    contextBundleRef:s.contextBundleRef,connectionRef:s.connectionRef,environmentRef:s.environmentRef,
    capabilityRef:f.design.ref,budgetPolicyRef:s.budgetPolicyRef,sourceScopes:s.sourceScopes,
    mode:'CONTEXT_REVIEW',reason:'등록 준비',
  });
  assert.deepEqual(basis.claim,{
    projectId:f.pid,executionId:s.execution.executionId,executionGeneration:1,commandId:request.commandId,
    assignmentRef:f.confirmed.data.ref,stageRef:{applicationRef:f.applicationRef,nodeId:'choose'},
    policyRef:s.budgetPolicyRef,operation:'START_SESSION',demand,
  });
  assert.equal(f.commands.size,before);
  assert.equal(f.tables.reservations!.length,reservations);
  assert.equal(f.tables.origins!.length,1);
  assert.equal(f.active(),false);
  assert.deepEqual(f.state.unsupported,[]);
});

function callBasis(x:Awaited<ReturnType<typeof fixture>>,request=x.request,selection=x.selection,demand:unknown=x.demand){
  return x.f.run(actor=>module.readOriginStartQueueBasis(
    x.f.db,actor,request,selection,demand,x.ports,{expiresAt:Date.now()+5000},
  ));
}

test('원 Q의 재봉인과 다른 실행·제어·준비·논리 session 선택을 거절한다',async()=>{
  const x=await fixture();
  const {f,request,selection}=x;
  const count=f.commands.size;
  for(const changed of [
    {...request,controlGeneration:request.controlGeneration+1},
    {...request,payload:{...request.payload,executionId:crypto.randomUUID()}},
    {...request,payload:{...request.payload,executionGeneration:2}},
    {...request,payload:{...request.payload,payload:{...request.payload.payload,optionsRef:f.design.ref}}},
  ])await assert.rejects(callBasis(x,changed),/EXECUTION_BASIS_MISMATCH/);
  await assert.rejects(callBasis(x,request,{...selection,reservationRef:f.design.ref}),/EXECUTION_BASIS_MISMATCH/);

  const row=f.tables.origins![0];
  row.reservation_json.sessionBindingRef=f.binding.data.ref;
  const {H}=await import('./execution-start-origin-fixture.ts');
  row.reservation_hash=H(row.reservation_json);
  await assert.rejects(callBasis(x,request,{...selection,reservationRef:{...selection.reservationRef,contentHash:row.reservation_hash}}),/EXECUTION_START_ORIGIN_INVALID/);
  assert.equal(f.commands.size,count);
  assert.equal(f.active(),false);
  assert.deepEqual(f.state.unsupported,[]);
});

test('원 source 읽기권 회수와 Options 원문 오염은 basis를 반환하지 않는다',async()=>{
  const x=await fixture();
  const {f}=x;
  const count=f.commands.size;
  f.modes.sourceAllowed=false;
  assert.equal(f.modes.readAllowed,true);
  await assert.rejects(callBasis(x),/PROJECT_OPERATION_DENIED/);
  f.modes.sourceAllowed=true;
  const preparation=f.tables.preparations![0].snapshot_json;
  preparation.options.body+=' ';
  await assert.rejects(callBasis(x),/EXECUTION_PREPARATION_INTEGRITY_FAILED/);
  assert.equal(f.commands.size,count);
  assert.equal(f.active(),false);
  assert.deepEqual(f.state.unsupported,[]);
});

test('실제 queue 취소로 WAITING이 끝나면 보관 원자료에서 fresh basis를 만들지 않는다',async()=>{
  const x=await fixture();
  const {f}=x;
  const cancelled=await f.run(actor=>f.queue.cancel(f.db,actor,{
    ...f.originCommand(),operation:'cancelQueuedRequest',targetId:f.stage.data.ref.id,expectedVersion:1,
    payload:{requestRef:f.stage.data.ref,reason:'원 대기 요청 명시 취소'},
  },f.policyRef));
  assert.equal(cancelled.data.queueState,'CANCELLED');
  await assert.rejects(callBasis(x),/EXECUTION_START_ORIGIN_NOT_WAITING/);
  assert.equal(f.tables.origins!.length,1);
  assert.equal(f.active(),false);
  assert.deepEqual(f.state.unsupported,[]);
});

test('합성 수요도 기존 예산 검산의 미확인 비용·오염 오류를 보존한다',async()=>{
  const x=await fixture();
  const {f,demand,request,selection}=x;
  const count=f.commands.size;
  for(const [value,error] of [
    [{...demand,costStatus:'UNKNOWN'},/BUDGET_COST_UNVERIFIED/],
    [{...demand,costStatus:'OBSERVED'},/BUDGET_INPUT_INVALID/],
    [{...demand,calls:0},/BUDGET_INPUT_INVALID/],
    [{...demand,extra:true},/BUDGET_INPUT_INVALID/],
  ] as const)await assert.rejects(callBasis(x,request,selection,value),error);
  assert.equal(f.commands.size,count);
  assert.equal(f.active(),false);
  assert.deepEqual(f.state.unsupported,[]);
});

function holdOrigin(x:Awaited<ReturnType<typeof fixture>>){
  const db=x.f.db;
  const query=db.query;
  const entered=Promise.withResolvers<void>();
  const release=Promise.withResolvers<void>();
  db.query=async(sql:string,args?:any[])=>{
    if(sql.includes('FROM anvil.execution_start_origins o')){
      entered.resolve();
      await release.promise;
    }
    return query(sql,args);
  };
  return {entered,release,query};
}

test('읽기 대기 중 수요·원 선택·요청 객체의 수정은 고정 입력을 바꾸지 않는다',async()=>{
  const x=await fixture();
  const {f,demand,selection,request}=x;
  const {entered,release}=holdOrigin(x);
  const expectedId=request.commandId;
  const pending=callBasis(x);
  await entered.promise;
  demand.calls=500;
  demand.costStatus='UNKNOWN';
  selection.originRef=f.design.ref;
  request.commandId=crypto.randomUUID();
  release.resolve();
  const basis=await pending;
  assert.equal(basis.claim.commandId,expectedId);
  assert.equal(basis.claim.demand.calls,1);
  assert.equal(basis.claim.demand.costStatus,'VERIFIED_NO_CHARGE');
  assert.equal(f.active(),false);
  assert.deepEqual(f.state.unsupported,[]);
});

test('대기 중 actor/Session·query·Tx 교체는 원 source 응답을 폐기한다',async()=>{
  for(const mode of ['SESSION','H','QUERY','TX']){
    const x=await fixture();
    const {f,request,selection,demand,ports}=x;
    const {entered,release,query}=holdOrigin(x);
    const bound=Promise.withResolvers<Parameters<typeof f.run>[0] extends (a:infer A)=>unknown ? A : never>();
    const pending=f.run(actor=>{
      const changingActor=structuredClone(actor);
      bound.resolve(changingActor);
      return module.readOriginStartQueueBasis(f.db,changingActor,request,selection,demand,ports,{expiresAt:Date.now()+5000});
    });
    const rejected=assert.rejects(pending,/EXECUTION_START_ORIGIN_CURRENT_REQUIRED/);
    const actor=await bound.promise;
    await entered.promise;
    if(mode==='SESSION')Object.assign(actor.authSession!,{id:crypto.randomUUID()});
    if(mode==='H')Object.assign(actor,{credentialGeneration:actor.credentialGeneration+1});
    if(mode==='QUERY')f.db.query=query;
    if(mode==='TX')f.modes.tx++;
    release.resolve();
    await rejected;
    assert.equal(f.active(),false);
    assert.deepEqual(f.state.unsupported,[]);
  }
});

test('호출 abort·만료 뒤에는 읽기가 실제 정착할 때까지 Tx를 유지하고 basis를 반환하지 않는다',async()=>{
  for(const mode of ['ABORT','EXPIRY']){
    const x=await fixture();
    const {f,request,selection,demand,ports}=x;
    const {entered,release}=holdOrigin(x);
    const controller=new AbortController();
    const deadline=Promise.withResolvers<number>();
    const pending=f.run(actor=>{
      const expiresAt=Date.now()+(mode==='EXPIRY'?800:5000);
      deadline.resolve(expiresAt);
      return module.readOriginStartQueueBasis(f.db,actor,request,selection,demand,ports,{expiresAt,signal:controller.signal});
    });
    const rejected=assert.rejects(pending,/EXECUTION_START_ORIGIN_CURRENT_REQUIRED/);
    let settled=false;
    void pending.then(()=>{settled=true;},()=>{settled=true;});
    try{
      const expiresAt=await deadline.promise;
      await entered.promise;
      if(mode==='ABORT')controller.abort();
      else await new Promise(resolve=>setTimeout(resolve,Math.max(0,expiresAt-Date.now()+5)));
      assert.equal(f.active(),true);
      await new Promise(resolve=>setImmediate(resolve));
      assert.equal(settled,false);
    }finally{
      release.resolve();
    }
    await rejected;
    assert.equal(f.active(),false);
    assert.deepEqual(f.state.unsupported,[]);
  }
});

test('원 source의 마지막 DB 관측보다 뒤로 간 외부 시각은 반환을 막는다',async()=>{
  const x=await fixture();
  const {f}=x;
  const query=f.db.query;
  let samples=0;
  f.db.query=async(sql:string,args?:any[])=>{
    const result=await query(sql,args);
    if(sql==='SELECT txid_current()::text AS transaction_id,clock_timestamp() AS observed_at'&&++samples===6){
      const row=result.rows[0];
      return {...result,rows:[{...row,observed_at:new Date(row.observed_at.getTime()+1000)}]};
    }
    return result;
  };
  await assert.rejects(callBasis(x),/EXECUTION_START_ORIGIN_CURRENT_REQUIRED/);
  assert.equal(f.active(),false);
});

test('자체 false 값으로 가린 사전 취소도 원자료를 조회하기 전에 거절한다',async()=>{
  const x=await fixture();
  const {f,request,selection,demand,ports}=x;
  const controller=new AbortController();
  Object.defineProperty(controller.signal,'aborted',{value:false});
  controller.abort();
  f.trace.length=0;
  await assert.rejects(f.run(actor=>module.readOriginStartQueueBasis(
    f.db,actor,request,selection,demand,ports,{expiresAt:Date.now()+5000,signal:controller.signal},
  )),/EXECUTION_START_ORIGIN_CURRENT_REQUIRED/);
  assert.equal(f.trace.some(sql=>sql.includes('FROM anvil.execution_start_origins o')),false);
  assert.equal(f.active(),false);
});

test('자체 getter로 취소를 가려도 getter를 실행하지 않고 대기 읽기 정착 뒤 거절한다',async()=>{
  const x=await fixture();
  const {f,request,selection,demand,ports}=x;
  const {entered,release}=holdOrigin(x);
  const controller=new AbortController();
  let accesses=0;
  Object.defineProperty(controller.signal,'aborted',{get(){accesses++;return false;}});
  const pending=f.run(actor=>module.readOriginStartQueueBasis(
    f.db,actor,request,selection,demand,ports,{expiresAt:Date.now()+5000,signal:controller.signal},
  ));
  let settled=false;
  void pending.then(()=>{settled=true;},()=>{settled=true;});
  try{
    await Promise.race([entered.promise,pending.then(()=>assert.fail('대기 읽기 진입 전에 반환됨'))]);
    controller.abort();
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(f.active(),true);
    assert.equal(settled,false);
  }finally{
    release.resolve();
  }
  await assert.rejects(pending,/EXECUTION_START_ORIGIN_CURRENT_REQUIRED/);
  assert.equal(accesses,0);
  assert.equal(f.active(),false);
});

test('AbortSignal 프로토타입 모방과 Proxy는 속성이나 trap을 실행하지 않고 거절한다',async()=>{
  const x=await fixture();
  const {f,request,selection,demand,ports}=x;
  let accesses=0;
  const counterfeit=Object.create(AbortSignal.prototype);
  Object.defineProperty(counterfeit,'aborted',{get(){accesses++;return false;}});
  const proxy=new Proxy(new AbortController().signal,{
    get(target,key,receiver){accesses++;return Reflect.get(target,key,receiver);},
    getPrototypeOf(target){accesses++;return Reflect.getPrototypeOf(target);},
  });
  for(const signal of [counterfeit,proxy]){
    f.trace.length=0;
    await assert.rejects(f.run(actor=>module.readOriginStartQueueBasis(
      f.db,actor,request,selection,demand,ports,{expiresAt:Date.now()+5000,signal},
    )),/EXECUTION_QUEUE_INPUT_INVALID/);
    assert.equal(f.trace.some(sql=>sql.includes('FROM anvil.execution_start_origins o')),false);
    assert.equal(accesses,0);
    assert.equal(f.active(),false);
  }
});
