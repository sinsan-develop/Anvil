# FN07 Windows-local 고정 SDK 공개 원문 단발 읽기 후보

상태는 미채택·미실행이다. 이 문서의 작성·검토는 Windows-local 조회 승인이 아니다. READ2·3·4는 기존 Node REPL에서 DNS 조회가 실패했고 READ4 종료 시 검산 원문이 없었다. Windows-local `node.exe`의 DNS/TLS 도달성은 미확인이다.

## 원 계약과 실행 주체

기준은 `docs/work_packages/FN07_PINNED_SDK_HOOK_CONTRACT_READ_CANDIDATE_20261106.md` SHA-256 `2296F0EF805EB2F03D52E5FD30DD776AB1F45B14953BEC3D532FF51AB63236E9`이다. URL·압축물 및 두 원문 해시·10초 요청/소켓·16MiB 해제 상한·30초 실행 한도를 유지한다. OS/JS 런타임 전체의 메모리 사용량을 16MiB로 간주하지 않는다. 변경 사항은 Windows-local Node 자식 하나, stdin 전달, 부모의 시간·출력 감독, 같은 자식에서 미리 정한 네 가지 증거를 수집하고 종료하는 방식이다. 공개 Node 모듈은 `node:https`, `node:zlib`, `node:crypto`만 사용한다.

직접 승인 이후 Main은 정확한 문서 SHA와 새 승인 식별자가 결박된 시도 1건을 WORK_STATUS에 선기록한다. 단일 지정 수행자만 아래 **PowerShell 코드 블록 하나**에서 승인 해시 placeholder 하나를 대문자 64자리 값으로 치환한 뒤 `exec_command`에 전달한다. 작업 디렉터리는 원 문서가 있는 inner worktree 루트다. 감독 코드는 해당 문서의 bytes를 한 번 읽어 같은 bytes에서 해시와 유일한 JavaScript 블록을 검산·추출한다. 경로 인자나 별도 SDK 파일은 받지 않는다. 설정은 Windows PowerShell 호환 pwsh, `login:false`, `tty:false`, `sandbox_permissions:"require_escalated"`, 일회성 justification, 영속 prefix 없음이다. 출력 토큰 한도는 32000을 요청한다. 플랫폼 출력이 잘리면 해당 발췌는 미확인이다. 승인 심사 시간은 프로그램의 실행 시간과 구분한다.

도구 호출 전에 같은 승인 키에 대한 시도 발행 상태를 한 번만 세운다. 세션의 `functions.exec` store와 Main의 선기록이 함께 단일 발행을 구분한다. 승격 거절·도구 응답 유실·기존 세션 소실 시 자동 재발행하지 않는다. shell 내부 변수만으로 다른 실행의 중복을 막을 수 없다. 셸 handle이 남으면 기존 handle만 관측한다. shell stdout에 `WINDOWS_READ_VERIFIED_SOURCE`와 정상 종단이 모두 확인된 경우에만 원문 검산 완료로 기록한다.

## 전체 실행 본문

소스와 SDK tar·원문은 디스크에 쓰지 않는다. 실행 대상을 승인 문서에 결박하기 위해 Main이 읽은 개발 Node 메타데이터(bf5db2)를 고정한다. 절대경로는 `C:\Program Files\nodejs\node.exe`, FileVersion은 `24.22.1`, SHA-256은 `D702DAA815EABBFF763C7D3808E235CF031CF2CA70211B56847BC72F51E240E5`다. 시작 직전 이 경로의 파일을 읽기 공유로 열어 해시를 검산하고 시작 호출이 끝날 때까지 핸들을 보유한다. 부재·읽기 실패·해시 불일치는 자식 시작 전에 종료한다. 다른 실행 파일이나 URL을 찾지 않는다. 자식 환경은 Windows 시스템 디렉터리 변수만 전달하고, 프록시·인증 정보·추가 CA·Node preload·런타임 캐시 설정은 전달하지 않는다. SDK 원문은 문자열·바이트 판독에만 쓰인다.

