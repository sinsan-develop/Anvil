import {readFile,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import type {Client} from 'pg';
import {legacyMigrationIds,sourceRootMigrationId} from './source-root-migration.ts';
import {sourceReadMigrationId} from './source-read-migration.ts';

export const fn02MethodApplicationMigrationId='0031_empty_project_methodology_application';
const candidateChecksum='e9dee26a03ddd643f06ddc9dfbfe39dccfb91fc305fcc465e53a5d15fd2880c6';
const prerequisiteIds=Object.freeze([...legacyMigrationIds,sourceRootMigrationId,sourceReadMigrationId,
 '0012_assignment_drafts','0013_assignment_confirmation','0014_context_preparation','0015_project_baselines','0016_execution_preparation','0017_execution_authority']);
const checksum=(sql:string)=>createHash('sha256').update(sql).digest('hex');
/** 고정 목록과 실경로만 읽는다. import/manifest 생성은 접속·DDL·seed를 수행하지 않는다. */
export async function fn02MethodApplicationManifest(){
 const root=await realpath(new URL('..',import.meta.url));
 if(await realpath(new URL(import.meta.url))!==join(root,'scripts','fn02-method-application-migration.ts')||prerequisiteIds.length!==52||new Set(prerequisiteIds).size!==52)throw Error('FN02_APPLICATION_ROOT_INVALID');
 const expected=new Map<string,string>();let sql='';
 for(const id of [...prerequisiteIds,fn02MethodApplicationMigrationId]){
  const path=join(root,'db','migrations',id+'.sql');if(await realpath(path)!==path)throw Error('FN02_APPLICATION_SQL_ROOT_INVALID');
  const content=await readFile(path,'utf8');if(id===fn02MethodApplicationMigrationId)sql=content;else expected.set(id,checksum(content));
 }
 const candidate=checksum(sql);if(candidate!==candidateChecksum)throw Error('FN02_APPLICATION_SQL_CHANGED');
 return{expected,sql,checksum:candidate};
}
/** 호출자의 검증된 대상·BEGIN/advisory lock 안에서만 소비한다. 누락된 선행을 적용하지 않는다. */
export async function applyFn02MethodApplicationSchemaOnly(db:Pick<Client,'query'>){
 const manifest=await fn02MethodApplicationManifest(),rows=(await db.query('SELECT id,checksum FROM anvil.schema_migrations')).rows as {id:string;checksum:string}[];
 if(!Array.isArray(rows)||new Set(rows.map(row=>row?.id)).size!==rows.length||rows.some(row=>!row||typeof row.id!=='string'||typeof row.checksum!=='string'||!manifest.expected.has(row.id)&&row.id!==fn02MethodApplicationMigrationId)
  ||[...manifest.expected].some(([id,hash])=>rows.find(row=>row.id===id)?.checksum!==hash))throw Error('FN02_APPLICATION_PREREQUISITES_INVALID');
 const previous=rows.find(row=>row.id===fn02MethodApplicationMigrationId);
 if(previous){if(previous.checksum!==manifest.checksum)throw Error('FN02_APPLICATION_CHECKSUM_CONFLICT');return{id:fn02MethodApplicationMigrationId,checksum:manifest.checksum,applied:false};}
 await db.query(manifest.sql);await db.query('INSERT INTO anvil.schema_migrations(id,checksum) VALUES($1,$2)',[fn02MethodApplicationMigrationId,manifest.checksum]);
 return{id:fn02MethodApplicationMigrationId,checksum:manifest.checksum,applied:true};
}
