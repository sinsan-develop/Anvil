# F-19A 최소 등록·정확 pair grant 제품 WorkInstruction

- ID/revision: `WI-F19A-MINIMAL-PAIR-AUTH-20261007-001` / 1. 상태 `PREPARED_NOT_ISSUED`. 신산님의 2026-10-07 직접 `승인해`와 `docs/approvals/APPROVAL-20261007-F19A-PAIR-GRANT-CONTRACT-001.md`에 한정된다.
- 기준: 기존 단일 branch `codex/f18-wsl-ops`, predecessor local/private exact HEAD `abeab9f4e71387dcd6fed97b7061d6f50a73bbce`, canonical seq2138, worker/write null. 네 canonical 문서 hash는 승인 기록을 따른다. 승인 Spec SHA `A4AE1EE80530F2A05393A18409CDE2FC94543C1FAC8598365CD8A4EBB7032247`, 구현 계획 SHA `DE9BC55DF430552235578BE330A502B7B180F25496E34B8BC61C2B86FDF154B5`다.
- 목적: 승인 Spec의 정확 여섯 route·추가형 0020 등록/grant/audit·기존 고정 GET/ACK의 정확 pair guard를 구현하고, local→같은 clean Git SHA의 WSL-server 격리 PG15/OIDC/HTTPS/Chromium 증거를 얻는다. Task 0~4는 이 WI의 단일 Developer·단일 유효 dual lease 아래 순차 시행한다. U-01 제품 write와 F-20/U01 수락, Release/Production은 제외한다.
- Main 전용 통제 경로: `docs/approvals/APPROVAL-20261007-F19A-PAIR-GRANT-CONTRACT-001.md`, `docs/architecture/f19a/F19A_MINIMAL_PAIR_AUTH_CONTRACT.md`, `docs/work_orders/F-19A_MINIMAL_PAIR_AUTH_IMPLEMENTATION_PLAN.md`, 이 WI, `docs/WORK_STATUS.md`, `docs/progress/progress-events.json`, `docs/progress/build-progress.json`, `docs/progress/BUILD_HANDOFF.md`, F-19A 전용 detached digest. Main은 활성 Developer lease 중 아래 exact code/test/report 경로를 수정하지 않는다.
- 단일 Developer `developer-primary-f19a-pair-grant`의 exact path scope:
  1. `scripts/check_project_progress.py`
  2. `tests/tooling/test_f19a_start_projection.py`
  3. `migrations/versions/0020_f19a_registration_pair_grants.py`
  4. `packages/persistence/f19a_registration_repository.py`
  5. `tests/persistence/test_f19a_registration_repository.py`
  6. `tests/integration/test_f19a_registration_pg15.py`
  7. `packages/api/f19a_registration.py`
  8. `packages/api/registry.py`
  9. `packages/api/fastapi_app.py`
  10. `apps/api/anvil_api/asgi.py`
  11. `apps/api/anvil_api/oidc_process.py`
  12. `tests/api/test_f19a_registration_api.py`
  13. `packages/api/operations.py`
  14. `tests/api/test_f19a_fixed_operations_authorization.py`
  15. `deploy/wsl/f19a_qa_bootstrap.py`
  16. `tests/deploy/test_f19a_qa_bootstrap.py`
  17. `tests/integration/test_f19a_oidc_pg15.py`
  18. `tests/browser/f19a-pair-selection.mjs`
  19. `docs/04_test_reports/F-19A_MINIMAL_PAIR_AUTH_RESULT.md`
  기존 회귀 테스트 파일은 **실행만** 허용한다. 경로 확대가 필요하면 Main이 해당 파일·위험·승인 의미를 검토해 WI revision과 lease path_scope를 먼저 갱신한다. Developer의 Main 통제 경로 write, commit/push/merge, 다른 branch 생성·WSL 공용 자원 조작은 금지한다.
- 발급 전: Main은 실제 Git/원격/dirty·seq2138/G-05·승인/hash·기존 Event chain을 대조한다. 기존 Event 1~2138·완료 lease·기준 문서·과거 checkpoint는 불변으로 두고 **F-19A 독립 제품 Package identity**의 WI 발행→worker 발급→write 발급을 append-only 순서로 투영한다. 과거 F-20 문서 successor의 subject/step/work_package_id를 재사용하지 않는다. 서로 다른 새 execution/write fencing token, actor, 동일 WI SHA, exact19, UTC 발급·24시간 만료를 progress/HANDOFF/digest에 결박한다. 새 checker mode 부재의 bootstrap RED를 PASS로 쓰지 않는다. active G-05와 exact SHA checkpoint/private ref 확인 전 제품 write를 시작하지 않는다.
- Task 0: Developer는 새 mode의 frozen predecessor seq2138, 승인·WI hash, Event chain, 두 lease·token·time·exact path, snapshot/reference/digest/handoff/Git 범위 및 기존 공통 불변식을 RED→GREEN한다. Main 독립 C0/I0 및 G-05를 확인한 뒤 같은 lease의 Task 1을 진행시킨다.
- Task 1~3: 구현 계획에 따라 test-first RED를 실제 확인하고 0020 원장→여섯 API→기존 고정 GET/ACK 인가를 순차 구현한다. 각 절편 후 집중·인접 회귀/DB 검증, `git diff --check`, 독립 Critical0/Important0 확인 전 다음 절편을 시작하지 않는다. 등록-only·교차 pair·다른 actor·비활성·철회 다음 요청·DB 장애는 fail-closed로 증명한다.
- Task 4: 전용 WSL-server 격리 QA bootstrap/readiness/구 SHA rollback 사전 차단을 구현하고 local test/build/정적 검사·독립 검토를 마친다. Main이 lease를 정식 회수하고 안전 checkpoint/private push·정확 Git SHA를 확인한 후에만 WSL 전용 자원을 만든다. WSL의 실제 PostgreSQL 15/OIDC/HTTPS/Chromium·same-origin Network를 검증하고 정확 identity로 정리·잔여0을 기록한다. 테스트 PASS는 실행 범위에만 적용하고 독립 Tester 판정 전 F-19A `ACCEPTED`를 주장하지 않는다.
- 실패/복구: 유효한 정식 FAILURE_REPORT만 같은 lineage의 실패 횟수에 포함한다. 1회 보완, 2회 근거 재검토/revision, 3회 lease 회수·Main takeover를 적용한다. 구현/QA 실패 시 범위 밖 경로, old SHA rollback after grant state transition, 공유 DB 복원, force push/reset/rewrite로 우회하지 않는다. F-20/U01 `REWORK`, Release `DEFER`, Production `NOT_EXECUTED`를 유지한다.
- 호출문: “실제 WI SHA와 active dual lease·token·만료·exact19를 먼저 확인하세요. Task 0 control route의 RED→GREEN/G-05와 Main 독립 판정 후에만 Task 1~4를 순차 진행하세요. 승인 Spec만 구현하고 기존 GET/ACK 계약을 보존하세요. 허용 경로 밖 write·Main 통제 파일·WSL 공용 자원·commit/push/merge는 금지합니다. 변경 diff, 정확 명령/종료 코드/결과, 미검증/rollback을 보고하세요.”
