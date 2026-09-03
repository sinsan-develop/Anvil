# WI-C-21-LR-02A-20260903-001 — Canonical 3770 runtime readiness and deploy contract

## 1. 결박 기준

- Work Package: `C-21 / LR-02A`
- 기준 branch/HEAD: `codex/c21-lifecycle-runtime@e57f008d0916953dab3c9425322a1e8942ed0379`
- upstream 기준: `origin/main@1573e0242aa718d0f81f6b6fc936c754b7c75e60`
- feature remote 기준: `origin/codex/c21-lifecycle-runtime@e57f008d0916953dab3c9425322a1e8942ed0379`
- 설계 baseline SHA-256: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`
- 작업계획서 SHA-256: `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`
- 승인: `APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001` (`subject_hash=3A68623BF9426EB619AC0B8E082028F73442F90F4680FDCE871711B60A6B5FAD`)
- 단일 executor: `developer-primary`

## 2. 목표

운영 표준 진입점을 `anvil.sinsan.kr → anvil-web:3770` Unified FastAPI ASGI runtime으로 정합화한다. readiness와 배포 계약은 migration head `0013_task_bootstrap_authority`를 요구하며 활성 표준 deploy/verify/rollback/compose 경로에서 4173 및 preview 의존성을 제거한다.

## 3. 필요한 동작

1. `/health/ready`는 runtime `app.state.migration_head`와 `0013_task_bootstrap_authority`를 일치 검증하고 성공 응답에도 동일 값을 반환한다.
2. canonical production compose는 `anvil-web` 단일 서비스가 `3770`을 expose하고 `proxy-network`에서 NPM이 `anvil-web:3770`으로 접근할 수 있게 정의한다.
3. 표준 `deploy.sh`, `verify.sh`, `rollback.sh`, bootstrap entrypoint는 canonical production compose와 3770 health/API/OpenAPI 계약만 사용한다.
4. canonical 활성 script와 README/DRAFT manifest에서 4173 및 public-preview 실행 의존성은 0건이어야 한다. historical preview/internal 파일은 삭제하거나 실행하지 않는다.
5. migration target은 `0013_task_bootstrap_authority`, precondition은 `0012_run_authority`로 명시하며 동일 0013 재실행은 idempotent하게 처리한다.
6. 공개 도메인은 신산님의 최신 직접 지시인 `anvil.sinsan.kr`로 고정한다. 브라우저 API는 same-origin 상대 경로를 유지한다.
7. ReleaseManifest.C21.DRAFT는 실제 배포 승인 manifest가 아니며 현재 정확한 commit/tag가 확정되기 전 placeholder를 실제 승인값처럼 사용하지 않는다.

## 4. 단일 writer exact path set

- `apps/api/anvil_api/asgi.py`
- `deploy/ysna/bootstrap-deploy.sh`
- `deploy/ysna/compose.production.yml`
- `deploy/ysna/deploy.sh`
- `deploy/ysna/verify.sh`
- `deploy/ysna/rollback.sh`
- `deploy/ysna/README.md`
- `deploy/ysna/ReleaseManifest.C21.DRAFT.json`
- `tests/api/test_public_asgi_frontend.py`
- `tests/deploy/test_public_deploy_pipeline.py`
- `tests/deploy/test_ysna_deployment_contract.py`
- `tests/deploy/test_ysna_scripts_contract.py`
- `docs/04_test_reports/C-21_LIFECYCLE_RUNTIME_PROGRESS.md`
- `.superpowers/sdd/Anvil_작업계획서_v1/task-2-report.md`

## 5. TDD와 완료 조건

1. readiness 0013 및 canonical deploy contract의 RED test를 먼저 작성하고 예상 실패를 기록한다.
2. 최소 구현 후 focused API/deploy tests, 기존 Task/Run/SSE/local-session 회귀, progress checker와 `git diff --check`를 실행한다.
3. 활성 표준 경로의 4173/public-preview 참조 0건, 3770/0013/anvil.sinsan.kr 결박을 정적·계약 테스트로 증명한다.
4. 실제 Docker build, 서버/SSH, DB migration, NPM/DNS/Secret 변경, 배포, container removal, Telegram/Provider 호출은 `NOT_EXECUTED`로 기록한다.

## 6. 금지 및 결과 계약

- LR-01 frozen product/evidence/WI/manifest/digest, C-01, test-session 권한, project provisioning을 수정하지 않는다.
- 허용 경로 밖 수정, commit, merge, push를 수행하지 않는다.
- 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고하며 변경 파일, RED/GREEN 명령·exit, 미검증, 잔여 위험, rollback을 포함한다.
