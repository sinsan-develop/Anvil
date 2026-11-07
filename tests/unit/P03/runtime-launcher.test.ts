import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {test} from 'node:test';

test('새 FN08 runtime은 기존 runtime을 재사용하지 않고 검증된 relay 선택만 허용한다',{skip:process.platform!=='win32'},()=>{
 const script=`$ErrorActionPreference='Stop';$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'scripts/start-development.ps1'),[ref]$tokens,[ref]$errors);if($errors.Count){throw 'SYNTAX'};$f=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Get-DevelopmentRuntimePath'},$true);if(!$f){throw 'RUNTIME_PLAN_MISSING'};. ([scriptblock]::Create($f.Extent.Text));$old=Get-DevelopmentRuntimePath $false $false;$new=Get-DevelopmentRuntimePath $true $true;$denied=$false;try{Get-DevelopmentRuntimePath $true $false|Out-Null}catch{$denied=$_.Exception.Message -eq 'FN08_VERIFIED_RELAY_REQUIRED'};@{old=$old;next=$new;denied=$denied}|ConvertTo-Json -Compress`;
 const value=JSON.parse(execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-Command',script],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}));
 assert.deepEqual(value,{old:'D:\\Project\\Anvil\\.av3-data\\runtime',next:'D:\\Project\\Anvil\\.av3-data\\runtime-fn08-20261017',denied:true});
});
