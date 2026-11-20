# 새 4소스 closure를 검산 적재한 원 감독에서만 명시 호출한다. 자동 진입/실제 승인 발급0.
# 원 8역할 순회·native 포트·기한·소유/ACL·공개 trust 검사를 재사용하며 config를 다시 읽지 않는다.
# 성공도 COMPARISON_ONLY/UNCONFIRMED다. alias 적용·host trust·env·접속 권위는 발급하지 않는다.
function Invoke-Ix01WindowsFinalReadiness($Binding, $Ports) {
    return Invoke-Ix01WindowsReadiness -Binding $Binding -Ports $Ports -ClassifyAliasConfig
}
