import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {test} from 'node:test';

test('복구 entry는 현재 OS 미검증 상태에서 main·timer를 실행하지 않는다',async()=>{
 const path='../../../scripts/development-recovery-entry.ts';
 assert.ok(existsSync(new URL(path,import.meta.url)),'복구 entry 준비 소스 부재');
 const m=await import(path);let called=0;
 await assert.rejects(m.runDevelopmentRecoveryEntry({start:async()=>{called++;},schedule:()=>{called++;}}),/DEVELOPMENT_RECOVERY_OS_NOT_VALIDATED/);
 assert.equal(called,0);
});

test('종료 계획은 30분 한 창과 만료 전 정상 종료·15초 관측을 결박한다',async()=>{
 const path='../../../scripts/development-recovery-entry.ts';
 assert.ok(existsSync(new URL(path,import.meta.url)),'기한 계산 소스 부재');
 const m=await import(path),now=Date.parse('2026-10-25T00:00:00Z');
 assert.deepEqual(m.prepareRecoveryDeadline(now,now+1800000,now+1000),{closeAt:now+1770000,observeUntil:now+1785000,expiresAt:now+1800000,remainingMs:1799000,executionAuthorized:false});
 for(const args of [[now,now+1800001,now],[now,now+1000,now+1000],[now,now+1800000,now-1],[NaN,now,now]])assert.throws(()=>m.prepareRecoveryDeadline(...args),/DEVELOPMENT_RECOVERY_WINDOW_INVALID/);
});

test('순수 deadline은 한 번만 종료 요청하고 유실·지연을 성공으로 바꾸지 않는다',async()=>{
 const path='../../../scripts/development-recovery-entry.ts';assert.ok(existsSync(new URL(path,import.meta.url)),'기한 처리 소스 부재');
 const m=await import(path),events:string[]=[];let wall=1000;let fire:()=>void=()=>{};
 const lease=m.scheduleRecoveryClose({closeAt:2000,observeUntil:17000,expiresAt:32000,remainingMs:31000,executionAuthorized:false},{now:()=>wall,schedule:(f:()=>void,ms:number)=>{assert.equal(ms,1000);fire=f;return()=>events.push('cancel');},requestClose:()=>events.push('close')});
 wall=2000;fire();fire();assert.deepEqual(events,['close']);assert.equal(lease.outcome(),'EXIT_UNCONFIRMED');lease.dispose();assert.deepEqual(events,['close','cancel']);
});

test('예약 뒤 호출자가 기한을 늘려도 늦은 종료 요청을 허용하지 않는다',async()=>{
 const m=await import('../../../scripts/development-recovery-entry.ts');let wall=1000,closed=0;let fire=()=>{};
 const plan={closeAt:2000,observeUntil:17000,expiresAt:32000,remainingMs:31000,executionAuthorized:false as const};
 const lease=m.scheduleRecoveryClose(plan,{now:()=>wall,schedule:(f:()=>void)=>{fire=f;return()=>{};},requestClose:()=>{closed++;}});
 plan.expiresAt=1000000;wall=40000;fire();assert.equal(closed,0);assert.equal(lease.outcome(),'CLOCK_OR_DEADLINE_UNVERIFIED');
});

test('고정 host binding은 순수 계획만 반환하며 과기한·임의 source/root·승인 흉내를 거절한다',{skip:process.platform!=='win32'},()=>{
 assert.ok(existsSync('scripts/development-recovery-host.ps1'),'host 준비 소스 부재');
 const command=`$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-host.ps1'),[ref]$tokens,[ref]$errors);if($errors.Count){throw 'SYNTAX'};foreach($name in @('Get-DevelopmentRecoverySourcePlan','Read-DevelopmentRecoverySourceBinding')){$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true);if(!$f){throw 'PURE_FUNCTION_MISSING'};. ([scriptblock]::Create($f.Extent.Text))};$now=[datetimeoffset]'2026-10-25T00:00:00Z';$base=@{mode='P2';commit=('a'*40);runId='recovery-source-01';issuedAt=$now.ToString('o');expiresAt=$now.AddMinutes(10).ToString('o')};$ok=Read-DevelopmentRecoverySourceBinding $base $now;$bad=@();foreach($change in @(@{mode='ANY'},@{commit='../x'},@{expiresAt=$now.AddMinutes(11).ToString('o')},@{executionAuthorized=$true},@{root='D:\\other'})){$inputCopy=$base.Clone();foreach($key in $change.Keys){$inputCopy[$key]=$change[$key]};try{Read-DevelopmentRecoverySourceBinding $inputCopy $now|Out-Null;$bad+=$false}catch{$bad+=$_.Exception.Message -eq 'DEVELOPMENT_RECOVERY_BINDING_INVALID'}};@{mode=$ok.mode;tls=$ok.tlsRoot;authorized=$ok.executionAuthorized;native=$ok.nativeVerified;bad=$bad}|ConvertTo-Json -Compress`;
 const result=JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}));
 assert.deepEqual(result,{mode:'P2',tls:'D:\\Project\\Anvil\\.av3-data\\dev-tls-20261025-01',authorized:false,native:false,bad:[true,true,true,true,true]});
});

