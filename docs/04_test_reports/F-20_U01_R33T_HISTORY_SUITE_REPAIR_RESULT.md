# F-20/U-01 R33T 역사 검증 복구 결과

## 최신 판정 — COMPLETED (독립 SPEC 리뷰 보완 범위)

- Important1 영속 public 위조 회귀 및 Minor1 pytest 소유 임시 clone 보완 완료. 9개 파일 전체 44 passed/exit0, R33 CLOSE/current 2 passed/exit0. Main 독립 재검토 전이며 자동 acceptance 아님.
- 아래 최초 인계의 전체 통합 `INTERRUPTED_UNVERIFIED`, WSL·DB 미검증 및 C30 OPEN_BLOCKING/Release DEFER는 해소하지 않았다. 전체 tooling/WSL 및 임시물 정리는 Main 소유다.

## 최초 인계 판정 — INCOMPLETE (구현·집중 검증 완료, 통합 검증 인계)

- Task1~4 test-only 수정 및 집중 GREEN 완료. Windows exact12 통합은 Main 지시로 정상 interrupt하여 `INTERRUPTED_UNVERIFIED`; 통합 PASS 또는 F-20/U-01 acceptance로 주장하지 않는다.
- formal FAILURE_REPORT 0. 예상 RED, 환경 setup/import/의존성 차이 및 Main 지시 interrupt는 정식 제품 실패로 계상하지 않는다.
- Main이 독립 검토 후 동일 SHA WSL 전체 suite와 보존 임시물 정리를 담당한다. Developer의 추가 실행·삭제·commit/push 없음.

- 기준 HEAD: `fdd695f7c4a46b1c70dc215fc77aca2628010c9c`, branch `codex/f18-wsl-ops`, 시작 clean.
- WI SHA256: `D3C1E812CC2669E393A0BB02358EBDC10C54E7FF8BB5C323B0D04AE89E3AE54C`.
- Invocation SHA256: `179987A13759712E800BFC9BE3C4B5AE82ED4FF95FBB9ABD271F2DD4F89075C9`.
- 계획 SHA256: `1BAE23BEFF4090C218C25F4977387DF88ACBABC08B0FAA62213EB130EF180DDD`.
- actor `developer-primary-f20-u01-r33t`, epoch48, worker/write lease suffix `historyfix1003a`, 만료 `2026-10-03T22:30:16+00:00` 직접 확인.
- 정확한 테스트 12개 및 이 결과보고서 외 제품/checker/overlay/원장/Main 상태 파일 변경 금지.
- C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, Production `NOT_EXECUTED` 유지.

## 실행 원칙 및 초기 확인

- executing-plans/TDD 절차에 따라 Task1~4 직렬 진행. 별도 skill ledger/commit 대신 허용된 이 보고서에 기록하며 독립 검토 및 WSL 전체 QA는 Main 소유.
- `C:\Users\cyhuh\anaconda3\python.exe -B -m scripts.check_project_progress`: exit0, G-05 PASS sequence2002.
- 파일 경로 직접 실행은 이 환경의 Python import 경로에서 `scripts.f20_u01_r33t_start_overlay` import 오류(exit1). 제품 수정 없이 모듈 실행으로 검증했다.
- Task1 최초 pytest는 `.tmp_subagent_review` parent 부재로 setup12 ERROR/exit1/0.24s. 환경 오류 1회이며 제품 실패/RED로 세지 않는다. parent 생성 후 전용 basetemp로 재실행.
- 임시 자원: ignored `.tmp_subagent_review/r33t-*`의 로컬 Git fixture만 사용. 정리는 아래 안전 경계에 따라 Main에 인계했다. 외부/WSL/DB/Docker 실행 없음.

## 작업 기록

