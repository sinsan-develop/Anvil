# F-20 C30 Event 원장 복구 독립 판정

## 판정

독립 read-only Tester는 committed `6b95360d`까지의 증거에 대해 **ELIGIBLE — recovery-verified Event 기록 준비 가능**, Critical/Important 0으로 판정했다. 이는 C30 원장 무결성 사고의 새 세대 복구 통제에 한정된다. F-20/U-01 수락, Release `GO`, 운영·`ysna-server` 검증은 포함하지 않는다.

## 독립 확인

- 정상 anchor Git blob `b59ac57228f9b5684b939dc30fc7d7bce5dbbb54`의 Event 1712개와 컷오버 blob `0f86d09446b40905e9d33e9e6cbe4c1380a63218`의 Event 2040개를 직접 대조했다.
- seq2044에 고정한 사전검증기 `eligible=true/errors=[]`: 기존 의미 변경 24건, 사고 추가 2건, 거짓 수락 11건, 후속 seq1715~2040 326 Event, WorkInstruction 54건, dual lease 54쌍, 완료 projection 108개를 재계산했다.
- seq2045~2046 lease close와 seq2047 generation start의 `validate_control=[]`를 확인했다. 이전 2046개 Event 객체의 원시 bytes는 보존됐다.
- `d58d95f1`→`6b95360d`의 변경은 WORK_STATUS 기록만이다. 최신 committed 상태는 C30 `OPEN_BLOCKING`, F-20 미수락, Release `DEFER`, generation authority 비활성이다.
- 이 독립 판정은 현재 작업 중인 미추적 recovery-verified 테스트 파일을 제외한 committed 증거를 대상으로 한다. 그 파일 때문에 작업 중 G-05 dirty guard가 실패하는 것은 seq2047 자체의 오류가 아니다.

## WSL-server 동일 SHA QA의 출처와 원시 결과

아래 WSL-server 실행은 Main이 직접 수행했다. Tester는 해당 서버에서 재실행하지 않았으며 Main의 실행 출력과 WORK_STATUS 기록을 근거로 범위를 분리해 판단했다.

- QA commit: `d58d95f121e24bd5cb199617e1afbcac8cafa80a`; 전용 checkout `/tmp/anvil-c30v2-gen-qa-d58d95f`의 clean HEAD와 private ref가 동일했다.
- 명령: `cd /tmp/anvil-c30v2-gen-qa-d58d95f && python3 -B scripts/check_project_progress.py`; exit 0; stdout: `G-05 project progress contract: PASS sequence=2047 reporting=AUTO_CONTINUE`.
- 명령: `cd /tmp/anvil-c30v2-gen-qa-d58d95f && python3 -B -m unittest tests.tooling.test_f20_c30_generation_start_projection tests.tooling.test_f20_c30_recovery_close_projection`; exit 0; stdout/stderr 핵심: `Ran 7 tests in 23.107s`, `OK`.
- 정리 전 전용 경로 realpath `/tmp` 하위, UID1000, Git dirty/ignored 0, 내부 symlink 0, mount target `/`, 관련 Python 프로세스 0을 확인했다. 명령 `rm -r -- /tmp/anvil-c30v2-gen-qa-d58d95f` exit 0, `test ! -e /tmp/anvil-c30v2-gen-qa-d58d95f` exit 0. Git SHA에서 복구 가능하다.
- 첫 제한 sandbox의 `ssh WSL-server`는 alias 미제공으로 exit 1이었고, 실제 WSL 환경 장애가 아니라 실행 환경 권한 차이였다. 설정된 SSH alias로 재실행해 상기 QA를 완료했다.

## 다음 통제와 잔여 범위

Main은 recovery-verified 투영의 fail-closed 테스트, 기존 seq1~2047 원시 객체 보존, 현행 G-05, clean checkpoint/private push와 WSL-server 동일 SHA를 확인한 뒤에만 `RECOVERED_WITH_QUARANTINED_HISTORY`로 상태를 옮긴다. 거짓 수락 11건은 격리된 사고 증거로 남고 새 세대에서 수락 권위로 이월하지 않는다. F-20/U-01 수락 및 Release `DEFER`는 별도 조건으로 유지한다.
