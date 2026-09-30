# F-20/U-01 R20 Next Actions 브라우저 하네스 로컬 결과

## 판정

- `COMPLETED` — R20 계획 작업 1의 로컬 하네스 변경과 지정 검증을 수행했다. WSL-server 실제 PG15/OIDC/Chromium opt-in은 Main의 작업 2로 남는다. U-01/F-20 미수락, C30 `OPEN_BLOCKING` 및 ReleaseDecision `DEFER`는 유지한다.
- 담당 `developer-primary-f20-u01-r20`, 정식 동일 실패보고 0회. 도구·환경 진단 오류는 아래에 별도 기록한다.

## 기준과 변경

- 시작 worktree `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, branch `codex/f18-wsl-ops`, HEAD `5c1f254889539a606e58cd26d19a7f0bbc31848f`, upstream `development/codex/f18-wsl-ops`, 시작 `git status --short --branch` clean. canonical event seq1918, epoch34 worker/write `ACTIVE`, 실행 fence `f20-u01-r20-execution-fence-epoch-34-r20br1001`, 쓰기 fence `f20-u01-r20-write-fence-epoch-34-r20br1001`, 만료 `2026-10-01T04:34:05+00:00`. 시작 G-05 `PASS sequence=1918 reporting=AUTO_CONTINUE`.
- WorkInstruction 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`, R20 계획 `02F24289D7A6DD3AFD772D58037B87F98788C1FA8A26F412281DA13C1651FE95`; 실제 파일 hash 일치.
- `tests/browser/f20-u01-oidc-browser-pg15.mjs`: Dashboard GET 200의 `next_actions` 한 행을 저장 Alerts 및 Python이 전달한 기대 5필드와 대조하고, Next Actions 카드 텍스트 네 필드·행 수를 검사한다. 철회 후 Dashboard 403, 카드 `BLOCKED`/조회 차단/행 0을 검사한다. 기존 Alerts 검사, 3장 스크린샷, 전체 요청 same-origin/secret 검사를 유지한다. 결과에는 상태·건수·일치 boolean만 추가한다. 구현된 메뉴 밖 deep link는 UI에서 텍스트로 표시되므로 링크 값은 API↔저장 alert 사이에서 검증한다.
- `tests/integration/test_f20_u01_oidc_browser_pg15.py`: 합성 운영자 role과 OIDC policy에 기존 `dashboard:read`를 추가하고, 기존 철회 fixture가 이를 제거한다. 저장 `before[0]`에서 기대 조치 5필드만 Node 환경에 전달하고 R6_RESULT의 제한된 신규 사실을 검사한다. 기존 비 opt-in 테스트 fixture도 같은 alert 형태로 맞췄다.
- 제품 API/UI/schema·실계정·Secret 변경 0. 변경 전후 diff는 위 두 파일의 추가/수정 및 이 보고서뿐이며 Main 소유 파일은 변경하지 않았다.

## RED → GREEN 및 명령 기록

| 명령 (worktree 기준, `apps/web` 명령만 그 디렉터리 기준) | 종료 | 실제 결과 |
|---|---:|---|
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` (검증 함수 구현 전) | 1 | `ReferenceError: validateStoredNextAction is not defined` 예상 RED |
| `.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider tests/integration/test_f20_u01_oidc_browser_pg15.py::test_r20_node_receives_only_expected_action_fields_from_stored_alert` (환경 전달 구현 전) | 1 | `KeyError: ANVIL_F20_R6_EXPECTED_ACTION_JSON` 예상 RED |
| `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs` | 0 | 구문 PASS |
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` | 0 | `R6_AUDIT_SELF_TEST_PASS`; 5필드 불일치, 403, DOM 불일치, 철회 후 stale 행 거부 검사 PASS |
| `.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --basetemp=.pytest_tmp_f20_u01_r20_browser tests/integration/test_f20_u01_oidc_browser_pg15.py` | 0 | `17 passed, 1 skipped`; skip은 PG15/OIDC 실제 opt-in 부재 |
| `node --import tsx --test tests/f15-console.test.mjs` | 0 | console 전체 44 PASS |
| `..\..\node_modules\.bin\tsc.cmd --noEmit --project tsconfig.json` | 0 | typecheck PASS |
| `..\..\node_modules\.bin\biome.cmd lint src/console` | 0 | 3 files, 오류 0 |
| `..\..\node_modules\.bin\vite.cmd build --config vite.config.ts` | 0 | 20 modules, build PASS |
| `git diff --check` | 0 | 공백 오류 없음 |

- 최초 집중 pytest는 기본 `C:\Users\cyhuh\AppData\Local\Temp\pytest-of-cyhuh` ACL 거부로 `14 passed, 1 skipped, 3 errors`/exit1이었다. 전용 worktree pytest base를 생성 전 부재 확인하고 재실행해 위 결과를 얻었다. `python` 명령 미등록, `py -3` 미설치, `uv` 기본 cache ACL 거부는 Python 실행기 탐색 오류이며 `.venv`로 해결했다.
- `pnpm --dir apps/web {test:console,typecheck,lint,build}` 4개 호출은 제한된 레지스트리 접근을 시도해 중단(exit1)했다. 동일 스크립트의 기존 로컬 `node_modules` 실행 파일로 위 네 검증을 완료했다. dependency install/설정 변경은 없다.

## 미검증·자원·인계

- 실제 WSL-server 격리 PG15/OIDC/Chromium, Dashboard API↔저장 경고↔DOM의 런타임 결과, screenshot 3장 육안 대조, 전체 페이지 Network 및 secret 노출 증거는 Main의 동일 SHA 작업 2까지 `UNVERIFIED`. 로컬 자기검증과 build만으로 formal E-SHOT/full E-NET 또는 사용자 인수를 선언하지 않는다.
- 전용 `.pytest_tmp_f20_u01_r20_browser`와 빌드 전 부재를 확인한 `apps/web/dist`는 완료 후 root 실경로가 지정 worktree 내부, root non-reparse, 내부 link는 pytest base 안만 가리킴, 해당 테스트 프로세스 종료를 확인했다. 정확한 두 경로만 제거하고 각각 `Test-Path=False`로 잔여 0을 확인했다. WSL/Docker/DB/TLS/스크린샷 자원 생성 0.
- 최종 `node --check`/`--audit-self-test`, `git diff --check`, `.\.venv\Scripts\python.exe scripts/check_project_progress.py` 모두 exit0이며 G-05 `PASS sequence=1918 reporting=AUTO_CONTINUE`. 최종 `git status --short --branch` 변경은 allowed_paths 정확히 세 파일뿐이다. epoch34 dual lease는 최종 확인 시에도 `ACTIVE`였다.
- Main 소유 `docs/WORK_STATUS.md`, progress, HANDOFF, Git commit/push는 갱신하지 않았다. Main은 변경 diff를 독립 검토하고 기존 branch에 기록·push한 같은 SHA에서 WSL 작업 2를 수행해야 한다. rollback은 Main이 후속 Git 기록을 보존한 상태에서 이 두 테스트 파일과 보고서의 R20 변경만 되돌려 R6 하네스로 복귀하는 것이다. 제품 상태 및 지속 데이터 rollback 대상은 없다.
