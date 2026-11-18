import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readCurrentSchemaManifest} from '../../integration/IX01/current-schema-baseline.ts';
import {currentLegacyModuleSource,currentProfile,currentRequiredSources,readCurrentAuthorization,runCurrentJourney,verifyCurrentChildOutcome,verifyCurrentHandoff,type CurrentInput,type CurrentPlan,type CurrentPorts} from '../../../scripts/qa-ix01-current-journey.ts';

const cwd=fileURLToPath(new URL('../../../',import.meta.url));
const git=(args:string[],input?:string)=>execFileSync('git',args,{cwd,input,windowsHide:true,maxBuffer:16*1024*1024});
const now=1_790_000_000_000,containerId='a'.repeat(64),networkId='b'.repeat(64);
test('IX01 자식 Node 환경 RAM: worker 1만 허용하고 다른 환경은 거절한다',async()=>{
 const api=await import('../../../scripts/qa-ix01-current-journey.ts');
 const check=api.verifyCurrentChildEnvironment;
 assert.equal(typeof check,'function');
 const env={PATH:'/opt/node-v24.22.1-linux-x64/bin:/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',HOME:currentProfile.receipt,
  GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_SYSTEM:'/dev/null',GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_COUNT:'0',GIT_OPTIONAL_LOCKS:'0',GIT_NO_REPLACE_OBJECTS:'1',GIT_NO_LAZY_FETCH:'1',GIT_TERMINAL_PROMPT:'0',GIT_ATTR_NOSYSTEM:'1',GIT_PAGER:'cat',
  ANVIL_IX01_CURRENT_CHILD:'AUTHORIZED_PARENT',ANVIL_IX01_CURRENT_PLAN_SHA256:'a'.repeat(64),ANVIL_IX01_CURRENT_APPROVAL_SHA256:'b'.repeat(64),ANVIL_IX01_CURRENT_HANDOFF_SHA256:'c'.repeat(64),ANVIL_IX01_CURRENT_APP_PASSWORD:'d'.repeat(64),ANVIL_IX01_CURRENT_MIGRATOR_PASSWORD:'e'.repeat(64)};
 assert.doesNotThrow(()=>check(env));
 assert.doesNotThrow(()=>check({...env,NODE_TEST_WORKER_ID:'1'}));
 for(const worker of ['', '0','2','01','1 ',undefined])assert.throws(()=>check({...env,NODE_TEST_WORKER_ID:worker}),{message:'IX01_CURRENT_CHILD_ENV'});
 for(const other of [{NODE_TEST_CONTEXT:'child-v8'},{NODE_OPTIONS:'--inspect'},{EXTRA:'1'},{HOME:'/other'},{ANVIL_IX01_CURRENT_CHILD:'OTHER'}])
  assert.throws(()=>check({...env,NODE_TEST_WORKER_ID:'1',...other}),{message:'IX01_CURRENT_CHILD_ENV'});
});
test('IX01 생성 none RAM: 명시적인 미할당 endpoint만 생성 단계에서 허용한다',async()=>{
 const {currentCreatedUnallocatedNone}=await import('../../../scripts/qa-ix01-current-journey.ts');
 assert.equal(typeof currentCreatedUnallocatedNone,'function');
 // Moby v28.5.2 EndpointSettings{}의 JSON: 생략되지 않는 영값이다.
 const endpoint={IPAMConfig:null,Links:null,Aliases:null,MacAddress:'',DriverOpts:null,GwPriority:0,
  NetworkID:'',EndpointID:'',Gateway:'',IPAddress:'',IPPrefixLen:0,IPv6Gateway:'',GlobalIPv6Address:'',GlobalIPv6PrefixLen:0,DNSNames:null};
 const created={running:false,host:{NetworkMode:'none'},networks:{none:endpoint}};
 assert.equal(currentCreatedUnallocatedNone(created),true);
 for(const field of ['NetworkID','EndpointID','Gateway','IPAddress','IPv6Gateway','GlobalIPv6Address','MacAddress'])
  assert.equal(currentCreatedUnallocatedNone({...created,networks:{none:{...endpoint,[field]:'allocated'}}}),false,field);
 for(const field of ['IPPrefixLen','GlobalIPv6PrefixLen','GwPriority'])
  assert.equal(currentCreatedUnallocatedNone({...created,networks:{none:{...endpoint,[field]:1}}}),false,field);
 for(const field of ['IPAMConfig','Links','Aliases','DriverOpts','DNSNames'])
  assert.equal(currentCreatedUnallocatedNone({...created,networks:{none:{...endpoint,[field]:{configured:true}}}}),false,field);
 for(const networks of [null,{}, {none:{}},{none:null},{bridge:endpoint},{none:endpoint,bridge:endpoint},
  {none:{...endpoint,extra:true}},{none:{...endpoint,NetworkID:undefined}}])
  assert.equal(currentCreatedUnallocatedNone({...created,networks}),false);
 assert.equal(currentCreatedUnallocatedNone({...created,running:true}),false);
 assert.equal(currentCreatedUnallocatedNone({...created,running:undefined}),false);
 assert.equal(currentCreatedUnallocatedNone({...created,host:{NetworkMode:'bridge'}}),false);
 assert.equal(currentCreatedUnallocatedNone({...created,host:null}),false);
});
test('IX01 HostConfig Mounts RAM: 생략된 빈 선언만 호환하고 mount 선언을 거절한다',async()=>{
 const {currentHostMountsEmpty}=await import('../../../scripts/qa-ix01-current-journey.ts');
 assert.equal(typeof currentHostMountsEmpty,'function');
 assert.equal(currentHostMountsEmpty({NetworkMode:'none',Binds:null,VolumesFrom:null,Tmpfs:{'/tmp':'rw,noexec,nosuid,size=16777216,uid=999,gid=999'}}),true);
 for(const Mounts of [null,[],{}])assert.equal(currentHostMountsEmpty({Mounts}),true);
 for(const Mounts of [undefined,[{Type:'bind',Source:'/foreign',Target:'/data'}],[{Type:'volume',Source:'foreign',Target:'/data'}],
  [{Type:'tmpfs',Target:'/extra'}],{Type:'bind'},'',false,0])assert.equal(currentHostMountsEmpty({Mounts}),false);
});
test('IX01 START 고정 진단 RAM: 단계 실패와 불명은 설치 정리 없이 기록된다',async()=>{
 const api=await import('../../../scripts/qa-ix01-current-journey.ts');
 assert.equal(typeof api.runCurrentStartSteps,'function');
 const names=['IMAGE_COLLISION','CREATE','CREATE_INSPECT','START','START_INSPECT','READINESS','BOOTSTRAP_ROLES'] as const;
 for(const failed of names){
  const h=harness(),candidate=input(),calls:string[]=[],records:unknown[]=[];
  const step=(name:typeof names[number])=>{calls.push(name);if(name===failed)throw Object.assign(Error('private/path/argv'),{stdout:'secret',stderr:'secret'});};
  h.ports.start=async()=>{h.calls.push('START');await api.runCurrentStartSteps({
   IMAGE_COLLISION:()=>step('IMAGE_COLLISION'),CREATE:()=>step('CREATE'),CREATE_INSPECT:()=>step('CREATE_INSPECT'),
   START:()=>step('START'),START_INSPECT:()=>step('START_INSPECT'),READINESS:async()=>step('READINESS'),BOOTSTRAP_ROLES:()=>step('BOOTSTRAP_ROLES'),
  });return containerId;};
  h.ports.record=async result=>{h.calls.push('RECORD');records.push(result);};
  const result=await runCurrentJourney(candidate,h.ports);
  assert.deepEqual(result,{status:'UNKNOWN',stage:'START',code:'STOPPED_START_'+failed,planHash:candidate.planHash,
   containerId:null,networkId:null,schema:null,evidence:'RETAINED_WHEN_CREATED'});
  assert.deepEqual(calls,names.slice(0,names.indexOf(failed)+1));
  assert.deepEqual(h.calls,['PREFLIGHT','CLAIM','RUNTIME','START','RECORD']);assert.deepEqual(records,[result]);
 }
 const calls:string[]=[];
 await api.runCurrentStartSteps({IMAGE_COLLISION:()=>{calls.push('IMAGE_COLLISION');},CREATE:()=>{calls.push('CREATE');},
  CREATE_INSPECT:()=>{calls.push('CREATE_INSPECT');},START:()=>{calls.push('START');},START_INSPECT:()=>{calls.push('START_INSPECT');},
  READINESS:async()=>{await Promise.resolve();calls.push('READINESS');},BOOTSTRAP_ROLES:()=>{calls.push('BOOTSTRAP_ROLES');}});
 assert.deepEqual(calls,names);
 let reads=0;
 for(const error of [Error('STOPPED_START_CREATE'),new Proxy({},{get(){reads++;throw Error('secret');}})]){
  const h=harness();h.ports.start=async()=>{h.calls.push('START');throw error;};
  const result=await runCurrentJourney(input(),h.ports);
  assert.equal(result.code,'STOPPED_START');assert.equal(result.status,'UNKNOWN');assert.equal(result.stage,'START');
  assert.deepEqual(h.calls,['PREFLIGHT','CLAIM','RUNTIME','START','RECORD']);
 }
 assert.equal(reads,0);
});
test('IX01 A11 고정 프로필 RAM: 정확 이름과 구 프로필 외피 인계를 분리한다',()=>{
 assert.deepEqual({source:currentProfile.source,receipt:currentProfile.receipt,artifact:currentProfile.artifact,
  container:currentProfile.container,network:currentProfile.network,database:currentProfile.database,owner:currentProfile.owner},{
  source:'/home/daon/anvil-ix01-current-tc01-20261108-a11-qa',
  receipt:'/home/daon/.local/share/anvil-v3-qa-receipts/ix01-current-tc01-20261108-a11',
  artifact:'/tmp/anvil-v3-ix01-current-tc01-20261108-a11',
  container:'anvil-ix01-current-tc01-pg-20261108-a11',network:'anvil-ix01-current-tc01-net-20261108-a11',
  database:'anvil_v3_ix01_current_tc01_20261108_a11',owner:'IX01_CURRENT_TC01_20261108_A11',
 });
 assert.equal(Object.isFrozen(currentProfile),true);
 const candidate=input(),auth=readCurrentAuthorization(candidate,now);
 assert.equal(auth.plan.profile,'IX01_CURRENT_TC01_20261108_A11');
 for(const profile of ['IX01_CURRENT_TC01_20261108_A1','IX01_CURRENT_TC01_20261108_A2','IX01_CURRENT_TC01_20261108_A3','IX01_CURRENT_TC01_20261108_A4','IX01_CURRENT_TC01_20261108_A5','IX01_CURRENT_TC01_20261108_A6','IX01_CURRENT_TC01_20261108_A7','IX01_CURRENT_TC01_20261108_A8','IX01_CURRENT_TC01_20261108_A9','IX01_CURRENT_TC01_20261108_A10']){
  const planRaw=canonicalJson({...JSON.parse(candidate.planRaw),profile}),planHash=contentHash(planRaw);
  const approvalRaw=canonicalJson({...JSON.parse(candidate.approvalRaw),profile,planHash});
  assert.throws(()=>readCurrentAuthorization({planRaw,planHash,approvalRaw,approvalHash:contentHash(approvalRaw)},now),{message:'IX01_CURRENT_PLAN_INVALID'});
  const mixedApproval=canonicalJson({...JSON.parse(candidate.approvalRaw),profile});
  assert.throws(()=>readCurrentAuthorization({...candidate,approvalRaw:mixedApproval,approvalHash:contentHash(mixedApproval)},now),{message:'IX01_CURRENT_APPROVAL_REQUIRED'});
  const handoff=canonicalJson({schemaVersion:1,purpose:'IX01_CURRENT_TC01_CHILD',profile,planHash:auth.planHash,
   approvalHash:auth.approvalHash,sourceHead:auth.plan.sourceHead,expiresAt:now+1000,ledgerHash:'a'.repeat(64),containerId,networkId,host:'172.18.0.2'});
  // profile 불일치에서 원장 입력을 읽기 전에 거절하며 원격 A1/A2/A3/A4/A5/A6/A7/A8/A9/A10 자료는 조회하지 않는다.
  assert.throws(()=>verifyCurrentHandoff(handoff,contentHash(handoff),auth,new Uint8Array(),now),{message:'IX01_CURRENT_HANDOFF_INVALID'});
 }
});
test('IX01 npm umask RAM: 동기 호출만 강화하고 원 mask를 복원한다',async()=>{
 const {withCurrentNpmUmask}=await import('../../../scripts/qa-ix01-current-journey.ts');
 assert.equal(typeof withCurrentNpmUmask,'function');
 for(const original of [0o002,0o022,0o077,0o277,0o777])for(const throws of [false,true]){
  let mask=original,calls=0;
  const events:string[]=[];
  const access=(value?:number)=>{const old=mask;if(value===undefined)events.push('READ');else{events.push('SET:'+value);mask=value;}return old;};
  const error=Error('opaque');
  const work=()=>{calls++;events.push('WORK');assert.equal(mask,original|0o077);if(throws)throw error;return 'result';};
  if(throws)assert.throws(()=>withCurrentNpmUmask(work,access),caught=>caught===error);
  else assert.equal(withCurrentNpmUmask(work,access),'result');
  assert.equal(mask,original);assert.equal(calls,1);
  assert.deepEqual(events,['READ','SET:'+(original|0o077),'WORK','SET:'+original]);
 }
 for(const phase of ['SET','RESTORE'] as const){
  let writes=0,work=0;
  const error=Error('mask unavailable');
  assert.throws(()=>withCurrentNpmUmask(()=>{work++;return 'result';},value=>{
   if(value===undefined)return 0o022;
   writes++;if(writes===(phase==='SET'?1:2))throw error;return 0o022;
  }),caught=>caught===error);
  assert.equal(writes,2);assert.equal(work,phase==='SET'?0:1);
 }
 for(const invalid of [-1,0o1000,NaN,0.5]){
  let reads=0,work=0;
  assert.throws(()=>withCurrentNpmUmask(()=>{work++;return 'result';},()=>{reads++;return invalid;}),{message:'IX01_CURRENT_NPM_UMASK'});
  assert.equal(reads,1);assert.equal(work,0);
 }
 let calls=0;
 const readError=Error('read unavailable');
 assert.throws(()=>withCurrentNpmUmask(()=>{calls++;return 'result';},()=>{throw readError;}),caught=>caught===readError);
 assert.equal(calls,0);
});
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
test('IX01 runtime controller 연결 RAM: 고정 실패는 UNKNOWN 기록만 남긴다',async()=>{
 const {runCurrentRuntimeSteps}=await import('../../../scripts/qa-ix01-current-journey.ts');
 const names=['DIRECTORIES','CONFIG','TOOLS','LOCK','VERSION','PREINSTALL','INSTALL','POSTINSTALL'] as const;
 for(const failed of names){
  const h=harness(),candidate=input(),steps:string[]=[],records:unknown[]=[];
  h.ports.prepareRuntime=async()=>{
   h.calls.push('RUNTIME');
   runCurrentRuntimeSteps(Object.fromEntries(names.map(name=>[name,()=>{
    steps.push(name);
    if(name===failed)throw Object.assign(Error('secret/path/argv'),{stdout:'secret',stderr:'secret'});
   }])) as Record<typeof names[number],()=>void>);
  };
  h.ports.record=async result=>{h.calls.push('RECORD');records.push(result);};
  const result=await runCurrentJourney(candidate,h.ports);
  assert.deepEqual(result,{status:'UNKNOWN',stage:'RUNTIME',code:'STOPPED_RUNTIME_'+failed,
   planHash:candidate.planHash,containerId:null,networkId:null,schema:null,evidence:'RETAINED_WHEN_CREATED'});
  assert.deepEqual(steps,names.slice(0,names.indexOf(failed)+1));
  assert.deepEqual(h.calls,['PREFLIGHT','CLAIM','RUNTIME','RECORD']);
  assert.deepEqual(records,[result]);
  assert.strictEqual(records[0],result);
 }
});

