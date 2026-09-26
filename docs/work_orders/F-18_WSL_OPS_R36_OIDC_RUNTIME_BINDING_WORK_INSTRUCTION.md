# F-18 R36 OIDC runtime binding WorkInstruction

- 담당: `developer-primary` 단일 제품 writer. Main의 canonical worker/write lease 발행과 G-05 확인 전 제품 write 금지.
- `MAIN_RECONFIRMED_NON_SEMANTIC`: 부모 승인 `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`, F-18 기본 WorkInstruction, 시작 checkpoint seq1608에 결박된 내부 런타임 결선이다. 기능·요구사항·중요 위험 범위를 확대하지 않는다.
- 제품 exact3: `packages/api/runtime.py`, `tests/api/test_runtime_app.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. ASGI 엔트리포인트, Web, DB/migration, deploy 설정, OIDC 코어 및 다른 파일 변경 금지.
- 목표·거부 계약·TDD RED→GREEN·검증·rollback은 `F-18_WSL_OPS_R36_OIDC_RUNTIME_BINDING_PLAN.md`를 따른다. 실제 issuer·PG·브라우저·WSL 운영 유사 통합을 주입/fixture PASS로 대체하지 않는다.
- 완료보고: 시작 HEAD/branch/status, 기준 문서 hash, 두 fencing token, exact3 diff, RED/GREEN과 기존 회귀·전체 pytest 명령/exit, 미실행/SKIP/BLOCKED, 기존 COOKIE/WSL_ACCEPTANCE 보존과 OIDC fail-closed 증거, 잔여 위험, rollback, 오류 횟수, 제품 commit SHA. Main control/progress/HANDOFF·push·병합은 수정하지 않는다.
