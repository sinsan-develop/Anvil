import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {test} from 'node:test';

function r0PowerShell(body:string){
 const load=`$ErrorActionPreference='Stop';$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-host.ps1'),[ref]$t,[ref]$e);if($e.Count){throw 'PS_PARSE_FAILED'};foreach($f in $ast.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -like '*DevelopmentRecoveryR0*'},$true)){. ([scriptblock]::Create($f.Extent.Text))};`;
 return JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',load+body],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}));
}

test('R0 진입은 raw source나 caller 자료로 첫 I/O 전 고정 차단을 해제하지 않는다',{skip:process.platform!=='win32'},()=>{
 const actual=r0PowerShell(`$script:io=0;function Get-Item {$script:io++;throw 'IO_MUST_NOT_RUN'};$blocked=$false;try{Invoke-DevelopmentRecoveryR0CompileSource -GitSourceBytes ([byte[]]@(1,2,3))|Out-Null}catch{$blocked=$_.Exception.Message -eq 'DEVELOPMENT_RECOVERY_R0_NOT_AUTHORIZED'};@{blocked=$blocked;io=$script:io;loaded=$null -ne ('DevelopmentRecoveryQaHost' -as [type])}|ConvertTo-Json -Compress`);
 assert.deepEqual(actual,{blocked:true,io:0,loaded:false});
});

test('R0 예산은 compiler 480초·전체600초와 UTC/단조 역행을 실제 소비한다',{skip:process.platform!=='win32'},()=>{
 const actual=r0PowerShell(`$start=[datetimeoffset]'2026-10-25T00:00:00Z';$s=New-DevelopmentRecoveryR0Budget $start 100;$a=Get-DevelopmentRecoveryR0Budget $s $start.AddMilliseconds(479999) 480099;$b=Get-DevelopmentRecoveryR0Budget $s $start.AddMilliseconds(480000) 480100;$c=Get-DevelopmentRecoveryR0Budget $s $start.AddMilliseconds(600000) 600100;$bad=0;foreach($pair in @(@($start.AddMilliseconds(599999),600101),@($start.AddMilliseconds(600001),600099))){try{Get-DevelopmentRecoveryR0Budget $s $pair[0] $pair[1]|Out-Null}catch{$bad++}};@{before=$a.compilerRemainingMs;compiler=$b.compilerRemainingMs;cleanup=$b.totalRemainingMs;end=$c.totalRemainingMs;bad=$bad}|ConvertTo-Json -Compress`);
 assert.deepEqual(actual,{before:1,compiler:0,cleanup:120000,end:0,bad:2});
});

test('R0 read fault 회수는 원 확보·기존 요청·종료 관측을 소비하고 EOF와 보존을 섞지 않는다',{skip:process.platform!=='win32'},()=>{
 const actual=r0PowerShell(`$results=@();foreach($case in @(@{name='captured';captured=$true;requested=$false;exited=$false;deadline=$null},@{name='startUnknown';captured=$false;requested=$false;exited=$false;deadline=$null},@{name='alreadyRequested';captured=$true;requested=$true;exited=$false;deadline=16000L},@{name='exitObserved';captured=$true;requested=$false;exited=$true;deadline=$null})){$s=@{killAttempted=$case.requested;exitObserved=$case.exited;terminationDeadlineMono=$case.deadline;cleanup='PRESERVED_UNCONFIRMED';stdoutEof=$false;stderrEof=$false;readFault=$true};$requests=0;$a=Get-DevelopmentRecoveryR0FailureAction $s $case.captured 1000 120000;if($a.requestTermination){$requests++};$results+=@{name=$case.name;requests=$requests;observe=$a.observe;preserve=$a.preserve;stdout=$s.stdoutEof;stderr=$s.stderrEof;deadline=$s.terminationDeadlineMono;cleanup=$s.cleanup}};$results|ConvertTo-Json -Depth 4 -Compress`);
 assert.deepEqual(actual,[
  {name:'captured',requests:1,observe:true,preserve:true,stdout:false,stderr:false,deadline:16000,cleanup:'PRESERVED_UNCONFIRMED'},
  {name:'startUnknown',requests:0,observe:false,preserve:true,stdout:false,stderr:false,deadline:null,cleanup:'PRESERVED_UNCONFIRMED'},
  {name:'alreadyRequested',requests:0,observe:true,preserve:true,stdout:false,stderr:false,deadline:16000,cleanup:'PRESERVED_UNCONFIRMED'},
  {name:'exitObserved',requests:0,observe:false,preserve:true,stdout:false,stderr:false,deadline:null,cleanup:'PRESERVED_UNCONFIRMED'},
 ]);
});

