# B-04 Independent Test Report

- Package: `B-04`
- Tester role: implementation dialogue와 분리된 독립 Tester
- Tested commit: `75d9c72b847ed7122985d1bee656cbcc4b4da883`
- Tested branch: canonical `main`
- Test completed at: `2026-08-14T22:45:31+09:00`
- Verdict: `READY_FOR_MAIN_ACCEPTANCE`
- Blocking finding count: `0`
- Product/progress mutation: 없음. 이 보고서 1개만 작성함.

## 1. 판정

### 판정

`READY_FOR_MAIN_ACCEPTANCE`

### 판단 이유

B-04에 배정된 `AV-SAFE-002`, `AV-SAFE-003`, `AV-SAFE-004`, `AV-SAFE-005`, `AV-SAFE-033`, `AV-STAT-002`, `AV-FLOW-012`의 planning/hash/approval/audit 계약을 독립 재검증했다. canonical current checkout과 LF 고정 fresh clone에서 planning `9/9`, domain+design+persistence+planning `44/44`, standalone checker `4/4`, tooling `291/291`이 각각 동일하게 통과했다. EvidenceManifest exact 15 / raw 14 / self-reference false / target hash를 raw byte로 재계산해 일치시켰다. 별도 WSL PostgreSQL 18에서 migration `0002 → 0003 → 0002`, 5개 B-04 table, 3개 named hostile constraint rejection, rollback 후 0개 table, 임시 자원 삭제를 실제 확인했다.

### 조치

Main Agent는 이 보고서의 SHA-256과 blocking finding `0`을 검증한 뒤 별도 acceptance projection을 수행할 수 있다. 본 Tester는 acceptance, B-05 시작, commit, push, deploy를 수행하지 않았다.

## 2. 기준선과 Git 독립성

| 항목 | 실제 결과 |
|---|---|
| canonical current HEAD | `75d9c72b847ed7122985d1bee656cbcc4b4da883` |
| canonical `origin/main` | 동일 SHA |
| canonical status | clean |
| fresh clone | `C:\tmp\anvil-b04-independent-20260815-0240`, 동일 SHA, clean |
| B-04 baseline ancestor | `1519d8cce5e205bd9e20652cc380e65e9ca01e49`, ancestor check exit `0` |
| completion projection base | `47ad9e1216981c670aaec49b23e628315cff3547` |
| base→tested diff | exact 28 paths, `git diff --check` exit `0` |

권위 문서 실제 SHA-256은 WorkInstruction 등록값과 일치했다.

| 문서 | SHA-256 |
|---|---|
| `Anvil_설계서_v2.md` | `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5` |
| `Anvil_작업계획서_v1.md` | `A1032FB587337A914F63A316972402BAC99760A92C7934670EF93979BABA396A` |
| `Anvil_통합검증매트릭스_v1.md` | `982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A` |
| `Anvil_테스트계획서_v1.md` | `803868505616BE655B8D12FC216736DECB55E4812E7673DA242F2637BF7F40F8` |
| `docs/governance/ANVIL_OPERATING_RULES.md` | `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E` |
| `docs/work_orders/B-04_WORK_INSTRUCTION.md` | `12EC940E255E2BF67B77120337874BDEAE446F9B1F1A6B478CD61A0C791838A1` |

## 3. 검증 ID 판정

| ID | 독립 판정 | 증거 |
|---|---|---|
| `AV-SAFE-002` | PASS | 1글자 content 변경 시 canonical hash 변경 및 기존 binding `INVALIDATED` |
| `AV-SAFE-003` | PASS | subject hash/type 불일치, superseded old hash 재사용이 fail-closed |
| `AV-SAFE-004` | PASS | 만료 시 `FAILED`가 아닌 `BLOCKED`; at/after expiry 자동 실행 차단 |
| `AV-SAFE-005` | PASS | `PLAN/SCOPE_CHANGE/APPLY/DEPLOY/DESTRUCTIVE` 독립 enum 및 type-specific guard |
| `AV-SAFE-033` | PASS | root human/parent/old-new hash/expiry/semantic scope-risk guard; DB hostile insert 거부 |
| `AV-STAT-002` | PASS | WorkPlan→IterationPlan→WorkInstruction parent ID/hash와 산출물 필드 보존 |
| `AV-FLOW-012` | PASS | changed hash의 관련 approval invalidation 및 audit event 생성 |

## 4. current와 fresh clone 회귀

| 명령 | current | fresh clone |
|---|---:|---:|
| `C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/planning -v` | `9/9 PASS` | `9/9 PASS` |
| `C:\Users\cyhuh\anaconda3\python.exe -m pytest tests/domain tests/design tests/persistence tests/planning -q --import-mode=importlib` | `44/44 PASS` | `44/44 PASS` |
| `python scripts/check_a13_repository_scan.py` | PASS | PASS |
| `python scripts/check_g07_baseline.py` | PASS | PASS |
| `python scripts/check_phase_g_gate.py` | PASS | PASS |
| `python scripts/check_project_progress.py` | PASS, sequence 247 | PASS, sequence 247 |
| `C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/tooling -p test_*.py` | `291/291 PASS` (213.832s) | `291/291 PASS` (143.791s) |

