# F-20/U-01 R45 Queue 격리 경고 Developer 결과

## 판정

`COMPLETED_R45_QUEUE_SLICE_WSL_QA_ONLY` — Main이 clean/private/WSL 동일 SHA `558b15c11423d84fc9d3f6f16ae455b280006b8f`에서 R45 절편의 실제 PG15/OIDC/HTTPS/Chromium 재검증 PASS를 확인했다. 첫 SHA의 FAIL은 아래에 별도로 유지한다. F-20/U-01 전체 수락과 독립 Tester 판정은 아직 아니다.

## 판단 이유

- 시작: `codex/f18-wsl-ops`, HEAD `00c35dd669c0fe67537b30fbbfdbf9bedfbc5e81`, 지정 private upstream 동일, tracked dirty/untracked 0. 기존 `.pytest_cache`는 접근 거부 warning이 있으므로 수정·제거하지 않았다. canonical G-05 seq2082 PASS, epoch61 worker/write ACTIVE·actor/exact5/만료·종속 관계 확인. token 값은 이 보고서에 기록하지 않는다.
- 문서 bytes SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, R45 계획 `DDA7B6E79D03572E0813495BB4A6073A8F1D7F78D5EEDCFD3093228B7106EE09`, WorkInstruction `E1DFED788E971908ABDE82BBD4531932AA4E362D6C71430B2079458390127957`. R45 두 SHA는 Invocation과 일치한다.
- 변경 전 Queue 카드는 `queue.length`만 표시하고 `quarantine`은 형식 확인 대상일 뿐 경고 근거로 사용하지 않았다. 변경 후 같은 `/api/dashboard/operations` 응답의 격리 행 4필드·형식·상한·고유성·관측 시각·source gap을 검증한 때만 현재 범위 격리 수와 `LATE`를 표시한다. 0건은 기존 `UNKNOWN`을 유지한다.
- 같은 snapshot의 저장 `QUEUE_JOB_QUARANTINED` alert 1건이 격리 `job_id`·상태·시각·서버 계산식과 동일한 SHA-256 evidence hash 등과 일치할 때만 같은 페이지 `#health-detail-queue`를 연결한다. 중복·위조·과거/미래·해결 alert, 인증 차단/철회에는 링크가 없다. alert `deep_link`를 브라우저 이동 URL로 쓰지 않는다.
- QA Python 파일의 `/r6-control/seed-quarantine`은 opt-in 테스트에서만 생성되는 일회성 HTTPS issuer control 경로다. 기존 R24/R43/R44 seed 및 저장 alert 순서 검증 이후에만 실행하고 control token을 constant-time 비교한다. 제품 ASGI·공개 API·빌드에는 포함되지 않는다. 기존 R44 검증을 유지한 뒤 실제 격리 행과 저장 alert를 생성하여 카드 API↔DOM·fragment·권한 철회를 검사한다.

## 조치와 검증

