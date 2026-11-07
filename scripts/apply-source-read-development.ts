import {readFile,realpath,lstat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {Client} from 'pg';
import {canonicalJson,contentHash} from '../contracts/canonical.ts';
import {validateDevelopmentDbConfig} from '../apps/server/storage/development-config.ts';
import {sourceReadMigrationId,sourceReadMigrationRoot,sourceReadMigrationManifest,applySourceReadSchemaOnly} from './source-read-migration.ts';
import {readSourceReadDevelopmentBinding,assertSourceReadDevelopmentManifest,assertSourceReadDevelopmentBaseline,sourceReadDevelopmentTables,sourceReadDevelopmentFailureDisposition,sourceReadDevelopmentStep,type SourceReadTableState} from './source-read-development-guard.ts';

let db:Client|null=null,post:Client|null=null,committed=false,commitAttempted=false,connected=false,phase='PREFLIGHT';
let result:Record<string,unknown>={};
let operationExpiry=NaN;
const permittedErrors=new Set(['SOURCE_READ_DEVELOPMENT_MODE_REQUIRED','SOURCE_READ_DEVELOPMENT_BINDING_INVALID','SOURCE_READ_DEVELOPMENT_MANIFEST_INVALID','SOURCE_READ_DEVELOPMENT_BASELINE_INVALID','SOURCE_READ_DEVELOPMENT_CONFIG_INVALID','SOURCE_READ_DEVELOPMENT_ROOT_INVALID','SOURCE_READ_DEVELOPMENT_HASH_INVALID','SOURCE_READ_DEVELOPMENT_IDENTITY_INVALID','SOURCE_READ_DEVELOPMENT_EXPIRED','SOURCE_READ_DEVELOPMENT_ALREADY_APPLIED','SOURCE_READ_LEGACY_MIGRATION_CONFLICT','SOURCE_READ_MIGRATION_CHECKSUM_CONFLICT']);
const env=process.env;
permittedErrors.add('SOURCE_READ_DEVELOPMENT_STEP_TIMEOUT');
const git=(args:string[])=>execFileSync('git',args,{encoding:'utf8',timeout:5000,stdio:['ignore','pipe','pipe']}).trim();
const q=(client:Client,sql:string,values?:unknown[])=>sourceReadDevelopmentStep(()=>client.query(sql,values),operationExpiry);
const checkExpiry=(expiry:number)=>{if(Date.now()>=expiry)throw Error('SOURCE_READ_DEVELOPMENT_EXPIRED');};
async function configure(client:Client){
 const identity=(await q(client,'SELECT current_database() name,current_user username,inet_server_port() port')).rows[0];
 if(identity?.name!=='anvil_v3_development'||identity.username!=='anvil_v3_migrator'||identity.port!==5432)throw Error('SOURCE_READ_DEVELOPMENT_IDENTITY_INVALID');
 await q(client,"SET TIME ZONE 'UTC'; SET statement_timeout='30s'; SET lock_timeout='5s'; SET idle_in_transaction_session_timeout='60s'");
}
async function states(client:Client):Promise<SourceReadTableState[]>{
 const tables=(await q(client,"SELECT n.nspname schema,c.relname name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('anvil','anvil_qa') AND c.relkind='r' ORDER BY n.nspname,c.relname")).rows;
 const result:SourceReadTableState[]=[];
 for(const table of tables){
  if(!['anvil','anvil_qa'].includes(table.schema)||!/^[a-z0-9_]+$/.test(table.name))throw Error('SOURCE_READ_DEVELOPMENT_BASELINE_INVALID');
  const target='"'+table.schema+'"."'+table.name+'"';
  const data=(await q(client,`SELECT count(*)::text n,md5(COALESCE(string_agg(to_jsonb(row)::text,E'\\n' ORDER BY to_jsonb(row)::text),'')) fingerprint FROM ${target} row`)).rows[0];
  const structure=(await q(client,`SELECT c.relacl::text acl,
   (SELECT jsonb_agg(jsonb_build_object('n',a.attname,'t',format_type(a.atttypid,a.atttypmod),'required',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) columns,
   (SELECT jsonb_agg(pg_get_constraintdef(k.oid) ORDER BY k.conname) FROM pg_constraint k WHERE k.conrelid=c.oid) constraints,
   (SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY i.indexrelid::regclass::text) FROM pg_index i WHERE i.indrelid=c.oid) indexes,
   (SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal) triggers
   FROM pg_class c WHERE c.oid=$1::regclass`,[target])).rows[0];
  result.push({...table,n:String(data.n),fingerprint:data.fingerprint,structureHash:contentHash(canonicalJson(structure))});
 }
 return result;
}
try{
 const args=process.argv.slice(2);
 if(args.length!==1||!['--plan','--apply-schema-only'].includes(args[0]!))throw Error('SOURCE_READ_DEVELOPMENT_MODE_REQUIRED');
 if(args[0]==='--plan'){
  result={mode:'SOURCE_READ_SCHEMA_ONLY',database:'anvil_v3_development',migration:sourceReadMigrationId,oldMigrations:45,appliedMigrations:46,newTables:sourceReadDevelopmentTables,databaseAccess:0,secretReads:0,fixtures:0,usersCreated:0,serviceChanges:0,rollback:'TRANSACTION_BEFORE_COMMIT_FORWARD_REPAIR_AFTER_COMMIT'};
 }else{
  // 승인 자체를 발급하지 않는다. 별도 PMO 결정과 정확 후보를 대조한 실행자만 값을 전달한다.
  const partial={platform:process.platform,uid:process.getuid?.(),cwd:process.cwd(),head:env.ANVIL_A3_APPLY_COMMIT??'',origin:'git@github-sinsan-develop:sinsan-develop/Anvil.git',dirty:'',configPath:env.ANVIL_DB_CONFIG??'',approval:env.ANVIL_A3_APPLY_APPROVAL??'',commit:env.ANVIL_A3_APPLY_COMMIT??'',sqlHash:env.ANVIL_A3_APPROVED_SQL_SHA256??'',expiresAt:env.ANVIL_A3_APPLY_EXPIRES_AT??''};
  readSourceReadDevelopmentBinding(partial,Date.now()); // OS/marker/기한 거절은 Git·Secret 읽기보다 먼저.
  const binding=readSourceReadDevelopmentBinding({...partial,cwd:await realpath(process.cwd()),head:git(['rev-parse','HEAD']),origin:git(['remote','get-url','origin']),dirty:git(['status','--porcelain'])},Date.now());
  operationExpiry=binding.expiresAtMs;
  if(await sourceReadMigrationRoot()!==partial.cwd)throw Error('SOURCE_READ_DEVELOPMENT_ROOT_INVALID');
  const manifest=await sourceReadMigrationManifest();
  if(manifest.checksum!==binding.sqlHash)throw Error('SOURCE_READ_DEVELOPMENT_HASH_INVALID');
  const file=await lstat(partial.configPath);
  if(!file.isFile()||file.isSymbolicLink()||file.uid!==1000||(file.mode&0o077)!==0||await realpath(partial.configPath)!==partial.configPath)throw Error('SOURCE_READ_DEVELOPMENT_CONFIG_INVALID');
  checkExpiry(binding.expiresAtMs);
  const config=validateDevelopmentDbConfig(JSON.parse(await sourceReadDevelopmentStep(()=>readFile(partial.configPath,'utf8'),operationExpiry,5000)),'migrator');
  checkExpiry(binding.expiresAtMs);phase='CONNECT';db=new Client(config);await sourceReadDevelopmentStep(()=>db!.connect(),operationExpiry,5000);connected=true;await configure(db);
  phase='BASELINE';await q(db,'BEGIN ISOLATION LEVEL REPEATABLE READ');await q(db,"SELECT pg_advisory_xact_lock(hashtext('anvil-v3-migrations'))");
  assertSourceReadDevelopmentManifest((await q(db,'SELECT id,checksum FROM anvil.schema_migrations')).rows,manifest.expected,manifest.checksum,'BEFORE');
  const before=await states(db);
  if(before.some(t=>t.schema==='anvil'&&sourceReadDevelopmentTables.includes(t.name)))throw Error('SOURCE_READ_DEVELOPMENT_ALREADY_APPLIED');
  phase='APPLY_NEW_SCHEMA';checkExpiry(binding.expiresAtMs);
  const migration=await applySourceReadSchemaOnly({query:(sql:string,values?:unknown[])=>q(db!,sql,values)} as Pick<Client,'query'>);if(!migration.applied)throw Error('SOURCE_READ_DEVELOPMENT_ALREADY_APPLIED');
  phase='VERIFY_IN_TRANSACTION';assertSourceReadDevelopmentBaseline(before,await states(db));
  assertSourceReadDevelopmentManifest((await q(db,'SELECT id,checksum FROM anvil.schema_migrations')).rows,manifest.expected,manifest.checksum,'AFTER');
  checkExpiry(binding.expiresAtMs);phase='COMMIT_SCHEMA';commitAttempted=true;await q(db,'COMMIT');committed=true;
  phase='VERIFY_AFTER_COMMIT';checkExpiry(binding.expiresAtMs);
  post=new Client(config);await sourceReadDevelopmentStep(()=>post!.connect(),operationExpiry,5000);await configure(post);await q(post,'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assertSourceReadDevelopmentBaseline(before,await states(post));
  assertSourceReadDevelopmentManifest((await q(post,'SELECT id,checksum FROM anvil.schema_migrations')).rows,manifest.expected,manifest.checksum,'AFTER');
  await q(post,'COMMIT');
  result={status:'PASS',commit:binding.commit,migration,legacyMigrations:45,appliedMigrations:46,existingTables:before.length,legacyBaselineHash:contentHash(canonicalJson(before)),newTables:sourceReadDevelopmentTables,newTableRows:0,seeded:0,usersCreated:0,serviceChanges:0,sourceFileAccess:0,actualAgentCalls:0,actualHttpTls:false};
 }
}catch(error){
 const disposition=sourceReadDevelopmentFailureDisposition(committed,commitAttempted);
 let rollbackConfirmed=false;
 if(db&&disposition.action==='ROLLBACK_TRANSACTION'){
  try{await q(db,'ROLLBACK');rollbackConfirmed=true;}catch{}
 }
 const e=error as {message?:unknown;code?:unknown;position?:unknown};
 result={status:'FAIL',phase,...disposition,rollbackConfirmed,databaseConnected:connected,failure:typeof e.message==='string'&&permittedErrors.has(e.message)?e.message:'SOURCE_READ_DEVELOPMENT_STEP_FAILED',pgCode:typeof e.code==='string'&&/^[0-9A-Z]{5}$/.test(e.code)?e.code:null,sqlPosition:typeof e.position==='string'&&/^\d+$/.test(e.position)?e.position:null};
 process.exitCode=1;
}finally{
 for(const client of [post,db])if(client){
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{await Promise.race([client.end(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('CONNECTION_CLOSE_TIMEOUT')),5000);})]);}
  catch{result={...result,status:'FAIL',connectionCloseFailure:true,...sourceReadDevelopmentFailureDisposition(committed,commitAttempted)};process.exitCode=1;}
  finally{if(timer)clearTimeout(timer);}
 }
}
console.log(JSON.stringify(result));