- Task1 RED: `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_f20_u01_r2_projection.py tests/tooling/test_f20_u01_r2b_projection.py --basetemp=.tmp_subagent_review/r33t-task1-red --tb=short` → exit1, 8 failed/4 passed, 111.79s. 예상한 `F20_U01_R2_PREDECESSOR_INVALID` 및 `F20_U01_R2B_PREDECESSOR_INVALID`만 실패했다.
- 로컬 pytest는 `$env:PYTHONPATH=(Get-Location).Path`를 설정하고 실행한다. 역사 fixture 안의 Git 명령은 테스트 격리 repository에만 적용되며 정본 branch/index/commit은 변경하지 않는다.
- Task1 GREEN: 위 RED 명령에서 basetemp만 `r33t-task1-green`으로 변경 → exit0, 12 passed, 169.31s. R2 2026-09-28 08:00Z/R2b 11:00Z로 고정. public dispatcher는 해당 overlay의 진짜 검증 함수를 고정 now로 감싸며 context 종료 후 원 함수를 복구한다. 발행 직전/정확한 만료/만료 이후 동일 public 경로의 TRANSITION_INVALID 확인.
- Task2 RED: 동일 Python/pytest 공통 flags로 `tests/tooling/test_f20_u01_r3b_projection.py tests/tooling/test_f20_u01_r4_projection.py tests/tooling/test_f20_u01_r5_projection.py tests/tooling/test_f20_u01_r6_projection.py tests/tooling/test_f20_u01_r6b_projection.py tests/tooling/test_f20_u01_r7_projection.py tests/tooling/test_f20_u01_r8_projection.py -k public --basetemp=.tmp_subagent_review/r33t-task2-red --tb=short` → exit1, 7 failed/16 deselected, 60.10s. 일곱 public 정상 assertion에서 해당 route TRANSITION_INVALID 재현.
- Task2 GREEN: 동일 7개 파일 전체, `-k public` 제거, basetemp `r33t-task2-green` → exit0, 23 passed, 226.35s. 실제 overlay 검증을 고정 AT+1초로 감싸고 발행 직전·만료·만료 이후 public 거부 및 context 복구 확인.
- Task3 RED: 공통 Python/pytest flags + `tests/tooling/test_f20_u01_r20_prep_projection.py tests/tooling/test_project_progress.py::ProjectProgressContractTests::test_detached_digest_binds_current_progress_and_handoff_into_manifest_target --basetemp=.tmp_subagent_review/r33t-task3-red --tb=short` → exit1, 2 failed, 10.34s. 현재 seq2002와 역사1914/1918 기대 불일치 및 R33T_PROGRESS_INVALID 대 R33T_PROJECTION_INVALID 재현.
- Task3 GREEN: 같은 선택에 `tests/tooling/test_project_progress.py::ProjectProgressContractTests::test_r33_close_checkpoint_retains_exact_tamper_contract tests/tooling/test_project_progress.py::ProjectProgressContractTests::test_current_u01_route_prefix_rejects_invalid_step_format` 추가, basetemp `r33t-task3-green` → exit0, 6 passed, 51.92s. checkpoint2302980/ebd102f 역사 CLI1914/1918, 현재 CLI2002 분리. R33 CLOSE는 checkpoint9ed778f에서만 주장하며 현재 R33T와 각각 네 종류 위조의 exact 오류를 검증.
- Task4 RED: 공통 Python/pytest flags + `tests/verification/test_c01_l3_independent_acceptance.py::test_registry_and_openapi_have_only_the_approved_execute_semantic_diff --basetemp=.tmp_subagent_review/r33t-task4-red --tb=short` → exit1, 1 failed/1 warning, 1.88s. extra GET /api/dashboard/operations 단일 경로 확인.
- Task4 최초 회귀(전역 Anaconda): C01 전체 + `tests/api/test_f20_u01_r10_dashboard_api.py tests/api/test_f20_u01_r10_oidc_dashboard.py`, basetemp `r33t-task4-green` → exit1, 12 passed/8 skipped/1 failed/1 warning, 1.94s. parent OpenAPI hash가64f5349f로 달랐다. read-only 메모리 재구성으로 immutable a34d12의 당시 API와 registry도 같은 hash를 생성하며 현재 projection과 semantic 차이0임을 확인. 원 상수/제품 schema 수정 없음.
- 환경 판정: 전역 Anaconda FastAPI0.115.0/Pydantic2.9.2와 저장소 .venv FastAPI0.141.1/Pydantic2.13.4 차이. 이후 검증은 저장소 `.venv/Scripts/python.exe`(Python3.13.9/pytest8.4.2)로 통일. 의존성 설치/변경 없음.
- Task4 GREEN: `.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/verification/test_c01_l3_independent_acceptance.py tests/api/test_f20_u01_r10_dashboard_api.py tests/api/test_f20_u01_r10_oidc_dashboard.py --basetemp=.tmp_subagent_review/r33t-task4-venv-green --tb=short` → exit0, 13 passed/8 skipped, 2.14s. DB 미설정 8 SKIP은 미검증. R10 successor 한 개만 추가, 원 parent hash 및 execute 계약 보존, 미승인 임의 경로를 숨기지 않음을 추가 검증.
- Task5: 저장소 .venv exact12 전체 회귀는 2026-10-03 19:55:17 KST 시작, 20:09경 Main 지시로 Ctrl-C 1회 후 exit1. 마지막 확인은 9% 이후 추가 dots이며 실패 traceback 또는 최종 pytest summary는 출력되지 않았다. 정확한 부분 통과 수는 미확정이며 통합 결과는 `INTERRUPTED_UNVERIFIED`. 계획 Task3 전체 tooling 검증도 이 중단에 포함되므로 미완료다.
- 추가 적대 확인: 완료된 Task1/2 GREEN fixture의 9개 역사 public route에서 정상 bundle 검증 후, in-memory event의 마지막 WORKER_LEASE_ISSUED.execution_fencing_token / WRITE_LEASE_ISSUED.write_fencing_token / WORKER_LEASE_ISSUED.actor_id를 각각 `forged-authority`로 변경해 exact route TRANSITION_INVALID를 확인. progress.snapshot_hash=`0`×64는 PRG_SNAPSHOT_HASH_MISMATCH 확인. 각 public 호출은 실제 overlay에 고정 발행+1초만 전달하며 원 함수 복구 확인. 저장소 .venv `-B -` inline probe exit0, 36 PASS. 원문/fixture 파일 mutation0.

