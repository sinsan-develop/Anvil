import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import type {Pool} from 'pg';
import {buildOfficialForms} from '../../../apps/server/modules/documents/forms.ts';
import {buildBuiltinMethodologies} from '../../../apps/server/modules/methodologies/builtins.ts';
import {readManagementOriginSchemaManifest} from '../../integration/FN03/source-content-management-origin-schema.ts';
import {currentNetworkProbeContract,currentProfile} from '../../../scripts/qa-ix01-current-journey.ts';
import {createManagementOriginHost} from '../../../scripts/qa-fn03-source-content-management-origin-host.ts';
import {createManagementOriginIsolatedPorts,consumeManagementOriginDockerCall,managementOriginDatabaseIdentitySql,type ManagementOriginIsolatedInput,type ManagementOriginIsolatedProviders,type ManagementOriginDockerCall} from '../../../scripts/qa-fn03-source-content-management-origin-isolated-ports.ts';
const id=(n:number)=>`9b000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function load(){
 const cwd=fileURLToPath(new URL('../../../',import.meta.url)),git=(args:string[],input?:string)=>execFileSync('git',args,{cwd,input,windowsHide:true,maxBuffer:16*1024*1024}),blob=(path:string)=>git(['cat-file','blob','9a176646:'+path]);
 const historicalTsv=blob('docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv'),rows=readManagementOriginSchemaManifest(historicalTsv),batch=git(['cat-file','--batch'],rows.map(r=>'9a176646:'+r.path).join('\n')+'\n');let cursor=0;
 const sql=rows.map(r=>{const end=batch.indexOf(10,cursor),m=/^[a-f0-9]{40} blob ([1-9][0-9]*)$/.exec(batch.subarray(cursor,end).toString('ascii'));assert(m);const start=end+1;cursor=start+Number(m[1]);assert.equal(batch[cursor++],10);return{id:r.id,path:r.path,bytes:batch.subarray(start,cursor-1)};});assert.equal(cursor,batch.length);
 const sources={forms:blob(currentProfile.forms),standard:blob(currentProfile.standard),methods:blob(currentProfile.methods)},forms=buildOfficialForms(sources.forms,sources.standard),method=buildBuiltinMethodologies(sources.methods,forms.forms)[0]!;
 return{historicalTsv,rows,sql,sources,legacyBytes:blob(currentProfile.legacy),methodologyRef:{id:method.id,version:method.version,contentHash:method.contentHash}};
}
let cached:ReturnType<typeof load>|undefined;
const system=['pg_database_owner','pg_read_all_data','pg_write_all_data','pg_monitor','pg_read_all_settings','pg_read_all_stats','pg_stat_scan_tables','pg_read_server_files','pg_write_server_files','pg_execute_server_program','pg_signal_backend','pg_checkpoint'];
function harness(fault=''){
 const source=cached??=load(),at=Date.parse('2026-11-21T00:00:00Z'),trace:string[]=[],calls:ManagementOriginDockerCall[]=[],ledger:{id:string;checksum:string}[]=[];
 let active=true,time=at,mono=0,started=false,bootstrapped=false,revoked=false,count=0,net=false,attached=false,detached=false,stopped=false,removed=false,netRemoved=false;
 const cid='1'.repeat(64),nid='2'.repeat(64),none='3'.repeat(64),endpoint='4'.repeat(64),tag=id(1).replaceAll('-',''),name='anvil_v3_fn03_management_'+tag;
 const binding={attemptId:id(1),approvalId:id(2),planHash:'5'.repeat(64),approvalHash:'6'.repeat(64),sourceHead:'7'.repeat(40),issuedAt:at,expiresAt:at+1800000,artifactRoot:resolve('/synthetic-fn03-unopened/'+id(1)),subnet:'172.18.0.16/28'};
 const input:ManagementOriginIsolatedInput={binding,receiptRoot:'/synthetic-receipts/fn03-management-'+id(1),historicalTsv:source.historicalTsv,legacyBytes:source.legacyBytes,sources:source.sources,passwords:{bootstrap:'a'.repeat(64),app:'b'.repeat(64),migrator:'c'.repeat(64)},fixture:{artifactRoot:binding.artifactRoot,access:{installationId:id(3),key:Buffer.alloc(32,8)},origin:'https://anvil.invalid',actorId:id(4),loginName:'fn03-isolated-fixture',password:'Synthetic fixture only 123!',credentialGeneration:1,methodologyRef:source.methodologyRef,ids:{draftCommandId:id(6),createCommandId:id(7),policyCommandId:id(8),ruleId:id(9),managementCommandId:id(10),deniedCommandId:id(11),readCommandId:id(12)},policyExpiresAt:new Date(at+300000).toISOString(),managementPayload:{}}};
 const labels={'anvil.owner':'FN03_MANAGEMENT_ORIGIN','anvil.instance':tag,'anvil.plan':binding.planHash};
 const roles=()=>{
  const row=(name:string,owner=false)=>{const bootstrap=name==='anvil_v3_bootstrap',migration=name==='anvil_v3_migrator';return{name,superuser:bootstrap,inherit:!owner,createRole:bootstrap||migration&&!revoked,createDb:bootstrap,replication:bootstrap,bypassRls:bootstrap,login:bootstrap||migration||name==='anvil_v3_app',validUntil:null};};
  const all=[...system.map(n=>row(n)),row('anvil_v3_bootstrap')],memberships=system.filter(n=>['pg_read_all_settings','pg_read_all_stats','pg_stat_scan_tables'].includes(n)).map(role=>({role,member:'pg_monitor',grantor:'anvil_v3_bootstrap',adminOption:false}));
  if(bootstrapped){all.push(row('anvil_v3_migrator'),row('anvil_v3_app'),row('anvil_v3_provider_claim_writer',true));if(count<132)memberships.push({role:'anvil_v3_provider_claim_writer',member:'anvil_v3_migrator',grantor:'anvil_v3_bootstrap',adminOption:true});}
  if(count===132){for(const n of ['anvil_v3_fn16_export_reader_owner','anvil_v3_fn15_reader_owner','worker_owner','worker_publisher','anvil_v3_source_content_management_owner'])all.push(row(n,true));if(!revoked)for(const role of ['anvil_v3_fn16_export_reader_owner','anvil_v3_fn15_reader_owner','worker_owner'])memberships.push({role,member:'anvil_v3_migrator',grantor:'anvil_v3_migrator',adminOption:true});}
  all.sort((a,b)=>a.name.localeCompare(b.name));memberships.sort((a,b)=>a.role.localeCompare(b.role));return JSON.stringify({sessionUser:'anvil_v3_bootstrap',currentUser:'anvil_v3_bootstrap',roles:all,memberships},null,1);
 };
 const container=()=>({id:cid,name:'/'+name,image:currentNetworkProbeContract.image,user:'999:999',labels,running:started&&!stopped,host:{Privileged:false,ReadonlyRootfs:true,NetworkMode:'none',LogConfig:{Type:'none',Config:{}},CapDrop:['ALL'],SecurityOpt:['no-new-privileges'],PidsLimit:64,Memory:536870912,NanoCpus:1000000000,PublishAllPorts:false,PortBindings:{},Binds:null,VolumesFrom:null,Tmpfs:currentNetworkProbeContract.tmpfs},mounts:Object.keys(currentNetworkProbeContract.tmpfs).map(Destination=>({Type:'tmpfs',Destination,RW:true,Source:''})),ports:{'5432/tcp':null},networks:attached?{[name+'_net']:{NetworkID:nid,IPAddress:'172.18.0.18',IPPrefixLen:28,EndpointID:endpoint}}:started&&!detached?{none:{NetworkID:none,IPAddress:''}}:{}});
 const pools:Pool[]=[],poolNames=new Map<Pool,string>(),poolQueries:string[]=[];
 const providers:ManagementOriginIsolatedProviders={now:()=>time,monotonic:()=>mono,assertCurrent(b){assert.deepEqual(b,binding);if(!active)throw Error('PRIVATE_CURRENT');},async consume(){trace.push('CLAIM');if(fault==='claim')throw Error('PRIVATE_CLAIM');},async wait(ms){assert.equal(ms,250);mono+=ms;time+=ms;},
  command(call){consumeManagementOriginDockerCall(call,binding);calls.push(call);assert.equal(call.file,'/usr/bin/docker');assert.equal(call.shell,false);assert.equal(call.maxBuffer,65536);assert(call.timeoutMs>0);assert.deepEqual(call.argv.slice(0,4),['--config',input.receiptRoot+'/docker-config','--host','unix:///var/run/docker.sock']);const args=call.argv.slice(4);let out='';
   if(args[0]==='info')out=JSON.stringify({ID:fault==='daemon'?'wrong':currentProfile.daemon,Name:'SINSAN'});
   else if(args[0]==='image')out=JSON.stringify({id:currentNetworkProbeContract.image,volumes:{'/var/lib/postgresql/data':{}}});
   else if(args[0]==='create'){trace.push('CREATE');assert(args.includes('--pull')&&args[args.indexOf('--pull')+1]==='never');assert(!args.includes('-p')&&!args.includes('--publish')&&!args.includes('-v'));assert.equal(call.env.POSTGRES_PASSWORD,input.passwords.bootstrap);out=cid;}
   else if(args[0]==='start'){started=true;trace.push('START');out=fault==='start'?nid:cid;}
   else if(args[0]==='container'&&args[1]==='inspect')out=JSON.stringify(container());
   else if(args[0]==='container'&&args[1]==='ls')out=fault==='collision'&&!removed?cid:'';
   else if(args[0]==='network'&&args[1]==='ls')out='';
   else if(args[0]==='network'&&args[1]==='create'){trace.push('NETWORK_CREATE');assert.equal(args[args.indexOf('--subnet')+1],binding.subnet);assert(args.includes('--internal'));net=true;out=nid;}
   else if(args[0]==='network'&&args[1]==='inspect'){if(args.at(-1)===none)out=JSON.stringify({id:none,name:'none',driver:'null'});else{assert(net);out=JSON.stringify({id:nid,name:name+'_net',driver:'bridge',internal:true,labels,ipam:[{Subnet:fault==='subnet'?'172.18.0.32/28':binding.subnet,Gateway:'172.18.0.17'}],containers:attached&&!removed?{[cid]:{Name:name,IPv4Address:'172.18.0.18/28',EndpointID:endpoint}}:{}});}}
   else if(args[0]==='network'&&args[1]==='disconnect'){assert.deepEqual(args.slice(2),[none,cid]);detached=true;trace.push('DISCONNECT');}
   else if(args[0]==='network'&&args[1]==='connect'){assert.deepEqual(args.slice(2),[nid,cid]);attached=true;trace.push('CONNECT');}
   else if(args[0]==='stop'){stopped=true;trace.push('STOP');}
   else if(args[0]==='container'&&args[1]==='rm'){removed=true;trace.push('REMOVE_CONTAINER');}
   else if(args[0]==='network'&&args[1]==='rm'){netRemoved=true;trace.push('REMOVE_NETWORK');}
   else if(args[0]==='exec'){
    assert(args.includes(cid));
    if(args.includes('/proc/1/comm'))out='postgres\n';
    else if(args.includes('pg_isready'))out='';
    else if(args.includes('sh')){assert.equal(args.at(-1),'umask 077; cat > /var/lib/postgresql/data/pg_hba.conf');trace.push('HBA');}
    else if(args.includes('/var/lib/postgresql/data/pg_hba.conf'))out='local all all trust\nhost all all 0.0.0.0/0 scram-sha-256\nhost all all ::/0 reject\n';
    else if(args.includes('psql')){
     assert(args.includes('--dbname='+name)&&args.includes('--no-psqlrc')&&args.includes('--file=-'));const raw=call.input;
     if(raw instanceof Uint8Array){const row=source.rows[count]!;assert.equal(raw.byteLength,row.bytes);assert.deepEqual(Buffer.from(raw),source.sql[count]!.bytes);assert.equal(args.includes('--single-transaction'),row.path.includes('/0037_'));if(fault==='ddl')throw Error('PRIVATE_DDL');count++;trace.push('DDL');}
     else if(typeof raw==='string'&&raw.startsWith('INSERT INTO anvil.schema_migrations')){const r=source.rows[ledger.length]!;ledger.push({id:r.id,checksum:r.sha256});}
     else if(typeof raw==='string'&&raw.startsWith('SELECT COALESCE'))out=JSON.stringify(ledger);
     else if(typeof raw==='string'&&raw.includes("'sessionUser'"))out=roles();
     else if(typeof raw==='string'&&raw.includes("'owner',pg_get_userbyid"))out=JSON.stringify({db:name,owner:'anvil_v3_bootstrap',socket:true});
     else if(typeof raw==='string'&&raw.startsWith('BEGIN;CREATE ROLE')){assert(!raw.includes('anvil_v3_ix01_ddl_20261104_r9_a1'));bootstrapped=true;trace.push('BOOTSTRAP');}
     else if(typeof raw==='string'&&raw.startsWith("BEGIN;SET LOCAL password_encryption"))trace.push('SCRAM');
     else if(typeof raw==='string'&&raw.includes("'reload',pg_reload_conf()"))out=JSON.stringify({reload:true,passwords:true,rules:true});
     else if(typeof raw==='string'&&raw.startsWith('BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE')){revoked=true;trace.push('REVOKE');}
     else throw Error('UNEXPECTED_SYNTHETIC_SQL');
    }else throw Error('UNEXPECTED_SYNTHETIC_EXEC');
   }else throw Error('UNEXPECTED_SYNTHETIC_DOCKER');
   return{status:0,signal:null,stdout:out};
  },
  async openPool(request){trace.push('OPEN:'+request.user);assert.equal(request.host,'172.18.0.18');assert.equal(request.database,name);assert.equal(request.port,5432);assert.equal(request.ssl,false);const bootstrap=request.user==='anvil_v3_bootstrap';
   const pool={async query(text:string){poolQueries.push(text===managementOriginDatabaseIdentitySql?'IDENTITY':'QUERY');if(text===managementOriginDatabaseIdentitySql)return{rows:[{db:fault==='identity'?'wrong':name,role:request.user,session_role:request.user,address:request.host,port:5432,rolsuper:bootstrap,rolbypassrls:bootstrap,rolcreaterole:bootstrap,rolcreatedb:bootstrap,rolreplication:bootstrap}]};assert.equal(text,'SELECT count(*)::int n FROM anvil.users');return{rows:[{n:0}]};},
    async connect(){trace.push('CLIENT:'+request.user);if(fault==='late-connect')active=false;return{release(destroy:boolean){assert.equal(destroy,true);trace.push('RELEASE_CLIENT');},async query(text:string){trace.push(text==='BEGIN'||text==='COMMIT'||text==='ROLLBACK'?text:'SEED_QUERY');if(text==='BEGIN'){if(fault==='late-begin')active=false;return{command:'BEGIN',rows:[]};}return{command:'SELECT',rows:[]};}};},async end(){throw Error('UNEXPECTED_DIRECT_END');}} as unknown as Pool;
   pools.push(pool);poolNames.set(pool,request.user);return pool;
  },async closePool(pool,ms){assert(pools.includes(pool)&&ms>0&&ms<=10000);trace.push('END:'+poolNames.get(pool));if(fault==='close'&&pool===pools[1])throw Error('PRIVATE_CLOSE');},async prepareArtifactRoot(){trace.push('ROOT');},
 };
 return{source,input,providers,trace,calls,poolQueries,pools,advance(n:number){mono+=n;time+=n;},get state(){return{count,netRemoved};}};
}
test('실제 R9/host132를 recorder에 연결: exact 새 자원·SCRAM/회수·3개 Pool 신원·기존 seed까지',async()=>{
 const h=harness(),ports=await createManagementOriginIsolatedPorts(h.input,h.providers);assert.equal(h.calls.length,0);
 const r=await createManagementOriginHost(ports).run(h.input.binding,h.source.historicalTsv,h.source.sql);
 assert.equal(r.status,'STOPPED');assert.equal(r.stage,'AUTH');assert.equal(r.poolClosed,true);assert.equal(h.state.count,132);
 assert.deepEqual(h.trace.filter(x=>x.startsWith('OPEN:')),['OPEN:anvil_v3_app','OPEN:anvil_v3_migrator','OPEN:anvil_v3_bootstrap']);assert.equal(h.poolQueries.filter(x=>x==='IDENTITY').length,3);
 assert(h.trace.indexOf('REVOKE')<h.trace.indexOf('NETWORK_CREATE'));assert(h.trace.includes('ROOT')&&h.trace.includes('SEED_QUERY')&&h.trace.includes('RELEASE_CLIENT'));assert(!h.trace.includes('STOP')&&!h.trace.includes('ROLLBACK'));
 assert.deepEqual(h.trace.slice(-3),['END:anvil_v3_bootstrap','END:anvil_v3_migrator','END:anvil_v3_app']);assert(!JSON.stringify(r).includes('PRIVATE'));
});
test('구 legacy 바이트 변조는 factory에서 거절하며 command/Pool0',async()=>{
 const h=harness();h.input.legacyBytes=Buffer.alloc(h.input.legacyBytes.length);await assert.rejects(createManagementOriginIsolatedPorts(h.input,h.providers));assert.equal(h.calls.length,0);assert.equal(h.pools.length,0);
});
test('claim/daemon/기존 이름/START/DDL/대역 불명 뒤 재시도·Pool·삭제0',async()=>{
 for(const mode of ['claim','daemon','collision','start','ddl','subnet']){const h=harness(mode),p=await createManagementOriginIsolatedPorts(h.input,h.providers),host=createManagementOriginHost(p);const r=await host.run(h.input.binding,h.source.historicalTsv,h.source.sql);assert.equal(r.status,'STOPPED');assert.equal(h.pools.length,0);assert(!h.trace.includes('STOP'));const calls=h.calls.length;await host.run(h.input.binding,h.source.historicalTsv,h.source.sql);assert.equal(h.calls.length,calls);}
});
test('교차 DB 신원은 첫 Pool만 회수하고 다른 연결·root·seed0',async()=>{
 const h=harness('identity'),p=await createManagementOriginIsolatedPorts(h.input,h.providers),r=await createManagementOriginHost(p).run(h.input.binding,h.source.historicalTsv,h.source.sql);assert.equal(r.status,'STOPPED');assert.equal(h.pools.length,1);assert.equal(h.trace.at(-1),'END:anvil_v3_app');assert(!h.trace.includes('ROOT'));
});
test('connect/BEGIN 뒤 현재성 상실에도 원 client release1·후속 SQL0',async()=>{
 for(const mode of ['late-connect','late-begin']){const h=harness(mode),p=await createManagementOriginIsolatedPorts(h.input,h.providers);const r=await createManagementOriginHost(p).run(h.input.binding,h.source.historicalTsv,h.source.sql);assert.equal(r.status,'STOPPED');assert.equal(h.trace.filter(x=>x==='RELEASE_CLIENT').length,1);assert(!h.trace.includes('SEED_QUERY')&&!h.trace.includes('ROLLBACK'));assert.equal(h.trace.filter(x=>x==='BEGIN').length,mode==='late-begin'?1:0);assert.equal(h.trace.filter(x=>x.startsWith('END:')).length,3);}
});
test('close 실패는 재호출해도 성공으로 바뀌지 않고 원 end 추가0',async()=>{
 const h=harness('close'),p=await createManagementOriginIsolatedPorts(h.input,h.providers);let acquired:Awaited<ReturnType<typeof p.acquire>>|undefined;
 const r=await createManagementOriginHost({...p,async acquire(...args){acquired=await p.acquire(...args);return acquired;}}).run(h.input.binding,h.source.historicalTsv,h.source.sql);assert.equal(r.poolClosed,false);assert(acquired);const count=h.trace.length;await assert.rejects(acquired.close(10000));assert.equal(h.trace.length,count);assert(!h.trace.includes('STOP'));
});
test('한 복합 단계의 잔여 시간 소진은 다음 Docker 호출0, 늦은 Pool은 원 회수만',async()=>{
 const h=harness(),command=h.providers.command;let count=0;
 h.providers.command=call=>{const r=command(call);if(++count===1)h.advance(10000);return r;};
 const p=await createManagementOriginIsolatedPorts(h.input,h.providers),r=await createManagementOriginHost(p).run(h.input.binding,h.source.historicalTsv,h.source.sql);assert.equal(r.status,'STOPPED');assert.equal(h.calls.length,1);assert(!h.trace.includes('CREATE'));
 const late=harness(),open=late.providers.openPool;late.providers.openPool=async q=>{const pool=await open(q);late.advance(10001);return pool;};
 const lp=await createManagementOriginIsolatedPorts(late.input,late.providers),lr=await createManagementOriginHost(lp).run(late.input.binding,late.source.historicalTsv,late.source.sql);assert.equal(lr.status,'STOPPED');assert.equal(late.pools.length,1);assert.equal(late.poolQueries.length,0);assert.equal(late.trace.at(-1),'END:anvil_v3_app');
});
test('별도 bootstrap observer에는 고정 두 SQL/UUID 선택만, 임의 SQL0',async()=>{
 const h=harness(),p=await createManagementOriginIsolatedPorts(h.input,h.providers);let verified=false;
 await createManagementOriginHost({...p,async acquire(...args){const saved=await p.acquire(...args),n=h.poolQueries.length;
  await assert.rejects(saved.observer.query('SELECT * FROM anvil.users',[]));assert.equal(h.poolQueries.length,n);verified=true;return saved;
 }}).run(h.input.binding,h.source.historicalTsv,h.source.sql);assert(verified);assert(!h.trace.includes('STOP')&&!h.trace.includes('SEED_QUERY'));
});

test('native 원 호출은 raw/다른 시도/중복/반환 후 소비와 바뀐 SQL을 거절한다',async()=>{
 for(const fault of ['raw','other','duplicate','input']){
  const h=harness(),original=h.providers.command;let refused=false;
  h.providers.command=call=>{
   if(fault==='input'&&!(call.input instanceof Uint8Array))return original(call);
   const before=h.calls.length;
   if(fault==='input'){const bytes=call.input as Uint8Array;bytes[0]=bytes[0]!^1;}
   if(fault==='duplicate')consumeManagementOriginDockerCall(call,h.input.binding);
   assert.throws(()=>consumeManagementOriginDockerCall(fault==='raw'?{...call}:call,fault==='other'?{...h.input.binding,attemptId:id(99)}:h.input.binding));
   assert.equal(h.calls.length,before);refused=true;throw Error('FIXED_TEST_STOP');
  };
  const p=await createManagementOriginIsolatedPorts(h.input,h.providers);await createManagementOriginHost(p).run(h.input.binding,h.source.historicalTsv,h.source.sql);assert(refused);assert(!h.trace.includes('STOP'));
  if(h.calls[0])assert.throws(()=>consumeManagementOriginDockerCall(h.calls[0]!,h.input.binding));
 }
});