test('IX01 CHILD 고정 진단 RAM: 실패 단계만 남기고 원 예외와 정리를 차단한다',async()=>{
 const api=await import('../../../scripts/qa-ix01-current-journey.ts');
 const run=api.runCurrentChildSteps;
 assert.equal(typeof run,'function');
 const names=['ATTACHED_HOST','CURRENT','ARTIFACT','HANDOFF','OWNER','SOURCES','SPAWN','CURRENT_AFTER_SPAWN','EXIT','RESULT_READ'] as const;
 const steps=(work:(name:typeof names[number])=>unknown)=>({
  ATTACHED_HOST:()=>work('ATTACHED_HOST'),CURRENT:()=>work('CURRENT'),ARTIFACT:()=>work('ARTIFACT'),HANDOFF:()=>work('HANDOFF'),OWNER:()=>work('OWNER'),
  SOURCES:()=>work('SOURCES'),SPAWN:()=>work('SPAWN'),CURRENT_AFTER_SPAWN:()=>work('CURRENT_AFTER_SPAWN'),EXIT:()=>work('EXIT'),RESULT_READ:()=>work('RESULT_READ'),
 });
 let secretReads=0;
 for(const failed of names){
  const h=harness(),calls:string[]=[],records:unknown[]=[];
  h.ports.child=async()=>run(steps(name=>{calls.push(name);if(name===failed)throw new Proxy({},{get(){secretReads++;throw Error('secret/path/argv/stdout/stderr');}});return null;}));
  h.ports.record=async value=>{h.calls.push('RECORD');records.push(value);};
  const result=await runCurrentJourney(input(),h.ports);
  assert.equal(result.status,'UNKNOWN');assert.equal(result.stage,'CHILD');assert.equal(result.code,'STOPPED_CHILD_'+failed);
  assert.deepEqual(calls,names.slice(0,names.indexOf(failed)+1));assert.equal(records.length,1);assert.equal(h.calls.includes('CLEANUP'),false);
  assert.doesNotMatch(JSON.stringify(result),/secret|argv|stdout|stderr|stack/);
 }
 assert.equal(secretReads,0);
 const calls:string[]=[],value={ok:true};assert.equal(run(steps(name=>{calls.push(name);return value;})),value);assert.deepEqual(calls,names);
 for(const failure of [Error('STOPPED_CHILD_SPAWN'),{code:'STOPPED_CHILD_SPAWN'}]){
  const h=harness();h.ports.child=async()=>{throw failure;};const result=await runCurrentJourney(input(),h.ports);
  assert.equal(result.code,'STOPPED_CHILD');assert.equal(result.status,'UNKNOWN');assert.equal(h.calls.includes('CLEANUP'),false);
 }
});
test('IX01 CHILD EXIT 분류 RAM: 고정 종료 종류만 보존하고 후속 읽기와 정리를 막는다',async()=>{
 const api=await import('../../../scripts/qa-ix01-current-journey.ts');
 const check=api.verifyCurrentChildExit;
 assert.equal(typeof check,'function');
 let rawReads=0;const rawError=new Proxy(Error('secret'),{get(){rawReads++;throw Error('secret');}});
 const cases=[
  {value:{error:rawError,status:1,signal:'SIGTERM' as const},at:now,code:'SPAWN_ERROR',clock:0},
  {value:{status:1,signal:null},at:now,code:'STATUS',clock:0},
  {value:{status:null,signal:null},at:now,code:'STATUS',clock:0},
  {value:{status:null,signal:'SIGTERM' as const},at:now,code:'SIGNAL',clock:0},
  {value:{status:0,signal:'SIGTERM' as const},at:now,code:'SIGNAL',clock:0},
  {value:{status:0,signal:null},at:now+1,code:'DEADLINE',clock:1},
 ];
 for(const c of cases){
  const h=harness();let reads=0,clock=0;
  h.ports.child=async()=>api.runCurrentChildSteps({
   ATTACHED_HOST(){},CURRENT(){},ARTIFACT(){},HANDOFF(){},OWNER(){},SOURCES(){},SPAWN(){},CURRENT_AFTER_SPAWN(){},
   EXIT(){check(c.value,()=>{clock++;return c.at;},now+1);},RESULT_READ(){reads++;return null;},
  });
  const result=await runCurrentJourney(input(),h.ports);
  assert.equal(result.code,'STOPPED_CHILD_EXIT_'+c.code);assert.equal(result.status,'UNKNOWN');assert.equal(result.stage,'CHILD');
  assert.equal(clock,c.clock);assert.equal(reads,0);assert.equal(h.calls.includes('CLEANUP'),false);assert.equal(h.calls.filter(v=>v==='RECORD').length,1);
  assert.doesNotMatch(JSON.stringify(result),/secret|SIGTERM|stdout|stderr|stack/);
 }
 assert.equal(rawReads,0);
 let clock=0;assert.doesNotThrow(()=>check({status:0,signal:null},()=>{clock++;return now;},now+1));assert.equal(clock,1);
 const h=harness();h.ports.child=async()=>api.runCurrentChildSteps({
  ATTACHED_HOST(){},CURRENT(){},ARTIFACT(){},HANDOFF(){},OWNER(){},SOURCES(){},SPAWN(){},CURRENT_AFTER_SPAWN(){},
  EXIT(){throw {code:'STOPPED_CHILD_EXIT_STATUS'};},RESULT_READ(){assert.fail('after failed exit');},
 });
 assert.equal((await runCurrentJourney(input(),h.ports)).code,'STOPPED_CHILD_EXIT');
});
test('IX01 CHILD 실패 기록 RAM: 원 인계와 고정 단계만 쓰며 기록 실패는 삼킨다',async()=>{
 const api=await import('../../../scripts/qa-ix01-current-journey.ts');
 assert.equal(typeof api.recordCurrentChildFailure,'function');
 const digest='a'.repeat(64),stages=['HANDOFF','DATABASE','LEDGER','CATALOG','LOGIN','TC01','CLOSE','RESULT'];
 for(const stage of stages){
  const calls:string[]=[],rows:string[]=[];
  api.recordCurrentChildFailure(stage,digest,{fresh(){calls.push('FRESH');},write(raw){calls.push('WRITE');rows.push(raw);}});
  assert.deepEqual(calls,['FRESH','WRITE','FRESH']);
  assert.deepEqual(JSON.parse(rows[0]!),{schemaVersion:1,purpose:'IX01_CURRENT_TC01_CHILD_FAILURE',handoffHash:digest,stage});
 }
 let traps=0,writes=0;
 for(const stage of ['SECRET',null,new Proxy({},{get(){traps++;throw Error('secret');}})])
  assert.doesNotThrow(()=>api.recordCurrentChildFailure(stage,digest,{fresh(){},write(){writes++;}}));
 assert.equal(traps,0);assert.equal(writes,0);
 assert.doesNotThrow(()=>api.recordCurrentChildFailure('DATABASE','bad',{fresh(){assert.fail();},write(){assert.fail();}}));
 for(const failed of ['BEFORE','WRITE','AFTER']){
  let fresh=0,write=0;
  assert.doesNotThrow(()=>api.recordCurrentChildFailure('DATABASE',digest,{fresh(){fresh++;if(failed==='BEFORE'||failed==='AFTER'&&fresh===2)throw Error('secret');},write(){write++;if(failed==='WRITE')throw Error('secret');}}));
  assert.equal(write,failed==='BEFORE'?0:1);
 }
 const existing=canonicalJson(outcome(digest).result);let stored:string|undefined=existing;
 const write=(raw:string)=>{if(stored!==undefined)throw Error('EXISTS');stored=raw;};
 api.recordCurrentChildFailure('RESULT',digest,{fresh(){},write});assert.equal(stored,existing);
 stored=undefined;api.recordCurrentChildFailure('DATABASE',digest,{fresh(){},write});const first=stored;
 api.recordCurrentChildFailure('LOGIN',digest,{fresh(){},write});assert.equal(stored,first);
});

