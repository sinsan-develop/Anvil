# F-20/U-01 R2 Provider Dashboard 제품 결과

## 판정

`COMPLETED` — 지정된 제품 slice의 로컬 RED→GREEN과 Main의 WSL-server exact SHA API·브라우저 검증을 기록했다. WSL 전체 Python suite는 2회 모두 exit 1이므로 전체 GREEN이나 U-01/F-20 수락이 아니다. 실제 Provider 연결 건강과 독립 Tester 인수도 확인되지 않았다. C30 사고는 `OPEN_BLOCKING`, release는 `DEFER`, Production은 `NOT_EXECUTED` 그대로다.

## 시작 기준과 통제

- 작업공간: `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`; branch `codex/f18-wsl-ops`, upstream `development/codex/f18-wsl-ops`, 시작 HEAD `ff31f876073cf7c64d73ebec507e1d5e44e981c8`; 시작 `git status --short --branch` clean.
- canonical progress/HANDOFF seq1786, actor `developer-primary-f20-u01-r2`, epoch12 `ACTIVE` worker `worker-lease-f20-u01-r2-r2start20260928` / write `write-lease-f20-u01-r2-r2start20260928`, expiry `2026-09-28T22:27:01+00:00`. 실행 token `f20-u01-r2-execution-fence-epoch-12-r2start20260928`; 쓰기 token `f20-u01-r2-write-fence-epoch-12-r2start20260928`; 경로 exact3 일치. 착수 G-05 `PASS sequence=1786 reporting=AUTO_CONTINUE`.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 통합매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; WI `842FE2586C3DF28FF5CD67B625E1E021258264C60340A75FA95C3DD763EA8FDE`; Invocation `F6B969A4EF0C0607CC5504B3AC1199BB2EA49BB2300B2883F857170483073168`. 실제 파일 hash와 manifest/progress 기록 일치.

## 변경과 영향

- `apps/web/src/console/App.tsx`: Dashboard에서만 기존 same-origin `GET /api/providers`를 credential 포함 1회 조회한다. 9개 canonical ID의 중복 없는 전체 집합, `REGISTERED/MISSING`, `NOT_CHECKED`만 유효하게 판정해 등록 수와 `NOT CHECKED`를 표시한다. 401/403/5xx, JSON/통신 오류, 빈/불완전/위조 목록은 `UNAVAILABLE`; 응답의 credential 값·내부 주소·오류 원문·기타 필드는 렌더하지 않는다. cleanup에서 abort하고 abort 후 상태 갱신을 막는다.
- `apps/web/tests/f15-console.test.mjs`: 등록 일부/0, 상대 경로와 credentials, 401/403/500, 빈 목록·누락·중복·알 수 없는 ID/상태, network·JSON 실패, Secret/내부주소/READY 비노출을 검증한다.
- Database 카드와 다른 미연결 카드/메뉴, API/auth/DB/routing 계약에는 diff가 없다. 리뷰 보완 후 제품 diff는 위 두 파일에 118줄 추가였고 기존 줄 삭제는 없었다. 본 결과보고서가 세 번째 허용 경로다.

## 실행 증거

| 명령 | 종료 코드·실제 결과 |
|---|---|
| `node --import tsx --test tests/f15-console.test.mjs` (테스트 추가 후, 구현 전) | 1; 기존 4 PASS, 신규 4 FAIL (`loadProviderRegistration is not a function`). 의도한 RED. |
| `node --import tsx --test tests/f15-console.test.mjs` (구현 후) | 0; 8 PASS, 0 FAIL/SKIP. |
| `npm run typecheck` | 0; `tsc --noEmit` 통과. |
| `npm run lint` | 0; console 3파일 검사, 수정 없음. |
| `npm run build` | 0; Vite 20 modules, 산출물 `apps/web/dist/`. |
| `C:\Users\cyhuh\anaconda3\python.exe -B -m scripts.check_project_progress .` (build 직후) | 1; `F20_U01_R2_GIT_INVALID`. build가 새로 생성한 untracked `apps/web/dist/`가 exact3 밖이었다. |
| 같은 G-05 (산출물 정리 후) | 0; `PASS sequence=1786 reporting=AUTO_CONTINUE`. |
| `git diff --check` | 0; 공백 오류 없음. |

빌드 전 시작 status에 없던 `apps/web/dist/`의 해석된 절대경로와 파일 3개(`index.html`, CSS, JS)를 확인한 뒤 해당 폴더만 제거했다. 제거 후 경로가 없음을 확인했다. 테스트 임시 자원·DB·프로세스·컨테이너는 생성하지 않았다.

