# G-03 독립 TestReport

- package_id: `G-03`
- tester: `g03-independent-tester`
- tested_at: `2026-08-10`
- work_instruction_id: `WI-G-03-20260810-001`
- work_instruction_sha256: `6230F3CE3CA99D00AE6B056CDF0DC9155DEEA942487FA23C9566224F12E18641`
- evidence_manifest_sha256: `D708D9E90EF6BAE5931429B552AD7AD51173F7FDF4475CC7E2F68119A9F562A4`
- tested_target: `123C9E3BAEB3591DE16DAA9AAD0410CE5BC8A682F129E38429E07786A4A28660`
- result_status: `FAIL / REWORK_REQUIRED`

## 1. 판정

`FAIL / REWORK_REQUIRED` — 기존 보호 자산 보존과 Git 무커밋 상태는 입증되어 `AV-SAFE-010`, `AV-CON-002`는 각각 `PASS`다. 그러나 G-03의 필수 완료조건인 의존 경계의 기계적 재현, 설계서 §25.3 scaffold 경로 100%, WorkInstruction 허용 경로 밖 신규·변경 0, 정확한 inventory 총계가 충족되지 않았다. 따라서 G-03은 `ACCEPTED`로 전환할 수 없다.

| 검증 ID | 판정 | 판단 이유 | 조치 |
|---|---|---|---|
| `AV-SAFE-010` | `PASS` | pre-scaffold 각 file/tree의 bytes·SHA-256을 독립 재계산했다. `docs/`는 신규 G-03 artifact 3개를 제외하고 progress/HANDOFF의 기록된 이전 bytes/hash를 치환해 원 digest를 복원했다. 보호 파일의 변경·삭제는 0건이다. | 보호 상태를 유지한다. 아래 G-03 결함 수정 중에도 전체 inventory 회귀를 다시 실행한다. |
| `AV-CON-002` | `PASS` | 기존 권위 문서 5개, `Backup/`, review tree 3개, 복원된 `docs/` tree가 baseline digest와 일치해 기존 자산 잠금은 유지됐다. | baseline entry digest는 유지한다. 다만 총 파일 수 metadata 오류는 새 revision 계보로 정정한다. |

## 2. 판단 이유

### 2.1 pre-scaffold 보호 자산 재계산

재귀 tree canonical 규칙은 repository-relative path를 사용하고 PowerShell `Sort-Object Path` 순서로 `path + TAB + bytes + TAB + UPPERCASE_SHA256` 레코드를 UTF-8/LF/no-final-LF로 연결했다.

| entry | files | bytes | 재계산 SHA-256 | 결과 |
|---|---:|---:|---|---|
| `.anvil_review/` | 0 | 0 | `E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855` | 일치 |
| `.codex_qa/` | 7 | 1,857,259 | `C7AFA61DE61F2B790A169BBB4501A8D971FCD6F9C043676516BDEC9770235F79` | 일치 |
| `.tmp_subagent_review/` | 0 | 0 | `E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855` | 일치 |
| `AGENTS.md` | 1 | 8,332 | `BFF4DB0D1C17EF0794666A56A3156C92A53E1EE1D54ADFFFEB462571AAEEE3EA` | 일치 |
| `Anvil_설계서_v2.md` | 1 | 309,195 | `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5` | 일치 |
| `Anvil_작업계획서_v1.md` | 1 | 64,945 | `4DB8F5F5F85703CB4E1093550F6C8268D8666A50D2E84FDD70FC355014CF7475` | 일치 |
| `Anvil_테스트계획서_v1.md` | 1 | 53,818 | `870BC8CAC3A7E5BAEBB711E3822C88EB01F18467654DCF170C689B3195114DC5` | 일치 |
| `Anvil_통합검증매트릭스_v1.md` | 1 | 61,741 | `0A0CEA887EB0ECEB00EBFF7439E86890C878DDB06E1814398FB4D758E6B245D3` | 일치 |
| `Backup/` | 3,409 | 179,063,586 | `84529FED7F4187F344CC02E427E9F7B0351CD7185953145895F49EE2D7C8FD68` | 일치 |
| `docs/` 복원 tree | 27 | 166,785 | `7F3CBAC5D671260CD045F56D22AB731EAA3662117A77FB57C90226B6C61E23AF` | 일치 |

