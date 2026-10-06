# F-19A 최소 등록·정확 pair grant 구현 계획

> Agent 작업자: 각 절편의 WorkInstruction과 유효 worker/write lease를 먼저 확인한다. TDD RED→GREEN, 독립 검토, Main 통제 종료를 순서대로 수행한다. 이 계획의 여러 절편은 기존 `codex/f18-wsl-ops` **한 브랜치**에서 직렬 실행하며 다른 작업 브랜치를 만들지 않는다.

**목표:** 등록된 활성 Project→Environment의 정확 조합과 actor·permission·active grant만 Dashboard 선택 목록 및 기존 고정 GET/ACK 접근에 사용한다.

**구조:** 0018 OIDC 주체 원장은 유지하고 0020에 등록·grant·audit를 추가한다. 서버는 세션의 actor를 읽은 뒤 매 요청마다 정확 pair를 조회하며, 별도 등록 API와 기존 GET/ACK 가드를 통합한다. WSL-server 격리 QA에서 명시 seed/readiness 후 같은 SHA의 실제 검증을 수행한다.

**기술:** Python, FastAPI, SQLAlchemy/Alembic, PostgreSQL 15, 기존 OIDC/HTTPS/Chromium QA harness.

**Spec:** `docs/architecture/f19a/F19A_MINIMAL_PAIR_AUTH_CONTRACT.md`; 승인 기록 `docs/approvals/APPROVAL-20261007-F19A-PAIR-GRANT-CONTRACT-001.md`.

## 전역 제약

- 설계/계획/매트릭스/테스트 SHA는 승인 기록에 적힌 네 값으로 고정한다. 시작 기준은 `codex/f18-wsl-ops@abeab9f4e71387dcd6fed97b7061d6f50a73bbce`, Event seq2138, dual lease 없음이다.
- `ysna-server`·Production·공유/지속 DB 복원·U-01 제품 write·F-20/U01 수락·Release GO는 제외한다. 기존 세션·계정·Secret·공용 role을 변경하지 않는다.
- Main만 approval/spec/plan/WI/progress/HANDOFF/Event/digest를 쓴다. F-19A code는 정확 경로 전체를 고정한 **하나의 WI·유효 dual lease·한 명의 Developer**가 Task 0~4 순서로 수정한다. Main은 lease 동안 그 파일에 쓰지 않는다.
- 6개 route pattern과 JSON/오류·권한·rollback 계약은 Spec을 따른다. Project/Environment 등록이 grant를 자동 생성하지 않는다.
- 기존 `GET /api/dashboard/operations`, `GET /api/operations/alerts`, `POST /api/operations/alerts/{alertId}:acknowledge`의 method/path/body/성공 결과를 보존한다. 정확 grant 부재/철회는 다음 요청에 403, DB 장애는 503이다.
- 로컬 코드·기본 테스트→정확 commit/private push→WSL-server Git exact clean SHA의 격리 QA. 테스트/fixture/build/health만으로 실제 브라우저·DB PASS나 F-19A 수락을 주장하지 않는다.

## 검토 집중점

1. 두 독립 ID 집합에 각각 포함되지만 등록/권한 없는 교차 pair가 목록 또는 기존 GET/ACK를 통과하지 않는가? → Task 2·3 음성 테스트.
2. grant 철회 또는 Project/Environment 비활성 직후 기존 세션의 다음 목록·GET·ACK가 거절되는가? → Task 2·3·4 실제 요청.
3. DB 장애가 정상 빈 목록·403·허용으로 변환되지 않는가? → Task 1·2·3 장애 테스트.
4. 다른 actor의 등록·grant와 동명이지만 다른 Project의 Environment가 서로 섞이지 않는가? → Task 1·2 격리 테스트.
5. 철회 이후 과거 앱 SHA로 rollback하면 권한이 재개되는 위험을 runbook·readiness 가드가 차단하는가? → Task 4 격리 QA에서 구 SHA 전환을 실제 수행하지 않고 차단 결과를 검증한다.

## 파일·절편 지도