## 미검증·다음 조치·rollback

- Main은 제품 exact SHA `89d19b34af326ad5f162fae30c8de37eb4f4dcdc`를 WSL-server에서 검증했다. 아래 실측은 격리 QA 범위이고, 실제 외부 Provider 연결 건강·운영 DB READY·화면낭독기 사용성·독립 Tester 수락은 `NOT_EXECUTED`다. 전체 Python suite는 두 번째 실행도 1 FAIL/116 SKIP/14 warning으로 NON-GREEN이다.
- Main의 WSL 임시 자원 정리는 아래 증거로 완료됐다. 다음 조치는 `test_project_progress.py:1189`의 현재 R2/역사 R1b mode 경계를 별도 lease에서 수정·재검증하는 것이다. R2 exact3으로 해당 테스트를 고치거나 U-01 전체/F-20 acceptance로 승격하지 않는다.
- rollback: Main이 변경 commit의 이 두 제품 파일만 이전 HEAD 내용으로 되돌려 Node·web·G-05를 재검증한다. 과거 Event/lease/progress 기록은 되쓰지 않는다.
- `docs/progress/build-progress.json`과 `docs/progress/BUILD_HANDOFF.md`, `docs/WORK_STATUS.md`는 writer exact3 밖이므로 수정하지 않았다. 제품 writer는 commit/push/WSL/merge를 수행하지 않았다. Main의 제품 commit·WSL 실행은 아래에 별도로 기록한다.

## 독립 리뷰 Minor 1 보완

- 리뷰 판정은 Critical 0 / Important 0 / Minor 1이었다. Minor는 카드의 초기 `UNAVAILABLE`에서 비동기 조회 결과로 바뀌는 내용이 화면낭독기에 고지되지 않는 문제였다. `ProviderHealthCard` 제목 아래에 `aria-live="polite" aria-atomic="true"`인 고정 container를 두어 성공·오류 문구가 같은 영역에서 갱신되도록 했다. 다른 카드·메뉴는 변경하지 않았다.
- Node 테스트에 성공 상태와 `UNAVAILABLE` 상태 모두의 live region 검사를 추가했다. 구현 전 `node --import tsx --test tests/f15-console.test.mjs` exit 1, 6 PASS/2 FAIL(두 상태의 live region 부재); 구현 후 동일 명령 exit 0, 8 PASS/0 FAIL/0 SKIP. `npm run typecheck` exit 0, `npm run lint` exit 0(3파일, 수정 없음), `npm run build` exit 0(20 modules) 재실행했다. build가 만든 `apps/web/dist/`의 절대경로와 세 파일을 확인한 뒤 해당 산출물만 제거하고 경로 부재를 확인했다. 실제 화면낭독기 동작과 브라우저 접근성 실측은 Main 후속 검증으로 남는다.
- F-12 owner의 다른 GET payload는 현 R2 WorkInstruction이 지정한 `GET /api/providers`의 canonical `data` 목록 계약 바깥이다. 현 카드에 임의 혼합하지 않으며, 지정한 형태와 다르면 `UNAVAILABLE`로 닫는다. F-12 owner payload와 Dashboard의 계약 접합은 후속 U-01 계약 gap이다. 이를 Provider 건강이나 R2 수락 증거로 승격하지 않는다.
- 산출물 정리 및 본 보고서 갱신 후 `C:\Users\cyhuh\anaconda3\python.exe -B -m scripts.check_project_progress .` exit 0 (`PASS sequence=1786 reporting=AUTO_CONTINUE`), `git diff --check` exit 0. 최종 `git status --short --branch`는 지정된 두 제품 파일 수정과 본 결과보고서 untracked만 표시한다.

## Main WSL-server 동일 제품 SHA 실측 인계

- 제품 commit/WSL 검증 SHA: `89d19b34af326ad5f162fae30c8de37eb4f4dcdc`. 이 보고서 갱신 직전 로컬 `git rev-parse HEAD`도 동일 SHA, `git status --short --branch` clean이었다. 격리 checkout에서 Main이 실행한 정확한 명령과 결과는 다음과 같다.