Standalone `4/4`의 실제 요약은 A-13 `fixtures=8 zero_delta=8 hostile=15`, G-07 `packages=97 av=255 uncovered=0`, Phase G `accepted=7 decisions=10 sync=7`, progress `sequence=247 reporting=AUTO_CONTINUE`였다.

## 5. EvidenceManifest raw-byte 검증

`docs/evidence/manifests/B-04_EVIDENCE_MANIFEST.json`을 current와 fresh clone에서 각각 독립 재계산했다.

| 항목 | 기대 | current | clone |
|---|---:|---:|---:|
| exact write paths | 15 | 15 | 15 |
| raw artifacts | 14 | 14 | 14 |
| self reference | false | false | false |
| canonical bytes | 1493 | 1493 | 1493 |
| content bytes | 35461 | 35461 | 35461 |
| target/delivered/content hash | `B33FB1C7BF55B8AB3EF88AC8433DB3232A49601DC8348FDAF4A210A4404B4834` | 일치 | 일치 |
| manifest file SHA-256 | `D1E9A6A4C8526EC20E118051711B5E9F674B4CAA64FBFB325DAD86134122DB2D` | 일치 | 일치 |
| raw checksum errors | 0 | 0 | 0 |

## 6. WSL PostgreSQL 18 실검증

- Docker server: `29.1.3`
- Image: `postgres:18` (`PostgreSQL 18.4`)
- 임시 container: `anvil-b04-tester-pg18-75d9c72`
- 임시 network: `anvil-b04-tester-net-75d9c72`
- 노출: `127.0.0.1:32768 → 5432`, 외부 공개 없음
- 임시 DB: `anvil_b04_test`

검증 순서와 결과:

1. `ANVIL_DATABASE_URL=postgresql+psycopg://...@127.0.0.1:32768/anvil_b04_test`로 `python -m alembic upgrade 0002_design_artifacts` 실행: exit `0`, current `0002_design_artifacts`.
2. 0002 상태에서 B-04 table `0`, predecessor design table `5` 확인.
3. `python -m alembic upgrade 0003_planning_approvals`: exit `0`, current `0003_planning_approvals (head)`.
4. B-04 table `5`, named constraint 3개 확인.
5. `authenticated_human=false` hostile approval insert: exit `1`, `ck_approval_records_authenticated_human` 거부.
6. `expires_at = approved_at` hostile approval insert: exit `1`, `ck_approval_records_expiry_after_approval` 거부.
7. `semantic_diff='REQUIREMENT_CHANGE'`, `requirements_changed=true` hostile reconfirmation insert: exit `1`, `ck_nonsemantic_reconfirmations_scope_and_risk` 거부.
8. `python -m alembic downgrade 0002_design_artifacts`: exit `0`, current `0002_design_artifacts`, B-04 table `0`.
9. exact container/network 삭제 후 `container_remaining=0`, `network_remaining=0`.

초기 `pg_isready` 1회는 이미지 최초 init 중 대상 DB 생성 직전 race로 `rejecting connections`를 반환했다. 컨테이너 로그에서 init 성공과 DB 생성, 정상 서버 재시작을 확인했고 동일 컨테이너가 `accepting connections`으로 전환된 뒤 위 전 과정을 수행했다. 이는 제품·migration 실패가 아니다.

## 7. 미실행 경계

다음은 B-04 범위 밖이므로 `NOT_EXECUTED`를 유지한다.

- actual API/auth/BFF
- actual UI/browser/Network
- Provider/외부 API
- ysna-server 및 `shared-db`
- production/public exposure/deployment
- B-04 Main acceptance와 B-05 시작

## 8. 비차단 관찰과 잔여 위험

- progress sequence 242~247의 `occurred_at`은 Git commit/Tester 벽시계와 일치하는 실제 실행시각이 아니라 monotonic logical projection 시각으로 운용되고 있다. tooling 계약은 이를 PASS로 판정한다. 본 보고서는 해당 시각을 runtime 실행 증거로 사용하지 않았다. 실제 시각과 논리 시각의 의미를 후속 progress schema에서 명시하면 감사 해석이 더 명확해진다.
- B-04는 framework-neutral contract와 isolated migration까지만 검증했다. 실제 persistence adapter/API integration은 후속 Package에서 별도 검증해야 한다.

Blocking finding은 `0`이다.

## 9. Rollback과 정리

- DB rollback은 격리 DB에서 `0003_planning_approvals → 0002_design_artifacts`로 실제 검증했다.
- 운영 `shared-db`, 기존 WSL DB/role/schema/data, ysna-server는 접근·변경하지 않았다.
- 임시 PostgreSQL container/network는 제거 후 잔존 `0`을 확인했다.
- 제품 변경 rollback은 필요하지 않다. Tester가 제품·progress·checker를 수정하지 않았기 때문이다.
