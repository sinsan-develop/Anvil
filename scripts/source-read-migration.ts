import{readFile,realpath}from'node:fs/promises';import{createHash}from'node:crypto';import{join}from'node:path';import type{Client}from'pg';
import{legacyMigrationIds,sourceRootMigrationId,sourceRootMigrationManifest}from'./source-root-migration.ts';
export const sourceReadMigrationId='0008_source_read_observation';
export async function sourceReadMigrationRoot(){const root=await realpath(new URL('..',import.meta.url));if(await realpath(new URL('./source-root-migration.ts',import.meta.url))!==join(root,'scripts','source-root-migration.ts'))throw Error('SOURCE_READ_MODULE_ROOT_MISMATCH');for(const id of [...legacyMigrationIds,sourceRootMigrationId,sourceReadMigrationId])if(await realpath(new URL('../db/migrations/'+id+'.sql',import.meta.url))!==join(root,'db','migrations',id+'.sql'))throw Error('SOURCE_READ_SQL_ROOT_MISMATCH');return root;}
/** 독립 격리 검수 준비 전용. 기존 정식 migration runner/서버 시작에는 연결하지 않는다. */
export async function sourceReadMigrationManifest(){const previous=await sourceRootMigrationManifest(),expected=new Map(previous.expected);expected.set(sourceRootMigrationId,previous.checksum);const sql=await readFile(new URL('../db/migrations/'+sourceReadMigrationId+'.sql',import.meta.url),'utf8');return{expected,sql,checksum:createHash('sha256').update(sql).digest('hex')};}
/** 호출자가 승인된 격리 대상·BEGIN·advisory lock을 확인해야 한다. 자체 접속/COMMIT은 없다. */
export async function applySourceReadSchemaOnly(db:Pick<Client,'query'>){const manifest=await sourceReadMigrationManifest(),rows=(await db.query('SELECT id,checksum FROM anvil.schema_migrations')).rows as{id:string;checksum:string}[];
 if(new Set(rows.map(r=>r.id)).size!==rows.length||rows.some(r=>!manifest.expected.has(r.id)&&r.id!==sourceReadMigrationId)||[...legacyMigrationIds,sourceRootMigrationId].some(id=>rows.find(r=>r.id===id)?.checksum!==manifest.expected.get(id)))throw Error('SOURCE_READ_LEGACY_MIGRATION_CONFLICT');
 const previous=rows.find(r=>r.id===sourceReadMigrationId);if(previous){if(previous.checksum!==manifest.checksum)throw Error('SOURCE_READ_MIGRATION_CHECKSUM_CONFLICT');return{id:sourceReadMigrationId,checksum:manifest.checksum,applied:false};}
 await db.query(manifest.sql);await db.query('INSERT INTO anvil.schema_migrations(id,checksum) VALUES($1,$2)',[sourceReadMigrationId,manifest.checksum]);return{id:sourceReadMigrationId,checksum:manifest.checksum,applied:true};
}