test('IX01 CHILD 실패 결과 RAM: EXIT_STATUS에서만 원 인계의 고정 단계와 UNKNOWN을 보존한다',async()=>{
 const api=await import('../../../scripts/qa-ix01-current-journey.ts');
 const cases=[...['HANDOFF','DATABASE','LEDGER','CATALOG','LOGIN','TC01','CLOSE','RESULT'].map(stage=>({kind:'VALID',stage})),
  ...['ABSENT','HASH','STAGE','EXTRA','SUCCESS','JSON','OVERSIZE','EXPIRED','CURRENT','LATE','LATE_TIME','SPAWN','SIGNAL','ZERO'].map(kind=>({kind,stage:'DATABASE'}))];
 for(const c of cases){
  const h=harness();let reads=0,checks=0,resultReads=0,clock=0;
  h.ports.child=async handoff=>api.runCurrentChildSteps({
   ATTACHED_HOST(){},CURRENT(){},ARTIFACT(){},HANDOFF(){},OWNER(){},SOURCES(){},SPAWN(){},CURRENT_AFTER_SPAWN(){},
   EXIT(){
    const digest=contentHash(canonicalJson(handoff)),row={schemaVersion:1,purpose:'IX01_CURRENT_TC01_CHILD_FAILURE',handoffHash:digest,stage:c.stage};
    api.verifyCurrentChildExit({status:c.kind==='ZERO'?0:1,signal:c.kind==='SIGNAL'?'SIGTERM':null,...(c.kind==='SPAWN'?{error:Error('secret')}: {})},()=>{clock++;return c.kind==='EXPIRED'||c.kind==='LATE_TIME'&&clock===2?handoff.expiresAt:now;},handoff.expiresAt,{
     handoffHash:digest,fresh(){checks++;if(c.kind==='CURRENT'||c.kind==='LATE'&&checks===2)throw Error('secret');},
     read(){reads++;if(c.kind==='ABSENT')throw Error('secret');if(c.kind==='JSON')return 'secret';if(c.kind==='OVERSIZE')return ' '.repeat(4097);
      return canonicalJson(c.kind==='HASH'?{...row,handoffHash:'f'.repeat(64)}:c.kind==='STAGE'?{...row,stage:'SECRET'}:c.kind==='EXTRA'?{...row,secret:'secret'}:c.kind==='SUCCESS'?outcome(digest).result:row);},
    });
   },RESULT_READ(){resultReads++;throw Error('after exit');},
  });
  const result=await runCurrentJourney(input(),h.ports);
  const expected=c.kind==='VALID'?'EXIT_STATUS_'+c.stage:c.kind==='SPAWN'?'EXIT_SPAWN_ERROR':c.kind==='SIGNAL'?'EXIT_SIGNAL':c.kind==='ZERO'?'RESULT_READ':'EXIT_STATUS';
  assert.equal(result.code,'STOPPED_CHILD_'+expected,c.kind);assert.equal(result.status,'UNKNOWN');assert.equal(result.stage,'CHILD');
  assert.equal(resultReads,c.kind==='ZERO'?1:0);assert.equal(h.calls.includes('CLEANUP'),false);assert.equal(h.calls.filter(v=>v==='RECORD').length,1);
  assert.equal(reads,['EXPIRED','CURRENT','SPAWN','SIGNAL','ZERO'].includes(c.kind)?0:1,c.kind);
  assert.doesNotMatch(JSON.stringify(result),/secret|SIGTERM|stdout|stderr|stack/);
 }
});

