# F-20/U-01 R24 빈 결과·오류 브라우저 QA Developer 결과

## 판정

`COMPLETED` — 동일 clean SHA `366d2fc5904987183c9158eaa8854761202acbc3`의 격리 WSL-server PostgreSQL 15/OIDC/Chromium에서 R24의 실제 빈 결과·단일 조회 오류·저장/철회 회귀가 통과했고 증거 확인과 전용 자원 정리가 끝났다. 이는 **R24 좁은 QA만 PASS**이며 U-01/F-20 수락 또는 C30 해소가 아니다.

## R24 실제 WSL-server 좁은 QA 최종 증거 (현재)

- Main이 기존 branch·사설 remote·WSL QA checkout의 동일 clean SHA `366d2fc5904987183c9158eaa8854761202acbc3`, G-05 seq1942 PASS를 확인했다. SHA7 전용 PG15 ID `819141ee...`는 `postgres:15` image, AutoRemove, data tmpfs, mount 0, loopback `127.0.0.1:5545` 경계를 확인했고 비-superuser DB/role 및 migration `0019`를 사용했다. Node 24 build는 20 modules transformed/exit 0. Main 실행 OIDC/Chromium opt-in은 exit 0, `1 passed, 23 deselected, 2 deprecation warnings in 7.05s`였다. deprecation warning 2건은 경고로 남기며 전체 U-01 합격으로 해석하지 않는다.
- 실 DB/API/DOM의 seed 전 빈 Critical Alerts/Next Actions, 테스트 경계의 정확한 Dashboard GET 1회 503과 `UNAVAILABLE`/0건·`HEALTHY` 오인 방지, 오류 본문 비노출·독립 카드 보존, 실제 seed된 저장 Alert/Next Actions 1행→권한 철회 403/BLOCKED/행 제거, 기존 초기 LOADING/키보드 및 same-origin/Secret 단언이 같은 실제 실행에서 통과했다. Main은 PNG 육안으로 pre-auth BLOCKED, 저장 Alert와 실제 `REVIEW_WORKER_TAKEOVER` Next Actions 1행, revoke BLOCKED/행 제거를 확인했다. Network JSON은 page 요청 45건 중 45건, app API 27건, 동일 HTTPS loopback origin 1개, query/fragment 0건으로 확인했다.
- Evidence는 mode 0700의 정확히 4개(PNG 3·Network JSON 1)였고 SHA-256은 pre-auth `6c209c479a221377b13756d1e965df4eeb2081d5cdb54415f5b4c5d07f9541fc`, stored `6d1f82a2e77d89ebd4dc059033912d45324f47f03ba23eadbc9041ba576f5258`, revoked `1696e33d24500a1368e2fee842bae5d61ede0c768c6a05a6a121c8819d0bb691`, Network `6b3fda695b09daa3f1a97eb8e3d2b69e562e7c2c740d68bf4bc19ae0f067ae3f`다. Main의 로컬 육안 검토용 PNG3 복사본은 원본 hash 일치 확인 후 정확한 경로만 삭제해 잔여 0이다.
- Main이 전용 PG ID를 신원 확인 후 stop/AutoRemove하고 지정 WSL 경로의 실경로·link/소유 경계를 검사한 뒤 정리했다. 최종 PG/Node/browser 컨테이너 0, loopback port 5545 listener 0, TLS/venv/pytest/evidence/node_modules/dist 0, WSL QA checkout clean/G-05 seq1942 PASS다. 기존 공용 서비스·다른 DB·ysna/Production에는 변경이 없다. Local/remote/WSL의 테스트 SHA는 같고, 이 보고서 후속 기록만 현재 작업 브랜치의 미커밋 diff다. Git commit/push와 lease 회수는 Main 소유다.
- 미검증: quota/cancel/reconnect·필터/운영 카드·전체 접근성·정식 독립 E-SHOT/E-NET/E-API/E-EVT 및 C30. U-01/F-20 미수락, ReleaseDecision `DEFER` 유지. rollback은 R24 exact3의 테스트·보고서 변경만 해당 checkpoint 이전으로 되돌리는 것이며 제품·지속 DB를 복구할 변경은 없다.

## R24 저장 Alert 기대값 회귀 수정 checkpoint (이력)