test('R0 read fault 회수는 최대15초·남은 전체예산을 연장하지 않고 중복 종료를 요청하지 않는다',{skip:process.platform!=='win32'},()=>{
 const actual=r0PowerShell(`$s=@{killAttempted=$false;exitObserved=$false;terminationDeadlineMono=$null;cleanup='PRESERVED_UNCONFIRMED';stdoutEof=$false;stderrEof=$false};$requests=0;$seen=@();foreach($now in @(1000L,1001L,15999L,16000L,17000L)){$a=Get-DevelopmentRecoveryR0FailureAction $s $true $now 100000;if($a.requestTermination){$requests++};$seen+=@{observe=$a.observe;wait=$a.waitMs}};$short=@{killAttempted=$false;exitObserved=$false;terminationDeadlineMono=$null;cleanup='PRESERVED_UNCONFIRMED';stdoutEof=$false;stderrEof=$false};$first=Get-DevelopmentRecoveryR0FailureAction $short $true 1000 3000;$end=Get-DevelopmentRecoveryR0FailureAction $short $true 4000 0;@{requests=$requests;deadline=$s.terminationDeadlineMono;seen=$seen;shortDeadline=$short.terminationDeadlineMono;shortRequest=$first.requestTermination;expiredRequest=$end.requestTermination;expiredObserve=$end.observe;stdout=$s.stdoutEof;stderr=$s.stderrEof;preserve=$end.preserve}|ConvertTo-Json -Depth 4 -Compress`);
 assert.deepEqual(actual,{requests:1,deadline:16000,seen:[{observe:true,wait:10},{observe:true,wait:10},{observe:true,wait:1},{observe:false,wait:0},{observe:false,wait:0}],shortDeadline:4000,shortRequest:true,expiredRequest:false,expiredObserve:false,stdout:false,stderr:false,preserve:true});
});

test('R0 진단은 분할 stream의 ID/줄번호만 남기고 긴 비밀본문도 유한 메모리로 drain한다',{skip:process.platform!=='win32'},()=>{
 const actual=r0PowerShell(`$s=New-DevelopmentRecoveryR0DiagnosticState;$a=[Text.Encoding]::UTF8.GetBytes('source.cs(12,4): error CS1002: PRIVATE_SECRET');Add-DevelopmentRecoveryR0DiagnosticBytes $s 'stdout' $a 0 17;Add-DevelopmentRecoveryR0DiagnosticBytes $s 'stdout' $a 17 ($a.Length-17);$tail=[Text.Encoding]::UTF8.GetBytes(([string][char]10)+('PRIVATE_SECRET'*800)+([string][char]10));Add-DevelopmentRecoveryR0DiagnosticBytes $s 'stdout' $tail 0 $tail.Length;Complete-DevelopmentRecoveryR0DiagnosticStream $s 'stdout';Complete-DevelopmentRecoveryR0DiagnosticStream $s 'stderr';$r=ConvertTo-DevelopmentRecoveryR0Diagnostics $s 1 20 'COMPILE_FAILED' 'PRESERVED_UNCONFIRMED';$json=$r.json;@{id=$r.value.entries[0].errorId;line=$r.value.entries[0].line;secret=$json.Contains('PRIVATE_SECRET');bytes=$r.value.stdout.bytes;lines=$r.value.stdout.lines;oversize=$r.value.stdout.oversizeLines;size=[Text.Encoding]::UTF8.GetByteCount($json);hash=$r.value.stdout.sha256;stderr=$r.value.stderr.sha256}|ConvertTo-Json -Compress`);
 assert.equal(actual.id,'CS1002');assert.equal(actual.line,12);assert.equal(actual.secret,false);assert.equal(actual.lines,2);assert.equal(actual.oversize,1);assert.ok(actual.size<=65536);assert.match(actual.hash,/^[A-F0-9]{64}$/);assert.equal(actual.stderr,'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855');assert.ok(actual.bytes>1024);
});

test('R0 locale 진단은 한글·영문·분할 UTF8에서 CS ID와 줄번호만 같은 방식으로 추출한다',{skip:process.platform!=='win32'},()=>{
 const actual=r0PowerShell(`$results=@();foreach($case in @(@{prefix='error';split=$false},@{prefix='warning';split=$false},@{prefix='오류';split=$false},@{prefix='오류';split=$true})){$s=New-DevelopmentRecoveryR0DiagnosticState;$bytes=[Text.Encoding]::UTF8.GetBytes('source.cs(12,4): '+$case.prefix+' CS1002: PRIVATE_SECRET'+([string][char]10));if($case.split){for($i=0;$i -lt $bytes.Length;$i++){Add-DevelopmentRecoveryR0DiagnosticBytes $s 'stderr' $bytes $i 1}}else{Add-DevelopmentRecoveryR0DiagnosticBytes $s 'stderr' $bytes 0 $bytes.Length};Complete-DevelopmentRecoveryR0DiagnosticStream $s 'stdout';Complete-DevelopmentRecoveryR0DiagnosticStream $s 'stderr';$r=ConvertTo-DevelopmentRecoveryR0Diagnostics $s 7 30 'COMPILE_FAILED' 'PRESERVED_UNCONFIRMED';$results+=@{id=$r.value.entries[0].errorId;line=$r.value.entries[0].line;count=$r.value.entries.Count;bytes=$r.value.stderr.bytes;lines=$r.value.stderr.lines;secret=$r.json.Contains('PRIVATE_SECRET');path=$r.json.Contains('source.cs');truncated=$r.value.truncated;exit=$r.value.exitCode;cleanup=$r.value.cleanup;authorized=$r.value.executionAuthorized}};$results|ConvertTo-Json -Depth 4 -Compress`);
 const expected=(bytes:number)=>({id:'CS1002',line:12,count:1,bytes,lines:1,secret:false,path:false,truncated:false,exit:7,cleanup:'PRESERVED_UNCONFIRMED',authorized:false});
 assert.deepEqual(actual,[expected(46),expected(48),expected(47),expected(47)]);
});

