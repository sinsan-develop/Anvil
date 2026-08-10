# G-05 Revision 2 독립 테스트 보고서

## 1. 판정

- Work Package: `G-05`
- 판정: **PASS / READY_FOR_MAIN_ACCEPTANCE**
- 기존 차단 finding: `G05-DEF-001`~`G05-DEF-006` 모두 **CLOSED**
- 신규 차단 finding: **0건**
- 검증 ID: `AV-STAT-014`, `AV-STAT-015`, `AV-STAT-016`, `AV-STAT-041`, `AV-STAT-042` 모두 **PASS**
- 이 판정은 Main Agent의 `ACCEPTED`, commit, push 또는 G-06 시작을 수행하거나 승인하지 않는다.

## 2. 판단 이유

독립 Tester는 Developer의 대화·요약·판정을 근거로 사용하지 않고 현재 raw workspace, 권위 문서, WorkInstruction, Invocation, 실행 가능한 checker/test와 적대 변형 결과를 직접 확인했다. Revision 1에서 확인한 여섯 우회를 같은 공격 형태로 다시 재현했으며 모두 안정 reason code와 비정상 종료로 거부됐다.

신산님의 최신 승인 `APPROVAL-20260810-AUTONOMOUS-EXECUTION-001`을 우선 적용했다. 따라서 확정 범위 안의 routine recovery는 `AUTO_CONTINUE`가 정상이고, 기능 범위·요구사항·중요 위험 변경 또는 DIR 도달만 `STOP_AND_REPORT`다. 이 precedence 아래 `AV-STAT-014`를 판정했다.

### 2.1 기준선과 독립 hash

| 항목 | 독립 관측값 | 결과 |
|---|---:|---|
| Branch / HEAD | `main` / `a3014da95b34d8fe3a0a22418d78016b0fe57e61` | 일치 |
| WorkInstruction SHA-256 | `10D54BAC7D6CD87273861AFF2B47B4C09492C7DAEF7B2445B4608603B33B569A` | 일치 |
| Invocation SHA-256 | `F2F9AD88ECAF41D8753B9C3444F2EACDA33CF6B59F69F4C313DA183C1635CAD2` | 일치 |
| Manifest file SHA-256 | `F9A5E7168B9B68B70D74B68DD495211BDC7961223E5E48CFC6F565638B9E69E6` | 일치 |
| Manifest content hash | `83775BA29B77EBDB44C6F9F1191DC6F1E50674ED1ADABBC4A70F3876A53608AC` | 일치 |
| raw checksums | 21/21 actual bytes·SHA 일치 | PASS |
| target canonical bytes / content bytes | `2428` / `114971` | 일치 |
| target / delivered | `186A07DC8EFFA422BDC310697C5D9E92BCDC875F063B09F1ECF7D1C197EAE646` / 동일 | MATCH |
| detached digest file SHA-256 | `BE828B205B2043E2AE151A0A14E00C06F20243BC8238B2E7D71E48E090D58A65` | 일치 |
| build-progress file / canonical SHA-256 | `F689570244A0AE246C1C5A58AA4538E90C91B5E6AC90CA885D941E1D80182B6F` / `6C3BE35922B614C2661CB42689FEA4BDB15389307C1386E617295317AB9DA308` | digest와 일치 |
| snapshot SHA-256 | `1036A62CC9947A32F641379BA4F82015195D10225A509C3FA0C3F150C3B83A64` | 기록값 일치 |
| HANDOFF file / machine-summary SHA-256 | `0ED19A766897E6FAA2CEE1A213472E558FCC19F85FB9DF951DFA89911F5B89D3` / `CAF557DBE923765A630D0DC879B98A0B9FBF8CB70805A812BA06039E6111DAA3` | digest와 일치 |
| Event sequence | digest / progress / HANDOFF 모두 `6` | 일치 |

