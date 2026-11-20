# IdentityFile 인자 한 개의 순수 문자열 분류. 원 alias helper/소진 실행 closure는 변경하지 않는다.
# OpenBSD ssh_config(5)의 tilde/token/environment 참조와 따옴표 가능성을 구분하는 좁은 도구다.
# token 이름별 허용성, Windows 설치판의 실제 lexer/escape/경로 해석을 검증한 구현이 아니다.
# TOKEN_SYNTAX의 %Z도 문법 표식일 뿐 지원 token 판정이 아니다. 실제 값/경로/파일/키는 반환·조회0.
function Read-Ix01IdentityPathSyntax($Value) {
    $reason='INPUT_UNCONFIRMED'
    try {
        if($Value -isnot [string] -or $Value.Length -eq 0 -or $Value.Length -gt 16384) {throw 'REJECTED'}
        $reason='TEXT_UNCONFIRMED'
        $length=[Text.UTF8Encoding]::new($false,$true).GetByteCount($Value)
        if($Value -match '[\x00-\x1F\x7F\u0085\u2028\u2029\uFEFF]') {throw 'REJECTED'}
        $reason='INPUT_UNCONFIRMED';if($length -gt 16384) {throw 'REJECTED'}
        $quoted=$false;$body=$Value
        $reason='ESCAPE_UNCONFIRMED'
        if($body.Contains('\"') -or $body -match '\\\s') {throw 'REJECTED'}
        $reason='QUOTING_UNCONFIRMED'
        if($body.StartsWith('"') -or $body.EndsWith('"')) {
            if($body.Length -lt 3 -or !$body.StartsWith('"') -or !$body.EndsWith('"')) {throw 'REJECTED'}
            $body=$body.Substring(1,$body.Length-2);$quoted=$true
        }
        if($body.Contains('"') -or $body.Contains("'") -or (!$quoted -and $body -match '\s')) {throw 'REJECTED'}
        $reason='NAMESPACE_UNCONFIRMED'
        if($body -match '\A(?:\\\\|//)[?.][\\/]') {throw 'REJECTED'}
        $token=$false;$environment=$false
        # 표식만 소비한다. 확장/치환/경로 정규화/기본값을 만들지 않는다.
        for($i=0;$i -lt $body.Length;$i++) {
            $character=$body[$i]
            if($character -ceq '%') {
                $reason='TOKEN_UNCONFIRMED'
                if($i+1 -ge $body.Length -or [string]$body[$i+1] -cnotmatch '\A[A-Za-z%]\z') {throw 'REJECTED'}
                $token=$true;$i++;continue
            }
            if($character -ceq '$') {
                $reason='ENVIRONMENT_UNCONFIRMED'
                if($i+1 -ge $body.Length -or $body[$i+1] -cne '{') {throw 'REJECTED'}
                $end=$body.IndexOf('}',$i+2)
                if($end -lt 0 -or $end-$i -gt 258 -or $body.Substring($i+2,$end-$i-2) -cnotmatch '\A[A-Za-z_][A-Za-z0-9_]{0,255}\z') {throw 'REJECTED'}
                $environment=$true;$i=$end;continue
            }
            $reason='PATH_UNCONFIRMED'
            if([string]$character -cmatch '[<>|?*{}#]' -or ($character -ceq ':' -and !($i -eq 1 -and [string]$body[0] -cmatch '\A[A-Za-z]\z'))) {throw 'REJECTED'}
        }
        $reference=if($token -and $environment){'MIXED_SYNTAX'}elseif($token){'TOKEN_SYNTAX'}elseif($environment){'ENVIRONMENT_SYNTAX'}else{'LITERAL'}
        $kind=if($body -ceq 'none'){'NONE_LITERAL'}
              elseif($body -match '(?:\A|[\\/])\.{1,2}(?:[\\/]|\z)'){'DOT_SEGMENT_PATH'}
              elseif($body -match '\A[A-Za-z]:[\\/]'){'WINDOWS_DRIVE_PATH'}
              elseif($body -match '\A[A-Za-z]:'){'DRIVE_RELATIVE_PATH'}
              elseif($body.StartsWith('\\') -or $body.StartsWith('//')){'UNC_PATH'}
              elseif($body.StartsWith('~/')){'TILDE_PATH'}
              elseif($body -cmatch '\A~[A-Za-z0-9_][A-Za-z0-9_.-]*/'){'NAMED_TILDE_PATH'}
              elseif($body.StartsWith('/') -or $body.StartsWith('\')){'ROOTED_PATH'}
              else{'RELATIVE_PATH'}
        # CLASSIFIED는 경로 형상 분류일 뿐 수용/파일 존재/SSH 호환/인증·실행 권위가 아니다.
        return @{schemaVersion=1;status='CLASSIFIED';readiness='UNCONFIRMED';kind=$kind;reference=$reference;quoted=$quoted}
    } catch {
        return @{schemaVersion=1;status='UNKNOWN';readiness='UNCONFIRMED';code=$reason}
    }
}
