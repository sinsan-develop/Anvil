import assert from 'node:assert/strict';
import test from 'node:test';
const load=()=>import(new URL('../../../scripts/fn02-catalog-preservation-collection.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const categories=['schemas','database','database_settings','relations','columns','constraints','indexes','functions','triggers','default_privileges','extensions'];
const unsupported=['schemas','public_objects','relation_kinds','routine_kinds','custom_types','custom_collations','rules','policies','inheritance','large_objects','extensions','event_triggers','foreign_servers','foreign_wrappers','user_mappings','publications','security_labels','extended_statistics','operators','operator_classes','operator_families','conversions','text_search','internal_triggers'];
function fixture(){const calls:string[]=[];return {calls,db:{query:async(sql:string):Promise<{rows:Record<string,unknown>[]}>=>{
 calls.push(sql);
 if(sql.includes('transaction_isolation'))return {rows:[{isolation:'repeatable read',db:'anvil_v3_development',version:150018}]};
 if(sql.startsWith('/* FN02_UNSUPPORTED */'))return {rows:unsupported.map(kind=>({kind,n:'0'}))};
 const category=categories.find(c=>sql.startsWith('/* FN02_OBJECTS:'+c+' */'));
 if(category==='triggers')return {rows:[]};
 if(category)return {rows:[{object_count:category==='schemas'?'3':category==='database'?'1':'0',objects_hash:'a'.repeat(64),unexpected:'SYNTHETIC_DEFINITION_SECRET'}]};
 if(/^(SAVEPOINT|RELEASE SAVEPOINT|ROLLBACK TO SAVEPOINT|SET LOCAL)/.test(sql))return {rows:[]};
 throw Error('UNEXPECTED_QUERY');
}}};}
test('정의·owner/ACL 집계는 고정 범주만 수집하고 원문이나 실행허가를 반환하지 않는다',async()=>{
 const m:any=await load();assert.equal(typeof m.collectFn02CatalogPreservation,'function');const f=fixture();
 const output=await m.collectFn02CatalogPreservation(f.db,'repeatable read',()=>{});
 assert.deepEqual(output.categories.map((c:any)=>c.kind),categories);assert.match(output.objectsHash,/^[a-f0-9]{64}$/);
 assert.equal(output.comparisonReady,false);assert.equal(output.executionAllowed,false);assert.equal(output.coverage,'DECLARED_CATEGORIES_ONLY');assert.equal(output.fullArchiveCoverageVerified,false);
 assert.equal(JSON.stringify(output).includes('SYNTHETIC_DEFINITION_SECRET'),false);
 assert.equal(f.calls.at(-1),'RELEASE SAVEPOINT fn02_catalog_collection');
 assert.equal(f.calls.some(sql=>/^(BEGIN|COMMIT|INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|COPY)\b/.test(sql)),false);
});
test('지원하지 않는 종류가 하나라도 존재하거나 registry 행이 누락·중복되면 정의 읽기 전에 거절한다',async()=>{
 const m:any=await load();assert.equal(typeof m.collectFn02CatalogPreservation,'function');
 for(const change of [...unsupported,'missing','duplicate']){
  const f=fixture(),query=f.db.query;f.db.query=async(sql)=>{
   const r=await query(sql);if(sql.startsWith('/* FN02_UNSUPPORTED */')){
    if(change==='missing')r.rows.pop();else if(change==='duplicate')r.rows.push(r.rows[0]!);else r.rows.find((row:any)=>row.kind===change)!.n='1';
   }return r;
  };
  await assert.rejects(m.collectFn02CatalogPreservation(f.db,'repeatable read',()=>{}),/^Error: FN02_CATALOG_FAILED$/);
  assert.equal(f.calls.some(q=>q.startsWith('/* FN02_OBJECTS:')),false);
 }
});
test('집계 변경은 전체 객체지문에 반영하고 누락·잘못된 hash·숫자는 거절한다',async()=>{
 const m:any=await load();assert.equal(typeof m.collectFn02CatalogPreservation,'function');
 const original=await m.collectFn02CatalogPreservation(fixture().db,'repeatable read',()=>{});
 const f=fixture(),query=f.db.query;f.db.query=async(sql)=>{const r=await query(sql);if(sql.startsWith('/* FN02_OBJECTS:functions */'))return {rows:[{object_count:'1',objects_hash:'b'.repeat(64)}]} as any;return r;};
 const changed=await m.collectFn02CatalogPreservation(f.db,'repeatable read',()=>{});assert.notEqual(changed.objectsHash,original.objectsHash);
 for(const bad of [[],[{object_count:'01',objects_hash:'a'.repeat(64)}],[{object_count:'0',objects_hash:'bad'}]]){
  const f=fixture(),query=f.db.query;f.db.query=async(sql)=>sql.startsWith('/* FN02_OBJECTS:constraints */')?{rows:bad}:query(sql);
  await assert.rejects(m.collectFn02CatalogPreservation(f.db,'repeatable read',()=>{}),/^Error: FN02_CATALOG_FAILED$/);
 }
});
test('SQL 오류·중간 만료·정리 실패를 성공으로 표시하지 않고 내부 오류문을 숨긴다',async()=>{
 const m:any=await load();assert.equal(typeof m.collectFn02CatalogPreservation,'function');
 for(const mode of ['sql-error','expiry','cleanup']){
  const f=fixture(),query=f.db.query;let expired=false;
  f.db.query=async(sql)=>{
   if(mode==='cleanup'&&sql.startsWith('ROLLBACK TO SAVEPOINT'))throw Error('SECRET_CLEANUP');
   if(sql.startsWith('/* FN02_OBJECTS:functions */')){if(mode==='expiry')expired=true;else throw Error('SECRET_FUNCTION_BODY');}
   return query(sql);
  };
  await assert.rejects(m.collectFn02CatalogPreservation(f.db,'repeatable read',()=>{if(expired)throw Error('SECRET_EXPIRY');}),mode==='cleanup'?/^Error: FN02_CATALOG_CLEANUP_FAILED$/:/^Error: FN02_CATALOG_FAILED$/);
 }
});

test('내부 FK trigger의 생성 이름 차이는 같게 보되 enabled·참조·역할 변경은 구분한다',async()=>{
 const m:any=await load();assert.equal(typeof m.normalizeFn02TriggerRows,'function');
 const row={schema_name:'anvil',table_name:'child',internal:true,constraint_schema:'anvil',constraint_table:'child',constraint_name:'child_parent_fkey',constraint_kind:'f',referenced_schema:'anvil',referenced_table:'parent',routine_schema:'pg_catalog',routine_name:'RI_FKey_check_ins',routine_args:'',trigger_type:5,enabled:'O',deferrable:false,initially_deferred:false,attributes:'',args_hash:'a'.repeat(64),user_name:null,user_definition_hash:null,generated_name:'RI_ConstraintTrigger_c_20000'};
 const original=m.normalizeFn02TriggerRows([row]);
 assert.deepEqual(m.normalizeFn02TriggerRows([{...row,generated_name:'RI_ConstraintTrigger_c_30000'}]),original);
 for(const changed of [{enabled:'D'},{referenced_table:'other'},{routine_name:'RI_FKey_noaction_del'},{constraint_name:'different_fkey'},{trigger_type:9}])assert.notEqual(m.normalizeFn02TriggerRows([{...row,...changed}]).objectsHash,original.objectsHash);
 for(const bad of [{...row,constraint_kind:'u'},{...row,routine_schema:undefined},...Array.from({length:1},()=>undefined)])assert.throws(()=>m.normalizeFn02TriggerRows([bad]),/FN02_CATALOG_TRIGGER_INVALID/);
 assert.throws(()=>m.normalizeFn02TriggerRows(Array(1)),/FN02_CATALOG_TRIGGER_INVALID/);
});

test('사용자 trigger의 이름과 정의 지문은 정규화에서 보존한다',async()=>{
 const m:any=await load();assert.equal(typeof m.normalizeFn02TriggerRows,'function');
 const row={schema_name:'anvil',table_name:'child',internal:false,routine_schema:'anvil',routine_name:'guard_child',routine_args:'',trigger_type:7,enabled:'O',deferrable:false,initially_deferred:false,attributes:'',args_hash:'a'.repeat(64),user_name:'guard_child',user_definition_hash:'b'.repeat(64)};
 const original=m.normalizeFn02TriggerRows([row]);
 for(const changed of [{user_name:'guard_other'},{user_definition_hash:'c'.repeat(64)}])assert.notEqual(m.normalizeFn02TriggerRows([{...row,...changed}]).objectsHash,original.objectsHash);
});
