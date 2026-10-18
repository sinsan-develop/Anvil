import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { realpath, stat, lstat } from 'node:fs/promises';
import { executionPreparationQa as qa, assertExecutionPreparationQaBinding, buildExecutionPreparationQaSchema, assertExecutionPreparationQaResource, executionPreparationQaMayCleanup, executionPreparationQaRemaining, executionPreparationQaSqlDiagnostic } from './execution-preparation-qa.ts';
import { assertSourceRootQaTmpfs, sourceRootQaError } from './source-root-qa-guard.ts';

if(process.argv.length!==3||process.argv[2]!=='--run')throw Error('C1_QA_RUN_REQUIRED');
const instance=randomBytes(16).toString('hex');let deadline=0,containerId:string|null=null,networkId:string|null=null,creating=false,cleanup=false;
let phase='BINDING',failure:unknown=null,cleanupFailure:string|null=null,report:unknown=null,psqlDiagnostic:unknown=null,cleanupDeadline=0;
const fresh=()=>assert(Date.now()<deadline-120000,'C1_QA_EXPIRED');
function docker(args:string[],input?:string,env=process.env,timeout=30000) {
  if(!cleanup)fresh();
  const remaining=executionPreparationQaRemaining(cleanup?cleanupDeadline:deadline,Date.now(),cleanup?0:120000);
  try{return execFileSync('/usr/bin/docker',['--host','unix:///var/run/docker.sock',...args],{input,env,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:Math.max(1,Math.min(timeout,remaining)),maxBuffer:2*1024*1024}).trim();}
  catch(error){if(args.includes('psql'))psqlDiagnostic=executionPreparationQaSqlDiagnostic(error);throw Error('C1_QA_'+(args.includes('psql')?'PSQL_FAILED':'DOCKER_FAILED'));}
}
const inspect=(kind:'container'|'network',id:string)=>JSON.parse(docker([kind,'inspect',id]))[0];
function owned(item:any,id:string,kind:'container'|'network') {
  assertExecutionPreparationQaResource(item,kind,id,instance,networkId);
}
const names=(kind:'container'|'network')=>docker([kind,'ls',...(kind==='container'?['-a']:[]),'--format',kind==='container'?'{{.Names}}':'{{.Name}}']).split('\n');
function psql(role:string,password:string,sql:string) {
  return docker(['exec','-i','--env','PGPASSWORD','--env','PGCONNECT_TIMEOUT=5',containerId!,'psql','--no-psqlrc','--no-password','--quiet','--no-align','--tuples-only','--host=127.0.0.1','--port=5432','--username='+role,'--dbname='+qa.database,'--set=ON_ERROR_STOP=on','--set=VERBOSITY=sqlstate','--set=SHOW_CONTEXT=never','--set=ECHO=none','--file=-'],sql,{...process.env,PGPASSWORD:password},90000);
}
try {
  const git=(args:string[])=>execFileSync('/usr/bin/git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000}).trim(),schema=await buildExecutionPreparationQaSchema();
  deadline=assertExecutionPreparationQaBinding({platform:process.platform,uid:process.getuid?.()??-1,cwd:await realpath(process.cwd()),module:await realpath(new URL(import.meta.url)),head:git(['rev-parse','HEAD']),commit:process.env.ANVIL_C1_QA_SHA??'',dirty:git(['status','--porcelain','--untracked-files=normal']),remote:git(['remote','get-url','origin']),sqlHash:process.env.ANVIL_C1_QA_SQL_HASH??'',actualSqlHash:schema.sqlHash,expiresAt:process.env.ANVIL_C1_QA_EXPIRES_AT??'',env:process.env});
  const sock=await stat('/var/run/docker.sock');assert(sock.isSocket()&&sock.uid===0&&await realpath('/usr/bin/docker')==='/usr/bin/docker','C1_QA_SOCKET_INVALID');
  const info=JSON.parse(docker(['info','--format','{{json .}}']));assert.equal(info.ID,qa.daemonId);assert.equal(info.Name,'SINSAN');
  assert(!names('container').includes(qa.container)&&!names('network').includes(qa.network),'C1_QA_RESOURCE_EXISTS');
  assert.equal(docker(['image','inspect',qa.image,'--format','{{.Id}}']),qa.imageId);
  assert.equal(await realpath('/tmp'),'/tmp');assert.equal(await realpath('/home/daon/deploy'),'/home/daon/deploy');
  await assert.rejects(lstat(qa.artifactRoot),(e:any)=>e.code==='ENOENT');
  const bootstrap=randomBytes(32).toString('hex'),migrator=randomBytes(32).toString('hex'),app=randomBytes(32).toString('hex');
  const labels=['--label','anvil.project=v3','--label','anvil.owner='+qa.owner,'--label','anvil.instance='+instance,'--label','anvil.runId='+qa.runId];
  creating=true;phase='NETWORK';networkId=docker(['network','create','--internal',...labels,qa.network]);const network=inspect('network',networkId);owned(network,networkId,'network');assert.equal(network.Internal,true);
  phase='PG';containerId=docker(['run','-d','--name',qa.container,...labels,'--network',qa.network,'--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid,size=268435456','--env','POSTGRES_USER=anvil_v3_bootstrap','--env','POSTGRES_DB='+qa.database,'--env','POSTGRES_PASSWORD',qa.image,'-c','log_statement=none','-c','log_min_error_statement=fatal'],undefined,{...process.env,POSTGRES_PASSWORD:bootstrap},90000);
  const pg=inspect('container',containerId);owned(pg,containerId,'container');
  assertSourceRootQaTmpfs(pg,qa.imageId,docker(['exec',containerId,'cat','/proc/mounts']));
  assert.equal(pg.HostConfig.PublishAllPorts,false);assert.equal(Object.keys(pg.HostConfig.PortBindings??{}).length,0);
  assert.deepEqual(pg.NetworkSettings.Ports,{'5432/tcp':null});assert.deepEqual(Object.keys(pg.NetworkSettings.Networks),[qa.network]);assert.equal(pg.NetworkSettings.Networks[qa.network].NetworkID,networkId);
  const host=pg.NetworkSettings.Networks[qa.network].IPAddress;assert(/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host));
  phase='READY';let ready=false;
  for(let n=0;n<30;n++){fresh();try{docker(['exec',containerId,'pg_isready','-h','127.0.0.1','-U','anvil_v3_bootstrap','-d',qa.database]);ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,500));}}
  assert(ready,'C1_QA_PG_NOT_READY');phase='BOOTSTRAP';
  assert(/^[0-9a-f]{64}$/.test(migrator)&&/^[0-9a-f]{64}$/.test(app));
  psql('anvil_v3_bootstrap',bootstrap,"BEGIN;CREATE ROLE anvil_v3_migrator LOGIN PASSWORD '"+migrator+"' NOSUPERUSER NOCREATEDB NOCREATEROLE;CREATE ROLE anvil_v3_app LOGIN PASSWORD '"+app+"' NOSUPERUSER NOCREATEDB NOCREATEROLE;REVOKE ALL ON DATABASE "+qa.database+' FROM PUBLIC;GRANT CONNECT ON DATABASE '+qa.database+" TO anvil_v3_migrator,anvil_v3_app;REVOKE CREATE ON SCHEMA public FROM PUBLIC;CREATE SCHEMA anvil AUTHORIZATION anvil_v3_migrator;CREATE SCHEMA anvil_qa AUTHORIZATION anvil_v3_migrator;GRANT USAGE ON SCHEMA anvil,anvil_qa TO anvil_v3_app;ALTER DEFAULT PRIVILEGES FOR ROLE anvil_v3_migrator IN SCHEMA anvil,anvil_qa GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anvil_v3_app;COMMIT;");
  phase='SCHEMA';assert(psql('anvil_v3_migrator',migrator,schema.schema).includes('C1_SCHEMA_51_COMMITTED'),'C1_QA_SCHEMA_MARKER_MISSING');
  phase='WORKFLOW';
  // 별도 프로세스의 총량 제한은 app.close/pool.end 무응답도 부모의 exact Docker 회수를 막지 않게 한다.
  let output='',childError:unknown=null;
  try{output=execFileSync(process.execPath,['scripts/execution-preparation-workflow-qa.ts','--workflow'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:executionPreparationQaRemaining(deadline),maxBuffer:2*1024*1024,env:{...process.env,ANVIL_C1_QA_HOST:host,ANVIL_C1_QA_APP_PASSWORD:app,ANVIL_C1_QA_MIGRATOR_PASSWORD:migrator}});}
  catch(error){childError=error;output=String((error as any)?.stdout??'');}
  for(const line of output.split(/\r?\n/).filter(line=>/^C1_WORKFLOW_(FAILURE|CLEANUP|RESULT) /.test(line)))console.log(line);
  const marker=output.split(/\r?\n/).find(line=>line.startsWith('C1_WORKFLOW_RESULT '));
  if(childError||!marker)throw Error('C1_QA_WORKFLOW_FAILED_OR_TERMINATION_UNVERIFIED');
  report=JSON.parse(marker.slice('C1_WORKFLOW_RESULT '.length));phase='DONE';
}catch(error){failure=sourceRootQaError(error);}
finally {
  cleanup=true;cleanupDeadline=Math.min(deadline,Date.now()+120000);
  if(executionPreparationQaMayCleanup(creating)) {
  try {
    if(!networkId&&names('network').includes(qa.network)){const item=inspect('network',qa.network);owned(item,item.Id,'network');networkId=item.Id;}
    if(!containerId&&names('container').includes(qa.container)){const item=inspect('container',qa.container);owned(item,item.Id,'container');containerId=item.Id;}
    if(containerId){const item=inspect('container',containerId);owned(item,containerId,'container');assertSourceRootQaTmpfs(item,qa.imageId,docker(['exec',containerId,'cat','/proc/mounts']));docker(['rm','-f',containerId]);}
    if(networkId){const item=inspect('network',networkId);owned(item,networkId,'network');assert.equal(item.Internal,true);assert.equal(Object.keys(item.Containers??{}).length,0);docker(['network','rm',networkId]);}
    assert(!names('container').includes(qa.container)&&!names('network').includes(qa.network),'C1_QA_RESOURCES_REMAIN');
    try{await lstat(qa.artifactRoot);
      execFileSync(process.execPath,['--input-type=module','-e',"const {cleanExecutionPreparationQaRoot}=await import('./scripts/execution-preparation-qa.ts');await cleanExecutionPreparationQaRoot();"],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:Math.min(30000,executionPreparationQaRemaining(cleanupDeadline,Date.now(),0)),maxBuffer:4096});
    }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    await assert.rejects(lstat(qa.artifactRoot),(e:any)=>e.code==='ENOENT');
  }catch{cleanupFailure='C1_QA_CLEANUP_UNVERIFIED_PRESERVE_AND_REPORT';}
  }
}
console.log('C1_QA_RESULT '+JSON.stringify({status:failure||cleanupFailure?'FAIL':'PASS',phase,failure,psqlDiagnostic,cleanupFailure,report,containerId,networkId,instance,resource:qa,formalDbChanges:0}));
if(failure||cleanupFailure)process.exitCode=1;