## 임시물 정리 안전 경계

- 완료한 Task1~4의 전용 basetemp를 정리하기 전 root 실경로 및 reparse point를 점검했다. `.tmp_subagent_review`와 worktree root는 일반 Directory이며 Task1 RED의 pytest current symlink12개는 모두 해당 RED root 내부를 가리킨다.
- Win32_Process CIM commandline 조회는 접근 거부. Get-Process로 통합 실행 당시 Python PID34360/49780을 확인했다. 과거 Task1~4 tool session은 exit가 모두 수집되었지만 통합 실행은 진행 중이었다.
- 첫 안전 점검은 링크 존재로 중단(삭제0). 명시된 완료 root 내부 symlink 확인 후 정리 명령을 제출했으나 실행 안전 검토가 거부하여 실행되지 않았다(삭제0). 우회·추가 삭제 재시도0.
- Main 지시에 따라 임시물은 보존하고 통합 종료 후 exact root/링크/PID 상태를 read-only 인계한다. cleanup 완료 또는 residue0으로 표시하지 않는다.

### 종료 후 정확한 inventory (2026-10-03 20:09:32 KST)

모든 root는 `Resolve-Path` 결과가 표의 절대 경로와 동일한 일반 Directory다. 재귀 조회는 링크를 따라가지 않았다. 아래 링크 target은 모두 각 root 내부이며 외부 target0이다. 파일 수는 read-only 열거 당시 수치다.

| 절대 root | 파일 | 디렉터리 | 링크 | 외부 target |
|---|---:|---:|---:|---:|
| `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.tmp_subagent_review\r33t-final` | 242805 | 18212 | 35 | 0 |
| `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.tmp_subagent_review\r33t-task1-green` | 80422 | 6060 | 12 | 0 |
| `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.tmp_subagent_review\r33t-task1-red` | 80398 | 6060 | 12 | 0 |
| `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.tmp_subagent_review\r33t-task2-green` | 148450 | 11135 | 22 | 0 |
| `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.tmp_subagent_review\r33t-task2-red` | 47224 | 3542 | 7 | 0 |
| `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.tmp_subagent_review\r33t-task3-green` | 13933 | 1017 | 1 | 0 |

- 통합 tool session62394 exit1 확인 후 `Get-Process -Id 34360,49780 -ErrorAction SilentlyContinue` 출력0: 관찰한 두 Python PID 부재. 모든 시스템 프로세스의 commandline 증명은 CIM 접근 거부로 미검증이다.
- `git check-ignore .tmp_subagent_review/r33t-final`은 해당 경로를 반환. 위 inventory 외 task3-red/task4-* root는 존재하지 않았다. 삭제0, 우회 재시도0 유지.

## 최종 검증 명령과 범위

모든 명령의 cwd는 `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`. 통합 명령은 다음과 같으며 exit1/INTERRUPTED_UNVERIFIED다.