test('R0 locale 진단은 1024바이트를 넘는 한글 비밀문장도 초과표식과 ID만 보관하고 끝까지 drain한다',{skip:process.platform!=='win32'},()=>{
 const actual=r0PowerShell(`$s=New-DevelopmentRecoveryR0DiagnosticState;$bytes=[Text.Encoding]::UTF8.GetBytes('source.cs(99): 오류 CS1002: '+('비밀_PRIVATE_SECRET'*1000)+([string][char]10));Add-DevelopmentRecoveryR0DiagnosticBytes $s 'stderr' $bytes 0 15;Add-DevelopmentRecoveryR0DiagnosticBytes $s 'stderr' $bytes 15 ($bytes.Length-15);Complete-DevelopmentRecoveryR0DiagnosticStream $s 'stdout';Complete-DevelopmentRecoveryR0DiagnosticStream $s 'stderr';$r=ConvertTo-DevelopmentRecoveryR0Diagnostics $s 7 40 'COMPILE_FAILED' 'PRESERVED_UNCONFIRMED';@{id=$r.value.entries[0].errorId;line=$r.value.entries[0].line;entryOversize=$r.value.entries[0].oversize;oversizeLines=$r.value.stderr.oversizeLines;truncated=$r.value.truncated;bytes=$r.value.stderr.bytes;lines=$r.value.stderr.lines;secret=$r.json.Contains('PRIVATE_SECRET');path=$r.json.Contains('source.cs');hash=$r.value.stderr.sha256;size=[Text.Encoding]::UTF8.GetByteCount($r.json);jsonLines=$r.json.Split([char]10).Length;exit=$r.value.exitCode;cleanup=$r.value.cleanup}|ConvertTo-Json -Compress`);
 assert.equal(actual.id,'CS1002');assert.equal(actual.line,99);assert.equal(actual.entryOversize,true);assert.equal(actual.oversizeLines,1);assert.equal(actual.truncated,true);assert.ok(actual.bytes>20000);assert.equal(actual.lines,1);assert.equal(actual.secret,false);assert.equal(actual.path,false);assert.match(actual.hash,/^[A-F0-9]{64}$/);assert.ok(actual.size<=65536);assert.ok(actual.jsonLines<=256);assert.equal(actual.exit,7);assert.equal(actual.cleanup,'PRESERVED_UNCONFIRMED');
});

test('R0 제한 초과 뒤에도 두 stream byte/hash를 보존하고 원문과 초과행을 저장하지 않는다',{skip:process.platform!=='win32'},()=>{
 const actual=r0PowerShell(`$s=New-DevelopmentRecoveryR0DiagnosticState;$a=[Text.Encoding]::UTF8.GetBytes('x.cs(2): warning CS0168: SECRET'+([string][char]10));for($i=0;$i -lt 300;$i++){Add-DevelopmentRecoveryR0DiagnosticBytes $s 'stderr' $a 0 $a.Length};Complete-DevelopmentRecoveryR0DiagnosticStream $s 'stdout';Complete-DevelopmentRecoveryR0DiagnosticStream $s 'stderr';$r=ConvertTo-DevelopmentRecoveryR0Diagnostics $s 0 50 'COMPILE_RETURNED_NOT_OS_VALIDATED' 'PRESERVED_UNCONFIRMED';@{count=$r.value.entries.Count;omitted=$r.value.omittedRecords;bytes=$r.value.stderr.bytes;lines=$r.value.stderr.lines;secret=$r.json.Contains('SECRET');size=[Text.Encoding]::UTF8.GetByteCount($r.json);newline=($r.json.Split([char]10).Length)}|ConvertTo-Json -Compress`);
 assert.equal(actual.count,200);assert.equal(actual.omitted,100);assert.equal(actual.lines,300);assert.equal(actual.secret,false);assert.ok(actual.bytes>9000);assert.ok(actual.size<=65536);assert.ok(actual.newline<=256);
});

test('R0 불명 보관함은 재 dot-source 후에도 원 one-shot을 다시 열지 않는다',{skip:process.platform!=='win32'},()=>{
 const actual=r0PowerShell(`. ./scripts/development-recovery-host.ps1;$original=$script:DevelopmentRecoveryR0Retain;& $script:DevelopmentRecoveryR0Retain 'BEGIN' $null;& $script:DevelopmentRecoveryR0Retain 'RETAIN' ([pscustomobject]@{kind='PURE_RETENTION_TEST'});. ./scripts/development-recovery-host.ps1;$blocked=$false;try{& $script:DevelopmentRecoveryR0Retain 'BEGIN' $null}catch{$blocked=$_.Exception.Message -eq 'DEVELOPMENT_RECOVERY_R0_ALREADY_ATTEMPTED'};@{same=[object]::ReferenceEquals($original,$script:DevelopmentRecoveryR0Retain);blocked=$blocked}|ConvertTo-Json -Compress`);
 assert.deepEqual(actual,{same:true,blocked:true});
});

