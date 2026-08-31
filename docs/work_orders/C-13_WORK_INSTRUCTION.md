# C-13 WorkInstruction — 세 번째 실패 Main takeover

## 범위

`packages/orchestration`에 C-12의 `takeover_required` 신호를 받아 Developer 실행을 중지하고 worker/write lease와 tool 권한을 회수한 뒤 Main Agent 전용 `TakeoverPacket`과 audit/projection을 생성하는 결정적 서비스를 구현한다. 세 번째 동일 lineage/fingerprint에서만 동작하며 동시 write가 0건임을 검증한다.

허용 경로: `packages/orchestration/**`, `packages/leases/**`, `packages/tool_gateway/**`, `tests/orchestration/**`, `tests/leases/**`, `docs/04_test_reports/C-13_COMPLETION_REPORT.md`.

실제 Workbench/UI, DB/API/browser/provider/deployment 호출은 금지한다.

## 완료 조건

1. count<3은 takeover를 실행하지 않는다.
2. count=3에서 Developer stop→lease/tool revoke→Main takeover packet 순서와 audit가 원자적으로 기록된다.
3. stale token·다른 lineage·중복 takeover는 fail-closed/idempotent다.
4. takeover 후 동시 write lease가 0건이며 C-12 ledger와 연결된다.
5. 신규·관련 테스트, compileall, diff-check와 미검증 운영 경계를 보고한다.
