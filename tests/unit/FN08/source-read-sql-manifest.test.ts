import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sourceReadMigrationId,sourceReadMigrationManifest} from '../../../scripts/source-read-migration.ts';
import {runSourceReadSqlVectors,sourceReadSqlCases} from '../../integration/FN08/source-read-sql-vectors.ts';

async function rows(){const m=await sourceReadMigrationManifest();return [...m.expected,[sourceReadMigrationId,m.checksum] as [string,string]].map(([id,checksum])=>({id,checksum}));}
function fake(migrations:{id:string;checksum:string}[],allowVectors=false){
 const queries:string[]=[],vectors=sourceReadSqlCases();let at=0;
 const db={query:async(sql:string)=>{queries.push(sql);if(sql.includes('current_database()'))return{rows:[{database:'anvil_v3_a3_read_qa',role:'anvil_v3_app',version:150014}]};if(sql.includes('FROM anvil.schema_migrations'))return{rows:migrations};if(!allowVectors)throw Error('VECTOR_QUERY_BEFORE_MANIFEST_VALIDATION');return{rows:[vectors[at++]!.expected]};}};
 return{db,queries};
}
test('새 SQL 또는 기존 SQL checksum 변조는 vector 실행 전에 거절한다',async()=>{
 const original=await rows();for(const index of [0,original.length-1]){const changed=structuredClone(original);changed[index]!.checksum='f'.repeat(64);const f=fake(changed);await assert.rejects(runSourceReadSqlVectors(f.db as any),{message:'A3_MIGRATION_NOT_READY'});assert.equal(f.queries.length,2);}
});
test('같은46행의 중복·미지ID 및 누락/추가는 checksum 일치로 대체할 수 없다',async()=>{
 const original=await rows();for(const changed of [original.slice(1),[...original,{id:'unapproved_extra',checksum:'e'.repeat(64)}],original.map((r,i)=>i===1?{...original[0]!}:r),original.map((r,i)=>i===1?{...r,id:'unapproved_replacement'}:r)]){const f=fake(changed);await assert.rejects(runSourceReadSqlVectors(f.db as any),{message:'A3_MIGRATION_NOT_READY'});assert.equal(f.queries.length,2);}
});
test('정확46 checksum을 읽은 뒤에만 기존26 vector로 진행한다',async()=>{
 const f=fake((await rows()).reverse(),true),result=await runSourceReadSqlVectors(f.db as any);assert.match(f.queries[1]!,/SELECT id,checksum FROM anvil\.schema_migrations/);assert.equal(f.queries.length,28);assert.equal(result.migrationChecksumsVerified,46);assert.equal(result.vectorCount,26);
});
