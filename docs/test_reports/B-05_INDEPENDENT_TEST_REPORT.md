# B-05 Independent Test Report

- Package: `B-05`
- Tester: 구현 대화와 분리된 독립 Tester
- Tested commit: `e08c2e34766e5a306c1d25d4579ff098c629dc3b`
- Tested at: `2026-08-15T04:40:33+09:00`
- Verdict: `READY_FOR_MAIN_ACCEPTANCE`
- Blocking finding count: `0`
- Write scope: 이 보고서 1개만 작성

## 1. 판정

### 판정

`READY_FOR_MAIN_ACCEPTANCE`

### 판단 이유

교정된 `WI-B-05-20260815-002`의 exact 15-path 산출물과 `AV-STAT-008` 계약을 canonical current checkout과 시스템 기본 설정의 fresh clone에서 독립 재검증했다. 양쪽 모두 execution `11/11`, core `55/55`, standalone checker `4/4`, tooling `311/311`을 통과했다. Developer manifest의 exact 15 / raw 14 / self-reference false / target hash와 completion manifest를 raw byte로 재계산해 일치시켰다. 별도 WSL PostgreSQL 18에서 migration `0003 → 0004 → 0003`, table/function `0/0 → 10/3 → 0/0`, hostile/valid execution·release·DIR guard, rollback 및 임시 자원 삭제를 실제 확인했다.

### 조치

Main Agent는 보고서 SHA-256과 blocker `0`을 확인한 뒤 별도 B-05 acceptance projection을 수행할 수 있다. 본 Tester는 acceptance, B-06, commit, push, deploy를 수행하지 않았다.

## 2. 기준선과 authority

| 항목 | 결과 |
|---|---|
| canonical HEAD / origin/main | `e08c2e34766e5a306c1d25d4579ff098c629dc3b` / 동일 |
| canonical status | clean |
| fresh default clone | `C:\tmp\anvil-b05-independent-20260815-001`, `core.autocrlf=true`, 동일 SHA, clean |
| WI R2 baseline ancestor | `0a3a9bbf0c11ed53a5f5ff647591d48bc4d06565`, ancestor exit `0` |
| completion projection base | `2edc44044df522e6ec7c56b95c5e9414932ac856` |
| base→tested diff | exact 28 paths, `git diff --check` exit `0` |
| progress | sequence `260`, `B-05 / TEST_REVIEW`, leases null, Tester pending |

Authority hash는 WI 등록값과 일치했다.

| 문서 | SHA-256 |
|---|---|
| `Anvil_설계서_v2.md` | `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5` |
| `Anvil_작업계획서_v1.md` | `E6ECCB6AD15F81E97A6D2AA663A0C3621BC7B8BB735666F60E2C424CE8763E0D` |
| `Anvil_통합검증매트릭스_v1.md` | `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5` |
| `Anvil_테스트계획서_v1.md` | `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644` |
| `docs/governance/ANVIL_OPERATING_RULES.md` | `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E` |
| `docs/work_orders/B-05_WORK_INSTRUCTION.md` | `DFC7BDECBECE0E6A2E48E68011D91E51AEB370A0E6CB67E1EA1ACBAE00F17A43` |
| `docs/work_orders/B-05_INVOCATION_PROMPT.md` | `6C570930EBC566B52C1BC45459BF567CF8E64306CC140F78E3D2B3ED95927684` |

logical projection의 시각을 실제 runtime 실행시각으로 추론하지 않았다.

## 3. current와 fresh clone 회귀

| 명령 | current | default clone |
|---|---:|---:|
| `python -m pytest tests/execution -q` | `11/11 PASS` | `11/11 PASS` |
| `python -m pytest tests/domain tests/design tests/planning tests/persistence tests/execution -q --import-mode=importlib` | `55/55 PASS` | `55/55 PASS` |
| `python scripts/check_a13_repository_scan.py` | PASS | PASS |
| `python scripts/check_g07_baseline.py` | PASS, packages 108 / AV 255 | 동일 |
| `python scripts/check_phase_g_gate.py` | PASS | PASS |
| `python scripts/check_project_progress.py` | PASS, sequence 260 | 동일 |
| `python -m unittest discover -s tests/tooling -p test_*.py` | `311/311 PASS` (237.350s) | `311/311 PASS` (148.968s) |

## 4. EvidenceManifest 검증

`docs/evidence/manifests/B-05_EVIDENCE_MANIFEST.json`을 양쪽에서 raw byte로 재계산했다.

