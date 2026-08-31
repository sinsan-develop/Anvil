# C-16 WorkInstruction — Agent Team durable collaboration primitives

## 범위

`packages/agent_team`에 TeamSession·TeamTask·dependency·TeamMessage/Mailbox·ConversationTurn·DecisionRequest의 immutable schema와 canonical hash를 구현한다. 사용자↔Agent 및 Agent↔Agent thread identity를 명시하고, append-only event와 progress projection을 deterministic하게 제공한다.

허용 경로: `packages/agent_team/**`, `tests/agent_team/**`, `docs/04_test_reports/C-16_COMPLETION_REPORT.md`.

실제 LLM/provider, DB/API/browser/Telegram/deployment 호출과 기존 historical progress/event/hash 변경은 금지한다. C-17의 orchestration/peer execution은 구현하지 않는다.

## 완료 조건

1. 각 schema가 필수 identity·상태·시간·parent hash를 fail-closed 검증한다.
2. 사용자↔Agent와 Agent↔Agent thread identity가 혼동 없이 구분된다.
3. dependency cycle·stale parent·중복 event/message·잘못된 actor가 거부된다.
4. mailbox와 conversation turn이 append-only event/progress projection으로 재현된다.
5. 신규·관련 테스트, compileall, `git diff --check`와 미검증 운영 경계를 보고한다.
