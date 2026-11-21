import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import type {Pool} from 'pg';
import {createManagementOriginHost,createManagementOriginTc01Host,type ManagementOriginHostPorts} from '../../../scripts/qa-fn03-source-content-management-origin-host.ts';
import {readManagementOriginSchemaManifest} from '../../integration/FN03/source-content-management-origin-schema.ts';
import {currentNetworkProbeContract} from '../../../scripts/qa-ix01-current-journey.ts';
const id=(n:number)=>`9a000000-0000-4000-8000-${String(n).padStart(12,'0')}`,ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
function load(){
 const cwd=fileURLToPath(new URL('../../../',import.meta.url)),git=(args:string[],input?:string)=>execFileSync('git',args,{cwd,input,windowsHide:true,maxBuffer:16*1024*1024});
 const tsv=git(['cat-file','blob','5f9e2f4f:docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv']),rows=readManagementOriginSchemaManifest(tsv),raw=git(['cat-file','--batch'],rows.map(r=>'5f9e2f4f:'+r.path).join('\n')+'\n');let offset=0;
 const files=rows.map(r=>{const end=raw.indexOf(10,offset),m=/^[a-f0-9]{40} blob ([1-9][0-9]*)$/.exec(raw.subarray(offset,end).toString('ascii'));assert(m);const start=end+1;offset=start+Number(m[1]);assert.equal(raw[offset++],10);return{id:r.id,path:r.path,bytes:raw.subarray(start,offset-1)};});assert.equal(offset,raw.length);return{tsv,files,rows};
}
let cached:ReturnType<typeof load>|undefined;
const role=(name:string)=>({name,superuser:false,inherit:false,createRole:false,createDb:false,replication:false,bypassRls:false,login:false,validUntil:null});
function harness(integrated=false){
 const source=cached??=load(),trace:string[]=[],ledger:{id:string;checksum:string}[]=[],at=Date.parse('2026-11-21T00:00:00Z');let wall=at,mono=0,active=true,revoked=false;
 const binding={attemptId:id(1),approvalId:id(2),planHash:'b'.repeat(64),approvalHash:'c'.repeat(64),sourceHead:'d'.repeat(40),issuedAt:at,expiresAt:at+1800000,artifactRoot:integrated?'/tmp/fn03-tc01-'+id(1):resolve('/synthetic-unopened-fn03/'+id(1)),subnet:'172.18.0.16/28',...(integrated?{purpose:'FN03_MANAGEMENT_ORIGIN_TC01_ISOLATED',profile:'FN03_MANAGEMENT_ORIGIN_TC01_ENTRY_V1'}:{})};
 const input={artifactRoot:binding.artifactRoot,access:{installationId:id(3),key:Buffer.alloc(32,7)},origin:'https://anvil.invalid',actorId:id(4),loginName:'synthetic-fn03',password:'Synthetic fixture only 123!',credentialGeneration:1,methodologyRef:ref(5),ids:{draftCommandId:id(6),createCommandId:id(7),policyCommandId:id(8),ruleId:id(9),managementCommandId:id(10),deniedCommandId:id(11),readCommandId:id(12)},policyExpiresAt:new Date(at+300000).toISOString(),managementPayload:{}};
 const appPool={async connect(){trace.push('APP_CONNECT');throw Error('PRIVATE_UNEXPECTED');}} as unknown as Pool;
 const resources={appPool,observer:{async query(){trace.push('OBSERVE');throw Error('PRIVATE_UNEXPECTED');}},input,
  async prepareCatalogAndUser(pool:Pool):Promise<void>{assert.equal(pool,appPool);trace.push('SEED');throw Error('PRIVATE_UNPROVIDED');},async close(timeoutMs:number){assert.equal(timeoutMs,10000);trace.push('POOL_CLOSE');}};
 const metadata=()=>JSON.stringify({sessionUser:'anvil_v3_bootstrap',currentUser:'anvil_v3_bootstrap',roles:[role('worker_owner'),role('worker_publisher'),role('anvil_v3_source_content_management_owner')],memberships:revoked?[]:[{role:'worker_owner',member:'anvil_v3_migrator',grantor:'anvil_v3_migrator',adminOption:true}]});
 const endpoint='e'.repeat(64),containerId='f'.repeat(64),networkId='a'.repeat(64);
 const ports:ManagementOriginHostPorts={now:()=>wall,monotonic:()=>mono,assertCurrent(s){assert.equal(s.database,(integrated?'anvil_v3_fn03_tc01_':'anvil_v3_fn03_management_')+id(1).replaceAll('-',''));if(!active)throw Error('PRIVATE_CURRENT');},async claim(){trace.push('CLAIM');},
  legacy:{DdlFailure:class extends Error{},parsePsqlFailure(){return null;},buildPsqlArgs(cid,db,user,path,sha){assert.equal(cid,containerId);assert.equal(db,(integrated?'anvil_v3_fn03_tc01_':'anvil_v3_fn03_management_')+id(1).replaceAll('-',''));return[user,path??'',sha??''];},roleMetadataSql:()=> 'ROLE_METADATA',
   verifyRoleMetadata(raw,phase){const v=JSON.parse(raw);assert.deepEqual(v.roles,[]);assert.deepEqual(v.memberships,[]);trace.push('VERIFY:'+phase);return{systemHash:'9'.repeat(64),memberships:[]};},revokeSql(){return'BEGIN;COMMIT;';}},
  start:{check(step){trace.push(step);},create(){trace.push('CREATE');return containerId;},start(){trace.push('START');return containerId;},async readiness(){trace.push('READINESS');}},
  network:{step(step){trace.push(step);},create(){trace.push('NETWORK_CREATE');return networkId;},inspectNetwork(s){trace.push('NETWORK_INSPECT');return JSON.stringify({id:networkId,name:s.networkName,driver:'bridge',internal:true,labels:s.labels,ipam:[{Subnet:s.subnet,Gateway:'172.18.0.17'}],containers:{[containerId]:{Name:s.containerName,IPv4Address:'172.18.0.18/28',EndpointID:endpoint}}});},inspectContainer(s){trace.push('CONTAINER_INSPECT');return JSON.stringify({id:containerId,name:'/'+s.containerName,image:s.image,user:'999:999',labels:s.labels,running:true,host:{Privileged:false,ReadonlyRootfs:true,NetworkMode:'none',LogConfig:{Type:'none',Config:{}},CapDrop:['ALL'],SecurityOpt:['no-new-privileges'],PidsLimit:64,Memory:536870912,NanoCpus:1000000000,PublishAllPorts:false,PortBindings:{},Binds:null,VolumesFrom:null,Tmpfs:currentNetworkProbeContract.tmpfs},mounts:Object.keys(currentNetworkProbeContract.tmpfs).map(Destination=>({Type:'tmpfs',Destination,RW:true,Source:''})),ports:{'5432/tcp':null},networks:{[s.networkName]:{NetworkID:networkId,IPAddress:'172.18.0.18',IPPrefixLen:28,Gateway:'172.18.0.17',EndpointID:endpoint}}});}},
  psql(_s,args,raw){
   if(args[1]){const row=source.rows.find(r=>r.path===args[1]);assert(row);assert.equal(args[2],row.sha256);assert.deepEqual(Buffer.from(raw),source.files.find(f=>f.path===row.path)!.bytes);trace.push('SQL:'+row.id);return'';}
   if(raw==='ROLE_METADATA'){trace.push('ROLE_READ');return metadata();}
   if(typeof raw==='string'&&raw.startsWith('INSERT INTO anvil.schema_migrations')){const m=/VALUES\('([^']+)','([a-f0-9]+)'\)/.exec(raw);assert(m);ledger.push({id:m[1]!,checksum:m[2]!});return'';}
   if(typeof raw==='string'&&raw.startsWith('SELECT COALESCE')){trace.push('LEDGER');return JSON.stringify(ledger);}
   assert.equal(raw,'BEGIN;REVOKE worker_owner FROM anvil_v3_migrator;COMMIT;');trace.push('REVOKE');revoked=true;return'';
  },secure(){trace.push('SECURE');},async acquire(s){trace.push('ACQUIRE');assert.equal(s.host,'172.18.0.18');return resources;},async cleanup(){trace.push('CLEANUP');}};
 return{source,binding,ports,resources,trace,stop(){active=false;},advance(n:number){wall+=n;mono+=n;},mono(n:number){mono+=n;}};
}
test('실제 runner132→회수→exact /28→동일 auth fixture 호출; 미공급 seed에서 정지/원 Pool만 회수',async()=>{
 const h=harness(),host=createManagementOriginHost(h.ports);assert.equal(h.trace.length,0);
 const r=await host.run(h.binding,h.source.tsv,h.source.files);assert.equal(r.status,'STOPPED');assert.equal(r.stage,'AUTH');assert.equal(r.poolClosed,true);
 assert.equal(h.trace.filter(x=>x.startsWith('SQL:')).length,132);assert.equal(h.trace.filter(x=>x==='SEED').length,1);
 assert.deepEqual(h.trace.slice(-17),['ROLE_READ','VERIFY:SETTLED','SECURE','REVOKE','ROLE_READ','VERIFY:REVOKED','PRECHECK','NETWORK_CREATE','CREATE_VERIFY','NONE_VERIFY','DISCONNECT','DETACHED_VERIFY','CONNECT','NETWORK_INSPECT','CONTAINER_INSPECT','ACQUIRE','SEED','POOL_CLOSE'].slice(-17));
 assert(!h.trace.includes('APP_CONNECT')&&!h.trace.includes('CLEANUP'));assert.equal(r.authority,'NOT_ISSUED');assert(!JSON.stringify(r).includes('PRIVATE'));
 const length=h.trace.length;assert.equal((await host.run(h.binding,h.source.tsv,h.source.files)).reason,'ATTEMPT_CONSUMED');assert.equal(h.trace.length,length);
});
test('승인/원바이트/대역/현재성 불명은 claim과 생성0',async()=>{
 for(const kind of ['binding','source','subnet','current']){const h=harness();if(kind==='binding')h.binding.approvalHash='invalid';if(kind==='subnet')h.binding.subnet='172.18.0.17/28';if(kind==='current')h.stop();const files=kind==='source'?h.source.files.map((f,i)=>i?f:{...f,bytes:Buffer.alloc(f.bytes.length)}):h.source.files;
  const r=await createManagementOriginHost(h.ports).run(h.binding,h.source.tsv,files);assert.equal(r.status,'STOPPED');assert.deepEqual(h.trace,[]);
 }
});
test('start/DDL/secure/network 실패·늦은 성공 뒤 후속 조회·acquire·cleanup0',async()=>{
 for(const kind of ['start','ddl','secure','network','late']){const h=harness();
  if(kind==='start')h.ports.start.start=()=>{h.trace.push('START_BAD');return'0'.repeat(64);};
  if(kind==='ddl'){const original=h.ports.psql;h.ports.psql=(...args)=>{if(args[1][1]){h.trace.push('DDL_UNKNOWN');throw Error('PRIVATE_DDL');}return original(...args);};}
  if(kind==='secure')h.ports.secure=()=>{h.trace.push('SECURE_BAD');throw Error('PRIVATE_SECURE');};
  if(kind==='network')h.ports.network.inspectNetwork=()=>{h.trace.push('NETWORK_BAD');return'{}';};
  if(kind==='late')h.ports.start.readiness=async()=>{h.trace.push('READINESS_LATE');h.advance(600001);};
  const r=await createManagementOriginHost(h.ports).run(h.binding,h.source.tsv,h.source.files);assert.equal(r.status,'STOPPED');assert(!h.trace.includes('ACQUIRE')&&!h.trace.includes('CLEANUP'));assert.equal(h.trace.at(-1),{start:'START_BAD',ddl:'DDL_UNKNOWN',secure:'SECURE_BAD',network:'NETWORK_BAD',late:'READINESS_LATE'}[kind]);
 }
});
test('획득 중 기한/원문맥 상실은 새 인증0, 반환된 원 handle close1',async()=>{
 for(const kind of ['late','close']){const h=harness();const acquire=h.ports.acquire;h.ports.acquire=async(...args)=>{const r=await acquire(...args);if(kind==='late')h.advance(90001);return r;};if(kind==='close')h.resources.close=async()=>{h.trace.push('CLOSE_UNKNOWN');throw Error('PRIVATE_CLOSE');};
  const r=await createManagementOriginHost(h.ports).run(h.binding,h.source.tsv,h.source.files);assert.equal(r.status,'STOPPED');assert.equal(r.poolClosed,kind==='late');assert(!h.trace.includes('CLEANUP'));if(kind==='late')assert(!h.trace.includes('SEED'));assert.equal(h.trace.filter(x=>x==='POOL_CLOSE'||x==='CLOSE_UNKNOWN').length,1);
 }
});
test('wall 정지 중 PG10분/원 여정90초 monotonic 만료도 다음 효과0',async()=>{
 for(const phase of ['PG','JOURNEY']){const h=harness();
  if(phase==='PG')h.ports.start.readiness=async()=>{h.trace.push('MONO_PG');h.mono(600000);};
  else {const acquire=h.ports.acquire;h.ports.acquire=async(...args)=>{const r=await acquire(...args);h.mono(90000);return r;};}
  const r=await createManagementOriginHost(h.ports).run(h.binding,h.source.tsv,h.source.files);assert.equal(r.status,'STOPPED');
  assert(!h.trace.includes('SEED'));if(phase==='PG')assert.equal(h.trace.at(-1),'MONO_PG');else assert.equal(h.trace.at(-1),'POOL_CLOSE');
 }
});
test('PostgreSQL json_build_object 공백을 가진 최초/회수 후 역할 projection을 동일 검산한다',async()=>{
 const h=harness(),psql=h.ports.psql;h.ports.psql=(...args)=>{const raw=psql(...args);return args[2]==='ROLE_METADATA'?JSON.stringify(JSON.parse(raw),null,1):raw;};
 const r=await createManagementOriginHost(h.ports).run(h.binding,h.source.tsv,h.source.files);assert.equal(r.stage,'AUTH');assert.equal(h.trace.filter(x=>x==='ROLE_READ').length,2);assert(h.trace.includes('VERIFY:REVOKED'));assert(h.trace.includes('SEED'));
});
test('원 method/Pool close 교체를 거절하고 원 close에만 고정 10초를 전달한다',async()=>{
 for(const kind of ['start','close']){const h=harness();
  if(kind==='start')h.ports.start.readiness=async()=>{h.trace.push('METHOD_CHANGED');h.ports.start.check=()=>{h.trace.push('REPLACED');};};
  else h.resources.prepareCatalogAndUser=async()=>{h.trace.push('CLOSE_CHANGED');h.resources.close=async()=>{h.trace.push('WRONG_CLOSE');};};
  const r=await createManagementOriginHost(h.ports).run(h.binding,h.source.tsv,h.source.files);assert.equal(r.status,'STOPPED');assert(!h.trace.includes('REPLACED')&&!h.trace.includes('WRONG_CLOSE')&&!h.trace.includes('APP_CONNECT')&&!h.trace.includes('CLEANUP'));if(kind==='close')assert.equal(h.trace.at(-1),'POOL_CLOSE');
 }
});
test('원 Pool close의 10초 뒤 늦은 성공은 종결확정·정리로 승격하지 않는다',async()=>{
 const h=harness();h.resources.close=async(ms)=>{assert.equal(ms,10000);h.trace.push('CLOSE_LATE');h.mono(10001);};
 const r=await createManagementOriginHost(h.ports).run(h.binding,h.source.tsv,h.source.files);assert.equal(r.status,'STOPPED');assert.equal(r.poolClosed,false);assert.equal(h.trace.at(-1),'CLOSE_LATE');assert(!h.trace.includes('CLEANUP'));
});
test('일반 실행/130 설치/새 연결 생성 없음; 정상 app/Pool 종결 뒤만 정리 분기',()=>{
 const s=readFileSync(new URL('../../../scripts/qa-fn03-source-content-management-origin-host.ts',import.meta.url),'utf8');
 assert.doesNotMatch(s,/new Pool|process\.env|process\.argv|\.listen\(|child_process|runCurrentJourney\(|installCurrentSchema\(|\.runCurrentChild/);
 assert(s.indexOf('if(!checked)return outcome')<s.indexOf('cleanup.call'));
 assert.match(s,/result.status==='CHECKED'&&result.appClosed/);assert.match(s,/check\(poolClosed\)/);
});


test('통합 host는 원 132/정확 namespace/신규 runner로 연결하고 교차 binding은 claim0',async()=>{
 const h=harness(true);const r=await createManagementOriginTc01Host(h.ports).run(h.binding,h.source.tsv,h.source.files);
 assert.equal(r.stage,'AUTH');assert.equal(r.status,'STOPPED');assert.equal(h.trace.filter(x=>x.startsWith('SQL:')).length,132);assert(!h.trace.includes('CLEANUP'));
 for(const fault of ['legacy','profile','root','new-on-old','root-parent','root-relative']){
  const x=harness(fault!=='new-on-old');
  if(fault==='profile')x.binding.profile='FN03_MANAGEMENT_ORIGIN_ENTRY_V1';
  if(fault==='root-parent')x.binding.artifactRoot='/other/fn03-tc01-'+id(1);if(fault==='root-relative')x.binding.artifactRoot='tmp/fn03-tc01-'+id(1);
  if(fault==='root')x.binding.artifactRoot=resolve('/synthetic/anvil-v3-fn03-management-'+id(1));
  const out=await (fault==='legacy'?createManagementOriginHost:createManagementOriginTc01Host)(x.ports).run(x.binding,x.source.tsv,x.source.files);
  assert.equal(out.status,'STOPPED');assert.deepEqual(x.trace,[]);
 }
});

test('통합 host의 원 runner 선택·FN03 완료 보존·앱/Pool 종결과 기한 뒤에만 cleanup',async()=>{
 let h:ReturnType<typeof harness>,mode='',selected=0;
 const auth=mock.module('../../../scripts/qa-fn03-source-content-management-origin-auth-fixture.ts',{namedExports:{createManagementOriginAuthFixture:()=>({async prepareFixtureInput(){h.trace.push('AUTH_FIXTURE');return{};},dispose(){h.trace.push('AUTH_DISPOSE');}})}});
 const runner=mock.module('../../../scripts/qa-fn03-source-content-management-origin.ts',{namedExports:{
  createManagementOriginRunner(){throw Error('WRONG_LEGACY_FACTORY');},
  createManagementOriginTc01Runner(ports:any){selected++;return{async run(_tsv:unknown,files:any[]){
   const rows=readManagementOriginSchemaManifest(h.source.tsv);
   for(let i=0;i<files.length;i++){await ports.installation.install(files[i].bytes,rows[i]);await ports.installation.appendLedger(rows[i]);}
   await ports.installation.readLedger();const metadata=JSON.parse(await ports.readRoleMetadata());metadata.roles=metadata.roles.filter((r:any)=>r.name!=='anvil_v3_source_content_management_owner');ports.verifyExistingRoles(JSON.stringify(metadata));
   await ports.prepareFixtureInput(ports.pool);h.trace.push('RUNNER_TC01');if(mode==='late')h.mono(90000);
   return{status:mode==='tc01'||mode==='fn03'?'STOPPED':'CHECKED',stage:'TC01',appClosed:mode!=='app-close',settlements:['COMMIT'],releases:['RELEASED'],journeys:{fn03:mode==='fn03'?'NOT_CHECKED':'CHECKED',tc01:mode==='tc01'||mode==='fake-success'?'STARTED':mode==='fn03'?'NOT_STARTED':'CHECKED',tc01Stage:null}};
  }};}
 }});
 try{
  const path='../../../scripts/qa-fn03-source-content-management-origin-host.ts?tc01-profile';const module=await import(path);
  for(mode of ['ok','tc01','fn03','late','app-close','pool-close','fake-success']){
   h=harness(true);if(mode==='pool-close')h.resources.close=async()=>{h.trace.push('POOL_CLOSE_FAILED');throw Error('PRIVATE');};
   const out=await module.createManagementOriginTc01Host(h.ports).run(h.binding,h.source.tsv,h.source.files);
   assert.equal(out.status,mode==='ok'?'CHECKED':'STOPPED',mode);assert.equal(out.journeys.fn03,mode==='fn03'?'NOT_CHECKED':'CHECKED',mode);
   assert.equal(h.trace.filter(x=>x==='CLEANUP').length,mode==='ok'?1:0,mode);
   assert.equal(h.trace.filter(x=>x==='POOL_CLOSE'||x==='POOL_CLOSE_FAILED').length,1,mode);
   if(mode==='ok')assert(h.trace.indexOf('POOL_CLOSE')<h.trace.indexOf('CLEANUP'));
  }
  assert.equal(selected,7);
 }finally{runner.restore();auth.restore();}
});
