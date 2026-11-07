import {constants} from 'node:fs';
import {open,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client} from 'pg';
import {validateDevelopmentDbConfig} from '../apps/server/storage/development-config.ts';

/** 자원 획득(open)은 finally 소유권을 먼저 확보한 뒤 검사한다. 그 외 대기는 전후 모두 검사한다. */
export async function schemaProbeStep<T>(fresh:()=>void,action:()=>Promise<T>){fresh();const result=await action();fresh();return result;}

export const developmentSchemaProbeSql=Object.freeze({
 settings:"SET LOCAL statement_timeout='5s';SET LOCAL lock_timeout='1s';SET LOCAL idle_in_transaction_session_timeout='10s'",
 identity:"SELECT current_database() database,current_user role,inet_server_port() port,current_setting('server_version_num')::int version,current_setting('transaction_read_only') read_only,rolsuper superuser,rolbypassrls bypass FROM pg_roles WHERE rolname=current_user",
 manifest:'SELECT id,checksum FROM anvil.schema_migrations ORDER BY id COLLATE "C"',
 objects:"SELECT c.relname name,c.relkind kind,EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='application_command_id' AND a.attnum>0 AND NOT a.attisdropped) application_command_column FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='anvil' AND c.relname IN('assignment_drafts','execution_preparations','agent_sessions','executions','execution_grants','writer_claims','execution_commands','project_methodologies') ORDER BY c.relname COLLATE \"C\""
});
/** SELECT는 migration 기록과 고정 object metadata뿐이다. 사용자 본문·credential 행을 읽지 않는다. */
export async function readDevelopmentSchemaMetadata(db:Pick<Client,'query'>,fresh:()=>void){
 const query=(sql:string)=>schemaProbeStep(fresh,()=>db.query(sql));
 try{
  await query('BEGIN READ ONLY');await query(developmentSchemaProbeSql.settings);const who=(await query(developmentSchemaProbeSql.identity)).rows;
  if(who.length!==1||who[0].database!=='anvil_v3_development'||who[0].role!=='anvil_v3_app'||who[0].port!==5432||!Number.isInteger(who[0].version)||who[0].version<150000||who[0].version>=160000||who[0].read_only!=='on'||who[0].superuser!==false||who[0].bypass!==false)throw Error('SCHEMA_PROBE_IDENTITY_INVALID');
  const migrations=(await query(developmentSchemaProbeSql.manifest)).rows;
  if(migrations.length>1000||new Set(migrations.map(row=>row.id)).size!==migrations.length||migrations.some(row=>typeof row.id!=='string'||!/^[a-z0-9_]{1,128}$/.test(row.id)||typeof row.checksum!=='string'||!/^[0-9a-f]{64}$/.test(row.checksum)))throw Error('SCHEMA_PROBE_MANIFEST_INVALID');
  const objects=(await query(developmentSchemaProbeSql.objects)).rows;
  if(objects.length>8||objects.some(row=>!['assignment_drafts','execution_preparations','agent_sessions','executions','execution_grants','writer_claims','execution_commands','project_methodologies'].includes(row.name)||!['r','p','v','m','f'].includes(row.kind)||typeof row.application_command_column!=='boolean'))throw Error('SCHEMA_PROBE_OBJECT_INVALID');
  if(JSON.stringify((await query(developmentSchemaProbeSql.manifest)).rows)!==JSON.stringify(migrations))throw Error('SCHEMA_PROBE_CHANGED');
  await query('COMMIT');return{database:who[0].database,role:who[0].role,version:who[0].version,readOnly:true,migrations,objects,productRowsRead:0};
 }catch(error){await db.query('ROLLBACK').catch(()=>{});throw error;}
}

