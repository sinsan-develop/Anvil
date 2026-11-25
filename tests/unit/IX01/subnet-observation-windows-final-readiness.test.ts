import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readSubnetWindowsFinalReadinessResult,readSubnetWindowsReadinessResult} from '../../../scripts/qa-ix01-subnet-observation-windows-readiness-result.ts';
const base=new URL('../../../',import.meta.url);
const paths=['scripts/qa-ix01-subnet-observation-windows-readiness.ps1','scripts/qa-ix01-subnet-observation-alias-config.ps1','scripts/qa-ix01-subnet-observation-identity-path.ps1','scripts/qa-ix01-subnet-observation-windows-final-readiness.ps1'];
const historicalAlias=spawnSync('git',['cat-file','blob','ef52ba33a7db6ea9db5ffe0defc622091e8232dc:'+paths[1]],{cwd:base,maxBuffer:65536,windowsHide:true});
assert.equal(historicalAlias.error,undefined);assert.equal(historicalAlias.status,0);
assert.equal(createHash('sha256').update(historicalAlias.stdout).digest('hex'),'d972a785a99cc8c883b15ab716b8d939241e5e5663f56d67d73581ff0c15e09b');
const pinnedSource=(path:string)=>path===paths[1]?historicalAlias.stdout:readFileSync(new URL(path,base));
const original=readFileSync(new URL('tests/unit/IX01/subnet-observation-windows-readiness.test.ts',base),'utf8');
const fixture=original.split('const fixture=String.raw`')[1]!.split('`;')[0]!;
const finalSourceHash='ad2254c843f97ff420eee2d35cf6968783f199694ee5b6404bdde69dd74cd3d8';
const expectedBinding={attemptId:'11111111-1111-4111-8111-111111111111',approvalHash:'a'.repeat(64),planHash:'b'.repeat(64),sourceHash:finalSourceHash,issuedAt:1800000000000,expiresAt:1800000060000};
const executionPlan=readFileSync(new URL('docs/work_packages/IX01_WINDOWS_FINAL_READINESS_EXECUTION_PLAN.md',base),'utf8');
const currentPlan=readFileSync(new URL('docs/work_packages/IX01_CONDITIONAL_RESUMPTION_PLAN.md',base),'utf8');
const command=executionPlan.split('```powershell')[1]!.split('```')[0]!;
function ram(body:string){
 const source=paths.map(p=>pinnedSource(p).toString('utf8')).join('\n');
 const script=`$ErrorActionPreference='Stop'
$source=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(source).toString('base64')}'))
$t=$null;$e=$null;$a=[Management.Automation.Language.Parser]::ParseInput($source,[ref]$t,[ref]$e)
if($e.Count -ne 0 -or @($a.EndBlock.Statements|Where-Object {$_ -isnot [Management.Automation.Language.FunctionDefinitionAst]}).Count -ne 0){throw 'SOURCE'}
. ([scriptblock]::Create($source))
${fixture}
$binding.sourceHash='${finalSourceHash}'
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
 const r=ram(`
$command=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(command).toString('base64')}'))
$ct=$null;$ce=$null;$ca=[Management.Automation.Language.Parser]::ParseInput($command,[ref]$ct,[ref]$ce)
$calls=@($ca.FindAll({param($node) $node -is [Management.Automation.Language.CommandAst] -and $node.GetCommandName() -ceq 'Invoke-Ix01WindowsFinalReadiness'},$true))
if($ce.Count -ne 0 -or $calls.Count -ne 1){throw 'PLAN_SYNTAX'}
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
 const comparison=readSubnetWindowsFinalReadinessResult(wire,expectedBinding);
 assert.equal(comparison.status,'COMPARISON_ONLY');if(comparison.status!=='COMPARISON_ONLY')assert.fail('FINAL_RESULT');
 assert.equal(comparison.readiness,'UNCONFIRMED');assert.deepEqual(comparison.binding,expectedBinding);assert.deepEqual(comparison.alias,r.result.alias);
 assert.equal(comparison.identity.imageSha256,r.result.files[0].sha256);for(const hash of Object.values(comparison.identity))assert.match(hash,/^[0-9a-f]{64}$/);
 assert.equal(comparison.outputSha256,createHash('sha256').update(wire).digest('hex'));assert(Object.isFrozen(comparison.alias)&&Object.isFrozen(comparison.alias.fields));
 assert.equal(readSubnetWindowsReadinessResult(wire,expectedBinding).status,'UNKNOWN');
 const encode=(v:unknown)=>Buffer.from(JSON.stringify(v)+'\n');
 const mutations=[
  (v:any)=>{v.binding.sourceHash='6847d094d436d246983a8ea353c0705541b4fd4c312f596ab78b5ff3efea8cc3';},
  (v:any)=>{v.binding.attemptId='22222222-2222-4222-8222-222222222222';},
  (v:any)=>{v.code='INSPECTION_COLLECTED';},(v:any)=>{v.alias.authorized=true;},(v:any)=>{v.alias.alias='other';},
  (v:any)=>{v.alias.status='CURRENT';},(v:any)=>{v.alias.readiness='VERIFIED';},(v:any)=>{v.alias.code='PASS';},
  (v:any)=>{v.alias.fields[0].key='command';},(v:any)=>{v.alias.fields[0].role='SSH_IMAGE';},
  (v:any)=>{v.alias.fields[0].line=0;},(v:any)=>{v.alias.fields[0].line=4097;},(v:any)=>{v.alias.fields[0].line=1.5;},
  (v:any)=>{v.alias.fields.reverse();},(v:any)=>{v.alias.fields.push({...v.alias.fields[0]});},
  (v:any)=>{v.alias.fields[0].value='PRIVATE';},(v:any)=>{v.alias.userKind='UNSET';},
  (v:any)=>{v.alias.fields=v.alias.fields.filter((x:any)=>x.key!=='user');},
  (v:any)=>{v.files[1]={role:'USER_CONFIG',state:'ABSENT',metadata:'MATCHED'};},
  (v:any)=>{v.files[1].text='SUBSET_ONLY';},(v:any)=>{v.files[3].text='ALIAS_SUBSET';},
  (v:any)=>{v.files.pop();},(v:any)=>{v.files[0].bytes=67108865;},(v:any)=>{v.exit=0;},
 ];
 for(const mutate of mutations){const v=structuredClone(r.result);mutate(v);assert.equal(readSubnetWindowsFinalReadinessResult(encode(v),expectedBinding).status,'UNKNOWN');}
 for(const raw of [Buffer.concat([Buffer.from([239,187,191]),wire]),Buffer.concat([wire,Buffer.from('\n')]),Buffer.alloc(4097),Buffer.from([255,10]),Buffer.from(wire.toString().replace('"schemaVersion":1','"schemaVersion":1,"schemaVersion":1'))])assert.equal(readSubnetWindowsFinalReadinessResult(raw,expectedBinding).status,'UNKNOWN');
 const changed=structuredClone(r.result);changed.alias.fields[0].line=4;
 const other=readSubnetWindowsFinalReadinessResult(encode(changed),expectedBinding);assert.equal(other.status,'COMPARISON_ONLY');if(other.status!=='COMPARISON_ONLY')assert.fail('COMPARISON');
 assert.notEqual(other.identity.configurationSha256,comparison.identity.configurationSha256);assert.equal(other.identity.knownHostsSha256,comparison.identity.knownHostsSha256);
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
 const parsed=readSubnetWindowsFinalReadinessResult(Buffer.from(JSON.stringify(r.result)+'\n'),expectedBinding);assert.equal(parsed.status,'COMPARISON_ONLY');
});
test('IX01 final readiness source: 원 순회 위임1·별도 config read/새 native0·순수 의존 고정',()=>{
 assert(executionPlan.includes('ef52ba33a7db6ea9db5ffe0defc622091e8232dc'));
 for(const path of paths){const bytes=pinnedSource(path);assert(command.includes(`path='${path}';bytes=${bytes.length};hash='${createHash('sha256').update(bytes).digest('hex')}'`));}
 assert(command.includes("$approvalId='';$approvalHash='';$planHash='';$attemptId='';$approvalIssuedAtMs='';$approvalDeadlineMs=''"));
 const readerPath='scripts/qa-ix01-subnet-observation-windows-readiness-result.ts',historicalReader=spawnSync('git',['cat-file','blob','7abfc333:'+readerPath],{cwd:base,maxBuffer:65536,windowsHide:true});
 assert.equal(historicalReader.error,undefined);assert.equal(historicalReader.status,0);const historicalReaderHash=createHash('sha256').update(historicalReader.stdout).digest('hex');
 assert.equal(historicalReaderHash,'f4907e314fec4370f0532a4548861f23374fac8144e94478f56627b624fc1ab3');assert(executionPlan.includes(historicalReaderHash.toUpperCase()));
 const pinnedCurrentReader=spawnSync('git',['cat-file','blob','5012a0d6:'+readerPath],{cwd:base,maxBuffer:65536,windowsHide:true});
 assert.equal(pinnedCurrentReader.error,undefined);assert.equal(pinnedCurrentReader.status,0);const currentReader=readFileSync(new URL(readerPath,base)),currentReaderHash=createHash('sha256').update(currentReader).digest('hex');
 assert.equal(createHash('sha256').update(pinnedCurrentReader.stdout).digest('hex'),'8214ac2a43116108b231de15b7a8116397d2dec72385123634460767533632c0');assert.equal(currentReaderHash,'8214ac2a43116108b231de15b7a8116397d2dec72385123634460767533632c0');
 assert(currentPlan.includes('5012a0d68814c91f542b71861cdb6373cc216280'));assert(currentPlan.includes(currentReaderHash.toUpperCase()));
 const s=readFileSync(new URL(paths[3]!,base),'utf8');assert.equal((s.match(/Invoke-Ix01WindowsReadiness\s+-Binding/g)||[]).length,1);
 assert(!/Invoke-Ix01ConfigReadiness|Get-Item|Get-Acl|File\]::|Start-Process|Invoke-Expression/.test(s));
 assert.equal(createHash('sha256').update(pinnedSource(paths[1]!)).digest('hex'),'d972a785a99cc8c883b15ab716b8d939241e5e5663f56d67d73581ff0c15e09b');
 assert.equal(createHash('sha256').update(readFileSync(new URL(paths[2]!,base))).digest('hex'),'5846a8d06aa7caa8453a792df52a37562d2c37f6befe932b3c608c399758e2bc');
});