`docs/` 복원에서는 다음 3개 신규 artifact를 제외했다.

- `docs/baselines/G-03_PRE_SCAFFOLD_INVENTORY.json`
- `docs/evidence/manifests/G-03_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/G-03_COMPLETION_REPORT.md`

그리고 `docs/progress/build-progress.json`은 이전 `6,761 bytes / 6D11EEA9...A9A2`, `docs/progress/BUILD_HANDOFF.md`는 이전 `8,980 bytes / 2C0F7130...1608` 레코드로 치환했다. 이 방식으로 27-file 원 tree가 정확히 복원됐다.

단, inventory entry의 `file_count` 합은 `3,448`인데 top-level `pre_scaffold_file_count`는 `3,447`이다. bytes 합 `181,585,661`은 일치한다. 따라서 CompletionReport의 “기존 3,447개 파일” 표현은 부정확하다.

### 2.2 Git 상태와 ignored 보호 경로

| 항목 | 실제 결과 | 판정 |
|---|---|---|
| branch | `main` | PASS |
| remote | 0 | PASS |
| commit | 0 | PASS |
| tracked | 0 | PASS |
| staged | 0 | PASS |
| `.git/index` | 없음 | PASS |
| ignore 규칙 | `Backup`, `.anvil_review`, `.codex_qa`, `.tmp_subagent_review` 모두 `.gitignore` 2~5행에 의해 ignore | PASS |

`git status --short`의 모든 비보호 항목은 untracked였으며 기존 파일이 tracked/staged로 승격된 흔적은 없었다. 빈 `.anvil_review/`, `.tmp_subagent_review/`는 status에 나타나지 않지만 `git check-ignore -v`로 ignore 규칙을 직접 확인했다.

### 2.3 WorkInstruction 범위

G-03 delivery 41개 파일과 기존 top-level 권위 문서 5개 외의 비보호·비docs·비Git 파일을 역검사한 결과, 허용 경로 밖 신규 파일이 2개다.

- `scripts/__pycache__/check_dependency_boundaries.cpython-313.pyc` — 5,707 bytes, SHA-256 `C3CFB53A682FC8DD611A7D267E36F6B7D2507C4489531B2143A4D25FD4A064E9`
- `tests/tooling/__pycache__/test_dependency_boundaries.cpython-313.pyc` — 6,650 bytes, SHA-256 `08E53DB743899302AA86C4559BCDFC6B73AD2FF9AB132565A7F69886D5D4D020`

WorkInstruction은 `scripts/check_dependency_boundaries.py`와 `tests/tooling/test_dependency_boundaries.py`만 정확히 허용한다. `.gitignore`로 무시된다는 사실은 write 허용 범위를 넓히지 않는다. 독립 fresh 실행은 `PYTHONDONTWRITEBYTECODE=1`과 workspace 밖 `PYTHONPYCACHEPREFIX`를 사용했고 위 두 파일의 timestamp/hash가 실행 전후 동일함을 확인했으므로 Tester가 새로 만든 파일은 아니다.

### 2.4 설계서 §25.3 scaffold 및 제품 구현 0

설계서 §25.3의 root 제외 명시 경로 53개를 대조한 결과 `49/53`, 즉 `92.45%`다.

| 누락 경로 | 비고 |
|---|---|
| `apps/api/anvil_api/main.py` | `apps/**` 범위 안에서 빈 placeholder 생성 가능했으나 없음 |
| `apps/worker/anvil_worker/main.py` | `apps/**` 범위 안에서 빈 placeholder 생성 가능했으나 없음 |
| `docs/architecture/` | §25.3 필수이나 현 WorkInstruction 허용 docs 경로에 없음 |
| `docker-compose.local.yml` | §25.3 필수이나 현 WorkInstruction 허용 경로에 없고 Docker service 구현은 금지됨 |

