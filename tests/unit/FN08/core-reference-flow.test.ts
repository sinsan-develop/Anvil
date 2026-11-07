import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync,spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
const ps='C:\\Program Files\\PowerShell\\7\\pwsh.exe';
const binding={decisionId:'A3_CORE_REFERENCE_COMPILE_01',runId:'a3-core-reference-compile-01',commit:'a'.repeat(40),scriptHash:'b'.repeat(64),issuedAt:'2026-10-18T04:20:00Z',expiresAt:'2026-10-18T04:50:00Z'};
const command=String.raw`$ErrorActionPreference='Stop';. ./scripts/source-read-absolute-flow.ps1;if(!(Test-Path -LiteralPath './scripts/source-read-core-reference-flow.ps1')){@{missing=$true}|ConvertTo-Json -Compress;exit 0};. ./scripts/source-read-core-reference-flow.ps1;$v=ConvertFrom-Json -AsHashtable -DateKind String ([Console]::In.ReadToEnd());try{$r=Read-A3CoreReferenceBinding $v.binding ([datetimeoffset]$v.now);@{ok=$true;decisionId=$r.decisionId;runId=$r.runId;executionAuthorized=$r.executionAuthorized}|ConvertTo-Json -Compress}catch{@{ok=$false}|ConvertTo-Json -Compress}`;
const read=(v:unknown)=>JSON.parse(execFileSync(ps,['-NoProfile','-NonInteractive','-Command',command],{input:JSON.stringify({binding:v,now:'2026-10-18T04:30:00Z'}),encoding:'utf8',windowsHide:true,timeout:10000}));
test('Core의 새policy/run만 유한창 형식을 검사하고 실제허가로 승격하지 않는다',()=>{
 assert.deepEqual(read(binding),{ok:true,decisionId:'A3_CORE_REFERENCE_COMPILE_01',runId:'a3-core-reference-compile-01',executionAuthorized:false});
 for(const patch of [{decisionId:'A3_ABSOLUTE_SOURCE_COMPILE_01'},{runId:'a3-absolute-source-compile-01'},{expiresAt:'2026-10-18T04:30:30Z'},{issuedAt:'2026-10-18T04:40:00Z'},{expiresAt:'2026-10-18T04:50:01Z'},{executionAuthorized:true}])assert.deepEqual(read({...binding,...patch}),{ok:false});
});
test('새runner Plan은 Core 참조1개와 정확별도QA·소비·이전소비보존만 제시하고 실행하지 않는다',()=>{
 const file=new URL('../../../scripts/run-source-read-core-reference-compile.ps1',import.meta.url);assert.ok(existsSync(file));const path=decodeURIComponent(file.pathname).replace(/^\/([A-Za-z]:)/,'$1');
 const r=spawnSync(ps,['-NoProfile','-NonInteractive','-File',path,'-Plan'],{encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:65536});assert.equal(r.status,0);const v=JSON.parse(r.stdout);assert.equal(v.executionAuthorized,false);assert.equal(v.processStarted,false);assert.equal(v.oneUseConsumed,false);assert.equal(v.qaCreated,false);assert.equal(v.decisionId,binding.decisionId);assert.equal(v.runId,binding.runId);
 const qa='D:\\Project\\Anvil\\.av3-data\\a3-core-reference-compile-01-qa';assert.deepEqual(v.layout.directories,[qa+'\\bin',qa+'\\temp']);assert.equal(v.receiptProposed,'D:\\Project\\Anvil\\.av3-data\\a3-core-reference-compile-01.consumed.json');assert.equal(v.priorReceiptRequired,'D:\\Project\\Anvil\\.av3-data\\a3-absolute-source-compile-01.consumed.json');assert.equal(v.priorReceiptHash,'0641372DB8A55BF10B569CBD34CD57AEA1568C51A0E8735AAC35AEA94CB4D2F4');
 assert.equal(v.compileArguments.length,11);assert.equal(v.compileArguments[8],'/reference:C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\System.Core.dll');assert.equal(v.compileArguments[9],'/out:'+qa+'\\bin\\SourceReadObserver.dll');assert.equal(v.compileArguments[10],'D:\\synthetic\\Anvil\\apps\\connector\\native\\SourceReadObserver.cs');assert.equal(v.timeoutMs,15000);assert.equal(v.combinedOutputBytes,16384);assert.equal(v.retries,0);
});
test('Core runner의 미결박 Apply는 이전허가를 사용하거나 자원을 생성하지 않는다',()=>{
 const file=new URL('../../../scripts/run-source-read-core-reference-compile.ps1',import.meta.url);assert.ok(existsSync(file));const path=decodeURIComponent(file.pathname).replace(/^\/([A-Za-z]:)/,'$1');const r=spawnSync(ps,['-NoProfile','-NonInteractive','-File',path,'-Apply'],{encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:65536});assert.equal(r.status,1);assert.deepEqual(JSON.parse(r.stdout),{status:'FAIL_BEFORE_MUTATION',failure:'A3_BINDING_INVALID',processStarted:false,oneUseConsumed:false,qaCreated:false,executionAuthorized:false});
});
