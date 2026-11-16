import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const read = (path:string) => readFileSync(new URL('../../../'+path, import.meta.url));
const original = read('scripts/fn07-local-cli-identity-read.ps1');
const current = read('scripts/fn07-local-cli-identity-read-v2.ps1');
const candidate = read('docs/work_packages/FN07_LOCAL_CLI_IDENTITY_DIAGNOSTIC_CANDIDATE_20261116.md').toString('utf8');
const supervisor = /\x60\x60\x60powershell\r?\n([\s\S]*?)\r?\n\x60\x60\x60/.exec(candidate)![1]!;
const hash = (bytes:Buffer) => createHash('sha256').update(bytes).digest('hex').toUpperCase();

test('원 조회와 새 조회는 진단 대입을 제외하고 동일하며 원본·후보 지문이 일치한다',()=>{
  assert.equal(hash(original),'2A7E89112023DDB2F40631ABD098529B47AF1A2B6CF87317C7113F56C636F511');
  assert.equal(hash(read('docs/work_packages/FN07_LOCAL_SDK_CLI_IDENTITY_READ_CANDIDATE_20261116.md')),
    'EEAFFF15D288F5721F00C235A3A1FB1D2806CD0E8F0080010CF1B8685F47F620');
  assert(candidate.includes(hash(current)) && supervisor.includes(hash(current)));
  const body=(s:string)=>s.replace(/\r\n/g,'\n').split('\n').slice(1).join('\n').trimEnd();
  const stripped = body(current.toString()).replace(/^ *\$script:(stage|reason) = '[A-Z_]+'\n/gm,'')
    .replace(/\$script:reason = '([A-Z_]+)'; throw '\1'/g,"throw '$1'")
    .replace('catch { $result = "UNKNOWN|$script:stage|$script:reason" }',"catch { $result = 'UNKNOWN' }");
  assert.equal(stripped,body(original.toString()));
  assert(current.length<=10000);
});

