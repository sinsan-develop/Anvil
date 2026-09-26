# F-18 R38 OIDC host binding WorkInstruction

- 담당: `developer-primary` 단일 제품 writer. Main의 새 canonical worker/write lease·G-05 확인 전 제품 write 금지.
- `MAIN_RECONFIRMED_NON_SEMANTIC`: 부모 승인 `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`, F-18 기본 WorkInstruction 및 R37 seq1618 checkpoint의 내부 결선 단계다. 기능·요구사항·중요 위험 범위를 넓히지 않는다.
- 제품 exact3: `apps/api/anvil_api/asgi.py`, `tests/api/test_oidc_asgi_binding.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. `runtime.py`, 기존 OIDC 코어, Web, DB/migration, deploy, Secret 파일 및 Main control/progress/HANDOFF 변경 금지.
- 목표·명시 입력·거부 계약·RED→GREEN·검증·rollback은 `F-18_WSL_OPS_R38_OIDC_HOST_BINDING_PLAN.md`를 따른다. MockTransport/SQLite/TestClient 결과를 실제 issuer·PG18·브라우저·정식 WSL 통합 PASS로 대체하지 않는다.
- 완료보고: 시작 HEAD/branch/status, 기준 문서 hash, 두 fencing token, exact3 diff, RED/GREEN·회귀·전체 pytest 명령/exit, SKIP/BLOCKED, Secret/JWKS 비식별과 기존 기본 ASGI 경계 보존, 잔여 위험, rollback, 오류 횟수, 제품 commit SHA. Main이 push·WSL·lease 회수를 소유한다.
