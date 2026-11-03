import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const load=()=>import('../../../apps/server/modules/control-handoff/control-grant.ts');
const id=(n:number)=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
const input=()=>({projectId:id(1),command:{schemaVersion:1 as const,operation:'acceptControl' as const,commandId:id(2),projectId:id(1),clientId:id(4),payload:{requestRef:ref(3),summaryVersion:1,reason:'수락 원문'}},requestRef:ref(3),summaryRef:ref(5),before:{actorId:id(6),clientId:id(7),generation:8,version:9},targetActorId:id(8),recordedAt:'2026-11-03T00:00:00.000Z',ids:{acceptance:id(10),revocation:id(11),grant:id(12),receipt:id(13),audit:id(14)}});
test('수락 DAG는 비순환 exact refs와 현재 tuple로만 현재 grant를 검산한다',async()=>{
 const m=await load(),v=input(),c=m.createControlAcceptanceChain(v);
 assert.equal(c.result.nextControl.generation,9);assert.equal(c.result.nextControl.actorId,id(8));
 assert.equal(c.acceptance.ref.contentHash,contentHash(canonicalJson(c.acceptance.snapshot)));
 assert.equal('grantRef' in c.acceptance.snapshot,false);
 const proof=m.verifyControlAcceptanceChain(c);assert.deepEqual(proof.result,c.result);assert.ok(Object.isFrozen(proof));
 const copy=structuredClone(c);copy.grant.snapshot.basis.clientId=id(99);assert.throws(()=>m.verifyControlAcceptanceChain(copy));
});
test('과거 summary/원 세션 기한을 새 grant TTL로 만들지 않으며 구generation은 거절한다',async()=>{
 const m=await load(),c=m.createControlAcceptanceChain(input());let queries=0;
 const db={query:async()=>{queries++;return{rows:[{bundle_json:c,next_generation:9,project_id:id(1),content_hash:c.acceptance.ref.contentHash,grant_rows:[c.grant,c.revocation],command_rows:[{command:c.command,result:c.result,commandHash:contentHash(canonicalJson(c.command)),resultHash:contentHash(canonicalJson(c.result))}],receipt_rows:[c.receipt],audit_rows:[c.audit],revoked_count:'0'}]};}};
 const p=await m.readCurrentControlGrant(db as never,id(1),{...c.result.nextControl,revoked_at:null});assert.equal(p.result.grantRef.id,id(12));assert.equal(queries,1);
 await assert.rejects(()=>m.readCurrentControlGrant(db as never,id(1),{...c.result.nextControl,generation:10,revoked_at:null}));
});
test('Proxy/getter 원형은 실행하지 않고 거절한다',async()=>{
 const m=await load();let calls=0;const proxy=new Proxy(input(),{get(){calls++;throw Error('실행 금지');}});assert.throws(()=>m.createControlAcceptanceChain(proxy));assert.equal(calls,0);
 const getter={...input()};Object.defineProperty(getter,'projectId',{enumerable:true,get(){calls++;return id(1);}});assert.throws(()=>m.createControlAcceptanceChain(getter));assert.equal(calls,0);
});

test('그럴듯한 bundle만 있고 물리 grant/command/receipt/audit가 없으면 현재 권위를 열지 않는다',async()=>{
 const m=await load(),c=m.createControlAcceptanceChain(input());
 const db={query:async()=>({rows:[{bundle_json:c,next_generation:9,project_id:id(1),content_hash:c.acceptance.ref.contentHash}]})};
 await assert.rejects(()=>m.readCurrentControlGrant(db as never,id(1),{...c.result.nextControl,revoked_at:null}));
});
