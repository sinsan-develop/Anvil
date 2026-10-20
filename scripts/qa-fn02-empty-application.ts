// 고정된 FN02 격리 함수 또는 적용 workflow만 수행한다. 정식 DB/서비스/runner는 소비하지 않는다.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {readFile,realpath,lstat,stat,readdir} from 'node:fs/promises';
import {contentHash} from '../contracts/canonical.ts';
import {buildExecutionPreparationQaSchema,executionPreparationQaSqlDiagnostic} from './execution-preparation-qa.ts';
import {assertFn02QaManifest} from './fn02-empty-application-manifest.ts';

const qa=Object.freeze({cwd:'/home/daon/deploy/anvil-v3-fn02-empty-application-qa-01',artifact:'/tmp/anvil-v3-fn02-empty-application-01',container:'anvil-v3-fn02-empty-application-pg-01',network:'anvil-v3-fn02-empty-application-net-01',database:'anvil_v3_fn02_empty_application_qa_01',owner:'AV3_FN02_EMPTY_APPLICATION_QA',image:'postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425',imageId:'sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f',daemon:'e3349f1d-dbfc-478a-96d9-295bf6c6839e'});
const instance=randomBytes(16).toString('hex');
let until=0,cleanupUntil=0,cleanup=false,creating=false,containerId:string|null=null,networkId:string|null=null,phase='BINDING',failure:string|null=null,cleanupFailure:string|null=null,diagnostic:unknown=null,report:unknown=null;
const fresh=()=>assert(Date.now()<(cleanup?cleanupUntil:until-120000),'FN02_QA_EXPIRED');
function docker(args:string[],input?:string,env=process.env,timeout=30000){
 fresh();const ms=Math.max(1,Math.min(timeout,(cleanup?cleanupUntil:until-120000)-Date.now()));
 try{return execFileSync('/usr/bin/docker',['--host','unix:///var/run/docker.sock',...args],{input,env,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:ms,maxBuffer:2*1024*1024}).trim();}
 catch(e){if(args.includes('psql'))diagnostic=executionPreparationQaSqlDiagnostic(e);throw Error(args.includes('psql')?'FN02_QA_PSQL_FAILED':'FN02_QA_DOCKER_FAILED');}
}
const inspect=(kind:'container'|'network',id:string)=>JSON.parse(docker([kind,'inspect',id]))[0];
const names=(kind:'container'|'network')=>docker([kind,'ls',...(kind==='container'?['-a']:[]),'--format',kind==='container'?'{{.Names}}':'{{.Name}}']).split('\n');
function owned(item:any,id:string,kind:'container'|'network'){
 const labels=kind==='container'?item?.Config?.Labels:item?.Labels;
 assert(/^[0-9a-f]{64}$/.test(id)&&item.Id===id&&labels?.['anvil.owner']===qa.owner&&labels?.['anvil.instance']===instance&&labels?.['anvil.project']==='v3','FN02_QA_OWNERSHIP_INVALID');
 assert.equal(item.Name,kind==='container'?'/'+qa.container:qa.network);
 if(kind==='network'){assert.equal(item.Internal,true);return;}
 assert.equal(item.Image,qa.imageId);assert.deepEqual(item.Mounts,[]);
 assert.deepEqual(item.HostConfig.Tmpfs,{'/var/lib/postgresql/data':'rw,noexec,nosuid,size=268435456'});
 assert.equal(item.HostConfig.PublishAllPorts,false);assert.deepEqual(item.HostConfig.PortBindings,{});
 assert.deepEqual(item.NetworkSettings.Ports,{'5432/tcp':null});assert.deepEqual(Object.keys(item.NetworkSettings.Networks),[qa.network]);
 assert.equal(item.NetworkSettings.Networks[qa.network].NetworkID,networkId);
}
function psql(user:string,password:string,sql:string){return docker(['exec','-i','--env','PGPASSWORD','--env','PGCONNECT_TIMEOUT=5',containerId!,'psql','--no-psqlrc','--no-password','--quiet','--no-align','--tuples-only','--host=127.0.0.1','--port=5432','--username='+user,'--dbname='+qa.database,'--set=ON_ERROR_STOP=on','--set=VERBOSITY=sqlstate','--set=SHOW_CONTEXT=never','--set=ECHO=none','--file=-'],sql,{...process.env,PGPASSWORD:password},90000);}
const sqlText=(s:string)=>"'"+s.replaceAll("'","''")+"'";
try{
 if(process.argv.length!==3||!['--run','--workflow','--compatibility'].includes(process.argv[2]!))throw Error('FN02_QA_RUN_REQUIRED');
 const compatibility=process.argv[2]==='--compatibility',workflow=process.argv[2]==='--workflow'||compatibility;
 until=Date.parse(process.env.ANVIL_FN02_QA_UNTIL??'');const sha=process.env.ANVIL_FN02_QA_SHA??'',sqlHash=process.env.ANVIL_FN02_QA_SQL_HASH??'';
 const git=(args:string[])=>execFileSync('/usr/bin/git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000}).trim();
 assert(process.platform==='linux'&&process.getuid?.()===1000&&await realpath(process.cwd())===qa.cwd&&await realpath(new URL(import.meta.url))===qa.cwd+'/scripts/qa-fn02-empty-application.ts','FN02_QA_PATH_INVALID');
 assert(Number.isFinite(until)&&until>Date.now()&&until<=Date.now()+1200000&&/^[0-9a-f]{40}$/.test(sha)&&git(['rev-parse','HEAD'])===sha&&git(['status','--porcelain','--untracked-files=normal'])==='','FN02_QA_GIT_WINDOW_INVALID');
 assert.equal(git(['remote','get-url','origin']),'git@github-sinsan-develop:sinsan-develop/Anvil.git');
 assert(!Object.entries(process.env).some(([name,value])=>value&&(name.startsWith('PG')||name.startsWith('DOCKER_')||['ANVIL_DB_CONFIG','ANVIL_MIGRATOR_CONFIG','NODE_OPTIONS','NODE_PATH'].includes(name))),'FN02_QA_ENV_OVERRIDE_REJECTED');
 const root=await realpath('.'),candidatePath=root+'/db/migrations/0031_empty_project_methodology_application.sql.pending';
 assert.equal(await realpath(candidatePath),candidatePath);const candidate=await readFile(candidatePath,'utf8');assert(/^[0-9a-f]{64}$/.test(sqlHash)&&contentHash(candidate)===sqlHash,'FN02_QA_SQL_HASH_INVALID');
 const authorityPath=root+'/db/migrations/0017_execution_authority.sql';assert.equal(await realpath(authorityPath),authorityPath);const authority=await readFile(authorityPath,'utf8'),base=await buildExecutionPreparationQaSchema();
 const manifest=[...base.manifest,{id:'0017_execution_authority',checksum:contentHash(authority)},{id:'0031_empty_project_methodology_application',checksum:sqlHash}];
 assert.equal(manifest.length,53);assert.equal(new Set(manifest.map(m=>m.id)).size,53);
 const socket=await stat('/var/run/docker.sock');assert(socket.isSocket()&&socket.uid===0,'FN02_QA_SOCKET_INVALID');assert.equal(await realpath('/usr/bin/docker'),'/usr/bin/docker');
 const info=JSON.parse(docker(['info','--format','{{json .}}']));assert.equal(info.ID,qa.daemon);assert.equal(info.Name,'SINSAN');
 assert.equal(docker(['image','inspect',qa.image,'--format','{{.Id}}']),qa.imageId);
 assert(!names('container').includes(qa.container)&&!names('network').includes(qa.network),'FN02_QA_RESOURCE_EXISTS');
 assert.equal(await realpath('/home/daon/deploy'),'/home/daon/deploy');assert.equal(await realpath('/tmp'),'/tmp');
 if(workflow){
  const cache=await lstat(qa.artifact);
  assert(cache.isDirectory()&&!cache.isSymbolicLink()&&cache.uid===1000&&(cache.mode&0o777)===0o700&&await realpath(qa.artifact)===qa.artifact,'FN02_QA_CACHE_INVALID');
  assert((await readdir(qa.artifact)).every(name=>name==='npm-cache'),'FN02_QA_CACHE_CONTENT_INVALID');
  const npmCache=await lstat(qa.artifact+'/npm-cache');
  assert(npmCache.isDirectory()&&!npmCache.isSymbolicLink()&&npmCache.uid===1000&&await realpath(qa.artifact+'/npm-cache')===qa.artifact+'/npm-cache','FN02_QA_CACHE_INVALID');
 }else await assert.rejects(lstat(qa.artifact),(e:any)=>e.code==='ENOENT');
 const bootstrap=randomBytes(32).toString('hex'),migrator=randomBytes(32).toString('hex'),app=randomBytes(32).toString('hex');
 const labels=['--label','anvil.project=v3','--label','anvil.owner='+qa.owner,'--label','anvil.instance='+instance];
 creating=true;phase='NETWORK';networkId=docker(['network','create','--internal',...labels,qa.network]);owned(inspect('network',networkId),networkId,'network');
 phase='PG';containerId=docker(['run','-d','--name',qa.container,...labels,'--network',qa.network,'--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid,size=268435456','--env','POSTGRES_USER=anvil_v3_bootstrap','--env','POSTGRES_DB='+qa.database,'--env','POSTGRES_PASSWORD',qa.image,'-c','log_statement=none','-c','log_min_error_statement=fatal'],undefined,{...process.env,POSTGRES_PASSWORD:bootstrap},90000);
 const pg=inspect('container',containerId);owned(pg,containerId,'container');const host=pg.NetworkSettings.Networks[qa.network].IPAddress;
 assert(/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host),'FN02_QA_HOST_INVALID');
 phase='READY';let ready=false;
 for(let i=0;i<30;i++){fresh();try{docker(['exec',containerId,'pg_isready','-h','127.0.0.1','-U','anvil_v3_bootstrap','-d',qa.database]);ready=true;break;}catch{await new Promise(r=>setTimeout(r,500));}}
 assert(ready,'FN02_QA_PG_NOT_READY');phase='BOOTSTRAP';
 psql('anvil_v3_bootstrap',bootstrap,"BEGIN;CREATE ROLE anvil_v3_migrator LOGIN PASSWORD '"+migrator+"' NOSUPERUSER NOCREATEDB NOCREATEROLE;CREATE ROLE anvil_v3_app LOGIN PASSWORD '"+app+"' NOSUPERUSER NOCREATEDB NOCREATEROLE;REVOKE ALL ON DATABASE "+qa.database+' FROM PUBLIC;GRANT CONNECT ON DATABASE '+qa.database+" TO anvil_v3_migrator,anvil_v3_app;REVOKE CREATE ON SCHEMA public FROM PUBLIC;CREATE SCHEMA anvil AUTHORIZATION anvil_v3_migrator;CREATE SCHEMA anvil_qa AUTHORIZATION anvil_v3_migrator;GRANT USAGE ON SCHEMA anvil,anvil_qa TO anvil_v3_app;ALTER DEFAULT PRIVILEGES FOR ROLE anvil_v3_migrator IN SCHEMA anvil,anvil_qa GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anvil_v3_app;COMMIT;");
 phase='BASE_SCHEMA';assert(psql('anvil_v3_migrator',migrator,base.schema).includes('C1_SCHEMA_51_COMMITTED'));
 psql('anvil_v3_migrator',migrator,'BEGIN;'+authority+'\n;INSERT INTO anvil.schema_migrations(id,checksum) VALUES('+sqlText(manifest[51]!.id)+','+sqlText(manifest[51]!.checksum)+');COMMIT;');
 const oldGuardSql="SELECT encode(sha256(convert_to(pg_get_functiondef('anvil.guard_initial_project_methodology()'::regprocedure),'UTF8')),'hex');",oldGuard=psql('anvil_v3_migrator',migrator,oldGuardSql);
 phase='CANDIDATE_SCHEMA';psql('anvil_v3_migrator',migrator,'BEGIN;'+candidate+'\n;INSERT INTO anvil.schema_migrations(id,checksum) VALUES('+sqlText(manifest[52]!.id)+','+sqlText(sqlHash)+');COMMIT;');
 phase='OLD_GUARD_COMPARE';
 assert.equal(psql('anvil_v3_migrator',migrator,oldGuardSql),oldGuard,'FN02_OLD_INITIAL_FUNCTION_CHANGED');
 phase='MANIFEST_READ';
 const actual=JSON.parse(psql('anvil_v3_migrator',migrator,"SELECT json_agg(x ORDER BY id) FROM (SELECT id,checksum FROM anvil.schema_migrations)x;"));
 phase='MANIFEST_COMPARE';
 console.log('FN02_SCHEMA_CHECK '+JSON.stringify({actualCount:actual?.length,expectedCount:manifest.length,
  actualIds:Array.isArray(actual)?actual.map((r:any)=>r.id):null,expectedIds:manifest.toSorted((a,b)=>a.id.localeCompare(b.id)).map(r=>r.id),
  mismatches:Array.isArray(actual)?actual.filter((r:any)=>manifest.find(m=>m.id===r.id)?.checksum!==r.checksum).map((r:any)=>({id:r.id,checksum:r.checksum,expected:manifest.find(m=>m.id===r.id)?.checksum??null})):null}));
 assertFn02QaManifest(actual,manifest);phase=compatibility?'COMPATIBILITY':workflow?'WORKFLOW':'FUNCTIONS';
 let output='';let childFailed=false;
 try{output=execFileSync(process.execPath,['--experimental-strip-types','--test',compatibility?'tests/integration/FN02/empty-application-compatibility-isolated.test.ts':workflow?'tests/integration/FN02/empty-application-workflow-isolated.test.ts':'tests/integration/FN02/empty-application-canonical-isolated.test.ts'],{env:{...process.env,ANVIL_FN02_QA_UNTIL:new Date(Math.min(until-120000,Date.now()+600000)).toISOString(),ANVIL_FN02_QA_HOST:host,ANVIL_FN02_QA_APP:app,...(workflow?{ANVIL_FN02_QA_MIGRATOR:migrator}:{})},encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:Math.min(100000,until-Date.now()-120000),maxBuffer:2*1024*1024});}
 catch(e){childFailed=true;output=String((e as any)?.stdout??'');}
 for(const line of output.split(/\r?\n/).map(s=>s.replace(/^# /,'')))if(line.startsWith('FN02_FUNCTION_TEST_FAILURE ')){
  const item=JSON.parse(line.slice('FN02_FUNCTION_TEST_FAILURE '.length));
  if(typeof item.phase==='string'&&/^[A-Z0-9_]{1,80}$/.test(item.phase)&&Number.isInteger(item.caseIndex)
   &&(item.code===null||typeof item.code==='string'&&/^[A-Z0-9_]{1,80}$/.test(item.code)))console.log('FN02_FUNCTION_TEST_FAILURE '+JSON.stringify({phase:item.phase,caseIndex:item.caseIndex,code:item.code}));
 }
 const failurePrefix=compatibility?'FN02_APPLICATION_COMPATIBILITY_FAILURE ':'FN02_APPLICATION_WORKFLOW_FAILURE ';
 if(workflow)for(const line of output.split(/\r?\n/).map(s=>s.replace(/^# /,'')))if(line.startsWith(failurePrefix)){
  const item=JSON.parse(line.slice(failurePrefix.length));
  if(typeof item.phase==='string'&&/^[A-Z0-9_]{1,80}$/.test(item.phase)&&(item.code===null||typeof item.code==='string'&&/^[A-Z0-9_]{1,80}$/.test(item.code)))console.log(failurePrefix+JSON.stringify({phase:item.phase,code:item.code}));
 }
 const prefix=compatibility?'FN02_APPLICATION_COMPATIBILITY ':workflow?'FN02_APPLICATION_WORKFLOW ':'FN02_CANONICAL_GRAPH_PG_JS_MATCH ';
 const marker=output.split(/\r?\n/).map(s=>s.replace(/^# /,'')).find(s=>s.startsWith(prefix));
 if(childFailed||!marker)throw Error(compatibility?'FN02_QA_COMPATIBILITY_TEST_FAILED':workflow?'FN02_QA_WORKFLOW_TEST_FAILED':'FN02_QA_FUNCTION_TEST_FAILED');
 report=JSON.parse(marker.slice(prefix.length));phase='DONE';
}catch(e){const message=(e as any)?.message;failure=typeof message==='string'&&/^[A-Z0-9_]{1,100}$/.test(message)?message:'FN02_QA_ASSERTION_OR_UNCLASSIFIED_FAILURE';
 if(diagnostic===null){const code=(e as any)?.code,location=/qa-fn02-empty-application\.ts:(\d+):(\d+)/.exec(String((e as any)?.stack??''));
  diagnostic={code:typeof code==='string'&&/^[A-Z0-9_]{1,80}$/.test(code)?code:null,line:location?Number(location[1]):null};}
}
finally{
 cleanup=true;cleanupUntil=Date.now()+120000;
 if(creating)try{
  if(!networkId&&names('network').includes(qa.network)){const item=inspect('network',qa.network);owned(item,item.Id,'network');networkId=item.Id;}
  if(!containerId&&names('container').includes(qa.container)){const item=inspect('container',qa.container);owned(item,item.Id,'container');containerId=item.Id;}
  if(containerId){owned(inspect('container',containerId),containerId,'container');docker(['rm','-f',containerId]);}
  if(networkId){const item=inspect('network',networkId);owned(item,networkId,'network');assert.equal(Object.keys(item.Containers??{}).length,0);docker(['network','rm',networkId]);}
  assert(!names('container').includes(qa.container)&&!names('network').includes(qa.network),'FN02_QA_RESOURCES_REMAIN');
 }catch{cleanupFailure='FN02_QA_CLEANUP_UNVERIFIED_PRESERVE_AND_REPORT';}
}
console.log('FN02_QA_RESULT '+JSON.stringify({status:failure||cleanupFailure?'FAIL':'PASS',phase,failure,cleanupFailure,diagnostic,report,containerId,networkId,instance,actualAgentCalls:0,formalDbChanges:0}));
if(failure||cleanupFailure)process.exitCode=1;
