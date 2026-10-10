# WI-U01-TASK4-R6-STORED-ROW-CONTROL-CORRECTION-20261011-001

## 판정·승인 경계

신산님이 승인한 `Anvil_설계서_v2.md` §29.2, `Anvil_작업계획서_v1.md` U-01, `docs/work_orders/U-01_TASK4_POST_H4_RECOVERY_PLAN.md` Task 2 Step 4~5, `APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001` 안에서만 역사 R6 하네스의 잘못된 행 조작 요소0 단언을 최소 보정한다. DC-U01-017·`docs/04_test_reports/U-01_TASK4_R6_STORED_ROW_DIAGNOSTIC_RESULT.md`의 실제 `STORED_ROW_CONTROLS` 실패가 근거다. 제품·공개 API·DB schema/migration·ACK 동작/인가·감사·Network·Secret/certificate·비용·운영 범위는 바꾸지 않는다. 기능·요구사항·중요 위험 변경이 아닌 내부 검증 보정이므로 부모 human approval에 `MAIN_RECONFIRMED_NON_SEMANTIC` 파생 결박으로 진행하고 별도 사용자 재승인을 요청하지 않는다.

기준은 기존 단일 브랜치 `codex/u01-dashboard-r2` 결과보고 tail `13dc731bad9386af0a827f31c361d3bae3d96643`이다. local/private 동일·tracked clean·G-05 seq2354 PASS, epoch113 seq2353 write→2354 worker REVOKED·활성 writer0·제품 scope0을 재확인한 뒤 시작한다. 원본 C `3e788ed2`의 G-05 FAIL과 R6 실제 exit1은 불변으로 기록한다. 기존 branch main 병합/삭제 전 새 branch 금지, history rewrite/force push·PR/main·ysna/Production 제외다.

## 하네스 보정 설계·TDD

현재 `tests/browser/f20-u01-oidc-browser-pg15.mjs`의 `assertStoredRowControls(count)`는 `a, button, input, select` 합계 0을 요구한다. 같은 R6의 `open` Critical 행은 설계 §29.2와 현재 `CriticalAlertsCard`에 따라 `확인` 버튼을 렌더하므로, C3 exact-SHA WSL 실측에서 이 단언이 `AssertionError`였다. 이는 제품 결함 판정이 아니라 역사 하네스 계약 충돌이다.

- 단일 Developer는 `STORED_ROW_CONTROLS` 단계와 영향/다음 조치·entity/cause 단언, 기존 API/ACK/인가/감사/Network 시험을 유지한다. 저장된 `open` 행에서 비-ACK `a, input, select` 및 다른 버튼을 거부하고, 버튼은 정확 1개·`type=button`·표시문자 `확인`으로 확인한다. 비인가 또는 대기 상태의 disabled 여부는 별도 인가 흐름의 관측 조건이므로 이 존재 단언이 임의로 enabled나 클릭 성공을 요구하지 않는다. `acknowledged` 행 또는 독립 인가/감사 검증을 이 R6 한 단언으로 대체하지 않는다.
- 먼저 Node self-test/집중 통제 테스트에 잘못된 버튼 수·이름·type·비-ACK 조작 요소를 거부하는 RED를 추가한다. 정상 `확인` 버튼 1개는 GREEN, 역사 count0 기대가 재도입되면 RED여야 한다. fixture PASS를 실제 브라우저 PASS로 승격하지 않는다.
- 수정 경로는 `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py`, `tests/browser/f20-u01-oidc-browser-pg15.mjs` 정확 최대3개다. 제품 경로 `apps/web/src/console/App.tsx`, Python 통합 runner, DB/API, 승인 원문은 수정 금지다. G-05 successor는 이전 H3·보고 tail blob/Event raw prefix·기존 C3/B3/H3 성립을 약화하지 않고 새 W5→A4→C4→B4→H4와 보고 tail의 정확 Git 경로·private ref·clean을 fail-closed로 검증한다. 제어 코드 변경에 필요한 독립 위조·순서·만료·dirty 음성 회귀를 포함한다.
- marker·실패 분류에는 token, 쿠키, URL, 응답 본문, 저장 경고 원문, 사용자 ID, DB 값, Secret을 기록하지 않는다. 빨간 테스트를 PASS로 바꾸거나 비선택 시험의 `SKIP`을 통과로 계산하지 않는다.

## 소유권·정확 checkpoint·검증

