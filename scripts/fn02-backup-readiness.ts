import {schemaProbeStep} from './development-schema-probe.ts';
import {constants} from 'node:fs';
import {open,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client} from 'pg';
import {validateDevelopmentDbConfig} from '../apps/server/storage/development-config.ts';

// 새 정확 읽기 결정 전 로컬/fake 검수만 허용한 caller 후보다. 서비스/runner 등록·backup/DDL 경로는 없다.
export const fn02BackupReadinessSql=Object.freeze({
 settings:"SET LOCAL statement_timeout='5s';SET LOCAL lock_timeout='1s';SET LOCAL idle_in_transaction_session_timeout='10s'",
 identity:"SELECT current_database() db,current_user role,current_setting('server_version_num')::int version,current_setting('transaction_read_only') read_only,rolsuper superuser,rolbypassrls bypass,rolcreatedb createdb,rolcreaterole createrole FROM pg_roles WHERE rolname=current_user",
 size:'SELECT pg_database_size(current_database())::text bytes',
 sessions:"SELECT count(*)::int others,count(*) FILTER(WHERE state='active')::int active,count(*) FILTER(WHERE state IS NULL)::int unknown FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()",
 tables:"SELECT count(*)::int tables,count(*) FILTER(WHERE pg_get_userbyid(c.relowner)<>current_user)::int non_owned,count(*) FILTER(WHERE NOT has_table_privilege(current_user,c.oid,'SELECT'))::int unreadable,count(*) FILTER(WHERE c.relrowsecurity OR c.relforcerowsecurity)::int rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('anvil','anvil_qa') AND c.relkind IN('r','p')",
});
type MetadataDb={query:(sql:string)=>Promise<{rows:Record<string,unknown>[]}>};
const nonnegative=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;

/** metadata 관측일 뿐 dump·복원·권한 능력을 인증하지 않는다. query 본문·계정 행은 선택하지 않는다. */
export async function readFn02BackupReadiness(db:MetadataDb,fresh:()=>void){
 const query=(sql:string)=>schemaProbeStep(fresh,()=>db.query(sql));
 const one=async(sql:string)=>{const r=await query(sql);if(!Array.isArray(r.rows)||r.rows.length!==1||!r.rows[0]||typeof r.rows[0]!=='object')throw Error('FN02_READINESS_METADATA_INVALID');return r.rows[0];};
 try{
  await query('BEGIN READ ONLY');await query(fn02BackupReadinessSql.settings);
  const who=await one(fn02BackupReadinessSql.identity);
  if(who.db!=='anvil_v3_development'||who.role!=='anvil_v3_migrator'||!nonnegative(who.version)||who.version<150000||who.version>=160000||who.read_only!=='on'||who.superuser!==false||who.bypass!==false||who.createdb!==false||who.createrole!==false)throw Error('FN02_READINESS_IDENTITY_INVALID');
  const size=await one(fn02BackupReadinessSql.size);
  if(typeof size.bytes!=='string'||!/^(0|[1-9][0-9]{0,18})$/.test(size.bytes)||BigInt(size.bytes)>9223372036854775807n)throw Error('FN02_READINESS_METADATA_INVALID');
  const sessions=await one(fn02BackupReadinessSql.sessions),tables=await one(fn02BackupReadinessSql.tables);
  if(![sessions.others,sessions.active,sessions.unknown,tables.tables,tables.non_owned,tables.unreadable,tables.rls].every(nonnegative)
   ||(sessions.active as number)+(sessions.unknown as number)>(sessions.others as number)||[tables.non_owned,tables.unreadable,tables.rls].some(n=>(n as number)>(tables.tables as number)))throw Error('FN02_READINESS_METADATA_INVALID');
  await query('COMMIT');fresh();
  return{kind:'BACKUP_READINESS_METADATA_ONLY',databaseBytes:size.bytes,otherConnections:sessions.others,activeConnections:sessions.active,unknownConnections:sessions.unknown,tables:tables.tables,nonOwnedTables:tables.non_owned,unreadableTables:tables.unreadable,rlsTables:tables.rls,dumpCapability:'UNVERIFIED',executionAllowed:false};
 }catch(error){await db.query('ROLLBACK').catch(()=>{});throw error;}
}

