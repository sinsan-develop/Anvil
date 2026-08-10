# G-03 독립 TestReport — Revision 2

- package_id: `G-03`
- tester: `g03-independent-tester`
- tested_at: `2026-08-10`
- work_instruction_id: `WI-G-03-20260810-002`
- work_instruction_sha256: `BB084509494F774A849D95DD3AD4DE99E413230A4B1B00663CD5F01C472720B3`
- evidence_manifest_sha256: `B77712834BAF05DF003029AF94A6D6EFD4CCB5E814F945B8CB5359E2A30461C0`
- tested_target: `82564F957FD6404609FF02CDC23C5F41A3540701C1048789D2919179AA31E57C`
- prior_test_report_sha256: `91BCFC383C8D4970355F7A3366924181096F0AB92691AB94E36EB26C3FF1107E`
- result_status: `FAIL / REWORK_REQUIRED`

## 1. 판정

`FAIL / REWORK_REQUIRED` — revision 1의 `G03-DEF-001~004` 원래 증상은 모두 보완됐다. 보호 inventory, §25.3 경로 `53/53`, bytecode 파일 0, 45-file delivery tree, manifest target, Git 무커밋 상태도 재현됐다. 그러나 revision 2 checker는 실제 해석 대상이 `packages.domain` 내부인 유효 상대 import를 외부 escape로 오탐한다. 이는 WorkInstruction의 “실제 해석 대상이 domain 내부에 머무르면 허용” 계약과 완료조건 9를 위반하므로 새 차단 finding `G03-DEF-005`를 발행한다.

| 검증 ID | 판정 | 판단 이유 | 조치 |
|---|---|---|---|
| `AV-SAFE-010` | `PASS` | 기존 file/tree digest 전량과 Git dirty/untracked 보호 상태가 일치하며 변경·삭제 0건이다. | revision 3에서도 전체 inventory를 회귀한다. |
| `AV-CON-002` | `PASS` | 기존 권위 문서와 보호 tree의 baseline lock이 유지됐다. WorkInstruction revision은 supersedes hash로, progress/HANDOFF는 기록된 이전 hash로 복원 가능하다. | 보호 baseline을 변경하지 않는다. |

G-03 Package 전체는 위 두 AV의 PASS만으로 합격할 수 없다. 의존 방향 checker의 필수 허용 계약에 새 blocking defect가 있으므로 `ACCEPTED`를 금지한다.

## 2. 판단 이유

### 2.1 Revision 2 artifact와 실패 계보

| artifact | bytes | 재계산 SHA-256 | 결과 |
|---|---:|---|---|
| `docs/work_orders/G-03_WORK_INSTRUCTION.md` | 8,703 | `BB084509494F774A849D95DD3AD4DE99E413230A4B1B00663CD5F01C472720B3` | 지정값 일치 |
| `docs/evidence/manifests/G-03_EVIDENCE_MANIFEST.json` | 3,184 | `B77712834BAF05DF003029AF94A6D6EFD4CCB5E814F945B8CB5359E2A30461C0` | 지정값 일치 |
| `docs/completion_reports/G-03_COMPLETION_REPORT.md` | 3,966 | `621563566890068DB0567D30C27D9AE4D216506568737920096F7611CE2233FE` | 현재 결과 고정 |
| `docs/test_reports/G-03_TEST_REPORT.md` | 15,589 | `91BCFC383C8D4970355F7A3366924181096F0AB92691AB94E36EB26C3FF1107E` | 최초 실패 보고서 보존 |

새 WorkInstruction은 revision 1 SHA `6230F3CE...E18641`을 supersede하고 `G03-DEF-001~004`를 각각 첫 유효 실패로 연결한다. 기능 범위·요구사항·중요 위험을 확대하지 않은 scoped rework다.

### 2.2 보호 inventory

inventory entry별 결과는 다음과 같다.

- top-level 권위 파일 5/5 bytes·SHA-256 일치
- `.anvil_review/`: 0 files / 0 bytes / empty SHA 일치
- `.codex_qa/`: 7 files / 1,857,259 bytes / `C7AFA61D...23C5F79` 일치
- `.tmp_subagent_review/`: 0 files / 0 bytes / empty SHA 일치
- `Backup/`: 3,409 files / 179,063,586 bytes / `84529FED...C8FD68` 일치
- 복원 `docs/`: 27 files / 166,785 bytes / `7F3CBAC5...E23AF` 일치
- entry file_count 합 `3,448` = 선언 `3,448`
- entry bytes 합 `181,585,661` = 선언 `181,585,661`

