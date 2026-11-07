[CmdletBinding()]
param([string]$ApprovalSha256 = '')

if ($MyInvocation.InvocationName -ceq '.') { return }

# 검토용 실행 소스. 사람 승인 원문과 이 기록의 결박은 Main이 확인한다.
# 관측 한도는 종료/반환 보장이 아니다. 불명에서 kill, 삭제, 재실행은 하지 않는다.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$candidate = 'FN03_NATIVE_CONTENT_COMPILE_ONLY_20261107_02'
$repository = 'C:\Users\cyhuh\.codex\worktrees\av3-stage-b\Anvil'
$gitRoot = 'D:\Project\Anvil\.git'
$worktreeMetadata = Join-Path $gitRoot 'worktrees\Anvil'
$branchRef = 'refs/heads/codex/av3-stage-b'
$sourceCheckpoint = '93bca154cdc64527d320d2a7b9aad1b7d381f75a'
$planPath = Join-Path $repository 'docs\work_packages\FN03_NATIVE_CONTENT_COMPILE_ONLY_EXECUTION_CANDIDATE_20261107.md'
$planHash = '01203E641DA2BC4DA720E3EA5F7143D0718661CF9702927D83B1148B71366285'
$launcherPath = Join-Path $repository 'scripts\run-fn03-native-content-compile-only.ps1'
$approvalPath = Join-Path $repository 'docs\approvals\FN03_NATIVE_CONTENT_COMPILE_ONLY_20261107_02.json'
$hostPath = 'C:\Program Files\PowerShell\7\pwsh.exe'
$hostHash = '2A6769A3330DC1084D0154BFDE7D164AB750CA7F700F313F9D417C1BE78B2233'
$hostBytes = 301360
$hostVersion = '7.6.9'
$hostAssemblyPath = 'C:\Program Files\PowerShell\7\pwsh.dll'
$hostAssemblyHash = '682C403FD13E667FF9C67F28750C8FEDEC8AD60F962662D83642B48A6C3F2154'
$hostAssemblyBytes = 157480
$ownerName = 'SINSAN\cyhuh'
$qaParent = 'D:\Project\Anvil\.av3-data'
$qaRoot = Join-Path $qaParent 'fn03-content-compile-20261107-02'
$markerPath = Join-Path $qaParent 'fn03-content-compile-20261107-02.consumed.json'
$sourceDirectory = Join-Path $qaRoot 'src'
$binaryDirectory = Join-Path $qaRoot 'bin'
$tempDirectory = Join-Path $qaRoot 'temp'
$outputRelative = 'bin/SourceContentObserverSource.dll'
$outputPath = Join-Path $binaryDirectory 'SourceContentObserverSource.dll'
$resultPath = Join-Path $qaRoot 'result.json'
$bcl = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319'
$compilerTimeoutMs = 15000
$diagnosticLimit = 16384
$readSize = 4096
$maximumDiagnostics = 128
$maximumWindowMs = 1800000
$utf8 = [Text.UTF8Encoding]::new($false, $true)

$sources = @(
    @{path='apps/connector/native/SourceContentObserver.cs'; bytes=39004; sha256='C714C4C16DFF65794D9B7B40D7D0B3DCDFA34849E33ACF211EB1A06CD04E4482'}
    @{path='tests/native/FN03/SourceContentObserverSourceTests.cs'; bytes=17557; sha256='8806E2A72C35449429E07BFA217D06D10B3FE25345E8D97473A3257B5723AB08'}
)
$tools = @(
    @{path=(Join-Path $bcl 'csc.exe'); bytes=2569832; sha256='46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00'}
    @{path=(Join-Path $bcl 'mscorlib.dll'); bytes=5445432; sha256='11AC114C43ECF6996BEF58BA3C99FBA3693A4560A84EEADDE54D193060DC626C'}
    @{path=(Join-Path $bcl 'System.dll'); bytes=3545264; sha256='2B3C17C6208A0B4B6BEB94E1A066F99BA06CDB2EA919479E99D47E8C6D96DC71'}
    @{path=(Join-Path $bcl 'System.Core.dll'); bytes=1551104; sha256='8B898BED54AE8CC61F9C58CC3EB062724F8357D2BDDA338B5D363654ECFF333D'}
)
$sourceCopies = @(
    (Join-Path $sourceDirectory 'SourceContentObserver.cs')
    (Join-Path $sourceDirectory 'SourceContentObserverSourceTests.cs')
)
$compilerArgs = @(
    '/noconfig', '/nologo', '/nostdlib+', '/target:library', '/debug-', '/optimize-',
    '/warn:4', '/warnaserror+', '/platform:anycpu', '/codepage:65001', '/utf8output',
    "/out:$outputPath", "/reference:$($tools[1].path)", "/reference:$($tools[2].path)",
    "/reference:$($tools[3].path)", $sourceCopies[0], $sourceCopies[1]
)

