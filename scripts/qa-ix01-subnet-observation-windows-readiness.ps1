# IX01 Windows-only 읽기 후보. 함수 정의만 적재하며 자동 CLI/승인 발급은 없다.
# 실제 호출은 별도 고정 실행안/승인/원 프로세스 수거에 종속한다. 합성 포트는 운영 권위가 아니다.
function Get-Ix01WindowsReadinessTargets {
    @(
        @{role='SSH_IMAGE';path='C:\Windows\System32\OpenSSH\ssh.exe';maximum=67108864L;kind='IMAGE'}
        @{role='USER_CONFIG';path='C:\Users\cyhuh\.ssh\config';maximum=65536L;kind='CONFIG'}
        @{role='SYSTEM_CONFIG';path='C:\ProgramData\ssh\ssh_config';maximum=65536L;kind='CONFIG'}
        @{role='USER_TRUST';path='C:\Users\cyhuh\.ssh\known_hosts';maximum=1048576L;kind='TRUST'}
        @{role='USER_TRUST_2';path='C:\Users\cyhuh\.ssh\known_hosts2';maximum=1048576L;kind='TRUST'}
        @{role='SYSTEM_TRUST';path='C:\ProgramData\ssh\ssh_known_hosts';maximum=1048576L;kind='TRUST'}
        @{role='SYSTEM_TRUST_2';path='C:\ProgramData\ssh\ssh_known_hosts2';maximum=1048576L;kind='TRUST'}
        @{role='LEDGER_PARENT';path='D:\Project\Anvil\.av3-data';maximum=0L;kind='DIRECTORY'}
    )
}

function Test-Ix01ReadinessKeys($Value, [string[]]$Keys) {
    if ($Value -isnot [hashtable] -or $Value.Count -ne $Keys.Length) { return $false }
    foreach ($key in $Keys) { if (!$Value.ContainsKey($key)) { return $false } }
    return $true
}

function Test-Ix01ReadinessHash($Value) {
    return $Value -is [string] -and $Value -cmatch '\A[0-9a-f]{64}\z'
}

function Test-Ix01ReadinessInteger($Value) {
    return ($Value -is [long] -or $Value -is [int]) -and $Value -ge 0
}

function Test-Ix01ReadinessBudget($Clock, $Binding, $Start, $Previous, $Step) {
    if (!(Test-Ix01ReadinessKeys $Clock @('wall','mono')) -or
        !(Test-Ix01ReadinessInteger $Clock.wall) -or !(Test-Ix01ReadinessInteger $Clock.mono)) { return $false }
    return $Clock.wall -ge $Binding.issuedAt -and $Clock.wall -lt $Binding.expiresAt -and
        $Clock.wall -ge $Previous.wall -and $Clock.mono -ge $Previous.mono -and
        $Clock.wall - $Start.wall -lt 60000 -and $Clock.mono - $Start.mono -lt 60000 -and
        ($null -eq $Step -or ($Clock.wall - $Step.wall -lt 10000 -and $Clock.mono - $Step.mono -lt 10000))
}

