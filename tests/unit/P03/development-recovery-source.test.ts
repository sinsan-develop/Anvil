import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {test} from 'node:test';

function simulationFixture(){
 const start=Date.parse('2026-10-25T00:00:00Z'),events:string[]=[];
 const clock={wall:start,mono:0};
 const request={mode:'P2',commit:'b'.repeat(40),runId:'source-bridge-01',issuedAt:start,expiresAt:start+600000,manifest:null};
 const reply=(context:any,state:string)=>({kind:'SOURCE_SIMULATION',state,runId:context.runId,commit:context.commit,mode:context.mode,manifestHash:context.manifestHash,leaseId:'source-lease-01',nativeVerified:false});
 const io={kind:'SOURCE_SIMULATION',wallNow:()=>clock.wall,monotonicNow:()=>clock.mono,
  async simulateAcquire(context:any){events.push('acquire');assert.ok(Object.isFrozen(context));return reply(context,'ACQUIRED_SIMULATION');},
  async simulateStep(context:any){events.push('step');return reply(context,'STEP_RECORDED_SIMULATION');},
  async simulateRelease(context:any){events.push('release');return reply(context,'RELEASE_RECORDED_SIMULATION');}};
 return{start,clock,request,events,reply,io};
}

test('실파일 변경 adapter 후보는 생성 시 I/O 없이 실제 호출 6종을 모두 실행 선행에서 차단한다',{skip:process.platform!=='win32'},()=>{
 const command=`$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-os-qa.ps1'),[ref]$tokens,[ref]$errors);foreach($name in @('Assert-DevelopmentRecoveryOsQaExecution','New-DevelopmentRecoveryOsQaFilesystemAdapter')){$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true);if(!$f){throw 'FILESYSTEM_ADAPTER_MISSING'};. ([scriptblock]::Create($f.Extent.Text))};$adapter=New-DevelopmentRecoveryOsQaFilesystemAdapter;$blocked=0;foreach($case in @('PARENT_REPLACEMENT','REPARSE_CHILD','OUTSIDE_WRITE','FILE_ID_CHANGED','HARD_LINK','DACL_CHANGED')){try{$adapter.Mutate($case)|Out-Null;throw 'UNEXPECTED_EXECUTION'}catch{if($_.Exception.ToString() -notmatch 'DEVELOPMENT_RECOVERY_OS_QA_NOT_AUTHORIZED'){throw};$blocked++}};@{blocked=$blocked;nativeVerified=$adapter.nativeVerified;executionAuthorized=$adapter.executionAuthorized}|ConvertTo-Json -Compress`;
 const output=execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']});
 assert.deepEqual(JSON.parse(output),{blocked:6,nativeVerified:false,executionAuthorized:false});
});

test('동적 gate 함수 재정의로 실제 mutation 본문에 도달하지 않는다',{skip:process.platform!=='win32'},()=>{
 const command=`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-os-qa.ps1'),[ref]$t,[ref]$e);foreach($name in @('Assert-DevelopmentRecoveryOsQaExecution','New-DevelopmentRecoveryOsQaFilesystemAdapter')){$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true);. ([scriptblock]::Create($f.Extent.Text))};$adapter=New-DevelopmentRecoveryOsQaFilesystemAdapter;function Assert-DevelopmentRecoveryOsQaExecution {throw 'FAKE_REDEFINED_GATE'};$blocked=$false;try{$adapter.Mutate('DACL_CHANGED')|Out-Null}catch{$blocked=$_.Exception.ToString().Contains('DEVELOPMENT_RECOVERY_OS_QA_NOT_AUTHORIZED')};@{blocked=$blocked}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{blocked:true});
});

test('모의 callback의 외부 효과는 관측하지 않았으므로 실제 OS 건수를 0으로 단정하지 않는다',{skip:process.platform!=='win32'},()=>{
 const command=`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-os-qa.ps1'),[ref]$t,[ref]$e);foreach($name in @('Get-DevelopmentRecoveryOsQaPlan','Invoke-DevelopmentRecoveryOsQaSourceCases')){$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true);. ([scriptblock]::Create($f.Extent.Text))};$r=Invoke-DevelopmentRecoveryOsQaSourceCases {param($case)$id=$case.caseId;$outcome=if($id -cin @('PARENT_REPLACEMENT','REPARSE_CHILD','OUTSIDE_WRITE','FILE_ID_CHANGED','HARD_LINK','DACL_CHANGED')){'DENIED'}elseif($id -cin @('WINDOW_EXPIRED','CLOCK_REVERSED','PARTIAL_PIN_FAILURE')){'UNVERIFIED'}elseif($id -ceq 'CLEANUP_UNKNOWN'){'PRESERVED_UNCONFIRMED'}else{'OBSERVATION_REQUIRED'};@{caseId=$id;outcome=$outcome;kind='SOURCE_SIMULATION';nativeVerified=$false}};@{unknown=($null -eq $r.actualOsCases);effects=$r.osEffects}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{unknown:true,effects:'NOT_OBSERVED'});
});

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

test('source 주입 경계는 모의단계와 정리만 연결하고 실제 실행 권위를 만들지 않는다',async()=>{
 const m=await import('../../../scripts/development-recovery-entry.ts');assert.equal(typeof m.simulateRecoverySourceBridge,'function','source 주입 경계 부재');
 const f=simulationFixture(),r=await m.simulateRecoverySourceBridge(f.request,f.io);
 assert.deepEqual(f.events,['acquire','step','release']);
 assert.equal(r.status,'SOURCE_SIMULATION_RECORDED_NOT_OS_VALIDATED');assert.equal(r.executionAuthorized,false);assert.equal(r.osVerified,false);assert.equal(r.cleanup,'RELEASE_RECORDED_SIMULATION');
 const g=simulationFixture();await assert.rejects(m.simulateRecoverySourceBridge({...g.request,approvalRef:'claimed'},g.io),/DEVELOPMENT_RECOVERY_SOURCE_BRIDGE_INVALID/);assert.deepEqual(g.events,[]);
});

