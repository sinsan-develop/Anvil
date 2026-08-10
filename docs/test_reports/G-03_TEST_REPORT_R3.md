# G-03 독립 TestReport — Revision 3

- package_id: `G-03`
- tester: `g03-independent-tester`
- tested_at: `2026-08-10`
- work_instruction_id: `WI-G-03-20260810-003`
- work_instruction_sha256: `5CB06696378B7F3BC313FA28F849C5534E11835D6EDA5402B4E0296680D84820`
- evidence_manifest_sha256: `40E697B86AC328444277FD33E0D1761BADD12A0DAAFF8F6532AF24316AF66EDB`
- tested_target: `4C22241C5FF0AF4A0E1C6A21C470706E84330D8CE4045C5233C0EF7A5D350973`
- prior_test_report_r2_sha256: `AE84877A644C9FDF2420318B52B716475235C97ED036DD0833A47AC7362016D1`
- result_status: `FAIL / REWORK_REQUIRED`

## 1. 판정

`FAIL / REWORK_REQUIRED` — `G03-DEF-005`의 지정 증상은 닫혔다. `from ..domain import events`는 허용되고 `from ..policy import rules`, `from .. import policy`는 차단된다. 기존 `G03-DEF-001~004`, 보호 inventory, scaffold 53/53, 45-file delivery tree, pyc 0, empty compose, manifest target, Git 0 상태도 회귀 PASS다.

그러나 과도한 relative level이 package top을 넘어갈 때 Python은 import를 거부하지만 checker는 음수 slice 결과를 정상 base로 오인해 일부 beyond-top-level import를 허용한다. 사용자가 명시한 안전 거부 조건과 의존 경계 계약을 위반하므로 새 `G03-DEF-006`을 `MAJOR / BLOCKING`으로 판정한다.

| 검증 ID | 판정 | 판단 이유 | 조치 |
|---|---|---|---|
| `AV-SAFE-010` | `PASS` | 보호 file/tree digest와 Git dirty/untracked 상태가 모두 원 baseline과 일치한다. | 다음 revision에서도 전체 inventory 회귀 유지 |
| `AV-CON-002` | `PASS` | 기존 권위 문서·Backup·review tree·복원 docs tree의 baseline lock이 유지됐다. | 보호 baseline 변경 금지 |

G-03 Package 전체는 `G03-DEF-006` 때문에 합격할 수 없다.

## 2. 판단 이유

### 2.1 Revision 3 identity

| artifact | bytes | SHA-256 | 결과 |
|---|---:|---|---|
| `docs/work_orders/G-03_WORK_INSTRUCTION.md` | 10,102 | `5CB06696378B7F3BC313FA28F849C5534E11835D6EDA5402B4E0296680D84820` | 지정값 일치 |
| `docs/evidence/manifests/G-03_EVIDENCE_MANIFEST.json` | 3,468 | `40E697B86AC328444277FD33E0D1761BADD12A0DAAFF8F6532AF24316AF66EDB` | 지정값 일치 |
| `docs/completion_reports/G-03_COMPLETION_REPORT.md` | 3,511 | `FEE3138DEBF52AA91449A3B639263CD1BD07D46482E104896E80B9E551F89E0E` | 현재 결과 고정 |
| `docs/test_reports/G-03_TEST_REPORT_R2.md` | 13,897 | `AE84877A644C9FDF2420318B52B716475235C97ED036DD0833A47AC7362016D1` | 이전 실패 보존 |

WorkInstruction은 revision 2 SHA `BB084509...20B3`와 `G03-DEF-005` 첫 실패를 명시적으로 계승한다.

### 2.2 G03-DEF-005 closure

fresh fixture 결과:

| import | checker exit/output | 판정 |
|---|---|---|
| `from ..domain import events` | exit 0 / output 없음 | 허용 PASS |
| `from ..policy import rules` | exit 1 / `..policy` violation | 차단 PASS |
| `from .. import policy` | exit 1 / `..` violation | 차단 PASS |

실제 임시 Python package에서도 `from ..domain import events`는 정상 import되어 `RESULT=1`을 반환했다. checker와 Python 해석이 일치한다. 기존 default-deny Provider·unknown third-party·apps·다른 package 차단도 8개 unittest와 독립 deny fixture에서 유지됐다.

### 2.3 G03-DEF-006 — beyond-top-level 허용

현재 구현은 다음 계산을 사용한다.

```python
target_base = package_parts[: len(package_parts) - (level - 1)]
target_parts = target_base + tuple(module.split(".")) if module else target_base
```

