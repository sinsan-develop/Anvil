import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readMaterialCredentialBasis} from '../../../apps/server/modules/executions/execution-material-credential-basis.ts';
import {createStartMaterialCredentialFixture} from '../../support/execution-material-credential-fixture.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
async function ready(reserve=true){
 const f=createStartMaterialCredentialFixture(true);await f.prepareConcretePolicy(3);await f.run();
 const material=f.tables.execution_material_manifests![0]!.snapshot_json.scope,execution={...structuredClone(material),credentialGeneration:1},snapshot={transport:'SYNTHETIC_ONLY',state:'SYNTHETIC_RESERVED_NO_TOKEN',grantRef:execution.grantRef,credentialGeneration:1,reservedAt:f.clock(),credentialIssued:false,executionAuthorized:false,dispatchPerformed:false};
 if(reserve)f.tables.execution_credentials!.push({project_id:execution.projectId,id:execution.grantRef.id,version:1,grant_id:execution.grantRef.id,grant_version:execution.grantRef.version,credential_generation:1,content_hash:hash(snapshot),snapshot_json:snapshot});
 return{f,material,execution};
}
test('원 grant의 H3와 기존 예약 E1은 두 namespace에서 같은 원자료로 읽히며 SELECT 외 효과가 없다',async()=>{
 const {f,material,execution}=await ready(),before=structuredClone(f.tables);let a:any,b:any;
 await f.transaction(async db=>{const start=f.trace.length;a=await readMaterialCredentialBasis(db,execution,'EXECUTION');b=await readMaterialCredentialBasis(db,material,'MATERIAL');assert(f.trace.slice(start).every(sql=>sql.startsWith('SELECT ')));});
 assert.deepEqual(a,b);assert.deepEqual(a.materialScope,material);assert.deepEqual(a.executionScope,execution);assert.equal(a.fact.subject.credentialGeneration,3);assert.equal(a.reservation.snapshot_json.credentialGeneration,1);assert.deepEqual(f.tables,before);
 a.fact.subject.credentialGeneration=99;a.materialScope.credentialGeneration=99;
 await f.transaction(async db=>assert.deepEqual(await readMaterialCredentialBasis(db,execution,'EXECUTION'),b));
});
test('예약 부재와 다른 grant/version/hash/E·불량 예약은 생성이나 원장 수정 없이 거절한다',async()=>{
 const missing=await ready(false);await missing.f.transaction(async db=>assert.rejects(readMaterialCredentialBasis(db,missing.execution,'EXECUTION')));assert.equal(missing.f.tables.execution_credentials!.length,0);
 for(const mode of ['GRANT','VERSION','HASH','E','STATE','ISSUED','FUTURE']){
  const {f,execution}=await ready(),row=f.tables.execution_credentials![0]!,saved=structuredClone(f.tables);
  if(mode==='GRANT')row.grant_id='ffffffff-ffff-4fff-8fff-ffffffffffff';if(mode==='VERSION')row.grant_version++;if(mode==='HASH')row.content_hash='f'.repeat(64);if(mode==='E')row.credential_generation=2;
  if(mode==='STATE')row.snapshot_json.state='ACTIVE';if(mode==='ISSUED')row.snapshot_json.credentialIssued=true;if(mode==='FUTURE')row.snapshot_json.reservedAt='2099-01-01T00:00:00.000Z';
  const bad=structuredClone(f.tables);await f.transaction(async db=>assert.rejects(readMaterialCredentialBasis(db,execution,'EXECUTION')));assert.deepEqual(f.tables,bad);assert.equal(saved.execution_credentials!.length,1);
 }
});
test('caller가 H/E 또는 common tuple을 치환해도 저장 grant와 예약을 대신하지 못한다',async()=>{
 for(const mode of ['H_AS_E','E_AS_H','PROJECT','CONNECTOR','EXECUTION','GRANT_HASH','TAG']){
  const {f,material,execution}=await ready();const scope=structuredClone(mode==='E_AS_H'?material:execution);let namespace:any=mode==='E_AS_H'?'MATERIAL':'EXECUTION';
  if(mode==='H_AS_E')scope.credentialGeneration=3;if(mode==='E_AS_H')scope.credentialGeneration=1;
  if(mode==='PROJECT')scope.projectId='ffffffff-ffff-4fff-8fff-ffffffffffff';if(mode==='CONNECTOR')scope.connectorId='ffffffff-ffff-4fff-8fff-ffffffffffff';if(mode==='EXECUTION')scope.executionGeneration++;if(mode==='GRANT_HASH')scope.grantRef.contentHash='f'.repeat(64);if(mode==='TAG')namespace='OTHER';
  const before=structuredClone(f.tables);await f.transaction(async db=>assert.rejects(readMaterialCredentialBasis(db,scope,namespace)));assert.deepEqual(f.tables,before);
 }
});
test('마지막 await의 Tx 또는 query identity 전환은 helper의 읽기 결과로 반환하지 않는다',async()=>{
 for(const mode of ['TX','QUERY']){
  const {f,execution}=await ready(),original=f.db.query;let reads=0;
  const wrapped=async(sql:string,p:any[]=[])=>{const result=await original.call(f.db,sql,p);if(sql==='SELECT txid_current()::text AS transaction_id'){reads++;if(mode==='TX'&&reads>=4)return{rows:[{transaction_id:'2'}]};}if(mode==='QUERY'&&sql.startsWith('SELECT * FROM anvil.execution_credentials'))f.db.query=original;return result;};
  f.db.query=wrapped;
  await f.transaction(async db=>{try{await assert.rejects(readMaterialCredentialBasis(db,execution,'EXECUTION'));}finally{f.db.query=original;}});
  assert.equal(f.tables.execution_credentials!.length,1);
 }
});
