import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readCurrentSchemaManifest} from '../../integration/IX01/current-schema-baseline.ts';
import {currentLegacyModuleSource,currentProfile,currentRequiredSources,readCurrentAuthorization,runCurrentJourney,verifyCurrentChildOutcome,verifyCurrentHandoff,type CurrentInput,type CurrentPlan,type CurrentPorts} from '../../../scripts/qa-ix01-current-journey.ts';

const cwd=fileURLToPath(new URL('../../../',import.meta.url));
const git=(args:string[],input?:string)=>execFileSync('git',args,{cwd,input,windowsHide:true,maxBuffer:16*1024*1024});
const now=1_790_000_000_000,containerId='a'.repeat(64),networkId='b'.repeat(64);
test('IX01 runtime 고정 진단 RAM: 단계 실패는 비밀 없이 후속 작업을 차단한다',async()=>{
 const runtime=await import('../../../scripts/qa-ix01-current-journey.ts');
 assert.equal(typeof runtime.runCurrentRuntimeSteps,'function');
 const names=['DIRECTORIES','CONFIG','TOOLS','LOCK','VERSION','PREINSTALL','INSTALL','POSTINSTALL'] as const;
 for(const failed of names){
  const calls:string[]=[];
  const steps=Object.fromEntries(names.map(name=>[name,()=>{calls.push(name);if(name===failed)throw Object.assign(Error('secret/path/argv'),{stdout:'secret',stderr:'secret'});}])) as Record<typeof names[number],()=>void>;
  let caught:unknown;
  try{runtime.runCurrentRuntimeSteps(steps);}catch(error){caught=error;}
  assert.equal(runtime.currentRuntimeFailureCode(caught),'STOPPED_RUNTIME_'+failed);
  assert.deepEqual(calls,names.slice(0,names.indexOf(failed)+1));
  assert.equal(JSON.stringify(caught),'{}');
 }
 const calls:string[]=[];
 runtime.runCurrentRuntimeSteps(Object.fromEntries(names.map(name=>[name,()=>{calls.push(name);}])) as Record<typeof names[number],()=>void>);
 assert.deepEqual(calls,names);
 let reads=0;
 for(const error of [Error('STOPPED_RUNTIME_INSTALL'),{code:'STOPPED_RUNTIME_INSTALL'},new Proxy({},{get(){reads++;throw Error('secret');}})])assert.equal(runtime.currentRuntimeFailureCode(error),'STOPPED_RUNTIME');
 assert.equal(reads,0);
});
function input(change:Partial<CurrentPlan>={},decision='ALLOW_ONE_RUN'):CurrentInput{
 const plan={schemaVersion:1,purpose:'IX01_CURRENT_TC01',profile:currentProfile.owner,sourceHead:'1'.repeat(40),issuedAt:now-10,expiresAt:now+10_000,gitHash:'c'.repeat(64),dockerHash:'d'.repeat(64),
  sourceFiles:currentRequiredSources.map(path=>({path,sha256:path===currentProfile.legacy?currentProfile.legacyHash:'e'.repeat(64)})),...change};
 const planRaw=canonicalJson(plan),planHash=contentHash(planRaw);
 const approvalRaw=canonicalJson({schemaVersion:1,purpose:'IX01_CURRENT_TC01_RUN_APPROVAL',profile:currentProfile.owner,approvalId:'00000000-0000-4000-8000-000000000001',decision,planHash,sourceHead:plan.sourceHead,issuedAt:plan.issuedAt,expiresAt:plan.expiresAt});
 return {planRaw,planHash,approvalRaw,approvalHash:contentHash(approvalRaw)};
}
function fixture(){
 const historical=git(['cat-file','blob','HEAD:'+currentProfile.manifest]),rows=readCurrentSchemaManifest(historical);
 const blob=git(['cat-file','--batch'],rows.map(row=>'HEAD:'+row.path).join('\n')+'\n');
 let cursor=0;
 const sql=rows.map(({id,path,bytes})=>{
  const end=blob.indexOf(0x0a,cursor);
  assert.match(blob.subarray(cursor,end).toString('ascii'),new RegExp('^[a-f0-9]{40,64} blob '+bytes+'$'));
  const start=end+1;cursor=start+bytes+1;assert.equal(blob[cursor-1],0x0a);
  return {id,path,bytes:blob.subarray(start,cursor-1)};
 });
 assert.equal(cursor,blob.length);return {historical,sql};
}
let loaded:ReturnType<typeof fixture>|undefined;
const schema=()=>loaded??=fixture();
// Node v24 TAP의 실제 inert stdout 형식. 원문·지문은 별도 child 결과에서 대조한다.
const tap='TAP version 13\n# Subtest: IX01 TC01 현재 격리 저장 여정\nok 1 - IX01 TC01 현재 격리 저장 여정\n  ---\n  duration_ms: 0.346\n  type: \'test\'\n  ...\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 7.31\n';
function outcome(handoffHash:string){
 return {status:0,signal:null,stdout:tap,stderr:'',result:{schemaVersion:1,purpose:'IX01_CURRENT_TC01_CHILD_RESULT',handoffHash,ledgerCount:130,status:'PASSED'}};
}
function harness(){
 const data=schema(),calls:string[]=[],ledger:{id:string;checksum:string}[]=[];
 let current=true,time=now;
 const ports:CurrentPorts={
  now:()=>time,assertCurrent(){if(!current)throw Error('현재성 철회');},
  async preflight(){calls.push('PREFLIGHT');return data;},
  async claim(){calls.push('CLAIM');return 'CLAIMED';},
  async prepareRuntime(){calls.push('RUNTIME');},
  async start(){calls.push('START');return containerId;},
  schema:{
   assertCurrent(){if(!current)throw Error('현재성 철회');},
   async install(raw,row){calls.push('SQL:'+row.id);assert.deepEqual(Buffer.from(raw),data.sql[ledger.length]!.bytes);return 'SETTLED';},
   async appendLedger(row){calls.push('LEDGER:'+row.id);ledger.push({id:row.id,checksum:row.sha256});return 'SETTLED';},
   async readLedger(){calls.push('VERIFY_LEDGER');return ledger;},
  },
  async secure(){calls.push('SECURE');},
  async connect(id){assert.equal(id,containerId);calls.push('NETWORK');return {containerId,networkId,host:'172.18.0.2',expiresAt:now+9000};},
  async child(handoff){calls.push('CHILD');return outcome(contentHash(canonicalJson(handoff)));},
  async cleanup(){calls.push('CLEANUP');},
  async record(){calls.push('RECORD');},
 };
 return {data,calls,ports,drop:()=>{current=false;},expire:()=>{time=now+10_000;}};
}
test('IX01 현재 실행 승인 없음·해시 변조·만료는 포트 진입 전 거절한다',async()=>{
 for(const candidate of [input({},'DENY'),{...input(),planHash:'9'.repeat(64)},{...input(),approvalRaw:'{}'},input({expiresAt:now})]){
  const h=harness();assert.equal((await runCurrentJourney(candidate,h.ports)).status,'REJECTED');assert.deepEqual(h.calls,[]);
 }
});
test('IX01 SQL 사전 검산과 단발 claim은 실제 효과보다 앞선다',async()=>{
 const bad=harness(),pre=bad.ports.preflight;
 bad.ports.preflight=async auth=>{const data=await pre(auth);return {...data,sql:data.sql.slice(1)};};
 assert.equal((await runCurrentJourney(input(),bad.ports)).status,'REJECTED');assert.deepEqual(bad.calls,['PREFLIGHT']);
 const duplicate=harness();
 duplicate.ports.claim=async()=>{duplicate.calls.push('CLAIM');return 'DUPLICATE';};
 const result=await runCurrentJourney(input(),duplicate.ports);
 assert.equal(result.code,'ALREADY_CLAIMED');assert.deepEqual(duplicate.calls,['PREFLIGHT','CLAIM']);
});
test('IX01 현재 격리 합성 제어는 130 설치·원장→SCRAM/회수→내부망→자식→확정 정리 순서다',async()=>{
 const h=harness(),result=await runCurrentJourney(input(),h.ports);
 assert.deepEqual([result.status,result.code,result.containerId,result.networkId],['CLEANED','TC01_PASSED',containerId,networkId]);
 assert.equal(result.schema?.progress.length,130);
 assert.deepEqual(h.calls,['PREFLIGHT','CLAIM','RUNTIME','START',...h.data.sql.flatMap(row=>['SQL:'+row.id,'LEDGER:'+row.id]),'VERIFY_LEDGER','SECURE','NETWORK','CHILD','CLEANUP','RECORD']);
});
test('IX01 0076 명시 거절·0078 설치 불명·원장 불명은 후속 SQL·자식·정리를 시작하지 않는다',async()=>{
 for(const mode of ['DDL','SQL','LEDGER'] as const){
  const h=harness(),{install,appendLedger}=h.ports.schema,index=mode==='DDL'?106:108;
  const target=h.data.sql[index]!.id;
  h.ports.schema.install=async(raw,row)=>{
   await install(raw,row);
   return row.id!==target||mode==='LEDGER'?'SETTLED':mode==='DDL'?'DDL_REJECTED':'UNKNOWN';
  };
  h.ports.schema.appendLedger=async row=>{await appendLedger(row);return row.id===target&&mode==='LEDGER'?'UNKNOWN':'SETTLED';};
  const result=await runCurrentJourney(input(),h.ports);
  assert.equal(result.status,'UNKNOWN');
  assert.equal(result.code,mode==='DDL'?'DDL_REJECTED':mode==='SQL'?'INSTALL_UNKNOWN':'LEDGER_APPEND_UNKNOWN');
  assert.deepEqual(h.calls,['PREFLIGHT','CLAIM','RUNTIME','START',...h.data.sql.slice(0,index).flatMap(row=>['SQL:'+row.id,'LEDGER:'+row.id]),'SQL:'+target,...(mode==='LEDGER'?['LEDGER:'+target]:[]),'RECORD']);
 }
});
test('IX01 권한 철회·만료 후 원장과 후속 동작을 시작하지 않는다',async()=>{
 for(const key of ['drop','expire'] as const){
  const h=harness(),install=h.ports.schema.install;
  h.ports.schema.install=async(raw,row)=>{await install(raw,row);h[key]();return 'SETTLED';};
  const result=await runCurrentJourney(input(),h.ports);
  assert.equal(result.code,'INSTALL_UNKNOWN');
  assert.deepEqual(h.calls,['PREFLIGHT','CLAIM','RUNTIME','START','SQL:'+h.data.sql[0]!.id,'RECORD']);
 }
});
test('IX01 다른 컨테이너·재봉인된 다른 인계·불명 자식 결과는 정리를 열지 않는다',async()=>{
 const bad=harness(),connect=bad.ports.connect;
 bad.ports.connect=async id=>({...await connect(id),containerId:'f'.repeat(64)});
 const stopped=await runCurrentJourney(input(),bad.ports);
 assert.equal(stopped.stage,'NETWORK');assert.deepEqual(bad.calls.slice(-2),['NETWORK','RECORD']);
 for(const mutate of [v=>({...v,signal:'SIGTERM'}),v=>({...v,result:{...v.result,handoffHash:'9'.repeat(64)}}),v=>({...v,stdout:v.stdout.replace('ok 1 -','ok 1')})] as ((v:ReturnType<typeof outcome>)=>unknown)[]){
  const h=harness();
  h.ports.child=async handoff=>{
   const raw=canonicalJson({...handoff,sourceHead:'2'.repeat(40)});
   assert.throws(()=>verifyCurrentHandoff(raw,contentHash(raw),readCurrentAuthorization(input(),now),h.data.historical,now),{message:'IX01_CURRENT_HANDOFF_INVALID'});
   h.calls.push('CHILD');return mutate(outcome(contentHash(canonicalJson(handoff))));
  };
  assert.equal((await runCurrentJourney(input(),h.ports)).stage,'CHILD');
  assert.deepEqual(h.calls.slice(-2),['CHILD','RECORD']);
 }
});
test('IX01 정본 R9 블록의 stdin 진입을 제거한 소스만 로드하고 변조 바이트를 거절한다',async()=>{
 const raw=git(['cat-file','blob','HEAD:'+currentProfile.legacy]);
 const code=currentLegacyModuleSource(raw,currentProfile.legacyHash);
 assert.doesNotMatch(code,/if\(process\.argv\[1\]===['"]-['"]\)main/);
 const module=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 assert.equal(typeof module.verifyRoleMetadata,'function');
 assert.equal(process.exitCode??0,0);
 const changed=Buffer.from(raw);changed[0]=changed[0]!^1;
 assert.throws(()=>currentLegacyModuleSource(changed,contentHash(changed)),{message:'IX01_CURRENT_LEGACY_HASH'});
 assert.equal(verifyCurrentChildOutcome(outcome('a'.repeat(64)),'a'.repeat(64)),true);
});

test('IX01 로컬 실행 기한은 TERM을 무시하는 직접 자식만 강제 종료한다',async()=>{
 const {currentLocalTimeoutOptions}=await import('../../../scripts/qa-ix01-current-journey.ts');
 assert.equal(typeof currentLocalTimeoutOptions,'function','세 동기 실행 경로에서 공통 로컬 자식 종료 옵션을 사용해야 한다');
 for(const invalid of [0,-1,Infinity,0.5])assert.throws(()=>currentLocalTimeoutOptions(invalid),{message:'IX01_CURRENT_DEADLINE'});
 const timeout=3000,options=currentLocalTimeoutOptions(timeout);
 assert.deepEqual(options,{timeout,killSignal:'SIGKILL'});
 const child=spawnSync(process.execPath,['-e',"process.on('SIGTERM',()=>{});process.stdout.write('READY\\n');setInterval(()=>{},1000);"],{
  ...options,encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true,maxBuffer:1024,
 });
 assert.equal((child.error as NodeJS.ErrnoException|undefined)?.code,'ETIMEDOUT');
 assert.equal(child.stdout,'READY\n');
 assert.equal(child.status,null);
 assert.equal(child.signal,'SIGKILL');
});


test('IX01 현재 자식 결과의 옛 113 원장은 130 부모와 결박되지 않는다',()=>{
 const value=outcome('a'.repeat(64));
 assert.equal(verifyCurrentChildOutcome(value,'a'.repeat(64)),true);
 for(const ledgerCount of [112,113,129,131])assert.equal(verifyCurrentChildOutcome({...value,result:{...value.result,ledgerCount}},'a'.repeat(64)),false);
});


test('IX01 역사 0082 실패·불명 뒤 네트워크·자식·정리 및 원장 조회를 호출하지 않는다',async()=>{
 for(const state of ['DDL_REJECTED','UNKNOWN'] as const){
  const h=harness(),install=h.ports.schema.install,target=h.data.sql[112]!;
  h.ports.schema.install=async(raw,row)=>{
   if(row.id!==target.id)return install(raw,row);
   assert.deepEqual(Buffer.from(raw),target.bytes);h.calls.push('SQL:'+row.id);return state;
  };
  const result=await runCurrentJourney(input(),h.ports);
  assert.equal(result.status,'UNKNOWN');
  assert.equal(result.code,state==='DDL_REJECTED'?'DDL_REJECTED':'INSTALL_UNKNOWN');
  assert.deepEqual(h.calls,['PREFLIGHT','CLAIM','RUNTIME','START',...h.data.sql.slice(0,112).flatMap(row=>['SQL:'+row.id,'LEDGER:'+row.id]),'SQL:'+target.id,'RECORD']);
 }
});

const workerPath='db/migrations/0095_native_worker_deployment.sql.pending';
const roleSystem=['pg_database_owner','pg_read_all_data','pg_write_all_data','pg_monitor','pg_read_all_settings','pg_read_all_stats','pg_stat_scan_tables','pg_read_server_files','pg_write_server_files','pg_execute_server_program','pg_signal_backend','pg_checkpoint'];
function roleFixture(phase:string,workers=true){
 const readerNames=['anvil_v3_fn16_export_reader_owner','anvil_v3_fn15_reader_owner'],provider='anvil_v3_provider_claim_writer';
 const extra=phase==='PRISTINE'?[]:['anvil_v3_migrator','anvil_v3_app',provider,...(phase==='INSTALLER'?[]:readerNames),...(workers?['worker_owner','worker_publisher']:[])];
 const roles=[...roleSystem,'anvil_v3_bootstrap',...extra].map(name=>{
  const boot=name==='anvil_v3_bootstrap',installer=name==='anvil_v3_migrator',restricted=readerNames.includes(name)||name===provider||name.startsWith('worker_');
  return{name,superuser:boot,inherit:!restricted,createRole:boot||installer&&phase!=='REVOKED',createDb:boot,replication:boot,bypassRls:boot,login:boot||installer||name==='anvil_v3_app',validUntil:null};
 });
 const memberships=[...['pg_read_all_settings','pg_read_all_stats','pg_stat_scan_tables'].map(role=>({role,member:'pg_monitor',grantor:'anvil_v3_bootstrap',adminOption:false})),
 ...(phase==='SETTLED'?[...readerNames,...(workers?['worker_owner']:[])].map(role=>({role,member:'anvil_v3_migrator',grantor:'anvil_v3_migrator',adminOption:true})):[]),
 ...(phase==='INSTALLER'?[{role:provider,member:'anvil_v3_migrator',grantor:'anvil_v3_bootstrap',adminOption:true}]:[])];
 return{sessionUser:'anvil_v3_bootstrap',currentUser:'anvil_v3_bootstrap',roles,memberships};
}
async function roleHarness(){
 const raw=git(['cat-file','blob','HEAD:'+currentProfile.legacy]);
 const legacy=await import('data:text/javascript;base64,'+Buffer.from(currentLegacyModuleSource(raw,currentProfile.legacyHash)).toString('base64'));
 const current=await import('../../../scripts/qa-ix01-current-journey.ts');
 const selected=schema().sql.map(row=>row.path);
 return {legacy,current,selected};
}
test('IX01 0095 역할은 원R9에서 거절되며 current 검산만 정확 두 역할과 단일 ADMIN 회수를 인정한다',async()=>{
 const {legacy,current,selected}=await roleHarness(),raw=JSON.stringify(roleFixture('SETTLED'));
 assert.throws(()=>legacy.verifyRoleMetadata(raw,'SETTLED',selected,selected,selected),/ROLE_METADATA/);
 const verify=current.verifyCurrentRoleMetadata;
 assert.equal(typeof verify,'function');
 const before=verify(legacy,raw,'SETTLED',selected,selected,selected);
 assert.deepEqual(before.memberships.map((v:{role:string})=>v.role).sort(),['anvil_v3_fn15_reader_owner','anvil_v3_fn16_export_reader_owner','worker_owner']);
});

test('IX01 0095 정상 SETTLED/REVOKED와 원 R9 상태·회수 계약을 함께 검산한다',async()=>{
 const {legacy,current,selected}=await roleHarness();
 const before=current.verifyCurrentRoleMetadata(legacy,JSON.stringify(roleFixture('SETTLED')),'SETTLED',selected,selected,selected);
 const sql=current.currentRevokeSql(legacy,before.memberships.map(v=>v.role),selected);
 assert.equal(sql,'BEGIN;ALTER ROLE anvil_v3_migrator NOCREATEROLE;REVOKE anvil_v3_fn15_reader_owner FROM anvil_v3_migrator;REVOKE anvil_v3_fn16_export_reader_owner FROM anvil_v3_migrator;REVOKE worker_owner FROM anvil_v3_migrator;COMMIT;');
 const after=current.verifyCurrentRoleMetadata(legacy,JSON.stringify(roleFixture('REVOKED')),'REVOKED',selected,selected,selected);
 assert.deepEqual(after.memberships,[]);assert.equal(after.systemHash,before.systemHash);
 for(const phase of ['PRISTINE','INSTALLER']){
  const value=roleFixture(phase,false),raw=JSON.stringify(value);
  assert.deepEqual(current.verifyCurrentRoleMetadata(legacy,raw,phase,[],[],selected).memberships,legacy.verifyRoleMetadata(raw,phase,[],[],selected).memberships);
 }
 const oldSelected=selected.filter(p=>p!==workerPath),old=JSON.stringify(roleFixture('SETTLED',false));
 const oldBefore=current.verifyCurrentRoleMetadata(legacy,old,'SETTLED',oldSelected,oldSelected,oldSelected);
 assert.equal(current.currentRevokeSql(legacy,oldBefore.memberships.map(v=>v.role),oldSelected),legacy.revokeSql(oldBefore.memberships.map(v=>v.role),oldSelected));
});
test('IX01 0095 exact 이름·속성·grantor·단일 ADMIN·회수후 부재 외에는 승인하지 않는다',async()=>{
 const {legacy,current,selected}=await roleHarness();
 const verify=(v:ReturnType<typeof roleFixture>,phase='SETTLED',attempted=selected,completed=selected,chosen=selected)=>current.verifyCurrentRoleMetadata(legacy,JSON.stringify(v),phase,attempted,completed,chosen);
 const mutations:((v:ReturnType<typeof roleFixture>)=>void)[]=[
  v=>{v.roles.find(r=>r.name==='worker_owner')!.name='worker_owner_other';},
  v=>{v.roles=v.roles.filter(r=>r.name!=='worker_publisher');},
  v=>{v.roles.push({...v.roles.find(r=>r.name==='worker_owner')!});},
  v=>{v.roles.push({...v.roles[0]!,name:'unapproved'});},
  v=>{v.memberships=v.memberships.filter(r=>r.role!=='worker_owner');},
  v=>{v.memberships.push({...v.memberships.find(r=>r.role==='worker_owner')!});},
  v=>{v.memberships.find(r=>r.role==='worker_owner')!.grantor='anvil_v3_bootstrap';},
  v=>{v.memberships.find(r=>r.role==='worker_owner')!.member='anvil_v3_app';},
  v=>{v.memberships.find(r=>r.role==='worker_owner')!.adminOption=false;},
  v=>{v.memberships.push({role:'worker_publisher',member:'anvil_v3_migrator',grantor:'anvil_v3_migrator',adminOption:true});},
  v=>{v.memberships.push({role:'anvil_v3_app',member:'worker_owner',grantor:'anvil_v3_bootstrap',adminOption:false});},
  v=>{v.memberships[0]!.adminOption=true;},
 ];
 for(const mutate of mutations){const v=roleFixture('SETTLED');mutate(v);assert.throws(()=>verify(v),/ROLE_METADATA/);}
 for(const name of ['worker_owner','worker_publisher'])for(const key of ['superuser','inherit','createRole','createDb','replication','bypassRls','login'] as const){
  const v=roleFixture('SETTLED');v.roles.find(r=>r.name===name)![key]=true;assert.throws(()=>verify(v),/ROLE_METADATA/);
 }
 const expiry=JSON.parse(JSON.stringify(roleFixture('SETTLED')));expiry.roles.find((r:{name:string})=>r.name==='worker_owner').validUntil='2099-01-01';assert.throws(()=>verify(expiry),/ROLE_METADATA/);
 for(const phase of ['PRISTINE','INSTALLER'])assert.throws(()=>verify(roleFixture('SETTLED'),phase,[],[]),/ROLE_METADATA/);
 const revoked=roleFixture('REVOKED');revoked.memberships.push({role:'worker_owner',member:'anvil_v3_migrator',grantor:'anvil_v3_migrator',adminOption:true});assert.throws(()=>verify(revoked,'REVOKED'),/ROLE_METADATA/);
 const without=selected.filter(p=>p!==workerPath);
 assert.throws(()=>verify(roleFixture('SETTLED'),'SETTLED',without,selected),/ROLE_METADATA/);
 assert.throws(()=>verify(roleFixture('SETTLED'),'SETTLED',selected,without),/ROLE_METADATA/);
 assert.throws(()=>verify(roleFixture('SETTLED'),'SETTLED',selected,selected,without),/ROLE_METADATA/);
 assert.throws(()=>verify(roleFixture('SETTLED'),'SETTLED',selected,selected,[...selected,workerPath]),/ROLE_METADATA/);
 for(const readers of [[],['worker_owner','worker_owner'],['worker_publisher'],['worker_owner','unapproved']])assert.throws(()=>current.currentRevokeSql(legacy,readers,selected),/ROLE_METADATA/);
 assert.throws(()=>current.currentRevokeSql(legacy,['worker_owner'],without),/ROLE_METADATA/);
});
test('IX01 0095·0099 실패/불명은 보안·망·자식·정리 없이 원부분이력을 남긴다',async()=>{
 for(const index of [125,129])for(const mode of ['DDL_REJECTED','UNKNOWN','LEDGER'] as const){
  const h=harness(),target=h.data.sql[index]!,{install,appendLedger}=h.ports.schema;
  assert.equal(target.id,index===125?'0095_native_worker_deployment':'0099_document_stage_output_item');
  h.ports.schema.install=async(raw,row)=>{if(row.id!==target.id||mode==='LEDGER')return install(raw,row);assert.deepEqual(Buffer.from(raw),target.bytes);h.calls.push('SQL:'+row.id);return mode;};
  h.ports.schema.appendLedger=async row=>{if(row.id!==target.id)return appendLedger(row);h.calls.push('LEDGER:'+row.id);return 'UNKNOWN';};
  const result=await runCurrentJourney(input(),h.ports);assert.equal(result.status,'UNKNOWN');
  assert.equal(result.code,mode==='DDL_REJECTED'?'DDL_REJECTED':mode==='UNKNOWN'?'INSTALL_UNKNOWN':'LEDGER_APPEND_UNKNOWN');
  assert.deepEqual(h.calls,['PREFLIGHT','CLAIM','RUNTIME','START',...h.data.sql.slice(0,index).flatMap(row=>['SQL:'+row.id,'LEDGER:'+row.id]),'SQL:'+target.id,...(mode==='LEDGER'?['LEDGER:'+target.id]:[]),'RECORD']);
 }
});

test('IX01 0095 검산/회수 불명은 실제 current 제어선에서도 네트워크·자식·정리를 열지 않는다',async()=>{
 const {legacy,current,selected}=await roleHarness();
 for(const mode of ['INVALID_ROLE','REVOKE_UNKNOWN','REVOKED_MEMBERSHIP']){
  const h=harness();
  h.ports.secure=async()=>{
   h.calls.push('SECURE');const value=roleFixture('SETTLED');
   if(mode==='INVALID_ROLE')value.roles.find(r=>r.name==='worker_publisher')!.login=true;
   const verified=current.verifyCurrentRoleMetadata(legacy,JSON.stringify(value),'SETTLED',selected,selected,selected);
   const revoke=current.currentRevokeSql(legacy,verified.memberships.map(row=>row.role),selected);
   assert(revoke.includes('REVOKE worker_owner FROM anvil_v3_migrator;'));h.calls.push('REVOKE_MODEL');
   if(mode==='REVOKE_UNKNOWN')throw Error('UNKNOWN');
   const after=roleFixture('REVOKED');after.memberships.push({role:'worker_owner',member:'anvil_v3_migrator',grantor:'anvil_v3_migrator',adminOption:true});
   current.verifyCurrentRoleMetadata(legacy,JSON.stringify(after),'REVOKED',selected,selected,selected);
  };
  const result=await runCurrentJourney(input(),h.ports);
  assert.equal(result.status,'UNKNOWN');assert.equal(result.code,'STOPPED_SECURE');
  assert.deepEqual(h.calls.slice(-(mode==='INVALID_ROLE'?2:3)),mode==='INVALID_ROLE'?['SECURE','RECORD']:['SECURE','REVOKE_MODEL','RECORD']);
  assert(!h.calls.some(c=>['NETWORK','CHILD','CLEANUP'].includes(c)));
 }
});