- Main의 **W5**는 기준 tail의 직접 자식이며 본 WI·Invocation·WORK_STATUS 정확3문서다. W5 실제 G-05는 새 route 전 예상 RED로 기록하고 PASS라 주장하지 않는다. **A4**는 W5 직접 자식의 Event/progress/HANDOFF/detached digest/WORK_STATUS 정확5문서로 seq2355 WI 발행→2356 epoch114 worker→2357 write를 append-only로 투영한다. 기존 seq1~2354 raw prefix 보존, 서로 다른 24시간 fencing token, 위 최대3 code path·제품 write scope0이다. W5/A4의 WI·approval SHA와 원장·snapshot·digest·임대 무결성을 독립 확인하고 기존 브랜치/private exact SHA로 게시한다.
- 단일 Primary Developer는 유효한 epoch114 worker/write token과 W5/A4 SHA, 정확 path scope를 확인한 뒤에만 TDD로 코드 작업한다. Main은 Developer write lease 동안 해당 code path를 수정하지 않는다. Developer의 **C4**는 A4 직접 자식의 위 정확3 코드 경로 한 commit이며 `git diff --check`, Node self-test/구문, Python 집중/인접 회귀, 독립 Critical/Important0를 요구한다. C4 게시 후 actual clean/private G-05 PASS 전 WSL QA 금지다.
- Main은 C4 exact SHA를 기존 계획에 사전 등록한 **새로운** WSL-server 전용 Git checkout과 새 빈 격리 PG15/OIDC/HTTPS/Chromium에 push/pull 수신해 R6 opt-in을 fresh 실행한다. 이전 R6 DB·브라우저/checkout은 재사용하지 않는다. `STORED_ROW_CONTROLS`가 GREEN이어도 `STORED_ROW_ENTITY`나 후속 단계가 실패하면 정확한 새 실패로 분리하며 전체 R6 PASS라 주장하지 않는다. 공유 서비스·ysna/Production은 손대지 않는다. 자원은 생성 전 literal 이름·owner·수명·정리 방법을 WORK_STATUS에 기록하고, 종료/실패 모두 ID/label/image/mount/port·realpath/owner/link/process를 확인해 전용 것만 정리·잔여0을 증명한다.
- 실측 뒤 Main의 **B4**는 C4 직접 자식 progress/HANDOFF/digest/WORK_STATUS 정확4문서에 결과를 결박한다. **H4**는 B4 직접 자식 Event/progress/HANDOFF/digest/WORK_STATUS 정확5문서로 seq2358 write→2359 worker 순서로 회수한다. H4 뒤 **첫 결과보고 tail**은 반드시 H4의 직접 자식 한 commit에서 `docs/04_test_reports/U-01_TASK4_R6_STORED_ROW_CONTROL_CORRECTION_RESULT.md` 신규와 `docs/WORK_STATUS.md` 수정 정확2경로, 필요한 경우 `design_change.md` 수정까지 정확3경로만 허용한다. 이미 게시된 진단 보고와 DC 원문은 덮어쓰지 않는다. 그 뒤 후속 tail은 직전 commit의 직접 자식으로 `docs/WORK_STATUS.md` 수정 정확1경로만 허용하며 첫 보고를 포함해 최대256개로 제한한다. Event/progress/HANDOFF/digest·code·approval blob은 H4 이후 불변이다. C4/B4/H4/최신 tail 각각 local/private clean G-05와 독립 Critical/Important0를 확인한다. 고정 SHA의 과거 PASS를 최신 HEAD에 상속하지 않는다.

## 완료·중단·rollback

완료는 승인 ACK UI와 비-ACK 조작 차단을 함께 보존한 TDD, 새 Git exact-SHA WSL-server R6 실제 판정, 전용 QA 자원 잔여0, epoch114 dual lease 회수, 최신 G-05와 보고 기록이다. 새로운 실제 실패는 원인과 미도달 범위를 기록해 별도 최소 WI로 분리한다. 이 절편은 전체 E-NET/E-API/E-AUD·U-01 인수나 PR/main 병합 조건을 혼자 충족하지 않는다. 회귀·권한/감사/Network 계약 위반 또는 중요 위험 발견 시 코드 write를 멈추고 현재 SHA·실패 증거를 보존해 Main이 재판정한다. rollback은 새 commit만 정상 revert하고 역사 Event/보고 및 원격 복구 ref를 보존한다.