test('감독은 단일 시작과 원 객체 종단 확인·보존 및 원 한도를 유지한다',()=>{
  assert.equal(supervisor.match(/\$owned\.Start\(\)/g)?.length,1);
  assert.equal(supervisor.match(/\$owned\.Kill\(\)/g)?.length,1);
  assert.match(supervisor,/\$startAttempted = \$true\s+\$terminal = 'UNCONFIRMED'\s+\$started = \$owned\.Start\(\)/);
  assert.match(supervisor,/if \(\$startAttempted -and !\$started\) \{\s*\$script:Fn07UnconfirmedProcess = \$owned/);
  assert.match(supervisor,/3000L, \[Math\]::Max\(0L, 30000L - \$watch\.ElapsedMilliseconds/);
  assert.match(supervisor,/\$complete = \$true\s*\} catch \{ \$failure = \$phase \}/);
  assert.doesNotMatch(supervisor.slice(supervisor.lastIndexOf('finally {')),/\$failure\s*=/);
  assert.match(supervisor,/\$out = \[byte\[\]\]::new\(4095\)\s+\$err = \[byte\[\]\]::new\(1\)/);
  assert.doesNotMatch(supervisor,/Get-Process|Stop-Process|\.Exception\b|\$_\b/);
});

test('Windows PowerShell 구문과 격리된 순수 결과 함수의 RAM 반례', {skip:process.platform!=='win32'},()=>{
  // 두 원문은 파서의 입력이다. 호출 대상은 확인한 두 순수 함수뿐이다.
  const checker=String.raw`
$ErrorActionPreference = 'Stop'
foreach ($part in 1,2) {
    $source = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([Console]::In.ReadLine()))
    $tokens = $null; $errors = $null
    $ast = [Management.Automation.Language.Parser]::ParseInput($source,[ref]$tokens,[ref]$errors)
    if ($errors.Count) { throw 'PARSE_ERROR' }
}
foreach ($name in 'Read-Fn07ChildLine','Format-Fn07Result') {
    $definition = @($ast.EndBlock.Statements | Where-Object { $_ -is [Management.Automation.Language.FunctionDefinitionAst] -and $_.Name -ceq $name })
    if ($definition.Count -ne 1) { throw 'FUNCTION_SHAPE' }
    $commands = $definition[0].Body.FindAll({param($a) $a -is [Management.Automation.Language.CommandAst]},$true)
    foreach ($command in $commands) {
        if ($command.GetCommandName() -cne 'Read-Fn07ChildLine') { throw 'NON_PURE_COMMAND' }
    }
    foreach ($call in $definition[0].Body.FindAll({param($a) $a -is [Management.Automation.Language.InvokeMemberExpressionAst]},$true)) {
        if ($call.Member.Value -cnotin @('GetString','TrimEnd','StartsWith')) { throw 'NON_PURE_METHOD' }
    }
    . ([scriptblock]::Create($definition[0].Extent.Text))
}
function Case([string]$raw,[bool]$complete,[string]$fail,[string]$clean,[string]$term,[Nullable[int]]$code,[bool]$late,[string]$first,[string]$second) {
    $bytes = [Text.Encoding]::ASCII.GetBytes($raw)
    $result = @(Format-Fn07Result $bytes $bytes.Length $complete $fail $clean $term $code $late)
    if ($result.Count -ne 2 -or $result[0] -cne $first -or $result[1] -cne $second) { throw 'RAM_MISMATCH' }
}
$lf=[char]10
$ok='SUPERVISOR=NONE|CLEANUP=NONE|CHILD=EXIT_CONFIRMED|EXIT=0|TOTAL=WITHIN'
$bad=$ok.Replace('NONE|CLEANUP','FORMAT|CLEANUP')
foreach ($line in 'NO_ELIGIBLE_SCOPE','NOT_FOUND_IN_SCOPE','UNKNOWN|IMAGE|IMAGE_HEADER',('IMAGE_BYTES_OBSERVED|claude.exe|'+('A'*64)+'|70000|1|'+('F'*64)),('WRAPPER_TARGET_UNKNOWN|claude.cmd|'+('A'*64)+'|99|1|-')) {
    Case ($line+$lf) $true NONE NONE EXIT_CONFIRMED 0 $false $line $ok
}
foreach ($line in 'NOT_FOUND_IN_SCOPE',("C:\private\SYNTHETIC_SECRET"+$lf),("UNKNOWN|IMAGE|SECRET"+$lf),(('X'*4095)+$lf),("NOT_FOUND_IN_SCOPE"+$lf+"NOT_FOUND_IN_SCOPE"+$lf)) {
    Case $line $true NONE NONE EXIT_CONFIRMED 0 $false UNKNOWN $bad
}
Case ('NOT_FOUND_IN_SCOPE'+$lf) $false STDERR NONE EXIT_CONFIRMED 0 $false UNKNOWN 'SUPERVISOR=STDERR|CLEANUP=NONE|CHILD=EXIT_CONFIRMED|EXIT=0|TOTAL=WITHIN'
Case '' $false SOURCE NONE NO_START $null $false UNKNOWN 'SUPERVISOR=SOURCE|CLEANUP=NONE|CHILD=NO_START|EXIT=-|TOTAL=WITHIN'
Case '' $false START NONE UNCONFIRMED $null $false UNKNOWN 'SUPERVISOR=START|CLEANUP=NONE|CHILD=UNCONFIRMED|EXIT=-|TOTAL=WITHIN'
Case '' $false PIPE STOP_UNCONFIRMED UNCONFIRMED 17 $true UNKNOWN 'SUPERVISOR=PIPE|CLEANUP=STOP_UNCONFIRMED|CHILD=UNCONFIRMED|EXIT=-|TOTAL=EXCEEDED'
Case '' $false TIME_LIMIT NONE EXIT_AFTER_STOP 9 $true UNKNOWN 'SUPERVISOR=TIME_LIMIT|CLEANUP=NONE|CHILD=EXIT_AFTER_STOP|EXIT=9|TOTAL=EXCEEDED'
Case ('NOT_FOUND_IN_SCOPE'+$lf) $true NONE NONE EXIT_CONFIRMED 0 $true UNKNOWN ($ok.Replace('WITHIN','EXCEEDED'))
Case ('UNKNOWN|RECHECK|OTHER'+$lf) $true NONE RECLAIM_FAILED EXIT_CONFIRMED 0 $true 'UNKNOWN|RECHECK|OTHER' ($ok.Replace('CLEANUP=NONE','CLEANUP=RECLAIM_FAILED').Replace('WITHIN','EXCEEDED'))
Case '' $false 'SYNTHETIC_SECRET' 'private-path' 'private-path' 11 $false UNKNOWN 'SUPERVISOR=INCOMPLETE|CLEANUP=RECLAIM_FAILED|CHILD=UNCONFIRMED|EXIT=-|TOTAL=WITHIN'
'PURE_RAM_OK'
`;
  const result=spawnSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
    ['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(checker,'utf16le').toString('base64')],
    {input:[current.toString('base64'),Buffer.from(supervisor).toString('base64')].join('\n')+'\n',encoding:'utf8',timeout:10000,maxBuffer:4096});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.stdout.trim(),'PURE_RAM_OK');
});