test('R0 raw 바이트는 고정 크기라도 SHA256/Gitblob 불일치면 원문 출력 없이 거절한다',{skip:process.platform!=='win32'},()=>{
 const actual=r0PowerShell(`$bad=0;foreach($bytes in @(([byte[]]::new(3)),([byte[]]::new(96953)))){try{Copy-DevelopmentRecoveryR0Source $bytes|Out-Null}catch{if($_.Exception.Message -eq 'DEVELOPMENT_RECOVERY_R0_SOURCE_INVALID'){$bad++}}};@{bad=$bad}|ConvertTo-Json -Compress`);
 assert.deepEqual(actual,{bad:2});
});

test('R0 실제 I/O helper는 고정 차단 앞에서 독립 write 진입으로 노출되지 않는다',{skip:process.platform!=='win32'},()=>{
 const command=`$ErrorActionPreference='Stop';. ./scripts/development-recovery-host.ps1;$names=@('Get-DevelopmentRecoveryR0PathObservation','Assert-DevelopmentRecoveryR0PathObservation','Get-DevelopmentRecoveryR0StreamDigest','Write-DevelopmentRecoveryR0OwnedDiagnostics');$exposed=0;foreach($name in $names){if(Get-Command $name -CommandType Function -ErrorAction Ignore){$exposed++}};@{exposed=$exposed}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{exposed:0});
});

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

test('PS 요청 대조는 마지막 LF가 붙은 run·commit 별칭을 거절한다',{skip:process.platform!=='win32'},()=>{
 const command=`$now=[datetimeoffset]'2026-10-25T00:00:00Z';foreach($file in @('scripts/development-recovery-host.ps1','scripts/development-recovery-os-qa.ps1')){$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) $file),[ref]$t,[ref]$e);foreach($name in @('Get-DevelopmentRecoverySourcePlan','Read-DevelopmentRecoverySourceBinding','Read-DevelopmentRecoveryQaSourceBinding')){$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true);if($f){. ([scriptblock]::Create($f.Extent.Text))}}};$bad=0;foreach($mode in @('P2','R1')){$value=@{mode=$mode;commit=('b'*40);runId=$(if($mode -eq 'P2'){'source-01'}else{'r1-source-01'});issuedAt=$now.ToString('o');expiresAt=$now.AddMinutes(10).ToString('o')};foreach($field in @('commit','runId')){$copy=$value.Clone();$copy[$field]+=[char]10;try{if($mode -eq 'P2'){Read-DevelopmentRecoverySourceBinding $copy $now|Out-Null}else{Read-DevelopmentRecoveryQaSourceBinding $copy $now|Out-Null}}catch{$bad++}}};@{bad=$bad}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\\\Program Files\\\\PowerShell\\\\7\\\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{bad:4});
});

test('TS 요청·선언 digest도 마지막 줄바꿈 별칭을 거절한다',async()=>{
 const m=await import('../../../scripts/development-recovery-entry.ts');
 const value={schemaVersion:1,commit:'b'.repeat(40),files:[{relativePath:'apps/server/main.ts',contentHash:'a'.repeat(64),sizeBytes:1}]};
 assert.throws(()=>m.prepareRecoveryManifest({...value,commit:value.commit+'\n'}),/DEVELOPMENT_RECOVERY_MANIFEST_INVALID/);
 assert.throws(()=>m.prepareRecoveryManifest({...value,files:[{...value.files[0]!,contentHash:value.files[0]!.contentHash+'\n'}]}),/DEVELOPMENT_RECOVERY_MANIFEST_INVALID/);
 for(const field of ['runId','commit'] as const){const f=simulationFixture();await assert.rejects(m.simulateRecoverySourceBridge({...f.request,[field]:f.request[field]+'\n'},f.io));assert.deepEqual(f.events,[]);}
});

test('assembly loader 진입은 digest 주장만으로 파일 접근이나 타입 로딩을 시작하지 않는다',{skip:process.platform!=='win32'},()=>{
 const command=`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-host.ps1'),[ref]$t,[ref]$e);$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'New-DevelopmentRecoveryQaHostFromAssembly'},$true);if(!$f){throw 'OWNED_ASSEMBLY_LOADER_MISSING'};. ([scriptblock]::Create($f.Extent.Text));$blocked=0;foreach($hash in @('',('A'*64),'claimed')){try{New-DevelopmentRecoveryQaHostFromAssembly 'OUTSIDE_WRITE' 'r1-loader-source' ('b'*40) ([datetime]'2026-10-25T00:00:00Z') ([datetime]'2026-10-25T00:30:00Z') $hash|Out-Null}catch{if(!$_.Exception.ToString().Contains('DEVELOPMENT_RECOVERY_OS_QA_NOT_AUTHORIZED')){throw};$blocked++}};@{blocked=$blocked;nativeTypeLoaded=$null -ne ('DevelopmentRecoveryQaHost' -as [type])}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\\\Program Files\\\\PowerShell\\\\7\\\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{blocked:3,nativeTypeLoaded:false});
});

test('원 소유 host 진입은 함수 재정의와 요청 정보로 native factory를 열지 못한다',{skip:process.platform!=='win32'},()=>{
 const command=`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-host.ps1'),[ref]$t,[ref]$e);$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Invoke-DevelopmentRecoveryQaOwnedHost'},$true);if(!$f){throw 'OWNED_HOST_ENTRY_MISSING'};. ([scriptblock]::Create($f.Extent.Text));function Assert-DevelopmentRecoveryOsQaExecution{return $true};$blocked=$false;try{Invoke-DevelopmentRecoveryQaOwnedHost 'OUTSIDE_WRITE' 'r1-source-host' ('b'*40) ([datetime]'2026-10-25T00:00:00Z') ([datetime]'2026-10-25T00:30:00Z')|Out-Null}catch{$blocked=$_.Exception.ToString().Contains('DEVELOPMENT_RECOVERY_OS_QA_NOT_AUTHORIZED')};@{blocked=$blocked;nativeTypeLoaded=$null -ne ('DevelopmentRecoveryQaHost' -as [type])}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\\\Program Files\\\\PowerShell\\\\7\\\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{blocked:true,nativeTypeLoaded:false});
});

