# FN07 고정 IMAGE argv/env 단회 판독 실행 후보

**NOT_APPROVED_EXECUTION · GET 0.** 이 문서는 비실행 후보다. 새 직접 승인·Main의 단회 발행 기록과 이 문서의 정확 SHA가 결박되기 전에는 아래 블록을 실행하지 않는다. 과거 조회 승인은 이미 소진됐으며 이번 후보에 재사용하지 않는다.

## 원본과 고정 결박

- 기준 source: `2ab9f81d3b5d7cc042dd7fb80256bb23582cd511`.
- 원 감독 문서: `docs/work_packages/FN07_PUBLIC_QUERY_CHAIN_READ_CANDIDATE_20261116.md`, Git blob `6bde280bc241a59ca1cf2684037e6060c0a64135`, LF UTF8 25,472B, SHA256 `8A63AC9887635F3F1C82D15CDCE306797F17E7006D77F1E8C3A52E8DF1ADF384`.
- 판독 모듈: `scripts/fn07-fixed-image-argv-env-inspection.cjs`, Git blob `91485ccc992ee9c6a81a633ce394c10817fc608a`, LF UTF8 14,136B, SHA256 `87ED415BC2483B264EA0CEC2F895965C3E2D0725705B94804799C3FED3526F83`.
- parser: 기존 고정 Prettier 3.9.10 `babel.js`, 아래 절대경로 및 SHA256 `5249a89653aae718f7a0fb94577a09768f18b865df832cfe68d8158c8207af5c`. 같은 `parsers.babel.parse(text,{filepath:'sdk.mjs'})` ABI를 사용한다. parser·판독 모듈은 읽기 잠금을 보유하며 SDK 모듈은 로드하지 않는다.
- Node: 기존 `C:\Program Files\nodejs\node.exe`, 파일 버전24.22.1, SHA256 `D702DAA815EABBFF763C7D3808E235CF031CF2CA70211B56847BC72F51E240E5`.
- 공개 SDK 0.3.224 URL·압축 길이/SHA512 및 sdk.mjs/sdk.d.ts 길이/SHA256은 아래 원 감독 상수 그대로다. package-lock 및 선행 문서 3개의 원 고정 지문도 변경하지 않는다.

## 의도한 입력 한 조합과 추출 범위

AsyncIterable prompt, 원 AbortController/sessionId/model, 명시 보호 cwd/env, 명시 고정 IMAGE 실행 경로, executableArgs=[], 원 동기 spawn hook/도구 deny callback. maxTurns/maxBudgetUsd는 둘 다 없음. resume/continue/sessionStore/extraArgs·추가 인증·설정·체크포인트는 지정하지 않는다. 이 표기는 판독 질문이며 실제 SDK 옵션 객체·Query·recipe를 생성하지 않는다. 지원하지 않는 옵션이나 상속 환경을 기본값으로 보정하지 않는다.

1. 원 sdk.mjs 지문·전체 바이트를 먼저 검산한다. transport는 UTF8 anchor [775501,779350)을 포함하는 단 하나의 이름 initialize ClassMethod 전체를 추출한다. 고유 이름은 구조 후보일 뿐 어휘 결박의 증명이 아니다.
2. aT 전체 [1127782,1133713), Qwt 전체 [1134208,1134421)을 같은 전체 원문에서 판독한다. 일부 구간을 이어 붙여 완전한 함수로 만들지 않는다.
3. TM/SS/oye/be의 고유 top-level 함수 선언 또는 고유 변수의 function/arrow initializer 전체 범위를 기존 moduleInfo의 선언 판독 방식으로 추가한다. import·class·다중·누락·미지원 선언은 미확인이다. 함수명은 이 네 개 외 원문에서 출력하지 않는다. 별칭/재대입/동적 호출/추가 직접 의존의 의미는 자동 해석하지 않는다.
4. 동일 검산 문자열에서 이미 생성한 AST를 판독부에 재사용한다. 판독부는 자체 독립 바이트 복사본 SHA/길이를 다시 검산하며 문자열/고정 filepath가 달라지면 재사용하지 않는다. 노드/깊이/사실 한도는 검수 모듈 그대로, 추출 JSON은56,000B로 좁혀 전체 receipt64KiB의 여유를 남긴다.