```javascript
'use strict';
const https = require('node:https');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const url = 'https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/-/claude-agent-sdk-0.3.224.tgz';
const packedSize = 1110841;
const integrity = 'a4N8RcNf+8zqiTJjsntzJuYy3z/+J9K06/kVkZefNmAI8Yp4TmTZ+tpxUpKY8zhS8VewAxKSl9h0o/u7hKIdnA==';
const expected = {
  'package/sdk.d.ts': [333809,'556277033b15112811922d84ec8dc846d446cce7bd9aa27765c52a9c09869575'],
  'package/sdk.mjs': [1145192,'70e00a3ee54a88382ca606893ac3c4acdd9bb83a9e11a9d3e803fa0b63389ed5']
};
const receipt = {attempted:true, getCalls:0, requestClosed:false, stage:'PREPARED'};
function stop(code) { throw Object.assign(new Error(code), {candidateCode:code}); }
function digest(bytes, alg, enc) { return crypto.createHash(alg).update(bytes).digest(enc); }

function readOnce() {
  if (receipt.getCalls !== 0) stop('DUPLICATE');
  const packed = Buffer.alloc(packedSize);
  return new Promise((resolve,reject) => {
    let request, ended=false, done=false, size=0;
    const t0=performance.now();
    const finish=(error)=>{
      if(done)return;
      if(!error && !(ended && receipt.requestClosed))return;
      done=true; clearTimeout(timer);
      if(error){if(request && !request.destroyed)request.destroy(); reject(error);}
      else if(performance.now()-t0>=10000)reject({candidateCode:'ABSOLUTE_TIMEOUT'});
      else resolve(packed);
    };
    const timer=setTimeout(()=>finish({candidateCode:'ABSOLUTE_TIMEOUT'}),10000);
    receipt.getCalls++; receipt.stage='HTTPS_GET';
    try {
      request=https.get(url,{agent:false,rejectUnauthorized:true,timeout:10000,
        headers:{Accept:'application/octet-stream','Accept-Encoding':'identity'}},res=>{
        res.on('error',finish);
        res.once('aborted',()=>finish({candidateCode:'RESPONSE_ABORTED'}));
        if(res.statusCode!==200){receipt.httpStatus=res.statusCode; finish({candidateCode:'HTTP_STATUS'});return;}
        res.on('data',chunk=>{
          if(done)return;
          if(size+chunk.length>packedSize){finish({candidateCode:'PACKED_LIMIT'});return;}
          chunk.copy(packed,size); size+=chunk.length;
        });
        res.once('end',()=>{
          if(!res.complete || size!==packedSize){finish({candidateCode:'PACKED_LENGTH'});return;}
          ended=true; finish();
        });
      });
      request.on('error',finish);
      request.once('timeout',()=>finish({candidateCode:'SOCKET_TIMEOUT'}));
      request.once('close',()=>{receipt.requestClosed=true; finish();});
    } catch(err) {finish(err);}
  });
}

function unpack(packed) {
  receipt.stage='INTEGRITY';
  if(digest(packed,'sha512','base64')!==integrity)stop('PACKED_HASH');
  const tar=zlib.gunzipSync(packed,{maxOutputLength:16777216});
  const entries=new Map();
  for(let offset=0;offset<tar.length;){
    if(tar.length-offset<512)stop('TAR_HEADER');
    const h=tar.subarray(offset,offset+512);
    if(h.every(b=>b===0))break;
    const str=(from,to)=>h.subarray(from,to).toString('utf8').split('\0',1)[0];
    const name=str(0,100), octal=str(124,136).trim();
    if(!/^[0-7]+$/.test(octal))stop('TAR_SIZE');
    const size=parseInt(octal,8),body=offset+512,next=body+Math.ceil(size/512)*512;
    if(next>tar.length)stop('TAR_BOUNDS');
    if(Object.hasOwn(expected,name) && !str(345,500)){
      if(entries.has(name) || ![0,48].includes(h[156]))stop('TAR_ENTRY');
      const view=tar.subarray(body,body+size);
      if(size!==expected[name][0] || digest(view,'sha256','hex')!==expected[name][1])stop('ENTRY_HASH');
      entries.set(name,view);
    }
    offset=next;
  }
  if(entries.size!==2)stop('ENTRY_MISSING');
  receipt.packedBytes=packed.length; receipt.unpackedBytes=tar.length;
  return entries;
}

function evidence(entries) {
  receipt.stage='EXCERPTS';
  const d='package/sdk.d.ts', j='package/sdk.mjs';
  // ASCII anchor positions are original, zero-based UTF-8 byte offsets.
  function matches(file,anchor) {
    const bytes=entries.get(file), hits=[];
    let at=-1;
    while((at=bytes.indexOf(anchor,at+1,'utf8'))!==-1)hits.push(at);
    return hits;
  }
  const wants=[], notes=[];
  function select(kind,file,anchor,radius,count,near=[]) {
    const hits=matches(file,anchor);
    const ranked=near.length?hits.slice().sort((a,b)=>{
      const distance=x=>Math.min(...near.map(p=>Math.abs(p-x)));
      return distance(a)-distance(b)||a-b;
    }):hits;
    // With no adjacency hint, include the first and the last occurrence when possible.
    const picked=ranked.length<=count?ranked:count===1||near.length?ranked.slice(0,count):
      [...ranked.slice(0,count-1),ranked[ranked.length-1]];
    notes.push({kind,file,anchor,found:hits.length,selected:picked});
    for(const at of picked)wants.push({kind,file,at,anchor,radius});
    return picked;
  }
  const hooks=select('hook-call',j,'spawnClaudeCodeProcess',2700,2);
  select('hook-declaration',d,'spawnClaudeCodeProcess',2000,2);
  const tools=select('tool-call',j,'canUseTool',2100,2);
  select('tool-declaration',d,'CanUseTool',1700,2);
  select('argv-build',j,'--input-format',2000,1,hooks);
  select('env-build',j,'process.env',1900,1,hooks);
  select('tool-decision',d,'PermissionResult',1750,2);
  select('tool-decision',j,'updatedInput',1800,1,tools);
  select('argv-build',j,'--session-id',1700,1,hooks);
  select('argv-build',j,'--output-format',1500,1,hooks);
  select('tool-decision',j,'permission_response',1800,1,tools);
  select('tool-declaration',d,'canUseTool',1300,1);
  // Evidence windows are neither parsed declarations nor certifications of alias identity.
  function interval(w) {
    const bytes=entries.get(w.file);
    let lo=Math.max(0,w.at-w.radius), hi=Math.min(bytes.length,w.at+w.anchor.length+w.radius);
    // Only extend the window to nearby line boundaries. A minified line can be huge.
    const before=bytes.subarray(Math.max(0,lo-220),lo).lastIndexOf(10);
    if(before>=0)lo=Math.max(0,lo-220)+before+1;
    const after=bytes.subarray(hi,Math.min(bytes.length,hi+220)).indexOf(10);
    if(after>=0)hi+=after+1;
    while(lo>0 && (bytes[lo]&192)===128)lo--;
    while(hi<bytes.length && (bytes[hi]&192)===128)hi++;
    return {file:w.file,lo,hi};
  }
  function merge(windows) {
    const ranges=[];
    for(const r of [...windows].sort((a,b)=>a.file.localeCompare(b.file)||a.lo-b.lo)){
      const prev=ranges.at(-1);
      if(prev && prev.file===r.file && r.lo<=prev.hi)prev.hi=Math.max(prev.hi,r.hi);
      else ranges.push({...r});
    }
    return ranges;
  }
  function packet(ranges,omitted) {
    return {...receipt,state:'WINDOWS_READ_VERIFIED_SOURCE',hashes:expected,review:'REQUIRES_REVIEW',
      anchors:notes,omittedWindows:omitted,ranges:ranges.map(r=>({...r,
        text:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(entries.get(r.file).subarray(r.lo,r.hi))}))};
  }
  let ranges=[], omitted=0;
  for(const w of wants){
    const next=merge([...ranges,interval(w)]);
    // Reserve 1 KiB for terminal metadata. Never truncate text to fit an output quota.
    if(Buffer.byteLength(JSON.stringify(packet(next,omitted)))<=64512)ranges=next;
    else omitted++;
  }
  return packet(ranges,omitted);
}

(async()=>{
  try{
    const result=evidence(unpack(await readOnce()));
    const line=JSON.stringify(result)+'\n';
    if(Buffer.byteLength(line)>65536)stop('STDOUT_LIMIT');
    process.stdout.write(line);
  }catch(err){
    process.exitCode=1;
    const raw=err?.candidateCode||err?.code;
    const code=typeof raw==='string' && /^[A-Z0-9_]{1,56}$/.test(raw)?raw:'SOURCE_FAILED';
    process.stdout.write(JSON.stringify({...receipt,state:'FAILED_OR_UNKNOWN',code})+'\n');
  }
})();
```

