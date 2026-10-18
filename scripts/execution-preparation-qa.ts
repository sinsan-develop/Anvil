import { readFile, realpath, lstat, readdir, unlink, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { contentHash } from '../contracts/canonical.ts';
import { legacyMigrationIds, sourceRootMigrationId } from './source-root-migration.ts';
import { sourceReadMigrationId } from './source-read-migration.ts';
import { sourceReadPsqlText } from './source-read-psql-batches.ts';

export const executionPreparationQa=Object.freeze({runId:'c1-prep-sql-20261019-01',owner:'AV3_C1_PREPARATION_SQL_QA',cwd:'/home/daon/deploy/anvil-v3-c1-prep-sql-qa-01',artifactRoot:'/tmp/anvil-v3-c1-prep-sql-01',container:'anvil-v3-c1-prep-sql-pg-01',network:'anvil-v3-c1-prep-sql-net-01',database:'anvil_v3_c1_prep_sql_qa_01',image:'postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425',imageId:'sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f',daemonId:'e3349f1d-dbfc-478a-96d9-295bf6c6839e',port:null,hostPublish:false,tmpfsBytes:268435456,maxMs:1200000});
export const executionPreparationQaMayCleanup=(creating:boolean)=>creating===true;
export function executionPreparationQaSqlDiagnostic(error:unknown) {
  const e=error as any,stderr=String(e?.stderr??''),line=Number(/psql:<stdin>:(\d+):/.exec(stderr)?.[1]);
  return {pgCode:/(?:ERROR|FATAL):\s+([A-Z0-9]{5})(?:\s|$)/.exec(stderr)?.[1]??null,line:Number.isSafeInteger(line)&&line>0?line:null,exitCode:Number.isInteger(e?.status)?e.status:null,timedOut:e?.code==='ETIMEDOUT'};
}
export function executionPreparationQaRemaining(deadline:number,now=Date.now(),margin=120000) {
  const remaining=deadline-now-margin;if(!Number.isFinite(remaining)||remaining<=0)throw Error('C1_QA_EXPIRED');return remaining;
}
export function executionPreparationQaInsert(table:string,columns:{column_name:string;is_generated:string}[]) {
  if(!['project_roles','agent_sessions','role_bindings','execution_preparations'].includes(table))throw Error('C1_QA_TABLE_INVALID');
  const names=columns.filter(c=>c.is_generated==='NEVER').map(c=>c.column_name);
  if(!names.length||names.some(n=>!/^[a-z_]+$/.test(n)))throw Error('C1_QA_COLUMNS_INVALID');
  const list=names.join(',');return 'INSERT INTO anvil.'+table+'('+list+') SELECT '+list+' FROM anvil.'+table+' LIMIT 1';
}
/** 연결을 기다린 뒤에도 각 query 효과 직전에 검사한다. 정리는 rollback만 별도 허용한다. */
export function executionPreparationQaDatabase<T extends object>(value:T,before:()=>void):T {
  return new Proxy(value,{get(target,key){const member:any=Reflect.get(target,key,target);
    if(key==='query')return(...args:any[])=>{if(args[0]!=='ROLLBACK')before();return Reflect.apply(member,target,args);};
    if(key==='connect')return async(...args:any[])=>{before();return executionPreparationQaDatabase(await Reflect.apply(member,target,args) as object,before);};
    return typeof member==='function'?member.bind(target):member;
  }});
}
export function assertExecutionPreparationQaResource(item:any,kind:'container'|'network',id:string,instance:string,networkId:string|null) {
  const qa=executionPreparationQa,labels=kind==='container'?item?.Config?.Labels:item?.Labels;
  if(!/^[0-9a-f]{64}$/.test(id)||item?.Id!==id||labels?.['anvil.project']!=='v3'||labels?.['anvil.owner']!==qa.owner||labels?.['anvil.instance']!==instance||labels?.['anvil.runId']!==qa.runId||item.Name!==(kind==='container'?'/'+qa.container:qa.network))throw Error('C1_QA_OWNERSHIP_INVALID');
  if(kind==='network'){if(item.Internal!==true)throw Error('C1_QA_NETWORK_INVALID');return;}
  const networks=item?.NetworkSettings?.Networks,ports=item?.NetworkSettings?.Ports;
  if(item.Image!==qa.imageId||!Array.isArray(item.Mounts)||item.Mounts.length||item.HostConfig?.Tmpfs?.['/var/lib/postgresql/data']!=='rw,noexec,nosuid,size=268435456'||Object.keys(item.HostConfig?.Tmpfs??{}).length!==1
    ||item.HostConfig?.PublishAllPorts!==false||Object.keys(item.HostConfig?.PortBindings??{}).length||!ports||Object.keys(ports).length!==1||ports['5432/tcp']!==null
    ||!networkId||!networks||Object.keys(networks).length!==1||networks[qa.network]?.NetworkID!==networkId)throw Error('C1_QA_CONFIGURATION_INVALID');
}
export async function cleanExecutionPreparationQaRoot() {
  const root=executionPreparationQa.artifactRoot,top=await lstat(root);
  if(top.isSymbolicLink()||!top.isDirectory()||top.uid!==1000||(top.mode&0o777)!==0o700||await realpath(root)!==root)throw Error('C1_QA_ROOT_IDENTITY_INVALID');
  const files:{path:string;hash:string}[]=[],dirs:string[]=[];
  async function collect(path:string){for(const entry of await readdir(path,{withFileTypes:true})){const full=join(path,entry.name),item=await lstat(full);if(!full.startsWith(root+'/')||item.isSymbolicLink()||item.uid!==1000||files.length+dirs.length>2000)throw Error('C1_QA_ROOT_CONTENT_INVALID');if(item.isDirectory()){await collect(full);dirs.push(full);}else{if(!item.isFile()||item.size>20*1024*1024)throw Error('C1_QA_ROOT_CONTENT_INVALID');files.push({path:full,hash:contentHash(await readFile(full))});}}}
  await collect(root);for(const file of files){if(contentHash(await readFile(file.path))!==file.hash)throw Error('C1_QA_ROOT_CHANGED');await unlink(file.path);}for(const dir of dirs)await rmdir(dir);await rmdir(root);return files.length;
}
export function assertExecutionPreparationQaBinding(value:{platform:string;uid:number;cwd:string;module:string;head:string;commit:string;dirty:string;remote:string;sqlHash:string;actualSqlHash:string;expiresAt:string;env:NodeJS.ProcessEnv},now=Date.now()) {
  const until=Date.parse(value.expiresAt);
  if(value.platform!=='linux'||value.uid!==1000||value.cwd!==executionPreparationQa.cwd||value.module!==executionPreparationQa.cwd+'/scripts/qa-execution-preparation.ts'
    ||!/^[0-9a-f]{40}$/.test(value.commit)||value.head!==value.commit||value.dirty!==''||value.remote!=='git@github-sinsan-develop:sinsan-develop/Anvil.git'
    ||!/^[0-9a-f]{64}$/.test(value.sqlHash)||value.actualSqlHash!==value.sqlHash||!Number.isFinite(until)||until<=now||until>now+executionPreparationQa.maxMs
    ||Object.entries(value.env).some(([name,item])=>!!item&&(name.startsWith('DOCKER_')||name.startsWith('PG')||['ANVIL_DB_CONFIG','ANVIL_MIGRATOR_CONFIG','NODE_OPTIONS','NODE_PATH'].includes(name))))throw Error('C1_QA_BINDING_INVALID');
  return until;
}
/** 현재 Git 후보의 51개 SQL을 새 빈 격리에만 준비한다. 정식 DB/config·migration runner를 호출하지 않는다. */
export async function buildExecutionPreparationQaSchema() {
  const root=await realpath(new URL('..',import.meta.url)),ids=[...legacyMigrationIds,sourceRootMigrationId,sourceReadMigrationId,'0012_assignment_drafts','0013_assignment_confirmation','0014_context_preparation','0015_project_baselines','0016_execution_preparation'];
  if(ids.length!==51||new Set(ids).size!==51)throw Error('C1_QA_MIGRATION_SET_INVALID');
  let schema="BEGIN;SET LOCAL statement_timeout='20s';SET LOCAL lock_timeout='2s';";
  const manifest:{id:string;checksum:string}[]=[];
  for(const id of ids){const path=join(root,'db','migrations',id+'.sql');if(await realpath(path)!==path)throw Error('C1_QA_SQL_LINK_REJECTED');const sql=await readFile(path,'utf8'),checksum=contentHash(sql);manifest.push({id,checksum});schema+=sql+'\n;\nINSERT INTO anvil.schema_migrations(id,checksum) VALUES('+sourceReadPsqlText(id)+','+sourceReadPsqlText(checksum)+');\n';}
  schema+="COMMIT;SELECT 'C1_SCHEMA_51_COMMITTED';";
  return {schema,manifest,sqlHash:manifest.find(item=>item.id==='0016_execution_preparation')!.checksum};
}
