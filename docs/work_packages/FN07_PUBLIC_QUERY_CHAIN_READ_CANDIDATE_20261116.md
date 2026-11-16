# FN07 공개 query 진입과 생성 함수 연결 확인 후보

**미채택 · GET 0 · 실행 승인 전.** 요청할 효과는 SDK 0.3.224의 기존 고정 공개 tarball을 Windows에서 한 번 읽고, 메모리에서 정적 구문을 판독하는 것이다. 앞선 두 승인은 이미 소진됐다. 이 후보의 SHA-256을 명시한 새 직접 승인과 Main의 발행 기록이 있어야 아래 블록을 한 번 실행할 수 있다.

## 왜 같은 배포본을 다시 읽어야 하는가

45123a와 8aa1c8은 선택한 원문 6구간과 8구간을 모두 반환했다. 상위 구현 구간의 합집합 [1128600,1136143)은 옵션 구조분해 중간부터 시작한다. 공개 진입의 반환값과 생성 함수 호출, env/cwd/executable/canUseTool의 공개 이름부터 내부 변수까지를 한 흐름으로 인수하지 못했다. 이번에는 전체 검산 원문에서 export 노드와 생성 함수를 찾고 **온전한 선택 노드**를 출력한다. 도구 콜백·프로세스 hook 자체의 소비는 기존 결과서(2ABE77AA…DA5B)를 사용한다.

로컬 root lock의 TypeScript 7.0.2는 패키지 기본 내보내기가 version.cjs이고, 기존 async AST API는 별도 compiler 프로세스를 사용한다. 단일 Node 감독부를 유지하기 위해 같은 lock에 설치된 개발 의존 Prettier 3.9.10의 단일 babel.js를 고정한다. 이 플러그인의 babel과 babel-ts는 JS·선언 파일을 구문 데이터로만 읽는다. 고정 개발 모듈 지문은 실행 블록에 있다. 새 SDK·compiler 설치, SDK import/eval/실행·디스크 원문 저장, 사용자 자료·설정·키·DB·서비스 조회는 0이다.

## 판정과 발행

