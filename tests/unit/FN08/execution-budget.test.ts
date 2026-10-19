import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
const budget:any=await import('../../../apps/server/modules/executions/execution-budget.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const pid='11111111-1111-4111-8111-111111111111',eid='22222222-2222-4222-8222-222222222222',cid='33333333-3333-4333-8333-333333333333';
const ref={id:pid,version:1,contentHash:'a'.repeat(64)},now='2026-10-19T04:00:00.000Z';
const policy=()=>({projectId:pid,ref,snapshot:{scope:{kind:'PROJECT',projectId:pid},state:'APPLIED',limits:{maxAttempts:3,maxElapsedMs:7200000,maxCalls:50,maxConcurrentAssignments:1,maxSpoolBytes:1073741824,maxOfflineMs:300000},decidedAt:now,expiresAt:'2026-10-19T06:00:00.000Z'}});
const claim=(patch:any={})=>({projectId:pid,executionId:eid,executionGeneration:1,commandId:cid,assignmentRef:ref,stageRef:{applicationRef:ref,nodeId:'개발'},policyRef:ref,operation:'START_SESSION',demand:{attempts:1,calls:1,spoolBytes:100,cost:null,costStatus:'VERIFIED_NO_CHARGE'},...patch});
function reserve(events:any[]=[],p:any=policy(),c:any=claim(),at=now){assert.equal(typeof budget.reserveExecutionBudget,'function');return budget.reserveExecutionBudget(events,p,c,at);}
function advance(events:any[],r:any,state:string,usage:any=null){assert.equal(typeof budget.advanceExecutionBudget,'function');return budget.advanceExecutionBudget(events,r,state,{evidenceRef:ref,usage},now);}
const units=(patch:any={})=>({attempts:1,calls:1,spoolBytes:50,cost:null,costStatus:'VERIFIED_NO_CHARGE',...patch});

test('예약은 불변 ledger 행을 만들고 같은 명령은 같은 원행을 재확인한다',()=>{
 const first=reserve();assert.equal(first.snapshot.state,'RESERVED');assert.equal(first.ref.version,1);assert.equal(first.snapshot.executionAuthorized,false);assert.equal(first.snapshot.dispatchPerformed,false);
 assert.deepEqual(reserve([first]),first);assert.equal(contentHash(canonicalJson(first.snapshot)),first.ref.contentHash);
 assert.throws(()=>reserve([first],policy(),claim({demand:{...claim().demand,calls:2}})),/BUDGET_IDEMPOTENCY_CONFLICT/);
 const snapshot=canonicalJson(first);const sent=advance([first],first.ref,'DISPATCHED');assert.equal(sent.ref.id,first.ref.id);assert.equal(sent.ref.version,2);assert.deepEqual(sent.snapshot.previousRef,first.ref);assert.equal(canonicalJson(first),snapshot);
});
test('현재 정책/정확 ref·만료·시각·교차 프로젝트가 다르면 새 예약/전송을 막는다',()=>{
 for(const p of [{...policy(),ref:{...ref,version:2}},{...policy(),snapshot:{...policy().snapshot,state:'REVOKED'}},{...policy(),projectId:eid}])assert.throws(()=>reserve([],p));
 assert.throws(()=>reserve([],policy(),claim(),'2026-10-19T06:00:00.000Z'),/BUDGET_POLICY_EXPIRED/);
 assert.throws(()=>reserve([],policy(),claim(),'2026-10-19T03:59:59.999Z'),/BUDGET_POLICY_NOT_YET_VALID/);
 const first=reserve();assert.equal(typeof budget.recheckExecutionBudgetDelivery,'function');
 assert.equal(budget.recheckExecutionBudgetDelivery([first],policy(),first.ref,now).ref.id,first.ref.id);
 assert.throws(()=>budget.recheckExecutionBudgetDelivery([first],{...policy(),ref:{...ref,version:2}},first.ref,now),/BUDGET_POLICY_NOT_CURRENT/);
 const unknown=advance([first],first.ref,'UNKNOWN');assert.throws(()=>budget.recheckExecutionBudgetDelivery([first,unknown],policy(),unknown.ref,now),/BUDGET_DELIVERY_STATE_INVALID/);
});
test('새 세션/세대·정책 개정으로 소비된 호출·단계 시도 누적을 초기화하지 않는다',()=>{
 let events:any[]=[];
 for(let n=0;n<3;n++){
  const first=reserve(events,policy(),claim({commandId:crypto.randomUUID(),executionGeneration:n+1}));events.push(first);
  const sent=advance(events,first.ref,'DISPATCHED');events.push(sent);events.push(advance(events,sent.ref,'SETTLED',units()));
 }
 assert.throws(()=>reserve(events,{...policy(),ref:{...ref,version:2}},claim({commandId:crypto.randomUUID(),executionGeneration:4,policyRef:{...ref,version:2}})),/BUDGET_ATTEMPTS_EXHAUSTED/);
 const result=budget.inspectExecutionBudget(events,policy(),now);assert.equal(result.used.calls,3);assert.equal(result.used.attempts,3);assert.equal(result.liveExecutions,0);
});
test('pending/UNKNOWN은 예약을 보존하고 동시 실행과 미관측 사용량을 0으로 만들지 않는다',()=>{
 const first=reserve();assert.throws(()=>reserve([first],policy(),claim({commandId:crypto.randomUUID(),executionId:pid})),/BUDGET_CONCURRENCY_EXHAUSTED/);
 const unknown=advance([first],first.ref,'UNKNOWN'),events=[first,unknown],view=budget.inspectExecutionBudget(events,policy(),now);
 assert.equal(view.reserved.calls,1);assert.equal(view.unknownReservations,1);assert.equal(view.liveExecutions,1);
 assert.throws(()=>reserve(events,policy(),claim({commandId:crypto.randomUUID()})),/BUDGET_USAGE_UNKNOWN/);
 assert.throws(()=>advance(events,unknown.ref,'CANCELLED'),/BUDGET_TRANSITION_INVALID/);
 const settled=advance(events,unknown.ref,'SETTLED',units());assert.equal(budget.inspectExecutionBudget([...events,settled],policy(),now).used.calls,1);
});
test('취소는 전송 전 RESERVED만 해제하고 실제 초과 소비도 기록해 다음 호출을 차단한다',()=>{
 const first=reserve(),cancelled=advance([first],first.ref,'CANCELLED');assert.equal(budget.inspectExecutionBudget([first,cancelled],policy(),now).reserved.calls,0);
 const next=reserve([first,cancelled],policy(),claim({commandId:crypto.randomUUID()})),events=[first,cancelled,next],sent=advance(events,next.ref,'DISPATCHED');events.push(sent);
 assert.throws(()=>advance(events,sent.ref,'CANCELLED'),/BUDGET_TRANSITION_INVALID/);
 const settled=advance(events,sent.ref,'SETTLED',units({calls:51}));events.push(settled);
 assert.equal(budget.inspectExecutionBudget(events,policy(),now).used.calls,51);assert.throws(()=>reserve(events,policy(),claim({commandId:crypto.randomUUID(),operation:'SEND_INSTRUCTION',demand:{...claim().demand,attempts:0}})),/BUDGET_CALLS_EXHAUSTED/);
});
test('비용은 십진 BigInt로 합산하고 통화/비용 미설정·추정뿐인 완료를 실제0으로 바꾸지 않는다',()=>{
 const paid={...policy(),snapshot:{...policy().snapshot,limits:{...policy().snapshot.limits,maxCost:0.3,currency:'USD'}}};
 const paidClaim=(amount:number)=>claim({commandId:crypto.randomUUID(),operation:'SEND_INSTRUCTION',demand:{attempts:0,calls:1,spoolBytes:0,cost:{amount,currency:'USD'},costStatus:'FINITE_CAP'}});
 assert.throws(()=>reserve([],policy(),paidClaim(0.1)),/BUDGET_COST_LIMIT_REQUIRED/);
 let events:any[]=[];
 for(const amount of [0.1,0.2]){const first=reserve(events,paid,paidClaim(amount));events.push(first);const sent=advance(events,first.ref,'DISPATCHED');events.push(sent);events.push(advance(events,sent.ref,'SETTLED',units({attempts:0,spoolBytes:0,cost:{amount,currency:'USD'},costStatus:'OBSERVED'})));}
 assert.equal(budget.inspectExecutionBudget(events,paid,now).used.cost.amount,'0.3');assert.throws(()=>reserve(events,paid,paidClaim(1e-7)),/BUDGET_COST_EXHAUSTED/);
 const first=reserve([],paid,paidClaim(1e-7)),sent=advance([first],first.ref,'DISPATCHED');
 assert.throws(()=>advance([first,sent],sent.ref,'SETTLED',units({attempts:0,spoolBytes:0,cost:null})),/BUDGET_COST_OBSERVATION_REQUIRED/);
 assert.throws(()=>reserve(events,{...paid,snapshot:{...paid.snapshot,limits:{...paid.snapshot.limits,currency:'KRW'}}},paidClaim(0.01)),/BUDGET_CURRENCY_MISMATCH/);
});
test('비용 null만으로 무료라 추측하지 않고 추정 상한만으로 정산하지 않는다',()=>{
 assert.equal(typeof budget.reserveExecutionBudget,'function');
 const noStatus=claim();delete (noStatus.demand as any).costStatus;assert.throws(()=>reserve([],policy(),noStatus),/BUDGET_COST_UNVERIFIED/);
 assert.throws(()=>reserve([],policy(),claim({demand:{...claim().demand,costStatus:'UNKNOWN'}})),/BUDGET_COST_UNVERIFIED/);
 const paid={...policy(),snapshot:{...policy().snapshot,limits:{...policy().snapshot.limits,maxCost:1,currency:'USD'}}};
 const first=reserve([],paid,claim({demand:{...claim().demand,cost:{amount:0.1,currency:'USD'},costStatus:'FINITE_CAP'}})),sent=advance([first],first.ref,'DISPATCHED');
 assert.throws(()=>advance([first,sent],sent.ref,'SETTLED',units({cost:{amount:0.1,currency:'USD'},costStatus:'FINITE_CAP'})),/BUDGET_COST_OBSERVATION_REQUIRED/);
});
test('정책이 만료·회수돼도 사용 이력 조회를 숨기지 않고 새 예약만 거절한다',()=>{
 const first=reserve();assert.equal(typeof budget.inspectExecutionBudget,'function');
 const view=budget.inspectExecutionBudget([first],policy(),'2026-10-19T06:00:00.000Z');assert.equal(view.reserved.calls,1);assert.deepEqual(view.policyIssues,['BUDGET_POLICY_EXPIRED']);
 const revoked=budget.inspectExecutionBudget([first],{...policy(),snapshot:{...policy().snapshot,state:'REVOKED'}},now);assert.equal(revoked.reserved.calls,1);assert.deepEqual(revoked.policyIssues,['BUDGET_POLICY_REVOKED']);
 const late={...policy(),snapshot:{...policy().snapshot,state:'REVOKED',decidedAt:'2026-10-19T07:00:00.000Z'}};
 const afterExpiry=budget.inspectExecutionBudget([first],late,'2026-10-19T07:00:00.000Z');assert.equal(afterExpiry.reserved.calls,1);assert.deepEqual(afterExpiry.policyIssues,['BUDGET_POLICY_REVOKED','BUDGET_POLICY_EXPIRED']);
 assert.throws(()=>reserve([first],late,claim({commandId:crypto.randomUUID()}),'2026-10-19T07:00:00.000Z'),/BUDGET_POLICY_REVOKED/);
});
test('hash·선행 버전·같은 명령 중복 계보·다른 프로젝트 사건을 발견하면 fail-closed다',()=>{
 const first=reserve(),sent=advance([first],first.ref,'DISPATCHED');
 assert.throws(()=>reserve([{...first,ref:{...first.ref,contentHash:'0'.repeat(64)}}]),/BUDGET_LEDGER_INTEGRITY_FAILED/);
 assert.throws(()=>reserve([sent]),/BUDGET_LEDGER_INTEGRITY_FAILED/);
 assert.throws(()=>reserve([first,{...first,ref:{...first.ref,id:eid}}]),/BUDGET_LEDGER_INTEGRITY_FAILED/);
 assert.throws(()=>reserve([first],policy(),claim({projectId:eid})),/BUDGET_SCOPE_MISMATCH/);
 assert.throws(()=>advance([first,sent],first.ref,'UNKNOWN'),/BUDGET_VERSION_CONFLICT/);
});
test('미지원 단위·소수 횟수·시도 불일치·stop 예약·초과 입력을 실행 허가로 바꾸지 않는다',()=>{
 assert.equal(typeof budget.reserveExecutionBudget,'function');
 for(const patch of [{operation:'REQUEST_STOP'},{demand:{...claim().demand,calls:0}},{demand:{...claim().demand,calls:1.1}},
  {demand:{...claim().demand,attempts:0}},{executionGeneration:0},{policyRef:null},{executionAuthorized:true},
  {demand:{...claim().demand,cost:{amount:-1,currency:'USD'}}}])assert.throws(()=>reserve([],policy(),claim(patch)));
});
test('DB 예약계획은 project 잠금·현재 정책·누락 없는 전체이력을 읽고 저장/전송하지 않는다',async()=>{
 assert.equal(typeof budget.ProjectExecutionBudget,'function');const trace:string[]=[];const first=reserve(),rows:any[]=[];
 const db:any={query:async(sql:string,p:any[])=>{
  if(sql.startsWith('SELECT p.id,p.archived_at')){assert.equal(p[0],pid);assert(sql.includes('FOR UPDATE'));trace.push('LOCK');return{rows:[{id:pid,archived_at:null,participation:'OWNER'}]};}
  if(sql.includes('FROM anvil.usage_reservations')){assert(sql.includes('ORDER BY server_sequence'));assert(sql.includes('LIMIT 10001'));trace.push('LEDGER');return{rows};}
  if(sql.startsWith('SELECT clock_timestamp()')){trace.push('CLOCK');return{rows:[{at:new Date(now)}]};}
  throw Error('UNEXPECTED_WRITE_OR_QUERY');
 }};
 const policies:any={resolveCurrent:async(_db:any,_actor:any,p:string,r:any,scope:any)=>{trace.push('CURRENT_POLICY');assert.equal(p,pid);assert.deepEqual(r,ref);assert.deepEqual(scope,{kind:'PROJECT',projectId:pid});return policy();}};
 const planner=new budget.ProjectExecutionBudget(policies),actor:any={actorId:pid,clientId:cid};
 const planned=await planner.planReservation(db,actor,claim());assert.equal(planned.record.snapshot.state,'RESERVED');assert.equal(planned.persisted,false);assert.equal(planned.executionAuthorized,false);
 assert.deepEqual(trace,['LOCK','CURRENT_POLICY','LEDGER','CLOCK']);
 rows.push({project_id:pid,reservation_id:first.ref.id,version:1,content_hash:first.ref.contentHash,snapshot_json:first.snapshot,server_sequence:1,command_id:cid});
 assert.deepEqual((await planner.planReservation(db,actor,claim())).record,first);
 const checked=await planner.checkDelivery(db,actor,pid,first.ref);assert.deepEqual(checked.record.ref,first.ref);assert.equal(checked.dispatchPerformed,false);
});
test('DB 미참여·변조/잘린이력·현재 정책 거절은 계획을 반환하지 않는다',async()=>{
 assert.equal(typeof budget.ProjectExecutionBudget,'function');let denied=true,ledgerReads=0;const first=reserve();
 const db:any={query:async(sql:string)=>{
  if(sql.startsWith('SELECT p.id,p.archived_at'))return{rows:denied?[]:[{id:pid,archived_at:null}]};
  if(sql.includes('FROM anvil.usage_reservations')){ledgerReads++;return{rows:[{project_id:pid,reservation_id:first.ref.id,version:1,content_hash:'0'.repeat(64),snapshot_json:first.snapshot,server_sequence:1,command_id:cid}]};}
  throw Error('UNEXPECTED_QUERY');
 }};
 const policies:any={resolveCurrent:async()=>policy()},planner=new budget.ProjectExecutionBudget(policies),actor:any={actorId:pid,clientId:cid};
 await assert.rejects(planner.planReservation(db,actor,claim()),/NOT_FOUND/);assert.equal(ledgerReads,0);
 denied=false;await assert.rejects(planner.planReservation(db,actor,claim()),/BUDGET_LEDGER_INTEGRITY_FAILED/);
 policies.resolveCurrent=async()=>{throw Error('LIMIT_POLICY_REVOKED');};
 await assert.rejects(planner.planReservation(db,actor,claim()),/LIMIT_POLICY_REVOKED/);assert.equal(ledgerReads,1);
});
