# WI-U01-TASK4-R6-NETWORK-CAPTURE-DIAGNOSTIC-20261011-001

## 목적·권한 경계

신산님 승인 `Anvil_설계서_v2.md` §29.2·`Anvil_작업계획서_v1.md` U-01·`U-01_TASK4_POST_H4_RECOVERY_PLAN.md` Task 2·`APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001`의 검증 보완이다. DC-U01-018의 실제 C4 WSL-server opt-in exit1 `NETWORK_RESPONSE_FACTS`, `OTHER_API status=404 reason=TIMEOUT index=4 observed_stage=PRE_AUTH_LOADING_DOM`을 원인 확정 전에 비밀 없이 좁힌다. 기능·요구·중요 위험 변경 없이 내부 진단만 수행하므로 Main은 부모 승인의 `MAIN_RECONFIRMED_NON_SEMANTIC` 파생 결박을 기록한다. 제품·공개 API·DB schema/migration·인증·권한·Secret/certificate·비용·운영·기존 R6 감사 의미는 바꾸지 않는다.

기준은 기존 단일 `codex/u01-dashboard-r2`의 보고 tail `d24f50ca393deeb93e7197d9eb36fc0ee6f1ed21`와 그 직접 자식 읽기 전용 진단 기록 `d36753053313b1bc5b4eab06b7d6fdf440522244`다. 후자는 local/private clean G-05 seq2359 PASS, epoch114 write→worker REVOKED·active writer0·제품 scope0이다(착수 직전 재확인). WSL-server R6 전용 QA 자원 잔여0이며 원본 C `3e788ed2`의 G-05 FAIL, C3 STORED_ROW 실패, C4 R6 전체 FAIL은 불변이다. 새 branch·PR/main·ysna/Production·history rewrite/force push 금지다.

## 원인 분리 계약

- 관측과 가설을 분리한다. 현재 `OTHER_API`는 `/api/` 잔여 전체라 정확 path가 아니다. 기존 R6 ASGI host는 `f19a_enabled=false` 기본과 migration0019, U-01 Console은 mount 시 F-19A 조합 목록을 조회하므로 초기 404 후보이나 **index4의 요청이 이 경로인지 미확정**이다. `captureResponseFact`의 `allHeaders()` 대 `response.text()` 중 어디서 TIMEOUT인지도 미확정이다.
- Developer는 먼저 Node self-test와 Python 안전 marker 통제 테스트에 경로 분류(`PAIR_LIST_API`, `SCOPED_DASHBOARD_API`, 나머지 `OTHER_API`), header/body/finished 단계, index/관측 stage/round의 정상·위조·비밀 포함 입력을 RED로 추가한다. 분류는 고정 allowlist의 path **형태**만 출력하고 ID·query·원 URL·host·body·header·cookie·token·DB 값은 출력하지 않는다. `OTHER_API`를 성공으로 바꾸지 않고, 기존 same-origin·credential/secret 감사와 non-ok 원 응답 body 검증을 생략하지 않는다. response 200 비스트리밍의 미완료도 fail-closed다. 단일 Developer의 허용 코드 경로는 `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py`, `tests/browser/f20-u01-oidc-browser-pg15.mjs`, `tests/integration/test_f20_u01_oidc_browser_pg15.py` 정확 최대4개, 제품0이다.
- 안전한 marker가 404의 실제 route class, header/body 중 정체 단계, requestfinished/response.finished 상태를 분리하도록 최소 계측만 GREEN으로 한다. 계측의 timeout 연장, 404 무조건 허용, body 감사 대체, F-19A를 R6 host에 임의 활성화하는 변경은 금지한다. 원인 확정 전 제품 코드 보정은 후속 WI로 분리한다. 기존 G-05의 역사 C4/B4/H4/보고 tail 및 DC blob, append-only Event/lease·Git/private/dirty fail-closed 계약을 약화하지 않고 새 W6→A5→C5→B5→H5/보고 tail route를 TDD로 추가한다.

## 소유권·checkpoint·검증

- Main의 **W6**는 `d3675305` 직접 자식 WI/Invocation/WORK_STATUS 정확3문서다. WI·Invocation SHA와 부모 approval·실제 branch/private/Event raw prefix·lease null을 결박한다. W6의 새 successor 구현 전 G-05 RED는 PASS가 아니다. **A5**는 W6 직접 자식 Event/progress/HANDOFF/detached digest/WORK_STATUS 정확5문서로 seq2360 WI→2361 epoch115 worker→2362 write를 append-only 발급한다. worker/write는 서로 다른 24시간 fencing token, 위 코드 최대4 path, 제품 scope0이다. A5 독립 무결성 검토 후 private 게시한다.
- 유효한 두 token의 단일 Primary Developer만 허용 코드 경로를 TDD RED→GREEN으로 수정한다. Main은 write lease 동안 동일 코드 경로를 수정하지 않는다. **C5**는 A5 직접 자식 코드 정확 최대4경로 한 commit, Node self-test/구문, Python 집중·인접 회귀, 독립 Critical/Important0, diff check0 후 private 게시한다. C5 actual clean/private G-05 PASS 전 WSL QA 금지다.
- Main은 C5 exact SHA를 **새 사전등록 전용** `ssh WSL-server` Git checkout에 수신하고 새 빈 격리 PG15/OIDC/HTTPS/Chromium R6 opt-in으로 안전 marker를 재현한다. 이전 QA DB/checkout/browser 재사용 금지. 실행 전 literal 이름·owner·수명·정리 방법을 commentary/WORK_STATUS에 기록하고 image/port/path/owner/symlink 부재를 확인한다. 실패·성공 모두 exact container ID/label/image/mount/port와 realpath/owner/link/process를 확인해 전용 자원만 제거·잔여0을 기록한다. 새 marker가 나오더라도 R6 전체 PASS는 모든 단언이 GREEN일 때만 가능하다.
- 실측 후 Main의 **B5**는 C5 직접 자식 progress/HANDOFF/digest/WORK_STATUS 정확4문서다. **H5**는 B5 직접 자식 Event/progress/HANDOFF/digest/WORK_STATUS 정확5로 seq2363 write→2364 worker 순서 회수한다. H5 뒤 첫 결과보고 tail은 직접 자식 한 commit에서 신규 `docs/04_test_reports/U-01_TASK4_R6_NETWORK_CAPTURE_DIAGNOSTIC_RESULT.md`와 WORK_STATUS 정확2, 필요 시 design_change.md까지 정확3경로다. 이후 WORK_STATUS-only 직접 자손을 허용하되 **첫 결과보고를 포함한 tail 총수 최대256개**다. C5/B5/H5/최신 tail 각각 local/private clean G-05와 독립 Critical/Important0을 확인한다. 과거 SHA의 PASS를 최신에 상속하지 않는다.

## 완료·잔여·rollback

이번 WI의 완료는 실패 응답의 정확한 안전 route/정체 단계 재현, 원인과 미확정을 구분한 결과보고, 전용 QA 잔여0, epoch115 임대 회수와 최신 G-05다. 여기서도 제품 원인이나 전체 R6 PASS가 미확정이면 `design_change.md`에 남기고 별도 최소 WI에서 후속 조치한다. E-NET/E-API/E-AUD·U-01 필수 ID별 인수는 별도 증거 전까지 NOT_ACCEPTED다. Rollback은 새 commit만 정상 revert하며 역사 Event·보고·원격 복구 ref와 승인 원문을 보존한다.
