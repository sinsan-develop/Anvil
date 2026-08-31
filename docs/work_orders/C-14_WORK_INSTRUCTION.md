# C-14 WorkInstruction — G0~G3 Gate·EvidenceManifest·Apply Approval

## 범위

`packages/verification`과 관련 orchestration에 결정적 G0~G3 gate engine, diff review, EvidenceManifest 및 Apply Approval 서비스를 구현한다. PASS만 완료로 집계하고 SKIPPED/BLOCKED/ERROR는 차단한다. verified=delivered=manifest target hash를 강제하며 blocking defect 또는 미완료 ProductValidation이 있으면 적용을 거부한다.

허용 경로: `packages/verification/**`, `packages/orchestration/**`, `tests/verification/**`, `tests/orchestration/**`, `docs/04_test_reports/C-14_COMPLETION_REPORT.md`.

실제 배포·DB/API/browser/provider 호출과 historical progress/event/hash 변경은 금지한다.

## 완료 조건

1. G0~G3 각 상태(PASS/FAIL/SKIPPED/BLOCKED/ERROR)가 명시적으로 판정된다.
2. EvidenceManifest target hash와 delivered/verified hash 불일치, blocking defect, 미완료 ProductValidation은 fail-closed다.
3. 사람 ReleaseDecision과 Apply Approval이 유효한 대상 hash에만 결박된다.
4. replay/idempotency와 stale approval 차단을 검증한다.
5. 신규·관련 테스트, compileall, diff-check 및 미검증 운영 경계를 보고한다.
