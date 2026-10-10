# WI-U01-TASK4-R6-STORED-ROW-DIAGNOSTIC-20261010-001

## 판정과 권한

승인된 `Anvil_설계서_v2.md` §29.2, `Anvil_작업계획서_v1.md` U-01, `docs/work_orders/U-01_TASK4_POST_H4_RECOVERY_PLAN.md` Task 2 및 `APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001`의 **기존 범위 안에서** Foundation R6의 `R6_BROWSER_FAILED stage=STORED_ROW class=AssertionError`가 어느 단언인지 분리한다. 이번 WI는 진단 전용이다. 기존 ACK 버튼·인가·감사·Network 계약을 바꾸거나 역사 단언을 우선 삭제하지 않는다. 제품·공개 API·DB schema/migration·Secret/certificate·비용·운영 범위 변경은 0이다. Main은 원 승인을 부모로 `MAIN_RECONFIRMED_NON_SEMANTIC` 파생 binding과 WI·Invocation SHA-256을 활성 checkpoint에 기록한다.

기준선은 기존 단일 `codex/u01-dashboard-r2`의 `b5c1745bea7e57a2eed4d3c84b87f27ceebcc78b`이며 사설 `development` 동일 SHA·tracked clean·G-05 seq2349 PASS다. epoch112 worker/write는 seq2348/2349에 회수됐고 활성 writer는 0이다. 원본 C `3e788ed25330910d2b55c932e3fe517e8661bd59`의 G-05 FAIL은 보존한다. 새 branch/worktree, rewrite/force push, PR/main, ysna/Production은 제외한다.

## 읽기 전용 사전 대조와 진단 계약

기존 `tests/browser/f20-u01-oidc-browser-pg15.mjs`의 `STORED_ROW`에는 (1) 영향·다음 조치 문단 일치, (2) 행 안의 `a, button, input, select` 개수 0, (3) entity/cause 포함이 연속한다. 현재 `CriticalAlertsCard`는 `open` 행에 `onAcknowledge`가 있으면 권한 전후 `확인` 버튼을 렌더하고 설계 §29.2도 확인 버튼을 요구한다. 따라서 (2)는 **정적 충돌 후보**일 뿐 실제 실패 단언은 격리 실측 전 미확정이다.

- 단일 Developer는 세 단언 직전의 고정·비밀 없는 단계 marker와 그 분류 회귀를 RED→GREEN으로 추가한다. 권장 marker는 `STORED_ROW_PARAGRAPHS`, `STORED_ROW_CONTROLS`, `STORED_ROW_ENTITY`다. 기존 `STORED_ROW` 경계, 단언 자체, ACK UI/API/인가/감사/Network 요구는 유지한다.
- marker와 분류 출력에는 token, 쿠키, URL, HTTP body, 저장 경고 원문, 사용자 ID, DB 값, Secret을 싣지 않는다. 예상 실패도 PASS로 처리하지 않는다.
- 단언별 실제 결과에 따라 다음 수정이 필요한지 별도 판정한다. 이 WI에서 역사 control0 삭제, 제품 변경, 허용 외 코드 수정은 금지한다.

## 소유권·정확 경로·checkpoint

- Main은 WI/Invocation, Event/progress/HANDOFF/digest/WORK_STATUS, Git checkpoint/private push, 독립 검토, WSL-server 사전 등록 격리 QA·정리를 소유한다. Developer는 유효한 서로 다른 epoch113 worker/write fencing token과 WI SHA·A3 clean/private를 모두 확인한 뒤에만 코드 파일을 수정한다. Main은 활성 write lease 동안 같은 코드 경로를 수정하지 않는다.
- Main의 **W4**는 기준선의 단일 직접 자식이며 신규 WI·Invocation과 `docs/WORK_STATUS.md` 정확 3경로다. **A3**는 W4 직접 자식의 Event/progress/HANDOFF/detached digest/WORK_STATUS 정확 5경로로, frozen seq1~2349 뒤 WI 발행→worker 발급→write 발급을 순서대로 append한다. 24시간 분리 token·제품 write scope 0을 결박한다.
- Developer의 **C3**는 A3 직접 자식의 `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py`, `tests/browser/f20-u01-oidc-browser-pg15.mjs`, `tests/integration/test_f20_u01_oidc_browser_pg15.py` 중 실제 필요한 정확 경로만 한 commit에서 변경한다. G-05 successor는 기존 H2와 보고 tail의 역사 blob·Event raw prefix·Git parent/정확 diff·private ref·clean을 약화하지 않고 W4→A3→C3의 새 단계와 위조 거부를 fail-closed로 검사한다. C3 게시 후 실제 clean/private G-05 PASS 전 WSL 실행 금지다.
- Main은 C3 exact SHA를 WSL-server의 새 전용 Git checkout과 새 격리 PG15/OIDC/HTTPS/Chromium에 수신해 R6 opt-in을 실행한다. 이 진단의 예상 결과는 안전한 단언별 `AssertionError` 식별이며 **테스트 PASS가 아니다**. 자원은 생성 전 이름·owner·수명·정리 방법을 commentary와 WORK_STATUS에 기록하고, 실패·성공 모두 정확 신원 확인 후 전용 자원만 제거·잔여 0을 검증한다.
- 실측 뒤 Main의 **B3**는 C3 직접 자식의 progress/HANDOFF/digest/WORK_STATUS 정확 4경로에서 진단 결과와 회수 준비를 결박한다. **H3**는 B3 직접 자식의 Event/progress/HANDOFF/digest/WORK_STATUS 정확 5경로에서 write→worker를 순서대로 회수한다. 결과보고 tail은 H3의 직접 자손으로 정확한 보고·WORK_STATUS·필요한 design_change 경로에만 한정하고 그 최신 SHA의 G-05를 다시 판정한다. C3/B3/H3의 local/private exact-SHA G-05와 독립 Critical/Important 0을 각각 확인한다.

## 완료 경계

완료는 세 단언 중 실제 실패 지점의 안전한 식별, 기존 ACK/인가/감사/Network 불변, 동일 SHA WSL 실행의 정확한 FAIL 또는 PASS 원문 분류, 임시자원 잔여 0, 회수된 dual lease, 최신 G-05 및 결과 기록이다. 실제 실패가 (2)라면 별도 최소 하네스 보정 WI/lease와 RED→GREEN·fresh WSL로 이어간다. 다른 단언이나 제품 회귀면 허용 경로 밖 수정 없이 원인을 분리해 기록한다. Foundation R6 진단은 U-01 전체·E-NET/E-API/E-AUD 인수나 PR/main 조건을 충족시키지 않는다. rollback은 이 WI의 신규 commit만 정상 revert하며 기존 역사 Event·보고·원격 복구 ref를 보존한다.