```powershell
$ErrorActionPreference = 'Stop'
$clock = [Diagnostics.Stopwatch]::StartNew()
$utf8 = [Text.UTF8Encoding]::new($false,$true)
# Read only the reviewed instruction document. Main substitutes its approved SHA-256.
$approvedHash='__APPROVED_DOCUMENT_SHA256__'
$instruction=Join-Path (Get-Location) 'docs/work_packages/FN07_WINDOWS_LOCAL_PINNED_SOURCE_READ_CANDIDATE_20261115.md'
$bytes=[IO.File]::ReadAllBytes($instruction)
$sha=[Security.Cryptography.SHA256]::Create()
try { $actual=[BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','') } finally { $sha.Dispose() }
if ($actual -cne $approvedHash) { throw 'CANDIDATE_HASH_MISMATCH' }
$js=[regex]::Matches($utf8.GetString($bytes),'(?ms)^`{3}javascript\r?\n(?<src>.*?)\r?\n`{3}\r?$')
if ($js.Count -ne 1) { throw 'CANDIDATE_SOURCE_BLOCK' }
$source=$utf8.GetBytes($js[0].Groups['src'].Value)
$child = [Diagnostics.Process]::new()
$started = $false
$pidSeen = $null
$failure = 'LAUNCH_UNCONFIRMED'

function New-Capture($stream,[int]$cap) {
    $c = @{ stream=$stream; bytes=[byte[]]::new($cap+1); used=0; cap=$cap; eof=$false; task=$null }
    $c.task=$stream.ReadAsync($c.bytes,0,$c.bytes.Length)
    return $c
}
function Receive-Ready($c) {
    if ($c.eof -or -not $c.task.IsCompleted) { return }
    $n=$c.task.GetAwaiter().GetResult()
    if ($n -eq 0) { $c.eof=$true; return }
    $c.used += $n
    if ($c.used -gt $c.cap) { throw 'CAPTURE_LIMIT' }
    $c.task=$c.stream.ReadAsync($c.bytes,$c.used,$c.bytes.Length-$c.used)
}

try {
    $exe='C:\Program Files\nodejs\node.exe'
    $psi=[Diagnostics.ProcessStartInfo]::new()
    $psi.FileName=$exe
    $psi.Arguments='--input-type=commonjs -'
    $psi.UseShellExecute=$false
    $psi.CreateNoWindow=$true
    $psi.RedirectStandardInput=$true
    $psi.RedirectStandardOutput=$true
    $psi.RedirectStandardError=$true
    $psi.StandardInputEncoding=$utf8
    $psi.EnvironmentVariables.Clear()
    foreach ($name in @('SystemRoot','WINDIR')) {
        $value=[Environment]::GetEnvironmentVariable($name)
        if ($value) { $psi.EnvironmentVariables[$name]=$value }
    }
    $child.StartInfo=$psi
    $failure='NODE_IMAGE_UNAVAILABLE'
    $image=[IO.File]::Open($exe,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
    try {
        $imageSha=[Security.Cryptography.SHA256]::Create()
        try { $hash=[BitConverter]::ToString($imageSha.ComputeHash($image)).Replace('-','') } finally { $imageSha.Dispose() }
        if ($hash -cne 'D702DAA815EABBFF763C7D3808E235CF031CF2CA70211B56847BC72F51E240E5') { throw 'NODE_IMAGE_CHANGED' }
        if ($clock.ElapsedMilliseconds -ge 27000) { throw 'WATCHDOG' }
        $failure='LAUNCH_UNCONFIRMED'
        if (-not $child.Start()) { throw 'START_FAILED' }
        $started=$true
    } finally { $image.Dispose() }
    $pidSeen=$child.Id
    $failure='OUTPUT_OR_CHILD_UNKNOWN'
    $out=New-Capture $child.StandardOutput.BaseStream 65536
    $err=New-Capture $child.StandardError.BaseStream 2048
    $inputStream=$child.StandardInput.BaseStream
    $writing=$inputStream.WriteAsync($source,0,$source.Length)
    $sealed=$false
    while ($clock.ElapsedMilliseconds -lt 27000) {
        Receive-Ready $out
        Receive-Ready $err
        if (-not $sealed -and $writing.IsCompleted) {
            [void]$writing.GetAwaiter().GetResult()
            $child.StandardInput.Close()
            $sealed=$true
        }
        if ($sealed -and $child.HasExited -and $out.eof -and $err.eof) { break }
        [Threading.Thread]::Sleep(10)
    }
    if ($clock.ElapsedMilliseconds -ge 27000) { throw 'WATCHDOG' }
    if ($err.used -ne 0) { throw 'UNEXPECTED_STDERR' }
    $line=$utf8.GetString($out.bytes,0,$out.used)
    if (-not $line.EndsWith([char]10) -or $line.TrimEnd([char]10).Contains([char]10)) { throw 'MISSING_RECORD' }
    $result=ConvertFrom-Json -InputObject $line -ErrorAction Stop
    if ($result.attempted -ne $true -or $result.getCalls -ne 1) { throw 'BAD_RECORD' }
    if ($child.ExitCode -eq 0 -and $result.state -eq 'WINDOWS_READ_VERIFIED_SOURCE' -and $result.requestClosed -eq $true) {
        [Console]::OpenStandardOutput().Write($out.bytes,0,$out.used)
        exit 0
    }
    if ($child.ExitCode -eq 1 -and $result.state -eq 'FAILED_OR_UNKNOWN') {
        [Console]::OpenStandardOutput().Write($out.bytes,0,$out.used)
        exit 1
    }
    throw 'BAD_EXIT'
} catch {
    $specific=$_.Exception.Message
    if ($specific -in @('NODE_IMAGE_CHANGED','CAPTURE_LIMIT','WATCHDOG','START_FAILED','UNEXPECTED_STDERR','MISSING_RECORD','BAD_RECORD','BAD_EXIT')) {
        $failure=$specific
    }
    $settled=$false
    if ($started) {
        try {
            if (-not $child.HasExited) { $child.Kill() }
            $left=[int][Math]::Min(3000L,[Math]::Max(0L,30000L-$clock.ElapsedMilliseconds))
            $settled=$child.WaitForExit($left)
        } catch { $settled=$false }
    }
    [Console]::WriteLine((@{state='SUPERVISOR_FAILED_OR_UNKNOWN';code=$failure;dispatchSpent=$true;
        childStarted=$started;childPid=$pidSeen;childExitObserved=$settled;getCalls='UNKNOWN'} | ConvertTo-Json -Compress))
    exit 1
} finally { $child.Dispose() }
```