| 절편 | 책임 | 예상 파일(정확 허용 목록은 절편 WI에서 봉인) |
|---|---|---|
| 0 | Main 승인 결박·단일 branch control successor·dual lease; Developer checker route | Main: `docs/approvals/...`, `docs/architecture/f19a/...`, 이 계획, `docs/work_orders/F-19A_*`, `docs/progress/*`, `docs/WORK_STATUS.md`; Developer: `scripts/check_project_progress.py`, `tests/tooling/test_f19a_start_projection.py` |
| 1 | 0020 migration 및 등록/grant/audit 저장 권위 | `migrations/versions/0020_f19a_registration_pair_grants.py`, `packages/persistence/f19a_registration_repository.py`, `tests/persistence/test_f19a_registration_repository.py`, `tests/integration/test_f19a_registration_pg15.py` |
| 2 | 여섯 API route와 권한·응답 변환 | `packages/api/f19a_registration.py`, `packages/api/registry.py`, `packages/api/fastapi_app.py`, `apps/api/anvil_api/asgi.py`, `apps/api/anvil_api/oidc_process.py`, `tests/api/test_f19a_registration_api.py` |
| 3 | 기존 고정 GET/ACK의 정확 grant 매 요청 검사 | `packages/api/operations.py`, `packages/api/fastapi_app.py`, `apps/api/anvil_api/oidc_process.py`, `tests/api/test_f19a_fixed_operations_authorization.py`, 기존 OIDC/Operations 회귀 테스트 |
| 4 | 격리 QA bootstrap·readiness·복구 가드, 동일 SHA 실제 증거 | `deploy/wsl/f19a_qa_bootstrap.py`, `tests/deploy/test_f19a_qa_bootstrap.py`, `tests/integration/test_f19a_oidc_pg15.py`, `tests/browser/f19a-pair-selection.mjs`, `docs/04_test_reports/F-19A_*`; WSL 전용 자원은 Main 소유 |

Task 2·3은 `fastapi_app.py`/`oidc_process.py`를 공유하므로 **동시 writer 금지**·같은 Developer의 순차 진행이다. Task 1의 저장 interface를 먼저 확정하고 Task 2·3이 소비한다. 모든 code/test 경로는 최초 WI의 단일 path_scope에 고정하며 확대가 필요하면 Main이 semantic/risk를 분류한 revision 없이 쓰지 않는다. Task 4의 QA 코드는 WSL 실행 전 같은 branch에 commit·push한다.

### Task 0: 승인·통제 기준선

- [ ] Main이 승인 원문·Spec/Plan SHA, 실제 Git/원격·Event seq2138·no lease·G-05를 대조하고 F-19A successor WI에 목적/정확 경로/제외/회수/복구를 고정한다.
- [ ] Main이 append-only WI→worker→write Event와 서로 다른 epoch token·24시간 만료·정확 Developer 허용 경로를 progress/HANDOFF/digest에 결박한다. 새 mode route 부재의 bootstrap RED를 기록한다.
- [ ] 단일 Developer가 checker route의 frozen seq2138, 승인/WI SHA, Event chain, token/path/시간, snapshot/refs/digest/dirty 및 공통 불변식 테스트를 RED→GREEN한다. Main이 독립 리뷰·active G-05를 확인한 뒤 같은 유효 lease의 Task 1 제품 변경을 진행시킨다.

### Task 1: 지속 등록·정확 grant 원장

**생산 interface:** `F19ARegistrationRepository(session_factory)`의 `register_project(actor_id,project_id,display_name)`, `register_environment(actor_id,project_id,environment_id,display_name)`, `set_registration_active(actor_id,project_id,environment_id_or_none,active)`, `set_pair_grant(admin_actor_id,target_actor_id,project_id,environment_id,permission,active)`, `list_dashboard_pairs(actor_id)`, `require_pair_grant(actor_id,project_id,environment_id,permission)`. 결과 DTO와 안정 오류 코드는 Spec의 API로 매핑 가능해야 한다.

- [ ] **RED:** `test_f19a_registration_repository.py`에 등록 actor/시각, composite FK, 다른 Project의 같은 Environment, 교차 pair 거절, 자동 grant 없음, grant/audit 원자성, 철회 다음 조회, DB 불가 fail-closed를 각각 독립 테스트로 작성하고 예상 실패를 확인한다.
- [ ] **GREEN:** 0020 추가형 migration과 repository를 최소 구현한다. 0018/0019 및 기존 데이터는 수정하지 않는다.
- [ ] **검증:** 집중 단위·PG15 migration/제약/backup-restore/downgrade 차단, 기존 0018 OIDC 회귀, `git diff --check`를 실행해 정확 결과·SKIP를 기록한다. 임시 DB는 신원 확인 후 제거한다.
- [ ] **경계:** Developer 결과/독립 리뷰 C0/I0 후 Main이 승인 exact path만 checkpoint한다. 제품 acceptance가 아니라 저장 권위 절편 통과다.

