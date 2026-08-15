# B-07 Independent Test Report

- Package: `B-07`
- Tester: 구현 대화와 분리된 독립 Tester
- Tested commit: `178010df97a10a7a0c106b5aab61feac7822a492`
- Tested at: `2026-08-15` (Asia/Seoul)
- Verdict: `READY_FOR_MAIN_ACCEPTANCE`
- Blocking finding count: `0`
- Write scope: 이 보고서 1개만 작성

## 1. 판정

### 판정

`READY_FOR_MAIN_ACCEPTANCE`

### 판단 이유

`WI-B-07-20260815-001`의 exact 15-path 산출물과 `AV-STAT-010` 계약을 canonical current checkout과 시스템 기본 설정의 fresh clone에서 독립 재검증했다. 양쪽 모두 artifacts/checkpoints focused `14/14`, core `69/69`, governance focused `139/139`, full tooling `330/330`, standalone checker `4/4`를 통과했다. Developer manifest의 exact 15 / raw 14 / self-reference false / target hash와 completion manifest를 raw byte로 재계산해 일치시켰다. 별도 WSL PostgreSQL 18.4에서 migration `0005 → 0006 → 0005`, metadata-only schema, 정상 artifact/checkpoint/manifest/raw 결박, hostile hash·ref·FK·environment·self-reference·target·deferred raw·UPDATE 제약, rollback 및 임시 자원 삭제를 실제 확인했다.

### 조치

Main Agent는 이 보고서 SHA-256과 blocker `0`을 확인한 뒤 별도 B-07 acceptance projection을 수행할 수 있다. 본 Tester는 acceptance, B-08, commit, push, deploy를 수행하지 않았다.

## 2. 기준선과 authority

| 항목 | 결과 |
|---|---|
| canonical HEAD / origin/main | `178010df97a10a7a0c106b5aab61feac7822a492` / 동일 |
| canonical status | 보고서 작성 전 clean |
| fresh default clone | `C:\tmp\anvil-b07-independent-20260815-001`, `core.autocrlf=true`, 동일 SHA, clean |
| WI baseline ancestor | `1a9c25b7ce2c257d40aaa10fcf3a0478f654db93`, ancestor exit `0` |
| completion projection base | `2d100b157aedc36da8a78341bbe67085c1663236` |
| base→tested diff | exact 28 paths, `git diff --check` exit `0` |
| progress | event sequence `274`, `B-07 / TEST_REVIEW`, leases null, Tester pending, `B-08 BLOCKED_PENDING_B07_ACCEPTANCE` |

Authority hash는 WI 등록값과 일치했다.

| 문서 | SHA-256 |
|---|---|
| `Anvil_설계서_v2.md` | `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5` |
| `Anvil_작업계획서_v1.md` | `E6ECCB6AD15F81E97A6D2AA663A0C3621BC7B8BB735666F60E2C424CE8763E0D` |
| `Anvil_통합검증매트릭스_v1.md` | `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5` |
| `Anvil_테스트계획서_v1.md` | `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644` |
| `docs/governance/ANVIL_OPERATING_RULES.md` | `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E` |
| `docs/work_orders/B-07_WORK_INSTRUCTION.md` | `4809891FD6EADFB7CD5A147D879257FC61C3AD7D20B63081814DF46F59E0741F` |
| `docs/work_orders/B-07_INVOCATION_PROMPT.md` | `E5F71C33D8909AF2D662D08EC5C68EA55C5825DBA40E019000BAD766B98B6A4E` |

logical projection 시각을 실제 runtime 실행시각 증거로 사용하지 않았다.

## 3. current와 fresh clone 회귀

| 명령 | current | default clone |
|---|---:|---:|
| `python -m pytest tests/artifacts tests/checkpoints -q` | `14/14 PASS` | `14/14 PASS` |
| `python -m pytest tests/domain tests/design tests/planning tests/persistence tests/execution tests/events -q --import-mode=importlib` | `69/69 PASS` | `69/69 PASS` |
| B-07 governance focused 4 modules | `139/139 PASS` (201.957s) | `139/139 PASS` (139.380s) |
| `python -m unittest discover -s tests/tooling -p test_*.py` | `330/330 PASS` (234.130s) | `330/330 PASS` (163.831s) |
| `python scripts/check_a13_repository_scan.py` | PASS, fixtures 8 / zero-delta 8 / hostile 15 | 동일 |
| `python scripts/check_g07_baseline.py` | PASS, packages 108 / AV 255 / uncovered 0 / scenarios 20 | 동일 |
| `python scripts/check_phase_g_gate.py` | PASS, accepted 7 / decisions 10 / packages 108 / AV 255 / scenarios 20 / sync 7 | 동일 |
| `python scripts/check_project_progress.py` | PASS, sequence 274 / `AUTO_CONTINUE` | 동일 |

Developer 작업 중 기록된 tooling `329 run / 22 failures`는 active diff와 frozen predecessor evidence 상태의 중간 결과였고 PASS로 승격되지 않았다. 본 독립 검증은 successor governance가 포함된 tested commit `178010d`의 clean current와 fresh clone에서 전체 `330/330`을 다시 실행해 통과했다.

