# WI-U01-SCOPED-DASHBOARD-TASK1-20261009-001

## 판정·기준선

신산님 승인 B 계약(`docs/04_test_reports/U-01_SCOPED_DASHBOARD_CONTRACT_PROPOSAL.md`, SHA-256 `5B13E92A16A903F2887BA5F3E038AA5A41BBBBA667EE0DED57FF9C39E7BCA584`)과 승인 기록(`docs/approvals/APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001.md`, SHA-256 `60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39`)을 부모로 한다. 구현 계획 `docs/work_orders/U-01_SCOPED_DASHBOARD_IMPLEMENTATION_PLAN.md` SHA-256은 `002977BDB7B634E974E4926F1FA52D6DC520450F92EBE64AB490EE6BD773C8C3`이다. 기존 단일 branch `codex/u01-dashboard-r2`의 epoch100 H `ba8c9c3c4e31c5334e658c40787f019925c8c5a6`가 local/private 동일·clean, G-05 seq2289 PASS, 두 lease REVOKED다. U-01 수직 수락은 아직 아니다.

## 정확 범위·소유

- Main은 이 WI·invocation, append-only Event, progress/HANDOFF/digest/WORK_STATUS, Git checkpoint·push, 독립 검토를 소유한다. 새 branch를 만들지 않는다.
- 단일 Developer `developer-primary-u01-scoped-dashboard-task1`은 새 worker/write fencing token 둘 다 유효하고 A 문서 local/private 동일·clean을 통지받은 뒤에만 지정 경로를 쓴다. Main은 Developer lease 활성 중 그 경로를 쓰지 않는다.
- 통제 경로: `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py`.
- 제품 경로: `packages/persistence/f19a_registration_repository.py`, `packages/api/f19a_registration.py`, `packages/api/registry.py`, `packages/api/fastapi_app.py`, `apps/api/anvil_api/asgi.py`, `apps/api/anvil_api/oidc_process.py`, `tests/persistence/test_f19a_registration_repository.py`, `tests/api/test_f19a_registration_api.py`, 새 `tests/api/test_u01_scoped_dashboard_api.py`.
- 제품 9경로는 통제 RED→GREEN, 독립 C0/I0, 활성 G-05, 정확 통제 C/B 원격 checkpoint·clean 이후에만 연다. 그 전 제품 write scope는 실질적으로 잠금이다. Git commit/push·문서·DB·WSL-server 작업은 Developer가 하지 않는다.

## Task 1 제품 계약

1. 새 `GET /api/projects/{projectId}/environments/{environmentId}/dashboard?period=1d|7d|30d`만 추가한다. `period` 정확 1회가 필수이고 다른 query·중복·비정규 값은 400이다. `data`/`request_id` envelope을 유지한다.
2. 인증 actor와 coarse `dashboard:read`를 먼저 검사하고, 같은 DB read 경계의 활성 Project·Environment와 정확 `(actor, project, environment, dashboard:read, active)` grant를 검증해 네 표시 필드를 반환하는 `require_dashboard_pair(actor_id, project_id, environment_id) -> dict`를 구현한다. 독립 ID 집합 교차조합, 철회·비활성·다른 actor·미등록은 원본 조회 전 403, DB 권한 원본 장애는 503이다. 이름을 별도 목록 호출로 재조회하지 않는다.
3. 검증 뒤에만 `scoped_dashboard_reader(project_id, environment_id, period_key, observed_at)`를 호출한다. Reader 미주입·원본 장애는 503이며 기존 host 고정 Dashboard GET으로 fallback하지 않는다. Task 1은 API shell이므로 Task 2의 실제 기간·현재/발생 reader 구현이나 허위 데이터는 만들지 않는다.
4. 기존 `GET /api/dashboard/project-environments`, `GET /api/dashboard/operations`, Critical ACK의 경로·인가·응답 의미를 바꾸지 않는다. 새 migration/schema/지속 쓰기·감사 Event 수정·Secret·certificate·Production/ysna 작업은 금지한다.

## TDD·검증·게이트

- 통제 먼저: epoch100 H와 새 A→C→B→제품 C/P→H의 정확 successor를 fail-closed로 검증한다. Event 원문·chain·lease/token/scope·snapshot/digest·Git branch/upstream/remote/clean 및 기존 U-01 미수락을 위조 음성으로 검사한다. 새 route 부재 bootstrap RED를 PASS로 기록하지 않는다.
- 제품 RED 테스트: exact pair 성공, 미허용 교차조합·철회·비활성·미등록·다른 actor 403, DB/Reader 장애 503, 원본 선호출 0, query 누락·중복·초과·비정규 400, 기존 GET/ACK 불변. 최소 구현으로 GREEN을 만든다.
- 집중 pytest, 기존 F-19A/OIDC/Operations API 회귀, OpenAPI 경로·권한, Ruff 변경 줄 신규0, `git diff --check`, 활성/종료 G-05를 실제 종료 코드와 함께 보고한다. mock/fixture만으로 DB·WSL·브라우저 PASS를 주장하지 않는다.
- Main은 통제 C/B 게시·remote·clean 후에만 제품 write 개방, 제품 C/P·검증/독립 리뷰 뒤 두 lease를 write→worker 순으로 회수한다. 잔여 실패·skip·미검증은 WORK_STATUS에 명시한다. Task 2/3/4, PR/main 병합은 각각 후속 게이트다.

## 실패·복구

동일 정식 `FAILURE_REPORT`의 1·2·3회 절차와 Main takeover 규칙을 적용한다. 실패·중단 시 dirty 파일을 삭제/reset하지 않고 기존 branch의 안전한 WIP·원격 복구 ref와 상태를 남긴다. rollback은 이 Task 1의 신규 route·pair 조회 commit을 revert하되 기존 F-19A 등록 원장·GET/ACK·감사 Event는 보존한다.