| WSL 명령 | 종료 코드·결과 |
|---|---|
| `/home/daon/.local/bin/uv run python -B -m scripts.check_project_progress .` | 0; G-05 PASS seq1786. |
| `PATH=/home/daon/.local/opt/node-v22.23.2-linux-x64/bin:$PATH npm ci --ignore-scripts --no-audit --no-fund` | 0; 29 packages added. |
| 같은 Node PATH에서 `npm run test:console --workspace @anvil/web` | 0; 8 PASS. |
| 같은 Node PATH에서 `npm run typecheck --workspace @anvil/web` | 0; typecheck PASS. |
| 같은 Node PATH에서 `npm run lint --workspace @anvil/web` | 0; lint PASS. |
| 같은 Node PATH에서 `npm run build --workspace @anvil/web` | 0; build PASS. |
| `uv run python -B -m pytest tests/api/test_provider_status.py tests/agent_team/test_provider_status.py tests/tooling/test_f20_u01_r2_projection.py --import-mode=importlib --ignore=tests/fixtures/repositories -p no:cacheprovider --basetemp=/tmp/anvil-f20-u01-r2-focused-pytest-89d19b34 -q` | 0; Provider/API 및 R2 control 23 PASS. |
- 격리 `WSL_ACCEPTANCE`의 실제 `GET /api/providers`는 HTTP 200이었다. synthetic `UPSTAGE_API_KEY`의 **존재**로 등록 수는 1/9, health는 `NOT_CHECKED`였다. 비밀값은 기록하지 않는다. `GET /api/health/ready`는 의도적으로 DB 연결이 닿지 않는 환경이어서 HTTP 503이었고 Database READY 증거가 아니다.
- Playwright Chromium headless 1920×1080 및 390×844에서 모두 Provider 카드 `등록 1 / 9`, `연결 상태 · NOT CHECKED`, `aria-live` 1개, Provider 응답 200을 관찰했다. 각 실측의 요청은 모두 same-origin(true, 5건)이었다. 주입한 HTTP 403에서는 `UNAVAILABLE`을 표시했다. 스크린샷 SHA-256은 1920×1080 `fa062aae23a1f4fa60b9fab87f1add0930846c4bb00399e216b5e2c463c11925`, 390×844 `6c1abd83e16cb55ef58a70f7738cd997ed9bac555768b9045a51b967d73a0c07`이다. 화면낭독기 실제 청취는 미실행이다.
- 최초 브라우저 검사는 0/9를 기대해 실패했다. synthetic key가 실제로 1건 등록된 격리 환경이므로 기대값을 1/9로 정정했고 동일 UI 확인은 통과했다. 최초 실패를 제품 실패로 숨기거나 0/9 실측으로 기록하지 않는다.
- 첫 전체 명령 `env PATH=/home/daon/.local/opt/node-v22.23.2-linux-x64/bin:$PATH PYTHONDONTWRITEBYTECODE=1 ANVIL_POSTGRES_VOLUME_TARGET=/var/lib/postgresql/data /home/daon/.local/bin/uv run python -B -m pytest --import-mode=importlib --ignore=tests/fixtures/repositories -p no:cacheprovider --basetemp=/tmp/anvil-f20-u01-r2-formal-pytest-89d19b34 -q`는 exit 1: **7999 passed, 221 failed, 116 skipped, 14 warnings**. 기본 clone에 과거 PR ref가 없어 C30의 `abb736` Git 객체 누락을 확인했다. 제품 HEAD·파일은 바꾸지 않고 `git fetch --quiet development '+refs/pull/*/head:refs/remotes/development/pr/*'`를 실행한 뒤 역사 집중 검사는 16 PASS였다.
- 두 번째 전체 명령은 위 첫 명령의 `--basetemp`를 `/tmp/anvil-f20-u01-r2-formal-retry-pytest-89d19b34`로 바꾸고 `--tb=short`를 추가했다. exit 1: **8219 passed, 1 failed, 116 skipped, 14 warnings**, 1869.73초. 단일 실패는 `tests/tooling/test_project_progress.py:1189`가 현재 mode `F20_U01_R2_PROVIDER_STATUS_START` 대신 역사 `F20_U01_R1B_HISTORY_START`를 요구하는 경계 오류다. 이는 R2 카드 제품 실패로 판정하지 않지만 전체 suite는 NON-GREEN이다. 테스트 파일은 R2 exact3 밖이므로 변경하지 않고 별도 lease 후속으로 남긴다. 116 SKIP/14 warning은 PASS로 승격하지 않는다.
- Main은 임시 API PID `2170287`의 command line 확인 후 종료했고 port `3781`이 더는 열려 있지 않음을 확인했다. web `dist` 3파일을 확인 후 제거하고 G-05 seq1786을 다시 통과했다. 격리 clone, 생성된 pytest base 3곳(역사 focused basetemp는 미생성), curl response 2개, screenshot 2개, missing-commit-list 1개를 각각 realpath 확인 후 정확한 경로로 삭제했다. 최종 `R2_PRODUCT_WSL_RESIDUE_ZERO` exit 0으로 지정 자원 잔류 0을 확인했다.
