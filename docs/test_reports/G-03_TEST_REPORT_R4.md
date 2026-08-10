# G-03 독립 TestReport — Revision 4

- package_id: `G-03`
- tester: `g03-independent-tester`
- tested_at: `2026-08-10`
- work_instruction_id: `WI-G-03-20260810-004`
- work_instruction_sha256: `F7AB695C6B6D91D47287E12218A39A870E8AC3CADBBE09ED91E46B8E30CC0A3A`
- evidence_manifest_sha256: `A089B389B21DBDADD7CBC6D18EC9C2374F858D4E92DD7BC75EF1580DA5D1388F`
- tested_target: `F03EC454E960BCF6A8271D7BE547129CB4220574254DCE9B927F2E12AFBFD6AB`
- prior_test_report_r3_sha256: `F3EE86CD7636CF49A5F8BE510E60D310A558F1528F03CD5D0E60A75486CC20AD`
- result_status: `PASS / READY_FOR_MAIN_ACCEPTANCE`

## 1. 판정

`PASS / READY_FOR_MAIN_ACCEPTANCE` — `G03-DEF-006`의 root/nested beyond-top-level false-negative가 닫혔다. 합법적인 root·nested `packages.domain` 재진입은 허용되고, 다른 package escape와 package top 초과 relative level은 차단된다. 기존 `G03-DEF-001~005`, 보호 inventory, scaffold 53/53, 45-file delivery tree, non-protected pyc 0, empty compose, manifest target/delivered, Git `main`·remote/commit/tracked/staged 0도 fresh 회귀 PASS다.

| 검증 ID | 판정 | 판단 이유 | 조치 |
|---|---|---|---|
| `AV-SAFE-010` | `PASS` | 기존 file/tree digest 전량과 Git dirty/untracked 보호 상태가 일치해 변경·삭제 0건이다. | 보호 상태를 유지하고 Main Agent가 최종 판정한다. |
| `AV-CON-002` | `PASS` | 권위 문서·Backup·review tree·복원 docs tree의 baseline lock이 유지됐다. | 보호 baseline을 이후 Package에서도 회귀한다. |

차단 finding은 없다. 독립 Tester PASS는 자동 `ACCEPTED`가 아니며 Main Agent의 증거 검토와 최종 판정이 남아 있다.

## 2. 판단 이유

### 2.1 Revision 4 identity와 계보

| artifact | bytes | 재계산 SHA-256 | 결과 |
|---|---:|---|---|
| `docs/work_orders/G-03_WORK_INSTRUCTION.md` | 11,400 | `F7AB695C6B6D91D47287E12218A39A870E8AC3CADBBE09ED91E46B8E30CC0A3A` | 지정값 일치 |
| `docs/evidence/manifests/G-03_EVIDENCE_MANIFEST.json` | 3,756 | `A089B389B21DBDADD7CBC6D18EC9C2374F858D4E92DD7BC75EF1580DA5D1388F` | 지정값 일치 |
| `docs/completion_reports/G-03_COMPLETION_REPORT.md` | 3,934 | `E5C78C68DAB6493AA9B1A22A5ED3BE36E86A3185C0625D890DE1434B32E8274D` | 현재 결과 고정 |
| `docs/test_reports/G-03_TEST_REPORT_R3.md` | 11,255 | `F3EE86CD7636CF49A5F8BE510E60D310A558F1528F03CD5D0E60A75486CC20AD` | 이전 실패 보존 |

WorkInstruction은 revision 3 SHA `5CB06696...4820`과 `G03-DEF-006` 첫 실패를 명시적으로 계승한다. 이전 TestReport R1~R3 hash도 manifest 7개 fixed artifact에 포함돼 보존됐다.

### 2.2 G03-DEF-006 closure

현재 checker는 `ascents = level - 1`을 계산한 뒤 `ascents >= len(package_parts)`이면 slicing 전에 즉시 거부한다. 독립 표 기반 fixture 결과는 다음과 같다.

| fixture | 기대 | 실제 | 결과 |
|---|---|---|---|
| root `from ..domain import events` | 허용 | exit 0, output 없음 | PASS |
| root `from ..policy import rules` | 차단 | exit 1, `..policy` violation | PASS |
| root `from .. import policy` | 차단 | exit 1, `..` violation | PASS |
| root 최소 beyond `from ...domain import events` | 차단 | exit 1, `...domain` violation | PASS |
| root excessive `from ....domain import events` | 차단 | exit 1, `....domain` violation | PASS |
| nested `from .. import events` | 허용 | exit 0 | PASS |
| nested `from ...domain import events` | 허용 | exit 0 | PASS |
| nested `from ...policy import rules` | 차단 | exit 1, `...policy` violation | PASS |
| nested `from ... import policy` | 차단 | exit 1, `...` violation | PASS |
| nested 최소 beyond `from ....domain import events` | 차단 | exit 1, `....domain` violation | PASS |
| nested excessive `from .....domain import events` | 차단 | exit 1, `.....domain` violation | PASS |