```powershell
$env:PYTHONPATH=(Get-Location).Path
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_f20_u01_r2_projection.py tests/tooling/test_f20_u01_r2b_projection.py tests/tooling/test_f20_u01_r3b_projection.py tests/tooling/test_f20_u01_r4_projection.py tests/tooling/test_f20_u01_r5_projection.py tests/tooling/test_f20_u01_r6_projection.py tests/tooling/test_f20_u01_r6b_projection.py tests/tooling/test_f20_u01_r7_projection.py tests/tooling/test_f20_u01_r8_projection.py tests/tooling/test_f20_u01_r20_prep_projection.py tests/tooling/test_project_progress.py tests/verification/test_c01_l3_independent_acceptance.py --basetemp=.tmp_subagent_review/r33t-final --tb=short
```

- 종료 후 `.\.venv\Scripts\python.exe -B -m scripts.check_project_progress`: exit0, `PASS sequence=2002 reporting=AUTO_CONTINUE`.
- `git diff --check`: exit0. `git diff --cached --exit-code`: exit0/staged0. 사용자 Git ignore 경로 접근 경고는 별도 환경 경고이며 설정 변경하지 않았다.
- builtin compile 검증: `.\.venv\Scripts\python.exe -B -`에 아래 inline 코드를 전달, exit0/`COMPILE_12_PASS PROTECTED_BYTES_UNCHANGED`. pyc 생성 없음.

```python
from pathlib import Path
import subprocess
paths = subprocess.check_output(['git', 'diff', '--name-only'], text=True).splitlines()
assert len(paths) == 12
for name in paths:
    compile(Path(name).read_bytes(), name, 'exec')
for name in ('scripts/check_project_progress.py', 'packages/api/fastapi_app.py',
             'packages/api/registry.py', 'docs/progress/build-progress.json',
             'docs/progress/progress-events.json'):
    assert Path(name).read_bytes() == subprocess.check_output(['git', 'show', 'HEAD:' + name]), name
print('COMPILE_12_PASS PROTECTED_BYTES_UNCHANGED')
```

## 변경·잔여 위험·조치

- 변경은 WI의 테스트12 + 본 보고서1 정확13개. tracked test diff는 267 insertions/27 deletions. 제품 API/checker/overlay/원장/Main 상태 파일 변경0, 정본 branch/index/commit/push 변경0.
- R2/R2b 및 R3b~R8은 테스트 호출의 역사 시계만 고정; 실제 validator를 실행하고 발행 직전/만료/만료 이후 거부를 보존한다. R20 역사1914/1918과 current2002, R33 CLOSE1998과 currentR33T를 각각 독립 검증한다. C01은 승인된 R10 GET 하나만 허용하며 원 parent hash 및 임의 route 거부를 보존한다.
- 로컬 집중 결과: Task1 12P, Task2 23P, Task3 6P, Task4 관련13P/8S, 별도 적대36PASS. 서로 다른 명령 결과를 전체 suite 수치로 합산하지 않는다.
- 미검증: 중단된 Windows exact12 전체, Main 소유 WSL 동일 SHA 전체, DB opt-in8, 실제 Provider/UI/browser/Production. 전역 Anaconda와 repo venv의 OpenAPI 생성 차이는 확인됐으므로 Main WSL 검증도 승인된 의존성 기준을 확인해야 한다.
- 임시물 6개 root 보존 및 전체 commandline 확인 제한은 잔여 환경 위험이다. Main이 정확 경계와 프로세스를 확인한 후 정리하며 Developer는 삭제를 추가 시도하지 않는다.
- rollback: Main이 사용자 변경과 분리하여 이 정확13개 diff만 검토·역적용할 수 있다. 역사 manifest/Event, 제품 및 원 hash는 변경하지 않았으므로 데이터 migration rollback 없음. 실제 rollback 미실행.
- progress/HANDOFF/WORK_STATUS는 Main 소유로 수정하지 않았다. C30 OPEN_BLOCKING, F-20/U-01 미수락, ReleaseDecision DEFER, Production NOT_EXECUTED 유지.

## 독립 SPEC 리뷰 대응 — Important1 / Minor1 (2026-10-03)

