# Anvil 통합검증매트릭스 v2 successor

> 상태: `HUMAN_APPROVED_SEMANTIC_SUCCESSOR_SCOPE`
> 목적: Agent Teams·Capability MoA·원격 제어·Telegram 보조 채널의 successor 검증 기준을 historical v1.4와 분리해 정의한다.
> historical 기준선: `Anvil_통합검증매트릭스_v1.md` (v1.4, 108 packages, 255 AV IDs) — 변경하지 않음
> 상위 설계: `Anvil_설계서_v2.md` v2.7 successor draft
> 상위 계획: `Anvil_작업계획서_v1.md` v1.6 successor draft

## 1. 승격 경계

이 문서는 v1.4를 대체하지 않는다. C-16~C-20의 framework-free scoped prototype 증거를 successor 검증 대상으로 등록할 뿐이며, active implementation baseline·Phase B Gate·C-01을 자동으로 변경하지 않는다. 신산님의 `HUMAN_APPROVED_SEMANTIC_SUCCESSOR_SCOPE` binding은 문서·evidence 정합성과 C-21 준비 범위에만 적용된다.

## 2. successor package 역색인

| Package No. | Package | 범위 | 검증 ID | 증거 | prototype 판정 | 운영 판정 |
|---:|---|---|---|---|---|---|
| 109 | C-16 | Team primitive/state/mailbox/conversation | AV-TEAM-016~019 | `task-2-report.md`, `083416e` | 12 focused tests PASS | `NOT_EXECUTED` |
| 110 | C-17 | orchestration/authority/dependency/replay | AV-TEAM-020~024 | `task-3-report.md`, `1de3675` | 4 focused tests PASS | `NOT_EXECUTED` |
| 111 | C-18 | capability routing/fallback/provenance/benchmark | AV-MOA-018~022 | `task-4-report.md`, `a833c6b` | 4 focused tests PASS | `NOT_EXECUTED` |
| 112 | C-19 | remote cursor/command/fencing/offline/audit | AV-REMOTE-019~024 | `task-5-report.md`, `4d4e6bd` | 5 focused tests PASS | `NOT_EXECUTED` |
| 113 | C-20 | Telegram signature/allowlist/replay/deep-link/high-risk deny | AV-TG-020~026 | `task-6-report.md`, `b2503f0` | 7 focused tests PASS | `NOT_EXECUTED` |

누적 prototype evidence: `33 passed`, compileall PASS, `git diff --check` PASS, scoped whole-branch review PASS. 위 수치는 persistence/API/UI/browser/provider/Telegram production PASS가 아니다.

## 3. 검증 항목