## 4. EvidenceManifest 검증

`docs/evidence/manifests/B-07_EVIDENCE_MANIFEST.json`을 양쪽에서 raw byte로 재계산했다.

| 항목 | 기대 | current | clone |
|---|---:|---:|---:|
| exact paths / unique | 15 / 15 | 15 / 15 | 15 / 15 |
| raw artifacts | 14 | 14 | 14 |
| raw errors | 0 | 0 | 0 |
| self-reference / raw path self-reference | false / false | false / false | false / false |
| canonical bytes | 1527 | 1527 | 1527 |
| content bytes | 58590 | 58590 | 58590 |
| target/delivered/content hash | `ECE15CC1FD547E381512A817F71308F897DC5469EBEF70E44039C14B118B65D5` | 일치 | 일치 |
| manifest SHA-256 | `3DBF08310FF92E715A862F9AC79D73F634840D62C33D47E40373357B862E5DF1` | 일치 | 일치 |

Completion manifest도 양쪽에서 raw 4, self-reference/path self-reference false, canonical 509 bytes, content 16449 bytes였고 target을 `sha256:58AD990DE56FBF856C538B9A4C9703F40F79084CB77C2FCE2C5D61CB9CA38FEF`로 동일하게 재계산했다. Completion manifest 자체 SHA-256은 `44795EA8B67CE41D2956CB086E58B78812561E3F3DBB403548898ECBB39AB88A`였다.

## 5. WSL PostgreSQL 18 독립 검증

- Container: `anvil-b07-tester-pg18-178010d`
- Network: `anvil-b07-tester-net-178010d`
- Image: `postgres:18-alpine`
- PostgreSQL: `18.4`
- Bind: `127.0.0.1:32772 → 5432`
- Database: `anvil_b07_test`

### Migration과 metadata-only

1. `alembic upgrade 0005_event_store`: current `0005`, B-07 table/function `0/0`.
2. `alembic upgrade 0006_checkpoint_artifacts`: current `0006 (head)`, B-07 table/function `4/5`.
3. `artifacts`, `checkpoints`, `evidence_manifests`, `evidence_raw_artifacts`에서 `body/content/payload/log/bytes/blob` 컬럼 수 `0`.
4. guard 검증 후 `alembic downgrade 0005_event_store`: current `0005`, B-07 table/function `0/0`.

### Valid·hostile guard

정상 transaction으로 metadata artifact 1개, Event-bound checkpoint 1개, manifest 1개와 raw checksum 1개를 생성했고 counts `1:1:1:1`을 확인했다.

| 계약 | 실제 결과 |
|---|---|
| artifact content hash / storage ref 불일치 | check constraint로 거부 |
| artifact의 존재하지 않는 run FK | foreign key로 거부 |
| checkpoint state artifact hash 불일치 | binding trigger로 거부 |
| checkpoint의 존재하지 않는 source Event sequence | foreign key로 거부 |
| raw evidence environment 불일치 | binding trigger로 거부 |
| raw evidence manifest self-reference | binding trigger로 거부 |
| raw evidence target 불일치 | binding trigger로 거부 |
| manifest target / delivered 불일치 | check constraint로 거부 |
| manifest만 있고 raw checksum 없음 | deferred constraint trigger로 거부 |
| 동일 manifest/path raw 중복 | primary key unique로 거부 |
| artifact 본문 컬럼 조회 | undefined column으로 거부 |
| artifacts/checkpoints/manifest/raw UPDATE | 네 테이블 모두 immutable append-only trigger로 거부 |

모든 hostile 실행 후에도 counts는 `1:1:1:1`이었다. 최초 generic UPDATE probe에서 `evidence_manifests`와 `evidence_raw_artifacts`에 존재하지 않는 `created_at` 컬럼을 참조한 두 결과는 trigger 증거에서 제외했다. 실제 존재 컬럼으로 두 UPDATE를 독립 재실행해 각각 immutable trigger 거부를 확인했다. 제품·migration 변경은 없었다.

### Cleanup

정확한 임시 container/network만 삭제했고 exact-name filtered listing이 모두 빈 출력임을 확인했다. 기존 WSL DB/role/schema/data, ysna-server, `shared-db`는 접근·변경하지 않았다.

## 6. 미실행 경계와 잔여 위험

다음은 B-07 범위 밖이므로 `NOT_EXECUTED`다.

- 실제 API/auth/SSE/same-origin BFF와 HTTP 오류 매핑
- 실제 UI/browser/Network
- replay/fork/runtime orchestration과 Release binding
- Provider/외부 API
- object storage adapter 실제 동작
- ysna-server와 `shared-db`
- production/public exposure/deployment
- B-07 acceptance와 B-08 시작

현재 filesystem adapter의 object-storage 교체 가능성은 Protocol 경계로만 검증됐다. 테스트 PASS는 위에서 실제 실행한 범위만 증명한다.

## 7. 최종 결과

- Verdict: `READY_FOR_MAIN_ACCEPTANCE`
- Blocking finding count: `0`
- 제품·progress·HANDOFF·checker 수정: `0`
- commit/push/acceptance/B-08/deploy: `NOT_EXECUTED`