`docs/` 복원은 G-03 신규 inventory/manifest/completion, 최초 TestReport, `docs/architecture/README.md`를 제외하고 다음 이전 레코드를 대입했다.

- `docs/progress/build-progress.json`: 6,761 bytes / `6D11EEA9...A9A2`
- `docs/progress/BUILD_HANDOFF.md`: 8,980 bytes / `2C0F7130...1608`
- superseded `docs/work_orders/G-03_WORK_INSTRUCTION.md`: 5,115 bytes / `6230F3CE...E18641`

이 revision lineage 대입으로 원 27-file docs tree가 정확히 복원됐다.

### 2.3 G03-DEF-001 — 원래 금지 import 우회는 닫힘

fresh 독립 fixture에서 domain에 canonical Provider 9종, 임의 third-party, apps, 다른 package, 상대 escape 2종을 넣었다.

```python
import cerebras
import groq
import mistralai
import openrouter
import upstage
import google
import anthropic
import openai
import ollama
import arbitrary_vendor
import apps.api
import packages.policy
from ..policy import rules
from .. import policy
```

checker 결과는 exit 1이며 14개 위반을 모두 path·line·import로 출력했다. 별도 허용 fixture의 `pathlib`, `packages.domain`, `from . import local_events`, nested domain 내부 상대 import, apps→packages, 일반 package의 third-party import는 exit 0이었다. 따라서 revision 1의 false-negative 증상은 닫혔다.

### 2.4 G03-DEF-005 — 유효한 domain 내부 상대 import 오탐

WorkInstruction은 상대 import의 **실제 해석 대상**이 `packages/domain` 내부에 머무르면 허용하도록 요구한다. 그러나 `_relative_target_stays_in_domain(source_parts, level)`은 상대 level로 계산한 base만 보고 `node.module`을 결합하지 않는다.

`packages/domain/model.py`의 다음 import는 Python에서 `packages.domain`으로 정상 해석된다.

```python
from ..domain import events
```

독립 임시 package에 `packages/domain/events.py`를 만들고 실제 import한 결과:

```text
PYTHON_IMPORT_EXIT=0
PYTHON_IMPORT_RESULT=1
```

같은 tree에 checker를 실행한 결과:

```text
CHECKER_EXIT=1
packages/domain/model.py:1: ..domain: domain relative import escapes packages.domain
```

이는 금지 import를 놓치는 안전 false-negative는 아니지만, 승인된 domain 내부 의존을 차단하는 명백한 false-positive다. 기존 8개 test는 `from . import local_events`만 허용 사례로 사용해 “상위로 이동한 뒤 domain으로 재진입하는 실제 target”을 검증하지 않는다. `from packages import domain`도 같은 이유로 `packages`만 보고 차단한다.

### 2.5 G03-DEF-002 — scaffold 53/53

설계서 §25.3 root 제외 경로 53개를 기계 대조한 결과 `53/53`, `100%`다. revision 1 누락 4개는 다음과 같이 존재한다.

| 경로 | 내용·경계 | 결과 |
|---|---|---|
| `apps/api/anvil_api/main.py` | 78-byte docstring only | PASS |
| `apps/worker/anvil_worker/main.py` | 73-byte docstring only | PASS |
| `docs/architecture/README.md` | 예약 목적과 구현 0 경계 | PASS |
| `docker-compose.local.yml` | comment, `name: anvil`, `services: {}` only | PASS |

compose에는 service/image/build/port/volume/network/secret/environment/command/runtime 설정이 0건이다. `apps/**`, `packages/**`, `migrations/**`, `deploy/**`에는 placeholder 외 제품 구현이 없다.

### 2.6 G03-DEF-003 — bytecode 0

보호 tree와 `.git`을 제외한 workspace에서 `.pyc` 파일은 0개다. revision 1에서 지적한 두 bytecode SHA는 더 이상 존재하지 않는다. fresh unittest는 `PYTHONDONTWRITEBYTECODE=1`, `py_compile`은 workspace 밖 `PYTHONPYCACHEPREFIX`로 실행해 새 bytecode를 만들지 않았다.

