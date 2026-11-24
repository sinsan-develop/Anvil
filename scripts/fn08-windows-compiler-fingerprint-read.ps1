[CmdletBinding()]
param(
    [ValidateSet('Plan', 'Read')]
    [string]$Mode = 'Plan'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$candidateHash = 'FBCE69B89ABA1214E719C7BC2487417D4E52D7D50F873F622EC90A1ACF529DA2'
$parentPath = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319'
$parentPaths = @(
    'C:\'
    'C:\Windows'
    'C:\Windows\Microsoft.NET'
    'C:\Windows\Microsoft.NET\Framework64'
    'C:\Windows\Microsoft.NET\Framework64\v4.0.30319'
)
$maximumBytes = 64L * 1024L * 1024L
$maximumElapsedMs = 60000L
$readChunkBytes = 65536
$targets = @(
    [pscustomobject]@{ Role = 'COMPILER'; Name = 'csc.exe'; Bytes = 2569832L; Sha256 = '46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00' }
    [pscustomobject]@{ Role = 'REFERENCE_MSCORLIB'; Name = 'mscorlib.dll'; Bytes = 5445432L; Sha256 = '11AC114C43ECF6996BEF58BA3C99FBA3693A4560A84EEADDE54D193060DC626C' }
    [pscustomobject]@{ Role = 'REFERENCE_SYSTEM'; Name = 'System.dll'; Bytes = 3545264L; Sha256 = '2B3C17C6208A0B4B6BEB94E1A066F99BA06CDB2EA919479E99D47E8C6D96DC71' }
    [pscustomobject]@{ Role = 'REFERENCE_SYSTEM_CORE'; Name = 'System.Core.dll'; Bytes = 1551104L; Sha256 = '8B898BED54AE8CC61F9C58CC3EB062724F8357D2BDDA338B5D363654ECFF333D' }
    [pscustomobject]@{ Role = 'REFERENCE_SYSTEM_WEB_EXTENSIONS'; Name = 'System.Web.Extensions.dll'; Bytes = 1846016L; Sha256 = '5E6378EDC06F5A61920AAADB2ABA839DD3CF302D6192E08AACD4454BA4CFF0B3' }
    [pscustomobject]@{ Role = 'REFERENCE_SYSTEM_SECURITY'; Name = 'System.Security.dll'; Bytes = $null; Sha256 = $null }
)

function Fail-Fn08FingerprintRead([string]$Reason) {
    throw [InvalidOperationException]::new($Reason)
}

function Assert-Fn08FingerprintBudget([Diagnostics.Stopwatch]$Timer) {
    if ($Timer.ElapsedMilliseconds -gt $maximumElapsedMs) {
        Fail-Fn08FingerprintRead 'DEADLINE_EXCEEDED'
    }
}

function Get-Fn08FingerprintParentMetadata {
    $observations = [Collections.Generic.List[object]]::new()
    foreach ($path in $parentPaths) {
        $item = Get-Item -LiteralPath $path -Force -ErrorAction Stop
        if (-not $item.PSIsContainer -or
            $item.FullName -cne $path -or
            (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
            Fail-Fn08FingerprintRead 'PARENT_METADATA_INVALID'
        }
        $observations.Add([pscustomobject]@{
            Path = $path
            CreationTicks = [long]$item.CreationTimeUtc.Ticks
            LastWriteTicks = [long]$item.LastWriteTimeUtc.Ticks
            Attributes = [long]$item.Attributes
        })
    }
    return $observations.ToArray()
}

function Assert-Fn08FingerprintParentMetadata([object[]]$Expected) {
    $actual = Get-Fn08FingerprintParentMetadata
    if ($actual.Count -ne $Expected.Count) { Fail-Fn08FingerprintRead 'PARENT_METADATA_CHANGED' }
    for ($index = 0; $index -lt $Expected.Count; $index++) {
        if ($actual[$index].Path -cne $Expected[$index].Path -or
            $actual[$index].CreationTicks -ne $Expected[$index].CreationTicks -or
            $actual[$index].LastWriteTicks -ne $Expected[$index].LastWriteTicks -or
            $actual[$index].Attributes -ne $Expected[$index].Attributes) {
            Fail-Fn08FingerprintRead 'PARENT_METADATA_CHANGED'
        }
    }
}

function Get-Fn08FingerprintMetadata([string]$Path, [string]$ExpectedName) {
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
    if ($item.PSIsContainer -or
        $item.Name -cne $ExpectedName -or
        $item.FullName -cne $Path -or
        $item.DirectoryName -cne $parentPath -or
        (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
        Fail-Fn08FingerprintRead 'LEAF_METADATA_INVALID'
    }
    return [pscustomobject]@{
        Length = [long]$item.Length
        LastWriteTicks = [long]$item.LastWriteTimeUtc.Ticks
        CreationTicks = [long]$item.CreationTimeUtc.Ticks
        Attributes = [long]$item.Attributes
    }
}

function Read-Fn08FingerprintTarget(
    [pscustomobject]$Target,
    [Diagnostics.Stopwatch]$Timer,
    [ref]$TotalBytes
) {
    Assert-Fn08FingerprintBudget $Timer
    $path = [IO.Path]::Combine($parentPath, $Target.Name)
    if ([IO.Path]::GetDirectoryName($path) -cne $parentPath) {
        Fail-Fn08FingerprintRead 'LEAF_PATH_INVALID'
    }
    $before = Get-Fn08FingerprintMetadata $path $Target.Name
    $stream = $null
    $digest = $null
    $managedDisposeReturned = $false
    $buffer = [byte[]]::new($readChunkBytes)
    try {
        # FileShare.Read만 허용하여 이 관측 중 write/delete 공유를 열지 않는다.
        $stream = [IO.FileStream]::new(
            $path,
            [IO.FileMode]::Open,
            [IO.FileAccess]::Read,
            [IO.FileShare]::Read
        )
        if ($stream.Length -ne $before.Length -or $stream.Length -lt 1) {
            Fail-Fn08FingerprintRead 'LEAF_LENGTH_CHANGED'
        }
        if ($null -ne $Target.Bytes -and $stream.Length -ne [long]$Target.Bytes) {
            Fail-Fn08FingerprintRead 'KNOWN_PREFIX_SIZE_MISMATCH'
        }
        if ([long]$TotalBytes.Value -gt $maximumBytes - [long]$stream.Length) {
            Fail-Fn08FingerprintRead 'AGGREGATE_LIMIT_EXCEEDED'
        }
        if ($stream.Position -ne 0) { Fail-Fn08FingerprintRead 'LEAF_POSITION_INVALID' }
        Assert-Fn08FingerprintBudget $Timer
        $sha = $null
        try {
            $sha = [Security.Cryptography.SHA256]::Create()
            # 동일 read-only stream을 초기 길이까지만 순차 소비한다. 동기 Read 자체의 강제 중단은 보장하지 않는다.
            $consumed = 0L
            while ($consumed -lt $before.Length) {
                Assert-Fn08FingerprintBudget $Timer
                $remaining = $before.Length - $consumed
                $wanted = [int][Math]::Min([long]$buffer.Length, $remaining)
                $count = $stream.Read($buffer, 0, $wanted)
                if ($count -lt 1) { Fail-Fn08FingerprintRead 'LEAF_READ_TRUNCATED' }
                if ([long]$TotalBytes.Value -gt $maximumBytes - [long]$count) {
                    Fail-Fn08FingerprintRead 'AGGREGATE_LIMIT_EXCEEDED'
                }
                [void]$sha.TransformBlock($buffer, 0, $count, $buffer, 0)
                $consumed += $count
                $TotalBytes.Value = [long]$TotalBytes.Value + [long]$count
            }
            if ($consumed -ne $before.Length -or
                $stream.Position -ne $before.Length -or
                $stream.Length -ne $before.Length) {
                Fail-Fn08FingerprintRead 'LEAF_POSITION_INVALID'
            }
            [void]$sha.TransformFinalBlock([byte[]]::new(0), 0, 0)
            $digest = [Convert]::ToHexString($sha.Hash)
        } finally {
            if ($null -ne $sha) { $sha.Dispose() }
        }
        Assert-Fn08FingerprintBudget $Timer
    } finally {
        [Array]::Clear($buffer, 0, $buffer.Length)
        if ($null -ne $stream) {
            try {
                $stream.Dispose()
                $managedDisposeReturned = $true
            } catch {
                $managedDisposeReturned = $false
            }
        }
    }
    if (-not $managedDisposeReturned) {
        Fail-Fn08FingerprintRead 'LEAF_MANAGED_DISPOSE_UNCONFIRMED'
    }
    $after = Get-Fn08FingerprintMetadata $path $Target.Name
    if ($after.Length -ne $before.Length -or
        $after.LastWriteTicks -ne $before.LastWriteTicks -or
        $after.CreationTicks -ne $before.CreationTicks -or
        $after.Attributes -ne $before.Attributes) {
        Fail-Fn08FingerprintRead 'LEAF_METADATA_CHANGED'
    }
    Assert-Fn08FingerprintBudget $Timer
    return [pscustomobject]@{
        role = $Target.Role
        fileName = $Target.Name
        bytes = $before.Length
        sha256 = $digest
        nonReparseMetadata = $true
        managedDisposeReturned = $true
        nativeCloseVerified = $false
    }
}

function Get-Fn08FingerprintPlan {
    return [ordered]@{
        state = 'PLAN_ONLY'
        candidateSha256 = $candidateHash
        mode = 'PLAN'
        targetOrder = @($targets | ForEach-Object { $_.Name })
        knownPrefixCount = 5
        observationCount = 1
        maximumBytes = $maximumBytes
        maximumElapsedMs = $maximumElapsedMs
        osFilesRead = $false
        compilerExecuted = $false
        approvalIssued = $false
        identityBoundary = 'PATH_METADATA_AND_SAME_READ_STREAM_ONLY'
        closeBoundary = 'MANAGED_DISPOSE_RETURNED_NATIVE_CLOSE_NOT_VERIFIED'
        timingBoundary = 'SYNCHRONOUS_IO_NOT_INTERRUPTIBLE_LATE_RESULT_REJECTED'
    }
}

function Invoke-Fn08FingerprintRead {
    # 이 명시 진입은 사람 승인이나 후속 compiler 사용 권위를 발급하지 않는다.
    $timer = [Diagnostics.Stopwatch]::StartNew()
    $failureRole = 'PARENT'
    $observations = [Collections.Generic.List[object]]::new()
    $totalBytes = 0L
    try {
        $parentBefore = Get-Fn08FingerprintParentMetadata
        for ($index = 0; $index -lt $targets.Count; $index++) {
            $target = $targets[$index]
            $failureRole = $target.Role
            Assert-Fn08FingerprintParentMetadata $parentBefore
            # 첫 다섯 지문이 모두 일치하기 전에는 여섯째의 metadata나 file을 열지 않는다.
            $observation = Read-Fn08FingerprintTarget $target $timer ([ref]$totalBytes)
            Assert-Fn08FingerprintParentMetadata $parentBefore
            if ($index -lt 5 -and
                ($observation.bytes -ne $target.Bytes -or $observation.sha256 -cne $target.Sha256)) {
                Fail-Fn08FingerprintRead 'KNOWN_PREFIX_MISMATCH'
            }
            $observations.Add($observation)
        }
        Assert-Fn08FingerprintBudget $timer
        return [ordered]@{
            state = 'OBSERVED_NOT_APPROVED'
            candidateSha256 = $candidateHash
            resultCode = 'FINGERPRINT_READ_COMPLETE'
            observations = $observations.ToArray()
            totalBytes = $totalBytes
            elapsedMs = $timer.ElapsedMilliseconds
            compilerExecuted = $false
            assemblyLoaded = $false
            childStarted = $false
            fileChanged = $false
            approvalIssued = $false
            identityBoundary = 'PATH_METADATA_AND_SAME_READ_STREAM_ONLY'
            closeBoundary = 'MANAGED_DISPOSE_RETURNED_NATIVE_CLOSE_NOT_VERIFIED'
            timingBoundary = 'SYNCHRONOUS_IO_NOT_INTERRUPTIBLE_LATE_RESULT_REJECTED'
        }
    } catch {
        $allowed = @(
            'DEADLINE_EXCEEDED', 'PARENT_METADATA_INVALID', 'PARENT_METADATA_CHANGED', 'LEAF_PATH_INVALID',
            'LEAF_METADATA_INVALID', 'LEAF_LENGTH_CHANGED', 'KNOWN_PREFIX_SIZE_MISMATCH',
            'AGGREGATE_LIMIT_EXCEEDED', 'LEAF_POSITION_INVALID', 'LEAF_READ_TRUNCATED',
            'LEAF_MANAGED_DISPOSE_UNCONFIRMED', 'LEAF_METADATA_CHANGED',
            'KNOWN_PREFIX_MISMATCH'
        )
        $reason = if ($_.Exception -is [InvalidOperationException] -and
            $allowed -ccontains $_.Exception.Message) { $_.Exception.Message } else { 'READ_UNCONFIRMED' }
        return [ordered]@{
            state = 'READ_UNCONFIRMED'
            candidateSha256 = $candidateHash
            resultCode = 'FINGERPRINT_READ_FAILED'
            failureRole = $failureRole
            reason = $reason
            compilerExecuted = $false
            assemblyLoaded = $false
            childStarted = $false
            fileChanged = $false
            approvalIssued = $false
        }
    } finally {
        $timer.Stop()
    }
}

if ($MyInvocation.InvocationName -ceq '.') { return }

if ($Mode -eq 'Plan') {
    Get-Fn08FingerprintPlan | ConvertTo-Json -Depth 6 -Compress
    exit 0
}

$result = Invoke-Fn08FingerprintRead
$result | ConvertTo-Json -Depth 6 -Compress
if ($result.state -ceq 'OBSERVED_NOT_APPROVED') { exit 0 }
exit 2
