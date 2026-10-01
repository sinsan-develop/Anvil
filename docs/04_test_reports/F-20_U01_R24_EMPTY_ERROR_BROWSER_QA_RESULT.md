# F-20/U-01 R24 빈 결과·오류 브라우저 QA Developer 결과

## 판정

`INCOMPLETE` — Main의 첫 WSL-server PostgreSQL 15/OIDC/Chromium opt-in이 `STORED_NEXT_ACTION`에서 실패했다. 아래의 진단 재작업은 로컬 GREEN이지만 저장 Dashboard 재조회 응답과 UI 상태의 불일치를 실제 WSL에서 다시 분리해야 한다. U-01/F-20 또는 C30 완료 판정이 아니다.

## R24 WSL 1차 실패·진단 재작업 checkpoint

- Main의 동일 SHA `58c0b75c5e2468b840bde9e334173277d3053950` 격리 QA는 실제 `STORED_NEXT_ACTION`/`TimeoutError`에서 실패했다. 선행 저장 Alert API 200, 저장 Dashboard 직접 API 200/`next_actions` 1건, Alert DOM 1행을 지났으나 저장 Next Actions DOM 1행을 10초 안에 보지 못했다. Python stage whitelist 누락으로 외부 오류는 `NODE_UNHANDLED`로 오분류됐다. 제품 PASS나 R24 PASS가 아니다.
- 확인된 결함: Python에 `STORED_NEXT_ACTION`을 whitelist로 추가하고 안전 진단의 정수 상태·제한된 개수·DOM enum만 실패 메시지에 허용한다. 비밀값·URL·응답 본문·화면 원문은 출력하지 않는다.
- 미확정 원인: 직접 API의 1건과 브라우저 reload가 받은 응답이 같은지, reload 응답은 유효하나 UI의 전체 snapshot 분류가 `UNAVAILABLE`인지, 렌더 시점 문제인지 아직 구분되지 않았다. 제품 UI/API/DB 계약·단언을 완화하지 않았다.
- 브라우저 하네스는 실패 시에만 직접 API와 reload 응답의 HTTP status/`next_actions` 개수(0~100 또는 `INVALID`) 및 Next Actions DOM 상태(`ROW/EMPTY/LOADING/BLOCKED/UNAVAILABLE/OTHER`)를 `R24_STORED_UI_DIAG` 한 줄로 출력한다. `finally`의 기존 자원 정리 경계는 유지한다.
- 예상 RED: `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` exit 1 `ReferenceError: safeDashboardSummary is not defined`; `.\.venv\Scripts\python.exe -m pytest tests/integration/test_f20_u01_oidc_browser_pg15.py -q -k 'r6_browser_failure_classification or r24_stored_timeout' --basetemp=.pytest_tmp_f20_u01_r24_dev -p no:cacheprovider` exit 1, 2 failed/21 deselected (`NODE_UNHANDLED` 오분류).
- GREEN: `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs` exit 0, 하네스 `--audit-self-test` exit 0/`R6_AUDIT_SELF_TEST_PASS`, 위 Python focused exit 0/2 passed·21 deselected, Python 전체 비 opt-in exit 0/22 passed·1 opt-in skipped. 이후 전용 pytest base의 root 비-link·하위 symlink 3개 target 내부를 확인해 해당 base만 삭제했고 잔여 0이다.
- Main은 첫 실패 SHA의 전용 WSL 자원을 정확한 신원 검사 뒤 정리했다고 보고했고, 현재 branch `9e4547e400c6a6fed4b3dba28866e2f27f9613c9`에서 WSL checkout/G-05가 동일하다고 전달했다. 이 진단 diff는 아직 commit/push/WSL 실행되지 않았다. Main이 새 SHA로 재실측하고 안전 진단 한 줄을 전달하면 원인을 확정해 exact3 내에서만 다음 TDD 보완 여부를 결정한다. 정식 Developer 실패 0, 이 재작업의 미완료 조건은 실제 WSL 진단이다.

## 기준과 소유권

