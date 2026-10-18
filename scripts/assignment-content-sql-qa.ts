import { readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { contentHash } from '../contracts/canonical.ts';
import { buildAssignmentDraftSqlQa, assignmentDraftMigrationId, assignmentDraftSqlQaResource } from './assignment-draft-sql-qa.ts';
import { legacyMigrationIds, sourceRootMigrationId } from './source-root-migration.ts';
import { sourceReadMigrationId } from './source-read-migration.ts';
import { sourceReadPsqlText as quote } from './source-read-psql-batches.ts';

export const assignmentContentQaResource = Object.freeze({ ...assignmentDraftSqlQaResource, container:'anvil-v3-fn09-content-sql-qa-pg-02',network:'anvil-v3-fn09-content-sql-qa-net-02',database:'anvil_v3_fn09_content_qa_02' });
export const assignmentContentWorkflowQaResource=Object.freeze({...assignmentContentQaResource,container:'anvil-v3-fn09-content-workflow-pg-03',network:'anvil-v3-fn09-content-workflow-net-03',database:'anvil_v3_fn09_content_workflow_qa_03',port:5547,hostPublish:true,artifactRoot:'/tmp/anvil-v3-fn09-content-workflow-03'});
export const assignmentContentMigrationId='0013_assignment_confirmation';
const check=(expression:string,code:string)=>`DO $contentcheck$ BEGIN IF (${expression}) IS DISTINCT FROM TRUE THEN RAISE EXCEPTION '${code}' USING ERRCODE='P0001';END IF;END $contentcheck$;`;
export function assertAssignmentContentQaBinding(input:{platform:string;uid:number;cwd:string;module:string;head:string;commit:string;dirty:string;remote:string;sqlHash:string;expiresAt:string;env:NodeJS.ProcessEnv},now=Date.now()){
  const until=Date.parse(input.expiresAt);
  if(input.platform!=='linux'||input.uid!==1000||input.cwd!=='/home/daon/deploy/anvil-v3'||input.module!==input.cwd+'/scripts/qa-assignment-content-sql.ts'||!/^[0-9a-f]{40}$/.test(input.commit)||input.head!==input.commit||input.dirty!==''||input.remote!=='git@github-sinsan-develop:sinsan-develop/Anvil.git'||!/^[0-9a-f]{64}$/.test(input.sqlHash)||!Number.isFinite(until)||until<=now||until>now+1200000||Object.entries(input.env).some(([k,v])=>!!v&&(k.startsWith('DOCKER_')||['ANVIL_DB_CONFIG','ANVIL_MIGRATOR_CONFIG'].includes(k))))throw Error('CONTENT_QA_BINDING_INVALID');
  return until;
}
/** 새 빈 격리 PG용 SQL만 준비한다. 정식 DB/config·실행 runner를 호출하지 않는다. */
export async function buildAssignmentContentSqlQa(workflow=false){
  const resource=workflow?assignmentContentWorkflowQaResource:assignmentContentQaResource;
  const base=await buildAssignmentDraftSqlQa(),root=await realpath(new URL('..',import.meta.url)),ids=[...legacyMigrationIds,sourceRootMigrationId,sourceReadMigrationId,assignmentDraftMigrationId,assignmentContentMigrationId];
  if(base.migrations!==47||ids.length!==48||new Set(ids).size!==48||base.sqlHash!=='1120676ce1df7a086d374adb5c81356d7ab2c12ef6e07c8ce66c36b4c57a7133')throw Error('CONTENT_QA_BASELINE_INVALID');
  const manifest=[];let sql='';for(const id of ids){const path=join(root,'db','migrations',id+'.sql');if(await realpath(path)!==path)throw Error('CONTENT_QA_SQL_LINK');const bytes=await readFile(path);manifest.push({id,checksum:contentHash(bytes)});if(id===assignmentContentMigrationId)sql=bytes.toString('utf8');}
  const sqlHash=manifest.find(m=>m.id===assignmentContentMigrationId)!.checksum;
  const schema=base.schema.slice(0,base.schema.lastIndexOf('COMMIT;')).replaceAll('anvil_v3_fn09_draft_qa',resource.database)+sql+'\n;\nINSERT INTO anvil.schema_migrations(id,checksum) VALUES('+quote(assignmentContentMigrationId)+','+quote(sqlHash)+');\nCOMMIT;\nSELECT \'CONTENT_SCHEMA_48\';';
  manifest.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const target=check(`current_database()='${resource.database}' AND current_user='anvil_v3_app' AND current_setting('is_superuser')='off' AND current_setting('server_version_num')::int BETWEEN 150000 AND 159999`,'CONTENT_QA_EXACT_TARGET_REQUIRED');
  let readOnly="BEGIN READ ONLY;SET LOCAL statement_timeout='10s';SET LOCAL lock_timeout='2s';"+target+check('(SELECT jsonb_agg(jsonb_build_object(\'id\',id,\'checksum\',checksum) ORDER BY id COLLATE "C") FROM anvil.schema_migrations)='+quote(JSON.stringify(manifest))+'::jsonb','CONTENT_QA_MANIFEST_MISMATCH');
  for(const table of ['assignment_content_reviews','assignment_versions'])readOnly+=check(`(SELECT count(*) FROM anvil.${table})=0 AND has_table_privilege(current_user,'anvil.${table}','SELECT') AND has_table_privilege(current_user,'anvil.${table}','INSERT') AND NOT has_table_privilege(current_user,'anvil.${table}','UPDATE') AND NOT has_table_privilege(current_user,'anvil.${table}','DELETE')`,'CONTENT_QA_ACL_OR_ROWS_INVALID');
  for(const [expression,expected] of [["''",false],["chr(160)||chr(65279)||chr(8232)",false],["'정상 검토'",true],["repeat(chr(128512),10000)",true],["repeat(chr(128512),10001)",false],["repeat('a',20000)",true],["repeat('a',20001)",false],["chr(160)||'검토'||chr(160)",true]] as const)readOnly+=check(`anvil.assignment_content_reason(${expression}) IS ${expected?'TRUE':'FALSE'}`,'CONTENT_QA_UTF16_REASON_MISMATCH');
  readOnly+="COMMIT;SELECT 'CONTENT_READ_ONLY_48_ACL_UTF16_8';";
  let denied="BEGIN;SET LOCAL statement_timeout='10s';SET LOCAL lock_timeout='2s';"+target;
  for(const table of ['assignment_content_reviews','assignment_versions']){
    const columns=table==='assignment_content_reviews'?'project_id,review_id,draft_id,draft_version,draft_hash,content_hash,review_json,created_by,client_id,command_id':'project_id,assignment_id,version,content_hash,version_json,created_by,client_id,command_id,confirmation_id';
    const value=table==='assignment_content_reviews'?"'a6f20920-0000-4000-8000-000000000201','a6f20920-0000-4000-8000-000000000301','a6f20920-0000-4000-8000-000000000401',1,repeat('a',64),repeat('b',64),'{}','a6f20920-0000-4000-8000-000000000101','a6f20920-0000-4000-8000-000000000102','a6f20920-0000-4000-8000-000000000501'":"'a6f20920-0000-4000-8000-000000000201','a6f20920-0000-4000-8000-000000000401',1,repeat('b',64),'{\"contentConfirmed\":true,\"ready\":false,\"executionAuthorized\":false,\"dispatchPerformed\":false}','a6f20920-0000-4000-8000-000000000101','a6f20920-0000-4000-8000-000000000102','a6f20920-0000-4000-8000-000000000501','a6f20920-0000-4000-8000-000000000601'";
    denied+=`DO $contentdeny$ BEGIN BEGIN INSERT INTO anvil.${table}(${columns}) VALUES(${value});RAISE EXCEPTION 'CONTENT_QA_UNAUTHORIZED_ACCEPTED' USING ERRCODE='P0001';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $contentdeny$;`+check(`(SELECT count(*) FROM anvil.${table})=0`,'CONTENT_QA_DENIED_ROWS_REMAIN');
  }
  denied+="ROLLBACK;SELECT 'CONTENT_UNAUTHORIZED_2_DENIED';";
  return{schema,readOnly,denied,sqlHash,migrations:48,actualWorkflowVerified:false,formalDbChanges:0};
}