`target_algorithm` 선언 그대로 경로를 repository-relative POSIX로 사용하고 UTF-8 byte ordinal로 정렬한 뒤 `path<TAB>decimal_bytes<TAB>uppercase_sha256`, LF, final newline 없음으로 독립 생성했다. Manifest raw 목록에 detached digest가 정확히 1회 포함되어 progress/HANDOFF 변경이 target을 무효화하도록 결합되어 있다.

### 2.2 기존 finding closure

| Finding | 동일 공격 재현 | 관측 reason code | 판정 |
|---|---|---|---|
| `G05-DEF-001` | 최소 필드 삭제 및 progress/HANDOFF 변조 | `PRG_MINIMUM_FIELD_MISSING`, `DETACHED_DIGEST_MISMATCH`, `PRG_SNAPSHOT_HASH_MISMATCH` | CLOSED |
| `G05-DEF-002` | 증거 없는 accepted failure와 projection count 불일치 | `FAILURE_COUNT_INVALID`, `FAILURE_PROJECTION_MISMATCH`, `FAILURE_REJECTED_SEQUENCE_FORBIDDEN` | CLOSED |
| `G05-DEF-003` | 존재하지 않는 root approval·위조 subject/scope | `NSEM_APPROVAL_ARTIFACT_INVALID`, `NSEM_SCOPE_INVALID` | CLOSED |
| `G05-DEF-004` | 존재하지 않는 trigger/report/direction event로 DIR `CLEARED` | `DIR_TRIGGER_EVENT_INVALID`, `DIR_REPORT_EVENT_INVALID`, `DIR_DIRECTION_EVENT_INVALID` | CLOSED |
| `G05-DEF-005` | `SCOPE_EXPANSION_REQUIRED`를 routine `AUTO_CONTINUE`로 위장 | `RECOVERY_SCOPE_RISK_MUST_STOP` | CLOSED |
| `G05-DEF-006` | 빈 `GIT_PUSH.details` 및 effect 불일치 | `EVENT_PAYLOAD_MISSING`, `EVENT_EFFECT_MISMATCH` | CLOSED |

기존 7개 적대 case 전체 결과는 `EXPECTATIONS_MET=7`, `BYPASSES=0`이다.

### 2.3 이벤트·failure·approval·DIR 검증

- 이벤트 계약은 39개 유형이고 all-category fixture도 39개·중복 0·집합 차이 0이다. 기준 fixture는 error 0이었다.
- 39개 유형 각각에서 첫 필수 payload field를 제거했다. `EVENT_PAYLOAD_MISSING`으로 **39/39 거부**됐다.
- 39개 유형 각각에서 선언 effect를 제거했다. `EVENT_EFFECT_CONTRACT_MISSING`으로 **39/39 거부**됐다.
- 실제 accepted failure evidence는 `docs/test_reports/G-05_TEST_REPORT.md`, SHA-256 `CB03A995BF654964623737C5A347DCBD21ED62BF1268E5A53F5867516C32C26E`로 raw 파일과 일치했다. 독립 유효 count, ledger projection, progress, HANDOFF가 모두 `1`이다.
- 실제 root approval artifact의 ID `APPROVAL-20260810-INTEGRATED-BASELINE-001`, subject `C2B06FB7E358D909DD886C53699E2D28B04C69DAD150066DE03AAE05B42DB3B8`, scope 문자열과 승인 artifact 표를 독립 파싱했다. Binding의 derived scope `Anvil_작업계획서_v1.md`가 실제 승인 범위 안에 있다.
- 현재 DIR-1/2/3/X는 모두 `NOT_REACHED`이며 trigger/report/owner-direction ID가 null이다. 아직 도달하지 않은 DIR에 실제 direction chain이 있다고 위조하지 않는다.
- 별도 합성한 유효 DIR-1 `DIR_REACHED → DIR_REPORTED → DIR_OWNER_DIRECTION_RECORDED` chain은 DIR error 0이었다. direction의 actor, 순서, subject, checkpoint, subject hash를 각각 변형한 5건은 모두 `DIR_DIRECTION_EVENT_INVALID` 또는 `DIR_EVENT_CHAIN_INVALID`로 거부됐다.
- A-15/C-15/E-11 ACCEPTED 후 checkpoint 미도달 3건과 DIR_HOLD 중 lease 유지 1건은 **4/4 거부**됐다.

