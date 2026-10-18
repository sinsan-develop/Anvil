import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
const url=new URL('../../../scripts/source-read-absolute-compile.ts',import.meta.url).href;
const candidate=await import(url).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
const sourceRoot='D:\\Project\\Anvil',input={sourceRoot,sourceHash:'3D10E3964317EB5F3F18A74B42328BDC6894CAEBE9452CA49D1470CD273FFFBC',compilerHash:'46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00',mscorlibHash:'11AC114C43ECF6996BEF58BA3C99FBA3693A4560A84EEADDE54D193060DC626C',systemHash:'2B3C17C6208A0B4B6BEB94E1A066F99BA06CDB2EA919479E99D47E8C6D96DC71'};
const build=(value:unknown)=>{assert.equal(typeof candidate?.buildA3AbsoluteSourceCompileCandidate,'function');return candidate!.buildA3AbsoluteSourceCompileCandidate(value);};
test('절대source library 후보는 source 인자 하나만 바꾸고 compile·OS 관측 권한을 만들지 않는다',()=>{
 const value=build(input);assert.equal(value.executable,'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe');assert.equal(value.cwd,sourceRoot);
 assert.deepEqual(value.args,['/nologo','/noconfig','/nostdlib+','/target:library','/debug-','/optimize+','/reference:C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\mscorlib.dll','/reference:C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\System.dll','/out:D:\\tmp\\anvil-v3-stage-b\\a3-absolute-source-compile-01\\bin\\SourceReadObserver.dll','D:\\Project\\Anvil\\apps\\connector\\native\\SourceReadObserver.cs']);
 assert.equal(value.previousArgs[9],'apps/connector/native/SourceReadObserver.cs');assert.deepEqual(value.args.map((v:string,n:number)=>v===value.previousArgs[n]?null:n).filter((v:number|null)=>v!==null),[9]);assert.deepEqual(value.changedIndices,[9]);
 assert.deepEqual(value.limits,{timeoutMs:15000,combinedOutputBytes:16384,compilerStarts:1,retries:0});assert.equal(value.useShellExecute,false);assert.equal(value.createNoWindow,true);assert.deepEqual(value.childEnvironment,{TMP:'D:\\tmp\\anvil-v3-stage-b\\a3-absolute-source-compile-01\\temp',TEMP:'D:\\tmp\\anvil-v3-stage-b\\a3-absolute-source-compile-01\\temp'});
 assert.equal(value.candidateOnly,true);assert.equal(value.executionAuthorized,false);assert.equal(value.processStarted,false);assert.equal(value.osVerified,false);assert.equal(value.baselineConfirmed,false);assert.equal(value.callerFactsVerified,false);assert.match(value.commandHash,/^[a-f0-9]{64}$/);assert.throws(()=>{value.args[9]='elsewhere.cs';},TypeError);
});
test('절대source 후보의 정확 인자는 기존 합성byte 진단에서 절대source로만 분류된다',()=>{
 const value=build(input),absolute=value.args[9],raw=`error CS1504: Source file '${absolute}' could not be opened ('The system cannot find the file specified.')\r\n`;
 const script=String.raw`$ErrorActionPreference='Stop';. (Join-Path (Get-Location).Path 'scripts/source-read-compile-diagnostics.ps1');$v=ConvertFrom-Json -AsHashtable ([Console]::In.ReadToEnd());$bytes=[Text.Encoding]::UTF8.GetBytes($v.raw);$r=Get-A3CompileDiagnostic -Stdout $bytes -Stderr ([byte[]]@()) -ExitCode 1 -Complete $true -ExpectedAbsoluteSource $v.absolute -OsReasons @{};ConvertTo-Json -InputObject $r -Depth 8 -Compress`;
 const wire=execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-NonInteractive','-Command',script],{input:JSON.stringify({absolute,raw}),encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:65536}),result=JSON.parse(wire);
 assert.deepEqual(result.sourceOpenFailure,{fileRole:'SOURCE_ABSOLUTE',osReason:'NOT_FOUND'});assert.equal(result.executionAuthorized,false);assert.equal(result.actualExecutionVerified,false);assert.equal(wire.includes(sourceRoot),false);
});
test('다른source/compiler/BCL hash·별칭경로·범위확대필드·getter를 거절하며 입력을 실행/정규화하지 않는다',()=>{
 for(const key of['sourceHash','compilerHash','mscorlibHash','systemHash'])assert.throws(()=>build({...input,[key]:'a'.repeat(64)}),/A3_ABSOLUTE_CANDIDATE_INPUT_INVALID/);
 for(const sourceRoot of['D:\\Project\\..\\Anvil','D:\\Project.\\Anvil','D:\\Project \\Anvil','D:/Project/Anvil','\\\\server\\share','C:\\','D:\\tmp','D:\\Project\\CON','D:\\Project\\Anvil\\','D:\\Project\\Anvil\" /unsafe'])assert.throws(()=>build({...input,sourceRoot}),/A3_ABSOLUTE_CANDIDATE_INPUT_INVALID/);
 for(const change of[{timeoutMs:30000},{execute:true},{qaRoot:'D:\\other'},{args:['evil']}])assert.throws(()=>build({...input,...change}),/A3_ABSOLUTE_CANDIDATE_INPUT_INVALID/);
 let called=0;const getter={...input};Object.defineProperty(getter,'sourceRoot',{enumerable:true,get(){called++;return input.sourceRoot;}});assert.throws(()=>build(getter),/A3_ABSOLUTE_CANDIDATE_INPUT_INVALID/);assert.equal(called,0);
});
test('Proxy와 revoked Proxy는 reflection trap 실행 없이 같은 고정 오류로 거절한다',()=>{
 let calls=0;const proxy=new Proxy({...input},{getPrototypeOf(){calls++;return Object.prototype;},ownKeys(target){calls++;return Reflect.ownKeys(target);},getOwnPropertyDescriptor(target,key){calls++;return Reflect.getOwnPropertyDescriptor(target,key);}}),revoked=Proxy.revocable({...input},{});revoked.revoke();
 assert.throws(()=>build(proxy),/A3_ABSOLUTE_CANDIDATE_INPUT_INVALID/);assert.equal(calls,0);assert.throws(()=>build(revoked.proxy),/A3_ABSOLUTE_CANDIDATE_INPUT_INVALID/);assert.equal(calls,0);
});