| ID | 검증 내용 | 레벨 | 필수 증거 | 심각도 |
|---|---|---|---|---|
| AV-TEAM-016 | session/task/message/turn typed contract와 immutable state | L1/L2 | E-TEST, E-DIFF | MAJOR |
| AV-TEAM-017 | mailbox delivery/ack timestamp, idempotency, stale/replay 경계 | L1/L5 | E-TEST | CRITICAL |
| AV-TEAM-018 | decision/revision의 방향·재진입·승인 경계 | L1/L5 | E-TEST | CRITICAL |
| AV-TEAM-019 | conversation turn이 승인 없는 적용·방향 결정을 수행하지 않음 | L1/L5 | E-TEST, E-DEC | CRITICAL |
| AV-TEAM-020 | Leader 권한, task dependency, baseline/revision 일치 | L1/L5 | E-TEST, E-AUD | CRITICAL |
| AV-TEAM-021 | claim/review/complete/block/resume/idle 전이 | L1/L2 | E-TEST, E-EVT | MAJOR |
| AV-TEAM-022 | mailbox replay/stale rejection 및 write-scope 충돌 | L1/L5 | E-TEST | CRITICAL |
| AV-TEAM-023 | budget/lease/fencing 경계가 초과 실행을 차단 | L1/L5 | E-TEST | CRITICAL |
| AV-TEAM-024 | orchestration evidence가 실행 결과와 분리됨 | L2 | E-DIFF, E-CMD | MAJOR |
| AV-MOA-018 | capability profile/catalog revision 계약 | L1/L2 | E-TEST | MAJOR |
| AV-MOA-019 | capability·quality/cost/latency 기반 deterministic route | L1 | E-TEST, E-ART | MAJOR |
| AV-MOA-020 | fallback 순서·allowlist·health·budget 검증 | L1/L5 | E-TEST | CRITICAL |
| AV-MOA-021 | routing provenance와 catalog revision 기록 | L1/L2 | E-TEST, E-AUD | MAJOR |
| AV-MOA-022 | benchmark는 측정 기록이며 live provider 호출이 아님 | L1/L5 | E-DIFF, E-TEST | MAJOR |
| AV-REMOTE-019 | cursor/sequence/replay 및 stale event 경계 | L1/L5 | E-TEST, E-EVT | CRITICAL |
| AV-REMOTE-020 | operator 인증·session/command expiry·dedupe | L1/L5 | E-TEST, E-AUD | CRITICAL |
| AV-REMOTE-021 | pause/resume/status만 저위험 명령으로 실행 | L1/L5 | E-TEST | CRITICAL |
| AV-REMOTE-022 | merge/deploy/delete/권한/provider credential은 approval 대기 | L1/L5 | E-TEST, E-DEC | CRITICAL |
| AV-REMOTE-023 | offline queue의 순서·duplicate·stale·future 차단 | L1/L6 | E-TEST | MAJOR |
| AV-REMOTE-024 | fencing/audit/event와 운영 API의 분리 경계 | L2 | E-DIFF, E-AUD | MAJOR |
| AV-TG-020 | allowlist, HMAC signature, expiry, replay 방지 | L1/L5 | E-TEST | CRITICAL |
| AV-TG-021 | parameter tampering·malformed·unauthorized 처리 | L1/L5 | E-TEST, E-AUD | CRITICAL |
| AV-TG-022 | low-risk command만 envelope로 수락 | L1/L5 | E-TEST | CRITICAL |
| AV-TG-023 | high-risk 명령은 non-executing ApprovalRequest로 전환 | L1/L5 | E-TEST, E-DEC | CRITICAL |
| AV-TG-024 | deep-link origin과 secret redaction | L1/L5 | E-TEST | CRITICAL |
| AV-TG-025 | rate-limit/secret rotation/webhook transport 계약의 미구현 경계 | L2/L5 | E-DIFF, E-TEST | MAJOR |
| AV-TG-026 | Telegram은 Web Console 공식 채널을 대체하지 않는 보조 adapter | L2/L7 | E-DEC | MAJOR |

## 4. successor gates

| Gate | 종료 기준 | 현재 판정 |
|---|---|---|
| G-SUCCESSOR-01 | successor 문서와 상호참조 hash 정합성, historical hash 보존 | `ALIGNED` |
| G-SUCCESSOR-02 | C-16~C-20 package/evidence/검증 ID 1회 역색인 | `ALIGNED` |
| G-SUCCESSOR-03 | 승인 binding이 subject hash에 결박되고 기존 scope 불변 | `HUMAN_APPROVED_SEMANTIC_SUCCESSOR_SCOPE` |
| G-SUCCESSOR-04 | 33 focused tests·compileall·diff-check·scoped review evidence | `PASS_PROTOTYPE_ONLY` |
| G-SUCCESSOR-05 | progress/HANDOFF/event와 successor hash 정합, lease null | `ALIGNED` |
| G-SUCCESSOR-06 | operational NOT_EXECUTED 경계가 PASS로 승격되지 않음 | `NOT_EXECUTED_BOUNDARY_PRESERVED` |

## 5. 운영 미실행 경계

다음은 이 successor prototype의 증거에 포함되지 않는다: durable persistence/event store, public API/BFF, DB, 실제 Web Console/PWA browser 및 same-origin Network, SSE/WebSocket reconnect, live provider/fallback/drift benchmark, Telegram webhook/signature secret rotation/rate limit deployment, 원격 모바일·PC 세션, WSL PostgreSQL/shared DB, ysna-server/production/deployment. 이 항목들은 후속 WorkInstruction과 별도 인수 증거가 필요하다.

## 6. 판정 및 다음 행동

현재 판정은 `BOUND / PROTOTYPE_ONLY`다. 승인 binding은 C-16~C-20 successor 문서·evidence 정합성과 C-21 WorkInstruction 준비만 허용한다. C-01을 시작하지 않고 historical Phase B Gate 상태도 변경하지 않는다.