- 시작 작업 경로 `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, branch `codex/f18-wsl-ops`, HEAD `ad0cb07ba575f8f07a55f3020106de224cd7e04b`. `git status --short --branch`는 Main 소유 `docs/WORK_STATUS.md`만 수정으로 표시했고 `.pytest_cache/` ACL 접근거부 경고가 있었다. 해당 경로는 보존했다.
- lease 기준 commit `0006a523579479cf35f118af98e7b86d9ecd12df`는 시작 HEAD의 조상임을 `git merge-base --is-ancestor` exit 0으로 확인했다. epoch 38 worker `worker-lease-f20-u01-r24-r24empty1001` 및 write `write-lease-f20-u01-r24-r24empty1001`은 `ACTIVE`, 만료 `2026-10-02T00:03:11+00:00`. execution fencing token `f20-u01-r24-execution-fence-epoch-38-r24empty1001`, write fencing token `f20-u01-r24-write-fence-epoch-38-r24empty1001`을 canonical progress/HANDOFF에서 대조했다.
- allowed paths는 `tests/browser/f20-u01-oidc-browser-pg15.mjs`, `tests/integration/test_f20_u01_oidc_browser_pg15.py`, 이 결과보고서 정확히 3개다. Main 소유 control/progress/HANDOFF/WORK_STATUS 및 Git commit/push는 수정하지 않았다.
- SHA-256 기준: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`, R24 계획 `7BBFF2DC745467494784D730AA037AF67427572F7846A30D3503A3EC133C0DED`. 모두 WorkInstruction의 고정값과 일치했다.

## 변경과 근거

- 브라우저 하네스: 인증 직후 저장 Alert seed 전의 두 API 200·빈 배열과 Critical Alerts/Next Actions DOM의 관측 범위 0건을 결박한다. 테스트 전용 issuer control의 `seed` 응답은 같은 시점의 DB audit event 0건을 검증하고 1건을 만든 뒤 기존 저장 Alert→Next Actions→권한 철회/403 흐름으로 이어진다. pre-auth 401은 기존 차단 단언으로 남는다.
- 브라우저 하네스: 빈 상태 뒤 `/api/dashboard/operations`의 정확한 GET 한 요청에만 테스트 전용 503을 주입한다. `finally`에서 route를 해제한다. Next Actions/Queue는 `UNAVAILABLE`이고 0건/`HEALTHY`가 아니며, Critical Alerts의 빈 관측과 독립 Provider 카드는 유지되고 주입 본문 marker는 DOM에 없다. 이후 저장·철회·same-origin/Secret 감사가 끝나야 `r23Regression=true`를 내보낸다.
- Python 통합 하네스: 기존 선행 `owner.detect()`를 인증 후 빈 조회/오류 검증이 끝난 다음 테스트 전용 control 호출로 이동했다. DB preflight·빈 audit event 검사, 최종 저장 Alert 불변, OIDC session/pending, cleanup 단언을 유지한다. R24 boolean fact와 실패 stage를 제한 whitelist로 검증한다. 비 opt-in SKIP은 실제 브라우저 PASS가 아니다.
- 최종 변경량: 브라우저 하네스 `+170/-2`, Python 하네스 `+69/-5`, 신규 이 결과보고서 1개. 기존 Main 소유 dirty `docs/WORK_STATUS.md`는 diff/수정 범위에 포함하지 않는다.
- 제품 UI/API/DB schema/인증/권한·Secret은 변경하지 않았다. 기존 R20/R23 result field를 삭제하거나 의미 변경하지 않았다.

## 정확한 로컬 검증