test('원 factory 소유자 연결도 생성 때 객체를 읽지 않고 네 동작을 먼저 차단한다',{skip:process.platform!=='win32'},()=>{
 const command=`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-os-qa.ps1'),[ref]$t,[ref]$e);$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'New-DevelopmentRecoveryOsQaFilesystemAdapter'},$true);. ([scriptblock]::Create($f.Extent.Text));$script:reads=0;$owner=[pscustomobject]@{};$owner|Add-Member ScriptProperty BindingFacts {$script:reads++;throw 'OWNER_READ'};$adapter=New-DevelopmentRecoveryOsQaFilesystemAdapter $owner;$blocked=0;foreach($method in @('Prepare','Mutate','Cleanup','ObserveFailure')){try{if($method -eq 'Prepare'){$adapter.$method()|Out-Null}else{$adapter.$method('HARD_LINK')|Out-Null}}catch{if(!$_.Exception.ToString().Contains('DEVELOPMENT_RECOVERY_OS_QA_NOT_AUTHORIZED')){throw};$blocked++}};@{same=[object]::ReferenceEquals($adapter.OwnedOwner,$owner);rawLease=$null -ne $adapter.PSObject.Properties['OwnedLease'];blocked=$blocked;reads=$script:reads;authorized=$adapter.executionAuthorized}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\\\Program Files\\\\PowerShell\\\\7\\\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{same:true,rawLease:false,blocked:4,reads:0,authorized:false});
});

test('실파일 변경 adapter 후보는 생성 시 I/O 없이 실제 호출 6종을 모두 실행 선행에서 차단한다',{skip:process.platform!=='win32'},()=>{
 const command=`$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-os-qa.ps1'),[ref]$tokens,[ref]$errors);foreach($name in @('Assert-DevelopmentRecoveryOsQaExecution','New-DevelopmentRecoveryOsQaFilesystemAdapter')){$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true);if(!$f){throw 'FILESYSTEM_ADAPTER_MISSING'};. ([scriptblock]::Create($f.Extent.Text))};$adapter=New-DevelopmentRecoveryOsQaFilesystemAdapter;$blocked=0;foreach($case in @('PARENT_REPLACEMENT','REPARSE_CHILD','OUTSIDE_WRITE','FILE_ID_CHANGED','HARD_LINK','DACL_CHANGED')){try{$adapter.Mutate($case)|Out-Null;throw 'UNEXPECTED_EXECUTION'}catch{if($_.Exception.ToString() -notmatch 'DEVELOPMENT_RECOVERY_OS_QA_NOT_AUTHORIZED'){throw};$blocked++}};@{blocked=$blocked;nativeVerified=$adapter.nativeVerified;executionAuthorized=$adapter.executionAuthorized}|ConvertTo-Json -Compress`;
 const output=execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']});
 assert.deepEqual(JSON.parse(output),{blocked:6,nativeVerified:false,executionAuthorized:false});
});

test('동적 gate 함수 재정의로 실제 mutation 본문에 도달하지 않는다',{skip:process.platform!=='win32'},()=>{
 const command=`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-os-qa.ps1'),[ref]$t,[ref]$e);foreach($name in @('Assert-DevelopmentRecoveryOsQaExecution','New-DevelopmentRecoveryOsQaFilesystemAdapter')){$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true);. ([scriptblock]::Create($f.Extent.Text))};$adapter=New-DevelopmentRecoveryOsQaFilesystemAdapter;function Assert-DevelopmentRecoveryOsQaExecution {throw 'FAKE_REDEFINED_GATE'};$blocked=$false;try{$adapter.Mutate('DACL_CHANGED')|Out-Null}catch{$blocked=$_.Exception.ToString().Contains('DEVELOPMENT_RECOVERY_OS_QA_NOT_AUTHORIZED')};@{blocked=$blocked}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{blocked:true});
});

test('R1 입력은 run·commit·30분 창만 결박하고 외부 fixture 경로·owner·handle을 채택하지 않는다',{skip:process.platform!=='win32'},()=>{
 const command=`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-os-qa.ps1'),[ref]$t,[ref]$e);$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Read-DevelopmentRecoveryQaSourceBinding'},$true);if(!$f){throw 'R1_BINDING_MISSING'};. ([scriptblock]::Create($f.Extent.Text));$now=[datetimeoffset]'2026-10-25T00:00:00Z';$value=@{mode='R1';commit=('b'*40);runId='r1-qa-01';issuedAt=$now.ToString('o');expiresAt=$now.AddMinutes(30).ToString('o')};$r=Read-DevelopmentRecoveryQaSourceBinding $value $now;$rejected=0;foreach($field in @('fixtureRoot','owner','handle')){$copy=$value.Clone();$copy[$field]='claimed';try{Read-DevelopmentRecoveryQaSourceBinding $copy $now|Out-Null}catch{$rejected++}};$copy=$value.Clone();$copy.runId='../other';try{Read-DevelopmentRecoveryQaSourceBinding $copy $now|Out-Null}catch{$rejected++};$copy=$value.Clone();$copy.expiresAt=$now.AddMinutes(31).ToString('o');try{Read-DevelopmentRecoveryQaSourceBinding $copy $now|Out-Null}catch{$rejected++};@{run=$r.runId;mode=$r.mode;authorized=$r.executionAuthorized;ownership=$r.ownership;rejected=$rejected}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{run:'r1-qa-01',mode:'R1',authorized:false,ownership:'NOT_ACQUIRED',rejected:5});
});

