# C-10 WorkInstruction — Action·Risk·Permission·Egress·Secret Broker 정책

## 범위

`packages/tool_gateway`와 신규 `packages/action_policy`에 patch/write/execute Action 모델 및 결정적 정책 평가를 구현한다. 두 fencing token, 허용 path, egress snapshot을 필수로 검증하고 Agent의 secret read, metadata/redirect/DNS rebinding, destructive action을 기본 거부한다. structured receipt와 reason code를 반환하며 기존 C-09 read gateway 계약을 보존한다.

허용 경로: `packages/action_policy/**`, `packages/tool_gateway/**`, `tests/action_policy/**`, `tests/tool_gateway/**`, `docs/04_test_reports/C-10_COMPLETION_REPORT.md`.

실제 secret manager, 네트워크, DB/API/browser/deployment는 호출하지 않는다. historical progress/event/hash는 변경하지 않는다.

## 완료 조건

1. 허용 path·유효 fencing·egress snapshot이 없는 Action은 fail-closed.
2. patch/write/execute의 위험 등급과 permission/secret 정책이 deterministic receipt로 남는다.
3. secret read, destructive command, metadata/redirect/DNS rebinding, path traversal 및 stale token이 거부된다.
4. 신규·관련 테스트, compileall, `git diff --check` 통과 및 미검증 운영 경계를 보고한다.