function Test-Ix01ReadinessObservation($Value, $Target, [string]$Owner) {
    if (!(Test-Ix01ReadinessKeys $Value @('state','path','directory','reparse','link','created','modified','attributes','length','owner','aclHash','rules','parents'))) { return $false }
    if ($Value.path -cne $Target.path -or $Value.state -cnotin @('PRESENT','ABSENT') -or
        $Value.directory -isnot [bool] -or $Value.directory -ne ($Target.kind -ceq 'DIRECTORY') -or
        $Value.reparse -isnot [bool] -or $Value.reparse -or
        $Value.parents -isnot [array] -or $Value.parents.Count -gt 16) { return $false }
    $parent=Split-Path -Parent $Target.path
    foreach ($item in $Value.parents) {
        if (!(Test-Ix01ReadinessKeys $item @('path','reparse','link','created','attributes','aclHash')) -or
            !$parent -or $item.path -cne $parent -or $item.reparse -isnot [bool] -or $item.reparse -or
            $item.link -cnotin @($null,'') -or !(Test-Ix01ReadinessInteger $item.created) -or
            !(Test-Ix01ReadinessInteger $item.attributes) -or ($item.attributes -band 1024) -ne 0 -or ($item.attributes -band 16) -eq 0 -or
            !(Test-Ix01ReadinessHash $item.aclHash)) { return $false }
        $parent=Split-Path -Parent $parent
    }
    if ($parent) { return $false }
    if ($Value.state -ceq 'ABSENT') { return $Target.kind -cnotin @('IMAGE','DIRECTORY') }
    if (!(Test-Ix01ReadinessInteger $Value.created) -or !(Test-Ix01ReadinessInteger $Value.modified) -or
        !(Test-Ix01ReadinessInteger $Value.attributes) -or ($Value.attributes -band 1024) -ne 0 -or
        !(Test-Ix01ReadinessInteger $Value.length) -or $Value.length -gt $Target.maximum -or
        !(Test-Ix01ReadinessHash $Value.aclHash) -or $Value.rules -isnot [array] -or $Value.rules.Count -gt 128) { return $false }
    $installer='S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464'
    $allowedOwners=if($Target.role -in @('SSH_IMAGE','SYSTEM_CONFIG','SYSTEM_TRUST','SYSTEM_TRUST_2')) { @($installer,'S-1-5-18','S-1-5-32-544') } else { @($Owner) }
    if ($Value.owner -cnotin $allowedOwners -or ($Target.kind -ceq 'IMAGE' -and $Value.owner -cne $installer)) { return $false }
    if ($Value.link -cnotin @($null,'') -and !($Target.kind -ceq 'IMAGE' -and $Value.link -ceq 'HardLink')) { return $false }
    # FN03 private root는 USER/SYSTEM만, OS 자료는 recovery의 외부 쓰기 거절을 재사용한다.
    $rights=@{};$writeMask=[long][Security.AccessControl.FileSystemRights]'Write,Delete,ChangePermissions,TakeOwnership'
    foreach ($rule in $Value.rules) {
        if (!(Test-Ix01ReadinessKeys $rule @('sid','allow','rights')) -or $rule.sid -isnot [string] -or
            $rule.sid -cnotmatch '\AS-1-[0-9-]{1,180}\z' -or $rule.allow -isnot [bool] -or
            !(Test-Ix01ReadinessInteger $rule.rights)) { return $false }
        if ($Target.kind -ceq 'DIRECTORY') {
            if (!$rule.allow -or $rule.sid -cnotin @($Owner,'S-1-5-18')) { return $false }
            $rights[$rule.sid]=[long]$rights[$rule.sid] -bor $rule.rights
        } elseif ($rule.allow -and ($rule.rights -band $writeMask) -ne 0 -and $rule.sid -cnotin @($Value.owner,'S-1-5-18','S-1-5-32-544')) { return $false }
    }
    if ($Target.kind -ceq 'DIRECTORY') {
        foreach ($sid in @($Owner,'S-1-5-18')) { if (!$rights.ContainsKey($sid) -or ($rights[$sid] -band 2032127L) -ne 2032127L) { return $false } }
    }
    return $true
}

function Get-Ix01ReadinessMetadataHash([hashtable]$Observation) {
    # 동일 포트의 전후 metadata 비교용. native FileId/경로 바꿔치기 방지 증거는 아니다.
    $raw=[Text.Encoding]::UTF8.GetBytes(($Observation | ConvertTo-Json -Depth 8 -Compress))
    try { return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($raw)).ToLowerInvariant() }
    finally { [Array]::Clear($raw,0,$raw.Length) }
}

