# F-20/U-01 R33 운영 카드 화면 골격 결과

## 판정

`COMPLETED` — Developer 지정 범위의 Dashboard 2행 화면 골격과 로컬 검증을 완료했다. 여섯 운영 수치와 소스는 여전히 `UNAVAILABLE`이며 U-01/F-20 인수 판정이 아니다. Main의 독립 diff 검토, 정확 SHA WSL-server PG15/OIDC/HTTPS/Chromium 실제 브라우저·Network 검증은 미실행이다. C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, Production `NOT_EXECUTED`를 유지한다.

## 기준·소유권

- Work Package `F-20/U01-R33`; actor `developer-primary-f20-u01-r33`; worktree `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`.
- 착수 branch `codex/f18-wsl-ops`, upstream `development/codex/f18-wsl-ops`, clean HEAD `ffa337236e7393accd9b2469a2c60b510b8251bc`. Main dispatch의 private/WSL 동일 SHA는 Developer가 원격을 재검증하지 않은 인수 정보다. Lease의 `baseline_git_commit`/`dispatch_head` `4f6a01f2e883fbbbd65a2900ca7aa48ffad8d0a2`가 착수 HEAD의 조상임을 `git merge-base --is-ancestor` exit 0으로 확인했다.
- canonical `docs/progress/build-progress.json`/HANDOFF Event seq1996, `ACTIVE`, epoch47. worker/write actor·subject `F-20/U01-R33`·정확 4경로 일치. 발급 `2026-10-03T03:56:51+00:00`, 만료 `2026-10-03T15:56:51+00:00`. execution token `f20-u01-r33-execution-fence-epoch-47-20c604e630935161`, write token `f20-u01-r33-write-fence-epoch-47-20c604e630935161`.
- SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 검증매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; R33 계획 `19BAD417C1D87A8057FA5F96146D768162D2C1FC05FF236FCB8896E3C58CFD21`; WI `D34E117D45405B97ED4A509EA0EF425019264BB3131849CC8C9A5E8C0BA5B21B`; Invocation `8FC7BE8C6A824BCFCFCE1AAE5BBE84F638479A86DED88EEFA7FE9D9E5B2B639A`.
- 제품 write 전 `scripts/check_project_progress.py .` 결과 `PASS sequence=1996 reporting=AUTO_CONTINUE`. 기준 hash와 원장 결박을 확인했다.

## 변경과 영향

- `apps/web/tests/f15-console.test.mjs`: 실제 App 렌더의 2행 여섯 카드 제목·설계 순서·`UNAVAILABLE`·미연결 사유, 값·링크·버튼 부재, Health→운영→Next Actions→Critical Alerts 순서를 검증한다. 기존 단일 설명 문구에 묶인 두 회귀 단언을 현재 카드 표시로 갱신했다.
- `apps/web/src/console/App.tsx`: 기존 `DASHBOARD_OPERATION_DEFINITIONS`를 순서 그대로 사용하고 기존 `status-grid`에 여섯 `status-card`를 표시한다. 각 카드의 내용은 제목, `UNAVAILABLE`, read model 미연결 사유 3가지뿐이다. 새 API 호출·수치 추론·클릭 동작은 없다.
- `tests/browser/f20-u01-oidc-browser-pg15.mjs`: 기존 실제 OIDC Dashboard 흐름의 로그인 전·저장·권한 철회 단계에서 여섯 카드의 순서, 정확한 비가용 표현, 값·링크·버튼 부재를 확인한다. screenshot/Network evidence key·파일명·요청 allowlist는 변경하지 않았다.
- 이 결과보고서만 추가 갱신한다. Main 소유 progress/HANDOFF/WORK_STATUS/control, 사용자 자료 및 다른 제품 경로는 수정·stage·삭제하지 않았다. commit/push/PR/merge/WSL/Docker/DB/ysna/Production은 하지 않았다.

## RED→GREEN 및 검증

| 단계 | 정확한 명령·환경 | Exit | 실제 결과 |
|---|---|---:|---|
| RED | `node --import tsx --test --test-name-pattern "Dashboard second row shows six ordered" tests/f15-console.test.mjs` (`apps/web`) | 1 | 새 테스트 1건 예상 실패: 기존 운영 section에 `status-grid` 부재 |
| GREEN | 위 동일 명령 | 0 | 대상 1/1 PASS |
| Console 전체 | `npm run test:console` (`apps/web`) | 0 | 59/59 PASS; 기존 Health/Next Actions/Critical Alerts/권한·loading·cancel·reconnect 회귀 포함 |
| Browser 문법 | `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs` | 0 | 문법 PASS |
| Browser audit | `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` | 0 | `R6_AUDIT_SELF_TEST_PASS`; 실제 Chromium 실행 증거는 아님 |
| Web typecheck | `npm run web:typecheck` | 0 | TypeScript 오류 없음 |
| Web lint | `npm run web:lint` | 0 | 3 files checked, no fixes |
| Web build | `npm run build --workspace @anvil/web -- --outDir D:/Project/Anvil/.worktrees/anvil-f18-wsl-ops/.r33_web_build` | 0 | Vite 20 modules 변환, build PASS |
| Python 관련 비 opt-in | `& '.\.venv\Scripts\python.exe' -m pytest -q -p no:cacheprovider tests/integration/test_f20_u01_oidc_browser_pg15.py -k 'not opt_in' --basetemp D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.r33_pytest_tmp` (`PYTHONDONTWRITEBYTECODE=1`, `PYTHONUTF8=1`) | 0 | 34 passed, 3 deselected |
| G-05 최종 | `& '.\.venv\Scripts\python.exe' scripts/check_project_progress.py .` (동일 Python 환경변수) | 0 | `PASS sequence=1996 reporting=AUTO_CONTINUE` |
| Diff | `git diff --check` | 0 | 출력 없음 |

검증 중 설치된 `python`이 PATH에 없어 초기 G-05 명령이 실행되지 않았다. 번들 Python으로 착수 전 G-05 PASS를 확인했고 프로젝트 `.venv`로 최종 검사했다. build/pytest 임시 출력이 남은 동안 G-05는 `F20_U01_R33_GIT_INVALID` exit 1을 냈다. 전용 `.r33_pytest_tmp`, `.r33_web_build`의 실제 root가 worktree 내부이며 root link 0, pytest 내부 symlink 2개의 target이 같은 임시 root 내부임을 확인하고 정확한 두 root만 삭제했다. 잔여 0 뒤 G-05 재실행 PASS. 이들은 제품/정식 실패가 아닌 로컬 명령·임시 출력 환경 조치이며 동일 근본 원인 정식 FAILURE_REPORT 횟수 0이다.

## 미검증·잔여 위험·rollback·인계

- 실제 OIDC/HTTPS/Chromium, PG15/DB, browser Network, WSL-server 동일 clean SHA, 1920×1080 실제 화면은 Main 후속 범위이며 이 로컬 결과로 PASS를 주장하지 않는다.
- 여섯 카드의 실제 read model·필터·Critical 확인 동작, U-01 독립 acceptance, F-20 최종 smoke/Monitoring/복구, Production은 미검증·미수락이다. 공개 API/DB/인증/Secret/지속 데이터는 변경하지 않았다.
- 회귀 시 Main이 R33 제품 변경만 정상 Git revert한다. append-only Event prefix, R32 결과, 기존 dirty/untracked 자료는 보존한다.
- Main이 정확 4파일 diff와 로컬 결과를 독립 검토하고 commit/private push 후 동일 SHA의 격리 WSL-server 실제 QA를 수행한다. progress/HANDOFF 갱신은 Main 소유로 Developer가 수행하지 않았다.