test('다른 run·native true 응답과 획득 ACK 유실은 정리 소유권을 추정하지 않는다',async()=>{
 const m=await import('../../../scripts/development-recovery-entry.ts');assert.equal(typeof m.simulateRecoverySourceBridge,'function');
 for(const mode of ['other-run','native-claim','lost']){
  const f=simulationFixture();f.io.simulateAcquire=async c=>{f.events.push('acquire');if(mode==='lost')throw Error('FAKE_LOST');return{...f.reply(c,'ACQUIRED_SIMULATION'),...(mode==='other-run'?{runId:'another-run'}:{nativeVerified:true})};};
  const r=await m.simulateRecoverySourceBridge(f.request,f.io);assert.deepEqual(f.events,['acquire']);assert.equal(r.status,mode==='lost'?'ACQUISITION_UNCONFIRMED':'OWNERSHIP_UNVERIFIED');assert.equal(r.executionAuthorized,false);
 }
});

test('획득 뒤 만료는 새 단계 없이 같은 source 상관관계의 정리만 허용하고 불명 결과를 보존한다',async()=>{
 const m=await import('../../../scripts/development-recovery-entry.ts');assert.equal(typeof m.simulateRecoverySourceBridge,'function');
 const f=simulationFixture();f.io.simulateAcquire=async c=>{f.events.push('acquire');f.clock.wall=f.request.expiresAt;f.clock.mono=600000;return f.reply(c,'ACQUIRED_SIMULATION');};
 f.io.simulateRelease=async c=>{f.events.push('release');return f.reply(c,'RELEASE_UNCONFIRMED_SIMULATION');};
 const r=await m.simulateRecoverySourceBridge(f.request,f.io);assert.deepEqual(f.events,['acquire','release']);assert.equal(r.step,'WINDOW_UNVERIFIED');assert.equal(r.cleanup,'RELEASE_UNCONFIRMED_SIMULATION');assert.notEqual(r.status,'SOURCE_SIMULATION_RECORDED_NOT_OS_VALIDATED');
});

test('await 중 원 요청 변조는 source lease 상관관계를 바꾸지 않는다',async()=>{
 const m=await import('../../../scripts/development-recovery-entry.ts');assert.equal(typeof m.simulateRecoverySourceBridge,'function');
 const f=simulationFixture();let complete:(value:any)=>void=()=>{};let acquired:any;
 f.io.simulateAcquire=async c=>{f.events.push('acquire');acquired=c;return await new Promise(resolve=>{complete=resolve;});};
 const promise=m.simulateRecoverySourceBridge(f.request,f.io);f.request.commit='c'.repeat(40);complete(f.reply(acquired,'ACQUIRED_SIMULATION'));
 const r=await promise;assert.equal(r.commit,'b'.repeat(40));assert.deepEqual(f.events,['acquire','step','release']);
});

test('P3 주입은 같은 commit의 필수4파일 선언을 요구하되 실제 runtime 완전성을 주장하지 않는다',async()=>{
 const m=await import('../../../scripts/development-recovery-entry.ts'),f=simulationFixture();
 const manifest={schemaVersion:1,commit:f.request.commit,files:['apps/server/main.ts','apps/web/dist/index.html','package.json','scripts/development-recovery-entry.ts'].map(relativePath=>({relativePath,contentHash:'a'.repeat(64),sizeBytes:1}))};
 const input={...f.request,mode:'P3',expiresAt:f.start+1800000,manifest};
 const r=await m.simulateRecoverySourceBridge(input,f.io);assert.deepEqual(f.events,['acquire','step','release']);assert.equal(r.mode,'P3');assert.equal(r.runtimeCoverage,'DECLARED_NOT_VERIFIED');assert.equal(r.executionAuthorized,false);
 const g=simulationFixture();await assert.rejects(m.simulateRecoverySourceBridge({...input,manifest:{...manifest,files:manifest.files.slice(1)}},g.io),/DEVELOPMENT_RECOVERY_SOURCE_BRIDGE_INVALID/);assert.deepEqual(g.events,[]);
 const h=simulationFixture();h.io.simulateRelease=async()=>{h.events.push('release');throw Error('FAKE_ACK_LOST');};
 const lost=await m.simulateRecoverySourceBridge(input,h.io);assert.equal(lost.step,'STEP_RECORDED_SIMULATION');assert.equal(lost.cleanup,'RELEASE_UNCONFIRMED_SIMULATION');assert.equal(lost.status,'SOURCE_SIMULATION_UNCONFIRMED');assert.deepEqual(h.events,['acquire','step','release']);
});

test('host의 고정 binding 키 별칭도 canonical 필드로 가장하지 못한다',{skip:process.platform!=='win32'},()=>{
 const command=`$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-host.ps1'),[ref]$tokens,[ref]$errors);foreach($name in @('Get-DevelopmentRecoverySourcePlan','Read-DevelopmentRecoverySourceBinding')){$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true);. ([scriptblock]::Create($f.Extent.Text))};$now=[datetimeoffset]'2026-10-25T00:00:00Z';$inputCopy=@{mode='P2';Commit=('a'*40);runId='source-01';issuedAt=$now.ToString('o');expiresAt=$now.AddMinutes(10).ToString('o')};$denied=$false;try{Read-DevelopmentRecoverySourceBinding $inputCopy $now|Out-Null}catch{$denied=$_.Exception.Message -eq 'DEVELOPMENT_RECOVERY_BINDING_INVALID'};@{denied=$denied}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{denied:true});
});
