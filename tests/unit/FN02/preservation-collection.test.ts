import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {assignmentDevelopmentBaselineNames} from '../../../scripts/assignment-draft-development-guard.ts';
import {compareFn02Preservation} from '../../../scripts/fn02-preservation-comparison.ts';
const load=()=>import(new URL('../../../scripts/fn02-preservation-collection.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const unsupported=['schemas','public_objects','relation_kinds','routine_kinds','custom_types','custom_collations','rules','policies','inheritance','large_objects','extensions','event_triggers','foreign_servers','foreign_wrappers','user_mappings','publications','security_labels','extended_statistics','operators','operator_classes','operator_families','conversions','text_search','internal_triggers'];
async function fixture(isolation='repeatable read',badCatalog=false){
 const text=await readFile(new URL('../../../docs/04_test_reports/AV3/FN02/FORMAL_SCHEMA_METADATA_RESULT.md',import.meta.url),'utf8');
 const manifest=[...text.matchAll(/^\|([0-9][a-z0-9_]+)\|([a-f0-9]{64})\|$/gm)].map(m=>({id:m[1],checksum:m[2]}));
 const calls:string[]=[];return {calls,db:{query:async(sql:string,values?:unknown[]):Promise<{rows:Record<string,unknown>[]}>=>{
  calls.push(sql);
  if(sql.includes('transaction_isolation'))return {rows:[{isolation,db:'anvil_v3_development',version:150018}]};
  if(sql.includes('SELECT id,checksum'))return {rows:manifest};
  if(sql.startsWith('/* FN02_UNSUPPORTED */'))return {rows:unsupported.map(kind=>({kind,n:badCatalog&&kind==='large_objects'?'1':'0'}))};
  if(sql.startsWith('/* FN02_OBJECTS:triggers */'))return {rows:[]};
  if(sql.startsWith('/* FN02_OBJECTS:'))return {rows:[{object_count:sql.startsWith('/* FN02_OBJECTS:schemas */')?'3':sql.startsWith('/* FN02_OBJECTS:database */')?'1':'0',objects_hash:'a'.repeat(64)}]};
  if(sql.includes('FROM pg_sequence'))return {rows:[{name:'anvil.auth_audit_events_server_sequence_seq',definition_hash:'a'.repeat(64)}]};
  if(sql.startsWith('SELECT last_value'))return {rows:[{last_value:'1',is_called:false}]};
  if(sql.includes('FROM pg_class c JOIN pg_namespace'))return {rows:[...assignmentDevelopmentBaselineNames].map(name=>({name,rls:false,readable:true}))};
  if(sql.includes('FROM pg_attribute'))return {rows:(values?.[0]==='anvil.schema_migrations'?['id','checksum','applied_at']:['id']).map((name,i)=>({position:i+1,name,type:name==='applied_at'?'timestamp with time zone':'text',collation:null,required:true,identity:'',generated:'',default:null}))};
  if(sql.startsWith('WITH row_hashes'))return {rows:[{row_count:values?'46':'0',rows_hash:'a'.repeat(64)}]};
  if(/^(SAVEPOINT|RELEASE SAVEPOINT|ROLLBACK TO SAVEPOINT|SET LOCAL)/.test(sql))return {rows:[]};
  throw Error('UNEXPECTED_QUERY');
 }}};
}
test('세 수집기를 연결해도 원문·완전한 archive 증명·sequence 중단·실행허가로 승격하지 않는다',async()=>{
 const m:any=await load();assert.equal(typeof m.collectFn02PreservationInputs,'function');
 const f=await fixture();const output=await m.collectFn02PreservationInputs(f.db,'BACKUP_EXPORTED_SNAPSHOT',()=>{});
 assert.equal(output.tables.length,81);assert.equal(output.categories.length,11);assert.equal(output.sequences.length,1);
 assert.equal(output.comparisonReady,false);assert.equal(output.executionAllowed,false);assert.equal(output.fullArchiveCoverageVerified,false);assert.equal(output.sequenceQuiescenceConfirmed,false);
 assert.deepEqual(output.blockers,['ARCHIVE_COVERAGE_UNVERIFIED','SEQUENCE_QUIESCENCE_UNVERIFIED']);
 assert.throws(()=>compareFn02Preservation(output,{...output,phase:'ISOLATED_RESTORE'},{...output,phase:'AFTER_LOCK_READ_COMMITTED'}),/FN02_PRESERVATION_INVALID/);
 assert.equal(f.calls[0],'SAVEPOINT fn02_preservation_collection');assert.equal(f.calls.at(-1),'RELEASE SAVEPOINT fn02_preservation_collection');
});
test('정식현재 단계는 READ COMMITTED를 요구하고 잘못된 단계는 조회 전에 거절한다',async()=>{
 const m:any=await load();assert.equal(typeof m.collectFn02PreservationInputs,'function');
 const current=await fixture('read committed');const output=await m.collectFn02PreservationInputs(current.db,'AFTER_LOCK_READ_COMMITTED',()=>{});assert.equal(output.phase,'AFTER_LOCK_READ_COMMITTED');
 const stale=await fixture('repeatable read');await assert.rejects(m.collectFn02PreservationInputs(stale.db,'AFTER_LOCK_READ_COMMITTED',()=>{}),/^Error: FN02_PRESERVATION_COLLECTION_FAILED$/);
 const invalid=await fixture();await assert.rejects(m.collectFn02PreservationInputs(invalid.db,'UNKNOWN',()=>{}),/^Error: FN02_PRESERVATION_COLLECTION_FAILED$/);assert.equal(invalid.calls.length,0);
});
test('표밖객체 수집이 실패하면 sequence를 읽지 않고 바깥 SAVEPOINT까지 되돌린다',async()=>{
 const m:any=await load();assert.equal(typeof m.collectFn02PreservationInputs,'function');const f=await fixture('repeatable read',true);
 await assert.rejects(m.collectFn02PreservationInputs(f.db,'BACKUP_EXPORTED_SNAPSHOT',()=>{}),/^Error: FN02_PRESERVATION_COLLECTION_FAILED$/);
 assert.equal(f.calls.some(q=>q.includes('FROM pg_sequence')),false);assert.deepEqual(f.calls.slice(-2),['ROLLBACK TO SAVEPOINT fn02_preservation_collection','RELEASE SAVEPOINT fn02_preservation_collection']);
});