실제 임시 Python package에서 nested `from ...domain import events`를 import한 결과도 exit 0, `RESULT=7`로 checker 허용과 일치했다. 음수 slice 우회는 재현되지 않았다.

### 2.3 G03-DEF-001~005 회귀

| finding | fresh 검증 | 판정 |
|---|---|---|
| `G03-DEF-001` | canonical Provider 9종·unknown third-party·apps·other package default-deny, 상대 escape 차단 | PASS |
| `G03-DEF-002` | 설계서 §25.3 root 제외 경로 53/53 | PASS |
| `G03-DEF-003` | non-protected `.pyc` 파일 0 | PASS |
| `G03-DEF-004` | inventory file count `3448=3448`, bytes `181585661=181585661` | PASS |
| `G03-DEF-005` | root `from ..domain` 및 nested `from ...domain` 합법 재진입 허용 | PASS |

fresh unittest는 9개 전부 통과했고 독립 root/nested 경계표도 전 항목 기대값과 일치했다.

### 2.4 보호 inventory

- top-level 권위 파일 5/5 bytes·SHA-256 일치
- `.anvil_review/`: 0 files / 0 bytes / empty SHA 일치
- `.codex_qa/`: 7 files / 1,857,259 bytes / `C7AFA61D...23C5F79` 일치
- `.tmp_subagent_review/`: 0 files / 0 bytes / empty SHA 일치
- `Backup/`: 3,409 files / 179,063,586 bytes / `84529FED...C8FD68` 일치
- 복원 docs tree: 27 files / 166,785 bytes / `7F3CBAC5...E23AF` 일치
- entry 합계: 3,448 files / 181,585,661 bytes, 선언과 일치

docs 복원은 G-03 신규 artifact, TestReport R1~R3와 architecture README를 제외하고 progress/HANDOFF의 이전 레코드 및 최초 WI `5,115 bytes / 6230F3CE...E18641`을 대입했다.

### 2.5 Scaffold·compose·제품 구현 경계

- §25.3 경로: 53/53, missing 0
- `docker-compose.local.yml`: comment, `name: anvil`, `services: {}`만 존재
- service/image/build/port/volume/network/secret/environment/command key: 0
- API/worker main: docstring-only reservation
- apps/packages/migrations/deploy: placeholder 외 제품 구현 0
- non-protected `.pyc`: 0

빈 `scripts/__pycache__/`, `tests/tooling/__pycache__/` 디렉터리 2개는 revision 2의 다른 디렉터리 삭제 금지에 따른 비차단 잔존이며 실행 bytecode는 없다.

### 2.6 Delivery tree와 manifest

| 항목 | 독립 재계산 | 판정 |
|---|---|---|
| fixed artifacts | 7/7 path·bytes·SHA 일치 | PASS |
| delivery tree | 45 files / content 15,901 bytes | PASS |
| tree canonical | 4,254 bytes | PASS |
| tree SHA-256 | `EDCD2A041E095B6232D022DA14BFDB87936F7478A4808316D7F835D0DBBCB914` | PASS |
| manifest canonical | 881 bytes | PASS |
| target/delivered | `F03EC454E960BCF6A8271D7BE547129CB4220574254DCE9B927F2E12AFBFD6AB` | PASS |
| manifest file SHA-256 | `A089B389B21DBDADD7CBC6D18EC9C2374F858D4E92DD7BC75EF1580DA5D1388F` | PASS |

### 2.7 Git·progress

| 항목 | 실제 결과 | 판정 |
|---|---|---|
| branch | `main` | PASS |
| remote | 0 | PASS |
| commit | 0 | PASS |
| tracked | 0 | PASS |
| staged | 0 | PASS |
| `.git/index` | 없음 | PASS |
| 보호 경로 ignore | 4/4 `.gitignore` 2~5행 매칭 | PASS |

`build-progress.json`은 JSON parse PASS, `TEST_REVIEW`, `WI-G-03-20260810-004`, `COMPLETED_AWAITING_INDEPENDENT_TESTER`, `write_lease=null`이다. 독립 Tester 결과 전에는 `ACCEPTED`가 아닌 상태를 정직하게 유지했다.

### 2.8 TDD와 미검증 범위

