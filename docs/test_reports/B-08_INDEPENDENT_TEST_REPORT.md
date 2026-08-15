# B-08 Independent Test Report

- Package: `B-08`
- Tester: 구현 대화와 분리된 독립 Tester
- Tested commit: `7cea707b2ce765a306544873cfe31703a3d8201d`
- Tested at: `2026-08-16` (Asia/Seoul)
- Verdict: `READY_FOR_MAIN_ACCEPTANCE`
- Blocking finding count: `0`
- Write scope: 이 보고서 1개만 작성

## 1. 판정

### 판정

`READY_FOR_MAIN_ACCEPTANCE`

### 판단 이유

`WI-B-08-20260815-001`의 exact 15-path 산출물과 `AV-STAT-009`, `AV-STAT-011`, `AV-STAT-012`, `AV-STAT-013`을 canonical current checkout과 GitHub 기본 `main` fresh clone에서 독립 재검증했다. 양쪽 모두 outbox/progress focused `10/10`, combined core `93/93`, full tooling `342/342`, B-08 completion standalone `4/4`를 통과했다. Developer manifest의 exact 15 / raw 14 / self-reference false / target hash와 completion manifest의 raw 4 / target hash를 raw byte로 재계산해 양쪽에서 일치시켰다.

별도 WSL Docker PostgreSQL 18 격리 환경에서 Alembic `0006_checkpoint_artifacts → 0007_progress_outbox → 0006_checkpoint_artifacts`, PROJECT/RUN 정상 outbox→snapshot→ACK, 적대적 DB 제약 13건, Event+outbox transaction rollback, downgrade 객체 제거와 정확한 임시 자원 정리를 실제 확인했다. `shared-db`, ysna-server, production에는 접근하지 않았다.

### 조치

Main Agent는 이 보고서 SHA-256과 blocker `0`을 확인한 뒤 별도 B-08 acceptance projection을 수행할 수 있다. 본 Tester는 acceptance, B-09 시작, progress/HANDOFF 수정, commit, push, deploy를 수행하지 않았다.

## 2. 기준선과 authority

| 항목 | 결과 |
|---|---|
| canonical HEAD / origin/main | `7cea707b2ce765a306544873cfe31703a3d8201d` / 동일 |
| canonical status | 보고서 작성 전 clean |
| linked worktree | `.git/worktrees/ysna-internal-deploy`, branch `main` |
| fresh default clone | `C:\tmp\anvil-b08-independent-clone-20260816`, 동일 SHA, 검증 후 삭제 |
| progress | event sequence `281`, `B-08 / TEST_REVIEW / PENDING_DATABASE_VERIFICATION`, leases null, `B-09 BLOCKED_PENDING_B08_ACCEPTANCE` |
| B-08 diff | start projection base `dfc92411bd7b4127623863c71aa7c30f3ccaf8be` 이후 exact 28 paths, `git diff --check` exit `0` |

Authority와 WorkInstruction hash는 등록값과 일치했다.

| 문서 | SHA-256 |
|---|---|
| `Anvil_설계서_v2.md` | `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5` |
| `Anvil_작업계획서_v1.md` | `E6ECCB6AD15F81E97A6D2AA663A0C3621BC7B8BB735666F60E2C424CE8763E0D` |
| `Anvil_통합검증매트릭스_v1.md` | `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5` |
| `Anvil_테스트계획서_v1.md` | `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644` |
| `docs/governance/ANVIL_OPERATING_RULES.md` | `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E` |
| `docs/work_orders/B-08_WORK_INSTRUCTION.md` | `655E40B3FE2C5834F3D7E143348DC99B411A2992A3381B3C45D6B36FB2AE2406` |
| `docs/work_orders/B-08_INVOCATION_PROMPT.md` | `4E7A0CF3AE60C154A8837E271526224310E4CC5B79E0D92450F8563E9BE0F0B3` |

## 3. current와 fresh clone 회귀

| 명령 | current | fresh clone |
|---|---:|---:|
| `python -m pytest tests/outbox tests/progress -q` | `10/10 PASS` | `10/10 PASS` |
| combined domain/design/planning/persistence/execution/events/artifacts/checkpoints/outbox/progress | `93/93 PASS` | `93/93 PASS` |
| `python -m pytest tests/tooling -q` | `342/342 PASS` (253.52s) | `342/342 PASS` (142.12s) |
| B-08 completion standalone 4 tests | `4/4 PASS` | `4/4 PASS` |

최초 standalone 명령은 unittest class 이름을 잘못 지정해 test collection `0`으로 종료됐다. 실제 class 이름을 source에서 확인한 뒤 정확한 4개 node ID로 재실행해 양쪽에서 `4/4 PASS`를 얻었다. 이 호출 오류를 제품 PASS나 제품 실패로 집계하지 않았다.

## 4. EvidenceManifest 독립 재계산

Developer manifest를 current와 fresh clone에서 raw byte로 재계산했다.

| 항목 | 기대 | current | clone |
|---|---:|---:|---:|
| exact paths | 15 | 15 | 15 |
| raw artifacts | 14 | 14 | 14 |
| raw checksum errors | 0 | 0 | 0 |
| self-reference / raw self-reference | false / false | false / false | false / false |
| target hash | `45B736CE7845E9E5E757DF45916B025479D7CD51EAC281A4CEBD8306BAAF695B` | 일치 | 일치 |

Completion manifest도 양쪽에서 raw 4와 target `FA84EE2E577D4A38256A2F2459ABC326CA39E8C23D630F3B54208E1D600C6076`을 동일하게 재계산했다.