- Main의 동일 SHA `545ef29520602e0f1adac488c5cf69acea926913` 실제 WSL 진단은 `STORED_NEXT_ACTION`/`TimeoutError`, `directExpected=NO reloadExpected=NO domExpected=NO domReload=YES rows=1 visible=YES`였다. 직접/reload API와 화면은 실제 저장 action으로 서로 일치했다. 하네스만 seed 전 fixture `_TEST_ALERT.next_action=REVIEW_WORKER_LEASE`, `deep_link=/operations`를 기대값으로 전달했다. 실제 `owner.detect()`의 `packages/observability/service.py` 값은 `REVIEW_WORKER_TAKEOVER`, `/operations/workers`다. 제품/UI/API/DB 결함이라는 증거는 없고, 원인은 R24의 seed 시점 이동 뒤 기대값 출처를 바꾸지 않은 테스트 회귀다.
- 수정 전: `_node_flow(..., _TEST_ALERT, ...)`가 fixture의 action/deep_link를 `ANVIL_F20_R6_EXPECTED_ACTION_JSON`으로 seed **전** Node에 전달했다. 수정 후: token-guarded 테스트 전용 `/r6-control/seed`가 `owner.alerts()` 실제 저장 snapshot에서 `code/level/cause/related_entity_id/next_action/deep_link`만 응답한다. 브라우저는 기존 fixture의 code/entity/cause와 0→1 seed 경계를 먼저 검증하고 이 제한된 실제 snapshot을 저장 Alert→Dashboard API→DOM의 기대값으로 사용한다. 전체 저장 snapshot은 Python 최종 `owner.alerts() == before`로 계속 고정한다. 비밀성 `evidence_hash`와 fixture action을 Node 환경에 전달하지 않는다. 기존 저장/철회/403·same-origin/Secret 단언과 제품 코드는 변경하지 않았다.
- 기준: 기존 branch `codex/f18-wsl-ops`, 재작업 시작 HEAD `545ef29520602e0f1adac488c5cf69acea926913`에서 Main 소유 `docs/WORK_STATUS.md`만 dirty였다. Main이 실패/정리를 별도 checkpoint한 뒤 현 HEAD는 `5a7c4930e98eda625d958fa5ed778cb95648688a`; lease baseline `0006a523579479cf35f118af98e7b86d9ecd12df`의 후손임을 `git merge-base --is-ancestor` exit 0으로 확인했다. epoch38 worker/write ACTIVE·두 fencing token·allowed exact3와 만료 `2026-10-02T00:03:11+00:00`을 canonical progress/HANDOFF에서 재확인했다. 이번 변경은 exact3만이며 Git commit/push·WSL·DB·제품 파일과 Main 소유 문서는 건드리지 않았다.
- TDD RED: `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` exit 1 `ReferenceError: validateSeedResult is not defined`. `.\.venv\Scripts\python.exe -m pytest tests/integration/test_f20_u01_oidc_browser_pg15.py -q -k 'r24_seed_control_uses_actual_persisted_action_not_fixture or r24_node_does_not_forward_fixture_action_as_expected' --basetemp=.pytest_tmp_f20_u01_r24_dev -p no:cacheprovider` exit 1/2 failed·22 deselected (`_r24_seed_result` 미정의, fixture action 환경전달 잔존). 이 의도한 RED는 정식 Developer 실패가 아니다.
- GREEN: 위 두 명령 exit 0/`R6_AUDIT_SELF_TEST_PASS` 및 2 passed·22 deselected. `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs` exit 0. `.\.venv\Scripts\python.exe -m pytest tests/integration/test_f20_u01_oidc_browser_pg15.py -q --basetemp=.pytest_tmp_f20_u01_r24_dev -p no:cacheprovider` exit 0/23 passed·1 실제 opt-in skipped. `npm run web:test` exit 0/47 passed, `npm run web:typecheck` exit 0, `npm run web:lint` exit 0/3 files·수정0, `npm run web:build` exit 0/20 modules transformed. 현 코드 diff는 JS `+26/-3`, Python `+26/-12`; 결과보고서 갱신 외 변경 없음. `git diff --check` exit 0. 전용 `.pytest_tmp_f20_u01_r24_dev`와 `apps/web/dist`의 정확한 실경로·root 비-link, 하위 symlink 3개 내부 target을 확인한 뒤 두 경로만 정리했고 잔여 0이다. 기존 `.venv`/`node_modules`/`.pytest_cache`는 보존했다. 정리 뒤 `.\.venv\Scripts\python.exe scripts/check_project_progress.py` exit 0/G-05 seq1942 PASS; 기존 `.pytest_cache` ACL 경고는 유지됐다.
- WSL 실제 실패 재실측 3회(첫 `58c0b75`, 진단 `b592c096`, 비교 `545ef295`)는 Main이 분리 기록·전용 자원 정리했으며, 이번 TDD 재작업의 정식 Developer 실패는 0회다. 현 SHA의 실제 PG15/OIDC/Chromium, Network/Secret/evidence, 잔류0은 **미검증**이다. Main이 exact3 독립 검토·commit/private push 후 같은 SHA WSL opt-in을 수행하고 실패 시 안전 stage/비교값만 환류해야 한다. rollback은 이번 exact3 테스트·보고서 diff만 되돌리는 것이며 제품·지속 DB 자료를 되돌릴 변경은 없다.

## R24 WSL 2차 실패·안전 비교 진단 checkpoint

