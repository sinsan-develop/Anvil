# B-06 Independent Test Report

- Package: `B-06`
- Tester: 구현 대화와 분리된 독립 Tester
- Tested commit: `405c2788332996e178eb320a0e30318cc56a8f2a`
- Tested at: `2026-08-15` (Asia/Seoul)
- Verdict: `READY_FOR_MAIN_ACCEPTANCE`
- Blocking finding count: `0`
- Write scope: 이 보고서 1개만 작성

## 1. 판정

### 판정

`READY_FOR_MAIN_ACCEPTANCE`

### 판단 이유

`WI-B-06-20260815-001`의 exact 15-path 산출물과 `AV-STAT-004`, `AV-STAT-005`, `AV-STAT-006`, `AV-STAT-020` 계약을 canonical current checkout과 시스템 기본 설정의 fresh clone에서 독립 재검증했다. 양쪽 모두 events `14/14`, core `58/58`, focused tooling `132/132`, full tooling `323/323`, standalone checker `4/4`를 통과했다. Developer manifest의 exact 15 / raw 14 / self-reference false / target hash와 completion manifest를 raw byte로 재계산해 일치시켰다. 별도 WSL PostgreSQL 18.4에서 migration `0004 → 0005 → 0004`, 정상 append와 optimistic version, 중복·재시작·history replay 멱등성, hostile 제약, 정확한 blocked code 9종, rollback 및 임시 자원 삭제를 실제 확인했다.

### 조치

Main Agent는 이 보고서 SHA-256과 blocker `0`을 확인한 뒤 별도 B-06 acceptance projection을 수행할 수 있다. 본 Tester는 acceptance, B-07, commit, push, deploy를 수행하지 않았다.

## 2. 기준선과 authority

| 항목 | 결과 |
|---|---|
| canonical HEAD / origin/main | `405c2788332996e178eb320a0e30318cc56a8f2a` / 동일 |
| canonical status | 보고서 작성 전 clean |
| fresh default clone | `C:\tmp\anvil-b06-independent-20260815-001`, `core.autocrlf=true`, 동일 SHA, clean |
| WI baseline ancestor | `ebe9ce9c28c3e58f8d8200e5747e33ceb2d8174b`, ancestor exit `0` |
| completion projection base | `105b12be5554d0d2de0c5440cda3d2cb25e98c05` |
| base→tested diff | exact 28 paths, `git diff --check` exit `0` |
| progress | event sequence `267`, `B-06 / TEST_REVIEW`, leases null, Tester pending, `B-07 BLOCKED_PENDING_B06_ACCEPTANCE` |

Authority hash는 WI 등록값과 일치했다.

| 문서 | SHA-256 |
|---|---|
| `Anvil_설계서_v2.md` | `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5` |
| `Anvil_작업계획서_v1.md` | `E6ECCB6AD15F81E97A6D2AA663A0C3621BC7B8BB735666F60E2C424CE8763E0D` |
| `Anvil_통합검증매트릭스_v1.md` | `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5` |
| `Anvil_테스트계획서_v1.md` | `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644` |
| `docs/governance/ANVIL_OPERATING_RULES.md` | `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E` |
| `docs/work_orders/B-06_WORK_INSTRUCTION.md` | `C52B192E88B581B44B47D2A07DC7E293119BE9F60732988393C99795A03DB827` |
| `docs/work_orders/B-06_INVOCATION_PROMPT.md` | `5AEBDFE2167788AB52BC2873194A7253CDD960119BD1D9C4F993ADC09D1B8B58` |

logical projection 시각을 실제 runtime 실행시각 증거로 사용하지 않았다.

## 3. current와 fresh clone 회귀

| 명령 | current | default clone |
|---|---:|---:|
| `python -m pytest tests/events -q` | `14/14 PASS` | `14/14 PASS` |
| `python -m pytest tests/domain tests/design tests/planning tests/persistence tests/events -q --import-mode=importlib` | `58/58 PASS` | `58/58 PASS` |
| B-06 focused tooling 4 modules | `132/132 PASS` (199.209s) | `132/132 PASS` (137.881s) |
| `python -m unittest discover -s tests/tooling -p test_*.py` | `323/323 PASS` (221.020s) | `323/323 PASS` (147.767s) |
| `python scripts/check_a13_repository_scan.py` | PASS, fixtures 8 / zero-delta 8 / hostile 15 | 동일 |
| `python scripts/check_g07_baseline.py` | PASS, packages 108 / AV 255 / uncovered 0 | 동일 |
| `python scripts/check_phase_g_gate.py` | PASS, accepted 7 / decisions 10 / packages 108 / AV 255 / scenarios 20 / sync 7 | 동일 |
| `python scripts/check_project_progress.py` | PASS, sequence 267 / `AUTO_CONTINUE` | 동일 |

추가 verbose events 실행에서 다음 핵심 동작을 개별 test name 기준으로 확인했다.

- event append가 projection reduce보다 먼저 수행됨
- optimistic version conflict fail-closed
- replay가 deterministic하며 missing event sequence(gap)를 거부
- 동일 event/key 재전송이 action을 재적용하지 않음
- store 재시작 후 original receipt를 history replay로 복구
- navigation-only intent가 mutation path에 진입하지 못함
- blocked code vocabulary가 정확히 9개이며 unknown을 거부