test('IX01 CHILD 출력 진단 RAM: TAP과 원 결과 결박 실패는 정리를 열지 않는다',async()=>{
 for(const mutate of [v=>({...v,stdout:'secret'}),v=>({...v,stderr:'secret'}),v=>({...v,result:{...v.result,handoffHash:'f'.repeat(64)}})] as ((v:ReturnType<typeof outcome>)=>unknown)[]){
  const h=harness();h.ports.child=async handoff=>mutate(outcome(contentHash(canonicalJson(handoff))));
  const result=await runCurrentJourney(input(),h.ports);assert.equal(result.code,'STOPPED_CHILD_OUTPUT_VERIFY');assert.equal(result.status,'UNKNOWN');assert.equal(result.stage,'CHILD');
  assert.equal(h.calls.includes('CLEANUP'),false);assert.equal(h.calls.filter(v=>v==='RECORD').length,1);assert.doesNotMatch(JSON.stringify(result),/secret|stdout|stderr/);
 }
 const h=harness();h.ports.child=async handoff=>{h.expire();return outcome(contentHash(canonicalJson(handoff)));};
 const result=await runCurrentJourney(input(),h.ports);assert.equal(result.code,'STOPPED_CHILD');assert.equal(result.status,'UNKNOWN');assert.equal(h.calls.includes('CLEANUP'),false);
});
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

