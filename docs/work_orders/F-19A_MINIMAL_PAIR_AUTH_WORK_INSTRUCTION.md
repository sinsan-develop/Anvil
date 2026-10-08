# F-19A 최소 등록·정확 pair grant 제품 WorkInstruction

- ID/revision: `WI-F19A-MINIMAL-PAIR-AUTH-20261007-001` / 3. 발급 상태는 canonical Event seq2139 `WORK_INSTRUCTION_ISSUED`가 증명한다. dual lease seq2140/2141은 Task0 checker/신규 test/역사 fixture test **정확 4경로만** 현재 write를 열고 `product_write_scope=[]`이다. 제품 경로는 Task0 독립 C0/I0·active G-05·정확 checkpoint 및 Task0 lease 회수 후 새로운 제품 dual lease 전까지 잠겨 있다. rev1의 활성 lease exact19 모순을 rev2에서 좁혔고, rev3은 인접 41건 중 역사 seq/시각 의존 3 FAIL의 test-only 복구 두 경로를 추가한 비의미 통제 revision이다. 신산님의 2026-10-07 직접 `승인해`와 `docs/approvals/APPROVAL-20261007-F19A-PAIR-GRANT-CONTRACT-001.md`에 한정된다.
- 기준: 기존 단일 branch `codex/f18-wsl-ops`, frozen predecessor seq2138의 base HEAD `abeab9f4e71387dcd6fed97b7061d6f50a73bbce`, 사전 통제 문서의 local/private checkpoint `129b9ada23f0026141a13f5c380be36baec6ad6a`, worker/write null. 발급 시 실제 clean dispatch HEAD와 remote를 다시 확인해 Event에 별도 기록한다. 네 canonical 문서 hash는 승인 기록을 따른다. 승인 Spec SHA `A4AE1EE80530F2A05393A18409CDE2FC94543C1FAC8598365CD8A4EBB7032247`; 현 구현 계획 SHA는 승인 기록의 비의미 통제 revision에 결박한다.
- 목적: 승인 Spec의 정확 여섯 route·추가형 0020 등록/grant/audit·기존 고정 GET/ACK의 정확 pair guard를 구현하고, local→같은 clean Git SHA의 WSL-server 격리 PG15/OIDC/HTTPS/Chromium 증거를 얻는다. Task 0~4는 이 WI의 단일 Developer가 **Task0 exact4 lease와 이후 별도 제품 lease**를 순차 사용한다. U-01 제품 write와 F-20/U01 수락, Release/Production은 제외한다.
- Main 전용 통제 경로: `docs/approvals/APPROVAL-20261007-F19A-PAIR-GRANT-CONTRACT-001.md`, `docs/architecture/f19a/F19A_MINIMAL_PAIR_AUTH_CONTRACT.md`, `docs/work_orders/F-19A_MINIMAL_PAIR_AUTH_IMPLEMENTATION_PLAN.md`, 이 WI, `docs/WORK_STATUS.md`, `docs/progress/progress-events.json`, `docs/progress/build-progress.json`, `docs/progress/BUILD_HANDOFF.md`, F-19A 전용 detached digest. Main은 활성 Developer lease 중 아래 exact code/test/report 경로를 수정하지 않는다.
- 단일 Developer `developer-primary-f19a-pair-grant`의 **WI 전체 허용 상한 exact21**(현재 Task0 lease의 path_scope가 아님):
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
  20. `tests/tooling/test_f20_u01_contract_successor_projection.py` (Task0 역사 fixture만)
  21. `tests/tooling/test_f20_u01_r48_close_projection.py` (Task0 역사 시각만)
  기존 회귀 테스트 파일은 **실행만** 허용한다. 경로 확대가 필요하면 Main이 해당 파일·위험·승인 의미를 검토해 WI revision과 lease path_scope를 먼저 갱신한다. Developer의 Main 통제 경로 write, commit/push/merge, 다른 branch 생성·WSL 공용 자원 조작은 금지한다.
