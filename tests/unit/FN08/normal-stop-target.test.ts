import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readNormalStopTargetV1,normalStopScopeRefV1,readNormalStopProjectionV1} from '../../../contracts/runtime/normal-stop-target-v1.ts';
const ref=(n:number)=>({id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,version:1,contentHash:n.toString(16).repeat(64)});
const target=()=>({kind:'NORMAL_STOP_SCOPE_V1',projectId:ref(1).id,executionId:ref(2).id,executionGeneration:3,grantRef:ref(3),parentStartCommandRef:ref(4),parentStartEnvelopeHash:'a'.repeat(64),executorRegistrationRef:ref(5),sessionBindingRef:ref(6),roleBindingRef:ref(7),bindingGeneration:4,ownershipRef:ref(8),mode:'COOPERATIVE_REQUEST_ONLY',forceKillAllowed:false});
test('STOP target 정본 고정벡터: UUID namespace는 원 START envelope commandId이며 record ID가 아니다',()=>{
 const t=target(),id=ref(4).id;
 assert.deepEqual(readNormalStopTargetV1(t),t);
 assert.deepEqual(normalStopScopeRefV1(t,id),{id:'8c2deab5-83eb-5d1a-a98a-1d05e6e73c4c',version:1,contentHash:'101e9019e3c3f3812b6fc2878316546b4430ecdfa5861f10caf393dda31e081f'});
 assert.notEqual(normalStopScopeRefV1(t,ref(9).id).id,normalStopScopeRefV1(t,id).id);
 const copy=readNormalStopTargetV1(t);t.ownershipRef.contentHash='b'.repeat(64);assert.notDeepEqual(copy,t);
});
test('STOP target는 닫힌 원형과 협력 요청 false를 지키며 Proxy/accessor를 호출하지 않는다',()=>{
 for(const mutate of [(t:any)=>t.extra=true,(t:any)=>t.forceKillAllowed=true,(t:any)=>t.mode='FORCE',(t:any)=>t.bindingGeneration=0,(t:any)=>t.grantRef.version=0,(t:any)=>t.parentStartEnvelopeHash='z'.repeat(64)]){const t=target();mutate(t);assert.throws(()=>readNormalStopTargetV1(t));}
 let traps=0;assert.throws(()=>readNormalStopTargetV1(new Proxy(target(),{ownKeys(){traps++;return [];}})));assert.equal(traps,0);
 const t=target();Object.defineProperty(t,'ownershipRef',{enumerable:true,get(){traps++;return ref(8);}});assert.throws(()=>readNormalStopTargetV1(t));assert.equal(traps,0);
 const nested=target();nested.ownershipRef=new Proxy(ref(8),{get(){traps++;throw Error('trap');}});assert.throws(()=>readNormalStopTargetV1(nested));assert.equal(traps,0);
});
test('STOP projection은 같은 target/hash/원 namespace와 최단 조회기한·false를 검산한다',()=>{
 const t=target(),now=Date.parse('2026-11-15T00:00:00.000Z'),id=ref(9).id;
 const p={transport:'NORMAL_PROTECTED',grantRef:t.grantRef,sessionBindingRef:t.sessionBindingRef,stopScopeRef:normalStopScopeRefV1(t,id),target:t,checkedAt:new Date(now).toISOString(),expiresAt:new Date(now+30000).toISOString(),executionAuthorized:false,dispatchPerformed:false,writerReleaseVerified:false};
 assert.deepEqual(readNormalStopProjectionV1(p,id,now),p);
 for(const mutate of [(x:any)=>x.stopScopeRef.id=ref(4).id,(x:any)=>x.grantRef=ref(8),(x:any)=>x.writerReleaseVerified=true,(x:any)=>x.expiresAt=new Date(now+30001).toISOString(),(x:any)=>x.target.ownershipRef=ref(9)]){const x=structuredClone(p);mutate(x);assert.throws(()=>readNormalStopProjectionV1(x,id,now));}
 assert.throws(()=>readNormalStopProjectionV1(p,id,now+30000));assert.throws(()=>readNormalStopProjectionV1(p,id,now-1));
 assert.equal(contentHash(canonicalJson(t)),p.stopScopeRef.contentHash);
});
