import assert from 'node:assert/strict';
import test from 'node:test';
const m:any=await import('../../../apps/server/modules/executions/execution-challenge-store.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
test('PG challenge store에는 합성 key 제공자가 필수이며 실제 credential/환경 fallback을 만들지 않는다',()=>{
 assert.equal(typeof m.SyntheticPgChallengeStore,'function');
 const pool={connect:async()=>{throw Error('SHOULD_NOT_CONNECT');}};
 for(const key of [undefined,{transport:'REAL',key:async()=>null},{transport:'SYNTHETIC_ONLY'}])assert.throws(()=>new m.SyntheticPgChallengeStore(pool,key),/SYNTHETIC_HOST_KEYS_REQUIRED/);
 const store=new m.SyntheticPgChallengeStore(pool,{transport:'SYNTHETIC_ONLY',key:async()=>{throw Error('NOT_CONNECTED');}});assert.equal(store.transport,'SYNTHETIC_ONLY');
});
test('잘못된 scope는 DB 연결 전에 거절하며 이 port는 아직 실제 회수 grant를 꾸며 내지 않는다',async()=>{
 let calls=0;const store=new m.SyntheticPgChallengeStore({connect:async()=>{calls++;throw Error('SHOULD_NOT_CONNECT');}},{transport:'SYNTHETIC_ONLY',key:async()=>null});
 for(const value of [null,{}, {mode:'RECOVERY'}])await assert.rejects(store.transaction(value,async()=>null));assert.equal(calls,0);
});