test('IX01 0077 CASE 구문 RAM: 세 조건 괄호와 고정 원바이트 결박을 보존한다',()=>{
 const path='db/migrations/0077_registered_execution_preparation_options.sql.pending';
 const original=git(['cat-file','blob','1b60eec8a3d68a920d08130c3cc131274ae8aec3:'+path]);
 assert.equal(contentHash(original),'e2a2451e693ebf50026595691b547af39a2410e0c4a217aaf0e0e8a7b70920a8');
 // Windows checkout의 CRLF만 Git LF로 환원하고, 고정 expected SHA를 별도로 검산한다.
 const raw=Buffer.from(readFileSync(new URL('../../../'+path,import.meta.url),'utf8').replace(/\r\n/g,'\n'));
 assert.equal(raw.length,156568);
 assert.equal(contentHash(raw),'a9f33cdc170b4483aa2f572c52b53272aba785ffd45facdd681151046f3ee174');
 const tsv=git(['cat-file','blob','HEAD:docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv']);
 const row=readCurrentSchemaManifest(tsv).find(row=>row.path===path)!;
 assert.equal(row.bytes,raw.length);assert.equal(row.sha256,contentHash(raw));
 const before=[
  "IS DISTINCT FROM CASE purpose WHEN 'REQUEST' THEN 'requestApproval' ELSE 'decideApproval' END",
  "OR x->>'kind' IS DISTINCT FROM CASE op WHEN 'prepareExecution' THEN 'PREPARATION_OPTIONS' WHEN 'requestApproval' THEN 'PREPARATION_APPROVAL_REQUEST' ELSE 'PREPARATION_APPROVAL_DECISION' END",
  "OR x->>'key' IS DISTINCT FROM CASE op WHEN 'prepareExecution' THEN 'registered_options' WHEN 'requestApproval' THEN 'registered_options_request' ELSE 'registered_options_decision' END",
 ];
 const beforeA6=git(['cat-file','blob','635557bef72b7f00bac724e90bea0ab392a9f861:'+path]);
 assert.equal(contentHash(beforeA6),'783bd97620a64f50aa3546933dce68ff355919f323ae957401b6a0642d526436');
 assert.deepEqual(Buffer.from(raw.toString('utf8').replace("IS DISTINCT FROM (CASE purpose WHEN 'REQUEST' THEN 'requestApproval' ELSE 'decideApproval' END)","IS DISTINCT FROM CASE purpose WHEN 'REQUEST' THEN 'requestApproval' ELSE 'decideApproval' END")),beforeA6);
 let restored=raw.toString('utf8');
 for(const text of before){const fixed=text.replace('FROM CASE','FROM (CASE')+')';assert.equal(restored.split(fixed).length,2);restored=restored.replace(fixed,text);}
 assert.deepEqual(Buffer.from(restored),original);
});