function Fail([string]$Code) { throw [InvalidOperationException]::new($Code) }

function Get-Sha256([byte[]]$Bytes) {
    return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($Bytes))
}

function Assert-Keys($Value, [string[]]$Keys) {
    if ($Value -isnot [Collections.IDictionary] -or $Value.Count -ne $Keys.Count) { Fail 'APPROVAL_SHAPE_INVALID' }
    foreach ($key in $Keys) {
        if ($Value.Keys -cnotcontains $key) { Fail 'APPROVAL_SHAPE_INVALID' }
    }
}

function Assert-UniqueJsonKeys([System.Text.Json.JsonElement]$Value) {
    if ($Value.ValueKind -eq [System.Text.Json.JsonValueKind]::Object) {
        $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        foreach ($property in $Value.EnumerateObject()) {
            if (!$seen.Add($property.Name)) { Fail 'APPROVAL_SHAPE_INVALID' }
            Assert-UniqueJsonKeys $property.Value
        }
    } elseif ($Value.ValueKind -eq [System.Text.Json.JsonValueKind]::Array) {
        foreach ($item in $Value.EnumerateArray()) { Assert-UniqueJsonKeys $item }
    }
}

function Assert-Number($Value, [long]$Expected) {
    if (($Value -isnot [int] -and $Value -isnot [long]) -or $Value -ne $Expected) { Fail 'APPROVAL_BINDING_INVALID' }
}

function Assert-Text($Value, [string]$Expected) {
    if ($Value -isnot [string] -or $Value -cne $Expected) { Fail 'APPROVAL_BINDING_INVALID' }
}

function Assert-FileBindings($Actual, [object[]]$Expected) {
    if ($Actual -isnot [array] -or $Actual.Count -ne $Expected.Count) { Fail 'APPROVAL_BINDING_INVALID' }
    for ($index = 0; $index -lt $Expected.Count; $index++) {
        Assert-Keys $Actual[$index] @('path','bytes','sha256')
        Assert-Text $Actual[$index].path $Expected[$index].path
        Assert-Number $Actual[$index].bytes $Expected[$index].bytes
        Assert-Text $Actual[$index].sha256 $Expected[$index].sha256
    }
}

function Get-CheckedItem([string]$Path, [bool]$Directory, [bool]$SystemLeaf = $false) {
    $item = Get-Item -LiteralPath $Path -Force
    if ($item.FullName -cne $Path -or
        ($Directory -and $item -isnot [IO.DirectoryInfo]) -or
        (!$Directory -and $item -isnot [IO.FileInfo])) { Fail 'PATH_IDENTITY_UNVERIFIED' }
    $cursor = $item
    if ($SystemLeaf) {
        if ($Directory -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
            $item.LinkType -notin @($null, '', 'HardLink') -or
            (Get-Acl -LiteralPath $Path).Owner -cne 'NT SERVICE\TrustedInstaller') { Fail 'SYSTEM_FILE_IDENTITY_UNVERIFIED' }
        $cursor = $item.Directory
    }
    while ($null -ne $cursor) {
        if (($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $cursor.LinkType) { Fail 'PATH_LINK_UNVERIFIED' }
        if ($cursor -is [IO.FileInfo]) { $cursor = $cursor.Directory }
        else { $cursor = $cursor.Parent }
    }
    return $item
}

function Assert-PrivatePath([string]$Path, [bool]$Directory) {
    $null = Get-CheckedItem $Path $Directory
    $acl = Get-Acl -LiteralPath $Path
    if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $ownerSid) { Fail 'QA_OWNER_UNVERIFIED' }
    $rightsByOwner = @{}
    foreach ($rule in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
        $sid = $rule.IdentityReference.Value
        if ($sid -cnotin @($ownerSid, 'S-1-5-18') -or $rule.AccessControlType -ne 'Allow') { Fail 'QA_ACL_UNVERIFIED' }
        $rightsByOwner[$sid] = [long]$rightsByOwner[$sid] -bor [long]$rule.FileSystemRights
    }
    $fullControl = [long][Security.AccessControl.FileSystemRights]::FullControl
    foreach ($sid in @($ownerSid, 'S-1-5-18')) {
        if (!$rightsByOwner.ContainsKey($sid) -or ($rightsByOwner[$sid] -band $fullControl) -ne $fullControl) { Fail 'QA_ACL_UNVERIFIED' }
    }
}

