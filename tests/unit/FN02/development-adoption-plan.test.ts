import assert from 'node:assert/strict';
import test,{mock} from 'node:test';
import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const load=()=>import(new URL('../../../scripts/fn02-development-adoption-plan.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
async function observed(){const text=await readFile(new URL('../../../docs/04_test_reports/AV3/FN02/FORMAL_SCHEMA_METADATA_RESULT.md',import.meta.url),'utf8');return [...text.matchAll(/^\|([0-9][a-z0-9_]+)\|([a-f0-9]{64})\|$/gm)].map(m=>({id:m[1]!,checksum:m[2]!}));}
const nextIds=['0012_assignment_drafts','0013_assignment_confirmation','0014_context_preparation','0015_project_baselines','0016_execution_preparation','0017_execution_authority','0031_empty_project_methodology_application'];
const nextHashes=['1120676ce1df7a086d374adb5c81356d7ab2c12ef6e07c8ce66c36b4c57a7133','fe064af94b23185066047f8e202806cd4c3a7fe69ab7855bd2d2f6b961ae7cca','7c8fa1c83400e711d341e3710f765fa29af5fa6c821adf594ce195172194ec97','3e5eea0f94186f0cc28819d435e85c4fec97569dda3bef7751ad420ed9d3b6ec','612be372c2a82f201c072dde62e7c1222ff96168172edf22a11226e7291fe91d','40c8666fe6fb8f9d1d027d9f15d03e8a71f2b608887343e9a92b49c72220b1f3','e9dee26a03ddd643f06ddc9dfbfe39dccfb91fc305fcc465e53a5d15fd2880c6'];

test('현재46만 검증해 고정 순서7개를 제안하고 실행 가능 상태로 승격하지 않는다',async()=>{
 const m:any=await load();assert.equal(typeof m.createFn02DevelopmentAdoptionPlan,'function');const plan=await m.createFn02DevelopmentAdoptionPlan(await observed());
 assert.equal(plan.kind,'CODE_ONLY_NOT_EXECUTABLE');assert.equal(plan.baseline.count,46);assert.equal(plan.targetCount,53);assert.deepEqual(plan.steps.map((s:any)=>s.id),nextIds);assert.deepEqual(plan.steps.map((s:any)=>[s.beforeCount,s.afterCount]),[[46,47],[47,48],[48,49],[49,50],[50,51],[51,52],[52,53]]);
 assert.deepEqual(plan.steps.map((s:any)=>s.checksum),nextHashes);assert.equal(plan.execution.allowed,false);assert.equal(plan.execution.prior0012RejectionUnresolved,true);assert.equal(plan.execution.databaseConnections,0);assert.equal(plan.execution.backupsCreated,0);assert.equal(plan.execution.sqlExecuted,0);assert.equal(plan.observationCurrentness,'NOT_RECHECKED');assert.ok(Object.isFrozen(plan.steps)&&Object.isFrozen(plan.steps[0]));
});

test('누락·중복·현재52·미채택 추가·옛 checksum을 새 실행 계획으로 수용하지 않는다',async()=>{
 const m:any=await load();assert.equal(typeof m.createFn02DevelopmentAdoptionPlan,'function');const base=await observed();const actual52=[...base,...nextIds.slice(0,6).map((id,i)=>({id,checksum:nextHashes[i]!}))];for(const rows of [base.slice(1),[...base,base[0]],base.map((r,i)=>i===0?{...r,checksum:'a'.repeat(64)}:r),actual52,[...base,{id:'0029_unadopted',checksum:'b'.repeat(64)}]])await assert.rejects(m.createFn02DevelopmentAdoptionPlan(rows),/FN02_ADOPTION_BASELINE_INVALID/);
});

test('비동기 source 로드 중 호출자 baseline 변경은 계획에 유입되지 않는다',async()=>{
 const m:any=await load();assert.equal(typeof m.createFn02DevelopmentAdoptionPlan,'function');const rows=await observed();const pending=m.createFn02DevelopmentAdoptionPlan(rows);rows[0]!.checksum='f'.repeat(64);rows.push({id:'0029_unadopted',checksum:'f'.repeat(64)});const plan=await pending;assert.equal(plan.baseline.count,46);assert.equal(plan.steps.length,7);assert.equal(plan.execution.allowed,false);
});

test('보존 계획은 기존81표·identity sequence를 명시하고 현재이름 검증으로 승격하지 않는다',async()=>{const m:any=await load();const p=await m.createFn02DevelopmentAdoptionPlan(await observed());assert.equal(p.preservation.expectedTables.length,81);assert.equal(new Set(p.preservation.expectedTables).size,81);for(const name of ['anvil.auth_audit_events','anvil.project_baselines','anvil.project_methodologies','anvil.commands','anvil_qa.fixtures'])assert.ok(p.preservation.expectedTables.includes(name));assert.deepEqual(p.preservation.expectedSequences,['anvil.auth_audit_events_server_sequence_seq']);assert.equal(p.preservation.liveNamesVerified,false);assert.equal(p.preservation.dumpIncludesNonTableObjects,true);assert.equal(p.preservation.rowFingerprintProjection,'PRE_BACKUP_COLUMNS_ONLY');});

test('source 읽기 경계에서 각 선행 SQL 바이트가 달라지면 계획을 거절한다',async()=>{
 const m:any=await load(),base=await observed(),original=fs.readFile;
 // 실제 파일은 수정하지 않고 느린 IO의 반환 바이트만 변조한다. 실제 manifest/고정 지문 검사는 그대로 소비한다.
 for(const id of nextIds.slice(0,6)){
  const handle=mock.method(fs,'readFile',async(...args:any[])=>{const content=await (original as any)(...args);return String(args[0]).replaceAll('\\','/').endsWith('/'+id+'.sql')?typeof content==='string'?content+'\n-- drift\n':Buffer.concat([content,Buffer.from('\n-- drift\n')]):content;});
  syncBuiltinESMExports();
  try{await assert.rejects(m.createFn02DevelopmentAdoptionPlan(base),/FN02_ADOPTION_SOURCE_CHANGED/);}
  finally{handle.mock.restore();syncBuiltinESMExports();}
 }
});

test('CLI는 보존 metadata의 plan만 출력하고 apply·추가인자는 설정 없이 거절한다',()=>{
 const path=fileURLToPath(new URL('../../../scripts/fn02-development-adoption-plan.ts',import.meta.url));const env={...process.env,ANVIL_DB_CONFIG:'DO_NOT_OPEN_PROTECTED_CONFIG',ANVIL_FN09_APPLY_APPROVAL:'AV3-FN09-FORMAL-SCHEMA-ONLY'};
 const plan=spawnSync(process.execPath,[path,'--plan'],{encoding:'utf8',env,timeout:10000});assert.equal(plan.status,0,plan.stderr);const output=JSON.parse(plan.stdout);assert.equal(output.kind,'CODE_ONLY_NOT_EXECUTABLE');assert.equal(output.execution.allowed,false);assert.equal(output.observationCurrentness,'NOT_RECHECKED');
 for(const args of [[],['--apply'],['--apply-schema-only'],['--plan','--apply']]){const r=spawnSync(process.execPath,[path,...args],{encoding:'utf8',env,timeout:10000});assert.equal(r.status,1);assert.deepEqual(JSON.parse(r.stdout),{status:'FAIL',reason:'FN02_ADOPTION_PLAN_ONLY'});assert.equal(r.stderr,'');}
});
