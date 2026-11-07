import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {assignmentDevelopmentBaselineNames} from '../../../scripts/assignment-draft-development-guard.ts';
const load=()=>import(new URL('../../../scripts/fn02-table-preservation-collection.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
async function fixture(){
 const text=await readFile(new URL('../../../docs/04_test_reports/AV3/FN02/FORMAL_SCHEMA_METADATA_RESULT.md',import.meta.url),'utf8');
 const manifest=[...text.matchAll(/^\|([0-9][a-z0-9_]+)\|([a-f0-9]{64})\|$/gm)].map(m=>({id:m[1],checksum:m[2]}));
 const calls:{sql:string;values?:unknown[]}[]=[];
 const db={query:async(sql:string,values?:unknown[])=>{
  calls.push({sql,values});
  if(sql.includes('transaction_isolation'))return {rows:[{isolation:'repeatable read',db:'anvil_v3_development',version:150018}]};
  if(sql.includes('SELECT id,checksum'))return {rows:manifest};
  if(sql.includes('FROM pg_class c JOIN pg_namespace'))return {rows:[...assignmentDevelopmentBaselineNames].map(name=>({name,rls:false,readable:true}))};
  if(sql.includes('FROM pg_attribute'))return {rows:[{position:1,name:'id',type:'text',collation:'pg_catalog.default',required:true,identity:'',generated:'',default:null},...(values?.[0]==='anvil.schema_migrations'?[{position:2,name:'checksum',type:'text',collation:'pg_catalog.default',required:true,identity:'',generated:'',default:null},{position:3,name:'applied_at',type:'timestamp with time zone',collation:null,required:true,identity:'',generated:'',default:'now()'}]:[])]};
  if(sql.startsWith('WITH row_hashes'))return {rows:[{row_count:values?'46':'0',rows_hash:'a'.repeat(64),unexpected:'SYNTHETIC_BODY_MUST_NOT_ESCAPE'}]};
  if(/^(SAVEPOINT|RELEASE SAVEPOINT|ROLLBACK TO SAVEPOINT|SET LOCAL)/.test(sql))return {rows:[]};
  throw Error('UNEXPECTED_QUERY');
 }};
 return {db,calls,manifest};
}
test('기존81표 원컬럼과 timestamp 포함 옛46행을 수집하되 완전한 보존증거로 승격하지 않는다',async()=>{
 const m:any=await load();assert.equal(typeof m.collectFn02TablePreservation,'function');const f=await fixture();
 const r=await m.collectFn02TablePreservation(f.db,'repeatable read',()=>{});
 assert.equal(r.tables.length,81);assert.equal(r.manifestCount,46);assert.equal(r.manifestHash,'da9a9e45107a822d2c56fff2f54878be6ba6dab6ff0f44dec58212c6eb8d7091');
 assert.equal(r.oldMigrationRowsHash,'a'.repeat(64));assert.equal(r.comparisonReady,false);assert.equal(r.nonTableObjectsCollected,false);assert.equal(r.sequenceCollected,false);assert.equal(r.executionAllowed,false);
 assert.equal(JSON.stringify(r).includes('SYNTHETIC_BODY'),false);
 const migration=r.projections.find((p:any)=>p.name==='anvil.schema_migrations');assert.deepEqual(migration.columns.map((c:any)=>c.name),['id','checksum','applied_at']);
 const hashQuery=f.calls.find(c=>c.sql.startsWith('WITH row_hashes')&&c.sql.includes('"schema_migrations"'))!;
 assert.ok(hashQuery.sql.includes('"row"."applied_at"'));assert.equal((hashQuery.values?.[0] as string[]).length,46);
 assert.equal(f.calls[0]?.sql,'SAVEPOINT fn02_table_collection');assert.equal(f.calls.at(-1)?.sql,'RELEASE SAVEPOINT fn02_table_collection');
 assert.equal(f.calls.some(c=>/^(BEGIN|COMMIT|INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|COPY)\b/.test(c.sql)),false);
});

test('RLS로 일부 행만 보이거나 읽기 권한이 불명확하면 본문 수집 전에 거절한다',async()=>{
 const m:any=await load();assert.equal(typeof m.collectFn02TablePreservation,'function');
 for(const changes of [{rls:true},{readable:false},{rls:undefined}]){
  const f=await fixture(),query=f.db.query;f.db.query=async(sql,values)=>{
   const result=await query(sql,values);
   if(sql.includes('FROM pg_class c JOIN pg_namespace'))Object.assign(result.rows[0]!,changes);
   return result;
  };
  await assert.rejects(m.collectFn02TablePreservation(f.db,'repeatable read',()=>{}),/^Error: FN02_COLLECTION_[A-Z_]+$/);
  assert.equal(f.calls.some(c=>c.sql.startsWith('WITH row_hashes')),false);
 }
});
test('표 누락이나 악성 컬럼명은 해당 본문 읽기 전에 거절한다',async()=>{
 const m:any=await load();assert.equal(typeof m.collectFn02TablePreservation,'function');
 for(const mode of ['missing-table','bad-column','missing-timestamp','manifest-drift']){
  const f=await fixture(),query=f.db.query;f.db.query=async(sql,values)=>{
   const r=await query(sql,values);
   if(mode==='missing-table'&&sql.includes('FROM pg_class c JOIN pg_namespace'))r.rows.pop();
   if(mode==='bad-column'&&sql.includes('FROM pg_attribute'))return {rows:[{position:1,name:'id);DROP',type:'text'}]} as any;
   if(mode==='missing-timestamp'&&sql.includes('FROM pg_attribute')&&values?.[0]==='anvil.schema_migrations')return {rows:r.rows.slice(0,2)} as any;
   if(mode==='manifest-drift'&&sql.includes('SELECT id,checksum'))return {rows:f.manifest.slice(1)} as any;
   return r;
  };
  await assert.rejects(m.collectFn02TablePreservation(f.db,'repeatable read',()=>{}),/^Error: FN02_COLLECTION_[A-Z_]+$/);
  assert.equal(f.calls.at(-2)?.sql,'ROLLBACK TO SAVEPOINT fn02_table_collection');assert.equal(f.calls.at(-1)?.sql,'RELEASE SAVEPOINT fn02_table_collection');
  if(['missing-table','manifest-drift'].includes(mode))assert.equal(f.calls.some(c=>c.sql.startsWith('WITH row_hashes')),false);
 }
});
test('기한 초과·서버오류·격리수준 불일치를 성공으로 보고하지 않고 오류 본문을 숨긴다',async()=>{
 const m:any=await load();assert.equal(typeof m.collectFn02TablePreservation,'function');
 for(const mode of ['expired','server-error','isolation']){
  const f=await fixture(),query=f.db.query;let expired=false;
  f.db.query=async(sql,values)=>{
   if(mode==='server-error'&&sql.startsWith('WITH row_hashes'))throw Error('password=SYNTHETIC_BODY');
   const r=await query(sql,values);if(mode==='expired'&&sql.includes('SELECT id,checksum'))expired=true;
   if(mode==='isolation'&&sql.includes('transaction_isolation'))return {rows:[{isolation:'read committed',db:'anvil_v3_development',version:150018}]} as any;
   return r;
  };
  await assert.rejects(m.collectFn02TablePreservation(f.db,'repeatable read',()=>{if(expired)throw Error('EXPIRED_SECRET');}),/^Error: FN02_COLLECTION_[A-Z_]+$/);
 }
});

test('default 식의 민감 literal은 지문에만 포함하고 반환하지 않는다',async()=>{
 const m:any=await load();assert.equal(typeof m.collectFn02TablePreservation,'function');
 const f=await fixture(),query=f.db.query;f.db.query=async(sql,values)=>{
  const r=await query(sql,values);if(sql.includes('FROM pg_attribute'))Object.assign(r.rows[0]!,{default:"'SYNTHETIC_DEFAULT_SECRET'::text"});return r;
 };
 const output=await m.collectFn02TablePreservation(f.db,'repeatable read',()=>{});
 assert.equal(JSON.stringify(output).includes('SYNTHETIC_DEFAULT_SECRET'),false);
 assert.match(output.projections[0].columns[0].defaultHash,/^[0-9a-f]{64}$/);
});

test('autocommit·잘못된 지문·정리 실패는 부분 수집 성공으로 반환하지 않는다',async()=>{
 const m:any=await load();assert.equal(typeof m.collectFn02TablePreservation,'function');
 for(const mode of ['autocommit','malformed-hash','cleanup-failure']){
  const f=await fixture(),query=f.db.query;f.db.query=async(sql,values)=>{
   if(mode==='autocommit'&&sql.startsWith('SAVEPOINT'))throw Error('NO_TX_SECRET');
   if(mode==='cleanup-failure'&&sql.startsWith('ROLLBACK TO'))throw Error('CLEANUP_SECRET');
   const result=await query(sql,values);
   if(sql.startsWith('WITH row_hashes'))return {rows:[{row_count:'0',rows_hash:'wrong-hash'}]} as any;
   return result;
  };
  await assert.rejects(m.collectFn02TablePreservation(f.db,'repeatable read',()=>{}),mode==='cleanup-failure'?/^Error: FN02_COLLECTION_CLEANUP_FAILED$/:/^Error: FN02_COLLECTION_FAILED$/);
  if(mode==='autocommit')assert.equal(f.calls.length,0);
 }
});
