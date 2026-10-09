# WI-U01-SCOPED-DASHBOARD-TASK4-WSL-REPORT-SUCCESSOR-20261009-001

## 판정·기준선

승인된 U-01 계약 B와 `U-01_SCOPED_DASHBOARD_IMPLEMENTATION_PLAN.md` Task 4의 후속 실측 보고만 통제한다. 기존 단일 branch `codex/u01-dashboard-r2`의 Task4 보고 통제 종료 H `f6257baad4d6f340301b04218e9949f1dc28c114`는 G-05 seq2309 PASS였고, 직접 후손 R2 `c023235e4e483e6e545ca4943c621d7df106a094`는 정확 6문서의 WSL-server 부분 검증·잔여 기록이다. R2는 아직 신규 G-05 successor가 없어 `U01_TASK4_REPORT_CLOSE_GIT_INVALID`이며 이를 PASS로 표기하지 않는다. U-01 전체 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`; PR/main/U-02/ysna-server 작업은 없다.

## 정확 범위·소유

- Main은 이 WI와 invocation, Event·lease·progress/HANDOFF/digest/WORK_STATUS, Git checkpoint/push, 독립 판정을 소유한다. 기존 branch 외 새 branch/worktree를 만들지 않는다.
- 단일 Developer `developer-primary-u01-task4-wsl-report-successor`는 Main이 발급·검증한 유효 worker/write fencing token 두 개, A 문서의 원장·snapshot·digest 정합성, 실제 local/private 동일·clean과 신규 route 부재의 bootstrap G-05 RED 기록을 받은 뒤에만 `scripts/check_project_progress.py`와 `tests/tooling/test_u01_postmerge_control_projection.py` 정확 2파일을 수정한다. 새 route 구현 전의 RED를 GREEN 선행 조건으로 만들지 않는다. Main은 활성 lease 동안 같은 파일을 수정하지 않는다.
- 제품/API/UI/DB/브라우저/WSL-server/Secret/배포 write는 이 WI 밖이다. Developer는 R2의 `design_change.md`, U-01 결과보고, evidence manifest, WORK_STATUS/HANDOFF/digest 및 과거 Event를 수정하지 않는다. Developer는 commit/push/branch 생성·PR/병합을 하지 않는다.

## fail-closed successor 계약

1. 이전 Task3/Task4 active·closed validator와 H의 결박을 완화하지 않는다. H→R2는 단일 부모·merge 없음·정확 6문서(`design_change.md`, `docs/04_test_reports/U-01_SCOPED_DASHBOARD_RESULT.md`, `docs/WORK_STATUS.md`, `docs/evidence/manifests/U-01_SCOPED_DASHBOARD_TASK4_DEFERRED_MANIFEST.json`, `docs/progress/BUILD_HANDOFF.md`, `docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json`)만 허용한다. R2의 이 파일 Git blob과 실제 내용을 역사 입력으로 고정한다.
2. R2는 H SHA의 WSL-server API/Web/PG15 일부 PASS, 기존 R6 `STORED_ROW AssertionError` 1 FAIL, 신규 두 pair OIDC/HTTPS/Chromium 수직 인수 미실행, 독립 Tester `NOT_ACCEPTED`를 정직하게 유지한다. 제한적 시험을 E-SHOT/E-NET/E-API/E-AUD 또는 AV-SAFE-034/AV-OPS-027/AV-UI-017·공통 ID PASS로 승격하거나 PR/main 완료로 위조한 상태를 거부한다.
3. 새 비제품 epoch의 A→C 정확 code2→C 결박 문서 B→write/worker 순차 회수 H2를 각각 부모·한 커밋·허용 경로·실원격 ref·clean으로 검증한다. Event seq1~2309 원문과 H/R2 blob, 기존 완료 lease·U-01 미수락을 보존한다. 새 worker/write는 서로 다른 token, 유효 만료·정확 code2 경로·제품 scope0이다.
4. Event sequence/hash chain과 원문 prefix, snapshot hash, HANDOFF summary, detached digest, 승인 계약/WI/invocation hash, lease 시각·회수 순서, branch/upstream/HEAD/remote, U-02 잠금을 음성으로 검사한다. 새 route 없는 bootstrap RED와 문서 dirty의 Git INVALID를 PASS로 표기하지 않는다.

## TDD·검증·종료

- 먼저 R2의 부모/경로/blob/미수락 내용, Event/lease/digest/시각/remote/dirty 및 C/B/H2 경계 위조 음성을 RED로 추가한다. 기존 route를 수정하지 않고 새 정확 successor만 GREEN으로 만든다.
- 통제 집중·인접 회귀, `git diff --check`, 실제 G-05 exit code를 기록한다. Main은 code C를 독립 C0/I0 검토하고 기존 branch/private에 push해 원격 동일·clean을 확인한다.
- Main은 C를 B 문서에 결박한 뒤 G-05 확인, write→worker 순서로 lease를 회수한다. 이 통제 GREEN은 브라우저/DB 전체 인수 PASS가 아니다. 다음 별도 제품 검증 WI는 새 U-01 two-pair 브라우저 하네스와 기존 R6 실패 분리를 정확 경로로 발급한다.
- rollback은 새 successor commit만 정상 revert하되 H/R2 및 승인 계약·제품 코드·원격 복구 ref는 보존한다. 동일 정식 실패 3회면 Main takeover 규칙을 따른다.
