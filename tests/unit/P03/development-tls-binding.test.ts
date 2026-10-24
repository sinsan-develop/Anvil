import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {test} from 'node:test';

const root='D:\\Project\\Anvil\\.av3-data';
const scripts=['scripts/prepare-dev-https.ps1','scripts/start-development.ps1'];
// 실제 스크립트는 실행하지 않는다. AST에서 순수 경로/거절 함수만 추출한다.
function purePowerShell(path:string){
 const source=`$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) '${path}'),[ref]$tokens,[ref]$errors);if($errors.Count){throw 'SYNTAX'};foreach($name in @('Get-DevelopmentTlsDirectory','Assert-DevelopmentTlsExecution')){$f=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true);if(!$f){throw ('MISSING_PURE_FUNCTION:'+ $name)};. ([scriptblock]::Create($f.Extent.Text))};$a=Get-DevelopmentTlsDirectory '${root}' $false;$b=Get-DevelopmentTlsDirectory '${root}' $true;$denied=@();foreach($bad in @('D:\\other','D:\\Project\\Anvil\\.av3-data\\child')){try{Get-DevelopmentTlsDirectory $bad $true|Out-Null;$denied+=$false}catch{$denied+=($_.Exception.Message -eq 'DEVELOPMENT_TLS_ROOT_INVALID')}};Assert-DevelopmentTlsExecution $false;$blocked=$false;try{Assert-DevelopmentTlsExecution $true}catch{$blocked=$_.Exception.Message -eq 'DEVELOPMENT_TLS_RECOVERY_PROTECTION_UNVERIFIED'};@{old=$a;next=$b;denied=$denied;blocked=$blocked}|ConvertTo-Json -Compress`;
 return JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',source],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}));
}
for(const path of scripts)test(`${path}는 기존/새 고정 TLS만 산출하고 새 집행은 차단한다`,{skip:process.platform!=='win32'},()=>{
 assert.deepEqual(purePowerShell(path),{old:root+'\\dev-tls',next:root+'\\dev-tls-20261025-01',denied:[true,true],blocked:true});
});

test('HTTPS probe의 새 경로 선택은 I/O 이전 거절하며 import는 안전하다',async()=>{
 const probe=await import('../../../scripts/check-development-https.ts');
 assert.equal(probe.getDevelopmentTlsCaPath(false),root.replaceAll('\\','/')+'/dev-tls/ca.cert.pem');
 assert.equal(probe.getDevelopmentTlsCaPath(true),root.replaceAll('\\','/')+'/dev-tls-20261025-01/ca.cert.pem');
 assert.doesNotThrow(()=>probe.assertDevelopmentTlsExecution(false));
 assert.throws(()=>probe.assertDevelopmentTlsExecution(true),/DEVELOPMENT_TLS_RECOVERY_PROTECTION_UNVERIFIED/);
 assert.equal(typeof probe.checkDevelopmentHttps,'function','probe 실제 진입 흐름을 직접 검증할 수 없다');
 await assert.rejects(probe.checkDevelopmentHttps(['--recovery-tls']),/DEVELOPMENT_TLS_RECOVERY_PROTECTION_UNVERIFIED/);
 await assert.rejects(probe.checkDevelopmentHttps(['--ca=D:/other']),/DEVELOPMENT_HTTPS_ARGUMENT_INVALID/);
});

test('새 TLS는 옛 Fn08/relay 예외와 결합하지 않는다',{skip:process.platform!=='win32'},()=>{
 const command=`$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/start-development.ps1'),[ref]$tokens,[ref]$errors);if($errors.Count){throw 'SYNTAX'};$f=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Get-DevelopmentRuntimePath'},$true);. ([scriptblock]::Create($f.Extent.Text));$p=Get-DevelopmentRuntimePath $false $false $true;$denied=@();foreach($pair in @(@($true,$false),@($false,$true),@($true,$true))){try{Get-DevelopmentRuntimePath $pair[0] $pair[1] $true|Out-Null;$denied+=$false}catch{$denied+=($_.Exception.Message -eq 'DEVELOPMENT_RECOVERY_MODE_CONFLICT')}};@{path=$p;denied=$denied}|ConvertTo-Json -Compress`;
 const result=JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}));
 assert.deepEqual(result,{path:root+'\\n4-recovery-01\\runtime',denied:[true,true,true]});
});

for(const path of scripts)test(`${path} 실제 진입 prefix도 자원 획득 전 복구를 거절한다`,{skip:process.platform!=='win32'},()=>{
 const command=`$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) '${path}'),[ref]$tokens,[ref]$errors);if($errors.Count){throw 'SYNTAX'};$guard=@($ast.EndBlock.Statements|Where-Object{$_.Extent.Text -match '^Assert-DevelopmentTlsExecution '});if($guard.Count -ne 1){throw 'EXECUTION_BARRIER_MISSING'};$prefix=$ast.Extent.Text.Substring($ast.ParamBlock.Extent.EndOffset,$guard[0].Extent.EndOffset-$ast.ParamBlock.Extent.EndOffset);foreach($cmd in @('New-Item','Set-Acl','Get-Content','Get-Item','Get-Acl','Get-Command','Start-Process','Stop-Process')){Set-Item ('function:'+ $cmd) {throw 'TEST_UNEXPECTED_SIDE_EFFECT'}};$DataRoot='${root}';$RecoveryTls=$true;$Fn08Runtime=$false;$UseVerifiedWslRelay=$false;$blocked=$false;try{& ([scriptblock]::Create('$PSScriptRoot=Join-Path (Get-Location) scripts;'+$prefix))}catch{$blocked=$_.Exception.Message -eq 'DEVELOPMENT_TLS_RECOVERY_PROTECTION_UNVERIFIED'};@{blocked=$blocked}|ConvertTo-Json -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),{blocked:true});
});

test('최초 TLS 생성은 기존 잘못된 root·존재하는 root 거절 사유를 보존한다',{skip:process.platform!=='win32'},()=>{
 const command=`$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/prepare-dev-https.ps1'),[ref]$tokens,[ref]$errors);$guard=@($ast.EndBlock.Statements|Where-Object{$_.Extent.Text -match '^Assert-DevelopmentTlsExecution '})[0];$prefix=$ast.Extent.Text.Substring($ast.ParamBlock.Extent.EndOffset,$guard.Extent.EndOffset-$ast.ParamBlock.Extent.EndOffset);function Test-Path {return $true};function New-Item {throw 'TEST_UNEXPECTED_SIDE_EFFECT'};$RecoveryTls=$false;$reasons=@();foreach($DataRoot in @('D:\\other','${root}')){try{& ([scriptblock]::Create($prefix));$reasons+='NOT_DENIED'}catch{$reasons+=$_.Exception.Message}};ConvertTo-Json -InputObject $reasons -Compress`;
 assert.deepEqual(JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']})),['HTTPS_TARGET_NOT_NEW','HTTPS_TARGET_NOT_NEW']);
});