- Main의 SHA `b592c096f13e1b26384136729b5d465c02f50fc7` 재실측 결과: `stage=STORED_NEXT_ACTION exit=1 class=TimeoutError directStatus=200 directActions=1 reloadStatus=200 reloadActions=1 dom=ROW`. 따라서 직접 API와 reload 응답은 모두 200/1건이고 Next Actions DOM에 `li`가 있으나, 기대 action의 `hasText` 일치/표시는 아직 확인되지 않았다. 기존 `NODE_UNHANDLED` 오분류는 해소됐다. Main은 이 실행의 지정 WSL 자원 잔여 0과 G-05 seq1942 PASS를 보고했다.
- 변경 전에는 위 1건/DOM ROW 상태에서도 기대 action과 reload action 및 실제 행 text가 같은지 구분할 수 없었다. 변경 후 timeout시에만 `R24_STORED_COMPARE`로 `directExpected`, `reloadExpected`, `domExpected`, `domReload`를 `YES/NO/INVALID`, `rows`를 0~100/`INVALID`, `visible`을 `YES/NO/INVALID`로 출력한다. action 원문·DOM 본문·URL·Secret은 출력하지 않고 원래 TimeoutError를 다시 던진다. Python 실패 요약은 정확한 whitelist 값만 통과시킨다. 제품 코드·기존 단언은 바꾸지 않았다.
- TDD RED: `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` exit 1 `ReferenceError: safeStoredComparison is not defined`; `.\.venv\Scripts\python.exe -m pytest tests/integration/test_f20_u01_oidc_browser_pg15.py -q -k test_r24_stored_timeout_reports_only_whitelisted_diagnostic --basetemp=.pytest_tmp_f20_u01_r24_dev -p no:cacheprovider` exit 1, 1 failed/22 deselected (안전 비교 필드 누락). 이 둘은 의도한 RED이며 정식 Developer 실패가 아니다.
- GREEN: 위 두 명령 각각 exit 0 (`R6_AUDIT_SELF_TEST_PASS`, 1 passed/22 deselected), `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs` exit 0, `.\.venv\Scripts\python.exe -m pytest tests/integration/test_f20_u01_oidc_browser_pg15.py -q --basetemp=.pytest_tmp_f20_u01_r24_dev -p no:cacheprovider` exit 0/22 passed·1 opt-in skipped. 전용 pytest base의 정확한 실경로·root 비-link·하위 symlink 3개 내부 target 확인 후 이 base만 정리했고 잔여 0. 정리 전 G-05는 untracked 전용 base 때문에 exit 1 `F20_U01_R24_GIT_INVALID`였고, 정리 후 `.\.venv\Scripts\python.exe scripts/check_project_progress.py` exit 0/G-05 seq1942 PASS. 기존 `.pytest_cache` ACL 경고는 보존했다. `git diff --check` exit 0.
- 현재 branch HEAD `61c56f32c6390b549a6c5a29bb371e8cbdfceebc`에서 브라우저 JS, Python opt-in, 이 결과보고서 exact3만 수정했다. Main 소유 파일·Git·WSL은 건드리지 않았다. 실제 비교 값과 원인은 **미확정**이다. Main이 exact3 검토/commit/private push 후 동일 SHA WSL 재실측의 안전 비교 필드를 전달해야 한다. 그 값으로 원인을 확정한 뒤에만 exact3 내 TDD 최소 수정 여부를 결정한다. 정식 Developer 실패 0, 실제 opt-in 미검증.

## R24 WSL 1차 실패·진단 재작업 checkpoint

- Main의 동일 SHA `58c0b75c5e2468b840bde9e334173277d3053950` 격리 QA는 실제 `STORED_NEXT_ACTION`/`TimeoutError`에서 실패했다. 선행 저장 Alert API 200, 저장 Dashboard 직접 API 200/`next_actions` 1건, Alert DOM 1행을 지났으나 저장 Next Actions 기대 action 행을 10초 안에 확인하지 못했다. Python stage whitelist 누락으로 외부 오류는 `NODE_UNHANDLED`로 오분류됐다. 제품 PASS나 R24 PASS가 아니다.
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
- 최초 R24 구현 변경량: 브라우저 하네스 `+170/-2`, Python 하네스 `+69/-5`, 신규 이 결과보고서 1개. 이번 비교 진단의 현재 HEAD 대비 코드 diff는 브라우저 `+47/-0`, Python `+17/-2`이며 결과보고서도 갱신했다. Main 소유 `docs/WORK_STATUS.md`는 diff/수정 범위에 포함하지 않는다.
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

## 이전 로컬 checkpoint의 미검증·다음 조치·rollback (이력)

- Main이 exact3 diff 및 로컬 결과를 독립 검토한 다음 안전한 commit/private push를 수행하고, WSL-server의 동일 SHA에서 격리 PostgreSQL 15/OIDC/Chromium opt-in을 실행해야 한다. 실제 빈 DB/API/DOM, 단일 503·다른 카드 유지·본문 비노출, R23 저장 Alert/Next Actions/revoke/403, Network/Secret, 자원 잔류 0을 기록해야 한다.
- 이번 로컬 실행은 실제 브라우저/DB/WSL/Production 검증이 아니다. quota/cancel/reconnect·필터/운영 카드·전체 접근성·독립 E-SHOT/E-NET/E-API/E-EVT 및 C30은 미충족이다.
- rollback은 Main이 이 exact3의 R24 테스트·보고서 diff만 되돌리는 것이다. 제품 파일이나 지속 DB 자료를 되돌릴 변경은 없다.
