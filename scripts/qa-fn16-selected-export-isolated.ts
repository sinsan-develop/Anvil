/** FN16 새 일회 PG 검수 준비. 기본 PLAN_ONLY; 이 파일은 Docker/WSL 자원을 생성하지 않는다. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {Pool,type PoolConfig} from 'pg';
import {buildExecutionPreparationQaSchema,executionPreparationQaDatabase} from './execution-preparation-qa.ts';
import {buildApp} from '../apps/server/app.ts';
import {AccessRepository} from '../apps/server/modules/access/repository.ts';
import {hashPassword} from '../apps/server/modules/access/service.ts';
import {buildOfficialForms} from '../apps/server/modules/documents/forms.ts';
import {seedOfficialForms} from '../apps/server/modules/documents/catalog-seed.ts';
import {runProjectArtifactExportPg} from '../tests/integration/FN16/project-artifact-export-pg.ts';
const target=Object.freeze({source:'/qa-source',config:'/qa-config/run.json',data:'/qa-data',artifactRoot:'/qa-data/artifacts',exportRoot:'/qa-data/exports',pg:'anvil-v3-fn16-artifact-export-qa-pg',node:'anvil-v3-fn16-artifact-export-qa-node',network:'anvil-v3-fn16-artifact-export-qa-net',database:'anvil_fn16_qa_selected_artifact_01',baseline:'92cef0472f58b7a2c8656f70ac29c210316350f8',baselineManifestHash:'da6f6a9102f8018e2e41d4e00545acd74ec9f2db70e3cf2a7658ec6e6c7e62b6',baselineSchemaHash:'177c4ee11ef74e5d25ebb25a7f507258eac4cc71918af9023b08e0806e215006',candidate:'0043_project_artifact_exports',candidateHash:'f83f256a479b0ae484f67b538b4763ced884173654d3692ba537c645fdad0d5e'});
class Fn16QaFailure extends Error{readonly safeCode:string;constructor(code:string){super('FN16_QA_REFUSED');this.safeCode=code;}}
let currentPhase='ENTRY';
const fail=(code='FN16_QA_INPUT_REFUSED'):never=>{throw new Fn16QaFailure(code);};
class Fn16BootstrapCleanupFailure extends Error{readonly primary:unknown;readonly cleanup:unknown;readonly failurePhase:string;constructor(primary:unknown,phase:string,cleanup:unknown){super('FN16_QA_BOOTSTRAP_AND_CLEANUP_FAILED');this.primary=primary;this.cleanup=cleanup;this.failurePhase=phase;}}
const bootstrapPhases=new Set(['BOOTSTRAP','BOOTSTRAP_IDENTITY','BOOTSTRAP_LOGGING','BOOTSTRAP_EMPTY_CHECK','BOOTSTRAP_SCHEMA_BUILD','BOOTSTRAP_ROLE_CREATE','BOOTSTRAP_MIGRATOR_IDENTITY','BOOTSTRAP_BASELINE_APPLY','BOOTSTRAP_CANDIDATE_APPLY','BOOTSTRAP_CLEANUP']);
export function preserveFn16BootstrapFailure(primary:unknown,phase:string,cleanup:unknown){return new Fn16BootstrapCleanupFailure(primary,bootstrapPhases.has(phase)?phase:'BOOTSTRAP',cleanup);}
/** bootstrap의 실제 finally 소비선. 정리는 원 실패와 분리한다. */
export async function finishFn16BootstrapCleanup(state:{failed:boolean;primaryError:unknown;failurePhase:string},cleanup:()=>Promise<unknown>){
 currentPhase='BOOTSTRAP_CLEANUP';try{await cleanup();}catch(cleanupError){if(state.failed)throw preserveFn16BootstrapFailure(state.primaryError,state.failurePhase,cleanupError);throw cleanupError;}
 if(state.failed)currentPhase=bootstrapPhases.has(state.failurePhase)?state.failurePhase:'BOOTSTRAP';
}
const diagnosticNames=new Set(['Error','TypeError','RangeError','ReferenceError','SyntaxError','AssertionError','AggregateError','DatabaseError','TimeoutError','AbortError','error']);
const diagnosticNodeCodes=new Set(['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ECONNRESET','ETIMEDOUT','EHOSTUNREACH','ENETUNREACH','EPIPE','ENOENT','EACCES','EPERM','EEXIST','ERR_INVALID_ARG_TYPE','ERR_INVALID_ARG_VALUE','ERR_OUT_OF_RANGE','ERR_MODULE_NOT_FOUND','ERR_PACKAGE_PATH_NOT_EXPORTED']);
const diagnosticMessages=new Map([
 ['Query read timeout','FN16_QA_QUERY_READ_TIMEOUT'],
 ['Connection terminated due to connection timeout','FN16_QA_CONNECTION_TIMEOUT'],
 ['timeout exceeded when trying to connect','FN16_QA_POOL_CONNECT_TIMEOUT'],
 ['Connection terminated unexpectedly','FN16_QA_CONNECTION_TERMINATED'],
 ['Connection terminated','FN16_QA_CONNECTION_TERMINATED'],
 ['C1_QA_MIGRATION_SET_INVALID','C1_QA_MIGRATION_SET_INVALID'],
 ['C1_QA_SQL_LINK_REJECTED','C1_QA_SQL_LINK_REJECTED'],
 ['FN16_QA_CONNECTION_CLEANUP_TIMEOUT','FN16_QA_CONNECTION_CLEANUP_TIMEOUT'],
]);
function safeClassification(error:unknown){const e=error as {name?:unknown;code?:unknown;severity?:unknown;message?:unknown};return{code:error instanceof Fn16QaFailure?error.safeCode:typeof e?.message==='string'?diagnosticMessages.get(e.message)??'FN16_QA_UNCLASSIFIED_FAILURE':'FN16_QA_UNCLASSIFIED_FAILURE',pgCode:typeof e?.severity==='string'&&['ERROR','FATAL','PANIC'].includes(e.severity)&&typeof e.code==='string'&&/^[0-9A-Z]{5}$/.test(e.code)?e.code:null,errorName:typeof e?.name==='string'&&diagnosticNames.has(e.name)?e.name:null,nodeCode:typeof e?.code==='string'&&diagnosticNodeCodes.has(e.code)?e.code:null};}
export function fn16QaDiagnostic(error:unknown){
 const contextual=error instanceof Fn16BootstrapCleanupFailure,errorValue=contextual?error.primary:error,e=errorValue as {name?:unknown;code?:unknown;severity?:unknown;stack?:unknown};
 const frames:{file:string;line:number;column:number}[]=[];
 if(typeof e?.stack==='string'&&e.stack.length<=65536)for(const line of e.stack.split('\n')){
  if(!/^\s+at\s/.test(line))continue;
  const match=/(?:[/\\])(qa-fn16-selected-export-isolated\.ts|execution-preparation-qa\.ts|project-artifact-export-pg\.ts):([1-9][0-9]{0,5}):([1-9][0-9]{0,5})\)?\s*$/.exec(line);if(!match)continue;
  const frame={file:match[1]!,line:Number(match[2]),column:Number(match[3])};if(!frames.some(f=>f.file===frame.file&&f.line===frame.line&&f.column===frame.column))frames.push(frame);if(frames.length===8)break;
 }
 return{kind:'FN16_SELECTED_EXPORT_ISOLATED_FAILURE',phase:contextual?error.failurePhase:currentPhase,...safeClassification(errorValue),frames,cleanupFailed:contextual,cleanup:contextual?safeClassification(error.cleanup):null,exitCode:1};
}
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
export type Fn16QaMode='WORKFLOW'|'BOOTSTRAP'|'SCHEMA_ONLY';
interface Config{kind:'FN16_SELECTED_EXPORT_ISOLATED_RUN';sha:string;issuedAt:string;expiresAt:string;bootstrapPassword:string;appPassword:string;migratorPassword:string;sourceManifestHash:string}
interface Binding{platform:string;uid:number;cwd:string;head:string;dirty:string;origin:string;env:NodeJS.ProcessEnv}
export function fn16QaPlan(){return{kind:'FN16_SELECTED_EXPORT_ISOLATED_PLAN',status:'PLAN_ONLY',...target,migrationCount:51,candidateMigration:target.candidate,maxResourceMs:1800000,maxWorkflowMs:120000,sourceManifestMaxBytes:4194304,sourceFileMaxBytes:33554432,sourceTotalMaxBytes:536870912,sourceEntryMax:50000,hostPublish:false,httpListen:false,actualExecuted:false,formalDbChanges:0};}
export function parseFn16QaArguments(args:readonly string[]):{mode:'PLAN_ONLY'}|{mode:Fn16QaMode;config:string}{
 if(args.length===0||args.length===1&&args[0]==='--plan')return{mode:'PLAN_ONLY'};
 const mode:Fn16QaMode=args[1]==='--bootstrap'?'BOOTSTRAP':args[1]==='--schema'?'SCHEMA_ONLY':'WORKFLOW',expected=mode==='WORKFLOW'?['--execute','--config',target.config]:['--execute',mode==='BOOTSTRAP'?'--bootstrap':'--schema','--config',target.config];
 if(args.length!==expected.length||args.some((s,i)=>s!==expected[i]))return fail();return{mode,config:target.config};
}
export function validateFn16QaConfig(v:unknown,now=Date.now()):Config{
 if(!exact(v,['kind','sha','issuedAt','expiresAt','bootstrapPassword','appPassword','migratorPassword','sourceManifestHash'])||v.kind!=='FN16_SELECTED_EXPORT_ISOLATED_RUN'||typeof v.sha!=='string'||!/^[a-f0-9]{40}$/.test(v.sha)||typeof v.sourceManifestHash!=='string'||!/^[a-f0-9]{64}$/.test(v.sourceManifestHash)||typeof v.issuedAt!=='string'||typeof v.expiresAt!=='string')return fail();
 const secrets=[v.bootstrapPassword,v.appPassword,v.migratorPassword];if(secrets.some(s=>typeof s!=='string'||!/^[a-f0-9]{64}$/.test(s))||new Set(secrets).size!==3)return fail();
 const issued=Date.parse(v.issuedAt),expires=Date.parse(v.expiresAt);if(!Number.isFinite(now)||!Number.isFinite(issued)||!Number.isFinite(expires)||issued>now||expires-now<150000||expires<=issued||expires-issued>1800000)return fail('FN16_QA_LIFETIME_REFUSED');
 return structuredClone(v) as unknown as Config;
}
export function validateFn16QaBinding(c:Config,b:Binding,mode:Fn16QaMode,now=Date.now()){
 validateFn16QaConfig(c,now);
 if(!['WORKFLOW','BOOTSTRAP','SCHEMA_ONLY'].includes(mode)||b.platform!=='linux'||b.uid!==1000||b.cwd!==target.source||b.head!==c.sha||b.dirty!==''||b.origin!=='git@github-sinsan-develop:sinsan-develop/Anvil.git'||Object.entries(b.env).some(([k,v])=>!!v&&(/^PG|^DOCKER_/.test(k)||['ANVIL_DB_CONFIG','ANVIL_MIGRATOR_CONFIG','NODE_OPTIONS','NODE_PATH'].includes(k))))return fail('FN16_QA_BINDING_REFUSED');
 return{expires:Date.parse(c.expiresAt),workDeadline:Math.min(now+120000,Date.parse(c.expiresAt)-30000)};
}
async function protectedConfig(filename:string){
 if(filename!==target.config||process.platform!=='linux'||process.getuid?.()!==1000)return fail('FN16_QA_RUNTIME_REFUSED');
 for(const dir of [target.source,'/qa-config',target.data]){const s=await fs.lstat(dir);if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==1000||await fs.realpath(dir)!==dir||dir!==target.source&&(s.mode&0o077)!==0)return fail('FN16_QA_ROOT_REFUSED');}
 const before=await fs.lstat(filename,{bigint:true});if(!before.isFile()||before.isSymbolicLink()||before.uid!==1000n||before.nlink!==1n||(before.mode&0o077n)!==0n||before.size>8192n||await fs.realpath(filename)!==filename)return fail('FN16_QA_CONFIG_PROTECTION_REFUSED');
 const handle=await fs.open(filename,'r');try{const opened=await handle.stat({bigint:true});if(opened.dev!==before.dev||opened.ino!==before.ino)return fail('FN16_QA_CONFIG_PROTECTION_REFUSED');const bytes=await handle.readFile(),after=await handle.stat({bigint:true}),final=await fs.lstat(filename,{bigint:true});if(after.size!==before.size||after.mtimeNs!==before.mtimeNs||after.ctimeNs!==before.ctimeNs||final.ino!==before.ino||final.dev!==before.dev||final.isSymbolicLink())return fail('FN16_QA_CONFIG_CHANGED');return validateFn16QaConfig(JSON.parse(bytes.toString('utf8')));}finally{await handle.close();}
}
const hash=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
async function schema(before:()=>void){
 before();const base=await buildExecutionPreparationQaSchema();before();if(base.manifest.length!==51||hash(JSON.stringify(base.manifest))!==target.baselineManifestHash||hash(base.schema)!==target.baselineSchemaHash)return fail('FN16_QA_BASELINE_CHANGED');
 const filename=target.source+'/db/migrations/'+target.candidate+'.sql.pending',s=await fs.lstat(filename);if(!s.isFile()||s.isSymbolicLink()||await fs.realpath(filename)!==filename)return fail('FN16_QA_CANDIDATE_PATH_REFUSED');const pending=await fs.readFile(filename,'utf8');before();if(hash(pending)!==target.candidateHash)return fail('FN16_QA_CANDIDATE_CHANGED');
 return{baseSql:base.schema,pendingSql:pending,manifest:[...base.manifest,{id:target.candidate,checksum:target.candidateHash}]};
}
function database(c:Config,role:'anvil_v3_bootstrap'|'anvil_v3_migrator'|'anvil_v3_app',before:()=>void):Pool{
 const password=role==='anvil_v3_app'?c.appPassword:role==='anvil_v3_migrator'?c.migratorPassword:c.bootstrapPassword;
 const options:PoolConfig={host:target.pg,port:5432,database:target.database,user:role,password,ssl:false,max:2,application_name:'anvil-fn16-isolated-qa',connectionTimeoutMillis:5000,query_timeout:5000,statement_timeout:5000};
 return executionPreparationQaDatabase(new Pool(options),before);
}
async function identity(pool:Pool,role:string,superuser:boolean){const r=(await pool.query("SELECT current_database() db,current_user role,current_setting('server_version_num')::int version,current_setting('is_superuser') super,(SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user) bypass")).rows[0];if(r.db!==target.database||r.role!==role||r.version<150000||r.version>=160000||r.super!==(superuser?'on':'off')||!superuser&&r.bypass)return fail('FN16_QA_DB_IDENTITY_REFUSED');}
async function closeAll(items:(()=>Promise<unknown>)[],expires:number){let timer:ReturnType<typeof setTimeout>|undefined;const ms=Math.min(10000,expires-Date.now());if(ms<=0)return fail('FN16_QA_CLEANUP_EXPIRED');try{const results=await Promise.race([Promise.allSettled(items.map(f=>Promise.resolve().then(f))),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Fn16QaFailure('FN16_QA_CLEANUP_TIMEOUT')),ms);})]);if(results.some(r=>r.status==='rejected'))fail('FN16_QA_CLEANUP_FAILED');}finally{if(timer)clearTimeout(timer);}}
async function bootstrap(c:Config,before:()=>void,expires:number){
 currentPhase='BOOTSTRAP_IDENTITY';const admin=database(c,'anvil_v3_bootstrap',before);let migrator:Pool|undefined,primaryError:unknown,failed=false;
 try{await identity(admin,'anvil_v3_bootstrap',true);currentPhase='BOOTSTRAP_LOGGING';const logger=(await admin.query("SELECT current_setting('log_statement') statement,current_setting('log_min_error_statement') errors")).rows[0];if(logger.statement!=='none'||logger.errors!=='fatal')fail('FN16_QA_SECRET_LOGGING_REFUSED');
  currentPhase='BOOTSTRAP_EMPTY_CHECK';const other=(await admin.query("SELECT datname FROM pg_database WHERE NOT datistemplate AND datname NOT IN('postgres',$1)",[target.database])).rows;if(other.length)fail('FN16_QA_INSTANCE_NOT_EMPTY');
  const roles=(await admin.query("SELECT rolname FROM pg_roles WHERE rolname NOT LIKE 'pg_%' AND rolname<>'anvil_v3_bootstrap'")).rows;if(roles.length)fail('FN16_QA_ROLES_NOT_EMPTY');
  const objects=(await admin.query("SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname NOT IN('information_schema','public') UNION ALL SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).rows;if(objects.length)fail('FN16_QA_INSTANCE_NOT_EMPTY');
  currentPhase='BOOTSTRAP_SCHEMA_BUILD';const built=await schema(before);before();
  currentPhase='BOOTSTRAP_ROLE_CREATE';await admin.query(`BEGIN;CREATE ROLE anvil_v3_migrator LOGIN PASSWORD '${c.migratorPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;CREATE ROLE anvil_v3_app LOGIN PASSWORD '${c.appPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;REVOKE ALL ON DATABASE ${target.database} FROM PUBLIC;GRANT CONNECT ON DATABASE ${target.database} TO anvil_v3_migrator,anvil_v3_app;GRANT TEMPORARY ON DATABASE ${target.database} TO anvil_v3_app;REVOKE CREATE ON SCHEMA public FROM PUBLIC;CREATE SCHEMA anvil AUTHORIZATION anvil_v3_migrator;CREATE SCHEMA anvil_qa AUTHORIZATION anvil_v3_migrator;GRANT USAGE ON SCHEMA anvil,anvil_qa TO anvil_v3_app;ALTER DEFAULT PRIVILEGES FOR ROLE anvil_v3_migrator IN SCHEMA anvil,anvil_qa GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anvil_v3_app;COMMIT;`);
  currentPhase='BOOTSTRAP_MIGRATOR_IDENTITY';migrator=database(c,'anvil_v3_migrator',before);await identity(migrator,'anvil_v3_migrator',false);currentPhase='BOOTSTRAP_BASELINE_APPLY';await migrator.query(built.baseSql);before();currentPhase='BOOTSTRAP_CANDIDATE_APPLY';await migrator.query("BEGIN;"+built.pendingSql+";INSERT INTO anvil.schema_migrations(id,checksum) VALUES('"+target.candidate+"','"+target.candidateHash+"');COMMIT;");
  return{kind:'FN16_ISOLATED_BOOTSTRAP_RESULT',sha:c.sha,migrationCount:52,baselineCount:51,candidate:target.candidate,actualExecuted:true,formalDbChanges:0,cleanupVerified:false};
 }catch(error){failed=true;primaryError=error;throw error;}finally{await finishFn16BootstrapCleanup({failed,primaryError,failurePhase:currentPhase},()=>closeAll([()=>admin.end(),()=>migrator?.end()??Promise.resolve()],expires));}
}

const requireOk=(v:unknown,code:string)=>{if(!v)fail(code);};
async function sourceProof(c:Config,before:()=>void):Promise<Binding>{
 const manifestPath='/qa-config/source-manifest.json',stat=await fs.lstat(manifestPath);requireOk(stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===1000&&stat.nlink===1&&(stat.mode&0o077)===0&&stat.size<=4*1024*1024&&await fs.realpath(manifestPath)===manifestPath,'FN16_QA_SOURCE_MANIFEST_PROTECTION');
 const raw=await fs.readFile(manifestPath);before();requireOk(hash(raw)===c.sourceManifestHash,'FN16_QA_SOURCE_MANIFEST_HASH');const m:unknown=JSON.parse(raw.toString('utf8'));
 if(!exact(m,['kind','sha','files'])||m.kind!=='FN16_QA_EXACT_SOURCE_MANIFEST'||m.sha!==c.sha||!Array.isArray(m.files)||!m.files.length||m.files.length>20000)return fail('FN16_QA_SOURCE_MANIFEST_REFUSED');
 const files=new Map<string,string>();for(const item of m.files as unknown[]){if(!exact(item,['path','sha256'])||typeof item.path!=='string'||item.path.length>4096||item.path.includes('\\')||item.path.split('/').some(part=>!part||part==='.'||part==='..'||part==='.git'||part==='node_modules')||path.posix.isAbsolute(item.path)||/[\x00-\x1f]/.test(item.path)||typeof item.sha256!=='string'||!/^[a-f0-9]{64}$/.test(item.sha256)||files.has(item.path))return fail('FN16_QA_SOURCE_MANIFEST_REFUSED');files.set(item.path,item.sha256);}
 const observed=new Set<string>();let visited=0,totalBytes=0;
 const walk=async(directory:string)=>{before();for(const entry of await fs.readdir(directory,{withFileTypes:true})){if(directory===target.source&&['.git','node_modules'].includes(entry.name))continue;if(++visited>50000)fail('FN16_QA_SOURCE_ENTRY_LIMIT');const full=path.posix.join(directory,entry.name),relative=path.posix.relative(target.source,full),st=await fs.lstat(full);before();if(st.isSymbolicLink()||await fs.realpath(full)!==full)fail('FN16_QA_SOURCE_LINK');if(st.isDirectory())await walk(full);else{totalBytes+=st.size;if(!st.isFile()||st.nlink!==1||st.size>32*1024*1024||totalBytes>512*1024*1024||!files.has(relative)||hash(await fs.readFile(full))!==files.get(relative))fail('FN16_QA_SOURCE_BYTES_CHANGED');observed.add(relative);}}};
 await walk(target.source);requireOk(observed.size===files.size,'FN16_QA_SOURCE_FILES_MISSING');
 const gitDir=target.source+'/.git',g=await fs.lstat(gitDir);requireOk(g.isDirectory()&&!g.isSymbolicLink()&&await fs.realpath(gitDir)===gitDir,'FN16_QA_GIT_DIRECTORY_REQUIRED');
 const readGit=async(relative:string)=>{before();const full=gitDir+'/'+relative,st=await fs.lstat(full);requireOk(st.isFile()&&!st.isSymbolicLink()&&st.size<=4*1024*1024&&await fs.realpath(full)===full,'FN16_QA_GIT_METADATA_REFUSED');return fs.readFile(full,'utf8');};
 let head=(await readGit('HEAD')).trim();if(head.startsWith('ref: ')){const reference=head.slice(5);requireOk(/^refs\/heads\/[A-Za-z0-9/_-]+$/.test(reference)&&!reference.split('/').includes('..'),'FN16_QA_GIT_REF_REFUSED');try{head=(await readGit(reference)).trim();}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;const packed=await readGit('packed-refs'),matches=packed.split('\n').filter(line=>line.endsWith(' '+reference));requireOk(matches.length===1,'FN16_QA_GIT_REF_REFUSED');head=matches[0]!.split(' ')[0]!;}}
 const gitConfig=await readGit('config');let section='',origin='';for(const line of gitConfig.split(/\r?\n/)){const next=/^\s*\[([^\]]+)\]/.exec(line);if(next){section=next[1]!;if(/^include/i.test(section))fail('FN16_QA_GIT_INCLUDE_REFUSED');continue;}if(section==='remote "origin"'){const url=/^\s*url\s*=\s*(.+?)\s*$/.exec(line);if(url)origin=url[1]!;}}
 before();return{platform:process.platform,uid:process.getuid?.()??-1,cwd:process.cwd(),head,dirty:'',origin,env:process.env};
}
async function workflow(c:Config,before:()=>void,expires:number){
 const pool=database(c,'anvil_v3_app',before),seed=database(c,'anvil_v3_migrator',before);let app:ReturnType<typeof buildApp>|undefined,second:Pool|undefined;
 try{
  await identity(pool,'anvil_v3_app',false);await identity(seed,'anvil_v3_migrator',false);const built=await schema(before),actual=(await pool.query('SELECT id,checksum FROM anvil.schema_migrations ORDER BY id COLLATE "C"')).rows,expected=[...built.manifest].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);requireOk(JSON.stringify(actual)===JSON.stringify(expected),'FN16_QA_SCHEMA_MANIFEST_MISMATCH');
  for(const table of ['users','projects','artifacts','documents','project_artifact_exports'])requireOk((await seed.query('SELECT count(*)::int n FROM anvil.'+table)).rows[0].n===0,'FN16_QA_WORKFLOW_NOT_EMPTY');
  for(const root of [target.artifactRoot,target.exportRoot])try{await fs.lstat(root);fail('FN16_QA_DATA_ALREADY_EXISTS');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  before();await fs.mkdir(target.artifactRoot,{mode:0o700});before();await fs.mkdir(target.exportRoot,{mode:0o700});
  currentPhase='FORM_SEED';const forms=buildOfficialForms(await fs.readFile(target.source+'/docs/design/공식산출물_양식정의.md'),await fs.readFile(target.source+'/docs/design/문서작성_공통기준.md')),catalog=await seed.connect();
  try{await catalog.query('BEGIN');await seedOfficialForms(catalog,forms);await catalog.query('COMMIT');}catch(e){await catalog.query('ROLLBACK');throw e;}finally{catalog.release();}
  currentPhase='SYNTHETIC_USER';const user=randomUUID(),project=randomUUID(),password=randomBytes(32).toString('base64url'),phc=await hashPassword(password),installationId=randomUUID(),key=randomBytes(32);before();
  await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'FN16 격리 합성 QA','ACTIVE')",[user,'qa-fn16-'+user]);await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)',[user,phc]);
  const access=new AccessRepository(pool,{installationId,key});app=buildApp({},undefined,{repository:access,origin:'https://localhost:3830',artifactRoot:target.artifactRoot,exportRoot:target.exportRoot});
  currentPhase='LOGIN';const origin={host:'localhost:3830',origin:'https://localhost:3830'},login=await app.inject({method:'POST',url:'/api/v1/auth/login',headers:origin,payload:{loginName:'qa-fn16-'+user,password,clientLabel:'FN16 격리 QA'}});before();requireOk(login.statusCode===200,'FN16_QA_LOGIN_ROUTE_FAILED');
  function readToken(response:{headers:Record<string,unknown>}){const raw=response.headers['set-cookie'],cookie=Array.isArray(raw)?raw[0]:raw,match=typeof cookie==='string'?/^__Host-anvil.sid=([A-Za-z0-9_-]{43});/.exec(cookie):null;if(!match)return fail('FN16_QA_LOGIN_COOKIE_INVALID');return match[1]!;}
  let token=readToken(login),session=login.json();requireOk(session.user?.id===user&&typeof session.clientId==='string'&&/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken),'FN16_QA_LOGIN_RESPONSE_INVALID');
  await seed.query("INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,'FN16 일회 격리 QA','선택 원본 별도 보관','고정 원문·사본 조회')",[project]);await seed.query("INSERT INTO anvil.project_members(project_id,user_id,participation) VALUES($1,$2,'OWNER')",[project,user]);await seed.query('INSERT INTO anvil.project_control(project_id,actor_id,client_id,generation) VALUES($1,$2,$3,1)',[project,user,session.clientId]);
  currentPhase='REAUTH';const renewed=await app.inject({method:'POST',url:'/api/v1/auth/reauthenticate',headers:{...origin,cookie:'__Host-anvil.sid='+token,'x-anvil-csrf':session.csrfToken},payload:{password}});before();requireOk(renewed.statusCode===200,'FN16_QA_REAUTH_ROUTE_FAILED');token=readToken(renewed);session=renewed.json();
  const headers={...origin,cookie:'__Host-anvil.sid='+token,'x-anvil-csrf':session.csrfToken},base={schemaVersion:1 as const,projectId:project,commandId:randomUUID(),clientId:session.clientId as string,controlGeneration:1,operation:'savePermissionPolicy',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null};
  const send=async(command:Record<string,unknown>)=>{before();const r=await app!.inject({method:'POST',url:`/api/v1/projects/${project}/commands`,headers,payload:command});before();return r;};
  currentPhase='POLICY';const policy=await send({...base,payload:{rules:[{ruleId:'FN16_SYNTHETIC_ONLY',subjectRef:{kind:'HUMAN',userId:user},targetScopes:[{kind:'PROJECT',projectId:project}],operations:['uploadArtifact','saveDocumentDraft','exportProject'],disposition:'AUTO',limitPolicyRef:null,expiresAt:c.expiresAt}],reason:'격리 합성 원본 수동 반출 검수',reviewRefs:[]}});requireOk(policy.statusCode===200,'FN16_QA_POLICY_ROUTE_FAILED');
  const bytes=Buffer.from('# FN16 합성 원문\n고정 버전의 별도 복사본 확인\n'),uploadCommand={...base,commandId:randomUUID(),operation:'uploadArtifact',payload:{mediaType:'text/plain;charset=utf-8',bytes:bytes.length,contentHash:hash(bytes)}};
  currentPhase='FILE_POST';before();const upload=await app.inject({method:'POST',url:`/api/v1/projects/${project}/files`,headers:{...headers,'content-type':'application/octet-stream','x-anvil-command':JSON.stringify(uploadCommand)},payload:bytes});before();requireOk(upload.statusCode===201,'FN16_QA_FILE_ROUTE_FAILED');const artifact=upload.json().data.artifactRef;
  const form=await app.inject({method:'GET',url:'/api/v1/forms/a6f30000-0000-4000-8000-000000000001/versions/1',headers});before();requireOk(form.statusCode===200,'FN16_QA_FORM_ROUTE_FAILED');
  currentPhase='DOCUMENT_SAVE';const saved=await send({...base,commandId:randomUUID(),operation:'saveDocumentDraft',payload:{title:'FN16 합성 고정 원문',formRef:form.json().ref,stageNodeRef:null,content:{body:artifact,attachments:[],sections:[],sourceRefs:[]},importCandidateRef:null,reason:'격리 검수 문서 저장'}});requireOk(saved.statusCode===200,'FN16_QA_DOCUMENT_ROUTE_FAILED');const documentRef=saved.json().data.ref;
  const exportCommand={...base,commandId:randomUUID(),operation:'exportProject',payload:{includeSource:false,selection:{kind:'DOCUMENT_ARTIFACT',documentRef,artifactRef:artifact},reason:'합성 원본 1개 별도 보관'}};
  currentPhase='EXPORT_ROUTE';const first=await send(exportCommand);requireOk(first.statusCode===200,'FN16_QA_EXPORT_ROUTE_FAILED');const receipt=first.json();requireOk(receipt.data?.status==='EXPORT_STORED','FN16_QA_EXPORT_RECEIPT_INVALID');const replay=await send(exportCommand);requireOk(replay.statusCode===200&&JSON.stringify(replay.json())===JSON.stringify(receipt),'FN16_QA_EXPORT_ROUTE_REPLAY_FAILED');
  currentPhase='PG_ASSERTIONS';const runner=await runProjectArtifactExportPg({kind:'FN16_ISOLATED_PG_QA',qaRoot:target.data,artifactRoot:target.artifactRoot,exportRoot:target.exportRoot,connection:{host:target.pg,port:5432,database:target.database,user:'anvil_v3_app',password:c.appPassword,ssl:false},installationId,authKeyHex:key.toString('hex'),sessionToken:token,csrfToken:session.csrfToken,command:exportCommand,expectedBytesHex:bytes.toString('hex')},{before,queryMs:5000,expires});before();
  requireOk(JSON.stringify(runner.ref)===JSON.stringify(receipt.data.ref),'FN16_QA_RUNNER_REPLAY_REF_MISMATCH');
  currentPhase='OTHER_CONNECTION';second=database(c,'anvil_v3_app',before);await identity(second,'anvil_v3_app',false);const independent=buildApp({},undefined,{repository:new AccessRepository(second,{installationId,key}),origin:'https://localhost:3830',artifactRoot:target.artifactRoot,exportRoot:target.exportRoot});
  try{
   const url=`/api/v1/projects/${project}/backups/${receipt.data.ref.id}`,job=await independent.inject({method:'GET',url,headers});before();requireOk(job.statusCode===200&&JSON.stringify(job.json().ref)===JSON.stringify(receipt.data.ref),'FN16_QA_OTHER_CONNECTION_JOB_FAILED');
   const download=await independent.inject({method:'GET',url:url+'/file',headers});before();requireOk(download.statusCode===200&&download.rawPayload.equals(bytes),'FN16_QA_OTHER_CONNECTION_COPY_FAILED');
   const original=path.posix.join(target.artifactRoot,'blobs',project,artifact.artifactId),preserved=original+'.fn16-preserved';const originalStat=await fs.lstat(original,{bigint:true});requireOk(originalStat.isFile()&&!originalStat.isSymbolicLink()&&originalStat.uid===1000n&&originalStat.nlink===1n&&hash(await fs.readFile(original))===hash(bytes),'FN16_QA_SYNTHETIC_ORIGINAL_IDENTITY');
   try{await fs.lstat(preserved);fail('FN16_QA_PRESERVED_ALREADY_EXISTS');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
   currentPhase='ORIGINAL_MOVE';before();await fs.rename(original,preserved);
   try{const missing=await independent.inject({method:'GET',url:`/api/v1/projects/${project}/files/${artifact.artifactId}`,headers});before();requireOk(missing.statusCode===503,'FN16_QA_ORIGINAL_NOT_MISSING');const retained=await independent.inject({method:'GET',url,headers}),copy=await independent.inject({method:'GET',url:url+'/file',headers});before();requireOk(retained.statusCode===200&&JSON.stringify(retained.json().ref)===JSON.stringify(receipt.data.ref)&&copy.statusCode===200&&copy.rawPayload.equals(bytes),'FN16_QA_COPY_DEPENDS_ON_ORIGINAL');}
   finally{currentPhase='ORIGINAL_RESTORE';requireOk(Date.now()<expires,'FN16_QA_RESTORE_WINDOW_EXPIRED');const preservedStat=await fs.lstat(preserved,{bigint:true});requireOk(preservedStat.dev===originalStat.dev&&preservedStat.ino===originalStat.ino&&!preservedStat.isSymbolicLink()&&hash(await fs.readFile(preserved))===hash(bytes),'FN16_QA_PRESERVED_CHANGED');try{await fs.lstat(original);fail('FN16_QA_ORIGINAL_REPLACED');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}await fs.rename(preserved,original);}
  }finally{await closeAll([()=>independent.close()],expires);}
  return{kind:'FN16_SELECTED_EXPORT_ISOLATED_WORKFLOW_RESULT',sha:c.sha,ref:receipt.data.ref,bytes:bytes.length,markers:['FIXED_51_PLUS_0043','STANDARD_LOGIN_REAUTH_POLICY_ROUTES','ACTUAL_FILE_POST_DOCUMENT_SAVE','EXPORT_ROUTE_COMMIT_REPLAY','SEPARATE_CONNECTION_JOB_COPY','ORIGINAL_MOVED_COPY_INDEPENDENT_ORIGINAL_RESTORED',...runner.checks],actualExecuted:true,formalDbChanges:0,servedBrowserVerified:false,userAcceptance:false,cleanupVerified:false};
 }finally{await closeAll([()=>app?.close()??Promise.resolve(),()=>pool.end(),()=>seed.end(),()=>second?.end()??Promise.resolve()],expires);}
}
export async function runFn16Isolated(args:readonly string[]){
 currentPhase='ENTRY';const entry=parseFn16QaArguments(args);if(entry.mode==='PLAN_ONLY')return fn16QaPlan();
 if(process.cwd()!==target.source||Object.entries(process.env).some(([k,v])=>!!v&&(/^PG|^DOCKER_/.test(k)||['ANVIL_DB_CONFIG','ANVIL_MIGRATOR_CONFIG','NODE_OPTIONS','NODE_PATH'].includes(k))))fail('FN16_QA_BINDING_REFUSED');
 currentPhase='CONFIG';const c=await protectedConfig(entry.config),started=Date.now(),deadline=Math.min(started+120000,Date.parse(c.expiresAt)-30000),expires=Date.parse(c.expiresAt),monotonicDeadline=performance.now()+Math.min(120000,deadline-started);
 const before=()=>{if(Date.now()>=deadline-5000||performance.now()>=monotonicDeadline-5000)fail('FN16_QA_WORK_DEADLINE');};before();
 currentPhase='SOURCE';const binding=await sourceProof(c,before);validateFn16QaBinding(c,binding,entry.mode,started);before();
 if(entry.mode==='SCHEMA_ONLY'){currentPhase='SCHEMA';const built=await schema(before);return{kind:'FN16_SELECTED_EXPORT_SCHEMA_ONLY',sha:c.sha,baselineCount:51,candidate:target.candidate,manifest:built.manifest,baseSql:built.baseSql,pendingSql:built.pendingSql,actualExecuted:false,formalDbChanges:0};}
 if(entry.mode==='BOOTSTRAP'){currentPhase='BOOTSTRAP';return bootstrap(c,before,expires);}
 currentPhase='WORKFLOW';return workflow(c,before,expires);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await runFn16Isolated(process.argv.slice(2))));}catch(error){console.error(JSON.stringify(fn16QaDiagnostic(error)));process.exitCode=1;}}
