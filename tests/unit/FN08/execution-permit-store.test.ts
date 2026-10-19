import assert from 'node:assert/strict';
import test from 'node:test';
const m:any=await import('../../../apps/server/modules/executions/execution-permit-store.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
test('PG permit 연결에는 현재 사실/합성 공개키 제공자가 모두 필수이고 실제 source/OS를 꾸미는 기본값이 없다',()=>{
 assert.equal(typeof m.SyntheticPgPermitStore,'function');const pool={connect:async()=>{throw Error('SHOULD_NOT_CONNECT');}},keys={transport:'SYNTHETIC_ONLY',key:async()=>null},facts={transport:'SYNTHETIC_ONLY',current:async()=>null};
 for(const [k,f] of [[undefined,facts],[keys,undefined],[{transport:'REAL',key:async()=>null},facts],[keys,{transport:'REAL',current:async()=>null}],[keys,{transport:'SYNTHETIC_ONLY'}]])assert.throws(()=>new m.SyntheticPgPermitStore(pool,k,f));
});
test('미지원 회수 scope나 잘못된 tuple은 DB 연결 전에 거절한다',async()=>{
 assert.equal(typeof m.SyntheticPgPermitStore,'function');let connects=0;const store=new m.SyntheticPgPermitStore({connect:async()=>{connects++;throw Error('SHOULD_NOT_CONNECT');}},{transport:'SYNTHETIC_ONLY',key:async()=>null},{transport:'SYNTHETIC_ONLY',current:async()=>null});
 for(const scope of [null,{}, {mode:'RECOVERY'}])await assert.rejects(store.transaction(scope,async()=>null));assert.equal(connects,0);
});
