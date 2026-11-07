import {readFile} from 'node:fs/promises';
import {contentHash,parseWireJson} from '../contracts/canonical.ts';
import {sourceReadSqlCases} from '../tests/integration/FN08/source-read-sql-vectors.ts';
import {sourceReadMigrationManifest,sourceReadMigrationId,sourceReadMigrationRoot} from './source-read-migration.ts';
import {legacyMigrationIds,sourceRootMigrationId} from './source-root-migration.ts';

/** SQL stdin 전용. 입력 문자열은 UTF-8 hex 식으로만 전달한다. */
export function sourceReadPsqlText(value:string){if(typeof value!=='string')throw Error('QA_PSQL_TEXT_INVALID');return "convert_from(decode('"+Buffer.from(value,'utf8').toString('hex')+"','hex'),'UTF8')";}
const failUnless=(expression:string,reason:string)=>"DO $a3check$ BEGIN IF ("+expression+") IS DISTINCT FROM TRUE THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='"+reason+"'; END IF; END $a3check$;";
const settings="SET LOCAL statement_timeout='10s';SET LOCAL lock_timeout='2s';";
const target=(role:string)=>failUnless("current_database()='anvil_v3_a3_read_qa' AND current_user='"+role+"' AND current_setting('server_version_num')::int>=150000 AND current_setting('server_version_num')::int<160000 AND current_setting('is_superuser')='off'",'A3_ISOLATED_TARGET_REQUIRED');

/** 준비 전용 batch 생성. Docker·PG·파일 쓰기·credential·실행은 없다. */
export async function buildSourceReadPsqlBatches(){
 await sourceReadMigrationRoot();const manifest=await sourceReadMigrationManifest(),expected=new Map(manifest.expected);expected.set(sourceReadMigrationId,manifest.checksum);
 const ids=[...legacyMigrationIds,sourceRootMigrationId,sourceReadMigrationId];
 let schema="BEGIN;\n"+settings+"\n"+target('anvil_v3_migrator')+"\nDO $a3lock$ BEGIN PERFORM pg_advisory_xact_lock(hashtext('anvil-v3-migrations')); END $a3lock$;\n";
 for(const id of ids){const sql=await readFile(new URL('../db/migrations/'+id+'.sql',import.meta.url),'utf8'),hash=contentHash(Buffer.from(sql));if(hash!==expected.get(id))throw Error('QA_PSQL_MIGRATION_HASH_MISMATCH');schema+=sql+"\n;\nINSERT INTO anvil.schema_migrations(id,checksum) VALUES("+sourceReadPsqlText(id)+","+sourceReadPsqlText(hash)+");\n";}
 schema+="COMMIT;\nSELECT '{\"kind\":\"A3_PSQL_SCHEMA_COMMITTED\",\"migrations\":46}';\n";
 const checksumJson=JSON.stringify(ids.map(id=>({id,checksum:expected.get(id)})).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0));
 let readOnly="BEGIN READ ONLY;\n"+settings+"\n"+target('anvil_v3_app')+"\n"+failUnless("(SELECT jsonb_agg(jsonb_build_object('id',id,'checksum',checksum) ORDER BY id COLLATE \"C\") FROM anvil.schema_migrations)="+sourceReadPsqlText(checksumJson)+"::jsonb",'A3_MIGRATION_NOT_READY')+"\n";
 const vectors=sourceReadSqlCases();
 for(const item of vectors){const query=item.query.replaceAll('$1',sourceReadPsqlText(item.parameter));readOnly+=failUnless("(SELECT to_jsonb(q) FROM ("+query+") q)="+sourceReadPsqlText(JSON.stringify(item.expected))+"::jsonb",'A3_SQL_VECTOR_MISMATCH')+"\n";}
 for(const name of ['source_read_grants','source_read_challenges','source_read_credentials','source_snapshots'])readOnly+=failUnless("(SELECT count(*) FROM anvil."+name+")=0",'QA_NEW_TABLE_NOT_EMPTY')+"\n";
 readOnly+="COMMIT;\nSELECT '{\"kind\":\"A3_PSQL_SQL_VECTORS_DONE\",\"vectors\":"+vectors.length+",\"newTablesEmpty\":4}';\n";
 return{schema,readOnly,migrations:ids.length,vectors:vectors.length,sqlHash:manifest.checksum};
}
export function readSourceReadPsqlResult(stdout:string,mode:'SCHEMA'|'READ_ONLY'){
 try{const kind=mode==='SCHEMA'?'A3_PSQL_SCHEMA_COMMITTED':'A3_PSQL_SQL_VECTORS_DONE',lines=stdout.split(/\r?\n/).filter(v=>v.trim());if(lines.length!==1)throw Error();const value=parseWireJson(lines[0]!);if(!value||typeof value!=='object'||Array.isArray(value))throw Error();const record=value as Record<string,unknown>;if(record.kind!==kind)throw Error();const keys=Object.keys(record).sort().join(',');if(mode==='SCHEMA'?(keys!=='kind,migrations'||record.migrations!==46):(keys!=='kind,newTablesEmpty,vectors'||record.vectors!==26||record.newTablesEmpty!==4))throw Error();return record;}catch{throw Error('QA_PSQL_RESULT_INVALID');}
}
/** stderr/SQL/host/credential 원문0, sqlstate 전용 출력에서 고정 코드만 추출한다. */
export function sourceReadPsqlError(error:unknown){const e=error as{status?:unknown;stderr?:unknown;code?:unknown}|null,stderr=typeof e?.stderr==='string'?e.stderr:Buffer.isBuffer(e?.stderr)?e.stderr.toString('utf8'):'';return{failure:'QA_PSQL_STEP_FAILED',pgCode:/(?:ERROR|FATAL):\s+([A-Z0-9]{5})(?:\s|$)/.exec(stderr)?.[1]??null,exitCode:Number.isInteger(e?.status)?e!.status:null,timedOut:e?.code==='ETIMEDOUT'};}