### Task 2: 최소 등록·목록 API

**소비:** Task 1의 repository interface. **생산:** Spec의 6 route와 JSON/오류 계약. `GET /api/dashboard/project-environments`는 현재 actor의 활성 등록 pair∩활성 `dashboard:read`만 매 요청 반환한다.

- [ ] **RED:** `test_f19a_registration_api.py`에 6 route의 body/성공·400/401/403/404/409/503 envelope, 등록-only 무권한, 관리자 외 grant 금지, self-grant 금지, 독립 ID 교차 pair·다른 actor·비활성·철회 다음 목록을 작성하고 feature 부재로 실패함을 확인한다.
- [ ] **GREEN:** 서버 route/registry/인가 adapter를 최소 구현한다. 기존 `POST /api/projects` 역사 계약과 `/api/projects/scan`, 기존 GET/ACK body·성공 응답은 변경하지 않는다. 브라우저 코드에 절대 내부 API 주소를 추가하지 않는다.
- [ ] **검증:** API 집중+기존 OIDC/route 회귀·G-05·diff check, 독립 spec/quality C0/I0. Main checkpoint 후 같은 Developer가 Task 3을 진행한다.

### Task 3: 기존 고정 Operations 권한 전환

**소비:** Task 1 `require_pair_grant`. **생산:** 고정 host pair의 Dashboard GET/alerts GET/ACK가 각 지정 permission의 활성 정확 grant를 매 요청 요구한다.

- [ ] **RED:** `test_f19a_fixed_operations_authorization.py`에 기존 세 요청의 이전 성공 body·상태, grant 부재/교차/철회/등록 비활성의 403 기존 envelope, DB 불가 503, 기존 세션 재사용 다음 요청을 작성하고 의도한 실패를 확인한다.
- [ ] **GREEN:** 현재 `_authorize`/Operations 호출 경계에 server-owned exact pair guard를 결합한다. 독립 ID 집합·캐시·클라이언트 ID를 최종 권위로 쓰지 않고 다른 endpoint는 변경하지 않는다.
- [ ] **검증:** 집중+현재 OIDC/Operations/API 전체 인접 회귀, G-05, diff check, 독립 C0/I0. 명시 grant 없는 기존 actor가 403이 되는 것은 승인된 호환성 강화이며 readiness 전 실제 전환 금지다.

### Task 4: 격리 QA 최초 관리자·cutover·복구

- [ ] **RED:** QA bootstrap 테스트에 정확 manifest/기존 actor·role·binding 충돌/권한 초과/멱등 재실행, readiness 누락·중복·다른 pair 0, 철회 후 구 SHA 단순 rollback 요청의 사전 거절을 작성하고 실패를 확인한다.
- [ ] **GREEN:** 지정 WSL-server 격리 QA DB에만 적용하는 harness·runbook을 구현한다. Secret 원문/기존 role 변경·Production 접속·공유 DB 전역 restore는 금지한다.
- [ ] **Local:** 집중·인접 회귀, migration upgrade/restore/데이터 존재 downgrade guard, typecheck/lint/build(해당 변경), G-05·diff·독립 리뷰를 PASS/FAIL/SKIP 그대로 기록한다. Main이 dual lease를 append-only 회수하고 정확 checkpoint를 만든 뒤 clean G-05·회귀를 다시 실행한다.
- [ ] **WSL:** Main이 exact SHA를 private branch로 push한 뒤 WSL-server에서 Git fetch/pull해 clean SHA 확인, 격리 PG15/OIDC/HTTPS/Chromium·same-origin Network의 등록→grant→선택→기존 GET/ACK→철회/비활성·장애·복구를 실제 검증한다. 자원 이름/수명/정리 방법을 시작 전 WORK_STATUS에 기록하고 완료 후 exact identity로 제거·잔여 0을 확인한다.
- [ ] **판정:** 독립 Tester가 `AV-OPS-026`·`AV-SAFE-034`, 기존 기능 회귀, backup/restore와 미검증 범위를 확인하기 전 F-19A `ACCEPTED` 금지. U-01 write는 F-19A 수락 뒤에만 발급한다. Release `DEFER`, Production `NOT_EXECUTED`.