test('원 lease 변경 영수증은 case·행동을 대조하되 guard 합격이나 OS 검증으로 승격하지 않는다',{skip:process.platform!=='win32'},()=>{
 const command=`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-os-qa.ps1'),[ref]$t,[ref]$e);$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Read-DevelopmentRecoveryQaMutationReceipt'},$true);if(!$f){throw 'RECEIPT_READER_MISSING'};. ([scriptblock]::Create($f.Extent.Text));$v=[object[]]@('HARD_LINK','LINK_ORIGINAL_LEAF_IN_ORIGINAL_PARENT','MUTATION_ATTEMPT_RECORDED_NOT_GUARD_RESULT','00000000');$r=Read-DevelopmentRecoveryQaMutationReceipt 'HARD_LINK' $v;$bad=0;foreach($value in @(@('DACL_CHANGED',$v[1],$v[2],$v[3]),@($v[0],'OTHER_OPERATION',$v[2],$v[3]),@($v[0],$v[1],'PASS',$v[3]),@($v[0],$v[1],$v[2],'SECRET_BODY'))){try{Read-DevelopmentRecoveryQaMutationReceipt 'HARD_LINK' $value|Out-Null}catch{$bad++}};@{caseId=$r.caseId;os=$r.osVerified;guard=$r.guardVerdict;interference=$r.fixtureInterference;cleanup=$r.cleanupRequired;bad=$bad}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{caseId:'HARD_LINK',os:false,guard:'NOT_EVALUATED',interference:'UNRESOLVED',cleanup:true,bad:4});
});

test('변경 시도 기록은 native 성공코드를 요구하고 후속 검증 실패의 0코드는 실패로 보존한다',{skip:process.platform!=='win32'},()=>{
 const command=`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-os-qa.ps1'),[ref]$t,[ref]$e);$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Read-DevelopmentRecoveryQaMutationReceipt'},$true);. ([scriptblock]::Create($f.Extent.Text));$v=@('HARD_LINK','LINK_ORIGINAL_LEAF_IN_ORIGINAL_PARENT','MUTATION_ATTEMPT_RECORDED_NOT_GUARD_RESULT','00000000');$bad=0;foreach($code in @('NOT_OBSERVED','c0000022','ffffffff')){$copy=$v.Clone();$copy[3]=$code;try{Read-DevelopmentRecoveryQaMutationReceipt 'HARD_LINK' $copy|Out-Null}catch{$bad++}};$v[2]='MUTATION_UNCONFIRMED';$r=Read-DevelopmentRecoveryQaMutationReceipt 'HARD_LINK' $v;@{bad=$bad;state=$r.mutation;code=$r.nativeStatus;os=$r.osVerified;guard=$r.guardVerdict}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\\\Program Files\\\\PowerShell\\\\7\\\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{bad:3,state:'MUTATION_UNCONFIRMED',code:'00000000',os:false,guard:'NOT_EVALUATED'});
});

