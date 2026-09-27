# F-18 R18 분리 Worker digest preflight 계획

> 승인된 F-18 단계1의 Web/API/Worker 세 실제 image digest 결박을 위한 내부 계약 보완이다. 기존 branch `codex/f18-wsl-ops`와 단일 제품 writer만 사용한다.

## 기준·문제

- R17 제품 SHA `57653ee835d47c810a1f90d48d9fbe332fb3540c`에서 WSL-server Web/API/Worker 세 image ID가 서로 다르고 각 OCI revision은 동일 Git SHA임을 실측했다. F-18 전체 acceptance는 아니다.
- `packages/deployment/promotion_preflight.py::validate_promotion`은 세 digest를 signed manifest 및 관측 map과 대조하지만 legacy `runtime_image_digest`를 API와 Worker 양쪽에 같게 요구한다. 정직한 분리 Worker image를 `DEPLOY_ARTIFACT_MISMATCH`로 거부하므로 작업계획서의 세 역할 digest 요건과 충돌한다.
- 기능 범위·요구사항·중요 위험을 바꾸지 않는 기존 승인 F-18 내부 정합 보완으로 분류한다. Production·`ysna-server`·DB/Secret·공개 API·배포 부작용은 범위 밖이다.

## Global Constraints

- 제품 exact4: `packages/deployment/promotion_preflight.py`, `tests/deploy/test_f18_promotion_preflight.py`, `tests/deploy/test_f18_wsl_operational.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. 그 밖의 제품·통제 파일은 writer가 수정하지 않는다.
- legacy `runtime_image_digest`는 API digest의 별칭으로만 검증한다. Worker digest는 `image_digests["worker"]`와 signed ReleaseManifest의 Worker digest를 독립 비교한다. Web 누락은 기존 `WEB_IMAGE_NOT_VERIFIED`, 다른 누락·형식·mismatch는 기존 fail-closed reason code를 유지한다.
- distinct Worker와 API가 각각 manifest/evidence와 일치할 때만 기존 `READY_FOR_PRIVATE_REHEARSAL`(F-18 operational gate는 별도 capability 조건)을 반환한다. 같은 digest를 쓰는 과거 fixture도 호환되어야 하지만 실제 세 image 검증으로 승격하지 않는다.
- 서명 검증, approval/environment/migration/rollback 결박, exact Git checkout, OIDC/object store/network/PG18 capability gating을 약화하지 않는다. 정적 fixture PASS를 실제 WSL capability PASS로 승격하지 않는다.

## Task 1: RED→GREEN 최소 계약 수정

1. 두 test 파일에서 distinct API/Worker signed subject와 관측 map이 일치하는 허용 사례, legacy runtime/API 불일치와 Worker 관측/서명 불일치 거부 사례를 RED로 추가한다. 기존 동일 digest·Web 누락·invalid map·approval mismatch 테스트를 유지한다.
2. `validate_promotion`의 legacy runtime 비교에서 Worker 동일성 조건만 제거한다. 다른 비교·reason ordering은 유지한다.
3. focused F-16/F-17/F-18 배포 회귀, 전체 pytest 시도, diff-check를 실행하고 보고서에 RED/GREEN·미검증·rollback을 기록한다. exact4 clean commit. Main이 독립 검토 후 push·G-05와 다음 실제 WSL 수집 계획을 소유한다.

## Rollback

R18 exact4 제품 commit만 정상 revert한다. R17 세 image와 shared WSL 서비스는 변경하지 않는다.