| 항목 | 기대 | current | clone |
|---|---:|---:|---:|
| exact paths | 15 | 15 | 15 |
| raw artifacts | 14 | 14 | 14 |
| self-reference | false | false | false |
| canonical bytes | 1508 | 1508 | 1508 |
| content bytes | 56494 | 56494 | 56494 |
| target/delivered/content hash | `8BFFC8B2F2D55DD951E59E849A5A2740723C0DC14CA1586E06C77FBD8E142BBB` | 일치 | 일치 |
| manifest SHA-256 | `262B9AB8AEBB5A940594A92000B9AA66E1F1C5908D5700C8AE5D0DEA55BE8E16` | 일치 | 일치 |
| errors | 0 | 0 | 0 |

Completion manifest도 양쪽에서 raw 4, self-reference false, canonical 516 bytes, content 16393 bytes였고 target을 `sha256:6D521105AADE1A7E5C3BA862A1DDEB58C2A456273FF93522697D93D5A6EAC7E8`로 동일하게 재계산했다.

## 5. WSL PostgreSQL 18 독립 검증

- Container: `anvil-b05-tester-pg18-e08c2e3`
- Network: `anvil-b05-tester-net-e08c2e3`
- Image: `postgres:18`
- Bind: `127.0.0.1:32769 → 5432`
- Database: `anvil_b05_test`

### Migration

1. `python -m alembic upgrade 0003_planning_approvals`: current `0003`, B-05 table/function `0/0`.
2. `python -m alembic upgrade 0004_execution_release`: current `0004 (head)`, B-05 table/function `10/3`.
3. guard 검증 후 `python -m alembic downgrade 0003_planning_approvals`: current `0003`, B-05 table/function `0/0`.

### Hostile·valid guard

| 계약 | 실제 결과 |
|---|---|
| SUBAGENT without Delegation | commit 시 `requires exactly one delegation`, exit `1` |
| SUBAGENT + matching Delegation 1개 | commit PASS |
| 동일 Step의 두 번째 unfinished attempt | `uq_step_attempts_one_active_per_step`, exit `1` |
| MAIN_TAKEOVER + Delegation | `forbids delegation`, exit `1` |
| MAIN_TAKEOVER + takeover reference, Delegation 없음 | insert PASS |
| Result target hash mismatch | trigger reject, exit `1` |
| matching Result | insert PASS, source attempt terminal binding 확인 |
| 동일 attempt의 두 번째 terminal Result | trigger reject, exit `1` |
| unauthenticated ReleaseDecision | `ck_release_decisions_authenticated_human`, exit `1` |
| RELEASE without suitable same-hash ProductValidation | trigger reject, exit `1` |
| suitable same-hash ProductValidation + open blocking MAJOR defect | release reject, exit `1` |
| defect `CLOSED` 후 동일 hash RELEASE | insert PASS |
| DIR status `NOT_REACHED` 저장 | `ck_design_intent_reviews_status`, exit `1` |
| owner direction 없는 `CLEARED` | `ck_design_intent_reviews_owner_clear`, exit `1` |
| authenticated owner direction 후 `CLEARED` | update PASS |
| recurrent drift | 기존 review `CLEARED` 유지, 새 review `DIR_HOLD` + 새 causation event |
| canonical DIR 상태 | `CLEARED`, `DIR_HOLD`, `REPORTING`, `WAITING_OWNER_DIRECTION` 정확히 관찰 |

최초 no-delegation/valid 두 명령을 같은 Step에 병렬 실행해 unique race가 발생한 결과는 테스트 증거에서 제외했다. 독립 Step을 추가해 순차 재실행했고 정확한 delegation trigger rejection을 확인했다. 제품·migration 변경은 없었다.

### Cleanup

정확한 임시 container/network만 삭제했고 `container_remaining=0`, `network_remaining=0`을 확인했다. 기존 WSL DB/role/schema/data, ysna-server, `shared-db`는 접근·변경하지 않았다.

## 6. 미실행 경계와 잔여 위험

다음은 B-05 범위 밖이므로 `NOT_EXECUTED`다.

- 실제 API/auth/SSE/same-origin BFF
- 실제 UI/browser/Network
- Provider/외부 API
- ysna-server와 `shared-db`
- production/public exposure/deployment
- B-05 acceptance와 B-06 시작

현재 repository는 framework-neutral Protocol이다. concrete persistence adapter와 HTTP/UI integration은 후속 Package 검증 대상이다.

## 7. 최종 결과

- Verdict: `READY_FOR_MAIN_ACCEPTANCE`
- Blocking finding count: `0`
- 제품·progress·HANDOFF·checker 수정: `0`
- commit/push/acceptance/B-06/deploy: `NOT_EXECUTED`