## 검토·판정

- 원문 확인 단위는 ① hook의 온전한 callback 선언과 반환형 ② 같은 hook의 실제 호출 및 반환값 사용 ③ 그 호출의 argv 조립과 필수 env 키·값의 출처 ④ 도구 결정 callback의 선언과 실제 allow/deny 응답 소비 분기다. `anchors`의 검색어는 조사 위치를 찾는 용도다. 문자열 존재, 가장 가까운 `process.env`, init의 도구 목록만으로 필수값이나 허가 의미를 정하지 않는다.
- `ranges`는 파일별 원문 바이트 오프셋 `[lo, hi)`와 연속된 UTF-8 본문이다. 겹치는 구간을 합쳐 원 순서로 전달한다. `anchors.found/selected`는 발견 수와 선택 위치이고, 총량에 맞지 않아 제외한 창 개수는 `omittedWindows`다. 기술 검토에서는 각 항목의 완전한 선언/호출·반환/조건 분기가 한 구간 또는 빈틈 없이 이어진 원문 안에 있고, 별칭과 값의 출처가 대조되는 경우만 근거로 채택한다. 잘린 구문·확인되지 않은 별칭·실행별 동적 값·이어지지 않는 인용은 해당 항목 미확인이다. `WINDOWS_READ_VERIFIED_SOURCE`는 두 원문 해시를 확인했다는 결과다.
- 자식 정상 stdout은 메타데이터와 JSON escaping을 포함해 UTF-8 65536바이트 이하이다. 감독부는 stdout 65536/별도 stderr 2048바이트에 각각 초과 탐지 1바이트만 더 할당한다. stderr·환경·스택 원문은 보고하지 않는다. 27초에 정상 대기를 중단하고 최대 남은 3초로 이 호출이 얻은 Process 핸들의 종료를 확인한다. 이미 끝난 자식은 재종료하지 않는다. 트리 종료·PID 재선택·다른 프로세스 조사·SDK 실행은 없다. OS 스케줄링과 동기 OS 호출의 실시간 정착을 시험한 것은 아니다.
- 송신 전 문서 무결성 또는 도구 실패, DNS·TLS·HTTP·크기·해시·해제·시간·출력 오류, 결과 유실은 승인 소진 내역과 함께 구분해서 기록한다. 자식 종료와 원문·발췌의 완전성은 각각 확인한다. 증거가 없는 GET 도달 여부·생존 핸들 수는 불명이다. 기존 시도를 재실행하지 않는다. Main은 성공한 경우 원자료 대신 허용된 근거 위치와 확인·미확인 항목을 결과서에 남긴다.
- 실제 설치·실행파일/cwd·argv/env/Secret 효과 허용·SDK tool 결정 권위·Query/child/SID 소유·STOP·DB·등록키·서비스·Agent는 이 읽기 후보의 산출물이 아니다. Windows-local에서 이 후보를 실행하거나 테스트하지 않았다.