출력은 receipt·SDK 지문·고정 입력조합 표식·의존 선언 상태·inspection 한 개다. inspection은 위치/지문, 배열·push의 순서 있는 허용 토큰, 옵션 별칭 위치, 허용 환경키의 설정/삭제/rename·조건 종류와 미확인 위치만 포함한다. 원문/임의 값/실제 경로/예외 메시지·stdout/stderr 내용은 없다. `EXTRACTED`는 선택 노드의 구문 추출만 뜻한다. `bindingIdentity/interpretation=UNCONFIRMED`, `recipeEligible=false`는 항상 유지한다.

## 중단·한도·회수

시도 namespace는 `FN07-FIXED-IMAGE-ARGV-ENV-20261120-01` 한 개다. Main이 이 문서 SHA와 단회 소진을 먼저 기록하고 승인된 정확 블록을1회 발행한다. 별도 승인 전 원격·SDK 조회는0이다. 실행 후 누락/실패/불명/잘림에도 새 발행·자동 재시도는0이다.

HTTPS GET 최대1, redirect/retry0, 요청10초, 감독27초+원 자식 회수 최대3초, 해제16MiB, stdout64KiB/stderr2KiB를 그대로 유지한다. parser/판독 모듈 사전 거절은 child exit1·PREPARED·getCalls0·requestClosed=false 및 부모의 정확 실패형이 함께 일치해야 GET0으로 확정한다. 그 외 충돌은 UNKNOWN이다. 외부 프로세스는 기존 고정 Node 감독 자식1개뿐이며 SDK import/eval/query/spawn, 설치, SDK 원문 디스크 저장, 사용자 자료/키/DB/서비스/권한/Agent 접근은0이다.

원본의 readOnce/unpack, 캡처·기한·원 handle 회수는 유지했다. 변경은 새 namespace/문서 지문, evidence 호출, 판독 모듈 사전 지문/ABI 및 읽기 잠금과 그 두 고정 pre-GET 코드뿐이다. 실제 플랫폼 거절은 우회하지 않는다. 정상/실패 모두 부모가 이미 발행한 원 handle만 종결 수거한다.

**GO 준비 완료로 올리지 않는 조건:** 선언 선택 누락·다중·범위 겹침/불연속, parser/모듈/SDK 지문·ABI 불일치, 출력/분석 한도 초과, 취소, 아래 조립의 구문·합성 검수 미완료. 실제 읽기 뒤 helper가 미지원이면 DEPENDENCY_UNRESOLVED, 판독 거절이면 INSPECTION_UNKNOWN/FAILED_OR_UNKNOWN으로 종결한다. 미확인 직접 호출·분기·외부 환경/기본값 때문에 한 조합의 전체 argv/env를 결정할 수 없으면 결과를 보존하고 중단하며 범위 확대/재조회/recipe 발행을 자동으로 하지 않는다. 이 후보는 그러한 미확인의 해소를 보장하지 않는다.

## 비실행 고정 블록

