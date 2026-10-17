import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {realpath,stat} from 'node:fs/promises';
import {sourceReadMigrationManifest,sourceReadMigrationRoot} from './source-read-migration.ts';
import {assertSourceReadQaDaemon,sourceReadQaError} from './source-read-qa-guard.ts';
import {assertSourceReadPsqlBindings,assertSourceReadPsqlContainer} from './source-read-psql-guard.ts';
import {buildSourceReadPsqlBatches,readSourceReadPsqlResult,sourceReadPsqlError} from './source-read-psql-batches.ts';

const resource={container:'anvil-v3-a3-read-psql-qa-pg',network:'anvil-v3-a3-read-psql-qa-net',database:'anvil_v3_a3_read_qa',port:null,hostPublish:false,transport:'DOCKER_EXEC_PSQL_CONTAINER_TCP_LOOPBACK',image:'postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425',imageId:'sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f'};
if(process.argv.length!==3||!['--plan','--run'].includes(process.argv[2]!))throw Error('QA_MODE_REQUIRED');
if(process.argv[2]==='--plan')console.log(JSON.stringify({...resource,scope:'SCHEMA_AND_SQL_VECTORS_ONLY',previousMigrationCount:45,newMigrationCount:1,data:'NEW_EMPTY_TMPFS_ONLY',networkIsolation:'NEW_INTERNAL_NETWORK',retention:'EXACT_OWN_CONTAINER_NETWORK_REMOVE',formalDbChanges:0,actualExecuted:false}));
else{
 let phase='PREFLIGHT',containerId:string|null=null,networkId:string|null=null,failure:string|null=null,cleanupFailure:string|null=null,report:unknown=null,diagnostic:unknown=null,deadline=0,cleanupMode=false,checkingResources=false;
 const instance=randomBytes(16).toString('hex'),owner='A3_READ_SQL_PSQL_QA';
 function fresh(){if(!Number.isFinite(deadline)||Date.now()>=deadline)throw Error('QA_EXPIRED');}
 function docker(args:string[],input?:string,env:NodeJS.ProcessEnv=process.env,timeout=30000){
  if(!cleanupMode)fresh();
  try{return execFileSync('/usr/bin/docker',['--host','unix:///var/run/docker.sock',...args],{input,env,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout,maxBuffer:2*1024*1024}).trim();}
  catch(e){if(args.includes('psql')){diagnostic=sourceReadPsqlError(e);throw Error('QA_PSQL_STEP_FAILED');}throw Error('QA_DOCKER_STEP_FAILED');}
 }
 function inspect(kind:'container'|'network',id:string){return JSON.parse(docker([kind,'inspect',id]))[0];}
 function owned(item:any,id:string,kind:'container'|'network'){const labels=kind==='container'?item?.Config?.Labels:item?.Labels;if(!/^[0-9a-f]{64}$/.test(id)||item?.Id!==id||labels?.['anvil.owner']!==owner||labels?.['anvil.project']!=='v3'||labels?.['anvil.instance']!==instance)throw Error('QA_CLEANUP_IDENTITY_MISMATCH');}
 function psql(role:'anvil_v3_bootstrap'|'anvil_v3_migrator'|'anvil_v3_app',password:string,sql:string){
  const env={...process.env,PGPASSWORD:password};
  return docker(['exec','-i','--env','PGPASSWORD','--env','PGCONNECT_TIMEOUT=5',containerId!,'psql','--no-psqlrc','--no-password','--quiet','--no-align','--tuples-only','--host=127.0.0.1','--port=5432','--username='+role,'--dbname='+resource.database,'--set=ON_ERROR_STOP=on','--set=VERBOSITY=sqlstate','--set=SHOW_CONTEXT=never','--set=ECHO=none','--file=-'],sql,env,90000);
 }
 try{
  const expected=process.env.ANVIL_A3_PSQL_QA_COMMIT,sqlHash=process.env.ANVIL_A3_PSQL_QA_SQL_HASH;deadline=Date.parse(process.env.ANVIL_A3_PSQL_QA_EXPIRES_AT??'');
  if(process.platform!=='linux'||process.getuid?.()!==1000||process.env.ANVIL_A3_PSQL_QA_APPROVAL!=='AV3-PMO-A3-ISOLATED-SQL-QA-PSQL'||!expected||!/^[0-9a-f]{40}$/.test(expected)||!sqlHash||!/^[0-9a-f]{64}$/.test(sqlHash)||!Number.isFinite(deadline)||deadline<=Date.now()||deadline>Date.now()+7200000)throw Error('QA_PSQL_RUN_BINDING_INVALID');
  if(await realpath(process.cwd())!=='/home/daon/deploy/anvil-v3'||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==expected||execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()||execFileSync('git',['remote','get-url','origin'],{encoding:'utf8'}).trim()!=='git@github-sinsan-develop:sinsan-develop/Anvil.git')throw Error('QA_GIT_TARGET_INVALID');
  assertSourceReadPsqlBindings(await realpath(process.cwd()),await realpath(new URL(import.meta.url)),await sourceReadMigrationRoot(),process.env);
  const manifest=await sourceReadMigrationManifest(),batches=await buildSourceReadPsqlBatches();if(manifest.expected.size!==45||manifest.checksum!==sqlHash||batches.sqlHash!==sqlHash)throw Error('QA_SQL_HASH_MISMATCH');
  const socket=await stat('/var/run/docker.sock');if(!socket.isSocket()||socket.uid!==0||await realpath('/usr/bin/docker')!=='/usr/bin/docker')throw Error('QA_LOCAL_DOCKER_ENDPOINT_INVALID');
  assertSourceReadQaDaemon(JSON.parse(docker(['info','--format','{{json .}}'])),process.env.ANVIL_A3_PSQL_QA_DAEMON_ID??'',process.env.ANVIL_A3_PSQL_QA_DAEMON_NAME??'');
  if(docker(['container','ls','-a','--format','{{.Names}}']).split('\n').includes(resource.container)||docker(['network','ls','--format','{{.Name}}']).split('\n').includes(resource.network))throw Error('QA_RESOURCE_ALREADY_EXISTS');
  if(docker(['image','inspect',resource.image,'--format','{{.Id}}'])!==resource.imageId)throw Error('QA_IMAGE_MISMATCH');
  checkingResources=true;
  const bootstrap=randomBytes(32).toString('hex'),migrator=randomBytes(32).toString('hex'),app=randomBytes(32).toString('hex'),labels=['--label','anvil.project=v3','--label','anvil.owner='+owner,'--label','anvil.instance='+instance];
  phase='CREATE_INTERNAL_NETWORK';networkId=docker(['network','create','--internal',...labels,resource.network]);let network=inspect('network',networkId);owned(network,networkId,'network');if(network.Internal!==true)throw Error('QA_NETWORK_NOT_INTERNAL');
  phase='CREATE_UNPUBLISHED_PG';containerId=docker(['run','-d','--name',resource.container,...labels,'--network',resource.network,'--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid,size=268435456','--env','POSTGRES_USER=anvil_v3_bootstrap','--env','POSTGRES_DB='+resource.database,'--env','POSTGRES_PASSWORD',resource.image,'-c','log_statement=none','-c','log_min_error_statement=fatal'],undefined,{...process.env,POSTGRES_PASSWORD:bootstrap});
  owned(inspect('container',containerId),containerId,'container');assertSourceReadPsqlContainer(inspect('container',containerId),resource.imageId,networkId,docker(['exec',containerId,'cat','/proc/mounts']));
  phase='PG_READY';let ready=false;for(let n=0;n<30;n++){fresh();try{docker(['exec',containerId,'pg_isready','-h','127.0.0.1','-U','anvil_v3_bootstrap','-d',resource.database]);ready=true;break;}catch{await new Promise(r=>setTimeout(r,500));}}if(!ready)throw Error('QA_PG_NOT_READY');
  phase='QA_BOOTSTRAP_ROLES';
  psql('anvil_v3_bootstrap',bootstrap,"BEGIN;CREATE ROLE anvil_v3_migrator LOGIN PASSWORD '"+migrator+"' NOSUPERUSER NOCREATEDB NOCREATEROLE;CREATE ROLE anvil_v3_app LOGIN PASSWORD '"+app+"' NOSUPERUSER NOCREATEDB NOCREATEROLE;REVOKE ALL ON DATABASE "+resource.database+" FROM PUBLIC;GRANT CONNECT ON DATABASE "+resource.database+" TO anvil_v3_migrator,anvil_v3_app;REVOKE CREATE ON SCHEMA public FROM PUBLIC;CREATE SCHEMA anvil AUTHORIZATION anvil_v3_migrator;CREATE SCHEMA anvil_qa AUTHORIZATION anvil_v3_migrator;GRANT USAGE ON SCHEMA anvil,anvil_qa TO anvil_v3_app;ALTER DEFAULT PRIVILEGES FOR ROLE anvil_v3_migrator IN SCHEMA anvil,anvil_qa GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anvil_v3_app;COMMIT;");
  fresh();phase='QA_PSQL_SCHEMA_COMMIT';const migration=readSourceReadPsqlResult(psql('anvil_v3_migrator',migrator,batches.schema),'SCHEMA');
  fresh();phase='QA_PSQL_READ_ONLY';const vectors=readSourceReadPsqlResult(psql('anvil_v3_app',app,batches.readOnly),'READ_ONLY');fresh();
  report={commit:expected,sqlHash,node:process.version,resource:{...resource,containerId,networkId,instance},migration,vectors,apiOrCredentialIssued:false,nodePgTransportVerified:false,formalDbChanges:0,actualAgentCalls:0,actualOsCalls:0};
 }catch(e){diagnostic??=sourceReadQaError(e);failure=sourceReadQaError(e).failure;}
 finally{
  cleanupMode=true;
  if(checkingResources)try{
   // 생성 응답 유실 때도 이름만으로 삭제하지 않고 이번 full ID/label을 회수·대조한다.
   if(!containerId&&docker(['container','ls','-a','--format','{{.Names}}']).split('\n').includes(resource.container)){const item=inspect('container',resource.container);owned(item,item.Id,'container');containerId=item.Id;}
   if(!networkId&&docker(['network','ls','--format','{{.Name}}']).split('\n').includes(resource.network)){const item=inspect('network',resource.network);owned(item,item.Id,'network');networkId=item.Id;}
   if(containerId){const item=inspect('container',containerId);owned(item,containerId,'container');assertSourceReadPsqlContainer(item,resource.imageId,networkId??'',docker(['exec',containerId,'cat','/proc/mounts']));docker(['rm','-f',containerId]);}
   if(networkId){const item=inspect('network',networkId);owned(item,networkId,'network');if(!item.Internal||Object.keys(item.Containers??{}).length)throw Error('QA_NETWORK_NOT_EMPTY_OR_NOT_INTERNAL');docker(['network','rm',networkId]);}
   if(docker(['container','ls','-a','--format','{{.Names}}']).split('\n').includes(resource.container)||docker(['network','ls','--format','{{.Name}}']).split('\n').includes(resource.network))throw Error('QA_RESOURCES_REMAIN');
  }catch{cleanupFailure='QA_EXACT_CLEANUP_FAILED_PRESERVE_AND_REPORT';}
 }
 console.log(JSON.stringify({status:failure||cleanupFailure?'FAIL':'PASS',failure,cleanupFailure,phase,diagnostic,report,resourceIdentity:{containerId,networkId,instance},formalDbChanges:0,actualAgentCalls:0,actualOsCalls:0}));if(failure||cleanupFailure)process.exitCode=1;
}
