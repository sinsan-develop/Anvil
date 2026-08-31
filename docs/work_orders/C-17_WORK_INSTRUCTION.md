# C-17 WorkInstruction — Team orchestration·peer communication·협업 E2E

## 범위

`packages/agent_team`의 C-16 durable primitives 위에 Leader/Teammate 생성, 직접 메시지·task claim, peer review, idle/completion hook, 중단/재개, write conflict·stale message·cost limit을 검증하는 deterministic orchestration과 synthetic E2E를 구현한다.

허용 경로: `packages/agent_team/**`, `tests/agent_team/**`, `docs/04_test_reports/C-17_COMPLETION_REPORT.md`.

실제 LLM/provider, DB/API/browser/Telegram/deployment/network 호출과 제품 write는 금지한다. C-18 MoA routing은 구현하지 않는다.

## 완료 조건

1. leader/teammate lifecycle과 task claim이 identity·dependency·lease에 결박된다.
2. Agent↔Agent/user↔Agent 메시지가 mailbox/event projection으로 전달되고 stale/foreign message가 차단된다.
3. peer review·idle/completion hook·pause/resume이 deterministic하게 재현된다.
4. write conflict와 cost limit이 fail-closed이며 replay가 idempotent다.
5. 신규·관련 테스트, compileall, diff-check와 미검증 운영 경계를 보고한다.