상대 level이 package 깊이를 초과하면 slice end가 음수가 된다. Python slice는 오류를 내지 않고 뒤에서부터 자르므로, 존재하지 않는 parent를 정상 base로 오인할 수 있다.

root domain fixture:

```python
# packages/domain/model.py
from ....domain import events
```

- 실제 Python import: `ImportError: attempted relative import beyond top-level package`
- checker: exit 0 / output 없음

nested fixture:

```python
# packages/domain/sub/model.py
from .....domain import events
```

- checker: exit 0 / output 없음

두 경우 모두 실제 package top을 넘어가므로 안전하게 violation이어야 한다. 기존 8개 test는 정상 재진입과 두 escape만 다루고 excessive level을 포함하지 않아 이 false-negative를 놓쳤다.

### 2.4 기존 G03-DEF-001~004 회귀

| finding | fresh 결과 | 판정 |
|---|---|---|
| `G03-DEF-001` | canonical Provider 9종, arbitrary vendor, apps, other package, 상대 escape 차단 | PASS |
| `G03-DEF-002` | 설계 §25.3 root 제외 경로 53/53 | PASS |
| `G03-DEF-003` | non-protected `.pyc` 파일 0 | PASS |
| `G03-DEF-004` | inventory count `3448=3448`, bytes `181585661=181585661` | PASS |

빈 `scripts/__pycache__/`, `tests/tooling/__pycache__/` 디렉터리 2개는 revision 2의 다른 디렉터리 삭제 금지에 따라 남아 있지만 bytecode 파일은 0이다.

### 2.5 보호 inventory

- top-level 권위 파일 5/5 bytes·SHA-256 일치
- `.anvil_review/`: 0 files / empty SHA 일치
- `.codex_qa/`: 7 files / 1,857,259 bytes / `C7AFA61D...23C5F79` 일치
- `.tmp_subagent_review/`: 0 files / empty SHA 일치
- `Backup/`: 3,409 files / 179,063,586 bytes / `84529FED...C8FD68` 일치
- 복원 docs tree: 27 files / 166,785 bytes / `7F3CBAC5...E23AF` 일치

docs 복원은 G-03 신규 artifact, 최초/R2 TestReport와 architecture README를 제외하고 progress/HANDOFF의 이전 레코드 및 최초 WI `5,115 bytes / 6230F3CE...E18641`을 대입했다.

### 2.6 Scaffold·compose·제품 구현 경계

- §25.3 경로: `53/53`, missing 0
- `docker-compose.local.yml`: comment, `name: anvil`, `services: {}`만 존재
- service/image/build/port/volume/network/secret/environment/command key: 0
- API/worker main: docstring-only reservation
- apps/packages/migrations/deploy: placeholder 외 제품 구현 0

제품 API/UI/DB schema/migration/Docker service/server 구현은 없다.

### 2.7 Delivery tree와 manifest

| 항목 | 재계산 결과 | 판정 |
|---|---|---|
| fixed artifacts | 6/6 path·bytes·SHA 일치 | PASS |
| delivery tree | 45 files / content 14,621 bytes | PASS |
| tree canonical | 4,254 bytes | PASS |
| tree SHA-256 | `D20E5FC7DAC94355E822769622E006BAC1348E78B39A1F5DB228678313721D76` | PASS |
| manifest canonical | 769 bytes | PASS |
| target/delivered | `4C22241C5FF0AF4A0E1C6A21C470706E84330D8CE4045C5233C0EF7A5D350973` | PASS |
| manifest SHA-256 | `40E697B86AC328444277FD33E0D1761BADD12A0DAAFF8F6532AF24316AF66EDB` | PASS |

### 2.8 Git·progress

- branch `main`
- remote 0
- commit 0
- tracked 0
- staged 0
- `.git/index` 없음
- 보호 경로 4/4 ignore 규칙 일치

`build-progress.json`은 JSON parse PASS, `TEST_REVIEW`, `WI-G-03-20260810-003`, `COMPLETED_AWAITING_INDEPENDENT_TESTER`, `write_lease=null`이다. Developer의 `open_findings=[]`는 독립 Tester 판정 전 상태이므로 새 finding으로 대체된다.

### 2.9 TDD와 미검증 범위

CompletionReport에는 revision 3 RED 명령·exit 1·`from ..domain` 오탐, GREEN 명령·exit 0이 기록돼 있다. checker를 되돌리지 않았으므로 RED는 재실행하지 않았으며 별도 raw transcript가 없어 Developer 자기보고 증거로 확인했다.

fresh GREEN은 `Ran 8 tests in 0.279s / OK`, `py_compile` exit 0, actual scaffold checker exit 0이다. 다만 excessive-level fixture가 exit 0이어서 test suite는 전체 상대 import 안전 경계를 증명하지 못한다.

