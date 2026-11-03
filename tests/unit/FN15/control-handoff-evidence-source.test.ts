import test from 'node:test';import assert from 'node:assert/strict';
const load=()=>import('../../../apps/server/modules/control-handoff/control-handoff-evidence-source.ts');
const id='11111111-1111-4111-8111-111111111111';
test('고정 reader는 실제 SQL을 읽고 current 공급자 부재를 UNKNOWN으로 유지한다',async()=>{
 const m=await load();let calls=0;const ref={id,version:1,contentHash:'a'.repeat(64)},baseControl={actorId:id,clientId:id,generation:1,version:1};
 const packet={projectId:id,requestRef:ref,baseControl,writer:{head:null,events:[],commands:[],receipts:[],audits:[],approvals:[]},executions:[],pendingCommands:[],pendingApprovals:[],checkpoints:[],proofBasis:null};
 const db={query:async(sql:string)=>{calls++;assert.match(sql,/fn15_handoff_facts/);return{rows:[{packet}]};}};
 const lease=new m.HandoffBudget(30000,{now:()=>0,monotonic:()=>0});
 const result=await m.createControlHandoffEvidenceSource().collect(db as never,{projectId:id,requestRef:ref,baseControl,sessionId:id,actorId:id,clientId:id},lease);
 assert.equal(result.transferState,'UNKNOWN');assert.ok(result.gaps.includes('CURRENT_PROVIDER_NOT_CONNECTED'));assert.equal(calls,1);await lease.close();
});
test('query 대기기한 종료는 query 정착이 아니며 끝난 facade 재진입을 거절한다',async()=>{
 const m=await load();let mono=0,resolve!:()=>void;const original=new Promise<void>(r=>resolve=r),lease=new m.HandoffBudget(30,{now:()=>0,monotonic:()=>mono});let finished=false;
 let rawSettled=false;original.then(()=>{rawSettled=true;});const pending=lease.own(()=>original).finally(()=>{finished=true;});await Promise.resolve();mono=40;assert.throws(()=>lease.check());const close=lease.close();await Promise.resolve();assert.equal(rawSettled,false);resolve();await Promise.allSettled([pending,close]);assert.equal(finished,true);assert.throws(()=>lease.check());
});

test('비어 있는 writer event에 소속없는 command proof를 숨기면 UNKNOWN 성공 대신 거절한다',async()=>{
 const m=await load(),ref={id,version:1,contentHash:'a'.repeat(64)},baseControl={actorId:id,clientId:id,generation:1,version:1};
 const packet={projectId:id,requestRef:ref,baseControl,writer:{head:null,events:[],commands:[{id}],receipts:[],audits:[],approvals:[]},executions:[],pendingCommands:[],pendingApprovals:[],checkpoints:[],proofBasis:null};
 const db={query:async()=>({rows:[{packet}]})};
 await assert.rejects(()=>m.createControlHandoffEvidenceSource().collect(db as never,{projectId:id,requestRef:ref,baseControl,sessionId:id,actorId:id,clientId:id},new m.HandoffBudget()));
});
