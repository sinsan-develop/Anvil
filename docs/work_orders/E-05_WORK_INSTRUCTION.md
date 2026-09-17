# E-05 WorkInstruction — 제한 병렬 read/analyze Delegation

## 권위·기준선

- WI-E-05-R1-20260917-001, developer-primary-e05-r1. Main 승인 내부 구현 exact6.
- HEAD 07fb68164de2ecf3b06342013d23e4d34d4dd0cb, branch codex/c09-execution-backends-r1, seq1100/E04 ACCEPTED. clean/local/upstream 재확인; private remote exact는 MAIN_LIVE_REMOTE_READ 전달 증거.
- 계획 E-05, 설계 §47.18-5 및 제한 병렬 원칙, AV-AGT-032, AV-FLOW-005. 기존 문서·approval/history 불변.

## 제품 exact6 / control exact9

- packages/agent_team/__init__.py
- packages/agent_team/concurrency.py
- packages/queue/service.py
- tests/agent_team/test_concurrency_e05.py
- tests/queue/test_concurrency_claim_e05.py
- docs/04_test_reports/E-05_COMPLETION_REPORT.md

control: 본 WI, E-05_INVOCATION_PROMPT.md, scripts/check_project_progress.py, tests/tooling/test_project_progress.py, docs/progress/build-progress.json, docs/progress/progress-events.json, docs/progress/BUILD_HANDOFF.md, docs/progress/progress-handoff-detached-digest-e05-start.json, docs/evidence/manifests/E-05_START_MANIFEST.json. 합집합 exact15 이외 수정 금지.

## 구현 계약

1. E04 DagQueueService/DurableQueue, DelegationPacket/validate_packet, LeaseService, BudgetService를 재사용한다. queue에는 원자적 selected batch claim seam만 additive 추가하고 기존 single claim 동작은 유지한다.
2. host가 등록한 같은 immutable baseline의 packet/context/parent permission+egress와 exact graph node input hash를 batch 전량 검증한다. read/analyze만 위임; write capability가 있거나 mutable/shared context, dependency/conflict 독립성 부족은 SINGLE_WORKER로 축소하며 write 실행 권한은 부여하지 않는다. unknown dependency는 graph 등록 전 거부한다.
3. bounded fanout/context 및 동시성 한도; 기존 BudgetService의 실제 current reservation receipt를 exact run/step/request/forecast에 결박하여 소비·검증만 한다. E08 원자 reservation/Provider 송신 정책을 만들지 않는다.
4. 전체 packet/lease/fence/budget 검증 후 선택 batch를 원자 claim한다. 중간 실패는 queue partial claim/publication 0. 외부 호출·program 실행 0. cancellation은 새 dispatch/late result 차단, stale queue/worker fence·foreign authority는 fail-closed.
5. 결과는 step별 provenance/hash/evidence/status로 수집하고 미도착·실패·차단을 유지한 bounded Main synthesis input만 만든다. raw transcript를 집계하지 않는다. automatic acceptance/approval/merge/Run success 0. E07 실패 정책 결정은 하지 않는다.
6. deterministic ordering/hash, exact replay 동일 receipt, conflicting replay 거부, detached immutable input/result snapshot, concurrent claim race를 적대 테스트한다.
7. 실제 Provider 병렬 호출/UI/HTTP/DB integration/E06 write/E07 failure policy/E08 reservations는 NOT_EXECUTED 또는 NOT_INTEGRATED로 구분한다. Developer 결과는 독립 acceptance가 아니다. commit/push/acceptance/E06 금지.

## dual lease

- worker worker-lease-e05-r1-20260917-001 / execution e05-r1-execution-fence-epoch-1-07fb68164de2ecf3
- write write-lease-e05-r1-20260917-001 / write e05-r1-write-fence-epoch-1-b06342013d23e4d3
- issued 2026-09-17T13:29:00+09:00 / expires 2026-09-18T01:29:00+09:00.

## 순차 TDD·완료 증거

start control RED→GREEN, append seq1101 WI /1102 worker /1103 write /1104 PACKAGE_STARTED. canonical checker PASS 뒤 제품 RED→GREEN. focused 신규2, queue/leases/budget/agent_team/orchestration 회귀, compileall, diff-check. checker는 hash anchored additive one-shot temp→AST/compile→allowed-diff→replace만 사용하고 삭제0을 확인한다.

보고서는 판정→판단 이유→조치, 기준 hash/branch/status, 변경과 정확한 명령/exit/실제 수치, 미검증, 오류 fingerprint/count, rollback을 기록한다. rollback은 Main이 승인한 scope patch 역적용; 기존 E04/history 보존. 진행 중 환경 오류는 정식 제품 실패로 세지 않는다.
