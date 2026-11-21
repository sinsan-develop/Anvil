import {posix} from 'node:path';
import type {Pool,PoolClient} from 'pg';
import {canonicalJson,contentHash,parseWireJson} from '../contracts/canonical.ts';
import {recordV1,uuidV1} from '../contracts/runtime/validation-v1.ts';
import {copyControlData} from '../apps/server/modules/control-handoff/control-grant.ts';
import {buildOfficialForms,officialFormsSourceHash,authoringStandardSourceHash} from '../apps/server/modules/documents/forms.ts';
import {seedOfficialForms} from '../apps/server/modules/documents/catalog-seed.ts';
import {buildBuiltinMethodologies,builtinSourceHash} from '../apps/server/modules/methodologies/builtins.ts';
import {seedBuiltinMethodologies} from '../apps/server/modules/methodologies/catalog-seed.ts';
import {hashPassword} from '../apps/server/modules/access/service.ts';
import {readManagementOriginSchemaManifest} from '../tests/integration/FN03/source-content-management-origin-schema.ts';
import {managementOriginInspectionSql} from '../tests/integration/FN03/source-content-management-origin-journey.ts';
import {managementOriginProvisionInspectionSql} from './qa-fn03-source-content-management-origin.ts';
import type {ManagementOriginAuthFixtureInput} from './qa-fn03-source-content-management-origin-auth-fixture.ts';
import type {ManagementOriginHostBinding,ManagementOriginHostPorts,ManagementOriginHostScope} from './qa-fn03-source-content-management-origin-host.ts';
import {currentProfile,currentLegacyModuleSource,currentNetworkProbeContract,currentCreatedUnallocatedNone,verifyContainerObservation,verifyNetworkObservation,readCurrentAttachedHost,verifyCurrentRoleMetadata,currentRevokeSql} from './qa-ix01-current-journey.ts';

export interface ManagementOriginIsolatedInput {
 binding:ManagementOriginHostBinding;receiptRoot:string;historicalTsv:Uint8Array;legacyBytes:Uint8Array;
 sources:{forms:Uint8Array;standard:Uint8Array;methods:Uint8Array};
 passwords:{bootstrap:string;app:string;migrator:string};fixture:ManagementOriginAuthFixtureInput;
}
export interface ManagementOriginDockerCall {
 file:'/usr/bin/docker';argv:readonly string[];input:string|Uint8Array|undefined;
 env:Readonly<Record<string,string>>;timeoutMs:number;maxBuffer:65536;shell:false;
}
export interface ManagementOriginPoolRequest {
 host:string;port:5432;database:string;user:'anvil_v3_app'|'anvil_v3_migrator'|'anvil_v3_bootstrap';password:string;
 ssl:false;max:2;connectionTimeoutMillis:3000;statement_timeout:5000;query_timeout:6000;
}
export interface ManagementOriginIsolatedProviders {
 now():number;monotonic():number;
 /** 원 신규 승인/배타 기록·source/명령 실행 파일/socket/빈 config/root 핀의 실제 현재성. 이 어댑터는 발급하지 않는다. */
 assertCurrent(binding:Readonly<ManagementOriginHostBinding>):void;
 consume(binding:Readonly<ManagementOriginHostBinding>):Promise<void>;
 /** 정확 argv만 no shell로 수행하고 원 자식 종결/timeout·유계 stdout을 수거. stderr 원문은 반환하지 않는다. */
 command(call:Readonly<ManagementOriginDockerCall>):{status:number;signal:null;stdout:string};
 /** 알려진 최종 postgres/pg_isready 대기에서만 사용. 실패한 SQL/생성의 재시도가 아니다. */
 wait(milliseconds:250):Promise<void>;
 openPool(request:Readonly<ManagementOriginPoolRequest>):Promise<Pool>;
 /** 주어진 원 Pool만 end/종결 수거. 10초 원 회수 한도 안에서 호출하며 삭제/재접속은 하지 않는다. */
 closePool(pool:Pool,timeoutMs:number):Promise<void>;
 /** 원 새 root의 배타 생성/namespace proof. 기존 root나 파일을 탐색·채택하지 않는다. */
 prepareArtifactRoot(binding:Readonly<ManagementOriginHostBinding>):Promise<void>;
}
const fail=():never=>{throw Error('FN03_MANAGEMENT_ISOLATED_UNKNOWN');};
function check(v:unknown):asserts v{if(!v)fail();}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const hex=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const empty=(v:unknown)=>v===null||recordV1(v,[]);
// 원 adapter가 이미 검산한 같은 호출 객체만 native 효과 포트에 단회 전달한다.
// 발급은 아래 run 내부에만 있으며 raw argv/SQL을 권위로 바꾸는 공개 발급 함수는 없다.
const nativeCalls=new WeakMap<object,{binding:string;snapshot:string}>();
function nativeCallSnapshot(call:Readonly<ManagementOriginDockerCall>):string{
 const input=call.input;
 return canonicalJson({...call,input:input===undefined?null:{kind:typeof input==='string'?'TEXT':'BYTES',bytes:typeof input==='string'?Buffer.byteLength(input):input.byteLength,sha256:contentHash(typeof input==='string'?Buffer.from(input):input)}});
}
export function consumeManagementOriginDockerCall(call:Readonly<ManagementOriginDockerCall>,binding:Readonly<ManagementOriginHostBinding>):void{
 const issued=nativeCalls.get(call);nativeCalls.delete(call);
 check(issued&&issued.binding===canonicalJson(binding)&&issued.snapshot===nativeCallSnapshot(call));
}
const boot='anvil_v3_bootstrap',migrator='anvil_v3_migrator',app='anvil_v3_app',managementOwner='anvil_v3_source_content_management_owner';
const hba='local all all trust\nhost all all 0.0.0.0/0 scram-sha-256\nhost all all ::/0 reject\n';
const networkFormat=currentNetworkProbeContract.networkFormat.slice(0,-1)+',"ipam":{{json .IPAM.Config}}}';
const ledgerSql="SELECT COALESCE(json_agg(json_build_object('id',id,'checksum',checksum) ORDER BY id),'[]'::json)::text FROM anvil.schema_migrations;";
export const managementOriginDatabaseIdentitySql='SELECT current_database() db, current_user role, session_user session_role, host(inet_server_addr()) address, inet_server_port() port, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolreplication FROM pg_catalog.pg_roles WHERE rolname=current_user';
type Legacy=ManagementOriginHostPorts['legacy']&{bootstrapSql(database:string,selected:string[]):string;finalServerArgs(id:string):string[];parseFinalServer(raw:string):boolean};