- Main이 기존 결과를 반영한 HEAD `77730ced4cbad45c9ff7c89bd808df84aaf23ba2` / 동일 branch / clean에서 재개했다. epoch48 actor·worker/write token·exact13·만료 `2026-10-03T22:30:16Z`를 현재 projection과 직접 대조하고 G-05 seq2002 PASS 확인 후 썼다. 별도 commit/push 없음.
- receiving-code-review/TDD 절차로 실제 public dispatcher의 역사 정상·거부를 검증한다. 이전 inline 적대36만으로 영속 회귀가 충족된다고 보지 않고 해당 9개 테스트 파일에 public 위조 테스트를 각각 추가했다.
- 각 route에서 정상 bundle PASS 전후 사이에 execution token, write token, actor, baseline commit, WorkInstruction hash, predecessor event, progress snapshot hash를 독립 deepcopy하여 위조한다. 토큰/actor/baseline/WI hash는 exact route TRANSITION_INVALID, predecessor는 route별 PREDECESSOR_INVALID 또는 TRANSITION_INVALID, snapshot은 PRG_SNAPSHOT_HASH_MISMATCH를 요구한다. 실제 overlay 함수는 그대로 실행하며 public 호출 안에서만 역사 시각을 전달한다.
- Minor: R33 CLOSE clone을 repository-root 직접 생성 경로에서 pytest가 소유한 `tmp_path/repository`로 옮겼다. 기존 exact tamper 계약/역사 checkpoint는 유지한다. 테스트 자체는 repository-root 임시 parent를 생성하지 않는다.
- RED 전 첫 실행은 Main cleanup 후 `.tmp_subagent_review` parent 부재로 setup10ERROR/exit1/5.27s. 환경 오류로 분리하고 전용 parent 생성 후 재실행했다. 기존 임시물 삭제·우회 재시도는 하지 않았다.
- 실제 RED: 아래 선택으로 exit1, 10 failed/93.38s. 9개 public 정상 bundle은 현재 wall-clock 때문에 exact route TRANSITION_INVALID, R33 CLOSE는 pytest tmp_path가 아닌 parent라는 assertion에서 실패했다. 제품 결함으로 계상하지 않는다.

```powershell
$env:PYTHONPATH=(Get-Location).Path
$nodes=@('2','2b','3b','4','5','6','6b','7','8' | ForEach-Object { "tests/tooling/test_f20_u01_r$($_)_projection.py::test_r$($_)_public_history_rejects_authority_forgery" })
$nodes += 'tests/tooling/test_project_progress.py::ProjectProgressContractTests::test_r33_close_checkpoint_retains_exact_tamper_contract'
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib @nodes --basetemp=.tmp_subagent_review/r33t-review-red --tb=short
```

- GREEN 첫 실행: 위 명령의 basetemp만 `r33t-review-green`으로 변경 → exit1, 9 passed/1 failed, 215.37s. public 위조9개/63개 거부 assertion은 통과. R33 CLOSE는 tmp_path 아래 추가 TemporaryDirectory 중첩으로 Git checkout `Filename too long` 환경 오류. 추가 중첩을 제거하고 pytest 소유 경로로 단순화했으며 validator/기대값/전역 Git 설정은 변경하지 않았다.
- CLOSE/current GREEN: 아래 명령 exit0, 2 passed/20.09s.

```powershell
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_project_progress.py::ProjectProgressContractTests::test_r33_close_checkpoint_retains_exact_tamper_contract tests/tooling/test_project_progress.py::ProjectProgressContractTests::test_detached_digest_binds_current_progress_and_handoff_into_manifest_target --basetemp=.tmp_subagent_review/r33t-review-close --tb=short
```

- 기존 positive/boundary 및 신규 위조 전체 회귀 실행 명령:

```powershell
$env:PYTHONPATH=(Get-Location).Path
$files=@('2','2b','3b','4','5','6','6b','7','8' | ForEach-Object { "tests/tooling/test_f20_u01_r$($_)_projection.py" })
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib @files --basetemp=.tmp_subagent_review/r33t-review-regression --tb=short
```

- 위 9파일 전체 회귀: **exit0, 44 passed, 598.41s**, skip0. 신규 public9개에 각7종의 독립 위조 assertion(63개)과 정상 bundle 전후 PASS가 포함됐다. 기존 positive/expiry/직접 overlay 거부 검사는 삭제·완화하지 않았다.
- fresh G-05 명령 `.\.venv\Scripts\python.exe -B -m scripts.check_project_progress`: exit0, seq2002 PASS. builtin `compile(Path(name).read_bytes(), name, 'exec')`로 변경 Python10개 구문 PASS/exit0, `git diff --check` exit0, staged0. checker/제품/overlay/원장 mutation0. review 범위는 테스트10+보고서1이며 허용13 안이다.
- 최초 집중36 inline 증거는 보존하되 이번 영속63 assertion을 그 대체 회귀로 추가했다. RED 및 두 환경 오류(parent 부재/MAX_PATH)는 formal FAILURE_REPORT가 아니며 count0 유지.
- 전체 tooling/WSL/full suite는 Main 지시에 따라 재실행하지 않았다. Python/패키지 의존성 변경0. Main 독립 diff 및 동일 SHA 전체 검증 필요.

