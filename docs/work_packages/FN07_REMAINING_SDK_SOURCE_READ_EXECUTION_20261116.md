# FN07 남은 SDK 공개 원문 단발 조회 실행 검토본

직접 승인한 조회의 시도 식별자는 `FN07-REMAINING-SOURCE-20261116-D2E41B78`이다. 후보 SHA-256 `D2E41B784F6AB8A842BB543221DFCBC4EA60396F62397F177A5545C229A3EB7F`, 기존 Windows 감독안 SHA-256 `921FEFEBE76A7FA7F1D4103CCF377C91A27DDE07CC6ABC62C95F5DE2039E5D23`에 결박한다. 기술검수 완료 후 Main GO에서만 지정 수행자가 실행한다. Main은 새 시도 식별자와 이 문서의 최종 SHA·발행을 선기록한다. 수행자는 동일 키의 functions.exec store 단발 발행 표시를 도구 호출 전에 세운다. 이전 45123a 시도를 재사용하지 않는다. 검토와 구문 검산은 발행이 아니다.

## 실행

inner worktree 루트에서 아래 PowerShell 블록 하나의 `__APPROVED_DOCUMENT_SHA256__`만 Main이 확인한 이 실행본의 대문자 SHA-256으로 바꾼다. 기존 Windows-local 방식으로 login:false, tty:false, sandbox_permissions:require_escalated, 일회성 justification, 영속 prefix 없이 exec_command 한 번을 발행한다. max_output_tokens:32000. 세션이 반환되면 같은 handle만 수거한다. 도구 거절·출력 유실·타임아웃 시 재시도하지 않는다.

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
const receipt = {attempted:true, approvalId:'FN07-REMAINING-SOURCE-20261116-D2E41B78', getCalls:0, requestClosed:false, stage:'PREPARED'};
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
  receipt.stage='SELECT_REMAINING';
  const d='package/sdk.d.ts', j='package/sdk.mjs', sections=[], notes=[];
  const text={}; for(const file of [d,j])text[file]=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(entries.get(file));
  const bytes=(f,i)=>Buffer.byteLength(text[f].slice(0,i));
  function candidate(kind,f,lo,hi){
    const b=entries.get(f); lo=Math.max(0,lo);hi=Math.min(b.length,hi);
    while(lo>0 && (b[lo]&192)===128)lo--;
    while(hi<b.length && (b[hi]&192)===128)hi++;
    if(lo<hi)sections.push({kind,file:f,lo,hi});
  }
  function declarations(name) {
    const pattern=new RegExp('^(?:export\\s+)?(?:declare\\s+)?(?:type|interface)\\s+'+name+'\\b','gm');
    const hits=[...text[d].matchAll(pattern)];notes.push({kind:name,found:hits.length});
    for(const m of hits.slice(0,2)){
      const after=m.index+m[0].length, tail=text[d].slice(after);
      const end=tail.search(/^(?:export\s+(?![ *{])|declare\s+(?:type|interface|class|function|const)\b)/m);
      const a=bytes(d,m.index), h=end<0?entries.get(d).length:bytes(d,after+end);
      candidate(name,d,a,Math.min(h,a+9000));if(end<0||h-a>9000)notes.push({kind:name,boundaryUnconfirmed:true});
    }
  }
  function hits(kind,rx,radius,max,score){
    const found=[...text[j].matchAll(rx)].map(m=>({i:m.index,n:m[0].length,
      rank:score?score(text[j].slice(Math.max(0,m.index-700),m.index+1500),m):0}));
    found.sort((a,b)=>b.rank-a.rank||a.i-b.i);
    notes.push({kind,found:found.length,selected:Math.min(max,found.length)});
    for(const v of found.slice(0,max)){const at=bytes(j,v.i);candidate(kind,j,at-radius,bytes(j,v.i+v.n)+radius);}
  }
  declarations('CanUseTool');declarations('PermissionResult');
  // Fixed offsets come from the previous verified bytes. Extend both sides of the same call,
  // including argument construction upstream and use of its returned child downstream.
  candidate('spawn-args-env-child',j,773100,784400);
  candidate('query-option-origin',j,1128600,1134300);
  const scoreTool=(s,m)=> (/\bawait\b/.test(s)?2:0)+(/behavior/.test(s)?4:0)+(/updatedInput|updated_input/.test(s)?3:0)+(/toolUseID|tool_use_id/.test(s)?2:0)+(/can_use_tool|permission/.test(s)?1:0)+(/canUseTool\s*(?:\?\.)?\s*\(/.test(m[0])?6:0);
  hits('tool-handler',/\bcanUseTool\b(?:\s*(?:\?\.)?\s*\()?/g,1600,5,scoreTool);
  hits('tool-request-and-result',/["']can_use_tool["']|\bupdatedInput\b|\bupdated_input\b/g,1350,5,scoreTool);
  hits('decision-branch',/\.behavior\s*(?:===?|!==?)\s*["'](?:allow|deny)["']|case\s*["'](?:allow|deny)["']/g,1050,3,scoreTool);
  for(const name of ['oye','TM','SS']){
    const rx=new RegExp('(?:\\bfunction\\s+'+name+'\\s*\\(|\\b(?:var|let|const)\\s+'+name+'\\s*=|(?:^|[,;])\\s*'+name+'\\s*=(?!=))','g');
    hits('binding-'+name,rx,850,2);
  }
  hits('child-event-use',/this\.process(?:\?\.|\.)(?:on|once|stderr|exitCode|kill|stdin|stdout)\b/g,720,4,
    (s,m)=> ((s.includes('stderr')||s.includes('exit'))?3:0)+(Math.abs(bytes(j,m.index)-779200)<30000?4:0));
  function merge(xs){
    const result=[];
    for(const v of xs.slice().sort((a,b)=>a.file.localeCompare(b.file)||a.lo-b.lo)){
      const p=result.at(-1);
      if(p&&p.file===v.file&&v.lo<=p.hi){p.hi=Math.max(p.hi,v.hi);if(!p.kinds.includes(v.kind))p.kinds.push(v.kind);}
      else result.push({file:v.file,lo:v.lo,hi:v.hi,kinds:[v.kind]});
    }
    return result;
  }
  function packet(xs,omitted){return {...receipt,state:'WINDOWS_READ_VERIFIED_SOURCE',review:'REQUIRES_REVIEW',hashes:expected,notes,omitted,
    ranges:merge(xs).map(x=>({...x,text:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(entries.get(x.file).subarray(x.lo,x.hi))}))};}
  const kept=[],omitted=[];
  for(const v of sections){
    if(Buffer.byteLength(JSON.stringify(packet([...kept,v],omitted)))<=61500)kept.push(v);
    else omitted.push({kind:v.kind,file:v.file,lo:v.lo,hi:v.hi});
  }
  return packet(kept,omitted);
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
$instruction=Join-Path (Get-Location) 'docs/work_packages/FN07_REMAINING_SDK_SOURCE_READ_EXECUTION_20261116.md'
$bytes=[IO.File]::ReadAllBytes($instruction)
$sha=[Security.Cryptography.SHA256]::Create()
try { $actual=[BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','') } finally { $sha.Dispose() }
if ($actual -cne $approvedHash) { throw 'CANDIDATE_HASH_MISMATCH' }
$js=[regex]::Matches($utf8.GetString($bytes),'(?ms)^`{3}javascript\r?\n(?<src>.*?)\r?\n`{3}\r?$')
$fixedDocs=@(
    @('docs/work_packages/FN07_REMAINING_SDK_SOURCE_READ_CANDIDATE_20261116.md','D2E41B784F6AB8A842BB543221DFCBC4EA60396F62397F177A5545C229A3EB7F'),
    @('docs/work_packages/FN07_WINDOWS_LOCAL_PINNED_SOURCE_READ_CANDIDATE_20261115.md','921FEFEBE76A7FA7F1D4103CCF377C91A27DDE07CC6ABC62C95F5DE2039E5D23')
)
foreach ($pair in $fixedDocs) {
    if ((Get-FileHash -LiteralPath (Join-Path (Get-Location) $pair[0]) -Algorithm SHA256).Hash -cne $pair[1]) { throw 'SOURCE_BASIS_CHANGED' }
}
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
        if ([Diagnostics.FileVersionInfo]::GetVersionInfo($exe).FileVersion -cne '24.22.1') { throw 'NODE_IMAGE_CHANGED' }
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
    if ($result.approvalId -cne 'FN07-REMAINING-SOURCE-20261116-D2E41B78') { throw 'BAD_RECORD' }
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

## 증거 판독

두 고정 파일은 같은 GET의 검산된 메모리 tar에서만 사용한다. 해제 16MiB는 OS 전체 메모리 한도가 아니다. GET 및 소켓 각각 10초, 감독 27초와 원 자식 회수 최대 잔여 3초, stdout 65536B·stderr 2048B를 유지한다. 실행 코드는 범위의 공개 SDK 텍스트를 UTF-8 바이트 오프셋과 함께 반환한다. SDK 원문은 파일에 저장하지 않으며 import/eval/실행하지 않는다. 환경변수 값·인증 자료·SDK 로컬 설치는 조사하지 않는다.

`CanUseTool` 선언은 시작부터 다음 top-level 선언까지의 원문에서 인자와 반환형 끝을 확인한다. tool 응답은 실제 callback 호출·await 결과와 allow/deny 소비를 같은 변수 흐름으로 잇는다. query 인자·환경은 고정된 hook 호출의 변수와 상류 조립·별칭 정의를 대조한다. child는 해당 호출 반환 객체의 stdio·오류·종료 사용을 대조한다. `notes`의 점수·발견 개수, 가까운 이름, 서로 떨어진 창만으로 동일 흐름을 인정하지 않는다. `omitted`·잘린 선언·중복 별칭·stdout 도구 잘림 등으로 필요한 연결이 없으면 해당 항목만 미확인으로 남긴다. 정상 종단은 두 원문의 무결성 확인이며 제품 효과 또는 전체 분기 검증이 아니다. 추가 GET·실제 Agent 실행은 없다.