후자의 두 경로는 상위 설계 완료조건과 WorkInstruction 허용 경로가 충돌한다. Main Agent가 “빈/주석 전용 scaffold는 허용하되 Docker service/runtime 구현은 금지”처럼 revision으로 경계를 명확히 해야 한다.

`apps/**`, `packages/**`, `migrations/**`, `deploy/**`의 제품 파일은 `.gitkeep` 29개뿐이다. API/UI/DB schema/migration/Docker service/runtime 구현은 0건으로 확인됐다.

### 2.5 의존 방향 checker와 test source 검토

긍정적 요소는 다음과 같다.

- 표준 라이브러리만 사용한다.
- `Violation`은 frozen dataclass이고 결과 정렬과 파일·행·import 출력이 결정적이다.
- 현재 5개 test는 apps→packages 허용, 허용 밖 직접 source, packages→apps, 대표 domain 금지 import, CLI nonzero/output을 검증한다.
- 알려진 `fastapi`, `docker`, `apps.web` 위반 fixture는 exit 1과 위반 3건을 정확히 출력했다.

그러나 core 계약을 우회하는 false negative가 있다.

1. `FORBIDDEN_DOMAIN_ROOTS`는 canonical 9개 Provider 중 일부만 포함한다. `groq`, `ollama` 등 실제 LLM provider SDK import가 금지 규칙을 통과한다.
2. `ast.ImportFrom`을 검사할 때 `node.level`을 사용하지 않고 `node.module`이 있는 경우만 처리한다. 따라서 domain의 `from ..policy import rules`와 `from .. import policy` 같은 상대 outer-package import를 탐지하지 못한다.
3. 기존 test source는 `openai` 한 종류만 다루고 canonical 9개 Provider 및 상대 import 우회를 검증하지 않는다.

임시 fixture `packages/domain/provider_leaks.py`에 아래 내용을 넣고 실제 CLI를 실행했다.

```python
import groq
import ollama
from ..policy import rules
```

실제 결과는 `exit 0 / stdout empty / stderr empty`였다. 이는 “LLM provider SDK 금지”와 “domain→다른 packages 금지”가 기계적으로 재현된다는 CompletionReport 주장을 반증한다. 또한 실제 scaffold checker의 exit 0은 현재 apps/packages에 Python 제품 source가 전혀 없는 빈 상태만 증명한다.

### 2.6 EvidenceManifest와 41-file virtual delivery tree

| 항목 | 재계산 결과 | 판정 |
|---|---|---|
| fixed artifact | 4/4 path·bytes·SHA-256 일치 | PASS |
| virtual tree | 41 files, content bytes 11,019 | PASS |
| virtual tree canonical | 3,867 bytes | PASS |
| virtual tree SHA-256 | `615D8EE04F9188CD847AD7C0984281B1EDB33766C5A0CD85910E801ED205605B` | PASS |
| manifest canonical | 547 bytes | PASS |
| target/delivered | `123C9E3BAEB3591DE16DAA9AAD0410CE5BC8A682F129E38429E07786A4A28660` | PASS |
| manifest file | 2,739 bytes / `D708D9E90EF6BAE5931429B552AD7AD51173F7FDF4475CC7E2F68119A9F562A4` | PASS |

virtual artifact의 `bytes=3867`은 41개 파일 내용 합이 아니라 41행 canonical tree 직렬화 byte 수다. 이 해석으로 manifest의 target/delivered가 정확히 재현된다.

### 2.7 TDD RED/GREEN과 미검증 범위

