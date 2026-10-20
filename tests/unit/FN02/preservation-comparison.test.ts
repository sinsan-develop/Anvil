import assert from 'node:assert/strict';
import test from 'node:test';
import {assignmentDevelopmentBaselineNames} from '../../../scripts/assignment-draft-development-guard.ts';

const load=()=>import(new URL('../../../scripts/fn02-preservation-comparison.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const digest='a'.repeat(64),changed='b'.repeat(64);
function evidence(){return {
 phase:'BACKUP_EXPORTED_SNAPSHOT',manifestHash:'da9a9e45107a822d2c56fff2f54878be6ba6dab6ff0f44dec58212c6eb8d7091',manifestCount:46,
 tables:[...assignmentDevelopmentBaselineNames].map(name=>({name,projectionHash:digest,rowCount:'0',rowsHash:digest})),
 objectsHash:digest,oldMigrationRowsHash:digest,
 sequences:[{name:'anvil.auth_audit_events_server_sequence_seq',definitionHash:digest,lastValue:'1',isCalled:false}],
 sequenceQuiescenceConfirmed:true,
};}
test('일치는 입력 비교일 뿐 실행 권한으로 승격하지 않는다',async()=>{
 const m:any=await load();assert.equal(typeof m.compareFn02Preservation,'function');
 const before=evidence(),restored={...structuredClone(before),phase:'ISOLATED_RESTORE'},current={...structuredClone(before),phase:'AFTER_LOCK_READ_COMMITTED'};
 restored.tables.reverse();const output=m.compareFn02Preservation(before,restored,current);
 assert.deepEqual(output,{status:'MATCHED_INPUTS_ONLY',executionAllowed:false,liveEvidenceVerified:false});
 assert.ok(Object.isFrozen(output));
});
test('표 누락·중복·추가 및 같은 행 수의 내용 차이를 거절한다',async()=>{
 const m:any=await load();assert.equal(typeof m.compareFn02Preservation,'function');
 const before=evidence();
 for(const phase of ['ISOLATED_RESTORE','AFTER_LOCK_READ_COMMITTED']){
  for(const mutate of [
   (s:any)=>s.tables.pop(),(s:any)=>s.tables.push(s.tables[0]),
   (s:any)=>s.tables[0].name='anvil.unexpected',
   (s:any)=>s.tables[0].rowsHash=changed,(s:any)=>s.tables[0].rowCount='1',
   (s:any)=>s.tables[0].projectionHash=changed,
  ]){
   const other:any={...structuredClone(before),phase};mutate(other);
   assert.throws(()=>m.compareFn02Preservation(before,phase==='ISOLATED_RESTORE'?other:{...structuredClone(before),phase:'ISOLATED_RESTORE'},phase==='AFTER_LOCK_READ_COMMITTED'?other:{...structuredClone(before),phase:'AFTER_LOCK_READ_COMMITTED'}),/^Error: FN02_PRESERVATION_(INVALID|MISMATCH)$/);
  }
 }
});
test('옛46행·표밖 객체·sequence 차이와 중단 미확인을 거절한다',async()=>{
 const m:any=await load();assert.equal(typeof m.compareFn02Preservation,'function');
 const before=evidence();
 for(const mutate of [
  (s:any)=>s.oldMigrationRowsHash=changed,(s:any)=>s.objectsHash=changed,
  (s:any)=>s.manifestHash=changed,(s:any)=>s.manifestCount=53,
  (s:any)=>s.sequences[0].lastValue='2',(s:any)=>s.sequences[0].isCalled=true,
  (s:any)=>s.sequences[0].definitionHash=changed,(s:any)=>s.sequences=[],
  (s:any)=>s.sequenceQuiescenceConfirmed=false,
 ]){
  const current:any={...structuredClone(before),phase:'AFTER_LOCK_READ_COMMITTED'};mutate(current);
  assert.throws(()=>m.compareFn02Preservation(before,{...structuredClone(before),phase:'ISOLATED_RESTORE'},current),/^Error: FN02_PRESERVATION_(INVALID|MISMATCH)$/);
 }
});
test('잠금 전 snapshot과 잘못된 지문·숫자를 입력 노출 없이 거절한다',async()=>{
 const m:any=await load();assert.equal(typeof m.compareFn02Preservation,'function');
 const before=evidence();
 for(const mutate of [
  (s:any)=>s.phase='BACKUP_EXPORTED_SNAPSHOT',(s:any)=>s.tables[0].rowsHash='secret-body',
  (s:any)=>s.tables[0].rowCount='01',(s:any)=>s.tables[0].rowCount=NaN,
  (s:any)=>s.sequences[0].isCalled='false',(s:any)=>s.sequences[0].lastValue='9223372036854775808',
  (s:any)=>s.sequenceQuiescenceConfirmed=undefined,
 ]){
  const current:any={...structuredClone(before),phase:'AFTER_LOCK_READ_COMMITTED'};mutate(current);
  assert.throws(()=>m.compareFn02Preservation(before,{...structuredClone(before),phase:'ISOLATED_RESTORE'},current),/^Error: FN02_PRESERVATION_INVALID$/);
 }
});

test('세 입력이 모두 같은 잘못된 기준선이거나 입력이 없으면 거절한다',async()=>{
 const m:any=await load();assert.equal(typeof m.compareFn02Preservation,'function');
 for(const bad of [undefined,null,{},[],{...evidence(),manifestCount:53},{...evidence(),manifestHash:changed}]){
  assert.throws(()=>m.compareFn02Preservation(bad,bad,bad),/^Error: FN02_PRESERVATION_INVALID$/);
 }
 const before=evidence();
 for(const index of [0,1,2]){
  const inputs:any[]=[before,{...structuredClone(before),phase:'ISOLATED_RESTORE'},{...structuredClone(before),phase:'AFTER_LOCK_READ_COMMITTED'}];
  inputs[index].sequenceQuiescenceConfirmed=false;
  assert.throws(()=>m.compareFn02Preservation(...inputs),/^Error: FN02_PRESERVATION_INVALID$/);
 }
});

test('모든 입력이 희소 배열이거나 마지막 항목이 빠져도 일치로 처리하지 않는다',async()=>{
 const m:any=await load();assert.equal(typeof m.compareFn02Preservation,'function');
 for(const mutate of [
  (s:any)=>{s.tables=Array(81);s.sequences=Array(1);},
  (s:any)=>{delete s.tables[80];},(s:any)=>{delete s.sequences[0];},
 ]){
  const inputs:any[]=[{...evidence(),phase:'BACKUP_EXPORTED_SNAPSHOT'},{...evidence(),phase:'ISOLATED_RESTORE'},{...evidence(),phase:'AFTER_LOCK_READ_COMMITTED'}];
  inputs.forEach(mutate);
  assert.throws(()=>m.compareFn02Preservation(...inputs),/^Error: FN02_PRESERVATION_INVALID$/);
 }
});