test('정리 영수증은 원 case·유한 상태를 대조하고 DACL 불명·부재 모순을 거절한다',{skip:process.platform!=='win32'},()=>{
 const command=`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-os-qa.ps1'),[ref]$t,[ref]$e);$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Read-DevelopmentRecoveryQaCleanupReceipt'},$true);if(!$f){throw 'CLEANUP_READER_MISSING'};. ([scriptblock]::Create($f.Extent.Text));$v=[object[]]@('DACL_CHANGED','OWNED_RUN_ABSENT_BY_ORIGINAL_PARENT_NOT_OS_VALIDATED','ORIGINAL_DACL_RESTORED_NOT_OS_VALIDATED');$r=Read-DevelopmentRecoveryQaCleanupReceipt 'DACL_CHANGED' $v;$bad=0;foreach($value in @(@('HARD_LINK',$v[1],$v[2]),@($v[0],'PASS',$v[2]),@($v[0],$v[1],'DACL_RESTORE_UNCONFIRMED_PRESERVED'),@($v[0],$v[1],'SECRET_BODY'))){try{Read-DevelopmentRecoveryQaCleanupReceipt 'DACL_CHANGED' $value|Out-Null}catch{$bad++}};@{os=$r.osVerified;residue=$r.residueVerified;guard=$r.guardVerdict;authorized=$r.executionAuthorized;bad=$bad}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{os:false,residue:false,guard:'NOT_EVALUATED',authorized:false,bad:4});
});

test('DACL 자동복구가 차단된 영수증은 보존 상태로만 소비한다',{skip:process.platform!=='win32'},()=>{
 const command=`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-os-qa.ps1'),[ref]$t,[ref]$e);$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Read-DevelopmentRecoveryQaCleanupReceipt'},$true);. ([scriptblock]::Create($f.Extent.Text));$v=[object[]]@('DACL_CHANGED','HANDLES_CLOSED_FIXTURE_PRESERVED_NOT_OS_VALIDATED','DACL_RESTORE_BLOCKED_NO_ATOMIC_COMPARE');$r=Read-DevelopmentRecoveryQaCleanupReceipt 'DACL_CHANGED' $v;$bad=$v.Clone();$bad[1]='OWNED_RUN_ABSENT_BY_ORIGINAL_PARENT_NOT_OS_VALIDATED';$rejected=$false;try{Read-DevelopmentRecoveryQaCleanupReceipt 'DACL_CHANGED' $bad|Out-Null}catch{$rejected=$true};@{dacl=$r.daclObservation;residue=$r.residueVerified;rejected=$rejected}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{dacl:'DACL_RESTORE_BLOCKED_NO_ATOMIC_COMPARE',residue:false,rejected:true});
});

test('DACL 정리의 중간상태와 삭제 전 복구실패는 삭제 결과로 소비하지 않는다',{skip:process.platform!=='win32'},()=>{
 const command=`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-os-qa.ps1'),[ref]$t,[ref]$e);$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Read-DevelopmentRecoveryQaCleanupReceipt'},$true);. ([scriptblock]::Create($f.Extent.Text));$rejected=0;foreach($cleanup in @('CLEANUP_UNCONFIRMED_PRESERVED','PENDING_DELETE_CLOSE_EFFECT_UNCONFIRMED_PRESERVED','HANDLE_CLOSE_UNCONFIRMED_FIXTURE_PRESERVED','HANDLES_CLOSED_FIXTURE_PRESERVED_NOT_OS_VALIDATED','OWNED_RUN_ABSENT_BY_ORIGINAL_PARENT_NOT_OS_VALIDATED')){try{Read-DevelopmentRecoveryQaCleanupReceipt 'DACL_CHANGED' @('DACL_CHANGED',$cleanup,'DACL_CHANGE_ATTEMPTED_RESTORE_NOT_OBSERVED')|Out-Null}catch{$rejected++}};$kept=0;foreach($dacl in @('DACL_RESTORE_UNCONFIRMED_PRESERVED','DACL_RESTORE_BLOCKED_NO_ATOMIC_COMPARE')){foreach($cleanup in @('CLEANUP_UNCONFIRMED_PRESERVED','PENDING_DELETE_CLOSE_EFFECT_UNCONFIRMED_PRESERVED','OWNED_RUN_ABSENT_BY_ORIGINAL_PARENT_NOT_OS_VALIDATED')){try{Read-DevelopmentRecoveryQaCleanupReceipt 'DACL_CHANGED' @('DACL_CHANGED',$cleanup,$dacl)|Out-Null}catch{$rejected++}};foreach($cleanup in @('HANDLE_CLOSE_UNCONFIRMED_FIXTURE_PRESERVED','HANDLES_CLOSED_FIXTURE_PRESERVED_NOT_OS_VALIDATED')){$r=Read-DevelopmentRecoveryQaCleanupReceipt 'DACL_CHANGED' @('DACL_CHANGED',$cleanup,$dacl);if(!$r.osVerified -and !$r.residueVerified -and !$r.executionAuthorized){$kept++}}};@{rejected=$rejected;kept=$kept}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\\\Program Files\\\\PowerShell\\\\7\\\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{rejected:11,kept:4});
});

test('정리 호출도 고정 실행 차단에서 거절되어 주입 객체를 만지지 않는다',{skip:process.platform!=='win32'},()=>{
 const command=`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-os-qa.ps1'),[ref]$t,[ref]$e);$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'New-DevelopmentRecoveryOsQaFilesystemAdapter'},$true);. ([scriptblock]::Create($f.Extent.Text));$fake=[pscustomobject]@{calls=0};$fake|Add-Member ScriptMethod CleanupFilesystemMutation {$this.calls++;throw 'MUST_NOT_CALL'};$adapter=New-DevelopmentRecoveryOsQaFilesystemAdapter $fake;$blocked=$false;try{$adapter.Cleanup('DACL_CHANGED')|Out-Null}catch{$blocked=$_.Exception.ToString().Contains('DEVELOPMENT_RECOVERY_OS_QA_NOT_AUTHORIZED')};@{blocked=$blocked;calls=$fake.calls}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{blocked:true,calls:0});
});

