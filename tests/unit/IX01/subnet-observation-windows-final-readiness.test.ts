import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const base=new URL('../../../',import.meta.url);
const paths=['scripts/qa-ix01-subnet-observation-windows-readiness.ps1','scripts/qa-ix01-subnet-observation-alias-config.ps1','scripts/qa-ix01-subnet-observation-identity-path.ps1','scripts/qa-ix01-subnet-observation-windows-final-readiness.ps1'];
const original=readFileSync(new URL('tests/unit/IX01/subnet-observation-windows-readiness.test.ts',base),'utf8');
const fixture=original.split('const fixture=String.raw`')[1]!.split('`;')[0]!;
function ram(body:string){
 const source=paths.map(p=>readFileSync(new URL(p,base),'utf8')).join('\n');
 const script=`$ErrorActionPreference='Stop'
$source=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(source).toString('base64')}'))
$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$t,[ref]$e)
if($e.Count -ne 0 -or @($a.EndBlock.Statements|Where-Object {$_ -isnot [Management.Automation.Language.FunctionDefinitionAst]}).Count -ne 0){throw 'SOURCE'}
. ([scriptblock]::Create($source))
${fixture}
$targets=Get-Ix01WindowsReadinessTargets;$byPath=@{};foreach($target in $targets){$byPath[$target.path]=$target}
$algorithm=[Text.Encoding]::ASCII.GetBytes('ssh-ed25519');$blob=[byte[]]::new(4+$algorithm.Length+1);$blob[3]=[byte]$algorithm.Length;[Array]::Copy($algorithm,0,$blob,4,$algorithm.Length)
$trust=[Text.Encoding]::UTF8.GetBytes('PRIVATE.invalid ssh-ed25519 '+[Convert]::ToBase64String($blob))
$contents=@{};foreach($target in $targets){if($target.kind -ceq 'TRUST'){$contents[$target.role]=$trust}}
$contents.SSH_IMAGE=[byte[]](1,2,3)
$contents.USER_CONFIG=[Text.Encoding]::UTF8.GetBytes(('Host WSL-server',' HostName PRIVATE.invalid',' User fixture',' IdentityFile "C:/PRIVATE USER/id"') -join [char]10)
$contents.SYSTEM_CONFIG=[Text.Encoding]::UTF8.GetBytes('Port 22')
$counts=@{};$observed=[Collections.Generic.List[string]]::new();$captured=[Collections.Generic.List[object]]::new()
$oldObserve=$ports.Observe;$oldClose=$ports.Close
$ports.Observe={param($path,$dir,$leaf)
 if(!$byPath.ContainsKey($path)){throw 'SCOPE'};$target=$byPath[$path];$observed.Add($target.role)
 $v=&$oldObserve $path $dir $leaf
 if($target.kind -cne 'DIRECTORY'){$v.state='PRESENT';$v.length=[long]$contents[$target.role].Length}
 if($target.role -cin @('SYSTEM_CONFIG','SYSTEM_TRUST','SYSTEM_TRUST_2')){$v.owner='S-1-5-18';$v.rules=@(@{sid='S-1-5-18';allow=$true;rights=2032127L})}
 if($state.mode -ceq 'trust-link' -and $target.role -ceq 'USER_TRUST'){$v.reparse=$true}
 return $v
}
$ports.Open={param($path) if(!$byPath.ContainsKey($path)){throw 'SCOPE'};$role=$byPath[$path].role;$counts[$role]=[int]$counts[$role]+1;$state.opens++;return [IO.MemoryStream]::new($contents[$role])}
$originalAlias=(Get-Command -Name Read-Ix01SubnetAliasConfig -CommandType Function).ScriptBlock
function Read-Ix01SubnetAliasConfig($UserBytes,$SystemBytes,[switch]$ClassifyIdentityPaths){
 if($null -ne $UserBytes){$captured.Add($UserBytes)};if($null -ne $SystemBytes){$captured.Add($SystemBytes)}
 &$originalAlias -UserBytes $UserBytes -SystemBytes $SystemBytes -ClassifyIdentityPaths:$ClassifyIdentityPaths
}
${body}`;
 const r=spawnSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command','$s=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($s))'],{input:script,encoding:'utf8',timeout:20000,maxBuffer:65536,windowsHide:true});
 assert.equal(r.error,undefined);assert.equal(r.status,0,`RAM PowerShell exit ${r.status}`);return JSON.parse(r.stdout.trim());
}
test('IX01 final readiness RAM: 8역할 원 순회·config 각각 read1·alias 결합·비교만·원 바이트 소거',()=>{
 const r=ram(String.raw`
$line=Invoke-Ix01WindowsFinalReadiness $binding $ports
$cleared=$true;foreach($owned in $captured){if(@($owned|Where-Object {$_ -ne 0}).Count -ne 0){$cleared=$false}}
@{result=($line|ConvertFrom-Json -AsHashtable);wire=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($line+[char]10));counts=$counts;opens=$state.opens;closes=$state.closes;cleared=$cleared}|ConvertTo-Json -Depth 12 -Compress
`);
 assert.equal(r.result.code,'COMPARISON_ONLY',JSON.stringify({reason:r.result.reason,counts:r.counts,cleared:r.cleared}));assert.equal(r.result.readiness,'UNCONFIRMED');assert.equal(r.result.alias.status,'ALIAS_SUBSET');
 assert.deepEqual(r.result.files.map((v:any)=>v.role),['SSH_IMAGE','USER_CONFIG','SYSTEM_CONFIG','USER_TRUST','USER_TRUST_2','SYSTEM_TRUST','SYSTEM_TRUST_2','LEDGER_PARENT']);
 assert(r.result.files.every((v:any)=>v.state==='PRESENT'));assert.equal(r.opens,7);assert.equal(r.closes,7);assert.equal(Object.keys(r.counts).length,7);assert(Object.values(r.counts).every(v=>v===1));assert.equal(r.cleared,true);
 assert.equal(r.result.files[1].text,'ALIAS_SUBSET');assert.equal(r.result.files[3].text,'SUBSET_ONLY');
 const wire=Buffer.from(r.wire,'base64');assert(wire.length<=4096);assert.equal(wire.at(-1),10);assert.equal(wire.toString('utf8').split('\n').length,2);
 assert(!JSON.stringify(r.result).includes('PRIVATE'));assert(!JSON.stringify(r.result).includes('fixture'));assert(!JSON.stringify(r.result).includes('C:/'));
});
test('IX01 final readiness RAM: USER 불명·SYSTEM 누적·trust/시한/close 실패 후 후속0 및 소거',()=>{
 const rows=ram(String.raw`
$originalUser=$contents.USER_CONFIG;$originalSystem=$contents.SYSTEM_CONFIG
$out=@();foreach($mode in @('user','duplicate','trust-link','deadline','close')){
 $contents.USER_CONFIG=$originalUser;$contents.SYSTEM_CONFIG=$originalSystem;$state.mode=$mode;$state.wall=$binding.issuedAt;$state.mono=1L;$state.opens=0;$state.closes=0;$counts.Clear();$observed.Clear();$captured.Clear()
 if($mode -ceq 'user'){$contents.USER_CONFIG=[Text.Encoding]::UTF8.GetBytes('IdentityFile ~/.ssh/%h')}
 if($mode -ceq 'duplicate'){$contents.SYSTEM_CONFIG=[Text.Encoding]::UTF8.GetBytes('IdentityFile ~/.ssh/second')}
 $line=Invoke-Ix01WindowsFinalReadiness $binding $ports
 $cleared=$true;foreach($owned in $captured){if(@($owned|Where-Object {$_ -ne 0}).Count -ne 0){$cleared=$false}}
 $out+=@{mode=$mode;result=($line|ConvertFrom-Json -AsHashtable);observed=@($observed);opens=$state.opens;closes=$state.closes;cleared=$cleared}
};ConvertTo-Json -InputObject $out -Depth 12 -Compress
`);
 for(const r of rows){assert.equal(r.result.code,'UNKNOWN',r.mode);assert.equal(r.closes,r.opens);assert.equal(r.cleared,true,r.mode);assert(!Object.hasOwn(r.result,'alias'));assert(!JSON.stringify(r.result).includes('PRIVATE'));}
 assert(!rows[0].observed.includes('SYSTEM_CONFIG'));assert.deepEqual(rows[0].result.diagnostic,{role:'USER_CONFIG',line:1});
 assert(!rows[1].observed.includes('USER_TRUST'));assert.deepEqual(rows[1].result.diagnostic,{role:'SYSTEM_CONFIG',line:1});
 assert(!rows[2].observed.includes('USER_TRUST_2'));assert.equal(rows[3].opens,0);assert(!rows[4].observed.includes('USER_CONFIG'));
});
test('IX01 final readiness RAM: config 명시 부재는 read0·UNSET이며 준비 권위로 승격0',()=>{
 const r=ram(String.raw`
$allObserve=$ports.Observe
$ports.Observe={param($path,$dir,$leaf) $v=&$allObserve $path $dir $leaf;if($byPath[$path].kind -ceq 'CONFIG'){$v.state='ABSENT'};return $v}
$line=Invoke-Ix01WindowsFinalReadiness $binding $ports
@{result=($line|ConvertFrom-Json -AsHashtable);counts=$counts;opens=$state.opens;closes=$state.closes}|ConvertTo-Json -Depth 12 -Compress
`);
 assert.equal(r.result.code,'COMPARISON_ONLY');assert.equal(r.result.readiness,'UNCONFIRMED');assert.equal(r.result.alias.userKind,'UNSET');assert.deepEqual(r.result.alias.fields,[]);
 assert.equal(r.result.files[1].state,'ABSENT');assert.equal(r.result.files[2].state,'ABSENT');assert(!Object.hasOwn(r.counts,'USER_CONFIG'));assert(!Object.hasOwn(r.counts,'SYSTEM_CONFIG'));assert.equal(r.opens,5);assert.equal(r.closes,5);
});
test('IX01 final readiness source: 원 순회 위임1·별도 config read/새 native0·순수 의존 고정',()=>{
 const s=readFileSync(new URL(paths[3]!,base),'utf8');assert.equal((s.match(/Invoke-Ix01WindowsReadiness\s+-Binding/g)||[]).length,1);
 assert(!/Invoke-Ix01ConfigReadiness|Get-Item|Get-Acl|File\]::|Start-Process|Invoke-Expression/.test(s));
 assert.equal(createHash('sha256').update(readFileSync(new URL(paths[1]!,base))).digest('hex'),'d972a785a99cc8c883b15ab716b8d939241e5e5663f56d67d73581ff0c15e09b');
 assert.equal(createHash('sha256').update(readFileSync(new URL(paths[2]!,base))).digest('hex'),'5846a8d06aa7caa8453a792df52a37562d2c37f6befe932b3c608c399758e2bc');
});
