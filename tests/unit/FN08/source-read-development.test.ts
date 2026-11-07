import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sourceReadMigrationManifest,sourceReadMigrationId} from '../../../scripts/source-read-migration.ts';
const load=()=>import(new URL('../../../scripts/source-read-development-guard.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const now=Date.parse('2026-10-18T00:00:00Z');
function binding(){return {platform:'linux',uid:1000,cwd:'/home/daon/deploy/anvil-v3',head:'a'.repeat(40),origin:'git@github-sinsan-develop:sinsan-develop/Anvil.git',dirty:'',configPath:'/home/daon/.local/share/anvil-v3-development/migrator.json',approval:'AV3-PMO-A3-FORMAL-SCHEMA-ONLY',commit:'a'.repeat(40),sqlHash:'b'.repeat(64),expiresAt:'2026-10-18T01:00:00Z'};}
test('새 formal marker·정확 Git/대상/유한 기한이 모두 일치할 때만 준비 결박을 반환한다',async()=>{
 const m:any=await load();assert.equal(typeof m.readSourceReadDevelopmentBinding,'function');
 assert.deepEqual(m.readSourceReadDevelopmentBinding(binding(),now),{commit:'a'.repeat(40),sqlHash:'b'.repeat(64),expiresAtMs:now+3600000});
});
test('과거 격리 marker·다른 Git/OS/주체/경로·dirty·만료/무한 창은 DB 접속 전 거절한다',async()=>{
 const m:any=await load();assert.equal(typeof m.readSourceReadDevelopmentBinding,'function');
 const cases=[{approval:'AV3-PMO-A3-SQL-CHECKSUM-ONLY-QA'},{platform:'win32'},{uid:0},{head:'c'.repeat(40)},{commit:'A'.repeat(40)},{sqlHash:'x'.repeat(64)},{origin:'https://github.com/other/repo.git'},{dirty:' M x'},{cwd:'/tmp/anvil-v3'},{configPath:'/tmp/migrator.json'},{expiresAt:'2026-10-18T00:00:00Z'},{expiresAt:'2026-10-18T02:00:01Z'},{expiresAt:'not-a-date'}];
 for(const change of cases)assert.throws(()=>m.readSourceReadDevelopmentBinding({...binding(),...change},now),/SOURCE_READ_DEVELOPMENT_BINDING_INVALID/);
 assert.throws(()=>m.readSourceReadDevelopmentBinding(binding(),NaN),/BINDING_INVALID/);
});
test('formal 선행45 및 적용후46 checksum을 대조하며 중복·추가·누락·변조·재적용은 거절한다',async()=>{
 const m:any=await load();assert.equal(typeof m.assertSourceReadDevelopmentManifest,'function');
 const manifest=await sourceReadMigrationManifest(),old=[...manifest.expected].map(([id,checksum])=>({id,checksum})),added={id:sourceReadMigrationId,checksum:manifest.checksum};
 m.assertSourceReadDevelopmentManifest(old,manifest.expected,manifest.checksum,'BEFORE');
 m.assertSourceReadDevelopmentManifest([...old,added],manifest.expected,manifest.checksum,'AFTER');
 for(const rows of [old.slice(1),[...old,old[0]!],[...old,{id:'unknown',checksum:'d'.repeat(64)}],old.map((r,i)=>i? r:{...r,checksum:'d'.repeat(64)}),[...old,added]])
  assert.throws(()=>m.assertSourceReadDevelopmentManifest(rows,manifest.expected,manifest.checksum,'BEFORE'),/SOURCE_READ_DEVELOPMENT_MANIFEST_INVALID/);
 for(const rows of [old,[...old,{...added,checksum:'d'.repeat(64)}],[...old,added,added]])
  assert.throws(()=>m.assertSourceReadDevelopmentManifest(rows,manifest.expected,manifest.checksum,'AFTER'),/MANIFEST_INVALID/);
 assert.throws(()=>m.assertSourceReadDevelopmentManifest(old,manifest.expected,manifest.checksum,'TYPO'),/MANIFEST_INVALID/);
});
const state=(name:string,n='0')=>({schema:'anvil',name,n,fingerprint:'a'.repeat(32),structureHash:'b'.repeat(64)});
function baseline(){const before=[state('projects','2'),state('schema_migrations','45')];return {before,after:[state('projects','2'),state('schema_migrations','46'),...['source_read_grants','source_read_challenges','source_read_credentials','source_snapshots'].map(n=>state(n))]};}
test('옛 표 계약/행은 보존하고 migrations 1행 증가와 새4표0행만 허용한다',async()=>{
 const m:any=await load();assert.equal(typeof m.assertSourceReadDevelopmentBaseline,'function');const {before,after}=baseline();
 after[1]!.fingerprint='c'.repeat(32);
 m.assertSourceReadDevelopmentBaseline(before,after);
});
test('기존 표 데이터/권한 변화·임의 표/누락·새 표 비어있지 않음·중복은 적용 검수를 닫는다',async()=>{
 const m:any=await load();assert.equal(typeof m.assertSourceReadDevelopmentBaseline,'function');
 const change=(index:number,patch:object)=>{const b=baseline();b.after[index]={...b.after[index]!,...patch};return b;};
 const mutations=[change(0,{n:'3'}),change(0,{fingerprint:'c'.repeat(32)}),change(0,{structureHash:'c'.repeat(64)}),change(1,{n:'47'}),change(2,{n:'1'}),change(2,{schema:'other'})];
 const missing=baseline();missing.after.pop();mutations.push(missing);
 const extra=baseline();extra.after.push(state('unexpected'));mutations.push(extra);
 const duplicate=baseline();duplicate.after.push(duplicate.after[0]!);mutations.push(duplicate);
 const already=baseline();already.before.push(state('source_read_grants'));mutations.push(already);
 for(const b of mutations)assert.throws(()=>m.assertSourceReadDevelopmentBaseline(b.before,b.after),/SOURCE_READ_DEVELOPMENT_BASELINE_INVALID/);
});
const runner=fileURLToPath(new URL('../../../scripts/apply-source-read-development.ts',import.meta.url));
test('COMMIT 송신후 응답유실은 미적용/rollback 성공이 아니라 UNKNOWN·보존으로 분류한다',async()=>{
 const m:any=await load();assert.equal(typeof m.sourceReadDevelopmentFailureDisposition,'function');
 assert.deepEqual(m.sourceReadDevelopmentFailureDisposition(false,false),{schemaCommitted:false,commitOutcome:'NOT_SENT',action:'ROLLBACK_TRANSACTION'});
 assert.deepEqual(m.sourceReadDevelopmentFailureDisposition(false,true),{schemaCommitted:null,commitOutcome:'UNKNOWN',action:'PRESERVE_SCHEMA_AND_REPORT'});
 assert.deepEqual(m.sourceReadDevelopmentFailureDisposition(true,true),{schemaCommitted:true,commitOutcome:'CONFIRMED',action:'PRESERVE_SCHEMA_AND_REPORT'});
});
test('남은 창 또는 호출 상한이 끝나면 응답 없는 작업도 로컬에서 종료하고 만료 후 시작하지 않는다',async()=>{
 const m:any=await load();assert.equal(typeof m.sourceReadDevelopmentStep,'function');
 let calls=0;
 await assert.rejects(m.sourceReadDevelopmentStep(()=>{calls++;return new Promise(()=>{});},Date.now()+1000,20),/SOURCE_READ_DEVELOPMENT_STEP_TIMEOUT/);
 assert.equal(calls,1);
 await assert.rejects(m.sourceReadDevelopmentStep(()=>{calls++;return Promise.resolve('forbidden');},Date.now()-1,20),/SOURCE_READ_DEVELOPMENT_EXPIRED/);
 assert.equal(calls,1);
 const exactError=Error('LOCAL_FIXED_ERROR');
 await assert.rejects(m.sourceReadDevelopmentStep(()=>Promise.reject(exactError),Date.now()+1000,100),error=>error===exactError);
 assert.equal(await m.sourceReadDevelopmentStep(()=>Promise.resolve('ok'),Date.now()+1000,100),'ok');
});
function run(args:string[]){return spawnSync(process.execPath,[runner,...args],{encoding:'utf8',timeout:5000,env:{...process.env,ANVIL_DB_CONFIG:'/this-must-not-be-read',ANVIL_A3_APPLY_APPROVAL:''}});}
test('plan은 실제 접속/비밀 없이 정확 새4표와 schema-only 경계를 반환한다',()=>{
 const result=run(['--plan']);assert.equal(result.status,0,result.stderr);const plan=JSON.parse(result.stdout);
 assert.equal(plan.mode,'SOURCE_READ_SCHEMA_ONLY');assert.equal(plan.database,'anvil_v3_development');assert.equal(plan.oldMigrations,45);assert.equal(plan.appliedMigrations,46);
 assert.deepEqual(plan.newTables,['source_read_grants','source_read_challenges','source_read_credentials','source_snapshots']);
 assert.equal(plan.databaseAccess,0);assert.equal(plan.secretReads,0);assert.equal(plan.serviceChanges,0);
});
test('승인 없는 apply와 알 수 없는 mode는 접속 전에 고정 오류만 반환한다',()=>{
 for(const [args,failure] of [[['--apply-schema-only'],'SOURCE_READ_DEVELOPMENT_BINDING_INVALID'],[['--run'],'SOURCE_READ_DEVELOPMENT_MODE_REQUIRED']] as const){
  const result=run([...args]);assert.equal(result.status,1);const body=JSON.parse(result.stdout);assert.equal(body.status,'FAIL');assert.equal(body.failure,failure);assert.equal(body.schemaCommitted,false);assert.equal(body.databaseConnected,false);assert.equal(result.stderr,'');
 }
});