function Get-Ix01ReadinessTextVerdict([byte[]]$Bytes, [string]$Kind) {
    try { $text=[Text.UTF8Encoding]::new($false,$true).GetString($Bytes) } catch { return 'TEXT_UNCONFIRMED' }
    if ($text.Contains([char]0) -or $text.Contains([char]0xFEFF) -or $text -match '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0085\u2028\u2029]') { return 'TEXT_UNCONFIRMED' }
    $lines=$text.Split([char]10)
    if ($lines.Count -gt 4096) { return 'TEXT_UNCONFIRMED' }
    foreach ($raw in $lines) {
        if ($raw.Length -gt 16384) { return 'TEXT_UNCONFIRMED' }
        $line=$raw.Trim()
        if (!$line -or $line.StartsWith('#')) { continue }
        if ($Kind -ceq 'CONFIG') {
            # 정적 subset만 수거한다. Host 매칭/상속·first-value·기본 경로/환경은 확정하지 않는다.
            if ($line -notmatch '\A([A-Za-z][A-Za-z0-9]*)[\t =]+(.+)\z') { return 'CONFIG_UNCONFIRMED' }
            $key=$Matches[1].ToLowerInvariant();$value=$Matches[2]
            if ($key -ceq 'include') { return 'INCLUDE_UNCONFIRMED' }
            if ($key -cin @('userknownhostsfile','globalknownhostsfile','knownhostscommand')) { return 'CUSTOM_SCOPE_UNCONFIRMED' }
            if ($key -ceq 'match') { return 'CONFIG_UNCONFIRMED' }
            switch -CaseSensitive ($key) {
                'host' { if ($value -cnotmatch '\A(?:\*|[A-Za-z0-9][A-Za-z0-9._-]{0,127})(?:[\t ]+(?:\*|[A-Za-z0-9][A-Za-z0-9._-]{0,127}))*\z') { return 'CONFIG_UNCONFIRMED' } }
                'hostname' { if ($value -cnotmatch '\A[A-Za-z0-9][A-Za-z0-9.-]{0,252}\z') { return 'CONFIG_UNCONFIRMED' } }
                'user' { if ($value -cnotmatch '\A[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}\z') { return 'CONFIG_UNCONFIRMED' } }
                'port' { if ($value -cnotmatch '\A[0-9]{1,5}\z' -or [int]$value -lt 1 -or [int]$value -gt 65535) { return 'CONFIG_UNCONFIRMED' } }
                'identityfile' { if ($value -cnotmatch '\A~/\.ssh/[A-Za-z0-9_.-]{1,128}\z' -or $value.EndsWith('/..')) { return 'CONFIG_UNCONFIRMED' } }
                'identitiesonly' { if ($value -cnotin @('yes','no')) { return 'CONFIG_UNCONFIRMED' } }
                default { return 'CONFIG_UNCONFIRMED' }
            }
        } else {
            # 공개 trust의 닫힌 구문만 확인한다. host key 인증/alias 적합성은 발급하지 않는다.
            if ($line -cnotmatch '\A(?:@(?:cert-authority|revoked)[\t ]+)?[^\s]{1,1024}[\t ]+(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(?:256|384|521))[\t ]+([A-Za-z0-9+/]{1,12000}={0,2})(?:[\t ]+[^\r\n]*)?\z') { return 'TRUST_UNCONFIRMED' }
            $algorithm=$Matches[1];$encoded=$Matches[2];$keyBytes=$null
            try {
                $keyBytes=[Convert]::FromBase64String($encoded)
                if ($keyBytes.Length -lt 5 -or $keyBytes.Length -gt 8192) { return 'TRUST_UNCONFIRMED' }
                $n=[long]$keyBytes[0]*16777216+[long]$keyBytes[1]*65536+[long]$keyBytes[2]*256+$keyBytes[3]
                if ($n -ne $algorithm.Length -or $n+4 -ge $keyBytes.Length -or [Text.Encoding]::ASCII.GetString($keyBytes,4,[int]$n) -cne $algorithm) { return 'TRUST_UNCONFIRMED' }
            } catch { return 'TRUST_UNCONFIRMED' }
            finally { if ($null -ne $keyBytes) { [Array]::Clear($keyBytes,0,$keyBytes.Length) } }
        }
    }
    return 'SUBSET_ONLY'
}

