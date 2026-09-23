# E-04 WorkInstruction — Task DAG / durable queue

## 권위·기준선

- WI-E-04-R1-20260917-001, developer-primary-e04-r1. Main 승인 exact12 내부 구현.
- baseline ac9e6f9686c8dfe01c694c1242b251eaa51c4c0f / codex/c09-execution-backends-r1 / seq1091, E-02 및 E-03 ACCEPTED.
- local/upstream/remote exact 및 clean은 Main 확인(MAIN_LIVE_REMOTE_READ); worker는 local/upstream/clean을 재확인한다.
- 계획 E-04; 설계 §47.5, §49.5; AV-AGT-033, AV-AGT-037. E-05 실행 병렬화 및 U-04/U-08 UI는 범위 밖.

## 제품 exact12

- packages/agent_team/__init__.py
- packages/queue/models.py
- packages/queue/service.py
- packages/queue/dag.py
- packages/persistence/dag_queue_repository.py
- packages/api/task_graph.py
- migrations/versions/0014_dag_queue.py
- tests/queue/test_dag_e04.py
- tests/persistence/test_dag_queue_e04.py
- tests/api/test_task_graph_e04.py
- tests/queue/test_durable_queue.py
- docs/04_test_reports/E-04_COMPLETION_REPORT.md

control exact9: 본 WI, E-04_INVOCATION_PROMPT.md, scripts/check_project_progress.py, tests/tooling/test_project_progress.py, docs/progress/build-progress.json, docs/progress/progress-events.json, docs/progress/BUILD_HANDOFF.md, docs/progress/progress-handoff-detached-digest-e04-start.json, docs/evidence/manifests/E-04_START_MANIFEST.json. 합집합 최대 exact21.

## 계약 및 경계

1. 기존 DependencyGraph와 B09 queue/lease model·table·function owner를 재사용한다. 별도 queue owner/schema를 만들지 않는다. 기존 migration 불변, 0014 additive upgrade/downgrade 및 기존 row/default 호환.
2. cycle/self-cycle/unknown dependency를 등록 전 거부한다. 모든 dependency 성공과 입력 hash 일치 전 claim 금지. 독립성이 없으면 SINGLE_WORKER로 축소하고 충돌 그룹은 순차 claim.
3. at-least-once, PostgreSQL DB clock/transaction atomic claim, visibility timeout/new fence, stale completion 거부, 동일 completion 멱등성, poison quarantine을 구현한다. 예약은 실제 worker 실행/파일 write 권한을 부여하지 않는다.
4. read-only graph API는 상태·dependency·conflict·mode·hash만 반환하고 queue payload/token/secret은 노출하지 않는다. 실제 HTTP wiring/UI/Provider 실행 금지.
5. E03 Minor1: external verifier 신규 3 symbol __all__ 추가. Minor2: frozen seq1084 함수·raw history 불변, additive successor status projection에서 e03_status/e04_status 분리. E03 acceptance를 재개하지 않는다.
6. 실제 DB 검증은 기존 격리 DB harness가 사용 가능할 때만 수행. 공유 WSL 개발 DB migration apply 금지. DSN 미제공/접속 불가면 NOT_EXECUTED 및 수락 미충족 경계를 기록하며 mock/in-memory를 실제 DB PASS로 승격하지 않는다.
7. E04 완료 증거는 Developer evidence이며 acceptance 자동 전이 0. commit/push/E05 금지.

## dual lease

- worker worker-lease-e04-r1-20260917-001 / execution e04-r1-execution-fence-epoch-1-ac9e6f9686c8dfe0
- write write-lease-e04-r1-20260917-001 / write e04-r1-write-fence-epoch-1-1c694c1242b251ea
- issued 2026-09-17T11:55:00+09:00, expires 2026-09-17T23:55:00+09:00. 제품 mutation 전에 실제 발효/두 fence 및 start checker PASS 확인.

## 순차 TDD 계획

1. start-control RED: seq1091 raw prefix 불변, exact9 및 product exact12, lease/fence, successor 상태, Minor2 correction. 최소 checker GREEN 후 materialize.
2. 제품 RED: cycle/unknown/self-cycle, hash drift, dependency/단일 worker/conflict, timeout/redelivery/멱등/poison/concurrency, API scope/비노출, 기존 row migration 호환.
3. 최소 queue/DAG/DB adapter/migration/API 구현 GREEN, 기존 B09/B10 및 agent_team/orchestration/persistence 회귀.
4. 격리 PostgreSQL 테스트는 실제 실행 여부 분리. compileall, diff-check, exact dirty 경로 확인.
5. 보고서는 판정→이유→조치; 정확한 명령/exit/수치, 미검증, rollback, 통제 sequence/lease 상태. 정식 실패와 환경 skip 구분.