| 명령 | 종료·실제 결과 |
|---|---|
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` (Task 1 테스트만 추가 후) | exit 1, 예상 RED `ReferenceError: validateEmptyDashboard is not defined` |
| `.\.venv\Scripts\python.exe -m pytest tests/integration/test_f20_u01_oidc_browser_pg15.py -q -k r24_empty_browser_evidence --basetemp=.pytest_tmp_f20_u01_r24_dev -p no:cacheprovider` | exit 1, 예상 RED `NameError: _r24_empty_evidence`, 1 failed |
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` 및 같은 Python `-k r24_empty_browser_evidence` | 각각 exit 0, `R6_AUDIT_SELF_TEST_PASS`, 1 passed/20 deselected |
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` (Task 2 테스트만 추가 후) | exit 1, 예상 RED `ReferenceError: validateDashboardError is not defined` |
| `.\.venv\Scripts\python.exe -m pytest tests/integration/test_f20_u01_oidc_browser_pg15.py -q -k r24_error_browser_evidence --basetemp=.pytest_tmp_f20_u01_r24_dev -p no:cacheprovider` | exit 1, 예상 RED `NameError: _r24_error_evidence`, 1 failed |
| `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs` 및 `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` | 각각 exit 0, `R6_AUDIT_SELF_TEST_PASS` |
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` (route drain 단언만 추가 후) | exit 1, 예상 RED `TypeError: page.unroute is not a function`; `finally`의 `unrouteAll({behavior:'wait'})` 보완 뒤 아래 최종 자기검증 GREEN |
| `.\.venv\Scripts\python.exe -m pytest tests/integration/test_f20_u01_oidc_browser_pg15.py -q -k 'r24_empty_browser_evidence or r24_error_browser_evidence' --basetemp=.pytest_tmp_f20_u01_r24_dev -p no:cacheprovider` | exit 0, 2 passed/20 deselected |
| `.\.venv\Scripts\python.exe -m pytest tests/integration/test_f20_u01_oidc_browser_pg15.py -q --basetemp=.pytest_tmp_f20_u01_r24_dev -p no:cacheprovider` | exit 0, 21 passed/1 skipped; skipped 실제 opt-in |
| `npm run web:test` | exit 0, console 47 passed/0 failed |
| `npm run web:typecheck` | exit 0 |
| `npm run web:lint` | exit 0, 3 files checked/수정 0 |
| `npm run web:build` | exit 0, 20 modules transformed |
| `.\.venv\Scripts\python.exe scripts/check_project_progress.py` | exit 0, G-05 `PASS sequence=1942 reporting=AUTO_CONTINUE`; 기존 `.pytest_cache/` 접근거부 경고는 보존 |
| `git diff --check` | exit 0, 결과보고서 생성 후 재확인 |

로컬 `.pytest_tmp_f20_u01_r24_dev`와 `apps/web/dist`는 Main의 사전 부재 기록 후 생성됐다. 두 경로의 절대 실경로·root 비-link를 확인했고 pytest base의 하위 symlink 3개 target도 같은 전용 base 내부임을 확인했다. 테스트 명령 종료 뒤 해당 link와 전용 두 경로만 제거했으며 `Test-Path` 잔여 `False/False`다. 기존 `.venv`, `node_modules`, `.pytest_cache`는 보존했다. 도구 실행 초기 `apply deny-read ACLs` 사전 오류 2회는 `require_escalated` 읽기/실행으로 우회했고 코드·정식 Developer 실패 횟수는 0이다. 예상 TDD RED 4회는 정식 실패로 집계하지 않는다.

## 미검증·다음 조치·rollback

- Main이 exact3 diff 및 로컬 결과를 독립 검토한 다음 안전한 commit/private push를 수행하고, WSL-server의 동일 SHA에서 격리 PostgreSQL 15/OIDC/Chromium opt-in을 실행해야 한다. 실제 빈 DB/API/DOM, 단일 503·다른 카드 유지·본문 비노출, R23 저장 Alert/Next Actions/revoke/403, Network/Secret, 자원 잔류 0을 기록해야 한다.
- 이번 로컬 실행은 실제 브라우저/DB/WSL/Production 검증이 아니다. quota/cancel/reconnect·필터/운영 카드·전체 접근성·독립 E-SHOT/E-NET/E-API/E-EVT 및 C30은 미충족이다.
- rollback은 Main이 이 exact3의 R24 테스트·보고서 diff만 되돌리는 것이다. 제품 파일이나 지속 DB 자료를 되돌릴 변경은 없다.
