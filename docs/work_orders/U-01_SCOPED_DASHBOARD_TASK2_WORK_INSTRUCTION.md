# WI-U01-SCOPED-DASHBOARD-TASK2-20261009-001

## 판정·기준선

신산님이 승인한 정확 pair·기간 Dashboard 계약(`docs/04_test_reports/U-01_SCOPED_DASHBOARD_CONTRACT_PROPOSAL.md`, SHA-256 `5B13E92A16A903F2887BA5F3E038AA5A41BBBBA667EE0DED57FF9C39E7BCA584`)과 승인 기록(`docs/approvals/APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001.md`, SHA-256 `60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39`)을 부모로 한다. 승인 구현 계획 `docs/work_orders/U-01_SCOPED_DASHBOARD_IMPLEMENTATION_PLAN.md` SHA-256 `002977BDB7B634E974E4926F1FA52D6DC520450F92EBE64AB490EE6BD773C8C3`의 Task 2만 수행한다. 기존 단일 branch `codex/u01-dashboard-r2`의 Task1 H `10b7edf500699eeab91eb2c9b03988a6a2f4c34b`가 local/private 동일·clean, G-05 seq2294 PASS이며 epoch101 두 lease는 REVOKED다. U-01 수직 인수는 아직 아니다.

## 정확 범위·소유

- Main은 이 WI·invocation, append-only Event, progress/HANDOFF/digest/WORK_STATUS, Git checkpoint·push와 독립 검토를 소유한다. 새 branch를 만들지 않는다.
- 단일 Developer `developer-primary-u01-scoped-dashboard-task2`는 새 worker/write fencing token 모두 유효하고 A 문서 local/private 동일·clean을 Main이 통지한 뒤에만 지정 경로를 쓴다. Main은 활성 Developer lease 동안 그 경로를 수정하지 않는다.
- 통제 2경로: `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py`.
- 제품 12경로: 새 `packages/api/scoped_dashboard.py`, `packages/api/fastapi_app.py`, `packages/observability/service.py`, `packages/persistence/operations_repository.py`, `apps/api/anvil_api/oidc_process.py`, `tests/api/test_u01_scoped_dashboard_api.py`, 새 `tests/api/test_u01_scoped_dashboard_reader.py`, `tests/api/test_oidc_process.py`, `tests/api/test_oidc_asgi_binding.py`, `tests/observability/test_f13_operations.py`, `tests/persistence/test_f14_operations_repository.py`, 새 `tests/integration/test_u01_scoped_dashboard_pg15.py`.
- 제품 write는 통제 RED→GREEN·독립 C0/I0·활성 G-05·통제 C/B 원격 checkpoint·clean을 Main이 확인한 후에만 연다. Git commit/push·문서·DB·WSL-server 작업은 Developer가 하지 않는다.

## Task 2 제품 계약