/** 고정된 R9의 검산된 module 부분만 적재한다. 제거한 CLI entry/actualPorts는 호출하지 않는다.
 * 생성만으로 provider/OS/DB 효과0. 이 소스는 새 실행안·실제 승인·신원 핀·원장 구현을 대신하지 않는다. */
export async function createManagementOriginIsolatedPorts(input:ManagementOriginIsolatedInput,providers:ManagementOriginIsolatedProviders):Promise<ManagementOriginHostPorts>{
 const binding=Object.freeze(copyControlData(input.binding,8192)) as unknown as Readonly<ManagementOriginHostBinding>;
 check(uuidV1(binding.attemptId)&&uuidV1(binding.approvalId)&&hex(binding.planHash)&&hex(binding.approvalHash)&&/^[a-f0-9]{40}$/.test(binding.sourceHead));
 const receipt=input.receiptRoot;check(typeof receipt==='string'&&receipt.startsWith('/')&&posix.normalize(receipt)===receipt&&!receipt.includes('\0')&&!receipt.includes('\\')&&receipt.endsWith('/fn03-management-'+binding.attemptId));
 const source=Buffer.from(input.legacyBytes),moduleSource=currentLegacyModuleSource(source,currentProfile.legacyHash);
 const rows=readManagementOriginSchemaManifest(Buffer.from(input.historicalTsv)),paths=rows.map(r=>r.path);
 const own=(raw:Uint8Array,sha:string)=>{check(raw instanceof Uint8Array&&raw.buffer instanceof ArrayBuffer&&raw.byteLength<=2097152);const b=Buffer.from(raw);check(contentHash(b)===sha);return b;};
 const forms=buildOfficialForms(own(input.sources.forms,officialFormsSourceHash),own(input.sources.standard,authoringStandardSourceHash));
 const methods=buildBuiltinMethodologies(own(input.sources.methods,builtinSourceHash),forms.forms);
 const passwords=Object.freeze(copyControlData(input.passwords,1024)) as unknown as ManagementOriginIsolatedInput['passwords'];
 check(recordV1(passwords,['bootstrap','app','migrator'])&&Object.values(passwords).every(hex)&&new Set(Object.values(passwords)).size===3);
 const access=input.fixture.access;check(access.key instanceof Uint8Array&&access.key.buffer instanceof ArrayBuffer&&access.key.byteLength===32);
 const {access:_,...fixtureData}=input.fixture;
 const fixture={...copyControlData(fixtureData,2097152),access:{installationId:access.installationId,key:Buffer.from(access.key)}} as unknown as ManagementOriginAuthFixtureInput;
 check(fixture.artifactRoot===binding.artifactRoot&&methods.some(m=>same(fixture.methodologyRef,{id:m.id,version:m.version,contentHash:m.contentHash})));
 const legacy=await import('data:text/javascript;base64,'+Buffer.from(moduleSource).toString('base64')) as Legacy;
 const {now,monotonic,assertCurrent,consume,command,wait,openPool,closePool,prepareArtifactRoot}=providers;
 const tag=binding.attemptId.replaceAll('-',''),name='anvil_v3_fn03_management_'+tag;
 const labels=Object.freeze({'anvil.owner':'FN03_MANAGEMENT_ORIGIN','anvil.instance':tag,'anvil.plan':binding.planHash});
 let broken=false,phase='NEW',cid='',nid='',noneId='',address='',installed=0,appended=0,ledgerReads=0,systemHash='',seeded=false,acquired=false,closed=false,closeFailed=false;
 let pgWall=Infinity,pgMono=Infinity,journeyWall=Infinity,journeyMono=Infinity,operationWall=Infinity,operationMono=Infinity,attachedNetworkRaw='';
 let scope:Readonly<ManagementOriginHostScope>|undefined;
 const ownedPools:Pool[]=[],endings=new Set<Pool>();let poolMethods:{pool:Pool;connect:Pool['connect'];query:Pool['query'];end:Pool['end']}[]=[];
 const current=(s?:Readonly<ManagementOriginHostScope>)=>{
  check(!broken&&providers.now===now&&providers.monotonic===monotonic&&providers.assertCurrent===assertCurrent&&providers.consume===consume&&providers.command===command&&providers.wait===wait&&providers.openPool===openPool&&providers.closePool===closePool&&providers.prepareArtifactRoot===prepareArtifactRoot);
  check(assertCurrent.call(providers,binding)===undefined);const t=now.call(providers),m=monotonic.call(providers);check(Number.isSafeInteger(t)&&Number.isSafeInteger(m)&&m>=0&&t>=binding.issuedAt&&t<Math.min(binding.expiresAt,pgWall,journeyWall,operationWall)&&m<Math.min(pgMono,journeyMono,operationMono));
  for(const p of poolMethods)check(p.pool.connect===p.connect&&p.pool.query===p.query&&p.pool.end===p.end);
  if(s){const{containerName,networkName,database,image,labels:seen,containerId,networkId,host,...b}=s;check(same(b,binding)&&containerName===name&&networkName===name+'_net'&&database===name&&image===currentNetworkProbeContract.image&&same(seen,labels)&&(!containerId||containerId===cid)&&(!networkId||networkId===nid)&&(!host||host===address));scope=s;}
 };
 const guard=<T>(f:()=>T):T=>{try{return f();}catch(error){broken=true;throw error;}};
 const guardAsync=async<T>(f:()=>Promise<T>):Promise<T>=>{try{return await f();}catch(error){broken=true;throw error;}};
 const run=(args:string[],ms:number,raw?:string|Uint8Array,extra?:Readonly<Record<string,string>>,allowNotReady=false)=>{
  current();check(phase!=='NEW'&&Number.isSafeInteger(ms)&&ms>0&&ms<=30000);
  const began=now.call(providers),mono=monotonic.call(providers);const cap=Math.min(ms,Math.min(binding.expiresAt,pgWall,journeyWall,operationWall)-began,Math.min(pgMono,journeyMono,operationMono)-mono);check(cap>0);
  const call=Object.freeze({file:'/usr/bin/docker' as const,argv:Object.freeze(['--config',receipt+'/docker-config','--host','unix:///var/run/docker.sock',...args]),input:raw,env:Object.freeze({PATH:'/opt/node-v24.22.1-linux-x64/bin:/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',HOME:receipt,...extra}),timeoutMs:cap,maxBuffer:65536 as const,shell:false as const});
  nativeCalls.set(call,{binding:canonicalJson(binding),snapshot:nativeCallSnapshot(call)});
  let r:ReturnType<ManagementOriginIsolatedProviders['command']>;
  try{r=command.call(providers,call);}finally{nativeCalls.delete(call);}
  current();check(recordV1(r,['status','signal','stdout'])&&r.signal===null&&typeof r.stdout==='string'&&r.stdout.isWellFormed()&&Buffer.byteLength(r.stdout)<=65536&&Number.isInteger(r.status)&&(r.status===0||allowNotReady&&(r.status===1||r.status===2)));
  const end=now.call(providers),endMono=monotonic.call(providers);check(end>=began&&end-began<cap&&endMono>=mono&&endMono-mono<cap);return r;
 };
 const docker=(args:string[],ms:number,raw?:string|Uint8Array,extra?:Readonly<Record<string,string>>,pending=false)=>{
  const d=run(['info','--format','{"ID":{{json .ID}},"Name":{{json .Name}}}'],ms);check(same(parseWireJson(d.stdout),{ID:currentProfile.daemon,Name:'SINSAN'}));return run(args,ms,raw,extra,pending);
 };
 const facts=(raw:string)=>{const v=parseWireJson(raw);check(v&&typeof v==='object'&&!Array.isArray(v));return v as Record<string,any>;};
 const inspect=(ms:number)=>{check(hex(cid));return verifyContainerObservation(facts(docker(['container','inspect','--format',currentNetworkProbeContract.containerFormat,cid],ms).stdout),{containerId:cid,containerName:name,image:currentNetworkProbeContract.image,labels});};
 const onlyNone=(ms:number)=>{const c=inspect(ms);check(c.running===true&&recordV1(c.networks,['none'])&&hex(c.networks.none?.NetworkID)&&c.networks.none.IPAddress==='');return c;};
 const network=(ms:number)=>{check(hex(nid));return verifyNetworkObservation(facts(docker(['network','inspect','--format',networkFormat,nid],ms).stdout),{networkId:nid,networkName:name+'_net',labels});};
 const attached=(ms:number)=>readCurrentAttachedHost({...scope!,containerId:cid,networkId:nid,subnet:binding.subnet},{network:()=>docker(['network','inspect','--format',networkFormat,nid],ms).stdout,container:()=>docker(['container','inspect','--format',currentNetworkProbeContract.containerFormat,cid],ms).stdout});
 const owned=(ms:number)=>{if(address)check(attached(ms)===address);else onlyNone(ms);};
 const sql=(user:string,raw:string|Uint8Array,ms:number,path?:string,sha?:string)=>{owned(ms);const result=docker(legacy.buildPsqlArgs(cid,name,user,path,sha),ms,raw).stdout;owned(ms);return result;};
 const roleEvidence=(raw:string,phaseName:'PRISTINE'|'INSTALLER'|'SETTLED'|'REVOKED')=>{
  const v=facts(raw);if(phaseName==='SETTLED'||phaseName==='REVOKED'){
   check(Array.isArray(v.roles)&&Array.isArray(v.memberships));const found=v.roles.filter((r:any)=>r.name===managementOwner);check(found.length===1);const r=found[0];check(recordV1(r,['name','superuser','inherit','createRole','createDb','replication','bypassRls','login','validUntil'])&&r.validUntil===null&&['superuser','inherit','createRole','createDb','replication','bypassRls','login'].every(k=>r[k]===false));
   check(v.memberships.every((m:any)=>![m.role,m.member,m.grantor].includes(managementOwner)));v.roles=v.roles.filter((r:any)=>r.name!==managementOwner);
  }
  const completed=paths.slice(0,installed),result=verifyCurrentRoleMetadata(legacy,JSON.stringify(v),phaseName,completed,completed,paths);
  check(hex(result.systemHash)&&(!systemHash||systemHash===result.systemHash));systemHash=result.systemHash;return result;
 };
 let expectedRevoke='';
 const endPools=async(ms:number)=>{
  check(!closeFailed&&Number.isInteger(ms)&&ms>0&&ms<=10000);const begin=monotonic.call(providers);let failed=false;
  for(const pool of [...ownedPools].reverse()){
   if(endings.has(pool))continue;endings.add(pool);const left=ms-(monotonic.call(providers)-begin);
   if(left<=0){failed=true;continue;}
   try{check(await closePool.call(providers,pool,left)===undefined);if(monotonic.call(providers)-begin>=ms)failed=true;}catch{failed=true;}
  }
  fixture.access.key.fill(0);if(failed){closeFailed=true;fail();}closed=true;
 };
 const asyncCurrent=async<T>(work:()=>Promise<T>)=>{current();const r=await work();current();return r;};
 const transaction=async(pool:Pool,work:(client:PoolClient)=>Promise<void>)=>{
  current();const client=await pool.connect(),query=client.query,release=client.release;
  // await 뒤 현재성이 끊겨도 이미 획득한 원 client를 먼저 보유한다. 불명 뒤 SQL 재시도/ROLLBACK0.
  try{current();check(typeof query==='function'&&typeof release==='function');
   const guarded=new Proxy(client,{get(target,key){if(key==='query')return async(text:string,args?:unknown[])=>{current();check(client.query===query&&client.release===release);const r=await Reflect.apply(query,client,[text,args]);current();return r;};return Reflect.get(target,key,target);}});
   check((await guarded.query('BEGIN')).command==='BEGIN');await work(guarded);current();check((await guarded.query('COMMIT')).command==='COMMIT');
  }finally{release.call(client,true);}
 };
 const api:ManagementOriginHostPorts={legacy,now,monotonic,assertCurrent(s){guard(()=>current(s));},
  async claim(s){return guardAsync(async()=>{current(s);check(phase==='NEW');check(await consume.call(providers,binding)===undefined);current(s);phase='CLAIMED';});},
  start:{
   check(step,s,ms){guard(()=>{current(s);
    if(step==='IMAGE_COLLISION'){check(phase==='CLAIMED');const i=facts(docker(['image','inspect','--format','{"id":{{json .Id}},"volumes":{{json .Config.Volumes}}}',s.image],ms).stdout);check(i.id===s.image&&recordV1(i.volumes,['/var/lib/postgresql/data']));check(!docker(['container','ls','-a','--filter','name=^/'+name+'$','--format','{{.ID}}'],ms).stdout.trim()&&!docker(['network','ls','--filter','name=^'+name+'_net$','--format','{{.ID}}'],ms).stdout.trim());phase='COLLISION_CHECKED';}
    else if(step==='CREATE_INSPECT'){check(phase==='CREATED');const c=inspect(ms);check(c.running===false&&(empty(c.networks)||recordV1(c.networks,['none'])&&hex(c.networks.none?.NetworkID)&&c.networks.none.IPAddress===''||currentCreatedUnallocatedNone(c)));phase='CREATE_CHECKED';}
    else if(step==='START_INSPECT'){check(phase==='STARTED');onlyNone(ms);phase='START_CHECKED';}
    else {check(step==='BOOTSTRAP_ROLES'&&phase==='READY');const db=facts(sql(boot,"SELECT json_build_object('db',current_database(),'owner',pg_get_userbyid(datdba),'socket',inet_server_addr() IS NULL)::text FROM pg_catalog.pg_database WHERE datname=current_database();",ms));check(same(db,{db:name,owner:boot,socket:true}));roleEvidence(sql(boot,legacy.roleMetadataSql(),ms),'PRISTINE');const old='anvil_v3_ix01_ddl_20261104_r9_a1',raw=legacy.bootstrapSql(old,paths);check(raw.split(old).length===3);sql(boot,raw.replaceAll(old,name),ms);roleEvidence(sql(boot,legacy.roleMetadataSql(),ms),'INSTALLER');phase='BOOTSTRAPPED';}
   });},
   create(s,ms){return guard(()=>{current(s);check(phase==='COLLISION_CHECKED');pgWall=now.call(providers)+600000;pgMono=monotonic.call(providers)+600000;const id=docker(['create','--pull','never','--name',name,'--network','none','--user','999:999','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--log-driver','none','--pids-limit','64','--memory','512m','--cpus','1',...Object.entries(currentNetworkProbeContract.tmpfs).flatMap(([k,v])=>['--tmpfs',k+':'+v]),...Object.entries(labels).flatMap(([k,v])=>['--label',k+'='+v]),'--env','POSTGRES_USER='+boot,'--env','POSTGRES_DB='+name,'--env','POSTGRES_PASSWORD','--env','POSTGRES_HOST_AUTH_METHOD=scram-sha-256','--env','POSTGRES_INITDB_ARGS=--auth-local=trust --auth-host=scram-sha-256',s.image,'postgres','-c','listen_addresses=*','-c','log_statement=none','-c','log_min_error_statement=fatal'],ms,undefined,{POSTGRES_PASSWORD:passwords.bootstrap}).stdout.trim();check(hex(id));cid=id;phase='CREATED';return id;});},
   start(s,ms){return guard(()=>{current(s);check(phase==='CREATE_CHECKED'&&s.containerId===cid);const id=docker(['start',cid],ms).stdout.trim();check(id===cid);phase='STARTED';return id;});},
   async readiness(s,ms){return guardAsync(async()=>{current(s);check(phase==='START_CHECKED');const begin=monotonic.call(providers);for(let n=0;n<40;n++){
    const remaining=ms-(monotonic.call(providers)-begin);check(remaining>0);onlyNone(remaining);
    if(legacy.parseFinalServer(docker(legacy.finalServerArgs(cid),remaining).stdout)&&docker(['exec','--user','999:999',cid,'pg_isready','--host=/var/run/postgresql','--username='+boot,'--dbname='+name],remaining,undefined,undefined,true).status===0){phase='READY';return;}
    check(ms-(monotonic.call(providers)-begin)>250);check(await wait.call(providers,250)===undefined);current(s);
   }fail();});},
  },
  psql(s,argv,raw,ms){return guard(()=>{current(s);check(s.containerId===cid);let user=migrator,path:string|undefined,sha:string|undefined,next='';
   if(raw===legacy.roleMetadataSql()){check((phase==='BOOTSTRAPPED'&&installed===132&&appended===132&&ledgerReads===2)||phase==='REVOKED');user=boot;next=phase==='REVOKED'?'REVOKED_CHECKED':'ROLES_CHECKED';}
   else if(raw===expectedRevoke&&phase==='SECURED'){user=boot;next='REVOKED';}
   else if(raw===ledgerSql){check(phase==='BOOTSTRAPPED'&&appended===installed&&(installed===130&&ledgerReads===0||installed===132&&ledgerReads===1));next='LEDGER';}
   else if(typeof raw==='string'){check(phase==='BOOTSTRAPPED'&&installed===appended+1);const r=rows[appended]!;check(raw==="INSERT INTO anvil.schema_migrations(id,checksum) VALUES('"+r.id+"','"+r.sha256+"');");next='APPEND';}
   else{check(phase==='BOOTSTRAPPED'&&installed===appended&&installed<132);const r=rows[installed]!;check(raw instanceof Uint8Array&&raw.length===r.bytes&&contentHash(raw)===r.sha256);path=r.path;sha=r.sha256;next='INSTALL';}
   check(same(argv,legacy.buildPsqlArgs(cid,name,user,path,sha)));const result=sql(user,raw,ms,path,sha);
   if(next==='INSTALL')installed++;else if(next==='APPEND')appended++;else if(next==='LEDGER')ledgerReads++;
   else if(next==='ROLES_CHECKED'){const roles=roleEvidence(result,'SETTLED');expectedRevoke=currentRevokeSql(legacy,roles.memberships.map(r=>r.role),paths);phase=next;}
   else if(next==='REVOKED_CHECKED'){roleEvidence(result,'REVOKED');phase=next;}else phase=next;
   return result;
  });},
  secure(s,ms){guard(()=>{current(s);check(phase==='ROLES_CHECKED');sql(boot,"BEGIN;SET LOCAL password_encryption='scram-sha-256';ALTER ROLE "+boot+" PASSWORD '"+passwords.bootstrap+"';ALTER ROLE "+app+" PASSWORD '"+passwords.app+"';ALTER ROLE "+migrator+" PASSWORD '"+passwords.migrator+"';COMMIT;",ms);onlyNone(ms);docker(['exec','-i','--user','999:999',cid,'sh','-c','umask 077; cat > /var/lib/postgresql/data/pg_hba.conf'],ms,hba);onlyNone(ms);check(docker(['exec','--user','999:999',cid,'cat','/var/lib/postgresql/data/pg_hba.conf'],ms).stdout===hba);check(same(facts(sql(boot,"SELECT json_build_object('reload',pg_reload_conf(),'passwords',(SELECT count(*)=3 FROM pg_authid WHERE rolname IN('anvil_v3_bootstrap','anvil_v3_app','anvil_v3_migrator') AND rolpassword LIKE 'SCRAM-SHA-256$%'),'rules',(SELECT count(*)=3 AND bool_and(error IS NULL) FROM pg_hba_file_rules))::text;",ms)),{reload:true,passwords:true,rules:true}));phase='SECURED';});},
  network:{
   step(step,s,ms){guard(()=>{current(s);
    if(step==='PRECHECK'){check(phase==='REVOKED_CHECKED');onlyNone(ms);phase='NETWORK_PRECHECK';}
    else if(step==='CREATE_VERIFY'){check(phase==='NETWORK_CREATED');check(empty(network(ms).containers));phase='NETWORK_EMPTY';}
    else if(step==='NONE_VERIFY'){check(phase==='NETWORK_EMPTY');noneId=onlyNone(ms).networks.none.NetworkID;const n=facts(docker(['network','inspect','--format',networkFormat,noneId],ms).stdout);check(n.id===noneId&&n.name==='none'&&n.driver==='null');phase='NONE_CHECKED';}
    else if(step==='DISCONNECT'){check(phase==='NONE_CHECKED');docker(['network','disconnect',noneId,cid],ms);phase='DISCONNECTED';}
    else if(step==='DETACHED_VERIFY'){check(phase==='DISCONNECTED');const c=inspect(ms);check(c.running&&empty(c.networks)&&empty(network(ms).containers));phase='DETACHED';}
    else{check(step==='CONNECT'&&phase==='DETACHED');docker(['network','connect',nid,cid],ms);phase='CONNECTED';}
   });},
   create(s,ms){return guard(()=>{current(s);check(phase==='NETWORK_PRECHECK');const n=docker(['network','create','--internal','--driver','bridge','--subnet',binding.subnet,...Object.entries(labels).flatMap(([k,v])=>['--label',k+'='+v]),name+'_net'],ms).stdout.trim();check(hex(n)&&n!==cid);nid=n;phase='NETWORK_CREATED';return n;});},
   inspectNetwork(s,ms){return guard(()=>{current(s);check(phase==='CONNECTED');attachedNetworkRaw=docker(['network','inspect','--format',networkFormat,nid],ms).stdout;phase='ATTACHED_NETWORK';return attachedNetworkRaw;});},
   inspectContainer(s,ms){return guard(()=>{current(s);check(phase==='ATTACHED_NETWORK');const raw=docker(['container','inspect','--format',currentNetworkProbeContract.containerFormat,cid],ms).stdout;address=readCurrentAttachedHost({...s,containerId:cid,networkId:nid},{network:()=>attachedNetworkRaw,container:()=>raw});attachedNetworkRaw='';phase='ATTACHED';return raw;});},
  },
  async acquire(s,ms){return guardAsync<Awaited<ReturnType<ManagementOriginHostPorts['acquire']>>>(async()=>{current(s);check(phase==='ATTACHED'&&!acquired);acquired=true;check(attached(ms)===address&&s.host===address);journeyWall=now.call(providers)+90000;journeyMono=monotonic.call(providers)+90000;phase='ACQUIRING';
   try{
    for(const [user,password] of [[app,passwords.app],[migrator,passwords.migrator],[boot,passwords.bootstrap]] as const){
     const pool=await openPool.call(providers,Object.freeze({host:address,port:5432,database:name,user,password,ssl:false,max:2,connectionTimeoutMillis:3000,statement_timeout:5000,query_timeout:6000}));
     check(pool&&typeof pool.query==='function'&&typeof pool.connect==='function'&&typeof pool.end==='function'&&!ownedPools.includes(pool));ownedPools.push(pool);poolMethods.push({pool,connect:pool.connect,query:pool.query,end:pool.end});current(s);
     const found=await asyncCurrent(()=>pool.query(managementOriginDatabaseIdentitySql));const privilege=user===boot;
     check(same(found.rows,[{db:name,role:user,session_role:user,address,port:5432,rolsuper:privilege,rolbypassrls:privilege,rolcreaterole:privilege,rolcreatedb:privilege,rolreplication:privilege}]));
    }
    check(await asyncCurrent(()=>prepareArtifactRoot.call(providers,binding))===undefined);phase='ACQUIRED';
    const appPool=ownedPools[0]!,admin=ownedPools[1]!,observerPool=ownedPools[2]!;
    return{appPool,input:fixture,observer:{async query(text,args){return guardAsync(async()=>{current();check(phase==='ACQUIRED'&&!closed&&(text===managementOriginProvisionInspectionSql&&args.length===7||text===managementOriginInspectionSql&&args.length===3)&&args.every(uuidV1));return asyncCurrent(()=>observerPool.query(text,[...args]));});}},
     async prepareCatalogAndUser(original,chosen){return guardAsync(async()=>{current();check(!seeded&&phase==='ACQUIRED'&&original===appPool&&same(chosen,{actorId:fixture.actorId,loginName:fixture.loginName,password:fixture.password,methodologyRef:fixture.methodologyRef}));seeded=true;
      check(same((await asyncCurrent(()=>admin.query('SELECT count(*)::int n FROM anvil.users'))).rows,[{n:0}]));
      await transaction(admin,async db=>{await asyncCurrent(()=>seedOfficialForms(db,forms));await asyncCurrent(()=>seedBuiltinMethodologies(db,methods,forms.forms));});
      const phc=await asyncCurrent(()=>hashPassword(chosen.password));await transaction(appPool,async db=>{
       await asyncCurrent(()=>db.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'FN03 격리 사용자','ACTIVE')",[chosen.actorId,chosen.loginName]));
       await asyncCurrent(()=>db.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)',[chosen.actorId,phc]));
      });
     });},
     async close(timeoutMs){try{await endPools(timeoutMs);}catch{broken=true;throw Error('FN03_MANAGEMENT_ISOLATED_UNKNOWN');}},
    };
   }catch(error){broken=true;try{await endPools(10000);}catch{/* 부분 획득 handle의 불명 보존 */}throw error;}
  });},
  async cleanup(s,ms){return guardAsync(async()=>{current(s);check(acquired&&closed&&phase==='ACQUIRED'&&seeded);check(attached(ms)===address);roleEvidence(sql(boot,legacy.roleMetadataSql(),ms),'REVOKED');
   docker(['stop','--time','5',cid],ms);check(inspect(ms).running===false);docker(['container','rm',cid],ms);check(empty(network(ms).containers));docker(['network','rm',nid],ms);
   check(!docker(['container','ls','-a','--no-trunc','--filter','id='+cid,'--format','{{.ID}}'],ms).stdout.trim()&&!docker(['network','ls','--no-trunc','--filter','id='+nid,'--format','{{.ID}}'],ms).stdout.trim());phase='CLEANED';
  });},
 };
 const begin=(ms:number)=>{current();check(Number.isSafeInteger(ms)&&ms>0&&ms<=30000&&operationWall===Infinity);operationWall=now.call(providers)+ms;operationMono=monotonic.call(providers)+ms;};
 const limited=<T>(ms:number,work:()=>T):T=>guard(()=>{begin(ms);try{const r=work();current();return r;}finally{operationWall=operationMono=Infinity;}});
 const limitedAsync=async<T>(ms:number,work:()=>Promise<T>):Promise<T>=>guardAsync(async()=>{begin(ms);try{const r=await work();current();return r;}finally{operationWall=operationMono=Infinity;}});
 return Object.freeze<ManagementOriginHostPorts>({...api,
  start:{check:(step,s,ms)=>limited(ms,()=>api.start.check(step,s,ms)),create:(s,ms)=>limited(ms,()=>api.start.create(s,ms)),start:(s,ms)=>limited(ms,()=>api.start.start(s,ms)),readiness:(s,ms)=>limitedAsync(ms,()=>api.start.readiness(s,ms))},
  network:{step:(step,s,ms)=>limited(ms,()=>api.network.step(step,s,ms)),create:(s,ms)=>limited(ms,()=>api.network.create(s,ms)),inspectNetwork:(s,ms)=>limited(ms,()=>api.network.inspectNetwork(s,ms)),inspectContainer:(s,ms)=>limited(ms,()=>api.network.inspectContainer(s,ms))},
  psql:(s,args,raw,ms)=>limited(ms,()=>api.psql(s,args,raw,ms)),secure:(s,ms)=>limited(ms,()=>api.secure(s,ms)),
  async acquire(s,ms){try{return await limitedAsync(ms,()=>api.acquire(s,ms));}catch(error){if(ownedPools.length&&!closed&&!closeFailed)try{await endPools(10000);}catch{/* 원 회수 불명 보존 */}throw error;}},
  cleanup:(s,ms)=>limitedAsync(ms,()=>api.cleanup(s,ms)),
 });
}
