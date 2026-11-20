# 메모리에 검산 적재된 6847D094 원 helper 및 EB0B9449 alias helper만 재사용한다.
# 자동 진입/소스 로드/새 native 포트는 없다. 실제 호출은 별도 신규 승인과 원 감독의 책임이다.
function Invoke-Ix01ConfigReadiness($Binding, $Ports) {
    $ErrorActionPreference='Stop'
    $result=[ordered]@{schemaVersion=1;code='UNKNOWN';readiness='UNCONFIRMED';reason='INPUT_UNCONFIRMED';files=@()}
    $stream=$null;$buffer=$null;$body=$null;$digest=$null;$bodies=@{}
    try {
        if (!(Test-Ix01ReadinessKeys $Binding @('attemptId','approvalHash','planHash','sourceHash','issuedAt','expiresAt')) -or
            $Binding.attemptId -isnot [string] -or $Binding.attemptId -cnotmatch '\A[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z' -or
            !(Test-Ix01ReadinessHash $Binding.approvalHash) -or !(Test-Ix01ReadinessHash $Binding.planHash) -or !(Test-Ix01ReadinessHash $Binding.sourceHash) -or
            !(Test-Ix01ReadinessInteger $Binding.issuedAt) -or !(Test-Ix01ReadinessInteger $Binding.expiresAt) -or
            $Binding.expiresAt -le $Binding.issuedAt -or $Binding.expiresAt-$Binding.issuedAt -gt 60000 -or
            !(Test-Ix01ReadinessKeys $Ports @('Clock','Owner','Observe','Open','Read','Close'))) { throw 'REJECTED' }
        foreach($key in $Ports.Keys) { if ($Ports[$key] -isnot [scriptblock]) { throw 'REJECTED' } }
        $q=$Binding.Clone();$p=$Ports.Clone()
        $start=& $p.Clock;$previous=$start
        if (!(Test-Ix01ReadinessBudget $start $q $start $start $null)) { throw 'REJECTED' }
        $result.binding=$q
        $result.reason='IDENTITY_UNCONFIRMED';$owner=& $p.Owner
        if ($owner -isnot [string] -or $owner -cnotmatch '\AS-1-5-21-[0-9-]{1,160}\z') { throw 'REJECTED' }
        # 기존 고정 표의 두 CONFIG만 선택. caller 경로/역할/상한 입력은 받지 않는다.
        $targets=@(Get-Ix01WindowsReadinessTargets | Where-Object {$_.role -cin @('USER_CONFIG','SYSTEM_CONFIG')})
        if ($targets.Count -ne 2 -or $targets[0].role -cne 'USER_CONFIG' -or $targets[1].role -cne 'SYSTEM_CONFIG') { throw 'REJECTED' }
        foreach($target in $targets) {
            $result.reason='WINDOW_EXPIRED';$now=& $p.Clock
            if (!(Test-Ix01ReadinessBudget $now $q $start $previous $null)) { throw 'REJECTED' };$previous=$now;$step=$now
            $result.reason='METADATA_UNCONFIRMED';$before=& $p.Observe $target.path $false $false
            $result.reason='WINDOW_EXPIRED';$now=& $p.Clock
            if (!(Test-Ix01ReadinessBudget $now $q $start $previous $step)) { throw 'REJECTED' };$previous=$now
            $result.reason='METADATA_UNCONFIRMED'
            if (!(Test-Ix01ReadinessObservation $before $target $owner)) { throw 'REJECTED' }
            $metadataHash=Get-Ix01ReadinessMetadataHash $before
            $entry=[ordered]@{role=$target.role;state=$before.state;metadata='MATCHED'}
            if($before.state -ceq 'PRESENT') {
                $result.reason='READ_UNCONFIRMED';$stream=& $p.Open $target.path
                if($null -eq $stream) { throw 'REJECTED' }
                $opened=& $p.Observe $target.path $false $false
                if (!(Test-Ix01ReadinessObservation $opened $target $owner) -or (Get-Ix01ReadinessMetadataHash $opened) -cne $metadataHash) { throw 'REJECTED' }
                $result.reason='WINDOW_EXPIRED';$now=& $p.Clock
                if (!(Test-Ix01ReadinessBudget $now $q $start $previous $step)) { throw 'REJECTED' };$previous=$now
                $buffer=[byte[]]::new(8192);$body=[byte[]]::new([int]$before.length);$total=0L
                $digest=[Security.Cryptography.IncrementalHash]::CreateHash([Security.Cryptography.HashAlgorithmName]::SHA256)
                while($true) {
                    $result.reason='WINDOW_EXPIRED';$now=& $p.Clock
                    if (!(Test-Ix01ReadinessBudget $now $q $start $previous $step)) { throw 'REJECTED' };$previous=$now
                    $result.reason='READ_UNCONFIRMED';$count=& $p.Read $stream $buffer $buffer.Length
                    if (!(Test-Ix01ReadinessInteger $count) -or $count -gt $buffer.Length) { throw 'REJECTED' }
                    $result.reason='WINDOW_EXPIRED';$now=& $p.Clock
                    if (!(Test-Ix01ReadinessBudget $now $q $start $previous $step)) { throw 'REJECTED' };$previous=$now
                    if($count -eq 0) { break }
                    $result.reason='LENGTH_UNCONFIRMED'
                    if($total+$count -gt $before.length -or $total+$count -gt $target.maximum) { throw 'REJECTED' }
                    $digest.AppendData($buffer,0,[int]$count);[Array]::Copy($buffer,0,$body,[int]$total,[int]$count);$total+=$count
                }
                $result.reason='LENGTH_UNCONFIRMED';if($total -ne $before.length) { throw 'REJECTED' }
                $entry.bytes=$total;$entry.sha256=[Convert]::ToHexString($digest.GetHashAndReset()).ToLowerInvariant()
                $digest.Dispose();$digest=$null
            }
            $result.reason='METADATA_CHANGED';$after=& $p.Observe $target.path $false $false
            if (!(Test-Ix01ReadinessObservation $after $target $owner) -or (Get-Ix01ReadinessMetadataHash $after) -cne $metadataHash) { throw 'REJECTED' }
            $result.reason='WINDOW_EXPIRED';$now=& $p.Clock
            if (!(Test-Ix01ReadinessBudget $now $q $start $previous $step)) { throw 'REJECTED' };$previous=$now
            if($null -ne $stream) { $closing=$stream;$stream=$null;$result.reason='CLOSE_UNCONFIRMED';$null=& $p.Close $closing }
            $result.reason='WINDOW_EXPIRED';$now=& $p.Clock
            if (!(Test-Ix01ReadinessBudget $now $q $start $previous $step)) { throw 'REJECTED' };$previous=$now
            # 첫 파일의 불명도 다음 파일 읽기 전에 닫는다. user/system 최종 첫 값은 아래에서 합성한다.
            $verdict=if($target.role -ceq 'USER_CONFIG'){Read-Ix01SubnetAliasConfig -UserBytes $body -SystemBytes $null}else{Read-Ix01SubnetAliasConfig -UserBytes $null -SystemBytes $body}
            if($verdict.status -cne 'ALIAS_SUBSET') {
                $result.reason=$verdict.code
                if($verdict.role -cin @('USER_CONFIG','SYSTEM_CONFIG') -and (Test-Ix01ReadinessInteger $verdict.line) -and $verdict.line -le 4096) {
                    $result.diagnostic=@{role=$verdict.role;line=$verdict.line}
                }
                throw 'REJECTED'
            }
            $result.reason='WINDOW_EXPIRED';$now=& $p.Clock
            if (!(Test-Ix01ReadinessBudget $now $q $start $previous $step)) { throw 'REJECTED' };$previous=$now
            if($before.state -ceq 'PRESENT') { $entry.aclHash=$before.aclHash;$entry.text='ALIAS_SUBSET' }
            $bodies[$target.role]=$body;$body=$null;$result.files+=,$entry
            if($null -ne $buffer) { [Array]::Clear($buffer,0,$buffer.Length);$buffer=$null }
        }
        $verdict=Read-Ix01SubnetAliasConfig -UserBytes $bodies['USER_CONFIG'] -SystemBytes $bodies['SYSTEM_CONFIG']
        if($verdict.status -cne 'ALIAS_SUBSET') {
            $result.reason=$verdict.code
            if($verdict.role -cin @('USER_CONFIG','SYSTEM_CONFIG') -and (Test-Ix01ReadinessInteger $verdict.line) -and $verdict.line -le 4096) {
                $result.diagnostic=@{role=$verdict.role;line=$verdict.line}
            }
            throw 'REJECTED'
        }
        $result.reason='WINDOW_EXPIRED';$now=& $p.Clock
        if (!(Test-Ix01ReadinessBudget $now $q $start $previous $null)) { throw 'REJECTED' }
        $result.alias=$verdict;$result.code='CONFIG_INSPECTION_COLLECTED';$result.reason='DEFAULT_SCOPE_ENV_AND_TRUST_UNCONFIRMED'
    } catch { $result.code='UNKNOWN' } finally {
        if($null -ne $stream) { try { $null=& $p.Close $stream } catch {} }
        if($null -ne $digest) {$digest.Dispose()}
        if($null -ne $buffer) {[Array]::Clear($buffer,0,$buffer.Length)}
        if($null -ne $body) {[Array]::Clear($body,0,$body.Length)}
        foreach($owned in $bodies.Values) {if($null -ne $owned){[Array]::Clear($owned,0,$owned.Length)}}
        # 원 byte[]는 폐기하며 관리형 문자열/OS 내부 캐시의 즉시 소거는 보장하지 않는다.
    }
    $line=$result | ConvertTo-Json -Depth 8 -Compress
    if([Text.Encoding]::UTF8.GetByteCount($line)+1 -gt 4096) {return '{"schemaVersion":1,"code":"UNKNOWN","readiness":"UNCONFIRMED","reason":"OUTPUT_LIMIT","files":[]}'}
    return $line
}