test('IX01 후속 CASE 구문 RAM: 여섯 조건 괄호·grant 인용과 세 원바이트 결박을 보존한다',()=>{
 const entries=[
  {
    "path": "db/migrations/0078_start_execution_material_registration.sql.pending",
    "oldHash": "7a1b7ea71198e59b589a2df3356d8f6488fe0c4a9615daa4a135589d4a3d91fc",
    "hash": "8e0a54d726de8da2c57b88f512ae18baf2ae3a55a74969cab99bf2078e5a0a3c",
    "bytes": 27062,
    "expressions": [
      "CASE ix WHEN 1 THEN 'CONTEXT_BUNDLE' ELSE 'START_OPTIONS' END"
    ]
  },
  {
    "path": "db/migrations/0082_fn09_origin_reuse_synthetic_start.sql.pending",
    "oldHash": "4cbca6ad03aa9b4ac8b7ce485ca1dc9e34df8692cd7dc6a0b5de716101fa84b2",
    "hash": "3f32acd0f6f402e823bd3805b1948ae8f48d7ec98300e8dbdc2925923d49cfdf",
    "bytes": 230277,
    "expressions": [
      "CASE d.decision WHEN 'APPROVE' THEN 'APPROVED' WHEN 'REJECT' THEN 'REJECTED' WHEN 'REQUEST_CHANGE' THEN 'CHANGE_REQUESTED' ELSE NULL END",
      "CASE WHEN reuse THEN decision_row.id ELSE NULL END",
      "CASE WHEN reuse THEN ad.id ELSE NULL END",
      "CASE WHEN reuse THEN anvil.execution_json_hash(origin_request) ELSE anvil.execution_json_hash(jsonb_build_object(\n  'schemaVersion',1,'projectId',pid,'commandId',c.command_id,'clientId',c.client_id,'controlGeneration',c.control_generation,'operation','queueExecutionCommand','targetId',NULL,\n  'expectedVersion',0,'baselineRefs','[]'::jsonb,'approvalRef',NULL,'payload',jsonb_build_object('preparationRef',f->'preparationRef','executionId',e.id,\n  'executionGeneration',e.generation,'permissionPolicyRef',c.policy_ref,'budgetPolicyRef',q->'budgetPolicyRef','operation','START_SESSION','payload',q->'payload'))) END"
    ]
  },
  {
    "path": "db/migrations/0083_normal_initial_execution.sql.pending",
    "oldHash": "01794abbaf55fecc97b4f7c1709a1aabde748f4ee1fbd1e5f1d632cf912ad5e8",
    "hash": "f4804eb9dcb30a88908d3cb51e3d3e2e98cedbddf75f5eb3605be44411f32294",
    "bytes": 57849,
    "expressions": [
      "CASE ix WHEN 1 THEN 'CONTEXT_BUNDLE' ELSE 'START_OPTIONS' END"
    ]
  }
];
 const tsv=git(['cat-file','blob','HEAD:docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv']);
 const manifest=readCurrentSchemaManifest(tsv);
 let added=0;
 for(const entry of entries){
  const original=git(['cat-file','blob','10c8977edf087cde585c84850cac79028d516129:'+entry.path]);
  assert.equal(contentHash(original),entry.oldHash);
  const raw=Buffer.from(readFileSync(new URL('../../../'+entry.path,import.meta.url),'utf8').replace(/\r\n/g,'\n'));
  assert.equal(raw.length,entry.bytes,entry.path);assert.equal(contentHash(raw),entry.hash,entry.path);
  const row=manifest.find(row=>row.path===entry.path)!;
  assert.equal(row.bytes,raw.length);assert.equal(row.sha256,entry.hash);
  let restored=raw.toString('utf8');
  if(entry.path.endsWith('/0082_fn09_origin_reuse_synthetic_start.sql.pending')){
   assert.equal(restored.split('"grant"').length,16);
   restored=restored.replaceAll('"grant"','grant');
   const beforeA7=git(['cat-file','blob','d1b36f0e490cf4153e02b4943b6d41391c356102:'+entry.path]);
   assert.equal(contentHash(beforeA7),'73374c8269fa9c8b13d8f3825d0f6c168772216968dc2f720fa064c91bc359a6');
   assert.deepEqual(Buffer.from(restored.replace("(CASE d.decision WHEN 'APPROVE' THEN 'APPROVED' WHEN 'REJECT' THEN 'REJECTED' WHEN 'REQUEST_CHANGE' THEN 'CHANGE_REQUESTED' ELSE NULL END)","CASE d.decision WHEN 'APPROVE' THEN 'APPROVED' WHEN 'REJECT' THEN 'REJECTED' WHEN 'REQUEST_CHANGE' THEN 'CHANGE_REQUESTED' ELSE NULL END").replace("(CASE WHEN reuse THEN decision_row.id ELSE NULL END)","CASE WHEN reuse THEN decision_row.id ELSE NULL END")),beforeA7);
  }
  for(const expression of entry.expressions){
   const fixed='('+expression+')';assert.equal(restored.split(fixed).length,2,entry.path);
   restored=restored.replace(fixed,expression);
  }
  assert.deepEqual(Buffer.from(restored),original);
  added+=raw.length-original.length;
 }
 assert.equal(added,42);
});

