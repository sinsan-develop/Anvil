import test from 'node:test';import assert from 'node:assert/strict';
import {providerClaimFixture} from './provider-claim-fixture.ts';
const m:any=await import('../../integration/FN06/provider-claim-persistence-qa.ts').catch((e:any)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
test('관측 정상 연결은 반환하고 snapshot·ROLLBACK 오류 연결은 폐기한다',async()=>{
 const released:any[]=[],db={query:async(sql:string)=>{if(sql==='ROLLBACK')throw Error('ROLLBACK_FAILED');throw Error('SNAPSHOT_FAILED');},release:(broken?:boolean)=>released.push(broken)},pool={connect:async()=>db};assert.equal(await m.withClaimQaObserver(pool,async()=>42),42);assert.deepEqual(released,[false]);
 await assert.rejects(m.withClaimQaObserver(pool,async(c:any)=>{try{await c.query('SELECT');}catch{await c.query('ROLLBACK');}}),/ROLLBACK_FAILED/);assert.deepEqual(released,[false,true]);
});
test('실저장 QA는 원실행 THREAD 입력만 복제하고 TURN/다른 실행·grant/누락 port를 거절한다',()=>{
 const f=providerClaimFixture(),ports={keys:{transport:'SYNTHETIC_ONLY',key:async()=>null},facts:{transport:'SYNTHETIC_ONLY',current:async()=>null}},input={scope:f.scope,claim:f.claim,...ports};const selected=m.readClaimPersistenceQaSelection(input);
 for(const change of[{scope:{...f.scope,executionGeneration:2}},{scope:{...f.scope,mode:'RECOVERY'}},{scope:{...f.scope,grantRef:null}},{claim:{...f.claim,kind:'TURN'}},{keys:{transport:'REAL',key:async()=>null}},{facts:null}])assert.throws(()=>m.readClaimPersistenceQaSelection({...input,...change}));
 f.claim.source.responsePayloadDigest='b'.repeat(64);assert.notEqual(selected.claim.source.responsePayloadDigest,f.claim.source.responsePayloadDigest);
});
test('flush fault 주입은 원 SQL/인자를 먼저 실행하고 protected flush 한곳에서만 실패한다',async()=>{
 const calls:any[]=[],db={query:async(sql:string,args:any[])=>{calls.push({sql,args});return{rows:[{saved:true}]};},release:()=>{}},pool={connect:async()=>db},fault=m.providerClaimPostFlushFault(pool),client=await fault.pool.connect();const args=['원문은 출력하지 않음'];assert.deepEqual(await client.query('SELECT 1',args),{rows:[{saved:true}]});assert.equal(fault.hits(),0);
 await assert.rejects(client.query('SELECT anvil.record_provider_session_claim($1::jsonb) AS result',args),/CLAIM_QA_AFTER_PROTECTED_FLUSH/);assert.equal(fault.hits(),1);assert.deepEqual(calls.map(v=>v.sql),['SELECT 1','SELECT anvil.record_provider_session_claim($1::jsonb) AS result']);assert.equal(calls[1].args,args);
});
