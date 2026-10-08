# F-20/U-01 R39 Artifact Store Health Gap WorkInstruction

- 책임: 단일 `developer-primary`만 제품 writer. Main은 lease·독립 검토·Git·WSL-server QA·종료 통제를 소유한다.
- 기준: `Anvil_설계서_v2.md` §29.2, `Anvil_작업계획서_v1.md` U-01, `docs/04_test_reports/F-20_U01_R39_ARTIFACT_HEALTH_GAP_PLAN.md` 및 현행 C30 seq2048 `RECOVERED_WITH_QUARANTINED_HISTORY`. 작업 전 기준 hash·branch/HEAD·Git status와 canonical 유효 dual token을 확인한다.
- 제품 write exact4: `packages/observability/projection.py`, `tests/observability/test_f13_operations.py`, `tests/api/test_f20_u01_r10_dashboard_api.py`, `docs/04_test_reports/F-20_U01_R39_ARTIFACT_HEALTH_GAP_RESULT.md`.
- 목적: `artifact_store` 실제 HealthSignal이 없으면 `source_gaps`에 표시하고, 실제 신호가 있으면 해당 gap만 제거한다. Health의 `UNKNOWN`을 `HEALTHY`로 바꾸지 않는다.
- 금지: exact4 밖 제품/테스트/문서 수정, 새 HealthSignal·ping·상세 링크·UI/API/DB/권한·Secret 변경, 임시 mock의 운영 코드 승격, Main Event/progress/WORK_STATUS/control 수정, commit·push, WSL-server·ysna/Production 접근.
- 검증: 먼저 누락 gap RED, 최소 구현 GREEN; F-13/OIDC/Dashboard 집중·인접 회귀, G-05, diff check. pytest 전용 temp 생성·정리 증거. 실제 PG/browser/Provider/Artifact Store 연결은 실행하지 않으며 PASS로 주장하지 않는다.
- 결과: 정확 명령과 종료 코드, 변경 전후 diff·기존 기능 영향, 오류 횟수·미검증·rollback, 진행 파일 Main 소유를 판정→판단 이유→조치로 기록한다. `COMPLETED`/유효 `FAILURE_REPORT`/`INCOMPLETE`/`BLOCKED`를 구분한다.