- 발급 전: Main은 실제 Git/원격/dirty·seq2138/G-05·승인/hash·기존 Event chain을 대조한다. 기존 Event 1~2138·완료 lease·기준 문서·과거 checkpoint는 불변으로 두고 **F-19A 독립 제품 Package identity**의 WI 발행→worker 발급→write 발급을 append-only 순서로 투영한다. 과거 F-20 문서 successor의 subject/step/work_package_id를 재사용하지 않는다. 서로 다른 새 execution/write fencing token, actor, 동일 WI SHA, **Task0 exact4 path scope·제품 scope0**, UTC 발급·24시간 만료를 progress/HANDOFF/digest에 결박한다. 새 checker mode 부재의 bootstrap RED를 PASS로 쓰지 않는다. active G-05와 exact SHA checkpoint/private ref 확인 전 제품 write를 시작하지 않는다.
- Task 0: Developer는 새 mode의 frozen predecessor seq2138, 승인·WI hash, Event chain, 두 lease·token·time·exact path, snapshot/reference/digest/handoff/Git 범위 및 기존 공통 불변식을 RED→GREEN한다. 기존 두 test 파일에서는 seq2141을 과거 epoch70 fixture로 오인하거나 만료된 R48 lease에 현재 시각을 대입하는 부분만 frozen 역사 fixture/역사 유효 시각으로 보정하고 41건 전체를 재실행한다. Main 독립 C0/I0·active G-05·정확 checkpoint 후 Task0 lease를 정식 회수하고 새 제품 dual lease를 발급해야만 Task 1을 진행한다.
- Task 1~3: 구현 계획에 따라 test-first RED를 실제 확인하고 0020 원장→여섯 API→기존 고정 GET/ACK 인가를 순차 구현한다. 각 절편 후 집중·인접 회귀/DB 검증, `git diff --check`, 독립 Critical0/Important0 확인 전 다음 절편을 시작하지 않는다. 등록-only·교차 pair·다른 actor·비활성·철회 다음 요청·DB 장애는 fail-closed로 증명한다.
- Task 4: 전용 WSL-server 격리 QA bootstrap/readiness/구 SHA rollback 사전 차단을 구현하고 local test/build/정적 검사·독립 검토를 마친다. Main이 lease를 정식 회수하고 안전 checkpoint/private push·정확 Git SHA를 확인한 후에만 WSL 전용 자원을 만든다. WSL의 실제 PostgreSQL 15/OIDC/HTTPS/Chromium·same-origin Network를 검증하고 정확 identity로 정리·잔여0을 기록한다. 테스트 PASS는 실행 범위에만 적용하고 독립 Tester 판정 전 F-19A `ACCEPTED`를 주장하지 않는다.
- 실패/복구: 유효한 정식 FAILURE_REPORT만 같은 lineage의 실패 횟수에 포함한다. 1회 보완, 2회 근거 재검토/revision, 3회 lease 회수·Main takeover를 적용한다. 구현/QA 실패 시 범위 밖 경로, old SHA rollback after grant state transition, 공유 DB 복원, force push/reset/rewrite로 우회하지 않는다. F-20/U01 `REWORK`, Release `DEFER`, Production `NOT_EXECUTED`를 유지한다.
- 호출문: “실제 WI SHA와 active dual lease·token·만료·Task0 exact4를 먼저 확인하세요. 현재는 checker/신규 test/역사 test 두 파일에서 Task0 RED→GREEN과 인접 41건만 처리하고 제품 경로에는 쓰지 마세요. Main이 독립 C0/I0·G-05·정확 checkpoint 후 Task0 lease를 회수하고 새 제품 lease를 발급하면 Task 1~4를 순차 진행하세요. 승인 Spec만 구현하고 기존 GET/ACK 계약을 보존하세요. 허용 경로 밖 write·Main 통제 파일·WSL 공용 자원·commit/push/merge는 금지합니다. 변경 diff, 정확 명령/종료 코드/결과, 미검증/rollback을 보고하세요.”