제품 API/UI, 브라우저 Network, DB, Docker service, WSL/server, 배포는 G-03 범위 밖이며 실행하지 않았다. tooling 결과를 제품·운영 PASS로 승격하지 않는다.

## 3. Findings

| ID | 심각도 | finding | 영향 |
|---|---|---|---|
| `G03-DEF-006` | `MAJOR / BLOCKING` | package 깊이를 초과한 relative level이 음수 slice로 정상 domain target처럼 계산되어 exit 0 | beyond-top-level import 안전 거부 실패, 완료조건 미충족 |
| `G03-OBS-001` | `INFO / NON-BLOCKING` | `.pyc` 0이나 빈 `__pycache__` 디렉터리 2개 잔존 | revision 2 삭제 금지에 따른 빈 디렉터리, 실행 bytecode 없음 |

## 4. 명령·exit·실제 결과

| 명령 | exit | 실제 결과 |
|---|---:|---|
| `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_dependency_boundaries` (`PYTHONDONTWRITEBYTECODE=1`) | 0 | `Ran 8 tests in 0.279s`, `OK` |
| `C:\Users\cyhuh\anaconda3\python.exe -m py_compile scripts/check_dependency_boundaries.py tests/tooling/test_dependency_boundaries.py apps/api/anvil_api/main.py apps/worker/anvil_worker/main.py` (external `PYTHONPYCACHEPREFIX`) | 0 | stdout/stderr 없음 |
| `C:\Users\cyhuh\anaconda3\python.exe scripts/check_dependency_boundaries.py .` | 0 | current scaffold 위반 0 |
| temp `from ..domain import events` fixture | 0 | output 없음 |
| temp `from ..policy`; `from .. import policy` fixture | 1 | 두 violation 출력 |
| temp `from ....domain import events` fixture | 0 | output 없음 — false-negative |
| nested temp `from .....domain import events` fixture | 0 | output 없음 — false-negative |
| actual Python import of `from ....domain import events` | nonzero exception | `ImportError: attempted relative import beyond top-level package` |
| 53-path `Test-Path` 대조 | 0 | 53/53, missing 0 |
| non-protected `.pyc` scan | 0 | files 0 |
| Git branch/remote/commit/tracked/staged 검사 | 0 | `main / 0 / 0 / 0 / 0` |

Inventory와 delivery tree는 repository-relative path, `Sort-Object Path`, `path + TAB + bytes + TAB + UPPERCASE_SHA256`, UTF-8/LF/no-final-LF 규칙으로 재계산했다. 임시 fixture는 OS temp directory만 사용했고 workspace source와 Git index를 수정하지 않았다.

## 5. Evidence hash

| artifact | bytes | SHA-256 |
|---|---:|---|
| `scripts/check_dependency_boundaries.py` | 4,151 | `0662484F2ED53FB3415A2CB0A67FB1C534C3297137B95B441318AFD4CDB85D17` |
| `tests/tooling/test_dependency_boundaries.py` | 6,978 | `D7DD80D039553C588D0CE96E4A673C049A01060232A4D38DBCAE9288EBE85BDB` |
| `G-03-delivery-tree` | canonical 4,254 | `D20E5FC7DAC94355E822769622E006BAC1348E78B39A1F5DB228678313721D76` |
| manifest canonical target | 769 | `4C22241C5FF0AF4A0E1C6A21C470706E84330D8CE4045C5233C0EF7A5D350973` |

## 6. 조치

판정 → `FAIL / REWORK_REQUIRED`.

판단 이유 → `G03-DEF-005`와 기존 회귀는 통과했지만 excessive relative level이 checker의 음수 slice를 통해 허용된다.

조치 → Main Agent는 `G03-DEF-006`을 새 fingerprint의 첫 유효 실패로 기록하고 제한적 revision을 발행한다.

1. slice 전에 `level - 1 > len(package_parts)` 또는 동등한 beyond-top-level 조건을 명시적으로 violation 처리한다.
2. root와 nested package에서 정상 내부 상대 import, domain 재진입, 다른 package escape, `module=None`, 정확한 top-level 경계, top을 1단 이상 초과한 level을 표 기반 test로 추가한다.
3. excessive level을 어떤 module suffix로도 domain 안으로 재진입시킬 수 없음을 검증한다.
4. 변경된 checker/test, delivery tree, manifest target, CompletionReport, progress/HANDOFF를 새 revision으로 재생성하고 전체 보호·Git 회귀를 독립 재검증한다.

그 전에는 G-03 `ACCEPTED`, commit, G-04 시작, push, tag 또는 배포를 금지한다.