function Invoke-Ix01WindowsReadiness($Binding, $Ports, [switch]$ClassifyAliasConfig) {
    $ErrorActionPreference='Stop'
    $result=[ordered]@{schemaVersion=1;code='UNKNOWN';readiness='UNCONFIRMED';reason='INPUT_UNCONFIRMED';files=@()}
    $stream=$null;$buffer=$null;$body=$null;$digest=$null;$userConfig=$null;$alias=$null
    try {
        if (!(Test-Ix01ReadinessKeys $Binding @('attemptId','approvalHash','planHash','sourceHash','issuedAt','expiresAt')) -or
            $Binding.attemptId -isnot [string] -or $Binding.attemptId -cnotmatch '\A[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z' -or
            !(Test-Ix01ReadinessHash $Binding.approvalHash) -or !(Test-Ix01ReadinessHash $Binding.planHash) -or !(Test-Ix01ReadinessHash $Binding.sourceHash) -or
            !(Test-Ix01ReadinessInteger $Binding.issuedAt) -or !(Test-Ix01ReadinessInteger $Binding.expiresAt) -or
            $Binding.expiresAt -le $Binding.issuedAt -or $Binding.expiresAt-$Binding.issuedAt -gt 60000 -or
            !(Test-Ix01ReadinessKeys $Ports @('Clock','Owner','Observe','Open','Read','Close'))) { throw 'REJECTED' }
        foreach($key in $Ports.Keys) { if ($Ports[$key] -isnot [scriptblock]) { throw 'REJECTED' } }
        # 원 가변 입력 대신 복사본을 쓴다. 승인 검증이 아닌 원 감독 입력의 결박 보존이다.
        $q=$Binding.Clone();$p=$Ports.Clone()
        $start=& $p.Clock;$previous=$start
        if (!(Test-Ix01ReadinessBudget $start $q $start $start $null)) { throw 'REJECTED' }
        $result.binding=$q
        $result.reason='IDENTITY_UNCONFIRMED';$owner=& $p.Owner
        if ($owner -isnot [string] -or $owner -cnotmatch '\AS-1-5-21-[0-9-]{1,160}\z') { throw 'REJECTED' }
        foreach ($target in (Get-Ix01WindowsReadinessTargets)) {
            $result.reason='WINDOW_EXPIRED';$now=& $p.Clock
            if (!(Test-Ix01ReadinessBudget $now $q $start $previous $null)) { throw 'REJECTED' };$previous=$now;$step=$now
            $result.reason='METADATA_UNCONFIRMED'
            $before=& $p.Observe $target.path ($target.kind -ceq 'DIRECTORY') ($target.kind -ceq 'IMAGE')
            $result.reason='WINDOW_EXPIRED';$now=& $p.Clock
            if (!(Test-Ix01ReadinessBudget $now $q $start $previous $step)) { throw 'REJECTED' };$previous=$now
            $result.reason='METADATA_UNCONFIRMED'
            if (!(Test-Ix01ReadinessObservation $before $target $owner)) { throw 'REJECTED' }
            $metadataHash=Get-Ix01ReadinessMetadataHash $before
            $entry=[ordered]@{role=$target.role;state=$before.state;metadata='MATCHED'}
            if ($before.state -ceq 'PRESENT' -and $target.kind -cne 'DIRECTORY') {
                $result.reason='READ_UNCONFIRMED';$stream=& $p.Open $target.path
                if ($null -eq $stream) { throw 'REJECTED' }
                $opened=& $p.Observe $target.path $false ($target.kind -ceq 'IMAGE')
                if (!(Test-Ix01ReadinessObservation $opened $target $owner) -or (Get-Ix01ReadinessMetadataHash $opened) -cne $metadataHash) { throw 'REJECTED' }
                $buffer=[byte[]]::new(8192);$body=$null
                if($ClassifyAliasConfig){
                    # 새 순수 byte[] 소비에는 if 출력의 배열 열거를 피한다. 구형 기본 모드는 보존한다.
                    if($target.kind -cne 'IMAGE'){$body=[byte[]]::new([int]$before.length)}
                }else{$body=if($target.kind -cne 'IMAGE'){[byte[]]::new([int]$before.length)}else{$null}}
                $digest=[Security.Cryptography.IncrementalHash]::CreateHash([Security.Cryptography.HashAlgorithmName]::SHA256);$total=0L
                while ($true) {
                    $result.reason='WINDOW_EXPIRED';$now=& $p.Clock
                    if (!(Test-Ix01ReadinessBudget $now $q $start $previous $step)) { throw 'REJECTED' };$previous=$now
                    $result.reason='READ_UNCONFIRMED';$count=& $p.Read $stream $buffer $buffer.Length
                    if (!(Test-Ix01ReadinessInteger $count) -or $count -gt $buffer.Length) { throw 'REJECTED' }
                    $result.reason='WINDOW_EXPIRED';$now=& $p.Clock
                    if (!(Test-Ix01ReadinessBudget $now $q $start $previous $step)) { throw 'REJECTED' };$previous=$now
                    if ($count -eq 0) { break }
                    $result.reason='LENGTH_UNCONFIRMED'
                    if ($total+$count -gt $before.length -or $total+$count -gt $target.maximum) { throw 'REJECTED' }
                    $digest.AppendData($buffer,0,[int]$count)
                    if ($null -ne $body) { [Array]::Copy($buffer,0,$body,[int]$total,[int]$count) };$total+=$count
                }
                $result.reason='LENGTH_UNCONFIRMED';if ($total -ne $before.length) { throw 'REJECTED' }
                $entry.bytes=$total;$entry.sha256=[Convert]::ToHexString($digest.GetHashAndReset()).ToLowerInvariant()
                $digest.Dispose();$digest=$null
            }
            $result.reason='METADATA_CHANGED';$after=& $p.Observe $target.path ($target.kind -ceq 'DIRECTORY') ($target.kind -ceq 'IMAGE')
            if (!(Test-Ix01ReadinessObservation $after $target $owner) -or (Get-Ix01ReadinessMetadataHash $after) -cne $metadataHash) { throw 'REJECTED' }
            $result.reason='WINDOW_EXPIRED';$now=& $p.Clock
            if (!(Test-Ix01ReadinessBudget $now $q $start $previous $step)) { throw 'REJECTED' };$previous=$now
            if ($null -ne $stream) { $closing=$stream;$stream=$null;$result.reason='CLOSE_UNCONFIRMED';$null=& $p.Close $closing }
            if ($ClassifyAliasConfig -and $target.kind -ceq 'CONFIG') {
                # 새 모드에서만 같은 원 읽기의 byte[]를 사용한다. config 재조회/새 IO 포트는 없다.
                $result.reason='ALIAS_UNCONFIRMED'
                $checked=if($target.role -ceq 'USER_CONFIG'){
                    Read-Ix01SubnetAliasConfig -UserBytes $body -SystemBytes $null -ClassifyIdentityPaths
                }else{
                    Read-Ix01SubnetAliasConfig -UserBytes $userConfig -SystemBytes $body -ClassifyIdentityPaths
                }
                if($checked.status -cne 'ALIAS_SUBSET') {
                    $result.reason=$checked.code
                    if($checked.role -cin @('USER_CONFIG','SYSTEM_CONFIG') -and (Test-Ix01ReadinessInteger $checked.line) -and $checked.line -le 4096){
                        $result.diagnostic=@{role=$checked.role;line=$checked.line}
                    }
                    throw 'REJECTED'
                }
                if($before.state -ceq 'PRESENT'){$entry.text='ALIAS_SUBSET'}
                if($target.role -ceq 'USER_CONFIG'){$userConfig=$body;$body=$null}else{
                    $alias=$checked
                    if($null -ne $userConfig){[Array]::Clear($userConfig,0,$userConfig.Length);$userConfig=$null}
                    if($null -ne $body){[Array]::Clear($body,0,$body.Length);$body=$null}
                }
            } elseif ($null -ne $body) {
                $verdict=Get-Ix01ReadinessTextVerdict $body $target.kind
                if ($verdict -cne 'SUBSET_ONLY') { $result.reason=$verdict;throw 'REJECTED' };$entry.text='SUBSET_ONLY'
                [Array]::Clear($body,0,$body.Length);$body=$null
            }
            if ($null -ne $buffer) { [Array]::Clear($buffer,0,$buffer.Length);$buffer=$null }
            $result.reason='WINDOW_EXPIRED';$now=& $p.Clock
            if (!(Test-Ix01ReadinessBudget $now $q $start $previous $step)) { throw 'REJECTED' };$previous=$now
            if ($before.state -ceq 'PRESENT') { $entry.aclHash=$before.aclHash }
            $result.files+=,$entry
        }
        if($ClassifyAliasConfig){$result.code='COMPARISON_ONLY';$result.alias=$alias}else{$result.code='INSPECTION_COLLECTED'}
        $result.reason='DEFAULT_SCOPE_ENV_AND_TRUST_UNCONFIRMED'
    } catch {
        $result.code='UNKNOWN' # 예외 message/경로/원문은 읽지도 반환하지도 않는다.
    } finally {
        if ($null -ne $stream) { try { $null=& $p.Close $stream } catch {} }
        if ($null -ne $digest) { $digest.Dispose() }
        if ($null -ne $buffer) { [Array]::Clear($buffer,0,$buffer.Length) }
        if ($null -ne $body) { [Array]::Clear($body,0,$body.Length) }
        if ($null -ne $userConfig) { [Array]::Clear($userConfig,0,$userConfig.Length) }
        # decoded 관리형 문자열/OS 내부 캐시의 즉시 소거는 보증하지 않는다.
    }
    $line=$result | ConvertTo-Json -Depth 8 -Compress
    if ([Text.Encoding]::UTF8.GetByteCount($line)+1 -gt 4096) { return '{"schemaVersion":1,"code":"UNKNOWN","readiness":"UNCONFIRMED","reason":"OUTPUT_LIMIT","files":[]}' }
    return $line
}