CompletionReport에는 checker가 없을 때 실행한 정확한 RED 명령, exit 1, 예상 `ModuleNotFoundError: No module named 'scripts.check_dependency_boundaries'`가 기록돼 있다. 현재 checker를 삭제하거나 되돌리는 것은 Tester 권한 밖이므로 RED를 재실행하지 않았다. 별도 raw transcript artifact가 없어 RED는 Developer 자기보고 문서 증거로만 확인했다.

GREEN은 fresh 실행으로 `Ran 5 tests ... OK`, exit 0을 재현했다. 하지만 위 false-negative fixture가 exit 0이므로 기존 5개 GREEN은 WorkInstruction 전체 의존 경계 계약을 증명하지 못한다.

제품 API/UI, 브라우저 Network, DB, Docker, WSL/server, 배포는 G-03 범위 밖이며 미실행이다. 이를 PASS로 승격하지 않는다.

### 2.8 progress/HANDOFF

`docs/progress/build-progress.json`은 JSON parse `PASS`다. top-level/current WorkInstruction/G-03 acceptance는 모두 `TEST_REVIEW` 계열이고 `write_lease=null`, active tester=`null`, repository state=`INITIALIZED_MAIN_NO_COMMITS_NO_REMOTES`다. `worker_lease` 속성은 현재 schema에 존재하지 않는다. HANDOFF도 독립 Tester 전 `ACCEPTED` 금지와 다음 안전 행동을 동일하게 기록한다.

## 3. Findings

| ID | 심각도 | finding | 영향 |
|---|---|---|---|
| `G03-DEF-001` | `MAJOR / BLOCKING` | checker가 `groq`, `ollama`, domain 상대 outer-package import를 exit 0으로 통과시킴 | core 의존 방향 계약을 기계적으로 강제하지 못함 |
| `G03-DEF-002` | `MAJOR / BLOCKING` | §25.3 명시 경로 4개 누락, coverage 49/53 | scaffold 100% 완료조건 미충족; 일부는 WI 허용 경로와 상충 |
| `G03-DEF-003` | `MAJOR / BLOCKING` | 허용 경로 밖 `__pycache__/*.pyc` 2개 생성 | write 범위 0건 계약 위반 |
| `G03-DEF-004` | `MAJOR / BLOCKING` | inventory entry file_count 합 3,448 대 선언 3,447 | CompletionReport와 baseline 총계가 부정확하고 manifest revision 필요 |

## 4. 실행 명령·종료 코드·실제 결과

| 명령 | exit | 실제 결과 |
|---|---:|---|
| `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_dependency_boundaries` (`PYTHONDONTWRITEBYTECODE=1`) | 0 | `Ran 5 tests in 0.278s`, `OK` |
| `C:\Users\cyhuh\anaconda3\python.exe -m py_compile scripts/check_dependency_boundaries.py tests/tooling/test_dependency_boundaries.py` (workspace 밖 `PYTHONPYCACHEPREFIX`) | 0 | stdout/stderr 없음 |
| `C:\Users\cyhuh\anaconda3\python.exe scripts/check_dependency_boundaries.py .` | 0 | stdout/stderr 없음; 현재 empty scaffold 위반 0 |
| 임시 fixture: `packages/policy/bad.py=import apps.web`, `packages/domain/bad.py=import fastapi; import docker` 후 checker CLI | 1 | 위반 3건 모두 path:line:import로 출력 |
| 임시 fixture: `packages/domain/provider_leaks.py=import groq; import ollama; from ..policy import rules` 후 checker CLI | 0 | stdout/stderr 없음 — false negative 재현 |
| `git symbolic-ref --short HEAD` | 0 | `main` |
| `git remote` 및 PowerShell count | 0 | 0 |
| `git rev-list --all --count` | 0 | 0 |
| `git ls-files` 및 PowerShell count | 0 | tracked 0 |
| `git diff --cached --name-only` 및 PowerShell count | 0 | staged 0 |
| `git check-ignore -v Backup .anvil_review .codex_qa .tmp_subagent_review` | 0 | 네 경로 모두 `.gitignore` 2~5행에 매칭 |
| `Get-Content -Raw docs/progress/build-progress.json | ConvertFrom-Json` | 0 | parse PASS, `TEST_REVIEW`, `write_lease=null` |