### 리뷰 실행 종료 후 임시물 인계

2026-10-03 20:56:26 KST, session32903 exit0 뒤 `Get-Process -Id 17664,35248 -ErrorAction SilentlyContinue`는 둘 다 부재. 아래 root 모두 일반 Directory/Resolve-Path 동일, link target은 자기 root 내부이며 외부0. 삭제는 시도하지 않았다. 아래는 이번 리뷰에서 만든 root이며 과거 inventory와 별도다.

| 절대 root | 파일 | 디렉터리 | 링크 | 외부 target |
|---|---:|---:|---:|---:|
| `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.tmp_subagent_review\r33t-review-close` | 7150 | 509 | 1 | 0 |
| `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.tmp_subagent_review\r33t-review-green` | 60812 | 4554 | 10 | 0 |
| `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.tmp_subagent_review\r33t-review-red` | 60812 | 4554 | 10 | 0 |
| `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.tmp_subagent_review\r33t-review-regression` | 290398 | 21747 | 43 | 0 |

- rollback은 Main이 이번 HEAD77730ced 대비 정확11개 diff만 선택 역적용하는 방식이며 실제 실행0. 신규 lease/progress/WORK_STATUS/commit/push 작성0. 최종 수락 및 cleanup 판단은 Main에 인계한다.

## Main 출처 후속 증거 — WSL-server 동일 SHA 전체 QA

이 단락은 Main이 직접 실행·확인하여 전달한 결과다. Developer의 WSL 실행 또는 독립 재실측으로 주장하지 않는다. 기록 전 epoch48 actor/두 fencing token/exact13/만료 유효성을 다시 확인했다. 기존 `docs/WORK_STATUS.md` dirty는 보존하고 본 보고서만 누적 수정했다.

- private/검증 SHA: `8c0af9638d1e52fb29a1010a42f457b4448c0655`.
- 전용 checkout: `/tmp/anvil-f20-full-8c0af96`. 실행 전 clean/exact SHA/G-05 seq2002 PASS.
- 환경: uv frozen dev offline, 43 packages, Python3.14.3/pytest8.4.2, Node22 PATH. `ANVIL_POSTGRES_VOLUME_TARGET=/var/lib/postgresql/data`.
- cwd는 위 WSL 전용 checkout이며 전체 실행 명령은 다음과 같다.

```sh
.venv/bin/python -B -m pytest -q --tb=short -p no:cacheprovider --import-mode=importlib --ignore=tests/fixtures/repositories --basetemp=/tmp/anvil-f20-full-pytest-8c0af96
```

- **exit0: 8581 passed, 120 skipped, 14 warnings in 1878.32s (0:31:18)**.
- 종료 후 clean/exact SHA/G-05 seq2002 재확인, 실행 PID1132833 부재. checkout242M/pytest base15G를 확인했다.
- Main은 `/tmp` 실경로와 두 정확한 대상의 non-link 경계를 확인한 뒤 `/tmp/anvil-f20-full-8c0af96` 및 `/tmp/anvil-f20-full-pytest-8c0af96`만 제거하여 residue0을 확인했다. 이 cleanup 증거는 해당 WSL 두 경로만 의미하며 앞선 Windows 임시 root 정리까지 자동 증명하지 않는다.
- read-only ps probe에서 awk quoting 오류1회가 있었고 효과는 없었으며 후속 ps 확인은 성공했다. 이는 Main 실행 진단 오류이며 제품 실패 또는 formal FAILURE_REPORT로 계상하지 않는다.
- 이전 b996798 전체 suite의 18 failed는 R33T 후 동일 SHA WSL 전체 실행에서 재발하지 않았다. 앞선 Windows 통합 interrupt 기록은 그대로 보존하며, 이번 Main WSL 전체 PASS와 구분한다.
- **검증 한계 유지:** 120 SKIP을 PASS로 승격하지 않는다. DB opt-in/실제 browser/Provider/Production acceptance를 추론하지 않는다. C30 OPEN_BLOCKING, F-20/U-01 REWORK, ReleaseDecision DEFER, Production NOT_EXECUTED 유지.
- Developer 후속 조치: 보고서 한 파일만 수정, WSL/제품/control/WORK_STATUS/commit/push 변경0. 최종 수락은 Main 판정 소유다.
