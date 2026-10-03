# F-20/U-01 R32 Next Actions 경과시간 결과

판정: `COMPLETED` (Developer의 local exact5 구현·재작업·검증). Main의 동일 clean SHA WSL-server PG15/OIDC/HTTPS/Chromium 첫 opt-in 실행은 Python evidence 분류에서 실패했고, 수정 SHA의 실제 재검증은 `PENDING`이다. U-01/F-20 인수 판정이 아니다.

## 판단 이유

- 시작 기준: worktree `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, branch `codex/f18-wsl-ops`, clean HEAD/private/WSL-control `ffc05b493c2b99fd364665fd74a4a507f84dd87f`. Canonical R32 plan/WI/invocation SHA-256은 각각 `A0C364E9067764D55FE138F77C524F41B3DA8BF1A2CB1405FC1DB4B98AA2CA68` / `5D168C3F0F7712422B9AB4DC713852F035FC2946EA52113C9FB92208CC409473` / `09E46BBFA37B95922C7D0D15DBA4014CD33ED3189962CA34E3D9B8E2F821FACF`로 dispatch와 일치했다. `build-progress.json`/HANDOFF seq1990, epoch46 ACTIVE worker/write, actor `developer-primary-f20-u01-r32`, 정확5 path, 실행·쓰기 fencing token 일치, 만료 `2026-10-03T13:58:58+00:00` 확인 후 제품 write를 시작했다. Lease의 `baseline_git_commit=b0296d81`은 직계 start checkpoint `ffc05b49`의 부모로 확인했다.
- 제품 변경: `apps/web/src/console/App.tsx`에서 같은 Dashboard snapshot의 미해결 alert와 Next Action 다섯 필드를 완전 일치·고유 매칭하고, 유효한 전체 alert 식별/시각과 현재보다 미래가 아닌 snapshot일 때만 `snapshot.observed_at - alert.observed_at`의 정수 분을 표시한다. 중복·누락·부분 alert·불량/미래 시각은 `경과시간 확인 불가`; 0분은 실제 1분 미만의 고유 매칭에서만 허용한다. 기존 same-origin GET, 응답 필드, 자동 요청·타이머는 변경하지 않았다.
- 테스트 변경: `apps/web/tests/f15-console.test.mjs`에서 다섯 필드 불일치·중복·resolved 제외·부분/미래 시각·실제 0분과 권한·429·취소·재연결 보호를 확인한다. `tests/browser/f20-u01-oidc-browser-pg15.mjs`는 실제 저장 snapshot의 alert/action/DOM 경과시간 및 기존 alert API 시각을 결박하는 `elapsedEvidence`를 추가했다. `tests/integration/test_f20_u01_oidc_browser_pg15.py`는 exact key/type/value 및 적대 변경을 검증한다. 실제 browser Network/Secret 기존 evidence는 유지했다.

## 조치·검증 기록

| 명령 | exit | 관측 결과 |
|---|---:|---|
| `node --import tsx --test --test-name-pattern='Dashboard Next Actions elapsed\|Dashboard Next Actions ambiguous' tests/f15-console.test.mjs` (apps/web) | 1 | 새 2건 예상 RED: 경과시간 행 부재 |
| `.\.venv\Scripts\python.exe -m pytest -q tests/integration/test_f20_u01_oidc_browser_pg15.py -k r32_elapsed_evidence --basetemp D:\tmp\anvil-r32-pytest-red` | 1 | 예상 RED: `_r32_elapsed_evidence` 미정의 1건 |
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` (구현 전) | 1 | 예상 RED: `validateStoredElapsed` 미정의 |
| `node --import tsx --test --test-name-pattern='Dashboard Next Actions elapsed\|Dashboard Next Actions ambiguous\|Dashboard Next Actions rejects elapsed' tests/f15-console.test.mjs` (apps/web) | 1 | 추가 RED: 부분 alert와 미래 snapshot이 숫자로 표시되는 2건 |
| `npm run test:console --workspace @anvil/web` | 0 | 58/58 PASS, R31 상태 회귀 포함 |
| `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs` | 0 | 문법 PASS |
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` | 0 | `R6_AUDIT_SELF_TEST_PASS`, R32 elapsed positive/negative 포함 |
| `.\.venv\Scripts\python.exe -m pytest -q tests/integration/test_f20_u01_oidc_browser_pg15.py -k 'not opt_in' --basetemp D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.r32_pytest_tmp` | 0 | 33 PASS, 3 deselected |
| `npm run web:typecheck` | 0 | TypeScript PASS. 최초 시도는 snapshot.alerts narrowing 오류 exit1, cast 1줄 보정 후 PASS |
| `npm run web:lint` | 0 | 3 files checked, no fixes |
| `npm run build --workspace @anvil/web -- --outDir D:/Project/Anvil/.worktrees/anvil-f18-wsl-ops/.r32_web_build` | 0 | Vite 20 modules build PASS |
| `.\.venv\Scripts\python.exe scripts/check_project_progress.py .` | 0 | G-05 `PASS sequence=1990 reporting=AUTO_CONTINUE` |
| `git diff --check` | 0 | 출력 없음 |

첫 Python 전체 실행의 `--basetemp D:\tmp\anvil-r32-pytest-all`은 Windows ACL로 setup 2 ERROR, 31 PASS/3 deselected, exit1이었다. 제품 결함이 아니며 위 worktree 소유 전용 경로 재실행에서 33 PASS를 확인했다. RED/GREEN의 `D:\tmp\anvil-r32-pytest-red/green`과 실패한 `all`은 생성되지 않았다. 생성 전 부재를 확인한 `.r32_pytest_tmp`와 `.r32_web_build`는 작업자가 만든 출력물만 포함했고, symlink target/경로를 확인해 정확 두 root만 제거한 뒤 잔여0을 확인했다. 정식 실패 횟수 0, 검증 중 환경/타입 오류 2건은 위와 같이 해소했다.

## 인계·미검증·rollback

- Developer 제품 write는 정확 4개 코드/테스트 파일과 이 결과보고서 1개다. Main이 동시 수정 중인 `docs/WORK_STATUS.md`는 건드리지 않았다. Git commit/push/WSL-server/DB/Docker/progress/HANDOFF/control/main/Production 변경0.
- Main이 첫 exact5 checkpoint/private push를 수행한 뒤 clean SHA `3930469024f085129d997820f1d76edf2ca1575a`의 WSL-server 격리 PG15/OIDC/HTTPS/Chromium opt-in을 실행했다. 결과 `1 failed, 2 passed, 33 deselected`이며 제품/브라우저 실행 후 Python `_r28_manual_evidence`의 `R28_BROWSER_EVIDENCE_MISMATCH`에서 중단됐다. 브라우저 화면·Network·Secret 증거와 전용 자원 정리의 최종 PASS는 이 실행으로 주장하지 않는다. 수정 SHA 동일 환경 실제 재검증은 Main 담당 `PENDING`이다.
- rollback: Main이 R32 exact5 checkpoint를 정상 `git revert`하고 기존 R31 Event prefix와 다른 dirty 자료를 보존한다. 현 시점 미커밋 재작업은 Python 테스트 파일과 이 결과보고서의 R32 범위만 검토해 처리한다.

## WSL 첫 실패에 따른 Main 리뷰 재작업

- 재작업 시작: branch `codex/f18-wsl-ops`, clean HEAD/private/WSL QA 대상 `3930469024f085129d997820f1d76edf2ca1575a`; canonical epoch46 dual lease와 exact5 scope는 계속 ACTIVE였다. Main의 실제 WSL stack상 새 `elapsedEvidence`가 R28 후보에 남아 R28 exact-key 계약에 의해 거부됐고, 그 뒤의 R32 helper 검증에는 도달하지 못했다.
- `tests/integration/test_f20_u01_oidc_browser_pg15.py`만 수정했다. R28 후보 집합을 작은 함수로 추출해 실제 선택 코드를 테스트하고, 다른 분류 유지 상태에서 `elapsedEvidence` 하나만 제외했다. 새 테스트는 최초 `NameError` RED(exit1), 기존 분류식 추출 후 실제 `R28_BROWSER_EVIDENCE_MISMATCH` RED(exit1), 제외 후 GREEN(exit0) 순서로 확인했다. 정식 `FAILURE_REPORT`가 아닌 Main 리뷰 재작업이다.
- 로컬 명령: `.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider tests/integration/test_f20_u01_oidc_browser_pg15.py -k 'r32_elapsed_evidence_does_not_contaminate_r28_manual_candidate or r32_elapsed_evidence_requires_exact_snapshot_alert_and_display or r28_manual_refresh_evidence_requires_exact_keys_values_and_observation'` exit0 `3 passed, 34 deselected`; 같은 파일 `-k 'not opt_in' --basetemp D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.r32_pytest_review` exit0 `34 passed, 3 deselected`; `.\.venv\Scripts\python.exe scripts/check_project_progress.py .` exit0 `PASS sequence=1990 reporting=AUTO_CONTINUE`; `git diff --check` exit0.
- 전용 `.r32_pytest_review`는 생성 전 부재, 소유 worktree 경로, 내부 symlink 대상 확인 후 이 root만 삭제해 잔여0이다. 다른 코드, Git commit/push, WSL 자원/DB/브라우저, WORK_STATUS/control에는 손대지 않았다. 첫 WSL 실패의 실제 재검증은 Main이 새 clean SHA에서 수행한다.

F-20/U-01 전체 미수락, C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, Production `NOT_EXECUTED` 유지.