const configPath='/home/daon/.local/share/anvil-v3-development/app.json',probeRoot='/home/daon/deploy/anvil-v3-schema-read-probe-01';
async function main(){
 let db:Client|undefined;
 try{
  if(process.argv.length===3&&process.argv[2]==='--plan'){console.log(JSON.stringify({mode:'SCHEMA_METADATA_READ_ONLY',configPath,role:'anvil_v3_app',queries:developmentSchemaProbeSql,dockerStart:0,configReads:0,databaseAccess:0}));return;}
  const until=Date.parse(process.env.ANVIL_SCHEMA_PROBE_UNTIL??''),sha=process.env.ANVIL_SCHEMA_PROBE_SHA??'';
  if(process.argv.length!==3||process.argv[2]!=='--read-only'||process.platform!=='linux'||process.getuid?.()!==1000
   ||!Number.isFinite(until)||until<=Date.now()||until>Date.now()+1200000||!/^[0-9a-f]{40}$/.test(sha)||Object.entries(process.env).some(([name,value])=>value&&(name.startsWith('PG')||['ANVIL_DB_CONFIG','ANVIL_MIGRATOR_CONFIG','NODE_OPTIONS','NODE_PATH'].includes(name))))throw Error('SCHEMA_PROBE_BINDING_INVALID');
  const fresh=()=>{if(Date.now()>=until)throw Error('SCHEMA_PROBE_EXPIRED');};
  const step=<T>(action:()=>Promise<T>)=>schemaProbeStep(fresh,action);
  if(await step(()=>realpath(process.cwd()))!==probeRoot||await step(()=>realpath(new URL(import.meta.url)))!==probeRoot+'/scripts/development-schema-probe.ts')throw Error('SCHEMA_PROBE_BINDING_INVALID');
  const git=(args:string[])=>{fresh();const result=execFileSync('/usr/bin/git',args,{encoding:'utf8',timeout:5000,stdio:['ignore','pipe','pipe']}).trim();fresh();return result;};
  if(git(['rev-parse','HEAD'])!==sha||git(['remote','get-url','origin'])!=='git@github-sinsan-develop:sinsan-develop/Anvil.git'||git(['status','--porcelain'])!=='')throw Error('SCHEMA_PROBE_GIT_INVALID');
  const parent=await step(()=>lstat('/home/daon/.local/share/anvil-v3-development'));if(!parent.isDirectory()||parent.isSymbolicLink()||parent.uid!==1000||(parent.mode&0o077)!==0||await step(()=>realpath('/home/daon/.local/share/anvil-v3-development'))!=='/home/daon/.local/share/anvil-v3-development'||await step(()=>realpath(configPath))!==configPath)throw Error('SCHEMA_PROBE_CONFIG_INVALID');
  fresh();const file=await open(configPath,constants.O_RDONLY|constants.O_NOFOLLOW);let config,configHash;
  try{fresh();const stat=await step(()=>file.stat());if(!stat.isFile()||stat.uid!==1000||stat.nlink!==1||(stat.mode&0o077)!==0||stat.size>8192)throw Error('SCHEMA_PROBE_CONFIG_INVALID');const bytes=await step(()=>file.readFile());configHash=createHash('sha256').update(bytes).digest('hex');config=validateDevelopmentDbConfig(JSON.parse(bytes.toString('utf8')),'app');}finally{await file.close();}
  fresh();db=new Client({...config,statement_timeout:5000,query_timeout:5000});await step(()=>db!.connect());const observed=await readDevelopmentSchemaMetadata(db,fresh);fresh();
  console.log(JSON.stringify({status:'OBSERVED_METADATA_ONLY',sourceSha:sha,configHash,...observed}));
 }catch(error){const reason=(error as any)?.message;console.log(JSON.stringify({status:'FAIL',reason:typeof reason==='string'&&/^SCHEMA_PROBE_[A-Z_]+$/.test(reason)?reason:'SCHEMA_PROBE_FAILED'}));process.exitCode=1;}
 finally{await db?.end().catch(()=>{process.exitCode=1;});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
