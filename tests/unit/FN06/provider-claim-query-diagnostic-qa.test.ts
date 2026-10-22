import test from 'node:test';
import assert from 'node:assert/strict';
const m:any=await import('../../integration/FN06/provider-claim-query-diagnostic-qa.ts').catch((e:any)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const sql='SELECT s.*,c.operation FROM anvil.agent_sessions s JOIN anvil.commands c ON c.project_id=s.project_id AND c.id=s.command_id WHERE s.project_id=$1::uuid FOR SHARE OF s,c';
function fixture(code:string){
 const original=Object.assign(Error('PRIVATE_TOKEN'),{code}),seen:any[]=[];
 const client={query:async(...args:any[])=>{seen.push(args);throw original;},release(){}};
 const pool={connect:async()=>client},access={pool};return{access,pool,seen,original};
}
test('원 조회·인자를 그대로 실행하고 정확한 원장 행잠금 권한 오류만 안전 상수로 구분한다',async()=>{
 const f=fixture('42501'),params=['private-id'];
 await assert.rejects(m.withClaimOwnerReadDiagnostic(f.access,async()=>{
  try{await(await f.access.pool.connect()).query(sql,params);}catch{throw Error('PUBLIC_HISTORY_REJECTED');}
 }),/CLAIM_OWNER_SESSION_LEDGER_LOCK_FORBIDDEN/);
 assert.equal(f.access.pool,f.pool);assert.equal(f.seen.length,1);assert.equal(f.seen[0][0],sql);assert.equal(f.seen[0][1],params);
});
test('다른 SQL·다른 SQLSTATE는 원인으로 오판하지 않고 원 pool을 복구한다',async()=>{
 for(const [query,code] of [[sql,'40001'],['SELECT * FROM anvil.auth_sessions FOR UPDATE','42501']]){
  const f=fixture(code!);await assert.rejects(m.withClaimOwnerReadDiagnostic(f.access,async()=>{await(await f.access.pool.connect()).query(query!);}),e=>e===f.original);assert.equal(f.access.pool,f.pool);
 }
 const f=fixture('42501');assert.equal(await m.withClaimOwnerReadDiagnostic(f.access,async()=>42),42);assert.equal(f.access.pool,f.pool);
});