function New-Ix01WindowsReadinessNativePorts {
    # 포트 생성은 효과0. 아래 함수 호출은 미래 고정 실행안에서만 한다. OS 기본 경로를 증명하지 않는다.
    return @{
        Clock={ @{wall=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();mono=[long]([Diagnostics.Stopwatch]::GetTimestamp()*1000.0/[Diagnostics.Stopwatch]::Frequency)} }
        Owner={
            if (![OperatingSystem]::IsWindows()) { throw 'PLATFORM_UNCONFIRMED' }
            $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
            try { return $identity.User.Value } finally { $identity.Dispose() }
        }
        Observe={ param($path,$directory,$systemLeaf)
            $targets=Get-Ix01WindowsReadinessTargets
            if (@($targets | Where-Object {$_.path -ceq $path -and ($_.kind -ceq 'DIRECTORY') -eq $directory -and ($_.kind -ceq 'IMAGE') -eq $systemLeaf}).Count -ne 1) { throw 'TARGET_UNCONFIRMED' }
            $item=$null
            try { $item=Get-Item -LiteralPath $path -Force -ErrorAction Stop }
            catch [Management.Automation.ItemNotFoundException] {}
            $parents=@();$parent=Split-Path -Parent $path
            while ($parent) {
                if ($parents.Count -ge 16) { throw 'PATH_UNCONFIRMED' }
                $p=Get-Item -LiteralPath $parent -Force -ErrorAction Stop
                if ($p -isnot [IO.DirectoryInfo] -or $p.FullName -cne $parent -or ($p.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $p.LinkType) { throw 'PATH_UNCONFIRMED' }
                $acl=Get-Acl -LiteralPath $parent -ErrorAction Stop;$raw=$acl.GetSecurityDescriptorBinaryForm()
                try { if ($raw.Length -gt 65536) { throw 'ACL_UNCONFIRMED' };$aclHash=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($raw)).ToLowerInvariant() } finally { [Array]::Clear($raw,0,$raw.Length) }
                $parents+=@{path=$parent;reparse=$false;link='';created=$p.CreationTimeUtc.Ticks;attributes=[int]$p.Attributes;aclHash=$aclHash}
                $parent=Split-Path -Parent $parent
            }
            $o=@{state='ABSENT';path=$path;directory=[bool]$directory;reparse=$false;link='';created=0L;modified=0L;attributes=0;length=0L;owner='';aclHash='';rules=@();parents=$parents}
            if ($null -eq $item) { return $o }
            if ($item.FullName -cne $path -or ($directory -and $item -isnot [IO.DirectoryInfo]) -or (!$directory -and $item -isnot [IO.FileInfo]) -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'PATH_UNCONFIRMED' }
            if ($item.LinkType -and !($systemLeaf -and $item.LinkType -ceq 'HardLink')) { throw 'PATH_UNCONFIRMED' }
            $acl=Get-Acl -LiteralPath $path -ErrorAction Stop;$raw=$acl.GetSecurityDescriptorBinaryForm()
            try { if ($raw.Length -gt 65536) { throw 'ACL_UNCONFIRMED' };$o.aclHash=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($raw)).ToLowerInvariant() } finally { [Array]::Clear($raw,0,$raw.Length) }
            $rules=$acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]);if ($rules.Count -gt 128) { throw 'ACL_UNCONFIRMED' }
            foreach($r in $rules) { $o.rules+=@{sid=$r.IdentityReference.Value;allow=($r.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow);rights=[long]$r.FileSystemRights} }
            $o.state='PRESENT';$o.owner=$acl.GetOwner([Security.Principal.SecurityIdentifier]).Value;$o.link=$item.LinkType
            $o.created=$item.CreationTimeUtc.Ticks;$o.modified=$item.LastWriteTimeUtc.Ticks;$o.attributes=[int]$item.Attributes
            if (!$directory) { $o.length=$item.Length };return $o
        }
        Open={ param($path)
            if (@(Get-Ix01WindowsReadinessTargets | Where-Object {$_.path -ceq $path -and $_.kind -cne 'DIRECTORY'}).Count -ne 1) { throw 'TARGET_UNCONFIRMED' }
            return [IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
        }
        Read={ param($stream,$buffer,$count) $stream.Read($buffer,0,$count) }
        Close={ param($stream) $stream.Dispose() }
    }
}