- 변경 파일: `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`, `tests/browser/f20-u01-oidc-browser-pg15.mjs`, `tests/integration/test_f20_u01_oidc_browser_pg15.py`, 본 보고서. 그 밖의 제품/API/DB/auth/alert 구현 파일 변경 0.
- TDD RED: `npm run test:console -- --test-name-pattern=R45` exit1, 77 PASS/1 FAIL. 신규 R45 단언에서 격리 1건의 `LATE`가 기존 `UNKNOWN`으로 남는 예상 실패를 확인했다.
- GREEN: `npm run test:console` exit0, 78/78 PASS. 격리 1/2/0건, 중복·위조·미래시각·source gap, 저장 alert 유일/중복/해결·증거 불일치, 인증 차단을 포함한다. 기존 R35/R43/R44 단언도 같은 suite에서 통과했다.
- `python -B -m pytest -q -p no:cacheprovider --basetemp=.r45_dev_pytest_tmp tests/integration/test_f20_u01_oidc_browser_pg15.py` exit0, 47 PASS/1 SKIP. SKIP은 PG15/OIDC/HTTPS/Chromium 실제 opt-in이며 PASS가 아니다.
- `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs` exit0; `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` exit0, `R6_AUDIT_SELF_TEST_PASS`.
- Web: `npm run typecheck` exit0, `npm run lint` exit0(3 files), `npm run build` exit0(20 modules). `git diff --check` exit0. `python -B -m scripts.check_project_progress` exit0, G-05 seq2082 PASS.
- 실행 환경 오류 1건: `python -B scripts/check_project_progress.py`는 Windows direct-script import 문맥에서 R45 control module import 실패 exit1. 동일 파일을 package 문맥 `python -B -m scripts.check_project_progress`로 재실행해 PASS. 최종 Python 테스트 직후에는 그 테스트가 만든 `.r45_dev_pytest_tmp` 때문에 G-05가 `R45_GIT_INVALID` exit1을 냈다. 전용 temp의 경계·link를 확인해 정리한 뒤 G-05 seq2082 PASS(exit0)를 재확인했다. 제품 테스트 실패로 계상하지 않는다. Python cache warning은 기존 `.pytest_cache` ACL에 한정된다.
- 이번 build `apps/web/dist` 4개 산출물과 전용 `.r45_dev_pytest_tmp`(내부 link 3개가 같은 전용 root 안)는 경계 확인 후 해당 root만 제거해 잔여 0. 기존 `.pytest_cache`는 보존. 정식 Developer `FAILURE_REPORT` 0회.

## 미검증·잔여 위험·다음 조치

- Main의 동일 clean SHA 실제 PG15/OIDC/HTTPS/Chromium 카드 클릭·Network/Secret 재검증과 전용 QA 자원 정리는 아래 증거로 완료됐다. 이 절편의 PASS가 F-20/U-01 전체 인수나 Production 검증을 뜻하지 않는다.
- Queue 전체 정상 판정, 6종 Health 실제 source 완성, 전체 U-01/F-20 인수, PG18/Provider/Production은 범위 밖이다. ReleaseDecision `DEFER` 유지.
- rollback: Main 검증 전 exact5 변경만 이전 clean HEAD `00c35dd669c0fe67537b30fbbfdbf9bedfbc5e81`의 파일 bytes로 되돌린다. 다른 파일·원장·기존 dirty 자료는 변경하지 않는다. Developer는 commit/push/WSL 실행이나 WORK_STATUS/Event/control 수정 없이 인계한다.

## 1차 실제 QA 실패와 로컬 재작업

- Main 실행: clean exact SHA `2aaf95a24adfdf5440923281a5f8984fb4d5ef2a`, 격리 WSL PG15/OIDC/HTTPS/Chromium opt-in `1 FAILED / 47 deselected`, 종료 전 `NETWORK_RESPONSE_FACTS`에서 `DASHBOARD_API status=200 reason=UNREADABLE`. R45 격리 seed·Queue 카드 클릭·권한 철회는 안전 stage 순서상 도달했지만 전체 QA PASS가 아니다. 실패한 개별 response 순번은 기존 로그에 없고 정확한 원인은 미확정이다.
- Phase 1~3 조사: 기존 `readyDashboard`는 네 API의 Playwright `response.text()` capture 완료를 기다린 뒤 다음으로 간다. R45에서 추가한 Queue snapshot `fetchOnPage`는 페이지 안의 fetch body만 기다렸고, 별도 Playwright capture가 완료되기 전에 바로 `reload`했다. 이는 `DASHBOARD_API 200 UNREADABLE`과 일치하는 경쟁 가설이다. 어떤 response가 실제 실패했는지는 새 QA 전에는 확인할 수 없다.
- 안전한 국소 재현: 별도 Playwright response body를 지연한 브라우저 audit self-test에서 R45 fetch가 capture 전에 끝나는 `R45_DASHBOARD_CAPTURE_WAIT_MISSING` 예상 RED(exit1)를 확인했다. 해당 GET에 대한 `waitForResponse`와 기존 Playwright capture의 성공을 확인한 뒤 reload하도록 한 최소 보완에서 audit self-test GREEN(exit0)이다. 기존 Network/Secret 검사나 실패 거부를 완화하지 않았다.
- 후속 실패를 식별할 안전 진단: `R6_RESPONSE_CAPTURE_FAILED`에 category/status/reason에 더해 bounded 응답 순번·관측 stage·navigation round만 출력하고, Python 진단 파서도 이 allowlist만 통과시킨다. URL·본문·token·예외 원문은 출력하지 않는다. Python parser RED 1 FAIL → GREEN 1 PASS를 확인했다.
- 로컬 회귀: `npm run test:console` 78 PASS/exit0, `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs` exit0, 브라우저 `--audit-self-test` exit0. 최신 `python -B -m pytest -q -p no:cacheprovider --basetemp=.r45_diag_full_tmp tests/integration/test_f20_u01_oidc_browser_pg15.py`는 48 PASS/1 SKIP/exit0이다. SKIP은 실제 opt-in이다. 전용 pytest temp는 실경로·link 경계 확인 후 정리했고 잔류 0이다.
- 첫 실행의 `DASHBOARD_API 200 UNREADABLE` 응답별 순번이 보존되지 않아 당시 개별 응답과 근본 원인은 미확정이다. 보완 후 실제 재검증 PASS는 아래 현재 SHA의 실행 범위에 한정하며 첫 실패 기록을 PASS로 바꾸지 않는다.