최초 current/clone 전체 명령을 동시에 묶은 wrapper는 제한시간을 초과해 결과를 폐기했다. 위 표는 각 suite를 current와 clone에서 분리·순차 재실행한 실제 완료 결과만 기록한다.

## 4. EvidenceManifest 검증

`docs/evidence/manifests/B-06_EVIDENCE_MANIFEST.json`을 양쪽에서 raw byte로 재계산했다.

| 항목 | 기대 | current | clone |
|---|---:|---:|---:|
| exact paths | 15 | 15 | 15 |
| raw artifacts | 14 | 14 | 14 |
| self-reference | false | false | false |
| canonical bytes | 1471 | 1471 | 1471 |
| content bytes | 47828 | 47828 | 47828 |
| target/delivered/content hash | `B97BD64F82B4ACF675735B6D45B7C6AAE8A61965B8D528BC715BBB85574EC8EA` | 일치 | 일치 |
| manifest SHA-256 | `CB14005DAE3D4E89C1BCD1320969477C47BFF2C4172BFC8329B884FF52548F07` | 일치 | 일치 |
| errors | 0 | 0 | 0 |

Completion manifest도 양쪽에서 raw 4, self-reference false, canonical 509 bytes, content 16090 bytes였고 target을 `sha256:D4804A20772D5396C048B1F8CACC7218FDC273F74B3CAF56478D68FFE6B6B008`로 동일하게 재계산했다. Completion manifest 자체 SHA-256은 `898A687EC52D9BFA143629282A27284465F1F9ADBFD50292E3BBE28DB49BF207`이었다.

## 5. WSL PostgreSQL 18 독립 검증

- Container: `anvil-b06-tester-pg18-405c278`
- Network: `anvil-b06-tester-net-405c278`
- Image: `postgres:18-alpine`
- PostgreSQL: `18.4`
- Initial bind: `127.0.0.1:32770 → 5432`
- Database: `anvil_b06_test`

### Migration

1. `alembic upgrade 0004_execution_release`: current `0004`, `run_events=ABSENT`, B-06 function `0`.
2. `alembic upgrade 0005_event_store`: current `0005 (head)`, `run_events=1`, B-06 function `2`.
3. guard 검증 후 `alembic downgrade 0004_execution_release`: current `0004`, `run_events=ABSENT`, B-06 function `0`.

### Valid·hostile guard

| 계약 | 실제 결과 |
|---|---|
| 최초 compare-and-append | `event-1 / sequence 1 / applied_version 2 / duplicate false`; run version `2` |
| 동일 canonical request 재전송 | original receipt, `duplicate true`; event count `1`, version `2` 불변 |
| stale expected version | SQLSTATE `40001`로 거부 |
| 존재하지 않는 run | `run does not exist`로 거부 |
| 동일 identifier + 다른 request hash | canonical request conflict로 거부 |
| event UPDATE / DELETE | 양쪽 모두 `run_events are append-only`로 거부 |
| 정확한 blocked code 9종 | distinct `9`, rows `9`, 모두 receipt sequence `1` / applied `2` |
| unknown blocked code | check constraint로 거부 |
| 동일 run sequence | unique constraint로 거부 |
| 동일 run idempotency key | unique constraint로 거부 |
| 두 번째 정상 append | `event-2 / sequence 2 / applied_version 3 / duplicate false`; run version `3` |
| restart 후 history | `event-1:1:2,event-2:2:3`, run version `3` 유지 |
| restart 후 event-1 재전송 | original `event-1 / 1 / 2 / duplicate true`; count `2`, version `3` 불변 |

DB 함수가 sequence를 내부에서 `max(sequence_no)+1`로 만들고 optimistic version을 같은 transaction에서 갱신함을 실제 확인했다. application-level gap rejection, append-before-projection, navigation-only 무변경은 별도의 14/14 verbose events suite로 확인했다. DB direct insert는 공개 event append 계약으로 취급하지 않았으며, 직접 UPDATE/DELETE는 trigger가 차단했다.

컨테이너 재시작 직후 readiness 대기 없이 기존 임시 host port로 접속한 첫 rollback 명령은 연결 실패했다. 재시작으로 random bind가 `32770 → 32771`로 재할당된 것을 확인하고 readiness 후 새 포트에서 동일 rollback을 재실행해 통과했다. 이 환경 연결 실패는 제품 판정 증거에서 제외했다.

### Cleanup

정확한 임시 container/network만 삭제했고 exact-name filtered listing이 모두 빈 출력임을 확인했다. 기존 WSL DB/role/schema/data, ysna-server, `shared-db`는 접근·변경하지 않았다.

## 6. 미실행 경계와 잔여 위험

다음은 B-06 범위 밖이므로 `NOT_EXECUTED`다.

- 실제 API/auth/SSE/same-origin BFF와 HTTP `409` 매핑
- 실제 UI/browser/Network/navigation click
- Provider/외부 API
- ysna-server와 `shared-db`
- production/public exposure/deployment
- B-06 acceptance와 B-07 시작

현재 repository는 framework-neutral Protocol이며 concrete PostgreSQL repository adapter와 HTTP/UI integration은 후속 Package 검증 대상이다. 테스트 PASS는 위에서 실제 실행한 범위만 증명한다.

## 7. 최종 결과

- Verdict: `READY_FOR_MAIN_ACCEPTANCE`
- Blocking finding count: `0`
- 제품·progress·HANDOFF·checker 수정: `0`
- commit/push/acceptance/B-07/deploy: `NOT_EXECUTED`
