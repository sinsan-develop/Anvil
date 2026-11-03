#!/usr/bin/env bash
# SOURCE_ONLY. source/default/--plan은 외부 자원을 읽거나 만들지 않는다.
if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then return 0; fi
# Node 본문 실행 전 preload/외부 환경 혼용을 값 출력 없이 거절한다.
for ix01_name in NODE_OPTIONS NODE_PATH ANVIL_DB_CONFIG ANVIL_MIGRATOR_CONFIG ANVIL_AUTH_CONFIG ${!DOCKER_@} ${!PG@}; do
  if [[ -n "${!ix01_name-}" ]]; then printf '%s\n' 'IX01_ENV_OVERRIDE_REJECTED' >&2; exit 1; fi
done
# --run만 기존 등록 runtime을 Node 기동 전에 확인한다. 현재 구현 검증에서는 호출하지 않는다.
ix01_node=/usr/local/bin/node
if [[ "${1-}" == --run ]]; then
  [[ "$#" == 1 && "$(/usr/bin/readlink -f /usr/local/bin/node)" == /opt/node-v24.22.1-linux-x64/bin/node ]] || { printf '%s\n' 'IX01_NODE24_REQUIRED' >&2; exit 1; }
  [[ ! -L /opt/node-v24.22.1-linux-x64/bin/node && "$(/usr/bin/stat -c '%u:%g:%a:%s' /opt/node-v24.22.1-linux-x64/bin/node)" == 0:0:755:126879696 ]] || { printf '%s\n' 'IX01_NODE24_REQUIRED' >&2; exit 1; }
  ix01_digest=$(/usr/bin/timeout --kill-after=1s 10s /usr/bin/sha256sum /opt/node-v24.22.1-linux-x64/bin/node) || { printf '%s\n' 'IX01_NODE24_REQUIRED' >&2; exit 1; }
  [[ "${ix01_digest%% *}" == e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb ]] || { printf '%s\n' 'IX01_NODE24_REQUIRED' >&2; exit 1; }
  ix01_node=/opt/node-v24.22.1-linux-x64/bin/node
fi
[[ -x "$ix01_node" ]] || { printf '%s\n' 'IX01_NODE24_REQUIRED' >&2; exit 1; }
# 부모 Bash도 외부 실행기가 BASH_ENV 없는 --noprofile/--norc 환경으로 시작해야 한다.
exec /usr/bin/env -i PATH=/usr/local/bin:/usr/bin:/bin LANG=C.UTF-8 LC_ALL=C.UTF-8 \
  ANVIL_IX01_DDL_OPT_IN="${ANVIL_IX01_DDL_OPT_IN-}" \
  ANVIL_IX01_DDL_PLAN="${ANVIL_IX01_DDL_PLAN-}" \
  ANVIL_IX01_DDL_PLAN_SHA256="${ANVIL_IX01_DDL_PLAN_SHA256-}" \
  "$ix01_node" --input-type=module - "$@" <<'IX01_NODE'
// IX01_CONTROLLER_BEGIN
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,lstat,realpath,readdir,open} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {constants,openSync,closeSync,lstatSync,fstatSync,realpathSync,readdirSync} from 'node:fs';
export const fixed=Object.freeze({sourceHead:'0a647daa66103ada3bd5e949b64f407c3e7b5687',daemon:'e3349f1d-dbfc-478a-96d9-295bf6c6839e',image:'sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f',receiptRoot:'/home/daon/.local/share/anvil-v3-qa-receipts/ix01-ddl-20261104-r4',owner:'IX01_DDL_20261104_R4',index:'docs/04_test_reports/AV3/IX01/DDL_SOURCE_ALLOWLIST_20261104_R4.tsv'});
const hash=x=>createHash('sha256').update(x).digest('hex'),hex=(x,n)=>typeof x==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(x);
const fail=code=>{throw Error('IX01_'+code);};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const iso=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;

