# Windows PowerShell 5.1. Execution requires a new, separately approved dispatch.
$script:stage = 'SCOPE'
$script:reason = 'OTHER'
$ErrorActionPreference = 'Stop'
$PSModuleAutoLoadingPreference = 'None'
$timer = [Diagnostics.Stopwatch]::StartNew()
function Check-Time {
    if ($timer.ElapsedMilliseconds -ge 27000) { $script:reason = 'TIME_LIMIT'; throw 'TIME_LIMIT' }
}
function Read-Attributes([string]$literal) {
    Check-Time
    try { return [IO.File]::GetAttributes($literal) }
    catch [IO.FileNotFoundException] { return $null }
    catch [IO.DirectoryNotFoundException] { return $null }
}
function Confirm-Directory([string]$directory) {
    $root = [IO.Path]::GetPathRoot($directory)
    $path = $root
    $components = @($directory.Substring($root.Length).Split('\') | Where-Object { $_.Length -gt 0 })
    if ($components.Count -gt 32) { $script:reason = 'DEPTH_LIMIT'; throw 'DEPTH_LIMIT' }
    foreach ($component in (@('') + $components)) {
        if ($component) { $path = [IO.Path]::Combine($path, $component) }
        $a = Read-Attributes $path
        if ($null -eq $a -or ($a -band [IO.FileAttributes]::ReparsePoint) -or
            -not ($a -band [IO.FileAttributes]::Directory)) { return $false }
    }
    return $true
}
function Hex([byte[]]$value) { return [BitConverter]::ToString($value).Replace('-', '') }
function Metadata([string]$literal) {
    $a = Read-Attributes $literal
    if ($null -eq $a -or ($a -band ([IO.FileAttributes]::Directory -bor
        [IO.FileAttributes]::Device -bor [IO.FileAttributes]::ReparsePoint))) { $script:reason = 'FILE_TYPE'; throw 'FILE_TYPE' }
    $info = [IO.FileInfo]::new($literal)
    $info.Refresh()
    if (-not $info.Exists) { $script:reason = 'FILE_LOST'; throw 'FILE_LOST' }
    return [pscustomobject]@{ size = $info.Length; written = $info.LastWriteTimeUtc.Ticks; flags = [int]$a }
}
function Read-Image([string]$literal, [long]$size) {
    if ($size -lt 68 -or $size -gt 268435456) { $script:reason = 'IMAGE_SIZE'; throw 'IMAGE_SIZE' }
    $s = [IO.FileStream]::new($literal, [IO.FileMode]::Open, [IO.FileAccess]::Read,
        [IO.FileShare]::Read, 65536, [IO.FileOptions]::SequentialScan)
    try {
        if ($s.Length -ne $size) { $script:reason = 'SIZE_CHANGED'; throw 'SIZE_CHANGED' }
        $sha = [Security.Cryptography.SHA256]::Create()
        try {
            $buffer = [byte[]]::new(65536)
            $header = [byte[]]::new(64)
            $signature = [byte[]]::new(4)
            [long]$position = 0
            [long]$offset = -1
            while ($position -lt $size) {
                Check-Time
                $n = $s.Read($buffer, 0, [int][Math]::Min(65536L, $size - $position))
                if (!$n) { $script:reason = 'SHORT_READ'; throw 'SHORT_READ' }
                if ($position -lt 64) {
                    $take = [int][Math]::Min([long]$n, 64L - $position)
                    [Array]::Copy($buffer, 0, $header, [int]$position, $take)
                    if ($position + $take -eq 64) {
                        $offset = [BitConverter]::ToUInt32($header, 60)
                        if ($header[0] -ne 77 -or $header[1] -ne 90 -or
                            $offset -lt 64 -or $offset -gt $size - 4) { $script:reason = 'IMAGE_HEADER'; throw 'IMAGE_HEADER' }
                    }
                }
                if ($offset -ge 0) {
                    $lo = [Math]::Max($position, $offset)
                    $hi = [Math]::Min($position + $n, $offset + 4)
                    if ($hi -gt $lo) {
                        [Array]::Copy($buffer, [int]($lo - $position), $signature, [int]($lo - $offset), [int]($hi - $lo))
                    }
                }
                $null = $sha.TransformBlock($buffer, 0, $n, $null, 0)
                $position += $n
            }
            if ($s.Length -ne $size -or [BitConverter]::ToUInt32($signature, 0) -ne 0x4550) { $script:reason = 'IMAGE_SIGNATURE'; throw 'IMAGE_SIGNATURE' }
            $null = $sha.TransformFinalBlock([byte[]]::new(0), 0, 0)
            return Hex $sha.Hash
        } finally { $sha.Dispose() }
    } finally { $s.Dispose() }
}
function Observe {
    $list = [Environment]::GetEnvironmentVariable('PATH', 'Process')
    if (!$list) { return 'NO_ELIGIBLE_SCOPE' }
    if ($list.Length -gt 32767) { $script:reason = 'PATH_LIMIT'; throw 'PATH_LIMIT' }
    $dirs = $list.Split(';')
    if ($dirs.Length -gt 64) { $script:reason = 'DIR_LIMIT'; throw 'DIR_LIMIT' }
    $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    $eligible = 0
    foreach ($dir in $dirs) {
        Check-Time
        if ($dir -notmatch '^[A-Za-z]:\\' -or $dir.Substring(2) -match '[:/%"*?<>|\[\]\x00-\x1f]' -or
            $dir -match '(?:^|\\)(?:\.{1,2}|(?:CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.[^\\]*)?)(?:\\|$)|[. ](?:\\|$)') { continue }
        $script:stage = 'DIRECTORY'
        $full = [IO.Path]::GetFullPath($dir)
        $root = [IO.Path]::GetPathRoot($full)
        if ([IO.DriveInfo]::new($root).DriveType -ne [IO.DriveType]::Fixed) { continue }
        if (-not $seen.Add($full) -or -not (Confirm-Directory $full)) { continue }
        $eligible++
        foreach ($name in @('claude.exe', 'claude.cmd', 'claude.bat')) {
            $script:stage = 'PROBE'
            $literal = [IO.Path]::Combine($full, $name)
            if ($null -eq (Read-Attributes $literal)) { continue }
            $script:stage = 'METADATA'
            $before = Metadata $literal
            $script:stage = 'COMMAND'
            $command = Get-Command -Name $literal -CommandType Application -TotalCount 1 -ErrorAction Stop
            if (!$command -or ![string]::Equals($command.Path, $literal, [StringComparison]::OrdinalIgnoreCase)) { $script:reason = 'PATH_CHANGED'; throw 'PATH_CHANGED' }
            $script:stage = 'IMAGE'
            $hash = '-'
            $state = 'WRAPPER_TARGET_UNKNOWN'
            if ($name -eq 'claude.exe') { $hash = Read-Image $literal $before.size; $state = 'IMAGE_BYTES_OBSERVED' }
            $script:stage = 'RECHECK'
            if (-not (Confirm-Directory $full)) { $script:reason = 'PARENT_CHANGED'; throw 'PARENT_CHANGED' }
            $after = Metadata $literal
            if ($before.size -ne $after.size -or $before.written -ne $after.written -or $before.flags -ne $after.flags) { $script:reason = 'METADATA_CHANGED'; throw 'METADATA_CHANGED' }
            $sha = [Security.Cryptography.SHA256]::Create()
            try { $pathId = Hex ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($literal))) } finally { $sha.Dispose() }
            Check-Time
            return "$state|$name|$pathId|$($before.size)|$($before.written)|$hash"
        }
    }
    Check-Time
    if ($eligible -eq 0) { return 'NO_ELIGIBLE_SCOPE' }
    return 'NOT_FOUND_IN_SCOPE'
}
try { $result = Observe; Check-Time } catch { $result = "UNKNOWN|$script:stage|$script:reason" }
[Console]::Out.WriteLine($result)
