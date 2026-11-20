import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const base=new URL('../../../',import.meta.url);
const paths=['scripts/qa-ix01-subnet-observation-windows-readiness.ps1','scripts/qa-ix01-subnet-observation-alias-config.ps1','scripts/qa-ix01-subnet-observation-config-readiness.ps1'];
const original=readFileSync(new URL('tests/unit/IX01/subnet-observation-windows-readiness.test.ts',base),'utf8');
const fixture=original.split('const fixture=String.raw`')[1]!.split('`;')[0]!;
function ram(body:string){
 const source=paths.map(p=>readFileSync(new URL(p,base),'utf8')).join('\n');
 const script=`$ErrorActionPreference='Stop'
$source=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(source).toString('base64')}'))
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors)
if($errors.Count -ne 0){throw 'SOURCE_PARSE'}
if(@($ast.EndBlock.Statements | Where-Object {$_ -isnot [Management.Automation.Language.FunctionDefinitionAst]}).Count -ne 0){throw 'AUTO_ENTRY'}
. ([scriptblock]::Create($source))
${fixture}
$oldObserve=$ports.Observe;$oldOpen=$ports.Open;$scope=[Collections.Generic.List[string]]::new()
$ports.Observe={param($path,$dir,$leaf) if($path -cnotin @('C:\\Users\\cyhuh\\.ssh\\config','C:\\ProgramData\\ssh\\ssh_config') -or $dir -or $leaf){throw 'OUT_OF_SCOPE'};$scope.Add($path);&$oldObserve $path $dir $leaf}
$ports.Open={param($path) if($path -cnotin @('C:\\Users\\cyhuh\\.ssh\\config','C:\\ProgramData\\ssh\\ssh_config')){throw 'OUT_OF_SCOPE'};&$oldOpen $path}
${body}`;
 const r=spawnSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command','$s=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($s))'],{input:script,encoding:'utf8',timeout:20000,maxBuffer:32768,windowsHide:true});
 assert.equal(r.error,undefined);assert.equal(r.status,0,`RAM PowerShell exit ${r.status}`);return JSON.parse(r.stdout.trim());
}
test('IX01 config readiness: 두 고정 config만 원 metadata/close·alias 결박, 4KiB 한 줄',()=>{
 const r=ram(String.raw`
$line=Invoke-Ix01ConfigReadiness $binding $ports
@{result=($line|ConvertFrom-Json -AsHashtable);wire=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($line+[char]10));opens=$state.opens;closes=$state.closes;scopeCount=$scope.Count}|ConvertTo-Json -Depth 12 -Compress
`);
 assert.equal(r.result.code,'CONFIG_INSPECTION_COLLECTED');assert.equal(r.result.readiness,'UNCONFIRMED');assert.equal(r.result.alias.status,'ALIAS_SUBSET');assert.equal(r.result.alias.userKind,'NON_ROOT_LITERAL');
 assert.deepEqual(r.result.files.map((x:any)=>[x.role,x.state]),[['USER_CONFIG','PRESENT'],['SYSTEM_CONFIG','ABSENT']]);assert.equal(r.opens,1);assert.equal(r.closes,1);assert.equal(r.scopeCount,5);
 const wire=Buffer.from(r.wire,'base64');assert(wire.length<=4096);assert.equal(wire.at(-1),10);assert.equal(wire.toString('utf8').split('\n').length,2);assert(!JSON.stringify(r.result).includes('example.invalid'));assert(!JSON.stringify(r.result).includes('fixture'));assert(!JSON.stringify(r.result).includes('C:\\'));
 assert.equal(r.result.binding.attemptId,'11111111-1111-4111-8111-111111111111');
});
test('IX01 config readiness: 첫 파일 불명/시간/부분 읽기 뒤 system0·원 close1',()=>{
 const rows=ram(String.raw`
$out=@();foreach($mode in @('access','link','foreign-write','changed','deadline','open','read','close','step-time','include','short')){
 $state.mode=$mode;$state.wall=$binding.issuedAt;$state.mono=1L;$state.opens=0;$state.closes=0;$state.observes=0;$scope.Clear()
 $q=$ports.Clone();if($mode -eq 'include'){$data=[Text.Encoding]::UTF8.GetBytes('Include PRIVATE')};if($mode -eq 'short'){$q.Read={param($s,$b,$n) return 0}}
 $line=Invoke-Ix01ConfigReadiness $binding $q
 $out+=@{mode=$mode;result=($line|ConvertFrom-Json -AsHashtable);opens=$state.opens;closes=$state.closes;system=@($scope|Where-Object {$_ -ceq 'C:ProgramDatasshssh_config'}).Count}
};ConvertTo-Json -InputObject $out -Depth 12 -Compress
`);
 for(const r of rows){assert.equal(r.result.code,'UNKNOWN',r.mode);assert.equal(r.system,0,r.mode);assert(r.opens<=1);assert.equal(r.closes,r.opens-(r.mode==='open'?1:0));assert(!Object.hasOwn(r.result,'alias'));assert(!JSON.stringify(r.result).includes('PRIVATE'));if(r.mode==='include')assert.deepEqual(r.result.diagnostic,{role:'USER_CONFIG',line:1});}
});
test('IX01 config readiness: 두 PRESENT 첫 값 결합·system 행의 제한 진단',()=>{
 const rows=ram(String.raw`
$baseObserve=$ports.Observe;$baseOpen=$ports.Open
$ports.Observe={param($path,$dir,$leaf)
 $v=&$baseObserve $path $dir $leaf
 if($path -ceq 'C:\ProgramData\ssh\ssh_config'){$v.state='PRESENT';$v.owner='S-1-5-18';$v.rules=@(@{sid='S-1-5-18';allow=$true;rights=2032127L});$v.length=[long]$systemData.Length}
 return $v
}
$ports.Open={param($path) if($path -ceq 'C:\ProgramData\ssh\ssh_config'){$state.opens++;return [IO.MemoryStream]::new($systemData)};return &$baseOpen $path}
$out=@();foreach($setting in @('User root','IdentityFile ~/.ssh/second')){
 $systemData=[Text.Encoding]::UTF8.GetBytes($setting);$state.opens=0;$state.closes=0
 $line=Invoke-Ix01ConfigReadiness $binding $ports
 $out+=@{result=($line|ConvertFrom-Json -AsHashtable);opens=$state.opens;closes=$state.closes}
};ConvertTo-Json -InputObject $out -Depth 12 -Compress
`);
 assert.equal(rows[0].result.code,'CONFIG_INSPECTION_COLLECTED');assert.equal(rows[0].result.alias.userKind,'NON_ROOT_LITERAL');assert.equal(rows[0].result.files[1].state,'PRESENT');
 assert.equal(rows[1].result.code,'UNKNOWN');assert.equal(rows[1].result.reason,'IDENTITY_SET_UNCONFIRMED');assert.deepEqual(rows[1].result.diagnostic,{role:'SYSTEM_CONFIG',line:1});assert(!Object.hasOwn(rows[1].result,'alias'));
 for(const r of rows){assert.equal(r.opens,2);assert.equal(r.closes,2);assert(!JSON.stringify(r.result).includes('second'));}
});
test('IX01 config readiness: 잘못된 결박은 read0, 복사/close 지연 및 60초 초과는 후속0',()=>{
 const rows=ram(String.raw`
$out=@();foreach($mode in @('binding','window','mutate','close-late','short-window')){
 $state.wall=1800000000000L;$state.mono=1L;$state.opens=0;$state.closes=0;$state.observes=0;$scope.Clear()
 $q=$binding.Clone();$p=$ports.Clone();$state.original=$q;$originalClose=$ports.Close
 if($mode -eq 'binding'){$q.extra='PRIVATE'}
 if($mode -eq 'window'){$q.expiresAt++}
 if($mode -eq 'mutate'){$p.Owner={$state.original.planHash='f'*64;$state.original.expiresAt=1L;return $owner}}
 if($mode -eq 'close-late'){$p.Close={param($s) &$originalClose $s;$state.wall+=10001L;$state.mono+=10001L}}
 if($mode -eq 'short-window'){$q.expiresAt=$q.issuedAt+1;$p.Close={param($s) &$originalClose $s;$state.wall++;$state.mono++}}
 $line=Invoke-Ix01ConfigReadiness $q $p
 $out+=@{mode=$mode;result=($line|ConvertFrom-Json -AsHashtable);opens=$state.opens;closes=$state.closes;system=@($scope|Where-Object {$_ -ceq 'C:ProgramDatasshssh_config'}).Count}
};ConvertTo-Json -InputObject $out -Depth 12 -Compress
`);
 for(const r of rows){assert.equal(r.result.code,r.mode==='mutate'?'CONFIG_INSPECTION_COLLECTED':'UNKNOWN');assert.equal(r.closes,r.opens);if(r.mode==='mutate')assert.equal(r.result.binding.planHash,'b'.repeat(64));else assert.equal(r.system,0);if(['binding','window'].includes(r.mode))assert.equal(r.opens,0);}
});
test('IX01 config readiness source: 두 원 지문·함수 재사용·새 native/8역할 진입0',()=>{
 const hashes=paths.slice(0,2).map(p=>createHash('sha256').update(readFileSync(new URL(p,base))).digest('hex'));
 assert.deepEqual(hashes,['6847d094d436d246983a8ea353c0705541b4fd4c312f596ab78b5ff3efea8cc3','eb0b94496e2c28c8c0193c2904cf3477d07b9a18540a673b9739c7d446cdd488']);
 const s=readFileSync(new URL(paths[2]!,base),'utf8');assert(!/Invoke-Ix01WindowsReadiness|New-Ix01WindowsReadinessNativePorts|Get-Item|Get-Acl|Get-Content|Start-Process|File\]::Open/.test(s));
 for(const name of ['Test-Ix01ReadinessObservation','Get-Ix01ReadinessMetadataHash','Test-Ix01ReadinessBudget','Read-Ix01SubnetAliasConfig'])assert(s.includes(name));
});
test('IX01 config readiness plan: 고정 source3·빈 승인·본문 파싱만, 신규 원 Invoke1',()=>{
 const plan=readFileSync(new URL('docs/work_packages/IX01_WINDOWS_ALIAS_CONFIG_READ_EXECUTION_PLAN.md',base),'utf8');
 const command=plan.split('```powershell\n')[1]!.split('\n```')[0]!;
 for(const p of paths){const b=readFileSync(new URL(p,base));assert(command.includes(p));assert(command.includes(createHash('sha256').update(b).digest('hex')));assert(command.includes(`bytes=${b.length}`));}
 assert(command.includes("$approvalId='';$approvalHash='';$planHash='';$attemptId='';$approvalIssuedAtMs='';$approvalDeadlineMs=''"));
 assert(!command.includes('.av3-data/av3-stage'));assert(!command.includes('C:\\Users\\cyhuh\\.codex'));
 const r=ram(`
$command=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(command).toString('base64')}'))
$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseInput($command,[ref]$t,[ref]$e)
$calls=@($a.FindAll({param($n) $n -is [Management.Automation.Language.CommandAst] -and $n.GetCommandName() -ceq 'Invoke-Ix01ConfigReadiness'},$true))
@{errors=$e.Count;calls=$calls.Count;opens=$state.opens;observes=$state.observes}|ConvertTo-Json -Compress
`);
 assert.deepEqual(r,{errors:0,calls:1,opens:0,observes:0});
});