1. d.ts의 공개 query 선언, mjs의 query export와 정확 local 이름(기존 Qwt 추정 포함), 그 모듈 선언, prompt/options가 전달된 호출, 같은 생성 함수의 구조분해와 반환 노드를 UTF-8 [lo,hi)로 대조한다. 근접 문자열이나 같은 이름만으로 연결하지 않는다.
2. 생성 함수는 실제 new 식의 spawnClaudeCodeProcess 옵션 전달로 식별한다. 선언·전체 함수·개별 반환은 구분한다. 리뷰에서 module binding의 shadow/재대입·호출 인자·반환 경로, queryInstance와 같은 transport/Query 연결까지 실제 원문으로 추적한다. 동적/간접 export, 여러 선언이나 경로, 미지원 문법·scope·출력 한도로 연결을 못 읽은 항목은 미확인이다. 노드 행이 커서 제외되면 잘라서 성공 처리하지 않는다.
3. SHA/UTF-8 원문 검증 성공과 체인 검증 성공을 따로 기록한다. 이 조회가 실제 프로세스 소유자·허용 프로그램/cwd/Secret/도구 정책을 승인하지 않는다.
4. 승인 후에만 inner worktree에서 아래 PowerShell의 `__APPROVED_DOCUMENT_SHA256__` 자리를 결정된 후보 지문으로 치환한다. Main과 수행자는 새 시도 키 `FN07-PUBLIC-QUERY-CHAIN-20261116`를 선기록한 뒤 login:false/tty:false/require_escalated, 영속 prefix 없이 단 한 번 발행한다. GET 최대 1, redirect/retry 0, 요청 10초, 감독 27초+원 자식 회수 잔여 3초, 해제 최대 16 MiB, stdout 64 KiB/stderr 2 KiB, 도구 반환 예산 32000토큰이다. 세션이 생기면 같은 핸들만 수거한다. 불명·잘림·승인 거절·부분 실패 시 재발행하지 않는다.

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
const receipt = {attempted:true, approvalId:'FN07-PUBLIC-QUERY-CHAIN-20261116', getCalls:0, requestClosed:false, stage:'PREPARED'};
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
  receipt.stage='PARSE_QUERY_CHAIN';
  const source={}, program={}, rows=[], issues=[];
  const d='package/sdk.d.ts', j='package/sdk.mjs';
  function problem(key){if(!issues.includes(key))issues.push(key);}
  for(const [file,language] of [[d,'babel-ts'],[j,'babel']]){
    source[file]=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(entries.get(file));
    const ast=parser[language].parse(source[file],{filepath:file});
    if(ast.type!=='File'||ast.program.type!=='Program'||ast.errors?.length)stop('PARSE_FAILED');
    program[file]=ast.program.body;
  }
  function row(file,kind,n){
    if(!n||!Number.isInteger(n.start)||!Number.isInteger(n.end)||n.end<=n.start)return problem('INVALID_SPAN');
    const text=source[file].slice(n.start,n.end),lo=Buffer.byteLength(source[file].slice(0,n.start)),hi=lo+Buffer.byteLength(text);
    if(!entries.get(file).subarray(lo,hi).equals(Buffer.from(text)))return problem('INVALID_BYTE_SPAN');
    if(rows.some(x=>x.file===file&&x.kind===kind&&x.lo===lo&&x.hi===hi))return;
    const item={file,kind,lo,hi,text};
    if(rows.length>=32||Buffer.byteLength(JSON.stringify([...rows,item]))>56000){problem('COMPLETE_NODE_BUDGET');return;}
    rows.push(item);
  }
  function moduleInfo(file){
    const defs=new Map(), exported=[];
    const define=(name,node,fn)=>{if(!name)return;const all=defs.get(name)||[];all.push({node,fn});defs.set(name,all);};
    for(const stmt of program[file]){
      const ex=stmt.type==='ExportNamedDeclaration',decl=ex?stmt.declaration:stmt;
      if(ex)for(const spec of stmt.specifiers||[]){
        if(spec.exported?.name==='query'||spec.exported?.value==='query'){
          if(stmt.source||spec.type!=='ExportSpecifier'){problem('INDIRECT_EXPORT');continue;}
          exported.push({local:spec.local.name,node:spec});
        }
      }
      if(!decl)continue;
      if(decl.type==='VariableDeclaration')for(const v of decl.declarations){
        if(v.id?.type!=='Identifier')continue;
        define(v.id.name,v,v.init);if(ex&&v.id.name==='query')exported.push({local:'query',node:v});
      } else if(decl.id?.type==='Identifier'){
        define(decl.id.name,decl,decl);if(ex&&decl.id.name==='query')exported.push({local:'query',node:stmt});
      }
    }
    return {defs,exported};
  }
  const js=moduleInfo(j),dt=moduleInfo(d);
  function findExport(file,info){
    if(info.exported.length!==1){problem(file===d?'DECL_EXPORT_UNRESOLVED':'JS_EXPORT_UNRESOLVED');return;}
    const ex=info.exported[0];row(file,'public_query_export',ex.node);
    const hits=info.defs.get(ex.local)||[];
    if(hits.length!==1){problem('NONUNIQUE_MODULE_BINDING');return;}
    return {name:ex.local,...hits[0]};
  }
  const decl=findExport(d,dt);if(decl)row(d,'query_complete_declaration',decl.node);
  const entry=findExport(j,js);if(entry)row(j,'query_entry_complete',entry.node);
  function each(root,visit){
    const stack=[root];
    while(stack.length){
      const n=stack.pop();if(!n||typeof n.type!=='string')continue;
      if(visit(n)===false)continue;
      for(const [k,v] of Object.entries(n)){
        if(['loc','range','extra','tokens','errors','comments','leadingComments','trailingComments','innerComments'].includes(k))continue;
        if(Array.isArray(v)){for(let i=v.length-1;i>=0;i--)stack.push(v[i]);}
        else if(v&&typeof v==='object')stack.push(v);
      }
    }
  }
  const functionLike=n=>n&&['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type);
  function inside(fn,visit){each(fn,n=>n!==fn&&functionLike(n)?false:visit(n));}
  // Find the enclosing module function by the actual transport option property in its new-expression.
  // Report complete function and its parameters. No offset window or textual nearest-name lookup.
  const target=[];
  for(const [name,values] of js.defs)for(const def of values){
    if(!functionLike(def.fn))continue;
    inside(def.fn,n=>{
      if(n.type!=='NewExpression')return;
      const props=n.arguments?.[0]?.properties||[];
      if(!props.some(p=>!p.computed&&p.key?.name==='spawnClaudeCodeProcess'&&
        p.value?.type==='MemberExpression'&&!p.value.computed&&p.value.property.name==='spawnClaudeCodeProcess'))return;
      target.push({name,...def,transport:n});
    });
  }
  if(target.length!==1){problem('TRANSPORT_FACTORY_UNRESOLVED');}
  else {
    const factory=target[0];
    row(j,'transport_factory_complete',factory.node);
    // Also retain the whole binding declaration(s), return and hook origin if a whole parent exceeds the budget.
    for(const p of factory.fn.params||[])row(j,'factory_parameter',p);
    inside(factory.fn,n=>{
      if(n.type==='VariableDeclarator'&&n.id.type==='ObjectPattern'&&
        n.id.properties.some(p=>['cwd','canUseTool','env','executable','executableArgs'].includes(p.key?.name)))row(j,'options_destructure_complete',n);
      if(n.type==='ReturnStatement')row(j,'factory_return',n);
    });
    row(j,'construct_transport',factory.transport);
    if(entry&&functionLike(entry.fn)){
      const links=[];inside(entry.fn,n=>{if(n.type==='CallExpression'&&n.callee?.type==='Identifier'&&n.callee.name===factory.name)links.push(n);});
      for(const n of links)row(j,'candidate_direct_factory_call',n);
      if(entry.name!==factory.name&&links.length!==1){
        // Follow only syntactic calls to one top-level declaration. Full bodies let the reviewer
        // reject a shadow, reassignment, unused call or a result other than the returned Query.
        const paths=[];
        function seek(name,fn,path,depth){
          if(depth===0||paths.length>1)return;
          const calls=[];inside(fn,n=>{if(n.type==='CallExpression'&&n.callee?.type==='Identifier')calls.push(n);});
          for(const call of calls){
            const next=call.callee.name,defs=js.defs.get(next);
            if(!defs||defs.length!==1||!functionLike(defs[0].fn)||path.some(x=>x.name===next)||next===entry.name)continue;
            const extended=[...path,{name:next,call,def:defs[0]}];
            if(next===factory.name){paths.push(extended);if(paths.length>1)return;}
            else seek(next,defs[0].fn,extended,depth-1);
          }
        }
        seek(entry.name,entry.fn,[],3);
        if(paths.length===1)for(const hop of paths[0]){
          row(j,'candidate_factory_hop',hop.call);
          if(hop.name!==factory.name)row(j,'intermediate_complete',hop.def.node);
        }else problem('UNIQUE_CALL_PATH_UNRESOLVED');
      }
    }else problem('ENTRY_NOT_DIRECT_FUNCTION');
  }
  return {...receipt,state:'WINDOWS_READ_VERIFIED_SOURCE',hashes:expected,review:'MANUAL_SCOPE_AND_DATAFLOW_REQUIRED',issues,ranges:rows};
}

let parser;
(async()=>{
  try{
    const parserPath="C:\\Users\\cyhuh\\.codex\\worktrees\\av3-stage-b\\Anvil\\node_modules\\prettier\\plugins\\babel.js";
    if(digest(require('node:fs').readFileSync(parserPath),'sha256','hex')!=='5249a89653aae718f7a0fb94577a09768f18b865df832cfe68d8158c8207af5c')stop('PARSER_HASH');
    parser=require(parserPath).parsers;
    if(typeof parser?.babel?.parse!=='function'||typeof parser['babel-ts']?.parse!=='function')stop('PARSER_ABI');
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
$instruction=Join-Path (Get-Location) 'docs/work_packages/FN07_PUBLIC_QUERY_CHAIN_READ_CANDIDATE_20261116.md'
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
    if ($result.approvalId -cne 'FN07-PUBLIC-QUERY-CHAIN-20261116') { throw 'BAD_RECORD' }
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
} finally { $child.Dispose(); if ($parserHandle) { $parserHandle.Dispose() } }
```
