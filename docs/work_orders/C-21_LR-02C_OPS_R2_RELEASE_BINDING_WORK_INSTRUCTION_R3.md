# C-21 / LR-02C OPS-R2 Release Binding WorkInstruction R3

## 1. 권위와 분류

- ID: `WI-C-21-LR-02C-OPS-R2-RELEASE-BINDING-20260904-001`
- 기준 HEAD: `b4858ffb373066b24d7d9ee9bfde810160cacb75`
- 부모 WorkInstruction: `WI-C-21-LR-02C-OPS-R2-20260903-001`
- 부모 기준선 SHA-256: `E03671A4F7FA76B805726E04E0AACB576B5ECEFB72D349F30E546DAB33DEC491`
- 부모 승인: `APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001`
- 변경 분류: `MAIN_RECONFIRMED_NON_SEMANTIC`
- 기능 범위·요구사항·중요 위험 변경: 없음
- 실행자: `main-agent-eoul`

## 2. 목표

검증된 OPS-R2 구현 checkpoint `b4858ffb373066b24d7d9ee9bfde810160cacb75`를 `deploy/ysna/ReleaseManifest.json`의 유일한 source/target commit으로 결박한다. 기존 epoch5 Developer worker/write lease와 OPS-R2 ACTIVE 상태는 유지한다.

## 3. 정확한 governance write scope

1. `deploy/ysna/ReleaseManifest.json`
2. `docs/work_orders/C-21_LR-02C_OPS_R2_RELEASE_BINDING_WORK_INSTRUCTION_R3.md`
3. `docs/work_orders/C-21_LR-02C_OPS_R2_RELEASE_BINDING_INVOCATION_PROMPT_R3.md`
4. `docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_RELEASE_REBIND_MANIFEST.json`
5. `docs/progress/progress-handoff-detached-digest-c21-lr02c-ops-r2-release-rebind.json`
6. `docs/progress/build-progress.json`
7. `docs/progress/BUILD_HANDOFF.md`
8. `docs/progress/progress-events.json`
9. `scripts/check_project_progress.py`
10. `tests/tooling/test_project_progress.py`

이 exact10 외 제품 script, deploy 동작 script, API, migration, receipt, failure ledger, 기존 OPS-R2 manifest/digest/WI와 seq1~475는 변경하지 않는다.

## 4. 결박 계약

1. ReleaseManifest `source.commit`과 `runtime.target_expected_commit`은 full `b4858ffb373066b24d7d9ee9bfde810160cacb75`로 일치한다.
2. fresh 검증 근거는 tooling 93, backup contract 18, ysna scripts contract 6, API 99로 총 216 PASS만 기록한다.
3. backup script, checker, tooling/backup/ysna 계약 test file의 실제 SHA-256을 기록한다.
4. operational backup attempt 2와 deployment는 `NOT_EXECUTED`다.
5. Telegram과 Provider는 `USER_VERIFICATION_PENDING`, C-01은 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`를 유지한다.
6. 기존 OPS-R2 epoch5 worker/write lease와 active WorkInstruction은 교체·확대·회수하지 않는다.

## 5. 검증과 금지선

- project progress checker, tooling 93, backup 18, ysna 6, API 99, Bash syntax, JSON parse/duplicate, seq1~475 canonical hash, exact10 cached diff를 검증한다.
- operational backup attempt 2, deploy, migration, Docker/SSH/DB/NPM/DNS/secret 변경, Telegram/Provider 실호출을 금지한다.
- ReleaseManifest completion/deployment 결과를 생성하지 않고 `APPROVED_FOR_DEPLOYMENT` 준비 상태만 결박한다.