### 2.4 검증 ID 판정

| 검증 ID | 판정 | 독립 근거 |
|---|---|---|
| `AV-STAT-014` | PASS | 완료·실패·다음 안전 행동 projection 일치. routine=`AUTO_CONTINUE`, scope/requirements/important-risk 또는 DIR=`STOP_AND_REPORT` 적대 변형 거부 |
| `AV-STAT-015` | PASS | 15장 최소 필드, snapshot, registry ref, detached progress/HANDOFF digest와 manifest target 결합 확인 |
| `AV-STAT-016` | PASS | 39개 event 전범주 fixture, contiguous sequence, 유형별 payload/effect 제거 78회 모두 거부 |
| `AV-STAT-041` | PASS | A-15/C-15/E-11 trigger 누락과 DIR_HOLD lease 유지 거부 |
| `AV-STAT-042` | PASS | DIR-1/2/3/X 독립 registry, 실제 owner actor·subject·hash·event order chain과 DIR-X trigger guard 확인 |

### 2.5 실행 명령·exit·실제 출력

| 명령 | Exit | 실제 핵심 출력 |
|---|---:|---|
| `python -m unittest tests.tooling.test_project_progress tests.tooling.test_artifact_templates tests.tooling.test_dependency_boundaries` | 0 | `Ran 42 tests in 9.116s`, `OK` |
| `python scripts/check_project_progress.py .` | 0 | `PASS sequence=6 reporting=AUTO_CONTINUE` |
| `python scripts/check_artifact_templates.py .` | 0 | `G-04 artifact contract: 8 templates validated` |
| `python scripts/check_dependency_boundaries.py .` | 0 | 위 묶음에서 G-03 checker exit 0 |
| 독립 기존 finding mutation script | 0 | `ADVERSARIAL_CASES=7 EXPECTATIONS_MET=7 BYPASSES=0` |
| 독립 DIR trigger audit | 0 | `STAT041_CASES=4 PASSED=4` |
| 독립 21 raw checksum·target·digest audit | 0 | `raw_mismatches=[]`, `INDEPENDENT_BINDING_OK=True` |
| 독립 39 event payload/effect mutation audit | 0 | `PAYLOAD_MUTATIONS_REJECTED=39/39`, `EFFECT_MUTATIONS_REJECTED=39/39` |
| 독립 authority/failure/DIR chain audit | 0 | `APPROVAL_OK=True`, `ACTUAL_FAILURE_VALID=1`, `AUTHORITY_FAILURE_DIR_OK=True` |
| `git diff --check` | 0 | 출력 없음 |

Python은 `3.13.9`, 검증 시각은 `2026-08-10T17:23:03+09:00`이다.

## 3. 조치

1. Main Agent가 이 독립 보고서와 hash를 fresh 확인한 뒤 G-05 최종 수락 여부를 판단한다.
2. G-05가 수락되더라도 commit·push·G-06 착수는 Main Agent의 별도 운영 절차를 따른다.
3. 현재 열린 차단 finding은 없으므로 기존 합격 범위를 재개방하지 않는다.

## 4. 범위 제한과 잔여 위험

- 검증 범위는 JSON/Markdown 계약, stdlib checker, fixture, local Git/raw file hash다.
- 제품 API, UI, 브라우저 Network, DB transaction/atomic replace/outbox, process-crash durability, Docker, WSL/server, 배포와 Release 결정은 **범위 밖이며 검증하지 않았다**.
- 따라서 본 PASS를 제품 기능·운영 배포·실제 DB 복구 PASS로 승격해서는 안 된다. 해당 동적 검증은 계획된 B-08/B-12 및 이후 Package에 남아 있다.
- 기존 workspace 변경과 untracked 산출물은 보존했고, Tester가 새로 작성한 workspace 파일은 이 보고서 하나뿐이다.