test('고정 실패 영수증은 선택·주입·획득·보존을 함께 대조하고 미주입 성공을 거절한다',{skip:process.platform!=='win32'},()=>{
 const command=`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-os-qa.ps1'),[ref]$t,[ref]$e);$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Read-DevelopmentRecoveryQaFailureReceipt'},$true);if(!$f){throw 'FAILURE_READER_MISSING'};. ([scriptblock]::Create($f.Extent.Text));$v=[object[]]@('CLEANUP_UNKNOWN','QA_INJECTED_CLEANUP_UNKNOWN_NOT_OS_VALIDATED','ORIGINAL_HANDLES_ACQUIRED_NOT_OS_VALIDATED','HANDLE_CLOSE_UNCONFIRMED_FIXTURE_PRESERVED');$r=Read-DevelopmentRecoveryQaFailureReceipt 'CLEANUP_UNKNOWN' $v;$bad=0;foreach($value in @(@('CLOCK_REVERSED',$v[1],$v[2],$v[3]),@($v[0],'NOT_INJECTED',$v[2],$v[3]),@($v[0],$v[1],$v[2],'OWNED_RUN_ABSENT_BY_ORIGINAL_PARENT_NOT_OS_VALIDATED'),@($v[0],$v[1],'PASS',$v[3]))){try{Read-DevelopmentRecoveryQaFailureReceipt 'CLEANUP_UNKNOWN' $value|Out-Null}catch{$bad++}};@{mode=$r.caseId;os=$r.osVerified;residue=$r.residueVerified;guard=$r.guardVerdict;bad=$bad}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{mode:'CLEANUP_UNKNOWN',os:false,residue:false,guard:'NOT_EVALUATED',bad:4});
});

test('시간·부분획득 실패 영수증은 정상획득으로 위장하지 못하고 미확인 보존만 기록한다',{skip:process.platform!=='win32'},()=>{
 const command=`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-os-qa.ps1'),[ref]$t,[ref]$e);$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Read-DevelopmentRecoveryQaFailureReceipt'},$true);. ([scriptblock]::Create($f.Extent.Text));$records=@();$bad=0;foreach($id in @('WINDOW_EXPIRED','CLOCK_REVERSED','PARTIAL_PIN_FAILURE')){$v=[object[]]@($id,('QA_INJECTED_'+$id+'_NOT_OS_VALIDATED'),'PARTIAL_ACQUISITION_PRESERVED_UNCONFIRMED','HANDLES_CLOSED_FIXTURE_PRESERVED_NOT_OS_VALIDATED');$r=Read-DevelopmentRecoveryQaFailureReceipt $id $v;$records+=@{id=$r.caseId;os=$r.osVerified;residue=$r.residueVerified;guard=$r.guardVerdict};$v[2]='ORIGINAL_HANDLES_ACQUIRED_NOT_OS_VALIDATED';try{Read-DevelopmentRecoveryQaFailureReceipt $id $v|Out-Null}catch{$bad++}};@{records=$records;bad=$bad}|ConvertTo-Json -Depth 4 -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{records:[{id:'WINDOW_EXPIRED',os:false,residue:false,guard:'NOT_EVALUATED'},{id:'CLOCK_REVERSED',os:false,residue:false,guard:'NOT_EVALUATED'},{id:'PARTIAL_PIN_FAILURE',os:false,residue:false,guard:'NOT_EVALUATED'}],bad:3});
});

test('고정 실패 관측 호출은 실행 차단 전에 주입 객체를 실행하지 않는다',{skip:process.platform!=='win32'},()=>{
 const command=`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-os-qa.ps1'),[ref]$t,[ref]$e);$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'New-DevelopmentRecoveryOsQaFilesystemAdapter'},$true);. ([scriptblock]::Create($f.Extent.Text));$fake=[pscustomobject]@{calls=0};$fake|Add-Member ScriptMethod CloseAndObserveInjectedFailure {$this.calls++;throw 'MUST_NOT_CALL'};$adapter=New-DevelopmentRecoveryOsQaFilesystemAdapter $fake;$blocked=$false;try{$adapter.ObserveFailure('CLEANUP_UNKNOWN')|Out-Null}catch{$blocked=$_.Exception.ToString().Contains('DEVELOPMENT_RECOVERY_OS_QA_NOT_AUTHORIZED')};@{blocked=$blocked;calls=$fake.calls}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{blocked:true,calls:0});
});

test('고정 fixture 준비 호출도 실행 차단 전에 주입 객체를 만지지 않는다',{skip:process.platform!=='win32'},()=>{
 const command=`$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/development-recovery-os-qa.ps1'),[ref]$t,[ref]$e);$f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'New-DevelopmentRecoveryOsQaFilesystemAdapter'},$true);. ([scriptblock]::Create($f.Extent.Text));$fake=[pscustomobject]@{calls=0};$fake|Add-Member ScriptMethod PrepareFilesystemCases {$this.calls++;throw 'MUST_NOT_CALL'};$adapter=New-DevelopmentRecoveryOsQaFilesystemAdapter $fake;$blocked=$false;try{$adapter.Prepare()|Out-Null}catch{$blocked=$_.Exception.ToString().Contains('DEVELOPMENT_RECOVERY_OS_QA_NOT_AUTHORIZED')};@{blocked=$blocked;calls=$fake.calls}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{blocked:true,calls:0});
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
