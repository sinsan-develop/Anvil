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


test('writer와 별개인 201번째 공개범주 원행은 초과를 명시하고 잘린200개를 READY로 만들지 않는다',async()=>{
 const m=await load(),g=await import('../../../apps/server/modules/control-handoff/control-grant.ts'),ref={id,version:1,contentHash:'a'.repeat(64)},baseControl={actorId:id,clientId:id,generation:1,version:1};
 const pendingCommands=Array.from({length:201},(_,i)=>{const snapshot={schemaVersion:1,purpose:'FN15_SERVER_LEDGER_FACT',projectId:id,sourceTable:'commands',index:i};return{ref:{id:'22222222-2222-4222-8222-'+String(i).padStart(12,'0'),version:1,contentHash:g.controlHash(snapshot)},snapshot,recordedAt:'2026-11-03T00:00:00.000Z',expiresAt:'2026-11-03T00:00:30.000Z',provenance:'SERVER_LEDGER'};});
 const db={query:async()=>({rows:[{packet:{projectId:id,requestRef:ref,baseControl,writer:{head:null,events:[],commands:[],receipts:[],audits:[],approvals:[]},executions:[],pendingCommands,pendingApprovals:[],checkpoints:[],proofBasis:null}}]})},lease=new m.HandoffBudget(30000,{now:()=>Date.parse('2026-11-03T00:00:00.000Z'),monotonic:()=>0});
 const result=await m.createControlHandoffEvidenceSource().collect(db as never,{projectId:id,requestRef:ref,baseControl,sessionId:id,actorId:id,clientId:id},lease);assert.equal(result.transferState,'UNKNOWN');assert.equal(result.collections.pendingCommands.state,'UNKNOWN');assert.equal(result.collections.pendingCommands.items.length,200);assert.ok(result.collections.pendingCommands.gaps.includes('SUMMARY_REFERENCE_LIMIT'));await lease.close();
});


/** 고정 SQL 결과의 명시 메모리 모델이다. 이 시험은 실제 SQL/OS 폐쇄를 실행하지 않는다. */
test('생성계보·정확 issuer집합·공유fence의 폐쇄관측은 같은 DB source에서만 EMPTY READY를 생산한다',async()=>{
 const m=await load(),g=await import('../../../apps/server/modules/control-handoff/control-grant.ts'),requestRef={id,version:1,contentHash:'a'.repeat(64)},baseControl={actorId:id,clientId:id,generation:1,version:1},scope={projectId:id,requestRef,baseControl,sessionId:id,actorId:id,clientId:id},at='2026-11-03T00:00:00.000Z';
 const birth={intentId:id,draftId:id,draftVersion:1,commandRef:{id,version:1,contentHash:'b'.repeat(64)},requestHash:'b'.repeat(64),receiptId:id,scopeDigest:'c'.repeat(64),auditEventId:id,auditScopeDigest:'c'.repeat(64),initialControl:baseControl,anchorHash:'d'.repeat(64)};
 const names=["executions","execution_grants","usage_reservations","writer_claims","execution_commands","delivery_outbox","execution_credentials","execution_challenges","execution_receipts","execution_observations","execution_acknowledgements","execution_observation_results","execution_start_permits","execution_instruction_permits","execution_grant_revocations","project_writer_authority_events","project_writer_authority_heads","execution_ownership_events","execution_ownership_observations","execution_ownership_anchors","execution_ownership_bindings","execution_ownership_heads","native_preparation_authorities","native_preparation_authority_events","execution_preparations","execution_preparation_approval_candidates","understanding_reviews","stage_runs","queue_requests","project_storage_reservations","context_bundles","context_items","assignment_versions","source_roots","source_root_versions","project_source_declarations","project_roles","agent_sessions","role_bindings","execution_material_manifests","execution_materials","execution_material_proof_bindings"];
 const snapshot={schemaVersion:1,purpose:'FN15_CLOSED_MANAGED_ABSENCE',projectId:id,requestRef,baseControl,subject:{actorId:id,clientId:id,sessionId:id},birth,sources:names.map(table=>({table,rows:[]})),guardHash:"c210cba4f937b35290c98e4dfbbc5d46c383f1ed2c704e65400cc15e38c577c4",observedAt:at,expiresAt:'2026-11-03T00:00:30.000Z'};
 const packet={projectId:id,requestRef,baseControl,writer:{head:null,events:[],commands:[],receipts:[],audits:[],approvals:[]},executions:[],pendingCommands:[],pendingApprovals:[],checkpoints:[],proofBasis:null,emptyClosure:{snapshot,contentHash:g.controlHash(snapshot)}};
 const collect=async(value:unknown,duration=30000)=>{const lease=new m.HandoffBudget(duration,{now:()=>Date.parse(at),monotonic:()=>0});let queries=0;const db={query:async(sql:string)=>{queries++;assert.match(sql,/fn15_handoff_facts/);return{rows:[{packet:value}]};}};try{const result=await m.createControlHandoffEvidenceSource().collect(db as never,scope,lease);assert.equal(queries,1);return result;}finally{await lease.close();}};
 const ready=await collect(packet);assert.equal(ready.transferState,'READY');const short=await collect(packet,5000);assert.equal(short.validUntil,'2026-11-03T00:00:05.000Z');assert.equal(ready.collections.activeExecutions.items.length,0);assert.equal(ready.collections.activeExecutions.state,'VERIFIED_CURRENT');
 for(const mutate of [(s:any)=>s.sources.pop(),(s:any)=>s.sources[0].rows.push({projectId:id}),(s:any)=>s.guardHash='f'.repeat(64),(s:any)=>s.subject.clientId='22222222-2222-4222-8222-222222222222',(s:any)=>s.birth.requestHash='f'.repeat(64)]){
  const copy=structuredClone(packet);mutate(copy.emptyClosure.snapshot);copy.emptyClosure.contentHash=g.controlHash(copy.emptyClosure.snapshot);let allowed=false;try{allowed=(await collect(copy)).transferState==='READY';}catch{}assert.equal(allowed,false);
 }
});
