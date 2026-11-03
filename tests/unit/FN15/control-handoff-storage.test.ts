import test from 'node:test';import assert from 'node:assert/strict';
const load=()=>import('../../../apps/server/modules/control-handoff/control-handoff-storage.ts');
const id='11111111-1111-4111-8111-111111111111';
test('F 예약은 각 실제 행과 자기 reservation을 한번만 소유하고 가변상태 비용을 고정한다',async()=>{
 const m=await load(),ref={id,version:1,contentHash:'a'.repeat(64)};
 const row={table:'control_handoff_protected_summaries' as const,id,projection:{id,phase:'RESERVED',generation:1,optional:null}};
 const p=m.planControlStorage(ref,[row],{projectId:id,createdAt:'2026-11-03T00:00:00.000Z'});assert.ok(p.reservedBytes>p.rows[0]!.bytes);assert.ok(p.reservationBytes>0);
 assert.equal(m.controlCostBytes({...row.projection,phase:'SETTLED',generation:999}),m.controlCostBytes(row.projection));
 assert.notEqual(m.controlCostBytes({...row.projection,optional:'원값'}),m.controlCostBytes(row.projection));
 assert.throws(()=>m.planControlStorage(ref,[row,row],{projectId:id,createdAt:'2026-11-03T00:00:00.000Z'}));
 assert.equal(m.settleControlStorage(p,[row]),p.reservedBytes);
 assert.throws(()=>m.settleControlStorage(p,[{...row,projection:{...row.projection,optional:'추가 원문'}}]));
});

test('실제 reservation projection은 NULL/시각/phase/수치 변화에도 원값 정보를 남겨 비용폭을 고정한다',async()=>{
 const m=await load(),ref={id,version:1,contentHash:'a'.repeat(64)},at='2026-11-03T00:00:00.000Z';
 assert.equal(m.controlCostBytes({settled_bytes:null,updated_at:null,phase:null}),m.controlCostBytes({settled_bytes:1,updated_at:at,phase:'SETTLED'}));
 const p=m.planControlStorage(ref,[{table:'control_handoff_protected_summaries',id,projection:{id,recorded_at:at}}],{projectId:id,createdAt:at});
 const before=m.controlReservationProjection(p,'RESERVED'),after=m.controlReservationProjection(p,'SETTLED');
 assert.equal(m.controlCostBytes(before),p.reservationBytes);assert.equal(m.controlCostBytes(after),p.reservationBytes);

 assert.notEqual(JSON.stringify(before),JSON.stringify(after));
});