export function childEnv(){return Object.freeze({PATH:'/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',HOME:fixed.receiptRoot+'/docker-config',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_SYSTEM:'/dev/null',GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_COUNT:'0',GIT_ATTR_NOSYSTEM:'1',GIT_OPTIONAL_LOCKS:'0',GIT_NO_REPLACE_OBJECTS:'1',GIT_NO_LAZY_FETCH:'1',GIT_TERMINAL_PROMPT:'0',GIT_PAGER:'cat'});}
export function dockerArgs(args){return['--config',fixed.receiptRoot+'/docker-config','--host','unix:///var/run/docker.sock',...args];}
export function daemonInfoArgs(){return['info','--format','{"ID":{{json .ID}},"Name":{{json .Name}}}'];}
export function parseDaemonInfo(raw){let value;try{if(typeof raw!=='string'||Buffer.byteLength(raw)>512)fail('DAEMON_FIELDS');value=JSON.parse(raw);}catch{fail('DAEMON_FIELDS');}if(!exact(value,['ID','Name'])||(raw.match(/"(?:ID|Name)"\s*:/g)??[]).length!==2||typeof value.ID!=='string'||!/^[a-f0-9-]{36}$/.test(value.ID)||typeof value.Name!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(value.Name))fail('DAEMON_FIELDS');return{ID:value.ID,Name:value.Name};}
export function gitArgs(cwd,args){return['--no-pager','--no-optional-locks','--no-replace-objects','-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null','-c','core.attributesFile=/dev/null','-c','core.excludesFile=/dev/null','-c','core.untrackedCache=false','-C',cwd,...args];}
export function gitConfigAllowed(raw){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>16384)fail('GIT_CONFIG');
 for(const entry of raw.split('\0').filter(Boolean)){const key=entry.split('\n')[0].toLowerCase();if(/^(include\.|includeif\.|filter\.|alias\.|extensions\.)/.test(key)||/^(core\.(fsmonitor|sshcommand|hookspath|worktree)|remote\..*\.(promisor|vcs|uploadpack|receivepack)|url\.)/.test(key))fail('GIT_CONFIG');}
 return true;
}
export function parentMetadata(stat,uid){if(!stat.directory||stat.symlink||![0,uid].includes(stat.uid)||(stat.mode&0o022)!==0)fail('PARENT_CHAIN');return true;}
// 디렉터리 fd를 보존하고 매 child 실행/원장 IO 앞에 inode와 경로를 다시 대조한다.
function captureChain(path,uid){
 const owned=[];try{for(const part of path.split('/').filter(Boolean).reduce((a,x)=>[...a,a.at(-1)==='/'?'/'+x:a.at(-1)+'/'+x],['/'])){const s=lstatSync(part);parentMetadata({directory:s.isDirectory(),symlink:s.isSymbolicLink(),uid:s.uid,mode:s.mode},uid);if(realpathSync(part)!==part)fail('PARENT_CHAIN');const fd=openSync(part,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW),f=fstatSync(fd);owned.push({path:part,fd,dev:f.dev,ino:f.ino});if(s.dev!==f.dev||s.ino!==f.ino)fail('PARENT_CHAIN');}
  return{verify(){for(const x of owned){const s=lstatSync(x.path),f=fstatSync(x.fd);parentMetadata({directory:s.isDirectory(),symlink:s.isSymbolicLink(),uid:s.uid,mode:s.mode},uid);if(realpathSync(x.path)!==x.path||s.dev!==x.dev||s.ino!==x.ino||f.dev!==x.dev||f.ino!==x.ino)fail('PARENT_CHAIN');}},close(){for(const x of owned.reverse())closeSync(x.fd);}};
 }catch(error){for(const x of owned.reverse())closeSync(x.fd);throw error;}
}
export function safeFailure(error){
 const codes=['PLAN_SHAPE','BINDING','SLOT','TTL','SELECTION','INDEX_HASH','INDEX','INDEX_COUNT','SOURCE','TOTAL','WORK_EXPIRED','EXPIRED','PREFLIGHT','PREVIOUS','NODE24_REQUIRED','MODE','PLAN_HASH','HOST','ENV','GIT','GIT_CONFIG','PARENT_CHAIN','DOCKER_CONFIG','RECEIPT_OWNER','RECEIPT_CONTENTS','RECEIPT_MARKER','RECEIPT_SIZE','SOCKET','DAEMON_HOST','DAEMON_FIELDS','SOURCE_READ','DATABASE'];
 return codes.some(x=>error instanceof Error&&error.message==='IX01_'+x)?{status:'PREPARATION_REJECTED',code:error.message}:{status:'UNKNOWN',code:'IX01_OUTCOME_UNKNOWN'};
}
export function validatePlan(p,now){
 if(!exact(p,['schemaVersion','purpose','sourceHead','executionHead','indexHash','orderHash','slot','issuedAt','expiresAt','slotExpiresAt','uid','cwd','instance','daemon','image','selected','previousHash','receiptOwnerHash'])||p.schemaVersion!==1||p.purpose!=='IX01_DDL_DIAGNOSTIC')fail('PLAN_SHAPE');
 if(p.sourceHead!==fixed.sourceHead||!hex(p.executionHead,40)||!hex(p.indexHash,64)||!hex(p.orderHash,64)||!hex(p.receiptOwnerHash,64)||!hex(p.instance,32)||p.daemon!==fixed.daemon||p.image!==fixed.image||p.uid!==1000||p.cwd!=='/home/daon/anvil-ix01-ddl-20261104-r4-qa')fail('BINDING');
 if(![1,2,3].includes(p.slot)||!(p.slot===1?p.previousHash===null:hex(p.previousHash,64)))fail('SLOT');
 if(!iso(p.issuedAt)||!iso(p.expiresAt)||!iso(p.slotExpiresAt)||Date.parse(p.issuedAt)>now||Date.parse(p.expiresAt)<=now||Date.parse(p.expiresAt)-Date.parse(p.issuedAt)>1800000||Date.parse(p.slotExpiresAt)>Date.parse(p.expiresAt)||Date.parse(p.slotExpiresAt)<=now+60000||Date.parse(p.slotExpiresAt)-now>600000)fail('TTL');
 if(!Array.isArray(p.selected)||p.selected.length<1||p.selected.length>106||new Set(p.selected).size!==p.selected.length||p.selected.some(x=>typeof x!=='string'||!/^db\/migrations\/[a-z0-9_]+\.sql(?:\.pending)?$/.test(x))||hash(JSON.stringify(p.selected))!==p.orderHash)fail('SELECTION');
 return structuredClone(p);
}
export function parseIndex(raw,p){
 if(hash(raw)!==p.indexHash)fail('INDEX_HASH');
 const rows=raw.split('\n').filter(x=>x&&!x.startsWith('#'));if(rows.shift()!=='path\tid\tsha256\tbytes')fail('INDEX');
 if(rows.length!==106||!raw.includes('# baseline='+fixed.sourceHead+'\n'))fail('INDEX_COUNT');
 const map=new Map();for(const line of rows){const x=line.split('\t');if(x.length!==4||!/^db\/migrations\/[a-z0-9_]+\.sql(?:\.pending)?$/.test(x[0])||x[1]!==x[0].split('/').at(-1).replace(/\.sql(?:\.pending)?$/,'')||!hex(x[2],64)||! /^(0|[1-9][0-9]*)$/.test(x[3])||map.has(x[0]))fail('INDEX');map.set(x[0],{hash:x[2],bytes:Number(x[3])});}
 return map;
}
export class UnknownOutcome extends Error{constructor(){super('IX01_OUTCOME_UNKNOWN');this.statementEndLine=null;}}
export class DdlFailure extends Error{constructor(state='XXXXX',diagnostic=null,statementEndLine=null){super('IX01_DDL_REJECTED');this.sqlState=/^[A-Z0-9]{5}$/.test(state)?state:'XXXXX';this.diagnostic=diagnostic;this.statementEndLine=Number.isSafeInteger(statementEndLine)&&statementEndLine>0?statementEndLine:null;}}
const roleDiagnostics=Object.freeze(['ROLE_QUERY_TIMEOUT','ROLE_QUERY_REJECTED','ROLE_QUERY_OUTPUT_REJECTED','ROLE_METADATA_REJECTED','ROLE_QUERY_UNKNOWN']);
class RoleObservationFailure extends UnknownOutcome{constructor(code){super();this.diagnostic=roleDiagnostics.includes(code)?code:'ROLE_QUERY_UNKNOWN';}}
const roleQueryFailure=error=>error instanceof RoleObservationFailure&&roleDiagnostics.includes(error.diagnostic)?error:new RoleObservationFailure(error?.code==='ETIMEDOUT'?'ROLE_QUERY_TIMEOUT':error?.code==='ENOBUFS'?'ROLE_QUERY_OUTPUT_REJECTED':!error?.signal&&!error?.code&&Number.isInteger(error?.status)&&error.status>0?'ROLE_QUERY_REJECTED':'ROLE_QUERY_UNKNOWN');
export function finalServerArgs(id){if(!hex(id,64))fail('CONTAINER_ID');return['exec','--user','999:999',id,'cat','/proc/1/comm'];}
export function parseFinalServer(raw){if(raw==='postgres\n')return true;if(raw==='bash\n'||raw==='docker-entrypoi\n')return false;throw new UnknownOutcome();}
export async function observeFinalServer(id,ms,read){return parseFinalServer(await read(finalServerArgs(id),ms));}
const tmpfs=Object.freeze({'/var/lib/postgresql/data':'rw,noexec,nosuid,size=268435456,uid=999,gid=999','/var/run/postgresql':'rw,noexec,nosuid,size=16777216,uid=999,gid=999','/tmp':'rw,noexec,nosuid,size=16777216,uid=999,gid=999'});
const resource=p=>({container:'anvil-ix01-ddl-pg-20261104-r4-a'+p.slot,database:'anvil_v3_ix01_ddl_20261104_r4_a'+p.slot});
// VERBOSITY=verbose의 ERROR 한 줄만 허용한다. SQL/LOCATION/임의 stderr는 결과에 복사하지 않는다.
export function parsePsqlFailure(error){
 if(error?.status!==3||error?.signal||error?.code||typeof error.stderr!=='string'||Buffer.byteLength(error.stderr)>16384)return new UnknownOutcome();
 const lines=error.stderr.split(/\r?\n/).filter(x=>/\bERROR:/.test(x));if(lines.length!==1)return new UnknownOutcome();
 const m=lines[0].match(/(?:^|\s)ERROR:\s+([A-Z0-9]{5}):\s*(.*)$/);if(!m)return new UnknownOutcome();
 const state=m[1],message=m[2],identifier='[a-z_][a-z0-9_]{0,62}',qualified='(?:anvil\\.|pg_catalog\\.)?'+identifier;let diagnostic=null,x;
 if(state==='42P01'&&(x=message.match(new RegExp('^relation "('+qualified+')" does not exist$'))))diagnostic={kind:'RELATION',identifier:x[1]};
 if(state==='42883'&&(x=message.match(new RegExp('^function ('+qualified+')\\([a-z0-9_., \\[\\]]{0,512}\\) does not exist$'))))diagnostic={kind:'FUNCTION',identifier:x[1]};
 if(state==='42703'&&(x=message.match(new RegExp('^column "('+identifier+')"(?: of relation "'+qualified+'")? does not exist$'))))diagnostic={kind:'COLUMN',identifier:x[1]};
 const prefix=lines[0].match(/^psql:<stdin>:([1-9][0-9]{0,15}):\s+ERROR:/),line=prefix&&((lines[0].match(/psql:<stdin>:/g)??[]).length===1)?Number(prefix[1]):null;
 return new DdlFailure(state,diagnostic,line);
}
export function makeCommandRunner(verify,execute,env,cwd){return(file,args,input,ms=10000,purpose='DEFAULT')=>{if(!['DEFAULT','FINAL_SERVER','ROLE_OBSERVATION'].includes(purpose))throw new UnknownOutcome();verify();try{const raw=execute(file,args,{env,cwd,input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:ms,maxBuffer:16384});return purpose==='FINAL_SERVER'?raw:raw.trim();}catch(error){if(purpose==='ROLE_OBSERVATION')throw roleQueryFailure(error);throw args.includes('psql')?parsePsqlFailure(error):new UnknownOutcome();}};}
export function buildPsqlArgs(id,db,user){return['exec','-i','--user','999:999',id,'psql','--no-psqlrc','--no-password','--quiet','--no-align','--tuples-only','--host=/var/run/postgresql','--username='+user,'--dbname='+db,'--set=ON_ERROR_STOP=on','--set=VERBOSITY=verbose','--set=SHOW_CONTEXT=never','--set=ECHO=none','--file=-'];}
export function buildCreateArgs(p,h,m=tmpfs){return['create','--pull','never','--name',resource(p).container,'--network','none','--user','999:999','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--log-driver','none','--pids-limit','64','--memory','512m','--cpus','1',...Object.entries(m).flatMap(([k,v])=>['--tmpfs',k+':'+v]),'--label','anvil.owner='+fixed.owner,'--label','anvil.instance='+p.instance,'--label','anvil.plan='+h,'--env','POSTGRES_USER=anvil_v3_bootstrap','--env','POSTGRES_DB='+resource(p).database,'--env','POSTGRES_HOST_AUTH_METHOD=trust','--env','POSTGRES_INITDB_ARGS=--auth-local=trust --auth-host=reject',fixed.image,'postgres','-c','listen_addresses=','-c','log_statement=none','-c','log_min_error_statement=fatal'];}
export function bootstrapSql(database){if(!/^anvil_v3_ix01_ddl_20261104_r4_a[123]$/.test(database))fail('DATABASE');return 'BEGIN;CREATE ROLE anvil_v3_migrator LOGIN INHERIT NOSUPERUSER NOCREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS;CREATE ROLE anvil_v3_app LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;REVOKE ALL ON DATABASE '+database+' FROM PUBLIC;GRANT CONNECT ON DATABASE '+database+' TO anvil_v3_migrator,anvil_v3_app;REVOKE CREATE ON SCHEMA public FROM PUBLIC;CREATE SCHEMA anvil AUTHORIZATION anvil_v3_migrator;CREATE SCHEMA anvil_qa AUTHORIZATION anvil_v3_migrator;GRANT USAGE ON SCHEMA anvil,anvil_qa TO anvil_v3_app;ALTER DEFAULT PRIVILEGES FOR ROLE anvil_v3_migrator IN SCHEMA anvil,anvil_qa GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anvil_v3_app;COMMIT;';}


