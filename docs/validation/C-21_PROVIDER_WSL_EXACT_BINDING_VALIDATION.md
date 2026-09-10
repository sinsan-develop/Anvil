# C-21 Provider WSL exact binding 검증

seq540~542는 seq1~539를 변경하지 않고 terminal lease revoke/completion Event만 append한다.

검증 기준:

- K direct exact14 / cumulative exact125
- private development control/candidate ref와 compare-and-swap 계약
- WSL runtime origin의 private URL과 clean detached repository
- initial/deployed/rolledback lifecycle tuple 외 mutation 전 fail-closed
- rollback allowlist candidate/predeploy-current/observed-previous
- 외부 실행 전 상태이므로 모든 외부 side effect는 `NOT_EXECUTED`