const root='/home/daon/deploy/anvil-v3-fn02-readiness-01',protectedRoot='/home/daon/.local/share/anvil-v3-development',configPath=protectedRoot+'/migrator.json';
async function main(){
 let db:Client|undefined,result:Record<string,unknown>={status:'FAIL',reason:'FN02_READINESS_NOT_STARTED'},fresh=()=>{};
 try{
  if(process.argv.length===3&&process.argv[2]==='--plan'){console.log(JSON.stringify({mode:'FN02_BACKUP_READINESS_METADATA_ONLY',root,configPath,role:'anvil_v3_migrator',queries:fn02BackupReadinessSql,databaseConnections:0,configReads:0,backupOrDdlEnabled:false}));return;}
  const until=Date.parse(process.env.ANVIL_FN02_READINESS_UNTIL??''),sha=process.env.ANVIL_FN02_READINESS_SHA??'';
  if(process.argv.length!==3||process.argv[2]!=='--read-only'||process.platform!=='linux'||process.getuid?.()!==1000||!Number.isFinite(until)||until<=Date.now()||until>Date.now()+600000||!/^[0-9a-f]{40}$/.test(sha)||Object.entries(process.env).some(([name,value])=>value&&(name.startsWith('PG')||['ANVIL_DB_CONFIG','ANVIL_MIGRATOR_CONFIG','NODE_OPTIONS','NODE_PATH'].includes(name))))throw Error('FN02_READINESS_BINDING_INVALID');
  fresh=()=>{if(Date.now()>=until)throw Error('FN02_READINESS_EXPIRED');};const step=<T>(action:()=>Promise<T>)=>schemaProbeStep(fresh,action);
  if(await step(()=>realpath(process.cwd()))!==root||await step(()=>realpath(new URL(import.meta.url)))!==root+'/scripts/fn02-backup-readiness.ts'||await step(()=>realpath(process.execPath))!=='/opt/node-v24.21.0-linux-x64/bin/node')throw Error('FN02_READINESS_ROOT_INVALID');
  const git=(args:string[])=>{fresh();const value=execFileSync('/usr/bin/git',args,{encoding:'utf8',timeout:5000,stdio:['ignore','pipe','pipe']}).trim();fresh();return value;};
  if(git(['rev-parse','HEAD'])!==sha||git(['remote','get-url','origin'])!=='git@github-sinsan-develop:sinsan-develop/Anvil.git'||git(['status','--porcelain'])!=='')throw Error('FN02_READINESS_GIT_INVALID');
  const parent=await step(()=>lstat(protectedRoot));if(!parent.isDirectory()||parent.isSymbolicLink()||parent.uid!==1000||(parent.mode&0o077)!==0||await step(()=>realpath(protectedRoot))!==protectedRoot||await step(()=>realpath(configPath))!==configPath)throw Error('FN02_READINESS_CONFIG_INVALID');
  fresh();const file=await open(configPath,constants.O_RDONLY|constants.O_NOFOLLOW);let config,configHash;
  try{fresh();const s=await step(()=>file.stat());if(!s.isFile()||s.uid!==1000||s.nlink!==1||(s.mode&0o077)!==0||s.size<=0||s.size>8192)throw Error('FN02_READINESS_CONFIG_INVALID');const bytes=await step(()=>file.readFile());configHash=createHash('sha256').update(bytes).digest('hex');config=validateDevelopmentDbConfig(JSON.parse(bytes.toString('utf8')),'migrator');}finally{await file.close();}
  fresh();db=new Client({...config,statement_timeout:5000,query_timeout:5000});await step(()=>db!.connect());const observed=await readFn02BackupReadiness(db,fresh);fresh();result={status:'OBSERVED_READINESS_METADATA_ONLY',sourceSha:sha,configHash,...observed};
 }catch(error){const reason=(error as {message?:unknown})?.message;result={status:'FAIL',reason:typeof reason==='string'&&/^FN02_READINESS_[A-Z_]+$/.test(reason)?reason:'FN02_READINESS_FAILED'};process.exitCode=1;}
 finally{
  if(db){let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([db.end(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('END_TIMEOUT')),5000);})]);}catch{result={status:'FAIL',reason:'FN02_READINESS_CLOSE_FAILED'};process.exitCode=1;}finally{if(timer)clearTimeout(timer);}}
 }
 try{fresh();}catch{result={status:'FAIL',reason:'FN02_READINESS_EXPIRED'};process.exitCode=1;}
 console.log(JSON.stringify(result));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