1. Task1의 `scoped_dashboard_reader(project_id, environment_id, period_key, observed_at)`에 요청별 구현 `read_scoped_dashboard`를 연결한다. 검증된 정확 pair 뒤에만 해당 scope의 owner를 새로 만들고 다른 조합 source/cache/audit을 재사용하지 않는다. Task1의 공개 route·pair 인가·기존 GET/ACK는 불변이다.
2. `observed_at`은 UTC-aware여야 하고 `period_key`는 정확 `1d|7d|30d`다. `Asia/Seoul`의 오늘 포함 1/7/30 달력일 현지 자정으로 `startUtc`/`endUtc`를 만들고 `[startUtc,endUtc)` 및 실측 상한 `min(endUtc,observedAt)`을 적용한다. 월말·윤일·DST 없는 서울 기준과 브라우저 다른 timezone을 테스트한다. 반환 `period`에는 `key`, `timeZone`, `startUtc`, `endUtc`, `observedAt`을 포함해 Task1 shell의 고정 상위 키·기간 일치 조건을 만족시킨다.
3. `current`와 `occurrences`는 별도 serializer다. 해당 pair의 현재 Health 6종, Run/Queue/Agent/Provider, 승인 대기·BLOCKED·Gate·비용·baseline, 미해결 Critical/Next Action 중 검증 가능한 원본만 표시한다. 항목 원본·관측시각·scope·완전성이 없는 값은 `UNAVAILABLE`, 숫자는 `null`, 이유 코드로 표기한다. 가짜 0/PASS/성공·현재 snapshot의 기간 수치 승격은 금지한다.
4. 미해결 Critical 전체는 검증된 완전 원본에서 읽는다. 100건 페이지·부분 조회·sequence gap·누락으로 전체를 보장하지 못하면 조용히 일부만 반환하지 않고 현재 read를 503 `DASHBOARD_SOURCE_UNAVAILABLE`로 실패-폐쇄한다. 기간 밖에서 발생했지만 미해결인 Critical과 Next Action은 현재 영역에 유지한다.
5. 기간 발생의 `criticalDetected`는 같은 pair의 append-only Operations audit `DETECTED` 중 `CRITICAL` 사건을 전 구간 완전 조회·alert ID 중복 제거가 증명될 때만 `AVAILABLE/count`로 제공한다. 다른 완전 원본이 없는 Run 시작·Gate 실패·비용 초과·baseline 충돌은 `UNAVAILABLE/count:null`이다. 각 지표는 `status`, `count`, `source`, `observedAt`, `reason`을 갖고 `sourceCompleteness`에는 원본·pair scope·사건 시각·전체/부분·최종 관측·결손 이유를 둔다.
6. 새 migration/schema·지속 쓰기·기존 감사 Event 변경·Secret/certificate·운영/ysna-server는 금지한다. 부족한 원본은 무리하게 구성하거나 승인 범위를 넓히지 말고 Main에게 정확한 증거를 보고한다.

## TDD·검증·게이트

- 통제 먼저: epoch101 H seq2294에서 새 WI/dual lease A→통제 C/B→제품 D/P→H의 정확 successor만 수용하는 fail-closed route를 RED→GREEN한다. Event 원문·chain, 24시간 분리 token/scope, snapshot/digest, branch/upstream/remote/clean, 기존 Task1 불변과 U-01 미수락을 위조 음성으로 검증한다. 신규 route 부재 bootstrap RED를 PASS로 기록하지 않는다.
- 제품 RED: 서울 자정·월말·윤일·UTC 경계·미래 제외, 현재/기간 분리, 100건 초과/부분/누락/gap/중복 alert, 기간 밖 미해결 Critical, source gap, 권한 확인 전 원본 호출0, 요청별 owner 분리, 기존 GET/ACK 불변을 테스트한다. 최종 PG15 통합 테스트는 WSL-server 격리 opt-in이므로 로컬 SKIP을 PASS로 승격하지 않는다.
- 집중 pytest, 인접 Operations/F-19A/OIDC/API 회귀, Ruff 변경 줄 신규0, `git diff --check`, G-05를 정확 종료 코드와 함께 보고한다. 실제 PG15/OIDC/HTTPS/Chromium은 Main이 Git exact SHA를 WSL-server에서 검증하기 전 미검증이다.
- Main은 통제 C/B 원격·clean·G-05 후에만 제품 write 개방한다. 제품 D/P·검증·독립 리뷰 후 두 lease를 write→worker 순서로 회수한다. Task3·PR/main 병합은 후속 게이트다.

## 실패·복구

동일 정식 `FAILURE_REPORT` 1·2·3회 절차와 Main takeover 규칙을 적용한다. 실패·중단 시 dirty 파일을 reset/삭제하지 않고 안전한 WIP·원격 복구 ref와 상태를 남긴다. rollback은 이 Task2 Reader·serializer 연결 commit을 revert하되 Task1 정확 pair API shell·기존 GET/ACK·등록 원장·감사 Event를 보존한다.