test('source 파일 목록은 고정 범위·Windows 별칭·중복·자원 한도를 검사하되 실행 권위가 아니다',async()=>{
 const m=await import('../../../scripts/development-recovery-entry.ts');
 assert.equal(typeof m.prepareRecoveryManifest,'function','파일별 source binding 부재');
 const row={relativePath:'scripts/development-recovery-entry.ts',contentHash:'a'.repeat(64),sizeBytes:20};
 const input={schemaVersion:1,commit:'b'.repeat(40),files:[row]},value=m.prepareRecoveryManifest(input);
 assert.equal(value.commit,input.commit);assert.equal(value.totalBytes,20);assert.equal(value.fileCount,1);
 assert.equal(value.executionAuthorized,false);assert.equal(value.runtimeCoverage,'DECLARED_NOT_VERIFIED');assert.equal(value.nativePinCapacityVerified,false);
 assert.equal(value.canonicalJson,'{"schemaVersion":1,"commit":"'+ 'b'.repeat(40)+'","files":[{"relativePath":"scripts/development-recovery-entry.ts","contentHash":"'+ 'a'.repeat(64)+'","sizeBytes":20}]}');
 row.contentHash='c'.repeat(64);assert.equal(value.files[0]!.contentHash,'a'.repeat(64));assert.ok(Object.isFrozen(value)&&Object.isFrozen(value.files)&&Object.isFrozen(value.files[0]));
 for(const relativePath of ['../outside','apps/server/../key','apps/server/NUL.txt','apps/server/COM¹.js','apps/server/file.','apps/server/file ','apps/server/a:stream','node_modules/a\\b','apps/server/a\u0001b','auth.json'])assert.throws(()=>m.prepareRecoveryManifest({...input,files:[{...row,relativePath}]}),/DEVELOPMENT_RECOVERY_MANIFEST_INVALID/);
 for(const files of [[],[row,{...row,relativePath:'SCRIPTS/development-recovery-entry.ts'}],[{...row,sizeBytes:-1}],[{...row,sizeBytes:2147483649}],Array.from({length:100001},()=>row)])assert.throws(()=>m.prepareRecoveryManifest({...input,files}),/DEVELOPMENT_RECOVERY_MANIFEST_INVALID/);
 assert.throws(()=>m.prepareRecoveryManifest({...input,executionAuthorized:true}),/DEVELOPMENT_RECOVERY_MANIFEST_INVALID/);
});

test('기한 검토는 획득 시 잔여시간과 중간 clock 역행을 보존한다',async()=>{
 const m=await import('../../../scripts/development-recovery-entry.ts');
 assert.equal(typeof m.prepareRecoveryLifetime,'function','획득 기준 기한 결박 부재');
 const acquired=1000000,until=acquired+60000;const a=m.prepareRecoveryLifetime(acquired-60000,until,acquired);
 const b=m.checkRecoveryLifetime(a,acquired+30000,30000);
 assert.equal(b.remainingAtAcquireMs,60000);assert.equal(b.executionAuthorized,false);
 assert.throws(()=>m.checkRecoveryLifetime(b,acquired+20000,40000),/DEVELOPMENT_RECOVERY_WINDOW_INVALID/);
 assert.throws(()=>m.checkRecoveryLifetime(a,acquired+1,60000),/DEVELOPMENT_RECOVERY_WINDOW_INVALID/);
 assert.throws(()=>m.checkRecoveryLifetime(b,acquired+30001,29999),/DEVELOPMENT_RECOVERY_WINDOW_INVALID/);
});

test('선언 목록의 getter·별칭 중복과 보호 자료 경로는 본문 접근 전에 거절한다',async()=>{
 const m=await import('../../../scripts/development-recovery-entry.ts');let reads=0;
 const input={schemaVersion:1,commit:'b'.repeat(40),files:[{relativePath:'apps/server/main.ts',contentHash:'a'.repeat(64),sizeBytes:10}]};
 const getter={...input};Object.defineProperty(getter,'files',{get(){reads++;return input.files;}});
 assert.throws(()=>m.prepareRecoveryManifest(getter),/DEVELOPMENT_RECOVERY_MANIFEST_INVALID/);assert.equal(reads,0);
 assert.throws(()=>m.prepareRecoveryManifest({...input,files:[input.files[0],{...input.files[0],relativePath:'apps/server/MAIN.ts'}]}),/DEVELOPMENT_RECOVERY_MANIFEST_INVALID/);
 for(const relativePath of ['apps/server/.env','apps/server/.env.local','node_modules/fixture/server.key.pem','apps/server/auth.json'])assert.throws(()=>m.prepareRecoveryManifest({...input,files:[{...input.files[0],relativePath}]}),/DEVELOPMENT_RECOVERY_MANIFEST_INVALID/);
});

