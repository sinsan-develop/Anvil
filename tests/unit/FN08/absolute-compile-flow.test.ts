import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync,spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
const ps='C:\\Program Files\\PowerShell\\7\\pwsh.exe';
const script=String.raw`$ErrorActionPreference='Stop';$path=Join-Path (Get-Location).Path 'scripts/source-read-absolute-flow.ps1';if(!(Test-Path -LiteralPath $path)){@{missing=$true}|ConvertTo-Json -Compress;exit 0};. $path;$v=ConvertFrom-Json -AsHashtable -DateKind String ([Console]::In.ReadToEnd());if($v.mode -eq 'binding'){try{$r=Read-A3AbsoluteBinding $v.binding ([datetimeoffset]$v.now);@{ok=$true;runId=$r.runId;executionAuthorized=$false}|ConvertTo-Json -Compress}catch{@{ok=$false;code='A3_BINDING_INVALID'}|ConvertTo-Json -Compress}}else{$a=[IO.MemoryStream]::new([byte[]]$v.stdout);$b=[IO.MemoryStream]::new([byte[]]$v.stderr);try{$r=Read-A3BoundedBytes $a $b 1000;@{complete=$r.complete;limitHit=$r.limitHit;count=($r.stdout.Length+$r.stderr.Length);stdout=@($r.stdout);stderr=@($r.stderr)}|ConvertTo-Json -Compress -Depth 8}finally{$a.Dispose();$b.Dispose()}}`;
const run=(value:unknown)=>JSON.parse(execFileSync(ps,['-NoProfile','-NonInteractive','-Command',script],{input:JSON.stringify(value),encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:200000}));
const binding={decisionId:'A3_ABSOLUTE_SOURCE_COMPILE_01',runId:'a3-absolute-source-compile-01',commit:'a'.repeat(40),scriptHash:'b'.repeat(64),issuedAt:'2026-10-18T03:30:00Z',expiresAt:'2026-10-18T04:00:00Z'};
test('새 exact 실행 결박의 유한창만 검사하며 caller 입력을 외부 승인으로 승격하지 않는다',()=>{
 const r=run({mode:'binding',binding,now:'2026-10-18T03:40:00Z'});assert.equal(r.missing,undefined);assert.deepEqual(r,{ok:true,runId:'a3-absolute-source-compile-01',executionAuthorized:false});
 for(const patch of[{decisionId:'OLD_APPROVAL'},{runId:'retry'},{commit:'main'},{scriptHash:'x'},{expiresAt:'2026-10-18T04:00:01Z'},{issuedAt:'2026-10-18T03:50:00Z'},{expiresAt:'2026-10-18T03:41:00Z'},{execute:true}])assert.deepEqual(run({mode:'binding',binding:{...binding,...patch},now:'2026-10-18T03:40:00Z'}),{ok:false,code:'A3_BINDING_INVALID'});
});
test('합성 streams의 비UTF8 bytes·빈 EOF와 합16KiB 상한을 보존하고 실제 compiler는 호출하지 않는다',()=>{
 const r=run({mode:'capture',stdout:[255,0,128],stderr:[13,10]});assert.equal(r.missing,undefined);assert.deepEqual(r,{complete:true,limitHit:false,count:5,stdout:[255,0,128],stderr:[13,10]});
 const empty=run({mode:'capture',stdout:[],stderr:[]});assert.equal(empty.complete,true);assert.equal(empty.count,0);
 const limited=run({mode:'capture',stdout:Array(20000).fill(65),stderr:[66]});assert.equal(limited.complete,false);assert.equal(limited.limitHit,true);assert.equal(limited.count,16384);
});
test('실제 실행기는 Plan만으로 소비·QA·compiler를 만들지 않고 미결박 Apply는 mutation 전에 거절한다',()=>{
 const path=new URL('../../../scripts/run-source-read-absolute-compile.ps1',import.meta.url);assert.equal(existsSync(path),true);
 const file=decodeURIComponent(path.pathname).replace(/^\/([A-Za-z]:)/,'$1');
 const plan=spawnSync(ps,['-NoProfile','-NonInteractive','-File',file,'-Plan'],{encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:65536});assert.equal(plan.status,0);const value=JSON.parse(plan.stdout);assert.equal(value.mode,'PLAN');assert.equal(value.processStarted,false);assert.equal(value.oneUseConsumed,false);assert.equal(value.qaCreated,false);assert.equal(value.executionAuthorized,false);
 const qa='D:\\Project\\Anvil\\.av3-data\\a3-absolute-source-compile-01-qa';
 assert.deepEqual(value.layout?.directories,[qa+'\\bin',qa+'\\temp']);assert.deepEqual(value.layout.privatePaths,[value.receiptProposed,qa,qa+'\\bin',qa+'\\temp']);assert.deepEqual(value.layout.expectedHeads,['0'.repeat(40)+'\trefs/heads/codex/av3-stage-b','f976ed5e29e14b13e12729d5b1ccf98f050f2210\trefs/heads/main']);
 const invalid=spawnSync(ps,['-NoProfile','-NonInteractive','-File',file,'-Apply'],{encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:65536});assert.equal(invalid.status,1);assert.deepEqual(JSON.parse(invalid.stdout),{status:'FAIL_BEFORE_MUTATION',failure:'A3_BINDING_INVALID',processStarted:false,oneUseConsumed:false,qaCreated:false,executionAuthorized:false});
});
test('소유자 일치만으로 넓은 ACL을 수용하지 않고 본인·SYSTEM의 정확 허용만 인정한다',()=>{
 const command=String.raw`. ./scripts/source-read-absolute-flow.ps1;if(!(Get-Command Test-A3PrivateAclFacts -ErrorAction SilentlyContinue)){@{missing=$true}|ConvertTo-Json -Compress;exit 0};$v=ConvertFrom-Json -AsHashtable ([Console]::In.ReadToEnd());@{private=(Test-A3PrivateAclFacts $v.owner $v.current $v.rules)}|ConvertTo-Json -Compress`;
 const rules=[{sid:'S-1-5-21-1',type:'Allow',rights:2032127},{sid:'S-1-5-18',type:'Allow',rights:2032127}];
 const acl=(owner:string,entries:unknown[])=>JSON.parse(execFileSync(ps,['-NoProfile','-NonInteractive','-Command',command],{input:JSON.stringify({owner,current:'S-1-5-21-1',rules:entries}),encoding:'utf8',windowsHide:true,timeout:10000}));
 assert.deepEqual(acl('S-1-5-21-1',rules),{private:true});assert.deepEqual(acl('S-1-5-21-2',rules),{private:false});assert.deepEqual(acl('S-1-5-21-1',[...rules,{sid:'S-1-1-0',type:'Allow',rights:2}]),{private:false});assert.deepEqual(acl('S-1-5-21-1',[...rules,{sid:'S-1-1-0',type:'Allow',rights:1}]),{private:false});
});
test('취소를 늦게 처리하는 합성 Stream은 완료 전 버퍼를 지우지 않고 마지막 읽기 뒤에 zero한다',()=>{
 const command=String.raw`class DelayedA3Stream : System.IO.Stream {
 [System.Threading.Tasks.TaskCompletionSource[int]]$Pending=[System.Threading.Tasks.TaskCompletionSource[int]]::new()
 [byte[]]$Buffer
 [bool]get_CanRead(){return $true}
 [bool]get_CanSeek(){return $false}
 [bool]get_CanWrite(){return $false}
 [long]get_Length(){return 0}
 [long]get_Position(){return 0}
 [void]set_Position([long]$v){}
 [void]Flush(){}
 [int]Read([byte[]]$b,[int]$o,[int]$n){throw 'SYNC_UNUSED'}
 [long]Seek([long]$o,[System.IO.SeekOrigin]$s){throw 'SEEK_UNUSED'}
 [void]SetLength([long]$v){throw 'WRITE_UNUSED'}
 [void]Write([byte[]]$b,[int]$o,[int]$n){throw 'WRITE_UNUSED'}
 [System.Threading.Tasks.Task[int]]ReadAsync([byte[]]$b,[int]$o,[int]$n,[System.Threading.CancellationToken]$token){$this.Buffer=$b;$b[0]=42;return $this.Pending.Task}
 [void]Release(){$this.Buffer[0]=255;$this.Pending.SetResult(1)}
}
 $ErrorActionPreference='Stop';. ./scripts/source-read-absolute-flow.ps1;$slow=[DelayedA3Stream]::new();$empty=[IO.MemoryStream]::new();try{$r=Read-A3BoundedBytes $slow $empty 20;$before=$slow.Buffer[0];$hasCleanup=$r.ContainsKey('cleanup');$pending=if($hasCleanup){!$r.cleanup.complete}else{$false};$slow.Release();$finished=if($hasCleanup){Complete-A3CaptureCleanup $r.cleanup}else{$false};@{before=$before;pending=$pending;finished=$finished;after=$slow.Buffer[0]}|ConvertTo-Json -Compress}finally{$empty.Dispose();$slow.Dispose()}`;
 const result=JSON.parse(execFileSync(ps,['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:65536}));assert.deepEqual(result,{before:42,pending:true,finished:true,after:0});
});
test('소비 flush 또는 QA 준비 중 만료되면 다음 단계와 catalog를 시작하지 않는다',()=>{
 const command=String.raw`$ErrorActionPreference='Stop';. ./scripts/source-read-absolute-flow.ps1;if(!(Get-Command Invoke-A3PreparationStages -ErrorAction SilentlyContinue)){@{missing=$true}|ConvertTo-Json -Compress;exit 0};$results=@();foreach($where in @('consume','qa')){$state=@{expired=$false;checks=0;consumed=0;qa=0;catalog=0;failed=$false};try{Invoke-A3PreparationStages -CheckDeadline {$state.checks++;if($state.expired){throw 'EXPIRED'}} -Consume {$state.consumed++;if($where -eq 'consume'){$state.expired=$true}} -CreateQa {$state.qa++;$state.expired=$true} -CollectCatalog {$state.catalog++}}catch{$state.failed=$true};$results+=$state};ConvertTo-Json -InputObject $results -Compress`;
 const result=JSON.parse(execFileSync(ps,['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true,timeout:10000}));assert.deepEqual(result,[{expired:true,checks:2,consumed:1,qa:0,catalog:0,failed:true},{expired:true,checks:3,consumed:1,qa:1,catalog:0,failed:true}]);
});
test('빠른 종료·PID/start 일치도 실제 exe 미관측이면 정리 소유권으로 인정하지 않는다',()=>{
 const command=String.raw`$ErrorActionPreference='Stop';. ./scripts/source-read-absolute-flow.ps1;if(!(Get-Command Test-A3CompilerIdentityFacts -ErrorAction SilentlyContinue)){@{missing=$true}|ConvertTo-Json -Compress;exit 0};$p=@{pid=123;ticks=456};$v=@{pid=123;exeObserved=$true;exe='C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe';hasExited=$true};$good=Test-A3CompilerIdentityFacts $p $v;$v.exeObserved=$false;$unobserved=Test-A3CompilerIdentityFacts $p $v;$v.exeObserved=$true;$v.exe='C:\other.exe';$wrong=Test-A3CompilerIdentityFacts $p $v;@{good=$good;unobserved=$unobserved;wrong=$wrong;missing=(Test-A3CompilerIdentityFacts $p $null)}|ConvertTo-Json -Compress`;
 const result=JSON.parse(execFileSync(ps,['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true,timeout:10000}));assert.deepEqual(result,{good:true,unobserved:false,wrong:false,missing:false});
});