아래 JavaScript 및 PowerShell은 텍스트다. Main이 승인된 문서 SHA를 대입한 정확 PowerShell 블록만 별도 승인 뒤 실행한다. E2E 블록은 준비 검수에서 실행하지 않는다.

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
const receipt = {attempted:true, approvalId:'FN07-FIXED-IMAGE-ARGV-ENV-20261120-01', getCalls:0, requestClosed:false, stage:'PREPARED'};
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
  receipt.stage='PARSE_FIXED_IMAGE_ARGV_ENV';
  const bytes=entries.get('package/sdk.mjs');
  const source=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  const ast=parser.babel.parse(source,{filepath:'sdk.mjs'});
  if(ast.type!=='File'||ast.program.type!=='Program'||ast.errors?.length)stop('PARSE_FAILED');
  const units=[
    {role:'TRANSPORT',anchor:{lo:775501,hi:779350}},
    {role:'OPTIONS',lo:1127782,hi:1133713},
    {role:'QUERY',lo:1134208,hi:1134421}
  ];
  const dependencies=[];
  for(const name of ['TM','SS','oye','be']) {
    const declarations=[];
    for(const statement of ast.program.body) {
      const node=statement.type==='ExportNamedDeclaration'?statement.declaration:statement;
      if(!node)continue;
      if(['FunctionDeclaration','ClassDeclaration'].includes(node.type)&&node.id?.name===name)
        declarations.push(node.type==='FunctionDeclaration'?node:null);
      if(node.type==='VariableDeclaration')for(const d of node.declarations)
        if(d.id.type==='Identifier'&&d.id.name===name)
          declarations.push(['FunctionExpression','ArrowFunctionExpression'].includes(d.init?.type)?d.init:null);
      if(node.type==='ImportDeclaration')for(const s of node.specifiers)
        if(s.local?.name===name)declarations.push(null);
    }
    const node=declarations.length===1?declarations[0]:null;
    if(!node) { dependencies.push({role:name,status:declarations.length===0?'MISSING':declarations.length>1?'MULTIPLE':'UNSUPPORTED'}); continue; }
    if(!Number.isSafeInteger(node.start)||!Number.isSafeInteger(node.end)||node.start<0||node.end<=node.start||node.end>source.length)stop('DEPENDENCY_SPAN');
    const lo=Buffer.byteLength(source.slice(0,node.start)),hi=Buffer.byteLength(source.slice(0,node.end));
    units.push({role:name,lo,hi});
    dependencies.push({role:name,status:'DECLARATION_EXTRACTED',lo,hi,bindingIdentity:'UNCONFIRMED'});
  }
  units.sort((a,b)=>(a.anchor?.lo??a.lo)-(b.anchor?.lo??b.lo));
  const inspection=inspectFixedImageSource({bytes,
    expected:{sha256:expected['package/sdk.mjs'][1],byteLength:expected['package/sdk.mjs'][0],units},
    parser:{parse(text,options){if(text!==source||options.filepath!=='sdk.mjs')stop('PARSE_BINDING');return ast;}},
    limits:{outputBytes:56000}});
  const unresolved=dependencies.some(x=>x.status!=='DECLARATION_EXTRACTED');
  return {...receipt,state:inspection.status==='EXTRACTED'&&!unresolved?'WINDOWS_READ_VERIFIED_SOURCE':'FAILED_OR_UNKNOWN',
    ...(unresolved?{code:'DEPENDENCY_UNRESOLVED'}:inspection.status!=='EXTRACTED'?{code:'INSPECTION_UNKNOWN'}:{}),
    hashes:expected,review:'MANUAL_SCOPE_AND_DATAFLOW_REQUIRED',recipeEligible:false,
    inputCombination:'IMAGE_ASYNC_PROMPT_EXPLICIT_CWD_ENV_MODEL_SESSION_NO_MAX_LIMITS',
    dependencies,inspection};
}

