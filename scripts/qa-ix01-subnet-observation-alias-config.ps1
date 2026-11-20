# 순수 오프라인 subset 판독. 원 6847D094 검사/실제 출력/실행안을 대체하지 않는다.
# 호출자가 제공한 user/system 바이트만 읽는다. null은 명시 부재이며 실제 부재 증명이 아니다.
# OpenSSH 전체 문법/기본값/인증/host trust/현재성/승인을 발급하지 않는다.
function Read-Ix01SubnetAliasConfig($UserBytes, $SystemBytes, [switch]$ClassifyIdentityPaths) {
    $reason='INPUT_UNCONFIRMED';$role='USER_CONFIG';$lineNumber=0;$owned=$null
    try {
        $selected=@{};$identity=$null;$userKind='UNSET'
        $inputs=@(@{role='USER_CONFIG';bytes=$UserBytes},@{role='SYSTEM_CONFIG';bytes=$SystemBytes})
        foreach ($inputFile in $inputs) {
            $role=$inputFile.role;$lineNumber=0;$reason='INPUT_UNCONFIRMED'
            if ($null -eq $inputFile.bytes) { continue }
            if ($inputFile.bytes -isnot [byte[]] -or $inputFile.bytes.Length -gt 65536) { throw 'REJECTED' }
            $owned=[byte[]]$inputFile.bytes.Clone()
            $reason='TEXT_UNCONFIRMED'
            $text=[Text.UTF8Encoding]::new($false,$true).GetString($owned)
            if ($text.Contains([char]0) -or $text.Contains([char]0xFEFF) -or $text -match '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0085\u2028\u2029]') { throw 'REJECTED' }
            $lines=$text.Split([char]10)
            if ($lines.Count -gt 4096) { throw 'REJECTED' }
            # 각 파일의 Host 앞 전역 구간은 활성이다. user의 마지막 Host를 system에 이월하지 않는다.
            $active=$true
            foreach ($raw in $lines) {
                $lineNumber++;$reason='TEXT_UNCONFIRMED'
                if ($raw.Length -gt 16384) { throw 'REJECTED' }
                $line=$raw
                if ($line.EndsWith([string][char]13)) { $line=$line.Substring(0,$line.Length-1) }
                if ($line.Contains([char]13)) { throw 'REJECTED' }
                $line=$line.Trim([char[]]@([char]32,[char]9))
                if (!$line -or $line.StartsWith('#')) { continue }
                $reason='MALFORMED_CONFIG'
                # 따옴표/continuation/inline comment 확장은 지원하지 않는다.
                if ($line -cnotmatch '\A([A-Za-z][A-Za-z0-9]*)(?:[\t ]*=[\t ]*|[\t ]+)([^\r\n]+)\z') { throw 'REJECTED' }
                $key=$Matches[1].ToLowerInvariant();$value=$Matches[2]
                if ($key -ceq 'host') {
                    $reason='UNSUPPORTED_HOST_PATTERN';$positive=$false;$negative=$false
                    $patterns=$value -split '[\t ]+'
                    if ($patterns.Count -gt 64) { throw 'REJECTED' }
                    foreach ($pattern in $patterns) {
                        if ($pattern -cnotmatch '\A!?[A-Za-z0-9*?][A-Za-z0-9._*?-]{0,127}\z') { throw 'REJECTED' }
                        $negated=$pattern.StartsWith('!');$body=if($negated){$pattern.Substring(1)}else{$pattern}
                        # 고정 ASCII alias만 대상으로 glob을 escaped regex에 변환한다. 네트워크/DNS 정규화0.
                        $regex='\A'+[regex]::Escape($body).Replace('\*','.*').Replace('\?','.')+'\z'
                        $matched=[regex]::IsMatch('WSL-server',$regex,[Text.RegularExpressions.RegexOptions]::IgnoreCase -bor [Text.RegularExpressions.RegexOptions]::CultureInvariant -bor [Text.RegularExpressions.RegexOptions]::NonBacktracking)
                        if ($matched) { if ($negated) {$negative=$true} else {$positive=$true} }
                    }
                    $active=$positive -and !$negative
                    continue
                }
                # 불명 조건/추가 파일/명령은 다른 Host에서도 평가하지 않는다. 무해하다고 추정하지 않는다.
                if ($key -ceq 'include') { $reason='INCLUDE_UNCONFIRMED';throw 'REJECTED' }
                if ($key -ceq 'match') { $reason='MATCH_UNCONFIRMED';throw 'REJECTED' }
                if ($key -cin @('userknownhostsfile','globalknownhostsfile','knownhostscommand','hostkeyalias')) { $reason='CUSTOM_SCOPE_UNCONFIRMED';throw 'REJECTED' }
                if ($key -cin @('proxycommand','proxyjump','localcommand','permitlocalcommand','remotecommand','identityagent','forwardagent','forwardx11','forwardx11trusted','localforward','remoteforward','dynamicforward','tunnel','controlmaster','controlpath','controlpersist','canonicalizehostname')) { $reason='EFFECT_UNCONFIRMED';throw 'REJECTED' }
                # 비대상의 heartbeat 간격만 좁게 무시한다. 대상에서의 의미/기본값은 아직 지원하지 않는다.
                if (!$active -and $key -ceq 'serveraliveinterval') { continue }
                if ($key -cnotin @('hostname','user','port','identityfile','identitiesonly')) { $reason='UNSUPPORTED_DIRECTIVE';throw 'REJECTED' }
                # 확실한 비대상의 알려진 무해 지시 값은 해석하거나 경로를 따라가지 않는다.
                if (!$active) { continue }
                $reason='MALFORMED_VALUE'
                switch -CaseSensitive ($key) {
                    'hostname' { if ($value -cnotmatch '\A[A-Za-z0-9][A-Za-z0-9.-]{0,252}\z') { throw 'REJECTED' } }
                    'user' { if ($value -cnotmatch '\A[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}\z') { throw 'REJECTED' } }
                    'port' { if ($value -cnotmatch '\A[0-9]{1,5}\z' -or [int]$value -lt 1 -or [int]$value -gt 65535) { throw 'REJECTED' } }
                    'identitiesonly' { if ($value -cnotin @('yes','no')) { throw 'REJECTED' } }
                    'identityfile' {
                        if ($ClassifyIdentityPaths) {
                            # 새 closure에서만 명시 선택한다. 구형 호출은 원 tilde 검사 그대로다.
                            $reason='IDENTITY_CLASSIFIER_UNCONFIRMED'
                            $classification=Read-Ix01IdentityPathSyntax $value
                            $reason='PATH_UNCONFIRMED'
                            if ($classification -isnot [hashtable] -or $classification.Count -ne 6 -or
                                $classification.schemaVersion -ne 1 -or $classification.status -cne 'CLASSIFIED' -or
                                $classification.readiness -cne 'UNCONFIRMED' -or $classification.reference -cne 'LITERAL' -or
                                $classification.quoted -isnot [bool] -or $classification.kind -cnotin @('WINDOWS_DRIVE_PATH','TILDE_PATH')) { throw 'REJECTED' }
                        } else {
                            $reason='PATH_UNCONFIRMED'
                            if ($value -cnotmatch '\A~/\.ssh/[A-Za-z0-9_.-]{1,128}\z' -or $value -cin @('~/.ssh/.','~/.ssh/..')) { throw 'REJECTED' }
                        }
                        # IdentityFile은 누적형이다. scalar 첫 값으로 바꾸지 않고 복수 적용은 미지원이다.
                        if ($null -ne $identity) { $reason='IDENTITY_SET_UNCONFIRMED';throw 'REJECTED' }
                        $identity=@{key=$key;role=$role;line=$lineNumber}
                        continue
                    }
                }
                if ($key -cne 'identityfile' -and !$selected.ContainsKey($key)) {
                    $selected[$key]=@{key=$key;role=$role;line=$lineNumber}
                    if ($key -ceq 'user') { $userKind=if($value -ceq 'root'){'ROOT_LITERAL'}else{'NON_ROOT_LITERAL'} }
                }
            }
            [Array]::Clear($owned,0,$owned.Length);$owned=$null
        }
        $fields=@();foreach($key in @('hostname','user','port','identitiesonly')) { if($selected.ContainsKey($key)) {$fields+=$selected[$key]} }
        if($null -ne $identity) {$fields+=$identity}
        # ROOT_LITERAL은 분류뿐이다. UNSET을 비root/기본 사용자로 추정하지 않고 값/경로도 반환하지 않는다.
        return @{schemaVersion=1;status='ALIAS_SUBSET';code='CONFIG_CLASSIFIED';alias='WSL-server';readiness='UNCONFIRMED';userKind=$userKind;fields=$fields}
    } catch {
        return @{schemaVersion=1;status='UNKNOWN';code=$reason;alias='WSL-server';readiness='UNCONFIRMED';role=$role;line=$lineNumber}
    } finally {
        if($null -ne $owned) {[Array]::Clear($owned,0,$owned.Length)}
        # 관리형 문자열의 즉시 소거는 보장하지 않는다. 외부 출력/저장/호출은 없다.
    }
}