## Main 출처 2차 실제 WSL QA·정리

- 실행 기준: 로컬·private 개발 원격·WSL-server clean 동일 SHA `558b15c11423d84fc9d3f6f16ae455b280006b8f`; G-05 seq2082 PASS. WSL Node24에서 console test 78 PASS, Web typecheck/lint/build 20 modules PASS, Python 비 opt-in 48 PASS/1 SKIP을 확인했다. 비 opt-in의 SKIP은 실제 브라우저 PASS로 계상하지 않는다.
- 격리 tmpfs PostgreSQL 15 컨테이너 ID `f8b4ee5112e5ff0e2a5fe4c93d8eea0f42018b8d3b1059ae4c28a4b390992f38`와 비관리자 role/DB에서 migration head `0019_oidc_sessions`를 확인했다. Main이 같은 SHA의 실제 OIDC/HTTPS/Chromium opt-in을 실행해 `1 passed, 48 deselected, 1 기존 httpx deprecation warning in 19.61s`, exit0을 얻었다.
- opt-in 범위에는 실제 저장 `QUEUE_JOB_QUARANTINED` alert의 Queue 카드 클릭, 같은 응답 API↔DOM·same-page fragment, R35/R43/R44 기존 경로, 인증 철회 후 보호 데이터 소거, Network same-origin·Secret 비노출 단언이 포함된다. 이는 테스트가 실제 실행한 R45 절편의 증거다.
- Main이 보존한 exact4 evidence SHA-256: `page-requests.json` `b1759394737b949d0f80a6be9bd7d5ba9807cb69db6a7c5a821680df34c2816d`; `pre-auth-error.png` `5d15edf6fa754ccaef53761ebf192c3b16b6afac8ea0155ad55e5e2a52a53c13`; `stored-critical.png` `b450c1fa57bbe64e3dfed4658fb211b830813f0ce796435f70b267102237816c`; `revoked-blocked.png` `551ccc100255d654a914bbc3cd8d66bbd869c0017dc727dbe82376bdc6dbf028`.
- Main은 첫 실패와 2차 실행의 전용 PG 컨테이너 두 개를 각각 정확한 ID·label·tmpfs·port 경계로 확인한 뒤 stop/AutoRemove를 검증했다. 두 전용 checkout·Playwright·evidence·pytest 경로도 exact 대상·실경로를 확인해 정리했고 R45 전용 경로/container/loopback port 5545 잔여는 0이다. 공유 `local-postgres`는 Up, `anvil-web`은 healthy로 확인했다.
- 미검증·제외: Queue 전체 정상 판정, 6종 Health 실제 source 완성, F-20/U-01 독립 인수, PG18, Provider, ysna/Production은 이 절편의 PASS에 포함되지 않는다. ReleaseDecision `DEFER` 유지. 다음은 Main의 보고서 diff/G-05 및 R45 lease 종료·checkpoint 판단이다.
