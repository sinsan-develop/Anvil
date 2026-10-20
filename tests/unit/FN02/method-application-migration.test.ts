import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const load=()=>import(new URL('../../../scripts/fn02-method-application-migration.ts',import.meta.url).href).catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;});
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const expectedHash='e9dee26a03ddd643f06ddc9dfbfe39dccfb91fc305fcc465e53a5d15fd2880c6';

test('FN02 명시 채택은 정확52선행과 본문이 같은0031만 준비하며 기존pending을 보존한다',async()=>{
 const m:any=await load();assert.equal(typeof m.fn02MethodApplicationManifest,'function');const manifest=await m.fn02MethodApplicationManifest();
 assert.equal(manifest.expected.size,52);for(const id of ['0008_source_read_observation','0012_assignment_drafts','0013_assignment_confirmation','0014_context_preparation','0015_project_baselines','0016_execution_preparation','0017_execution_authority'])assert(manifest.expected.has(id));
 assert.equal(manifest.expected.has('0031_empty_project_methodology_application'),false);assert.equal(manifest.expected.has('0029'),false);assert.equal(manifest.checksum,expectedHash);
 const formal=await readFile(new URL('../../../db/migrations/0031_empty_project_methodology_application.sql',import.meta.url)),pending=await readFile(new URL('../../../db/migrations/0031_empty_project_methodology_application.sql.pending',import.meta.url));assert.deepEqual(formal,pending);assert.equal(hash(formal),expectedHash);
});
test('FN02 선행46만·누락·추가·중복·checksum불일치는 쓰기 전에 거절한다',async()=>{
 const m:any=await load();assert.equal(typeof m.applyFn02MethodApplicationSchemaOnly,'function');const manifest=await m.fn02MethodApplicationManifest(),base=[...manifest.expected].map(([id,checksum]:[string,string])=>({id,checksum}));
 const cases=[base.slice(0,46),base.slice(1),[...base,{id:'0029_not_adopted',checksum:'a'.repeat(64)}],[...base,base[0]],base.map((r:any,i:number)=>i===0?{...r,checksum:'f'.repeat(64)}:r),[...base,{id:'0031_empty_project_methodology_application',checksum:expectedHash},{id:'0099_future',checksum:'c'.repeat(64)}]];
 for(const rows of cases){let writes=0;const db:any={query:async(sql:string)=>{if(sql==='SELECT id,checksum FROM anvil.schema_migrations')return{rows};writes++;throw Error('UNEXPECTED_WRITE');}};await assert.rejects(m.applyFn02MethodApplicationSchemaOnly(db),/FN02_APPLICATION_PREREQUISITES_INVALID/);assert.equal(writes,0);}
});
test('FN02의 정확 선행은0031 SQL과기록만 순서대로 소비하고seed/COMMIT을 하지 않는다',async()=>{
 const m:any=await load();assert.equal(typeof m.applyFn02MethodApplicationSchemaOnly,'function');const manifest=await m.fn02MethodApplicationManifest(),rows=[...manifest.expected].map(([id,checksum]:[string,string])=>({id,checksum})),calls:any[]=[];
 const db:any={query:async(sql:string,args?:unknown[])=>{if(sql==='SELECT id,checksum FROM anvil.schema_migrations')return{rows};calls.push([sql,args]);return{rows:[]};}};
 assert.deepEqual(await m.applyFn02MethodApplicationSchemaOnly(db),{id:'0031_empty_project_methodology_application',checksum:expectedHash,applied:true});
 assert.deepEqual(calls,[[manifest.sql,undefined],['INSERT INTO anvil.schema_migrations(id,checksum) VALUES($1,$2)',['0031_empty_project_methodology_application',expectedHash]]]);
});
test('FN02 동일채택 재호출은DDL0이고 다른지문은거절한다',async()=>{
 const m:any=await load();assert.equal(typeof m.applyFn02MethodApplicationSchemaOnly,'function');const manifest=await m.fn02MethodApplicationManifest(),rows=[...manifest.expected].map(([id,checksum]:[string,string])=>({id,checksum}));rows.push({id:'0031_empty_project_methodology_application',checksum:expectedHash});let writes=0;
 const db:any={query:async(sql:string)=>{if(sql==='SELECT id,checksum FROM anvil.schema_migrations')return{rows};writes++;throw Error('UNEXPECTED_WRITE');}};
 assert.deepEqual(await m.applyFn02MethodApplicationSchemaOnly(db),{id:'0031_empty_project_methodology_application',checksum:expectedHash,applied:false});assert.equal(writes,0);
 rows.at(-1)!.checksum='b'.repeat(64);await assert.rejects(m.applyFn02MethodApplicationSchemaOnly(db),/FN02_APPLICATION_CHECKSUM_CONFLICT/);assert.equal(writes,0);
});
test('새 명시mode와 기존mode는 보호config 없으면 접속 전에 닫고 임의mode는 거절한다',()=>{
 const script=fileURLToPath(new URL('../../../scripts/migrate-development.ts',import.meta.url));
 for(const mode of ['FN02_METHOD_APPLICATION_ONLY','SOURCE_ROOT_REGISTRY_ONLY',undefined,'UNKNOWN_FN02_MODE']){
  const env:NodeJS.ProcessEnv={...process.env,ANVIL_DB_CONFIG:''};if(mode===undefined)delete env.ANVIL_MIGRATION_MODE;else env.ANVIL_MIGRATION_MODE=mode;
  const result=spawnSync(process.execPath,['--experimental-strip-types',script],{env,encoding:'utf8',timeout:10000});assert.equal(result.status,1);assert.equal(result.stdout,'');assert.match(result.stderr,mode==='UNKNOWN_FN02_MODE'?/MIGRATION_MODE_INVALID/:/PROTECTED_DB_CONFIG_REQUIRED/);
 }
});