const readerSources=Object.freeze({'anvil_v3_fn16_export_reader_owner':'db/migrations/0066_export_locked_metadata_reader.sql.pending','anvil_v3_fn15_reader_owner':'db/migrations/0073_control_handoff_acceptance.sql.pending'});
const systemRoles=Object.freeze(['pg_database_owner','pg_read_all_data','pg_write_all_data','pg_monitor','pg_read_all_settings','pg_read_all_stats','pg_stat_scan_tables','pg_read_server_files','pg_write_server_files','pg_execute_server_program','pg_signal_backend','pg_checkpoint']);
export function roleMetadataSql(){return "SELECT json_build_object('sessionUser',session_user,'currentUser',current_user,'roles',(SELECT COALESCE(json_agg(json_build_object('name',rolname,'superuser',rolsuper,'inherit',rolinherit,'createRole',rolcreaterole,'createDb',rolcreatedb,'replication',rolreplication,'bypassRls',rolbypassrls,'login',rolcanlogin,'validUntil',rolvaliduntil) ORDER BY rolname),'[]'::json) FROM pg_catalog.pg_roles),'memberships',(SELECT COALESCE(json_agg(json_build_object('role',r.rolname,'member',m.rolname,'grantor',g.rolname,'adminOption',a.admin_option) ORDER BY r.rolname,m.rolname),'[]'::json) FROM pg_catalog.pg_auth_members a JOIN pg_catalog.pg_roles r ON r.oid=a.roleid JOIN pg_catalog.pg_roles m ON m.oid=a.member JOIN pg_catalog.pg_roles g ON g.oid=a.grantor))::text;";}
export function verifyRoleMetadata(raw,phase,attempted=[],completed=[]){
 const reject=()=>fail('ROLE_METADATA');let v;
 try{if(typeof raw!=='string'||Buffer.byteLength(raw)>16384)reject();v=JSON.parse(raw);if(raw.replace(/\s/g,'')!==JSON.stringify(v))reject();}catch{reject();}
 if(!['PRISTINE','INSTALLER','SETTLED','REVOKED'].includes(phase)||!exact(v,['sessionUser','currentUser','roles','memberships'])||v.sessionUser!=='anvil_v3_bootstrap'||v.currentUser!=='anvil_v3_bootstrap'||!Array.isArray(v.roles)||v.roles.length>17||!Array.isArray(v.memberships)||v.memberships.length>5)reject();
 const names=new Set(),ordinary=[],system=[];
 for(const row of v.roles){if(!exact(row,['name','superuser','inherit','createRole','createDb','replication','bypassRls','login','validUntil'])||typeof row.name!=='string'||names.has(row.name)||row.validUntil!==null||['superuser','inherit','createRole','createDb','replication','bypassRls','login'].some(k=>typeof row[k]!=='boolean'))reject();names.add(row.name);
  const boot=row.name==='anvil_v3_bootstrap',installer=row.name==='anvil_v3_migrator',app=row.name==='anvil_v3_app',reader=Object.hasOwn(readerSources,row.name),sys=systemRoles.includes(row.name);
  if(!boot&&!installer&&!app&&!reader&&!sys||phase==='PRISTINE'&&!boot&&!sys||reader&&(!['SETTLED','REVOKED'].includes(phase)||!attempted.includes(readerSources[row.name])))reject();
  const expected={superuser:boot,inherit:!reader,createRole:boot||installer&&phase!=='REVOKED',createDb:boot,replication:boot,bypassRls:boot,login:boot||installer||app};
  for(const [key,value]of Object.entries(expected))if(row[key]!==value)reject();(sys?system:ordinary).push(row);
 }
 if(!names.has('anvil_v3_bootstrap')||systemRoles.some(x=>!names.has(x))||phase!=='PRISTINE'&&(!names.has('anvil_v3_migrator')||!names.has('anvil_v3_app')))reject();
 for(const [name,path]of Object.entries(readerSources))if(completed.includes(path)&&!names.has(name))reject();
 const privileged=[],systemMembers=[],seen=new Set();
 for(const row of v.memberships){if(!exact(row,['role','member','grantor','adminOption'])||typeof row.adminOption!=='boolean'||[row.role,row.member,row.grantor].some(x=>!names.has(x)))reject();const key=row.role+':'+row.member;if(seen.has(key))reject();seen.add(key);
  if(['pg_read_all_settings','pg_read_all_stats','pg_stat_scan_tables'].includes(row.role)&&row.member==='pg_monitor'&&row.grantor==='anvil_v3_bootstrap'&&!row.adminOption)systemMembers.push(row);
  else if(Object.hasOwn(readerSources,row.role)&&row.member==='anvil_v3_migrator'&&row.grantor==='anvil_v3_migrator'&&row.adminOption&&phase==='SETTLED')privileged.push(row);
  else reject();
 }
 if(systemMembers.length!==3)reject();
 ordinary.sort((a,b)=>a.name.localeCompare(b.name));system.sort((a,b)=>a.name.localeCompare(b.name));systemMembers.sort((a,b)=>a.role.localeCompare(b.role));privileged.sort((a,b)=>a.role.localeCompare(b.role));
 return Object.freeze({rawHash:hash(raw),systemHash:hash(JSON.stringify({roles:system,memberships:systemMembers})),roles:ordinary,memberships:privileged});
}
export function revokeSql(readers=[]){if(!Array.isArray(readers)||readers.length>2||new Set(readers).size!==readers.length||readers.some(x=>!Object.hasOwn(readerSources,x)))fail('ROLE_METADATA');return 'BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE;'+[...readers].sort().map(x=>'REVOKE '+x+' FROM anvil_v3_migrator;').join('')+'COMMIT;';}
export function owned(v,id,p,planHash){
 const h=v?.HostConfig,c=v?.Config,n=v?.NetworkSettings;
 if(!hex(id,64)||v?.Id!==id||v.Name!=='/'+resource(p).container||v.Image!==fixed.image||c?.User!=='999:999'||c?.Labels?.['anvil.owner']!==fixed.owner||c.Labels['anvil.instance']!==p.instance||c.Labels['anvil.plan']!==planHash)fail('OWNER');
 if(!h||h.ReadonlyRootfs!==true||h.NetworkMode!=='none'||h.LogConfig?.Type!=='none'||!exact(h.LogConfig.Config,[])||JSON.stringify(h.PortBindings??{})!=='{}'||h.PublishAllPorts!==false||(h.Binds??[]).length||JSON.stringify(h.CapDrop)!=='["ALL"]'||JSON.stringify(h.SecurityOpt)!=='["no-new-privileges"]'||h.PidsLimit!==64||h.Memory!==536870912||h.NanoCpus!==1000000000||!exact(h.Tmpfs,Object.keys(tmpfs))||Object.entries(tmpfs).some(([k,v])=>h.Tmpfs[k]!==v))fail('ISOLATION');
 if(!Array.isArray(c.Env)||c.Env.includes('POSTGRES_HOST_AUTH_METHOD=trust')===false||c.Env.includes('POSTGRES_INITDB_ARGS=--auth-local=trust --auth-host=reject')===false||c.Env.some(x=>/^(?:POSTGRES_PASSWORD|PGPASSWORD)(?:=|$)/.test(x))||JSON.stringify(c.Cmd)!==JSON.stringify(['postgres','-c','listen_addresses=','-c','log_statement=none','-c','log_min_error_statement=fatal']))fail('UNIX_ONLY');
 if(!Array.isArray(v.Mounts)||v.Mounts.some(m=>m.Type!=='tmpfs'||!(m.Destination in tmpfs)||m.RW!==true||m.Source)||!n||Object.keys(n.Networks??{}).some(x=>x!=='none')||Object.values(n.Ports??{}).some(x=>x!==null))fail('MOUNT_NETWORK');
 return true;
}
export async function runController(input,ports){
 const p=validatePlan(input,ports.now()),planHash=hash(JSON.stringify(p)),r=resource(p),index=parseIndex(await ports.index(),p);let total=0;
 for(const path of p.selected){const row=index.get(path);if(!row||row.bytes>2097152)fail('SOURCE');const b=await ports.source(path);if(b.length!==row.bytes||hash(b)!==row.hash)fail('SOURCE');total+=b.length;if(total>16777216)fail('TOTAL');}
 const end=Date.parse(p.slotExpiresAt),check=()=>{if(ports.now()>=end-60000)fail('WORK_EXPIRED');},remaining=(max,cleanup=false)=>{const ms=Math.min(max,end-ports.now()-(cleanup?0:60000));if(ms<=0)fail('EXPIRED');return ms;};check();
 const pre=await ports.preflight(p,remaining(10000));check();
 if(pre.daemon!==fixed.daemon||pre.image!==fixed.image||!pre.nameAbsent||!Array.isArray(pre.volumes)||pre.volumes.some(x=>!(x in tmpfs)))fail('PREFLIGHT');
 if(p.slot>1&&(!pre.previous||pre.previous.hash!==p.previousHash||pre.previous.status!=='CLEANED'||!hex(pre.previous.containerId,64)||pre.previous.sourceHead!==p.sourceHead||pre.previous.cleanup!=='CLEANED'||pre.previous.ddlStatus!=='FAILED'||!['42P01','42883','42703'].includes(pre.previous.sqlState)||pre.previous.orderHash===p.orderHash||!hex(pre.previous.planHash,64)||pre.previous.slot!==p.slot-1||pre.previous.instance===p.instance))fail('PREVIOUS');
 // 소진 O_EXCL 성공 전 Docker mutation0. 원문/순서 digest는 승인 증명이 아니다.
 await ports.claim(p,planHash);let id=null,status='UNKNOWN',stage='CREATE',cleanup='NOT_ATTEMPTED',failure=null,sqlState=null,diagnostic=null,statementEndLine=null,bootstrapDone=false,revokeHash=null;const roleEvidence={},attempted=[],completed=[];
 const readRoles=async(phase,cleanup=false)=>{let raw;try{raw=await ports.roles(id,r,remaining(10000,cleanup));}catch(error){throw roleQueryFailure(error);}try{const snapshot=verifyRoleMetadata(raw,phase,attempted,completed);if(roleEvidence.beforeBootstrap&&snapshot.systemHash!==roleEvidence.beforeBootstrap.systemHash)throw new UnknownOutcome();return snapshot;}catch{throw new RoleObservationFailure('ROLE_METADATA_REJECTED');}};
 try{
  check();id=await ports.create(p,planHash,tmpfs,remaining(10000));if(!hex(id,64))throw new UnknownOutcome();
  owned(await ports.inspect(id,remaining(10000)),id,p,planHash);check();stage='START';await ports.start(id,remaining(10000));
  stage='READY';let ready=false;for(let n=0;n<40;n++){check();if(await ports.finalServer(id,r,remaining(10000))&&await ports.ready(id,r,remaining(10000))){ready=true;break;}}if(!ready)fail('NOT_READY');
  stage='ROLE_PRISTINE';roleEvidence.beforeBootstrap=await readRoles('PRISTINE');stage='BOOTSTRAP';await ports.bootstrap(id,r,remaining(30000));bootstrapDone=true;stage='ROLE_INSTALLER';roleEvidence.afterBootstrap=await readRoles('INSTALLER');
  for(const path of p.selected){check();stage=path;const b=await ports.source(path),row=index.get(path);if(b.length!==row.bytes||hash(b)!==row.hash)fail('SOURCE');attempted.push(path);await ports.sql(id,r,b,remaining(30000));completed.push(path);check();}
  status='DEFINITIONS_INSTALLED';
 }catch(error){failure=error instanceof DdlFailure?'DDL_REJECTED':'OUTCOME_UNKNOWN';sqlState=error instanceof DdlFailure?error.sqlState:null;diagnostic=error instanceof DdlFailure?error.diagnostic:error instanceof RoleObservationFailure&&roleDiagnostics.includes(error.diagnostic)?error.diagnostic:null;statementEndLine=error instanceof DdlFailure?error.statementEndLine:null;status=error instanceof DdlFailure?'FAILED':'UNKNOWN';}
 // timeout/유실은 remote 정착이 아니다. UNKNOWN에서는 자동 후속 mutation/다음 slot0.
 if(status!=='UNKNOWN'&&id){
  try{owned(await ports.inspect(id,remaining(10000,true)),id,p,planHash);roleEvidence.beforeRevoke=await readRoles(bootstrapDone?'SETTLED':'PRISTINE',true);if(bootstrapDone){const sql=revokeSql(roleEvidence.beforeRevoke.memberships.map(x=>x.role));revokeHash=hash(sql);await ports.revoke(id,r,sql,remaining(30000,true));roleEvidence.afterRevoke=await readRoles('REVOKED',true);}await ports.stop(id,remaining(10000,true));owned(await ports.inspect(id,remaining(10000,true)),id,p,planHash);await ports.remove(id,remaining(10000,true));if(!await ports.absent(id,remaining(10000,true)))throw new UnknownOutcome();cleanup='CLEANED';}
  catch{cleanup='UNKNOWN';}
 }
 const result={schemaVersion:1,purpose:'IX01_DDL_DIAGNOSTIC_RESULT',slot:p.slot,instance:p.instance,planHash,containerId:id,status:cleanup==='CLEANED'?'CLEANED':'UNKNOWN',ddlStatus:status,cleanup,stage,failure,sqlState,diagnostic,statementEndLine,sourceHead:p.sourceHead,orderHash:p.orderHash,observedAt:new Date(ports.now()).toISOString(),bootstrapSqlHash:hash(bootstrapSql(r.database)),revokeSqlHash:revokeHash,roleEvidence,resourceMayOutliveDeadline:cleanup!=='CLEANED',manualOwnershipReviewRequired:cleanup!=='CLEANED'};
 try{await ports.record(p,result);}catch{throw new UnknownOutcome();}
 return result;
}
// 실제 포트는 --run의 외부 계획 검산 후에만 생성된다. import/default/--plan은 호출하지 않는다.
async function actualPorts(p){
 if(process.platform!=='linux'||process.getuid?.()!==p.uid||await realpath(process.cwd())!==p.cwd)fail('HOST');
 if(Object.entries(process.env).some(([k,v])=>v&&(/^(PG|DOCKER_)/.test(k)||['NODE_OPTIONS','NODE_PATH','ANVIL_DB_CONFIG','ANVIL_MIGRATOR_CONFIG'].includes(k))))fail('ENV');
 const receiptChain=captureChain(fixed.receiptRoot+'/docker-config',p.uid);let sourceChain;
 try{sourceChain=captureChain(p.cwd+'/.git/objects',p.uid);const verify=()=>{receiptChain.verify();sourceChain.verify();for(const path of [fixed.receiptRoot,fixed.receiptRoot+'/docker-config']){const stat=lstatSync(path);if(stat.uid!==p.uid||(stat.mode&0o777)!==0o700)fail('DOCKER_CONFIG');}if(readdirSync(fixed.receiptRoot+'/docker-config').length)fail('DOCKER_CONFIG');};const env=childEnv();
 const run=makeCommandRunner(verify,execFileSync,env,fixed.receiptRoot+'/docker-config');
 const git=args=>run('/usr/bin/git',gitArgs(p.cwd,args),undefined,10000);
 const metadata=lstatSync(p.cwd+'/.git');if(!metadata.isDirectory()||metadata.isSymbolicLink())fail('GIT_CONFIG');
 const localConfig=lstatSync(p.cwd+'/.git/config');if(!localConfig.isFile()||localConfig.isSymbolicLink()||![0,p.uid].includes(localConfig.uid)||(localConfig.mode&0o022)!==0||realpathSync(p.cwd+'/.git/config')!==p.cwd+'/.git/config')fail('GIT_CONFIG');
 for(const path of [p.cwd+'/.git/commondir',p.cwd+'/.git/objects/info/alternates',p.cwd+'/.git/objects/info/http-alternates']){try{lstatSync(path);fail('GIT_CONFIG');}catch(error){if(error.code!=='ENOENT')throw error;}}
 const config=run('/usr/bin/git',['config','--file',p.cwd+'/.git/config','--no-includes','--null','--list'],undefined,10000);gitConfigAllowed(config);
 if(git(['rev-parse','HEAD'])!==p.executionHead||git(['status','--porcelain','--untracked-files=normal'])!=='')fail('GIT');
 const docker=(args,ms,input,purpose='DEFAULT')=>{const left=Math.min(ms,Date.parse(p.slotExpiresAt)-Date.now());if(left<=0)throw new UnknownOutcome();return run('/usr/bin/docker',dockerArgs(args),input,left,purpose);};
 const protect=async(path,mode,dir=false)=>{verify();const s=await lstat(path);if(await realpath(path)!==path||s.isSymbolicLink()||s.uid!==p.uid||(s.mode&0o777)!==mode||(dir?!s.isDirectory():!s.isFile()||s.nlink!==1))fail('RECEIPT_OWNER');return s;};
 const root=fixed.receiptRoot;await protect(root,0o700,true);await protect(root+'/docker-config',0o700,true);verify();
 const names=n=>root+'/slot-a'+n,readRecord=async(path)=>{const s=await protect(path,0o600);if(s.size>16384)fail('RECEIPT_SIZE');const raw=await readFile(path,'utf8');return{raw,value:JSON.parse(raw),hash:hash(raw)};};
 const children=await readdir(root);if(children.length>8||children.some(x=>!/^docker-config$|^owner\.json$|^slot-a[123]\.(intent|result)\.json$/.test(x)))fail('RECEIPT_CONTENTS');
 const marker=await readRecord(root+'/owner.json');if(marker.hash!==p.receiptOwnerHash||!exact(marker.value,['schemaVersion','purpose','uid','sourceHead','issuedAt','expiresAt'])||marker.value.schemaVersion!==1||marker.value.purpose!=='IX01_DDL_RECEIPT_OWNER'||marker.value.uid!==p.uid||marker.value.sourceHead!==p.sourceHead||marker.value.issuedAt!==p.issuedAt||marker.value.expiresAt!==p.expiresAt)fail('RECEIPT_MARKER');
 const exclusive=async(path,v)=>{verify();const f=await open(path,'wx',0o600);try{const b=JSON.stringify(v)+'\n';if(Buffer.byteLength(b)>16384)fail('RECEIPT_SIZE');await f.writeFile(b);await f.sync();}finally{await f.close();}await protect(path,0o600);};
 const inspect=(id,ms)=>JSON.parse(docker(['container','inspect',id],ms))[0];
 const psql=(id,db,user,sql,ms,purpose='DEFAULT')=>docker(buildPsqlArgs(id,db,user),ms,sql,purpose);
 return{
  now:()=>Date.now(),index:()=>readFile(fixed.index,'utf8'),source:async path=>{try{verify();return execFileSync('/usr/bin/git',gitArgs(p.cwd,['show',p.sourceHead+':'+path]),{env,cwd:p.cwd,stdio:['ignore','pipe','pipe'],timeout:10000,maxBuffer:2097153});}catch{fail('SOURCE_READ');}},
  preflight:async(_p,ms)=>{const sock=await lstat('/var/run/docker.sock');if(!sock.isSocket()||sock.uid!==0||await realpath('/usr/bin/docker')!=='/usr/bin/docker')fail('SOCKET');const info=parseDaemonInfo(docker(daemonInfoArgs(),ms)),image=JSON.parse(docker(['image','inspect',fixed.image],ms))[0];if(info.Name!=='SINSAN')fail('DAEMON_HOST');const list=docker(['container','ls','-a','--filter','name=^/anvil-ix01-ddl-pg-20261104-r4-a[123]$','--format','{{.Names}}'],ms);let previous=null;if(p.slot>1){const old=await readRecord(names(p.slot-1)+'.result.json');previous={...old.value,hash:old.hash};}return{daemon:info.ID,image:image.Id,volumes:Object.keys(image.Config?.Volumes??{}),nameAbsent:list==='',previous};},
  claim:async(_p,h)=>exclusive(names(p.slot)+'.intent.json',{schemaVersion:1,purpose:'IX01_DDL_INTENT',slot:p.slot,instance:p.instance,planHash:h,sourceHead:p.sourceHead,executionHead:p.executionHead,orderHash:p.orderHash,expiresAt:p.slotExpiresAt}),
  create:async(_p,h,m,ms)=>docker(buildCreateArgs(p,h,m),ms),
  inspect,start:async(id,ms)=>{docker(['start',id],ms);},finalServer:async(id,_r,ms)=>{verify();const final=await observeFinalServer(id,ms,(args,ms)=>docker(args,ms,undefined,'FINAL_SERVER'));if(!final)await new Promise(resolve=>setTimeout(resolve,250));return final;},ready:async(id,r,ms)=>{const left=Math.min(ms,Date.parse(p.slotExpiresAt)-Date.now()-60000);if(left<=0)throw new UnknownOutcome();try{verify();execFileSync('/usr/bin/docker',dockerArgs(['exec','--user','999:999',id,'pg_isready','--host=/var/run/postgresql','--username=anvil_v3_bootstrap','--dbname='+r.database]),{env,cwd:fixed.receiptRoot+'/docker-config',stdio:['ignore','pipe','pipe'],timeout:left,maxBuffer:16384});return true;}catch(e){if(e.status===1||e.status===2){await new Promise(resolve=>setTimeout(resolve,250));return false;}throw new UnknownOutcome();}},
  roles:async(id,r,ms)=>psql(id,r.database,'anvil_v3_bootstrap',roleMetadataSql(),ms,'ROLE_OBSERVATION'),revoke:async(id,r,sql,ms)=>{psql(id,r.database,'anvil_v3_bootstrap',sql,ms);},
  bootstrap:async(id,r,ms)=>{psql(id,r.database,'anvil_v3_bootstrap',bootstrapSql(r.database),ms);},
  sql:async(id,r,b,ms)=>{psql(id,r.database,'anvil_v3_migrator',b,ms);},stop:async(id,ms)=>{docker(['stop','--time','5',id],ms);},remove:async(id,ms)=>{docker(['container','rm',id],ms);},absent:async(id,ms)=>docker(['container','ls','-a','--no-trunc','--filter','id='+id,'--format','{{.ID}}'],ms)==='',record:async(_p,result)=>exclusive(names(p.slot)+'.result.json',result),dispose:async()=>{sourceChain.close();receiptChain.close();},
 };
 }catch(error){sourceChain?.close();receiptChain.close();throw error;}
}
export async function parseInput(raw,digest,now){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>65536||!hex(digest,64)||hash(raw)!==digest)fail('PLAN_HASH');
 const {parseWireJson}=await import(new URL('./contracts/canonical.ts',pathToFileURL(process.cwd()+'/')));
 return validatePlan(parseWireJson(raw),now);
}
export async function main(args,env){
 if(Number(process.versions.node.split('.')[0])!==24)fail('NODE24_REQUIRED');
 if(args.length===0||args.length===1&&args[0]==='--plan'){console.log(JSON.stringify({sourceHead:fixed.sourceHead,actualExecuted:false,selectionRequired:true,slots:3}));return;}
 if(args.length!==1||args[0]!=='--run'||env.ANVIL_IX01_DDL_OPT_IN!=='EXACT_PLAN_APPROVED')fail('MODE');
 const p=await parseInput(env.ANVIL_IX01_DDL_PLAN,env.ANVIL_IX01_DDL_PLAN_SHA256,Date.now()),ports=await actualPorts(p);try{const result=await runController(p,ports);console.log(JSON.stringify(result));if(result.ddlStatus!=='DEFINITIONS_INSTALLED'||result.status!=='CLEANED')process.exitCode=1;}finally{await ports.dispose();}
}
if(process.argv[1]==='-')main(process.argv.slice(2),process.env).catch(error=>{console.error(JSON.stringify(safeFailure(error)));process.exitCode=1;});
// IX01_CONTROLLER_END
IX01_NODE
