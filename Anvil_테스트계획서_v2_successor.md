# Anvil 테스트계획서 v2 successor

> 상태: `HUMAN_APPROVED_SEMANTIC_SUCCESSOR_SCOPE`
> 짝 매트릭스: `Anvil_통합검증매트릭스_v2_successor.md`
> historical 기준선: `Anvil_테스트계획서_v1.md` v1.5 — 변경하지 않음

## 1. 목적과 범위

v2 successor는 C-16~C-20 Agent Teams·Capability MoA·원격 제어·Telegram adapter prototype의 단위/계약/적대적 경계를 독립적으로 추적한다. 신산님의 `HUMAN_APPROVED_SEMANTIC_SUCCESSOR_SCOPE` binding은 이 문서의 successor 정합성과 C-21 준비 범위에 한정된다. 이 계획은 운영 API·DB·브라우저·Provider·Telegram webhook을 구현하거나 실행하지 않는다. focused test PASS는 prototype 범위의 PASS이며 Gate·운영 인수 PASS가 아니다.

## 2. 실행 절차

각 Package 종료 시 다음을 기록한다.

1. 시작 `HEAD`, branch, `git status`, 기준 문서 hash
2. 승인된 scope 밖 변경 여부와 exact diff
3. focused pytest 결과(실행 수·PASS·FAIL·SKIP)
4. compileall 및 `git diff --check`
5. 미실행·환경차단 범위
6. 독립 scoped review 및 Main 판정

## 3. C-16~C-20 테스트 묶음

| Package No. | Package | 정상/계약 | negative/invariant | 장애·복구 | 예상 prototype evidence |
|---:|---|---|---|---|---|
| 109 | C-16 | models, enum, immutable contract | timestamp, invalid transition, ack state | replay/stale mailbox | `12 passed` |
| 110 | C-17 | orchestration lifecycle | leader/dependency/revision/scope rejection | duplicate/stale/restart event | `4 passed` |
| 111 | C-18 | catalog/profile/router | unsupported/unhealthy/budget/stale/duplicate route | fallback unavailable/drift record | `4 passed` |
| 112 | C-19 | remote snapshot/cursor/command | auth/expiry/approval-required/fencing | offline queue duplicate/stale/future | `5 passed` |
| 113 | C-20 | notification/envelope/deep-link | HMAC/allowlist/expiry/replay/tamper/redaction | webhook/rate-limit/secret rotation boundary | `7 passed` |

누적 focused evidence는 `33 passed`이며, compileall·diff-check·scoped whole-branch review 결과와 함께 기록한다.

## 4. 판정 규칙

- `FAIL`, 승인 우회, secret 노출, high-risk 실행, 미실행을 PASS로 기록하면 `CRITICAL`이며 successor gate를 차단한다.
- 기능 계약 또는 필수 evidence 누락은 `MAJOR`로 재작업한다.
- 문구·비차단 관측성 보완은 `MINOR`로 다음 작업에 흡수하며 accepted prototype을 사후 재개하지 않는다.
- `SKIPPED`, `BLOCKED`, `NOT_EXECUTED`는 PASS가 아니다.
- 기존 DIR-1/DIR-2/DIR-3/DIR-X 위치와 Phase B Gate는 변경하지 않는다.

## 5. 운영 검증 대기 목록

다음 시나리오는 후속 운영 WorkInstruction에서만 실행한다: persistence/event store, public API/BFF, DB migration, Web Console/PWA 실제 browser·Network·SSE/WebSocket reconnect, lease/fencing 통합, live provider fallback/drift benchmark, Telegram webhook signature/secret rotation/rate limit, remote device session, WSL/production/deployment. 현재 결과는 모두 `NOT_EXECUTED`다. 이는 승인 범위 밖 운영 검증을 실행하지 않았다는 뜻이며, prototype PASS로 승격하지 않는다.

## 6. successor 종료 Gate

G-SUCCESSOR-01 문서 hash, G-SUCCESSOR-02 package/evidence, G-SUCCESSOR-03 `HUMAN_APPROVED_SEMANTIC_SUCCESSOR_SCOPE` binding, G-SUCCESSOR-04 prototype evidence, G-SUCCESSOR-05 progress/HANDOFF projection, G-SUCCESSOR-06 operational boundary가 기록되었다. 다만 v2.7/v1.6 successor는 C-21의 별도 WorkInstruction·lease·검증 범위가 확정되기 전까지 active implementation baseline으로 승격하지 않는다.