function Assert-File([string]$Path, [long]$Bytes, [string]$Sha256, [bool]$SystemLeaf = $false) {
    $file = Get-CheckedItem $Path $false $SystemLeaf
    if ($file.Length -ne $Bytes -or (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash -cne $Sha256) { Fail 'FILE_BINDING_UNVERIFIED' }
}

function Read-SmallText([string]$Path, [long]$MaximumBytes) {
    $file = Get-CheckedItem $Path $false
    if ($file.Length -lt 1 -or $file.Length -gt $MaximumBytes) { Fail 'BOUND_TEXT_INVALID' }
    return $utf8.GetString([IO.File]::ReadAllBytes($Path))
}

function Assert-Commit([string]$Commit) {
    $expectedGitDir = "gitdir: $worktreeMetadata"
    if ((Read-SmallText (Join-Path $repository '.git') 4096).Trim().Replace('/', '\') -cne $expectedGitDir -or
        (Read-SmallText (Join-Path $worktreeMetadata 'HEAD') 4096).Trim() -cne "ref: $branchRef") { Fail 'WORKTREE_BINDING_INVALID' }
    $looseRef = Join-Path $gitRoot $branchRef
    if (Test-Path -LiteralPath $looseRef) {
        if ((Read-SmallText $looseRef 4096).Trim() -cne $Commit) { Fail 'EXECUTION_COMMIT_MISMATCH' }
        return
    }
    $packed = Read-SmallText (Join-Path $gitRoot 'packed-refs') 4194304
    $matchesForBranch = @($packed -split '\r?\n' | Where-Object { $_ -cmatch ('^[0-9a-f]{40} ' + [regex]::Escape($branchRef) + '$') })
    if ($matchesForBranch.Count -ne 1 -or $matchesForBranch[0] -cne "$Commit $branchRef") { Fail 'EXECUTION_COMMIT_MISMATCH' }
}

function Assert-Host {
    if (!$IsWindows -or [Environment]::ProcessPath -cne $hostPath -or $PSVersionTable.PSVersion.ToString() -cne $hostVersion) { Fail 'HOST_IDENTITY_UNVERIFIED' }
    # ProcessPath는 실행 호스트이고 관리 코드의 argv[0]은 별도 어셈블리다.
    $expected = @($hostAssemblyPath, '-NoProfile', '-NonInteractive', '-File', $launcherPath, '-ApprovalSha256', $ApprovalSha256)
    $actual = [Environment]::GetCommandLineArgs()
    if ($actual.Count -ne $expected.Count) { Fail 'HOST_ARGUMENTS_UNVERIFIED' }
    for ($index = 0; $index -lt $expected.Count; $index++) {
        if ($actual[$index] -cne $expected[$index]) { Fail 'HOST_ARGUMENTS_UNVERIFIED' }
    }
    try { Assert-File $hostPath $hostBytes $hostHash }
    catch { Fail 'HOST_EXECUTABLE_UNVERIFIED' }
    try { Assert-File $hostAssemblyPath $hostAssemblyBytes $hostAssemblyHash }
    catch { Fail 'HOST_ASSEMBLY_UNVERIFIED' }
}

function Read-Approval {
    if ($ApprovalSha256 -cnotmatch '^[0-9A-F]{64}$' -or $PSCommandPath -cne $launcherPath) { Fail 'APPROVAL_BINDING_REQUIRED' }
    $file = Get-CheckedItem $approvalPath $false
    if ($file.Length -lt 1 -or $file.Length -gt 16384) { Fail 'APPROVAL_SHAPE_INVALID' }
    $raw = [IO.File]::ReadAllBytes($approvalPath)
    if ((Get-Sha256 $raw) -cne $ApprovalSha256) { Fail 'APPROVAL_HASH_MISMATCH' }
    $text = $utf8.GetString($raw)
    $document = [System.Text.Json.JsonDocument]::Parse($text)
    try { Assert-UniqueJsonKeys $document.RootElement }
    finally { $document.Dispose() }
    $approval = $text | ConvertFrom-Json -AsHashtable -DateKind String
    Assert-Keys $approval @('schemaVersion','candidateId','decisionId','decisionSourceRef','authorization',
        'issuedAt','expiresAt','maximumRuns','executionCommit','sourceCheckpoint','planSha256','launcherSha256',
        'host','sources','tools','compilerSignatureBasis','qaRoot','consumedMarker','cwd','output','argv','limits')
    Assert-Number $approval.schemaVersion 1
    Assert-Text $approval.candidateId $candidate
    Assert-Text $approval.authorization 'APPROVED_COMPILE_ONLY'
    Assert-Text $approval.sourceCheckpoint $sourceCheckpoint
    Assert-Text $approval.planSha256 $planHash
    Assert-Number $approval.maximumRuns 1
    if ($approval.decisionId -isnot [string] -or $approval.decisionId -cnotmatch '^[A-Za-z0-9_-]{1,128}$' -or
        $approval.decisionSourceRef -isnot [string] -or $approval.decisionSourceRef -cnotmatch '^(call|turn)_[A-Za-z0-9_-]{1,128}$' -or
        $approval.executionCommit -isnot [string] -or $approval.executionCommit -cnotmatch '^[0-9a-f]{40}$' -or
        $approval.launcherSha256 -isnot [string] -or $approval.launcherSha256 -cnotmatch '^[0-9A-F]{64}$') { Fail 'APPROVAL_BINDING_INVALID' }
    Assert-Keys $approval.host @('path','bytes','sha256','version','commandLineAssembly')
    Assert-Text $approval.host.path $hostPath
    Assert-Number $approval.host.bytes $hostBytes
    Assert-Text $approval.host.sha256 $hostHash
    Assert-Text $approval.host.version $hostVersion
    $hostAssembly = $approval.host.commandLineAssembly
    Assert-Keys $hostAssembly @('path','bytes','sha256')
    Assert-Text $hostAssembly.path $hostAssemblyPath
    Assert-Number $hostAssembly.bytes $hostAssemblyBytes
    Assert-Text $hostAssembly.sha256 $hostAssemblyHash
    Assert-Text $approval.qaRoot $qaRoot
    Assert-Text $approval.consumedMarker $markerPath
    Assert-Text $approval.cwd $qaRoot
    Assert-Text $approval.output $outputRelative
    Assert-FileBindings $approval.sources $sources
    Assert-FileBindings $approval.tools $tools
    # Main이 원 사람 결정에서 이 역사 근거의 명시 채택을 확인한다. 현재 서명을 다시 조회하지 않는다.
    $signatureBasis = $approval.compilerSignatureBasis
    Assert-Keys $signatureBasis @('kind','evidenceRef','observedDate','observedStatus','publisher','compilerVersion','compilerSha256','acceptance')
    Assert-Text $signatureBasis.kind 'HISTORICAL_AUTHENTICODE_EXACT_BYTES'
    Assert-Text $signatureBasis.evidenceRef '93bca154cdc64527d320d2a7b9aad1b7d381f75a:docs/WORK_STATUS.md:6947,6950'
    Assert-Text $signatureBasis.observedDate '2026-10-17'
    Assert-Text $signatureBasis.observedStatus 'Valid'
    Assert-Text $signatureBasis.publisher 'Microsoft'
    Assert-Text $signatureBasis.compilerVersion '4.8.9221.0'
    Assert-Text $signatureBasis.compilerSha256 $tools[0].sha256
    Assert-Text $signatureBasis.acceptance 'EXPLICITLY_ACCEPTED_IN_DECISION_SOURCE'
    Assert-Keys $approval.limits @('windowMs','compilerMs','diagnosticBytes','readBytes','maximumDiagnostics')
    Assert-Number $approval.limits.windowMs $maximumWindowMs
    Assert-Number $approval.limits.compilerMs $compilerTimeoutMs
    Assert-Number $approval.limits.diagnosticBytes $diagnosticLimit
    Assert-Number $approval.limits.readBytes $readSize
    Assert-Number $approval.limits.maximumDiagnostics $maximumDiagnostics
    if ($approval.argv -isnot [array] -or $approval.argv.Count -ne $compilerArgs.Count) { Fail 'APPROVAL_BINDING_INVALID' }
    for ($index = 0; $index -lt $compilerArgs.Count; $index++) { Assert-Text $approval.argv[$index] $compilerArgs[$index] }
    return $approval
}

function Read-Instant($Value) {
    if ($Value -isnot [string] -or $Value -cnotmatch '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$') { Fail 'APPROVAL_TIME_INVALID' }
    return [DateTimeOffset]::ParseExact($Value, "yyyy-MM-dd'T'HH:mm:ss.fff'Z'",
        [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AssumeUniversal)
}

function Assert-Window {
    $now = [DateTimeOffset]::UtcNow
    if ($now -lt $issuedAt -or $now -ge $expiresAt -or $windowClock.Elapsed.TotalMilliseconds -ge $windowRemainingMs) {
        Fail 'APPROVAL_WINDOW_EXPIRED'
    }
}

function Assert-Inputs([bool]$IncludeCopies) {
    Assert-Window
    Assert-Commit $approval.executionCommit
    Assert-Host
    Assert-File $planPath 10061 $planHash
    $null = Get-CheckedItem $launcherPath $false
    if ((Get-FileHash -LiteralPath $launcherPath -Algorithm SHA256).Hash -cne $approval.launcherSha256 -or
        (Get-FileHash -LiteralPath $approvalPath -Algorithm SHA256).Hash -cne $ApprovalSha256) { Fail 'LAUNCH_BINDING_CHANGED' }
    for ($index = 0; $index -lt $sources.Count; $index++) {
        $source = $sources[$index]
        Assert-File (Join-Path $repository $source.path) $source.bytes $source.sha256
        if ($IncludeCopies) {
            Assert-PrivatePath $sourceCopies[$index] $false
            Assert-File $sourceCopies[$index] $source.bytes $source.sha256
        }
    }
    foreach ($tool in $tools) { Assert-File $tool.path $tool.bytes $tool.sha256 $true }
    Assert-Window
}

function Write-NewRecord([string]$Path, $Record) {
    $json = ConvertTo-Json -InputObject $Record -Depth 12 -Compress
    $bytes = $utf8.GetBytes($json)
    $stream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try {
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Flush($true)
    } finally { $stream.Dispose() }
    Assert-PrivatePath $Path $false
    Assert-File $Path $bytes.Length (Get-Sha256 $bytes)
    return $json
}

function Copy-NewSource([string]$From, [string]$To, $Fact) {
    $bytes = [IO.File]::ReadAllBytes($From)
    if ($bytes.Length -ne $Fact.bytes -or (Get-Sha256 $bytes) -cne $Fact.sha256) { Fail 'SOURCE_COPY_INPUT_CHANGED' }
    $stream = [IO.File]::Open($To, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) }
    finally { $stream.Dispose() }
    Assert-PrivatePath $To $false
    Assert-File $To $Fact.bytes $Fact.sha256
}

function Assert-DirectoryContents([string]$Directory, [string[]]$Names) {
    Assert-PrivatePath $Directory $true
    $entries = @(Get-ChildItem -LiteralPath $Directory -Force)
    if ($entries.Count -ne $Names.Count) { Fail 'QA_INVENTORY_UNVERIFIED' }
    foreach ($entry in $entries) {
        if ($Names -cnotcontains $entry.Name) { Fail 'QA_INVENTORY_UNVERIFIED' }
        Assert-PrivatePath $entry.FullName ($entry -is [IO.DirectoryInfo])
    }
}

function New-PipeState($Stream) {
    return @{stream=$Stream; buffer=[byte[]]::new($readSize); content=[IO.MemoryStream]::new();
        task=$null; reserved=0; eof=$false}
}

function Start-PipeRead($Pipe, [int]$Count) {
    $Pipe.reserved = $Count
    $Pipe.task = $Pipe.stream.ReadAsync($Pipe.buffer, 0, $Count)
}

function Read-Diagnostics([object[]]$Pipes) {
    $diagnostics = [Collections.Generic.List[object]]::new()
    $validEncoding = $true
    foreach ($pipe in $Pipes) {
        $bytes = $pipe.content.ToArray()
        try { $text = $utf8.GetString($bytes) }
        catch { $validEncoding = $false; $text = [Text.Encoding]::UTF8.GetString($bytes) }
        finally { [Array]::Clear($bytes, 0, $bytes.Length) }
        $lines = @($text -split '\r?\n')
        $lineCount = if ($pipe.eof) { $lines.Count } else { [Math]::Max(0, $lines.Count - 1) }
        for ($index = 0; $index -lt $lineCount; $index++) {
            $line = $lines[$index]
            $match = [regex]::Match($line, '^(?<file>[^()\r\n]+\.cs)\((?<line>[1-9][0-9]{0,6}),(?<col>[1-9][0-9]{0,6})\)\s*:\s*(?:fatal\s+)?(?:error|warning)\s+(?<code>CS[0-9]{4})\s*:')
            if ($match.Success) {
                $file = $match.Groups['file'].Value
                $name = $null
                foreach ($copy in $sourceCopies) {
                    $basename = [IO.Path]::GetFileName($copy)
                    if ($file -ceq $copy -or $file -ceq $basename -or $file -ceq "src\$basename") { $name = $basename }
                }
                if (!$name) { continue }
                $diagnostics.Add(@{code=$match.Groups['code'].Value; source=$name;
                    line=[int]$match.Groups['line'].Value; column=[int]$match.Groups['col'].Value})
            } else {
                $match = [regex]::Match($line, '^(?:CSC\s*:\s*)?(?:fatal\s+)?(?:error|warning)\s+(?<code>CS[0-9]{4})\s*:')
                if (!$match.Success) { continue }
                $diagnostics.Add(@{code=$match.Groups['code'].Value; source=$null; line=$null; column=$null})
            }
            if ($diagnostics.Count -gt $maximumDiagnostics) {
                $diagnostics.RemoveAt($maximumDiagnostics)
                return @{entries=$diagnostics.ToArray(); overflow=$true; validEncoding=$validEncoding}
            }
        }
    }
    return @{entries=$diagnostics.ToArray(); overflow=$false; validEncoding=$validEncoding}
}

function Record-Capture([object[]]$Pipes, $Result) {
    $Result.stdoutBytes = $Pipes[0].content.Length
    $Result.stderrBytes = $Pipes[1].content.Length
    $Result.stdoutEof = $Pipes[0].eof
    $Result.stderrEof = $Pipes[1].eof
    $diagnostics = Read-Diagnostics $Pipes
    $Result.diagnostics = $diagnostics.entries
    $Result.diagnosticOverflow = $diagnostics.overflow
    $Result.diagnosticEncodingVerified = $diagnostics.validEncoding
}

function Test-ObservationWindow {
    return $compilerClock.Elapsed.TotalMilliseconds -lt $compilerTimeoutMs -and
        $windowClock.Elapsed.TotalMilliseconds -lt $windowRemainingMs -and [DateTimeOffset]::UtcNow -lt $expiresAt
}

function Collect-Compiler($Compiler, [object[]]$Pipes, $Result) {
    # 최초 두 read는 호출자가 image 관측 전에 예약한다. 사용량과 진행 중 요청을 함께 차감한다.
    while (Test-ObservationWindow) {
        foreach ($pipe in $Pipes) {
            if ($null -eq $pipe.task -or !$pipe.task.IsCompleted) { continue }
            if (!(Test-ObservationWindow)) { return }
            $received = $pipe.task.GetAwaiter().GetResult()
            if ($received -lt 0 -or $received -gt $pipe.reserved) { Fail 'PIPE_LENGTH_UNVERIFIED' }
            if ($received -eq 0) { $pipe.eof = $true }
            else { $pipe.content.Write($pipe.buffer, 0, $received) }
            $pipe.task = $null
            $pipe.reserved = 0
        }
        if ($Compiler.HasExited) {
            $Result.exitObserved = $true
            $Result.exitCode = $Compiler.ExitCode
        }
        if ($Pipes[0].eof -and $Pipes[1].eof -and $Result.exitObserved) { return }
        $remaining = $diagnosticLimit
        foreach ($pipe in $Pipes) { $remaining -= ($pipe.content.Length + $pipe.reserved) }
        foreach ($pipe in $Pipes) {
            if ($pipe.eof -or $null -ne $pipe.task -or $remaining -le 0) { continue }
            if (!(Test-ObservationWindow)) { return }
            $count = [int][Math]::Min($readSize, $remaining)
            Start-PipeRead $pipe $count
            $remaining -= $count
        }
        if ($remaining -eq 0 -and !$Pipes[0].task -and !$Pipes[1].task -and !($Pipes[0].eof -and $Pipes[1].eof)) {
            $Result.diagnosticLimitReached = $true
            return
        }
        [Threading.Thread]::Sleep(10)
    }
}

function Wait-ForOriginalSettlement($Compiler, [object[]]$Pipes) {
    # 불명 결과 보존 뒤 같은 owner가 남는다. 더 읽거나 결과를 바꾸지 않는다.
    # EOF/종료 불명과 pipe backpressure는 반환 시간을 유한하게 보장할 수 없다.
    for (;;) {
        $settled = $true
        foreach ($pipe in $Pipes) { if ($null -ne $pipe.task -and !$pipe.task.IsCompleted) { $settled = $false } }
        $exited = $false
        try { $exited = $Compiler.HasExited } catch {}
        if ($settled -and $exited) { return }
        [Threading.Thread]::Sleep(25)
    }
}

$result = [ordered]@{
    candidateId=$candidate; status='PREPARE_DENIED'; reason='APPROVAL_OR_PREFLIGHT_UNVERIFIED'
    approvalSha256=$null; executionCommit=$null; launcherSha256=$null; planSha256=$planHash
    markerConsumed=$false; consumedMarkerSha256=$null; processStarted=$false; startOutcomeKnown=$false; compilerImageMatched=$false
    pid=$null; startTicks=$null; exitObserved=$false; exitCode=$null
    stdoutBytes=0; stderrBytes=0; stdoutEof=$false; stderrEof=$false
    diagnosticLimitReached=$false; diagnosticOverflow=$false; diagnosticEncodingVerified=$false
    diagnostics=@(); observationMs=$null; output=$null
    ownerSettlementRequired=$false; durableResult=$false; dllLoaded=$false; authenticodeObserved=$false
    historicalSignatureApprovalBound=$false
}
$compiler = $null
$pipes = @()
$qaOwned = $false
$consumptionAttempted = $false
$launchAttempted = $false
$serialized = $null
$preflightStage = 'HOST'
try {
    Assert-Host
    $preflightStage = 'APPROVAL'
    $approval = Read-Approval
    $result.historicalSignatureApprovalBound = $true
    $result.approvalSha256 = $ApprovalSha256
    $result.executionCommit = $approval.executionCommit
    $result.launcherSha256 = $approval.launcherSha256
    $issuedAt = Read-Instant $approval.issuedAt
    $expiresAt = Read-Instant $approval.expiresAt
    $windowClock = [Diagnostics.Stopwatch]::StartNew()
    $windowRemainingMs = ($expiresAt - [DateTimeOffset]::UtcNow).TotalMilliseconds
    $durationMs = ($expiresAt - $issuedAt).TotalMilliseconds
    if ($durationMs -le 0 -or $durationMs -gt $maximumWindowMs) { Fail 'APPROVAL_TIME_INVALID' }
    Assert-Window
    $preflightStage = 'PREFLIGHT'
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    try {
        if ($identity.Name -cne $ownerName) { Fail 'QA_OWNER_UNVERIFIED' }
        $ownerSid = $identity.User.Value
    } finally { $identity.Dispose() }

    Assert-PrivatePath $qaParent $true
    if ((Test-Path -LiteralPath $qaRoot) -or (Test-Path -LiteralPath $markerPath)) { Fail 'QA_OR_MARKER_EXISTS' }
    Assert-Inputs $false
    $consumptionAttempted = $true
    $markerJson = Write-NewRecord $markerPath ([ordered]@{candidateId=$candidate; approvalSha256=$ApprovalSha256;
        decisionId=$approval.decisionId; executionCommit=$approval.executionCommit; launcherSha256=$approval.launcherSha256;
        planSha256=$planHash; consumedAt=[DateTimeOffset]::UtcNow.ToString('o'); maximumRuns=1})
    $result.markerConsumed = $true
    $markerBytes = $utf8.GetBytes($markerJson)
    $result.consumedMarkerSha256 = Get-Sha256 $markerBytes
    $result.status = 'UNKNOWN'
    $result.reason = 'PREPARATION_AFTER_CONSUMPTION_UNVERIFIED'
    Assert-Window
    $null = New-Item -ItemType Directory -Path $qaRoot -ErrorAction Stop
    Assert-PrivatePath $qaRoot $true
    if (@(Get-ChildItem -LiteralPath $qaRoot -Force).Count -ne 0) { Fail 'QA_INVENTORY_UNVERIFIED' }
    $qaOwned = $true
    foreach ($directory in @($sourceDirectory, $binaryDirectory, $tempDirectory)) {
        $null = New-Item -ItemType Directory -Path $directory -ErrorAction Stop
        Assert-PrivatePath $directory $true
    }
    for ($index = 0; $index -lt $sources.Count; $index++) {
        Copy-NewSource (Join-Path $repository $sources[$index].path) $sourceCopies[$index] $sources[$index]
    }
    Assert-Inputs $true
    Assert-PrivatePath $markerPath $false
    Assert-File $markerPath $markerBytes.Length $result.consumedMarkerSha256
    Assert-DirectoryContents $qaRoot @('src','bin','temp')
    Assert-DirectoryContents $sourceDirectory @('SourceContentObserver.cs','SourceContentObserverSourceTests.cs')
    Assert-DirectoryContents $binaryDirectory @()
    Assert-DirectoryContents $tempDirectory @()

    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $tools[0].path
    $info.WorkingDirectory = $qaRoot
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.Environment.Clear()
    $info.Environment['SystemRoot'] = 'C:\Windows'
    $info.Environment['WINDIR'] = 'C:\Windows'
    $info.Environment['TEMP'] = $tempDirectory
    $info.Environment['TMP'] = $tempDirectory
    foreach ($argument in $compilerArgs) { $info.ArgumentList.Add($argument) }
    $compiler = [Diagnostics.Process]::new()
    $compiler.StartInfo = $info
    Assert-Window
    $compilerClock = [Diagnostics.Stopwatch]::StartNew()
    $launchAttempted = $true
    $result.reason = 'COMPILER_START_UNKNOWN'
    $started = $compiler.Start()
    $result.startOutcomeKnown = $true
    if (!$started) { Fail 'COMPILER_START_REJECTED' }
    $result.processStarted = $true
    $result.reason = 'COMPILER_RESULT_UNKNOWN'

    $pipes = @((New-PipeState $compiler.StandardOutput.BaseStream), (New-PipeState $compiler.StandardError.BaseStream))
    $bothReadsReserved = $true
    foreach ($pipe in $pipes) {
        try { Start-PipeRead $pipe $readSize }
        catch { $bothReadsReserved = $false }
    }
    if (!$bothReadsReserved) { Fail 'INITIAL_PIPE_RESERVATION_UNKNOWN' }
    try {
        $result.pid = $compiler.Id
        $result.startTicks = $compiler.StartTime.ToUniversalTime().Ticks
        $result.compilerImageMatched = $compiler.MainModule.FileName -ceq $tools[0].path
    } catch { $result.compilerImageMatched = $false }

    Collect-Compiler $compiler $pipes $result
    Record-Capture $pipes $result
    if ((Test-ObservationWindow) -and $result.exitObserved -and $result.stdoutEof -and $result.stderrEof -and
        !$result.diagnosticOverflow -and $result.diagnosticEncodingVerified -and $result.compilerImageMatched -and
        $compiler.Id -eq $result.pid -and
        $compiler.StartTime.ToUniversalTime().Ticks -eq $result.startTicks) {
        Assert-Inputs $true
        Assert-File $markerPath $markerBytes.Length $result.consumedMarkerSha256
        if ($result.exitCode -eq 0) {
            Assert-DirectoryContents $qaRoot @('src','bin','temp')
            Assert-DirectoryContents $sourceDirectory @('SourceContentObserver.cs','SourceContentObserverSourceTests.cs')
            Assert-DirectoryContents $binaryDirectory @('SourceContentObserverSource.dll')
            Assert-DirectoryContents $tempDirectory @()
            Assert-PrivatePath $outputPath $false
            $outputFile = Get-CheckedItem $outputPath $false
            if ($outputFile.Length -lt 1) { Fail 'COMPILER_OUTPUT_UNVERIFIED' }
            $result.output = @{path=$outputRelative; bytes=$outputFile.Length;
                sha256=(Get-FileHash -LiteralPath $outputPath -Algorithm SHA256).Hash}
        }
        if (Test-ObservationWindow) {
            if ($result.exitCode -eq 0) {
                $result.status = 'PASS_COMPILE_ONLY'
                $result.reason = 'COMPILER_EXIT_ZERO'
            } else {
                $result.status = 'FAIL_COMPILE_ONLY'
                $result.reason = 'COMPILER_EXIT_NONZERO'
            }
        }
    }
    $result.observationMs = $compilerClock.ElapsedMilliseconds
} catch {
    # 원 예외/원 path/진단본문을 출력하지 않는다. 소비 시도 뒤 실패도 재실행 근거가 아니다.
    if ($consumptionAttempted) { $result.status = 'UNKNOWN' }
    else {
        $code = $_.Exception.Message
        if ($code -cin @('HOST_IDENTITY_UNVERIFIED','HOST_ARGUMENTS_UNVERIFIED','HOST_EXECUTABLE_UNVERIFIED',
            'HOST_ASSEMBLY_UNVERIFIED','APPROVAL_BINDING_REQUIRED','APPROVAL_HASH_MISMATCH','APPROVAL_SHAPE_INVALID',
            'APPROVAL_BINDING_INVALID','APPROVAL_TIME_INVALID','APPROVAL_WINDOW_EXPIRED')) { $result.reason = $code }
        elseif ($preflightStage -ceq 'HOST') { $result.reason = 'HOST_IDENTITY_UNVERIFIED' }
        elseif ($preflightStage -ceq 'APPROVAL') { $result.reason = 'APPROVAL_RECORD_UNVERIFIED' }
    }
    if ($pipes.Count -eq 2) {
        try { Record-Capture $pipes $result } catch { $result.diagnostics = @() }
    }
}

$pendingPipe = $false
foreach ($pipe in $pipes) { if ($null -ne $pipe.task -and !$pipe.task.IsCompleted) { $pendingPipe = $true } }
$result.ownerSettlementRequired = $launchAttempted -and (!$result.startOutcomeKnown -or
    ($result.processStarted -and (!$result.exitObserved -or $pendingPipe)))
if ($result.ownerSettlementRequired) { $result.status = 'UNKNOWN' }
if ($result.status -cne 'PASS_COMPILE_ONLY') { $result.output = $null }
if ($qaOwned) {
    try {
        Assert-PrivatePath $qaRoot $true
        $result.durableResult = $true
        $serialized = Write-NewRecord $resultPath $result
    } catch {
        $result.durableResult = $false
        $result.status = 'UNKNOWN'
        $result.reason = 'RESULT_PERSISTENCE_UNKNOWN'
    }
}
if (!$serialized) { $serialized = ConvertTo-Json -InputObject $result -Depth 12 -Compress }
try { Write-Output $serialized }
finally {
    if ($result.ownerSettlementRequired) { Wait-ForOriginalSettlement $compiler $pipes }
    # 정착 뒤 프로세스/읽기 자원만 반환한다. QA, DLL, marker는 모두 보존한다.
    foreach ($pipe in $pipes) {
        if ($null -ne $pipe.task) {
            try { $null = $pipe.task.GetAwaiter().GetResult() } catch {}
        }
        [Array]::Clear($pipe.buffer, 0, $pipe.buffer.Length)
        $memory = $pipe.content.GetBuffer()
        [Array]::Clear($memory, 0, $memory.Length)
        $pipe.content.Dispose()
    }
    if ($null -ne $compiler) { $compiler.Dispose() }
}
if ($result.status -ceq 'PASS_COMPILE_ONLY') { exit 0 }
exit 1