빈 디렉터리 `scripts/__pycache__/`, `tests/tooling/__pycache__/` 2개는 남아 있다. revision 2가 정확히 두 bytecode 파일만 삭제하도록 허용하고 다른 디렉터리 삭제를 금지하므로 이는 bytecode closure를 뒤집지 않는 비차단 관찰이다.

### 2.7 G03-DEF-004 — inventory 총계

entry file_count 합과 top-level 선언은 모두 `3,448`, bytes 합과 선언은 모두 `181,585,661`이다. 기존 각 path·bytes·SHA-256은 변경되지 않았다. 원 finding은 닫혔다.

### 2.8 45-file delivery tree와 manifest

| 항목 | 독립 재계산 | 결과 |
|---|---|---|
| fixed manifest artifact | 5/5 path·bytes·SHA 일치 | PASS |
| delivery file count | 45 | PASS |
| delivery content bytes | 14,475 | PASS |
| delivery canonical bytes | 4,254 | PASS |
| delivery tree SHA-256 | `8BC6F064DA7976596DCA6CC340F52F151669E5B037A9C9F57DC2A389AF7D0613` | PASS |
| manifest canonical bytes | 656 | PASS |
| target/delivered | `82564F957FD6404609FF02CDC23C5F41A3540701C1048789D2919179AA31E57C` | PASS |
| manifest file SHA-256 | `B77712834BAF05DF003029AF94A6D6EFD4CCB5E814F945B8CB5359E2A30461C0` | PASS |

### 2.9 Git과 progress

| 항목 | 실제 결과 | 판정 |
|---|---|---|
| branch | `main` | PASS |
| remote | 0 | PASS |
| commit | 0 | PASS |
| tracked | 0 | PASS |
| staged | 0 | PASS |
| `.git/index` | 없음 | PASS |
| protected ignore | 4/4 `.gitignore` 2~5행 매칭 | PASS |

`build-progress.json`은 parse PASS, `TEST_REVIEW`, `WI-G-03-20260810-002`, `COMPLETED_AWAITING_INDEPENDENT_TESTER`, `write_lease=null`이다. progress가 finding 4개를 closed로 기록한 사실은 Developer 상태이며 독립 합격을 의미하지 않는다.

### 2.10 TDD와 미검증 범위

CompletionReport에는 revision 2 RED 명령, exit 1, 8 tests 중 2 failures가 기록돼 있다. 현재 checker를 되돌리지 않았으므로 RED는 재실행하지 않았고 별도 raw transcript가 없어 Developer 자기보고 증거로 확인했다.

GREEN은 fresh 실행에서 `Ran 8 tests in 0.348s / OK`, exit 0을 재현했다. `py_compile`과 actual scaffold checker도 exit 0이다. 그러나 새 오탐 fixture는 기존 test coverage 밖이며 completion condition 전체 PASS를 반증한다.

제품 API/UI, 브라우저 Network, DB, Docker service, WSL/server, 배포는 G-03 범위 밖이며 실행하지 않았다. tooling/scaffold PASS를 제품·운영 PASS로 승격하지 않는다.

## 3. Findings

| ID | 심각도 | finding | 영향 |
|---|---|---|---|
| `G03-DEF-005` | `MAJOR / BLOCKING` | 실제 target이 `packages.domain`인 `from ..domain import events`를 relative escape로 오탐 | 승인된 domain 내부 import가 차단되고 완료조건 9 미충족 |
| `G03-OBS-001` | `INFO / NON-BLOCKING` | `.pyc`는 0이나 빈 `__pycache__` 디렉터리 2개는 남음 | revision 2의 디렉터리 삭제 금지에 따른 잔존; bytecode 실행 artifact 없음 |

## 4. 명령·exit·실제 결과

