# C-13 R2 WorkInstruction — 세 번째 실패 Main takeover 계약 보완

## 범위

기존 C-13 구현을 현재 정본과 대조하여, C-12의 canonical `takeover_required` 신호를 받은 뒤 Developer 실행을 중지하고 worker/write lease와 tool 권한을 회수한 다음 Main Agent 전용 `TakeoverPacket`과 audit/projection을 생성하는 결정적 서비스를 보완한다. 세 번째 동일 lineage/fingerprint에서만 동작하며 동시 write가 0건임을 검증한다.

R2의 핵심 보완은 Main Agent가 직접 인수를 시작하기 전에 최신 WorkInstruction, diff, test output, checkpoint 및 세 번의 실패보고를 모두 검증 가능한 불변 reference로 받은 사실을 packet과 audit에 결박하는 것이다. 누락·종류 오류·hash 오류·session/delegation 불일치는 stop/revoke 이전에 fail-closed여야 한다.

허용 경로: `packages/orchestration/**`, `packages/leases/**`, `packages/tool_gateway/**`, `tests/orchestration/**`, `tests/leases/**`, `docs/04_test_reports/C-13_COMPLETION_REPORT.md`.

실제 Workbench/UI, DB/API/browser/provider/deployment 호출은 금지한다.

## 완료 조건

1. count<3은 takeover를 실행하지 않는다.
2. count=3에서 완전한 인수 evidence bundle 검증→Developer stop→lease/tool revoke→Main takeover packet 순서와 audit가 원자적으로 기록된다.
3. stale token·다른 lineage·중복 takeover는 fail-closed/idempotent다.
4. takeover 후 동시 write lease가 0건이며 C-12 ledger와 연결된다.
5. 조기 인수는 이 서비스에서 생성하지 않으며 `THIRD_VALID_FAILURE` actor/reason이 명시된다.
6. 신규·관련 테스트, compileall, diff-check와 미검증 운영 경계를 보고한다.