CompletionReport에는 revision 4 RED 명령·exit 1·beyond-top-level fixture 실패, GREEN 명령·exit 0이 기록돼 있다. 현재 checker를 되돌리지 않았으므로 RED는 재실행하지 않았고 별도 raw transcript가 없어 Developer 자기보고 증거로 확인했다.

fresh 검증은 다음을 재현했다.

- 9 unittest: `Ran 9 tests in 0.263s / OK`, exit 0
- checker/test/API·worker placeholder `py_compile`: exit 0
- actual scaffold checker: exit 0
- 독립 root/nested 경계표: 전 항목 `OK=True`

제품 API/UI, 브라우저 Network, DB, Docker service, WSL/server, 배포는 G-03 범위 밖이며 실행하지 않았다. tooling/scaffold PASS를 제품·운영 PASS로 승격하지 않는다.

## 3. Findings

차단 finding 없음.

| ID | 심각도 | 관찰 | 영향 |
|---|---|---|---|
| `G03-OBS-001` | `INFO / NON-BLOCKING` | `.pyc`는 0이나 빈 `__pycache__` 디렉터리 2개 잔존 | revision 2 삭제 금지에 따른 빈 디렉터리; bytecode·제품 동작 없음 |

## 4. 명령·exit·실제 결과

| 명령 | exit | 실제 결과 |
|---|---:|---|
| `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_dependency_boundaries` (`PYTHONDONTWRITEBYTECODE=1`) | 0 | `Ran 9 tests in 0.263s`, `OK` |
| `C:\Users\cyhuh\anaconda3\python.exe -m py_compile scripts/check_dependency_boundaries.py tests/tooling/test_dependency_boundaries.py apps/api/anvil_api/main.py apps/worker/anvil_worker/main.py` (external `PYTHONPYCACHEPREFIX`) | 0 | stdout/stderr 없음 |
| `C:\Users\cyhuh\anaconda3\python.exe scripts/check_dependency_boundaries.py .` | 0 | current scaffold 위반 0 |
| 독립 root/nested relative import 8-case harness | 0 | 모든 case exit/output 기대값 일치, `TABLE_ALL_OK=True` |
| 실제 nested `from ...domain` Python import | 0 | `NESTED_RESULT=7` |
| 53-path `Test-Path` 대조 | 0 | 53/53, missing 0 |
| non-protected `.pyc` scan | 0 | files 0 |
| compose forbidden key `rg` | 1 | no-match, 금지 runtime key 0 |
| `git symbolic-ref --short HEAD` | 0 | `main` |
| `git remote` count | 0 | 0 |
| `git rev-list --all --count` | 0 | 0 |
| `git ls-files` count | 0 | 0 |
| `git diff --cached --name-only` count | 0 | 0 |
| `git check-ignore -v Backup .anvil_review .codex_qa .tmp_subagent_review` | 0 | 4/4 ignore 규칙 출력 |

Inventory와 delivery tree는 repository-relative path, `Sort-Object Path`, `path + TAB + bytes + TAB + UPPERCASE_SHA256`, UTF-8/LF/no-final-LF 규칙으로 재계산했다. 모든 임시 fixture는 OS temp directory만 사용했고 workspace source·Git index·branch를 수정하지 않았다.

## 5. Evidence hash

| artifact | bytes | SHA-256 |
|---|---:|---|
| `scripts/check_dependency_boundaries.py` | 4,230 | `7A268A5EF232B6E2856A523E4AD24F698DDAD4CD47F0283527043BC6566011CB` |
| `tests/tooling/test_dependency_boundaries.py` | 8,179 | `EC89DFC2A1F2C6EE5003F56B43CB8CA0C0ED9087AB4DD4B5F7797978F598779C` |
| `G-03-delivery-tree` | canonical 4,254 | `EDCD2A041E095B6232D022DA14BFDB87936F7478A4808316D7F835D0DBBCB914` |
| manifest canonical target | 881 | `F03EC454E960BCF6A8271D7BE547129CB4220574254DCE9B927F2E12AFBFD6AB` |

## 6. 조치

판정 → `PASS / READY_FOR_MAIN_ACCEPTANCE`.

판단 이유 → `G03-DEF-001~006`의 지정 증상과 관련 회귀, 보호·scaffold·manifest·Git 계약이 모두 fresh 검증을 통과했고 새 차단 finding이 없다.

조치 → Main Agent가 본 TestReport SHA와 핵심 evidence를 독립 재확인한 뒤 G-03 최종 `ACCEPTED` 여부를 판정한다. commit은 G-03 합격 뒤 별도 승인 절차를 따르며, Main 판정 전에는 G-04 시작·push·tag·배포를 수행하지 않는다.
