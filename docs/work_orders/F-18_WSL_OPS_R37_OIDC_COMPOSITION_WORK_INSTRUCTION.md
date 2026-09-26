# F-18 R37 OIDC trusted composition WorkInstruction

- 담당: `developer-primary` 단일 제품 writer. Main이 canonical worker/write lease를 발행하고 G-05를 확인하기 전 제품 write 금지.
- `MAIN_RECONFIRMED_NON_SEMANTIC`: 부모 승인 `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`, F-18 기본 WorkInstruction, 시작 checkpoint seq1613에 결박된 내부 구성 단계다. 기능·요구사항·중요 위험 범위를 확대하지 않는다.
- 제품 exact3: `packages/api/oidc_runtime_factory.py`, `tests/api/test_oidc_runtime_factory.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. `runtime.py`, ASGI/Web, DB/migration, deploy 설정, 기존 OIDC 코어 및 다른 파일 변경 금지.
- 목표·입출력·거부 계약·RED→GREEN·검증·rollback은 `F-18_WSL_OPS_R37_OIDC_COMPOSITION_PLAN.md`를 따른다. MockTransport/SQLite 결과를 실제 issuer·PG18·브라우저·정식 WSL 통합 PASS로 대체하지 않는다.
- 완료보고: 시작 HEAD/branch/status, 기준 문서 hash, 두 fencing token, exact3 diff, RED/GREEN·회귀·전체 pytest 명령/exit, 미실행/SKIP/BLOCKED, Secret/JWKS 비식별과 기존 auth 경계 보존, 잔여 위험, rollback, 오류 횟수, 제품 commit SHA. Main control/progress/HANDOFF·push·병합은 수정하지 않는다.
