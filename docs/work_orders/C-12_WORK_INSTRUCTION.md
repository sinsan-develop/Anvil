# C-12 WorkInstruction — Failure lineage·fingerprint·유효 횟수 집계

## 범위

`packages/orchestration`에 C-06 valid FAILURE_REPORT와 C-07 outcome 결과를 연결하는 불변 failure ledger를 구현한다. lineage/fingerprint를 canonical evidence에서 계산하고, 동일 lineage/fingerprint의 유효 보고만 1·2·3회로 누적한다. 무효 보고, 내부 재시도·quota·권한/환경 문제는 집계하지 않으며 replay 결과는 결정적이어야 한다.

허용 경로: `packages/orchestration/**`, `tests/orchestration/**`, `docs/04_test_reports/C-12_COMPLETION_REPORT.md`.

실제 DB/API/browser/provider/deployment 호출과 historical progress/event/hash 변경은 금지한다.

## 완료 조건

1. valid FAILURE_REPORT만 lineage/fingerprint별 유효 count와 최신 상태를 만든다.
2. 동일 report replay는 중복 증가 없이 idempotent receipt를 반환한다.
3. 다른 lineage/fingerprint는 분리 집계하고 무효/환경성 실패는 count 0이다.
4. 3회 도달 시 takeover 후보 신호를 만들되 실제 lease 회수는 C-13에서만 수행한다.
5. 신규·관련 테스트, compileall, `git diff --check`와 미검증 경계를 보고한다.