Inventory·virtual tree·manifest 재계산은 다음 canonical 연산을 사용했다.

```powershell
$rows = Get-ChildItem -LiteralPath <tree> -Recurse -File -Force |
  ForEach-Object { <repository-relative path, bytes, Get-FileHash SHA256> } |
  Sort-Object Path
$canonical = [string]::Join("`n", @($rows | ForEach-Object {
  "$($_.Path)`t$($_.Bytes)`t$($_.Hash)"
}))
$sha256 = [Convert]::ToHexString(
  [Security.Cryptography.SHA256]::HashData(
    [Text.UTF8Encoding]::new($false).GetBytes($canonical)
  )
)
```

모든 임시 위반 fixture는 OS temp directory에서 생성·삭제됐고 workspace source, Git index, branch는 수정하지 않았다.

## 5. Evidence hash

| artifact | bytes | SHA-256 |
|---|---:|---|
| `docs/work_orders/G-03_WORK_INSTRUCTION.md` | 5,115 | `6230F3CE3CA99D00AE6B056CDF0DC9155DEEA942487FA23C9566224F12E18641` |
| `docs/evidence/manifests/G-03_EVIDENCE_MANIFEST.json` | 2,739 | `D708D9E90EF6BAE5931429B552AD7AD51173F7FDF4475CC7E2F68119A9F562A4` |
| `docs/baselines/G-03_PRE_SCAFFOLD_INVENTORY.json` | 3,201 | `930D06C40211AA36743F0B692C85AE579A5E5728833EE9CBC7B3F900558CE2C2` |
| `docs/completion_reports/G-03_COMPLETION_REPORT.md` | 4,425 | `D5E771929DD6608CA11CC94872738F3B9A6AA19C6EAA765404A954814DDA332A` |
| `G-03-delivery-tree` | canonical 3,867 | `615D8EE04F9188CD847AD7C0984281B1EDB33766C5A0CD85910E801ED205605B` |
| manifest canonical target | 547 | `123C9E3BAEB3591DE16DAA9AAD0410CE5BC8A682F129E38429E07786A4A28660` |

## 6. 조치

판정 → `FAIL / REWORK_REQUIRED`.

판단 이유 → 보호 자산과 Git 무커밋 상태는 보존됐지만, checker false negative, §25.3 누락, 허용 밖 pycache, inventory 총계 오류가 모두 필수 완료조건을 위반한다.

조치 → Main Agent가 기존 승인 범위를 넓히지 않는 G-03 WorkInstruction revision을 발행해야 한다. revision에는 다음을 포함한다.

1. domain에서 다른 package로 가는 모든 상대 import와 canonical Provider SDK를 차단하는 test-first checker 보완. 가능하면 domain이 사용할 수 있는 표준 라이브러리와 `packages.domain` 내부 import를 allowlist로 정의해 미열거 third-party SDK 우회를 막는다.
2. §25.3의 누락 4경로를 구현 0 원칙에 맞는 빈/주석 전용 scaffold로 처리하도록 허용 경로와 금지선을 명시한다.
3. 정확한 승인 아래 pycache 2개를 제거하고 이후 검증은 bytecode를 workspace 밖으로 보낸다.
4. `pre_scaffold_file_count=3448`로 증거 metadata를 정정하고 inventory·manifest·CompletionReport·progress/HANDOFF·canonical target을 새 revision으로 재생성한다.
5. 수정 후 보호 inventory 전체, 허용 범위, 53개 경로, known/negative fixture, 41-file을 대체하는 새 delivery tree, manifest target, Git 상태를 독립 재검증한다.

그 전에는 G-03 `ACCEPTED`, commit, G-04 시작, push, tag 또는 배포를 금지한다.
