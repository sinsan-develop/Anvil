import assert from 'node:assert/strict';
import test from 'node:test';
const load=()=>import(new URL('../../../scripts/fn02-sequence-preservation-collection.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const name='anvil.auth_audit_events_server_sequence_seq';
function fixture(){const calls:string[]=[];return {calls,db:{query:async(sql:string)=>{
 calls.push(sql);
 if(sql.includes('transaction_isolation'))return {rows:[{isolation:'repeatable read',db:'anvil_v3_development',version:150018}]};
 if(sql.includes('FROM pg_sequence'))return {rows:[{name,definition_hash:'a'.repeat(64)}]};
 if(sql.startsWith('SELECT last_value'))return {rows:[{last_value:'1',is_called:false,unexpected:'SYNTHETIC_SECRET'}]};
 if(/^(SAVEPOINT|RELEASE SAVEPOINT|ROLLBACK TO SAVEPOINT|SET LOCAL)/.test(sql))return {rows:[]};
 throw Error('UNEXPECTED_QUERY');
}}};}
test('sequence 정의·값을 두 번 비교해도 지속 중단을 확인했다고 주장하지 않는다',async()=>{
 const m:any=await load();assert.equal(typeof m.collectFn02SequencePreservation,'function');const f=fixture();
 const result=await m.collectFn02SequencePreservation(f.db,'repeatable read',()=>{});
 assert.deepEqual(result,{kind:'PARTIAL_SEQUENCE_PRESERVATION_INPUTS',sequences:[{name,definitionHash:'a'.repeat(64),lastValue:'1',isCalled:false}],sameSampleEndpoints:true,sequenceQuiescenceConfirmed:false,comparisonReady:false,executionAllowed:false});
 assert.equal(f.calls.filter(q=>q.startsWith('SELECT last_value')).length,2);
 assert.equal(f.calls.filter(q=>q.includes('FROM pg_sequence')).length,2);
 assert.equal(f.calls.some(q=>/\b(nextval|setval|ALTER|INSERT|COMMIT|BEGIN)\b/i.test(q)),false);
});
test('예상 밖 sequence·누락·중복·정의·값 변화는 거절한다',async()=>{
 const m:any=await load();assert.equal(typeof m.collectFn02SequencePreservation,'function');
 for(const mode of ['missing','duplicate','unexpected','definition-drift','value-drift','called-drift']){
  const f=fixture(),query=f.db.query;let definitions=0,states=0;
  f.db.query=async(sql)=>{
   const result=await query(sql);
   if(sql.includes('FROM pg_sequence')){
    definitions++;if(mode==='missing')return {rows:[]};if(mode==='duplicate')return {rows:[...result.rows,...result.rows]};
    if(mode==='unexpected')return {rows:[{name:'anvil.unexpected',definition_hash:'a'.repeat(64)}]} as any;
    if(mode==='definition-drift'&&definitions===2)return {rows:[{name,definition_hash:'b'.repeat(64)}]} as any;
   }
   if(sql.startsWith('SELECT last_value')){states++;if(states===2&&mode==='value-drift')return {rows:[{last_value:'2',is_called:false}]} as any;if(states===2&&mode==='called-drift')return {rows:[{last_value:'1',is_called:true}]} as any;}
   return result;
  };
  await assert.rejects(m.collectFn02SequencePreservation(f.db,'repeatable read',()=>{}),/^Error: FN02_SEQUENCE_FAILED$/);
  assert.equal(f.calls.at(-2),'ROLLBACK TO SAVEPOINT fn02_sequence_collection');
 }
});
test('숫자 범위·타입·만료·실행 오류를 성공이나 원문 오류로 반환하지 않는다',async()=>{
 const m:any=await load();assert.equal(typeof m.collectFn02SequencePreservation,'function');
 for(const value of [{last_value:'01',is_called:false},{last_value:'9223372036854775808',is_called:false},{last_value:'1',is_called:'false'},null]){
  const f=fixture(),query=f.db.query;f.db.query=async(sql)=>{const result=await query(sql);if(sql.startsWith('SELECT last_value')){if(value===null)throw Error('SECRET');return {rows:[value]} as any;}return result;};
  await assert.rejects(m.collectFn02SequencePreservation(f.db,'repeatable read',()=>{}),/^Error: FN02_SEQUENCE_FAILED$/);
 }
 const f=fixture();await assert.rejects(m.collectFn02SequencePreservation(f.db,'repeatable read',()=>{throw Error('EXPIRED_SECRET');}),/^Error: FN02_SEQUENCE_FAILED$/);assert.equal(f.calls.length,0);
});