test('IX01 INSTALL 안전 진단 RAM: 원 parser 진단만 UNKNOWN 결과에 보존한다',async()=>{
 const api=await import('../../../scripts/qa-ix01-current-journey.ts');
 assert.equal(typeof api.runCurrentDdlInstall,'function');
 const raw=git(['cat-file','blob','HEAD:'+currentProfile.legacy]);
 const legacy=await import('data:text/javascript;base64,'+Buffer.from(currentLegacyModuleSource(raw,currentProfile.legacyHash)).toString('base64'));
 const cases=[
  ['42601','syntax error near PRIVATE_SQL',null],
  ['42P01','relation "anvil.missing_table" does not exist',{kind:'RELATION',identifier:'anvil.missing_table'}],
  ['42883','function pg_catalog.missing_fn(uuid, jsonb) does not exist',{kind:'FUNCTION',identifier:'pg_catalog.missing_fn'}],
  ['42703','column "missing_column" of relation "anvil.rows" does not exist',{kind:'COLUMN',identifier:'missing_column'}],
  ['42P01','relation "private_schema.secret" does not exist',null],
 ] as const;
 for(const [sqlState,message,diagnostic] of cases){
  const h=harness(),records:unknown[]=[];
  h.ports.schema.install=async()=>{h.calls.push('SQL');return api.runCurrentDdlInstall(()=>{throw {status:3,signal:null,stderr:'psql:<stdin>:1170: ERROR:  '+sqlState+': '+message+'\nDETAIL: PRIVATE_DETAIL\n',stdout:'PRIVATE_STDOUT'};},legacy);};
  h.ports.record=async result=>{h.calls.push('RECORD');records.push(result);};
  const result=await runCurrentJourney(input(),h.ports);
  assert.equal(result.status,'UNKNOWN');assert.equal(result.stage,'INSTALL');assert.equal(result.code,'DDL_REJECTED');
  assert.deepEqual(result.ddlFailure,{sqlState,diagnostic,statementEndLine:1170});
  assert.deepEqual(result.schema,{status:'STOPPED',reason:'DDL_REJECTED',progress:[{id:h.data.sql[0]!.id,sql:'REJECTED',ledger:'NOT_STARTED'}]});
  assert.deepEqual(h.calls,['PREFLIGHT','CLAIM','RUNTIME','START','SQL','RECORD']);assert.deepEqual(records,[result]);
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE_|private_schema|stderr|stdout|stack/);
 }
 let calls=0;assert.equal(api.runCurrentDdlInstall(()=>{calls++;},legacy),'SETTLED');assert.equal(calls,1);
});

test('IX01 INSTALL 안전 진단 RAM: 불명과 현재성 소실은 진단을 승격하지 않는다',async()=>{
 const api=await import('../../../scripts/qa-ix01-current-journey.ts');
 assert.equal(typeof api.runCurrentDdlInstall,'function');
 const raw=git(['cat-file','blob','HEAD:'+currentProfile.legacy]);
 const legacy=await import('data:text/javascript;base64,'+Buffer.from(currentLegacyModuleSource(raw,currentProfile.legacyHash)).toString('base64'));
 for(const error of [{status:1,stderr:'PRIVATE_ERROR'},{status:3,stderr:'ERROR:  42601: private\nERROR:  42601: another'},Error('private')]){
  const h=harness();h.ports.schema.install=async()=>api.runCurrentDdlInstall(()=>{throw error;},legacy);
  const result=await runCurrentJourney(input(),h.ports);
  assert.equal(result.status,'UNKNOWN');assert.equal(result.code,'INSTALL_UNKNOWN');assert.equal(Object.hasOwn(result,'ddlFailure'),false);
  assert.equal(h.calls.includes('CLEANUP'),false);assert.equal(h.calls.includes('SECURE'),false);assert.equal(h.calls.filter(c=>c==='RECORD').length,1);
 }
 const h=harness();h.ports.schema.install=async()=>api.runCurrentDdlInstall(()=>{h.drop();throw {status:3,stderr:'psql:<stdin>:9: ERROR:  42601: private'};},legacy);
 const result=await runCurrentJourney(input(),h.ports);assert.equal(result.code,'INSTALL_UNKNOWN');assert.equal(Object.hasOwn(result,'ddlFailure'),false);
});