let parser,inspectFixedImageSource;
(async()=>{
  try{
    const parserPath="C:\\Users\\cyhuh\\.codex\\worktrees\\av3-stage-b\\Anvil\\node_modules\\prettier\\plugins\\babel.js";
    let parserDigest;
    try{parserDigest=digest(require('node:fs').readFileSync(parserPath),'sha256','hex');}catch{stop('PARSER_HASH');}
    if(parserDigest!=='5249a89653aae718f7a0fb94577a09768f18b865df832cfe68d8158c8207af5c')stop('PARSER_HASH');
    try{parser=require(parserPath).parsers;}catch{stop('PARSER_ABI');}
    if(typeof parser?.babel?.parse!=='function'||typeof parser['babel-ts']?.parse!=='function')stop('PARSER_ABI');
    const inspectorPath="C:/Users/cyhuh/.codex/worktrees/av3-stage-b/Anvil/.av3-data/av3-stage-b-followup-worktree/scripts/fn07-fixed-image-argv-env-inspection.cjs";
    try{if(digest(require('node:fs').readFileSync(inspectorPath),'sha256','hex')!=='87ed415bc2483b264ea0cec2f895965c3e2d0725705b94804799c3fed3526f83')stop('INSPECTOR_HASH');}catch{stop('INSPECTOR_HASH');}
    try{({inspectFixedImageSource}=require(inspectorPath));}catch{stop('INSPECTOR_ABI');}
    if(typeof inspectFixedImageSource!=='function')stop('INSPECTOR_ABI');
    const result=evidence(unpack(await readOnce()));
    if(result.state==='FAILED_OR_UNKNOWN')process.exitCode=1;
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
$instruction=Join-Path (Get-Location) 'docs/work_packages/FN07_FIXED_IMAGE_ARGV_ENV_READ_EXECUTION_CANDIDATE.md'
$bytes=[IO.File]::ReadAllBytes($instruction)
$sha=[Security.Cryptography.SHA256]::Create()
try { $actual=[BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','') } finally { $sha.Dispose() }
if ($actual -cne $approvedHash) { throw 'CANDIDATE_HASH_MISMATCH' }
$js=[regex]::Matches($utf8.GetString($bytes),'(?ms)^`{3}javascript\r?\n(?<src>.*?)\r?\n`{3}\r?$')
$fixedDocs=@(
    @('package-lock.json','CA586E2DD02C11C41DA55A64AA4F07D3848936FE44DCA1897F8586AC4FB0F1D6'),
    @('docs/work_packages/FN07_REMAINING_SDK_SOURCE_READ_EXECUTION_20261116.md','1FF47992464E32B69C00BDA1AEFB761848634EAD4D4EB65837B646521820F529'),
    @('docs/work_packages/FN07_REMAINING_SDK_SOURCE_READ_CANDIDATE_20261116.md','D2E41B784F6AB8A842BB543221DFCBC4EA60396F62397F177A5545C229A3EB7F'),
    @('docs/work_packages/FN07_WINDOWS_LOCAL_PINNED_SOURCE_READ_CANDIDATE_20261115.md','921FEFEBE76A7FA7F1D4103CCF377C91A27DDE07CC6ABC62C95F5DE2039E5D23')
)
foreach ($pair in $fixedDocs) {
    if ((Get-FileHash -LiteralPath (Join-Path (Get-Location) $pair[0]) -Algorithm SHA256).Hash -cne $pair[1]) { throw 'SOURCE_BASIS_CHANGED' }
}
if ($js.Count -ne 1) { throw 'CANDIDATE_SOURCE_BLOCK' }
$source=$utf8.GetBytes($js[0].Groups['src'].Value)
$child = [Diagnostics.Process]::new()
$parserHandle=$null
$inspectorHandle=$null
$started = $false
$pidSeen = $null
$failure = 'LAUNCH_UNCONFIRMED'

function New-Capture($stream,[int]$cap) {
    $c = @{ stream=$stream; bytes=[byte[]]::new($cap+1); used=0; cap=$cap; eof=$false; task=$null }
    $c.task=$stream.ReadAsync($c.bytes,0,$c.bytes.Length)
    return $c
}
function Test-ParserPreGetFailure($record,$childExit) {
    if ($childExit -ne 1 -or $null -eq $record) { return $false }
    $keys=@($record.PSObject.Properties.Name | Sort-Object)
    if (($keys -join ',') -cne 'approvalId,attempted,code,getCalls,requestClosed,stage,state') { return $false }
    return ($record.approvalId -is [string] -and $record.approvalId -ceq 'FN07-FIXED-IMAGE-ARGV-ENV-20261120-01' -and
        $record.attempted -is [bool] -and $record.attempted -and
        ($record.getCalls -is [int] -or $record.getCalls -is [long]) -and $record.getCalls -eq 0 -and
        $record.requestClosed -is [bool] -and -not $record.requestClosed -and
        $record.state -is [string] -and $record.state -ceq 'FAILED_OR_UNKNOWN' -and
        $record.stage -is [string] -and $record.stage -ceq 'PREPARED' -and
        $record.code -is [string] -and $record.code -cin @('PARSER_HASH','PARSER_ABI','INSPECTOR_HASH','INSPECTOR_ABI'))
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
    $inspectorHandle=[IO.File]::Open('C:/Users/cyhuh/.codex/worktrees/av3-stage-b/Anvil/.av3-data/av3-stage-b-followup-worktree/scripts/fn07-fixed-image-argv-env-inspection.cjs',[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
    $inspectorSha=[Security.Cryptography.SHA256]::Create()
    try { $inspectorActual=[BitConverter]::ToString($inspectorSha.ComputeHash($inspectorHandle)).Replace('-','') } finally { $inspectorSha.Dispose() }
    if ($inspectorActual -cne '87ED415BC2483B264EA0CEC2F895965C3E2D0725705B94804799C3FED3526F83') { throw 'SOURCE_BASIS_CHANGED' }
    $parserHandle=[IO.File]::Open('C:\Users\cyhuh\.codex\worktrees\av3-stage-b\Anvil\node_modules\prettier\plugins\babel.js',[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
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
    if ($result.approvalId -cne 'FN07-FIXED-IMAGE-ARGV-ENV-20261120-01') { throw 'BAD_RECORD' }
    if (Test-ParserPreGetFailure $result $child.ExitCode) {
        [Console]::OpenStandardOutput().Write($out.bytes,0,$out.used)
        exit 1
    }
    if ($result.attempted -isnot [bool] -or -not $result.attempted -or
        ($result.getCalls -isnot [int] -and $result.getCalls -isnot [long]) -or $result.getCalls -ne 1 -or
        $result.requestClosed -isnot [bool] -or $result.stage -ceq 'PREPARED' -or
        $result.code -cin @('PARSER_HASH','PARSER_ABI','INSPECTOR_HASH','INSPECTOR_ABI')) { throw 'BAD_RECORD' }
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
} finally { $child.Dispose(); if ($parserHandle) { $parserHandle.Dispose() }; if ($inspectorHandle) { $inspectorHandle.Dispose() } }
```

## 조립 지문과 준비 검증의 범위

- JavaScript fenced body (LF UTF8, 마지막 개행 제외): 8329B / SHA256 `9e1dcfe07298535b3760d04e498c8b158a07c49a5261f8fe9633f607aff8c062`.
- PowerShell fenced body (LF UTF8, 마지막 개행 제외): 8383B / SHA256 `dc6ca52beddcb79bd123af7c4b9be8339528e0b780472d74fa16f957a6ba8ca1`.
- 허용 준비 검증은 문서 fence 추출·고정 원본 차이 대조·JS/PowerShell 구문 파싱, 합성 AST/메모리 입력뿐이다. SDK 전체 AST에 실제 적용하지 않았으므로 helper 존재/범위·최종 출력량·선택 분기의 완전성은 미검증이다.
- 최종 실행 결박과 별도 GET1 승인 판단은 Main/PMO가 담당한다. 실제 출력이 충분하더라도 PRESPAWN, 살아 있는 원 witness, 보호 package/cwd, 원 lease·child 소유·SDK/Agent 실행 권위는 별개로 남는다.

## 이번 준비 검증

2026-11-20 로컬 문서 검증만 수행했다. 178d78의 PowerShell 구문 파싱은 통과했다. 같은 실행의 다중 helper 합성 fixture가 중복 함수 선언을 사용해 parser 자체 거절로 중단됐으며, 이를 제품 실패로 분류하지 않는다. 합법 var 중복 fixture로 고친 45797f에서 exact evidence 함수만 메모리 입력으로 4건 확인했다: 전체7단위 추출, helper누락, helper다중, initialize부재. 문서의 HTTPS/IIFE/ProcessStart 감독 및 SDK 텍스트는 실행하지 않았다. JavaScript 구문 파싱·readOnce/unpack 원 Git 바이트 동일·두 fenced body 지문 일치도 확인했다. 이 검증은 실제 SDK 선택 범위나 실행안 운용 성공의 증거가 아니다.