| 명령 | exit | 실제 결과 |
|---|---:|---|
| `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_dependency_boundaries` (`PYTHONDONTWRITEBYTECODE=1`) | 0 | `Ran 8 tests in 0.348s`, `OK` |
| `C:\Users\cyhuh\anaconda3\python.exe -m py_compile scripts/check_dependency_boundaries.py tests/tooling/test_dependency_boundaries.py apps/api/anvil_api/main.py apps/worker/anvil_worker/main.py` (external `PYTHONPYCACHEPREFIX`) | 0 | stdout/stderr 없음 |
| `C:\Users\cyhuh\anaconda3\python.exe scripts/check_dependency_boundaries.py .` | 0 | current scaffold 위반 0 |
| 14개 독립 deny fixture 후 checker CLI | 1 | 위반 14개 전량 출력 |
| 허용 stdlib/domain internal/apps/package fixture 후 checker CLI | 0 | stdout/stderr 없음 |
| 실제 Python `import packages.domain.model` (`from ..domain import events`) | 0 | `RESULT=1` |
| 동일 tree checker CLI | 1 | `..domain: domain relative import escapes packages.domain` |
| 53개 `Test-Path -LiteralPath` 기계 대조 | 0 | `53/53`, missing 0 |
| workspace `.pyc` scan, protected/.git 제외 | 0 | files 0 |
| `git symbolic-ref --short HEAD` | 0 | `main` |
| `git remote` count | 0 | 0 |
| `git rev-list --all --count` | 0 | 0 |
| `git ls-files` count | 0 | 0 |
| `git diff --cached --name-only` count | 0 | 0 |
| `git check-ignore -v Backup .anvil_review .codex_qa .tmp_subagent_review` | 0 | 4/4 ignore 규칙 출력 |

Inventory와 delivery tree는 repository-relative path를 `Sort-Object Path`로 정렬하고 각 행을 `path + TAB + bytes + TAB + UPPERCASE_SHA256`, UTF-8/LF/no-final-LF로 직렬화해 재계산했다. 모든 임시 fixture는 OS temp directory를 사용했고 workspace source·Git index·branch를 수정하지 않았다.

## 5. Evidence hash

| artifact | bytes | SHA-256 |
|---|---:|---|
| `scripts/check_dependency_boundaries.py` | 4,025 | `98FF9F0D210F6E5B0B5DE4D0D7FFCB919D45D9B7003AAE9E99B472100BD1C3C5` |
| `tests/tooling/test_dependency_boundaries.py` | 6,958 | `769464A69CBC29A4ED8D78737073D5D5FAC7CD915DE976509D85E64BDF7A0A0E` |
| `docker-compose.local.yml` | 104 | `120427C3AF73F74D64E2F25713F4329A45835D1A9E434246E6281F4BAA4BD3D4` |
| `docs/architecture/README.md` | 194 | `70F3A2C130113B52345A4CCA7D499A529F2CA013B4993E476081DA05347B640A` |
| `apps/api/anvil_api/main.py` | 78 | `AD89E858BB41641277ED81F02ED6C925288A474AB095C2ED4109FAD1E27E021E` |
| `apps/worker/anvil_worker/main.py` | 73 | `2D98E7D3ADA434A978FF9870810BDD1CCFBF30EFFF8E427C05C1FBB554233ABF` |
| `G-03-delivery-tree` | canonical 4,254 | `8BC6F064DA7976596DCA6CC340F52F151669E5B037A9C9F57DC2A389AF7D0613` |
| manifest canonical target | 656 | `82564F957FD6404609FF02CDC23C5F41A3540701C1048789D2919179AA31E57C` |

## 6. 조치

판정 → `FAIL / REWORK_REQUIRED`.

판단 이유 → revision 1의 네 finding과 모든 구조·증거 검증은 통과했지만, 새 checker가 상대 import의 full target을 계산하지 않아 유효한 domain 내부 import를 차단한다.

조치 → Main Agent는 `G03-DEF-005`를 새 fingerprint의 첫 유효 실패로 기록하고 제한적 revision을 발행한다.

1. `_relative_target_stays_in_domain`에 `node.module`을 포함해 상대 level base와 module components를 결합한 실제 target을 계산한다.
2. `from ..domain import events` 및 nested package의 domain 재진입은 허용하고, `from ..policy import rules`, `from .. import policy`와 nested escape는 계속 차단하는 RED/GREEN test를 추가한다.
3. 절대 import도 실제 target 기준을 유지할지 문법을 `packages.domain...`으로 제한할지 WorkInstruction에 명시하고 회귀 test를 둔다.
4. 변경된 checker/test, delivery tree, manifest target, CompletionReport, progress/HANDOFF를 새 revision으로 재생성하고 보호 inventory·Git 상태를 다시 독립 검증한다.

그 전에는 G-03 `ACCEPTED`, commit, G-04 시작, push, tag 또는 배포를 금지한다.
