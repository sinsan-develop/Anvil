# F-20/U-01 R39 Artifact Store Health Source Gap 계획

## 목적과 경계

설계 §29.2의 여섯 Health component 중 `artifact_store` 관측 source가 없을 때, F-13 `project_operations`의 기존 `source_gaps`에도 해당 component를 빠짐없이 표시한다. 현재 `health.artifact_store.state=UNKNOWN`은 유지한다. 실제 Artifact Store ping, 상세 화면, 신규 API, DB·Secret·권한, UI 상태 승격은 이 절편의 범위가 아니다. 이 절편만으로 U-01/F-20을 수락하지 않는다.

## 단일 writer와 exact 경로

- Main 어울: canonical dual lease·검증·Git/private push·WSL-server 동일 SHA·종료 통제.
- `developer-primary`: 유효한 두 fencing token 확인 후 다음 네 파일만 수정: `packages/observability/projection.py`, `tests/observability/test_f13_operations.py`, `tests/api/test_f20_u01_r10_dashboard_api.py`, `docs/04_test_reports/F-20_U01_R39_ARTIFACT_HEALTH_GAP_RESULT.md`.
- 현재 `codex/f18-wsl-ops` 브랜치만 사용. Main은 Developer lease 동안 네 파일에 쓰지 않는다.

## TDD와 완료조건

1. F-13 단위 테스트에서 source가 전혀 없으면 여섯 Health 모두 `UNKNOWN`, `source_gaps`에 여섯 component와 `deployment`가 정확히 한 번씩 있는지 먼저 RED로 확인한다. `artifact_store` signal이 실제 주입되면 그 gap만 사라지며 기존 다른 gap과 Health timestamp/error/evidence는 변하지 않아야 한다.
2. API 테스트는 현재 고정 scope의 Dashboard 응답에서 `artifact_store` 부재를 누락으로 노출하고, 다른 scope 403과 secret-safe 오류를 보존한다. 실패 또는 부분 source를 `HEALTHY`로 바꾸지 않는다.
3. projection의 누락 component 집합만 최소 수정하고 집중·인접 F-13/OIDC/Dashboard 회귀, G-05, diff check를 통과한다. 로컬 pytest는 기본 Windows temp ACL을 피하기 위해 사전 부재 확인한 전용 `--basetemp`를 사용하며 생성물은 신원 확인 뒤 exact 경로만 정리한다.
4. Main 독립 diff/review 뒤 현재 branch에 checkpoint/private push, WSL-server에서 clean exact SHA와 G-05·집중 테스트를 확인한다. WSL 임시 checkout만 검증 후 제거하고 잔여0을 기록한다. 변경 파일, 명령/exit, 오류·SKIP/미검증·rollback을 결과와 WORK_STATUS에 남긴다.

기능 범위·요구사항·중요 위험을 변경하지 않는 기존 출력의 누락 표시 보완이다. `source_gaps` 배열의 값만 달라지므로 strict consumer 회귀를 반드시 확인한다.