test('host는 소문자 모드와 metadata를 실제권위로 바꾸는 입력을 거절한다',{skip:process.platform!=='win32'},()=>{
 const command=`$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-host.ps1'),[ref]$tokens,[ref]$errors);$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Get-DevelopmentRecoverySourcePlan'},$true);. ([scriptblock]::Create($f.Extent.Text));$denied=$false;try{Get-DevelopmentRecoverySourcePlan 'p2'|Out-Null}catch{$denied=$_.Exception.Message -eq 'DEVELOPMENT_RECOVERY_BINDING_INVALID'};@{denied=$denied}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{denied:true});
});

test('OS 시험 준비는 고정14 case의 source 모의 연결만 기록하며 실제검수·권위를 발급하지 않는다',{skip:process.platform!=='win32'},()=>{
 const command=`$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-os-qa.ps1'),[ref]$tokens,[ref]$errors);if($errors.Count){throw 'SYNTAX'};foreach($name in @('Get-DevelopmentRecoveryOsQaPlan','Invoke-DevelopmentRecoveryOsQaSourceCases')){$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true);if(!$f){throw 'QA_ORCHESTRATION_MISSING'};. ([scriptblock]::Create($f.Extent.Text))};$script:calls=0;$observer={param($case)$script:calls++;if($case.caseId -in @('PARENT_REPLACEMENT','REPARSE_CHILD','OUTSIDE_WRITE','FILE_ID_CHANGED','HARD_LINK','DACL_CHANGED')){$outcome='DENIED'}elseif($case.caseId -in @('WINDOW_EXPIRED','CLOCK_REVERSED','PARTIAL_PIN_FAILURE')){$outcome='UNVERIFIED'}elseif($case.caseId -eq 'CLEANUP_UNKNOWN'){$outcome='PRESERVED_UNCONFIRMED'}else{$outcome='OBSERVATION_REQUIRED'};@{caseId=$case.caseId;outcome=$outcome;kind='SOURCE_SIMULATION';nativeVerified=$false}};$r=Invoke-DevelopmentRecoveryOsQaSourceCases $observer;$rejected=$false;try{Invoke-DevelopmentRecoveryOsQaSourceCases {param($case)@{caseId=$case.caseId;outcome='DENIED';kind='SOURCE_SIMULATION';nativeVerified=$true}}|Out-Null}catch{$rejected=$_.Exception.Message -eq 'DEVELOPMENT_RECOVERY_QA_SIMULATION_INVALID'};@{status=$r.status;cases=$r.recordedCases;calls=$script:calls;authorized=$r.executionAuthorized;os=$r.osVerified;rejected=$rejected}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{status:'SOURCE_SIMULATION_RECORDED_NOT_OS_VALIDATED',cases:14,calls:14,authorized:false,os:false,rejected:true});
});

test('모의 시험 일부 성공 뒤 오류나 case 재사용은 다음 항목을 실행하거나 전체성공으로 처리하지 않는다',{skip:process.platform!=='win32'},()=>{
 const command=`$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-os-qa.ps1'),[ref]$tokens,[ref]$errors);foreach($name in @('Get-DevelopmentRecoveryOsQaPlan','Invoke-DevelopmentRecoveryOsQaSourceCases')){$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true);. ([scriptblock]::Create($f.Extent.Text))};$script:count=0;$failed=$false;try{Invoke-DevelopmentRecoveryOsQaSourceCases {param($case)$script:count++;if($script:count -eq 3){throw 'FAKE_UNAVAILABLE'};@{caseId=$case.caseId;outcome='DENIED';kind='SOURCE_SIMULATION';nativeVerified=$false}}|Out-Null}catch{$failed=$_.Exception.Message -eq 'DEVELOPMENT_RECOVERY_QA_SIMULATION_INVALID'};$replay=$false;try{Invoke-DevelopmentRecoveryOsQaSourceCases {param($case)@{caseId='PARENT_REPLACEMENT';outcome='DENIED';kind='SOURCE_SIMULATION';nativeVerified=$false}}|Out-Null}catch{$replay=$_.Exception.Message -eq 'DEVELOPMENT_RECOVERY_QA_SIMULATION_INVALID'};@{failed=$failed;calls=$script:count;replay=$replay}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{failed:true,calls:3,replay:true});
});
