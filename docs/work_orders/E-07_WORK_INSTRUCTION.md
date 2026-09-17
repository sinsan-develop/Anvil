# E-07 WorkInstruction — 실패 정책과 exception inbox

## 권위와 목표

- `WI-E-07-R1-20260917-001`, `developer-primary-e07-r1`. Main 승인 product exact4/control exact9, E-06 `ACCEPTED`/seq1124의 successor.
- 기준 HEAD `8d65c871c119d6f3b195f00e53e7e18bd2dba991`, branch `codex/c09-execution-backends-r1`; private development upstream과 clean 일치 상태에서 시작한다.
- 설계 §7.5, §47.4, §47.7, §47.18-7~8, 계획 E-07, `AV-SAFE-020`, `AV-AGT-035~036`, `AV-FLOW-007~008`을 구현한다. 설계 SHA `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`, 계획 SHA `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`.

## exact write scope

제품4:

- `packages/orchestration/__init__.py`
- `packages/orchestration/exception_resolver.py`
- `tests/orchestration/test_exception_resolver_e07.py`
- `docs/04_test_reports/E-07_COMPLETION_REPORT.md`

control9: 본 WI, `docs/work_orders/E-07_INVOCATION_PROMPT.md`, `scripts/check_project_progress.py`, `tests/tooling/test_project_progress.py`, `docs/progress/build-progress.json`, `docs/progress/progress-events.json`, `docs/progress/BUILD_HANDOFF.md`, `docs/progress/progress-handoff-detached-digest-e07-start.json`, `docs/evidence/manifests/E-07_START_MANIFEST.json`.

## 구현 계약과 순서

1. start control RED→GREEN: seq1125 WI, 1126 worker lease, 1127 write lease, 1128 `PACKAGE_STARTED`. E-07 `IN_PROGRESS`, E-08 `NOT_READY`, pending approval 0. seq1~1124 raw event prefix를 보존한다.
2. 기존 E-04 `TaskGraph`/`DagNode`를 immutable snapshot으로 받아 graph·run identity, dependency, required step 집합을 fail-closed 검증한다. E-04 queue claim, E-05 scheduler, E-06 write/lease 구현은 수정하지 않는다.
3. `STOP`, `CONTINUE_INDEPENDENT`, `COLLECT_AND_REVIEW`를 명시적 enum/정책으로 구현한다. 정책 revision을 조용히 바꾸거나 알 수 없는 정책을 fallback하지 않는다.
4. append-only exception inbox는 immutable record와 canonical fingerprint를 저장한다. 동일 exception ID의 exact replay는 idempotent하고 payload가 다른 replay, 존재하지 않는 Step, 과거 상태를 덮는 전이는 거부한다. projection은 bounded/detached여야 한다.
5. 일반 실패에서 실패 Step은 `FAILED`, transitive descendant만 `BLOCKED_DEPENDENCY`가 된다. `CONTINUE_INDEPENDENT`와 `COLLECT_AND_REVIEW`에서는 unrelated ready Step이 계속 가능해야 하며, 완료되지 않은 dependency를 성공으로 간주하지 않는다.
6. `STOP`은 첫 유효 실패에서 아직 terminal이 아닌 Step을 `BLOCKED_RUN_STOP`으로 만들고 Run을 성공이 아닌 상태로 종결한다. `COLLECT_AND_REVIEW`는 안전한 독립 Step이 끝나기 전 `ACTIVE`, 수집 종료 후 `AWAITING_EXCEPTION_REVIEW`; `CONTINUE_INDEPENDENT`는 종료 시 `FINISHED_WITH_FAILURES`다. required 실패·차단·미검증이 하나라도 있으면 `SUCCEEDED` 금지다.
7. `SECRET_ACCESS`, `PROTECTED_PATH_WRITE`, `DESIGN_CHANGE`, `DATA_CORRUPTION_RISK`, `BUDGET_HARD_LIMIT`은 모든 failure policy보다 우선하는 hard-stop이다. 전체 Run을 `BLOCKED`로 두고 남은 Step을 `BLOCKED_RUN_STOP`, inbox에 audit reason을 남긴다. caller가 severe flag를 낮추거나 독립 실패로 위조해도 분류 코드는 우선한다.
8. 실제 RED→GREEN은 dependency chain + unrelated branch, transitive block, STOP, collect review, hard-stop override, exact replay/conflicting replay, required/optional 종료 상태, unknown/tampered graph, concurrent duplicate delivery를 포함한다. Event/projection 증거에서 “일부 완료”와 “전체 성공”을 분리한다.
9. E-08 budget reservation/quota accounting, E-09 Gate, E-10 Git adapter, API/UI, DB persistence, Provider/HTTP/WSL/deploy/production은 구현하지 않는다. 본 E-07은 in-memory/domain contract evidence이며 durable DB inbox adapter는 `NOT_INTEGRATED`로 보고한다.

## dual lease

- worker `worker-lease-e07-r1-20260917-001`, execution `e07-r1-execution-fence-epoch-1-8d65c871c119d6f3`
- write `write-lease-e07-r1-20260917-001`, write fence `e07-r1-write-fence-epoch-1-b195f00e53e7e18b`
- issued `2026-09-17T21:00:00+09:00`, expires `2026-09-18T09:00:00+09:00`. 발효 전 제품 mutation 금지.

## 검증·인계

각 behavior의 의도된 RED 후 최소 GREEN. focused `tests/orchestration/test_exception_resolver_e07.py`, 관련 `tests/orchestration tests/queue tests/agent_team/test_concurrency_e05.py`, exact module/test 구문, `git diff --check`, canonical checker를 실행한다. completion report는 판정→판단 이유→조치 순서로 exact command/exit/count/skip/미검증/formal failure count/rollback을 기록한다. acceptance, lease revoke, commit/push, E-08 시작, 추가 agent 생성, 실제 외부 runtime은 Developer가 수행하지 않는다.
