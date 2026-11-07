import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const literal = 'apps/connector/native/SourceReadObserver.cs', absolute = 'C:\\qa\\apps\\connector\\native\\SourceReadObserver.cs';
const denied = (file: string, reason = 'Access is denied.') => `error CS1504: Source file '${file}' could not be opened ('${reason}')\r\n`;
const cases = [
  { name: '인자 원문과 접근 거절을 분리', raw: denied(literal), role: 'SOURCE_LITERAL', reason: 'ACCESS_DENIED' },
  { name: '정확 절대경로와 없음', raw: denied(absolute, 'The system cannot find the file specified.'), role: 'SOURCE_ABSOLUTE', reason: 'NOT_FOUND' },
  { name: '같은 basename의 다른 디렉터리', raw: denied('C:\\different\\SourceReadObserver.cs', 'Win32 error 32'), role: 'SOURCE_BASENAME_ELSEWHERE', reason: 'SHARING_VIOLATION' },
  { name: '다른 CS 입력을 현재 source로 승격 금지', raw: denied('other.cs', '0x8007007b'), role: 'OTHER_SOURCE', reason: 'OTHER_OS_REASON' },
  { name: '미지 이유의 비밀 표식 비반사', raw: denied(literal, 'SYNTHETIC_PRIVATE_MARKER'), role: 'SOURCE_LITERAL', reason: 'UNKNOWN' },
  { name: '별칭은 자동 정규화하지 않음', raw: denied('./' + literal), role: 'UNKNOWN', reason: 'ACCESS_DENIED' },
  { name: '복수 CS1504는 미확정', raw: denied(literal) + denied('other.cs'), role: 'UNKNOWN', reason: 'UNKNOWN' },
  { name: '불완전 EOF는 미확정', raw: denied(literal), complete: false, role: 'UNKNOWN', reason: 'UNKNOWN' },
  { name: '성공 주장에 CS1504가 섞여도 원인 판정 안 함', raw: denied(literal), exitCode: 0, noDetail: true },
  { name: 'CS1504 없는 출력은 추정하지 않음', raw: 'error CS0006: synthetic metadata missing\r\n', noDetail: true },
  { name: '지역화 이유는 합성 byte catalog의 정확 일치만', raw: `error CS1504: 소스 파일 '${literal}'을 열 수 없습니다. ('접근 거절 합성')\r\n`, catalog: { '5': { utf8: Buffer.from('접근 거절 합성').toString('base64'), ansi: '' } }, role: 'SOURCE_LITERAL', reason: 'ACCESS_DENIED' },
  { name: 'UTF8이 아닌 바이트에서도 ASCII CS 문법 보존', rawBytes: Buffer.from([...Buffer.from(denied(literal)), 0x81, 0xfe, 0xff]).toString('base64'), role: 'SOURCE_LITERAL', reason: 'ACCESS_DENIED' },
  { name: '16KiB 초과는 고정 오류만', raw: 'SYNTHETIC_PRIVATE_MARKER'.repeat(800), error: 'A3_DIAG_INPUT_INVALID' },
  { name: '허용 밖 catalog는 고정 오류만', raw: denied(literal), catalog: { '99': { utf8: 'QQ==', ansi: '' } }, error: 'A3_DIAG_INPUT_INVALID' },
  { name: 'stderr의 진단도 같은 제한으로 처리', raw: '', rawStderr: denied(literal), role: 'SOURCE_LITERAL', reason: 'ACCESS_DENIED' },
  { name: 'builtin과 catalog의 이유 충돌은 미확정', raw: denied(literal), catalog: { '2': { utf8: Buffer.from('Access is denied.').toString('base64'), ansi: '' } }, role: 'SOURCE_LITERAL', reason: 'UNKNOWN' },
  { name: '32개 뒤 추가 진단은 상한 초과를 드러냄', raw: 'error CS0006: synthetic\r\n'.repeat(32) + denied(literal), noDetail: true, limitHit: true },
  { name: '대소문자 별칭은 다른 디렉터리로 추정하지 않음', raw: denied('Apps/connector/native/SourceReadObserver.cs'), role: 'UNKNOWN', reason: 'ACCESS_DENIED' },
  { name: '중복 구분자는 다른 위치로 확정하지 않음', raw: denied('C:\\different\\\\SourceReadObserver.cs'), role: 'UNKNOWN', reason: 'ACCESS_DENIED' },
  { name: '구간 끝점 별칭은 미확정', raw: denied('C:\\different.\\SourceReadObserver.cs'), role: 'UNKNOWN', reason: 'ACCESS_DENIED' },
  { name: '구간 끝공백 별칭은 미확정', raw: denied('C:\\different \\SourceReadObserver.cs'), role: 'UNKNOWN', reason: 'ACCESS_DENIED' },
  { name: 'expected 경로의 중복 구분자는 거절', raw: denied(literal), expected: 'C:\\qa\\\\apps\\connector\\native\\SourceReadObserver.cs', error: 'A3_DIAG_INPUT_INVALID' },
  { name: 'expected 경로의 끝점 구간은 거절', raw: denied(literal), expected: 'C:\\qa.\\apps\\connector\\native\\SourceReadObserver.cs', error: 'A3_DIAG_INPUT_INVALID' },
  { name: 'expected 경로의 끝공백 구간은 거절', raw: denied(literal), expected: 'C:\\qa \\apps\\connector\\native\\SourceReadObserver.cs', error: 'A3_DIAG_INPUT_INVALID' },
];
test('A3 컴파일 진단은 소유한 합성 bytes만 분류하고 경로·이유 원문을 반환하지 않는다', async t => {
  const inputs = cases.map(item => ({ stdout: item.rawBytes ?? Buffer.from(item.raw!).toString('base64'), stderr: Buffer.from(item.rawStderr ?? '').toString('base64'), exitCode: item.exitCode ?? 1, complete: item.complete ?? true, expected: item.expected ?? absolute, catalog: item.catalog ?? {} }));
  const script = String.raw`
$ErrorActionPreference='Stop'
. (Join-Path (Get-Location).Path 'scripts/source-read-compile-diagnostics.ps1')
$cases=ConvertFrom-Json -AsHashtable ([Console]::In.ReadToEnd())
$results=@(foreach($case in $cases){
 try{
  $stdout=[Convert]::FromBase64String($case.stdout);$stderr=[Convert]::FromBase64String($case.stderr);$before=[Convert]::ToBase64String($stdout);$beforeError=[Convert]::ToBase64String($stderr)
  $catalog=@{};foreach($code in $case.catalog.Keys){$catalog[$code]=@{utf8=[Convert]::FromBase64String($case.catalog[$code].utf8);ansi=[Convert]::FromBase64String($case.catalog[$code].ansi)}}
  $result=Get-A3CompileDiagnostic -Stdout $stdout -Stderr $stderr -ExitCode $case.exitCode -Complete $case.complete -ExpectedAbsoluteSource $case.expected -OsReasons $catalog
  @{result=$result;inputUnchanged=([Convert]::ToBase64String($stdout) -ceq $before -and [Convert]::ToBase64String($stderr) -ceq $beforeError)}
 }catch{@{error=if($_.Exception.Message -ceq 'A3_DIAG_INPUT_INVALID'){'A3_DIAG_INPUT_INVALID'}else{'UNEXPECTED_TEST_ERROR'}}}
})
ConvertTo-Json -InputObject $results -Depth 8 -Compress`;
  const wire = execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { input: JSON.stringify(inputs), encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 65536 });
  const output = JSON.parse(wire); assert.equal(output.length, cases.length);
  for (const [i, fixture] of cases.entries()) await t.test(fixture.name, () => {
    const value = output[i];
    if (fixture.error) { assert.deepEqual(value, { error: fixture.error }); return; }
    assert.equal(value.inputUnchanged, true); assert.equal(value.result.executionAuthorized, false); assert.equal(value.result.actualExecutionVerified, false);
    assert.equal(value.result.diagnosticLimitHit, fixture.limitHit ?? false);
    assert.deepEqual(value.result.stdout, { capturedBytes: Buffer.from(inputs[i]!.stdout, 'base64').length, sha256: createHash('sha256').update(Buffer.from(inputs[i]!.stdout, 'base64')).digest('hex') });
    assert.deepEqual(value.result.stderr, { capturedBytes: Buffer.from(inputs[i]!.stderr, 'base64').length, sha256: createHash('sha256').update(Buffer.from(inputs[i]!.stderr, 'base64')).digest('hex') });
    if (fixture.noDetail) assert.equal(value.result.sourceOpenFailure, null);
    else assert.deepEqual(value.result.sourceOpenFailure, { fileRole: fixture.role, osReason: fixture.reason });
    const rendered = JSON.stringify(value); for (const hidden of [literal, absolute, 'SYNTHETIC_PRIVATE_MARKER', '접근 거절 합성']) assert.equal(rendered.includes(hidden), false);
  });
});