test('IX01 INSTALL 안전 진단 RAM: 진단 속성은 데이터만 복제하고 위조 결과를 거절한다',async()=>{
 const api=await import('../../../scripts/qa-ix01-current-journey.ts');
 const raw=git(['cat-file','blob','HEAD:'+currentProfile.legacy]);
 const legacy=await import('data:text/javascript;base64,'+Buffer.from(currentLegacyModuleSource(raw,currentProfile.legacyHash)).toString('base64'));
 let traps=0;
 const accessor=new legacy.DdlFailure('42P01',null,1);
 Object.defineProperty(accessor,'diagnostic',{get(){traps++;throw Error('private');}});
 const unsafe=new legacy.DdlFailure('42P01',{kind:'RELATION',identifier:'private/path'},Number.MAX_SAFE_INTEGER+1);
 const proxy=new Proxy({},{get(){traps++;throw Error('private');},getPrototypeOf(){traps++;throw Error('private');}});
 for(const [parsed,expected] of [[accessor,{sqlState:'42P01',diagnostic:null,statementEndLine:1}],
  [unsafe,{sqlState:'42P01',diagnostic:null,statementEndLine:null}],[proxy,null],
  [{sqlState:'42P01',diagnostic:{kind:'RELATION',identifier:'anvil.forged'},statementEndLine:1},null]] as const){
  const h=harness();
  h.ports.schema.install=async()=>api.runCurrentDdlInstall(()=>{throw Error('private');},{DdlFailure:legacy.DdlFailure,parsePsqlFailure:()=>parsed});
  const result=await runCurrentJourney(input(),h.ports);
  assert.equal(result.code,expected?'DDL_REJECTED':'INSTALL_UNKNOWN');assert.deepEqual(result.ddlFailure,expected??undefined);
  assert.doesNotMatch(JSON.stringify(result),/private|forged/);assert.equal(h.calls.includes('CLEANUP'),false);
 }
 assert.equal(traps,0);
});


test('IX01 TC01 능동 진단 RAM: 실제 요청과 검증 경계를 원문 없이 추적한다',async()=>{
 const {runMethodologyCopyApplicationScenario}=await import('../../integration/IX01/methodology-copy-application-scenario.ts');
 const api=await import('../../../scripts/qa-ix01-current-journey.ts');
 for(const kind of ['REQUEST','STATUS','JSON','IDENTITY','COPY_REQUEST','COPY_VERIFY']){
  const stages:string[]=[];let requests=0;
  const graph={nodes:[{position:{x:0}}],edges:[]};
  const builtin={ref:{id:'a6f20000-0000-4000-8000-000000000001',version:2,contentHash:contentHash(canonicalJson(graph))},graph,validation:{validForConfirmation:true},scope:'SYSTEM',purpose:'RAM'};
  const app={async inject(){requests++;if(kind==='REQUEST'||kind==='COPY_REQUEST'&&requests===2)throw Error('private request detail');return {statusCode:kind==='STATUS'?503:200,body:'{}',json(){if(kind==='JSON')throw Error('private response detail');return kind.startsWith('COPY_')&&requests===1?builtin:{};}};}};
  await assert.rejects(runMethodologyCopyApplicationScenario({app:app as unknown as Parameters<typeof runMethodologyCopyApplicationScenario>[0]['app'],
   session:{user:{id:'00000000-0000-4000-8000-000000000001',displayName:'RAM',serverOwner:false},clientId:'00000000-0000-4000-8000-000000000002',token:'a'.repeat(43),csrfToken:'b'.repeat(43)},
   origin:'https://localhost:3830',assertCurrent(){},onStage(stage:string){stages.push(stage);}}));
  assert.equal(requests,kind.startsWith('COPY_')?2:1);
  assert.deepEqual(stages,kind==='REQUEST'?['TC01_BUILTIN_REQUEST']:['TC01_BUILTIN_REQUEST','TC01_BUILTIN_VERIFY',...(kind.startsWith('COPY_')?['TC01_COPY_REQUEST',...(kind==='COPY_VERIFY'?['TC01_COPY_VERIFY']:[])]:[])]);
  const rows:string[]=[];api.recordCurrentChildFailure(stages.at(-1),'a'.repeat(64),{fresh(){},write(raw){rows.push(raw);}});
  assert.equal(rows.length,1);assert.equal(JSON.parse(rows[0]!).stage,stages.at(-1));assert.doesNotMatch(rows[0]!,/private|response|payload|headers|https/);
 }
});

test('IX01 TC01 능동 진단 RAM: 앱과 요청 단계는 인계 결박 UNKNOWN이며 잘못된 단계는 fallback이다',async()=>{
 const api=await import('../../../scripts/qa-ix01-current-journey.ts');
 for(const stage of ['APP_LOAD','APP_BUILD','TC01_BUILTIN_REQUEST','TC01_COPY_VERIFY','TC01_CREATE_PROJECT_REQUEST','TC01_REREAD_APPLICATION_VERIFY','TC01','TC01_SECRET_VERIFY']){
  const h=harness();h.ports.child=async handoff=>{
   const digest=contentHash(canonicalJson(handoff));
   api.verifyCurrentChildExit({status:1,signal:null},()=>now,handoff.expiresAt,{handoffHash:digest,fresh(){},read(){return canonicalJson({schemaVersion:1,purpose:'IX01_CURRENT_TC01_CHILD_FAILURE',handoffHash:digest,stage});}});
   assert.fail('실패 뒤 성공 진입 금지');
  };
  const result=await runCurrentJourney(input(),h.ports);
  assert.deepEqual([result.status,result.stage,result.code],['UNKNOWN','CHILD','STOPPED_CHILD_EXIT_STATUS'+(stage==='TC01_SECRET_VERIFY'?'':'_'+stage)]);
  assert.equal(h.calls.includes('CLEANUP'),false);assert.equal(h.calls.filter(x=>x==='RECORD').length,1);
 }
});