## 5. WSL PostgreSQL 18 독립 검증

- Container: `anvil-b08-it-20260816`
- Network: `anvil-b08-it-net-20260816`
- Image: `postgres:18-alpine`
- Bind: `127.0.0.1:32775 → 5432`
- Database/User: B-08 검증 전용 일회성 자원

### Migration

1. `alembic upgrade 0006_checkpoint_artifacts`: current `0006_checkpoint_artifacts`.
2. `alembic upgrade 0007_progress_outbox`: current `0007_progress_outbox (head)`.
3. 정상·적대적·transaction 검증 수행.
4. `alembic downgrade 0006_checkpoint_artifacts`: current `0006_checkpoint_artifacts`.
5. `progress_export_outbox`, `progress_snapshots`와 B-08 함수 4개의 `to_reg*` 결과가 모두 `NULL`임을 확인했다.

### 정상 흐름

PROJECT와 RUN 각각에 대해 outbox 1개, 동일 owner/sequence/hash/export URI의 snapshot 1개를 기록한 뒤 ACK했다. 두 outbox 모두 `ACKNOWLEDGED`, `acknowledged_at IS NOT NULL=true`, 두 snapshot의 owner/sequence 일치를 확인했다.

### 적대적 제약

| 계약 | 실제 결과 |
|---|---|
| 동일 owner/sequence 중복 | unique constraint로 거부 |
| 동일 owner/idempotency key 중복 | unique constraint로 거부 |
| owner type/id/project/run 혼합 | check/FK/owner trigger로 거부 |
| 존재하지 않는 PROJECT/RUN owner | owner trigger/FK로 거부 |
| 잘못된 hash 형식 | check constraint로 거부 |
| snapshot의 payload/outbox binding 불일치 | binding trigger로 거부 |
| snapshot UPDATE | append-only trigger로 거부 |
| outbox DELETE | append-only trigger로 거부 |
| outbox 고정 binding UPDATE | immutability trigger로 거부 |
| ACK 상태와 acknowledged_at 불일치 | check constraint로 거부 |
| retry_count 감소 | monotonic guard로 거부 |
| ACK된 outbox 추가 변경 | immutability trigger로 거부 |

hostile 13개 실행 뒤 정상 ACK 2개는 그대로 유지됐고, retry 대상은 `PERSISTENCE_ERROR / retry_count=2`를 유지했다.

### Transaction rollback

한 transaction에서 `run_events` Event를 insert한 뒤 중복 owner/sequence outbox 실패를 주입했다. command는 예상대로 non-zero였고 후속 조회에서 Event와 outbox가 각각 `0/0`이어서 부분 commit이 없음을 확인했다.

첫 적대적 묶음은 WSL 셸이 PostgreSQL dollar delimiter `$$`를 PID로 치환해 SQL syntax error로 종료됐다. 오류가 첫 statement parse 단계에서 발생해 DB mutation은 없었다. delimiter 의존을 제거한 개별 `psql -v ON_ERROR_STOP=1` 실행으로 모든 적대적 항목을 다시 검증했으며, 이 환경 호출 오류는 제품 결함으로 집계하지 않았다.

### Cleanup

정확한 임시 container와 network만 삭제했다. exact-name filtered listing 결과는 `CONTAINER_MATCH_COUNT=0`, `NETWORK_MATCH_COUNT=0`이었다. 기존 WSL DB/role/schema/data, ysna-server, `shared-db`, production은 접근·변경하지 않았다.

## 6. 검증 ID 판정

| ID | 판정 | 근거 |
|---|---|---|
| `AV-STAT-009` | PASS | 동일 Event sequence의 owner/outbox/progress 계약, transaction rollback, current/clone 회귀 |
| `AV-STAT-011` | PASS | sequence 중복·후퇴·gap service 계약과 progress projection/tooling 검증 |
| `AV-STAT-012` | PASS | atomic paired replace, snapshot/ACK 전 scheduling 차단, FI 회귀 3회씩 |
| `AV-STAT-013` | PASS | FI-01/FI-02/FI-03 각 3회 회귀와 실제 PG18 transaction/migration 검증 |

FI의 filesystem crash point는 독립 실행한 focused suite에서 각 3회씩 총 9개 subcase로 재실행됐다. 실제 PostgreSQL에서는 transaction·constraint·migration 경계를 추가 확인했다.

## 7. 미실행 경계와 잔여 위험

다음은 B-08 범위 밖이므로 `NOT_EXECUTED`다.

- 실제 API/auth/SSE/same-origin BFF
- 실제 UI/browser/Network
- durable queue·Worker/write lease scheduler와 process/PC recovery orchestration
- Provider/외부 API
- ysna-server와 `shared-db`
- production/public exposure/deployment
- B-08 acceptance와 B-09 시작

현재 predecessor schema에는 canonical `projects` table이 없어 PROJECT owner를 기존 `tasks.project_id`로 검증한다. 이는 WorkInstruction에 명시된 기존 schema 경계이며, 후속 Project aggregate 소유 Package에서 별도 정합화해야 한다. 이번 B-08 acceptance를 차단하는 결함은 아니다.

## 8. 최종 결과

- Verdict: `READY_FOR_MAIN_ACCEPTANCE`
- Blocking finding count: `0`
- 제품·progress·HANDOFF·checker 수정: `0`
- 작성 파일: `docs/test_reports/B-08_INDEPENDENT_TEST_REPORT.md` 1개
- commit/push/acceptance/B-09/deploy: `NOT_EXECUTED`
